const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function serveur() {
  const lignes = new Map();
  let horloge = Date.parse("2026-09-24T10:00:00Z");
  const appels = { pousser: 0, tirer: 0 };
  return {
    lignes, appels,
    transport(email) {
      let connecte = !!email;
      return {
        utilisateur: async () => connecte ? email : null,
        connexion: async (e, m) => { if (m !== "bonmotdepasse") throw new Error("Invalid login credentials"); email = e; connecte = true; },
        inscription: async () => ({ confirmationRequise: true }),
        deconnexion: async () => { connecte = false; },
        tirer: async (depuis, strict) => {
          appels.tirer++;
          return [...lignes.values()].filter(r => !depuis || (strict ? Date.parse(r.maj_serveur) > Date.parse(depuis) : Date.parse(r.maj_serveur) >= Date.parse(depuis)))
            .sort((a, b) => Date.parse(a.maj_serveur) - Date.parse(b.maj_serveur)).slice(0, 1000).map(r => JSON.parse(JSON.stringify(r)));
        },
        pousser: async (lot) => {
          appels.pousser++;
          if (lot.length > 500) throw new Error("lot trop gros");
          lot.forEach(e => {
            const cle = e.collection + ":" + e.id, ex = lignes.get(cle);
            if (!ex || Date.parse(ex.maj_client) <= Date.parse(e.maj_client)) {
              lignes.set(cle, { collection: e.collection, id: e.id, contenu: JSON.parse(JSON.stringify(e.contenu)), maj_client: e.maj_client, supprime: !!e.supprime, maj_serveur: new Date(++horloge).toISOString() });
            }
          });
        }
      };
    }
  };
}

