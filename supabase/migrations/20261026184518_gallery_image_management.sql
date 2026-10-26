create or replace function public.bg3ro_update_gallery_body(p_expected text,p_body text)
returns boolean
language plpgsql
security invoker
set search_path=''
as $$
begin
 if not (select public.bg3ro_is_moderator()) then
  raise exception 'Administrator required' using errcode='42501';
 end if;
 if p_body is null or left(p_body,13)<>'BG3RO-RICH-1:' then
  raise exception 'Invalid gallery content' using errcode='22023';
 end if;
 update public.bg3ro_about_sections set body=p_body
 where id='gallery' and kind='gallery' and body is not distinct from p_expected;
 return found;
end;
$$;
revoke all on function public.bg3ro_update_gallery_body(text,text) from public,anon;
grant execute on function public.bg3ro_update_gallery_body(text,text) to authenticated;
notify pgrst,'reload schema';
