/* Banc d'essai des MISES À JOUR dans un vrai Chromium : faux serveur « Netlify » + pilotage du navigateur. Voir LISEZ-MOI.md, section « Mises à jour ». */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
import chromium from "@sparticuz/chromium"; import puppeteer from "puppeteer-core";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".mp4": "video/mp4", ".xlsx": "application/octet-stream", ".pdf": "application/pdf", ".ico": "image/x-icon" };
const ICI = path.dirname(fileURLToPath(import.meta.url));
export const PROJET = path.resolve(ICI, "..", "..");
/* Dossier de travail (versions simulées du site) et dossier des captures. */
export const TRAVAIL = process.env.ACSC_MAJ_DIR || path.join(os.tmpdir(), "acsc-maj");
export const SORTIE = path.join(ICI, "sortie");
export const VERS = (n) => path.join(TRAVAIL, "V" + n);
/* Numéro de version d'une version simulée (V0 ancienne, V1 installée, V2 suivante) : les scénarios ne contiennent aucun numéro écrit en dur. */
/* V0 a-t-elle l'ANCIEN service worker (liste de fichiers dans sw.js, copie « acsc-v6 ») ? Les scénarios du passage ne s'appliquent qu'à une V0 de ce type (clone d'avant 2026.10.12-b). */
export const v0EstAncien = () => { try { return /const PRECACHE/.test(fs.readFileSync(path.join(VERS(0), "sw.js"), "utf8")); } catch (e) { return false; } };
export const versionDe = (n) => { try { return fs.readFileSync(path.join(VERS(n), "version.txt"), "utf8").trim(); } catch (e) { return "(version " + n + " non préparée)"; } };
export const cheminCapture = (nom) => { fs.mkdirSync(SORTIE, { recursive: true }); return path.join(SORTIE, nom); };
/* En-têtes de sécurité du bloc « for = "/*" » de netlify.toml : le faux serveur rejoue exactement ceux de la production (CSP comprise). */
function lireEntetes() {
  const lignes = fs.readFileSync(path.join(PROJET, "netlify.toml"), "utf8").split("\n"); const sortie = {};
  const debut = lignes.findIndex(l => l.trim() === 'for = "/*"'); if (debut < 0) throw new Error('netlify.toml : bloc for = "/*" introuvable');
  for (let i = debut + 1; i < lignes.length; i++) {
    const l = lignes[i].trim(); if (l.startsWith("[[")) break;
    const m = /^([A-Za-z-]+)\s*=\s*"(.*)"\s*$/.exec(l); if (m) sortie[m[1]] = m[2];
  }
  return sortie;
}
const ENTETES = lireEntetes();
/* Faux « Netlify » : sert un dossier, rejoue les en-têtes de sécurité du netlify.toml, redirige « / » vers Index.html, et peut changer de dossier (= publier une version). */
export function serveur() {
  const etat = { racine: null, journal: [], pannes: new Set(), delai: 0, mort: false };      // mort : le site coupe TOUTES les connexions (page ET service worker), contrairement à page.setOfflineMode qui ne coupe que la page
  const srv = http.createServer((req, rep) => {
    const url = new URL(req.url, "http://x"); let chemin = decodeURIComponent(url.pathname);
    if (etat.mort) { req.socket.destroy(); return; }
    etat.journal.push({ chemin, cache: req.headers["cache-control"] || "" });
    const repondre = () => {
      if (etat.pannes.has(chemin)) { rep.writeHead(500, ENTETES); return rep.end("panne simulée"); }
      if (chemin === "/") chemin = "/Index.html";
      let f = path.join(etat.racine, chemin); const ok = f.startsWith(etat.racine) && fs.existsSync(f) && fs.statSync(f).isFile();
      const h = Object.assign({}, ENTETES, { "Cache-Control": /version\.(json|txt)$/.test(chemin) ? "no-store" : "public, max-age=0, must-revalidate" });
      if (!ok) { const nf = path.join(etat.racine, "404.html"); rep.writeHead(404, Object.assign({}, h, { "Content-Type": MIME[".html"] })); return rep.end(fs.existsSync(nf) ? fs.readFileSync(nf) : "404"); }
      rep.writeHead(200, Object.assign({}, h, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" })); rep.end(fs.readFileSync(f));
    };
    if (etat.delai && !/version\.(json|txt)$/.test(chemin)) setTimeout(repondre, etat.delai); else repondre();
  });
  return new Promise(r => srv.listen(0, "127.0.0.1", () => r(Object.assign(etat, { port: srv.address().port, url: "http://127.0.0.1:" + srv.address().port, fermer: () => srv.close(), publier(dossier) { etat.racine = dossier; } }))));
}
export async function navigateur() { return puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args.filter(x => !/single-process|no-zygote/.test(x)).concat(["--no-sandbox", "--disable-dev-shm-usage"]), headless: "shell", protocolTimeout: 120000 }); }
export const pause = (ms) => new Promise(r => setTimeout(r, ms));
/* Une page « téléphone » : sans animation d'ouverture ni présentation, avec écoute des violations de sécurité (CSP) et des erreurs JavaScript. */
export async function pageTel(ctx, options) {
  const o = options || {}; const p = await ctx.newPage(); p.erreurs = []; p.csp = [];
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.evaluateOnNewDocument((theme) => { try { sessionStorage.setItem("acsc_splash", "1"); localStorage.setItem("acsc_nouveautes_vue", "*"); localStorage.setItem("acsc_presentation_vue", "1"); } catch (e) { /* ignoré */ } document.addEventListener("securitypolicyviolation", (e) => { (window.__csp = window.__csp || []).push(e.violatedDirective + " " + e.blockedURI); }); }, o.theme || "");
  p.on("pageerror", (e) => p.erreurs.push(e.message));
  return p;
}
export const lireCsp = (p) => p.evaluate(() => window.__csp || []).catch(() => []);
/* Attend que le service worker CONTRÔLE la page (installation terminée, copie faite). */
export async function attendreControle(p, delai) {
  const fin = Date.now() + (delai || 25000);
  while (Date.now() < fin) {
    const e = await p.evaluate(async () => { const c = !!navigator.serviceWorker.controller; const cles = await caches.keys(); return { c, cles }; }).catch(() => null);
    if (e && e.c && e.cles.some(n => n.startsWith("acsc-20"))) return e;
    await pause(300);
  }
  throw new Error("le service worker n'a pas pris le contrôle à temps");
}
export const etatCaches = (p) => p.evaluate(async () => {
  const cles = (await caches.keys()).sort(); const meta = cles.includes("acsc-meta") ? await (await caches.open("acsc-meta")).match("actif") : null;
  const actif = meta ? await meta.text() : null; const n = actif && cles.includes(actif) ? (await (await caches.open(actif)).keys()).length : null;
  return { cles, actif, fichiersDansActif: n };
});

/* Capture tolérante : la scène a des animations continues ; on essaie plusieurs méthodes avant d'abandonner (l'échec d'une capture ne doit pas arrêter le scénario). */
export async function capturer(p, chemin) {
  for (const opts of [{ fromSurface: false }, { optimizeForSpeed: true }, {}]) {
    try { await p.screenshot(Object.assign({ path: chemin }, opts)); return true; } catch (e) { /* méthode suivante */ }
  }
  return false;
}
