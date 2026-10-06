/* =============================================================
   SertiRapport.js — Rapport de serti sur une période (page Serti)

   À partir des contrôles de serti saisis dans les visites, produit, pour une
   PÉRIODE et un CLIENT / une LIGNE au choix :
   - un export Excel (.xlsx) en plusieurs feuilles : rapport, contrôles,
     mesures (une ligne par mesure, prête pour un tableau croisé), statistiques
     par mesure, têtes à surveiller, comparaison avec le contrôle du client ;
   - un aperçu imprimable (« Imprimer / enregistrer en PDF » du navigateur).

   Le calcul (construire) ne touche pas à l'écran : il est testé à part.
   Les verdicts sont ceux de SertiCalcul (règles actuelles ; décision manuelle
   jamais recalculée).
   ============================================================= */

const SertiRapport = (() => {
    "use strict";

    const R = ReferentielSerti, S = SertiCalcul;
    const esc = (t) => AppLayout.escapeHtml(t);
    const dateFr = (iso) => (iso ? Formulaires.dateFr(iso) : "");
    const fr = (n, d) => (n === null || n === undefined || isNaN(n) ? "—" : Number(n).toFixed(d == null ? 2 : d).replace(".", ","));
    const signe = (n, d) => (n > 0 ? "+" : n < 0 ? "−" : "") + fr(Math.abs(n), d == null ? 2 : d);
    const arrondi = (n, d) => { const k = Math.pow(10, d == null ? 3 : d); return Math.round(n * k) / k; };

    /* ---------- Calcul ---------- */

    /* f : { debut, fin (AAAA-MM-JJ, vides = sans borne), clientId, ligneId (vides = tous) } */
    function construire(f) {
        const filtre = Object.assign({ debut: "", fin: "", clientId: "", ligneId: "" }, f || {});
        const visites = Donnees.visitesAvecMesures()
            .filter(v => (!filtre.debut || v.date >= filtre.debut) && (!filtre.fin || v.date <= filtre.fin) &&
                (!filtre.clientId || v.clientId === filtre.clientId) && (!filtre.ligneId || v.ligneId === filtre.ligneId))
            .sort((a, b) => a.date.localeCompare(b.date) || (a.id > b.id ? 1 : -1));

        const controles = visites.map(v => {
            const m = v.mesures, a = S.analyser(m), etat = S.etatActuel(m, a), cmp = S.comparer(m);
            const client = Donnees.getClient(v.clientId), ligne = v.ligneId ? Donnees.getLigne(v.ligneId) : null;
            return { v, m, a, etat, cmp, client, ligne,
                nomClient: client ? client.nom : "Client supprimé", nomLigne: ligne ? ligne.nom : "Ligne supprimée",
                format: R.libelleFormat(m.format || v.format || "", m.colonne) || "—",
                sea: !!(m.client && m.client.tetes && m.client.tetes.length) };
        });

        /* Une ligne par mesure saisie (tête × paramètre), avec sa règle et, s'il existe, l'écart avec le client. */
        const mesures = [];
        controles.forEach(c => c.a.tetes.forEach(t => t.cases.forEach(k => {
            if (k.valeur === null) return;
            const p = R.parametre(k.id), regle = k.regle;
            const cl = c.m.client && c.m.client.tetes ? c.m.client.tetes.find(x => x.n === t.n) : null;
            const vc = cl ? S.nombre(cl.v[k.id]) : null;
            mesures.push({ c, tete: t.n, parametre: p, valeur: k.valeur, etat: k.etat,
                min: regle ? (regle.type === "tol" ? arrondi(regle.nom - regle.tol) : regle.min) : null,
                max: regle ? (regle.type === "tol" ? arrondi(regle.nom + regle.tol) : regle.type === "plage" ? regle.max : null) : null,
                client: vc, ecart: vc === null ? null : arrondi(k.valeur - vc) });
        })));

        const nb = (cond) => controles.filter(cond).length;
        const resume = {
            controles: controles.length,
            oui: nb(c => c.etat.validation === "oui"), non: nb(c => c.etat.validation === "non"),
            surveiller: nb(c => c.etat.aSurveiller), nonJuges: nb(c => !c.etat.validation),
            decisionsManuelles: nb(c => c.etat.forcee),
            tetesMesurees: controles.reduce((s, c) => s + c.a.mesurees, 0),
            avecClient: nb(c => c.sea),
            ecartMax: controles.reduce((mx, c) => Math.max(mx, c.cmp.ecartMax || 0), 0),
            clients: new Set(controles.map(c => c.v.clientId)).size, lignes: new Set(controles.map(c => c.v.ligneId)).size
        };
        resume.pctOui = resume.controles - resume.nonJuges > 0 ? Math.round(100 * resume.oui / (resume.controles - resume.nonJuges)) : null;

        /* Statistiques par mesure (toutes têtes et tous contrôles de la sélection). */
        const parMesure = R.PARAMETRES.map(p => {
            const lignes = mesures.filter(x => x.parametre.id === p.id);
            if (!lignes.length) return null;
            const vals = lignes.map(x => x.valeur);
            const cles = new Set(lignes.map(x => x.c.m.colonne + "|" + x.c.m.format));
            const premiere = lignes[0];
            const regle = cles.size === 1 ? R.regle(p.id, premiere.c.m.colonne, premiere.c.m.format) : null;
            return { parametre: p, n: vals.length, moyenne: arrondi(vals.reduce((a, b) => a + b, 0) / vals.length),
                min: Math.min.apply(null, vals), max: Math.max.apply(null, vals),
                cible: regle ? S.texteRegle(regle, p.decimales) : (cles.size > 1 ? "plusieurs formats" : "non renseignée"),
                hors: lignes.filter(x => x.etat === "hors").length, limite: lignes.filter(x => x.etat === "limite").length };
        }).filter(Boolean);

        /* Têtes qui sortent de la tolérance ou s'en approchent, par client et par ligne (un numéro de tête n'a de sens que sur sa ligne). */
        const tetesMap = new Map();
        mesures.forEach(x => {
            if (x.etat === "nr" || x.c.v.ligneId == null) return;
            const cle = x.c.v.ligneId + "|" + x.tete;
            const e = tetesMap.get(cle) || { nomClient: x.c.nomClient, nomLigne: x.c.nomLigne, tete: x.tete, jugees: 0, hors: 0, limite: 0, parametres: {} };
            e.jugees++;
            if (x.etat === "hors") { e.hors++; e.parametres[x.parametre.libelle] = (e.parametres[x.parametre.libelle] || 0) + 1; }
            if (x.etat === "limite") e.limite++;
            tetesMap.set(cle, e);
        });
        const parTete = Array.from(tetesMap.values()).filter(e => e.tete > 0 && (e.hors || e.limite))
            .sort((a, b) => b.hors - a.hors || b.limite - a.limite || a.nomClient.localeCompare(b.nomClient, "fr") || a.tete - b.tete);

        /* Comparaison avec le contrôle du client, par mesure. */
        const cmpMap = {};
        controles.forEach(c => c.cmp.lignes.forEach(l => l.cases.forEach(k => {
            const e = cmpMap[k.id] || (cmpMap[k.id] = { somme: 0, n: 0, alertes: 0, maxAbs: 0 });
            e.somme += k.ecart; e.n++; if (k.alerte) e.alertes++; e.maxAbs = Math.max(e.maxAbs, Math.abs(k.ecart));
        })));
        const comparaison = S.PARAMETRES_COMPARES.filter(id => cmpMap[id]).map(id => ({ parametre: R.parametre(id), n: cmpMap[id].n,
            moyenne: arrondi(cmpMap[id].somme / cmpMap[id].n), alertes: cmpMap[id].alertes, maxAbs: arrondi(cmpMap[id].maxAbs) }));

        const client = filtre.clientId ? Donnees.getClient(filtre.clientId) : null, ligne = filtre.ligneId ? Donnees.getLigne(filtre.ligneId) : null;
        return { filtre, controles, mesures, resume, parMesure, parTete, comparaison,
            libelleClient: client ? client.nom : "Tous les clients", libelleLigne: ligne ? ligne.nom : (filtre.clientId ? "Toutes les lignes" : "Toutes les lignes"),
            periode: (filtre.debut ? "du " + dateFr(filtre.debut) : "depuis le début") + (filtre.fin ? " au " + dateFr(filtre.fin) : " à aujourd'hui"),
            genereLe: Donnees.aujourdhuiIso() };
    }

    const libVerdict = (c) => c.a.pire === "crit" ? "Non conforme (critique)" : c.a.pire === "hors" ? "Hors tolérance" : c.a.pire === "limite" ? "Limite" : c.a.pire === "ok" ? "Conforme" : "Non jugé";
    const libProblemes = (c, max) => c.a.problemes.slice(0, max || 4).map(p => S.libelleTete(p.tete) + " · " + p.libelle + " : " + (p.etat === "limite" ? "limite" : p.critique ? "non conforme" : "hors")).join(" ; ") +
        (c.a.problemes.length > (max || 4) ? " ; +" + (c.a.problemes.length - (max || 4)) + " autre(s)" : "");

    /* ---------- Excel ---------- */

    function feuillesExcel(d) {
        const r = d.resume;
        const rapport = [
            ["Rapport", "Contrôles de serti"], ["Client", d.libelleClient], ["Ligne", d.libelleLigne], ["Période", d.periode],
            ["Généré le", dateFr(d.genereLe)], ["Technicien", Donnees.getDonnees().profil.nom || ""],
            ["Référentiel", R.REFERENCE.id + " rév. " + R.REFERENCE.revision + " (" + dateFr(R.REFERENCE.date) + ")"],
            ["Contrôles", r.controles], ["Validés (OUI)", r.oui], ["Non validés (NON)", r.non], ["Dont à surveiller", r.surveiller],
            ["Non jugés", r.nonJuges], ["Taux de OUI (%)", r.pctOui === null ? "" : r.pctOui], ["Décisions manuelles", r.decisionsManuelles],
            ["Têtes mesurées", r.tetesMesurees], ["Contrôles avec contrôle client", r.avecClient], ["Écart maximum avec le client (mm)", arrondi(r.ecartMax, 2)]
        ];
        const controles = d.controles.map(c => [c.v.date, c.nomClient, c.nomLigne, c.format, c.m.colonne || "", c.m.nbTetes === "" ? "" : c.m.nbTetes, c.a.mesurees,
            c.etat.validation === "oui" ? "OUI" : c.etat.validation === "non" ? "NON" : "", c.etat.forcee ? "Oui" : "", c.etat.aSurveiller ? "Oui" : "", libVerdict(c), libProblemes(c, 6),
            c.sea ? "Oui" : "", (c.m.client && c.m.client.note) || "", c.cmp.disponible ? arrondi(c.cmp.ecartMax, 2) : "", c.m.note || ""]);
        const mesures = d.mesures.map(x => [x.c.v.date, x.c.nomClient, x.c.nomLigne, x.c.format, x.tete === 0 ? "Ligne" : x.tete, x.parametre.libelle, x.parametre.unite, x.valeur,
            x.min === null ? "" : x.min, x.max === null ? "" : x.max, x.etat === "ok" ? "Conforme" : x.etat === "limite" ? "Limite" : x.etat === "hors" ? (x.parametre.categorie === "critique" ? "Non conforme" : "Hors tolérance") : "Non jugé",
            x.client === null ? "" : x.client, x.ecart === null ? "" : x.ecart]);
        const parMesure = d.parMesure.map(s => [s.parametre.libelle, s.parametre.unite, s.n, s.moyenne, s.min, s.max, s.cible, s.hors, s.limite, s.n ? arrondi(100 * s.hors / s.n, 1) : ""]);
        const parTete = d.parTete.map(e => [e.nomClient, e.nomLigne, e.tete, e.jugees, e.hors, e.limite, Object.keys(e.parametres).sort((a, b) => e.parametres[b] - e.parametres[a]).join(" ; ")]);
        const comparaison = d.comparaison.map(c => [c.parametre.libelle, c.n, c.moyenne, c.maxAbs, c.alertes]);
        const col = (titre, largeur, type) => ({ titre, largeur, type });
        return [
            { nom: "Rapport", colonnes: [col("Élément", 34), col("Valeur", 60)], lignes: rapport },
            { nom: "Contrôles", colonnes: [col("Date", 12, "date"), col("Client", 30), col("Ligne", 14), col("Format", 14), col("Colonne du document", 16), col("Têtes de la ligne", 10), col("Têtes mesurées", 10),
                col("Validation", 11), col("Décision manuelle", 11), col("À surveiller", 11), col("Verdict", 22), col("Problèmes", 60), col("Contrôle client", 10), col("Feuille du client", 24), col("Écart max client (mm)", 12), col("Motif", 30)], lignes: controles },
            { nom: "Mesures", colonnes: [col("Date", 12, "date"), col("Client", 30), col("Ligne", 14), col("Format", 14), col("Tête", 8), col("Mesure", 24), col("Unité", 8), col("Valeur", 10),
                col("Minimum", 10), col("Maximum", 10), col("Verdict", 16), col("Valeur client", 12), col("Écart (manuel − client)", 14)], lignes: mesures },
            { nom: "Par mesure", colonnes: [col("Mesure", 26), col("Unité", 8), col("Valeurs", 10), col("Moyenne", 10), col("Minimum", 10), col("Maximum", 10), col("Cible", 36), col("Hors", 8), col("Limite", 8), col("Hors (%)", 10)], lignes: parMesure },
            { nom: "Têtes à surveiller", colonnes: [col("Client", 30), col("Ligne", 14), col("Tête", 8), col("Mesures jugées", 12), col("Hors", 8), col("Limite", 8), col("Mesures en cause", 50)], lignes: parTete },
            { nom: "Comparaison client", colonnes: [col("Mesure", 26), col("Cases comparées", 14), col("Écart moyen (mm)", 14), col("Écart maximum (mm)", 14), col("Écarts à regarder", 14)], lignes: comparaison }
        ];
    }

    function nomFichier(d) {
        const slug = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30).toLowerCase();
        return "serti-" + (d.filtre.clientId ? slug(d.libelleClient) : "tous-clients") + (d.filtre.ligneId ? "-" + slug(d.libelleLigne) : "") + "-" + (d.filtre.debut || "debut") + "-" + (d.filtre.fin || d.genereLe) + ".xlsx";
    }

    /* ---------- Aperçu imprimable ---------- */

    const tableau = (entetes, lignes, classe) => '<table class="rapport-tableau' + (classe ? " " + classe : "") + '"><thead><tr>' + entetes.map(e => '<th scope="col">' + esc(e) + '</th>').join("") + '</tr></thead><tbody>' +
        lignes.map(l => '<tr>' + l.map((c, i) => (i === 0 && l.length > 1 ? '<th scope="row">' : '<td>') + c + (i === 0 && l.length > 1 ? '</th>' : '</td>')).join("") + '</tr>').join("") + '</tbody></table>';

    function html(d, opts) {
        const o = opts || {}, r = d.resume;
        const plusieursClients = new Set(d.controles.map(c => c.v.clientId)).size > 1;
        const synthese = '<div class="rapport-synthese">' + [["Contrôles", r.controles], ["Validés (OUI)", r.oui + (r.pctOui === null ? "" : " · " + r.pctOui + " %")], ["Non validés (NON)", r.non],
            ["À surveiller", r.surveiller], ["Têtes mesurées", r.tetesMesurees], ["Avec contrôle client", r.avecClient]].map(x => '<div><span>' + esc(x[0]) + '</span><strong>' + esc(String(x[1])) + '</strong></div>').join("") + '</div>';
        const liste = tableau(["Date"].concat(plusieursClients ? ["Client"] : []).concat(["Ligne", "Format", "Têtes mesurées", "Validation", "Points relevés"]),
            d.controles.map(c => ['<span class="rapport-date">' + dateFr(c.v.date) + '</span>'].concat(plusieursClients ? [esc(c.nomClient)] : []).concat([esc(c.nomLigne), esc(c.format),
                c.m.nbTetes > 0 ? c.a.mesurees + " / " + c.m.nbTetes : String(c.a.mesurees),
                '<strong>' + (c.etat.validation === "oui" ? "OUI" : c.etat.validation === "non" ? "NON" : "Non jugé") + '</strong>' + (c.etat.aSurveiller ? " (à surveiller)" : "") + (c.etat.forcee ? " (décision manuelle)" : ""),
                esc(libProblemes(c, 3) || "Aucun")])));
        const stats = d.parMesure.length ? tableau(["Mesure", "Valeurs", "Moyenne", "Min.", "Max.", "Cible", "Hors", "Limite"],
            d.parMesure.map(s => [esc(s.parametre.libelle + " (" + s.parametre.unite + ")"), String(s.n), fr(s.moyenne, s.parametre.decimales + 1), fr(s.min, s.parametre.decimales), fr(s.max, s.parametre.decimales), esc(s.cible), String(s.hors), String(s.limite)])) : "<p>Aucune mesure.</p>";
        const tetes = d.parTete.length ? tableau(["Client · ligne", "Tête", "Mesures jugées", "Hors", "Limite", "Mesures en cause"],
            d.parTete.slice(0, 30).map(e => [esc(e.nomClient + " · " + e.nomLigne), "T" + e.tete, String(e.jugees), String(e.hors), String(e.limite), esc(Object.keys(e.parametres).join(", ") || "—")])) : '<p>Aucune tête hors tolérance ni en limite sur la période.</p>';
        const cmp = d.comparaison.length ? tableau(["Mesure", "Cases comparées", "Écart moyen (mm)", "Écart max. (mm)", "Écarts à regarder"],
            d.comparaison.map(c => [esc(c.parametre.libelle), String(c.n), signe(c.moyenne), fr(c.maxAbs), String(c.alertes)])) +
            '<p class="rapport-note">Écart = valeur manuelle moins valeur du client (Seametal). Un écart de même signe sur toutes les mesures indique un décalage systématique entre les deux instruments.</p>' : "";
        const detail = o.detail ? '<section><h2>Détail des mesures</h2>' + d.controles.map(c => '<h3>' + dateFr(c.v.date) + ' · ' + esc(c.nomClient) + ' · ' + esc(c.nomLigne) + ' · ' + esc(c.format) + '</h3>' +
            tableau(["Tête"].concat(R.PARAMETRES.map(p => p.court)), c.a.tetes.map(t => ["T" + (t.n || "—")].concat(t.cases.map(k => k.valeur === null ? "·" : fr(k.valeur, R.parametre(k.id).decimales) + (k.etat === "hors" ? " ✕" : k.etat === "limite" ? " ▲" : "")))), "rapport-grille") +
            '<p class="rapport-note">✕ hors tolérance · ▲ limite</p>').join("") + '</section>' : "";
        return '<header class="rapport-entete"><h1>Rapport de contrôle de serti</h1>' +
            '<p><strong>' + esc(d.libelleClient) + '</strong> · ' + esc(d.libelleLigne) + ' · ' + esc(d.periode) + '</p>' +
            '<p class="rapport-note">Généré le ' + dateFr(d.genereLe) + ' · ' + esc(Donnees.getDonnees().profil.nom || "") + ' · Référentiel ' + esc(R.REFERENCE.id) + ' rév. ' + esc(R.REFERENCE.revision) + ' (' + dateFr(R.REFERENCE.date) + ')</p></header>' +
            '<section><h2>Synthèse</h2>' + synthese + '</section><section><h2>Contrôles</h2>' + liste + '</section>' +
            '<section><h2>Par mesure</h2>' + stats + '</section><section><h2>Têtes à surveiller</h2>' + tetes + '</section>' +
            (cmp ? '<section><h2>Comparaison avec le contrôle du client (Seametal)</h2>' + cmp + '</section>' : "") + detail;
    }

    function fermerApercu() {
        const el = document.getElementById("serti-rapport");
        if (el) el.remove();
        document.body.classList.remove("rapport-ouvert");
    }

    function montrerApercu(d, detail) {
        fermerApercu();
        const el = document.createElement("div");
        el.id = "serti-rapport"; el.className = "rapport-serti"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Aperçu du rapport de serti");
        el.innerHTML = '<div class="rapport-barre"><button type="button" class="bouton" data-rapport-imprimer>🖨 Imprimer / enregistrer en PDF</button>' +
            '<button type="button" class="bouton bouton--contour" data-rapport-fermer>Fermer</button></div><article class="rapport-page">' + html(d, { detail }) + '</article>';
        document.body.appendChild(el); document.body.classList.add("rapport-ouvert");
        el.querySelector("[data-rapport-imprimer]").addEventListener("click", () => window.print());
        el.querySelector("[data-rapport-fermer]").addEventListener("click", fermerApercu);
        el.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerApercu(); });
        el.querySelector("[data-rapport-fermer]").focus();
    }

    /* ---------- Fenêtre de choix : période, client, ligne ---------- */

    function ouvrir(initial) {
        const toutes = Donnees.visitesAvecMesures();
        const aujourdhui = Donnees.aujourdhuiIso();
        const f = Object.assign({ debut: Donnees.ajouterJours(aujourdhui, -90), fin: aujourdhui, clientId: "", ligneId: "", detail: false }, initial || {});
        const clients = []; const vus = new Set();
        toutes.forEach(v => { const c = Donnees.getClient(v.clientId); if (c && !vus.has(c.id)) { vus.add(c.id); clients.push(c); } });
        clients.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
        const optLignes = () => '<option value="">Toutes les lignes</option>' + Array.from(new Set(toutes.filter(v => (!f.clientId || v.clientId === f.clientId) && v.ligneId).map(v => v.ligneId)))
            .map(id => Donnees.getLigne(id)).filter(Boolean).sort((a, b) => a.nom.localeCompare(b.nom, "fr", { numeric: true }))
            .map(l => '<option value="' + esc(l.id) + '"' + (l.id === f.ligneId ? " selected" : "") + '>' + esc((f.clientId ? "" : (Donnees.getClient(l.clientId) || {}).nom + " · ") + l.nom) + '</option>').join("");
        AppLayout.ouvrirFeuille("bas", "Rapport de serti",
            '<p class="aide-champ" style="margin-top:0;">Choisis la période, le client et la ligne : le rapport rassemble les contrôles correspondants.</p>' +
            '<div class="grille-2-colonnes"><div><label for="sr-debut">Du</label><input type="date" id="sr-debut" value="' + esc(f.debut) + '"></div>' +
            '<div><label for="sr-fin">Au</label><input type="date" id="sr-fin" value="' + esc(f.fin) + '"></div></div>' +
            '<div class="puces-filtre" role="group" aria-label="Périodes rapides" style="margin:8px 0;">' + [["30", "30 jours"], ["90", "90 jours"], ["annee", "Cette année"], ["tout", "Tout"]].map(p =>
                '<button type="button" class="puce-filtre puce--defaut" data-sr-periode="' + p[0] + '">' + p[1] + '</button>').join("") + '</div>' +
            '<label for="sr-client">Client</label><select id="sr-client"><option value="">Tous les clients</option>' + clients.map(c => '<option value="' + esc(c.id) + '"' + (c.id === f.clientId ? " selected" : "") + '>' + esc(c.nom) + '</option>').join("") + '</select>' +
            '<label for="sr-ligne">Ligne</label><select id="sr-ligne">' + optLignes() + '</select>' +
            '<label class="champ-case" style="min-height:44px;display:flex;align-items:center;gap:8px;"><input type="checkbox" id="sr-detail"' + (f.detail ? " checked" : "") + '> Inclure le détail des mesures (grilles têtes × mesures)</label>' +
            '<p id="sr-compte" role="status" class="aide-champ"></p>' +
            '<button type="button" class="feuille-action-item" data-sr="apercu"><span class="feuille-action-icone">🖨</span><span><strong>Aperçu et impression (PDF)</strong><br><span class="texte-attenue" style="font-size:0.78rem;">Synthèse, contrôles, statistiques par mesure, têtes à surveiller, comparaison avec le client</span></span></button>' +
            '<button type="button" class="feuille-action-item" data-sr="xlsx"><span class="feuille-action-icone">📗</span><span><strong>Excel (.xlsx)</strong><br><span class="texte-attenue" style="font-size:0.78rem;">6 feuilles dont une ligne par mesure, prête pour un tableau croisé</span></span></button>');

        const q = (id) => document.getElementById(id);
        function rafraichir() {
            f.debut = q("sr-debut").value; f.fin = q("sr-fin").value; f.clientId = q("sr-client").value; f.ligneId = q("sr-ligne").value; f.detail = q("sr-detail").checked;
            const incoherent = !!(f.debut && f.fin && f.debut > f.fin);
            const d = incoherent ? null : construire(f);
            const n = d ? d.resume.controles : 0;
            q("sr-compte").textContent = incoherent ? "La date de début est après la date de fin." : n === 0 ? "Aucun contrôle de serti dans cette sélection." :
                n + " contrôle" + (n > 1 ? "s" : "") + " · " + d.resume.oui + " OUI · " + d.resume.non + " NON" + (d.resume.surveiller ? " · " + d.resume.surveiller + " à surveiller" : "") + ".";
            document.querySelectorAll("[data-sr]").forEach(b => { b.disabled = n === 0; });
            return d;
        }
        ["sr-debut", "sr-fin", "sr-detail"].forEach(id => q(id).addEventListener("change", rafraichir));
        q("sr-client").addEventListener("change", () => { f.clientId = q("sr-client").value; f.ligneId = ""; q("sr-ligne").innerHTML = optLignes(); rafraichir(); });
        q("sr-ligne").addEventListener("change", rafraichir);
        document.querySelectorAll("[data-sr-periode]").forEach(b => b.addEventListener("click", () => {
            const p = b.getAttribute("data-sr-periode"), ajd = Donnees.aujourdhuiIso();
            q("sr-fin").value = p === "tout" ? "" : ajd;
            q("sr-debut").value = p === "tout" ? "" : p === "annee" ? ajd.slice(0, 4) + "-01-01" : Donnees.ajouterJours(ajd, -Number(p));
            rafraichir();
        }));
        document.querySelector('[data-sr="xlsx"]').addEventListener("click", () => {
            const d = rafraichir(); if (!d || !d.resume.controles) return;
            Excel.telechargerXlsx(nomFichier(d), feuillesExcel(d));
            AppLayout.fermerFeuille(); AppLayout.toast("Rapport Excel téléchargé ✓");
        });
        document.querySelector('[data-sr="apercu"]').addEventListener("click", () => {
            const d = rafraichir(); if (!d || !d.resume.controles) return;
            AppLayout.fermerFeuille(); montrerApercu(d, f.detail);
        });
        rafraichir();
    }

    return { construire, feuillesExcel, html, nomFichier, ouvrir, montrerApercu, fermerApercu };
})();
