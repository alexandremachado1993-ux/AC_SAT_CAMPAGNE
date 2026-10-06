import { serveur, navigateur, PORT } from "./audit-lib.mjs";
import fs from "node:fs";
const { data, info } = JSON.parse(fs.readFileSync("./sortie/donnees.json", "utf8"));
const AUDIT = fs.readFileSync("./audit-fn.js", "utf8");
const EQUIPE = { id: "eq1", nom: "AC SAT Sud", code: "K7PM2XQA", role: "proprietaire", membres: [{ id: "u1", nom: "Alexandre", role: "proprietaire", moi: true }, { id: "u2", nom: "Damien", role: "membre", moi: false }] };
const PAGES = [["accueil", "Index.html"], ["planning", "Planning.html"], ["tournee", "Tournee.html"], ["clients", "Clients.html"], ["fiche", "Client.html?id=" + info.clientId], ["reglages", "Reglages.html"]];
const APP = { "galaxy-a-360": [360, 780], "iphone-se1-320": [320, 568] };
const FACTEURS = (process.env.FACTEURS || "130,150,200").split(",");
const s = await serveur(); let b = await navigateur(); let c = 0; const rapport = {};
for (const [nom, [w, h]] of Object.entries(APP)) for (const f of FACTEURS) for (const [pg, url] of PAGES) {
  if (++c % 7 === 0) { try { await b.close(); } catch (e) {} b = await navigateur(); }
  let p; try { p = await (await b.createBrowserContext()).newPage(); } catch (e) { try { await b.close(); } catch (x) {} b = await navigateur(); p = await (await b.createBrowserContext()).newPage(); }
  await p.setBypassServiceWorker(true); await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await p.evaluateOnNewDocument((d, e, f) => { sessionStorage.setItem("acsc_splash", "1"); localStorage.setItem("acsc_donnees_v1", d); localStorage.setItem("acsc_equipe", JSON.stringify(e)); document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = `html { font-size: ${f}% !important; }`; document.head.appendChild(st); }); }, data, EQUIPE, f);
  try { await p.goto(`http://localhost:${PORT}/${url}`, { waitUntil: "load" }); await new Promise(r => setTimeout(r, 500));
    const pb = (await p.evaluate(AUDIT)).filter(x => /page-defile|deborde|texte-coupe/.test(x.t));
    rapport[`${nom}/${f}%/${pg}`] = pb;
    if (f === "200" && ["accueil", "fiche"].includes(pg)) await p.screenshot({ path: `./sortie/appareils/police-${nom}-${f}-${pg}.png` });
  } catch (e) { rapport[`${nom}/${f}%/${pg}`] = [{ t: "echec", d: e.message.slice(0, 60) }]; }
  try { await p.close(); } catch (e) {}
}
fs.writeFileSync(`./sortie/police-${process.env.FACTEURS || "tous"}.json`, JSON.stringify(rapport, null, 1)); console.log("terminé", Object.keys(rapport).length);
await b.close(); s.close();
