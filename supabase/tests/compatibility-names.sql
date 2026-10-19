begin;
select set_config('test.compatibility_user',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.compatibility_user')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.compatibility_user'),true);
select set_config('request.jwt.claims','{"is_anonymous":false,"user_metadata":{"user_name":"TestDiscord","email":"private@example.invalid"}}',true);
set local role authenticated;
insert into public.bg3ro_compatibility(user_id,works,platform,mod_version) values(auth.uid(),true,'windows','test-name');
do $$ begin
  if (select author_name from public.bg3ro_compatibility where user_id=auth.uid())<>'TestDiscord' then raise exception 'Display name missing'; end if;
  begin update public.bg3ro_compatibility set author_name='Other user';raise exception 'Name forging allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ declare recent jsonb; begin
  select entry into recent from jsonb_array_elements(public.bg3ro_sidebar_stats()->'recent') entry where entry->>'mod_version'='test-name';
  if recent->>'author_name'<>'TestDiscord' then raise exception 'Public name unavailable'; end if;
  if recent ? 'user_id' or recent ? 'email' then raise exception 'Private identity exposed'; end if;
  begin perform user_id from public.bg3ro_compatibility;raise exception 'UUID exposed';exception when insufficient_privilege then null;end;
end $$;
rollback;
