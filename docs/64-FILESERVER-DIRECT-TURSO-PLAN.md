# 64 - Fileserver direct Turso plan

**Status: approved owner direction, 2026-10-20.** The fileserver connects directly to the admin Turso database
everywhere it previously called or passed through an admin API. The sole admin API data call is the provider read.

## 1. Contract

- The fileserver owns one `@libsql/client` connection configured by `TURSO_DATABASE_URL` and
  `TURSO_AUTH_TOKEN`. It never runs admin migrations; the backend remains the schema migrator.
- Channels, title catalog/detail/seasons/related, accounts, sessions, settings, favorites, collections and browser
  watch data are read or written through fileserver repositories under `src/fileserver/src/store/`.
- `GET {adminUrl}/api/admin/providers` is the only admin API request. It is public today, request-local, and its
  records and generated sources are never persisted in the fileserver database.
- `/api/account` and `/api/auth` are not reverse-proxied: they remain frontend-facing fileserver routes
  backed directly by Turso (browser `/api/watch` likewise). **Amended 2026-11-03 (owner: the short URL
  stays):** on a server deployment
  that sets `ADMIN_PROXY_TARGET`, the fileserver forwards `/admin` (the console the backend serves at its
  own `/admin/`), `/api/admin`, `/live` and `/logos` at their own paths, carrying the client's address in
  `X-Forwarded-For`; the packaged desktop never sets the target, so nothing admin-facing leaves it.
- `CATALOG_RUNNER_TARGET` is the one narrower exception: `/api/admin/catalog-jobs/*` is forwarded first
  to the external API, where its `JobRunner` dispatches Cloud Run Jobs. Every other admin control remains
  on `ADMIN_PROXY_TARGET`, so playlists and live operations stay on the always-on backend.
- `/live` and `/logos` are playback/image origins, not admin API calls. On the web deployment the console
  answers at `gigastream.app/admin/` through that proxy, beside the app itself.
- The local six-hour channel/title display cache remains. Direct SQL fills it, preserving cold-await,
  stale-while-revalidate, manual refresh and failure retention.
- `adminUrl` remains the provider and media origin. The Turso URL, without its token, identifies the cache source.
- Startup validates the admin schema version and refuses an unsupported schema. Secrets are environment-only and
  are never logged, returned, cached locally or embedded in frontend assets.

## 2. Delivery

1. Add the libSQL dependency, configuration, injectable database seam, schema check and close lifecycle.
2. Replace channel and title HTTP synchronization and live title reads with fileserver-owned SQL repositories.
3. Reduce the HTTP client to the provider GET and assert no other admin API request can occur.
4. Implement account authentication, reset, profile, settings, favorites, collections and watch routes directly
   over Turso while preserving token rotation, revocation, isolation and cookie behavior.
5. Remove API/admin-console proxy registration and rename any retained byte proxy to `ADMIN_MEDIA_TARGET`
   (superseded 2026-11-03: the server deployment's `ADMIN_PROXY_TARGET` re-registers the console and admin
   API pass-through; the byte-only name is retired).
6. Convert fixtures and tests to a temporary libSQL admin schema; retain one fake provider endpoint.

## 3. Acceptance

- Channel/library cache fills, detail, seasons, related, auth, profile and account persistence make zero admin API
  calls. Movie detail or episode reads may make exactly one provider GET.
- Cache and account behavior survives restart, Turso failure keeps a warm display cache, and account isolation holds.
- `/api/admin/*` cannot pass through the packaged desktop fileserver (it sets no `ADMIN_PROXY_TARGET`);
  on a server deployment it answers on the backend behind that proxy (`/live` and `/logos` likewise).
- The outbound-request invariant test rejects every admin API URL except `GET /api/admin/providers`.
- The gate passes, the real stack is driven twice for idempotence, and the Windows package is produced.

## 4. Security consequence

A packaged fileserver carrying a Turso write token and `JWT_SECRET` exposes those credentials to that machine's
owner. This is an explicit consequence of direct database access. Production secrets must be injected, never
committed; any credential already exposed in a tracked environment file must be rotated.
