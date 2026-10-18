# 46 - Local cache of channels and titles in the fileserver (plan)

**Status: PROPOSED 2026-10-18, awaiting the owner's answers to section I.** Requirements (owner, 2026-10-18): a persistent local
cache in the fileserver's SQLite; synced in the background at launch/first boot; a 6-hour freshness window (like the backend
sync); NO timers (staleness is checked at launch and when a page reads); keep it simple and store only what the app displays and
uses to load (stream URL, ids, image references, display details); no providers, API keys, tokens or secrets stored locally.
Docs first (`07`), then code by workers. Scope: the fileserver, two additive backend reads, a small frontend change.

## 0. Findings and decisions

1. **`GET /api/titles` is not the stored list.** It is TMDB discover (20 rows a page, 500 pages a kind) filled through the backend
   store. The only route that lists stored titles is `GET /api/titles/stored` and it needs an admin JWT, which the fileserver must
   never hold. **Decision:** add one public, store-only read, `GET /api/titles/catalog` (D.1). Stored rows are mostly thin list
   rows (genres are TMDB genre ids; no plot, cast or runtime).
2. The backend's "trending" is TMDB discover `popularity.desc`; the store keeps `popularity.score`, so trending is served from the
   cache with no loss of meaning.
3. **`GET /api/state` calls `live.list({})`**, so a cold or stale read ends in `probe.checkAll()` over every stream: the multi-minute
   stall.
4. The backend's `status`/`checkedAt` are admin-only today (`43` 3.1); the sync's verdict writes take no revision, so the revision
   cannot be a skip key once status is public.
5. The image cache's `sources` map (id to source URL) is in memory only: cached rows keep the source address and `rewrite()` runs at
   read time, so a poster not yet on disk can still be fetched after a restart.
6. The cache is not a Job (`jobs.kind` has a CHECK and the statusbar shows jobs): background cache sync is silent.

**Rule of the whole feature:** the cache mirrors what the backend publishes, whole and from scratch, at most once per 6 hours. It is
checked for staleness only at launch and when a page reads it. A stale cache is served at once and refreshed in the background. A
cache that has never completed a sync (cold) is awaited, because there is nothing else to answer with.

## A. What is cached, and why

