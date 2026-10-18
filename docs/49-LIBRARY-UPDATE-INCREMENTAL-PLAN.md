# 49 - The Library update: an incremental sync of the latest titles, changes and gaps (plan v2)

**Status: v2 after the independent plan review (2026-10-18); awaiting delegation.** Owner: "it doesnt need to delete, but there needs to be an
incremental type that only syncs the latest titles and gaps once the data is at rest. trending and popular is not the same as 'all recent';
is there a filter for that?". Extends `48` (the Library fill) and `47` (the details phase). Docs first (`07`). Scope: the admin backend and the
admin's Jobs words and New job form.

## 1. Why (observed against TMDB live, 2026-10-18)

- A repeat **Library fill** re-walks every year slice (about 2,300 calls, 2 to 3 minutes) to find a handful of new titles, and its details
  phase re-fetches every title older than 3 days (a rolling third of the library a day). After the first fill the data is at rest and a
  cheaper job is wanted.
- **Trending and popular** are ranked lists of what people watch now: they miss a quiet new release.
- **There IS a filter for recent:** `GET /discover/{kind}` takes `primary_release_date.gte/.lte` (movies) and `first_air_date.gte/.lte`
  (series), which `title-slices.ts` `sliceParams` already builds. With the vote floor (`DISCOVER_MIN_VOTES` 50) the last 30 days hold 22 movies
  and 7 series; the last 7 days 2 and 3. A title joins the library when it reaches the floor (one definition of "the library" everywhere).
- **TMDB publishes what changed:** `GET /{movie|tv}/changes?start_date&end_date` lists the ids edited in a window (100 a page; a window may
  not exceed 14 days, `422 Invalid date range`). One day, measured against the owner's store: **8,700 movie ids (1,963 stored = 22.6%) and
  3,729 series ids (550 stored = 14.7%)**: about 2,500 stored titles a day, 133 list calls. It carries no votes, so it cannot find new titles;
  it is how a STORED title's detail (a new season or episode, a plot, a poster) is kept current without blindly re-fetching.

## 2. Decisions

1. **A new catalog job scope `recent`, named `Library update`**, a second catalog job beside `Library fill` (the fill stays the full pass for
   the first fill and an occasional resync; `POST /api/titles/sync` stays the fill). New job's Scope gains `Recent` (Kind hidden, Pages
   hidden). The job's config for `recent` stores `pages: 1` (a harmless constant, ignored): `pages` stays required in the four schemas that
   require it today (`types/job.ts`, `store/job-repository.ts` `CatalogConfig`, `job-service.ts`, the admin job schema), so no stored job can
   fail to parse and break the Jobs list.
