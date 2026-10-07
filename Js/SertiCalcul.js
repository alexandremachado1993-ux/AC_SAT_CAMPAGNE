/* =============================================================
   SertiCalcul.js — Règles de verdict du contrôle de serti

   Fonctions pures (aucun accès à l'écran ni au stockage) : tout ce qui
   décide « conforme / limite / hors tolérance », « validation OUI / NON »
   et « écart avec le contrôle du client (Seametal) » est ici, donc testable.

   Règles (confirmées avec le document SQ/EMB/067) :
   - critique  : dans la plage, sinon NON CONFORME (croisure = valeur MINIMALE) ;
   - recommandé: cible ± tolérance ; « limite » = dernier cinquième de la tolérance ;
   - une mesure sans règle (profondeur de cuvette, hauteur du 1/2 et du 1/2H
     tant qu'elles ne sont pas renseignées) est saisissable mais pas jugée ;
   - la pire tête décide du verdict de la ligne ;
   - validation proposée : NON si une mesure est hors tolérance, sinon OUI
     (un contrôle « à surveiller » reste OUI, signalé).
   ============================================================= */

const SertiCalcul = (() => {
    "use strict";

    const R = ReferentielSerti;
    const NB_TETES_OPTIONS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
    const GRAVITE = { vide: 0, ok: 1, limite: 2, hors: 3, crit: 4 };
    /* Paramètres comparés avec le contrôle du client (ceux qui ont une valeur en mm). */
    const PARAMETRES_COMPARES = ["croisure", "hauteurBoite", "flange", "hauteurSerti", "epaisseurSerti", "crochetFond", "crochetCorps"];
    const SEUIL_COMPARAISON = 0.25;          // part de la tolérance au-delà de laquelle l'écart est « à regarder »
    const SEUIL_CROISURE_MM = 0.05;
    const VALEUR_MAX = 1000;

    /* « 1,05 » ou 1.05 → 1.05 ; vide ou illisible → null. */
    function nombre(v) {
        if (typeof v === "number") return isFinite(v) ? v : null;
        if (typeof v !== "string") return null;
        const t = v.trim().replace(",", ".");
        if (t === "" || !/^-?\d*\.?\d+$/.test(t)) return null;
        const n = Number(t);
        return isFinite(n) ? n : null;
    }
    const arrondi = (n) => Math.round(n * 1000) / 1000;

    /* Nombre de têtes : 0 à 24, par paire. Autre chose → null (non renseigné). */
    function normaliserNbTetes(v) {
        if (v === "" || v == null) return null;
        const n = typeof v === "number" ? v : (/^\s*\d+\s*$/.test(String(v)) ? parseInt(String(v), 10) : NaN);   /* strict : « 6abc » ou « 6.5 » refusés */
        return NB_TETES_OPTIONS.indexOf(n) !== -1 ? n : null;
    }

    /* ---------- Verdict d'une valeur ---------- */

    /* « ok » | « limite » | « hors » | « nr » (pas de valeur ou pas de règle). */
    function evaluer(regle, valeur) {
        if (valeur == null || !regle) return "nr";
        const e = 1e-9;
        if (regle.type === "tol") {
            const ecart = Math.abs(valeur - regle.nom);
            return ecart > regle.tol + e ? "hors" : (ecart > 0.8 * regle.tol + e ? "limite" : "ok");
        }
        if (regle.type === "plage") {
            const l = regle.max - regle.min;
            if (valeur < regle.min - e || valeur > regle.max + e) return "hors";
            return (valeur < regle.min + 0.1 * l - e || valeur > regle.max - 0.1 * l + e) ? "limite" : "ok";
        }
        return valeur >= regle.min - e ? "ok" : "hors";          // minimum seul (croisure)
    }

    /* Échelle d'une jauge : bornes et frontières des zones, en unités de la mesure. */
    function jauge(regle) {
        if (!regle) return null;
        if (regle.type === "tol") return { bas: regle.nom - 1.5 * regle.tol, haut: regle.nom + 1.5 * regle.tol,
            zones: [regle.nom - regle.tol, regle.nom - 0.8 * regle.tol, regle.nom + 0.8 * regle.tol, regle.nom + regle.tol] };
        if (regle.type === "plage") { const l = regle.max - regle.min;
            return { bas: regle.min - 0.3 * l, haut: regle.max + 0.3 * l, zones: [regle.min, regle.min + 0.1 * l, regle.max - 0.1 * l, regle.max] }; }
        return { bas: regle.min - 0.35, haut: regle.min + 0.65, zones: [regle.min, regle.min, regle.min, regle.min] };
    }

    /* Texte de la cible : « 2,85 ± 0,15 mm · de 2,70 à 3,00 », « de 70 à 95 % », « minimum 1,00 mm ». */
    function texteRegle(regle, decimales) {
        if (!regle) return "";
        const f = (n, d) => n.toFixed(d).replace(".", ",");
        const d = decimales == null ? 2 : decimales;
        if (regle.type === "tol") return f(regle.nom, d) + " ± " + f(regle.tol, d) + " " + regle.unite + " · de " + f(regle.nom - regle.tol, d) + " à " + f(regle.nom + regle.tol, d);
        if (regle.type === "plage") return "de " + f(regle.min, d) + " à " + f(regle.max, d) + " " + regle.unite;
        return "minimum " + f(regle.min, d) + " " + regle.unite;
    }

    /* ---------- Une tête ---------- */

    /* valeurs : { paramId: nombre ou texte }. Renvoie les cases, le verdict de la tête et ses problèmes. */
    function evaluerTete(valeurs, colonneId, formatNom) {
        const cases = [], problemes = [];
        let mesurees = 0, jugees = 0, critique = false, hors = false, limite = false;
        R.PARAMETRES.forEach(p => {
            const v = nombre((valeurs || {})[p.id]);
            const regle = R.regle(p.id, colonneId, formatNom);
            const etat = evaluer(regle, v);
            cases.push({ id: p.id, valeur: v, etat, regle });
            if (v != null) mesurees++;
            if (etat !== "nr") jugees++;
            if (etat === "hors") {
                if (p.categorie === "critique") critique = true; else hors = true;
                problemes.push({ parametre: p.id, libelle: p.libelle, etat: "hors", critique: p.categorie === "critique" });
            } else if (etat === "limite") { limite = true; problemes.push({ parametre: p.id, libelle: p.libelle, etat: "limite", critique: false }); }
        });
        /* Une tête n'a de verdict que si au moins une de ses valeurs a pu être jugée (une règle existe). */
        return { cases, mesurees, jugees, problemes,
            verdict: jugees === 0 ? "vide" : critique ? "crit" : hors ? "hors" : limite ? "limite" : "ok" };
    }

    /* ---------- Un contrôle (toutes les têtes) ---------- */

    function libelleTete(n) { return n === 0 ? "Ligne" : "Tête " + n; }

    /* m : un contrôle tel qu'enregistré dans une visite (voir nettoyer). */
    function analyser(m) {
        const res = { tetes: [], pire: "vide", mesurees: 0, jugees: 0, problemes: [], validationAuto: "", aSurveiller: false, client: [] };
        if (!m) return res;
        (m.tetes || []).forEach(t => {
            const e = evaluerTete(t.v, m.colonne, m.format);
            res.tetes.push(Object.assign({ n: t.n }, e));
            if (e.mesurees > 0) res.mesurees++;
            if (e.jugees > 0) res.jugees++;
            if (GRAVITE[e.verdict] > GRAVITE[res.pire]) res.pire = e.verdict;
            e.problemes.forEach(p => res.problemes.push(Object.assign({ tete: t.n }, p)));
        });
        res.problemes.sort((a, b) => (b.critique - a.critique) || ((b.etat === "hors") - (a.etat === "hors")) || a.tete - b.tete);
        res.validationAuto = res.jugees === 0 ? "" : (res.pire === "hors" || res.pire === "crit") ? "non" : "oui";
        res.aSurveiller = res.pire === "limite";
        if (m.client && m.client.tetes) m.client.tetes.forEach(t => res.client.push(Object.assign({ n: t.n }, evaluerTete(t.v, m.colonne, m.format))));
        return res;
    }

    /* ---------- Comparaison avec le contrôle du client (Seametal) ---------- */

    /* Écart = valeur manuelle moins valeur du client, pour les têtes mesurées des deux côtés. */
    function comparer(m) {
        const vide = { lignes: [], moyennes: {}, nbCases: 0, nbAlertes: 0, ecartMax: 0, disponible: false };
        if (!m || !m.client || !(m.client.tetes || []).length || !(m.tetes || []).length) return vide;
        const lignes = [], somme = {}, nb = {};
        let nbCases = 0, nbAlertes = 0, ecartMax = 0;
        m.tetes.forEach(t => {
            const c = m.client.tetes.find(x => x.n === t.n);
            if (!c) return;
            const cases = [];
            PARAMETRES_COMPARES.forEach(id => {
                const a = nombre(t.v[id]), b = nombre(c.v[id]);
                if (a == null || b == null) return;
                const regle = R.regle(id, m.colonne, m.format);
                const ecart = arrondi(a - b);
                const seuil = regle && regle.type === "tol" ? SEUIL_COMPARAISON * regle.tol : SEUIL_CROISURE_MM;
                const alerte = regle ? Math.abs(ecart) > seuil + 1e-9 : false;
                cases.push({ id, manuel: a, client: b, ecart, alerte });
                somme[id] = (somme[id] || 0) + ecart; nb[id] = (nb[id] || 0) + 1;
                nbCases++; if (alerte) nbAlertes++;
                if (id !== "croisure" && Math.abs(ecart) > ecartMax) ecartMax = Math.abs(ecart);
            });
            if (cases.length) lignes.push({ n: t.n, cases });
        });
        const moyennes = {};
        Object.keys(somme).forEach(id => { moyennes[id] = arrondi(somme[id] / nb[id]); });
        return { lignes, moyennes, nbCases, nbAlertes, ecartMax: arrondi(ecartMax), disponible: lignes.length > 0 };
    }

    /* ---------- Nettoyage avant enregistrement ---------- */

    const texte = (t, max) => (typeof t === "string" ? t.trim().replace(/\s+/g, " ").slice(0, max) : "");

    /* Fiches des fichiers joints (le fichier lui-même est dans IndexedDB, voir Pieces.js) : 10 au maximum, champs typés. */
    function nettoyerPieces(liste) {
        const vus = new Set();
        return (Array.isArray(liste) ? liste : []).filter(p => p && typeof p === "object" && typeof p.id === "string" && /^[\w-]{4,60}$/.test(p.id) && !vus.has(p.id) && vus.add(p.id))
            .slice(0, 10).map(p => ({ id: p.id, nom: texte(p.nom, 120) || "Fichier", type: typeof p.type === "string" ? p.type.slice(0, 60) : "",
                taille: Number.isFinite(Number(p.taille)) ? Math.max(0, Math.round(Number(p.taille))) : 0, le: typeof p.le === "string" ? p.le.slice(0, 30) : "" }));
    }

    function nettoyerSerie(liste, nbTetes) {
        const par = new Map();
        (Array.isArray(liste) ? liste : []).forEach(t => {
            if (!t || typeof t !== "object") return;
            const n = Number(t.n);
            if (!Number.isInteger(n) || n < 0 || n > 24) return;
            if (nbTetes === 0 ? n !== 0 : (n === 0 || (nbTetes != null && n > nbTetes))) return;
            const v = {};
            R.PARAMETRES.forEach(p => {
                const x = nombre((t.v || {})[p.id]);
                if (x != null && x >= 0 && x <= VALEUR_MAX) v[p.id] = arrondi(x);
            });
            if (Object.keys(v).length) par.set(n, { n, v });
        });
        return Array.from(par.values()).sort((a, b) => a.n - b.n);
    }

    /* Nettoie un contrôle saisi à l'écran : ne garde que des valeurs plausibles, calcule le verdict
       et la validation proposée, et fige le référentiel utilisé. Renvoie null s'il n'y a rien à garder. */
    function nettoyer(src) {
        if (!src || typeof src !== "object") return null;
        const colonneId = R.colonne(src.colonne) ? src.colonne : "";
        const nb = normaliserNbTetes(src.nbTetes);
        const tetes = nettoyerSerie(src.tetes, nb);
        const clientTetes = src.client && typeof src.client === "object" ? nettoyerSerie(src.client.tetes, nb) : [];
        const clientNote = src.client && typeof src.client === "object" ? texte(src.client.note, 200) : "";
        const clientPieces = src.client && typeof src.client === "object" ? nettoyerPieces(src.client.pieces) : [];
        const choix = src.validation === "oui" || src.validation === "non" ? src.validation : "";
        if (!tetes.length && !clientTetes.length && !choix && !clientPieces.length) return null;
        const m = { ref: R.REFERENCE.id + " rév. " + R.REFERENCE.revision + " du " + R.REFERENCE.date, colonne: colonneId,
            format: texte(src.format, 40), nbTetes: nb === null ? "" : nb, tetes };
        if (clientTetes.length || clientNote || clientPieces.length) m.client = { source: "Seametal", note: clientNote, tetes: clientTetes };
        if (clientPieces.length) m.client.pieces = clientPieces;
        const a = analyser(m);
        m.verdict = a.pire === "vide" ? "" : a.pire;
        m.validationAuto = a.validationAuto;
        m.validation = choix || a.validationAuto;
        m.forcee = !!choix && !!a.validationAuto && choix !== a.validationAuto;
        const note = texte(src.note, 300);
        if (note) m.note = note;
        return m;
    }

    /* Ce qu'on AFFICHE d'un contrôle déjà enregistré : sa validation recalculée avec les règles du référentiel
       d'aujourd'hui, sauf s'il porte une décision manuelle (jamais recalculée). Évite qu'une tolérance ajoutée
       plus tard (profondeur de cuvette, hauteur du 1/2…) laisse une pastille « OUI » devant une grille « hors ». */
    function etatActuel(m, analyse) {
        if (!m) return { validation: "", aSurveiller: false, verdict: "vide", forcee: false };
        const a = analyse || analyser(m);
        const forcee = !!m.forcee;
        const validation = forcee ? m.validation : (a.validationAuto || m.validation || "");
        return { validation, aSurveiller: a.pire === "limite" && validation === "oui", verdict: a.pire, forcee };
    }

    /* Libellés d'affichage. */
    const LIBELLES_VERDICT = { vide: "Pas mesuré", ok: "Conforme", limite: "Limite", hors: "Hors tolérance", crit: "Non conforme (critique)" };

    return { NB_TETES_OPTIONS, PARAMETRES_COMPARES, LIBELLES_VERDICT, nombre, normaliserNbTetes, evaluer, jauge, texteRegle,
        evaluerTete, analyser, etatActuel, comparer, nettoyer, libelleTete };
})();
