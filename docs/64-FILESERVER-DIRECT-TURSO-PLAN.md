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
- `/api/admin`, `/api/account`, `/api/auth` and `/admin` are not reverse-proxied. `/api/account`, `/api/auth` and
  browser `/api/watch` remain frontend-facing fileserver routes backed directly by Turso.
- `/live` and `/logos` may remain pass-through byte routes through `ADMIN_MEDIA_TARGET`; they are playback/image
  origins, not admin API calls. The admin console has its own origin.
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
5. Remove API/admin-console proxy registration and rename any retained byte proxy to `ADMIN_MEDIA_TARGET`.
6. Convert fixtures and tests to a temporary libSQL admin schema; retain one fake provider endpoint.

## 3. Acceptance

- Channel/library cache fills, detail, seasons, related, auth, profile and account persistence make zero admin API
  calls. Movie detail or episode reads may make exactly one provider GET.
- Cache and account behavior survives restart, Turso failure keeps a warm display cache, and account isolation holds.
- `/api/admin/*` cannot pass through the fileserver. `/live` and `/logos` still load when configured.
- The outbound-request invariant test rejects every admin API URL except `GET /api/admin/providers`.
- The gate passes, the real stack is driven twice for idempotence, and the Windows package is produced.

## 4. Security consequence

A packaged fileserver carrying a Turso write token and `JWT_SECRET` exposes those credentials to that machine's
owner. This is an explicit consequence of direct database access. Production secrets must be injected, never
committed; any credential already exposed in a tracked environment file must be rotated.
