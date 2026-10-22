begin;
select set_config('test.poll_actor',gen_random_uuid()::text,true),set_config('test.poll_guest',gen_random_uuid()::text,true);
insert into auth.users(id,is_anonymous) values(current_setting('test.poll_actor')::uuid,false),(current_setting('test.poll_guest')::uuid,true);
select set_config('request.jwt.claim.sub',current_setting('test.poll_actor'),true),set_config('request.jwt.claims','{"is_anonymous":false}',true);
set local role authenticated;
select set_config('test.poll_id',public.bg3ro_publish_poll('Poll test','Un sondaj temporar pentru verificări.','Ce variantă preferi?',array['Prima','A doua'],false)::text,true);
select public.bg3ro_vote_poll(current_setting('test.poll_id')::uuid,array[0]);
do $$ declare result record;begin
 select * into result from public.bg3ro_poll_summary(array[current_setting('test.poll_id')::uuid]);
 if result.counts <> '[1,0]'::jsonb or result.choices <> array[0] or result.voters <> 1 then raise exception 'First vote missing';end if;
 perform public.bg3ro_vote_poll(result.post_id,array[1]);
 select * into result from public.bg3ro_poll_summary(array[result.post_id]);
 if result.counts <> '[0,1]'::jsonb or result.voters <> 1 then raise exception 'Vote duplicated instead of replaced';end if;
 begin perform public.bg3ro_vote_poll(result.post_id,array[0,1]);raise exception 'Multiple choices on single poll';exception when raise_exception then if sqlerrm='Multiple choices on single poll' then raise;end if;end;
 begin perform public.bg3ro_vote_poll(result.post_id,array[2]);raise exception 'Invalid option accepted';exception when raise_exception then if sqlerrm='Invalid option accepted' then raise;end if;end;
 begin perform * from bg3ro_private.poll_votes;raise exception 'Voter identities exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.poll_guest'),true),set_config('request.jwt.claims','{"is_anonymous":true}',true);
set local role authenticated;
select public.bg3ro_vote_poll(current_setting('test.poll_id')::uuid,array[0]);
do $$ declare result record;begin
 select * into result from public.bg3ro_poll_summary(array[current_setting('test.poll_id')::uuid]);
 if result.counts <> '[1,1]'::jsonb or result.choices <> array[0] or result.voters <> 2 then raise exception 'Guest voting/choice privacy failed';end if;
 perform public.bg3ro_vote_poll(result.post_id,'{}');
end $$;
reset role;
set local role anon;
do $$ declare result record;begin
 select * into result from public.bg3ro_poll_summary(array[current_setting('test.poll_id')::uuid]);
 if result.counts <> '[0,1]'::jsonb or cardinality(result.choices)<>0 then raise exception 'Anonymous summary exposed choices';end if;
 begin perform public.bg3ro_vote_poll(result.post_id,array[0]);raise exception 'Unauthenticated write allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.poll_actor'),true),set_config('request.jwt.claims','{"is_anonymous":false}',true);
delete from bg3ro_private.submission_limits where user_id=auth.uid();
set local role authenticated;
select set_config('test.poll_multi',public.bg3ro_publish_poll('Poll test','Un sondaj multiplu de verificare.','Ce variante preferi?',array['Prima','A doua','A treia'],true)::text,true);
select public.bg3ro_vote_poll(current_setting('test.poll_multi')::uuid,array[0,2]);
do $$ declare result record;begin
 select * into result from public.bg3ro_poll_summary(array[current_setting('test.poll_multi')::uuid]);
 if result.counts <> '[1,0,1]'::jsonb or result.voters<>1 then raise exception 'Multiple vote counts failed';end if;
end $$;
reset role;
delete from bg3ro_private.submission_limits where user_id=auth.uid();
set local role authenticated;
do $$ declare before_count bigint;begin
 select count(*) into before_count from public.bg3ro_discussion_posts where author_id=auth.uid();
 begin perform public.bg3ro_publish_poll('Poll test','Un mesaj pentru sondaj invalid.','Opțiuni duplicate?',array['Prima','prima'],false);raise exception 'Duplicate options accepted';exception when check_violation then null;end;
 if (select count(*) from public.bg3ro_discussion_posts where author_id=auth.uid())<>before_count then raise exception 'Invalid poll left orphan comment';end if;
end $$;
reset role;
update public.bg3ro_discussion_posts set status='rejected' where id=current_setting('test.poll_id')::uuid;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.bg3ro_poll_summary(array[current_setting('test.poll_id')::uuid])) then raise exception 'Rejected poll visible';end if;
 begin perform public.bg3ro_vote_poll(current_setting('test.poll_id')::uuid,array[0]);raise exception 'Rejected poll writable';exception when raise_exception then if sqlerrm='Rejected poll writable' then raise;end if;end;
end $$;
reset role;
delete from public.bg3ro_discussion_posts where id=current_setting('test.poll_id')::uuid;
do $$ begin
 if exists(select 1 from bg3ro_private.poll_votes where post_id=current_setting('test.poll_id')::uuid) then raise exception 'Votes did not cascade';end if;
end $$;
rollback;
select 'PASS: atomic poll creation, validation, member/guest voting, single/multiple/change/remove, private choices, moderation and cascade; all fixtures rolled back.' as result;
