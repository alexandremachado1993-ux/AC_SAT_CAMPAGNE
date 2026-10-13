/* Prépare les versions simulées du site dans le dossier de travail :
     V1 = le projet tel quel (version installée), V2 = la version suivante (lettre suivante), V3 = V2 marquée « obligatoire »,
     V0 = l'ANCIENNE version (avec l'ancien service worker), si on la fournit :  node maj-preparer.mjs --ancien <dossier>   (un clone de GitHub avant la livraison). */
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
import { PROJET, TRAVAIL, VERS } from "./maj-lib.mjs";
const copier = (src, dst) => { fs.rmSync(dst, { recursive: true, force: true }); fs.cpSync(src, dst, { recursive: true, filter: (f) => !/[\\/](node_modules|sortie|\.git)([\\/]|$)/.test(f) }); };
fs.mkdirSync(TRAVAIL, { recursive: true });
copier(PROJET, VERS(1)); copier(PROJET, VERS(2));
const v1 = fs.readFileSync(path.join(VERS(1), "version.txt"), "utf8").trim(); const m = /^(\d{4}\.\d{2}\.\d{2}-)([a-z])$/.exec(v1); if (!m) throw new Error("version illisible : " + v1);
const suivante = m[1] + String.fromCharCode(m[2].charCodeAt(0) + 1);
const appli = path.join(VERS(2), "Js", "AppLayout.js"); const src = fs.readFileSync(appli, "utf8");
if (src.split('const VERSION = "' + v1 + '";').length !== 2) throw new Error("AppLayout.js : constante VERSION introuvable");
fs.writeFileSync(appli, src.replace('const VERSION = "' + v1 + '";', 'const VERSION = "' + suivante + '";'));
execFileSync("node", [path.join("Tests", "maj-version.js")], { cwd: VERS(2), stdio: "pipe" });
copier(VERS(2), VERS(3)); const j = JSON.parse(fs.readFileSync(path.join(VERS(3), "version.json"), "utf8")); j.obligatoire = true; fs.writeFileSync(path.join(VERS(3), "version.json"), JSON.stringify(j, null, 2));
const c = process.argv.indexOf("--casse"); if (c > 0) copier(path.resolve(process.argv[c + 1]), VERS("C"));      // VC = la version PUBLIÉE qui cassait les appareils (service worker sans l'assainissement des redirections)
const i = process.argv.indexOf("--ancien"); if (i > 0) copier(path.resolve(process.argv[i + 1]), VERS(0));
console.log("versions préparées dans " + TRAVAIL + " : V1 " + v1 + " | V2/V3 " + suivante + (i > 0 ? " | V0 " + fs.readFileSync(path.join(VERS(0), "version.txt"), "utf8").trim() + (/const PRECACHE/.test(fs.readFileSync(path.join(VERS(0), "sw.js"), "utf8")) ? " (ancien service worker : OK pour les scénarios de passage)" : " (service worker À COPIE FIGÉE : les scénarios de passage seront ignorés, il faut un clone d'AVANT 2026.10.12-b)") : " | V0 non fournie (le passage depuis l'ancien service worker ne sera pas testé)"));
