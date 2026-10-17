# Conectarea comunității BG3RO

Configurarea versiunilor, moderatorul confirmat și secretul de încărcare GitHub sunt documentate în [RELEASES.md](RELEASES.md). UUID-ul proprietarului a primit deja rolul de moderator; nu îl atribui automat altui cont pe baza numelui afișat.

Nu publica portalul ca funcțional înainte de verificările de mai jos.

1. Migrările `migrations/20261017_bg3ro_portal.sql` și `migrations/20261017b_bg3ro_public_access.sql` sunt deja instalate în proiectul proprietarului. Nu le rula din nou. Pentru o instanță nouă, rulează-le o singură dată în această ordine. Nu modifică tabelele altor aplicații; toate numele au prefixul bg3ro.
2. Autentificarea actuală folosește Discord, nu OTP prin e-mail. Aplicația Discord este `1190788174314754161`; Client Secret se introduce exclusiv în Supabase Authentication > Providers > Discord. Public Key și bot token nu sunt necesare. Callback-ul autorizat în Discord este `https://gatkiwcyjgbgjwfgvplm.supabase.co/auth/v1/callback`.
3. În Supabase, Site URL și Redirect URLs includ exact `https://gabrielish.github.io/`. Providerul Discord este confirmat activ prin endpoint-ul public settings; înregistrările sunt permise. Nu este necesar SMTP sau domeniu propriu pentru acest flux. Clientul folosește PKCE, cu verifier și sesiune în sessionStorage, schimbă codul la revenire și elimină parametrii de autentificare din URL. Schimbarea tabului curent se păstrează pe durata redirecționării. Nu se solicită apartenență sau acces la serverul Discord.
4. Adaugă Project URL și Publishable Key / anon în `portal-config.js`. Nu introduce parola bazei de date, service_role sau secret keys. Cheia publică este destinată browserului; accesul este restrâns de RLS și granturi.
5. Proprietarul trebuie să se conecteze o dată cu propriul cont Discord. În Authentication > Users verifică identitatea și copiază UUID-ul Supabase, apoi folosește comanda de la finalul migrării pentru a-l face moderator. Application ID-ul Discord nu este ID-ul utilizatorului. Nu atribui automat drepturi pe baza user_metadata, numelui sau e-mailului. Niciun vizitator nu se poate promova singur.
6. Verifică testele SQL de acces cu două conturi de test și un moderator, apoi testează publicarea imediată a unui mesaj, răspunsul privat la un raport, actualizările și progresul. Nu sunt suficiente simulările din browser.

Testul `tests/hosted-access.sql` a trecut deja pe instanța reală. Creează doar în tranzacție utilizatorii de diagnostic, verifică anonimul/autorul/alt utilizator/moderatorul și încheie prin ROLLBACK. Nu sunt păstrate conturi sau rapoarte fictive. Autentificarea prin e-mail nu este testată de acel SQL.

`authEnabled: true` este activat pentru Discord. Testele cu SDK sintetic verifică revenirea PKCE, anularea/expirarea, trimiterea mesajelor/rapoartelor și moderarea. Testul real de preflight verifică redirecționarea Supabase către aplicația corectă, dar se oprește înainte de consimțământul Discord: conectarea completă a proprietarului și atribuirea moderatorului rămân de verificat de acesta. Portalul este pagina principală /bg3ro/; /portal/ redirecționează către ea. Nu prezenta preflight-ul ca autentificare completă reușită.

## Date și permisiuni

- Migrarea `20261017205257_sidebar_feedback.sql` este deja aplicată: ratinguri și compatibilitate, un vot actualizabil per cont. Nu o rula din nou pe acest proiect. `tests/sidebar-access.sql` verifică izolarea, limitele, agregatele fără identități și interzicerea scrierilor anonime; testele sunt anulate prin ROLLBACK.
- Evaluările și metadatele raportărilor de compatibilitate sunt publice, fără nume/e-mail/UUID. Acestea sunt distincte de rapoartele private de erori. Statisticile se citesc anonim prin RPC SECURITY INVOKER; utilizatorul autentificat citește și modifică doar propriile voturi.

- Actualizările și progresul se citesc public; doar moderatorii le schimbă.
- Mesajele și răspunsurile noi sunt publicate imediat, fără aprobare. Autorii le pot șterge; moderatorii le pot ascunde ulterior. Migrarea `20261017210537_instant_discussions.sql` este aplicată în proiectul proprietarului; nu o rula din nou.
- Rapoartele nu se citesc anonim. Un utilizator vede numai rapoartele proprii; moderatorii le văd pe toate.
- Utilizatorii nu pot modifica autorul, data, stadiul sau răspunsul moderatorului. Coloanele acceptate la insert/update sunt limitate explicit.
- Trimiterile sunt limitate în baza de date: minimum 30 secunde între mesaje/rapoarte, maximum 20 pe zi, pe cont și tip. Sunt necesare și protecțiile Auth împotriva abuzului cu multe conturi.
- Numele public este ales de utilizator și nu este un nume de identitate verificat. E-mailurile sunt păstrate în Supabase Auth, nu în tabelele publice.
- Conținutul este redat ca text, nu HTML. Nu există upload de fișiere sau salvări în această primă versiune.
- Sesiunea și verifier-ul PKCE folosesc sessionStorage, nu localStorage. Reîncărcarea în aceeași filă păstrează sesiunea; alte file au stocare separată, iar închiderea filei o încheie de regulă (restaurarea browserului poate restaura sessionStorage). Deconectarea folosește Supabase signOut.
- Ștergerea unui cont din Supabase Auth șterge prin cascade mesajele și rapoartele sale. Ștergerea unei discuții elimină și răspunsurile asociate.

## Publicare

GitHub Pages rămâne la /bg3ro/. Copia site-ului anterior este în repository-ul separat Gabrielish/bg3ro-old, publicat la /bg3ro-old/. Nu este necesară mutarea găzduirii web pentru Supabase.
