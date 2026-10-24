begin;
select set_config('qa.account_a',gen_random_uuid()::text,true),set_config('qa.account_b',gen_random_uuid()::text,true),set_config('qa.account_m',gen_random_uuid()::text,true);
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data) values
 (current_setting('qa.account_a')::uuid,'{"provider":"discord"}','{"full_name":"Alice QA"}'),
 (current_setting('qa.account_b')::uuid,'{"provider":"discord"}','{"full_name":"Bob QA"}'),
 (current_setting('qa.account_m')::uuid,'{"provider":"discord"}','{"full_name":"Moderator QA"}');
insert into bg3ro_private.moderators(user_id) values(current_setting('qa.account_m')::uuid);
select set_config('request.jwt.claim.sub',current_setting('qa.account_a'),true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
update public.bg3ro_profiles set display_name='Nume personalizat',bio='Biografie de test.',avatar_url='https://gatkiwcyjgbgjwfgvplm.supabase.co/storage/v1/object/public/bg3ro-avatars/'||auth.uid()::text||'/'||gen_random_uuid()::text||'.jpg' where id=auth.uid();
do $$declare affected integer;begin
 begin update public.bg3ro_profiles set is_admin=true where id=auth.uid();raise exception 'Admin escalation';exception when insufficient_privilege then null;end;
 begin update public.bg3ro_profiles set avatar_url='https://example.com/track.png' where id=auth.uid();raise exception 'Unsafe avatar';exception when others then if sqlerrm='Unsafe avatar' then raise;end if;end;
 update public.bg3ro_profiles set bio='Hacked' where id=current_setting('qa.account_b')::uuid;get diagnostics affected=row_count;if affected<>0 then raise exception 'Other profile update';end if;
end;$$;
reset role;
update auth.users set raw_user_meta_data='{"full_name":"Discord updated","avatar_url":"https://cdn.discordapp.com/embed/avatars/0.png","moderator":true}' where id=current_setting('qa.account_a')::uuid;
do $$begin if not exists(select 1 from public.bg3ro_profiles where id=current_setting('qa.account_a')::uuid and display_name='Nume personalizat' and custom_name and custom_avatar and not is_admin and avatar_url like '%bg3ro-avatars%') then raise exception 'Discord overwrote profile settings';end if;end;$$;
select set_config('request.jwt.claim.sub',current_setting('qa.account_b'),true);
set local role authenticated;
insert into public.bg3ro_account_preferences(user_id,notify_replies,favorite_project) values(auth.uid(),false,true);
with added as(insert into public.bg3ro_discussion_posts(author_id,author_name,title,body) values(auth.uid(),'Bob QA','Discuție de test','Un mesaj suficient de lung pentru notificări.') returning id)select set_config('qa.account_root',id::text,true) from added;
insert into public.bg3ro_ratings(user_id,rating) values(auth.uid(),5);
do $$begin if (public.bg3ro_my_progress()->>'points')::integer<>3 then raise exception 'Activity points not based on actual contributions';end if;end;$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.account_a'),true);
set local role authenticated;
insert into public.bg3ro_discussion_posts(author_id,author_name,title,body,parent_id) values(auth.uid(),'Alice QA','Răspuns','Un răspuns suficient de lung pentru test.',current_setting('qa.account_root')::uuid);
reset role;
do $$begin if exists(select 1 from public.bg3ro_notifications where user_id=current_setting('qa.account_b')::uuid) then raise exception 'Reply preference ignored';end if;end;$$;
update public.bg3ro_account_preferences set notify_replies=true where user_id=current_setting('qa.account_b')::uuid;
update bg3ro_private.submission_limits set last_sent=now()-interval '1 minute' where user_id=current_setting('qa.account_a')::uuid;
set local role authenticated;
insert into public.bg3ro_discussion_posts(author_id,author_name,title,body,parent_id) values(auth.uid(),'Alice QA','Răspuns','Al doilea răspuns suficient de lung pentru test.',current_setting('qa.account_root')::uuid);
select set_config('qa.account_conversation',public.bg3ro_start_conversation(current_setting('qa.account_b')::uuid)::text,true);
insert into public.bg3ro_direct_messages(conversation_id,sender_id,body) values(current_setting('qa.account_conversation')::uuid,auth.uid(),'Text privat care nu trebuie copiat în notificare.');
do $$begin if exists(select 1 from public.bg3ro_notifications where user_id=current_setting('qa.account_b')::uuid) then raise exception 'Other notification read';end if;end;$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.account_b'),true);
set local role authenticated;
do $$begin
 if (select count(*) from public.bg3ro_notifications)<>2 then raise exception 'Reply or message notifications missing';end if;
 if exists(select 1 from public.bg3ro_notifications where title like '%Text privat%') then raise exception 'Private body leaked into notification';end if;
 begin insert into public.bg3ro_notifications(user_id,kind,title,target) values(auth.uid(),'reply','Fake','#discutii');raise exception 'Fake notification insert';exception when insufficient_privilege then null;end;
end;$$;
update public.bg3ro_notifications set read_at=now();
insert into public.bg3ro_account_requests(user_id) values(auth.uid());
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.account_a'),true);
set local role authenticated;
do $$begin if exists(select 1 from public.bg3ro_account_requests) or exists(select 1 from public.bg3ro_account_preferences where user_id<>auth.uid()) then raise exception 'Private settings/request leak';end if;end;$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.account_m'),true);
set local role authenticated;
do $$begin if not exists(select 1 from public.bg3ro_account_requests where user_id=current_setting('qa.account_b')::uuid) or not exists(select 1 from public.bg3ro_notifications where kind='account') then raise exception 'Administrator deletion queue missing';end if;end;$$;
update public.bg3ro_account_requests set status='handled' where user_id=current_setting('qa.account_b')::uuid;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 if (select bio from public.bg3ro_profiles where id=current_setting('qa.account_a')::uuid)<>'Biografie de test.' then raise exception 'Public biography missing';end if;
 if has_table_privilege('anon','public.bg3ro_notifications','SELECT') or has_table_privilege('anon','public.bg3ro_account_preferences','SELECT') then raise exception 'Anonymous private account access';end if;
end;$$;
reset role;
rollback;
