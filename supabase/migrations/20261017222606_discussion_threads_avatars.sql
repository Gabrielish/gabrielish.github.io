begin;
-- Avatar is presentation only, never an authorization claim. No Auth records are exposed.
alter table public.bg3ro_discussion_posts add column author_avatar_url text
 check (author_avatar_url is null or author_avatar_url ~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$');
create function bg3ro_private.set_discussion_avatar() returns trigger
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
 if avatar ~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$' then
  new.author_avatar_url := avatar;
 end if;
 return new;
end;
$$;
revoke all on function bg3ro_private.set_discussion_avatar() from public,anon,authenticated;
create trigger bg3ro_discussion_avatar before insert on public.bg3ro_discussion_posts
 for each row execute function bg3ro_private.set_discussion_avatar();
-- Existing Discord discussions receive only the validated public CDN avatar.
update public.bg3ro_discussion_posts p set author_avatar_url=u.raw_user_meta_data->>'avatar_url'
 from auth.users u where u.id=p.author_id and not p.is_guest and not coalesce(u.is_anonymous,false)
 and (u.raw_app_meta_data->>'provider'='discord' or u.raw_app_meta_data->'providers' ? 'discord')
 and u.raw_user_meta_data->>'avatar_url' ~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$';
create index bg3ro_posts_root_feed on public.bg3ro_discussion_posts(created_at desc,id desc) where parent_id is null;
notify pgrst,'reload schema';
commit;
