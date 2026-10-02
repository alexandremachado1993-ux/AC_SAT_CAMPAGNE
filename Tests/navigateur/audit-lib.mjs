import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

import { fileURLToPath } from "node:url";
export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PORT = 8123;
export const VIEWPORTS = {
  "tel-360":  { width: 360,  height: 740,  mobile: true },
  "tel-390":  { width: 390,  height: 844,  mobile: true },
  "tablette": { width: 768,  height: 1024, mobile: true },
  "pc-1280":  { width: 1280, height: 800,  mobile: false },
  "pc-1920":  { width: 1920, height: 1080, mobile: false },
};
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".xlsx": "application/octet-stream", ".txt": "text/plain" };

export function serveur() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split("?")[0]);
      const f = path.join(RACINE, u === "/" ? "Index.html" : u);
      if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("404"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(f).pipe(res);
    }).listen(PORT, () => ok(s));
  });
}

export async function navigateur() {
  const args = chromium.args.filter(a => !/single-process|no-zygote/.test(a));
  return puppeteer.launch({ args: [...args, "--no-sandbox", "--disable-dev-shm-usage"], executablePath: await chromium.executablePath(), headless: "shell" });
}

/* Données de démonstration réalistes : noms longs, tous les types, statuts, équipe. */
export function graine() {
  const D = Donnees; D.init();
  const aj = D.aujourdhuiIso(); const j = (n) => D.ajouterJours(aj, n);
  D.definirNomProfil("Alexandre Da Silva Machado");
  const mk = (nom, ville, cp, prod, tech, o) => D.ajouterClient(Object.assign({ nom, ville, codePostal: cp, typeProduction: prod, technicien: tech,
    adresse: "12 route de la Gare", telephone: "05 53 00 00 00", email: "contact.qualite@conserverie-exemple.fr", debutCampagne: 5, finCampagne: 11,
    cadenceJours: 14, notes: "Accès par l'entrée poids lourds, badge à retirer à l'accueil avant 8 h." }, o || {}));
  const c1 = mk("Conserverie du Lot-et-Garonne — Site de Castelmoron-sur-Lot", "Castelmoron-sur-Lot", "47260", "Légumes", "u1", { groupe: "Groupe Exemple" });
  const c2 = mk("Bordères", "Bordères-et-Lamensans", "40270", "Légumes", "u1");
  const c3 = mk("SICA d'Aucy", "Évreux", "27000", "Légumes", "");
  const c4 = mk("Bonduelle Nord Picardie", "Renescure", "59173", "Légumes", "u2");
  const c5 = mk("Euralis Gastronomie", "Lahontan", "64270", "Viande / plats cuisinés", "");
  const c6 = mk("Maroc Sardine", "Agadir", "", "Poisson", "u1", { pays: "Maroc", debutCampagne: 1, finCampagne: 12 });
  const c7 = mk("Saupiquet", "Quimper", "29000", "Poisson", "u2");
  const c8 = mk("Conserverie d'hiver", "Pau", "64000", "Fruits", "u1", { debutCampagne: 11, finCampagne: 3 });
  const c9 = mk("Ancien client inactif", "Tulle", "19000", "Autre", "u1", { actif: false });
  const L = (c, nom, o) => D.enregistrerLigne(c.id, Object.assign({ nom, marque: "Ferrum", modele: "F240", numeroSerie: "SN-000123", cadenceLigne: 300,
    molette1Fournisseur: "IMETA", molette1Ref: "P259M", molette2Fournisseur: "IMETA", molette2Ref: "P259", mandrinFournisseur: "Guylegall", mandrinRef: "48135",
    notes: "Molettes changées en 2025" }, o || {}));
  const l11 = L(c1, "Ligne 0/001/00/01", { formatHabituel: "4/4", produitHabituel: "Haricots verts extra-fins" });
  const l12 = L(c1, "Ligne 2", { formatHabituel: "1/2H", produitHabituel: "Maïs" });
  const l13 = L(c1, "Ligne 5", { formatHabituel: "1/4" });
  const l14 = L(c1, "Ligne 6", { formatHabituel: "3/1" });
  const l15 = L(c1, "Ligne 9", { formatHabituel: "1/2" }); D.definirStatutLigne(l15.id, "inactive");
  const l16 = L(c1, "Ligne 10", { formatHabituel: "4/4" }); D.definirStatutLigne(l16.id, "concurrent", "Concurrent SA");
  const l21 = L(c2, "Ligne 1", { formatHabituel: "1/2", produitHabituel: "Maïs" });
  const l31 = L(c3, "L1", { formatHabituel: "1/2M" }); const l32 = L(c3, "L2", { formatHabituel: "4/4" });
  const l41 = L(c4, "Ligne A", { formatHabituel: "1/4" });
  const l51 = L(c5, "Ligne 1", { formatHabituel: "1/2" });
  const l61 = L(c6, "Ligne Sardine", { formatHabituel: "1/4" });
  L(c7, "Ligne 3", { formatHabituel: "1/4" }); L(c8, "Ligne H", { formatHabituel: "1/2" });
  const K = (c, role, prenom, nom, mobile, email, principal) => D.enregistrerContact(c.id, { role, prenom, nom, mobile, telephoneFixe: "05 53 11 22 33", email, principal });
  K(c1, "Responsable sertissage", "Benoit", "Deffieux", "06.26.34.33.70", "benoit.deffieux@conserverie-exemple.fr", true);
  K(c1, "Responsable logistique", "Marie-Hélène", "Dubois-Lacroix", "06 11 22 33 44", "mh.dubois-lacroix@conserverie-exemple.fr", false);
  K(c1, "Responsable qualité", "Paul", "Martin", "", "", false);
  K(c2, "Responsable sertissage", "Jean", "Dupont", "06 00 00 00 01", "", true);
  const V = (l, n, type, extra) => D.enregistrerVisite(Object.assign({ ligneId: l.id, date: j(n), type, format: l.formatHabituel, produit: l.produitHabituel || "", remarques: "" }, extra || {}));
  V(l11, -40, "campagne", { remarques: "Réglage 2e passe légèrement resserré, épaisseur remontée à 1,13." });
  V(l11, -26, "campagne"); V(l12, -20, "campagne"); V(l21, -12, "campagne", { remarques: "RAS" }); V(l31, -3, "campagne"); V(l61, -8, "campagne");
  V(l12, -35, "maintenance", { remarques: "Changement des molettes 1re passe" });
  V(l11, -15, "homologation", { details: { objet: "Nouvelle étiquette" }, references: { refEtiquette: "ET-2026-014", refFond: "FD-73/Alu", refMolette1: "IMETA P259M" } });
  V(l12, -10, "essai", { details: { objectif: "Test nouveau mandrin", parametres: "Vitesse 280 b/min, pression plateau +2", suite: "Valider sur 3 lots" }, references: { refMandrin: "Guylegall 48135" } });
  V(l11, -5, "validation", { details: { objetValide: "Réglage 1/4", validePar: "B. Deffieux" } });
  D.enregistrerVisite({ clientId: c1.id, ligneId: null, date: j(-30), type: "reunion", remarques: "Point avant campagne", details: { participants: "Directeur usine, resp. production", sujet: "Planning des arrêts" } });
  D.enregistrerVisite({ clientId: c1.id, ligneId: null, date: j(-2), type: "formation", remarques: "Formation opérateurs", details: { sujet: "Lecture d'un relevé de serti", participants: "6 opérateurs" } });
  D.enregistrerVisite({ ligneId: l11.id, date: j(-1), type: "depannage", details: { panne: "Fuite sur roulé serré", pieces: "2 molettes" }, remarques: "Remplacement en urgence" });
  D.enregistrerVisite({ clientId: c1.id, ligneId: null, date: j(-90), type: "reunion-fin", details: { participants: "Direction" }, remarques: "Bilan campagne 2025" });
  D.enregistrerRdv({ clientId: c2.id, date: aj, heure: "06:00", type: "campagne", ligneIds: [l21.id], notes: "Prévenir le gardien" });
  D.enregistrerRdv({ clientId: c1.id, date: j(3), heure: "08:30", type: "essai", ligneIds: [l11.id, l12.id], notes: "Apporter le mandrin de rechange", references: { refEtiquette: "ET-7", refMolette1: "IMETA P259M" } });
  D.enregistrerRdv({ clientId: c3.id, date: j(7), heure: "09:00", type: "homologation", ligneIds: [l31.id], references: { refFond: "FD-73" } });
  D.enregistrerRdv({ clientId: c5.id, date: j(-4), heure: "08:00", type: "campagne", ligneIds: [l51.id] });
  D.enregistrerRdv({ clientId: c4.id, date: j(9), type: "reunion-fin" });
  D.definirTournee({ jourAuto: 0 });
  D.proposerTournee();
  return { clientId: c1.id, ligneId: l11.id, rdvId: D.listerRdv()[0].id, clients: D.listerClients().map(c => c.id) };
}
export const EQUIPE = { id: "eq1", nom: "AC SAT Sud", code: "K7PM2XQA", role: "proprietaire",
  membres: [{ id: "u1", nom: "Alexandre", role: "proprietaire", moi: true }, { id: "u2", nom: "Damien", role: "membre", moi: false }] };
