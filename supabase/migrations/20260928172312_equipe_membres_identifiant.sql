-- Les membres d'une équipe sont renvoyés avec leur identifiant : il sert à
-- attribuer un client à un technicien (champ « technicien » du client).
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
        'membres', coalesce((select jsonb_agg(jsonb_build_object('id', m.user_id, 'nom', m.nom_affiche, 'role', m.role, 'moi', m.user_id = (select auth.uid())) order by m.rejoint_le)
                             from public.membres m where m.equipe_id = e.id), '[]'::jsonb))
    from public.equipes e
    where e.id = (select public.mon_equipe());
$$;
