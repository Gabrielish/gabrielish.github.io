-- Run in a privileged test session. All changes are rolled back.
begin;
select set_config('request.jwt.claims',
 (select json_build_object('sub',user_id,'role','authenticated')::text
  from bg3ro_private.moderators limit 1),true);
set local role authenticated;
do $$
declare original text; replacement text:='BG3RO-RICH-1:{"type":"doc","content":[]}';
begin
 select body into original from public.bg3ro_about_sections where id='gallery';
 if not public.bg3ro_update_gallery_body(original,replacement) then raise exception 'Admin update failed'; end if;
 if public.bg3ro_update_gallery_body(original,replacement) then raise exception 'Stale update accepted'; end if;
 if not public.bg3ro_update_gallery_body(replacement,original) then raise exception 'Restore failed'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.bg3ro_update_gallery_body('','BG3RO-RICH-1:{}');
  raise exception 'Anonymous update accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.bg3ro_update_gallery_body('','BG3RO-RICH-1:{}');
  raise exception 'Member update accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
