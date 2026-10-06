const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t, P, fs }) {
  const w = page("Client.html");
  const D = w.Donnees;
  const c = D.ajouterClient({ nom: "Castelmoron", ville: "Castelmoron-sur-Lot", debutCampagne: 1, finCampagne: 12 });
  const l3 = D.enregistrerLigne(c.id, { nom: "Ligne 3", formatHabituel: "1/2M", produitHabituel: "Maïs" });
  const l4 = D.enregistrerLigne(c.id, { nom: "Ligne 4" });
  const wf = page("Client.html", w.localStorage.getItem("acsc_donnees_v1"), "?id=" + c.id);
  const q = (s) => wf.document.querySelector(s);

  // ---- outillage
  q('[data-modifier-ligne="' + l3.id + '"]').click();
  const sel = q("#fo-molette1-f");
  t("outillage : 3 outils", wf.document.querySelectorAll("[data-outil]").length === 3);
  t("fournisseurs d'office + Autre", [...sel.options].map(o => o.textContent).join("|") === "—|Guylegall|IMETA|➕ Autre…");
  t("n° de série marqué facultatif", wf.document.querySelector('label[for="fl-serie"]').textContent.includes("facultatif"));
  sel.value = "IMETA"; q("#fo-molette1-r").value = "P259M";
  q("#fo-molette2-f").value = "IMETA"; q("#fo-molette2-r").value = "P259";
  const sm = q("#fo-mandrin-f"); sm.value = "__autre__"; sm.dispatchEvent(new wf.Event("change"));
  t("Autre → champ libre visible", !q("#fo-mandrin-autre").hidden);
  q("#form-ligne").dispatchEvent(new wf.Event("submit", { cancelable: true }));
  t("Autre vide refusé", q("[data-erreur]").textContent.includes("Mandrin"));
  q("#fo-mandrin-autre").value = "Le Guyader"; q("#fo-mandrin-r").value = "48135";
  q("#form-ligne").dispatchEvent(new wf.Event("submit", { cancelable: true }));
  const L = wf.Donnees.getLigne(l3.id);
  t("outillage enregistré", L.molette1Fournisseur === "IMETA" && L.molette1Ref === "P259M" && L.mandrinFournisseur === "Le Guyader" && L.mandrinRef === "48135");
  t("format conservé", L.formatHabituel === "1/2M");
  t("outillage affiché sur la fiche", wf.document.querySelector(".carte-ligne-outillage").textContent.includes("Molette 1 : IMETA P259M"));
  t("nouveau fournisseur appris", wf.Donnees.fournisseursOutillage().indexOf("Le Guyader") !== -1);
  q('[data-modifier-ligne="' + l3.id + '"]').click();
  t("fournisseur saisi présélectionné", q("#fo-mandrin-f").value === "Le Guyader");
  wf.AppLayout.fermerFeuille();

  // ---- planifier depuis une ligne
  q('[data-planifier="' + l3.id + '"]').click();
  t("RDV : formulaire", !!q("#form-rdv"));
  t("RDV : ligne pré-cochée seule", q('[data-ligne="' + l3.id + '"]').checked && !q('[data-ligne="' + l4.id + '"]').checked);
  q("#fr-date").value = "2020-01-01";
  q("#form-rdv").dispatchEvent(new wf.Event("submit", { cancelable: true }));
  t("RDV : date passée refusée", q("[data-erreur]").textContent.includes("passée"));
  const dans3 = wf.Donnees.ajouterJours(wf.Donnees.aujourdhuiIso(), 3);
  q("#fr-date").value = dans3; q("#fr-heure").value = "08:30"; q("#fr-notes").value = "Prévenir M. Dupont";
  q("#form-rdv").dispatchEvent(new wf.Event("submit", { cancelable: true }));
  const rdvs = wf.Donnees.rdvDuClient(c.id);
  t("RDV enregistré", rdvs.length === 1 && rdvs[0].heure === "08:30" && rdvs[0].ligneIds.join() === l3.id);
  t("RDV affiché sur la fiche", !!wf.document.querySelector(".ligne-rdv") && wf.document.body.textContent.includes("Prévenir M. Dupont"));
  t("RDV futur : pas de bouton Faite", !wf.document.querySelector("[data-rdv-faite]"));
  // modifier
  q("[data-rdv-modifier]").click();
  t("modifier : valeurs reprises", q("#fr-heure").value === "08:30" && q("#fr-date").value === dans3);
  q('[data-ligne="' + l4.id + '"]').checked = true;
  q("#form-rdv").dispatchEvent(new wf.Event("submit", { cancelable: true }));
  t("modifier : même RDV, 2 lignes", wf.Donnees.listerRdv().length === 1 && wf.Donnees.listerRdv()[0].ligneIds.length === 2);

  // ---- RDV aujourd'hui → Faite
  const auj = wf.Donnees.aujourdhuiIso();
  const r2 = wf.Donnees.enregistrerRdv({ clientId: c.id, date: auj, ligneIds: [l3.id, l4.id], type: "campagne" });
  const bF = q('[data-rdv-faite="' + r2.id + '"]');
  t("RDV du jour : bouton Faite", !!bF);
  bF.click();
  t("réalisation : une fiche par ligne", wf.document.querySelectorAll("[data-bloc-ligne]").length === 2);
  t("réalisation : format prérempli", q("#fx-f-" + l3.id).value === "1/2M");
  q('[data-ligne-vue="' + l4.id + '"]').checked = false;
  q("#fx-r-" + l3.id).value = "Molettes OK";
  q("#form-realiser").dispatchEvent(new wf.Event("submit", { cancelable: true }));
  t("réalisation : 1 visite créée, RDV clôturé", wf.Donnees.listerVisites().length === 1 && wf.Donnees.listerVisites()[0].remarques === "Molettes OK" && !wf.Donnees.getRdv(r2.id));
  t("échéance mise à jour", wf.Donnees.calculerEcheances().lignes.find(e => e.ligne.id === l3.id).statut === "ok");
  // supprimer
  q("[data-rdv-supprimer]").click();
  t("RDV annulé", wf.Donnees.listerRdv().length === 0);

  // ---- tableau de bord
  const r3 = wf.Donnees.enregistrerRdv({ clientId: c.id, date: dans3, ligneIds: [l3.id] });
  wf.Donnees.enregistrerRdv({ clientId: c.id, date: wf.Donnees.ajouterJours(auj, 40), ligneIds: [] });
  const stock = wf.localStorage.getItem("acsc_donnees_v1");
  const wd = page("Index.html", stock);
  t("tableau : section RDV (14 j)", wd.document.querySelectorAll(".ligne-rdv").length === 1);
  t("tableau : RDV plus lointain signalé", wd.document.body.textContent.includes("1 rendez-vous plus tard"));
  t("FAB : Planifier", (() => { wd.document.querySelector(".fab-bouton").click(); return !!wd.document.querySelector('[data-action="rdv"]'); })());
  wd.document.querySelector('[data-action="rdv"]').click();
  t("FAB → formulaire RDV", !!wd.document.getElementById("form-rdv"));

  // ---- planning
  const wp = page("Planning.html", stock); wp.document.querySelector('[data-vue="mois"]').click();
  const rang = [...wp.document.querySelectorAll(".pl-rangee--client")].find(r => r.textContent.includes("Castelmoron"));
  t("planning : marqueur RDV", rang.querySelectorAll(".pl-rdv").length >= 1);
  const cellRdv = [...rang.querySelectorAll(".pl-cellule")].find(td => td.querySelector(".pl-rdv"));
  cellRdv.click();
  t("planning : détail avec RDV", !!wp.document.querySelector(".feuille .ligne-rdv"));
  let cr = null;
  wp.Excel.telechargerXlsx = (n, f) => { cr = f; };
  wp.AppLayout.fermerFeuille();
  wp.document.querySelector("[data-exporter]").click();
  wp.document.querySelector('[data-cr="xlsx"]').click();
  t("compte rendu : onglet RDV", cr && cr[4].nom === "Rendez-vous prévus" && cr[4].lignes.length >= 1);

  // ---- cascades
  wf.Donnees.supprimerLigne(l3.id);
  t("suppression ligne retirée du RDV", wf.Donnees.getRdv(r3.id).ligneIds.length === 0);
  wf.Donnees.supprimerClients([c.id]);
  t("suppression client → RDV supprimés", wf.Donnees.listerRdv().length === 0);

  // ---- Excel : outillage aller-retour + modèle
  const we = page("Clients.html");
  const De = we.Donnees;
  const cc = De.ajouterClient({ nom: "X", ville: "Y" });
  De.enregistrerLigne(cc.id, { nom: "L", molette1Fournisseur: "IMETA", molette1Ref: "P1", mandrinFournisseur: "Guylegall", mandrinRef: "M9" });
  const plan = we.EchangesExcel.analyser(we.Excel.lire(we.Excel.ecrire(we.EchangesExcel.lignesExport()).buffer));
  t("export/import outillage", plan.lignes[0].source.molette1Ref === "P1" && plan.lignes[0].source.mandrinFournisseur === "Guylegall" && plan.erreurs.length === 0);
  const b = fs.readFileSync(P + "Modeles/Modele_Import_Visites_Campagne.xlsx");
  const pm = we.EchangesExcel.analyser(we.Excel.lire(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)));
  t("nouveau modèle : exemples ignorés, pas d'erreur", pm.exemples === 3 && pm.erreurs.length === 0);
  const entetes = we.Excel.lire(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)).Lignes[0];
  t("modèle = colonnes de l'export", JSON.stringify(entetes) === JSON.stringify(we.EchangesExcel.lignesExport()[2].colonnes.map(c => c.titre)));

  // ---- sauvegarde JSON avec RDV
  const wj = page("Index.html");
  const cj = wj.Donnees.ajouterClient({ nom: "J", ville: "K" });
  wj.Donnees.enregistrerRdv({ clientId: cj.id, date: "2030-01-01" });
  const js = wj.Donnees.exporter();
  wj.Donnees.importer(JSON.stringify({ clients: [], contacts: [], lignes: [], visites: [] }));
  t("restauration sans rdv : collection vide sûre", wj.Donnees.listerRdv().length === 0);
  wj.Donnees.importer(js);
  t("restauration : RDV rétabli", wj.Donnees.listerRdv().length === 1);
};
