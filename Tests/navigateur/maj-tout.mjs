/* Lance les quatre scénarios des mises à jour l'un après l'autre (environ 6 minutes). Code de sortie 1 s'il reste un écart.
   Prérequis : npm install, puis  node maj-preparer.mjs [--ancien <clone GitHub avant livraison>]. */
import { spawnSync } from "node:child_process"; import { fileURLToPath } from "node:url"; import path from "node:path";
const ici = path.dirname(fileURLToPath(import.meta.url)); let ecarts = 0;
for (const f of ["maj-1-installation.mjs", "maj-2-echecs-et-blocage.mjs", "maj-3-passage-et-reparation.mjs", "maj-4-theme-sombre.mjs"]) {
  console.log("\n=== " + f + " ==="); const r = spawnSync("node", [path.join(ici, f)], { stdio: "inherit", timeout: 600000 }); if (r.status !== 0) ecarts++;
}
console.log(ecarts === 0 ? "\nMISES À JOUR : tous les scénarios sont conformes" : "\nMISES À JOUR : " + ecarts + " scénario(s) avec écart"); process.exit(ecarts === 0 ? 0 : 1);
