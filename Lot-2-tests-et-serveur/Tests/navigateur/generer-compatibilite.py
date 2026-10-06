#!/usr/bin/env python3
"""
Génère les couleurs de secours pour les anciens navigateurs.

oklch() est compris à partir de Chrome 111, Safari 15.4, Samsung Internet 22 ;
color-mix() à partir de Chrome 111, Safari 16.2. Sur un navigateur plus ancien,
une couleur inconnue rend le texte ou le fond « non défini » : la page devient
illisible. Ce script recopie chaque règle qui les utilise avec des couleurs
classiques (rgba) dans un bloc @supports, qui ne s'applique qu'aux navigateurs
qui ne comprennent pas ces fonctions. Les navigateurs récents l'ignorent.

Utilisation (depuis la racine du projet) :
    python3 Tests/navigateur/generer-compatibilite.py Tests/navigateur/sortie/tokens.json
Le bloc est réécrit entre les repères GENERE-DEBUT / GENERE-FIN de CSS/campagne.css
(relancer après toute modification de couleur). Les valeurs des variables
(jetons.json) sont produites par `node jetons.mjs`.
"""
import json, math, re, sys, os

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEBUT = "/* >>> GENERE-DEBUT : couleurs de secours (anciens navigateurs) — ne pas modifier à la main */"
FIN = "/* <<< GENERE-FIN */"
jetons = json.load(open(sys.argv[1]))

# ---------- couleurs ----------
# Couleurs qui dépendent de l'élément (texte courant, variables posées en ligne) : pas de valeur fixe possible.
DYNAMIQUES = {"currentColor", "var(--c)", "var(--pt-c)"}
def oklch(L, C, h, a=1.0):
    ar, br = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_, m_, s_ = L + 0.3963377774 * ar + 0.2158037573 * br, L - 0.1055613458 * ar - 0.0638541728 * br, L - 0.0894841775 * ar - 1.2914855480 * br
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]
    g = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * (max(x, 0) ** (1 / 2.4)) - 0.055
    return [max(0, min(255, round(g(max(0, min(1, x))) * 255))) for x in lin] + [a]

def nombre(t, pct_base=1.0):
    t = t.strip()
    if t == "none": return 0.0
    if t.endswith("%"): return float(t[:-1]) / 100 * pct_base
    return float(t)

def parse_couleur(txt, theme):
    t = txt.strip()
    if t in DYNAMIQUES: return [128, 128, 128, 1.0]      # teinte choisie par l'élément : gris neutre de secours
    m = re.fullmatch(r"var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)", t)
    if m:
        j = jetons[theme].get(m.group(1))
        if not j: return None
        if "couleur" in j: return list(j["couleur"])
        return parse_couleur(j["brut"], theme)
    if t == "transparent": return [0, 0, 0, 0.0]
    if t == "white": return [255, 255, 255, 1.0]
    if t == "black": return [0, 0, 0, 1.0]
    m = re.fullmatch(r"#([0-9a-fA-F]{3,8})", t)
    if m:
        h = m.group(1)
        if len(h) in (3, 4): h = "".join(c * 2 for c in h)
        return [int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), (int(h[6:8], 16) / 255 if len(h) == 8 else 1.0)]
    m = re.fullmatch(r"rgba?\(([^)]*)\)", t)
    if m:
        p = re.split(r"[\s,/]+", m.group(1).strip())
        return [round(nombre(p[0], 255)), round(nombre(p[1], 255)), round(nombre(p[2], 255)), nombre(p[3]) if len(p) > 3 else 1.0]
    m = re.fullmatch(r"oklch\(([^)]*)\)", t)
    if m:
        p = re.split(r"[\s/]+", m.group(1).strip())
        return oklch(nombre(p[0]), nombre(p[1], 0.4), nombre(p[2]) if p[2] != "none" else 0, nombre(p[3]) if len(p) > 3 else 1.0)
    return None

def css_rgba(c):
    a = round(c[3], 3)
    return f"rgb({c[0]},{c[1]},{c[2]})" if a >= 0.999 else f"rgba({c[0]},{c[1]},{c[2]},{a:g})"

