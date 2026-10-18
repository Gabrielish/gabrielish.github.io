alter table public.bg3ro_download_statistics add column site_views bigint not null default 0 check(site_views>=0);
create table bg3ro_private.view_windows (
  fingerprint text not null,
  window_start timestamptz not null,
  primary key(fingerprint,window_start)
);
alter table bg3ro_private.view_windows enable row level security;
revoke all on bg3ro_private.view_windows from public,anon,authenticated;
grant all on bg3ro_private.view_windows to service_role;
grant select(user_id) on bg3ro_private.moderators to service_role;
create function public.bg3ro_record_view(p_fingerprint text,p_user_id uuid default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare added integer;
begin
  -- p_user_id comes only from Edge Auth validation, never from browser JSON.
  if p_user_id is not null and exists(select 1 from bg3ro_private.moderators where user_id=p_user_id) then return false; end if;
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid fingerprint'; end if;
  insert into bg3ro_private.view_windows values(p_fingerprint,date_trunc('hour',now())+case when extract(minute from now())>=30 then interval '30 minutes' else interval '0 minutes' end)
  on conflict do nothing;
  get diagnostics added=row_count;
  if added=1 then update public.bg3ro_download_statistics set site_views=site_views+1 where id=1; end if;
  return added=1;
end $$;
revoke all on function public.bg3ro_record_view(text,uuid) from public,anon,authenticated;
grant execute on function public.bg3ro_record_view(text,uuid) to service_role;
create or replace function public.bg3ro_claim_nexus_sync()
returns boolean language plpgsql security invoker set search_path='' as $$
declare claimed integer;
begin
  update public.bg3ro_download_statistics set sync_attempt_at=now()
  where id=1 and (sync_attempt_at is null or sync_attempt_at<now()-interval '23 hours');
  get diagnostics claimed=row_count;
  if claimed=1 then
    delete from bg3ro_private.download_windows where window_start<now()-interval '2 days';
    delete from bg3ro_private.view_windows where window_start<now()-interval '2 days';
  end if;
  return claimed=1;
end $$;
