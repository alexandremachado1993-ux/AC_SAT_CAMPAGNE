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
    "no-unused-vars": ["warn", { vars: "local", args: "none", caughtErrors: "none" }],   // « local » : un module global est utilisé par les autres fichiers
    "no-empty": ["error", { allowEmptyCatch: false }],
    "eqeqeq": ["warn", "always", { null: "ignore" }],
    "no-var": "warn",
    "prefer-const": "warn",
    "no-useless-catch": "error",
    "no-shadow-restricted-names": "error"
};

module.exports = [
    js.configs.recommended,
    { files: ["Js/**/*.js"], languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.browser, ...modulesApplication } }, rules: regles },
    { files: ["sw.js"], languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.serviceworker } }, rules: regles },
    { files: ["supabase/functions/rappels/logique.js"], languageOptions: { ecmaVersion: 2022, sourceType: "module" }, rules: regles },
    { files: ["Tests/maj-version.js"], languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: { ...globals.node } }, rules: regles }
];
