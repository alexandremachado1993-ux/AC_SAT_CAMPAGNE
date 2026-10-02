/* Planifier en avance depuis la page Planning. */
module.exports = async function ({ page, t }) {
  const w0 = page("Index.html");
  const D = w0.Donnees;
  const aj = D.aujourdhuiIso(), annee = Number(aj.slice(0, 4));
  const demain = D.ajouterJours(aj, 1);
  const c = D.ajouterClient({ nom: "Futur SA", ville: "X", debutCampagne: 1, finCampagne: 12, cadenceJours: 14 });
  const l1 = D.enregistrerLigne(c.id, { nom: "L1" }), l2 = D.enregistrerLigne(c.id, { nom: "L2" });
  D.definirStatutLigne(l2.id, "inactive");
  D.enregistrerVisite({ ligneId: l1.id, date: annee + "-01-10", type: "campagne" });
  const inactif = D.ajouterClient({ nom: "Ancien", ville: "Y", debutCampagne: 1, finCampagne: 12, actif: false });
  D.enregistrerLigne(inactif.id, { nom: "Z" });

  // ---- prochain jour travaillé
  let d = aj; while (D.jourSemaine(d) !== 6) d = D.ajouterJours(d, 1);       // un samedi
  t("samedi → lundi (jours travaillés lundi à vendredi)", D.prochainJourTravaille(d) === D.ajouterJours(d, 2) && D.jourSemaine(D.prochainJourTravaille(d)) === 1);
  t("jour travaillé : inchangé", D.prochainJourTravaille(D.ajouterJours(d, 3)) === D.ajouterJours(d, 3));
  D.definirTournee({ jours: [6] });
  t("suit les réglages de la Tournée (samedi seul)", D.prochainJourTravaille(d) === d && D.jourSemaine(D.prochainJourTravaille(D.ajouterJours(d, 1))) === 6);
  D.definirTournee({ jours: [1, 2, 3, 4, 5] });
  const travaille = (iso) => D.prochainJourTravaille(iso);

  const stock = w0.localStorage.getItem("acsc_donnees_v1");
  let wp = page("Planning.html", stock); let doc = wp.document;
  const q = (s) => doc.querySelector(s), qa = (s) => [...doc.querySelectorAll(s)];
  const ferme = () => wp.AppLayout.fermerFeuille();
  const formOuvert = () => !!doc.querySelector(".feuille:not([hidden]) #form-rdv");

  // ---- formulaire : date préremplie
  const cible = D.ajouterJours(aj, 40);
  wp.Formulaires.rdv({ clientId: c.id, date: cible });
  t("formulaire de rendez-vous : date reçue préremplie", q("#fr-date").value === cible);
  ferme();
  wp.Formulaires.rdv({ clientId: c.id, date: D.ajouterJours(aj, -3) });
  t("formulaire : une date passée est ignorée (demain)", q("#fr-date").value === demain);
  ferme();

  // ---- bouton « Planifier » de l'en-tête
  t("Planning : bouton « Planifier » dans l'en-tête", !!q("[data-planifier]"));
  q("[data-planifier]").click();
  t("bouton d'en-tête : formulaire à la première date possible (demain ou le jour travaillé suivant)", !!q("#form-rdv") && q("#fr-date").value === travaille(demain));
  ferme();
  q('[data-annee="1"]').click(); q("[data-planifier]").click();
  t("année suivante : le bouton propose le début de cette année-là", q("#fr-date").value === travaille((annee + 1) + "-01-01"));
  ferme(); q('[data-annee="-1"]').click();

  // ---- frise : clic à une date à venir
  const nbJ = (Date.UTC(annee + 1, 0, 1) - Date.UTC(annee, 0, 1)) / 86400000;
  const xPour = (iso) => { const [y, m, j] = iso.split("-").map(Number); return ((Date.UTC(y, m - 1, j) - Date.UTC(annee, 0, 1)) / 86400000 + 0.5) / nbJ * 1000; };
  const piste = () => { const p = q(".tl-rangee--client .tl-piste[data-planifier-piste]"); p.getBoundingClientRect = () => ({ left: 0, width: 1000, right: 1000, top: 0, bottom: 60, height: 60 }); return p; };
  const clic = (p, x) => p.dispatchEvent(new wp.MouseEvent("click", { clientX: x, bubbles: true }));
  const fin = annee + "-12-30";
  clic(piste(), xPour(fin));
  t("frise : clic à une date à venir → formulaire du bon client, à cette date", !!q("#form-rdv") && q("#fr-client").value === c.id && q("#fr-date").value === travaille(fin));
  t("frise : les lignes actives du client sont cochées, pas l'inactive", !!q("#fr-l-" + l1.id) && q("#fr-l-" + l1.id).checked && !q("#fr-l-" + l2.id));
  ferme();
  clic(piste(), xPour(annee + "-01-20"));
  t("frise : clic dans le passé → message, pas de formulaire", !formOuvert() && /date est passée/.test(doc.body.textContent));
  // repère
  const p1 = piste();
  p1.dispatchEvent(new wp.MouseEvent("mousemove", { clientX: xPour(fin), bubbles: true }));
  const repere = p1.querySelector(".tl-repere");
  t("frise : repère pointillé avec la date (jour travaillé) au survol d'une date à venir", repere && !repere.hidden && repere.getAttribute("data-date").indexOf("Planifier · ") === 0 && p1.classList.contains("tl-piste--planifiable"));
  p1.dispatchEvent(new wp.MouseEvent("mousemove", { clientX: xPour(annee + "-01-20"), bubbles: true }));
  t("frise : pas de repère sur le passé", p1.querySelector(".tl-repere").hidden && !p1.classList.contains("tl-piste--planifiable"));
  p1.dispatchEvent(new wp.MouseEvent("mouseleave"));
  // un point (visite) garde son action
  const point = p1.querySelector("button.tl-point");
  t("frise : les points de visite restent des boutons", !!point);
  point.click();
  t("frise : clic sur un point → détail de la visite, pas le formulaire", !formOuvert() && /Futur SA/.test((q(".feuille .feuille-titre") || {}).textContent || ""));
  ferme();

  // ---- détail par ligne
  q("#pf-detail").click();
  const pisteLigne = q('.tl-rangee--ligne .tl-piste[data-planifier-piste="l:' + l1.id + '"]');
  t("détail par ligne : la ligne active est planifiable", !!pisteLigne);
  pisteLigne.getBoundingClientRect = () => ({ left: 0, width: 1000 });
  clic(pisteLigne, xPour(fin));
  t("détail par ligne : le formulaire ne coche que cette ligne", q("#fr-l-" + l1.id).checked && qa("#fr-lignes [data-ligne]").length === 1);
  ferme(); q("#pf-detail").click();

  // ---- clients inactifs : jamais de planification
  const inc = q("#pf-inactifs"); inc.checked = true; inc.dispatchEvent(new wp.Event("change"));
  const rangeeInactif = qa(".tl-rangee--client").find(r => /Ancien/.test(r.textContent));
  t("client inactif : affiché mais non planifiable (ni frise, ni cases)", !!rangeeInactif && !rangeeInactif.querySelector("[data-planifier-piste]"));
  inc.checked = false; inc.dispatchEvent(new wp.Event("change"));

  // ---- vue Mois : cases vides à venir
  q('[data-vue="mois"]').click();
  const ligneC = () => qa(".pl-rangee--client").find(r => /Futur SA/.test(r.textContent));
  const caseDec = () => ligneC().querySelectorAll(".pl-cellule")[11];
  t("mois : une case vide à venir est planifiable", caseDec().classList.contains("pl-cellule--planifiable") && /Planifier une visite/.test(caseDec().getAttribute("title")));
  const moisPasse = ligneC().querySelectorAll(".pl-cellule")[1];       // février : passé et vide
  t("mois : une case du passé ne l'est pas", !moisPasse.classList.contains("pl-cellule--planifiable") && !moisPasse.hasAttribute("data-planifier-cellule"));
  caseDec().click();
  const debutDec = annee + "-12-01";
  t("mois : clic sur une case vide → formulaire à la première date du mois", q("#fr-client").value === c.id && q("#fr-date").value === travaille(debutDec > demain ? debutDec : demain));
  ferme();
  // case avec contenu à venir : détail + bouton
  const w2 = page("Index.html", stock); w2.Donnees.enregistrerRdv({ clientId: c.id, date: travaille(annee + "-12-16"), ligneIds: [l1.id] });
  wp = page("Planning.html", w2.localStorage.getItem("acsc_donnees_v1")); doc = wp.document;
  doc.querySelector('[data-vue="mois"]').click();
  const cellule = [...doc.querySelectorAll(".pl-rangee--client")].find(r => /Futur SA/.test(r.textContent)).querySelectorAll(".pl-cellule")[11];
  cellule.click();
  const bouton = doc.querySelector(".feuille [data-detail-planifier]");
  t("mois : case avec un rendez-vous à venir → détail avec « Planifier une visite ici »", !!bouton && /Planifier une visite ici/.test(bouton.textContent));
  bouton.click();
  t("détail : le bouton ouvre le formulaire prérempli (client, date de la période)", !!doc.querySelector("#form-rdv") && doc.querySelector("#fr-client").value === c.id && doc.querySelector("#fr-date").value === travaille(annee + "-12-01" > demain ? annee + "-12-01" : demain));
  wp.AppLayout.fermerFeuille();
  // case avec contenu dans le passé : pas de bouton
  const janv = [...doc.querySelectorAll(".pl-rangee--client")].find(r => /Futur SA/.test(r.textContent)).querySelectorAll(".pl-cellule")[0];
  janv.click();
  t("mois : détail d'une période passée → pas de bouton de planification", !!doc.querySelector(".feuille") && !doc.querySelector(".feuille [data-detail-planifier]"));
};
