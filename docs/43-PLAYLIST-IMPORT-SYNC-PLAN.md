# 43 - Playlist import, sync, logo cache and stream status (plan)

**Status: APPROVED by the owner 2026-10-18 (see the decision line in section 12); executing wave by wave, W0 docs first.** Written by a read-only planning pass over the current code, `20`, `42`, `03` 7.2c, `26` 3.11, `38`, `41`. It supersedes `42` sections 2-4 and keeps its rulings 1-5. Nothing is built from it until the owner approves and the open questions in section 12 are answered. Docs before code (`07`).

## 0. Verdict

**Scope (owner, 2026-10-18): the admin backend and the admin app only.** The desktop interface (`src/frontend`) and the fileserver (`src/fileserver`) are not touched by any of this.

- **Import is one request that reads a playlist and creates the parent record and every channel, disabled.** A file arrives as multipart. A URL arrives as a JSON body (`POST /api/playlists`), fetched once. Neither does per-channel network work.
- **Sync is one job per playlist, four steps:** (1) re-read the source, but only if it can have changed; (2) fill missing logo addresses from the iptv-org index; (3) cache the logo bytes on the backend; (4) check every stream and record `live` or `dead`.
- **The owner's hypothesis is right, and stronger for uploaded files.** An uploaded file has no external mtime: the backend's copy changes only when the file is uploaded again, which is an import. So the sync never reads a file source and needs no mtime or hash check. A URL source has no cheap "did it change" signal that works everywhere: hash the body (at most 8 MiB, typically 280 KB) and skip parse and plan when the hash is unchanged. ETag and Last-Modified are not built.
- **Update stays; prune goes.** Update (a moved stream address) is the point of a URL source. Prune, dry run, `kept` and `removed` are dropped: today a truncated download plus prune deletes channels (1.2 item 5). With live/dead status a vanished channel shows as dead and the owner bulk-deletes it with the `Dead` filter.
- **Three requirements break written rules in `01`.** Each needs the owner's explicit yes in the doc before code (section 12): the backend stores and serves logo bytes; the backend accepts an M3U upload; a new multipart dependency.
- **Bulk enable/disable exists and works across pages** (`Select all M matching`) but runs one `PATCH` per channel: 2,000 channels means 2,000 revisions and 2,000 audit rows. This plan adds one bulk call (3.3).
- **The saved `playlists/us.m3u` has no `tvg-logo` and no `tvg-id` on any of its 2,598 entries.** Channels have no images unless the sync resolves logos from the iptv-org index by name, so that resolver stays and is fixed.

## 1. Current code (A)

### 1.1 What exists

| Area | Where | State |
|---|---|---|
| M3U parse | `services/m3u-parser.ts` (61) | Sound. Keep. |
| Parse, dedupe, address rule | `playlist-fetch.ts:26` `planEntries` | Private today; must be exported. |
| Fetch and stored read | `playlist-fetch.ts:55-91` | Fetch kept; stored read removed. |
| Planner | `playlist-sync-plan.ts` (97) | Pure and tested. Keep, with fixes. |
| Sync | `playlist-sync-service.ts` (149) | Fetch, enrich per entry, plan, write. Rewritten. |
| Logo index | `logo-resolver.ts` (173) | iptv-org `logos.json` and `channels.json`, cached in `DATA_DIR/logo-index.json`. |
| Jobs | `job-runner.ts`, `job-service.ts`, `sync-scheduler.ts`, `sync-seed.ts`, `api/jobs.ts` | Record-based, one timer. Keep. |
| Playlists | `playlist-service.ts`, `playlist-repository.ts`, `api/playlists.ts` | CRUD plus the other session's raw-text import. |
| Aggregate sync | `api/playlist-sync.ts` (26) | Thin duplicate; the admin never calls it. |
| Tables | migrations 005, 008, 010, 013, 014 | `channels.tvg_id/source/sync_name/edited_fields/playlist_id/enabled/logo_url`; `playlists`, `sync_jobs`, `sync_seed`. 011 and 012 only created and dropped `sync_settings`. |
| Fileserver | `live-channels-service.ts`, `stream-probe.ts`, `image-cache-service.ts` | Already probes every enabled stream and caches logos lazily. |

**There is no backend image cache.** `channel-views.ts:35` passes the source `logoUrl` straight through; the fileserver fetches the third-party host on first request.

### 1.2 Bugs and incomplete parts

Importer:
1. **Wrong contract** (`api/playlists.ts:33-39`, `app.ts:63`, `playlist-service.ts:90-119`): a raw text body plus a hand-typed `?name=`, and a call into the sync with a busy catch.
2. **No file control or multipart exists in this repo.** The shared request layer is JSON-only (`shared/http/src/create-api.ts` always `JSON.stringify`s the body). `FolderRow` is a native folder picker that uploads nothing. The family upload pattern is LoRA Studio's `ImagesGroup.tsx`: a hidden `<input type="file">` behind a ghost `Upload` button, posted as multipart through `@fastify/multipart`.
3. **A URL playlist has no import.** `POST /api/playlists` creates a bare record; channels exist only after a job runs.
4. **A created or imported playlist gets no sync job** (`playlist-service.ts:71-81`), so `Sync now` refuses (`SYNC_NO_JOB`). Only environment seeding creates jobs.
5. **Silent truncation** (`playlist-fetch.ts:71`): `arrayBuffer()` then `.subarray(0, maxBytes)` - the whole body is read before the cap, and an oversize list is cut mid-line without an error. With prune on, every entry past the cut is "vanished" and deleted (`playlist-sync-service.ts:95`).
6. **Cross-playlist stealing** (`playlist-sync-plan.ts:62-72`, `mergeEntry` 32-36): the planner matches against every sync-owned row and re-points `playlistId`. Importing playlist B can take over playlist A's channel.

