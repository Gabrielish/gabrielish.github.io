-- Matches the migration applied to the hosted project.
begin;
create table public.bg3ro_profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 2 and 40),
 avatar_url text,
 joined_at timestamptz not null,
 is_admin boolean not null default false
);
alter table public.bg3ro_profiles enable row level security;
revoke all on public.bg3ro_profiles from public,anon,authenticated;
grant select on public.bg3ro_profiles to anon,authenticated;
create policy profiles_public on public.bg3ro_profiles for select to anon,authenticated using(true);

create function bg3ro_private.sync_public_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare username text; avatar text;
begin
 if coalesce(new.is_anonymous,false) or not(coalesce(new.raw_app_meta_data->>'provider','')='discord' or coalesce(new.raw_app_meta_data->'providers','[]'::jsonb)?'discord') then return new;end if;
 username:=left(btrim(coalesce(nullif(new.raw_user_meta_data->>'preferred_username',''),nullif(new.raw_user_meta_data->>'user_name',''),nullif(new.raw_user_meta_data->>'full_name',''),new.raw_user_meta_data->>'name','Jucător Discord')),40);
 if length(username)<2 or username like '%@%' then username:='Jucător Discord';end if;
 avatar:=new.raw_user_meta_data->>'avatar_url';
 if avatar is null or avatar !~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$' then avatar:=null;end if;
 insert into public.bg3ro_profiles(id,display_name,avatar_url,joined_at,is_admin)
 values(new.id,username,avatar,new.created_at,exists(select 1 from bg3ro_private.moderators where user_id=new.id))
 on conflict(id) do update set display_name=excluded.display_name,avatar_url=excluded.avatar_url,is_admin=excluded.is_admin;
 return new;
end;$$;
revoke all on function bg3ro_private.sync_public_profile() from public,anon,authenticated;
create trigger bg3ro_sync_public_profile after insert or update of raw_user_meta_data,raw_app_meta_data on auth.users for each row execute function bg3ro_private.sync_public_profile();
-- Replay the safe public projection without changing Auth records.
insert into public.bg3ro_profiles(id,display_name,avatar_url,joined_at,is_admin)
select u.id,case when length(btrim(n.name))<2 or n.name like '%@%' then 'Jucător Discord' else left(btrim(n.name),40) end,
case when u.raw_user_meta_data->>'avatar_url' ~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$' then u.raw_user_meta_data->>'avatar_url' end,
u.created_at,exists(select 1 from bg3ro_private.moderators m where m.user_id=u.id)
from auth.users u cross join lateral(select coalesce(nullif(u.raw_user_meta_data->>'preferred_username',''),nullif(u.raw_user_meta_data->>'user_name',''),nullif(u.raw_user_meta_data->>'full_name',''),u.raw_user_meta_data->>'name','Jucător Discord') as name)n
where not coalesce(u.is_anonymous,false) and (u.raw_app_meta_data->>'provider'='discord' or coalesce(u.raw_app_meta_data->'providers','[]'::jsonb)?'discord');
create function bg3ro_private.sync_profile_role() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'INSERT' then update public.bg3ro_profiles set is_admin=exists(select 1 from bg3ro_private.moderators where user_id=old.user_id) where id=old.user_id;end if;
 if tg_op<>'DELETE' then update public.bg3ro_profiles set is_admin=true where id=new.user_id;end if;
 return null;
end;$$;
revoke all on function bg3ro_private.sync_profile_role() from public,anon,authenticated;
create trigger bg3ro_sync_profile_role after insert or update or delete on bg3ro_private.moderators for each row execute function bg3ro_private.sync_profile_role();

alter table public.bg3ro_bug_reports add column author_profile_id uuid,add column reply_profile_id uuid;
grant select(author_profile_id,reply_profile_id) on public.bg3ro_bug_reports to anon,authenticated;
grant select(author_id) on public.bg3ro_releases to anon,authenticated;
create function bg3ro_private.stamp_report_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.author_profile_id:=(select id from public.bg3ro_profiles where id=new.author_id and not new.is_guest);
 if tg_op='INSERT' then new.reply_profile_id:=null;
 elsif new.moderator_reply='' then new.reply_profile_id:=null;
 elsif old.moderator_reply='' then new.reply_profile_id:=(select id from public.bg3ro_profiles where id=auth.uid() and is_admin);
 else new.reply_profile_id:=old.reply_profile_id;end if;
 return new;
