-- Diagnostic accounts/content are never retained.
begin;
select set_config('bg3ro.qa_avatar',gen_random_uuid()::text,true),
 set_config('bg3ro.qa_guest',gen_random_uuid()::text,true),
 set_config('bg3ro.qa_bad',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,is_anonymous,raw_app_meta_data,raw_user_meta_data) values
 (current_setting('bg3ro.qa_avatar')::uuid,'authenticated','authenticated',false,'{"provider":"discord"}','{"avatar_url":"https://cdn.discordapp.com/avatars/123456789/test.png"}'),
 (current_setting('bg3ro.qa_guest')::uuid,'authenticated','authenticated',true,'{"provider":"anonymous"}','{"avatar_url":"https://cdn.discordapp.com/avatars/123456789/forged.png"}'),
 (current_setting('bg3ro.qa_bad')::uuid,'authenticated','authenticated',false,'{"provider":"discord"}','{"avatar_url":"https://tracker.example.invalid/image.png"}');
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_avatar'),true),set_config('request.jwt.claims','{"is_anonymous":false}',true);
set local role authenticated;
do $$ declare post uuid; begin
 insert into public.bg3ro_discussion_posts(author_name,title,body) values('QA Discord','Avatar diagnostic','This is a rollback-only diagnostic message.') returning id into post;
 perform set_config('bg3ro.qa_post',post::text,true);
 if not exists(select 1 from public.bg3ro_discussion_posts where id=post and author_avatar_url='https://cdn.discordapp.com/avatars/123456789/test.png') then raise exception 'Discord avatar missing'; end if;
 begin
  update public.bg3ro_discussion_posts set author_avatar_url=null where id=post;
  raise exception 'Avatar writable';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.bg3ro_discussion_posts(author_name,title,body,author_avatar_url) values('QA','Forged avatar','Forged avatar diagnostic message.','https://cdn.discordapp.com/avatars/123456789/forged.png');
  raise exception 'Client avatar accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_guest'),true),set_config('request.jwt.claims','{"is_anonymous":true}',true);
set local role authenticated;
do $$ declare post uuid; begin
 insert into public.bg3ro_discussion_posts(author_name,title,body) values('QA Guest','Guest diagnostic','Guest diagnostic message in rollback transaction.') returning id into post;
 if exists(select 1 from public.bg3ro_discussion_posts where id=post and author_avatar_url is not null) then raise exception 'Guest copied remote avatar'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('bg3ro.qa_bad'),true),set_config('request.jwt.claims','{"is_anonymous":false}',true);
set local role authenticated;
do $$ declare post uuid; begin
 insert into public.bg3ro_discussion_posts(author_name,title,body) values('QA Bad','URL diagnostic','Unsafe URL diagnostic message in rollback transaction.') returning id into post;
 if exists(select 1 from public.bg3ro_discussion_posts where id=post and author_avatar_url is not null) then raise exception 'Untrusted image host accepted'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ begin
 if not exists(select 1 from public.bg3ro_discussion_posts where id=current_setting('bg3ro.qa_post')::uuid and author_avatar_url is not null) then raise exception 'Public avatar hidden'; end if;
 begin
  perform raw_user_meta_data from auth.users;
  raise exception 'Auth metadata publicly exposed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: server-selected Discord avatars, guest fallback, untrusted hosts rejected, no client avatar writes, no Auth metadata exposure. All QA data rolled back.' as result;
