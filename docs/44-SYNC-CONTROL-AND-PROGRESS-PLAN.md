# 44 - Sync control and progress: Stop for every sync, real progress, a working Library fill (plan, v2)

**Status: APPROVED by the owner 2026-10-18 (request: "the stop button in the status bar should stop the sync, and the
progress bar should actually update real progress. sync discovery should also work as expected"); v2 after the planning
review (eight blockers folded in).** Extends `43` (playlist sync) and `26` 3.11 (jobs). Docs before code (`07`). Scope: the
admin backend and the admin app only.

## 1. What is wrong today (verified 2026-10-18 on the owner's database and the code)

1. **There is no Library fill job.** The owner's `sync_jobs` holds the four per-slice catalog jobs (trending and popular,
   movies and series; `schedule` off) and the playlist job. The per-slice jobs were retired by the owner on 2026-10-17
   (`26` 3.11) but the deletion never ran on this database, and the first-start seed (`sync-seed.ts`) had already been
   marked done, so the replacement - the **Library fill**, scope `discover` - was never created.
2. **Stop does nothing.** The statusbar `Stop` is disabled (`A sync cannot be cancelled.`, `record-copy.ts` `STOP_SYNC`,
   `running-work.ts`); `title-sync.ts` has no per-run cancellation; `43` 3.4a adds Stop for playlist jobs only; and
   `tmdb-client.ts` cannot be aborted (it retries every `fetch` rejection, its pacing and 429 backoff are plain
   `setTimeout`s, and it merges identical in-flight calls).
3. **The progress bar is decoration.** The backend reports a job as `running` or not, never how far it is, and the admin
   cannot learn it without polling (forbidden, `01`).
4. **The discover walk has defects** (section 3.5): a stale stored `detail` payload is overwritten by a thin list row,
   `total_pages` is never read, a single 5xx fails the whole run, every row autocommits, and a failed or stopped run loses
   its typed code and its count.

## 2. Decisions

- **Stop works for every job** (playlist and catalog), from the Jobs tab and the statusbar. A stopped run keeps everything
  it wrote and records `last_result = 'stopped'`; running again continues a playlist job where it stopped (`43` 3.4a) and
  **re-walks** the Library fill from page 1 (upserts make that cheap, about 210 ms a page).
- **Progress is real, measured by the job**, held in memory while it runs: `{ jobId, phase, done, total }`. Nothing is
  stored; a restart forgets it.
