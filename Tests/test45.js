/* Présentation de première connexion : 3 écrans, une seule fois, nouvelles installations sur téléphone seulement, rejouable. */
const fs = require("fs");
const path = require("path");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t }) {
  const racine = path.join(__dirname, "..");
  const mobile = (extra) => (win) => { Object.defineProperty(win, "innerWidth", { configurable: true, value: 390 }); win.localStorage.removeItem("acsc_nouveautes_vue"); if (extra) extra(win); };
  const clic = (w, el) => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));

  // ---------- Première installation sur téléphone
  let w = page("Index.html", null, "", null, mobile()); let d = w.document; let pres = d.querySelector(".pres");
  t("présentation : s'affiche à la première installation sur téléphone (dialogue modal, titre annoncé)", !!pres && pres.getAttribute("role") === "dialog" && pres.getAttribute("aria-modal") === "true" && d.getElementById("pres-titre").textContent === "Bienvenue dans AC SAT Campagnes");
  t("présentation : l'état « déjà vue » est enregistré dès l'affichage (jamais deux fois), localement à l'appareil", w.localStorage.getItem("acsc_presentation_vue") === "1" && d.activeElement === pres);
  t("présentation : écran 1 sans bouton Retour, avec Passer et Suivant ; 3 points dont le premier actif", d.querySelector("[data-retour]").hidden === true && d.querySelector("[data-passer]").hidden === false && d.querySelector("[data-suivant]").textContent === "Suivant" && d.querySelectorAll(".pres-points span").length === 3 && d.querySelectorAll(".pres-points span.actif").length === 1 && d.querySelector(".pres-scene.actif").classList.contains("pres-scene--1"));
  t("écran 1 : le logo et les 4 pages de la barre du bas", !!d.querySelector(".pres-logo img") && [...d.querySelectorAll(".pres-puces span")].map(x => x.textContent).join("|") === "📋 À visiter|📅 Planning|🤖 Tournée|👥 Clients");
  clic(w, d.querySelector("[data-suivant]"));
  t("écran 2 : « L'essentiel sous le pouce », la maquette de la barre avec le bouton +, Retour apparaît", d.getElementById("pres-titre").textContent === "L'essentiel sous le pouce" && d.querySelector(".pres-scene.actif").classList.contains("pres-scene--2") && !!d.querySelector(".pres-scene--2 .pres-fab") && d.querySelector("[data-retour]").hidden === false);
  clic(w, d.querySelector("[data-suivant]"));
  t("écran 3 : « Glisse vers le haut pour plus d'outils », la démonstration avec le doigt, le tiroir, Serti et Documents", /Glisse vers le haut/.test(d.getElementById("pres-titre").textContent) && !!d.querySelector(".pres-scene--3 .pres-doigt") && [...d.querySelectorAll(".pres-scene--3 .pres-tiroir-carte")].map(x => x.textContent).join("|") === "📏Contrôle de serti|📄Documents" && /languette/.test(d.getElementById("pres-texte").textContent));
  t("écran 3 : le bouton principal devient « Essayer le geste », Passer disparaît, « Terminer » apparaît", d.querySelector("[data-suivant]").textContent === "Essayer le geste" && d.querySelector("[data-passer]").hidden === true && d.querySelector("[data-terminer]").hidden === false);
  clic(w, d.querySelector("[data-retour]"));
  t("Retour : revient à l'écran 2", d.getElementById("pres-titre").textContent === "L'essentiel sous le pouce");
  clic(w, d.querySelector("[data-suivant]")); clic(w, d.querySelector("[data-suivant]"));
  await sleep(1000);
  t("« Essayer le geste » : la présentation se ferme et le VRAI menu étendu s'ouvre, pour que l'utilisateur voie ce dont on parle", !d.querySelector(".pres") && d.querySelector(".nav-poignee").getAttribute("aria-expanded") === "true");

  // ---------- Une seule fois, et pas pour tout le monde
  w = page("Index.html", null, "", null, mobile((win) => win.localStorage.setItem("acsc_presentation_vue", "1")));
  t("jamais deux fois : si l'état « vue » existe, rien ne s'affiche", !w.document.querySelector(".pres"));
  w = page("Index.html");
  t("utilisateur existant (des nouveautés déjà vues) : pas de présentation, il reçoit l'annonce des nouveautés", !w.document.querySelector(".pres"));
  w = page("Index.html", null, "", null, (win) => win.localStorage.removeItem("acsc_nouveautes_vue"));
  t("ordinateur (≥ 768 px, barre latérale) : pas de présentation automatique", !w.document.querySelector(".pres"));
  w = page("Index.html", JSON.stringify({ clients: [{ id: "c1", nom: "Déjà là", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 }], lignes: [], contacts: [], visites: [], rdv: [], profil: {} }), "", null, mobile());
  t("quelqu'un qui a déjà des clients (installation ancienne, nouveautés non marquées) : pas de présentation", !w.document.querySelector(".pres"));

  // ---------- Fermetures et clavier
  w = page("Index.html", null, "", null, mobile()); d = w.document;
  clic(w, d.querySelector("[data-passer]")); await sleep(380);
  t("Passer : ferme la présentation (marquée vue)", !d.querySelector(".pres") && w.localStorage.getItem("acsc_presentation_vue") === "1" && d.querySelector(".nav-poignee").getAttribute("aria-expanded") === "false");
  w = page("Index.html", null, "", null, mobile()); d = w.document; pres = d.querySelector(".pres");
  pres.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); 
  t("clavier : flèche droite passe à l'écran suivant", d.getElementById("pres-titre").textContent === "L'essentiel sous le pouce");
  pres.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  t("clavier : flèche gauche revient", d.getElementById("pres-titre").textContent === "Bienvenue dans AC SAT Campagnes");
  const boutons = [...pres.querySelectorAll("button")].filter(b => !b.hidden); boutons[boutons.length - 1].focus();
  const tab = new w.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }); boutons[boutons.length - 1].dispatchEvent(tab);
  t("clavier : Tab sur le dernier bouton revient au premier (le focus ne s'échappe pas derrière la présentation)", tab.defaultPrevented && d.activeElement === boutons[0]);
  pres.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await sleep(380);
  t("clavier : Échap ferme la présentation", !d.querySelector(".pres"));

  // ---------- Rejouer depuis Réglages
  const wr = page("Reglages.html", null, "#informations"); const dr = wr.document;
  const bouton = dr.querySelector("[data-presentation-revoir]");
  t("Réglages › Informations : une carte « Présentation » avec « Revoir la présentation »", !!bouton && /Revoir la présentation/.test(bouton.textContent));
  clic(wr, bouton);
  t("« Revoir la présentation » : la rejoue (même si déjà vue), sans bouton « Essayer » sur ordinateur (le menu étendu n'y existe pas)", !!dr.querySelector(".pres") && !dr.querySelector("[data-terminer]"));
  clic(wr, dr.querySelector("[data-suivant]")); clic(wr, dr.querySelector("[data-suivant]"));
  t("sur ordinateur, le dernier écran se termine par « Terminer »", dr.querySelector("[data-suivant]").textContent === "Terminer");

  // ---------- Frontières et style
  t("frontière R3 : l'état de la présentation n'est ni dans la sauvegarde exportée ni dans les données", !/acsc_presentation/.test(JSON.stringify(w.Donnees.exporter())) && !/acsc_presentation/.test(w.localStorage.getItem("acsc_donnees_v1") || ""));
  const src = fs.readFileSync(path.join(racine, "Js/Presentation.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  t("frontière : la présentation ne dépend pas de la synchronisation", !/Synchro/.test(src));
  const css = fs.readFileSync(path.join(racine, "CSS/campagne.css"), "utf8");
  t("animations : chaque animation en boucle se TERMINE sur l'état montré (avec « moins de mouvement », l'illustration apparaît finie)", /@keyframes pres-tiroir \{[\s\S]*?100% \{ opacity: 1; transform: none; \} \}/.test(css) && /@keyframes pres-carte \{[\s\S]*?100% \{ opacity: 1; transform: none; \} \}/.test(css) && /\.pres \[hidden\] \{ display: none !important; \}/.test(css));
  t("CSS : aucune couleur oklch / color-mix dans la présentation (pas de bloc de secours à régénérer)", !/\.pres[^\n]*(oklch|color-mix)/.test(css));
};
