/* Réglages › Informations : onglets, version, dernière mise à jour, état, dernière nouveauté. */
module.exports = async function ({ page, t }) {
  const attendre = (ms) => new Promise(r => setTimeout(r, ms));
  const clic = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
  const faux = (win, fn) => Object.defineProperty(win, "fetch", { configurable: true, get: () => fn, set: () => {} });
  const reponse = (texte, ok) => () => Promise.resolve({ ok: ok !== false, text: () => Promise.resolve(texte) });
  const feuille = (w) => w.document.querySelector(".feuille:not([hidden])");
  const txt = (el) => el.textContent.replace(/\s+/g, " ").trim();

  let w = page("Reglages.html"); const d = w.document;
  const VERSION = w.AppLayout.VERSION, L = w.Nouveautes.LISTE;
  const onglet = (id) => d.getElementById("onglet-reglages-" + id), panneau = (id) => d.getElementById("panneau-reglages-" + id);

  // ---------- Structure : titre, deux onglets, deux panneaux
  t("Réglages : un seul titre « Réglages », au-dessus des onglets", d.querySelectorAll("h1").length === 1 && /Réglages/.test(d.querySelector("h1").textContent) && d.querySelector("h1").compareDocumentPosition(d.querySelector('[role="tablist"]')) & 4);
  t("Réglages : deux onglets « Réglages » et « Informations », avec leurs rôles (tablist / tab / tabpanel)", d.querySelectorAll('[role="tab"]').length === 2 && txt(onglet("general")) === "⚙️Réglages" && txt(onglet("informations")) === "ℹ️Informations" && d.querySelectorAll('[role="tabpanel"]').length === 2 && onglet("general").getAttribute("aria-controls") === "panneau-reglages-general");
  t("Réglages : par défaut, l'onglet « Réglages » est actif et son contenu habituel est intact (profil, apparence, sauvegarde)", onglet("general").getAttribute("aria-selected") === "true" && !panneau("general").hidden && panneau("informations").hidden && !!d.getElementById("form-profil") && /Apparence/.test(panneau("general").textContent) && /Tes données/.test(panneau("general").textContent));
  t("Réglages : la version n'est plus dans « Tes données » (elle est dans Informations)", !/Version de l'application/.test(panneau("general").textContent));
  t("Réglages : navigation au clavier (un seul onglet dans l'ordre de tabulation)", onglet("general").getAttribute("tabindex") === "0" && onglet("informations").getAttribute("tabindex") === "-1");

  // ---------- Passer à Informations
  clic(onglet("informations")); await attendre(30);
  t("Informations : l'onglet s'ouvre, l'autre se cache, l'adresse devient #informations", onglet("informations").getAttribute("aria-selected") === "true" && panneau("general").hidden && !panneau("informations").hidden && w.location.hash === "#informations");
  const p = panneau("informations");
  const libelles = Array.from(p.querySelectorAll("dt")).map(x => txt(x));
  t("Informations : ordre logique — Numéro de version, Dernière mise à jour, puis État", libelles.join("|") === "Numéro de version|Dernière mise à jour|État");
  t("Informations : la carte « Dernière nouveauté » vient après la carte de la version", p.querySelector(".info-carte").compareDocumentPosition(p.querySelector(".info-nouv")) & 4);

  // ---------- Numéro de version et dernière mise à jour
  t("version : le numéro affiché est celui de l'application (" + VERSION + ")", txt(p.querySelector(".info-version")) === VERSION && /^\d{4}\.\d{2}\.\d{2}-[a-z]$/.test(VERSION));
  const [a, m, j] = VERSION.split("-")[0].split(".").map(Number);
  const attendue = new Date(Date.UTC(a, m - 1, j)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).replace(/^(\w+) 1 /, "$1 1er ");
  const lignes = Array.from(p.querySelectorAll(".info-ligne"));
  t("dernière mise à jour : la date de la version, en toutes lettres (" + attendue + ")", txt(lignes[1].querySelector("strong")) === attendue);
  t("dernière mise à jour : ancienneté en clair (aujourd'hui, hier, il y a N jours…) et origine de la date", /(aujourd'hui|hier|il y a \d+ jours?|il y a \d+ mois|il y a \d+ ans?)/.test(txt(lignes[1])) && /date de publication de la version installée/.test(txt(lignes[1])));
  t("version : explication du format du numéro", /Année · mois · jour/.test(txt(lignes[0])));

  // ---------- Dernière nouveauté
  const nv = p.querySelector(".info-nouv");
  t("dernière nouveauté : la plus récente de la liste (titre, date, version, résumé)", txt(nv.querySelector(".info-nouv-titre")) === L[0].titre && nv.textContent.indexOf(L[0].resume) !== -1 && new RegExp(L[0].date.slice(8, 10) + "/" + L[0].date.slice(5, 7) + "/" + L[0].date.slice(0, 4) + " · version " + L[0].version.replace(/\./g, "\\.")).test(txt(nv)));
  const ph = nv.querySelector("img");
  t("dernière nouveauté : la première photo, avec texte alternatif et dimensions", !!ph && ph.getAttribute("src") === L[0].images[0].src && ph.getAttribute("alt") === L[0].images[0].alt && ph.getAttribute("width") === String(L[0].images[0].largeur));
  clic(nv.querySelector("[data-nouv-derniere]"));
  let f = feuille(w);
  t("« Voir la nouveauté » : ouvre cette nouveauté seule (photos, étapes, pas de navigation)", !!f && f.querySelector(".nouv-titre").textContent === L[0].titre && f.querySelectorAll(".nouv-figure img").length === L[0].images.length && !f.querySelector(".nouv-nav") && f.querySelector("[data-nouv-compris]").textContent === "Fermer");
  clic(f.querySelector("[data-nouv-compris]"));
  clic(nv.querySelector("[data-nouv-historique]"));
  f = feuille(w);
  t("« Toutes les nouveautés (N) » : ouvre l'historique complet avec navigation", new RegExp("Toutes les nouveautés \\(" + L.length + "\\)").test(txt(nv)) && !!f && new RegExp("1/" + L.length).test(f.textContent));
  clic(f.querySelector("[data-nouv-compris]"));
  t("l'avoir consultée depuis Réglages la marque comme vue (la pastille du menu disparaît, elle ne revient pas en annonce)", w.localStorage.getItem("acsc_nouveautes_vue") === L[0].id && w.Nouveautes.nbNonVues() === 0);

  // ---------- Les onglets survivent aux changements de données ; retour à Réglages
  w.Donnees.ajouterClient({ nom: "Autre", ville: "X", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  t("un changement de données ne ramène pas à l'onglet « Réglages »", onglet("informations").getAttribute("aria-selected") === "true" && !panneau("informations").hidden && p.querySelector(".info-version"));
  clic(onglet("general"));
  t("retour à « Réglages » : l'adresse n'a plus #informations", !panneau("general").hidden && panneau("informations").hidden && w.location.hash === "");

  // ---------- Clavier
  onglet("general").dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  t("clavier : flèche droite passe à « Informations » et lui donne le focus", onglet("informations").getAttribute("aria-selected") === "true" && d.activeElement === onglet("informations"));
  onglet("informations").dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
  t("clavier : flèche gauche revient à « Réglages »", onglet("general").getAttribute("aria-selected") === "true");

  // ---------- Lien direct (#informations) et menu du profil
  w = page("Reglages.html", null, "#informations"); await attendre(30);
  t("lien direct Reglages.html#informations : s'ouvre sur l'onglet Informations", w.document.getElementById("onglet-reglages-informations").getAttribute("aria-selected") === "true" && !w.document.getElementById("panneau-reglages-informations").hidden);
  w = page("Index.html"); clic(w.document.querySelector(".entete-avatar"));
  const lien = w.document.querySelector("a.menu-avatar-version");
  t("menu du profil : la version est un lien vers Réglages › Informations", !!lien && lien.getAttribute("href") === "Reglages.html#informations" && new RegExp("Version " + VERSION.replace(/\./g, "\\.")).test(lien.textContent));
  w = page("Reglages.html"); await attendre(30);
  w.location.hash = "#informations"; await attendre(80);
  t("changement d'adresse sur la page (#informations) : bascule vers Informations sans recharger", w.document.getElementById("onglet-reglages-informations").getAttribute("aria-selected") === "true");

  // ---------- Un élément « hidden » doit RESTER caché : le jsdom ne charge pas la feuille de style, la règle est donc contrôlée ici
  const css = require("fs").readFileSync(require("path").join(__dirname, "..", "CSS", "campagne.css"), "utf8");
  t("« Recharger l'application » : la règle CSS garantit qu'un bouton hidden n'est jamais affiché (le défaut vu en vrai navigateur)", /\.info-actions \[hidden\] \{ display: none; \}/.test(css) && /\.bouton \{[^}]*display: (inline-)?flex/.test(css + require("fs").readFileSync(require("path").join(__dirname, "..", "CSS", "style.css"), "utf8")));

  // ---------- État de la mise à jour
  const etat = (win) => txt(win.document.getElementById("info-etat"));
  w = page("Reglages.html", null, "#informations", null, (win) => faux(win, reponse(VERSION + "\n"))); await attendre(120);
  t("état : même version que le serveur → « Tu as la dernière version », pas de bouton Recharger", /Tu as la dernière version \(vérifié à \d{2}:\d{2}\)/.test(etat(w)) && w.document.querySelector("[data-recharger]").hidden && w.document.getElementById("info-etat").classList.contains("info-etat--a-jour"));
  let rep = reponse("2099.01.01-a\n");
  w = page("Reglages.html", null, "#informations", null, (win) => faux(win, () => rep())); await attendre(120);
  t("état : version plus récente sur le serveur → elle est annoncée, avec le bouton « Mettre à jour maintenant »", /Une nouvelle version est disponible : 2099\.01\.01-a/.test(etat(w)) && !w.document.querySelector("[data-recharger]").hidden && /Mettre à jour maintenant/.test(w.document.querySelector("[data-recharger]").textContent));
  rep = reponse(VERSION); clic(w.document.querySelector("[data-verifier-maj]")); await attendre(120);
  t("« Vérifier les mises à jour » relance le contrôle et met l'état à jour (le serveur n'a plus de nouveauté)", /Tu as la dernière version/.test(etat(w)) && w.document.querySelector("[data-recharger]").hidden);
  w = page("Reglages.html", null, "#informations", null, (win) => faux(win, () => Promise.reject(new Error("hors ligne")))); await attendre(120);
  t("état : hors ligne → message clair, pas d'erreur, pas de bouton Recharger", /Vérification impossible/.test(etat(w)) && w.document.querySelector("[data-recharger]").hidden);
  w = page("Reglages.html", null, "#informations", null, (win) => faux(win, reponse("<html>404</html>"))); await attendre(120);
  t("état : réponse invalide (page d'erreur au lieu d'un numéro) → traitée comme indisponible", /Vérification impossible/.test(etat(w)));
};
