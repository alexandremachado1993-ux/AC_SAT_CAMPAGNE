module.exports = async function ({ page, t }) {
  const w = page("Index.html");
  const D = w.Donnees;
  const REF = "2026-09-28"; // lundi
  // Réglages de tournée
  const tt = D.definirTournee({ jours: [1, 2, 3, 4, 5], maxParJour: 99, horizon: 3, jourAuto: 9 });
  t("tournée : bornes appliquées", tt.maxParJour === 8 && tt.horizon === 7 && tt.jourAuto === 7);
  D.definirTournee({ maxParJour: 2, horizon: 14, jourAuto: 5, unDepartement: true, heureDebut: "08:30", ecartHeures: 2 });
  /* Un vendredi, la page génère elle-même la tournée à son ouverture (derniereGeneration = aujourd'hui) :
     on remet le compteur à zéro pour que le test ne dépende pas du jour où on le lance. */
  D.getDonnees().profil.tournee = Object.assign(D.getTournee(), { derniereGeneration: null });
  t("propositions auto : pas avant vendredi", !D.propositionsAFaire("2026-10-01") && D.propositionsAFaire("2026-10-02"));
  // Clients : 3 dans le 47, 1 dans le 40, 1 à jour, 1 avec RDV déjà prévu
  const mk = (nom, cp) => { const c = D.ajouterClient({ nom, ville: nom, codePostal: cp, debutCampagne: 1, finCampagne: 12, cadenceJours: 14 }); const l = D.enregistrerLigne(c.id, { nom: "L" }); return { c, l }; };
  const a = mk("A47", "47000"), b = mk("B47", "47300"), c = mk("C47", "47400"), d = mk("D40", "40000"), ajour = mk("OK47", "47500"), prevu = mk("RDV47", "47600");
  D.enregistrerVisite({ ligneId: ajour.l.id, date: "2026-09-27", type: "campagne" });   // échéance 11/10 → dans l'horizon, pas avant le 08/10
  D.enregistrerRdv({ clientId: prevu.c.id, date: "2026-10-05", ligneIds: [prevu.l.id] });
  const r1 = D.proposerTournee(REF);
  const props = D.listerRdv().filter(D.estPropose);
  t("propositions créées (5 clients à voir, 1 déjà prévu exclu)", r1.creees.length === 5 && !props.some(r => r.clientId === prevu.c.id));
  t("jamais le week-end", props.every(r => D.jourSemaine(r.date) <= 5));
  t("pas le jour même", props.every(r => r.date > REF));
  const parJour = {}; props.forEach(r => { (parJour[r.date] = parJour[r.date] || []).push(r); });
  t("maximum 2 clients par jour", Object.values(parJour).every(l => l.length <= 2));
  t("un seul département par jour", Object.values(parJour).every(l => new Set(l.map(r => D.getClient(r.clientId).codePostal.slice(0, 2))).size === 1));
  t("urgents d'abord : A/B mardi, C47 et D40 pas le même jour", parJour["2026-09-29"] && parJour["2026-09-29"].length === 2 &&
    props.find(r => r.clientId === c.c.id).date !== props.find(r => r.clientId === d.c.id).date);
  const pOk = props.find(r => r.clientId === ajour.c.id);
  t("client à jour : proposé près de son échéance (≥ 08/10)", pOk && pOk.date >= "2026-10-08");
  t("heures : 08:30 puis 10:30", parJour["2026-09-29"].map(r => r.heure).sort().join() === "08:30,10:30");
  t("propositions de type campagne, lignes à voir", props.every(r => r.type === "campagne" && r.ligneIds.length === 1));
  const r2 = D.proposerTournee(REF);
  t("refaire : anciennes propositions remplacées (pas de doublon)", D.listerRdv().filter(D.estPropose).length === r2.creees.length);
  t("dernière génération mémorisée", D.getTournee().derniereGeneration === REF && !D.propositionsAFaire("2026-10-02") === false);
  // Confirmation
  const un = D.listerRdv().filter(D.estPropose)[0];
  D.confirmerRdv(un.id);
  t("confirmer : statut confirmé", !D.estPropose(D.getRdv(un.id)));
  const r3 = D.proposerTournee(REF);
  t("refaire après confirmation : le confirmé reste, son client n'est pas reproposé", !!D.getRdv(un.id) && !r3.creees.some(r => r.clientId === un.clientId));
  const tous = D.confirmerTousLesRdv();
  t("tout confirmer", tous.length === r3.creees.length && D.listerRdv().filter(D.estPropose).length === 0);
  t("à clôturer : RDV confirmés passés", D.rdvACloturer("2026-12-01").length === D.listerRdv().length && D.rdvACloturer(REF).length === 0);
  // RDV saisi à la main : confirmé
  t("RDV manuel : confirmé", D.enregistrerRdv({ clientId: a.c.id, date: "2026-11-02" }).statut === "confirme");
  // Profil synchronisé avec la tournée
  const prof = D.elementsAEnvoyer().find(e => e.collection === "profil");
  t("réglages de tournée synchronisés avec le profil", prof && prof.contenu.tournee && prof.contenu.tournee.maxParJour === 2);

  // ---- Interface : propositions automatiques au chargement
  D.definirTournee({ jourAuto: D.jourSemaine(D.aujourdhuiIso()), derniereGeneration: null });
  D.listerRdv().forEach(r => D.supprimerRdv(r.id));
  const wd = page("Index.html", w.localStorage.getItem("acsc_donnees_v1"));
  const doc = wd.document;
  t("ouverture le jour choisi : propositions faites automatiquement", wd.Donnees.listerRdv().some(wd.Donnees.estPropose));
  t("accueil : encart court vers l'onglet Tournée", !!doc.querySelector('a.encart-tournee[href="Tournee.html"]') && doc.querySelector(".encart-tournee").textContent.includes("à confirmer"));
  t("bandeau à faire", doc.querySelector(".bandeau-a-faire").textContent.includes("à confirmer"));
  const wt = page("Tournee.html", wd.localStorage.getItem("acsc_donnees_v1"));
  const dt = wt.document;
  t("onglet Tournée : actif dans la navigation", !!dt.querySelector('.rail-lateral-lien.actif[href="Tournee.html"]'));
  t("onglet Tournée : propositions par jour avec « Confirmer »", !!dt.querySelector(".tournee-jour .ligne-rdv--propose [data-rdv-confirmer]"));
  const nb = wt.Donnees.listerRdv().filter(wt.Donnees.estPropose).length;
  dt.querySelector("[data-tout-confirmer]").click();
  const f = dt.querySelector(".feuille");
  t("tout confirmer : fenêtre « Prévenir les clients »", !f.hidden && f.textContent.includes("Prévenir les clients") && f.querySelectorAll(".apercu-ligne").length === nb);
  t("plus aucune proposition", wt.Donnees.listerRdv().filter(wt.Donnees.estPropose).length === 0);
  t("onglet Tournée : confirmés affichés", dt.body.textContent.includes("Confirmés sur les") && dt.querySelectorAll(".tournee-jour").length > 0);
  // ---- Message client : SMS pré-rédigé
  const cx = wt.Donnees.getClient(a.c.id);
  wt.Donnees.enregistrerContact(cx.id, { role: "Responsable sertissage", nom: "Martin", mobile: "06.11.22.33.44", email: "m@x.fr", principal: true });
  const rp = wt.Donnees.enregistrerRdv({ clientId: cx.id, date: "2026-10-06", heure: "09:00", statut: "propose", origine: "auto" });
  wt.Formulaires.apresConfirmation([wt.Donnees.confirmerRdv(rp.id)]);
  const sms = dt.querySelector('.feuille a[href^="sms:0611223344"]');
  t("message client : SMS au mobile avec texte", sms && decodeURIComponent(sms.getAttribute("href")).includes("je passerai chez A47 le mardi 6 octobre vers 09h00"));
  t("message client : email proposé", !!dt.querySelector('.feuille a[href^="mailto:m@x.fr"]'));
  wt.Donnees.definirTournee({ messageClient: false });
  wt.Formulaires.apresConfirmation([rp]);
  t("message client désactivé : simple confirmation", dt.querySelector(".feuille").hidden);
  // ---- Agenda .ics
  const ics = wt.Formulaires.fichierIcs([Object.assign({}, rp, { notes: "Quai 2; badge, casque" })]);
  t("agenda : événement complet", ics.startsWith("BEGIN:VCALENDAR") && ics.includes("DTSTART:20261006T090000") && ics.includes("DTEND:20261006T110000") &&
    ics.includes("SUMMARY:Campagne — A47") && ics.includes("TRIGGER:-P1D") && ics.includes("TRIGGER:-PT1H") && ics.includes("\r\n"));
  t("agenda : caractères échappés", ics.includes("Quai 2\\; badge\\, casque"));
  // ---- Clôture en un geste
  const passe = wt.Donnees.enregistrerRdv({ clientId: cx.id, date: "2026-09-20", heure: "08:00", ligneIds: [a.l.id] });
  const wd2 = page("Index.html", wt.localStorage.getItem("acsc_donnees_v1"));
  const cl = wd2.document.querySelector(".ligne-cloture");
  t("visite à clôturer : question posée", cl && cl.textContent.includes("La visite chez A47 du 20/09/2026") && cl.textContent.includes("a-t-elle eu lieu"));
  cl.querySelector("[data-rdv-faite]").click();
  t("« Oui » : saisie de la visite pré-remplie", !!wd2.document.getElementById("form-realiser"));
  wd2.document.getElementById("form-realiser").dispatchEvent(new wd2.Event("submit", { cancelable: true }));
  t("clôturée : visite enregistrée, RDV retiré", !wd2.Donnees.getRdv(passe.id) && wd2.Donnees.listerVisites().some(v => v.date === "2026-09-20" && v.clientId === cx.id));
  // ---- Modifier une visite
  const wf = page("Client.html", wd2.localStorage.getItem("acsc_donnees_v1"), "?id=" + cx.id);
  wf.document.querySelector('[data-onglet="historique"]').click();
  wf.document.querySelector("[data-modifier-visite]").click();
  const q = (s) => wf.document.querySelector(s);
  t("modifier une visite : formulaire pré-rempli", q(".feuille-titre").textContent.includes("Modifier la visite") && q("#fv-date").value === "2026-09-20" && q("#fv-ligne").value === a.l.id);
  wf.Donnees.definirStatutLigne(a.l.id, "inactive");
  wf.AppLayout.fermerFeuille();
  wf.document.querySelector('[data-onglet="historique"]').click();
  wf.document.querySelector("[data-modifier-visite]").click();
  t("modifier : ligne devenue inactive toujours proposée", q("#fv-ligne").value === a.l.id);
  q("#fv-remarques").value = "corrigé";
  q("#form-visite").dispatchEvent(new wf.Event("submit", { cancelable: true }));
  const vm = wf.Donnees.listerVisites().filter(v => v.clientId === cx.id);
  t("visite modifiée (pas de doublon)", vm.length === 1 && vm[0].remarques === "corrigé");
  // ---- Réglages de la tournée : dans l'onglet Tournée (plus dans Réglages)
  const wr = page("Tournee.html", wf.localStorage.getItem("acsc_donnees_v1"));
  const fr = wr.document.getElementById("form-tournee");
  t("onglet Tournée : réglages présents", !!fr && wr.document.querySelectorAll('input[name="rt-jour"]').length === 7);
  wr.document.getElementById("rt-max").value = "4";
  wr.document.querySelector('input[name="rt-jour"][value="6"]').checked = true;
  fr.dispatchEvent(new wr.Event("submit", { cancelable: true }));
  t("réglages enregistrés", wr.Donnees.getTournee().maxParJour === 4 && wr.Donnees.getTournee().jours.indexOf(6) !== -1);
  const wg = page("Reglages.html", wr.localStorage.getItem("acsc_donnees_v1"));
  t("Réglages : plus de carte Tournée", !wg.document.getElementById("form-tournee"));
  t("réglages : dernière sauvegarde « jamais »", wg.document.body.textContent.includes("Dernière sauvegarde exportée sur cet appareil : jamais"));
};
