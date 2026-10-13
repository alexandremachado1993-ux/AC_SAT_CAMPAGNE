/* Thème sombre : écran obligatoire, progression, version installée. Prérequis : npm install, puis node maj-preparer.mjs. */
import { serveur, navigateur, pause, pageTel, attendreControle, capturer, VERS, cheminCapture, versionDe } from "./maj-lib.mjs";
const V0v = versionDe(0), V1v = versionDe(1), V2v = versionDe(2);
const S = await serveur(); const nav = await navigateur(); let ko = 0;
const t = (nom, ok, detail) => { if (!ok) ko++; console.log((ok ? "✅ " : "❌ ") + nom + (detail !== undefined ? "  → " + detail : "")); };
try {
  const ctx = await nav.createBrowserContext(); S.publier(VERS(1));
  let p = await pageTel(ctx); await p.goto(S.url + "/Index.html", { waitUntil: "load" }); await attendreControle(p);
  await p.evaluate(() => Donnees.definirTheme("dark")); await pause(400);
  const th = await p.evaluate(() => ({ attr: document.documentElement.getAttribute("data-theme"), fond: getComputedStyle(document.body).backgroundColor }));
  t("thème SOMBRE réellement appliqué (fond sombre)", /^rgb\((\d+), (\d+), (\d+)\)$/.test(th.fond) && th.fond.match(/\d+/g).slice(0, 3).every(n => +n < 90), JSON.stringify(th));
  await p.close();
  // écran obligatoire (rappels épuisés) en sombre, état FINAL de l'animation
  S.publier(VERS(2));
  const q = await pageTel(ctx); await q.goto(S.url + "/Index.html", { waitUntil: "load" });
  await q.evaluate(() => localStorage.setItem("acsc_maj_rappels", JSON.stringify({ base: AppLayout.VERSION, n: 3, t: 0 }))); await q.close();
  p = await pageTel(ctx); await p.goto(S.url + "/Index.html", { waitUntil: "load" });
  await p.waitForSelector(".maj-scene--bloque", { timeout: 9000 }); await pause(1200);
  await capturer(p, cheminCapture("img-9-bloque-sombre.png"));
  const contraste = await p.evaluate(() => { const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const rat = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const fond = getComputedStyle(document.querySelector(".maj-scene")).backgroundColor; const texte = document.querySelector(".maj-texte"), titre = document.querySelector(".maj-titre"), bouton = document.querySelector(".maj-actions button");
    return { fond, texte: rat(getComputedStyle(texte).color, fond).toFixed(1), titre: rat(getComputedStyle(titre).color, fond).toFixed(1), bouton: rat(getComputedStyle(bouton).color, getComputedStyle(bouton).backgroundColor).toFixed(1) }; });
  t("écran obligatoire, thème sombre : contrastes de texte ≥ 4,5:1 (texte, titre, bouton)", +contraste.texte >= 4.5 && +contraste.titre >= 4.5 && +contraste.bouton >= 4.5, JSON.stringify(contraste));
  // scène de progression en sombre (téléchargement ralenti pour la saisir à mi-parcours)
  S.delai = 220; await p.click(".maj-actions button");
  const fin = Date.now() + 20000; let pris = false;
  while (Date.now() < fin && !pris) { const pct = await p.evaluate(() => { const e = document.querySelector("[data-maj-pourcent]"); return e ? parseInt(e.textContent, 10) : -1; }).catch(() => -1); if (pct >= 30 && pct < 95) { pris = await capturer(p, cheminCapture("img-10-progres-sombre.png")); } await pause(120); }
  S.delai = 0; t("scène de progression en thème sombre capturée à mi-parcours", pris);
  const fin2 = Date.now() + 15000; let ok = false; while (Date.now() < fin2 && !ok) { ok = await p.evaluate(() => !!document.querySelector(".maj-scene--ok")).catch(() => false); await pause(100); }
  if (ok) { await pause(450); await capturer(p, cheminCapture("img-11-ok-sombre.png")); }
  t("écran « Version installée » atteint en thème sombre", ok);
} catch (e) { ko++; console.log("❌ ERREUR :", e.message); }
await nav.close(); S.fermer(); console.log(ko === 0 ? "\nTHÈME SOMBRE : conforme" : "\nTHÈME SOMBRE : " + ko + " écart(s)"); process.exit(ko === 0 ? 0 : 1);
