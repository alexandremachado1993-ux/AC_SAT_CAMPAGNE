-- Équipes : clients, contacts et lignes partagés entre les membres ;
-- visites, rendez-vous et profil restent dans public.elements (privés).

create table public.equipes (
    id       uuid        primary key default gen_random_uuid(),
    nom      text        not null check (char_length(nom) between 1 and 80),
    code     text        not null unique check (code ~ '^[A-Z2-9]{8}$'),
    cree_par uuid        not null default auth.uid() references auth.users (id) on delete cascade,
    cree_le  timestamptz not null default now()
);

create table public.membres (
    equipe_id   uuid        not null references public.equipes (id) on delete cascade,
    user_id     uuid        not null references auth.users (id) on delete cascade,
    role        text        not null check (role in ('proprietaire', 'membre')),
    nom_affiche text        not null default '' check (char_length(nom_affiche) <= 80),
    rejoint_le  timestamptz not null default now(),
    primary key (equipe_id, user_id),
    constraint membres_une_equipe_par_compte unique (user_id)
);

create table public.elements_equipe (
    equipe_id   uuid        not null references public.equipes (id) on delete cascade,
    collection  text        not null check (collection in ('clients', 'contacts', 'lignes')),
    id          text        not null check (char_length(id) between 1 and 100),
    contenu     jsonb,
    maj_client  timestamptz not null,
    maj_serveur timestamptz not null default clock_timestamp(),
    supprime    boolean     not null default false,
    modifie_par uuid        default auth.uid(),
    primary key (equipe_id, collection, id)
);

create index elements_equipe_maj_serveur on public.elements_equipe (equipe_id, maj_serveur);

comment on table public.equipes is 'AC SAT Campagne : équipes (un compte appartient à une équipe au plus).';
comment on table public.elements_equipe is 'AC SAT Campagne : clients, contacts et lignes partagés par les membres d''une équipe.';

-- Équipe du compte connecté (security definer : évite la récursion des règles RLS sur membres).
create or replace function public.mon_equipe()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select equipe_id from public.membres where user_id = (select auth.uid());
$$;

alter table public.equipes enable row level security;
alter table public.membres enable row level security;
alter table public.elements_equipe enable row level security;

create policy "equipes : lecture par les membres" on public.equipes
    for select to authenticated using (id = (select public.mon_equipe()));
create policy "membres : lecture par les membres" on public.membres
    for select to authenticated using (equipe_id = (select public.mon_equipe()));
create policy "elements_equipe : lecture par les membres" on public.elements_equipe
    for select to authenticated using (equipe_id = (select public.mon_equipe()));
create policy "elements_equipe : insertion par les membres" on public.elements_equipe
    for insert to authenticated with check (equipe_id = (select public.mon_equipe()));
create policy "elements_equipe : modification par les membres" on public.elements_equipe
    for update to authenticated using (equipe_id = (select public.mon_equipe())) with check (equipe_id = (select public.mon_equipe()));
-- Aucune insertion directe dans equipes / membres : uniquement via les fonctions ci-dessous.

-- Code d'invitation : 8 caractères sans ambiguïté (pas de 0/O ni 1/I), tirés de gen_random_uuid().
create or replace function public.generer_code_equipe()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
    alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    octets bytea := uuid_send(gen_random_uuid());
    resultat text := '';
begin
    for i in 0..7 loop
        resultat := resultat || substr(alphabet, 1 + (get_byte(octets, i) % 32), 1);
    end loop;
    return resultat;
end;
$$;

