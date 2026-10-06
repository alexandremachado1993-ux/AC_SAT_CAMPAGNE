/* =============================================================
   PlanningTableau.js — Affichage du tableau de bord du Planning

   Construit du HTML à partir des résultats de PlanningCalcul.analyser (aucun
   accès direct aux données : les noms et les couleurs de type de visite sont
   fournis par « ctx »). Planning.js assemble la page et branche les actions.

   Couleurs = celles de l'application (comme la timeline) :
     réalisées = vert · planifiées = violet · en retard = rouge ·
     échéances = orange · maintenance = bleu · autres types = couleur du type.
   Chaque couleur passe par Donnees.styleCouleur : texte assombri en thème
   clair, éclairci en thème sombre (classes « pastille-couleur » / « texte-couleur »).
   ============================================================= */

const PlanningTableau = (() => {
    "use strict";

    const C = PlanningCalcul;
    const esc = (t) => AppLayout.escapeHtml(t);
    const style = (hex) => Donnees.styleCouleur(hex);

    const COULEURS = { realisees: "#16a34a", planifiees: "#7c3aed", retard: "#dc2626", echeances: "#f97316" };
    const ICONES = { total: "🗓️", realisees: "✅", planifiees: "📌", retard: "❗", echeances: "⏱️" };
    const LIBELLES = { realisees: "Réalisées", planifiees: "Planifiées", retard: "En retard", echeances: "Échéances à venir" };
    const AIDES = {
        realisees: "Visites effectuées dont la date tombe dans la période",
        planifiees: "Rendez-vous à venir (aujourd'hui compris) dans la période",
        retard: "Lignes en retard ou jamais vues à la fin de la période (aujourd'hui si elle est en cours), plus les rendez-vous passés non réalisés",
        echeances: "Lignes à jour dont la prochaine visite tombe dans le reste de la période"
    };
    const GENRE_CAT = { realisee: "realisees", planifiee: "planifiees", retard: "retard", echeance: "echeances" };
    const LIBELLE_GENRE = { realisee: "Réalisée", planifiee: "Planifiée", retard: "En retard", echeance: "Échéance" };
    const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
    const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    const GRAN_LIBELLES = { semaine: "Semaine", mois: "Mois", trimestre: "Trimestre", annee: "Année" };
    const PRECEDENTE = { semaine: "sem. précédente", mois: "mois précédent", trimestre: "trim. précédent", annee: "an dernier" };
    const PERIODE_COURANTE = { semaine: "cette semaine", mois: "ce mois-ci", trimestre: "ce trimestre", annee: "cette année" };

    const jourLong = (iso) => { const d = C.parse(iso), n = d.getUTCDate(); return JOURS[(d.getUTCDay() + 6) % 7] + " " + n + (n === 1 ? "er" : "") + " " + C.MOIS[d.getUTCMonth()]; };
    const pl = (n, un, plusieurs) => n + " " + (n > 1 ? plusieurs : un);

    const couleurEv = (e, ctx) => e.genre === "realisee" ? ctx.couleurRealisee(e.typeVisite) : COULEURS[GENRE_CAT[e.genre]];
    const libelleEv = (e, ctx) => e.genre === "realisee" ? ctx.typeLibelle(e.typeVisite)
        : e.genre === "retard" ? (e.jamais ? "Jamais vue" : e.rdvDepasse ? "Rendez-vous dépassé" : "Retard")
        : e.genre === "planifiee" ? "Planifié" : "Échéance";

    function resumeJour(evs) {
        const n = {}; evs.forEach(e => { n[e.genre] = (n[e.genre] || 0) + 1; });
        return [["realisee", "réalisée", "réalisées"], ["planifiee", "planifiée", "planifiées"], ["retard", "en retard", "en retard"], ["echeance", "échéance", "échéances"]]
            .filter(x => n[x[0]]).map(x => pl(n[x[0]], x[1], x[2])).join(", ");
    }

    /* ---------- Cartes de chiffres ---------- */

    function evolution(cle, a, prec, p) {
        if (cle !== "realisees" && cle !== "retard") return "";          // planifiées et échéances n'existent pas dans le passé : comparaison sans sens
        const ev = C.evolution(a.comptes[cle], prec.comptes[cle]);
        const mot = ev.sens === "hausse" ? "▲ +" + ev.delta : ev.sens === "baisse" ? "▼ −" + Math.abs(ev.delta) : "＝ stable";
        const lecteur = ev.sens === "stable" ? "stable" : (ev.sens === "hausse" ? "en hausse de " : "en baisse de ") + Math.abs(ev.delta);
        return '<span class="pt-evol pt-evol--' + ev.sens + '" aria-label="' + esc(lecteur + " par rapport à " + PRECEDENTE[p.gran]) + '">' + mot + ' <span class="pt-evol-ref" aria-hidden="true">vs ' + PRECEDENTE[p.gran] + '</span></span>';
    }

    function cartes(a, prec) {
        const c = a.comptes, p = a.periode;
        const carte = (cle) => '<div class="carte pt-carte" title="' + esc(AIDES[cle]) + '">' +
            '<span class="pt-carte-icone pastille-couleur" style="' + style(COULEURS[cle]) + '" aria-hidden="true">' + ICONES[cle] + '</span>' +
            '<div class="pt-carte-corps"><span class="pt-carte-libelle">' + LIBELLES[cle] + '</span>' +
            '<div class="pt-carte-ligne"><strong class="pt-carte-valeur">' + c[cle] + '</strong>' +
            (c.total ? '<em class="texte-couleur pt-pct" style="' + style(COULEURS[cle]) + '">' + a.pourcents[cle] + ' %</em>' : "") + '</div>' + evolution(cle, a, prec, p) + '</div></div>';
        return '<div class="pt-cartes">' +
            '<div class="carte pt-carte pt-carte--total" title="Réalisées + planifiées + en retard + échéances à venir sur la période">' +
            '<span class="pt-carte-icone" aria-hidden="true">' + ICONES.total + '</span><div class="pt-carte-corps"><span class="pt-carte-libelle">Total visites prévues</span>' +
            '<div class="pt-carte-ligne"><strong class="pt-carte-valeur">' + c.total + '</strong></div></div></div>' +
            C.CATEGORIES.map(carte).join("") +
            '<div class="carte pt-carte pt-carte--periode"><div class="pt-carte-corps"><span class="pt-carte-libelle">Période affichée</span>' +
            '<strong class="pt-periode-texte">' + esc(C.libelle(p)) + ' <span aria-hidden="true">📅</span></strong></div></div></div>';
    }

    /* ---------- Barre « Visites par statut » : les pourcentages font 100 ---------- */

    function barreStatut(a) {
        const c = a.comptes;
        if (!c.total) return '<section class="carte pt-synthese"><h2 class="pt-h2">Visites par statut</h2><p class="texte-attenue">Aucune visite sur cette période.</p></section>';
        const lecteur = C.CATEGORIES.filter(k => c[k]).map(k => LIBELLES[k] + " " + c[k] + " (" + a.pourcents[k] + " %)").join(", ");
        return '<section class="carte pt-synthese"><h2 class="pt-h2">Visites par statut</h2>' +
            '<div class="pt-barre" role="img" aria-label="' + esc("Répartition : " + lecteur) + '">' +
            C.CATEGORIES.filter(k => c[k]).map(k => '<span style="width:' + a.pourcents[k] + '%;background:' + COULEURS[k] + '"></span>').join("") + '</div>' +
            '<ul class="pt-legende">' + C.CATEGORIES.map(k => '<li><span class="pt-pastille" style="background:' + COULEURS[k] + '" aria-hidden="true"></span>' +
                '<span class="pt-legende-nom">' + LIBELLES[k] + '</span><strong>' + c[k] + '</strong><span class="pt-pct texte-attenue">' + a.pourcents[k] + ' %</span></li>').join("") + '</ul>' +
            '<p class="pt-total-pct texte-attenue">Total : ' + pl(c.total, "visite", "visites") + ' · 100 %</p></section>';
    }

    /* ---------- Calendrier ---------- */

    /* Pastille d'un événement : raccourci à la SOURIS vers le détail du jour. Pas un bouton : le bouton du jour (toute la case) donne déjà
       accès à tout, au clavier et aux lecteurs d'écran, avec le résumé des événements. */
    function puce(e, ctx) {
        const nom = ctx.nomClient(e.clientId), lib = libelleEv(e, ctx);
        return '<span class="pt-puce pt-puce--' + e.genre + ' pastille-couleur" role="presentation" aria-hidden="true" style="' + style(couleurEv(e, ctx)) + '" data-jour="' + e.date + '" title="' + esc(LIBELLE_GENRE[e.genre] + " · " + nom + " — " + lib) + '">' +
            '<span class="pt-puce-point" aria-hidden="true"></span><span class="pt-puce-texte">' + esc(nom) + ' — ' + esc(lib) + '</span></span>';
    }

    function tableau(semaines, parJour, ctx, toutAfficher) {
        const limite = toutAfficher ? 999 : 2;
        return '<div class="pt-defile"><table class="pt-mois' + (toutAfficher ? " pt-mois--semaine" : "") + '"><thead><tr>' + JOURS_COURTS.map(j => '<th scope="col">' + j + '</th>').join("") + '</tr></thead><tbody>' +
            semaines.map(sem => '<tr>' + sem.map((j, i) => {
                const evs = parJour[j.date] || [];
                return '<td class="pt-cell' + (j.horsMois ? " pt-cell--hors" : "") + (j.date === ctx.aujourdhui ? " pt-cell--aujourdhui" : "") + (i > 4 ? " pt-cell--weekend" : "") + '">' +
                    '<button type="button" class="pt-num" data-jour="' + j.date + '"' + (j.date === ctx.aujourdhui ? ' aria-current="date"' : "") + ' aria-label="' + esc(jourLong(j.date) + (evs.length ? " : " + resumeJour(evs) : " : rien de prévu")) + '"><span class="pt-num-n">' + Number(j.date.slice(8)) + '</span></button>' +
                    '<div class="pt-puces">' + evs.slice(0, limite).map(e => puce(e, ctx)).join("") +
                    (evs.length > limite ? '<button type="button" class="pt-plus" data-jour="' + j.date + '" aria-label="' + esc(pl(evs.length - limite, "autre événement", "autres événements") + " le " + jourLong(j.date)) + '">+' + (evs.length - limite) + '</button>' : "") + '</div></td>';
            }).join("") + '</tr>').join("") + '</tbody></table></div>';
    }

    function miniMois(debut, parJour, ctx) {
        const b = C.bornes("mois", debut);
        return '<div class="pt-mini"><button type="button" class="pt-mini-titre" data-pt-zoom="' + b.debut + '" aria-label="' + esc("Ouvrir " + C.libelle(b)) + '">' + esc(C.libelle(b)) + '</button>' +
            '<table class="pt-mini-table"><thead><tr>' + JOURS_COURTS.map(j => '<th scope="col" aria-label="' + j + '">' + j.charAt(0) + '</th>').join("") + '</tr></thead><tbody>' +
            C.grilleMois(b.debut).map(sem => '<tr>' + sem.map(j => {
                if (j.horsMois) return '<td class="pt-mini-vide"></td>';
                const evs = parJour[j.date] || [], genres = Array.from(new Set(evs.map(e => e.genre)));
                return '<td><button type="button" class="pt-mini-jour' + (j.date === ctx.aujourdhui ? " pt-mini-jour--aujourdhui" : "") + '" data-jour="' + j.date + '" aria-label="' + esc(jourLong(j.date) + (evs.length ? " : " + resumeJour(evs) : " : rien de prévu")) + '">' + Number(j.date.slice(8)) +
                    (genres.length ? '<span class="pt-points" aria-hidden="true">' + genres.slice(0, 3).map(g => '<i style="background:' + COULEURS[GENRE_CAT[g]] + '"></i>').join("") + '</span>' : "") + '</button></td>';
            }).join("") + '</tr>').join("") + '</tbody></table></div>';
    }

    function liste(a, ctx) {
        if (!a.evenements.length) return '<div class="etat-vide">Rien sur cette période avec ces filtres.</div>';
        const jours = {}; a.evenements.forEach(e => (jours[e.date] = jours[e.date] || []).push(e));
        return '<ul class="pt-liste">' + Object.keys(jours).sort().map(d => '<li><h3 class="pt-liste-date">' + esc(jourLong(d)) + '</h3><ul>' + jours[d].map(e =>
            '<li><button type="button" class="pt-ligne" data-jour="' + d + '"><span class="pastille-statut pastille-couleur" style="' + style(couleurEv(e, ctx)) + '">' + LIBELLE_GENRE[e.genre] + '</span>' +
            '<strong>' + esc(ctx.nomClient(e.clientId)) + '</strong><span class="texte-attenue">' + esc(libelleEv(e, ctx)) + '</span></button></li>').join("") + '</ul></li>').join("") + '</ul>';
    }

    /* e : { affichage: "calendrier" | "liste" } */
    function calendrier(a, e, ctx) {
        const p = a.periode, parJour = {};
        a.evenements.forEach(ev => (parJour[ev.date] = parJour[ev.date] || []).push(ev));
        let corps;
        if (e.affichage === "liste") corps = liste(a, ctx);
        else if (p.gran === "mois") corps = tableau(C.grilleMois(p.debut), parJour, ctx, false);
        else if (p.gran === "semaine") corps = tableau([C.jours(p.debut, p.fin).map(d => ({ date: d, horsMois: false }))], parJour, ctx, true);
        else {
            const a0 = C.parse(p.debut).getUTCFullYear(), m0 = C.parse(p.debut).getUTCMonth(), n = p.gran === "trimestre" ? 3 : 12;
            corps = '<div class="pt-minis pt-minis--' + n + '">' + Array.from({ length: n }, (_, i) => miniMois(C.fmt(new Date(Date.UTC(a0, m0 + i, 1))), parJour, ctx)).join("") + '</div>';
        }
        return '<section class="carte pt-calendrier" aria-label="Calendrier"><div class="pt-entete">' +
            '<div class="bascule-vue" role="group" aria-label="Affichage"><button type="button" class="bascule-vue-bouton' + (e.affichage === "liste" ? "" : " actif") + '" data-pt-affichage="calendrier" aria-pressed="' + (e.affichage !== "liste") + '">📅 Calendrier</button>' +
            '<button type="button" class="bascule-vue-bouton' + (e.affichage === "liste" ? " actif" : "") + '" data-pt-affichage="liste" aria-pressed="' + (e.affichage === "liste") + '">☰ Liste</button></div>' +
            '<div class="pt-nav"><button type="button" class="pt-nav-bouton" data-pt-nav="-1" aria-label="Période précédente">‹</button>' +
            '<h2 class="pt-titre" aria-live="polite">' + esc(C.libelle(p)) + '</h2>' +
            '<button type="button" class="pt-nav-bouton" data-pt-nav="1" aria-label="Période suivante">›</button></div>' +
            '<div class="pt-reglages"><button type="button" class="bouton bouton--contour pt-aujourdhui" data-pt-nav="0">Aujourd\'hui</button>' +
            '<select id="pt-gran" class="pt-gran" data-pt-gran aria-label="Période affichée">' +
            C.GRANULARITES.map(g => '<option value="' + g + '"' + (g === p.gran ? " selected" : "") + '>' + GRAN_LIBELLES[g] + '</option>').join("") + '</select></div></div>' +
            corps + '</section>';
    }

    /* ---------- Techniciens (panneau repliable) ---------- */

    function techniciens(options, choisi, ouvert) {
        return '<section class="carte pt-tech' + (ouvert ? " pt-tech--ouvert" : "") + '" aria-label="Techniciens">' +
            '<button type="button" class="pt-tech-bouton" data-pt-panneau aria-expanded="' + ouvert + '" aria-controls="pt-tech-liste"><span>👥 Techniciens</span><span aria-hidden="true">' + (ouvert ? "▾" : "▸") + '</span></button>' +
            '<div id="pt-tech-liste" class="pt-tech-liste"' + (ouvert ? "" : " hidden") + '>' + options.map(o =>
                '<button type="button" class="pt-tech-option' + (o.valeur === choisi ? " actif" : "") + '" data-pt-tech="' + esc(o.valeur) + '" aria-pressed="' + (o.valeur === choisi) + '">' +
                '<span class="pt-tech-initiale" aria-hidden="true">' + esc((o.libelle.replace(/[^A-Za-zÀ-ÿ]/g, "").charAt(0) || "?").toUpperCase()) + '</span>' +
                '<span class="pt-tech-nom">' + esc(o.libelle) + '</span><span class="pt-tech-nb" aria-label="' + esc(pl(o.nb, "client", "clients")) + '">' + o.nb + '</span></button>').join("") + '</div></section>';
    }

    /* ---------- Résumé & analyses ---------- */

    function donut(a) {
        const c = a.comptes, R = 46, L = 2 * Math.PI * R;
        let decalage = 0;
        const arcs = c.total ? C.CATEGORIES.filter(k => c[k]).map(k => {
            const part = c[k] / c.total * L, el = '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="' + COULEURS[k] + '" stroke-width="18" stroke-dasharray="' + part.toFixed(2) + " " + (L - part).toFixed(2) + '" stroke-dashoffset="' + (-decalage).toFixed(2) + '" transform="rotate(-90 60 60)"/>';
            decalage += part; return el;
        }).join("") : '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="var(--bordure)" stroke-width="18"/>';
        const lecteur = c.total ? "Visites prévues : " + C.CATEGORIES.filter(k => c[k]).map(k => LIBELLES[k] + " " + c[k] + " (" + a.pourcents[k] + " %)").join(", ") : "Aucune visite prévue";
        return '<div class="pt-donut"><svg viewBox="0 0 120 120" role="img" aria-label="' + esc(lecteur) + '">' + arcs +
            '<text x="60" y="58" text-anchor="middle" class="pt-donut-total">' + c.total + '</text><text x="60" y="74" text-anchor="middle" class="pt-donut-libelle">visites prévues</text></svg>' +
            '<ul class="pt-legende pt-legende--donut">' + C.CATEGORIES.map(k => '<li><span class="pt-pastille" style="background:' + COULEURS[k] + '" aria-hidden="true"></span><span class="pt-legende-nom">' + LIBELLES[k] + '</span><strong>' + c[k] + '</strong><span class="pt-pct texte-attenue">' + a.pourcents[k] + ' %</span></li>').join("") + '</ul></div>';
    }

    function graphique(titre, cle, serie, annee, a, prec) {
        const p = a.periode, valeurs = serie.map(m => m.comptes[cle]), max = Math.max(1, Math.max.apply(null, valeurs));
        const dansPeriode = (m) => { const d = annee + "-" + String(m + 1).padStart(2, "0") + "-01", f = C.bornes("mois", d).fin; return d <= p.fin && f >= p.debut; };
        const lecteur = titre + " par mois en " + annee + " : " + serie.map(m => m.libelle + " " + m.comptes[cle]).join(", ");
        return '<div class="carte pt-graphe"><h3 class="pt-h3">' + esc(titre) + '</h3>' +
            '<div class="pt-carte-ligne"><strong class="pt-carte-valeur">' + a.comptes[cle] + '</strong>' + (a.comptes.total ? '<em class="texte-couleur pt-pct" style="' + style(COULEURS[cle]) + '">' + a.pourcents[cle] + ' %</em>' : "") + '</div>' + evolution(cle, a, prec, p) +
            '<div class="pt-colonnes" role="img" aria-label="' + esc(lecteur) + '">' + serie.map((m, i) => '<span class="pt-col' + (dansPeriode(i) ? " pt-col--courante" : "") + '" style="height:' + Math.max(valeurs[i] ? 6 : 2, Math.round(valeurs[i] / max * 100)) + '%;background:' + COULEURS[cle] + '" title="' + esc(m.libelle + " : " + valeurs[i]) + '"></span>').join("") + '</div>' +
            '<div class="pt-axe" aria-hidden="true">' + serie.map(m => '<span>' + esc(m.libelle.charAt(0).toUpperCase()) + '</span>').join("") + '</div></div>';
    }

    function prochaineAction(a) {
        const c = a.comptes, p = a.periode, quand = PERIODE_COURANTE[p.gran];
        const texte = c.retard ? pl(c.retard, "ligne ou rendez-vous en retard", "lignes ou rendez-vous en retard") + " à traiter en priorité"
            : c.echeances ? pl(c.echeances, "échéance", "échéances") + " " + quand
            : c.planifiees ? pl(c.planifiees, "rendez-vous planifié", "rendez-vous planifiés") + " " + quand
            : "Rien d'urgent sur cette période";
        return '<div class="carte pt-action"><span class="pt-carte-libelle">Prochaine action</span><strong>' + esc(texte) + '</strong></div>';
    }

    function analyses(a, serie, annee, prec) {
        return '<section class="pt-analyses" aria-label="Résumé et analyses"><h2 class="pt-h2">📊 Résumé &amp; analyses</h2><div class="pt-analyses-grille">' +
            '<div class="carte pt-donut-carte">' + donut(a) + '</div>' +
            graphique("Visites réalisées", "realisees", serie, annee, a, prec) +
            graphique("En retard / pas encore vues", "retard", serie, annee, a, prec) +
            graphique("Prochaines échéances", "echeances", serie, annee, a, prec) +
            '<div class="pt-colonne-droite">' + '<div class="carte pt-carte pt-carte--periode"><div class="pt-carte-corps"><span class="pt-carte-libelle">Période affichée</span><strong class="pt-periode-texte">' + esc(C.libelle(a.periode)) + ' <span aria-hidden="true">📅</span></strong></div></div>' + prochaineAction(a) + '</div>' +
            '</div></section>';
    }

    /* ---------- Détail d'un jour (feuille) ---------- */

    function detailJour(date, evs, ctx) {
        if (!evs.length) return '<p class="texte-attenue">Rien de prévu ce jour-là avec les filtres actuels.</p>';
        return '<p class="aide-champ" style="margin-top:0;">' + esc(resumeJour(evs)) + '</p><ul class="pt-detail">' + evs.map(e => {
            const cle = e.ligneIds.length === 1 ? "l:" + e.ligneIds[0] : "c:" + e.clientId;
            return '<li class="pt-detail-ligne"><span class="pastille-statut pastille-couleur" style="' + style(couleurEv(e, ctx)) + '">' + LIBELLE_GENRE[e.genre] + '</span>' +
                '<div class="pt-detail-corps"><a class="texte-lien" href="Client.html?id=' + encodeURIComponent(e.clientId) + '"><strong>' + esc(ctx.nomClient(e.clientId)) + '</strong></a>' +
                '<div class="texte-attenue">' + esc(libelleEv(e, ctx) + (e.ligneIds.length ? " · " + e.ligneIds.map(ctx.nomLigne).filter(Boolean).join(", ") : "")) + '</div></div>' +
                (e.genre === "retard" || e.genre === "echeance" ? '<button type="button" class="bouton bouton--contour bouton--petit" data-pt-planifier="' + esc(cle) + '">Planifier</button>' : "") + '</li>';
        }).join("") + '</ul>';
    }

    return { jourLong, cartes, barreStatut, calendrier, techniciens, analyses, detailJour, libelleEv };
})();
