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
