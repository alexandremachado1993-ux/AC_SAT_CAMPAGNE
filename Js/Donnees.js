/* =============================================================
   Donnees.js — Couche d'accès aux données (AC SAT Campagne)

   Même principe qu'AC SAT Field : AUCUNE page ne touche au stockage.
   Tout passe par l'API ci-dessous. Passer plus tard à Supabase
   (synchronisation téléphone ⇄ PC) n'a demandé de modifier que ce
   fichier et d'ajouter Synchro.js, pas les pages.

   Stockage : localStorage du navigateur, clé CLE_STOCKAGE — l'application
   fonctionne donc sans réseau. Synchronisation entre appareils : Synchro.js
   (Supabase), qui s'appuie sur le suivi des modifications ci-dessous.
   Sauvegarde manuelle : Réglages › Exporter (fichier JSON).

   Modèle :
     clients    { id, nom, groupe, adresse, codePostal, ville, region, pays,
                  telephone, email, typeProduction, debutCampagne (1-12),
                  finCampagne (1-12), cadenceJours, actif, notes, creeLe }
     contacts   { id, clientId, role, prenom, nom, telephoneFixe, mobile,
                  email, principal, notes }
     lignes     { id, clientId, nom, marque, modele, numeroSerie,
                  formatHabituel, produitHabituel, cadenceLigne,
                  statut "active"|"inactive"|"concurrent", fournisseurActuel,
                  suiviCampagne (= statut active, gardé pour les anciennes versions), notes }
     visites    { id, clientId, ligneId (null pour une réunion…), date "AAAA-MM-JJ",
                  type (voir TYPES_VISITE), format, produit, remarques,
                  references {refEtiquette…}, details {champs propres au type} }
     rdv        { id, clientId, ligneIds [], date "AAAA-MM-JJ", heure "HH:MM"|"",
                  type (voir TYPES_VISITE), notes, references {…},
                  statut "confirme"|"propose", origine "auto"|"" }  — visites planifiées
     lignes : outillage molette1/molette2/mandrin → <outil>Fournisseur + <outil>Ref
   ============================================================= */

