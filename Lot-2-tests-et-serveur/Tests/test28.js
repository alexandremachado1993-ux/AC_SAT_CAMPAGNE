/* Garde-fou : chaque script se compile, chaque page référence des scripts qui existent. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
module.exports = async function ({ t }) {
  const racine = path.join(__dirname, "..");
  const scripts = fs.readdirSync(path.join(racine, "Js")).filter(f => f.endsWith(".js")).map(f => "Js/" + f).concat(["sw.js"]);
  scripts.forEach(f => {
    let erreur = "";
    try { new vm.Script(fs.readFileSync(path.join(racine, f), "utf8"), { filename: f }); } catch (e) { erreur = " — " + e.message; }
    t("compilation : " + f + " est du JavaScript valide" + erreur, erreur === "");
  });
  const pages = fs.readdirSync(racine).filter(f => f.endsWith(".html") && f !== "404.html");
  pages.forEach(p => {
    const srcs = (fs.readFileSync(path.join(racine, p), "utf8").match(/<script src="([^"]+)"/g) || []).map(x => x.slice(13, -1));
    const manquants = srcs.filter(s => !fs.existsSync(path.join(racine, s)));
    t("page " + p + " : tous ses scripts existent" + (manquants.length ? " — MANQUANTS : " + manquants.join(", ") : ""), manquants.length === 0);
  });
  /* Chaque script d'application doit être chargé par au moins une page. */
  const chargés = new Set();
  pages.forEach(p => (fs.readFileSync(path.join(racine, p), "utf8").match(/Js\/[A-Za-z]+\.js/g) || []).forEach(s => chargés.add(s)));
  const orphelins = scripts.filter(s => s.startsWith("Js/") && !chargés.has(s));
  t("aucun script Js/ n'est oublié par les pages" + (orphelins.length ? " — NON CHARGÉS : " + orphelins.join(", ") : ""), orphelins.length === 0);
};
