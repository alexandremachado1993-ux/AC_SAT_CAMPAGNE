/* =============================================================
   Excel.js — Lecture et écriture de fichiers .xlsx, export CSV

   Pourquoi pas SheetJS : la seule version publiée sur npm/cdnjs (0.18.5)
   n'est plus maintenue et porte deux failles connues sur la lecture de
   fichiers (CVE-2023-30533, CVE-2024-22363). Un .xlsx n'étant qu'un ZIP
   de fichiers XML, on le lit et l'écrit ici directement, avec fflate
   (décompression ZIP, licence MIT) embarqué dans Vendor/fflate.

   Périmètre volontairement limité à nos besoins : texte, nombres, dates,
   en-têtes en gras, largeurs de colonnes, ligne d'en-tête figée, filtres.
   Pas de formules ni de mise en forme avancée.
   ============================================================= */

const Excel = (() => {
    "use strict";

    const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    const NS_PKG = "http://schemas.openxmlformats.org/package/2006/relationships";

    /* ---------- Colonnes : A ⇄ 0 ---------- */

    function indexColonne(ref) {
        const lettres = String(ref).replace(/\d+/g, "");
        let n = 0;
        for (let i = 0; i < lettres.length; i++) n = n * 26 + (lettres.charCodeAt(i) - 64);
        return n - 1;
    }

    function lettreColonne(i) {
        let s = "", n = i + 1;
        while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
        return s;
    }

    /* ---------- LECTURE ---------- */

    function xml(texte) {
        return new DOMParser().parseFromString(texte, "application/xml");
    }

    function enfants(parent, nom) {
        return Array.prototype.filter.call(parent.childNodes, n => n.nodeType === 1 && n.localName === nom);
    }

    function tous(parent, nom) {
        return Array.prototype.slice.call(parent.getElementsByTagNameNS("*", nom));
    }

    /* Renvoie { "NomFeuille": [ [valeur, valeur…], … ] } — une ligne par
       ligne Excel, la ligne 1 incluse. Lève une Error au message lisible
       si le fichier n'est pas un .xlsx. */
    function lire(arrayBuffer) {
        let fichiers;
        try { fichiers = fflate.unzipSync(new Uint8Array(arrayBuffer)); }
        catch (e) { throw new Error("Ce fichier n'est pas un classeur Excel .xlsx (les anciens .xls ne sont pas pris en charge : enregistre-le au format .xlsx)."); }
        const texte = (chemin) => fichiers[chemin] ? fflate.strFromU8(fichiers[chemin]) : null;

        const classeur = texte("xl/workbook.xml");
        if (!classeur) throw new Error("Classeur Excel illisible (xl/workbook.xml absent).");

        const partages = [];
        const ss = texte("xl/sharedStrings.xml");
        if (ss) tous(xml(ss), "si").forEach(si => {
            /* Texte simple (<t>) ou texte enrichi (<r><t>) ; on ignore les
               annotations phonétiques (<rPh>). */
            partages.push(tous(si, "t").filter(t => t.parentNode.localName !== "rPh").map(t => t.textContent).join(""));
        });

        const relations = {};
        const rels = texte("xl/_rels/workbook.xml.rels");
        if (rels) tous(xml(rels), "Relationship").forEach(r => {
            let cible = r.getAttribute("Target");
            cible = cible.startsWith("/") ? cible.slice(1) : "xl/" + cible;
            relations[r.getAttribute("Id")] = cible;
        });

        const resultat = {};
        tous(xml(classeur), "sheet").forEach(feuille => {
            const nom = feuille.getAttribute("name");
            const rid = feuille.getAttributeNS(NS_REL, "id") || feuille.getAttribute("r:id");
            const contenu = texte(relations[rid] || "");
            resultat[nom] = contenu ? lireFeuille(xml(contenu), partages) : [];
        });
        return resultat;
    }

    function lireFeuille(doc, partages) {
        const lignes = [];
        tous(doc, "row").forEach((row, iRow) => {
            const numero = parseInt(row.getAttribute("r"), 10) || iRow + 1;
            const ligne = [];
            enfants(row, "c").forEach((c, iCol) => {
                const ref = c.getAttribute("r");
                const col = ref ? indexColonne(ref) : iCol;
                const type = c.getAttribute("t");
                const v = enfants(c, "v")[0];
                let valeur = null;
                if (type === "s") valeur = v ? (partages[parseInt(v.textContent, 10)] ?? "") : "";
                else if (type === "inlineStr") valeur = tous(c, "t").map(t => t.textContent).join("");
                else if (type === "b") valeur = v ? v.textContent === "1" : null;
                else if (type === "str" || type === "e") valeur = v ? v.textContent : "";
                else if (v) { const n = Number(v.textContent); valeur = isNaN(n) ? v.textContent : n; }
                ligne[col] = valeur;
            });
            lignes[numero - 1] = ligne;
        });
        /* Lignes et cellules absentes du XML → vides, pour un tableau régulier. */
        for (let i = 0; i < lignes.length; i++) {
            const l = lignes[i] || [];
            for (let j = 0; j < l.length; j++) if (l[j] === undefined) l[j] = null;
            lignes[i] = l;
        }
        return lignes;
    }

    /* ---------- ÉCRITURE ---------- */

    function echapper(valeur) {
        return String(valeur)
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")   // caractères interdits en XML
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    /* Nom de feuille Excel : 31 caractères max, sans : \ / ? * [ ] */
    function nomFeuille(nom) {
        return String(nom).replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Feuille";
    }

    function serieDate(iso) {
        const [y, m, d] = iso.split("-").map(Number);
        return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
    }

    function xmlFeuille(f) {
        const colonnes = f.colonnes;
        const cellule = (valeur, iCol, iLigne, style) => {
            const ref = lettreColonne(iCol) + (iLigne + 1);
            if (valeur === null || valeur === undefined || valeur === "") return "";
            const type = colonnes[iCol] && colonnes[iCol].type;
            if (type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
                return '<c r="' + ref + '" s="2"><v>' + serieDate(valeur) + '</v></c>';
            }
            if (typeof valeur === "number" && isFinite(valeur)) {
                return '<c r="' + ref + '"' + (style ? ' s="' + style + '"' : "") + '><v>' + valeur + '</v></c>';
            }
            return '<c r="' + ref + '" t="inlineStr"' + (style ? ' s="' + style + '"' : "") +
                '><is><t xml:space="preserve">' + echapper(valeur) + '</t></is></c>';
        };

        const entete = '<row r="1">' + colonnes.map((c, i) => cellule(c.titre, i, 0, 1)).join("") + '</row>';
        const corps = f.lignes.map((ligne, iL) =>
            '<row r="' + (iL + 2) + '">' + ligne.map((v, iC) => cellule(v, iC, iL + 1, 0)).join("") + '</row>').join("");
        const derniere = lettreColonne(colonnes.length - 1) + Math.max(1, f.lignes.length + 1);

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<worksheet xmlns="' + NS_MAIN + '" xmlns:r="' + NS_REL + '">' +
            '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
            '<cols>' + colonnes.map((c, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c.largeur || 16) + '" customWidth="1"/>').join("") + '</cols>' +
            '<sheetData>' + entete + corps + '</sheetData>' +
            (f.lignes.length > 0 ? '<autoFilter ref="A1:' + derniere + '"/>' : "") +
            '</worksheet>';
    }

    const STYLES =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="' + NS_MAIN + '">' +
        '<fonts count="2"><font><sz val="10"/><name val="Arial"/></font>' +
        '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts>' +
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="3">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
        '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
        '</cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '</styleSheet>';

    /* feuilles : [{ nom, colonnes: [{ titre, largeur?, type? ("date") }], lignes: [[…]] }]
       → Uint8Array du fichier .xlsx */
    function ecrire(feuilles) {
        const n = feuilles.length;
        const fichiers = {};
        const u8 = (t) => fflate.strToU8(t);

        fichiers["[Content_Types].xml"] = u8(
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
            feuilles.map((f, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
                '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") +
            '</Types>');

        fichiers["_rels/.rels"] = u8(
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="' + NS_PKG + '">' +
            '<Relationship Id="rId1" Type="' + NS_REL + '/officeDocument" Target="xl/workbook.xml"/>' +
            '</Relationships>');

        const noms = [];
        fichiers["xl/workbook.xml"] = u8(
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<workbook xmlns="' + NS_MAIN + '" xmlns:r="' + NS_REL + '"><sheets>' +
            feuilles.map((f, i) => {
                let nom = nomFeuille(f.nom), k = 2;
                while (noms.indexOf(nom) !== -1) nom = nomFeuille(f.nom).slice(0, 28) + " " + (k++);
                noms.push(nom);
                return '<sheet name="' + echapper(nom) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
            }).join("") +
            '</sheets></workbook>');

        fichiers["xl/_rels/workbook.xml.rels"] = u8(
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="' + NS_PKG + '">' +
            feuilles.map((f, i) => '<Relationship Id="rId' + (i + 1) + '" Type="' + NS_REL +
                '/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("") +
            '<Relationship Id="rId' + (n + 1) + '" Type="' + NS_REL + '/styles" Target="styles.xml"/>' +
            '</Relationships>');

        fichiers["xl/styles.xml"] = u8(STYLES);
        feuilles.forEach((f, i) => { fichiers["xl/worksheets/sheet" + (i + 1) + ".xml"] = u8(xmlFeuille(f)); });

        return fflate.zipSync(fichiers, { level: 6 });
    }

    /* ---------- CSV (séparateur « ; » + BOM : ouverture directe dans Excel FR) ---------- */

    function csv(colonnes, lignes) {
        const champ = (v) => {
            if (v === null || v === undefined) return "";
            const s = String(v);
            return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        };
        return "\uFEFF" + [colonnes.map(c => champ(c.titre)).join(";")]
            .concat(lignes.map(l => l.map(champ).join(";"))).join("\r\n");
    }

    /* ---------- Téléchargement ---------- */

    function telecharger(nomFichier, contenu, type) {
        const blob = new Blob([contenu], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nomFichier;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function telechargerXlsx(nomFichier, feuilles) {
        telecharger(nomFichier, ecrire(feuilles), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }

    function telechargerCsv(nomFichier, colonnes, lignes) {
        telecharger(nomFichier, csv(colonnes, lignes), "text/csv;charset=utf-8");
    }

    return { lire, ecrire, csv, telechargerXlsx, telechargerCsv, telecharger };
})();
