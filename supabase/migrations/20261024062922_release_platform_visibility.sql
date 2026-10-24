-- Hosted migration version: 20261024062922.
begin;
alter table public.bg3ro_releases
 add column platform text not null default 'all' check(platform in ('all','windows','macos')),
 add column is_visible boolean not null default true,
 add column is_deleted boolean not null default false;
-- Preserve existing archive URLs, file metadata, dates and descriptions.
-- DDL holds the table lock until commit. Suspend only the avatar trigger for
-- this metadata backfill, then restore it before any application write resumes.
alter table public.bg3ro_releases disable trigger bg3ro_release_avatar;
update public.bg3ro_releases set platform=case
 when tags ~* 'windows' and tags !~* '(macos|mac os|macOS)' then 'windows'
 when tags ~* '(macos|mac os)' and tags !~* 'windows' then 'macos'
 else 'all' end;
alter table public.bg3ro_releases enable trigger bg3ro_release_avatar;
alter table public.bg3ro_releases drop constraint bg3ro_releases_kind_version_key;
create unique index bg3ro_releases_active_kind_version_platform on public.bg3ro_releases(kind,version,platform) where not is_deleted;
grant select(platform,is_visible,is_deleted) on public.bg3ro_releases to anon,authenticated;
grant insert(platform,is_visible),update(platform,is_visible,is_deleted) on public.bg3ro_releases to authenticated;
drop policy bg3ro_releases_read on public.bg3ro_releases;
create policy bg3ro_releases_public_read on public.bg3ro_releases for select to anon
 using(published_at<=now() and is_visible and not is_deleted);
create policy bg3ro_releases_member_read on public.bg3ro_releases for select to authenticated
 using((published_at<=now() and is_visible and not is_deleted) or ((select public.bg3ro_is_moderator()) and author_id=(select auth.uid())));
notify pgrst,'reload schema';
commit;
