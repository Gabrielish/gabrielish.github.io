begin;
update public.bg3ro_download_statistics set site_views=0 where id=1;
delete from bg3ro_private.view_windows;
select set_config('test.moderator_id',(select user_id::text from bg3ro_private.moderators limit 1),true);
set local role anon;
do $$ begin
  begin perform public.bg3ro_record_view(repeat('b',64),null); raise exception 'Public RPC writable';
  exception when insufficient_privilege then null; end;
  begin select * from bg3ro_private.view_windows; raise exception 'Fingerprints exposed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ begin
  if public.bg3ro_record_view(repeat('a',64),current_setting('test.moderator_id')::uuid) then raise exception 'Moderator counted'; end if;
  if (select site_views from public.bg3ro_download_statistics where id=1)<>0 then raise exception 'Admin total changed'; end if;
  if not public.bg3ro_record_view(repeat('b',64),null) then raise exception 'Guest not counted'; end if;
  if public.bg3ro_record_view(repeat('b',64),null) then raise exception 'Duplicate counted'; end if;
  if not public.bg3ro_record_view(repeat('c',64),null) then raise exception 'Second visitor not counted'; end if;
  if (select site_views from public.bg3ro_download_statistics where id=1)<>2 then raise exception 'Incorrect views total'; end if;
end $$;
rollback;
