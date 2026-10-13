/* Mises à jour VALIDÉES par l'utilisateur : trois rappels, puis écran obligatoire ; jamais de blocage hors connexion ; réparation ; diagnostic ;
   et les champs d'une version plus récente survivent à la modification d'une visite. */
const fs = require("fs");
const path = require("path");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t }) {
  const racine = path.join(__dirname, "..");
  const ACTUELLE = fs.readFileSync(path.join(racine, "version.txt"), "utf8").trim();
  const fichiers = [{ u: "Index.html", t: 100 }, { u: "Js/Donnees.js", t: 200 }];
  const serveur = (extra) => Object.assign({ version: "2099.01.01-a", date: "2099-01-01", nouveaute: { id: "x", titre: "Nouveauté de test", resume: "Résumé" }, obligatoire: false, fichiers }, extra);
  const rappels = (n, t, base) => ({ base: base || ACTUELLE, n, t: t === undefined ? Date.now() : t });
  /* Le banc d'essai remplace « fetch » par une fonction qui refuse tout APRÈS notre préparation : le faux serveur est donc posé APRÈS la création de la page ;
     puis on déclenche le contrôle de version et l'événement du retour sur l'application, qui propose (ou impose) la mise à jour. */
  const ouvrir = async ({ srv, r, session }) => {
    const w = page("Index.html", null, "", null, (win) => {
      if (r) win.localStorage.setItem("acsc_maj_rappels", JSON.stringify(r));
      if (session) win.sessionStorage.setItem("acsc_maj_proposee", "1");
    });
    w.fetch = async (url) => {
      if (/version\.json/.test(url)) { if (srv === null) throw new Error("hors ligne"); return { ok: true, text: async () => JSON.stringify(srv) }; }
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(0), text: async () => "" };
    };
    await w.AppLayout.verifierMiseAJour();
    w.document.dispatchEvent(new w.Event("visibilitychange"));
    return w;
  };
  const noms = ["premier", "deuxieme", "epuise", "memeSession", "uneHeure", "obligatoire", "horsLigne", "aJour", "sansListe", "apresMaj", "clic"];
  const fenetres = await Promise.all([
    ouvrir({ srv: serveur() }), ouvrir({ srv: serveur(), r: rappels(2) }), ouvrir({ srv: serveur(), r: rappels(3) }), ouvrir({ srv: serveur(), r: rappels(3), session: true }),
    ouvrir({ srv: serveur(), r: rappels(3, Date.now() - 2 * 3600e3), session: true }), ouvrir({ srv: serveur({ obligatoire: true }) }), ouvrir({ srv: null, r: rappels(3) }),
    ouvrir({ srv: serveur({ version: ACTUELLE }), r: rappels(3) }), ouvrir({ srv: serveur({ fichiers: undefined }), r: rappels(3) }),
    ouvrir({ srv: serveur(), r: rappels(3, Date.now(), "2000.01.01-a") }), ouvrir({ srv: serveur() })]);
  const S = {}; noms.forEach((n, i) => { S[n] = fenetres[i]; });
  await sleep(1700);
  const feuille = (w) => w.document.querySelector(".feuille:not([hidden])");
  const rappel = (w) => (feuille(w) && feuille(w).querySelector(".maj-rappel")) || null;
  const bloque = (w) => w.document.querySelector(".maj-scene--bloque");
  const compteur = (w) => JSON.parse(w.localStorage.getItem("acsc_maj_rappels") || "{}");

  // ---------- Les rappels
  t("rappel 1 : une nouvelle version est proposée dans une fenêtre qui dit « Rappel 1 sur 3 » et annonce l'obligation après trois rappels", !!rappel(S.premier) && /Rappel 1 sur 3/.test(rappel(S.premier).textContent) && /devient obligatoire/.test(rappel(S.premier).textContent) && !bloque(S.premier) && compteur(S.premier).n === 1 && compteur(S.premier).base === ACTUELLE);
  t("rappel 3 (après deux autres) : la fenêtre dit « Dernier rappel » et prévient que la prochaine ouverture sera obligatoire (mise en évidence)", !!rappel(S.deuxieme) && /Dernier rappel/.test(rappel(S.deuxieme).textContent) && /prochaine ouverture/.test(rappel(S.deuxieme).textContent) && rappel(S.deuxieme).classList.contains("maj-rappel--dernier") && compteur(S.deuxieme).n === 3 && !bloque(S.deuxieme));
  const fen = feuille(S.premier);
  t("la fenêtre garde « Plus tard » et « Mettre à jour maintenant » ; « Plus tard » ne consomme pas d'autre rappel", !!fen.querySelector("[data-maj-plus-tard]") && !!fen.querySelector("[data-maj-maintenant]") && (fen.querySelector("[data-maj-plus-tard]").click(), !feuille(S.premier) && compteur(S.premier).n === 1));
  t("après le rappel 3, le compteur ne dépasse JAMAIS 3", (() => { return compteur(S.deuxieme).n === 3; })());

  // ---------- Le blocage
  t("rappels épuisés + nouvelle ouverture : l'écran OBLIGATOIRE s'affiche à la place de la fenêtre, avec un seul bouton", !!bloque(S.epuise) && !feuille(S.epuise) && /trois fois/.test(bloque(S.epuise).querySelector(".maj-texte").textContent) && bloque(S.epuise).querySelectorAll(".maj-actions button").length === 1);
  t("rappels épuisés mais DANS LA MÊME SESSION que le dernier rappel (moins d'une heure) : pas de blocage, on laisse finir ce qu'on fait", !bloque(S.memeSession) && !feuille(S.memeSession));
  t("rappels épuisés, même session mais dernier rappel il y a PLUS D'UNE HEURE : le blocage s'applique (une application laissée ouverte des jours ne passe pas entre les mailles)", !!bloque(S.uneHeure));
  t("version marquée « obligatoire » par le serveur : blocage immédiat, sans rappels, avec le texte sur les données entre appareils", !!bloque(S.obligatoire) && /données restent justes/.test(bloque(S.obligatoire).querySelector(".maj-texte").textContent) && compteur(S.obligatoire).n === undefined);
  t("HORS CONNEXION (le serveur ne répond pas) : JAMAIS de blocage ni de fenêtre — on ne peut pas mettre à jour, l'utilisateur doit pouvoir travailler", !bloque(S.horsLigne) && !feuille(S.horsLigne));
  t("application déjà à la version du serveur : ni fenêtre ni blocage, même avec un vieux compteur", !bloque(S.aJour) && !feuille(S.aJour));
  t("serveur sans liste de fichiers (ancien format) : pas de blocage impossible à satisfaire ; la fenêtre habituelle est proposée", !bloque(S.sansListe) && !!rappel(S.sansListe));
  t("le compteur appartient à la version installée : après une mise à jour (version « base » différente), il repart de zéro (« Rappel 1 sur 3 »)", !!rappel(S.apresMaj) && /Rappel 1 sur 3/.test(rappel(S.apresMaj).textContent) && !bloque(S.apresMaj) && compteur(S.apresMaj).base === ACTUELLE);
  S.clic.document.querySelector(".feuille:not([hidden]) [data-maj-maintenant]").click();
  const sc = S.clic.document.querySelector(".maj-scene");
  t("« Mettre à jour maintenant » ferme la fenêtre et ouvre la mise en scène (« Mise à jour en cours », barre à 0 %)", !feuille(S.clic) && !!sc && /Mise à jour en cours/.test(sc.querySelector(".maj-titre").textContent) && sc.querySelector("[data-maj-pourcent]").textContent.length > 0);

  // ---------- Textes et frontières
  const appLayout = fs.readFileSync(path.join(racine, "Js/AppLayout.js"), "utf8");
  t("notification système : elle ne promet plus une installation automatique (« ouvre l'application et touche Mettre à jour maintenant »)", /touche « Mettre à jour maintenant »/.test(appLayout) && !/ouvre l'application pour l'installer/.test(appLayout));
  t("frontière R3 : le compteur de rappels est LOCAL à l'appareil, jamais dans les données ni dans la sauvegarde exportée", /acsc_maj_rappels/.test(JSON.stringify(S.premier.Donnees.exporter())) === false && !!S.premier.localStorage.getItem("acsc_maj_rappels"));

  // ---------- Réglages : « Réparer l'installation »
  const fauxCaches = { stock: new Map([["acsc-2026.10.12-a", new Map([["Index.html", 1]])], ["acsc-meta", new Map()], ["autre", new Map()]]) };
  fauxCaches.keys = async () => Array.from(fauxCaches.stock.keys()); fauxCaches.delete = async (n) => fauxCaches.stock.delete(n);
  const donnees = JSON.stringify({ clients: [{ id: "c1", nom: "Conserverie Exemple", ville: "Agen", pays: "France", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 }], lignes: [], contacts: [], visites: [], rdv: [], profil: {} });
  const wr = page("Reglages.html", donnees, "#informations", null, (win) => { win.caches = fauxCaches; });
  const bouton = wr.document.querySelector("[data-reparer-installation]");
  t("Réglages › Informations : un bouton « Réparer l'installation » est proposé", !!bouton && /Réparer l'installation/.test(bouton.textContent));
  bouton.click(); await sleep(30);
  t("« Réparer l'installation » (après confirmation) supprime les copies « acsc-* » et laisse les autres caches ; les données ne sont pas touchées", Array.from(fauxCaches.stock.keys()).join() === "autre" && wr.Donnees.listerClients().length === 1 && wr.Donnees.listerClients()[0].nom === "Conserverie Exemple");
  wr.close();

  // ---------- Diagnostic : les fichiers sont comptés dans la copie ACTIVE (pas dans « le dernier cache par ordre alphabétique », qui serait la méta)
  const copie = new Map(Array.from({ length: 47 }, (_, i) => ["f" + i, 1]));
  const caches = { stock: new Map([["acsc-2026.10.12-a", copie], ["acsc-meta", new Map([["actif", { text: async () => "acsc-2026.10.12-a" }]])], ["acsc-zzz-vieille", new Map([["x", 1]])]]) };
  caches.has = async (n) => caches.stock.has(n); caches.keys = async () => Array.from(caches.stock.keys());
  caches.open = async (n) => { const m = caches.stock.get(n); return { keys: async () => Array.from(m.keys()), match: async (k) => m.get(k) }; };
  const wd = page("Reglages.html", null, "", null, (win) => { win.caches = caches; Object.defineProperty(win.navigator, "serviceWorker", { configurable: true, value: { register: async () => ({}), getRegistration: async () => ({ active: {} }) } }); });
  const lignes = await wd.AutoDiagnostic.verifier(); const ho = lignes.find(l => l.nom === "Hors ligne");
  t("diagnostic « Hors ligne » : compte les 47 fichiers de la copie ACTIVE (la méta et les vieilles copies ne le trompent pas)", !!ho && ho.etat === "ok" && /47 fichiers/.test(ho.detail));
  wd.close();

  // ---------- Visites : les champs d'une version plus RÉCENTE survivent à la modification
  const w = page("Index.html"); const D = w.Donnees;
  const cl = D.ajouterClient({ nom: "Conserverie Exemple", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const li = D.enregistrerLigne(cl.id, { nom: "Ligne 1", formatHabituel: "1/2M" }); const date = D.aujourdhuiIso();
  const visites = [];
  D.TYPES_VISITE.forEach(tv => { const v = D.enregistrerVisite({ clientId: cl.id, ligneId: li.id, date, type: tv.cle, format: "1/2M", produit: "p", remarques: "r", references: { molette1Ref: "P259M" }, details: {}, mesures: { colonne: "ø65", nbTetes: 2, tetes: [{ n: 1, v: { croisure: 1.1 } }], client: { note: "A", tetes: [], pieces: [] } } }); if (v) visites.push(v); });
  visites.push(D.enregistrerVisite({ clientId: cl.id, ligneId: li.id, date, type: "campagne", statut: "reportee", motif: "m", reporteLe: D.ajouterJours(date, 3) }));
  visites.push(D.enregistrerVisite({ clientId: cl.id, ligneId: li.id, date, type: "campagne", statut: "non-effectuee", motif: "m" }));
  const TECHNIQUES = ["majLe"];       // horodatage posé par le suivi de synchronisation (hors empreinte) : pas un champ métier
  const inconnus = visites.filter(Boolean).map(v => Object.keys(v).filter(k => D.CHAMPS_VISITE.indexOf(k) === -1 && TECHNIQUES.indexOf(k) === -1)).reduce((a, b) => a.concat(b), []);
  t("visites : la liste des champs connus (CHAMPS_VISITE) couvre TOUT ce que la création produit, pour tous les types et statuts (" + visites.filter(Boolean).length + " visites) — sinon un nouveau champ serait pris pour un champ « d'une autre version »" + (inconnus.length ? " — NON LISTÉS : " + inconnus.join(", ") : ""), inconnus.length === 0 && visites.filter(Boolean).length >= 6);
  const v0 = visites[0]; D.getDonnees().visites.find(v => v.id === v0.id).champFutur = "posé par une version récente";
  const apres = D.modifierVisite(v0.id, { clientId: cl.id, ligneId: li.id, date, type: v0.type, remarques: "modifiée" });
  t("visite modifiée par une ANCIENNE version : le champ qu'elle ne connaît pas (venu d'une version plus récente) est CONSERVÉ — la synchronisation ne le renverra plus effacé", apres.champFutur === "posé par une version récente" && apres.remarques === "modifiée");
  const vr = visites[visites.length - 2]; const reportee = D.modifierVisite(vr.id, { clientId: cl.id, ligneId: li.id, date, type: "campagne", format: "1/2M" });
  t("… et les champs CONNUS retirés par la modification ne sont pas ressuscités (une visite reportée redevenue effectuée n'a plus ni statut, ni motif, ni date de report)", reportee.statut === undefined && reportee.motif === undefined && reportee.reporteLe === undefined);
  Object.keys(S).forEach(k => S[k].close());
};
