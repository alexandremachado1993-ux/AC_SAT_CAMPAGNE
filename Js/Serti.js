/* =============================================================
   Serti.js — Page Serti (Serti.html)

   Tous les contrôles de serti saisis dans les visites, avec :
   - recherche et filtres : client → ligne, format, validation (OUI / NON),
     « à surveiller », « avec contrôle client » ;
   - l'état OUI / NON visible AVANT d'ouvrir un contrôle (compteurs des puces) ;
   - le détail d'un contrôle : mes mesures, le contrôle du client (Seametal),
     et la comparaison tête par tête.

   Les contrôles sont saisis dans « Enregistrer une visite » (bloc « Contrôle
   de serti ») : cette page ne fait que les lire et renvoie vers la visite pour
   les modifier. Les règles de calcul sont dans SertiCalcul.js.
   ============================================================= */

(() => {
    "use strict";

    const R = ReferentielSerti, S = SertiCalcul;
    const esc = (t) => AppLayout.escapeHtml(t);
    const conteneur = document.getElementById("contenu-page");

    const filtres = { q: "", client: "", ligne: "", format: "", validation: "tous", sea: false };
    const piecesDe = (l) => (l && l.m && l.m.client && l.m.client.pieces) || [];
    const aClient = (l) => l.sea || piecesDe(l).length > 0;      // un contrôle client = ses valeurs OU sa feuille jointe
    let selection = null;
    let mode = "mes";

    const virgule = (n, d) => (d == null ? String(n) : Number(n).toFixed(d)).replace(".", ",");
    const signe = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + virgule(Math.abs(n), 2);
    const dateFr = (iso) => Formulaires.dateFr(iso);

    /* ---------- Données ---------- */

    function lignesDeLaPage() {
        return Donnees.visitesAvecMesures().map(v => {
            const m = v.mesures;
            const client = Donnees.getClient(v.clientId), ligne = v.ligneId ? Donnees.getLigne(v.ligneId) : null;
            const a = S.analyser(m);
            const etat = S.etatActuel(m, a);          /* validation avec les règles ACTUELLES, sauf décision manuelle */
            const format = R.libelleFormat(m.format || v.format || "", m.colonne) || "—";
            return { v, m, a, client, ligne, format,
                nomClient: client ? client.nom : "Client supprimé", nomLigne: ligne ? ligne.nom : "Ligne supprimée",
                validation: etat.validation, surveiller: etat.aSurveiller, recalcule: !!m.validation && !etat.forcee && etat.validation !== m.validation,
                sea: !!(m.client && m.client.tetes && m.client.tetes.length), cmp: S.comparer(m) };
        });
    }

    function filtrer(toutes, sansValidation) {
        const q = Donnees.normaliserTexte(filtres.q || "");
        return toutes.filter(l => {
            if (q && Donnees.normaliserTexte(l.nomClient + " " + l.nomLigne + " " + l.format).indexOf(q) === -1) return false;
            if (filtres.client && l.v.clientId !== filtres.client) return false;
            if (filtres.ligne && l.v.ligneId !== filtres.ligne) return false;
            if (filtres.format && l.format !== filtres.format) return false;
            if (filtres.sea && !aClient(l)) return false;
            if (sansValidation) return true;
            const f = filtres.validation;
            return f === "tous" || (f === "oui" && l.validation === "oui") || (f === "non" && l.validation === "non") ||
                (f === "surveiller" && l.surveiller) || (f === "nonjuge" && !l.validation);
        });
    }

    /* ---------- Éléments d'affichage ---------- */

    function pastilleValidation(l) {
        if (!l.validation) return '<span class="pastille-statut pastille-couleur" style="' + Donnees.styleCouleur("#64748b") + '">Non jugé</span>';
        const oui = l.validation === "oui";
        return '<span class="pastille-statut pastille-couleur" style="' + Donnees.styleCouleur(oui ? (l.surveiller ? "#b45309" : "#16a34a") : "#b91c1c") + '">' +
            (oui ? "✓ OUI" : "✕ NON") + (l.surveiller ? " ⚠ à surveiller" : "") + (l.m.forcee ? " · manuel" : "") + '</span>';
    }

    const optionsSelect = (valeurs, courant, vide) => '<option value="">' + esc(vide) + '</option>' +
        valeurs.map(x => '<option value="' + esc(x.valeur) + '"' + (x.valeur === courant ? " selected" : "") + '>' + esc(x.texte) + '</option>').join("");

    function uniques(toutes, f) { const vus = new Set(), r = []; toutes.forEach(l => { const x = f(l); if (x && !vus.has(x.valeur)) { vus.add(x.valeur); r.push(x); } }); return r.sort((a, b) => a.texte.localeCompare(b.texte, "fr", { numeric: true })); }

    /* Lignes proposées : celles du client choisi (toutes sinon). */
    function optionsLignes(toutes) {
        return optionsSelect(uniques(toutes.filter(l => !filtres.client || l.v.clientId === filtres.client), l => l.ligne ? { valeur: l.ligne.id, texte: l.ligne.nom } : null), filtres.ligne, "Toutes les lignes");
    }

    function htmlFiltres(toutes) {
        const clients = uniques(toutes, l => l.client ? { valeur: l.client.id, texte: l.client.nom } : null);
        const formats = uniques(toutes, l => ({ valeur: l.format, texte: l.format }));
        return '<div class="serti-filtres-grille">' +
            '<div><label for="sf-q">Recherche</label><input type="search" id="sf-q" value="' + esc(filtres.q) + '" placeholder="Client, ligne ou format" autocomplete="off"></div>' +
            '<div><label for="sf-client">Client</label><select id="sf-client">' + optionsSelect(clients, filtres.client, "Tous les clients") + '</select></div>' +
            '<div><label for="sf-ligne">Ligne</label><select id="sf-ligne">' + optionsLignes(toutes) + '</select></div>' +
            '<div><label for="sf-format">Format</label><select id="sf-format">' + optionsSelect(formats, filtres.format, "Tous les formats") + '</select></div></div>';
    }

    function htmlPuces(toutes) {
        const base = filtrer(toutes, true);
        const nb = { tous: base.length, oui: base.filter(l => l.validation === "oui").length, non: base.filter(l => l.validation === "non").length,
            surveiller: base.filter(l => l.surveiller).length, nonjuge: base.filter(l => !l.validation).length };
        const puces = [["tous", "Toutes"], ["oui", "✓ OUI"], ["non", "✕ NON"], ["surveiller", "⚠ À surveiller"]].concat(nb.nonjuge || filtres.validation === "nonjuge" ? [["nonjuge", "Non jugées"]] : []);
        return '<div class="puces-filtre" role="group" aria-label="Filtrer par validation">' + puces.map(p =>
            '<button type="button" class="puce-filtre puce--defaut' + (filtres.validation === p[0] ? " actif" : "") + '" data-serti-filtre="' + p[0] + '" aria-pressed="' + (filtres.validation === p[0]) + '">' +
            esc(p[1]) + ' <span class="puce-compteur">' + nb[p[0]] + '</span></button>').join("") +
            '<button type="button" class="puce-filtre puce--defaut' + (filtres.sea ? " actif" : "") + '" data-serti-sea aria-pressed="' + filtres.sea + '">Avec contrôle client</button>' +
            '<button type="button" class="bouton bouton--petit bouton--fantome" data-serti-reinit>Réinitialiser</button></div>';
    }

    function htmlListe(liste) {
        if (liste.length === 0) return '<div class="etat-vide">Aucun contrôle ne correspond à ces filtres.</div>';
        return '<div class="serti-liste" role="group" aria-label="Contrôles de serti">' + liste.map(l =>
            '<button type="button" class="serti-ligne' + (selection === l.v.id ? " actif" : "") + '" data-serti-ouvrir="' + esc(l.v.id) + '" aria-pressed="' + (selection === l.v.id) + '">' +
            '<span class="serti-ligne-date">' + dateFr(l.v.date) + '</span>' +
            '<span class="serti-ligne-qui"><strong>' + esc(l.nomClient) + '</strong><span class="texte-attenue">' + esc(l.nomLigne) + ' · ' + esc(l.format) + '</span></span>' +
            '<span class="serti-ligne-tetes texte-attenue">' + (l.m.nbTetes > 0 ? l.a.mesurees + " / " + l.m.nbTetes + " têtes" : (l.a.mesurees ? "1 série" : "—")) + '</span>' +
            '<span class="serti-ligne-etat">' + pastilleValidation(l) + '</span>' +
            '<span class="serti-ligne-client texte-attenue">' + (aClient(l) ? "Seametal" + (l.cmp.disponible ? " · écart max " + virgule(l.cmp.ecartMax, 2) + " mm" : "") : "Pas de contrôle client") + '</span></button>').join("") + '</div>';
    }

    /* ---------- Détail ---------- */

    function matrice(tetes, m) {
        const cols = R.PARAMETRES;
        return '<div class="serti-matrice-defile"><div class="serti-matrice" style="--n:' + cols.length + '" role="table">' +
            '<div class="serti-matrice-ligne serti-matrice-entete" role="row"><span role="columnheader"></span>' +
            cols.map(p => '<span role="columnheader" title="' + esc(p.libelle) + '">' + esc(p.court) + '</span>').join("") + '</div>' +
            tetes.map(t => '<div class="serti-matrice-ligne" role="row"><span class="serti-matrice-tete" role="rowheader">' + (t.n === 0 ? "Ligne" : "T" + t.n) + '</span>' +
                t.cases.map(c => {
                    const p = R.parametre(c.id);
                    const lib = { ok: "conforme", limite: "limite", hors: p.categorie === "critique" ? "non conforme" : "hors tolérance", nr: c.valeur == null ? "pas mesuré" : "non jugé" }[c.etat];
                    return '<span class="serti-case serti-case--' + c.etat + '" role="cell" aria-label="' + esc(S.libelleTete(t.n) + ", " + p.libelle + " : " + lib) + '">' +
                        (c.valeur == null ? "·" : virgule(c.valeur, p.decimales)) + '</span>';
                }).join("") + '</div>').join("") + '</div></div>' +
            '<p class="aide-champ">Fond plein vert : conforme · pointillé orange : limite · trait rouge épais : hors tolérance ou non conforme · gris : mesure non jugée (pas de tolérance).</p>';
    }

    function comparaison(l) {
        const c = l.cmp, ids = S.PARAMETRES_COMPARES;
        if (!c.disponible) return '<div class="etat-vide">Aucune tête n\'a de valeur des deux côtés (tes mesures et celles du client).</div>';
        const grille = '<div class="serti-matrice-defile"><div class="serti-matrice serti-matrice--cmp" style="--n:' + ids.length + '" role="table">' +
            '<div class="serti-matrice-ligne serti-matrice-entete" role="row"><span role="columnheader"></span>' + ids.map(id => '<span role="columnheader" title="' + esc(R.parametre(id).libelle) + '">' + esc(R.parametre(id).court) + '</span>').join("") + '</div>' +
            c.lignes.map(ln => '<div class="serti-matrice-ligne" role="row"><span class="serti-matrice-tete" role="rowheader">' + (ln.n === 0 ? "Ligne" : "T" + ln.n) + '</span>' +
                ids.map(id => {
                    const x = ln.cases.find(k => k.id === id);
                    if (!x) return '<span class="serti-case serti-case--nr" role="cell">·</span>';
                    const p = R.parametre(id);
                    return '<span class="serti-case serti-case--cmp' + (x.alerte ? " serti-case--alerte" : "") + '" role="cell" aria-label="' + esc(S.libelleTete(ln.n) + ", " + p.libelle + " : manuel " + virgule(x.manuel, 2) + ", client " + virgule(x.client, 2) + (x.alerte ? ", écart à regarder" : "")) + '">' +
                        '<span>' + virgule(x.manuel, 2) + ' · ' + virgule(x.client, 2) + '</span><span class="serti-delta">Δ ' + signe(x.ecart) + '</span></span>';
                }).join("") + '</div>').join("") + '</div></div>';
        const moy = ids.filter(id => c.moyennes[id] !== undefined).map(id => '<div class="serti-stat"><span class="texte-attenue">' + esc(R.parametre(id).libelle) + '</span><strong>' + signe(c.moyennes[id]) + ' mm</strong></div>').join("");
        return '<p class="aide-champ">Chaque case : valeur manuelle · valeur du client, puis l\'écart Δ (manuel moins client). Pointillé orange : écart à regarder (plus du quart de la tolérance ; 0,05 mm pour la croisure).</p>' + grille +
            '<div class="serti-stats"><div class="serti-stat"><span class="texte-attenue">Cases comparées</span><strong>' + c.nbCases + '</strong></div>' +
            '<div class="serti-stat"><span class="texte-attenue">Écarts à regarder</span><strong>' + c.nbAlertes + '</strong></div>' +
            '<div class="serti-stat"><span class="texte-attenue">Écart maximum</span><strong>' + virgule(c.ecartMax, 2) + ' mm</strong></div></div>' +
            '<h3 class="serti-sous-titre">Écart moyen par mesure (manuel moins client)</h3><div class="serti-stats">' + moy + '</div>' +
            '<p class="aide-champ">Un écart de même signe sur toutes les têtes indique un décalage systématique entre ton instrument et celui du client ; un écart sur une seule tête indique plutôt un problème de cette tête.</p>';
    }

    function htmlDetail(l) {
        if (!l) return "";
        const onglets = [["mes", "Mes mesures", true], ["client", "Contrôle client (Seametal)", l.sea || piecesDe(l).length > 0], ["cmp", "Comparaison", l.cmp.disponible]];
        if (!onglets.find(o => o[0] === mode && o[2])) mode = "mes";
        let corps;
        if (mode === "client") corps = (l.m.client && l.m.client.note ? '<p class="aide-champ">Feuille du client : <strong>' + esc(l.m.client.note) + '</strong></p>' : "") + (l.sea ? matrice(l.a.client, l.m) : '<div class="etat-vide">Aucune valeur du client saisie : seule sa feuille est jointe.</div>') +
            (typeof Pieces !== "undefined" ? Pieces.htmlBloc(piecesDe(l), { editable: false }) : "");
        else if (mode === "cmp") corps = comparaison(l);
        else corps = (l.m.tetes.length ? matrice(l.a.tetes, l.m) : '<div class="etat-vide">Aucune mesure : seule la validation a été notée.</div>') +
            (l.m.forcee ? '<p class="bandeau-info" role="status">Décision manuelle : proposé <strong>' + (l.m.validationAuto === "oui" ? "OUI" : "NON") + '</strong>, retenu <strong>' + (l.m.validation === "oui" ? "OUI" : "NON") + '</strong>' + (l.m.note ? " — " + esc(l.m.note) : "") + '.</p>' : "");
        return '<div class="carte serti-detail" id="serti-detail">' +
            '<div class="serti-detail-entete"><div><h2 class="section-titre">' + esc(l.nomClient) + ' · ' + esc(l.nomLigne) + '</h2>' +
            '<div class="texte-attenue">' + dateFr(l.v.date) + ' · ' + esc(l.format) + ' · ' + esc(Donnees.typeVisite(l.v.type).libelle) + ' · ' + esc(l.m.ref) + '</div></div>' + pastilleValidation(l) + '</div>' +
            '<div class="puces-filtre" role="tablist">' + onglets.map(o => '<button type="button" role="tab" class="puce-filtre puce--defaut' + (mode === o[0] ? " actif" : "") + '" data-serti-mode="' + o[0] + '" aria-selected="' + (mode === o[0]) + '"' + (o[2] ? "" : " disabled") + '>' + esc(o[1]) + '</button>').join("") + '</div>' +
            corps +
            (l.recalcule ? '<div class="bandeau-info" role="status">Verdict recalculé avec le référentiel actuel (enregistré à l\'époque : <strong>' + (l.m.validation === "oui" ? "OUI" : "NON") + '</strong>). Une décision manuelle, elle, n\'est jamais recalculée.</div>' : "") +
            (!l.sea && !piecesDe(l).length ? '<div class="bandeau-info" role="status">Pas de contrôle client pour ce contrôle. Pour l\'ajouter : modifie la visite, ouvre « Contrôle de serti » et choisis « Contrôle client (Seametal) ».</div>' : "") +
            (l.v.remarques ? '<div class="carte-ligne-notes">' + esc(l.v.remarques) + '</div>' : "") +
            '<div class="serti-actions"><button type="button" class="bouton bouton--petit" data-serti-modifier="' + esc(l.v.id) + '">✏️ Modifier la visite</button>' +
            (l.client ? '<a class="bouton bouton--petit bouton--contour" href="Client.html?id=' + encodeURIComponent(l.client.id) + '">Voir le client</a>' : "") + '</div></div>';
    }

    /* ---------- Rendu ---------- */

    function rendreResultats() {
        const toutes = lignesDeLaPage();
        document.getElementById("serti-puces").innerHTML = htmlPuces(toutes);
        const liste = filtrer(toutes, false);
        if (!liste.some(l => l.v.id === selection)) selection = liste.length ? liste[0].v.id : null;
        document.getElementById("serti-liste").innerHTML = htmlListe(liste);
        const zoneDetail = document.getElementById("serti-detail-zone");
        zoneDetail.innerHTML = htmlDetail(liste.find(l => l.v.id === selection));
        if (typeof Pieces !== "undefined") Pieces.hydrater(zoneDetail);
    }

    function rendre() {
        const toutes = lignesDeLaPage();
        let corps;
        if (toutes.length === 0) {
            corps = '<div class="etat-vide">Aucun contrôle de serti pour l\'instant.<br>Ouvre « Enregistrer une visite », choisis une ligne, déplie « 🔬 Contrôle de serti » et saisis tes mesures.' +
                '<div style="margin-top:12px;"><button type="button" class="bouton" data-nouvelle-visite>+ Enregistrer une visite</button></div></div>';
        } else {
            corps = '<div class="carte serti-filtres"><div id="serti-filtres">' + htmlFiltres(toutes) + '</div><div id="serti-puces"></div></div>' +
                '<div class="carte serti-zone-liste"><div id="serti-liste"></div></div><div id="serti-detail-zone"></div>';
        }
        conteneur.innerHTML = '<div class="entete-page"><div><h1 class="titre-page">Serti</h1>' +
            '<p class="texte-attenue" style="font-size:0.85rem;">Tous les contrôles de serti saisis dans tes visites. Filtre, vois ce qui est validé ou non, puis ouvre celui qui t\'intéresse.</p></div>' +
            (toutes.length ? '<button type="button" class="bouton" data-serti-rapport>📊 Rapport / export</button>' : "") + '</div>' + corps;
        if (toutes.length) rendreResultats();
    }

    /* ---------- Événements ---------- */

    conteneur.addEventListener("input", (e) => {
        if (e.target.id === "sf-q") { filtres.q = e.target.value; rendreResultats(); }
    });
    conteneur.addEventListener("change", (e) => {
        const id = e.target.id;
        /* Seule la liste des lignes est mise à jour : le menu « client » reste en place (le clavier garde son focus). */
        if (id === "sf-client") { filtres.client = e.target.value; filtres.ligne = ""; document.getElementById("sf-ligne").innerHTML = optionsLignes(lignesDeLaPage()); rendreResultats(); }
        else if (id === "sf-ligne") { filtres.ligne = e.target.value; rendreResultats(); }
        else if (id === "sf-format") { filtres.format = e.target.value; rendreResultats(); }
    });
    conteneur.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.hasAttribute("data-serti-filtre")) { filtres.validation = b.getAttribute("data-serti-filtre"); rendreResultats(); }
        else if (b.hasAttribute("data-serti-sea")) { filtres.sea = !filtres.sea; rendreResultats(); }
        else if (b.hasAttribute("data-serti-reinit")) { Object.assign(filtres, { q: "", client: "", ligne: "", format: "", validation: "tous", sea: false }); rendre(); }
        else if (b.hasAttribute("data-serti-ouvrir")) {
            selection = b.getAttribute("data-serti-ouvrir"); mode = "mes"; rendreResultats();
            const d = document.getElementById("serti-detail"); if (d && d.scrollIntoView) d.scrollIntoView({ block: "nearest", behavior: (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ? "auto" : "smooth" });
        }
        else if (b.hasAttribute("data-serti-mode")) { mode = b.getAttribute("data-serti-mode"); rendreResultats(); }
        else if (b.hasAttribute("data-serti-modifier")) { const v = Donnees.getVisite(b.getAttribute("data-serti-modifier")); if (v) Formulaires.visite({ visite: v }); }
        else if (b.hasAttribute("data-serti-rapport")) SertiRapport.ouvrir({ clientId: filtres.client, ligneId: filtres.ligne });
        else if (b.hasAttribute("data-nouvelle-visite")) Formulaires.visite();
    });

    Donnees.ecouter(rendre);
    rendre();
})();
