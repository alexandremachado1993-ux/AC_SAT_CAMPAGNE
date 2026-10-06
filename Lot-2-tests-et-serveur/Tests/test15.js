const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t }) {
  const equipe = { id: "eq1", nom: "AC SAT Sud", code: "K7PM2XQA", role: "proprietaire",
    membres: [{ id: "u1", nom: "Alexandre", role: "proprietaire", moi: true }, { id: "u2", nom: "Damien", role: "membre", moi: false }] };
  const transport = () => ({
    utilisateur: async () => "alex@test.fr", connexion: async () => {}, deconnexion: async () => {},
    tirer: async () => [], pousser: async () => {}, monEquipe: async () => equipe
  });
  // Préparation : clients attribués
  const w0 = page("Index.html");
  const D0 = w0.Donnees;
  const mk = (nom, technicien) => { const c = D0.ajouterClient({ nom, ville: "X", debutCampagne: 1, finCampagne: 12, technicien }); D0.enregistrerLigne(c.id, { nom: "L" }); return c; };
  const a = mk("A Alexandre", "u1"), d = mk("D Damien", "u2"), n = mk("N Personne", "");
  const stock = w0.localStorage.getItem("acsc_donnees_v1");

  // Accueil : seulement mes clients et les non attribués
  const wi = page("Index.html", stock, "", transport());
  await sleep(80);
  t("technicien courant = moi (équipe)", wi.Donnees.getTechnicienCourant() === "u1");
  const noms = [...wi.document.querySelectorAll(".carte-a-visiter-nom")].map(e => e.textContent);
  t("À visiter : mes clients + non attribués, pas ceux de Damien", noms.includes("A Alexandre") && noms.includes("N Personne") && !noms.includes("D Damien"));
  t("tournée : pas de proposition pour les clients de Damien", !wi.Donnees.proposerTournee("2026-09-28").creees.some(r => r.clientId === d.id));

  // Clients : filtre et attribution
  const wc = page("Clients.html", stock, "", transport());
  await sleep(80);
  const ft = wc.document.getElementById("filtre-technicien");
  t("Clients : filtre technicien", !!ft && [...ft.options].map(o => o.textContent).join("|") === "Tous les techniciens|Mes clients|Non attribués|Damien");
  t("Clients : technicien sur la carte", wc.document.body.textContent.includes("👷 Damien") && wc.document.body.textContent.includes("👷 Non attribué"));
  ft.value = "u2"; ft.dispatchEvent(new wc.Event("change"));
  t("filtre Damien", wc.document.querySelectorAll(".carte-client-campagne").length === 1);
  wc.document.getElementById("filtre-technicien").value = "moi"; wc.document.getElementById("filtre-technicien").dispatchEvent(new wc.Event("change"));
  t("filtre Mes clients (avec non attribués)", wc.document.querySelectorAll(".carte-client-campagne").length === 2);
  wc.document.querySelector("[data-nouveau-client]").click();
  const sel = wc.document.getElementById("fc-technicien");
  t("nouveau client : technicien proposé, moi par défaut", !!sel && sel.value === "u1" && sel.options.length === 3);
  wc.document.getElementById("fc-nom").value = "Nouveau Damien"; wc.document.getElementById("fc-ville").value = "Lille";
  sel.value = "u2";
  wc.document.getElementById("form-client").dispatchEvent(new wc.Event("submit", { cancelable: true }));
  t("client créé et attribué à Damien", wc.Donnees.trouverClientParNom("Nouveau Damien").technicien === "u2");

  // Fiche client : technicien affiché
  const wf = page("Client.html", stock, "?id=" + d.id, transport());
  await sleep(80);
  t("fiche : technicien affiché", wf.document.querySelector(".fiche-badges").textContent.includes("👷 Damien"));

  // Planning : mes clients par défaut
  const wp = page("Planning.html", stock, "", transport());
  await sleep(80);
  t("Planning : filtre technicien « Mes clients » par défaut", wp.document.getElementById("pf-technicien").value === "moi" && wp.document.querySelectorAll(".tl-rangee--client").length === 2);
  wp.document.getElementById("pf-technicien").value = ""; wp.document.getElementById("pf-technicien").dispatchEvent(new wp.Event("change"));
  t("Planning : « Tous » montre aussi ceux de Damien", wp.document.querySelectorAll(".tl-rangee--client").length === 3);

  // Excel : export et import de la colonne Technicien
  const exp = wc.EchangesExcel.lignesExport();
  const iT = exp[0].colonnes.findIndex(c => c.titre === "Technicien");
  const val = (nom) => exp[0].lignes.find(l => l[0] === nom)[iT];
  t("export : noms des techniciens", iT !== -1 && val("A Alexandre") === "Alexandre" && val("D Damien") === "Damien" && val("N Personne") === "Non attribué");
  const H = (l) => l.map(x => ({ titre: x }));
  const f = wc.Excel.ecrire([{ nom: "Clients", colonnes: H(["Nom client *", "Ville *", "Pays *", "Début campagne (mois) *", "Fin campagne (mois) *", "Cadence visites (jours) *", "Technicien"]),
    lignes: [["N Personne", "X", "France", "Janvier", "Décembre", 14, "damien"], ["A Alexandre", "X", "France", "Janvier", "Décembre", 14, "Non attribué"],
      ["D Damien", "X", "France", "Janvier", "Décembre", 14, "moi"], ["Nouveau Damien", "X", "France", "Janvier", "Décembre", 14, "Inconnu"]] }]);
  const plan = wc.EchangesExcel.analyser(wc.Excel.lire(f.buffer));
  const src = (nom) => plan.clients.find(c => c.source.nom === nom).source.technicien;
  t("import : nom reconnu sans tenir compte des majuscules", src("N Personne") === "u2");
  t("import : « Non attribué » et « moi »", src("A Alexandre") === "" && src("D Damien") === "u1");
  t("import : nom inconnu averti, attribution inchangée", src("Nouveau Damien") === undefined && plan.avertissements.some(x => x.includes("Inconnu")));
  wc.Donnees.appliquerImport(plan);
  t("import appliqué", wc.Donnees.getClient(n.id).technicien === "u2" && wc.Donnees.getClient(a.id).technicien === "" && wc.Donnees.trouverClientParNom("Nouveau Damien").technicien === "u2");
  // Envoi immédiat après import : l'aperçu appelle la synchronisation juste après l'application
  const srcImport = require("fs").readFileSync(require("path").join(__dirname, "..", "Js", "EchangesExcel.js"), "utf8");
  t("après import : synchronisation lancée tout de suite (code de l'aperçu)",
    /Donnees\.appliquerImport\(plan\);[\s\S]{0,200}Synchro\.synchroniser\(\)/.test(srcImport));

  // Hors équipe : pas de filtre, colonne ignorée
  const sansEquipe = () => Object.assign(transport(), { monEquipe: async () => null });
  const ws = page("Clients.html", stock, "", sansEquipe());
  await sleep(80);
  t("hors équipe : pas de filtre technicien ni de champ", !ws.document.getElementById("filtre-technicien") &&
    (() => { ws.document.querySelector("[data-nouveau-client]").click(); return !ws.document.getElementById("fc-technicien"); })());
  const p2 = ws.EchangesExcel.analyser(ws.Excel.lire(f.buffer));
  t("hors équipe : technicien du fichier ignoré, avec avertissement", p2.clients.every(c => c.source.technicien === undefined) && p2.avertissements.some(x => x.includes("pas d'équipe")));
  t("hors équipe : tous les clients dans les rappels", ws.Donnees.getTechnicienCourant() === null);
};
