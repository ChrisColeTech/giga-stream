# 48 - The Library fill discovers everything TMDB offers above a vote floor: a sliced discover walk (plan v2)

**Status: v2 after the independent plan review (2026-10-18); awaiting delegation.** Owner: "the discover should continue until we
have them all, not just 20 x 500". Extends `47` 3.1 (the walk) and `44` 3.1 (phases and weights). Docs first (`07`). Scope: the
admin backend (the walk, constants, the job's request) and one admin copy line.

## 1. Why (observed against TMDB live, 2026-10-18; re-check before building, see section 7)

- One `GET /discover/{kind}` query stops at **page 500** (`400 Invalid page: Pages start at 1 and max at 500`), 20 rows a page:
  10,000 rows per kind per query. `total_results` reports at most 20,001. The walk is one query per kind, so it can never store
  more than 20,000 titles; the owner's store holds 5,534 movies and 5,389 series (earlier runs stopped early).
- The interface's "27,000" is TMDB's Browse total for `vote_count.gte=50` (movies at the 20,001 cap plus 7,021 series): what TMDB
  has, not what is stored.
- **Slicing by year gets past the cap.** With `vote_count.gte=50` and one slice per year (`primary_release_year` for movies,
  `first_air_date_year` for series) the totals are **36,756 movies and 7,015 series = 43,771 titles**, and no single year exceeds
  10,000. Without a vote floor TMDB holds well over 500,000 movies: "all" needs a floor.

## 2. Decisions

1. **Slice the discover walk, per kind.** Slices: one open slice for everything before 1900, one slice per year 1900 to next
   calendar year (the clock is injected into the walk), and one open slice for later dates. Open slices use the date-range
   parameters (`primary_release_date.lte`/`.gte`, `first_air_date.lte`/`.gte`), year slices use the year parameters. Each slice is
   a popularity-sorted discover query with the vote floor.
2. **A slice is over the limit when its page-1 answer has `total_pages` above 500** (`MAX_DISCOVER_PAGES`; 500 pages x 20 rows is the
   10,000 TMDB serves; exactly 500 pages fits). Such a slice is split into two date ranges `[a, mid]` and `[mid + 1 day, b]`
   (both bounds are inclusive, so the halves do not overlap) and each half is probed in turn, recursively. A single day still above
   the limit is walked to page 500 and the walk notes it in the run's detail; it never loops. (Today no year needs a split; the
   split keeps the walk correct as TMDB grows.) Assumption to verify: TMDB's primary release date agrees with the year filter.
3. **Vote floor `DISCOVER_MIN_VOTES` = 50**, a named constant in `constants/limits.ts` (not in the job's config: the strict job
   config schema, the job form and the stored configs would all change for a number nobody sets per job). It matches the Browse
   default and gives about 44,000 titles. It is the one number the owner may want to move.
4. **`pages` stops meaning anything for `discover`.** The Library fill walks every slice to the end; the per-slice cap is TMDB's 500.
   The job's `pages` stays accepted and stored (the seeded job carries 500) and still caps the trending/popular scopes. The admin's
   `PAGES_TIP` is reworded to say it applies to those scopes. No migration.
5. **Titles with no date are not discovered** (a date filter excludes them); one already stored stays. Titles dated after next
   year are covered by the open later slice; before 1900 by the open earlier slice. The walk never deletes anything.
6. **Progress stays per kind, exact per kind.** `job-progress.ts` keeps `movies` 0-5% and `tv` 5-10% (`done/total` of the kind).
   At the start of each kind's phase the walk PROBES: page 1 of every slice of that kind (about 128 year slices + 2 open slices,
   plus the probes of any split halves). It first reports `done 0, total 0` (the lower bound), then ONE real report with the
   kind's total (the sum of the slices' `total_pages`, about 1,900 movie pages and about 400 series pages), then walks. The total
   is never lowered afterwards (a lower total would make the fraction drop and `job-progress.ts` ignores a lower fraction). The
   probe's page-1 answers are kept (20 rows each) and written as the walk reaches them, so page 1 is not fetched twice. No new
   phase, no new weight, no new words: the existing `Walking movies N of T pages` and `Walking series ...` stay true. After the
   walk the bar sits at 10% (about 2 minutes in) while the details phase takes the other 90%.
