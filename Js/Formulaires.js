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

    function champ(id, label, type, valeur, placeholder) {
        return '<label for="' + id + '">' + label + '</label>' +
            '<input type="' + type + '" id="' + id + '" value="' + esc(valeur == null ? "" : valeur) + '"' +
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
        return '<p class="message-erreur" data-erreur></p>' +
            '<button type="submit" class="bouton bouton--large">' + texteBouton + '</button>';
    }

    const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
    const coche = (id) => { const el = document.getElementById(id); return !!(el && el.checked); };

    function erreur(form, message) {
        form.querySelector("[data-erreur]").textContent = message || "";
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
        } catch (e) { /* pas de connexion : l'utilisateur saisit la ville lui-même */ }
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
            if (document.getElementById("fc-pays").value.trim().toLowerCase() !== "france") return;
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

    /* ---------- Client (création / modification) ---------- */

    function client(existant, apresEnregistrement) {
        const c = existant || { pays: "France", debutCampagne: 5, finCampagne: 11, cadenceJours: 14, actif: true };
        const corps =
            '<form id="form-client" novalidate>' +
            champ("fc-nom", "Nom du client *", "text", c.nom, "ex. Conserverie du Lot") +
            champ("fc-groupe", "Groupe", "text", c.groupe) +
            champ("fc-adresse", "Adresse (rue + numéro)", "text", c.adresse, "12 route de la Gare") +
            deuxColonnes(champ("fc-cp", "Code postal", "text", c.codePostal, "46000"),
                champ("fc-ville", "Ville *", "text", c.ville)) +
            deuxColonnes(champ("fc-region", "Région", "text", c.region, "Auto"),
                champ("fc-pays", "Pays *", "text", c.pays)) +
            deuxColonnes(champ("fc-tel", "Téléphone standard", "tel", c.telephone),
                champ("fc-email", "Email général", "email", c.email)) +
            liste("fc-production", "Type de production", Donnees.TYPES_PRODUCTION, c.typeProduction, true) +
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
            '</form>';

        AppLayout.ouvrirFeuille("bas", existant ? "Modifier le client" : "Nouveau client", corps);
        brancherCodePostal();

        const form = document.getElementById("form-client");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
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

            const resultat = existant ? Donnees.modifierClient(existant.id, source) : Donnees.ajouterClient(source);
            AppLayout.fermerFeuille();
            AppLayout.toast(existant ? "Client mis à jour ✓" : "Client créé ✓ — ajoute maintenant ses lignes");
            if (apresEnregistrement) apresEnregistrement(resultat);
        });
    }

    /* ---------- Contact ---------- */

    function contact(clientId, existant) {
        const x = existant || { role: Donnees.ROLES_CONTACT[0] };
        const corps =
            '<form id="form-contact" novalidate>' +
            liste("fk-role", "Rôle *", Donnees.ROLES_CONTACT, x.role) +
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
            if (!val("fk-nom")) return erreur(form, "Le nom est requis.");
            Donnees.enregistrerContact(clientId, {
                role: val("fk-role"), prenom: val("fk-prenom"), nom: val("fk-nom"),
                telephoneFixe: val("fk-fixe"), mobile: val("fk-mobile"), email: val("fk-email"),
                principal: coche("fk-principal"), notes: val("fk-notes")
            }, existant && existant.id);
            AppLayout.fermerFeuille();
            AppLayout.toast("Contact enregistré ✓");
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
                    '<input type="text" id="fo-' + o.cle + '-autre" placeholder="Nom du fournisseur" hidden style="margin-top:6px;"></div>' +
                    '<div><label for="fo-' + o.cle + '-r">Référence</label>' +
                    '<input type="text" id="fo-' + o.cle + '-r" value="' + esc(x[o.cle + "Ref"] || "") + '" placeholder="ex. P259M"></div>' +
                    '</div>';
            }).join("") +
            '</div>';
    }

    function brancherOutillage() {
        document.querySelectorAll("[data-outil]").forEach(sel => {
            const autre = document.getElementById("fo-" + sel.getAttribute("data-outil") + "-autre");
            sel.addEventListener("change", () => {
                autre.hidden = sel.value !== AUTRE;
                if (!autre.hidden) autre.focus();
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
        const x = existant || { suiviCampagne: true };
        const corps =
            '<form id="form-ligne" novalidate>' +
            champ("fl-nom", "Nom / n° de ligne *", "text", x.nom, "ex. Ligne 2") +
            deuxColonnes(champ("fl-marque", "Marque sertisseuse", "text", x.marque),
                champ("fl-modele", "Modèle sertisseuse", "text", x.modele)) +
            deuxColonnes(champ("fl-format", "Format habituel", "text", x.formatHabituel, "ex. 4/4"),
                champ("fl-produit", "Produit habituel", "text", x.produitHabituel)) +
            blocOutillage(x) +
            deuxColonnes(champ("fl-cadence", "Cadence (boîtes/min)", "number", x.cadenceLigne),
                champ("fl-serie", "N° de série (facultatif)", "text", x.numeroSerie)) +
            caseACocher("fl-suivi", "Suivie en campagne (entre dans les rappels)", x.suiviCampagne !== false) +
            zoneTexte("fl-notes", "Notes", x.notes) +
            piedFormulaire(existant ? "Enregistrer" : "Ajouter la ligne") +
            '</form>';

        AppLayout.ouvrirFeuille("bas", existant ? "Modifier la ligne" : "Nouvelle ligne", corps);
        brancherOutillage();
        const form = document.getElementById("form-ligne");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
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
                produitHabituel: val("fl-produit"), suiviCampagne: coche("fl-suivi"), notes: val("fl-notes")
            }, outillage), existant && existant.id);
            AppLayout.fermerFeuille();
            AppLayout.toast("Ligne enregistrée ✓");
        });
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
        const demain = Donnees.ajouterJours(Donnees.aujourdhuiIso(), 1);

        const corps =
            '<form id="form-rdv" novalidate>' +
            liste("fr-client", "Client *", clients.map(c => ({ valeur: c.id, texte: c.nom })), clientInit) +
            deuxColonnes(champ("fr-date", "Date *", "date", existant ? existant.date : demain),
                champ("fr-heure", "Heure", "time", existant ? existant.heure : "")) +
            liste("fr-type", "Type *", [{ valeur: "campagne", texte: "Campagne" }, { valeur: "maintenance", texte: "Maintenance / hiver" }],
                existant ? existant.type : "campagne") +
            '<label>Lignes à voir</label><div id="fr-lignes" class="liste-cases"></div>' +
            zoneTexte("fr-notes", "Notes", existant ? existant.notes : "", "Contact prévenu, points à contrôler…") +
            piedFormulaire(existant ? "Enregistrer" : "Planifier la visite") +
            '</form>';

        AppLayout.ouvrirFeuille("bas", existant ? "Modifier le rendez-vous" : "Planifier une visite", corps);
        const selClient = document.getElementById("fr-client");
        const champDate = document.getElementById("fr-date");
        champDate.min = Donnees.aujourdhuiIso();

        function remplirLignes() {
            const lignes = Donnees.lignesDuClient(selClient.value);
            const cochees = existant && existant.clientId === selClient.value ? existant.ligneIds
                : opts.ligneId ? [opts.ligneId] : lignes.filter(l => l.suiviCampagne !== false).map(l => l.id);
            document.getElementById("fr-lignes").innerHTML = lignes.length === 0
                ? '<p class="aide-champ" style="margin-top:0;">Aucune ligne pour ce client : le rendez-vous portera sur le client.</p>'
                : lignes.map(l => caseACocher("fr-l-" + l.id, esc(l.nom) +
                    (l.formatHabituel ? ' <span class="texte-attenue">— ' + esc(l.formatHabituel) + '</span>' : ""),
                    cochees.indexOf(l.id) !== -1).replace('<input ', '<input data-ligne="' + esc(l.id) + '" ')).join("");
        }
        function proposerType() {
            const c = Donnees.getClient(selClient.value);
            if (c && champDate.value && !existant) {
                document.getElementById("fr-type").value = Donnees.estEnCampagne(c, champDate.value) ? "campagne" : "maintenance";
            }
        }
        selClient.addEventListener("change", () => { remplirLignes(); proposerType(); });
        champDate.addEventListener("change", proposerType);
        remplirLignes();
        proposerType();

        const form = document.getElementById("form-rdv");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const date = champDate.value;
            if (!date) return erreur(form, "La date est requise.");
            if (date < Donnees.aujourdhuiIso()) return erreur(form, "La date est passée : pour une visite déjà faite, utilise « Enregistrer une visite ».");
            const r = Donnees.enregistrerRdv({
                clientId: selClient.value, date, heure: val("fr-heure"), type: val("fr-type"), notes: val("fr-notes"),
                ligneIds: Array.prototype.map.call(form.querySelectorAll("[data-ligne]:checked"), el => el.getAttribute("data-ligne"))
            }, existant && existant.id);
            if (!r) return erreur(form, "Rendez-vous non enregistré : vérifie le client et la date.");
            AppLayout.fermerFeuille();
            AppLayout.toast("Visite planifiée le " + dateFr(r.date) + (r.heure ? " à " + r.heure : "") + " ✓");
        });
    }

    /* Rendez-vous effectué : une fiche par ligne (format, produit, remarques),
       décochable si une ligne n'a finalement pas été vue. */
    function realiserRdv(rdvId) {
        const r = Donnees.getRdv(rdvId);
        if (!r) return;
        const client = Donnees.getClient(r.clientId);
        const toutes = Donnees.lignesDuClient(r.clientId);
        if (toutes.length === 0) {
            AppLayout.toast("Ajoute d'abord une ligne à ce client pour y enregistrer la visite");
            return;
        }
        const prevues = r.ligneIds && r.ligneIds.length ? r.ligneIds : toutes.map(l => l.id);
        const aujourdhui = Donnees.aujourdhuiIso();

        const corps =
            '<form id="form-realiser" novalidate>' +
            '<p class="texte-attenue" style="font-size:0.85rem;margin:0;">' + esc(client ? client.nom : "") +
            ' · prévu le ' + dateFr(r.date) + (r.heure ? " à " + esc(r.heure) : "") + '</p>' +
            (r.notes ? '<div class="carte-ligne-notes">' + esc(r.notes) + '</div>' : "") +
            deuxColonnes(champ("fx-date", "Date de la visite *", "date", r.date <= aujourdhui ? r.date : aujourdhui),
                liste("fx-type", "Type *", [{ valeur: "campagne", texte: "Campagne" }, { valeur: "maintenance", texte: "Maintenance / hiver" }], r.type)) +
            toutes.map(l =>
                '<div class="bloc-formulaire" data-bloc-ligne="' + esc(l.id) + '">' +
                caseACocher("fx-l-" + l.id, '<strong>' + esc(l.nom) + '</strong>', prevues.indexOf(l.id) !== -1)
                    .replace('<input ', '<input data-ligne-vue="' + esc(l.id) + '" ') +
                deuxColonnes(champ("fx-f-" + l.id, "Format", "text", l.formatHabituel), champ("fx-p-" + l.id, "Produit", "text", l.produitHabituel)) +
                zoneTexte("fx-r-" + l.id, "Remarques", "", "Réglages, contrôles, points à revoir…") +
                '</div>').join("") +
            piedFormulaire("Enregistrer la visite") +
            '</form>';

        AppLayout.ouvrirFeuille("bas", "Visite effectuée", corps);
        const form = document.getElementById("form-realiser");
        form.querySelector("#fx-date").max = aujourdhui;

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const date = val("fx-date");
            if (!date) return erreur(form, "La date est requise.");
            if (date > aujourdhui) return erreur(form, "Une visite enregistrée ne peut pas être dans le futur.");
            const visites = Array.prototype.filter.call(form.querySelectorAll("[data-ligne-vue]"), el => el.checked).map(el => {
                const id = el.getAttribute("data-ligne-vue");
                return { ligneId: id, date, type: val("fx-type"), format: val("fx-f-" + id), produit: val("fx-p-" + id), remarques: val("fx-r-" + id) };
            });
            if (visites.length === 0) return erreur(form, "Coche au moins une ligne visitée.");
            const creees = Donnees.realiserRdv(rdvId, visites);
            if (!creees) return erreur(form, "Visite non enregistrée.");
            AppLayout.fermerFeuille();
            AppLayout.toast(creees.length + " visite" + (creees.length > 1 ? "s enregistrées" : " enregistrée") + " ✓ — rendez-vous clôturé");
        });
    }

    /* ---------- Visite ----------
       options : { clientId, ligneId } — tous deux facultatifs. Sans eux,
       l'utilisateur choisit le client puis la ligne. */

    function visite(options) {
        const opts = options || {};
        const clientsAvecLignes = Donnees.listerClients().filter(c => Donnees.lignesDuClient(c.id).length > 0);
        if (clientsAvecLignes.length === 0) {
            AppLayout.fermerFeuille();
            AppLayout.toast("Ajoute d'abord un client et au moins une ligne");
            return;
        }

        const ligneInit = opts.ligneId ? Donnees.getLigne(opts.ligneId) : null;
        const clientInitId = ligneInit ? ligneInit.clientId : (opts.clientId || clientsAvecLignes[0].id);

        const corps =
            '<form id="form-visite" novalidate>' +
            liste("fv-client", "Client *", clientsAvecLignes.map(c => ({ valeur: c.id, texte: c.nom })), clientInitId) +
            '<label for="fv-ligne">Ligne *</label><select id="fv-ligne"></select>' +
            deuxColonnes(champ("fv-date", "Date *", "date", Donnees.aujourdhuiIso()),
                liste("fv-type", "Type *", [{ valeur: "campagne", texte: "Campagne" }, { valeur: "maintenance", texte: "Maintenance / hiver" }], "campagne")) +
            deuxColonnes(champ("fv-format", "Format", "text", ""), champ("fv-produit", "Produit", "text", "")) +
            zoneTexte("fv-remarques", "Remarques", "", "Réglages effectués, contrôles, points à revoir…") +
            piedFormulaire("Enregistrer la visite") +
            '</form>';

        AppLayout.ouvrirFeuille("bas", "Enregistrer une visite", corps);

        const selClient = document.getElementById("fv-client");
        const selLigne = document.getElementById("fv-ligne");
        const champDate = document.getElementById("fv-date");
        const selType = document.getElementById("fv-type");

        /* Type proposé selon la date : campagne si le client est en campagne
           ce jour-là, maintenance sinon. Modifiable à la main. */
        function proposerType() {
            const c = Donnees.getClient(selClient.value);
            if (c && champDate.value) selType.value = Donnees.estEnCampagne(c, champDate.value) ? "campagne" : "maintenance";
        }

        /* Format et produit pré-remplis avec les valeurs habituelles de la ligne. */
        function preremplir() {
            const l = Donnees.getLigne(selLigne.value);
            document.getElementById("fv-format").value = (l && l.formatHabituel) || "";
            document.getElementById("fv-produit").value = (l && l.produitHabituel) || "";
        }

        function remplirLignes(ligneChoisie) {
            const lignes = Donnees.lignesDuClient(selClient.value);
            selLigne.innerHTML = lignes.map(l =>
                '<option value="' + esc(l.id) + '"' + (l.id === ligneChoisie ? " selected" : "") + '>' + esc(l.nom) + '</option>').join("");
            preremplir();
            proposerType();
        }

        selClient.addEventListener("change", () => remplirLignes(null));
        selLigne.addEventListener("change", preremplir);
        champDate.addEventListener("change", proposerType);
        remplirLignes(ligneInit ? ligneInit.id : null);

        const form = document.getElementById("form-visite");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!selLigne.value || !champDate.value) return erreur(form, "Client, ligne et date sont requis.");
            if (champDate.value > Donnees.aujourdhuiIso()) return erreur(form, "Une visite enregistrée ne peut pas être dans le futur.");
            const v = Donnees.enregistrerVisite({
                ligneId: selLigne.value, date: champDate.value, type: selType.value,
                format: val("fv-format"), produit: val("fv-produit"), remarques: val("fv-remarques")
            });
            if (!v) return erreur(form, "Visite non enregistrée : vérifie la date.");
            AppLayout.fermerFeuille();
            const c = Donnees.getClient(v.clientId);
            AppLayout.toast(v.type === "campagne" && c
                ? "Visite enregistrée ✓ — prochaine vers le " + dateFr(Donnees.ajouterJours(v.date, c.cadenceJours))
                : "Visite enregistrée ✓");
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

    function carteRdv(r, avecClient) {
        const client = Donnees.getClient(r.clientId);
        const lignes = (r.ligneIds || []).map(id => Donnees.getLigne(id)).filter(Boolean).map(l => l.nom);
        const depasse = r.date < Donnees.aujourdhuiIso();
        return '<div class="ligne-rdv' + (depasse ? " ligne-rdv--depasse" : "") + '">' +
            '<div class="ligne-rdv-date"><strong>' + esc(libelleJour(r.date)) + '</strong>' +
            '<span>' + (r.heure ? esc(r.heure) : dateFr(r.date).slice(0, 5)) + '</span></div>' +
            '<div class="ligne-rdv-corps">' +
            (avecClient && client ? '<a href="Client.html?id=' + encodeURIComponent(client.id) + '" class="ligne-rdv-client">' + esc(client.nom) + '</a>' : "") +
            '<div class="texte-attenue">' + (r.type === "maintenance" ? "Maintenance / hiver" : "Campagne") +
            (lignes.length ? " · " + esc(lignes.join(", ")) : "") + '</div>' +
            (depasse ? '<div class="ligne-rdv-alerte">Date passée : visite faite ?</div>' : "") +
            (r.notes ? '<div class="texte-attenue ligne-rdv-notes">' + esc(r.notes) + '</div>' : "") +
            '</div>' +
            '<div class="ligne-rdv-actions">' +
            (r.date <= Donnees.aujourdhuiIso() ? '<button type="button" class="bouton bouton--petit" data-rdv-faite="' + esc(r.id) + '">✅ Faite</button>' : "") +
            '<button type="button" class="bouton bouton--petit bouton--contour" data-rdv-modifier="' + esc(r.id) + '" aria-label="Modifier">✏️</button>' +
            '<button type="button" class="bouton bouton--petit bouton--fantome" data-rdv-supprimer="' + esc(r.id) + '" aria-label="Supprimer">🗑</button>' +
            '</div></div>';
    }

    function brancherRdv(conteneur) {
        const sur = (sel, fn) => conteneur.querySelectorAll(sel).forEach(b => b.addEventListener("click", () => fn(b)));
        sur("[data-rdv-faite]", b => realiserRdv(b.getAttribute("data-rdv-faite")));
        sur("[data-rdv-modifier]", b => rdv({ rdv: Donnees.getRdv(b.getAttribute("data-rdv-modifier")) }));
        sur("[data-rdv-supprimer]", b => {
            if (window.confirm("Annuler ce rendez-vous ?")) { Donnees.supprimerRdv(b.getAttribute("data-rdv-supprimer")); AppLayout.fermerFeuille(); AppLayout.toast("Rendez-vous annulé"); }
        });
        sur("[data-planifier]", b => rdv({ ligneId: b.getAttribute("data-planifier") }));
    }

    return { client, contact, ligne, visite, rdv, realiserRdv, carteRdv, brancherRdv, dateFr };
})();
