begin;
create temporary table badge_guard_fixture(body text,revision integer default 0);
create trigger guard_badges before insert or update on badge_guard_fixture
 for each row execute function bg3ro_private.guard_admin_editor_badges('body');
grant select,insert,update on badge_guard_fixture to authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
set local role authenticated;
insert into badge_guard_fixture(body) values('Mesaj obișnuit fără etichete');
do $$ begin
 begin
  insert into badge_guard_fixture(body) values('BG3RO-RICH-1:{"type":"doc","content":[{"type":"paragraph","content":[{"type":"badge","attrs":{"label":"Fals"}}]}]}');
  raise exception 'Member badge accepted';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into badge_guard_fixture(body) values('BG3RO-RICH-1:{"type":"doc","content":[{"type":"paragraph","content":[{"type":"\u0062adge","attrs":{"label":"Fals"}}]}]}');
  raise exception 'Escaped member badge accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select set_config('request.jwt.claims',(select json_build_object('sub',user_id,'role','authenticated')::text from bg3ro_private.moderators limit 1),true);
set local role authenticated;
insert into badge_guard_fixture(body) values('BG3RO-RICH-1:{"type":"doc","content":[{"type":"paragraph","content":[{"type":"badge","attrs":{"label":"Etichetă admin"}}]}]}');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
set local role authenticated;
update badge_guard_fixture set revision=revision+1;
do $$ begin
 if (select count(*) from badge_guard_fixture)<>2 then raise exception 'Unexpected rows';end if;
end $$;
rollback;
select 'PASS: normal text and administrator badges accepted; non-admin and escaped badge attempts rejected; unrelated updates preserved' as result;
