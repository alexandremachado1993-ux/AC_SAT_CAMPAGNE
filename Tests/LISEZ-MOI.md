# Tests automatiques

Environ 400 vérifications de la logique et des pages (jsdom : sans navigateur,
donc sans contrôle du rendu visuel).

Lancer en local (Node.js 20 ou plus) :

    cd Tests
    npm install
    npm test

Sur GitHub, le fichier `.github/workflows/tests.yml` les lance à chaque envoi
(onglet « Actions » du dépôt : coche verte = tout passe).

Les tests utilisent de faux serveurs : ils n'écrivent jamais dans Supabase.

## Contrôleurs automatiques (`Tests/agents/`)
Ils tournent à chaque `npm test` (donc à chaque envoi sur GitHub) et à la demande avec `npm run audit` (code de sortie 1 s'il reste un défaut).

| Contrôleur | Ce qu'il contrôle |
|---|---|
| `doublons.js` | Aucun bloc de 6 lignes significatives ou plus recopié dans le JavaScript de l'application |
| `css.js` | Aucune règle identique répétée dans une feuille ; aucune classe définie mais jamais utilisée (les classes construites par le code, comme `serti-v--ok`, comptent comme utilisées) |
| `references.js` | Tout fichier cité par une page, une feuille de style, un script ou le manifeste existe |
| `comparer-depots.js` | Livraison : `node Tests/agents/comparer-depots.js <clone GitHub> <projet>` liste à envoyer / à supprimer / à renommer / fichiers « à point » à créer à la main |

`test53.js` vérifie le projet ET que chaque contrôleur détecte bien un défaut volontairement planté ; `test52.js` fige le résultat des fonctions de couleur.

## Protocole de validation des mises à jour sur téléphone (à faire une fois)
Le parcours complet est déjà rejoué dans un vrai Chromium (`Tests/navigateur/maj-tout.mjs`, 48 vérifications : installation, hors ligne, version figée, rappels, scène, échec, blocage, passage depuis l'ancien service worker, réparation, thème sombre). Ce qu'aucun test automatique ne prouve : **un téléphone réel** (Android : Chrome, Samsung Internet ; iPhone : Safari, jamais testé) et le comportement du système (notification, application installée, fermeture par le système). À vérifier sur le téléphone :
1. Version `2026.10.12-b` installée (dernier passage sans validation). « Réglages › Informations › Vérifier mon installation » : la ligne « Hors ligne » est verte (quarantaine de fichiers).
2. Mode avion, fermer complètement l'application, la rouvrir : toutes les pages s'ouvrent.
3. Publier une version suivante, attendre la notification, ouvrir l'application : « Réglages › Informations » affiche **encore l'ancienne version** (version figée). Changer de page, fermer et rouvrir : toujours l'ancienne.
4. Une fenêtre « Mise à jour disponible — Rappel 1 sur 3 » apparaît ; « Plus tard » la ferme sans rien changer.
5. « Mettre à jour maintenant » : la mise en scène s'affiche (logo, pourcentage qui monte de 0 à 100, 4 étapes cochées, « Version … installée »), puis l'application redémarre sur la nouvelle version.
6. Ordinateur et téléphone sont indépendants : mettre à jour l'ordinateur ne change pas le téléphone.
7. Écran obligatoire (à voir sur ordinateur, outils du navigateur, console) : `localStorage.setItem("acsc_maj_rappels", JSON.stringify({ base: "<version installée>", n: 3, t: 0 }))` puis recharger quand une version plus récente est publiée.
8. « 🧹 Réparer l'installation » : la page se recharge et se réinstalle ; les clients et visites sont toujours là.
