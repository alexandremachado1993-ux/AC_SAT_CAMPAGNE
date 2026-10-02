/* =============================================================
   sw.js — Service worker (application installable, ouverture hors ligne)

   Stratégie « réseau d'abord » : en ligne, on sert toujours la dernière
   version (aucun risque de rester bloqué sur une ancienne version après
   une mise à jour) et on en garde une copie ; hors ligne, on sert la
   copie. Les appels à Supabase (autre domaine) ne sont jamais touchés.
   Changer VERSION purge les anciennes copies.

   Notifications push : affichées à réception (résumé du matin, rappel
   1 h avant un rendez-vous), un clic ouvre ou ramène l'application.
   ============================================================= */

const VERSION = "acsc-v5";

self.addEventListener("install", () => self.skipWaiting());

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

    event.respondWith(
        fetch(requete)
            .then(reponse => {
                if (reponse.ok) {
                    const copie = reponse.clone();
                    caches.open(VERSION).then(cache => cache.put(requete, copie));
                }
                return reponse;
            })
            .catch(() => caches.match(requete, { ignoreSearch: true })
                .then(r => r || caches.match("Index.html")))
    );
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
