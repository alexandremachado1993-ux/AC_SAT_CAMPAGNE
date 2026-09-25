/* =============================================================
   Documents.js — Espace Documents (Documents.html)

   Fiches de référence livrées avec l'application (dossier Documents/),
   en plusieurs langues. Chaque fiche s'ouvre dans sa propre page,
   imprimable (bouton « Imprimer / PDF »), et reste consultable sans
   réseau une fois ouverte une première fois (service worker).

   Ajouter une fiche : déposer son fichier dans Documents/ et ajouter
   une entrée dans DOCUMENTS ci-dessous.
   ============================================================= */

(() => {
    "use strict";

    const esc = (t) => AppLayout.escapeHtml(t);
    const conteneur = document.getElementById("contenu-page");

    const DOCUMENTS = [
        {
            titre: "Aide-mémoire réglage du double serti",
            categorie: "Réglage machine",
            description: "Tête de sertissage (organes A à F), cotes du serti, et comment ramener chaque valeur mesurée dans la tolérance.",
            pages: 2,
            format: "A4 paysage",
            versions: [
                { langue: "FR", libelle: "Ouvrir en français", fichier: "Documents/aide-memoire-serti-fr.html" },
                { langue: "ES", libelle: "Abrir en español", fichier: "Documents/aide-memoire-serti-es.html" }
            ]
        }
    ];

    function carte(d) {
        return '<div class="carte carte-document">' +
            '<div class="carte-document-entete">' +
            '<span class="carte-document-icone" aria-hidden="true">📄</span>' +
            '<div style="min-width:0;">' +
            '<div class="carte-document-titre">' + esc(d.titre) + '</div>' +
            '<div class="texte-attenue" style="font-size:0.75rem;">' + esc(d.categorie) + ' · ' + d.pages + ' page' + (d.pages > 1 ? "s" : "") + ' · ' + esc(d.format) + '</div>' +
            '</div></div>' +
            '<p class="carte-document-description">' + esc(d.description) + '</p>' +
            '<div class="carte-document-actions">' +
            d.versions.map((v, i) =>
                '<a href="' + esc(v.fichier) + '" class="bouton bouton--petit' + (i > 0 ? " bouton--contour" : "") + '">' +
                '<span class="pastille-langue">' + esc(v.langue) + '</span> ' + esc(v.libelle) + '</a>').join("") +
            '</div></div>';
    }

    conteneur.innerHTML =
        '<div class="entete-page"><div><h1 class="titre-page">Documents</h1>' +
        '<p class="texte-attenue" style="font-size:0.85rem;">Fiches de référence, imprimables et consultables sans réseau une fois ouvertes</p></div></div>' +
        '<div class="grille-documents">' + DOCUMENTS.map(carte).join("") + '</div>';
})();
