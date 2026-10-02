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
├── Planning.html       Planning d'interventions : timeline ou grille par mois, filtres, chiffres clés, compte rendu
├── Clients.html        Liste des clients, import / export Excel
├── Client.html         Fiche client : Lignes · Contacts · Historique · Infos
├── Tournee.html        Tournée : propositions à confirmer, confirmés, réglages de la tournée
├── Reglages.html       Profil, apparence, synchronisation, notifications, équipe, sauvegarde
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
├── Js/Tournee.js       Onglet Tournée
├── Js/Reglages.js      Page Réglages
├── Js/Documents.js     Page Documents (catalogue des fiches)
├── Js/Planning.js      Page Planning (timeline, grille par mois, chiffres clés, export)
├── Js/Excel.js         Lecture / écriture .xlsx et CSV
├── Js/EchangesExcel.js Import du modèle, export des clients
├── Js/Departements.js  Départements et régions (filtres d'emplacement)
├── Modeles/            Modèle d'import Excel (lien « ⬇ modèle »)
├── Vendor/fflate/      Compression ZIP (MIT) utilisée par Excel.js
├── Vendor/supabase/    supabase-js 2.117.1 (MIT), version navigateur
├── manifest.webmanifest / sw.js   Application installable, ouverture hors ligne
├── Images/             Logo et icônes
├── netlify.toml        Hébergement (Netlify) (Index.html avec I majuscule)
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

Équipe (Réglages › Équipe) : un compte appartient à une équipe au plus. Créer une équipe
donne un code de 8 caractères ; un collègue connecté avec **son propre compte** le saisit pour
la rejoindre. Clients, contacts et lignes passent alors par `public.elements_equipe`
(visibles par tous les membres) ; visites, rendez-vous et profil restent dans
`public.elements` (privés). Fonctions SQL : `creer_equipe`, `rejoindre_equipe`,
`quitter_equipe`, `mon_equipe_details`, `pousser_elements_equipe`.

Sauvegarde manuelle toujours disponible : Réglages › Exporter (fichier JSON).

## Excel

- **Import** (Clients › Importer Excel) : modèle `Modeles/Modele_Import_Visites_Campagne.xlsx`.
  Aperçu avant validation. Client reconnu par son nom, contact par client + prénom + nom,
  ligne par client + nom : mis à jour, jamais dupliqués. Une cellule vide ne remplace pas
  une valeur existante. Format .xlsx uniquement (pas l'ancien .xls).
- **Export des clients** : au format du modèle (réimportable) ou CSV.
- **Compte rendu** (Planning › Compte rendu) : Excel à 5 onglets — Compte rendu, Synthèse
  par client, Planning mensuel, Visites, Rendez-vous prévus — ou CSV des visites, selon les filtres affichés.
- Pas de SheetJS : la version publiée sur npm/cdnjs (0.18.5) n'est plus maintenue et porte
  des failles connues. `Excel.js` lit et écrit le format directement.

## Notifications push

- Réglages › 🔔 Notifications : à activer sur chaque appareil (iPhone : application installée, iOS 16.4+).
- Fonction serveur `supabase/functions/rappels` (déployée sur Supabase) : appelée toutes les
  15 min par la tâche planifiée `rappels-ac-sat-campagne` (pg_cron + pg_net). Elle envoie à
  chacun son résumé du matin (heure réglable dans « Tournée automatique ») et un rappel 1 h
  avant chaque rendez-vous confirmé ; chaque notification n'est envoyée qu'une fois
  (`notifications_journal`), les appareils désinstallés sont retirés.
- Tables : `push_abonnements` (un appareil = un abonnement), `notifications_journal` ;
  clés VAPID et secret de la tâche dans le schéma privé `prive.config` (jamais exposé).
- La clé VAPID **publique** figure dans `Js/Synchro.js` ; la clé privée reste sur le serveur.

## Animation d'ouverture

Une vidéo plein écran (logo qui s'illumine, calendrier et repère qui se dessinent, « AC SAT CAMPAGNE ») s'affiche à
l'ouverture de l'application, puis s'efface en fondu. Fichiers : `Media/ouverture.mp4` (jouée en priorité),
`Media/ouverture.webm` (secours), `Media/ouverture-poster.jpg` (image d'attente). Code : `Js/Splash.js`, styles
« Animation d'ouverture » de `CSS/campagne.css`, et deux petits scripts en tête de chaque page (décision, puis Splash.js chargé sans différé pour être disponible dans Réglages).

- **Quand** : à la première page d'une session (fermer l'application ou l'onglet la rejoue ; passer d'une page à
  l'autre ne la rejoue pas).
- **Réglage** (Réglages › 🎬 Animation d'ouverture, propre à chaque appareil, `localStorage.acsc_animation`) :
  *Toujours* (défaut) ; *Suivre l'appareil* = pas de vidéo si le système demande de réduire les animations
  (Windows : Paramètres › Accessibilité › Effets visuels › Effets d'animation ; Android : « Supprimer les
  animations ») ou l'économie de données ; *Jamais*. Le bouton « ▶ Revoir l'animation » la joue tout de suite.
- **Journal** : la carte « Dernières ouvertures » liste les 5 dernières issues (jouée, passée, ignorée et pourquoi,
  vidéo trop lente, illisible, lecture refusée) — premier réflexe si l'animation « ne marche pas » sur un appareil.
- **Écran de démarrage Android** : avant la vidéo, Android affiche sa propre image (l'icône enregistrée à
  l'INSTALLATION sur un fond blanc). Elle ne dépend pas du code : pour la mettre à jour, désinstaller puis réinstaller
  l'application. La barre d'état passe en clair pendant la vidéo (meta theme-color, rétablie ensuite).
- **Elle ne bloque jamais l'application** : appui n'importe où, bouton « Passer » ou touche Échap / Entrée / Espace ;
  fin automatique si la vidéo ne démarre pas en 4,5 s (réseau lent, hors ligne, lecture refusée) ; durée = celle de
  la vidéo + 1,5 s au plus ; abandon seulement si les DEUX formats (MP4 puis WebM) sont illisibles ; filet de
  sécurité de 14 s si `Splash.js` ne se charge pas.
- **Sans son** : les navigateurs bloquent le son à l'ouverture.
- **Fond** : `#f9f8fb` = couleur exacte des bords de la vidéo (aucune jonction visible) ; c'est aussi le
  `background_color` du manifeste (écran de démarrage système Android).
- **Service worker** : les vidéos et les requêtes partielles (Range) ne sont jamais mises en cache (sinon la lecture
  échoue sur iPhone). Netlify : cache d'un an sur `/Media/*` — **renommer le fichier** pour publier une nouvelle vidéo.
- **Remplacer la vidéo** : recadrer autour du logo, sans le son, puis encoder en deux formats, par exemple :
  `ffmpeg -i source.mp4 -vf "crop=…,scale=780:624" -an -c:v libx264 -crf 25 -profile:v main -pix_fmt yuv420p -movflags +faststart ouverture.mp4`
  et `ffmpeg -i source.mp4 -vf "crop=…,scale=780:624" -an -c:v libvpx-vp9 -crf 33 -b:v 0 ouverture.webm`. Si le fond de la
  nouvelle vidéo change, mettre à jour `#f9f8fb` dans `campagne.css` et `manifest.webmanifest`.
- **Désactiver** : retirer les deux lignes `<script>` (décision et `Js/Splash.js`) des pages.
- Les scripts d'audit (`Tests/navigateur/`) et le banc de test posent `sessionStorage.acsc_splash` pour ne pas la voir.

## Compatibilité

**Appareils vérifiés** (dans Chromium, 17 formats) : iPhone SE 320×568, SE 3 375×667, 12 mini 375×812, 14 390×844,
15 Pro Max 430×932 ; Galaxy A/S 360×780 et 412×915, Pixel 393×851 ; Galaxy Z Fold fermé 344×882 et ouvert 673×841 ;
iPad mini 744×1133, tablette 800×1280 ; et en paysage 667×375, 844×390, 915×412, 932×430, 841×673. Sur chacun :
aucun défilement horizontal, aucun texte coupé, cibles tactiles d'au moins 32 px, champs à 16 px (pas de zoom
iPhone), fenêtres entièrement atteignables. Texte agrandi à 130 % et 150 % (réglage d'accessibilité) : sans défaut.

**Navigateurs pris en charge** : Chrome / Edge / Samsung Internet récents ; iOS 15.4 ou plus (iPhone 6s et suivants).
Sur un navigateur d'avant 2023 (Chrome < 111, Safari < 16.2, Samsung Internet < 22), les couleurs `oklch()` et
`color-mix()` sont remplacées par des couleurs classiques (bloc généré en fin de `CSS/campagne.css`, rendu quasi
identique). **Après toute modification de couleur** : `node Tests/navigateur/jetons.mjs` puis
`python3 Tests/navigateur/generer-compatibilite.py Tests/navigateur/sortie/tokens.json`.

**Non testé** (indisponible dans l'environnement de développement) : Safari, Firefox et vrais téléphones ; l'encoche
n'est vérifiée que par les règles CSS (`env(safe-area-inset-*)`), pas sur un appareil.

## Tests

Les tests ne dépendent plus du jour où on les lance (mois courant, vendredi de génération de la tournée) : un vendredi,
la page génère elle-même la tournée à son ouverture, ce que les tests neutralisent explicitement.

`Tests/` : environ 480 vérifications (jsdom) ; `Tests/navigateur/` : audit des écrans dans un vrai Chromium. `cd Tests && npm install && npm test`.
Lancés automatiquement sur GitHub à chaque envoi (`.github/workflows/tests.yml`).

## Lots

1. ✅ Socle, clients, lignes, contacts, visites, tableau À visiter, sauvegarde
2. ✅ Planning annuel (mois / semaines), filtres, synthèse, compte rendu, import / export Excel
3. ✅ Synchronisation téléphone ⇄ ordinateur, application installable
4. ✅ Visites planifiées (rendez-vous) et outillage des lignes (molettes, mandrin)
5. ✅ Types de visite (homologation, validation, essai, dépannage, mise en route, formation, audit,
   réunion, réunion de fin de campagne), références (étiquette, boîte, fond, molettes, mandrin)
6. ✅ Planning d'interventions selon la maquette (timeline, chiffres clés)
   ✅ Statut des lignes : active / inactive / autre fournisseur (seules les actives entrent dans les rappels et les visites)
7. ✅ Équipe : clients, lignes et contacts partagés (table elements_equipe), visites et rendez-vous privés
   ✅ Technicien de chaque client (rappels, tournée, planning et notifications : mes clients + non attribués ;
   colonne « Technicien » dans le modèle Excel, l'export Excel et le CSV)
8. ✅ Gestion automatique : tournée proposée chaque semaine (onglet Tournée),
   confirmation en un clic, message pré-rédigé au client, visites passées à clôturer,
   ajout à l'agenda (.ics), modification d'une visite enregistrée
8a1. ✅ Suppression de client : bouton « 🗑 Supprimer » dans la fiche, « Zone sensible » dans la fenêtre Modifier, mode
   « ☑ Sélectionner » sur la page Clients (plusieurs à la fois). Confirmation avec le nombre de lignes, contacts,
   visites et rendez-vous emportés, avertissement si le client est partagé avec une équipe, annulation pendant 10 s.
8a7. ✅ Catalogue de produits (liste « Produit » des lignes, visites et visites effectuées) : 115 produits rangés par
   famille (légumes, légumineuses, tomates, fruits, poissons, plats cuisinés, soupes et sauces, laitages, boissons,
   aliments pour animaux), tes produits déjà utilisés en premier (« Déjà utilisés chez toi »), « ➕ Autre… » pour en
   ajouter. Formats de départ : 1/8, 1/4, 1/2, 1/2H, 1/2M, 4/4, 2/1, 3/1, 5/1, 10/1 (à valider). Catalogue :
   `CATALOGUE_PRODUITS` dans `Js/Donnees.js`.
8a8. ✅ Statuts de visite dans l'historique (déjà livrés) : Effectuée / Reportée / Non effectuée / Annulée, pastille sur
   chaque ligne, filtres par statut, motif, date de report ; seules les visites effectuées comptent pour les échéances.
8a6. ✅ « Enregistrer une visite » avec une date à venir : plus de refus sec — le formulaire l'annonce (bandeau), le bouton
   devient « Planifier cette visite » et ouvre la planification avec client, ligne, type, remarques et références repris.
   (Modifier une visite DÉJÀ enregistrée vers le futur reste refusé.)
8a5. ✅ Planifier en avance depuis le Planning : bouton « Planifier » (en-tête), clic sur la frise à la date voulue
   (repère pointillé au survol), clic sur une case vide d'un mois à venir, bouton « Planifier une visite ici »
   dans le détail d'une case. Dates à venir seulement (y compris l'année suivante) ; un jour non travaillé est décalé
   au prochain jour travaillé (réglages de la Tournée). Clients et lignes inactifs : non planifiables.
8a4. ✅ Animation d'ouverture (réglable dans Réglages) : vidéo `Media/ouverture.mp4` (.webm en secours), 5,2 s, muette, recadrée autour du logo
   (183 Ko), jouée à la première page de chaque session (voir la section « Animation d'ouverture »)
8a3. ✅ Nettoyage du code mort : 772 règles de style jamais utilisées supprimées de `style.css` (122 Ko → 24 Ko), 5 dans
   `campagne.css`, 5 variables CSS et 1 animation orphelines, l'ancienne fonction `supprimerClient` (remplacée par
   `supprimerClients`), le fichier `staticwebapp.config.json` (autre hébergeur), 10 variables de couleur jamais lues. Vérifié par deux méthodes (analyse des
   noms de classes dans le code ET couverture réelle des styles dans le navigateur) puis par comparaison pixel à
   pixel avant/après : 45 pages et 32 fenêtres identiques.
8a2. ✅ Compatibilité tous téléphones (voir la section « Compatibilité »)
8a0. ✅ Thème sombre aux couleurs de Samsung (One UI) : fond noir pur #000000, cartes #171719, texte #FFFFFF,
   gris #AEADB2, séparateurs #303032 ; accent rouge #F9423D conservé (texte sur l'accent #1A1213, 5,2:1).
   Variables dans CSS/campagne.css (bloc « Thème sombre — palette Samsung »). Thème clair inchangé.
8a. ✅ Nouveau logo (Images/) : logo.png (en-tête, fiches), icone-192/512 (installation, favicon), icone-maskable-512
   (Android), apple-touch-icon (iPhone, opaque), badge-96 (notifications, silhouette blanche)
8b. ✅ Adaptation aux écrans : audit dans un vrai navigateur (téléphone, tablette, ordinateur, thème sombre,
   paysage) et corrections ; listes déroulantes avec saisie libre (« ➕ Autre… ») pour groupe, pays, production,
   rôle, marque, modèle, format, produit, fournisseur actuel, défaut constaté, contacts, machines
9. ✅ Notifications push : résumé du matin et rappel 1 h avant chaque rendez-vous confirmé
10. Documents joints aux visites
11. Règle du mode maintenance / hiver
