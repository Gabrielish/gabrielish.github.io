begin;
-- Extend the existing singleton, preserving its public SELECT and moderator-only UPDATE RLS.
alter table public.bg3ro_project_status
 add column work_title text not null default 'La ce lucrez acum' check(char_length(btrim(work_title)) between 1 and 120),
 add column work_body text not null default 'Următoarea etapă de verificare este Actul II. Continui în paralel revizia interfeței, a obiectelor și a vrăjilor.' check(char_length(btrim(work_body)) between 1 and 6000),
 add column work_note text not null default 'Acesta este stadiul proiectului, nu anunțul unei versiuni noi. Pentru fișiere deja publicate, consultă pagina Nexus Mods.' check(char_length(work_note)<=2000);
grant update(work_title,work_body,work_note) on public.bg3ro_project_status to authenticated;
notify pgrst,'reload schema';
commit;
