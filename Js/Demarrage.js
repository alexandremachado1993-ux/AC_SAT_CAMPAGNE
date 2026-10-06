/* =============================================================
   Demarrage.js — démarrage commun de toutes les pages. Chaque page se déclare par
   <body data-page="…"> (tableau, clients, planning, tournee, serti, documents,
   reglages) ; ce fichier remplace les blocs <script> en ligne, interdits par la
   politique de sécurité (CSP) du site. Doit être le DERNIER script de la page.
   ============================================================= */
(() => {
    Donnees.init();
    AppLayout.init(document.body.dataset.page);
    Synchro.demarrer();
})();
