/* Animation d'ouverture (Js/Splash.js) : lancement, fins possibles, cas où elle ne doit pas se lancer. */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t, P, fs }) {
  const path = require("path");
  const lire = (f) => fs.readFileSync(path.join(P, f), "utf8");
  // Rien de « non implémenté » dans jsdom : la lecture vidéo est simulée.
  const media = (extra) => (w) => {
    w.sessionStorage.removeItem("acsc_splash");                         // première page de la session
    w.HTMLMediaElement.prototype.play = () => Promise.resolve();
    w.HTMLMediaElement.prototype.pause = () => {};
    w.__SPLASH_DELAIS = { lecture: 120, max: 500, fondu: 30, duree: 200, marge: 100 };
    if (extra) extra(w);
  };
  const ouvrir = (extra) => page("Index.html", null, "", null, media(extra));

  // ---- première ouverture
  let w = ouvrir(); let d = w.document; await sleep(20);
  const video = () => d.querySelector("#splash video");
  t("ouverture : la page est masquée derrière (classe sur <html>)", d.documentElement.classList.contains("splash-actif"));
  t("ouverture : vidéo plein écran, muette, sans son", !!video() && video().muted === true && video().hasAttribute("playsinline"));
  t("ouverture : MP4 d'abord, WebM en secours, et image d'attente", [...d.querySelectorAll("#splash source")].map(s => s.getAttribute("type")).join() === "video/mp4,video/webm" && /ouverture-poster\.jpg/.test(video().getAttribute("poster")));
  t("ouverture : bouton « Passer » accessible", !!d.querySelector(".splash-passer") && /Passer/.test(d.querySelector(".splash-passer").getAttribute("aria-label")));
  w.Splash.fin();
  t("fin : la page redevient visible aussitôt", !d.documentElement.classList.contains("splash-actif"));
  t("fin : fondu, puis la vidéo est retirée", !!d.getElementById("splash") && (await sleep(90), !d.getElementById("splash")));

  // ---- toutes les façons de finir
  w = ouvrir(); d = w.document; await sleep(20);
  video().dispatchEvent(new w.Event("ended")); await sleep(80);
  t("fin naturelle de la vidéo", !d.getElementById("splash") && !d.documentElement.classList.contains("splash-actif"));

  w = ouvrir(); d = w.document; await sleep(20);
  d.querySelector("#splash source").dispatchEvent(new w.Event("error")); await sleep(40);       // la 1re source (MP4) échoue : le navigateur essaie la suivante
  t("MP4 illisible mais WebM disponible : on n'abandonne pas", !!d.getElementById("splash") && d.documentElement.classList.contains("splash-actif"));
  const sources = d.querySelectorAll("#splash source");
  sources[sources.length - 1].dispatchEvent(new w.Event("error")); await sleep(80);            // la dernière échoue aussi
  t("aucune vidéo lisible : l'application s'ouvre", !d.getElementById("splash") && !d.documentElement.classList.contains("splash-actif"));

  w = ouvrir(); d = w.document; await sleep(20);
  d.querySelector(".splash-passer").click(); await sleep(80);
  t("appui sur « Passer »", !d.getElementById("splash"));
  w = ouvrir(); d = w.document; await sleep(20);
  d.getElementById("splash").click(); await sleep(80);
  t("appui n'importe où", !d.getElementById("splash"));
  w = ouvrir(); d = w.document; await sleep(20);
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await sleep(80);
  t("touche Échap", !d.getElementById("splash"));

  w = ouvrir(); d = w.document; await sleep(200);
  t("la vidéo ne démarre pas dans le délai (réseau lent, hors ligne) : on passe", !d.getElementById("splash") && !d.documentElement.classList.contains("splash-actif"));

  w = ouvrir(); d = w.document; await sleep(20);
  video().dispatchEvent(new w.Event("playing")); await sleep(150);
  t("vidéo démarrée : le délai d'attente est annulé, elle continue", !!d.getElementById("splash") && d.documentElement.classList.contains("splash-actif"));
  await sleep(320);
  t("garde-fou : durée de la vidéo + marge, jamais plus", !d.getElementById("splash"));
  w = ouvrir(); d = w.document; await sleep(20);
  t("hors 'playing', le garde-fou absolu s'applique aussi", (await sleep(60), !!d.getElementById("splash")) && (video().dispatchEvent(new w.Event("ended")), await sleep(60), !d.getElementById("splash")));

  w = ouvrir((x) => { x.HTMLMediaElement.prototype.play = () => Promise.reject(new Error("NotAllowedError")); }); d = w.document; await sleep(80);
  t("lecture refusée par le navigateur (économie d'énergie) : on passe", !d.getElementById("splash") && !d.documentElement.classList.contains("splash-actif"));

  // ---- cas où l'animation ne doit pas se lancer
  w = page("Index.html", null, "", null, (x) => { x.HTMLMediaElement.prototype.play = () => Promise.resolve(); });   // session déjà ouverte (drapeau posé par le banc de test)
  await sleep(20);
  t("même session (autre page, rechargement) : pas de vidéo", !w.document.getElementById("splash") && !w.document.documentElement.classList.contains("splash-actif"));
  const red = (x) => { x.matchMedia = (q) => ({ matches: /reduced-motion/.test(q), addListener() {}, removeListener() {} }); };
  w = ouvrir(red); await sleep(20);
  t("PAR DÉFAUT la vidéo se lance même si l'appareil demande de réduire les animations (cas d'un PC de bureau)", !!w.document.getElementById("splash") && w.document.documentElement.classList.contains("splash-actif"));
  w.Splash.fin();
  w = ouvrir((x) => { red(x); x.localStorage.setItem("acsc_animation", "auto"); }); await sleep(20);
  t("« Suivre l'appareil » : moins d'animations demandé → pas de vidéo", !w.document.getElementById("splash") && !w.document.documentElement.classList.contains("splash-actif"));
  t("… et l'ignorance est notée au journal avec sa raison", w.Splash.journal()[0] && w.Splash.journal()[0].c === "reduit");
  w = ouvrir((x) => { x.localStorage.setItem("acsc_animation", "auto"); Object.defineProperty(x.navigator, "connection", { configurable: true, value: { saveData: true } }); }); await sleep(20);
  t("« Suivre l'appareil » : économie de données → pas de vidéo, notée", !w.document.getElementById("splash") && w.Splash.journal()[0].c === "economie");
  const delais = [];
  w = ouvrir((x) => { const st = x.setTimeout; x.setTimeout = (f, n, ...a) => { delais.push(n); return st(f, n, ...a); }; }); await sleep(20);
  t("filet de sécurité : la page se rouvre d'elle-même au bout de 14 s si le script est absent", delais.indexOf(14000) !== -1);

  // ---- réglage « Animation d'ouverture » (auto / toujours / jamais)
  const reduit = (x) => { x.matchMedia = (q) => ({ matches: /reduced-motion/.test(q), addListener() {}, removeListener() {} }); };
  w = ouvrir((x) => { reduit(x); x.localStorage.setItem("acsc_animation", "toujours"); }); await sleep(20);
  t("réglage « Toujours » : la vidéo se lance même si l'appareil demande de réduire les animations", !!w.document.getElementById("splash") && w.document.documentElement.classList.contains("splash-actif"));
  w.Splash.fin();
  w = ouvrir(); await sleep(20);
  t("aucun réglage enregistré = « Toujours »", w.Splash.etat().mode === "toujours" && !!w.document.getElementById("splash"));
  w.Splash.fin();
  w = ouvrir((x) => { x.localStorage.setItem("acsc_animation", "jamais"); }); await sleep(20);
  t("réglage « Jamais » : aucune vidéo", !w.document.getElementById("splash"));
  w = ouvrir((x) => { x.localStorage.setItem("acsc_animation", "n'importe quoi"); }); await sleep(20);
  t("réglage illisible : retour à « Toujours »", !!w.document.getElementById("splash") && w.Splash.etat().mode === "toujours");
  w.Splash.fin();
  // carte dans Réglages
  const reg = (extra) => page("Reglages.html", null, "", null, media(extra));
  w = reg((x) => { x.sessionStorage.setItem("acsc_splash", "1"); }); d = w.document; await sleep(40);
  t("Réglages : carte « Animation d'ouverture » avec 3 choix, « Toujours » par défaut", !!d.getElementById("carte-animation") && d.querySelectorAll('input[name="anim-mode"]').length === 3 && d.querySelector('input[name="anim-mode"]:checked').value === "toujours");
  t("Réglages : état « active » quand l'appareil ne demande rien", /Active/.test(d.querySelector("[data-animation-statut]").textContent));
  d.querySelector('input[name="anim-mode"][value="jamais"]').checked = true; d.querySelector('input[name="anim-mode"][value="jamais"]').dispatchEvent(new w.Event("change"));
  t("Réglages : le choix est mémorisé sur l'appareil", w.localStorage.getItem("acsc_animation") === "jamais" && /tu l'as choisi/.test(d.querySelector("[data-animation-statut]").textContent));
  w = reg((x) => { x.sessionStorage.setItem("acsc_splash", "1"); reduit(x); x.localStorage.setItem("acsc_animation", "auto"); }); d = w.document; await sleep(40);
  t("Réglages : explique pourquoi l'animation est éteinte (réduire les animations) et où le changer", /Désactivée par cet appareil/.test(d.querySelector("[data-animation-statut]").textContent) && /Effets d'animation/.test(d.querySelector("[data-animation-statut]").textContent));
  d.querySelector('input[name="anim-mode"][value="toujours"]').checked = true; d.querySelector('input[name="anim-mode"][value="toujours"]').dispatchEvent(new w.Event("change"));
  t("Réglages : « Toujours » → état « Active (même si l'appareil demande… ) »", /Active/.test(d.querySelector("[data-animation-statut]").textContent) && /même si/.test(d.querySelector("[data-animation-statut]").textContent));
  d.querySelector("[data-revoir-animation]").click(); await sleep(20);
  t("Réglages : « Revoir l'animation » lance la vidéo tout de suite", !!d.getElementById("splash") && d.documentElement.classList.contains("splash-actif"));
  w.Splash.fin(); await sleep(80);
  t("Revoir : la page redevient utilisable ensuite, et on peut la revoir", !d.getElementById("splash") && (d.querySelector("[data-revoir-animation]").click(), !!d.getElementById("splash")));
  w.Splash.fin();

  // ---- journal : chaque issue laisse une ligne lisible
  const issue = async (action, attendu, extra) => {
    const x = ouvrir(extra); await sleep(20); await action(x); await sleep(90);
    const j = x.Splash.journal()[0]; return j && j.c === attendu;
  };
  t("journal : fin naturelle", await issue((x) => x.document.querySelector("#splash video").dispatchEvent(new x.Event("ended")), "termine"));
  t("journal : appui pour passer", await issue((x) => x.document.querySelector(".splash-passer").click(), "passe"));
  t("journal : aucune source lisible", await issue((x) => { const s = x.document.querySelectorAll("#splash source"); s[s.length - 1].dispatchEvent(new x.Event("error")); }, "erreur"));
  t("journal : la vidéo ne démarre pas à temps", await issue(async () => { await sleep(150); }, "lecture-tardive"));
  w = ouvrir((x) => { x.HTMLMediaElement.prototype.play = () => Promise.reject(Object.assign(new Error("x"), { name: "NotAllowedError" })); }); await sleep(90);
  t("journal : lecture refusée, avec le nom de l'erreur", w.Splash.journal()[0].c === "refuse" && w.Splash.journal()[0].x === "NotAllowedError");
  w = ouvrir((x) => { x.localStorage.setItem("acsc_animation", "jamais"); }); await sleep(20);
  t("journal : réglage « Jamais »", w.Splash.journal()[0].c === "jamais");
  w = ouvrir(); await sleep(20); w.Splash.fin(); await sleep(60); w.Splash.jouer(); await sleep(20); w.document.querySelector(".splash-passer").click(); await sleep(60);
  t("journal : « Revoir l'animation » est distingué d'une ouverture", w.Splash.journal()[0].c === "revoir:passe");
  w = reg((x) => { x.sessionStorage.setItem("acsc_splash", "1"); x.localStorage.setItem("acsc_splash_journal", JSON.stringify([{ t: "2026-09-30T07:12:00.000Z", c: "lecture-tardive", x: "" }, { t: "2026-09-30T07:03:00.000Z", c: "termine", x: "" }])); }); d = w.document; await sleep(40);
  t("Réglages : « Dernières ouvertures » lisible (date, issue)", d.querySelectorAll("[data-animation-journal] li").length === 2 && /n'a pas démarré à temps/.test(d.querySelector("[data-animation-journal]").textContent) && /Jouée jusqu'au bout/.test(d.querySelector("[data-animation-journal]").textContent));
  w = ouvrir(); d = w.document; await sleep(20);
  t("barre d'état du téléphone : claire pendant la vidéo…", d.querySelector('meta[name="theme-color"]').getAttribute("content") === "#f9f8fb");
  w.Splash.fin();
  t("… puis rétablie (rouge de l'application)", d.querySelector('meta[name="theme-color"]').getAttribute("content") === "#dc2626");

  // ---- garanties statiques
  const pages = fs.readdirSync(P).filter(f => f.endsWith(".html") && f !== "404.html");   /* 404.html : page autonome, vérifiée par test25.js */
  t("toutes les pages : Amorce.js (décision de l'animation, avec le réglage) est chargé dans l'en-tête, AVANT Splash.js et avant l'affichage", pages.every(f => { const h = lire(f); return h.indexOf("Js/Amorce.js") > -1 && h.indexOf("Js/Amorce.js") < h.indexOf("Js/Splash.js") && h.indexOf("Js/Splash.js") < h.indexOf("<body"); }) && /acsc_splash/.test(lire("Js/Amorce.js")) && /acsc_animation/.test(lire("Js/Amorce.js")));
  t("décision prise avant les feuilles de style (pas de flash)", pages.every(f => { const s = lire(f); return s.indexOf("acsc_splash") < s.indexOf("CSS/style.css"); }));
  t("médias présents et légers (< 400 Ko chacun)", ["ouverture.mp4", "ouverture.webm", "ouverture-poster.jpg"].every(f => fs.existsSync(path.join(P, "Media", f)) && fs.statSync(path.join(P, "Media", f)).size < 400 * 1024));
  const css = lire("CSS/campagne.css");
  t("fond de l'animation = couleur des bords de la vidéo = fond du démarrage système", /html\.splash-actif \{ background: #f9f8fb; \}/.test(css) && JSON.parse(lire("manifest.webmanifest")).background_color === "#f9f8fb");
  t("service worker : vidéos et requêtes partielles laissées au navigateur", /headers\.has\("range"\)/.test(lire("sw.js")) && /mp4\|webm/.test(lire("sw.js")));
  t("Netlify : cache long pour les médias", /for = "\/Media\/\*"/.test(lire("netlify.toml")) && /immutable/.test(lire("netlify.toml")));
};
