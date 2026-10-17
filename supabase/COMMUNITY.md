# Comunitatea publică și modul oaspete

Migrarea `20261017215722_public_community_guests.sql` este aplicată în proiectul `gatkiwcyjgbgjwfgvplm`. Nu o rula din nou. Proprietarul a activat Allow anonymous sign-ins în Supabase Auth.

- Discuțiile aprobate (inclusiv mesajele noi, publicate imediat) se citesc fără autentificare.
- Raportările noi sunt publice, cu nume ales și consimțământ explicit în formular. Răspunsurile moderatorului au aceeași vizibilitate ca raportul. UUID-ul autorului nu este acordat cititorilor fără sesiune.
- Raportările vechi păstrează `is_public=false`; le văd doar autorul și moderatorul. Nu publica automat informații trimise anterior ca private.
- Gabrielish are rolul existent de moderator, verificat prin UUID Supabase privat, nu prin numele afișat. Poate șterge discuții și raportări. Ștergerea unei discuții elimină și răspunsurile sale.
- „Continuă fără cont” apelează `signInAnonymously()`: creează o sesiune tehnică Supabase Auth, fără Discord, e-mail sau parolă. Numele oaspetelui nu este verificat și mesajele sunt etichetate ca atare. Nu promite anonimitate imposibil de urmărit.
- Sesiunea este în sessionStorage, nu localStorage. Reîncărcarea aceleiași file o păstrează; deconectarea, ștergerea stocării, alt dispozitiv sau altă sesiune pot pierde accesul la mesajele proprii. Nu există recuperare prin e-mail pentru oaspeți.
- Ratingurile și compatibilitatea cer cont Discord. UI nu transmite un `userId` de membru pentru oaspeți. Politicile RLS **restrictive**, aplicate tuturor operațiilor, refuză separat JWT-urile semnate cu `is_anonymous=true`; rolul SQL `authenticated` singur nu dovedește un cont permanent.
- `is_guest` este atribuit de trigger din JWT, nu din date trimise de client. Mesajele sunt afișate ca text, nu HTML.
- Anti-spam: 30 secunde între trimiteri și maximum 5/zi/oaspete/tip, respectiv 20/zi/membru/tip. Contoarele supraviețuiesc ștergerii mesajelor. Aceste limite nu împiedică abuzul prin crearea mai multor conturi; protecția Auth per IP și, recomandat, CAPTCHA sunt necesare pentru trafic ostil. CAPTCHA nu este configurat în interfața actuală. Conturile tehnice anonime nu se curăță automat.

## Verificări

`tests/community-guests.cjs` verifică interfața cu SDK sintetic (lectură publică, nume fără Discord, consimțământ, gating rating/vot, ștergere moderator, XSS și layout mobil). `supabase/tests/public-community-access.sql` verifică pe instanța reală izolarea rapoartelor vechi, granturile anonime, publicarea imediată, refuzul voturilor oaspeților, voturile membrilor, rate limiting și ștergerea de către moderator. Datele SQL de diagnostic sunt anulate integral prin ROLLBACK.

După activarea autentificării anonime, advisorul poate semnala euristic politici `authenticated` care acceptă sesiuni anonime. Accesul la mesaje este intenționat; moderarea rămâne verificată prin tabelul privat, iar ratingurile/voturile sunt refuzate de politicile restrictive suplimentare (verificate prin SQL). Nu înlătura aceste politici restrictive. Documentație: https://supabase.com/docs/guides/auth/auth-anonymous și https://supabase.com/docs/guides/database/database-advisors?lint=0012_auth_allow_anonymous_sign_ins .
