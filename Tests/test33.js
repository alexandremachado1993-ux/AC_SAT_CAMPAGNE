/* Mises à jour : fichiers version.txt / version.json, suggestion au démarrage, pastille et menu, « plus tard », notification système, réglage du profil. */
const fs = require("fs");
const path = require("path");
module.exports = async function ({ page, t }) {
  const racine = path.join(__dirname, "..");
  const attendre = (ms) => new Promise(r => setTimeout(r, ms));
  const clic = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
  const faux = (win, fn) => Object.defineProperty(win, "fetch", { configurable: true, get: () => fn, set: () => {} });   // le harnais réinstalle un faux fetch après notre crochet
  const reponse = (texte, ok) => () => Promise.resolve({ ok: ok !== false, text: () => Promise.resolve(texte) });
  const NOUV = { id: "x", titre: "Super fonction", resume: "Elle fait des choses utiles." };
  const INFOS = { version: "2099.01.01-a", date: "2099-01-01", nouveaute: NOUV };
  const route = (json, txt) => (url) => reponse(/version\.json/.test(String(url)) ? json : txt)();
  const serveur = (infos) => (win) => faux(win, route(JSON.stringify(infos), infos.version + "\n"));
  const sug = (w) => { const f = w.document.querySelector(".feuille:not([hidden])"); return f && /Une nouvelle version est prête/.test(f.textContent) ? f : null; };
  const cle = (win, k, v) => { try { win.localStorage.setItem(k, v); } catch (e) { /* */ } };

  // ---------- Fichiers publiés : toujours cohérents avec la version et la nouveauté du code
  const w0 = page("Index.html"); const VERSION = w0.AppLayout.VERSION, L = w0.Nouveautes.LISTE;
  const { attendu } = require("./maj-version.js"); const att = attendu();
  const lu = (f) => fs.readFileSync(path.join(racine, f), "utf8");
  t("version.txt = version du code (" + VERSION + ") — si ce test échoue : node Tests/maj-version.js", lu("version.txt") === att.txt && att.txt === VERSION + "\n");
  t("version.json = version, date et nouveauté du code — si ce test échoue : node Tests/maj-version.js", lu("version.json") === att.json);
  const vj = JSON.parse(lu("version.json"));
  t("version.json : « nouveaute » seulement si l'annonce est de CETTE version (on ne ressert pas une ancienne nouveauté)", L[0].version === VERSION ? (vj.nouveaute && vj.nouveaute.id === L[0].id && vj.nouveaute.titre === L[0].titre) : vj.nouveaute === null);
  t("version.json : date = date du numéro de version", vj.date === VERSION.slice(0, 10).replace(/\./g, "-"));
  t("version.json et version.txt : jamais en cache (netlify.toml) et publiés (liste blanche du déploiement)", /for = "\/version\.\*"[\s\S]*?no-store/.test(lu("netlify.toml")) && /version\\\.\(txt\|json\)/.test(lu("Tests/test25.js")));

  // ---------- Suggestion au démarrage
  let w = page("Index.html", null, "", null, serveur(INFOS)); await attendre(1800);
  let f = sug(w);
  t("démarrage avec mise à jour disponible : la fenêtre de suggestion s'ouvre (version, date, version actuelle)", !!f && /Version 2099\.01\.01-a · 01\/01\/2099/.test(f.textContent) && new RegExp("Tu utilises la version " + VERSION.replace(/\./g, "\\.")).test(f.textContent) && /données restent intactes/.test(f.textContent));
  t("la suggestion annonce ce que la version apporte (« Au programme »)", /Au programme/.test(f.textContent) && /Super fonction/.test(f.textContent) && /Elle fait des choses utiles\./.test(f.textContent));
  t("boutons « Plus tard » et « Mettre à jour maintenant »", !!f.querySelector("[data-maj-plus-tard]") && !!f.querySelector("[data-maj-maintenant]") && f.querySelector("[data-maj-maintenant]").textContent === "Mettre à jour maintenant");
  t("la pastille du profil passe à 1 et son libellé l'annonce aux lecteurs d'écran", w.document.querySelector(".entete-avatar-pastille").textContent === "1" && w.document.querySelector(".entete-avatar").getAttribute("aria-label") === "Menu utilisateur : 1 notification");
  const report = Number(w.localStorage.getItem("acsc_maj_reportee"));
  t("une fois proposée : « plus tard » armé pour ~6 h et proposée une seule fois dans la session", report - Date.now() > 5.9 * 3600e3 && report - Date.now() < 6.1 * 3600e3 && w.sessionStorage.getItem("acsc_maj_proposee") === "1");
  clic(f.querySelector("[data-maj-plus-tard]"));
  t("« Plus tard » ferme la fenêtre ; la pastille reste", !sug(w) && !!w.document.querySelector(".entete-avatar-pastille"));
  clic(w.document.querySelector(".entete-avatar"));
  const entree = w.document.querySelector("[data-maj]");
  t("le menu du profil propose « ⬆️ Mise à jour disponible » avec le numéro de version", !!entree && /Mise à jour disponible/.test(entree.textContent) && /2099\.01\.01-a/.test(entree.textContent));
  clic(entree);
  t("l'entrée du menu rouvre la suggestion, même pendant le « plus tard »", !!sug(w));

  // ---------- Pas de mise à jour / pas de réponse : silence total
  w = page("Index.html", null, "", null, serveur({ version: VERSION, date: "", nouveaute: null })); await attendre(1800);
  t("version à jour : aucune fenêtre, aucune pastille, aucune entrée de menu", !sug(w) && !w.document.querySelector(".entete-avatar-pastille") && w.document.querySelector(".entete-avatar").getAttribute("aria-label") === "Menu utilisateur" && (clic(w.document.querySelector(".entete-avatar")), !w.document.querySelector("[data-maj]")));
  w = page("Index.html", null, "", null, (win) => faux(win, () => Promise.reject(new Error("hors ligne")))); await attendre(1800);
  t("hors ligne : aucune fenêtre, aucune pastille, pas d'erreur", !sug(w) && !w.document.querySelector(".entete-avatar-pastille"));
  w = page("Index.html", null, "", null, (win) => faux(win, route("<html>404</html>", "<html>404</html>"))); await attendre(1800);
  t("réponse invalide (page d'erreur) : traitée comme « pas de mise à jour »", !sug(w) && !w.document.querySelector(".entete-avatar-pastille"));
  w = page("Index.html", null, "", null, (win) => faux(win, route("pas du json", "2099.01.01-a\n"))); await attendre(1800);
  t("anciens serveurs (version.json absent) : repli sur version.txt, suggestion sans « Au programme »", !!sug(w) && !/Au programme/.test(sug(w).textContent));

  // ---------- « Plus tard », session, mémoire du contrôle
  w = page("Index.html", null, "", null, (win) => { serveur(INFOS)(win); cle(win, "acsc_maj_reportee", String(Date.now() + 3600e3)); }); await attendre(1800);
  t("pendant le « plus tard » : pas de fenêtre, mais pastille présente", !sug(w) && w.document.querySelector(".entete-avatar-pastille").textContent === "1");
  w = page("Index.html", null, "", null, (win) => { serveur(INFOS)(win); cle(win, "acsc_maj_reportee", String(Date.now() - 1000)); }); await attendre(1800);
  t("« plus tard » échu : la suggestion revient", !!sug(w));
  w = page("Index.html", null, "", null, (win) => { serveur(INFOS)(win); win.sessionStorage.setItem("acsc_maj_proposee", "1"); }); await attendre(1800);
  t("déjà proposée dans la session : pas de seconde fenêtre", !sug(w));
  let appels = 0;
  w = page("Index.html", null, "", null, (win) => { faux(win, () => { appels++; return Promise.reject(new Error("x")); }); win.sessionStorage.setItem("acsc_maj_etat", JSON.stringify({ t: Date.now() - 60e3, infos: INFOS })); }); await attendre(1800);
  t("contrôle fait il y a moins de 10 min (autre page de la session) : réutilisé, aucune requête, la suggestion s'ouvre", appels === 0 && !!sug(w));
  appels = 0;
  w = page("Index.html", null, "", null, (win) => { faux(win, () => { appels++; return Promise.reject(new Error("x")); }); win.sessionStorage.setItem("acsc_maj_etat", JSON.stringify({ t: Date.now() - 11 * 60e3, infos: INFOS })); }); await attendre(1800);
  t("contrôle plus ancien que 10 min : nouvelle requête", appels >= 1);

  // ---------- Patience : animation d'ouverture
  w = page("Index.html", null, "", null, (win) => { serveur(INFOS)(win); win.addEventListener("DOMContentLoaded", () => win.document.documentElement.classList.add("splash-actif")); }); await attendre(2000);
  t("animation d'ouverture en cours : la fenêtre patiente", !sug(w));
  w.document.documentElement.classList.remove("splash-actif"); await attendre(2600);
  t("animation terminée : la suggestion s'ouvre ensuite", !!sug(w));

  // ---------- Installer
  w = page("Index.html", null, "", null, serveur(INFOS)); await attendre(1800);
  w.sessionStorage.setItem("acsc_maj_etat", "{}");
  clic(sug(w).querySelector("[data-maj-maintenant]")); await attendre(100);
  t("« Mettre à jour maintenant » repart de zéro (aucun « plus tard » ni contrôle mémorisé, la nouvelle version sera re-proposée si besoin)", w.localStorage.getItem("acsc_maj_reportee") === null && w.sessionStorage.getItem("acsc_maj_proposee") === null && w.sessionStorage.getItem("acsc_maj_etat") === null);

  // ---------- Pastille = mise à jour + nouveautés non vues
  const wd = page("Index.html"); wd.Donnees.ajouterClient({ nom: "Existant", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const stock = wd.localStorage.getItem("acsc_donnees_v1");
  w = page("Index.html", stock, "", null, (win) => { serveur(INFOS)(win); win.localStorage.removeItem("acsc_nouveautes_vue"); }); await attendre(300);
  t("pastille du profil = 1 mise à jour + " + L.length + " nouveautés non vues", w.document.querySelector(".entete-avatar-pastille").textContent === String(1 + L.length) && w.document.querySelector(".entete-avatar").getAttribute("aria-label") === "Menu utilisateur : " + (1 + L.length) + " notifications");

  // ---------- Informations (Réglages) : état et installation
  w = page("Reglages.html", null, "#informations", null, serveur(INFOS)); await attendre(1800);
  t("Réglages › Informations : l'état annonce la version, « Au programme », et propose « Mettre à jour maintenant » (sans fenêtre par-dessus)", /Une nouvelle version est disponible : 2099\.01\.01-a/.test(w.document.getElementById("info-etat").textContent) && !w.document.getElementById("info-maj-nouv").hidden && /Super fonction/.test(w.document.getElementById("info-maj-nouv").textContent) && !w.document.querySelector("[data-recharger]").hidden && !sug(w));

  // ---------- Réglage « Me prévenir » (profil synchronisé, lu par le serveur)
  const cb = w.document.querySelector("[data-notif-maj]");
  t("réglage « Me prévenir des mises à jour et des nouvelles fonctionnalités » : coché par défaut, valeur par défaut du profil = vrai", !!cb && cb.checked && w.Donnees.getTournee().prevenirVersions === true && w.AppLayout.notifMajActive() === true);
  cb.checked = false; cb.dispatchEvent(new w.Event("change", { bubbles: true }));
  t("décocher l'enregistre dans le profil (donc synchronisé, et lu par le serveur) ", w.Donnees.getTournee().prevenirVersions === false && w.AppLayout.notifMajActive() === false && JSON.parse(w.localStorage.getItem("acsc_donnees_v1")).profil.tournee.prevenirVersions === false);
  cb.checked = true; cb.dispatchEvent(new w.Event("change", { bubbles: true }));
  t("recocher le rétablit", w.Donnees.getTournee().prevenirVersions === true);
  t("le profil normalise le réglage (toute valeur autre que « faux » = vrai)", (w.Donnees.definirTournee({ prevenirVersions: "n'importe quoi" }), w.Donnees.getTournee().prevenirVersions === true) && (w.Donnees.definirTournee({ prevenirVersions: false }), w.Donnees.getTournee().prevenirVersions === false));

  // ---------- Notification système locale (application en arrière-plan)
  const notifs = [];
  const sw = (win, cacher) => {
    Object.defineProperty(win, "Notification", { value: { permission: "granted" }, configurable: true });
    Object.defineProperty(win.navigator, "serviceWorker", { configurable: true, value: { register: () => Promise.resolve(), getRegistration: () => Promise.resolve(null), ready: Promise.resolve({ showNotification: (titre, o) => { notifs.push({ titre, o }); return Promise.resolve(); } }) } });
    Object.defineProperty(win.document, "hidden", { configurable: true, get: () => cacher !== false });
  };
  w = page("Index.html", null, "", null, (win) => { serveur(INFOS)(win); sw(win, true); }); await attendre(500);
  t("application en arrière-plan + notifications autorisées : une notification système (titre, nouveauté, version, tag)", notifs.length === 1 && notifs[0].titre === "Mise à jour disponible" && /Nouveau : Super fonction\./.test(notifs[0].o.body) && /Version 2099\.01\.01-a/.test(notifs[0].o.body) && notifs[0].o.tag === "acsc-maj" && w.localStorage.getItem("acsc_maj_notifiee") === "2099.01.01-a");
  notifs.length = 0;
  w = page("Index.html", null, "", null, (win) => { serveur(INFOS)(win); sw(win, true); cle(win, "acsc_maj_notifiee", "2099.01.01-a"); }); await attendre(500);
  t("une seule notification par version : déjà notifiée → rien", notifs.length === 0);
  w = page("Index.html", null, "", null, (win) => { serveur(INFOS)(win); sw(win, false); }); await attendre(500);
  t("application au premier plan : pas de notification système (la fenêtre suffit)", notifs.length === 0);
  const wo = page("Index.html"); wo.Donnees.definirTournee({ prevenirVersions: false });
  w = page("Index.html", wo.localStorage.getItem("acsc_donnees_v1"), "", null, (win) => { serveur(INFOS)(win); sw(win, true); }); await attendre(500);
  t("réglage désactivé dans le profil : aucune notification système (la fenêtre et la pastille restent)", notifs.length === 0 && !!w.document.querySelector(".entete-avatar-pastille"));

  // ---------- Toutes les pages portent la logique (le contrôle a lieu quelle que soit la page d'ouverture)
  t("la suggestion fonctionne depuis les autres pages (Clients, Planning, Serti)", await (async () => { const r = []; for (const p of ["Clients.html", "Planning.html", "Serti.html"]) { const x = page(p, null, "", null, serveur(INFOS)); await attendre(1800); r.push(!!sug(x)); } return r.every(Boolean); })());
};
