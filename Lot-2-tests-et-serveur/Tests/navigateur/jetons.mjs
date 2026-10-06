import { serveur, navigateur, PORT } from "./audit-lib.mjs";
import fs from "node:fs";
const s = await serveur(); const b = await navigateur(); const res = {};
for (const theme of ["light", "dark"]) {
  const p = await b.newPage(); await p.setBypassServiceWorker(true); await p.setViewport({ width: 390, height: 844 });
  await p.evaluateOnNewDocument((t) => { if (t === "dark") document.addEventListener("DOMContentLoaded", () => { try { Donnees.definirTheme("dark"); } catch (e) {} }); }, theme);
  await p.goto(`http://localhost:${PORT}/Index.html`, { waitUntil: "load" }); await new Promise(r => setTimeout(r, 500));
  res[theme] = await p.evaluate(() => {
    const noms = new Set(); for (const f of ["CSS/style.css", "CSS/campagne.css"]) { }
    const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true });
    const lire = (c, fond) => { cx.fillStyle = fond; cx.fillRect(0,0,1,1); cx.fillStyle = c; cx.fillRect(0,0,1,1); return cx.getImageData(0,0,1,1).data; };
    const rgba = (c) => { const a = lire(c, "#000"), w = lire(c, "#fff"); const al = Math.min(1, Math.max(0, 1 - (w[0] - a[0]) / 255)); if (al < 0.004) return [0,0,0,0]; return [Math.round(a[0]/al), Math.round(a[1]/al), Math.round(a[2]/al), +al.toFixed(3)]; };
    const estCouleur = (v) => { cx.fillStyle = "#123456"; cx.fillStyle = v; return cx.fillStyle !== "#123456"; };
    const cs = getComputedStyle(document.documentElement); const out = {};
    for (const sheet of document.styleSheets) { let regles; try { regles = sheet.cssRules; } catch (e) { continue; } const parcourir = (rs) => { for (const r of rs) { if (r.cssRules && !r.selectorText) parcourir(r.cssRules); else if (r.style) for (const n of r.style) if (n.startsWith("--")) noms.add(n); } }; parcourir(regles); }
    for (const n of noms) { const v = cs.getPropertyValue(n).trim(); if (!v) continue; out[n] = (/oklch|color-mix|rgb|#|hsl|^[a-z]+$/.test(v) && estCouleur(v)) ? { couleur: rgba(v), brut: v } : { brut: v }; }
    return out; });
  await p.close();
}
fs.writeFileSync("./sortie/tokens.json", JSON.stringify(res, null, 1));
console.log("jetons clair:", Object.keys(res.light).length, "sombre:", Object.keys(res.dark).length, "couleurs:", Object.values(res.light).filter(x => x.couleur).length);
await b.close(); s.close();
