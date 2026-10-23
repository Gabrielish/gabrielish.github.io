begin;
select set_config('bg3ro.gallery_author',gen_random_uuid()::text,true),set_config('bg3ro.gallery_other',gen_random_uuid()::text,true),set_config('bg3ro.gallery_report',gen_random_uuid()::text,true),set_config('bg3ro.gallery_image',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('bg3ro.gallery_author')::uuid),(current_setting('bg3ro.gallery_other')::uuid);
select set_config('request.jwt.claim.sub',current_setting('bg3ro.gallery_author'),true),set_config('request.jwt.claims','{"is_anonymous":true}',true);
insert into public.bg3ro_bug_reports(id,author_id,title,body,category,platform,mod_version,is_public)
 values(current_setting('bg3ro.gallery_report')::uuid,current_setting('bg3ro.gallery_author')::uuid,'Galerie de test','Descriere sintetică pentru testarea galeriei.','text','windows','test',true);
create function pg_temp.gallery_denied(command text) returns void language plpgsql security invoker as $$begin
 begin execute command;exception when others then return;end;
 raise exception 'Unauthorized/invalid gallery operation succeeded: %',command;
end $$;
select set_config('bg3ro.gallery_first',current_setting('bg3ro.gallery_report')||'/screenshot.jpg',true),set_config('bg3ro.gallery_second',current_setting('bg3ro.gallery_report')||'/'||current_setting('bg3ro.gallery_image')||'.jpg',true);
set local role authenticated;
insert into storage.objects(bucket_id,name,owner_id,metadata) values('bg3ro-report-images',current_setting('bg3ro.gallery_first'),current_setting('bg3ro.gallery_author'),'{"mimetype":"image/jpeg","size":3145728}');
insert into storage.objects(bucket_id,name,owner_id,metadata) values('bg3ro-report-images',current_setting('bg3ro.gallery_second'),current_setting('bg3ro.gallery_author'),'{"mimetype":"image/jpeg","size":2097152}');
select pg_temp.gallery_denied(format('insert into storage.objects(bucket_id,name,owner_id,metadata) values(%L,%L,%L,%L)','bg3ro-report-images',current_setting('bg3ro.gallery_report')||'/'||gen_random_uuid()::text||'.jpg',current_setting('bg3ro.gallery_author'),'{"mimetype":"image/jpeg","size":1}'));
select pg_temp.gallery_denied(format('select public.bg3ro_attach_report_images(%L,array[%L,%L])',current_setting('bg3ro.gallery_report'),current_setting('bg3ro.gallery_first'),current_setting('bg3ro.gallery_first')));
select public.bg3ro_attach_report_images(current_setting('bg3ro.gallery_report')::uuid,array[current_setting('bg3ro.gallery_first'),current_setting('bg3ro.gallery_second')]);
select public.bg3ro_attach_report_images(current_setting('bg3ro.gallery_report')::uuid,array[current_setting('bg3ro.gallery_first'),current_setting('bg3ro.gallery_second')]);
select pg_temp.gallery_denied(format('update public.bg3ro_bug_reports set screenshot_paths=%L::text[] where id=%L','{}',current_setting('bg3ro.gallery_report')));
do $$begin
 if not exists(select 1 from public.bg3ro_bug_reports where id=current_setting('bg3ro.gallery_report')::uuid and cardinality(screenshot_paths)=2 and screenshot_path=current_setting('bg3ro.gallery_first')) then raise exception 'Gallery not attached';end if;
end $$;
reset role;
-- Even if Storage contains oversized objects, the final attachment must reject them.
update storage.objects set metadata='{"mimetype":"image/jpeg","size":2097153}' where bucket_id='bg3ro-report-images' and name=current_setting('bg3ro.gallery_second');
set local role authenticated;
select pg_temp.gallery_denied(format('select public.bg3ro_attach_report_images(%L,array[%L,%L])',current_setting('bg3ro.gallery_report'),current_setting('bg3ro.gallery_first'),current_setting('bg3ro.gallery_second')));
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.gallery_other'),true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
select pg_temp.gallery_denied(format('select public.bg3ro_attach_report_images(%L,array[%L,%L])',current_setting('bg3ro.gallery_report'),current_setting('bg3ro.gallery_first'),current_setting('bg3ro.gallery_second')));
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 if (select count(*) from storage.objects where bucket_id='bg3ro-report-images' and name=any(array[current_setting('bg3ro.gallery_first'),current_setting('bg3ro.gallery_second')]))<>2 then raise exception 'Public gallery read failed';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.gallery_author'),true);
set local role authenticated;
delete from public.bg3ro_bug_reports where id=current_setting('bg3ro.gallery_report')::uuid;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 if exists(select 1 from storage.objects where bucket_id='bg3ro-report-images' and name=any(array[current_setting('bg3ro.gallery_first'),current_setting('bg3ro.gallery_second')])) then raise exception 'Deleted gallery remains public';end if;
end $$;
reset role;
rollback;
