# 47 - Backend titles: the sync fills the store, reads serve what is stored; Browse TMDB is its own admin route (plan)

**Status: APPROVED by the owner 2026-10-18 (messages: "the backend should not have any fill through, it serves what it has and
syncs through the discovery"; "the discovery should sync the details for the full db"; "browse TMDB ... sounds like a different
feature than a pass thru lookup").** Extends `44` (the Library fill) and `46` (the fileserver cache). Docs first (`07`). Scope: the
admin backend and, for Browse TMDB, the admin app.

## 1. Why (verified 2026-10-18)

- The Library fill (`discover` walk) stores **list rows only**: in the owner's database 5,534 movies and 5,389 series are stored and
  only 31 have full detail. A title's plot, cast, runtime, IMDb id and season counts are fetched the first time it is opened
  (`title-reads.ts` `detail()`), and episode lists per season on demand (`seasons()`), recommendations from TMDB on demand
  (`recommendations()`): the **fill-through on the read path**.
- Reads that quietly call TMDB are surprising and unbounded (rate pacing, cost, offline behaviour). The fileserver now caches a
  snapshot of the whole store (`46`), so the store itself must be complete: the **sync** pulls everything in; **reads serve what
  is stored**.

## 2. Decisions

1. **Two different features, separated.** (a) *Pass-through lookup* (a read that calls TMDB as a side effect and stores the answer)
   is REMOVED from every public read. (b) **Browse TMDB** is a deliberate admin tool (the Titles tab's `Stored | Browse TMDB` view:
   find titles TMDB has that are not stored yet): it stays, as its own **admin-only** TMDB route that reads TMDB, shows TMDB's
   answer and **writes nothing**. Adding a title from it is an explicit action.
2. **The Library fill syncs titles, details AND season/episode info in the one discovery job** (owner, 2026-10-18: "no need to
   split the same sync work out across phases"): discover walk -> `details` -> `episodes`, all in this wave.
3. **Recommendations are computed from the store**, not asked of TMDB.

## 3. Backend

### 3.1 Library fill phases (`title-sync.ts`, `44` 3.1)

`discover` walk (as today) -> **`details`** -> **`episodes`** (one job, one run, one progress bar).
- **`details`:** every stored title whose payload is `shape: "list"` (and, on later runs, a `detail` older than `TITLE_FRESH_MS`),
  not deleted and not disabled, ordered by popularity DESC then id, gets ONE detail call (`/movie/{id}` or `/tv/{id}` with
  `append_to_response=credits,external_ids`, the existing `detailOf` mapping) written as the title's detail payload (edited fields
  of a manual-edited title are never overwritten, as today). **No OMDb call** in the sync (its 1,000-a-day budget stays for
  on-demand enrichment by an admin action, if kept; the plan does not depend on OMDb). Progress phase `details` with `done/total`
  (total = the titles still needing detail when the phase starts); weights (fixed, so the bar never goes backwards): `movies`/`tv` walk
  0-10%, `details` 10-100% (the admin copies the weights from the backend, `44` 3.1). Counts: `{ titles, detailed, seasons,
  stale }`.
- **Series episodes ride the same call (owner, 2026-10-18: "is there a way to get it in a single call?"):** a series' detail
  request is `/tv/{id}?append_to_response=credits,external_ids,season/1,season/2,...` (TMDB allows up to 20 appended items per
  request; season 0 specials skipped), so ONE call returns the detail AND the episodes of up to the first 18 non-special seasons
  (credits and external_ids take two of the 20 slots). A series with more seasons gets follow-up calls of up to 20 `season/N` appends
  each (`/tv/{id}?append_to_response=season/19,season/20,...`). Each season's episodes are written into the title's payload
  (`seasons[n].episodes`, the existing episode mapping of `title-reads.seasons()`) in the same short transaction as the detail.
  There is no separate `episodes` phase: `details` covers movies (one call) and series (one to a few calls); a stored series whose
  detail is fresh but some seasons have no stored episodes (a season added upstream) is picked up by the same query and gets only the
  missing `season/N` appends. Progress counts calls' worth of titles (`done/total` titles), not seasons.
- **Pace (named constant, not a literal):** `TMDB_REQUESTS_PER_SECOND` = 20 in constants/limits.ts (TMDB's documented ceiling is about
  40 a second and there is no published daily quota; the previous pacing was about 5 a second). The existing 429 backoff stays and
  lowers the pace for the rest of the run after a 429. About 11,900 calls for the owner's library (1,000 discover pages, 5,534
  movie details, 5,389 series details with seasons): about 10 minutes at 20 a second; later runs fetch only new or stale titles.
- **Resumable:** Stop then Run again continues with the titles still list-only (the query, not a cursor). A run that fails keeps
  what was written. Per-title failures (a TMDB 404 for a removed title) mark that title `detail_failed_at` and continue; a title
  failing 3 runs in a row is skipped until its payload changes. A `429`/5xx uses the client's bounded backoff.
