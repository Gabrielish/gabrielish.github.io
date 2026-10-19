begin;
-- Avatar is presentation only, never an authorization claim. No Auth records are exposed.
alter table public.bg3ro_project_updates
 add column link_url text not null default '' check(length(link_url)<=2000),
 add column link_label text not null default '' check(length(link_label)<=80),
 add column badge_label text not null default '' check(length(badge_label)<=80),
 add column author_name text not null default 'Gabrielish' check(length(author_name) between 2 and 40),
 add column author_avatar_url text
 check (author_avatar_url is null or author_avatar_url ~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$');
create function bg3ro_private.set_manual_update_author() returns trigger
 language plpgsql security definer set search_path='' as $$
declare avatar text;
begin
 if auth.uid() is null or new.author_id <> auth.uid() then
  raise exception 'Not authorized' using errcode='42501';
 end if;
 new.author_avatar_url := null;
 select raw_user_meta_data->>'avatar_url' into avatar from auth.users
 where id=auth.uid() and not coalesce(is_anonymous,false)
 and (raw_app_meta_data->>'provider'='discord' or raw_app_meta_data->'providers' ? 'discord');
 if exists(select 1 from auth.users where id=auth.uid() and not coalesce(is_anonymous,false)
  and (raw_app_meta_data->>'provider'='discord' or raw_app_meta_data->'providers' ? 'discord')) then
  select left(coalesce(nullif(btrim(coalesce(nullif(raw_user_meta_data->>'preferred_username',''),nullif(raw_user_meta_data->>'user_name',''),nullif(raw_user_meta_data->>'full_name',''),raw_user_meta_data->>'name')),''),'Jucător Discord'),40)
   into new.author_name from auth.users where id=auth.uid();
  if new.author_name like '%@%' or length(new.author_name)<2 then new.author_name:='Jucător Discord';end if;
 end if;
 if avatar ~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$' then
  new.author_avatar_url := avatar;
 end if;
 return new;
end;
$$;
revoke all on function bg3ro_private.set_manual_update_author() from public,anon,authenticated;
create trigger bg3ro_manual_update_author before insert on public.bg3ro_project_updates
 for each row execute function bg3ro_private.set_manual_update_author();
alter table public.bg3ro_project_updates add constraint bg3ro_manual_update_link check(
 (link_url='' and link_label='') or (link_url ~ '^https?://[^[:space:]<>]+$' and length(btrim(link_label)) between 1 and 80));
grant insert(link_url,link_label,badge_label),update(link_url,link_label,badge_label) on public.bg3ro_project_updates to authenticated;
update public.bg3ro_project_updates p set author_avatar_url=u.raw_user_meta_data->>'avatar_url'
 from auth.users u where u.id=p.author_id and not coalesce(u.is_anonymous,false)
 and (u.raw_app_meta_data->>'provider'='discord' or u.raw_app_meta_data->'providers' ? 'discord')
 and u.raw_user_meta_data->>'avatar_url' ~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$';
notify pgrst,'reload schema';
commit;
