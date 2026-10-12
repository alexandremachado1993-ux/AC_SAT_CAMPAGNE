/* Historique de la base dans le dépôt (miroir exact de supabase_migrations.schema_migrations) et absence de secrets dans un dépôt PUBLIC. */
const fs = require("fs");
const path = require("path");
module.exports = async function ({ t }) {
  const racine = path.join(__dirname, "..");
  const dossier = path.join(racine, "supabase/migrations");
  const tous = fs.readdirSync(dossier);
  const fichiers = tous.filter(f => f.endsWith(".sql")).sort();
  const HISTORIQUE = ["20260924165328_synchro_elements", "20260925163340_equipes_partage", "20260928075856_notifications_push", "20260928080154_rappels_planifies",
    "20260928092152_equipe_membres_identifiants", "20260928172312_equipe_membres_identifiant", "20261006190607_securite_anon_limite_tentatives_equipe_et_correction_rejoindre"];
  t("migrations : le dépôt contient EXACTEMENT les 7 versions de la base (sinon l'intégration GitHub de Supabase échoue : « Remote migration versions not found in local migrations directory »)", JSON.stringify(fichiers.map(f => f.replace(/\.sql$/, ""))) === JSON.stringify(HISTORIQUE));
  t("migrations : chaque fichier est nommé <14 chiffres>_<nom>.sql", fichiers.every(f => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)));
  t("migrations : aucun autre fichier dans le dossier (le CLI Supabase le signalerait)", tous.length === fichiers.length);
  t("migrations : l'ancien fichier mal nommé (version 20261006, absente de la base) n'existe plus", !fs.existsSync(path.join(dossier, "20261006_securite_equipes.sql")));
  const sql = fichiers.map(f => fs.readFileSync(path.join(dossier, f), "utf8")).join("\n");
  const valeur = (cle) => (sql.match(new RegExp("\\('" + cle + "',\\s*'([^']*)'\\)")) || [])[1];
  t("secrets : la clé PRIVÉE VAPID n'est JAMAIS dans le dépôt (public) : marqueur seulement", valeur("vapid_private") === "A_RENSEIGNER__CLE_PRIVEE_VAPID");
  t("secrets : le secret de la tâche planifiée n'est JAMAIS dans le dépôt : marqueur seulement", valeur("secret_cron") === "A_RENSEIGNER__SECRET_ALEATOIRE");
  const sansPublique = sql.split("\n").filter(l => !/'vapid_public'/.test(l)).join("\n");
  t("secrets : aucune chaîne ressemblant à une clé (base64url de 40 caractères ou plus) ni à un secret hexadécimal de 64 caractères dans les migrations", !/[A-Za-z0-9_-]{40,}/.test(sansPublique) && !/\b[0-9a-f]{64}\b/i.test(sql));
  const code = ["Js", "supabase/functions"].map(d => fs.readdirSync(path.join(racine, d)).map(f => path.join(racine, d, f)).filter(f => fs.statSync(f).isFile() || false)).reduce((a, b) => a.concat(b), []);
  t("secrets : aucune clé privée ni secret ne figure dans le code du site ni dans la fonction serveur (recherche de clés privées VAPID et de secrets hexadécimaux)", code.every(f => { const c = fs.readFileSync(f, "utf8"); return !/vapid_private['"]?\s*[:,]\s*['"][A-Za-z0-9_-]{30,}/.test(c) && !/\b[0-9a-f]{64}\b/i.test(c); }));
  t("documentation : supabase/README.md explique la règle (miroir exact, aucun secret)", fs.existsSync(path.join(racine, "supabase/README.md")) && /miroir exact/.test(fs.readFileSync(path.join(racine, "supabase/README.md"), "utf8")));
};
