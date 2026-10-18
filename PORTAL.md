# Portal BG3RO — lucru în curs

În Actualizări nu se mai repetă antetul „Actualizări / Istoric pe Nexus”. Cardul „La ce lucrez acum” se salvează în coloanele `work_title`, `work_body`, `work_note` din `bg3ro_project_status`, folosind citirea publică și politica existentă de editare doar pentru moderatori. Migrarea `20261018132321_editable_work_section.sql` este aplicată. Administratorul conectat vede „Editează secțiunea” direct în card; nota poate fi goală. Textul se afișează fără HTML, cu paragrafe păstrate. `tests/current-work.cjs` verifică UI, iar `supabase/tests/current-work-access.sql` verifică permisiunile reale cu ROLLBACK.

Comunitatea publică, postarea ca oaspete și ștergerea de către moderator sunt documentate în [supabase/COMMUNITY.md](supabase/COMMUNITY.md). Raportările vechi rămân private; cele noi sunt publice cu consimțământ. Ratingurile/voturile necesită Discord.

Fluxul nou de versiuni GitHub, anunțuri legate, drepturi ale proprietarului și încărcare este documentat în [supabase/RELEASES.md](supabase/RELEASES.md). Acesta înlocuiește fluxul anterior exclusiv Nexus pentru descărcarea principală, după prima versiune publicată.

Direcție cerută: portal inspirat de organizarea paginii Lokalizace.net, nu copierea conținutului, codului sau statisticilor sale.

- Cinci taburi: Despre, Actualizări, Descărcări, Discuții, Raportare erori.
- Procente comunicate de proprietar: traducere 80%, corectură 20%, testare 20%. Toate trei au bare separate și se pot modifica din administrare.
- Conținutul proiectului funcționează static pe GitHub Pages; comunitatea folosește Supabase.
- Copia anterioară este publicată separat: https://gabrielish.github.io/bg3ro-old/ . Istoricul anterior este păstrat acolo.
- Interfața nouă este pagina principală https://gabrielish.github.io/; /bg3ro/ redirecționează aici. Comunitatea folosește Discord sau sesiuni de oaspete, fără SMTP.

## Fișiere active

Pagina principală: index.html, portal.css, portal.js, portal-video.js și portal-config.js. portal/index.html redirecționează către rădăcină, păstrând tabul din fragment și parametrii URL. Căile locale ale paginii principale sunt relative la rădăcină.

portal-config.js conține exclusiv URL-ul și cheia PUBLICĂ Supabase. Nu folosi service_role sau parole aici.

## Identitate vizuală

Footerul are patru coloane: identitatea BG3RO, Traducere, Comunitate și Informații. Folosește ilustrația locală ca fundal discret, o singură linie înaintea benzii de încheiere și păstrează atribuirea și informațiile despre date. Nu inventează conturi sociale; linkurile merg către taburile reale, FAQ, Nexus, GitHub, Patreon, Ko-fi și arhivă.

Hero-ul principal folosește titlul serif mare, centrat, cu „În limba română” dedesubt și eticheta „Versiune publică · Early Access · În lucru” sus, fără repetarea limbii sau a steagului. Nu are caseta cu zar, metadate sau slogan. CTA-ul duce la tabul Descărcări și reutilizează conturul SVG monobloc din site-ul vechi, nu rama asamblată din colțuri. Suprafața separată are negru 35%, backdrop blur 10px și mască după aceeași geometrie; hover-ul folosește button-filled.svg din site-ul vechi, cu tranziție .4s. Fontul local rămâne EB Garamond; fontul comercial Quadraat nu este redistribuit. Sub CTA apare „Disponibilă pentru”, urmat de iconițele PC și Apple din pagina Support Larian și sigla PS5 din homepage Larian (decupată din vectorul compozit, fără etichetele Pro/Enhanced). Textul „(în lucru)” apare în dreapta siglei PS5, conform cererii proprietarului. Iconițele au texte alternative accesibile. Această listă nu confirmă compatibilitatea extensiilor SE pe toate platformele.

portal-hero.css păstrează video-ul fără overlay și fără transparență; lizibilitatea se bazează pe umbra textelor. Licuricii reutilizează fireflies.css. La cererea proprietarului nu există buton sau controale native pentru oprirea video-ului. Video-ul și licuricii se opresc automat în afara ecranului, pe o pagină ascunsă sau când este cerută reducerea mișcării.

Antetul încarcă video-ul oficial din pagina About a Baldur’s Gate 3, direct de la Larian, fără copie MP4 în repository. Atribuirea este vizibilă în footer. Sursa cu hash se poate schimba; imaginea statică oficială este prima rezervă, iar ilustrația locală a taberei este rezerva pentru imagine. Video-ul este fără sunet, în buclă; nu se descarcă dacă este cerută reducerea mișcării sau economisirea datelor. Redarea se oprește în afara ecranului și când pagina este ascunsă.

