/* =============================================================
   Planning.js — Planning d'interventions (Planning.html)

   Deux vues de l'année :
     - Timeline (par défaut) : une piste par client (ou par ligne), les
       visites posées à leur date, reliées entre elles, puis la suite
       prévue : rendez-vous (violet), prochaine échéance (orange) ou
       retard (rouge, à aujourd'hui) ;
     - Mois : la grille par mois (détail ci-dessous).

   Une ligne par client (et, en option, par ligne de production),
   une colonne par semaine ou par mois. Chaque case montre :
     ● vert  visites de campagne      ● bleu  visites de maintenance
     ● gris  autres types (homologation, essai, réunion…)
     ○       prochaine échéance        !       retard (semaine en cours)
     ◆       rendez-vous planifié
     fond    période de campagne du client
   Filtres : client, recherche, région, département, production,
   type de visite, inactifs. Synthèse et export du compte rendu
   (Excel ou CSV) sur exactement ce qui est filtré.
   ============================================================= */

(() => {
    "use strict";

    const esc = (t) => AppLayout.escapeHtml(t);
    const conteneur = document.getElementById("contenu-page");
    const MOIS_COURTS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

    /* technicien : "moi" par défaut (en équipe : mes clients et les non
       attribués), "" = tous, "aucun" = non attribués, ou l'id d'un membre.
       Hors équipe, ce filtre ne s'applique pas. */
    const FILTRES_VIDES = { recherche: "", client: "", region: "", departement: "", production: "", typeVisite: "tous", inactifs: false, technicien: "moi" };

    function enEquipe() { return Formulaires.membresEquipe().length > 0; }

    function filtreTechnicien(c, valeur) {
        if (!enEquipe() || !valeur) return true;
        if (valeur === "moi") return Donnees.estMonClient(c);
        if (valeur === "aucun") return !c.technicien;
        return c.technicien === valeur;
    }
    const etat = {
        annee: new Date().getFullYear(),
        vue: "timeline",   // "timeline" | "mois"
        detailLignes: false,
        filtresOuverts: window.innerWidth >= 768,
        filtres: Object.assign({}, FILTRES_VIDES)
    };

    /* ---------- Périodes (colonnes) ---------- */

    function iso(d) { return Donnees.aujourdhuiIso(d); }

    function semaineIso(dateIso) {
        const [y, m, d] = dateIso.split("-").map(Number);
        const t = new Date(Date.UTC(y, m - 1, d));
        const jour = t.getUTCDay() || 7;
        t.setUTCDate(t.getUTCDate() + 4 - jour);
        const debutAnnee = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
        return Math.ceil(((t - debutAnnee) / 86400000 + 1) / 7);
    }

    function periodes(annee) {
        const liste = [];
        for (let m = 0; m < 12; m++) {
            const debut = iso(new Date(annee, m, 1));
            const fin = iso(new Date(annee, m + 1, 0));
            liste.push({ debut, fin, libelle: MOIS_COURTS[m], mois: m, ref: annee + "-" + String(m + 1).padStart(2, "0") + "-15" });
        }
        return liste;
    }

    function indexPeriode(liste, dateIso) {
        for (let i = 0; i < liste.length; i++) if (dateIso >= liste[i].debut && dateIso <= liste[i].fin) return i;
        return -1;
    }

    /* ---------- Filtres ---------- */

    function clientsFiltres() {
        const f = etat.filtres;
        const texte = Donnees.normaliserTexte(f.recherche);
        return Donnees.listerClients().filter(c => {
            if (!f.inactifs && c.actif === false) return false;
            if (f.client && c.id !== f.client) return false;
            const e = Departements.emplacement(c);
            if (f.region && e.region !== f.region) return false;
            if (f.departement && e.departement !== f.departement) return false;
            if (f.production && (c.typeProduction || "") !== f.production) return false;
            if (!filtreTechnicien(c, f.technicien)) return false;
            if (texte) {
                const cible = Donnees.normaliserTexte([c.nom, c.groupe, c.ville, c.codePostal].join(" "));
                if (!texte.split(/\s+/).every(m => cible.indexOf(m) !== -1)) return false;
            }
            return true;
        });
    }

    function visitesFiltrees(clients, annee) {
        const ids = new Set(clients.map(c => c.id));
        const t = etat.filtres.typeVisite;
        return Donnees.listerVisites().filter(v => ids.has(v.clientId) && v.date.slice(0, 4) === String(annee) &&
            (t === "tous" || v.type === t));
    }

    /* Visites qui n'ont PAS eu lieu (reportées, non effectuées, annulées) : listées dans le compte
       rendu avec leur motif, jamais comptées dans les chiffres. */
    function visitesSansSuite(clients, annee) {
        const ids = new Set(clients.map(c => c.id));
        const t = etat.filtres.typeVisite;
        return Donnees.getDonnees().visites.filter(v => !Donnees.estEffectuee(v) && ids.has(v.clientId) && v.date.slice(0, 4) === String(annee) &&
            (t === "tous" || v.type === t)).sort((a, b) => a.date.localeCompare(b.date));
    }

    function nbFiltresActifs() {
        const f = etat.filtres;
        return ["recherche", "client", "region", "departement", "production"].filter(k => f[k]).length +
            (f.typeVisite !== "tous" ? 1 : 0) + (f.inactifs ? 1 : 0) + (enEquipe() && f.technicien !== "moi" ? 1 : 0);
    }

    function libelleFiltres() {
        const f = etat.filtres, morceaux = [];
        if (f.client) { const c = Donnees.getClient(f.client); if (c) morceaux.push("Client : " + c.nom); }
        if (f.recherche) morceaux.push("Recherche : " + f.recherche);
        if (f.region) morceaux.push("Région : " + f.region);
        if (f.departement) morceaux.push("Département : " + f.departement);
        if (f.production) morceaux.push("Production : " + f.production);
        if (f.typeVisite !== "tous") morceaux.push("Visites : " + Donnees.typeVisite(f.typeVisite).libelle);
        if (f.inactifs) morceaux.push("Inactifs inclus");
        if (enEquipe()) morceaux.push("Technicien : " + (f.technicien === "moi" ? "mes clients" : f.technicien === "aucun" ? "non attribués"
            : f.technicien ? Formulaires.nomTechnicien(f.technicien) : "tous"));
        return morceaux.length ? morceaux.join(" · ") : "Aucun";
    }

    /* ---------- Calcul du planning ---------- */

    function construire() {
        const annee = etat.annee;
        const cols = periodes(annee);
        const clients = clientsFiltres();
        const visites = visitesFiltrees(clients, annee);
        const aujourdhui = Donnees.aujourdhuiIso();
        const iAujourdhui = aujourdhui.slice(0, 4) === String(annee) ? indexPeriode(cols, aujourdhui) : -1;

        /* Échéances : seulement pour l'année en cours, c'est de la prévision. */
        const echeances = iAujourdhui === -1 ? [] :
            Donnees.calculerEcheances(aujourdhui).lignes.filter(e => clients.some(c => c.id === e.client.id));

        const vide = () => cols.map(() => ({ campagne: 0, maintenance: 0, autres: 0, echeance: false, retard: false, visites: [], rdv: [] }));
        /* Campagne et maintenance ont leur propre couleur ; les autres types
           (homologation, essai, réunion…) sont regroupés. */
        const famille = (type) => (type === "campagne" || type === "maintenance") ? type : "autres";
        const idsClients = new Set(clients.map(c => c.id));
        const t = etat.filtres.typeVisite;
        const rdvs = Donnees.listerRdv().filter(r => idsClients.has(r.clientId) && r.date.slice(0, 4) === String(annee) &&
            (t === "tous" || r.type === t));
        const rangees = [];

        clients.forEach(client => {
            const lignes = Donnees.lignesDuClient(client.id);
            const rClient = { type: "client", client, cellules: vide(), total: { campagne: 0, maintenance: 0, autres: 0 } };
            const rLignes = {};
            lignes.forEach(l => { rLignes[l.id] = { type: "ligne", client, ligne: l, cellules: vide(), total: { campagne: 0, maintenance: 0, autres: 0 } }; });

            visites.filter(v => v.clientId === client.id).forEach(v => {
                const i = indexPeriode(cols, v.date);
                if (i === -1) return;
                [rClient, rLignes[v.ligneId]].forEach(r => {
                    if (!r) return;
                    r.cellules[i][famille(v.type)]++;
                    r.cellules[i].visites.push(v);
                    r.total[famille(v.type)]++;
                });
            });

            rdvs.filter(r => r.clientId === client.id).forEach(r => {
                const i = indexPeriode(cols, r.date);
                if (i === -1) return;
                rClient.cellules[i].rdv.push(r);
                (r.ligneIds || []).forEach(id => { if (rLignes[id]) rLignes[id].cellules[i].rdv.push(r); });
            });

            echeances.filter(e => e.client.id === client.id).forEach(e => {
                [rClient, rLignes[e.ligne.id]].forEach(r => {
                    if (!r) return;
                    if (e.statut === "retard" || e.statut === "jamais") r.cellules[iAujourdhui].retard = true;
                    else if (e.echeance && e.echeance.slice(0, 4) === String(annee)) {
                        const i = indexPeriode(cols, e.echeance);
                        if (i !== -1) r.cellules[i].echeance = true;
                    }
                });
            });

            rangees.push(rClient);
            /* Détail par ligne : lignes actives, plus les autres si elles ont
               des visites sur l'année affichée (l'historique reste visible). */
            if (etat.detailLignes) lignes.forEach(l => {
                if (Donnees.estLigneActive(l) || rLignes[l.id].cellules.some(c => c.visites.length)) rangees.push(rLignes[l.id]);
            });
        });

        return { annee, cols, clients, visites, rdvs, rangees, iAujourdhui, echeances, aujourdhui };
    }

    /* ---------- Rendu de la grille ---------- */

    function cellule(r, c, i, col, iAujourdhui) {
        const enCampagne = Donnees.estEnCampagne(r.client, col.ref) && r.client.actif !== false;
        const classes = ["pl-cellule"];
        if (enCampagne) classes.push("pl-cellule--campagne");
        if (i === iAujourdhui) classes.push("pl-cellule--aujourdhui");
        const n = c.visites.length;
        const cliquable = n > 0 || c.rdv.length > 0;
        if (cliquable) classes.push("pl-cellule--cliquable");
        const aVenir = !cliquable && col.fin >= Donnees.aujourdhuiIso() && planifiable(r);
        if (aVenir) classes.push("pl-cellule--planifiable");

        const contenu =
            (c.campagne ? '<span class="pl-point pl-point--campagne">' + (c.campagne > 1 ? c.campagne : "") + '</span>' : "") +
            (c.maintenance ? '<span class="pl-point pl-point--maintenance">' + (c.maintenance > 1 ? c.maintenance : "") + '</span>' : "") +
            (c.autres ? '<span class="pl-point pl-point--autre">' + (c.autres > 1 ? c.autres : "") + '</span>' : "") +
            (c.retard ? '<span class="pl-retard" title="En retard / pas encore vue">!</span>' : "") +
            (c.rdv.length ? '<span class="pl-rdv" title="Rendez-vous planifié">' + (c.rdv.length > 1 ? c.rdv.length : "") + '</span>' : "") +
            (c.echeance && !n && !c.rdv.length ? '<span class="pl-echeance" title="Prochaine échéance"></span>' : "");

        return '<td class="' + classes.join(" ") + '"' +
            (cliquable ? ' data-rangee="' + (r.type === "ligne" ? "l:" + esc(r.ligne.id) : "c:" + esc(r.client.id)) + '" data-periode="' + i + '"' : "") +
            (aVenir ? ' data-planifier-cellule="' + esc(clePlanif(r)) + '" data-periode="' + i + '"' : "") +
            ' title="' + (aVenir ? "Planifier une visite · " : "") + esc(col.debut === col.fin ? col.debut : Formulaires.dateFr(col.debut) + " → " + Formulaires.dateFr(col.fin)) +
            (n ? " · " + n + " visite" + (n > 1 ? "s" : "") : "") + (c.rdv.length ? " · " + c.rdv.length + " RDV" : "") + '">' + contenu + '</td>';
    }

    function grille(p) {
        const enteteCols = '<tr><th class="pl-entete-rangee">Client / ligne</th>' +
            p.cols.map((c, i) => '<th class="pl-entete-col' + (i === p.iAujourdhui ? " pl-entete-col--aujourdhui" : "") + '">' + c.libelle + '</th>').join("") +
            '<th class="pl-entete-total">Camp.</th><th class="pl-entete-total">Maint.</th><th class="pl-entete-total">Autres</th></tr>';

        const corps = p.rangees.map(r => {
            const e = Departements.emplacement(r.client);
            const libelle = r.type === "client"
                ? '<a href="Client.html?id=' + encodeURIComponent(r.client.id) + '" class="pl-nom-client">' + esc(r.client.nom) + '</a>' +
                '<span class="pl-sous-libelle">' + esc([r.client.ville, e.departement].filter(Boolean).join(" · ")) + '</span>'
                : '<span class="pl-nom-ligne">↳ ' + esc(r.ligne.nom) + '</span>';
            return '<tr class="pl-rangee pl-rangee--' + r.type + '">' +
                '<th class="pl-libelle" scope="row">' + libelle + '</th>' +
                r.cellules.map((c, i) => cellule(r, c, i, p.cols[i], p.iAujourdhui)).join("") +
                '<td class="pl-total">' + (r.total.campagne || "") + '</td><td class="pl-total">' + (r.total.maintenance || "") + '</td>' +
                '<td class="pl-total">' + (r.total.autres || "") + '</td>' +
                '</tr>';
        }).join("");

        const totaux = p.cols.map(c => {
            const n = p.visites.filter(v => v.date >= c.debut && v.date <= c.fin).length;
            return '<td class="pl-total">' + (n || "") + '</td>';
        }).join("");
        const tc = p.visites.filter(v => v.type === "campagne").length;
        const tm = p.visites.filter(v => v.type === "maintenance").length;
        const ta = p.visites.length - tc - tm;

        return '<div class="pl-defilement pl-defilement--grille"><table class="pl-table">' +
            '<thead>' + enteteCols + '</thead>' +
            '<tbody>' + corps + '</tbody>' +
            '<tfoot><tr><th class="pl-libelle" scope="row">Total visites</th>' + totaux +
            '<td class="pl-total">' + (tc || "") + '</td><td class="pl-total">' + (tm || "") + '</td><td class="pl-total">' + (ta || "") + '</td></tr></tfoot>' +
            '</table></div>';
    }

    /* ---------- Timeline ---------- */

    const COULEURS = { campagne: "#16a34a", maintenance: "#0ea5e9", rdv: "#7c3aed", echeance: "#f97316", retard: "#dc2626" };

    function couleurVisite(v) {
        if (v.type === "campagne") return COULEURS.campagne;
        if (v.type === "maintenance") return COULEURS.maintenance;
        return Donnees.typeVisite(v.type).couleur;
    }

    /* Position horizontale (en %) d'une date dans l'année affichée. */
    function positionDans(annee) {
        const debut = Date.UTC(annee, 0, 1);
        const nbJours = (Date.UTC(annee + 1, 0, 1) - debut) / 86400000;
        return (dateIso) => {
            const [y, m, d] = dateIso.split("-").map(Number);
            const x = ((Date.UTC(y, m - 1, d) - debut) / 86400000 + 0.5) / nbJours * 100;
            return Math.min(100, Math.max(0, x));
        };
    }

    /* Périodes de campagne du client dans l'année (une, ou deux si la
       campagne est à cheval sur deux années). */
    function bandesCampagne(client, annee) {
        const debutMois = (m) => annee + "-" + String(m).padStart(2, "0") + "-01";
        const finMois = (m) => iso(new Date(annee, m, 0));
        if (client.debutCampagne <= client.finCampagne) return [[debutMois(client.debutCampagne), finMois(client.finCampagne)]];
        return [[annee + "-01-01", finMois(client.finCampagne)], [debutMois(client.debutCampagne), annee + "-12-31"]];
    }

    function piste(p, r, x) {
        const cleRangee = (r.type === "ligne" ? "l:" + r.ligne.id : "c:" + r.client.id);
        const visites = p.visites.filter(v => r.type === "ligne" ? v.ligneId === r.ligne.id : v.clientId === r.client.id);
        const rdvs = p.rdvs.filter(rd => r.type === "ligne" ? (rd.ligneIds || []).indexOf(r.ligne.id) !== -1 : rd.clientId === r.client.id);
        const ech = p.echeances.filter(e => r.type === "ligne" ? e.ligne.id === r.ligne.id : e.client.id === r.client.id);
        const anneeEnCours = p.iAujourdhui !== -1;
        let html = "";

        if (r.client.actif !== false) {
            bandesCampagne(r.client, p.annee).forEach(([a, b]) => {
                html += '<span class="tl-bande" style="left:' + x(a).toFixed(2) + '%;width:' + (x(b) - x(a)).toFixed(2) + '%;"></span>';
            });
        }
        html += '<span class="tl-base"></span>';
        if (anneeEnCours) html += '<span class="tl-aujourdhui" style="left:' + x(p.aujourdhui).toFixed(2) + '%;"></span>';

        const segment = (a, b, couleur) => {
            if (!a || !b || b <= a) return "";
            return '<span class="tl-segment" style="left:' + x(a).toFixed(2) + '%;width:' + (x(b) - x(a)).toFixed(2) + '%;background:' + couleur + ';"></span>';
        };
        const points = [];

        /* Visites réalisées, reliées entre elles (couleur de la visite d'arrivée). */
        visites.forEach((v, i) => {
            if (i > 0) html += segment(visites[i - 1].date, v.date, couleurVisite(v));
            points.push({ date: v.date, couleur: couleurVisite(v), plein: true,
                titre: Formulaires.dateFr(v.date) + " · " + Donnees.typeVisite(v.type).libelle +
                    (v.ligneId && r.type === "client" ? " · " + ((Donnees.getLigne(v.ligneId) || {}).nom || "") : "") });
        });

        /* Suite prévue : seulement pour l'année en cours. */
        if (anneeEnCours) {
            const derniere = visites.length ? visites[visites.length - 1].date : null;
            const enRetard = ech.some(e => e.statut === "retard" || e.statut === "jamais");
            const depart = derniere || (bandesCampagne(r.client, p.annee).map(bd => bd[0]).filter(d => d <= p.aujourdhui).pop()) || p.annee + "-01-01";
            let curseur = depart;
            if (enRetard) {
                html += segment(depart, p.aujourdhui, COULEURS.retard);
                curseur = p.aujourdhui;
            }
            const aVenir = rdvs.filter(rd => rd.date >= p.aujourdhui);
            aVenir.forEach((rd, i) => {
                if (i === 0) html += segment(curseur, rd.date, COULEURS.rdv);
                points.push({ date: rd.date, couleur: COULEURS.rdv, plein: false,
                    titre: "Rendez-vous le " + Formulaires.dateFr(rd.date) + (rd.heure ? " à " + rd.heure : "") + " · " + Donnees.typeVisite(rd.type).libelle });
            });
            if (aVenir.length) curseur = aVenir[0].date;
            if (!enRetard) {
                const prochaines = ech.filter(e => e.echeance && e.echeance.slice(0, 4) === String(p.annee)).map(e => e.echeance).sort();
                if (prochaines.length) {
                    html += segment(curseur, prochaines[0], COULEURS.echeance);
                    points.push({ date: prochaines[0], couleur: COULEURS.echeance, plein: false, cliquable: false,
                        titre: "Prochaine échéance : " + Formulaires.dateFr(prochaines[0]) });
                }
            } else {
                html += '<span class="tl-alerte" style="left:' + x(p.aujourdhui).toFixed(2) + '%;" title="En retard / pas encore vue cette campagne">!</span>';
            }
        } else {
            rdvs.forEach(rd => points.push({ date: rd.date, couleur: COULEURS.rdv, plein: false,
                titre: "Rendez-vous le " + Formulaires.dateFr(rd.date) }));
        }

        points.forEach(pt => {
            const style = 'left:' + x(pt.date).toFixed(2) + '%;' + (pt.plein ? "background:" + pt.couleur + ";border-color:" + pt.couleur : "border-color:" + pt.couleur);
            html += pt.cliquable === false
                ? '<span class="tl-point tl-point--vide" style="' + style + '" title="' + esc(pt.titre) + '"></span>'
                : '<button type="button" class="tl-point' + (pt.plein ? "" : " tl-point--vide") + '" style="' + style + '" title="' + esc(pt.titre) + '"' +
                ' aria-label="' + esc(pt.titre) + '" data-point="' + esc(cleRangee) + '|' + pt.date + '"></button>';
        });
        return '<div class="tl-piste"' + (planifiable(r) ? ' data-planifier-piste="' + esc(clePlanif(r)) + '"' : "") + '>' + html + '</div>';
    }

    /* Pourcentage de lignes à jour (ni en retard, ni pas encore vues) sur
       la campagne en cours. Ligne seule : son état. */
    function etatRangee(p, r) {
        const finAnnee = p.annee + "-12-31";
        const toutes = (r.type === "ligne" ? Donnees.visitesDeLaLigne(r.ligne.id) : Donnees.visitesDuClient(r.client.id))
            .filter(v => v.date <= finAnnee);
        const derniere = toutes.length ? toutes[0].date : null;
        let badge = '<span class="tl-badge tl-badge--neutre" title="Hors campagne ou aucune ligne suivie">—</span>';
        if (p.iAujourdhui !== -1) {
            const ech = p.echeances.filter(e => r.type === "ligne" ? e.ligne.id === r.ligne.id : e.client.id === r.client.id);
            if (ech.length) {
                const ok = ech.filter(e => e.statut === "ok" || e.statut === "bientot").length;
                const pct = Math.round(ok / ech.length * 100);
                const classe = pct === 100 ? "tl-badge--plein" : pct >= 50 ? "tl-badge--ok" : "tl-badge--alerte";
                badge = '<span class="tl-badge ' + classe + '" title="Lignes à jour : ' + ok + ' sur ' + ech.length + '">' + pct + '%</span>';
            }
        }
        return '<div class="tl-etat">' + badge +
            '<span class="tl-derniere">Dernière visite<br><strong>' + (derniere ? Formulaires.dateFr(derniere) : "—") + '</strong></span></div>';
    }

    function timeline(p) {
        const x = positionDans(p.annee);
        const nbJours = (m) => new Date(p.annee, m + 1, 0).getDate();
        const colonnesMois = MOIS_COURTS.map((_, m) => nbJours(m) + "fr").join(" ");
        const moisCourant = p.iAujourdhui;

        const entete = '<div class="tl-rangee tl-entete">' +
            '<div class="tl-entete-titre">Client</div><div></div>' +
            '<div class="tl-mois" style="grid-template-columns:' + colonnesMois + ';">' +
            MOIS_COURTS.map((m, i) => '<span' + (i === moisCourant ? ' class="tl-mois-courant"' : "") + ' data-court="' + m.charAt(0) + '">' + m + '</span>').join("") +
            '</div><div></div></div>';

        const rangees = p.rangees.map(r => {
            const e = Departements.emplacement(r.client);
            const identite = r.type === "client"
                ? '<div class="tl-client"><a href="Client.html?id=' + encodeURIComponent(r.client.id) + '" class="tl-client-nom">' + esc(r.client.nom) + '</a>' +
                '<span class="tl-client-lieu">' + esc([r.client.ville, e.departement].filter(Boolean).join(" • ")) + '</span>' +
                '<span class="tl-client-lignes" title="Lignes actives">🏭 ' + Donnees.lignesActivesDuClient(r.client.id).length + '</span></div>'
                : '<div class="tl-client tl-client--ligne"><span class="tl-client-nom">↳ ' + esc(r.ligne.nom) + '</span>' +
                '<span class="tl-client-lieu">' + esc(Donnees.estLigneActive(r.ligne)
                    ? (r.ligne.formatHabituel || "")
                    : Donnees.STATUTS_LIGNE.find(st => st.cle === Donnees.statutLigne(r.ligne)).libelle) + '</span></div>';
            return '<div class="tl-rangee tl-rangee--' + r.type + '">' + identite + etatRangee(p, r) + piste(p, r, x) +
                '<a href="Client.html?id=' + encodeURIComponent(r.client.id) + '" class="tl-chevron" aria-label="Ouvrir la fiche de ' + esc(r.client.nom) + '">›</a></div>';
        }).join("");

        return '<div class="tl-defilement"><div class="tl-grille">' + entete + rangees + '</div></div>';
    }

    /* ---------- Chiffres clés (bas de page) ---------- */

    function chiffresCles(p) {
        const realisees = p.visites.length;
        const retard = p.echeances.filter(e => e.statut === "retard" || e.statut === "jamais").length;
        const prochaines = p.echeances.filter(e => (e.statut === "ok" || e.statut === "bientot") &&
            e.echeance && e.echeance.slice(0, 4) === String(p.annee)).length;
        const total = realisees + retard + prochaines;
        const pct = (n) => total ? Math.round(n / total * 100) + "%" : "";
        const bloc = (libelle, valeur, pourcent, couleur, aide) =>
            '<div class="tl-chiffre" title="' + esc(aide) + '"><span class="tl-chiffre-libelle">' + libelle + '</span>' +
            '<span class="tl-chiffre-valeur">' + valeur + (pourcent ? ' <em class="texte-couleur" style="' + Donnees.styleCouleur(couleur) + '">' + pourcent + '</em>' : "") + '</span></div>';
        return '<div class="tl-chiffres">' +
            '<div class="carte tl-chiffres-principaux">' +
            bloc("Total visites prévues", total, "", "", "Réalisées + en retard ou pas encore vues + prochaines échéances de l'année") +
            bloc("Visites réalisées", realisees, pct(realisees), COULEURS.campagne, "Visites enregistrées sur l'année, selon les filtres") +
            bloc("En retard / pas encore vues", retard, pct(retard), COULEURS.retard, "Lignes suivies à voir dès maintenant") +
            bloc("Prochaines échéances", prochaines, pct(prochaines), COULEURS.echeance, "Lignes à jour dont la prochaine visite tombe cette année") +
            '</div>' +
            '<div class="carte tl-periode"><span class="tl-chiffre-libelle">Période affichée</span>' +
            '<strong>Janvier – Décembre ' + p.annee + ' <span aria-hidden="true">📅</span></strong></div>' +
            '</div>';
    }

    /* ---------- Synthèse (compte rendu) ---------- */

    function syntheseParClient(p) {
        return p.clients.map(client => {
            const vs = p.visites.filter(v => v.clientId === client.id);
            const camp = vs.filter(v => v.type === "campagne");
            /* Intervalle moyen entre deux visites de campagne d'une même ligne. */
            const ecarts = [];
            const parLigne = {};
            camp.forEach(v => { (parLigne[v.ligneId] = parLigne[v.ligneId] || []).push(v.date); });
            Object.keys(parLigne).forEach(k => {
                const dates = parLigne[k].sort();
                for (let i = 1; i < dates.length; i++) ecarts.push(Donnees.ecartJours(dates[i - 1], dates[i]));
            });
            const e = Departements.emplacement(client);
            return {
                client, emplacement: e,
                campagne: camp.length,
                maintenance: vs.filter(v => v.type === "maintenance").length,
                autres: vs.filter(v => v.type !== "campagne" && v.type !== "maintenance").length,
                lignesVisitees: new Set(vs.map(v => v.ligneId)).size,
                derniere: vs.length ? vs[vs.length - 1].date : null,
                intervalle: ecarts.length ? Math.round(ecarts.reduce((a, b) => a + b, 0) / ecarts.length) : null
            };
        });
    }

    /* ---------- Export du compte rendu ---------- */

    function donneesExport(p, lignesSynthese) {
        const tc = p.visites.filter(v => v.type === "campagne").length;
        const compteRendu = [
            ["Année", String(p.annee)],
            ["Filtres appliqués", libelleFiltres()],
            ["Exporté le", Formulaires.dateFr(Donnees.aujourdhuiIso())],
            ["Clients concernés", p.clients.length],
            ["Visites de campagne", tc],
            ["Visites de maintenance", p.visites.filter(v => v.type === "maintenance").length],
            ["Autres visites (homologation, essai, réunion…)", p.visites.filter(v => v.type !== "campagne" && v.type !== "maintenance").length],
            ["Clients visités", lignesSynthese.filter(s => s.campagne + s.maintenance + s.autres > 0).length],
            ["Lignes visitées", new Set(p.visites.map(v => v.ligneId)).size]
        ];
        const synth = lignesSynthese.map(s => [s.client.nom, s.client.ville, s.emplacement.departementNom, s.emplacement.region,
            s.client.typeProduction, s.campagne, s.maintenance, s.lignesVisitees, s.derniere, s.intervalle, s.client.cadenceJours, s.autres]);

        const visites = p.visites.concat(visitesSansSuite(p.clients, p.annee)).sort((a, b) => a.date.localeCompare(b.date)).map(v => {
            const c = Donnees.getClient(v.clientId), l = v.ligneId ? Donnees.getLigne(v.ligneId) : null;
            const st = Donnees.infoStatut(Donnees.statutVisite(v));
            const e = Departements.emplacement(c);
            const t = Donnees.typeVisite(v.type);
            const refs = Donnees.REFERENCES.filter(r => (v.references || {})[r.cle]).map(r => r.libelle + " : " + v.references[r.cle]).join(" · ");
            const details = t.champs.filter(ch => (v.details || {})[ch.cle]).map(ch => ch.libelle + " : " + v.details[ch.cle]).join(" · ");
            return [v.date, semaineIso(v.date), MOIS_COURTS[Number(v.date.slice(5, 7)) - 1], c.nom, c.ville, e.departementNom, e.region,
                l ? l.nom : (v.ligneId ? "Ligne supprimée" : "—"), t.libelle, v.format, v.produit, v.remarques, refs, details,
                st.libelle, [v.motif, v.reporteLe ? "reportée au " + Formulaires.dateFr(v.reporteLe) : ""].filter(Boolean).join(" · ")];
        });

        /* Vue éclatée mensuelle : une ligne par ligne de production. */
        const mensuel = [];
        p.clients.forEach(c => Donnees.lignesDuClient(c.id).forEach(l => {
            const parMois = new Array(12).fill(0);
            p.visites.filter(v => v.ligneId === l.id).forEach(v => { parMois[Number(v.date.slice(5, 7)) - 1]++; });
            const total = parMois.reduce((a, b) => a + b, 0);
            mensuel.push([c.nom, l.nom].concat(parMois.map(n => n || null)).concat([total]));
        }));

        return {
            feuilles: [
                { nom: "Compte rendu", colonnes: [{ titre: "Élément", largeur: 26 }, { titre: "Valeur", largeur: 60 }], lignes: compteRendu },
                {
                    nom: "Synthèse par client", colonnes: [
                        { titre: "Client", largeur: 30 }, { titre: "Ville", largeur: 18 }, { titre: "Département", largeur: 24 },
                        { titre: "Région", largeur: 24 }, { titre: "Production", largeur: 18 }, { titre: "Visites campagne", largeur: 12 },
                        { titre: "Visites maintenance", largeur: 12 }, { titre: "Lignes visitées", largeur: 12 },
                        { titre: "Dernière visite", largeur: 14, type: "date" }, { titre: "Intervalle moyen (j)", largeur: 14 },
                        { titre: "Cadence prévue (j)", largeur: 14 }, { titre: "Autres visites", largeur: 12 }], lignes: synth
                },
                {
                    nom: "Planning mensuel", colonnes: [{ titre: "Client", largeur: 30 }, { titre: "Ligne", largeur: 16 }]
                        .concat(MOIS_COURTS.map(m => ({ titre: m, largeur: 7 }))).concat([{ titre: "Total", largeur: 8 }]), lignes: mensuel
                },
                { nom: "Visites", colonnes: COLONNES_VISITES, lignes: visites },
                {
                    nom: "Rendez-vous prévus", colonnes: [
                        { titre: "Date", largeur: 12, type: "date" }, { titre: "Heure", largeur: 8 }, { titre: "Client", largeur: 30 },
                        { titre: "Ville", largeur: 18 }, { titre: "Lignes", largeur: 24 }, { titre: "Type", largeur: 20 }, { titre: "Notes", largeur: 50 }],
                    lignes: p.rdvs.map(r => {
                        const c = Donnees.getClient(r.clientId);
                        return [r.date, r.heure, c.nom, c.ville, (r.ligneIds || []).map(id => (Donnees.getLigne(id) || {}).nom).filter(Boolean).join(", "),
                            Donnees.typeVisite(r.type).libelle, r.notes];
                    })
                }
            ],
            visites
        };
    }

    const COLONNES_VISITES = [
        { titre: "Date", largeur: 12, type: "date" }, { titre: "Semaine", largeur: 9 }, { titre: "Mois", largeur: 8 },
        { titre: "Client", largeur: 30 }, { titre: "Ville", largeur: 18 }, { titre: "Département", largeur: 24 },
        { titre: "Région", largeur: 24 }, { titre: "Ligne", largeur: 16 }, { titre: "Type", largeur: 20 },
        { titre: "Format", largeur: 12 }, { titre: "Produit", largeur: 20 }, { titre: "Remarques", largeur: 50 },
        { titre: "Références", largeur: 50 }, { titre: "Détails", largeur: 50 },
        { titre: "Statut", largeur: 16 }, { titre: "Motif", largeur: 40 }
    ];

    function ouvrirExport(p, lignesSynthese) {
        AppLayout.ouvrirFeuille("bas", "Exporter le compte rendu " + p.annee,
            '<p class="aide-champ" style="margin-top:0;">Filtres appliqués : ' + esc(libelleFiltres()) + '</p>' +
            '<button type="button" class="feuille-action-item" data-cr="xlsx" style="margin-top:10px;">' +
            '<span class="feuille-action-icone">📗</span><span><strong>Excel (.xlsx)</strong><br>' +
            '<span class="texte-attenue" style="font-size:0.78rem;">Compte rendu, synthèse par client, planning mensuel, détail des visites, rendez-vous prévus</span></span></button>' +
            '<button type="button" class="feuille-action-item" data-cr="csv">' +
            '<span class="feuille-action-icone">📄</span><span><strong>CSV</strong><br>' +
            '<span class="texte-attenue" style="font-size:0.78rem;">Détail des visites seul</span></span></button>');

        const d = donneesExport(p, lignesSynthese);
        const base = "compte-rendu-campagne-" + p.annee + "-" + Donnees.aujourdhuiIso();
        document.querySelector('[data-cr="xlsx"]').addEventListener("click", () => {
            Excel.telechargerXlsx(base + ".xlsx", d.feuilles);
            AppLayout.fermerFeuille();
            AppLayout.toast("Compte rendu Excel téléchargé ✓");
        });
        document.querySelector('[data-cr="csv"]').addEventListener("click", () => {
            /* En CSV, la date est laissée au format JJ/MM/AAAA, lisible par Excel FR. */
            Excel.telechargerCsv(base + ".csv", COLONNES_VISITES, d.visites.map(l => [Formulaires.dateFr(l[0])].concat(l.slice(1))));
            AppLayout.fermerFeuille();
            AppLayout.toast("Compte rendu CSV téléchargé ✓");
        });
    }

    /* ---------- Détail d'une case ---------- */

    function ouvrirDetail(p, cle, debut, fin) {
        const [type, id] = cle.split(":");
        const col = { debut, fin };
        const vs = p.visites.filter(v => v.date >= col.debut && v.date <= col.fin &&
            (type === "l" ? v.ligneId === id : v.clientId === id)).reverse();
        const rs = p.rdvs.filter(r => r.date >= col.debut && r.date <= col.fin &&
            (type === "l" ? (r.ligneIds || []).indexOf(id) !== -1 : r.clientId === id));
        if (!vs.length && !rs.length) return;
        const client = Donnees.getClient((vs[0] || rs[0]).clientId);
        AppLayout.ouvrirFeuille("droite", client.nom,
            '<p class="texte-attenue" style="font-size:0.8rem;">' + (col.debut === col.fin ? Formulaires.dateFr(col.debut)
                : Formulaires.dateFr(col.debut) + ' → ' + Formulaires.dateFr(col.fin)) + '</p>' +
            (rs.length ? '<div class="carte" style="padding:0;margin-top:10px;"><div class="bloc-rdv-titre">📅 Rendez-vous</div>' +
                rs.map(r => Formulaires.carteRdv(r, false)).join("") + '</div>' : "") +
            vs.map(v => {
                const l = v.ligneId ? Donnees.getLigne(v.ligneId) : null;
                const complements = Formulaires.texteComplements(v);
                return '<div class="carte" style="margin-top:10px;">' +
                    '<div class="carte-ligne-entete"><strong>' + Formulaires.dateFr(v.date) + ' · ' + esc(l ? l.nom : (v.ligneId ? "Ligne supprimée" : "Visite générale")) + '</strong>' +
                    Formulaires.pastilleType(v.type) + '</div>' +
                    (complements.length ? '<div class="texte-attenue carte-ligne-info">' + complements.map(esc).join("<br>") + '</div>' : "") +
                    ((v.format || v.produit) ? '<div class="texte-attenue carte-ligne-info">📦 ' + esc([v.format, v.produit].filter(Boolean).join(" · ")) + '</div>' : "") +
                    (v.remarques ? '<div class="carte-ligne-notes">' + esc(v.remarques) + '</div>' : "") +
                    '</div>';
            }).join("") +
            (col.fin >= Donnees.aujourdhuiIso() && client.actif !== false
                ? '<button type="button" class="bouton bouton--large" data-detail-planifier style="margin-bottom:10px;">📅 Planifier une visite ici</button>' : "") +
            '<a href="Client.html?id=' + encodeURIComponent(client.id) + '" class="bouton bouton--contour bouton--large">Ouvrir la fiche client</a>');
        const feuille = document.querySelector(".feuille");
        Formulaires.brancherRdv(feuille);
        const bp = feuille.querySelector("[data-detail-planifier]");
        if (bp) bp.addEventListener("click", () => planifierPour(cle, dateDansPeriode(col.debut)));
    }

    /* ---------- Planifier depuis le Planning ----------
       Bouton d'en-tête, clic sur la frise, clic sur une case vide, bouton dans le
       détail d'une case : tous ouvrent le formulaire de rendez-vous déjà rempli
       (client, ligne, date). Une date tombant un jour non travaillé (réglages de la
       Tournée) est décalée au prochain jour travaillé ; le formulaire permet de la
       modifier. Seules les dates à venir (aujourd'hui compris) se planifient. */

    function planifiable(r) {
        return r.client.actif !== false && (r.type === "client" || Donnees.estLigneActive(r.ligne));
    }

    function clePlanif(r) { return (r.type === "ligne" ? "l:" + r.ligne.id : "c:" + r.client.id); }

    /* Première date à proposer pour une période : demain, ou le début de la période si elle est plus loin. */
    function dateDansPeriode(debut) {
        const demain = Donnees.ajouterJours(Donnees.aujourdhuiIso(), 1);
        return Donnees.prochainJourTravaille(debut > demain ? debut : demain);
    }

    function planifierPour(cle, date) {
        const [type, id] = cle.split(":");
        Formulaires.rdv(type === "l" ? { ligneId: id, date } : { clientId: id, date });
    }

    /* Date (AAAA-MM-JJ) sous le pointeur, d'après sa position sur la frise de l'année. */
    function dateSousPointeur(piste, clientX, annee) {
        const r = piste.getBoundingClientRect();
        if (!r.width) return null;
        const nbJours = (Date.UTC(annee + 1, 0, 1) - Date.UTC(annee, 0, 1)) / 86400000;
        const k = Math.min(nbJours - 1, Math.max(0, Math.floor((clientX - r.left) / r.width * nbJours)));
        return { date: Donnees.ajouterJours(annee + "-01-01", k), x: clientX - r.left, largeur: r.width };
    }

    function libelleCourt(iso) {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    }

    /* Frise : un clic à une date à venir planifie ; un repère pointillé montre la date visée. */
    function brancherPistes(p) {
        conteneur.querySelectorAll("[data-planifier-piste]").forEach(piste => {
            const cle = piste.getAttribute("data-planifier-piste");
            let repere = null;
            const masquer = () => { if (repere) repere.hidden = true; piste.classList.remove("tl-piste--planifiable"); };
            piste.addEventListener("mousemove", (ev) => {
                if (ev.target.closest && ev.target.closest("button, a")) { masquer(); return; }
                const v = dateSousPointeur(piste, ev.clientX, p.annee);
                if (!v || v.date < Donnees.aujourdhuiIso()) { masquer(); return; }
                if (!repere) { repere = document.createElement("span"); repere.className = "tl-repere"; repere.setAttribute("aria-hidden", "true"); piste.appendChild(repere); }
                const jour = Donnees.prochainJourTravaille(v.date);
                repere.hidden = false;
                repere.style.left = v.x + "px";
                repere.setAttribute("data-date", "Planifier · " + libelleCourt(jour));
                repere.classList.toggle("tl-repere--gauche", v.x > v.largeur * 0.7);
                piste.classList.add("tl-piste--planifiable");
            });
            piste.addEventListener("mouseleave", masquer);
            piste.addEventListener("click", (ev) => {
                if (ev.target.closest && ev.target.closest("button, a")) return;    // les points gardent leur propre action
                const v = dateSousPointeur(piste, ev.clientX, p.annee);
                if (!v) return;
                if (v.date < Donnees.aujourdhuiIso()) {
                    AppLayout.toast("Cette date est passée : choisis une date à venir (ou « Enregistrer une visite » pour une visite déjà faite).");
                    return;
                }
                planifierPour(cle, Donnees.prochainJourTravaille(v.date));
            });
        });
    }

    /* ---------- Barre de filtres ---------- */

    function options(valeurs, choisie, libelleVide) {
        return '<option value="">' + libelleVide + '</option>' + valeurs.map(v =>
            '<option value="' + esc(v.valeur) + '"' + (v.valeur === choisie ? " selected" : "") + '>' + esc(v.texte) + '</option>').join("");
    }

    function barreFiltres() {
        const f = etat.filtres;
        const tous = Donnees.listerClients().filter(c => f.inactifs || c.actif !== false);
        const uniques = (fn) => {
            const vus = {};
            tous.forEach(c => { const r = fn(c); if (r && r.valeur) vus[r.valeur] = r; });
            return Object.keys(vus).map(k => vus[k]).sort((a, b) => a.texte.localeCompare(b.texte, "fr", { numeric: true }));
        };
        const n = nbFiltresActifs();

        return '<div class="carte pl-filtres"' + (etat.filtresOuverts ? "" : " hidden") + '>' +
            '<div class="pl-filtres-grille">' +
            '<div><label for="pf-recherche">Recherche</label><div class="pl-recherche"><input type="search" id="pf-recherche" placeholder="Nom, ville, groupe…" value="' + esc(f.recherche) + '">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div></div>' +
            '<div><label for="pf-client">Client</label><select id="pf-client">' +
            options(tous.map(c => ({ valeur: c.id, texte: c.nom })), f.client, "Tous les clients") + '</select></div>' +
            '<div><label for="pf-region">Région</label><select id="pf-region">' +
            options(uniques(c => { const r = Departements.emplacement(c).region; return { valeur: r, texte: r }; }), f.region, "Toutes") + '</select></div>' +
            '<div><label for="pf-departement">Département</label><select id="pf-departement">' +
            options(uniques(c => { const e = Departements.emplacement(c); return { valeur: e.departement, texte: e.departementNom }; }), f.departement, "Tous") + '</select></div>' +
            (enEquipe() ? '<div><label for="pf-technicien">Technicien</label><select id="pf-technicien">' +
                [["moi", "Mes clients"], ["", "Tous"], ["aucun", "Non attribués"]]
                    .concat(Formulaires.membresEquipe().filter(m => !m.moi).map(m => [m.id, m.nom || "(sans nom)"]))
                    .map(o => '<option value="' + esc(o[0]) + '"' + (o[0] === f.technicien ? " selected" : "") + '>' + esc(o[1]) + '</option>').join("") +
                '</select></div>' : "") +
            '<div><label for="pf-production">Production</label><select id="pf-production">' +
            options(uniques(c => ({ valeur: c.typeProduction, texte: c.typeProduction })), f.production, "Toutes") + '</select></div>' +
            '<div><label for="pf-type">Type de visite</label><select id="pf-type">' +
            '<option value="tous"' + (f.typeVisite === "tous" ? " selected" : "") + '>Toutes</option>' +
            Donnees.TYPES_VISITE.map(t => '<option value="' + t.cle + '"' + (f.typeVisite === t.cle ? " selected" : "") + '>' + esc(t.libelle) + '</option>').join("") +
            '</select></div>' +
            '</div>' +
            '<div class="pl-filtres-pied">' +
            '<label class="champ-case" style="margin-top:0;"><input type="checkbox" id="pf-inactifs"' + (f.inactifs ? " checked" : "") + '> Inclure les clients inactifs</label>' +
            '<button type="button" class="pl-reinitialiser" data-effacer-filtres' + (n ? "" : " disabled") + '>↺ Réinitialiser</button>' +
            '</div></div>';
    }

    /* ---------- Rendu de la page ---------- */

    const ICONES = {
        calendrier: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 3v4M16 3v4M4 10h16M12 13v4M10 15h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
        filtre: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 5h16l-6 7v6l-4 2v-8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
        document: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
    };

    function legende() {
        const pastille = (couleur, vide, carre) => '<span class="tl-legende-pastille' + (carre ? " tl-legende-pastille--carre" : "") + '" style="' +
            (vide ? "border-color:" + couleur : "background:" + couleur + ";border-color:" + couleur) + '"></span>';
        return '<div class="tl-legende">' +
            '<span>' + pastille(COULEURS.campagne) + 'Visite de campagne</span>' +
            '<span>' + pastille(COULEURS.maintenance) + 'Visite de maintenance</span>' +
            '<span>' + pastille("#4b5563") + 'Autres types</span>' +
            '<span>' + pastille(COULEURS.rdv, false, true) + 'Rendez-vous planifié</span>' +
            '<span>' + pastille(COULEURS.echeance) + 'Prochaine échéance</span>' +
            '<span>' + pastille(COULEURS.retard, false, true) + 'En retard / pas encore vue</span>' +
            '<span><span class="tl-legende-pastille tl-legende-pastille--carre tl-legende-campagne"></span>Période de campagne</span>' +
            '</div>';
    }

    function rendre() {
        const focus = document.activeElement && document.activeElement.id === "pf-recherche";
        const p = construire();
        const lignesSynthese = syntheseParClient(p);
        const aucunClient = Donnees.getDonnees().clients.length === 0;
        const n = nbFiltresActifs();

        conteneur.innerHTML =
            '<div class="entete-page">' +
            '<div><h1 class="titre-page">Planning d\'interventions</h1>' +
            '<p class="texte-attenue" style="font-size:0.9rem;">Vue éclatée de l\'année • <strong style="color:var(--texte);">' + p.annee + '</strong></p></div>' +
            '<div class="actions-page">' +
            '<div class="pl-annee">' +
            '<button type="button" data-annee="-1" aria-label="Année précédente">‹</button>' +
            '<strong>' + p.annee + '</strong>' +
            '<button type="button" data-annee="1" aria-label="Année suivante">›</button>' +
            '</div>' +
            (aucunClient ? "" : '<button type="button" class="bouton" data-planifier>' + ICONES.calendrier + ' Planifier</button>') +
            (aucunClient ? "" : '<button type="button" class="bouton bouton--contour pl-bouton-filtres' + (etat.filtresOuverts ? " actif" : "") + '" data-filtres aria-expanded="' + etat.filtresOuverts + '">' +
                ICONES.filtre + ' Filtres' + (n ? ' <span class="onglet-fiche-compteur">' + n + '</span>' : "") + '</button>') +
            '<button type="button" class="bouton" data-exporter' + (aucunClient ? " disabled" : "") + '>' + ICONES.document + ' Compte rendu</button>' +
            '</div></div>' +

            (aucunClient
                ? '<div class="etat-vide" style="margin-top:16px;">📅<br>Le planning se remplira avec tes clients et leurs visites.<br>' +
                '<a href="Clients.html" class="bouton" style="margin-top:12px;">Aller aux clients</a></div>'
                : barreFiltres() +
                '<div class="carte tl-carte">' +
                '<div class="tl-outils">' +
                '<div class="bascule-vue">' +
                '<button type="button" class="bascule-vue-bouton' + (etat.vue === "timeline" ? " actif" : "") + '" data-vue="timeline">Timeline</button>' +
                '<button type="button" class="bascule-vue-bouton' + (etat.vue === "mois" ? " actif" : "") + '" data-vue="mois">Mois</button>' +
                '</div>' +
                '<label class="champ-case" style="margin-top:0;"><input type="checkbox" id="pf-detail"' + (etat.detailLignes ? " checked" : "") + '> Détail par ligne</label>' +
                legende() +
                '</div>' +
                (p.clients.length === 0
                    ? '<div class="etat-vide" style="margin-top:12px;">Aucun client ne correspond aux filtres.</div>'
                    : (etat.vue === "timeline" ? timeline(p) : grille(p))) +
                '</div>' +
                (p.clients.length === 0 ? "" : chiffresCles(p)));

        brancher(p, lignesSynthese, focus);
    }

    function brancher(p, lignesSynthese, remettreFocus) {
        const sur = (sel, evt, fn) => conteneur.querySelectorAll(sel).forEach(el => el.addEventListener(evt, () => fn(el)));

        sur("[data-annee]", "click", el => { etat.annee += Number(el.getAttribute("data-annee")); rendre(); });
        sur("[data-vue]", "click", el => { etat.vue = el.getAttribute("data-vue"); rendre(); });
        sur("[data-exporter]", "click", () => ouvrirExport(p, lignesSynthese));
        /* Bouton d'en-tête : demain (ou le début de l'année affichée si elle est à venir). */
        sur("[data-planifier]", "click", () => Formulaires.rdv({ date: dateDansPeriode(p.annee + "-01-01") }));
        sur("[data-planifier-cellule]", "click", el => {
            const col = p.cols[Number(el.getAttribute("data-periode"))];
            planifierPour(el.getAttribute("data-planifier-cellule"), dateDansPeriode(col.debut));
        });
        brancherPistes(p);
        sur("[data-rangee]", "click", el => {
            const col = p.cols[Number(el.getAttribute("data-periode"))];
            ouvrirDetail(p, el.getAttribute("data-rangee"), col.debut, col.fin);
        });
        sur("[data-point]", "click", el => {
            const [cle, date] = el.getAttribute("data-point").split("|");
            ouvrirDetail(p, cle, date, date);
        });
        sur("[data-filtres]", "click", () => { etat.filtresOuverts = !etat.filtresOuverts; rendre(); });
        sur("#pf-detail", "change", el => { etat.detailLignes = el.checked; rendre(); });

        const liaisons = { "pf-client": "client", "pf-region": "region", "pf-departement": "departement", "pf-production": "production", "pf-type": "typeVisite", "pf-technicien": "technicien" };
        Object.keys(liaisons).forEach(id => sur("#" + id, "change", el => { etat.filtres[liaisons[id]] = el.value; rendre(); }));
        sur("#pf-inactifs", "change", el => {
            etat.filtres.inactifs = el.checked;
            /* Un client inactif choisi ne doit pas rester sélectionné, invisible. */
            if (!el.checked && etat.filtres.client) {
                const c = Donnees.getClient(etat.filtres.client);
                if (c && c.actif === false) etat.filtres.client = "";
            }
            rendre();
        });
        sur("[data-effacer-filtres]", "click", () => { etat.filtres = Object.assign({}, FILTRES_VIDES); rendre(); });

        const recherche = document.getElementById("pf-recherche");
        if (recherche) {
            recherche.addEventListener("input", () => { etat.filtres.recherche = recherche.value; rendre(); });
            if (remettreFocus) { recherche.focus(); recherche.setSelectionRange(recherche.value.length, recherche.value.length); }
        }
    }

    Donnees.ecouter(rendre);
    rendre();
})();
