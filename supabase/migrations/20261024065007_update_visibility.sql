-- Keep update announcements independently visible from downloadable archives.
begin;
alter table public.bg3ro_project_updates add column is_visible boolean not null default true;
grant select(is_visible),update(is_visible) on public.bg3ro_project_updates to authenticated;
drop policy bg3ro_updates_public on public.bg3ro_project_updates;
create policy bg3ro_updates_public_read on public.bg3ro_project_updates for select to anon using(published_at<=now() and is_visible);
create policy bg3ro_updates_member_read on public.bg3ro_project_updates for select to authenticated
 using((published_at<=now() and is_visible) or ((select public.bg3ro_is_moderator()) and author_id=(select auth.uid())));
-- Release announcements have visibility independent from their download cards.
alter table public.bg3ro_releases add column news_is_visible boolean not null default true;
grant select(news_is_visible) on public.bg3ro_releases to anon,authenticated;
grant update(news_is_visible) on public.bg3ro_releases to authenticated;
notify pgrst,'reload schema';
commit;
