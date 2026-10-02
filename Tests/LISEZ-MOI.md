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
