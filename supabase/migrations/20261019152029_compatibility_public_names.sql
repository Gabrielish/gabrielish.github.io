begin;
alter table public.bg3ro_compatibility add column author_name text not null default 'Utilizator' check(char_length(author_name) between 1 and 40);
-- Backfill only the public Discord display name; never the email or account UUID.
alter table public.bg3ro_compatibility disable trigger bg3ro_compatibility_guard;
update public.bg3ro_compatibility c set author_name=case when n.value like '%@%' then 'Utilizator' else n.value end
from (select id,left(coalesce(nullif(btrim(regexp_replace(coalesce(
  nullif(raw_user_meta_data->>'preferred_username',''),nullif(raw_user_meta_data->>'user_name',''),
  nullif(raw_user_meta_data->>'full_name',''),raw_user_meta_data->>'name',''), '[[:cntrl:]]','','g')),''),'Utilizator'),40) as value from auth.users) n
where c.user_id=n.id;
alter table public.bg3ro_compatibility enable trigger bg3ro_compatibility_guard;
create function bg3ro_private.set_compatibility_name() returns trigger language plpgsql security invoker set search_path='' as $$
declare metadata jsonb:=(select auth.jwt())->'user_metadata';
begin
  -- Metadata is display-only, not authorization. Existing owner/member RLS is unchanged.
  new.author_name:=left(coalesce(nullif(btrim(regexp_replace(coalesce(
    nullif(metadata->>'preferred_username',''),nullif(metadata->>'user_name',''),
    nullif(metadata->>'full_name',''),metadata->>'name',''), '[[:cntrl:]]','','g')),''),'Utilizator'),40);
  if new.author_name like '%@%' then new.author_name:='Utilizator'; end if;
  return new;
end $$;
revoke all on function bg3ro_private.set_compatibility_name() from public,anon,authenticated;
create trigger bg3ro_compatibility_name before insert or update on public.bg3ro_compatibility for each row execute function bg3ro_private.set_compatibility_name();
grant select(author_name) on public.bg3ro_compatibility to anon;
create or replace function public.bg3ro_sidebar_stats() returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'rating_count',(select count(rating) from public.bg3ro_ratings),
    'rating_average',(select round(avg(rating),1) from public.bg3ro_ratings),
    'compatibility_count',(select count(works) from public.bg3ro_compatibility),
    'works_count',(select count(works) filter(where works) from public.bg3ro_compatibility),
    'last_update',greatest((select max(published_at) from public.bg3ro_project_updates),(select max(published_at) from public.bg3ro_releases)),
    'recent',coalesce((select jsonb_agg(to_jsonb(recent)) from (select works,author_name,platform,mod_version,updated_at from public.bg3ro_compatibility order by updated_at desc limit 10) recent),'[]'::jsonb)
  );
$$;
notify pgrst,'reload schema';
commit;
