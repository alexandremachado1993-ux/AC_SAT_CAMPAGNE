/* =============================================================
   Clients.js — Liste des clients (Clients.html)
   Recherche, filtres campagne, accès à la fiche.
   Import / export Excel : EchangesExcel.js.
   ============================================================= */

(() => {
    "use strict";

    const esc = (t) => AppLayout.escapeHtml(t);
    const conteneur = document.getElementById("contenu-page");
    const etat = { recherche: "", filtre: "tous" };

    function resume(client, aujourdhui) {
        const lignes = Donnees.lignesDuClient(client.id);
        const visites = Donnees.visitesDuClient(client.id);
        return {
            enCampagne: Donnees.estEnCampagne(client, aujourdhui),
            nbLignes: lignes.length,
            nbContacts: Donnees.contactsDuClient(client.id).length,
            derniere: visites[0] || null
        };
    }

    function correspond(client, texte) {
        if (!texte) return true;
        const cible = Donnees.normaliserTexte([client.nom, client.groupe, client.ville, client.codePostal,
            client.typeProduction].join(" "));
        return texte.split(/\s+/).every(mot => cible.indexOf(mot) !== -1);
    }

    function puce(valeur, tonalite, libelle, nb) {
        return '<button type="button" class="puce-filtre ' + tonalite + (etat.filtre === valeur ? " actif" : "") + '" data-filtre="' + valeur + '">' +
            esc(libelle) + ' <span class="puce-compteur">' + nb + '</span></button>';
    }

    function carte(client, r) {
        const periode = Donnees.MOIS[client.debutCampagne - 1].slice(0, 3) + ". → " + Donnees.MOIS[client.finCampagne - 1].slice(0, 3) + ".";
        const badge = client.actif === false
            ? '<span class="badge-statut" style="background:var(--attenue-texte);">Inactif</span>'
            : r.enCampagne
                ? '<span class="badge-statut badge-statut--ok">En campagne</span>'
                : '<span class="badge-statut" style="background:#0ea5e9;">Hors campagne</span>';
        return '<a href="Client.html?id=' + encodeURIComponent(client.id) + '" class="carte carte-client-campagne">' +
            '<div class="carte-client-campagne-entete">' +
            '<span class="carte-client-campagne-nom">' + esc(client.nom) + '</span>' + badge +
            '</div>' +
            '<div class="texte-attenue carte-client-campagne-ligne">📍 ' + esc([client.codePostal, client.ville].filter(Boolean).join(" ") || "—") +
            (client.typeProduction ? ' · ' + esc(client.typeProduction) : "") + '</div>' +
            '<div class="texte-attenue carte-client-campagne-ligne">📆 ' + periode + ' · tous les ' + client.cadenceJours + ' j</div>' +
            '<div class="carte-client-campagne-pied">' +
            '<span>🏭 ' + r.nbLignes + ' ligne' + (r.nbLignes > 1 ? "s" : "") + '</span>' +
            '<span>👤 ' + r.nbContacts + '</span>' +
            '<span class="texte-attenue">' + (r.derniere ? "Dernière visite " + Formulaires.dateFr(r.derniere.date) : "Jamais visité") + '</span>' +
            '</div></a>';
    }

    function rendre() {
        const aujourdhui = Donnees.aujourdhuiIso();
        const tous = Donnees.listerClients().map(c => ({ c, r: resume(c, aujourdhui) }));

        const compte = { tous: tous.length, campagne: 0, hors: 0, inactifs: 0 };
        tous.forEach(({ c, r }) => {
            if (c.actif === false) compte.inactifs++;
            else if (r.enCampagne) compte.campagne++;
            else compte.hors++;
        });

        const texte = Donnees.normaliserTexte(etat.recherche);
        const visibles = tous.filter(({ c, r }) => {
            if (!correspond(c, texte)) return false;
            if (etat.filtre === "campagne") return c.actif !== false && r.enCampagne;
            if (etat.filtre === "hors") return c.actif !== false && !r.enCampagne;
            if (etat.filtre === "inactifs") return c.actif === false;
            return true;
        });

        const actif = document.activeElement && document.activeElement.id === "champ-recherche";

        conteneur.innerHTML =
            '<div class="entete-page">' +
            '<div><h1 class="titre-page">Clients</h1>' +
            '<p class="texte-attenue" style="font-size:0.85rem;">' + visibles.length + ' résultat' + (visibles.length > 1 ? "s" : "") + '</p></div>' +
            '<div class="actions-page">' +
            '<div class="bouton-avec-lien">' +
            '<button type="button" class="bouton bouton--contour" data-importer>📥 Importer Excel</button>' +
            '<a href="Modeles/Modele_Import_Visites_Campagne.xlsx" download class="lien-modele">⬇ modèle</a>' +
            '</div>' +
            '<button type="button" class="bouton bouton--contour" data-exporter' + (tous.length === 0 ? " disabled" : "") + '>📤 Exporter</button>' +
            '<button type="button" class="bouton" data-nouveau-client>+ Nouveau client</button>' +
            '</div>' +
            '</div>' +

            (tous.length > 0
                ? '<div class="champ-recherche-conteneur" style="margin-top:12px;">' +
                '<span class="icone-recherche">🔎</span>' +
                '<input type="search" id="champ-recherche" placeholder="Rechercher un client, une ville, un groupe…" value="' + esc(etat.recherche) + '">' +
                '</div>' +
                '<div class="puces-filtre">' +
                puce("tous", "puce--defaut", "Tous", compte.tous) +
                puce("campagne", "puce--vert", "En campagne", compte.campagne) +
                puce("hors", "puce--muted", "Hors campagne", compte.hors) +
                puce("inactifs", "puce--muted", "Inactifs", compte.inactifs) +
                '</div>'
                : "") +

            (tous.length === 0
                ? '<div class="etat-vide" style="margin-top:16px;">👥<br><strong style="color:var(--texte);">Aucun client</strong><br>' +
                'Crée ton premier client, ou importe le modèle Excel rempli.</div>'
                : visibles.length === 0
                    ? '<div class="etat-vide" style="margin-top:12px;">🔎<br>Aucun client ne correspond.</div>'
                    : '<div class="grille-clients-campagne">' + visibles.map(({ c, r }) => carte(c, r)).join("") + '</div>');

        brancher(actif);
    }

    function brancher(remettreFocus) {
        conteneur.querySelector("[data-nouveau-client]").addEventListener("click", () =>
            Formulaires.client(null, (c) => { window.location.href = "Client.html?id=" + encodeURIComponent(c.id); }));

        conteneur.querySelector("[data-importer]").addEventListener("click", EchangesExcel.ouvrirImport);
        conteneur.querySelector("[data-exporter]").addEventListener("click", EchangesExcel.ouvrirExport);

        const champ = document.getElementById("champ-recherche");
        if (champ) {
            champ.addEventListener("input", () => { etat.recherche = champ.value; rendre(); });
            if (remettreFocus) {
                champ.focus();
                champ.setSelectionRange(champ.value.length, champ.value.length);
            }
        }
        conteneur.querySelectorAll("[data-filtre]").forEach(b => b.addEventListener("click", () => {
            etat.filtre = b.getAttribute("data-filtre");
            rendre();
        }));
    }

    Donnees.ecouter(rendre);
    rendre();
})();
