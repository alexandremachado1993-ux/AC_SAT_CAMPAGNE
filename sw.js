/* =============================================================
   sw.js — Service worker (application installable, ouverture hors ligne, mises à jour VALIDÉES par l'utilisateur)

   Ce fichier ne change PLUS à chaque version : l'application n'a plus de liste de fichiers ici.
   - Chaque version installée est une copie complète de l'application dans un cache « acsc-<version> ».
   - Un petit cache « acsc-meta » retient la version ACTIVE : celle que l'utilisateur a installée. L'application est servie
     depuis cette copie (même en ligne) : elle ne change donc JAMAIS toute seule, d'un appareil à l'autre.
   - Une nouvelle version se télécharge dans un AUTRE cache (par l'application, avec une barre de progression), et n'est activée que
     par le message { type: "ACTIVER", nom } envoyé quand l'utilisateur valide. Si le téléchargement échoue, rien ne change.
   - La toute première installation (ou la reprise après une mise à jour de CE fichier) copie la version publiée par le serveur
     (version.json, qui donne la liste des fichiers). version.json et version.txt ne sont jamais servis depuis le cache.
   Les appels à d'autres domaines (Supabase) ne sont jamais touchés.

   Notifications push : affichées à réception (résumé du matin, rappel 1 h avant un rendez-vous, mise à jour disponible),
   un clic ouvre ou ramène l'application. Testé par Tests/test54.js (simulateur de service worker).
   ============================================================= */

const PREFIXE = "acsc-";
const META = "acsc-meta";
const CLE_ACTIF = "actif";
const CLE_ATTENDU = "attendu";
const SEUIL_COPIE_SAINE = 20;      // à défaut de taille retenue (anciennes installations) : une copie saine compte une quarantaine de fichiers
/* Jamais servis depuis le cache : un numéro de version périmé ferait croire à tort que tout est à jour (voir AppLayout, mise à jour). */
const TOUJOURS_FRAIS = /\/version\.(json|txt)$/;

let actif = null;       // nom du cache actif, gardé en mémoire (relu depuis acsc-meta quand le service worker redémarre)

async function lireActif() {
    const meta = await caches.open(META);
    const reponse = await meta.match(CLE_ACTIF);
    actif = reponse ? await reponse.text() : null;
    return actif;
}

/* Nombre de fichiers que la copie active DOIT contenir (retenu avec son nom) : tant que la copie en a moins, elle n'est pas fiable. */
async function lireAttendu() {
    const meta = await caches.open(META);
    const reponse = await meta.match(CLE_ATTENDU);
    const n = reponse ? parseInt(await reponse.text(), 10) : NaN;
    return Number.isFinite(n) ? n : null;
}

async function ecrireActif(nom, attendu) {
    const meta = await caches.open(META);
    await meta.put(CLE_ACTIF, new Response(nom));
    if (attendu) await meta.put(CLE_ATTENDU, new Response(String(attendu)));
    actif = nom;
}

async function tailleCopie(nom) {
    return (await caches.has(nom)) ? (await (await caches.open(nom)).keys()).length : 0;
}

/* Supprime les copies des anciennes versions (et l'ancien cache « acsc-v6 » de l'époque du réseau d'abord) — MAIS JAMAIS tant que la copie active n'est pas
   complète : l'ancienne copie qui fonctionne est alors le dernier recours (une copie vide + un site injoignable = application morte). */
async function nettoyer() {
    if (actif) {
        const attendu = await lireAttendu();
        if (attendu && await tailleCopie(actif) < attendu) return;
    }
    const noms = await caches.keys();
    await Promise.all(noms.filter(n => n.startsWith(PREFIXE) && n !== META && n !== actif).map(n => caches.delete(n)));
}

/* Première installation : copie la version publiée, TOUT OU RIEN. Si un seul fichier échoue (site momentanément injoignable…), la copie à moitié faite est supprimée, rien n'est
   activé et l'installation échoue : le navigateur réessaiera et l'éventuelle ancienne copie reste en service. Une mise à jour de CE fichier (version déjà installée, copie saine)
   ne change PAS la version de l'application ; une copie vide ou à moitié faite (installation interrompue) est refaite. */
