# 46 - Local cache of the backend's channels and titles in the fileserver (plan, v2)

**Status: APPROVED by the owner 2026-10-18 with these decisions:** (1) the fileserver syncs a **snapshot of the full backend
database** (whatever the backend publishes at that time); (2) **search only queries the cached database, nothing live**; (3) **the
desktop no longer checks dead/alive** (the curation was already done in the admin), so there are no Live/Offline words; (4) there
are no credentials in our playlists or channels, so **no masking and no secret-scanning machinery: we save what we get**.
Requirements: a persistent local cache in the fileserver's SQLite; synced in the background at launch/first boot; a 6-hour
freshness window like the backend sync; **no timers** (staleness is checked at launch and when a page reads); keep it simple and
store only what the app displays and uses to load; no providers, API keys or tokens (the fileserver never receives them: it reads
only public routes). Docs first (`07`), then code by workers.

## 0. Findings

1. `GET /api/titles` is TMDB discover (20 rows a page) filled through the backend store; the only stored-list route is
   `GET /api/titles/stored`, which needs an admin JWT the fileserver must never hold. **Add one public, store-only read:
   `GET /api/titles/catalog`** (D.1). Stored rows are mostly thin list rows (genre ids; no plot/cast/runtime).
2. The backend's "trending" is TMDB discover `popularity.desc`; the store keeps `popularity.score`, so trending is served from the
   cache with no loss of meaning.
3. `GET /api/state` calls `live.list({})`, so a cold or stale read ends in `probe.checkAll()` over every stream: the multi-minute
   stall. **The probe is deleted** (D.2).
4. The image cache's `sources` map (id to source URL) is in memory only: cached rows keep the source address and `rewrite()` runs
   at read time.
5. The cache is not a Job (the statusbar shows jobs): background cache sync is silent.

**Rule:** the cache mirrors what the backend publishes, whole and from scratch, at most once per 6 hours. It is checked for
staleness only at launch and when a page reads it. A stale cache is served at once and refreshed in the background. A cache that
has never completed a sync (cold) is awaited, because there is nothing else to answer with.

## A. What is cached

**Channels** (the PUBLIC `GET /api/channels` answer; one small additive backend field, D.1): `cached_channels(id, position, name,
number, category, logo_url, stream_url, revision)`. `position` is the backend's order; `logo_url` is the backend's `cachedLogoUrl`
made absolute when present, else `logoUrl`. Not stored: `tvgId`, `source`, `kind`, `playlistId`, `playlistName`, `enabled`,
`editedFields`, and **no status** (decision 3).

**Titles** (the catalog read of D.1): `cached_titles(id, kind, title, year, rating, popularity, poster_url, backdrop_url, plot,
cast_json, runtime_ms, seasons_json, detail_at, ...)`: list columns from the sync, nullable detail columns filled when a title is
opened. `cached_title_genres` (join, for filtering) and `cached_genres` (the genre dictionary). Not stored, ever: provider
`sources`, a title's `streamUrl`, episodes (live only, for the Player).

**Served from the cache:** the channels list, categories, search, last-channel check; **every Library read**: `view=all` pages,
the five sorts, Genre/Year/type/Unwatched filters, facets, totals (exact), `watched=watching|watched`, History/Favorites/Collection/
Continue title rows, trending (cache ordered by stored `popularity`), `titlesAvailable` (true when the cache holds title rows), and
**Search and the Spotlight (`q`): a SQL `LIKE` over the cached titles, ordered by popularity, nothing live**. **Live reads that
remain:** `GET /api/titles/:id` (live first because it carries the Player's `sources`/`streamUrl`, never cached; written through to
the display columns on success; unreachable: answered from cache without sources, `fromCache: true`), seasons, episodes, related.
Local video files stay the fileserver's own SQLite, read per request as today.

**`view=all` from the cache:** cursor `{ localOffset, titleOffset }`; local files first, then cached titles; `total = locals +
cachedCount`. Sorts all end with `title COLLATE NOCASE, id`: `newest` year DESC then popularity DESC, `oldest` year ASC then
popularity DESC, `year` year DESC, `az` title, `trending` popularity DESC (rows with no year/popularity last). Genre is "any of" via
`EXISTS` on the join table; Year `= ?`; type a `kind` predicate; `unwatched` is `NOT EXISTS (watch_entries ...)`. Facets: genres
`SELECT DISTINCT`, years the existing `yearFacets`. The live-search paging code (`titlePage`, the thinned-page top-up) is deleted.

