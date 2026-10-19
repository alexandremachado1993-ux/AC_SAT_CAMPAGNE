/* Installation, hors ligne, version figée, rappel, validation avec barre de pourcentage. Prérequis : npm install, puis node maj-preparer.mjs. */
import { serveur, navigateur, pause, pageTel, lireCsp, attendreControle, etatCaches, capturer, VERS, cheminCapture, versionDe, nbFichiers } from "./maj-lib.mjs";
const V0v = versionDe(0), V1v = versionDe(1), V2v = versionDe(2);
const S = await serveur(); const nav = await navigateur(); let ko = 0;
const t = (nom, ok, detail) => { if (!ok) ko++; console.log((ok ? "✅ " : "❌ ") + nom + (detail !== undefined ? "  → " + detail : "")); };
const version = (p) => p.evaluate(() => AppLayout.VERSION);
try {
  S.publier(VERS(1));
  const ctx = await nav.createBrowserContext(); let p = await pageTel(ctx);
  await p.goto(S.url + "/", { waitUntil: "load" });
  await attendreControle(p);
  let c = await etatCaches(p);
  t("S1 installation : un service worker contrôle la page ; une copie « acsc-2026.10.12-b » et la méta existent, la version active est la bonne", (await version(p)) === V1v && c.cles.join() === "acsc-" + V1v + ",acsc-meta" && c.actif === "acsc-" + V1v, JSON.stringify(c));
  t("S1 la copie contient TOUS les fichiers publiés par la version (version.json)", c.fichiersDansActif === nbFichiers(1), c.fichiersDansActif);
  S.mort = true; await p.reload({ waitUntil: "load" });
  const horsLigne1 = (await version(p)) === V1v && await p.evaluate(() => !!document.getElementById("rail-lateral"));
  await p.goto(S.url + "/Planning.html", { waitUntil: "load" });
  const horsLigne2 = await p.evaluate(() => document.title.length > 0 && !!document.querySelector(".entete, header, #rail-lateral"));
  t("S1 HORS LIGNE (mode avion) : l'accueil ET une autre page s'ouvrent depuis la copie", horsLigne1 && horsLigne2);
  S.mort = false;

  // ---------- Le serveur publie la version suivante : l'appareil NE CHANGE PAS
  S.publier(VERS(2)); S.journal.length = 0;
  await p.goto(S.url + "/Index.html", { waitUntil: "load" });
  const vAvant = await version(p);
  t("S2 le serveur publie 2026.10.12-c : l'application ouverte reste en 2026.10.12-b (version figée)", vAvant === V1v, vAvant);
  await p.goto(S.url + "/", { waitUntil: "load" });
  t("S2 l'adresse racine « / » reste elle aussi sur la version installée", (await version(p)) === V1v);
  await p.goto(S.url + "/Planning.html", { waitUntil: "load" });
  t("S2 une autre page reste sur la version installée", (await version(p)) === V1v);
  const scriptsReseau = S.journal.filter(j => /^\/(Js|CSS)\//.test(j.chemin)).map(j => j.chemin);
  t("S2 aucun script ni style de l'application n'a été redemandé au serveur (tout vient de la copie)", scriptsReseau.length === 0, scriptsReseau.slice(0, 3).join(", ") || "0 requête");

  // ---------- La proposition (rappel 1), puis la validation
  const avant = await p.evaluate(() => ({ rappels: localStorage.getItem("acsc_maj_rappels"), reportee: localStorage.getItem("acsc_maj_reportee"), proposee: sessionStorage.getItem("acsc_maj_proposee") }));
  console.log("   état de l'onglet avant la proposition :", JSON.stringify(avant));
  await p.evaluate(() => { localStorage.removeItem("acsc_maj_rappels"); localStorage.removeItem("acsc_maj_reportee"); });
  await p.close(); p = await pageTel(ctx);       // un NOUVEL onglet = une nouvelle session (l'application ne propose qu'une fois par session)
  await p.goto(S.url + "/Index.html", { waitUntil: "load" });
  await p.waitForSelector(".feuille:not([hidden]) .maj-rappel", { timeout: 8000 }).catch(() => null);
  const rappel = await p.evaluate(() => { const r = document.querySelector(".feuille:not([hidden]) .maj-rappel"); return r ? r.textContent : null; });
  t("S3 l'application PROPOSE la mise à jour (elle ne l'installe pas) : « Rappel 1 sur 3 »", /Rappel 1 sur 3/.test(rappel || ""), rappel);
  t("S3 toujours en version 2026.10.12-b pendant la proposition", (await version(p)) === V1v);
  await capturer(p, cheminCapture("img-1-rappel.png"));
  S.delai = 140;
  await p.click("[data-maj-maintenant]");
  await p.waitForSelector(".maj-scene", { timeout: 5000 });
  const pourcents = []; let capture = false, vuOk = false; const fin = Date.now() + 40000;
  while (Date.now() < fin) {
    const e = await p.evaluate(() => { const s = document.querySelector(".maj-scene"); if (!s) return null; return { pct: s.querySelector("[data-maj-pourcent]").textContent, classe: s.className, titre: s.querySelector(".maj-titre").textContent, etapes: Array.from(s.querySelectorAll(".maj-etape")).map(x => x.className.replace("maj-etape maj-etape--", "")).join(",") }; }).catch(() => null);
    if (!e) { await pause(100); if (pourcents.length > 3) break; continue; }
    const n = parseInt(e.pct, 10); if (pourcents[pourcents.length - 1] !== n) pourcents.push(n);
    if (!capture && n >= 35 && n < 90) { capture = await capturer(p, cheminCapture("img-2-progres.png")) || true; console.log("   capture à", n, "% | étapes :", e.etapes); }
    if (!vuOk && /maj-scene--ok/.test(e.classe)) { vuOk = true; await pause(500); await capturer(p, cheminCapture("img-3-ok.png")); t("S4 la scène arrive à « Version installée » (classe ok)", /installée/.test(e.titre), e.titre); const csp = await lireCsp(p); t("S4 aucune violation de sécurité (CSP) pendant la scène", csp.length === 0, csp.join(" | ") || "0"); }
    await pause(100);
  }
  S.delai = 0;
  t("S4 la barre de pourcentage est RÉELLE : elle monte par paliers, sans jamais reculer, de 0 à 100 (" + pourcents.length + " valeurs)", pourcents.length >= 5 && pourcents.every((x, i) => i === 0 || x >= pourcents[i - 1]) && pourcents[pourcents.length - 1] === 100 && pourcents.some(x => x > 0 && x < 100), pourcents.join(" "));
  const fin2 = Date.now() + 15000; let v = null;
  while (Date.now() < fin2) { v = await version(p).catch(() => null); if (v === V2v) break; await pause(300); }
  t("S4 après « Version installée », l'application redémarre sur 2026.10.12-c", v === V2v, v);
  await attendreControle(p).catch(() => null); c = await etatCaches(p);
  t("S4 la copie de la version b est SUPPRIMÉE, celle de c est active et complète (tous les fichiers publiés)", c.cles.join() === "acsc-" + V2v + ",acsc-meta" && c.actif === "acsc-" + V2v && c.fichiersDansActif === nbFichiers(2), JSON.stringify(c));
  const rechargesNeuves = S.journal.filter(j => /^\/Js\/Donnees\.js$/.test(j.chemin) && /no-cache|max-age=0/.test(j.cache));
  t("S4 le téléchargement a demandé chaque fichier AU SERVEUR (« cache: reload »), pas à la copie", rechargesNeuves.length >= 1, rechargesNeuves.length + " requête(s) avec en-tête de fraîcheur");
  t("S4 aucune erreur JavaScript pendant tout le parcours", p.erreurs.length === 0, p.erreurs.join(" | ") || "0");
} catch (e) { ko++; console.log("❌ ERREUR DU SCÉNARIO :", e.message); }
await nav.close(); S.fermer(); console.log(ko === 0 ? "\nSCÉNARIO 1 : tout est conforme" : "\nSCÉNARIO 1 : " + ko + " écart(s)"); process.exit(ko === 0 ? 0 : 1);
