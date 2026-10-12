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
