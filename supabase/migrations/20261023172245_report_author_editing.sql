begin;
-- Matches the applied migration version; text editing stays separate from moderation.
grant update(title,body) on public.bg3ro_bug_reports to authenticated;
create policy bg3ro_reports_author_edit on public.bg3ro_bug_reports
 for update to authenticated
 using(author_id=(select auth.uid()))
 with check(author_id=(select auth.uid()));

create function bg3ro_private.guard_report_edit() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 -- Trusted image-attachment RPCs execute as their owner. Direct API writes
 -- execute as authenticated and must never change moderator/identity fields.
 if current_user in ('authenticated','anon') then
  if auth.uid() is null then raise exception 'Not authorized' using errcode='42501';end if;
  if not public.bg3ro_is_moderator() and (
   old.author_id is distinct from auth.uid() or
   (to_jsonb(new)-array['title','body']) is distinct from (to_jsonb(old)-array['title','body'])
  ) then raise exception 'Only the administrator can change report state or project replies' using errcode='42501';end if;
 end if;
 return new;
end;
$$;
revoke all on function bg3ro_private.guard_report_edit() from public,anon,authenticated;
create trigger bg3ro_guard_report_edit before update on public.bg3ro_bug_reports
 for each row execute function bg3ro_private.guard_report_edit();
notify pgrst,'reload schema';
commit;
