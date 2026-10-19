begin;
alter table public.bg3ro_releases add column author_avatar_url text
 check(author_avatar_url is null or author_avatar_url ~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$');
grant select(author_avatar_url) on public.bg3ro_releases to anon,authenticated;
-- Copy only the public, validated Discord image. Auth rows stay private.
update public.bg3ro_releases r set author_avatar_url=u.raw_user_meta_data->>'avatar_url'
 from auth.users u where u.id=r.author_id and not coalesce(u.is_anonymous,false)
 and (u.raw_app_meta_data->>'provider'='discord' or u.raw_app_meta_data->'providers' ? 'discord')
 and u.raw_user_meta_data->>'avatar_url' ~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$';
create function bg3ro_private.set_release_avatar() returns trigger
 language plpgsql security definer set search_path='' as $$
declare avatar text;
begin
 if auth.uid() is null or new.author_id<>auth.uid() or not public.bg3ro_is_moderator() then
  raise exception 'Not authorized' using errcode='42501';
 end if;
 select raw_user_meta_data->>'avatar_url' into avatar from auth.users where id=auth.uid()
  and not coalesce(is_anonymous,false)
  and (raw_app_meta_data->>'provider'='discord' or raw_app_meta_data->'providers' ? 'discord');
 new.author_avatar_url:=null;
 if avatar ~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$' then
  new.author_avatar_url:=avatar;
 end if;
 return new;
end;
$$;
revoke all on function bg3ro_private.set_release_avatar() from public,anon,authenticated;
create trigger bg3ro_release_avatar before insert or update on public.bg3ro_releases
 for each row execute function bg3ro_private.set_release_avatar();
notify pgrst,'reload schema';
commit;
