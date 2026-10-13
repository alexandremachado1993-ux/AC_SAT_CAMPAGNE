/* Installation.js : télécharger une mise à jour (barre réelle, tout-ou-rien), l'activer, la mettre en scène, l'écran obligatoire, la réparation. */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t }) {
  const w = page("Index.html"); const d = w.document; const I = w.Installation;
  const fauxCaches = (initial) => {
    const stock = new Map(Object.entries(initial || {}).map(([n, f]) => [n, new Map(f.map(u => [u, 1]))]));
    return { stock, async open(n) { if (!stock.has(n)) stock.set(n, new Map()); const m = stock.get(n); return { async put(u) { if (!(this.perdre && this.perdre === u)) m.set(u, 1); }, async keys() { return Array.from(m.keys()); }, perdre: null }; }, async delete(n) { return stock.delete(n); }, async keys() { return Array.from(stock.keys()); } };
  };
  const reponse = (statut) => ({ ok: (statut || 200) < 300, status: statut || 200, arrayBuffer: async () => new ArrayBuffer(0) });
  const fichiers = [{ u: "Index.html", t: 100 }, { u: "Js/App.js", t: 300 }, { u: "CSS/s.css", t: 600 }];
  const infos = { version: "2026.10.20-a", date: "2026-10-20", nouveaute: { id: "n", titre: "Une nouveauté", resume: "Un résumé" }, fichiers, obligatoire: false };

  // ---------- La liste de fichiers publiée par le serveur est validée (c'est une entrée venue du réseau)
  t("liste de fichiers : valide acceptée, tailles normalisées en entiers positifs", JSON.stringify(I.listeValide([{ u: "Js/A.js", t: 12.4 }, { u: "Images/logo.png", t: -5 }, { u: "Modeles/Modele x.xlsx" }])) === JSON.stringify([{ u: "Js/A.js", t: 12 }, { u: "Images/logo.png", t: 0 }, { u: "Modeles/Modele x.xlsx", t: 0 }]));
  t("liste de fichiers : refus d'un chemin qui remonte (« .. »), absolu (« / »), d'une adresse (« http: »), vide, non texte", [[{ u: "../secret" }], [{ u: "/etc/passwd" }], [{ u: "https://autre.test/x.js" }], [{ u: "" }], [{ u: 3 }], [null], []].every(x => I.listeValide(x) === null));
  t("liste de fichiers : refus d'une liste absente, qui n'en est pas une, ou de plus de 300 fichiers", I.listeValide(undefined) === null && I.listeValide("x") === null && I.listeValide(Array.from({ length: 301 }, (_, i) => ({ u: "f" + i }))) === null);

  // ---------- Télécharger : barre réelle (octets), tout ou rien
  let c = fauxCaches({ "acsc-ancienne": ["Index.html"], "acsc-meta": [] }); const demandes = []; const progres = [];
  const nom = await I.telecharger(infos, (p, f) => progres.push([p, f]), { caches: c, fetch: async (u, init) => { demandes.push([u, init && init.cache]); return reponse(200); } });
  t("téléchargement : tous les fichiers sont copiés dans « acsc-<version> », qui est renvoyé", nom === "acsc-2026.10.20-a" && Array.from(c.stock.get(nom).keys()).sort().join() === "CSS/s.css,Index.html,Js/App.js");
  t("téléchargement : chaque fichier est demandé avec « cache: reload » (le service worker le laisse passer au réseau)", demandes.length === 3 && demandes.every(x => x[1] === "reload"));
  t("téléchargement : la progression est pondérée par la TAILLE (pas par le nombre de fichiers), ne recule jamais et s'arrête à 99 % (le 100 % vient après l'activation)", progres.length === 3 && progres.every((x, i) => i === 0 || x[0] >= progres[i - 1][0]) && progres.map(x => x[0]).join() === "10,40,99");
  t("téléchargement : l'ancienne copie et la méta ne sont PAS touchées pendant le téléchargement", c.stock.has("acsc-ancienne") && c.stock.has("acsc-meta"));

  // ---------- Échecs : rien ne change, la copie en cours disparaît
  const echec = async (outils) => { let e = null; try { await I.telecharger(infos, null, outils); } catch (x) { e = x; } return e; };
  c = fauxCaches({ "acsc-ancienne": ["Index.html"] });
  let e = await echec({ caches: c, fetch: async (u) => reponse(u === "Js/App.js" ? 500 : 200) });
  t("échec : un fichier en erreur 500 annule TOUT, la copie à moitié faite est supprimée, l'ancienne reste", !!e && /Js\/App\.js/.test(e.message) && !c.stock.has("acsc-2026.10.20-a") && c.stock.has("acsc-ancienne"));
  c = fauxCaches();
  e = await echec({ caches: c, fetch: async () => { throw new Error("réseau coupé"); } });
  t("échec : réseau coupé → erreur, aucune copie laissée", !!e && /réseau coupé/.test(e.message) && !c.stock.has("acsc-2026.10.20-a"));
  c = fauxCaches(); const ouvrir = c.open.bind(c);
  c.open = async (n) => { const cache = await ouvrir(n); cache.perdre = "Js/App.js"; return cache; };
  e = await echec({ caches: c, fetch: async () => reponse(200) });
  t("échec : une copie incomplète (un fichier non enregistré) est détectée à la vérification et supprimée", !!e && /incomplète/.test(e.message) && !c.stock.has("acsc-2026.10.20-a"));
  c = fauxCaches(); const controle = { annule: false };
  e = await echec({ caches: c, controle, fetch: async (u) => { if (u === "Index.html") controle.annule = true; return reponse(200); } });
  t("délai dépassé : le téléchargement est abandonné avec un message clair, la copie est supprimée", !!e && e.claire === true && /trop de temps/.test(e.message) && !c.stock.has("acsc-2026.10.20-a"));
  let sansListe = null; try { await I.telecharger({ version: "2026.10.20-a", fichiers: [{ u: "../x" }] }, null, { caches: fauxCaches(), fetch: async () => reponse(200) }); } catch (x) { sansListe = x; }
  t("une version dont la liste est invalide n'est PAS téléchargée", !!sansListe && /invalide/.test(sansListe.message));

  // ---------- Une réponse REDIRIGÉE (serveur qui répond 301 puis sert la page) ne doit pas être enregistrée telle quelle : « ERR_FAILED » à la navigation suivante
  class FauxResponse { constructor(corps, init) { this.corps = corps; this.status = init.status; this.redirected = false; } }
  const enregistrees = []; const cRed = { async delete() { return true; }, async open() { return { async put(u, r) { enregistrees.push(r); }, async keys() { return fichiers.map(f => f.u); } }; } };
  await I.telecharger(infos, null, { caches: cRed, Response: FauxResponse, fetch: async () => ({ ok: true, status: 200, statusText: "OK", headers: {}, redirected: true, blob: async () => "corps", arrayBuffer: async () => new ArrayBuffer(0) }) });
  t("téléchargement d'une mise à jour : une réponse redirigée par le serveur est enregistrée SANS la marque de redirection", enregistrees.length === 3 && enregistrees.every(r => r instanceof FauxResponse && r.redirected === false));

  // ---------- Sans service worker qui contrôle la page : on recharge les fichiers (barre réelle), sans copie
  c = fauxCaches(); let lus = 0;
  await I.telecharger(infos, null, { caches: c, sansCopie: true, fetch: async () => { lus++; return reponse(200); } });
  t("sans service worker : les fichiers sont lus (cache du navigateur rafraîchi) et AUCUNE copie n'est créée", lus === 3 && c.stock.size === 0);
  t("version figée : n'existe que si un service worker contrôle la page ET que les copies sont disponibles", !I.supporteVersionFigee({ navigator: { serviceWorker: { controller: null } }, caches: {} }) && !I.supporteVersionFigee({ navigator: { serviceWorker: { controller: {} } }, caches: null }) && I.supporteVersionFigee({ navigator: { serviceWorker: { controller: {} } }, caches: {} }));

  // ---------- Activer : le service worker répond sur un canal dédié
  class CanalTest { constructor() { this.port1 = {}; this.port2 = { autre: this.port1 }; } }
  const navAvec = (ok, delai) => ({ serviceWorker: { controller: { postMessage: (msg, ports) => { navAvec.dernier = msg; if (ok !== null) setTimeout(() => ports[0].autre.onmessage({ data: { ok } }), delai || 0); } } } });
  await I.activer("acsc-2026.10.20-a", { navigator: navAvec(true), MessageChannel: CanalTest });
  t("activation : le service worker reçoit { type: « ACTIVER », nom } et l'acquitte", navAvec.dernier.type === "ACTIVER" && navAvec.dernier.nom === "acsc-2026.10.20-a");
  const refuse = async (opts) => { let x = null; try { await I.activer("acsc-x", Object.assign({ MessageChannel: CanalTest }, opts)); } catch (err) { x = err; } return x && x.message; };
  t("activation : refus du service worker, absence de réponse (délai) et absence de service worker sont des ÉCHECS (pas un faux succès)", /refusée/.test(await refuse({ navigator: navAvec(false) })) && /sans réponse/.test(await refuse({ navigator: navAvec(null), delaiActivation: 30 })) && /aucun service worker/.test(await refuse({ navigator: { serviceWorker: { controller: null } } })));

  // ---------- La scène complète
  const nettoyer = () => { d.querySelectorAll(".maj-scene").forEach(x => x.remove()); d.documentElement.classList.remove("maj-en-cours"); };
  const outilsOk = (extra) => Object.assign({ caches: fauxCaches(), fetch: async () => reponse(200), navigator: navAvec(true), MessageChannel: CanalTest }, extra);
  let recharges = 0; const sansPause = async () => {};
  let outils = outilsOk(); const finis = I.demarrer(infos, { outils, pause: sansPause, recharger: () => { recharges++; } });
  await sleep(5);
  const scene = d.querySelector(".maj-scene");
  t("mise en scène : une fenêtre plein écran apparaît (dialogue modal, titre annoncé, page derrière non défilable)", !!scene && scene.getAttribute("role") === "dialog" && scene.getAttribute("aria-modal") === "true" && d.documentElement.classList.contains("maj-en-cours") && !!scene.querySelector(".maj-logo img"));
  await finis;
  t("mise en scène : le logo, une barre de progression annoncée (role=progressbar, 0 à 100) et le pourcentage vont jusqu'à 100 %", scene.querySelector('[role="progressbar"]').getAttribute("aria-valuenow") === "100" && scene.querySelector("[data-maj-pourcent]").textContent === "100 %" && scene.querySelector("[data-maj-remplie]").style.getPropertyValue("--p") === "100");
  t("mise en scène : les 4 étapes sont cochées, le titre annonce « Version … installée », « Au programme » montre la nouveauté", scene.querySelectorAll(".maj-etape--fait").length === 4 && /Version 2026\.10\.20-a installée/.test(scene.querySelector(".maj-titre").textContent) && /Une nouveauté/.test(scene.querySelector(".maj-programme").textContent) && scene.className === "maj-scene maj-scene--ok");
  t("mise en scène : la version est activée auprès du service worker puis l'application se recharge UNE fois", navAvec.dernier.nom === "acsc-2026.10.20-a" && recharges === 1);
  t("mise en scène : l'avancement est annoncé aux lecteurs d'écran (région « status », par paliers)", /Mise à jour : \d+ pour cent/.test(scene.querySelector("[data-maj-vocal]").textContent) && scene.querySelector("[data-maj-vocal]").getAttribute("role") === "status");
  nettoyer();

  // ---------- Échec dans la scène : on peut réessayer ou continuer avec l'ancienne version
  let ferme = 0; let panne = true; recharges = 0;
  await I.demarrer(infos, { outils: outilsOk({ fetch: async () => reponse(panne ? 500 : 200) }), pause: sansPause, recharger: () => { recharges++; }, surFermeture: () => { ferme++; } });
  const sc = d.querySelector(".maj-scene");
  t("échec dans la scène : message clair (ta version actuelle n'a pas été modifiée) et deux choix, « Réessayer » et « Continuer avec l'ancienne version »", sc.className === "maj-scene maj-scene--echec" && /n'a pas abouti/.test(sc.querySelector(".maj-titre").textContent) && /Ta version actuelle n'a pas été modifiée/.test(sc.querySelector(".maj-texte").textContent) && Array.from(sc.querySelectorAll(".maj-actions button")).map(b => b.textContent).join("|") === "Réessayer|Continuer avec l'ancienne version" && recharges === 0);
  panne = false; sc.querySelector(".maj-actions button").click(); await sleep(30);
  t("« Réessayer » relance la mise à jour dans la MÊME fenêtre, et réussit quand le réseau revient", d.querySelectorAll(".maj-scene").length === 1 && sc.className === "maj-scene maj-scene--ok" && recharges === 1);
  nettoyer(); panne = true;
  await I.demarrer(infos, { outils: outilsOk({ fetch: async () => reponse(500) }), pause: sansPause, recharger: () => {}, surFermeture: () => { ferme++; } });
  const sc2 = d.querySelector(".maj-scene"); sc2.querySelectorAll(".maj-actions button")[1].click();
  t("« Continuer avec l'ancienne version » ferme la fenêtre, rend la page et prévient l'application (qui pourra redemander plus tard)", !d.querySelector(".maj-scene") && !d.documentElement.classList.contains("maj-en-cours") && ferme === 1);
  nettoyer();

  // ---------- Hors connexion : pas de téléchargement, message clair
  Object.defineProperty(w.navigator, "onLine", { configurable: true, value: false }); let appels = 0;
  await I.demarrer(infos, { outils: outilsOk({ fetch: async () => { appels++; return reponse(200); } }), pause: sansPause, recharger: () => {} });
  const so = d.querySelector(".maj-scene");
  t("hors connexion : aucun téléchargement tenté, message « a besoin d'Internet », la version actuelle n'est pas modifiée", appels === 0 && so.className === "maj-scene maj-scene--echec" && /besoin d'Internet/.test(so.querySelector(".maj-texte").textContent));
  Object.defineProperty(w.navigator, "onLine", { configurable: true, value: true }); nettoyer();

  // ---------- L'écran OBLIGATOIRE
  const bloc = I.ouvrirBlocage(infos, { raison: "rappels", outils: outilsOk(), pause: sansPause, recharger: () => { recharges++; } });
  const rb = d.querySelector(".maj-scene");
  t("écran obligatoire : « Mise à jour obligatoire », explique les trois reports, UN SEUL bouton (« Mettre à jour maintenant »), pas de fermeture", rb.className === "maj-scene maj-scene--bloque" && /obligatoire/.test(rb.querySelector(".maj-titre").textContent) && /trois fois/.test(rb.querySelector(".maj-texte").textContent) && rb.querySelectorAll(".maj-actions button").length === 1);
  rb.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  t("écran obligatoire : Échap ne le ferme PAS, le focus est sur le bouton et Tab reste enfermé dedans", !!d.querySelector(".maj-scene") && d.activeElement === rb.querySelector(".maj-actions button") && (() => { const tab = new w.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }); rb.querySelector(".maj-actions button").dispatchEvent(tab); return tab.defaultPrevented; })());
  recharges = 0; rb.querySelector(".maj-actions button").click(); await sleep(40);
  t("écran obligatoire : le bouton lance la mise à jour dans la même fenêtre jusqu'à l'installation", rb.className === "maj-scene maj-scene--ok" && recharges === 1);
  nettoyer();
  I.ouvrirBlocage(infos, { raison: "version", outils: outilsOk(), pause: sansPause });
  t("écran obligatoire (version marquée obligatoire par le serveur) : le texte parle des données entre appareils, pas des reports", /données restent justes/.test(d.querySelector(".maj-scene .maj-texte").textContent) && !/trois fois/.test(d.querySelector(".maj-scene .maj-texte").textContent));
  nettoyer();

  // ---------- Réparation : seules les copies de l'application et le service worker sont supprimés
  w.localStorage.setItem("acsc_donnees_v1", '{"clients":[1]}'); let desinscrit = 0; recharges = 0;
  c = fauxCaches({ "acsc-2026.10.20-a": ["Index.html"], "acsc-meta": [], "autre-application": ["x"] });
  await I.reparer({ caches: c, navigator: { serviceWorker: { getRegistrations: async () => [{ unregister: async () => { desinscrit++; } }, { unregister: async () => { desinscrit++; } }] } }, recharger: () => { recharges++; } });
  t("réparation : seules les copies « acsc-* » sont supprimées (pas les autres caches), le service worker est désinscrit, la page se recharge", Array.from(c.stock.keys()).join() === "autre-application" && desinscrit === 2 && recharges === 1);
  t("réparation : les DONNÉES de l'utilisateur ne sont pas touchées", w.localStorage.getItem("acsc_donnees_v1") === '{"clients":[1]}');
};
