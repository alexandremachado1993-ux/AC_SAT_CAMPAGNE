/* Serveur (notification « mise à jour / nouveauté », application fermée) : logique pure annonceVersion + branchement dans la fonction « rappels ». */
const fs = require("fs");
const os = require("os");
const path = require("path");
const url = require("url");
module.exports = async function ({ t }) {
  const P = path.join(__dirname, "..", "supabase", "functions", "rappels");
  const tmp = path.join(os.tmpdir(), "logique-annonce-" + process.pid + ".mjs");
  fs.writeFileSync(tmp, fs.readFileSync(path.join(P, "logique.js"), "utf8"));
  const { annonceVersion } = await import(url.pathToFileURL(tmp).href);
  const N = { id: "x", titre: "Rapport de serti : Excel et PDF", resume: "Un rapport de tes contrôles de serti sur la période, le client et la ligne de ton choix." };
  const infos = { version: "2026.10.05-e", date: "2026-10-05", nouveaute: N };
  const midi = { date: "2026-10-05", minutes: 12 * 60 };

  let a = annonceVersion(infos, midi);
  t("annonce : version du jour avec nouveauté → « 🎁 Nouveauté : titre », résumé et invitation à installer", !!a && a.version === "2026.10.05-e" && a.charge.titre === "🎁 Nouveauté : Rapport de serti : Excel et PDF" && /^Un rapport de tes contrôles/.test(a.charge.corps) && /Ouvre l'application pour l'installer\.$/.test(a.charge.corps));
  t("annonce : ouvre Réglages › Informations, avec le même tag que la notification locale (elles se remplacent, ne s'empilent pas)", a.charge.url === "Reglages.html#informations" && a.charge.tag === "acsc-maj");
  a = annonceVersion({ version: "2026.10.05-f", date: "2026-10-05", nouveaute: null }, midi);
  t("annonce : version sans nouveauté → « ⬆️ Mise à jour disponible » avec le numéro", a.charge.titre === "⬆️ Mise à jour disponible" && a.charge.corps === "Version 2026.10.05-f : ouvre l'application pour l'installer.");
  t("annonce : résumé et titre longs coupés (≤ 60 et ≈ 110 + invitation) avec « … »", (() => { const x = annonceVersion({ version: "2026.10.05-e", nouveaute: { titre: "T".repeat(90), resume: "mot ".repeat(60) } }, midi).charge; return x.titre.length <= "🎁 Nouveauté : ".length + 60 && /…$/.test(x.titre) && x.corps.length < 160 && /… Ouvre/.test(x.corps); })());
  t("annonce : version de 3 jours encore annoncée, de 4 jours non (à la mise en service on n'envoie pas d'anciennes versions)", !!annonceVersion({ version: "2026.10.02-a" }, midi) && annonceVersion({ version: "2026.10.01-a" }, midi) === null);
  t("annonce : version datée dans le futur → rien", annonceVersion({ version: "2026.10.06-a" }, midi) === null);
  t("annonce : jamais de nuit (7 h 59 et 20 h 31 → rien ; 8 h 00 et 20 h 30 → annoncée)", annonceVersion(infos, { date: "2026-10-05", minutes: 479 }) === null && annonceVersion(infos, { date: "2026-10-05", minutes: 20 * 60 + 31 }) === null && !!annonceVersion(infos, { date: "2026-10-05", minutes: 480 }) && !!annonceVersion(infos, { date: "2026-10-05", minutes: 20 * 60 + 30 }));
  t("annonce : changement de mois et d'année géré (31 décembre → 2 janvier, 3 jours)", !!annonceVersion({ version: "2026.12.31-a" }, { date: "2027-01-02", minutes: 600 }) && annonceVersion({ version: "2026.12.31-a" }, { date: "2027-01-04", minutes: 600 }) === null);
  t("annonce : entrées invalides → rien, sans erreur (null, texte, version mal formée, sans heure)", [null, undefined, "x", {}, { version: 5 }, { version: "latest" }, { version: "2026.10.5-e" }, { version: "2026.10.05-E" }].every(i => annonceVersion(i, midi) === null) && annonceVersion(infos, null) === null && annonceVersion(infos, {}) === null);

  // Branchement dans la fonction serveur (non exécutable ici : Deno + Supabase) — on contrôle au moins que le contrat est en place.
  const idx = fs.readFileSync(path.join(P, "index.ts"), "utf8");
  t("rappels/index.ts : importe annonceVersion et lit version.json du site (SITE_URL ou adresse publiée)", /import \{[^}]*annonceVersion[^}]*\} from "\.\/logique\.js"/.test(idx) && /Deno\.env\.get\("SITE_URL"\)/.test(idx) && /https:\/\/ac-sat-campagne\.netlify\.app/.test(idx) && /\/version\.json/.test(idx));
  t("rappels/index.ts : une annonce par compte (journal « version:… »), seulement si le réglage n'est pas désactivé, puis envoi aux appareils du compte", /prevenirVersions !== false/.test(idx) && /reserver\(admin, userId, "version:" \+ annonce\.version\)/.test(idx) && /envoyer\(admin, parCompte\[userId\], annonce\.charge\)/.test(idx) && /versions: 0/.test(idx));
  t("rappels/index.ts : l'annonce n'est lue qu'APRÈS le contrôle du secret de la tâche planifiée (aucune ouverture de l'accès)", idx.indexOf('x-cron-secret') < idx.indexOf("/version.json"));
  t("le réglage « prevenirVersions » du client et celui lu par le serveur portent le même nom", /prevenirVersions/.test(fs.readFileSync(path.join(__dirname, "..", "Js", "Donnees.js"), "utf8")) && /profil\?\.tournee\?\.prevenirVersions/.test(idx));
};
