const { JSDOM } = require("jsdom");
const fs = require("fs");
const P = require("path").join(__dirname, "..") + "/";
let ok = 0, ko = 0;
const t = (nom, cond) => { if (cond) ok++; else { ko++; console.log("❌ " + nom); } };

function page(fichier, stockage, query, transport, avant) {
  const html = fs.readFileSync(P + fichier, "utf8").replace(/<script src="(Js\/[^"]+)"(?: defer)?><\/script>/g,
    (m, src) => "<script>" + fs.readFileSync(P + src, "utf8") + "\n</script>")
    .replace(/<script src="(Vendor\/[^"]+)"><\/script>/g, (m, src) => "<script>" + fs.readFileSync(P + src, "utf8") + "\n</script>")
    .replace("Synchro.demarrer();", "Synchro.demarrer(window.__transport);")
    .replace("</body>", "<script>window.Synchro = Synchro; window.Donnees = Donnees; window.AppLayout = AppLayout; window.Formulaires = Formulaires; if (typeof SertiCalcul !== 'undefined') window.SertiCalcul = SertiCalcul; if (typeof ReferentielSerti !== 'undefined') window.ReferentielSerti = ReferentielSerti; if (typeof FicheSerti !== 'undefined') window.FicheSerti = FicheSerti; if (typeof SertiRapport !== 'undefined') window.SertiRapport = SertiRapport; if (typeof Nouveautes !== 'undefined') window.Nouveautes = Nouveautes; if (typeof Excel !== 'undefined') window.Excel = Excel; if (typeof EchangesExcel !== 'undefined') window.EchangesExcel = EchangesExcel;</script></body>");
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" + fichier + (query || ""), pretendToBeVisual: true,
    beforeParse(w) { try { w.sessionStorage.setItem("acsc_splash", "1"); w.localStorage.setItem("acsc_nouveautes_vue", "*"); } catch (e) {} if (avant) avant(w); if (transport) w.__transport = transport; if (stockage) w.localStorage.setItem("acsc_donnees_v1", stockage); w.confirm = () => true; w.fetch = () => Promise.reject(); } });
  /* Planning : le TABLEAU DE BORD est la vue par défaut de l'application. Les tests écrits avant lui (timeline, grille) gardent
     la timeline comme point de départ ; pour tester le tableau de bord : page("Planning.html", stock, "#tableau"). */
  if (fichier === "Planning.html" && !/#tableau/.test(query || "")) { const b = dom.window.document.querySelector('[data-vue="timeline"]'); if (b) b.click(); }
  return dom.window;
}
const erreurs = [];
// ---- Moteur
const w0 = page("Index.html");
const D = w0.Donnees;
t("page vide rend l'état vide", w0.document.body.textContent.includes("Aucun client pour l'instant"));
t("pas de cartes KPI sans client", !w0.document.querySelector(".metrique-carte"));
t("rail construit", !!w0.document.getElementById("rail-lateral"));
t("nav basse 4 liens + fab centré", w0.document.querySelectorAll(".nav-basse-lien").length === 4 && !!w0.document.querySelector(".fab-bouton"));
t("nav colonnes adaptées", w0.document.querySelector(".nav-basse-grille").style.gridTemplateColumns === "repeat(5, minmax(0, 1fr))");

