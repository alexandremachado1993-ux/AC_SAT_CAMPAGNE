/* =============================================================
   Notifications.js — Notifications push de CET appareil (abonnement, permission)

   Ce module ne s'occupe que du NAVIGATEUR : la clé publique VAPID, la permission, l'abonnement push de l'appareil, son nom.
   Tout ce qui parle au SERVEUR passe par Synchro (estConnecte, enregistrerAbonnement, supprimerAbonnement, testerNotification) :
   la dépendance va dans un seul sens, Notifications → Synchro. Il était dans Synchro.js ; la synchronisation ne transporte que des
   INFORMATIONS, les notifications sont un canal à part (voir le skill ac-sat-campagne, règle R6).
   Ce que le serveur envoie (résumé du matin, rappel 1 h avant, annonce de mise à jour) : supabase/functions/rappels.
   ============================================================= */

const Notifications = (() => {
    "use strict";

    /* Clé publique VAPID du projet (la clé privée reste sur le serveur).
       Un abonnement par appareil ; le serveur (fonction « rappels ») envoie
       le résumé du matin et le rappel 1 h avant chaque rendez-vous. */
    const CLE_VAPID = "BKvxrDcmbxe7O3kARZGcu2_XcsOCLpIKjz-DHo7iOaVs1qmGOJMufxC3-UNZXCyt-Q-5Dx2A_-DduUVzLJGfvwY";

    function cleVapid() {
        const b64 = (CLE_VAPID + "=".repeat((4 - CLE_VAPID.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/");
        const brut = atob(b64);
        return Uint8Array.from(brut, c => c.charCodeAt(0));
    }

    function estIphone() { return /iPhone|iPad|iPod/i.test(navigator.userAgent || ""); }
    function estInstallee() {
        return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    }

    function nomAppareil() {
        const ua = navigator.userAgent || "";
        const systeme = /Android/i.test(ua) ? "Android" : estIphone() ? "iPhone" : /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "Mac" : "Autre";
        const navigateur = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
        return (systeme + " " + navigateur).trim() + (estInstallee() ? " (application)" : "");
    }

    /* { support, raison?, permission, abonne } */
    async function etat() {
        const support = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
        if (!support) return { support: false, raison: estIphone() && !estInstallee() ? "iphone-installer" : "navigateur" };
        let abonne = false;
        try {
            const reg = await navigator.serviceWorker.getRegistration();
            abonne = !!(reg && await reg.pushManager.getSubscription());
        } catch (e) { abonne = false; }
        return { support: true, permission: Notification.permission, abonne };
    }

    async function activer() {
        try {
            if (!Synchro.estConnecte()) return { ok: false, message: "Connecte-toi d'abord à la synchronisation." };
            const permission = await Notification.requestPermission();
            if (permission !== "granted") return { ok: false, message: "Autorisation refusée : les notifications restent désactivées sur cet appareil." };
            const reg = await navigator.serviceWorker.ready;
            const abonnement = (await reg.pushManager.getSubscription()) ||
                (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleVapid() }));
            const j = abonnement.toJSON();
            await Synchro.enregistrerAbonnement(j.endpoint, j.keys.p256dh, j.keys.auth, nomAppareil());
            return { ok: true };
        } catch (e) { return { ok: false, message: Synchro.messageErreur(e) }; }
    }

    async function desactiver() {
        try {
            const reg = await navigator.serviceWorker.getRegistration();
            const abonnement = reg && await reg.pushManager.getSubscription();
            if (abonnement) {
                try { await Synchro.supprimerAbonnement(abonnement.endpoint); } catch (e) { Erreurs.consigner("Notifications : hors ligne : le serveur le retirera à la première erreur d'envoi", e); }
                await abonnement.unsubscribe();
            }
            return { ok: true };
        } catch (e) { return { ok: false, message: Synchro.messageErreur(e) }; }
    }

    async function tester() {
        try {
            const r = await Synchro.testerNotification();
            return { ok: true, envoyees: (r && r.envoyees) || 0 };
        } catch (e) { return { ok: false, message: Synchro.messageErreur(e) }; }
    }


    return { etat, activer, desactiver, tester };
})();
