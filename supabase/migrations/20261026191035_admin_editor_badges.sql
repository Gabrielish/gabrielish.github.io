-- Inline badges may be rendered publicly, but only administrators may author them.
-- Do not trust a hidden toolbar or user-editable profile metadata.
create or replace function bg3ro_private.guard_admin_editor_badges()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare field text; value text; document jsonb;
begin
 foreach field in array tg_argv loop
  value:=to_jsonb(new)->>field;
  if tg_op='UPDATE' and value is not distinct from (to_jsonb(old)->>field) then continue;end if;
  if left(coalesce(value,''),13)<>'BG3RO-RICH-1:' then continue;end if;
  begin document:=substring(value from 14)::jsonb;
  exception when invalid_text_representation then continue;
  end;
  if jsonb_path_exists(document,'$.** ? (@.type == "badge")')
     and not (select public.bg3ro_is_moderator()) then
   raise exception 'Only administrators may add editor badges' using errcode='42501';
  end if;
 end loop;
 return new;
end;
$$;
revoke all on function bg3ro_private.guard_admin_editor_badges() from public,anon,authenticated;
create trigger guard_admin_editor_badges before insert or update on public.bg3ro_discussion_posts
 for each row execute function bg3ro_private.guard_admin_editor_badges('body');
create trigger guard_admin_editor_badges before insert or update on public.bg3ro_bug_reports
 for each row execute function bg3ro_private.guard_admin_editor_badges('body','moderator_reply');
create trigger guard_admin_editor_badges before insert or update on public.bg3ro_direct_messages
 for each row execute function bg3ro_private.guard_admin_editor_badges('body');
create trigger guard_admin_editor_badges before insert or update on public.bg3ro_profiles
 for each row execute function bg3ro_private.guard_admin_editor_badges('bio');
