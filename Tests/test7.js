const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t }) {
  let session = "alex@test.fr", deco = 0;
  const transport = () => ({
    utilisateur: async () => { await sleep(30); return session; },
    connexion: async () => { session = "alex@test.fr"; },
    inscription: async () => ({ confirmationRequise: true }),
    deconnexion: async () => { deco++; session = null; },
    tirer: async () => [], pousser: async () => {}
  });
  // 1. état « vérification » avant la lecture de la session : pas de formulaire
  const w = page("Reglages.html", null, "", transport());
  t("ouverture : vérification, pas de formulaire", w.Synchro.etat().statut === "verification" && !w.document.getElementById("form-synchro") && w.document.getElementById("carte-synchro").textContent.includes("Vérification"));
  await sleep(80);
  t("session existante : synchronisé sans saisir de mot de passe", w.Synchro.etat().statut === "ok" && !w.document.getElementById("form-synchro"));
  const fin = w.Synchro.etat().valableJusquau;
  const jours = Math.round((Date.parse(fin) - Date.now()) / 86400000);
  t("connexion valable 30 jours", jours === 30);
  t("date de fin affichée", w.document.getElementById("carte-synchro").textContent.includes(new Date(fin).toLocaleDateString("fr-FR")));
  // 2. connexion de plus de 30 jours : déconnexion + message
  const w2 = page("Reglages.html", null, "", transport());
  w2.localStorage.setItem("acsc_connexion_le", new Date(Date.now() - 31 * 86400000).toISOString());
  await w2.Synchro.synchroniser(); await sleep(80);
  t("après 30 jours : déconnecté", w2.Synchro.etat().statut === "deconnecte" && deco === 1);
  t("après 30 jours : message clair", w2.document.getElementById("carte-synchro").textContent.includes("Connexion expirée après 30 jours"));
  t("après 30 jours : formulaire proposé", !!w2.document.getElementById("form-synchro"));
  // reconnexion : nouveau délai
  w2.document.getElementById("rs-email").value = "alex@test.fr"; w2.document.getElementById("rs-email").dispatchEvent(new w2.Event("input"));
  w2.document.getElementById("rs-mdp").value = "x"; w2.document.getElementById("rs-mdp").dispatchEvent(new w2.Event("input"));
  w2.document.getElementById("form-synchro").dispatchEvent(new w2.Event("submit", { cancelable: true }));
  await sleep(120);
  t("reconnexion : synchronisé, délai relancé", w2.Synchro.etat().statut === "ok" && Math.round((Date.parse(w2.Synchro.etat().valableJusquau) - Date.now()) / 86400000) === 30);
  // 3. hors ligne avec session : reste connecté (pas de formulaire)
  session = "alex@test.fr";
  const w3 = page("Reglages.html", null, "", transport());
  Object.defineProperty(w3.navigator, "onLine", { configurable: true, get: () => false });
  await sleep(80); await w3.Synchro.synchroniser(); await sleep(60);
  t("hors ligne : reste connecté", w3.Synchro.etat().statut === "hors-ligne" && w3.Synchro.etat().email === "alex@test.fr" && !w3.document.getElementById("form-synchro"));
  // 4. restauration : avertissement de propagation
  t("restauration : message de propagation", require("fs").readFileSync(require("path").join(__dirname, "..", "Js", "Reglages.js"), "utf8").includes("repris par tes autres appareils"));
};