end;$$;
revoke all on function bg3ro_private.stamp_report_profile() from public,anon,authenticated;
create trigger bg3ro_stamp_report_profile before insert or update on public.bg3ro_bug_reports for each row execute function bg3ro_private.stamp_report_profile();
update public.bg3ro_bug_reports r set author_profile_id=p.id from public.bg3ro_profiles p where p.id=r.author_id and not r.is_guest;
-- Legacy replies were authored by the sole project administrator when unambiguous.
alter table public.bg3ro_bug_reports disable trigger bg3ro_stamp_report_profile;
update public.bg3ro_bug_reports set reply_profile_id=(select min(id::text)::uuid from public.bg3ro_profiles where is_admin)
where moderator_reply<>'' and (select count(*) from public.bg3ro_profiles where is_admin)=1;
alter table public.bg3ro_bug_reports enable trigger bg3ro_stamp_report_profile;

create table public.bg3ro_conversations(
 id uuid primary key default gen_random_uuid(),
 user_a uuid not null references public.bg3ro_profiles(id) on delete cascade,
 user_b uuid not null references public.bg3ro_profiles(id) on delete cascade,
 created_at timestamptz not null default now(),check(user_a<user_b),unique(user_a,user_b)
);
create index bg3ro_conversations_b on public.bg3ro_conversations(user_b);
alter table public.bg3ro_conversations enable row level security;
revoke all on public.bg3ro_conversations from public,anon,authenticated;
grant select on public.bg3ro_conversations to authenticated;
grant insert(user_a,user_b) on public.bg3ro_conversations to authenticated;
create policy conversations_participant_read on public.bg3ro_conversations for select to authenticated using((select auth.uid()) in(user_a,user_b));
create policy conversations_participant_insert on public.bg3ro_conversations for insert to authenticated with check((select auth.uid()) in(user_a,user_b) and not coalesce((select auth.jwt())->>'is_anonymous','false')::boolean);

create table public.bg3ro_direct_messages(
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.bg3ro_conversations(id) on delete cascade,
 sender_id uuid not null references public.bg3ro_profiles(id) on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 12000),created_at timestamptz not null default now()
);
create index bg3ro_direct_messages_history on public.bg3ro_direct_messages(conversation_id,created_at desc,id desc);
create index bg3ro_direct_messages_sender on public.bg3ro_direct_messages(sender_id);
alter table public.bg3ro_direct_messages enable row level security;
revoke all on public.bg3ro_direct_messages from public,anon,authenticated;
grant select on public.bg3ro_direct_messages to authenticated;
grant insert(conversation_id,sender_id,body) on public.bg3ro_direct_messages to authenticated;
create policy direct_messages_participant_read on public.bg3ro_direct_messages for select to authenticated using(exists(select 1 from public.bg3ro_conversations c where c.id=conversation_id));
create policy direct_messages_sender_insert on public.bg3ro_direct_messages for insert to authenticated with check(sender_id=(select auth.uid()) and exists(select 1 from public.bg3ro_conversations c where c.id=conversation_id));

create table public.bg3ro_conversation_receipts(
 conversation_id uuid not null references public.bg3ro_conversations(id) on delete cascade,
 user_id uuid not null references public.bg3ro_profiles(id) on delete cascade,
 read_at timestamptz not null default now(),hidden_at timestamptz,primary key(conversation_id,user_id)
);
create index bg3ro_conversation_receipts_user on public.bg3ro_conversation_receipts(user_id);
alter table public.bg3ro_conversation_receipts enable row level security;
revoke all on public.bg3ro_conversation_receipts from public,anon,authenticated;
grant select on public.bg3ro_conversation_receipts to authenticated;
grant insert(conversation_id,user_id,read_at,hidden_at),update(read_at,hidden_at) on public.bg3ro_conversation_receipts to authenticated;
create policy receipts_own_read on public.bg3ro_conversation_receipts for select to authenticated using(user_id=(select auth.uid()));
create policy receipts_own_insert on public.bg3ro_conversation_receipts for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.bg3ro_conversations c where c.id=conversation_id));
create policy receipts_own_update on public.bg3ro_conversation_receipts for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.bg3ro_conversations c where c.id=conversation_id));

