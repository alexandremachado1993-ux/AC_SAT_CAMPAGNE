/* Contrat entre les DEUX moteurs d'échéances : celui de l'application (Donnees.js) et celui de la fonction serveur (logique.js).
   Ils dupliquent la même règle ; le correctif « visites effectuées » est resté 8 jours non déployé côté serveur.
   Ce test les compare sur des jeux de données aléatoires (graine fixe) : toute divergence future fera échouer la suite. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const url = require("url");
module.exports = async function ({ page, t }) {
  const tmp = path.join(os.tmpdir(), "logique-contrat-" + process.pid + ".mjs");
  fs.writeFileSync(tmp, fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "rappels", "logique.js"), "utf8"));
  const { calculer } = await import(url.pathToFileURL(tmp).href);

  const w = page("Index.html"); const D = w.Donnees;
  let graine = 20261006; const alea = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const entier = (a, b) => a + Math.floor(alea() * (b - a + 1)), choix = (tab) => tab[entier(0, tab.length - 1)];
  const iso = (m, j) => "2026-" + String(m).padStart(2, "0") + "-" + String(j).padStart(2, "0");

  for (let i = 0; i < 24; i++) {
    const debut = choix([3, 4, 5, 5, 6, 11]), fin = choix([9, 10, 11, 11, 12, 3]);          // dont des campagnes à cheval sur deux années (11 → 3)
    const c = D.ajouterClient({ nom: "Client " + i, ville: "V" + i, debutCampagne: debut, finCampagne: fin, cadenceJours: choix([7, 14, 14, 21]) });
    if (alea() < 0.12) D.getClient(c.id).actif = false;
    for (let l = 0; l < entier(1, 3); l++) {
      const ligne = D.enregistrerLigne(c.id, { nom: "L" + (l + 1), formatHabituel: "1/2M" });
      const reel = D.getLigne(ligne.id), tirage = alea();
      if (tirage < 0.12) reel.statut = "inactive"; else if (tirage < 0.2) reel.statut = "concurrent"; else if (tirage < 0.28) { delete reel.statut; reel.suiviCampagne = false; }
      for (let v = 0; v < entier(0, 9); v++) {
        const statut = choix(["effectuee", "effectuee", "effectuee", "effectuee", "reportee", "non-effectuee", "annulee"]);
        D.enregistrerVisite(Object.assign({ clientId: c.id, ligneId: ligne.id, date: iso(entier(4, 11), entier(1, 28)), type: choix(["campagne", "campagne", "campagne", "maintenance"]) },
          statut === "effectuee" ? {} : { statut, motif: "x", reporteLe: iso(12, 10) }));
      }
    }
  }
  const donnees = D.getDonnees(); const serveur = { clients: donnees.clients, lignes: donnees.lignes, visites: donnees.visites, rdv: donnees.rdv };
  const divergences = []; let comparaisons = 0, totalARetenir = 0;
  for (let k = 0; k < 120; k++) {
    const ref = iso(entier(1, 12), entier(1, 28));
    const client = D.calculerEcheances(ref, { tous: true }).lignes.filter(e => e.statut === "retard" || e.statut === "jamais").length;
    const srv = calculer(serveur, ref).aVoir; comparaisons++; totalARetenir += srv;
    if (client !== srv) divergences.push(ref + " : application " + client + " ≠ serveur " + srv);
  }
  t("contrat moteurs : 120 dates × 24 clients aléatoires — l'application et la fonction serveur comptent les MÊMES lignes « en retard ou pas encore vues »" + (divergences.length ? " — DIVERGENCES : " + divergences.slice(0, 3).join(" | ") : ""), divergences.length === 0);
  t("contrat moteurs : le jeu de données est assez varié pour être probant (de nombreux retards, des statuts de visite et de ligne mélangés)", totalARetenir > 300 && donnees.visites.some(v => v.statut === "reportee") && donnees.lignes.some(l => l.statut === "inactive"));
};