7. **Counts keep their shape** `{ titles, detailed, seasons, enriched, stale }`. `titles` counts rows seen by the walk (a title
   that appears in two slices at an edge is counted twice; the upsert makes it harmless). No `slices` count.
8. **Idempotence, stated precisely.** Every write is an upsert by id (`title-store-row.ts`): a payload fresher than 3 days stands
   whole; a stale `detail` payload keeps its shape and refreshes rating and images; a stale list payload is replaced by the thin
   row; admin edits live in `edited_fields` and the upsert never touches them. A second run therefore keeps the same set of ids
   and loses no detail or edit; `fetchedAt` and the popularity score may be rewritten, so "no row changes" is NOT the claim.
9. **Stop and resume.** There is no checkpoint: Run after Stop walks (and probes) again, about 2 to 3 minutes of calls, and the
   upserts make it safe. A Stop during the probe stores nothing.
10. **Cost.** About 2,300 to 2,400 walk pages plus 260 probe calls at `TMDB_REQUESTS_PER_SECOND` 20: about 2 to 3 minutes. The
    details phase grows to about 44,000 titles and about 51,000 calls (series add season appends): about 45 minutes the first time,
    then only new or stale titles. A 429 lowers the pace for the rest of the run (down to 2 a second at the floor), which stretches
    the estimates; the run still completes. OMDb enrichment stays at 1,000 titles a day, so `enriched` stays at about 1,000 per run
    and the backlog drains over weeks; it never blocks the fill.

## 3. Changes (backend unless noted)

- `constants/limits.ts`: `DISCOVER_MIN_VOTES` 50, `DISCOVER_FIRST_YEAR` 1900, `DISCOVER_PAGE_SIZE` 20 (TMDB's page size, assumed).
  `title-shapes.ts` is at the file-size limit: do not add to it.
- New `services/title-slices.ts`: slice list for a kind and clock, the probe, the split. `services/title-walk.ts` walks the kept
  answers. `createTitleWalk` gets `now` from `createTitleSync`. `title-sync.ts` is already over its comfortable size: no growth.
- `title-walk.ts` discover branch: per kind, probe then walk (decision 6); `pages` ignored for `discover`. `describeRequest`
  (audit detail) says the sliced walk.
- Admin: `PAGES_TIP` copy in `constants/job-copy.ts` only.
- Docs (coordinator): `03` 7.6b (the walk), `44` 3.1, `47` 3.1/6, `11` (page 500, the year and date-range filters, the 20,001
  cap), `06` Jobs words unchanged.

## 4. Tests (backend, fake TMDB)

- The fake enforces `page <= 500`, 20 rows a page, inclusive date bounds, and serves a few years plus one slice over 10,000: the
  walk never requests page 501, stores every distinct id of the fake's ground truth exactly once (the id set equals the fake's),
  and the progress `total` for the kind equals the sum of probed `total_pages`.
- A split slice: halves are inclusive and overlap-free; a boundary day lands in one half; a single day above the limit walks to
  500 and stops.
- Open slices (before 1900, after next year) are walked; a title with no date is not requested.
- Re-run: same id set; a detailed title keeps its detail shape; an edited field survives.
- Stop during the probe stores nothing; Stop mid-walk then Run completes with the full id set; a 429 mid-probe leaves a
  consistent total; progress is monotonic and ends at the kind's weight; `pages` does not change a discover walk.

## 5. Acceptance on the real stack

Run the Library fill twice. After the first, compare stored counts per kind with TMDB's per-year totals at `vote_count.gte=50`
(about 36,756 movies, 7,015 series) within the edge double-counts; the second run keeps the same id set. The details phase then
completes (about 45 minutes), `Last run` reads the typed counts.

## 6. Not built

A walk with no vote floor; per-genre slicing; removing titles TMDB dropped; a walk checkpoint; a vote floor in the job form.

## 7. Verifying the numbers (before code)

The figures in section 1 came from read-only calls with the backend's TMDB token (page 501 answers 400; `total_results` 20,001;
per-year totals at `vote_count.gte=50`). The worker re-runs them first with a throwaway script outside the repository (never
printing the token) and reports any figure that has moved, plus whether the date-range parameters agree with the year parameters.
