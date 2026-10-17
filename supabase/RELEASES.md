# Versiuni, descărcări și anunțuri

Migrările `20261017211251_linked_releases.sql`, `20261017212028_release_archive_replacement.sql` și `20261017212444_release_statistics.sql` sunt aplicate în proiectul `gatkiwcyjgbgjwfgvplm`. Nu le rula din nou. Nu există versiuni fictive în baza reală.

`bg3ro_releases` este sursa comună pentru Descărcări și anunțurile „Noua versiune …” din Actualizări. Nu se creează copii în `bg3ro_project_updates`: editarea originalului schimbă ambele prezentări. Anunțurile independente folosesc tabelul existent. Data este stabilită de server; versiunea și data nu sunt rescrise la editarea descrierii. Rândurile sunt citite public, fără UUID-ul autorului. Numai un moderator poate publica; editarea este limitată de RLS la moderatorul-autor. Inițial există doar moderatorul-proprietar.

Contul Discord `184388670059577344` a fost confirmat explicit de proprietar și asociat cu UUID-ul Supabase `73ce4438-cb0e-4556-8f47-33fb03532ac1`. Acest UUID a primit rolul de moderator; numele afișat nu participă la autorizare. Nu atribui drepturi altui cont pe baza numelui sau a metadatelor editabile.

## Încărcare

Edge Function `bg3ro-upload` este instalată. `verify_jwt=false` dezactivează numai verificarea veche a gateway-ului: funcția validează explicit tokenul prin `/auth/v1/user`, verifică UUID-ul exact al proprietarului și verifică `bg3ro_is_moderator` înaintea oricărei scrieri GitHub. Nu folosește service_role pentru autorizarea apelantului. CORS permite GitHub Pages și preview-ul local pe portul 4173.

Limita este 20 MiB, arhive ZIP/7z/RAR, cu semnătură acceptată și nume fără căi/caractere de control. Verificarea semnăturii nu este un antivirus. Se poate scrie numai în `Gabrielish/bg3ro`, ramura `main`, folderul `Baldur's Gate 3 Romanian Translate`. Contents API include SHA-ul existent la înlocuire; conflictele nu suprascriu orbește modificări concurente. Descărcarea este fixată la SHA-ul commitului: versiunile vechi păstrează arhiva lor, fără problemele de cache ale aceleiași adrese `main`.

Arhiva se încarcă înaintea publicării. Dacă salvarea metadatelor eșuează, fișierul poate exista deja în GitHub, dar nu se anunță publicarea unei versiuni inexistente. Reîncearcă operația indicată în mesajul de stare. Nu se inventează contoare de descărcări.

## Secret necesar

Proprietarul creează un fine-grained GitHub token limitat la `Gabrielish/bg3ro`, cu `Contents: Read and write`, și îl salvează exclusiv în Supabase → Edge Functions → Secrets ca `GITHUB_UPLOAD_TOKEN`. Nu cere tokenul în chat și nu îl salva în repository. Nu reutiliza tokenul general GitHub CLI. Tokenul trebuie înlocuit la expirarea aleasă. Fără secret, funcția refuză explicit încărcarea.

Încărcarea reală a arhivei proprietarului nu este încă verificată. Testele sintetice și tranzacțiile SQL anulate nu înlocuiesc acest test. Verifică primul upload, publicarea, descărcarea și înlocuirea după configurarea secretului.

## Teste

Erorile GitHub sunt clasificate fără a transmite răspunsul brut sau tokenul: 401 token invalid/expirat/revocat, 403 acces refuzat, 404 acces la repository/destinație, 409 conflict, 422 validare, 429 limitare temporară. Mesajul indică explicit `Gabrielish/bg3ro`, nu repository-ul nou de găzduire. Logul sigur conține doar etapa, codul HTTP și categoria. Un 403 singur nu dovedește dacă tokenul este read-only sau dacă o regulă a ramurii blochează scrierea; proprietarul trebuie să verifice setările tokenului și să reîncerce uploadul real. Nu considera testele simulate drept dovada încărcării arhivei sale.

- `node tests/upload-cors.cjs`: regresie pe serviciul real, din browser fără interceptarea cererilor. Confirmă că SDK-ul trece de preflight și primește JSON 401 pentru un JWT de diagnostic invalid; nu folosește sesiunea proprietarului și nu încarcă fișiere. Corecția CORS permite explicit `x-client-info`, antetele de retry/tracing ale SDK-ului și `x-file-name`, numai pentru originile aprobate.

- `node tests/releases.cjs`: UI desktop/mobil, date sintetice, publicare/editare în ambele taburi și erori de upload.
- `node tests/upload-handler.cjs`: autorizare, origine, limite, semnături, nume, înlocuire SHA și descărcare fixată la commit; fără apeluri GitHub reale.
- `supabase/tests/releases-access.sql`: verificat pe instanța reală, cu ROLLBACK pentru toate datele QA; publicare/editare autorizată și URL-uri nesigure refuzate.

Hero și descărcarea rapidă folosesc cea mai recentă traducere GitHub publicată. Până la prima publicare nu se afișează un download GitHub fictiv. Nexus rămâne alternativa explicită.
