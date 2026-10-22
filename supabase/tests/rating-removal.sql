-- Diagnostic accounts and ratings are rolled back, never left on the site.
begin;
select set_config('bg3ro.qa_rating_a',gen_random_uuid()::text,true),
       set_config('bg3ro.qa_rating_b',gen_random_uuid()::text,true);
insert into auth.users(id,is_anonymous) values
 (current_setting('bg3ro.qa_rating_a')::uuid,false),
 (current_setting('bg3ro.qa_rating_b')::uuid,false);
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_rating_a'),true),
       set_config('request.jwt.claims','{"is_anonymous":false}',true);
set local role authenticated;
insert into public.bg3ro_ratings(user_id,rating) values(auth.uid(),4);
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_rating_b'),true);
set local role authenticated;
do $$ begin
 delete from public.bg3ro_ratings where user_id=current_setting('bg3ro.qa_rating_a')::uuid;
 if found then raise exception 'Another member deleted the rating';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_rating_a'),true),
       set_config('request.jwt.claims','{"is_anonymous":true}',true);
set local role authenticated;
do $$ begin
 delete from public.bg3ro_ratings where user_id=auth.uid();
 if found then raise exception 'Guest deleted a member rating';end if;
end $$;
reset role;
set local role anon;
select set_config('bg3ro.qa_rating_count',public.bg3ro_sidebar_stats()->>'rating_count',true);
reset role;
select set_config('request.jwt.claims','{"is_anonymous":false}',true);
set local role authenticated;
do $$ begin
 delete from public.bg3ro_ratings where user_id=auth.uid();
 if not found then raise exception 'Member could not remove own rating';end if;
 if exists(select 1 from public.bg3ro_ratings where user_id=auth.uid()) then raise exception 'Rating remains';end if;
end $$;
reset role;
set local role anon;
do $$ begin
 if (public.bg3ro_sidebar_stats()->>'rating_count')::int <> current_setting('bg3ro.qa_rating_count')::int-1 then
  raise exception 'Public rating count did not decrease';
 end if;
end $$;
reset role;
rollback;
select 'PASS: own rating removal, member/guest isolation and public aggregate refresh. All diagnostic data rolled back.' as result;
