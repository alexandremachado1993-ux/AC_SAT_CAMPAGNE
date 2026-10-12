-- Tâche planifiée : appelle la fonction « rappels » toutes les 15 minutes.
-- La fonction décide elle-même quoi envoyer (résumé du matin à l'heure de
-- chacun, rappel 1 h avant un rendez-vous) et n'envoie jamais deux fois.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
    'rappels-ac-sat-campagne',
    '*/15 * * * *',
    $$
    select net.http_post(
        url := 'https://btzqjbmfkzhdtltgtrob.supabase.co/functions/v1/rappels',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (select valeur from prive.config where cle = 'secret_cron')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000
    );
    $$
);
