-- Diagnostic transaction. No test accounts, reports or messages are retained.
begin;
select set_config('bg3ro.qa_a',gen_random_uuid()::text,true),
       set_config('bg3ro.qa_b',gen_random_uuid()::text,true),
       set_config('bg3ro.qa_m',gen_random_uuid()::text,true);
insert into auth.users(id,email,aud,role) values
  (current_setting('bg3ro.qa_a')::uuid,'qa-'||current_setting('bg3ro.qa_a')||'@example.invalid','authenticated','authenticated'),
  (current_setting('bg3ro.qa_b')::uuid,'qa-'||current_setting('bg3ro.qa_b')||'@example.invalid','authenticated','authenticated'),
  (current_setting('bg3ro.qa_m')::uuid,'qa-'||current_setting('bg3ro.qa_m')||'@example.invalid','authenticated','authenticated');
insert into bg3ro_private.moderators values(current_setting('bg3ro.qa_m')::uuid);

set local role anon;
do $$ begin
  if (select count(*) from public.bg3ro_project_status) <> 1 then raise exception 'Public status unavailable'; end if;
  begin
    perform author_id from public.bg3ro_bug_reports;
    raise exception 'Anonymous private identity read unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_a'),true);
set local role authenticated;
do $$ declare post_id uuid; begin
  if public.bg3ro_is_moderator() then raise exception 'Normal user promoted'; end if;
  insert into public.bg3ro_discussion_posts(author_name,title,body)
    values('QA Player','QA diagnostic','Test message inside rollback transaction.') returning id into post_id;
  perform set_config('bg3ro.qa_post',post_id::text,true);
  if (select status from public.bg3ro_discussion_posts where id=post_id) <> 'approved' then raise exception 'Message not published immediately'; end if;
  update public.bg3ro_discussion_posts set status='rejected' where id=post_id;
  if found then raise exception 'Owner can moderate'; end if;
  insert into public.bg3ro_bug_reports(title,body,category,platform,mod_version)
    values('QA diagnostic report','Private QA report inside rollback transaction.','text','windows','test');
  if (select count(*) from public.bg3ro_bug_reports where author_id=auth.uid()) <> 1 then raise exception 'Owner cannot read own report'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_b'),true);
set local role authenticated;
do $$ begin
  if not exists(select 1 from public.bg3ro_discussion_posts where id=current_setting('bg3ro.qa_post')::uuid) then raise exception 'Other user cannot see immediate post'; end if;
  if exists(select 1 from public.bg3ro_bug_reports where author_id=current_setting('bg3ro.qa_a')::uuid) then raise exception 'Other user sees private report'; end if;
  update public.bg3ro_project_status set translation_percent=99 where id=1;
  if found then raise exception 'Normal user can change progress'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_m'),true);
set local role authenticated;
do $$ begin
  if not public.bg3ro_is_moderator() then raise exception 'Moderator not recognized'; end if;
  if not exists(select 1 from public.bg3ro_bug_reports where author_id=current_setting('bg3ro.qa_a')::uuid) then raise exception 'Moderator cannot read reports'; end if;
  update public.bg3ro_discussion_posts set status='approved' where id=current_setting('bg3ro.qa_post')::uuid;
  if not found then raise exception 'Moderator cannot approve'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
  if not exists(select 1 from public.bg3ro_discussion_posts where id=current_setting('bg3ro.qa_post')::uuid) then raise exception 'Approved message not public'; end if;
end $$;
reset role;
rollback;
select 'PASS: hosted public reads, immediately published messages, owner-only reports and moderator permissions. Diagnostic data rolled back.' as result;
