/* Mobile, réseau lent, installation, accessibilité, auto-diagnostic. */
const fs = require("fs");
const path = require("path");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t }) {
  const racine = path.join(__dirname, "..");
  const lire = (f) => fs.readFileSync(path.join(racine, f), "utf8");
  const clic = (w, el) => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));

  // ---------- Service worker
  const sw = lire("sw.js");
  const precache = [...(sw.match(/const PRECACHE = \[([\s\S]*?)\];/) || [, ""])[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
  const pages = fs.readdirSync(racine).filter(f => /\.html$/.test(f) && f !== "404.html");
  const attendu = [].concat(pages, ["manifest.webmanifest"], fs.readdirSync(path.join(racine, "CSS")).map(f => "CSS/" + f), fs.readdirSync(path.join(racine, "Js")).filter(f => /\.js$/.test(f)).map(f => "Js/" + f),
    fs.readdirSync(path.join(racine, "Vendor")).map(d => fs.readdirSync(path.join(racine, "Vendor", d)).filter(f => /\.js$/.test(f)).map(f => "Vendor/" + d + "/" + f)).reduce((a, b) => a.concat(b), []), ["Images/logo.png", "Images/icone-192.png", "Images/icone-512.png", "Images/apple-touch-icon.png"]);
  const manquants = attendu.filter(f => precache.indexOf(f) === -1), inconnus = precache.filter(f => !fs.existsSync(path.join(racine, f)));
  t("service worker : la liste de préchargement correspond EXACTEMENT aux fichiers du projet (pages, CSS, scripts, bibliothèques, icônes)" + (manquants.length ? " — MANQUE : " + manquants.slice(0, 3).join(", ") : "") + (inconnus.length ? " — INEXISTANT : " + inconnus.slice(0, 3).join(", ") : ""), manquants.length === 0 && inconnus.length === 0);
  const scriptsPages = new Set(); pages.forEach(f => { for (const m of lire(f).matchAll(/(?:src|href)="((?:Js|CSS|Vendor)\/[^"]+)"/g)) scriptsPages.add(m[1]); });
  t("service worker : chaque script et feuille de style chargé par une page est préchargé (la page s'ouvre complète hors ligne)", [...scriptsPages].every(f => precache.indexOf(f) > -1));
  t("service worker : sw.js est à jour avec les fichiers du projet (node Tests/maj-version.js régénère la liste à chaque livraison)", require("./maj-version.js").swAttendu() === sw);
  t("service worker : le nom du cache a changé (les anciennes copies sont purgées) et l'installation attend le préchargement avant d'activer", !/"acsc-v5"/.test(sw) && /const VERSION = "acsc-v\d+"/.test(sw) && /Promise\.allSettled\(PRECACHE[\s\S]*?\.then\(\(\) => self\.skipWaiting\(\)\)/.test(sw));
  t("service worker : réseau d'abord avec délai de 3 s, puis copie locale ; mode « copie d'abord » d'une minute après un rabattement", /DELAI_RESEAU_MS = 3000/.test(sw) && /DUREE_MODE_LENT_MS = 60000/.test(sw) && /copieExacte/.test(sw));
  t("service worker : version.json et version.txt ne sont JAMAIS servis depuis le cache (un numéro périmé ferait croire que tout est à jour)", /TOUJOURS_FRAIS = \/\\\/version\\\.\(json\|txt\)\$\//.test(sw) && /if \(TOUJOURS_FRAIS\.test\(url\.pathname\)\) return;/.test(sw) && precache.every(f => !/version\./.test(f)));
  t("service worker : les vidéos et requêtes partielles restent hors du cache (lecture sur iPhone)", /\.\(mp4\|webm\)/.test(sw) && /headers\.has\("range"\)/.test(sw));

  // ---------- Manifeste (installation, Android)
  const m = JSON.parse(lire("manifest.webmanifest"));
  t("manifeste : identité stable (id = page de démarrage, donc l'installation existante n'est pas dupliquée), langue, catégories", m.id === m.start_url && m.lang === "fr" && m.categories.length >= 1 && m.display === "standalone");
  t("manifeste : raccourcis Android (appui long sur l'icône) vers des pages qui existent", m.shortcuts.length >= 3 && m.shortcuts.every(s => s.name && fs.existsSync(path.join(racine, s.url))));
  t("manifeste : icône « maskable » (Android découpe l'icône à sa forme) et icônes 192 / 512", m.icons.some(i => /maskable/.test(i.purpose || "")) && m.icons.some(i => i.sizes === "192x192") && m.icons.some(i => i.sizes === "512x512"));

  // ---------- Tactile, CSS, en-têtes
  const css = lire("CSS/campagne.css"), toml = lire("netlify.toml");
  t("tactile : pas de délai de 300 ms ni de zoom au double toucher (touch-action: manipulation) sur les contrôles", /a, button, \[role="button"\], input, select, textarea, label, summary \{ touch-action: manipulation; \}/.test(css));
  t("fenêtres : le défilement ne fuit pas vers la page derrière (overscroll-behavior: contain)", /\.feuille \{ overscroll-behavior: contain; \}/.test(css));
  t("sécurité : Permissions-Policy interdit caméra, micro, paiement, USB ; COOP same-origin ; la géolocalisation reste permise", /Permissions-Policy = "geolocation=\(self\), camera=\(\), microphone=\(\), payment=\(\), usb=\(\)/.test(toml) && /Cross-Origin-Opener-Policy = "same-origin"/.test(toml));

  // ---------- Accessibilité
  const w = page("Index.html"); const d = w.document;
  const lien = d.body.firstElementChild;
  t("accessibilité : « Aller au contenu » est le premier élément atteint par Tab, cible le contenu, et le contenu est focusable par programme", lien.classList.contains("lien-evitement") && lien.textContent === "Aller au contenu" && d.getElementById("contenu-page").tabIndex === -1);
  clic(w, lien);
  t("accessibilité : le lien d'évitement déplace le focus sur le contenu SANS toucher à l'adresse (le « # » sert aux onglets de certaines pages)", d.activeElement === d.getElementById("contenu-page") && w.location.hash === "");
  w.AppLayout.toast("Client créé ✓"); await sleep(150);
  const zone = d.getElementById("annonces");
  t("accessibilité : les messages sont ANNONCÉS aux lecteurs d'écran (région vocale polie, déjà présente dans la page)", !!zone && zone.getAttribute("role") === "status" && zone.getAttribute("aria-live") === "polite" && zone.textContent === "Client créé ✓" && zone.className === "annonces-vocales");
  w.Formulaires.client(); const err = d.querySelector("#form-client [data-erreur]");
  d.getElementById("form-client").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  t("accessibilité : le message d'erreur d'un formulaire est annoncé (role=alert) et s'affiche", err.getAttribute("role") === "alert" && err.textContent.length > 5);
  w.AppLayout.ouvrirFeuille("bas", "Saisie", '<input id="champ-test">'); const champ = d.getElementById("champ-test"); const demandes = []; champ.scrollIntoView = (o) => demandes.push(o);
  champ.dispatchEvent(new w.Event("focusin", { bubbles: true })); await sleep(380);
  t("mobile : un champ qui prend le focus dans une fenêtre est ramené au centre (le clavier ne le cache plus)", demandes.length === 1 && demandes[0].block === "center");
  w.AppLayout.fermerFeuille();

  // ---------- Auto-diagnostic : chaque cas
  const wr = page("Reglages.html", null, "#informations"); const A = wr.AutoDiagnostic;
  const sain = { version: "2026.10.06-e", recupererVersion: async () => ({ version: "2026.10.06-e" }), installee: () => true, enLigne: () => true, enregistrementSW: async () => ({ active: {} }), fichiersHorsLigne: async () => 43,
    testerStockage: () => true, estimerStockage: async () => ({ usage: 2e6, quota: 1e9 }), synchro: () => ({ statut: "ok", derniere: "2026-10-06T10:30:00Z" }), enAttenteEnvoi: () => 0, permissionNotifications: () => "granted", erreursEnregistrees: () => 0 };
  const ligne = (r, nom) => r.find(x => x.nom === nom);
  let r = await A.verifier(sain);
  t("auto-diagnostic : tout va bien → 8 contrôles, tous ✅, verdict « ok »", r.length === 8 && r.every(x => x.etat === "ok") && A.verdict(r) === "ok");
  r = await A.verifier(Object.assign({}, sain, { recupererVersion: async () => ({ version: "2026.10.07-a" }) }));
  t("auto-diagnostic : version publiée plus récente → ⚠️ avec la marche à suivre", ligne(r, "Version").etat === "attention" && /2026\.10\.07-a disponible.*mets à jour/.test(ligne(r, "Version").detail));
  r = await A.verifier(Object.assign({}, sain, { recupererVersion: async () => { throw new Error("réseau"); } }));
  t("auto-diagnostic : version illisible (hors ligne) → ⚠️ « vérification impossible », jamais un faux « à jour »", ligne(r, "Version").etat === "attention" && /Vérification impossible/.test(ligne(r, "Version").detail));
  r = await A.verifier(Object.assign({}, sain, { testerStockage: () => { throw new Error("quota"); } }));
  t("auto-diagnostic : stockage refusé → ❌ (saisies PERDUES), verdict « erreur »", ligne(r, "Stockage").etat === "erreur" && /PERDUES/.test(ligne(r, "Stockage").detail) && A.verdict(r) === "erreur");
  r = await A.verifier(Object.assign({}, sain, { estimerStockage: async () => ({ usage: 8e8, quota: 1e9 }) }));
  t("auto-diagnostic : stockage rempli à 80 % → ⚠️ « presque plein »", ligne(r, "Stockage").etat === "attention" && /presque plein/.test(ligne(r, "Stockage").detail));
  r = await A.verifier(Object.assign({}, sain, { installee: () => false, enregistrementSW: async () => null, fichiersHorsLigne: async () => 0 }));
  t("auto-diagnostic : ouverte dans le navigateur et sans service d'ouverture hors ligne → deux ⚠️ expliqués (dont l'installation sur iPhone)", ligne(r, "Installation").etat === "attention" && /Partager/.test(ligne(r, "Installation").detail) && ligne(r, "Hors ligne").etat === "attention");
  r = await A.verifier(Object.assign({}, sain, { fichiersHorsLigne: async () => 12 }));
  t("auto-diagnostic : copie locale incomplète (12 fichiers) → ⚠️", ligne(r, "Hors ligne").etat === "attention" && /incomplète \(12/.test(ligne(r, "Hors ligne").detail));
  r = await A.verifier(Object.assign({}, sain, { enLigne: () => false }));
  t("auto-diagnostic : hors ligne → ⚠️ rassurant (l'application fonctionne, la synchronisation reprendra)", ligne(r, "Réseau").etat === "attention" && /reprendra/.test(ligne(r, "Réseau").detail));
  r = await A.verifier(Object.assign({}, sain, { synchro: () => ({ statut: "erreur", erreur: "Réseau indisponible." }), enAttenteEnvoi: () => 3 }));
  t("auto-diagnostic : synchronisation en erreur → ❌ avec le message ET le nombre d'éléments en attente", ligne(r, "Synchronisation").etat === "erreur" && /Réseau indisponible\. 3 éléments en attente/.test(ligne(r, "Synchronisation").detail));
  r = await A.verifier(Object.assign({}, sain, { synchro: () => ({ statut: "deconnecte" }) }));
  t("auto-diagnostic : non connecté → ⚠️ « tes données restent sur cet appareil »", ligne(r, "Synchronisation").etat === "attention" && /restent sur cet appareil/.test(ligne(r, "Synchronisation").detail));
  r = await A.verifier(Object.assign({}, sain, { enAttenteEnvoi: () => 1 }));
  t("auto-diagnostic : connecté mais un élément n'est pas parti → ⚠️ (rien de perdu, mais à envoyer)", ligne(r, "Synchronisation").etat === "attention" && /1 élément en attente/.test(ligne(r, "Synchronisation").detail));
  r = await A.verifier(Object.assign({}, sain, { permissionNotifications: () => "denied", erreursEnregistrees: () => 2 }));
  t("auto-diagnostic : notifications refusées et 2 erreurs enregistrées → deux ⚠️", ligne(r, "Notifications").etat === "attention" && /Refusées/.test(ligne(r, "Notifications").detail) && ligne(r, "Erreurs").etat === "attention" && /2 problèmes enregistrés/.test(ligne(r, "Erreurs").detail));
  t("auto-diagnostic : texte à copier = une ligne par contrôle, avec son icône", A.texte(await A.verifier(sain)).split("\n").length === 8 && /^✅ Version : /.test(A.texte(await A.verifier(sain))));

  // ---------- Dans l'écran Réglages › Informations
  const p = wr.document.getElementById("panneau-reglages-informations");
  const bouton = p.querySelector("[data-diag-verifier]");
  t("réglages : le bouton « Vérifier mon installation » est dans la carte Diagnostic", !!bouton && /Vérifier mon installation/.test(bouton.textContent));
  clic(wr, bouton); await sleep(250);
  const lignes = p.querySelectorAll("[data-diag-resultats] li[data-etat]");
  t("réglages : un clic affiche les 8 contrôles, chacun avec son état, et le bouton redevient utilisable", lignes.length === 8 && !bouton.disabled && /Vérifier mon installation/.test(bouton.textContent) && Array.from(lignes).every(l => /^(✅|⚠️|❌)/.test(l.textContent)));
  let copie = ""; Object.defineProperty(wr.navigator, "clipboard", { configurable: true, value: { writeText: (x) => { copie = x; return Promise.resolve(); } } });
  clic(wr, p.querySelector("[data-diag-copier-resultat]"));
  t("réglages : « Copier ce résultat » copie les contrôles (version, stockage…), sans aucune donnée de client", /Version :/.test(copie) && /Stockage :/.test(copie) && copie.split("\n").length === 8);
};
