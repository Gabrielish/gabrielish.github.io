-- Identities stay in an unexposed, RLS-protected schema. Only aggregates leave it.
create table bg3ro_private.discussion_reactions (
  post_id uuid not null references public.bg3ro_discussion_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check(emoji in ('like','love','laugh','wow','sad','angry')),
  primary key(post_id,user_id)
);
create index bg3ro_discussion_reactions_user on bg3ro_private.discussion_reactions(user_id);
alter table bg3ro_private.discussion_reactions enable row level security;
revoke all on bg3ro_private.discussion_reactions from public,anon,authenticated;

-- Definer is intentionally private: counts span owners, but never return identities.
create function bg3ro_private.reaction_summary(p_post_ids uuid[])
returns table(post_id uuid,emoji text,total bigint,mine boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if coalesce(cardinality(p_post_ids),0)>200 then raise exception 'Too many posts'; end if;
  return query select r.post_id,r.emoji,count(*),coalesce(bool_or(r.user_id=auth.uid()),false)
    from bg3ro_private.discussion_reactions r
    join public.bg3ro_discussion_posts p on p.id=r.post_id
    where r.post_id=any(p_post_ids) and p.status='approved'
    group by r.post_id,r.emoji;
end $$;
revoke all on function bg3ro_private.reaction_summary(uuid[]) from public,anon,authenticated;
grant usage on schema bg3ro_private to anon,authenticated;
grant execute on function bg3ro_private.reaction_summary(uuid[]) to anon,authenticated;
create function public.bg3ro_reaction_summary(p_post_ids uuid[])
returns table(post_id uuid,emoji text,total bigint,mine boolean)
language sql stable security invoker set search_path='' as $$
  select * from bg3ro_private.reaction_summary(p_post_ids);
$$;
revoke all on function public.bg3ro_reaction_summary(uuid[]) from public,anon,authenticated;
grant execute on function public.bg3ro_reaction_summary(uuid[]) to anon,authenticated;

create function bg3ro_private.toggle_reaction(p_post_id uuid,p_emoji text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); allowed integer; previous text;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if p_emoji is null or p_emoji not in ('like','love','laugh','wow','sad','angry') then raise exception 'Invalid reaction'; end if;
  if not exists(select 1 from public.bg3ro_discussion_posts where id=p_post_id and status='approved') then raise exception 'Post unavailable'; end if;
  -- Atomic, shared per-account limit; no client-supplied identity or counter.
  insert into bg3ro_private.submission_limits(user_id,kind,last_sent,window_started,submissions)
  values(actor,'discussion_reaction',now(),now(),1)
  on conflict(user_id,kind) do update set
    last_sent=now(),
    submissions=case when submission_limits.window_started<now()-interval '1 minute' then 1 else submission_limits.submissions+1 end,
    window_started=case when submission_limits.window_started<now()-interval '1 minute' then now() else submission_limits.window_started end
  where submission_limits.window_started<now()-interval '1 minute' or submission_limits.submissions<30
  returning submissions into allowed;
  if allowed is null then raise exception 'Reaction rate limit exceeded'; end if;
  -- The counter upsert also serializes concurrent changes by the same account.
  select emoji into previous from bg3ro_private.discussion_reactions where post_id=p_post_id and user_id=actor;
  if previous=p_emoji then
    delete from bg3ro_private.discussion_reactions where post_id=p_post_id and user_id=actor;
  else
    insert into bg3ro_private.discussion_reactions(post_id,user_id,emoji) values(p_post_id,actor,p_emoji)
    on conflict(post_id,user_id) do update set emoji=excluded.emoji;
  end if;
end $$;
revoke all on function bg3ro_private.toggle_reaction(uuid,text) from public,anon,authenticated;
grant execute on function bg3ro_private.toggle_reaction(uuid,text) to authenticated;
create function public.bg3ro_toggle_reaction(p_post_id uuid,p_emoji text)
returns void language sql security invoker set search_path='' as $$
  select bg3ro_private.toggle_reaction(p_post_id,p_emoji);
$$;
revoke all on function public.bg3ro_toggle_reaction(uuid,text) from public,anon,authenticated;
grant execute on function public.bg3ro_toggle_reaction(uuid,text) to authenticated;
