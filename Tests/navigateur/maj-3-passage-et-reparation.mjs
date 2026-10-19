/* Passage depuis l'ancien service worker (V0 requise), réparation, grand et petit écran. Prérequis : npm install, puis node maj-preparer.mjs. */
import { serveur, navigateur, pause, pageTel, lireCsp, attendreControle, etatCaches, capturer, VERS, cheminCapture, versionDe, v0EstAncien, nbFichiers } from "./maj-lib.mjs";
const V0v = versionDe(0), V1v = versionDe(1), V2v = versionDe(2);
const S = await serveur(); const nav = await navigateur(); let ko = 0;
const t = (nom, ok, detail) => { if (!ok) ko++; console.log((ok ? "✅ " : "❌ ") + nom + (detail !== undefined ? "  → " + detail : "")); };
const version = (p) => p.evaluate(() => AppLayout.VERSION).catch(() => null);
const attendre = async (fn, ms) => { const fin = Date.now() + (ms || 20000); while (Date.now() < fin) { const r = await fn().catch(() => null); if (r) return r; await pause(300); } return null; };
let ctx, p;
try {
  if (!v0EstAncien()) console.log("ℹ️  S10 ignoré : la version « ancienne » fournie n'a pas l'ancien service worker (utiliser un clone de GitHub d'AVANT 2026.10.12-b)");
  else {
  // ======== S10 : PASSAGE depuis l'ancien service worker (celui de ton téléphone aujourd'hui : 2026.10.12-a, « réseau d'abord »)
  ctx = await nav.createBrowserContext(); S.publier(VERS(0));
  p = await pageTel(ctx); await p.goto(S.url + "/", { waitUntil: "load" });
  const ancien = await attendre(() => p.evaluate(async () => navigator.serviceWorker.controller && (await caches.keys()).includes("acsc-v6")), 25000);
  t("S10 point de départ : l'ANCIEN service worker contrôle la page (cache « acsc-v6 ») en version 2026.10.12-a", !!ancien && (await version(p)) === V0v, await version(p));
  S.publier(VERS(1));
  await p.goto(S.url + "/Index.html", { waitUntil: "load" });
  t("S10 PASSAGE : à l'ouverture suivante, la version 2026.10.12-b est prise (c'est le dernier passage SANS validation, annoncé)", (await version(p)) === V1v, await version(p));
  const fait = await attendre(() => p.evaluate(async (nom) => { const k = await caches.keys(); return k.includes(nom) && !k.includes("acsc-v6") && k.includes("acsc-meta"); }, "acsc-" + V1v), 30000);
  const c = await etatCaches(p);
  t("S10 le NOUVEAU service worker s'installe, copie la version et SUPPRIME l'ancien cache « acsc-v6 »", !!fait && c.cles.join() === "acsc-" + V1v + ",acsc-meta" && c.actif === "acsc-" + V1v && c.fichiersDansActif === nbFichiers(1), JSON.stringify(c));
  const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { actif: !!r.active, attente: !!r.waiting, installation: !!r.installing, controle: !!navigator.serviceWorker.controller }; });
  t("S10 aucun service worker « en attente » : le nouveau est actif et contrôle la page", sw.actif && !sw.attente && !sw.installation && sw.controle, JSON.stringify(sw));
  S.mort = true; await p.reload({ waitUntil: "load" });
  t("S10 hors connexion juste après le passage : l'application s'ouvre depuis la nouvelle copie, en 2026.10.12-b", (await version(p)) === V1v && await p.evaluate(() => !!document.getElementById("rail-lateral")));
  S.mort = false;
  S.publier(VERS(2)); S.journal.length = 0;
  await p.goto(S.url + "/Planning.html", { waitUntil: "load" });
  t("S10 dès le passage fait, la version est FIGÉE : le serveur publie « c », l'application reste en « b » (0 script redemandé)", (await version(p)) === V1v && S.journal.filter(j => /^\/(Js|CSS)\//.test(j.chemin)).length === 0);
  t("S10 aucune erreur JavaScript ni violation de sécurité pendant tout le passage", p.erreurs.length === 0 && (await lireCsp(p)).length === 0, p.erreurs.join(" | ") || "0");
  await ctx.close();

  }

  // ======== S11 : RÉPARER l'installation, données conservées
  ctx = await nav.createBrowserContext(); S.publier(VERS(1));
  p = await pageTel(ctx); await p.goto(S.url + "/Index.html", { waitUntil: "load" }); await attendreControle(p);
  await p.evaluate(() => { Donnees.ajouterClient({ nom: "Client de test", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 }); });
  await p.goto(S.url + "/Reglages.html#informations", { waitUntil: "load" }); await p.reload({ waitUntil: "load" });
  p.on("dialog", (d) => d.accept());
  await p.waitForSelector("[data-reparer-installation]", { timeout: 8000 });
  await p.click("[data-reparer-installation]");
  await pause(2500);
  const rep = await attendre(() => p.evaluate(async (nom) => { const k = await caches.keys(); return !!navigator.serviceWorker.controller && k.includes(nom) && k.includes("acsc-meta"); }, "acsc-" + V1v), 30000);
  const c2 = await etatCaches(p); const clients = await p.evaluate(() => Donnees.listerClients().map(x => x.nom));
  t("S11 « Réparer l'installation » : les copies et le service worker sont effacés puis RÉINSTALLÉS proprement (tous les fichiers publiés)", !!rep && c2.cles.join() === "acsc-" + V1v + ",acsc-meta" && c2.fichiersDansActif === nbFichiers(1), JSON.stringify(c2));
  t("S11 … les DONNÉES de l'utilisateur sont intactes (le client créé avant la réparation est toujours là)", clients.join() === "Client de test", clients.join());
  await ctx.close();

  // ======== S12 : rendu sur grand écran et petit écran sombre (écran obligatoire)
  ctx = await nav.createBrowserContext(); S.publier(VERS(1)); { const q = await pageTel(ctx); await q.goto(S.url + "/Index.html", { waitUntil: "load" }); await attendreControle(q); await q.close(); }
  S.publier(VERS(3));
  p = await pageTel(ctx); await p.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 }); await p.goto(S.url + "/Index.html", { waitUntil: "load" });
  await p.waitForSelector(".maj-scene--bloque", { timeout: 9000 }).catch(() => null); await pause(900);      // fin de l'animation d'entrée (0,4 s : l'écran grossit de 3 % au début)
  const mesure = await p.evaluate(() => { const s = document.querySelector(".maj-centre"); const r = s ? s.getBoundingClientRect() : null; return r ? { largeur: Math.round(r.width), debordeH: document.documentElement.scrollWidth > innerWidth } : null; });
  t("S12 grand écran (1280×800) : l'écran obligatoire reste centré, limité à ~420 px, sans défilement horizontal", !!mesure && mesure.largeur <= 421 && !mesure.debordeH, JSON.stringify(mesure));
  await capturer(p, cheminCapture("img-7-bureau.png"));
  await p.setViewport({ width: 320, height: 568, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await p.waitForSelector(".maj-scene--bloque", { timeout: 9000 }).catch(() => null); await pause(900);      // changer la taille « mobile » recharge la page : l'écran revient après ~0,6 s
  const petit = await p.evaluate(() => { const s = document.querySelector(".maj-scene"); return { deborde: document.documentElement.scrollWidth > innerWidth, boutonVisible: (() => { const b = document.querySelector(".maj-actions button"); if (!b) return false; const r = b.getBoundingClientRect(); return r.width > 100 && r.height >= 44; })(), defile: s ? s.scrollHeight > s.clientHeight : null }; });
  t("S12 très petit écran (320×568, thème sombre) : pas de débordement horizontal, bouton de 44 px au moins (zone tactile)", !petit.deborde && petit.boutonVisible, JSON.stringify(petit));
  await capturer(p, cheminCapture("img-8-petit-sombre.png"));
  await ctx.close();
} catch (e) { ko++; console.log("❌ ERREUR DU SCÉNARIO :", e.message); }
await nav.close(); S.fermer(); console.log(ko === 0 ? "\nSCÉNARIO 3 : tout est conforme" : "\nSCÉNARIO 3 : " + ko + " écart(s)"); process.exit(ko === 0 ? 0 : 1);