def args_niveau0(s):
    parts, prof, cur = [], 0, ""
    for ch in s:
        if ch == "(": prof += 1
        if ch == ")": prof -= 1
        if ch == "," and prof == 0: parts.append(cur); cur = ""
        else: cur += ch
    parts.append(cur); return parts

def split_couleur_pct(txt):
    m = re.fullmatch(r"(.*?)\s+(\d+(?:\.\d+)?)%\s*", txt.strip(), re.S)
    return (m.group(1).strip(), float(m.group(2)) / 100) if m else (txt.strip(), None)

def mix(args, theme):
    """color-mix(in <espace>, A [p%], B [q%]) -> couleur statique (mélange prémultiplié) ou None."""
    ps = args_niveau0(args)
    if len(ps) != 3: return None
    (ca, pa), (cb, pb) = split_couleur_pct(ps[1]), split_couleur_pct(ps[2])
    if pa is None and pb is None: pa = pb = 0.5
    elif pa is None: pa = 1 - pb
    elif pb is None: pb = 1 - pa
    A, B = parse_couleur(ca, theme), parse_couleur(cb, theme)
    if A is None or B is None: return None
    tot = pa + pb; wa, wb = pa / tot, pb / tot
    alpha = (A[3] * wa + B[3] * wb) * min(1, tot)
    if alpha <= 0: return [0, 0, 0, 0.0]
    ch = [round((A[i] * A[3] * wa + B[i] * B[3] * wb) / (A[3] * wa + B[3] * wb)) for i in range(3)]
    return ch + [alpha]

def remplacer_fonction(valeur, nom, fn):
    """Remplace chaque nom( ... ) (parenthèses équilibrées) par fn(contenu) ; None si une conversion échoue."""
    out, i = "", 0
    while True:
        j = valeur.find(nom + "(", i)
        if j < 0: return out + valeur[i:]
        k, prof = j + len(nom) + 1, 1
        while k < len(valeur) and prof:
            prof += (valeur[k] == "(") - (valeur[k] == ")"); k += 1
        r = fn(valeur[j + len(nom) + 1:k - 1])
        if r is None: return None
        out += valeur[i:j] + r; i = k

def convertir(valeur, theme):
    v = remplacer_fonction(valeur, "color-mix", lambda a: (lambda c: css_rgba(c) if c else None)(mix(a, theme)))
    if v is None: return None
    return remplacer_fonction(v, "oklch", lambda a: (lambda c: css_rgba(c) if c else None)(parse_couleur("oklch(" + a + ")", theme)))

# ---------- analyse du CSS ----------
def sans_commentaires(css): return re.sub(r"/\*.*?\*/", "", css, flags=re.S)

def analyser(css):
    """Liste de (contexte_at_rules, selecteur, [(prop, valeur)])."""
    out = []
    def bloc(txt, ctx):
        i = 0
        while i < len(txt):
            j = txt.find("{", i)
            if j < 0: break
            prelude = txt[i:j].strip(); k, prof = j + 1, 1
            while k < len(txt) and prof:
                prof += (txt[k] == "{") - (txt[k] == "}"); k += 1
            corps = txt[j + 1:k - 1]
            if prelude.startswith("@"):
                if prelude.startswith(("@media", "@supports", "@layer")): bloc(corps, ctx + [prelude])
            elif prelude:
                decls, cur, prof2, guil = [], "", 0, None
                for ch in corps:
                    if guil: cur += ch; guil = None if ch == guil else guil; continue
                    if ch in "\"'": guil = ch
                    if ch == "(": prof2 += 1
                    if ch == ")": prof2 -= 1
                    if ch == ";" and prof2 == 0: decls.append(cur); cur = ""
                    else: cur += ch
                decls.append(cur)
                ds = []
                for d in decls:
                    if ":" in d:
                        p, v = d.split(":", 1); ds.append((p.strip(), v.strip()))
                out.append((tuple(ctx), prelude, ds))
            i = k
    bloc(sans_commentaires(css), [])
    return out

