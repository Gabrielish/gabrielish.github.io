begin;
select set_config('request.jwt.claim.sub',(select user_id::text from bg3ro_private.moderators limit 1),true);
insert into public.bg3ro_releases(author_id,kind,version,title,file_name,file_bytes,download_url,description)
select id,'translation','statistics-test','Test','test.zip',1,
'https://github.com/Gabrielish/bg3ro/releases/download/test/test.zip','Test'
from auth.users where id=auth.uid();
select set_config('test.release_id',(select id::text from public.bg3ro_releases where version='statistics-test'),true);
update public.bg3ro_download_statistics set site_downloads=0,sync_attempt_at=null where id=1;
set local role anon;
select * from public.bg3ro_download_statistics;
do $$ begin
  begin perform public.bg3ro_claim_nexus_sync(); raise exception 'Anonymous sync permitted';
  exception when insufficient_privilege then null; end;
  begin update public.bg3ro_download_statistics set site_downloads=999;
  raise exception 'Anonymous write permitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin perform public.bg3ro_record_download('11111111-1111-1111-1111-111111111111',repeat('a',64));
  raise exception 'Authenticated counter write permitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ declare release uuid; begin
  release:=current_setting('test.release_id')::uuid;
  if not public.bg3ro_record_download(release,repeat('a',64)) then raise exception 'First download not counted'; end if;
  if public.bg3ro_record_download(release,repeat('a',64)) then raise exception 'Duplicate counted'; end if;
  if public.bg3ro_record_download('11111111-1111-1111-1111-111111111111',repeat('a',64)) then raise exception 'Unknown release counted'; end if;
  if (select site_downloads from public.bg3ro_download_statistics where id=1)<>1 then raise exception 'Incorrect total'; end if;
  if not public.bg3ro_claim_nexus_sync() then raise exception 'First sync not claimed'; end if;
  if public.bg3ro_claim_nexus_sync() then raise exception 'Sync rate limit failed'; end if;
end $$;
rollback;
