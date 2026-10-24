-- Matches the migration applied to the hosted project.
begin;
-- Omit an unknown registration date rather than inventing one for imported accounts.
alter table public.bg3ro_profiles alter column joined_at drop not null;
-- Anonymous Auth sessions cannot participate, even if a stale profile exists.
create policy conversations_members_only on public.bg3ro_conversations as restrictive for all to authenticated
 using(not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check(not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy direct_messages_members_only on public.bg3ro_direct_messages as restrictive for all to authenticated
 using(not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check(not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy receipts_members_only on public.bg3ro_conversation_receipts as restrictive for all to authenticated
 using(not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
 with check(not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
notify pgrst,'reload schema';
commit;
