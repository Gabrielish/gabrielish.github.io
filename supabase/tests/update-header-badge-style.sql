begin;
do $$begin perform set_config('request.jwt.claim.sub',(select user_id::text from bg3ro_private.moderators limit 1),true);end$$;
set local role authenticated;
do $$declare row_id uuid;changed integer;begin
 insert into public.bg3ro_project_updates(title,body,badge_label,badge_color,badge_icon,badge_svg)
 values('QA etichetă','Conținut temporar pentru verificare.','Actualizat','#3b82f6','star','') returning id into row_id;
 perform set_config('test.header_badge_id',row_id::text,true);
 if not exists(select 1 from public.bg3ro_project_updates where id=row_id and badge_color='#3b82f6' and badge_icon='star') then raise exception 'Style was not saved';end if;
 begin update public.bg3ro_project_updates set badge_color='url(evil)' where id=row_id;raise exception 'Invalid color accepted';exception when check_violation then null;end;
 begin update public.bg3ro_project_updates set badge_svg=repeat('x',16001) where id=row_id;raise exception 'Oversized SVG accepted';exception when check_violation then null;end;
 update public.bg3ro_project_updates set badge_label='',badge_icon='',badge_svg='' where id=row_id;
 get diagnostics changed=row_count;if changed<>1 then raise exception 'Badge removal failed';end if;
end$$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
set local role authenticated;
do $$declare changed integer;begin
 update public.bg3ro_project_updates set badge_color='#ef4444' where id=current_setting('test.header_badge_id')::uuid;
 get diagnostics changed=row_count;if changed<>0 then raise exception 'Member changed badge';end if;
end$$;
reset role;
set local role anon;
do $$begin
 begin update public.bg3ro_project_updates set badge_color='#ef4444' where id=current_setting('test.header_badge_id')::uuid;raise exception 'Anonymous badge write allowed';exception when insufficient_privilege then null;end;
end$$;
rollback;
select true as update_header_badge_allow_deny_passed;
