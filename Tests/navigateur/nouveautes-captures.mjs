/* =============================================================
   nouveautes-captures.mjs — Photos de présentation des nouveautés

   Génère, dans Media/nouveautes/, les images affichées par la fenêtre
   « Nouveautés » (Js/Nouveautes.js). Les captures sont faites dans un vrai
   Chromium, avec des DONNÉES FICTIVES (aucun client réel) et des repères
   numérotés ①②③ posés sur les zones à regarder.

   Utilisation (depuis Tests/navigateur, après « npm install ») :
       node nouveautes-captures.mjs
   Variable facultative : SORTIE=chemin/du/dossier (défaut : Media/nouveautes).

   /Media/* est mis en cache un an : si tu régénères une image, change son
   suffixe (-v1 → -v2) ici ET dans Js/Nouveautes.js, sinon l'ancienne resterait.

   Pour une nouvelle nouveauté : ajouter une fonction de capture ci-dessous,
   l'appeler dans « toutes », puis déclarer l'image dans Js/Nouveautes.js
   (le script affiche les dimensions à recopier).
   ============================================================= */

import { serveur, navigateur, PORT, RACINE } from "./audit-lib.mjs";
import fs from "node:fs";
import path from "node:path";

const SORTIE = process.env.SORTIE || path.join(RACINE, "Media", "nouveautes");
fs.mkdirSync(SORTIE, { recursive: true });
const pause = (ms) => new Promise(r => setTimeout(r, ms));
const resultats = [];

