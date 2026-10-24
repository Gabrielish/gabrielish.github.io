begin;
select set_config('qa.badge_admin',gen_random_uuid()::text,true),set_config('qa.badge_member',gen_random_uuid()::text,true),set_config('qa.badge_guest',gen_random_uuid()::text,true);
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data) values
 (current_setting('qa.badge_admin')::uuid,'{"provider":"discord","providers":["discord"]}','{"full_name":"Administrator QA"}'),
 (current_setting('qa.badge_member')::uuid,'{"provider":"discord","providers":["discord"]}','{"full_name":"Admin","moderator":true,"role":"admin"}');
insert into auth.users(id,is_anonymous) values(current_setting('qa.badge_guest')::uuid,true);
insert into bg3ro_private.moderators(user_id) values(current_setting('qa.badge_admin')::uuid);
select set_config('request.jwt.claim.sub',current_setting('qa.badge_admin'),true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
with added as(insert into public.bg3ro_discussion_posts(author_id,author_name,title,body) values(auth.uid(),'Admin QA','Mesaj administrator','Un mesaj de administrator pentru verificare.') returning id)select set_config('qa.badge_post',id::text,true) from added;
with added as(insert into public.bg3ro_bug_reports(author_id,title,body,category,platform,mod_version) values(auth.uid(),'Raport administrator','Un raport suficient de lung pentru verificare.','other','windows','test') returning id)select set_config('qa.badge_report',id::text,true) from added;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.badge_member'),true);
set local role authenticated;
with added as(insert into public.bg3ro_discussion_posts(author_id,author_name,title,body) values(auth.uid(),'Admin','Mesaj membru','Numele și metadatele nu acordă insigna Admin.') returning id)select set_config('qa.badge_member_post',id::text,true) from added;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.badge_guest'),true),set_config('request.jwt.claims','{"is_anonymous":true}',true);
set local role authenticated;
with added as(insert into public.bg3ro_discussion_posts(author_id,author_name,title,body) values(auth.uid(),'Admin','Mesaj oaspete','Un oaspete nu poate primi insigna de administrator.') returning id)select set_config('qa.badge_guest_post',id::text,true) from added;
reset role;
do $$begin
 if not (select author_is_admin from public.bg3ro_discussion_posts where id=current_setting('qa.badge_post')::uuid) or not (select author_is_admin from public.bg3ro_bug_reports where id=current_setting('qa.badge_report')::uuid) then raise exception 'Missing verified admin badge';end if;
 if exists(select 1 from public.bg3ro_discussion_posts where id in(current_setting('qa.badge_member_post')::uuid,current_setting('qa.badge_guest_post')::uuid) and author_is_admin) then raise exception 'Untrusted metadata/guest spoofed badge';end if;
 if has_column_privilege('authenticated','public.bg3ro_discussion_posts','author_is_admin','INSERT') or has_column_privilege('authenticated','public.bg3ro_discussion_posts','author_is_admin','UPDATE') or has_column_privilege('authenticated','public.bg3ro_bug_reports','author_is_admin','INSERT') or has_column_privilege('authenticated','public.bg3ro_bug_reports','author_is_admin','UPDATE') then raise exception 'Clients can write badge flags';end if;
 if has_function_privilege('anon','bg3ro_private.stamp_author_badge()','EXECUTE') or has_function_privilege('authenticated','bg3ro_private.sync_author_badges()','EXECUTE') then raise exception 'Private badge triggers exposed';end if;
end;$$;
select set_config('qa.badge_snapshot',(select (to_jsonb(p)-'author_is_admin')::text from public.bg3ro_discussion_posts p where id=current_setting('qa.badge_post')::uuid),true),set_config('qa.badge_report_snapshot',(select (to_jsonb(p)-'author_is_admin')::text from public.bg3ro_bug_reports p where id=current_setting('qa.badge_report')::uuid),true);
delete from bg3ro_private.moderators where user_id=current_setting('qa.badge_admin')::uuid;
do $$begin
 if (select author_is_admin from public.bg3ro_discussion_posts where id=current_setting('qa.badge_post')::uuid) or (select author_is_admin from public.bg3ro_bug_reports where id=current_setting('qa.badge_report')::uuid) then raise exception 'Revoked role retains badge';end if;
end;$$;
insert into bg3ro_private.moderators(user_id) values(current_setting('qa.badge_admin')::uuid),(current_setting('qa.badge_guest')::uuid);
do $$begin
 if not (select author_is_admin from public.bg3ro_discussion_posts where id=current_setting('qa.badge_post')::uuid) then raise exception 'Granted role missing badge';end if;
 if (select author_is_admin from public.bg3ro_discussion_posts where id=current_setting('qa.badge_guest_post')::uuid) then raise exception 'Anonymous account has admin badge';end if;
 if (select (to_jsonb(p)-'author_is_admin')::text from public.bg3ro_discussion_posts p where id=current_setting('qa.badge_post')::uuid)<>current_setting('qa.badge_snapshot') or (select (to_jsonb(p)-'author_is_admin')::text from public.bg3ro_bug_reports p where id=current_setting('qa.badge_report')::uuid)<>current_setting('qa.badge_report_snapshot') then raise exception 'Badge refresh changed post/report content';end if;
end;$$;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 if not (select author_is_admin from public.bg3ro_discussion_posts where id=current_setting('qa.badge_post')::uuid) or not (select author_is_admin from public.bg3ro_bug_reports where id=current_setting('qa.badge_report')::uuid) then raise exception 'Visitors cannot see verified badges';end if;
end;$$;
reset role;
rollback;