- **Pace:** the TMDB client's existing pacing (about 5/s): 10,923 titles take about 35 minutes the first time; later runs only
  fetch new or stale titles. Each title is written in its own short transaction (progress and Stop are responsive).

### 3.2 Public reads become store-only (`title-reads.ts`, `title-service.ts`, `api/titles.ts`)

- `GET /api/titles/:titleId` returns the stored payload (list or detail shape); `404 title.not_found` when it is not stored. It
  never calls TMDB and never writes.
- `GET /api/titles/:titleId/seasons/:season` returns the stored episodes of that season (`{ episodes: [] }` only for a season the
  sync has not reached yet; the season counts come from the detail).
- `GET /api/titles/:titleId/recommendations` is computed from the store: same kind, at least one shared genre, popularity DESC,
  excluding the title itself, top 12.
- `GET /api/titles/genres?kind=` returns the stored genre dictionary (kept in the store by the sync from TMDB's `/genre/{kind}/list`
  once per Library fill run; seeded on first run).
- **The public browse and search routes are deleted:** `GET /api/titles` (browse) and `GET /api/titles/search`. Their only consumers
  were the fileserver (which now serves the Library and search from its cache, `46`) and the admin's Browse TMDB view (which moves to
  3.3). `GET /api/titles/catalog` (`46` D.1) is the public list for sync.
- No public title read writes to the store or calls TMDB; the `title-sync.ts` jobs and the admin routes below are the only TMDB
  callers.

### 3.3 Browse TMDB: admin-only routes (no store writes)

`GET /api/admin/tmdb/titles` (browse: `kind`, `sort`, `genre`, `year`, `page`; the answer shape the admin's Browse list already
reads) and `GET /api/admin/tmdb/search` (`kind`, `q`, `page`): signed in, `Cache-Control: no-store`, audited as reads are not; they
call TMDB through the existing client (pacing/backoff/merge), map rows with `rowOf`, **write nothing to the store**, and mark each
row with `stored: true|false` (is the id already in the store, deleted included: `deleted`) so the admin can show state. TMDB
unavailable: `503 tmdb.unavailable`. Adding a title stays an explicit action (the admin's existing add flow; the worker reads it and
keeps it, using an explicit write route, e.g. `POST /api/titles/from-tmdb { id }` that fetches that one title's detail and stores
it, if no such route exists yet).

### 3.4 Migration and removals

No schema change except an optional `detail_failed_at`/`detail_failures` pair on `titles` (migration `026`, nullable columns) for
the details phase bookkeeping. Delete the fill-through code paths (`title-reads` TMDB branches used only by public reads) and their
tests; keep the TMDB client, `detailOf`, `rowOf`, `storeRow`.

## 4. Admin app

`Browse TMDB` calls `/api/admin/tmdb/titles` and `/api/admin/tmdb/search` (services/titles.ts and the Browse slice/flows), shows a
`stored`/`deleted` state word per row (a dimmed row is already stored), and its add action is the explicit one. The Jobs row/last-run
words learn `detailed` and the `details` phase (`44` 4 tooltip: `Fetching details 1,204 of 10,923`; the progress fraction weights are
copied from the backend answer). Nothing else in the admin changes.

## 5. Docs to update

`03` 7.4 (the routes: store-only reads, the admin TMDB routes, the removed browse/search, the details phase), 7.6/7.6b (the sync
phases; fill-through removed), `11` (TMDB use), `44` 3.1 (phases and weights), `37`/`41` (Browse TMDB uses the admin routes), `06`
(the desktop never needs live TMDB).

## 6. Waves

| Wave | Scope |
|---|---|
| **B1 backend** | the details phase and counts/progress; public reads store-only; recommendations from the store; stored genre dictionary; the admin TMDB routes; deletion of public browse/search; migration `026` (if used); tests (fake TMDB that fails the test on any call from a public read; details phase: resumable, Stop, per-title failure, edited title untouched, ordering by popularity, progress monotonic; admin TMDB routes write nothing; recommendations; 404 for a title not stored) |
| **A1 admin** | Browse TMDB on the new routes, the `stored`/`deleted` word, the details words |
| *(B2 folded into B1, owner 2026-10-18)* | the `episodes` phase is part of B1 |

Acceptance: a public `GET /api/titles/:id` of a stored list-only title returns after one Library fill without any TMDB call;
`Browse TMDB` still pages TMDB and writes nothing (the store row count is unchanged); the Library fill shows `details` progress and
Stop/Run continues; the fileserver sync (`46`) is unaffected.

## 7. Not built

OMDb enrichment inside the sync; a detail refresh scheduler other than the Library fill job; a TMDB webhook.
