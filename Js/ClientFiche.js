/* =============================================================
   ClientFiche.js — Fiche client (Client.html?id=…)
   Onglets : Lignes · Contacts · Historique · Infos
   ============================================================= */

(() => {
    "use strict";

    const esc = (t) => AppLayout.escapeHtml(t);
    const conteneur = document.getElementById("contenu-page");
    const clientId = new URLSearchParams(window.location.search).get("id");
    let onglet = "lignes";
    let filtreHistorique = "tous";       // « tous » ou la clé d'un statut (effectuee, reportee, non-effectuee, annulee)

    const STATUTS = {
        retard: { libelle: "En retard", couleur: "#dc2626" },
        jamais: { libelle: "Pas encore vue", couleur: "#f97316" },
        bientot: { libelle: "À prévoir", couleur: "#d4a017" },
        ok: { libelle: "À jour", couleur: "#16a34a" }
    };

    function lienTel(numero) {
        return numero ? '<a href="tel:' + esc(numero.replace(/\s/g, "")) + '" class="texte-lien">📞 ' + esc(numero) + '</a>' : "";
    }

    function lienMail(email) {
        return email ? '<a href="mailto:' + encodeURIComponent(email).replace(/%40/g, "@") + '" class="texte-lien">✉️ ' + esc(email) + '</a>' : "";
    }

    /* ---------- Onglet Lignes ---------- */

    function ongletLignes(client) {
        const lignes = Donnees.lignesDuClient(client.id);
        const echeances = Donnees.calculerEcheances().lignes.filter(e => e.client.id === client.id);

        const cartes = lignes.map(l => {
            const e = echeances.find(x => x.ligne.id === l.id);
            const derniere = Donnees.visitesDeLaLigne(l.id)[0];
            const machine = [l.marque, l.modele].filter(Boolean).join(" ") + (l.numeroSerie ? " — n° " + l.numeroSerie : "");
            const outillage = Donnees.OUTILS.map(o => {
                const t = [l[o.cle + "Fournisseur"], l[o.cle + "Ref"]].filter(Boolean).join(" ");
                return t ? '<span class="outil"><span class="texte-attenue">' + o.libelle + ' :</span> ' + esc(t) + '</span>' : "";
            }).filter(Boolean);
            const statut = Donnees.statutLigne(l);
            const active = statut === "active";
            let etatHtml;
            if (statut === "inactive") etatHtml = '<span class="pastille-statut" style="background:var(--secondaire);color:var(--attenue-texte);">Inactive</span>';
            else if (statut === "concurrent") etatHtml = '<span class="pastille-statut pastille-couleur" style="' + Donnees.styleCouleur("#be123c") + '">Autre fournisseur' + (l.fournisseurActuel ? " : " + esc(l.fournisseurActuel) : "") + '</span>';
            else if (!e) etatHtml = '<span class="pastille-statut pastille-couleur" style="' + Donnees.styleCouleur("#0ea5e9") + '">Hors campagne</span>';
            else etatHtml = '<span class="pastille-statut pastille-couleur" style="' + Donnees.styleCouleur(STATUTS[e.statut].couleur) + '">' + STATUTS[e.statut].libelle + '</span>';

            /* Bascule rapide du statut, sans ouvrir le formulaire. */
            const bascule = '<div class="bascule-statut" role="group" aria-label="Statut de la ligne">' + Donnees.STATUTS_LIGNE.map(st =>
                '<button type="button" class="bascule-statut-bouton' + (st.cle === statut ? " actif" : "") + '" data-statut-ligne="' + esc(l.id) + '|' + st.cle + '"' +
                (st.cle === statut ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' + esc(st.libelle) + '</button>').join("") + '</div>';

            return '<div class="carte carte-ligne' + (active ? "" : " carte-ligne--inactive") + '">' +
                '<div class="carte-ligne-entete"><strong>' + esc(l.nom) + '</strong>' + etatHtml + '</div>' +
                (machine.trim() ? '<div class="texte-attenue carte-ligne-info">⚙️ ' + esc(machine) + '</div>' : "") +
                '<div class="texte-attenue carte-ligne-info">📦 ' + esc([l.formatHabituel, l.produitHabituel].filter(Boolean).join(" · ") || "Format / produit non renseignés") +
                (l.cadenceLigne ? ' · ' + esc(l.cadenceLigne) + ' b/min' : "") + '</div>' +
                (outillage.length ? '<div class="carte-ligne-outillage">🔩 ' + outillage.join("") + '</div>' : "") +
                '<div class="texte-attenue carte-ligne-info">🕑 ' + (derniere ? "Dernière visite le " + Formulaires.dateFr(derniere.date) : "Jamais visitée") +
                (e && e.echeance ? ' · prochaine le ' + Formulaires.dateFr(e.echeance) : "") + '</div>' +
                (l.notes ? '<div class="carte-ligne-notes">' + esc(l.notes) + '</div>' : "") +
                bascule +
                '<div class="carte-ligne-actions">' +
                (active ? '<button type="button" class="bouton bouton--petit" data-visite="' + esc(l.id) + '">✅ Visite faite</button>' +
                    '<button type="button" class="bouton bouton--petit bouton--contour" data-planifier="' + esc(l.id) + '">📅 Planifier</button>' : "") +
                '<button type="button" class="bouton bouton--petit bouton--contour" data-modifier-ligne="' + esc(l.id) + '">Modifier</button>' +
                '<button type="button" class="bouton bouton--petit bouton--fantome" data-supprimer-ligne="' + esc(l.id) + '">Supprimer</button>' +
                '</div></div>';
        });

        return '<div class="section-entete" style="margin-top:12px;"><h2 class="section-titre">🏭 Lignes de production</h2>' +
            '<button type="button" class="bouton bouton--petit" data-ajouter-ligne>+ Ajouter une ligne</button></div>' +
            (lignes.length === 0
                ? '<div class="etat-vide">Aucune ligne. Ajoute les lignes que tu suis chez ce client pour recevoir les rappels.</div>'
                : '<div class="grille-lignes">' + cartes.join("") + '</div>');
    }

    /* ---------- Onglet Contacts ---------- */

    function ongletContacts(client) {
        const contacts = Donnees.contactsDuClient(client.id);
        return '<div class="section-entete" style="margin-top:12px;"><h2 class="section-titre">👤 Contacts</h2>' +
            '<button type="button" class="bouton bouton--petit" data-ajouter-contact>+ Ajouter un contact</button></div>' +
            (contacts.length === 0
                ? '<div class="etat-vide">Aucun contact. Ajoute le responsable sertissage, la logistique, la qualité…</div>'
                : '<div class="grille-lignes">' + contacts.map(k =>
                    '<div class="carte carte-ligne">' +
                    '<div class="carte-ligne-entete"><strong>' + (k.principal ? "⭐ " : "") + esc([k.prenom, k.nom].filter(Boolean).join(" ")) + '</strong>' +
                    '<span class="pastille-statut" style="background:var(--accent);color:var(--accent-texte);">' + esc(k.role) + '</span></div>' +
                    '<div class="carte-ligne-liens">' + [lienTel(k.mobile), lienTel(k.telephoneFixe), lienMail(k.email)].filter(Boolean).join("") + '</div>' +
                    (k.notes ? '<div class="carte-ligne-notes">' + esc(k.notes) + '</div>' : "") +
                    '<div class="carte-ligne-actions">' +
                    '<button type="button" class="bouton bouton--petit bouton--contour" data-modifier-contact="' + esc(k.id) + '">Modifier</button>' +
                    '<button type="button" class="bouton bouton--petit bouton--fantome" data-supprimer-contact="' + esc(k.id) + '">Supprimer</button>' +
                    '</div></div>').join("") + '</div>');
    }

    /* ---------- Onglet Historique ---------- */

    function ongletHistorique(client) {
        const toutes = Donnees.historiqueDuClient(client.id);
        const compte = (cle) => toutes.filter(v => Donnees.statutVisite(v) === cle).length;
        /* Une puce par statut présent (la puce du filtre actif reste, même à zéro, pour pouvoir en sortir). */
        const puces = [["tous", "Toutes", toutes.length]].concat(Donnees.STATUTS_VISITE.map(st => [st.cle, st.icone + " " + st.libelle + "s", compte(st.cle)]))
            .filter(p => p[0] === "tous" || p[2] > 0 || p[0] === filtreHistorique);
        const visites = filtreHistorique === "tous" ? toutes : toutes.filter(v => Donnees.statutVisite(v) === filtreHistorique);
        return '<div class="section-entete" style="margin-top:12px;"><h2 class="section-titre">🕑 Historique des visites</h2>' +
            '<button type="button" class="bouton bouton--petit" data-nouvelle-visite>+ Enregistrer une visite</button></div>' +
            (puces.length > 2 ? '<div class="puces-filtre" role="group" aria-label="Filtrer par statut" style="margin-bottom:10px;">' + puces.map(p =>
                '<button type="button" class="puce-filtre puce--defaut' + (p[0] === filtreHistorique ? " actif" : "") + '" data-filtre-historique="' + p[0] + '" aria-pressed="' + (p[0] === filtreHistorique) + '">' +
                esc(p[1]) + ' <span class="puce-compteur">' + p[2] + '</span></button>').join("") + '</div>' : "") +
            (visites.length === 0
                ? '<div class="etat-vide">' + (toutes.length === 0 ? "Aucune visite enregistrée." : "Aucune visite avec ce statut.") + '</div>'
                : '<div class="carte" style="padding:0;">' + visites.map(v => {
                    const l = v.ligneId ? Donnees.getLigne(v.ligneId) : null;
                    const complements = Formulaires.texteComplements(v);
                    const statut = Donnees.statutVisite(v);
                    return '<div class="ligne-historique' + (statut === "effectuee" ? "" : " ligne-historique--" + statut) + '">' +
                        '<div class="ligne-historique-date">' + Formulaires.dateFr(v.date) + '</div>' +
                        '<div class="ligne-historique-corps">' +
                        '<div><strong>' + esc(l ? l.nom : (v.ligneId ? "Ligne supprimée" : "Visite générale")) + '</strong> ' +
                        Formulaires.pastilleType(v.type) + ' ' + Formulaires.pastilleStatut(v) + '</div>' +
                        (statut === "reportee" && v.reporteLe ? '<div class="texte-attenue">🔁 Reportée au <strong>' + Formulaires.dateFr(v.reporteLe) + '</strong></div>' : "") +
                        (v.motif ? '<div class="texte-attenue">Motif : ' + esc(v.motif) + '</div>' : "") +
                        ((v.format || v.produit) ? '<div class="texte-attenue">📦 ' + esc([v.format, v.produit].filter(Boolean).join(" · ")) + '</div>' : "") +
                        (complements.length ? '<div class="texte-attenue historique-complements">' + complements.map(esc).join("<br>") + '</div>' : "") +
                        (v.remarques ? '<div class="carte-ligne-notes">' + esc(v.remarques) + '</div>' : "") +
                        '</div>' +
                        '<div class="apercu-actions">' +
                        '<button type="button" class="bouton bouton--petit bouton--contour" data-modifier-visite="' + esc(v.id) + '" aria-label="Modifier la visite">✏️</button>' +
                        '<button type="button" class="bouton bouton--petit bouton--fantome" data-supprimer-visite="' + esc(v.id) + '" aria-label="Supprimer la visite">🗑</button>' +
                        '</div>' +
                        '</div>';
                }).join("") + '</div>');
    }

    /* ---------- Onglet Infos ---------- */

    function ongletInfos(client) {
        const ligneInfo = (libelle, valeur) => valeur
            ? '<div class="ligne-info"><span class="texte-attenue">' + libelle + '</span><span>' + valeur + '</span></div>' : "";
        return '<div class="carte" style="margin-top:12px;">' +
            ligneInfo("Groupe", esc(client.groupe)) +
            ligneInfo("Adresse", esc([client.adresse, [client.codePostal, client.ville].filter(Boolean).join(" "), client.pays].filter(Boolean).join(", "))) +
            ligneInfo("Région", esc(client.region)) +
            ligneInfo("Téléphone", lienTel(client.telephone)) +
            ligneInfo("Email", lienMail(client.email)) +
            ligneInfo("Production", esc(client.typeProduction)) +
            ligneInfo("Campagne", esc(Donnees.MOIS[client.debutCampagne - 1] + " → " + Donnees.MOIS[client.finCampagne - 1])) +
            ligneInfo("Cadence", "tous les " + client.cadenceJours + " jours") +
            ligneInfo("Statut", client.actif === false ? "Inactif (aucun rappel)" : "Actif") +
            ligneInfo("Créé le", Formulaires.dateFr(client.creeLe)) +
            (client.notes ? '<div class="carte-ligne-notes" style="margin-top:10px;">' + esc(client.notes) + '</div>' : "") +
            '</div>' +
            '<div style="margin-top:16px;display:flex;justify-content:flex-end;">' +
            '<button type="button" class="bouton bouton--contour bouton--danger" data-supprimer-client>🗑 Supprimer ce client</button>' +
            '</div>';
    }

    /* ---------- Rendu ---------- */

    function rendre() {
        const client = clientId ? Donnees.getClient(clientId) : null;
        if (!client) {
            conteneur.innerHTML = '<a href="Clients.html" class="fiche-retour">← Clients</a>' +
                '<div class="etat-vide" style="margin-top:12px;">Ce client n\'existe pas ou a été supprimé.</div>';
            return;
        }
        document.title = client.nom + " — AC SAT Campagne";

        const enCampagne = Donnees.estEnCampagne(client, Donnees.aujourdhuiIso());
        const nb = {
            lignes: Donnees.lignesDuClient(client.id).length,
            lignesActives: Donnees.lignesActivesDuClient(client.id).length,
            contacts: Donnees.contactsDuClient(client.id).length,
            historique: Donnees.historiqueDuClient(client.id).length
        };
        const ONGLETS = [
            { id: "lignes", icone: "🏭", libelle: "Lignes", n: nb.lignes },
            { id: "contacts", icone: "👤", libelle: "Contacts", n: nb.contacts },
            { id: "historique", icone: "🕑", libelle: "Historique", n: nb.historique },
            { id: "infos", icone: "ℹ️", libelle: "Infos", n: null }
        ];

        const rdvs = Donnees.rdvDuClient(client.id);
        const contenu = { lignes: ongletLignes, contacts: ongletContacts, historique: ongletHistorique, infos: ongletInfos }[onglet](client);

        conteneur.innerHTML =
            '<a href="Clients.html" class="fiche-retour">← Clients</a>' +
            '<div class="fiche-entete">' +
            '<div class="fiche-entete-haut">' +
            '<div style="min-width:0;flex:1 1 280px;">' +
            '<h1 class="fiche-titre">' + esc(client.nom) + '</h1>' +
            '<div class="fiche-adresse">📍 ' + esc([client.adresse, [client.codePostal, client.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—") + '</div>' +
            '<div class="fiche-badges">' +
            (client.actif === false
                ? '<span class="badge-statut badge-statut--inactif">Inactif</span>'
                : enCampagne ? '<span class="badge-statut badge-statut--ok">En campagne</span>'
                    : '<span class="badge-statut badge-statut--campagne-off">Hors campagne</span>') +
            '<span class="pastille-statut" style="background:var(--secondaire);color:var(--texte);">📆 ' +
            esc(Donnees.MOIS[client.debutCampagne - 1] + " → " + Donnees.MOIS[client.finCampagne - 1]) + ' · tous les ' + client.cadenceJours + ' j</span>' +
            (client.typeProduction ? '<span class="pastille-statut" style="background:var(--secondaire);color:var(--texte);">' + esc(client.typeProduction) + '</span>' : "") +
            (Formulaires.membresEquipe().length ? '<span class="pastille-statut" style="background:var(--secondaire);color:var(--texte);">👷 ' +
                esc(client.technicien ? Formulaires.nomTechnicien(client.technicien) : "Non attribué") + '</span>' : "") +
            '</div></div>' +
            '<div class="fiche-actions">' +
            (client.telephone ? '<a href="tel:' + esc(client.telephone.replace(/\s/g, "")) + '" class="bouton bouton--petit bouton--contour">📞 Appeler</a>' : "") +
            '<button type="button" class="bouton bouton--petit bouton--contour" data-modifier-client>✏️ Modifier</button>' +
            '<button type="button" class="bouton bouton--petit bouton--contour bouton--danger" data-supprimer-client aria-label="Supprimer ce client">🗑 Supprimer</button>' +
            (client.actif !== false ? '<button type="button" class="bouton bouton--petit bouton--contour" data-planifier-client>📅 Planifier</button>' : "") +
            (nb.lignes > 0 ? '<button type="button" class="bouton bouton--petit" data-nouvelle-visite>✅ Visite</button>' : "") +
            '</div>' +
            '</div></div>' +

            (rdvs.length
                ? '<div class="carte" style="padding:0;margin-top:12px;"><div class="bloc-rdv-titre">📅 Rendez-vous prévus</div>' +
                rdvs.map(r => Formulaires.carteRdv(r, false)).join("") + '</div>'
                : "") +
            '<div class="onglets-fiche" style="margin-top:12px;">' +
            ONGLETS.map(o => '<button type="button" class="onglet-fiche onglet-bouton' + (o.id === onglet ? " actif" : "") + '" data-onglet="' + o.id + '">' +
                '<span class="onglet-icone" aria-hidden="true">' + o.icone + '</span>' + o.libelle + (o.n !== null ? ' <span class="onglet-fiche-compteur">' + o.n + '</span>' : "") + '</button>').join("") +
            '</div>' +
            contenu;

        brancher(client);
    }

    function brancher(client) {
        const sur = (selecteur, fn) => conteneur.querySelectorAll(selecteur).forEach(el => el.addEventListener("click", () => fn(el)));
        const confirmer = (message) => window.confirm(message);

        sur("[data-onglet]", el => { onglet = el.getAttribute("data-onglet"); rendre(); });
        Formulaires.brancherRdv(conteneur);
        sur("[data-planifier-client]", () => Formulaires.rdv({ clientId: client.id }));
        sur("[data-modifier-client]", () => Formulaires.client(client));
        sur("[data-nouvelle-visite]", () => Formulaires.visite({ clientId: client.id }));
        sur("[data-visite]", el => Formulaires.visite({ ligneId: el.getAttribute("data-visite") }));

        sur("[data-ajouter-ligne]", () => Formulaires.ligne(client.id));
        sur("[data-statut-ligne]", el => {
            const [id, statut] = el.getAttribute("data-statut-ligne").split("|");
            const l = Donnees.getLigne(id);
            if (!l || Donnees.statutLigne(l) === statut) return;
            if (statut === "concurrent") {
                /* Même formulaire que « Modifier », avec le choix déjà fait,
                   pour pouvoir noter le fournisseur actuel. */
                Formulaires.ligne(client.id, Object.assign({}, l, { statut: "concurrent" }));
                return;
            }
            Donnees.definirStatutLigne(id, statut);
            AppLayout.toast(statut === "active" ? "Ligne réactivée ✓ — elle revient dans les rappels" : "Ligne inactive ✓ — retirée des rappels et des visites");
        });
        sur("[data-modifier-ligne]", el => Formulaires.ligne(client.id, Donnees.getLigne(el.getAttribute("data-modifier-ligne"))));
        sur("[data-supprimer-ligne]", el => {
            const l = Donnees.getLigne(el.getAttribute("data-supprimer-ligne"));
            const n = Donnees.visitesDeLaLigne(l.id).length;
            if (confirmer("Supprimer « " + l.nom + " »" + (n ? " et ses " + n + " visite(s) enregistrée(s)" : "") + " ?")) {
                Donnees.supprimerLigne(l.id);
                AppLayout.toast("Ligne supprimée");
            }
        });

        sur("[data-ajouter-contact]", () => Formulaires.contact(client.id));
        sur("[data-modifier-contact]", el => {
            const k = Donnees.contactsDuClient(client.id).find(x => x.id === el.getAttribute("data-modifier-contact"));
            Formulaires.contact(client.id, k);
        });
        sur("[data-supprimer-contact]", el => {
            if (confirmer("Supprimer ce contact ?")) { Donnees.supprimerContact(el.getAttribute("data-supprimer-contact")); AppLayout.toast("Contact supprimé"); }
        });

        sur("[data-filtre-historique]", el => { filtreHistorique = el.getAttribute("data-filtre-historique"); rendre(); });
        sur("[data-modifier-visite]", el => {
            const v = Donnees.getVisite(el.getAttribute("data-modifier-visite"));
            if (v) Formulaires.visite({ visite: v });
        });
        sur("[data-supprimer-visite]", el => {
            if (confirmer("Supprimer cette visite de l'historique ?")) { Donnees.supprimerVisite(el.getAttribute("data-supprimer-visite")); AppLayout.toast("Visite supprimée"); }
        });

        sur("[data-supprimer-client]", () => Formulaires.supprimerClients([client.id], { apres: (copie) => {
            Formulaires.memoriserAnnulation(copie);
            window.location.href = "Clients.html";
        } }));
    }

    Donnees.ecouter(rendre);
    rendre();
})();
