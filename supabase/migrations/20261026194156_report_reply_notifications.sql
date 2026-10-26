-- New threaded replies use the same private notification preferences as legacy reports.
create function bg3ro_private.notify_report_reply()
returns trigger language plpgsql security definer set search_path=''
as $$
declare recipient uuid; enabled boolean; label text;
begin
 select author_id into recipient from public.bg3ro_bug_reports where id=new.report_id;
 if recipient is null or recipient=new.author_id then return new;end if;
 select notify_reports into enabled from public.bg3ro_account_preferences where user_id=recipient;
 if coalesce(enabled,true) and exists(select 1 from public.bg3ro_profiles where id=recipient) then
  label:=coalesce(nullif(new.author_name,''),'Un utilizator')||' a răspuns la raportul tău de eroare pentru „Baldur’s Gate 3”.';
  insert into public.bg3ro_notifications(user_id,kind,title,target)
   values(recipient,'report',left(label,200),'#erori');
 end if;
 return new;
end;
$$;
revoke all on function bg3ro_private.notify_report_reply() from public,anon,authenticated;
create trigger bg3ro_notify_report_reply after insert on public.bg3ro_report_replies
 for each row execute function bg3ro_private.notify_report_reply();
