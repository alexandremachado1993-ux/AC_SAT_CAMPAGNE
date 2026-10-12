/* Outils communs aux contrôleurs automatiques (Tests/agents). Aucun accès réseau : ces contrôleurs lisent seulement les fichiers du projet. */
const fs = require("fs");
const path = require("path");

const IGNORES = new Set(["node_modules", ".git", "sortie"]);

/* Liste récursive des fichiers d'un dossier : chemins relatifs à « racine », séparés par « / », triés. */
function lister(racine, dossier) {
    const sortie = [];
    const base = dossier ? path.join(racine, dossier) : racine;
    if (!fs.existsSync(base)) return sortie;
    (function parcourir(d) {
        fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
            if (IGNORES.has(e.name)) return;
            const p = path.join(d, e.name);
            if (e.isDirectory()) parcourir(p);
            else sortie.push(path.relative(racine, p).split(path.sep).join("/"));
        });
    })(base);
    return sortie.sort();
}

const lire = (racine, relatif) => fs.readFileSync(path.join(racine, relatif), "utf8");

module.exports = { lister, lire, IGNORES };
