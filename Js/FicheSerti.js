/* =============================================================
   FicheSerti.js — Fiche de contrôle de serti, dans le formulaire de visite

   Un bloc repliable « Contrôle de serti » s'insère dans « Enregistrer une
   visite » (et dans « Visite effectuée » d'un rendez-vous). Il est préparé
   par la ligne (format, colonne du document, nombre de têtes) :
   - saisie tête par tête (0 à 24 têtes, par paire ; 0 = une seule série),
   - verdict de chaque mesure, de chaque tête, de la ligne (la pire tête décide),
   - validation OUI / NON (proposée d'après les mesures, modifiable),
   - contrôle du client (Seametal) saisi dans la même grille, pour comparer.

   Toutes les règles de calcul sont dans SertiCalcul.js ; les valeurs de
   référence dans ReferentielSerti.js. Ici : uniquement l'écran.
   Le bloc ne soumet jamais le formulaire : « Entrée » passe à la case suivante.
   ============================================================= */

const FicheSerti = (() => {
    "use strict";

    const R = ReferentielSerti, S = SertiCalcul;
    const esc = (t) => AppLayout.escapeHtml(t);
    const instances = {};

    const virgule = (n) => String(n).replace(".", ",");
    const SYMBOLES = { ok: "✓", limite: "▲", hors: "✕", crit: "✕", vide: "·", nr: "·" };
    /* Couleurs de verdict : celles des pastilles OUI / NON de la page Serti (une seule palette, un seul composant). */
    const COULEURS = { ok: "#16a34a", limite: "#b45309", hors: "#b91c1c", nr: "#64748b" };
    const attrPastille = (etat) => 'class="pastille-statut pastille-couleur serti-pastille" style="' + Donnees.styleCouleur(COULEURS[etat]) + '" data-etat="' + etat + '"';

    /* ---------- État ---------- */

    function colonneAutomatique(format) {
        const cols = R.colonnesDuFormat(format);
        return cols.length === 1 ? cols[0] : "";
    }

    function convertir(parTete) {
        return Object.keys(parTete).map(n => ({ n: Number(n), v: parTete[n] }))
            .filter(t => Object.keys(t.v).some(k => String(t.v[k]).trim() !== ""));
    }

    function depuisMesures(m) {
        const lire = (liste) => { const r = {}; (liste || []).forEach(t => { r[t.n] = {}; Object.keys(t.v).forEach(k => { r[t.n][k] = virgule(t.v[k]); }); }); return r; };
        return { mes: lire(m.tetes), client: lire(m.client && m.client.tetes) };
    }

    function listeTetes(inst) { return inst.nbTetes === null ? [] : inst.nbTetes === 0 ? [0] : Array.from({ length: inst.nbTetes }, (_, i) => i + 1); }

    function etatMesures(inst, serie) {
        const format = inst.formatCourant();
        return { colonne: inst.colonne, format, nbTetes: inst.nbTetes === null ? "" : inst.nbTetes,
            tetes: convertir(inst.valeurs[serie]).map(t => ({ n: t.n, v: t.v })) };
    }

    /* ---------- Montage ---------- */

    /* options : { ligne, formatCourant: () => texte, mesures (déjà enregistrées, facultatif) } */
    function monter(prefixe, zone, options) {
        const o = options || {};
        const ligne = o.ligne || null;
        const m = o.mesures || null;
        const format = () => (o.formatCourant ? o.formatCourant() : "") || "";
        const nbLigne = ligne ? S.normaliserNbTetes(ligne.nbTetes) : null;
        const inst = {
            prefixe, zone, ligne, formatCourant: format,
            colonneChoisie: !!(m ? m.colonne : (ligne && R.colonne(ligne.colonneSerti))),
            colonne: m ? m.colonne : ((ligne && R.colonne(ligne.colonneSerti)) ? ligne.colonneSerti : colonneAutomatique(format())),
            nbTetes: m ? S.normaliserNbTetes(m.nbTetes) : nbLigne,
            memoriser: true, serie: "mes", tete: 1,
            valeurs: m ? depuisMesures(m) : { mes: {}, client: {} },
            note: m && m.note ? m.note : "", noteClient: m && m.client ? m.client.note || "" : "",
            validation: m && m.forcee ? m.validation : ""
        };
        const liste = listeTetes(inst);
        inst.tete = liste.length ? liste[0] : 1;
        instances[prefixe] = inst;
        zone.innerHTML = squelette(inst);
        inst.racine = zone.firstElementChild;      /* les écouteurs vivent et meurent avec ce bloc : pas de doublons au remontage */
        brancher(inst);
        tout(inst);
        return inst;
    }

    function demonter(prefixe) { delete instances[prefixe]; }
    function ligneMontee(prefixe) { const i = instances[prefixe]; return i && i.ligne ? i.ligne.id : null; }
    function estMonte(prefixe) { return !!instances[prefixe]; }

    /* Le format de la visite a changé : on recalcule la colonne si elle n'a pas été choisie à la main. */
    function majFormat(prefixe) {
        const inst = instances[prefixe];
        if (!inst) return;
        const auto = colonneAutomatique(inst.formatCourant());
        if (auto && !inst.colonneChoisie) inst.colonne = auto;
        tout(inst);
    }

    function squelette(inst) {
        const p = inst.prefixe;
        return '<details class="bloc-formulaire bloc-serti" data-serti="' + esc(p) + '"' + (Object.keys(inst.valeurs.mes).length || inst.validation ? " open" : "") + '>' +
            '<summary class="bloc-formulaire-titre">🔬 Contrôle de serti <span class="serti-court" data-serti-court></span></summary>' +
            '<div data-serti-config></div>' +
            '<div class="serti-series" role="group" aria-label="Série de mesures">' +
            '<button type="button" class="puce-filtre puce--defaut actif" data-serti-serie="mes" aria-pressed="true">Mes mesures</button>' +
            '<button type="button" class="puce-filtre puce--defaut" data-serti-serie="client" aria-pressed="false">Contrôle client (Seametal)</button></div>' +
            '<div data-serti-tetes></div><p class="aide-champ" data-serti-avance></p><div data-serti-saisie></div><div data-serti-nav></div>' +
            '<div data-serti-bilan></div><div data-serti-validation></div>' +
            '</details>';
    }

    /* ---------- Réglages : colonne du document et nombre de têtes ---------- */

    function htmlConfig(inst) {
        const p = inst.prefixe, format = inst.formatCourant();
        const connu = R.formatConnu(format);
        const colonnes = R.colonnesDuFormat(format);
        let aide;
        if (inst.colonne) aide = "Valeurs du document pour <strong>" + esc(R.libelleFormat(connu ? connu.nom : format, inst.colonne)) + "</strong>.";
        else if (colonnes.length > 1) aide = "Le " + esc(format) + " existe en deux diamètres : choisis celui de cette ligne.";
        else aide = "Ce format n'est pas dans le référentiel : choisis la colonne du document, ou laisse vide (les mesures sont notées, sans verdict).";
        const optCol = '<option value="">— Aucune (pas de verdict)</option>' + R.COLONNES.map(c =>
            '<option value="' + esc(c.id) + '"' + (c.id === inst.colonne ? " selected" : "") + '>' + esc(c.id) + (R.formatsDeLaColonne(c.id).length ? " · " + esc(R.formatsDeLaColonne(c.id).join(", ")) : "") + '</option>').join("");
        const optNb = '<option value="">— À choisir</option>' + S.NB_TETES_OPTIONS.map(n =>
            '<option value="' + n + '"' + (n === inst.nbTetes ? " selected" : "") + '>' + (n === 0 ? "0 · aucune tête (une série)" : n + " têtes") + '</option>').join("");
        const diff = inst.ligne && ((inst.colonne && inst.colonne !== (inst.ligne.colonneSerti || colonneAutomatique(format))) ||
            (inst.nbTetes !== null && inst.nbTetes !== S.normaliserNbTetes(inst.ligne.nbTetes)));
        return '<p class="aide-champ">' + aide + ' <span class="texte-attenue">' + esc(R.REFERENCE.id) + ' rév. ' + esc(R.REFERENCE.revision) + '</span></p>' +
            '<div class="serti-config">' +
            '<div><label for="' + p + '-tetes">Têtes de sertissage</label><select id="' + p + '-tetes" data-serti-nb>' + optNb + '</select></div>' +
            '<div><label for="' + p + '-colonne">Format fournisseur</label><select id="' + p + '-colonne" data-serti-colonne>' + optCol + '</select></div></div>' +
            (diff ? '<label class="champ-case serti-memoriser"><input type="checkbox" data-serti-memoriser' + (inst.memoriser ? " checked" : "") + '> <span>Retenir ces réglages sur la ligne</span></label>' : "");
    }

    /* ---------- Têtes (pastilles) et saisie ---------- */

    function htmlTetes(inst) {
        if (inst.nbTetes === null) return '<div class="bandeau-info" role="status">Choisis d\'abord le nombre de têtes de la ligne.</div>';
        if (inst.nbTetes === 0) return "";
        return '<div class="serti-tetes" role="group" aria-label="Tête à mesurer">' + listeTetes(inst).map(n =>
            '<button type="button" class="serti-tete" data-serti-tete="' + n + '" aria-pressed="false" aria-label="Tête ' + n + '"><span>T' + n + '</span><span class="serti-tete-etat" aria-hidden="true"></span></button>').join("") + '</div>';
    }

    function htmlJauge(regle) {
        const g = S.jauge(regle); if (!g) return "";
        const pc = (x) => (((x - g.bas) / (g.haut - g.bas)) * 100).toFixed(2);
        const z = g.zones.map(pc);
        const fond = regle.type === "min"
            ? "linear-gradient(90deg,var(--sj-hors) 0 " + z[0] + "%,var(--sj-ok) " + z[0] + "% 100%)"
            : "linear-gradient(90deg,var(--sj-hors) 0 " + z[0] + "%,var(--sj-lim) " + z[0] + "% " + z[1] + "%,var(--sj-ok) " + z[1] + "% " + z[2] + "%,var(--sj-lim) " + z[2] + "% " + z[3] + "%,var(--sj-hors) " + z[3] + "% 100%)";
        return '<div class="serti-jauge" style="background:' + fond + '"><span class="serti-repere" hidden></span></div>';
    }

    function htmlLigneParam(inst, p, valeur) {
        const regle = R.regle(p.id, inst.colonne, inst.formatCourant());
        const cible = regle ? S.texteRegle(regle, p.decimales) : (inst.colonne ? "tolérance non renseignée : valeur notée, non jugée" : "pas de valeur de référence");
        const id = inst.prefixe + "-c-" + p.id;
        return '<div class="serti-param" data-serti-param="' + p.id + '">' +
            '<div class="serti-param-tete"><label for="' + id + '">' + esc(p.libelle) + '</label><span class="serti-cible">' + esc(cible) + '</span></div>' +
            '<div class="serti-param-saisie"><div class="serti-champ"><input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" data-serti-champ="' + p.id + '" value="' + esc(valeur) + '" aria-describedby="' + id + '-v">' +
            '<span class="serti-unite" aria-hidden="true">' + esc(p.unite) + '</span></div>' +
            '<span ' + attrPastille("nr") + ' id="' + id + '-v" role="status" data-serti-pastille>—</span></div>' +
            (regle ? htmlJauge(regle) : "") + '</div>';
    }

    function htmlSaisie(inst) {
        if (inst.nbTetes === null) return "";
        const n = inst.tete, val = (inst.valeurs[inst.serie][n]) || {};
        const groupe = (titre, cat) => '<div class="serti-groupe">' + titre + '</div>' +
            R.PARAMETRES.filter(p => p.categorie === cat).map(p => htmlLigneParam(inst, p, val[p.id] || "")).join("");
        return '<div class="serti-carte"><div class="serti-carte-titre"><strong>' + esc(S.libelleTete(n)) + (inst.nbTetes > 0 ? " sur " + inst.nbTetes : "") + '</strong>' +
            '<span ' + attrPastille("nr") + ' data-serti-verdict-tete>À mesurer</span></div>' +
            (inst.serie === "client" ? '<p class="aide-champ">Valeurs relevées par le client (Seametal) sur sa feuille de contrôle, jugées avec les mêmes tolérances.</p>' : "") +
            groupe("Paramètres critiques", "critique") + groupe("Paramètres recommandés", "recommande") + '</div>';
    }

    function htmlNav(inst) {
        const liste = listeTetes(inst);
        if (inst.nbTetes === null) return "";
        if (liste.length < 2) return '<div class="serti-actions"><button type="button" class="bouton bouton--petit bouton--fantome" data-serti-effacer>Effacer le contrôle</button></div>';
        const i = liste.indexOf(inst.tete);
        return '<div class="serti-nav">' +
            '<button type="button" class="bouton bouton--contour" data-serti-nav="-1"' + (i <= 0 ? " disabled" : "") + '>‹ Tête ' + (i > 0 ? liste[i - 1] : "") + '</button>' +
            '<button type="button" class="bouton" data-serti-nav="1"' + (i >= liste.length - 1 ? " disabled" : "") + '>Tête ' + (i < liste.length - 1 ? liste[i + 1] : "") + ' ›</button></div>' +
            '<div class="serti-actions">' + (i > 0 ? '<button type="button" class="bouton bouton--petit bouton--contour" data-serti-copier>Reprendre la tête ' + liste[i - 1] + ' (cases vides)</button>' : "") +
            '<button type="button" class="bouton bouton--petit bouton--fantome" data-serti-effacer>Effacer le contrôle</button></div>';
    }

    /* ---------- Bilan et validation ---------- */

    function analyseCourante(inst) {
        return S.analyser(etatMesures(inst, "mes"));
    }

    function htmlValidation(inst, a) {
        const p = inst.prefixe;
        const auto = a.validationAuto;
        const choix = inst.validation || auto;
        const dif = inst.validation && auto && inst.validation !== auto;
        return '<fieldset class="serti-validation"><legend>Validation du contrôle</legend>' +
            '<div class="serti-choix" role="radiogroup" aria-label="Validation du contrôle">' +
            '<label class="serti-choix-option serti-choix--oui"><input type="radio" name="' + p + '-val" value="oui" data-serti-val' + (choix === "oui" ? " checked" : "") + '><span>OUI</span></label>' +
            '<label class="serti-choix-option serti-choix--non"><input type="radio" name="' + p + '-val" value="non" data-serti-val' + (choix === "non" ? " checked" : "") + '><span>NON</span></label></div>' +
            '<p class="aide-champ">' + (auto ? "Proposé d'après les mesures : <strong>" + (auto === "oui" ? "OUI" : "NON") + "</strong>" + (a.aSurveiller && auto === "oui" ? " (⚠ à surveiller)" : "") + "." : "Aucune mesure n'a pu être jugée : choisis OUI ou NON.") +
            (dif ? ' <strong>Décision manuelle</strong> — <button type="button" class="serti-lien" data-serti-auto>revenir à la proposition</button>' : "") + '</p>' +
            (dif ? '<label for="' + p + '-note">Motif de la décision</label><input id="' + p + '-note" type="text" autocomplete="off" data-serti-note value="' + esc(inst.note) + '" placeholder="ex. mesure refaite, boîte défectueuse">' : "") +
            (inst.serie === "client" || Object.keys(inst.valeurs.client).length || inst.noteClient
                ? '<label for="' + p + '-noteclient">Feuille du client (référence, n° ou nom du PDF)</label><input id="' + p + '-noteclient" type="text" autocomplete="off" data-serti-noteclient value="' + esc(inst.noteClient) + '" placeholder="ex. Seametal 02/10 — ligne 1">' : "") +
            '</fieldset>';
    }

    function textePire(a) {
        if (!a.jugees) return "";
        return a.pire === "crit" ? "non conforme (critique)" : a.pire === "hors" ? "hors tolérance" : a.pire === "limite" ? "conforme, à surveiller" : "conforme";
    }

    function htmlBilan(inst, a) {
        if (!a.mesurees) return '<div class="serti-bilan serti-bilan--vide">Aucune mesure saisie.</div>';
        const cls = a.pire === "crit" || a.pire === "hors" ? "hors" : a.pire === "limite" ? "limite" : a.pire === "ok" ? "ok" : "nr";
        const problemes = a.problemes.slice(0, 6).map(x => '<li>' + esc(S.libelleTete(x.tete)) + ' · ' + esc(x.libelle) + ' : ' + (x.etat === "limite" ? "limite" : (x.critique ? "non conforme (critique)" : "hors tolérance")) + '</li>').join("") +
            (a.problemes.length > 6 ? '<li>+ ' + (a.problemes.length - 6) + ' autre(s)</li>' : "");
        const cmp = S.comparer(Object.assign(etatMesures(inst, "mes"), { client: { tetes: convertir(inst.valeurs.client).map(t => ({ n: t.n, v: t.v })) } }));
        return '<div class="serti-bilan serti-v--' + cls + '"><strong>' + (a.jugees ? "Ligne : " + textePire(a) : "Mesures notées, sans verdict (pas de règle)") + '</strong>' +
            '<span>' + a.mesurees + (inst.nbTetes > 0 ? " tête" + (a.mesurees > 1 ? "s" : "") + " mesurée" + (a.mesurees > 1 ? "s" : "") + " sur " + inst.nbTetes : " série mesurée") + '</span>' +
            (problemes ? '<ul>' + problemes + '</ul>' : "") +
            (cmp.disponible ? '<span class="serti-bilan-cmp">Contrôle client : ' + cmp.nbCases + ' cases comparées, ' + cmp.nbAlertes + ' écart(s) à regarder, écart max ' + virgule(cmp.ecartMax.toFixed(2)) + ' mm</span>' : "") + '</div>';
    }

    /* ---------- Mises à jour de l'affichage ---------- */

    function pastilleValeur(el, etat, regle, critique) {
        const libelles = { ok: "✓ Conforme", limite: "▲ Limite", hors: critique ? "✕ Non conforme" : "✕ Hors tolérance", nr: regle ? "—" : "non jugée" };
        el.className = "pastille-statut pastille-couleur serti-pastille";
        el.setAttribute("style", Donnees.styleCouleur(COULEURS[etat]));
        el.setAttribute("data-etat", etat);
        el.textContent = libelles[etat];
    }

    function majRangee(inst, ligneEl) {
        const id = ligneEl.getAttribute("data-serti-param"), p = R.parametre(id);
        const regle = R.regle(id, inst.colonne, inst.formatCourant());
        const v = S.nombre(ligneEl.querySelector("input").value);
        const etat = S.evaluer(regle, v);
        pastilleValeur(ligneEl.querySelector("[data-serti-pastille]"), etat, regle, p.categorie === "critique");
        const repere = ligneEl.querySelector(".serti-repere");
        if (repere) {
            const g = S.jauge(regle);
            if (v == null || !g) repere.hidden = true;
            else { repere.hidden = false; repere.style.left = Math.max(2, Math.min(98, ((v - g.bas) / (g.haut - g.bas)) * 100)).toFixed(2) + "%"; }
        }
        ligneEl.classList.toggle("serti-param--invalide", ligneEl.querySelector("input").value.trim() !== "" && v == null);
        ligneEl.querySelector("input").setAttribute("aria-invalid", ligneEl.classList.contains("serti-param--invalide") ? "true" : "false");
    }

    function majTetes(inst) {
        const racine = inst.racine;
        listeTetes(inst).forEach(n => {
            const b = racine.querySelector('[data-serti-tete="' + n + '"]'); if (!b) return;
            const e = S.evaluerTete(inst.valeurs[inst.serie][n] || {}, inst.colonne, inst.formatCourant());
            const v = e.verdict === "crit" ? "hors" : e.verdict;
            const mesure = e.mesurees > 0;
            b.className = "serti-tete serti-tete--" + (v === "vide" ? (mesure ? "nr" : "vide") : v) + (n === inst.tete ? " serti-tete--courante" : "");
            b.setAttribute("aria-pressed", n === inst.tete ? "true" : "false");
            b.querySelector(".serti-tete-etat").textContent = v === "vide" ? (mesure ? "•" : "") : SYMBOLES[v];
            b.setAttribute("aria-label", "Tête " + n + ", " + (v === "vide" ? (mesure ? "mesurée, sans verdict" : "pas encore mesurée") : S.LIBELLES_VERDICT[e.verdict]));
        });
        const rangee = racine.querySelector(".serti-tetes"), courante = racine.querySelector(".serti-tete--courante");
        if (rangee && courante) rangee.scrollLeft = courante.offsetLeft - rangee.clientWidth / 2 + courante.offsetWidth / 2;   /* la tête en cours reste visible dans la rangée */
        const av = racine.querySelector("[data-serti-avance]");
        if (av && !(inst.nbTetes > 0)) av.textContent = "";
        else if (av) { const a = S.analyser(etatMesures(inst, inst.serie)); av.textContent = a.mesurees + " tête" + (a.mesurees > 1 ? "s" : "") + " mesurée" + (a.mesurees > 1 ? "s" : "") + " sur " + inst.nbTetes + ". La tête en cours est entourée."; }
    }

    function majVerdictTete(inst) {
        const el = inst.racine.querySelector("[data-serti-verdict-tete]"); if (!el) return;
        const e = S.evaluerTete(inst.valeurs[inst.serie][inst.tete] || {}, inst.colonne, inst.formatCourant());
        const cls = e.verdict === "crit" || e.verdict === "hors" ? "hors" : e.verdict === "vide" ? "nr" : e.verdict;
        el.className = "pastille-statut pastille-couleur serti-pastille";
        el.setAttribute("style", Donnees.styleCouleur(COULEURS[cls]));
        el.setAttribute("data-etat", cls);
        el.textContent = e.verdict === "vide" ? (e.mesurees ? "Sans verdict" : "À mesurer") : e.verdict === "crit" ? "Non conforme" : e.verdict === "hors" ? "Hors tolérance" : e.verdict === "limite" ? "Limite" : "Conforme";
    }

    function majBilan(inst) {
        const a = analyseCourante(inst);
        inst.racine.querySelector("[data-serti-bilan]").innerHTML = htmlBilan(inst, a);
        const val = inst.racine.querySelector("[data-serti-validation]");
        if (!val.contains(document.activeElement) || !val.innerHTML) val.innerHTML = htmlValidation(inst, a);
        const choix = inst.validation || a.validationAuto;
        const court = inst.racine.querySelector("[data-serti-court]");
        court.textContent = a.mesurees || inst.validation
            ? "· " + (a.mesurees ? a.mesurees + (inst.nbTetes > 0 ? " tête" + (a.mesurees > 1 ? "s" : "") : " mesure") : "") + (choix ? " · " + (choix === "oui" ? "OUI" : "NON") : "") + (a.aSurveiller && choix === "oui" ? " ⚠" : "")
            : "· facultatif";
    }

    function tout(inst) {
        const z = inst.racine;
        const cfg = z.querySelector("[data-serti-config]");
        if (!cfg.contains(document.activeElement)) cfg.innerHTML = htmlConfig(inst);
        z.querySelector("[data-serti-tetes]").innerHTML = htmlTetes(inst);
        z.querySelector("[data-serti-saisie]").innerHTML = htmlSaisie(inst);
        z.querySelector("[data-serti-nav]").innerHTML = htmlNav(inst);
        z.querySelectorAll("[data-serti-serie]").forEach(b => { const on = b.getAttribute("data-serti-serie") === inst.serie; b.classList.toggle("actif", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
        z.querySelectorAll("[data-serti-param]").forEach(el => majRangee(inst, el));
        majTetes(inst); majVerdictTete(inst);
        const val = z.querySelector("[data-serti-validation]"); val.innerHTML = "";
        majBilan(inst);
    }

    /* ---------- Événements ---------- */

    function brancher(inst) {
        const z = inst.racine;
        z.addEventListener("input", (e) => {
            const el = e.target;
            if (el.matches("[data-serti-champ]")) {
                const ligneEl = el.closest("[data-serti-param]");
                const t = (inst.valeurs[inst.serie][inst.tete] = inst.valeurs[inst.serie][inst.tete] || {});
                t[el.getAttribute("data-serti-champ")] = el.value;
                majRangee(inst, ligneEl); majVerdictTete(inst); majTetes(inst); majBilan(inst);
            } else if (el.matches("[data-serti-note]")) inst.note = el.value;
            else if (el.matches("[data-serti-noteclient]")) inst.noteClient = el.value;
        });
        z.addEventListener("change", (e) => {
            const el = e.target;
            if (el.matches("[data-serti-nb]")) {
                inst.nbTetes = S.normaliserNbTetes(el.value);
                const liste = listeTetes(inst);
                inst.tete = liste.indexOf(inst.tete) !== -1 ? inst.tete : (liste[0] || 1);
                tout(inst);
            } else if (el.matches("[data-serti-colonne]")) { inst.colonne = el.value; inst.colonneChoisie = true; tout(inst); }
            else if (el.matches("[data-serti-memoriser]")) inst.memoriser = el.checked;
            else if (el.matches("[data-serti-val]")) { inst.validation = el.value; const val = z.querySelector("[data-serti-validation]"); val.innerHTML = ""; majBilan(inst); }
        });
        z.addEventListener("click", (e) => {
            const b = e.target.closest("button"); if (!b || !z.contains(b)) return;
            if (b.hasAttribute("data-serti-serie")) { inst.serie = b.getAttribute("data-serti-serie"); tout(inst); }
            else if (b.hasAttribute("data-serti-tete")) { inst.tete = Number(b.getAttribute("data-serti-tete")); tout(inst); }
            else if (b.hasAttribute("data-serti-nav")) { const l = listeTetes(inst), i = l.indexOf(inst.tete) + Number(b.getAttribute("data-serti-nav")); if (l[i] !== undefined) { inst.tete = l[i]; tout(inst); } }
            else if (b.hasAttribute("data-serti-copier")) {
                const l = listeTetes(inst), prec = inst.valeurs[inst.serie][l[l.indexOf(inst.tete) - 1]] || {};
                const cur = (inst.valeurs[inst.serie][inst.tete] = inst.valeurs[inst.serie][inst.tete] || {});
                Object.keys(prec).forEach(k => { if (!String(cur[k] || "").trim() && String(prec[k]).trim()) cur[k] = prec[k]; });
                tout(inst);
            } else if (b.hasAttribute("data-serti-effacer")) {
                /* Rien n'est détruit sans retour : l'état est gardé 10 secondes pour « Annuler ». */
                const copie = { valeurs: inst.valeurs, validation: inst.validation, note: inst.note, noteClient: inst.noteClient, tete: inst.tete, serie: inst.serie };
                const avait = Object.keys(inst.valeurs.mes).length || Object.keys(inst.valeurs.client).length || inst.validation || inst.note || inst.noteClient;
                inst.valeurs = { mes: {}, client: {} }; inst.validation = ""; inst.note = ""; inst.noteClient = ""; tout(inst);
                if (avait) AppLayout.toastAction("Contrôle effacé", "Annuler", () => { if (instances[inst.prefixe] === inst && inst.racine.isConnected) { Object.assign(inst, copie); tout(inst); } }, 10000);
            }
            else if (b.hasAttribute("data-serti-auto")) { inst.validation = ""; inst.note = ""; z.querySelector("[data-serti-validation]").innerHTML = ""; majBilan(inst); }
        });
        /* « Entrée » ne valide jamais le formulaire : elle passe à la case suivante. */
        z.addEventListener("keydown", (e) => {
            if (e.key !== "Enter" || !e.target.matches("input")) return;
            e.preventDefault();
            const champs = Array.from(z.querySelectorAll("[data-serti-champ]")), i = champs.indexOf(e.target);
            if (i !== -1 && champs[i + 1]) champs[i + 1].focus(); else e.target.blur();
        });
    }

    /* ---------- Lecture pour l'enregistrement ---------- */

    /* Contrôle saisi, tel que Donnees le nettoie (null si le bloc n'est pas monté). */
    function lire(prefixe) {
        const inst = instances[prefixe];
        if (!inst) return null;
        const brut = Object.assign(etatMesures(inst, "mes"), {
            client: { tetes: convertir(inst.valeurs.client).map(t => ({ n: t.n, v: t.v })), note: inst.noteClient },
            validation: inst.validation, note: inst.note });
        return brut;
    }

    /* Réglages à retenir sur la ligne (têtes, colonne), si la case est cochée et qu'ils diffèrent. */
    function reglagesLigne(prefixe) {
        const inst = instances[prefixe];
        if (!inst || !inst.ligne || !inst.memoriser) return null;
        const r = { ligneId: inst.ligne.id };
        const nb = S.normaliserNbTetes(inst.ligne.nbTetes);
        if (inst.nbTetes !== null && inst.nbTetes !== nb) r.nbTetes = inst.nbTetes;
        const autoLigne = inst.ligne.colonneSerti || colonneAutomatique(inst.formatCourant());
        if (inst.colonne && inst.colonne !== autoLigne) r.colonneSerti = inst.colonne;
        return (r.nbTetes !== undefined || r.colonneSerti !== undefined) ? r : null;
    }

    /* ---------- Affichage hors formulaire ---------- */

    /* Pastille « Serti OUI / NON » d'une visite (historique de la fiche client). */
    function pastille(visite) {
        const m = visite && visite.mesures;
        if (!m) return "";
        const etat = S.etatActuel(m), choix = etat.validation;      /* règles d'aujourd'hui, sauf décision manuelle */
        if (!choix) return '<span class="pastille-statut pastille-couleur" style="' + Donnees.styleCouleur("#64748b") + '">🔬 Serti (non jugé)</span>';
        const surv = etat.aSurveiller;
        return '<span class="pastille-statut pastille-couleur" style="' + Donnees.styleCouleur(choix === "oui" ? (surv ? "#b45309" : "#16a34a") : "#b91c1c") + '">🔬 Serti ' + (choix === "oui" ? "OUI" : "NON") + (surv ? " ⚠" : "") + '</span>';
    }

    /* ---------- Aides pour le formulaire de ligne ---------- */

    function optionsNbTetes() {
        return [{ valeur: "", texte: "— Non renseigné" }].concat(S.NB_TETES_OPTIONS.map(n => ({ valeur: String(n), texte: n === 0 ? "0 · aucune tête (une seule série)" : n + " têtes" })));
    }
    function optionsColonnes() {
        return [{ valeur: "", texte: "Automatique (d'après le format)" }].concat(R.COLONNES.map(c => {
            const f = R.formatsDeLaColonne(c.id);
            return { valeur: c.id, texte: c.id + (f.length ? " · " + f.join(", ") : "") };
        }));
    }
    /* Phrase d'aide sous les deux champs : ce que le format et la colonne s'impliquent. */
    function aideFormat(format, colonne) {
        const cols = R.colonnesDuFormat(format);
        if (colonne) {
            const noms = R.formatsDeLaColonne(colonne);
            return noms.length > 1 ? esc(noms.join(", ")) + " partagent le diamètre " + esc(colonne.split(" ")[0]) + " : seule la hauteur de boîte change." : "";
        }
        if (cols.length > 1) return esc(format) + " existe en deux diamètres (" + esc(cols.map(c => c.split(" ")[0]).join(" ou ")) + ") : choisis celui de cette ligne.";
        if (format && !R.formatConnu(format)) return "« " + esc(format) + " » n'est pas dans le référentiel : choisis la colonne du document pour avoir un verdict.";
        return "";
    }

    return { monter, demonter, lire, reglagesLigne, majFormat, ligneMontee, estMonte, pastille, colonneAutomatique, optionsNbTetes, optionsColonnes, aideFormat };
})();
