/* Bilan de fin de campagne : calcul des fenêtres, états, tableau de bord, réglage. */
module.exports = async function ({ page, t }) {
  const w0 = page("Index.html"); const D = w0.Donnees;
  const A = D.ajouterClient({ nom: "A Mai-Nov", ville: "X", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const B = D.ajouterClient({ nom: "B Nov-Mars", ville: "Y", debutCampagne: 11, finCampagne: 3, cadenceJours: 14 });
  const noms = (ref) => D.bilansAPlanifier(ref).map(b => b.client.nom).join();

  // ---- bornes de campagne
  t("campagne en cours (mai → nov.)", JSON.stringify(D.bornesCampagne(A, "2026-10-02")) === JSON.stringify({ debut: "2026-05-01", fin: "2026-11-30" }));
  t("campagne dernière commencée, en hiver (avant la reprise)", D.bornesCampagne(A, "2026-03-10").fin === "2025-11-30" && D.bornesCampagne(A, "2026-03-10").debut === "2025-05-01");
  t("juste après la fin : c'est toujours la campagne qui vient de finir", D.bornesCampagne(A, "2026-12-15").fin === "2026-11-30");
  t("campagne à cheval sur deux années (nov. → mars)", D.bornesCampagne(B, "2026-12-15").debut === "2026-11-01" && D.bornesCampagne(B, "2026-12-15").fin === "2027-03-31" && D.bornesCampagne(B, "2027-04-05").fin === "2027-03-31");
  t("février bissextile : fin de mois exacte", D.bornesCampagne(D.ajouterClient({ nom: "C", ville: "Z", debutCampagne: 10, finCampagne: 2 }), "2028-01-10").fin === "2028-02-29");

  // ---- fenêtre de rappel : 6 semaines avant la fin → 60 jours après
  t("réglage par défaut : 6 semaines", D.getTournee().bilanSemaines === 6);
  t("trop tôt : pas de rappel (18/10 pour une fin au 30/11)", noms("2026-10-18") === "B Nov-Mars" || !noms("2026-10-18").includes("A Mai-Nov"));
  t("à 6 semaines pile : rappel (19/10)", noms("2026-10-19").includes("A Mai-Nov"));
  t("après la fin : encore rappelé (10/12), « il y a 10 jours »", D.bilansAPlanifier("2026-12-10").find(b => b.client.nom === "A Mai-Nov").joursAvantFin === -10);
  t("60 jours après la fin : dernier jour (29/01) puis silence", noms("2027-01-29").includes("A Mai-Nov") && !noms("2027-01-30").includes("A Mai-Nov"));
  t("campagne à cheval : rappel 6 semaines avant fin mars, pas avant", !noms("2026-12-15").includes("B Nov-Mars") && !noms("2027-02-16").includes("B Nov-Mars") && noms("2027-02-17").includes("B Nov-Mars") && noms("2027-04-05").includes("B Nov-Mars"));
  t("nouvelle campagne : le bilan de l'an dernier n'est plus rappelé", !noms("2027-05-10").includes("A Mai-Nov"));

  // ---- états : à planifier / planifié / fait
  t("sans rendez-vous : « à planifier »", D.bilansAPlanifier("2026-11-10").find(b => b.client.nom === "A Mai-Nov").statut === "a_planifier");
  const r = D.enregistrerRdv({ clientId: A.id, date: "2026-12-03", type: "reunion-fin", ligneIds: [] });
  const b1 = D.bilansAPlanifier("2026-11-10").find(b => b.client.nom === "A Mai-Nov");
  t("rendez-vous de bilan existant : « planifié » à sa date", b1.statut === "planifie" && b1.rdv.date === "2026-12-03");
  t("un rendez-vous d'un autre type ne compte pas", (D.enregistrerRdv({ clientId: B.id, date: "2027-03-20", type: "maintenance", ligneIds: [] }), D.bilansAPlanifier("2027-03-01").find(b => b.client.nom === "B Nov-Mars").statut === "a_planifier"));
  D.enregistrerVisite({ clientId: A.id, ligneId: null, date: "2026-12-04", type: "reunion-fin", statut: "non-effectuee", motif: "Client absent" });
  t("une réunion « non effectuée » ne vaut pas bilan fait", noms("2026-12-10").includes("A Mai-Nov"));
  D.enregistrerVisite({ clientId: A.id, ligneId: null, date: "2026-12-05", type: "reunion-fin" });
  t("réunion de fin de campagne effectuée : bilan fait, plus rappelé", !noms("2026-12-10").includes("A Mai-Nov"));
  D.enregistrerVisite({ clientId: B.id, ligneId: null, date: "2026-01-15", type: "reunion-fin" });
  t("une réunion antérieure au début de CETTE campagne ne compte pas", noms("2027-04-05").includes("B Nov-Mars"));

  // ---- exclusions et réglage
  const Z = D.ajouterClient({ nom: "Z inactif", ville: "Q", debutCampagne: 5, finCampagne: 11, actif: false });
  t("client inactif : jamais rappelé", !noms("2026-11-10").includes("Z inactif"));
  t("réglage borné (0 à 12) et valeur illisible → 6", D.definirTournee({ bilanSemaines: 99 }).bilanSemaines === 12 && D.definirTournee({ bilanSemaines: "abc" }).bilanSemaines === 6 && D.definirTournee({ bilanSemaines: -4 }).bilanSemaines === 0);
  t("0 = jamais de rappel", D.bilansAPlanifier("2026-11-10").length === 0);
  D.definirTournee({ bilanSemaines: 6 });

  // ---- date proposée
  t("date proposée : lendemain de la fin, jour travaillé (fin un samedi → lundi)", D.dateBilanParDefaut({ fin: "2026-10-31" }, "2026-10-20") === "2026-11-02");
  t("date proposée : fin au 30/11 → mardi 1er décembre", D.dateBilanParDefaut({ fin: "2026-11-30" }, "2026-10-20") === "2026-12-01");
  t("date proposée : fin dépassée → demain (jour travaillé)", D.dateBilanParDefaut({ fin: "2026-11-30" }, "2026-12-10") === "2026-12-11");

  // ---- tableau de bord (date réelle : campagne qui se termine ce mois-ci, donc toujours dans la fenêtre)
  const m = new Date().getMonth() + 1, deb = ((m - 3 + 12) % 12) + 1;
  const w1 = page("Index.html"); const D1 = w1.Donnees;
  const H = D1.ajouterClient({ nom: "Fin ce mois SA", ville: "X", debutCampagne: deb, finCampagne: m, cadenceJours: 14 });
  const wp = page("Index.html", w1.localStorage.getItem("acsc_donnees_v1")); const d = wp.document;
  const bloc = d.querySelector(".bloc-bilans");
  t("tableau de bord : carte « Bilans de fin de campagne »", !!bloc && /Fin ce mois SA/.test(bloc.textContent) && /1 à planifier/.test(bloc.textContent));
  t("la carte précise la fin de campagne", /Campagne jusqu'au|Campagne terminée le/.test(bloc.textContent));
  d.querySelector("[data-bilan-planifier]").click();
  const bilan = wp.Donnees.bilansAPlanifier().find(b => b.client.id === H.id);
  t("« Planifier » : formulaire prérempli (client, type réunion de fin, date proposée)", !!d.querySelector(".feuille:not([hidden]) #form-rdv") && d.getElementById("fr-client").value === H.id && d.getElementById("fr-type").value === "reunion-fin" && d.getElementById("fr-date").value === wp.Donnees.dateBilanParDefaut(bilan));
  d.getElementById("form-rdv").dispatchEvent(new wp.Event("submit", { cancelable: true }));
  const rdv = wp.Donnees.listerRdv().find(x => x.type === "reunion-fin");
  t("enregistrer : rendez-vous créé sans ligne", !!rdv && rdv.clientId === H.id && rdv.ligneIds.length === 0);
  t("la carte passe à « Prévu le … » (plus de bouton)", /Prévu le/.test(d.querySelector(".bloc-bilans").textContent) && !d.querySelector("[data-bilan-planifier]"));

  // ---- réglage dans la page Tournée
  const wt = page("Tournee.html", w1.localStorage.getItem("acsc_donnees_v1"));
  const sel = wt.document.getElementById("rt-bilan");
  t("Tournée : réglage « Bilan de fin de campagne » (6 semaines par défaut)", !!sel && sel.value === "6" && sel.options.length === 6);
  sel.value = "0"; sel.closest("form").dispatchEvent(new wt.Event("submit", { cancelable: true }));
  t("Tournée : le réglage est enregistré", wt.Donnees.getTournee().bilanSemaines === 0);
  const wq = page("Index.html", wt.localStorage.getItem("acsc_donnees_v1"));
  t("réglage à « Jamais » : la carte disparaît du tableau de bord", !wq.document.querySelector(".bloc-bilans"));
};
