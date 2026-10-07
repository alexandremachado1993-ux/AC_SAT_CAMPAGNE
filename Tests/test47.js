/* Corrections signalées sur le terrain : (1) la liste « Référence » de l'outillage montre TOUTES les références (elle ne filtrait
   que sur ce qui était déjà tapé) ; (2) le contrôle de serti parle le vocabulaire de la fiche papier du technicien. */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ page, t }) {
  const stock = (lignes) => JSON.stringify({ clients: [{ id: "c1", nom: "Conserverie Exemple", ville: "Agen", pays: "France", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 }],
    lignes, contacts: [], visites: [], rdv: [], profil: {} });
  const L1 = { id: "l1", clientId: "c1", nom: "Ligne 1", statut: "active", molette1Fournisseur: "IMETA", molette1Ref: "P259M", molette2Fournisseur: "IMETA", molette2Ref: "P259", mandrinFournisseur: "Guylegall", mandrinRef: "48135" };
  const L2 = { id: "l2", clientId: "c1", nom: "Ligne 2", statut: "active", molette1Fournisseur: "Guylegall", molette1Ref: "GL-12" };
  const ouvrir = (w) => { w.Formulaires.ligne("c1", w.Donnees.getLigne("l1")); return w.document; };
  const options = (d, id) => Array.from(d.getElementById(id).options).map(o => o.value).filter(v => v && v !== "__libre__");
  const groupes = (d, id) => Array.from(d.getElementById(id).querySelectorAll("optgroup")).map(g => g.label);
  const changer = (w, id, valeur) => { const el = w.document.getElementById(id); el.value = valeur; el.dispatchEvent(new w.Event("change", { bubbles: true })); };

  // ---------- 1. La liste des références
  let w = page("Clients.html", stock([L1, L2])); let d = ouvrir(w);
  const ref2 = d.getElementById("fo-molette2-r");
  t("outillage : « Référence » est une VRAIE liste déroulante (select), plus un champ texte avec suggestions natives", ref2.tagName === "SELECT" && ref2.hasAttribute("data-choix-libre") && !d.querySelector('datalist[id^="dl-fo-"]'));
  t("outillage : la molette 2 contient déjà « P259 » ET la liste propose quand même « P259M » et les autres références (le défaut signalé)", ref2.value === "P259" && options(d, "fo-molette2-r").indexOf("P259M") !== -1 && options(d, "fo-molette2-r").indexOf("P259") !== -1 && options(d, "fo-molette2-r").indexOf("GL-12") !== -1);
  t("outillage : les références sont groupées par fournisseur, celui de l'outil en premier (IMETA, puis Guylegall)", groupes(d, "fo-molette2-r").join("|") === "IMETA|Guylegall");
  t("outillage : le mandrin a ses propres références (pas celles des molettes), la sienne est sélectionnée", options(d, "fo-mandrin-r").join(",") === "48135" && d.getElementById("fo-mandrin-r").value === "48135");
  t("outillage : « ➕ Autre… » est proposé en fin de liste pour une référence nouvelle", Array.from(d.getElementById("fo-molette2-r").options).some(o => o.value === "__libre__" && /Autre/.test(o.textContent)));

  changer(w, "fo-molette2-f", "Guylegall");
  t("outillage : changer de fournisseur remet SES références en premier, et la valeur déjà choisie est gardée", groupes(d, "fo-molette2-r")[0] === "Guylegall" && d.getElementById("fo-molette2-r").value === "P259" && options(d, "fo-molette2-r").indexOf("P259M") !== -1);

  changer(w, "fo-molette2-r", "__libre__");
  const libre = d.getElementById("fo-molette2-r-libre");
  t("outillage : « Autre… » fait apparaître le champ de saisie, qui prend le focus", libre.hidden === false && d.activeElement === libre);
  libre.value = "P777";
  d.getElementById("form-ligne").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  t("outillage : une référence tapée via « Autre… » est enregistrée", w.Donnees.getLigne("l1").molette2Ref === "P777" && w.Donnees.getLigne("l1").molette2Fournisseur === "Guylegall");
  d = ouvrir(w);
  t("outillage : la référence nouvelle est ensuite PROPOSÉE dans la liste (apprise)", options(d, "fo-molette1-r").indexOf("P777") !== -1 && options(d, "fo-mandrin-r").indexOf("P777") === -1);

  // ---------- 2. Rien de connu : le premier remplissage reste simple
  w = page("Clients.html", stock([{ id: "l1", clientId: "c1", nom: "Ligne 1", statut: "active" }])); d = ouvrir(w);
  t("outillage : sans aucune référence connue, « Référence » reste un simple champ texte (on peut taper la première)", d.getElementById("fo-molette1-r").tagName === "INPUT" && d.getElementById("fo-molette1-r").type === "text");
  d.getElementById("fo-molette1-r").value = "P259M";
  d.getElementById("form-ligne").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  t("outillage : la première référence saisie est enregistrée", w.Donnees.getLigne("l1").molette1Ref === "P259M");

  // ---------- 3. Contrôle de serti : vocabulaire de la fiche papier
  const R = w.ReferentielSerti || (page("Serti.html").ReferentielSerti);
  const noms = R.PARAMETRES.map(p => p.libelle);
  t("serti : le « Calage » porte le nom de la fiche papier (« Calage crochet de corps »), plus « crochet de fond »", R.parametre("calage").libelle === "Calage crochet de corps" && noms.indexOf("Calage crochet de fond") === -1);
  t("serti : « Flange » (erreur de traduction du document) devient « Hauteur serti », le nom de la fiche papier ; l'identifiant interne est conservé", R.parametre("flange").libelle === "Hauteur serti" && noms.indexOf("Flange") === -1 && noms.indexOf("Bride (flange)") === -1 && R.parametre("flange").id === "flange");
  t("serti : « Croisure % » et les autres colonnes propres à la feuille SEAMETAL (Sc., équilibre crochets) ne sont PAS saisies : on joint la feuille", !R.PARAMETRES.some(p => /Croisure %|Équilibre|Sc\./.test(p.libelle)) && !R.parametre("croisurePct"));
  t("serti : les identifiants des paramètres n'ont pas changé (les contrôles déjà enregistrés restent lisibles)", ["croisure", "calage", "ondulation", "flange", "hauteurSerti", "epaisseurSerti", "crochetFond", "crochetCorps"].every(id => !!R.parametre(id)));
};
