/* Phase 1 : bandeau « nouvelle version », pastilles unifiées, jetons de couleur, rangée de têtes collante. */
const fs = require("fs");
const path = require("path");
module.exports = async function ({ page, t }) {
  const attendre = (ms) => new Promise(r => setTimeout(r, ms));
  const reponse = (texte, ok) => () => Promise.resolve({ ok: ok !== false, text: () => Promise.resolve(texte) });
  /* Le harnais réinstalle un faux fetch qui échoue APRÈS notre crochet : on le verrouille pour qu'il ne puisse pas être écrasé. */
  const faux = (win, fn) => Object.defineProperty(win, "fetch", { configurable: true, get: () => fn, set: () => {} });
  const bandeau = (w) => { const f = w.document.querySelector(".feuille:not([hidden])"); return f && /Une nouvelle version est prête/.test(f.textContent) ? f : null; };   // la fenêtre de suggestion (elle s'ouvre 1,2 s après le démarrage)

  // ---------- Nouvelle version
  let w = page("Index.html", null, "", null, (win) => faux(win, reponse("2099.01.01-a\n")));
  await attendre(1700);
  t("nouvelle version : le serveur annonce une version différente → fenêtre de suggestion avec « Mettre à jour maintenant » et « Plus tard »", !!bandeau(w) && /2099\.01\.01-a/.test(bandeau(w).textContent) && /Mettre à jour maintenant/.test(bandeau(w).textContent) && /Plus tard/.test(bandeau(w).textContent));
  t("nouvelle version : proposée une seule fois par session", w.sessionStorage.getItem("acsc_maj_proposee") === "1");
  let appels = 0;
  w = page("Index.html", null, "", null, (win) => { faux(win, () => { appels++; return reponse("2099.01.01-a")(); }); try { win.sessionStorage.setItem("acsc_maj_proposee", "1"); } catch (e) {} });
  await attendre(1700);
  t("nouvelle version : déjà proposée dans la session → pas de nouvelle fenêtre (le contrôle a lieu, la pastille reste)", appels >= 1 && !bandeau(w) && !!w.document.querySelector(".entete-avatar-pastille"));
  w = page("Index.html", null, "", null, (win) => faux(win, reponse("LA_VERSION_COURANTE")));
  const courante = w.AppLayout.VERSION;
  w = page("Index.html", null, "", null, (win) => faux(win, reponse(courante + "\n"))); await attendre(1700);
  t("nouvelle version : même version que le serveur → pas de bandeau", !bandeau(w));
  w = page("Index.html", null, "", null, (win) => faux(win, reponse("<html>404 Page introuvable</html>"))); await attendre(1700);
  t("nouvelle version : réponse qui n'est pas un numéro de version (page d'erreur) → ignorée", !bandeau(w));
  w = page("Index.html", null, "", null, (win) => faux(win, reponse("2099.01.01-a", false))); await attendre(1700);
  t("nouvelle version : fichier absent (404) → pas de bandeau", !bandeau(w));
  w = page("Index.html", null, "", null, (win) => faux(win, () => Promise.reject(new Error("hors ligne")))); await attendre(1700);
  t("nouvelle version : hors ligne (requête qui échoue) → pas de bandeau, pas d'erreur", !bandeau(w));
  w = page("Index.html"); await attendre(30);
  t("nouvelle version : sans fetch disponible → l'application démarre normalement", !!w.document.getElementById("rail-lateral") && !bandeau(w));
  w.document.querySelector(".entete-avatar").click();
  t("version affichée dans le menu du profil", new RegExp("Version " + w.AppLayout.VERSION.replace(/\./g, "\\.")).test(w.document.querySelector(".menu-avatar-panneau").textContent));
  t("version : version.txt, AppLayout.VERSION et format (AAAA.MM.JJ-x) cohérents", fs.readFileSync(path.join(__dirname, "..", "version.txt"), "utf8").trim() === w.AppLayout.VERSION && /^\d{4}\.\d{2}\.\d{2}-[a-z]$/.test(w.AppLayout.VERSION));

  // ---------- Pastilles : un seul composant
  const w0 = page("Index.html"); const D = w0.Donnees;
  const c = D.ajouterClient({ nom: "Pastille", ville: "X", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const l = D.enregistrerLigne(c.id, { nom: "L1", formatHabituel: "1/2M", nbTetes: 2 });
  const wf = page("Client.html", w0.localStorage.getItem("acsc_donnees_v1"), "?id=" + c.id); wf.Formulaires.visite({ ligneId: l.id });
  const bloc = wf.document.querySelector("#fv-serti details");
  const champ = bloc.querySelector('[data-serti-champ="flange"]'); champ.value = "2,70"; champ.dispatchEvent(new wf.Event("input", { bubbles: true }));
  const pv = bloc.querySelector('[data-serti-param="flange"] [data-serti-pastille]');
  t("pastilles : le verdict d'une mesure utilise le composant « pastille-statut pastille-couleur » de l'application", pv.classList.contains("pastille-statut") && pv.classList.contains("pastille-couleur") && /--c:#b91c1c/.test(pv.getAttribute("style")) && pv.getAttribute("data-etat") === "hors");
  t("pastilles : le verdict de la tête aussi (même palette)", /pastille-statut/.test(bloc.querySelector("[data-serti-verdict-tete]").className) && /--c:#b91c1c/.test(bloc.querySelector("[data-serti-verdict-tete]").getAttribute("style")));
  t("pastilles : conforme = vert de l'application, limite = ambre, non jugé = gris", (() => { champ.value = "2,45"; champ.dispatchEvent(new wf.Event("input", { bubbles: true })); const ok = /--c:#16a34a/.test(pv.getAttribute("style")); champ.value = "2,62"; champ.dispatchEvent(new wf.Event("input", { bubbles: true })); const lim = /--c:#b45309/.test(pv.getAttribute("style")); champ.value = ""; champ.dispatchEvent(new wf.Event("input", { bubbles: true })); return ok && lim && /--c:#64748b/.test(pv.getAttribute("style")); })());
  t("pastilles : la page Serti et la fiche partagent les mêmes couleurs OUI / NON", /#16a34a/.test(fs.readFileSync(path.join(__dirname, "..", "Js", "Serti.js"), "utf8")) && /#b91c1c/.test(fs.readFileSync(path.join(__dirname, "..", "Js", "Serti.js"), "utf8")));

  // ---------- Jetons de couleur : plus de code couleur dans les règles du serti
  const css = fs.readFileSync(path.join(__dirname, "..", "CSS", "campagne.css"), "utf8");
  const bloc2 = css.slice(css.indexOf("/* ---------- Contrôle de serti"), css.indexOf("/* ---------- Rapport de serti"));
  const fautives = bloc2.split("\n").filter(l2 => /#[0-9a-fA-F]{3,8}\b/.test(l2) && !/--v-|--sj-/.test(l2) && !/^\s*\/\*/.test(l2));
  t("jetons : dans le bloc du serti, un code couleur n'apparaît que pour DÉFINIR un jeton" + (fautives.length ? " — EN DUR : " + fautives[0].trim().slice(0, 70) : ""), fautives.length === 0);
  t("jetons : chaque jeton de verdict est défini en clair ET en sombre", ["ok", "lim", "hors"].every(k => new RegExp("--v-" + k + "-fond").test(bloc2.split("html.dark {")[0]) && new RegExp("--v-" + k + "-fond").test(bloc2.split("html.dark {")[1] || "")));
  t("jetons : plus de surcharge sombre par règle (« html.dark .serti-… ») : les jetons suffisent", !/html\.dark \.serti-(?:v|tete|case)--/.test(bloc2));

  // ---------- Rangée de têtes collante
  t("rangée de têtes : le conteneur colle sous le titre de la feuille (sticky sur le parent, pas sur la rangée), la rangée défile sur une ligne", /\.bloc-serti \[data-serti-tetes\] \{[^}]*position: sticky;[^}]*top: var\(--serti-decalage-tetes[^}]*z-index: 2;/.test(css) && /\.serti-tetes \{[^}]*display: flex;[^}]*overflow-x: auto;/.test(css) && !/\.serti-tetes \{[^}]*position: sticky/.test(css));
};
