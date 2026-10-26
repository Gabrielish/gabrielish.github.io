-- Every fixture and rate-limit change is rolled back; no real posts are changed.
begin;
select set_config('qa.reply_admin',gen_random_uuid()::text,true),set_config('qa.reply_member',gen_random_uuid()::text,true),set_config('qa.reply_guest',gen_random_uuid()::text,true);
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data) values
 (current_setting('qa.reply_admin')::uuid,'{"provider":"discord","providers":["discord"]}','{"full_name":"Administrator QA"}'),
 (current_setting('qa.reply_member')::uuid,'{"provider":"discord","providers":["discord"]}','{"full_name":"Member QA","moderator":true,"role":"admin"}');
insert into auth.users(id,is_anonymous) values(current_setting('qa.reply_guest')::uuid,true);
insert into bg3ro_private.moderators(user_id) values(current_setting('qa.reply_admin')::uuid);
select set_config('request.jwt.claim.sub',current_setting('qa.reply_admin'),true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
with added as(insert into public.bg3ro_bug_reports(author_id,title,body,category,platform,mod_version,is_public)
 values(auth.uid(),'Raport public QA','Raport public creat exclusiv pentru verificare.','other','windows','test',true) returning id)
 select set_config('qa.reply_report',id::text,true) from added;
with added as(insert into public.bg3ro_bug_reports(author_id,title,body,category,platform,mod_version,is_public)
 values(auth.uid(),'Raport privat QA','Raport privat creat exclusiv pentru verificare.','other','windows','test',false) returning id)
 select set_config('qa.reply_private',id::text,true) from added;
with added as(insert into public.bg3ro_report_replies(report_id,author_id,author_name,body)
 values(current_setting('qa.reply_report')::uuid,auth.uid(),'Nume ignorat','Un răspuns de administrator verificat.') returning id)
 select set_config('qa.reply_admin_post',id::text,true) from added;
insert into public.bg3ro_report_replies(report_id,author_id,author_name,body)
 values(current_setting('qa.reply_private')::uuid,auth.uid(),'Nume ignorat','Un răspuns privat care trebuie protejat.');
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.reply_member'),true);
set local role authenticated;
with added as(insert into public.bg3ro_report_replies(report_id,author_id,author_name,body)
 values(current_setting('qa.reply_report')::uuid,auth.uid(),'Nume fals','Un membru răspunde la raportul altcuiva.') returning id)
 select set_config('qa.reply_member_post',id::text,true) from added;
do $$begin
 if exists(select 1 from public.bg3ro_report_replies where id=current_setting('qa.reply_member_post')::uuid and author_is_admin) then raise exception 'Metadata granted admin';end if;
 if (select author_name from public.bg3ro_report_replies where id=current_setting('qa.reply_member_post')::uuid)<>'Member QA' then raise exception 'Name not stamped';end if;
 begin
  insert into public.bg3ro_report_replies(report_id,author_id,author_name,body) values(current_setting('qa.reply_report')::uuid,auth.uid(),'Member','Două răspunsuri fără pauza necesară.');
  raise exception 'Rate limit ignored' using errcode='XX000';
 exception when raise_exception then null;end;
 begin
  insert into public.bg3ro_report_replies(report_id,author_id,author_name,body) values(current_setting('qa.reply_private')::uuid,auth.uid(),'Member','Nu ar trebui să pot răspunde aici.');
  raise exception 'Private report leaked' using errcode='XX000';
 exception when insufficient_privilege then null;end;
 update public.bg3ro_report_replies set body='Text modificat fără permisiune.' where id=current_setting('qa.reply_admin_post')::uuid;
 if found then raise exception 'Edited another author';end if;
 delete from public.bg3ro_report_replies where id=current_setting('qa.reply_admin_post')::uuid;
 if found then raise exception 'Deleted another author';end if;
end $$;
update public.bg3ro_report_replies set body='Text corectat de autorul răspunsului.' where id=current_setting('qa.reply_member_post')::uuid;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.reply_guest'),true),set_config('request.jwt.claims','{"is_anonymous":true}',true);
set local role authenticated;
with added as(insert into public.bg3ro_report_replies(report_id,author_id,author_name,body)
 values(current_setting('qa.reply_report')::uuid,auth.uid(),'Oaspete QA','Un oaspete răspunde la raportul altcuiva.') returning id)
 select set_config('qa.reply_guest_post',id::text,true) from added;
do $$begin
 if not (select is_guest and not author_is_admin and author_profile_id is null from public.bg3ro_report_replies where id=current_setting('qa.reply_guest_post')::uuid) then raise exception 'Guest identity incorrect';end if;
 if has_column_privilege('authenticated','public.bg3ro_report_replies','author_is_admin','INSERT') or has_column_privilege('authenticated','public.bg3ro_report_replies','report_id','UPDATE') then raise exception 'Identity fields writable';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role anon;
do $$begin
 if (select count(*) from public.bg3ro_report_replies where report_id=current_setting('qa.reply_report')::uuid)<>3 then raise exception 'Public replies missing';end if;
 if exists(select 1 from public.bg3ro_report_replies where report_id=current_setting('qa.reply_private')::uuid) then raise exception 'Private replies visible';end if;
 if has_column_privilege('anon','public.bg3ro_report_replies','author_id','SELECT') then raise exception 'Guest IDs exposed';end if;
end $$;
reset role;
-- Clear only the fixture quota to isolate the badge-injection check.
delete from bg3ro_private.submission_limits where user_id=current_setting('qa.reply_guest')::uuid;
select set_config('request.jwt.claim.sub',current_setting('qa.reply_guest'),true),set_config('request.jwt.claims','{"is_anonymous":true}',true);
set local role authenticated;
do $$begin
 begin
  insert into public.bg3ro_report_replies(report_id,author_id,author_name,body) values(current_setting('qa.reply_report')::uuid,auth.uid(),'Guest','BG3RO-RICH-1:{"type":"doc","content":[{"type":"paragraph","content":[{"type":"badge","attrs":{"label":"Spoof"}}]}]}');
  raise exception 'Member badge accepted' using errcode='XX000';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.reply_admin'),true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
update public.bg3ro_report_replies set body='Corectat de administrator, cu autorul păstrat.' where id=current_setting('qa.reply_member_post')::uuid;
do $$begin
 if not (select author_is_admin from public.bg3ro_report_replies where id=current_setting('qa.reply_admin_post')::uuid) then raise exception 'Admin styling missing';end if;
 if (select author_is_admin from public.bg3ro_report_replies where id=current_setting('qa.reply_member_post')::uuid) then raise exception 'Editing transferred admin status';end if;
end $$;
delete from public.bg3ro_bug_reports where id=current_setting('qa.reply_report')::uuid;
do $$begin
 if exists(select 1 from public.bg3ro_report_replies where report_id=current_setting('qa.reply_report')::uuid) then raise exception 'Cascade failed';end if;
end $$;
reset role;
rollback;
select 'PASS: guest/member/admin replies, identity stamping, private access, owner tools, rate limits, badge protection, cascade and public read' as result;
