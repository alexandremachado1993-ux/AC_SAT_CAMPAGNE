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
├── Serti.html          Tous les contrôles de serti : filtres, validation OUI / NON, comparaison avec le Seametal du client
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
├── Js/PlanningCalcul.js  Tableau de bord du Planning : périodes (semaine, mois, trimestre, année), catégories exclusives à 100 %, séries mensuelles (fonctions pures, testées)
├── Js/PlanningTableau.js Tableau de bord du Planning : cartes, barre de statut, calendrier, liste, graphiques, panneau Techniciens (HTML)
├── Js/Planning.js      Page Planning (timeline, grille par mois, chiffres clés, export)
├── Js/Excel.js         Lecture / écriture .xlsx et CSV
├── Js/EchangesExcel.js Import du modèle, export des clients
├── Js/Departements.js  Départements et régions (filtres d'emplacement)
├── Js/ReferentielSerti.js  Valeurs du document SQ/EMB/067 rév. C (12 formats, 11 paramètres) et bloc « AJOUTS » à compléter
├── Js/SertiCalcul.js   Règles de verdict, validation OUI / NON, nettoyage et comparaison (fonctions pures, testées)
├── Js/FicheSerti.js    Bloc « Contrôle de serti » des formulaires de visite (saisie tête par tête)
├── Js/Serti.js         Page Serti (liste, filtres, détail, comparaison)
├── Js/SertiRapport.js  Rapport de serti sur une période (client / ligne au choix) : Excel en 6 feuilles et aperçu imprimable (PDF)
├── Js/Erreurs.js       Gestion centralisée des erreurs : journal local, message sobre, gestionnaires globaux (chargé EN PREMIER)
├── Js/Nouveautes.js    Fenêtre « Quoi de neuf » : liste des nouveautés (étapes + photos), mémoire de ce qui a été vu
├── Js/Splash.js        Animation d'ouverture (vidéo, réglage, journal des ouvertures)
├── Modeles/            Modèle d'import Excel (lien « ⬇ modèle »)
├── Vendor/fflate/      Compression ZIP (MIT) utilisée par Excel.js
├── Vendor/supabase/    supabase-js 2.117.1 (MIT), version navigateur
├── manifest.webmanifest / sw.js   Application installable, ouverture hors ligne
├── Images/             Logo et icônes
├── Media/              Vidéo d'ouverture (.mp4, .webm de secours) et son affiche
├── Media/nouveautes/   Photos de présentation des nouveautés (WebP, noms versionnés -v1)
├── Documents/          Fiches de référence (HTML, FR et ES)
├── 404.html            Page affichée à la place des fichiers de développement (voir « Déploiement »)
├── version.txt         Numéro de version (identique à AppLayout.VERSION, vérifié par un test)
├── version.json        Version publiée + nouveauté de cette version (lu par l'application ET par la fonction serveur « rappels »)
├── Tests/              Vérifications automatiques (jsdom) et audit dans un vrai navigateur
├── supabase/functions/rappels/   Fonction serveur : résumé du matin et rappels
├── .github/workflows/  Tests lancés automatiquement à chaque envoi
├── envoyer.bat / envoyer-auto.bat   Scripts d'envoi vers GitHub (non publiés)
├── netlify.toml        Hébergement (Netlify) (Index.html avec I majuscule)
```

## Architecture : où est quoi

| Je cherche… | Où |
|---|---|
| L'**écran** d'une page | `Js/<Page>.js` (`TableauBord`, `Clients`, `ClientFiche`, `Tournee`, `Reglages`, `Documents`, `Planning`, `Serti`) |
| Les **formulaires** (client, ligne, visite, rendez-vous) | `Js/Formulaires.js` (HTML : `htmlFormulaireVisite`… ; contrôle : `verifierSaisieVisite`) |
| La **logique métier** pure (sans écran, testée seule) | `PlanningCalcul.js`, `SertiCalcul.js`, `ReferentielSerti.js`, et le moteur d'échéances dans `Donnees.js` |
| Les **données** et leur stockage local | `Js/Donnees.js` (SEULE couche d'accès : jamais de `localStorage` ailleurs pour les données) |
| La **synchronisation** (Supabase, équipe) | `Js/Synchro.js` ; côté serveur : tables et fonctions SQL (voir « Synchronisation ») |
| La **navigation mobile** (barre du bas, tiroir « Plus d'outils », présentation) | `Js/AppLayout.js` (`construireNavBasse`, `construireTiroir`), `Js/Presentation.js` ; styles `.nav-poignee`, `.nav-tiroir`, `.pres` dans `CSS/campagne.css` |
| La **typographie et les espacements** | jetons de `:root` dans `CSS/style.css` (`--texte-*`, `--titre-*`, `--interligne*`, `--rayon-*`) : ne jamais écrire une taille en dur |
| Les **notifications** | `Js/Notifications.js` (navigateur : permission, abonnement), `Js/Synchro.js` (appels serveur seulement), `sw.js` (réception), `supabase/functions/rappels/` (envoi) |
| La **navigation mobile** (barre du bas, menu étendu « Plus d'outils », gestes) | `Js/AppLayout.js` (`construireNavBasse`, `construireTiroir`), styles `.nav-*` dans `CSS/campagne.css` |
| La **présentation de première connexion** | `Js/Presentation.js`, styles `.pres-*` |
| Les **diagnostics** | `Js/Erreurs.js` (journal), `Js/AutoDiagnostic.js` (bouton « Vérifier mon installation », Réglages › Informations) |
| La **mise à jour** de l'application et les **nouveautés** | `Js/AppLayout.js` (section mise à jour), `Js/Nouveautes.js`, `version.json` |
| L'**authentification** | Supabase Auth, pilotée par `Js/Synchro.js` (connexion, inscription, session) |
| Le **démarrage** d'une page | `Js/Amorce.js` (dans `<head>`, avant l'affichage : animation d'ouverture), `Js/Demarrage.js` (en bas ; la page se déclare par `<body data-page="…">`) |
| La **sécurité** | `netlify.toml` (en-têtes dont la CSP) ; base : `supabase/migrations/` (une migration = un fichier daté, appliquée puis versionnée) |
| Les **erreurs** | `Js/Erreurs.js` (journal local, Réglages › Informations › Diagnostic) |
| La **mise en page**, thèmes, responsive | `CSS/style.css` (base), `CSS/campagne.css` (spécifique ; l'échelle des points de rupture est en tête) |
| Les **tests** | `Tests/` (`npm test`), analyse statique `npm run lint`, audits navigateur `Tests/navigateur/` |
| Le **déploiement** | GitHub → Netlify (`netlify.toml`) ; fonction serveur : Supabase (voir « Déploiement ») |

Règles : une page = un fichier `Js/<Page>.js` qui assemble ; le calcul ne touche jamais l'écran ; l'écran ne lit jamais le stockage directement (il passe par `Donnees`) ; le journal d'erreurs, l'état des mises à jour et le thème sont **propres à l'appareil** et ne sont jamais synchronisés.

**Ajouter…** une donnée synchronisée : champ dans `Donnees.js` + normalisation + test. Une page : `<Page>.html` + `Js/<Page>.js` + entrée dans `AppLayout` (menu) + déclaration dans `Tests/test25.js`. Une nouveauté visible : bloc en tête de `Js/Nouveautes.js` + photos (`Tests/navigateur/nouveautes-captures.mjs`). Une erreur à tolérer : `Erreurs.consigner("module : raison", e)` (jamais un `catch` vide, un test l'interdit) ; une erreur anormale : `Erreurs.signaler(…)`.

## Sécurité : règles à respecter

- **CSP stricte** (`netlify.toml`) : `script-src 'self'` — **aucun script en ligne** dans les pages, **aucun** `onclick="…"` ni `onerror="…"` en attribut (ni dans les pages, ni dans le HTML construit par `Js/`) : il serait bloqué en ligne. Un test (`test40.js`) le vérifie. Pour réagir à un événement : `addEventListener`.
- **Toute nouvelle adresse externe** (une API, un service) doit être ajoutée à `connect-src` dans la CSP ; le test refuse une adresse écrite dans le code mais non autorisée. Aujourd'hui : le site, Supabase, `geo.api.gouv.fr`.
- **Base** : le rôle anonyme (`anon`) n'a aucun droit sur les tables ; l'application n'utilise que des comptes connectés (RLS). Chaque évolution du schéma passe par un fichier de `supabase/migrations/`, **testée d'abord dans une transaction annulée**.
- **Rejoindre une équipe** : limité à 5 faux codes par compte et par 15 minutes (100 par heure au total). La base RENVOIE `{"erreur":"code_inconnu"}` (au lieu de lever une exception, qui annulerait le décompte) ; `Synchro.js` la retransforme en erreur.
- **À faire dans le tableau de bord Supabase** (non automatisable ici) : désactiver les inscriptions publiques, activer la protection contre les mots de passe compromis si l'offre le permet.

## Déploiement et fichiers non publiés

Netlify publie le dossier tel quel. Les fichiers qui ne servent qu'au développement (`Tests/`, `supabase/`, `.github/`,
`README.md`, les scripts `.bat`, `netlify.toml`, `.gitignore`) sont **présents dans le dossier mais jamais servis** :
`netlify.toml` les renvoie vers `404.html` (statut 404, `force = true`). Le test `Tests/test25.js` échoue si un
nouveau fichier ou dossier est ajouté à la racine sans avoir décidé s'il est publié ou bloqué.

Envoi vers GitHub : déposer le **contenu** du dossier `AC-SAT-CAMPAGNE` (celui qui contient `Index.html`), pas le dossier
qui l'entoure. Si Netlify ne publie plus automatiquement après un envoi (cas fréquent après un dépôt manuel par
glisser-déposer dans Netlify) : Netlify › Deploys › « Start auto publishing ».

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

`Tests/` : plus de 1 400 vérifications (jsdom) ; `Tests/navigateur/` : audit des écrans dans un vrai Chromium. `cd Tests && npm install && npm test`.
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
8a. ✅ Nouveau logo (Images/) : logo.png (en-tête, fiches), icone-192/512 (installation, favicon), icone-maskable-512
   (Android), apple-touch-icon (iPhone, opaque), badge-96 (notifications, silhouette blanche)
8a0. ✅ Thème sombre aux couleurs de Samsung (One UI) : fond noir pur #000000, cartes #171719, texte #FFFFFF,
   gris #AEADB2, séparateurs #303032 ; accent rouge #F9423D conservé (texte sur l'accent #1A1213, 5,2:1).
   Variables dans CSS/campagne.css (bloc « Thème sombre — palette Samsung »). Thème clair inchangé.
8a1. ✅ Suppression de client : bouton « 🗑 Supprimer » dans la fiche, « Zone sensible » dans la fenêtre Modifier, mode
   « ☑ Sélectionner » sur la page Clients (plusieurs à la fois). Confirmation avec le nombre de lignes, contacts,
   visites et rendez-vous emportés, avertissement si le client est partagé avec une équipe, annulation pendant 10 s.
8a2. ✅ Compatibilité tous téléphones (voir la section « Compatibilité »)
8a3. ✅ Nettoyage du code mort : 772 règles de style jamais utilisées supprimées de `style.css` (122 Ko → 24 Ko), 5 dans
   `campagne.css`, 5 variables CSS et 1 animation orphelines, l'ancienne fonction `supprimerClient` (remplacée par
   `supprimerClients`), le fichier `staticwebapp.config.json` (autre hébergeur), 10 variables de couleur jamais lues. Vérifié par deux méthodes (analyse des
   noms de classes dans le code ET couverture réelle des styles dans le navigateur) puis par comparaison pixel à
   pixel avant/après : 45 pages et 32 fenêtres identiques.
8a4. ✅ Animation d'ouverture (réglable dans Réglages) : vidéo `Media/ouverture.mp4` (.webm en secours), 5,2 s, muette, recadrée autour du logo
   (183 Ko), jouée à la première page de chaque session (voir la section « Animation d'ouverture »)
8a5. ✅ Planifier en avance depuis le Planning : bouton « Planifier » (en-tête), clic sur la frise à la date voulue
   (repère pointillé au survol), clic sur une case vide d'un mois à venir, bouton « Planifier une visite ici »
   dans le détail d'une case. Dates à venir seulement (y compris l'année suivante) ; un jour non travaillé est décalé
   au prochain jour travaillé (réglages de la Tournée). Clients et lignes inactifs : non planifiables.
8a6. ✅ « Enregistrer une visite » avec une date à venir : plus de refus sec — le formulaire l'annonce (bandeau), le bouton
   devient « Planifier cette visite » et ouvre la planification avec client, ligne, type, remarques et références repris.
   (Modifier une visite DÉJÀ enregistrée vers le futur reste refusé.)
8a7. ✅ Catalogue de produits (liste « Produit » des lignes, visites et visites effectuées) : 115 produits rangés par
   famille (légumes, légumineuses, tomates, fruits, poissons, plats cuisinés, soupes et sauces, laitages, boissons,
   aliments pour animaux), tes produits déjà utilisés en premier (« Déjà utilisés chez toi »), « ➕ Autre… » pour en
   ajouter. Formats de départ : 1/8, 1/4, 1/2, 1/2H, 1/2M, 4/4, 2/1, 3/1, 5/1, 10/1 (à valider). Catalogue :
   `CATALOGUE_PRODUITS` dans `Js/Donnees.js`.
8a8. ✅ Statuts de visite dans l'historique (déjà livrés) : Effectuée / Reportée / Non effectuée / Annulée, pastille sur
   chaque ligne, filtres par statut, motif, date de report ; seules les visites effectuées comptent pour les échéances.
8a9. ✅ Bilan de fin de campagne : la réunion de fin de campagne (type « reunion-fin ») est rappelée sur le tableau de bord
   à partir de N semaines avant la fin de la campagne de CHAQUE client (réglage de la Tournée, 6 par défaut, 0 = jamais)
   et jusqu'à 60 jours après, tant qu'elle n'est ni effectuée ni planifiée. Bouton « Planifier » : formulaire prérempli
   (lendemain de la fin, jour travaillé). Pas de date figée : les dates de réunion ne sont pas connues d'avance.
   Hors périmètre volontairement : suivi hors campagne par ligne (voir la proposition), notifications du soir.
8b. ✅ Adaptation aux écrans : audit dans un vrai navigateur (téléphone, tablette, ordinateur, thème sombre,
   paysage) et corrections ; listes déroulantes avec saisie libre (« ➕ Autre… ») pour groupe, pays, production,
   rôle, marque, modèle, format, produit, fournisseur actuel, défaut constaté, contacts, machines
8c. ✅ Ménage et sécurité du déploiement (2026.10.04-a) : les fichiers de développement (Tests, supabase, .github, README,
    scripts .bat, netlify.toml) ne sont plus accessibles sur Internet (page 404.html) ; test de garde `test25.js` ;
    README remis en ordre (structure, numérotation des lots) ; aucun fichier orphelin ni fonction morte (vérifié par analyse).
8d. ✅ Contrôle de serti (2026.10.04-b) : bloc « 🔬 Contrôle de serti » dans « Enregistrer une visite » et « Visite effectuée »
    (toute visite effectuée sur une ligne), saisie tête par tête (0 à 24 têtes, par paire), verdict par mesure / tête / ligne
    (la pire tête décide), validation OUI / NON proposée puis modifiable (motif), contrôle du client (Seametal) saisi dans la
    même grille. Sur la ligne : « Têtes de sertissage » et « Format fournisseur » qui se complètent (1/2, 1/2H, 1/2M = ø83 ;
    4/4 = ø96 ou ø99). Nouvel onglet « Serti » (menu latéral ; menu du profil sur téléphone) : recherche, filtres client →
    ligne, format, OUI / NON / à surveiller, comparaison manuel ↔ client. Règles : critique = plage (croisure = minimum),
    recommandé = cible ± tolérance, « limite » = dernier cinquième. Hauteur du 1/2 et du 1/2H, profondeur de cuvette : non
    jugées tant qu'elles ne sont pas renseignées dans le bloc AJOUTS de `Js/ReferentielSerti.js`.
8e. ✅ Suites de la revue de code (2026.10.05-a) : la page Serti ne se chargeait plus après une modification manuelle (une apostrophe
    manquante dans `Js/Serti.js`) — corrigé, et un test (`test28.js`) vérifie désormais que CHAQUE script se compile et que chaque page
    référence des scripts existants. « Effacer le contrôle » propose « Annuler » pendant 10 secondes ; changer le statut d'une visite
    puis le rétablir ne perd plus la saisie de serti ; le nombre de têtes est strict (« 6abc » refusé) ; la liste de la page Serti est un
    groupe de boutons (accessibilité). Règle d'affichage : la validation OUI / NON est RECALCULÉE avec le référentiel actuel, sauf
    décision manuelle (jamais recalculée) — une tolérance ajoutée plus tard dans AJOUTS ne laisse plus une pastille périmée.
    OUI / NON retenu : fond plein + symbole dans les deux thèmes ; cibles tactiles de 44 px ; CI passée à Node 22.
8f. ✅ Rapport de serti et Phase 1 de la dette (2026.10.05-b) : bouton « 📊 Rapport / export » sur la page Serti (reprend les filtres) :
    période (du / au, périodes rapides), client et ligne au choix, détail des mesures facultatif. Excel (.xlsx) en 6 feuilles — Rapport,
    Contrôles, Mesures (une ligne par tête × mesure, prête pour un tableau croisé), Par mesure, Têtes à surveiller, Comparaison client —
    et aperçu imprimable (« Imprimer / enregistrer en PDF » du navigateur ; tout le reste de la page est masqué à l'impression).
    Phase 1 : bandeau « Nouvelle version disponible — Recharger » (compare `version.txt` du serveur à la version chargée, une fois par
    session, en http(s) seulement) et version affichée dans le menu du profil ; pastilles du serti = composant « pastille-statut » de
    l'application (une seule palette) ; couleurs de verdict du serti en JETONS CSS (`--v-*`, claire et sombre ; un test interdit de
    remettre des codes couleur en dur dans ce bloc) ; rangée de têtes collante sous le titre de la feuille, sur une ligne défilante.
    Encore à faire (dette) : jetons pour les autres écrans (statuts de l'application), fusion de `badge-statut`, module Excel du serti
    pour l'import des feuilles Seametal.
8g. ✅ « Quoi de neuf » avec photos (2026.10.05-c) : quand une nouveauté n'a pas encore été vue, une fenêtre l'annonce à l'ouverture —
    à quoi elle sert, comment l'utiliser (étapes numérotées) et 1 à 3 photos de l'application avec repères ①②③. « Compris » la marque
    vue (sur cet appareil) ; la croix = plus tard (reproposée à la session suivante). Une seule annonce par session, jamais pendant
    l'animation d'ouverture ni par-dessus une autre fenêtre, jamais à la première installation. Toujours rouvrible : menu du profil ›
    « 🎁 Nouveautés » (pastille = nombre de non vues).
    POUR ANNONCER UNE NOUVELLE FONCTIONNALITÉ : (1) ajouter une fonction de capture dans `Tests/navigateur/nouveautes-captures.mjs` puis
    `cd Tests/navigateur && npm install && node nouveautes-captures.mjs` (données fictives, repères numérotés ; note les dimensions
    affichées) ; (2) ajouter un bloc EN TÊTE de la liste `LISTE` de `Js/Nouveautes.js` ; (3) lancer les tests : `Tests/test31.js` refuse
    un bloc incomplet, une photo absente, trop lourde (150 Ko), sans texte alternatif, aux dimensions fausses, ou un nom de client réel.
    /Media/* est mis en cache un an : si une image est régénérée, changer son suffixe (-v1 → -v2).
8h. ✅ Réglages › Informations (2026.10.05-d) : Réglages a maintenant deux onglets, « Réglages » (contenu inchangé) et « Informations »,
    dans un ordre logique : numéro de version (avec l'explication de son format) · dernière mise à jour (date de la version, en toutes lettres,
    et son ancienneté) · état (« Tu as la dernière version » / nouvelle version disponible avec « Recharger » / vérification impossible,
    bouton « Vérifier les mises à jour ») · puis la dernière nouveauté (titre, résumé, photo, « Voir la nouveauté », « Toutes les
    nouveautés »). Lien direct `Reglages.html#informations` ; la version du menu du profil y mène. La version a quitté la carte « Tes données ».
8i. ✅ Mises à jour et nouveautés : l'application te prévient (2026.10.05-e).
    DANS L'APPLICATION : au démarrage (puis au retour sur l'application et toutes les 30 min), elle compare sa version à `version.json`
    du site. Mise à jour disponible → fenêtre « Mise à jour disponible » qui annonce « Au programme » et propose « Mettre à jour
    maintenant » ou « Plus tard » (pas de nouvelle fenêtre avant 6 h) ; une pastille sur le profil (mise à jour + nouveautés non vues)
    et une entrée du menu restent tant qu'elle n'est pas installée ; Réglages › Informations montre l'état. Jamais pendant l'animation
    d'ouverture ni par-dessus une autre fenêtre ; hors connexion ou ouverte depuis un dossier : rien. Notification système locale :
    seulement application en arrière-plan, notifications autorisées, une par version.
    NOTIFICATION APPLICATION FERMÉE (serveur) : la fonction `rappels` (toutes les 15 min) lit `version.json` du site et envoie UNE
    notification par compte et par version (journal `notifications_journal`, clé « version:… »), à tous les appareils abonnés, seulement
    pour une version de moins de 3 jours, entre 8 h et 20 h 30 (heure de Paris), et aux comptes qui n'ont pas décoché « Me prévenir des
    mises à jour et des nouvelles fonctionnalités » (Réglages › Informations ; profil `tournee.prevenirVersions`, synchronisé).
    MISE EN SERVICE DU SERVEUR : redéployer la fonction `rappels` (fichiers `index.ts` et `logique.js`) comme lors de sa première
    installation. Facultatif : secret `SITE_URL` si le site change d'adresse (défaut : https://ac-sat-campagne.netlify.app).
    Aucune modification de base : réutilise `push_abonnements` et `notifications_journal`. Le branchement de `index.ts` ne peut pas être
    exécuté hors Supabase : à vérifier après déploiement (`bilan` renvoyé par la tâche : champ `versions`).
    À CHAQUE LIVRAISON : (1) changer `VERSION` dans `Js/AppLayout.js` ; (2) s'il y a une nouveauté, son bloc EN TÊTE de `LISTE`
    (`Js/Nouveautes.js`) avec LA MÊME version ; (3) `node Tests/maj-version.js` (écrit `version.txt` et `version.json`) ; (4) lancer les
    tests : `Tests/test33.js` refuse un fichier de version périmé. Sans nouveauté pour cette version, la notification dit simplement
    « Mise à jour disponible ».
8j. ✅ Points de navigation des photos (2026.10.05-f) : sous la galerie d'une nouveauté, 3 petits points façon Instagram, cliquables
    à la souris et au doigt (cibles de 44 px). Point actif = photo la plus centrée (première / dernière aux extrémités) ; un clic centre
    la photo ; flèches gauche / droite au clavier sur la galerie ; les points se masquent seuls quand tout tient à l'écran ; barre de
    défilement masquée ; défilement doux sauf si « réduire les animations » est activé. Aucune nouveauté annoncée pour cette version
    (retouche) : la notification serveur dira simplement « Mise à jour disponible ». Navigation entre nouveautés : « ‹ Précédent » · « 1/3 » · « Suivant › ».

8k. ✅ Planning : tableau de bord (2026.10.06-a). VUE PAR DÉFAUT du Planning (Timeline et Mois restent, bouton « Tableau de bord » pour revenir) :
    calendrier par SEMAINE / MOIS / TRIMESTRE / ANNÉE (+ vue Liste, détail d'un jour avec « Planifier »), synthèse, barre « Visites par statut »,
    anneau et trois graphiques mensuels, « Prochaine action », panneau repliable « Techniciens » (en équipe ; ouvert sur le technicien connecté).
    Quatre catégories qui s'EXCLUENT, donc 100 % exactement (plus forts restes), qui varient avec les filtres : réalisées (visites de la période) ·
    planifiées (rendez-vous à venir, aujourd'hui compris) · en retard (lignes en retard ou jamais vues À LA FIN de la période — aujourd'hui si elle est
    en cours —, plus les rendez-vous passés non réalisés) · échéances à venir. Une ligne n'est comptée qu'une fois (rendez-vous prévu = « planifiée »).
    Période passée : réalisées + retard (état à sa fin, calculé à cette date) ; future : planifiées + échéances. Le moteur d'échéances accepte une date
    de référence et l'option `{ tous: true }` (clients des autres techniciens). Le sélecteur « Client » et le filtre « Technicien » de la barre disparaissent
    dans cette vue (recherche et panneau les remplacent). Tests : `test36.js` (moteur), `test37.js` (écran, date figée au 6 octobre 2026) ; les anciens tests
    ouvrent la timeline par défaut (banc d'essai), `page("Planning.html", stock, "#tableau")` pour le tableau de bord. Style de secours régénéré :
    `python3 Tests/navigateur/generer-compatibilite.py Tests/navigateur/sortie/tokens.json`.

8l. ✅ Qualité interne (2026.10.06-c) : gestion centralisée des erreurs (`Erreurs.js` : 31 erreurs qui étaient avalées en silence sont
    désormais consignées ou signalées ; un écouteur de données qui plantait sans trace est signalé ; message sobre sans détail technique ;
    journal local dans Réglages › Informations › Diagnostic) ; analyse statique ESLint (`npm run lint`, aussi dans l'intégration continue) :
    variable morte, échappement inutile, fonction morte supprimés, 11 fonctions exposées sans raison retirées ; `visite()` allégée (HTML et
    validation extraits : `htmlFormulaireVisite`, `verifierSaisieVisite`) ; Safari : `-webkit-backdrop-filter` et replis `vh` avant `dvh` ;
    échelle unique de points de rupture CSS ; `.editorconfig` ; carte « Architecture : où est quoi ». Tests : `test38.js` (erreurs,
    diagnostic, validation, garde-fou « aucune erreur avalée »), `test39.js` (CONTRAT entre le moteur d'échéances de l'application et celui de
    la fonction serveur, sur 120 dates et 24 clients aléatoires : toute divergence future fait échouer la suite).
8m. ✅ Mode exécution (2026.10.06-d) : **sécurité** — CSP stricte (scripts en ligne sortis dans `Amorce.js` et `Demarrage.js`, un `onerror`
    en attribut remplacé par un écouteur) vérifiée dans Chromium avec contre-épreuves (un script injecté et un site étranger sont bloqués) ;
    base Supabase : **bug P0 corrigé** (« rejoindre une équipe » échouait à chaque appel : paramètre `code` ambigu), limite de 5 essais par
    15 minutes, rôle `anon` sans aucun droit sur les tables, index manquant ; migration versionnée (`supabase/migrations/`). **Accessibilité**
    — fenêtres : rôle dialog, focus géré, Échap, Tab enfermé, focus rendu ; menu : `aria-current="page"` ; mouvement réduit : filet global.
    **Mobile** — aides de saisie (clavier, majuscules, pas de remplissage automatique sur des champs de clients), touche « Rechercher ».
    **Ordinateur** — Tournée limitée à 1 120 px, cibles à la souris ≥ 32 px. Tests : `test40.js`.
8n. ✅ Fiabilité et vérité des données (2026.10.06-e) : **aucun faux succès** — un message « enregistré ✓ » n'est affiché que si l'écriture sur
    l'appareil a réellement réussi (`Donnees.stockageOk`, `AppLayout.toastSucces`, 30 messages protégés) ; l'alerte de stockage revient tant que
    le problème dure ; le journal de diagnostic garde aussi les entrées en mémoire quand le stockage est plein. **Synchronisation** — session
    expirée en cours de route : retour à l'écran de connexion, données conservées ; une erreur serveur inconnue n'est plus montrée telle quelle
    (message générique, détail dans le journal) ; droits refusés et lenteur du serveur ont leur message. **Formulaires** — un double clic ne crée
    plus de doublon (`envoiEnDouble`), sans bloquer la correction qui suit un refus. Tests : `test41.js` (parcours complets avec les VRAIS formulaires,
    rechargements, deuxième appareil, pannes réseau, session expirée, stockage refusé, doubles clics) et `Tests/faux-serveur.js` (faux serveur
    partagé, avec pannes simulables). Chaîne base vérifiée sur la vraie base (RLS, fonctions, isolation, lots invalides, accès anonyme refusé).
8o. ✅ Mobile, réseau lent, structure (2026.10.06-f) : **service worker** — réseau d'abord avec délai de 3 s puis copie locale (ouverture en 3 s au lieu de
    plus de 8 s mesurée avec un réseau à 8 s par fichier), mode « copie d'abord » d'une minute après un rabattement, toute l'application préchargée à
    l'installation (une page jamais visitée s'ouvre hors ligne), `version.json` jamais servi depuis le cache ; la liste de préchargement est régénérée par
    `node Tests/maj-version.js`. **Manifeste** — identité stable, raccourcis Android, catégories. **Mobile** — pas de délai tactile, défilement des
    fenêtres isolé, champ ramené au centre quand le clavier s'ouvre. **Accessibilité** — lien « Aller au contenu », messages annoncés aux lecteurs
    d'écran, erreurs de formulaire annoncées. **Auto-diagnostic** (« 🩺 Vérifier mon installation ») : 8 contrôles sur l'appareil. **Structure** —
    notifications séparées de la synchronisation (`Notifications.js` ; sens unique Notifications → Synchro). **Sécurité** — Permissions-Policy resserrée,
    COOP. Tests : `test42.js`, `test43.js` (frontières entre systèmes).
8p. ✅ Navigation étendue et interface homogène (2026.10.07-a) : **Serti et Documents quittent le menu du profil** et passent dans un tiroir « Plus d'outils »
    (mobile) : glisser la barre du bas vers le haut (le tiroir SUIT le doigt, finit selon la distance ou la vitesse), ou la languette ⌃ (64 × 44 px), Échap,
    glissement vers le bas, toucher à côté. `AppLayout.js` (construireTiroir). **Présentation de première connexion** (`Js/Presentation.js`) : 3 écrans animés
    (bienvenue, barre du bas, geste), une fois par appareil, nouvelles installations sur téléphone seulement, rejouable dans Réglages › Informations ; « Essayer
    le geste » ouvre le vrai tiroir. **Échelle typographique unique** : 26 tailles de texte → 9 jetons (`--texte-micro` … `--titre-xl`), 9 interlignes → 3, arrondis et
    espacements sur les jetons du thème. **Harmonisation mobile** : boutons d'en-tête en grille à 2 colonnes (Clients, Planning, Tournée), étiquette de type
    toujours sous le nom du client, onglets de largeur égale, en-têtes de section qui ne coupent plus leur bouton, libellés « (facultatif) » identiques.
    Tests : `test44.js` (menu étendu), `test45.js` (présentation), `test46.js` (homogénéité).
8q. ✅ Corrections terrain (2026.10.07-b) : **outillage** — le champ « Référence » était un champ texte avec suggestions natives (`<datalist>`) : le navigateur ne montrait
    que les entrées commençant par ce qui était déjà tapé (avec « P259 » dans le champ, jamais « P259M »). C'est maintenant une VRAIE liste déroulante : toutes les
    références connues, groupées par fournisseur (celui de l'outil en premier, remis en tête quand on change de fournisseur), « ➕ Autre… » pour une nouvelle ;
    simple champ texte tant qu'aucune référence n'est connue. **Contrôle de serti** — vocabulaire de la fiche papier : « Calage crochet de corps » (et non « de fond »),
    « Hauteur serti » (l'ancien « Flange » était une erreur de traduction du document ; identifiant `flange` conservé), ajout de la colonne « Croisure % » (saisie et conservée, jamais
    jugée : le document SQ/EMB/067 n'en donne aucune limite). Les identifiants des paramètres n'ont pas changé : les contrôles déjà enregistrés restent lisibles.
    Reste à ajouter selon la fiche : « Équilibre crochets » et la colonne « Sc. » (unité, tolérance, sens à confirmer). Tests : `test47.js`.
8r. ✅ Fichiers joints au contrôle client (2026.10.07-d) : dans l'onglet « Contrôle client (Seametal) » du formulaire de visite, « 📎 Ajouter un fichier » (PDF ou images,
    plusieurs à la fois) et « 📷 Photo » (appareil photo arrière) ; liste avec vignette, nom, type, taille, « Ouvrir », « ⬇ », « ✕ » (avec « Annuler »). Visible aussi dans le détail
    du contrôle sur la page Serti (lecture seule). **Où sont les fichiers** : dans IndexedDB (`Js/Pieces.js`), JAMAIS dans les données (localStorage ≈ 5 Mo pour tout) ; avec le
    contrôle on n'enregistre qu'une petite FICHE (`mesures.client.pieces` : id, nom, type, taille, date ; 10 au plus). Les photos sont réduites (1 800 px, JPEG) : 9 Mo → 0,7 Mo
    mesuré. Limites : 15 Mo par fichier, refus au-delà de 85 % de l'espace du navigateur, stockage durable demandé. **Les fichiers restent sur l'appareil où ils ont été ajoutés** :
    ni synchronisés, ni dans la sauvegarde JSON (la fiche s'affiche ailleurs avec « fichier absent de cet appareil »). Un fichier jamais rattaché à un contrôle est supprimé
    après 24 h. `SertiCalcul.nettoyer` (liste blanche) conserve maintenant les fiches. CSP : `object-src 'self' blob:` (lecteur de PDF). Tests : `test48.js`.
8s. ✅ Côté client (Seametal) = une feuille jointe, AUCUNE valeur à saisir (2026.10.07-e) : l'onglet « Contrôle client (Seametal) » du formulaire de visite ne propose plus que
    l'ajout de la feuille (fichiers) et un champ facultatif « Référence de la feuille » : plus de têtes, de cases de mesure, de verdict ni de validation de ce côté. Les
    contrôles où des valeurs client avaient DÉJÀ été saisies gardent l'ancien écran (rien n'est perdu ni masqué) et la comparaison reste disponible pour eux. Le résumé du bloc
    annonce « · 📎 N ». Page Serti : un contrôle client = ses valeurs OU sa feuille jointe (filtre « Avec contrôle client », étiquette « Seametal »). La colonne « Croisure % »
    (ajoutée en 2026.10.07-b) est RETIRÉE : « Sc. », « Croisure % » et « Équilibre crochets » sont des colonnes de la feuille Seametal, pas de la saisie manuelle. Tests : `test27.js`,
    `test47.js`, `test48.js` adaptés.
9. ✅ Notifications push : résumé du matin et rappel 1 h avant chaque rendez-vous confirmé
10. Documents joints aux visites
11. Règle du mode maintenance / hiver : bilan de fin de campagne livré (8a9) ; reste le suivi hors campagne par ligne (à décider)
