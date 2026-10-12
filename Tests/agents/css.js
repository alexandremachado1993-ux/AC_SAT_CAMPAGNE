/* Contrôleur « CSS » : (1) règles IDENTIQUES répétées dans une même feuille (même contexte @media, même sélecteur, mêmes déclarations),
   (2) classes définies mais jamais utilisées. Une classe construite par le code (« serti-v-- » + verdict) compte comme utilisée dès que
   son préfixe jusqu'à « -- » apparaît dans le code. Trouvé ainsi : « .feuille » écrite deux fois, « .pt-sr » jamais employée. */
const postcss = require("postcss");
const { lister, lire } = require("./outils");

function contexte(regle) {
    const c = [];
    let p = regle.parent;
    while (p && p.type === "atrule") { c.unshift("@" + p.name + " " + p.params); p = p.parent; }
    return c.join(" | ");
}

function reglesIdentiques(nom, texte) {
    const vues = new Map();
    const doublons = [];
    postcss.parse(texte).walkRules(r => {
        const declarations = r.nodes.filter(n => n.type === "decl").map(n => n.prop + ":" + n.value.replace(/\s+/g, " ") + (n.important ? "!" : "")).sort().join(";");
        const selecteur = r.selector.replace(/\s+/g, " ");
        const cle = contexte(r) + "§" + selecteur + "§" + declarations;
        if (vues.has(cle)) doublons.push({ feuille: nom, selecteur: selecteur.slice(0, 80), lignes: [vues.get(cle), r.source.start.line] });
        else vues.set(cle, r.source.start.line);
    });
    return doublons;
}

/* feuilles : { nom: texte } ; usage : texte du code qui peut citer des classes ; autorisees : Set de classes volontairement « inutilisées ». */
function classesInutilisees(feuilles, usage, autorisees) {
    const classes = new Set();
    Object.keys(feuilles).forEach(nom => postcss.parse(feuilles[nom]).walkRules(r => (r.selector.match(/\.[A-Za-z_][\w-]*/g) || []).forEach(c => classes.add(c.slice(1)))));
    const cite = (c) => new RegExp("(^|[^\\w-])" + c.replace(/-/g, "\\-") + "([^\\w-]|$)").test(usage);
    return Array.from(classes).filter(c => !(autorisees && autorisees.has(c)) && !cite(c) && !(c.includes("--") && usage.includes(c.slice(0, c.indexOf("--") + 2)))).sort();
}

function analyserProjet(racine) {
    const feuilles = {};
    lister(racine, "CSS").filter(f => f.endsWith(".css")).forEach(f => { feuilles[f] = lire(racine, f); });
    const usage = lister(racine, "").filter(f => /^[^/]+\.html$/.test(f)).concat(lister(racine, "Js").filter(f => f.endsWith(".js"))).map(f => lire(racine, f)).join("\n");
    const identiques = [];
    Object.keys(feuilles).forEach(nom => reglesIdentiques(nom, feuilles[nom]).forEach(d => identiques.push(d)));
    return { identiques, inutilisees: classesInutilisees(feuilles, usage, new Set()) };
}

module.exports = { reglesIdentiques, classesInutilisees, analyserProjet };
