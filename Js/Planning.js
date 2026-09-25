/* =============================================================
   Planning.js — Vue éclatée de l'année (Planning.html)

   Une ligne par client (et, en option, par ligne de production),
   une colonne par semaine ou par mois. Chaque case montre :
     ● vert  visites de campagne      ● bleu  visites de maintenance
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

    const FILTRES_VIDES = { recherche: "", client: "", region: "", departement: "", production: "", typeVisite: "tous", inactifs: false };
    const etat = {
        annee: new Date().getFullYear(),
        vue: "mois",
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

    function periodes(annee, vue) {
        const liste = [];
        if (vue === "mois") {
            for (let m = 0; m < 12; m++) {
                const debut = iso(new Date(annee, m, 1));
                const fin = iso(new Date(annee, m + 1, 0));
                liste.push({ debut, fin, libelle: MOIS_COURTS[m], mois: m, ref: annee + "-" + String(m + 1).padStart(2, "0") + "-15" });
            }
            return liste;
        }
        /* Semaines du lundi au dimanche, de celle qui contient le 1er janvier
           à celle qui contient le 31 décembre : aucune date de l'année ne
           tombe hors grille. Numérotation ISO. */
        const premier = new Date(annee, 0, 1);
        let lundi = new Date(annee, 0, 1 - ((premier.getDay() + 6) % 7));
        const dernier = iso(new Date(annee, 11, 31));
        while (iso(lundi) <= dernier) {
            const debut = iso(lundi);
            const fin = Donnees.ajouterJours(debut, 6);
            const jeudi = Donnees.ajouterJours(debut, 3);
            const anJeudi = Number(jeudi.slice(0, 4));
            const mois = anJeudi < annee ? 0 : anJeudi > annee ? 11 : Number(jeudi.slice(5, 7)) - 1;
            const ref = anJeudi === annee ? jeudi : (anJeudi < annee ? annee + "-01-01" : annee + "-12-31");
            liste.push({ debut, fin, libelle: String(semaineIso(debut)), mois, ref });
            lundi = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 7);
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

    function nbFiltresActifs() {
        const f = etat.filtres;
        return ["recherche", "client", "region", "departement", "production"].filter(k => f[k]).length +
            (f.typeVisite !== "tous" ? 1 : 0) + (f.inactifs ? 1 : 0);
    }

    function libelleFiltres() {
        const f = etat.filtres, morceaux = [];
        if (f.client) { const c = Donnees.getClient(f.client); if (c) morceaux.push("Client : " + c.nom); }
        if (f.recherche) morceaux.push("Recherche : " + f.recherche);
        if (f.region) morceaux.push("Région : " + f.region);
        if (f.departement) morceaux.push("Département : " + f.departement);
        if (f.production) morceaux.push("Production : " + f.production);
        if (f.typeVisite !== "tous") morceaux.push("Visites : " + (f.typeVisite === "campagne" ? "campagne" : "maintenance"));
        if (f.inactifs) morceaux.push("Inactifs inclus");
        return morceaux.length ? morceaux.join(" · ") : "Aucun";
    }

    /* ---------- Calcul du planning ---------- */

    function construire() {
        const annee = etat.annee;
        const cols = periodes(annee, etat.vue);
        const clients = clientsFiltres();
        const visites = visitesFiltrees(clients, annee);
        const aujourdhui = Donnees.aujourdhuiIso();
        const iAujourdhui = aujourdhui.slice(0, 4) === String(annee) ? indexPeriode(cols, aujourdhui) : -1;

        /* Échéances : seulement pour l'année en cours, c'est de la prévision. */
        const echeances = iAujourdhui === -1 ? [] :
            Donnees.calculerEcheances(aujourdhui).lignes.filter(e => clients.some(c => c.id === e.client.id));

        const vide = () => cols.map(() => ({ campagne: 0, maintenance: 0, echeance: false, retard: false, visites: [], rdv: [] }));
        const idsClients = new Set(clients.map(c => c.id));
        const t = etat.filtres.typeVisite;
        const rdvs = Donnees.listerRdv().filter(r => idsClients.has(r.clientId) && r.date.slice(0, 4) === String(annee) &&
            (t === "tous" || r.type === t));
        const rangees = [];

        clients.forEach(client => {
            const lignes = Donnees.lignesDuClient(client.id);
            const rClient = { type: "client", client, cellules: vide(), total: { campagne: 0, maintenance: 0 } };
            const rLignes = {};
            lignes.forEach(l => { rLignes[l.id] = { type: "ligne", client, ligne: l, cellules: vide(), total: { campagne: 0, maintenance: 0 } }; });

            visites.filter(v => v.clientId === client.id).forEach(v => {
                const i = indexPeriode(cols, v.date);
                if (i === -1) return;
                [rClient, rLignes[v.ligneId]].forEach(r => {
                    if (!r) return;
                    r.cellules[i][v.type]++;
                    r.cellules[i].visites.push(v);
                    r.total[v.type]++;
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
            if (etat.detailLignes) lignes.forEach(l => rangees.push(rLignes[l.id]));
        });

        return { annee, cols, clients, visites, rdvs, rangees, iAujourdhui };
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

        const contenu =
            (c.campagne ? '<span class="pl-point pl-point--campagne">' + (c.campagne > 1 ? c.campagne : "") + '</span>' : "") +
            (c.maintenance ? '<span class="pl-point pl-point--maintenance">' + (c.maintenance > 1 ? c.maintenance : "") + '</span>' : "") +
            (c.retard ? '<span class="pl-retard" title="En retard / pas encore vue">!</span>' : "") +
            (c.rdv.length ? '<span class="pl-rdv" title="Rendez-vous planifié">' + (c.rdv.length > 1 ? c.rdv.length : "") + '</span>' : "") +
            (c.echeance && !n && !c.rdv.length ? '<span class="pl-echeance" title="Prochaine échéance"></span>' : "");

        return '<td class="' + classes.join(" ") + '"' +
            (cliquable ? ' data-rangee="' + (r.type === "ligne" ? "l:" + esc(r.ligne.id) : "c:" + esc(r.client.id)) + '" data-periode="' + i + '"' : "") +
            ' title="' + esc(col.debut === col.fin ? col.debut : Formulaires.dateFr(col.debut) + " → " + Formulaires.dateFr(col.fin)) +
            (n ? " · " + n + " visite" + (n > 1 ? "s" : "") : "") + (c.rdv.length ? " · " + c.rdv.length + " RDV" : "") + '">' + contenu + '</td>';
    }

    function grille(p) {
        const semaines = etat.vue === "semaines";
        let enteteMois = "";
        if (semaines) {
            const groupes = [];
            p.cols.forEach(c => {
                const g = groupes[groupes.length - 1];
                if (g && g.mois === c.mois) g.n++; else groupes.push({ mois: c.mois, n: 1 });
            });
            enteteMois = '<tr><th class="pl-entete-rangee" rowspan="2">Client / ligne</th>' +
                groupes.map(g => '<th class="pl-entete-mois" colspan="' + g.n + '">' + MOIS_COURTS[g.mois] + '</th>').join("") +
                '<th class="pl-entete-total" rowspan="2">Camp.</th><th class="pl-entete-total" rowspan="2">Maint.</th></tr>';
        }
        const enteteCols = '<tr>' + (semaines ? "" : '<th class="pl-entete-rangee">Client / ligne</th>') +
            p.cols.map((c, i) => '<th class="pl-entete-col' + (i === p.iAujourdhui ? " pl-entete-col--aujourdhui" : "") + '">' +
                (semaines ? "S" : "") + c.libelle + '</th>').join("") +
            (semaines ? "" : '<th class="pl-entete-total">Camp.</th><th class="pl-entete-total">Maint.</th>') + '</tr>';

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
                '</tr>';
        }).join("");

        const totaux = p.cols.map((c, i) => {
            const n = p.visites.filter(v => v.date >= c.debut && v.date <= c.fin).length;
            return '<td class="pl-total">' + (n || "") + '</td>';
        }).join("");
        const tc = p.visites.filter(v => v.type === "campagne").length;
        const tm = p.visites.filter(v => v.type === "maintenance").length;

        return '<div class="pl-defilement"><table class="pl-table pl-table--' + etat.vue + '">' +
            '<thead>' + enteteMois + enteteCols + '</thead>' +
            '<tbody>' + corps + '</tbody>' +
            '<tfoot><tr><th class="pl-libelle" scope="row">Total visites</th>' + totaux +
            '<td class="pl-total">' + (tc || "") + '</td><td class="pl-total">' + (tm || "") + '</td></tr></tfoot>' +
            '</table></div>' +
            '<div class="pl-legende">' +
            '<span><span class="pl-point pl-point--campagne"></span> Visite de campagne</span>' +
            '<span><span class="pl-point pl-point--maintenance"></span> Visite de maintenance</span>' +
            '<span><span class="pl-rdv"></span> Rendez-vous planifié</span>' +
            '<span><span class="pl-echeance"></span> Prochaine échéance</span>' +
            '<span><span class="pl-retard">!</span> En retard / pas encore vue</span>' +
            '<span><span class="pl-exemple-campagne"></span> Période de campagne</span>' +
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
                maintenance: vs.length - camp.length,
                lignesVisitees: new Set(vs.map(v => v.ligneId)).size,
                derniere: vs.length ? vs[vs.length - 1].date : null,
                intervalle: ecarts.length ? Math.round(ecarts.reduce((a, b) => a + b, 0) / ecarts.length) : null
            };
        });
    }

    function synthese(p, lignesSynthese) {
        const tc = p.visites.filter(v => v.type === "campagne").length;
        const visites = lignesSynthese.filter(s => s.campagne + s.maintenance > 0).length;
        const nbLignes = new Set(p.visites.map(v => v.ligneId)).size;
        const kpi = (lib, val) => '<div class="kpi-mini"><div class="kpi-mini-libelle">' + lib + '</div><div class="kpi-mini-valeur">' + val + '</div></div>';

        return '<div class="section-entete" style="margin-top:20px;"><h2 class="section-titre">📝 Synthèse ' + p.annee + '</h2></div>' +
            '<div class="grille-kpi">' +
            kpi("Visites de campagne", tc) + kpi("Visites de maintenance", p.visites.length - tc) +
            kpi("Clients visités", visites + " / " + p.clients.length) + kpi("Lignes visitées", nbLignes) +
            '</div>' +
            (lignesSynthese.length === 0 ? "" :
                '<div class="pl-defilement" style="margin-top:12px;"><table class="tableau-synthese">' +
                '<thead><tr><th>Client</th><th>Emplacement</th><th>Campagne</th><th>Maint.</th><th>Dernière visite</th>' +
                '<th>Intervalle moyen</th><th>Cadence</th></tr></thead><tbody>' +
                lignesSynthese.map(s => {
                    const ecart = s.intervalle !== null && s.intervalle > s.client.cadenceJours;
                    return '<tr><td><a href="Client.html?id=' + encodeURIComponent(s.client.id) + '" class="texte-lien">' + esc(s.client.nom) + '</a></td>' +
                        '<td>' + esc(s.emplacement.departementNom) + '</td>' +
                        '<td class="nombre">' + s.campagne + '</td><td class="nombre">' + s.maintenance + '</td>' +
                        '<td>' + Formulaires.dateFr(s.derniere) + '</td>' +
                        '<td class="nombre"' + (ecart ? ' style="color:var(--statut-alert);font-weight:700;"' : "") + '>' +
                        (s.intervalle === null ? "—" : s.intervalle + " j") + '</td>' +
                        '<td class="nombre">' + s.client.cadenceJours + ' j</td></tr>';
                }).join("") + '</tbody></table></div>' +
                '<p class="aide-champ">Intervalle moyen : écart moyen entre deux visites de campagne d\'une même ligne sur l\'année. En rouge s\'il dépasse la cadence prévue.</p>');
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
            ["Visites de maintenance", p.visites.length - tc],
            ["Clients visités", lignesSynthese.filter(s => s.campagne + s.maintenance > 0).length],
            ["Lignes visitées", new Set(p.visites.map(v => v.ligneId)).size]
        ];
        const synth = lignesSynthese.map(s => [s.client.nom, s.client.ville, s.emplacement.departementNom, s.emplacement.region,
            s.client.typeProduction, s.campagne, s.maintenance, s.lignesVisitees, s.derniere, s.intervalle, s.client.cadenceJours]);

        const visites = p.visites.map(v => {
            const c = Donnees.getClient(v.clientId), l = Donnees.getLigne(v.ligneId);
            const e = Departements.emplacement(c);
            return [v.date, semaineIso(v.date), MOIS_COURTS[Number(v.date.slice(5, 7)) - 1], c.nom, c.ville, e.departementNom, e.region,
                l ? l.nom : "Ligne supprimée", v.type === "campagne" ? "Campagne" : "Maintenance / hiver", v.format, v.produit, v.remarques];
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
                        { titre: "Cadence prévue (j)", largeur: 14 }], lignes: synth
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
                            r.type === "maintenance" ? "Maintenance / hiver" : "Campagne", r.notes];
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
        { titre: "Format", largeur: 12 }, { titre: "Produit", largeur: 20 }, { titre: "Remarques", largeur: 50 }
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

    function ouvrirDetail(p, cle, iPeriode) {
        const [type, id] = cle.split(":");
        const col = p.cols[iPeriode];
        const vs = p.visites.filter(v => v.date >= col.debut && v.date <= col.fin &&
            (type === "l" ? v.ligneId === id : v.clientId === id)).reverse();
        const rs = p.rdvs.filter(r => r.date >= col.debut && r.date <= col.fin &&
            (type === "l" ? (r.ligneIds || []).indexOf(id) !== -1 : r.clientId === id));
        if (!vs.length && !rs.length) return;
        const client = Donnees.getClient((vs[0] || rs[0]).clientId);
        AppLayout.ouvrirFeuille("droite", client.nom,
            '<p class="texte-attenue" style="font-size:0.8rem;">' + Formulaires.dateFr(col.debut) + ' → ' + Formulaires.dateFr(col.fin) + '</p>' +
            (rs.length ? '<div class="carte" style="padding:0;margin-top:10px;"><div class="bloc-rdv-titre">📅 Rendez-vous</div>' +
                rs.map(r => Formulaires.carteRdv(r, false)).join("") + '</div>' : "") +
            vs.map(v => {
                const l = Donnees.getLigne(v.ligneId);
                return '<div class="carte" style="margin-top:10px;">' +
                    '<div class="carte-ligne-entete"><strong>' + Formulaires.dateFr(v.date) + ' · ' + esc(l ? l.nom : "Ligne supprimée") + '</strong>' +
                    '<span class="pastille-statut" style="' + (v.type === "campagne" ? "background:#16a34a1a;color:#16a34a;" : "background:#0ea5e91a;color:#0ea5e9;") + '">' +
                    (v.type === "campagne" ? "Campagne" : "Maintenance") + '</span></div>' +
                    ((v.format || v.produit) ? '<div class="texte-attenue carte-ligne-info">📦 ' + esc([v.format, v.produit].filter(Boolean).join(" · ")) + '</div>' : "") +
                    (v.remarques ? '<div class="carte-ligne-notes">' + esc(v.remarques) + '</div>' : "") +
                    '</div>';
            }).join("") +
            '<a href="Client.html?id=' + encodeURIComponent(client.id) + '" class="bouton bouton--contour bouton--large">Ouvrir la fiche client</a>');
        Formulaires.brancherRdv(document.querySelector(".feuille"));
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

        return '<details class="carte pl-filtres"' + (etat.filtresOuverts ? " open" : "") + '>' +
            '<summary><strong>🔎 Filtres</strong>' + (n ? ' <span class="onglet-fiche-compteur">' + n + ' actif' + (n > 1 ? "s" : "") + '</span>' : "") + '</summary>' +
            '<div class="pl-filtres-grille">' +
            '<div><label for="pf-recherche">Recherche</label><input type="search" id="pf-recherche" placeholder="Nom, ville, groupe…" value="' + esc(f.recherche) + '"></div>' +
            '<div><label for="pf-client">Client</label><select id="pf-client">' +
            options(tous.map(c => ({ valeur: c.id, texte: c.nom })), f.client, "Tous les clients") + '</select></div>' +
            '<div><label for="pf-region">Région</label><select id="pf-region">' +
            options(uniques(c => { const r = Departements.emplacement(c).region; return { valeur: r, texte: r }; }), f.region, "Toutes") + '</select></div>' +
            '<div><label for="pf-departement">Département</label><select id="pf-departement">' +
            options(uniques(c => { const e = Departements.emplacement(c); return { valeur: e.departement, texte: e.departementNom }; }), f.departement, "Tous") + '</select></div>' +
            '<div><label for="pf-production">Production</label><select id="pf-production">' +
            options(uniques(c => ({ valeur: c.typeProduction, texte: c.typeProduction })), f.production, "Toutes") + '</select></div>' +
            '<div><label for="pf-type">Type de visite</label><select id="pf-type">' +
            '<option value="tous"' + (f.typeVisite === "tous" ? " selected" : "") + '>Toutes</option>' +
            '<option value="campagne"' + (f.typeVisite === "campagne" ? " selected" : "") + '>Campagne</option>' +
            '<option value="maintenance"' + (f.typeVisite === "maintenance" ? " selected" : "") + '>Maintenance / hiver</option>' +
            '</select></div>' +
            '</div>' +
            '<div class="pl-filtres-pied">' +
            '<label class="champ-case" style="margin-top:0;"><input type="checkbox" id="pf-inactifs"' + (f.inactifs ? " checked" : "") + '> Inclure les clients inactifs</label>' +
            (n ? '<button type="button" class="bouton bouton--petit bouton--fantome" data-effacer-filtres>✕ Effacer les filtres</button>' : "") +
            '</div></details>';
    }

    /* ---------- Rendu de la page ---------- */

    function rendre() {
        const focus = document.activeElement && document.activeElement.id === "pf-recherche";
        const p = construire();
        const lignesSynthese = syntheseParClient(p);
        const aucunClient = Donnees.getDonnees().clients.length === 0;

        conteneur.innerHTML =
            '<div class="entete-page">' +
            '<div><h1 class="titre-page">Planning</h1>' +
            '<p class="texte-attenue" style="font-size:0.85rem;">Vue éclatée de l\'année · ' + p.clients.length + ' client' + (p.clients.length > 1 ? "s" : "") +
            ' · ' + p.visites.length + ' visite' + (p.visites.length > 1 ? "s" : "") + '</p></div>' +
            '<div class="actions-page">' +
            '<div class="pl-annee">' +
            '<button type="button" class="bouton bouton--petit bouton--contour" data-annee="-1" aria-label="Année précédente">◀</button>' +
            '<strong>' + p.annee + '</strong>' +
            '<button type="button" class="bouton bouton--petit bouton--contour" data-annee="1" aria-label="Année suivante">▶</button>' +
            '</div>' +
            '<button type="button" class="bouton" data-exporter' + (aucunClient ? " disabled" : "") + '>📤 Compte rendu</button>' +
            '</div></div>' +

            (aucunClient
                ? '<div class="etat-vide" style="margin-top:16px;">📅<br>Le planning se remplira avec tes clients et leurs visites.<br>' +
                '<a href="Clients.html" class="bouton" style="margin-top:12px;">Aller aux clients</a></div>'
                : barreFiltres() +
                '<div class="pl-options">' +
                '<div class="bascule-vue">' +
                '<button type="button" class="bascule-vue-bouton' + (etat.vue === "mois" ? " actif" : "") + '" data-vue="mois">Mois</button>' +
                '<button type="button" class="bascule-vue-bouton' + (etat.vue === "semaines" ? " actif" : "") + '" data-vue="semaines">Semaines</button>' +
                '</div>' +
                '<label class="champ-case" style="margin-top:0;"><input type="checkbox" id="pf-detail"' + (etat.detailLignes ? " checked" : "") + '> Détail par ligne</label>' +
                '</div>' +
                (p.clients.length === 0
                    ? '<div class="etat-vide" style="margin-top:12px;">Aucun client ne correspond aux filtres.</div>'
                    : grille(p) + synthese(p, lignesSynthese)));

        brancher(p, lignesSynthese, focus);
    }

    function brancher(p, lignesSynthese, remettreFocus) {
        const sur = (sel, evt, fn) => conteneur.querySelectorAll(sel).forEach(el => el.addEventListener(evt, () => fn(el)));

        sur("[data-annee]", "click", el => { etat.annee += Number(el.getAttribute("data-annee")); rendre(); });
        sur("[data-vue]", "click", el => { etat.vue = el.getAttribute("data-vue"); rendre(); });
        sur("[data-exporter]", "click", () => ouvrirExport(p, lignesSynthese));
        sur("[data-rangee]", "click", el => ouvrirDetail(p, el.getAttribute("data-rangee"), Number(el.getAttribute("data-periode"))));
        sur("#pf-detail", "change", el => { etat.detailLignes = el.checked; rendre(); });

        const details = conteneur.querySelector(".pl-filtres");
        if (details) details.addEventListener("toggle", () => { etat.filtresOuverts = details.open; });

        const liaisons = { "pf-client": "client", "pf-region": "region", "pf-departement": "departement", "pf-production": "production", "pf-type": "typeVisite" };
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

        /* Grille en semaines : on fait défiler jusqu'à la semaine en cours. */
        const cible = conteneur.querySelector(".pl-table--semaines .pl-entete-col--aujourdhui");
        const zone = conteneur.querySelector(".pl-defilement");
        if (cible && zone && zone.scrollLeft === 0) zone.scrollLeft = Math.max(0, cible.offsetLeft - zone.clientWidth / 2);
    }

    Donnees.ecouter(rendre);
    rendre();
})();
