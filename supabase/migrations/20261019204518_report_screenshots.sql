begin;
alter table public.bg3ro_bug_reports add column screenshot_path text
 check(screenshot_path is null or screenshot_path=id::text||'/screenshot.jpg');
grant select(screenshot_path) on public.bg3ro_bug_reports to anon;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('bg3ro-report-images','bg3ro-report-images',false,5242880,array['image/jpeg']);
create policy bg3ro_report_photo_upload on storage.objects for insert to authenticated
 with check(bucket_id='bg3ro-report-images' and owner_id=(select auth.uid())::text
 and exists(select 1 from public.bg3ro_bug_reports r where name=r.id::text||'/screenshot.jpg'
 and r.author_id=(select auth.uid()) and r.screenshot_path is null and r.created_at>now()-interval '1 day'));
create policy bg3ro_report_photo_public_read on storage.objects for select to anon
 using(bucket_id='bg3ro-report-images' and exists(select 1 from public.bg3ro_bug_reports r
 where r.screenshot_path=storage.objects.name and r.is_public));
create policy bg3ro_report_photo_member_read on storage.objects for select to authenticated
 using(bucket_id='bg3ro-report-images' and (owner_id=(select auth.uid())::text or (select public.bg3ro_is_moderator())
 or exists(select 1 from public.bg3ro_bug_reports r where r.screenshot_path=storage.objects.name
 and (r.is_public or r.author_id=(select auth.uid())))));
create policy bg3ro_report_photo_delete on storage.objects for delete to authenticated
 using(bucket_id='bg3ro-report-images' and (owner_id=(select auth.uid())::text or (select public.bg3ro_is_moderator())));
-- Controlled RPC: clients cannot set arbitrary image paths or change another report.
create function public.bg3ro_attach_report_image(p_report_id uuid) returns text
 language plpgsql security definer set search_path='' as $$
declare image_path text:=p_report_id::text||'/screenshot.jpg'; actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Not authorized' using errcode='42501'; end if;
 perform 1 from public.bg3ro_bug_reports where id=p_report_id and author_id=actor for update;
 if not found then raise exception 'Not authorized' using errcode='42501';end if;
 if not exists(select 1 from storage.objects where bucket_id='bg3ro-report-images' and name=image_path
  and owner_id=actor::text and metadata->>'mimetype'='image/jpeg'
  and (metadata->>'size')::bigint between 1 and 5242880) then
  raise exception 'Image not uploaded';
 end if;
 update public.bg3ro_bug_reports set screenshot_path=image_path where id=p_report_id and author_id=actor;
 return image_path;
end;
$$;
revoke all on function public.bg3ro_attach_report_image(uuid) from public,anon;
grant execute on function public.bg3ro_attach_report_image(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