const Donnees = (() => {
    "use strict";

    const CLE_STOCKAGE = "acsc_donnees_v1";
    const VERSION = 1;
    const JOURS_BIENTOT = 3;   // « à prévoir » quand l'échéance tombe dans ≤ 3 jours

    const ROLES_CONTACT = [
        "Responsable sertissage", "Responsable logistique", "Responsable production",
        "Responsable maintenance", "Responsable qualité", "Directeur de site",
        "Chef de ligne", "Achats", "Méthodes / Travaux neufs", "Autre"
    ];
    const TYPES_PRODUCTION = [
        "Légumes", "Fruits", "Poisson", "Viande / plats cuisinés",
        "Produits laitiers", "Aliments animaux", "Boissons", "Autre"
    ];
    /* Fournisseurs d'outillage proposés d'office ; la liste s'enrichit
       ensuite de tous ceux déjà saisis (fournisseursOutillage()). */
    const FOURNISSEURS_OUTILLAGE = ["Guylegall", "IMETA"];
    const OUTILS = [
        { cle: "molette1", libelle: "Molette 1" },
        { cle: "molette2", libelle: "Molette 2" },
        { cle: "mandrin", libelle: "Mandrin" }
    ];

    /* ---------- Types de visite ----------
       Seul « campagne » fait avancer les rappels (calculerEcheances).
       ligneFacultative : visite qui peut concerner le client sans ligne
       précise (réunion, formation, audit).
       references : affiche le bloc « Références » dans le formulaire.
       referencesRdv : ce bloc est aussi proposé dès la planification du
       rendez-vous, puis repris quand la visite est faite.
       champs : champs propres au type, rangés dans visite.details. */
    const REFERENCES = [
        { cle: "refEtiquette", libelle: "Étiquette" },
        { cle: "refBoite", libelle: "Boîte (corps)" },
        { cle: "refFond", libelle: "Fond" },
        { cle: "refMolette1", libelle: "Molette 1re passe" },
        { cle: "refMolette2", libelle: "Molette 2e passe" },
        { cle: "refMandrin", libelle: "Mandrin" },
        { cle: "refAutre", libelle: "Autre référence" }
    ];
    const OBJETS_HOMOLOGATION = ["Nouveau format", "Nouveau fond", "Nouvelle boîte", "Nouveau produit",
        "Nouvelle étiquette", "Nouvel outillage", "Nouvelle machine"];
    const OBJETS_VALIDATION = ["Réglage machine", "Outillage", "Format", "Fond", "Boîte", "Étiquette", "Produit"];
    /* Défauts de serti, d'après le guide des défauts Eviosys affiché en usine. */
    const DEFAUTS_SERTI = ["Roulé lâche", "Roulé serré", "Hauteur de serti trop grande", "Hauteur de serti trop faible",
        "Crochet de fond trop grand", "Crochet de fond faible", "Crochet de corps trop grand", "Crochet de corps faible",
        "Profondeur de cuvette", "Feston", "Picot ou vé", "Ondulation", "Patinage", "Rabotage / laminage",
        "Bourrelet ou fracture", "Faux serti", "Ourlet abîmé", "Bord tombé (localisé)", "Loup de serti",
        "Corps affaissé", "Bord champignon", "Surépaisseur de serti"];
    const TYPES_VISITE = [
        { cle: "campagne", libelle: "Campagne", couleur: "#16a34a", references: true, champs: [] },
        { cle: "maintenance", libelle: "Maintenance / hiver", couleur: "#0ea5e9", references: true, champs: [] },
        { cle: "homologation", libelle: "Homologation", couleur: "#b45309", references: true, referencesRdv: true, champs: [
            { cle: "objet", libelle: "Objet de l'homologation", type: "choix", options: OBJETS_HOMOLOGATION }] },
        { cle: "validation", libelle: "Validation", couleur: "#0d9488", references: true, champs: [
            { cle: "objetValide", libelle: "Ce qui est validé", type: "choix", options: OBJETS_VALIDATION },
            { cle: "validePar", libelle: "Validé par (client)", type: "choix", source: "contacts" }] },
        { cle: "essai", libelle: "Essai interne", couleur: "#a16207", references: true, referencesRdv: true, champs: [
            { cle: "objectif", libelle: "Objectif de l'essai", type: "text" },
            { cle: "parametres", libelle: "Paramètres testés", type: "textarea" },
            { cle: "suite", libelle: "Suite à donner", type: "text" }] },
        { cle: "depannage", libelle: "Dépannage", couleur: "#be123c", references: true, champs: [
            { cle: "panne", libelle: "Défaut constaté", type: "choix", options: DEFAUTS_SERTI },
            { cle: "pieces", libelle: "Pièces changées", type: "text" }] },
        { cle: "mise-en-route", libelle: "Mise en route", couleur: "#2563eb", references: true, champs: [
            { cle: "equipement", libelle: "Machine / équipement", type: "choix", source: "machines" }] },
        { cle: "formation", libelle: "Formation", couleur: "#db2777", ligneFacultative: true, champs: [
            { cle: "sujet", libelle: "Sujet", type: "text" },
            { cle: "participants", libelle: "Personnes formées", type: "text" }] },
        { cle: "audit", libelle: "Audit", couleur: "#4b5563", ligneFacultative: true, references: true, champs: [
            { cle: "perimetre", libelle: "Périmètre", type: "text" }] },
        { cle: "reunion", libelle: "Réunion", couleur: "#65a30d", ligneFacultative: true, champs: [
            { cle: "participants", libelle: "Avec qui", type: "choix", source: "contacts" },
            { cle: "sujet", libelle: "Objet de la réunion", type: "text" }] },
        { cle: "reunion-fin", libelle: "Réunion de fin de campagne", couleur: "#854d0e", ligneFacultative: true, champs: [
            { cle: "participants", libelle: "Avec qui", type: "choix", source: "contacts" }] }
    ];

    /* ---------- Listes « choix + saisie libre » ----------
       Les menus déroulants proposent les valeurs DÉJÀ SAISIES dans
       l'application (dédoublonnées, casse et accents ignorés) plus quelques
       valeurs de départ tirées des données de l'utilisateur ; « Autre… »
       permet d'en taper une nouvelle, proposée à la saisie suivante. */

    /* Catalogue de produits de conserverie, par famille : proposé dans les listes « Produit »
       (voir choixPour), sous tes produits déjà utilisés. « Autre… » permet d'en ajouter. */
    const CATALOGUE_PRODUITS = [
        { famille: "Légumes", produits: ["Maïs", "Maïs doux", "Haricots verts", "Haricots verts extra-fins", "Haricots beurre", "Haricots plats", "Petits pois", "Petits pois carottes", "Carottes", "Carottes en rondelles", "Macédoine de légumes", "Jardinière de légumes", "Champignons", "Champignons de Paris", "Cèpes", "Épinards", "Betteraves", "Céleri", "Salsifis", "Poivrons", "Piperade", "Ratatouille", "Artichauts", "Cœurs d'artichaut", "Asperges", "Choucroute", "Chou rouge", "Choux de Bruxelles", "Cornichons", "Olives", "Pommes de terre", "Navets", "Poireaux", "Oignons", "Courgettes", "Aubergines", "Salade de légumes"] },
        { famille: "Légumes secs", produits: ["Haricots blancs", "Haricots rouges", "Haricots noirs", "Flageolets", "Lentilles", "Pois chiches", "Pois cassés", "Fèves", "Haricots coco", "Haricots lingots", "Lentilles vertes", "Lentilles corail"] },
        { famille: "Tomates", produits: ["Tomates pelées", "Tomates concassées", "Concentré de tomate", "Coulis de tomate", "Purée de tomate", "Sauce tomate"] },
        { famille: "Fruits", produits: ["Pêches", "Poires", "Abricots", "Ananas", "Cocktail de fruits", "Salade de fruits", "Compote de pommes", "Pommes", "Cerises", "Fraises", "Fruits rouges", "Prunes", "Mandarines", "Litchis", "Mangues", "Crème de marrons", "Purée de fruits"] },
        { famille: "Poissons et fruits de mer", produits: ["Thon", "Sardines", "Maquereaux", "Saumon", "Anchois", "Hareng", "Crabe", "Moules", "Soupe de poisson", "Rillettes de poisson"] },
        { famille: "Viandes et plats cuisinés", produits: ["Cassoulet", "Pâté", "Rillettes", "Confit de canard", "Foie gras", "Plats cuisinés", "Raviolis", "Lasagnes", "Spaghetti bolognaise", "Choucroute garnie", "Petit salé aux lentilles", "Saucisses", "Haricots à la saucisse", "Bœuf bourguignon", "Blanquette de veau", "Chili con carne", "Couscous", "Paëlla", "Corned beef", "Tripes", "Boudin"] },
        { famille: "Soupes et sauces", produits: ["Soupe", "Velouté", "Potage", "Sauce béchamel", "Sauce bolognaise", "Sauce pour pâtes"] },
        { famille: "Laitages et desserts", produits: ["Lait concentré", "Lait de coco", "Crème dessert", "Riz au lait"] },
        { famille: "Boissons", produits: ["Jus de fruits", "Boisson gazeuse", "Bière"] },
        { famille: "Aliments pour animaux", produits: ["Aliment pour animaux (pâtée)", "Pâtée pour chiens", "Pâtée pour chats"] }
    ];

    const AMORCES_CHOIX = {
        marque: ["Ferrum"],
        format: ["1/6", "1/8", "1/4", "1/4 US", "1/2", "1/2H", "1/2M", "3/4", "4/4", "2/1", "3/1", "5/1", "5/1B", "10/1"],
        /* Produits de conserverie les plus courants : liste de départ, à compléter par « Autre… »
           (chaque produit saisi est ensuite proposé). */
        produit: [].concat.apply([], CATALOGUE_PRODUITS.map(f => f.produits)),
        pays: ["France"],
        motif: ["Client absent", "Machine en production", "Machine à l'arrêt", "Accès refusé", "Consignes de sécurité",
            "Pièce ou matériel manquant", "Transport ou météo", "Annulée par le client", "Annulée par moi"]
    };
    /* Listes fixes, dans leur ordre ; les valeurs saisies en plus les suivent. */
    const FIXES_CHOIX = {
        typeProduction: TYPES_PRODUCTION.filter(t => t !== "Autre"),
        role: ROLES_CONTACT.filter(r => r !== "Autre")
    };

    function sourcesChoix(cle, d, o) {
        const meme = (a, b) => normaliserTexte(a) === normaliserTexte(b);
        switch (cle) {
            case "marque": return d.lignes.map(l => l.marque);
            case "modele": return d.lignes.filter(l => !o.marque || meme(l.marque, o.marque)).map(l => l.modele);
            case "format": return d.lignes.map(l => l.formatHabituel).concat(d.visites.map(v => v.format));
            case "produit": return d.lignes.map(l => l.produitHabituel).concat(d.visites.map(v => v.produit));
            case "groupe": return d.clients.map(c => c.groupe);
            case "pays": return d.clients.map(c => c.pays);
            case "typeProduction": return d.clients.map(c => c.typeProduction);
            case "role": return d.contacts.map(c => c.role);
            case "fournisseurActuel": return d.lignes.map(l => l.fournisseurActuel);
            case "motif": return d.visites.map(v => v.motif);
            default: break;
        }
        if (cle.indexOf("detail:") === 0) { const c = cle.slice(7); return d.visites.map(v => (v.details || {})[c]); }
        if (cle.indexOf("ref:") === 0) {
            const c = cle.slice(4);
            let l = d.visites.map(v => (v.references || {})[c]).concat(d.rdv.map(r => (r.references || {})[c]));
            const outillage = (o1) => d.lignes.map(x => [x[o1 + "Fournisseur"], x[o1 + "Ref"]].filter(Boolean).join(" "));
            if (c === "refMolette1" || c === "refMolette2") l = l.concat(outillage("molette1"), outillage("molette2"));
            if (c === "refMandrin") l = l.concat(outillage("mandrin"));
            return l;
        }
        if (cle.indexOf("outil:") === 0) {
            const c = cle.slice(6);
            const cles = c.indexOf("molette") === 0 ? ["molette1", "molette2"] : [c];
            return d.lignes.reduce((r, x) => r.concat(cles.map(k => x[k + "Ref"])), []);
        }
        return [];
    }

    /* options : { marque } pour filtrer les modèles ; { avecFixes: false } pour ignorer la liste fixe. */
    function valeursConnues(cle, options) {
        const o = options || {};
        const d = getDonnees();
        const vus = new Set(), fixes = [], appris = [];
        const ajouter = (v, liste) => {
            const t = typeof v === "string" ? v.trim() : "";
            if (!t) return;
            const k = normaliserTexte(t);
            if (vus.has(k)) return;
            vus.add(k);
            liste.push(t);
        };
        (o.avecFixes === false ? [] : (FIXES_CHOIX[cle] || [])).forEach(v => ajouter(v, fixes));
        (AMORCES_CHOIX[cle] || []).forEach(v => ajouter(v, appris));
        sourcesChoix(cle, d, o).forEach(v => ajouter(v, appris));
        appris.sort((a, b) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" }));
        return fixes.concat(appris);
    }

    /* Choix proposés à un menu. Pour « produit » : { groupes } — tes produits déjà utilisés en
       premier, puis le catalogue par famille (sans doublon). Pour les autres clés : liste simple. */
    function choixPour(cle) {
        if (cle !== "produit") return valeursConnues(cle);
        const vus = new Set(), utilises = [];
        sourcesChoix("produit", getDonnees(), {}).forEach(v => {
            const t = typeof v === "string" ? v.trim() : "";
            if (!t || vus.has(normaliserTexte(t))) return;
            vus.add(normaliserTexte(t));
            utilises.push(t);
        });
        utilises.sort((a, b) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" }));
        const groupes = utilises.length ? [{ libelle: "Déjà utilisés chez toi", valeurs: utilises }] : [];
        CATALOGUE_PRODUITS.forEach(f => {
            const valeurs = f.produits.filter(p => !vus.has(normaliserTexte(p)));
            if (valeurs.length) groupes.push({ libelle: f.famille, valeurs });
        });
        return { groupes };
    }

    /* Contacts d'un client, libellés prêts pour un menu : « Prénom Nom (Rôle) ». */
    function contactsPourChoix(clientId) {
        return contactsDuClient(clientId).map(k => {
            const nom = [k.prenom, k.nom].filter(Boolean).join(" ").trim();
            return nom + (k.role ? " (" + k.role + ")" : "");
        }).filter(t => t.trim());
    }

    /* Machines des lignes d'un client (marque + modèle), sans doublon. */
    function machinesDuClient(clientId) {
        const vus = new Set(), r = [];
        lignesDuClient(clientId).forEach(l => {
            const t = [l.marque, l.modele].filter(Boolean).join(" ").trim();
            if (t && !vus.has(normaliserTexte(t))) { vus.add(normaliserTexte(t)); r.push(t); }
        });
        return r;
    }

    /* Variante assombrie d'une couleur, assez foncée pour du texte lisible
       (contraste d'au moins 4,6:1) sur fond clair ou sur sa propre teinte à
       10 %. Les couleurs vives des pastilles restent trop pâles en texte
       (orange, vert, bleu clair, or…). */
    function couleurTexte(hex) {
        const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
        if (!m) return hex;
        const n = parseInt(m[1], 16);
        const base = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        const lum = (c) => {
            const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
            return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
        };
        const lumFond = lum(base.map(v => Math.round(255 * 0.9 + v * 0.1)));
        for (let k = 0; k <= 22; k++) {
            const c = base.map(v => Math.round(v * (1 - k * 0.04)));
            if ((lumFond + 0.05) / (lum(c) + 0.05) >= 4.6) return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
        }
        return "#1a0e0d";
    }

    /* Variante éclaircie, pour du texte sur les fonds sombres du thème sombre
       (carte ≈ #2b2223 teintée à 12 %). */
    function couleurClaire(hex) {
        const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
        if (!m) return hex;
        const n = parseInt(m[1], 16);
        const base = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        const lum = (c) => {
            const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
            return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
        };
        const carte = [43, 34, 35];
        const lumFond = lum(carte.map((v, i) => Math.round(v * 0.88 + base[i] * 0.12)));
        for (let k = 0; k <= 25; k++) {
            const c = base.map(v => Math.round(v + (255 - v) * k * 0.04));
            if ((lum(c) + 0.05) / (lumFond + 0.05) >= 5.4) return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
        }
        return "#ffffff";
    }

    /* Attribut style à poser avec la classe « pastille-couleur » ou
       « texte-couleur » (voir campagne.css) : --c vive (marqueurs, pastilles),
       --ct assombrie (texte, thème clair), --cl éclaircie (texte, thème sombre). */
    function styleCouleur(hex) { return "--c:" + hex + ";--ct:" + couleurTexte(hex) + ";--cl:" + couleurClaire(hex) + ";"; }

    /* ---------- Statut d'une visite ----------
       L'historique garde aussi ce qui n'a PAS eu lieu. Seule une visite « effectuée »
       compte (échéances, planning, rappels, comptes rendus) : pour les autres,
       visitesDuClient / visitesDeLaLigne / listerVisites ne les renvoient pas ;
       historiqueDuClient les renvoie toutes. Une visite sans statut (anciennes
       données) est effectuée. Ajouter un statut : une ligne ici. */
    const STATUTS_VISITE = [
        { cle: "effectuee", libelle: "Effectuée", icone: "✅", couleur: "#16a34a" },
        { cle: "reportee", libelle: "Reportée", icone: "🔁", couleur: "#d97706" },
        { cle: "non-effectuee", libelle: "Non effectuée", icone: "⛔", couleur: "#dc2626" },
        { cle: "annulee", libelle: "Annulée", icone: "✖️", couleur: "#6b7280" }
    ];

    function statutVisite(v) {
        const s = v && v.statut;
        return STATUTS_VISITE.some(x => x.cle === s) ? s : "effectuee";
    }

    function estEffectuee(v) { return statutVisite(v) === "effectuee"; }

    function infoStatut(cle) { return STATUTS_VISITE.find(x => x.cle === cle) || STATUTS_VISITE[0]; }

    function typeVisite(cle) {
        return TYPES_VISITE.find(t => t.cle === cle) ||
            { cle, libelle: String(cle || "Autre"), couleur: "#6b7280", champs: [] };
    }

    function normaliserType(cle) {
        return TYPES_VISITE.some(t => t.cle === cle) ? cle : "campagne";
    }

    /* Ne garde que les références et détails renseignés (et connus du type). */
    function preparerComplements(source, type) {
        const t = typeVisite(type);
        const references = {}, details = {};
        if (t.references && source.references) REFERENCES.forEach(r => {
            const v = nettoyer(source.references[r.cle]);
            if (v) references[r.cle] = v;
        });
        if (source.details) t.champs.forEach(c => {
            const v = nettoyer(source.details[c.cle]);
            if (v) details[c.cle] = v;
        });
        return { references, details };
    }

    const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet",
        "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

    let donnees = null;
    const ecouteurs = [];
    const ecouteursErreur = [];

    /* ---------- Structure vide ---------- */

    function structureVide() {
        return {
            version: VERSION,
            profil: { nom: "Alexandre", theme: "light" },
            clients: [], contacts: [], lignes: [], visites: [], rdv: []
        };
    }

    /* ---------- Lecture / écriture ---------- */

    function init() {
        let brut = null;
        try { brut = localStorage.getItem(CLE_STOCKAGE); } catch (e) { brut = null; }
        if (brut) {
            try { donnees = normaliser(JSON.parse(brut)); }
            catch (e) { donnees = structureVide(); }
        } else {
            donnees = structureVide();
        }
        initSuivi();
        return donnees;
    }

    /* Garantit que toutes les collections existent, même sur un fichier
       importé incomplet ou une ancienne version. */
    function normaliser(d) {
        const base = structureVide();
        if (!d || typeof d !== "object") return base;
        return {
            version: VERSION,
            profil: Object.assign(base.profil, d.profil || {}),
            clients: Array.isArray(d.clients) ? d.clients : [],
            contacts: Array.isArray(d.contacts) ? d.contacts : [],
            lignes: Array.isArray(d.lignes) ? d.lignes : [],
            visites: Array.isArray(d.visites) ? d.visites : [],
            rdv: Array.isArray(d.rdv) ? d.rdv : []
        };
    }

    /* Renvoie false si le navigateur refuse l'écriture (stockage plein,
       navigation privée) — l'appelant prévient l'utilisateur.
       Toute modification passe par ici : c'est donc ici qu'on repère ce
       qui a changé, pour la synchronisation. */
    function sauvegarder() {
        const changements = detecterChangements();
        const ok = ecrire();
        if (changements > 0) ecouteursLocaux.forEach(fn => { try { fn(); } catch (e) { Erreurs.consigner("Donnees : idem", e); } });
        return ok;
    }

    let derniereEcritureOk = true;      // résultat de la DERNIÈRE écriture : les messages de succès l'interrogent (Donnees.stockageOk)

    function ecrire() {
        let ok = true;
        try {
            localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
            localStorage.setItem(CLE_SUIVI, JSON.stringify(suivi));
        } catch (e) { ok = false; Erreurs.consigner("Donnees : écriture refusée par le navigateur (stockage plein ou mode privé)", e); }
        derniereEcritureOk = ok;
        if (!ok) ecouteursErreur.forEach(fn => { try { fn(); } catch (e) { Erreurs.consigner("Donnees : idem", e); } });
        ecouteurs.forEach(fn => { try { fn(); } catch (e) { Erreurs.signaler("Donnees : un écouteur ne bloque pas les autres", e); } });
        return ok;
    }

    /* ---------- Suivi des modifications (synchronisation) ----------
       Plutôt que d'instrumenter chaque fonction qui modifie (et risquer
       d'en oublier une), on compare à chaque enregistrement l'état de
       chaque élément à son empreinte précédente :
         - élément nouveau ou modifié → majLe = maintenant, « à envoyer »
         - élément disparu            → marqueur de suppression « à envoyer »
       Le profil n'est synchronisé que pour le nom : le thème reste propre
       à chaque appareil (sombre sur le téléphone, clair au bureau…).
       Stocké à part (CLE_SUIVI) : n'apparaît pas dans les sauvegardes JSON. */

    const CLE_SUIVI = "acsc_synchro_v1";
    const COLLECTIONS = ["clients", "contacts", "lignes", "visites", "rdv"];
    let suivi = null;          // { enAttente: {cle: true}, suppressions: {cle: iso}, curseur }
    let empreintes = null;     // Map cle → empreinte (reconstruite à chaque ouverture)
    const ecouteursLocaux = [];

    function empreinte(element) {
        const copie = Object.assign({}, element);
        delete copie.majLe;
        return JSON.stringify(copie);
    }

    /* Le nom et les réglages de tournée suivent le compte d'un appareil à
       l'autre ; le thème reste propre à chaque appareil. */
    function profilSynchro() { return { nom: donnees.profil.nom, tournee: donnees.profil.tournee || null }; }

    /* Parcourt tous les éléments synchronisables : fn(collection, id, element). */
    function pourChaqueElement(fn) {
        COLLECTIONS.forEach(col => donnees[col].forEach(el => fn(col, el.id, el)));
        fn("profil", "profil", profilSynchro());
    }

    function initSuivi() {
        let brut = null;
        try { brut = JSON.parse(localStorage.getItem(CLE_SUIVI) || "null"); } catch (e) { brut = null; }
        const premiereFois = !brut;
        suivi = {
            enAttente: (brut && brut.enAttente) || {},
            suppressions: (brut && brut.suppressions) || {},
            curseur: (brut && brut.curseur) || null,
            curseursEquipe: (brut && brut.curseursEquipe) || {}
        };
        empreintes = new Map();
        const maintenant = new Date().toISOString();
        pourChaqueElement((col, id, el) => {
            const cle = col + ":" + id;
            empreintes.set(cle, empreinte(el));
            if (col !== "profil" && !el.majLe) el.majLe = maintenant;
            /* Première ouverture avec la synchronisation : les données déjà
               saisies sur cet appareil partiront au premier envoi. */
            if (premiereFois && col !== "profil") suivi.enAttente[cle] = true;
        });
        if (premiereFois && donnees.profil.nom !== structureVide().profil.nom) {
            donnees.profil.majLe = maintenant;
            suivi.enAttente["profil:profil"] = true;
        }
    }

    function detecterChangements() {
        if (!empreintes) initSuivi();
        const maintenant = new Date().toISOString();
        const vus = new Set();
        let n = 0;
        pourChaqueElement((col, id, el) => {
            const cle = col + ":" + id;
            vus.add(cle);
            const e = empreinte(el);
            if (empreintes.get(cle) === e) return;
            empreintes.set(cle, e);
            if (col === "profil") donnees.profil.majLe = maintenant; else el.majLe = maintenant;
            suivi.enAttente[cle] = true;
            delete suivi.suppressions[cle];
            n++;
        });
        Array.from(empreintes.keys()).forEach(cle => {
            if (vus.has(cle)) return;
            empreintes.delete(cle);
            suivi.suppressions[cle] = maintenant;
            suivi.enAttente[cle] = true;
            n++;
        });
        return n;
    }

    function trouverElement(col, id) {
        return col === "profil" ? profilSynchro() : donnees[col].find(el => el.id === id) || null;
    }

    function dateElement(cle) {
        const [col, id] = separerCle(cle);
        if (suivi.suppressions[cle]) return suivi.suppressions[cle];
        return col === "profil" ? (donnees.profil.majLe || new Date(0).toISOString()) : ((trouverElement(col, id) || {}).majLe);
    }

    function separerCle(cle) {
        const i = cle.indexOf(":");
        return [cle.slice(0, i), cle.slice(i + 1)];
    }

    /* Éléments à envoyer, au format de la table « elements ». */
    function elementsAEnvoyer() {
        getDonnees();
        return Object.keys(suivi.enAttente).map(cle => {
            const [collection, id] = separerCle(cle);
            if (suivi.suppressions[cle]) {
                return { collection, id, contenu: null, maj_client: suivi.suppressions[cle], supprime: true };
            }
            const el = trouverElement(collection, id);
            if (!el) return null;
            return { collection, id, contenu: el, maj_client: dateElement(cle), supprime: false };
        }).filter(Boolean);
    }

    /* Après un envoi réussi : on retire de la file ce qui n'a pas été
       modifié entre-temps (sinon il repartira au prochain envoi). */
    function confirmerEnvoi(lot) {
        lot.forEach(item => {
            const cle = item.collection + ":" + item.id;
            if (dateElement(cle) === item.maj_client) {
                delete suivi.enAttente[cle];
                delete suivi.suppressions[cle];
            }
        });
        try { localStorage.setItem(CLE_SUIVI, JSON.stringify(suivi)); } catch (e) { Erreurs.consigner("Donnees : retenté au prochain enregistrement", e); }
    }

    /* Applique les éléments reçus d'un autre appareil. La version locale
       n'est gardée que si elle est en attente d'envoi ET plus récente.
       Renvoie le nombre d'éléments réellement modifiés. */
    function appliquerDistant(lignes) {
        getDonnees();
        let n = 0;
        lignes.forEach(r => {
            if (r.collection !== "profil" && COLLECTIONS.indexOf(r.collection) === -1) return;
            const cle = r.collection + ":" + r.id;
            const dateDistante = Date.parse(r.maj_client);
            if (suivi.enAttente[cle]) {
                const locale = Date.parse(dateElement(cle));
                if (!isNaN(locale) && locale > dateDistante) return;
            }
            delete suivi.enAttente[cle];
            delete suivi.suppressions[cle];

            if (r.collection === "profil") {
                if (r.supprime || !r.contenu) return;
                const e = empreinte({ nom: r.contenu.nom, tournee: r.contenu.tournee || null });
                if (empreintes.get(cle) === e) return;
                donnees.profil.nom = r.contenu.nom;
                if (r.contenu.tournee) donnees.profil.tournee = r.contenu.tournee;
                donnees.profil.majLe = r.contenu.majLe || r.maj_client;
                empreintes.set(cle, e);
                n++;
                return;
            }

            const liste = donnees[r.collection];
            const i = liste.findIndex(el => el.id === r.id);
            if (r.supprime || !r.contenu) {
                if (i !== -1) { liste.splice(i, 1); n++; }
                empreintes.delete(cle);
                return;
            }
            const e = empreinte(r.contenu);
            if (i !== -1 && empreintes.get(cle) === e) return;
            const element = Object.assign({}, r.contenu, { id: r.id });
            if (i === -1) liste.push(element); else liste[i] = element;
            empreintes.set(cle, e);
            n++;
        });
        if (n > 0) ecrire();
        else { try { localStorage.setItem(CLE_SUIVI, JSON.stringify(suivi)); } catch (e) { Erreurs.consigner("Donnees : retenté au prochain enregistrement", e); } }
        return n;
    }

    /* Curseur de réception : espace personnel (défaut) ou espace d'une
       équipe (un curseur par équipe, identifiée par son id). */
    function getCurseur(equipeId) {
        getDonnees();
        return equipeId ? (suivi.curseursEquipe[equipeId] || null) : suivi.curseur;
    }

    function definirCurseur(valeur, equipeId) {
        getDonnees();
        if (equipeId) suivi.curseursEquipe[equipeId] = valeur; else suivi.curseur = valeur;
        try { localStorage.setItem(CLE_SUIVI, JSON.stringify(suivi)); } catch (e) { Erreurs.consigner("Donnees : retenté au prochain enregistrement", e); }
    }

    /* ---------- Équipe ----------
       Clients, contacts et lignes sont partagés avec l'équipe ; visites,
       rendez-vous et profil restent personnels. */
    const COLLECTIONS_PARTAGEES = ["clients", "contacts", "lignes"];

    /* À l'entrée ou à la sortie d'une équipe : tout le partageable repart
       vers le nouvel espace au prochain envoi. */
    function marquerPartagesAEnvoyer() {
        getDonnees();
        COLLECTIONS_PARTAGEES.forEach(col => donnees[col].forEach(el => { suivi.enAttente[col + ":" + el.id] = true; }));
        try { localStorage.setItem(CLE_SUIVI, JSON.stringify(suivi)); } catch (e) { Erreurs.consigner("Donnees : retenté au prochain enregistrement", e); }
    }

    /* Rejoindre une équipe en remplaçant ses propres clients par ceux de
       l'équipe : clients, contacts et lignes sont retirés de l'appareil SANS
       marqueur de suppression (rien n'est effacé chez l'équipe) ; les visites
       et rendez-vous de ces clients, eux, sont supprimés normalement. */
    function oublierPartages() {
        getDonnees();
        const clientsRetires = new Set(donnees.clients.map(c => c.id));
        COLLECTIONS_PARTAGEES.forEach(col => {
            donnees[col].forEach(el => {
                const cle = col + ":" + el.id;
                empreintes.delete(cle);
                delete suivi.enAttente[cle];
                delete suivi.suppressions[cle];
            });
            donnees[col] = [];
        });
        donnees.visites = donnees.visites.filter(v => !clientsRetires.has(v.clientId));
        donnees.rdv = donnees.rdv.filter(r => !clientsRetires.has(r.clientId));
        return sauvegarder();
    }

    function nbEnAttente() { getDonnees(); return Object.keys(suivi.enAttente).length; }

    /* Déclenché uniquement par une saisie sur CET appareil (pas par une
       réception) : Synchro s'en sert pour envoyer quelques secondes après. */
    function ecouterChangementsLocaux(fn) { ecouteursLocaux.push(fn); }

    function getDonnees() {
        if (!donnees) init();
        return donnees;
    }

    function ecouter(fn) { ecouteurs.push(fn); }

    /* Appelé quand le navigateur refuse d'enregistrer (stockage plein,
       navigation privée) : AppLayout affiche l'alerte, une seule fois. */
    function surErreurStockage(fn) { ecouteursErreur.push(fn); }
    /* Vrai si la dernière écriture sur l'appareil a réussi. Faux = les modifications ne survivront PAS à un rechargement. */
    function stockageOk() { return derniereEcritureOk; }

    function nouvelId(prefixe) {
        return prefixe + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function nettoyer(valeur) {
        return typeof valeur === "string" ? valeur.trim() : valeur;
    }

    /* ---------- Profil ---------- */

    function definirTheme(theme) {
        getDonnees().profil.theme = theme === "dark" ? "dark" : "light";
        return sauvegarder();
    }

    function definirNomProfil(nom) {
        const n = nettoyer(nom);
        if (!n) return false;
        getDonnees().profil.nom = n;
        return sauvegarder();
    }

    /* ---------- Clients ---------- */

    const CHAMPS_CLIENT = ["nom", "groupe", "adresse", "codePostal", "ville", "region", "pays",
        "telephone", "email", "typeProduction", "debutCampagne", "finCampagne",
        "cadenceJours", "actif", "notes", "technicien"];

    /* ---------- Technicien (équipe) ----------
       En équipe, chaque client peut être attribué à un technicien
       (client.technicien = identifiant du compte). Les rappels, la tournée
       et le planning ne gardent que les clients du technicien connecté et
       les clients non attribués. Hors équipe : pas de filtre. */
    let technicienCourant = null;

    function definirTechnicienCourant(id) {
        const nouveau = id || null;
        if (nouveau === technicienCourant) return;
        technicienCourant = nouveau;
        getDonnees();
        ecouteurs.forEach(fn => { try { fn(); } catch (e) { Erreurs.consigner("Donnees : retenté au prochain enregistrement", e); } });
    }

    function getTechnicienCourant() { return technicienCourant; }

    function estMonClient(c) {
        return !technicienCourant || !c || !c.technicien || c.technicien === technicienCourant;
    }

    function preparerClient(source, existant) {
        const c = existant || { id: nouvelId("cli"), creeLe: aujourdhuiIso() };
        CHAMPS_CLIENT.forEach(ch => { if (source[ch] !== undefined) c[ch] = nettoyer(source[ch]); });
        c.debutCampagne = borne(parseInt(c.debutCampagne, 10), 1, 12, 5);
        c.finCampagne = borne(parseInt(c.finCampagne, 10), 1, 12, 11);
        c.cadenceJours = borne(parseInt(c.cadenceJours, 10), 7, 60, 14);
        c.actif = c.actif !== false;
        c.pays = c.pays || "France";
        return c;
    }

    function borne(n, min, max, defaut) {
        if (isNaN(n)) return defaut;
        return Math.min(max, Math.max(min, n));
    }

    function listerClients() {
        return getDonnees().clients.slice().sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    }

    function getClient(id) {
        return getDonnees().clients.find(c => c.id === id) || null;
    }

    function trouverClientParNom(nom) {
        const cible = normaliserTexte(nom);
        return getDonnees().clients.find(c => normaliserTexte(c.nom) === cible) || null;
    }

    function ajouterClient(source) {
        if (!nettoyer(source.nom)) return null;
        const c = preparerClient(source);
        getDonnees().clients.push(c);
        sauvegarder();
        return c;
    }

    function modifierClient(id, source) {
        const c = getClient(id);
        if (!c) return null;
        preparerClient(source, c);
        sauvegarder();
        return c;
    }

    /* Ce que supprimerClients() emporterait, pour le montrer avant de confirmer. */
    function resumeSuppression(ids) {
        const d = getDonnees(), set = new Set(ids);
        const de = (liste) => liste.filter(x => set.has(x.clientId)).length;
        return { nbClients: d.clients.filter(c => set.has(c.id)).length, nbLignes: de(d.lignes), nbContacts: de(d.contacts),
            nbVisites: de(d.visites), nbRdv: de(d.rdv) };
    }

    /* Supprime plusieurs clients ET tout ce qui leur est rattaché, en un seul
       enregistrement. Renvoie une copie de ce qui a été retiré : restaurerClients()
       la remet en place (bouton « Annuler »). */
    function supprimerClients(ids) {
        const d = getDonnees(), set = new Set(ids);
        const copie = {
            clients: d.clients.filter(c => set.has(c.id)), contacts: d.contacts.filter(x => set.has(x.clientId)),
            lignes: d.lignes.filter(x => set.has(x.clientId)), visites: d.visites.filter(x => set.has(x.clientId)),
            rdv: d.rdv.filter(x => set.has(x.clientId))
        };
        d.clients = d.clients.filter(c => !set.has(c.id));
        ["contacts", "lignes", "visites", "rdv"].forEach(col => { d[col] = d[col].filter(x => !set.has(x.clientId)); });
        sauvegarder();
        return JSON.parse(JSON.stringify(copie));
    }

    /* Remet en place une copie de supprimerClients(). Les éléments sont
       re-datés à l'enregistrement : la restauration l'emporte sur la suppression
       déjà envoyée aux autres appareils. Renvoie le nombre de clients restaurés. */
    function restaurerClients(copie) {
        if (!copie || !Array.isArray(copie.clients)) return 0;
        const d = getDonnees();
        let n = 0;
        ["clients", "contacts", "lignes", "visites", "rdv"].forEach(col => {
            (copie[col] || []).forEach(x => {
                if (d[col].some(y => y.id === x.id)) return;
                d[col].push(x);
                if (col === "clients") n++;
            });
        });
        sauvegarder();
        return n;
    }

    /* ---------- Contacts ---------- */

    const CHAMPS_CONTACT = ["role", "prenom", "nom", "telephoneFixe", "mobile", "email", "principal", "notes"];

    function contactsDuClient(clientId) {
        return getDonnees().contacts
            .filter(x => x.clientId === clientId)
            .sort((a, b) => (b.principal ? 1 : 0) - (a.principal ? 1 : 0) ||
                ROLES_CONTACT.indexOf(a.role) - ROLES_CONTACT.indexOf(b.role));
    }

    function enregistrerContact(clientId, source, id) {
        const d = getDonnees();
        let x = id ? d.contacts.find(k => k.id === id) : null;
        if (!x) { x = { id: nouvelId("con"), clientId }; d.contacts.push(x); }
        CHAMPS_CONTACT.forEach(ch => { if (source[ch] !== undefined) x[ch] = nettoyer(source[ch]); });
        x.principal = !!x.principal;
        /* Un seul contact principal par client. */
        if (x.principal) d.contacts.forEach(k => { if (k.clientId === clientId && k.id !== x.id) k.principal = false; });
        sauvegarder();
        return x;
    }

    function supprimerContact(id) {
        const d = getDonnees();
        d.contacts = d.contacts.filter(x => x.id !== id);
        return sauvegarder();
    }

    /* ---------- Lignes de production ---------- */

    const CHAMPS_OUTILLAGE = [];
    OUTILS.forEach(o => CHAMPS_OUTILLAGE.push(o.cle + "Fournisseur", o.cle + "Ref"));

    const CHAMPS_LIGNE = CHAMPS_OUTILLAGE.concat(["nom", "marque", "modele", "numeroSerie", "formatHabituel",
        "produitHabituel", "cadenceLigne", "suiviCampagne", "statut", "fournisseurActuel", "notes",
        "nbTetes", "colonneSerti"]);

    /* Statut d'une ligne. Seule une ligne « active » entre dans les rappels,
       les visites et les rendez-vous ; son historique reste consultable
       quel que soit le statut. Une ligne créée avant l'arrivée du statut
       le déduit de l'ancienne case « suivie en campagne ». */
    const STATUTS_LIGNE = [
        { cle: "active", libelle: "Active" },
        { cle: "inactive", libelle: "Inactive" },
        { cle: "concurrent", libelle: "Autre fournisseur" }
    ];

    function statutLigne(l) {
        if (l && STATUTS_LIGNE.some(s => s.cle === l.statut)) return l.statut;
        return l && l.suiviCampagne === false ? "inactive" : "active";
    }

    function estLigneActive(l) { return statutLigne(l) === "active"; }

    /* Après toute modification : statut valide, ancienne case alignée,
       fournisseur actuel effacé s'il ne s'agit plus d'un autre fournisseur. */
    function harmoniserStatut(x, source) {
        if (!STATUTS_LIGNE.some(s => s.cle === source.statut) && source.suiviCampagne !== undefined) {
            x.statut = source.suiviCampagne === false ? "inactive" : "active";
        }
        x.statut = statutLigne(x);
        x.suiviCampagne = x.statut === "active";
        if (x.statut !== "concurrent") x.fournisseurActuel = "";
    }

    function lignesDuClient(clientId) {
        return getDonnees().lignes
            .filter(x => x.clientId === clientId)
            .sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr", { numeric: true }));
    }

    function getLigne(id) {
        return getDonnees().lignes.find(x => x.id === id) || null;
    }

    function enregistrerLigne(clientId, source, id) {
        const d = getDonnees();
        let x = id ? d.lignes.find(k => k.id === id) : null;
        if (!x) { x = { id: nouvelId("lig"), clientId, statut: "active", suiviCampagne: true }; d.lignes.push(x); }
        CHAMPS_LIGNE.forEach(ch => { if (source[ch] !== undefined) x[ch] = nettoyer(source[ch]); });
        /* Serti : têtes (0 à 24, par paire) et colonne du référentiel, sinon vide. */
        if (source.nbTetes !== undefined) { const nb = SertiCalcul.normaliserNbTetes(source.nbTetes); x.nbTetes = nb === null ? "" : nb; }
        if (source.colonneSerti !== undefined) x.colonneSerti = ReferentielSerti.colonne(source.colonneSerti) ? source.colonneSerti : "";
        harmoniserStatut(x, source);
        sauvegarder();
        return x;
    }

    function definirStatutLigne(id, statut, fournisseurActuel) {
        const x = getLigne(id);
        if (!x || !STATUTS_LIGNE.some(s => s.cle === statut)) return null;
        x.statut = statut;
        if (fournisseurActuel !== undefined) x.fournisseurActuel = nettoyer(fournisseurActuel) || "";
        harmoniserStatut(x, { statut });
        sauvegarder();
        return x;
    }

    function lignesActivesDuClient(clientId) {
        return lignesDuClient(clientId).filter(estLigneActive);
    }

    function supprimerLigne(id) {
        const d = getDonnees();
        d.lignes = d.lignes.filter(x => x.id !== id);
        d.visites = d.visites.filter(v => v.ligneId !== id);
        d.rdv.forEach(r => { if (Array.isArray(r.ligneIds)) r.ligneIds = r.ligneIds.filter(x => x !== id); });
        return sauvegarder();
    }

    /* Fournisseurs proposés dans les listes : ceux d'office + tous ceux
       déjà saisis sur une ligne, sans doublon (casse et accents ignorés). */
    function fournisseursOutillage() {
        const vus = {};
        FOURNISSEURS_OUTILLAGE.concat(...getDonnees().lignes.map(l => OUTILS.map(o => l[o.cle + "Fournisseur"])))
            .forEach(f => { if (f && !vus[normaliserTexte(f)]) vus[normaliserTexte(f)] = f.trim(); });
        return Object.keys(vus).map(k => vus[k]).sort((a, b) => a.localeCompare(b, "fr"));
    }

    /* ---------- Visites ---------- */

    /* Visites EFFECTUÉES seulement (dernière visite, statistiques, planning…). */
    function visitesDuClient(clientId) {
        return getDonnees().visites
            .filter(v => v.clientId === clientId && estEffectuee(v))
            .sort((a, b) => b.date.localeCompare(a.date));
    }

    function visitesDeLaLigne(ligneId) {
        return getDonnees().visites
            .filter(v => v.ligneId === ligneId && estEffectuee(v))
            .sort((a, b) => b.date.localeCompare(a.date));
    }

    /* Historique complet d'un client : tous les statuts (effectuée, reportée, non effectuée, annulée). */
    /* Visites effectuées qui portent un contrôle de serti (page Serti), la plus récente d'abord. */
    function visitesAvecMesures() {
        return getDonnees().visites.filter(v => v.mesures).sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
    }

    function historiqueDuClient(clientId) {
        return getDonnees().visites
            .filter(v => v.clientId === clientId)
            .sort((a, b) => b.date.localeCompare(a.date));
    }

    const estDateIso = (valeur) => /^\d{4}-\d{2}-\d{2}$/.test(valeur || "");

    /* Construit une visite valide ou renvoie null. Ligne obligatoire pour une visite EFFECTUÉE,
       sauf pour les types « ligneFacultative » (réunion, formation, audit) ; une visite reportée,
       non effectuée ou annulée peut ne concerner que le client. Pour ces dernières, le statut, le
       motif et la nouvelle date (reportée) sont gardés ; format, produit et détails ne le sont pas. */
    function construireVisite(source, clientImpose) {
        if (!estDateIso(source.date)) return null;
        const type = normaliserType(source.type);
        const statut = statutVisite(source);
        const effectuee = statut === "effectuee";
        const ligne = source.ligneId ? getLigne(source.ligneId) : null;
        if (source.ligneId && !ligne) return null;
        if (!ligne && effectuee && !typeVisite(type).ligneFacultative) return null;
        const clientId = ligne ? ligne.clientId : source.clientId;
        if (!getClient(clientId) || (clientImpose && clientId !== clientImpose)) return null;
        const v = Object.assign({
            id: nouvelId("vis"), clientId, ligneId: ligne ? ligne.id : null, date: source.date, type,
            format: effectuee ? (nettoyer(source.format) || "") : "", produit: effectuee ? (nettoyer(source.produit) || "") : "",
            remarques: nettoyer(source.remarques) || ""
        }, effectuee ? preparerComplements(source, type) : { references: {}, details: {} });
        if (effectuee && source.mesures) {
            const m = SertiCalcul.nettoyer(source.mesures);
            if (m) v.mesures = m;
        }
        if (!effectuee) {
            v.statut = statut;
            v.motif = nettoyer(source.motif) || "";
            if (statut === "reportee" && estDateIso(source.reporteLe)) v.reporteLe = source.reporteLe;
        }
        return v;
    }

    function enregistrerVisite(source) {
        const v = construireVisite(source);
        if (!v) return null;
        getDonnees().visites.push(v);
        sauvegarder();
        return v;
    }

    /* Modifie une visite enregistrée (même règles que la création). */
    function modifierVisite(id, source) {
        const d = getDonnees();
        const i = d.visites.findIndex(v => v.id === id);
        if (i === -1) return null;
        const v = construireVisite(source);
        if (!v) return null;
        v.id = id;
        d.visites[i] = v;
        sauvegarder();
        return v;
    }

    function getVisite(id) { return getDonnees().visites.find(v => v.id === id) || null; }

    function supprimerVisite(id) {
        const d = getDonnees();
        d.visites = d.visites.filter(v => v.id !== id);
        return sauvegarder();
    }

    /* Issue d'un rendez-vous qui n'a pas donné de visite : REPORTÉ (le rendez-vous est déplacé à
       o.reporteLe, aujourd'hui ou plus tard) ou NON EFFECTUÉ / ANNULÉ (il est retiré). Dans tous les
       cas, une ligne est ajoutée à l'historique (une par ligne du rendez-vous, sinon une pour le
       client) avec le motif. Renvoie les lignes créées, ou null si la demande est invalide. */
    function cloturerSansVisite(id, o) {
        const r = getRdv(id);
        if (!r || !o) return null;
        const statut = ["reportee", "non-effectuee", "annulee"].indexOf(o.statut) !== -1 ? o.statut : null;
        if (!statut) return null;
        if (statut === "reportee" && !(estDateIso(o.reporteLe) && o.reporteLe >= aujourdhuiIso())) return null;
        const d = getDonnees();
        const base = { clientId: r.clientId, date: r.date, type: r.type, statut, motif: o.motif, reporteLe: o.reporteLe, remarques: o.remarques };
        const lignes = (r.ligneIds || []).filter(x => getLigne(x));
        const creees = (lignes.length ? lignes.map(ligneId => Object.assign({ ligneId }, base)) : [base])
            .map(src => construireVisite(src)).filter(Boolean);
        if (!creees.length) return null;
        creees.forEach(v => d.visites.push(v));
        if (statut === "reportee") { r.date = o.reporteLe; r.statut = "confirme"; }
        else d.rdv = d.rdv.filter(x => x.id !== id);
        sauvegarder();
        return creees;
    }

    /* ---------- Rendez-vous (visites planifiées) ---------- */

    function trierRdv(a, b) {
        return a.date.localeCompare(b.date) || String(a.heure || "").localeCompare(String(b.heure || ""));
    }

    function listerRdv() { return getDonnees().rdv.slice().sort(trierRdv); }

    function rdvDuClient(clientId) { return listerRdv().filter(r => r.clientId === clientId); }

    function getRdv(id) { return getDonnees().rdv.find(r => r.id === id) || null; }

    /* Renvoie le rendez-vous, ou null si client inconnu / date invalide. */
    function enregistrerRdv(source, id) {
        const d = getDonnees();
        if (!getClient(source.clientId) || !estDateIso(source.date)) return null;
        let r = id ? d.rdv.find(x => x.id === id) : null;
        if (!r) { r = { id: nouvelId("rdv") }; d.rdv.push(r); }
        const lignesClient = d.lignes.filter(l => l.clientId === source.clientId).map(l => l.id);
        r.clientId = source.clientId;
        r.ligneIds = (source.ligneIds || []).filter(x => lignesClient.indexOf(x) !== -1);
        r.date = source.date;
        r.heure = /^\d{2}:\d{2}$/.test(source.heure || "") ? source.heure : "";
        r.type = normaliserType(source.type);
        r.notes = nettoyer(source.notes) || "";
        /* Références seulement pour les types qui les prévoient dès la
           planification (homologation, essai interne). */
        r.references = typeVisite(r.type).referencesRdv ? preparerComplements(source, r.type).references : {};
        /* Un rendez-vous saisi ou modifié à la main est confirmé ; seules les
           propositions automatiques naissent « proposé ». */
        r.statut = source.statut === "propose" ? "propose" : "confirme";
        r.origine = source.origine === "auto" ? "auto" : (r.origine || "");
        sauvegarder();
        return r;
    }

    function estPropose(r) { return r && r.statut === "propose"; }

    function confirmerRdv(id) {
        const r = getRdv(id);
        if (!r) return null;
        r.statut = "confirme";
        sauvegarder();
        return r;
    }

    function confirmerTousLesRdv() {
        const d = getDonnees();
        const confirmes = d.rdv.filter(estPropose);
        confirmes.forEach(r => { r.statut = "confirme"; });
        if (confirmes.length) sauvegarder();
        return confirmes;
    }

    /* Rendez-vous confirmés dont la date est passée : à clôturer
       (visite faite, reportée ou annulée). */
    function rdvACloturer(iso) {
        const ref = iso || aujourdhuiIso();
        return listerRdv().filter(r => !estPropose(r) && r.date < ref);
    }

    /* ---------- Tournée automatique ----------
       Réglages (synchronisés avec le profil) :
         jours           jours travaillés (1 = lundi … 7 = dimanche)
         maxParJour      nombre maximum de clients par jour
         unDepartement   un seul département par jour (moins de route)
         horizon         nombre de jours couverts par les propositions
         heureDebut      heure du premier rendez-vous proposé
         ecartHeures     écart entre deux rendez-vous d'une même journée
         jourAuto        jour de la semaine où les propositions sont
                         refaites automatiquement (0 = jamais)
         messageClient   proposer un SMS / email au contact à la confirmation
         heureRappel     heure du résumé du matin (notification push, lue
                         par la fonction serveur « rappels »)
         prevenirVersions  prévenir (notification) d'une mise à jour ou d'une nouvelle
                         fonctionnalité ; lu aussi par la fonction serveur « rappels » */
    const TOURNEE_DEFAUT = {
        jours: [1, 2, 3, 4, 5], maxParJour: 3, unDepartement: true, horizon: 14,
        heureDebut: "08:30", ecartHeures: 2, jourAuto: 5, messageClient: true, derniereGeneration: null,
        heureRappel: "07:30", bilanSemaines: 6, prevenirVersions: true
    };

    function getTournee() {
        return Object.assign({}, TOURNEE_DEFAUT, getDonnees().profil.tournee || {});
    }

    function definirTournee(valeurs) {
        const t = Object.assign(getTournee(), valeurs || {});
        t.jours = (t.jours || []).map(Number).filter(j => j >= 1 && j <= 7).sort();
        if (!t.jours.length) t.jours = TOURNEE_DEFAUT.jours.slice();
        t.maxParJour = borne(parseInt(t.maxParJour, 10), 1, 8, TOURNEE_DEFAUT.maxParJour);
        t.horizon = borne(parseInt(t.horizon, 10), 7, 28, TOURNEE_DEFAUT.horizon);
        t.ecartHeures = borne(parseInt(t.ecartHeures, 10), 1, 4, TOURNEE_DEFAUT.ecartHeures);
        t.jourAuto = borne(parseInt(t.jourAuto, 10), 0, 7, TOURNEE_DEFAUT.jourAuto);
        t.heureDebut = /^\d{2}:\d{2}$/.test(t.heureDebut || "") ? t.heureDebut : TOURNEE_DEFAUT.heureDebut;
        t.heureRappel = /^\d{2}:\d{2}$/.test(t.heureRappel || "") ? t.heureRappel : TOURNEE_DEFAUT.heureRappel;
        t.bilanSemaines = borne(parseInt(t.bilanSemaines, 10), 0, 12, TOURNEE_DEFAUT.bilanSemaines);
        t.unDepartement = t.unDepartement !== false;
        t.prevenirVersions = t.prevenirVersions !== false;
        t.messageClient = t.messageClient !== false;
        getDonnees().profil.tournee = t;
        sauvegarder();
        return t;
    }

    function jourSemaine(iso) {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
    }

    /* Date demandée si c'est un jour travaillé (réglages de la Tournée), sinon le prochain :
       planifier un samedi décale au lundi. */
    function prochainJourTravaille(iso) {
        const jours = getTournee().jours;
        let j = iso;
        for (let i = 0; i < 8; i++) {
            if (jours.indexOf(jourSemaine(j)) !== -1) return j;
            j = ajouterJours(j, 1);
        }
        return iso;
    }

    function ajouterHeures(heure, n) {
        const [h, mi] = heure.split(":").map(Number);
        const total = Math.min(23 * 60 + 59, h * 60 + mi + n * 60);
        return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
    }

    /* Lundi de la semaine d'une date. */
    function lundiDe(iso) { return ajouterJours(iso, 1 - jourSemaine(iso)); }

    /* Faut-il refaire les propositions ? Oui si le jour choisi de la
       semaine est atteint et qu'elles n'ont pas été faites depuis. */
    function propositionsAFaire(iso) {
        const ref = iso || aujourdhuiIso();
        const t = getTournee();
        if (!t.jourAuto) return false;
        const declenchement = ajouterJours(lundiDe(ref), t.jourAuto - 1);
        return ref >= declenchement && (!t.derniereGeneration || t.derniereGeneration < declenchement);
    }

    /* Propose une tournée sur les « horizon » prochains jours :
         - clients actifs, en campagne, avec des lignes actives à voir
           (en retard, pas encore vues, ou échéance dans l'horizon) ;
         - un client qui a déjà un rendez-vous à venir n'est pas reproposé ;
         - les plus urgents d'abord : retard / pas encore vus dès le
           prochain jour travaillé, les autres pas avant 3 jours avant leur
           échéance ;
         - au plus maxParJour clients par jour (rendez-vous existants
           compris), un seul département par jour si demandé.
       Les anciennes propositions non confirmées sont remplacées.
       Renvoie { creees: [rdv…], nonPlaces: [client…] }. */
    function proposerTournee(iso) {
        const ref = iso || aujourdhuiIso();
        const t = getTournee();
        const d = getDonnees();
        d.rdv = d.rdv.filter(r => !estPropose(r));

        const fin = ajouterJours(ref, t.horizon);
        const jours = [];
        for (let j = ajouterJours(ref, 1); j <= fin; j = ajouterJours(j, 1)) {
            if (t.jours.indexOf(jourSemaine(j)) !== -1) jours.push(j);
        }
        const departementDe = (c) => (typeof Departements !== "undefined" ? Departements.emplacement(c).departement : "") || "";
        const occupation = {};
        jours.forEach(j => { occupation[j] = { nb: 0, departements: new Set() }; });
        d.rdv.filter(r => r.date > ref && r.date <= fin && occupation[r.date]).forEach(r => {
            occupation[r.date].nb++;
            const c = getClient(r.clientId);
            if (c) occupation[r.date].departements.add(departementDe(c));
        });

        const dejaPrevus = new Set(d.rdv.filter(r => r.date >= ref).map(r => r.clientId));
        const parClient = {};
        calculerEcheances(ref).lignes.forEach(e => {
            if (dejaPrevus.has(e.client.id)) return;
            const urgent = e.statut === "retard" || e.statut === "jamais";
            if (!urgent && (!e.echeance || e.echeance > fin)) return;
            const p = parClient[e.client.id] || (parClient[e.client.id] = { client: e.client, lignes: [], echeance: null, urgent: false });
            p.lignes.push(e.ligne.id);
            p.urgent = p.urgent || urgent;
            const ech = urgent ? ref : e.echeance;
            if (!p.echeance || ech < p.echeance) p.echeance = ech;
        });
        const candidats = Object.keys(parClient).map(k => parClient[k])
            .sort((a, b) => (b.urgent - a.urgent) || a.echeance.localeCompare(b.echeance) || a.client.nom.localeCompare(b.client.nom, "fr"));

        const creees = [], nonPlaces = [];
        candidats.forEach(p => {
            const dep = departementDe(p.client);
            const auPlusTot = p.urgent ? ajouterJours(ref, 1) : ajouterJours(p.echeance, -3);
            const jour = jours.find(j => j >= auPlusTot && occupation[j].nb < t.maxParJour &&
                (!t.unDepartement || occupation[j].departements.size === 0 || occupation[j].departements.has(dep)));
            if (!jour) { nonPlaces.push(p.client); return; }
            const heure = ajouterHeures(t.heureDebut, occupation[jour].nb * t.ecartHeures);
            occupation[jour].nb++;
            occupation[jour].departements.add(dep);
            const r = {
                id: nouvelId("rdv"), clientId: p.client.id, ligneIds: p.lignes, date: jour, heure,
                type: "campagne", notes: "", references: {}, statut: "propose", origine: "auto"
            };
            d.rdv.push(r);
            creees.push(r);
        });

        getDonnees().profil.tournee = Object.assign(getTournee(), { derniereGeneration: ref });
        sauvegarder();
        return { creees, nonPlaces };
    }

    function supprimerRdv(id) {
        const d = getDonnees();
        d.rdv = d.rdv.filter(r => r.id !== id);
        return sauvegarder();
    }

    /* Rendez-vous effectué : enregistre les visites saisies (une par ligne)
       et retire le rendez-vous, en un seul enregistrement. */
    function realiserRdv(id, visites) {
        const d = getDonnees();
        const r = getRdv(id);
        if (!r) return null;
        const creees = [];
        visites.forEach(v => {
            const nv = construireVisite(Object.assign({ clientId: r.clientId }, v), r.clientId);
            if (!nv) return;
            d.visites.push(nv);
            creees.push(nv);
        });
        if (creees.length === 0) return null;
        d.rdv = d.rdv.filter(x => x.id !== id);
        sauvegarder();
        return creees;
    }

    function listerVisites() {
        return getDonnees().visites.filter(estEffectuee).sort((a, b) => a.date.localeCompare(b.date));
    }

    /* ---------- Import Excel (plan préparé par EchangesExcel.analyser) ----------
       Tout est appliqué en mémoire puis enregistré UNE seule fois : sinon
       chaque écouteur (page, pastilles) se redessinerait à chaque ligne.
       Règle : une cellule vide ne remplace jamais une valeur existante
       (les champs vides arrivent ici à undefined). */
    function appliquerImport(plan) {
        const d = getDonnees();
        const bilan = { clientsCrees: 0, clientsMaj: 0, contactsCrees: 0, contactsMaj: 0, lignesCreees: 0, lignesMaj: 0 };

        plan.clients.forEach(item => {
            const existant = trouverClientParNom(item.source.nom);
            if (existant) { preparerClient(item.source, existant); bilan.clientsMaj++; }
            else { d.clients.push(preparerClient(item.source)); bilan.clientsCrees++; }
        });

        plan.contacts.forEach(item => {
            const client = trouverClientParNom(item.clientNom);
            if (!client) return;
            const cle = normaliserTexte((item.source.prenom || "") + " " + (item.source.nom || ""));
            let x = d.contacts.find(k => k.clientId === client.id &&
                normaliserTexte((k.prenom || "") + " " + (k.nom || "")) === cle);
            if (x) bilan.contactsMaj++;
            else { x = { id: nouvelId("con"), clientId: client.id, principal: false }; d.contacts.push(x); bilan.contactsCrees++; }
            CHAMPS_CONTACT.forEach(ch => { if (item.source[ch] !== undefined) x[ch] = nettoyer(item.source[ch]); });
            x.principal = !!x.principal;
            if (x.principal) d.contacts.forEach(k => { if (k.clientId === client.id && k.id !== x.id) k.principal = false; });
        });

        plan.lignes.forEach(item => {
            const client = trouverClientParNom(item.clientNom);
            if (!client) return;
            const cle = normaliserTexte(item.source.nom);
            let x = d.lignes.find(l => l.clientId === client.id && normaliserTexte(l.nom) === cle);
            if (x) bilan.lignesMaj++;
            else { x = { id: nouvelId("lig"), clientId: client.id, statut: "active", suiviCampagne: true }; d.lignes.push(x); bilan.lignesCreees++; }
            CHAMPS_LIGNE.forEach(ch => { if (item.source[ch] !== undefined) x[ch] = nettoyer(item.source[ch]); });
            harmoniserStatut(x, item.source);
        });

        bilan.ok = sauvegarder();
        return bilan;
    }

    /* ---------- Dates ---------- */

    function aujourdhuiIso(date) {
        const d = date || new Date();
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
    }

    /* Nombre de jours entiers entre deux dates ISO (b - a), sans piège
       d'heure d'été : calcul en UTC. */
    function ecartJours(isoA, isoB) {
        const [ya, ma, da] = isoA.split("-").map(Number);
        const [yb, mb, db] = isoB.split("-").map(Number);
        return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
    }

    function ajouterJours(iso, n) {
        const [y, m, d] = iso.split("-").map(Number);
        const t = new Date(Date.UTC(y, m - 1, d + n));
        return t.getUTCFullYear() + "-" + String(t.getUTCMonth() + 1).padStart(2, "0") + "-" +
            String(t.getUTCDate()).padStart(2, "0");
    }

    /* ---------- Campagne ---------- */

    /* Gère aussi une campagne à cheval sur deux années (ex. novembre → mars). */
    function estEnCampagne(client, iso) {
        const mois = Number((iso || aujourdhuiIso()).split("-")[1]);
        const deb = client.debutCampagne, fin = client.finCampagne;
        return deb <= fin ? (mois >= deb && mois <= fin) : (mois >= deb || mois <= fin);
    }

    /* 1er jour de la campagne en cours (null si hors campagne). */
    function debutCampagneEnCours(client, iso) {
        const ref = iso || aujourdhuiIso();
        if (!estEnCampagne(client, ref)) return null;
        const [y, m] = ref.split("-").map(Number);
        const annee = (client.debutCampagne <= client.finCampagne || m >= client.debutCampagne) ? y : y - 1;
        return annee + "-" + String(client.debutCampagne).padStart(2, "0") + "-01";
    }

    /* ---------- Bilan de fin de campagne ----------
       Chaque client a une campagne (mois de début → mois de fin). La RÉUNION DE FIN DE CAMPAGNE
       (type « reunion-fin ») se planifie avant la fin ; les dates exactes ne sont pas connues
       d'avance, donc l'application se cale sur la fin de campagne de CHAQUE client : elle rappelle
       le bilan à partir de « bilanSemaines » semaines avant la fin (réglage de la Tournée, 0 = jamais)
       et jusqu'à DELAI_BILAN_JOURS jours après, tant qu'il n'est ni fait ni planifié.
       Un bilan est « fait » s'il existe une réunion de fin de campagne EFFECTUÉE depuis le début de
       cette campagne, « planifié » s'il existe un rendez-vous de ce type depuis son début. */
    const DELAI_BILAN_JOURS = 60;

    function finDeMois(annee, mois) {
        return annee + "-" + String(mois).padStart(2, "0") + "-" + String(new Date(Date.UTC(annee, mois, 0)).getUTCDate()).padStart(2, "0");
    }

    function campagneDemarreeEn(client, annee) {
        const deb = client.debutCampagne, fin = client.finCampagne;
        return { debut: annee + "-" + String(deb).padStart(2, "0") + "-01", fin: finDeMois(deb <= fin ? annee : annee + 1, fin) };
    }

    /* Campagne en cours à la date donnée, ou la dernière commencée : { debut, fin } (gère le passage d'une année à l'autre). */
    function bornesCampagne(client, iso) {
        const ref = iso || aujourdhuiIso();
        const y = Number(ref.slice(0, 4));
        const cette = campagneDemarreeEn(client, y);
        return cette.debut <= ref ? cette : campagneDemarreeEn(client, y - 1);
    }

    function bilansAPlanifier(iso) {
        const ref = iso || aujourdhuiIso();
        const semaines = getTournee().bilanSemaines;
        if (!semaines) return [];
        const d = getDonnees();
        const res = [];
        d.clients.forEach(client => {
            if (client.actif === false || !estMonClient(client) || !client.debutCampagne || !client.finCampagne) return;
            const c = bornesCampagne(client, ref);
            if (ref < ajouterJours(c.fin, -semaines * 7) || ref > ajouterJours(c.fin, DELAI_BILAN_JOURS)) return;
            const duBilan = (x) => x.clientId === client.id && x.type === "reunion-fin" && x.date >= c.debut;
            if (d.visites.some(v => duBilan(v) && estEffectuee(v))) return;                       // déjà fait
            const prevus = d.rdv.filter(duBilan).sort(trierRdv);
            const rdv = prevus.find(r => r.date >= ref) || prevus[prevus.length - 1] || null;     // le prochain, sinon le dernier (à clôturer)
            res.push({ client, debut: c.debut, fin: c.fin, joursAvantFin: ecartJours(ref, c.fin), statut: rdv ? "planifie" : "a_planifier", rdv });
        });
        return res.sort((a, b) => a.fin.localeCompare(b.fin) || a.client.nom.localeCompare(b.client.nom, "fr"));
    }

    /* Date proposée pour le bilan : le lendemain de la fin de campagne (ou demain si c'est passé), jour travaillé. */
    function dateBilanParDefaut(bilan, iso) {
        const demain = ajouterJours(iso || aujourdhuiIso(), 1);
        const apresFin = ajouterJours(bilan.fin, 1);
        return prochainJourTravaille(apresFin > demain ? apresFin : demain);
    }

    /* ---------- Moteur d'échéances (cœur de l'application) ----------
       Pour chaque ligne suivie d'un client actif EN CAMPAGNE :
         - dernière visite de campagne depuis le début de la campagne en cours
         - aucune → statut « jamais » (à faire)
         - sinon échéance = dernière visite + cadence du client
       statut : "retard" (échéance dépassée) | "jamais" (pas encore vue
                cette campagne) | "bientot" (≤ JOURS_BIENTOT) | "ok" (à jour)
       Les clients hors campagne sont renvoyés à part : leur règle de
       maintenance/hiver n'est pas encore définie. */
    function calculerEcheances(iso, options) {
        const tous = !!(options && options.tous);       // tous : aussi les clients des autres techniciens (tableau de bord du Planning) ; par défaut : les miens
        const ref = iso || aujourdhuiIso();
        const d = getDonnees();
        const resultat = { lignes: [], horsCampagne: [], sansLigne: [] };

        d.clients.forEach(client => {
            if (client.actif === false || (!tous && !estMonClient(client))) return;
            const toutesLignes = d.lignes.filter(l => l.clientId === client.id);
            const lignes = toutesLignes.filter(estLigneActive);
            const debut = debutCampagneEnCours(client, ref);
            if (!debut) {
                resultat.horsCampagne.push({ client, nbLignes: lignes.length });
                return;
            }
            /* Client en campagne sans AUCUNE ligne saisie : signalé à part,
               sinon il serait invisible sur le tableau « À visiter ». Un client
               dont toutes les lignes sont inactives ou chez un autre
               fournisseur n'est pas signalé : c'est un choix, pas un oubli. */
            if (toutesLignes.length === 0) resultat.sansLigne.push(client);
            lignes.forEach(ligne => {
                const derniere = d.visites
                    .filter(v => estEffectuee(v) && v.ligneId === ligne.id && v.type === "campagne" && v.date >= debut && v.date <= ref)
                    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
                if (!derniere) {
                    /* Pas encore vue depuis le début de la campagne : à faire,
                       sans afficher un « retard » artificiel de plusieurs mois
                       pour une ligne créée en cours de saison. */
                    resultat.lignes.push({ client, ligne, derniere: null, echeance: null,
                        joursRestants: null, statut: "jamais" });
                    return;
                }
                const echeance = ajouterJours(derniere.date, client.cadenceJours);
                const joursRestants = ecartJours(ref, echeance);
                const statut = joursRestants < 0 ? "retard"
                    : joursRestants <= JOURS_BIENTOT ? "bientot" : "ok";
                resultat.lignes.push({ client, ligne, derniere, echeance, joursRestants, statut });
            });
        });

        /* Ordre de priorité : retards (le plus ancien d'abord), jamais vues,
           à prévoir, à jour. */
        const RANG = { retard: 0, jamais: 1, bientot: 2, ok: 3 };
        resultat.lignes.sort((a, b) => RANG[a.statut] - RANG[b.statut] ||
            (a.joursRestants || 0) - (b.joursRestants || 0) ||
            a.client.nom.localeCompare(b.client.nom, "fr"));
        return resultat;
    }

    /* ---------- Sauvegarde / restauration ---------- */

    function exporter() {
        return JSON.stringify(Object.assign({ exporteLe: new Date().toISOString(), application: "AC SAT Campagne" },
            getDonnees()), null, 2);
    }

    /* Remplace TOUTES les données par celles du fichier. */
    function importer(texteJson) {
        let brut;
        try { brut = JSON.parse(texteJson); } catch (e) { return { ok: false, raison: "Fichier illisible (JSON invalide)." }; }
        if (!brut || !Array.isArray(brut.clients)) return { ok: false, raison: "Ce fichier n'est pas une sauvegarde AC SAT Campagne." };
        donnees = normaliser(brut);
        const ok = sauvegarder();
        return ok ? { ok: true, nbClients: donnees.clients.length }
            : { ok: false, raison: "Le navigateur a refusé l'enregistrement." };
    }

    /* ---------- Utilitaires ---------- */

    function normaliserTexte(t) {
        return String(t || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    return {
        ROLES_CONTACT, MOIS, OUTILS,
        TYPES_VISITE, REFERENCES, typeVisite, styleCouleur,
        valeursConnues, choixPour, contactsPourChoix, machinesDuClient,
        init, getDonnees, ecouter, surErreurStockage, stockageOk,
        definirTheme, definirNomProfil,
        listerClients, getClient, trouverClientParNom, ajouterClient, modifierClient, resumeSuppression, supprimerClients, restaurerClients,
        definirTechnicienCourant, getTechnicienCourant, estMonClient,
        contactsDuClient, enregistrerContact, supprimerContact,
        lignesDuClient, getLigne, enregistrerLigne, supprimerLigne, fournisseursOutillage,
        STATUTS_LIGNE, statutLigne, estLigneActive, definirStatutLigne, lignesActivesDuClient,
        listerRdv, rdvDuClient, getRdv, enregistrerRdv, supprimerRdv, realiserRdv,
        estPropose, confirmerRdv, confirmerTousLesRdv, rdvACloturer,
        getTournee, definirTournee, prochainJourTravaille, propositionsAFaire, proposerTournee, jourSemaine,
        modifierVisite, getVisite,
        visitesDuClient, visitesDeLaLigne, historiqueDuClient, visitesAvecMesures, listerVisites, enregistrerVisite, supprimerVisite,
        STATUTS_VISITE, statutVisite, estEffectuee, infoStatut, cloturerSansVisite,
        appliquerImport,
        aujourdhuiIso, ecartJours, ajouterJours,
        estEnCampagne, debutCampagneEnCours, calculerEcheances, bornesCampagne, bilansAPlanifier, dateBilanParDefaut,
        exporter, importer, normaliserTexte,
        elementsAEnvoyer, confirmerEnvoi, appliquerDistant, getCurseur, definirCurseur,
        COLLECTIONS_PARTAGEES, marquerPartagesAEnvoyer, oublierPartages,
        nbEnAttente, ecouterChangementsLocaux
    };
})();
