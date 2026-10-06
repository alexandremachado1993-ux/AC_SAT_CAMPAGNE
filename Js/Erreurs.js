/* =============================================================
   Erreurs.js — Gestion centralisée des erreurs

   Deux niveaux, pour ne plus JAMAIS avaler une erreur en silence :
   - consigner(contexte, erreur) : situation prévue et sans gravité (stockage
     refusé, réseau absent, journal facultatif…). Notée dans le journal, rien
     n'est affiché.
   - signaler(contexte, erreur)  : quelque chose ne s'est pas passé comme prévu
     (écouteur qui plante, promesse non gérée, erreur de script). Notée dans le
     journal ET un message sobre est montré, au plus un toutes les 15 secondes.
   L'utilisateur ne voit JAMAIS de détail technique. Le détail (nom de l'erreur,
   message, page, heure) reste dans le journal, lisible dans Réglages ›
   Informations › Diagnostic (copiable pour me le transmettre).

   Le journal est LOCAL à l'appareil (clé acsc_erreurs) : jamais synchronisé,
   jamais exporté, jamais envoyé (règle R3 : un état d'appareil ne voyage pas).
   Ce module est chargé EN PREMIER dans chaque page et ne doit jamais lui-même
   provoquer d'erreur.
   ============================================================= */

const Erreurs = (() => {
    "use strict";

    const CLE_JOURNAL = "acsc_erreurs";
    const ENTREES_MAX = 30;
    const DELAI_ENTRE_MESSAGES_MS = 15000;
    const MESSAGE_UTILISATEUR = "Un problème est survenu. Si cela continue, recharge la page.";
    /* Alertes du navigateur sans conséquence, à ne pas présenter comme des pannes. */
    const BENIGNES = /ResizeObserver loop|Script error\.?$/i;

    let dernierMessage = 0;
    /* Les entrées de CETTE page sont aussi gardées en mémoire : si le stockage est plein ou refusé (justement le cas où l'on a le plus
       besoin du journal), il ne peut pas s'écrire, mais l'erreur reste consultable jusqu'au rechargement. */
    const tampon = [];

    function lireStockees() {
        try { return JSON.parse(localStorage.getItem(CLE_JOURNAL) || "[]"); } catch (e) { return []; }
    }

    function lire() {
        const stockees = lireStockees();
        const connues = new Set(stockees.map(x => x.t + "|" + x.contexte));
        return stockees.concat(tampon.filter(x => !connues.has(x.t + "|" + x.contexte))).slice(-ENTREES_MAX);
    }

    function ecrire(entrees) {
        try { localStorage.setItem(CLE_JOURNAL, JSON.stringify(entrees.slice(-ENTREES_MAX))); } catch (e) {
            /* Stockage plein ou refusé : le journal est facultatif, il ne doit jamais ajouter une erreur à une erreur. */
        }
    }

    function resumer(erreur) {
        if (!erreur) return "erreur inconnue";
        const nom = erreur.name && erreur.name !== "Error" ? erreur.name + " : " : "";
        return (nom + String(erreur.message || erreur)).replace(/\s+/g, " ").slice(0, 200);
    }

    function consigner(contexte, erreur, gravite) {
        try {
            const entree = { t: new Date().toISOString(), contexte: String(contexte).slice(0, 120), erreur: resumer(erreur), page: location.pathname.split("/").pop() || "Index.html", gravite: gravite || "info" };
            tampon.push(entree);
            if (tampon.length > ENTREES_MAX) tampon.shift();
            const entrees = lireStockees();
            entrees.push(entree);
            ecrire(entrees);
        } catch (e) { /* voir ecrire() */ }
    }

    function signaler(contexte, erreur) {
        consigner(contexte, erreur, "erreur");
        const maintenant = Date.now();
        if (maintenant - dernierMessage < DELAI_ENTRE_MESSAGES_MS) return;
        dernierMessage = maintenant;
        if (typeof AppLayout !== "undefined" && AppLayout.toast) AppLayout.toast(MESSAGE_UTILISATEUR);
    }

    const nombre = () => lire().length;
    const effacer = () => { tampon.length = 0; try { localStorage.removeItem(CLE_JOURNAL); } catch (e) { /* voir ecrire() */ } };

    /* Rapport lisible, à copier-coller : le plus récent en premier. Ne contient aucune donnée de clients. */
    function rapport(version) {
        const lignes = lire().slice().reverse().map(x => x.t.replace("T", " ").slice(0, 19) + " · " + x.page + " · " + x.contexte + " · " + x.erreur);
        return "AC SAT Campagne" + (version ? " " + version : "") + "\n" + (lignes.length ? lignes.join("\n") : "Aucun problème enregistré.");
    }

    window.addEventListener("error", (e) => {
        const erreur = e.error || e.message;
        if (BENIGNES.test(String((erreur && erreur.message) || erreur || ""))) return;
        signaler("erreur de script", erreur);
    });
    window.addEventListener("unhandledrejection", (e) => signaler("promesse non gérée", e.reason));

    return { consigner, signaler, lire, nombre, effacer, rapport };
})();
