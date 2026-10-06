/* =============================================================
   Nouveautes.js — « Quoi de neuf ? » avec photos de présentation

   À l'ouverture de l'application, si une nouveauté n'a pas encore été vue,
   une fenêtre l'annonce : à quoi elle sert, comment l'utiliser (étapes),
   et 1 à 3 photos de l'application avec des repères numérotés.
   - « Compris » : la nouveauté est marquée comme vue (sur cet appareil).
   - la croix (✕) : « plus tard » — elle sera reproposée à la prochaine ouverture.
   - toujours rouvrible : menu du profil › « 🎁 Nouveautés » (historique complet).
   Une seule annonce par session ; jamais pendant l'animation d'ouverture ni
   par-dessus une autre fenêtre ; jamais à la première installation (rien à
   expliquer à quelqu'un qui découvre l'application).

   POUR ANNONCER UNE NOUVELLE FONCTIONNALITÉ
   1. Ajouter ses photos : ajouter une fonction de capture dans
      Tests/navigateur/nouveautes-captures.mjs, puis « node nouveautes-captures.mjs »
      (données fictives, repères numérotés) ; noter les dimensions affichées.
   2. Ajouter un bloc EN TÊTE de la liste LISTE ci-dessous (la plus récente d'abord).
   Le test Tests/test31.js refuse un bloc incomplet, une photo absente, trop lourde,
   sans texte alternatif, ou dont les dimensions déclarées ne sont pas les vraies.
   ============================================================= */

