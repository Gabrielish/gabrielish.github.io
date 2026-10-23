-- Hosted migration version: 20261023185728.
begin;
create table public.bg3ro_gallery_images(
 id uuid primary key default gen_random_uuid(),
 path text not null unique check(path=id::text||'.jpg'),
 alt text not null default 'Captură din traducerea în limba română' check(char_length(btrim(alt)) between 1 and 160),
 created_at timestamptz not null default now()
);
alter table public.bg3ro_gallery_images enable row level security;
revoke all on public.bg3ro_gallery_images from public,anon,authenticated;
grant select on public.bg3ro_gallery_images to anon,authenticated;
grant insert(id,path,alt),delete on public.bg3ro_gallery_images to authenticated;
create policy gallery_public_read on public.bg3ro_gallery_images for select to anon,authenticated using(true);
create policy gallery_admin_insert on public.bg3ro_gallery_images for insert to authenticated with check((select public.bg3ro_is_moderator()));
create policy gallery_admin_delete on public.bg3ro_gallery_images for delete to authenticated using((select public.bg3ro_is_moderator()));
create index bg3ro_gallery_chronological on public.bg3ro_gallery_images(created_at,id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('bg3ro-gallery','bg3ro-gallery',true,5242880,array['image/jpeg']);
create policy gallery_images_admin_upload on storage.objects for insert to authenticated with check(
 bucket_id='bg3ro-gallery' and (select public.bg3ro_is_moderator()) and owner_id=(select auth.uid())::text
 and name ~ '^[0-9a-f-]{36}[.]jpg$');
create policy gallery_images_admin_read on storage.objects for select to authenticated using(bucket_id='bg3ro-gallery' and (select public.bg3ro_is_moderator()));
create policy gallery_images_admin_delete on storage.objects for delete to authenticated using(bucket_id='bg3ro-gallery' and (select public.bg3ro_is_moderator()));
notify pgrst,'reload schema';
commit;
