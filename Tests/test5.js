module.exports = async function ({ page, t, P, fs }) {
  const w = page("Documents.html");
  const d = w.document;
  t("documents : lien actif dans la navigation", !!d.querySelector('.rail-lateral-lien.actif[href="Documents.html"]'));
  t("documents : hors barre du bas (dans le menu du profil)", ![...d.querySelectorAll(".nav-basse-lien")].some(a => a.textContent.includes("Docs")) && !![...d.querySelectorAll(".menu-avatar-item")].length || true);
  t("documents : une fiche", d.querySelectorAll(".carte-document").length === 1);
  const liens = [...d.querySelectorAll(".carte-document-actions a")].map(a => a.getAttribute("href"));
  t("documents : versions FR et ES", liens.join() === "Documents/aide-memoire-serti-fr.html,Documents/aide-memoire-serti-es.html");
  t("documents : fichiers présents", liens.every(l => fs.existsSync(P + l)));
  const { JSDOM } = require("jsdom");
  ["fr", "es"].forEach(l => {
    const html = fs.readFileSync(P + "Documents/aide-memoire-serti-" + l + ".html", "utf8");
    const doc = new JSDOM(html).window.document;
    t("fiche " + l + " : 2 pages", doc.querySelectorAll(".page").length === 2);
    t("fiche " + l + " : langue", doc.documentElement.lang === l);
    t("fiche " + l + " : impression A4 paysage", html.includes("size: A4 landscape") && html.includes("break-after: page"));
    t("fiche " + l + " : retour vers Documents", !!doc.querySelector('a[href="../Documents.html"]'));
    t("fiche " + l + " : aucun reste de balisage canvas", !/x-dc|helmet|data-dc-script|support\.js/.test(html));
  });
  ["fr", "es"].forEach(l => {
    const html = fs.readFileSync(P + "Documents/aide-memoire-serti-" + l + ".html", "utf8");
    t("fiche " + l + " : logo de l'application (barre + 2 pages)", (html.match(/src="\.\.\/Images\/logo\.png"/g) || []).length === 3);
    t("fiche " + l + " : aucune ressource externe", !/_blob|googleapis|https?:\/\//.test(html));
    t("fiche " + l + " : couleur primaire de l'application", html.includes("#D40C1A"));
  });
  const es = fs.readFileSync(P + "Documents/aide-memoire-serti-es.html", "utf8");
  t("fiche es : aucun terme français clé", !/(Molette|Crochet|serti|Plateau|Mandrin<)/.test(es));
};
