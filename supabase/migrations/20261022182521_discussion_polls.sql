create function bg3ro_private.valid_poll_options(options text[]) returns boolean language sql immutable security invoker set search_path='' as $$
 select cardinality(options) between 2 and 8
  and not exists(select 1 from unnest(options) value where value is null or char_length(btrim(value)) not between 1 and 120)
  and (select count(distinct lower(btrim(value))) from unnest(options) value)=cardinality(options);
$$;
revoke all on function bg3ro_private.valid_poll_options(text[]) from public,anon,authenticated;
grant execute on function bg3ro_private.valid_poll_options(text[]) to authenticated;
create table public.bg3ro_discussion_polls (
 post_id uuid primary key references public.bg3ro_discussion_posts(id) on delete cascade,
 question text not null check(char_length(btrim(question)) between 3 and 200),
 options text[] not null check(bg3ro_private.valid_poll_options(options)),
 multiple boolean not null default false
);
alter table public.bg3ro_discussion_polls enable row level security;
revoke all on public.bg3ro_discussion_polls from public,anon,authenticated;
grant select on public.bg3ro_discussion_polls to anon,authenticated;
grant insert(post_id,question,options,multiple) on public.bg3ro_discussion_polls to authenticated;
create policy polls_public_read on public.bg3ro_discussion_polls for select to anon,authenticated using(exists(select 1 from public.bg3ro_discussion_posts p where p.id=post_id and p.status='approved'));
create policy polls_owner_insert on public.bg3ro_discussion_polls for insert to authenticated with check(exists(select 1 from public.bg3ro_discussion_posts p where p.id=post_id and p.author_id=(select auth.uid()) and p.parent_id is null and p.status='approved'));
create table bg3ro_private.poll_votes (
 post_id uuid not null references public.bg3ro_discussion_polls(post_id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 choices integer[] not null,
 primary key(post_id,user_id)
);
create index poll_votes_user on bg3ro_private.poll_votes(user_id);
alter table bg3ro_private.poll_votes enable row level security;
revoke all on bg3ro_private.poll_votes from public,anon,authenticated;

-- Atomic creation: invalid poll data also rolls back the new comment.
create function public.bg3ro_publish_poll(p_name text,p_body text,p_question text,p_options text[],p_multiple boolean)
returns uuid language plpgsql security invoker set search_path='' as $$
declare post uuid;
begin
 insert into public.bg3ro_discussion_posts(author_id,author_name,title,body)
 values(auth.uid(),p_name,'Comentariu',p_body) returning id into post;
 insert into public.bg3ro_discussion_polls(post_id,question,options,multiple) values(post,btrim(p_question),p_options,p_multiple);
 return post;
end $$;
revoke all on function public.bg3ro_publish_poll(text,text,text,text[],boolean) from public,anon,authenticated;
grant execute on function public.bg3ro_publish_poll(text,text,text,text[],boolean) to authenticated;

-- Private definer exposes only aggregate counts and the current account's choices.
create function bg3ro_private.poll_summary(p_post_ids uuid[])
returns table(post_id uuid,counts jsonb,choices integer[],voters bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(cardinality(p_post_ids),0)>100 then raise exception 'Too many polls';end if;
 return query select poll.post_id,
  (select jsonb_agg((select count(*) from bg3ro_private.poll_votes v where v.post_id=poll.post_id and i=any(v.choices)) order by i) from generate_series(0,cardinality(poll.options)-1) i),
  coalesce((select v.choices from bg3ro_private.poll_votes v where v.post_id=poll.post_id and v.user_id=auth.uid()),'{}'::integer[]),
  (select count(*) from bg3ro_private.poll_votes v where v.post_id=poll.post_id)
 from public.bg3ro_discussion_polls poll join public.bg3ro_discussion_posts post on post.id=poll.post_id
 where poll.post_id=any(p_post_ids) and post.status='approved';
end $$;
revoke all on function bg3ro_private.poll_summary(uuid[]) from public,anon,authenticated;
grant execute on function bg3ro_private.poll_summary(uuid[]) to anon,authenticated;
create function public.bg3ro_poll_summary(p_post_ids uuid[])
returns table(post_id uuid,counts jsonb,choices integer[],voters bigint)
language sql stable security invoker set search_path='' as $$ select * from bg3ro_private.poll_summary(p_post_ids); $$;
revoke all on function public.bg3ro_poll_summary(uuid[]) from public,anon,authenticated;
grant execute on function public.bg3ro_poll_summary(uuid[]) to anon,authenticated;

create function bg3ro_private.vote_poll(p_post_id uuid,p_choices integer[])
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();poll public.bg3ro_discussion_polls;allowed integer;
begin
 if actor is null then raise exception 'Authentication required';end if;
 select q.* into poll from public.bg3ro_discussion_polls q join public.bg3ro_discussion_posts p on p.id=q.post_id where q.post_id=p_post_id and p.status='approved' for share of q,p;
 if not found then raise exception 'Poll unavailable';end if;
 if p_choices is null or cardinality(p_choices)>8 or (not poll.multiple and cardinality(p_choices)>1)
  or exists(select 1 from unnest(p_choices) value where value is null or value<0 or value>=cardinality(poll.options))
  or (select count(distinct value) from unnest(p_choices) value)<>cardinality(p_choices)
 then raise exception 'Invalid poll choices';end if;
 insert into bg3ro_private.submission_limits(user_id,kind,last_sent,window_started,submissions)
 values(actor,'discussion_poll',now(),now(),1)
 on conflict(user_id,kind) do update set last_sent=now(),
 submissions=case when submission_limits.window_started<now()-interval '1 minute' then 1 else submission_limits.submissions+1 end,
 window_started=case when submission_limits.window_started<now()-interval '1 minute' then now() else submission_limits.window_started end
 where submission_limits.window_started<now()-interval '1 minute' or submission_limits.submissions<30
 returning submissions into allowed;
 if allowed is null then raise exception 'Poll rate limit exceeded';end if;
 if cardinality(p_choices)=0 then delete from bg3ro_private.poll_votes where post_id=p_post_id and user_id=actor;
 else insert into bg3ro_private.poll_votes(post_id,user_id,choices) values(p_post_id,actor,p_choices)
 on conflict(post_id,user_id) do update set choices=excluded.choices;end if;
end $$;
revoke all on function bg3ro_private.vote_poll(uuid,integer[]) from public,anon,authenticated;
grant execute on function bg3ro_private.vote_poll(uuid,integer[]) to authenticated;
create function public.bg3ro_vote_poll(p_post_id uuid,p_choices integer[]) returns void language sql security invoker set search_path='' as $$ select bg3ro_private.vote_poll(p_post_id,p_choices); $$;
revoke all on function public.bg3ro_vote_poll(uuid,integer[]) from public,anon,authenticated;
grant execute on function public.bg3ro_vote_poll(uuid,integer[]) to authenticated;
notify pgrst,'reload schema';
