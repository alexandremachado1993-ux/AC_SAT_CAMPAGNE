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

   Équipe : si le compte appartient à une équipe, clients, contacts et
   lignes sont échangés avec public.elements_equipe (partagés avec les
   membres) ; visites, rendez-vous et profil restent dans public.elements
   (privés). Hors équipe, tout reste dans public.elements.

   Connexion : gardée 30 jours sur l'appareil (DUREE_CONNEXION_JOURS),
   puis une nouvelle connexion est demandée. Entre-temps, aucune saisie
   de mot de passe : la synchronisation reprend seule à chaque ouverture.

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
    const DUREE_CONNEXION_JOURS = 30;
    const CLE_CONNEXION = "acsc_connexion_le";   // date de la dernière connexion par mot de passe

    let transport = null;
    let demarre = false;
    let enCours = false, relancer = false, minuteur = null;
    /* « verification » tant que la session enregistrée n'a pas été relue :
       évite d'afficher le formulaire de connexion une fraction de seconde
       alors que l'on est déjà connecté. */
    const etat = { statut: "verification", email: null, derniere: null, erreur: null, valableJusquau: null, equipe: lireEquipeConnue() };

    /* Dernière équipe connue, pour l'afficher même hors ligne. */
    function lireEquipeConnue() {
        try { return JSON.parse(localStorage.getItem("acsc_equipe") || "null"); } catch (e) { return null; }
    }

    /* Membre correspondant au compte connecté (null hors équipe). */
    function moiDans(equipe) {
        return equipe && Array.isArray(equipe.membres) ? (equipe.membres.find(m => m.moi) || null) : null;
    }

    /* Le technicien courant filtre rappels, tournée et planning. */
    function appliquerTechnicien(equipe) {
        const moi = moiDans(equipe);
        Donnees.definirTechnicienCourant(moi && moi.id ? moi.id : null);
    }

    /* Membres de l'équipe (pour attribuer un client) : [] hors équipe. */
    function membresEquipe() {
        return (etat.equipe && Array.isArray(etat.equipe.membres)) ? etat.equipe.membres.filter(m => m.id) : [];
    }

    function memoriserEquipe(equipe) {
        try {
            if (equipe) localStorage.setItem("acsc_equipe", JSON.stringify(equipe)); else localStorage.removeItem("acsc_equipe");
        } catch (e) { Erreurs.signaler("Synchro : affichage seulement", e); }
    }

    /* ---------- Durée de la connexion (30 jours) ---------- */

    function lireConnexionLe() {
        try { return localStorage.getItem(CLE_CONNEXION); } catch (e) { return null; }
    }

    function ecrireConnexionLe(iso) {
        try {
            if (iso) localStorage.setItem(CLE_CONNEXION, iso); else localStorage.removeItem(CLE_CONNEXION);
        } catch (e) { Erreurs.consigner("Synchro : stockage refusé : la connexion restera simplement sans échéance", e); }
    }

    function finConnexion() {
        const d = Date.parse(lireConnexionLe() || "");
        return isNaN(d) ? null : new Date(d + DUREE_CONNEXION_JOURS * 86400000).toISOString();
    }
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
            async tirer(depuis, strict, equipe) {
                let q = client.from(equipe ? "elements_equipe" : "elements").select("collection,id,contenu,maj_client,supprime,maj_serveur")
                    .order("maj_serveur", { ascending: true }).limit(TAILLE_PAGE);
                if (depuis) q = strict ? q.gt("maj_serveur", depuis) : q.gte("maj_serveur", depuis);
                const { data, error } = await q;
                if (error) throw error;
                return data || [];
            },
            async pousser(lot, equipe) {
                const { error } = await client.rpc(equipe ? "pousser_elements_equipe" : "pousser_elements", { lot });
                if (error) throw error;
            },
            async monEquipe() {
                const { data, error } = await client.rpc("mon_equipe_details");
                if (error) throw error;
                return data || null;
            },
            async creerEquipe(nom, nomAffiche) {
                const { data, error } = await client.rpc("creer_equipe", { nom, nom_affiche: nomAffiche });
                if (error) throw error;
                return data;
            },
            async rejoindreEquipe(code, nomAffiche) {
                const { data, error } = await client.rpc("rejoindre_equipe", { code, nom_affiche: nomAffiche });
                if (error) throw error;
                /* Un faux code est RENVOYÉ par la base (et non levé) : une exception annulerait l'enregistrement de la tentative,
                   donc la limite de 5 essais par 15 minutes ne compterait rien. On le retransforme en erreur ici. */
                if (data && data.erreur) throw new Error(data.erreur);
                return data;
            },
            async quitterEquipe() {
                const { error } = await client.rpc("quitter_equipe");
                if (error) throw error;
            },
            async enregistrerAbonnement(endpoint, p256dh, auth, appareil) {
                const { error } = await client.rpc("enregistrer_abonnement", { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_appareil: appareil });
                if (error) throw error;
            },
            async supprimerAbonnement(endpoint) {
                const { error } = await client.from("push_abonnements").delete().eq("endpoint", endpoint);
                if (error) throw error;
            },
            async testerNotification() {
                const { data, error } = await client.functions.invoke("rappels", { body: { test: true } });
                if (error) throw error;
                return data;
            }
        };
    }

    /* ---------- État ---------- */

    function changerEtat(maj) {
        Object.assign(etat, maj);
        ecouteurs.forEach(fn => { try { fn(Object.assign({}, etat)); } catch (e) { Erreurs.consigner("Synchro : stockage refusé : la connexion restera simplement sans échéance", e); } });
    }

    function ecouter(fn) { ecouteurs.push(fn); fn(Object.assign({}, etat)); }

    /* Session de connexion invalide ou expirée : jeton refusé, rafraîchissement impossible, ou fonction de base qui exige une connexion. */
    function estSessionInvalide(e) {
        const m = (e && e.message) || String(e);
        return (e && e.status === 401) || /jwt|invalid.*token|refresh.?token|token.*expired|not authenticated|auth session missing|connexion requise/i.test(m);
    }

    function messageErreur(e) {
        const m = (e && e.message) || String(e);
        if (/invalid login credentials/i.test(m)) return "Email ou mot de passe incorrect — ou compte pas encore créé (voir « Créer mon compte »).";
        if (/email not confirmed/i.test(m)) return "Adresse email pas encore confirmée : ouvre le lien reçu par email.";
        if (/signups not allowed|signup.*disabled/i.test(m)) return "La création de compte est désactivée.";
        if (/already registered/i.test(m)) return "Un compte existe déjà avec cet email : connecte-toi.";
        if (/password should be at least/i.test(m)) return "Mot de passe trop court (8 caractères minimum conseillés).";
        if (/failed to fetch|network/i.test(m)) return "Réseau indisponible.";
        if (/code_inconnu/.test(m)) return "Code d'équipe inconnu : vérifie les 8 caractères.";
        if (/trop_de_tentatives/.test(m)) return "Trop d'essais avec un mauvais code : réessaie dans 15 minutes.";
        if (/deja_membre/.test(m)) return "Ce compte fait déjà partie d'une équipe : quitte-la d'abord.";
        if (/aucune_equipe/.test(m)) return "Ce compte ne fait plus partie d'une équipe.";
        if (estSessionInvalide(e)) return "Session expirée : reconnecte-toi pour reprendre la synchronisation.";
        if (/permission denied|row-level security|violates row-level/i.test(m)) return "Le serveur a refusé l'opération (droits insuffisants).";
        if (/timeout|timed out|\b50[234]\b/i.test(m)) return "Le serveur met trop de temps à répondre : réessaie dans un instant.";
        /* Message inconnu : jamais montré tel quel (détail technique) ; il va dans le journal de diagnostic. */
        Erreurs.consigner("Synchro : message d'erreur non reconnu : " + m.slice(0, 80), e);
        return "Opération impossible pour le moment : réessaie dans un instant.";
    }

    /* ---------- Synchronisation ---------- */

    async function synchroniser() {
        if (!transport) return;
        if (enCours) { relancer = true; return; }
        enCours = true;
        try {
            /* La session est relue sur l'appareil : pas besoin de réseau. */
            const email = await transport.utilisateur();
            if (!email) { changerEtat({ statut: "deconnecte", email: null, valableJusquau: null }); return; }

            if (!lireConnexionLe()) {
                /* Session ouverte avant l'arrivée de la règle des 30 jours :
                   le délai part d'aujourd'hui plutôt que de déconnecter. */
                ecrireConnexionLe(new Date().toISOString());
            } else if (Date.now() > Date.parse(finConnexion())) {
                try { await transport.deconnexion(); } catch (e) { Erreurs.consigner("Synchro : session locale effacée quand même", e); }
                ecrireConnexionLe(null);
                changerEtat({ statut: "deconnecte", email: null, valableJusquau: null,
                    erreur: "Connexion expirée après " + DUREE_CONNEXION_JOURS + " jours : reconnecte-toi pour reprendre la synchronisation." });
                return;
            }

            if (typeof navigator !== "undefined" && navigator.onLine === false) {
                changerEtat({ statut: "hors-ligne", email, valableJusquau: finConnexion() });
                return;
            }
            changerEtat({ statut: "en-cours", email, erreur: null, valableJusquau: finConnexion() });

            /* 0. Équipe du compte (null hors équipe). */
            const equipe = transport.monEquipe ? await transport.monEquipe() : null;
            memoriserEquipe(equipe);
            /* L'état d'abord : les pages redessinées par le changement de
               technicien lisent la liste des membres dans cet état. */
            changerEtat({ equipe });
            appliquerTechnicien(equipe);
            const partagees = Donnees.COLLECTIONS_PARTAGEES;

            /* 1. Recevoir : l'espace personnel, puis celui de l'équipe. En
               équipe, les clients / contacts / lignes encore présents dans
               l'espace personnel (copies d'avant l'équipe) sont ignorés. */
            await recevoir(null, equipe ? (r => partagees.indexOf(r.collection) === -1) : null);
            if (equipe) await recevoir(equipe.id, null);

            /* 2. Envoyer, chaque élément vers son espace. */
            const aEnvoyer = Donnees.elementsAEnvoyer();
            const versEquipe = equipe ? aEnvoyer.filter(e => partagees.indexOf(e.collection) !== -1) : [];
            const versPerso = equipe ? aEnvoyer.filter(e => partagees.indexOf(e.collection) === -1) : aEnvoyer;
            await envoyer(versPerso, false);
            await envoyer(versEquipe, true);

            changerEtat({ statut: "ok", derniere: new Date().toISOString(), erreur: null });
        } catch (e) {
            if (estSessionInvalide(e)) {
                /* Session périmée en cours de route : on l'efface et on ramène à l'écran de connexion (les données restent sur l'appareil). */
                try { await transport.deconnexion(); } catch (e2) { Erreurs.consigner("Synchro : session invalide effacée quand même", e2); }
                ecrireConnexionLe(null);
                changerEtat({ statut: "deconnecte", email: null, valableJusquau: null, erreur: messageErreur(e) });
            } else changerEtat({ statut: "erreur", erreur: messageErreur(e) });
        } finally {
            enCours = false;
            if (relancer) { relancer = false; synchroniser(); }
        }
    }

    /* Réception d'un espace — première page avec 10 s de recouvrement
       (aucun élément manqué), pages suivantes strictement après la dernière
       ligne reçue (sinon un gros premier envoi bouclerait sur la même
       page). Réappliquer un élément déjà connu est sans effet. */
    async function recevoir(equipeId, garder) {
        let curseur = Donnees.getCurseur(equipeId);
        let depuis = curseur ? new Date(Date.parse(curseur) - RECOUVREMENT_MS).toISOString() : null;
        let strict = false;
        for (;;) {
            const lignes = await transport.tirer(depuis, strict, equipeId);
            Donnees.appliquerDistant(garder ? lignes.filter(garder) : lignes);
            if (lignes.length === 0) break;
            const dernier = lignes[lignes.length - 1].maj_serveur;
            if (!curseur || Date.parse(dernier) > Date.parse(curseur)) {
                curseur = dernier;
                Donnees.definirCurseur(curseur, equipeId);
            }
            if (lignes.length < TAILLE_PAGE) break;
            depuis = dernier;
            strict = true;
        }
    }

    async function envoyer(elements, versEquipe) {
        for (let i = 0; i < elements.length; i += TAILLE_ENVOI) {
            const lot = elements.slice(i, i + TAILLE_ENVOI);
            await transport.pousser(lot, versEquipe);
            Donnees.confirmerEnvoi(lot);
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
            ecrireConnexionLe(new Date().toISOString());
            await synchroniser();
            return { ok: true };
        } catch (e) { return { ok: false, message: messageErreur(e) }; }
    }

    async function inscription(email, motDePasse) {
        try {
            const r = await transport.inscription(email, motDePasse);
            if (!r.confirmationRequise) {
                ecrireConnexionLe(new Date().toISOString());
                await synchroniser();
            }
            return { ok: true, confirmationRequise: r.confirmationRequise };
        } catch (e) { return { ok: false, message: messageErreur(e) }; }
    }

    /* ---------- Appels serveur de l'abonnement aux notifications ----------
       Le navigateur (permission, abonnement push, clé VAPID) est dans Notifications.js ; il passe ici pour parler au serveur. */
    const estConnecte = () => !!etat.email;
    const enregistrerAbonnement = (endpoint, p256dh, auth, appareil) => transport.enregistrerAbonnement(endpoint, p256dh, auth, appareil);
    const supprimerAbonnement = (endpoint) => transport.supprimerAbonnement(endpoint);
    const testerNotification = () => transport.testerNotification();

    /* ---------- Équipe ---------- */

    function nomAffiche() { return Donnees.getDonnees().profil.nom || ""; }

    async function creerEquipe(nom) {
        try {
            await transport.creerEquipe(nom, nomAffiche());
            Donnees.marquerPartagesAEnvoyer();
            await synchroniser();
            return { ok: etat.statut !== "erreur", message: etat.erreur };
        } catch (e) { return { ok: false, message: messageErreur(e) }; }
    }

    /* remplacer = true : ses propres clients sont retirés de l'appareil et
       remplacés par ceux de l'équipe. Sinon ils sont ajoutés à l'équipe. */
    async function rejoindreEquipe(code, remplacer) {
        try {
            await transport.rejoindreEquipe(code, nomAffiche());
            if (remplacer) Donnees.oublierPartages(); else Donnees.marquerPartagesAEnvoyer();
            await synchroniser();
            return { ok: etat.statut !== "erreur", message: etat.erreur };
        } catch (e) { return { ok: false, message: messageErreur(e) }; }
    }

    /* Les clients restent sur l'appareil et repartent vers l'espace personnel. */
    async function quitterEquipe() {
        try {
            await transport.quitterEquipe();
            Donnees.marquerPartagesAEnvoyer();
            memoriserEquipe(null);
            appliquerTechnicien(null);
            changerEtat({ equipe: null });
            await synchroniser();
            return { ok: true };
        } catch (e) { return { ok: false, message: messageErreur(e) }; }
    }

    /* Les données restent sur l'appareil : se déconnecter arrête seulement
       la synchronisation. */
    async function deconnexion() {
        try { await transport.deconnexion(); } catch (e) { Erreurs.consigner("Synchro : session locale effacée quand même", e); }
        ecrireConnexionLe(null);
        memoriserEquipe(null);
        appliquerTechnicien(null);
        changerEtat({ statut: "deconnecte", email: null, erreur: null, valableJusquau: null, equipe: null });
    }

    /* ---------- Démarrage ---------- */

    function demarrer(transportPerso) {
        if (demarre) return;
        demarre = true;
        /* Dernière équipe connue : filtre appliqué dès l'ouverture, même hors ligne. */
        appliquerTechnicien(etat.equipe);
        if (transportPerso) transport = transportPerso;
        else if (window.supabase && window.supabase.createClient) transport = transportSupabase();
        else { changerEtat({ statut: "indisponible", erreur: "Bibliothèque Supabase non chargée." }); return; }

        Donnees.ecouterChangementsLocaux(programmer);
        document.addEventListener("visibilitychange", () => { if (!document.hidden) synchroniser(); });
        window.addEventListener("online", synchroniser);
        window.addEventListener("offline", () => { if (etat.email) changerEtat({ statut: "hors-ligne" }); });
        window.addEventListener("pageshow", (e) => { if (e.persisted) synchroniser(); });
        setInterval(() => { if (!document.hidden) synchroniser(); }, INTERVALLE);
        synchroniser();
    }

    return { demarrer, synchroniser, connexion, inscription, deconnexion, ecouter,
        creerEquipe, rejoindreEquipe, quitterEquipe, membresEquipe,
        etat: () => Object.assign({}, etat),
        estConnecte, enregistrerAbonnement, supprimerAbonnement, testerNotification, messageErreur
    };
})();
