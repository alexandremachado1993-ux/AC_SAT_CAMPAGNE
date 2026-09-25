/* =============================================================
   Reglages.js — Réglages (Reglages.html)
   Profil · Apparence · Synchronisation · Sauvegarde (export / restauration JSON)
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

            '<div class="carte" id="carte-synchro"></div>' +

            '<div class="carte"><h2 class="carte-titre">💾 Sauvegarde</h2>' +
            '<p class="aide-champ">Tes données sont enregistrées sur <strong>cet appareil</strong> et, une fois connecté, ' +
            'synchronisées avec tes autres appareils. Une sauvegarde exportée reste utile en cas de fausse manipulation : ' +
            'range-la sur ton cloud personnel.</p>' +
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
            ligneApercu("Visites enregistrées", d.visites.length) +
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
        if (e.statut === "indisponible") {
            corps = '<p class="aide-champ">Synchronisation indisponible : ' + esc(e.erreur || "") + '</p>';
        } else if (!e.email) {
            corps =
                '<p class="aide-champ">Connecte-toi avec le même compte sur ton téléphone et ton ordinateur : ' +
                'clients, lignes, contacts et visites seront identiques des deux côtés. ' +
                'Tout reste utilisable sans réseau ; l\'envoi se fait au retour du réseau.</p>' +
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
        AppLayout.toast("Sauvegarde exportée ✓");
    }

    function brancher() {
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
            if (!window.confirm("Restaurer cette sauvegarde REMPLACE toutes les données actuelles de cet appareil. Continuer ?")) {
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
        if (typeof Synchro !== "undefined") rendreSynchro(Synchro.etat());
        else rendreSynchro({ statut: "indisponible", erreur: "Js/Synchro.js n'est pas chargé : projet incomplet ou ancienne version de Reglages.html." });
    }

    Donnees.ecouter(rendreTout);
    rendreTout();
    if (typeof Synchro !== "undefined") Synchro.ecouter(rendreSynchro);
})();
