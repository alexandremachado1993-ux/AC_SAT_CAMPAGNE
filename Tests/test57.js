/* Design B (maquette) : socle. Le style est contrôlé sur le TEXTE des feuilles (le simulateur ne les charge pas) ; le rendu réel est vérifié par Tests/navigateur/.
   Et un piège supprimé : le générateur de compatibilité (Tests/navigateur/generer-compatibilite.py) COUPE tout ce qui suit son marqueur GENERE-DEBUT. */
const fs = require("fs");
const path = require("path");
module.exports = async function ({ t }) {
  const racine = path.join(__dirname, "..");
  const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8");
  const camp = lire("CSS/campagne.css"), base = lire("CSS/style.css");
  const jeton = (css, nom, scope) => { const i = css.indexOf(scope); const m = new RegExp("(^|[\\s;{])" + nom.replace(/[-]/g, "\\-") + ":\\s*([^;]+);").exec(css.slice(i)); return m ? m[2].trim() : null; };

  // ---------- Le piège du générateur
  t("campagne.css : le bloc généré (GENERE-DEBUT … GENERE-FIN) est la DERNIÈRE chose du fichier — le générateur coupe tout ce qui le suit (230 lignes de CSS avaient été ajoutées après lui, hors de portée des tests de style)", camp.trimEnd().endsWith("/* <<< GENERE-FIN */") && camp.split("GENERE-DEBUT").length === 2);
  t("campagne.css : les règles du tiroir, de la présentation, des pièces jointes et de la mise à jour sont bien présentes (rien n'a été tronqué)", ["touch-action: none", ".nav-tiroir", ".pres-barre", ".piece {", ".maj-scene"].every(x => camp.indexOf(x) !== -1));

  // ---------- Défaut corrigé : « Visites à clôturer » écrasée sur téléphone
  t("ligne à clôturer : sur téléphone les boutons prennent leur propre ligne sous le texte (le texte n'est plus écrasé à quelques mots), à partir de 640 px ils restent à côté", /\.ligne-cloture \.apercu-actions \{ justify-content: flex-start; flex: 1 1 100%; \}/.test(camp) && /@media \(min-width: 640px\) \{ \.ligne-cloture \.apercu-actions \{ flex: 0 0 auto; \} \}/.test(camp));

  // ---------- Polices locales
  const faces = (base.match(/@font-face/g) || []).length;
  const fichiers = Array.from(base.matchAll(/url\("\.\.\/Polices\/([^"]+)"\)/g)).map(m => m[1]);
  t("polices : six @font-face (Barlow 400/500/600/700, Barlow Semi Condensed 600/700), chacune pointe vers un fichier du dossier Polices", faces === 6 && fichiers.length === 6 && fichiers.every(f => fs.existsSync(path.join(racine, "Polices", f))));
  t("polices : aucun Google Fonts ni adresse externe (la CSP n'autorise que font-src 'self') ; la licence OFL est livrée avec les fichiers", !/fonts\.(googleapis|gstatic)|@import\s+url\(http/.test(base + camp) && fs.existsSync(path.join(racine, "Polices/LICENCE-Barlow-OFL.txt")) && fs.existsSync(path.join(racine, "Polices/LICENCE-Barlow-Semi-Condensed-OFL.txt")) && /font-src 'self'/.test(lire("netlify.toml")));
  t("polices : le texte utilise Barlow, les titres et grands chiffres Barlow Semi Condensed, avec des polices de secours (jamais une police inconnue seule)", /--police-texte: "Barlow",[^;]*sans-serif;/.test(base) && /--police-titre: "Barlow Semi Condensed",[^;]*sans-serif;/.test(base) && /body \{[^}]*font-family: var\(--police-texte\)/.test(base) && /\.titre-page \{[^}]*font-family: var\(--police-titre\)/.test(camp));
  t("polices : les six fichiers sont dans la version hors ligne (version.json) et le dossier est déclaré publié (test25)", (() => { const v = JSON.parse(lire("version.json")).fichiers.map(f => f.u); return fs.readdirSync(path.join(racine, "Polices")).filter(f => /\.woff2$/.test(f)).every(f => v.indexOf("Polices/" + f) !== -1); })());

  // ---------- Couleurs du design : valeurs exactes et contrastes
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const oklchVersRvb = (s) => { const m = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(s); const L = +m[1], C = +m[2], h = +m[3] * Math.PI / 180, a = C * Math.cos(h), b = C * Math.sin(h);
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), mm = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), ss = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * ss, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * ss, -0.0041960863 * l - 0.7034186147 * mm + 1.7076147010 * ss].map(v => Math.min(1, Math.max(0, v))); };
  const hexVersRvb = (s) => [1, 3, 5].map(i => lin(parseInt(s.slice(i, i + 2), 16) / 255));
  const lumOk = (s) => { const [r, g, b] = oklchVersRvb(s); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const lumHex = (s) => { const [r, g, b] = hexVersRvb(s); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const rapport = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  const clair = (n) => jeton(base, n, ":root {");
  const blanc = lumOk("oklch(1 0 0)");
  t("couleurs : le rouge de marque est #DD090E (blanc dessus : au moins 5:1), le rouge foncé #B5070B (sur blanc : au moins 6,5:1), le texte secondaire #5C5C5C (sur blanc : au moins 6,5:1)", rapport(blanc, lumOk(clair("--primaire"))) >= 5 && rapport(lumOk(clair("--primaire-fonce")), blanc) >= 6.5 && rapport(lumOk(clair("--attenue-texte")), blanc) >= 6.5);
  t("couleurs : fond de page #F2F2F2, cartes blanches, texte #1A1A1A (au moins 14:1 sur les cartes)", /oklch\(0\.961 0 0\)/.test(clair("--fond")) && /oklch\(1 0 0\)/.test(clair("--carte")) && rapport(lumOk(clair("--texte")), blanc) >= 14);
  const sombre = (n) => jeton(camp, n, "html.dark {");
  t("thème sombre : le bandeau est un rouge assombri avec du blanc dessus (au moins 7:1), le rouge de texte reste lisible sur les cartes sombres (au moins 6:1), la barre est distincte du fond noir", rapport(lumHex("#ffffff"), lumHex(sombre("--bandeau"))) >= 7 && rapport(lumHex(sombre("--primaire-fonce")), lumHex(sombre("--carte"))) >= 6 && sombre("--barre") !== sombre("--fond"));
  t("statuts INCHANGÉS et distincts du rouge de marque : à jour #16a34a, à prévoir #f97316, en retard #dc2626 (jamais remplacés par #DD090E)", jeton(base, "--statut-ok", ":root {") === "#16a34a" && jeton(base, "--statut-warn", ":root {") === "#f97316" && jeton(base, "--statut-alert", ":root {") === "#dc2626" && !/#dd090e/i.test(base.slice(base.indexOf("--statut-ok") - 40, base.indexOf("--statut-alert") + 40)));
  t("arrondis du design : cartes 18 px (--rayon-carte), coins inférieurs du bandeau 28 px (--rayon-bandeau), polices et couleurs passent par des jetons", clair("--rayon-carte") === "1.125rem" && clair("--rayon-bandeau") === "1.75rem" && ["--bandeau", "--bandeau-texte", "--barre", "--barre-texte", "--primaire-fonce"].every(n => clair(n) !== null));
  // ---------- Bandeau rouge : seulement de l'apparence, marges annulées EXACTEMENT, jetons inversés
  const regleCss = (css, sel) => { const m = new RegExp("(?:^|\\n)" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\{([^{}]*)\\}").exec(css); return m ? m[1] : null; };
  const bandeau = regleCss(camp, ".entete-page") || "";
  t("bandeau de page : rouge (--bandeau), coins inférieurs de 28 px (--rayon-bandeau), plein écran en annulant les marges de la page par des VARIABLES (jamais « -24px » : 16 px sous 380 px, zone sûre en paysage)", /background: var\(--bandeau\)/.test(bandeau) && /border-radius: 0 0 var\(--rayon-bandeau\) var\(--rayon-bandeau\)/.test(bandeau) && /margin: calc\(-1 \* var\(--marge-h\)\) calc\(-1 \* var\(--marge-d\)\) 0 calc\(-1 \* var\(--marge-g\)\)/.test(bandeau) && !/-24px/.test(camp.slice(camp.indexOf("Design B — habillage"), camp.indexOf("/* ---------- Mouvement réduit"))));
  t("marges de la page : variables (--marge-h/g/d) sur .app-contenu ; les règles d'écran (zone sûre, ordinateur, paysage, petits écrans) changent la variable, plus jamais « padding-left » (sinon le bandeau déborde et la page défile horizontalement)", /--marge-g: 24px;/.test(base) && /padding: var\(--marge-h\) var\(--marge-d\) 0 var\(--marge-g\)/.test(base) && !/\.app-contenu \{[^}]*padding-(left|right|top):/.test(camp));
  t("tout ce qui est SUR le rouge reçoit des jetons inversés (texte blanc, bouton principal blanc à texte rouge, contours blancs) : les boutons, textes atténués et icônes existants suivent sans être réécrits", /\.entete, \.entete-page, \.fiche-retour, \.fiche-entete \{[^}]*--texte: var\(--bandeau-texte\);[^}]*--primaire: var\(--bandeau-texte\);[^}]*--primaire-texte: var\(--bandeau\);/.test(camp));
  t("le bloc blanc qui chevauche le bandeau (compteurs, onglets, recherche, cartes) n'existe que si « :has() » est connu ; sans lui, le bandeau garde sa hauteur courte et aucun texte n'est recouvert", /@supports selector\(:has\(a\)\) \{[^}]*\.entete-page:has\(\+ :is\([^)]*\)\) \{ padding-bottom: 56px; \}[^}]*margin-top: -40px/.test(camp) && /\.entete-page \{[^}]*padding: 8px var\(--marge-d\) 24px var\(--marge-g\)/.test(camp));
  t("fiche client : « ← Clients » et l'en-tête ne forment qu'UN bandeau rouge (rangée pleine largeur, y compris sur ordinateur où deux règles la remettaient en « inline-flex »)", /\.fiche-retour \{ display: flex; margin: calc\(-1 \* var\(--marge-h\)\)/.test(camp) && !/\.fiche-retour \{ display: inline-flex/.test(camp));
  t("thème sombre : « Supprimer » reste lisible sur le bandeau (la règle du thème sombre est plus spécifique, la mienne l'est autant)", /html\.dark \.fiche-entete \.bouton--danger \{ color: var\(--bandeau-texte\); \}/.test(camp));

  // ---------- Barre du bas : pilule noire flottante, boutons ronds de 52 px, zone sûre
  const nav = regleCss(base, ".nav-basse") || "", grille = regleCss(base, ".nav-basse-grille") || "", lien = regleCss(base, ".nav-basse-lien") || "", fab = regleCss(base, ".fab-bouton") || "";
  t("barre du bas : conteneur transparent à 16 px des bords et du bas + zone sûre (env(safe-area-inset-bottom)), seule la pilule reçoit les touchers (le tiroir lit la hauteur du conteneur : --nav-h)", /padding: 0 16px calc\(16px \+ env\(safe-area-inset-bottom\)\)/.test(nav) && /pointer-events: none/.test(nav) && /pointer-events: auto/.test(grille));
  t("barre du bas : pilule noire (--barre) arrondie à 999 px, boutons ronds de 52 px (cible tactile ≥ 44 px), onglet actif = rond rouge, « + » = rond blanc de 52 px", /background: var\(--barre\)/.test(grille) && /border-radius: 999px/.test(grille) && /width: 52px;\s*height: 52px;/.test(lien) && /\.nav-basse-lien\.actif \{\s*background: var\(--primaire\)/.test(base) && /width: 52px;\s*height: 52px;[^}]*background: var\(--barre-texte\)/.test(fab));
  const masques = ["Index.html", "Planning.html", "Tournee.html", "Clients.html"].filter(h => camp.indexOf('.nav-basse-lien[href="' + h + '"] { --icone-nav: url("data:image/svg+xml,') !== -1);
  t("barre du bas : une icône au trait par page (masque SVG « data: », autorisé par la CSP img-src), dessinée en CSS : aucun HTML modifié ; les libellés restent pour les lecteurs d'écran seulement", masques.length === 4 && /img-src 'self' data:/.test(lire("netlify.toml")) && /\.nav-basse-lien > span:not\(\[class\]\) \{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect\(0 0 0 0\)/.test(camp));
  t("languette du tiroir : ancienne règle corrigée à sa place (fond --barre) et aucun doublon (deux règles se disputaient : la plus tardive gagnait, languette blanche)", (camp.slice(0, camp.indexOf("/* >>> GENERE-DEBUT")).match(/(^|\n)\.nav-poignee-corps \{/g) || []).length === 1 && /\.nav-poignee-corps \{[^}]*background: var\(--barre\)/.test(camp));

  // ---------- Cartes, boutons, onglets
  t("cartes : blanches, arrondi 18 px (--rayon-carte), SANS bordure ; boutons en pilule ; onglets blancs en pilule avec l'actif noir ; les statuts gardent leurs couleurs", /border-radius: var\(--rayon-carte\)/.test(regleCss(base, ".carte") || "") && !/border:/.test((regleCss(base, ".carte") || "").replace("border: 0;", "")) && /\.bouton \{[^}]*border-radius: 999px/.test(base) && /\.onglet-fiche\.actif \{\s*background: var\(--barre\)/.test(base) && /\.onglets-fiche \{[^}]*background: var\(--carte\)[^}]*border-radius: 999px/.test(base));

  // ---------- Discipline : la section du design n'écrit ni couleur ni arrondi en dur
  const sectionB = camp.slice(camp.indexOf("Design B — habillage"), camp.indexOf("/* ---------- Mouvement réduit"));
  t("la section « Design B » n'écrit AUCUNE couleur en dur (ni #hex ni rgb()) : tout passe par les jetons (rule n° 2)", !/#[0-9a-fA-F]{3,8}\b/.test(sectionB.replace(/%23/g, "")) && !/rgba?\(/.test(sectionB));
  t("la section « Design B » n'écrit aucun arrondi en pixels : jetons, 999px (pilule) ou 50 %", !/border-radius:\s*(?!999px)\d+px/.test(sectionB));
};
