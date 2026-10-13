/* Échec, Continuer, dernier rappel, blocage, hors connexion, version obligatoire. Prérequis : npm install, puis node maj-preparer.mjs. */
import { serveur, navigateur, pause, pageTel, lireCsp, attendreControle, etatCaches, capturer, VERS, cheminCapture } from "./maj-lib.mjs";
const S = await serveur(); const nav = await navigateur(); let ko = 0;
const t = (nom, ok, detail) => { if (!ok) ko++; console.log((ok ? "✅ " : "❌ ") + nom + (detail !== undefined ? "  → " + detail : "")); };
const version = (p) => p.evaluate(() => AppLayout.VERSION).catch(() => null);
const attendreVersion = async (p, v, ms) => { const fin = Date.now() + (ms || 15000); let x = null; while (Date.now() < fin) { x = await version(p); if (x === v) return x; await pause(300); } return x; };
const installer = async (ctx, dossier) => { S.publier(dossier); const p = await pageTel(ctx); await p.goto(S.url + "/Index.html", { waitUntil: "load" }); await attendreControle(p); await p.close(); };
const classes = (p) => p.evaluate(() => { const s = document.querySelector(".maj-scene"); return s ? s.className : null; }).catch(() => null);
const attendreClasse = async (p, c, ms) => { const fin = Date.now() + (ms || 10000); let x = null; while (Date.now() < fin) { x = await classes(p); if (x && x.indexOf(c) !== -1) return x; await pause(150); } return x; };
try {
  // ======== S5 : ÉCHEC en cours de route
  let ctx = await nav.createBrowserContext(); await installer(ctx, VERS(1));
  S.publier(VERS(2)); S.pannes.add("/Js/Donnees.js");
  let p = await pageTel(ctx); await p.goto(S.url + "/Index.html", { waitUntil: "load" });
  await p.waitForSelector(".feuille:not([hidden]) [data-maj-maintenant]", { timeout: 8000 }); await p.click("[data-maj-maintenant]");
  const cl = await attendreClasse(p, "maj-scene--echec", 15000);
  const c1 = await etatCaches(p);
  t("S5 ÉCHEC (un fichier répond 500) : la scène passe en « échec » avec un message clair", /echec/.test(cl || ""), cl);
  t("S5 … la version installée n'a PAS bougé, aucune copie à moitié faite ne traîne (seulement « b » et la méta)", (await version(p)) === "2026.10.12-b" && c1.cles.join() === "acsc-2026.10.12-b,acsc-meta" && c1.actif === "acsc-2026.10.12-b", JSON.stringify(c1));
  const txt = await p.evaluate(() => ({ titre: document.querySelector(".maj-titre").textContent, texte: document.querySelector(".maj-texte").textContent, boutons: Array.from(document.querySelectorAll(".maj-actions button")).map(b => b.textContent) }));
  t("S5 … deux choix : « Réessayer » et « Continuer avec l'ancienne version »", txt.boutons.join("|") === "Réessayer|Continuer avec l'ancienne version" && /pas abouti/.test(txt.titre), JSON.stringify(txt));
  await capturer(p, cheminCapture("img-4-echec.png"));
  S.pannes.clear(); await p.click(".maj-actions button");
  t("S5 « Réessayer » avec le serveur rétabli : la mise à jour réussit et l'application passe en 2026.10.12-c", (await attendreVersion(p, "2026.10.12-c", 20000)) === "2026.10.12-c");
  t("S5 aucune violation de sécurité ni erreur JavaScript", (await lireCsp(p)).length === 0 && p.erreurs.length === 0, (await lireCsp(p)).concat(p.erreurs).join(" | ") || "0");
  await ctx.close();

  // ======== S6 : « Continuer avec l'ancienne version » rend bien la main
  ctx = await nav.createBrowserContext(); await installer(ctx, VERS(1));
  S.publier(VERS(2)); S.pannes.add("/Js/Donnees.js");
  p = await pageTel(ctx); await p.goto(S.url + "/Index.html", { waitUntil: "load" });
  await p.waitForSelector(".feuille:not([hidden]) [data-maj-maintenant]", { timeout: 8000 }); await p.click("[data-maj-maintenant]"); await attendreClasse(p, "maj-scene--echec", 15000);
  await p.click(".maj-actions button:nth-child(2)"); await pause(300);
  t("S6 « Continuer avec l'ancienne version » : la scène disparaît, l'application est utilisable et reste en 2026.10.12-b", (await classes(p)) === null && (await p.evaluate(() => !document.documentElement.classList.contains("maj-en-cours"))) && (await version(p)) === "2026.10.12-b");
  S.pannes.clear(); await ctx.close();

  // ======== S7 : DERNIER RAPPEL, puis blocage à l'ouverture suivante (pas dans la même session)
  ctx = await nav.createBrowserContext(); await installer(ctx, VERS(1)); S.publier(VERS(2));
  let q = await pageTel(ctx); await q.goto(S.url + "/Index.html", { waitUntil: "load" });
  await q.evaluate(() => localStorage.setItem("acsc_maj_rappels", JSON.stringify({ base: AppLayout.VERSION, n: 2, t: Date.now() - 7 * 3600e3 })));
  await q.close(); p = await pageTel(ctx); await p.goto(S.url + "/Index.html", { waitUntil: "load" });
  await p.waitForSelector(".feuille:not([hidden]) .maj-rappel", { timeout: 8000 }).catch(() => null);
  const dr = await p.evaluate(() => { const r = document.querySelector(".feuille:not([hidden]) .maj-rappel"); return r ? { t: r.textContent, dernier: r.classList.contains("maj-rappel--dernier") } : null; });
  t("S7 3ᵉ rappel : « Dernier rappel » mis en évidence, avec l'avertissement de la prochaine ouverture", !!dr && /Dernier rappel/.test(dr.t) && dr.dernier && /prochaine ouverture/.test(dr.t), dr && dr.t);
  await capturer(p, cheminCapture("img-5-dernier.png"));
  await p.click("[data-maj-plus-tard]"); await p.goto(S.url + "/Planning.html", { waitUntil: "load" }); await pause(3500);
  t("S7 dans la MÊME session, après le 3ᵉ rappel : pas de blocage (on laisse finir ce qu'on fait)", (await classes(p)) === null);
  await p.close(); p = await pageTel(ctx); await p.goto(S.url + "/Index.html", { waitUntil: "load" });
  const bl = await attendreClasse(p, "maj-scene--bloque", 8000);
  t("S7 OUVERTURE SUIVANTE (nouvelle session) : l'écran « Mise à jour obligatoire » s'affiche à la place de la fenêtre", /bloque/.test(bl || ""), bl);
  const etat = await p.evaluate(() => ({ titre: document.querySelector(".maj-titre").textContent, texte: document.querySelector(".maj-texte").textContent, boutons: Array.from(document.querySelectorAll(".maj-actions button")).map(b => b.textContent), fenetre: !!document.querySelector(".feuille:not([hidden])") }));
  t("S7 … un seul bouton « Mettre à jour maintenant », explication des trois reports, pas de fenêtre de suggestion en plus", etat.boutons.join("|") === "Mettre à jour maintenant" && /trois fois/.test(etat.texte) && !etat.fenetre, JSON.stringify(etat));
  await capturer(p, cheminCapture("img-6-bloque.png"));
  await p.keyboard.press("Escape"); await pause(400);
  t("S7 … la touche Échap ne le ferme pas", /bloque/.test((await classes(p)) || ""));
  const focus = await p.evaluate(() => document.activeElement && document.activeElement.textContent);
  t("S7 … le focus est sur le bouton (clavier et lecteurs d'écran)", /Mettre à jour maintenant/.test(focus || ""), focus);
  await p.click(".maj-actions button");
  t("S7 … le bouton installe : l'application passe en 2026.10.12-c", (await attendreVersion(p, "2026.10.12-c", 25000)) === "2026.10.12-c");
  await ctx.close();

  // ======== S8 : HORS CONNEXION, jamais de blocage
  ctx = await nav.createBrowserContext(); await installer(ctx, VERS(1)); S.publier(VERS(2));
  q = await pageTel(ctx); await q.goto(S.url + "/Index.html", { waitUntil: "load" });
  await q.evaluate(() => localStorage.setItem("acsc_maj_rappels", JSON.stringify({ base: AppLayout.VERSION, n: 3, t: 0 }))); await q.close();
  p = await pageTel(ctx); await p.setOfflineMode(true); await p.goto(S.url + "/Index.html", { waitUntil: "load" }); await pause(4000);
  t("S8 HORS CONNEXION avec les 3 rappels épuisés : AUCUN blocage, l'application s'ouvre et fonctionne", (await classes(p)) === null && (await version(p)) === "2026.10.12-b" && await p.evaluate(() => !!document.getElementById("rail-lateral")));
  await p.setOfflineMode(false); await ctx.close();

  // ======== S9 : version marquée « obligatoire » par le serveur
  ctx = await nav.createBrowserContext(); await installer(ctx, VERS(1)); S.publier(VERS(3));
  p = await pageTel(ctx); await p.goto(S.url + "/Index.html", { waitUntil: "load" });
  const ob = await attendreClasse(p, "maj-scene--bloque", 8000);
  const txtOb = await p.evaluate(() => { const x = document.querySelector(".maj-scene .maj-texte"); return x ? x.textContent : null; });
  t("S9 version « obligatoire » : blocage IMMÉDIAT (aucun rappel nécessaire), texte sur les données entre appareils", /bloque/.test(ob || "") && /données restent justes/.test(txtOb || "") && !/trois fois/.test(txtOb || ""), txtOb);
  await ctx.close();
} catch (e) { ko++; console.log("❌ ERREUR DU SCÉNARIO :", e.message); }
await nav.close(); S.fermer(); console.log(ko === 0 ? "\nSCÉNARIO 2 : tout est conforme" : "\nSCÉNARIO 2 : " + ko + " écart(s)"); process.exit(ko === 0 ? 0 : 1);