## B. Schema and invalidation

**Migration `006-backend-cache.sql`** (fileserver migrations are 001-005; forward-only; `user_version` 6): `cache_state(dataset
PK 'channels'|'titles', source_key (first 16 hex of sha256 of the normalized adminUrl), synced_at (NULL = never), attempted_at,
error_code, revision, run)`; `cached_channels` + index on `position`; `cached_titles` + indexes on `title COLLATE NOCASE`, `year`,
`popularity` (drop any the acceptance benchmark does not need: a first-page query under 30 ms at 30,000 rows); `cached_title_genres(
title_id FK cascade, genre, PK(title_id, genre)) WITHOUT ROWID` + index on `genre`; `cached_genres(kind, id, name)`. `seen_run` makes
the sweep clock-independent; `in_catalog = 0` marks a title opened by a user action that is not in the synced catalog (never swept).

**What we store (decision 4):** the display and load fields the public routes publish, via explicit field mappers (a mapper picks
named fields and never spreads the incoming object, so a new upstream field is not stored by accident). The sync sends no
`Authorization` header and no cookie (public GETs only). One light test asserts the exact column set (so a provider/`sources`/
`streamUrl` column cannot be added without a test and doc edit); there is no poison-dump test, no name-regex scan and no URL
userinfo handling. A different backend (`source_key` mismatch) purges the cache.

**Invalidation:** channel disabled/deleted/edited: gone or overwritten at the next sync (channels are replaced whole in one
transaction); title disabled/deleted: absent from the catalog read, so the sweep deletes it (`seen_run < run AND in_catalog = 1`);
re-enabled: inserted; edited: the upsert overwrites list columns; stale detail: the next live open writes it through; a failed or
cut-off sync: no sweep, `synced_at` unchanged, rows kept.

## C. The sync

**Freshness (one pure function):** a dataset is due when no `cache_state` row exists, `source_key` differs, `synced_at` is NULL,
`now - synced_at >= CACHE_WINDOW_MS` (6 h), or `synced_at > now`. A dataset whose last attempt failed is not due again for
`CACHE_RETRY_GAP_MS` (5 min) (a comparison at read time, not a timer); a manual Refresh ignores the gap.

**When (no timers):** launch (`buildApp` calls `cache.start()`, detached, errors swallowed; a `syncOnStart` option defaults true,
tests set false); a page read (`ensureFresh(dataset)`: channels on `GET /api/channels` and `GET /api/state`; titles on every
`/api/library*` and title route; one indexed row read); manual (`POST /api/channels/refresh` forced and awaited; new
`POST /api/library/refresh` likewise; both join an in-flight run and answer `503 backend.unreachable`/`502 backend.bad_response` on
failure with the cache still serving); an `adminUrl` change is seen by the next `ensureFresh` (purge, cold).

**Single-flight and stale-while-revalidate:** one in-memory promise per dataset; `attempted_at` is written synchronously before the
first `await`, so N concurrent page loads cause exactly one backend sync. Warm and due: start the sync detached and answer from the
cache now. Cold: await the single-flight sync, then answer with what the cache holds. `GET /api/state` never awaits a cold sync.
The page that triggered a warm refresh is not updated mid-view (no push channel); the next read sees the new data.

**Channels sync:** stamp `attempted_at`; one `GET {adminUrl}/api/channels` (existing admin client, 20 s timeout, 32 MiB cap, quit
signal; about 650 KB at 2,600 channels); map via `channelRowOf`; in ONE transaction `DELETE FROM cached_channels`, insert, set
`synced_at = start`, `error_code = NULL`, `revision`, `source_key`; on failure set `error_code` only.