- **Progress is pushed, never polled.** ONE read-only server-sent-event stream, `GET /api/jobs/events`, **dated exception
  to `01` 4.4 (owner 2026-10-18)**. "No timers" means no heartbeat timer and no polling timer in this feature (existing
  timers elsewhere, e.g. the TMDB client's pacing and the job settle race, are unchanged).
- **The Library fill exists again** (migration `025`, 3.4). Its default is `pages: 500` (TMDB's discover cap; the owner's
  10,923 titles are about 270 pages a kind, so 100 pages would stop at 2,000 a kind), `schedule 'off'`, runnable on demand,
  with real progress and Stop. The owner may lower it on the job.
- **`POST /api/titles/sync` starts the Library fill job** (so it is stoppable and reports progress) instead of running its
  own separate run.

## 3. Backend

### 3.1 Progress model (`services/job-progress.ts`, <= 200 lines)

```ts
type JobProgress = { jobId: number; phase: string; done: number; total: number };
```
A registry keyed by job id: `start(jobId)`, `update(jobId, { phase, done, total })`, `finish(jobId)`; the **registry always
holds the latest value** (`GET /api/jobs`, `GET /api/jobs/:id` and the stream's `snapshot` read it) and every change is
published to subscribers (3.3). Job runners receive a `report(update)` function; they never touch the stream.

- **Playlist job:** phases `reading` (step 2), `logos` (step 4: distinct logo URLs to try), `checking` (step 5: distinct
  stream URLs). **The statusbar fraction uses fixed phase weights computed up front:** `reading` 0%, `logos` 0 to 20%,
  `checking` 20 to 100%, each interpolated by its own `done/total` once the phase's total is known (before that, its lower
  bound). The registry also clamps `fraction = max(previous, new)` per run, so the bar never goes backwards.
- **Library fill:** phases `movies` then `tv`; `done` counts discover pages walked and `total` is the page cap per kind,
  lowered to TMDB's `total_pages` once the first page answers (a total can only shrink, which moves the bar forward);
  overall fraction = pages done over both totals. Other catalog scopes: one phase, `pages` pages.
- With several running jobs the statusbar bar shows **the most recently updated job** (a mean would drop when one finished).

### 3.2 Stop for catalog jobs

`title-sync.ts` `runSync` and `syncOnce` take a per-run `AbortSignal` (the module `stopped` flag stays for shutdown only);
it checks the signal between pages and rows. `SyncResult` becomes `{ result: 'ok'|'failed'|'stopped'; code?: string;
titles: number }`: `titles` counts rows seen before the end; an abort is `stopped`; an `AppError` is `failed` with its code;
anything else is `internal.failure`. `runCatalog` records `ok {titles, stale}`, `failed {code}`, `stopped {titles, stale,
stopped: true}` with `last_run_at` = the end time; the in-memory `lastRun` for `GET /api/titles/sync` takes the same value.
New audit action `sync.stopped`.
`tmdb-client.get(path, params, { signal })`: pacing and backoff become `sleep(ms, signal)` that ends on abort; `raw` checks
`signal.aborted` at the top of each attempt and in the `catch` and never retries after an abort; **a caller with a signal
does not join or share an in-flight merge** (it races its own await against the signal and leaves a shared request to its
other callers); a queued slot of an aborted caller does not run. The 429 backoff also covers 5xx (bounded), then fails with
`tmdb.unavailable`.
`POST /api/jobs/:id/stop` (`43` 3.4a) accepts catalog jobs (the `422 job.invalid` for a catalog job is removed);
`409 job.not_running` when idle; the single flight is released when the run ends.

### 3.3 The event stream

`GET /api/jobs/events` (signed in, authorized **at connect**; `Authorization: Bearer`). `Content-Type:
text/event-stream`, `Cache-Control: no-store`, `X-Accel-Buffering: no`. The route is registered before `/api/jobs/:jobId`.
Events (JSON `data`): `snapshot` `{ running: JobProgress[] }` first; `progress` `JobProgress`; `finished`
`{ jobId, lastResult, lastRunAt }`.

Fastify rules: the route `reply.hijack()`s and writes its own headers with `writeHead` (hooks do not run on a hijacked
reply, so the `no-store` `onSend` header is set by hand); the subscriber is added in the **same synchronous step** that
writes the `snapshot`, so no `finished` is missed; `request.raw` `close` and `reply.raw` `error` unsubscribe; if
`raw.write()` returns false the subscriber is ended (progress is idempotent and a new `snapshot` re-syncs, so there is no
queue); `app.ts`'s `onClose` calls `events.closeAll()` first so an open stream never hangs shutdown or Electron quit;
at most 8 subscribers.
Throttle: same-phase `done` increments are capped at 4 a second per job by comparing timestamps; a **phase change,
`done === total` and `finished` are never throttled** (so the final value is always delivered). The stream carries job ids
and numbers only, no URLs, names or secrets, and **no heartbeat timer**. There is no token-expiry rule: the admin aborts the
stream on sign-out and reopens it when its access token changes, on window focus and on `Refresh`.
`GET /api/jobs` and `GET /api/jobs/:id` carry `progress?` for a running job.

### 3.4 Library fill migration (`025-library-fill.sql`)

`DELETE FROM sync_jobs WHERE type='catalog' AND name IN ('Trending movies','Trending series','Popular movies','Popular
series') AND json_valid(config) AND json_extract(config,'$.scope') IN ('trending','popular')` (only the retired seeded
ones; a job the owner renamed is kept). Then, **only when `sync_seed` already has its row** (the already-seeded databases
this exists for; a fresh database leaves it to the seed, which would otherwise create a second one) and no catalog job has
scope `discover` (`json_valid` guarded; `WHERE NOT EXISTS`), insert `name 'Library fill', type 'catalog', enabled 1,
schedule 'off', config {"scope":"discover","pages":500}, playlist_id NULL, last_result NULL` (satisfies both CHECKs of
`022`). The seed's default pages become 500 too. Numbering: `022` model, `023` lockout, **`024` W2's one-line reset, `025`
this**. Test: a version-24 fixture with the four per-slice jobs and the playlist job migrates to the playlist job plus one
Library fill; a database that already has a discover job keeps it and gains none; a fresh database ends with exactly one
(from the seed).

### 3.5 Defects of the discover walk to fix (`title-sync.ts`, `tmdb-client.ts`)

- A stale stored title is **kept, not overwritten**: when the existing payload is `shape: "detail"`, only `rating`,
  `posterUrl`, `backdropUrl` and `popularity` are refreshed onto it; `shape` and `fetchedAt` stay (so opening it does not
  cost a TMDB and an OMDb call again).
- `total_pages` ends a kind early and sets the progress total.
- A 5xx is retried with bounded backoff like a 429, then the run fails with the typed code and keeps what it wrote.
- Each page is written in one `store.transaction` (not one autocommit per row).
- `titles` counts rows seen; the dead `popularity === null` branch is removed; a deleted or disabled title stays so (this
  part is already correct: do not break it).
- Verified end to end against a fake TMDB (the existing test seam), including an error mid-walk and an early `total_pages`.

## 4. Admin app

- **Streaming:** `SessionApi` gains `stream(path, { signal, quiet: true })` built on `apiStream` (in `shared/http`) with the
  proactive refresh and one retry after a 401 (`01` 4.1 allows only `services/api.ts` to call `fetch`; `quiet` keeps every
  reopen out of the Events drawer). `services/job-events.ts` parses the SSE frames and writes `progress` and `finished` into a
  new live job-progress slice. On stream end it clears its progress state and marks jobs, playlists and channels stale; a
  `snapshot` is authoritative (any job absent from it has finished). `hooks/useJobEvents.ts` opens it after sign-in and reopens
  it when the access token changes, on focus and on `Refresh` - never on a timer.
- **Statusbar** (`AdminStatusbar.tsx`, `lib/running-work.ts`, `constants/record-copy.ts`): "any job running", the fraction and
  the `Stop` targets come from **the job-progress slice, never from `work.syncing`** (the bulk runners write that, so a bulk
  Enable already shows "1 syncing"). The bar fills to the most recently updated running job's fraction (empty when none); the
  tooltip names the phase and counts (`Checking streams 1,204 of 2,598`, `Walking movies 12 of 100 pages`). `Stop` is
  enabled while any job runs and stops every running job (`POST /api/jobs/:id/stop` for each; the stream reports
  `finished`); its title reads `Stop syncing`; disabled otherwise with `Nothing is running.` (`STOP_SYNC` removed).
- **Jobs tab:** a running row's `state` word reads `running` with the percentage (`running 46%`); the workspace `Run` group's
  `Stop` and `Resume` (`43` 4.1) use the same service; `Last run` words come from the typed counts incl. `stopped`.
- The Library fill appears as a Catalog row (`Library fill`, `discover`, `Off`) and `Run job` works with live progress.

## 5. Docs to update with this plan

`01` 4.4 (the dated SSE exception - done), `03` 7.2c and 7.6b (stop for catalog, the events route, `progress`, audit
`sync.stopped`, `POST /api/titles/sync` starts the Library fill), `26` 3.11 (the migration), `43` 3.4a and 6 (numbering),
`28` (statusbar).

## 6. Waves

| Wave | Scope | Acceptance |
|---|---|---|
| **W2c backend** (after W2 lands; same job-runner) | `job-progress.ts`; progress in the playlist job and `title-sync`; the abort plumbing through `title-sync` and `tmdb-client` (3.2); catalog Stop and typed results (`SyncResult`); the 3.5 fixes; `GET /api/jobs/events`; `progress` on job answers; `POST /api/titles/sync` starting the Library fill; migration `025`; tests (SSE framing, snapshot on connect, throttle never drops a phase change or the final value, 401, subscriber cap, disconnect cleanup, closeAll on shutdown, write-false ends a subscriber, abort mid-walk incl. a backoff sleep, no retry after abort, a signal caller does not cancel a shared request, the fake-TMDB discover walk incl. error mid-walk and early `total_pages`, detail payload kept, migration 025 cases). | Backend suite green; on a temporary backend: Run job on the Library fill emits progress and Stop ends it `stopped`; a playlist job emits `checking` progress. |
| **W3 admin** (extends `43` W3) | `SessionApi.stream`, `job-events`, the progress slice and hook, the statusbar bar and `Stop`, running-row percentages, `Stop`/`Resume` in the Jobs workspace, the Channels tab parts of `43` 4.1; tests. | `43` 4.3 rows plus: the bar moves during a run, `Stop` stops it, the Library fill row exists and runs. |

## 7. Not built

Per-item progress for TMDB detail fetches; a progress history; pausing (Stop then Resume is the pause); a heartbeat; stream
expiry on token expiry.
