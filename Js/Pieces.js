/* =============================================================
   Pieces.js — Fichiers joints à un contrôle de serti (photo ou PDF de la feuille du client, Seametal)

   OÙ SONT LES FICHIERS : dans IndexedDB (la base de fichiers du navigateur, de quoi stocker des dizaines de Mo), JAMAIS dans les données
   de l'application : le stockage de celles-ci (localStorage, ≈ 5 Mo pour tout) serait saturé en quelques fichiers. Avec le contrôle, on
   n'enregistre qu'une petite FICHE (id, nom, type, taille, date), qui voyage avec la synchronisation comme le reste.
   CONSÉQUENCES, dites à l'utilisateur dans l'écran : les fichiers restent sur l'appareil où ils ont été ajoutés ; ils ne sont ni
   synchronisés ni dans la sauvegarde JSON ; sur un autre appareil, la fiche s'affiche avec « fichier absent de cet appareil ».
   Les photos sont réduites (1 800 px, JPEG) : une feuille de contrôle reste lisible pour quelques centaines de Ko au lieu de plusieurs Mo.
   Un fichier ajouté mais jamais enregistré avec un contrôle (formulaire annulé, contrôle supprimé) est supprimé au bout de 24 h.
   Aucune donnée n'est envoyée nulle part : ce module ne parle à aucun serveur.
   ============================================================= */

