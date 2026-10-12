-- Migration appliquée le 06/10/2026 sur le projet Supabase « ac-sat-campagne » (déjà en place : ce fichier sert d'historique).
-- Testée avant application dans une transaction annulée (9 contrôles, dont le vrai chemin « rejoindre une équipe »).

-- 1. Rôle anonyme : aucun accès direct aux tables ni aux séquences (l'application n'utilise que des comptes connectés).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- 2. Journal des tentatives ratées de rejoindre une équipe (sans aucune règle d'accès : seule la fonction ci-dessous y touche).
create table if not exists public.tentatives_equipe (
    id bigint generated always as identity primary key,
    user_id uuid not null,
    at timestamptz not null default now()
);
alter table public.tentatives_equipe enable row level security;
revoke all on public.tentatives_equipe from anon, authenticated;
create index if not exists tentatives_equipe_user_at_idx on public.tentatives_equipe (user_id, at desc);

-- 3. Index manquant signalé par le linter Supabase.
create index if not exists equipes_cree_par_idx on public.equipes (cree_par);

-- 4. rejoindre_equipe :
--    a) CORRECTION d'un bug : le paramètre « code » et la colonne equipes.code étaient ambigus (erreur 42702 à chaque appel,
--       donc impossible de rejoindre une équipe) ; le paramètre est maintenant qualifié par le nom de la fonction ;
--    b) LIMITE de tentatives : 5 faux codes par compte et par 15 minutes, 100 au total par heure ;
--    c) un faux code est RENVOYÉ ({"erreur":"code_inconnu"}) au lieu d'être levé : une exception annulerait l'écriture de la tentative.
--       Le client (Synchro.js) transforme cette réponse en erreur.
create or replace function public.rejoindre_equipe(code text, nom_affiche text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
    moi uuid := (select auth.uid());
    cible uuid;
begin
    if moi is null then raise exception 'connexion requise'; end if;
    if exists (select 1 from public.membres m where m.user_id = moi) then
        raise exception 'deja_membre';
    end if;
    delete from public.tentatives_equipe where at < now() - interval '1 day';
    if (select count(*) from public.tentatives_equipe t where t.user_id = moi and t.at > now() - interval '15 minutes') >= 5
       or (select count(*) from public.tentatives_equipe t where t.at > now() - interval '1 hour') >= 100 then
        raise exception 'trop_de_tentatives';
    end if;
    select e.id into cible from public.equipes e where e.code = upper(trim(rejoindre_equipe.code));
    if cible is null then
        insert into public.tentatives_equipe (user_id) values (moi);
        return jsonb_build_object('erreur', 'code_inconnu');
    end if;
    insert into public.membres (equipe_id, user_id, role, nom_affiche) values (cible, moi, 'membre', left(coalesce(trim(nom_affiche), ''), 80));
    return jsonb_build_object('id', cible);
end;
$$;
