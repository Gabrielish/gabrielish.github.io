-- A report can have many community replies. Keep legacy moderator_reply intact.
create table public.bg3ro_report_replies (
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references public.bg3ro_bug_reports(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check (char_length(btrim(body)) between 10 and 4000),
 author_name text not null check (char_length(btrim(author_name)) between 2 and 40),
 author_avatar_url text,
 author_profile_id uuid references public.bg3ro_profiles(id) on delete set null,
 author_is_admin boolean not null default false,
 is_guest boolean not null default false,
 created_at timestamptz not null default now()
);
create index bg3ro_report_replies_thread_idx on public.bg3ro_report_replies(report_id,created_at,id);
create index bg3ro_report_replies_author_idx on public.bg3ro_report_replies(author_id);
create index bg3ro_report_replies_profile_idx on public.bg3ro_report_replies(author_profile_id);
alter table public.bg3ro_report_replies enable row level security;
revoke all on public.bg3ro_report_replies from public,anon,authenticated;
grant select(id,report_id,body,author_name,author_avatar_url,author_profile_id,author_is_admin,is_guest,created_at)
 on public.bg3ro_report_replies to anon,authenticated;
grant select(author_id),insert(report_id,author_id,author_name,body),update(body),delete
 on public.bg3ro_report_replies to authenticated;

create policy report_replies_public_read on public.bg3ro_report_replies for select to anon
 using (exists(select 1 from public.bg3ro_bug_reports r where r.id=report_id and r.is_public));
create policy report_replies_member_read on public.bg3ro_report_replies for select to authenticated
 using (exists(select 1 from public.bg3ro_bug_reports r where r.id=report_id
  and (r.is_public or r.author_id=(select auth.uid()) or (select public.bg3ro_is_moderator()))));
create policy report_replies_add on public.bg3ro_report_replies for insert to authenticated
 with check (author_id=(select auth.uid()) and exists(select 1 from public.bg3ro_bug_reports r
  where r.id=report_id and (r.is_public or r.author_id=(select auth.uid()) or (select public.bg3ro_is_moderator()))));
create policy report_replies_edit on public.bg3ro_report_replies for update to authenticated
 using (author_id=(select auth.uid()) or (select public.bg3ro_is_moderator()))
 with check (author_id=(select auth.uid()) or (select public.bg3ro_is_moderator()));
create policy report_replies_remove on public.bg3ro_report_replies for delete to authenticated
 using (author_id=(select auth.uid()) or (select public.bg3ro_is_moderator()));

create function bg3ro_private.prepare_report_reply()
returns trigger language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); is_admin boolean:=public.bg3ro_is_moderator();
 account auth.users%rowtype; profile public.bg3ro_profiles%rowtype;
 quota bg3ro_private.submission_limits%rowtype; parent public.bg3ro_bug_reports%rowtype;
begin
 if actor is null then raise exception 'Session required' using errcode='42501';end if;
 if tg_op='UPDATE' then
  if actor<>old.author_id and not is_admin then raise exception 'Not your reply' using errcode='42501';end if;
  -- Changing the body never transfers the original authorship or administrator styling.
  new.id:=old.id;new.report_id:=old.report_id;new.author_id:=old.author_id;
  new.created_at:=old.created_at;new.author_name:=old.author_name;
  new.author_avatar_url:=old.author_avatar_url;new.author_profile_id:=old.author_profile_id;
  new.author_is_admin:=old.author_is_admin;new.is_guest:=old.is_guest;
  return new;
 end if;
 if new.author_id<>actor then raise exception 'Invalid author' using errcode='42501';end if;
 select * into parent from public.bg3ro_bug_reports where id=new.report_id;
 if not found or not (parent.is_public or parent.author_id=actor or is_admin) then
  raise exception 'Report unavailable' using errcode='42501';
 end if;
 select * into account from auth.users where id=actor;
 if not found then raise exception 'Session unavailable' using errcode='42501';end if;
 new.is_guest:=coalesce(account.is_anonymous,false);
 new.author_is_admin:=is_admin and not new.is_guest;
 new.created_at:=now();
 if new.is_guest then
  new.author_name:=btrim(new.author_name);new.author_avatar_url:=null;new.author_profile_id:=null;
 else
  select * into profile from public.bg3ro_profiles where id=actor;
  new.author_name:=left(coalesce(nullif(profile.display_name,''),nullif(account.raw_user_meta_data->>'full_name',''),nullif(account.raw_user_meta_data->>'name',''),'Jucător'),40);
  new.author_avatar_url:=coalesce(profile.avatar_url,account.raw_user_meta_data->>'avatar_url');
  new.author_profile_id:=profile.id;
 end if;
 if not new.author_is_admin then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':bg3ro_report_replies',0));
  select * into quota from bg3ro_private.submission_limits where user_id=actor and kind='bg3ro_report_replies';
  if found and quota.last_sent>now()-interval '30 seconds' then
   raise exception 'Wait 30 seconds between replies' using errcode='P0001';
  end if;
  if quota.window_started>now()-interval '1 day' and quota.submissions>=20 then
   raise exception 'Daily reply limit reached' using errcode='P0001';
  end if;
  insert into bg3ro_private.submission_limits(user_id,kind,last_sent,window_started,submissions)
   values(actor,'bg3ro_report_replies',now(),now(),1)
   on conflict(user_id,kind) do update set last_sent=now(),
    window_started=case when submission_limits.window_started<=now()-interval '1 day' then now() else submission_limits.window_started end,
    submissions=case when submission_limits.window_started<=now()-interval '1 day' then 1 else submission_limits.submissions+1 end;
 end if;
 return new;
end;
$$;
revoke all on function bg3ro_private.prepare_report_reply() from public,anon,authenticated;
create trigger prepare_report_reply before insert or update on public.bg3ro_report_replies
 for each row execute function bg3ro_private.prepare_report_reply();
create trigger guard_admin_editor_badges before insert or update on public.bg3ro_report_replies
 for each row execute function bg3ro_private.guard_admin_editor_badges('body');
