begin;
create table public.bg3ro_contact_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  email text not null check (char_length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  subject text not null check (char_length(btrim(subject)) between 3 and 160),
  body text not null check (char_length(btrim(body)) between 10 and 6000),
  created_at timestamptz not null default now(),
  is_read boolean not null default false
);
alter table public.bg3ro_contact_messages enable row level security;
create index bg3ro_contact_recent on public.bg3ro_contact_messages(created_at desc,id desc);
create index bg3ro_contact_author on public.bg3ro_contact_messages(author_id);
revoke all on public.bg3ro_contact_messages from anon,authenticated;
grant insert(name,email,subject,body) on public.bg3ro_contact_messages to authenticated;
grant select,delete on public.bg3ro_contact_messages to authenticated;
grant update(is_read) on public.bg3ro_contact_messages to authenticated;
create policy contact_submit on public.bg3ro_contact_messages for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy contact_moderator_read on public.bg3ro_contact_messages for select to authenticated
  using ((select public.bg3ro_is_moderator()));
create policy contact_moderator_delete on public.bg3ro_contact_messages for delete to authenticated
  using ((select public.bg3ro_is_moderator()));
create policy contact_moderator_update on public.bg3ro_contact_messages for update to authenticated
  using ((select public.bg3ro_is_moderator())) with check ((select public.bg3ro_is_moderator()));

create function bg3ro_private.check_contact_submission() returns trigger
language plpgsql security definer set search_path = '' as $$
declare limits bg3ro_private.submission_limits;
begin
  if auth.uid() is null or new.author_id is distinct from auth.uid() then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if not public.bg3ro_is_moderator() then
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || tg_table_name,0));
    select * into limits from bg3ro_private.submission_limits where user_id=auth.uid() and kind=tg_table_name;
    if limits.last_sent > now()-interval '60 seconds' then raise exception 'Așteaptă 60 de secunde.'; end if;
    if limits.window_started > now()-interval '1 day' and limits.submissions >= 3 then raise exception 'Ai atins limita zilnică de contact.'; end if;
    insert into bg3ro_private.submission_limits(user_id,kind,last_sent,window_started,submissions)
      values(auth.uid(),tg_table_name,now(),now(),1)
      on conflict(user_id,kind) do update set last_sent=now(),
        window_started=case when submission_limits.window_started <= now()-interval '1 day' then now() else submission_limits.window_started end,
        submissions=case when submission_limits.window_started <= now()-interval '1 day' then 1 else submission_limits.submissions+1 end;
  end if;
  new.name:=btrim(new.name); new.email:=btrim(new.email); new.subject:=btrim(new.subject); new.body:=btrim(new.body);
  new.created_at:=now(); new.is_read:=false;
  return new;
end;
$$;
revoke all on function bg3ro_private.check_contact_submission() from public,anon,authenticated;
create trigger contact_submission_guard before insert on public.bg3ro_contact_messages
  for each row execute function bg3ro_private.check_contact_submission();
notify pgrst,'reload schema';
commit;
