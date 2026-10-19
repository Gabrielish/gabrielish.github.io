begin;
alter table public.bg3ro_project_status
 add column about_title text not null default 'Despre proiect' check(char_length(btrim(about_title)) between 1 and 120),
 add column about_body text not null default 'Sunt Gabrielish și lucrez singur la traducerea neoficială în limba română pentru Baldur’s Gate 3. Este un proiect personal, pornit din pasiune pentru joc.

Obiectivul meu este o traducere integrală, firească și consecventă — de la dialoguri și cărți la interfață, obiecte și vrăji. Urmăresc să păstrez sensul, umorul și personalitatea personajelor, cu acorduri corecte la feminin și masculin.

Verific textele în joc, în contextul în care apar. Actul I este verificat, inclusiv variantele de gen; urmează verificarea Actului II. În paralel, lucrez la interfață și la descrierile obiectelor și vrăjilor.' check(char_length(btrim(about_body)) between 1 and 12000),
 add column about_note text not null default 'Sunt traduse textele jocului, nu vocile. Înregistrările audio originale rămân neschimbate.' check(char_length(about_note)<=2000);
grant update(about_title,about_body,about_note) on public.bg3ro_project_status to authenticated;
-- Existing SELECT and moderator-only UPDATE policies remain unchanged.
commit;
