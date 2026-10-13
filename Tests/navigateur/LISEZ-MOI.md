# Audit des écrans (navigateur réel)

Ouvre chaque page et chaque fenêtre dans Chromium, sur 5 tailles d'écran
(360, 390, 768, 1280, 1920 px) et mesure : débordements, texte coupé,
contrastes (WCAG 4,5:1), texte < 11 px, cibles tactiles < 32 px.

    cd Tests/navigateur
    npm install
    node seed.mjs                      # données de démonstration
    node audit-run.mjs                 # pages (PASSE=sombre ou PASSE=paysage pour les autres passes)
    VP=tel-360 node audit-modales.mjs  # fenêtres, une taille d'écran à la fois

Résultats et captures dans `sortie/`. Outil de contrôle manuel : il n'est pas
lancé par GitHub. Les « texte minuscule » sur les initiales des mois du
Planning et les « contraste » sur des emojis sont des faux positifs connus.


## nouveautes-captures.mjs

Génère les photos de présentation de la fenêtre « Nouveautés » (`Media/nouveautes/`, données fictives, repères numérotés).
`node nouveautes-captures.mjs` — voir le README du projet, lot 8g, pour la marche à suivre complète.


## Mises à jour (`maj-*.mjs`) : le parcours complet, dans un vrai Chromium
Un faux « Netlify » local sert trois versions du site (installée, suivante, suivante marquée obligatoire) et, si on la fournit, l'ancienne version avec l'ancien service worker. Il rejoue les en-têtes de sécurité de `netlify.toml` (CSP comprise). Les scénarios pilotent un vrai Chromium :

    cd Tests/navigateur
    npm install
    node maj-preparer.mjs --ancien <clone GitHub AVANT la livraison>   # sans --ancien : le passage depuis l'ancien service worker n'est pas testé
    node maj-tout.mjs                                                  # ≈ 6 minutes, code de sortie 1 s'il reste un écart

| Scénario | Ce qu'il prouve |
|---|---|
| `maj-1-installation.mjs` | installation, ouverture hors ligne, version figée quand le serveur publie la suivante, rappel 1 sur 3, validation avec barre de pourcentage réelle |
| `maj-2-echecs-et-blocage.mjs` | échec en cours de route (rien ne change), « Continuer », dernier rappel, blocage à l'ouverture suivante, jamais hors connexion, version obligatoire |
| `maj-3-passage-et-reparation.mjs` | passage depuis l'ancien service worker, réparation (données conservées), grand et petit écran |
| `maj-4-theme-sombre.mjs` | écran obligatoire, progression et fin en thème sombre, contrastes ≥ 4,5:1 |

Captures dans `sortie/`. Outil de contrôle manuel : GitHub ne le lance pas (il télécharge un Chromium de 70 Mo). **Ne jamais conclure « pas de navigateur disponible » sans avoir lancé `npm install` ici** : le paquet `@sparticuz/chromium` embarque son propre Chromium (sans lui, `--single-process` empêche les contextes isolés : `audit-lib.mjs` et `maj-lib.mjs` le retirent).
