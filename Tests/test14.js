const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t, P, fs }) {
  const path = require("path"), os = require("os"), url = require("url");
  // ---- Logique serveur (supabase/functions/rappels/logique.js)
  const src = fs.readFileSync(path.join(P, "supabase", "functions", "rappels", "logique.js"), "utf8");
  const tmp = path.join(os.tmpdir(), "logique-rappels-" + process.pid + ".mjs");
  fs.writeFileSync(tmp, src);
  const L = await import(url.pathToFileURL(tmp).href);
  const d = {
    clients: [{ id: "c1", nom: "Bordères", debutCampagne: 1, finCampagne: 12, cadenceJours: 14 }, { id: "c2", nom: "Castel", debutCampagne: 1, finCampagne: 12, cadenceJours: 14 },
      { id: "c3", nom: "Hiver", debutCampagne: 11, finCampagne: 2 }, { id: "c4", nom: "Inactif", actif: false, debutCampagne: 1, finCampagne: 12 }],
    lignes: [{ id: "l1", clientId: "c1", statut: "active" }, { id: "l2", clientId: "c2" }, { id: "l3", clientId: "c2", statut: "concurrent" },
      { id: "l4", clientId: "c3" }, { id: "l5", clientId: "c4" }, { id: "l6", clientId: "c1", suiviCampagne: false }],
    visites: [{ ligneId: "l2", type: "campagne", date: "2026-09-25" }, { ligneId: "l1", type: "essai", date: "2026-09-28" }],
    rdv: [{ id: "r1", clientId: "c1", date: "2026-09-29", heure: "08:30", type: "essai" }, { id: "r2", clientId: "c2", date: "2026-09-29", heure: "10:30" },
      { id: "r3", clientId: "c2", date: "2026-09-30", statut: "propose" }, { id: "r4", clientId: "c1", date: "2026-09-20" }, { id: "r5", clientId: "c2", date: "2026-09-30", heure: "09:00" }]
  };
  const c = L.calculer(d, "2026-09-29");
  t("serveur : lignes à voir (active sans visite de campagne ; concurrente, inactive, hors campagne, client inactif exclus)", c.aVoir === 1);
  t("serveur : propositions, à clôturer, aujourd'hui, demain", c.proposes === 1 && c.aCloturer === 1 && c.aujourdhui.map(r => r.client).join() === "Bordères,Castel" && c.demain.length === 1);
  const res = L.resumeDuMatin(c, "Alexandre");
  t("serveur : résumé du matin", res.titre === "Bonjour Alexandre — ta journée" && res.corps.includes("Aujourd'hui : Bordères 08h30, Castel 10h30") && res.corps.includes("1 visite proposée à confirmer"));
  t("serveur : rien à dire = pas de résumé", L.resumeDuMatin(L.calculer({ clients: [], lignes: [], visites: [], rdv: [] }, "2026-09-29"), "A") === null);
  t("serveur : rappel 1 h avant (fenêtre 75 min)", L.rappelsProches(c, 450).map(r => r.id).join() === "r1" && L.rappelsProches(c, 430).length === 0 && L.rappelsProches(c, 511).length === 0);
  t("serveur : texte du rappel", L.rappelsProches(c, 450)[0].corps === "Essai interne · 08h30");
  t("serveur : heure de Paris (été / hiver)", L.heureParis(new Date("2026-09-29T05:30:00Z")).minutes === 450 && L.heureParis(new Date("2026-12-15T06:30:00Z")).minutes === 450);
  t("serveur : minuit à Paris", L.heureParis(new Date("2026-09-28T22:05:00Z")).date === "2026-09-29" && L.heureParis(new Date("2026-09-28T22:05:00Z")).minutes === 5);
  t("serveur : fenêtre du résumé", L.heureDuResume(450, "07:30") && !L.heureDuResume(449, "07:30") && !L.heureDuResume(630, "07:30") && L.heureDuResume(500, "invalide"));
  fs.unlinkSync(tmp);

  // ---- Service worker : réception et clic
  const swSrc = fs.readFileSync(path.join(P, "sw.js"), "utf8");
  const ecoutes = {}, affichees = [], ouvertes = [];
  const self = {
    addEventListener: (n, f) => { ecoutes[n] = f; },
    registration: { scope: "https://ac-sat-campagne.netlify.app/", showNotification: (titre, o) => { affichees.push({ titre, o }); return Promise.resolve(); } },
    clients: { matchAll: () => Promise.resolve([]), openWindow: (u) => { ouvertes.push(u); return Promise.resolve(); }, claim: () => Promise.resolve() },
    location: { origin: "https://ac-sat-campagne.netlify.app" }, skipWaiting: () => {}
  };
  new Function("self", "caches", "fetch", swSrc)(self, {}, () => {});
  let attente;
  ecoutes.push({ data: { json: () => ({ titre: "Bonjour", corps: "2 visites", url: "Index.html", tag: "resume" }) }, waitUntil: (p) => { attente = p; } });
  await attente;
  t("service worker : notification affichée", affichees[0] && affichees[0].titre === "Bonjour" && affichees[0].o.body === "2 visites" && affichees[0].o.tag === "resume");
  ecoutes.notificationclick({ notification: { close: () => {}, data: { url: "Index.html" } }, waitUntil: (p) => { attente = p; } });
  await attente;
  t("service worker : clic → ouvre l'application", ouvertes[0] === "https://ac-sat-campagne.netlify.app/Index.html");

  // ---- Réglages : carte Notifications (navigateur simulé)
  const appels = [];
  const transport = {
    utilisateur: async () => "alex@test.fr", connexion: async () => {}, deconnexion: async () => {},
    tirer: async () => [], pousser: async () => {},
    enregistrerAbonnement: async (...a) => { appels.push(["enregistrer", ...a]); },
    supprimerAbonnement: async (e) => { appels.push(["supprimer", e]); },
    testerNotification: async () => { appels.push(["tester"]); return { envoyees: 1 }; }
  };
  const nav = (permissionInitiale, supportee) => (w) => {
    let abonnement = null, permission = permissionInitiale;
    if (!supportee) return;
    w.Notification = { get permission() { return permission; }, requestPermission: async () => { permission = "granted"; return "granted"; } };
    w.PushManager = function () {};
    const pm = {
      getSubscription: async () => abonnement,
      subscribe: async (o) => { appels.push(["cle", o.applicationServerKey.length, o.userVisibleOnly]);
        abonnement = { endpoint: "https://push.exemple/abc", toJSON: () => ({ endpoint: "https://push.exemple/abc", keys: { p256dh: "cleP256dhTest", auth: "authTest" } }),
          unsubscribe: async () => { abonnement = null; appels.push(["desabonne"]); } }; return abonnement; }
    };
    const reg = { pushManager: pm };
    Object.defineProperty(w.navigator, "serviceWorker", { configurable: true, value: { getRegistration: async () => reg, ready: Promise.resolve(reg), register: async () => reg } });
  };
  const w = page("Reglages.html", null, "", transport, nav("default", true));
  await sleep(120);
  const carte = () => w.document.getElementById("carte-notifications");
  t("notifications : bouton « Activer sur cet appareil »", !!carte().querySelector("[data-notif-activer]") && carte().textContent.includes("résumé chaque matin à 07h30") && carte().textContent.includes("l'onglet « Tournée »"));
  carte().querySelector("[data-notif-activer]").click();
  await sleep(120);
  const enr = appels.find(a => a[0] === "enregistrer");
  t("activer : clé VAPID (65 octets) et abonnement enregistré", appels.some(a => a[0] === "cle" && a[1] === 65 && a[2] === true) &&
    enr && enr[1] === "https://push.exemple/abc" && enr[2] === "cleP256dhTest" && enr[3] === "authTest");
  t("activer : carte « activées » avec test et désactivation", carte().textContent.includes("Notifications activées") && !!carte().querySelector("[data-notif-tester]"));
  carte().querySelector("[data-notif-tester]").click();
  await sleep(60);
  t("tester : appel de la fonction serveur", appels.some(a => a[0] === "tester"));
  carte().querySelector("[data-notif-desactiver]").click();
  await sleep(120);
  t("désactiver : retiré du serveur et de l'appareil", appels.some(a => a[0] === "supprimer") && appels.some(a => a[0] === "desabonne") && !!carte().querySelector("[data-notif-activer]"));
  const w2 = page("Reglages.html", null, "", transport, nav("denied", true));
  await sleep(120);
  t("notifications bloquées : explication", w2.document.getElementById("carte-notifications").textContent.includes("Notifications bloquées"));
  const w3 = page("Reglages.html", null, "", transport, (win) => { Object.defineProperty(win.navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1" }); });
  await sleep(120);
  t("iPhone non installé : explication d'installation", w3.document.getElementById("carte-notifications").textContent.includes("installer l'application"));
  const w4 = page("Reglages.html", null, "", Object.assign({}, transport, { utilisateur: async () => null }), nav("default", true));
  await sleep(120);
  t("non connecté : invitation à se connecter", w4.document.getElementById("carte-notifications").textContent.includes("Connecte-toi à la synchronisation"));
  // Heure du résumé : réglée dans l'onglet Tournée
  const wt = page("Tournee.html", w.localStorage.getItem("acsc_donnees_v1"));
  wt.document.getElementById("rt-rappel").value = "06:45";
  wt.document.getElementById("form-tournee").dispatchEvent(new wt.Event("submit", { cancelable: true }));
  t("heure du résumé enregistrée (lue par le serveur via le profil)", wt.Donnees.getTournee().heureRappel === "06:45" &&
    wt.Donnees.elementsAEnvoyer().find(e => e.collection === "profil").contenu.tournee.heureRappel === "06:45");
};
