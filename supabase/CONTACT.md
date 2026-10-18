# Contact and information pages

The public information pages are static directory indexes: /contact/, /intrebari-frecvente/, /confidentialitate/, /termeni/. Their footers link back to the main project and the owner-supplied Polyhedron URL. Legal text describes the implemented service; it is not a legal compliance certification and should be reviewed if the operator, providers or processing purposes change.

Public contact: Gabrielish, gabrielish@proton.me (explicitly approved for publication by the owner).

Contact submissions are stored in public.bg3ro_contact_messages with RLS. Visitors sign in anonymously only when submitting, unless an existing Discord/guest session is present. No Discord login, password or mailbox verification is required. Name, reply email, subject and body are collected. The form does not send email or notify the owner automatically.

The existing verified moderator can read, mark and delete messages on /contact/ and in the main Actualizări panel. Reading and changing messages requires the private moderator allowlist, not a client-side username. Replies open the moderator's mail application. Public and ordinary authenticated users cannot read the inbox, including their own submissions. Only text is rendered; no user HTML is interpreted.

The database imposes 60 seconds between messages and 3 submissions per rolling 24-hour window per non-moderator Auth identity. The counter survives deleting messages. Client validation, length checks and a honeypot supplement this. Limits are not IP-based; recreating guest identities can bypass identity-based limits. CAPTCHA is not configured; consider Supabase Auth CAPTCHA before broader promotion if spam appears.

Messages are manually deleted when no longer needed; no scheduled retention job or automatic email delivery is configured. Provider log and backup retention is independent. Never add service-role keys or SMTP credentials to browser files.

Verification:

- node tests/information-pages.cjs (synthetic browser submission/inbox, validation, failure state, responsive and no-JS)
- node tests/portal.cjs and node tests/portal-footer.cjs (main-page regressions)
- node tests/portal-db.cjs (real local PostgreSQL engine)
- supabase/tests/contact-access.sql (hosted roles, private access, throttling, author spoofing, moderator actions; all diagnostic writes rolled back)

Migration: 20261018134510_bg3ro_private_contact.sql. Applied using the Supabase migration tool. Hosted SQL access checks passed without retaining diagnostic rows.
