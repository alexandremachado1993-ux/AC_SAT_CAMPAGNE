/* Catalogue de produits par famille, avec les produits déjà utilisés en premier. */
module.exports = async function ({ page, t }) {
  const w0 = page("Client.html");
  const D = w0.Donnees;
  const c = D.ajouterClient({ nom: "Catalogue SA", ville: "X" });
  const l = D.enregistrerLigne(c.id, { nom: "L1", formatHabituel: "4/4", produitHabituel: "Maïs" });
  D.enregistrerVisite({ clientId: c.id, ligneId: l.id, date: D.aujourdhuiIso(), type: "campagne", format: "4/4", produit: "Produit maison" });

  const g = D.choixPour("produit").groupes;
  const tous = [].concat.apply([], g.map(x => x.valeurs));
  t("catalogue : plus de 100 produits, rangés par famille", tous.length > 100 && g.length >= 9);
  t("catalogue : les familles attendues", ["Légumes", "Légumes secs", "Tomates", "Fruits", "Poissons et fruits de mer", "Viandes et plats cuisinés", "Soupes et sauces", "Laitages et desserts", "Boissons", "Aliments pour animaux"].every(f => g.some(x => x.libelle === f)));
  t("tes produits déjà utilisés passent en premier", g[0].libelle === "Déjà utilisés chez toi" && g[0].valeurs.join() === "Maïs,Produit maison");
  t("un produit déjà utilisé n'est pas répété dans sa famille", !g.find(x => x.libelle === "Légumes").valeurs.includes("Maïs") && tous.filter(p => p === "Maïs").length === 1);
  t("aucun doublon (casse et accents ignorés)", new Set(tous.map(p => D.normaliserTexte(p))).size === tous.length);
  t("tous les anciens produits de départ restent proposés", ["Maïs", "Haricots verts", "Thon", "Sardines", "Cassoulet", "Pêches", "Tomates pelées", "Aliment pour animaux (pâtée)", "Confit de canard"].every(p => tous.includes(p)));
  const w1 = page("Client.html", w0.localStorage.getItem("acsc_donnees_v1"));
  t("formats courants proposés (1/8, 2/1, 5/1, 10/1…)", ["1/8", "2/1", "5/1", "10/1", "4/4", "1/2"].every(f => w1.Donnees.choixPour("format").includes(f)));
  const sansDonnees = page("Client.html").Donnees.choixPour("produit").groupes;
  t("sans historique : pas de groupe « déjà utilisés », juste le catalogue", sansDonnees[0].libelle === "Légumes");

  // ---- formulaires
  const w = page("Client.html", w0.localStorage.getItem("acsc_donnees_v1"), "?id=" + c.id); const d = w.document;
  w.Formulaires.visite({ ligneId: l.id });
  const sel = d.getElementById("fv-produit");
  t("formulaire de visite : liste en groupes (optgroup)", sel.querySelectorAll("optgroup").length === g.length && sel.querySelectorAll("optgroup")[0].label === "Déjà utilisés chez toi");
  t("formulaire de visite : tout le catalogue + « — » + « Autre… »", sel.options.length === tous.length + 2 && sel.options[0].value === "" && sel.options[sel.options.length - 1].textContent.indexOf("Autre") !== -1);
  t("formulaire de visite : produit de la ligne présélectionné dans son groupe", sel.value === "Maïs" && sel.selectedOptions[0].parentElement.label === "Déjà utilisés chez toi");
  sel.value = "Thon"; sel.dispatchEvent(new w.Event("change"));
  t("choisir un produit du catalogue", sel.value === "Thon" && d.getElementById("fv-produit-libre").hidden);
  sel.value = "__libre__"; sel.dispatchEvent(new w.Event("change"));
  d.getElementById("fv-produit-libre").value = "Cœurs de palmier";
  d.getElementById("form-visite").dispatchEvent(new w.Event("submit", { cancelable: true }));
  const v = w.Donnees.listerVisites().find(x => x.produit === "Cœurs de palmier");
  t("« Autre… » : un produit nouveau s'enregistre", !!v);
  t("… et il est proposé ensuite, en tête", w.Donnees.choixPour("produit").groupes[0].valeurs.includes("Cœurs de palmier"));

  // valeur importée hors catalogue : conservée
  const l2 = w.Donnees.enregistrerLigne(c.id, { nom: "L2", produitHabituel: "" });
  w.Formulaires.ligne(c.id, w.Donnees.getLigne(l2.id));
  t("formulaire de ligne : même liste en groupes", d.getElementById("fl-produit").querySelectorAll("optgroup").length >= 9);
  w.AppLayout.fermerFeuille();
  t("liste simple (format) : inchangée, sans groupes", !d.getElementById("fl-format").querySelector("optgroup"));
  w.Formulaires.ligne(c.id, Object.assign({}, w.Donnees.getLigne(l2.id), { produitHabituel: "Produit exotique importé" }));
  const sel2 = d.getElementById("fl-produit");
  t("valeur absente de toutes les listes : gardée dans « Valeur actuelle »", sel2.value === "Produit exotique importé" && sel2.selectedOptions[0].parentElement.label === "Valeur actuelle");
};
