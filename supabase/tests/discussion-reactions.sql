begin;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from bg3ro_private.moderators limit 1),true);
with inserted as (
 insert into public.bg3ro_discussion_posts(author_id,author_name,title,body)
 values(auth.uid(),'Reactions test','Test','Temporary reaction test fixture.') returning id
) select set_config('test.reaction_post',id::text,true) from inserted;
select set_config('test.reaction_actor',auth.uid()::text,true);
set local role anon;
do $$ begin
  begin perform public.bg3ro_toggle_reaction(current_setting('test.reaction_post')::uuid,'like');raise exception 'Unauthenticated write permitted';exception when insufficient_privilege then null;end;
  begin perform * from bg3ro_private.discussion_reactions;raise exception 'Raw identities exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
do $$ declare id uuid:=current_setting('test.reaction_post')::uuid;n bigint;begin
  perform public.bg3ro_toggle_reaction(id,'like');
  select total into n from public.bg3ro_reaction_summary(array[id]) where emoji='like' and mine;
  if n is distinct from 1 then raise exception 'First reaction missing';end if;
  perform public.bg3ro_toggle_reaction(id,'love');
  if exists(select 1 from public.bg3ro_reaction_summary(array[id]) where emoji='like') then raise exception 'Old reaction not replaced';end if;
  perform public.bg3ro_toggle_reaction(id,'love');
  if exists(select 1 from public.bg3ro_reaction_summary(array[id])) then raise exception 'Reaction not removed';end if;
  begin perform public.bg3ro_toggle_reaction(id,'invalid');raise exception 'Invalid reaction accepted';exception when raise_exception then if sqlerrm='Invalid reaction accepted' then raise;end if;end;
  begin perform * from public.bg3ro_reaction_summary(array_fill(id,array[201]));raise exception 'Unbounded aggregate accepted';exception when raise_exception then if sqlerrm='Unbounded aggregate accepted' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where id::text<>current_setting('test.reaction_actor') limit 1),true);
set local role authenticated;
select public.bg3ro_toggle_reaction(current_setting('test.reaction_post')::uuid,'like');
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.reaction_actor'),true);
set local role authenticated;
select public.bg3ro_toggle_reaction(current_setting('test.reaction_post')::uuid,'like');
do $$ declare id uuid:=current_setting('test.reaction_post')::uuid;begin
 if (select total from public.bg3ro_reaction_summary(array[id]) where emoji='like')<>2 then raise exception 'Two accounts did not aggregate';end if;
 perform public.bg3ro_toggle_reaction(id,'like');
 if (select total from public.bg3ro_reaction_summary(array[id]) where emoji='like')<>1 then raise exception 'Changed another account reaction';end if;
 begin perform * from bg3ro_private.discussion_reactions;raise exception 'Member raw identity access';exception when insufficient_privilege then null;end;
end $$;
reset role;
update bg3ro_private.submission_limits set submissions=30 where kind='discussion_reaction' and user_id=current_setting('test.reaction_actor')::uuid;
set local role authenticated;
do $$ begin
 begin perform public.bg3ro_toggle_reaction(current_setting('test.reaction_post')::uuid,'love');raise exception 'Rate limit bypassed';exception when raise_exception then if sqlerrm='Rate limit bypassed' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 if exists(select 1 from public.bg3ro_reaction_summary(array[current_setting('test.reaction_post')::uuid]) where mine) then raise exception 'Anonymous saw ownership';end if;
end $$;
reset role;
update public.bg3ro_discussion_posts set status='rejected' where id=current_setting('test.reaction_post')::uuid;
do $$ begin
 if exists(select 1 from public.bg3ro_reaction_summary(array[current_setting('test.reaction_post')::uuid])) then raise exception 'Hidden post leaked counts';end if;
end $$;
delete from public.bg3ro_discussion_posts where id=current_setting('test.reaction_post')::uuid;
do $$ begin
 if exists(select 1 from bg3ro_private.discussion_reactions where post_id=current_setting('test.reaction_post')::uuid) then raise exception 'Cascade failed';end if;
end $$;
rollback;
