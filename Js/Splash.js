/* =============================================================
   Splash.js — Animation d'ouverture de l'application (vidéo)

   Quand l'application s'ouvre, une vidéo courte (Media/ouverture.mp4,
   .webm en secours) passe en plein écran, puis s'efface en fondu.

   Qui décide d'afficher ? Un petit script placé en tête de chaque page
   (avant le premier affichage : pas de flash de l'application). Il ne la
   lance qu'à la PREMIÈRE page d'une session (fermer l'application ou
   l'onglet ré-ouvre la vidéo ; passer d'une page à l'autre ne la rejoue
   pas). Réglage propre à l'appareil (Réglages › Animation d'ouverture,
   localStorage « acsc_animation ») :
     - « toujours » (défaut) : la vidéo est lancée à chaque ouverture ;
     - « auto » (« Suivre l'appareil ») : pas de vidéo si le système demande
       de réduire les animations (prefers-reduced-motion : réglage
       d'accessibilité, souvent activé sur un PC professionnel ou en bureau
       à distance) ni en mode économie de données ;
     - « jamais » : aucune vidéo.
   Il pose la classe « splash-actif » sur <html> : la page reste masquée
   derrière. Ce fichier construit alors la vidéo.

   Elle ne doit JAMAIS bloquer l'application : elle se termine à la fin de
   la vidéo, à un appui n'importe où (ou Échap / Entrée / Espace), si la
   vidéo ne démarre pas dans les 4,5 s (réseau lent, lecture refusée, hors
   ligne), ou 1,5 s après la durée de la vidéo (12 s au plus). Le script de
   tête retire de toute façon la classe au bout de 14 s si ce fichier ne se
   charge pas. La vidéo est muette (les navigateurs bloquent le son).

   Journal : chaque ouverture laisse une ligne dans localStorage
   (« acsc_splash_journal », 8 dernières) affichée dans Réglages : jouée
   jusqu'au bout, passée, ignorée (pourquoi), ou échec (code d'erreur).
   ============================================================= */

