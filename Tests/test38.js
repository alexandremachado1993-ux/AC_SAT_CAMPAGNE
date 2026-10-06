/* Qualité interne : gestion centralisée des erreurs (Erreurs.js), journal de diagnostic, validation de la saisie d'une visite. */
const fs = require("fs");
const path = require("path");
module.exports = async function ({ page, t }) {
  const racine = path.join(__dirname, "..");
  const clic = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
  /* Texte VISIBLE seulement : body.textContent inclut le code des balises <script> (la bibliothèque Supabase contient « TypeError »). */
  const corps = (w) => Array.from(w.document.body.querySelectorAll("*")).filter(e => !e.children.length && !/^(SCRIPT|STYLE)$/.test(e.tagName)).map(e => e.textContent).join(" ");

  // ---------- Garde-fous statiques
  const avalees = [];
  fs.readdirSync(path.join(racine, "Js")).filter(f => f.endsWith(".js") && f !== "Erreurs.js").forEach(f => {
    const src = fs.readFileSync(path.join(racine, "Js", f), "utf8");
    for (const m of src.matchAll(/catch\s*(?:\(\w*\))?\s*\{([^{}]*)\}/g)) {
      if (!m[1].replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "").trim()) avalees.push(f + " : " + m[0].replace(/\s+/g, " ").slice(0, 70));
    }
  });
  t("erreurs : plus AUCUNE erreur avalée en silence dans Js/ (catch vide ou réduit à un commentaire)" + (avalees.length ? " — " + avalees[0] : ""), avalees.length === 0);
  const pages = fs.readdirSync(racine).filter(f => /\.html$/.test(f) && f !== "404.html");
  const mal = pages.filter(p => { const premier = (fs.readFileSync(path.join(racine, p), "utf8").match(/<script src="(Js\/[^"]+)"/) || [])[1]; return premier !== "Js/Erreurs.js"; });
  t("erreurs : Erreurs.js est le PREMIER script Js/ de chaque page (il doit exister quand les autres modules tombent en panne)" + (mal.length ? " — " + mal.join(", ") : ""), mal.length === 0);

  // ---------- Journal
  let w = page("Index.html"); const E = w.Erreurs; E.effacer();
  E.consigner("test : contexte", new Error("détail technique"));
  let j = E.lire();
  t("consigner : une entrée (heure, contexte, erreur, page, gravité « info ») et RIEN d'affiché à l'utilisateur", j.length === 1 && j[0].contexte === "test : contexte" && /détail technique/.test(j[0].erreur) && j[0].gravite === "info" && j[0].page === "Index.html" && /^\d{4}-\d{2}-\d{2}T/.test(j[0].t) && !/Un problème est survenu/.test(corps(w)));
  E.signaler("test : panne", new TypeError("détail interne"));
  t("signaler : journal (gravité « erreur ») + message sobre, SANS aucun détail technique pour l'utilisateur", E.lire()[1].gravite === "erreur" && /TypeError : détail interne/.test(E.lire()[1].erreur) && /Un problème est survenu/.test(corps(w)) && !/détail interne|TypeError/.test(corps(w)));
  E.signaler("test : panne 2", "x"); E.signaler("test : panne 3", "y");
  t("signaler : au plus UN message toutes les 15 secondes (pas de rafale), toutes les erreurs restent dans le journal", corps(w).split("Un problème est survenu").length - 1 === 1 && E.nombre() === 4);
  E.effacer(); for (let i = 0; i < 40; i++) E.consigner("c" + i, "e");
  t("journal : borné à 30 entrées (les plus anciennes sont oubliées)", E.nombre() === 30 && E.lire()[0].contexte === "c10" && E.lire()[29].contexte === "c39");
  E.effacer();
  const setItem = w.Storage.prototype.setItem; w.Storage.prototype.setItem = () => { throw new Error("quota dépassé"); };
  let leve = false; try { E.consigner("a", "b"); E.signaler("c", "d"); } catch (e) { leve = true; }
  w.Storage.prototype.setItem = setItem;
  t("robustesse : si le stockage est plein ou refusé, le journal ne provoque JAMAIS d'erreur lui-même", leve === false);
  t("robustesse : même sans stockage, l'erreur reste consultable en mémoire jusqu'au rechargement", E.lire().length >= 2);
  E.effacer(); w.localStorage.setItem("acsc_erreurs", "{pas du json"); t("robustesse : un journal corrompu est lu comme vide, sans erreur", E.lire().length === 0 && E.nombre() === 0); E.effacer();

  // ---------- Gestionnaires globaux
  w.dispatchEvent(new w.ErrorEvent("error", { error: new RangeError("hors limites"), message: "hors limites" }));
  t("erreur de script non attrapée : consignée avec son contexte", E.lire().some(x => x.contexte === "erreur de script" && /RangeError : hors limites/.test(x.erreur)));
  const avant = E.nombre(); w.dispatchEvent(new w.ErrorEvent("error", { message: "ResizeObserver loop limit exceeded" }));
  t("alerte bénigne du navigateur (ResizeObserver) : ignorée, pas présentée comme une panne", E.nombre() === avant);
  const rejet = new w.Event("unhandledrejection"); rejet.reason = new Error("promesse cassée"); w.dispatchEvent(rejet);
  t("promesse rejetée non gérée : consignée", E.lire().some(x => x.contexte === "promesse non gérée" && /promesse cassée/.test(x.erreur))); E.effacer();

  // ---------- Un écouteur de données qui plante ne bloque plus les autres et n'est plus invisible
  let atteint = false; w.Donnees.ecouter(() => { throw new Error("écouteur cassé"); }); w.Donnees.ecouter(() => { atteint = true; });
  w.Donnees.ajouterClient({ nom: "Zorglub", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  t("données : un écouteur qui plante n'empêche pas les suivants ET l'erreur est signalée (elle était avalée en silence)", atteint === true && E.lire().some(x => /Donnees : un écouteur/.test(x.contexte) && /écouteur cassé/.test(x.erreur)));

  // ---------- Journal local à l'appareil (règle R3)
  const exporte = JSON.stringify(w.Donnees.exporter());
  t("règle R3 : le journal est local — absent de la sauvegarde exportée et des données", !/acsc_erreurs|écouteur cassé/.test(exporte) && !/acsc_erreurs/.test(w.localStorage.getItem("acsc_donnees_v1")));

  // ---------- Carte « Diagnostic » (Réglages › Informations)
  w = page("Reglages.html", null, "#informations"); const d = w.document;
  t("diagnostic : sans problème, « Aucun problème enregistré » et aucun bouton", /Aucun problème enregistré sur cet appareil/.test(d.getElementById("panneau-reglages-informations").textContent) && !d.querySelector("[data-diag-copier]"));
  w.Erreurs.consigner("page a", "x"); w.Erreurs.consigner("page b", "y");
  clic(d.getElementById("onglet-reglages-general")); clic(d.getElementById("onglet-reglages-informations"));
  const p = d.getElementById("panneau-reglages-informations");
  t("diagnostic : « 2 problèmes enregistrés sur cet appareil », avec la précision que rien n'est envoyé", /2 problèmes enregistrés sur cet appareil/.test(p.textContent) && /Rien n'est envoyé nulle part/.test(p.textContent) && !!p.querySelector("[data-diag-copier]") && !!p.querySelector("[data-diag-effacer]"));
  let copie = ""; Object.defineProperty(w.navigator, "clipboard", { configurable: true, value: { writeText: (x) => { copie = x; return Promise.resolve(); } } });
  clic(p.querySelector("[data-diag-copier]"));
  t("diagnostic : « Copier le rapport » copie la version et les entrées (plus récente d'abord), sans donnée de clients", /^AC SAT Campagne 2026\./.test(copie) && copie.indexOf("page b") < copie.indexOf("page a") && /· y/.test(copie));
  clic(p.querySelector("[data-diag-effacer]"));
  t("diagnostic : « Effacer le journal » vide tout et met la carte à jour", w.Erreurs.nombre() === 0 && /Aucun problème enregistré/.test(d.getElementById("panneau-reglages-informations").textContent));

  // ---------- Validation de la saisie d'une visite (extraite de l'écran : testable seule)
  w = page("Index.html"); const D = w.Donnees, F = w.Formulaires, v = F.verifierSaisieVisite;
  const c1 = D.ajouterClient({ nom: "A", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 }), c2 = D.ajouterClient({ nom: "B", ville: "Pau", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const l1 = D.enregistrerLigne(c1.id, { nom: "L1", formatHabituel: "1/2M" });
  const auj = D.aujourdhuiIso(), demain = D.ajouterJours(auj, 1), hier = D.ajouterJours(auj, -1);
  const base = { existante: null, date: hier, statut: "effectuee", ligneId: l1.id, typeId: "campagne", clientId: c1.id };
  t("validation visite : date absente → « La date est requise. »", v(Object.assign({}, base, { date: "" })).message === "La date est requise.");
  t("validation visite : nouvelle visite EFFECTUÉE à venir → on propose de la planifier (pas d'erreur)", v(Object.assign({}, base, { date: demain })).planifier === true);
  t("validation visite : visite déjà enregistrée déplacée dans le futur → refusée", /ne peut pas être dans le futur/.test(v(Object.assign({}, base, { date: demain, existante: { id: "x" } })).message));
  t("validation visite : visite NON effectuée (reportée) à venir → refusée comme date future, pas planifiée", /dans le futur/.test(v(Object.assign({}, base, { date: demain, statut: "reportee" })).message));
  t("validation visite : effectuée sans ligne → « Choisis la ligne visitée. » (client avec ligne) ou explication (client sans ligne)", v(Object.assign({}, base, { ligneId: "" })).message === "Choisis la ligne visitée." && /n'a pas de ligne active/.test(v(Object.assign({}, base, { ligneId: "", clientId: c2.id })).message));
  t("validation visite : cas valides → null (passée avec ligne ; type sans ligne comme une réunion ; reportée sans ligne)", v(base) === null && v(Object.assign({}, base, { ligneId: "", typeId: "reunion" })) === null && v(Object.assign({}, base, { ligneId: "", statut: "reportee" })) === null);
  w.Formulaires.visite({ ligneId: l1.id });
  t("formulaire de visite : le HTML extrait donne le même formulaire (client, date, type, statut, ligne, remarques, bouton)", ["fv-client", "fv-date", "fv-type", "fv-statut", "fv-ligne", "fv-remarques", "fv-format", "fv-produit"].every(id => !!w.document.getElementById(id)) && w.document.querySelector("#form-visite button[type=submit]").textContent === "Enregistrer la visite");
};