/* ---------- Données fictives ---------- */
const GRAINE = () => {
    const R = ReferentielSerti;
    const nominal = (col, fmt) => { const v = {}; R.PARAMETRES.forEach(p => { const r = R.regle(p.id, col, fmt); if (!r) return; v[p.id] = r.type === "tol" ? r.nom : r.type === "plage" ? Math.round((r.min + r.max) / 2) : Math.round((r.min + 0.1) * 100) / 100; }); return v; };
    const a = Donnees.ajouterClient({ nom: "Conserverie Exemple", ville: "Villeneuve", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
    const b = Donnees.ajouterClient({ nom: "Conserverie Démo", ville: "Sainte-Foy", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
    const la = Donnees.enregistrerLigne(a.id, { nom: "Ligne 1", formatHabituel: "1/2M", produitHabituel: "Maïs", nbTetes: 6 });
    const lb = Donnees.enregistrerLigne(b.id, { nom: "Ligne 2", formatHabituel: "4/4", colonneSerti: "ø99", nbTetes: 4 });
    const n83 = nominal("ø83", "1/2M"), n99 = nominal("ø99", "4/4");
    const tetes = (n, base, ov) => Array.from({ length: n }, (_, i) => ({ n: i + 1, v: Object.assign({}, base, ov && ov[i + 1] ? ov[i + 1] : {}) }));
    const j = (k) => Donnees.ajouterJours(Donnees.aujourdhuiIso(), -k);
    Donnees.enregistrerVisite({ clientId: a.id, ligneId: la.id, date: j(2), type: "campagne", format: "1/2M", mesures: { colonne: "ø83", format: "1/2M", nbTetes: 6, tetes: tetes(6, n83, { 3: { flange: 2.7 }, 4: { hauteurSerti: 2.98 } }),
        client: { note: "Seametal du jour", tetes: tetes(6, Object.assign({}, n83, { hauteurSerti: 2.88, flange: 2.52, crochetFond: 1.95 }), { 3: { flange: 2.66 } }) } } });
    Donnees.enregistrerVisite({ clientId: b.id, ligneId: lb.id, date: j(12), type: "depannage", format: "4/4", mesures: { colonne: "ø99", format: "4/4", nbTetes: 4, tetes: tetes(4, n99) } });
    Donnees.enregistrerVisite({ clientId: b.id, ligneId: lb.id, date: j(26), type: "campagne", format: "4/4", mesures: { colonne: "ø99", format: "4/4", nbTetes: 4, tetes: tetes(3, n99, { 2: { hauteurSerti: n99.hauteurSerti + 0.14 } }) } });
    Donnees.enregistrerVisite({ clientId: a.id, ligneId: la.id, date: j(40), type: "campagne", format: "1/2M", mesures: { colonne: "ø83", format: "1/2M", nbTetes: 6, tetes: tetes(6, n83) } });
    return { ligneA: la.id };
};

/* ---------- Repères numérotés posés sur la page avant la capture ---------- */
const marquer = (page, reperes) => page.evaluate((liste) => {
    liste.forEach(([sel, n]) => {
        const el = document.querySelector(sel); if (!el) return;
        const r = el.getBoundingClientRect();
        const cadre = document.createElement("div");
        cadre.setAttribute("data-repere", "1");
        cadre.style.cssText = `position:fixed;left:${r.left - 4}px;top:${r.top - 4}px;width:${r.width + 8}px;height:${r.height + 8}px;border:3px solid #e11d48;border-radius:12px;z-index:99998;pointer-events:none;box-sizing:border-box;`;
        const pastille = document.createElement("div");
        pastille.textContent = String(n);
        pastille.style.cssText = `position:fixed;left:${Math.max(2, r.left - 14)}px;top:${Math.max(2, r.top - 14)}px;width:28px;height:28px;border-radius:50%;background:#e11d48;color:#fff;font:700 15px/28px system-ui,sans-serif;text-align:center;z-index:99999;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.35);`;
        document.body.appendChild(cadre); document.body.appendChild(pastille);
    });
}, reperes);

/* Version fictive « plus récente » : le lendemain de la version réelle (version.txt), donc toujours plus récente, à chaque livraison. */
const VERSION_FICTIVE = (() => {
    const v = fs.readFileSync(path.join(RACINE, "version.txt"), "utf8").trim(), [a, m, j] = v.split("-")[0].split(".").map(Number), d = new Date(Date.UTC(a, m - 1, j + 1));
    return d.getUTCFullYear() + "." + String(d.getUTCMonth() + 1).padStart(2, "0") + "." + String(d.getUTCDate()).padStart(2, "0") + "-a";
})();

/* Simule un serveur qui publie une version plus récente (exemple fictif), pour photographier la mise à jour. */
const FAUX_SERVEUR = (versionFictive) => {
    const orig = window.fetch.bind(window);
    window.fetch = (u, o) => (/version\.json/.test(String(u)) ? Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ version: versionFictive, date: versionFictive.slice(0, 10).replace(/\./g, "-"),
        nouveaute: { id: "exemple", titre: "Rapport de serti : Excel et PDF", resume: "Un rapport de tes contrôles de serti sur la période, le client et la ligne de ton choix, en Excel ou en PDF." } })) }) : orig(u, o));
};

async function ouvrir(w, h, mobile, url, dpr, maj) {
    const p = await (await B.createBrowserContext()).newPage(); await p.setBypassServiceWorker(true);
    await p.setViewport({ width: w, height: h, deviceScaleFactor: dpr || 2, isMobile: mobile, hasTouch: mobile });
    await p.evaluateOnNewDocument(() => { sessionStorage.setItem("acsc_splash", "1"); localStorage.setItem("acsc_nouveautes_vue", "*"); });
    await p.goto(`http://localhost:${PORT}/Index.html`, { waitUntil: "load" }); await pause(400);
    const ids = await p.evaluate(`(${GRAINE.toString()})()`);
    await p.evaluate(() => Donnees.definirTheme("light"));
    if (maj === "calme") await p.evaluate(() => localStorage.setItem("acsc_maj_reportee", String(Date.now() + 3600000)));   // « plus tard » déjà choisi : la fenêtre ne masque pas le menu
    if (maj) {
        await p.evaluate(() => { sessionStorage.removeItem("acsc_maj_etat"); sessionStorage.removeItem("acsc_maj_proposee"); });     // sinon le résultat du contrôle précédent (gardé 10 min) serait réutilisé
        await p.evaluateOnNewDocument(FAUX_SERVEUR, VERSION_FICTIVE);
    }
    await p.goto(`http://localhost:${PORT}/${url}`, { waitUntil: "load" }); await pause(maj ? 2600 : 600);
    return { p, ids };
}

