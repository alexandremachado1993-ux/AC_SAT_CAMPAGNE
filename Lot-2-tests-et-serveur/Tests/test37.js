/* Planning : tableau de bord (vue par défaut) — chiffres, pourcentages à 100, calendrier, périodes, techniciens, filtres, analyses. Date figée : mardi 6 octobre 2026. */
const fs = require("fs");
const path = require("path");
module.exports = async function ({ page, t }) {
  const clic = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
  const saisir = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event("input", { bubbles: true })); };
  const choisir = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
  const FIGE = new Date(2026, 9, 6, 10, 0, 0).getTime();
  const figer = (win) => { const Vrai = win.Date; class Faux extends Vrai { constructor(...a) { if (a.length) super(...a); else super(FIGE); } static now() { return FIGE; } } win.Date = Faux; };
  const txt = (el) => el.textContent.replace(/\s+/g, " ").trim();
  const feuille = (w) => w.document.querySelector(".feuille:not([hidden])");

  // ---------- Jeu de données (aujourd'hui = 2026-10-06)
  const wd = page("Index.html", null, "", null, figer); const D = wd.Donnees;
  const A = D.ajouterClient({ nom: "Alpha", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const B = D.ajouterClient({ nom: "Bravo", ville: "Pau", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const a1 = D.enregistrerLigne(A.id, { nom: "L1", formatHabituel: "1/2M" }), a2 = D.enregistrerLigne(A.id, { nom: "L2", formatHabituel: "1/4" });
  const b1 = D.enregistrerLigne(B.id, { nom: "L1", formatHabituel: "4/4" }), b2 = D.enregistrerLigne(B.id, { nom: "L2", formatHabituel: "4/4" });
  const visite = (c, l, date) => D.enregistrerVisite({ clientId: c.id, ligneId: l.id, date, type: "campagne" });
  visite(A, a1, "2026-09-10"); visite(A, a2, "2026-10-02"); visite(B, b2, "2026-10-05");
  D.enregistrerRdv({ clientId: A.id, date: "2026-10-09", type: "campagne", ligneIds: [a1.id] });
  const stock = wd.localStorage.getItem("acsc_donnees_v1");
  const ouvrir = (avant) => page("Planning.html", stock, "#tableau", null, (win) => { figer(win); if (avant) avant(win); });

  let w = ouvrir(); let d = w.document;
  const carte = (lib) => Array.from(d.querySelectorAll(".pt-droite .pt-carte")).find(c => txt(c.querySelector(".pt-carte-libelle")) === lib);
  const valeur = (lib) => txt(carte(lib).querySelector(".pt-carte-valeur"));
  const pct = (lib) => { const e = carte(lib).querySelector(".pt-pct"); return e ? txt(e) : ""; };
  const legende = () => Array.from(d.querySelectorAll(".pt-synthese .pt-legende li")).map(li => ({ nom: txt(li.querySelector(".pt-legende-nom")), n: Number(txt(li.querySelector("strong"))), pct: parseInt(txt(li.querySelector(".pt-pct")), 10) }));
  const somme = () => legende().reduce((s, x) => s + x.pct, 0);
  const jour = (iso) => d.querySelector('.pt-num[data-jour="' + iso + '"]');
  const cellule = (iso) => jour(iso).closest("td");

  // ---------- Structure et vue par défaut
  t("tableau de bord : c'est la vue par défaut du code (etat.vue = « tableau »), la timeline et la grille restent des vues secondaires", /vue: "tableau",/.test(fs.readFileSync(path.join(__dirname, "..", "Js", "Planning.js"), "utf8")));
  t("tableau de bord : titre « Planning d'interventions » et sous-titre « Tableau de bord • Octobre 2026 »", /Planning d'interventions/.test(txt(d.querySelector("h1"))) && /Tableau de bord • Octobre 2026/.test(txt(d.querySelector(".entete-page"))));
  t("tableau de bord : trois vues (Tableau de bord actif, Timeline, Mois), boutons Planifier, Filtres et Compte rendu", Array.from(d.querySelectorAll(".pt-vues .bascule-vue-bouton")).map(txt).join("|") === "Tableau de bord|Timeline|Mois" && d.querySelector(".pt-vues .actif").textContent === "Tableau de bord" && !!d.querySelector("[data-planifier]") && !!d.querySelector("[data-filtres]") && !!d.querySelector("[data-exporter]"));
  t("tableau de bord : calendrier, synthèse (5 cartes + période), barre de statut, résumé et analyses présents", !!d.querySelector(".pt-mois") && d.querySelectorAll(".pt-droite .pt-carte").length === 6 && !!d.querySelector(".pt-barre") && !!d.querySelector(".pt-analyses"));
  t("filtres : le sélecteur « Client » disparaît (la recherche le remplace) mais Région, Département, Production et Type de visite restent", !d.getElementById("pf-client") && !!d.getElementById("pf-recherche") && !!d.getElementById("pf-region") && !!d.getElementById("pf-departement") && !!d.getElementById("pf-production") && !!d.getElementById("pf-type"));
  t("hors équipe : pas de panneau « Techniciens » (rien à choisir), la mise en page s'adapte", !d.querySelector(".pt-tech") && !!d.querySelector(".pt-page--sans-tech"));

  // ---------- Chiffres d'octobre 2026 (mois en cours) et pourcentages
  t("octobre : 2 réalisées · 1 planifiée · 1 en retard · 2 échéances, total 6", valeur("Réalisées") === "2" && valeur("Planifiées") === "1" && valeur("En retard") === "1" && valeur("Échéances à venir") === "2" && valeur("Total visites prévues") === "6");
  t("octobre : 33 % · 17 % · 17 % · 33 % — la somme fait 100 (et non 165 comme sur la maquette)", pct("Réalisées") === "33 %" && pct("Planifiées") === "17 %" && pct("En retard") === "17 %" && pct("Échéances à venir") === "33 %" && somme() === 100);
  t("barre de statut : légende (nom, nombre, pourcentage), segments proportionnels, texte « Total : 6 visites · 100 % »", legende().map(x => x.nom + x.n).join() === "Réalisées2,Planifiées1,En retard1,Échéances à venir2" && /Total : 6 visites · 100 %/.test(txt(d.querySelector(".pt-synthese"))) && Array.from(d.querySelectorAll(".pt-barre span")).map(s => parseInt(s.style.width, 10)).reduce((x, y) => x + y, 0) === 100);
  t("barre de statut : lisible par un lecteur d'écran (role=img, répartition en toutes lettres)", /Répartition : Réalisées 2 \(33 %\), Planifiées 1 \(17 %\), En retard 1 \(17 %\), Échéances à venir 2 \(33 %\)/.test(d.querySelector(".pt-barre").getAttribute("aria-label")));
  t("évolution : « Réalisées » et « En retard » comparées au mois précédent, jamais pour les catégories à venir", /vs mois précédent/.test(txt(carte("Réalisées"))) && /vs mois précédent/.test(txt(carte("En retard"))) && !/vs/.test(txt(carte("Planifiées"))) && !/vs/.test(txt(carte("Échéances à venir"))));
  t("évolution : octobre 2 réalisées contre 1 en septembre → « ▲ +1 » ; retard 1 contre 4 à la fin de septembre → « ▼ −3 »", /▲ \+1/.test(txt(carte("Réalisées"))) && /▼ −3/.test(txt(carte("En retard"))));
  t("chaque carte explique son calcul au survol (title)", Array.from(d.querySelectorAll(".pt-droite .pt-carte:not(.pt-carte--periode)")).every(c => (c.getAttribute("title") || "").length > 20));

  // ---------- Calendrier d'octobre
  t("calendrier : 5 semaines lundi → dimanche, aujourd'hui (6) marqué, jours des mois voisins grisés", d.querySelectorAll(".pt-mois tbody tr").length === 5 && jour("2026-10-06").getAttribute("aria-current") === "date" && cellule("2026-10-06").classList.contains("pt-cell--aujourdhui") && cellule("2026-09-28").classList.contains("pt-cell--hors"));
  const puces = (iso) => Array.from(cellule(iso).querySelectorAll(".pt-puce")).map(p => txt(p.querySelector(".pt-puce-texte")));
  t("calendrier : visite réalisée le 2 (Alpha) et le 5 (Bravo) ; rendez-vous le 9 « Planifié » ; échéances le 16 et le 19", puces("2026-10-02")[0].startsWith("Alpha — ") && puces("2026-10-05")[0].startsWith("Bravo — ") && puces("2026-10-09")[0] === "Alpha — Planifié" && puces("2026-10-16")[0] === "Alpha — Échéance" && puces("2026-10-19")[0] === "Bravo — Échéance");
  t("calendrier : la ligne jamais vue (Bravo L1) est posée aujourd'hui, en « Jamais vue » ; la ligne Alpha L1, en retard mais avec un rendez-vous le 9, n'est PAS comptée deux fois", puces("2026-10-06")[0] === "Bravo — Jamais vue" && d.querySelectorAll(".pt-puce--retard").length === 1);
  t("calendrier : couleurs de l'application (vert réalisée, violet planifié, rouge retard, orange échéance)", /--c:#16a34a/.test(cellule("2026-10-02").querySelector(".pt-puce").getAttribute("style")) && /--c:#7c3aed/.test(cellule("2026-10-09").querySelector(".pt-puce").getAttribute("style")) && /--c:#dc2626/.test(cellule("2026-10-06").querySelector(".pt-puce").getAttribute("style")) && /--c:#f97316/.test(cellule("2026-10-16").querySelector(".pt-puce").getAttribute("style")));
  t("calendrier : chaque jour a un nom accessible complet (« vendredi 9 octobre : 1 planifiée »)", jour("2026-10-09").getAttribute("aria-label") === "vendredi 9 octobre : 1 planifiée" && /rien de prévu/.test(jour("2026-10-13").getAttribute("aria-label")));

  // ---------- Navigation et périodes
  clic(d.querySelector('[data-pt-nav="1"]'));
  t("période suivante : novembre 2026 (aucune donnée → total 0, « Aucune visite sur cette période », pas de pourcentage)", /Novembre 2026/.test(txt(d.querySelector(".pt-titre"))) && valeur("Total visites prévues") === "0" && /Aucune visite sur cette période/.test(txt(d.querySelector(".pt-synthese"))) && pct("Réalisées") === "");
  clic(d.querySelector('[data-pt-nav="-1"]')); clic(d.querySelector('[data-pt-nav="-1"]'));
  t("septembre (PASSÉ) : 1 réalisée et 4 en retard (l'état exact à la FIN de septembre, calculé à cette date), 0 planifiée, 0 échéance → 20 % · 0 · 80 % · 0", valeur("Réalisées") === "1" && valeur("En retard") === "4" && valeur("Planifiées") === "0" && valeur("Échéances à venir") === "0" && pct("Réalisées") === "20 %" && pct("En retard") === "80 %" && somme() === 100);
  clic(d.querySelector('[data-pt-nav="0"]'));
  t("« Aujourd'hui » ramène à octobre 2026 et ses chiffres", /Octobre 2026/.test(txt(d.querySelector(".pt-titre"))) && valeur("Total visites prévues") === "6");
  choisir(w, d.getElementById("pt-gran"), "semaine");
  t("semaine : « Semaine 41 · 5 oct. – 11 oct. 2026 », 7 jours, 1 réalisée · 1 planifiée · 1 en retard · 0 échéance → 34 % · 33 % · 33 % · 0 %", /Semaine 41 · 5 oct\. – 11 oct\. 2026/.test(txt(d.querySelector(".pt-titre"))) && d.querySelectorAll(".pt-mois tbody tr").length === 1 && d.querySelectorAll(".pt-mois tbody td").length === 7 && valeur("Total visites prévues") === "3" && pct("Réalisées") === "34 %" && pct("Planifiées") === "33 %" && pct("En retard") === "33 %" && pct("Échéances à venir") === "0 %" && somme() === 100);
  t("semaine : tout est affiché dans les cases (pas de « +N autres »)", !d.querySelector(".pt-plus"));
  choisir(w, d.getElementById("pt-gran"), "trimestre");
  t("trimestre : « T4 2026 · oct. – déc. », trois mini-mois, mêmes chiffres qu'octobre (tout y est), somme 100", /T4 2026 · oct\. – déc\./.test(txt(d.querySelector(".pt-titre"))) && d.querySelectorAll(".pt-mini").length === 3 && valeur("Total visites prévues") === "6" && somme() === 100);
  t("trimestre : les jours à événements portent des repères colorés, jamais seulement la couleur (nom accessible)", !!d.querySelector('.pt-mini-jour[data-jour="2026-10-09"] .pt-points i') && /1 planifiée/.test(d.querySelector('.pt-mini-jour[data-jour="2026-10-09"]').getAttribute("aria-label")));
  choisir(w, d.getElementById("pt-gran"), "annee");
  t("année 2026 : douze mini-mois, 3 réalisées · 1 planifiée · 1 en retard · 2 échéances → 43 % · 14 % · 14 % · 29 %", d.querySelectorAll(".pt-mini").length === 12 && valeur("Total visites prévues") === "7" && pct("Réalisées") === "43 %" && pct("Planifiées") === "14 %" && pct("En retard") === "14 %" && pct("Échéances à venir") === "29 %" && somme() === 100 && /vs an dernier/.test(txt(carte("Réalisées"))));
  clic(d.querySelector('[data-pt-zoom="2026-09-01"]'));
  t("cliquer le titre d'un mini-mois ouvre ce mois (septembre) en vue mensuelle", /Septembre 2026/.test(txt(d.querySelector(".pt-titre"))) && !!d.querySelector(".pt-mois") && d.getElementById("pt-gran").value === "mois");
  clic(d.querySelector('[data-pt-nav="0"]')); choisir(w, d.getElementById("pt-gran"), "mois");

  // ---------- Liste
  clic(d.querySelector('[data-pt-affichage="liste"]'));
  t("affichage Liste : événements du mois par jour (pas de grille), bouton Liste actif et annoncé (aria-pressed)", !d.querySelector(".pt-mois") && d.querySelectorAll(".pt-liste .pt-ligne").length === 6 && d.querySelector('[data-pt-affichage="liste"]').getAttribute("aria-pressed") === "true");
  clic(d.querySelector('[data-pt-affichage="calendrier"]'));
  t("retour au calendrier", !!d.querySelector(".pt-mois") && !d.querySelector(".pt-liste"));

  // ---------- Détail d'un jour (feuille)
  clic(jour("2026-10-09"));
  let f = feuille(w);
  t("jour avec rendez-vous (vendredi 9 octobre) : fenêtre avec le client (lien vers sa fiche), « Planifiée », et « Planifier un rendez-vous ce jour » (date à venir)", !!f && /Vendredi 9 octobre/.test(txt(f.querySelector(".feuille-titre"))) && /Alpha/.test(txt(f)) && /Planifiée/.test(txt(f)) && f.querySelector('a[href^="Client.html?id="]').getAttribute("href") === "Client.html?id=" + encodeURIComponent(A.id) && !!f.querySelector("[data-pt-rdv-jour]"));
  f.querySelector(".feuille-bouton-fermer").click();
  clic(jour("2026-10-06")); f = feuille(w);
  t("jour avec une ligne jamais vue : bouton « Planifier » propre à cette ligne", !!f.querySelector('[data-pt-planifier="l:' + b1.id + '"]') && /Jamais vue/.test(txt(f)));
  f.querySelector(".feuille-bouton-fermer").click();
  clic(jour("2026-10-02")); f = feuille(w);
  t("jour passé : détail sans « Planifier un rendez-vous ce jour » (on ne planifie pas dans le passé)", !!f && /Alpha/.test(txt(f)) && !f.querySelector("[data-pt-rdv-jour]"));
  f.querySelector(".feuille-bouton-fermer").click();
  clic(jour("2026-10-13")); f = feuille(w);
  t("jour vide : message clair, avec la possibilité de planifier si la date est à venir", /Rien de prévu/.test(txt(f)) && !!f.querySelector("[data-pt-rdv-jour]"));
  f.querySelector(".feuille-bouton-fermer").click();

  // ---------- Filtres : tout se recalcule, et la somme reste à 100
  saisir(w, d.getElementById("pf-recherche"), "Bravo");
  t("recherche « Bravo » : 1 réalisée · 0 planifiée · 1 en retard · 1 échéance → 34 % · 0 % · 33 % · 33 %, toujours 100", valeur("Total visites prévues") === "3" && valeur("Réalisées") === "1" && valeur("Planifiées") === "0" && pct("Réalisées") === "34 %" && pct("Planifiées") === "0 %" && somme() === 100);
  saisir(w, d.getElementById("pf-recherche"), "zzz");
  t("recherche sans résultat : zéros, « Aucun client ne correspond aux filtres », pas de « NaN »", valeur("Total visites prévues") === "0" && /Aucun client ne correspond/.test(txt(d.querySelector("#contenu-page"))) && !/NaN/.test(txt(d.querySelector("#contenu-page"))));
  clic(d.querySelector("[data-effacer-filtres]"));
  t("« Réinitialiser » rétablit tout", valeur("Total visites prévues") === "6");
  choisir(w, d.getElementById("pf-type"), "maintenance");
  t("type de visite « maintenance » : les visites et rendez-vous de campagne sortent du calcul, la somme reste 100 (ou 0)", valeur("Réalisées") === "0" && valeur("Planifiées") === "0" && (somme() === 100 || valeur("Total visites prévues") === "0"));
  clic(d.querySelector("[data-effacer-filtres]"));

  // ---------- Résumé et analyses
  t("anneau : 4 arcs (un par catégorie), total 6 au centre, décrit en toutes lettres", d.querySelectorAll(".pt-donut circle").length === 4 && txt(d.querySelector(".pt-donut-total")) === "6" && /Visites prévues : Réalisées 2 \(33 %\)/.test(d.querySelector(".pt-donut svg").getAttribute("aria-label")));
  t("trois graphiques mensuels de 12 colonnes (réalisées, en retard, prochaines échéances), colonnes du mois affiché en pleine couleur", d.querySelectorAll(".pt-graphe").length === 3 && Array.from(d.querySelectorAll(".pt-graphe")).every(g => g.querySelectorAll(".pt-col").length === 12) && d.querySelectorAll(".pt-graphe")[0].querySelectorAll(".pt-col--courante").length === 1);
  const g0 = d.querySelectorAll(".pt-graphe")[0].querySelector(".pt-colonnes").getAttribute("aria-label"), g1 = d.querySelectorAll(".pt-graphe")[1].querySelector(".pt-colonnes").getAttribute("aria-label"), g2 = d.querySelectorAll(".pt-graphe")[2].querySelector(".pt-colonnes").getAttribute("aria-label");
  t("graphiques : réalisées sept. 1 et oct. 2 ; retard HISTORIQUE sept. 4 puis oct. 1 ; échéances seulement à partir d'octobre (oct. 2)", /sept\. 1, oct\. 2/.test(g0) && /sept\. 4, oct\. 1/.test(g1) && /août 0, sept\. 0, oct\. 2/.test(g2) && /en 2026/.test(g0));
  t("« Prochaine action » : priorité aux retards (« 1 ligne ou rendez-vous en retard à traiter en priorité »)", /1 ligne ou rendez-vous en retard à traiter en priorité/.test(txt(d.querySelector(".pt-action"))));
  t("analyses : la « Période affichée » est rappelée", /Octobre 2026/.test(txt(d.querySelector(".pt-analyses .pt-carte--periode"))));

  // ---------- Autres vues et retour
  clic(d.querySelector('[data-vue="timeline"]'));
  t("vue Timeline : toujours là (frise), avec le sélecteur « Client » et un bouton « Tableau de bord » pour revenir", !!d.querySelector(".tl-grille") && !!d.getElementById("pf-client") && !!d.querySelector('.bascule-vue [data-vue="tableau"]'));
  clic(d.querySelector('[data-vue="tableau"]'));
  t("retour au tableau de bord : même période, mêmes chiffres", !!d.querySelector(".pt-mois") && valeur("Total visites prévues") === "6");
  clic(d.querySelector('[data-vue="mois"]'));
  t("vue Mois (grille client × mois) : toujours là", !!d.querySelector(".pl-table") || !!d.querySelector("table"));
  clic(d.querySelector('[data-vue="tableau"]'));
  clic(d.querySelector("[data-exporter]"));
  t("« Compte rendu » fonctionne depuis le tableau de bord (fenêtre d'export)", !!feuille(w));
  feuille(w).querySelector(".feuille-bouton-fermer").click();

  // ---------- Une donnée qui change : le tableau se met à jour en gardant la période
  clic(d.querySelector('[data-pt-nav="1"]')); w.Donnees.enregistrerRdv({ clientId: A.id, date: "2026-11-12", type: "campagne", ligneIds: [a2.id] });
  t("une nouvelle donnée met le tableau à jour SANS quitter la période choisie (novembre : 1 planifiée)", /Novembre 2026/.test(txt(d.querySelector(".pt-titre"))) && valeur("Planifiées") === "1" && pct("Planifiées") === "100 %");

  // ---------- Équipe : panneau « Techniciens » repliable
  w = ouvrir((win) => {}); d = w.document;
  w.Synchro.membresEquipe = () => [{ id: "u1", nom: "Alexandre", moi: true }, { id: "u2", nom: "Damien" }];
  const def = w.Donnees.definirTechnicienCourant || w.Donnees.fixerTechnicienCourant || w.Donnees.setTechnicienCourant;
  t("équipe : le technicien connecté se déclare (fonction du moteur)", typeof def === "function");
  def("u1");
  w.Donnees.ajouterClient({ nom: "Charlie", ville: "Dax", debutCampagne: 5, finCampagne: 11, cadenceJours: 14, technicien: "u2" });
  const tech = () => Array.from(d.querySelectorAll(".pt-tech-option")).map(b => txt(b.querySelector(".pt-tech-nom")) + ":" + txt(b.querySelector(".pt-tech-nb")));
  t("équipe : panneau « Techniciens » replié par défaut sur petit écran, bouton avec aria-expanded=false", !!d.querySelector(".pt-tech") && d.querySelector("[data-pt-panneau]").getAttribute("aria-expanded") === "false" && d.getElementById("pt-tech-liste").hidden && !!d.querySelector(".pt-page--tech-ferme"));
  clic(d.querySelector("[data-pt-panneau]"));
  t("équipe : le panneau s'ouvre ; options « Mes clients » (2), « Tous » (3), « Non attribués » (2), « Damien » (1)", d.querySelector("[data-pt-panneau]").getAttribute("aria-expanded") === "true" && !d.getElementById("pt-tech-liste").hidden && tech().join() === "Mes clients:2,Tous:3,Non attribués:2,Damien:1");
  t("équipe : le calendrier s'ouvre par défaut sur LE TECHNICIEN CONNECTÉ (« Mes clients » actif) ; le filtre Technicien de la barre disparaît (le panneau le remplace)", d.querySelector(".pt-tech-option.actif .pt-tech-nom").textContent === "Mes clients" && !d.getElementById("pf-technicien") && valeur("Total visites prévues") === "6");
  clic(d.querySelector('[data-pt-tech="u2"]'));
  t("clic sur « Damien » : le calendrier et les chiffres ne montrent que ses clients (aucune donnée → 0), le panneau reste ouvert et sélectionne Damien", d.querySelector(".pt-tech-option.actif .pt-tech-nom").textContent === "Damien" && valeur("Total visites prévues") === "0" && !d.getElementById("pt-tech-liste").hidden);
  clic(d.querySelector('[data-pt-tech=""]'));
  t("« Tous » : les trois clients (Alpha, Bravo, Charlie sans visite) ; chiffres de l'équipe", d.querySelector(".pt-tech-option.actif .pt-tech-nom").textContent === "Tous" && valeur("Total visites prévues") === "6");
  clic(d.querySelector("[data-pt-panneau]"));
  t("le panneau se referme (et le bouton l'annonce) ; la sélection est conservée", d.querySelector("[data-pt-panneau]").getAttribute("aria-expanded") === "false" && d.getElementById("pt-tech-liste").hidden);
  clic(d.querySelector('[data-vue="timeline"]'));
  t("vue Timeline en équipe : le sélecteur Technicien d'origine est toujours là (aucune régression)", !!d.getElementById("pf-technicien"));

  // ---------- Aucun client
  const vide = page("Planning.html", null, "#tableau", null, figer);
  t("aucun client : message d'accueil, pas de calendrier, pas d'erreur", /Le planning se remplira/.test(vide.document.body.textContent) && !vide.document.querySelector(".pt-mois"));

  // ---------- Style (le simulateur ne charge pas les feuilles de style : on contrôle les règles)
  const css = fs.readFileSync(path.join(__dirname, "..", "CSS", "campagne.css"), "utf8");
  t("style : le panneau replié se masque vraiment (« [hidden] » prime sur « display: flex »)", /\.pt-tech-liste\[hidden\] \{ display: none; \}/.test(css) && /\.pt-tech-liste \{ display: flex;/.test(css));
  t("style : trois colonnes sur ordinateur (techniciens · calendrier · synthèse), une colonne sur téléphone, chaque colonne dans un minmax(0, …)", /@media \(min-width: 1100px\)[\s\S]*?\.pt-page \{ grid-template-columns: 15rem minmax\(0, 1fr\) 21rem; \}/.test(css) && /\.pt-page \{ display: grid; grid-template-columns: minmax\(0, 1fr\);/.test(css));
  t("style : sur téléphone les pastilles deviennent des points et le jour entier reste touchable (44 px mini pour les boutons d'en-tête)", /@media \(max-width: 700px\)[\s\S]*?\.pt-puce-texte, \.pt-plus \{ display: none; \}/.test(css) && /\.pt-nav-bouton \{ width: 44px; height: 44px;/.test(css));
  t("style : couleurs via les variables de l'application (thème clair et sombre) — aucune couleur écrite en dur dans les règles du tableau de bord", !(css.slice(css.indexOf("/* ---------- Planning › Tableau de bord"), css.indexOf("/* >>> GENERE-DEBUT")).split("\n").filter(l => /#[0-9a-fA-F]{3,8}\b/.test(l)).length));
};
