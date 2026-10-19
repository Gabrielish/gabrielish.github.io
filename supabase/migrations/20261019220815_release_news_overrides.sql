begin;
-- Announcement overrides are independent of archive metadata and publication time.
alter table public.bg3ro_releases
 add column news_title text check(news_title is null or length(btrim(news_title)) between 1 and 160),
 add column news_body text check(news_body is null or length(btrim(news_body)) between 1 and 12000),
 add column news_badge text check(news_badge is null or length(news_badge)<=80);
grant select(news_title,news_body,news_badge) on public.bg3ro_releases to anon,authenticated;
grant update(news_title,news_body,news_badge) on public.bg3ro_releases to authenticated;
notify pgrst,'reload schema';
commit;
