-- Stockage de synchronisation d'AC SAT Campagne.
-- Un enregistrement par élément (client, contact, ligne, visite, rendez-vous, profil),
-- privé à son propriétaire. Les suppressions sont des marqueurs (supprime = true)
-- pour qu'elles se propagent aux autres appareils.
create table public.elements (
    user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
    collection  text        not null,
    id          text        not null check (char_length(id) between 1 and 100),
    contenu     jsonb,
    maj_client  timestamptz not null,
    maj_serveur timestamptz not null default clock_timestamp(),
    supprime    boolean     not null default false,
    primary key (user_id, collection, id),
    constraint elements_collection_check
        check (collection in ('clients', 'contacts', 'lignes', 'visites', 'rdv', 'profil'))
);

comment on table public.elements is 'AC SAT Campagne : éléments synchronisés entre appareils (un propriétaire par ligne).';

create index elements_user_maj_serveur on public.elements (user_id, maj_serveur);

alter table public.elements enable row level security;

create policy "elements : lecture par le propriétaire" on public.elements
    for select to authenticated using (user_id = (select auth.uid()));
create policy "elements : insertion par le propriétaire" on public.elements
    for insert to authenticated with check (user_id = (select auth.uid()));
create policy "elements : modification par le propriétaire" on public.elements
    for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Pas de politique DELETE : on ne supprime jamais physiquement depuis l'application.

-- Envoi groupé : n'écrase un élément que si la version envoyée est au moins
-- aussi récente que celle déjà en base (la plus récente l'emporte).
-- security invoker : les règles RLS ci-dessus s'appliquent.
create or replace function public.pousser_elements(lot jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
    n integer;
begin
    if jsonb_typeof(lot) <> 'array' or jsonb_array_length(lot) > 500 then
        raise exception 'lot invalide (tableau de 500 éléments maximum attendu)';
    end if;

    insert into public.elements (user_id, collection, id, contenu, maj_client, supprime, maj_serveur)
    select (select auth.uid()),
           e ->> 'collection',
           e ->> 'id',
           e -> 'contenu',
           (e ->> 'maj_client')::timestamptz,
           coalesce((e ->> 'supprime')::boolean, false),
           clock_timestamp()
    from jsonb_array_elements(lot) as e
    on conflict (user_id, collection, id) do update
        set contenu     = excluded.contenu,
            maj_client  = excluded.maj_client,
            supprime    = excluded.supprime,
            maj_serveur = clock_timestamp()
        where public.elements.maj_client <= excluded.maj_client;

    get diagnostics n = row_count;
    return n;
end;
$$;

revoke execute on function public.pousser_elements(jsonb) from public, anon;
grant execute on function public.pousser_elements(jsonb) to authenticated;
