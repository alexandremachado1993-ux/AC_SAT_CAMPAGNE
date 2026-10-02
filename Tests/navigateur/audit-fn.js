(() => {
  const W = document.documentElement.clientWidth, H = window.innerHeight;
  const out = [];
  const cache = new Map();
  const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (c) => { if (cache.has(c)) return cache.get(c);
    const lire = (fond) => { cx.globalCompositeOperation = "source-over"; cx.fillStyle = fond; cx.fillRect(0,0,1,1); cx.fillStyle = c; cx.fillRect(0,0,1,1); return cx.getImageData(0,0,1,1).data; };
    const d = lire("#000"), w = lire("#fff");
    const a = Math.min(1, Math.max(0, 1 - (w[0] - d[0]) / 255));
    const v = a < 0.004 ? [0,0,0,0] : [Math.min(255, Math.round(d[0]/a)), Math.min(255, Math.round(d[1]/a)), Math.min(255, Math.round(d[2]/a)), a];
    cache.set(c, v); return v; };
  const lum = ([r,g,b]) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055, 2.4); }; return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b); };
  const blend = (fg, bg) => [0,1,2].map(i => Math.round(fg[i]*fg[3] + bg[i]*(1-fg[3])));
  const fondEffectif = (el) => { let couches = []; for (let p = el; p; p = p.parentElement) { const cs = getComputedStyle(p);
      if (cs.backgroundImage !== "none") return null; const c = rgba(cs.backgroundColor); if (c[3] > 0) { couches.push(c); if (c[3] >= 0.999) break; } }
    let bg = [255,255,255]; for (let i = couches.length - 1; i >= 0; i--) bg = blend(couches[i], bg); return bg; };
  const desc = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += "#" + el.id; const c = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0,2).join(".") : ""; if (c) s += "." + c;
    const t = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28); return s + (t ? ' "' + t + '"' : ""); };
  const visible = (el) => { const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const ancetreRogne = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) { const r = p.getBoundingClientRect(); if (r.right <= W + 1 && r.left >= -1) return true; } } return false; };

  if (document.documentElement.scrollWidth > W + 1) out.push({ t: "page-defile-horizontalement", d: document.documentElement.scrollWidth + " px > " + W + " px" });

  const vus = new Set();
  document.querySelectorAll("body *").forEach(el => {
    if (["SCRIPT","STYLE","OPTION","PATH","CIRCLE","RECT","LINE","G","TEXT","DEFS","MARKER","TITLE","DESC","SVG"].includes(el.tagName.toUpperCase())) return;
    if (!visible(el)) return;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    // 1. débordement hors de l'écran
    if ((r.right > W + 1 || r.left < -1) && !ancetreRogne(el) && cs.position !== "fixed") out.push({ t: "deborde-de-l-ecran", d: desc(el) + " [" + Math.round(r.left) + " → " + Math.round(r.right) + " / " + W + "]" });
    // 2. texte coupé sans points de suspension
    if (/(hidden|clip)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== "ellipsis" && el.children.length === 0 && (el.textContent || "").trim())
      out.push({ t: "texte-coupe", d: desc(el) + " (" + el.scrollWidth + " > " + el.clientWidth + ")" });
    // 3. petites cibles tactiles
    if (el.matches("a[href], button, select, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), [role=button], summary, label.champ-case, label.choix-statut-option") && !el.closest(".pl-defilement,.tl-defilement")) {
      const petit = Math.min(r.height, r.width); if (petit < 32) out.push({ t: "cible-tactile-petite", d: desc(el) + " " + Math.round(r.width) + "×" + Math.round(r.height) });
    }
    // 4. texte minuscule + contraste
    const propre = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (propre) {
      const fs = parseFloat(cs.fontSize); if (fs < 11) out.push({ t: "texte-minuscule", d: desc(el) + " " + fs + "px" });
      const bg = fondEffectif(el); if (bg) { const fg = rgba(cs.color); const c = blend(fg, bg); const l1 = lum(c), l2 = lum(bg); const ratio = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
        const gros = fs >= 24 || (fs >= 18.66 && parseInt(cs.fontWeight) >= 700); const seuil = gros ? 3 : 4.5;
        if (ratio < seuil && !el.disabled) { const cle = cs.color + "|" + bg.join(",") ; if (!vus.has(cle + desc(el).slice(0,20))) { vus.add(cle + desc(el).slice(0,20)); out.push({ t: "contraste-faible", d: desc(el) + " " + ratio.toFixed(2) + ":1 (seuil " + seuil + ")" }); } } }
    }
  });
  // 5. contenu masqué par la barre du bas (mobile)
  const nav = document.querySelector(".nav-basse");
  if (nav && getComputedStyle(nav).display !== "none") {
    const contenu = document.querySelector(".app-contenu, .app-conteneur"); const rn = nav.getBoundingClientRect();
    window.scrollTo(0, document.documentElement.scrollHeight);
    const bas = Math.max(0, ...[...(contenu || document.body).querySelectorAll("*")].filter(visible).map(e => e.getBoundingClientRect().bottom));
    if (bas > rn.top + 1) out.push({ t: "contenu-cache-par-la-barre-du-bas", d: "bas du contenu " + Math.round(bas) + " > haut de la barre " + Math.round(rn.top) });
    window.scrollTo(0, 0);
  }
  return out;
})()
