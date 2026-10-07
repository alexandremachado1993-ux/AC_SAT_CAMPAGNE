/* =============================================================
   sw.js — Service worker (application installable, ouverture hors ligne)

   Stratégie « réseau d'abord, avec délai » : en ligne, on sert la dernière
   version (aucun risque de rester bloqué sur une ancienne version après
   une mise à jour) et on en garde une copie ; hors ligne, ou si le réseau
   met plus de 3 s à répondre, on sert la copie. Toute l'application est
   préchargée à l'installation. Les appels à Supabase (autre domaine) ne sont jamais touchés.
   Changer VERSION purge les anciennes copies.

   Notifications push : affichées à réception (résumé du matin, rappel
   1 h avant un rendez-vous), un clic ouvre ou ramène l'application.
   ============================================================= */

const VERSION = "acsc-v6";
/* Au-delà de ce délai sans réponse du réseau, on sert la copie locale (s'il y en a une) : sur une connexion faible, l'application
   s'ouvre tout de suite au lieu de rester figée. La réponse du réseau, quand elle arrive, met la copie à jour pour la fois suivante. */
const DELAI_RESEAU_MS = 3000;
/* Après un premier rabattement sur la copie (réseau lent), les fichiers SUIVANTS de la page sont servis aussitôt depuis la copie pendant
   une minute : sinon chacun attendrait ses propres 3 s. La page reste aussi cohérente (tout vient de la même copie, pas un mélange). */
const DUREE_MODE_LENT_MS = 60000;
let modeLentJusqua = 0;
/* Jamais servis depuis le cache : un numéro de version périmé ferait croire à tort que tout est à jour (voir AppLayout, mise à jour). */
const TOUJOURS_FRAIS = /\/version\.(json|txt)$/;
/* Application complète préchargée à l'installation : toutes les pages s'ouvrent hors ligne, même celles jamais visitées.
   Un test (test42.js) vérifie que cette liste correspond aux fichiers du projet. */
const PRECACHE = [
    "Client.html",
    "Clients.html",
    "Documents.html",
    "Index.html",
    "Planning.html",
    "Reglages.html",
    "Serti.html",
    "Tournee.html",
    "manifest.webmanifest",
    "CSS/campagne.css",
    "CSS/style.css",
    "Js/Amorce.js",
    "Js/AppLayout.js",
    "Js/AutoDiagnostic.js",
    "Js/ClientFiche.js",
    "Js/Clients.js",
    "Js/Demarrage.js",
    "Js/Departements.js",
    "Js/Documents.js",
    "Js/Donnees.js",
    "Js/EchangesExcel.js",
    "Js/Erreurs.js",
    "Js/Excel.js",
    "Js/FicheSerti.js",
    "Js/Formulaires.js",
    "Js/Notifications.js",
    "Js/Nouveautes.js",
    "Js/Pieces.js",
    "Js/Planning.js",
    "Js/PlanningCalcul.js",
    "Js/PlanningTableau.js",
    "Js/Presentation.js",
    "Js/ReferentielSerti.js",
    "Js/Reglages.js",
    "Js/Serti.js",
    "Js/SertiCalcul.js",
    "Js/SertiRapport.js",
    "Js/Splash.js",
    "Js/Synchro.js",
    "Js/TableauBord.js",
    "Js/Tournee.js",
    "Vendor/fflate/fflate.min.js",
    "Vendor/supabase/supabase.min.js",
    "Images/logo.png",
    "Images/icone-192.png",
    "Images/icone-512.png",
    "Images/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(VERSION)
            .then(cache => Promise.allSettled(PRECACHE.map(u => cache.add(new Request(u, { cache: "reload" })))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then(cles => Promise.all(cles.filter(c => c !== VERSION).map(c => caches.delete(c))))
            .then(() => self.clients.claim())
    );
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
    event.respondWith(reseauPuisCopie(event, requete));
});

function reseauPuisCopie(event, requete) {
    const reseau = fetch(requete).then(reponse => {
        if (reponse.ok) {
            const copie = reponse.clone();
            caches.open(VERSION).then(cache => cache.put(requete, copie));
        }
        return reponse;
    });
    event.waitUntil(reseau.catch(() => { /* la mise à jour de la copie se termine même si l'on a déjà répondu */ }));
    const copieExacte = () => caches.match(requete, { ignoreSearch: true });
    /* Hors ligne (le réseau a échoué) : à défaut de copie exacte, une page de navigation retombe sur l'accueil. */
    const copieOuAccueil = () => copieExacte().then(r => r || (requete.mode === "navigate" ? caches.match("Index.html") : undefined));
    const debut = Date.now();
    return new Promise((resolve, reject) => {
        let repondu = false;
        const repondre = (r) => { if (!repondu && r) { repondu = true; resolve(r); } };
        const delai = debut < modeLentJusqua ? 0 : DELAI_RESEAU_MS;
        const minuteur = setTimeout(() => {
            copieExacte().then(r => { if (r && !repondu) modeLentJusqua = Date.now() + DUREE_MODE_LENT_MS; repondre(r); });
        }, delai);
        reseau.then(
            (r) => { clearTimeout(minuteur); if (!repondu && Date.now() - debut < 1500) modeLentJusqua = 0; repondre(r); },
            (e) => { clearTimeout(minuteur); copieOuAccueil().then(r => { if (r) repondre(r); else if (!repondu) { repondu = true; reject(e); } }); }
        );
    });
}

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