**Titles sync:** stamp `attempted_at`, `run = run + 1`; the genre dictionary (`GET /api/titles/genres?kind=...`, replaced in a
transaction; on failure keep the stored one, fail if empty); walk `GET /api/titles/catalog?after=<id>&limit=500` until no `next`
(about 22 requests at 10,923 titles, about 2.4 MB; `next` must strictly advance, hard cap 200,000 rows; each page one transaction,
rows upserted: list columns overwritten, `in_catalog = 1, seen_run = run`, detail columns never touched; genre rows re-inserted
decoded with `byId.get(token) ?? token`; the quit signal checked between pages); sweep only if the chain ended normally; on failure
or abort: no sweep, no `synced_at` change, only `error_code`.

**Bounds, offline, quit:** page size 500, sequential, memory one page, short synchronous transactions. Backend unreachable: only
`error_code` is stamped, reads keep serving, `GET /api/state` shows `backend.connected: false` with `readAt` (cache age) unchanged,
no error reaches the user. Images: no prefetch (about 450 MB of posters); the existing lazy fetch and disk cache do the rest. Quit:
`services.close()` runs `cache.close()` first (abort, await the in-flight promise settling), then `jobs.close()`, then
`database.close()`. **No timers:** nothing schedules a refresh; `AbortSignal.timeout` stays as a request deadline only.

## D. Backend changes and the Live path

**D.1 Backend (additive, `03` 7.2, 7.4).** (1) The PUBLIC channel answer gains optional `cachedLogoUrl` for stream rows (the backend's
hash-named cached logo, so the desktop always has a logo it can cache; not a secret). No status field is added. (2) `GET
/api/titles/catalog?after=<id>&limit=<1..500>`: public, store-only, NEVER asks TMDB; enabled titles (synced and manual, edited values
already in the payload) ordered by `id`; answer `{ items: [{ id, kind, title, year?, rating?, popularity?, posterUrl?,
backdropUrl?, genres }], next? }`, never `streamUrl`/`sources`/`enabled`; registered before `/api/titles/:titleId`; rows failing
`StoredTitleSchema` skipped. Files: `types/title-catalog.ts`, `store/title-catalog.ts`, `services/title-catalog-service.ts`, a line in
`store/title-repository.ts`, the route in `api/titles.ts`, wiring in `service-registry.ts`.

**D.2 Fileserver Live (decision 3).** The probe is DELETED: `stream-probe.ts`, `live-view.ts`, `PROBE_*`, the `probeFetch` seam,
`LIVE_VIEW_TTL_MS`/`liveViewTtlMs`. `live-channels-service.ts` becomes thin: `list(query)` = `ensureFresh` then a repository read
(`q` as `LIKE` on name and number, `category =`, `ORDER BY position`, categories by `GROUP BY`; never throws on a sync failure);
`refresh()` forces the sync with the 503/502 codes; `lastId` and `PATCH /api/channels/last` check `cached_channels`; `backend()` is
derived from `cache_state`. **There are no Live/Offline words and no status dots in the interface** (nothing feeds them; the curation
was done in the admin); the player's own failure note with Retry stays as the local truth for the channel being played. Live
`Refresh` means "force a sync now and re-read" (`00` 4.4, `02` 3.2, `06` 3.2).

## E. Interface impact

`src/frontend`: remove the Live status word/dot from the channel rows and its schema field, tooltips and tests (`06` 3.2); Library
`Refresh` calls `refreshLibrary()` (`POST /api/library/refresh`) then re-reads; `TitleDetail.fromCache: true` makes the Play tooltip
say `The admin backend is not reachable.`; skeletons show only when the cache is empty (`titlesAvailable` is cache-driven); optional
`BackendState.titlesReadAt`. No statusbar entry, no sentence over skeletons, no new control.

## F. Docs to update first (coordinator)

`00` 2, 4.3, 4.4 and 5 ("Saving a copy of the backend's channels, titles or providers" becomes: providers, credentials and provider
sources are never saved; channels and titles are cached for display, owner 2026-10-18, `46`); `01` 1, 1.2, 4.4 (the cache has no
timer; staleness is checked at launch and on reads), 7 Fileserver, and a checker rule (no `setInterval`/`setTimeout`/`setImmediate`
in the fileserver's `services`, `store`, `routes`, `lib`); `03` 3.4, 3.5, 3.6, 3.2, 4, 5 (freshness/SWR, the sync, never stored;
the probe section deleted), 6, 7.2 (`cachedLogoUrl`), 7.4 (`/api/titles/catalog`), 1 (remove `LIVE_VIEW_TTL_MS`); `02` 3.2/7;
`06` 3.2 (no status words), 4.2, 4.4, 4.6 (search from the cache); `04`, `05`, `08`, `22` 3.2a; `AGENTS.md` (no timers in the cache).

