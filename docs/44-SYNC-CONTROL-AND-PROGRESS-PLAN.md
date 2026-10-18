# 44 - Sync control and progress: Stop for every sync, real progress, a working Library fill (plan)

**Status: APPROVED by the owner 2026-10-18 (request: "the stop button in the status bar should stop the sync, and the
progress bar should actually update real progress. sync discovery should also work as expected").** Extends `43`
(playlist sync) and `26` 3.11 (jobs). Docs before code (`07`). Scope: the admin backend and the admin app only.

## 1. What is wrong today (verified 2026-10-18 on the owner's database)

1. **There is no Library fill job.** The owner's `sync_jobs` holds the four per-slice catalog jobs (trending and popular,
   movies and series; `schedule` off) and the playlist job. The per-slice jobs were retired by the owner on 2026-10-17
   (`26` 3.11: "no longer seeded, existing records deleted") but the deletion never ran on this database, and the
   first-start seed (`sync-seed.ts`) had already been marked done, so the replacement - the **Library fill**, scope
   `discover`, which walks both kinds by popularity - was never created. The Jobs tab therefore has nothing that fills the
   library. (The 10,923 stored titles came from earlier manual runs.)
2. **Stop does nothing.** The statusbar `Stop` is disabled (`A sync cannot be cancelled.`, `record-copy.ts` `STOP_SYNC`,
   `running-work.ts`); `title-sync.ts` has no cancellation beyond shutdown; `43` 3.4a adds Stop for playlist jobs only.
3. **The progress bar is decoration.** The statusbar bar at the left has no value behind it: the backend reports a job as
   `running` or not, never how far it is, and the admin has no way to learn it without polling (forbidden, `01`).

## 2. Decisions

- **Stop works for every job** (playlist and catalog), from the Jobs tab and from the statusbar `Stop`. A stopped run keeps
  everything it already wrote and records `last_result = 'stopped'`; running it again resumes (`43` 3.4a; for the Library
  fill, upserts make a re-walk cheap and the walk is idempotent).
- **Progress is real, measured by the job itself,** held in memory while it runs: `{ phase, done, total }` (unit words in the
  admin). Nothing is stored; a restart forgets it (a run does not survive a restart anyway).
- **Progress is pushed, never polled** (`01`: no timers or polling in application code). The backend exposes ONE
  server-sent-event stream for signed-in admins; the admin holds it open while signed in. **Dated exception to `01` 4.4
  ("the backend has no socket"), owner 2026-10-18:** one read-only SSE stream, `GET /api/jobs/events`, carrying job
  progress and run state only. No other route streams.
- **The Library fill exists again:** a migration removes the four retired per-slice jobs and creates the Library fill
  (`name 'Library fill'`, `type catalog`, `config { scope: 'discover', pages: 100 }`, `enabled 1`, `schedule 'off'`:
  runnable on demand, never surprising) when the table holds no discover job. A discover job the owner already has is kept.

## 3. Backend

### 3.1 Progress model (`services/job-progress.ts`, <= 200 lines)

```ts
type JobProgress = { jobId: number; phase: string; done: number; total: number; startedAt: number };
```
A registry keyed by job id: `start(jobId)`, `update(jobId, { phase, done, total })`, `finish(jobId)`; every change is
published to subscribers (3.3). Job runners receive a `report(update)` function; they never touch the stream.

- **Playlist job phases** (`43` 3.4): `reading` (step 2, total 1), `logos` (step 4: distinct logo URLs to try), `checking`
  (step 5: distinct stream URLs). The overall fraction the statusbar shows is `(logosDone + checksDone) / (logosTotal +
  checksTotal)` once the totals are known (before then, the bar shows an indeterminate-free state: the current phase's own
  done/total). Totals are fixed when a phase starts, so the fraction never goes backwards within a run.
- **Library fill phases:** `movies` then `tv`, each `pages` pages: `done` counts discover pages walked, `total` is the
  page cap per kind clamped by TMDB's reported `total_pages` once the first page answers; overall fraction =
  `(pagesDoneBothKinds) / (pagesTotalBothKinds)`.
- Other catalog scopes (`trending`, `popular`): one phase, `pages` pages.

### 3.2 Stop for catalog jobs

`title-sync.ts` `runSync` takes an `AbortSignal` (replacing the module-level `stopped` flag for per-run stops; shutdown
still aborts every run). It checks the signal between pages and between rows and passes it to the TMDB client's request
(`tmdb-client.ts` accepts an optional signal). A stopped catalog run returns `{ outcome: 'stopped', titles }`; the job
records `last_result 'stopped'`, `last_counts { titles, stale, stopped: true }`, and `last_run_at` = the stop time.
`POST /api/jobs/:id/stop` (`43` 3.4a) now accepts catalog jobs too (the `422 job.invalid` for a catalog job is removed);
`409 job.not_running` when idle. `POST /api/titles/sync` keeps working through the same service.

### 3.3 The event stream

`GET /api/jobs/events` (signed in; `Authorization: Bearer`, so the admin reads it with `fetch`, not `EventSource`),
`Content-Type: text/event-stream`, `Cache-Control: no-store`, `X-Accel-Buffering: no`. Events (JSON `data`):

