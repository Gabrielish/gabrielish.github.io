-- Hosted setup, kept separate because local PGlite has no pg_cron/pg_net.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
  if exists(select 1 from cron.job where jobname='bg3ro-nexus-daily') then
    perform cron.unschedule('bg3ro-nexus-daily');
  end if;
end $$;
select cron.schedule('bg3ro-nexus-daily','15 3 * * *',$job$
  select net.http_post(
    url:='https://gatkiwcyjgbgjwfgvplm.supabase.co/functions/v1/bg3ro-statistics',
    headers:='{"Content-Type":"application/json","apikey":"sb_publishable_8wgqYScl0lmXs3-x0feaIw_4z7kr4bd"}'::jsonb,
    body:='{"action":"sync"}'::jsonb,
    timeout_milliseconds:=25000
  );
$job$);
