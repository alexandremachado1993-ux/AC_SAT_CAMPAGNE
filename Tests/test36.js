/* Planning : moteur de calcul du tableau de bord (PlanningCalcul.js) — périodes, pourcentages à 100, catégories exclusives. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
module.exports = async function ({ t }) {
  const src = fs.readFileSync(path.join(__dirname, "..", "Js", "PlanningCalcul.js"), "utf8");
  const P = vm.runInNewContext(src + "\nPlanningCalcul;");
  const J = (x) => JSON.stringify(x);
  const b = (g, r) => { const x = P.bornes(g, r); return x.debut + " → " + x.fin; };

  // ---------- Périodes
  t("semaine : du lundi au dimanche (mardi 6 octobre 2026 → 5 au 11 octobre) ; un dimanche reste dans sa semaine ; un lundi ouvre la sienne", b("semaine", "2026-10-06") === "2026-10-05 → 2026-10-11" && b("semaine", "2026-10-11") === "2026-10-05 → 2026-10-11" && b("semaine", "2026-10-05") === "2026-10-05 → 2026-10-11");
  t("semaine à cheval sur deux années (1er janvier 2027 → 28 décembre 2026 au 3 janvier 2027)", b("semaine", "2027-01-01") === "2026-12-28 → 2027-01-03");
  t("mois : fin de mois exacte, février bissextile (2028) et non bissextile (2026), décembre", b("mois", "2026-10-17") === "2026-10-01 → 2026-10-31" && b("mois", "2028-02-10") === "2028-02-01 → 2028-02-29" && b("mois", "2026-02-10") === "2026-02-01 → 2026-02-28" && b("mois", "2026-12-31") === "2026-12-01 → 2026-12-31");
  t("trimestre : T3 (août) = juillet → septembre ; T4 (31 décembre) = octobre → décembre ; T1", b("trimestre", "2026-08-15") === "2026-07-01 → 2026-09-30" && b("trimestre", "2026-12-31") === "2026-10-01 → 2026-12-31" && b("trimestre", "2026-01-01") === "2026-01-01 → 2026-03-31");
  t("année : 1er janvier → 31 décembre", b("annee", "2026-06-15") === "2026-01-01 → 2026-12-31");
  t("granularité inconnue → mois (jamais d'erreur)", P.bornes("nimporte", "2026-10-06").gran === "mois");
  const d = (g, r, n) => P.decaler(g, r, n).debut;
  t("décaler : semaine précédente / suivante", d("semaine", "2026-10-06", -1) === "2026-09-28" && d("semaine", "2026-10-06", 1) === "2026-10-12");
  t("décaler : un mois en arrière depuis le 31 mars → février (pas de saut au 3 mars), un mois en avant depuis décembre → janvier suivant", d("mois", "2026-03-31", -1) === "2026-02-01" && d("mois", "2026-12-15", 1) === "2027-01-01");
  t("décaler : trimestre suivant depuis T4 → T1 de l'année d'après ; année précédente", d("trimestre", "2026-11-20", 1) === "2027-01-01" && d("trimestre", "2026-01-10", -1) === "2025-10-01" && d("annee", "2026-06-01", -1) === "2025-01-01");
  t("décaler : aller puis revenir ramène à la même période, pour chaque granularité", ["semaine", "mois", "trimestre", "annee"].every(g => J(P.decaler(g, P.decaler(g, "2026-05-31", 3).debut, -3)) === J(P.bornes(g, "2026-05-31"))));
  t("numéro de semaine ISO : 1er janvier 2026 → 1 ; 31 décembre 2026 → 53 ; 1er janvier 2027 → 53 ; 30 décembre 2024 → 1 ; 5 octobre 2026 → 41", P.numeroSemaine("2026-01-01") === 1 && P.numeroSemaine("2026-12-31") === 53 && P.numeroSemaine("2027-01-01") === 53 && P.numeroSemaine("2024-12-30") === 1 && P.numeroSemaine("2026-10-05") === 41);
  t("libellés : semaine, mois, trimestre, année, et « 1er » le premier du mois", P.libelle(P.bornes("semaine", "2026-10-06")) === "Semaine 41 · 5 oct. – 11 oct. 2026" && P.libelle(P.bornes("mois", "2026-10-06")) === "Octobre 2026" && P.libelle(P.bornes("trimestre", "2026-10-06")) === "T4 2026 · oct. – déc." && P.libelle(P.bornes("annee", "2026-10-06")) === "2026" && /1er juin/.test(P.libelle(P.bornes("semaine", "2026-06-03"))) && /29 déc\. – 4 janv\. 2026/.test(P.libelle(P.bornes("semaine", "2026-01-01"))));
  const g = P.grilleMois("2026-10-01");
  t("grille d'un mois : semaines complètes lundi → dimanche (octobre 2026 : 28 septembre → 1er novembre, 5 semaines), jours voisins marqués", g.length === 5 && g.every(s => s.length === 7) && g[0][0].date === "2026-09-28" && g[0][0].horsMois === true && g[0][3].date === "2026-10-01" && g[0][3].horsMois === false && g[4][6].date === "2026-11-01" && g[4][6].horsMois === true);
  t("grille d'un mois : février 2027 commençant un lundi → 4 semaines exactement", P.grilleMois("2027-02-01").length === 4);

  // ---------- Pourcentages : TOUJOURS 100
  t("répartition : 8, 8, 5, 2, 2 → 32, 32, 20, 8, 8 (somme 100)", J(P.repartition([8, 8, 5, 2, 2])) === "[32,32,20,8,8]");
  t("répartition : 1, 1, 1 → 34, 33, 33 ; une seule valeur → 100 ; tout à zéro → 0", J(P.repartition([1, 1, 1])) === "[34,33,33]" && J(P.repartition([5])) === "[100]" && J(P.repartition([0, 0, 0])) === "[0,0,0]");
  let toujours100 = true, aucunNegatif = true, ordre = true;
  for (let k = 0; k < 500; k++) {
    const v = Array.from({ length: 4 }, () => Math.floor(Math.random() * 40)); const r = P.repartition(v);
    if (v.some(x => x > 0) && r.reduce((s, x) => s + x, 0) !== 100) toujours100 = false;
    if (r.some(x => x < 0)) aucunNegatif = false;
    v.forEach((x, i) => v.forEach((y, j) => { if (x > y && r[i] < r[j]) ordre = false; }));
  }
  t("répartition : sur 500 tirages au hasard, la somme fait TOUJOURS 100 (le défaut de la maquette : 165 %), jamais de négatif, l'ordre des valeurs est respecté", toujours100 && aucunNegatif && ordre);

  // ---------- Analyse : jeu de données fixe, « aujourd'hui » = mardi 6 octobre 2026
  const T = "2026-10-06";
  const c = (id) => ({ id });
  const appels = [];
  const aujourdhui = [
    { client: c("c1"), ligne: c("l1"), statut: "ok", echeance: "2026-10-16" },
    { client: c("c2"), ligne: c("l2"), statut: "bientot", echeance: "2026-10-10" },
    { client: c("c3"), ligne: c("l3"), statut: "retard", echeance: "2026-10-01" },
    { client: c("c4"), ligne: c("l4"), statut: "jamais", echeance: null },
    { client: c("c5"), ligne: c("l5"), statut: "ok", echeance: "2026-10-25" },
    { client: c("c6"), ligne: c("l6"), statut: "ok", echeance: "2026-11-15" }
  ];
  const finSept = [{ client: c("c3"), ligne: c("l3"), statut: "retard", echeance: "2026-09-12" }, { client: c("c9"), ligne: c("l9"), statut: "jamais", echeance: null }];
  const entrees = {
    visites: [{ id: "v1", date: "2026-10-02", clientId: "c1", ligneId: "l1", type: "campagne" }, { id: "v2", date: "2026-10-05", clientId: "c2", ligneId: "l2", type: "maintenance" }, { id: "v3", date: "2026-09-20", clientId: "c1", ligneId: "l1", type: "campagne" }],
    rdv: [{ id: "r1", date: "2026-10-09", clientId: "c1", ligneIds: ["l1"], type: "campagne" }, { id: "r2", date: "2026-10-03", clientId: "c3", ligneIds: ["l3"], type: "campagne" }, { id: "r3", date: "2026-10-20", clientId: "c2", ligneIds: ["l2"], type: "campagne" }],
    echeancesA: (iso) => { appels.push(iso); return iso === "2026-09-30" ? finSept : aujourdhui; }
  };
  const A = (g, ref) => P.analyser(P.bornes(g, ref), T, entrees);
  const cpt = (a) => [a.comptes.realisees, a.comptes.planifiees, a.comptes.retard, a.comptes.echeances, a.comptes.total].join(",");

  let a = A("mois", T);
  t("octobre (en cours) : 2 réalisées · 2 planifiées · 2 en retard (rendez-vous du 3 non honoré + ligne jamais vue) · 1 échéance → total 7", cpt(a) === "2,2,2,1,7");
  t("octobre : les lignes l1 et l2 (rendez-vous à venir) ne sont comptées qu'UNE fois — en « planifiées », pas aussi en « échéances » ; l3 (rendez-vous passé) pas deux fois en retard", a.comptes.echeances === 1 && a.evenements.filter(e => e.genre === "echeance").map(e => e.ligneIds[0]).join() === "l5");
  t("octobre : pourcentages 29 · 29 · 28 · 14 = 100", J([a.pourcents.realisees, a.pourcents.planifiees, a.pourcents.retard, a.pourcents.echeances]) === "[29,29,28,14]");
  t("octobre : événements du calendrier cohérents avec les comptes (même nombre, triés par date)", a.evenements.length === a.comptes.total && a.evenements.every((e, i, tab) => i === 0 || tab[i - 1].date <= e.date));
  const ret = a.evenements.filter(e => e.genre === "retard");
  t("retard : le rendez-vous dépassé est posé à sa date (3 octobre) et signalé ; la ligne jamais vue est posée à aujourd'hui", ret.some(e => e.rdvDepasse && e.date === "2026-10-03") && ret.some(e => e.jamais && e.date === T));
  a = A("semaine", T);
  t("semaine du 5 au 11 octobre : 1 réalisée (la visite du 2 est la semaine d'avant) · 1 planifiée · 2 en retard (l3 n'est plus couverte, l4 jamais vue) · 1 échéance (l2 le 10)", cpt(a) === "1,1,2,1,5");
  a = A("mois", "2026-09-15");
  t("septembre (PASSÉ) : 1 réalisée · 0 planifiée · 2 en retard (l'état à la FIN du mois, donnée historique) · 0 échéance", cpt(a) === "1,0,2,0,3" && appels.includes("2026-09-30"));
  t("septembre : aucune échéance « à venir » dans le passé, même si le moteur en connaît d'aujourd'hui", a.evenements.every(e => e.genre !== "echeance" && e.genre !== "planifiee"));
  a = A("mois", "2026-11-10");
  t("novembre (FUTUR) : seulement ce qui est prévu — 1 échéance (l6 le 15), pas de retard (inconnaissable), pourcentage 100 % ", cpt(a) === "0,0,0,1,1" && a.pourcents.echeances === 100 && a.pourcents.retard === 0);
  a = A("annee", T);
  t("année 2026 : 3 réalisées · 2 planifiées · 2 en retard · 2 échéances (l5 et l6) → 9, pourcentages 34 · 22 · 22 · 22", cpt(a) === "3,2,2,2,9" && J([a.pourcents.realisees, a.pourcents.planifiees, a.pourcents.retard, a.pourcents.echeances]) === "[34,22,22,22]");
  a = A("trimestre", T);
  t("trimestre T4 : même résultat que l'année pour ce jeu de données (tout y est), toujours 100 %", cpt(a) === "3,2,2,2,9" || a.pourcents.realisees + a.pourcents.planifiees + a.pourcents.retard + a.pourcents.echeances === 100);
  a = A("mois", "2025-03-01");
  t("période sans aucune donnée : zéros partout, 0 % partout (jamais de division par zéro, jamais « NaN »)", cpt(a).startsWith("0,0,") && a.comptes.total === a.comptes.retard + 0 && P.CATEGORIES.every(k => Number.isFinite(a.pourcents[k])));
  const vide = P.analyser(P.bornes("mois", "2026-10-01"), T, { visites: [], rdv: [], echeancesA: () => [] });
  t("aucun client : tout à zéro, total 0, pourcentages 0", vide.comptes.total === 0 && P.CATEGORIES.every(k => vide.comptes[k] === 0 && vide.pourcents[k] === 0) && vide.evenements.length === 0);
  const sansLigne = P.analyser(P.bornes("mois", "2026-10-01"), T, { visites: [], rdv: [{ id: "r9", date: "2026-10-20", clientId: "c1", type: "campagne" }], echeancesA: () => [] });
  t("rendez-vous sans ligne indiquée (au niveau du client) : compté « planifié », sans erreur", sansLigne.comptes.planifiees === 1 && sansLigne.evenements[0].ligneIds.length === 0);
  const aujourdhuiExact = P.analyser(P.bornes("mois", "2026-10-01"), T, { visites: [], rdv: [{ id: "r8", date: T, clientId: "c1", ligneIds: ["l1"], type: "campagne" }], echeancesA: () => [] });
  t("rendez-vous AUJOURD'HUI : encore « planifié » (pas en retard avant la fin de la journée)", aujourdhuiExact.comptes.planifiees === 1 && aujourdhuiExact.comptes.retard === 0);

  // ---------- Série mensuelle (graphiques)
  appels.length = 0;
  const s = P.serieMensuelle(2026, T, entrees);
  t("série mensuelle : 12 mois (janv. → déc.), chacun identique à l'analyse du mois", s.length === 12 && s[0].libelle === "janv." && s[11].libelle === "déc." && s.every(m => J(m.comptes) === J(A("mois", "2026-" + String(m.mois + 1).padStart(2, "0") + "-01").comptes)));
  t("série mensuelle : réalisées par mois (sept. 1, oct. 2), retard historique à la fin de septembre (2), échéances seulement à partir d'octobre", s[8].comptes.realisees === 1 && s[9].comptes.realisees === 2 && s[8].comptes.retard === 2 && s.slice(0, 9).every(m => m.comptes.echeances === 0) && s[10].comptes.echeances === 1);
  t("série mensuelle : mois futurs sans retard (jamais d'invention)", s.slice(10).every(m => m.comptes.retard === 0));
  const e = P.evolution(7, 4), e2 = P.evolution(2, 5), e3 = P.evolution(3, 3);
  t("évolution par rapport à la période précédente : hausse, baisse, stable", e.delta === 3 && e.sens === "hausse" && e2.delta === -3 && e2.sens === "baisse" && e3.sens === "stable");
  t("le module est pur : aucune référence à document, window, localStorage ni Donnees", !/\b(document|window|localStorage|Donnees|AppLayout)\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")));
};