async function enregistrer(page, nom, clip) {
    const fichier = path.join(SORTIE, nom);
    await page.screenshot(Object.assign({ path: fichier, type: "webp", quality: 80, captureBeyondViewport: false }, clip ? { clip } : {}));   /* le clip est relatif à l'écran visible */
    const info = await page.evaluate(() => 0);
    const dim = fs.readFileSync(fichier);
    /* dimensions WebP lues dans l'en-tête (VP8 / VP8X / VP8L) */
    let largeur = 0, hauteur = 0;
    if (dim.toString("ascii", 12, 16) === "VP8 ") { largeur = dim.readUInt16LE(26) & 0x3fff; hauteur = dim.readUInt16LE(28) & 0x3fff; }
    else if (dim.toString("ascii", 12, 16) === "VP8X") { largeur = 1 + dim.readUIntLE(24, 3); hauteur = 1 + dim.readUIntLE(27, 3); }
    resultats.push({ nom, ko: Math.round(dim.length / 1024), largeur, hauteur });
}

/* ---------- Captures ---------- */
async function serti_saisie() {
    const { p, ids } = await ouvrir(390, 800, true, "Index.html");
    await p.evaluate((id) => Formulaires.visite({ ligneId: id }), ids.ligneA); await pause(500);
    await p.evaluate(() => { document.querySelector("#fv-serti details").open = true; });
    for (const [id, v] of [["flange", "2,70"], ["hauteurSerti", "2,98"], ["croisure", "1,05"], ["crochetFond", "1,9"]]) await p.type(`[data-serti-champ="${id}"]`, v);
    await p.evaluate(() => { const f = document.querySelector(".feuille"), r = document.querySelector('[data-serti-param="flange"]'); f.scrollTop = r.getBoundingClientRect().top - f.getBoundingClientRect().top + f.scrollTop - 150; });
    await pause(300);
    await marquer(p, [[".serti-tetes", 1], ['[data-serti-param="flange"] [data-serti-pastille]', 2]]);
    const r = await p.evaluate(() => { const f = document.querySelector(".feuille").getBoundingClientRect(); return { x: f.x, y: f.y, width: f.width, height: Math.min(f.height, 640) }; });
    await enregistrer(p, "serti-saisie-v1.webp", r); await p.close();
}
async function serti_page() {
    const { p } = await ouvrir(390, 800, true, "Serti.html");
    await p.evaluate(() => window.scrollTo(0, 190)); await pause(250);
    await marquer(p, [[".puces-filtre", 1], [".serti-ligne", 2]]);
    await enregistrer(p, "serti-page-v1.webp", { x: 0, y: 0, width: 390, height: 700 }); await p.close();
}
async function serti_comparaison() {
    const { p } = await ouvrir(390, 800, true, "Serti.html");
    await p.evaluate(() => { document.querySelector(".serti-ligne").click(); });
    await pause(300); await p.evaluate(() => document.querySelector("[data-serti-mode=cmp]").click()); await pause(300);
    await p.evaluate(() => document.getElementById("serti-detail").scrollIntoView({ block: "start" })); await pause(300);
    await p.evaluate(() => { const d = document.querySelector(".serti-matrice-defile"); if (d) d.scrollLeft = 110; }); await pause(200);   /* les colonnes Fla et H.s, où se voient les écarts */
    await marquer(p, [["[data-serti-mode=cmp]", 1], [".serti-case--alerte", 2]]);
    await enregistrer(p, "serti-comparaison-v1.webp", null); await p.close();
}
async function rapport_choix() {
    const { p } = await ouvrir(390, 800, true, "Serti.html");
    await p.evaluate(() => document.querySelector("[data-serti-rapport]").click()); await pause(400);
    await p.evaluate(() => document.querySelector('[data-sr-periode="tout"]').click()); await pause(200);
    await p.evaluate(() => { const f = document.querySelector(".feuille"); f.scrollTop = 0; });
    await marquer(p, [["#sr-client", 1], ["#sr-ligne", 2], ['[data-sr="xlsx"]', 3]]);
    const r = await p.evaluate(() => { const f = document.querySelector(".feuille").getBoundingClientRect(); return { x: f.x, y: f.y, width: f.width, height: f.height }; });
    await enregistrer(p, "rapport-choix-v1.webp", r); await p.close();
}
async function rapport_apercu() {
    const { p } = await ouvrir(960, 760, false, "Serti.html", 1);
    await p.evaluate(() => document.querySelector("[data-serti-rapport]").click()); await pause(300);
    await p.evaluate(() => document.querySelector('[data-sr-periode="tout"]').click()); await pause(150);
    await p.evaluate(() => document.querySelector('[data-sr="apercu"]').click()); await pause(400);
    await marquer(p, [[".rapport-synthese", 1], ["[data-rapport-imprimer]", 2]]);
    await enregistrer(p, "rapport-apercu-v1.webp", { x: 0, y: 0, width: 960, height: 560 }); await p.close();
}

