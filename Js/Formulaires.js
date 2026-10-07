/* =============================================================
   Formulaires.js — Formulaires partagés (AC SAT Campagne)

   Utilisés depuis plusieurs pages (bouton « + », tableau, fiche client),
   d'où un module commun plutôt qu'une copie par page. Chaque formulaire
   s'ouvre dans une feuille coulissante et enregistre via Donnees : les
   pages se mettent à jour d'elles-mêmes grâce à Donnees.ecouter().

   Le formulaire client reprend celui d'AC SAT Field (mêmes champs de
   base, même remplissage automatique ville/région depuis le code postal),
   complété des réglages de campagne.
   ============================================================= */

const Formulaires = (() => {
    "use strict";

    const esc = (t) => AppLayout.escapeHtml(t);

    /* ---------- Briques de formulaire ---------- */

    /* Double envoi (≠ un doublon de nom de ligne ou de client) : un second « submit » dans les 800 ms (double clic, double toucher) est ignoré. Un envoi refusé par la
       validation ne bloque rien : on ne compte que le moment du dernier essai, et 800 ms sont plus courts qu'une correction. */
    function envoiEnDouble(form) {
        const maintenant = Date.now();
        if (maintenant - (Number(form.dataset.dernierEnvoi) || 0) < 800) return true;
        form.dataset.dernierEnvoi = String(maintenant);
        return false;
    }

    /* Aides de saisie : le bon clavier sur téléphone, et AUCUNE suggestion de remplissage automatique : ces champs décrivent des
       clients et des contacts, pas l'utilisateur (le navigateur lui proposerait ses propres coordonnées). */
    function aidesSaisie(id, type) {
        let attributs = ' autocomplete="off"';
        if (type === "number") attributs += ' inputmode="numeric"';
        else if (type === "email") attributs += ' autocapitalize="none" spellcheck="false"';
        else if (type === "text" && /-(nom|prenom|ville|adresse)$/.test(id)) attributs += ' autocapitalize="words"';
        return attributs;
    }

    function champ(id, label, type, valeur, placeholder) {
        return '<label for="' + id + '">' + label + '</label>' +
            '<input type="' + type + '" id="' + id + '"' + aidesSaisie(id, type) + ' value="' + esc(valeur == null ? "" : valeur) + '"' +
            (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + '>';
    }

    function liste(id, label, options, valeur, avecVide) {
        /* Valeur venue d'un import Excel absente de la liste (rôle ajouté
           dans l'onglet Listes du modèle…) : on l'ajoute pour ne pas la
           perdre silencieusement en enregistrant le formulaire. */
        const valeurs = options.map(o => String(typeof o === "object" ? o.valeur : o));
        if (valeur !== undefined && valeur !== null && valeur !== "" && valeurs.indexOf(String(valeur)) === -1) {
            options = [valeur].concat(options);
        }
        return '<label for="' + id + '">' + label + '</label>' +
            '<select id="' + id + '">' +
            (avecVide ? '<option value="">—</option>' : "") +
            options.map(o => {
                const v = typeof o === "object" ? o.valeur : o;
                const t = typeof o === "object" ? o.texte : o;
                return '<option value="' + esc(v) + '"' + (String(v) === String(valeur) ? " selected" : "") + '>' + esc(t) + '</option>';
            }).join("") +
            '</select>';
    }

    /* Champ texte avec suggestions (liste native <datalist>) : les valeurs
       déjà saisies pour cette rubrique, tout en gardant la saisie libre. */
    function champTexteSuggere(id, label, valeur, cle, attrs, placeholder) {
        const sug = cle ? Donnees.valeursConnues(cle, {}) : [];
        return '<label for="' + id + '">' + label + '</label>' +
            '<input type="text" id="' + id + '" value="' + esc(valeur == null ? "" : valeur) + '"' +
            (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') +
            (sug.length ? ' list="dl-' + id + '"' : '') + (attrs || "") + ' autocomplete="off">' +
            (sug.length ? '<datalist id="dl-' + id + '">' + sug.map(x => '<option value="' + esc(x) + '"></option>').join("") + '</datalist>' : "");
    }

    /* Liste déroulante des valeurs connues + « ➕ Autre… » qui ouvre un champ
       pour taper une valeur nouvelle (proposée la fois suivante).
       Sans aucune valeur connue : simple champ texte, plus direct.
       opts : { attrs, placeholder, suggestions (clé pour le champ texte) }. */
    function choixLibre(id, label, options, valeur, opts) {
        const o = opts || {};
        const v = valeur == null ? "" : String(valeur).trim();
        const vus = new Set();
        const propre = (tab) => (tab || []).filter(x => {
            if (typeof x !== "string" || !x.trim()) return false;
            const k = Donnees.normaliserTexte(x);
            if (vus.has(k)) return false;      // valeur fixe + valeur déjà saisie identique : une seule entrée
            vus.add(k);
            return true;
        });
        /* options : liste simple, ou { groupes: [{ libelle, valeurs }] } (affichée en <optgroup>). */
        let groupes = options && options.groupes ? options.groupes.map(g => ({ libelle: g.libelle, valeurs: propre(g.valeurs) })).filter(g => g.valeurs.length) : null;
        let liste = groupes ? [].concat.apply([], groupes.map(g => g.valeurs)) : propre(options);
        if (liste.length === 0) return champTexteSuggere(id, label, v, o.suggestions, o.attrs, o.placeholder);
        const meme = (a, b) => Donnees.normaliserTexte(a) === Donnees.normaliserTexte(b);
        const absente = v !== "" && !liste.some(x => meme(x, v));          // valeur importée absente de la liste : gardée
        if (absente && !groupes) liste = [v].concat(liste);
        if (absente && groupes) groupes = [{ libelle: "Valeur actuelle", valeurs: [v] }].concat(groupes);
        const option = (x) => '<option value="' + esc(x) + '"' + (v !== "" && meme(x, v) ? " selected" : "") + '>' + esc(x) + '</option>';
        return '<label for="' + id + '">' + label + '</label>' +
            '<select id="' + id + '" data-choix-libre' + (o.attrs || "") + '>' +
            '<option value="">—</option>' +
            (groupes ? groupes.map(g => '<optgroup label="' + esc(g.libelle) + '">' + g.valeurs.map(option).join("") + '</optgroup>').join("") : liste.map(option).join("")) +
            '<option value="' + AUTRE_LIBRE + '">➕ Autre…</option></select>' +
            '<input type="text" id="' + id + '-libre" class="champ-libre" autocomplete="off" autocapitalize="words" placeholder="' + esc(o.placeholder || "Saisir une autre valeur") + '" aria-label="Autre valeur" hidden>';
    }

    /* Fixe la valeur d'un champ, liste à saisie libre ou champ texte simple. */
    function definirChoix(id, valeur) {
        const el = document.getElementById(id);
        if (!el) return;
        const v = valeur == null ? "" : String(valeur).trim();
        if (!el.hasAttribute("data-choix-libre")) { el.value = v; return; }
        const libre = document.getElementById(id + "-libre");
        const cible = Array.prototype.find.call(el.options, o => o.value !== "" && o.value !== AUTRE_LIBRE &&
            Donnees.normaliserTexte(o.value) === Donnees.normaliserTexte(v));
        if (v === "") { el.value = ""; libre.hidden = true; libre.value = ""; }
        else if (cible) { el.value = cible.value; libre.hidden = true; libre.value = ""; }
        else { el.value = AUTRE_LIBRE; libre.hidden = false; libre.value = v; }
    }

    /* « Autre… » choisi : le champ texte apparaît et prend le focus. Écouteur
       unique en phase de capture : il sert aussi aux listes créées plus tard. */
    document.addEventListener("change", (ev) => {
        const sel = ev.target;
        if (!sel || !sel.matches || !sel.matches("select[data-choix-libre]")) return;
        const libre = document.getElementById(sel.id + "-libre");
        if (!libre) return;
        libre.hidden = sel.value !== AUTRE_LIBRE;
        if (!libre.hidden) libre.focus();
    }, true);

    function zoneTexte(id, label, valeur, placeholder) {
        return '<label for="' + id + '">' + label + '</label>' +
            '<textarea id="' + id + '" rows="3"' + (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + '>' +
            esc(valeur || "") + '</textarea>';
    }

    function caseACocher(id, label, coche) {
        return '<label class="champ-case"><input type="checkbox" id="' + id + '"' + (coche ? " checked" : "") + '> ' + label + '</label>';
    }

    function deuxColonnes(a, b) {
        return '<div class="grille-2-colonnes"><div>' + a + '</div><div>' + b + '</div></div>';
    }

    function piedFormulaire(texteBouton) {
        return '<p class="message-erreur" data-erreur role="alert"></p>' +
            '<button type="submit" class="bouton bouton--large">' + texteBouton + '</button>';
    }

    /* Valeur d'un champ. Pour une liste « choix + saisie libre », renvoie le
       texte tapé quand « Autre… » est choisi. */
    const AUTRE_LIBRE = "__libre__";
    const val = (id) => {
        const el = document.getElementById(id);
        if (!el) return "";
        if (el.hasAttribute("data-choix-libre") && el.value === AUTRE_LIBRE) {
            const libre = document.getElementById(id + "-libre");
            return libre ? libre.value.trim() : "";
        }
        return el.value.trim();
    };
    const valeurElement = (el) => (el.id ? val(el.id) : el.value.trim());
    const coche = (id) => { const el = document.getElementById(id); return !!(el && el.checked); };

    function erreur(form, message) {
        form.querySelector("[data-erreur]").textContent = message || "";
        if (message) form.dataset.dernierEnvoi = "0";      // envoi refusé par la validation : la correction qui suit doit pouvoir partir aussitôt (voir envoiEnDouble)
    }

    /* ---------- Techniciens de l'équipe ---------- */

    function membresEquipe() {
        return typeof Synchro !== "undefined" && Synchro.membresEquipe ? Synchro.membresEquipe() : [];
    }

    function nomTechnicien(id) {
        if (!id) return "";
        const m = membresEquipe().find(x => x.id === id);
        return m ? (m.nom || "(sans nom)") + (m.moi ? " (moi)" : "") : "Ancien membre";
    }

    function champTechnicien(id, valeur) {
        const membres = membresEquipe();
        if (!membres.length) return "";
        return liste(id, "Technicien", [{ valeur: "", texte: "Non attribué (visible par tous)" }]
            .concat(membres.map(m => ({ valeur: m.id, texte: (m.nom || "(sans nom)") + (m.moi ? " (moi)" : "") }))), valeur || "");
    }

    function dateFr(iso) {
        if (!iso) return "—";
        const [y, m, d] = iso.split("-");
        return d + "/" + m + "/" + y;
    }

    const OPTIONS_MOIS = Donnees.MOIS.map((m, i) => ({ valeur: i + 1, texte: m }));

    /* ---------- Code postal → ville / région (repris d'AC SAT Field) ---------- */

    async function rechercherCodePostal(cp) {
        try {
            const res = await fetch("https://geo.api.gouv.fr/communes?codePostal=" + cp + "&fields=nom,region&format=json");
            if (!res.ok) return null;
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                return { ville: data[0].nom, region: (data[0].region && data[0].region.nom) || "" };
            }
        } catch (e) { Erreurs.consigner("Formulaires : pas de connexion : l'utilisateur saisit la ville lui-même", e); }
        return null;
    }

    function brancherCodePostal() {
        const champCp = document.getElementById("fc-cp");
        const champVille = document.getElementById("fc-ville");
        const champRegion = document.getElementById("fc-region");
        let villeManuelle = !!champVille.value;
        let dernierCp = champCp.value;
        champVille.addEventListener("input", () => { villeManuelle = true; });

        champCp.addEventListener("input", () => {
            if (val("fc-pays").toLowerCase() !== "france") return;
            champCp.value = champCp.value.replace(/\D/g, "").slice(0, 5);
            const cp = champCp.value;
            if (cp.length !== 5 || cp === dernierCp) return;
            dernierCp = cp;
            rechercherCodePostal(cp).then(info => {
                if (!info || champCp.value !== cp) return;
                champRegion.value = info.region;
                if (!villeManuelle || !champVille.value) champVille.value = info.ville;
            });
        });
    }

    /* ---------- Suppression de clients ----------
       Une seule confirmation pour tous les points d'entrée (fiche, formulaire
       « Modifier », sélection dans la liste), avec ce qui sera emporté, puis
       10 s pour annuler. La copie de sauvegarde passe par la page suivante
       (sessionStorage) quand la suppression se fait depuis la fiche. */

    const CLE_ANNULATION = "acsc_annuler_suppression";

    function memoriserAnnulation(copie) {
        try { sessionStorage.setItem(CLE_ANNULATION, JSON.stringify({ le: Date.now(), copie })); } catch (e) { Erreurs.consigner("Formulaires : trop gros : pas d'annulation", e); }
    }

    function proposerAnnulation(copie) {
        const n = (copie.clients || []).length;
        AppLayout.toastAction(n + " client" + (n > 1 ? "s supprimés" : " supprimé"), "Annuler", () => {
            const r = Donnees.restaurerClients(copie);
            AppLayout.toastSucces(r + " client" + (r > 1 ? "s restaurés" : " restauré") + " ✓");
        }, 10000);
    }

    /* À l'ouverture de la page suivante : propose d'annuler une suppression faite juste avant. */
    function reprendreAnnulation() {
        let m = null;
        try { m = JSON.parse(sessionStorage.getItem(CLE_ANNULATION) || "null"); sessionStorage.removeItem(CLE_ANNULATION); } catch (e) { m = null; }
        if (m && m.copie && Date.now() - m.le < 15000) proposerAnnulation(m.copie);
    }

    /* options.apres(copie) : appelé après la suppression (sinon : proposition d'annuler sur place). */
    function supprimerClients(ids, options) {
        const liste = (ids || []).filter(id => Donnees.getClient(id));
        if (!liste.length) return;
        const r = Donnees.resumeSuppression(liste);
        const noms = liste.map(id => Donnees.getClient(id).nom);
        const equipe = typeof Synchro !== "undefined" ? Synchro.etat().equipe : null;
        const ligneInfo = (icone, n, mot) => n ? '<div class="ligne-info"><span class="texte-attenue">' + icone + ' ' + mot + (n > 1 ? "s" : "") + '</span><strong>' + n + '</strong></div>' : "";
        AppLayout.ouvrirFeuille("bas", liste.length > 1 ? "Supprimer " + liste.length + " clients ?" : "Supprimer ce client ?",
            '<p style="margin:0 0 8px;font-weight:700;overflow-wrap:anywhere;">' + esc(noms.slice(0, 5).join(", ")) + (noms.length > 5 ? " … et " + (noms.length - 5) + " autre(s)" : "") + '</p>' +
            '<div class="carte" style="padding:4px 14px;">' +
            ligneInfo("🏭", r.nbLignes, "ligne") + ligneInfo("👤", r.nbContacts, "contact") + ligneInfo("🕑", r.nbVisites, "visite") + ligneInfo("📅", r.nbRdv, "rendez-vous") +
            (r.nbLignes + r.nbContacts + r.nbVisites + r.nbRdv === 0 ? '<div class="ligne-info"><span class="texte-attenue">Aucune ligne, visite ni contact rattaché</span></div>' : "") +
            '</div>' +
            (equipe ? '<p class="aide-champ texte-danger">⚠️ Équipe « ' + esc(equipe.nom) + ' » : le client, ses lignes et ses contacts disparaîtront aussi chez tes collègues. Tes visites et rendez-vous sont personnels.</p>' : "") +
            '<p class="aide-champ">Tu pourras annuler pendant 10 secondes juste après.</p>' +
            '<button type="button" class="bouton bouton--large bouton--danger-plein" data-confirmer-suppression>🗑 Supprimer définitivement</button>' +
            '<button type="button" class="bouton bouton--contour bouton--large" data-annuler-suppression style="margin-top:8px;">Annuler</button>');
        const f = document.querySelector(".feuille");
        f.querySelector("[data-annuler-suppression]").addEventListener("click", () => AppLayout.fermerFeuille());
        f.querySelector("[data-confirmer-suppression]").addEventListener("click", () => {
            const copie = Donnees.supprimerClients(liste);
            AppLayout.fermerFeuille();
            if (options && options.apres) options.apres(copie); else proposerAnnulation(copie);
        });
    }

    /* ---------- Client (création / modification) ---------- */

    function client(existant, apresEnregistrement) {
        const c = existant || { pays: "France", debutCampagne: 5, finCampagne: 11, cadenceJours: 14, actif: true };
        const corps =
            '<form id="form-client" novalidate>' +
            champ("fc-nom", "Nom du client *", "text", c.nom, "ex. Conserverie du Lot") +
            choixLibre("fc-groupe", "Groupe", Donnees.valeursConnues("groupe"), c.groupe) +
            champ("fc-adresse", "Adresse (rue + numéro)", "text", c.adresse, "12 route de la Gare") +
            deuxColonnes(champ("fc-cp", "Code postal", "text", c.codePostal, "46000"),
                champ("fc-ville", "Ville *", "text", c.ville)) +
            deuxColonnes(champ("fc-region", "Région", "text", c.region, "Auto"),
                choixLibre("fc-pays", "Pays *", Donnees.valeursConnues("pays"), c.pays)) +
            deuxColonnes(champ("fc-tel", "Téléphone standard", "tel", c.telephone),
                champ("fc-email", "Email général", "email", c.email)) +
            choixLibre("fc-production", "Type de production", Donnees.valeursConnues("typeProduction"), c.typeProduction) +
            champTechnicien("fc-technicien", existant ? c.technicien : (Donnees.getTechnicienCourant() || "")) +
            '<div class="bloc-formulaire">' +
            '<div class="bloc-formulaire-titre">📆 Campagne</div>' +
            deuxColonnes(liste("fc-debut", "Début *", OPTIONS_MOIS, c.debutCampagne),
                liste("fc-fin", "Fin *", OPTIONS_MOIS, c.finCampagne)) +
            champ("fc-cadence", "Cadence des visites (jours) *", "number", c.cadenceJours) +
            '<p class="aide-champ">Entre 7 et 60 jours. 14 = toutes les 2 semaines, 21 = toutes les 3 semaines.</p>' +
            (existant ? caseACocher("fc-actif", "Client actif (décoché : conservé, sans rappel)", c.actif !== false) : "") +
            '</div>' +
            zoneTexte("fc-notes", "Notes", c.notes, "Accès, horaires, particularités…") +
            piedFormulaire(existant ? "Enregistrer les modifications" : "Créer le client") +
            (existant ? '<div class="zone-danger"><div class="zone-danger-titre">Zone sensible</div>' +
                '<button type="button" class="bouton bouton--contour bouton--danger bouton--large" data-supprimer-ce-client>🗑 Supprimer ce client…</button></div>' : "") +
            '</form>';

        AppLayout.ouvrirFeuille("bas", existant ? "Modifier le client" : "Nouveau client", corps);
        brancherCodePostal();
        const bSupprimer = document.querySelector("[data-supprimer-ce-client]");
        if (bSupprimer) bSupprimer.addEventListener("click", () => supprimerClients([existant.id], { apres: (copie) => {
            /* Depuis la fiche du client supprimé : retour à la liste, l'annulation y est proposée. */
            if (/Client\.html$/i.test(window.location.pathname)) { memoriserAnnulation(copie); window.location.href = "Clients.html"; }
            else proposerAnnulation(copie);
        } }));

        const form = document.getElementById("form-client");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (envoiEnDouble(form)) return;
            const nom = val("fc-nom");
            const cadence = parseInt(val("fc-cadence"), 10);
            if (!nom || !val("fc-ville") || !val("fc-pays")) return erreur(form, "Nom, ville et pays sont requis.");
            if (isNaN(cadence) || cadence < 7 || cadence > 60) return erreur(form, "La cadence doit être comprise entre 7 et 60 jours.");
            const homonyme = Donnees.trouverClientParNom(nom);
            if (homonyme && (!existant || homonyme.id !== existant.id)) {
                return erreur(form, "Un client porte déjà ce nom. Distingue-le (ex. « " + nom + " – " + (val("fc-ville") || "ville") + " »).");
            }

            const source = {
                nom, groupe: val("fc-groupe"), adresse: val("fc-adresse"), codePostal: val("fc-cp"),
                ville: val("fc-ville"), region: val("fc-region"), pays: val("fc-pays"),
                telephone: val("fc-tel"), email: val("fc-email"), typeProduction: val("fc-production"),
                debutCampagne: val("fc-debut"), finCampagne: val("fc-fin"), cadenceJours: cadence,
                notes: val("fc-notes")
            };
            if (existant) source.actif = coche("fc-actif");
            if (document.getElementById("fc-technicien")) source.technicien = val("fc-technicien");

            const resultat = existant ? Donnees.modifierClient(existant.id, source) : Donnees.ajouterClient(source);
            AppLayout.fermerFeuille();
            AppLayout.toastSucces(existant ? "Client mis à jour ✓" : "Client créé ✓ — ajoute maintenant ses lignes");
            if (apresEnregistrement) apresEnregistrement(resultat);
        });
    }

    /* ---------- Contact ---------- */

    function contact(clientId, existant) {
        const x = existant || { role: Donnees.ROLES_CONTACT[0] };
        const corps =
            '<form id="form-contact" novalidate>' +
            choixLibre("fk-role", "Rôle *", Donnees.valeursConnues("role"), x.role) +
            deuxColonnes(champ("fk-prenom", "Prénom", "text", x.prenom), champ("fk-nom", "Nom *", "text", x.nom)) +
            deuxColonnes(champ("fk-fixe", "Téléphone fixe", "tel", x.telephoneFixe), champ("fk-mobile", "Mobile", "tel", x.mobile)) +
            champ("fk-email", "Email", "email", x.email) +
            caseACocher("fk-principal", "Contact principal (à appeler en premier)", x.principal) +
            zoneTexte("fk-notes", "Notes", x.notes, "Disponibilités, particularités…") +
            piedFormulaire(existant ? "Enregistrer" : "Ajouter le contact") +
            '</form>';

        AppLayout.ouvrirFeuille("bas", existant ? "Modifier le contact" : "Nouveau contact", corps);
        const form = document.getElementById("form-contact");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (envoiEnDouble(form)) return;
            if (!val("fk-nom")) return erreur(form, "Le nom est requis.");
            Donnees.enregistrerContact(clientId, {
                role: val("fk-role") || "Autre", prenom: val("fk-prenom"), nom: val("fk-nom"),
                telephoneFixe: val("fk-fixe"), mobile: val("fk-mobile"), email: val("fk-email"),
                principal: coche("fk-principal"), notes: val("fk-notes")
            }, existant && existant.id);
            AppLayout.fermerFeuille();
            AppLayout.toastSucces("Contact enregistré ✓");
        });
    }

    /* ---------- Ligne de production ---------- */

    /* Outillage : fournisseur en liste (ceux d'office + ceux déjà saisis,
       « Autre… » pour en ajouter un) et référence en champ libre. */
    const AUTRE = "__autre__";

    function blocOutillage(x) {
        const fournisseurs = Donnees.fournisseursOutillage();
        return '<div class="bloc-formulaire"><div class="bloc-formulaire-titre">🔩 Outillage</div>' +
            Donnees.OUTILS.map(o => {
                const actuel = x[o.cle + "Fournisseur"] || "";
                const options = fournisseurs.slice();
                if (actuel && options.indexOf(actuel) === -1) options.unshift(actuel);
                return '<div class="ligne-outil">' +
                    '<span class="ligne-outil-libelle">' + o.libelle + '</span>' +
                    '<div><label for="fo-' + o.cle + '-f">Fournisseur</label>' +
                    '<select id="fo-' + o.cle + '-f" data-outil="' + o.cle + '">' +
                    '<option value="">—</option>' +
                    options.map(f => '<option value="' + esc(f) + '"' + (f === actuel ? " selected" : "") + '>' + esc(f) + '</option>').join("") +
                    '<option value="' + AUTRE + '">➕ Autre…</option></select>' +
                    '<input type="text" id="fo-' + o.cle + '-autre" autocomplete="off" autocapitalize="words" placeholder="Nom du fournisseur" hidden style="margin-top:6px;"></div>' +
                    '<div>' + choixLibre("fo-" + o.cle + "-r", "Référence", { groupes: groupesReferences(o.cle, actuel) }, x[o.cle + "Ref"] || "", { placeholder: "ex. P259M", suggestions: "outil:" + o.cle }) + '</div>' +
                    '</div>';
            }).join("") +
            '</div>';
    }

    /* Références d'outillage connues pour un outil, groupées par FOURNISSEUR (celui de l'outil en cours d'abord). Les deux molettes
       partagent leurs références (une molette 2 peut être une référence déjà utilisée en molette 1) ; le mandrin a les siennes.
       C'était un champ texte avec suggestions natives (<datalist>) : le navigateur ne montrait que les entrées commençant par ce qui
       était déjà tapé, donc, avec « P259 » dans le champ, jamais « P259M » ni les autres références. Une vraie liste montre TOUT. */
    function groupesReferences(cle, fournisseurActuel) {
        const famille = cle === "mandrin" ? ["mandrin"] : ["molette1", "molette2"];
        const norm = (t) => Donnees.normaliserTexte(t);
        const parFournisseur = new Map();
        const ajouter = (fournisseur, reference) => {
            const ref = String(reference || "").trim();
            if (!ref) return;
            const nom = String(fournisseur || "").trim();
            if (!parFournisseur.has(nom)) parFournisseur.set(nom, []);
            const liste = parFournisseur.get(nom);
            if (!liste.some(x => norm(x) === norm(ref))) liste.push(ref);
        };
        Donnees.getDonnees().lignes.forEach(l => famille.forEach(k => ajouter(l[k + "Fournisseur"], l[k + "Ref"])));
        /* Références connues sans fournisseur retrouvé (pré-chargées ou issues d'un import) : regroupées à part. */
        Donnees.valeursConnues("outil:" + cle).forEach(r => {
            if (!Array.from(parFournisseur.values()).some(liste => liste.some(x => norm(x) === norm(r)))) ajouter("", r);
        });
        const tri = (a, b) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" });
        const ordre = (nom) => (nom === "" ? 2 : nom === fournisseurActuel ? 0 : 1);
        return Array.from(parFournisseur.keys()).sort((a, b) => ordre(a) - ordre(b) || tri(a, b))
            .map(nom => ({ libelle: nom === "" ? "Autres références" : nom, valeurs: parFournisseur.get(nom).sort(tri) }));
    }

    /* Quand on change de fournisseur, la liste des références remet ses références en premier ; la valeur déjà choisie est gardée. */
    function rafraichirReferences(cle) {
        const ref = document.getElementById("fo-" + cle + "-r");
        if (!ref || !ref.hasAttribute("data-choix-libre")) return;          // aucune référence connue : simple champ texte
        const courant = val("fo-" + cle + "-r");
        const choix = val("fo-" + cle + "-f");
        const fournisseur = choix === AUTRE ? val("fo-" + cle + "-autre") : choix;
        const temporaire = document.createElement("div");
        temporaire.innerHTML = choixLibre("fo-temporaire", "", { groupes: groupesReferences(cle, fournisseur) }, courant, {});
        const nouvelle = temporaire.querySelector("select");
        if (!nouvelle) return;
        ref.innerHTML = nouvelle.innerHTML;
        definirChoix("fo-" + cle + "-r", courant);
    }

    function brancherOutillage() {
        document.querySelectorAll("[data-outil]").forEach(sel => {
            const autre = document.getElementById("fo-" + sel.getAttribute("data-outil") + "-autre");
            sel.addEventListener("change", () => {
                autre.hidden = sel.value !== AUTRE;
                if (!autre.hidden) autre.focus();
                rafraichirReferences(sel.getAttribute("data-outil"));
            });
        });
    }

    function lireOutillage() {
        const r = {};
        Donnees.OUTILS.forEach(o => {
            const choix = val("fo-" + o.cle + "-f");
            r[o.cle + "Fournisseur"] = choix === AUTRE ? val("fo-" + o.cle + "-autre") : choix;
            r[o.cle + "Ref"] = val("fo-" + o.cle + "-r");
        });
        return r;
    }

    function ligne(clientId, existant) {
        const x = existant || { statut: "active" };
        const statut = Donnees.statutLigne(x);
        const corps =
            '<form id="form-ligne" novalidate>' +
            champ("fl-nom", "Nom / n° de ligne *", "text", x.nom, "ex. Ligne 2") +
            deuxColonnes(choixLibre("fl-marque", "Marque sertisseuse", Donnees.valeursConnues("marque"), x.marque),
                '<div id="fl-modele-zone">' + choixLibre("fl-modele", "Modèle sertisseuse", Donnees.valeursConnues("modele", { marque: x.marque }), x.modele) + '</div>') +
            deuxColonnes(choixLibre("fl-format", "Format habituel", Donnees.valeursConnues("format"), x.formatHabituel, { placeholder: "ex. 4/4" }),
                choixLibre("fl-produit", "Produit habituel", Donnees.choixPour("produit"), x.produitHabituel)) +
            deuxColonnes(liste("fl-tetes", "Têtes de sertissage", FicheSerti.optionsNbTetes(), x.nbTetes === undefined || x.nbTetes === null ? "" : x.nbTetes),
                liste("fl-colonne", "Format fournisseur (document)", FicheSerti.optionsColonnes(), x.colonneSerti || "")) +
            '<p class="aide-champ" id="fl-serti-aide"></p>' +
            blocOutillage(x) +
            deuxColonnes(champ("fl-cadence", "Cadence (boîtes/min)", "number", x.cadenceLigne),
                champ("fl-serie", "N° de série (facultatif)", "text", x.numeroSerie)) +
            '<label>Statut de la ligne</label>' +
            '<div class="choix-statut" role="radiogroup">' + Donnees.STATUTS_LIGNE.map(st =>
                '<label class="choix-statut-option"><input type="radio" name="fl-statut" value="' + st.cle + '"' + (st.cle === statut ? " checked" : "") + '>' +
                '<span>' + esc(st.libelle) + '</span></label>').join("") + '</div>' +
            '<p class="aide-champ">Seule une ligne active entre dans les rappels, les visites et les rendez-vous. L\'historique reste consultable.</p>' +
            '<div id="fl-bloc-fournisseur"' + (statut === "concurrent" ? "" : " hidden") + '>' +
            choixLibre("fl-fournisseur-actuel", "Fournisseur actuel", Donnees.valeursConnues("fournisseurActuel"), x.fournisseurActuel, { placeholder: "Nom du fournisseur" }) + '</div>' +
            zoneTexte("fl-notes", "Notes", x.notes) +
            piedFormulaire(existant ? "Enregistrer" : "Ajouter la ligne") +
            '</form>';

        AppLayout.ouvrirFeuille("bas", existant ? "Modifier la ligne" : "Nouvelle ligne", corps);
        brancherOutillage();
        /* Le modèle proposé dépend de la marque choisie. */
        const marque = document.getElementById("fl-marque");
        const rafraichirModeles = () => {
            const courant = val("fl-modele");
            document.getElementById("fl-modele-zone").innerHTML =
                choixLibre("fl-modele", "Modèle sertisseuse", Donnees.valeursConnues("modele", { marque: val("fl-marque") }), courant);
        };
        marque.addEventListener("change", rafraichirModeles);
        /* Format boîte et format fournisseur se complètent : choisir l'un remplit l'autre quand il n'y a pas d'ambiguïté. */
        const selColonne = document.getElementById("fl-colonne");
        const aideSerti = () => { document.getElementById("fl-serti-aide").innerHTML = FicheSerti.aideFormat(val("fl-format"), selColonne.value || FicheSerti.colonneAutomatique(val("fl-format"))); };
        /* Un format qui n'a qu'une colonne l'impose ; un format à deux colonnes (4/4) garde le choix s'il en fait partie ;
           un format libre ou inconnu laisse le choix à la main. */
        const formatChange = () => {
            const fmt = val("fl-format"), auto = FicheSerti.colonneAutomatique(fmt), cols = ReferentielSerti.colonnesDuFormat(fmt);
            if (auto) selColonne.value = auto;
            else if (cols.length > 1 && cols.indexOf(selColonne.value) === -1) selColonne.value = "";
            aideSerti();
        };
        document.getElementById("fl-format").addEventListener("change", formatChange);
        const formatLibre = document.getElementById("fl-format-libre");
        if (formatLibre) formatLibre.addEventListener("input", formatChange);
        selColonne.addEventListener("change", () => {
            const noms = ReferentielSerti.formatsDeLaColonne(selColonne.value);
            if (selColonne.value && !val("fl-format") && noms.length === 1) definirChoix("fl-format", noms[0]);
            aideSerti();
        });
        if (!existant || !existant.colonneSerti) { const auto = FicheSerti.colonneAutomatique(val("fl-format")); if (auto) selColonne.value = auto; }
        aideSerti();
        const marqueLibre = document.getElementById("fl-marque-libre");
        if (marqueLibre) marqueLibre.addEventListener("change", rafraichirModeles);
        document.querySelectorAll('input[name="fl-statut"]').forEach(r => r.addEventListener("change", () => {
            document.getElementById("fl-bloc-fournisseur").hidden = r.value !== "concurrent" || !r.checked;
        }));
        const form = document.getElementById("form-ligne");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (envoiEnDouble(form)) return;
            const nom = val("fl-nom");
            if (!nom) return erreur(form, "Le nom de la ligne est requis.");
            const doublon = Donnees.lignesDuClient(clientId).find(l =>
                Donnees.normaliserTexte(l.nom) === Donnees.normaliserTexte(nom) && (!existant || l.id !== existant.id));
            if (doublon) return erreur(form, "Ce client a déjà une ligne « " + nom + " ».");
            const outillage = lireOutillage();
            const manquant = Donnees.OUTILS.find(o => val("fo-" + o.cle + "-f") === AUTRE && !outillage[o.cle + "Fournisseur"]);
            if (manquant) return erreur(form, manquant.libelle + " : saisis le nom du nouveau fournisseur.");
            Donnees.enregistrerLigne(clientId, Object.assign({
                nom, marque: val("fl-marque"), modele: val("fl-modele"), numeroSerie: val("fl-serie"),
                cadenceLigne: val("fl-cadence"), formatHabituel: val("fl-format"),
                nbTetes: val("fl-tetes"),
                /* La colonne n'est retenue que si elle diffère de celle que le format donne tout seul (sinon elle resterait figée si le format change). */
                colonneSerti: selColonne.value && selColonne.value !== FicheSerti.colonneAutomatique(val("fl-format")) ? selColonne.value : "",
                produitHabituel: val("fl-produit"), notes: val("fl-notes"),
                statut: (document.querySelector('input[name="fl-statut"]:checked') || {}).value || "active",
                fournisseurActuel: val("fl-fournisseur-actuel")
            }, outillage), existant && existant.id);
            AppLayout.fermerFeuille();
            AppLayout.toastSucces("Ligne enregistrée ✓");
        });
    }

    /* ---------- Types de visite : options, références, champs propres ----------
       Le bloc se redessine quand on change de type, en gardant ce qui a
       déjà été saisi. Molette et mandrin sont pré-remplis depuis
       l'outillage de la ligne choisie. */

    const OPTIONS_TYPES = Donnees.TYPES_VISITE.map(t => ({ valeur: t.cle, texte: t.libelle }));

    function lireComplements(prefixe) {
        const references = {}, details = {};
        document.querySelectorAll('[data-ref^="' + prefixe + '"]').forEach(el => { references[el.getAttribute("data-cle")] = valeurElement(el); });
        document.querySelectorAll('[data-detail^="' + prefixe + '"]').forEach(el => { details[el.getAttribute("data-cle")] = valeurElement(el); });
        return { references, details };
    }

    /* clientId : sert aux listes « Avec qui », « Validé par » (contacts du
       client) et « Machine » (machines de ses lignes). */
    function htmlComplements(prefixe, type, valeurs, clientId) {
        const t = Donnees.typeVisite(type);
        const v = valeurs || { references: {}, details: {} };
        let html = "";
        if (t.champs.length) {
            html += '<div class="bloc-formulaire"><div class="bloc-formulaire-titre">📝 ' + esc(t.libelle) + '</div>' +
                t.champs.map(c => {
                    const id = prefixe + "-d-" + c.cle;
                    const val = (v.details || {})[c.cle] || "";
                    const attr = ' data-detail="' + prefixe + '" data-cle="' + c.cle + '"';
                    if (c.type === "textarea") {
                        return '<label for="' + id + '">' + esc(c.libelle) + '</label><textarea id="' + id + '" rows="2"' + attr + '>' + esc(val) + '</textarea>';
                    }
                    if (c.type === "choix") {
                        let options = (c.options || []).slice();
                        if (c.source === "contacts") options = clientId ? Donnees.contactsPourChoix(clientId) : [];
                        else if (c.source === "machines") options = clientId ? Donnees.machinesDuClient(clientId) : [];
                        else options = options.concat(Donnees.valeursConnues("detail:" + c.cle, { avecFixes: false }));   // + valeurs tapées via « Autre… »
                        return choixLibre(id, esc(c.libelle), options, val, { attrs: attr, suggestions: "detail:" + c.cle });
                    }
                    return champTexteSuggere(id, esc(c.libelle), val, "detail:" + c.cle, attr);
                }).join("") + '</div>';
        }
        if (t.references) html += htmlReferences(prefixe, v.references, false);
        return html;
    }

    /* Bloc « Références » (étiquette, boîte, fond, molettes, mandrin…) : un
       champ libre par référence, avec en suggestion celles déjà utilisées.
       ouvert : déplié d'office (rendez-vous d'homologation ou d'essai). */
    function htmlReferences(prefixe, references, ouvert) {
        const refs = references || {};
        return '<details class="bloc-formulaire bloc-references"' + (ouvert || Object.keys(refs).some(k => refs[k]) ? " open" : "") + '>' +
            '<summary class="bloc-formulaire-titre">🏷️ Références' + (ouvert ? "" : ' <span class="serti-court">(facultatif)</span>') + '</summary>' +
            '<div class="grille-2-colonnes">' + Donnees.REFERENCES.map(r =>
                '<div>' + champTexteSuggere(prefixe + "-r-" + r.cle, esc(r.libelle), refs[r.cle] || "", "ref:" + r.cle,
                    ' data-ref="' + prefixe + '" data-cle="' + r.cle + '"') + '</div>').join("") + '</div></details>';
    }

    /* Références d'outillage tirées de la ligne (fournisseur + référence). */
    function referencesDeLaLigne(ligneId) {
        const l = ligneId ? Donnees.getLigne(ligneId) : null;
        if (!l) return {};
        const joindre = (o) => [l[o + "Fournisseur"], l[o + "Ref"]].filter(Boolean).join(" ");
        return { refMolette1: joindre("molette1"), refMolette2: joindre("molette2"), refMandrin: joindre("mandrin") };
    }

    /* Statut d'une visite de l'historique : « ✅ Effectuée », « 🔁 Reportée »… */
    function pastilleStatut(v) {
        const i = Donnees.infoStatut(Donnees.statutVisite(v));
        return '<span class="pastille-statut pastille-couleur" style="' + Donnees.styleCouleur(i.couleur) + '">' + i.icone + ' ' + esc(i.libelle) + '</span>';
    }

    function pastilleType(type) {
        const t = Donnees.typeVisite(type);
        return '<span class="pastille-statut pastille-couleur" style="' + Donnees.styleCouleur(t.couleur) + '">' + esc(t.libelle) + '</span>';
    }

    /* Texte lisible des compléments d'une visite (historique, planning, exports). */
    function texteComplements(v) {
        const t = Donnees.typeVisite(v.type);
        const morceaux = [];
        t.champs.forEach(c => { const x = (v.details || {})[c.cle]; if (x) morceaux.push(c.libelle + " : " + x); });
        Donnees.REFERENCES.forEach(r => { const x = (v.references || {})[r.cle]; if (x) morceaux.push(r.libelle + " : " + x); });
        return morceaux;
    }

    /* ---------- Rendez-vous (visite planifiée) ----------
       options : { clientId, ligneId, rdv } — rdv pour modifier. */

    function rdv(options) {
        const opts = options || {};
        const existant = opts.rdv || null;
        const clients = Donnees.listerClients().filter(c => c.actif !== false || (existant && c.id === existant.clientId));
        if (clients.length === 0) {
            AppLayout.fermerFeuille();
            AppLayout.toast("Ajoute d'abord un client");
            return;
        }
        const clientInit = existant ? existant.clientId
            : opts.ligneId ? (Donnees.getLigne(opts.ligneId) || {}).clientId : (opts.clientId || clients[0].id);
        const aujourdhui = Donnees.aujourdhuiIso();
        const demain = Donnees.ajouterJours(aujourdhui, 1);
        /* opts.date : date à préremplir (clic sur le Planning). Une date passée est ignorée. */
        const dateInit = /^\d{4}-\d{2}-\d{2}$/.test(opts.date || "") && opts.date >= aujourdhui ? opts.date : demain;

        const corps =
            '<form id="form-rdv" novalidate>' +
            liste("fr-client", "Client *", clients.map(c => ({ valeur: c.id, texte: c.nom })), clientInit) +
            deuxColonnes(champ("fr-date", "Date *", "date", existant ? existant.date : dateInit),
                champ("fr-heure", "Heure", "time", existant ? existant.heure : "")) +
            liste("fr-type", "Type *", OPTIONS_TYPES, existant ? existant.type : (opts.type || "campagne")) +
            '<label>Lignes à voir</label><div id="fr-lignes" class="liste-cases"></div>' +
            '<div id="fr-references"></div>' +
            zoneTexte("fr-notes", "Notes", existant ? existant.notes : (opts.notes || ""), "Contact prévenu, points à contrôler…") +
            piedFormulaire(existant ? "Enregistrer" : "Planifier la visite") +
            '</form>';

        AppLayout.ouvrirFeuille("bas", existant ? "Modifier le rendez-vous" : "Planifier une visite", corps);
        const selClient = document.getElementById("fr-client");
        const champDate = document.getElementById("fr-date");
        champDate.min = Donnees.aujourdhuiIso();

        function remplirLignes() {
            const lignes = Donnees.lignesActivesDuClient(selClient.value);
            const cochees = existant && existant.clientId === selClient.value ? existant.ligneIds
                : opts.ligneId ? [opts.ligneId] : lignes.map(l => l.id);
            document.getElementById("fr-lignes").innerHTML = lignes.length === 0
                ? '<p class="aide-champ" style="margin-top:0;">Aucune ligne pour ce client : le rendez-vous portera sur le client.</p>'
                : lignes.map(l => caseACocher("fr-l-" + l.id, esc(l.nom) +
                    (l.formatHabituel ? ' <span class="texte-attenue">— ' + esc(l.formatHabituel) + '</span>' : ""),
                    cochees.indexOf(l.id) !== -1).replace('<input ', '<input data-ligne="' + esc(l.id) + '" ')).join("");
        }
        function proposerType() {
            const c = Donnees.getClient(selClient.value);
            const selT = document.getElementById("fr-type");
            /* Ne propose que entre campagne et maintenance : un type choisi à
               la main (réunion, essai…) n'est jamais écrasé. */
            if (c && champDate.value && !existant && !opts.type && (selT.value === "campagne" || selT.value === "maintenance")) {
                selT.value = Donnees.estEnCampagne(c, champDate.value) ? "campagne" : "maintenance";
            }
        }
        /* Homologation, essai interne : bloc « Références » déplié, gardé
           d'un changement de type à l'autre ; molettes et mandrin
           pré-remplis depuis la première ligne cochée s'ils sont vides. */
        let referencesSaisies = Object.assign({}, (existant && existant.references) || opts.references || {});
        function redessinerReferences() {
            const zone = document.getElementById("fr-references");
            /* Mémorisées hors du bloc : passer par un type sans références
               (validation…) puis revenir ne perd pas la saisie. */
            if (zone.querySelector("[data-ref]")) referencesSaisies = lireComplements("fr").references;
            const avant = Object.assign({}, referencesSaisies);
            if (!Donnees.typeVisite(document.getElementById("fr-type").value).referencesRdv) { zone.innerHTML = ""; return; }
            const coche = document.querySelector("#fr-lignes [data-ligne]:checked");
            const deLaLigne = coche ? referencesDeLaLigne(coche.getAttribute("data-ligne")) : {};
            Object.keys(deLaLigne).forEach(k => { if (!avant[k]) avant[k] = deLaLigne[k]; });
            zone.innerHTML = htmlReferences("fr", avant, true);
        }

        selClient.addEventListener("change", () => { remplirLignes(); proposerType(); redessinerReferences(); });
        champDate.addEventListener("change", () => { proposerType(); redessinerReferences(); });
        document.getElementById("fr-type").addEventListener("change", redessinerReferences);
        remplirLignes();
        proposerType();
        redessinerReferences();

        const form = document.getElementById("form-rdv");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (envoiEnDouble(form)) return;
            const date = champDate.value;
            if (!date) return erreur(form, "La date est requise.");
            if (date < Donnees.aujourdhuiIso()) return erreur(form, "La date est passée : pour une visite déjà faite, utilise « Enregistrer une visite ».");
            const r = Donnees.enregistrerRdv({
                clientId: selClient.value, date, heure: val("fr-heure"), type: val("fr-type"), notes: val("fr-notes"),
                references: lireComplements("fr").references,
                ligneIds: Array.prototype.map.call(form.querySelectorAll("[data-ligne]:checked"), el => el.getAttribute("data-ligne"))
            }, existant && existant.id);
            if (!r) return erreur(form, "Rendez-vous non enregistré : vérifie le client et la date.");
            AppLayout.fermerFeuille();
            AppLayout.toastSucces("Visite planifiée le " + dateFr(r.date) + (r.heure ? " à " + r.heure : "") + " ✓");
        });
    }

    /* ---------- Issue d'un rendez-vous sans visite ----------
       « reporter » : nouvelle date (le rendez-vous est déplacé) ; « non-effectuee » : la visite n'a pas
       eu lieu ou a été annulée (le rendez-vous est retiré). Dans les deux cas, une ligne avec le
       motif est ajoutée à l'historique du client. */
    function issueRdv(rdvId, mode) {
        const r = Donnees.getRdv(rdvId);
        if (!r) return;
        const client = Donnees.getClient(r.clientId);
        const t = Donnees.typeVisite(r.type);
        const reporter = mode === "reporter";
        const aujourdhui = Donnees.aujourdhuiIso();
        const demain = Donnees.ajouterJours(aujourdhui, 1);
        const propose = Donnees.prochainJourTravaille(r.date >= demain ? Donnees.ajouterJours(r.date, 7) : Donnees.ajouterJours(aujourdhui, 7));
        const corps =
            '<form id="form-issue" novalidate>' +
            '<p class="texte-attenue" style="font-size:0.85rem;margin:0;">' + esc(client ? client.nom : "") + ' · ' + esc(t.libelle) +
            ' · prévue le ' + dateFr(r.date) + (r.heure ? " à " + esc(r.heure) : "") + '</p>' +
            (reporter
                ? champ("fi-date", "Reportée au *", "date", propose)
                : '<label>Que s\'est-il passé ? *</label><div class="choix-statut choix-statut--2" role="radiogroup" aria-label="Statut">' +
                [["non-effectuee", "Non effectuée"], ["annulee", "Annulée"]].map(o =>
                    '<label class="choix-statut-option"><input type="radio" name="fi-statut" value="' + o[0] + '"' + (o[0] === "non-effectuee" ? " checked" : "") + '><span>' + o[1] + '</span></label>').join("") + '</div>' +
                '<p class="aide-champ">Non effectuée : la visite n\'a pas pu avoir lieu. Annulée : le client ou toi l\'avez annulée.</p>') +
            choixLibre("fi-motif", "Motif", Donnees.valeursConnues("motif"), "", { placeholder: "Préciser le motif" }) +
            zoneTexte("fi-remarques", "Remarques", "", "Facultatif") +
            piedFormulaire(reporter ? "🔁 Reporter la visite" : "Enregistrer dans l'historique") +
            '</form>';
        AppLayout.ouvrirFeuille("bas", reporter ? "Reporter la visite" : "Visite non effectuée ou annulée", corps);
        const form = document.getElementById("form-issue");
        if (reporter) form.querySelector("#fi-date").min = aujourdhui;
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (envoiEnDouble(form)) return;
            const date = reporter ? val("fi-date") : "";
            if (reporter) {
                if (!date) return erreur(form, "Indique la nouvelle date.");
                if (date < aujourdhui) return erreur(form, "La nouvelle date doit être aujourd'hui ou plus tard.");
            }
            const statut = reporter ? "reportee" : (form.querySelector('input[name="fi-statut"]:checked') || {}).value;
            const cree = Donnees.cloturerSansVisite(rdvId, { statut, motif: val("fi-motif"), remarques: val("fi-remarques"), reporteLe: date });
            if (!cree) return erreur(form, "Enregistrement impossible : vérifie les informations.");
            AppLayout.fermerFeuille();
            AppLayout.toastSucces(reporter ? "Visite reportée au " + dateFr(date) + " — notée dans l'historique ✓"
                : (statut === "annulee" ? "Visite annulée" : "Visite non effectuée") + " — notée dans l'historique ✓");
        });
    }

    /* Rendez-vous effectué : une fiche par ligne (format, produit, remarques),
       décochable si une ligne n'a finalement pas été vue. Pour une réunion,
       une formation ou un audit, un compte rendu général suffit (visite
       enregistrée sans ligne). */
    function realiserRdv(rdvId) {
        const r = Donnees.getRdv(rdvId);
        if (!r) return;
        const client = Donnees.getClient(r.clientId);
        const toutes = Donnees.lignesActivesDuClient(r.clientId);
        const aujourdhui = Donnees.aujourdhuiIso();
        const prevues = r.ligneIds && r.ligneIds.length ? r.ligneIds
            : Donnees.typeVisite(r.type).ligneFacultative ? [] : toutes.map(l => l.id);
        if (toutes.length === 0 && !Donnees.typeVisite(r.type).ligneFacultative) {
            AppLayout.toast("Ajoute d'abord une ligne à ce client, ou choisis un type sans ligne (réunion…)");
        }

        const corps =
            '<form id="form-realiser" novalidate>' +
            '<p class="texte-attenue" style="font-size:0.85rem;margin:0;">' + esc(client ? client.nom : "") +
            ' · prévu le ' + dateFr(r.date) + (r.heure ? " à " + esc(r.heure) : "") + '</p>' +
            (r.notes ? '<div class="carte-ligne-notes">' + esc(r.notes) + '</div>' : "") +
            deuxColonnes(champ("fx-date", "Date de la visite *", "date", r.date <= aujourdhui ? r.date : aujourdhui),
                liste("fx-type", "Type *", OPTIONS_TYPES, r.type)) +
            '<div id="fx-complements"></div>' +
            '<div id="fx-general"></div>' +
            toutes.map(l =>
                '<div class="bloc-formulaire" data-bloc-ligne="' + esc(l.id) + '">' +
                caseACocher("fx-l-" + l.id, '<strong>' + esc(l.nom) + '</strong>', prevues.indexOf(l.id) !== -1)
                    .replace('<input ', '<input data-ligne-vue="' + esc(l.id) + '" ') +
                deuxColonnes(choixLibre("fx-f-" + l.id, "Format", Donnees.valeursConnues("format"), l.formatHabituel),
                    choixLibre("fx-p-" + l.id, "Produit", Donnees.choixPour("produit"), l.produitHabituel)) +
                zoneTexte("fx-r-" + l.id, "Remarques", "", "Réglages, contrôles, points à revoir…") +
                '<button type="button" class="bouton bouton--petit bouton--contour" data-serti-ouvrir="' + esc(l.id) + '">🔬 Contrôle de serti</button>' +
                '<div id="fxs-' + esc(l.id) + '"></div>' +
                '</div>').join("") +
            piedFormulaire("Enregistrer la visite") +
            '</form>';

        AppLayout.ouvrirFeuille("bas", "Visite effectuée", corps);
        const form = document.getElementById("form-realiser");
        form.querySelector("#fx-date").max = aujourdhui;
        const selType = document.getElementById("fx-type");
        let generalSaisi = "";

        function redessiner() {
            const valeurs = document.querySelector("#fx-complements [data-cle]") ? lireComplements("fx")
                : { references: Object.assign({}, r.references || {}), details: {} };
            const g = document.getElementById("fx-g");
            if (g) generalSaisi = g.value;
            document.getElementById("fx-complements").innerHTML = htmlComplements("fx", selType.value, valeurs, r.clientId);
            document.getElementById("fx-general").innerHTML = Donnees.typeVisite(selType.value).ligneFacultative
                ? zoneTexte("fx-g", "Compte rendu général (visite sans ligne)", generalSaisi, "Points abordés, décisions…") : "";
        }
        selType.addEventListener("change", redessiner);
        redessiner();
        /* Contrôle de serti : monté seulement quand on le demande (une ligne à la fois, pas tous d'un coup). */
        form.querySelectorAll("[data-serti-ouvrir]").forEach(b => b.addEventListener("click", () => {
            const id = b.getAttribute("data-serti-ouvrir");
            FicheSerti.monter("fxs-" + id, document.getElementById("fxs-" + id), { ligne: Donnees.getLigne(id), formatCourant: () => val("fx-f-" + id) });
            b.hidden = true;
            const d = document.querySelector("#fxs-" + id + " details"); if (d) d.open = true;
        }));
        form.addEventListener("change", (e) => { const m = /^fx-f-(.+?)(-libre)?$/.exec(e.target.id || ""); if (m && FicheSerti.estMonte("fxs-" + m[1])) FicheSerti.majFormat("fxs-" + m[1]); });

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (envoiEnDouble(form)) return;
            const date = val("fx-date");
            if (!date) return erreur(form, "La date est requise.");
            if (date > aujourdhui) return erreur(form, "Une visite enregistrée ne peut pas être dans le futur.");
            const type = selType.value;
            const complements = lireComplements("fx");
            const visites = Array.prototype.filter.call(form.querySelectorAll("[data-ligne-vue]"), el => el.checked).map(el => {
                const id = el.getAttribute("data-ligne-vue");
                const visiteLigne = Object.assign({ ligneId: id, date, type, format: val("fx-f-" + id), produit: val("fx-p-" + id), remarques: val("fx-r-" + id) }, complements);
                const mes = FicheSerti.lire("fxs-" + id);
                if (mes) visiteLigne.mesures = mes;
                return visiteLigne;
            });
            const reglages = toutes.map(l => FicheSerti.reglagesLigne("fxs-" + l.id)).filter(Boolean);
            const general = val("fx-g");
            if (Donnees.typeVisite(type).ligneFacultative && (general || visites.length === 0)) {
                visites.push(Object.assign({ ligneId: null, date, type, remarques: general }, complements));
            }
            if (visites.length === 0) return erreur(form, "Coche au moins une ligne visitée.");
            const creees = Donnees.realiserRdv(rdvId, visites);
            if (!creees) return erreur(form, "Visite non enregistrée.");
            reglages.forEach(r => Donnees.enregistrerLigne(r.clientId || (Donnees.getLigne(r.ligneId) || {}).clientId, { nbTetes: r.nbTetes, colonneSerti: r.colonneSerti }, r.ligneId));
            toutes.forEach(l => FicheSerti.demonter("fxs-" + l.id));
            AppLayout.fermerFeuille();
            AppLayout.toastSucces(creees.length + " visite" + (creees.length > 1 ? "s enregistrées" : " enregistrée") + " ✓ — rendez-vous clôturé");
        });
    }

    /* ---------- Visite ----------
       options : { clientId, ligneId } — tous deux facultatifs. */

    /* Contrôle de la saisie d'une visite (aucun accès à la page).
       saisie : { existante, date, statut, ligneId, typeId, clientId }.
       Renvoie { message } si elle est invalide, { planifier: true } si la date est à venir (une visite EFFECTUÉE ne
       peut pas l'être : on propose de la planifier), sinon null. */
    function verifierSaisieVisite(saisie) {
        if (!saisie.date) return { message: "La date est requise." };
        const aujourdhui = Donnees.aujourdhuiIso();
        if (!saisie.existante && saisie.statut === "effectuee" && saisie.date > aujourdhui) return { planifier: true };
        if (saisie.date > aujourdhui) return { message: "Une visite enregistrée ne peut pas être dans le futur." };
        if (!saisie.ligneId && !Donnees.typeVisite(saisie.typeId).ligneFacultative && saisie.statut === "effectuee") {
            return { message: Donnees.lignesActivesDuClient(saisie.clientId).length
                ? "Choisis la ligne visitée."
                : "Ce client n'a pas de ligne active : ajoute ou réactive une ligne, ou choisis un type sans ligne (réunion, formation, audit)." };
        }
        return null;
    }

    /* Formulaire « visite » : uniquement du HTML, aucun accès à la page (testable seul). */
    function htmlFormulaireVisite(existante, clients, clientInitId) {
        return '<form id="form-visite" novalidate>' +
            liste("fv-client", "Client *", clients.map(c => ({ valeur: c.id, texte: c.nom })), clientInitId) +
            deuxColonnes(champ("fv-date", "Date *", "date", existante ? existante.date : Donnees.aujourdhuiIso()),
                liste("fv-type", "Type *", OPTIONS_TYPES, existante ? existante.type : "campagne")) +
            '<div id="fv-futur" class="bandeau-info" role="status" hidden>📅 Cette date est <strong>à venir</strong> : une visite ne s\'enregistre qu\'une fois faite. ' +
            'Le bouton ci-dessous la <strong>planifie</strong> à la place (client, ligne, type et remarques sont repris).</div>' +
            liste("fv-statut", "Statut", Donnees.STATUTS_VISITE.map(st => ({ valeur: st.cle, texte: st.icone + " " + st.libelle })), existante ? Donnees.statutVisite(existante) : "effectuee") +
            '<label for="fv-ligne">Ligne</label><select id="fv-ligne"></select>' +
            '<div id="fv-contenu">' +
            deuxColonnes(choixLibre("fv-format", "Format", Donnees.valeursConnues("format"), ""), choixLibre("fv-produit", "Produit", Donnees.choixPour("produit"), "")) +
            '<div id="fv-complements"></div><div id="fv-serti"></div></div>' +
            '<div id="fv-suite" hidden>' +
            choixLibre("fv-motif", "Motif", Donnees.valeursConnues("motif"), existante ? existante.motif : "", { placeholder: "Préciser le motif" }) +
            '<div id="fv-reporte-bloc" hidden>' + champ("fv-reporte", "Reportée au", "date", existante ? existante.reporteLe || "" : "") + '</div></div>' +
            zoneTexte("fv-remarques", "Remarques / compte rendu", existante ? existante.remarques : "", "Réglages effectués, contrôles, points à revoir…") +
            piedFormulaire(existante ? "Enregistrer les modifications" : "Enregistrer la visite") +
            '</form>';
    }

    function visite(options) {
        const opts = options || {};
        /* opts.visite : visite déjà enregistrée à modifier. */
        const existante = opts.visite || null;
        if (existante) opts.clientId = existante.clientId;
        const clients = Donnees.listerClients().filter(c => c.actif !== false || c.id === opts.clientId);
        if (clients.length === 0) {
            AppLayout.fermerFeuille();
            AppLayout.toast("Ajoute d'abord un client");
            return;
        }

        const ligneInit = existante ? (existante.ligneId ? Donnees.getLigne(existante.ligneId) : null)
            : (opts.ligneId ? Donnees.getLigne(opts.ligneId) : null);
        const clientInitId = existante ? existante.clientId : ligneInit ? ligneInit.clientId
            : (opts.clientId || (clients.find(c => Donnees.lignesActivesDuClient(c.id).length > 0) || clients[0]).id);

        const corps = htmlFormulaireVisite(existante, clients, clientInitId);

        AppLayout.ouvrirFeuille("bas", existante ? "Modifier la visite" : "Enregistrer une visite", corps);

        const selClient = document.getElementById("fv-client");
        const selLigne = document.getElementById("fv-ligne");
        const champDate = document.getElementById("fv-date");
        const selType = document.getElementById("fv-type");
        const bouton = document.querySelector("#form-visite button[type=submit]");
        const banniere = document.getElementById("fv-futur");
        const selStatut = document.getElementById("fv-statut");
        const libelleBouton = existante ? "Enregistrer les modifications" : "Enregistrer la visite";
        /* Date à venir (nouvelle visite EFFECTUÉE seulement) : on l'annonce et le bouton planifie. */
        function majFutur() {
            const futur = !existante && selStatut.value === "effectuee" && !!champDate.value && champDate.value > Donnees.aujourdhuiIso();
            banniere.hidden = !futur;
            bouton.textContent = futur ? "📅 Planifier cette visite" : libelleBouton;
        }
        /* Statut : une visite effectuée a son contenu (format, produit, détails) ; une visite reportée,
           non effectuée ou annulée a un motif (et la nouvelle date si reportée), et peut se passer de ligne. */
        function majStatut() {
            const st = selStatut.value;
            document.getElementById("fv-contenu").hidden = st !== "effectuee";
            document.getElementById("fv-suite").hidden = st === "effectuee";
            document.getElementById("fv-reporte-bloc").hidden = st !== "reportee";
            remplirLignes();
            majFutur();
            majSerti();
        }
        let typeChoisiALaMain = !!existante;

        /* Type proposé selon la date (campagne ou maintenance) tant que
           l'utilisateur n'a pas choisi lui-même un type. */
        function proposerType() {
            const c = Donnees.getClient(selClient.value);
            if (!typeChoisiALaMain && c && champDate.value) {
                selType.value = Donnees.estEnCampagne(c, champDate.value) ? "campagne" : "maintenance";
            }
        }

        function redessinerComplements(forcerRefsLigne) {
            const valeurs = document.querySelector("#fv-complements [data-cle]") ? lireComplements("fv") : { references: {}, details: {} };
            if (forcerRefsLigne) Object.assign(valeurs.references, referencesDeLaLigne(selLigne.value));
            document.getElementById("fv-complements").innerHTML = htmlComplements("fv", selType.value, valeurs, selClient.value);
        }

        function remplirLignes(ligneChoisie) {
            const lignes = Donnees.lignesActivesDuClient(selClient.value);
            /* En modification, la ligne de la visite reste proposée même si
               elle est devenue inactive depuis. */
            if (existante && existante.ligneId && existante.clientId === selClient.value && !lignes.some(l => l.id === existante.ligneId)) {
                const l = Donnees.getLigne(existante.ligneId);
                if (l) lignes.push(l);
            }
            const facultative = Donnees.typeVisite(selType.value).ligneFacultative || selStatut.value !== "effectuee";
            const avant = ligneChoisie !== undefined ? ligneChoisie : selLigne.value;
            selLigne.innerHTML = (facultative || lignes.length === 0 ? '<option value="">— Aucune ligne (visite générale)</option>' : "") +
                lignes.map(l => '<option value="' + esc(l.id) + '"' + (l.id === avant ? " selected" : "") + '>' + esc(l.nom) + '</option>').join("");
        }

        /* Contrôle de serti : bloc repliable, proposé dès qu'une ligne est choisie sur une visite effectuée. */
        function majSerti() {
            const zone = document.getElementById("fv-serti");
            const l = selLigne.value ? Donnees.getLigne(selLigne.value) : null;
            if (!l) { FicheSerti.demonter("fv"); zone.innerHTML = ""; return; }
            if (selStatut.value !== "effectuee") return;     /* le bloc est caché avec #fv-contenu : on garde la saisie */
            if (FicheSerti.ligneMontee("fv") === l.id) { FicheSerti.majFormat("fv"); return; }
            FicheSerti.monter("fv", zone, { ligne: l, formatCourant: () => val("fv-format"), mesures: existante && existante.ligneId === l.id ? existante.mesures : null });
        }

        function preremplir() {
            const l = Donnees.getLigne(selLigne.value);
            definirChoix("fv-format", (l && l.formatHabituel) || "");
            definirChoix("fv-produit", (l && l.produitHabituel) || "");
            redessinerComplements(true);
            majSerti();
        }

        selClient.addEventListener("change", () => { remplirLignes(null); preremplir(); proposerType(); });
        selLigne.addEventListener("change", preremplir);
        champDate.addEventListener("change", () => { proposerType(); majFutur(); });
        champDate.addEventListener("input", majFutur);
        selStatut.addEventListener("change", majStatut);
        selType.addEventListener("change", () => { typeChoisiALaMain = true; remplirLignes(); redessinerComplements(false); majSerti(); });
        /* Le format de la visite change : le verdict est recalculé avec le nouveau format. */
        document.getElementById("fv-contenu").addEventListener("change", (e) => { if (e.target.id === "fv-format" || e.target.id === "fv-format-libre") FicheSerti.majFormat("fv"); });
        document.getElementById("fv-contenu").addEventListener("input", (e) => { if (e.target.id === "fv-format-libre") FicheSerti.majFormat("fv"); });
        if (existante) {
            remplirLignes(existante.ligneId || "");
            definirChoix("fv-format", existante.format || "");
            definirChoix("fv-produit", existante.produit || "");
            document.getElementById("fv-complements").innerHTML = htmlComplements("fv", existante.type,
                { references: existante.references || {}, details: existante.details || {} }, existante.clientId);
        } else {
            proposerType();
            remplirLignes(ligneInit ? ligneInit.id : null);
            preremplir();
        }

        majStatut();
        const form = document.getElementById("form-visite");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (envoiEnDouble(form)) return;
            const controle = verifierSaisieVisite({ existante, date: champDate.value, statut: selStatut.value, ligneId: selLigne.value, typeId: selType.value, clientId: selClient.value });
            if (controle && controle.message) return erreur(form, controle.message);
            if (controle && controle.planifier) {
                /* Date à venir : on ouvre la planification avec tout ce qui est déjà saisi. */
                rdv({ clientId: selClient.value, ligneId: selLigne.value || undefined, date: champDate.value, type: selType.value,
                    notes: val("fv-remarques"), references: lireComplements("fv").references });
                return;
            }
            const t = Donnees.typeVisite(selType.value);
            const source = Object.assign({
                clientId: selClient.value, ligneId: selLigne.value || null, date: champDate.value, type: selType.value,
                format: val("fv-format"), produit: val("fv-produit"), remarques: val("fv-remarques"),
                statut: selStatut.value, motif: val("fv-motif"), reporteLe: val("fv-reporte")
            }, lireComplements("fv"));
            if (selStatut.value === "effectuee" && selLigne.value) { const mes = FicheSerti.lire("fv"); if (mes) source.mesures = mes; }
            const reglages = selStatut.value === "effectuee" ? FicheSerti.reglagesLigne("fv") : null;
            const v = existante ? Donnees.modifierVisite(existante.id, source) : Donnees.enregistrerVisite(source);
            if (!v) return erreur(form, "Visite non enregistrée : vérifie la date et la ligne.");
            if (reglages) Donnees.enregistrerLigne(v.clientId, { nbTetes: reglages.nbTetes, colonneSerti: reglages.colonneSerti }, reglages.ligneId);
            FicheSerti.demonter("fv");
            AppLayout.fermerFeuille();
            if (existante) { AppLayout.toastSucces("Visite modifiée ✓"); return; }
            if (!Donnees.estEffectuee(v)) { AppLayout.toastSucces(Donnees.infoStatut(Donnees.statutVisite(v)).libelle + " — notée dans l'historique ✓"); return; }
            const c = Donnees.getClient(v.clientId);
            AppLayout.toastSucces(v.type === "campagne" && c
                ? "Visite enregistrée ✓ — prochaine vers le " + dateFr(Donnees.ajouterJours(v.date, c.cadenceJours))
                : t.libelle + " enregistrée ✓");
        });
    }

    /* ---------- Affichage d'un rendez-vous (tableau, fiche client) ---------- */

    function libelleJour(iso) {
        const ecart = Donnees.ecartJours(Donnees.aujourdhuiIso(), iso);
        if (ecart === 0) return "Aujourd'hui";
        if (ecart === 1) return "Demain";
        const [y, m, d] = iso.split("-").map(Number);
        const texte = new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
        return texte.charAt(0).toUpperCase() + texte.slice(1);
    }

    function texteReferences(refs) {
        return Donnees.REFERENCES.filter(x => (refs || {})[x.cle]).map(x => x.libelle + " : " + refs[x.cle]);
    }

    /* Une ligne de rendez-vous : couleur de son type ; un clic n'importe où
       (hors boutons et liens) ouvre le détail avec les actions. */
    function carteRdv(r, avecClient) {
        const client = Donnees.getClient(r.clientId);
        const t = Donnees.typeVisite(r.type);
        const lignes = (r.ligneIds || []).map(id => Donnees.getLigne(id)).filter(Boolean).map(l => l.nom);
        const depasse = r.date < Donnees.aujourdhuiIso();
        const refs = texteReferences(r.references);
        const propose = Donnees.estPropose(r);
        return '<div class="ligne-rdv' + (depasse ? " ligne-rdv--depasse" : "") + (propose ? " ligne-rdv--propose" : "") + '" data-rdv-ouvrir="' + esc(r.id) + '" role="button" tabindex="0"' +
            ' aria-label="Rendez-vous ' + esc(t.libelle) + (client ? " chez " + esc(client.nom) : "") + ' — ouvrir">' +
            '<div class="ligne-rdv-date"' + (depasse ? "" : ' style="border-left-color:' + t.couleur + ';"') + '><strong>' + esc(libelleJour(r.date)) + '</strong>' +
            '<span>' + (r.heure ? esc(r.heure) : dateFr(r.date).slice(0, 5)) + '</span></div>' +
            '<div class="ligne-rdv-corps">' +
            (avecClient && client ? '<a href="Client.html?id=' + encodeURIComponent(client.id) + '" class="ligne-rdv-client">' + esc(client.nom) + '</a> ' : "") +
            pastilleType(r.type) +
            (propose ? ' <span class="pastille-statut pastille-propose">Proposé</span>' : "") +
            (lignes.length ? '<div class="texte-attenue">' + esc(lignes.join(", ")) + '</div>' : "") +
            (refs.length ? '<div class="texte-attenue ligne-rdv-notes">🏷️ ' + esc(refs.join(" · ")) + '</div>' : "") +
            (depasse ? '<div class="ligne-rdv-alerte">Date passée : visite faite ?</div>' : "") +
            (r.notes ? '<div class="texte-attenue ligne-rdv-notes">' + esc(r.notes) + '</div>' : "") +
            '</div>' +
            '<div class="ligne-rdv-actions">' +
            (propose
                ? '<button type="button" class="bouton bouton--petit" data-rdv-confirmer="' + esc(r.id) + '">✓ Confirmer</button>' +
                '<button type="button" class="bouton bouton--petit bouton--contour" data-rdv-modifier="' + esc(r.id) + '" aria-label="Déplacer">✏️</button>' +
                '<button type="button" class="bouton bouton--petit bouton--fantome" data-rdv-supprimer="' + esc(r.id) + '" aria-label="Refuser">✕</button>'
                : (r.date <= Donnees.aujourdhuiIso() ? '<button type="button" class="bouton bouton--petit" data-rdv-faite="' + esc(r.id) + '">✅ Faite</button>' : "") +
                '<button type="button" class="bouton bouton--petit bouton--contour" data-rdv-modifier="' + esc(r.id) + '" aria-label="Modifier">✏️</button>' +
                '<button type="button" class="bouton bouton--petit bouton--fantome" data-rdv-supprimer="' + esc(r.id) + '" aria-label="Supprimer">🗑</button>') +
            '</div></div>';
    }

    /* Détail d'un rendez-vous : tout ce qu'il faut sur place (contact à
       appeler, lignes, références, notes) et les actions. */
    function detailRdv(id) {
        const r = Donnees.getRdv(id);
        if (!r) return;
        const client = Donnees.getClient(r.clientId);
        const lignes = (r.ligneIds || []).map(x => Donnees.getLigne(x)).filter(Boolean);
        const contacts = client ? Donnees.contactsDuClient(client.id) : [];
        const k = contacts.find(c => c.principal) || contacts[0];
        const tel = k && (k.mobile || k.telephoneFixe);
        const refs = texteReferences(r.references);
        const ligneInfo = (libelle, valeur) => '<div class="ligne-info"><span class="texte-attenue">' + libelle + '</span><span>' + valeur + '</span></div>';
        AppLayout.ouvrirFeuille("droite", client ? client.nom : "Rendez-vous",
            '<div style="margin-bottom:10px;">' + pastilleType(r.type) + '</div>' +
            ligneInfo("Date", esc(libelleJour(r.date)) + " · " + dateFr(r.date) + (r.heure ? " à " + esc(r.heure) : "")) +
            ligneInfo("Lignes", lignes.length ? esc(lignes.map(l => l.nom + (l.formatHabituel ? " (" + l.formatHabituel + ")" : "")).join(", ")) : "—") +
            (k ? ligneInfo("Contact", esc([k.prenom, k.nom].filter(Boolean).join(" ")) +
                (tel ? ' · <a href="tel:' + esc(tel.replace(/\s/g, "")) + '" class="texte-lien">📞 ' + esc(tel) + '</a>' : "")) : "") +
            (refs.length ? '<div class="bloc-formulaire"><div class="bloc-formulaire-titre">🏷️ Références</div>' +
                refs.map(x => '<div class="texte-attenue" style="font-size:0.82rem;">' + esc(x) + '</div>').join("") + '</div>' : "") +
            (r.notes ? '<div class="carte-ligne-notes">' + esc(r.notes) + '</div>' : "") +
            '<div class="carte-ligne-actions" style="margin-top:16px;">' +
            (Donnees.estPropose(r) ? '<button type="button" class="bouton bouton--petit" data-rdv-confirmer="' + esc(r.id) + '">✓ Confirmer</button>' : "") +
            (!Donnees.estPropose(r) && r.date <= Donnees.aujourdhuiIso() ? '<button type="button" class="bouton bouton--petit" data-rdv-faite="' + esc(r.id) + '">✅ Visite faite</button>' : "") +
            '<button type="button" class="bouton bouton--petit bouton--contour" data-rdv-agenda="' + esc(r.id) + '">📅 Ajouter à mon agenda</button>' +
            '<button type="button" class="bouton bouton--petit bouton--contour" data-rdv-modifier="' + esc(r.id) + '">✏️ Modifier</button>' +
            (!Donnees.estPropose(r) ? '<button type="button" class="bouton bouton--petit bouton--contour" data-rdv-reporter="' + esc(r.id) + '">🔁 Reporter</button>' +
                '<button type="button" class="bouton bouton--petit bouton--contour" data-rdv-non-effectuee="' + esc(r.id) + '">⛔ Non effectuée / annulée</button>' : "") +
            '<button type="button" class="bouton bouton--petit bouton--fantome" data-rdv-supprimer="' + esc(r.id) + '" title="Retire le rendez-vous sans garder de trace dans l\'historique">🗑 Supprimer sans trace</button>' +
            '</div>' +
            (client ? '<a href="Client.html?id=' + encodeURIComponent(client.id) + '" class="bouton bouton--contour bouton--large">Ouvrir la fiche client</a>' : ""));
        brancherRdv(document.querySelector(".feuille"));
    }

    /* ---------- Fiche rapide d'un client (fenêtre) ----------
       Ouverte d'un clic sur une carte du tableau « À visiter » : contact,
       rendez-vous prévus, lignes actives avec leur échéance et leurs
       actions, dernières visites, et accès à la fiche complète. */

    const ETATS_ECHEANCE = {
        retard: { libelle: "En retard", couleur: "#dc2626" },
        jamais: { libelle: "Pas encore vue", couleur: "#f97316" },
        bientot: { libelle: "À prévoir", couleur: "#d4a017" },
        ok: { libelle: "À jour", couleur: "#16a34a" }
    };

    function texteEcheanceCourt(e) {
        if (!e) return "Hors campagne";
        if (e.statut === "jamais") return "Pas encore visitée cette campagne";
        if (e.statut === "retard") return "En retard de " + (-e.joursRestants) + " j · dernière visite le " + dateFr(e.derniere.date);
        return "Prochaine visite vers le " + dateFr(e.echeance) + " · dernière le " + dateFr(e.derniere.date);
    }

    function apercuClient(clientId) {
        const client = Donnees.getClient(clientId);
        if (!client) return;
        const aujourdhui = Donnees.aujourdhuiIso();
        const echeances = Donnees.calculerEcheances(aujourdhui).lignes.filter(e => e.client.id === clientId);
        const contacts = Donnees.contactsDuClient(clientId);
        const k = contacts.find(c => c.principal) || contacts.find(c => c.role === "Responsable sertissage") || contacts[0];
        const tel = k && (k.mobile || k.telephoneFixe);
        /* Tous les rendez-vous du client, y compris une date passée non
           clôturée (à marquer « faite »), les 3 plus proches. */
        const rdvs = Donnees.rdvDuClient(clientId).slice(0, 3);
        const visites = Donnees.visitesDuClient(clientId).slice(0, 3);
        const lignes = Donnees.lignesActivesDuClient(clientId);
        const enCampagne = Donnees.estEnCampagne(client, aujourdhui);

        const corps =
            '<div class="apercu-entete">' +
            '<span class="texte-attenue">📍 ' + esc([client.codePostal, client.ville].filter(Boolean).join(" ") || "—") + '</span>' +
            (client.actif === false ? '<span class="badge-statut badge-statut--inactif">Inactif</span>'
                : enCampagne ? '<span class="badge-statut badge-statut--ok">En campagne</span>'
                    : '<span class="badge-statut badge-statut--campagne-off">Hors campagne</span>') +
            '</div>' +
            (k ? '<div class="apercu-contact">👤 <strong>' + esc([k.prenom, k.nom].filter(Boolean).join(" ")) + '</strong> <span class="texte-attenue">· ' + esc(k.role) + '</span>' +
                (tel ? '<a href="tel:' + esc(tel.replace(/\s/g, "")) + '" class="bouton bouton--petit bouton--contour">📞 ' + esc(tel) + '</a>' : "") + '</div>' : "") +

            (rdvs.length ? '<div class="apercu-section">📅 Rendez-vous</div><div class="carte" style="padding:0;">' + rdvs.map(r => carteRdv(r, false)).join("") + '</div>' : "") +

            '<div class="apercu-section">🏭 Lignes actives</div>' +
            (lignes.length === 0 ? '<p class="aide-champ">Aucune ligne active.</p>' :
                '<div class="carte" style="padding:0;">' + lignes.map(l => {
                    const e = echeances.find(x => x.ligne.id === l.id);
                    const etat = e ? ETATS_ECHEANCE[e.statut] : { libelle: "Hors campagne", couleur: "#0ea5e9" };
                    return '<div class="apercu-ligne">' +
                        '<div style="min-width:0;flex:1;"><strong>' + esc(l.nom) + '</strong>' +
                        (l.formatHabituel || l.produitHabituel ? ' <span class="texte-attenue">— ' + esc([l.formatHabituel, l.produitHabituel].filter(Boolean).join(" · ")) + '</span>' : "") +
                        '<div class="texte-attenue apercu-petit"><span class="pastille-statut pastille-couleur" style="' + Donnees.styleCouleur(etat.couleur) + '">' + etat.libelle + '</span> ' + esc(texteEcheanceCourt(e)) + '</div></div>' +
                        '<div class="apercu-actions">' +
                        '<button type="button" class="bouton bouton--petit bouton--contour" data-planifier="' + esc(l.id) + '">📅</button>' +
                        '<button type="button" class="bouton bouton--petit" data-apercu-visite="' + esc(l.id) + '">✅ Visite faite</button>' +
                        '</div></div>';
                }).join("") + '</div>') +

            '<div class="apercu-section">🕑 Dernières visites</div>' +
            (visites.length === 0 ? '<p class="aide-champ">Aucune visite enregistrée.</p>' :
                '<div class="carte" style="padding:0;">' + visites.map(v => {
                    const l = v.ligneId ? Donnees.getLigne(v.ligneId) : null;
                    return '<div class="apercu-ligne"><div style="min-width:0;flex:1;"><strong>' + dateFr(v.date) + '</strong> · ' + esc(l ? l.nom : "Visite générale") + ' ' + pastilleType(v.type) +
                        (v.remarques ? '<div class="texte-attenue apercu-petit">' + esc(v.remarques) + '</div>' : "") + '</div></div>';
                }).join("") + '</div>') +

            (client.notes ? '<div class="carte-ligne-notes">' + esc(client.notes) + '</div>' : "") +
            '<div class="carte-ligne-actions" style="margin-top:16px;">' +
            '<button type="button" class="bouton bouton--petit bouton--contour" data-apercu-planifier>📅 Planifier une visite</button>' +
            '</div>' +
            '<a href="Client.html?id=' + encodeURIComponent(client.id) + '" class="bouton bouton--large">Ouvrir la fiche complète</a>';

        AppLayout.ouvrirFeuille("bas", client.nom, corps);
        const feuille = document.querySelector(".feuille");
        brancherRdv(feuille);
        feuille.querySelectorAll("[data-apercu-visite]").forEach(b => b.addEventListener("click", () => visite({ ligneId: b.getAttribute("data-apercu-visite") })));
        const bp = feuille.querySelector("[data-apercu-planifier]");
        if (bp) bp.addEventListener("click", () => rdv({ clientId }));
    }

    /* ---------- Agenda (.ics) ----------
       Un fichier .ics s'ouvre dans Outlook, Google Agenda ou le calendrier
       du téléphone, qui gèrent eux-mêmes le rappel (la veille et 1 h avant).
       Heure « flottante » : interprétée à l'heure locale de l'appareil. */
    function echapperIcs(t) {
        return String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
    }

    function evenementIcs(r) {
        const c = Donnees.getClient(r.clientId);
        const t = Donnees.typeVisite(r.type);
        const lignes = (r.ligneIds || []).map(id => (Donnees.getLigne(id) || {}).nom).filter(Boolean);
        const jour = r.date.replace(/-/g, "");
        const debut = r.heure ? "DTSTART:" + jour + "T" + r.heure.replace(":", "") + "00" : "DTSTART;VALUE=DATE:" + jour;
        const fin = r.heure
            ? "DTEND:" + jour + "T" + ((h, m) => String(Math.min(23, h + 2)).padStart(2, "0") + String(m).padStart(2, "0"))(...r.heure.split(":").map(Number)) + "00"
            : "DTEND;VALUE=DATE:" + Donnees.ajouterJours(r.date, 1).replace(/-/g, "");
        const lieu = c ? [c.adresse, [c.codePostal, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
        const description = [t.libelle, lignes.length ? "Lignes : " + lignes.join(", ") : "", r.notes].filter(Boolean).join("\n");
        return ["BEGIN:VEVENT",
            "UID:" + r.id + "@ac-sat-campagne",
            "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""),
            debut, fin,
            "SUMMARY:" + echapperIcs(t.libelle + (c ? " — " + c.nom : "")),
            lieu ? "LOCATION:" + echapperIcs(lieu) : "",
            "DESCRIPTION:" + echapperIcs(description),
            "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + echapperIcs("Visite demain : " + (c ? c.nom : "")), "TRIGGER:-P1D", "END:VALARM",
            "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + echapperIcs("Visite dans 1 h : " + (c ? c.nom : "")), "TRIGGER:-PT1H", "END:VALARM",
            "END:VEVENT"].filter(Boolean).join("\r\n");
    }

    function fichierIcs(rdvs) {
        return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AC SAT//Campagne//FR", "CALSCALE:GREGORIAN",
            rdvs.map(evenementIcs).join("\r\n"), "END:VCALENDAR"].join("\r\n");
    }

    function telechargerIcs(rdvs, nom) {
        const blob = new Blob([fichierIcs(rdvs)], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nom;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /* ---------- Prévenir le client après confirmation ----------
       Rien n'est envoyé automatiquement : le SMS ou l'email s'ouvre
       pré-rédigé, le technicien vérifie et envoie lui-même. */
    function messageClient(r) {
        const c = Donnees.getClient(r.clientId);
        const nom = Donnees.getDonnees().profil.nom || "";
        const [y, m, d] = r.date.split("-").map(Number);
        const jour = new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        return "Bonjour, je passerai " + (c ? "chez " + c.nom + " " : "") + "le " + jour + (r.heure ? " vers " + r.heure.replace(":", "h") : "") +
            " pour la visite de suivi des sertisseuses. Merci de me prévenir si ce n'est pas possible. " + nom + " (AC SAT)";
    }

    function proposerMessages(rdvs) {
        const lignes = rdvs.map(r => {
            const c = Donnees.getClient(r.clientId);
            const contacts = c ? Donnees.contactsDuClient(c.id) : [];
            const k = contacts.find(x => x.principal) || contacts[0];
            const tel = k && k.mobile;
            const email = k && k.email;
            const texte = messageClient(r);
            return '<div class="apercu-ligne"><div style="min-width:0;flex:1;"><strong>' + esc(c ? c.nom : "") + '</strong> · ' + dateFr(r.date) + (r.heure ? " " + esc(r.heure) : "") +
                '<div class="texte-attenue apercu-petit">' + (k ? esc([k.prenom, k.nom].filter(Boolean).join(" ")) : "Aucun contact") + '</div></div>' +
                '<div class="apercu-actions">' +
                (tel ? '<a class="bouton bouton--petit bouton--contour" href="sms:' + esc(tel.replace(/[\s.]/g, "")) + '?body=' + encodeURIComponent(texte) + '">📱 SMS</a>' : "") +
                (email ? '<a class="bouton bouton--petit bouton--contour" href="mailto:' + encodeURIComponent(email).replace(/%40/g, "@") +
                    '?subject=' + encodeURIComponent("Visite AC SAT") + '&body=' + encodeURIComponent(texte) + '">✉️ Email</a>' : "") +
                (!tel && !email ? '<span class="texte-attenue apercu-petit">Pas de mobile ni d\'email</span>' : "") +
                '</div></div>';
        }).join("");
        AppLayout.ouvrirFeuille("bas", "Prévenir " + (rdvs.length > 1 ? "les clients" : "le client") + " ?",
            '<p class="aide-champ" style="margin-top:0;">Message pré-rédigé : il s\'ouvre dans ton téléphone ou ta messagerie, tu vérifies et tu envoies.</p>' +
            '<div class="carte" style="padding:0;">' + lignes + '</div>' +
            '<div class="carte-ligne-actions" style="margin-top:14px;">' +
            '<button type="button" class="bouton bouton--petit bouton--contour" data-agenda-lot>📅 Ajouter à mon agenda</button>' +
            '</div>' +
            '<button type="button" class="bouton bouton--contour bouton--large" data-fermer-messages>Plus tard</button>');
        const f = document.querySelector(".feuille");
        f.querySelector("[data-fermer-messages]").addEventListener("click", () => AppLayout.fermerFeuille());
        f.querySelector("[data-agenda-lot]").addEventListener("click", () => telechargerIcs(rdvs, "visites-confirmees.ics"));
    }

    /* Après confirmation : proposer de prévenir le(s) client(s) si le
       réglage est actif, sinon simple confirmation. */
    function apresConfirmation(rdvs) {
        if (!rdvs.length) return;
        if (Donnees.getTournee().messageClient) proposerMessages(rdvs);
        else { AppLayout.fermerFeuille(); AppLayout.toastSucces(rdvs.length + " rendez-vous confirmé" + (rdvs.length > 1 ? "s" : "") + " ✓"); }
    }

    /* Lance (ou relance) les propositions de tournée. auto = appel au
       chargement le jour choisi : silencieux s'il n'y a rien à proposer. */
    function proposerTournee(auto) {
        const r = Donnees.proposerTournee();
        if (auto && r.creees.length === 0) return r;
        AppLayout.toast(r.creees.length
            ? "🤖 " + r.creees.length + " visite" + (r.creees.length > 1 ? "s" : "") + " proposée" + (r.creees.length > 1 ? "s" : "") + " — à confirmer" +
            (r.nonPlaces.length ? " (" + r.nonPlaces.length + " non placée" + (r.nonPlaces.length > 1 ? "s" : "") + " : jours complets)" : "")
            : "Aucune visite à proposer sur la période" + (r.nonPlaces.length ? " (" + r.nonPlaces.length + " client(s) sans jour libre)" : ""));
        return r;
    }

    function brancherRdv(conteneur) {
        const sur = (sel, fn) => conteneur.querySelectorAll(sel).forEach(b => b.addEventListener("click", () => fn(b)));
        sur("[data-rdv-confirmer]", b => {
            const r = Donnees.confirmerRdv(b.getAttribute("data-rdv-confirmer"));
            if (r) apresConfirmation([r]);
        });
        sur("[data-rdv-agenda]", b => {
            const r = Donnees.getRdv(b.getAttribute("data-rdv-agenda"));
            if (r) telechargerIcs([r], "visite-" + r.date + ".ics");
        });
        sur("[data-rdv-faite]", b => realiserRdv(b.getAttribute("data-rdv-faite")));
        sur("[data-rdv-modifier]", b => rdv({ rdv: Donnees.getRdv(b.getAttribute("data-rdv-modifier")) }));
        sur("[data-rdv-reporter]", b => issueRdv(b.getAttribute("data-rdv-reporter"), "reporter"));
        sur("[data-rdv-non-effectuee]", b => issueRdv(b.getAttribute("data-rdv-non-effectuee"), "non-effectuee"));
        sur("[data-rdv-supprimer]", b => {
            if (window.confirm("Annuler ce rendez-vous ?")) { Donnees.supprimerRdv(b.getAttribute("data-rdv-supprimer")); AppLayout.fermerFeuille(); AppLayout.toast("Rendez-vous annulé"); }
        });
        sur("[data-planifier]", b => rdv({ ligneId: b.getAttribute("data-planifier") }));
        conteneur.querySelectorAll("[data-rdv-ouvrir]").forEach(el => {
            const ouvrir = (ev) => {
                if (ev.target.closest("button, a")) return;   // les boutons et liens gardent leur propre action
                detailRdv(el.getAttribute("data-rdv-ouvrir"));
            };
            el.addEventListener("click", ouvrir);
            el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ouvrir(ev); } });
        });
    }

    return { pastilleStatut, supprimerClients, memoriserAnnulation, proposerAnnulation, reprendreAnnulation, proposerTournee, membresEquipe, nomTechnicien, client, contact, ligne, visite, verifierSaisieVisite, rdv, realiserRdv, carteRdv, detailRdv, apercuClient, brancherRdv, dateFr, pastilleType, texteComplements,
        fichierIcs, telechargerIcs, messageClient, apresConfirmation };
})();
