begin;
select set_config('bg3ro.edit_author',gen_random_uuid()::text,true),set_config('bg3ro.edit_other',gen_random_uuid()::text,true),set_config('bg3ro.edit_admin',gen_random_uuid()::text,true),set_config('bg3ro.edit_report',gen_random_uuid()::text,true),set_config('bg3ro.edit_image',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('bg3ro.edit_author')::uuid),(current_setting('bg3ro.edit_other')::uuid),(current_setting('bg3ro.edit_admin')::uuid);
insert into bg3ro_private.moderators(user_id) values(current_setting('bg3ro.edit_admin')::uuid);
select set_config('request.jwt.claim.sub',current_setting('bg3ro.edit_author'),true),set_config('request.jwt.claims','{"is_anonymous":true}',true);
insert into public.bg3ro_bug_reports(id,author_id,title,body,category,platform,mod_version,is_public)
 values(current_setting('bg3ro.edit_report')::uuid,current_setting('bg3ro.edit_author')::uuid,'Capturi editabile','Context sintetic pentru verificarea eliminării capturilor.','text','windows','test',true);
select set_config('bg3ro.edit_first',current_setting('bg3ro.edit_report')||'/screenshot.jpg',true),set_config('bg3ro.edit_second',current_setting('bg3ro.edit_report')||'/'||current_setting('bg3ro.edit_image')||'.jpg',true);
-- Trusted fixture attachment metadata only; no real Storage objects are created/deleted.
update public.bg3ro_bug_reports set screenshot_path=current_setting('bg3ro.edit_first'),screenshot_paths=array[current_setting('bg3ro.edit_first'),current_setting('bg3ro.edit_second')] where id=current_setting('bg3ro.edit_report')::uuid;
create function pg_temp.image_edit_denied(command text) returns void language plpgsql security invoker as $$begin
 begin execute command;exception when others then return;end;
 raise exception 'Unauthorized/invalid image edit succeeded: %',command;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.edit_admin'),true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
update public.bg3ro_bug_reports set status='investigating',moderator_reply='Răspuns păstrat în timpul editării.' where id=current_setting('bg3ro.edit_report')::uuid;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.edit_other'),true);
set local role authenticated;
select pg_temp.image_edit_denied(format('select public.bg3ro_edit_report_images(%L,%L,%L,array[%L,%L],array[%L])',current_setting('bg3ro.edit_report'),'Titlu străin','Text străin care nu trebuie salvat.',current_setting('bg3ro.edit_first'),current_setting('bg3ro.edit_second'),current_setting('bg3ro.edit_second')));
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.image_edit_denied(format('select public.bg3ro_edit_report_images(%L,%L,%L,array[%L,%L],array[]::text[])',current_setting('bg3ro.edit_report'),'Titlu anonim','Text anonim care nu trebuie salvat.',current_setting('bg3ro.edit_first'),current_setting('bg3ro.edit_second')));
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.edit_author'),true),set_config('request.jwt.claims','{"is_anonymous":true}',true);
set local role authenticated;
select pg_temp.image_edit_denied(format('update public.bg3ro_bug_reports set screenshot_paths=%L::text[] where id=%L','{}',current_setting('bg3ro.edit_report')));
select pg_temp.image_edit_denied(format('select public.bg3ro_edit_report_images(%L,%L,%L,array[%L,%L],array[%L])',current_setting('bg3ro.edit_report'),'Titlu verificat','Text valid pentru verificarea selecției.',current_setting('bg3ro.edit_first'),current_setting('bg3ro.edit_second'),gen_random_uuid()::text||'/screenshot.jpg'));
select public.bg3ro_edit_report_images(current_setting('bg3ro.edit_report')::uuid,'Titlu actualizat','Descriere actualizată de autorul raportării.',array[current_setting('bg3ro.edit_first'),current_setting('bg3ro.edit_second')],array[current_setting('bg3ro.edit_second')]);
-- Lost-response retry must not discard the retained image.
select public.bg3ro_edit_report_images(current_setting('bg3ro.edit_report')::uuid,'Titlu actualizat','Descriere actualizată de autorul raportării.',array[current_setting('bg3ro.edit_first'),current_setting('bg3ro.edit_second')],array[current_setting('bg3ro.edit_second')]);
select pg_temp.image_edit_denied(format('select public.bg3ro_edit_report_images(%L,%L,%L,array[%L],array[]::text[])',current_setting('bg3ro.edit_report'),'Titlu valid','Scurt',current_setting('bg3ro.edit_second')));
select pg_temp.image_edit_denied(format('select public.bg3ro_edit_report_images(%L,%L,%L,array[%L],array[]::text[])',current_setting('bg3ro.edit_report'),'Titlu valid','Text valid dar cu galerie depășită.',current_setting('bg3ro.edit_first')));
do $$begin
 if not exists(select 1 from public.bg3ro_bug_reports where id=current_setting('bg3ro.edit_report')::uuid and screenshot_path=current_setting('bg3ro.edit_second') and screenshot_paths=array[current_setting('bg3ro.edit_second')] and status='investigating' and moderator_reply='Răspuns păstrat în timpul editării.') then raise exception 'Image editing changed protected data or lost retained gallery';end if;
end;$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.edit_admin'),true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
select public.bg3ro_edit_report_images(current_setting('bg3ro.edit_report')::uuid,'Titlu fără capturi','Descriere validă, fără capturi de ecran.',array[current_setting('bg3ro.edit_second')],array[]::text[]);
do $$begin
 if not exists(select 1 from public.bg3ro_bug_reports where id=current_setting('bg3ro.edit_report')::uuid and screenshot_path is null and cardinality(screenshot_paths)=0 and status='investigating') then raise exception 'Administrator could not remove all images';end if;
end;$$;
reset role;
rollback;