async function maj_suggestion() {
    const { p } = await ouvrir(390, 800, true, "Index.html", 2, true);
    await marquer(p, [[".maj-nouv", 1], ["[data-maj-maintenant]", 2]]);
    const r = await p.evaluate(() => { const f = document.querySelector(".feuille").getBoundingClientRect(); return { x: f.x, y: f.y, width: f.width, height: f.height }; });
    await enregistrer(p, "maj-suggestion-v1.webp", r); await p.close();
}
async function maj_menu() {
    const { p } = await ouvrir(390, 800, true, "Index.html", 2, "calme");
    await p.evaluate(() => document.querySelector(".menu-avatar > button.entete-avatar").click()); await pause(300);
    await marquer(p, [[".menu-avatar > button .entete-avatar-pastille", 1], ["[data-maj]", 2]]);
    await enregistrer(p, "maj-menu-v1.webp", { x: 0, y: 0, width: 390, height: 430 }); await p.close();
}
async function maj_informations() {
    const { p } = await ouvrir(390, 800, true, "Reglages.html#informations", 2, true);
    await p.evaluate(() => window.scrollTo(0, 120)); await pause(250);
    await marquer(p, [["#info-etat", 1], ["[data-recharger]", 2]]);
    await enregistrer(p, "maj-informations-v1.webp", { x: 0, y: 0, width: 390, height: 700 }); await p.close();
}

