/* Service worker à copie FIGÉE (sw.js) : simulé dans Node (caches, réseau et événements simulés). Un vrai navigateur reste nécessaire pour la validation finale
   (voir README, protocole de test sur téléphone) : ce simulateur prouve la LOGIQUE (installation, version figée, activation sur ordre, hors ligne, échecs). */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const BASE = "https://site.test/";
const CODE = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
const urlDe = (r) => (typeof r === "string" ? new URL(r, BASE).href : r.url);
const sansRecherche = (u) => u.split("?")[0].split("#")[0];

class RequeteTest {
  constructor(u, init) { this.url = urlDe(u); this.method = (init && init.method) || "GET"; this.mode = (init && init.mode) || "no-cors"; this.cache = (init && init.cache) || "default"; this.entetes = (init && init.entetes) || {}; this.headers = { has: (k) => k.toLowerCase() in this.entetes }; }
}
class ReponseTest {
  constructor(corps, init) { this.corps = String(corps); this.status = (init && init.status) || 200; this.ok = this.status >= 200 && this.status < 300; }
  text() { return Promise.resolve(this.corps); }
  json() { return Promise.resolve(JSON.parse(this.corps)); }
  clone() { return new ReponseTest(this.corps, { status: this.status }); }
}

/* Un « navigateur » : le stockage des caches survit aux redémarrages du service worker (comme en vrai). */
function nouveauNavigateur(serveur) {
  const stock = new Map();
  const reseau = { appels: [], enLigne: true, pannes: new Set() };
  const chemin = (u) => new URL(u).pathname.slice(1);
  async function fetchTest(req) {
    const u = urlDe(req); reseau.appels.push(chemin(u));
    if (!reseau.enLigne) throw new Error("hors ligne");
    const c = chemin(u);
    if (reseau.pannes.has(c)) return new ReponseTest("erreur", { status: 500 });
    if (c === "version.json") return new ReponseTest(JSON.stringify({ version: serveur.version, fichiers: Object.keys(serveur.fichiers).map(f => ({ u: f, t: serveur.fichiers[f].length })) }));
    if (c in serveur.fichiers) return new ReponseTest(serveur.fichiers[c]);
    return new ReponseTest("introuvable", { status: 404 });
  }
  function cacheTest(nom) {
    if (!stock.has(nom)) stock.set(nom, new Map());
    const m = stock.get(nom);
    return {
      async put(req, rep) { m.set(sansRecherche(urlDe(req)), rep.clone()); },
      async add(req) { const r = await fetchTest(req); if (!r.ok) throw new Error("add " + r.status); m.set(sansRecherche(urlDe(req)), r.clone()); },
      async match(req) { const r = m.get(sansRecherche(urlDe(req))); return r ? r.clone() : undefined; },
      async keys() { return Array.from(m.keys()); }
    };
  }
  const caches = {
    async open(nom) { return cacheTest(nom); },
    async has(nom) { return stock.has(nom); },
    async keys() { return Array.from(stock.keys()); },
    async delete(nom) { return stock.delete(nom); },
    async match(req, opts) {
      const cherche = (m) => { const r = m && m.get(sansRecherche(urlDe(req))); return r ? r.clone() : undefined; };
      if (opts && opts.cacheName) return cherche(stock.get(opts.cacheName));
      for (const m of stock.values()) { const r = cherche(m); if (r) return r; }      // sans nom de copie : toutes les copies, comme le vrai CacheStorage
      return undefined;
    }
  };
  /* Démarre un service worker (nouvelle exécution du script) sur ce navigateur. */
  function demarrerSW() {
    const gestionnaires = {}; const traces = { skipWaiting: 0, claim: 0, notifications: [] };
    const self_ = {
      location: { origin: "https://site.test" }, skipWaiting: () => { traces.skipWaiting++; return Promise.resolve(); },
      clients: { claim: () => { traces.claim++; return Promise.resolve(); }, matchAll: () => Promise.resolve([]), openWindow: () => Promise.resolve() },
      registration: { scope: BASE, showNotification: (t, o) => { traces.notifications.push({ t, o }); return Promise.resolve(); } },
      addEventListener: (type, fn) => { gestionnaires[type] = fn; }
    };
    vm.runInNewContext(CODE, { self: self_, caches, fetch: fetchTest, Request: RequeteTest, Response: ReponseTest, URL, Promise });
    const evenement = async (type, extra) => {
      const attentes = []; let reponduPar = null;
      const ev = Object.assign({ waitUntil: (p) => attentes.push(p), respondWith: (p) => { reponduPar = p; } }, extra);
      gestionnaires[type](ev);
      await Promise.all(attentes);
      return { repondu: reponduPar !== null, reponse: reponduPar ? await reponduPar.catch(e => ({ erreur: e.message })) : null };
    };
    return {
      traces, gestionnaires,
      installer: () => evenement("install"), activer: () => evenement("activate"),
      chercher: (u, init) => evenement("fetch", { request: new RequeteTest(u, init) }),
      message: async (donnees) => { const acks = []; await evenement("message", { data: donnees, ports: [{ postMessage: (m) => acks.push(m) }] }); return acks; }
    };
  }
  return { stock, reseau, caches, demarrerSW, fetchTest, cacheTest };
}

