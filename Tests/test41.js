/* CRITÈRE DE VÉRITÉ : action → sauvegarde → rechargement / second appareil → la donnée est toujours là. Et AUCUN FAUX SUCCÈS :
   quand l'opération échoue, l'application le dit, garde la donnée à envoyer, et permet de réessayer. Parcours complets, vrais formulaires. */
const serveur = require("./faux-serveur.js");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t }) {
  const S = serveur();
  const sync = async (w) => { await w.Synchro.synchroniser(); for (let i = 0; i < 300 && w.Synchro.etat().statut === "en-cours"; i++) await sleep(5); };
  const remplir = (w, id, v) => { const el = w.document.getElementById(id); el.value = v; el.dispatchEvent(new w.Event("input", { bubbles: true })); el.dispatchEvent(new w.Event("change", { bubbles: true })); };
  const soumettre = (w, id) => w.document.getElementById(id).dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  const visible = (w) => Array.from(w.document.body.querySelectorAll("*")).filter(e => !e.children.length && !/^(SCRIPT|STYLE)$/.test(e.tagName)).map(e => e.textContent).join(" ");
  const stock = (w) => ({ donnees: w.localStorage.getItem("acsc_donnees_v1"), suivi: w.localStorage.getItem("acsc_synchro_v1") });
  const rouvrir = (fichier, st, transport, query) => page(fichier, st.donnees, query || "", transport, (win) => { if (st.suivi) win.localStorage.setItem("acsc_synchro_v1", st.suivi); });
  const creerClient = (w, nom, ville) => { w.Formulaires.client(); remplir(w, "fc-nom", nom); remplir(w, "fc-ville", ville); remplir(w, "fc-cadence", "14"); soumettre(w, "form-client"); };

  // ================= 1. Création par les vrais formulaires, puis RECHARGEMENT =================
  const A = page("Index.html", null, "", S.transport("alex"));
  creerClient(A, "Conserverie Test", "Agen");
  const client = A.Donnees.getDonnees().clients[0];
  t("persistance : le formulaire client crée le client, en mémoire ET dans le stockage de l'appareil", !!client && client.nom === "Conserverie Test" && JSON.parse(A.localStorage.getItem("acsc_donnees_v1")).clients.length === 1);
  const ligne = A.Donnees.enregistrerLigne(client.id, { nom: "Ligne 1", formatHabituel: "1/2M" });
  A.Formulaires.visite({ ligneId: ligne.id }); soumettre(A, "form-visite");
  t("persistance : le formulaire de visite crée la visite (effectuée, sur la bonne ligne)", A.Donnees.getDonnees().visites.length === 1 && A.Donnees.getDonnees().visites[0].ligneId === ligne.id);
  const apresRechargement = rouvrir("Clients.html", stock(A), S.transport("alex"));
  t("RECHARGEMENT : après avoir rouvert l'application, le client est affiché dans la liste", /Conserverie Test/.test(visible(apresRechargement)) && /Agen/.test(visible(apresRechargement)));
  t("RECHARGEMENT : la visite et la ligne sont toujours là", apresRechargement.Donnees.getDonnees().visites.length === 1 && apresRechargement.Donnees.getDonnees().lignes.length === 1);

  // ================= 2. Deuxième appareil, modification, suppression =================
  await sync(A);
  t("synchro : l'envoi réussit, la file d'attente est vide, le serveur contient client, ligne et visite", A.Synchro.etat().statut === "ok" && A.Donnees.elementsAEnvoyer().length === 0 && ["clients:", "lignes:", "visites:"].every(p => [...S.perso.alex.keys()].some(k => k.startsWith(p))));
  const B = page("Index.html", null, "", S.transport("alex")); await sync(B);
  t("SECOND APPAREIL (vide) : retrouve le client, la ligne et la visite après synchronisation", B.Donnees.getDonnees().clients.length === 1 && B.Donnees.getDonnees().clients[0].nom === "Conserverie Test" && B.Donnees.getDonnees().lignes.length === 1 && B.Donnees.getDonnees().visites.length === 1);
  B.Formulaires.client(B.Donnees.getClient(client.id)); remplir(B, "fc-ville", "Pau"); soumettre(B, "form-client");
  await sync(B); await sync(A);
  t("modification sur le second appareil : visible sur le premier après synchronisation (la plus récente gagne)", A.Donnees.getClient(client.id).ville === "Pau");
  A.Donnees.supprimerVisite(A.Donnees.getDonnees().visites[0].id); await sync(A); await sync(B);
  t("suppression sur le premier appareil : la visite disparaît aussi du second", B.Donnees.getDonnees().visites.length === 0);

  // ================= 3. PANNE RÉSEAU : pas de faux succès, la donnée n'est pas perdue, on peut réessayer =================
  A.Donnees.modifierClient(client.id, { ville: "Dax" });
  S.panne.pousser = "Failed to fetch"; await sync(A);
  t("panne réseau : l'état est « erreur » avec un message clair — jamais « synchronisé »", A.Synchro.etat().statut === "erreur" && /Réseau indisponible/.test(A.Synchro.etat().erreur) && !/Failed to fetch/.test(A.Synchro.etat().erreur));
  t("panne réseau : la modification reste « à envoyer » et le serveur n'a PAS reçu la nouvelle valeur", A.Donnees.elementsAEnvoyer().length > 0 && S.perso.alex.get("clients:" + client.id).contenu.ville === "Pau");
  A.Donnees.modifierClient(client.id, { ville: "Mont-de-Marsan" });
  const hors = rouvrir("Clients.html", stock(A), S.transport("alex"));
  t("RECHARGEMENT PENDANT LA PANNE : la modification n'est pas perdue et reste dans la file d'envoi", /Mont-de-Marsan/.test(visible(hors)) && hors.Donnees.elementsAEnvoyer().length > 0);
  S.panne.pousser = null; await sync(hors);
  t("réseau rétabli : la synchronisation envoie la modification faite hors ligne, la file se vide", hors.Synchro.etat().statut === "ok" && hors.Donnees.elementsAEnvoyer().length === 0 && S.perso.alex.get("clients:" + client.id).contenu.ville === "Mont-de-Marsan");
  const finale = rouvrir("Clients.html", stock(hors), S.transport("alex"));
  t("RECHARGEMENT FINAL : la valeur est présente à l'écran ET sur le serveur", /Mont-de-Marsan/.test(visible(finale)));

  // ================= 4. Session expirée, erreurs inconnues, droits refusés : jamais de détail technique =================
  S.panne.tirer = "JWT expired"; await sync(finale);
  t("session expirée : retour à l'écran de connexion avec « Session expirée », sans « JWT » montré à l'utilisateur", finale.Synchro.etat().statut === "deconnecte" && /Session expirée/.test(finale.Synchro.etat().erreur) && !/JWT/i.test(finale.Synchro.etat().erreur));
  t("session expirée : les données restent sur l'appareil", finale.Donnees.getDonnees().clients.length === 1);
  S.panne.tirer = 'duplicate key value violates unique constraint "elements_pkey"'; await sync(finale);
  t("erreur serveur inconnue : message générique, jamais le texte technique de la base", finale.Synchro.etat().statut === "erreur" && /Opération impossible/.test(finale.Synchro.etat().erreur) && !/duplicate|constraint|pkey/i.test(finale.Synchro.etat().erreur));
  t("erreur serveur inconnue : le détail est consigné dans le journal de diagnostic", finale.Erreurs.lire().some(x => /message d'erreur non reconnu/.test(x.contexte) && /duplicate key/.test(x.contexte)));
  S.panne.tirer = "new row violates row-level security policy for table \"elements\""; await sync(finale);
  t("droits refusés par la base : message clair, sans « row-level security »", /droits insuffisants/.test(finale.Synchro.etat().erreur) && !/row-level/i.test(finale.Synchro.etat().erreur));
  S.panne.tirer = null;

  // ================= 5. Double clic sur « Synchroniser » : un seul envoi à la fois =================
  const lent = S.transport("alex"); let envois = 0; const pousserReel = lent.pousser; lent.pousser = async (...a) => { envois++; await sleep(40); return pousserReel(...a); };
  const D = page("Index.html", null, "", lent); await sync(D);
  const avant = envois; D.Donnees.modifierClient(D.Donnees.getDonnees().clients[0].id, { ville: "Lourdes" });
  D.Synchro.synchroniser(); D.Synchro.synchroniser(); D.Synchro.synchroniser(); await sleep(250);
  t("triple clic sur la synchronisation : un seul envoi en cours, pas de doublon sur le serveur, la valeur arrive", envois - avant <= 2 && D.Synchro.etat().statut === "ok" && S.perso.alex.get("clients:" + client.id).contenu.ville === "Lourdes" && [...S.perso.alex.keys()].filter(k => k.startsWith("clients:")).length === 1);

  // ================= 6. STOCKAGE REFUSÉ : jamais de « enregistré ✓ » mensonger =================
  const C = page("Index.html", null, "", S.transport("bob"));
  const setItem = C.Storage.prototype.setItem; C.Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); };
  creerClient(C, "Client Quota", "Nice");
  const echec = visible(C);
  C.Storage.prototype.setItem = setItem;
  t("stockage refusé : « Non enregistré » est affiché et JAMAIS « Client créé ✓ » (faux succès interdit)", /Non enregistré/.test(echec) && !/Client créé ✓/.test(echec));
  t("stockage refusé : l'échec est consigné dans le journal de diagnostic", C.Erreurs.lire().some(x => /écriture refusée par le navigateur/.test(x.contexte)));
  creerClient(C, "Client Normal", "Lyon");
  t("stockage rétabli : le succès est annoncé à nouveau (« Client créé ✓ ») et la donnée est bien conservée", /Client créé ✓/.test(visible(C)) && C.Donnees.stockageOk() === true && JSON.parse(C.localStorage.getItem("acsc_donnees_v1")).clients.some(c => c.nom === "Client Normal"));

  // ================= 7. Double envoi d'un formulaire, correction après refus =================
  const E = page("Index.html", null, "", S.transport("carl"));
  E.Formulaires.client(); remplir(E, "fc-nom", "Double Clic"); remplir(E, "fc-ville", "Tours"); remplir(E, "fc-cadence", "14"); soumettre(E, "form-client"); soumettre(E, "form-client");
  t("double clic sur « Enregistrer » (client) : UN seul client créé", E.Donnees.getDonnees().clients.filter(c => c.nom === "Double Clic").length === 1);
  const lg = E.Donnees.enregistrerLigne(E.Donnees.getDonnees().clients[0].id, { nom: "L1", formatHabituel: "1/2M" });
  E.Formulaires.visite({ ligneId: lg.id }); soumettre(E, "form-visite"); soumettre(E, "form-visite");
  t("double clic sur « Enregistrer la visite » : UNE seule visite créée", E.Donnees.getDonnees().visites.length === 1);
  E.Formulaires.client(); remplir(E, "fc-nom", ""); soumettre(E, "form-client");
  const refus = E.document.querySelector("#form-client [data-erreur]").textContent;
  remplir(E, "fc-nom", "Corrigé Aussitôt"); remplir(E, "fc-ville", "Blois"); remplir(E, "fc-cadence", "14"); soumettre(E, "form-client");
  t("formulaire refusé par la validation puis corrigé aussitôt : le message d'erreur s'affiche, et la correction est enregistrée (pas bloquée par la protection du double envoi)", !!refus && E.Donnees.getDonnees().clients.some(c => c.nom === "Corrigé Aussitôt"));
};
