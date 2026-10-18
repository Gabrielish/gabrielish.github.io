# Download statistics

The public sidebar adds Nexus `mod.downloads` to native site download initiations.
Nexus unique downloads and file-level download counts are deliberately not summed.
Direct links continue to GitHub even if the counter fails. Historical site clicks
cannot be recovered; the first-party counter starts at deployment.

Source: https://graphql.nexusmods.com/ (anonymous V2 GraphQL, fixed game 3474,
mod 24379, UID 14920716410683). Cached totals survive errors. The API's Mod
schema does **not** expose page views. The 906 views are the owner's supplied
2026-10-18 snapshot, documented in the privacy page as not automatically synchronized.
Never update its observation date when only the download request succeeds.

Deployment: apply `migrations/20261018182938_bg3ro_download_statistics.sql`,
deploy `functions/bg3ro-statistics/index.ts` with gateway JWT verification off
(the handler checks its public API key, origin and fixed event shape), then
apply `statistics-cron.sql` to hosted Postgres. No personal Nexus API token is
required. The `SUPABASE_SERVICE_ROLE_KEY` is read only inside the Edge runtime.
The publishable key in the scheduler/frontend is intentionally public.

`bg3ro-nexus-daily` runs at 03:15 UTC. Atomic DB claiming limits upstream fetches
to one attempt per 23 hours, including anonymous requests. Failed requests leave
the previous total and mark it stale. Visitor page loads read the cache only.

Site events are best-effort initiation counts, not completed transfers or unique
people. One event per release/network/hour is accepted. Network addresses become
daily rotating HMAC-SHA256 fingerprints server-side; raw addresses are not stored
in the counter tables. Fingerprints older than two days are purged on sync. Shared
networks may be undercounted; bot-driven requests cannot be fully prevented by a
public telemetry endpoint. Browsers cannot write totals or call service-only RPCs.
No page-view cookie or persistent browser identifier is added.

## Site views

Apply `migrations/20261018184659_bg3ro_page_views.sql` before deploying the
updated Edge handler. `site_views` starts at zero; UI displays
`nexus_views + site_views`. Views are counted only on production after the
existing Auth initialization event, once per document. Repeated accesses from
one network are deduplicated in half-hour buckets. Hash/tab navigation does
not create views. Local previews and connected moderators are excluded.

For member visits, Edge validates the JWT against `/auth/v1/user` and passes
only that verified identity to the service-only `bg3ro_record_view` RPC. The
RPC checks the private moderator allowlist; browser-supplied user IDs and role
flags are never trusted by the server. An unrecognized/logged-out administrator
cannot be distinguished from an anonymous visitor. Network deduplication can
undercount shared connections. Temporary view fingerprints are purged by the
existing daily sync job just like download fingerprints.

Checks: `tests/statistics-edge.cjs`, `tests/statistics.cjs`,
`tests/portal-db.cjs` and rollback-only `tests/statistics-access.sql` (in
`supabase/`). Existing sidebar/release tests cover rendering and download links.
