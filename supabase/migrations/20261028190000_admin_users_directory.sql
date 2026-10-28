-- Read-only directory for verified site administrators. No auth.users/email data.
create function public.bg3ro_admin_users(p_search text default '',p_sort text default 'newest',p_role text default 'all',p_page integer default 0,p_size integer default 24)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.bg3ro_is_moderator() then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 if p_sort not in ('newest','oldest','name','points') or p_role not in ('all','admin','member') then
  raise exception 'Invalid directory filter' using errcode='22023';
 end if;
 with filtered as (
  select p.id,p.display_name,p.avatar_url,p.joined_at,p.is_admin
  from public.bg3ro_profiles p
  where position(lower(left(coalesce(p_search,''),80)) in lower(p.display_name))>0
    and (p_role='all' or p.is_admin=(p_role='admin'))
 ), scores as (
  select f.*,bg3ro_private.profile_points(f.id) as points,
   (select count(*) from public.bg3ro_discussion_posts d where d.author_id=f.id and d.status='approved' and not d.is_guest) as posts
  from filtered f
 ), paged as (
  select * from scores
  order by case when p_sort='name' then lower(display_name) end asc,
   case when p_sort='points' then points end desc,
   case when p_sort='oldest' then joined_at end asc,
   joined_at desc,id
  limit greatest(1,least(coalesce(p_size,24),48))
  offset greatest(0,least(coalesce(p_page,0),100000))*greatest(1,least(coalesce(p_size,24),48))
 )
 select jsonb_build_object('total',(select count(*) from filtered),'users',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'::jsonb)) into result;
 return result;
end;$$;
revoke all on function public.bg3ro_admin_users(text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.bg3ro_admin_users(text,text,text,integer,integer) to authenticated;
