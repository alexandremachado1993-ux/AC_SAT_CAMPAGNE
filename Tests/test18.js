/* Compatibilité tous téléphones : garanties vérifiables sans navigateur. */
module.exports = async function ({ t, P, fs }) {
  const path = require("path");
  const lire = (f) => fs.readFileSync(path.join(P, f), "utf8");
  const style = lire("CSS/style.css"), campagne = lire("CSS/campagne.css");
  const DEBUT = "/* >>> GENERE-DEBUT", FIN = "/* <<< GENERE-FIN */";
  const iBloc = campagne.indexOf(DEBUT);
  t("couleurs de secours : bloc généré présent et fermé", iBloc > 0 && campagne.indexOf(FIN) > iBloc);
  const bloc = campagne.slice(iBloc, campagne.indexOf(FIN));
  const source = (style + "\n" + campagne.slice(0, iBloc)).replace(/\/\*[\s\S]*?\*\//g, "");   // sans commentaires
  t("secours oklch() : bloc @supports", /@supports not \(color: oklch\(0\.5 0\.1 27\)\)/.test(bloc));
  t("secours color-mix() : bloc @supports", /@supports not \(color: color-mix\(in srgb, red 50%, blue\)\)/.test(bloc));
  t("secours : variables du thème clair et sombre en rgb", /:root \{[^}]*--primaire: rgb\(/.test(bloc) && /html\.dark \{[^}]*--[a-z-]+: rgba?\(/.test(bloc));
  t("secours : aucune fonction récente à l'intérieur du bloc", !/(oklch|color-mix)\([^)]*\)[^{]*;/.test(bloc.replace(/@supports not \([^)]*\([^)]*\)[^)]*\)/g, "")));

  // Chaque règle qui utilise oklch() / color-mix() dans une propriété (pas une variable) est recopiée dans le bloc.
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const blocN = norm(bloc);
  const manquantes = [];
  const re = /([^{}@][^{}]*)\{([^{}]*)\}/g; let m; let nb = 0;
  while ((m = re.exec(source))) {
    const decls = m[2].split(";").map(d => d.trim()).filter(Boolean);
    if (!decls.some(d => !d.startsWith("--") && /oklch\(|color-mix\(/.test(d))) continue;
    nb++;
    const sels = m[1].split(",").map(norm).filter(Boolean);
    if (!sels.every(sel => blocN.includes(sel))) manquantes.push(norm(m[1]).slice(0, 60));
  }
  t("règles à couleurs modernes recopiées en secours (" + nb + " règles)", nb > 10 && manquantes.length === 0);
  if (manquantes.length) console.log("   règles sans secours :", manquantes.slice(0, 5).join(" | "), "→ relancer Tests/navigateur/generer-compatibilite.py");

  // Grilles : une colonne « 1fr » seule ne rétrécit pas sous son contenu (débordement sur petit écran).
  const fautives = [];
  (source + bloc).replace(/grid-template-(?:columns|rows):\s*([^;}]*)/g, (_, v) => { const sans = v.replace(/minmax\([^)]*\)/g, ""); if (/\d\s*fr\b/.test(sans)) fautives.push(norm(v)); return ""; });
  t("grilles : chaque colonne « fr » est dans un minmax(0, …)", fautives.length === 0);
  if (fautives.length) console.log("   grilles fautives :", fautives.slice(0, 4));
  const enLigne = fs.readdirSync(path.join(P, "Js")).filter(f => f.endsWith(".js")).filter(f => /grid-template-columns:\s*\d*fr/.test(lire("Js/" + f)));
  t("grilles en ligne dans le JavaScript : idem", enLigne.length === 0);

  // Balises de chaque page pour les téléphones.
  const pages = fs.readdirSync(P).filter(f => f.endsWith(".html"));
  const ok = (re) => pages.every(f => re.test(lire(f)));
  t("pages : viewport-fit=cover (encoche) et largeur d'appareil", ok(/viewport-fit=cover/) && ok(/width=device-width/));
  t("pages : application installable (Android et iPhone) et numéros non soulignés", ok(/mobile-web-app-capable/) && ok(/apple-mobile-web-app-capable/) && ok(/format-detection/));
  t("pages : icône iPhone dédiée", ok(/apple-touch-icon\.png/));
  t("pages : barre d'état colorée", ok(/theme-color/));

  // Champs à 16 px minimum sur écran tactile (sinon Safari zoome la page).
  t("iPhone : champs à 16 px sur écran tactile", /@media \(pointer: coarse\), \(max-width: 767px\) \{\s*input, select, textarea \{ font-size: 16px; \}/.test(campagne));
  t("iPhone : texte non gonflé en paysage", /-webkit-text-size-adjust: 100%/.test(campagne));
  t("encoche : marges de zone sûre à gauche et à droite", /safe-area-inset-left/.test(campagne) && /safe-area-inset-right/.test(campagne));
  t("écran haut de gamme : hauteur dynamique (barre d'adresse mobile) avec repli", /100dvh|dvh/.test(style + campagne) && /100vh|vh;/.test(style + campagne));

  // Pas de fonction JavaScript trop récente pour un iPhone 6s / un Android 8.
  const recents = [];
  fs.readdirSync(path.join(P, "Js")).filter(f => f.endsWith(".js")).forEach(f => { const s = lire("Js/" + f); [/\.at\(/, /structuredClone\(/, /Object\.hasOwn\(/, /\.findLast\(/, /\.toSorted\(/, /Array\.fromAsync/].forEach(r => { if (r.test(s)) recents.push(f + " " + r); }); });
  t("JavaScript : aucune fonction postérieure à 2021 (iOS 15, Chrome 90)", recents.length === 0);
  if (recents.length) console.log("   fonctions récentes :", recents);

  // Petit écran : jours de la Tournée sur deux rangées, bandeau du haut qui peut passer à la ligne.
  t("petit écran : jours de la tournée sur 4 colonnes", /max-width: 380px\) \{[^}]*\.choix-jours \{ grid-template-columns: repeat\(4/.test(campagne));
  t("texte agrandi : bandeau du haut sur deux lignes si besoin", /\.entete-barre \{ height: auto; min-height: 56px; flex-wrap: wrap/.test(campagne));
};
