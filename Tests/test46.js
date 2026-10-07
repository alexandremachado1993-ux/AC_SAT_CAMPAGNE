/* Homogénéité de l'interface : une échelle typographique unique, des composants qui se comportent pareil partout. */
const fs = require("fs");
const path = require("path");
module.exports = async function ({ page, t }) {
  const racine = path.join(__dirname, "..");
  const lire = (f) => fs.readFileSync(path.join(racine, f), "utf8");
  const style = lire("CSS/style.css"), campagne = lire("CSS/campagne.css");
  const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
  const css = sansCommentaires(style) + sansCommentaires(campagne);
  const valeurs = (prop) => [...css.matchAll(new RegExp("(?<![\\w-])" + prop + "\\s*:\\s*([^;}{]+)", "g"))].map(m => m[1].replace(/\s+/g, " ").trim());

  const tokensTexte = ["--texte-micro", "--texte-petit", "--texte-compact", "--texte-courant", "--texte-base", "--titre-s", "--titre-m", "--titre-l", "--titre-xl"];
  t("typographie : 9 tailles de texte nommées dans :root (micro, petit, compact, courant, base, titre S / M / L / XL), toutes en rem", tokensTexte.every(n => new RegExp(n + ": [0-9.]+rem;").test(style)));
  const tailles = valeurs("font-size").filter(v => !/^--/.test(v));
  const horsEchelle = [...new Set(tailles.filter(v => !/^var\(--(texte|titre)-[a-z]+\)$/.test(v) && !/^(0|16px|15px|inherit|[0-9.]+em|calc\(.*\)|clamp\(.*\)|[0-9.]+%)$/.test(v) && !/^[0-9.]+rem$/.test(v) === false))];
  const rem = [...new Set(tailles.filter(v => /^[0-9.]+rem$/.test(v)))];
  t("typographie : AUCUNE taille de texte en rem « en dur » (toutes passent par l'échelle) — c'est ce qui empêche de retomber à 26 valeurs voisines" + (rem.length ? " — " + rem.slice(0, 4).join(", ") : ""), rem.length === 0);
  t("typographie : les champs de saisie restent à 16 px minimum (sinon iOS zoome la page à la saisie)", /input[^{]*\{[^}]*font-size: (var\(--texte-base\)|16px|1rem)/.test(css) || /font-size: 16px/.test(css) || /font-size: var\(--texte-base\)/.test(css));
  const interlignes = new Set(valeurs("line-height"));
  t("interlignes : 4 valeurs au plus (1 pour les icônes, serré, courant, aéré) au lieu de 9", interlignes.size <= 4 && [...interlignes].every(v => /^(1|var\(--interligne(-serre|-aere)?\))$/.test(v) || /^[0-9.]+(px|rem)?$/.test(v)));
  const impairs = valeurs("gap").filter(v => /^(3|5|9|14|22)px$/.test(v));
  t("espacements : plus de gaps impairs ou isolés (3, 5, 9, 14, 22 px)" + (impairs.length ? " — " + impairs.join(", ") : ""), impairs.length === 0);
  const rayonsBruts = valeurs("border-radius").filter(v => /^(6|8|9|10|12|14|16|18)px$/.test(v));
  t("arrondis : les arrondis courants passent par les jetons du thème (rayon petit, moyen, grand, xl), pas par des pixels en dur" + (rayonsBruts.length ? " — " + rayonsBruts.join(", ") : ""), rayonsBruts.length === 0);

  // ---------- Composants
  t("mobile : les boutons d'en-tête (Clients, Planning, Tournée) forment une grille à 2 colonnes égales, le dernier bouton seul prend toute la largeur", /@media \(max-width: 767px\) \{[\s\S]*?\.actions-page \{ width: 100%; display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/.test(campagne) && /\.actions-page > :last-child:nth-child\(odd\) \{ grid-column: 1 \/ -1; \}/.test(campagne));
  t("mobile : l'étiquette de type d'un rendez-vous passe TOUJOURS sous le nom du client (plus de mise en page qui dépend de la longueur du nom)", /\.ligne-rdv-corps > \.ligne-rdv-client \{ display: block;/.test(campagne));
  t("mobile : un en-tête de section avec bouton ne coupe plus le bouton sur deux lignes", /\.section-entete > \.bouton \{ flex: 0 0 auto; white-space: nowrap; \}/.test(campagne) && /\.section-entete \{ flex-wrap: wrap; \}/.test(campagne));
  t("onglets : sur mobile, 2 onglets (Réglages) comme 4 (fiche client) occupent TOUTE la largeur à parts égales (plus de grille figée à 4 colonnes)", /\.onglets-fiche \{ display: grid; grid-auto-flow: column; grid-auto-columns: minmax\(0, 1fr\); overflow: visible; \}/.test(campagne) && !/\.onglet-reglages \{ flex/.test(campagne));
  t("languette ⌃ : un vrai bouton de 64 × 44 px (la zone tactile n'est plus un artifice), forme visible dans un corps intérieur", /\.nav-poignee \{[^}]*width: 64px; height: 44px;/.test(campagne) && /\.nav-poignee-corps \{[^}]*height: 26px;/.test(campagne));
  const stockUnClient = JSON.stringify({ clients: [{ id: "c1", nom: "A", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 }], lignes: [], contacts: [], visites: [], rdv: [], profil: {} });
  const wc = page("Clients.html", stockUnClient); const ph = wc.document.getElementById("champ-recherche").getAttribute("placeholder");
  t("clients : le texte d'aide du champ de recherche tient dans le champ (« " + ph + " », " + ph.length + " caractères, plus de texte coupé)", ph.length <= 26);
  const wi = page("Index.html"); const cl = wi.Donnees.ajouterClient({ nom: "A", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 }); const li = wi.Donnees.enregistrerLigne(cl.id, { nom: "L1", formatHabituel: "1/2M" }); wi.Formulaires.visite({ ligneId: li.id });
  const resume = wi.document.querySelector("#form-visite .bloc-formulaire-titre + *, #form-visite summary:nth-of-type(2)");
  const titres = [...wi.document.querySelectorAll("#form-visite summary")].map(x => x.textContent.replace(/\s+/g, " ").trim());
  t("formulaire de visite : les deux blocs facultatifs se libellent pareil (« Références (facultatif) », « Contrôle de serti (facultatif) »)", titres.some(x => /Références \(facultatif\)/.test(x)) && titres.some(x => /Contrôle de serti \(facultatif\)/.test(x)));
  const wp = page("Planning.html", stockUnClient, "#tableau");
  const enfants = wp.document.querySelector(".actions-page").children.length;
  t("planning : l'en-tête compte " + enfants + " boutons ; avec le nombre impair la règle « dernier bouton pleine largeur » s'applique, avec un nombre pair la grille est régulière", enfants >= 2);
};
