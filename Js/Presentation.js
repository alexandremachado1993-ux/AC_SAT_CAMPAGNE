/* =============================================================
   Presentation.js — présentation de première connexion (mobile)

   Trois écrans animés, une seule fois par appareil : bienvenue, les quatre pages de la barre du bas, et le geste « glisser vers le
   haut » qui ouvre le menu étendu (Serti, Documents) — avec la démonstration du geste et le choix de l'essayer pour de vrai.
   Réservée aux NOUVELLES installations (aucune nouveauté encore vue, aucun client) et aux écrans de téléphone (< 768 px) : sur ordinateur,
   la barre latérale montre déjà tout. Rejouable depuis Réglages › Informations. L'état « déjà vue » est LOCAL à l'appareil
   (clé acsc_presentation_vue) : il ne voyage jamais avec les données (règle R3 du skill ac-sat-campagne).
   Les animations sont en CSS (.pres-*) et se figent sur l'état final si l'utilisateur a demandé moins de mouvement.
   ============================================================= */

const Presentation = (() => {
    "use strict";

    const CLE_VUE = "acsc_presentation_vue";
    const LARGEUR_MAX_MOBILE = 768;
    const ATTENTE_MAX_MS = 24000;         // la présentation attend la fin de l'animation d'ouverture et des autres fenêtres
    const DELAI_ESSAI_MS = 450;           // après « Essayer le geste » : le temps que la présentation s'efface avant d'ouvrir le vrai tiroir

    const ETAPES = [
        { scene: 1, titre: "Bienvenue dans AC SAT Campagnes", texte: "Suis tes visites de campagne, tes rendez-vous et tes contrôles de serti, même sans réseau." },
        { scene: 2, titre: "L'essentiel sous le pouce", texte: "Quatre pages dans la barre du bas, et le bouton + pour enregistrer une visite, planifier ou ajouter un client." },
        { scene: 3, titre: "Glisse vers le haut pour plus d'outils", texte: "Fais glisser la barre du bas vers le haut (ou touche la languette ⌃) : le Contrôle de serti et les Documents apparaissent." }
    ];

    let racine = null, etape = 0, declencheur = null;

    const dejaVue = () => { try { return localStorage.getItem(CLE_VUE) === "1"; } catch (e) { Erreurs.consigner("Presentation : lecture impossible, considérée comme déjà vue", e); return true; } };
    function marquerVue() { try { localStorage.setItem(CLE_VUE, "1"); } catch (e) { Erreurs.consigner("Presentation : état « vue » non enregistré", e); } }

    /* Illustrations (décoratives, masquées aux lecteurs d'écran : le texte porte l'information). */
    const MAQUETTE = '<div class="pres-tel" aria-hidden="true"><div class="pres-tel-ecran">' +
        '<div class="pres-tel-entete"><i></i><b></b></div><div class="pres-tel-carte"></div><div class="pres-tel-carte"></div><div class="pres-tel-carte pres-tel-carte--court"></div>' +
        '%TIROIR%<div class="pres-barre"><span>📋</span><span>📅</span><span class="pres-fab">+</span><span>🤖</span><span>👥</span></div></div>%DOIGT%</div>';
    const SCENES = {
        1: '<div class="pres-scene pres-scene--1" aria-hidden="true"><div class="pres-logo"><img src="Images/logo.png" alt="" width="96" height="96"></div>' +
            '<div class="pres-puces"><span style="--i:0">📋 À visiter</span><span style="--i:1">📅 Planning</span><span style="--i:2">🤖 Tournée</span><span style="--i:3">👥 Clients</span></div></div>',
        2: '<div class="pres-scene pres-scene--2" aria-hidden="true">' + MAQUETTE.replace("%TIROIR%", "").replace("%DOIGT%", "") + '</div>',
        3: '<div class="pres-scene pres-scene--3" aria-hidden="true">' + MAQUETTE.replace("%TIROIR%",
            '<div class="pres-tiroir"><div class="pres-tiroir-carte" style="--i:0"><span>📏</span><b>Contrôle de serti</b></div><div class="pres-tiroir-carte" style="--i:1"><span>📄</span><b>Documents</b></div></div>')
            .replace("%DOIGT%", '<div class="pres-doigt"></div>') + '</div>'
    };

    function construire(essaiPossible) {
        const el = document.createElement("div");
        el.className = "pres"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
        el.setAttribute("aria-labelledby", "pres-titre"); el.setAttribute("aria-describedby", "pres-texte");
        el.tabIndex = -1;
        el.innerHTML = '<button type="button" class="pres-passer" data-passer>Passer</button>' +
            '<div class="pres-scenes">' + ETAPES.map(e => SCENES[e.scene]).join("") + '</div>' +
            '<div class="pres-bas"><h2 id="pres-titre" class="pres-titre"></h2><p id="pres-texte" class="pres-texte"></p>' +
            '<div class="pres-points" aria-hidden="true">' + ETAPES.map(() => "<span></span>").join("") + '</div>' +
            '<div class="pres-actions"><button type="button" class="bouton bouton--contour pres-retour" data-retour>Retour</button>' +
            '<button type="button" class="bouton pres-suivant" data-suivant>Suivant</button>' +
            (essaiPossible ? '<button type="button" class="bouton bouton--contour pres-terminer" data-terminer>Terminer</button>' : "") + '</div></div>';
        return el;
    }

    function montrer(n) {
        etape = Math.max(0, Math.min(ETAPES.length - 1, n));
        const e = ETAPES[etape], derniere = etape === ETAPES.length - 1, essai = !!racine.querySelector("[data-terminer]");
        racine.querySelectorAll(".pres-scene").forEach((s, i) => s.classList.toggle("actif", i === etape));
        racine.querySelectorAll(".pres-points span").forEach((p, i) => p.classList.toggle("actif", i === etape));
        racine.querySelector("#pres-titre").textContent = e.titre;
        racine.querySelector("#pres-texte").textContent = e.texte;
        racine.querySelector("[data-retour]").hidden = etape === 0;
        racine.querySelector("[data-passer]").hidden = derniere;
        const suivant = racine.querySelector("[data-suivant]");
        suivant.textContent = derniere ? (essai ? "Essayer le geste" : "Terminer") : "Suivant";
        const terminer = racine.querySelector("[data-terminer]"); if (terminer) terminer.hidden = !derniere;
        racine.dataset.etape = String(etape + 1);
    }

    function fermer(essayer) {
        if (!racine) return;
        const el = racine; racine = null;
        el.classList.add("pres--sortie");
        setTimeout(() => el.remove(), 320);
        if (declencheur && document.contains(declencheur) && typeof declencheur.focus === "function") declencheur.focus({ preventScroll: true });
        declencheur = null;
        if (essayer && typeof AppLayout !== "undefined" && AppLayout.ouvrirOutils) setTimeout(() => AppLayout.ouvrirOutils(), DELAI_ESSAI_MS);
    }

    function afficher() {
        if (racine) return;
        declencheur = document.activeElement;
        const essaiPossible = window.innerWidth < LARGEUR_MAX_MOBILE;      // le menu étendu n'existe qu'en mobile
        racine = construire(essaiPossible);
        document.body.appendChild(racine);
        marquerVue();
        montrer(0);
        racine.addEventListener("click", (e) => {
            if (e.target.closest("[data-passer]")) fermer(false);
            else if (e.target.closest("[data-retour]")) montrer(etape - 1);
            else if (e.target.closest("[data-terminer]")) fermer(false);
            else if (e.target.closest("[data-suivant]")) { if (etape < ETAPES.length - 1) montrer(etape + 1); else fermer(essaiPossible); }
        });
        racine.addEventListener("keydown", (e) => {
            if (e.key === "Escape") { e.preventDefault(); fermer(false); }
            else if (e.key === "ArrowRight" && etape < ETAPES.length - 1) montrer(etape + 1);
            else if (e.key === "ArrowLeft" && etape > 0) montrer(etape - 1);
            else if (e.key === "Tab") {
                const cibles = Array.from(racine.querySelectorAll("button")).filter(b => !b.hidden);
                if (!cibles.length) return;
                const premier = cibles[0], dernier = cibles[cibles.length - 1];
                if (e.shiftKey && (document.activeElement === premier || document.activeElement === racine)) { e.preventDefault(); dernier.focus(); }
                else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
            }
        });
        racine.focus({ preventScroll: true });
    }

    /* Nouvelle installation = aucune nouveauté encore vue et aucun client (même critère que les nouveautés, qui s'en servent pour ne pas
       annoncer à quelqu'un qui n'a encore rien vu). La décision est prise ICI, tout de suite ; l'affichage attend la fin de l'animation
       d'ouverture et des autres fenêtres. */
    function afficherSiPremiere() {
        if (dejaVue() || window.innerWidth >= LARGEUR_MAX_MOBILE) return;
        let nouvelle = false;
        try { nouvelle = localStorage.getItem("acsc_nouveautes_vue") === null && Donnees.listerClients().length === 0; } catch (e) { Erreurs.consigner("Presentation : première installation indéterminée", e); }
        if (!nouvelle) return;
        const debut = Date.now();
        (function tenter() {
            if (racine || dejaVue()) return;
            const occupe = document.documentElement.classList.contains("splash-actif") || !!document.querySelector(".feuille:not([hidden])");
            if (!occupe) { afficher(); return; }
            if (Date.now() - debut < ATTENTE_MAX_MS) setTimeout(tenter, 500);
        })();
    }

    return { afficherSiPremiere, afficher, dejaVue };
})();
