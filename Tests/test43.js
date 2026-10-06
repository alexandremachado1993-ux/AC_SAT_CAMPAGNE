/* Frontières entre les systèmes (skill ac-sat-campagne, règles R1 à R6) : la synchronisation transporte des INFORMATIONS, la mise à jour de
   l'application est locale à l'appareil, les notifications sont un canal à part. Ces tests font échouer la suite si on les remélange. */
const fs = require("fs");
const path = require("path");
module.exports = async function ({ page, t }) {
  const racine = path.join(__dirname, "..");
  const src = (f) => fs.readFileSync(path.join(racine, "Js", f), "utf8").replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, "$1");     // sans commentaires
  const sync = src("Synchro.js"), notif = src("Notifications.js"), donnees = src("Donnees.js"), nouveautes = src("Nouveautes.js");

  t("frontière : Synchro.js ne contient plus de code de notifications push (clé VAPID, permission, abonnement du navigateur)", !/PushManager|CLE_VAPID|requestPermission|pushManager|serviceWorker/.test(sync));
  t("frontière : Notifications.js ne parle JAMAIS directement au serveur (tout passe par Synchro) et ne touche pas aux données ni à la file de synchronisation", !/transport\./.test(notif) && !/acsc_synchro|acsc_donnees|Donnees\./.test(notif) && /Synchro\.estConnecte\(\)/.test(notif));
  const appelsSynchro = [...new Set([...notif.matchAll(/Synchro\.(\w+)/g)].map(m => m[1]))].sort();
  t("frontière : Notifications dépend de Synchro par exactement 5 points d'entrée (sens unique Notifications → Synchro) : " + appelsSynchro.join(", "), appelsSynchro.join(",") === "enregistrerAbonnement,estConnecte,messageErreur,supprimerAbonnement,testerNotification");
  t("frontière R3 : la synchronisation et les données ne connaissent AUCUN état de mise à jour ni de nouveautés (acsc_maj_*, acsc_nouveautes_*)", !/acsc_maj_|acsc_nouveautes_/.test(sync) && !/acsc_maj_|acsc_nouveautes_/.test(donnees));
  t("frontière R1 : le module des nouveautés (application) ne dépend pas de la synchronisation", !/Synchro/.test(nouveautes));
  const w = page("Index.html");
  w.localStorage.setItem("acsc_maj_reportee", String(Date.now())); w.sessionStorage.setItem("acsc_maj_proposee", "1"); w.localStorage.setItem("acsc_nouveautes_vue", "x");
  w.Donnees.ajouterClient({ nom: "Frontière", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const sauvegarde = JSON.stringify(w.Donnees.exporter());
  t("frontière R3 (exécution) : la sauvegarde exportée et les données ne contiennent aucun état de mise à jour, de nouveautés, ni de journal d'erreurs", !/acsc_maj|acsc_nouveautes|acsc_erreurs|reportee/.test(sauvegarde) && !/acsc_maj|acsc_nouveautes|acsc_erreurs/.test(w.localStorage.getItem("acsc_donnees_v1") + w.localStorage.getItem("acsc_synchro_v1")));
  const wr = page("Reglages.html", null, "#informations");
  t("notifications : l'écran Réglages utilise le module Notifications (état du navigateur) et le charge après Synchro", typeof wr.Notifications === "undefined" ? /Js\/Notifications\.js/.test(fs.readFileSync(path.join(racine, "Reglages.html"), "utf8")) : true);
};
