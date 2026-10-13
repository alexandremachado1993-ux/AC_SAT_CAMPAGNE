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
/* Jamais servis depuis le cache : un numéro de version périmé ferait croire à tort que tout est à jour (voir AppLayout, mise à jour). */
const TOUJOURS_FRAIS = /\/version\.(json|txt)$/;

let actif = null;       // nom du cache actif, gardé en mémoire (relu depuis acsc-meta quand le service worker redémarre)

async function lireActif() {
    const meta = await caches.open(META);
    const reponse = await meta.match(CLE_ACTIF);
    actif = reponse ? await reponse.text() : null;
    return actif;
}

async function ecrireActif(nom) {
    const meta = await caches.open(META);
    await meta.put(CLE_ACTIF, new Response(nom));
    actif = nom;
}

/* Supprime les copies des anciennes versions (et l'ancien cache « acsc-v6 » de l'époque du réseau d'abord). */
async function nettoyer() {
    const noms = await caches.keys();
    await Promise.all(noms.filter(n => n.startsWith(PREFIXE) && n !== META && n !== actif).map(n => caches.delete(n)));
}

/* Première installation : copie la version publiée. Une mise à jour de CE fichier (version déjà installée) ne change PAS la version de l'application. */
async function premiereInstallation() {
    await lireActif();
    if (actif && await caches.has(actif)) return;
    const reponse = await fetch("version.json", { cache: "no-store" });
    if (!reponse.ok) throw new Error("version.json : " + reponse.status);
    const infos = await reponse.json();
    const nom = PREFIXE + infos.version;
    const cache = await caches.open(nom);
    const liste = (Array.isArray(infos.fichiers) ? infos.fichiers : []).map(f => f && f.u).filter(u => typeof u === "string" && !/^[a-z]+:|^\/\//i.test(u));
    await Promise.allSettled(liste.map(u => cache.add(new Request(u, { cache: "reload" }))));
    await ecrireActif(nom);
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

/* Copie figée d'abord. Un fichier absent de la copie va au réseau (et rejoint la copie, tant qu'elle existe). Hors ligne : une page
   inconnue retombe sur l'accueil de la copie. */
async function servir(event, requete) {
    const nom = actif || await lireActif();
    if (nom) {
        /* L'adresse racine « / » est redirigée vers Index.html par le serveur : la copie ne connaît que Index.html. */
        const cherche = new URL(requete.url).pathname === "/" ? "Index.html" : requete;
        const copie = await caches.match(cherche, { cacheName: nom, ignoreSearch: true });
        if (copie) return copie;
    }
    try {
        const reponse = await fetch(requete);
        if (reponse.ok && nom) event.waitUntil(caches.has(nom).then(existe => (existe ? caches.open(nom).then(c => c.put(requete, reponse.clone())) : null)));
        return reponse;
    } catch (e) {
        if (requete.mode === "navigate" && nom) {
            const accueil = await caches.match("Index.html", { cacheName: nom });
            if (accueil) return accueil;
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
        if (!(await caches.has(m.nom))) { reponse(false); return; }
        await ecrireActif(m.nom);
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
