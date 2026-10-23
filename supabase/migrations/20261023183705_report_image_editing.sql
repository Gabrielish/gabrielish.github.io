begin;
-- Version matches the migration applied to the hosted project.
-- The first retained image may be any of the report's gallery images.
alter table public.bg3ro_bug_reports drop constraint bg3ro_bug_reports_check;
alter table public.bg3ro_bug_reports add constraint bg3ro_report_primary_image_check
 check(screenshot_path is null or screenshot_path ~ ('^'||id::text||'/(screenshot|[0-9a-f-]{36})[.]jpg$'));

-- Only this narrowly scoped helper may update the attachment columns.
-- Storage objects are deleted via the Storage API after this transaction commits.
create function bg3ro_private.edit_report_images(p_report_id uuid,p_title text,p_body text,p_expected_paths text[],p_keep_paths text[]) returns text[]
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); report public.bg3ro_bug_reports; existing text[]; removed text[];
begin
 if actor is null then raise exception 'Not authorized' using errcode='42501';end if;
 select * into report from public.bg3ro_bug_reports where id=p_report_id for update;
 if not found or (report.author_id is distinct from actor and not public.bg3ro_is_moderator()) then raise exception 'Not authorized' using errcode='42501';end if;
 existing:=case when cardinality(report.screenshot_paths)>0 then report.screenshot_paths when report.screenshot_path is not null then array[report.screenshot_path] else array[]::text[] end;
 if p_expected_paths is null or p_keep_paths is null or array_position(p_expected_paths,null) is not null or array_position(p_keep_paths,null) is not null
  or coalesce(array_ndims(p_expected_paths),1)<>1 or coalesce(array_ndims(p_keep_paths),1)<>1
  or (cardinality(p_expected_paths)>0 and array_lower(p_expected_paths,1)<>1) or (cardinality(p_keep_paths)>0 and array_lower(p_keep_paths,1)<>1)
  or not(p_keep_paths<@p_expected_paths)
  or (select count(distinct path) from unnest(p_expected_paths) path)<>cardinality(p_expected_paths)
  or (select count(distinct path) from unnest(p_keep_paths) path)<>cardinality(p_keep_paths)
  or exists(select 1 from unnest(p_expected_paths) path where path !~ ('^'||p_report_id::text||'/(screenshot|[0-9a-f-]{36})[.]jpg$'))
 then raise exception 'Invalid image selection';end if;
 -- A retry after a lost response is safe when the retained gallery already matches.
 if existing is distinct from p_expected_paths and existing is distinct from p_keep_paths then
  raise exception 'Imaginile raportării s-au schimbat. Reîncarcă pagina și încearcă din nou.';
 end if;
 if not(p_keep_paths<@existing) then raise exception 'Cannot add images while removing attachments';end if;
 select coalesce(array_agg(path),array[]::text[]) into removed from unnest(p_expected_paths) path where not(path=any(p_keep_paths));
 update public.bg3ro_bug_reports set title=p_title,body=p_body,screenshot_paths=p_keep_paths,screenshot_path=p_keep_paths[1] where id=p_report_id;
 return removed;
end;
$$;
revoke all on function bg3ro_private.edit_report_images(uuid,text,text,text[],text[]) from public,anon,authenticated;
grant execute on function bg3ro_private.edit_report_images(uuid,text,text,text[],text[]) to authenticated;
create function public.bg3ro_edit_report_images(p_report_id uuid,p_title text,p_body text,p_expected_paths text[],p_keep_paths text[]) returns text[]
 language sql security invoker set search_path='' as $$select bg3ro_private.edit_report_images(p_report_id,p_title,p_body,p_expected_paths,p_keep_paths);$$;
revoke all on function public.bg3ro_edit_report_images(uuid,text,text,text[],text[]) from public,anon,authenticated;
grant execute on function public.bg3ro_edit_report_images(uuid,text,text,text[],text[]) to authenticated;

-- The owner explicitly identified the legacy replies as theirs. Backfill only
-- missing/generic attribution, using the sole administrator's public profile.
-- The original response date was not stored, so leave it unknown.
alter table public.bg3ro_bug_reports disable trigger bg3ro_stamp_report_reply;
with owner_profile as (
 select left(coalesce(nullif(u.raw_user_meta_data->>'preferred_username',''),nullif(u.raw_user_meta_data->>'user_name',''),nullif(u.raw_user_meta_data->>'full_name',''),u.raw_user_meta_data->>'name'),40) as name,
 u.raw_user_meta_data->>'avatar_url' as avatar
 from auth.users u join bg3ro_private.moderators m on m.user_id=u.id
 where (select count(*) from bg3ro_private.moderators)=1
)
update public.bg3ro_bug_reports r set reply_author_name=p.name,reply_author_avatar_url=case when p.avatar ~ '^https://(cdn[.]discordapp[.]com|media[.]discordapp[.]net)/(avatars/[0-9]+/[A-Za-z0-9_]+[.](png|jpg|jpeg|webp|gif)|embed/avatars/[0-9]+[.]png)([?]size=[0-9]+)?$' then p.avatar else null end
 from owner_profile p where lower(p.name)='gabrielish' and r.moderator_reply<>'' and (r.reply_author_name is null or r.reply_author_name='Administrator');
alter table public.bg3ro_bug_reports enable trigger bg3ro_stamp_report_reply;
notify pgrst,'reload schema';
commit;
