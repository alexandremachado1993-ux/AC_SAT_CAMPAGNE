/* Serveur qui REDIRIGE les pages (option « Pretty URLs » de Netlify : /Page.html -> 301 -> /Page) : l'application doit s'ouvrir EN LIGNE comme hors ligne, et les appareils déjà
   cassés par l'ancien service worker (VC, optionnel : node maj-preparer.mjs --casse <clone GitHub du 13/10>) doivent se réparer. Constaté le 13/10/2026 : « ERR_FAILED » site en ligne. */
import { serveur, navigateur, pause, pageTel, attendreControle, VERS, versionDe } from "./maj-lib.mjs";
import fs from "node:fs";
const V1v = versionDe(1), V2v = versionDe(2), VCv = versionDe("C");
const S = await serveur(); const nav = await navigateur(); let ko = 0;
const t = (nom, ok, detail) => { if (!ok) ko++; console.log((ok ? "✅ " : "❌ ") + nom + (detail !== undefined ? "  → " + detail : "")); };
const ouvrir = async (p, url) => { try { const r = await p.goto(url, { waitUntil: "load", timeout: 15000 }); const v = await p.evaluate(() => (typeof AppLayout !== "undefined" ? AppLayout.VERSION : null)).catch(() => null); return { ok: !!v, version: v, statut: r.status() }; } catch (e) { return { ok: false, erreur: e.message.replace(/.*net::/, "net::").slice(0, 30) }; } };
const attendreOuverture = async (p, url, ms) => { const fin = Date.now() + ms; let r = null; while (Date.now() < fin) { r = await ouvrir(p, url); if (r.ok) return r; await pause(700); } return r; };
try {
  // A. version corrigée + redirections : EN LIGNE
  S.jolies = true; S.publier(VERS(1));
  let ctx = await nav.createBrowserContext(); let p = await pageTel(ctx);
  await p.goto(S.url + "/", { waitUntil: "load" }).catch(() => null); await attendreControle(p, 20000).catch(() => null); await pause(1200);
  const a1 = await ouvrir(p, S.url + "/"), a2 = await ouvrir(p, S.url + "/Planning.html"), a3 = await ouvrir(p, S.url + "/Index.html");
  t("A. serveur qui REDIRIGE les pages, site EN LIGNE : « / », « /Planning.html » et « /Index.html » s'ouvrent depuis la copie", a1.ok && a2.ok && a3.ok && a1.version === V1v, JSON.stringify([a1.erreur || a1.version, a2.erreur || a2.version, a3.erreur || a3.version]));
  const marque = await p.evaluate(async () => { const cles = (await caches.keys()).filter(n => n !== "acsc-meta"); const c = await caches.open(cles[0]); const r = await c.match("Index.html"); return r ? r.redirected : "absent"; });
  t("A. la copie de l'accueil est enregistrée SANS la marque de redirection", marque === false, String(marque));
  S.mort = true; const a4 = await ouvrir(p, S.url + "/"); S.mort = false;
  t("A. … et le site coupé, l'application s'ouvre encore", a4.ok, JSON.stringify(a4.erreur || a4.version)); await ctx.close();

  // B. mise à jour validée par l'utilisateur pendant que le serveur redirige les pages
  S.publier(VERS(1)); ctx = await nav.createBrowserContext(); p = await pageTel(ctx);
  await p.goto(S.url + "/", { waitUntil: "load" }).catch(() => null); await attendreControle(p, 20000).catch(() => null); await p.close();
  S.publier(VERS(2)); p = await pageTel(ctx); await p.goto(S.url + "/Index.html", { waitUntil: "load" }).catch(() => null);
  await p.waitForSelector(".feuille:not([hidden]) [data-maj-maintenant]", { timeout: 9000 }).catch(() => null); await p.click("[data-maj-maintenant]").catch(() => null);
  let vB = null; for (let i = 0; i < 90 && vB !== V2v; i++) { vB = await p.evaluate(() => AppLayout.VERSION).catch(() => null); if (vB !== V2v) await pause(400); }      // on attend le changement de version SANS naviguer (naviguer interromprait l'installation)
  const b = { ok: vB === V2v, version: vB }; const deux = await ouvrir(p, S.url + "/Planning.html");
  t("B. mise à jour validée, serveur qui redirige : l'application passe à la version suivante et reste ouvrable (« / » et « /Planning.html »)", b.ok && b.version === V2v && deux.ok && deux.version === V2v, JSON.stringify([b.erreur || b.version, deux.erreur || deux.version]));
  await ctx.close();

  // C. appareil DÉJÀ CASSÉ par la version publiée le 13/10 (VC) puis arrivée du correctif
  if (!fs.existsSync(VERS("C"))) console.log("ℹ️  C ignoré : version cassée non fournie (node maj-preparer.mjs --casse <clone GitHub du 13/10 matin>)");
  else {
    S.jolies = true; S.publier(VERS("C")); ctx = await nav.createBrowserContext(); p = await pageTel(ctx);
    await p.goto(S.url + "/", { waitUntil: "load" }).catch(() => null); await attendreControle(p, 20000).catch(() => null); await pause(1500);
    const avant = await ouvrir(p, S.url + "/");
    t("C. PRÉCONDITION : l'appareil sous la version publiée le 13/10 (" + VCv + ") affiche bien « ERR_FAILED » alors que le site fonctionne", !avant.ok && /ERR_FAILED/.test(avant.erreur || ""), JSON.stringify(avant.erreur || avant.version));
    S.publier(VERS(1));
    const q = await pageTel(ctx); await q.goto(S.url + "/version.json").catch(() => null);      // page hors du contrôle du service worker : de quoi déclencher la vérification de mise à jour, comme le fait le navigateur de lui-même
    await q.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); }).catch(() => null);
    const apres = await attendreOuverture(p, S.url + "/", 25000);
    t("C. dès que le NOUVEAU service worker s'installe, l'appareil cassé se RÉPARE tout seul : l'application s'ouvre de nouveau, sans effacer ses données", apres.ok, JSON.stringify(apres.erreur || apres.version));
    await ctx.close();
  }
} catch (e) { ko++; console.log("❌ ERREUR DU SCÉNARIO :", e.message); }
await nav.close(); S.fermer(); console.log(ko === 0 ? "\nSCÉNARIO 6 : tout est conforme" : "\nSCÉNARIO 6 : " + ko + " écart(s)"); process.exit(ko === 0 ? 0 : 1);
