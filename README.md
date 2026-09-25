# AC SAT CAMPAGNE

Outil personnel de suivi des **visites de campagne** (sertissage) :
chez quel client aller, et quelle ligne contrôler, toutes les 2 à 3 semaines.

Bâti sur le socle d'AC SAT Field : même style (`CSS/style.css` copié tel quel),
même ossature de navigation, même principe d'accès aux données.

## Ouvrir l'application

Ouvrir `Index.html`, ou servir le dossier en local :

```
py -m http.server 8080
```

puis `http://localhost:8080/Index.html`.

## Structure

```
AC-SAT-CAMPAGNE/
├── Index.html          À visiter (tableau des échéances)
├── Planning.html       Vue éclatée de l'année, filtres, synthèse, compte rendu
├── Clients.html        Liste des clients, import / export Excel
├── Client.html         Fiche client : Lignes · Contacts · Historique · Infos
├── Reglages.html       Profil, apparence, sauvegarde
├── Documents.html      Fiches de référence (Documents/*.html, FR et ES)
├── CSS/style.css       Style maison AC SAT Field (copie intacte)
├── CSS/campagne.css    Composants propres à cette application
├── Js/Donnees.js       SEULE couche d'accès aux données + moteur d'échéances + suivi des modifications
├── Js/Synchro.js       Synchronisation entre appareils (Supabase)
├── Js/AppLayout.js     Barre latérale, navigation mobile, feuilles, toasts
├── Js/Formulaires.js   Formulaires client / contact / ligne / visite
├── Js/TableauBord.js   Page À visiter
├── Js/Clients.js       Page Clients
├── Js/ClientFiche.js   Fiche client
├── Js/Reglages.js      Page Réglages
├── Js/Documents.js     Page Documents (catalogue des fiches)
├── Js/Planning.js      Page Planning (grille mois / semaines, synthèse, export)
├── Js/Excel.js         Lecture / écriture .xlsx et CSV
├── Js/EchangesExcel.js Import du modèle, export des clients
├── Js/Departements.js  Départements et régions (filtres d'emplacement)
├── Modeles/            Modèle d'import Excel (lien « ⬇ modèle »)
├── Vendor/fflate/      Compression ZIP (MIT) utilisée par Excel.js
├── Vendor/supabase/    supabase-js 2.117.1 (MIT), version navigateur
├── manifest.webmanifest / sw.js   Application installable, ouverture hors ligne
├── Images/             Logo et icônes
├── netlify.toml / staticwebapp.config.json   Hébergement (Index.html avec I majuscule)
```

## Règle de calcul des rappels

Pour chaque ligne **suivie** d'un client **actif** et **en campagne** :

- pas encore visitée depuis le début de la campagne → **Pas encore vue**
- sinon échéance = dernière visite *de campagne* + cadence du client
  - échéance dépassée → **En retard**
  - échéance dans 3 jours ou moins → **À prévoir**
  - sinon → **À jour**

Les visites « Maintenance / hiver » sont enregistrées mais ne repoussent pas
l'échéance de campagne. Hors campagne : aucun rappel automatique (règle du mode
maintenance / hiver à définir).

## Données et synchronisation

Les données vivent sur l'appareil (`localStorage`, clé `acsc_donnees_v1`) :
l'application fonctionne sans réseau. Aucune page n'accède au stockage directement.

Une fois connecté (Réglages › Synchronisation), les appareils se synchronisent via le
projet Supabase **ac-sat-campagne** (région Paris, plan gratuit) :

- table `public.elements` : un enregistrement par client / contact / ligne / visite
  / rendez-vous (+ le nom du profil), protégée par RLS : chaque compte ne voit que ses lignes ;
- chaque modification locale est repérée à l'enregistrement (empreinte de chaque
  élément) et mise en file d'attente (clé `acsc_synchro_v1`) ;
- synchroniser = recevoir ce qui a changé ailleurs, puis envoyer la file ;
- conflit sur un même élément : la modification la plus récente gagne
  (côté appareil et côté base, fonction SQL `pousser_elements`) ;
- les suppressions sont des marqueurs, pour se propager aux autres appareils ;
- le thème reste propre à chaque appareil.

Déclenchement : ouverture, 2 s après une saisie, retour dans l'application, retour du
réseau, toutes les 5 min. Projet gratuit : mis en pause après 7 jours sans utilisation
(relance d'un clic dans le tableau de bord Supabase).

Sauvegarde manuelle toujours disponible : Réglages › Exporter (fichier JSON).

## Excel

- **Import** (Clients › Importer Excel) : modèle `Modeles/Modele_Import_Visites_Campagne.xlsx`.
  Aperçu avant validation. Client reconnu par son nom, contact par client + prénom + nom,
  ligne par client + nom : mis à jour, jamais dupliqués. Une cellule vide ne remplace pas
  une valeur existante. Format .xlsx uniquement (pas l'ancien .xls).
- **Export des clients** : au format du modèle (réimportable) ou CSV.
- **Compte rendu** (Planning › Compte rendu) : Excel à 4 onglets — Compte rendu, Synthèse
  par client, Planning mensuel, Visites — ou CSV des visites, selon les filtres affichés.
- Pas de SheetJS : la version publiée sur npm/cdnjs (0.18.5) n'est plus maintenue et porte
  des failles connues. `Excel.js` lit et écrit le format directement.

## Lots

1. ✅ Socle, clients, lignes, contacts, visites, tableau À visiter, sauvegarde
2. ✅ Planning annuel (mois / semaines), filtres, synthèse, compte rendu, import / export Excel
3. ✅ Synchronisation téléphone ⇄ ordinateur, application installable
4. ✅ Visites planifiées (rendez-vous) et outillage des lignes (molettes, mandrin)
5. Règle du mode maintenance / hiver
