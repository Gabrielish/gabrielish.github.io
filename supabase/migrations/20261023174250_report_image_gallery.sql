-- Version aligned with the migration applied to the hosted project.
begin;
alter table public.bg3ro_bug_reports add column screenshot_paths text[] not null default '{}';
grant select(screenshot_paths) on public.bg3ro_bug_reports to anon,authenticated;

-- Validate Storage permission probes (contentLength) and completed objects (size).
-- The report row coordinates concurrent writes; attachment rechecks actual sizes.
create function bg3ro_private.can_upload_report_image(p_name text,p_metadata jsonb) returns boolean
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); report_id uuid; amount bigint; used bigint;
begin
 if actor is null or p_name !~ '^[0-9a-f-]{36}/(screenshot|[0-9a-f-]{36})[.]jpg$' then return false;end if;
 begin report_id:=split_part(p_name,'/',1)::uuid;
 amount:=coalesce(p_metadata->>'size',p_metadata->>'contentLength')::bigint;
 exception when invalid_text_representation or numeric_value_out_of_range then return false;end;
 if amount is null or amount<1 or amount>5242880 or p_metadata->>'mimetype' is distinct from 'image/jpeg' then return false;end if;
 perform 1 from public.bg3ro_bug_reports where id=report_id and author_id=actor
  and screenshot_path is null and cardinality(screenshot_paths)=0 and created_at>now()-interval '1 day' for update;
 if not found then return false;end if;
 select coalesce(sum((metadata->>'size')::bigint),0) into used from storage.objects
  where bucket_id='bg3ro-report-images' and name like report_id::text||'/%' and name<>p_name;
 return used+amount<=5242880;
end $$;
revoke all on function bg3ro_private.can_upload_report_image(text,jsonb) from public,anon,authenticated;
grant execute on function bg3ro_private.can_upload_report_image(text,jsonb) to authenticated;
alter policy bg3ro_report_photo_upload on storage.objects with check(
 bucket_id='bg3ro-report-images' and owner_id=(select auth.uid())::text
 and bg3ro_private.can_upload_report_image(name,metadata));

create function bg3ro_private.attach_report_images(p_report_id uuid,p_paths text[]) returns text[]
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); existing text[]; amount bigint; matched bigint;
begin
 if actor is null then raise exception 'Not authorized' using errcode='42501';end if;
 select screenshot_paths into existing from public.bg3ro_bug_reports where id=p_report_id and author_id=actor for update;
 if not found then raise exception 'Not authorized' using errcode='42501';end if;
 if p_paths is null or cardinality(p_paths)=0 or array_position(p_paths,null) is not null
  or p_paths[1]<>p_report_id::text||'/screenshot.jpg'
  or exists(select 1 from unnest(p_paths) path where path !~ ('^'||p_report_id::text||'/(screenshot|[0-9a-f-]{36})[.]jpg$'))
  or (select count(distinct path) from unnest(p_paths) path)<>cardinality(p_paths)
 then raise exception 'Invalid image paths';end if;
 if cardinality(existing)>0 and existing<>p_paths then raise exception 'Images already attached';end if;
 select count(*),coalesce(sum((metadata->>'size')::bigint),0) into matched,amount from storage.objects
 where bucket_id='bg3ro-report-images' and name=any(p_paths) and owner_id=actor::text
 and metadata->>'mimetype'='image/jpeg' and (metadata->>'size')::bigint>0;
 if matched<>cardinality(p_paths) then raise exception 'Images not uploaded';end if;
 if amount>5242880 then raise exception 'Capturile depășesc limita totală de 5 MB.';end if;
 update public.bg3ro_bug_reports set screenshot_path=p_paths[1],screenshot_paths=p_paths where id=p_report_id;
 return p_paths;
end $$;
revoke all on function bg3ro_private.attach_report_images(uuid,text[]) from public,anon,authenticated;
grant execute on function bg3ro_private.attach_report_images(uuid,text[]) to authenticated;
create function public.bg3ro_attach_report_images(p_report_id uuid,p_paths text[]) returns text[]
 language sql security invoker set search_path='' as $$select bg3ro_private.attach_report_images(p_report_id,p_paths);$$;
revoke all on function public.bg3ro_attach_report_images(uuid,text[]) from public,anon,authenticated;
grant execute on function public.bg3ro_attach_report_images(uuid,text[]) to authenticated;

alter policy bg3ro_report_photo_public_read on storage.objects using(bucket_id='bg3ro-report-images'
 and exists(select 1 from public.bg3ro_bug_reports r where r.is_public and (r.screenshot_path=objects.name or objects.name=any(r.screenshot_paths))));
alter policy bg3ro_report_photo_member_read on storage.objects using(bucket_id='bg3ro-report-images'
 and (owner_id=(select auth.uid())::text or (select public.bg3ro_is_moderator())
 or exists(select 1 from public.bg3ro_bug_reports r where (r.is_public or r.author_id=(select auth.uid()))
 and (r.screenshot_path=objects.name or objects.name=any(r.screenshot_paths)))));
notify pgrst,'reload schema';
commit;
