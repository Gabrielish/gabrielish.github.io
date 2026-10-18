-- Cached external totals: views are the owner's last supplied snapshot, NOT API data.
create table public.bg3ro_download_statistics (
  id integer primary key check (id=1),
  nexus_downloads bigint not null check(nexus_downloads>=0),
  nexus_views bigint not null check(nexus_views>=0),
  downloads_synced_at timestamptz,
  views_observed_at date not null,
  sync_attempt_at timestamptz,
  sync_ok boolean not null default false,
  site_downloads bigint not null default 0 check(site_downloads>=0)
);
insert into public.bg3ro_download_statistics(id,nexus_downloads,nexus_views,views_observed_at)
values(1,23,906,'2026-10-18');
alter table public.bg3ro_download_statistics enable row level security;
revoke all on public.bg3ro_download_statistics from anon,authenticated;
grant select on public.bg3ro_download_statistics to anon,authenticated;
grant all on public.bg3ro_download_statistics to service_role;
grant select(id) on public.bg3ro_releases to service_role;
create policy statistics_public_read on public.bg3ro_download_statistics for select to anon,authenticated using(true);

-- Rotating, irreversible network fingerprints; never raw IP addresses.
create table bg3ro_private.download_windows (
  fingerprint text not null,
  release_id uuid not null references public.bg3ro_releases(id) on delete cascade,
  window_start timestamptz not null,
  primary key(fingerprint,release_id,window_start)
);
alter table bg3ro_private.download_windows enable row level security;
revoke all on bg3ro_private.download_windows from public,anon,authenticated;
grant usage on schema bg3ro_private to service_role;
grant all on bg3ro_private.download_windows to service_role;

-- Service-only invoker RPCs. Browser roles cannot call these or set totals.
create function public.bg3ro_record_download(p_release_id uuid,p_fingerprint text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare added integer;
begin
  if p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid fingerprint'; end if;
  if not exists(select 1 from public.bg3ro_releases where id=p_release_id) then return false; end if;
  insert into bg3ro_private.download_windows values(p_fingerprint,p_release_id,date_trunc('hour',now())) on conflict do nothing;
  get diagnostics added=row_count;
  if added=1 then
    update public.bg3ro_download_statistics set site_downloads=site_downloads+1 where id=1;
  end if;
  return added=1;
end $$;
create function public.bg3ro_claim_nexus_sync()
returns boolean language plpgsql security invoker set search_path='' as $$
declare claimed integer;
begin
  update public.bg3ro_download_statistics set sync_attempt_at=now()
  where id=1 and (sync_attempt_at is null or sync_attempt_at<now()-interval '23 hours');
  get diagnostics claimed=row_count;
  if claimed=1 then delete from bg3ro_private.download_windows where window_start<now()-interval '2 days'; end if;
  return claimed=1;
end $$;
revoke all on function public.bg3ro_record_download(uuid,text),public.bg3ro_claim_nexus_sync() from public,anon,authenticated;
grant execute on function public.bg3ro_record_download(uuid,text),public.bg3ro_claim_nexus_sync() to service_role;
