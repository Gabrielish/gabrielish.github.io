begin;
-- Public identity is created for Discord users and verified email users.
-- Admin privileges still come exclusively from the private moderator allowlist.
create or replace function bg3ro_private.sync_public_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare username text; avatar text;
begin
 if coalesce(new.is_anonymous,false) then return new; end if;
 if not (coalesce(new.raw_app_meta_data->>'provider','')='discord'
   or coalesce(new.raw_app_meta_data->'providers','[]'::jsonb)?'discord'
   or new.email_confirmed_at is not null) then return new; end if;
 username:=left(btrim(coalesce(nullif(new.raw_user_meta_data->>'preferred_username',''),nullif(new.raw_user_meta_data->>'user_name',''),nullif(new.raw_user_meta_data->>'full_name',''),new.raw_user_meta_data->>'name','Utilizator')),40);
 if length(username)<2 or username like '%@%' then username:='Utilizator';end if;
 avatar:=new.raw_user_meta_data->>'avatar_url';
 if avatar is null or avatar !~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$' then avatar:=null;end if;
 insert into public.bg3ro_profiles(id,display_name,avatar_url,joined_at,is_admin)
 values(new.id,username,avatar,new.created_at,exists(select 1 from bg3ro_private.moderators where user_id=new.id))
 on conflict(id) do update set display_name=case when bg3ro_profiles.custom_name then bg3ro_profiles.display_name else excluded.display_name end,
 avatar_url=case when bg3ro_profiles.custom_avatar then bg3ro_profiles.avatar_url else excluded.avatar_url end,is_admin=excluded.is_admin;
 return new;
end;$$;
revoke all on function bg3ro_private.sync_public_profile() from public,anon,authenticated;
drop trigger bg3ro_sync_public_profile on auth.users;
create trigger bg3ro_sync_public_profile after insert or update of raw_user_meta_data,raw_app_meta_data,email_confirmed_at
on auth.users for each row execute function bg3ro_private.sync_public_profile();
-- Backfill any already confirmed email accounts without touching edited names/avatars.
insert into public.bg3ro_profiles(id,display_name,joined_at,is_admin)
select u.id,case when length(btrim(coalesce(u.raw_user_meta_data->>'preferred_username',u.raw_user_meta_data->>'full_name',''))) between 2 and 40
 and coalesce(u.raw_user_meta_data->>'preferred_username',u.raw_user_meta_data->>'full_name','') not like '%@%'
 then btrim(coalesce(u.raw_user_meta_data->>'preferred_username',u.raw_user_meta_data->>'full_name')) else 'Utilizator' end,
 u.created_at,exists(select 1 from bg3ro_private.moderators m where m.user_id=u.id)
from auth.users u where not coalesce(u.is_anonymous,false) and u.email_confirmed_at is not null
on conflict(id) do nothing;
create or replace function bg3ro_private.set_report_avatar() returns trigger
language plpgsql security definer set search_path='' as $$
declare identity public.bg3ro_profiles;
begin
 if auth.uid() is null or new.author_id<>auth.uid() then raise exception 'Not authorized' using errcode='42501';end if;
 new.author_avatar_url:=null;
 select p.* into identity from public.bg3ro_profiles p join auth.users u on u.id=p.id
 where p.id=auth.uid() and not coalesce(u.is_anonymous,false);
 if found then new.author_name:=identity.display_name;new.author_avatar_url:=identity.avatar_url;end if;
 return new;
end;$$;
revoke all on function bg3ro_private.set_report_avatar() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
