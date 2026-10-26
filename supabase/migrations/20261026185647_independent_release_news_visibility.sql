-- Public announcement projection deliberately bypasses download-row RLS.
-- Only announcement/profile fields are returned; archive URLs and file metadata
-- remain protected by the existing download policies.
create or replace function public.bg3ro_release_news()
returns table(
 id uuid,author_id uuid,author_name text,author_avatar_url text,
 version text,title text,description text,published_at timestamptz,
 news_title text,news_body text,news_badge text,news_is_visible boolean
)
language sql stable security definer set search_path=''
as $$
 select r.id,r.author_id,r.author_name,r.author_avatar_url,
 r.version,coalesce(r.news_title,r.title),coalesce(r.news_body,r.description),r.published_at,
 r.news_title,r.news_body,r.news_badge,r.news_is_visible
 from public.bg3ro_releases r
 where r.kind='translation' and not r.is_deleted
 and ((r.published_at<=now() and r.news_is_visible)
      or ((select public.bg3ro_is_moderator()) and r.author_id=(select auth.uid())))
 order by r.published_at desc,r.id desc limit 100;
$$;
revoke all on function public.bg3ro_release_news() from public;
grant execute on function public.bg3ro_release_news() to anon,authenticated;
notify pgrst,'reload schema';
