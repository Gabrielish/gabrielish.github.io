begin;
select set_config('qa.image_member',gen_random_uuid()::text,true),set_config('qa.image_other',gen_random_uuid()::text,true),set_config('qa.image_guest',gen_random_uuid()::text,true),set_config('qa.image_name',gen_random_uuid()::text||'.jpg',true);
insert into auth.users(id,raw_app_meta_data) values(current_setting('qa.image_member')::uuid,'{"provider":"discord"}'),(current_setting('qa.image_other')::uuid,'{"provider":"discord"}');
insert into auth.users(id,is_anonymous) values(current_setting('qa.image_guest')::uuid,true);
select set_config('request.jwt.claim.sub',current_setting('qa.image_member'),true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
insert into storage.objects(bucket_id,name,owner_id) values('bg3ro-editor-images',auth.uid()::text||'/'||current_setting('qa.image_name'),auth.uid()::text);
do $$begin
 if not exists(select 1 from storage.objects where bucket_id='bg3ro-editor-images' and name=auth.uid()::text||'/'||current_setting('qa.image_name')) then raise exception 'Missing own image';end if;
 begin insert into storage.objects(bucket_id,name) values('bg3ro-editor-images',current_setting('qa.image_other')||'/'||gen_random_uuid()||'.jpg');raise exception 'Wrong owner accepted';exception when insufficient_privilege then null;end;
end;$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.image_other'),true);
set local role authenticated;
do $$declare affected integer;begin
 if exists(select 1 from storage.objects where bucket_id='bg3ro-editor-images' and name=current_setting('qa.image_member')||'/'||current_setting('qa.image_name')) then raise exception 'Other user lists unpublished image';end if;
 begin delete from storage.objects where bucket_id='bg3ro-editor-images' and name=current_setting('qa.image_member')||'/'||current_setting('qa.image_name');get diagnostics affected=row_count;if affected<>0 then raise exception 'Other user deleted image';end if;exception when insufficient_privilege then null;end;
end;$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.image_guest'),true),set_config('request.jwt.claims','{"is_anonymous":true}',true);
set local role authenticated;
do $$begin
 begin insert into storage.objects(bucket_id,name) values('bg3ro-editor-images',auth.uid()::text||'/'||gen_random_uuid()||'.jpg');raise exception 'Guest upload accepted';exception when insufficient_privilege then null;end;
end;$$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin if exists(select 1 from storage.objects where bucket_id='bg3ro-editor-images') then raise exception 'Anonymous draft listing';end if;end;$$;
reset role;
do $$begin if not exists(select 1 from storage.buckets where id='bg3ro-editor-images' and public and file_size_limit=5242880 and allowed_mime_types=array['image/jpeg']) then raise exception 'Incorrect bucket limits';end if;end;$$;
rollback;
