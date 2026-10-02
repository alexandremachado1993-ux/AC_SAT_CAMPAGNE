const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t }) {
  // ---------- Données
  const w = page("Client.html");
  const D = w.Donnees;
  const c1 = D.ajouterClient({ nom: "À supprimer", ville: "X" }), c2 = D.ajouterClient({ nom: "Autre à supprimer", ville: "Y" }), c3 = D.ajouterClient({ nom: "À garder", ville: "Z" });
  const l1 = D.enregistrerLigne(c1.id, { nom: "L1" }), l3 = D.enregistrerLigne(c3.id, { nom: "L3" });
  D.enregistrerContact(c1.id, { role: "Autre", nom: "Dupont" });
  D.enregistrerVisite({ ligneId: l1.id, date: D.aujourdhuiIso(), type: "campagne" });
  D.enregistrerRdv({ clientId: c1.id, date: D.ajouterJours(D.aujourdhuiIso(), 3) });
  D.enregistrerVisite({ ligneId: l3.id, date: D.aujourdhuiIso(), type: "campagne" });
  const r = D.resumeSuppression([c1.id, c2.id]);
  t("résumé : ce qui serait emporté", r.nbClients === 2 && r.nbLignes === 1 && r.nbContacts === 1 && r.nbVisites === 1 && r.nbRdv === 1);
  const avant = JSON.stringify(D.getDonnees());
  const copie = D.supprimerClients([c1.id, c2.id]);
  t("suppression groupée en cascade", D.listerClients().length === 1 && D.getDonnees().lignes.length === 1 && D.getDonnees().contacts.length === 0 && D.listerVisites().length === 1 && D.listerRdv().length === 0);
  t("copie de sauvegarde complète", copie.clients.length === 2 && copie.lignes.length === 1 && copie.visites.length === 1 && copie.rdv.length === 1 && copie.contacts.length === 1);
  t("restauration : 2 clients, données retrouvées", D.restaurerClients(copie) === 2 && D.listerClients().length === 3 && D.getLigne(l1.id) && D.visitesDuClient(c1.id).length === 1);
  t("restauration : rien en double si on la refait", D.restaurerClients(copie) === 0 && D.listerClients().length === 3);
  const wv = page("Client.html", w.localStorage.getItem("acsc_donnees_v1"), "?id=" + c1.id);
  t("restauration : le contenu revient à l'identique", JSON.stringify(wv.Donnees.getClient(c1.id)).length > 0 && wv.Donnees.contactsDuClient(c1.id)[0].nom === "Dupont");

  // ---------- Fiche : bouton visible, confirmation, annulation
  const q = (s) => wv.document.querySelector(s);
  t("fiche : bouton « Supprimer » dans l'en-tête", !!q(".fiche-actions [data-supprimer-client]") && q(".fiche-actions [data-supprimer-client]").textContent.includes("Supprimer"));
  q(".fiche-actions [data-supprimer-client]").click();
  const f = q(".feuille");
  t("confirmation : titre, nom et contenu emporté", f.textContent.includes("Supprimer ce client ?") && f.textContent.includes("À supprimer") && f.textContent.includes("lignes") === false && f.textContent.includes("1") && f.textContent.includes("visite"));
  t("confirmation : mention de l'annulation possible", f.textContent.includes("annuler pendant 10 secondes"));
  q("[data-annuler-suppression]").click();
  t("« Annuler » ferme sans rien supprimer", q(".feuille").hidden && !!wv.Donnees.getClient(c1.id));
  // depuis « Modifier » : zone sensible
  q("[data-modifier-client]").click();
  t("« Modifier » : zone sensible avec bouton de suppression", !!q(".zone-danger") && !!q("[data-supprimer-ce-client]"));
  q("[data-supprimer-ce-client]").click();
  t("« Modifier » → même confirmation", q(".feuille").textContent.includes("Supprimer ce client ?"));
  q("[data-confirmer-suppression]").click();
  t("confirmé : client supprimé", !wv.Donnees.getClient(c1.id));
  const memo = JSON.parse(wv.sessionStorage.getItem("acsc_annuler_suppression") || "null");
  t("depuis la fiche : copie gardée pour proposer « Annuler » sur la page suivante", memo && memo.copie.clients.length === 1 && memo.copie.lignes.length === 1);

  // ---------- Page suivante : proposition d'annuler
  const wl = page("Clients.html", wv.localStorage.getItem("acsc_donnees_v1"), "", null, (win) => { win.sessionStorage.setItem("acsc_annuler_suppression", JSON.stringify(memo)); });
  await sleep(50);
  const toast = wl.document.querySelector('[role="status"]');
  t("liste : message « 1 client supprimé » avec bouton Annuler", toast && toast.textContent.includes("1 client supprimé") && toast.textContent.includes("Annuler"));
  toast.querySelector("button").click();
  t("« Annuler » restaure le client et ses données", !!wl.Donnees.getClient(c1.id) && wl.Donnees.lignesDuClient(c1.id).length === 1 && wl.Donnees.visitesDuClient(c1.id).length === 1);
  const wl2 = page("Clients.html", wl.localStorage.getItem("acsc_donnees_v1"), "", null, (win) => { win.sessionStorage.setItem("acsc_annuler_suppression", JSON.stringify({ le: Date.now() - 60000, copie: memo.copie })); });
  await sleep(30);
  t("copie trop ancienne (> 15 s) : pas de proposition", !wl2.document.querySelector('[role="status"]'));

  // ---------- Liste : sélection multiple
  const ws = page("Clients.html", wl.localStorage.getItem("acsc_donnees_v1"));
  const s = (x) => ws.document.querySelector(x);
  t("liste : bouton « Sélectionner »", !!s("[data-mode-selection]") && s("[data-mode-selection]").textContent.includes("Sélectionner"));
  s("[data-mode-selection]").click();
  t("mode sélection : cartes cochables (plus de liens), barre d'actions", ws.document.querySelectorAll('[role="checkbox"]').length === 3 && !s("a.carte-client-campagne") && !!s(".barre-selection"));
  t("aucune sélection : suppression désactivée", s("[data-supprimer-selection]").disabled && s("[data-compte-selection]").textContent === "Aucun client sélectionné");
  s('[data-selectionner="' + c1.id + '"]').click(); s('[data-selectionner="' + c2.id + '"]').click();
  t("2 sélectionnés : compteur, cases cochées, bouton actif", s("[data-compte-selection]").textContent === "2 sélectionnés" && s('[data-selectionner="' + c1.id + '"]').getAttribute("aria-checked") === "true" && !s("[data-supprimer-selection]").disabled);
  s('[data-selectionner="' + c2.id + '"]').dispatchEvent(new ws.KeyboardEvent("keydown", { key: " " }));
  t("clavier (Espace) : décoche", s("[data-compte-selection]").textContent === "1 sélectionné");
  s("[data-tout-selectionner]").click();
  t("« Tout sélectionner »", s("[data-compte-selection]").textContent === "3 sélectionnés" && s("[data-tout-selectionner]").textContent === "Tout désélectionner");
  s("[data-tout-selectionner]").click();
  t("« Tout désélectionner »", s("[data-compte-selection]").textContent === "Aucun client sélectionné");
  s('[data-selectionner="' + c1.id + '"]').click(); s('[data-selectionner="' + c2.id + '"]').click();
  s("[data-supprimer-selection]").click();
  t("confirmation de la sélection : « Supprimer 2 clients ? »", s(".feuille").textContent.includes("Supprimer 2 clients ?") && s(".feuille").textContent.includes("À supprimer") && s(".feuille").textContent.includes("Autre à supprimer"));
  s("[data-confirmer-suppression]").click();
  t("sélection supprimée, mode sélection terminé", ws.Donnees.listerClients().length === 1 && !s("[data-mode-selection]").textContent.includes("Terminer") && ws.document.querySelectorAll(".carte-client-campagne").length === 1);
  const t2 = ws.document.querySelector('[role="status"]');
  t("annulation proposée : « 2 clients supprimés »", t2 && t2.textContent.includes("2 clients supprimés"));
  t2.querySelector("button").click();
  t("« Annuler » : 3 clients de retour", ws.Donnees.listerClients().length === 3 && ws.Donnees.visitesDuClient(c1.id).length === 1);
  s("[data-mode-selection]").click(); s("[data-mode-selection]").click();
  t("« Terminer » : retour à la liste normale", !!s("a.carte-client-campagne") && !s(".barre-selection"));

  // ---------- Équipe : avertissement
  const equipe = { id: "eq1", nom: "AC SAT Sud", code: "K7PM2XQA", role: "proprietaire", membres: [{ id: "u1", nom: "Alexandre", role: "proprietaire", moi: true }] };
  const tr = { utilisateur: async () => "alex@test.fr", connexion: async () => {}, deconnexion: async () => {}, tirer: async () => [], pousser: async () => {}, monEquipe: async () => equipe };
  const we = page("Client.html", ws.localStorage.getItem("acsc_donnees_v1"), "?id=" + c3.id, tr);
  await sleep(100);
  we.document.querySelector(".fiche-actions [data-supprimer-client]").click();
  t("équipe : avertissement « disparaîtront aussi chez tes collègues »", we.document.querySelector(".feuille").textContent.includes("AC SAT Sud") && we.document.querySelector(".feuille").textContent.includes("chez tes collègues"));

  // ---------- Synchronisation : supprimer, envoyer, annuler → la restauration l'emporte
  const serveur = new Map(); let horloge = Date.parse("2026-09-29T10:00:00Z");
  const upsert = (e) => { const cle = e.collection + ":" + e.id, ex = serveur.get(cle);
    if (!ex || Date.parse(ex.maj_client) <= Date.parse(e.maj_client)) serveur.set(cle, { collection: e.collection, id: e.id, contenu: JSON.parse(JSON.stringify(e.contenu)), maj_client: e.maj_client, supprime: !!e.supprime, maj_serveur: new Date(++horloge).toISOString() }); };
  const tp = () => ({ utilisateur: async () => "alex@test.fr", connexion: async () => {}, deconnexion: async () => {},
    tirer: async (depuis, strict) => [...serveur.values()].filter(x => !depuis || (strict ? Date.parse(x.maj_serveur) > Date.parse(depuis) : Date.parse(x.maj_serveur) >= Date.parse(depuis))).sort((a, b) => Date.parse(a.maj_serveur) - Date.parse(b.maj_serveur)).map(x => JSON.parse(JSON.stringify(x))),
    pousser: async (lot) => { lot.forEach(upsert); } });
  const sync = async (p) => { await p.Synchro.synchroniser(); for (let i = 0; i < 100 && p.Synchro.etat().statut === "en-cours"; i++) await sleep(5); };
  const pa = page("Reglages.html", null, "", tp()); await sleep(50);
  const cs = pa.Donnees.ajouterClient({ nom: "Synchro SA", ville: "S" }); pa.Donnees.enregistrerLigne(cs.id, { nom: "LS" });
  await sync(pa);
  const pb = page("Index.html", null, "", tp()); await sleep(50); await sync(pb);
  t("sync : le client existe sur l'autre appareil", !!pb.Donnees.getClient(cs.id));
  const cp = pa.Donnees.supprimerClients([cs.id]); await sync(pa); await sync(pb);
  t("sync : la suppression est reçue par l'autre appareil", !pb.Donnees.getClient(cs.id) && serveur.get("clients:" + cs.id).supprime === true);
  await sleep(5);
  pa.Donnees.restaurerClients(cp); await sync(pa); await sync(pb);
  t("sync : « Annuler » après envoi — la restauration l'emporte partout", !!pb.Donnees.getClient(cs.id) && pb.Donnees.lignesDuClient(cs.id).length === 1 && serveur.get("clients:" + cs.id).supprime === false);
};
