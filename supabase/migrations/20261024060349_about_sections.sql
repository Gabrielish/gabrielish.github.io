-- Hosted migration version: 20261024060349. Existing content is copied, not removed.
begin;
create table public.bg3ro_about_sections (
 id text primary key default gen_random_uuid()::text check(id in ('progress','about','work','modules','gallery') or id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 kind text not null default 'text' check(kind in ('text','progress','gallery')),
 title text not null check(char_length(btrim(title)) between 1 and 120),
 body text default '' check(char_length(body)<=12000),
 legacy_note text not null default '' check(char_length(legacy_note)<=2000),
 is_visible boolean not null default true,
 sort_order integer not null default 100 check(sort_order between 0 and 1000000),
 translation_percent smallint check(translation_percent between 0 and 100),
 review_percent smallint check(review_percent between 0 and 100),
 testing_percent smallint check(testing_percent between 0 and 100),
 check((kind='progress' and id='progress' and translation_percent is not null and review_percent is not null and testing_percent is not null)
  or (kind<>'progress' and translation_percent is null and review_percent is null and testing_percent is null)),
 check((id='gallery' and kind='gallery') or (id<>'gallery' and kind<>'gallery')),
 check((body is not null and (kind<>'text' or char_length(btrim(body))>=1)) or (id='modules' and body is null))
);
alter table public.bg3ro_about_sections enable row level security;
revoke all on public.bg3ro_about_sections from public,anon,authenticated;
grant select on public.bg3ro_about_sections to anon,authenticated;
grant insert(title,body,is_visible,sort_order),delete on public.bg3ro_about_sections to authenticated;
grant update(title,body,legacy_note,is_visible,translation_percent,review_percent,testing_percent) on public.bg3ro_about_sections to authenticated;
create policy about_sections_public_read on public.bg3ro_about_sections for select to anon using(is_visible);
create policy about_sections_member_read on public.bg3ro_about_sections for select to authenticated using(is_visible or (select public.bg3ro_is_moderator()));
create policy about_sections_admin_insert on public.bg3ro_about_sections for insert to authenticated with check((select public.bg3ro_is_moderator()));
create policy about_sections_admin_update on public.bg3ro_about_sections for update to authenticated using((select public.bg3ro_is_moderator())) with check((select public.bg3ro_is_moderator()));
create policy about_sections_admin_delete on public.bg3ro_about_sections for delete to authenticated using((select public.bg3ro_is_moderator()));
create index about_sections_display_order on public.bg3ro_about_sections(sort_order,id);
insert into public.bg3ro_about_sections(id,kind,title,body,sort_order,translation_percent,review_percent,testing_percent)
 select 'progress','progress','Progresul traducerii','',10,translation_percent,review_percent,testing_percent from public.bg3ro_project_status where id=1;
insert into public.bg3ro_about_sections(id,title,body,legacy_note,sort_order)
 select 'about',about_title,about_body,about_note,20 from public.bg3ro_project_status where id=1;
insert into public.bg3ro_about_sections(id,title,body,legacy_note,sort_order)
 select 'work',work_title,work_body,'',30 from public.bg3ro_project_status where id=1;
insert into public.bg3ro_about_sections(id,title,body,sort_order) values('modules','Moduri pentru particularitățile limbii române',null,40);
insert into public.bg3ro_about_sections(id,kind,title,body,sort_order) values('gallery','gallery','Galerie','',50);
notify pgrst,'reload schema';
commit;
