/* =============================================================
   PlanningCalcul.js — Calculs du tableau de bord du Planning (fonctions pures)

   Aucune dépendance à l'écran ni aux données de l'application : tout est passé
   en paramètre, donc testable à part (Tests/test36.js).

   PÉRIODES : semaine (lundi → dimanche), mois, trimestre, année.

   QUATRE CATÉGORIES, qui s'EXCLUENT (le total fait toujours 100 %) :
     réalisées     visites effectuées dont la date tombe dans la période ;
     planifiées    rendez-vous à venir (aujourd'hui compris) dans la période ;
     en retard     lignes en retard (ou jamais vues) à la FIN de la période
                   (aujourd'hui si elle est en cours), plus les rendez-vous
                   passés qui n'ont pas été réalisés ;
     échéances     lignes à jour dont la prochaine visite tombe dans le
                   reste de la période.
   Une même ligne n'est comptée qu'UNE fois : une ligne qui a un rendez-vous
   dans la période est « planifiée », pas « en retard » ni « échéance ».
   Période passée : réalisées + en retard (état à sa fin) ; période future :
   planifiées + échéances. Le retard passé est exact : le moteur d'échéances
   ne regarde que les visites antérieures à la date de référence.
   ============================================================= */

const PlanningCalcul = (() => {
    "use strict";

    const GRANULARITES = ["semaine", "mois", "trimestre", "annee"];
    const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    const CATEGORIES = ["realisees", "planifiees", "retard", "echeances"];

    /* ---------- Dates (chaînes AAAA-MM-JJ, calculs en UTC : pas de piège d'heure d'été) ---------- */

    const parse = (iso) => { const [a, m, j] = iso.split("-").map(Number); return new Date(Date.UTC(a, m - 1, j)); };
    const fmt = (d) => d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
    const ajouter = (iso, n) => { const d = parse(iso); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
    const ecart = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
    const dans = (iso, p) => iso >= p.debut && iso <= p.fin;

    /* ---------- Périodes ---------- */

    function bornes(gran, ref) {
        const d = parse(ref), a = d.getUTCFullYear(), m = d.getUTCMonth();
        let debut, fin;
        if (gran === "semaine") { debut = ajouter(ref, -((d.getUTCDay() + 6) % 7)); fin = ajouter(debut, 6); }
        else if (gran === "trimestre") { const q = Math.floor(m / 3) * 3; debut = fmt(new Date(Date.UTC(a, q, 1))); fin = fmt(new Date(Date.UTC(a, q + 3, 0))); }
        else if (gran === "annee") { debut = a + "-01-01"; fin = a + "-12-31"; }
        else { gran = "mois"; debut = fmt(new Date(Date.UTC(a, m, 1))); fin = fmt(new Date(Date.UTC(a, m + 1, 0))); }
        return { gran, debut, fin };
    }

    /* Période voisine (n = -1 précédente, +1 suivante), même granularité. */
    function decaler(gran, ref, n) {
        const b = bornes(gran, ref), d = parse(b.debut);
        if (gran === "semaine") return bornes(gran, ajouter(b.debut, 7 * n));
        if (gran === "trimestre") d.setUTCMonth(d.getUTCMonth() + 3 * n);
        else if (gran === "annee") d.setUTCFullYear(d.getUTCFullYear() + n);
        else d.setUTCMonth(d.getUTCMonth() + n);
        return bornes(gran, fmt(d));
    }

    function numeroSemaine(iso) {          // semaine ISO 8601
        const d = parse(iso); const j = (d.getUTCDay() + 6) % 7;
        d.setUTCDate(d.getUTCDate() - j + 3);
        const premier = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
        return 1 + Math.round(((d - premier) / 86400000 - 3 + ((premier.getUTCDay() + 6) % 7)) / 7);
    }

    const jourMois = (iso) => { const d = parse(iso); return d.getUTCDate() + (d.getUTCDate() === 1 ? "er" : "") + " " + MOIS_COURTS[d.getUTCMonth()]; };
    const maj = (t) => t.charAt(0).toUpperCase() + t.slice(1);

    function libelle(p) {
        const a = parse(p.debut).getUTCFullYear(), m = parse(p.debut).getUTCMonth();
        if (p.gran === "semaine") return "Semaine " + numeroSemaine(p.debut) + " · " + jourMois(p.debut) + " – " + jourMois(p.fin) + " " + parse(p.fin).getUTCFullYear();
        if (p.gran === "trimestre") return "T" + (Math.floor(m / 3) + 1) + " " + a + " · " + MOIS_COURTS[m] + " – " + MOIS_COURTS[m + 2];
        if (p.gran === "annee") return String(a);
        return maj(MOIS[m]) + " " + a;
    }

    function jours(debut, fin) { const r = []; for (let j = debut; j <= fin; j = ajouter(j, 1)) r.push(j); return r; }

    /* Grille d'un mois : semaines complètes lundi → dimanche, avec les jours voisins marqués « horsMois ». */
    function grilleMois(debut) {
        const b = bornes("mois", debut), lundi = bornes("semaine", b.debut).debut;
        const fin = bornes("semaine", b.fin).fin, semaines = [];
        for (let j = lundi; j <= fin; j = ajouter(j, 7)) semaines.push(jours(j, ajouter(j, 6)).map(x => ({ date: x, horsMois: x < b.debut || x > b.fin })));
        return semaines;
    }

    /* ---------- Pourcentages qui font EXACTEMENT 100 (plus forts restes) ---------- */

    function repartition(valeurs) {
        const total = valeurs.reduce((s, v) => s + v, 0);
        if (!total) return valeurs.map(() => 0);
        const bruts = valeurs.map(v => v * 100 / total), bas = bruts.map(Math.floor);
        let reste = 100 - bas.reduce((s, v) => s + v, 0);
        bruts.map((b, i) => ({ i, r: b - bas[i] })).sort((x, y) => y.r - x.r || x.i - y.i).forEach(x => { if (reste > 0) { bas[x.i]++; reste--; } });
        return bas;
    }

    /* ---------- Analyse d'une période ----------
       entrees : {
         visites   [{ id, date, clientId, ligneId, type }]            visites EFFECTUÉES (déjà filtrées)
         rdv       [{ id, date, clientId, ligneIds[], type }]          rendez-vous non réalisés (déjà filtrés)
         echeancesA(iso) → [{ client:{id}, ligne:{id}, statut, echeance }]   moteur d'échéances à la date iso
       }
       Renvoie { periode, evenements[], comptes{realisees,planifiees,retard,echeances,total}, pourcents{…} }. */

    function analyser(periode, aujourdhui, entrees) {
        const T = aujourdhui, ev = [];
        const commence = periode.debut <= T, finie = periode.fin < T;
        const couvertes = new Set();                      // lignes déjà comptées par un rendez-vous de la période

        const realisees = entrees.visites.filter(v => dans(v.date, periode));
        realisees.forEach(v => ev.push({ date: v.date, genre: "realisee", clientId: v.clientId, ligneIds: v.ligneId ? [v.ligneId] : [], typeVisite: v.type, id: v.id }));

        let planifiees = 0, rdvDepasses = 0;
        entrees.rdv.filter(r => dans(r.date, periode)).forEach(r => {
            const passe = r.date < T;
            (r.ligneIds || []).forEach(id => couvertes.add(id));
            if (passe) rdvDepasses++; else planifiees++;
            ev.push({ date: r.date, genre: passe ? "retard" : "planifiee", clientId: r.clientId, ligneIds: r.ligneIds || [], typeVisite: r.type, id: r.id, rdvDepasse: passe });
        });

        let retardLignes = 0;
        if (commence) {
            const ref = finie ? periode.fin : T;
            entrees.echeancesA(ref).filter(e => e.statut === "retard" || e.statut === "jamais").forEach(e => {
                if (couvertes.has(e.ligne.id)) return;
                retardLignes++;
                /* Posé le jour de l'échéance manquée s'il est dans la période, sinon (retard plus ancien, ou jamais vue) au dernier jour utile. */
                const jour = e.echeance && dans(e.echeance, periode) ? e.echeance : (finie ? periode.fin : T);
                ev.push({ date: jour, genre: "retard", clientId: e.client.id, ligneIds: [e.ligne.id], jamais: e.statut === "jamais", echeance: e.echeance || null });
            });
        }

        let echeances = 0;
        if (periode.fin >= T) {
            entrees.echeancesA(T).filter(e => (e.statut === "ok" || e.statut === "bientot") && e.echeance && e.echeance >= T && dans(e.echeance, periode)).forEach(e => {
                if (couvertes.has(e.ligne.id)) return;
                echeances++;
                ev.push({ date: e.echeance, genre: "echeance", clientId: e.client.id, ligneIds: [e.ligne.id] });
            });
        }

        const comptes = { realisees: realisees.length, planifiees, retard: rdvDepasses + retardLignes, echeances };
        comptes.total = comptes.realisees + comptes.planifiees + comptes.retard + comptes.echeances;
        const p = repartition(CATEGORIES.map(k => comptes[k]));
        const pourcents = {}; CATEGORIES.forEach((k, i) => { pourcents[k] = p[i]; });
        ev.sort((a, b) => a.date.localeCompare(b.date) || a.genre.localeCompare(b.genre));
        return { periode, evenements: ev, comptes, pourcents };
    }

    /* Les douze mois d'une année : réalisées, retard (état à la fin de chaque mois) et échéances, pour les graphiques. */
    function serieMensuelle(annee, aujourdhui, entrees) {
        return Array.from({ length: 12 }, (_, m) => {
            const a = analyser(bornes("mois", annee + "-" + String(m + 1).padStart(2, "0") + "-01"), aujourdhui, entrees);
            return { mois: m, libelle: MOIS_COURTS[m], comptes: a.comptes };
        });
    }

    /* Évolution par rapport à la période précédente : { delta, sens } (sens : "hausse" | "baisse" | "stable"). */
    function evolution(actuel, precedent) {
        const delta = actuel - precedent;
        return { delta, sens: delta > 0 ? "hausse" : delta < 0 ? "baisse" : "stable" };
    }

    return { GRANULARITES, CATEGORIES, MOIS, MOIS_COURTS, parse, fmt, ajouter, ecart, dans, bornes, decaler, numeroSemaine, libelle, jours, grilleMois, repartition, analyser, serieMensuelle, evolution };
})();
