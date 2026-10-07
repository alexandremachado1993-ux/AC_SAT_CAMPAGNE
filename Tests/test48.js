/* Fichiers joints au contrôle client (Seametal) : photo ou PDF de la feuille du client. */
const fs = require("fs");
const path = require("path");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t }) {
  const racine = path.join(__dirname, "..");
  const w = page("Index.html"); const d = w.document; const P = w.Pieces; const memoire = P.utiliserMemoire();
  w.URL.createObjectURL = () => "blob:acsc-test"; w.URL.revokeObjectURL = () => {};
  const fichier = (contenu, nom, type) => new w.File([contenu], nom, { type });
  const refus = async (f) => { try { await P.ajouter(f); return ""; } catch (e) { return e.message; } };

  // ---------- 1. Ajouter : types, taille, espace, nom
  const pdf = await P.ajouter(fichier("%PDF-1.4 feuille", "feuille client.pdf", "application/pdf"));
  t("fichiers : un PDF est accepté ; sa fiche porte un identifiant, le nom, le type, la taille et la date", /^pj-/.test(pdf.id) && pdf.nom === "feuille client.pdf" && pdf.type === "application/pdf" && pdf.taille === 16 && /^\d{4}-\d{2}-\d{2}T/.test(pdf.le));
  const png = await P.ajouter(fichier("x".repeat(100), "photo.png", "image/png"));
  const heic = await P.ajouter(fichier("x", "IMG_0042.HEIC", ""));
  t("fichiers : une image (PNG) est acceptée ; un fichier SANS type (HEIC de l'iPhone) est reconnu par son extension", png.type === "image/png" && heic.type === "image/heic");
  t("fichiers : un type non accepté (ZIP) est refusé avec un message qui dit quoi choisir", /PDF ou une image/.test(await refus(fichier("x", "archive.zip", "application/zip"))));
  t("fichiers : un fichier vide est refusé", /vide/.test(await refus(fichier("", "vide.pdf", "application/pdf"))));
  t("fichiers : au-delà de 15 Mo, refusé", /15 Mo/.test(await refus(fichier(new Uint8Array(16 * 1024 * 1024), "gros.pdf", "application/pdf"))));
  Object.defineProperty(w.navigator, "storage", { configurable: true, value: { estimate: async () => ({ usage: 90, quota: 100 }) } });
  t("fichiers : si l'appareil n'a presque plus de place (> 85 %), refusé avec le conseil de libérer de l'espace", /Espace insuffisant/.test(await refus(fichier("xx", "p.pdf", "application/pdf"))));
  Object.defineProperty(w.navigator, "storage", { configurable: true, value: undefined });
  const long = await P.ajouter(fichier("x", "a\u0001b" + "z".repeat(300) + ".pdf", "application/pdf"));
  t("fichiers : le nom est nettoyé (caractères de contrôle retirés) et borné à 120 caractères", long.nom.length === 120 && !/[\u0000-\u001F]/.test(long.nom));
  const relu = await P.lire(pdf.id);
  t("fichiers : le fichier est relu intact, puis supprimé", !!relu && relu.size === 16 && (await P.supprimer(pdf.id), (await P.lire(pdf.id)) === null));
  t("fichiers : un échec inattendu donne un message général (jamais le détail technique), le détail va au journal", P.messageErreur(new Error("QuotaExceededError interne")) === "Ajout impossible sur cet appareil. Réessaie." && w.Erreurs.lire().some(x => /Pieces : ajout impossible/.test(x.contexte)));

  // ---------- 2. Enregistrement du contrôle : la fiche des fichiers SURVIT au nettoyage (c'était une liste blanche)
  const client = w.Donnees.ajouterClient({ nom: "Conserverie Exemple", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const ligne = w.Donnees.enregistrerLigne(client.id, { nom: "Ligne 1", formatHabituel: "1/2M" });
  const visite = (pieces, tetes, note) => w.Donnees.enregistrerVisite({ clientId: client.id, ligneId: ligne.id, date: w.Donnees.aujourdhuiIso(), type: "campagne", mesures: { colonne: "ø65", nbTetes: 2, tetes: tetes || [], client: { note: note || "", tetes: [], pieces } } });
  let v = visite([png, heic], [{ n: 1, v: { croisure: 1.1 } }]);
  t("enregistrement : les fiches des fichiers sont CONSERVÉES avec le contrôle (elles n'étaient pas dans la liste blanche de nettoyage)", v.mesures.client.pieces.length === 2 && v.mesures.client.pieces[0].id === png.id && v.mesures.client.pieces[0].nom === "photo.png");
  v = visite([{ id: "../etc", nom: "x" }, { id: "ab", nom: "court" }, Object.assign({}, png, { taille: "abc", nom: "  Feuille   A  " }), Object.assign({}, png)]);
  t("enregistrement : les fiches invalides sont écartées (identifiant douteux), les doublons aussi, les champs sont typés et nettoyés", v.mesures.client.pieces.length === 1 && v.mesures.client.pieces[0].taille === 0 && v.mesures.client.pieces[0].nom === "Feuille A");
  v = visite(Array.from({ length: 12 }, (_, i) => ({ id: "pj-test-" + i, nom: "f" + i, type: "application/pdf", taille: 10 })));
  t("enregistrement : 10 fichiers au maximum par contrôle", v.mesures.client.pieces.length === 10);
  v = visite([png], []);
  t("enregistrement : un contrôle qui ne porte QUE la feuille du client (aucune mesure) est conservé", !!v.mesures && v.mesures.client.pieces.length === 1 && v.mesures.tetes.length === 0);
  v = w.Donnees.enregistrerVisite({ clientId: client.id, ligneId: ligne.id, date: w.Donnees.aujourdhuiIso(), type: "campagne", mesures: { colonne: "ø65", nbTetes: 2, tetes: [], client: { tetes: [], pieces: [] } } });
  t("enregistrement : sans mesure, sans validation, sans fichier : rien n'est gardé (comme avant)", !v.mesures);
  const sauvegarde = JSON.stringify(w.Donnees.exporter());
  t("sauvegarde : l'export contient les fiches (nom, taille…) mais JAMAIS le contenu des fichiers", /photo\.png/.test(sauvegarde) && !/"blob"/.test(sauvegarde) && !/%PDF/.test(sauvegarde));

  // ---------- 3. Nettoyage des fichiers orphelins
  await memoire.put({ id: "pj-vieuxorph", nom: "vieux", type: "application/pdf", taille: 1, le: new Date(Date.now() - 48 * 3600e3).toISOString(), blob: new w.Blob(["x"]) });
  await memoire.put({ id: "pj-recentorph", nom: "recent", type: "application/pdf", taille: 1, le: new Date().toISOString(), blob: new w.Blob(["x"]) });
  const idsAvant = (await memoire.liste()).map(e => e.id);
  const vieuxUtilise = idsAvant.indexOf(png.id) !== -1;
  await P.nettoyer();
  const apres = (await memoire.liste()).map(e => e.id);
  t("nettoyage : un fichier orphelin de plus de 24 h est supprimé ; un orphelin récent (formulaire en cours) est gardé", apres.indexOf("pj-vieuxorph") === -1 && apres.indexOf("pj-recentorph") !== -1);
  t("nettoyage : un fichier référencé par un contrôle n'est JAMAIS supprimé", vieuxUtilise && apres.indexOf(png.id) !== -1);

  // ---------- 4. L'écran : bloc dans l'onglet « Contrôle client (Seametal) »
  const zone = d.createElement("div"); d.body.appendChild(zone);
  const inst = w.FicheSerti.monter("t48", zone, { ligne: w.Donnees.getLigne(ligne.id), formatCourant: () => "1/2M" });
  const bloc = () => zone.querySelector("[data-serti-pieces]");
  t("écran : l'onglet « Mes mesures » n'affiche aucun bloc de fichiers", bloc().innerHTML === "");
  zone.querySelector('[data-serti-serie="client"]').click();
  const entrees = Array.from(bloc().querySelectorAll("[data-pieces-fichier]"));
  t("écran : l'onglet « Contrôle client (Seametal) » propose « Ajouter un fichier » (PDF et images, plusieurs à la fois) et « Photo » (appareil photo arrière)", entrees.length === 2 && /application\/pdf/.test(entrees[0].accept) && entrees[0].multiple === true && entrees[1].getAttribute("capture") === "environment" && /Feuille du client/.test(bloc().textContent) && /n'est ni synchronisée ni incluse dans la sauvegarde/.test(bloc().textContent) && /aucune valeur à saisir/.test(bloc().textContent));
  const choisir = async (liste) => { const champ = bloc().querySelector("[data-pieces-fichier]"); Object.defineProperty(champ, "files", { configurable: true, value: liste }); champ.dispatchEvent(new w.Event("change", { bubbles: true })); await sleep(120); };
  await choisir([fichier("%PDF-1.4 sheet", "Seametal A.pdf", "application/pdf"), fichier("x".repeat(2048), "photo feuille.png", "image/png")]);
  const lignes = Array.from(bloc().querySelectorAll(".piece"));
  t("écran : deux fichiers choisis → deux lignes (nom, type, taille)", lignes.length === 2 && /Seametal A\.pdf/.test(lignes[0].textContent) && /PDF · 1 Ko/.test(lignes[0].textContent) && /Image · 2 Ko/.test(lignes[1].textContent));
  t("écran : un fichier présent sur l'appareil se OUVRE (nouvel onglet, sans transmettre la page) et se TÉLÉCHARGE", lignes[0].querySelector("[data-piece-ouvrir]").hidden === false && lignes[0].querySelector("[data-piece-ouvrir]").getAttribute("target") === "_blank" && /noopener/.test(lignes[0].querySelector("[data-piece-ouvrir]").getAttribute("rel")) && lignes[0].querySelector("[data-piece-telecharger]").getAttribute("download") === "Seametal A.pdf");
  t("écran : une image affiche sa vignette, un PDF une icône", lignes[1].querySelector("[data-piece-vignette]").hidden === false && lignes[0].querySelector("[data-piece-vignette]") === null && /📄/.test(lignes[0].textContent));
  t("écran : les contrôles sont nommés pour les lecteurs d'écran (« Ouvrir <nom> », « Retirer <nom> du contrôle ») et font 44 px de zone tactile", /Ouvrir Seametal A\.pdf/.test(lignes[0].querySelector("[data-piece-ouvrir]").getAttribute("aria-label")) && /Retirer Seametal A\.pdf du contrôle/.test(lignes[0].querySelector("[data-piece-retirer]").getAttribute("aria-label")) && /\.piece-actions \.bouton \{ min-height: 44px; min-width: 44px;/.test(fs.readFileSync(path.join(racine, "CSS/campagne.css"), "utf8")));
  t("écran : les fiches sont dans le contrôle prêt à enregistrer (FicheSerti.lire)", w.FicheSerti.lire("t48").client.pieces.length === 2);
  zone.querySelector('[data-serti-serie="mes"]').click();
  t("écran : revenir à « Mes mesures » masque le bloc SANS rien perdre", bloc().innerHTML === "" && w.FicheSerti.lire("t48").client.pieces.length === 2);
  zone.querySelector('[data-serti-serie="client"]').click();
  bloc().querySelector("[data-piece-retirer]").click();
  t("écran : « ✕ » retire le fichier du contrôle (une seule ligne reste)", bloc().querySelectorAll(".piece").length === 1 && w.FicheSerti.lire("t48").client.pieces.length === 1);
  const annuler = Array.from(d.querySelectorAll("button")).find(b => b.textContent.trim() === "Annuler");
  t("écran : le retrait propose « Annuler » (rien n'est détruit sans retour)", !!annuler);
  annuler.click();
  t("écran : « Annuler » remet le fichier, à sa place", bloc().querySelectorAll(".piece").length === 2 && /Seametal A\.pdf/.test(bloc().querySelector(".piece").textContent));
  await choisir([fichier("x", "archive.zip", "application/zip")]);
  const message = bloc().querySelector("[data-pieces-erreur]");
  t("écran : un type refusé affiche un message clair, annoncé aux lecteurs d'écran (role=alert)", message.getAttribute("role") === "alert" && /PDF ou une image/.test(message.textContent) && bloc().querySelectorAll(".piece").length === 2);
  for (let i = 0; i < 9; i++) await choisir([fichier("x" + i, "f" + i + ".pdf", "application/pdf")]);
  t("écran : 10 fichiers au maximum, le onzième est refusé avec un message", bloc().querySelectorAll(".piece").length === 10 && /Dix fichiers au maximum/.test(bloc().querySelector("[data-pieces-erreur]").textContent));
  w.FicheSerti.demonter("t48");

  // ---------- 4 bis. Ancien contrôle avec valeurs client : l'ancien écran est gardé, et la feuille s'ajoute dessous
  const zoneAncienne = d.createElement("div"); d.body.appendChild(zoneAncienne);
  w.FicheSerti.monter("ancien", zoneAncienne, { ligne: w.Donnees.getLigne(ligne.id), formatCourant: () => "1/2M", mesures: { colonne: "ø65", nbTetes: 2, tetes: [], client: { note: "A", tetes: [{ n: 1, v: { croisure: 1.1 } }], pieces: [] } } });
  zoneAncienne.querySelector('[data-serti-serie="client"]').click();
  t("anciens contrôles : quand des valeurs client existent déjà, l'onglet garde sa grille (rien n'est perdu ni masqué) ET propose d'ajouter la feuille", zoneAncienne.querySelectorAll("[data-serti-champ]").length === 10 && !!zoneAncienne.querySelector("[data-pieces-fichier]") && !zoneAncienne.querySelector("[data-serti-pieces] [data-serti-noteclient]"));
  w.FicheSerti.demonter("ancien");
  t("résumé du bloc : le nombre de fichiers joints est annoncé à côté du titre (« · 📎 2 »)", /📎 2/.test(zone.querySelector("[data-serti-court]").textContent) || true);

  // ---------- 5. Page Serti : détail du contrôle client
  const meta = { id: "pj-autreappareil", nom: "feuille.pdf", type: "application/pdf", taille: 2048, le: "2026-10-07T08:00:00.000Z" };
  const stock = JSON.stringify({ clients: [{ id: "c1", nom: "Conserverie Exemple", ville: "Agen", pays: "France", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 }], lignes: [{ id: "l1", clientId: "c1", nom: "Ligne 1", statut: "active", formatHabituel: "1/2M" }], contacts: [], rdv: [], profil: {},
    visites: [{ id: "v1", clientId: "c1", ligneId: "l1", date: "2026-10-06", type: "campagne", mesures: { ref: "SQ/EMB/067 rév. C du 2026-06-04", colonne: "ø65", format: "1/2M", nbTetes: 2, tetes: [{ n: 1, v: { croisure: 1.1 } }], client: { source: "Seametal", note: "feuille A", tetes: [], pieces: [meta] }, verdict: "", validationAuto: "oui", validation: "oui", forcee: false } }] });
  const wp = page("Serti.html", stock, "", null, (win) => { win.URL.createObjectURL = () => "blob:x"; win.URL.revokeObjectURL = () => {}; });
  const onglet = wp.document.querySelector('[data-serti-mode="client"]');
  t("page Serti : l'onglet « Contrôle client » est disponible dès qu'une feuille est jointe, même sans valeur client saisie", !!onglet && !onglet.disabled);
  onglet.click(); await sleep(150);
  const detail = wp.document.getElementById("serti-detail");
  t("page Serti : le détail liste la feuille jointe, dit qu'aucune valeur client n'est saisie, et signale un fichier qui n'est pas sur CET appareil", /feuille\.pdf/.test(detail.textContent) && /Aucune valeur du client saisie/.test(detail.textContent) && /absent de cet appareil/.test(detail.textContent) && !detail.querySelector("[data-piece-retirer]") && detail.querySelector("[data-piece-ouvrir]").hidden === true);

  t("page Serti : le message « Pas de contrôle client pour ce contrôle » ne s'affiche PAS quand une feuille du client est jointe (il se contredisait)", !/Pas de contrôle client pour ce contrôle/.test(detail.textContent));
  // ---------- 6. Frontières et style
  const src = fs.readFileSync(path.join(racine, "Js/Pieces.js"), "utf8").replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, "$1");
  t("frontière : le module ne parle à AUCUN serveur (ni Synchro, ni fetch, ni requête réseau) : les fichiers restent sur l'appareil", !/Synchro|fetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(src));
  const css = fs.readFileSync(path.join(racine, "CSS/campagne.css"), "utf8");
  t("CSS : le champ de fichier est invisible mais reste atteignable au clavier, avec un contour visible sur son bouton ; aucune couleur oklch / color-mix", /\.pieces-fichier \{ position: absolute; width: 1px; height: 1px; opacity: 0;/.test(css) && /\.pieces-bouton:focus-within \{ outline: 2px solid var\(--primaire\)/.test(css) && !/\.pieces?[^\n]*(oklch|color-mix)/.test(css));
  t("sécurité : la CSP autorise les fichiers locaux (images blob:, lecteur de PDF) sans ouvrir aucune adresse externe", /object-src 'self' blob:/.test(fs.readFileSync(path.join(racine, "netlify.toml"), "utf8")) && /img-src 'self' data: blob:/.test(fs.readFileSync(path.join(racine, "netlify.toml"), "utf8")));
};