| event | data | when |
|---|---|---|
| `snapshot` | `{ running: JobProgress[] }` | first, on connect (so a reload shows the running state at once) |
| `progress` | `JobProgress` | a running job's progress changed; throttled to at most 4 per second per job (a small in-process rate cap, no timer: compare timestamps on update) |
| `finished` | `{ jobId, lastResult, lastRunAt }` | a run ended (ok, failed or stopped) |

Rules: a signed-in admin only (`401` otherwise); the stream closes when the access token expires (15 minutes) and the admin
reopens it after its next silent refresh; there is **no heartbeat and no timer** (the only backend timer stays the sync
scheduler's, `01` 4.4: the connection is loopback or a LAN, and a dropped stream is reopened by the admin on focus or
`Refresh`); bounded subscribers (at most 8); the stream carries no URLs, names or secrets (job ids and numbers only). `GET /api/jobs`
and `GET /api/jobs/:id` also carry `progress?` for a running job (so a Refresh and a first load agree with the stream).

### 3.4 Library fill migration (`025-library-fill.sql`)

In one transaction: `DELETE FROM sync_jobs WHERE type='catalog' AND name IN ('Trending movies','Trending series','Popular
movies','Popular series') AND json_extract(config,'$.scope') IN ('trending','popular')` (only the retired seeded ones:
a trending/popular job the owner made under another name is kept); then, when no catalog job has scope `discover`, insert
the Library fill as in section 2. The seed (`sync-seed.ts`) stays as is for fresh databases. Test: a version-24 fixture
with the four per-slice jobs and the playlist job migrates to the playlist job plus one Library fill; a database that
already has a discover job keeps it and gains no second one.

### 3.5 Correctness of discovery (acceptance of the run itself)

The walk (`03` 7.6b): per kind, `discover/{kind}?sort_by=popularity.desc&page=n`, n from 1 to the cap, each result stored
as a list row unless a fresh stored payload stands; a deleted or disabled title stays so; the run is single-flight
(`409 sync.busy`) and audited. W2c's worker verifies it end to end against a fake TMDB (the existing test seam) AND reads
the code for defects: a page that answers an error mid-walk must fail the run with the typed code and keep what was
written; TMDB's `total_pages` below the cap ends the kind early; a `429` backs off through the client; the run reports
progress per page.

## 4. Admin app

- **Statusbar** (`AdminStatusbar.tsx`, `lib/running-work.ts`, `constants/record-copy.ts`): the progress bar's fill is the
  overall fraction of the running jobs (one job: its fraction; several: the mean of their fractions); no job running: an
  empty track; the status word shows `N syncing` (as today) and the bar's tooltip names the phase and counts
  (`Checking streams 1,204 of 2,598`, `Walking movies 12 of 100 pages`). `Stop` is enabled whenever any job runs and stops
  every running job (`POST /api/jobs/:id/stop` for each, then the stream reports `finished`); disabled otherwise with
  `Nothing is running.` (`STOP_SYNC` text removed).
- **Live state** (`store/slices/jobs-progress-slice.ts` or the existing registry's pattern; `services/job-events.ts`,
  `hooks/useJobEvents.ts`): after sign-in the app opens `GET /api/jobs/events` with `fetch` and an `AbortController`,
  parses the event frames, and writes `progress` and `finished` into the store; it aborts on sign-out; when the stream
  ends (token expiry, backend restart) it reopens on the next silent refresh, on window focus, or on a list `Refresh` - never on a timer. On
  `finished` it marks the jobs, playlists and channels slices stale (the lists re-read on their next view or `Refresh`).
- **Jobs tab:** a running row's `state` word reads `running` with the percentage (`running 46%`); the workspace `Run`
  group's `Stop` and `Resume` (`43` 4.1) use the same service; `Last run` words come from the typed counts incl.
  `stopped`.
- The Library fill appears in the Jobs list as a Catalog row (`Library fill`, `discover`, `Off`), with `Run job` working
  and its progress live.

## 5. Docs to update with this plan (coordinator, now)

`01` 4.4 (the dated SSE exception); `03` 7.6b and 7.2c (`POST /api/jobs/:id/stop` for catalog, `GET /api/jobs/events`,
`progress` on the job answer); `26` 3.11 (the Library fill migration); `43` 3.4a (Stop for catalog) and 10 (waves); `28`
(statusbar).

## 6. Waves

| Wave | Scope | Acceptance |
|---|---|---|
| **W2c backend** (after W2 lands; same job-runner) | `job-progress.ts`; progress reporting in the playlist job and in `title-sync`; abort signal through `title-sync` and `tmdb-client`; catalog Stop; `GET /api/jobs/events` (SSE) and `progress` on job answers; migration `025`; tests (SSE framing with a fake client, snapshot on connect, throttle, 401, subscriber cap, close on expiry, abort mid-walk, the fake-TMDB discover walk incl. error mid-walk and early `total_pages`, migration 025). | Backend suite green; live on a temporary backend: Run job on the Library fill emits progress and `Stop` ends it `stopped`; a playlist job emits `checking` progress. |
| **W3 admin** (extends `43` W3) | The statusbar bar and `Stop`; `job-events` service and hook; the live state slice; running-row percentages; `Stop`/`Resume` in the Jobs workspace; the Channels tab parts of `43` 4.1; tests. | `43` 4.3 rows plus: the bar moves during a run, `Stop` stops it, the Library fill row exists and runs. |

## 7. Not built

Per-item progress for TMDB title detail fetches; a progress history; a cancel for a single page request already in flight
beyond aborting it; pausing a run (Stop then Resume is the pause).
