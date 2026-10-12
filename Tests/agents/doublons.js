/* Contrôleur « doublons » : repère les blocs de code identiques recopiés à plusieurs endroits du JavaScript de l'application.
   Une fenêtre de FENETRE lignes significatives consécutives (lignes de moins de LONGUEUR_MIN caractères et commentaires ignorés,
   espaces normalisés) qui apparaît deux fois est un doublon. Trouvé ainsi : la lecture de couleur et la luminance recopiées
   dans couleurTexte et couleurClaire (Donnees.js). */
const { lister, lire } = require("./outils");

const FENETRE = 6;
const LONGUEUR_MIN = 12;

function lignesSignificatives(texte) {
    const sortie = [];
    texte.split("\n").forEach((l, i) => {
        const t = l.trim().replace(/\s+/g, " ");
        if (t.length < LONGUEUR_MIN || /^(\/\/|\/\*|\*)/.test(t)) return;
        sortie.push({ t, n: i + 1 });
    });
    return sortie;
}

/* Renvoie des doublons { a: { fichier, ligne }, b: { fichier, ligne } } (un par groupe de fenêtres qui se chevauchent). */
function chercher(racine, fichiers) {
    const vues = new Map();
    const brut = [];
    fichiers.forEach(f => {
        const L = lignesSignificatives(lire(racine, f));
        for (let i = 0; i + FENETRE <= L.length; i++) {
            const cle = L.slice(i, i + FENETRE).map(x => x.t).join("\n");
            const avant = vues.get(cle);
            if (avant) brut.push({ a: avant, b: { fichier: f, ligne: L[i].n } });
            else vues.set(cle, { fichier: f, ligne: L[i].n });
        }
    });
    const groupes = [];
    brut.forEach(d => {
        const dernier = groupes[groupes.length - 1];
        if (dernier && dernier.a.fichier === d.a.fichier && dernier.b.fichier === d.b.fichier && d.b.ligne - dernier.b.fin <= 3) { dernier.b.fin = d.b.ligne; return; }
        groupes.push({ a: d.a, b: Object.assign({}, d.b, { fin: d.b.ligne }) });
    });
    return groupes.map(g => ({ a: g.a, b: { fichier: g.b.fichier, ligne: g.b.ligne } }));
}

/* Le code de production surveillé : scripts de l'application, service worker, fonction serveur. */
function fichiersDuProjet(racine) {
    return lister(racine, "Js").filter(f => f.endsWith(".js"))
        .concat(["sw.js"], lister(racine, "supabase/functions/rappels").filter(f => /\.(js|ts)$/.test(f)));
}

module.exports = { chercher, fichiersDuProjet, FENETRE };