const Pieces = (() => {
    "use strict";

    const NOM_BASE = "acsc_pieces";
    const NOM_STOCK = "pieces";
    const NB_MAX = 10;                              // fichiers par contrôle
    const TAILLE_MAX_OCTETS = 15 * 1024 * 1024;     // 15 Mo par fichier (avant réduction d'une photo)
    const COTE_MAX_IMAGE_PX = 1800;
    const QUALITE_JPEG = 0.82;
    const SEUIL_REDUCTION_OCTETS = 400 * 1024;      // en dessous, une image n'est pas retouchée
    const DELAI_ORPHELINE_MS = 24 * 3600 * 1000;
    const SEUIL_QUOTA = 0.85;                       // au-delà de 85 % de l'espace du navigateur : on refuse d'en ajouter
    const NOM_MAX = 120;
    const EXTENSIONS = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", heic: "image/heic", heif: "image/heif" };
    const TYPES_ACCEPTES = /^(application\/pdf|image\/(png|jpe?g|webp|gif|heic|heif))$/i;

    const echap = (t) => (typeof AppLayout !== "undefined" ? AppLayout.escapeHtml(t) : String(t));

    /* Erreur dont le message peut être montré tel quel à l'utilisateur. */
    function erreurClaire(message) { const e = new Error(message); e.claire = true; return e; }

    /* ---------- Stockage : IndexedDB, ou une mémoire (tests, ou navigateur sans IndexedDB) ---------- */

    function stockageIndexedDB() {
        let ouverture = null;
        const ouvrir = () => ouverture || (ouverture = new Promise((resolve, reject) => {
            if (!window.indexedDB) { reject(new Error("IndexedDB indisponible")); return; }
            const req = window.indexedDB.open(NOM_BASE, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(NOM_STOCK, { keyPath: "id" });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }));
        const transaction = (mode, travail) => ouvrir().then(db => new Promise((resolve, reject) => {
            const t = db.transaction(NOM_STOCK, mode);
            const r = travail(t.objectStore(NOM_STOCK));
            t.oncomplete = () => resolve(r && "result" in r ? r.result : undefined);
            t.onerror = () => reject(t.error);
            t.onabort = () => reject(t.error);
        }));
        return {
            put: (enr) => transaction("readwrite", s => s.put(enr)),
            get: (id) => transaction("readonly", s => s.get(id)),
            delete: (id) => transaction("readwrite", s => s.delete(id)),
            /* Seulement l'identifiant et la date : pas de lecture des fichiers eux-mêmes. */
            liste: () => ouvrir().then(db => new Promise((resolve, reject) => {
                const sortie = [];
                const req = db.transaction(NOM_STOCK, "readonly").objectStore(NOM_STOCK).openCursor();
                req.onsuccess = () => { const c = req.result; if (c) { sortie.push({ id: c.value.id, le: c.value.le }); c.continue(); } else resolve(sortie); };
                req.onerror = () => reject(req.error);
            }))
        };
    }

    function stockageMemoire() {
        const m = new Map();
        return {
            put: async (enr) => { m.set(enr.id, enr); },
            get: async (id) => m.get(id),
            delete: async (id) => { m.delete(id); },
            liste: async () => Array.from(m.values()).map(e => ({ id: e.id, le: e.le }))
        };
    }

    let stockage = stockageIndexedDB();
    const utiliserMemoire = () => { stockage = stockageMemoire(); return stockage; };

    /* ---------- Fichier : type, nom, réduction d'une photo, place disponible ---------- */

    function typeDe(fichier) {
        if (fichier.type && TYPES_ACCEPTES.test(fichier.type)) return fichier.type.toLowerCase().replace("image/jpg", "image/jpeg");
        const ext = (String(fichier.name || "").split(".").pop() || "").toLowerCase();       // certains navigateurs ne donnent pas de type (HEIC…)
        return EXTENSIONS[ext] || "";
    }

    function nomPropre(nom) {
        // eslint-disable-next-line no-control-regex -- volontaire : on retire les caractères de contrôle d'un nom de fichier
        return String(nom || "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, NOM_MAX) || "Fichier";
    }

    async function reduireImage(fichier) {
        try {
            if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
            const image = await createImageBitmap(fichier);
            const echelle = Math.min(1, COTE_MAX_IMAGE_PX / Math.max(image.width, image.height));
            const l = Math.max(1, Math.round(image.width * echelle)), h = Math.max(1, Math.round(image.height * echelle));
            const toile = document.createElement("canvas");
            toile.width = l; toile.height = h;
            const ctx = toile.getContext("2d");
            if (!ctx) return null;
            ctx.fillStyle = "#fff";       // fond blanc : une feuille PNG à fond transparent ne doit pas devenir noire en JPEG
            ctx.fillRect(0, 0, l, h);
            ctx.drawImage(image, 0, 0, l, h);
            if (typeof image.close === "function") image.close();
            const blob = await new Promise(resolve => toile.toBlob(resolve, "image/jpeg", QUALITE_JPEG));
            return blob && blob.size < fichier.size ? blob : null;        // jamais plus gros que l'original
        } catch (e) { Erreurs.consigner("Pieces : photo non réduite, l'original est conservé", e); return null; }
    }

    async function placeSuffisante(octets) {
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const e = await navigator.storage.estimate();
                if (e && e.quota && (e.usage + octets) / e.quota > SEUIL_QUOTA) return false;
            }
        } catch (e) { Erreurs.consigner("Pieces : espace disponible inconnu", e); }
        return true;
    }

    /* Demande au navigateur de ne pas effacer ces fichiers en cas de manque de place (une seule fois par page). */
    let durableDemande = false;
    function demanderStockageDurable() {
        if (durableDemande) return;
        durableDemande = true;
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(e => Erreurs.consigner("Pieces : stockage durable refusé", e)); }
        catch (e) { Erreurs.consigner("Pieces : stockage durable indisponible", e); }
    }

    /* ---------- Ajouter, lire, supprimer ---------- */

    async function ajouter(fichier) {
        if (!fichier || typeof fichier.size !== "number") throw erreurClaire("Fichier illisible.");
        const type = typeDe(fichier);
        if (!type) throw erreurClaire("Type non accepté : choisis un PDF ou une image (PNG, JPEG, WebP).");
        if (fichier.size === 0) throw erreurClaire("Ce fichier est vide.");
        if (fichier.size > TAILLE_MAX_OCTETS) throw erreurClaire("Fichier trop gros : 15 Mo au maximum.");
        let blob = fichier, typeFinal = type;
        if (/^image\/(png|jpe?g|webp)$/.test(type) && fichier.size > SEUIL_REDUCTION_OCTETS) {
            const reduit = await reduireImage(fichier);
            if (reduit) { blob = reduit; typeFinal = "image/jpeg"; }
        }
        if (!(await placeSuffisante(blob.size))) throw erreurClaire("Espace insuffisant sur cet appareil : libère de la place, ou exporte une sauvegarde.");
        const enr = { id: "pj-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), nom: nomPropre(fichier.name), type: typeFinal, taille: blob.size, le: new Date().toISOString(), blob };
        try { await stockage.put(enr); }
        catch (e) { Erreurs.consigner("Pieces : écriture refusée", e); throw erreurClaire("Ce navigateur ne peut pas conserver de fichiers ici (navigation privée ?)."); }
        demanderStockageDurable();
        return { id: enr.id, nom: enr.nom, type: enr.type, taille: enr.taille, le: enr.le };
    }

    const lire = (id) => stockage.get(id).then(e => (e ? e.blob : null));
    const supprimer = (id) => stockage.delete(id);

    /* Message à montrer pour une erreur d'ajout : le message clair tel quel, sinon un message général (le détail va dans le journal). */
    function messageErreur(e) {
        if (e && e.claire) return e.message;
        Erreurs.consigner("Pieces : ajout impossible", e);
        return "Ajout impossible sur cet appareil. Réessaie.";
    }

    /* Supprime les fichiers que plus aucun contrôle ne référence, ajoutés il y a plus de 24 h (le délai laisse le temps de finir un formulaire). */
    async function nettoyer() {
        try {
            const utilises = new Set();
            Donnees.getDonnees().visites.forEach(v => ((v.mesures && v.mesures.client && v.mesures.client.pieces) || []).forEach(p => utilises.add(p.id)));
            const maintenant = Date.now();
            for (const e of await stockage.liste()) {
                if (!utilises.has(e.id) && maintenant - Date.parse(e.le) > DELAI_ORPHELINE_MS) await stockage.delete(e.id);
            }
        } catch (e) { Erreurs.consigner("Pieces : nettoyage impossible", e); }
    }

    /* ---------- Affichage (liste de fiches) ---------- */

    function tailleLisible(octets) {
        const n = Number(octets) || 0;
        return n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " Mo" : Math.max(1, Math.round(n / 1024)) + " Ko";
    }
    const libelleType = (p) => /pdf/i.test(p.type || "") ? "PDF" : /^image\//i.test(p.type || "") ? "Image" : "Fichier";

    /* options : { editable, erreur }. Un fichier présent sur CET appareil reçoit ses liens par hydrater() (lecture asynchrone). */
    function htmlListe(pieces, options) {
        const o = options || {};
        if (!pieces || !pieces.length) return "";
        return '<ul class="pieces-liste">' + pieces.map(p => '<li class="piece" data-piece="' + echap(p.id) + '">' +
            '<span class="piece-vignette" aria-hidden="true">' + (/^image\//i.test(p.type || "") ? '<img alt="" data-piece-vignette hidden>' : "") + '<span data-piece-icone>' + (/pdf/i.test(p.type || "") ? "📄" : "🖼️") + '</span></span>' +
            '<span class="piece-texte"><strong class="piece-nom">' + echap(p.nom) + '</strong><small>' + echap(libelleType(p)) + ' · ' + echap(tailleLisible(p.taille)) + '</small>' +
            '<small class="piece-etat" data-piece-etat></small></span>' +
            '<span class="piece-actions">' +
            '<a class="bouton bouton--petit bouton--contour" data-piece-ouvrir target="_blank" rel="noopener" hidden aria-label="Ouvrir ' + echap(p.nom) + '">Ouvrir</a>' +
            '<a class="bouton bouton--petit bouton--contour" data-piece-telecharger download="' + echap(p.nom) + '" hidden aria-label="Télécharger ' + echap(p.nom) + '">⬇</a>' +
            (o.editable ? '<button type="button" class="bouton bouton--petit bouton--contour piece-retirer" data-piece-retirer="' + echap(p.id) + '" aria-label="Retirer ' + echap(p.nom) + ' du contrôle">✕</button>' : "") +
            '</span></li>').join("") + '</ul>';
    }

    /* Bloc complet du contrôle client : titre, explication, liste, boutons d'ajout. */
    function htmlBloc(pieces, options) {
        const o = options || {};
        const liste = htmlListe(pieces, o);
        if (!o.editable) {
            return liste ? '<div class="pieces"><h3 class="serti-sous-titre">📎 Feuille du client (fichiers)</h3>' + liste + '</div>' : "";
        }
        return '<div class="pieces"><h3 class="serti-sous-titre">📎 Feuille du client (fichiers)</h3>' +
            '<p class="aide-champ">Joins la feuille de contrôle du client (photo ou PDF) : aucune valeur à saisir. Conservée sur cet appareil : elle n\'est ni synchronisée ni incluse dans la sauvegarde.</p>' +
            liste +
            '<div class="pieces-ajout">' +
            '<label class="bouton bouton--contour pieces-bouton">📎 Ajouter un fichier<input type="file" class="pieces-fichier" data-pieces-fichier accept="application/pdf,image/*" multiple></label>' +
            '<label class="bouton bouton--contour pieces-bouton">📷 Photo<input type="file" class="pieces-fichier" data-pieces-fichier accept="image/*" capture="environment"></label></div>' +
            (o.reference ? '<label for="' + echap(o.reference.id) + '">Référence de la feuille (facultatif)</label><input id="' + echap(o.reference.id) + '" type="text" autocomplete="off" data-serti-noteclient value="' + echap(o.reference.valeur || "") + '" placeholder="ex. n° de la feuille, date du relevé">' : "") +
            '<p class="message-erreur" role="alert" data-pieces-erreur>' + echap(o.erreur || "") + '</p></div>';
    }

    /* Donne leurs liens (ouvrir, télécharger) et leur vignette aux fichiers présents sur cet appareil ; indique les autres. */
    let urlsActives = [];
    function libererUrls() { urlsActives.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { Erreurs.consigner("Pieces : lien déjà libéré", e); } }); urlsActives = []; }

    async function hydrater(racine) {
        if (!racine || typeof URL.createObjectURL !== "function") return;
        const lignes = Array.from(racine.querySelectorAll("[data-piece]"));
        for (const li of lignes) {
            let blob = null;
            try { blob = await lire(li.getAttribute("data-piece")); } catch (e) { Erreurs.consigner("Pieces : lecture impossible", e); }
            if (!racine.isConnected || !li.isConnected) continue;
            if (!blob) { li.querySelector("[data-piece-etat]").textContent = "Fichier absent de cet appareil (ajouté depuis un autre appareil ?)."; continue; }
            const url = URL.createObjectURL(blob);
            urlsActives.push(url);
            const ouvrir = li.querySelector("[data-piece-ouvrir]"), telecharger = li.querySelector("[data-piece-telecharger]");
            ouvrir.href = url; ouvrir.hidden = false; telecharger.href = url; telecharger.hidden = false;
            const vignette = li.querySelector("[data-piece-vignette]");
            if (vignette) { vignette.src = url; vignette.hidden = false; const icone = li.querySelector("[data-piece-icone]"); if (icone) icone.hidden = true; }
        }
    }
    window.addEventListener("pagehide", libererUrls);

    /* Nettoyage des fichiers orphelins quelques secondes après l'ouverture (seulement si le navigateur a IndexedDB : sinon rien à nettoyer). */
    if (window.indexedDB) setTimeout(() => { if (typeof Donnees !== "undefined") nettoyer(); }, 6000);

    return { NB_MAX, TAILLE_MAX_OCTETS, ajouter, lire, supprimer, nettoyer, htmlBloc, htmlListe, hydrater, messageErreur, tailleLisible, utiliserMemoire };
})();
