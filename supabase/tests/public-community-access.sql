-- Hosted regression: diagnostic accounts and content exist only until ROLLBACK.
begin;
select set_config('bg3ro.qa_g',gen_random_uuid()::text,true),
       set_config('bg3ro.qa_a',gen_random_uuid()::text,true),
       set_config('bg3ro.qa_b',gen_random_uuid()::text,true),
       set_config('bg3ro.qa_m',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,is_anonymous)
 select current_setting('bg3ro.qa_'||name)::uuid,'authenticated','authenticated',name='g'
 from unnest(array['g','a','b','m']) name;
insert into bg3ro_private.moderators values(current_setting('bg3ro.qa_m')::uuid);
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_g'),true),
 set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('bg3ro.qa_g'),'is_anonymous',true)::text,true);
set local role authenticated;
do $$ declare post uuid; report uuid; begin
 if public.bg3ro_is_moderator() then raise exception 'Guest promoted'; end if;
 insert into public.bg3ro_discussion_posts(author_name,title,body)
 values('QA Guest','QA guest discussion','Diagnostic message in rollback transaction.') returning id into post;
 perform set_config('bg3ro.qa_post',post::text,true);
 if not exists(select 1 from public.bg3ro_discussion_posts where id=post and is_guest and status='approved') then raise exception 'Guest not published/tagged'; end if;
 insert into public.bg3ro_bug_reports(author_name,title,body,category,platform,mod_version,is_public)
 values('QA Guest','QA public report','Diagnostic public report in rollback transaction.','text','windows','test',true) returning id into report;
 perform set_config('bg3ro.qa_report',report::text,true);
 if not exists(select 1 from public.bg3ro_bug_reports where id=report and is_guest) then raise exception 'Guest report not tagged'; end if;
 begin
  insert into public.bg3ro_ratings(user_id,rating) values(auth.uid(),5);
  raise exception 'Guest rating allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.bg3ro_compatibility(user_id,works,platform) values(auth.uid(),true,'windows');
  raise exception 'Guest vote allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.bg3ro_discussion_posts(author_name,title,body,is_guest) values('QA','Forged guest','Forged guest metadata.',false);
  raise exception 'Guest metadata writable';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.bg3ro_discussion_posts(author_name,title,body) values('QA','Too soon','Rate limit diagnostic message.');
  raise exception 'Rate limit missing';
 exception when raise_exception then
  if sqlerrm not like '%30 de secunde%' then raise; end if;
 end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_a'),true),
 set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('bg3ro.qa_a'),'is_anonymous',false)::text,true);
set local role authenticated;
do $$ declare report uuid; begin
 insert into public.bg3ro_bug_reports(title,body,category,platform,mod_version)
 values('QA private report','Diagnostic legacy private report in rollback transaction.','text','windows','test') returning id into report;
 perform set_config('bg3ro.qa_private',report::text,true);
 insert into public.bg3ro_ratings(user_id,rating) values(auth.uid(),4);
 insert into public.bg3ro_compatibility(user_id,works,platform) values(auth.uid(),true,'windows');
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ begin
 if not exists(select 1 from public.bg3ro_bug_reports where id=current_setting('bg3ro.qa_report')::uuid) then raise exception 'Public report hidden'; end if;
 if exists(select 1 from public.bg3ro_bug_reports where id=current_setting('bg3ro.qa_private')::uuid) then raise exception 'Private history exposed'; end if;
 if not exists(select 1 from public.bg3ro_discussion_posts where id=current_setting('bg3ro.qa_post')::uuid) then raise exception 'Public post hidden'; end if;
 begin
  perform author_id from public.bg3ro_bug_reports;
  raise exception 'Anonymous author UUID access';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_b'),true),
 set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('bg3ro.qa_b'),'is_anonymous',false)::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.bg3ro_bug_reports where id=current_setting('bg3ro.qa_private')::uuid) then raise exception 'Other user sees private history'; end if;
 delete from public.bg3ro_bug_reports where id=current_setting('bg3ro.qa_report')::uuid;
 if found then raise exception 'Other user deletes report'; end if;
 delete from public.bg3ro_discussion_posts where id=current_setting('bg3ro.qa_post')::uuid;
 if found then raise exception 'Other user deletes post'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_m'),true),
 set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('bg3ro.qa_m'),'is_anonymous',false)::text,true);
set local role authenticated;
do $$ begin
 if not public.bg3ro_is_moderator() then raise exception 'Moderator not recognized'; end if;
 if not exists(select 1 from public.bg3ro_bug_reports where id=current_setting('bg3ro.qa_private')::uuid) then raise exception 'Moderator cannot read private report'; end if;
 delete from public.bg3ro_bug_reports where id=current_setting('bg3ro.qa_report')::uuid;
 if not found then raise exception 'Moderator cannot delete report'; end if;
 delete from public.bg3ro_discussion_posts where id=current_setting('bg3ro.qa_post')::uuid;
 if not found then raise exception 'Moderator cannot delete post'; end if;
end $$;
reset role;
rollback;
select 'PASS: public community reads, private history preserved, guest posts/reports, guest vote/rating denial, member votes, rate limits, moderator deletion. All diagnostic data rolled back.' as result;
