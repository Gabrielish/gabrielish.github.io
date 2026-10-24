-- Matches the migration applied to the hosted project.
begin;
-- Public display flags only; clients cannot write them or read the role list.
alter table public.bg3ro_discussion_posts add column author_is_admin boolean not null default false;
alter table public.bg3ro_bug_reports add column author_is_admin boolean not null default false;
grant select(author_is_admin) on public.bg3ro_discussion_posts,public.bg3ro_bug_reports to anon,authenticated;

create function bg3ro_private.stamp_author_badge() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 new.author_is_admin:=not new.is_guest and exists(
  select 1 from bg3ro_private.moderators m join auth.users u on u.id=m.user_id
  where m.user_id=new.author_id and not coalesce(u.is_anonymous,false));
 return new;
end;$$;
revoke all on function bg3ro_private.stamp_author_badge() from public,anon,authenticated;
create trigger bg3ro_stamp_author_badge before insert or update of author_id,is_guest,author_is_admin
on public.bg3ro_discussion_posts for each row execute function bg3ro_private.stamp_author_badge();
create trigger bg3ro_stamp_author_badge before insert or update of author_id,is_guest,author_is_admin
on public.bg3ro_bug_reports for each row execute function bg3ro_private.stamp_author_badge();

-- Trigger-based backfill changes only this new display flag.
update public.bg3ro_discussion_posts set author_is_admin=false;
update public.bg3ro_bug_reports set author_is_admin=false;

-- Keep existing posts accurate when a trusted administrator changes the role list.
create function bg3ro_private.sync_author_badges() returns trigger
language plpgsql security definer set search_path='' as $$
declare affected uuid[];
begin
 if tg_op='INSERT' then affected:=array[new.user_id];
 elsif tg_op='DELETE' then affected:=array[old.user_id];
 else affected:=array[old.user_id,new.user_id];end if;
 update public.bg3ro_discussion_posts set author_is_admin=false where author_id=any(affected);
 update public.bg3ro_bug_reports set author_is_admin=false where author_id=any(affected);
 return null;
end;$$;
revoke all on function bg3ro_private.sync_author_badges() from public,anon,authenticated;
create trigger bg3ro_sync_author_badges after insert or update or delete
on bg3ro_private.moderators for each row execute function bg3ro_private.sync_author_badges();
notify pgrst,'reload schema';
commit;
