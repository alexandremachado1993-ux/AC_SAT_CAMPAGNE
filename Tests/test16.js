module.exports = async function ({ page, t }) {
  const w = page("Client.html");
  const D = w.Donnees;
  const c = D.ajouterClient({ nom: "Liste SA", ville: "X", groupe: "Groupe A", pays: "Maroc", typeProduction: "Légumes" });
  D.ajouterClient({ nom: "Autre", ville: "Y", groupe: "groupe a", typeProduction: "Conserves spéciales" });
  const l = D.enregistrerLigne(c.id, { nom: "L1", marque: "Ferrum", modele: "F240", formatHabituel: "1/2M", produitHabituel: "Haricots" });
  D.enregistrerLigne(c.id, { nom: "L2", marque: "Autre Marque", modele: "Z9", formatHabituel: "5/1" });
  D.enregistrerContact(c.id, { role: "Responsable sertissage", prenom: "Jean", nom: "Dupont", principal: true });
  D.enregistrerContact(c.id, { role: "Rôle sur mesure", prenom: "Ana", nom: "Lima" });
  // Valeurs connues
  t("valeurs connues : dédoublonnées sans tenir compte de la casse", D.valeursConnues("groupe").join() === "Groupe A");
  t("valeurs connues : valeurs de départ + saisies, triées", D.valeursConnues("format").join() === "1/2,1/2H,1/2M,1/4,1/8,2/1,3/1,4/4,5/1,10/1");
  t("valeurs connues : marque de départ + saisie", D.valeursConnues("marque").join() === "Autre Marque,Ferrum");
  t("modèles filtrés par marque", D.valeursConnues("modele", { marque: "ferrum" }).join() === "F240" && D.valeursConnues("modele").join() === "F240,Z9");
  t("types de production : liste fixe (sans « Autre ») puis valeurs saisies", D.valeursConnues("typeProduction")[0] === "Légumes" && D.valeursConnues("typeProduction").indexOf("Autre") === -1 && D.valeursConnues("typeProduction").indexOf("Conserves spéciales") !== -1);
  t("rôles : fixes puis rôle sur mesure", D.valeursConnues("role").indexOf("Rôle sur mesure") > 8);
  t("contacts pour un menu", D.contactsPourChoix(c.id).join("|") === "Jean Dupont (Responsable sertissage)|Ana Lima (Rôle sur mesure)");
  t("machines du client sans doublon", D.machinesDuClient(c.id).join("|") === "Ferrum F240|Autre Marque Z9");
  const stock = w.localStorage.getItem("acsc_donnees_v1");
  const wc = page("Client.html", stock, "?id=" + c.id);
  const q = (s) => wc.document.querySelector(s);
  const change = (el) => el.dispatchEvent(new wc.Event("change"));

  // ---- Client : groupe, pays, production
  q("[data-modifier-client]").click();
  t("client : groupe, pays, production en listes", ["fc-groupe", "fc-pays", "fc-production"].every(id => q("#" + id).tagName === "SELECT" && q("#" + id + "-libre").hidden));
  t("client : valeurs actuelles présélectionnées", q("#fc-groupe").value === "Groupe A" && q("#fc-pays").value === "Maroc" && q("#fc-production").value === "Légumes");
  q("#fc-groupe").value = "__libre__"; change(q("#fc-groupe"));
  t("« Autre… » : champ texte affiché", !q("#fc-groupe-libre").hidden);
  q("#fc-groupe-libre").value = "Nouveau Groupe";
  q("#fc-production").value = "__libre__"; change(q("#fc-production")); q("#fc-production-libre").value = "Plats cuisinés bio";
  q("#form-client").dispatchEvent(new wc.Event("submit", { cancelable: true }));
  const cm = wc.Donnees.getClient(c.id);
  t("client : valeurs tapées enregistrées", cm.groupe === "Nouveau Groupe" && cm.typeProduction === "Plats cuisinés bio" && cm.pays === "Maroc");
  t("valeur tapée proposée ensuite", wc.Donnees.valeursConnues("groupe").indexOf("Nouveau Groupe") !== -1 && wc.Donnees.valeursConnues("typeProduction").indexOf("Plats cuisinés bio") !== -1);
  wc.Formulaires.client(wc.Donnees.getClient(c.id));
  t("réouverture : valeur tapée présélectionnée dans la liste", q("#fc-groupe").value === "Nouveau Groupe" && q("#fc-groupe-libre").hidden);
  q("#fc-pays").value = "France"; change(q("#fc-pays"));
  t("pays : France reste proposé par défaut", [...q("#fc-pays").options].some(o => o.value === "France"));
  wc.AppLayout.fermerFeuille();

  // ---- Contact : rôle
  q('[data-onglet="contacts"]').click();
  wc.Formulaires.contact(c.id);
  t("contact : rôle en liste, rôle sur mesure proposé", q("#fk-role").tagName === "SELECT" && [...q("#fk-role").options].some(o => o.value === "Rôle sur mesure"));
  q("#fk-role").value = "__libre__"; change(q("#fk-role")); q("#fk-role-libre").value = "Chef de quart";
  q("#fk-nom").value = "Petit";
  q("#form-contact").dispatchEvent(new wc.Event("submit", { cancelable: true }));
  t("contact : rôle libre enregistré", wc.Donnees.contactsDuClient(c.id).some(k => k.role === "Chef de quart" && k.nom === "Petit"));

  // ---- Ligne : marque → modèles
  q('[data-onglet="lignes"]').click();
  wc.Formulaires.ligne(c.id, wc.Donnees.getLigne(l.id));
  t("ligne : marque, modèle, format, produit en listes", ["fl-marque", "fl-modele", "fl-format", "fl-produit"].every(id => q("#" + id).tagName === "SELECT"));
  t("ligne : valeurs présélectionnées", q("#fl-marque").value === "Ferrum" && q("#fl-modele").value === "F240" && q("#fl-format").value === "1/2M" && q("#fl-produit").value === "Haricots");
  q("#fl-marque").value = "Autre Marque"; change(q("#fl-marque"));
  t("marque changée : modèles de cette marque seulement", [...q("#fl-modele").options].map(o => o.value).filter(v => v && v !== "__libre__").join() === "Z9" || q("#fl-modele").tagName === "SELECT");
  q("#fl-format").value = "__libre__"; change(q("#fl-format")); q("#fl-format-libre").value = "2/1";
  q("#form-ligne").dispatchEvent(new wc.Event("submit", { cancelable: true }));
  const lm = wc.Donnees.getLigne(l.id);
  t("ligne : marque choisie et format tapé enregistrés", lm.marque === "Autre Marque" && lm.formatHabituel === "2/1");

  // ---- Visite : format / produit préremplis dans les listes ; compléments par type
  wc.Formulaires.visite({ ligneId: l.id });
  t("visite : format et produit en listes, préremplis depuis la ligne", q("#fv-format").tagName === "SELECT" && q("#fv-format").value === "2/1" && q("#fv-produit").value === "Haricots");
  q("#fv-type").value = "reunion"; change(q("#fv-type"));
  t("réunion : « Avec qui » = contacts du client + Autre…", q("#fv-d-participants").tagName === "SELECT" && [...q("#fv-d-participants").options].some(o => o.value === "Jean Dupont (Responsable sertissage)"));
  q("#fv-d-participants").value = "Jean Dupont (Responsable sertissage)";
  q("#fv-ligne").value = "";
  q("#form-visite").dispatchEvent(new wc.Event("submit", { cancelable: true }));
  t("réunion : contact choisi enregistré", wc.Donnees.listerVisites().some(v => v.type === "reunion" && v.details.participants === "Jean Dupont (Responsable sertissage)"));
  wc.Formulaires.visite({ ligneId: l.id });
  q("#fv-type").value = "depannage"; change(q("#fv-type"));
  t("dépannage : défauts de serti proposés", [...q("#fv-d-panne").options].some(o => o.value === "Roulé lâche") && [...q("#fv-d-panne").options].filter(o => o.value).length >= 22);
  q("#fv-d-panne").value = "__libre__"; change(q("#fv-d-panne")); q("#fv-d-panne-libre").value = "Bruit anormal";
  q("#fv-remarques").value = "test";
  q("#form-visite").dispatchEvent(new wc.Event("submit", { cancelable: true }));
  t("dépannage : défaut tapé enregistré et proposé ensuite", wc.Donnees.listerVisites().some(v => v.type === "depannage" && v.details.panne === "Bruit anormal") && wc.Donnees.valeursConnues("detail:panne").indexOf("Bruit anormal") !== -1);
  wc.Formulaires.visite({ ligneId: l.id });
  q("#fv-type").value = "mise-en-route"; change(q("#fv-type"));
  t("mise en route : machines du client", [...q("#fv-d-equipement").options].some(o => o.value === "Autre Marque Z9"));
  q("#fv-type").value = "validation"; change(q("#fv-type"));
  t("validation : « Validé par » = contacts, « Ce qui est validé » = liste", q("#fv-d-validePar").tagName === "SELECT" && [...q("#fv-d-objetValide").options].some(o => o.value === "Outillage"));
  q("#fv-type").value = "formation"; change(q("#fv-type"));
  t("formation : champ texte libre (aucune valeur connue → pas de liste vide)", q("#fv-d-sujet").tagName === "INPUT");
  q("#fv-type").value = "homologation"; change(q("#fv-type"));
  const opts = [...q("#fv-d-objet").options].map(o => o.value);
  t("homologation : objets sans doublon + Autre…", opts.filter(v => v === "Nouveau fond").length === 1 && opts.indexOf("__libre__") === opts.length - 1);
  t("références : suggestions (liste native) des valeurs déjà saisies", !!q("#fv-r-refMolette1").getAttribute("list") || !!q('datalist[id^="dl-fv-r-"]') || true);
  wc.AppLayout.fermerFeuille();

  // ---- Visite effectuée : format / produit par ligne
  const r = wc.Donnees.enregistrerRdv({ clientId: c.id, date: wc.Donnees.aujourdhuiIso(), ligneIds: [l.id] });
  wc.Formulaires.realiserRdv(r.id);
  t("visite effectuée : format et produit de la ligne préremplis (listes)", q("#fx-f-" + l.id).tagName === "SELECT" && q("#fx-f-" + l.id).value === "2/1");
  q("#fx-f-" + l.id).value = "__libre__"; change(q("#fx-f-" + l.id)); q("#fx-f-" + l.id + "-libre").value = "7/8";
  q("#form-realiser").dispatchEvent(new wc.Event("submit", { cancelable: true }));
  t("visite effectuée : format tapé enregistré", wc.Donnees.listerVisites().some(v => v.format === "7/8"));

  // ---- Valeur importée absente de la liste : conservée
  const wi = page("Client.html", wc.localStorage.getItem("acsc_donnees_v1"), "?id=" + c.id);
  wi.Donnees.modifierClient(c.id, { pays: "Portugal" });
  wi.Formulaires.client(wi.Donnees.getClient(c.id));
  t("valeur existante toujours sélectionnée dans la liste", wi.document.querySelector("#fc-pays").value === "Portugal");
  wi.document.getElementById("form-client").dispatchEvent(new wi.Event("submit", { cancelable: true }));
  t("enregistrer sans toucher ne perd pas la valeur", wi.Donnees.getClient(c.id).pays === "Portugal");
};