2. **Phases, one run, one bar** (new phase names; `details` keeps meaning the fill's phase):
   - `recent` (0-10%): per kind the discover query with `sliceParams`-style date filters `gte = today - RECENT_DAYS`, `lte = today`, the vote
     floor, ALL pages (stops on an empty page like the walk); rows upsert by id exactly as the fill's walk (`storeRow`: a fresh payload stands,
     a stale detail keeps its shape, the new titles come in list-shaped). `done/total` = pages across both kinds, the total grown as each
     kind's page 1 answers and never lowered.
   - `changes` (10-20%): per kind, `/{kind}/changes` for `[start, today]`, `start` = max(`cursor`, `today - CHANGES_MAX_WINDOW_DAYS + 1`)
     (13 whole days back plus today, so the window never reaches TMDB's 14-day limit; verify the boundary on the fake and live), all pages.
     The ids already in the store (enabled, `origin = 'tmdb'`, not deleted) are kept by ONE set-based query under `store/`
     (`json_each(?)`, never an `IN (...)` list); a never-run job uses the clamped window and the run's note says a Library fill covers more.
     `done/total` = changes pages, the total from page 1.
   - `refresh` (20-100%): the details work of this run: **the recent queue** = list-shaped titles, titles with no detail or a season with no
     episodes (the true gaps), and the changed ids FORCED (a fresh detail is fetched anyway: `fetchDetail` takes `force`, `pendingDetails`
     takes the changed-id set bound as one `json_each(?)` parameter, an empty set widens nothing, a forced id counts against
     `detail_failures` like any fetch). The recent queue has NO `fetched_at < staleBefore` and NO `episodesAt < staleBefore` clause: staleness
     is replaced by `changes`, which is the point of this job. OMDb gap filling (`11` 7.3) runs as in the fill (it already needs a gap and an
     unmet freshness window, so it stays small). Popularity order, one short transaction a title, Stop between titles.
3. **`RECENT_DAYS` = 90** and **`CHANGES_MAX_WINDOW_DAYS` = 14**, `CHANGES_PAGE_SIZE` = 100 (assumed), named in `constants/limits.ts`. A title
   released a month ago that only now reaches 50 votes is caught while the window is walked daily; older late bloomers are the full fill's.
   A brand-new title under the floor is not stored by the update; a later daily discover inside its 90 days stores it once it passes.
4. **A cursor, not `last_run_at`.** `last_run_at` is the END time of any run, stopped and failed included (`job-repository.ts` `recordRun`), and
   the scheduler uses it, so it cannot anchor the changes window. Migration `028` adds `sync_jobs.cursor_at` (nullable integer); an `ok` run
   of a `recent` job writes `cursor_at` = the run's START time minus `CURSOR_OVERLAP_MS` (1 hour); a stopped or failed run leaves it, so the
   next run covers the same window again (every write is an upsert; the forced refresh is repeated, not lost). `last_run_at` keeps its meaning
   and the scheduler is untouched.
5. **Gaps** are the recent queue's second clause; there is no separate gap job. A gap healed by the update stays healed.
6. **Cost at rest** (measured): about 5 discover calls + about 133 `changes` calls + the forced refresh of about 2,500 stored titles that
   changed that day (about 3,000 calls with series seasons) at `TMDB_REQUESTS_PER_SECOND` 20: **about 3 to 4 minutes a day**, nothing else.
   A window after an N-day gap costs about N times the changes calls, bounded by 14 days (about 1,900 calls, the cost of a fill walk) and the
   refresh is only the distinct stored ids changed in it. The second of two runs in a row starts at the first's cursor, so it finds almost no
   changed ids and finishes in seconds.
7. **Seeding** (the review's catch: a fresh database runs migrations before the seed): migration `028` adds the cursor column AND inserts the
   job with the exact guard of `025` (`WHERE EXISTS (SELECT 1 FROM sync_seed)`, `json_valid` and `CASE` guards) so an existing database gets
   `Library update` once, enabled, schedule `24h` (a literal: `TMDB_SYNC_SCHEDULE` governs the fill only) and a deletion by the admin sticks
   (the migration runs once); a fresh database gets it from `sync-seed.ts` (a second `insertCatalog` in the same transaction as the fill,
   its doc comment updated). Tests prove exactly one update job on both paths.
8. **One catalog run at a time** (existing: `isSyncRunning`, `busy`): the scheduler retries every second behind a running fill; a manual Run
   during another catalog run answers `409 sync.busy` and the Jobs row says so (the Run job reason). A manual run ignores `Enabled`
   (`26` 3.11); the scheduler needs the TMDB token.

## 3. Changes (backend unless noted)

- `types/job.ts`, `store/job-repository.ts`, `job-service.ts`, `job-runner.ts` (`pagesOf` and the request builder copy `kind`/`pages` only for
  the scopes that have them), `title-shapes.ts` `SyncRequest` (the `recent` scope; `title-shapes.ts` is at the size limit: put the type in a new
  small file), `types/job-counts.ts` (`changed`, default 0), `title-run.ts` `Seen`, `title-sync.ts` `SyncResult`/audit (`changed`).
- New `services/title-recent.ts` (recent phase), `services/title-changes.ts` (changes phase and the stored-id query call), the recent queue in a
  new `store/` file (`title-details.ts` is near the cap), `title-details-phase.ts` takes the queue mode and passes `force`;
  `title-detail-fetch.ts` honours `force`. `title-sync.ts` dispatches by scope (no growth: extract; the recent run also syncs genres,
  cheap). `title-walk.ts` `firstPhase` returns `recent` for the scope (`job-runner.ts` uses it).
- `job-progress.ts` and the admin's duplicate `lib/job-fraction.ts`: phases `recent` 0-10, `changes` 10-20, `refresh` 20-100 (the fill's phase
  weights unchanged); `title-sync-request.ts` describes `recent` for the audit.
- `constants/limits.ts`: `RECENT_DAYS`, `CHANGES_MAX_WINDOW_DAYS`, `CHANGES_PAGE_SIZE`, `CURSOR_OVERLAP_MS`.
- Migration `028-library-update.sql` (cursor column, the guarded job row).
- Admin: `CatalogRows.tsx` Scope `Recent` (hide Kind and Pages for it), `job-body.ts` (`createBody`, `configChanges`), `job-draft.ts`, the
  job target word `recent`, `lib/progress-words.ts` (`Reading recent titles N of M pages`, `Reading changes N of M pages`, `Refreshing 12 of
  40`), `lib/run-words.ts` (`changed`: `Synced: 4 titles, 11 changed, 15 details.`), `job-schema.ts` (scope, counts), the scope tip in its copy file.
- Docs (coordinator): `03` 7.6b and 7.2c (counts with `changed`), `26` 3.11 (the job list), `43` 3.1 (scope enum, the cursor), `44` 3.1
  (phases/weights), `47` 3.1, `11` (the date filters and `/changes`, which `11` does not list today).

## 4. Tests (backend, fake TMDB)

- The fake serves discover with date filters, `/changes` with the 14-day limit (`422` beyond it) and 100 ids a page: the recent phase requests
  exactly the window and the floor and stores the fake's rows; the changes phase requests `[start, today]` clamped to 13 days back, keeps only
  stored, enabled, tmdb-origin, not-deleted ids (one set-based query) and forces exactly those; a forced fresh title is really re-fetched
  by the fake; an empty changed set does not widen the queue; the recent queue has no staleness clause (a 10-day-old unchanged detail is not
  fetched; a list-shaped title and an episode-less season are).
- Cursor: written only by an `ok` run (start minus the overlap); a stopped and a failed run leave it; a longer-than-14-day gap is clamped
  and noted; a second run right after finds almost no changed ids.
- A `recent` job's config round-trips through `toJob` (the Jobs list still loads with one present); the config schema accepts `recent` and
  ignores `pages`; progress is monotonic across the three phases; a manual run during a fill is `409 sync.busy`; migration 028 on a fresh
  database plus the seed yields exactly one update job, and on an existing one inserts once and not again after the admin deletes it.

## 5. Acceptance on the real stack

After the first full fill: run `Library update` twice. The first adds the recent titles (compare with TMDB's last 90 days at the floor) and
refreshes the stored titles that changed in the window (a stored series with a newly added episode gets it); it takes minutes. The second
finishes in seconds and changes only popularity and timestamps.

## 6. Not built

Deleting titles TMDB dropped; TMDB's daily id export files; a window beyond 14 days (the Library fill covers it); changes to trending and popular.
