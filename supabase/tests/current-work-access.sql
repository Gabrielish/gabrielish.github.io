begin;
select set_config('bg3ro.qa_m',gen_random_uuid()::text,true),set_config('bg3ro.qa_a',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role) values(current_setting('bg3ro.qa_m')::uuid,'authenticated','authenticated'),(current_setting('bg3ro.qa_a')::uuid,'authenticated','authenticated');
insert into bg3ro_private.moderators values(current_setting('bg3ro.qa_m')::uuid);
set local role anon;
do $$ begin
 if not exists(select 1 from public.bg3ro_project_status where id=1 and work_title is not null) then raise exception 'Public read missing'; end if;
 begin
  update public.bg3ro_project_status set work_title='Anonymous write' where id=1;
  raise exception 'Anonymous can edit';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_a'),true),set_config('request.jwt.claims','{"is_anonymous":false}',true);
set local role authenticated;
do $$ begin
 update public.bg3ro_project_status set work_body='Member write' where id=1;
 if found then raise exception 'Normal member can edit'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"is_anonymous":true}',true);
set local role authenticated;
do $$ begin
 update public.bg3ro_project_status set work_note='Guest write' where id=1;
 if found then raise exception 'Guest can edit'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_m'),true),set_config('request.jwt.claims','{"is_anonymous":false}',true);
set local role authenticated;
do $$ begin
 update public.bg3ro_project_status set work_title='QA title',work_body='QA body',work_note='' where id=1;
 if not found then raise exception 'Moderator cannot edit'; end if;
 if not exists(select 1 from public.bg3ro_project_status where id=1 and work_title='QA title' and work_body='QA body' and work_note='') then raise exception 'Edits not saved'; end if;
 begin
  update public.bg3ro_project_status set work_title='' where id=1;
  raise exception 'Empty title accepted';
 exception when check_violation then null; end;
end $$;
reset role;
rollback;
select 'PASS: public reads, guest/member/anonymous writes denied, moderator edits all three fields, optional empty note, title bounds. Diagnostic changes rolled back.' as result;
