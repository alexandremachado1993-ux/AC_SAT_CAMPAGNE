/* ESLint (analyse statique) — « npm run lint » dans le dossier Tests (il se lance depuis la racine du projet : ESLint ignore les fichiers hors de son dossier).
   Les modules de l'application (Js/*.js) sont des scripts classiques qui partagent des variables globales
   (Donnees, AppLayout…) : leurs noms sont déduits automatiquement de chaque fichier. */
const fs = require("fs");
const path = require("path");
const js = require("@eslint/js");
const globals = require("globals");

const racine = path.join(__dirname, "..");
const modulesApplication = {};
fs.readdirSync(path.join(racine, "Js")).filter(f => f.endsWith(".js")).forEach(f => {
    const source = fs.readFileSync(path.join(racine, "Js", f), "utf8");
    for (const m of source.matchAll(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)) modulesApplication[m[1]] = "readonly";
});

modulesApplication.fflate = "readonly";      // bibliothèque de Vendor/fflate
modulesApplication.Splash = "readonly";      // Splash.js l'expose sur window

const regles = {
    "no-undef": "error",
    "no-redeclare": ["error", { builtinGlobals: false }],      // les noms de modules sont déclarés dans leur fichier ET connus comme globaux ici
    "no-unused-vars": ["error", { vars: "local", args: "none", caughtErrors: "none" }],   // « local » : un module global est utilisé par les autres fichiers
    "no-empty": ["error", { allowEmptyCatch: false }],
    "eqeqeq": ["error", "always", { null: "ignore" }],         // « x == null » (null OU indéfini) reste permis ; partout ailleurs : ===
    "no-var": "error",
    "prefer-const": "error",
    "no-useless-catch": "error",
    "no-shadow-restricted-names": "error",
    "no-useless-concat": "error",
    "no-useless-return": "error",
    "no-unused-expressions": "error",
    "no-lonely-if": "error",
    "no-self-compare": "error",
    "no-extra-bind": "error",
    "no-throw-literal": "error",
    "default-case-last": "error",
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "no-console": "error"                                        // pas de trace de débogage dans l'application (le journal d'erreurs passe par Erreurs.js)
    /* Volontairement NON activés : « no-alert » (les confirm() protègent des actions destructrices) et « no-shadow » (variables locales
       qui en masquent une plus haute : inoffensif ici, 19 cas, les renommer toucherait 4 gros fichiers sans bénéfice de comportement). */
};
const reglesNode = Object.assign({}, regles, { "no-console": "off" });      // outils en ligne de commande : ils écrivent dans la console

module.exports = [
    js.configs.recommended,
    { files: ["Js/**/*.js"], languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.browser, ...modulesApplication } }, rules: regles },
    { files: ["sw.js"], languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.serviceworker } }, rules: regles },
    { files: ["supabase/functions/rappels/logique.js"], languageOptions: { ecmaVersion: 2022, sourceType: "module" }, rules: regles },
    { files: ["Tests/maj-version.js", "Tests/agents/**/*.js"], languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: { ...globals.node } }, rules: reglesNode }
];