const Nouveautes = (() => {
    "use strict";

    const esc = (t) => AppLayout.escapeHtml(t);
    const CLE = "acsc_nouveautes_vue";            // identifiant de la nouveauté la plus récente vue ; « * » = tout vu (tests, captures)
    const CLE_SESSION = "acsc_nouveautes_session";  // une annonce automatique par session

    /* La plus récente d'abord. images : 1 à 3 ; largeur / hauteur = dimensions RÉELLES du fichier (évite que la page saute au chargement).
       Dans les légendes, ① ② ③ renvoient aux repères dessinés sur la photo. */
    const LISTE = [
        {
            id: "planning-tableau-de-bord", version: "2026.10.06-a", date: "2026-10-06",
            titre: "Planning : le nouveau tableau de bord",
            resume: "Le Planning s'ouvre maintenant sur un tableau de bord : un calendrier par semaine, mois, trimestre ou année, la synthèse de tes visites (réalisées, planifiées, en retard, échéances) avec des pourcentages qui font toujours 100 %, et des graphiques mois par mois. Les vues Timeline et Mois restent disponibles.",
            etapes: [
                "Ouvre l'onglet « Planning » : le tableau de bord est la vue par défaut ; « Timeline » et « Mois » restent à un clic.",
                "Choisis la période ① : Semaine, Mois, Trimestre ou Année, avance avec ‹ › ; « Aujourd'hui » te ramène à la période en cours.",
                "Lis la synthèse ② : réalisées, planifiées, en retard et échéances à venir avec leur pourcentage (le total fait 100 %) ; tout se recalcule selon tes filtres.",
                "Touche un jour du calendrier ③ pour voir ses visites, rendez-vous, échéances et retards, et planifier si besoin.",
                "En équipe, le panneau « Techniciens » ① permet de passer d'un technicien à l'autre ; il s'ouvre sur toi, le technicien connecté.",
                "Plus bas, « Résumé & analyses » montre l'anneau de répartition et trois graphiques mois par mois, dont le retard exact à la fin de chaque mois."
            ],
            images: [
                { src: "Media/nouveautes/planning-tableau-v1.webp", largeur: 1032, hauteur: 673, alt: "Planning, tableau de bord : calendrier du mois avec le sélecteur de période, et la synthèse avec les quatre catégories de visites et leurs pourcentages.", legende: "① Période · ② Synthèse · ③ Calendrier" },
                { src: "Media/nouveautes/planning-techniciens-v1.webp", largeur: 640, hauteur: 721, alt: "Panneau repliable Techniciens à gauche du calendrier, avec Mes clients sélectionné et le nombre de clients de chaque technicien.", legende: "① Panneau Techniciens · ② Un technicien" },
                { src: "Media/nouveautes/planning-telephone-v1.webp", largeur: 780, hauteur: 1688, alt: "Calendrier du Planning sur téléphone : les jours portent des points colorés selon leurs événements et le jour d'aujourd'hui est marqué.", legende: "① Période · ② Aujourd'hui" }
            ],
            action: { libelle: "Ouvrir le Planning", href: "Planning.html" }
        },
        {
            id: "mises-a-jour", version: "2026.10.05-e", date: "2026-10-05",
            titre: "Mises à jour et nouveautés : l'application te prévient",
            resume: "Quand une nouvelle version est disponible, l'application te le propose dès l'ouverture en t'annonçant ce qu'elle apporte, puis te le rappelle sur ton profil. Tu peux aussi recevoir une notification, même application fermée.",
            etapes: [
                "À l'ouverture, une fenêtre « Mise à jour disponible » te dit ce que la version apporte ①. Touche « Mettre à jour maintenant » ② : l'application se recharge en quelques secondes, tes données restent intactes.",
                "Pas le moment ? Touche « Plus tard » : la fenêtre ne revient pas avant quelques heures.",
                "Tant que la mise à jour n'est pas installée, une pastille ① marque ton profil et le menu propose « ⬆️ Mise à jour disponible » ②.",
                "Dans Réglages › Informations : la version installée, sa date, l'état ① et le bouton « Mettre à jour maintenant » ②.",
                "Pour être prévenu même application fermée : active les notifications (Réglages › Notifications), puis laisse cochée « Me prévenir des mises à jour et des nouvelles fonctionnalités » dans Informations."
            ],
            images: [
                { src: "Media/nouveautes/maj-suggestion-v1.webp", largeur: 780, hauteur: 952, alt: "Fenêtre « Mise à jour disponible » : la version proposée, ce qu'elle apporte dans « Au programme », et les boutons Plus tard et Mettre à jour maintenant.", legende: "① Ce qu'elle apporte · ② Mettre à jour maintenant" },
                { src: "Media/nouveautes/maj-menu-v1.webp", largeur: 780, hauteur: 860, alt: "Menu du profil ouvert : pastille rouge sur le bouton du profil et entrée « Mise à jour disponible » en tête du menu.", legende: "① Pastille sur le profil · ② Entrée du menu" },
                { src: "Media/nouveautes/maj-informations-v1.webp", largeur: 780, hauteur: 1160, alt: "Réglages, onglet Informations : numéro de version, date, état « nouvelle version disponible » et bouton Mettre à jour maintenant.", legende: "① État de la version · ② Mettre à jour maintenant" }
            ],
            action: { libelle: "Ouvrir Réglages › Informations", href: "Reglages.html#informations" }
        },
        {
            id: "serti-rapport", version: "2026.10.05-b", date: "2026-10-05",
            titre: "Rapport de serti : Excel et PDF",
            resume: "Sors en quelques touches un rapport de tes contrôles de serti, sur la période, le client et la ligne de ton choix : un classeur Excel pour analyser, ou un aperçu à imprimer ou à enregistrer en PDF.",
            etapes: [
                "Ouvre l'onglet « Serti » (sur téléphone : menu du profil, en haut à droite).",
                "Touche « 📊 Rapport / export » : les filtres que tu avais choisis sont repris.",
                "Choisis la période (30 jours, 90 jours, cette année, tout), puis le client ① et la ligne ②.",
                "Touche « Excel (.xlsx) » ③ pour un classeur de 6 feuilles, dont une ligne par mesure, prête pour un tableau croisé.",
                "Ou touche « Aperçu et impression (PDF) », puis « Imprimer / enregistrer en PDF » : la synthèse, les têtes à surveiller et la comparaison avec le contrôle du client tiennent sur quelques pages."
            ],
            images: [
                { src: "Media/nouveautes/rapport-choix-v1.webp", largeur: 780, hauteur: 1280, alt: "Fenêtre « Rapport de serti » : choix des dates, du client et de la ligne, puis les boutons Aperçu et impression, et Excel.", legende: "① Client · ② Ligne · ③ Excel" },
                { src: "Media/nouveautes/rapport-apercu-v1.webp", largeur: 960, hauteur: 560, alt: "Aperçu du rapport de contrôle de serti : synthèse chiffrée, tableau des contrôles et statistiques par mesure.", legende: "① Synthèse · ② Imprimer / PDF" }
            ],
            action: { libelle: "Ouvrir l'onglet Serti", href: "Serti.html" }
        },
        {
            id: "serti-controle", version: "2026.10.04-b", date: "2026-10-04",
            titre: "Contrôle de serti, tête par tête",
            resume: "Saisis les mesures de serti pendant ta visite : chaque valeur est jugée tout de suite avec les tolérances du document SQ/EMB/067, et tu valides le contrôle par OUI ou NON. Tu peux y ajouter le contrôle du client (Seametal) pour comparer.",
            etapes: [
                "Ouvre « Enregistrer une visite » et choisis la ligne.",
                "Déplie « 🔬 Contrôle de serti » et choisis le nombre de têtes (une seule fois : il est retenu sur la ligne).",
                "Touche une tête ① puis saisis tes mesures : la pastille ② dit « Conforme », « Limite » ou « Hors tolérance » aussitôt.",
                "Choisis OUI ou NON (proposé d'après les mesures, tu peux le changer en notant un motif), puis enregistre la visite.",
                "Retrouve tous tes contrôles dans l'onglet « Serti » : les compteurs ① montrent combien sont validés ou non avant même d'ouvrir un contrôle.",
                "Pour comparer avec le client : « Comparaison » ① montre l'écart tête par tête ; les cases orange ② sont les écarts à regarder."
            ],
            images: [
                { src: "Media/nouveautes/serti-saisie-v1.webp", largeur: 780, hauteur: 1280, alt: "Formulaire de visite, bloc « Contrôle de serti » : rangée des têtes T1 à T5 et mesures avec leur verdict, dont une flange hors tolérance.", legende: "① Choisis la tête · ② Le verdict s'affiche tout de suite" },
                { src: "Media/nouveautes/serti-page-v1.webp", largeur: 780, hauteur: 1020, alt: "Page Serti sur téléphone : filtres, compteurs OUI, NON et à surveiller, puis la liste des contrôles.", legende: "① Compteurs OUI / NON · ② Ouvre un contrôle" },
                { src: "Media/nouveautes/serti-comparaison-v1.webp", largeur: 780, hauteur: 1600, alt: "Détail d'un contrôle, onglet Comparaison : valeurs manuelles et valeurs du client côte à côte, avec les écarts à regarder en orange.", legende: "① Onglet Comparaison · ② Écart à regarder" }
            ],
            action: { libelle: "Voir l'onglet Serti", href: "Serti.html" }
        }
    ];

    /* ---------- Ce qui a été vu ---------- */

    function lireVue() { try { return localStorage.getItem(CLE); } catch (e) { return null; } }
    function ecrireVue(id) { try { localStorage.setItem(CLE, id); } catch (e) { /* stockage refusé : on réessaiera */ } }
    function marquerToutVu() {
        if (LISTE.length) ecrireVue(LISTE[0].id);
        if (typeof AppLayout !== "undefined" && AppLayout.rafraichirNotifications) AppLayout.rafraichirNotifications();     /* la pastille du profil se met à jour */
    }

    /* Les nouveautés plus récentes que la dernière vue (toutes si rien n'a jamais été vu ou si l'identifiant a disparu de la liste). */
    function nonVues() {
        const v = lireVue();
        if (v === "*") return [];
        const i = LISTE.findIndex(x => x.id === v);
        return i === -1 ? LISTE.slice() : LISTE.slice(0, i);
    }

    const dateFr = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);

    /* ---------- Fenêtre ---------- */

    let etat = null;

    function figure(im) {
        return '<figure class="nouv-figure"><a href="' + esc(im.src) + '" target="_blank" rel="noopener" aria-label="Agrandir : ' + esc(im.alt) + '">' +
            '<img src="' + esc(im.src) + '" alt="' + esc(im.alt) + '" width="' + im.largeur + '" height="' + im.hauteur + '" loading="lazy" decoding="async"></a>' +
            '<figcaption>' + esc(im.legende) + '</figcaption></figure>';
    }

    function rendre() {
        const corps = document.getElementById("nouv-corps");
        if (!corps || !etat) return;
        const it = etat.items[etat.i], n = etat.items.length, dernier = etat.i === n - 1;
        corps.innerHTML =
            '<div class="nouv-entete"><span class="nouv-etiquette">' + (etat.tout ? "Nouveauté" : "Nouveau") + '</span>' +
            '<span class="texte-attenue">' + esc(dateFr(it.date)) + ' · version ' + esc(it.version) + '</span></div>' +
            '<h2 class="nouv-titre">' + esc(it.titre) + '</h2>' +
            '<p class="nouv-resume">' + esc(it.resume) + '</p>' +
            (it.images.length ? '<div class="nouv-galerie" role="region" aria-label="Photos de présentation" tabindex="0">' + it.images.map(figure).join("") + '</div>' +
                (it.images.length > 1 ? '<div class="nouv-points" role="group" aria-label="Choisir une photo">' + it.images.map((im, k) =>
                    '<button type="button" class="nouv-point' + (k === 0 ? " nouv-point--actif" : "") + '" data-nouv-photo="' + k + '" aria-label="Photo ' + (k + 1) + ' sur ' + it.images.length + '" aria-current="' + (k === 0 ? "true" : "false") + '"></button>').join("") + '</div>' : "") +
                '<p class="aide-champ nouv-astuce">Touche une photo pour l\'agrandir.</p>' : "") +
            '<h3 class="nouv-sous-titre">Comment l\'utiliser</h3>' +
            '<ol class="nouv-etapes">' + it.etapes.map(e => '<li>' + esc(e) + '</li>').join("") + '</ol>' +
            (n > 1 ? '<div class="nouv-nav" role="group" aria-label="Autres nouveautés">' +
                '<button type="button" class="bouton bouton--contour" data-nouv-nav="-1"' + (etat.i === 0 ? " disabled" : "") + '>‹ Précédent</button>' +
                '<span class="nouv-compteur texte-attenue" role="status" aria-label="Nouveauté ' + (etat.i + 1) + ' sur ' + n + '">' + (etat.i + 1) + '/' + n + '</span>' +
                '<button type="button" class="bouton bouton--contour" data-nouv-nav="1"' + (dernier ? " disabled" : "") + '>Suivant ›</button></div>' : "") +
            '<div class="nouv-actions">' +
            (it.action ? '<button type="button" class="bouton bouton--contour" data-nouv-action>' + esc(it.action.libelle) + '</button>' : "") +
            '<button type="button" class="bouton" data-nouv-compris>' + (etat.tout ? "Fermer" : "Compris") + '</button></div>';
        brancherGalerie(corps);
        corps.querySelectorAll("[data-nouv-nav]").forEach(b => b.addEventListener("click", () => {
            etat.i = Math.max(0, Math.min(n - 1, etat.i + Number(b.getAttribute("data-nouv-nav")))); rendre();
            const f = document.querySelector(".feuille"); if (f) f.scrollTop = 0;
        }));
        corps.querySelector("[data-nouv-compris]").addEventListener("click", () => { marquerToutVu(); AppLayout.fermerFeuille(); });
        const a = corps.querySelector("[data-nouv-action]");
        if (a) a.addEventListener("click", () => {
            marquerToutVu(); AppLayout.fermerFeuille();
            if (!location.pathname.endsWith("/" + it.action.href)) location.href = it.action.href;
        });
        const titre = corps.querySelector(".nouv-titre");      /* le focus va au titre (lecteurs d'écran), pas sur un bouton : pas de contour trompeur */
        if (titre) { titre.setAttribute("tabindex", "-1"); titre.focus({ preventScroll: true }); }
    }

    /* ---------- Points de navigation de la galerie (façon Instagram) ----------
       Le point actif = la photo la plus centrée ; au tout début c'est la première, au tout bout la dernière (la dernière ne peut jamais
       arriver au bord gauche). Un clic sur un point CENTRE sa photo (ou aligne la première / la dernière aux extrémités). Les points
       disparaissent quand toutes les photos tiennent à l'écran. Flèches gauche / droite au clavier sur la galerie. */
    function brancherGalerie(corps) {
        const g = corps.querySelector(".nouv-galerie"), pts = corps.querySelector(".nouv-points");
        if (!g) return;
        const figs = Array.from(g.querySelectorAll(".nouv-figure"));
        const dots = pts ? Array.from(pts.querySelectorAll(".nouv-point")) : [];
        const astuce = corps.querySelector(".nouv-astuce");
        const max = () => Math.max(0, g.scrollWidth - g.clientWidth);
        const actif = () => {
            if (g.scrollLeft <= 6) return 0;                         /* tolérance : l'accroche ou l'animation peuvent laisser quelques pixels */
            if (g.scrollLeft >= max() - 6) return figs.length - 1;
            const centre = g.scrollLeft + g.clientWidth / 2;
            let meilleur = 0, ecart = Infinity;
            figs.forEach((f, i) => { const e = Math.abs(f.offsetLeft + f.offsetWidth / 2 - centre); if (e < ecart) { ecart = e; meilleur = i; } });
            return meilleur;
        };
        const maj = () => {
            const defile = g.scrollWidth > g.clientWidth + 2;
            if (pts) pts.hidden = !defile;
            if (astuce) astuce.textContent = defile && pts ? "Fais glisser ou touche les points pour voir les autres photos · touche une photo pour l'agrandir." : "Touche une photo pour l'agrandir.";
            const a = actif();
            dots.forEach((d, i) => { d.classList.toggle("nouv-point--actif", i === a); d.setAttribute("aria-current", i === a ? "true" : "false"); });
        };
        /* Déplacement animé À LA MAIN (280 ms, mesuré sur l'horloge). Le défilement doux natif (scrollTo smooth) était interrompu par Chrome
           dès que l'accroche « mandatory » était rétablie en cours de route : le clic n'avait parfois aucun effet. Ici l'accroche est suspendue
           pendant le mouvement puis rétablie à l'arrivée (la position visée en est déjà une : aucun saut). Sans animation si « réduire les
           animations » est activé, ou si le navigateur n'a pas requestAnimationFrame. */
        const animer = (cible, doux) => {
            if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(g._anim);
            clearTimeout(g._garde);
            g.style.scrollSnapType = "none";
            const arrivee = () => {
                clearTimeout(g._garde); g.scrollLeft = cible; g.style.scrollSnapType = ""; maj(); };      /* maj() explicite : on n'attend pas l'événement « scroll », qui n'est émis qu'à l'image suivante */
            const depart = g.scrollLeft, delta = cible - depart;
            if (!doux || !delta || typeof requestAnimationFrame !== "function") { arrivee(); return; }
            /* Garde : si les « images » du navigateur sont suspendues en route (onglet passé à l'arrière-plan), l'arrivée est forcée : jamais bloquée à mi-chemin. */
            g._garde = setTimeout(() => { if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(g._anim); arrivee(); }, 420);
            const t0 = performance.now();
            const pas = (t) => {
                const k = Math.max(0, Math.min(1, ((t || performance.now()) - t0) / 280));
                g.scrollLeft = depart + delta * (1 - Math.pow(1 - k, 3)); maj();
                if (k < 1) g._anim = requestAnimationFrame(pas); else arrivee();
            };
            g._anim = requestAnimationFrame(pas);
        };
        const aller = (i) => {
            i = Math.max(0, Math.min(figs.length - 1, i));
            const f = figs[i];
            const cible = i === 0 ? 0 : i === figs.length - 1 ? max() : Math.max(0, Math.min(max(), f.offsetLeft - (g.clientWidth - f.offsetWidth) / 2));
            animer(cible, !(typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches));
        };
        dots.forEach((d, i) => d.addEventListener("click", () => aller(i)));
        g.addEventListener("scroll", maj, { passive: true });
        g.addEventListener("keydown", (e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            aller(actif() + (e.key === "ArrowRight" ? 1 : -1)); e.preventDefault();
        });
        g._majPoints = maj;       // rappelée quand la fenêtre change de taille (rotation du téléphone, redimensionnement)
        maj();
    }
    if (typeof window !== "undefined") window.addEventListener("resize", () => { const g = document.querySelector(".nouv-galerie"); if (g && g._majPoints) g._majPoints(); });

    /* opts : { tout: true } = l'historique complet (menu du profil) ; { derniere: true } = la plus récente seulement (Réglages › Informations) ;
       sinon les nouveautés non vues. Renvoie false s'il n'y a rien à montrer. */
    function ouvrir(opts) {
        const derniere = !!(opts && opts.derniere);
        const tout = !!(opts && opts.tout) || derniere;
        const items = derniere ? LISTE.slice(0, 1) : tout ? LISTE.slice() : nonVues();
        if (!items.length) return false;
        etat = { items, i: 0, tout };
        AppLayout.ouvrirFeuille("bas", tout ? "Nouveautés" : (items.length > 1 ? "Nouveautés (" + items.length + ")" : "Nouveauté"), '<div id="nouv-corps" class="nouv"></div>');
        rendre();
        return true;
    }

    /* Appelée à chaque ouverture de page. Patiente pendant l'animation d'ouverture ou si une fenêtre est déjà ouverte. */
    function annoncerSiBesoin() {
        try { if (sessionStorage.getItem(CLE_SESSION) === "1") return; } catch (e) { /* tant pis : au pire une annonce de plus */ }
        if (lireVue() === null && Donnees.listerClients().length === 0) { marquerToutVu(); return; }   // première installation
        if (!nonVues().length) return;
        let essais = 0;
        const tenter = () => {
            const occupe = document.documentElement.classList.contains("splash-actif") || !!document.querySelector(".feuille:not([hidden])");
            if (occupe) { if (essais++ < 40) setTimeout(tenter, 500); return; }       // trop occupé : reproposée à la prochaine ouverture
            try { sessionStorage.setItem(CLE_SESSION, "1"); } catch (e) { /* idem */ }
            ouvrir();
        };
        setTimeout(tenter, 900);
    }

    return { LISTE, ouvrir, annoncerSiBesoin, nonVues, nbNonVues: () => nonVues().length, marquerToutVu };
})();
