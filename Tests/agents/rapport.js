/* « npm run audit » : exécute les contrôleurs sur le projet et affiche un rapport lisible. Code de sortie 1 s'il reste un défaut. */
const path = require("path");
const doublons = require("./doublons");
const css = require("./css");
const references = require("./references");

const racine = path.join(__dirname, "..", "..");
const d = doublons.chercher(racine, doublons.fichiersDuProjet(racine));
const c = css.analyserProjet(racine);
const r = references.manquantes(racine);

console.log("Blocs de code dupliqués (" + doublons.FENETRE + " lignes ou plus) : " + d.length);
d.forEach(x => console.log("   " + x.a.fichier + ":" + x.a.ligne + "  ≈  " + x.b.fichier + ":" + x.b.ligne));
console.log("Règles CSS identiques répétées : " + c.identiques.length);
c.identiques.forEach(x => console.log("   " + x.feuille + " " + x.selecteur + " (lignes " + x.lignes.join(", ") + ")"));
console.log("Classes CSS jamais utilisées : " + c.inutilisees.length + (c.inutilisees.length ? " → " + c.inutilisees.join(" ") : ""));
console.log("Références de fichiers cassées : " + r.length);
r.forEach(x => console.log("   " + x.source + " → " + x.reference));
process.exit(d.length + c.identiques.length + c.inutilisees.length + r.length ? 1 : 0);
