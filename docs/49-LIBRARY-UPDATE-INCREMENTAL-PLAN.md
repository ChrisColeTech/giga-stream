# 49 - The Library update: an incremental sync of the latest titles, newly aired series and gaps (plan v3)

> **Amended 2026-10-19 (`56`, owner).** Recent runs both kinds and exposes neither Kind nor Pages; normalized config
> stores no meaningful stale Kind/Pages. The UI's shared New/Edit job fields follow this rule.

**Status: v3 (2026-10-18). Supersedes v2's `/changes` refresh.** Owner: "it doesnt need to delete, but there needs to be an incremental
type that only syncs the latest titles and gaps once the data is at rest. trending and popular is not the same as 'all recent'; is there a
filter for that?" and, on v2: "im not sure if calling for 59000 description changes are worth the api hits. if the description is not
missing, i dont know why we would be filling that gap. youre adding a lot of complexity just for extra updates on fields we already got in
the fill, is there a use case where it is absolutely needed". Extends `48` (the Library fill) and `47` (the details phase). Docs first
(`07`). Scope: the admin backend and the admin's Jobs words and New job form.

## 1. Why (observed against TMDB live, 2026-10-18)

- A repeat **Library fill** re-walks every year slice (about 2,300 calls, 2 to 3 minutes) to find a handful of new titles, and its details
  phase re-fetches every title older than 3 days. After the first fill the data is at rest and a cheaper job is wanted.
- **Trending and popular** are ranked lists of what people watch now: they miss a quiet new release.
- **There IS a filter for recent:** `GET /discover/{kind}` takes `primary_release_date.gte/.lte` (movies) and `first_air_date.gte/.lte`
  (series), which `title-slices.ts` `sliceParams` already builds. With the vote floor (`DISCOVER_MIN_VOTES` 50) the last 30 days hold 22 movies
  and 7 series. A title joins the library when it reaches the floor (one definition of "the library" everywhere).
- **The only edit that matters after the fill is a new episode or season on a series we store.** TMDB's `/{kind}/changes` list is NOT the
  tool: it reports every edit of every title (about 8,700 movies and 3,700 series a day, of which about 2,500 are ours, almost all
  translations, images and credits we already have) and would cost about 2,500 detail calls a day for nothing the interface shows.
  The cheap, exact signal is **`GET /discover/tv?air_date.gte=&air_date.lte=`** (series with an EPISODE airing in a window) with the
  floor: measured, **29 series in the last day (2 calls, all 29 stored), 150 in 7 days (8 calls), 216 in 30 days (11 calls)**. A movie has
  no episodes: nothing about a stored movie needs a daily refresh; its detail stays as the fill stored it.

## 2. Decisions

1. **A new catalog job scope `recent`, named `Library update`** (a second catalog job beside `Library fill`; the fill stays the full pass
   for the first fill and an occasional resync; `POST /api/titles/sync` stays the fill). New job's Scope gains `Recent` (Kind and Pages
   hidden; the job stores `pages: 1`, ignored, so the four schemas that require `pages` keep parsing).
2. **Phases, one run, one bar:**
   - `recent` (0-10%): per kind the discover query with `sliceParams` date filters `gte = today - RECENT_DAYS` (90), `lte = today`, the vote
     floor, ALL pages (stops on an empty page); rows upsert by id as the fill's walk (`storeRow`): new titles come in list-shaped, a detailed
     title keeps its detail. Page 1 of both kinds is read first so the progress total is known and never lowered. (Built.)
   - `airing` (10-20%): series only, `GET /discover/tv?air_date.gte=<start>&air_date.lte=<today>&vote_count.gte=50&sort_by=popularity.desc`,
     ALL pages. `start` = max(`cursor`, `today - AIRING_MAX_DAYS`) with `AIRING_MAX_DAYS` = 60 and a cursor-less run using
     `AIRING_FIRST_DAYS` = 14. Every row upserts by id (a series not stored yet enters list-shaped); the ids of the series that are ALREADY stored
     (enabled, `origin = 'tmdb'`, not deleted: the existing set-based `storedAmong`) are the run's **forced** set. `done/total` = pages,
     total from page 1, never lowered. There is no 14-day limit and no 500-page problem (a window holds hundreds, not tens of thousands).
   - `refresh` (20-100%): the details work of this run: the recent queue = list-shaped titles (the new ones), titles with no detail or a
     season with no episodes (the true gaps), the OMDb gap rule (`11` 7.3, as built), and the forced airing series (`fetchDetail`
     with `force`, as built). NO age clause (staleness is not a rule here). Popularity order, one short transaction a title, Stop
     between titles.
