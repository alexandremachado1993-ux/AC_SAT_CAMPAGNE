/* Contrôleur « références » : tout fichier cité par une page, une feuille de style, un script ou le manifeste doit exister
   (images, médias, documents, bibliothèques, icônes, raccourcis). Une référence cassée ne fait aucun bruit : l'image manque, c'est tout. */
const fs = require("fs");
const path = require("path");
const { lister, lire } = require("./outils");

const externe = (r) => /^(https?:|data:|blob:|mailto:|tel:|javascript:|#)/i.test(r);

function manquantes(racine) {
    const absentes = [];
    const verifier = (source, reference, depuis) => {
        const r = String(reference).split("#")[0].split("?")[0];
        if (!r || externe(reference)) return;
        const cible = r.startsWith("/") ? path.join(racine, r) : path.join(racine, depuis, r);
        if (!fs.existsSync(cible)) absentes.push({ source, reference });
    };
    lister(racine, "").filter(f => /^[^/]+\.html$/.test(f)).forEach(f => {
        for (const m of lire(racine, f).matchAll(/(?:src|href)="([^"]+)"/g)) verifier(f, m[1], "");
    });
    lister(racine, "CSS").filter(f => f.endsWith(".css")).forEach(f => {
        for (const m of lire(racine, f).matchAll(/url\(["']?([^)"']+)["']?\)/g)) verifier(f, m[1], "CSS");
    });
    lister(racine, "Js").filter(f => f.endsWith(".js")).forEach(f => {
        for (const m of lire(racine, f).matchAll(/["']((?:Images|Media|Documents|Modeles|Vendor)\/[A-Za-z0-9_./ -]+\.[a-z0-9]{2,5})["']/g)) verifier(f, m[1], "");
    });
    if (fs.existsSync(path.join(racine, "manifest.webmanifest"))) {
        const mf = JSON.parse(lire(racine, "manifest.webmanifest"));
        (mf.icons || []).forEach(i => verifier("manifest.webmanifest", i.src, ""));
        (mf.shortcuts || []).forEach(s => { verifier("manifest.webmanifest", s.url, ""); (s.icons || []).forEach(i => verifier("manifest.webmanifest", i.src, "")); });
        if (mf.start_url) verifier("manifest.webmanifest", mf.start_url, "");
    }
    return absentes;
}

module.exports = { manquantes };
