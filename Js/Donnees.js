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
                  suiviCampagne, notes }
     visites    { id, clientId, ligneId, date "AAAA-MM-JJ",
                  type "campagne"|"maintenance", format, produit, remarques }
     rdv        { id, clientId, ligneIds [], date "AAAA-MM-JJ", heure "HH:MM"|"",
                  type "campagne"|"maintenance", notes }  — visites planifiées
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
        if (changements > 0) ecouteursLocaux.forEach(fn => { try { fn(); } catch (e) { /* idem */ } });
        return ok;
    }

    function ecrire() {
        let ok = true;
        try {
            localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
            localStorage.setItem(CLE_SUIVI, JSON.stringify(suivi));
        } catch (e) { ok = false; }
        if (!ok) ecouteursErreur.forEach(fn => { try { fn(); } catch (e) { /* idem */ } });
        ecouteurs.forEach(fn => { try { fn(); } catch (e) { /* un écouteur ne bloque pas les autres */ } });
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

    function profilSynchro() { return { nom: donnees.profil.nom }; }

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
            curseur: (brut && brut.curseur) || null
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
        try { localStorage.setItem(CLE_SUIVI, JSON.stringify(suivi)); } catch (e) { /* retenté au prochain enregistrement */ }
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
                const e = empreinte({ nom: r.contenu.nom });
                if (empreintes.get(cle) === e) return;
                donnees.profil.nom = r.contenu.nom;
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
        else { try { localStorage.setItem(CLE_SUIVI, JSON.stringify(suivi)); } catch (e) { /* idem */ } }
        return n;
    }

    function getCurseur() { getDonnees(); return suivi.curseur; }

    function definirCurseur(valeur) {
        getDonnees();
        suivi.curseur = valeur;
        try { localStorage.setItem(CLE_SUIVI, JSON.stringify(suivi)); } catch (e) { /* idem */ }
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
        "cadenceJours", "actif", "notes"];

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

    /* Supprime le client ET tout ce qui lui est rattaché. */
    function supprimerClient(id) {
        const d = getDonnees();
        d.clients = d.clients.filter(c => c.id !== id);
        d.contacts = d.contacts.filter(x => x.clientId !== id);
        d.lignes = d.lignes.filter(x => x.clientId !== id);
        d.visites = d.visites.filter(x => x.clientId !== id);
        d.rdv = d.rdv.filter(x => x.clientId !== id);
        return sauvegarder();
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
        "produitHabituel", "cadenceLigne", "suiviCampagne", "notes"]);

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
        if (!x) { x = { id: nouvelId("lig"), clientId, suiviCampagne: true }; d.lignes.push(x); }
        CHAMPS_LIGNE.forEach(ch => { if (source[ch] !== undefined) x[ch] = nettoyer(source[ch]); });
        x.suiviCampagne = x.suiviCampagne !== false;
        sauvegarder();
        return x;
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

    function visitesDuClient(clientId) {
        return getDonnees().visites
            .filter(v => v.clientId === clientId)
            .sort((a, b) => b.date.localeCompare(a.date));
    }

    function visitesDeLaLigne(ligneId) {
        return getDonnees().visites
            .filter(v => v.ligneId === ligneId)
            .sort((a, b) => b.date.localeCompare(a.date));
    }

    function enregistrerVisite(source) {
        const ligne = getLigne(source.ligneId);
        if (!ligne || !/^\d{4}-\d{2}-\d{2}$/.test(source.date || "")) return null;
        const v = {
            id: nouvelId("vis"),
            clientId: ligne.clientId,
            ligneId: ligne.id,
            date: source.date,
            type: source.type === "maintenance" ? "maintenance" : "campagne",
            format: nettoyer(source.format) || "",
            produit: nettoyer(source.produit) || "",
            remarques: nettoyer(source.remarques) || ""
        };
        getDonnees().visites.push(v);
        sauvegarder();
        return v;
    }

    function supprimerVisite(id) {
        const d = getDonnees();
        d.visites = d.visites.filter(v => v.id !== id);
        return sauvegarder();
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
        if (!getClient(source.clientId) || !/^\d{4}-\d{2}-\d{2}$/.test(source.date || "")) return null;
        let r = id ? d.rdv.find(x => x.id === id) : null;
        if (!r) { r = { id: nouvelId("rdv") }; d.rdv.push(r); }
        const lignesClient = d.lignes.filter(l => l.clientId === source.clientId).map(l => l.id);
        r.clientId = source.clientId;
        r.ligneIds = (source.ligneIds || []).filter(x => lignesClient.indexOf(x) !== -1);
        r.date = source.date;
        r.heure = /^\d{2}:\d{2}$/.test(source.heure || "") ? source.heure : "";
        r.type = source.type === "maintenance" ? "maintenance" : "campagne";
        r.notes = nettoyer(source.notes) || "";
        sauvegarder();
        return r;
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
            const ligne = getLigne(v.ligneId);
            if (!ligne || ligne.clientId !== r.clientId || !/^\d{4}-\d{2}-\d{2}$/.test(v.date || "")) return;
            const nv = {
                id: nouvelId("vis"), clientId: r.clientId, ligneId: ligne.id, date: v.date,
                type: v.type === "maintenance" ? "maintenance" : "campagne",
                format: nettoyer(v.format) || "", produit: nettoyer(v.produit) || "", remarques: nettoyer(v.remarques) || ""
            };
            d.visites.push(nv);
            creees.push(nv);
        });
        if (creees.length === 0) return null;
        d.rdv = d.rdv.filter(x => x.id !== id);
        sauvegarder();
        return creees;
    }

    function listerVisites() {
        return getDonnees().visites.slice().sort((a, b) => a.date.localeCompare(b.date));
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
            else { x = { id: nouvelId("lig"), clientId: client.id, suiviCampagne: true }; d.lignes.push(x); bilan.lignesCreees++; }
            CHAMPS_LIGNE.forEach(ch => { if (item.source[ch] !== undefined) x[ch] = nettoyer(item.source[ch]); });
            x.suiviCampagne = x.suiviCampagne !== false;
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

    /* ---------- Moteur d'échéances (cœur de l'application) ----------
       Pour chaque ligne suivie d'un client actif EN CAMPAGNE :
         - dernière visite de campagne depuis le début de la campagne en cours
         - aucune → statut « jamais » (à faire)
         - sinon échéance = dernière visite + cadence du client
       statut : "retard" (échéance dépassée) | "jamais" (pas encore vue
                cette campagne) | "bientot" (≤ JOURS_BIENTOT) | "ok" (à jour)
       Les clients hors campagne sont renvoyés à part : leur règle de
       maintenance/hiver n'est pas encore définie. */
    function calculerEcheances(iso) {
        const ref = iso || aujourdhuiIso();
        const d = getDonnees();
        const resultat = { lignes: [], horsCampagne: [], sansLigne: [] };

        d.clients.forEach(client => {
            if (client.actif === false) return;
            const lignes = d.lignes.filter(l => l.clientId === client.id && l.suiviCampagne !== false);
            const debut = debutCampagneEnCours(client, ref);
            if (!debut) {
                resultat.horsCampagne.push({ client, nbLignes: lignes.length });
                return;
            }
            /* Client en campagne sans aucune ligne suivie : signalé à part,
               sinon il serait invisible sur le tableau « À visiter ». */
            if (lignes.length === 0) resultat.sansLigne.push(client);
            lignes.forEach(ligne => {
                const derniere = d.visites
                    .filter(v => v.ligneId === ligne.id && v.type === "campagne" && v.date >= debut && v.date <= ref)
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
        ROLES_CONTACT, TYPES_PRODUCTION, MOIS, JOURS_BIENTOT, OUTILS,
        init, getDonnees, ecouter, surErreurStockage,
        definirTheme, definirNomProfil,
        listerClients, getClient, trouverClientParNom, ajouterClient, modifierClient, supprimerClient,
        contactsDuClient, enregistrerContact, supprimerContact,
        lignesDuClient, getLigne, enregistrerLigne, supprimerLigne, fournisseursOutillage,
        listerRdv, rdvDuClient, getRdv, enregistrerRdv, supprimerRdv, realiserRdv,
        visitesDuClient, visitesDeLaLigne, listerVisites, enregistrerVisite, supprimerVisite,
        appliquerImport,
        aujourdhuiIso, ecartJours, ajouterJours,
        estEnCampagne, debutCampagneEnCours, calculerEcheances,
        exporter, importer, normaliserTexte,
        elementsAEnvoyer, confirmerEnvoi, appliquerDistant, getCurseur, definirCurseur,
        nbEnAttente, ecouterChangementsLocaux
    };
})();
