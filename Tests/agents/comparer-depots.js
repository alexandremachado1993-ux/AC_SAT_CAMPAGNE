/* Contrôleur « livraison » : compare le projet à ce qui est DÉJÀ sur GitHub (un clone) et dit, sans ambiguïté, quoi faire :
   à ENVOYER, à SUPPRIMER, à RENOMMER, et les fichiers « à point » (.editorconfig, .github/…) que l'envoi par navigateur ne prend pas
   et qu'il faut créer À LA MAIN. C'est la procédure suivie à la main pendant l'incident du 12/10/2026, rendue automatique.
   Usage : node Tests/agents/comparer-depots.js <dossier du clone GitHub> <dossier du projet> */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { lister } = require("./outils");

function empreintes(dossier) {
    const sortie = {};
    lister(dossier, "").forEach(f => { sortie[f] = crypto.createHash("md5").update(fs.readFileSync(path.join(dossier, f))).digest("hex"); });
    return sortie;
}

const aPoint = (f) => f.split("/").some(s => s.startsWith("."));

function comparer(depot, projet) {
    const d = empreintes(depot), p = empreintes(projet);
    const nouveaux = Object.keys(p).filter(f => !(f in d));
    const disparus = Object.keys(d).filter(f => !(f in p));
    const modifies = Object.keys(p).filter(f => f in d && d[f] !== p[f]);
    const renommes = [];
    disparus.slice().forEach(ancien => {
        const nouveau = nouveaux.find(n => p[n] === d[ancien]);
        if (nouveau) { renommes.push({ de: ancien, vers: nouveau }); disparus.splice(disparus.indexOf(ancien), 1); nouveaux.splice(nouveaux.indexOf(nouveau), 1); }
    });
    const envoyer = nouveaux.concat(modifies).sort();
    return {
        aEnvoyer: envoyer.filter(f => !aPoint(f)),
        aCreerALaMain: envoyer.filter(aPoint),
        aSupprimer: disparus.filter(f => !aPoint(f)).sort(),
        aSupprimerALaMain: disparus.filter(aPoint).sort(),
        aRenommer: renommes,
        identiques: Object.keys(p).filter(f => f in d && d[f] === p[f]).length
    };
}

function afficher(r) {
    const liste = (titre, l, fmt) => console.log(titre + " (" + l.length + ")" + (l.length ? " :\n" + l.map(x => "   " + (fmt ? fmt(x) : x)).join("\n") : " : rien"));
    liste("À ENVOYER", r.aEnvoyer);
    liste("À SUPPRIMER", r.aSupprimer);
    liste("À RENOMMER", r.aRenommer, x => x.de + "  →  " + x.vers);
    liste("À CRÉER À LA MAIN (fichiers « à point » : le navigateur ne les envoie pas)", r.aCreerALaMain);
    liste("À SUPPRIMER À LA MAIN (fichiers « à point »)", r.aSupprimerALaMain);
    console.log("Identiques : " + r.identiques);
}

if (require.main === module) {
    const [depot, projet] = process.argv.slice(2);
    if (!depot || !projet) { console.log("Usage : node Tests/agents/comparer-depots.js <clone GitHub> <projet>"); process.exit(2); }
    afficher(comparer(depot, projet));
}

module.exports = { comparer, empreintes, afficher };
