begin;
select set_config('qa.dm_a',gen_random_uuid()::text,true),set_config('qa.dm_b',gen_random_uuid()::text,true),set_config('qa.dm_c',gen_random_uuid()::text,true),set_config('qa.dm_guest',gen_random_uuid()::text,true);
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data) values
 (current_setting('qa.dm_a')::uuid,'{"provider":"discord"}','{"full_name":"Alice QA","email":"private@example.com"}'),
 (current_setting('qa.dm_b')::uuid,'{"provider":"discord"}','{"full_name":"Bob QA","avatar_url":"javascript:alert(1)"}'),
 (current_setting('qa.dm_c')::uuid,'{"provider":"discord"}','{"full_name":"Carol QA","moderator":true}');
insert into auth.users(id,is_anonymous) values(current_setting('qa.dm_guest')::uuid,true);
insert into bg3ro_private.moderators(user_id) values(current_setting('qa.dm_c')::uuid);
do $$begin
 if (select avatar_url from public.bg3ro_profiles where id=current_setting('qa.dm_b')::uuid) is not null or exists(select 1 from public.bg3ro_profiles where id=current_setting('qa.dm_guest')::uuid) then raise exception 'Unsafe avatar or guest profile';end if;
 if has_table_privilege('authenticated','public.bg3ro_profiles','UPDATE') then raise exception 'Public profiles writable';end if;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('qa.dm_a'),true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
select set_config('qa.dm_id',public.bg3ro_start_conversation(current_setting('qa.dm_b')::uuid)::text,true);
do $$begin if public.bg3ro_start_conversation(current_setting('qa.dm_b')::uuid)<>current_setting('qa.dm_id')::uuid then raise exception 'Duplicate conversation';end if;end;$$;
insert into public.bg3ro_direct_messages(conversation_id,sender_id,body) values(current_setting('qa.dm_id')::uuid,auth.uid(),'Un mesaj privat numai pentru Bob.');
do $$begin
 if (select count(*) from public.bg3ro_dm_inbox())<>1 then raise exception 'Missing own conversation';end if;
 begin insert into public.bg3ro_direct_messages(conversation_id,sender_id,body) values(current_setting('qa.dm_id')::uuid,auth.uid(),'Spam imediat');raise exception 'Rate limit failed';exception when others then if sqlerrm='Rate limit failed' then raise;end if;end;
end;$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.dm_c'),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.bg3ro_direct_messages where conversation_id=current_setting('qa.dm_id')::uuid) or exists(select 1 from public.bg3ro_conversations where id=current_setting('qa.dm_id')::uuid) or exists(select 1 from public.bg3ro_dm_inbox()) then raise exception 'Nonparticipant administrator reads private conversation';end if;
 begin insert into public.bg3ro_direct_messages(conversation_id,sender_id,body) values(current_setting('qa.dm_id')::uuid,auth.uid(),'Intrus');raise exception 'Intruder sent';exception when insufficient_privilege then null;end;
 begin perform public.bg3ro_mark_conversation(current_setting('qa.dm_id')::uuid,true);raise exception 'Intruder changed receipts';exception when insufficient_privilege then null;end;
end;$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.dm_b'),true);
set local role authenticated;
do $$begin if (select unread from public.bg3ro_dm_inbox() where id=current_setting('qa.dm_id')::uuid)<>1 then raise exception 'Unread missing';end if;end;$$;
select public.bg3ro_mark_conversation(current_setting('qa.dm_id')::uuid,false);
do $$begin if (select unread from public.bg3ro_dm_inbox() where id=current_setting('qa.dm_id')::uuid)<>0 then raise exception 'Read state missing';end if;end;$$;
select public.bg3ro_mark_conversation(current_setting('qa.dm_id')::uuid,true);
do $$begin if exists(select 1 from public.bg3ro_dm_inbox()) then raise exception 'Hidden conversation in own inbox';end if;end;$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.dm_a'),true);
set local role authenticated;
do $$begin if not exists(select 1 from public.bg3ro_dm_inbox()) then raise exception 'Hide removed other participant conversation';end if;end;$$;
reset role;
update bg3ro_private.submission_limits set last_sent=now()-interval '10 seconds' where user_id=current_setting('qa.dm_a')::uuid and kind='direct_message';
set local role authenticated;
insert into public.bg3ro_direct_messages(conversation_id,sender_id,body) values(current_setting('qa.dm_id')::uuid,auth.uid(),'Un mesaj nou readuce conversația ascunsă în listă.');
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.dm_b'),true);
set local role authenticated;
do $$begin
 if public.bg3ro_start_conversation(current_setting('qa.dm_a')::uuid)<>current_setting('qa.dm_id')::uuid then raise exception 'Reverse participant duplicate';end if;
 if (select unread from public.bg3ro_dm_inbox() where id=current_setting('qa.dm_id')::uuid)<>1 then raise exception 'New message did not resurface hidden conversation';end if;
end;$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.dm_guest'),true),set_config('request.jwt.claims','{"is_anonymous":true}',true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.bg3ro_direct_messages) or exists(select 1 from public.bg3ro_dm_inbox()) then raise exception 'Guest reads messages';end if;
 begin perform public.bg3ro_start_conversation(current_setting('qa.dm_a')::uuid);raise exception 'Guest started';exception when insufficient_privilege then null;end;
end;$$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 if (select display_name from public.bg3ro_profiles where id=current_setting('qa.dm_a')::uuid)<>'Alice QA' then raise exception 'Public profile missing';end if;
 if has_table_privilege('anon','public.bg3ro_direct_messages','SELECT') or has_function_privilege('anon','public.bg3ro_dm_inbox()','EXECUTE') then raise exception 'Anonymous private access';end if;
end;$$;
reset role;
rollback;
