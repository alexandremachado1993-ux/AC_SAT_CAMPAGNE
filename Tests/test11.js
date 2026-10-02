module.exports = async function ({ page, t }) {
  const w = page("Index.html");
  const D = w.Donnees;
  const c = D.ajouterClient({ nom: "Bordères", ville: "X", debutCampagne: 1, finCampagne: 12 });
  const l = D.enregistrerLigne(c.id, { nom: "Ligne 1", formatHabituel: "1/2", molette1Fournisseur: "IMETA", molette1Ref: "P259M" });
  D.enregistrerContact(c.id, { role: "Responsable sertissage", nom: "Deffieux", mobile: "06 26 34 33 70", principal: true });
  const auj = D.aujourdhuiIso();
  const wf = page("Client.html", w.localStorage.getItem("acsc_donnees_v1"), "?id=" + c.id);
  const q = (s) => wf.document.querySelector(s);
  // Formulaire RDV : références seulement pour homologation / essai
  q("[data-planifier-client]").click();
  t("RDV campagne : pas de bloc Références", q("#fr-references").innerHTML === "");
  const st = q("#fr-type"); st.value = "essai"; st.dispatchEvent(new wf.Event("change"));
  t("RDV essai : bloc Références déplié", !!q("#fr-references details[open]"));
  t("RDV essai : molette pré-remplie depuis la ligne", q("#fr-r-refMolette1").value === "IMETA P259M");
  q("#fr-r-refEtiquette").value = "ET-7";
  st.value = "homologation"; st.dispatchEvent(new wf.Event("change"));
  t("changement de type : saisie conservée", q("#fr-r-refEtiquette").value === "ET-7");
  st.value = "validation"; st.dispatchEvent(new wf.Event("change"));
  t("RDV validation : pas de références à la planification", q("#fr-references").innerHTML === "");
  st.value = "essai"; st.dispatchEvent(new wf.Event("change"));
  t("retour sur essai : saisie toujours là", q("#fr-r-refEtiquette").value === "ET-7");
  q("#fr-date").value = auj;
  q("#form-rdv").dispatchEvent(new wf.Event("submit", { cancelable: true }));
  const r = wf.Donnees.listerRdv()[0];
  t("RDV enregistré avec ses références", r && r.type === "essai" && r.references.refEtiquette === "ET-7" && r.references.refMolette1 === "IMETA P259M");
  // Modification : type repris et gardé
  wf.Formulaires.rdv({ rdv: wf.Donnees.getRdv(r.id) });
  t("modifier : type Essai interne repris", q("#fr-type").value === "essai" && q("#fr-r-refEtiquette").value === "ET-7");
  q("#form-rdv").dispatchEvent(new wf.Event("submit", { cancelable: true }));
  t("modifier : reste un essai", wf.Donnees.getRdv(r.id).type === "essai");
  // Passage en campagne : références retirées
  const r2 = wf.Donnees.enregistrerRdv(Object.assign({}, wf.Donnees.getRdv(r.id), { type: "campagne" }), r.id);
  t("RDV campagne : références retirées", Object.keys(r2.references).length === 0);
  wf.Donnees.enregistrerRdv(Object.assign({}, r2, { type: "essai", references: { refEtiquette: "ET-7" } }), r.id);
  // Tableau de bord : couleur du type, clic sur la ligne
  const wd = page("Index.html", wf.localStorage.getItem("acsc_donnees_v1"));
  const ligne = wd.document.querySelector(".ligne-rdv");
  t("tableau : pastille du type en couleur", ligne.textContent.includes("Essai interne") && /a16207/i.test(ligne.querySelector(".pastille-statut").style.getPropertyValue("--c")));
  t("tableau : barre de date à la couleur du type", /161, 98, 7|a16207/i.test(ligne.querySelector(".ligne-rdv-date").style.borderLeftColor));
  t("tableau : références visibles", ligne.textContent.includes("Étiquette : ET-7"));
  ligne.querySelector(".ligne-rdv-corps").click();
  const f = wd.document.querySelector(".feuille");
  t("clic sur la ligne : détail ouvert", !f.hidden && f.textContent.includes("Bordères") && f.textContent.includes("Essai interne"));
  t("détail : contact à appeler", !!f.querySelector('a[href="tel:0626343370"]'));
  t("détail : actions Visite faite / Modifier / Annuler", !!f.querySelector("[data-rdv-faite]") && !!f.querySelector("[data-rdv-modifier]") && !!f.querySelector("[data-rdv-supprimer]"));
  f.querySelector("[data-rdv-faite]").click();
  t("depuis le détail : « Visite faite » ouvre la saisie avec les références", !!wd.document.getElementById("form-realiser") && wd.document.getElementById("fx-r-refEtiquette").value === "ET-7");
  wd.AppLayout.fermerFeuille();
  // Un bouton dans la ligne garde son action (pas d'ouverture du détail)
  wd.document.querySelector(".ligne-rdv [data-rdv-modifier]").click();
  t("bouton ✏️ : formulaire de modification, pas le détail", !!wd.document.getElementById("form-rdv"));
  wd.AppLayout.fermerFeuille();
  // Pastille de la carte client : cliquable, couleur du type
  const pastille = wd.document.querySelector("[data-rdv-pastille]");
  t("carte client : pastille « Essai interne prévu » cliquable", pastille && pastille.textContent.includes("Essai interne prévu"));
  pastille.click();
  t("pastille : ouvre le détail", !wd.document.querySelector(".feuille").hidden && !!wd.document.querySelector(".feuille [data-rdv-modifier]"));
  // Clavier
  wd.AppLayout.fermerFeuille();
  wd.document.querySelector(".ligne-rdv").dispatchEvent(new wd.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  t("clavier (Entrée) : détail ouvert", !wd.document.querySelector(".feuille").hidden);
};