3. **Constants** in `constants/limits.ts`: `RECENT_DAYS` 90, `AIRING_FIRST_DAYS` 14, `AIRING_MAX_DAYS` 60, `CURSOR_OVERLAP_MS` 1 hour
   (kept). `CHANGES_*` constants and the `changes` phase are DELETED.
4. **The cursor stays** (migration `028`, as built): `sync_jobs.cursor_at`, written only by an `ok` run to the run's start minus the
   overlap; a stopped or failed run leaves it (the next run covers the same window again, every write is an upsert). It anchors the
   `airing` window. `last_run_at` keeps its meaning and the scheduler is untouched.
5. **Gaps** are the refresh queue's second clause; there is no separate gap job.
6. **Cost at rest** (measured): about 5 discover calls for recent + about 2 for airing + the details of the roughly 30 stored series that
   aired an episode + any new or gapped titles: **seconds a day**. A window after an N-day gap costs about 2 calls per day of the gap
   (8 for a week, 11 for 30 days). The second of two runs in a row finds almost nothing.
7. **Seeding** (as built): migration `028` adds the cursor column and the guarded job row (`025`'s `sync_seed` guard) for an existing
   database; a fresh database gets it from `sync-seed.ts`; an admin's deletion sticks.
8. **One catalog run at a time** (existing): the scheduler retries behind a running fill; a manual Run during another catalog run is
   `409 sync.busy`; a manual run ignores `Enabled`.

## 3. Changes from what is merged (v2 built the `changes` phase)

- DELETE `services/title-changes.ts`, its tests and the `changes` phase from `title-update.ts` / `title-sync.ts`; DELETE the
  `CHANGES_*` constants and the `changes` weight in `job-progress.ts` and the admin's `lib/job-fraction.ts`, and its words in
  `lib/progress-words.ts`.
- New `services/title-airing.ts` (the `airing` phase, series only, as above); `title-update.ts` runs `recent` -> `airing` -> `refresh`;
  `run.seen.changed` counts the forced airing series (the counts key `changed` is renamed `airing`: `Synced: 4 titles, 29 airing, 31
  details.`; backend `types/job-counts.ts` default 0, the admin schema and `run-words.ts`). Phase weights: `recent` 0-10, `airing` 10-20,
  `refresh` 20-100 (the `changes` slot becomes `airing`).
- Keep: migration `028`, the cursor, `recent`, `storedAmong`, the forced refresh queue, the seeding, the New job `Recent` scope.
- Docs (coordinator): `03` 7.6b / 7.2c, `26` 3.11, `43` 3.1, `44` 3.1, `47` 3.1, `11` (the date filters and `air_date`, the cap on
  `/changes` as not used).

## 4. Tests (backend, fake TMDB)

- The fake serves discover with date filters and the `air_date` filter: `airing` requests exactly `[start, today]` with the floor, series
  only, all pages; stored series in it are forced (a fresh stored detail is really re-fetched); a series not stored is stored list-shaped and
  then detailed; movies are never forced; a deleted, disabled or manual title is never refreshed.
- Cursor: written only by an `ok` run (start minus the overlap); a stopped and a failed run leave it; no cursor uses 14 days; an old
  cursor is clamped to 60 days with a note.
- The recent queue has no staleness clause (a 10-day-old unchanged detail is not fetched; a list-shaped title and an episode-less season are);
  a second run right after finds almost nothing; progress monotonic across the three phases; the config round trip and the migration tests
  as built; no `changes` route is ever requested.

## 5. Acceptance on the real stack

After the first full fill: run `Library update` twice. The first adds the recent titles (compare with TMDB's last 90 days at the floor) and
refreshes the stored series that aired an episode in the window; it takes seconds to a minute. The second finishes in seconds and changes
only popularity and timestamps.

## 6. Not built

Deleting titles TMDB dropped; TMDB's `/changes` lists and daily id export files; refreshing stored movies after the fill (the Library
fill covers them); changes to trending and popular.
