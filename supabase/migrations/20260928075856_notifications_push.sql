-- Notifications push : abonnements des appareils, journal des envois,
-- configuration privée (clés VAPID, secret de la tâche planifiée).

create schema if not exists prive;
revoke all on schema prive from public, anon, authenticated;

create table prive.config (
    cle    text primary key,
    valeur text not null
);
alter table prive.config enable row level security;

insert into prive.config (cle, valeur) values
    ('vapid_public',  'BKvxrDcmbxe7O3kARZGcu2_XcsOCLpIKjz-DHo7iOaVs1qmGOJMufxC3-UNZXCyt-Q-5Dx2A_-DduUVzLJGfvwY'),
    ('vapid_private', 'A_RENSEIGNER__CLE_PRIVEE_VAPID'),
    ('vapid_subject', 'https://ac-sat-campagne.netlify.app'),
    ('secret_cron',   'A_RENSEIGNER__SECRET_ALEATOIRE');

-- Un appareil (navigateur) = un abonnement, rattaché au compte connecté.
create table public.push_abonnements (
    endpoint  text        primary key check (char_length(endpoint) between 10 and 2000),
    user_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
    p256dh    text        not null check (char_length(p256dh) between 10 and 200),
    auth      text        not null check (char_length(auth) between 8 and 100),
    appareil  text        not null default '' check (char_length(appareil) <= 120),
    cree_le   timestamptz not null default now()
);
create index push_abonnements_user on public.push_abonnements (user_id);
alter table public.push_abonnements enable row level security;
create policy "push_abonnements : lecture par le propriétaire" on public.push_abonnements
    for select to authenticated using (user_id = (select auth.uid()));
create policy "push_abonnements : suppression par le propriétaire" on public.push_abonnements
    for delete to authenticated using (user_id = (select auth.uid()));

-- Journal : une notification donnée n'est envoyée qu'une fois (résumé du jour, rappel 1 h avant…).
create table public.notifications_journal (
    user_id   uuid        not null references auth.users (id) on delete cascade,
    cle       text        not null,
    envoye_le timestamptz not null default now(),
    primary key (user_id, cle)
);
alter table public.notifications_journal enable row level security;
-- Aucune règle : réservé au serveur (clé de service).

-- Enregistrer l'appareil courant. security definer : si le même navigateur
-- était abonné pour un autre compte, il passe au compte connecté.
create or replace function public.enregistrer_abonnement(p_endpoint text, p_p256dh text, p_auth text, p_appareil text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    moi uuid := (select auth.uid());
begin
    if moi is null then raise exception 'connexion requise'; end if;
    insert into public.push_abonnements as a (endpoint, user_id, p256dh, auth, appareil)
    values (p_endpoint, moi, p_p256dh, p_auth, left(coalesce(p_appareil, ''), 120))
    on conflict (endpoint) do update
        set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
            appareil = excluded.appareil, cree_le = now();
end;
$$;

-- Configuration lue par la fonction serveur uniquement (clé de service).
create or replace function public.config_push()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_object_agg(cle, valeur) from prive.config;
$$;

revoke execute on function public.enregistrer_abonnement(text, text, text, text) from public, anon;
grant execute on function public.enregistrer_abonnement(text, text, text, text) to authenticated;
revoke execute on function public.config_push() from public, anon, authenticated;
grant execute on function public.config_push() to service_role;