-- Private, non-callable triggers enforce quotas even on direct REST inserts.
create function bg3ro_private.check_private_send() returns trigger language plpgsql security definer set search_path='' as $$
declare limits bg3ro_private.submission_limits;quota integer;wait_seconds integer;v_kind text;
begin
 if auth.uid() is null or not exists(select 1 from public.bg3ro_profiles where id=auth.uid()) then raise exception 'Conectează-te prin Discord.' using errcode='42501';end if;
 if tg_table_name='bg3ro_direct_messages' then
  if new.sender_id<>auth.uid() or not exists(select 1 from public.bg3ro_conversations where id=new.conversation_id and auth.uid() in(user_a,user_b)) then raise exception 'Not authorized' using errcode='42501';end if;
  quota:=500;wait_seconds:=2;v_kind:='direct_message';
 else
  if auth.uid() not in(new.user_a,new.user_b) then raise exception 'Not authorized' using errcode='42501';end if;
  quota:=30;wait_seconds:=1;v_kind:='direct_conversation';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||v_kind,0));
 select * into limits from bg3ro_private.submission_limits where user_id=auth.uid() and submission_limits.kind=v_kind;
 if limits.last_sent>clock_timestamp()-make_interval(secs=>wait_seconds) then raise exception 'Așteaptă câteva secunde înainte de a trimite din nou.';end if;
 if limits.window_started>now()-interval '1 day' and limits.submissions>=quota then raise exception 'Ai atins limita zilnică. Încearcă mâine.';end if;
 insert into bg3ro_private.submission_limits(user_id,kind,last_sent,window_started,submissions) values(auth.uid(),v_kind,clock_timestamp(),now(),1)
 on conflict(user_id,kind) do update set last_sent=excluded.last_sent,window_started=case when submission_limits.window_started<=now()-interval '1 day' then now() else submission_limits.window_started end,submissions=case when submission_limits.window_started<=now()-interval '1 day' then 1 else submission_limits.submissions+1 end;
 new.created_at:=clock_timestamp();return new;
end;$$;
revoke all on function bg3ro_private.check_private_send() from public,anon,authenticated;
create trigger bg3ro_check_private_send before insert on public.bg3ro_direct_messages for each row execute function bg3ro_private.check_private_send();
create trigger bg3ro_check_private_start before insert on public.bg3ro_conversations for each row execute function bg3ro_private.check_private_send();

create function public.bg3ro_start_conversation(p_recipient uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;first_user uuid;second_user uuid;
begin
 if auth.uid() is null or p_recipient=auth.uid() then raise exception 'Alege un alt utilizator.';end if;
 first_user:=least(auth.uid(),p_recipient);second_user:=greatest(auth.uid(),p_recipient);
 select id into result from public.bg3ro_conversations where user_a=first_user and user_b=second_user;
 if result is null then
  insert into public.bg3ro_conversations(user_a,user_b) values(first_user,second_user) on conflict(user_a,user_b) do nothing returning id into result;
  if result is null then select id into result from public.bg3ro_conversations where user_a=first_user and user_b=second_user;end if;
 end if;
 return result;
end;$$;
create function public.bg3ro_mark_conversation(p_conversation uuid,p_hide boolean default false) returns void language sql security invoker set search_path='' as $$
 insert into public.bg3ro_conversation_receipts(conversation_id,user_id,read_at,hidden_at) values(p_conversation,auth.uid(),clock_timestamp(),case when p_hide then clock_timestamp() end)
 on conflict(conversation_id,user_id) do update set read_at=excluded.read_at,hidden_at=excluded.hidden_at;
$$;
create function public.bg3ro_dm_inbox() returns table(id uuid,peer_id uuid,display_name text,avatar_url text,is_admin boolean,last_body text,last_at timestamptz,unread bigint)
language sql stable security invoker set search_path='' as $$
 select c.id,p.id,p.display_name,p.avatar_url,p.is_admin,m.body,m.created_at,
 (select count(*) from public.bg3ro_direct_messages u where u.conversation_id=c.id and u.sender_id<>auth.uid() and u.created_at>coalesce(r.read_at,'-infinity'::timestamptz))
 from public.bg3ro_conversations c join public.bg3ro_profiles p on p.id=case when c.user_a=auth.uid() then c.user_b else c.user_a end
 left join lateral(select body,created_at from public.bg3ro_direct_messages where conversation_id=c.id order by created_at desc,id desc limit 1)m on true
 left join public.bg3ro_conversation_receipts r on r.conversation_id=c.id and r.user_id=auth.uid()
 where r.hidden_at is null or m.created_at>r.hidden_at
 order by coalesce(m.created_at,c.created_at) desc,c.id limit 100;
$$;
revoke all on function public.bg3ro_start_conversation(uuid),public.bg3ro_mark_conversation(uuid,boolean),public.bg3ro_dm_inbox() from public,anon,authenticated;
grant execute on function public.bg3ro_start_conversation(uuid),public.bg3ro_mark_conversation(uuid,boolean),public.bg3ro_dm_inbox() to authenticated;
notify pgrst,'reload schema';
commit;
