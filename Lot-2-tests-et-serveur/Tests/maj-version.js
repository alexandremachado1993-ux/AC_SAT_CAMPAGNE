/* =============================================================
   maj-version.js — Régénère version.txt et version.json

   Source de vérité : AppLayout.VERSION (Js/AppLayout.js) et la nouveauté la plus
   récente de Nouveautes.LISTE (Js/Nouveautes.js). L'application compare ces deux
   fichiers publiés à sa propre version pour PROPOSER la mise à jour, en annonçant
   ce qu'elle apporte avant même de l'installer.

   À lancer à chaque livraison (après avoir changé la version) :   node Tests/maj-version.js
   Le test Tests/test33.js échoue si les fichiers ne correspondent pas aux sources.
   ============================================================= */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const racine = path.join(__dirname, "..");

function attendu() {
  const app = fs.readFileSync(path.join(racine, "Js", "AppLayout.js"), "utf8");
  const version = /const VERSION = "([^"]+)"/.exec(app)[1];
  const ctx = { AppLayout: { escapeHtml: (x) => x }, Donnees: {}, location: {}, document: {}, localStorage: {}, sessionStorage: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(racine, "Js", "Nouveautes.js"), "utf8") + "\n__N = Nouveautes;", ctx);
  const premiere = ctx.__N.LISTE[0];
  const n = premiere && premiere.version === version ? premiere : null;      // annoncée avec CETTE version seulement : sinon on ne ressert pas une ancienne nouveauté
  const m = /^(\d{4})\.(\d{2})\.(\d{2})-[a-z]$/.exec(version);
  const json = { version, date: m ? m[1] + "-" + m[2] + "-" + m[3] : "", nouveaute: n ? { id: n.id, titre: n.titre, resume: n.resume.slice(0, 300) } : null };
  return { txt: version + "\n", json: JSON.stringify(json, null, 2) + "\n" };
}

if (require.main === module) {
  const a = attendu();
  fs.writeFileSync(path.join(racine, "version.txt"), a.txt);
  fs.writeFileSync(path.join(racine, "version.json"), a.json);
  console.log("version.txt et version.json écrits : " + a.txt.trim());
}
module.exports = { attendu };
