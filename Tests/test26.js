/* Contrôle de serti : référentiel, règles de calcul, validation OUI / NON, données, comparaison Seametal. */
module.exports = async function ({ page, t }) {
  const w = page("Index.html"); const D = w.Donnees, R = w.ReferentielSerti, S = w.SertiCalcul;
  const proche = (a, b) => Math.abs(a - b) < 1e-9;

  // ---------- Référentiel : 12 colonnes × 11 valeurs, lues dans le document SQ/EMB/067 rév. C
  t("référentiel : 12 colonnes, 12 formats boîte, 10 paramètres", R.COLONNES.length === 12 && R.FORMATS.length === 12 && R.PARAMETRES.length === 10);
  const cles = ["croisure", "calage", "ondulation", "hauteurBoite", "flange", "hauteurSerti", "epaisseurSerti", "crochetFond", "crochetCorps", "epBoite", "epFond"];
  t("référentiel : les 132 valeurs sont présentes (12 × 11)", R.COLONNES.every(c => cles.every(k => c.valeurs[k] !== undefined && c.valeurs[k] !== null)));
  const v83 = R.colonne("ø83").valeurs;
  t("ø83 = colonne de la photo (croisure 1,00 ; 85,80 ± 0,30 ; flange 2,45 ± 0,20 ; serti 2,85 ± 0,15 ; épaisseur 1,09 ± 0,01 ; crochets 1,90 / 1,95 ± 0,20 ; 0,16 ; 0,21)",
    v83.croisure === 1 && v83.hauteurBoite[0] === 85.8 && v83.hauteurBoite[1] === 0.3 && v83.flange[0] === 2.45 && v83.hauteurSerti[0] === 2.85 && v83.hauteurSerti[1] === 0.15 &&
    v83.epaisseurSerti[0] === 1.09 && v83.epaisseurSerti[1] === 0.01 && v83.crochetFond[0] === 1.9 && v83.crochetCorps[0] === 1.95 && v83.epBoite === 0.16 && v83.epFond === 0.21);
  t("ø153 (5/1) : épaisseur de serti 1,49 ± 0,01, hauteur 245 mm ; ø153 (5/1B) : 237 mm", R.colonne("ø153 (5/1)").valeurs.epaisseurSerti[0] === 1.49 && R.colonne("ø153 (5/1)").valeurs.hauteurBoite[0] === 245 && R.colonne("ø153 (5/1B)").valeurs.hauteurBoite[0] === 237);
  t("croisure par diamètre : 0,90 (ø52 à ø62) · 1,00 (ø65 à ø83) · 1,10 (ø96, ø99) · 1,25 (ø153)",
    R.colonne("ø62 (1/4)").valeurs.croisure === 0.9 && R.colonne("ø70").valeurs.croisure === 1 && R.colonne("ø99").valeurs.croisure === 1.1 && R.colonne("ø153 (3/1)").valeurs.croisure === 1.25);

  // ---------- Formats : les deux noms, dans les deux sens
  t("formats : 1/2, 1/2H et 1/2M partagent la colonne ø83", ["1/2", "1/2H", "1/2M"].every(f => R.colonnesDuFormat(f).join() === "ø83") && R.formatsDeLaColonne("ø83").join() === "1/2,1/2H,1/2M");
  t("formats : 1/4 = ø62, 1/4 US = ø65 (« 1/4us » reconnu)", R.colonnesDuFormat("1/4").join() === "ø62 (1/4)" && R.colonnesDuFormat("1/4 US").join() === "ø65" && R.colonnesDuFormat("1/4us").join() === "ø65");
  t("formats : le 4/4 existe en deux diamètres (ø96 ou ø99), à choisir", R.colonnesDuFormat("4/4").join() === "ø96 (4/4),ø99");
  t("formats : inconnu ou texte libre → aucune colonne", R.colonnesDuFormat("1/2 ou 1/4").length === 0 && R.colonnesDuFormat("").length === 0 && R.colonnesDuFormat("2/1").length === 0);
  t("formats : les deux noms côte à côte", R.libelleFormat("1/2M", "ø83") === "1/2M · ø83" && R.libelleFormat("4/4", "ø99") === "4/4 · ø99" && R.libelleFormat("1/6", "ø52 (1/6)") === "1/6 · ø52");

  // ---------- Règles : tolérances manquantes (cuvette, hauteur du 1/2 et du 1/2H)
  t("règle : hauteur de boîte du 1/2M = 85,80 ± 0,30 ; du 1/2 et du 1/2H = non renseignée", R.regle("hauteurBoite", "ø83", "1/2M").nom === 85.8 && R.regle("hauteurBoite", "ø83", "1/2") === null && R.regle("hauteurBoite", "ø83", "1/2H") === null);
  t("règle : les autres valeurs de la colonne ø83 servent aux trois formats 1/2", ["1/2", "1/2H", "1/2M"].every(f => R.regle("flange", "ø83", f).nom === 2.45));
  t("règle : profondeur de cuvette sans tolérance = non renseignée", R.regle("cuvette", "ø83", "1/2M") === null);
  R.AJOUTS.cuvette["ø83"] = [3.2, 3.8]; R.AJOUTS.hauteurBoite["1/2H"] = [89.5, 90.1];
  t("AJOUTS : la cuvette et la hauteur du 1/2H deviennent jugées", R.regle("cuvette", "ø83", "1/2M").max === 3.8 && R.regle("hauteurBoite", "ø83", "1/2H").min === 89.5 && R.regle("hauteurBoite", "ø83", "1/2") === null);
  R.ALIAS_HAUTEUR["1/2"] = "1/2M";
  t("ALIAS_HAUTEUR : le 1/2 prend la hauteur du 1/2M", R.regle("hauteurBoite", "ø83", "1/2").nom === 85.8);
  delete R.AJOUTS.cuvette["ø83"]; delete R.AJOUTS.hauteurBoite["1/2H"]; delete R.ALIAS_HAUTEUR["1/2"];   // on vide les objets du module, on ne les remplace pas

  // ---------- Verdicts d'une valeur (colonne ø83, format 1/2M)
  const ev = (id, v, f) => S.evaluer(R.regle(id, "ø83", f || "1/2M"), v);
  t("recommandé : cible ± tolérance, limite dans le dernier cinquième", ev("hauteurSerti", 2.85) === "ok" && ev("hauteurSerti", 2.97) === "ok" && ev("hauteurSerti", 2.98) === "limite" && ev("hauteurSerti", 3.0) === "limite" && ev("hauteurSerti", 3.01) === "hors" && ev("hauteurSerti", 2.69) === "hors");
  t("épaisseur de serti ± 0,01 : seule la valeur exacte est « conforme », ± 0,01 = limite, au-delà = hors", ev("epaisseurSerti", 1.09) === "ok" && ev("epaisseurSerti", 1.1) === "limite" && ev("epaisseurSerti", 1.08) === "limite" && ev("epaisseurSerti", 1.11) === "hors");
  t("croisure = minimum (confirmé) : 1,00 ok, 0,99 hors, aucun maximum", ev("croisure", 1.0) === "ok" && ev("croisure", 0.99) === "hors" && ev("croisure", 3) === "ok");
  t("critiques en plage : calage 70-95, ondulation 5-25 (bords = limite, dehors = hors)", ev("calage", 82) === "ok" && ev("calage", 70) === "limite" && ev("calage", 69) === "hors" && ev("calage", 96) === "hors" && ev("ondulation", 15) === "ok" && ev("ondulation", 26) === "hors");
  t("sans règle ou sans valeur : jamais jugé", ev("cuvette", 3.5) === "nr" && ev("flange", null) === "nr" && ev("hauteurBoite", 85.8, "1/2") === "nr");
  t("saisie : virgule ou point, texte et vide refusés", S.nombre("1,05") === 1.05 && S.nombre("1.05") === 1.05 && S.nombre(" 2,5 ") === 2.5 && S.nombre("abc") === null && S.nombre("") === null && S.nombre("1,2,3") === null);
  t("nombre de têtes : 0 à 24, par paire", [0, 2, 4, 6, 8, 12, 24].every(n => S.normaliserNbTetes(n) === n) && [1, 3, 7, 25, 26, -2].every(n => S.normaliserNbTetes(n) === null) && S.normaliserNbTetes("") === null && S.normaliserNbTetes("6") === 6);

  // ---------- Contrôle : verdict de la ligne, validation OUI / NON
  const tete = (n, v) => ({ n, v });
  const bon = { croisure: 1.1, calage: 80, ondulation: 12, hauteurBoite: 85.8, flange: 2.45, hauteurSerti: 2.85, epaisseurSerti: 1.09, crochetFond: 1.9, crochetCorps: 1.95 };
  const base = (tetes) => ({ colonne: "ø83", format: "1/2M", nbTetes: 6, tetes });
  let m = S.nettoyer(base([tete(1, bon), tete(2, bon)]));
  t("tout conforme : verdict ok, validation proposée OUI, pas à surveiller", m.verdict === "ok" && m.validation === "oui" && m.validationAuto === "oui" && m.forcee === false && !S.analyser(m).aSurveiller);
  m = S.nettoyer(base([tete(1, bon), tete(2, Object.assign({}, bon, { hauteurSerti: 2.98 }))]));
  t("une valeur en limite : reste OUI, signalé « à surveiller »", m.verdict === "limite" && m.validation === "oui" && S.analyser(m).aSurveiller === true);
  m = S.nettoyer(base([tete(1, bon), tete(3, Object.assign({}, bon, { flange: 2.7 }))]));
  t("une valeur hors tolérance : NON, la pire tête décide (T3)", m.verdict === "hors" && m.validation === "non" && S.analyser(m).problemes[0].tete === 3 && S.analyser(m).problemes[0].parametre === "flange");
  m = S.nettoyer(base([tete(1, bon), tete(2, Object.assign({}, bon, { croisure: 0.9 }))]));
  t("croisure sous le minimum : non conforme (critique), NON", m.verdict === "crit" && m.validation === "non" && S.analyser(m).problemes[0].critique === true);
  m = S.nettoyer(Object.assign(base([tete(1, Object.assign({}, bon, { flange: 2.9 }))]), { validation: "oui" }));
  t("décision manuelle OUI malgré une mesure hors : conservée et marquée « forcée »", m.validation === "oui" && m.validationAuto === "non" && m.forcee === true);
  t("validation seule (sans mesure) : conservée", S.nettoyer({ colonne: "ø83", validation: "non" }).validation === "non");
  t("rien à garder : null", S.nettoyer({ colonne: "ø83", tetes: [] }) === null && S.nettoyer(null) === null && S.nettoyer("x") === null);
  m = S.nettoyer({ colonne: "ø999", tetes: [tete(1, { flange: 2.4 })] });
  t("colonne inconnue : valeurs notées mais AUCUN verdict (rien n'a pu être jugé)", !!m && m.colonne === "" && m.verdict === "" && m.validation === "");
  m = S.nettoyer({ colonne: "ø83", format: "1/2", tetes: [tete(1, { hauteurBoite: 85.8 })] });
  t("1/2 : la hauteur de boîte seule n'est pas jugée, donc pas de verdict", m.verdict === "" && m.validation === "");
  t("référentiel figé dans le contrôle (numéro, révision, date)", /^SQ\/EMB\/067 rév\. C du 2026-06-04$/.test(S.nettoyer(base([tete(1, bon)])).ref));

  // ---------- Nettoyage : seulement des données plausibles
  t("têtes : numéros hors du nombre déclaré ignorés", S.nettoyer(base([tete(9, bon), tete(2, bon)])).tetes.map(x => x.n).join() === "2" && S.nettoyer(base([tete(0, bon)])) === null);
  t("0 tête : une seule série (n = 0)", S.nettoyer({ colonne: "ø83", nbTetes: 0, tetes: [tete(0, bon), tete(1, bon)] }).tetes.map(x => x.n).join() === "0");
  const sale = S.nettoyer({ colonne: "ø83", nbTetes: 4, tetes: [tete(1, { flange: -3, hauteurSerti: 5000, crochetFond: "abc", crochetCorps: "1,9", cuvette: "3,5" })] });
  t("valeurs : négatives, énormes ou illisibles ignorées ; virgule acceptée", Object.keys(sale.tetes[0].v).sort().join() === "crochetCorps,cuvette" && sale.tetes[0].v.crochetCorps === 1.9);
  t("têtes en double : la dernière saisie l'emporte, triées par numéro", S.nettoyer(base([tete(3, { flange: 2.4 }), tete(1, { flange: 2.4 }), tete(3, { flange: 2.5 })])).tetes.map(x => x.n + ":" + x.v.flange).join() === "1:2.4,3:2.5");

  // ---------- Contrôle client (Seametal) : comparaison tête par tête
  const manuel = { hauteurSerti: 2.85, flange: 2.45, crochetFond: 1.9, croisure: 1.1, epaisseurSerti: 1.09 };
  const client = { hauteurSerti: 2.88, flange: 2.4, crochetFond: 1.95, croisure: 1.0, epaisseurSerti: 1.09 };
  m = S.nettoyer(Object.assign(base([tete(1, manuel), tete(2, manuel)]), { client: { tetes: [tete(1, client)], note: "feuille 12" } }));
  const cmp = S.comparer(m);
  t("Seametal : seules les têtes présentes des deux côtés sont comparées", cmp.disponible && cmp.lignes.length === 1 && cmp.lignes[0].n === 1 && cmp.nbCases === 5);
  const cs = (id) => cmp.lignes[0].cases.find(c => c.id === id);
  t("Seametal : écart = manuel moins client (−0,03 sur le serti, +0,05 sur la flange, +0,10 sur la croisure)", proche(cs("hauteurSerti").ecart, -0.03) && proche(cs("flange").ecart, 0.05) && proche(cs("croisure").ecart, 0.1));
  t("Seametal : « à regarder » au-delà du quart de la tolérance (0,0375 sur le serti → −0,03 non ; 0,05 sur la flange → +0,05 non ; croisure : 0,05 → +0,10 oui ; épaisseur 0 → non)", cs("hauteurSerti").alerte === false && cs("flange").alerte === false && cs("croisure").alerte === true && cs("epaisseurSerti").alerte === false);
  t("Seametal : écart moyen par mesure et écart maximum", proche(cmp.moyennes.hauteurSerti, -0.03) && proche(cmp.ecartMax, 0.05) && cmp.nbAlertes === 1);
  t("Seametal : sans contrôle client, pas de comparaison ; la référence de la feuille est gardée", S.comparer(S.nettoyer(base([tete(1, manuel)]))).disponible === false && m.client.note === "feuille 12" && m.client.source === "Seametal");
  const mauvais = S.nettoyer(Object.assign(base([tete(1, manuel)]), { client: { tetes: [tete(1, Object.assign({}, client, { croisure: 0.9 }))] } }));
  t("Seametal : verdict du client jugé avec les mêmes tolérances (conforme ici ; croisure 0,90 → non conforme)", S.analyser(m).client[0].verdict === "ok" && S.analyser(mauvais).client[0].verdict === "crit");

  // ---------- Données : la ligne
  const c = D.ajouterClient({ nom: "Conserverie Serti", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const l = D.enregistrerLigne(c.id, { nom: "Ligne 1", formatHabituel: "1/2M", nbTetes: "6", colonneSerti: "ø83" });
  t("ligne : nombre de têtes (texte → nombre) et colonne retenus", l.nbTetes === 6 && l.colonneSerti === "ø83");
  D.enregistrerLigne(c.id, { nbTetes: 7 }, l.id);
  t("ligne : nombre de têtes impair → vidé (de 0 à 24, par paire)", D.getLigne(l.id).nbTetes === "");
  D.enregistrerLigne(c.id, { nbTetes: 0 }, l.id); t("ligne : 0 tête accepté (une seule série)", D.getLigne(l.id).nbTetes === 0);
  D.enregistrerLigne(c.id, { nbTetes: 24, colonneSerti: "ø999" }, l.id); t("ligne : 24 têtes accepté, colonne inconnue vidée", D.getLigne(l.id).nbTetes === 24 && D.getLigne(l.id).colonneSerti === "");
  D.enregistrerLigne(c.id, { nbTetes: 6, colonneSerti: "ø83" }, l.id);
  D.enregistrerLigne(c.id, { notes: "x" }, l.id); t("ligne : une autre modification ne touche ni les têtes ni la colonne", D.getLigne(l.id).nbTetes === 6 && D.getLigne(l.id).colonneSerti === "ø83");
  t("formats proposés : les formats du référentiel sont dans la liste", ["1/6", "1/4 US", "3/4", "5/1B", "1/2M", "1/2H"].every(f => D.valeursConnues("format").indexOf(f) !== -1));

  // ---------- Données : la visite conserve le contrôle
  const source = { clientId: c.id, ligneId: l.id, date: "2026-09-24", type: "campagne", format: "1/2M", produit: "Maïs",
    mesures: { colonne: "ø83", format: "1/2M", nbTetes: 6, tetes: [tete(1, bon), tete(3, Object.assign({}, bon, { flange: 2.7 }))], client: { tetes: [tete(1, client)], note: "feuille 12" } } };
  let v = D.enregistrerVisite(source);
  t("visite : le contrôle est enregistré, nettoyé et jugé", !!v.mesures && v.mesures.verdict === "hors" && v.mesures.validation === "non" && v.mesures.tetes.length === 2 && v.mesures.client.tetes.length === 1);
  t("visite : sans contrôle, aucun champ « mesures »", D.enregistrerVisite({ clientId: c.id, ligneId: l.id, date: "2026-09-25", type: "campagne" }).mesures === undefined);
  const v2 = D.modifierVisite(v.id, Object.assign({}, source, { remarques: "modifiée", mesures: v.mesures }));
  t("visite : une modification qui renvoie le contrôle le conserve", !!v2.mesures && v2.mesures.tetes.length === 2 && D.getVisite(v.id).remarques === "modifiée");
  t("visite : une modification qui ne le renvoie pas l'efface (c'est le formulaire qui doit le renvoyer)", D.modifierVisite(v.id, { clientId: c.id, ligneId: l.id, date: "2026-09-24", type: "campagne" }).mesures === undefined);
  D.modifierVisite(v.id, Object.assign({}, source, { mesures: v.mesures }));
  const rp = D.enregistrerVisite({ clientId: c.id, ligneId: l.id, date: "2026-09-26", type: "campagne", statut: "reportee", reporteLe: "2026-10-01", motif: "Panne", mesures: source.mesures });
  t("visite reportée : jamais de contrôle de serti", rp.mesures === undefined);
  t("visitesAvecMesures : seulement les visites qui en portent, la plus récente d'abord", D.visitesAvecMesures().map(x => x.id).join() === v.id);
  const v3 = D.enregistrerVisite(Object.assign({}, source, { date: "2026-09-30", mesures: { colonne: "ø83", format: "1/2M", nbTetes: 6, tetes: [tete(1, bon)] } }));
  t("visitesAvecMesures : tri par date décroissante", D.visitesAvecMesures().map(x => x.id).join() === v3.id + "," + v.id);

  // ---------- Synchronisation : un champ inconnu de l'ancien code voyage sans perte
  const copie = JSON.parse(JSON.stringify(D.getVisite(v.id)));
  const w2 = page("Index.html");
  w2.Donnees.ajouterClient({ nom: "Autre appareil", ville: "Pau" });
  const c2 = w2.Donnees.ajouterClient({ nom: "Conserverie Serti", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  w2.Donnees.appliquerDistant([{ collection: "clients", id: c.id, contenu: JSON.parse(JSON.stringify(D.getClient(c.id))), maj_client: new Date().toISOString(), maj_serveur: new Date().toISOString(), supprime: false },
    { collection: "lignes", id: l.id, contenu: JSON.parse(JSON.stringify(D.getLigne(l.id))), maj_client: new Date().toISOString(), maj_serveur: new Date().toISOString(), supprime: false },
    { collection: "visites", id: v.id, contenu: copie, maj_client: new Date().toISOString(), maj_serveur: new Date().toISOString(), supprime: false }]);
  const recu = w2.Donnees.getVisite(v.id);
  t("synchronisation : le contrôle (mesures, Seametal, validation) arrive intact sur l'autre appareil", !!recu && JSON.stringify(recu.mesures) === JSON.stringify(D.getVisite(v.id).mesures));
  t("synchronisation : les réglages de la ligne (têtes, colonne) arrivent aussi", w2.Donnees.getLigne(l.id).nbTetes === 6 && w2.Donnees.getLigne(l.id).colonneSerti === "ø83");

  // ---------- Suppression d'un client : ses contrôles disparaissent avec lui
  D.supprimerClients([c.id]);
  t("suppression d'un client : ses contrôles de serti disparaissent", D.visitesAvecMesures().length === 0);

  // ---------- Strictesse du nombre de têtes
  t("nombre de têtes : texte parasite refusé (« 6abc », « 6.5 », « 4 têtes »)", S.normaliserNbTetes("6abc") === null && S.normaliserNbTetes("6.5") === null && S.normaliserNbTetes("4 têtes") === null && S.normaliserNbTetes(" 6 ") === 6 && S.normaliserNbTetes("24") === 24);

  // ---------- Règle « recalculer » : une tolérance ajoutée plus tard ne laisse pas une pastille périmée
  const wr = page("Index.html"); const Sr = wr.SertiCalcul, Rr = wr.ReferentielSerti;
  const stocke = Sr.nettoyer({ colonne: "ø83", format: "1/2M", nbTetes: 2, tetes: [{ n: 1, v: { flange: 2.45, cuvette: 9 } }] });
  t("recalcul : avant la tolérance de cuvette, OUI", stocke.validation === "oui" && Sr.etatActuel(stocke).validation === "oui");
  Rr.AJOUTS.cuvette["ø83"] = [3.2, 3.8];
  t("recalcul : la tolérance ajoutée (cuvette 9 mm hors 3,2–3,8) fait passer l'affichage à NON, sans toucher à l'enregistré", Sr.etatActuel(stocke).validation === "non" && stocke.validation === "oui");
  const decide = Sr.nettoyer({ colonne: "ø83", format: "1/2M", nbTetes: 2, tetes: [{ n: 1, v: { flange: 2.45, cuvette: 3.5 } }], validation: "non" });
  t("recalcul : une décision manuelle n'est jamais recalculée", decide.forcee === true && Sr.etatActuel(decide).validation === "non" && Sr.etatActuel(decide).forcee === true);
  t("recalcul : sans contrôle, état vide", Sr.etatActuel(null).validation === "" && Sr.etatActuel(null).aSurveiller === false);
  delete Rr.AJOUTS.cuvette["ø83"];
};
