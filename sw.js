/* =============================================================
   sw.js — Service worker (application installable, ouverture hors ligne)

   Stratégie « réseau d'abord » : en ligne, on sert toujours la dernière
   version (aucun risque de rester bloqué sur une ancienne version après
   une mise à jour) et on en garde une copie ; hors ligne, on sert la
   copie. Les appels à Supabase (autre domaine) ne sont jamais touchés.
   Changer VERSION purge les anciennes copies.
   ============================================================= */

const VERSION = "acsc-v1";

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
