/* =============================================================
   Synchro.js — Synchronisation entre appareils (Supabase)

   Principe :
     - les données vivent sur l'appareil (Donnees.js) : tout fonctionne
       sans réseau ;
     - chaque élément modifié est mis « en attente d'envoi » ;
     - une synchronisation = RECEVOIR ce qui a changé ailleurs, puis
       ENVOYER ce qui a changé ici ;
     - conflit (même élément modifié sur deux appareils) : la
       modification la plus récente l'emporte, côté appareil comme côté
       base (fonction SQL pousser_elements).

   Déclenchée : à l'ouverture, 2 s après une saisie, au retour dans
   l'application, au retour du réseau, et toutes les 5 min si ouverte.

   Base : projet Supabase « ac-sat-campagne », table public.elements,
   protégée par RLS (chaque compte ne voit que ses propres lignes).
   La clé ci-dessous est la clé PUBLIQUE du projet : elle est faite pour
   figurer dans le code d'une page web, la sécurité repose sur RLS.
   ============================================================= */

const Synchro = (() => {
    "use strict";

    const CONFIG = {
        url: "https://btzqjbmfkzhdtltgtrob.supabase.co",
        cle: "sb_publishable_pzy0gWynmBwNsTSERQyB7Q_ttbLH52I"
    };
    const DELAI_APRES_SAISIE = 2000;
    const INTERVALLE = 5 * 60 * 1000;
    const RECOUVREMENT_MS = 10000;   // relit les 10 dernières secondes : aucun élément manqué
    const TAILLE_PAGE = 1000;
    const TAILLE_ENVOI = 500;        // limite imposée par pousser_elements

    let transport = null;
    let demarre = false;
    let enCours = false, relancer = false, minuteur = null;
    const etat = { statut: "deconnecte", email: null, derniere: null, erreur: null };
    const ecouteurs = [];

    /* ---------- Transport Supabase (remplaçable par un faux dans les tests) ---------- */

    function transportSupabase() {
        const client = window.supabase.createClient(CONFIG.url, CONFIG.cle, {
            auth: { persistSession: true, autoRefreshToken: true, storageKey: "acsc_auth" }
        });
        return {
            async utilisateur() {
                const { data } = await client.auth.getSession();
                return data && data.session ? data.session.user.email : null;
            },
            async connexion(email, motDePasse) {
                const { error } = await client.auth.signInWithPassword({ email, password: motDePasse });
                if (error) throw error;
            },
            async inscription(email, motDePasse) {
                const { data, error } = await client.auth.signUp({ email, password: motDePasse });
                if (error) throw error;
                return { confirmationRequise: !data.session };
            },
            async deconnexion() { await client.auth.signOut({ scope: "local" }); },
            async tirer(depuis, strict) {
                let q = client.from("elements").select("collection,id,contenu,maj_client,supprime,maj_serveur")
                    .order("maj_serveur", { ascending: true }).limit(TAILLE_PAGE);
                if (depuis) q = strict ? q.gt("maj_serveur", depuis) : q.gte("maj_serveur", depuis);
                const { data, error } = await q;
                if (error) throw error;
                return data || [];
            },
            async pousser(lot) {
                const { error } = await client.rpc("pousser_elements", { lot });
                if (error) throw error;
            }
        };
    }

    /* ---------- État ---------- */

    function changerEtat(maj) {
        Object.assign(etat, maj);
        ecouteurs.forEach(fn => { try { fn(Object.assign({}, etat)); } catch (e) { /* idem */ } });
    }

    function ecouter(fn) { ecouteurs.push(fn); fn(Object.assign({}, etat)); }

    function messageErreur(e) {
        const m = (e && e.message) || String(e);
        if (/invalid login credentials/i.test(m)) return "Email ou mot de passe incorrect — ou compte pas encore créé (voir « Créer mon compte »).";
        if (/email not confirmed/i.test(m)) return "Adresse email pas encore confirmée : ouvre le lien reçu par email.";
        if (/signups not allowed|signup.*disabled/i.test(m)) return "La création de compte est désactivée.";
        if (/already registered/i.test(m)) return "Un compte existe déjà avec cet email : connecte-toi.";
        if (/password should be at least/i.test(m)) return "Mot de passe trop court (8 caractères minimum conseillés).";
        if (/failed to fetch|network/i.test(m)) return "Réseau indisponible.";
        return m;
    }

    /* ---------- Synchronisation ---------- */

    async function synchroniser() {
        if (!transport) return;
        if (enCours) { relancer = true; return; }
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            changerEtat({ statut: etat.email ? "hors-ligne" : etat.statut });
            return;
        }
        enCours = true;
        try {
            const email = await transport.utilisateur();
            if (!email) { changerEtat({ statut: "deconnecte", email: null }); return; }
            changerEtat({ statut: "en-cours", email, erreur: null });

            /* 1. Recevoir — première page avec 10 s de recouvrement (aucun
               élément manqué), pages suivantes strictement après la dernière
               ligne reçue (sinon un gros premier envoi bouclerait sur la
               même page). Réappliquer un élément déjà connu est sans effet. */
            let curseur = Donnees.getCurseur();
            let depuis = curseur ? new Date(Date.parse(curseur) - RECOUVREMENT_MS).toISOString() : null;
            let strict = false;
            for (;;) {
                const lignes = await transport.tirer(depuis, strict);
                Donnees.appliquerDistant(lignes);
                if (lignes.length === 0) break;
                const dernier = lignes[lignes.length - 1].maj_serveur;
                if (!curseur || Date.parse(dernier) > Date.parse(curseur)) {
                    curseur = dernier;
                    Donnees.definirCurseur(curseur);
                }
                if (lignes.length < TAILLE_PAGE) break;
                depuis = dernier;
                strict = true;
            }

            /* 2. Envoyer */
            const aEnvoyer = Donnees.elementsAEnvoyer();
            for (let i = 0; i < aEnvoyer.length; i += TAILLE_ENVOI) {
                const lot = aEnvoyer.slice(i, i + TAILLE_ENVOI);
                await transport.pousser(lot);
                Donnees.confirmerEnvoi(lot);
            }

            changerEtat({ statut: "ok", derniere: new Date().toISOString(), erreur: null });
        } catch (e) {
            changerEtat({ statut: "erreur", erreur: messageErreur(e) });
        } finally {
            enCours = false;
            if (relancer) { relancer = false; synchroniser(); }
        }
    }

    function programmer() {
        clearTimeout(minuteur);
        minuteur = setTimeout(synchroniser, DELAI_APRES_SAISIE);
    }

    /* ---------- Compte ---------- */

    async function connexion(email, motDePasse) {
        try {
            await transport.connexion(email, motDePasse);
            await synchroniser();
            return { ok: true };
        } catch (e) { return { ok: false, message: messageErreur(e) }; }
    }

    async function inscription(email, motDePasse) {
        try {
            const r = await transport.inscription(email, motDePasse);
            if (!r.confirmationRequise) await synchroniser();
            return { ok: true, confirmationRequise: r.confirmationRequise };
        } catch (e) { return { ok: false, message: messageErreur(e) }; }
    }

    /* Les données restent sur l'appareil : se déconnecter arrête seulement
       la synchronisation. */
    async function deconnexion() {
        try { await transport.deconnexion(); } catch (e) { /* session locale effacée quand même */ }
        changerEtat({ statut: "deconnecte", email: null, erreur: null });
    }

    /* ---------- Démarrage ---------- */

    function demarrer(transportPerso) {
        if (demarre) return;
        demarre = true;
        if (transportPerso) transport = transportPerso;
        else if (window.supabase && window.supabase.createClient) transport = transportSupabase();
        else { changerEtat({ statut: "indisponible", erreur: "Bibliothèque Supabase non chargée." }); return; }

        Donnees.ecouterChangementsLocaux(programmer);
        document.addEventListener("visibilitychange", () => { if (!document.hidden) synchroniser(); });
        window.addEventListener("online", synchroniser);
        window.addEventListener("offline", () => { if (etat.email) changerEtat({ statut: "hors-ligne" }); });
        setInterval(() => { if (!document.hidden) synchroniser(); }, INTERVALLE);
        synchroniser();
    }

    return { demarrer, synchroniser, connexion, inscription, deconnexion, ecouter, etat: () => Object.assign({}, etat) };
})();
