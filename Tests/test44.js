/* Menu étendu « Plus d'outils » : Serti et Documents, par glissement vers le haut depuis la barre du bas (ou la languette ⌃). */
const fs = require("fs");
const path = require("path");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t }) {
  const racine = path.join(__dirname, "..");
  const w = page("Index.html"); const d = w.document;
  const barre = d.getElementById("nav-basse"), tiroir = d.getElementById("nav-tiroir"), langue = d.querySelector(".nav-poignee"), voile = d.querySelector(".nav-tiroir-voile");
  const evt = (cible, type, y, x) => cible.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x || 200, clientY: y }));
  const p = () => Number(tiroir.style.getPropertyValue("--p"));
  const ouvert = () => langue.getAttribute("aria-expanded") === "true";
  const fermeTotalement = async () => { await sleep(420); return tiroir.hidden === true && voile.hidden === true; };

  // ---------- Structure
  t("navigation : la barre du bas garde 4 liens + le bouton « + » (Serti et Documents n'y sont pas)", barre.querySelectorAll(".nav-basse-lien").length === 4 && !!barre.querySelector(".fab-bouton") && ![...barre.querySelectorAll(".nav-basse-lien")].some(a => /Serti|Docs|Documents/.test(a.textContent)));
  t("navigation : le profil ne contient plus ni Serti ni Documents ; Réglages et Nouveautés y restent", (() => { w.document.querySelector(".entete-avatar").click(); const m = d.querySelector(".menu-avatar-panneau").textContent; w.document.querySelector(".entete-avatar").click(); return !/Serti|Documents/.test(m) && /Réglages/.test(m) && /Nouveautés/.test(m); })());
  const cartes = [...tiroir.querySelectorAll(".nav-tiroir-carte")];
  t("menu étendu : deux cartes, Contrôle de serti puis Documents, vers les bonnes pages", cartes.length === 2 && /Contrôle de serti/.test(cartes[0].textContent) && cartes[0].getAttribute("href") === "Serti.html" && /Documents/.test(cartes[1].textContent) && cartes[1].getAttribute("href") === "Documents.html");
  t("menu étendu : fermé au départ (caché au clavier et aux lecteurs d'écran), languette annoncée et reliée au tiroir", tiroir.hidden === true && langue.getAttribute("aria-expanded") === "false" && langue.getAttribute("aria-controls") === "nav-tiroir" && /Plus d'outils/.test(langue.getAttribute("aria-label")) && tiroir.getAttribute("role") === "dialog");

  // ---------- Languette (clavier / toucher) : le geste n'est jamais la seule voie
  langue.click();
  t("languette : un toucher ouvre le tiroir, le focus va sur la première carte", ouvert() && tiroir.hidden === false && voile.hidden === false && p() === 1 && d.activeElement === cartes[0]);
  evt(d.body, "keydown", 0); d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  t("clavier : Échap referme et le focus revient sur la languette", !ouvert() && d.activeElement === langue && await fermeTotalement());
  langue.click(); langue.click();
  t("languette : un second toucher referme", !ouvert() && await fermeTotalement());

  // ---------- Glissement vers le haut depuis la barre
  evt(barre, "pointerdown", 800); evt(barre, "pointermove", 770); 
  t("geste : dès 30 px, le tiroir apparaît et SUIT le doigt (progression partielle, pas encore « ouvert »)", tiroir.hidden === false && p() > 0.2 && p() < 0.3 && !ouvert());
  evt(barre, "pointermove", 740);
  t("geste : plus le doigt monte, plus le tiroir monte (60 px = 50 %)", Math.abs(p() - 0.5) < 0.02);
  await sleep(300); evt(barre, "pointerup", 740);
  t("geste lent mais au-delà de 40 % : le tiroir finit de s'ouvrir tout seul", ouvert() && p() === 1);
  t("geste : le toucher qui termine le glissement n'active PAS un lien de la barre", (() => { const e = new w.MouseEvent("click", { bubbles: true, cancelable: true }); barre.querySelector(".nav-basse-lien").dispatchEvent(e); return e.defaultPrevented; })());
  await sleep(380);
  t("geste : 350 ms plus tard, les liens de la barre répondent de nouveau", (() => { const e = new w.MouseEvent("click", { bubbles: true, cancelable: true }); barre.querySelector(".nav-basse-lien").dispatchEvent(e); return e.defaultPrevented === false; })());
  evt(tiroir, "pointerdown", 400); evt(tiroir, "pointermove", 420); evt(tiroir, "pointermove", 480); 
  t("geste de fermeture : glisser le tiroir vers le bas le fait redescendre avec le doigt (80 px ≈ 33 % restant)", p() > 0.3 && p() < 0.4);
  await sleep(300); evt(tiroir, "pointerup", 480);
  t("geste de fermeture : relâché à moins de 40 % → il se referme complètement", !ouvert() && await fermeTotalement());

  evt(barre, "pointerdown", 800); evt(barre, "pointermove", 790); evt(barre, "pointermove", 780); await sleep(300); evt(barre, "pointerup", 780);
  t("geste trop court et lent (20 px, ≈ 17 %) : le tiroir se referme, rien ne s'ouvre", !ouvert() && await fermeTotalement());
  evt(barre, "pointerdown", 800); evt(barre, "pointermove", 780); evt(barre, "pointermove", 765); evt(barre, "pointerup", 765);
  t("geste court mais RAPIDE (flick) : il s'ouvre (la vitesse suffit)", ouvert());
  voile.click();
  t("toucher à côté (sur le voile) : le tiroir se referme", !ouvert() && await fermeTotalement());

  // ---------- Cas où il ne doit PAS s'ouvrir
  evt(barre, "pointerdown", 800, 100); evt(barre, "pointermove", 795, 180); evt(barre, "pointermove", 792, 260); evt(barre, "pointerup", 792, 260);
  t("mouvement plutôt HORIZONTAL : ignoré (pas notre geste)", !ouvert() && tiroir.hidden === true);
  evt(barre, "pointerdown", 800); evt(barre, "pointerup", 800);
  t("simple toucher sans mouvement : n'ouvre rien", !ouvert() && tiroir.hidden === true);
  w.AppLayout.ouvrirFeuille("bas", "Une fenêtre", "<p>x</p>"); langue.click();
  t("une fenêtre est ouverte : le menu étendu ne s'ouvre pas par-dessus", !ouvert());
  w.AppLayout.fermerFeuille();
  evt(barre, "pointerdown", 800); evt(barre, "pointermove", 770); evt(barre, "pointercancel", 770);
  t("geste interrompu par le système (pointercancel) : retour à l'état de départ, rien de bloqué", !ouvert() && await fermeTotalement());
  w.AppLayout.ouvrirOutils();
  t("API : AppLayout.ouvrirOutils() ouvre le tiroir (utilisée par la présentation de première connexion)", ouvert());
  w.AppLayout.fermerOutils(); await sleep(420);

  // ---------- Page courante
  const ws = page("Serti.html"), ds = ws.document;
  t("page Serti : la languette porte un point (on est dans un outil) et la carte du Serti est marquée page courante", ds.querySelector(".nav-poignee").classList.contains("nav-poignee--actif") && ds.querySelector('.nav-tiroir-carte[href="Serti.html"]').getAttribute("aria-current") === "page" && !ds.querySelector('.nav-tiroir-carte[href="Documents.html"]').getAttribute("aria-current"));
  t("page À visiter : aucun point sur la languette", !langue.classList.contains("nav-poignee--actif"));

  // ---------- CSS
  const css = fs.readFileSync(path.join(racine, "CSS/campagne.css"), "utf8");
  t("CSS : la barre et le tiroir n'interceptent pas les gestes du navigateur (touch-action: none) et disparaissent au-delà de 768 px", /\.nav-basse, \.nav-tiroir \{ touch-action: none/.test(css) && /@media \(min-width: 768px\) \{ \.nav-poignee, \.nav-tiroir, \.nav-tiroir-voile \{ display: none !important; \}/.test(css));
  t("CSS : le tiroir est piloté par --p (suit le doigt) et la transition n'existe que pendant l'animation de relâche (jamais pendant le glissement)", /transform: translate\(-50%, calc\(\(1 - var\(--p, 0\)\) \* 110%\)\)/.test(css) && /\.nav-tiroir--anime \{ transition: transform 0\.38s cubic-bezier/.test(css));
  t("CSS : aucune couleur oklch / color-mix dans le nouveau menu (pas de bloc de secours à régénérer)", !/nav-tiroir[^\n]*(oklch|color-mix)/.test(css) && !/nav-poignee[^\n]*(oklch|color-mix)/.test(css));
};