Sync:
7. **Per-entry await** (`playlist-sync-service.ts:71-73`): 2,598 `await logos.resolve(...)` calls, each re-attempting a full index download when the index failed.
8. **Probable cause of the 313 s import** (`logo-resolver.ts:105,119`): `.parse` (throws) not `safeParse`. One malformed index row makes `build()` throw, `ensure()` (130-152) leaves `loadedAt` null, and the next entry re-downloads both 8 MiB files. The network-failure branch (141-145) sets `loadedAt` in memory only and never persists.
9. **Wrong sync model for the new work:** no image bytes, no status, a playlist job is awaited inside the HTTP request (`job-runner.ts:107-110`), dry run/prune/`kept`/`removed` serve a model the owner does not need, and `remember()` (118-120) stamps the outcome on every target even if only one failed.
10. `sync-scheduler.ts:177`: a job that has never run is due at once. Wanted; 3.4 relies on it.

Logos:
11. Logos are text only; the enrichment URL is never downloaded.

Admin:
12. `hooks/usePlaylistChannels.ts:30-31` reads the whole channel list and filters by host client-side.
13. `PlaylistStatusGroup.tsx:44-57` renders one link per channel (about 2,600 `li`), contradicting `38` 3.4 and `41`.
14. `source` is a host, so two playlists on one host share a filter; the playlist id (`channels.playlist_id`) is the real key.
15. The Channels list has no stream-health column or filter; a stream row's `state` column shows its origin (`channel-rows.ts:42`).

Bulk:
16. `useChannelBulk` runs one `PATCH` per channel through the sequential runner. Correct across pages; at 2,598 rows it makes 2,598 audit rows and revisions.

Fileserver (observed only; out of scope, this plan does not change it):
17. `live-channels-service.ts:103-104` awaits `probe.checkAll` over every enabled channel inside the channel read; at hundreds of enabled channels the Live list hangs on a read.

### 1.3 Over-engineering to remove

- The `stored:` file copy: `playlist-store.ts`, `readStoredPlaylist`, delete-file-on-remove. Nothing reads the file back once the sync no longer re-reads file sources.
- `PlaylistSyncBodySchema` (`dryRun`, `prune`), the job config flags, the `Dry run` and `Prune` toggles, `kept`, `removed`, `vanished`.
- `api/playlist-sync.ts` and `playlistSync.status()`.
- (`PLAYLIST_URLS` environment seeding is small and stays.)

## 2. Judging docs/42 (B)

**Keep** all five rulings: import and sync are different actions; the import takes only the file; import is fast with no network work; channels land disabled; docs before code. Keep the re-import identity rule (same name updates in place, never duplicates), the `planEntries` export, the planner's host -> tvgId -> syncName match order, and the 8 MiB cap.

**Drop:** its keep-list items `playlist-store.ts` and `readStoredPlaylist`; the "sync is unchanged" acceptance; the claim that sync "enriches logos" as the only logo work (it never produces bytes).

**Missing against the owner's requirements:** URL import, the file control, image caching, live/dead status, a job created with the playlist, a bulk enable that does not make N calls, admin and fileserver surfaces, the "source can have changed" logic, any treatment of the logo-resolver failure, a migration for existing data. Its `run` answer field becomes `imported`.

## 3. Target design (C)

### 3.1 Data model

`playlists` (existing columns kept): `address` (the secret URL, or the `stored:<name>` label for a file; never returned, audited by host only); `kind` is derived, no column (`stored:` prefix means `file`, else `url`); **new** `content_hash TEXT` (SHA-256 of the last imported URL body; `NULL` forces a re-read; `PATCH address` sets it `NULL`); `last_synced_at`, `last_outcome` unchanged.

`channels` (nothing dropped): `tvg_id`, `source`, `sync_name`, `edited_fields`, `playlist_id`, `enabled`, `logo_url` kept. **New:** `status` (`'live'|'dead'|NULL`, NULL = not checked), `checked_at` (epoch ms), `logo_file` (`<sha256-32hex>.<ext>`), `logo_checked_at` (epoch ms of the last download attempt). Index `channels (playlist_id)`.

Wire: public `BackendChannel` gains `status?`, `checkedAt?`, `cachedLogoUrl?` (`${base}/logos/<logo_file>`, built from the request origin). `logoUrl` stays the source everywhere; an admin edit form must never read the cached address back into `logoUrl`. `PlaylistView` gains `kind`, `enabledChannels`, `live`, `dead`.

