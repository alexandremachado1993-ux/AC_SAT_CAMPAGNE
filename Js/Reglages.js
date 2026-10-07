/* =============================================================
   Reglages.js — Réglages (Reglages.html)
   Profil · Apparence · Animation d'ouverture · Synchronisation · Notifications · Équipe · Sauvegarde
   ============================================================= */

(() => {
    "use strict";

    const esc = (t) => AppLayout.escapeHtml(t);
    /* Page = titre + deux onglets : « Réglages » (le contenu historique) et « Informations » (version, mise à jour, nouveauté).
       #informations dans l'adresse ouvre directement le second (lien du menu du profil). */
    const ONGLETS = [{ id: "general", icone: "⚙️", libelle: "Réglages" }, { id: "informations", icone: "ℹ️", libelle: "Informations" }];
    const page = document.getElementById("contenu-page");
    page.innerHTML =
        '<div class="entete-page"><div><h1 class="titre-page">Réglages</h1>' +
        '<p class="texte-attenue" style="font-size:0.85rem;">Profil, apparence, sauvegarde de tes données, et informations sur l\'application</p></div></div>' +
        '<div class="onglets-fiche" role="tablist" aria-label="Sections de Réglages" style="margin-top:12px;">' + ONGLETS.map(o =>
            '<button type="button" role="tab" id="onglet-reglages-' + o.id + '" class="onglet-fiche onglet-bouton onglet-reglages" data-onglet-reglages="' + o.id + '" aria-controls="panneau-reglages-' + o.id + '">' +
            '<span class="onglet-icone" aria-hidden="true">' + o.icone + '</span>' + o.libelle + '</button>').join("") + '</div>' +
        '<div id="panneau-reglages-general" role="tabpanel" aria-labelledby="onglet-reglages-general"></div>' +
        '<div id="panneau-reglages-informations" role="tabpanel" aria-labelledby="onglet-reglages-informations" hidden></div>';
    const conteneur = document.getElementById("panneau-reglages-general");

    function carteTheme(valeur, icone, titre, sousTitre, actuel) {
        return '<button type="button" class="carte-apparence' + (actuel === valeur ? " carte-apparence--actif" : "") + '" data-theme="' + valeur + '">' +
            '<span class="carte-apparence-icone">' + icone + '</span>' +
            '<span><span class="carte-apparence-titre">' + titre + '</span>' +
            '<span class="carte-apparence-sous-titre">' + sousTitre + '</span></span>' +
            '<span class="carte-apparence-radio"></span></button>';
    }

    function rendre() {
        const d = Donnees.getDonnees();
        const ligneApercu = (libelle, valeur) =>
            '<div class="ligne-info"><span class="texte-attenue">' + libelle + '</span><strong>' + valeur + '</strong></div>';

        conteneur.innerHTML =
            '<div class="grille-reglages" style="margin-top:12px;">' +
            '<div style="display:flex;flex-direction:column;gap:16px;">' +

            '<div class="carte"><h2 class="carte-titre">👤 Profil</h2>' +
            '<form id="form-profil" novalidate>' +
            '<label for="rp-nom">Nom affiché</label>' +
            '<div style="display:flex;gap:8px;"><input type="text" id="rp-nom" value="' + esc(d.profil.nom) + '">' +
            '<button type="submit" class="bouton">Enregistrer</button></div>' +
            '</form></div>' +

            '<div class="carte"><h2 class="carte-titre">🎨 Apparence</h2>' +
            '<div class="grille-apparence" style="margin-top:10px;">' +
            carteTheme("light", "☀️", "Clair", "Interface en mode clair", d.profil.theme) +
            carteTheme("dark", "🌙", "Sombre", "Interface en mode sombre", d.profil.theme) +
            '</div></div>' +

            carteAnimation() +

            '<div class="carte" id="carte-synchro"></div>' +
            '<div class="carte" id="carte-notifications"></div>' +
            '<div class="carte" id="carte-equipe"></div>' +

            '<div class="carte"><h2 class="carte-titre">💾 Sauvegarde</h2>' +
            '<p class="aide-champ">Tes données sont enregistrées sur <strong>cet appareil</strong> et, une fois connecté, ' +
            'synchronisées avec tes autres appareils. Une sauvegarde exportée reste utile en cas de fausse manipulation : ' +
            'range-la sur ton cloud personnel.</p>' +
            '<p class="aide-champ"><strong>Dernière sauvegarde exportée sur cet appareil :</strong> ' + esc(derniereSauvegarde()) + '</p>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
            '<button type="button" class="bouton" data-exporter>⬇ Exporter une sauvegarde</button>' +
            '<button type="button" class="bouton bouton--contour" data-restaurer>⬆ Restaurer une sauvegarde</button>' +
            '<input type="file" id="rp-fichier" accept=".json,application/json" hidden>' +
            '</div></div>' +

            '</div>' +

            '<div class="carte"><h2 class="carte-titre">📊 Tes données</h2>' +
            ligneApercu("Clients", d.clients.length) +
            ligneApercu("Lignes", d.lignes.length) +
            ligneApercu("Contacts", d.contacts.length) +
            ligneApercu("Visites enregistrées", d.visites.filter(Donnees.estEffectuee).length) +
            '</div>' +
            '</div>';

        brancher();
    }

    /* ---------- Carte Synchronisation ----------
       Redessinée seule à chaque changement d'état de la synchro, sans
       perdre ce qui est en cours de saisie dans le formulaire. */

    const saisie = { email: "", mdp: "", message: "" };

    const LIBELLES = {
        "en-cours": "⏳ Synchronisation en cours…", "ok": "✅ Synchronisé", "hors-ligne": "📶 Hors ligne",
        "erreur": "⚠️ Erreur", "deconnecte": "Non connecté"
    };

    function rendreSynchro(e) {
        const carte = document.getElementById("carte-synchro");
        if (!carte) return;
        /* La page entière se redessine à chaque modification des données :
           la saisie en cours est gardée dans « saisie », pas lue dans le DOM. */
        const emailSaisi = saisie.email, mdpSaisi = saisie.mdp, message = saisie.message;

        let corps;
        if (e.statut === "verification") {
            corps = '<p class="aide-champ">⏳ Vérification de la connexion…</p>';
        } else if (e.statut === "indisponible") {
            corps = '<p class="aide-champ">Synchronisation indisponible : ' + esc(e.erreur || "") + '</p>';
        } else if (!e.email) {
            corps =
                '<p class="aide-champ">Connecte-toi avec le même compte sur ton téléphone et ton ordinateur : ' +
                'clients, lignes, contacts et visites seront identiques des deux côtés. ' +
                'Tout reste utilisable sans réseau ; l\'envoi se fait au retour du réseau.</p>' +
                (e.erreur ? '<p class="message-erreur" style="margin-top:0;">' + esc(e.erreur) + '</p>' : "") +
                '<form id="form-synchro" novalidate>' +
                '<label for="rs-email">Email</label><input type="email" id="rs-email" autocomplete="username" value="' + esc(emailSaisi) + '">' +
                '<label for="rs-mdp">Mot de passe</label><input type="password" id="rs-mdp" autocomplete="current-password" value="' + esc(mdpSaisi) + '">' +
                '<p class="message-erreur" data-message-synchro>' + esc(message) + '</p>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">' +
                '<button type="submit" class="bouton">Se connecter</button>' +
                '<button type="button" class="bouton bouton--contour" data-inscription>Créer mon compte (1re fois)</button>' +
                '</div></form>';
        } else {
            const attente = Donnees.nbEnAttente();
            corps =
                '<div class="ligne-info"><span class="texte-attenue">Compte</span><strong>' + esc(e.email) + '</strong></div>' +
                '<div class="ligne-info"><span class="texte-attenue">État</span><strong>' + esc(LIBELLES[e.statut] || e.statut) + '</strong></div>' +
                '<div class="ligne-info"><span class="texte-attenue">Dernière synchro</span><strong>' +
                (e.derniere ? new Date(e.derniere).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—") + '</strong></div>' +
                '<div class="ligne-info"><span class="texte-attenue">En attente d\'envoi</span><strong>' + attente + '</strong></div>' +
                '<div class="ligne-info"><span class="texte-attenue">Connexion valable jusqu\'au</span><strong>' +
                (e.valableJusquau ? new Date(e.valableJusquau).toLocaleDateString("fr-FR") : "—") + '</strong></div>' +
                (e.erreur ? '<p class="message-erreur">' + esc(e.erreur) + '</p>' : "") +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
                '<button type="button" class="bouton" data-synchroniser' + (e.statut === "en-cours" ? " disabled" : "") + '>🔄 Synchroniser maintenant</button>' +
                '<button type="button" class="bouton bouton--contour" data-deconnexion>Se déconnecter</button>' +
                '</div>' +
                '<p class="aide-champ">Se déconnecter arrête la synchronisation ; les données restent sur cet appareil.</p>';
        }
        carte.innerHTML = '<h2 class="carte-titre">☁️ Synchronisation</h2>' + corps;
        brancherSynchro();
    }

    function brancherSynchro() {
        const carte = document.getElementById("carte-synchro");
        const afficher = (texte) => {
            saisie.message = texte;
            const m = carte.querySelector("[data-message-synchro]");
            if (m) m.textContent = texte;
        };
        const lire = () => ({
            email: document.getElementById("rs-email").value.trim(),
            mdp: document.getElementById("rs-mdp").value
        });

        const form = document.getElementById("form-synchro");
        if (form) {
            document.getElementById("rs-email").addEventListener("input", (ev) => { saisie.email = ev.target.value; });
            document.getElementById("rs-mdp").addEventListener("input", (ev) => { saisie.mdp = ev.target.value; });
            form.addEventListener("submit", async (ev) => {
                ev.preventDefault();
                const { email, mdp } = lire();
                if (!email || !mdp) return afficher("Email et mot de passe requis.");
                afficher("Connexion…");
                const r = await Synchro.connexion(email, mdp);
                if (r.ok) { saisie.mdp = ""; saisie.message = ""; AppLayout.toastSucces("Connecté ✓ — synchronisation lancée"); }
                else afficher(r.message);
            });
            carte.querySelector("[data-inscription]").addEventListener("click", async () => {
                const { email, mdp } = lire();
                if (!email || mdp.length < 8) return afficher("Email et mot de passe de 8 caractères minimum requis.");
                afficher("Création du compte…");
                const r = await Synchro.inscription(email, mdp);
                if (!r.ok) return afficher(r.message);
                afficher(r.confirmationRequise
                    ? "Compte créé. Ouvre le lien reçu par email pour le confirmer, puis connecte-toi ici."
                    : "Compte créé ✓");
            });
        }
        const bSync = carte.querySelector("[data-synchroniser]");
        if (bSync) bSync.addEventListener("click", () => Synchro.synchroniser());
        const bDeco = carte.querySelector("[data-deconnexion]");
        if (bDeco) bDeco.addEventListener("click", () => {
            if (window.confirm("Arrêter la synchronisation sur cet appareil ? Les données restent sur l'appareil.")) Synchro.deconnexion();
        });
    }

    /* ---------- Carte Animation d'ouverture ----------
       Réglage propre à l'appareil. Par défaut la vidéo se lance toujours ; « Suivre
       l'appareil » respecte la demande de réduire les animations et l'économie de
       données. Le texte d'état et le journal expliquent ce qui s'est passé. */
    const MODES_ANIMATION = [["toujours", "Toujours"], ["auto", "Suivre l'appareil"], ["jamais", "Jamais"]];

    function texteEtatAnimation(e) {
        if (e.mode === "jamais") return "⏸ Désactivée : tu l'as choisi.";
        if (e.mode === "auto" && !e.actif) {
            return "⏸ Désactivée par cet appareil : " + (e.reduit ? "il demande de réduire les animations (Windows : Paramètres › Accessibilité › Effets visuels › Effets d'animation ; Android : « Supprimer les animations »)"
                : "l'économie de données est activée") + ". Choisis « Toujours » pour la voir quand même.";
        }
        return "✅ Active : elle se lance à chaque ouverture de l'application" + (e.mode === "toujours" && (e.reduit || e.economie) ? " (même si cet appareil demande de réduire les animations)." : ".");
    }

    const CODES_JOURNAL = {
        termine: "✅ Jouée jusqu'au bout", passe: "⏭ Passée par un appui", max: "⏱ Coupée après sa durée maximale",
        "lecture-tardive": "⚠️ La vidéo n'a pas démarré à temps (appareil ou réseau lent)", erreur: "⚠️ Vidéo illisible ou introuvable",
        refuse: "⚠️ Lecture refusée par le navigateur", jamais: "⏸ Ignorée : réglage « Jamais »",
        reduit: "⏸ Ignorée : l'appareil demande de réduire les animations", economie: "⏸ Ignorée : économie de données"
    };

    function lignesJournal() {
        const j = Splash.journal();
        if (!j.length) return '<li class="texte-attenue">Aucune ouverture enregistrée pour l\'instant.</li>';
        return j.slice(0, 5).map(x => {
            const manuel = String(x.c).indexOf("revoir:") === 0;
            const code = manuel ? String(x.c).slice(7) : x.c;
            const date = new Date(x.t).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
            return '<li><span class="texte-attenue">' + esc(date) + '</span> · ' + (manuel ? "Revoir : " : "") + esc(CODES_JOURNAL[code] || code) + (x.x ? ' <span class="texte-attenue">(' + esc(x.x) + ')</span>' : "") + '</li>';
        }).join("");
    }

    function carteAnimation() {
        if (typeof Splash === "undefined") return "";
        const e = Splash.etat();
        return '<div class="carte" id="carte-animation"><h2 class="carte-titre">🎬 Animation d\'ouverture</h2>' +
            '<p class="aide-champ" style="margin-top:0;">La vidéo qui s\'affiche à l\'ouverture de l\'application. Réglage propre à cet appareil.</p>' +
            '<div class="choix-statut" role="radiogroup" aria-label="Animation d\'ouverture">' + MODES_ANIMATION.map(m =>
                '<label class="choix-statut-option"><input type="radio" name="anim-mode" value="' + m[0] + '"' + (m[0] === e.mode ? " checked" : "") + '><span>' + m[1] + '</span></label>').join("") + '</div>' +
            '<p class="aide-champ" data-animation-statut>' + esc(texteEtatAnimation(e)) + '</p>' +
            '<button type="button" class="bouton bouton--petit bouton--contour" data-revoir-animation>▶ Revoir l\'animation</button>' +
            '<details class="bloc-formulaire" style="margin-top:12px;"><summary class="bloc-formulaire-titre">Dernières ouvertures</summary>' +
            '<ul class="liste-journal" data-animation-journal>' + lignesJournal() + '</ul></details></div>';
    }

    function brancherAnimation() {
        document.querySelectorAll('input[name="anim-mode"]').forEach(r => r.addEventListener("change", () => {
            try { localStorage.setItem("acsc_animation", r.value); } catch (e) { Erreurs.consigner("Reglages : stockage refusé : réglage non mémorisé", e); }
            const st = document.querySelector("[data-animation-statut]");
            if (st) st.textContent = texteEtatAnimation(Splash.etat());
            AppLayout.toast("Animation d'ouverture : " + MODES_ANIMATION.find(m => m[0] === r.value)[1].toLowerCase());
        }));
        const b = document.querySelector("[data-revoir-animation]");
        if (b) b.addEventListener("click", () => {
            Splash.jouer();
            /* Le journal se met à jour quand la vidéo est terminée. */
            setTimeout(function relire() {
                const ul = document.querySelector("[data-animation-journal]");
                if (!ul) return;
                if (document.getElementById("splash")) { setTimeout(relire, 700); return; }
                ul.innerHTML = lignesJournal();
            }, 700);
        });
    }

    /* ---------- Carte Notifications ----------
       État lu à chaque affichage (autorisation du navigateur, abonnement de
       CET appareil) : chaque appareil s'active séparément. */
    let occupeNotifications = false;

    async function rendreNotifications() {
        const carte = document.getElementById("carte-notifications");
        if (!carte || typeof Notifications === "undefined") return;
        const s = Synchro.etat();
        const titre = '<h2 class="carte-titre">🔔 Notifications</h2>';
        const t = Donnees.getTournee();
        const explication = '<p class="aide-champ" style="margin-top:0;">Même application fermée : un <strong>résumé chaque matin à ' +
            esc(t.heureRappel.replace(":", "h")) + '</strong> (visites du jour, propositions à confirmer, retards) et un <strong>rappel 1 h avant</strong> chaque rendez-vous confirmé. ' +
            'L\'heure se règle dans l\'onglet « Tournée ». À activer sur chaque appareil.</p>';
        if (!s.email) {
            carte.innerHTML = titre + explication + '<p class="aide-champ">Connecte-toi à la synchronisation pour les activer.</p>';
            return;
        }
        const e = await Notifications.etat();
        let corps;
        if (!e.support) {
            corps = e.raison === "iphone-installer"
                ? '<p class="aide-champ">Sur iPhone, il faut d\'abord <strong>installer l\'application</strong> : dans Safari, Partager › « Sur l\'écran d\'accueil », puis ouvre-la depuis l\'icône et reviens ici (iOS 16.4 ou plus récent).</p>'
                : '<p class="aide-champ">Ce navigateur ne gère pas les notifications. Utilise Chrome ou Edge, ou l\'application installée.</p>';
        } else if (e.permission === "denied") {
            corps = '<p class="message-erreur">Notifications bloquées pour ce site. Autorise-les dans les réglages du navigateur (icône 🔒 à gauche de l\'adresse), puis recharge la page.</p>';
        } else if (!e.abonne) {
            corps = '<button type="button" class="bouton" data-notif-activer>🔔 Activer sur cet appareil</button>';
        } else {
            corps = '<div class="ligne-info"><span class="texte-attenue">Cet appareil</span><strong>✅ Notifications activées</strong></div>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
                '<button type="button" class="bouton bouton--petit" data-notif-tester>Envoyer une notification de test</button>' +
                '<button type="button" class="bouton bouton--petit bouton--contour" data-notif-desactiver>Désactiver sur cet appareil</button>' +
                '</div>';
        }
        carte.innerHTML = titre + explication + corps + '<p class="message-erreur" data-notif-message></p>';
        const message = (texte) => { const m = carte.querySelector("[data-notif-message]"); if (m) m.textContent = texte || ""; };
        const action = (selecteur, fn) => {
            const b = carte.querySelector(selecteur);
            if (b) b.addEventListener("click", async () => {
                if (occupeNotifications) return;
                occupeNotifications = true;
                b.disabled = true;
                try { await fn(message); } finally { occupeNotifications = false; }
            });
        };
        action("[data-notif-activer]", async (msg) => {
            const r = await Notifications.activer();
            if (!r.ok) { msg(r.message); await rendreNotifications(); msg(r.message); return; }
            await rendreNotifications();
            AppLayout.toastSucces("Notifications activées ✓ — envoie un test pour vérifier");
        });
        action("[data-notif-tester]", async (msg) => {
            const r = await Notifications.tester();
            if (!r.ok) { msg(r.message); b_reactiver(); return; }
            AppLayout.toastSucces(r.envoyees ? "Notification envoyée ✓ — elle doit arriver dans quelques secondes" : "Aucun appareil abonné trouvé : réactive les notifications");
            b_reactiver();
        });
        action("[data-notif-desactiver]", async (msg) => {
            const r = await Notifications.desactiver();
            if (!r.ok) msg(r.message);
            await rendreNotifications();
        });
        function b_reactiver() { const b = carte.querySelector("[data-notif-tester]"); if (b) b.disabled = false; }
    }

    /* ---------- Carte Équipe ----------
       Clients, lignes et contacts partagés avec les membres ; visites et
       rendez-vous restent personnels. Saisie gardée hors du DOM, comme
       pour la carte Synchronisation. */

    const saisieEquipe = { nom: "AC SAT", code: "", mode: "ajouter", message: "" };

    function rendreEquipe(e) {
        const carte = document.getElementById("carte-equipe");
        if (!carte) return;
        const titre = '<h2 class="carte-titre">👥 Équipe</h2>';
        const explication = '<p class="aide-champ" style="margin-top:0;">Avec ton équipe, vous partagez les <strong>clients, lignes et contacts</strong>. ' +
            'Les <strong>visites, rendez-vous et rappels</strong> restent propres à chacun.</p>';

        if (!e || e.statut === "verification" || e.statut === "indisponible") { carte.innerHTML = titre + explication; return; }
        if (!e.email) {
            carte.innerHTML = titre + explication + '<p class="aide-champ">Connecte-toi à la synchronisation ci-dessus pour créer ou rejoindre une équipe.</p>';
            return;
        }
        const message = saisieEquipe.message ? '<p class="message-erreur">' + esc(saisieEquipe.message) + '</p>' : "";

        if (e.equipe) {
            const q = e.equipe;
            carte.innerHTML = titre + explication +
                '<div class="ligne-info"><span class="texte-attenue">Équipe</span><strong>' + esc(q.nom) + '</strong></div>' +
                '<div class="ligne-info"><span class="texte-attenue">Code d\'invitation</span><strong class="code-equipe">' + esc(q.code) + '</strong></div>' +
                '<p class="aide-champ">Pour inviter un collègue : il se connecte avec <strong>son propre compte</strong>, puis saisit ce code dans « Rejoindre une équipe ».</p>' +
                '<div class="bloc-formulaire"><div class="bloc-formulaire-titre">Membres</div>' +
                (q.membres || []).map(m => '<div class="ligne-info"><span>' + esc(m.nom || "(sans nom)") + (m.moi ? ' <span class="texte-attenue">(toi)</span>' : "") + '</span>' +
                    '<span class="texte-attenue">' + (m.role === "proprietaire" ? "Créateur" : "Membre") + '</span></div>').join("") + '</div>' +
                message +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
                '<button type="button" class="bouton bouton--petit bouton--contour" data-copier-code>📋 Copier le code</button>' +
                '<button type="button" class="bouton bouton--petit bouton--contour bouton--danger" data-quitter-equipe>Quitter l\'équipe</button>' +
                '</div>';
        } else {
            const nbClients = Donnees.getDonnees().clients.length;
            carte.innerHTML = titre + explication +
                '<div class="bloc-formulaire"><div class="bloc-formulaire-titre">Créer une équipe</div>' +
                '<label for="re-nom">Nom de l\'équipe</label><input type="text" id="re-nom" value="' + esc(saisieEquipe.nom) + '">' +
                (nbClients ? '<p class="aide-champ">Tes ' + nbClients + ' client(s) actuels deviendront ceux de l\'équipe.</p>' : "") +
                '<button type="button" class="bouton bouton--petit" style="margin-top:10px;" data-creer-equipe>Créer l\'équipe</button></div>' +
                '<div class="bloc-formulaire"><div class="bloc-formulaire-titre">Rejoindre une équipe</div>' +
                '<label for="re-code">Code d\'invitation (8 caractères)</label><input type="text" id="re-code" maxlength="8" autocapitalize="characters" value="' + esc(saisieEquipe.code) + '" placeholder="ex. K7PM2XQA">' +
                (nbClients
                    ? '<label>Tes ' + nbClients + ' client(s) déjà sur cet appareil</label>' +
                    '<label class="champ-case"><input type="radio" name="re-mode" value="ajouter"' + (saisieEquipe.mode === "ajouter" ? " checked" : "") + '> Les ajouter à ceux de l\'équipe</label>' +
                    '<label class="champ-case"><input type="radio" name="re-mode" value="remplacer"' + (saisieEquipe.mode === "remplacer" ? " checked" : "") + '> Les remplacer par ceux de l\'équipe (tes visites et rendez-vous sur ces clients seront supprimés)</label>' +
                    '<p class="aide-champ">Si tu as déjà importé les clients de ton collègue par Excel, choisis « remplacer » pour éviter les doublons.</p>'
                    : "") +
                '<button type="button" class="bouton bouton--petit" style="margin-top:10px;" data-rejoindre-equipe>Rejoindre</button></div>' +
                message;
        }
        brancherEquipe();
    }

    function brancherEquipe() {
        const carte = document.getElementById("carte-equipe");
        const afficher = (texte) => { saisieEquipe.message = texte; rendreEquipe(Synchro.etat()); };
        const champ = (id, cle) => { const el = document.getElementById(id); if (el) el.addEventListener("input", () => { saisieEquipe[cle] = el.value; }); };
        champ("re-nom", "nom");
        champ("re-code", "code");
        carte.querySelectorAll('input[name="re-mode"]').forEach(r => r.addEventListener("change", () => { saisieEquipe.mode = r.value; }));

        const bCreer = carte.querySelector("[data-creer-equipe]");
        if (bCreer) bCreer.addEventListener("click", async () => {
            if (!saisieEquipe.nom.trim()) return afficher("Donne un nom à l'équipe.");
            bCreer.disabled = true;
            const r = await Synchro.creerEquipe(saisieEquipe.nom.trim());
            saisieEquipe.message = r.ok ? "" : r.message;
            rendreEquipe(Synchro.etat());
            if (r.ok) AppLayout.toastSucces("Équipe créée ✓ — donne le code à ton collègue");
        });

        const bRejoindre = carte.querySelector("[data-rejoindre-equipe]");
        if (bRejoindre) bRejoindre.addEventListener("click", async () => {
            const code = saisieEquipe.code.trim().toUpperCase();
            if (!/^[A-Z2-9]{8}$/.test(code)) return afficher("Le code fait 8 caractères (lettres et chiffres).");
            const remplacer = saisieEquipe.mode === "remplacer" && Donnees.getDonnees().clients.length > 0;
            if (remplacer && !window.confirm("Tes clients, lignes et contacts de cet appareil seront remplacés par ceux de l'équipe, et tes visites et rendez-vous sur ces clients supprimés. Continuer ?")) return;
            bRejoindre.disabled = true;
            const r = await Synchro.rejoindreEquipe(code, remplacer);
            saisieEquipe.message = r.ok ? "" : r.message;
            if (r.ok) saisieEquipe.code = "";
            rendreEquipe(Synchro.etat());
            if (r.ok) AppLayout.toastSucces("Équipe rejointe ✓ — clients partagés synchronisés");
        });

        const bCopier = carte.querySelector("[data-copier-code]");
        if (bCopier) bCopier.addEventListener("click", () => {
            const code = (Synchro.etat().equipe || {}).code || "";
            if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => AppLayout.toastSucces("Code copié ✓"), () => AppLayout.toast("Code : " + code));
            else AppLayout.toast("Code : " + code);
        });

        const bQuitter = carte.querySelector("[data-quitter-equipe]");
        if (bQuitter) bQuitter.addEventListener("click", async () => {
            if (!window.confirm("Quitter l'équipe ? Les clients restent sur cet appareil, mais tu ne recevras plus les modifications de l'équipe.")) return;
            const r = await Synchro.quitterEquipe();
            saisieEquipe.message = r.ok ? "" : r.message;
            rendreEquipe(Synchro.etat());
            if (r.ok) AppLayout.toast("Tu as quitté l'équipe");
        });
    }

    function derniereSauvegarde() {
        let d = null;
        try { d = localStorage.getItem("acsc_derniere_sauvegarde"); } catch (e) { d = null; }
        if (!d) return "jamais";
        const n = Donnees.ecartJours(d, Donnees.aujourdhuiIso());
        return Formulaires.dateFr(d) + (n === 0 ? " (aujourd'hui)" : " (il y a " + n + " jour" + (n > 1 ? "s" : "") + ")");
    }

    function exporter() {
        const blob = new Blob([Donnees.exporter()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "sauvegarde-ac-sat-campagne-" + Donnees.aujourdhuiIso() + ".json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        try { localStorage.setItem("acsc_derniere_sauvegarde", Donnees.aujourdhuiIso()); } catch (e) { Erreurs.signaler("Reglages : rappel seulement", e); }
        AppLayout.toastSucces("Sauvegarde exportée ✓");
    }

    function brancher() {
        brancherAnimation();
        document.getElementById("form-profil").addEventListener("submit", (e) => {
            e.preventDefault();
            if (Donnees.definirNomProfil(document.getElementById("rp-nom").value)) {
                AppLayout.toastSucces("Profil enregistré ✓ — visible au prochain changement de page");
            } else {
                AppLayout.toast("Le nom ne peut pas être vide");
            }
        });

        conteneur.querySelectorAll("[data-theme]").forEach(b => b.addEventListener("click", () =>
            Donnees.definirTheme(b.getAttribute("data-theme"))));

        conteneur.querySelector("[data-exporter]").addEventListener("click", exporter);

        const fichier = document.getElementById("rp-fichier");
        conteneur.querySelector("[data-restaurer]").addEventListener("click", () => fichier.click());
        fichier.addEventListener("change", () => {
            const f = fichier.files && fichier.files[0];
            if (!f) return;
            if (!window.confirm("Restaurer cette sauvegarde REMPLACE toutes les données actuelles, et le remplacement sera repris par tes autres appareils synchronisés (ce qui n'est pas dans la sauvegarde y sera supprimé). Continuer ?")) {
                fichier.value = "";
                return;
            }
            const lecteur = new FileReader();
            lecteur.onload = () => {
                const r = Donnees.importer(String(lecteur.result));
                AppLayout.toastSucces(r.ok ? "Sauvegarde restaurée ✓ — " + r.nbClients + " client(s)" : "⚠️ " + r.raison);
            };
            lecteur.onerror = () => AppLayout.toast("⚠️ Impossible de lire ce fichier");
            lecteur.readAsText(f);
        });
    }

    /* ---------- Onglet Informations ----------
       Ordre : 1. numéro de version · 2. dernière mise à jour · 3. état (à jour ?) · puis la dernière nouveauté. */

    const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    const JOURS_LONGS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

    /* « 2026.10.05-c » → « 2026-10-05 » (la date de publication est dans le numéro de version). */
    function dateDeVersion(v) { const m = /^(\d{4})\.(\d{2})\.(\d{2})-[a-z]$/.exec(v || ""); return m ? m[1] + "-" + m[2] + "-" + m[3] : ""; }
    function dateLongue(iso) {
        const [a, m, j] = iso.split("-").map(Number);
        return JOURS_LONGS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()] + " " + j + (j === 1 ? "er " : " ") + MOIS_LONGS[m - 1] + " " + a;
    }
    function ecoule(iso) {
        const [a, m, j] = iso.split("-").map(Number), [a2, m2, j2] = Donnees.aujourdhuiIso().split("-").map(Number);
        const n = Math.round((Date.UTC(a2, m2 - 1, j2) - Date.UTC(a, m - 1, j)) / 86400000);
        if (n < 0) return "";
        if (n === 0) return "aujourd'hui";
        if (n === 1) return "hier";
        if (n < 31) return "il y a " + n + " jours";
        if (n < 365) return "il y a " + Math.floor(n / 30) + " mois";
        return "il y a " + Math.floor(n / 365) + (n < 730 ? " an" : " ans");
    }

    function carteNouveaute() {
        const L = typeof Nouveautes !== "undefined" ? Nouveautes.LISTE : [];
        if (!L.length) return '<div class="carte"><h2 class="carte-titre">🎁 Dernière nouveauté</h2><p class="texte-attenue">Aucune nouveauté annoncée pour le moment.</p></div>';
        const n = L[0], im = n.images[0];
        return '<div class="carte info-nouv"><h2 class="carte-titre">🎁 Dernière nouveauté</h2>' +
            '<div class="info-nouv-corps">' +
            (im ? '<img class="info-nouv-photo" src="' + esc(im.src) + '" alt="' + esc(im.alt) + '" width="' + im.largeur + '" height="' + im.hauteur + '" loading="lazy" decoding="async">' : "") +
            '<div class="info-nouv-texte"><div class="nouv-entete"><span class="nouv-etiquette">Nouveau</span>' +
            '<span class="texte-attenue">' + esc(n.date.slice(8, 10) + "/" + n.date.slice(5, 7) + "/" + n.date.slice(0, 4)) + ' · version ' + esc(n.version) + '</span></div>' +
            '<h3 class="info-nouv-titre">' + esc(n.titre) + '</h3><p class="info-nouv-resume">' + esc(n.resume) + '</p></div></div>' +
            '<div class="info-actions"><button type="button" class="bouton" data-nouv-derniere>Voir la nouveauté</button>' +
            (L.length > 1 ? '<button type="button" class="bouton bouton--contour" data-nouv-historique>Toutes les nouveautés (' + L.length + ')</button>' : "") + '</div></div>';
    }

    function carteNotifications() {
        const perm = typeof Notification === "undefined" ? "indisponible" : Notification.permission;
        const aide = perm === "granted" ? "Tu reçois une notification, même application fermée, sur les appareils où les notifications sont activées. Ce réglage vaut pour tous tes appareils."
            : perm === "denied" ? "Les notifications sont bloquées par le navigateur sur cet appareil : la fenêtre de suggestion et la pastille sur ton profil te préviennent à la place."
            : perm === "default" ? "Pour recevoir une notification, active-les d'abord dans l'onglet « Réglages » (carte Notifications). En attendant, la fenêtre de suggestion et la pastille sur ton profil te préviennent."
            : "Ce navigateur ne propose pas les notifications : la fenêtre de suggestion et la pastille sur ton profil te préviennent.";
        return '<div class="carte"><h2 class="carte-titre">🔔 Alertes de mise à jour</h2>' +
            '<label class="champ-case" style="min-height:44px;display:flex;align-items:center;gap:8px;"><input type="checkbox" data-notif-maj' + (AppLayout.notifMajActive() ? " checked" : "") + '> Me prévenir des mises à jour et des nouvelles fonctionnalités</label>' +
            '<p class="info-aide" style="margin:6px 0 0;">' + esc(aide) + '</p></div>';
    }

    /* Présentation de première connexion, rejouable (Presentation.js). */
    function cartePresentation() {
        return '<div class="carte"><h2 class="carte-titre">🎬 Présentation</h2><p class="info-aide" style="margin:6px 0 0;">Les pages de la barre du bas et le geste « glisser vers le haut » qui ouvre Serti et Documents.</p>' +
            '<div class="info-actions"><button type="button" class="bouton bouton--contour" data-presentation-revoir>▶ Revoir la présentation</button></div></div>';
    }

    /* Journal d'erreurs de CET appareil (Erreurs.js) : rien n'est envoyé nulle part. */
    function carteDiagnostic() {
        const n = Erreurs.nombre();
        return '<div class="carte"><h2 class="carte-titre">🛠 Diagnostic</h2><p class="info-aide" style="margin:6px 0 0;">' +
            (n ? n + (n > 1 ? " problèmes enregistrés" : " problème enregistré") + " sur cet appareil. Rien n'est envoyé nulle part : copie le rapport si tu veux me le transmettre."
               : "Aucun problème enregistré sur cet appareil.") + '</p>' +
            (n ? '<div class="info-actions"><button type="button" class="bouton bouton--contour" data-diag-copier>Copier le rapport</button><button type="button" class="bouton bouton--contour" data-diag-effacer>Effacer le journal</button></div>' : "") +
            '<div class="info-actions"><button type="button" class="bouton bouton--contour" data-diag-verifier>🩺 Vérifier mon installation</button></div>' +
            '<ul class="liste-journal" data-diag-resultats aria-live="polite"></ul></div>';
    }

    function rendreInfos() {
        const v = AppLayout.VERSION, iso = dateDeVersion(v);
        document.getElementById("panneau-reglages-informations").innerHTML =
            '<div class="info-pile">' +
            '<div class="carte info-carte"><div class="info-identite"><img class="info-logo" src="Images/icone-192.png" alt="" width="56" height="56">' +
            '<div><h2 class="carte-titre" style="margin:0;">AC SAT Campagnes</h2><p class="texte-attenue" style="margin:2px 0 0;font-size:0.85rem;">Suivi des visites de campagne</p></div></div>' +
            '<dl class="info-liste">' +
            '<div class="info-ligne"><dt>Numéro de version</dt><dd><strong class="info-version">' + esc(v) + '</strong>' +
            '<span class="info-aide">Année · mois · jour de la version, puis une lettre quand il y en a plusieurs le même jour.</span></dd></div>' +
            '<div class="info-ligne"><dt>Dernière mise à jour</dt><dd>' + (iso ? '<strong>' + esc(dateLongue(iso)) + '</strong>' +
                '<span class="info-aide">' + esc([ecoule(iso), "date de publication de la version installée"].filter(Boolean).join(" · ")) + '</span>' : '<strong>—</strong>') + '</dd></div>' +
            '<div class="info-ligne"><dt>État</dt><dd><span id="info-etat" role="status" aria-live="polite">Vérification en cours…</span><span class="info-aide" id="info-maj-nouv" hidden></span></dd></div>' +
            '</dl><div class="info-actions"><button type="button" class="bouton bouton--contour" data-verifier-maj>🔄 Vérifier les mises à jour</button>' +
            '<button type="button" class="bouton" data-recharger hidden>Mettre à jour maintenant</button></div></div>' +
            carteNouveaute() + cartePresentation() + carteNotifications() + carteDiagnostic() + '</div>';
        brancherInfos();
        verifierMaj();
    }

    function verifierMaj() {
        const el = document.getElementById("info-etat"); if (!el) return;
        el.textContent = "Vérification en cours…";
        AppLayout.verifierMiseAJour().then(r => {
            const e = document.getElementById("info-etat"); if (!e) return;        // l'onglet a été redessiné entre-temps
            const h = new Date(), heure = String(h.getHours()).padStart(2, "0") + ":" + String(h.getMinutes()).padStart(2, "0");
            const rech = document.querySelector("[data-recharger]");
            if (rech) rech.hidden = r.etat !== "nouvelle";
            e.className = "info-etat info-etat--" + r.etat;
            const prog = document.getElementById("info-maj-nouv");
            if (prog) { const n = r.infos && r.infos.nouveaute; prog.hidden = !(r.etat === "nouvelle" && n); prog.textContent = r.etat === "nouvelle" && n ? "Au programme : " + n.titre : ""; }
            e.textContent = r.etat === "a-jour" ? "✅ Tu as la dernière version (vérifié à " + heure + ")."
                : r.etat === "nouvelle" ? "⬆️ Une nouvelle version est disponible : " + r.serveur + "."
                : "ℹ️ Vérification impossible : pas de connexion, ou application ouverte depuis un dossier de l'ordinateur.";
        });
    }

    function brancherInfos() {
        const p = document.getElementById("panneau-reglages-informations");
        const bPres = p.querySelector("[data-presentation-revoir]");
        if (bPres) bPres.addEventListener("click", () => Presentation.afficher());
        const bDiag = p.querySelector("[data-diag-verifier]");
        if (bDiag) bDiag.addEventListener("click", async () => {
            const zone = p.querySelector("[data-diag-resultats]");
            bDiag.disabled = true; bDiag.textContent = "Vérification en cours…";
            try {
                const resultats = await AutoDiagnostic.verifier();
                zone.innerHTML = resultats.map(r => '<li data-etat="' + r.etat + '"><strong>' + AutoDiagnostic.ICONES[r.etat] + " " + esc(r.nom) + "</strong> — " + esc(r.detail) + "</li>").join("") +
                    '<li><button type="button" class="bouton bouton--contour" data-diag-copier-resultat>Copier ce résultat</button></li>';
                zone.querySelector("[data-diag-copier-resultat]").addEventListener("click", () => {
                    if (navigator.clipboard) navigator.clipboard.writeText(AutoDiagnostic.texte(resultats)).then(() => AppLayout.toast("Résultat copié ✓"), () => AppLayout.toast("Copie impossible : sélectionne le texte à la main."));
                    else AppLayout.toast("Copie impossible sur ce navigateur.");
                });
            } catch (e) {
                Erreurs.signaler("Réglages : auto-diagnostic", e);
                zone.innerHTML = "<li>La vérification n'a pas pu aller au bout. Réessaie.</li>";
            }
            bDiag.disabled = false; bDiag.textContent = "🩺 Vérifier mon installation";
        });
        const bc = p.querySelector("[data-diag-copier]");
        if (bc) bc.addEventListener("click", () => {
            const texte = Erreurs.rapport(AppLayout.VERSION);
            if (navigator.clipboard) navigator.clipboard.writeText(texte).then(() => AppLayout.toastSucces("Rapport copié ✓"), () => AppLayout.toast("Copie impossible : sélectionne le texte à la main."));
            else AppLayout.toast("Copie impossible sur ce navigateur.");
        });
        const be = p.querySelector("[data-diag-effacer]");
        if (be) be.addEventListener("click", () => { Erreurs.effacer(); rendreInfos(); });
        const bv = p.querySelector("[data-verifier-maj]"); if (bv) bv.addEventListener("click", verifierMaj);
        const br = p.querySelector("[data-recharger]"); if (br) br.addEventListener("click", () => AppLayout.appliquerMiseAJour());
        const bn = p.querySelector("[data-notif-maj]"); if (bn) bn.addEventListener("change", () => AppLayout.definirNotifMaj(bn.checked));
        const bd = p.querySelector("[data-nouv-derniere]"); if (bd) bd.addEventListener("click", () => Nouveautes.ouvrir({ derniere: true }));
        const bh = p.querySelector("[data-nouv-historique]"); if (bh) bh.addEventListener("click", () => Nouveautes.ouvrir({ tout: true }));
    }

    /* ---------- Onglets ---------- */

    let ongletActuel = "";
    function afficherOnglet(id, majAdresse) {
        if (!ONGLETS.some(o => o.id === id)) id = "general";
        const change = id !== ongletActuel;
        ongletActuel = id;
        ONGLETS.forEach(o => {
            const b = document.getElementById("onglet-reglages-" + o.id), actif = o.id === id;
            b.classList.toggle("actif", actif); b.setAttribute("aria-selected", actif ? "true" : "false"); b.setAttribute("tabindex", actif ? "0" : "-1");
            document.getElementById("panneau-reglages-" + o.id).hidden = !actif;
        });
        if (id === "informations" && change) rendreInfos();
        if (majAdresse && window.history && history.replaceState) { try { history.replaceState(null, "", id === "informations" ? "#informations" : location.pathname + location.search); } catch (e) { Erreurs.consigner("Reglages : adresse non modifiable : sans importance", e); } }
    }
    document.querySelectorAll("[data-onglet-reglages]").forEach(b => {
        b.addEventListener("click", () => afficherOnglet(b.getAttribute("data-onglet-reglages"), true));
        b.addEventListener("keydown", (e) => {                       // flèches gauche / droite : onglet voisin (clavier)
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            const i = ONGLETS.findIndex(o => o.id === ongletActuel), j = (i + (e.key === "ArrowRight" ? 1 : ONGLETS.length - 1)) % ONGLETS.length;
            afficherOnglet(ONGLETS[j].id, true); document.getElementById("onglet-reglages-" + ONGLETS[j].id).focus(); e.preventDefault();
        });
    });
    window.addEventListener("hashchange", () => afficherOnglet(location.hash === "#informations" ? "informations" : "general", false));

    function rendreTout() {
        rendre();
        if (typeof Synchro !== "undefined") { rendreSynchro(Synchro.etat()); rendreEquipe(Synchro.etat()); rendreNotifications(); }
        else rendreSynchro({ statut: "indisponible", erreur: "Js/Synchro.js n'est pas chargé : projet incomplet ou ancienne version de Reglages.html." });
    }

    Donnees.ecouter(rendreTout);
    rendreTout();
    afficherOnglet(location.hash === "#informations" ? "informations" : "general", false);
    if (typeof Synchro !== "undefined") {
        Synchro.ecouter(rendreSynchro);
        Synchro.ecouter(rendreEquipe);
        /* La carte Notifications ne dépend que de la connexion : on ne la
           redessine que quand le compte connecté change. */
        let emailAffiche;
        Synchro.ecouter(e => { if (e.email !== emailAffiche) { emailAffiche = e.email; rendreNotifications(); } });
    }
})();
