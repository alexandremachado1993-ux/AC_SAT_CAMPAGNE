import { serveur, navigateur, PORT } from "./audit-lib.mjs";
import fs from "node:fs";
const { data, info } = JSON.parse(fs.readFileSync("./sortie/donnees.json", "utf8"));
const AUDIT = fs.readFileSync("./audit-fn.js", "utf8");
const EQUIPE = { id: "eq1", nom: "AC SAT Sud", code: "K7PM2XQA", role: "proprietaire", membres: [{ id: "u1", nom: "Alexandre", role: "proprietaire", moi: true }, { id: "u2", nom: "Damien", role: "membre", moi: false }] };
const APPAREILS = {
  "iphone-se1-320": [320, 568], "iphone-se3-375": [375, 667], "iphone-12mini-375": [375, 812], "iphone-14-390": [390, 844], "iphone-15promax-430": [430, 932],
  "galaxy-a-360": [360, 780], "pixel-393": [393, 851], "galaxy-s-412": [412, 915], "fold-cover-344": [344, 882], "fold-ouvert-673": [673, 841],
  "ipad-mini-744": [744, 1133], "galaxy-tab-800": [800, 1280],
  "se-paysage-667": [667, 375], "iphone-paysage-844": [844, 390], "pixel-paysage-915": [915, 412], "promax-paysage-932": [932, 430], "fold-paysage-841": [841, 673],
};
const PAGES = [["accueil", "Index.html"], ["planning", "Planning.html"], ["tournee", "Tournee.html"], ["clients", "Clients.html"], ["fiche", "Client.html?id=" + info.clientId], ["reglages", "Reglages.html"]];
const SCENES = { "client-nouveau": () => Formulaires.client(null), "visite": (i) => Formulaires.visite({ ligneId: i.ligneId }), "apercu-client": (i) => Formulaires.apercuClient(i.clientId) };
const ZOOM = () => [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), select, textarea")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && parseFloat(getComputedStyle(e).fontSize) < 16; }).map(e => e.tagName + "#" + (e.id || e.name) + " " + getComputedStyle(e).fontSize);
const FEUILLE = () => { const f = document.querySelector(".feuille:not([hidden])"); if (!f) return null; const r = f.getBoundingClientRect(); const x = f.querySelector(".feuille-bouton-fermer"); const rx = x && x.getBoundingClientRect();
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), H: innerHeight, W: innerWidth, fermerVisible: !!rx && rx.top >= 0 && rx.bottom <= innerHeight && rx.width >= 32 }; };
const groupe = process.env.GROUPE || "1"; const cles = Object.keys(APPAREILS); const n = Math.ceil(cles.length / 3);
const choisis = process.env.APPAREILS ? process.env.APPAREILS.split(",") : cles.slice((Number(groupe) - 1) * n, Number(groupe) * n);
const s = await serveur(); let b = await navigateur(); let compteur = 0; const rapport = {};
const nouveau = async () => { try { await b.close(); } catch (e) {} b = await navigateur(); };
for (const nom of choisis) { const [w, h] = APPAREILS[nom];
  const jobs = [...PAGES.map(([n, u]) => ["page", n, u]), ...(w < 500 || h < 500 ? Object.keys(SCENES).map(k => ["scene", k]) : [])];
  for (const [genre, id, url] of jobs) {
    if (++compteur % 7 === 0) await nouveau();
    let p; try { p = await (await b.createBrowserContext()).newPage(); } catch (e) { await nouveau(); p = await (await b.createBrowserContext()).newPage(); }
    await p.setBypassServiceWorker(true); await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await p.evaluateOnNewDocument((d, e) => { sessionStorage.setItem("acsc_splash", "1"); localStorage.setItem("acsc_donnees_v1", d); localStorage.setItem("acsc_equipe", JSON.stringify(e)); }, data, EQUIPE);
    const erreurs = []; p.on("pageerror", e => erreurs.push(e.message));
    try {
      await p.goto(`http://localhost:${PORT}/${genre === "page" ? url : "Index.html"}`, { waitUntil: "load" }); await new Promise(r => setTimeout(r, 450));
      if (genre === "scene") { await p.evaluate(`(${SCENES[id].toString()})(${JSON.stringify(info)})`); await new Promise(r => setTimeout(r, 900)); }
      const prob = (await p.evaluate(AUDIT)).filter(x => !/contenu-cache-par-la-barre|texte-minuscule/.test(x.t) && !(x.t === "cible-tactile-petite" && false));
      const zoom = await p.evaluate(ZOOM); if (zoom.length) prob.push({ t: "zoom-ios-champ<16px", d: zoom.slice(0, 3).join(", ") });
      const f = genre === "scene" ? await p.evaluate(FEUILLE) : null;
      if (genre === "scene" && f && (f.top < 0 || f.bottom > f.H + 1 || f.right > f.W + 1 || !f.fermerVisible)) prob.push({ t: "fenetre-mal-placee", d: JSON.stringify(f) });
      if (erreurs.length) prob.push({ t: "erreur-js", d: erreurs[0] });
      rapport[`${nom}/${id}`] = prob;
      if (["iphone-se1-320", "fold-cover-344", "se-paysage-667"].includes(nom)) { fs.mkdirSync("./sortie/appareils", { recursive: true }); await p.screenshot({ path: `./sortie/appareils/${nom}-${id}.png`, fullPage: genre === "page" }); }
    } catch (e) { rapport[`${nom}/${id}`] = [{ t: "echec", d: e.message.slice(0, 80) }]; }
    try { await p.close(); } catch (e) {}
  }
}
fs.writeFileSync(`./sortie/appareils-${process.env.APPAREILS ? "cible" : groupe}.json`, JSON.stringify(rapport, null, 1));
console.log("GROUPE", groupe, "terminé,", Object.keys(rapport).length, "vues");
await b.close(); s.close();