Paletă închisă cu crem/auriu, inspirată de site-ul oficial Baldur’s Gate 3, fără accentele mov ale primei variante. Wordmarkul BG3RO păstrează fontul EB Garamond, greutatea 600, spațierea și culorile din site-ul anterior. Emblema din stânga provine din path-ul SVG furnizat de proprietar; geometria este păstrată, translația externă eliminată, iar umplerea este în trei benzi tricolore. Nu este un logo generat cu AI.

assets/export-portal-brand.cjs exportă dimensiunile PNG din assets/brand-mark-romania.svg. Pagina principală folosește noile faviconuri și portal.webmanifest, cu scope /bg3ro/. Arhiva are în continuare fișierele sale. tests/portal-brand.cjs verifică acest lucru și identitatea logo-ului.

Schema, configurarea Discord OAuth și activarea moderatorului sunt documentate în supabase/SETUP.md. Ambele migrări sunt instalate în proiectul proprietarului. Testul supabase/tests/hosted-access.sql a trecut pe instanța reală; datele de diagnostic au fost anulate prin ROLLBACK.

authEnabled este true pentru Discord OAuth. Nu este necesar SMTP. Clientul folosește PKCE cu sessionStorage, schimbă codul la revenire, curăță parametrii OAuth din URL și restabilește tabul anterior. Sesiunea rezistă reîncărcării în aceeași filă; nu se folosește localStorage. Rolul de moderator vine exclusiv din verificarea RPC/DB, nu din metadatele profilului Discord. Citirea progresului, actualizărilor și mesajelor aprobate folosește baza reală. Nu sunt inventate mesaje, actualizări sau conturi pentru a umple interfața. Preflight-ul OAuth real ajunge la aplicația corectă, dar se oprește înainte de consimțământ; proprietarul trebuie să confirme loginul real și apoi să primească rolul de moderator.

## Bara laterală comunitară

portal-sidebar.css/js implementează descărcarea rapidă către fișierele Nexus, evaluări 1–5, voturi de compatibilitate, ultimele 10 raportări, statistici și copierea linkului. Nu există agent local, ZIP găzduit aici, echipă sau ratinguri precompletate. Descărcările totale se consultă pe Nexus; nu sunt înlocuite cu un contor de clicuri. „Actualizare pe site” folosește cea mai recentă actualizare publicată în baza de date, nu o dată inventată a pachetului.

Migrarea 20261017205257_sidebar_feedback.sql este aplicată în proiectul proprietarului. bg3ro_ratings și bg3ro_compatibility au RLS, o singură înregistrare per cont, verificări de interval și limită de 10 secunde pentru modificări. Anonimul poate citi numai coloanele publice (nu user_id) și agregatele SECURITY INVOKER prin bg3ro_sidebar_stats. Endpoint-ul de statistici este apelat intenționat fără JWT, inclusiv pentru vizitatorii conectați; rolul authenticated citește numai propriile înregistrări. Niciun SECURITY DEFINER nou nu este adăugat. Testul SQL supabase/tests/sidebar-access.sql a trecut pe baza reală, cu ROLLBACK pentru toate datele QA. tests/sidebar.cjs folosește SDK/date sintetice pentru verificarea UI, nu dovedește un login Discord real.

Navbarul plutește peste hero, cu texturile cloud-left/cloud-right de pe site-ul oficial sus. La marginea de jos, video-ul și imaginea de rezervă folosesc acum o mască alfa SVG locală cu estompare și variație neregulată; nu mai există dreptunghiul de fum inversat. Dimensiunile și object-fit rămân neschimbate, iar centrul videoclipului nu are overlay. portal-navbar.css reutilizează ornamentul de hover și măștile butonului pergament din versiunea veche, fără să importe tema veche global. Meniul mobil are buton cu nouă puncte, Escape și stare aria-expanded; singurul link de meniu este Nexus Mods; taburile se păstrează sub hero. Login deschide dialogul Discord OAuth; SMTP nu este necesar. Susține proiectul deschide un dialog cu Patreon și Ko-fi, cu X/Escape și restaurarea focusului. Linkurile publice către arhivă au fost eliminate la cererea proprietarului; repository-ul arhivei nu este șters sau modificat.

## Verificări

- node --check portal.js
- node tests/portal.cjs — layout 320–1440px, navigare, fallback fără DB, accesibilitate de bază; folosește Playwright/Edge.
- node tests/portal-community.cjs — integrarea UI cu SDK sintetic; NU dovedește conectarea la Supabase sau livrarea e-mailului.
- node tests/portal-db.cjs — migrare și RLS în PostgreSQL local PGlite; necesită npm install --prefix .qa/db-test @electric-sql/pglite . Nu este backendul site-ului și nu stochează datele utilizatorilor reali.
- Celelalte teste tests/*.cjs se referă la site-ul arhivat, cu excepția verificărilor SEO aplicabile în continuare.

Înainte de lansare: test real cu utilizator anonim, doi utilizatori și moderator; consimțământ și revenire Discord reușite; mesaj publicat imediat, fără aprobare; raport privat și răspuns; publicarea unei actualizări și modificarea progresului. Testele locale nu înlocuiesc această verificare.