async function premiereInstallation() {
    await lireActif();
    if (actif && await caches.has(actif)) {
        const attendu = await lireAttendu();
        if (await tailleCopie(actif) >= (attendu || SEUIL_COPIE_SAINE)) return;
    }
    const reponse = await fetch("version.json", { cache: "no-store" });
    if (!reponse.ok) throw new Error("version.json : " + reponse.status);
    const infos = await reponse.json();
    const nom = PREFIXE + infos.version;
    const liste = (Array.isArray(infos.fichiers) ? infos.fichiers : []).map(f => f && f.u).filter(u => typeof u === "string" && !/^[a-z]+:|^\/\//i.test(u));
    if (!liste.length) throw new Error("version.json : aucune liste de fichiers");
    await caches.delete(nom);
    const cache = await caches.open(nom);
    const resultats = await Promise.allSettled(liste.map(u => cache.add(new Request(u, { cache: "reload" }))));
    const echecs = resultats.filter(r => r.status === "rejected").length;
    if (echecs) { await caches.delete(nom); throw new Error("copie incomplète : " + echecs + " fichier(s) sur " + liste.length + " en échec"); }
    await ecrireActif(nom, liste.length);
}

self.addEventListener("install", (event) => {
    event.waitUntil(premiereInstallation().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
    event.waitUntil(lireActif().then(nettoyer).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
    const requete = event.request;
    if (requete.method !== "GET") return;
    const url = new URL(requete.url);
    if (url.origin !== self.location.origin) return;
    /* Vidéos et requêtes partielles (Range) : laissées au navigateur. Les mettre en cache
       provoque des erreurs (réponses 206 refusées) et empêche la lecture sur iPhone. */
    if (requete.headers.has("range") || /\.(mp4|webm)$/i.test(url.pathname)) return;
    if (TOUJOURS_FRAIS.test(url.pathname)) return;
    /* « cache: reload » / « no-store » = « va chercher sur le réseau » : c'est le signal du TÉLÉCHARGEMENT d'une nouvelle version par l'application
       (sans lui, ce téléchargement recevrait la copie de l'ancienne version) et d'une demande volontaire de fraîcheur. */
    if (requete.cache === "reload" || requete.cache === "no-store") return;
    event.respondWith(servir(event, requete));
});

/* Page de secours : quand rien ne peut être servi (site injoignable ET aucune copie), un message clair plutôt que « ERR_FAILED ». */
const PAGE_SECOURS = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AC SAT Campagne</title>' +
    '<style>body{font-family:system-ui,sans-serif;margin:0;padding:32px 24px;text-align:center;color:#222}h1{font-size:1.3rem;margin:24px 0 8px}p{line-height:1.5;color:#555;max-width:34ch;margin:8px auto}' +
    'a{display:inline-block;margin-top:20px;padding:12px 24px;border-radius:12px;background:#d90b1c;color:#fff;text-decoration:none;font-weight:700}</style></head><body>' +
    '<h1>Impossible de joindre le serveur</h1><p>Ton application est bien installée et tes données sont conservées sur cet appareil.</p><p>Vérifie ta connexion, puis réessaie.</p><a href="">Réessayer</a></body></html>';

/* Copie figée d'abord. Un fichier absent de la copie va au réseau (et rejoint la copie, tant qu'elle existe). Site injoignable : on cherche le fichier dans N'IMPORTE QUELLE
   copie (l'ancienne copie qui fonctionne sert de dernier recours), une page inconnue retombe sur l'accueil, et à défaut la page de secours. */
async function servir(event, requete) {
    const nom = actif || await lireActif();
    /* L'adresse racine « / » est redirigée vers Index.html par le serveur : la copie ne connaît que Index.html. */
    const cherche = new URL(requete.url).pathname === "/" ? "Index.html" : requete;
    if (nom) {
        const copie = await caches.match(cherche, { cacheName: nom, ignoreSearch: true });
        if (copie) return copie;
    }
    try {
        const reponse = await fetch(requete);
        if (reponse.ok && nom) event.waitUntil(caches.has(nom).then(existe => (existe ? caches.open(nom).then(c => c.put(requete, reponse.clone())) : null)));
        return reponse;
    } catch (e) {
        const ailleurs = await caches.match(cherche, { ignoreSearch: true });
        if (ailleurs) return ailleurs;
        if (requete.mode === "navigate") {
            const accueil = await caches.match("Index.html", { ignoreSearch: true });
            if (accueil) return accueil;
            return new Response(PAGE_SECOURS, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
        }
        throw e;
    }
}

/* L'application a téléchargé une version complète dans « acsc-<version> » et l'utilisateur a validé : on la rend active. */
self.addEventListener("message", (event) => {
    const m = event.data || {};
    if (m.type !== "ACTIVER") return;
    const reponse = (ok) => { if (event.ports && event.ports[0]) event.ports[0].postMessage({ ok }); };
    if (typeof m.nom !== "string" || !m.nom.startsWith(PREFIXE) || m.nom === META) { reponse(false); return; }
    event.waitUntil((async () => {
        const taille = await tailleCopie(m.nom);
        const attendu = Number.isFinite(m.n) ? m.n : 0;
        if (!taille || taille < attendu) { reponse(false); return; }      // copie absente, vide ou incomplète : on n'active PAS
        await ecrireActif(m.nom, attendu || taille);
        await nettoyer();
        reponse(true);
    })());
});

self.addEventListener("push", (event) => {
    let charge = {};
    try { charge = event.data ? event.data.json() : {}; } catch (e) { charge = { corps: event.data ? event.data.text() : "" }; }
    event.waitUntil(self.registration.showNotification(charge.titre || "AC SAT Campagne", {
        body: charge.corps || "",
        icon: "Images/icone-192.png",
        badge: "Images/badge-96.png",
        tag: charge.tag || undefined,
        data: { url: charge.url || "Index.html" }
    }));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const cible = new URL((event.notification.data && event.notification.data.url) || "Index.html", self.registration.scope).href;
    event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
        const ouverte = fenetres.find(f => f.url.startsWith(self.registration.scope));
        if (ouverte) return ouverte.navigate(cible).then(f => (f || ouverte).focus());
        return self.clients.openWindow(cible);
    }));
});
