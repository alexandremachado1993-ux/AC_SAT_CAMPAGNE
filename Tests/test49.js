/* Économie de crédits Netlify : une publication coûte des crédits ; un envoi qui ne touche que les tests, la base de données ou la documentation
   ne doit PAS publier le site. La règle (build.ignore de netlify.toml) est exécutée pour de vrai dans un dépôt Git temporaire. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
module.exports = async function ({ t }) {
  const racine = path.join(__dirname, "..");
  const toml = fs.readFileSync(path.join(racine, "netlify.toml"), "utf8");
  const brut = (toml.match(/^\s*ignore = "(.*)"\s*$/m) || [])[1];
  t("crédits Netlify : une règle « ignore » existe dans la section [build]", !!brut && /\[build\][\s\S]*ignore = /.test(toml));
  const commande = (brut || "").replace(/\\"/g, '"');
  t("crédits Netlify : les variables sont entre guillemets (sans cela, une référence vide fait conclure « rien n'a changé » et le site ne serait JAMAIS publié)", /"\$CACHED_COMMIT_REF"/.test(commande) && /"\$COMMIT_REF"/.test(commande));
  t("crédits Netlify : seuls Tests, supabase, .github, README, .editorconfig et .gitignore sont exclus ; le code du site, les pages et netlify.toml ne le sont pas", /':!Tests'/.test(commande) && /':!supabase'/.test(commande) && /':!\.github'/.test(commande) && !/':!Js'|':!CSS'|':!netlify\.toml'|':!sw\.js'|':!version/.test(commande));

  const git = spawnSync("git", ["--version"]);
  if (git.status !== 0) { t("crédits Netlify : git indisponible sur cette machine, essais de la règle ignorés (ils tournent en intégration continue)", true); return; }
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "acsc-ignore-"));
  const g = (...a) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t"].concat(a), { cwd: dossier, encoding: "utf8" });
  const ecrire = (f, s) => { fs.mkdirSync(path.dirname(path.join(dossier, f)), { recursive: true }); fs.writeFileSync(path.join(dossier, f), s); };
  g("init", "-q");
  ["Index.html", "Js/App.js", "CSS/s.css", "sw.js", "Tests/t.js", "README.md", "netlify.toml", "version.txt", "supabase/m.sql", ".github/w.yml"].forEach(f => ecrire(f, "a"));
  g("add", "-A"); g("commit", "-qm", "base");
  const base = g("rev-parse", "HEAD").stdout.trim();
  const code = (fichiers, refPrecedente) => {
    fichiers.forEach(f => ecrire(f, "modif " + Math.random()));
    g("add", "-A"); g("commit", "-qm", "essai");
    const env = Object.assign({}, process.env, { COMMIT_REF: g("rev-parse", "HEAD").stdout.trim() });
    delete env.CACHED_COMMIT_REF;
    if (refPrecedente !== "absente") env.CACHED_COMMIT_REF = refPrecedente === undefined ? base : refPrecedente;
    const r = spawnSync("sh", ["-c", commande], { cwd: dossier, env });
    g("reset", "-q", "--hard", base);
    return r.status;
  };
  t("crédits Netlify : un envoi limité aux tests ne publie PAS (code 0 = « construction ignorée »)", code(["Tests/t.js"]) === 0);
  t("crédits Netlify : un envoi limité à supabase, .github et README ne publie PAS", code(["supabase/m.sql", ".github/w.yml", "README.md"]) === 0);
  t("crédits Netlify : un changement du code, du style, d'une page, du service worker, de la version ou de netlify.toml PUBLIE", [["Js/App.js"], ["CSS/s.css"], ["Index.html"], ["sw.js"], ["version.txt"], ["netlify.toml"]].every(f => code(f) !== 0));
  t("crédits Netlify : un envoi qui mélange tests ET code du site PUBLIE", code(["Tests/t.js", "Js/App.js"]) !== 0);
  t("crédits Netlify : dans le doute (référence précédente vide, absente ou inconnue de git), on PUBLIE plutôt que de bloquer en silence", [code(["Tests/t.js"], ""), code(["Tests/t.js"], "absente"), code(["Tests/t.js"], "0".repeat(40))].every(c => c !== 0));
  fs.rmSync(dossier, { recursive: true, force: true });
};
