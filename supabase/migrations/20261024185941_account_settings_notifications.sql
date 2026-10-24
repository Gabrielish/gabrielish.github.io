-- Account settings and private notifications.
begin;
alter table public.bg3ro_profiles add column bio text not null default '' check(length(bio)<=6000),add column custom_name boolean not null default false,add column custom_avatar boolean not null default false;
grant update(display_name,bio,avatar_url) on public.bg3ro_profiles to authenticated;
create policy profiles_own_update on public.bg3ro_profiles for update to authenticated using(id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)) with check(id=(select auth.uid()));
create function bg3ro_private.guard_profile_settings() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.display_name:=btrim(new.display_name);
 if length(new.display_name)<2 or new.display_name like '%@%' then raise exception 'Alege un nume de 2–40 de caractere, fără adresă de e-mail.';end if;
 if new.avatar_url is not null and new.avatar_url !~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$'
 and new.avatar_url !~ ('^https://gatkiwcyjgbgjwfgvplm[.]supabase[.]co/storage/v1/object/public/bg3ro-avatars/'||new.id::text||'/[0-9a-f-]{36}[.]jpg$') then raise exception 'Fotografie de profil invalidă.';end if;
 if current_user='authenticated' then
  new.is_admin:=old.is_admin;new.joined_at:=old.joined_at;
  new.custom_name:=old.custom_name or new.display_name is distinct from old.display_name;
  new.custom_avatar:=old.custom_avatar or new.avatar_url is distinct from old.avatar_url;
 end if;
 return new;
end;$$;
revoke all on function bg3ro_private.guard_profile_settings() from public,anon,authenticated;
create trigger bg3ro_guard_profile_settings before update on public.bg3ro_profiles for each row execute function bg3ro_private.guard_profile_settings();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('bg3ro-avatars','bg3ro-avatars',true,5242880,array['image/jpeg']);
create policy avatar_owner_insert on storage.objects for insert to authenticated with check(bucket_id='bg3ro-avatars' and name ~ ('^'||(select auth.uid())::text||'/[0-9a-f-]{36}[.]jpg$') and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) and exists(select 1 from public.bg3ro_profiles where id=(select auth.uid())));
create policy avatar_owner_read on storage.objects for select to authenticated using(bucket_id='bg3ro-avatars' and split_part(name,'/',1)=(select auth.uid())::text);
create policy avatar_owner_delete on storage.objects for delete to authenticated using(bucket_id='bg3ro-avatars' and split_part(name,'/',1)=(select auth.uid())::text);

create table public.bg3ro_account_preferences(
 user_id uuid primary key references public.bg3ro_profiles(id) on delete cascade,
 notify_replies boolean not null default true,notify_reports boolean not null default true,notify_messages boolean not null default true,favorite_project boolean not null default false
);
alter table public.bg3ro_account_preferences enable row level security;
revoke all on public.bg3ro_account_preferences from public,anon,authenticated;
grant select,insert,update on public.bg3ro_account_preferences to authenticated;
create policy account_preferences_own on public.bg3ro_account_preferences for all to authenticated using(user_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)) with check(user_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));

create table public.bg3ro_notifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.bg3ro_profiles(id) on delete cascade,
 kind text not null check(kind in('reply','report','message','account')),title text not null check(length(title)<=200),target text not null check(target in('#discutii','#erori','#conversatii','#setari/securitate')),created_at timestamptz not null default now(),read_at timestamptz
);
create index bg3ro_notifications_history on public.bg3ro_notifications(user_id,created_at desc,id desc);
create index bg3ro_notifications_unread on public.bg3ro_notifications(user_id) where read_at is null;
alter table public.bg3ro_notifications enable row level security;
revoke all on public.bg3ro_notifications from public,anon,authenticated;
grant select,delete on public.bg3ro_notifications to authenticated;grant update(read_at) on public.bg3ro_notifications to authenticated;
create policy notifications_own on public.bg3ro_notifications for all to authenticated using(user_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)) with check(user_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));

create function bg3ro_private.notify_community_event() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;label text;category text;destination text;enabled boolean;
begin
 if tg_table_name='bg3ro_discussion_posts' then
  if new.parent_id is null or new.status<>'approved' then return new;end if;
  if tg_op='UPDATE' then if old.status is not distinct from new.status then return new;end if;end if;
  select author_id into recipient from public.bg3ro_discussion_posts where id=new.parent_id;
  if recipient=new.author_id then return new;end if;
  select display_name into label from public.bg3ro_profiles where id=new.author_id;label:=coalesce(label,new.author_name,'Un utilizator')||' a răspuns în discuția ta.';category:='reply';destination:='#discutii';
  select notify_replies into enabled from public.bg3ro_account_preferences where user_id=recipient;
 elsif tg_table_name='bg3ro_bug_reports' then
  if (new.status is not distinct from old.status and new.moderator_reply is not distinct from old.moderator_reply) or new.author_id=auth.uid() then return new;end if;
  recipient:=new.author_id;label:='Raportarea ta a fost actualizată: '||left(new.title,120);category:='report';destination:='#erori';
  select notify_reports into enabled from public.bg3ro_account_preferences where user_id=recipient;
 else
  select case when user_a=new.sender_id then user_b else user_a end into recipient from public.bg3ro_conversations where id=new.conversation_id;
  select display_name into label from public.bg3ro_profiles where id=new.sender_id;label:='Mesaj privat nou de la '||coalesce(label,'un utilizator')||'.';category:='message';destination:='#conversatii';
  select notify_messages into enabled from public.bg3ro_account_preferences where user_id=recipient;
 end if;
 if coalesce(enabled,true) and exists(select 1 from public.bg3ro_profiles where id=recipient) then insert into public.bg3ro_notifications(user_id,kind,title,target) values(recipient,category,left(label,200),destination);end if;
 return new;
