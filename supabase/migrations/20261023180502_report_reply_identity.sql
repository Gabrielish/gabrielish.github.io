begin;
-- Version matches the migration applied to the hosted project.
alter table public.bg3ro_bug_reports
 add column reply_author_name text,
 add column reply_author_avatar_url text,
 add column reply_created_at timestamptz;
grant select(reply_author_name,reply_author_avatar_url,reply_created_at) on public.bg3ro_bug_reports to anon,authenticated;

-- Snapshot public display metadata only. Identity/date cannot be supplied by clients.
-- SECURITY DEFINER is needed solely to read the authenticated moderator's Auth row.
create function bg3ro_private.stamp_report_reply() returns trigger
 language plpgsql security definer set search_path='' as $$
declare metadata jsonb; avatar text;
begin
 if tg_op='INSERT' then
  new.reply_author_name:=null;new.reply_author_avatar_url:=null;new.reply_created_at:=null;
 elsif new.moderator_reply is distinct from old.moderator_reply then
  if auth.uid() is null or not public.bg3ro_is_moderator() then
   raise exception 'Only the administrator can reply' using errcode='42501';
  end if;
  if new.moderator_reply='' then
   new.reply_author_name:=null;new.reply_author_avatar_url:=null;new.reply_created_at:=null;
  elsif old.reply_created_at is not null then
   new.reply_author_name:=old.reply_author_name;new.reply_author_avatar_url:=old.reply_author_avatar_url;new.reply_created_at:=old.reply_created_at;
  else
   select raw_user_meta_data into metadata from auth.users where id=auth.uid() and not coalesce(is_anonymous,false);
   new.reply_author_name:=left(coalesce(nullif(btrim(coalesce(nullif(metadata->>'preferred_username',''),nullif(metadata->>'user_name',''),nullif(metadata->>'full_name',''),metadata->>'name')),''),'Administrator'),40);
   if new.reply_author_name like '%@%' or length(new.reply_author_name)<2 then new.reply_author_name:='Administrator';end if;
   avatar:=metadata->>'avatar_url';new.reply_author_avatar_url:=null;
   if avatar ~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$' then new.reply_author_avatar_url:=avatar;end if;
   new.reply_created_at:=statement_timestamp();
  end if;
 else
  new.reply_author_name:=old.reply_author_name;new.reply_author_avatar_url:=old.reply_author_avatar_url;new.reply_created_at:=old.reply_created_at;
 end if;
 return new;
end;
$$;
revoke all on function bg3ro_private.stamp_report_reply() from public,anon,authenticated;
create trigger bg3ro_stamp_report_reply before insert or update on public.bg3ro_bug_reports
 for each row execute function bg3ro_private.stamp_report_reply();
notify pgrst,'reload schema';
commit;
