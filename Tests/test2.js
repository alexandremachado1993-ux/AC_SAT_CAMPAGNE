module.exports = function ({ page, t, P, fs }, fin) {
  // ================= IMPORT / EXPORT =================
  const w = page("Clients.html");
  const D = w.Donnees, X = w.Excel, E = w.EchangesExcel;
  t("bouton importer présent", !!w.document.querySelector("[data-importer]"));
  t("lien modèle", w.document.querySelector(".lien-modele").getAttribute("href") === "Modeles/Modele_Import_Visites_Campagne.xlsx");
  t("export désactivé sans client", w.document.querySelector("[data-exporter]").disabled);
  t("fichier modèle présent", fs.existsSync(P + "Modeles/Modele_Import_Visites_Campagne.xlsx"));

  // modèle vierge : seulement des exemples
  const b = fs.readFileSync(P + "Modeles/Modele_Import_Visites_Campagne.xlsx");
  const planModele = E.analyser(X.lire(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)));
  t("modèle vierge : 3 exemples ignorés, rien à importer", planModele.exemples === 3 && planModele.clients.length === 0 && planModele.erreurs.length === 0);

  const H = (l) => l.map(x => ({ titre: x }));
  const fichier = X.ecrire([
    { nom: "Clients", colonnes: H(["Nom client *","Groupe","Adresse","Code postal","Ville *","Pays *","Téléphone standard","Email général","Type de production","Début campagne (mois) *","Fin campagne (mois) *","Cadence visites (jours) *","Actif","Notes"]),
      lignes: [
        ["EXEMPLE - x","","","46000","Cahors","France","","","Légumes","Mai","Novembre",14,"Oui",""],
        ["Conserverie Lot","G1","1 rue","46000","Cahors","France",565000000,"a@b.fr","Légumes","Mai","Novembre",14,"Oui","n"],
        ["Usine Ain","","",1000,"Bourg","France","","","Poisson","juil.","oct",100,"non",""],
        ["","","","","","","","","","","","","",""],
        ["Mars Mauvais","","","64000","Pau","France","","","","Floréal","Déc",21,"",""],
        ["conserverie lot","","","","","","","","","","","","",""],
        ["Maroc Sardine","","","","Agadir","Maroc","","","Poisson",11,3,21,"",""],
        [null,"sans nom","","","","","","","","","","","",""]
      ] },
    { nom: "Contacts", colonnes: H(["Client *","Rôle *","Prénom","Nom *","Téléphone fixe","Mobile","Email","Contact principal","Notes"]),
      lignes: [["Conserverie Lot","Responsable sertissage","Jean","Dupont","",611223344,"","Oui",""],
               ["Conserverie Lot","Rôle perso","Ana","Lima","","","","",""],
               ["Inconnu SA","Autre","","X","","","","",""]] },
    { nom: "Lignes", colonnes: H(["Client *","Ligne *","Marque sertisseuse","Modèle sertisseuse","N° de série","Format habituel","Produit habituel","Cadence ligne (boîtes/min)","Suivi en campagne *","Notes"]),
      lignes: [["Conserverie Lot","L1","","","","4/4","Tomate",300,"Oui",""],["Usine Ain","L1","","","","","","","Non",""]] }
  ]);
  const plan = E.analyser(X.lire(fichier.buffer));
  t("4 clients valides", plan.clients.length === 4);
  t("exemple ignoré", plan.exemples === 1);
  t("doublon signalé", plan.erreurs.some(e => e.includes("deux fois")));
  t("nom manquant signalé", plan.erreurs.some(e => e.includes("nom du client manquant")));
  t("client inconnu (contact) signalé", plan.erreurs.some(e => e.includes("Inconnu SA")));
  t("mois illisible averti", plan.avertissements.some(e => e.includes("Floréal")));
  t("cadence hors plage avertie", plan.avertissements.some(e => e.includes("cadence")));
  const lot = plan.clients.find(c => c.source.nom === "Conserverie Lot").source;
  t("téléphone numérique → 0 restauré", lot.telephone === "0565000000");
  const ain = plan.clients.find(c => c.source.nom === "Usine Ain").source;
  t("CP 1000 → 01000", ain.codePostal === "01000");
  t("mois abrégés juil./oct", ain.debutCampagne === 7 && ain.finCampagne === 10);
  t("actif non", ain.actif === false);
  t("mois numériques", plan.clients.find(c => c.source.nom === "Maroc Sardine").source.debutCampagne === 11);
  const bilan = D.appliquerImport(plan);
  t("bilan import", bilan.ok && bilan.clientsCrees === 4 && bilan.contactsCrees === 2 && bilan.lignesCreees === 2);
  t("cadence bornée à 60", D.trouverClientParNom("Usine Ain").cadenceJours === 60);
  t("mois défaut conservé (Floréal→5)", D.trouverClientParNom("Mars Mauvais").debutCampagne === 5);
  t("rôle personnalisé conservé", D.contactsDuClient(D.trouverClientParNom("Conserverie Lot").id).some(k => k.role === "Rôle perso"));
  t("page rafraîchie : 4 cartes", w.document.querySelectorAll(".carte-client-campagne").length === 4);

  // ré-import : mises à jour, pas de doublon, vide ne remplace pas
  const plan2 = E.analyser(X.lire(fichier.buffer));
  t("ré-import détecté en mise à jour", plan2.clients.every(c => c.maj));
  const b2 = D.appliquerImport(plan2);
  t("aucun doublon au ré-import", b2.clientsCrees === 0 && b2.contactsCrees === 0 && b2.lignesCreees === 0 && D.getDonnees().clients.length === 4);

  // export au format modèle puis ré-import = aller-retour sans perte
  const exp = E.lignesExport();
  t("export 3 feuilles", exp.map(f => f.nom).join() === "Clients,Contacts,Lignes");
  const plan3 = E.analyser(X.lire(X.ecrire(exp).buffer));
  t("aller-retour : rien d'ignoré", plan3.erreurs.length === 0 && plan3.clients.length === 4 && plan3.contacts.length === 2 && plan3.lignes.length === 2);
  const avant = JSON.stringify(D.getDonnees().clients);
  D.appliquerImport(plan3);
  t("aller-retour : clients identiques", JSON.stringify(D.getDonnees().clients) === avant);

  // formulaire contact : rôle personnalisé proposé
  const id = D.trouverClientParNom("Conserverie Lot").id;
  const k = D.contactsDuClient(id).find(x => x.role === "Rôle perso");
  const w3 = page("Client.html", w.localStorage.getItem("acsc_donnees_v1"), "?id=" + id);
  w3.document.querySelector('[data-onglet="contacts"]').click();
  w3.document.querySelector('[data-modifier-contact="' + k.id + '"]').click();
  t("rôle personnalisé sélectionné dans le formulaire", w3.document.getElementById("fk-role").value === "Rôle perso");

  // export via bouton (capture)
  let capture = null;
  w.Excel.telechargerXlsx = (n, f) => { capture = { n, f }; };
  w.document.querySelector("[data-exporter]").click();
  w.document.querySelector('[data-export="xlsx"]').click();
  t("export clients déclenché", capture && /^clients-campagne-\d{4}-\d{2}-\d{2}\.xlsx$/.test(capture.n));

  // ================= PLANNING =================
  const Dx = w.Donnees;
  const lot2 = Dx.trouverClientParNom("Conserverie Lot");
  const l1 = Dx.lignesDuClient(lot2.id)[0];
  const l2 = Dx.enregistrerLigne(lot2.id, { nom: "L2" });
  Dx.enregistrerVisite({ ligneId: l1.id, date: "2026-06-03", type: "campagne", remarques: "RAS" });
  Dx.enregistrerVisite({ ligneId: l1.id, date: "2026-06-24", type: "campagne" });
  Dx.enregistrerVisite({ ligneId: l2.id, date: "2026-06-25", type: "maintenance" });
  Dx.enregistrerVisite({ ligneId: l1.id, date: "2025-06-10", type: "campagne" });
  const stock = w.localStorage.getItem("acsc_donnees_v1");

  const wp = page("Planning.html", stock);
  const q = (s) => wp.document.querySelectorAll(s);
  // ----- Timeline (vue par défaut, maquette validée)
  t("planning : titre", wp.document.querySelector(".titre-page").textContent === "Planning d'interventions");
  t("timeline par défaut", !!wp.document.querySelector(".tl-grille") && !wp.document.querySelector(".pl-table"));
  t("timeline : 12 mois, mois courant en pastille", q(".tl-mois span").length === 12 && wp.document.querySelector(".tl-mois-courant").textContent === q(".tl-mois span")[new Date().getMonth()].textContent);
  t("timeline : rangées = clients actifs", q(".tl-rangee--client").length === 3);
  const tLot = [...q(".tl-rangee--client")].find(r => r.textContent.includes("Conserverie Lot"));
  t("timeline : 3 visites posées", tLot.querySelectorAll("button.tl-point:not(.tl-point--vide)").length === 3);
  t("timeline : visites reliées (2 segments)", tLot.querySelectorAll(".tl-segment").length >= 2);
  t("timeline : retard signalé à aujourd'hui", !!tLot.querySelector(".tl-alerte") && !!tLot.querySelector(".tl-aujourdhui"));
  t("timeline : badge 0 % (lignes en retard)", tLot.querySelector(".tl-badge").textContent === "0%" && tLot.querySelector(".tl-badge").classList.contains("tl-badge--alerte"));
  t("timeline : dernière visite", tLot.querySelector(".tl-derniere").textContent.includes("25/06/2026"));
  t("timeline : bande de campagne mai → nov.", !!tLot.querySelector(".tl-bande"));
  const tMaroc = [...q(".tl-rangee--client")].find(r => r.textContent.includes("Maroc"));
  t("timeline : campagne à cheval = 2 bandes", tMaroc.querySelectorAll(".tl-bande").length === 2);
  t("timeline : chevron vers la fiche", tLot.querySelector(".tl-chevron").getAttribute("href").startsWith("Client.html?id="));
  const pt = [...tLot.querySelectorAll("button.tl-point")].find(b => b.getAttribute("data-point").endsWith("2026-06-03"));
  pt.click();
  t("timeline : clic sur une visite → détail", wp.document.querySelector(".feuille").textContent.includes("RAS"));
  wp.AppLayout.fermerFeuille();
  t("chiffres clés : réalisées / retard", wp.document.querySelector(".tl-chiffres").textContent.includes("Visites réalisées3") &&
    /En retard \/ pas encore vues\d/.test(wp.document.querySelector(".tl-chiffres").textContent));
  t("chiffres clés : période affichée", wp.document.querySelector(".tl-periode").textContent.includes("Janvier – Décembre 2026"));
  t("filtres : bouton ouvre / ferme", (() => { const avant = !wp.document.querySelector(".pl-filtres").hidden; wp.document.querySelector("[data-filtres]").click(); return avant !== !wp.document.querySelector(".pl-filtres").hidden; })());
  wp.document.querySelector("[data-filtres]").click();
  wp.document.getElementById("pf-detail").click();
  t("timeline : détail par ligne", q(".tl-rangee--ligne").length === 2);
  wp.document.getElementById("pf-detail").click();
  // ----- Vue Mois (grille)
  wp.document.querySelector('[data-vue="mois"]').click();
  t("mois : grille", !!wp.document.querySelector(".pl-table"));
  t("plus de vue Semaines", !wp.document.querySelector('[data-vue="semaines"]'));
  t("12 colonnes mois", q("thead .pl-entete-col").length === 12);
  t("rangées = clients actifs", q(".pl-rangee--client").length === 3);
  const rangLot = [...q(".pl-rangee--client")].find(r => r.textContent.includes("Conserverie Lot"));
  const juin = rangLot.querySelectorAll(".pl-cellule")[5];
  t("juin : 2 campagne + 1 maintenance", juin.querySelector(".pl-point--campagne").textContent === "2" && !!juin.querySelector(".pl-point--maintenance"));
  t("période de campagne ombrée (mai-nov)", rangLot.querySelectorAll(".pl-cellule")[4].classList.contains("pl-cellule--campagne") && !rangLot.querySelectorAll(".pl-cellule")[0].classList.contains("pl-cellule--campagne"));
  const maroc = [...q(".pl-rangee--client")].find(r => r.textContent.includes("Maroc"));
  t("campagne à cheval (nov→mars) ombrée en janvier", maroc.querySelectorAll(".pl-cellule")[0].classList.contains("pl-cellule--campagne"));
  t("totaux ligne", rangLot.querySelectorAll(".pl-total")[0].textContent === "2" && rangLot.querySelectorAll(".pl-total")[1].textContent === "1");
  t("visite 2025 exclue de 2026", wp.document.querySelector("tfoot").textContent.includes("3"));
  t("colonne aujourd'hui marquée (mois courant)", q(".pl-entete-col--aujourdhui").length === 1 && wp.document.querySelector(".pl-entete-col--aujourdhui").textContent === q(".pl-entete-col")[new Date().getMonth()].textContent);
  t("retard signalé dans le mois courant (dernière visite juin)", !!rangLot.querySelectorAll(".pl-cellule")[Math.max(new Date().getMonth(), 6)].querySelector(".pl-retard"));
  juin.click();
  t("détail case : 3 visites", wp.document.querySelectorAll(".feuille .carte").length === 3 && wp.document.querySelector(".feuille").textContent.includes("RAS"));
  wp.AppLayout.fermerFeuille();
  wp.document.getElementById("pf-detail").click();
  t("détail par ligne (L1, L2)", q(".pl-rangee--ligne").length === 2);
  // filtres
  const sel = wp.document.getElementById("pf-departement");
  t("options département", [...sel.options].some(o => o.textContent === "46 – Lot"));
  sel.value = "46"; sel.dispatchEvent(new wp.Event("change"));
  t("filtre département", q(".pl-rangee--client").length === 1);
  t("compteur filtres sur le bouton", wp.document.querySelector("[data-filtres] .onglet-fiche-compteur").textContent === "1");
  const reg = wp.document.getElementById("pf-region");
  t("région déduite du CP (Occitanie)", [...reg.options].some(o => o.value === "Occitanie"));
  t("Maroc : pays comme région", [...reg.options].some(o => o.value === "Maroc"));
  wp.document.querySelector("[data-effacer-filtres]").click();
  t("réinitialiser", q(".pl-rangee--client").length === 3 && wp.document.querySelector("[data-effacer-filtres]").disabled);
  const typ = wp.document.getElementById("pf-type"); typ.value = "maintenance"; typ.dispatchEvent(new wp.Event("change"));
  t("filtre type maintenance", !wp.document.querySelector(".pl-table .pl-point--campagne") && !!wp.document.querySelector(".pl-table .pl-point--maintenance"));
  wp.document.querySelector("[data-effacer-filtres]").click();
  const ina = wp.document.getElementById("pf-inactifs"); ina.checked = true; ina.dispatchEvent(new wp.Event("change"));
  t("inclure inactifs", q(".pl-rangee--client").length === 4);
  wp.document.querySelector("[data-effacer-filtres]").click();
  const rech = wp.document.getElementById("pf-recherche"); rech.value = "sardine"; rech.dispatchEvent(new wp.Event("input"));
  t("recherche", q(".pl-rangee--client").length === 1);
  wp.document.querySelector("[data-effacer-filtres]").click();
  // année précédente
  wp.document.querySelector('[data-annee="-1"]').click();
  t("2025 : 1 visite, pas d'échéance", wp.document.querySelector(".tl-chiffres").textContent.includes("Visites réalisées1") && !wp.document.querySelector(".pl-table .pl-retard") && !wp.document.querySelector(".pl-table .pl-echeance"));
  wp.document.querySelector('[data-vue="timeline"]').click();
  t("2025 timeline : ni retard ni aujourd'hui", !wp.document.querySelector(".tl-alerte") && !wp.document.querySelector(".tl-aujourdhui"));
  wp.document.querySelector('[data-vue="mois"]').click();
  wp.document.querySelector('[data-annee="1"]').click();
  // export compte rendu
  let cr = null;
  wp.Excel.telechargerXlsx = (n, f) => { cr = { n, f }; };
  wp.document.querySelector("[data-exporter]").click();
  wp.document.querySelector('[data-cr="xlsx"]').click();
  t("compte rendu : 5 feuilles", cr && cr.f.map(f => f.nom).join("|") === "Compte rendu|Synthèse par client|Planning mensuel|Visites|Rendez-vous prévus");
  const vis = cr.f[3].lignes;
  t("compte rendu : 3 visites 2026", vis.length === 3 && vis[0][0] === "2026-06-03" && vis[0][5] === "46 – Lot" && vis[0][6] === "Occitanie");
  const mens = cr.f[2].lignes.find(r => r[0] === "Conserverie Lot" && r[1] === "L1");
  t("planning mensuel : juin = 2", mens[2 + 5] === 2 && mens[14] === 2);
  const out = wp.Excel.ecrire(cr.f);
  fs.writeFileSync(require("path").join(require("os").tmpdir(), "cr.xlsx"), Buffer.from(out));
  let csvCap = null;
  wp.Excel.telechargerCsv = (n, c, l) => { csvCap = { n, c, l }; };
  wp.document.querySelector("[data-exporter]").click();
  wp.document.querySelector('[data-cr="csv"]').click();
  t("CSV date FR", csvCap && csvCap.l[0][0] === "03/06/2026");

  const wv = page("Planning.html");
  t("planning vide", wv.document.body.textContent.includes("Le planning se remplira"));
  fin();
};
