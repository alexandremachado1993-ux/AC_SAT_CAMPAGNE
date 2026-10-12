/* Contrôleurs automatiques (Tests/agents) : ils s'exécutent à chaque envoi (intégration continue) et bloquent toute régression :
   blocs de code recopiés, règles CSS identiques répétées, classes CSS jamais utilisées, fichiers cités mais absents.
   Chaque contrôleur est AUSSI testé sur des défauts volontairement plantés : un contrôleur qui ne détecte rien ne prouve rien. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const doublons = require("./agents/doublons");
const css = require("./agents/css");
const references = require("./agents/references");
const comparerDepots = require("./agents/comparer-depots");

module.exports = async function ({ t }) {
  const racine = path.join(__dirname, "..");
  const decrire = (l, f) => (l.length ? " — " + l.slice(0, 3).map(f).join(" ; ") : "");

  // ---------- Le projet réel
  const dup = doublons.chercher(racine, doublons.fichiersDuProjet(racine));
  t("contrôleur doublons : aucun bloc de " + doublons.FENETRE + " lignes recopié dans le code de l'application" + decrire(dup, d => d.a.fichier + ":" + d.a.ligne + " ≈ " + d.b.fichier + ":" + d.b.ligne), dup.length === 0);
  const analyse = css.analyserProjet(racine);
  t("contrôleur CSS : aucune règle identique répétée dans une même feuille" + decrire(analyse.identiques, d => d.selecteur + " l." + d.lignes.join("/")), analyse.identiques.length === 0);
  t("contrôleur CSS : aucune classe définie sans être utilisée (les classes construites par le code, comme « serti-v--ok », comptent comme utilisées)" + decrire(analyse.inutilisees, c => c), analyse.inutilisees.length === 0);
  const absentes = references.manquantes(racine);
  t("contrôleur références : tout fichier cité par une page, une feuille, un script ou le manifeste existe" + decrire(absentes, a => a.source + " → " + a.reference), absentes.length === 0);

  // ---------- Les contrôleurs détectent-ils vraiment ? Défauts plantés dans un dossier temporaire
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acsc-agents-"));
  const ecrire = (rel, contenu) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), contenu); };
  const bloc = ["const premiere = lireValeur(source);", "if (!premiere) return null;", "const seconde = calculer(premiere, 12);", "const total = seconde.reduce((a, b) => a + b, 0);", "const moyenne = total / seconde.length;", "return arrondir(moyenne, 2);", "const suite = fabriquer(moyenne);"].join("\n");
  ecrire("Js/a.js", "function un() {\n" + bloc + "\n}\n");
  ecrire("Js/b.js", "function deux() {\n" + bloc + "\n}\n");
  ecrire("Js/c.js", "function trois() {\nconst autre = 1 + 2 + 3 + 4 + 5 + 6;\nreturn autre.toFixed(2).padStart(10, \"0\");\n}\n");
  const trouves = doublons.chercher(tmp, ["Js/a.js", "Js/b.js", "Js/c.js"]);
  t("contrôleur doublons : détecte un bloc recopié entre deux fichiers, et ne signale pas un code différent", trouves.length === 1 && trouves[0].a.fichier === "Js/a.js" && trouves[0].b.fichier === "Js/b.js");
  t("contrôleur doublons : un fichier sans répétition n'est pas signalé", doublons.chercher(tmp, ["Js/a.js"]).length === 0);
  ecrire("Js/d.js", "function x() {\n" + bloc + "\n}\nfunction y() {\n" + bloc + "\n}\n");
  t("contrôleur doublons : détecte aussi un bloc recopié dans le MÊME fichier", doublons.chercher(tmp, ["Js/d.js"]).length === 1);

  const feuille = ".a { color: red; }\n.b { color: blue; }\n.a { color: red; }\n@media (min-width: 10px) { .a { color: red; } }\n.a { color: green; }";
  const ident = css.reglesIdentiques("x.css", feuille);
  t("contrôleur CSS : détecte une règle identique répétée, mais ni la même règle dans un @media, ni le même sélecteur avec d'autres déclarations", ident.length === 1 && ident[0].selecteur === ".a" && ident[0].lignes.join() === "1,3");
  const orph = css.classesInutilisees({ "x.css": ".utilisee { a: b } .orpheline { a: b } .etat--ok { a: b } .mort--ko { a: b } .a .b { c: d }" }, '<p class="utilisee b">x</p> classe = "etat--" + v', new Set(["a"]));
  t("contrôleur CSS : détecte une classe jamais utilisée, accepte une classe construite par le code (préfixe « etat-- ») et une exception déclarée", orph.join() === "mort--ko,orpheline");

  ecrire("projet/Index.html", '<link href="CSS/s.css"><img src="Images/ok.png"><img src="Images/absente.png"><script src="https://exemple.fr/x.js"></script><a href="Doc.html#ancre">x</a>');
  ecrire("projet/CSS/s.css", ".a { background: url(../Images/ok.png); } .b { background: url(../Images/fond-absent.png); }");
  ecrire("projet/Images/ok.png", "x");
  ecrire("projet/Js/m.js", 'const i = "Media/video-absente.mp4"; const j = "Images/ok.png";');
  ecrire("projet/manifest.webmanifest", JSON.stringify({ start_url: "Index.html", icons: [{ src: "Images/ok.png" }, { src: "Images/icone-absente.png" }] }));
  ecrire("projet/Doc.html", "");
  const manque = references.manquantes(path.join(tmp, "projet")).map(a => a.reference).sort();
  t("contrôleur références : détecte EXACTEMENT les 4 fichiers cités mais absents (page, feuille de style, script, manifeste) et ignore les adresses externes et les ancres : " + manque.join(" | "), manque.join("|") === "../Images/fond-absent.png|Images/absente.png|Images/icone-absente.png|Media/video-absente.mp4");

  // ---------- Contrôleur de livraison : ce que l'on envoie, supprime, renomme, crée à la main
  ecrire("depot/a.txt", "inchangé"); ecrire("depot/b.txt", "ancien"); ecrire("depot/sup.txt", "à supprimer"); ecrire("depot/dossier/vieux.txt", "contenu déplacé"); ecrire("depot/.cache-ancien", "à point supprimé");
  ecrire("nouveau/a.txt", "inchangé"); ecrire("nouveau/b.txt", "modifié"); ecrire("nouveau/neuf.txt", "neuf"); ecrire("nouveau/ailleurs/vieux.txt", "contenu déplacé"); ecrire("nouveau/.editorconfig", "à point créé");
  const diff = comparerDepots.comparer(path.join(tmp, "depot"), path.join(tmp, "nouveau"));
  t("contrôleur livraison : liste exactement les fichiers à envoyer (modifié + nouveau), à supprimer, et le fichier déplacé comme un RENOMMAGE", diff.aEnvoyer.join() === "b.txt,neuf.txt" && diff.aSupprimer.join() === "sup.txt" && diff.aRenommer.length === 1 && diff.aRenommer[0].de === "dossier/vieux.txt" && diff.aRenommer[0].vers === "ailleurs/vieux.txt");
  t("contrôleur livraison : met les fichiers « à point » à part (à créer ou supprimer À LA MAIN : le navigateur ne les envoie pas) et compte les identiques", diff.aCreerALaMain.join() === ".editorconfig" && diff.aSupprimerALaMain.join() === ".cache-ancien" && diff.identiques === 1);
  fs.rmSync(tmp, { recursive: true, force: true });
};
