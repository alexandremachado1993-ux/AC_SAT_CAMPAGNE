const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const serveur = require("./faux-serveur.js");

module.exports = async function ({ page, t }) {
  const S = serveur();
  const sync = async (w) => { await w.Synchro.synchroniser(); for (let i = 0; i < 200 && w.Synchro.etat().statut === "en-cours"; i++) await sleep(5); };

  // Alexandre (PC) : données avant l'équipe
  const pc = page("Reglages.html", null, "", S.transport("alex"));
  await sleep(40);
  const A = pc.Donnees;
  A.definirNomProfil("Alexandre");
  const c = A.ajouterClient({ nom: "Castelmoron", ville: "X", debutCampagne: 1, finCampagne: 12 });
  const l = A.enregistrerLigne(c.id, { nom: "Ligne 3" });
  const k = A.enregistrerContact(c.id, { role: "Responsable sertissage", nom: "Dupont" });
  A.enregistrerVisite({ ligneId: l.id, date: A.aujourdhuiIso(), type: "campagne", remarques: "visite Alex" });
  await sync(pc);
  t("équipe : carte « créer / rejoindre » quand connecté sans équipe", !!pc.document.querySelector("[data-creer-equipe]") && !!pc.document.querySelector("[data-rejoindre-equipe]"));

  // Création de l'équipe
  pc.document.getElementById("re-nom").value = "AC SAT Sud"; pc.document.getElementById("re-nom").dispatchEvent(new pc.Event("input"));
  pc.document.querySelector("[data-creer-equipe]").click();
  await sleep(120);
  const eq = pc.Synchro.etat().equipe;
  t("équipe créée, code affiché", eq && eq.nom === "AC SAT Sud" && pc.document.querySelector(".code-equipe").textContent === eq.code);
  const team = S.rowsEquipe[eq.id];
  t("clients / lignes / contacts envoyés à l'équipe", team.has("clients:" + c.id) && team.has("lignes:" + l.id) && team.has("contacts:" + k.id));
  t("visites NON envoyées à l'équipe", [...team.keys()].every(x => !x.startsWith("visites:")));
  t("membres affichés", pc.document.getElementById("carte-equipe").textContent.includes("Alexandre") && pc.document.getElementById("carte-equipe").textContent.includes("Créateur"));

  // Damien (appareil vide) rejoint
  const dam = page("Reglages.html", null, "", S.transport("damien"));
  await sleep(40);
  dam.Donnees.definirNomProfil("Damien");
  dam.document.getElementById("re-code").value = "mauvaisz"; dam.document.getElementById("re-code").dispatchEvent(new dam.Event("input"));
  dam.document.querySelector("[data-rejoindre-equipe]").click(); await sleep(60);
  t("code inconnu : message clair", dam.document.getElementById("carte-equipe").textContent.includes("Code d'équipe inconnu"));
  dam.document.getElementById("re-code").value = eq.code.toLowerCase(); dam.document.getElementById("re-code").dispatchEvent(new dam.Event("input"));
  dam.document.querySelector("[data-rejoindre-equipe]").click(); await sleep(150);
  const Dm = dam.Donnees;
  t("Damien : clients, lignes, contacts reçus", Dm.getClient(c.id) && Dm.getLigne(l.id) && Dm.contactsDuClient(c.id).length === 1);
  t("Damien : aucune visite d'Alexandre", Dm.listerVisites().length === 0);
  t("Damien : sa propre échéance (jamais vue)", Dm.calculerEcheances().lignes.find(e => e.ligne.id === l.id).statut === "jamais");
  t("Damien : membres = 2", dam.Synchro.etat().equipe.membres.length === 2);

  // Visite de Damien : privée
  Dm.enregistrerVisite({ ligneId: l.id, date: Dm.aujourdhuiIso(), type: "campagne", remarques: "visite Damien" });
  await sync(dam); await sync(pc);
  t("visite de Damien : pas chez Alexandre", !A.listerVisites().some(v => v.remarques === "visite Damien") && A.listerVisites().length === 1);
  // Modification partagée
  Dm.modifierClient(c.id, { notes: "note de Damien" });
  A.enregistrerLigne(c.id, { nom: "Ligne 5" });
  await sync(dam); await sync(pc); await sync(dam);
  t("modif de Damien reçue par Alexandre", A.getClient(c.id).notes === "note de Damien");
  t("nouvelle ligne d'Alexandre reçue par Damien", Dm.lignesDuClient(c.id).some(x => x.nom === "Ligne 5"));
  Dm.supprimerContact(k.id);
  await sync(dam); await sync(pc);
  t("suppression d'un contact partagée", A.contactsDuClient(c.id).length === 0);

  // Deuxième appareil d'Alexandre (vide)
  const tel = page("Index.html", null, "", S.transport("alex"));
  await sleep(40); await sync(tel);
  t("téléphone d'Alexandre : clients de l'équipe + ses visites seulement", tel.Donnees.getClient(c.id).notes === "note de Damien" &&
    tel.Donnees.listerVisites().length === 1 && tel.Donnees.listerVisites()[0].remarques === "visite Alex" && tel.Donnees.contactsDuClient(c.id).length === 0);

  // Nouveau membre avec ses propres clients : « remplacer »
  const d2 = page("Reglages.html", null, "", S.transport("damien2"));
  await sleep(40);
  const cd = d2.Donnees.ajouterClient({ nom: "Castelmoron (import Excel)", ville: "X" });
  d2.Donnees.enregistrerLigne(cd.id, { nom: "L" });
  const cdl = d2.Donnees.lignesDuClient(cd.id)[0];
  d2.Donnees.enregistrerVisite({ ligneId: cdl.id, date: d2.Donnees.aujourdhuiIso(), type: "campagne" });
  await sync(d2);
  d2.confirm = () => true;
  const r = await d2.Synchro.rejoindreEquipe(eq.code, true);
  await sleep(60);
  t("remplacer : ok, anciens clients retirés", r.ok && !d2.Donnees.getClient(cd.id) && !!d2.Donnees.getClient(c.id));
  t("remplacer : visites des anciens clients supprimées", d2.Donnees.listerVisites().length === 0);
  t("remplacer : l'équipe n'a pas reçu ses anciens clients", !S.rowsEquipe[eq.id].has("clients:" + cd.id));
  const d2b = page("Index.html", null, "", S.transport("damien2"));
  await sleep(40); await sync(d2b);
  t("remplacer : son autre appareil ne ressuscite pas l'ancien client", !d2b.Donnees.getClient(cd.id) && !!d2b.Donnees.getClient(c.id));

  // Nouveau membre « ajouter »
  const d3 = page("Index.html", null, "", S.transport("damien3"));
  await sleep(40);
  const c3 = d3.Donnees.ajouterClient({ nom: "Bonduelle", ville: "Nord" });
  await sync(d3);
  const r3 = await d3.Synchro.rejoindreEquipe(eq.code, false);
  await sync(pc);
  t("ajouter : ses clients partagés avec l'équipe", r3.ok && !!A.getClient(c3.id) && !!d3.Donnees.getClient(c.id));
  const r4 = await d3.Synchro.rejoindreEquipe(eq.code, false);
  t("déjà membre : message clair", !r4.ok && r4.message.includes("déjà partie d'une équipe"));

  // Quitter
  const rq = await dam.Synchro.quitterEquipe();
  A.modifierClient(c.id, { notes: "après départ" });
  await sync(pc); await sync(dam);
  t("quitter : clients conservés, plus de mises à jour de l'équipe", rq.ok && Dm.getClient(c.id).notes === "note de Damien" && dam.Synchro.etat().equipe === null);
  t("quitter : ses clients repartis vers son espace personnel", S.perso["damien"].has("clients:" + c.id));
  t("quitter : carte revenue à « créer / rejoindre »", !!dam.document.querySelector("[data-creer-equipe]"));
};
