/* Faux serveur Supabase en mémoire (même logique que la base : « la modification la plus récente gagne », horloge serveur, espace
   personnel + espace d'équipe). Partagé par les tests de synchronisation. serveur.panne.tirer / .pousser = message d'erreur à lever. */
function serveur() {
  let horloge = Date.parse("2026-09-25T10:00:00Z");
  const perso = {}, equipes = {}, membres = {}, rowsEquipe = {};
  const codes = {};
  const tick = () => new Date(++horloge).toISOString();
  function upsert(store, e) {
    const cle = e.collection + ":" + e.id, ex = store.get(cle);
    if (!ex || Date.parse(ex.maj_client) <= Date.parse(e.maj_client))
      store.set(cle, { collection: e.collection, id: e.id, contenu: JSON.parse(JSON.stringify(e.contenu)), maj_client: e.maj_client, supprime: !!e.supprime, maj_serveur: tick() });
  }
  function lire(store, depuis, strict) {
    return [...store.values()].filter(r => !depuis || (strict ? Date.parse(r.maj_serveur) > Date.parse(depuis) : Date.parse(r.maj_serveur) >= Date.parse(depuis)))
      .sort((a, b) => Date.parse(a.maj_serveur) - Date.parse(b.maj_serveur)).slice(0, 1000).map(r => JSON.parse(JSON.stringify(r)));
  }
  let n = 0;
  const panne = { tirer: null, pousser: null };      // message d'erreur à lever pour simuler une panne du serveur
  return {
    perso, rowsEquipe, membres, panne,
    transport(user) {
      perso[user] = perso[user] || new Map();
      return {
        utilisateur: async () => user,
        connexion: async () => {}, inscription: async () => ({}), deconnexion: async () => {},
        tirer: async (depuis, strict, equipe) => {
          if (panne.tirer) throw new Error(panne.tirer);
          if (equipe) { if (membres[user] !== equipe) throw new Error("rls"); return lire(rowsEquipe[equipe], depuis, strict); }
          return lire(perso[user], depuis, strict);
        },
        pousser: async (lot, versEquipe) => {
          if (panne.pousser) throw new Error(panne.pousser);
          if (versEquipe) {
            const eq = membres[user]; if (!eq) throw new Error("aucune_equipe");
            lot.forEach(e => { if (["clients", "contacts", "lignes"].indexOf(e.collection) === -1) throw new Error("collection interdite en équipe"); upsert(rowsEquipe[eq], e); });
          } else lot.forEach(e => upsert(perso[user], e));
        },
        monEquipe: async () => {
          const eq = membres[user]; if (!eq) return null;
          const q = equipes[eq];
          return { id: eq, nom: q.nom, code: q.code, role: q.proprio === user ? "proprietaire" : "membre",
            membres: Object.keys(membres).filter(u => membres[u] === eq).map(u => ({ nom: q.noms[u], role: q.proprio === u ? "proprietaire" : "membre", moi: u === user })) };
        },
        creerEquipe: async (nom, nomAffiche) => {
          if (membres[user]) throw new Error("deja_membre");
          const id = "eq" + (++n), code = "K7PM2XQ" + "ABCDEFGH"[n];
          equipes[id] = { nom, code, proprio: user, noms: { [user]: nomAffiche } }; codes[code] = id; membres[user] = id; rowsEquipe[id] = new Map();
          return { id, code };
        },
        rejoindreEquipe: async (code, nomAffiche) => {
          if (membres[user]) throw new Error("deja_membre");
          const id = codes[code]; if (!id) throw new Error("code_inconnu");
          membres[user] = id; equipes[id].noms[user] = nomAffiche; return { id };
        },
        quitterEquipe: async () => { delete membres[user]; }
      };
    }
  };
}

module.exports = serveur;
