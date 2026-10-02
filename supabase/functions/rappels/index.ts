// =============================================================
// Fonction serveur « rappels » — AC SAT Campagne
//
// Appelée :
//   - toutes les 15 min par la tâche planifiée (en-tête x-cron-secret) :
//     résumé du matin à l'heure choisie par chacun, rappel 1 h avant
//     chaque rendez-vous confirmé ;
//   - depuis l'application (bouton « Envoyer une notification de test »),
//     avec le jeton de l'utilisateur connecté : test sur ses appareils.
// Chaque notification n'est envoyée qu'une fois (public.notifications_journal).
// Les appareils désinstallés (réponse 404 / 410) sont retirés.
// =============================================================
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { calculer, heureParis, heureDuResume, rappelsProches, resumeDuMatin } from "./logique.js";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (corps: unknown, statut = 200) =>
    new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Client = any;

async function toutLire(requete: () => Client, taille = 1000) {
    const lignes: Client[] = [];
    for (let debut = 0; ; debut += taille) {
        const { data, error } = await requete().range(debut, debut + taille - 1);
        if (error) throw error;
        lignes.push(...(data || []));
        if (!data || data.length < taille) break;
    }
    return lignes;
}

// Données d'un compte : visites, rendez-vous et profil dans son espace
// personnel ; clients et lignes dans l'espace de son équipe s'il en a une.
async function chargerDonnees(admin: Client, userId: string) {
    const perso = await toutLire(() => admin.from("elements").select("collection,contenu")
        .eq("user_id", userId).eq("supprime", false));
    const { data: membre } = await admin.from("membres").select("equipe_id").eq("user_id", userId).maybeSingle();
    const partages = membre
        ? await toutLire(() => admin.from("elements_equipe").select("collection,contenu").eq("equipe_id", membre.equipe_id).eq("supprime", false))
        : perso;
    const de = (lignes: Client[], col: string) => lignes.filter((l) => l.collection === col).map((l) => l.contenu || {});
    const profil = de(perso, "profil")[0] || {};
    return {
        clients: de(partages, "clients"), lignes: de(partages, "lignes"),
        visites: de(perso, "visites"), rdv: de(perso, "rdv"), profil,
    };
}

// Réserve la clé dans le journal : false si déjà envoyée.
async function reserver(admin: Client, userId: string, cle: string) {
    const { error } = await admin.from("notifications_journal").insert({ user_id: userId, cle });
    if (!error) return true;
    if (error.code === "23505") return false;
    throw error;
}

async function envoyer(admin: Client, abonnements: Client[], charge: Record<string, string>) {
    let envoyees = 0;
    for (const a of abonnements) {
        try {
            await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
                JSON.stringify(charge), { TTL: 6 * 3600 });
            envoyees++;
        } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) await admin.from("push_abonnements").delete().eq("endpoint", a.endpoint);
            else console.error("Envoi impossible", code, (e as Error).message);
        }
    }
    return envoyees;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { persistSession: false },
    });
    const { data: cfg, error: erreurCfg } = await admin.rpc("config_push");
    if (erreurCfg || !cfg) return json({ erreur: "configuration introuvable" }, 500);
    webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);

    let corps: Record<string, unknown> = {};
    try { corps = await req.json(); } catch { /* corps vide */ }

    // --- Test depuis l'application : uniquement sur les appareils du compte connecté.
    if (corps.test) {
        const jeton = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        const { data: u } = await admin.auth.getUser(jeton);
        if (!u?.user) return json({ erreur: "connexion requise" }, 401);
        const { data: abos } = await admin.from("push_abonnements").select("*").eq("user_id", u.user.id);
        const donnees = await chargerDonnees(admin, u.user.id);
        const heure = donnees.profil?.tournee?.heureRappel || "07:30";
        const envoyees = await envoyer(admin, abos || [], {
            titre: "🔔 Notifications actives",
            corps: "Résumé chaque matin à " + heure.replace(":", "h") + " et rappel 1 h avant tes rendez-vous confirmés.",
            url: "Index.html", tag: "test",
        });
        return json({ envoyees, appareils: (abos || []).length });
    }

    // --- Tâche planifiée
    if (req.headers.get("x-cron-secret") !== cfg.secret_cron) return json({ erreur: "non autorisé" }, 401);
    const maintenant = heureParis(new Date());
    const tous = await toutLire(() => admin.from("push_abonnements").select("*"));
    const parCompte: Record<string, Client[]> = {};
    tous.forEach((a) => (parCompte[a.user_id] = parCompte[a.user_id] || []).push(a));

    const bilan = { comptes: 0, resumes: 0, rappels: 0 };
    for (const userId of Object.keys(parCompte)) {
        bilan.comptes++;
        try {
            const donnees = await chargerDonnees(admin, userId);
            const calcul = calculer(donnees, maintenant.date, userId);
            const heureRappel = donnees.profil?.tournee?.heureRappel || "07:30";
            if (heureDuResume(maintenant.minutes, heureRappel)) {
                const resume = resumeDuMatin(calcul, String(donnees.profil?.nom || "").split(" ")[0]);
                if (resume && await reserver(admin, userId, "resume:" + maintenant.date)) {
                    await envoyer(admin, parCompte[userId], resume);
                    bilan.resumes++;
                }
            }
            for (const r of rappelsProches(calcul, maintenant.minutes)) {
                if (await reserver(admin, userId, "rdv1h:" + r.id + ":" + maintenant.date)) {
                    await envoyer(admin, parCompte[userId], { titre: r.titre, corps: r.corps, url: r.url, tag: r.tag });
                    bilan.rappels++;
                }
            }
        } catch (e) {
            console.error("Compte", userId, (e as Error).message);
        }
    }
    return json(bilan);
});
