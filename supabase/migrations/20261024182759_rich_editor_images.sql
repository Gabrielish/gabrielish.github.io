-- Matches the migration applied to the hosted project.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bg3ro-editor-images','bg3ro-editor-images',true,5242880,array['image/jpeg']);
create policy editor_images_member_insert on storage.objects for insert to authenticated
 with check(bucket_id='bg3ro-editor-images' and name ~ ('^'||(select auth.uid())::text||'/[0-9a-f-]{36}[.]jpg$')
 and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
 and exists(select 1 from public.bg3ro_profiles where id=(select auth.uid())));
-- Public image URLs are readable, but draft objects cannot be listed by other users.
create policy editor_images_owner_read on storage.objects for select to authenticated
 using(bucket_id='bg3ro-editor-images' and split_part(name,'/',1)=(select auth.uid())::text);
create policy editor_images_owner_delete on storage.objects for delete to authenticated
 using(bucket_id='bg3ro-editor-images' and split_part(name,'/',1)=(select auth.uid())::text);
notify pgrst,'reload schema';
commit;
