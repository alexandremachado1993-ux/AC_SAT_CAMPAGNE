/* =============================================================
   TableauBord.js — Page d'accueil « À visiter » (Index.html)

   Répond à UNE question : chez qui dois-je aller, et quelle ligne ?
   Tout vient de Donnees.calculerEcheances() ; cette page ne fait
   qu'afficher et filtrer.
   ============================================================= */

(() => {
    "use strict";

    const esc = (t) => AppLayout.escapeHtml(t);
    const conteneur = document.getElementById("contenu-page");

    const STATUTS = {
        retard: { libelle: "En retard", icone: "⏰", couleur: "#dc2626" },
        jamais: { libelle: "Pas encore vue", icone: "🆕", couleur: "#f97316" },
        bientot: { libelle: "À prévoir", icone: "📆", couleur: "#d4a017" },
        ok: { libelle: "À jour", icone: "✅", couleur: "#16a34a" }
    };

    /* Par défaut on montre ce qui est à faire ; « À jour » reste consultable. */
    let filtre = "a-faire";

    function texteEcheance(e) {
        if (e.statut === "jamais") return "Pas encore visitée cette campagne";
        const derniere = "dernière visite le " + Formulaires.dateFr(e.derniere.date);
        if (e.statut === "retard") {
            const n = -e.joursRestants;
            return "En retard de " + n + " jour" + (n > 1 ? "s" : "") + " · " + derniere;
        }
        if (e.joursRestants === 0) return "À faire aujourd'hui · " + derniere;
        return "À faire d'ici le " + Formulaires.dateFr(e.echeance) + " (" + e.joursRestants + " j) · " + derniere;
    }

    function metrique(cle, valeur) {
        const s = STATUTS[cle];
        const actif = filtre === cle;
        return '<button type="button" class="carte metrique-carte metrique-carte--lien metrique-bouton' + (actif ? " metrique-bouton--actif" : "") + '"' +
            ' data-filtre="' + cle + '" style="border-top:3px solid ' + s.couleur + ';' + (actif ? "background:" + s.couleur + "14;" : "") + '">' +
            '<div style="display:flex;align-items:flex-start;gap:8px;">' +
            '<span class="metrique-icone pastille-couleur" style="' + Donnees.styleCouleur(s.couleur) + '">' + s.icone + '</span>' +
            '<div style="min-width:0;flex:1;text-align:left;">' +
            '<div class="metrique-valeur' + (valeur > 0 && cle !== "ok" ? " texte-couleur" : "") + '"' + (valeur > 0 && cle !== "ok" ? ' style="' + Donnees.styleCouleur(s.couleur) + '"' : "") + '>' + valeur + '</div>' +
            '<div class="metrique-libelle">' + s.libelle + '</div>' +
            '</div></div></button>';
    }

    function contactPrincipal(clientId) {
        const contacts = Donnees.contactsDuClient(clientId);
        return contacts.find(k => k.principal) ||
            contacts.find(k => k.role === "Responsable sertissage") || contacts[0] || null;
    }

    function carteClient(client, echeances) {
        const k = contactPrincipal(client.id);
        const tel = k && (k.mobile || k.telephoneFixe);
        const pire = STATUTS[echeances[0].statut];
        const prochain = Donnees.rdvDuClient(client.id).find(r => r.date >= Donnees.aujourdhuiIso());
        /* Toute la carte est cliquable : elle ouvre la fiche rapide du client.
           Les boutons et liens qu'elle contient gardent leur propre action. */
        return '<div class="carte carte-a-visiter" style="border-left:4px solid ' + pire.couleur + ';" data-apercu-client="' + esc(client.id) + '"' +
            ' role="button" tabindex="0" aria-label="Ouvrir la fiche de ' + esc(client.nom) + '">' +
            '<div class="carte-a-visiter-entete">' +
            '<span class="carte-a-visiter-nom">' + esc(client.nom) + '</span>' +
            '<span class="texte-attenue carte-a-visiter-ville">' + esc(client.ville || "") + '</span>' +
            '</div>' +
            (prochain ? '<button type="button" class="pastille-rdv pastille-couleur" data-rdv-pastille="' + esc(prochain.id) + '" style="' + Donnees.styleCouleur(Donnees.typeVisite(prochain.type).couleur) + '">📅 ' + esc(Donnees.typeVisite(prochain.type).libelle) + ' prévu le ' + Formulaires.dateFr(prochain.date) +
                (prochain.heure ? " à " + esc(prochain.heure) : "") + '</button>' : "") +
            (k ? '<div class="carte-a-visiter-contact">👤 ' + esc([k.prenom, k.nom].filter(Boolean).join(" ")) +
                ' <span class="texte-attenue">· ' + esc(k.role) + '</span>' +
                (tel ? ' · <a href="tel:' + esc(tel.replace(/\s/g, "")) + '" class="texte-lien">📞 ' + esc(tel) + '</a>' : "") +
                '</div>' : "") +
            echeances.map(e => {
                const s = STATUTS[e.statut];
                const details = [e.ligne.formatHabituel, e.ligne.produitHabituel].filter(Boolean).join(" · ");
                return '<div class="ligne-echeance">' +
                    '<span class="pastille-statut pastille-couleur" style="' + Donnees.styleCouleur(s.couleur) + '">' + s.icone + ' ' + s.libelle + '</span>' +
                    '<div class="ligne-echeance-corps">' +
                    '<div class="ligne-echeance-nom">' + esc(e.ligne.nom) + (details ? ' <span class="texte-attenue">— ' + esc(details) + '</span>' : "") + '</div>' +
                    '<div class="ligne-echeance-texte texte-attenue">' + esc(texteEcheance(e)) + '</div>' +
                    '</div>' +
                    '<div class="ligne-echeance-actions">' +
                    '<button type="button" class="bouton bouton--petit bouton--contour" data-planifier="' + esc(e.ligne.id) + '">📅 Planifier</button>' +
                    '<button type="button" class="bouton bouton--petit" data-visite="' + esc(e.ligne.id) + '">✅ Visite faite</button>' +
                    '</div></div>';
            }).join("") +
            '</div>';
    }

    function etatVideSansClient() {
        return '<div class="etat-vide">' +
            '<div style="font-size:2rem;">📋</div>' +
            '<p style="font-weight:700;color:var(--texte);margin-top:8px;">Aucun client pour l\'instant</p>' +
            '<p style="margin-top:4px;">Ajoute tes clients et leurs lignes : les rappels de visite apparaîtront ici.</p>' +
            '<div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
            '<button type="button" class="bouton" data-nouveau-client>+ Ajouter un client</button>' +
            '<a href="Clients.html" class="bouton bouton--contour">Voir les clients</a>' +
            '</div></div>';
    }

    function rendre() {
        const aujourdhui = Donnees.aujourdhuiIso();
        const profil = Donnees.getDonnees().profil;
        const nbClients = Donnees.getDonnees().clients.length;
        const { lignes, horsCampagne, sansLigne } = Donnees.calculerEcheances(aujourdhui);

        const compte = { retard: 0, jamais: 0, bientot: 0, ok: 0 };
        lignes.forEach(e => { compte[e.statut]++; });

        const visibles = lignes.filter(e =>
            filtre === "a-faire" ? e.statut !== "ok" : e.statut === filtre);

        /* Regroupement par client, dans l'ordre de priorité déjà calculé. */
        const groupes = [];
        visibles.forEach(e => {
            let g = groupes.find(x => x.client.id === e.client.id);
            if (!g) { g = { client: e.client, echeances: [] }; groupes.push(g); }
            g.echeances.push(e);
        });

        const limite = Donnees.ajouterJours(aujourdhui, 14);
        /* Rendez-vous confirmés à venir ; les propositions et les visites à
           clôturer ont leur propre section. */
        const confirmesAVenir = Donnees.listerRdv().filter(r => !Donnees.estPropose(r) && r.date >= aujourdhui);
        const rdvs = confirmesAVenir.filter(r => r.date <= limite);
        const autresRdv = confirmesAVenir.length - rdvs.length;
        const proposes = Donnees.listerRdv().filter(Donnees.estPropose);
        const aCloturer = Donnees.rdvACloturer(aujourdhui);

        /* Tournée proposée : encart court, la gestion complète est dans
           l'onglet « Tournée ». */
        const blocTournee = nbClients === 0 || proposes.length === 0 ? "" :
            '<a href="Tournee.html" class="carte encart-tournee">' +
            '<span class="encart-tournee-icone" aria-hidden="true">🤖</span>' +
            '<span style="min-width:0;flex:1;"><strong>' + proposes.length + ' visite' + (proposes.length > 1 ? "s" : "") + ' proposée' + (proposes.length > 1 ? "s" : "") + ' à confirmer</strong>' +
            '<span class="texte-attenue" style="display:block;font-size:0.8rem;">du ' + Formulaires.dateFr(proposes[0].date) + ' au ' + Formulaires.dateFr(proposes[proposes.length - 1].date) + '</span></span>' +
            '<span class="bouton bouton--petit">Voir la tournée ›</span></a>';

        /* Rendez-vous passés à clôturer : une question, trois réponses. */
        const blocCloture = aCloturer.length === 0 ? "" :
            '<div class="section-entete" style="margin-top:20px;"><h2 class="section-titre">❓ Visites à clôturer</h2></div>' +
            '<div class="carte" style="padding:0;">' + aCloturer.map(r => {
                const c = Donnees.getClient(r.clientId);
                return '<div class="ligne-cloture">' +
                    '<div style="min-width:0;flex:1;">La visite chez <strong>' + esc(c ? c.nom : "?") + '</strong> du ' + Formulaires.dateFr(r.date) +
                    (r.heure ? " à " + esc(r.heure) : "") + ' a-t-elle eu lieu ? ' + Formulaires.pastilleType(r.type) + '</div>' +
                    '<div class="apercu-actions">' +
                    '<button type="button" class="bouton bouton--petit" data-rdv-faite="' + esc(r.id) + '">Oui</button>' +
                    '<button type="button" class="bouton bouton--petit bouton--contour" data-rdv-reporter="' + esc(r.id) + '">Reporter</button>' +
                    '<button type="button" class="bouton bouton--petit bouton--fantome" data-rdv-non-effectuee="' + esc(r.id) + '">Non effectuée</button>' +
                    '</div></div>';
            }).join("") + '</div>';

        /* Bandeau « à faire » en tête de page. */
        const aFaire = [];
        if (proposes.length) aFaire.push(proposes.length + " visite" + (proposes.length > 1 ? "s" : "") + " proposée" + (proposes.length > 1 ? "s" : "") + " à confirmer");
        if (aCloturer.length) aFaire.push(aCloturer.length + " visite" + (aCloturer.length > 1 ? "s" : "") + " à clôturer");
        if (rappelSauvegarde()) aFaire.push("pense à exporter une sauvegarde (Réglages)");
        const bandeau = aFaire.length ? '<div class="bandeau-a-faire" role="status">🔔 ' + esc(aFaire.join(" · ")) + '</div>' : "";

        const blocRdv = nbClients === 0 ? "" :
            '<div class="section-entete" style="margin-top:20px;"><h2 class="section-titre">📅 Rendez-vous confirmés</h2>' +
            '<button type="button" class="bouton bouton--petit bouton--contour" data-nouveau-rdv>+ Planifier</button></div>' +
            (rdvs.length === 0
                ? '<div class="etat-vide" style="padding:16px;">Aucun rendez-vous dans les 14 prochains jours.' +
                (autresRdv ? " " + autresRdv + " plus tard (voir le Planning)." : "") + '</div>'
                : '<div class="carte" style="padding:0;">' + rdvs.map(r => Formulaires.carteRdv(r, true)).join("") + '</div>' +
                (autresRdv ? '<p class="aide-champ">+ ' + autresRdv + ' rendez-vous plus tard, visibles dans le Planning.</p>' : ""));

        const dateLongue = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

        let liste;
        if (nbClients === 0) {
            liste = etatVideSansClient();
        } else if (lignes.length === 0) {
            liste = '<div class="etat-vide">Aucune ligne à suivre chez un client en campagne aujourd\'hui.</div>';
        } else if (groupes.length === 0) {
            liste = '<div class="etat-vide">' + (filtre === "a-faire"
                ? "🎉 Rien en attente : toutes les lignes suivies sont à jour."
                : "Aucune ligne dans cette catégorie.") + '</div>';
        } else {
            liste = '<div class="grille-a-visiter">' + groupes.map(g => carteClient(g.client, g.echeances)).join("") + '</div>';
        }

        conteneur.innerHTML =
            '<div class="entete-page">' +
            '<div>' +
            '<h1 class="titre-page">Bonjour ' + esc(profil.nom.split(" ")[0]) + '</h1>' +
            '<p class="texte-attenue" style="font-size:0.85rem;">' + esc(dateLongue.charAt(0).toUpperCase() + dateLongue.slice(1)) + '</p>' +
            '</div>' +
            (nbClients > 0 ? '<button type="button" class="bouton" data-nouvelle-visite>✅ Enregistrer une visite</button>' : "") +
            '</div>' +

            (nbClients > 0
                ? '<div class="grille-metriques">' +
                metrique("retard", compte.retard) + metrique("jamais", compte.jamais) +
                metrique("bientot", compte.bientot) + metrique("ok", compte.ok) +
                '</div>'
                : "") +

            bandeau +
            blocCloture +
            blocTournee +
            blocRdv +

            '<div class="section-entete" style="margin-top:20px;">' +
            '<h2 class="section-titre">📋 ' + (filtre === "a-faire" ? "À visiter" : esc(STATUTS[filtre].libelle)) + '</h2>' +
            (filtre !== "a-faire" ? '<button type="button" class="texte-lien bouton-texte" data-filtre="a-faire">← Tout ce qui est à faire</button>' : "") +
            '</div>' +
            liste +

            (sansLigne.length > 0
                ? '<div class="carte bloc-sans-ligne">⚠️ ' + sansLigne.length + ' client' + (sansLigne.length > 1 ? "s" : "") +
                ' en campagne sans ligne suivie : ' +
                sansLigne.map(c => '<a href="Client.html?id=' + encodeURIComponent(c.id) + '" class="texte-lien">' + esc(c.nom) + '</a>').join(", ") +
                '</div>'
                : "") +

            (horsCampagne.length > 0
                ? '<details class="carte bloc-hors-campagne">' +
                '<summary><strong>❄️ Hors campagne</strong> <span class="texte-attenue">— ' + horsCampagne.length + ' client' + (horsCampagne.length > 1 ? "s" : "") + '</span></summary>' +
                '<p class="aide-champ">Pas de rappel automatique en dehors de la campagne : la règle du mode maintenance / hiver reste à définir. Tu peux déjà y enregistrer des visites de maintenance.</p>' +
                horsCampagne.map(h =>
                    '<div class="ligne-hors-campagne">' +
                    '<a href="Client.html?id=' + encodeURIComponent(h.client.id) + '" class="texte-lien">' + esc(h.client.nom) + '</a>' +
                    '<span class="texte-attenue">Reprise en ' + esc(Donnees.MOIS[h.client.debutCampagne - 1].toLowerCase()) +
                    ' · ' + h.nbLignes + ' ligne' + (h.nbLignes > 1 ? "s" : "") + '</span></div>').join("") +
                '</details>'
                : "");

        brancher();
    }

    /* Rappel de sauvegarde : aucune exportée depuis 30 jours (sur cet
       appareil) alors qu'il y a des clients. */
    function rappelSauvegarde() {
        if (Donnees.getDonnees().clients.length === 0) return false;
        let derniere = null;
        try { derniere = localStorage.getItem("acsc_derniere_sauvegarde"); } catch (e) { derniere = null; }
        return !derniere || Donnees.ecartJours(derniere, Donnees.aujourdhuiIso()) > 30;
    }

    function brancher() {

        conteneur.querySelectorAll("[data-filtre]").forEach(b => b.addEventListener("click", () => {
            const f = b.getAttribute("data-filtre");
            filtre = (filtre === f && f !== "a-faire") ? "a-faire" : f;
            rendre();
        }));
        conteneur.querySelectorAll("[data-visite]").forEach(b => b.addEventListener("click", () =>
            Formulaires.visite({ ligneId: b.getAttribute("data-visite") })));
        Formulaires.brancherRdv(conteneur);
        conteneur.querySelectorAll("[data-rdv-pastille]").forEach(b => b.addEventListener("click", () => Formulaires.detailRdv(b.getAttribute("data-rdv-pastille"))));
        conteneur.querySelectorAll("[data-apercu-client]").forEach(carte => {
            const ouvrir = (ev) => {
                if (ev.target.closest("button, a")) return;
                Formulaires.apercuClient(carte.getAttribute("data-apercu-client"));
            };
            carte.addEventListener("click", ouvrir);
            carte.addEventListener("keydown", (ev) => { if ((ev.key === "Enter" || ev.key === " ") && ev.target === carte) { ev.preventDefault(); ouvrir(ev); } });
        });
        const nr = conteneur.querySelector("[data-nouveau-rdv]");
        if (nr) nr.addEventListener("click", () => Formulaires.rdv());
        const nv = conteneur.querySelector("[data-nouvelle-visite]");
        if (nv) nv.addEventListener("click", () => Formulaires.visite());
        const nc = conteneur.querySelector("[data-nouveau-client]");
        if (nc) nc.addEventListener("click", () => Formulaires.client(null, (c) => {
            window.location.href = "Client.html?id=" + encodeURIComponent(c.id);
        }));
    }

    Donnees.ecouter(rendre);
    rendre();
    /* Propositions automatiques : une fois par semaine, le jour choisi. */
    if (Donnees.propositionsAFaire()) Formulaires.proposerTournee(true);
})();
