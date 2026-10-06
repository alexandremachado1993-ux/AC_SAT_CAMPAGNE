/* =============================================================
   AutoDiagnostic.js — « Vérifier mon installation » (Réglages › Informations › Diagnostic)

   Après une mise en ligne, ou quand quelque chose semble anormal, un seul bouton contrôle sur CET appareil, sans outil ni
   console : la version installée, l'installation de l'application, le fonctionnement hors ligne, le stockage, la connexion, la
   synchronisation, les notifications et les erreurs enregistrées. Chaque ligne : ✅ tout va bien, ⚠️ à surveiller (avec ce qu'il
   faut faire), ❌ en panne. Rien n'est envoyé nulle part.

   verifier(surcharges) accepte des « surcharges » de l'environnement : c'est ce qui permet de tester chaque cas sans navigateur.
   ============================================================= */

const AutoDiagnostic = (() => {
    "use strict";

    const ICONES = { ok: "✅", attention: "⚠️", erreur: "❌" };
    const SEUIL_FICHIERS_HORS_LIGNE = 40;     // l'application préchargée compte une quarantaine de fichiers (sw.js, PRECACHE)
    const SEUIL_STOCKAGE = 0.7;               // au-delà de 70 % du quota du navigateur : à surveiller

    const ligne = (nom, etat, detail) => ({ nom, etat, detail });
    const octets = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + " Mo" : Math.max(1, Math.round(n / 1024)) + " Ko";

    /* L'environnement réel : tout ce que les contrôles lisent, regroupé pour pouvoir le remplacer dans les tests. */
    function environnement() {
        return {
            version: typeof AppLayout !== "undefined" ? AppLayout.VERSION : "?",
            recupererVersion: () => window.fetch("version.json", { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject(new Error("réponse " + r.status))),
            installee: () => !!((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true),
            enLigne: () => window.navigator.onLine !== false,
            enregistrementSW: () => ("serviceWorker" in window.navigator) ? window.navigator.serviceWorker.getRegistration() : Promise.resolve(null),
            fichiersHorsLigne: () => (window.caches ? window.caches.keys().then(noms => noms.length ? window.caches.open(noms[noms.length - 1]).then(c => c.keys()).then(k => k.length) : 0) : Promise.resolve(null)),
            testerStockage: () => { const cle = "acsc_test_stockage"; window.localStorage.setItem(cle, "1"); const ok = window.localStorage.getItem(cle) === "1"; window.localStorage.removeItem(cle); return ok; },
            estimerStockage: () => (window.navigator.storage && window.navigator.storage.estimate) ? window.navigator.storage.estimate() : Promise.resolve(null),
            synchro: () => (typeof Synchro !== "undefined" ? Synchro.etat() : null),
            enAttenteEnvoi: () => (typeof Donnees !== "undefined" ? Donnees.elementsAEnvoyer().length : 0),
            permissionNotifications: () => (typeof Notification !== "undefined" ? Notification.permission : "indisponible"),
            erreursEnregistrees: () => (typeof Erreurs !== "undefined" ? Erreurs.nombre() : 0)
        };
    }

    async function controleVersion(env) {
        try {
            const serveur = (await env.recupererVersion()).version;
            return serveur === env.version
                ? ligne("Version", "ok", env.version + " : c'est la dernière version publiée.")
                : ligne("Version", "attention", env.version + " installée, " + serveur + " disponible : mets à jour depuis le menu du profil (pastille).");
        } catch (e) {
            return ligne("Version", "attention", env.version + " installée. Vérification impossible (hors ligne ?).");
        }
    }

    function controleInstallation(env) {
        return env.installee()
            ? ligne("Installation", "ok", "Application installée sur l'écran d'accueil.")
            : ligne("Installation", "attention", "Ouverte dans le navigateur. Installe-la sur l'écran d'accueil pour le hors ligne et les notifications (sur iPhone : Partager › Sur l'écran d'accueil).");
    }

    async function controleHorsLigne(env) {
        try {
            const reg = await env.enregistrementSW();
            if (!reg || !reg.active) return ligne("Hors ligne", "attention", "Le service d'ouverture hors ligne n'est pas actif : recharge la page une fois en ligne.");
            const n = await env.fichiersHorsLigne();
            if (n === null) return ligne("Hors ligne", "attention", "Ce navigateur ne permet pas de vérifier la copie locale.");
            return n >= SEUIL_FICHIERS_HORS_LIGNE
                ? ligne("Hors ligne", "ok", "Application complète disponible sans réseau (" + n + " fichiers).")
                : ligne("Hors ligne", "attention", "Copie locale incomplète (" + n + " fichiers) : reste connecté quelques secondes, puis recharge.");
        } catch (e) {
            Erreurs.consigner("AutoDiagnostic : contrôle du hors ligne impossible", e);
            return ligne("Hors ligne", "attention", "Contrôle impossible sur ce navigateur.");
        }
    }

    async function controleStockage(env) {
        let ecritureOk = false;
        try { ecritureOk = env.testerStockage(); } catch (e) { Erreurs.consigner("AutoDiagnostic : écriture de test refusée", e); }
        if (!ecritureOk) return ligne("Stockage", "erreur", "Le navigateur refuse d'enregistrer sur cet appareil : tes saisies seraient PERDUES. Exporte une sauvegarde (Réglages) et libère de l'espace.");
        try {
            const est = await env.estimerStockage();
            if (est && est.quota) {
                const part = est.usage / est.quota;
                return ligne("Stockage", part > SEUIL_STOCKAGE ? "attention" : "ok", "Écriture possible. " + octets(est.usage) + " utilisés sur " + octets(est.quota) + (part > SEUIL_STOCKAGE ? " : presque plein, exporte une sauvegarde." : "."));
            }
        } catch (e) { Erreurs.consigner("AutoDiagnostic : estimation du stockage impossible", e); }
        return ligne("Stockage", "ok", "Écriture possible sur cet appareil.");
    }

    function controleConnexion(env) {
        return env.enLigne() ? ligne("Réseau", "ok", "Connecté.") : ligne("Réseau", "attention", "Hors ligne : l'application fonctionne, la synchronisation reprendra au retour du réseau.");
    }

    function controleSynchronisation(env) {
        const e = env.synchro(), attente = env.enAttenteEnvoi();
        if (!e) return ligne("Synchronisation", "attention", "Module de synchronisation indisponible.");
        const reste = attente ? " " + attente + " élément" + (attente > 1 ? "s" : "") + " en attente d'envoi." : "";
        if (e.statut === "ok") return ligne("Synchronisation", attente && env.enLigne() ? "attention" : "ok", "À jour" + (e.derniere ? " (dernière à " + new Date(e.derniere).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + ")" : "") + "." + reste);
        if (e.statut === "deconnecte") return ligne("Synchronisation", "attention", "Non connecté : tes données restent sur cet appareil mais ne sont pas copiées ailleurs. Connecte-toi (Réglages › Synchronisation)." + reste);
        if (e.statut === "hors-ligne") return ligne("Synchronisation", "attention", "En attente du réseau." + reste);
        if (e.statut === "erreur") return ligne("Synchronisation", "erreur", (e.erreur || "Erreur de synchronisation.") + reste);
        return ligne("Synchronisation", "ok", "En cours…" + reste);
    }

    function controleNotifications(env) {
        const p = env.permissionNotifications();
        if (p === "granted") return ligne("Notifications", "ok", "Autorisées sur cet appareil.");
        if (p === "denied") return ligne("Notifications", "attention", "Refusées dans les réglages du navigateur : tu ne recevras ni résumé du matin ni alerte de mise à jour.");
        if (p === "indisponible") return ligne("Notifications", "attention", "Indisponibles ici (sur iPhone : installe d'abord l'application sur l'écran d'accueil).");
        return ligne("Notifications", "attention", "Pas encore activées (Réglages › Notifications).");
    }

    function controleErreurs(env) {
        const n = env.erreursEnregistrees();
        return n ? ligne("Erreurs", "attention", n + " problème" + (n > 1 ? "s" : "") + " enregistré" + (n > 1 ? "s" : "") + " : copie le rapport ci-dessus pour me le transmettre.") : ligne("Erreurs", "ok", "Aucun problème enregistré.");
    }

    async function verifier(surcharges) {
        const env = Object.assign(environnement(), surcharges || {});
        const [version, horsLigne, stockage] = await Promise.all([controleVersion(env), controleHorsLigne(env), controleStockage(env)]);
        return [version, controleInstallation(env), horsLigne, stockage, controleConnexion(env), controleSynchronisation(env), controleNotifications(env), controleErreurs(env)];
    }

    /* Texte à copier-coller. */
    function texte(resultats) {
        return resultats.map(r => ICONES[r.etat] + " " + r.nom + " : " + r.detail).join("\n");
    }

    /* Verdict d'ensemble : la pire des lignes. */
    function verdict(resultats) {
        return resultats.some(r => r.etat === "erreur") ? "erreur" : resultats.some(r => r.etat === "attention") ? "attention" : "ok";
    }

    return { verifier, texte, verdict, ICONES };
})();
