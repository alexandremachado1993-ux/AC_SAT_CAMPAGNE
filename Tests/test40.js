/* Étape 2 : politique CSP, scripts en ligne supprimés, démarrage des pages, amorce de l'animation, limite d'essais de l'équipe. */
const fs = require("fs");
const path = require("path");
module.exports = async function ({ page, t }) {
  const racine = path.join(__dirname, "..");
  const lire = (f) => fs.readFileSync(path.join(racine, f), "utf8");
  const pages = fs.readdirSync(racine).filter(f => /\.html$/.test(f) && f !== "404.html");
  const toml = lire("netlify.toml"); const csp = (toml.match(/Content-Security-Policy = "([^"]*)"/) || [])[1] || "";
  const directive = (nom) => ((csp.split(";").map(x => x.trim()).find(x => x.startsWith(nom + " ")) || "").slice(nom.length + 1)).split(/\s+/).filter(Boolean);

  // ---------- CSP
  t("CSP : script-src 'self' SANS 'unsafe-inline' ni 'unsafe-eval' (un script injecté ne s'exécute pas)", directive("script-src").join(" ") === "'self'");
  t("CSP : object-src 'none', base-uri 'self', frame-ancestors 'none', form-action 'self'", directive("object-src")[0] === "'none'" && directive("base-uri")[0] === "'self'" && directive("frame-ancestors")[0] === "'none'" && directive("form-action")[0] === "'self'");
  const autorises = directive("connect-src");
  t("CSP : connect-src = le site, Supabase (https + wss) et geo.api.gouv.fr — rien d'autre", autorises.sort().join(" ") === ["'self'", "https://btzqjbmfkzhdtltgtrob.supabase.co", "wss://btzqjbmfkzhdtltgtrob.supabase.co", "https://geo.api.gouv.fr"].sort().join(" "));
  const hotes = new Set(); fs.readdirSync(path.join(racine, "Js")).forEach(f => { for (const m of lire("Js/" + f).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) if (!/^(www\.w3\.org|schemas\.openxmlformats\.org)$/.test(m[1])) hotes.add(m[1]); });
  const nonAutorises = [...hotes].filter(h => !autorises.some(a => a.endsWith("//" + h)));
  t("CSP : toute adresse externe écrite dans le code est autorisée par connect-src (sinon elle serait bloquée en ligne)" + (nonAutorises.length ? " — À AJOUTER : " + nonAutorises.join(", ") : ""), nonAutorises.length === 0);
  const enLigne = pages.filter(f => /<script(?![^>]*\ssrc=)[^>]*>/i.test(lire(f)));
  t("pages : aucun script en ligne (la CSP les bloquerait)" + (enLigne.length ? " — " + enLigne.join(", ") : ""), enLigne.length === 0);
  const gestionnaires = [];
  pages.forEach(f => { if (/\son[a-z]+\s*=/i.test(lire(f))) gestionnaires.push(f); });
  fs.readdirSync(path.join(racine, "Js")).forEach(f => { if (/<[a-z][^>]*\son(click|change|input|submit|load|error|keydown|focus|blur)\s*=/i.test(lire("Js/" + f))) gestionnaires.push("Js/" + f); });
  t("code : aucun gestionnaire d'événement en attribut HTML (onclick=… serait bloqué par la CSP)" + (gestionnaires.length ? " — " + gestionnaires.join(", ") : ""), gestionnaires.length === 0);

  // ---------- Démarrage des pages
  const valides = ["tableau", "clients", "planning", "tournee", "serti", "documents", "reglages"];
  const attendu = { "Index.html": "tableau", "Clients.html": "clients", "Client.html": "clients", "Planning.html": "planning", "Tournee.html": "tournee", "Serti.html": "serti", "Documents.html": "documents", "Reglages.html": "reglages" };
  t("pages : chaque page déclare <body data-page> avec le bon identifiant de menu", pages.every(f => (lire(f).match(/<body[^>]*\sdata-page="(\w+)"/) || [])[1] === attendu[f]) && Object.values(attendu).every(v => valides.indexOf(v) > -1));
  t("pages : Demarrage.js est chargé une fois, après Donnees, Synchro et AppLayout", pages.every(f => { const h = lire(f), i = h.indexOf("Js/Demarrage.js"); return i > -1 && h.indexOf("Js/Demarrage.js", i + 1) === -1 && i > h.indexOf("Js/Donnees.js") && i > h.indexOf("Js/Synchro.js") && i > h.indexOf("Js/AppLayout.js"); }));
  const w0 = page("Planning.html", null, "#tableau");
  const imgLogo = w0.document.querySelector(".entete-logo-icone img"); imgLogo.dispatchEvent(new w0.Event("error"));
  t("logo : s'il ne charge pas, il est masqué par un écouteur (et non plus par un onerror en attribut, bloqué par la CSP)", imgLogo.hidden === true && !/onerror/.test(lire("Js/AppLayout.js").replace(/\/\*[\s\S]*?\*\//g, "")));
  t("accessibilité : le menu annonce la page courante (aria-current=\"page\") dans le rail latéral ET la barre du bas, et seulement sur elle", w0.document.querySelectorAll('.rail-lateral-lien[aria-current="page"]').length === 1 && w0.document.querySelectorAll('.nav-basse-lien[aria-current="page"]').length === 1 && /Planning/.test(w0.document.querySelector('.rail-lateral-lien[aria-current="page"]').textContent) && w0.document.querySelectorAll("[aria-current]").length === 2);
  t("démarrage : le menu est construit et la page « planning » est marquée active (Demarrage.js remplace l'ancien bloc en ligne)", w0.document.body.dataset.page === "planning" && !!w0.document.querySelector('[aria-current="page"]'));

  // ---------- Amorce de l'animation (Amorce.js)
  const amorce = (reglage, reduit) => { const w = page("Index.html", null, "", null, (win) => { win.sessionStorage.removeItem("acsc_splash"); win.sessionStorage.removeItem("acsc_splash_dec"); if (reglage) win.localStorage.setItem("acsc_animation", reglage); if (reduit) win.matchMedia = () => ({ matches: true }); }); return { decision: w.sessionStorage.getItem("acsc_splash_dec"), actif: w.document.documentElement.classList.contains("splash-actif") }; };
  let r = amorce(null, false);
  t("amorce : sans réglage, l'animation se joue (décision « joue », classe splash-actif posée avant l'affichage)", r.decision === "joue" && r.actif === true);
  r = amorce("jamais", false); t("amorce : réglage « jamais » → pas d'animation", r.decision === "jamais" && r.actif === false);
  r = amorce("auto", true); t("amorce : réglage « auto » + mouvement réduit demandé au système → pas d'animation", r.decision === "reduit" && r.actif === false);

  // ---------- Jonction d'équipe : vrai client Supabase, faux réseau
  const reponse = { corps: "[]", statut: 200 }; const appels = [];
  const faux = async (url, opts) => { appels.push({ url: String(url), corps: opts && opts.body ? String(opts.body) : "" }); const rpc = /rpc\/rejoindre_equipe/.test(String(url)); return new Response(rpc ? reponse.corps : "[]", { status: rpc ? reponse.statut : 200, headers: { "Content-Type": "application/json" } }); };
  const w = page("Index.html", null, "", null, (win) => Object.defineProperty(win, "fetch", { configurable: true, get: () => faux, set: () => {} }));
  reponse.corps = JSON.stringify({ erreur: "code_inconnu" });
  let res = await w.Synchro.rejoindreEquipe("zzzzzzzz", false);
  t("équipe : un faux code RENVOYÉ par la base ({erreur:code_inconnu}) devient « Code d'équipe inconnu » (le client ne le prend pas pour un succès)", res.ok === false && /Code d'équipe inconnu/.test(res.message));
  t("équipe : l'appel envoie bien les arguments nommés code et nom_affiche (noms inchangés, l'ancien client reste compatible)", appels.some(a => /rpc\/rejoindre_equipe/.test(a.url) && /"code":"zzzzzzzz"/.test(a.corps) && /"nom_affiche"/.test(a.corps)));
  reponse.corps = JSON.stringify({ code: "P0001", message: "trop_de_tentatives", details: null, hint: null }); reponse.statut = 400;
  res = await w.Synchro.rejoindreEquipe("zzzzzzzz", false);
  t("équipe : « trop_de_tentatives » → message clair (réessayer dans 15 minutes)", res.ok === false && /Trop d'essais.*15 minutes/.test(res.message));
  reponse.corps = JSON.stringify({ code: "P0001", message: "deja_membre", details: null, hint: null });
  res = await w.Synchro.rejoindreEquipe("zzzzzzzz", false);
  t("équipe : « deja_membre » garde son message", /fait déjà partie d'une équipe/.test(res.message));

  // ---------- Fenêtres : clavier, focus, lecteurs d'écran
  const wf = page("Index.html"); const doc = wf.document; const ouvreur = doc.createElement("button"); ouvreur.id = "ouvreur"; ouvreur.textContent = "ouvrir"; doc.body.appendChild(ouvreur); ouvreur.focus();
  const touche = (cible, key, extra) => { const e = new wf.KeyboardEvent("keydown", Object.assign({ key, bubbles: true, cancelable: true }, extra || {})); cible.dispatchEvent(e); return e; };
  wf.AppLayout.ouvrirFeuille("bas", "Titre de test", '<input id="x1"><button type="button" id="x2">OK</button>');
  const fen = doc.querySelector(".feuille"); const titreId = fen.getAttribute("aria-labelledby");
  t("fenêtre : rôle « dialog », modale, titre annoncé aux lecteurs d'écran (aria-labelledby pointe sur le vrai titre)", fen.getAttribute("role") === "dialog" && fen.getAttribute("aria-modal") === "true" && !!doc.getElementById(titreId) && doc.getElementById(titreId).textContent === "Titre de test");
  t("fenêtre : le focus entre dans la fenêtre à l'ouverture (sur elle-même, pour ne pas ouvrir le clavier d'un téléphone)", doc.activeElement === fen);
  doc.getElementById("x2").focus(); const tab1 = touche(doc.getElementById("x2"), "Tab");
  t("fenêtre : Tab sur le DERNIER élément revient au premier (le focus ne s'échappe pas derrière la fenêtre)", tab1.defaultPrevented && doc.activeElement === fen.querySelector(".feuille-bouton-fermer"));
  const tab2 = touche(fen.querySelector(".feuille-bouton-fermer"), "Tab", { shiftKey: true });
  t("fenêtre : Maj+Tab sur le PREMIER élément va au dernier", tab2.defaultPrevented && doc.activeElement === doc.getElementById("x2"));
  const ech = touche(doc.getElementById("x1"), "Escape");
  t("fenêtre : Échap la ferme et le focus retourne à l'élément qui l'avait ouverte", ech.defaultPrevented && fen.hidden === true && doc.activeElement === ouvreur);
  const ech2 = touche(ouvreur, "Escape"); t("fenêtre : Échap sans fenêtre ouverte ne fait rien (n'intercepte pas la touche)", ech2.defaultPrevented === false);
  wf.AppLayout.ouvrirFeuille("droite", "Autre", "<p>x</p>"); const intrus = doc.createElement("div"); intrus.id = "autre-couche"; intrus.tabIndex = 0; doc.body.appendChild(intrus); intrus.focus();
  touche(intrus, "Escape"); t("fenêtre : Échap venu d'une AUTRE couche (aperçu d'un rapport, par exemple) ne ferme pas la fenêtre dessous", doc.querySelector(".feuille").hidden === false);
  wf.AppLayout.fermerFeuille();

  // ---------- Formulaires : aides de saisie mobile
  wf.Formulaires.client && wf.Formulaires.client();
  const champs = { tel: doc.getElementById("fc-tel"), email: doc.getElementById("fc-email"), cadence: doc.getElementById("fc-cadence"), nom: doc.getElementById("fc-nom"), ville: doc.getElementById("fc-ville") };
  t("formulaires : téléphone en type « tel » (clavier numérique), e-mail en type « email » sans majuscule ni correction, cadence en clavier numérique", !!champs.tel && champs.tel.type === "tel" && champs.email.type === "email" && champs.email.getAttribute("autocapitalize") === "none" && champs.email.getAttribute("spellcheck") === "false" && champs.cadence.getAttribute("inputmode") === "numeric");
  t("formulaires : nom et ville avec majuscule automatique ; aucun champ ne propose le remplissage automatique du navigateur (ce sont des clients, pas l'utilisateur)", champs.nom.getAttribute("autocapitalize") === "words" && champs.ville.getAttribute("autocapitalize") === "words" && Array.from(doc.querySelectorAll("#form-client input[type=text], #form-client input[type=tel], #form-client input[type=email], #form-client input[type=number]")).every(i => i.getAttribute("autocomplete") === "off"));
  t("mouvement réduit : un filet de sécurité global neutralise toutes les animations et transitions", /prefers-reduced-motion: reduce\)\s*\{\s*\*, \*::before, \*::after \{[^}]*animation-duration: 0\.01ms !important[^}]*transition-duration: 0\.01ms !important[^}]*scroll-behavior: auto !important/.test(lire("CSS/campagne.css")));

  // ---------- Migration versionnée
  const sql = lire("supabase/migrations/20261006_securite_equipes.sql");
  t("base : la migration est versionnée dans le dépôt (anon révoqué, journal des tentatives, limite 5/15 min, paramètre qualifié)", /revoke all on all tables in schema public from anon/.test(sql) && /tentatives_equipe/.test(sql) && />= 5/.test(sql) && /rejoindre_equipe\.code/.test(sql));
};
