/* =============================================================
   Tournee.js — Onglet « Tournée » (Tournee.html)

   L'application prépare la tournée des prochains jours (voir
   Donnees.proposerTournee) ; le technicien confirme, déplace ou refuse.
   On y trouve : les propositions par jour, les rendez-vous confirmés à
   venir, et les réglages de la tournée (jours, maximum par jour, heure
   du résumé du matin…).
   ============================================================= */

(() => {
    "use strict";

    const esc = (t) => AppLayout.escapeHtml(t);
    const conteneur = document.getElementById("contenu-page");
    const JOURS_SEMAINE = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

    function libelleJourLong(iso) {
        const [y, m, d] = iso.split("-").map(Number);
        const t = new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        return t.charAt(0).toUpperCase() + t.slice(1);
    }

    function parJour(rdvs) {
        const jours = {};
        rdvs.forEach(r => { (jours[r.date] = jours[r.date] || []).push(r); });
        return Object.keys(jours).sort().map(j => '<div class="tournee-jour">' +
            '<div class="tournee-jour-titre">' + esc(libelleJourLong(j)) + ' · ' + jours[j].length + ' client' + (jours[j].length > 1 ? "s" : "") + '</div>' +
            '<div class="carte" style="padding:0;">' + jours[j].map(r => Formulaires.carteRdv(r, true)).join("") + '</div></div>').join("");
    }

    /* ---------- Réglages de la tournée ---------- */

    const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    const JOURS_LONGS = ["Jamais (à la demande)", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

    function carteTournee() {
        const t = Donnees.getTournee();
        const opt = (valeurs, choisie) => valeurs.map(v => '<option value="' + v[0] + '"' + (String(v[0]) === String(choisie) ? " selected" : "") + '>' + esc(v[1]) + '</option>').join("");
        return '<div class="carte" id="carte-tournee"><h2 class="carte-titre">⚙️ Réglages de la tournée</h2>' +
            '<form id="form-tournee" novalidate>' +
            '<label>Jours travaillés</label><div class="choix-jours">' + JOURS.map((j, i) =>
                '<label class="choix-statut-option"><input type="checkbox" name="rt-jour" value="' + (i + 1) + '"' + (t.jours.indexOf(i + 1) !== -1 ? " checked" : "") + '><span>' + j + '</span></label>').join("") + '</div>' +
            '<div class="grille-2-colonnes">' +
            '<div><label for="rt-max">Clients par jour (maximum)</label><select id="rt-max">' + opt([1, 2, 3, 4, 5, 6, 7, 8].map(n => [n, n]), t.maxParJour) + '</select></div>' +
            '<div><label for="rt-horizon">Proposer sur</label><select id="rt-horizon">' + opt([[7, "1 semaine"], [14, "2 semaines"], [21, "3 semaines"], [28, "4 semaines"]], t.horizon) + '</select></div>' +
            '<div><label for="rt-heure">Premier rendez-vous à</label><input type="time" id="rt-heure" value="' + esc(t.heureDebut) + '"></div>' +
            '<div><label for="rt-ecart">Écart entre deux clients</label><select id="rt-ecart">' + opt([[1, "1 h"], [2, "2 h"], [3, "3 h"], [4, "4 h"]], t.ecartHeures) + '</select></div>' +
            '</div>' +
            '<div class="grille-2-colonnes">' +
            '<div><label for="rt-auto">Propositions refaites le</label><select id="rt-auto">' + opt(JOURS_LONGS.map((j, i) => [i, j]), t.jourAuto) + '</select></div>' +
            '<div><label for="rt-rappel">Résumé du matin (notification) à</label><input type="time" id="rt-rappel" value="' + esc(t.heureRappel) + '"></div>' +
            '<div><label for="rt-bilan">Bilan de fin de campagne : me le rappeler</label><select id="rt-bilan">' +
                opt([[0, "Jamais"], [2, "2 semaines avant la fin"], [4, "4 semaines avant la fin"], [6, "6 semaines avant la fin"], [8, "8 semaines avant la fin"], [12, "12 semaines avant la fin"]], t.bilanSemaines) + '</select></div>' +
            '</div>' +
            '<label class="champ-case"><input type="checkbox" id="rt-departement"' + (t.unDepartement ? " checked" : "") + '> Un seul département par jour (moins de route)</label>' +
            '<label class="champ-case"><input type="checkbox" id="rt-message"' + (t.messageClient ? " checked" : "") + '> Proposer un SMS / email au client à la confirmation</label>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
            '<button type="submit" class="bouton bouton--petit">Enregistrer</button>' +
            '</div></form></div>';
    }

    function brancherTournee() {
        const form = document.getElementById("form-tournee");
        if (!form) return;
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const jours = Array.prototype.map.call(form.querySelectorAll('input[name="rt-jour"]:checked'), el => Number(el.value));
            if (!jours.length) { AppLayout.toast("Coche au moins un jour travaillé"); return; }
            Donnees.definirTournee({
                jours, maxParJour: document.getElementById("rt-max").value, horizon: document.getElementById("rt-horizon").value,
                heureDebut: document.getElementById("rt-heure").value, ecartHeures: document.getElementById("rt-ecart").value,
                jourAuto: document.getElementById("rt-auto").value, heureRappel: document.getElementById("rt-rappel").value, bilanSemaines: document.getElementById("rt-bilan").value,
                unDepartement: document.getElementById("rt-departement").checked, messageClient: document.getElementById("rt-message").checked
            });
            AppLayout.toastSucces("Réglages de tournée enregistrés ✓");
        });
        conteneur.querySelector("[data-agenda-tout]").addEventListener("click", () => {
            const rdvs = Donnees.listerRdv().filter(r => !Donnees.estPropose(r) && r.date >= Donnees.aujourdhuiIso());
            if (!rdvs.length) { AppLayout.toast("Aucun rendez-vous confirmé à venir"); return; }
            Formulaires.telechargerIcs(rdvs, "visites-ac-sat.ics");
            AppLayout.toastSucces(rdvs.length + " rendez-vous exportés ✓ — ouvre le fichier pour les ajouter à ton agenda");
        });
    }


    function rendre() {
        const aujourdhui = Donnees.aujourdhuiIso();
        const t = Donnees.getTournee();
        const proposes = Donnees.listerRdv().filter(Donnees.estPropose);
        const confirmes = Donnees.listerRdv().filter(r => !Donnees.estPropose(r) && r.date >= aujourdhui)
            .filter(r => r.date <= Donnees.ajouterJours(aujourdhui, t.horizon));
        const aucunClient = Donnees.getDonnees().clients.length === 0;
        const prochaine = t.jourAuto
            ? "Prochaines propositions automatiques : " + JOURS_SEMAINE[t.jourAuto] + (t.derniereGeneration ? " (dernières le " + Formulaires.dateFr(t.derniereGeneration) + ")" : "")
            : "Propositions uniquement à la demande";

        conteneur.innerHTML =
            '<div class="entete-page">' +
            '<div><h1 class="titre-page">Tournée</h1>' +
            '<p class="texte-attenue" style="font-size:0.85rem;">L\'application prépare, tu confirmes · ' + esc(prochaine) + '</p></div>' +
            '<div class="actions-page">' +
            '<button type="button" class="bouton bouton--contour" data-proposer-tournee' + (aucunClient ? " disabled" : "") + '>↻ ' +
            (proposes.length ? "Refaire les propositions" : "Proposer ma tournée") + '</button>' +
            (proposes.length ? '<button type="button" class="bouton" data-tout-confirmer>✓ Tout confirmer (' + proposes.length + ')</button>' : "") +
            '</div></div>' +

            '<div class="section-entete" style="margin-top:20px;"><h2 class="section-titre">🤖 À confirmer</h2></div>' +
            (proposes.length === 0
                ? '<div class="etat-vide" style="padding:16px;">' + (aucunClient ? "Ajoute d'abord tes clients et leurs lignes."
                    : "Aucune proposition en attente. Appuie sur « Proposer ma tournée » ou attends le " + esc(JOURS_SEMAINE[t.jourAuto] || "jour choisi") + ".") + '</div>'
                : parJour(proposes)) +

            '<div class="section-entete" style="margin-top:20px;"><h2 class="section-titre">📅 Confirmés sur les ' + t.horizon + ' prochains jours</h2>' +
            '<button type="button" class="bouton bouton--petit bouton--contour" data-agenda-tout>📅 Ajouter à mon agenda (.ics)</button></div>' +
            (confirmes.length === 0 ? '<div class="etat-vide" style="padding:16px;">Aucun rendez-vous confirmé sur la période.</div>' : parJour(confirmes)) +

            '<div style="margin-top:20px;">' + carteTournee() + '</div>';

        brancher();
    }

    function brancher() {
        Formulaires.brancherRdv(conteneur);
        const bp = conteneur.querySelector("[data-proposer-tournee]");
        if (bp) bp.addEventListener("click", () => Formulaires.proposerTournee(false));
        const bt = conteneur.querySelector("[data-tout-confirmer]");
        if (bt) bt.addEventListener("click", () => Formulaires.apresConfirmation(Donnees.confirmerTousLesRdv()));
        brancherTournee();
    }

    Donnees.ecouter(rendre);
    rendre();
    if (Donnees.propositionsAFaire()) Formulaires.proposerTournee(true);
})();
