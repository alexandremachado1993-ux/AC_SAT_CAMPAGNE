/* Nouveautés : validité de chaque annonce (photos incluses) et comportement de la fenêtre « quoi de neuf ». */
const fs = require("fs");
const path = require("path");
module.exports = async function ({ page, t }) {
  const racine = path.join(__dirname, "..");
  const attendre = (ms) => new Promise(r => setTimeout(r, ms));
  const clic = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
  const CLE = "acsc_nouveautes_vue";
  const feuille = (w) => w.document.querySelector(".feuille:not([hidden])");
  const nonVue = (w) => w.localStorage.getItem(CLE) === null;
  /* dimensions d'un WebP lues dans son en-tête (VP8 / VP8X / VP8L) */
  const dimsWebp = (b) => {
    const f = b.toString("ascii", 12, 16);
    if (f === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (f === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (f === "VP8L") { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
    return [0, 0];
  };

  // ---------- Validité de la liste
  const w0 = page("Index.html"); const N = w0.Nouveautes; const L = N.LISTE;
  t("nouveautés : au moins une annonce, identifiants uniques", L.length >= 2 && new Set(L.map(x => x.id)).size === L.length && L.every(x => /^[a-z0-9-]+$/.test(x.id)));
  t("nouveautés : version (AAAA.MM.JJ-x) et date ISO valides ; la plus récente d'abord", L.every(x => /^\d{4}\.\d{2}\.\d{2}-[a-z]$/.test(x.version) && /^\d{4}-\d{2}-\d{2}$/.test(x.date)) && L.every((x, i) => i === 0 || L[i - 1].date >= x.date));
  t("nouveautés : chaque annonce a un titre, un résumé et de 1 à 6 étapes lisibles", L.every(x => x.titre.length >= 8 && x.resume.length >= 40 && x.etapes.length >= 1 && x.etapes.length <= 6 && x.etapes.every(e => e.length >= 15)));
  t("nouveautés : de 1 à 3 photos par annonce", L.every(x => x.images.length >= 1 && x.images.length <= 3));
  const images = [].concat.apply([], L.map(x => x.images));
  t("photos : chaque fichier existe, est un WebP, et pèse moins de 150 Ko", images.every(im => { const f = path.join(racine, im.src); return fs.existsSync(f) && /\.webp$/.test(im.src) && fs.statSync(f).size < 150 * 1024 && fs.readFileSync(f).toString("ascii", 8, 12) === "WEBP"; }));
  t("photos : les dimensions déclarées sont les vraies (la page ne saute pas au chargement)", images.every(im => { const d = dimsWebp(fs.readFileSync(path.join(racine, im.src))); return d[0] === im.largeur && d[1] === im.hauteur; }));
  t("photos : texte alternatif décrivant l'image et légende (repères ① ② ③) pour chacune", images.every(im => im.alt.length >= 30 && im.legende.length >= 5));
  t("photos : noms versionnés (…-v1.webp), car /Media/* est mis en cache un an (« immutable »)", images.every(im => /-v\d+\.webp$/.test(im.src)) && /for = "\/Media\/\*"[\s\S]*?immutable/.test(fs.readFileSync(path.join(racine, "netlify.toml"), "utf8")));
  t("photos : aucune photo orpheline dans Media/nouveautes (toutes sont annoncées)", fs.readdirSync(path.join(racine, "Media", "nouveautes")).filter(f => /\.webp$/.test(f)).every(f => images.some(im => im.src === "Media/nouveautes/" + f)));
  t("photos : aucun nom de client réel (captures sur données fictives)", !/Bordères|Castelmoron|Lot-et-Garonne|Saupiquet|SICA|Euralis|Maroc/i.test(fs.readFileSync(path.join(racine, "Js", "Nouveautes.js"), "utf8")));
  t("étapes : les repères cités (①②③) existent dans la légende d'au moins une photo de l'annonce", L.every(x => { const cites = (x.etapes.join(" ").match(/[①②③]/g) || []); return cites.every(c => x.images.some(im => im.legende.indexOf(c) !== -1)); }));

  // ---------- Création d'un utilisateur existant (a déjà des clients)
  const wd = page("Index.html"); wd.Donnees.ajouterClient({ nom: "Existant", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const stock = wd.localStorage.getItem("acsc_donnees_v1");
  const sansCle = (win) => win.localStorage.removeItem(CLE);

  // première installation : rien à expliquer
  let w = page("Index.html", null, "", null, sansCle); await attendre(1400);
  t("première installation : aucune fenêtre, tout est marqué comme vu", !feuille(w) && w.localStorage.getItem(CLE) === L[0].id);

  // utilisateur existant : la fenêtre s'ouvre avec la nouveauté la plus récente
  w = page("Index.html", stock, "", null, sansCle); await attendre(1400);
  let f = feuille(w);
  t("utilisateur existant : la fenêtre « Nouveautés » s'ouvre toute seule avec le nombre de nouveautés", !!f && new RegExp("Nouveautés \\(" + L.length + "\\)").test(f.textContent));
  t("la plus récente d'abord : titre, résumé, date et version", f.querySelector(".nouv-titre").textContent === L[0].titre && f.textContent.indexOf(L[0].resume) !== -1 && new RegExp(L[0].date.slice(8, 10) + "/" + L[0].date.slice(5, 7) + "/" + L[0].date.slice(0, 4) + " · version " + L[0].version.replace(/\./g, "\\.")).test(f.textContent));
  t("photos affichées avec texte alternatif, dimensions, chargement différé et lien d'agrandissement", (() => { const imgs = f.querySelectorAll(".nouv-figure img"); return imgs.length === L[0].images.length && Array.from(imgs).every((im, k) => im.getAttribute("alt") === L[0].images[k].alt && im.getAttribute("width") === String(L[0].images[k].largeur) && im.getAttribute("loading") === "lazy" && im.parentElement.getAttribute("target") === "_blank" && im.parentElement.getAttribute("rel") === "noopener"); })());
  t("légendes présentes sous chaque photo", Array.from(f.querySelectorAll("figcaption")).map(x => x.textContent).join("|") === L[0].images.map(i => i.legende).join("|"));
  t("« Comment l'utiliser » : les étapes en liste numérotée", f.querySelectorAll(".nouv-etapes li").length === L[0].etapes.length && /Comment l'utiliser/.test(f.textContent));
  t("navigation entre nouveautés : « ‹ Précédent » inactif sur la première, compteur « 1/N », « Suivant › » actif", new RegExp("1/" + L.length).test(f.textContent) && f.querySelector('[data-nouv-nav="-1"]').disabled && !f.querySelector('[data-nouv-nav="1"]').disabled);
  t("navigation : libellés « ‹ Précédent » à gauche, « 1/N » au centre, « Suivant › » à droite, dans cet ordre", (() => { const nv = f.querySelector(".nouv-nav"); const [g, c, d] = Array.from(nv.children); return g.textContent === "‹ Précédent" && g.getAttribute("data-nouv-nav") === "-1" && c.textContent === "1/" + L.length && d.textContent === "Suivant ›" && d.getAttribute("data-nouv-nav") === "1"; })());
  t("navigation : le compteur est annoncé en toutes lettres aux lecteurs d'écran (« Nouveauté 1 sur N »)", f.querySelector(".nouv-compteur").getAttribute("aria-label") === "Nouveauté 1 sur " + L.length && f.querySelector(".nouv-compteur").getAttribute("role") === "status");
  clic(f.querySelector('[data-nouv-nav="1"]'));
  t("« Suivant › » montre la nouveauté suivante (3 photos, ses étapes)", f.querySelector(".nouv-titre").textContent === L[1].titre && f.querySelectorAll(".nouv-figure img").length === L[1].images.length && new RegExp("2/" + L.length).test(f.textContent) && f.querySelector('[data-nouv-nav="1"]').disabled === (L.length === 2));
  t("bouton d'action vers la fonction (libellé de l'annonce affichée)", f.querySelector("[data-nouv-action]").textContent === L[1].action.libelle);
  t("une seule annonce automatique par session", w.sessionStorage.getItem("acsc_nouveautes_session") === "1" && nonVue(w));
  clic(f.querySelector("[data-nouv-compris]"));
  t("« Compris » ferme la fenêtre et marque tout comme vu (la plus récente = " + L[0].id + ")", !feuille(w) && w.localStorage.getItem(CLE) === L[0].id && N.nonVues().length === 0 && w.Nouveautes.nbNonVues() === 0);
  const vuLocal = w.localStorage.getItem(CLE);
  w = page("Index.html", stock, "", null, (win) => win.localStorage.setItem(CLE, vuLocal)); await attendre(1400);
  t("à l'ouverture suivante : déjà vue, rien ne s'ouvre", !feuille(w));

  // « plus tard » (croix) : non marquée, reproposée à la session suivante
  w = page("Index.html", stock, "", null, sansCle); await attendre(1400);
  clic(feuille(w).querySelector(".feuille-bouton-fermer"));
  t("croix (« plus tard ») : fenêtre fermée mais la nouveauté n'est PAS marquée comme vue", !feuille(w) && nonVue(w));
  w = page("Index.html", stock, "", null, sansCle); await attendre(1400);
  t("session suivante : elle est reproposée", !!feuille(w) && /Nouveautés/.test(feuille(w).textContent));

  // vue partielle : seule la plus récente reste à annoncer
  w = page("Index.html", stock, "", null, (win) => win.localStorage.setItem(CLE, L[1].id)); await attendre(1400);
  f = feuille(w);
  t("vue partielle : seule la nouveauté plus récente que la dernière vue est annoncée (une seule, sans navigation)", !!f && f.querySelector(".nouv-titre").textContent === L[0].titre && !f.querySelector(".nouv-nav") && /Nouveauté/.test(f.querySelector(".feuille-titre").textContent) && !/\(\d\)/.test(f.querySelector(".feuille-titre").textContent));
  w = page("Index.html", stock, "", null, (win) => win.localStorage.setItem(CLE, "ancienne-annonce-disparue")); await attendre(1400);
  t("identifiant inconnu (annonce retirée de la liste) : on annonce tout plutôt que rien", !!feuille(w) && /Nouveautés \(\d\)/.test(feuille(w).textContent));

  // pendant l'animation d'ouverture : on patiente
  w = page("Index.html", stock, "", null, (win) => { win.localStorage.removeItem(CLE); win.addEventListener("DOMContentLoaded", () => win.document.documentElement.classList.add("splash-actif")); });
  await attendre(1500);
  t("animation d'ouverture en cours : aucune fenêtre", !feuille(w));
  w.document.documentElement.classList.remove("splash-actif"); await attendre(1000);
  t("animation terminée : la fenêtre s'ouvre ensuite", !!feuille(w));

  // menu du profil : historique complet, compteur, jamais « tout vu » par accident
  w = page("Index.html", stock, "", null, sansCle); await attendre(300);
  clic(w.document.querySelector(".entete-avatar"));
  const item = w.document.querySelector("[data-nouveautes]");
  t("menu du profil : entrée « 🎁 Nouveautés » avec le nombre de nouveautés non vues", !!item && /Nouveautés/.test(item.textContent) && item.querySelector(".menu-avatar-pastille").textContent === String(L.length));
  clic(item);
  f = feuille(w);
  t("menu du profil : ouvre l'historique complet (bouton « Fermer », pas « Compris »), rien n'est marqué tant qu'il est ouvert", !!f && !!f.querySelector("[data-nouv-compris]") && f.querySelector("[data-nouv-compris]").textContent === "Fermer" && /Nouveauté/.test(f.textContent) && nonVue(w));
  clic(f.querySelector("[data-nouv-compris]"));
  t("« Fermer » ferme l'historique ; l'avoir consulté la marque comme vue (elle ne reviendra pas en annonce)", !feuille(w) && w.localStorage.getItem(CLE) === L[0].id);
  w = page("Index.html", stock, "", null, (win) => win.localStorage.setItem(CLE, L[0].id)); await attendre(300);
  clic(w.document.querySelector(".entete-avatar"));
  t("tout vu : l'entrée reste dans le menu, sans pastille de compteur", !!w.document.querySelector("[data-nouveautes]") && !w.document.querySelector("[data-nouveautes] .menu-avatar-pastille"));
  clic(w.document.querySelector("[data-nouveautes]"));
  t("tout vu : l'historique complet reste consultable", !!feuille(w) && new RegExp("/" + L.length).test(feuille(w).textContent));

  // toutes les pages portent le module (l'annonce peut s'afficher sur n'importe laquelle)
  t("toutes les pages de l'application chargent Nouveautes.js", fs.readdirSync(racine).filter(x => /\.html$/.test(x) && x !== "404.html").every(p => /Js\/Nouveautes\.js/.test(fs.readFileSync(path.join(racine, p), "utf8"))));
};
