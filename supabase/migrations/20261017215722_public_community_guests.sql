begin;
-- Previously submitted private reports remain private. Only informed new submissions opt in.
alter table public.bg3ro_bug_reports add column is_public boolean not null default false;
alter table public.bg3ro_bug_reports add column author_name text not null default 'Jucător' check (char_length(btrim(author_name)) between 2 and 40);
alter table public.bg3ro_bug_reports add column is_guest boolean not null default false;
alter table public.bg3ro_discussion_posts add column is_guest boolean not null default false;
create index bg3ro_reports_public_recent on public.bg3ro_bug_reports(created_at desc) where is_public;
grant select(id,title,body,category,platform,mod_version,game_version,status,moderator_reply,created_at,is_public,author_name,is_guest) on public.bg3ro_bug_reports to anon;
grant insert(is_public,author_name) on public.bg3ro_bug_reports to authenticated;
create policy bg3ro_reports_public on public.bg3ro_bug_reports for select to anon using (is_public);
alter policy bg3ro_reports_read on public.bg3ro_bug_reports using (is_public or author_id=(select auth.uid()) or (select public.bg3ro_is_moderator()));
-- Anonymous Auth sessions use the authenticated role. Deny rating/vote access explicitly.
create policy ratings_members_only on public.bg3ro_ratings as restrictive for all to authenticated
 using (not coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false))
 with check (not coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false));
create policy compatibility_members_only on public.bg3ro_compatibility as restrictive for all to authenticated
 using (not coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false))
 with check (not coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false));
create or replace function bg3ro_private.check_submission() returns trigger
language plpgsql security definer set search_path = '' as $$
declare limits bg3ro_private.submission_limits; parent_status text; parent_parent uuid;
begin
  if auth.uid() is null or new.author_id <> auth.uid() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  new.is_guest := coalesce((auth.jwt()->>'is_anonymous')::boolean,false);
  if not public.bg3ro_is_moderator() then
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || tg_table_name, 0));
    select * into limits from bg3ro_private.submission_limits where user_id = auth.uid() and kind = tg_table_name;
    if limits.last_sent > now() - interval '30 seconds' then raise exception 'Așteaptă 30 de secunde.'; end if;
    if limits.window_started > now() - interval '1 day' and limits.submissions >= (case when new.is_guest then 5 else 20 end) then raise exception 'Ai atins limita zilnică.'; end if;
    insert into bg3ro_private.submission_limits(user_id,kind,last_sent,window_started,submissions)
      values(auth.uid(),tg_table_name,now(),now(),1)
      on conflict(user_id,kind) do update set last_sent = now(),
        window_started = case when submission_limits.window_started <= now() - interval '1 day' then now() else submission_limits.window_started end,
        submissions = case when submission_limits.window_started <= now() - interval '1 day' then 1 else submission_limits.submissions + 1 end;
    if tg_table_name <> 'bg3ro_discussion_posts' then new.status := 'new'; new.moderator_reply := ''; end if;
  end if;
  new.created_at := now();
  if tg_table_name = 'bg3ro_discussion_posts' then
    new.status := 'approved';
    if new.parent_id is not null then
      select status,parent_id into parent_status,parent_parent from public.bg3ro_discussion_posts where id = new.parent_id;
      if parent_status is distinct from 'approved' or parent_parent is not null then
        raise exception 'Reply must belong to an approved root discussion';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function bg3ro_private.check_submission() from public, anon, authenticated;

notify pgrst,'reload schema';
commit;
