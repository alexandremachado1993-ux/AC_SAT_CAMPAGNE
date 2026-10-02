/* Statuts des visites : effectuée / reportée / non effectuée / annulée. */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t, P, fs }) {
  const path = require("path"), os = require("os"), url = require("url");
  const w0 = page("Index.html");
  const D = w0.Donnees;
  const aj = D.aujourdhuiIso(), hier = D.ajouterJours(aj, -1), dans7 = D.ajouterJours(aj, 7);
  const c = D.ajouterClient({ nom: "Statuts SA", ville: "X", debutCampagne: 1, finCampagne: 12, cadenceJours: 14 });
  const l1 = D.enregistrerLigne(c.id, { nom: "L1" }), l2 = D.enregistrerLigne(c.id, { nom: "L2" });

  // ---- règles de base
  t("4 statuts proposés, « effectuée » par défaut", D.STATUTS_VISITE.map(s => s.cle).join() === "effectuee,reportee,non-effectuee,annulee" && D.statutVisite({}) === "effectuee" && D.statutVisite({ statut: "n'importe quoi" }) === "effectuee");
  t("visite effectuée sans ligne (campagne) : toujours refusée", D.enregistrerVisite({ clientId: c.id, date: hier, type: "campagne" }) === null);
  const nonEff = D.enregistrerVisite({ clientId: c.id, date: hier, type: "campagne", statut: "non-effectuee", motif: "Client absent", format: "4/4", remarques: "Porte fermée" });
  t("visite non effectuée : acceptée sans ligne, avec motif ; format et produit non gardés", !!nonEff && nonEff.statut === "non-effectuee" && nonEff.motif === "Client absent" && nonEff.ligneId === null && nonEff.format === "");
  const repo = D.enregistrerVisite({ ligneId: l1.id, date: hier, type: "campagne", statut: "reportee", motif: "Machine en production", reporteLe: dans7 });
  t("visite reportée : nouvelle date gardée", repo.statut === "reportee" && repo.reporteLe === dans7);
  const effectuee = D.enregistrerVisite({ ligneId: l2.id, date: hier, type: "campagne" });
  t("visite effectuée : pas de champ statut stocké (anciennes données identiques)", !("statut" in effectuee));
  t("les visites normales ne renvoient QUE les effectuées", D.visitesDuClient(c.id).length === 1 && D.listerVisites().length === 1 && D.visitesDeLaLigne(l1.id).length === 0);
  t("l'historique renvoie tout", D.historiqueDuClient(c.id).length === 3);
  const ech = D.calculerEcheances(aj).lignes;
  t("une visite reportée ne compte pas comme faite : L1 reste « jamais vue », L2 est à jour", ech.find(e => e.ligne.id === l1.id).statut === "jamais" && ech.find(e => e.ligne.id === l2.id).statut !== "jamais");
  t("motifs : liste de départ + motifs déjà saisis", D.valeursConnues("motif").indexOf("Client absent") !== -1 && D.valeursConnues("motif").length >= 9);
  t("produits : liste de conserverie étendue (légumes, poissons, plats cuisinés, fruits…)", ["Maïs", "Haricots verts", "Thon", "Sardines", "Cassoulet", "Pêches", "Tomates pelées"].every(p => D.valeursConnues("produit").indexOf(p) !== -1) && D.valeursConnues("produit").length >= 40);

  // ---- clôture d'un rendez-vous sans visite
  const rdv1 = D.enregistrerRdv({ clientId: c.id, date: D.ajouterJours(aj, 2), ligneIds: [l1.id, l2.id] });
  t("reporter à une date passée : refusé", D.cloturerSansVisite(rdv1.id, { statut: "reportee", reporteLe: hier }) === null && D.getRdv(rdv1.id).date === D.ajouterJours(aj, 2));
  const avant = D.historiqueDuClient(c.id).length;
  const cr = D.cloturerSansVisite(rdv1.id, { statut: "reportee", reporteLe: dans7, motif: "Client absent" });
  t("reporter : le rendez-vous est déplacé, une ligne d'historique par ligne", cr.length === 2 && D.getRdv(rdv1.id).date === dans7 && D.historiqueDuClient(c.id).length === avant + 2 && cr.every(v => v.statut === "reportee" && v.reporteLe === dans7 && v.date === D.ajouterJours(aj, 2)));
  const cr2 = D.cloturerSansVisite(rdv1.id, { statut: "annulee", motif: "Annulée par le client", remarques: "rappeler en novembre" });
  t("annuler : le rendez-vous est retiré, trace dans l'historique", !D.getRdv(rdv1.id) && cr2.length === 2 && cr2[0].statut === "annulee" && cr2[0].remarques === "rappeler en novembre");
  const rdv2 = D.enregistrerRdv({ clientId: c.id, date: hier, type: "reunion" });
  const cr3 = D.cloturerSansVisite(rdv2.id, { statut: "non-effectuee", motif: "Accès refusé" });
  t("rendez-vous sans ligne : une seule ligne d'historique pour le client", cr3.length === 1 && cr3[0].ligneId === null && !D.getRdv(rdv2.id));
  t("statut invalide : refusé, rien ne change", D.cloturerSansVisite(D.enregistrerRdv({ clientId: c.id, date: hier }).id, { statut: "effectuee" }) === null);
  D.listerRdv().forEach(r => D.supprimerRdv(r.id));

  // ---- règle côté serveur (rappels)
  const src = fs.readFileSync(path.join(P, "supabase", "functions", "rappels", "logique.js"), "utf8");
  const tmp = path.join(os.tmpdir(), "logique-statuts-" + process.pid + ".mjs"); fs.writeFileSync(tmp, src);
  const L = await import(url.pathToFileURL(tmp).href);
  const donnees = { clients: [{ id: "c", nom: "C", debutCampagne: 1, finCampagne: 12, cadenceJours: 14 }], lignes: [{ id: "l", clientId: "c" }],
    visites: [{ ligneId: "l", type: "campagne", date: aj, statut: "reportee" }], rdv: [] };
  t("serveur : une visite reportée / non effectuée ne remet pas la ligne à jour", L.calculer(donnees, aj).aVoir === 1);
  donnees.visites = [{ ligneId: "l", type: "campagne", date: aj }];
  t("serveur : une visite effectuée (ou ancienne, sans statut) la remet à jour", L.calculer(donnees, aj).aVoir === 0);
  fs.unlinkSync(tmp);

  // ---- historique de la fiche client
  const stock = w0.localStorage.getItem("acsc_donnees_v1");
  let wf = page("Client.html", stock, "?id=" + c.id); let d = wf.document;
  const q = (s) => d.querySelector(s), qa = (s) => [...d.querySelectorAll(s)];
  q('[data-onglet="historique"]').click();
  t("historique : onglet avec le total de tous les statuts", /Historique\s*\d+/.test(q('[data-onglet="historique"]').textContent.replace(/\s+/g, " ")) && Number(q('[data-onglet="historique"] .onglet-fiche-compteur').textContent) === wf.Donnees.historiqueDuClient(c.id).length);
  t("historique : chaque visite porte sa pastille de statut", qa(".ligne-historique").length === wf.Donnees.historiqueDuClient(c.id).length && qa(".ligne-historique").every(l => /Effectuée|Reportée|Non effectuée|Annulée/.test(l.textContent)));
  t("historique : motif et nouvelle date affichés", /Motif : Client absent/.test(d.body.textContent) && new RegExp("Reportée au").test(d.body.textContent));
  const puces = qa("[data-filtre-historique]").map(b => b.getAttribute("data-filtre-historique"));
  t("historique : une puce par statut présent (+ Toutes)", puces.join() === "tous,effectuee,reportee,non-effectuee,annulee");
  q('[data-filtre-historique="reportee"]').click();
  t("filtre « Reportées » : seulement les reportées", qa(".ligne-historique").length > 0 && qa(".ligne-historique").every(l => /Reportée/.test(l.textContent)) && q('[data-filtre-historique="reportee"]').classList.contains("actif"));
  q('[data-filtre-historique="tous"]').click();
  t("filtre « Toutes » : tout revient", qa(".ligne-historique").length === wf.Donnees.historiqueDuClient(c.id).length);
  q('[data-onglet="lignes"]').click();
  const carteLigne = (nom) => qa(".carte-ligne").find(x => x.querySelector("strong") && x.querySelector("strong").textContent.trim() === nom);
  t("fiche : une ligne dont la seule visite est reportée reste « jamais visitée »", /Jamais visitée/.test(carteLigne("L1").textContent));
  t("fiche : une ligne avec une visite effectuée affiche sa date", !/Jamais visitée/.test(carteLigne("L2").textContent));

  // ---- tableau de bord : clôture à trois issues
  const w1 = page("Index.html", stock); const D1 = w1.Donnees; const d1 = w1.document;
  const pass = D1.enregistrerRdv({ clientId: c.id, date: hier, heure: "08:00", ligneIds: [l1.id] });
  const w2 = page("Index.html", w1.localStorage.getItem("acsc_donnees_v1")); const d2 = w2.document;
  const ligne = d2.querySelector(".ligne-cloture");
  t("clôture : trois réponses (Oui / Reporter / Non effectuée)", !!ligne && !!ligne.querySelector("[data-rdv-faite]") && !!ligne.querySelector("[data-rdv-reporter]") && !!ligne.querySelector("[data-rdv-non-effectuee]") && !ligne.querySelector("[data-rdv-supprimer]"));
  ligne.querySelector("[data-rdv-reporter]").click();
  t("Reporter : la fenêtre propose une nouvelle date et un motif", !!d2.getElementById("form-issue") && !!d2.getElementById("fi-date") && /Reporter la visite/.test(d2.querySelector(".feuille-titre").textContent) && d2.getElementById("fi-date").value >= D1.aujourdhuiIso());
  d2.getElementById("fi-date").value = D1.ajouterJours(D1.aujourdhuiIso(), 10);
  d2.getElementById("fi-motif").value = "Machine en production"; d2.getElementById("fi-motif").dispatchEvent(new w2.Event("change"));
  d2.getElementById("form-issue").dispatchEvent(new w2.Event("submit", { cancelable: true }));
  const r2 = w2.Donnees.getRdv(pass.id);
  t("Reporter : rendez-vous déplacé, trace « Reportée » avec motif dans l'historique", r2.date === D1.ajouterJours(D1.aujourdhuiIso(), 10) && w2.Donnees.historiqueDuClient(c.id).some(v => v.statut === "reportee" && v.motif === "Machine en production" && v.date === hier));
  t("Reporter : le rendez-vous n'est plus à clôturer", !d2.querySelector(".ligne-cloture"));
  const pass2 = w2.Donnees.enregistrerRdv({ clientId: c.id, date: hier, ligneIds: [l2.id] });
  const w3 = page("Index.html", w2.localStorage.getItem("acsc_donnees_v1")); const d3 = w3.document;
  d3.querySelector(".ligne-cloture [data-rdv-non-effectuee]").click();
  t("Non effectuée : choix « Non effectuée » (défaut) / « Annulée »", d3.querySelectorAll('input[name="fi-statut"]').length === 2 && d3.querySelector('input[name="fi-statut"]:checked').value === "non-effectuee");
  d3.querySelector('input[name="fi-statut"][value="annulee"]').checked = true;
  d3.getElementById("fi-motif").value = "Annulée par le client"; d3.getElementById("fi-motif").dispatchEvent(new w3.Event("change"));
  d3.getElementById("form-issue").dispatchEvent(new w3.Event("submit", { cancelable: true }));
  t("Annulée : rendez-vous retiré, trace « Annulée » dans l'historique", !w3.Donnees.getRdv(pass2.id) && w3.Donnees.historiqueDuClient(c.id).some(v => v.statut === "annulee" && v.motif === "Annulée par le client" && v.ligneId === l2.id));
  t("… et la visite annulée n'est PAS comptée comme faite (L2 garde sa seule visite effectuée)", w3.Donnees.visitesDeLaLigne(l2.id).length === 1 && w3.Donnees.historiqueDuClient(c.id).filter(v => v.ligneId === l2.id && v.statut === "annulee").length === 2);

  // ---- détail d'un rendez-vous
  const r3 = w3.Donnees.enregistrerRdv({ clientId: c.id, date: D1.ajouterJours(aj, 5), ligneIds: [l1.id] });
  w3.Formulaires.detailRdv(r3.id); const f = w3.document.querySelector(".feuille");
  t("détail d'un rendez-vous confirmé : Reporter, Non effectuée / annulée, et « Supprimer sans trace »", !!f.querySelector("[data-rdv-reporter]") && !!f.querySelector("[data-rdv-non-effectuee]") && /Supprimer sans trace/.test(f.querySelector("[data-rdv-supprimer]").textContent));
  w3.AppLayout.fermerFeuille();

  // ---- formulaire « Enregistrer une visite »
  const w4 = page("Client.html", w3.localStorage.getItem("acsc_donnees_v1"), "?id=" + c.id); const d4 = w4.document;
  w4.Formulaires.visite({ clientId: c.id });
  const chg = (id, v) => { const e = d4.getElementById(id); e.value = v; e.dispatchEvent(new w4.Event("change")); };
  t("formulaire de visite : champ Statut à 4 choix, « Effectuée » par défaut", d4.getElementById("fv-statut").options.length === 4 && d4.getElementById("fv-statut").value === "effectuee");
  chg("fv-statut", "non-effectuee");
  t("statut « Non effectuée » : contenu (format, produit) masqué, motif affiché, pas de date de report", d4.getElementById("fv-contenu").hidden && !d4.getElementById("fv-suite").hidden && d4.getElementById("fv-reporte-bloc").hidden);
  chg("fv-statut", "reportee");
  t("statut « Reportée » : date de report affichée", !d4.getElementById("fv-reporte-bloc").hidden);
  t("statut ≠ effectuée : la ligne devient facultative", [...d4.querySelectorAll("#fv-ligne option")].some(o => o.value === ""));
  const nb = w4.Donnees.historiqueDuClient(c.id).length;
  d4.getElementById("fv-date").value = hier; d4.getElementById("fv-motif").value = "Machine à l'arrêt"; d4.getElementById("fv-motif").dispatchEvent(new w4.Event("change"));
  d4.getElementById("fv-ligne").value = ""; d4.getElementById("fv-reporte").value = dans7;
  d4.getElementById("form-visite").dispatchEvent(new w4.Event("submit", { cancelable: true }));
  const nv = w4.Donnees.historiqueDuClient(c.id).find(v => v.motif === "Machine à l'arrêt");
  t("reportée saisie à la main : ajoutée à l'historique, sans ligne", w4.Donnees.historiqueDuClient(c.id).length === nb + 1 && nv.statut === "reportee" && nv.reporteLe === dans7 && nv.ligneId === null);
  w4.Formulaires.visite({ clientId: c.id }); chg("fv-statut", "non-effectuee");
  d4.getElementById("fv-date").value = D1.ajouterJours(aj, 3);
  d4.getElementById("form-visite").dispatchEvent(new w4.Event("submit", { cancelable: true }));
  t("statut « Non effectuée » avec une date à venir : refusé (pas de planification)", /futur/.test(d4.querySelector("[data-erreur]").textContent) && !d4.getElementById("form-rdv"));
  w4.Formulaires.visite({ visite: nv });
  t("modifier une visite non effectuée : statut et motif préremplis", d4.getElementById("fv-statut").value === "reportee" && d4.getElementById("fv-motif").value === "Machine à l'arrêt" && d4.getElementById("fv-reporte").value === dans7);
  chg("fv-statut", "effectuee"); d4.getElementById("fv-ligne").value = "";
  d4.getElementById("form-visite").dispatchEvent(new w4.Event("submit", { cancelable: true }));
  t("passer une visite en « effectuée » exige une ligne", /ligne/i.test(d4.querySelector("[data-erreur]").textContent) && w4.Donnees.getVisite(nv.id).statut === "reportee");

  // ---- compte rendu Excel et chiffres
  const wp = page("Planning.html", w4.localStorage.getItem("acsc_donnees_v1"));
  let cr4 = null; wp.Excel.telechargerXlsx = (n, fe) => { cr4 = fe; };
  wp.document.querySelector("[data-exporter]").click(); wp.document.querySelector('[data-cr="xlsx"]').click();
  const cols = cr4[3].colonnes.map(x => x.titre);
  t("compte rendu : colonnes Statut et Motif", cols.slice(-2).join() === "Statut,Motif");
  const lignes = cr4[3].lignes;
  t("compte rendu : les visites sans suite y figurent avec leur statut et leur motif", lignes.some(x => x[14] === "Reportée" && /Machine/.test(x[15])) && lignes.some(x => x[14] === "Annulée") && lignes.some(x => x[14] === "Effectuée"));
  const effectuees = wp.Donnees.listerVisites().filter(v => v.date.slice(0, 4) === aj.slice(0, 4)).length;
  const realisees = Number((wp.document.querySelector(".tl-chiffres").textContent.replace(/\s+/g, " ").match(/Visites réalisées\s*(\d+)/) || [])[1]);
  t("Planning : « Visites réalisées » ne compte que les visites effectuées (" + effectuees + ")", realisees === effectuees && wp.Donnees.historiqueDuClient(c.id).length > effectuees);
  const wr = page("Reglages.html", w4.localStorage.getItem("acsc_donnees_v1"));
  t("Réglages : « Visites enregistrées » ne compte que les effectuées", new RegExp("Visites enregistrées\\s*" + wr.Donnees.listerVisites().length + "(?!\\d)").test(wr.document.body.textContent.replace(/\s+/g, " ")));
};
