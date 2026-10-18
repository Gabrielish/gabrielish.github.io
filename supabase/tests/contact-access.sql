begin;
select set_config('bg3ro.qa_m',gen_random_uuid()::text,true),set_config('bg3ro.qa_a',gen_random_uuid()::text,true),set_config('bg3ro.qa_b',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('bg3ro.qa_m')::uuid),(current_setting('bg3ro.qa_a')::uuid),(current_setting('bg3ro.qa_b')::uuid);
insert into bg3ro_private.moderators values(current_setting('bg3ro.qa_m')::uuid);
set local role anon;
do $$ begin
 begin perform * from public.bg3ro_contact_messages;raise exception 'Anon can read';exception when insufficient_privilege then null;end;
 begin insert into public.bg3ro_contact_messages(name,email,subject,body) values('QA','qa@example.invalid','QA subject','QA message long enough');raise exception 'Anon can insert';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_a'),true),set_config('request.jwt.claims','{"is_anonymous":true}',true);
set local role authenticated;
insert into public.bg3ro_contact_messages(name,email,subject,body) values('QA guest','qa@example.invalid','QA private subject','QA private message long enough');
do $$ begin
 if exists(select 1 from public.bg3ro_contact_messages) then raise exception 'Guest can read inbox';end if;
 begin insert into public.bg3ro_contact_messages(name,email,subject,body) values('QA','qa@example.invalid','QA subject','QA message long enough');raise exception 'Rate limit missing';exception when raise_exception then if sqlerrm not like '%60 de secunde%' then raise;end if;end;
 begin insert into public.bg3ro_contact_messages(author_id,name,email,subject,body) values(current_setting('bg3ro.qa_m')::uuid,'QA','qa@example.invalid','QA subject','QA message long enough');raise exception 'Can forge author';exception when insufficient_privilege then null;end;
 delete from public.bg3ro_contact_messages;if found then raise exception 'Guest can delete';end if;
 update public.bg3ro_contact_messages set is_read=true;if found then raise exception 'Guest can modify';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_b'),true),set_config('request.jwt.claims','{"is_anonymous":false}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.bg3ro_contact_messages) then raise exception 'Member can read inbox';end if;
 begin update public.bg3ro_contact_messages set body='Tampering';raise exception 'Body is editable';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_m'),true);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.bg3ro_contact_messages where subject='QA private subject') then raise exception 'Moderator cannot read';end if;
 update public.bg3ro_contact_messages set is_read=true where subject='QA private subject';
 if not found then raise exception 'Moderator cannot mark read';end if;
 delete from public.bg3ro_contact_messages where subject='QA private subject';
 if not found then raise exception 'Moderator cannot delete';end if;
end $$;
reset role;
rollback;
select 'PASS: private inbox, guest submit, 60s limit, no author spoofing, no member read/edit/delete, moderator read/mark/delete. Rolled back.' as result;
