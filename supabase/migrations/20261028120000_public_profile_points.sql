-- Public aggregate only: no rating values, private messages or account data.
create function bg3ro_private.profile_points(p_profile_id uuid)
returns bigint language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.bg3ro_profiles where id=p_profile_id)
 then (select coalesce(sum(case when parent_id is null then 2 else 1 end),0)::bigint
       from public.bg3ro_discussion_posts where author_id=p_profile_id and status='approved' and not is_guest)
    + (select count(*) from public.bg3ro_ratings where user_id=p_profile_id)
 else null end;
$$;
revoke all on function bg3ro_private.profile_points(uuid) from public,anon,authenticated;
grant execute on function bg3ro_private.profile_points(uuid) to anon,authenticated;
create function public.bg3ro_profile_points(p_profile_id uuid)
returns bigint language sql stable security invoker set search_path='' as $$
 select bg3ro_private.profile_points(p_profile_id);
$$;
revoke all on function public.bg3ro_profile_points(uuid) from public,anon,authenticated;
grant execute on function public.bg3ro_profile_points(uuid) to anon,authenticated;
