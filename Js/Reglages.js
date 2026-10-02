/* =============================================================
   Reglages.js — Réglages (Reglages.html)
   Profil · Apparence · Animation d'ouverture · Synchronisation · Notifications · Équipe · Sauvegarde
   ============================================================= */

(() => {
    "use strict";

    const esc = (t) => AppLayout.escapeHtml(t);
    const conteneur = document.getElementById("contenu-page");

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
            '<div class="entete-page"><div><h1 class="titre-page">Réglages</h1>' +
            '<p class="texte-attenue" style="font-size:0.85rem;">Profil, apparence et sauvegarde de tes données</p></div></div>' +

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
            ligneApercu("Version de l'application", esc(AppLayout.VERSION)) +
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
                if (r.ok) { saisie.mdp = ""; saisie.message = ""; AppLayout.toast("Connecté ✓ — synchronisation lancée"); }
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
            try { localStorage.setItem("acsc_animation", r.value); } catch (e) { /* stockage refusé : réglage non mémorisé */ }
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
        if (!carte || typeof Synchro === "undefined" || !Synchro.etatNotifications) return;
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
        const e = await Synchro.etatNotifications();
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
            const r = await Synchro.activerNotifications();
            if (!r.ok) { msg(r.message); await rendreNotifications(); msg(r.message); return; }
            await rendreNotifications();
            AppLayout.toast("Notifications activées ✓ — envoie un test pour vérifier");
        });
        action("[data-notif-tester]", async (msg) => {
            const r = await Synchro.testerNotifications();
            if (!r.ok) { msg(r.message); b_reactiver(); return; }
            AppLayout.toast(r.envoyees ? "Notification envoyée ✓ — elle doit arriver dans quelques secondes" : "Aucun appareil abonné trouvé : réactive les notifications");
            b_reactiver();
        });
        action("[data-notif-desactiver]", async (msg) => {
            const r = await Synchro.desactiverNotifications();
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
            if (r.ok) AppLayout.toast("Équipe créée ✓ — donne le code à ton collègue");
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
            if (r.ok) AppLayout.toast("Équipe rejointe ✓ — clients partagés synchronisés");
        });

        const bCopier = carte.querySelector("[data-copier-code]");
        if (bCopier) bCopier.addEventListener("click", () => {
            const code = (Synchro.etat().equipe || {}).code || "";
            if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => AppLayout.toast("Code copié ✓"), () => AppLayout.toast("Code : " + code));
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
        try { localStorage.setItem("acsc_derniere_sauvegarde", Donnees.aujourdhuiIso()); } catch (e) { /* rappel seulement */ }
        AppLayout.toast("Sauvegarde exportée ✓");
    }

    function brancher() {
        brancherAnimation();
        document.getElementById("form-profil").addEventListener("submit", (e) => {
            e.preventDefault();
            if (Donnees.definirNomProfil(document.getElementById("rp-nom").value)) {
                AppLayout.toast("Profil enregistré ✓ — visible au prochain changement de page");
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
                AppLayout.toast(r.ok ? "Sauvegarde restaurée ✓ — " + r.nbClients + " client(s)" : "⚠️ " + r.raison);
            };
            lecteur.onerror = () => AppLayout.toast("⚠️ Impossible de lire ce fichier");
            lecteur.readAsText(f);
        });
    }

    function rendreTout() {
        rendre();
        if (typeof Synchro !== "undefined") { rendreSynchro(Synchro.etat()); rendreEquipe(Synchro.etat()); rendreNotifications(); }
        else rendreSynchro({ statut: "indisponible", erreur: "Js/Synchro.js n'est pas chargé : projet incomplet ou ancienne version de Reglages.html." });
    }

    Donnees.ecouter(rendreTout);
    rendreTout();
    if (typeof Synchro !== "undefined") {
        Synchro.ecouter(rendreSynchro);
        Synchro.ecouter(rendreEquipe);
        /* La carte Notifications ne dépend que de la connexion : on ne la
           redessine que quand le compte connecté change. */
        let emailAffiche;
        Synchro.ecouter(e => { if (e.email !== emailAffiche) { emailAffiche = e.email; rendreNotifications(); } });
    }
})();