(() => {
    "use strict";

    const CLE_MODE = "acsc_animation";
    const CLE_JOURNAL = "acsc_splash_journal";
    const FOND = "#f9f8fb";              // couleur exacte des bords de la vidéo
    const racine = document.documentElement;
    /* Délais réglables pour les tests (window.__SPLASH_DELAIS). */
    const D = Object.assign({ lecture: 4500, marge: 1500, duree: 6000, max: 12000, fondu: 400 }, window.__SPLASH_DELAIS || {});
    let cadre = null;
    let termine = false;
    let manuel = false;
    let ecouteTouche = null;
    let minuteries = [];
    let couleurBarre = null;             // couleur de la barre d'état du téléphone avant la vidéo
    let garde = null;

    /* ---------- Réglage de l'utilisateur et raisons pour lesquelles l'appareil pourrait l'éteindre ---------- */
    function mode() {
        try { const m = localStorage.getItem(CLE_MODE); return m === "auto" || m === "jamais" ? m : "toujours"; } catch (e) { return "toujours"; }
    }
    function reduit() { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    function economie() { return !!(navigator.connection && navigator.connection.saveData); }
    function etat() {
        const m = mode(), r = reduit(), e = economie();
        return { mode: m, reduit: r, economie: e, actif: m === "toujours" || (m === "auto" && !r && !e) };
    }

    /* ---------- Journal ---------- */
    function noter(code, detail) {
        try {
            const j = JSON.parse(localStorage.getItem(CLE_JOURNAL) || "[]");
            j.unshift({ t: new Date().toISOString(), c: code, x: detail || "" });
            localStorage.setItem(CLE_JOURNAL, JSON.stringify(j.slice(0, 8)));
        } catch (e) { Erreurs.consigner("Splash : journal facultatif", e); }
    }
    function journal() {
        try { const j = JSON.parse(localStorage.getItem(CLE_JOURNAL) || "[]"); return Array.isArray(j) ? j : []; } catch (e) { return []; }
    }
    /* Décision prise par le script de tête : notée une fois par session quand la vidéo est ignorée. */
    function noterDecision() {
        try {
            const s = window.sessionStorage;
            const dec = s.getItem("acsc_splash_dec");
            if (!dec || s.getItem("acsc_splash_note")) return;
            s.setItem("acsc_splash_note", "1");
            if (dec !== "joue") noter(dec);
        } catch (e) { Erreurs.consigner("Splash : facultatif", e); }
    }

    /* Barre d'état du téléphone : claire pendant la vidéo (sinon une bande rouge court au-dessus du fond clair). */
    function barre(couleur) {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) return;
        if (couleur) { if (couleurBarre === null) couleurBarre = meta.getAttribute("content") || ""; meta.setAttribute("content", couleur); }
        else if (couleurBarre !== null) { meta.setAttribute("content", couleurBarre); couleurBarre = null; }
    }

    function fin(code, detail) {
        if (termine) return;
        termine = true;
        const video = cadre && cadre.querySelector("video");
        if (cadre) noter((manuel ? "revoir:" : "") + (typeof code === "string" ? code : "passe"), typeof code === "string" ? detail : "");
        minuteries.forEach(clearTimeout);
        clearTimeout(garde);
        if (ecouteTouche) { document.removeEventListener("keydown", ecouteTouche); ecouteTouche = null; }
        racine.classList.remove("splash-actif");           // l'application devient visible sous la vidéo…
        barre(null);
        if (!cadre) return;
        if (video) { try { video.pause(); } catch (e) { Erreurs.consigner("Splash : déjà arrêtée", e); } }
        cadre.classList.add("splash--sortie");             // …qui s'efface en fondu
        minuteries.push(setTimeout(() => {
            if (cadre && cadre.parentNode) cadre.parentNode.removeChild(cadre);
            cadre = null;
        }, D.fondu));
    }

    function demarrer() {
        if (!racine.classList.contains("splash-actif") || cadre) return;

        cadre = document.createElement("div");
        cadre.id = "splash";
        cadre.className = "splash";
        cadre.setAttribute("role", "dialog");
        cadre.setAttribute("aria-label", "Animation d'ouverture");
        cadre.innerHTML =
            '<div class="splash-cadre">' +
            '<video class="splash-video" muted playsinline preload="auto" disablepictureinpicture aria-hidden="true" poster="Media/ouverture-poster.jpg">' +
            '<source src="Media/ouverture.mp4" type="video/mp4">' +
            '<source src="Media/ouverture.webm" type="video/webm">' +
            '</video></div>' +
            '<button type="button" class="splash-passer" aria-label="Passer l\'animation">Passer</button>';
        document.body.appendChild(cadre);
        barre(FOND);

        const video = cadre.querySelector("video");
        video.muted = true;                 // sans cela, la lecture automatique est refusée (iPhone, Chrome)
        video.defaultMuted = true;
        video.playsInline = true;

        video.addEventListener("ended", () => fin("termine"));
        /* En capture : l'échec d'une <source> ne remonte pas autrement. Le navigateur essaie les sources l'une
           après l'autre (MP4 puis WebM) : on n'abandonne que si la DERNIÈRE échoue, ou si la lecture elle-même
           échoue (MediaError : 1 annulée, 2 réseau, 3 décodage, 4 format ou fichier introuvable). */
        const sources = cadre.querySelectorAll("source");
        const derniere = sources[sources.length - 1];
        video.addEventListener("error", (ev) => {
            const cible = ev.target;
            if (cible && cible.tagName === "SOURCE") { if (cible === derniere) fin("erreur", "aucune source lisible"); return; }
            fin("erreur", "code " + (video.error ? video.error.code : "?"));
        }, true);
        /* Démarrée : on n'attend plus, et la vidéo dispose de sa durée + une marge (un PC lent peut démarrer tard). */
        video.addEventListener("playing", () => {
            clearTimeout(attente);
            clearTimeout(garde);
            const dureeMs = (isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : D.duree) + D.marge;
            garde = setTimeout(() => fin("max"), dureeMs);
        });
        cadre.addEventListener("click", () => fin("passe"));
        ecouteTouche = (e) => { if (["Escape", "Enter", " "].indexOf(e.key) !== -1 && cadre) { e.preventDefault(); fin("passe"); } };
        document.addEventListener("keydown", ecouteTouche);

        const attente = setTimeout(() => fin("lecture-tardive"), D.lecture);   // la vidéo doit démarrer, sinon on passe
        garde = setTimeout(() => fin("max"), D.max);                              // garde-fou absolu
        minuteries.push(attente);

        try {
            const lecture = video.play();
            if (lecture && typeof lecture.catch === "function") lecture.catch((e) => fin("refuse", e && e.name ? e.name : ""));   // lecture refusée (économie d'énergie, etc.)
        } catch (e) { fin("refuse", e && e.name ? e.name : ""); }
    }

    /* Rejoue la vidéo à la demande (bouton « Revoir l'animation »), quel que soit le réglage. */
    function jouer() {
        if (cadre) return;
        termine = false;
        manuel = true;
        minuteries = [];
        racine.classList.add("splash-actif");
        demarrer();
    }

    window.Splash = { demarrer, fin, jouer, etat, journal };
    noterDecision();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer);
    else demarrer();
})();