**Channels** (source: the PUBLIC `GET /api/channels` answer plus three public fields added in D.1: `status`, `checkedAt`,
`cachedLogoUrl`). Stored in `cached_channels`: `id`, `position` (the backend's order; `ORDER BY position`), `name`, `number`,
`category`, `logo_url` (the backend's `cachedLogoUrl` made absolute when present, else `logoUrl`), `stream_url` (the one possibly
sensitive column, B.4), `status` (`live`/`dead`/NULL), `checked_at`, `revision`. Not stored: `tvgId`, `source`, `kind`,
`playlistId`, `playlistName`, `enabled`, `editedFields`.

**Titles** (what each surface displays): grid/list/rows/continue/history/favorites/collection need `title`, `kind`, `year`,
`rating`, `genres`, `posterUrl` (list columns of `cached_titles`); filters need `year`, `popularity`, genre names; Details popover,
Title information and the Spotlight preview add `plot`, `cast`, `runtimeMs`, `seasons` (counts), `backdropUrl` (nullable detail
columns, filled when a title is opened); the Player's `sources`, `streamUrl`, episodes and related are LIVE ONLY and never stored.
Shape: one list table with nullable detail columns, a genre join table, a ~40-row genre dictionary. No detail table, episodes
table or snapshot table.

**Served from the cache vs live (the rule):** channels list, categories, search, last-channel check: cache. Library `view=all`
with no `q`: pages, all five sorts, Genre/Year/type/Unwatched filters, facets, totals: cache (SQL). `watched=watching|watched`:
history tables plus cached card facts. History, Favorites, Collection title rows, Continue: cached list rows (replaces up to 100
detail fetches per view). `trending`: cache ordered by stored popularity. `titlesAvailable`: true when the cache holds title rows.
Library `q` (Search, Spotlight): LIVE `GET /api/titles/search`, falling back to a `LIKE` over cached titles on
`backend.unreachable`. `GET /api/titles/:id`: live first (it carries `sources` and `streamUrl`, never cached), written through to
the display columns on success; unreachable: answered from cache without sources, `fromCache: true`. Seasons, episodes, related:
live only (503 offline as today).

**`view=all` from the cache:** cursor `{ localOffset, titlePage, titleOffset }` (cache browsing uses `titleOffset`; live search keeps
`titlePage`); local files first, then titles; `total = locals + cachedCount` (exact). Sorts all end with `title COLLATE NOCASE, id`:
`newest` year DESC then popularity DESC, `oldest` year ASC then popularity DESC, `year` year DESC, `az` title, `trending`
popularity DESC; rows with no year or popularity last. Genre is "any of" via `EXISTS` on the join table; Year `= ?`; type a `kind`
predicate; `unwatched` is `NOT EXISTS (watch_entries ...)` in the same database. Facets: genres `SELECT DISTINCT`, years the existing
`yearFacets`.

## B. Schema, never stored, invalidation

**Migration `006-backend-cache.sql`** (fileserver migrations are 001-005 today; forward-only, transactional):
`cache_state(dataset PK 'channels'|'titles', source_key (first 16 hex of sha256 of the normalized adminUrl), synced_at (NULL =
never), attempted_at, error_code, revision, run)`; `cached_channels(id PK, position, name, number, category, logo_url, stream_url
NOT NULL, status CHECK live|dead, checked_at, revision)` + index on `position`; `cached_titles(id PK, kind, title, year, rating,
popularity, poster_url, backdrop_url, in_catalog, seen_run, plot, cast_json, runtime_ms, seasons_json, detail_at)` + indexes on
`title COLLATE NOCASE`, `year`, `popularity` (drop any the acceptance benchmark does not need: a first-page query must take under
30 ms at 30,000 rows); `cached_title_genres(title_id FK cascade, genre, PK(title_id, genre)) WITHOUT ROWID` + index on `genre`;
`cached_genres(kind, id, name, PK(kind,id))`. `seen_run` makes the sweep clock-independent; `in_catalog = 0` marks a title opened
from Search that is not in the synced catalog (created only by a user action, never swept). `user_version` becomes 6.

**Never stored:** providers, `sources`, provider names/origins/templates/frame origins; a title's `streamUrl` and any episode data;
the backend's `adminUrl` as a copy (only the hash `source_key`); any JWT, refresh token, cookie, API key, `TMDB_READ_TOKEN`, playlist
URL or file name; `tvgId`, `source`, `playlistId`, `playlistName`, `enabled`, `editedFields`, OMDb blocks; image bytes beyond the
existing image cache.

**Secrets enforced by construction:** (1) public GETs only: the sync sends no `Authorization` header and no cookie (a test records
every sync request's headers); (2) column whitelist by explicit mappers (`channelRowOf`, `titleRowOf` pick named fields and never
spread; zod schemas list only the stored fields; the detail write-through never touches `sources`/`streamUrl`); (3) a schema-scan
test reads `PRAGMA table_info` of all five tables and asserts the EXACT column set equals a whitelist in the test, no column or
table name matches `/secret|token|passw|api.?key|jwt|credential|auth|provider|template|origin|session|cookie|playlist/i`, and
`stream_url` is the only column holding a stream address; (4) a poison test: a fake backend answers with extra fields (`providers`,
`sources`, `apiKey`, `token`, `playlistUrl`, `tvgId`, `source`, `playlistName`, a title `streamUrl`); after a sync every row of all
five tables and the database file bytes (and `-wal`) contain none of those strings; (5) a channel whose stream or logo URL has userinfo
is dropped; (6) the cache never logs rows and a failed attempt stores only the dotted code; (7) a `source_key` mismatch (a different
backend) purges the cache.

**The stream URL at rest, stated plainly:** for a credentialed playlist the stream address is the subscriber's credential in clear
text (`43` 3.1). Caching adds an at-rest copy in `~/.giga-stream/giga-stream.db` (and `-wal`), readable by any process running as
the user and included in backups; it is not new network exposure (the backend already publishes it and the fileserver already holds
it in memory). **Decision: store it** (needed to play; the alternative, resolving at play time, is excluded by `00` section 5 and
would make Live depend on the backend being up; a side benefit is channels keep playing while the backend is down). Mitigations: the
only sensitive column, whitelisted by name; never logged or put in an error/notice/audit; unpublished rows swept; purged on a
backend change; userinfo URLs refused. Not built: encryption at rest (a key beside the data would be theatre). Titles: provider
`sources` and `streamUrl` are never persisted.

**Invalidation:** channel disabled/deleted/unpublished: gone at the next sync (channels are replaced whole in one transaction);
channel URL/name/logo edited or status changed: overwritten at the next sync; title disabled/deleted: absent from the catalog read,
so the sweep deletes it (`seen_run < run AND in_catalog = 1`); re-enabled: inserted; edited: upsert overwrites list columns; stale
detail: the next live open writes it through; backend changed: purge, cold; a failed or cut-off sync: no sweep, `synced_at`
unchanged, rows kept.

## C. The sync algorithm

**Freshness (one pure function):** a dataset is due when no `cache_state` row exists, `source_key` differs, `synced_at` is NULL,
`now - synced_at >= CACHE_WINDOW_MS` (6 h), or `synced_at > now`. A dataset whose last attempt failed is not due again for
`CACHE_RETRY_GAP_MS` (5 min) (a comparison at read time, not a timer); a manual Refresh ignores the gap.

**When it runs (no timers):** launch (`buildApp` calls `cache.start()` after the services exist, detached, errors swallowed; a
`syncOnStart` option defaults true, tests set false); a page read (`ensureFresh(dataset)`: channels on `GET /api/channels` and
`GET /api/state`; titles on `GET /api/library`, `/api/library/continue` and the title routes: one indexed row read); manual
(`POST /api/channels/refresh` forced and awaited; new `POST /api/library/refresh` likewise; both join an in-flight run and answer
`503 backend.unreachable` / `502 backend.bad_response` on failure with the cache still serving); an `adminUrl` change is seen by
the next `ensureFresh` (purge, cold).

**Single-flight and stale-while-revalidate:** one in-memory promise per dataset; `attempted_at` is written synchronously before the
first `await`, so N concurrent page loads cause exactly one backend sync. Warm and due: start the sync detached, answer from cache
now. Cold: await the single-flight sync, then answer with what the cache holds (empty: the existing empty state). `GET /api/state`
never awaits a cold sync; the Live surface's own read on activation awaits it. The page that triggered a warm refresh is not updated
mid-view (no push channel by rule); the next read sees the new data.

**Channels sync:** stamp `attempted_at`; one `GET {adminUrl}/api/channels` (existing admin client, 20 s timeout, 32 MiB cap, quit
signal; about 650 KB at 2,600 channels); map through `channelRowOf` (skip an item with no `id`/`streamUrl` or with userinfo;
`position` = array index; status dead -> `dead`, live -> `live`, absent -> NULL; logo = `cachedLogoUrl` made absolute else
`logoUrl`); in ONE transaction `DELETE FROM cached_channels`, insert, set `synced_at = start`, `error_code = NULL`, `revision`,
`source_key`; on failure set `error_code` only.

**Titles sync:** stamp `attempted_at`, `run = run + 1`; genre dictionary `GET /api/titles/genres?kind=movie|tv` (replace in a
transaction; on failure keep the stored one, fail if empty); walk `GET /api/titles/catalog?after=<id>&limit=500` until no `next`
(about 22 requests at 10,923 titles, about 2.4 MB; `next` must strictly advance, hard cap 200,000 rows; each page one transaction,
rows upserted: list columns overwritten, `in_catalog = 1, seen_run = run`, detail columns NEVER touched; genre rows deleted and
re-inserted decoded with `byId.get(token) ?? token`, an unknown numeric token dropped; the quit signal checked between pages); sweep
only if the chain ended normally (`DELETE FROM cached_titles WHERE in_catalog = 1 AND seen_run < run`; persist `run`, `synced_at`,
`error_code = NULL`); on failure or abort: no sweep, no `synced_at` change, only `error_code`.

**Bounds, offline, quit:** page size 500, sequential, memory one page, short synchronous transactions on the one connection. Backend
unreachable: only `error_code` is stamped; reads keep serving; `GET /api/state` shows `backend.connected: false` with `readAt` (cache
age) unchanged; no error reaches the user. Images: no prefetch (a poster per title is about 450 MB); rows keep source URLs and the
existing lazy fetch and disk cache do the rest (offline, an uncached poster shows its fallback). Quit: `services.close()` runs
`cache.close()` first (abort, await the in-flight promise settling), then `jobs.close()`, then `database.close()`. **No timers:**
nothing schedules a refresh; `AbortSignal.timeout` stays as a request deadline only.

## D. Live channels path and the backend changes

**D.1 Backend (additive, `03` 7.2, 7.4).** (1) The PUBLIC channel answer (`publicChannel()` in `channel-views.ts`, type
`BackendChannel`) gains optional `status: "live"|"dead"`, `checkedAt` and `cachedLogoUrl` for stream rows (not a secret; the sync's
verdict still takes no revision); for `kind: live` rows `channel-service.list()` sets `status` from the engine (`live` when the engine
state is `live`, `dead` when `failed`, else absent). `cachedLogoUrl` gives the fileserver a logo it can always cache (backend-hosted,
magic-byte-checked, hash-named). (2) `GET /api/titles/catalog?after=<id>&limit=<1..500>`: public, store-only, NEVER asks TMDB; rows are
enabled titles (synced and manual, edited values already in the payload) ordered by `id`; answer `{ items: [{ id, kind, title, year?,
rating?, popularity?, posterUrl?, backdropUrl?, genres }], next? }`, never `streamUrl`/`sources`/`enabled`; registered before
`/api/titles/:titleId`; rows failing `StoredTitleSchema` skipped. Files: `types/title-catalog.ts`, `store/title-catalog.ts`,
`services/title-catalog-service.ts`, a line in `store/title-repository.ts`, the route in `api/titles.ts`, wiring in
`service-registry.ts`.

**D.2 Fileserver Live.** The probe is DELETED: `stream-probe.ts`, `live-view.ts` (`summaryOf`, `withVerdicts`), `PROBE_*`, the
`probeFetch` seam, `LIVE_VIEW_TTL_MS`/`liveViewTtlMs`. `live-channels-service.ts` becomes thin: `list(query)` = `ensureFresh` then a
repository read (`q` as `LIKE` on name and number, `category =`, `ORDER BY position`, categories by `GROUP BY`; never throws on a sync
failure); `refresh()` forces the sync and keeps the 503/502 codes; `lastId` and `PATCH /api/channels/last` check `cached_channels`
(work offline); `backend()` is derived from `cache_state`. Status words come from the cache only (backend `dead` -> `offline`,
absent -> `unknown`; the frontend schema is unchanged). **The fileserver still probes nothing**, not even the channel being played
(the player's failure note with Retry is the local truth). Live `Refresh` now means "force a sync now and re-read" and no longer
re-probes (`00` 4.4, `02` 3.2, `06` 3.2).

## E. Interface impact (no redesign)

Skeletons only when the cache is empty (`titlesAvailable` is cache-driven; `02` 3.2/7 and `06` 3.2/4.2 reworded). Library `Refresh`:
`services/library.ts` `refreshLibrary()` calls `POST /api/library/refresh`; `useLibraryData.refresh` awaits it then re-reads.
Offline Play reason: `TitleDetail.fromCache: true` (`services/schemas/title-schema.ts`) makes the Play tooltip say `The admin backend
is not reachable.`. Optional: a Live status-word tooltip `Checked <age>`; `BackendState.titlesReadAt`. No statusbar entry, no
sentence over skeletons, no new control.

## F. Docs to update first (coordinator)

`00` 2, 4.3, 4.4, and 5 ("Saving a copy of the backend's channels, titles or providers" becomes: providers, credentials and provider
sources are never saved; channels and titles are cached for display, owner 2026-10-18, `46`); `01` 1 diagram/table, 1.2, 4.4 (the cache
has no timer; staleness is checked at launch and on reads; not polling), 7 Fileserver (replace "read live, never written to the
database"), plus a checker rule: no `setInterval`/`setTimeout`/`setImmediate` in the fileserver's `services`, `store`, `routes`, `lib`;
`03` 3.4, 3.5, 3.6, 3.2, 4, 5 (rewritten: freshness and SWR, the sync, never stored; old 5.2 probe deleted), 6 (tables, migration 006),
7.2/7.2c (status public), 7.4 (`/api/titles/catalog`), 1 (remove `LIVE_VIEW_TTL_MS`); `43` 3.1 (credentialed URLs also cached at rest
by the fileserver); `02` 3.2/7; `06` 3.2/4.2/4.4/4.6; `04` line 60; `05` launch walkthroughs; `08` Live view row; `22` 3.2a;
`AGENTS.md` (one line: no timers in the cache).

## G. Waves

W0 docs (coordinator). **W1 backend (additive):** the D.1 files; tests `channels-public-status` (status/checkedAt/cachedLogoUrl on the
public answer, no revision bump, live rows from the engine, admin answer unchanged) and `title-catalog` (enabled only, manual
included, deleted/disabled absent, edited values, keyset paging with bounds, never calls TMDB, no `streamUrl`/`sources`, public off
loopback). **W2 fileserver foundation + Live:** `006` migration, `cache-state-repository`, `cached-channel-repository`,
`constants/backend-cache.ts`, `types/backend-cache.ts`, `cache-freshness`, `channels-sync`, `backend-cache-service`
(start/ensureFresh/refresh/single-flight/close), the `no-cache-timers` checker rule; change `admin-client`, `live-channels-service`,
`app-services`, `build-app` (`syncOnStart`, drop `probeFetch`/`liveViewTtlMs`), `config`, routes `channels`/`state`/`health`,
`types/channel`; delete `stream-probe.ts`, `live-view.ts`; tests: schema scan, secrets/poison, freshness table (never synced, 5h59,
exactly 6h, clock back, source mismatch, failure gap), channels cache (cold awaits; warm serves at once and a 6h-old read triggers
EXACTLY one fetch also under N concurrent reads; backend down keeps serving; unpublished swept; status mapping; ZERO requests to
stream URLs; adminUrl change purges; refresh failure 503 with cache intact; close aborts; restart serves with the backend down).
**W3 fileserver titles + Library** (after W2: both touch `app-services.ts`): `cached-title-repository`, `cached-title-query`,
`admin-catalog`, `titles-sync`, `library-all-view`, `library-cached-titles`; change `library-service`, `library-titles` (live search
only), `library-items`, `library-lists`, `titles-service` (live-first write-through, offline `fromCache`), `app-services`,
`routes/library` (`POST /api/library/refresh`), `lib/library-query` (`titleOffset` cursor), constants, `types/library`; delete
`title-session.ts`; tests: titles-sync (3-page walk with genre decode, sweep, failure mid-walk, dictionary failure, non-advancing
cursor, single flight), library-cache (five sorts, filters, exact paging and total, locals first, facets, offline, `q` live with
fallback, history/favorites/collection make ZERO backend calls), detail write-through whitelist, off-catalog rows spared by the
sweep. **W4 frontend:** `refreshLibrary`, `useLibraryData`, `fromCache`, `titlesReadAt`, the Play reason wording, optional tooltip.
**W5 coordinator:** gate, `npm run dist:win`, real-stack acceptance.

**Acceptance on the real stack:** cold boot (empty tables after migration 006): the first `GET /api/channels` returns the 2,600+
channels after one sync and the first `GET /api/library` after the catalog walk (about 22 requests): time both. Second launch: both
read in under 50 ms from cache, `readAt` unchanged, no backend request in the backend's log. Backend-down and the 6-hour case run as
tests against the real backend child process with the injected clock (not on the owner's live data; the coordinator asks before
stopping the backend and never changes `adminUrl` on the real stack). Exactly one background refresh at a 6-hour-old page load: asserted
by counting backend requests in W2/W3. No timers: the new rule plus a grep. The gate passes including the live smoke.

## H. Risks and what is not built

Risks: `view=all` shrinks to the synced catalog (question 1); the stream URL is at rest (B); the backend and fileserver must ship
together (an older backend without `/api/titles/catalog` fails the titles sync with `backend.bad_response`; no fallback code, by
choice); offset paging under change (a repeat or skip if a sync lands between pages; a keyset cursor would remove it, the offset is
simpler); the backend's verdict can be up to 24 h old (the playlist job's default); details are one live read per open (the old
100-entry map is gone); downgrade is refused (`store.newer_schema`). Not built: any timer, scheduler, retry loop or heartbeat; image
prefetch; episode, season or recommendations cache; FTS; delta/ETag sync or a revision skip key; encryption of `stream_url`; a
fileserver stream probe (not even for the channel being played); a statusbar job or "refreshing" indicator; a push to the page when a
background refresh lands; a setting for the 6-hour window; a cache-size setting or "clear cache" button; a multi-backend cache; pruning
of off-catalog rows; any change to local video files (they stay the fileserver's own SQLite, read per request).

## I. Open questions for the owner

1. **Library scope.** With the cache, `view=all` lists the backend's stored, enabled titles (about 10,923 now; the Library fill is
   capped at TMDB's 500 pages a kind). A title outside it is reachable only through Search. Is that the intended Library? If not,
   keep live TMDB browse as the default and the cache serves only offline and the user lists.
2. **Search:** keep it live with a cache fallback (recommended: finds any TMDB title), or cache-only (simpler, instant, offline, but
   misses titles outside the catalog)?
3. **Status truth:** are you content that Live/Offline words come only from the backend's verdict and that Refresh no longer
   re-checks streams from the desktop?
4. **Stream URL at rest:** do you accept the risk in B? If you will import credentialed playlists, the alternative is caching their
   channels without a stream URL and resolving it at play time, which `00` section 5 currently excludes.
