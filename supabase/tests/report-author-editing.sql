begin;
-- Isolated identities and reports; every fixture is rolled back.
select set_config('bg3ro.qa_author',gen_random_uuid()::text,true),
 set_config('bg3ro.qa_other',gen_random_uuid()::text,true),
 set_config('bg3ro.qa_admin',gen_random_uuid()::text,true),
 set_config('bg3ro.qa_report',gen_random_uuid()::text,true),
 set_config('bg3ro.qa_other_report',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('bg3ro.qa_author')::uuid),
 (current_setting('bg3ro.qa_other')::uuid),(current_setting('bg3ro.qa_admin')::uuid);
insert into bg3ro_private.moderators(user_id) values(current_setting('bg3ro.qa_admin')::uuid);
-- Creation uses the existing submission checks, once per identity.
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_author'),true),set_config('request.jwt.claims','{}',true);
insert into public.bg3ro_bug_reports(id,author_id,title,body,category,platform,mod_version,is_public)
 values(current_setting('bg3ro.qa_report')::uuid,current_setting('bg3ro.qa_author')::uuid,'Raport sintetic','Context sintetic suficient de lung pentru raport.','text','windows','test',true);
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_other'),true),set_config('request.jwt.claims','{"is_anonymous":true}',true);
insert into public.bg3ro_bug_reports(id,author_id,title,body,category,platform,mod_version,is_public)
 values(current_setting('bg3ro.qa_other_report')::uuid,current_setting('bg3ro.qa_other')::uuid,'Raport sintetic oaspete','Context sintetic suficient de lung pentru raport.','text','windows','test',true);
create function pg_temp.must_deny_report_write(command text) returns void language plpgsql security invoker as $$
begin
 begin execute command;
 exception when insufficient_privilege then return;end;
 raise exception 'Unauthorized report write succeeded: %',command;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_admin'),true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
update public.bg3ro_bug_reports set status='resolved',moderator_reply='Răspuns al administratorului.' where id=current_setting('bg3ro.qa_report')::uuid;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_author'),true);
set local role authenticated;
update public.bg3ro_bug_reports set title='Titlu corectat',body='Text corectat de autor după răspunsul proiectului.' where id=current_setting('bg3ro.qa_report')::uuid;
do $$ declare affected integer;begin
 if not exists(select 1 from public.bg3ro_bug_reports where id=current_setting('bg3ro.qa_report')::uuid and title='Titlu corectat' and status='resolved' and moderator_reply='Răspuns al administratorului.') then raise exception 'Own report edit failed or changed moderation';end if;
 update public.bg3ro_bug_reports set body='Text străin care nu trebuie să se salveze.' where id=current_setting('bg3ro.qa_other_report')::uuid;
 get diagnostics affected=row_count;if affected<>0 then raise exception 'Edited another author report';end if;
end;$$;
select pg_temp.must_deny_report_write(format('update public.bg3ro_bug_reports set status=%L where id=%L','closed',current_setting('bg3ro.qa_report')));
select pg_temp.must_deny_report_write(format('update public.bg3ro_bug_reports set moderator_reply=%L where id=%L','Răspuns fals',current_setting('bg3ro.qa_report')));
select pg_temp.must_deny_report_write(format('update public.bg3ro_bug_reports set title=%L,status=%L where id=%L','Titlu mixt','new',current_setting('bg3ro.qa_report')));
select pg_temp.must_deny_report_write(format('update public.bg3ro_bug_reports set author_id=%L where id=%L',current_setting('bg3ro.qa_other'),current_setting('bg3ro.qa_report')));
do $$ declare affected integer;begin
 delete from public.bg3ro_bug_reports where id=current_setting('bg3ro.qa_other_report')::uuid;get diagnostics affected=row_count;if affected<>0 then raise exception 'Deleted another author report';end if;
 delete from public.bg3ro_bug_reports where id=current_setting('bg3ro.qa_report')::uuid;get diagnostics affected=row_count;if affected<>1 then raise exception 'Cannot delete own report';end if;
end;$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_other'),true),set_config('request.jwt.claims','{"is_anonymous":true}',true);
set local role authenticated;
update public.bg3ro_bug_reports set body='Text modificat de oaspetele care deține raportarea.' where id=current_setting('bg3ro.qa_other_report')::uuid;
select pg_temp.must_deny_report_write(format('update public.bg3ro_bug_reports set status=%L where id=%L','closed',current_setting('bg3ro.qa_other_report')));
do $$begin
 if not exists(select 1 from public.bg3ro_bug_reports where id=current_setting('bg3ro.qa_other_report')::uuid and body='Text modificat de oaspetele care deține raportarea.') then raise exception 'Guest cannot edit own report';end if;
end;$$;
reset role;
rollback;
