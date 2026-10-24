-- Hosted migration version: 20261024061037.
begin;
grant update(sort_order) on public.bg3ro_about_sections to authenticated;
create function public.bg3ro_reorder_about_sections(p_ids text[],p_expected text[]) returns boolean
language plpgsql security invoker set search_path='' as $$
declare current_ids text[];
begin
 if not public.bg3ro_is_moderator() then raise exception 'Administrator required' using errcode='42501';end if;
 -- Lock in a stable order, so simultaneous moves cannot overwrite each other.
 perform id from public.bg3ro_about_sections order by id for update;
 select coalesce(array_agg(id order by sort_order,id),array[]::text[]) into current_ids from public.bg3ro_about_sections;
 if p_expected is distinct from current_ids then raise exception 'Section order changed; reload before moving' using errcode='40001';end if;
 if p_ids is null or array_ndims(p_ids) is distinct from 1 or array_lower(p_ids,1) is distinct from 1
  or cardinality(p_ids)<>cardinality(current_ids) or cardinality(p_ids)>100000
  or exists(select 1 from unnest(p_ids) as candidate(id) where id is null)
  or (select count(distinct id) from unnest(p_ids) as candidate(id))<>cardinality(p_ids)
  or not(p_ids @> current_ids and current_ids @> p_ids)
 then raise exception 'Invalid section order' using errcode='22023';end if;
 update public.bg3ro_about_sections as section set sort_order=ordered.position::integer*10
 from unnest(p_ids) with ordinality as ordered(id,position) where section.id=ordered.id;
 return true;
end;$$;
revoke all on function public.bg3ro_reorder_about_sections(text[],text[]) from public,anon;
grant execute on function public.bg3ro_reorder_about_sections(text[],text[]) to authenticated;
notify pgrst,'reload schema';
commit;
