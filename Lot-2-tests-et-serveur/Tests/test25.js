/* Déploiement : aucun fichier de développement publié, page 404, version cohérente. */
const fs = require("fs");
const path = require("path");
module.exports = async function ({ page, t }) {
  const racine = path.join(__dirname, "..");
  const lire = (f) => fs.readFileSync(path.join(racine, f), "utf8").replace(/\r\n/g, "\n");
  const toml = lire("netlify.toml");
  const regles = toml.split("[[redirects]]").slice(1).map(b => {
    const g = (k) => { const m = b.match(new RegExp("^\\s*" + k + "\\s*=\\s*\"?([^\"\\n]+)\"?", "m")); return m ? m[1].trim() : ""; };
    return { de: g("from"), vers: g("to"), statut: g("status"), force: g("force") };
  });
  const bloquee = (adresse) => regles.some(r => r.de === adresse && r.vers === "/404.html" && r.statut === "404" && r.force === "true");

  // page 404
  const p404 = lire("404.html");
  t("404.html : existe, non indexée, chemins absolus (servie à la place de plusieurs adresses)", /noindex/.test(p404) && /href="\/Index\.html"/.test(p404) && /src="\/Images\/logo\.png"/.test(p404) && !/(?:src|href)="(?!\/|#|https?:)/.test(p404));
  t("404.html : aucun script", !/<script/i.test(p404));

  // règle de l'accueil conservée
  t("Netlify : la racine sert toujours Index.html (statut 200)", regles.some(r => r.de === "/" && r.vers === "/Index.html" && r.statut === "200"));

  // chaque fichier de développement connu est bloqué
  ["/Tests/*", "/supabase/*", "/.github/*", "/README.md", "/netlify.toml", "/.gitignore"].forEach(a => t("Netlify : " + a + " renvoie la page 404", bloquee(a)));

  // tout script .bat de la racine est bloqué
  const bats = fs.readdirSync(racine).filter(f => /\.bat$/i.test(f));
  t("Netlify : chaque script .bat de la racine est bloqué (" + bats.join(", ") + ")", bats.length > 0 && bats.every(f => bloquee("/" + f)));

  // liste blanche : tout ce qui est à la racine est soit publié volontairement, soit bloqué
  const PUBLIE_FICHIERS = /^(Index|Client|Clients|Planning|Reglages|Documents|Tournee|Serti|404)\.html$|^(manifest\.webmanifest|sw\.js|version\.(txt|json))$/;
  const PUBLIE_DOSSIERS = ["CSS", "Js", "Images", "Media", "Documents", "Modeles", "Vendor"];
  const BLOQUE_DOSSIERS = ["Tests", "supabase", ".github"];
  const inconnus = fs.readdirSync(racine, { withFileTypes: true }).filter(e => {
    if (e.name === "node_modules" || e.name === ".git") return false;
    if (e.isDirectory()) return PUBLIE_DOSSIERS.indexOf(e.name) === -1 && !(BLOQUE_DOSSIERS.indexOf(e.name) !== -1 && bloquee("/" + e.name + "/*"));
    return !PUBLIE_FICHIERS.test(e.name) && !bloquee("/" + e.name);
  }).map(e => e.name);
  t("Déploiement : rien à la racine n'est publié sans l'avoir décidé" + (inconnus.length ? " — À BLOQUER OU AUTORISER : " + inconnus.join(", ") : ""), inconnus.length === 0);

  // version : un seul numéro dans le code et dans version.txt
  const w = page("Index.html");
  t("Version : version.txt = AppLayout.VERSION (" + w.AppLayout.VERSION + ")", lire("version.txt").trim() === w.AppLayout.VERSION && /^\d{4}\.\d{2}\.\d{2}-[a-z]$/.test(w.AppLayout.VERSION));
};