create or replace function public.creer_equipe(nom text, nom_affiche text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    moi uuid := (select auth.uid());
    nouvelle uuid;
    le_code text;
begin
    if moi is null then raise exception 'connexion requise'; end if;
    if exists (select 1 from public.membres m where m.user_id = moi) then
        raise exception 'deja_membre';
    end if;
    loop
        le_code := public.generer_code_equipe();
        exit when not exists (select 1 from public.equipes e where e.code = le_code);
    end loop;
    insert into public.equipes (nom, code, cree_par) values (trim(nom), le_code, moi) returning id into nouvelle;
    insert into public.membres (equipe_id, user_id, role, nom_affiche) values (nouvelle, moi, 'proprietaire', left(coalesce(trim(nom_affiche), ''), 80));
    return jsonb_build_object('id', nouvelle, 'code', le_code);
end;
$$;

create or replace function public.rejoindre_equipe(code text, nom_affiche text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    moi uuid := (select auth.uid());
    cible uuid;
begin
    if moi is null then raise exception 'connexion requise'; end if;
    if exists (select 1 from public.membres m where m.user_id = moi) then
        raise exception 'deja_membre';
    end if;
    select e.id into cible from public.equipes e where e.code = upper(trim(code));
    if cible is null then raise exception 'code_inconnu'; end if;
    insert into public.membres (equipe_id, user_id, role, nom_affiche) values (cible, moi, 'membre', left(coalesce(trim(nom_affiche), ''), 80));
    return jsonb_build_object('id', cible);
end;
$$;

create or replace function public.quitter_equipe()
returns void
language sql
security definer
set search_path = ''
as $$
    delete from public.membres where user_id = (select auth.uid());
$$;

-- Équipe du compte avec ses membres (null si aucune équipe).
create or replace function public.mon_equipe_details()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'id', e.id, 'nom', e.nom, 'code', e.code,
        'role', (select m.role from public.membres m where m.equipe_id = e.id and m.user_id = (select auth.uid())),
        'membres', coalesce((select jsonb_agg(jsonb_build_object('nom', m.nom_affiche, 'role', m.role, 'moi', m.user_id = (select auth.uid())) order by m.rejoint_le)
                             from public.membres m where m.equipe_id = e.id), '[]'::jsonb))
    from public.equipes e
    where e.id = (select public.mon_equipe());
$$;

-- Envoi groupé vers l'espace de l'équipe (même règle que pousser_elements :
-- la version la plus récente l'emporte). security invoker : RLS appliquée.
create or replace function public.pousser_elements_equipe(lot jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
    n integer;
    equipe uuid := (select public.mon_equipe());
begin
    if equipe is null then raise exception 'aucune_equipe'; end if;
    if jsonb_typeof(lot) <> 'array' or jsonb_array_length(lot) > 500 then
        raise exception 'lot invalide (tableau de 500 éléments maximum attendu)';
    end if;
    insert into public.elements_equipe (equipe_id, collection, id, contenu, maj_client, supprime, maj_serveur, modifie_par)
    select equipe, e ->> 'collection', e ->> 'id', e -> 'contenu', (e ->> 'maj_client')::timestamptz,
           coalesce((e ->> 'supprime')::boolean, false), clock_timestamp(), (select auth.uid())
    from jsonb_array_elements(lot) as e
    on conflict (equipe_id, collection, id) do update
        set contenu = excluded.contenu, maj_client = excluded.maj_client, supprime = excluded.supprime,
            maj_serveur = clock_timestamp(), modifie_par = excluded.modifie_par
        where public.elements_equipe.maj_client <= excluded.maj_client;
    get diagnostics n = row_count;
    return n;
end;
$$;

revoke execute on function public.mon_equipe() from public, anon;
revoke execute on function public.generer_code_equipe() from public, anon, authenticated;
revoke execute on function public.creer_equipe(text, text) from public, anon;
revoke execute on function public.rejoindre_equipe(text, text) from public, anon;
revoke execute on function public.quitter_equipe() from public, anon;
revoke execute on function public.mon_equipe_details() from public, anon;
revoke execute on function public.pousser_elements_equipe(jsonb) from public, anon;
grant execute on function public.mon_equipe() to authenticated;
grant execute on function public.creer_equipe(text, text) to authenticated;
grant execute on function public.rejoindre_equipe(text, text) to authenticated;
grant execute on function public.quitter_equipe() to authenticated;
grant execute on function public.mon_equipe_details() to authenticated;
grant execute on function public.pousser_elements_equipe(jsonb) to authenticated;