sources = []
for f in ("CSS/style.css", "CSS/campagne.css"):
    t = open(os.path.join(RACINE, f), encoding="utf-8").read()
    if DEBUT in t: t = t[:t.index(DEBUT)]
    sources.append(t)
regles = analyser("\n".join(sources))

def genere(motif_detecte):
    """Pour chaque règle contenant motif_detecte : fallback clair, puis sombre si différent."""
    sortie, sans = {}, []
    for ctx, sel, ds in regles:
        if any(c.startswith("@supports") and ("oklch" in c or "color-mix" in c) for c in ctx): continue
        cibles = [(p, v) for p, v in ds if not p.startswith("--") and motif_detecte(v)]
        if not cibles: continue
        sombre_seul = ".dark" in sel
        themes = ["dark"] if sombre_seul else ["light", "dark"]
        res = {}
        for th in themes:
            r = []
            for p, v in cibles:
                c = convertir(v, th)
                if c is None: sans.append((sel, p, v)); c = None
                if c is not None: r.append((p, c))
            res[th] = r
        if sombre_seul: sortie.setdefault(ctx, []).append((sel, res["dark"]))
        else:
            if res["light"]: sortie.setdefault(ctx, []).append((sel, res["light"]))
            if res["dark"] and res["dark"] != res["light"]:
                sortie.setdefault(ctx, []).append((", ".join("html.dark " + s.strip() for s in sel.split(",")), res["dark"]))
    return sortie, sans

def jetons_secours(motif):
    lignes = []
    for th, sel in (("light", ":root"), ("dark", "html.dark")):
        v = [(n, x) for n, x in jetons[th].items() if "couleur" in x and motif(x["brut"])]
        if th == "dark": v = [(n, x) for n, x in v if x["brut"] != jetons["light"].get(n, {}).get("brut")]
        if v: lignes.append(f"  {sel} {{ " + " ".join(f"{n}: {css_rgba(x['couleur'])};" for n, x in v) + " }")
    return lignes

def ecrire(sortie, ctx_vide_ok=True):
    txt = ""
    for ctx, regs in sortie.items():
        ind = "  "
        for c in ctx: txt += ind + c + " {\n"; ind += "  "
        for sel, ds in regs: txt += f"{ind}{sel} {{ " + " ".join(f"{p}: {v};" for p, v in ds) + " }\n"
        for _ in ctx: ind = ind[:-2]; txt += ind + "}\n"
    return txt

est_oklch = lambda v: "oklch(" in v
est_mix = lambda v: "color-mix(" in v
s_ok, sans_ok = genere(lambda v: "oklch(" in v and "color-mix(" not in v)
s_mix, sans_mix = genere(est_mix)
bloc = [DEBUT,
 "/* Sans oklch() (Chrome < 111, Safari < 15.4, Samsung Internet < 22) : variables et couleurs directes en rgb. */",
 "@supports not (color: oklch(0.5 0.1 27)) {", *jetons_secours(est_oklch), ecrire(s_ok).rstrip("\n"), "}",
 "/* Sans color-mix() (Chrome < 111, Safari < 16.2) : mélanges de couleurs calculés à l'avance. */",
 "@supports not (color: color-mix(in srgb, red 50%, blue)) {", ecrire(s_mix).rstrip("\n"), "}", FIN]
bloc_txt = "\n".join(l for l in bloc if l is not None)
chemin = os.path.join(RACINE, "CSS", "campagne.css")
css = open(chemin, encoding="utf-8").read()
if DEBUT in css: css = css[:css.index(DEBUT)].rstrip("\n") + "\n"
open(chemin, "w", encoding="utf-8").write(css + "\n" + bloc_txt + "\n")
nb = lambda s: sum(len(r) for r in s.values())
print(f"règles de secours : oklch={nb(s_ok)}, color-mix={nb(s_mix)} ; non convertibles : {len(sans_ok) + len(sans_mix)}")
for sel, p, v in (sans_ok + sans_mix)[:12]: print("  ⚠", sel[:50], p, v[:70])