**Image cache:** `DATA_DIR/logo-cache/` (must not collide with the generated live PNGs at `/logos`). Name: first 32 hex of sha256(bytes) + `png|jpg|gif|webp`. Identical images are stored once; same hash means skip (this is the owner's "skip if the exact same image exists"); an existing file is not rewritten. Accepted only if the response is `image/*`, the magic bytes are PNG/JPEG/GIF/WebP, and the size is at most 1 MiB. SVG is not cached. Garbage collection at the end of each run deletes cache files no channel references.

**Token-in-URL secrecy rule is unchanged:** the address lives only in `playlists.address`; reads show `host` and `masked`; audit and error details carry the host only; the sync's fetch is the only reader; new code never logs a URL. Stream URLs are published data and may appear in refusal examples as today.

### 3.2 Import routes

Signed in, audited, dotted error codes.

| Route | Request | Answer |
|---|---|---|
| `POST /api/playlists/import` | `multipart/form-data`, exactly one `file` part; limit 8 MiB (`PLAYLIST_IMPORT_BODY_LIMIT_BYTES`), `@fastify/multipart` | `201` new, `200` replaced: `PlaylistView` + `created` + `imported { created, updated, skipped, refused, refusalExamples }` |
| `POST /api/playlists` | JSON `{ address, name?, enabled? }` - becomes URL import: insert, fetch once, import, in one request | `201`, same answer |

Both share `importText(record, text, hash?)`: (1) parse - not M3U is `422 playlist.invalid`, nothing written; (2) `planEntries`; (3) plan against this playlist's own rows (3.6); (4) one transaction: inserts, updates, one `revisions.next()`; (5) audit `playlist.imported` with counts and host. They differ only in where the text comes from.

- **File name rule:** the playlist name and its identity label come from the sanitized upload filename (basename, lowercase, `[^a-z0-9._-]` runs become `-`, must end `.m3u`, at most `STORED_NAME_MAX`). Bad extension: `422 playlist.invalid` (field `file`). Missing part or oversize: `400 request.invalid`.
- **No stored copy:** identity is `stored:<name>`; the same name updates the same playlist in place, a different name makes a new playlist.
- **Atomic on failure:** a URL that is unreachable or not M3U creates no record (`503 playlist.unreachable` / `422 playlist.invalid`). Duplicate address or reaching `PLAYLISTS_MAX` (20) is `422 playlist.invalid`.
- **Concurrency:** import takes no sync lock and does no per-channel network work; a URL import makes the one playlist fetch (15 s).
- **A job is created with the playlist** in the same transaction when none exists: `Sync <name>`, schedule `24h`, enabled; due at once under the scheduler rule, so the first logo and status pass starts shortly after as a separate background run.

`GET /api/playlists`, `GET|PATCH /api/playlists/:id` are unchanged apart from `PlaylistView`.

**`DELETE /api/playlists/:id` removes the playlist and everything that belongs to it, in one transaction** (owner, 2026-10-18: a parent must not be deleted while child records still reference it; an overhaul does not keep today's orphaning): its channels (`channels.playlist_id = id`), its sync jobs, and, after the transaction, the cached images no channel references any more (the run-end garbage collection rule). One revision bump, one audit entry `playlist.deleted` with `channels: N, jobs: M` and the host. Answer `{ id, deletedChannels, deletedJobs }`. A sync run in progress for that playlist is stopped first (`409 sync.busy` is not returned: delete aborts the run, then deletes). The admin's two-step `Delete` says what it will remove: `Delete <name> and its 2,598 channels?`. Hand-made channels (`playlist_id` absent) are never touched. The channel's own `DELETE` and bulk `Delete` stay for removing single channels from a playlist.

### 3.3 Channels, bulk and logos

| Route | Change |
|---|---|
| `PATCH /api/channels` | **New** bulk: `{ enabled, ids[] }` (1-500). Stream rows only; live ids counted in `skipped`. One transaction, one revision, one audit entry `channel.enabled_bulk`. Answers `{ changed, skipped }`. Needs the `CHANNEL_BODY_LIMIT_BYTES` route limit. Invalid body `422 channel.invalid` (field `ids`). |
| `GET /api/admin-channels` | Adds `status` (`live|dead|unchecked`) and `playlist` (id) filters in `store/channel-page.ts`. `source` stays. |
| `GET /logos/:file` | Extended: a name matching `^[0-9a-f]{32}\.(png|jpg|gif|webp)$` is served from `DATA_DIR/logo-cache/`; public, `cache-control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`. Existing live PNG ids unchanged. |
| `GET /api/channels` (public) | Adds the three fields above. |
| `GET|POST /api/playlist-sync` | **Removed.** |

### 3.4 The job and the sync algorithm

Job types unchanged: `playlist` and `catalog`. The playlist job's config is `{ playlistId }` only. `POST /api/jobs/:id/run` for a playlist job is **started, not awaited**: `202` with `running: true`, like a catalog job; the admin sees the result on `Refresh` (no polling).

Limits (named constants): run wall clock 30 min; probe budget 10 min; logo fetch 10 s, 1 MiB, concurrency 8; ping 5 s, 64 KiB prefix, concurrency 16 overall and 2 per host; playlist fetch 15 s.

1. **Claim.** Refuse if the job or its playlist is disabled (`422 job.disabled`). Single flight: `409 sync.busy` for the same job, `playlist.busy` if another playlist sync runs.
2. **Re-read, only if the source can have changed.** `file`: skip. `url`: GET, streaming, hard 8 MiB cap (over the cap is an error, never a truncation); hash the body; same as `content_hash` -> skip; otherwise `importText` (create and update only, nothing deleted) and store the hash. On fetch or parse failure record `source: unreachable` and continue to step 3.
3. **Resolve missing logo addresses** for this playlist's rows with no `logo_url` and no edited `logoUrl`: load the iptv-org index once per run, look up by tvg-id then normalized name, set `logo_url` (column-targeted, clears `logo_checked_at`). Skip if no such rows. Resolver fixes: `safeParse` and skip bad rows; on any failure persist a cache stamp so the index retries in one hour, not every entry.
4. **Cache logos:** distinct `logo_url`s of this playlist's rows where `logo_checked_at` is NULL or older than 7 days. Download within the limits, hash, write `<hash>.<ext>` atomically (temp + rename) if absent, set `logo_file` and `logo_checked_at`; on failure set `logo_checked_at` only and keep any older `logo_file`. Then garbage-collect.
5. **Check streams** of this playlist, enabled or not, oldest `checked_at` first (NULL first). Probe distinct stream URLs: `live` if 2xx and the body starts `#EXTM3U` (the fileserver's `03` 5.2 rule), else `dead`. **The verdict is per channel, from that channel's own exact stream URL** (owner, 2026-10-18): a host-level check (ping, TCP connect, DNS) proves only that a server answers, not that this stream works, so no host result is ever used as a channel's verdict and there is no host shortcut - every distinct URL gets its own request, and a DNS or refused failure on that request makes that channel `dead`. Results are written column-targeted (`status`, `checked_at`) in batches of 200 per transaction - never whole records over a minutes-long run. One `revisions.next()` on the first batch that changes anything. When the probe budget ends the rest stay unchecked and go first next run.
6. **Record.** Set `last_synced_at` and `last_outcome`. Outcome sentence e.g. `Synced: playlist unchanged, 312 logos cached, 1,904 live, 640 dead.` Job `last_counts`: `{ created, updated, skipped, refused, source: "unchanged"|"updated"|"file"|"unreachable", logosCached, logosFailed, live, dead, unchecked, refusalExamples, createdIds }`. One audit entry `playlist.synced` with counts and host.

### 3.4a Stop and resume (playlist jobs only)

**Stop** cancels the run in progress and keeps everything it already finished. **Resume** is the same job started again; the sync is resumable by construction, so there is no resume state or table: step 5 orders by `checked_at` (oldest first, NULL first), step 4 skips logos checked under 7 days ago, and step 2 is one transaction (an abort never leaves it half-applied; the hash is saved with it). Resume does not change when the job next fires. **Pausing the schedule** already exists as the job's `Enabled` toggle and the bulk `Disable`; disabling does not stop a run in progress, `Stop` does.

| Item | Detail |
|---|---|
| Route | `POST /api/jobs/:id/stop`. Signed in, audited `job.stopped`. Answers `202` with the job; it stays `running: true` until the run reaches its next check (seconds, because in-flight requests abort). |
| Errors | `409 job.not_running` if idle (add a backend entry, like `job.not_found`). `422 job.invalid` for a catalog job, which cannot be stopped. |
| Plumbing | `job-runner.ts` keeps an `AbortController` per running job and adds `stop(job)`. The sync takes a `signal` and passes it to `fetch` combined with each timeout (`AbortSignal.any`). `stream-check.ts` and `logo-cache.ts` stop launching work and let in-flight requests abort. App shutdown aborts every running job. |
| Partial progress | Status and logo batches are committed column by column, so a stop loses at most the batch in memory. |
| Run record | `last_run_at` is set to the stop time, `last_outcome` reads `Stopped: 1,204 of 2,598 streams checked.`, `last_counts` carries the partial counts plus `stopped: true`; the playlist's `last_outcome` reads `Stopped`; the audit entry `playlist.synced` carries `stopped: true`. |
| Scheduler | Because `last_run_at` is set, a stopped job is not due again until its interval passes (otherwise a never-run job that was stopped would be due at once, `sync-scheduler.ts:177`). |
| Resume | `POST /api/jobs/:id/run`, unchanged. A disabled job or playlist still refuses `422 job.disabled`. |

Admin UI:

| Surface | Change |
|---|---|
| Jobs -> list strip | New bulk verb `Stop` (ghost, `CircleStop` icon, per the icon vocabulary entry "Cancel a scan, Stop"), beside `Enable`, `Disable`, `Delete`, always drawn, acting on ticked jobs through the shared runner (`useJobBulk.ts`, `lib/job-bulk.ts`). Disabled reasons: `Tick a job first`; `That job is not running.`; `A catalog sync cannot be stopped.` |
| Jobs -> row state word | New word `stopped` (faint tone) in `lib/row-state.ts` `jobState`, shown when `lastCounts.stopped` and the job is not running. `28` 9's word list is updated. |
| Jobs -> workspace `Run` group | A ghost `Stop` beside `Run job`. `Run job` is relabelled `Resume` when the last outcome was a stop. `Run job` is disabled `Running.` during a run; `Stop` is disabled `Not running.` when idle and `A catalog sync cannot be stopped.` for a catalog job. Files: `JobRunGroup.tsx`, `lib/job-run-gate.ts`, `constants/job-copy.ts`. |
| Jobs -> `Last run` group | Shows `Stopped` with the partial counts (`job-counts.ts` reads `stopped`). |
| Statusbar | Today's `Stop` is disabled `A sync cannot be cancelled.` (`constants/record-copy.ts:30` `STOP_SYNC`, `lib/running-work.ts:26`). It is enabled when any playlist job runs and stops those jobs; its disabled reasons become `Nothing is running.` or, for catalog-only work, `A catalog sync cannot be stopped.` |
| Service and flows | `services/jobs.ts` gains `stop(id)`; `services/job-flows.ts` a stop flow with the notice `Stopping <name>.`; the result is read on `Refresh` (no polling). |

Docs: `03` 7.2c and 8 (the stop route, `job.not_running`), `26` 3.11, `38` 4.4 (replace "`Stop` stays disabled with `A sync cannot be cancelled.`"), `28` 9 (`stopped`). Tests: backend (stop mid-check with a gated `fetch`: ends `Stopped`, earlier statuses stay, `last_run_at` recorded; resume checks only remaining streams first and re-downloads no logo cached under 7 days; stop on an idle job `409`, on a catalog job `422`; the scheduler does not restart a stopped job early; shutdown aborts) and admin (stop bulk plan and reasons, `Resume` label after a stop, the `stopped` word, statusbar enable logic, the `jobs.stop` flow). Waves: W2 adds the abort plumbing, `stop(job)`, the route and the error entry; W3 adds the strip verb, Run group, state word and statusbar change.

Acceptance (real stack): start a playlist job and `Stop` enables; press it within seconds and after `Refresh` the row reads `stopped` with `Stopped: N of M streams checked`; Channels shows `live`/`dead` on checked rows and `not checked` on the rest; the Run group offers `Resume`, and its outcome counts only the remaining work with 0 logos re-downloaded; the statusbar `Stop` is enabled while a playlist job runs and disabled `Nothing is running.` otherwise; the schedule is unchanged and the job does not fire again until its interval passes.

Not built: stopping a catalog job (`title-sync.ts` `runNow` has no cancellation hook), a "paused with saved cursor" state (the oldest-first ordering and the logo recheck window already do it), stopping on `Disable`.

### 3.5 Behaviour by source

| Source | Re-read | Logos | Status |
|---|---|---|---|
| Uploaded file | never | yes | yes |
| URL, body hash unchanged | skipped (one GET) | yes | yes |
| URL, body changed | import (create and update) | yes | yes |
| URL unreachable | outcome notes it | still runs | still runs |

Removing a channel is the owner's act: filter `Stream status = Dead`, `Select all M matching`, `Delete`.

### 3.6 Planner fixes

Own-playlist pool (`playlist_id = id` only: every imported channel has its parent, enforced by the 022 backfill below and by the import writing it; no `source = host` fallback); no `vanished`/`kept` (`SyncPlan` is `{ creates, updates }`); `mergeEntry` resets `logo_file` and `logo_checked_at` when `logo_url` changes; new channels still created `enabled: false`.

### 3.7 How logos reach the screens

- **Admin:** the Channels workspace `Logo` row and playlist counts render `<img src={cachedLogoUrl}>`; same-origin with the backend in production; in development the Vite proxy already forwards `/logos` (`vite.config.mts:35`).
- **Desktop interface and fileserver: out of scope** (owner, 2026-10-18). The backend publishes `cachedLogoUrl` and `status` on its channel answers and nothing in this plan changes how the fileserver or the interface consume them.

## 4. UI wiring (every surface)

### 4.1 Admin app

**Playlists tab -> Index -> `New playlist` group** (`28`, `38` 3.2)

| Control | Detail |
|---|---|
| `Source` | `Segmented`: `File` \| `Web address` (a one-of choice). |
| File row (new `components/records/FileRow.tsx`, modelled on `FolderRow.tsx`) | Label `File`, a read-only mono field showing the chosen filename, trailing ghost `Choose file` button with the `Upload` icon, opening a hidden `<input type="file" accept=".m3u,.m3u8,audio/x-mpegurl">`. |
| Address row (existing) | `type=password`, `autoComplete=off`, only for `Web address`. |
| Name field | **Removed.** The name is the filename or the host; rename in the workspace Details. |
| Commit | Primary `Import` via `NewRecordGroup create.label`. Disabled reasons: `Choose a file first.`, `Address is required.`, `Importing.`, or the unreachable sentence. |
| Success notice | `Imported us.m3u: 2,598 channels, all disabled. Enable them on the Channels tab.` |

Files changed: `NewPlaylistForm.tsx`, `lib/playlist-draft.ts` (source, `File`), `constants/playlist-copy.ts`, `services/playlists.ts` (`importFile(file)`; `create` keeps its RecordService slot and is the URL import), `schemas/playlist-schema.ts`, `services/playlist-flows.ts` (import flow, then `markStale("channels")` and `markStale("jobs")`), `hooks/usePlaylistActions.ts`. The multipart path needs a shared change: `shared/http/src/{create-api,request-types}.ts` gains a `form?: FormData` option that sends no JSON content type, and `admin/src/services/session-api.ts` `CallOptions` gains `"form"`; a test goes in `shared/http/test`.

**Playlists tab -> list** (`PlaylistRows.tsx`, `PlaylistRow.tsx`, `playlist-grid.ts`, `playlist-rows.ts`): columns `name`, `source` (masked host or file name), `channels`, `enabled`, `live`, `dead`, `last synced`, `state`. Bulk verbs (`Sync now`, `Enable`, `Disable`, `Delete`) unchanged; `Sync now` now always finds its job. The armed `Delete` asks `Delete <name> and its N channels?` (N from the row's channel count) and removes the playlist, its channels and its jobs together (`DELETE /api/playlists/:id`, 3.2); its disabled-reason tooltips say nothing about keeping channels any more.

**Playlists tab -> workspace** (`PlaylistStatusGroup.tsx`, `PlaylistDetailsGroup.tsx`): `Status` shows Host, Kind, a counts line (`2,598 channels · 0 enabled · 1,904 live · 640 dead`) and an `InlineLink` `Show channels` that sets the Channels query to this playlist and calls `requestTab("channels")`. Last synced and Outcome stay. `usePlaylistChannels.ts` is deleted. For a file playlist, `Replace` is disabled with the reason `A file playlist has no web address. Import the file again.`

**Jobs tab** (`JobRunGroup.tsx`, `JobLastRunGroup.tsx`, `job-counts.ts`, `job-draft.ts`, `job-body.ts`, `job-copy.ts`, `job-flows.ts`): `Run` loses `Dry run` and `Prune`; `Run job` stays. The notice is `Started Sync <name>.`; the row shows `running` and the statusbar `N syncing`; the result appears on `Refresh`. `Last run` shows the new counts and `source`. `NewJobForm` is unchanged (a playlist job needs only the playlist select).

**Channels tab** (`41`, `36`)

| Piece | Change |
|---|---|
| List | New `stream` column (`channel-grid.ts`, `channel-rows.ts`, `ChannelRow.tsx`) with a state word: `live`, `dead` or `not checked`. Add `dead` (tone failed) and `unchecked` (faint) to `row-state.ts`; update `28` 9's word list. Live-kind rows leave it blank. |
| Filters | `ChannelQueryRow.tsx` gains two `QuerySelect`s: `Stream status` (Any status, Live, Dead, Not checked) and `Playlist` (All playlists, then names via the playlists service; at most 20). Update `lib/channel-query.ts` (`status`, `playlist`, `queryKey`, `pagePath`, `withFilter`) and `constants/channel-query-copy.ts`. |
| Bulk | `Enable`/`Disable` for stream rows go through the new bulk call in 500-id chunks: new `services/channel-enable.ts` (about 60 lines) chunks the call, builds an outcome, reuses `bulkSummary` for one notice, sets the statusbar work count and ends with the existing `reread`. `useChannelBulk.ts` branches on verb. `Rebuild` and `Delete` keep the existing runner; live-kind ticked rows use the existing single `PATCH`. |
| Workspace | `StreamStatusGroup.tsx` adds `Stream` (the word), `Checked` (time) and `Logo` (a 56px box with the cached image, glyph fallback). |
| Types | `types/admin-channel.ts`, `schemas/channel-schema.ts` (`status`, `checkedAt`, `cachedLogoUrl`), `services/channels.ts` (`setEnabled(ids, enabled)`). |

### 4.2 Desktop interface and fileserver: not touched

Owner, 2026-10-18: none of these features touch the frontend or the fileserver. This plan changes the admin backend and the admin app only. `src/frontend` and `src/fileserver` are not edited; the fileserver keeps probing and caching exactly as it does today.

### 4.3 Per-surface acceptance

Real stack (`npm run dev`), Chrome at 1600x1000 and 900x640, dark and light. Use a throwaway 3-entry file and a throwaway URL, not the owner's `us.m3u`; delete the throwaway playlist and its channels afterwards; never touch the owner's records without asking.

| Surface | Must be visible |
|---|---|
| Playlists -> New playlist | `Source` pills. File row with the `Choose file` ghost button and `Upload` glyph, showing the filename after choosing. `Import` disabled with its reason until a file is chosen or an address typed. No Name field. |
| Import by file | Within seconds, a notice with counts. A new Playlists row. Channels total rises by N, all disabled. A new `Sync <name>` job on the Jobs tab. |
| Re-upload of `playlists/us.m3u` | `created 0, updated 0`; Channels total stays 2,602 (2,598 + 4 live); same row ids. |
| Import by URL | Same; an unreachable or non-M3U address shows the field error and creates no row. |
| Playlists list and workspace | Counts columns. `Show channels` opens Channels filtered to that playlist. The Status group has no per-channel link list. |
| Jobs -> Run job | `running` and `1 syncing`. After `Refresh`, the outcome sentence and counts. No Dry run or Prune. |
| Channels | `stream` column words. `Stream status` and `Playlist` selects work with paging. Filter Live -> `Select all M matching` -> `Enable` completes in a few chunk calls (one `PATCH /api/channels` per 500), one notice, one audit entry per chunk. Workspace shows logo, `live`/`dead` and checked time. |
| Console and network | No failures. |

## 5. Remove / keep

**Delete** (`src/backend` unless noted): `services/playlist-store.ts`, the `stored` dependency in the three services, `readStoredPlaylist`; `api/playlist-sync.ts`, `registerPlaylistSync` in `app.ts`, `services.playlistSync.status`, `PlaylistSyncBodySchema`; from `playlist-service.ts` the `sync` dependency and the current `importStored` body; from `api/playlists.ts` the raw-text route; from `types/playlist.ts` `PlaylistImportQuerySchema`; from `app.ts` the `audio/x-mpegurl` content-type parser; from `playlist-sync-plan.ts` `vanished`, `kept` and the cross-playlist pool; in the sync service the dry-run and prune logic, per-entry enrichment, `removed`/`kept`; `JobRunSchema` `dryRun`/`prune` and `PlaylistJobConfig.dryRun/prune`. Admin: `hooks/usePlaylistChannels.ts`, the Name field in `NewPlaylistForm`, the `Dry run`/`Prune` toggles and copy. Tests that encode the rejected contract: `test/playlist-import.test.ts` (rewritten), the dry-run/prune/`playlist-sync` route cases in `playlist-sync.test.ts` and `playlist-sync-edits.test.ts`.

**Keep:** `m3u-parser.ts`; `playlist-fetch.ts` (`planEntries` exported, fetch rewritten to stream with a cap); `address-rule.ts`, `playlist-ref.ts`; `job-service.ts`, `sync-scheduler.ts`, `sync-seed.ts` (config shape only); `playlist-repository.ts`; the existing bulk machinery, `StateWord`, `RecordGrid`, `Segmented`, `ArmedButton`, `NewRecordGroup`. A shared `FileRow` is not justified until there is a second consumer.

**New backend files** (each at most 200 lines): `services/playlist-import.ts`, `services/logo-cache.ts`, `services/stream-check.ts`, `store/channel-health.ts` (column-targeted updates and queries; `channel-repository.ts` is already 164 lines), migration `022-playlist-health.sql`.

## 6. Migration and the owner's data (no destruction)

`022-playlist-health.sql`: add `channels.status` (with a CHECK), `checked_at`, `logo_file`, `logo_checked_at`; add `playlists.content_hash`; `CREATE INDEX channels_playlist ON channels (playlist_id)`; strip the removed flags from every existing playlist job (`UPDATE sync_jobs SET config = json_remove(config,'$.dryRun','$.prune') WHERE type='playlist'` - required, because `PlaylistConfigSchema` is `.strict()` and every later job update would otherwise fail); insert a `playlist` job (`Sync <name>`, `24h`, enabled, config `{playlistId}`) for each playlist that has none; **backfill the parent link**: every channel with `playlist_id IS NULL` and a `source` that matches exactly one playlist (its host, or its `stored:<name>` label) gets that `playlist_id`, so no imported channel is left without a parent (a channel whose `source` matches no playlist, or more than one, stays hand-made and is reported by the migration test).

The owner's rows: the 1 playlist and its 2,598 channels (`source = stored:us.m3u`, `enabled = 0`, null `tvg_id`) stay exactly as they are. New columns are NULL (not checked). Nothing is deleted. Kind derives as `file`. `data/playlists/us.m3u` is left on disk, inert. The new job is due at once: on the next start after the upgrade the backend runs a background pass (resolve and download logos, probe 2,598 streams within the 10-minute budget), visible on the Jobs tab - tell the owner. The backfill gives those 2,598 channels their parent link, so deleting that playlist later removes them with it.

## 7. Tests

Written by workers, run by the coordinator (`07` 6.3).

Backend (injected `fetch`, temporary `DATA_DIR`, no sleeping): `playlist-import.test.ts` rewritten (import creates the channels in the same request, all disabled, right audit entries; filename sanitizing; non-`.m3u` is `422`; re-import idempotent - same ids, one revision, a manual enable survives; oversize `400`; no session `401`; non-M3U `422` writes nothing; URL import success, unreachable creates no row, duplicate refused; the auto job exists; another playlist's channel is not taken). `playlist-sync.test.ts` rewritten (a file playlist never re-read; URL unchanged hash does not plan, changed hash updates and deletes nothing; an unreachable source still runs logos and status; logo cache write, dedupe by content, skip within 7 days, failure keeps the old file, GC; content-type and magic-byte refusal, size cap; status: live manifest, non-M3U body, timeout, a DNS or refused failure marks only that channel dead (no host shortcut), budget and ordering; column-targeted writes do not clobber a concurrent admin edit; the route does not await the run, single flight). A `logo-resolver` test (malformed row does not throw, failure persists a retry stamp). `channels-paging.test.ts` (`status`, `playlist` filters). `channel-enabled.test.ts` extended (`PATCH /api/channels`: stream rows, live ids skipped, one revision, 500 cap, `422`). A `/logos/<hash>` serving test (headers, traversal refusal). A delete test (deleting a playlist removes its channels and jobs in one transaction with one revision bump and one audit entry, leaves hand-made channels and other playlists' channels alone, aborts a running sync first, and GCs the cached images nothing references; a failure part-way rolls everything back). A migration test (the parent link is backfilled from `source`, an ambiguous or unmatched `source` stays hand-made, old job config cleaned, jobs backfilled, existing channel rows untouched). `jobs.test.ts` and `job-scheduler.test.ts` updated (`202` with `running`, no override body).

Admin: file-control markup and the `File` draft, import flows, the `form` option in `shared/http`, `channel-query` (`status`, `playlist`), `channel-enable` (chunking, partial failure, one summary), channel row and `stream` markup, job counts and the Run group, playlists list and status markup. No fileserver or interface tests change. Gate: `node scripts/check/gate.mjs` (`live-smoke.mjs` unaffected: live-kind and loopback streams only).

## 8. Docs first (W0, coordinator)

Rewrite before any code. Do not edit `docs/03` or `docs/26` until the other session has committed or discarded its diff to them (section 9).

| Doc | Change |
|---|---|
| `03` 7.2c | Rewrite wholesale: import (file, URL), the job and the sync steps, the logo cache, status, the secrecy rule, caps. |
| `03` 7.2 | `status`, `checkedAt`, `cachedLogoUrl`; `PATCH /api/channels`; the `admin-channels` params; `/logos/<hash>`. |
| `03` 7.9 | The `logo-cache` folder. |
| `03` 7.13, 8 | Audit actions (`playlist.imported`, `playlist.synced`, `channel.enabled_bulk`) and the codes table. |
| `26` 3.11 | Playlist and job definitions (no flags, auto-created job). |
| `26` 4.9c | The Playlists and Jobs surfaces. |
| `26` 3.3 | Table rows for the new routes. |
| `38` | A supersession banner. Rewrite 3.2, 3.3, 4.1-4.3, 6 and 7. |
| `41` | 3.1 params, 6 filters, 4.5 bulk. |
| `28` | 9 state words, and the Playlists, Jobs and Channels index rows. |
| `42` | Mark **superseded by 43** (its session owns it; see section 9). |
| `20` | An amendment note on F1 and F3 ("write-time only, no bytes" is superseded by the sync job; 9.1 and 9.2 are historical). |
| `01` | The exceptions in section 12, each dated and attributed to the owner. Docs RULES STAY: loosen nothing not listed. |

## 9. Conflicts with the other session

- **Uncommitted work (verified 2026-10-18).** Modified: `api/playlists.ts`, `app.ts`, `limits.ts`, `playlist-fetch.ts`, `playlist-ref.ts`, `playlist-service.ts`, `playlist-sync-plan.ts`, `playlist-sync-service.ts`, `service-registry.ts`, `types/playlist.ts`, three tests, `docs/03`, `docs/26`. Untracked: `playlist-store.ts`, `playlist-import.test.ts`, `docs/42`. `HEAD` has none of the stored-playlist code, so a worktree cut from `HEAD` lacks the planner's `enabled:false`, `planEntries` and `maskedHost`. `AGENTS.md` forbids the coordinator from staging or committing another person's changes. **Gate before W1:** that session commits its own WIP as a baseline, or confirms it is abandoned and hands the files over. Then cut worktrees.
- **Overlap.** That session is mid-rewrite of the same files this plan replaces. Two sessions must not edit them at once. This plan supersedes `42` sections 2-4; its rulings 1-5 are preserved.
- **`03` 7.2c and `26` 3.11** carry that session's text for the rejected design. W0 replaces it, so that session must commit or abandon its diff first.

## 10. Waves

Each wave is one worker in its own worktree. The coordinator lands each, runs the gate, drives the real stack, and runs `npm run dist:win`.

| Wave | Files | Acceptance |
|---|---|---|
| **W0 docs** (coordinator) | Section 8 list. | The owner answers section 12 and confirms the rule exceptions. |
| **W1 backend import** | Migration `022`; `playlist-import.ts`; `playlist-fetch.ts` (stream cap); `playlist-sync-plan.ts` (own pool, no vanished); `playlist-repository.ts`; `api/playlists.ts`; `playlist-service.ts`; `types/playlist.ts`; the auto job; `@fastify/multipart` in `app.ts`; the deletions in section 5; tests. | Import tests pass. Live: a multipart upload and a URL import answer in seconds with counts. A re-upload of `us.m3u` gives `0 created, 0 updated`; the total is unchanged. |
| **W2 backend sync, status, logos** | `playlist-sync-service.ts` rewritten; `logo-cache.ts`; `stream-check.ts`; `channel-health.ts`; `logo-resolver.ts` fixes; `job-runner.ts` (started, no flags); `job-service.ts`; `types/job.ts`; `api/live-streams.ts` (`/logos`); `channel-views.ts`; `channel-page.ts`; `PATCH /api/channels`; remove `api/playlist-sync.ts`; tests. | Sync tests pass. Live: a job run answers `202`; after `Refresh`: logos on disk, statuses set, `/logos/<hash>.png` returns the image. |
| **W3 admin Playlists and Jobs** (after W2) | `shared/http` `form`; the `session-api` option; the Playlists and Jobs files in 4.1; tests. | Section 4.3 rows for Playlists and Jobs. |
| **W4 admin Channels** (parallel with W3) | The Channels files in 4.1. | Section 4.3 Channels row, including `Select all M matching` -> `Enable` through chunks. |

W1 and W2 are sequential (same services). W3 and W4 can run in parallel once W2 lands. There is no fileserver or interface wave.

## 11. What is not built, and why

| Not built | Why |
|---|---|
| A stored copy of the uploaded file | Nothing reads it back. |
| A local path source, or an mtime or hash watcher | Upload copies the content; there is no external file to watch. |
| ETag or Last-Modified conditional GET | Body hash works on every host and the file is small. An optional later optimisation. |
| Prune, dry run, `kept`, `removed` | Dead status plus `Delete` over a filter replaces them. |
| `GET|POST /api/playlist-sync` | Duplicate of the jobs. |
| An SVG logo cache | A script-capable file served from the admin's origin. |
| A second shared `Upload` component | One consumer. |
| A bulk-by-filter endpoint | The resolved-id flow already exists. |
| Per-host rate limiting beyond 2 concurrent | Enough for politeness. |
| An SSRF filter for private addresses | Admin-supplied, same trust as the existing fileserver probe. |

## 12. Open questions for the owner

1. *(Resolved 2026-10-18: deleting a playlist deletes its channels and jobs with it, in one transaction - see 3.2. No orphans.)*
2. **Confirm the rule exceptions** (written into `01`): (a) the backend stores and serves logo bytes; (b) the backend accepts an M3U upload and keeps no copy; (c) the new `@fastify/multipart` dependency; (d) the `Upload` icon added to the icon table (source: LoRA Studio `ImagesGroup.tsx`).
3. *(Withdrawn 2026-10-18: the fileserver and the interface are out of scope, so the stored verdict is shown in the admin only.)*
4. **Confirm "ping" means a manifest GET per stream URL**, not a bare host reachability check.
5. **Confirm the first-run behaviour.** The backfilled job is enabled and runs at the next start.

**Decision (owner, 2026-10-18, "ok lets execute" - approval of the plan with its defaults; revisable):** Q1 deleting a playlist deletes its channels and jobs with it (no orphans); Q2 all four exceptions approved; Q3 withdrawn (no fileserver or interface work: the plan is the backend and the admin app only); Q4 "ping" is a manifest GET per stream URL; Q5 the backfilled job is enabled and runs at the next start. Stop and resume (3.4a) is in scope.

## 13. Risks

- A first-run burst of 2,598 pings and downloads: bounded by the budgets; consider lower first-run concurrency.
- A multi-minute run holding the single flight: other playlist jobs retry every second with `playlist.busy` and return quickly.
- A server that serves a non-image under an image content type: the magic-byte check covers it.
- Content-addressed logos are shared by many channels; a channel's `logo_file` does not pin the file; GC keeps any file still referenced.
- A large index download (two 8 MiB files) in step 3: at most once an hour on failure, once a day normally.
- `38` and `41` promised paging that the code does not implement (`usePlaylistChannels`); W3 closes it.
- A worker on W3 or W4 may be tempted to re-add a Name field or the toggles; the brief must quote section 4.1.
