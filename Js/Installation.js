/* =============================================================
   Installation.js — Installer une mise à jour VALIDÉE par l'utilisateur, avec sa mise en scène

   Le service worker (sw.js) sert l'application depuis une copie FIGÉE de la version installée : rien ne change tant que l'utilisateur ne valide pas.
   Valider = (1) télécharger la nouvelle version complète dans une AUTRE copie (version.json donne la liste des fichiers et leur taille : la barre de
   pourcentage est RÉELLE, en octets), (2) vérifier qu'elle est entière, (3) demander au service worker de l'activer, (4) recharger.
   Au moindre échec, la copie en cours est supprimée et l'application reste sur la version installée, intacte.
   Sans service worker qui contrôle la page (navigateur ancien, première visite) : les fichiers sont tout de même rechargés (barre réelle), puis la page se recharge.
   La politique (3 rappels, puis écran obligatoire) est dans AppLayout ; ici : le téléchargement, l'activation, la scène, l'écran obligatoire et la réparation.
   Testé par Tests/test55.js (téléchargement, échecs, activation, scène) et test54.js (service worker).
   ============================================================= */

const Installation = (() => {
    "use strict";

    const PREFIXE = "acsc-";
    const DUREE_MAX_MS = 120000;       // au-delà, le téléchargement est abandonné : la version installée reste intacte
    const PARALLELE = 4;
    const ETAPES = [
        { cle: "preparation", libelle: "Préparation" },
        { cle: "telechargement", libelle: "Téléchargement de la nouvelle version" },
        { cle: "verification", libelle: "Vérification des fichiers" },
        { cle: "installation", libelle: "Installation" }
    ];

    const echap = (t) => AppLayout.escapeHtml(t);
    const erreurClaire = (message) => { const e = new Error(message); e.claire = true; return e; };

    /* Liste de fichiers publiée par le serveur : chemins relatifs sûrs (pas de « .. », pas d'adresse absolue), tailles en octets. null si invalide. */
    function listeValide(fichiers) {
        if (!Array.isArray(fichiers) || !fichiers.length || fichiers.length > 300) return null;
        const liste = [];
        for (const f of fichiers) {
            if (!f || typeof f.u !== "string" || !/^[A-Za-z0-9_][A-Za-z0-9_./ -]{0,160}$/.test(f.u) || f.u.indexOf("..") !== -1) return null;
            liste.push({ u: f.u, t: Math.max(0, Math.round(Number(f.t) || 0)) });
        }
        return liste;
    }

    /* La version est « figée » seulement si un service worker contrôle déjà cette page et que les copies (Cache API) existent. */
    function supporteVersionFigee(outils) {
        const o = outils || {};
        const nav = o.navigator || (typeof navigator !== "undefined" ? navigator : null);
        const stock = o.caches || (typeof window !== "undefined" ? window.caches : null);
        return !!(nav && nav.serviceWorker && nav.serviceWorker.controller && stock);
    }

    /* Télécharge tous les fichiers de la version. Renvoie le nom de la copie (« acsc-<version> »).
       outils (tests) : { caches, fetch, sansCopie, controle: { annule } }. surProgres(pourcentage 0-99, fichier). */
    async function telecharger(infos, surProgres, outils) {
        const o = outils || {};
        const liste = listeValide(infos && infos.fichiers);
        if (!liste) throw new Error("liste de fichiers de la version absente ou invalide");
        const stock = o.sansCopie ? null : (o.caches || window.caches);
        const nom = PREFIXE + infos.version;
        let cache = null;
        if (stock) { await stock.delete(nom); cache = await stock.open(nom); }
        const lire = o.fetch || ((u, init) => window.fetch(u, init));
        const controle = o.controle || { annule: false };
        const total = liste.reduce((s, f) => s + Math.max(f.t, 1), 0);
        let fait = 0, prochain = 0, abandon = null;
        const travailleur = async () => {
            while (!abandon && !controle.annule) {
                const i = prochain++;
                if (i >= liste.length) return;
                const f = liste[i];
                try {
                    const reponse = await lire(f.u, { cache: "reload" });        // « cache: reload » : le service worker laisse passer vers le réseau
                    if (!reponse.ok) throw new Error(f.u + " : réponse " + reponse.status);
                    if (cache) await cache.put(f.u, reponse);
                    else if (reponse.arrayBuffer) await reponse.arrayBuffer();    // sans copie : lire le corps pour rafraîchir le cache du navigateur
                    fait += Math.max(f.t, 1);
                    if (surProgres) surProgres(Math.min(99, Math.floor(100 * fait / total)), f.u);
                } catch (e) { abandon = e; }
            }
        };
        await Promise.all(Array.from({ length: Math.min(PARALLELE, liste.length) }, travailleur));
        if (!abandon && controle.annule) abandon = erreurClaire("La mise à jour a pris trop de temps : elle est abandonnée, ta version actuelle n'a pas été modifiée.");
        if (!abandon && cache && (await cache.keys()).length !== liste.length) abandon = new Error("copie incomplète");
        if (abandon) {
            if (stock) { try { await stock.delete(nom); } catch (e) { Erreurs.consigner("Installation : copie incomplète non supprimée", e); } }
            throw abandon;
        }
        return nom;
    }

    /* Demande au service worker d'activer la copie, en lui disant combien de fichiers elle doit contenir : il vérifie lui-même qu'elle est complète (réponse sur un canal dédié). */
    function activer(nom, outils, attendu) {
        const o = outils || {};
        const nav = o.navigator || navigator;
        const sw = nav.serviceWorker && nav.serviceWorker.controller;
        if (!sw) return Promise.reject(new Error("aucun service worker ne contrôle cette page"));
        const MC = o.MessageChannel || window.MessageChannel;
        return new Promise((resolve, reject) => {
            const canal = new MC();
            const minuteur = setTimeout(() => reject(new Error("activation sans réponse")), o.delaiActivation || 8000);
            canal.port1.onmessage = (e) => {
                clearTimeout(minuteur);
                if (e.data && e.data.ok) resolve(); else reject(new Error("activation refusée"));
            };
            sw.postMessage({ type: "ACTIVER", nom, n: attendu }, [canal.port2]);
        });
    }

    /* ---------- La scène ---------- */

    function creerScene(infos, surFermeture) {
        const racine = document.createElement("div");
        racine.setAttribute("role", "dialog");
        racine.setAttribute("aria-modal", "true");
        racine.setAttribute("aria-labelledby", "maj-titre");
        racine.setAttribute("aria-describedby", "maj-texte");
        racine.tabIndex = -1;
        racine.innerHTML = '<div class="maj-centre">' +
            '<div class="maj-logo" aria-hidden="true"><span class="maj-logo-halo"></span><span class="maj-logo-carte"><img src="Images/logo.png" alt="" width="80" height="80"></span>' +
            '<span class="maj-logo-badge" data-maj-badge>⬆</span><span class="maj-etincelles" data-maj-etincelles></span></div>' +
            '<h2 class="maj-titre" id="maj-titre" data-maj-titre></h2><p class="maj-texte" id="maj-texte" data-maj-texte></p>' +
            '<div class="maj-progression" data-maj-progression hidden>' +
            '<div class="maj-pourcent" data-maj-pourcent aria-hidden="true">0 %</div>' +
            '<div class="maj-barre" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Avancement de la mise à jour" data-maj-barre><div class="maj-barre-remplie" data-maj-remplie></div></div>' +
            '<p class="maj-fichier" data-maj-fichier aria-hidden="true"></p>' +
            '<ul class="maj-etapes">' + ETAPES.map(e => '<li class="maj-etape maj-etape--attente" data-maj-etape="' + e.cle + '"><span class="maj-etape-puce" aria-hidden="true"></span><span>' + echap(e.libelle) + '</span></li>').join("") + '</ul></div>' +
            '<div class="maj-programme" data-maj-programme hidden></div>' +
            '<div class="maj-actions" data-maj-actions></div><p class="maj-vocal" data-maj-vocal role="status" aria-live="polite"></p></div>';
        const q = (s) => racine.querySelector(s);
        const declencheur = document.activeElement;
        let pct = 0, annonce = -1, fermable = false;
        const scene = {
            racine,
            etat(nom) { racine.className = "maj-scene maj-scene--" + nom; },
            titre(t) { q("[data-maj-titre]").textContent = t; },
            texte(t) { q("[data-maj-texte]").textContent = t; },
            badge(s) { q("[data-maj-badge]").textContent = s; },
            progression(visible) { q("[data-maj-progression]").hidden = !visible; },
            progres(valeur, fichier) {
                pct = Math.max(pct, Math.min(100, Math.round(valeur)));                 // jamais en arrière
                q("[data-maj-pourcent]").textContent = pct + " %";
                q("[data-maj-remplie]").style.setProperty("--p", String(pct));
                q("[data-maj-barre]").setAttribute("aria-valuenow", String(pct));
                if (fichier) q("[data-maj-fichier]").textContent = fichier;
                if (pct >= annonce + 25 || pct === 100) { annonce = pct; q("[data-maj-vocal]").textContent = "Mise à jour : " + pct + " pour cent"; }     // lecteurs d'écran : tous les 25 %
            },
            etape(cle) {
                let atteinte = false;
                racine.querySelectorAll("[data-maj-etape]").forEach(li => {
                    const c = li.getAttribute("data-maj-etape");
                    const fait = cle === "fin" || !atteinte && c !== cle;
                    if (c === cle) atteinte = true;
                    li.className = "maj-etape maj-etape--" + (c === cle ? "active" : fait ? "fait" : "attente");
                    li.querySelector(".maj-etape-puce").textContent = fait ? "✓" : "";
                });
            },
            programme(nouveaute) {
                const el = q("[data-maj-programme]");
                if (!nouveaute || !nouveaute.titre) { el.hidden = true; return; }
                el.innerHTML = '<strong>🎁 Au programme</strong><br>' + echap(nouveaute.titre) + (nouveaute.resume ? '<br><span class="texte-attenue">' + echap(nouveaute.resume) + '</span>' : "");
                el.hidden = false;
            },
            actions(boutons) {
                const zone = q("[data-maj-actions]");
                zone.innerHTML = "";
                boutons.forEach(b => {
                    const el = document.createElement("button");
                    el.type = "button"; el.className = b.primaire ? "bouton" : "bouton bouton--contour"; el.textContent = b.libelle;
                    el.addEventListener("click", b.action);
                    zone.appendChild(el);
                });
                const premier = zone.querySelector("button");
                if (premier) premier.focus({ preventScroll: true });
            },
            etincelles() {
                const zone = q("[data-maj-etincelles]");
                zone.innerHTML = Array.from({ length: 10 }, (_, i) => '<i class="maj-etincelle" style="--i:' + i + '"></i>').join("");
            },
            fermer() {
                document.documentElement.classList.remove("maj-en-cours");
                racine.remove();
                if (surFermeture) surFermeture();
                if (declencheur && document.contains(declencheur) && typeof declencheur.focus === "function") declencheur.focus({ preventScroll: true });
            },
            permettreFermeture(oui) { fermable = !!oui; }
        };
        racine.addEventListener("keydown", (e) => {
            if (e.key === "Escape") { e.preventDefault(); if (fermable) scene.fermer(); return; }
            if (e.key !== "Tab") return;
            const cibles = Array.from(racine.querySelectorAll("button")).filter(b => !b.hidden);
            if (!cibles.length) { e.preventDefault(); return; }
            const premier = cibles[0], dernier = cibles[cibles.length - 1];
            if (e.shiftKey && (document.activeElement === premier || document.activeElement === racine)) { e.preventDefault(); dernier.focus(); }
            else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
        });
        scene.programme(infos && infos.nouveaute);
        document.documentElement.classList.add("maj-en-cours");
        document.body.appendChild(racine);
        racine.focus({ preventScroll: true });
        return scene;
    }

    const pauseDefaut = (ms) => new Promise(resolve => {
        const reduit = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        setTimeout(resolve, reduit ? Math.min(ms, 200) : ms);
    });

    /* L'utilisateur a validé : la scène complète. options : { obligatoire, scene, outils, pause, recharger }. */
    async function demarrer(infos, options) {
        const o = options || {};
        const pause = o.pause || pauseDefaut;
        const scene = o.scene || creerScene(infos, o.surFermeture);
        scene.permettreFermeture(false);
        scene.etat("cours"); scene.badge("⬆"); scene.titre("Mise à jour en cours");
        scene.texte("Version " + infos.version + " · ne ferme pas l'application, ça ne prend que quelques secondes.");
        scene.actions([]); scene.progression(true); scene.progres(0); scene.etape("preparation");
        try {
            await pause(900);
            if (typeof navigator !== "undefined" && navigator.onLine === false) throw erreurClaire("Pas de connexion : la mise à jour a besoin d'Internet. Ta version actuelle n'a pas été modifiée.");
            scene.etape("telechargement");
            const figee = supporteVersionFigee(o.outils);
            const controle = { annule: false };
            const minuteur = setTimeout(() => { controle.annule = true; }, DUREE_MAX_MS);
            let nom;
            try { nom = await telecharger(infos, (p, f) => scene.progres(p, f), Object.assign({}, o.outils, { sansCopie: !figee, controle })); }
            finally { clearTimeout(minuteur); }
            scene.etape("verification"); scene.progres(99); await pause(500);
            scene.etape("installation");
            if (figee) await activer(nom, o.outils, listeValide(infos.fichiers).length);
            await pause(500);
            scene.progres(100); scene.etape("fin");
            scene.etat("ok"); scene.badge("✓"); scene.titre("Version " + infos.version + " installée");
            scene.texte("Tes données sont intactes. L'application redémarre…"); scene.etincelles();
            await pause(1800);
            (o.recharger || (() => window.location.reload()))();
        } catch (e) {
            Erreurs.consigner("Installation : la mise à jour n'a pas abouti", e);
            scene.etat("echec"); scene.badge("!"); scene.progression(false);
            scene.titre("La mise à jour n'a pas abouti");
            scene.texte(e && e.claire ? e.message : "Ta version actuelle n'a pas été modifiée. Vérifie ta connexion, puis réessaie.");
            scene.permettreFermeture(true);
            scene.actions([
                { libelle: "Réessayer", primaire: true, action: () => demarrer(infos, Object.assign({}, o, { scene })) },
                { libelle: "Continuer avec l'ancienne version", action: () => scene.fermer() }
            ]);
        }
    }

    /* Écran OBLIGATOIRE (après les rappels, ou version marquée obligatoire) : un seul chemin, la mise à jour. options : { raison: "rappels" | "version", surFermeture, outils, pause, recharger }. */
    function ouvrirBlocage(infos, options) {
        const o = options || {};
        const scene = creerScene(infos, o.surFermeture);
        scene.etat("bloque"); scene.badge("⬆"); scene.progression(false); scene.permettreFermeture(false);
        scene.titre("Mise à jour obligatoire");
        scene.texte(o.raison === "version"
            ? "La version " + infos.version + " change des points importants : pour que tes données restent justes entre tes appareils, elle doit être installée avant de continuer."
            : "Tu as reporté trois fois la version " + infos.version + ". Pour continuer à utiliser l'application, installe-la maintenant : c'est rapide et tes données restent intactes.");
        scene.actions([{ libelle: "Mettre à jour maintenant", primaire: true, action: () => demarrer(infos, Object.assign({}, o, { scene })) }]);
        return scene;
    }

    /* Réparation : supprime les copies et le service worker, puis recharge (le site se réinstalle proprement, depuis la version publiée). Les DONNÉES ne sont pas touchées. */
    async function reparer(outils) {
        const o = outils || {};
        const stock = o.caches || window.caches;
        if (stock) { for (const n of await stock.keys()) { if (n.startsWith(PREFIXE)) await stock.delete(n); } }
        const nav = o.navigator || navigator;
        if (nav.serviceWorker && nav.serviceWorker.getRegistrations) { for (const r of await nav.serviceWorker.getRegistrations()) await r.unregister(); }
        (o.recharger || (() => window.location.reload()))();
    }

    return { listeValide, supporteVersionFigee, telecharger, activer, demarrer, ouvrirBlocage, reparer, ETAPES };
})();
