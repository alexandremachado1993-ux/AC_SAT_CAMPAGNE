import { serveur, navigateur, VIEWPORTS, PORT } from "./audit-lib.mjs";
import fs from "node:fs";
const { data, info } = JSON.parse(fs.readFileSync("./sortie/donnees.json", "utf8"));
const AUDIT = fs.readFileSync("./audit-fn.js", "utf8");
const PAGES_ALL = [
  ["accueil", "Index.html"], ["planning", "Planning.html"], ["tournee", "Tournee.html"], ["clients", "Clients.html"],
  ["fiche-lignes", "Client.html?id=" + info.clientId], ["documents", "Documents.html"], ["reglages", "Reglages.html"],
  ["doc-fr", "Documents/aide-memoire-serti-fr.html"], ["doc-es", "Documents/aide-memoire-serti-es.html"],
];
const PAGES = process.env.PASSE === "sombre" || process.env.PASSE === "paysage" ? PAGES_ALL.filter(x => ["accueil","planning","tournee","clients","fiche-lignes","reglages"].includes(x[0])) : PAGES_ALL;
const EQUIPE = { id: "eq1", nom: "AC SAT Sud", code: "K7PM2XQA", role: "proprietaire", membres: [{ id: "u1", nom: "Alexandre", role: "proprietaire", moi: true }, { id: "u2", nom: "Damien", role: "membre", moi: false }] };
const s = await serveur(); let b = await navigateur(); let compteur = 0;
const rapport = {};
const filtrer = (l) => { const vu = new Map(); l.forEach(x => { const k = x.t + "|" + x.d.replace(/"[^"]*"/, "").replace(/\d+/g, "#"); if (!vu.has(k)) vu.set(k, { ...x, n: 1 }); else vu.get(k).n++; }); return [...vu.values()]; };
const VPS = process.env.PASSE === "sombre" ? { "sombre-tel-390": VIEWPORTS["tel-390"], "sombre-pc-1280": VIEWPORTS["pc-1280"] }
  : process.env.PASSE === "paysage" ? { "paysage-tel-844": { width: 844, height: 390, mobile: true }, "paysage-tel-740": { width: 740, height: 360, mobile: true } } : VIEWPORTS;
for (const [vpNom, vp] of Object.entries(VPS)) {
  fs.mkdirSync(`./sortie/${vpNom}`, { recursive: true });
  for (const [nom, url] of PAGES) {
    if (++compteur % 8 === 0) { try { await b.close(); } catch (e) {} b = await navigateur(); }
    let ctx, p;
    try { ctx = await b.createBrowserContext(); p = await ctx.newPage(); } catch (e) { try { await b.close(); } catch (e2) {} b = await navigateur(); ctx = await b.createBrowserContext(); p = await ctx.newPage(); }
    await p.setBypassServiceWorker(true);
    await p.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: vp.mobile, hasTouch: vp.mobile });
    await p.evaluateOnNewDocument((d, eq) => { if (!localStorage.getItem("acsc_donnees_v1")) { sessionStorage.setItem("acsc_splash", "1"); localStorage.setItem("acsc_donnees_v1", d); localStorage.setItem("acsc_equipe", JSON.stringify(eq)); } }, data, EQUIPE);
    const erreurs = [];
    p.on("pageerror", e => erreurs.push("JS: " + e.message));
    p.on("console", m => { if (m.type() === "error" && !/net::ERR|Failed to load resource|supabase|geo\.api/.test(m.text())) erreurs.push("console: " + m.text().slice(0, 120)); });
    p.on("response", r => { if (r.status() >= 400 && r.url().includes("localhost")) erreurs.push("HTTP " + r.status() + " " + r.url().replace(/.*localhost:\d+/, "")); });
    if (process.env.PASSE === "sombre") await p.evaluateOnNewDocument(() => { document.addEventListener("DOMContentLoaded", () => { try { Donnees.definirTheme("dark"); } catch (e) {} }); });
    await p.goto(`http://localhost:${PORT}/${url}`, { waitUntil: "load" });
    await new Promise(r => setTimeout(r, 500));
    const prob = filtrer(await p.evaluate(AUDIT));
    await p.screenshot({ path: `./sortie/${vpNom}/${nom}.png`, fullPage: true });
    rapport[`${vpNom}/${nom}`] = { problemes: prob, erreurs };
    await ctx.close();
  }
}
fs.writeFileSync(`./sortie/rapport-${process.env.PASSE || "normal"}.json`, JSON.stringify(rapport, null, 1));
const total = {}; for (const [k, v] of Object.entries(rapport)) v.problemes.forEach(x => { total[x.t] = (total[x.t] || 0) + 1; });
console.log("TOTAL par type:", JSON.stringify(total));
for (const [k, v] of Object.entries(rapport)) if (v.erreurs.length) console.log("ERREURS", k, v.erreurs);
await b.close(); s.close();
