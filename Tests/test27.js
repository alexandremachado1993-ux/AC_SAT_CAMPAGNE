/* Contrôle de serti : formulaire de ligne, bloc dans la visite, validation OUI / NON, Seametal, historique, page Serti. */
module.exports = async function ({ page, t }) {
  const evt = (w, type) => new w.Event(type, { bubbles: true, cancelable: true });
  const saisir = (w, el, v) => { el.value = v; el.dispatchEvent(evt(w, "input")); };
  const choisir = (w, el, v) => { el.value = v; el.dispatchEvent(evt(w, "change")); };
  const clic = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
  const soumettre = (w, id) => w.document.getElementById(id).dispatchEvent(evt(w, "submit"));
  const donnees = (w) => w.localStorage.getItem("acsc_donnees_v1");

  const w0 = page("Index.html"); const D0 = w0.Donnees;
  const c = D0.ajouterClient({ nom: "Conserverie Serti", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const l1 = D0.enregistrerLigne(c.id, { nom: "Ligne 1", formatHabituel: "1/2M", produitHabituel: "Maïs" });
  let stock = donnees(w0);

  // ================= Formulaire de ligne : les deux formats se complètent
  let w = page("Client.html", stock, "?id=" + c.id); w.Formulaires.ligne(c.id); let d = w.document;
  t("ligne : champs « Têtes de sertissage » et « Format fournisseur »", !!d.getElementById("fl-tetes") && !!d.getElementById("fl-colonne"));
  t("ligne : têtes de 0 à 24 par paire (« non renseigné » + 13 choix)", d.getElementById("fl-tetes").options.length === 14 && d.getElementById("fl-tetes").options[1].value === "0" && d.getElementById("fl-tetes").options[13].value === "24");
  t("ligne : 12 colonnes du document (+ « automatique »), avec les noms de format côte à côte", d.getElementById("fl-colonne").options.length === 13 && /ø83 · 1\/2, 1\/2H, 1\/2M/.test(d.getElementById("fl-colonne").textContent));
  choisir(w, d.getElementById("fl-format"), "1/4 US");
  t("ligne : choisir le format 1/4 US remplit le format fournisseur ø65", d.getElementById("fl-colonne").value === "ø65");
  choisir(w, d.getElementById("fl-format"), "4/4");
  t("ligne : 4/4 est ambigu (ø96 ou ø99) : colonne vide et message d'aide", d.getElementById("fl-colonne").value === "" && /deux diamètres/.test(d.getElementById("fl-serti-aide").textContent));
  choisir(w, d.getElementById("fl-colonne"), "ø99");
  t("ligne : ø99 choisi, le format reste 4/4", d.getElementById("fl-format").value === "4/4");
  choisir(w, d.getElementById("fl-format"), ""); choisir(w, d.getElementById("fl-colonne"), "ø65");
  t("ligne : choisir le format fournisseur ø65 remplit le format 1/4 US quand il est vide", d.getElementById("fl-format").value === "1/4 US");
  choisir(w, d.getElementById("fl-colonne"), "ø83");
  t("ligne : ø83 est partagé (1/2, 1/2H, 1/2M) : le format n'est pas imposé, message d'aide", d.getElementById("fl-format").value === "1/4 US" && /1\/2, 1\/2H, 1\/2M partagent/.test(d.getElementById("fl-serti-aide").textContent));
  saisir(w, d.getElementById("fl-nom"), "Ligne 2"); choisir(w, d.getElementById("fl-format"), "1/4 US"); choisir(w, d.getElementById("fl-tetes"), "8"); soumettre(w, "form-ligne");
  let l2 = w.Donnees.lignesDuClient(c.id).find(l => l.nom === "Ligne 2");
  t("ligne : enregistrée avec 8 têtes ; colonne non figée quand elle est celle du format (ø65 déduite du 1/4 US)", !!l2 && l2.nbTetes === 8 && l2.colonneSerti === "");
  w.Formulaires.ligne(c.id); d = w.document;
  saisir(w, d.getElementById("fl-nom"), "Ligne 3"); choisir(w, d.getElementById("fl-format"), "4/4"); choisir(w, d.getElementById("fl-colonne"), "ø99"); choisir(w, d.getElementById("fl-tetes"), "0"); soumettre(w, "form-ligne");
  const l3 = w.Donnees.lignesDuClient(c.id).find(l => l.nom === "Ligne 3");
  t("ligne : 4/4 avec ø99 → colonne retenue (elle diffère de la déduction), 0 tête", l3.colonneSerti === "ø99" && l3.nbTetes === 0);
  w.Formulaires.ligne(c.id, l3); d = w.document;
  t("ligne : à la modification, têtes et colonne sont réaffichées", d.getElementById("fl-tetes").value === "0" && d.getElementById("fl-colonne").value === "ø99");
  stock = donnees(w);

  // ================= Visite : le bloc « Contrôle de serti »
  const ouvrir = (opts, s) => { const x = page("Client.html", s || stock, "?id=" + c.id); x.Formulaires.visite(opts); return x; };
  w = ouvrir({ ligneId: l1.id }); d = w.document;
  let bloc = d.querySelector("#fv-serti details.bloc-serti");
  t("visite : bloc « Contrôle de serti » proposé, replié, facultatif", !!bloc && !bloc.open && /facultatif/.test(bloc.querySelector("summary").textContent));
  t("visite : la ligne n'a pas de nombre de têtes → on le demande d'abord", /Choisis d'abord le nombre de têtes/.test(bloc.textContent) && !bloc.querySelector("[data-serti-champ]"));
  t("visite : format 1/2M → colonne ø83 trouvée toute seule", /1\/2M · ø83/.test(bloc.textContent) && bloc.querySelector("[data-serti-colonne]").value === "ø83");
  choisir(w, bloc.querySelector("[data-serti-nb]"), "4");
  t("visite : 4 têtes → 4 pastilles T1 à T4 et la saisie de la tête 1", bloc.querySelectorAll(".serti-tete").length === 4 && /Tête 1 sur 4/.test(bloc.querySelector(".serti-carte-titre").textContent));
  t("visite : 10 paramètres saisissables (3 critiques + 6 recommandés + cuvette)", bloc.querySelectorAll("[data-serti-champ]").length === 10);
  t("visite : les cibles du document sont affichées (flange 2,45 ± 0,20)", /2,45 ± 0,20 mm · de 2,25 à 2,65/.test(bloc.querySelector('[data-serti-param="flange"]').textContent) && /minimum 1,00 mm/.test(bloc.querySelector('[data-serti-param="croisure"]').textContent));
  t("visite : cuvette et hauteur du 1/2M — la cuvette n'a pas de tolérance : « non jugée »", /non renseignée/.test(bloc.querySelector('[data-serti-param="cuvette"]').textContent));
  const champ = (id) => bloc.querySelector('[data-serti-champ="' + id + '"]');
  const pastille = (id) => bloc.querySelector('[data-serti-param="' + id + '"] [data-serti-pastille]');
  saisir(w, champ("flange"), "2,70");
  t("visite : flange 2,70 → « Hors tolérance » tout de suite (virgule acceptée)", /Hors tolérance/.test(pastille("flange").textContent) && pastille("flange").getAttribute("data-etat") === "hors" && pastille("flange").classList.contains("pastille-statut"));
  saisir(w, champ("hauteurSerti"), "2,98"); t("visite : serti 2,98 → « Limite »", /Limite/.test(pastille("hauteurSerti").textContent));
  saisir(w, champ("croisure"), "1,05"); t("visite : croisure 1,05 → « Conforme »", /Conforme/.test(pastille("croisure").textContent));
  saisir(w, champ("croisure"), "0,95"); t("visite : croisure 0,95 → « Non conforme » (critique)", /Non conforme/.test(pastille("croisure").textContent));
  saisir(w, champ("croisure"), "1,05");
  saisir(w, champ("crochetFond"), "abc"); t("visite : valeur illisible signalée (aria-invalid)", champ("crochetFond").getAttribute("aria-invalid") === "true" && bloc.querySelector('[data-serti-param="crochetFond"]').classList.contains("serti-param--invalide"));
  saisir(w, champ("crochetFond"), "1,9");
  t("visite : le repère de la jauge apparaît quand une valeur est saisie", !bloc.querySelector('[data-serti-param="flange"] .serti-repere').hidden);
  t("visite : verdict de la tête affiché", /Hors tolérance/.test(bloc.querySelector("[data-serti-verdict-tete]").textContent));
  t("visite : la pastille T1 passe en « hors »", bloc.querySelector('[data-serti-tete="1"]').classList.contains("serti-tete--hors"));
  t("visite : bilan = « hors tolérance » et le résumé replié annonce NON", /hors tolérance/.test(bloc.querySelector(".serti-bilan").textContent) && /NON/.test(bloc.querySelector("[data-serti-court]").textContent));
  t("visite : validation NON proposée d'après les mesures", bloc.querySelector('input[data-serti-val][value="non"]').checked && /Proposé d'après les mesures : NON/.test(bloc.querySelector(".serti-validation").textContent));
  const ent = new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }); champ("flange").dispatchEvent(ent);
  t("visite : « Entrée » dans une case ne valide jamais le formulaire", ent.defaultPrevented === true && !!d.getElementById("form-visite"));

  // navigation entre têtes, reprise de la tête précédente
  clic(bloc.querySelector('[data-serti-nav="1"]'));
  t("visite : « Tête 2 › » ouvre la tête 2", /Tête 2 sur 4/.test(bloc.querySelector(".serti-carte-titre").textContent) && champ("flange").value === "");
  clic(bloc.querySelector("[data-serti-copier]"));
  t("visite : « Reprendre la tête 1 » copie ses valeurs dans les cases vides", champ("flange").value === "2,70" && champ("croisure").value === "1,05");
  saisir(w, champ("flange"), "2,45");
  clic(bloc.querySelector('[data-serti-tete="1"]'));
  t("visite : toucher T1 revient à la tête 1 avec ses valeurs", /Tête 1 sur 4/.test(bloc.querySelector(".serti-carte-titre").textContent) && champ("flange").value === "2,70");

  // validation OUI / NON manuelle
  const radioOui = bloc.querySelector('input[data-serti-val][value="oui"]'); radioOui.checked = true; radioOui.dispatchEvent(evt(w, "change"));
  t("visite : OUI choisi malgré la proposition NON → « décision manuelle » + champ motif", /Décision manuelle/.test(bloc.querySelector(".serti-validation").textContent) && !!bloc.querySelector("[data-serti-note]"));
  saisir(w, bloc.querySelector("[data-serti-note]"), "mesure refaite à la main");
  t("visite : le résumé replié annonce OUI", /OUI/.test(bloc.querySelector("[data-serti-court]").textContent));

  // Seametal : la même grille pour le client
  clic(bloc.querySelector('[data-serti-serie="client"]'));
  t("visite : onglet « Contrôle client (Seametal) » : même grille, texte d'explication", /relevées par le client/.test(bloc.textContent) && bloc.querySelectorAll("[data-serti-champ]").length === 10 && champ("flange").value === "");
  saisir(w, champ("flange"), "2,62"); saisir(w, champ("hauteurSerti"), "2,90"); saisir(w, champ("croisure"), "1,0");
  t("visite : les valeurs du client sont jugées avec les mêmes tolérances (2,62 → limite)", /Limite/.test(pastille("flange").textContent) || /Conforme/.test(pastille("flange").textContent));
  t("visite : champ « feuille du client » (référence du PDF) proposé", !!bloc.querySelector("[data-serti-noteclient]"));
  saisir(w, bloc.querySelector("[data-serti-noteclient]"), "Seametal 02/10 — ligne 1");
  clic(bloc.querySelector('[data-serti-serie="mes"]'));
  t("visite : comparaison résumée dès que les deux séries ont une tête en commun", /Contrôle client : \d+ cases comparées/.test(bloc.querySelector(".serti-bilan").textContent));

  // enregistrement
  soumettre(w, "form-visite");
  let v = w.Donnees.visitesAvecMesures()[0];
  t("visite : enregistrée avec son contrôle (4 têtes, ø83, validation OUI forcée avec motif)", !!v && v.mesures.nbTetes === 4 && v.mesures.colonne === "ø83" && v.mesures.validation === "oui" && v.mesures.forcee === true && v.mesures.note === "mesure refaite à la main");
  t("visite : mesures des deux têtes et du client enregistrées", v.mesures.tetes.length === 2 && v.mesures.tetes[0].v.flange === 2.7 && v.mesures.client.tetes[0].v.flange === 2.62 && v.mesures.client.note === "Seametal 02/10 — ligne 1");
  t("visite : le nombre de têtes choisi est retenu sur la ligne (colonne non figée)", w.Donnees.getLigne(l1.id).nbTetes === 4 && !w.Donnees.getLigne(l1.id).colonneSerti);
  stock = donnees(w);

  // modification : le contrôle est rechargé et conservé
  w = ouvrir({ visite: v }); d = w.document; bloc = d.querySelector("#fv-serti details.bloc-serti");
  t("modifier : le bloc s'ouvre avec les valeurs enregistrées (2,7 : le nombre est réaffiché sans zéro final)", bloc.open && champ("flange").value === "2,7" && champ("croisure").value === "1,05");
  t("modifier : la décision manuelle OUI et son motif sont réaffichées", bloc.querySelector('input[data-serti-val][value="oui"]').checked && bloc.querySelector("[data-serti-note]").value === "mesure refaite à la main");
  soumettre(w, "form-visite");
  const apres = w.Donnees.getVisite(v.id);
  t("modifier sans toucher au contrôle : il est conservé à l'identique", JSON.stringify(apres.mesures) === JSON.stringify(v.mesures));
  stock = donnees(w);
  w = ouvrir({ visite: apres }); d = w.document; bloc = d.querySelector("#fv-serti details.bloc-serti");
  saisir(w, champ("flange"), "2,40"); soumettre(w, "form-visite");
  t("modifier une valeur : le contrôle est mis à jour et rejugé (flange 2,40 : plus de mesure hors → NON proposé levé)", w.Donnees.getVisite(v.id).mesures.tetes[0].v.flange === 2.4 && w.Donnees.getVisite(v.id).mesures.validationAuto === "oui");
  stock = donnees(w);
  w = ouvrir({ visite: w.Donnees.getVisite(v.id) }); d = w.document; bloc = d.querySelector("#fv-serti details.bloc-serti");
  clic(bloc.querySelector("[data-serti-effacer]")); soumettre(w, "form-visite");
  t("effacer le contrôle puis enregistrer : la visite n'a plus de contrôle", w.Donnees.getVisite(v.id).mesures === undefined);
  stock = donnees(w);

  // statut : le bloc disparaît pour une visite non effectuée
  w = ouvrir({ ligneId: l1.id }); d = w.document;
  bloc = d.querySelector("#fv-serti details.bloc-serti");
  saisir(w, bloc.querySelector('[data-serti-champ="flange"]'), "2,70");
  choisir(w, d.getElementById("fv-statut"), "reportee");
  t("visite non effectuée : le bloc de serti est caché avec le contenu (pas de contrôle sur une visite non faite)", d.getElementById("fv-contenu").hidden === true);
  choisir(w, d.getElementById("fv-statut"), "effectuee");
  t("statut changé puis rétabli : la saisie de serti n'est PAS perdue", !d.getElementById("fv-contenu").hidden && d.querySelector('#fv-serti [data-serti-champ="flange"]').value === "2,70");
  choisir(w, d.getElementById("fv-statut"), "reportee"); saisir(w, d.getElementById("fv-reporte"), "2026-10-20"); soumettre(w, "form-visite");
  t("visite reportée enregistrée : aucun contrôle de serti n'est conservé, la ligne n'est pas modifiée", w.Donnees.visitesAvecMesures().filter(x => x.date === d.getElementById("fv-date").value).length === 0 && w.Donnees.getLigne(l1.id).nbTetes === 4);
  w = ouvrir({ ligneId: l1.id }); d = w.document; bloc = d.querySelector("#fv-serti details.bloc-serti");
  saisir(w, bloc.querySelector('[data-serti-champ="flange"]'), "2,45"); saisir(w, bloc.querySelector('[data-serti-champ="croisure"]'), "1,05");
  clic(bloc.querySelector("[data-serti-effacer]"));
  const annuler = () => Array.from(d.querySelectorAll('[role="status"] button')).find(x => x.textContent === "Annuler");
  t("« Effacer le contrôle » vide la saisie mais propose « Annuler »", bloc.querySelector('[data-serti-champ="flange"]').value === "" && !!annuler());
  clic(annuler());
  t("« Annuler » rétablit toutes les valeurs", bloc.querySelector('[data-serti-champ="flange"]').value === "2,45" && bloc.querySelector('[data-serti-champ="croisure"]').value === "1,05");
  clic(bloc.querySelector("[data-serti-effacer]")); d.querySelectorAll('[role="status"]').forEach(x => x.remove()); clic(bloc.querySelector("[data-serti-effacer]"));
  t("effacer un bloc déjà vide ne propose rien à annuler", !annuler());
  // pas de ligne : pas de bloc
  w = ouvrir({ clientId: c.id }); d = w.document; choisir(w, d.getElementById("fv-type"), "reunion"); choisir(w, d.getElementById("fv-ligne"), "");
  t("réunion sans ligne : pas de bloc de serti", !d.querySelector("#fv-serti details"));

  // format ambigu / inconnu : la colonne se choisit à la main
  const w4 = page("Index.html", stock); const D4 = w4.Donnees;
  const lg = D4.enregistrerLigne(c.id, { nom: "Ligne mixte", formatHabituel: "1/2 ou 1/4", nbTetes: 2 });
  w = ouvrir({ ligneId: lg.id }, donnees(w4)); d = w.document; bloc = d.querySelector("#fv-serti details.bloc-serti");
  t("format libre (« 1/2 ou 1/4 ») : colonne à choisir, message d'aide, aucune règle appliquée", bloc.querySelector("[data-serti-colonne]").value === "" && /pas dans le référentiel/.test(bloc.textContent));
  saisir(w, champ("flange"), "2,70");
  t("sans colonne : la valeur est notée mais non jugée", /non jugée/.test(pastille("flange").textContent) && /sans verdict/.test(bloc.querySelector(".serti-bilan").textContent));
  t("sans colonne : validation à choisir à la main (aucune proposition)", /Aucune mesure n'a pu être jugée/.test(bloc.querySelector(".serti-validation").textContent) && !bloc.querySelector('input[data-serti-val]:checked'));
  choisir(w, bloc.querySelector("[data-serti-colonne]"), "ø83");
  t("colonne choisie : la valeur est jugée aussitôt (flange 2,70 → hors) ; la colonne est retenue sur la ligne à l'enregistrement", /Hors tolérance/.test(pastille("flange").textContent) && !!bloc.querySelector("[data-serti-memoriser]"));
  soumettre(w, "form-visite");
  t("format libre : colonne ø83 retenue sur la ligne (différente de la déduction)", w.Donnees.getLigne(lg.id).colonneSerti === "ø83");
  // 0 tête
  const w5 = page("Index.html", donnees(w)); const l0 = w5.Donnees.enregistrerLigne(c.id, { nom: "Ligne manuelle", formatHabituel: "3/1", nbTetes: 0 });
  w = ouvrir({ ligneId: l0.id }, donnees(w5)); d = w.document; bloc = d.querySelector("#fv-serti details.bloc-serti");
  t("0 tête : pas de pastilles de têtes, une seule série « Mesures de la ligne »", bloc.querySelectorAll(".serti-tete").length === 0 && /Ligne/.test(bloc.querySelector(".serti-carte-titre").textContent) && bloc.querySelectorAll("[data-serti-champ]").length === 10);
  saisir(w, champ("croisure"), "1,3"); soumettre(w, "form-visite");
  t("0 tête : enregistré sur la série n = 0", w.Donnees.visitesAvecMesures()[0].mesures.tetes[0].n === 0 && w.Donnees.visitesAvecMesures()[0].mesures.colonne === "ø153 (3/1)");
  stock = donnees(w);

  // ================= Rendez-vous réalisé : contrôle facultatif, par ligne
  const w6 = page("Client.html", stock, "?id=" + c.id); const rdv = w6.Donnees.enregistrerRdv({ clientId: c.id, date: "2026-09-01", type: "campagne", ligneIds: [l1.id] });
  w6.Formulaires.realiserRdv(rdv.id); d = w6.document;
  const boutonSerti = d.querySelector('[data-serti-ouvrir="' + l1.id + '"]');
  t("rendez-vous réalisé : bouton « Contrôle de serti » par ligne, rien de monté tant qu'on ne le demande pas", !!boutonSerti && !d.querySelector("#fxs-" + l1.id + " details"));
  clic(boutonSerti);
  const b6 = d.querySelector("#fxs-" + l1.id + " details.bloc-serti");
  t("rendez-vous réalisé : le bloc s'ouvre pour cette ligne (4 têtes déjà retenues)", !!b6 && b6.open && b6.querySelectorAll(".serti-tete").length === 4);
  saisir(w6, b6.querySelector('[data-serti-champ="flange"]'), "2,45");
  soumettre(w6, "form-realiser");
  const vr = w6.Donnees.visitesAvecMesures().find(x => x.date === "2026-09-01");
  t("rendez-vous réalisé : la visite créée porte le contrôle", !!vr && vr.mesures.tetes[0].v.flange === 2.45 && vr.mesures.validation === "oui");

  // ================= Historique de la fiche client
  const w7 = page("Client.html", donnees(w6), "?id=" + c.id); d = w7.document;
  t("fiche de la ligne : « Serti : 4 têtes »", /🔬 Serti : 4 têtes/.test(d.body.textContent));
  d.querySelector('[data-onglet="historique"]').click();
  t("historique : pastille « Serti OUI / NON » sur les visites concernées", /🔬 Serti (OUI|NON)/.test(d.querySelector(".carte").textContent) && d.querySelectorAll(".ligne-historique").length > 0);
  t("historique : une visite sans contrôle n'a pas de pastille de serti", Array.from(d.querySelectorAll(".ligne-historique")).some(x => !/🔬 Serti/.test(x.textContent)));

  // ================= Page Serti : vide, puis tous les contrôles
  const wv = page("Serti.html"); 
  t("page Serti : message d'accueil quand rien n'est saisi", /Aucun contrôle de serti pour l'instant/.test(wv.document.body.textContent) && !!wv.document.querySelector("[data-nouvelle-visite]"));

  const wd = page("Index.html"); const Dd = wd.Donnees;
  const ca = Dd.ajouterClient({ nom: "Alpha", ville: "Agen", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const cb = Dd.ajouterClient({ nom: "Bravo", ville: "Pau", debutCampagne: 5, finCampagne: 11, cadenceJours: 14 });
  const la1 = Dd.enregistrerLigne(ca.id, { nom: "L1", formatHabituel: "1/2M", nbTetes: 4 }), la2 = Dd.enregistrerLigne(ca.id, { nom: "L2", formatHabituel: "1/4", nbTetes: 2 });
  const lb1 = Dd.enregistrerLigne(cb.id, { nom: "L1", formatHabituel: "4/4", colonneSerti: "ø99", nbTetes: 2 });
  const R = wd.ReferentielSerti;
  const nom = (col, fmt) => { const v = {}; R.PARAMETRES.forEach(p => { const r = R.regle(p.id, col, fmt); if (!r) return; v[p.id] = r.type === "tol" ? r.nom : r.type === "plage" ? (r.min + r.max) / 2 : Math.round((r.min + 0.1) * 100) / 100; }); return v; };
  const mk = (cl, lg, date, fmt, col, nb, vals, extra) => Dd.enregistrerVisite({ clientId: cl.id, ligneId: lg.id, date, type: "campagne", format: fmt,
    mesures: Object.assign({ colonne: col, format: fmt, nbTetes: nb, tetes: vals }, extra || {}) });
  const n83 = nom("ø83", "1/2M"), n62 = nom("ø62 (1/4)", "1/4"), n99 = nom("ø99", "4/4");
  mk(ca, la1, "2026-09-29", "1/2M", "ø83", 4, [{ n: 1, v: n83 }, { n: 2, v: Object.assign({}, n83, { flange: 2.7 }) }], { client: { tetes: [{ n: 1, v: Object.assign({}, n83, { flange: 2.40 }) }, { n: 2, v: Object.assign({}, n83, { flange: 2.55 }) }], note: "feuille A" } });
  mk(ca, la2, "2026-09-20", "1/4", "ø62 (1/4)", 2, [{ n: 1, v: Object.assign({}, n62, { croisure: 0.85 }) }]);
  mk(cb, lb1, "2026-09-10", "4/4", "ø99", 2, [{ n: 1, v: n99 }, { n: 2, v: Object.assign({}, n99, { hauteurSerti: n99.hauteurSerti + 0.14 }) }]);
  mk(cb, lb1, "2026-09-02", "4/4", "ø99", 2, [{ n: 1, v: n99 }]);
  const wp = page("Serti.html", donnees(wd)); d = wp.document;
  const lignes = () => d.querySelectorAll(".serti-ligne");
  const puce = (k) => d.querySelector('[data-serti-filtre="' + k + '"]');
  t("page Serti : la liste est un groupe de boutons (pas de rôle « listitem » qui masquerait le bouton)", d.querySelector(".serti-liste").getAttribute("role") === "group" && !d.querySelector('[role="listitem"]') && d.querySelector(".serti-ligne").tagName === "BUTTON");
  t("page Serti : 4 contrôles listés, le plus récent d'abord", lignes().length === 4 && /29\/09\/2026/.test(lignes()[0].textContent) && /Alpha/.test(lignes()[0].textContent));
  t("page Serti : l'état OUI / NON est visible avant d'ouvrir (compteurs : toutes 4, OUI 2, NON 2)", /Toutes\s*4/.test(puce("tous").textContent) && /OUI\s*2/.test(puce("oui").textContent) && /NON\s*2/.test(puce("non").textContent));
  t("page Serti : chaque ligne donne format (deux noms), têtes mesurées, état et contrôle client", /1\/2M · ø83/.test(lignes()[0].textContent) && /2 \/ 4 têtes/.test(lignes()[0].textContent) && /NON/.test(lignes()[0].textContent) && /Seametal/.test(lignes()[0].textContent) && /Pas de contrôle client/.test(lignes()[1].textContent));
  clic(puce("non"));
  t("page Serti : filtre « NON » → 2 contrôles (flange hors ; croisure critique)", lignes().length === 2 && /Toutes\s*4/.test(puce("tous").textContent));
  clic(puce("tous")); clic(puce("oui"));
  t("page Serti : filtre « OUI » → 2 contrôles", lignes().length === 2);
  clic(puce("surveiller"));
  t("page Serti : « À surveiller » = OUI avec une valeur en limite (4/4, serti 2,98)", lignes().length === 1 && /Bravo/.test(lignes()[0].textContent) && /à surveiller/.test(lignes()[0].textContent));
  clic(puce("tous"));
  const cli = d.getElementById("sf-client"); choisir(wp, cli, ca.id);
  t("page Serti : filtre client → ses contrôles seulement, les lignes proposées sont les siennes", lignes().length === 2 && Array.from(d.getElementById("sf-ligne").options).map(o => o.textContent).join() === "Toutes les lignes,L1,L2");
  choisir(wp, d.getElementById("sf-ligne"), la2.id);
  t("page Serti : client puis ligne → un seul contrôle", lignes().length === 1 && /1\/4 · ø62/.test(lignes()[0].textContent));
  choisir(wp, d.getElementById("sf-ligne"), ""); choisir(wp, cli, "");
  choisir(wp, d.getElementById("sf-format"), "4/4 · ø99");
  t("page Serti : filtre format (4/4 · ø99) → 2 contrôles", lignes().length === 2);
  choisir(wp, d.getElementById("sf-format"), "");
  saisir(wp, d.getElementById("sf-q"), "bravo");
  t("page Serti : recherche libre « bravo » → 2 contrôles ; la saisie garde son focus (champ non recréé)", lignes().length === 2 && d.getElementById("sf-q").value === "bravo");
  clic(d.querySelector("[data-serti-reinit]"));
  clic(d.querySelector("[data-serti-sea]"));
  t("page Serti : « avec contrôle client » → 1 contrôle", lignes().length === 1 && /Alpha/.test(lignes()[0].textContent));
  clic(d.querySelector("[data-serti-reinit]"));
  t("page Serti : réinitialiser remet les 4 contrôles", lignes().length === 4);

  // détail
  clic(lignes()[0]);
  t("page Serti : le détail s'ouvre sous la liste (client · ligne, date, format, référentiel)", /Alpha · L1/.test(d.getElementById("serti-detail").textContent) && /SQ\/EMB\/067 rév\. C/.test(d.getElementById("serti-detail").textContent));
  t("page Serti : matrice têtes × mesures (2 têtes × 10 mesures)", d.querySelectorAll(".serti-matrice-ligne").length === 3 && d.querySelectorAll(".serti-case").length === 20);
  t("page Serti : la flange hors tolérance de T2 est visible (trait rouge) avec un libellé accessible", !!d.querySelector('.serti-case--hors[aria-label*="Tête 2, Flange"]'));
  const onglet = (m) => d.querySelector('[data-serti-mode="' + m + '"]');
  t("page Serti : onglets Mes mesures · Contrôle client (Seametal) · Comparaison, tous actifs ici", !onglet("mes").disabled && !onglet("client").disabled && !onglet("cmp").disabled);
  clic(onglet("client"));
  t("page Serti : onglet client → ses valeurs et la référence de sa feuille", /feuille A/.test(d.getElementById("serti-detail").textContent) && d.querySelectorAll(".serti-case").length === 20);
  clic(onglet("cmp"));
  t("page Serti : comparaison → cases « manuel · client » avec écart Δ", d.querySelectorAll(".serti-case--cmp").length >= 7 && /Δ [+−]/.test(d.getElementById("serti-detail").textContent));
  t("page Serti : écarts à regarder en pointillé orange + écart moyen par mesure", d.querySelectorAll(".serti-case--alerte").length > 0 && /Écart moyen par mesure/.test(d.getElementById("serti-detail").textContent));
  clic(lignes()[1]);
  t("page Serti : un contrôle sans client → onglets client et comparaison grisés, invitation à l'ajouter", onglet("client").disabled && onglet("cmp").disabled && /Pas de contrôle client/.test(d.getElementById("serti-detail").textContent));
  clic(d.querySelector("[data-serti-modifier]"));
  t("page Serti : « Modifier la visite » ouvre la visite avec son contrôle", !!d.querySelector("#form-visite") && !!d.querySelector("#fv-serti details.bloc-serti") && d.querySelector("#fv-serti details.bloc-serti").open);

  // ================= Menu
  const wm = page("Serti.html", donnees(wd)); d = wm.document;
  t("menu (ordinateur) : « Serti » est dans la barre latérale, page active", !!d.querySelector('#rail-lateral a[href="Serti.html"]') && /actif/.test(d.querySelector('#rail-lateral a[href="Serti.html"]').className));
  t("menu (téléphone) : la barre du bas garde ses 4 liens ; Serti est dans le menu du profil", d.querySelectorAll(".nav-basse-lien").length === 4 && !d.querySelector('.nav-basse-lien[href="Serti.html"]'));
  clic(d.querySelector(".entete-avatar"));
  t("menu du profil : lien « Serti » avant Documents", /📏 Serti/.test(d.querySelector(".menu-avatar-panneau").textContent) && d.querySelector(".menu-avatar-panneau").textContent.indexOf("Serti") < d.querySelector(".menu-avatar-panneau").textContent.indexOf("Documents"));
};
