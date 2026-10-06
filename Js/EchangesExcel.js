/* =============================================================
   EchangesExcel.js — Import du modèle Excel, export des clients

   Import : lit les onglets Clients / Contacts / Lignes du modèle
   (Modeles/Modele_Import_Visites_Campagne.xlsx), montre un aperçu,
   puis applique après confirmation.
     - client reconnu par son nom → mis à jour, sinon créé
     - contact reconnu par client + prénom + nom
     - ligne reconnue par client + nom de ligne
     - lignes « EXEMPLE… » ignorées
     - une cellule vide ne remplace jamais une valeur existante

   Export des clients : au format du modèle (réimportable après
   modification) ou en CSV.
   ============================================================= */

const EchangesExcel = (() => {
    "use strict";

    const esc = (t) => AppLayout.escapeHtml(t);
    const norm = (t) => Donnees.normaliserTexte(String(t == null ? "" : t).replace(/\*/g, ""));

    /* En-têtes du modèle → champs internes. La colonne Région est acceptée
       si elle est ajoutée, sans être exigée. */
    const COLONNES = {
        Clients: [
            ["Nom client *", "nom", 32], ["Groupe", "groupe", 20], ["Adresse", "adresse", 34],
            ["Code postal", "codePostal", 12], ["Ville *", "ville", 20], ["Pays *", "pays", 14],
            ["Téléphone standard", "telephone", 18], ["Email général", "email", 28],
            ["Type de production", "typeProduction", 22], ["Début campagne (mois) *", "debutCampagne", 16],
            ["Fin campagne (mois) *", "finCampagne", 16], ["Cadence visites (jours) *", "cadenceJours", 14],
            ["Actif", "actif", 10], ["Technicien", "technicien", 22], ["Notes", "notes", 40]
        ],
        Contacts: [
            ["Client *", "client", 32], ["Rôle *", "role", 26], ["Prénom", "prenom", 16], ["Nom *", "nom", 18],
            ["Téléphone fixe", "telephoneFixe", 17], ["Mobile", "mobile", 17], ["Email", "email", 30],
            ["Contact principal", "principal", 12], ["Notes", "notes", 36]
        ],
        Lignes: [
            ["Client *", "client", 32], ["Ligne *", "nom", 16], ["Marque sertisseuse", "marque", 20],
            ["Modèle sertisseuse", "modele", 20], ["N° de série", "numeroSerie", 16],
            ["Format habituel", "formatHabituel", 18], ["Produit habituel", "produitHabituel", 22],
            ["Cadence ligne (boîtes/min)", "cadenceLigne", 16],
            ["Molette 1 - fournisseur", "molette1Fournisseur", 16], ["Molette 1 - référence", "molette1Ref", 16],
            ["Molette 2 - fournisseur", "molette2Fournisseur", 16], ["Molette 2 - référence", "molette2Ref", 16],
            ["Mandrin - fournisseur", "mandrinFournisseur", 16], ["Mandrin - référence", "mandrinRef", 16],
            ["Suivi en campagne *", "suiviCampagne", 12],
            ["Statut", "statut", 16], ["Fournisseur actuel", "fournisseurActuel", 20],
            ["Notes", "notes", 36]
        ]
    };
    const COLONNES_OPTIONNELLES = { Clients: [["Région", "region"]] };

    /* ---------- Conversion des valeurs ---------- */

    function texte(v) {
        if (v === null || v === undefined) return undefined;
        const s = String(v).trim();
        return s === "" ? undefined : s;
    }

    /* Excel transforme « 05 65 … » en nombre 565… si la cellule n'est pas
       au format texte : on rend le 0 initial perdu. */
    function telephone(v) {
        if (typeof v === "number") {
            const s = String(Math.round(v));
            return s.length === 9 ? "0" + s : s;
        }
        return texte(v);
    }

    function codePostal(v, pays) {
        if (typeof v === "number") {
            const s = String(Math.round(v));
            return (!pays || /^france$/i.test(pays)) && s.length === 4 ? "0" + s : s;
        }
        return texte(v);
    }

    const ABREVIATIONS = ["jan", "fev", "mar", "avr", "mai", "juin", "juil", "aou", "sep", "oct", "nov", "dec"];

    function mois(v) {
        if (v === null || v === undefined || v === "") return { valeur: undefined };
        const n = Number(v);
        if (Number.isInteger(n) && n >= 1 && n <= 12) return { valeur: n };
        const t = norm(v).replace(/\.$/, "");
        const exact = Donnees.MOIS.findIndex(m => norm(m) === t);
        if (exact !== -1) return { valeur: exact + 1 };
        /* « juil » avant « juin » n'a pas d'importance : on teste l'égalité
           ou le préfixe exact de chaque abréviation, la plus longue d'abord. */
        const ordre = ABREVIATIONS.map((a, i) => ({ a, i })).sort((x, y) => y.a.length - x.a.length);
        const trouve = ordre.find(o => t.startsWith(o.a));
        return trouve ? { valeur: trouve.i + 1 } : { valeur: undefined, illisible: String(v) };
    }

    function ouiNon(v) {
        if (v === null || v === undefined || v === "") return undefined;
        if (typeof v === "boolean") return v;
        const t = norm(v);
        if (["oui", "o", "yes", "y", "1", "vrai", "x"].indexOf(t) !== -1) return true;
        if (["non", "n", "no", "0", "faux"].indexOf(t) !== -1) return false;
        return undefined;
    }

    /* Statut de ligne lu dans le fichier. Vide : on garde « Suivi en
       campagne » (anciens modèles). Texte inconnu : ignoré, avec avertissement. */
    let avertirStatut = null;
    function statutLu(v, n) {
        const t = norm(v);
        if (!t) return undefined;
        if (["active", "actif", "oui"].indexOf(t) !== -1) return "active";
        if (["inactive", "inactif", "non"].indexOf(t) !== -1) return "inactive";
        if (t.indexOf("autre") === 0 || t.indexOf("concurren") === 0) return "concurrent";
        if (avertirStatut) avertirStatut("Lignes, ligne " + n + " : statut « " + v + " » inconnu — statut inchangé.");
        return undefined;
    }

    /* Technicien lu dans le fichier : nom tel qu'affiché dans l'équipe
       (Réglages › Équipe), « moi », ou « Non attribué ». Hors équipe, ou nom
       inconnu : ignoré, avec avertissement. */
    function technicienLu(v, n, plan) {
        const t = norm(v);
        if (!t) return undefined;
        const membres = Formulaires.membresEquipe();
        if (!membres.length) {
            plan.avertissements.push("Clients, ligne " + n + " : technicien « " + v + " » ignoré (pas d'équipe sur ce compte).");
            return undefined;
        }
        if (t === "non attribue" || t === "aucun") return "";
        if (t === "moi") return (membres.find(m => m.moi) || {}).id;
        const m = membres.find(x => norm(x.nom) === t);
        if (m) return m.id;
        plan.avertissements.push("Clients, ligne " + n + " : technicien « " + v + " » inconnu dans l'équipe — attribution inchangée.");
        return undefined;
    }

    /* ---------- Analyse (aucune écriture) ---------- */

    function indexerEntetes(entete, nomFeuille) {
        const index = {};
        const attendues = COLONNES[nomFeuille].concat(COLONNES_OPTIONNELLES[nomFeuille] || []);
        (entete || []).forEach((titre, i) => {
            const t = norm(titre);
            const col = attendues.find(c => norm(c[0]) === t);
            if (col) index[col[1]] = i;
        });
        return index;
    }

    function trouverFeuille(classeur, nom) {
        const cle = Object.keys(classeur).find(k => norm(k) === norm(nom));
        return cle ? classeur[cle] : null;
    }

    function analyser(classeur) {
        const plan = { clients: [], contacts: [], lignes: [], erreurs: [], avertissements: [], exemples: 0 };
        avertirStatut = (m) => plan.avertissements.push(m);
        const feuilleClients = trouverFeuille(classeur, "Clients");
        if (!feuilleClients) {
            plan.erreurs.push("Onglet « Clients » introuvable : ce fichier n'est pas le modèle d'import.");
            return plan;
        }
        const nomsDuFichier = [];

        function parcourir(nomFeuille, traiter) {
            const lignes = trouverFeuille(classeur, nomFeuille);
            if (!lignes || lignes.length === 0) return;
            const idx = indexerEntetes(lignes[0], nomFeuille);
            const manquantes = COLONNES[nomFeuille].filter(c => c[0].indexOf("*") !== -1 && idx[c[1]] === undefined);
            if (manquantes.length) {
                plan.erreurs.push("Onglet « " + nomFeuille + " » : colonne(s) introuvable(s) — " +
                    manquantes.map(c => c[0].replace(" *", "")).join(", ") + ". Onglet ignoré.");
                return;
            }
            for (let i = 1; i < lignes.length; i++) {
                const brute = lignes[i] || [];
                if (brute.every(v => v === null || v === undefined || String(v).trim() === "")) continue;
                const cellule = (champ) => idx[champ] === undefined ? undefined : brute[idx[champ]];
                const premiere = texte(brute[0]) || "";
                if (/^exemple/i.test(premiere)) { plan.exemples++; continue; }
                traiter(cellule, i + 1);
            }
        }

        parcourir("Clients", (cel, n) => {
            const nom = texte(cel("nom"));
            if (!nom) { plan.erreurs.push("Clients, ligne " + n + " : nom du client manquant — ligne ignorée."); return; }
            if (nomsDuFichier.some(x => norm(x) === norm(nom))) {
                plan.erreurs.push("Clients, ligne " + n + " : « " + nom + " » apparaît deux fois — seconde occurrence ignorée.");
                return;
            }
            nomsDuFichier.push(nom);
            const pays = texte(cel("pays"));
            const debut = mois(cel("debutCampagne"));
            const fin = mois(cel("finCampagne"));
            [debut, fin].forEach((m, k) => {
                if (m.illisible) plan.avertissements.push("Clients, ligne " + n + " : mois de " + (k ? "fin" : "début") +
                    " « " + m.illisible + " » illisible — valeur par défaut conservée.");
            });
            let cadence = cel("cadenceJours");
            if (cadence !== undefined && cadence !== null && cadence !== "") {
                cadence = parseInt(cadence, 10);
                if (isNaN(cadence) || cadence < 7 || cadence > 60) {
                    plan.avertissements.push("Clients, ligne " + n + " : cadence hors plage (7 à 60 j) — ramenée dans la plage.");
                }
            } else cadence = undefined;

            const source = {
                nom, groupe: texte(cel("groupe")), adresse: texte(cel("adresse")),
                codePostal: codePostal(cel("codePostal"), pays), ville: texte(cel("ville")), pays,
                region: texte(cel("region")), telephone: telephone(cel("telephone")), email: texte(cel("email")),
                typeProduction: texte(cel("typeProduction")), debutCampagne: debut.valeur, finCampagne: fin.valeur,
                cadenceJours: isNaN(cadence) ? undefined : cadence, actif: ouiNon(cel("actif")), notes: texte(cel("notes")),
                technicien: technicienLu(cel("technicien"), n, plan)
            };
            plan.clients.push({ ligne: n, source, maj: !!Donnees.trouverClientParNom(nom) });
        });

        const clientConnu = (nom) => !!Donnees.trouverClientParNom(nom) || nomsDuFichier.some(x => norm(x) === norm(nom));

        parcourir("Contacts", (cel, n) => {
            const client = texte(cel("client")), nom = texte(cel("nom"));
            if (!client || !nom) { plan.erreurs.push("Contacts, ligne " + n + " : client ou nom manquant — ligne ignorée."); return; }
            if (!clientConnu(client)) { plan.erreurs.push("Contacts, ligne " + n + " : client « " + client + " » inconnu — ligne ignorée."); return; }
            plan.contacts.push({
                ligne: n, clientNom: client, source: {
                    role: texte(cel("role")) || "Autre", prenom: texte(cel("prenom")), nom,
                    telephoneFixe: telephone(cel("telephoneFixe")), mobile: telephone(cel("mobile")),
                    email: texte(cel("email")), principal: ouiNon(cel("principal")), notes: texte(cel("notes"))
                }
            });
        });

        parcourir("Lignes", (cel, n) => {
            const client = texte(cel("client")), nom = texte(cel("nom"));
            if (!client || !nom) { plan.erreurs.push("Lignes, ligne " + n + " : client ou nom de ligne manquant — ligne ignorée."); return; }
            if (!clientConnu(client)) { plan.erreurs.push("Lignes, ligne " + n + " : client « " + client + " » inconnu — ligne ignorée."); return; }
            const cad = cel("cadenceLigne");
            plan.lignes.push({
                ligne: n, clientNom: client, source: {
                    nom, marque: texte(cel("marque")), modele: texte(cel("modele")), numeroSerie: texte(cel("numeroSerie")),
                    formatHabituel: texte(cel("formatHabituel")), produitHabituel: texte(cel("produitHabituel")),
                    cadenceLigne: cad === null || cad === undefined || cad === "" ? undefined : String(cad),
                    molette1Fournisseur: texte(cel("molette1Fournisseur")), molette1Ref: texte(cel("molette1Ref")),
                    molette2Fournisseur: texte(cel("molette2Fournisseur")), molette2Ref: texte(cel("molette2Ref")),
                    mandrinFournisseur: texte(cel("mandrinFournisseur")), mandrinRef: texte(cel("mandrinRef")),
                    suiviCampagne: ouiNon(cel("suiviCampagne")), notes: texte(cel("notes")),
                    statut: statutLu(cel("statut"), n), fournisseurActuel: texte(cel("fournisseurActuel"))
                }
            });
        });

        return plan;
    }

    /* ---------- Interface d'import ---------- */

    function ouvrirImport() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        input.addEventListener("change", () => {
            const f = input.files && input.files[0];
            if (!f) return;
            const lecteur = new FileReader();
            lecteur.onload = () => {
                let classeur;
                try { classeur = Excel.lire(lecteur.result); }
                catch (e) { AppLayout.toast("⚠️ " + e.message); return; }
                afficherApercu(analyser(classeur), f.name);
            };
            lecteur.onerror = () => AppLayout.toast("⚠️ Impossible de lire ce fichier");
            lecteur.readAsArrayBuffer(f);
        });
        input.click();
    }

    function afficherApercu(plan, nomFichier) {
        const nbMaj = plan.clients.filter(c => c.maj).length;
        const total = plan.clients.length + plan.contacts.length + plan.lignes.length;
        const liste = (titre, items, couleur) => items.length === 0 ? "" :
            '<div class="bloc-formulaire" style="border-color:' + couleur + ';"><div class="bloc-formulaire-titre">' + titre + ' (' + items.length + ')</div>' +
            '<ul class="liste-import">' + items.slice(0, 30).map(t => '<li>' + esc(t) + '</li>').join("") +
            (items.length > 30 ? '<li>… et ' + (items.length - 30) + ' autre(s)</li>' : "") + '</ul></div>';

        AppLayout.ouvrirFeuille("bas", "Aperçu de l'import",
            '<p class="texte-attenue" style="font-size:0.8rem;">📄 ' + esc(nomFichier) + '</p>' +
            '<div class="grille-kpi" style="margin-top:10px;">' +
            '<div class="kpi-mini"><div class="kpi-mini-libelle">Nouveaux clients</div><div class="kpi-mini-valeur">' + (plan.clients.length - nbMaj) + '</div></div>' +
            '<div class="kpi-mini"><div class="kpi-mini-libelle">Clients mis à jour</div><div class="kpi-mini-valeur">' + nbMaj + '</div></div>' +
            '<div class="kpi-mini"><div class="kpi-mini-libelle">Contacts</div><div class="kpi-mini-valeur">' + plan.contacts.length + '</div></div>' +
            '<div class="kpi-mini"><div class="kpi-mini-libelle">Lignes</div><div class="kpi-mini-valeur">' + plan.lignes.length + '</div></div>' +
            '</div>' +
            '<p class="aide-champ">Les clients, contacts et lignes déjà présents sont mis à jour, jamais dupliqués. ' +
            'Une cellule vide ne remplace pas une valeur existante.' +
            (plan.exemples ? ' ' + plan.exemples + ' ligne(s) d\'exemple ignorée(s).' : "") + '</p>' +
            liste("⚠️ Lignes ignorées", plan.erreurs, "var(--statut-alert)") +
            liste("ℹ️ Avertissements", plan.avertissements, "var(--statut-warn)") +
            (total > 0
                ? '<button type="button" class="bouton bouton--large" data-confirmer-import>Importer ' + total + ' élément' + (total > 1 ? "s" : "") + '</button>'
                : '<p class="message-erreur">Rien à importer dans ce fichier.</p>'));

        const bouton = document.querySelector("[data-confirmer-import]");
        if (bouton) bouton.addEventListener("click", () => {
            const b = Donnees.appliquerImport(plan);
            /* Envoi immédiat : l'équipe reçoit les modifications sans attendre. */
            if (b.ok && typeof Synchro !== "undefined") Synchro.synchroniser();
            AppLayout.fermerFeuille();
            AppLayout.toastSucces(b.ok
                ? "Import terminé ✓ — " + b.clientsCrees + " créé(s), " + b.clientsMaj + " mis à jour · " +
                (b.contactsCrees + b.contactsMaj) + " contact(s) · " + (b.lignesCreees + b.lignesMaj) + " ligne(s)"
                : "⚠️ Import non enregistré : le navigateur a refusé l'écriture");
        });
    }

    /* ---------- Export des clients ---------- */

    function lignesExport() {
        const clients = Donnees.listerClients();
        const oui = (b) => b === false ? "Non" : "Oui";
        const clientsL = clients.map(c => [c.nom, c.groupe, c.adresse, c.codePostal, c.ville, c.pays, c.telephone, c.email,
            c.typeProduction, Donnees.MOIS[c.debutCampagne - 1], Donnees.MOIS[c.finCampagne - 1], c.cadenceJours, oui(c.actif),
            Formulaires.membresEquipe().length ? (c.technicien ? Formulaires.nomTechnicien(c.technicien).replace(/ \(moi\)$/, "") : "Non attribué") : "",
            c.notes]);
        const contactsL = [], lignesL = [];
        clients.forEach(c => {
            Donnees.contactsDuClient(c.id).forEach(k => contactsL.push([c.nom, k.role, k.prenom, k.nom, k.telephoneFixe,
                k.mobile, k.email, k.principal ? "Oui" : "Non", k.notes]));
            Donnees.lignesDuClient(c.id).forEach(l => lignesL.push([c.nom, l.nom, l.marque, l.modele, l.numeroSerie,
                l.formatHabituel, l.produitHabituel, l.cadenceLigne === undefined || l.cadenceLigne === "" ? null : Number(l.cadenceLigne) || l.cadenceLigne,
                l.molette1Fournisseur, l.molette1Ref, l.molette2Fournisseur, l.molette2Ref, l.mandrinFournisseur, l.mandrinRef,
                Donnees.estLigneActive(l) ? "Oui" : "Non",
                Donnees.STATUTS_LIGNE.find(st => st.cle === Donnees.statutLigne(l)).libelle, l.fournisseurActuel, l.notes]));
        });
        const col = (nom) => COLONNES[nom].map(c => ({ titre: c[0], largeur: c[2] }));
        return [
            { nom: "Clients", colonnes: col("Clients"), lignes: clientsL },
            { nom: "Contacts", colonnes: col("Contacts"), lignes: contactsL },
            { nom: "Lignes", colonnes: col("Lignes"), lignes: lignesL }
        ];
    }

    function ouvrirExport() {
        const nb = Donnees.getDonnees().clients.length;
        if (nb === 0) { AppLayout.toast("Aucun client à exporter"); return; }
        AppLayout.ouvrirFeuille("bas", "Exporter les clients",
            '<button type="button" class="feuille-action-item" data-export="xlsx">' +
            '<span class="feuille-action-icone">📗</span><span><strong>Excel (.xlsx)</strong><br>' +
            '<span class="texte-attenue" style="font-size:0.78rem;">Clients, contacts et lignes au format du modèle — modifiable puis réimportable</span></span></button>' +
            '<button type="button" class="feuille-action-item" data-export="csv">' +
            '<span class="feuille-action-icone">📄</span><span><strong>CSV</strong><br>' +
            '<span class="texte-attenue" style="font-size:0.78rem;">Liste des clients seule, pour un autre logiciel</span></span></button>');
        const date = Donnees.aujourdhuiIso();
        document.querySelector('[data-export="xlsx"]').addEventListener("click", () => {
            Excel.telechargerXlsx("clients-campagne-" + date + ".xlsx", lignesExport());
            AppLayout.fermerFeuille();
            AppLayout.toastSucces("Export Excel téléchargé ✓");
        });
        document.querySelector('[data-export="csv"]').addEventListener("click", () => {
            const f = lignesExport()[0];
            Excel.telechargerCsv("clients-campagne-" + date + ".csv", f.colonnes, f.lignes);
            AppLayout.fermerFeuille();
            AppLayout.toastSucces("Export CSV téléchargé ✓");
        });
    }

    return { analyser, ouvrirImport, ouvrirExport, lignesExport };
})();
