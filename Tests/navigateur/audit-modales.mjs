import { serveur, navigateur, VIEWPORTS, PORT } from "./audit-lib.mjs";
import fs from "node:fs";
const { data, info } = JSON.parse(fs.readFileSync("./sortie/donnees.json", "utf8"));
const AUDIT = fs.readFileSync("./audit-fn.js", "utf8");
const EQUIPE = { id: "eq1", nom: "AC SAT Sud", code: "K7PM2XQA", role: "proprietaire", membres: [{ id: "u1", nom: "Alexandre", role: "proprietaire", moi: true }, { id: "u2", nom: "Damien", role: "membre", moi: false }] };
const FEUILLE = () => { const f = document.querySelector(".feuille:not([hidden])"); if (!f) return null; const r = f.getBoundingClientRect(); const cs = getComputedStyle(f);
  const x = f.querySelector(".feuille-bouton-fermer"); const rx = x ? x.getBoundingClientRect() : null; const t = f.querySelector(".feuille-titre"); const rt = t ? t.getBoundingClientRect() : null;
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height), sh: f.scrollHeight, ch: f.clientHeight, overflowY: cs.overflowY, W: innerWidth, H: innerHeight,
    fermer: rx ? { top: Math.round(rx.top), w: Math.round(rx.width), h: Math.round(rx.height) } : null, titreTop: rt ? Math.round(rt.top) : null }; };
const SCENES = {
  "client-nouveau": (i) => Formulaires.client(null),
  "client-modifier": (i) => Formulaires.client(Donnees.getClient(i.clientId)),
  "contact": (i) => Formulaires.contact(i.clientId),
  "ligne-modifier": (i) => Formulaires.ligne(i.clientId, Donnees.getLigne(i.ligneId)),
  "visite": (i) => Formulaires.visite({ ligneId: i.ligneId }),
  "visite-homologation": (i) => { Formulaires.visite({ ligneId: i.ligneId }); const s = document.getElementById("fv-type"); s.value = "homologation"; s.dispatchEvent(new Event("change")); },
  "visite-depannage": (i) => { Formulaires.visite({ ligneId: i.ligneId }); const s = document.getElementById("fv-type"); s.value = "depannage"; s.dispatchEvent(new Event("change")); },
  "ligne-nouvelle": (i) => Formulaires.ligne(i.clientId, null),
  "visite-reunion": (i) => { Formulaires.visite({ clientId: i.clientId }); const s = document.getElementById("fv-type"); s.value = "reunion"; s.dispatchEvent(new Event("change")); },
  "rdv-essai": (i) => { Formulaires.rdv({ clientId: i.clientId }); const s = document.getElementById("fr-type"); s.value = "essai"; s.dispatchEvent(new Event("change")); },
  "rdv-realiser": (i) => { const r = Donnees.listerRdv().find(x => x.date < Donnees.aujourdhuiIso()); Formulaires.realiserRdv(r.id); },
  "apercu-client": (i) => Formulaires.apercuClient(i.clientId),
  "detail-rdv": (i) => Formulaires.detailRdv(Donnees.listerRdv().find(x => !Donnees.estPropose(x) && x.references && x.references.refEtiquette).id),
  "prevenir-clients": (i) => Formulaires.apresConfirmation([Donnees.listerRdv().find(x => !Donnees.estPropose(x) && x.clientId === i.clientId)]),
  "export": (i) => EchangesExcel.ouvrirExport(),
  "actions-rapides": (i) => document.querySelector(".fab-bouton").click(),
};
const PAGE_DE = { "export": "Clients.html", "actions-rapides": "Index.html" };
const s = await serveur(); let b = await navigateur(); let compteur = 0;
const rapport = {};
for (const [vpNom, vp] of Object.entries(VIEWPORTS)) {
  if (vpNom === "pc-1920") continue;
  fs.mkdirSync(`./sortie/modales/${vpNom}`, { recursive: true });
  for (const [nom, fn] of Object.entries(SCENES)) {
    if (++compteur % 8 === 0) { try { await b.close(); } catch (e) {} b = await navigateur(); }
    let ctx, p;
    try { ctx = await b.createBrowserContext(); p = await ctx.newPage(); } catch (e) { try { await b.close(); } catch (e2) {} b = await navigateur(); ctx = await b.createBrowserContext(); p = await ctx.newPage(); }
    await p.setBypassServiceWorker(true);
    await p.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: vp.mobile, hasTouch: vp.mobile });
    await p.evaluateOnNewDocument((d, e) => { sessionStorage.setItem("acsc_splash", "1"); localStorage.setItem("acsc_donnees_v1", d); localStorage.setItem("acsc_equipe", JSON.stringify(e)); }, data, EQUIPE);
    const erreurs = []; p.on("pageerror", e => erreurs.push(e.message));
    await p.goto(`http://localhost:${PORT}/${PAGE_DE[nom] || "Index.html"}`, { waitUntil: "load" }); await new Promise(r => setTimeout(r, 400));
    await p.evaluate(`(${fn.toString()})(${JSON.stringify(info)})`); await new Promise(r => setTimeout(r, 1200));
    const feuille = await p.evaluate(`(${FEUILLE.toString()})()`);
    const prob = (await p.evaluate(AUDIT)).filter(x => !/contenu-cache-par-la-barre/.test(x.t));
    await p.screenshot({ path: `./sortie/modales/${vpNom}/${nom}.png` });
    rapport[`${vpNom}/${nom}`] = { feuille, problemes: prob.slice(0, 40), erreurs };
    await ctx.close();
  }
}
fs.writeFileSync("./sortie/rapport-modales.json", JSON.stringify(rapport, null, 1));
for (const [k, v] of Object.entries(rapport)) {
  const f = v.feuille; const anom = [];
  if (!f) anom.push("FENÊTRE ABSENTE");
  else { if (f.top < 0) anom.push("haut coupé (" + f.top + ")"); if (f.bottom > f.H + 1) anom.push("bas coupé (" + f.bottom + " > " + f.H + ")"); if (f.left < 0 || f.right > f.W + 1) anom.push("côtés coupés");
    if (f.sh > f.ch + 1 && !/(auto|scroll)/.test(f.overflowY)) anom.push("contenu long sans défilement");
    if (f.fermer && (f.fermer.top < 0 || f.fermer.h < 32)) anom.push("bouton fermer " + JSON.stringify(f.fermer)); }
  const types = {}; v.problemes.forEach(x => { types[x.t] = (types[x.t] || 0) + 1; });
  if (anom.length || v.erreurs.length || Object.keys(types).some(t => /deborde|defile|coupe/.test(t))) console.log(k, "→", anom.join("; "), JSON.stringify(types), v.erreurs.join("|"));
}
console.log("fait,", Object.keys(rapport).length, "scènes");
await b.close(); s.close();
