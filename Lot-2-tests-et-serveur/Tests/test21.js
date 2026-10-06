/* Date à venir dans « Enregistrer une visite » : on planifie au lieu de refuser. */
module.exports = async function ({ page, t }) {
  const w0 = page("Client.html");
  const D = w0.Donnees;
  const aj = D.aujourdhuiIso(), futur = D.ajouterJours(aj, 45);
  const c = D.ajouterClient({ nom: "Planif SA", ville: "X", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const l1 = D.enregistrerLigne(c.id, { nom: "L1" });
  D.enregistrerLigne(c.id, { nom: "L2" });
  const stock = w0.localStorage.getItem("acsc_donnees_v1");
  const ouvrir = () => { const w = page("Client.html", stock, "?id=" + c.id); w.Formulaires.visite({ ligneId: l1.id }); return w; };
  let w = ouvrir(); let d = w.document;
  const chg = (id, v) => { const e = d.getElementById(id); e.value = v; e.dispatchEvent(new w.Event("change")); };
  const bouton = () => d.querySelector("#form-visite button[type=submit]");
  t("visite : date du jour → pas de bandeau, bouton « Enregistrer la visite »", d.getElementById("fv-futur").hidden && bouton().textContent === "Enregistrer la visite");
  chg("fv-date", futur);
  t("date à venir → bandeau d'explication visible", !d.getElementById("fv-futur").hidden && /à venir/.test(d.getElementById("fv-futur").textContent));
  t("date à venir → le bouton devient « Planifier cette visite »", bouton().textContent.indexOf("Planifier cette visite") !== -1);
  chg("fv-type", "essai"); d.getElementById("fv-remarques").value = "Apporter le mandrin de rechange";
  d.getElementById("form-visite").dispatchEvent(new w.Event("submit", { cancelable: true }));
  t("envoyer : aucune visite enregistrée", w.Donnees.listerVisites().length === 0);
  t("envoyer : le formulaire de planification s'ouvre", !!d.getElementById("form-rdv") && /Planifier une visite/.test(d.querySelector(".feuille-titre").textContent));
  t("planification : client, date, type et lignes repris", d.getElementById("fr-client").value === c.id && d.getElementById("fr-date").value === futur && d.getElementById("fr-type").value === "essai" &&
    d.getElementById("fr-l-" + l1.id).checked && !d.getElementById("fr-l-" + [...d.querySelectorAll("#fr-lignes [data-ligne]")].map(x => x.getAttribute("data-ligne")).find(i => i !== l1.id)).checked);
  t("planification : remarques reprises comme notes", d.getElementById("fr-notes").value === "Apporter le mandrin de rechange");
  d.getElementById("form-rdv").dispatchEvent(new w.Event("submit", { cancelable: true }));
  const r = w.Donnees.listerRdv()[0];
  t("enregistrer : le rendez-vous est créé (type conservé, ligne, notes)", w.Donnees.listerRdv().length === 1 && r.date === futur && r.type === "essai" && r.ligneIds.join() === l1.id && r.notes === "Apporter le mandrin de rechange");

  // type campagne choisi : la planification ne le remplace pas par « maintenance » selon la saison
  w = ouvrir(); d = w.document;
  const hiver = D.ajouterJours(aj, 120);   // hors période de campagne ou non, le type demandé doit être gardé
  chg("fv-date", hiver); chg("fv-type", "campagne");
  d.getElementById("form-visite").dispatchEvent(new w.Event("submit", { cancelable: true }));
  t("le type choisi n'est pas écrasé par la proposition automatique de la date", d.getElementById("fr-type").value === "campagne");

  // retour à une date passée : tout redevient normal
  w = ouvrir(); d = w.document;
  chg("fv-date", futur); chg("fv-date", aj);
  t("retour à aujourd'hui : bandeau masqué, bouton d'origine", d.getElementById("fv-futur").hidden && bouton().textContent === "Enregistrer la visite");
  d.getElementById("form-visite").dispatchEvent(new w.Event("submit", { cancelable: true }));
  t("… et la visite s'enregistre normalement", w.Donnees.listerVisites().length === 1);

  // visite déjà enregistrée : on ne la transforme pas en rendez-vous
  const v = w.Donnees.listerVisites()[0];
  w.Formulaires.visite({ visite: v }); d = w.document;
  t("modification : pas de bandeau, bouton « Enregistrer les modifications »", d.getElementById("fv-futur").hidden && bouton().textContent === "Enregistrer les modifications");
  chg("fv-date", futur);
  t("modification vers une date à venir : le bandeau reste masqué", d.getElementById("fv-futur").hidden && bouton().textContent === "Enregistrer les modifications");
  d.getElementById("form-visite").dispatchEvent(new w.Event("submit", { cancelable: true }));
  t("modification vers le futur : toujours refusée, avec explication", /futur/.test(d.querySelector("[data-erreur]").textContent) && w.Donnees.listerRdv().length === 0 && w.Donnees.getVisite(v.id).date === aj);

  // références reprises pour un essai / une homologation
  w = page("Client.html", stock, "?id=" + c.id); d = w.document;
  w.Formulaires.visite({ ligneId: l1.id });
  d.getElementById("fv-date").value = futur; d.getElementById("fv-date").dispatchEvent(new w.Event("change"));
  d.getElementById("fv-type").value = "homologation"; d.getElementById("fv-type").dispatchEvent(new w.Event("change"));
  d.getElementById("fv-r-refEtiquette").value = "ET-99";
  d.getElementById("form-visite").dispatchEvent(new w.Event("submit", { cancelable: true }));
  t("homologation : les références saisies sont reprises dans la planification", d.getElementById("fr-r-refEtiquette") && d.getElementById("fr-r-refEtiquette").value === "ET-99");
};
