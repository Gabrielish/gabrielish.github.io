begin;
set local role anon;
do $$ begin
 begin perform public.bg3ro_admin_users();raise exception 'Anonymous directory access unexpectedly allowed';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000099","user_metadata":{"moderator":true,"is_admin":true}}',true);
set local role authenticated;
do $$ begin
 begin perform public.bg3ro_admin_users();raise exception 'Member/metadata directory access unexpectedly allowed';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',(select user_id::text from bg3ro_private.moderators limit 1),true);end$$;
set local role authenticated;
do $$declare result jsonb;begin
 result:=public.bg3ro_admin_users('', 'newest','all',0,1);
 if (result->>'total')::int<1 or jsonb_array_length(result->'users')<>1 then raise exception 'Admin directory missing';end if;
 if (result->'users'->0)?'email' then raise exception 'Unrequested private fields exposed';end if;
 result:=public.bg3ro_admin_users('unmatchable-directory-qa-795248','name','all',0,24);
 if (result->>'total')::int<>0 then raise exception 'Search filter ignored';end if;
end $$;
rollback;
select true as admin_directory_allow_deny_passed;
