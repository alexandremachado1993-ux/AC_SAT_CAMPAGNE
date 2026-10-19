/* =============================================================
   maj-version.js — Régénère version.txt et version.json

   Source de vérité : AppLayout.VERSION (Js/AppLayout.js) et la nouveauté la plus
   récente de Nouveautes.LISTE (Js/Nouveautes.js). L'application compare ces deux
   fichiers publiés à sa propre version pour PROPOSER la mise à jour, en annonçant
   ce qu'elle apporte avant même de l'installer.

   version.json porte AUSSI la liste des fichiers de la version (chemin + taille en octets) : c'est elle que l'application télécharge, avec
   une barre de progression, quand l'utilisateur valide la mise à jour (sw.js n'a plus de liste : il ne change plus à chaque version).
   « obligatoire » : à passer à true pour une version qui change le FORMAT des données (la mise à jour ne peut plus être reportée).

   À lancer à chaque livraison (après avoir changé la version) :   node Tests/maj-version.js
   Le test Tests/test33.js échoue si les fichiers ne correspondent pas aux sources.
   ============================================================= */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const racine = path.join(__dirname, "..");
const OBLIGATOIRE = false;

function attendu() {
  const app = fs.readFileSync(path.join(racine, "Js", "AppLayout.js"), "utf8");
  const version = /const VERSION = "([^"]+)"/.exec(app)[1];
  const ctx = { AppLayout: { escapeHtml: (x) => x }, Donnees: {}, location: {}, document: {}, localStorage: {}, sessionStorage: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(racine, "Js", "Nouveautes.js"), "utf8") + "\n__N = Nouveautes;", ctx);
  const premiere = ctx.__N.LISTE[0];
  const n = premiere && premiere.version === version ? premiere : null;      // annoncée avec CETTE version seulement : sinon on ne ressert pas une ancienne nouveauté
  const m = /^(\d{4})\.(\d{2})\.(\d{2})-[a-z]$/.exec(version);
  const fichiers = listePrechargement().map(u => ({ u, t: fs.statSync(path.join(racine, u)).size }));
  const json = { version, date: m ? m[1] + "-" + m[2] + "-" + m[3] : "", nouveaute: n ? { id: n.id, titre: n.titre, resume: n.resume.slice(0, 300) } : null, obligatoire: OBLIGATOIRE, fichiers };
  return { txt: version + "\n", json: JSON.stringify(json, null, 2) + "\n" };
}

/* Liste des fichiers de la version (installation et mise à jour : l'application s'ouvre complète hors ligne). Régénérée à partir des
   fichiers réels : un fichier ajouté au projet et oublié dans cette liste ne s'ouvrirait pas hors ligne (test42.js le vérifie). */
function listePrechargement() {
  const dossier = (d, ext) => fs.readdirSync(path.join(racine, d)).filter(f => ext.test(f)).sort().map(f => d + "/" + f);
  const pages = fs.readdirSync(racine).filter(f => /\.html$/.test(f) && f !== "404.html").sort();
  const vendor = fs.readdirSync(path.join(racine, "Vendor")).sort().map(d => dossier("Vendor/" + d, /\.js$/)).reduce((x, y) => x.concat(y), []);
  return [].concat(pages, ["manifest.webmanifest"], dossier("CSS", /\.css$/), dossier("Js", /\.js$/), vendor, dossier("Polices", /\.woff2$/), ["Images/logo.png", "Images/icone-192.png", "Images/icone-512.png", "Images/apple-touch-icon.png"]);
}

if (require.main === module) {
  const a = attendu();
  fs.writeFileSync(path.join(racine, "version.txt"), a.txt);
  fs.writeFileSync(path.join(racine, "version.json"), a.json);
  console.log("version.txt et version.json écrits : " + a.txt.trim());
  console.log("version.json : " + listePrechargement().length + " fichiers listés (avec leur taille)");
}
module.exports = { attendu, listePrechargement };
