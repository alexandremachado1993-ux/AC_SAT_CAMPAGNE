/* Rapport de serti : calcul sur une période, filtres client / ligne, Excel, aperçu imprimable, fenêtre de choix. */
const fs = require("fs");
const path = require("path");
module.exports = async function ({ page, t }) {
  const evt = (w, type) => new w.Event(type, { bubbles: true, cancelable: true });
  const saisir = (w, el, v) => { el.value = v; el.dispatchEvent(evt(w, "input")); };
  const choisir = (w, el, v) => { el.value = v; el.dispatchEvent(evt(w, "change")); };
  const clic = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));

  const wd = page("Index.html"); const D = wd.Donnees, R = wd.ReferentielSerti;
  const jour = (n) => D.ajouterJours(D.aujourdhuiIso(), -n);                     // dates relatives : les tests ne dépendent pas du jour où ils tournent
  const ca = D.ajouterClient({ nom: "Alpha", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const cb = D.ajouterClient({ nom: "Bravo", ville: "Pau", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const la1 = D.enregistrerLigne(ca.id, { nom: "L1", formatHabituel: "1/2M", nbTetes: 4 }), la2 = D.enregistrerLigne(ca.id, { nom: "L2", formatHabituel: "1/4", nbTetes: 2 });
  const lb1 = D.enregistrerLigne(cb.id, { nom: "L1", formatHabituel: "4/4", colonneSerti: "ø99", nbTetes: 2 });
  const nom = (col, fmt) => { const v = {}; R.PARAMETRES.forEach(p => { const r = R.regle(p.id, col, fmt); if (!r) return; v[p.id] = r.type === "tol" ? r.nom : r.type === "plage" ? (r.min + r.max) / 2 : Math.round((r.min + 0.1) * 100) / 100; }); return v; };
  const n83 = nom("ø83", "1/2M"), n62 = nom("ø62 (1/4)", "1/4"), n99 = nom("ø99", "4/4");
  const mk = (cl, lg, date, fmt, col, nb, tetes, extra) => D.enregistrerVisite({ clientId: cl.id, ligneId: lg.id, date, type: "campagne", format: fmt, mesures: Object.assign({ colonne: col, format: fmt, nbTetes: nb, tetes }, extra || {}) });
  mk(ca, la1, jour(5), "1/2M", "ø83", 4, [{ n: 1, v: n83 }, { n: 2, v: Object.assign({}, n83, { flange: 2.7 }) }], { client: { note: "feuille A", tetes: [{ n: 1, v: n83 }, { n: 2, v: Object.assign({}, n83, { flange: 2.55 }) }] } });
  mk(ca, la2, jour(15), "1/4", "ø62 (1/4)", 2, [{ n: 1, v: Object.assign({}, n62, { croisure: 0.85 }) }]);
  mk(cb, lb1, jour(30), "4/4", "ø99", 2, [{ n: 1, v: n99 }, { n: 2, v: Object.assign({}, n99, { hauteurSerti: n99.hauteurSerti + 0.14 }) }]);
  mk(cb, lb1, jour(45), "4/4", "ø99", 2, [{ n: 1, v: n99 }]);
  const stock = wd.localStorage.getItem("acsc_donnees_v1");
  const w = page("Serti.html", stock); const Rap = w.SertiRapport;

  // ---------- Calcul : tout, puis période / client / ligne
  let d = Rap.construire({});
  t("rapport : synthèse (4 contrôles, 2 OUI, 2 NON, 1 à surveiller, 6 têtes mesurées, 1 avec contrôle client)", d.resume.controles === 4 && d.resume.oui === 2 && d.resume.non === 2 && d.resume.surveiller === 1 && d.resume.tetesMesurees === 6 && d.resume.avecClient === 1);
  t("rapport : taux de OUI = 50 %, 2 clients, 3 lignes", d.resume.pctOui === 50 && d.resume.clients === 2 && d.resume.lignes === 3);
  t("rapport : contrôles classés du plus ancien au plus récent", d.controles.map(c => c.v.date).join() === [jour(45), jour(30), jour(15), jour(5)].join());
  t("rapport : période (les 20 derniers jours → 2 contrôles ; bornes incluses)", Rap.construire({ debut: jour(20) }).resume.controles === 2 && Rap.construire({ debut: jour(15), fin: jour(15) }).resume.controles === 1);
  t("rapport : période (jusqu'à il y a 30 jours → 2 contrôles)", Rap.construire({ fin: jour(30) }).resume.controles === 2);
  t("rapport : client Alpha → 2 contrôles ; ligne L2 d'Alpha → 1", Rap.construire({ clientId: ca.id }).resume.controles === 2 && Rap.construire({ clientId: ca.id, ligneId: la2.id }).resume.controles === 1);
  t("rapport : client + ligne + période combinés", Rap.construire({ clientId: cb.id, ligneId: lb1.id, debut: jour(40) }).resume.controles === 1);
  t("rapport : sélection vide → zéro partout, sans erreur", (() => { const v = Rap.construire({ debut: jour(2), fin: jour(1) }); return v.resume.controles === 0 && v.mesures.length === 0 && v.parMesure.length === 0 && v.resume.pctOui === null; })());
  t("rapport : libellés du client, de la ligne et de la période", /Alpha/.test(Rap.construire({ clientId: ca.id }).libelleClient) && Rap.construire({ clientId: ca.id, ligneId: la2.id }).libelleLigne === "L2" && /^du \d{2}\/\d{2}\/\d{4} au \d{2}\/\d{2}\/\d{4}$/.test(Rap.construire({ debut: jour(20), fin: jour(1) }).periode));

  // ---------- Mesures (une ligne par tête × paramètre)
  const a1 = Rap.construire({ clientId: ca.id, ligneId: la1.id });
  const fl = a1.mesures.find(x => x.tete === 2 && x.parametre.id === "flange");
  t("mesures : la flange hors de la tête 2 porte sa valeur, sa règle (2,25 à 2,65), son verdict et l'écart avec le client (+0,15)", fl.valeur === 2.7 && fl.min === 2.25 && fl.max === 2.65 && fl.etat === "hors" && fl.client === 2.55 && Math.abs(fl.ecart - 0.15) < 1e-9);
  t("mesures : la croisure (minimum) n'a pas de maximum", a1.mesures.find(x => x.parametre.id === "croisure").max === null && a1.mesures.find(x => x.parametre.id === "croisure").min === 1);
  t("mesures : sans contrôle client, valeur et écart vides", Rap.construire({ clientId: cb.id }).mesures.every(x => x.client === null && x.ecart === null));
  t("mesures : 9 paramètres par tête saisie (la cuvette n'est pas saisie)", a1.mesures.length === 18);

  // ---------- Statistiques par mesure, têtes à surveiller, comparaison
  const sf = a1.parMesure.find(s => s.parametre.id === "flange");
  t("par mesure : une seule configuration → cible affichée (2,45 ± 0,20) ; hors = 1 sur 2", sf.n === 2 && sf.hors === 1 && /2,45 ± 0,20/.test(sf.cible) && sf.max === 2.7 && sf.min === 2.45);
  t("par mesure : plusieurs formats → « plusieurs formats »", d.parMesure.find(s => s.parametre.id === "flange").cible === "plusieurs formats");
  const t2 = d.parTete.find(e => e.nomClient === "Alpha" && e.nomLigne === "L1" && e.tete === 2);
  t("têtes à surveiller : la tête 2 de L1 (flange hors) est listée avec sa mesure en cause", !!t2 && t2.hors === 1 && /Flange/.test(Object.keys(t2.parametres).join()));
  t("têtes à surveiller : les têtes avec une mesure hors passent avant celles qui sont seulement en limite", d.parTete.findIndex(e => e.hors === 0) > d.parTete.map(e => e.hors > 0).lastIndexOf(true));
  t("têtes à surveiller : la tête en limite (4/4, serti) est listée sans « hors »", d.parTete.some(e => e.nomClient === "Bravo" && e.tete === 2 && e.limite >= 1 && e.hors === 0));
  t("comparaison : écart moyen par mesure (flange +0,075 sur 2 têtes → arrondi à 3 décimales)", (() => { const c = a1.comparaison.find(x => x.parametre.id === "flange"); return !!c && c.n === 2 && Math.abs(c.moyenne - 0.075) < 1e-9 && Math.abs(c.maxAbs - 0.15) < 1e-9; })());
  t("comparaison : rien à comparer sans contrôle client", Rap.construire({ clientId: cb.id }).comparaison.length === 0);

  // ---------- Excel
  const f = Rap.feuillesExcel(d);
  t("Excel : 6 feuilles dans l'ordre (Rapport, Contrôles, Mesures, Par mesure, Têtes à surveiller, Comparaison client)", f.map(x => x.nom).join() === "Rapport,Contrôles,Mesures,Par mesure,Têtes à surveiller,Comparaison client");
  t("Excel : chaque ligne a autant de cellules que la feuille a de colonnes", f.every(s => s.lignes.every(l => l.length === s.colonnes.length)));
  t("Excel : feuille Contrôles = 1 ligne par contrôle, validation OUI / NON en texte, dates au format date", f[1].lignes.length === 4 && f[1].lignes.every(l => l[7] === "OUI" || l[7] === "NON") && f[1].colonnes[0].type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(f[1].lignes[0][0]));
  t("Excel : feuille Mesures = 1 ligne par mesure, valeurs numériques (pour un tableau croisé)", f[2].lignes.length === d.mesures.length && f[2].lignes.every(l => typeof l[7] === "number"));
  t("Excel : feuille Rapport = synthèse chiffrée (contrôles 4, OUI 2, NON 2)", f[0].lignes.find(l => l[0] === "Contrôles")[1] === 4 && f[0].lignes.find(l => l[0] === "Validés (OUI)")[1] === 2 && f[0].lignes.find(l => l[0] === "Non validés (NON)")[1] === 2);
  const octets = w.Excel.ecrire(f);
  const relu = w.Excel.lire(octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength));
  t("Excel : le classeur s'écrit réellement (archive .xlsx valide), puis se relit avec ses 6 feuilles", octets.length > 1000 && octets[0] === 0x50 && octets[1] === 0x4b && Object.keys(relu).join() === "Rapport,Contrôles,Mesures,Par mesure,Têtes à surveiller,Comparaison client");
  t("Excel : relu, le classeur contient les bonnes valeurs (4 contrôles + en-tête ; une mesure de flange = 2,7)", relu["Contrôles"].length === 5 && relu["Mesures"].some(l => l.indexOf("Flange") !== -1 && l.some(c => Number(c) === 2.7)));
  t("Excel : nom de fichier explicite (client, ligne, période)", /^serti-alpha-l1-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.xlsx$/.test(Rap.nomFichier(Rap.construire({ clientId: ca.id, ligneId: la1.id, debut: jour(20), fin: jour(1) }))) && /^serti-tous-clients-debut-/.test(Rap.nomFichier(d)));

  // ---------- Aperçu imprimable
  const h = Rap.html(d, {});
  t("aperçu : sections Synthèse, Contrôles, Par mesure, Têtes à surveiller, Comparaison Seametal", ["Rapport de contrôle de serti", "Synthèse", "Contrôles", "Par mesure", "Têtes à surveiller", "Comparaison avec le contrôle du client"].every(x => h.indexOf(x) !== -1));
  t("aperçu : référentiel cité (SQ/EMB/067 rév. C), clients et validations lisibles", /SQ\/EMB\/067 rév\. C/.test(h) && /Alpha/.test(h) && /<strong>NON<\/strong>/.test(h) && /à surveiller/.test(h));
  t("aperçu : détail des mesures seulement si demandé", h.indexOf("Détail des mesures") === -1 && Rap.html(d, { detail: true }).indexOf("Détail des mesures") !== -1 && /✕/.test(Rap.html(d, { detail: true })));
  t("aperçu : un client mono-sélection n'a pas de colonne « Client » superflue", Rap.html(Rap.construire({ clientId: ca.id }), {}).indexOf("<th scope=\"col\">Client</th>") === -1 && h.indexOf("<th scope=\"col\">Client</th>") !== -1);
  const wx = page("Index.html"); const cx = wx.Donnees.ajouterClient({ nom: "X <img src=x onerror=alert(1)>", ville: "Y", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const lx = wx.Donnees.enregistrerLigne(cx.id, { nom: "L<b>1</b>", formatHabituel: "1/2M", nbTetes: 2 });
  wx.Donnees.enregistrerVisite({ clientId: cx.id, ligneId: lx.id, date: jour(1), type: "campagne", mesures: { colonne: "ø83", format: "1/2M", nbTetes: 2, tetes: [{ n: 1, v: { flange: 2.45 } }], note: "<script>alert(1)</script>", client: { note: "<i>feuille</i>", tetes: [{ n: 1, v: { flange: 2.4 } }] } } });
  const wxs = page("Serti.html", wx.localStorage.getItem("acsc_donnees_v1")); const hx = wxs.SertiRapport.html(wxs.SertiRapport.construire({}), { detail: true });
  t("aperçu : aucun HTML injecté par un nom de client, de ligne ou une note (échappé)", hx.indexOf("<img src=x") === -1 && hx.indexOf("<script>") === -1 && hx.indexOf("<b>1</b>") === -1 && /&lt;img src=x/.test(hx));

  // ---------- Fenêtre de choix (page Serti)
  let doc = w.document;
  t("page Serti : bouton « Rapport / export » présent", !!doc.querySelector("[data-serti-rapport]"));
  clic(doc.querySelector("[data-serti-rapport]"));
  t("fenêtre : période par défaut = 90 derniers jours, tous les clients, compte en direct", doc.getElementById("sr-debut").value === jour(90) && doc.getElementById("sr-fin").value === D.aujourdhuiIso() && /4 contrôles · 2 OUI · 2 NON/.test(doc.getElementById("sr-compte").textContent));
  choisir(w, doc.getElementById("sr-client"), ca.id);
  t("fenêtre : choisir un client réduit le compte et ne propose que ses lignes", /2 contrôles/.test(doc.getElementById("sr-compte").textContent) && Array.from(doc.getElementById("sr-ligne").options).map(o => o.textContent).join() === "Toutes les lignes,L1,L2");
  choisir(w, doc.getElementById("sr-ligne"), la2.id);
  t("fenêtre : client + ligne → 1 contrôle", /^1 contrôle /.test(doc.getElementById("sr-compte").textContent));
  choisir(w, doc.getElementById("sr-client"), "");
  t("fenêtre : sans client, les lignes sont précédées du nom du client", /Alpha · L1/.test(doc.getElementById("sr-ligne").textContent) && doc.getElementById("sr-ligne").value === "");
  clic(doc.querySelector('[data-sr-periode="30"]'));
  t("fenêtre : période rapide « 30 jours »", doc.getElementById("sr-debut").value === jour(30) && /3 contrôles/.test(doc.getElementById("sr-compte").textContent));
  clic(doc.querySelector('[data-sr-periode="tout"]'));
  t("fenêtre : « Tout » vide les dates", doc.getElementById("sr-debut").value === "" && doc.getElementById("sr-fin").value === "" && /4 contrôles/.test(doc.getElementById("sr-compte").textContent));
  saisir(w, doc.getElementById("sr-debut"), jour(1)); choisir(w, doc.getElementById("sr-debut"), jour(1)); choisir(w, doc.getElementById("sr-fin"), jour(10));
  t("fenêtre : début après la fin → message et actions désactivées", /début est après la date de fin/.test(doc.getElementById("sr-compte").textContent) && Array.from(doc.querySelectorAll("[data-sr]")).every(b => b.disabled));
  choisir(w, doc.getElementById("sr-debut"), jour(2)); choisir(w, doc.getElementById("sr-fin"), jour(1));
  t("fenêtre : période sans contrôle → « Aucun contrôle » et actions désactivées", /Aucun contrôle de serti/.test(doc.getElementById("sr-compte").textContent) && Array.from(doc.querySelectorAll("[data-sr]")).every(b => b.disabled));
  clic(doc.querySelector('[data-sr-periode="tout"]'));
  let capture = null; w.Excel.telechargerXlsx = (nomF, feuilles) => { capture = { nomF, feuilles }; };
  clic(doc.querySelector('[data-sr="xlsx"]'));
  t("Excel depuis la fenêtre : un classeur de 6 feuilles est téléchargé sous un nom explicite, la fenêtre se ferme", !!capture && capture.feuilles.length === 6 && /^serti-tous-clients-debut-.*\.xlsx$/.test(capture.nomF) && doc.querySelector("#serti-rapport") === null);
  clic(doc.querySelector("[data-serti-rapport]")); choisir(w, doc.getElementById("sr-client"), cb.id); doc.getElementById("sr-detail").checked = true; choisir(w, doc.getElementById("sr-detail"), true);
  clic(doc.querySelector('[data-sr="apercu"]'));
  const ap = doc.getElementById("serti-rapport");
  t("aperçu depuis la fenêtre : s'ouvre au premier plan, filtré sur Bravo, avec le détail des mesures", !!ap && /Bravo/.test(ap.textContent) && !/Alpha/.test(ap.textContent) && /Détail des mesures/.test(ap.textContent) && doc.body.classList.contains("rapport-ouvert"));
  let imprime = false; w.print = () => { imprime = true; };
  clic(ap.querySelector("[data-rapport-imprimer]"));
  t("aperçu : « Imprimer / enregistrer en PDF » lance l'impression du navigateur", imprime === true);
  clic(ap.querySelector("[data-rapport-fermer]"));
  t("aperçu : « Fermer » retire l'aperçu et rétablit la page", doc.getElementById("serti-rapport") === null && !doc.body.classList.contains("rapport-ouvert"));
  // les filtres de la page sont repris
  choisir(w, doc.getElementById("sf-client"), ca.id); clic(doc.querySelector("[data-serti-rapport]"));
  t("fenêtre : reprend le client choisi dans les filtres de la page", doc.getElementById("sr-client").value === ca.id);
  // impression : la feuille de style ne laisse que le rapport
  const css = fs.readFileSync(path.join(__dirname, "..", "CSS", "campagne.css"), "utf8");
  t("impression : à l'impression, tout le reste de la page est masqué (feuille de style)", /@media print[\s\S]*body\.rapport-ouvert > \*:not\(#serti-rapport\)[\s\S]*display: none/.test(css) && /\.rapport-barre \{ display: none; \}/.test(css));
};
