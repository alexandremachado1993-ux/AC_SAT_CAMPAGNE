/* Site injoignable (panne, pause Netlify, réseau coupé) : l'application doit TOUJOURS s'ouvrir depuis sa copie, ou à défaut afficher un message clair, jamais « ERR_FAILED ».
   Coupure RÉELLE (S.mort) : page.setOfflineMode ne coupe PAS le réseau du service worker et faussait ce test. Prérequis : npm install, puis node maj-preparer.mjs --ancien <clone GitHub>. */
import { serveur, navigateur, pause, pageTel, attendreControle, VERS, versionDe, v0EstAncien } from "./maj-lib.mjs";
const V0v = versionDe(0), V1v = versionDe(1), V2v = versionDe(2);
const S = await serveur(); const nav = await navigateur(); let ko = 0;
const t = (nom, ok, detail) => { if (!ok) ko++; console.log((ok ? "✅ " : "❌ ") + nom + (detail !== undefined ? "  → " + detail : "")); };
const ouvrir = async (p, url) => { try { const r = await p.goto(url, { waitUntil: "load", timeout: 15000 }); const v = await p.evaluate(() => (typeof AppLayout !== "undefined" ? AppLayout.VERSION : null)).catch(() => null); const texte = await p.evaluate(() => document.body.innerText.slice(0, 200)).catch(() => ""); return { ok: true, statut: r.status(), version: v, texte }; } catch (e) { return { ok: false, erreur: e.message.replace(/.*net::/, "net::").slice(0, 40) }; } };
try {
  // A. ANCIEN service worker (12-a) puis site mort
  let ctx = await nav.createBrowserContext(); S.publier(VERS(0));
  let p = await pageTel(ctx); await p.goto(S.url + "/", { waitUntil: "load" });
  for (let i = 0; i < 80 && !(await p.evaluate(async () => !!navigator.serviceWorker.controller && (await caches.keys()).includes("acsc-v6")).catch(() => false)); i++) await pause(300);
  await p.goto(S.url + "/Index.html", { waitUntil: "load" }); await pause(800); S.mort = true;
  const a1 = await ouvrir(p, S.url + "/"), a2 = await ouvrir(p, S.url + "/Planning.html");
  t("A. ANCIEN service worker + site mort : l'accueil (« / ») et une autre page s'ouvrent depuis la copie", a1.ok && a1.version === V0v && a2.ok && a2.version === V0v, JSON.stringify([a1.version, a2.version]));
  S.mort = false; await ctx.close();
  // B. NOUVEAU service worker + site mort ; C. site en erreur 503
  ctx = await nav.createBrowserContext(); S.publier(VERS(1));
  p = await pageTel(ctx); await p.goto(S.url + "/", { waitUntil: "load" }); await attendreControle(p); S.mort = true;
  const b = await ouvrir(p, S.url + "/");
  t("B. NOUVEAU service worker + site mort : l'application s'ouvre depuis sa copie", b.ok && b.version === V1v, JSON.stringify(b.version));
  S.mort = false; S.pannes = new Set(["/", "/Index.html", "/Planning.html", "/version.json", "/sw.js", "/Js/AppLayout.js"]);
  const c = await ouvrir(p, S.url + "/");
  t("C. site « en pause » (erreur 503 partout) : l'application s'ouvre depuis sa copie", c.ok && c.version === V1v, JSON.stringify(c.version));
  S.pannes = new Set();
  // D. copie VIDE + site mort : le cas du 13/10/2026 (« ERR_FAILED »)
  await p.evaluate(async () => { const nom = await (await (await caches.open("acsc-meta")).match("actif")).text(); const cp = await caches.open(nom); for (const k of await cp.keys()) await cp.delete(k); });
  S.mort = true; const d = await ouvrir(p, S.url + "/");
  t("D. copie VIDE + site mort : une PAGE DE SECOURS claire (« Impossible de joindre le serveur »), plus aucune erreur « ERR_FAILED »", d.ok && d.statut === 503 && /Impossible de joindre le serveur/.test(d.texte), JSON.stringify(d.ok ? [d.statut, d.texte.slice(0, 45)] : d.erreur));
  S.mort = false; await ctx.close();
  if (!v0EstAncien()) console.log("ℹ️  E ignoré : la version « ancienne » fournie n'a pas l'ancien service worker (utiliser un clone de GitHub d'AVANT 2026.10.12-b)");
  else {
  // E. passage depuis l'ancien service worker alors qu'un fichier est en panne : l'ancienne copie doit rester en service
  ctx = await nav.createBrowserContext(); S.publier(VERS(0));
  p = await pageTel(ctx); await p.goto(S.url + "/", { waitUntil: "load" });
  for (let i = 0; i < 80 && !(await p.evaluate(async () => !!navigator.serviceWorker.controller && (await caches.keys()).includes("acsc-v6")).catch(() => false)); i++) await pause(300);
  S.publier(VERS(1)); S.pannes = new Set(["/Js/Donnees.js"]);
  await p.goto(S.url + "/Index.html", { waitUntil: "load" }); await pause(4000);
  const cles = await p.evaluate(async () => (await caches.keys()).sort()).catch(() => []);
  t("E. passage avec UN fichier en panne : la nouvelle installation échoue, l'ancienne copie « acsc-v6 » reste EN SERVICE (rien n'est supprimé, aucune copie à moitié faite)", cles.indexOf("acsc-v6") !== -1 && !cles.some(n => n === "acsc-" + V1v), JSON.stringify(cles));
  S.pannes = new Set(); S.mort = true; const e = await ouvrir(p, S.url + "/");
  t("E. … et si le site tombe ensuite, l'application s'ouvre encore depuis l'ancienne copie", e.ok && !!e.version, JSON.stringify(e.ok ? e.version : e.erreur));
  S.mort = false; await ctx.close();
  }
} catch (e) { ko++; console.log("❌ ERREUR DU SCÉNARIO :", e.message); }
await nav.close(); S.fermer(); console.log(ko === 0 ? "\nSCÉNARIO 5 : tout est conforme" : "\nSCÉNARIO 5 : " + ko + " écart(s)"); process.exit(ko === 0 ? 0 : 1);