## G. Waves

W0 docs (coordinator). **W1 backend (additive):** the D.1 files; tests `channels-public-logo` (cachedLogoUrl on the public answer,
no revision bump) and `title-catalog` (enabled only, manual included, deleted/disabled absent, edited values, keyset paging with
bounds, never calls TMDB, no `streamUrl`/`sources`, public off loopback). **W2 fileserver foundation + Live:** `006` migration,
`cache-state-repository`, `cached-channel-repository`, `constants/backend-cache.ts`, `types/backend-cache.ts`, `cache-freshness`,
`channels-sync`, `backend-cache-service` (start/ensureFresh/refresh/single-flight/close), the `no-cache-timers` checker rule; change
`admin-client`, `live-channels-service`, `app-services`, `build-app` (`syncOnStart`, drop `probeFetch`/`liveViewTtlMs`), `config`,
routes `channels`/`state`/`health`, `types/channel`; delete `stream-probe.ts`, `live-view.ts`; tests: column-set test, freshness table
(never synced, 5h59, exactly 6h, clock back, source mismatch, failure gap), channels cache (cold awaits; warm serves at once and a
6h-old read triggers EXACTLY one fetch also under N concurrent reads; backend down keeps serving; unpublished swept; ZERO requests to
stream URLs; adminUrl change purges; refresh failure 503 with cache intact; close aborts; restart serves with the backend down).
**W3 fileserver titles + Library** (after W2: both touch `app-services.ts`): `cached-title-repository`, `cached-title-query`,
`admin-catalog`, `titles-sync`, `library-all-view`, `library-cached-titles`; change `library-service`, `library-titles` (deleted or
reduced to the cache query), `library-items`, `library-lists`, `titles-service` (live-first write-through, offline `fromCache`),
`app-services`, `routes/library` (`POST /api/library/refresh`), `lib/library-query` (`titleOffset` cursor), constants, `types/library`;
delete `title-session.ts`; tests: titles-sync (3-page walk with genre decode, sweep, failure mid-walk, dictionary failure,
non-advancing cursor, single flight), library-cache (five sorts, filters, exact paging and total, locals first, facets, offline,
**search is cache-only: zero backend requests**, history/favorites/collection make zero backend calls), detail write-through,
off-catalog rows spared by the sweep. **W4 frontend:** remove the status words/dots, `refreshLibrary`, `useLibraryData`,
`fromCache`, `titlesReadAt`, the Play reason wording. **W5 coordinator:** gate, `npm run dist:win`, real-stack acceptance.

**Acceptance on the real stack:** cold boot (empty tables after migration 006): the first channel read returns the 2,600+ channels
after one sync and the first Library read after the catalog walk (about 22 requests): time both. Second launch: both read in under
50 ms from cache, no backend request in the backend's log. Backend-down and the 6-hour case run as tests against the real backend
child process with the injected clock (not on the owner's live data; never change `adminUrl` on the real stack). Exactly one
background refresh at a 6-hour-old page load: asserted by counting backend requests. No timers: the new rule plus a grep. The gate
passes including the live smoke.

## H. Risks and what is not built

Risks: the Library is the synced catalog (decision 1); the backend and fileserver must ship together (an older backend without
`/api/titles/catalog` fails the titles sync with `backend.bad_response`; no fallback code); offset paging under change (a repeat or
skip if a sync lands between pages); details are one live read per open (the old 100-entry map is gone); downgrade is refused
(`store.newer_schema`). Not built: any timer, scheduler, retry loop or heartbeat; image prefetch; episode/season/recommendations
cache; FTS; delta/ETag sync; encryption of anything; any desktop stream probe; status words; a statusbar job or "refreshing"
indicator; a push to the page when a refresh lands; a setting for the 6-hour window; a cache-size setting or "clear cache" button; a
multi-backend cache; pruning of off-catalog rows.

## I. Open questions

None.
