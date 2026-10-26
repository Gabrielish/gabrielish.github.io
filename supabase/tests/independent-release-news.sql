-- Privileged integration session; all fixture changes are rolled back.
begin;
select set_config('bg3ro.test_release',(select id::text from public.bg3ro_releases
 where kind='translation' and published_at<=now() and not is_deleted limit 1),true);
select set_config('bg3ro.test_author',(select author_id::text from public.bg3ro_releases
 where id=current_setting('bg3ro.test_release')::uuid),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('bg3ro.test_author'),'role','authenticated')::text,true);
update public.bg3ro_releases set is_visible=false,news_is_visible=true
 where id=current_setting('bg3ro.test_release')::uuid;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ declare item jsonb; begin
 if exists(select 1 from public.bg3ro_releases where id=current_setting('bg3ro.test_release')::uuid) then raise exception 'Hidden download exposed';end if;
 select to_jsonb(n) into item from public.bg3ro_release_news() n where n.id=current_setting('bg3ro.test_release')::uuid;
 if item is null then raise exception 'Hidden download suppressed news';end if;
 if item ?| array['download_url','file_name','file_bytes','tags'] then raise exception 'Archive fields exposed in news';end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('bg3ro.test_author'),'role','authenticated')::text,true);
update public.bg3ro_releases set is_visible=true,news_is_visible=false
 where id=current_setting('bg3ro.test_release')::uuid;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ begin
 if not exists(select 1 from public.bg3ro_releases where id=current_setting('bg3ro.test_release')::uuid) then raise exception 'Visible download missing';end if;
 if exists(select 1 from public.bg3ro_release_news() where id=current_setting('bg3ro.test_release')::uuid) then raise exception 'Hidden news exposed';end if;
end $$;
rollback;
