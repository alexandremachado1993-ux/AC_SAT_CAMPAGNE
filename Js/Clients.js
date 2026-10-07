/* =============================================================
   Clients.js — Liste des clients (Clients.html)
   Recherche, filtres campagne, accès à la fiche, sélection de plusieurs
   clients pour les supprimer d'un coup (avec « Annuler »).
   Import / export Excel : EchangesExcel.js.
   ============================================================= */

(() => {
    "use strict";

    const esc = (t) => AppLayout.escapeHtml(t);
    const conteneur = document.getElementById("contenu-page");
    /* technicien : "" = tous, "moi", "aucun" (non attribués) ou l'id d'un membre. */
    const etat = { recherche: "", filtre: "tous", technicien: "" };
    /* Mode sélection : les cartes ne mènent plus à la fiche, elles se cochent. */
    const selection = { actif: false, ids: new Set() };

    function resume(client, aujourdhui) {
        const lignes = Donnees.lignesDuClient(client.id);
        const visites = Donnees.visitesDuClient(client.id);
        return {
            enCampagne: Donnees.estEnCampagne(client, aujourdhui),
            nbLignes: lignes.filter(Donnees.estLigneActive).length,
            nbLignesInactives: lignes.filter(l => !Donnees.estLigneActive(l)).length,
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
            ? '<span class="badge-statut badge-statut--inactif">Inactif</span>'
            : r.enCampagne
                ? '<span class="badge-statut badge-statut--ok">En campagne</span>'
                : '<span class="badge-statut badge-statut--campagne-off">Hors campagne</span>';
        const choisie = selection.ids.has(client.id);
        /* En sélection : élément à cocher (pas de case <input> dans un lien : imbrication invalide). */
        const ouverture = selection.actif
            ? '<div class="carte carte-client-campagne carte--selectionnable' + (choisie ? " carte--choisie" : "") + '" role="checkbox" aria-checked="' + choisie + '" tabindex="0" data-selectionner="' + esc(client.id) + '">' +
            '<span class="case-selection" aria-hidden="true">' + (choisie ? "✓" : "") + '</span>'
            : '<a href="Client.html?id=' + encodeURIComponent(client.id) + '" class="carte carte-client-campagne">';
        return ouverture +
            '<div class="carte-client-campagne-entete">' +
            '<span class="carte-client-campagne-nom">' + esc(client.nom) + '</span>' + badge +
            '</div>' +
            '<div class="texte-attenue carte-client-campagne-ligne">📍 ' + esc([client.codePostal, client.ville].filter(Boolean).join(" ") || "—") +
            (client.typeProduction ? ' · ' + esc(client.typeProduction) : "") + '</div>' +
            '<div class="texte-attenue carte-client-campagne-ligne">📆 ' + periode + ' · tous les ' + client.cadenceJours + ' j</div>' +
            (Formulaires.membresEquipe().length ? '<div class="texte-attenue carte-client-campagne-ligne">👷 ' +
                esc(client.technicien ? Formulaires.nomTechnicien(client.technicien) : "Non attribué") + '</div>' : "") +
            '<div class="carte-client-campagne-pied">' +
            '<span title="Lignes actives' + (r.nbLignesInactives ? " (+ " + r.nbLignesInactives + " inactive(s) ou chez un autre fournisseur)" : "") + '">🏭 ' +
            r.nbLignes + ' ligne' + (r.nbLignes > 1 ? "s" : "") + (r.nbLignesInactives ? ' <span class="texte-attenue">+' + r.nbLignesInactives + '</span>' : "") + '</span>' +
            '<span>👤 ' + r.nbContacts + '</span>' +
            '<span class="texte-attenue">' + (r.derniere ? "Dernière visite " + Formulaires.dateFr(r.derniere.date) : "Jamais visité") + '</span>' +
            '</div>' + (selection.actif ? '</div>' : '</a>');
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
            const moi = Donnees.getTechnicienCourant();
            if (etat.technicien === "moi" && c.technicien && c.technicien !== moi) return false;
            if (etat.technicien === "aucun" && c.technicien) return false;
            if (etat.technicien && etat.technicien !== "moi" && etat.technicien !== "aucun" && c.technicien !== etat.technicien) return false;
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
            '<button type="button" class="bouton bouton--contour' + (selection.actif ? " actif" : "") + '" data-mode-selection aria-pressed="' + selection.actif + '"' + (tous.length === 0 ? " disabled" : "") + '>' +
            (selection.actif ? "✕ Terminer" : "☑ Sélectionner") + '</button>' +
            '<button type="button" class="bouton" data-nouveau-client>+ Nouveau client</button>' +
            '</div>' +
            '</div>' +

            (tous.length > 0
                ? '<div class="champ-recherche-conteneur" style="margin-top:12px;">' +
                '<span class="icone-recherche">🔎</span>' +
                '<input type="search" id="champ-recherche" autocomplete="off" enterkeyhint="search" placeholder="Client, ville ou groupe…" value="' + esc(etat.recherche) + '">' +
                '</div>' +
                '<div class="puces-filtre">' +
                puce("tous", "puce--defaut", "Tous", compte.tous) +
                puce("campagne", "puce--vert", "En campagne", compte.campagne) +
                puce("hors", "puce--muted", "Hors campagne", compte.hors) +
                puce("inactifs", "puce--muted", "Inactifs", compte.inactifs) +
                (Formulaires.membresEquipe().length
                    ? '<select id="filtre-technicien" class="filtre-technicien" aria-label="Filtrer par technicien">' +
                    [["", "Tous les techniciens"], ["moi", "Mes clients"], ["aucun", "Non attribués"]]
                        .concat(Formulaires.membresEquipe().filter(m => !m.moi).map(m => [m.id, m.nom || "(sans nom)"]))
                        .map(o => '<option value="' + esc(o[0]) + '"' + (o[0] === etat.technicien ? " selected" : "") + '>' + esc(o[1]) + '</option>').join("") +
                    '</select>'
                    : "") +
                '</div>'
                : "") +

            (tous.length === 0
                ? '<div class="etat-vide" style="margin-top:16px;">👥<br><strong style="color:var(--texte);">Aucun client</strong><br>' +
                'Crée ton premier client, ou importe le modèle Excel rempli.</div>'
                : visibles.length === 0
                    ? '<div class="etat-vide" style="margin-top:12px;">🔎<br>Aucun client ne correspond.</div>'
                    : '<div class="grille-clients-campagne">' + visibles.map(({ c, r }) => carte(c, r)).join("") + '</div>') +

            (selection.actif
                ? '<div class="barre-selection" role="region" aria-label="Actions sur la sélection">' +
                '<span class="barre-selection-texte" data-compte-selection></span>' +
                '<button type="button" class="bouton bouton--petit bouton--contour" data-tout-selectionner>Tout sélectionner</button>' +
                '<button type="button" class="bouton bouton--petit bouton--danger-plein" data-supprimer-selection>🗑 Supprimer</button>' +
                '</div>'
                : "");

        /* Les clients supprimés (ici ou sur un autre appareil) quittent la sélection. */
        const existants = new Set(tous.map(({ c }) => c.id));
        selection.ids.forEach(id => { if (!existants.has(id)) selection.ids.delete(id); });
        brancher(actif, visibles.map(({ c }) => c.id));
    }

    /* Met à jour cases, compteur et bouton sans redessiner la liste. */
    function majSelection() {
        conteneur.querySelectorAll("[data-selectionner]").forEach(el => {
            const choisie = selection.ids.has(el.getAttribute("data-selectionner"));
            el.classList.toggle("carte--choisie", choisie);
            el.setAttribute("aria-checked", String(choisie));
            const c = el.querySelector(".case-selection");
            if (c) c.textContent = choisie ? "✓" : "";
        });
        const n = selection.ids.size;
        const compte = conteneur.querySelector("[data-compte-selection]");
        if (compte) compte.textContent = n === 0 ? "Aucun client sélectionné" : n + " sélectionné" + (n > 1 ? "s" : "");
        const bouton = conteneur.querySelector("[data-supprimer-selection]");
        if (bouton) bouton.disabled = n === 0;
    }

    function brancher(remettreFocus, idsVisibles) {
        conteneur.querySelector("[data-nouveau-client]").addEventListener("click", () =>
            Formulaires.client(null, (c) => { window.location.href = "Client.html?id=" + encodeURIComponent(c.id); }));

        conteneur.querySelector("[data-importer]").addEventListener("click", EchangesExcel.ouvrirImport);
        conteneur.querySelector("[data-exporter]").addEventListener("click", EchangesExcel.ouvrirExport);

        conteneur.querySelector("[data-mode-selection]").addEventListener("click", () => {
            selection.actif = !selection.actif;
            selection.ids.clear();
            rendre();
        });
        if (selection.actif) {
            const basculer = (id) => { if (selection.ids.has(id)) selection.ids.delete(id); else selection.ids.add(id); majSelection(); };
            conteneur.querySelectorAll("[data-selectionner]").forEach(el => {
                const id = el.getAttribute("data-selectionner");
                el.addEventListener("click", () => basculer(id));
                el.addEventListener("keydown", (ev) => { if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); basculer(id); } });
            });
            const bTout = conteneur.querySelector("[data-tout-selectionner]");
            if (bTout) bTout.addEventListener("click", () => {
                const tousChoisis = idsVisibles.length > 0 && idsVisibles.every(id => selection.ids.has(id));
                idsVisibles.forEach(id => { if (tousChoisis) selection.ids.delete(id); else selection.ids.add(id); });
                bTout.textContent = tousChoisis ? "Tout sélectionner" : "Tout désélectionner";
                majSelection();
            });
            const bSuppr = conteneur.querySelector("[data-supprimer-selection]");
            if (bSuppr) bSuppr.addEventListener("click", () => Formulaires.supprimerClients([...selection.ids], { apres: (copie) => {
                selection.ids.clear(); selection.actif = false; rendre(); Formulaires.proposerAnnulation(copie);
            } }));
            majSelection();
        }

        const champ = document.getElementById("champ-recherche");
        if (champ) {
            champ.addEventListener("input", () => { etat.recherche = champ.value; rendre(); });
            if (remettreFocus) {
                champ.focus();
                champ.setSelectionRange(champ.value.length, champ.value.length);
            }
        }
        const ft = document.getElementById("filtre-technicien");
        if (ft) ft.addEventListener("change", () => { etat.technicien = ft.value; rendre(); });
        conteneur.querySelectorAll("[data-filtre]").forEach(b => b.addEventListener("click", () => {
            etat.filtre = b.getAttribute("data-filtre");
            rendre();
        }));
    }

    Donnees.ecouter(rendre);
    rendre();
    Formulaires.reprendreAnnulation();
})();
