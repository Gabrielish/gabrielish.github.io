-- Only the server may supply an Auth-verified user identity.
drop function public.bg3ro_record_download(uuid,text);
create function public.bg3ro_record_download(p_release_id uuid,p_fingerprint text,p_user_id uuid default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare added integer;
begin
  if p_user_id is not null and exists(select 1 from bg3ro_private.moderators where user_id=p_user_id) then return false; end if;
  if p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid fingerprint'; end if;
  if not exists(select 1 from public.bg3ro_releases where id=p_release_id) then return false; end if;
  insert into bg3ro_private.download_windows values(p_fingerprint,p_release_id,date_trunc('hour',now())) on conflict do nothing;
  get diagnostics added=row_count;
  if added=1 then update public.bg3ro_download_statistics set site_downloads=site_downloads+1 where id=1; end if;
  return added=1;
end $$;
revoke all on function public.bg3ro_record_download(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.bg3ro_record_download(uuid,text,uuid) to service_role;
