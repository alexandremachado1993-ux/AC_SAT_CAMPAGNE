/* Nouveautés : points de navigation de la galerie (façon Instagram). Le simulateur n'a aucune mise en page : on lui donne des dimensions fictives. */
const fs = require("fs");
const path = require("path");
module.exports = async function ({ page, t }) {
  const clic = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
  const feuille = (w) => w.document.querySelector(".feuille:not([hidden])");
  const dim = (obj, nom, get) => Object.defineProperty(obj, nom, { configurable: true, get });

  // ---------- Structure
  const w = page("Index.html"); const L = w.Nouveautes.LISTE;
  w.Nouveautes.ouvrir({ id: "planning-tableau-de-bord" });
  let f = feuille(w), g = f.querySelector(".nouv-galerie"), pts = f.querySelector(".nouv-points");
  const pt = () => Array.from(f.querySelectorAll(".nouv-point"));
  t("points : autant de points que de photos (" + L.find(x => x.id === "planning-tableau-de-bord").images.length + "), dans un groupe nommé, sous la galerie", pt().length === L.find(x => x.id === "planning-tableau-de-bord").images.length && pts.getAttribute("role") === "group" && pts.getAttribute("aria-label") === "Choisir une photo" && g.compareDocumentPosition(pts) & 4);
  t("points : vrais boutons, libellés « Photo i sur N », le premier est actif (aria-current)", pt().every((b, i) => b.tagName === "BUTTON" && b.type === "button" && b.getAttribute("aria-label") === "Photo " + (i + 1) + " sur " + pt().length) && pt()[0].getAttribute("aria-current") === "true" && pt().filter(b => b.getAttribute("aria-current") === "true").length === 1 && pt()[0].classList.contains("nouv-point--actif"));

  // ---------- Dimensions fictives : galerie 300 px de large, 900 px de contenu, trois photos de 280 px
  let pos = 0, W = 900, C = 300; const appels = []; let poser;
  const figs = Array.from(g.querySelectorAll(".nouv-figure")); const gauche = [2, 290, 578];
  dim(g, "scrollWidth", () => W); dim(g, "clientWidth", () => C);
  Object.defineProperty(g, "scrollLeft", { configurable: true, get: () => pos, set: (v) => poser(v) });
  figs.forEach((fg, i) => { dim(fg, "offsetLeft", () => gauche[i]); dim(fg, "offsetWidth", () => 280); });
  w.requestAnimationFrame = undefined;                       // chemin « sans animation » (comme sans requestAnimationFrame) : déterministe
  poser = (v) => { pos = v; appels.push({ left: v }); g.dispatchEvent(new w.Event("scroll")); };   // un vrai navigateur émet « scroll » à chaque changement
  const defiler = (x) => { pos = x; g.dispatchEvent(new w.Event("scroll")); };         // l'utilisateur fait défiler (pas une affectation du code)
  const actif = () => pt().findIndex(b => b.classList.contains("nouv-point--actif"));

  defiler(0);
  t("défilement : au tout début → point 1 actif, points visibles (la galerie défile)", actif() === 0 && !pts.hidden);
  defiler(6);
  t("défilement : à 6 px du début → toujours le point 1 (tolérance : sur ordinateur la galerie démarre décalée de 2 px)", actif() === 0);
  defiler(7); const sept = actif(); defiler(0);
  t("défilement : au-delà de la tolérance, on repart du calcul « photo la plus centrée »", sept === 0 || sept === 1);
  defiler(280);
  t("défilement : photo 2 la plus centrée → point 2 actif, un seul actif, aria-current à jour", actif() === 1 && pt().filter(b => b.classList.contains("nouv-point--actif")).length === 1 && pt()[1].getAttribute("aria-current") === "true" && pt()[0].getAttribute("aria-current") === "false");
  defiler(600);
  t("défilement : tout au bout → point 3 actif (la dernière photo ne peut pas atteindre le bord gauche)", actif() === 2);
  defiler(594);
  t("défilement : à 6 px du bout → toujours le point 3", actif() === 2);

  // ---------- Clic sur un point (sans animation : positions exactes)
  clic(pt()[1]);
  t("clic sur le point 2 : la photo 2 est CENTRÉE (position 280 = 290 − (300 − 280) / 2), le point 2 devient actif", appels.length === 1 && appels[0].left === 280 && actif() === 1);
  clic(pt()[0]);
  t("clic sur le point 1 : retour tout au début", appels[1].left === 0 && actif() === 0);
  clic(pt()[2]);
  t("clic sur le point 3 : tout au bout (position maximale 600)", appels[2].left === 600 && actif() === 2);
  t("clic : l'accroche automatique est suspendue puis RÉTABLIE à l'arrivée (jamais laissée coupée)", g.style.scrollSnapType === "");

  // ---------- Animation à la main (requestAnimationFrame simulé)
  w.requestAnimationFrame = (cb) => setTimeout(() => cb(w.performance.now()), 10); w.cancelAnimationFrame = (id) => clearTimeout(id);
  defiler(0); const n1 = appels.length; clic(pt()[1]);
  await new Promise(r => setTimeout(r, 90));
  const milieu = pos, suspendu = g.style.scrollSnapType === "none";
  t("animation : en cours de route la galerie est entre le départ et l'arrivée, l'accroche est suspendue", milieu > 0 && milieu < 280 && suspendu && appels.length > n1 + 1);
  await new Promise(r => setTimeout(r, 450));
  t("animation : arrive EXACTEMENT sur la position visée (280), l'accroche est rétablie, le point 2 est actif", pos === 280 && g.style.scrollSnapType === "" && actif() === 1);
  defiler(0); clic(pt()[2]); await new Promise(r => setTimeout(r, 60)); const avant = pos; clic(pt()[0]); await new Promise(r => setTimeout(r, 450));
  t("animation : un second clic en cours de route annule la première animation (pas de lutte entre deux mouvements)", avant < 600 && pos === 0 && actif() === 0);
  w.requestAnimationFrame = () => 0; w.cancelAnimationFrame = () => {};           // « images » suspendues (onglet en arrière-plan) : aucun pas d'animation ne vient
  defiler(0); clic(pt()[2]); await new Promise(r => setTimeout(r, 560));
  t("animation : si les images du navigateur sont suspendues en route, la garde FORCE l'arrivée (jamais bloquée à mi-chemin) et rétablit l'accroche", pos === 600 && g.style.scrollSnapType === "" && actif() === 2);
  w.requestAnimationFrame = (cb) => setTimeout(() => cb(w.performance.now()), 10); w.cancelAnimationFrame = (id) => clearTimeout(id);
  w.matchMedia = () => ({ matches: true }); defiler(0); const n2 = appels.length; clic(pt()[1]);
  t("« réduire les animations » activé : déplacement immédiat, sans animation", appels.length === n2 + 1 && pos === 280);
  delete w.matchMedia; w.requestAnimationFrame = undefined;

  // ---------- Clavier
  defiler(0);
  const droite = new w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }); g.dispatchEvent(droite);
  t("clavier : flèche droite sur la galerie → photo suivante (la page ne défile pas de son côté)", pos === 280 && droite.defaultPrevented);
  defiler(600);
  g.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
  t("clavier : flèche gauche depuis la dernière → photo précédente", pos === 280);
  const autre = new w.KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }); const n0 = appels.length; g.dispatchEvent(autre);
  t("clavier : les autres touches ne sont pas interceptées", appels.length === n0 && !autre.defaultPrevented);
  defiler(0); g.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
  t("clavier : flèche gauche sur la première photo → reste sur la première (pas de sortie de la galerie)", pos === 0);

  // ---------- Masquage quand tout tient à l'écran, et rotation / redimensionnement
  W = 300; defiler(0);
  t("tout tient à l'écran (ex. 2 photos sur ordinateur) : les points disparaissent, le texte d'aide ne parle plus de glisser", pts.hidden === true && f.querySelector(".nouv-astuce").textContent === "Touche une photo pour l'agrandir.");
  W = 900; w.dispatchEvent(new w.Event("resize"));
  t("rotation du téléphone / redimensionnement : les points réapparaissent d'eux-mêmes, avec l'aide « Fais glisser ou touche les points »", pts.hidden === false && /Fais glisser ou touche les points/.test(f.querySelector(".nouv-astuce").textContent));

  // ---------- Navigation entre nouveautés : les points sont reconstruits pour la nouvelle galerie
  const w2 = page("Index.html"); w2.Nouveautes.ouvrir({ tout: true }); f = feuille(w2);
  clic(f.querySelector('[data-nouv-nav="1"]'));
  t("changer de nouveauté : les points sont reconstruits (autant que de photos de cette nouveauté, premier actif)", f.querySelectorAll(".nouv-point").length === w2.Nouveautes.LISTE[1].images.length && f.querySelector(".nouv-point--actif") === f.querySelector(".nouv-point"));

  // ---------- Une seule photo : ni points ni texte « glisser »
  const w3 = page("Index.html"); { const e = w3.Nouveautes.LISTE.find(x => x.id === "planning-tableau-de-bord"); e.images = e.images.slice(0, 1); } w3.Nouveautes.ouvrir({ id: "planning-tableau-de-bord" }); f = feuille(w3);
  t("une seule photo : pas de points, juste « Touche une photo pour l'agrandir »", !f.querySelector(".nouv-points") && f.querySelector(".nouv-astuce").textContent === "Touche une photo pour l'agrandir.");

  // ---------- Style (le simulateur ne charge pas la feuille de style : on contrôle les règles)
  const css = fs.readFileSync(path.join(__dirname, "..", "CSS", "campagne.css"), "utf8");
  t("style : les points se masquent vraiment (« [hidden] » prime sur « display: flex »), c'est le défaut déjà rencontré sur d'autres boutons", /\.nouv-points\[hidden\] \{ display: none; \}/.test(css) && /\.nouv-points \{ display: flex;/.test(css));
  t("style : cibles tactiles de 44 × 44 px, point actif allongé, anneau de focus clavier", /\.nouv-point \{[^}]*width: 44px; height: 44px;/.test(css) && /\.nouv-point--actif::before \{ width: 22px;/.test(css) && /\.nouv-point:focus-visible::before \{ outline:/.test(css));
  t("style : barre de défilement masquée (les points la remplacent) ; la galerie est le repère des mesures (position: relative)", /\.nouv-galerie \{ position: relative; scrollbar-width: none; \}/.test(css) && /\.nouv-galerie::-webkit-scrollbar \{ display: none; \}/.test(css));
  t("style : photos accrochées au CENTRE (3 positions d'arrêt distinctes) — avec « start », cliquer le point 2 ramenait au début sur ordinateur", /\.nouv-figure \{[^}]*scroll-snap-align: center;/.test(css) && !/\.nouv-figure \{[^}]*scroll-snap-align: start;/.test(css));
  t("style : animation des points désactivée si « réduire les animations »", /prefers-reduced-motion: reduce\) \{ \.nouv-point::before \{ transition: none; \} \}/.test(css));
};
