/* =============================================================
   AppLayout.js — Ossature de navigation (AC SAT Campagne)

   Repris d'AC SAT Field (même structure, mêmes classes CSS, même
   rendu) et allégé de ce qui n'a pas de sens pour un outil personnel :
   pas d'assistant IA, pas de notifications d'équipe, pas de sélecteur
   de langue, pas d'écran d'ouverture.

   Convention inchangée : chaque page HTML prépare des conteneurs vides
   (#entete, #bandeau-connexion, #nav-basse, .app-conteneur), ce module
   les remplit. Appeler AppLayout.init("<page>") après Donnees.init().
   ============================================================= */

const AppLayout = (() => {
    "use strict";

    /* Version livrée : la même valeur figure dans version.txt à la racine.
       Après une mise en ligne, ouvrir <site>/version.txt permet de vérifier
       que c'est bien cette version qui est en ligne. */
    const VERSION = "2026.10.02-a";

    /* Barre latérale ET navigation mobile se construisent depuis cette liste. */
    const ELEMENTS_NAV = [
        { page: "tableau", href: "Index.html", icone: "📋", libelle: "À visiter" },
        { page: "planning", href: "Planning.html", icone: "📅", libelle: "Planning" },
        { page: "tournee", href: "Tournee.html", icone: "🤖", libelle: "Tournée" },
        { page: "clients", href: "Clients.html", icone: "👥", libelle: "Clients" },
        { page: "documents", href: "Documents.html", icone: "📄", libelle: "Documents", court: "Docs" },
        { page: "reglages", href: "Reglages.html", icone: "⚙️", libelle: "Réglages" }
    ];
    /* Navigation mobile : 2 liens, le bouton « + » au centre, 2 liens.
       Réglages et Documents n'y figurent pas : ils sont dans l'en-tête
       (⚙️ et menu du profil). 4 liens + « + » = 5 colonnes de 72 px sur un
       écran de 360 px, avec des libellés lisibles. */
    const NB_AVANT_FAB = 2;
    const PAGES_HORS_BARRE_MOBILE = ["reglages", "documents"];

    let elVoile, elFeuille;

    /* ---------- Utilitaires ---------- */

    function escapeHtml(texte) {
        const div = document.createElement("div");
        div.textContent = texte == null ? "" : String(texte);
        return div.innerHTML;
    }

    function initiales(nom) {
        return (nom || "").split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase();
    }

    function appliquerTheme() {
        const theme = Donnees.getDonnees().profil.theme || "light";
        document.documentElement.classList.toggle("dark", theme === "dark");
    }

    function blocLogo(classe) {
        return '<a href="Index.html" class="' + classe + '">' +
            '<span class="entete-logo-icone"><img src="Images/logo.png" alt="AC SAT" onerror="this.hidden = true;"></span>' +
            '<span class="entete-logo-texte">' +
            '<span class="entete-logo-titre" style="display:block;">AC SAT</span>' +
            '<span class="entete-logo-sous-titre" style="display:block;">Campagnes</span>' +
            '</span></a>';
    }

    /* ---------- Feuilles coulissantes (bas / droite) ---------- */

    function creerConteneursFeuilles() {
        elVoile = document.createElement("div");
        elVoile.className = "voile";
        elVoile.hidden = true;
        elVoile.addEventListener("click", fermerFeuille);

        elFeuille = document.createElement("div");
        elFeuille.hidden = true;

        document.body.appendChild(elVoile);
        document.body.appendChild(elFeuille);
    }

    function ouvrirFeuille(cote, titre, corpsHtml) {
        elFeuille.className = "feuille " + (cote === "droite" ? "feuille--droite" : "feuille--bas");
        elFeuille.innerHTML =
            '<div class="feuille-titre"><span>' + escapeHtml(titre) + '</span>' +
            '<button type="button" class="feuille-bouton-fermer" aria-label="Fermer">✕</button></div>' +
            '<div>' + corpsHtml + '</div>';
        elFeuille.hidden = false;
        elVoile.hidden = false;
        elFeuille.querySelector(".feuille-bouton-fermer").addEventListener("click", fermerFeuille);
    }

    function fermerFeuille() {
        if (elFeuille) elFeuille.hidden = true;
        if (elVoile) elVoile.hidden = true;
    }

    /* ---------- Bandeau en ligne / hors ligne ---------- */

    function initBandeauConnexion() {
        const conteneur = document.getElementById("bandeau-connexion");
        if (!conteneur) return;

        function rendre(enLigne, vientDeRevenir) {
            if (enLigne && !vientDeRevenir) {
                conteneur.hidden = true;
                conteneur.textContent = "";
                return;
            }
            conteneur.hidden = false;
            conteneur.className = "bandeau-connexion " +
                (enLigne ? "bandeau-connexion--retabli" : "bandeau-connexion--hors-ligne");
            conteneur.textContent = enLigne
                ? "✅ Connexion rétablie"
                : "📶 Hors ligne — tes saisies restent enregistrées sur cet appareil";
        }

        rendre(navigator.onLine, false);
        window.addEventListener("online", () => {
            rendre(true, true);
            setTimeout(() => rendre(true, false), 3000);
        });
        window.addEventListener("offline", () => rendre(false, false));
    }

    /* ---------- Bandeau du haut (mobile uniquement, masqué en CSS sur ordinateur) ---------- */

    function construireEntete() {
        const conteneur = document.getElementById("entete");
        if (!conteneur) return;

        const barre = document.createElement("div");
        barre.className = "entete-barre";
        barre.innerHTML = blocLogo("entete-logo");

        const actions = document.createElement("div");
        actions.className = "entete-actions";
        actions.innerHTML =
            '<a href="Reglages.html" class="bouton-icone indicateur-synchro-icone" data-etat-synchro-icone aria-label="Synchronisation">☁️<span class="indicateur-synchro-point"></span></a>' +
            '<a href="Reglages.html" class="bouton-icone" aria-label="Réglages">⚙️</a>';
        actions.appendChild(construireMenuAvatar());

        barre.appendChild(actions);
        conteneur.appendChild(barre);
    }

    function construireMenuAvatar() {
        const conteneur = document.createElement("div");
        conteneur.className = "menu-avatar";

        const bouton = document.createElement("button");
        bouton.type = "button";
        bouton.className = "entete-avatar";
        bouton.setAttribute("aria-label", "Menu utilisateur");
        bouton.textContent = initiales(Donnees.getDonnees().profil.nom);

        const panneau = document.createElement("div");
        panneau.className = "menu-avatar-panneau";
        panneau.hidden = true;

        function rendrePanneau() {
            const profil = Donnees.getDonnees().profil;
            panneau.innerHTML =
                '<div class="menu-avatar-entete">' +
                '<div class="entete-avatar" style="cursor:default;">' + escapeHtml(initiales(profil.nom)) + '</div>' +
                '<div><div class="menu-avatar-nom">' + escapeHtml(profil.nom) + '</div>' +
                '<div class="menu-avatar-role">Technicien SAT</div></div>' +
                '</div>' +
                '<a href="Documents.html" class="menu-avatar-item">📄 Documents</a>' +
                '<a href="Reglages.html" class="menu-avatar-item">⚙️ Réglages &amp; sauvegarde</a>' +
                '<button type="button" class="menu-avatar-item" data-bascule-theme>' +
                (profil.theme === "dark" ? "☀️ Thème clair" : "🌙 Thème sombre") + '</button>';
            panneau.querySelector("[data-bascule-theme]").addEventListener("click", () => {
                Donnees.definirTheme(profil.theme === "dark" ? "light" : "dark");
                panneau.hidden = true;
            });
        }

        bouton.addEventListener("click", (e) => {
            e.stopPropagation();
            rendrePanneau();
            panneau.hidden = !panneau.hidden;
        });
        document.addEventListener("click", (e) => {
            if (!conteneur.contains(e.target)) panneau.hidden = true;
        });

        conteneur.appendChild(bouton);
        conteneur.appendChild(panneau);
        return conteneur;
    }

    /* ---------- Barre latérale (ordinateur uniquement) ---------- */

    function construireRailLateral(pageActuelle) {
        const profil = Donnees.getDonnees().profil;
        const rail = document.createElement("aside");
        rail.id = "rail-lateral";
        rail.className = "rail-lateral";

        rail.innerHTML =
            blocLogo("rail-lateral-logo") +
            '<a href="Reglages.html" class="rail-lateral-utilisateur">' +
            '<span class="entete-avatar" style="cursor:default;">' + escapeHtml(initiales(profil.nom)) + '</span>' +
            '<span><span class="rail-lateral-utilisateur-nom" style="display:block;">' + escapeHtml(profil.nom) + '</span>' +
            '<span class="rail-lateral-utilisateur-role">Technicien SAT</span></span>' +
            '</a>' +
            '<a href="Reglages.html" class="indicateur-synchro" data-etat-synchro>' +
            '<span class="indicateur-synchro-point"></span><span data-etat-synchro-texte>…</span></a>' +
            '<nav class="rail-lateral-nav">' +
            ELEMENTS_NAV.map(item => (
                '<a href="' + item.href + '" class="rail-lateral-lien' + (item.page === pageActuelle ? " actif" : "") + '">' +
                '<span class="rail-lateral-icone">' + item.icone + '</span><span>' + item.libelle + '</span>' +
                (item.page === "tableau" ? '<span class="badge-nombre" data-badge-a-visiter hidden style="position:static;margin-left:auto;">0</span>' : "") +
                '</a>'
            )).join("") +
            '</nav>';
        return rail;
    }

    /* Même mécanique qu'AC SAT Field : la barre latérale et le contenu sont
       regroupés dans .zone-avec-barre, sans toucher au HTML des pages. */
    function restructurerEnSidebar(pageActuelle) {
        if (document.getElementById("rail-lateral")) return;
        const entete = document.getElementById("entete");
        if (!entete || !entete.parentNode) return;

        const conteneurContenu = document.querySelector(".app-conteneur");
        const bandeau = document.getElementById("bandeau-connexion");
        const zone = document.createElement("div");
        zone.className = "zone-avec-barre";

        const pointInsertion = bandeau || entete;
        pointInsertion.parentNode.insertBefore(zone, pointInsertion.nextSibling);
        zone.appendChild(construireRailLateral(pageActuelle));
        if (conteneurContenu) zone.appendChild(conteneurContenu);
    }

    /* ---------- Navigation basse (mobile) ---------- */

    function construireNavBasse(pageActuelle) {
        const conteneur = document.getElementById("nav-basse");
        if (!conteneur) return;

        const grille = document.createElement("div");
        grille.className = "nav-basse-grille";
        /* Le CSS d'origine prévoit 7 colonnes (6 liens + « + ») : on adapte
           au nombre réel de liens pour ne pas laisser de cases vides. */
        const liens = ELEMENTS_NAV.filter(item => PAGES_HORS_BARRE_MOBILE.indexOf(item.page) === -1);
        grille.style.gridTemplateColumns = "repeat(" + (liens.length + 1) + ", minmax(0, 1fr))";

        function creerLien(item) {
            const lien = document.createElement("a");
            lien.href = item.href;
            lien.className = "nav-basse-lien" + (item.page === pageActuelle ? " actif" : "");
            lien.innerHTML =
                '<span class="nav-basse-icone">' + item.icone + '</span>' +
                '<span>' + (item.court || item.libelle) + '</span>' +
                (item.page === "tableau" ? '<span class="badge-nombre" data-badge-a-visiter hidden>0</span>' : "");
            return lien;
        }

        liens.slice(0, NB_AVANT_FAB).forEach(item => grille.appendChild(creerLien(item)));

        const centre = document.createElement("div");
        centre.className = "fab-conteneur";
        const fab = document.createElement("button");
        fab.type = "button";
        fab.className = "fab-bouton";
        fab.setAttribute("aria-label", "Nouvelle action");
        fab.textContent = "+";
        fab.addEventListener("click", ouvrirActionsRapides);
        centre.appendChild(fab);
        grille.appendChild(centre);

        liens.slice(NB_AVANT_FAB).forEach(item => grille.appendChild(creerLien(item)));
        conteneur.appendChild(grille);
    }

    function ouvrirActionsRapides() {
        ouvrirFeuille("bas", "Nouvelle action",
            '<button type="button" class="feuille-action-item" data-action="visite">' +
            '<span class="feuille-action-icone">✅</span>Enregistrer une visite</button>' +
            '<button type="button" class="feuille-action-item" data-action="rdv">' +
            '<span class="feuille-action-icone">📅</span>Planifier une visite</button>' +
            '<button type="button" class="feuille-action-item" data-action="client">' +
            '<span class="feuille-action-icone">👤</span>Nouveau client</button>');
        elFeuille.querySelector('[data-action="visite"]').addEventListener("click", () => Formulaires.visite());
        elFeuille.querySelector('[data-action="client"]').addEventListener("click", () => Formulaires.client());
        elFeuille.querySelector('[data-action="rdv"]').addEventListener("click", () => Formulaires.rdv());
    }

    /* Pastille « À visiter » : lignes en retard + jamais vues cette campagne. */
    function rafraichirBadges() {
        const n = Donnees.calculerEcheances().lignes
            .filter(e => e.statut === "retard" || e.statut === "jamais").length;
        document.querySelectorAll("[data-badge-a-visiter]").forEach(b => {
            b.hidden = n === 0;
            b.textContent = n > 99 ? "99+" : String(n);
        });
    }

    /* ---------- Indicateur de synchronisation ---------- */

    const LIBELLES_SYNCHRO = {
        "verification": "Connexion…",
        "deconnecte": "Synchro désactivée — se connecter",
        "en-cours": "Synchronisation…",
        "ok": "Synchronisé",
        "hors-ligne": "Hors ligne",
        "erreur": "Erreur de synchro",
        "indisponible": "Synchro indisponible"
    };

    function afficherEtatSynchro(e) {
        const attente = Donnees.nbEnAttente();
        let texte = LIBELLES_SYNCHRO[e.statut] || e.statut;
        if (e.statut === "ok" && e.derniere) {
            texte += " · " + new Date(e.derniere).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        }
        if ((e.statut === "hors-ligne" || e.statut === "erreur") && attente > 0) texte += " · " + attente + " en attente";
        document.querySelectorAll("[data-etat-synchro], [data-etat-synchro-icone]").forEach(el => {
            el.setAttribute("data-statut", e.statut);
            el.title = texte + (e.erreur ? " — " + e.erreur : "");
        });
        document.querySelectorAll("[data-etat-synchro-texte]").forEach(el => { el.textContent = texte; });
    }

    /* Application installable sur téléphone : le service worker garde une
       copie des fichiers pour ouvrir l'application sans réseau.
       Uniquement en https (ou localhost), comme l'exigent les navigateurs. */
    function enregistrerServiceWorker() {
        if (!("serviceWorker" in navigator)) return;
        const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
        if (location.protocol !== "https:" && !local) return;
        navigator.serviceWorker.register("sw.js").catch(() => { /* l'application fonctionne sans */ });
    }

    /* ---------- Toast ---------- */

    function toast(message) {
        const el = document.createElement("div");
        el.textContent = message;
        el.style.cssText =
            "position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));" +
            "transform:translateX(-50%);background:var(--texte);color:var(--fond);" +
            "padding:10px 16px;border-radius:999px;font-size:0.85rem;font-weight:600;" +
            "box-shadow:var(--ombre-elevee);z-index:1100;max-width:90vw;text-align:center;";
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3500);
    }

    /* Message avec un bouton d'action (ex. « Annuler » après une suppression). */
    function toastAction(message, libelle, action, dureeMs) {
        const el = document.createElement("div");
        el.setAttribute("role", "status");
        el.style.cssText =
            "position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));" +
            "transform:translateX(-50%);background:var(--texte);color:var(--fond);" +
            "padding:6px 8px 6px 16px;border-radius:999px;font-size:0.85rem;font-weight:600;" +
            "box-shadow:var(--ombre-elevee);z-index:1100;max-width:92vw;display:flex;align-items:center;gap:10px;";
        const texte = document.createElement("span");
        texte.textContent = message;
        const bouton = document.createElement("button");
        bouton.type = "button";
        bouton.textContent = libelle;
        bouton.style.cssText = "border:none;border-radius:999px;padding:0 14px;min-height:36px;font:inherit;font-weight:700;" +
            "background:var(--primaire);color:var(--primaire-texte);cursor:pointer;";
        bouton.addEventListener("click", () => { el.remove(); action(); });
        el.appendChild(texte);
        el.appendChild(bouton);
        document.body.appendChild(el);
        setTimeout(() => el.remove(), dureeMs || 10000);
        return el;
    }

    /* ---------- Point d'entrée ---------- */

    function init(pageActuelle) {
        appliquerTheme();
        Donnees.ecouter(appliquerTheme);
        Donnees.ecouter(rafraichirBadges);

        let alerteStockageAffichee = false;
        Donnees.surErreurStockage(() => {
            if (alerteStockageAffichee) return;
            alerteStockageAffichee = true;
            toast("⚠️ Enregistrement refusé par le navigateur — exporte une sauvegarde depuis Réglages");
        });

        creerConteneursFeuilles();
        initBandeauConnexion();
        construireEntete();
        restructurerEnSidebar(pageActuelle);
        construireNavBasse(pageActuelle);
        rafraichirBadges();

        if (typeof Synchro !== "undefined") {
            Synchro.ecouter(afficherEtatSynchro);
            Donnees.ecouter(() => afficherEtatSynchro(Synchro.etat()));
        } else {
            afficherEtatSynchro({ statut: "indisponible", erreur: "Js/Synchro.js non chargé" });
        }
        enregistrerServiceWorker();
    }

    return { init, ouvrirFeuille, fermerFeuille, toast, toastAction, escapeHtml, VERSION };
})();
