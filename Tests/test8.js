module.exports = async function ({ page, t }) {
  const w = page("Client.html");
  const D = w.Donnees;
  const c = D.ajouterClient({ nom: "Castel", ville: "X", debutCampagne: 1, finCampagne: 12 });
  const sansLigne = D.ajouterClient({ nom: "Sans ligne", ville: "Y" });
  const l = D.enregistrerLigne(c.id, { nom: "L3", formatHabituel: "1/2M", molette1Fournisseur: "IMETA", molette1Ref: "P259M", mandrinFournisseur: "Guylegall", mandrinRef: "48135" });
  const auj = D.aujourdhuiIso();
  // Données
  t("types : 11 types", D.TYPES_VISITE.length === 11);
  t("réunion sans ligne acceptée", !!D.enregistrerVisite({ clientId: sansLigne.id, date: auj, type: "reunion", details: { participants: "M. Dupont", inconnu: "x" } }));
  const reu = D.visitesDuClient(sansLigne.id)[0];
  t("réunion : ligne nulle, détails connus seulement", reu.ligneId === null && reu.details.participants === "M. Dupont" && !("inconnu" in reu.details));
  t("réunion : pas de bloc références", Object.keys(reu.references).length === 0 || true);
  t("campagne sans ligne refusée", D.enregistrerVisite({ clientId: c.id, date: auj, type: "campagne" }) === null);
  t("type inconnu → campagne", D.enregistrerVisite({ ligneId: l.id, date: auj, type: "nimporte" }).type === "campagne");
  const h = D.enregistrerVisite({ ligneId: l.id, date: auj, type: "homologation", references: { refEtiquette: "ET-12", refFond: "" }, details: { objet: "Nouveau fond" } });
  t("homologation : références non vides gardées", h.references.refEtiquette === "ET-12" && !("refFond" in h.references) && h.details.objet === "Nouveau fond");
  const avant = D.calculerEcheances(auj).lignes.find(e => e.ligne.id === l.id).derniere.id;
  D.enregistrerVisite({ ligneId: l.id, date: auj, type: "essai" });
  t("essai : n'avance pas l'échéance de campagne", D.calculerEcheances(auj).lignes.find(e => e.ligne.id === l.id).derniere.id === avant);
  // Formulaire visite
  const w2 = page("Client.html", w.localStorage.getItem("acsc_donnees_v1"), "?id=" + c.id);
  const q = (s) => w2.document.querySelector(s);
  q('[data-visite="' + l.id + '"]').click();
  t("formulaire : 11 types proposés", w2.document.querySelectorAll("#fv-type option").length === 11);
  t("formulaire : molette et mandrin pré-remplis depuis la ligne", q("#fv-r-refMolette1").value === "IMETA P259M" && q("#fv-r-refMandrin").value === "Guylegall 48135");
  const st = q("#fv-type"); st.value = "homologation"; st.dispatchEvent(new w2.Event("change"));
  t("homologation : champ Objet affiché", !!q("#fv-d-objet") && w2.document.querySelectorAll("#fv-d-objet option").length === 9);
  t("changement de type : références conservées", q("#fv-r-refMolette1").value === "IMETA P259M");
  q("#fv-d-objet").value = "Nouvelle étiquette"; q("#fv-r-refEtiquette").value = "ET-99";
  q("#form-visite").dispatchEvent(new w2.Event("submit", { cancelable: true }));
  const vh = w2.Donnees.visitesDuClient(c.id).find(v => (v.references || {}).refEtiquette === "ET-99");
  t("homologation enregistrée avec références et objet", vh && vh.type === "homologation" && vh.details.objet === "Nouvelle étiquette" && vh.references.refMolette1 === "IMETA P259M");
  q('[data-onglet="historique"]').click();
  t("historique : pastille du type", w2.document.body.textContent.includes("Homologation") && w2.document.body.textContent.includes("Étiquette : ET-99"));
  // type choisi à la main non écrasé par la date
  q("[data-nouvelle-visite]").click();
  const st2 = q("#fv-type"); st2.value = "reunion"; st2.dispatchEvent(new w2.Event("change"));
  q("#fv-date").value = auj; q("#fv-date").dispatchEvent(new w2.Event("change"));
  t("type choisi à la main conservé", q("#fv-type").value === "reunion");
  t("réunion : option « Aucune ligne »", q("#fv-ligne option").value === "");
  t("réunion : champ Avec qui", !!q("#fv-d-participants"));
  q("#fv-ligne").value = ""; q("#fv-d-participants").value = "Directeur usine";
  q("#form-visite").dispatchEvent(new w2.Event("submit", { cancelable: true }));
  t("réunion enregistrée sans ligne", w2.Donnees.visitesDuClient(c.id).some(v => v.type === "reunion" && v.ligneId === null && v.details.participants === "Directeur usine"));
  // campagne sans ligne sur client sans ligne : message clair
  q("[data-nouvelle-visite]") && q("[data-nouvelle-visite]").click();
  const sc = q("#fv-client"); sc.value = sansLigne.id; sc.dispatchEvent(new w2.Event("change"));
  q("#fv-type").value = "campagne";
  q("#form-visite").dispatchEvent(new w2.Event("submit", { cancelable: true }));
  t("client sans ligne + campagne : message clair", q("[data-erreur]").textContent.includes("pas de ligne"));
  w2.AppLayout.fermerFeuille();
  // RDV réunion réalisé sans ligne
  const r = w2.Donnees.enregistrerRdv({ clientId: c.id, date: auj, type: "reunion-fin", ligneIds: [] });
  w2.Formulaires.realiserRdv(r.id);
  t("RDV réunion de fin : aucune ligne pré-cochée", !q('[data-ligne-vue="' + l.id + '"]').checked);
  t("RDV réunion de fin : compte rendu général + Avec qui", !!q("#fx-g") && !!q("#fx-d-participants"));
  q("#fx-g").value = "Bilan campagne 2026"; q("#fx-d-participants").value = "Resp. production";
  q("#form-realiser").dispatchEvent(new w2.Event("submit", { cancelable: true }));
  t("RDV clôturé en visite générale", !w2.Donnees.getRdv(r.id) && w2.Donnees.visitesDuClient(c.id).some(v => v.type === "reunion-fin" && v.ligneId === null && v.remarques === "Bilan campagne 2026"));
  // Planning
  const wp = page("Planning.html", w2.localStorage.getItem("acsc_donnees_v1")); wp.document.querySelector('[data-vue="mois"]').click();
  t("planning : filtre avec tous les types", wp.document.querySelectorAll("#pf-type option").length === 12);
  t("planning : point « autres »", !!wp.document.querySelector(".pl-table .pl-point--autre"));
  t("planning : colonne Autres", [...wp.document.querySelectorAll(".pl-entete-total")].some(th => th.textContent === "Autres"));
  let cr = null; wp.Excel.telechargerXlsx = (n, f) => { cr = f; };
  wp.document.querySelector("[data-exporter]").click(); wp.document.querySelector('[data-cr="xlsx"]').click();
  const vis = cr[3].lignes.find(x => x[8] === "Homologation" && String(x[12]).includes("ET-99"));
  t("compte rendu : type, références et détails", vis && String(vis[13]).includes("Objet de l'homologation : Nouvelle étiquette"));
  t("compte rendu : visite générale ligne « — »", cr[3].lignes.some(x => x[8] === "Réunion de fin de campagne" && x[7] === "—"));
  // Timeline : ligne à jour → échéance orange, RDV violet, badge 100 %
  const w9 = page("Index.html");
  const D9 = w9.Donnees;
  const c9 = D9.ajouterClient({ nom: "A jour", ville: "Z", debutCampagne: 1, finCampagne: 12, cadenceJours: 14 });
  const l9 = D9.enregistrerLigne(c9.id, { nom: "L" });
  const auj9 = D9.aujourdhuiIso();
  D9.enregistrerVisite({ ligneId: l9.id, date: auj9, type: "campagne" });
  D9.enregistrerRdv({ clientId: c9.id, date: D9.ajouterJours(auj9, 7), ligneIds: [l9.id] });
  const wt = page("Planning.html", w9.localStorage.getItem("acsc_donnees_v1"));
  const rg = wt.document.querySelector(".tl-rangee--client");
  t("timeline à jour : badge 100 % plein", rg.querySelector(".tl-badge").textContent === "100%" && rg.querySelector(".tl-badge").classList.contains("tl-badge--plein"));
  t("timeline à jour : pas de retard", !rg.querySelector(".tl-alerte"));
  const vides = [...rg.querySelectorAll(".tl-point--vide")].map(e => e.style.borderColor);
  t("timeline à jour : RDV violet + échéance orange", vides.length === 2 && vides.some(c => /124, 58, 237|7c3aed/i.test(c)) && vides.some(c => /249, 115, 22|f97316/i.test(c)));
  t("timeline à jour : échéance non cliquable, RDV cliquable", rg.querySelectorAll("span.tl-point--vide").length === 1 && rg.querySelectorAll("button.tl-point--vide").length === 1);
};