const V1 = { "Index.html": "accueil v1", "Js/App.js": "code v1", "Planning.html": "planning v1", "Images/logo.png": "logo" };
const V2 = { "Index.html": "accueil v2", "Js/App.js": "code v2", "Planning.html": "planning v2", "Images/logo.png": "logo" };

module.exports = async function ({ t }) {
  const texte = async (r) => (r && r.reponse && r.reponse.corps) || (r && r.reponse && r.reponse.erreur) || null;

  // ---------- Première installation
  let nav = nouveauNavigateur({ version: "2026.10.12-a", fichiers: V1 }); let sw = nav.demarrerSW();
  await sw.installer();
  t("service worker : la première installation copie la version publiée (une copie complète, nommée « acsc-<version> »)", (await nav.caches.keys()).indexOf("acsc-2026.10.12-a") !== -1 && (await nav.cacheTest("acsc-2026.10.12-a").keys()).length === 4);
  t("service worker : la version active est mémorisée à part (« acsc-meta »), et l'installation s'active aussitôt (skipWaiting)", (await (await nav.cacheTest("acsc-meta").match("actif")).text()) === "acsc-2026.10.12-a" && sw.traces.skipWaiting === 1);
  await sw.activer();
  t("service worker : l'activation prend le contrôle des pages ouvertes (clients.claim)", sw.traces.claim === 1);

  // ---------- Version FIGÉE : le serveur change, l'application non
  nav.reseau.appels.length = 0;
  t("version figée : une page est servie depuis la copie, SANS aller au réseau", (await texte(await sw.chercher("Index.html"))) === "accueil v1" && nav.reseau.appels.length === 0);
  t("version figée : une adresse avec paramètres (« Planning.html?mode=mois ») retrouve sa page", (await texte(await sw.chercher("Planning.html?mode=mois"))) === "planning v1");
  nav = Object.assign(nav, {}); // le serveur publie la version 2 : on remplace son contenu
  const serveurV2 = { version: "2026.10.12-b", fichiers: V2 };
  const navV2 = nouveauNavigateur(serveurV2); navV2.stock.set("acsc-2026.10.12-a", nav.stock.get("acsc-2026.10.12-a")); navV2.stock.set("acsc-meta", nav.stock.get("acsc-meta"));
  const swV2 = navV2.demarrerSW();
  t("version figée : le serveur publie la version suivante, l'appareil RESTE sur celle qu'il a installée (rien ne s'installe tout seul)", (await texte(await swV2.chercher("Index.html"))) === "accueil v1" && (await texte(await swV2.chercher("Js/App.js"))) === "code v1");
  t("version figée : au redémarrage du service worker, la version active est relue depuis « acsc-meta »", navV2.reseau.appels.length === 0);

  // ---------- L'adresse racine « / » (redirigée vers Index.html par le serveur) doit aussi venir de la copie figée
  const racineNav = await swV2.chercher("/", { mode: "navigate" });
  t("adresse racine « / » : elle est servie par la copie figée (Index.html de la version installée), PAS par le réseau — sinon une page neuve chargerait des scripts anciens", (await texte(racineNav)) === "accueil v1" && navV2.reseau.appels.indexOf("") === -1);

  // ---------- Ce qui n'est pas servi depuis la copie
  const frais = await swV2.chercher("version.json"); const frais2 = await swV2.chercher("version.txt");
  t("version.json et version.txt ne sont JAMAIS servis par le service worker (toujours le réseau, sinon la version paraîtrait toujours à jour)", !frais.repondu && !frais2.repondu);
  t("service worker : les requêtes POST, les autres domaines, les vidéos et les requêtes partielles (Range) sont laissés au navigateur", !(await swV2.chercher("Index.html", { method: "POST" })).repondu && !(await swV2.chercher("https://autre.test/x.js")).repondu && !(await swV2.chercher("Media/film.mp4")).repondu && !(await swV2.chercher("Media/a.png", { entetes: { range: "bytes=0-9" } })).repondu);

  // ---------- Le téléchargement d'une nouvelle version doit atteindre le RÉSEAU, pas la copie figée
  const dl = await swV2.chercher("Index.html", { cache: "reload" });
  t("téléchargement d'une mise à jour : une requête « cache: reload » n'est PAS servie par la copie figée (sinon l'application recevrait l'ancienne version en croyant télécharger la nouvelle)", !dl.repondu);
  t("… idem pour « no-store » ; une requête ordinaire, elle, reste servie par la copie", !(await swV2.chercher("Index.html", { cache: "no-store" })).repondu && (await swV2.chercher("Index.html")).repondu);

  // ---------- Fichier absent de la copie : réseau, puis il rejoint la copie
  navV2.reseau.appels.length = 0; serveurV2.fichiers["Images/nouveau.png"] = "image";
  t("un fichier absent de la copie va au réseau", (await texte(await swV2.chercher("Images/nouveau.png"))) === "image" && navV2.reseau.appels.length === 1);
  t("… et rejoint la copie active (la fois suivante, plus de réseau)", (await texte(await swV2.chercher("Images/nouveau.png"))) === "image" && navV2.reseau.appels.length === 1);

  // ---------- Hors ligne
  navV2.reseau.enLigne = false;
  t("hors ligne : l'application s'ouvre entièrement depuis la copie", (await texte(await swV2.chercher("Index.html"))) === "accueil v1" && (await texte(await swV2.chercher("Planning.html"))) === "planning v1");
  const inconnue = await swV2.chercher("PageInconnue.html", { mode: "navigate" });
  t("hors ligne : une PAGE inconnue retombe sur l'accueil de la copie", (await texte(inconnue)) === "accueil v1");
  const ressource = await swV2.chercher("Js/inconnu.js");
  t("hors ligne : une ressource inconnue échoue proprement (pas de faux contenu)", (await texte(ressource)) === "hors ligne");
  navV2.reseau.enLigne = true;

  // ---------- Mise à jour VALIDÉE : l'application télécharge la version 2 dans un autre cache, puis demande l'activation
  const cV2 = await navV2.caches.open("acsc-2026.10.12-b");
  for (const f of Object.keys(V2)) await cV2.put(f, await navV2.fetchTest(f));
  t("avant validation : la version 2 est téléchargée mais l'application sert TOUJOURS la version 1", (await texte(await swV2.chercher("Index.html"))) === "accueil v1");
  const refus = [await swV2.message({ type: "ACTIVER", nom: "acsc-meta" }), await swV2.message({ type: "ACTIVER", nom: "autre-chose" }), await swV2.message({ type: "ACTIVER", nom: "acsc-2026.99.99-z" }), await swV2.message({ type: "ACTIVER" }), await swV2.message({ type: "AUTRE", nom: "acsc-2026.10.12-b" })];
  t("activation refusée pour un cache inexistant, pour le cache de méta, un nom étranger, ou un message mal formé", refus.slice(0, 4).every(a => a.length === 1 && a[0].ok === false) && refus[4].length === 0 && (await texte(await swV2.chercher("Index.html"))) === "accueil v1");
  const incomplet = await swV2.message({ type: "ACTIVER", nom: "acsc-2026.10.12-b", n: 99 });
  t("activation REFUSÉE si la copie contient moins de fichiers que prévu : le service worker vérifie lui-même, il ne se contente pas de la parole de la page", incomplet.length === 1 && incomplet[0].ok === false && (await texte(await swV2.chercher("Index.html"))) === "accueil v1");
  const ack = await swV2.message({ type: "ACTIVER", nom: "acsc-2026.10.12-b", n: 4 });
  t("validation : l'activation de la version 2 est acquittée, et la page suivante vient de la version 2", ack.length === 1 && ack[0].ok === true && (await texte(await swV2.chercher("Index.html"))) === "accueil v2" && (await texte(await swV2.chercher("Js/App.js"))) === "code v2");
  t("validation : l'ancienne copie est supprimée, la copie de méta reste", (await navV2.caches.keys()).sort().join() === "acsc-2026.10.12-b,acsc-meta");
  const swRedemarre = navV2.demarrerSW();
  t("redémarrage du service worker après la mise à jour : il reste sur la version 2 (mémorisée, pas en mémoire seulement)", (await texte(await swRedemarre.chercher("Index.html"))) === "accueil v2");

  // ---------- Mise à jour du SCRIPT sw.js lui-même (nouvelle exécution) : la version de l'application ne bouge pas
  navV2.reseau.appels.length = 0; const swNeuf = navV2.demarrerSW(); await swNeuf.installer(); await swNeuf.activer();
  t("mise à jour du script du service worker : l'application garde sa version installée et ne retélécharge rien", (await texte(await swNeuf.chercher("Index.html"))) === "accueil v2" && navV2.reseau.appels.length === 0 && (await navV2.caches.keys()).length === 2);

  // ---------- Passage depuis l'ancien service worker (cache « acsc-v6 », pas de méta)
  const ancien = nouveauNavigateur({ version: "2026.10.12-b", fichiers: V2 }); (await ancien.caches.open("acsc-v6")).put("Index.html", new ReponseTest("vieux"));
  const swPassage = ancien.demarrerSW(); await swPassage.installer(); await swPassage.activer();
  t("passage depuis l'ancien service worker : la version publiée est copiée, l'ancien cache « acsc-v6 » est supprimé", (await ancien.caches.keys()).sort().join() === "acsc-2026.10.12-b,acsc-meta" && (await texte(await swPassage.chercher("Index.html"))) === "accueil v2");

  // ---------- Pannes
  const horsLigne = nouveauNavigateur({ version: "2026.10.12-a", fichiers: V1 }); horsLigne.reseau.enLigne = false;
  let echec = null; try { await horsLigne.demarrerSW().installer(); } catch (e) { echec = e.message; }
  t("première installation hors ligne : elle échoue proprement (le navigateur réessaiera), sans copie à moitié faite", echec === "hors ligne" && (await horsLigne.caches.keys()).filter(n => n !== "acsc-meta").length === 0 && (await horsLigne.cacheTest("acsc-meta").keys()).length === 0);
  const partiel = nouveauNavigateur({ version: "2026.10.12-a", fichiers: V1 }); partiel.reseau.pannes.add("Js/App.js");
  let incompletMsg = null; try { await partiel.demarrerSW().installer(); } catch (e) { incompletMsg = e.message; }
  t("première installation : UN SEUL fichier en panne fait échouer l'installation (tout ou rien) — jamais de copie « active » à moitié faite ; le navigateur réessaiera", /incomplète/.test(incompletMsg || "") && (await partiel.caches.keys()).filter(n => n !== "acsc-meta").length === 0 && (await partiel.cacheTest("acsc-meta").keys()).length === 0);

  // ---------- Défaut constaté le 13/10/2026 : copie VIDE + site injoignable = « ERR_FAILED » (application morte)
  const secours = nouveauNavigateur({ version: "2026.10.12-a", fichiers: V1 }); const swS = secours.demarrerSW(); await swS.installer(); await swS.activer();
  secours.stock.get("acsc-2026.10.12-a").clear(); secours.reseau.enLigne = false;
  const rien = await swS.chercher("/", { mode: "navigate" });
  t("copie VIDE + site injoignable : une page de secours CLAIRE (503, « Impossible de joindre le serveur », données conservées) au lieu de l'erreur du navigateur", !!rien.reponse && rien.reponse.status === 503 && /Impossible de joindre le serveur/.test(rien.reponse.corps) && /conservées/.test(rien.reponse.corps));
  t("… une ressource (script, image) sans copie échoue proprement, sans fausse réponse", (await texte(await swS.chercher("Js/App.js"))) === "hors ligne");
  const dernier = nouveauNavigateur({ version: "2026.10.12-b", fichiers: V2 });
  await (await dernier.caches.open("acsc-v6")).put("Index.html", new ReponseTest("vieille copie"));
  await (await dernier.caches.open("acsc-2026.10.12-b")).put("Js/App.js", new ReponseTest("code v2"));
  const metaD = await dernier.caches.open("acsc-meta"); await metaD.put("actif", new ReponseTest("acsc-2026.10.12-b")); await metaD.put("attendu", new ReponseTest("4"));
  const swD = dernier.demarrerSW(); await swD.activer();
  t("copie active INCOMPLÈTE (1 fichier sur 4) : l'ancienne copie qui fonctionne n'est PAS supprimée à l'activation", (await dernier.caches.keys()).indexOf("acsc-v6") !== -1);
  dernier.reseau.enLigne = false;
  t("… et site injoignable, l'accueil est servi par l'ancienne copie (dernier recours) plutôt qu'une erreur", (await texte(await swD.chercher("/", { mode: "navigate" }))) === "vieille copie");
  const cN = await dernier.caches.open("acsc-2026.10.12-b"); for (const f of Object.keys(V2)) await cN.put(f, new ReponseTest(V2[f]));
  await dernier.demarrerSW().activer();
  t("copie active COMPLÈTE : l'ancienne copie est alors supprimée (la méta est conservée)", (await dernier.caches.keys()).sort().join() === "acsc-2026.10.12-b,acsc-meta");
  const repar = nouveauNavigateur({ version: "2026.10.12-b", fichiers: V2 }); const metaR = await repar.caches.open("acsc-meta");
  await metaR.put("actif", new ReponseTest("acsc-2026.10.12-a")); await metaR.put("attendu", new ReponseTest("4")); await repar.caches.open("acsc-2026.10.12-a");
  await repar.demarrerSW().installer();
  t("un nouveau service worker qui trouve une copie active VIDE la REFAIT depuis la version publiée (les appareils déjà touchés se réparent)", (await repar.cacheTest("acsc-2026.10.12-b").keys()).length === Object.keys(V2).length && (await (await repar.cacheTest("acsc-meta").match("actif")).text()) === "acsc-2026.10.12-b");
  const echecPassage = nouveauNavigateur({ version: "2026.10.12-b", fichiers: V2 }); await (await echecPassage.caches.open("acsc-v6")).put("Index.html", new ReponseTest("vieux")); echecPassage.reseau.pannes.add("Js/App.js");
  let passageMsg = null; try { await echecPassage.demarrerSW().installer(); } catch (e) { passageMsg = e.message; }
  t("passage depuis l'ancien service worker avec un fichier en panne : l'installation échoue et l'ancienne copie « acsc-v6 » reste EN SERVICE (rien n'est supprimé)", /incomplète/.test(passageMsg || "") && (await echecPassage.caches.keys()).indexOf("acsc-v6") !== -1);

  // ---------- Notifications conservées, aucune liste de fichiers dans le script
  const swNotif = nav.demarrerSW();
  t("sw.js : les notifications push et leur clic sont toujours gérés", typeof swNotif.gestionnaires.push === "function" && typeof swNotif.gestionnaires.notificationclick === "function");
  t("sw.js : plus AUCUNE liste de fichiers dans le script (il ne change plus à chaque version)", !/PRECACHE/.test(CODE) && !/"Js\/[A-Za-z]+\.js"/.test(CODE) && !/\.html"/.test(CODE.replace(/"Index\.html"/g, "")));
};
