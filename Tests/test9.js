module.exports = async function ({ page, t, P, fs }) {
  const w = page("Index.html");
  const D = w.Donnees;
  const c = D.ajouterClient({ nom: "Statuts", ville: "X", debutCampagne: 1, finCampagne: 12 });
  const la = D.enregistrerLigne(c.id, { nom: "A" });
  const lb = D.enregistrerLigne(c.id, { nom: "B" });
  const lc = D.enregistrerLigne(c.id, { nom: "C" });
  t("nouvelle ligne : active par défaut", D.statutLigne(la) === "active" && la.suiviCampagne === true);
  const ancien = { suiviCampagne: false };
  t("ancienne ligne non suivie → inactive", D.statutLigne(ancien) === "inactive");
  D.definirStatutLigne(lb.id, "inactive");
  D.definirStatutLigne(lc.id, "concurrent", "Concurrent SA");
  t("statuts enregistrés", D.statutLigne(D.getLigne(lb.id)) === "inactive" && D.getLigne(lc.id).fournisseurActuel === "Concurrent SA" && D.getLigne(lc.id).suiviCampagne === false);
  const ech = D.calculerEcheances().lignes.filter(e => e.client.id === c.id);
  t("rappels : seule la ligne active", ech.length === 1 && ech[0].ligne.id === la.id);
  D.definirStatutLigne(lc.id, "active");
  t("réactivation : fournisseur actuel effacé, retour dans les rappels", D.getLigne(lc.id).fournisseurActuel === "" && D.calculerEcheances().lignes.filter(e => e.client.id === c.id).length === 2);
  D.definirStatutLigne(lc.id, "concurrent", "Concurrent SA");
  const tout = D.ajouterClient({ nom: "Tout perdu", ville: "Y", debutCampagne: 1, finCampagne: 12 });
  D.definirStatutLigne(D.enregistrerLigne(tout.id, { nom: "Z" }).id, "concurrent");
  t("client dont toutes les lignes sont chez un concurrent : pas d'alerte « sans ligne »", !D.calculerEcheances().sansLigne.some(x => x.id === tout.id));
  // Fiche client
  const wf = page("Client.html", w.localStorage.getItem("acsc_donnees_v1"), "?id=" + c.id);
  const q = (s) => wf.document.querySelector(s);
  const carteB = [...wf.document.querySelectorAll(".carte-ligne")].find(x => x.textContent.includes("B"));
  t("fiche : ligne inactive grisée, sans « Visite faite »", carteB.classList.contains("carte-ligne--inactive") && !carteB.querySelector("[data-visite]"));
  const carteC = [...wf.document.querySelectorAll(".carte-ligne")].find(x => x.querySelector(".carte-ligne-entete strong").textContent === "C");
  t("fiche : autre fournisseur affiché", carteC.textContent.includes("Autre fournisseur : Concurrent SA"));
  q('[data-statut-ligne="' + lb.id + '|active"]').click();
  t("bascule rapide : réactivation", wf.Donnees.statutLigne(wf.Donnees.getLigne(lb.id)) === "active");
  q('[data-statut-ligne="' + la.id + '|concurrent"]').click();
  t("bascule « Autre fournisseur » : formulaire avec le choix fait", !!q("#form-ligne") && q('input[name="fl-statut"][value="concurrent"]').checked && !q("#fl-bloc-fournisseur").hidden);
  // « Concurrent SA » est déjà connu : le champ est une liste ; « Autre… » ouvre la saisie libre
  t("fournisseur actuel : liste des concurrents connus + Autre…", q("#fl-fournisseur-actuel").tagName === "SELECT" && [...q("#fl-fournisseur-actuel").options].some(o => o.value === "Concurrent SA"));
  q("#fl-fournisseur-actuel").value = "__libre__"; q("#fl-fournisseur-actuel").dispatchEvent(new wf.Event("change"));
  t("Autre… : champ texte affiché", !q("#fl-fournisseur-actuel-libre").hidden);
  q("#fl-fournisseur-actuel-libre").value = "Autre SA";
  q("#form-ligne").dispatchEvent(new wf.Event("submit", { cancelable: true }));
  t("autre fournisseur enregistré depuis le formulaire", wf.Donnees.statutLigne(wf.Donnees.getLigne(la.id)) === "concurrent" && wf.Donnees.getLigne(la.id).fournisseurActuel === "Autre SA");
  // Formulaire de visite : lignes actives seulement
  q("[data-nouvelle-visite]").click();
  const opts = [...wf.document.querySelectorAll("#fv-ligne option")].map(o => o.textContent);
  t("visite : seules les lignes actives proposées", opts.join() === "B");
  wf.AppLayout.fermerFeuille();
  // Excel : aller-retour du statut
  const we = page("Clients.html", wf.localStorage.getItem("acsc_donnees_v1"));
  const exp = we.EchangesExcel.lignesExport();
  const lignesExp = exp[2].lignes.filter(r => r[0] === "Statuts");
  t("export : statut et fournisseur actuel", lignesExp.some(r => r[15] === "Autre fournisseur" && r[16] === "Autre SA" && r[14] === "Non"));
  const plan = we.EchangesExcel.analyser(we.Excel.lire(we.Excel.ecrire(exp).buffer));
  t("import : statut relu", plan.lignes.find(x => x.clientNom === "Statuts" && x.source.nom === "A").source.statut === "concurrent");
  const H = (l) => l.map(x => ({ titre: x }));
  const f2 = we.Excel.ecrire([{ nom: "Clients", colonnes: H(["Nom client *", "Ville *", "Pays *", "Début campagne (mois) *", "Fin campagne (mois) *", "Cadence visites (jours) *"]), lignes: [] },
    { nom: "Lignes", colonnes: H(["Client *", "Ligne *", "Suivi en campagne *", "Statut"]), lignes: [["Statuts", "B", "Oui", "Autre fournisseur"], ["Statuts", "C", "Non", ""], ["Statuts", "A", "Oui", "bizarre"]] }]);
  const p2 = we.EchangesExcel.analyser(we.Excel.lire(f2.buffer));
  t("import : le statut prime sur « Suivi »", p2.lignes[0].source.statut === "concurrent");
  t("import : sans statut, « Suivi » compte (ancien modèle)", p2.lignes[1].source.statut === undefined && p2.lignes[1].source.suiviCampagne === false);
  t("import : statut inconnu averti", p2.avertissements.some(a => a.includes("bizarre")));
  we.Donnees.appliquerImport(p2);
  t("import appliqué : C inactive via « Suivi = Non »", we.Donnees.statutLigne(we.Donnees.getLigne(lc.id)) === "inactive");
  const b = fs.readFileSync(P + "Modeles/Modele_Import_Visites_Campagne.xlsx");
  const ent = we.Excel.lire(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)).Lignes[0];
  t("modèle Excel = colonnes de l'export (statut inclus)", JSON.stringify(ent) === JSON.stringify(exp[2].colonnes.map(x => x.titre)));
};