module.exports = async function ({ page, t }) {
  async function sync(w) {
    await w.Synchro.synchroniser();
    for (let i = 0; i < 200 && w.Synchro.etat().statut === "en-cours"; i++) await sleep(5);
  }

  // ---- sans connexion : rien ne change, indicateur « désactivée »
  const S = serveur();
  const w0 = page("Index.html", null, "", S.transport(null));
  await sleep(20);
  t("synchro : déconnecté par défaut", w0.Synchro.etat().statut === "deconnecte");
  t("indicateur rail", w0.document.querySelector("[data-etat-synchro-texte]").textContent === "Synchro désactivée — se connecter");

  // ---- PC : saisie puis connexion depuis Réglages
  const pc = page("Reglages.html", null, "", S.transport(null));
  await sleep(20);
  t("carte synchro : formulaire", !!pc.document.getElementById("form-synchro"));
  const D = pc.Donnees;
  const c = D.ajouterClient({ nom: "Conserverie Lot", ville: "Cahors", codePostal: "46000" });
  const l1 = D.enregistrerLigne(c.id, { nom: "L1", formatHabituel: "4/4" });
  D.enregistrerContact(c.id, { role: "Responsable sertissage", nom: "Dupont", principal: true });
  D.enregistrerVisite({ ligneId: l1.id, date: "2026-09-10", type: "campagne" });
  D.definirTheme("dark");
  t("4 éléments en attente (thème non synchronisé)", D.nbEnAttente() === 4);
  const em = pc.document.getElementById("rs-email"), mdp = pc.document.getElementById("rs-mdp");
  em.value = "alex@test.fr"; em.dispatchEvent(new pc.Event("input"));
  mdp.value = "mauvais"; mdp.dispatchEvent(new pc.Event("input"));
  pc.document.getElementById("form-synchro").dispatchEvent(new pc.Event("submit", { cancelable: true }));
  await sleep(30);
  t("mauvais mot de passe : message clair", pc.document.querySelector("[data-message-synchro]").textContent .startsWith("Email ou mot de passe incorrect"));
  t("saisie email conservée après rafraîchissement", pc.document.getElementById("rs-email").value === "alex@test.fr");
  pc.document.getElementById("rs-mdp").value = "bonmotdepasse"; pc.document.getElementById("rs-mdp").dispatchEvent(new pc.Event("input"));
  pc.document.getElementById("form-synchro").dispatchEvent(new pc.Event("submit", { cancelable: true }));
  await sleep(50);
  t("connecté + synchronisé", pc.Synchro.etat().statut === "ok" && pc.Synchro.etat().email === "alex@test.fr");
  t("tout envoyé", D.nbEnAttente() === 0 && S.lignes.size === 4);
  t("carte : compte affiché", pc.document.getElementById("carte-synchro").textContent.includes("alex@test.fr"));
  t("indicateur : Synchronisé", pc.document.querySelector("[data-etat-synchro]").getAttribute("data-statut") === "ok");

  // ---- Téléphone vide : reçoit tout
  const tel = page("Index.html", null, "", S.transport("alex@test.fr"));
  await sleep(50); await sync(tel);
  const T = tel.Donnees;
  t("téléphone : client reçu", T.listerClients().length === 1 && T.lignesDuClient(c.id).length === 1 && T.contactsDuClient(c.id).length === 1);
  t("téléphone : visite reçue", T.listerVisites().length === 1);
  t("téléphone : rien renvoyé", T.nbEnAttente() === 0);
  t("téléphone : thème non imposé", T.getDonnees().profil.theme === "light");
  t("téléphone : page redessinée", tel.document.body.textContent.includes("Conserverie Lot"));
  const avant = S.appels.pousser;
  await sync(tel); await sync(pc);
  t("synchro à vide : aucun envoi", S.appels.pousser === avant && T.nbEnAttente() === 0 && D.nbEnAttente() === 0);

  // ---- Modifications croisées sans conflit
  T.enregistrerVisite({ ligneId: l1.id, date: "2026-09-24", type: "campagne", remarques: "vue sur tél" });
  D.modifierClient(c.id, { notes: "modif PC" });
  await sync(tel); await sync(pc); await sync(tel);
  t("PC reçoit la visite du téléphone", D.listerVisites().some(v => v.remarques === "vue sur tél"));
  t("téléphone reçoit la modif du PC", T.getClient(c.id).notes === "modif PC");
  t("aucune perte : 2 visites des deux côtés", D.listerVisites().length === 2 && T.listerVisites().length === 2);

  // ---- Conflit sur le même élément : la plus récente gagne
  T.enregistrerLigne(c.id, { formatHabituel: "1/2" }, l1.id);
  await sleep(10);
  D.enregistrerLigne(c.id, { formatHabituel: "5/1" }, l1.id);
  await sync(pc); await sync(tel); await sync(pc);
  t("conflit : version la plus récente (PC) des deux côtés", D.getLigne(l1.id).formatHabituel === "5/1" && T.getLigne(l1.id).formatHabituel === "5/1");
  // l'inverse : local plus récent non écrasé par un distant plus ancien
  D.enregistrerLigne(c.id, { produitHabituel: "ancien" }, l1.id);
  await sync(pc);
  await sleep(10);
  T.enregistrerLigne(c.id, { produitHabituel: "récent" }, l1.id);
  await sync(tel); await sync(pc);
  t("local récent en attente non écrasé", T.getLigne(l1.id).produitHabituel === "récent" && D.getLigne(l1.id).produitHabituel === "récent");

  // ---- Hors ligne : file d'attente puis envoi au retour
  Object.defineProperty(tel.navigator, "onLine", { configurable: true, get: () => false });
  T.enregistrerVisite({ ligneId: l1.id, date: "2026-09-23", type: "maintenance" });
  await sync(tel);
  t("hors ligne : statut + en attente", tel.Synchro.etat().statut === "hors-ligne" && T.nbEnAttente() === 1);
  t("hors ligne : indicateur avec compteur", tel.document.querySelector("[data-etat-synchro-texte]").textContent.includes("1 en attente"));
  Object.defineProperty(tel.navigator, "onLine", { configurable: true, get: () => true });
  await sync(tel); await sync(pc);
  t("retour réseau : envoyé et reçu", T.nbEnAttente() === 0 && D.listerVisites().length === 3);

  // ---- Suppression en cascade propagée
  D.supprimerClients([c.id]);
  await sync(pc); await sync(tel);
  t("suppression propagée (client, lignes, contacts, visites)", T.listerClients().length === 0 && T.getDonnees().lignes.length === 0 && T.getDonnees().contacts.length === 0 && T.listerVisites().length === 0);

  // ---- Nom du profil synchronisé
  D.definirNomProfil("Alexandre Da Silva");
  await sync(pc); await sync(tel);
  t("nom du profil synchronisé", T.getDonnees().profil.nom === "Alexandre Da Silva");

  // ---- Gros volume : pagination (1 200 éléments)
  const gros = D.ajouterClient({ nom: "Gros", ville: "X" });
  const lg = D.enregistrerLigne(gros.id, { nom: "L" });
  const d0 = D.getDonnees();
  for (let i = 0; i < 1200; i++) d0.visites.push({ id: "v" + i, clientId: gros.id, ligneId: lg.id, date: "2026-07-01", type: "campagne", format: "", produit: "", remarques: "" });
  D.enregistrerVisite({ ligneId: lg.id, date: "2026-07-02", type: "campagne" }); // déclenche la détection
  await sync(pc);
  t("envoi par lots de 500", D.nbEnAttente() === 0);
  const tel2 = page("Index.html", null, "", S.transport("alex@test.fr"));
  await sleep(50); await sync(tel2);
  t("nouvel appareil : 1 201 visites reçues (pagination)", tel2.Donnees.listerVisites().length === 1201);

  // ---- Données existantes avant la synchro (première mise en service)
  const ancien = JSON.stringify({ version: 1, profil: { nom: "Alexandre", theme: "light" }, clients: [{ id: "cx", nom: "Ancien", ville: "Y", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 }], contacts: [], lignes: [], visites: [] });
  const w9 = page("Index.html", ancien, "", S.transport("alex@test.fr"));
  await sleep(50); await sync(w9);
  t("données d'avant la synchro envoyées au premier passage", S.lignes.has("clients:cx") && w9.Donnees.getClient("cx").majLe);

  // ---- Rendez-vous synchronisés
  const cr = D.ajouterClient({ nom: "RDV SA", ville: "Z" });
  const rv = D.enregistrerRdv({ clientId: cr.id, date: "2030-05-05", heure: "09:00" });
  await sync(pc); await sync(tel);
  t("RDV reçu sur le téléphone", T.getRdv(rv.id) && T.getRdv(rv.id).heure === "09:00");
  T.supprimerRdv(rv.id);
  await sync(tel); await sync(pc);
  t("RDV annulé sur le téléphone → annulé sur le PC", !D.getRdv(rv.id));

  // ---- Déconnexion
  await pc.Synchro.deconnexion();
  t("déconnexion : données conservées", pc.Synchro.etat().statut === "deconnecte" && pc.Donnees.listerClients().length > 0);

  // ---- Restauration d'une sauvegarde = propagée comme remplacement
  const w10 = page("Index.html", null, "", S.transport("alex@test.fr"));
  await sleep(50); await sync(w10);
  const r = w10.Donnees.importer(JSON.stringify({ clients: [], contacts: [], lignes: [], visites: [] }));
  await sync(w10);
  t("restauration vide → suppressions envoyées", r.ok && [...S.lignes.values()].filter(x => x.collection === "clients").every(x => x.supprime));
};
