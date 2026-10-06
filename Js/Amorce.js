/* =============================================================
   Amorce.js — décide AVANT l'affichage si l'animation d'ouverture se joue
   (une fois par session). Chargé dans <head>, de façon synchrone : sans cela, la
   page apparaîtrait un instant avant l'animation. Il n'était pas un fichier avant
   parce qu'il vivait dans un bloc <script> en ligne, ce qui interdit une politique
   de sécurité (CSP) stricte.
   Décision mémorisée pour la session : acsc_splash_dec = "joue", "jamais", "reduit"
   (mouvement réduit demandé au système) ou "economie" (économiseur de données).
   ============================================================= */
(function () {
    try {
        const racine = document.documentElement, session = window.sessionStorage;
        let reglage = null, raison = "";
        try { reglage = window.localStorage.getItem("acsc_animation"); } catch (e) { Erreurs.consigner("Amorce : réglage d'animation illisible, valeur par défaut", e); }
        if (session.getItem("acsc_splash")) return;          // déjà décidé dans cette session
        session.setItem("acsc_splash", "1");
        if (reglage === "jamais") raison = "jamais";
        else if (reglage === "auto") {
            if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) raison = "reduit";
            else if (navigator.connection && navigator.connection.saveData) raison = "economie";
        }
        session.setItem("acsc_splash_dec", raison || "joue");
        if (raison) return;
        racine.classList.add("splash-actif");
        setTimeout(() => racine.classList.remove("splash-actif"), 14000);   // sécurité : jamais plus de 14 s
    } catch (e) { Erreurs.consigner("Amorce : stockage de session indisponible, pas d'animation", e); }
})();