const c = D.ajouterClient({ nom: "Conserverie A", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
const c2 = D.ajouterClient({ nom: "Hiver B", ville: "Pau", debutCampagne: 11, finCampagne: 3, cadenceJours: 21 });
t("ajout client", D.listerClients().length === 2);
t("borne cadence", D.ajouterClient({ nom: "X", cadenceJours: 200 }).cadenceJours === 60);
D.supprimerClients([D.trouverClientParNom("x").id]);
t("trouver par nom insensible accents/casse", D.trouverClientParNom("conserverie a").id === c.id);

t("en campagne sept", D.estEnCampagne(c, "2026-09-24"));
t("hors campagne déc", !D.estEnCampagne(c, "2026-12-01"));
t("campagne à cheval jan", D.estEnCampagne(c2, "2027-01-15"));
t("campagne à cheval sept hors", !D.estEnCampagne(c2, "2026-09-24"));
t("début campagne", D.debutCampagneEnCours(c, "2026-09-24") === "2026-05-01");
t("début campagne à cheval (jan → nov précédent)", D.debutCampagneEnCours(c2, "2027-01-15") === "2026-11-01");
t("début campagne à cheval (déc → nov même année)", D.debutCampagneEnCours(c2, "2026-12-15") === "2026-11-01");
t("écart jours DST", D.ecartJours("2026-03-28", "2026-03-30") === 2 && D.ecartJours("2026-10-24", "2026-10-26") === 2);
t("ajouter jours fin de mois", D.ajouterJours("2026-01-25", 14) === "2026-02-08");

const l1 = D.enregistrerLigne(c.id, { nom: "Ligne 1", formatHabituel: "4/4" });
const l2 = D.enregistrerLigne(c.id, { nom: "Ligne 2", suiviCampagne: false });
let e = D.calculerEcheances("2026-09-24");
t("ligne non suivie exclue", e.lignes.length === 1);
t("jamais vue", e.lignes[0].statut === "jamais");
t("hors campagne listé", e.horsCampagne.length === 1 && e.horsCampagne[0].client.id === c2.id);
D.enregistrerVisite({ ligneId: l1.id, date: "2026-09-01", type: "campagne" });
e = D.calculerEcheances("2026-09-24");
t("retard 9 j", e.lignes[0].statut === "retard" && e.lignes[0].joursRestants === -9);
D.enregistrerVisite({ ligneId: l1.id, date: "2026-09-22", type: "campagne" });
e = D.calculerEcheances("2026-09-24");
t("à jour", e.lignes[0].statut === "ok" && e.lignes[0].echeance === "2026-10-06");
t("bientôt", D.calculerEcheances("2026-10-04").lignes[0].statut === "bientot");
t("échéance jour J = bientot 0", D.calculerEcheances("2026-10-06").lignes[0].joursRestants === 0);
D.enregistrerVisite({ ligneId: l1.id, date: "2026-09-23", type: "maintenance" });
t("maintenance ne compte pas", D.calculerEcheances("2026-09-24").lignes[0].derniere.date === "2026-09-22");
t("visite d'une campagne précédente ignorée", D.calculerEcheances("2027-05-10").lignes[0].statut === "jamais");
t("visite future ignorée pour une date passée", D.calculerEcheances("2026-09-10").lignes[0].derniere.date === "2026-09-01");
t("visite date invalide refusée", D.enregistrerVisite({ ligneId: l1.id, date: "24/09/2026" }) === null);
t("client hiver en campagne sans ligne signalé", D.calculerEcheances("2026-12-10").sansLigne.some(x => x.id === c2.id) && D.calculerEcheances("2026-12-10").horsCampagne.length === 1);
const c3 = D.ajouterClient({ nom: "Sans ligne", ville: "Tulle" });
t("sansLigne", D.calculerEcheances("2026-09-24").sansLigne.some(x => x.id === c3.id));
D.modifierClient(c3.id, { actif: false });
t("inactif exclu", !D.calculerEcheances("2026-09-24").sansLigne.some(x => x.id === c3.id));

// contacts
const k1 = D.enregistrerContact(c.id, { role: "Responsable logistique", nom: "Martin", principal: true });
const k2 = D.enregistrerContact(c.id, { role: "Responsable sertissage", nom: "Durand", principal: true });
t("un seul principal", D.contactsDuClient(c.id).filter(k => k.principal).length === 1 && D.contactsDuClient(c.id)[0].id === k2.id);

// export / import
const json = D.exporter();
t("import invalide refusé", !D.importer("{pas du json").ok && !D.importer('{"a":1}').ok);
const r = D.importer(json);
t("import restaure", r.ok && D.getDonnees().visites.length === 3 && D.getDonnees().contacts.length === 2);

// suppression cascade
D.supprimerLigne(l1.id);
t("cascade ligne → visites", D.getDonnees().visites.length === 0);
D.supprimerClients([c.id]);
t("cascade client", D.getDonnees().lignes.length === 0 && D.getDonnees().contacts.length === 0);

// ---- Rendu avec données
const w1 = page("Index.html");
const D1 = w1.Donnees;
const a = D1.ajouterClient({ nom: "Alpha <b>x</b>", ville: "Agen", debutCampagne: 1, finCampagne: 12 });
const la = D1.enregistrerLigne(a.id, { nom: "L1", formatHabituel: "4/4", produitHabituel: "Tomates" });
D1.enregistrerContact(a.id, { role: "Responsable sertissage", prenom: "Jean", nom: "Dupont", mobile: "06 11 22 33 44" });
t("carte à visiter rendue", !!w1.document.querySelector(".carte-a-visiter"));
t("échappement HTML nom", !w1.document.querySelector(".carte-a-visiter-nom b") && w1.document.querySelector(".carte-a-visiter-nom").textContent.includes("<b>"));
t("lien tel", w1.document.querySelector('a[href="tel:0611223344"]') !== null);
t("badge nav = 1", w1.document.querySelector("[data-badge-a-visiter]").textContent === "1" && !w1.document.querySelector("[data-badge-a-visiter]").hidden);
t("4 KPI", w1.document.querySelectorAll(".metrique-carte").length === 4);
// Formulaire visite via bouton
w1.document.querySelector("[data-visite]").click();
t("feuille ouverte", !w1.document.querySelector(".feuille").hidden);
t("format prérempli", w1.document.getElementById("fv-format").value === "4/4");
t("type campagne proposé", w1.document.getElementById("fv-type").value === "campagne");
w1.document.getElementById("fv-date").value = "2999-01-01";
w1.document.getElementById("form-visite").dispatchEvent(new w1.Event("submit", { cancelable: true }));
t("date à venir : aucune visite enregistrée, la planification s'ouvre à la place", D1.getDonnees().visites.length === 0 && !!w1.document.getElementById("form-rdv") && w1.document.getElementById("fr-date").value === "2999-01-01");
w1.AppLayout.fermerFeuille(); w1.document.querySelector("[data-visite]").click();
w1.document.getElementById("fv-date").value = D1.aujourdhuiIso();
w1.document.getElementById("form-visite").dispatchEvent(new w1.Event("submit", { cancelable: true }));
t("visite enregistrée", D1.getDonnees().visites.length === 1);
t("feuille fermée", w1.document.querySelector(".feuille").hidden);
t("tableau → rien en attente", w1.document.body.textContent.includes("Rien en attente"));
t("badge masqué", w1.document.querySelector("[data-badge-a-visiter]").hidden);
// filtre KPI ok
w1.document.querySelector('[data-filtre="ok"]').click();
t("filtre À jour", !!w1.document.querySelector(".carte-a-visiter"));
w1.document.querySelector('[data-filtre="ok"]').click();
t("re-clic retire filtre", w1.document.body.textContent.includes("Rien en attente"));
const stock = w1.localStorage.getItem("acsc_donnees_v1");

// ---- Page Clients
const w2 = page("Clients.html", stock);
t("clients : 1 carte", w2.document.querySelectorAll(".carte-client-campagne").length === 1);
w2.document.querySelector("[data-nouveau-client]").click();
w2.document.getElementById("fc-nom").value = "alpha <B>X</B>";
w2.document.getElementById("fc-ville").value = "Pau";
w2.document.getElementById("form-client").dispatchEvent(new w2.Event("submit", { cancelable: true }));
t("homonyme refusé", w2.document.querySelector("[data-erreur]").textContent.includes("déjà"));
w2.document.getElementById("fc-nom").value = "Bêta";
w2.document.getElementById("fc-cadence").value = "5";
w2.document.getElementById("form-client").dispatchEvent(new w2.Event("submit", { cancelable: true }));
t("cadence invalide refusée", w2.document.querySelector("[data-erreur]").textContent.includes("cadence"));
w2.document.getElementById("fc-cadence").value = "21";
w2.document.getElementById("fc-debut").value = "12";
w2.document.getElementById("fc-fin").value = "2";
w2.document.getElementById("form-client").dispatchEvent(new w2.Event("submit", { cancelable: true }));
t("client créé", w2.Donnees.listerClients().length === 2);
const beta = w2.Donnees.trouverClientParNom("beta");
t("valeurs campagne", beta.debutCampagne === 12 && beta.finCampagne === 2 && beta.cadenceJours === 21);
// recherche
const champ = w2.document.getElementById("champ-recherche");
if (champ) { champ.value = "beta"; champ.dispatchEvent(new w2.Event("input")); }
t("recherche sans accent", w2.document.querySelectorAll(".carte-client-campagne").length === 1);

// ---- Fiche
const stock2 = w2.localStorage.getItem("acsc_donnees_v1");
const w3 = page("Client.html", stock2, "?id=" + encodeURIComponent(beta.id));
t("fiche titre", w3.document.querySelector(".fiche-titre").textContent === "Bêta");
t("pas de bouton visite sans ligne", !w3.document.querySelector(".fiche-actions [data-nouvelle-visite]"));
w3.document.querySelector("[data-ajouter-ligne]").click();
w3.document.getElementById("fl-nom").value = "Ligne A";
w3.document.getElementById("form-ligne").dispatchEvent(new w3.Event("submit", { cancelable: true }));
t("ligne ajoutée + rendu", w3.document.querySelectorAll(".carte-ligne").length === 1);
w3.document.querySelector("[data-ajouter-ligne]").click();
w3.document.getElementById("fl-nom").value = "ligne a";
w3.document.getElementById("form-ligne").dispatchEvent(new w3.Event("submit", { cancelable: true }));
t("doublon ligne refusé", w3.document.querySelector("[data-erreur]").textContent.includes("déjà"));
w3.AppLayout.fermerFeuille();
w3.document.querySelector('[data-onglet="contacts"]').click();
w3.document.querySelector("[data-ajouter-contact]").click();
t("rôles proposés : 9 rôles fixes + Autre… (saisie libre)", [...w3.document.querySelectorAll("#fk-role option")].filter(o => o.value !== "" && o.value !== "__libre__").length >= 9 && !!w3.document.querySelector("#fk-role option[value=__libre__]"));
w3.document.getElementById("fk-nom").value = "Lopez";
w3.document.getElementById("fk-role").value = "Responsable logistique";
w3.document.getElementById("form-contact").dispatchEvent(new w3.Event("submit", { cancelable: true }));
t("contact affiché, onglet conservé", w3.document.body.textContent.includes("Lopez") && w3.document.querySelector(".onglet-fiche.actif").dataset.onglet === "contacts");
w3.document.querySelector('[data-onglet="infos"]').click();
t("infos campagne", w3.document.body.textContent.includes("Décembre → Février"));
w3.document.querySelector('[data-onglet="historique"]').click();
t("historique vide", w3.document.body.textContent.includes("Aucune visite"));
const w4 = page("Client.html", stock2, "?id=inconnu");
t("client inconnu", w4.document.body.textContent.includes("n'existe pas"));

// ---- Réglages
const w5 = page("Reglages.html", w3.localStorage.getItem("acsc_donnees_v1"));
t("stats réglages", w5.document.body.textContent.includes("Clients2") || /Clients\s*2/.test(w5.document.body.textContent));
w5.document.querySelector('[data-theme="dark"]').click();
t("thème sombre appliqué", w5.document.documentElement.classList.contains("dark"));
t("carte sombre active", w5.document.querySelector('[data-theme="dark"]').classList.contains("carte-apparence--actif"));

// ---- Stockage corrompu
const w6 = page("Index.html", "{corrompu");
t("stockage corrompu → vide sans plantage", w6.document.body.textContent.includes("Aucun client"));

module.exports = { page, t, P, fs };
require("./test2.js")(module.exports, () => require("./test3.js")(module.exports).then(() => require("./test4.js")(module.exports)).then(() => require("./test5.js")(module.exports)).then(() => require("./test7.js")(module.exports)).then(() => require("./test8.js")(module.exports)).then(() => require("./test9.js")(module.exports)).then(() => require("./test10.js")(module.exports)).then(() => require("./test11.js")(module.exports)).then(() => require("./test12.js")(module.exports)).then(() => require("./test13.js")(module.exports)).then(() => require("./test14.js")(module.exports)).then(() => require("./test15.js")(module.exports)).then(() => require("./test16.js")(module.exports)).then(() => require("./test17.js")(module.exports)).then(() => require("./test18.js")(module.exports)).then(() => require("./test19.js")(module.exports)).then(() => require("./test20.js")(module.exports)).then(() => require("./test21.js")(module.exports)).then(() => require("./test23.js")(module.exports)).then(() => require("./test24.js")(module.exports)).then(() => require("./test25.js")(module.exports)).then(() => require("./test26.js")(module.exports)).then(() => require("./test27.js")(module.exports)).then(() => require("./test28.js")(module.exports)).then(() => require("./test29.js")(module.exports)).then(() => require("./test30.js")(module.exports)).then(() => require("./test31.js")(module.exports)).then(() => require("./test32.js")(module.exports)).then(() => require("./test33.js")(module.exports)).then(() => require("./test34.js")(module.exports)).then(() => require("./test35.js")(module.exports)).then(() => require("./test36.js")(module.exports)).then(() => require("./test37.js")(module.exports)).then(() => require("./test22.js")(module.exports)).then(() => { console.log(ok + " ✅  " + ko + " ❌"); process.exit(ko ? 1 : 0); }));
