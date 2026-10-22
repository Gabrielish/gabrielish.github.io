-- Diagnostic records exist only until ROLLBACK.
begin;
select set_config('bg3ro.qa_details_a',gen_random_uuid()::text,true),set_config('bg3ro.qa_details_b',gen_random_uuid()::text,true);
insert into auth.users(id,is_anonymous) values(current_setting('bg3ro.qa_details_a')::uuid,false),(current_setting('bg3ro.qa_details_b')::uuid,false);
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_details_a'),true),set_config('request.jwt.claims','{"is_anonymous":false}',true);
set local role authenticated;
insert into public.bg3ro_compatibility(user_id,works,platform,game_version,problem_description,mod_version)
 values(auth.uid(),false,'windows','4.1.1','Diacritice lipsă. <img src=x>','QA-details-rollback');
do $$ begin
 if (select problem_description from public.bg3ro_compatibility where user_id=auth.uid()) <> 'Diacritice lipsă. <img src=x>' then raise exception 'Own details missing';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_details_b'),true);
set local role authenticated;
do $$ begin
 update public.bg3ro_compatibility set problem_description='Unauthorized' where user_id=current_setting('bg3ro.qa_details_a')::uuid;
 if found then raise exception 'Another user updated report details';end if;
 begin
  insert into public.bg3ro_compatibility(user_id,works,platform,problem_description) values(auth.uid(),false,'windows',repeat('x',1001));
  raise exception 'Oversized description allowed';
 exception when check_violation then null;end;
end $$;
reset role;
set local role anon;
do $$ declare entry jsonb;begin
 select value into entry from jsonb_array_elements(public.bg3ro_sidebar_stats()->'recent') where value->>'mod_version'='QA-details-rollback';
 if entry->>'game_version' is distinct from '4.1.1' or entry->>'problem_description' is distinct from 'Diacritice lipsă. <img src=x>' then raise exception 'Public details unavailable';end if;
 if entry ? 'user_id' then raise exception 'User ID exposed';end if;
end $$;
reset role;
rollback;
select 'PASS: saved/public compatibility details, limits and ownership; all diagnostic data rolled back.' as result;
