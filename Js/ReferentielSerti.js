/* =============================================================
   ReferentielSerti.js — Valeurs de serti par format de boîte

   Source : « Dimensionnelle des valeurs de serti par format de boîte »,
   réf. SQ/EMB/067 rév. C (créée le 08/08/2014, modifiée le 04/06/2026).
   Les 132 valeurs ci-dessous (12 colonnes × 11 paramètres) ont été
   retranscrites par programme depuis le texte du document, pas à la main.

   Ce fichier ne contient que des DONNÉES et leur lecture : aucune règle
   de verdict (elle est dans SertiCalcul.js), aucun accès à l'écran.

   Pour renseigner ce que le document ne donne pas (profondeur de cuvette,
   hauteur de boîte du 1/2 et du 1/2H…), voir le bloc « AJOUTS » plus bas.
   ============================================================= */

const ReferentielSerti = (() => {
    "use strict";

    const REFERENCE = { id: "SQ/EMB/067", revision: "C", date: "2026-06-04",
        titre: "Dimensionnelle des valeurs de serti par format de boîte" };

    /* Paramètres. « critique » : dans la plage ou non conforme. « recommande » : cible ± tolérance.
       « reference » : valeur donnée à titre indicatif, sans tolérance. */
    const PARAMETRES = [
        { id: "croisure", libelle: "Croisure", court: "Cro", categorie: "critique", unite: "mm", decimales: 2 },
        { id: "calage", libelle: "Calage crochet de fond", court: "Cal", categorie: "critique", unite: "%", decimales: 0 },
        { id: "ondulation", libelle: "Ondulation", court: "Ond", categorie: "critique", unite: "%", decimales: 0 },
        { id: "hauteurBoite", libelle: "Hauteur de boîte", court: "H.b", categorie: "recommande", unite: "mm", decimales: 2 },
        { id: "flange", libelle: "Flange", court: "Fla", categorie: "recommande", unite: "mm", decimales: 2 },
        { id: "hauteurSerti", libelle: "Hauteur de serti", court: "H.s", categorie: "recommande", unite: "mm", decimales: 2 },
        { id: "epaisseurSerti", libelle: "Épaisseur de serti", court: "Ép.", categorie: "recommande", unite: "mm", decimales: 2 },
        { id: "crochetFond", libelle: "Crochet de fond", court: "C.f", categorie: "recommande", unite: "mm", decimales: 2 },
        { id: "crochetCorps", libelle: "Crochet de corps", court: "C.c", categorie: "recommande", unite: "mm", decimales: 2 },
        { id: "cuvette", libelle: "Profondeur de cuvette", court: "Cuv", categorie: "recommande", unite: "mm", decimales: 2 }
    ];

    /* Colonnes du document. Croisure : valeur MINIMALE. calage et ondulation : [min, max] en %.
       Les autres : [valeur cible, tolérance ±] en mm. epBoite et epFond : valeurs de référence. */
    const COLONNES = [
        { id: "ø52 (1/6)", diametre: 52, valeurs: { croisure: 0.9, calage: [70.0, 95.0], ondulation: [5.0, 25.0], hauteurBoite: [86.5, 0.3], flange: [2.3, 0.2], hauteurSerti: [2.7, 0.15], epaisseurSerti: [0.95, 0.01], crochetFond: [1.85, 0.2], crochetCorps: [1.9, 0.2], epBoite: 0.15, epFond: 0.17 } },
        { id: "ø62 (1/8)", diametre: 62, valeurs: { croisure: 0.9, calage: [70.0, 95.0], ondulation: [5.0, 25.0], hauteurBoite: [39.9, 0.3], flange: [2.3, 0.2], hauteurSerti: [2.75, 0.15], epaisseurSerti: [0.96, 0.01], crochetFond: [1.85, 0.2], crochetCorps: [1.9, 0.2], epBoite: 0.14, epFond: 0.18 } },
        { id: "ø62 (1/4)", diametre: 62, valeurs: { croisure: 0.9, calage: [70.0, 95.0], ondulation: [5.0, 25.0], hauteurBoite: [71.6, 0.3], flange: [2.3, 0.2], hauteurSerti: [2.75, 0.15], epaisseurSerti: [0.96, 0.01], crochetFond: [1.85, 0.2], crochetCorps: [1.9, 0.2], epBoite: 0.14, epFond: 0.18 } },
        { id: "ø65", diametre: 65, valeurs: { croisure: 1.0, calage: [70.0, 95.0], ondulation: [5.0, 25.0], hauteurBoite: [71.6, 0.3], flange: [2.45, 0.2], hauteurSerti: [2.75, 0.15], epaisseurSerti: [0.96, 0.01], crochetFond: [1.85, 0.2], crochetCorps: [1.9, 0.2], epBoite: 0.14, epFond: 0.18 } },
        { id: "ø70", diametre: 70, valeurs: { croisure: 1.0, calage: [70.0, 95.0], ondulation: [5.0, 25.0], hauteurBoite: [109.3, 0.3], flange: [2.55, 0.2], hauteurSerti: [2.85, 0.15], epaisseurSerti: [1.0, 0.01], crochetFond: [1.9, 0.2], crochetCorps: [1.95, 0.2], epBoite: 0.16, epFond: 0.18 } },
        { id: "ø83", diametre: 83, valeurs: { croisure: 1.0, calage: [70.0, 95.0], ondulation: [5.0, 25.0], hauteurBoite: [85.8, 0.3], flange: [2.45, 0.2], hauteurSerti: [2.85, 0.15], epaisseurSerti: [1.09, 0.01], crochetFond: [1.9, 0.2], crochetCorps: [1.95, 0.2], epBoite: 0.16, epFond: 0.21 } },
        { id: "ø96 (3/4)", diametre: 96, valeurs: { croisure: 1.1, calage: [70.0, 95.0], ondulation: [5.0, 25.0], hauteurBoite: [86.2, 0.3], flange: [2.6, 0.2], hauteurSerti: [2.85, 0.15], epaisseurSerti: [1.08, 0.01], crochetFond: [2.0, 0.2], crochetCorps: [2.0, 0.2], epBoite: 0.17, epFond: 0.2 } },
        { id: "ø96 (4/4)", diametre: 96, valeurs: { croisure: 1.1, calage: [70.0, 95.0], ondulation: [5.0, 25.0], hauteurBoite: [118.3, 0.3], flange: [2.6, 0.2], hauteurSerti: [2.85, 0.15], epaisseurSerti: [1.08, 0.01], crochetFond: [2.0, 0.2], crochetCorps: [2.0, 0.2], epBoite: 0.17, epFond: 0.2 } },
        { id: "ø99", diametre: 99, valeurs: { croisure: 1.1, calage: [70.0, 95.0], ondulation: [5.0, 25.0], hauteurBoite: [118.3, 0.3], flange: [2.65, 0.2], hauteurSerti: [2.9, 0.15], epaisseurSerti: [1.17, 0.01], crochetFond: [2.0, 0.2], crochetCorps: [2.0, 0.2], epBoite: 0.17, epFond: 0.23 } },
        { id: "ø153 (3/1)", diametre: 153, valeurs: { croisure: 1.25, calage: [70.0, 95.0], ondulation: [5.0, 25.0], hauteurBoite: [155.0, 0.3], flange: [3.2, 0.2], hauteurSerti: [3.2, 0.15], epaisseurSerti: [1.39, 0.01], crochetFond: [2.2, 0.2], crochetCorps: [2.2, 0.2], epBoite: 0.22, epFond: 0.27 } },
        { id: "ø153 (5/1B)", diametre: 153, valeurs: { croisure: 1.25, calage: [70.0, 95.0], ondulation: [5.0, 25.0], hauteurBoite: [237.0, 0.3], flange: [3.2, 0.2], hauteurSerti: [3.2, 0.15], epaisseurSerti: [1.49, 0.01], crochetFond: [2.2, 0.2], crochetCorps: [2.2, 0.2], epBoite: 0.27, epFond: 0.27 } },
        { id: "ø153 (5/1)", diametre: 153, valeurs: { croisure: 1.25, calage: [70.0, 95.0], ondulation: [5.0, 25.0], hauteurBoite: [245.0, 0.3], flange: [3.2, 0.2], hauteurSerti: [3.2, 0.15], epaisseurSerti: [1.49, 0.01], crochetFond: [2.2, 0.2], crochetCorps: [2.2, 0.2], epBoite: 0.27, epFond: 0.27 } }
    ];

    /* Formats boîte → colonne(s) du document. Plusieurs formats peuvent partager une colonne
       (1/2, 1/2H et 1/2M : même diamètre, seule la hauteur change) ; un format peut avoir
       deux colonnes (4/4 : ø96 ou ø99, à choisir sur la ligne).
       hauteur: "a-renseigner" = la hauteur de boîte n'est pas donnée par le document pour ce format. */
    const FORMATS = [
        { nom: "1/6", colonnes: ["ø52 (1/6)"] },
        { nom: "1/8", colonnes: ["ø62 (1/8)"] },
        { nom: "1/4", colonnes: ["ø62 (1/4)"] },
        { nom: "1/4 US", colonnes: ["ø65"] },
        { nom: "1/2", colonnes: ["ø83"], hauteur: "a-renseigner" },
        { nom: "1/2H", colonnes: ["ø83"], hauteur: "a-renseigner" },
        { nom: "1/2M", colonnes: ["ø83"] },
        { nom: "3/4", colonnes: ["ø96 (3/4)"] },
        { nom: "4/4", colonnes: ["ø96 (4/4)", "ø99"] },
        { nom: "3/1", colonnes: ["ø153 (3/1)"] },
        { nom: "5/1B", colonnes: ["ø153 (5/1B)"] },
        { nom: "5/1", colonnes: ["ø153 (5/1)"] }
    ];

    /* ===================== AJOUTS (à compléter à la main) =====================
       Ce que le document ne donne pas. Tant qu'une valeur manque, la mesure
       correspondante est saisissable mais n'est pas jugée (« à renseigner »).

       cuvette      : profondeur de cuvette [minimum, maximum] en mm, par COLONNE.
                      ex.  "ø83": [3.2, 3.8]
       hauteurBoite : hauteur de boîte [minimum, maximum] en mm, par FORMAT BOÎTE
                      (utile pour 1/2 et 1/2H, que le document ne donne pas).
                      ex.  "1/2H": [89.5, 90.1]

       ALIAS_HAUTEUR : un format qui a la même hauteur qu'un autre.
                      ex.  "1/2": "1/2M"   (le 1/2 a la hauteur du 1/2M)
       ======================================================================== */
    const AJOUTS = {
        cuvette: {},
        hauteurBoite: {}
    };
    const ALIAS_HAUTEUR = {};
    /* ===================== fin des AJOUTS ===================== */

    const normaliser = (t) => String(t == null ? "" : t).toLowerCase().replace(/\s+/g, "");

    function colonne(id) { return COLONNES.find(c => c.id === id) || null; }
    function formatConnu(nom) { const k = normaliser(nom); return k ? (FORMATS.find(f => normaliser(f.nom) === k) || null) : null; }
    function colonnesDuFormat(nom) { const f = formatConnu(nom); return f ? f.colonnes.slice() : []; }
    function formatsDeLaColonne(id) { return FORMATS.filter(f => f.colonnes.indexOf(id) !== -1).map(f => f.nom); }
    function parametre(id) { return PARAMETRES.find(p => p.id === id) || null; }

    /* Règle d'un paramètre pour une colonne (et un format boîte pour la hauteur). Renvoie
       { type: "tol", nom, tol, unite } | { type: "plage", min, max, unite } | { type: "min", min, unite }
       ou null quand le référentiel n'en donne pas (profondeur de cuvette, hauteur du 1/2 et du 1/2H). */
    function regle(paramId, colonneId, formatNom, _profondeur) {
        const p = parametre(paramId);
        if (!p) return null;
        if (paramId === "cuvette") { const a = AJOUTS.cuvette[colonneId]; return a ? { type: "plage", min: a[0], max: a[1], unite: "mm" } : null; }
        const col = colonne(colonneId);
        if (!col) return null;
        if (paramId === "hauteurBoite" && formatNom) {
            const f = formatConnu(formatNom), cle = f ? f.nom : formatNom;
            const a = AJOUTS.hauteurBoite[cle];
            if (a) return { type: "plage", min: a[0], max: a[1], unite: "mm" };
            const alias = ALIAS_HAUTEUR[cle];
            if (alias && !(_profondeur > 0)) return regle(paramId, colonneId, alias, 1);
            if (f && f.hauteur === "a-renseigner") return null;
        }
        const v = col.valeurs[paramId];
        if (v == null) return null;
        if (paramId === "croisure") return { type: "min", min: v, unite: "mm" };
        if (p.unite === "%") return { type: "plage", min: v[0], max: v[1], unite: "%" };
        return { type: "tol", nom: v[0], tol: v[1], unite: "mm" };
    }

    function reference(colonneId) { const c = colonne(colonneId); return c ? { epBoite: c.valeurs.epBoite, epFond: c.valeurs.epFond } : null; }

    /* Les deux noms côte à côte : « 1/2M · ø83 ». */
    function libelleFormat(nom, colonneId) {
        const dia = colonneId ? colonneId.split(" ")[0] : "";
        return [nom, dia].filter(Boolean).filter((x, i, t) => t.indexOf(x) === i).join(" · ");
    }

    return { REFERENCE, PARAMETRES, COLONNES, FORMATS, AJOUTS, ALIAS_HAUTEUR, colonne, formatConnu, colonnesDuFormat, formatsDeLaColonne, parametre, regle, reference, libelleFormat };
})();