/* ---------- Planning : tableau de bord ---------- */
const GRAINE_PLANNING = () => {
    const j = (n) => Donnees.ajouterJours(Donnees.aujourdhuiIso(), n);
    [["Conserverie Exemple", "Villeneuve"], ["Conserverie Démo", "Sainte-Foy"], ["Légumes du Sud", "Marmande"], ["Ets Martin", "Agen"], ["Fruits d'Aquitaine", "Pau"]].forEach(([n, v], i) => {
        const c = Donnees.ajouterClient({ nom: n, ville: v, debutCampagne: 5, finCampagne: 11, cadenceJours: 14, technicien: i === 4 ? "u2" : "" });
        const l1 = Donnees.enregistrerLigne(c.id, { nom: "Ligne 1", formatHabituel: "1/2M" }), l2 = Donnees.enregistrerLigne(c.id, { nom: "Ligne 2", formatHabituel: "4/4" });
        [-60, -45, -38, -30, -24, -17, -(1 + i)].forEach((o, k) => { if ((k + i) % 2 === 0 || o > -20) Donnees.enregistrerVisite({ clientId: c.id, ligneId: k % 2 ? l2.id : l1.id, date: j(o), type: k % 3 === 2 ? "maintenance" : "campagne" }); });
        if (i < 3) Donnees.enregistrerRdv({ clientId: c.id, date: j(3 + i * 4), type: "campagne", ligneIds: [l1.id] });
    });
};
async function ouvrirPlanning(w, h, mob, equipe, dpr) {
    const p = await (await B.createBrowserContext()).newPage(); await p.setBypassServiceWorker(true);
    await p.setViewport({ width: w, height: h, deviceScaleFactor: dpr, isMobile: mob, hasTouch: mob });
    await p.evaluateOnNewDocument(() => { sessionStorage.setItem("acsc_splash", "1"); localStorage.setItem("acsc_nouveautes_vue", "*"); });
    await p.goto(`http://localhost:${PORT}/Index.html`, { waitUntil: "load" }); await pause(400);
    await p.evaluate(`(${GRAINE_PLANNING.toString()})(); Donnees.definirTheme("light");`);
    await p.goto(`http://localhost:${PORT}/Planning.html`, { waitUntil: "load" }); await pause(800);
    if (equipe) { await p.evaluate(() => { Synchro.membresEquipe = () => [{ id: "u1", nom: "Alexandre", moi: true }, { id: "u2", nom: "Damien" }]; Donnees.definirTechnicienCourant("u1"); Donnees.ajouterClient({ nom: "Zeta", ville: "Dax", debutCampagne: 5, finCampagne: 11, cadenceJours: 14, technicien: "u2" }); }); await pause(500); }
    return p;
}
const zone = (p, sel, k) => p.evaluate((sel, k) => { const r = document.querySelector(sel).getBoundingClientRect(); const x = Math.max(0, r.left - 10), y = Math.max(0, r.top - 10); return { x, y, width: Math.min(innerWidth - x, (r.width + 20) * (k || 1)), height: Math.min(innerHeight - y, r.height + 20) }; }, sel, k);
const sansFiltres = (p) => p.evaluate(() => { const b = document.querySelector("[data-filtres]"); if (b && b.getAttribute("aria-expanded") === "true") b.click(); });
async function planning_tableau() {
    const p = await ouvrirPlanning(1280, 1000, false, false, 1); await sansFiltres(p); await pause(300);
    await marquer(p, [["[data-pt-gran]", 1], [".pt-droite .pt-cartes", 2], [".pt-mois", 3]]);
    await enregistrer(p, "planning-tableau-v1.webp", await zone(p, ".pt-page")); await p.close();
}
async function planning_techniciens() {
    const p = await ouvrirPlanning(1280, 1000, false, true, 1); await sansFiltres(p); await pause(300);
    await marquer(p, [[".pt-tech", 1], ['[data-pt-tech="u2"]', 2]]);
    await enregistrer(p, "planning-techniciens-v1.webp", await zone(p, ".pt-page", 0.62)); await p.close();
}
async function planning_telephone() {
    const p = await ouvrirPlanning(390, 844, true, false, 2);
    await p.evaluate(() => document.querySelector(".pt-calendrier").scrollIntoView({ block: "start" })); await pause(300);
    await marquer(p, [["[data-pt-gran]", 1], [".pt-cell--aujourdhui", 2]]);
    await enregistrer(p, "planning-telephone-v1.webp", null); await p.close();
}

const S = await serveur(); const B = await navigateur();
const toutes = [serti_saisie, serti_page, serti_comparaison, rapport_choix, rapport_apercu, maj_suggestion, maj_menu, maj_informations, planning_tableau, planning_techniciens, planning_telephone];
for (const f of toutes) { try { await f(); } catch (e) { console.error("ÉCHEC " + f.name + " : " + e.message); process.exitCode = 1; } }
console.log("Images écrites dans " + SORTIE);
resultats.forEach(r => console.log(`  ${r.nom}  ${r.largeur}×${r.hauteur}  ${r.ko} Ko`));
await B.close(); S.close();
