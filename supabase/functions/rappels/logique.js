/* =============================================================
   logique.js — Calculs des rappels (fonction serveur « rappels »)

   Même règles que Js/Donnees.js côté application :
     - une ligne est « à voir » si elle est active, que son client est
       actif et en campagne, et qu'elle n'a pas eu de visite de campagne
       depuis le début de la campagne, ou que son échéance est dépassée ;
     - seules les visites EFFECTUÉES comptent (une visite reportée, non effectuée
       ou annulée, gardée dans l'historique, ne remet pas la ligne « à jour ») ;
     - un rendez-vous « proposé » attend une confirmation ;
     - un rendez-vous confirmé dont la date est passée est « à clôturer » ;
     - en équipe, seuls comptent les clients attribués au technicien (ou
       non attribués).
   Aucune dépendance : testé avec Node dans Tests/.
   ============================================================= */

export function ajouterJours(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return t.getUTCFullYear() + "-" + String(t.getUTCMonth() + 1).padStart(2, "0") + "-" + String(t.getUTCDate()).padStart(2, "0");
}

/* Date et minute du jour à l'heure de Paris (heure d'été comprise). */
export function heureParis(maintenant) {
    const parties = new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(maintenant || new Date());
    const v = (type) => parties.find(p => p.type === type).value;
    const heure = Number(v("hour")) % 24;
    return { date: v("year") + "-" + v("month") + "-" + v("day"), minutes: heure * 60 + Number(v("minute")) };
}

export function minutesDe(hhmm) {
    const m = /^(\d{2}):(\d{2})$/.exec(hhmm || "");
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function estEnCampagne(client, iso) {
    const mois = Number(iso.split("-")[1]);
    const deb = client.debutCampagne || 5, fin = client.finCampagne || 11;
    return deb <= fin ? (mois >= deb && mois <= fin) : (mois >= deb || mois <= fin);
}

function debutCampagne(client, iso) {
    if (!estEnCampagne(client, iso)) return null;
    const [y, m] = iso.split("-").map(Number);
    const deb = client.debutCampagne || 5, fin = client.finCampagne || 11;
    const annee = (deb <= fin || m >= deb) ? y : y - 1;
    return annee + "-" + String(deb).padStart(2, "0") + "-01";
}

function ligneActive(l) {
    if (l.statut === "active" || l.statut === "inactive" || l.statut === "concurrent") return l.statut === "active";
    return l.suiviCampagne !== false;
}

/* donnees : { clients, lignes, visites, rdv } (contenus des éléments)
   userId  : compte du technicien, pour ne garder que ses clients. */
export function estClientDe(client, userId) {
    return !client.technicien || !userId || client.technicien === userId;
}

export function calculer(donnees, ref, userId) {
    const clients = donnees.clients || [], lignes = donnees.lignes || [], visites = donnees.visites || [], rdv = donnees.rdv || [];
    let aVoir = 0;
    clients.forEach(c => {
        if (c.actif === false || !estClientDe(c, userId)) return;
        const debut = debutCampagne(c, ref);
        if (!debut) return;
        lignes.filter(l => l.clientId === c.id && ligneActive(l)).forEach(l => {
            const derniere = visites.filter(v => (!v.statut || v.statut === "effectuee") && v.ligneId === l.id && v.type === "campagne" && v.date >= debut && v.date <= ref)
                .map(v => v.date).sort().pop();
            if (!derniere || ajouterJours(derniere, c.cadenceJours || 14) < ref) aVoir++;
        });
    });
    const nomClient = (id) => (clients.find(c => c.id === id) || {}).nom || "?";
    const confirmes = rdv.filter(r => r.statut !== "propose");
    const trier = (a, b) => (a.heure || "99:99").localeCompare(b.heure || "99:99");
    return {
        aVoir,
        proposes: rdv.filter(r => r.statut === "propose").length,
        aCloturer: confirmes.filter(r => r.date < ref).length,
        aujourdhui: confirmes.filter(r => r.date === ref).sort(trier).map(r => ({ id: r.id, client: nomClient(r.clientId), heure: r.heure || "", type: r.type })),
        demain: confirmes.filter(r => r.date === ajouterJours(ref, 1)).sort(trier).map(r => ({ client: nomClient(r.clientId), heure: r.heure || "" }))
    };
}

const LIBELLES_TYPES = {
    campagne: "Campagne", maintenance: "Maintenance / hiver", homologation: "Homologation", validation: "Validation",
    essai: "Essai interne", depannage: "Dépannage", "mise-en-route": "Mise en route", formation: "Formation",
    audit: "Audit", reunion: "Réunion", "reunion-fin": "Réunion de fin de campagne"
};

const pluriel = (n, mot, motPluriel) => n + " " + (n > 1 ? (motPluriel || mot + "s") : mot);
const liste = (rdvs) => rdvs.map(r => r.client + (r.heure ? " " + r.heure.replace(":", "h") : "")).join(", ");

/* Résumé du matin, ou null s'il n'y a rien à signaler. */
export function resumeDuMatin(calcul, prenom) {
    const lignes = [];
    if (calcul.aujourdhui.length) lignes.push("Aujourd'hui : " + liste(calcul.aujourdhui));
    if (calcul.demain.length) lignes.push("Demain : " + liste(calcul.demain));
    if (calcul.proposes) lignes.push(pluriel(calcul.proposes, "visite proposée") + " à confirmer");
    if (calcul.aCloturer) lignes.push(pluriel(calcul.aCloturer, "visite") + " à clôturer");
    if (calcul.aVoir) lignes.push(pluriel(calcul.aVoir, "ligne") + " en retard ou pas encore vue" + (calcul.aVoir > 1 ? "s" : ""));
    if (!lignes.length) return null;
    return { titre: "Bonjour" + (prenom ? " " + prenom : "") + " — ta journée", corps: lignes.join("\n"), url: "Index.html", tag: "resume" };
}

/* Rendez-vous d'aujourd'hui qui commencent dans 1 h (fenêtre de 75 min,
   la tâche passant toutes les 15 min). */
export function rappelsProches(calcul, minutesMaintenant) {
    return calcul.aujourdhui.filter(r => {
        const m = minutesDe(r.heure);
        return m !== null && m - minutesMaintenant > 0 && m - minutesMaintenant <= 75;
    }).map(r => ({
        id: r.id,
        titre: "Visite dans 1 h : " + r.client,
        corps: (LIBELLES_TYPES[r.type] || "Visite") + " · " + r.heure.replace(":", "h"),
        url: "Index.html", tag: "rdv-" + r.id
    }));
}

/* Le résumé part une fois par jour, entre l'heure choisie et 3 h après. */
export function heureDuResume(minutesMaintenant, heureRappel) {
    const cible = minutesDe(heureRappel) ?? minutesDe("07:30");
    return minutesMaintenant >= cible && minutesMaintenant < cible + 180;
}