end;$$;
revoke all on function bg3ro_private.notify_community_event() from public,anon,authenticated;
create trigger bg3ro_notify_reply after insert or update of status on public.bg3ro_discussion_posts for each row execute function bg3ro_private.notify_community_event();
create trigger bg3ro_notify_report after update of status,moderator_reply on public.bg3ro_bug_reports for each row execute function bg3ro_private.notify_community_event();
create trigger bg3ro_notify_direct_message after insert on public.bg3ro_direct_messages for each row execute function bg3ro_private.notify_community_event();

create table public.bg3ro_account_requests(user_id uuid primary key references public.bg3ro_profiles(id) on delete cascade,requested_at timestamptz not null default now(),status text not null default 'pending' check(status in('pending','handled')));
alter table public.bg3ro_account_requests enable row level security;
revoke all on public.bg3ro_account_requests from public,anon,authenticated;
grant select on public.bg3ro_account_requests to authenticated;grant insert(user_id),update(status) on public.bg3ro_account_requests to authenticated;
create policy account_requests_own_read on public.bg3ro_account_requests for select to authenticated using(user_id=(select auth.uid()) or (select public.bg3ro_is_moderator()));
create policy account_requests_own_insert on public.bg3ro_account_requests for insert to authenticated with check(user_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy account_requests_admin_update on public.bg3ro_account_requests for update to authenticated using((select public.bg3ro_is_moderator())) with check((select public.bg3ro_is_moderator()));
create function bg3ro_private.notify_account_request() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.bg3ro_notifications(user_id,kind,title,target) select id,'account','Solicitare de ștergere a contului: '||coalesce((select display_name from public.bg3ro_profiles where id=new.user_id),'utilizator'),'#setari/securitate' from public.bg3ro_profiles where is_admin;
 return new;
end;$$;
revoke all on function bg3ro_private.notify_account_request() from public,anon,authenticated;
create trigger bg3ro_notify_account_request after insert on public.bg3ro_account_requests for each row execute function bg3ro_private.notify_account_request();

create function public.bg3ro_my_progress() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('comments',coalesce(sum(case when parent_id is null then 1 else 0 end),0),'replies',coalesce(sum(case when parent_id is not null then 1 else 0 end),0),'ratings',(select count(*) from public.bg3ro_ratings where user_id=auth.uid()),'points',coalesce(sum(case when parent_id is null then 2 else 1 end),0)+(select count(*) from public.bg3ro_ratings where user_id=auth.uid()))
 from public.bg3ro_discussion_posts where author_id=auth.uid() and status='approved' and not is_guest;
$$;
revoke all on function public.bg3ro_my_progress() from public,anon,authenticated;grant execute on function public.bg3ro_my_progress() to authenticated;
create or replace function bg3ro_private.sync_public_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare username text; avatar text;
begin
 if coalesce(new.is_anonymous,false) or not(coalesce(new.raw_app_meta_data->>'provider','')='discord' or coalesce(new.raw_app_meta_data->'providers','[]'::jsonb)?'discord') then return new;end if;
 username:=left(btrim(coalesce(nullif(new.raw_user_meta_data->>'preferred_username',''),nullif(new.raw_user_meta_data->>'user_name',''),nullif(new.raw_user_meta_data->>'full_name',''),new.raw_user_meta_data->>'name','Jucător Discord')),40);
 if length(username)<2 or username like '%@%' then username:='Jucător Discord';end if;
 avatar:=new.raw_user_meta_data->>'avatar_url';
 if avatar is null or avatar !~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$' then avatar:=null;end if;
 insert into public.bg3ro_profiles(id,display_name,avatar_url,joined_at,is_admin)
 values(new.id,username,avatar,new.created_at,exists(select 1 from bg3ro_private.moderators where user_id=new.id))
 on conflict(id) do update set display_name=case when bg3ro_profiles.custom_name then bg3ro_profiles.display_name else excluded.display_name end,avatar_url=case when bg3ro_profiles.custom_avatar then bg3ro_profiles.avatar_url else excluded.avatar_url end,is_admin=excluded.is_admin;
 return new;
end;$$;
notify pgrst,'reload schema';
commit;
