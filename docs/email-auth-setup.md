# Activarea autentificării cu e-mail și Turnstile

Formularele folosesc Supabase Auth: `signUp`, `signInWithPassword`, `resetPasswordForEmail`, `updateUser`. Confirmarea adresei rămâne activă. Migrarea `email_account_profiles` creează profilul public după confirmare și păstrează numele/fotografia editate. Rolul Admin se verifică exclusiv prin lista privată de administratori.

## CAPTCHA real

1. În Cloudflare Dashboard → Turnstile, creează un widget Managed pentru hostname-ul **gabrielish.github.io** (fără protocol/cale).
2. Copiază **secret key** direct în Supabase Dashboard → Authentication → Bot and Abuse Protection → CAPTCHA → Cloudflare Turnstile. Secretul nu se pune în Git, în browser sau în chat.
3. Pune numai **site key** public în `turnstileSiteKey` din `portal-config.js`. Publică fișierul și activează protecția Supabase în aceeași sesiune de configurare; verifică imediat cele trei fluxuri de mai jos.
4. Testează conectarea, înregistrarea/resetarea parolei și „Continuă ca oaspete”. Tokenul trebuie verificat de Supabase; simpla afișare a widgetului nu oferă protecție. Nu folosi cheile de test Cloudflare în producție.

Fără site key, widgetul nu apare și nu este simulată o verificare reușită. Configurarea protecției globale în Supabase afectează și conturile anonime: site-ul cere CAPTCHA după apăsarea explicită a butonului pentru oaspete, fără să întrerupă prima vizită cu o provocare automată.

## Confirmări și recuperare prin e-mail

- Supabase → Authentication → Email: activează e-mail/parolă și păstrează confirmarea adresei.
- Configurează **Custom SMTP** pentru livrarea către utilizatori. Serviciul implicit Supabase este limitat la adresele membrilor echipei; activarea providerului Email nu confirmă că livrarea publică este configurată.
- URL Configuration: Site URL `https://gabrielish.github.io/`; adaugă redirecturile exacte `https://gabrielish.github.io/` și `https://gabrielish.github.io/?auth=recovery`.
- Confirmarea/resetarea PKCE se deschide în același browser în care ai pornit fluxul. La expirare/alt browser, reia cererea din formular. Nu dezactiva confirmarea doar pentru a ocoli configurarea SMTP.
- Testează cu o adresă controlată: înregistrare → confirmare → autentificare → profil; apoi resetare → link → parolă nouă → autentificare. Nu sunt trimise e-mailuri către utilizatori de test în mod automat de verificările locale.

## Restaurarea navbarului

Sesiunea există deja în stocarea persistentă Supabase (`bg3ro-auth`), cu tokenurile Discord suplimentare eliminate. Bara ascunde starea provizorie până la restaurarea sesiunii; nu afișează întâi Conectare și apoi comenzile contului. Cache-ul numelui este folosit numai pentru prezentare, niciodată pentru autorizare.

Documentație: [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Cloudflare widget](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/).
