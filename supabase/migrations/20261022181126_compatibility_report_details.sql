-- Optional public details for the existing one-report-per-member record.
alter table public.bg3ro_compatibility
 add column game_version text not null default '' check(char_length(game_version)<=80),
 add column problem_description text not null default '' check(char_length(problem_description)<=1000);
grant select(game_version,problem_description) on public.bg3ro_compatibility to anon;
grant insert(game_version,problem_description),update(game_version,problem_description) on public.bg3ro_compatibility to authenticated;
-- Keep owner/member RLS and the update cooldown unchanged. No user IDs exposed.
create or replace function public.bg3ro_sidebar_stats() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'rating_count',(select count(rating) from public.bg3ro_ratings),
  'rating_average',(select round(avg(rating),1) from public.bg3ro_ratings),
  'compatibility_count',(select count(works) from public.bg3ro_compatibility),
  'works_count',(select count(works) filter(where works) from public.bg3ro_compatibility),
  'last_update',greatest((select max(published_at) from public.bg3ro_project_updates),(select max(published_at) from public.bg3ro_releases)),
  'recent',coalesce((select jsonb_agg(to_jsonb(recent)) from (
   select works,author_name,platform,mod_version,game_version,
    case when works then '' else problem_description end as problem_description,updated_at
   from public.bg3ro_compatibility order by updated_at desc limit 10
  ) recent),'[]'::jsonb)
 );
$$;
notify pgrst,'reload schema';
