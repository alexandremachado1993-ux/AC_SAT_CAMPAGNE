/* Placement des fichiers de configuration « à point ». L'envoi par navigateur ne les accepte pas (on les crée à la main) et GitHub crée un nouveau
   fichier dans le dossier où l'on se TROUVE : un .editorconfig créé depuis .github/workflows/ y reste, sans effet sur le projet (arrivé deux fois). */
const fs = require("fs");
const path = require("path");
module.exports = async function ({ t }) {
  const racine = path.join(__dirname, "..");
  const lister = (dossier, acc) => {
    fs.readdirSync(dossier, { withFileTypes: true }).forEach(e => {
      if (e.name === "node_modules" || e.name === ".git") return;
      const p = path.join(dossier, e.name);
      if (e.isDirectory()) lister(p, acc); else acc.push(path.relative(racine, p).split(path.sep).join("/"));
    });
    return acc;
  };
  const tous = lister(racine, []);
  const ou = (nom) => tous.filter(f => f === nom || f.endsWith("/" + nom));
  t("configuration : un seul .editorconfig, à la RACINE du dépôt (une copie dans un sous-dossier ne règle rien : elle trahit une création au mauvais endroit)", JSON.stringify(ou(".editorconfig")) === JSON.stringify([".editorconfig"]));
  t("configuration : un seul .gitignore, à la racine", JSON.stringify(ou(".gitignore")) === JSON.stringify([".gitignore"]));
  t("configuration : le dossier .github ne contient QUE workflows/tests.yml", JSON.stringify(tous.filter(f => f.startsWith(".github/"))) === JSON.stringify([".github/workflows/tests.yml"]));
};
