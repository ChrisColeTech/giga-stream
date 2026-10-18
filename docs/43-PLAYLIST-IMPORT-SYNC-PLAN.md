# 43 - Playlist import, sync, logo cache and stream status (plan)

**Status: REVISED 2026-10-18 after a hostile review (v2); not yet re-approved.** Owner-approved scope and decisions stand
(2026-10-18); the review found six blockers and about two dozen should-fix items, all folded in below. No code is written
until the planning agent re-reviews this version and says "ready". Supersedes `42` sections 2-4 and keeps its rulings 1-5.
Docs before code (`07`).

**Scope (owner): the admin backend and the admin app only.** `src/frontend` and `src/fileserver` are not touched.
**This is an overhaul: nothing is kept because it exists today.** Where today's shape is wrong (no foreign keys, a parent
deletable under its children, `source` duplicating `playlist_id`, sentences stored as results, a global sync lock,
unguarded outbound requests) it is replaced, not carried over.

## 0. Verdict and decisions

- **Import is one request that creates the parent playlist and every channel, disabled.** A file arrives as multipart; a
  web address as JSON. Neither does per-channel network work.
- **Sync is one job per playlist, four steps:** (1) re-read a web source; (2) fill missing logo addresses from the
  iptv-org index; (3) cache the logo bytes on the backend; (4) check each channel's **own exact stream URL** for `live` or
  `dead`. A file playlist is never re-read (its upload was the read). Prune is gone.
- **A channel's verdict comes from its own URL only** (owner): a host check (ping, TCP, DNS) is never a verdict, no host
  shortcut.
- **Deleting a playlist deletes its channels and jobs** (owner): enforced by foreign keys, not by hope.
- **Every outbound request goes through one guarded function** (`safe-fetch.ts`, 3.8). Playlist content is untrusted.
- **Owner decisions (2026-10-18):** all four rule exceptions approved (logo cache and serving, M3U upload, multipart
  library, `Upload` icon); first-run pass at the next start; stop and resume in scope; scope as above.

## 1. Current code (A): findings that shaped this plan

Importer: wrong contract (raw text + typed name, `playlist-service` coupled to the sync); no file control and no
multipart anywhere (`shared/http` is JSON-only; the family pattern is LoRA Studio `ImagesGroup.tsx`, a hidden file input
behind a ghost `Upload` button); a web playlist has no import; a created playlist gets no job; the fetch reads the whole
body then truncates silently (`playlist-fetch.ts:42`); the planner matches across playlists and re-points `playlistId`
(`playlist-sync-plan.ts:62-72`).
Sync: per-entry await of logo lookups (`playlist-sync-service.ts`); `logo-resolver.ts` uses throwing `.parse` and never
persists a failed index load, so every entry re-downloads two 8 MiB files (the 313 s import); a playlist job is awaited
inside the HTTP request; outcome stamped on every target; no image bytes, no status.
Schema: `014-playlists-jobs.sql` gives `channels.playlist_id` no foreign key, jobs reference a playlist through
`json_extract(config,'$.playlistId')`, nothing is `UNIQUE` on `playlists`, `source` duplicates `playlist_id` and goes stale
on a PATCH, `kind` would be a `stored:` string prefix, results are free-text sentences, failure is inferred from a missing
field (`job-rows.ts:23-26`), `error.message` is stored verbatim (`playlist-sync-service.ts:124-127`).
Network: `address-rule.ts:16-21` accepts any `https` host including `https://127.0.0.1`, `10.x`, `169.254.x`, `[::1]`.
Admin: `usePlaylistChannels` reads the whole channel list and filters by host (`:30-31`); the playlist workspace renders
one link per channel (about 2,600 `li`); no stream health in the Channels list; bulk enable is one `PATCH` per channel.
The saved `playlists/us.m3u` has no `tvg-logo` and no `tvg-id` on any of its 2,598 entries, so logos come only from the
iptv-org index by name.

## 2. Judging docs/42 (B)

Keep its five rulings (import and sync are different; the import takes only the file; import is fast with no network work;
channels land disabled; docs before code), the re-import identity rule, the `planEntries` export and the 8 MiB cap. Drop its
stored copy (`playlist-store.ts`, `readStoredPlaylist`) and the claim that sync "enriches logos" only (it never produced
bytes). Missing from it: URL import, the file control, image caching, live/dead status, a job created with the playlist,
a single bulk enable call, the migration, and every integrity and security item in this version.

## 3. Target design (C)

### 3.1 Data model (real columns, real foreign keys)

Foreign keys are ON (`database.ts`) and are the integrity guarantee; the service wraps them in one transaction only for the
revision, the audit entry and the counts.

**`playlists`:** `id`; `name` (UNIQUE `COLLATE NOCASE`); `kind` (`'file'|'url'`); `url` (the secret web address, UNIQUE, only
when `kind='url'`); `file_name` (UNIQUE, only when `kind='file'`); `host` (only when `kind='url'`); `enabled`;
`created_at`. A CHECK ties `url`, `file_name`, `host` to `kind`. There is **no** `address`, `content_hash`,
`last_synced_at` or `last_outcome`: the last result lives on the playlist's one sync job. The uploaded file is not kept.

**`sync_jobs`:** adds `playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE`, a partial
`UNIQUE (playlist_id) WHERE playlist_id IS NOT NULL` (exactly one sync job per playlist), and `last_result`
(`'ok'|'failed'|'stopped'`). A playlist job's `config` is `{}` (the reference is the column, not JSON). `last_counts` is
validated against ONE zod union shared by backend and admin (a run's counts, or `{ code }` for a failure); **no sentence is
stored** - the admin words the result from the typed counts. A failed run stores a dotted code, never `error.message`.

**`channels`:** `playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE` (NULL = hand-made); `sync_name` (NOT NULL
when `playlist_id` is set); `tvg_id`; `edited_fields`; `enabled`; `logo_url`; and the **sync-owned** columns `status`
(`'live'|'dead'|NULL`, NULL = not checked), `checked_at`, `logo_file`, `logo_checked_at`. The **`source` column is removed**:
the wire field `source` is derived from the playlist join (its host, or its file name), so it can never go stale, and two
playlists on one host no longer share a filter. The channel repository's whole-row `update` never writes the sync-owned
columns; only the sync's targeted writes do (3.4).

Channel identity: the same stream URL may appear in two playlists (two rows, one per parent); within a playlist a
channel is `(sync_name, stream_url)`.

Wire: `GET /api/admin-channels` rows gain `status?`, `checkedAt?`, `cachedLogoUrl?` (the **relative** `/logos/c/<file>`;
the admin is same-origin; no Host-derived URL). The **public** `GET /api/channels` is unchanged. `logoUrl` stays the source
address everywhere, and an admin form never reads the cached address back into it. `PlaylistView`:
`{ id, name, kind, host?, masked?, fileName?, enabled, channels, enabledChannels, live, dead, lastRunAt?, lastResult?, lastCounts? }`
(the job's values joined in). **Precedence of the three `enabled` switches:** a channel is published when
`channel.enabled` and (it has no playlist, or `playlist.enabled`). `playlist.enabled = false` stops that playlist's sync,
manual and scheduled. `job.enabled = false` stops only the scheduled run; a manual run needs an enabled playlist, not an
enabled job. (`schedule: "off"` and `enabled=false` are the same effect; `enabled` is the switch the admin shows.)

**Image cache:** `DATA_DIR/logo-cache/`, files named `<first 32 hex of sha256(bytes)>.<ext>` (extension chosen from the
magic bytes, never from the upstream header), served at `/logos/c/<file>` (a separate prefix, so a live-channel id can never
collide with a hash name). Accepted only if `image/*`, PNG/JPEG/GIF/WebP magic bytes, at most 1 MiB, and (PNG header read)
at most 4096 px a side. SVG is never cached. An identical image is stored once; an existing file is not rewritten.
**Garbage collection** runs only inside a sync's single flight (never in a delete handler), skips files younger than one
hour, and a row whose `logo_file` is missing on disk is re-downloaded regardless of `logo_checked_at`.

**Secrets in URLs.** The web address lives only in `playlists.url`. Reads show `host` and `masked`; audit, error details and
logs carry the **host only**; the fetch is the only reader; never a logo address in a log; never `error.message` of a fetch
in an outcome, audit entry or log (map to a fixed code). Refusal examples carry the entry **name and host only**, never the
full stream URL. A stream URL from a credentialed playlist is itself a credential: it is published by the public channel
read, so such a playlist should not be imported into a published channel list (documented in `03`).

### 3.2 Import and playlist routes

Signed in, audited, dotted codes. A duplicate (same `url`, same `file_name` or same name, case-insensitive) is
`409 playlist.taken`; `playlist.invalid` is for content only; `playlist.*` always means an M3U record, never a live
channel's video list.

| Route | Request | Answer |
|---|---|---|
| `POST /api/playlists/import` | `multipart/form-data`, exactly one `file` part. Registered with `limits: { files: 1, fields: 0, fileSize: 8 MiB, headerPairs: 20 }`; read with `toBuffer()`, `truncated` or a second file part is `400 request.invalid` | `201` new, `200` replaced: the `PlaylistView` + `created` + `imported { created, updated, skipped, refused, refusalExamples }` |
| `POST /api/playlists` | JSON `{ url, name?, enabled? }`: the web-address import | `201`, same answer |

Order (both): **read and parse first, no database write** (a URL import fetches once through `safe-fetch`, 15 s, 8 MiB
hard cap that is an error, never a truncation); then ONE synchronous transaction: duplicate check, insert the playlist (a
file whose `file_name` exists updates that playlist), the channel plan and writes, the playlist's sync job, one revision bump
**only if rows changed** (a re-import with nothing new writes nothing and bumps nothing), one audit `playlist.imported`
(counts and host). A fetch failure or a non-M3U body creates nothing (`503 playlist.unreachable` / `422 playlist.invalid`).
The `UNIQUE` columns close the concurrent-import case: the loser is `409 playlist.taken`. After the commit the service calls
`onChange` so the new job arms. The file name rule: basename, NFKD with diacritics stripped, lowercase, runs of anything but
`a-z0-9._-` become `-`, must end `.m3u`, an all-non-ASCII stem is `422 playlist.invalid` (field `file`); the client file name is
never a path (nothing is stored). M3U detection: `#EXTM3U` as the first non-empty line (after a BOM), or an `#EXTINF` within
the first 20 lines (an HTML page that merely mentions the word fails).

Entry rules: every `streamUrl` **and `logoUrl`** passes the address rule (`03` 7.3, now including the public-address rule)
and `ADDRESS_MAX`; an entry that fails is skipped and counted; names are NFC-normalised at parse; at most `PLAYLIST_SYNC_MAX`
(5000) entries.

`GET /api/playlists`, `GET /api/playlists/:id`. `PATCH` renames or enables; `url` may be replaced only for `kind='url'`
(`422 playlist.invalid`, field `url`), which is for rotating a token on the same list: its channels stay (no prune) and show
dead if they no longer exist.

**`DELETE /api/playlists/:id`** aborts a running sync for it and awaits its settle (at most 10 s), then deletes the playlist
and, through the foreign keys, its channels and its sync job, in one transaction: one revision bump, one audit
`playlist.deleted { channels, jobs, host }`, answer `{ id, deletedChannels, deletedJobs }`. Hand-made channels and other
playlists' channels are untouched. Cached images are left for the next run's garbage collection. The admin's armed `Delete`
reads `Delete <name> and its N channels?` (and says how many carry admin edits).

### 3.3 Channels and bulk

| Route | Change |
|---|---|
| `PATCH /api/channels` | **New** bulk: `{ enabled, ids[] }`, 1-5,000 ids (about 210 KB, under `CHANNEL_BODY_LIMIT_BYTES`); **no client chunking**. Stream rows only; live-kind ids counted in `skipped`. One transaction, one revision, one audit entry `channel.enabled_bulk`. Answers `{ changed, skipped }`. Invalid body `422 channel.invalid` (field `ids`). |
| `GET /api/admin-channels` | Adds `status` (`live|dead|unchecked`) and `playlist` (id) filters in `store/channel-page.ts`; `source` filter now joins the playlist. Search `q` also matches the playlist name. |
| `GET /logos/c/<file>` | Serves a cached image; name must match `^[0-9a-f]{32}\.(png|jpg|gif|webp)$`; public, `immutable`, `nosniff`; no traversal possible. Live PNG ids at `/logos/<id>.png` are unchanged. |
| `GET|POST /api/playlist-sync` | **Removed.** |

Any write that changes a channel's `stream_url` or `logo_url` (an admin edit, a re-import) resets the dependent sync-owned
columns in the same statement (`status`, `checked_at` for a URL change; `logo_file`, `logo_checked_at` for a logo change).

### 3.4 The job and the sync algorithm

Job types stay `playlist` and `catalog`. `POST /api/jobs/:id/run` for a playlist job is **started, not awaited**: `202` with
`running: true`; the result is read on a refresh. A playlist job's schedule must be at least **15 minutes**
(`422 job.invalid`, field `schedule`). A playlist job is created only by an import (`NewJobForm` creates catalog jobs only).
The first pass after the migration starts after the server is listening, never during boot.

Limits (named constants): run wall clock 30 min; probe budget 10 min; logo fetch 10 s, 1 MiB, 8 at a time; stream check
5 s, first 64 KiB, 16 at a time overall; playlist fetch 15 s.

**Single flight is per playlist** (`409 sync.busy`); a shared semaphore bounds total concurrency across playlists.

1. **Claim** the playlist's flight. Refuse a disabled playlist (`422 job.disabled`). A disabled job refuses only the
   schedule.
2. **Re-read.** `file`: skip. `url`: fetch through `safe-fetch` on **every** run and pass the text to `importText`, which
   writes only if its plan is non-empty (create and update, never delete). A fetch failure is `source: unreachable` in the
   counts (the run is still `ok`) and the run goes on.
3. **Resolve missing logo addresses** for this playlist's rows with no `logo_url` and no edited `logoUrl`: load the iptv-org
   index once per run through `safe-fetch` (`safeParse`, a bad row is skipped, a failed load is stamped on disk and retried
   after one hour), look up by `tvgId` then by name (accents folded before stripping, so `Télé` is `tele`), set `logo_url`
   with a compare-and-set.
4. **Cache logos:** distinct `logo_url`s whose `logo_checked_at` is NULL or older than 7 days, or whose `logo_file` is
   missing on disk. Download through `safe-fetch`, validate (3.1), hash, write `<hash>.<ext>` atomically (temp + rename) if
   absent, then `UPDATE ... WHERE id = ? AND logo_url = ?` to set `logo_file`/`logo_checked_at`. A failure sets
   `logo_checked_at` only. Then garbage-collect (3.1).
5. **Check streams** of this playlist, enabled or not, ordered `checked_at IS NOT NULL, checked_at, id` (a total order, so the
   same subset is never starved). Each distinct stream URL is requested through `safe-fetch`: `live` if 2xx and the body,
   after stripping a BOM and whitespace, starts `#EXTM3U`; anything else, including a DNS or refused failure **on that URL**,
   is `dead` for that channel only (a non-HLS stream is therefore `dead`; the word's tooltip says "no HLS manifest"). Every
   write is `UPDATE ... WHERE id = ? AND stream_url = ?` (a channel edited or deleted mid-run is skipped, bumps nothing),
   column-targeted (`status`, `checked_at`), in batches of 200 per transaction; **each batch takes its own
   `revisions.next()` only if it changed a row** and stamps those rows. When the probe budget ends the rest stay unchecked
   and go first next run.
6. **Record** on the job: `last_run_at`, `last_result`, and the typed `last_counts` `{ created, updated, skipped, refused,
   source: "unchanged"|"updated"|"file"|"unreachable", logosCached, logosFailed, live, dead, unchecked, refusalExamples }`
   (or `{ code }` when failed). One audit `playlist.synced` (counts and host, `stopped` when it was). The admin words the
   sentence (`Synced: 312 logos cached, 1,904 live, 640 dead.`) from these.

### 3.4a Stop and resume (playlist jobs only)

**Stop** cancels the run in progress and keeps everything already written. **Resume** is the same job run again; the sync
is resumable by construction (step 5's order, step 4's 7-day window, step 2 is one transaction). No resume state. **Pausing
the schedule** is the job's `Enabled` toggle and bulk `Disable`; disabling does not stop a run in progress, `Stop` does.

| Item | Detail |
|---|---|
| Route | `POST /api/jobs/:id/stop`, signed in, audited `job.stopped`, `202`; `running: true` until the next check (seconds: in-flight requests abort). `409 job.not_running` when idle; `422 job.invalid` for a catalog job. |
| Plumbing | `job-runner.ts` keeps an `AbortController` per running job and `stop(job)`; the sync passes a `signal` to every `safe-fetch` (combined with each timeout via `AbortSignal.any`); app shutdown aborts every run. |
| Record | `last_run_at` = the stop time, `last_result='stopped'`, partial counts with `stopped: true`; the scheduler therefore does not fire it early (a never-run job is due at once, `sync-scheduler.ts:177`); unchecked streams wait for the next interval unless Resume is pressed. |

Admin: Jobs strip gets a bulk `Stop` verb (ghost, `CircleStop`, always drawn, disabled reasons `Tick a job first` / `That job
is not running.` / `A catalog sync cannot be stopped.`); a `stopped` row word (faint); the workspace `Run` group gets a ghost
`Stop` beside `Run job`, which reads `Resume` after a stop; `Last run` shows the typed counts; the statusbar `Stop`
(today disabled `A sync cannot be cancelled.`, `record-copy.ts:30`, `running-work.ts:26`) is enabled while a playlist job
runs. Not built: stopping a catalog job (no cancellation hook in `title-sync.ts`).

### 3.5 Behaviour by source

| Source | Re-read | Logos | Status |
|---|---|---|---|
| Uploaded file | never | yes | yes |
| Web address | every run (writes only if changed) | yes | yes |
| Web address unreachable | counts say so; run goes on | yes | yes |

A channel the owner does not want is **Disabled** (the `Dead` filter, `Select all M matching`, `Disable`). A hand `Delete`
removes it only until the playlist next lists it (an import or sync re-creates a listed entry); the `Delete` tooltip says so.

### 3.6 Matching (planner)

Within this playlist's rows only (`playlist_id = id`), three passes over unused rows: (1) exact `(sync_name, stream_url)` =
unchanged; (2) `sync_name` alone when unique among the leftovers = a moved URL; (3) `stream_url` alone = a renamed entry.
`tvgId` is a tie-breaker only. No `vanished`, no `kept`. New channels are created `enabled: false`. When `logo_url` changes
the planner clears `logo_file` and `logo_checked_at`.

### 3.7 Logos on screen

The admin renders `<img src={cachedLogoUrl}>` (relative, same-origin; the Vite proxy forwards `/logos`, `vite.config.mts:35`).
The desktop interface and fileserver are out of scope and unchanged.

### 3.8 One guarded outbound function (`safe-fetch.ts`)

Every remote request the backend makes (a playlist, the logo index, a logo, a stream check) goes through it and nothing
else calls `fetch` on a remote address: `https` only, no userinfo, the backend **resolves the name itself and connects to
the checked address** (a private, loopback, link-local, CGNAT or unique-local address is refused unless
`ALLOW_LOOPBACK_STREAMS`, the dev exception; this also defeats DNS rebinding), `redirect: "manual"` with at most 3 hops each
re-validated, decoded-byte caps enforced while streaming, no cookies, a fixed User-Agent, an injected resolver for tests.
Reason: the stream and logo URLs are third-party content fetched from the backend's own network position, and the backend may
be exposed to a LAN or the internet (`03` 7.10); without this a hostile playlist is a port scanner (live/dead is the oracle)
and a logo URL pointing inward is cached and served publicly.

## 4. UI wiring (admin app only)

### 4.1 Admin app

**Playlists tab -> Index -> `New playlist` group** (`28`, `38` 3.2)

| Control | Detail |
|---|---|
| `Source` | `Segmented`: `File` \| `Web address` (a one-of choice). |
| File row (new `components/records/FileRow.tsx`, modelled on `FolderRow.tsx`) | Label `File`, a read-only mono field showing the chosen filename, trailing ghost `Choose file` button (`Upload` icon) opening a hidden `<input type="file" accept=".m3u,.m3u8,audio/x-mpegurl">`. |
| Address row (existing) | `type=password`, `autoComplete=off`, only for `Web address`. |
| Name field | **Removed**: the name is the file name or the host; rename in the workspace Details. |
| Commit | Primary `Import` through `NewRecordGroup create.label`. Disabled reasons: `Choose a file first.`, `Address is required.`, `Importing.`, or the unreachable sentence. |
| Notice | `Imported us.m3u: 2,598 channels, all disabled. Enable them on the Channels tab.` |

Files: `NewPlaylistForm.tsx`, `lib/playlist-draft.ts`, `constants/playlist-copy.ts`, `services/playlists.ts` (`importFile(file)`;
`create` is the web-address import), `schemas/playlist-schema.ts`, `services/playlist-flows.ts` (import flow, then
`markStale("channels")` and `markStale("jobs")`), `hooks/usePlaylistActions.ts`. Shared: `shared/http/src/{create-api,
request-types}.ts` gains `form?: FormData` (no JSON content type); `admin/src/services/session-api.ts` `CallOptions` gains
`"form"`; a test in `shared/http/test`.

**Playlists list** (`PlaylistRows`, `PlaylistRow`, `playlist-grid.ts`, `playlist-rows.ts`): columns `name`, `source` (masked
host or file name), `channels`, `enabled`, `live`, `dead`, `last run`, `state`. Bulk verbs (`Sync now`, `Enable`, `Disable`,
`Delete`) unchanged in grammar; `Sync now` always finds its job; the armed `Delete` asks `Delete <name> and its N channels?`.

**Playlist workspace** (`PlaylistStatusGroup`, `PlaylistDetailsGroup`): `Status` shows Host, **Source type** (`File` or `Web
address`), a counts line (`2,598 channels · 0 enabled · 1,904 live · 640 dead`), the last run and its words (from the typed
counts). The workspace **toolbar** carries the forward verb `Channels →` (disabled `This playlist has no channels.`; sets the
Channels query to this playlist); there is no in-body link list. `usePlaylistChannels.ts` is deleted. For a file playlist the
address `Replace` is disabled `A file playlist has no web address. Import the file again.`

**Jobs tab:** `Run` loses `Dry run` and `Prune`; `Run job` stays (relabelled `Resume` after a stop) with `Stop` (3.4a); the
notice `Started Sync <name>.`; `Last run` shows the typed counts and `source`; `NewJobForm` creates **catalog jobs only**
(the playlist selector and playlist job type are removed from it).

**Channels tab** (`41`, `36`): a `stream` column word `live`, `dead` or `not checked` (one wording everywhere; live-kind rows
blank; add `dead` failed tone and `not checked` faint to `row-state.ts`, update `28` 9); `ChannelQueryRow` gains `Stream
status` (Any status, Live, Dead, Not checked) and `Playlist` (All playlists, then names, at most 20) selects
(`lib/channel-query.ts`, `constants/channel-query-copy.ts`); bulk `Enable`/`Disable` for stream rows is **one**
`PATCH /api/channels` (`services/channels.ts setEnabled(ids, enabled)`, `useChannelBulk.ts` branches on verb; `Rebuild` and
`Delete` keep the runner); the workspace `StreamStatusGroup` adds `Stream` (the word), `Checked` (the time, so a stale
verdict is visibly stale) and `Logo` (56px box, glyph fallback).

### 4.2 Not touched

`src/frontend` and `src/fileserver`.

### 4.3 Per-surface acceptance

Real stack (`npm run dev`), Chrome at 1600x1000 and 900x640, dark and light, with a throwaway 3-entry file and URL (never
the owner's `us.m3u`; delete the throwaway playlist afterwards - it removes its channels).

| Surface | Must be visible |
|---|---|
| New playlist | `Source` pills; the file row with `Choose file` and `Upload` glyph and the filename after choosing; `Import` disabled with its reason until a file is chosen or an address typed; no Name field. |
| Import by file | Within seconds a notice with counts; a new Playlists row; Channels total rises by N, all disabled; a `Sync <name>` job on Jobs. |
| Re-upload of `playlists/us.m3u` | `created 0, updated 0`; no revision bump; Channels total unchanged; same row ids. |
| Import by URL | Same; an unreachable, non-M3U or **private-address** URL shows the field error and creates no row. |
| Delete a playlist | The armed question names the channel count; confirming removes the row, its channels and its job together. |
| Playlists list and workspace | Count columns; `Channels →` opens Channels filtered to that playlist; no per-channel link list. |
| Jobs | `Run job` shows `running` and `1 syncing`; `Stop` works and the row reads `stopped`; `Resume`; no Dry run or Prune. |
| Channels | `stream` words; `Stream status` and `Playlist` selects with paging; Filter Dead, `Select all M matching`, `Disable` is one `PATCH /api/channels` with one notice; the workspace shows logo, word, checked time. |
| Console and network | No failures. |

## 5. Remove / keep

**Delete** (`src/backend` unless noted): the stored-playlist concept wherever it exists; the raw-text import route and its
content-type parser; `api/playlist-sync.ts`, `registerPlaylistSync`, `services.playlistSync.status`,
`PlaylistSyncBodySchema`; the `sync` dependency of `playlist-service.ts`; `vanished`, `kept`, the cross-playlist pool, dry-run
and prune logic, per-entry enrichment, `removed`/`kept` counts; `JobRunSchema` `dryRun`/`prune`,
`PlaylistJobConfig.dryRun/prune`; `playlists.address|content_hash|last_synced_at|last_outcome`; `channels.source`;
`playlist.busy`; `PLAYLIST_URLS`, `PLAYLIST_SYNC_SCHEDULE`, the playlist half of `sync-seed.ts` and `config.ts`
`playlistUrls` (the catalog seed stays); `job-counts.ts`'s defensive reading of untyped counts. Admin:
`usePlaylistChannels.ts`, the Name field, the `Dry run`/`Prune` toggles and copy, the playlist type in `NewJobForm`. Tests that
encode the rejected contract.

**Keep:** `m3u-parser.ts` (with the stricter M3U detection), `planEntries` (exported), `address-rule.ts` (extended with the
public-address rule), `job-service.ts`, `sync-scheduler.ts`, `playlist-repository.ts` (reshaped), the existing bulk
machinery, `StateWord`, `RecordGrid`, `Segmented`, `ArmedButton`, `NewRecordGroup`.

**New backend files** (each at most 200 lines): `services/safe-fetch.ts`, `services/playlist-import.ts`,
`services/logo-cache.ts`, `services/stream-check.ts`, `store/channel-health.ts` (the sync's targeted compare-and-set
writes), migration `022-playlist-model.sql`, one shared zod union for run counts.

## 6. Migration and the owner's data (no destruction)

`022` is flagged as **rebuilding**: `migrate.ts` first writes `VACUUM INTO 'admin.db.pre-022'` and, after the migration, runs
`PRAGMA foreign_key_check` and fails if it returns rows. Steps, in one transaction:
1. Rebuild `playlists` with the new columns: `stored:<n>` becomes `kind='file', file_name=<n>`; a web address becomes
   `kind='url', url, host`; a clashing name gets ` (2)`.
2. Add `sync_jobs.playlist_id` (cascade) and `last_result`; backfill `playlist_id` from
   `json_extract(config,'$.playlistId')` **guarded by `json_valid(config)`**; delete playlist jobs whose playlist no longer
   exists; keep the lowest-id job when a playlist has several; carry the old playlist `last_*` into its job when the job has
   none; create a job (`WHERE NOT EXISTS`, not `NOT IN`) for every playlist without one (`Sync <name>`, `24h`, enabled);
   set playlist-job `config='{}'`; then add the partial `UNIQUE`.
3. Rebuild `channels` with the foreign key and CHECKs, **preserving `channel_videos`** (`008-live-channels.sql:43` makes
   `channel_videos` reference `channels ON DELETE CASCADE`, so a naive `DROP TABLE channels` would silently delete every live
   channel's video list): copy `channel_videos` to a temporary table, create `channels_next`, copy rows, backfill
   `playlist_id` (a channel whose `source` matches no playlist or more than one becomes **hand-made**: `playlist_id`,
   `sync_name`, `edited_fields` cleared in the same statement; the migration test reports them), drop `channels`, rename,
   restore `channel_videos`, drop the temporary table. The test runs on a fixture holding live channels with videos: row counts
   of `channels` and `channel_videos` are equal before and after.

The owner's 1 playlist and 2,598 channels (`source = stored:us.m3u`, disabled, no `tvg_id`) survive: the playlist becomes
`kind='file', file_name='us.m3u'`, the channels get their `playlist_id` (so deleting that playlist later removes them), new
columns are NULL (not checked), and `data/playlists/us.m3u`, if present, is left on disk, inert. The new job is due at once;
the first pass (logos, then 2,598 stream checks within the 10-minute budget) starts after the server is listening and is
visible on the Jobs tab - tell the owner.

## 7. Tests

Written by workers, run by the coordinator (`07` 6.3). Injected `fetch`/resolver, temporary `DATA_DIR`, no sleeping.

**Backend:** `safe-fetch` (public-address rule for IPv4/IPv6 private, loopback, link-local, CGNAT, ULA; the dev exception; a
redirect to a private address refused; hop cap; byte cap while streaming; userinfo refused; DNS answering a private address
refused). `playlist-import` (creates all channels disabled in the same request; the transaction order; duplicate `url`,
`file_name` and name, and a concurrent double import: one wins, the other `409 playlist.taken`; a fetch failure writes
nothing; re-import is idempotent with no revision bump and a manual enable survives; filename sanitising incl. diacritics;
oversize, second file part, `truncated`, no session, non-M3U incl. an HTML page that mentions `#EXTM3U`; logo address rule;
refusal examples carry no URLs; NFC names). Matching (three passes: reordered entries do not swap streams; duplicate
tvg-ids; rename; moved URL; another playlist's channel is not taken). A delete test (cascade removes channels and job,
leaves hand-made and other playlists' channels, awaits an aborted run, one revision, one audit, rollback on failure). A
foreign-key test (deleting a playlist outside the service still cascades; `foreign_key_check` clean). Sync (a file playlist is
never read; a URL playlist is re-fetched and writes nothing when unchanged; unreachable still runs steps 3-5; logo cache write,
dedupe, 7-day skip, a missing file re-downloads, GC skips young files, magic-byte and size and 4096 px refusals; the stream
check live, non-M3U body, BOM, timeout; per-URL verdicts with no host shortcut; compare-and-set skips a channel whose
`stream_url` changed mid-run and bumps nothing; each batch takes its own revision; ordering is total; per-playlist flight;
schedule floor 15 min; run not awaited by the route). Stop and resume (stop mid-check with a gated `fetch` ends `stopped` with
earlier verdicts kept; resume checks the remaining first and re-downloads no cached logo; idle `409`; catalog `422`; the
scheduler does not restart a stopped job; shutdown aborts). `logo-resolver` (a malformed row does not throw; a failure
persists a retry stamp; accents folded). `channels-paging` (`status`, `playlist`). Bulk (`PATCH /api/channels`: stream rows, live
ids skipped, one revision, 5,000 cap, `422`). `/logos/c/<hash>` serving (headers, traversal refusal). Migration (fixture with
live channels and videos: counts equal; backfill of `playlist_id`; ambiguous `source` becomes hand-made and is reported; jobs
deduped and backfilled; `json_valid` guard; backup file written; `foreign_key_check` clean; user_version 22). Jobs/scheduler
tests updated (`202` with `running`, no flags).

**Admin:** file-control markup and the `File` draft, the import flows, `shared/http` `form`, `channel-query`, the single-call
bulk enable, channel row and `stream` markup, job counts words from typed counts, `NewJobForm` catalog-only, the Run group
(`Stop`, `Resume`), the playlists list and workspace markup (`Channels →`, `Source type`, delete question).

**Gate:** `node scripts/check/gate.mjs`.

## 8. Docs first (W0, coordinator)

Done 2026-10-18 for v1 and **to be re-applied for v2**: `03` 7.2c, 7.2 (channel fields), 7.3 (the public-address rule), 7.9
(foreign keys, `logo-cache`), 7.13 and 8 (codes: add `playlist.taken`, remove `playlist.busy`); `26` 3.11 (fields,
precedence, seeding) and 4.9c; `38` supersession (done); `41` 3.1 and 4.5 (done, one call not chunks); `28` 9 words; `20`
amendment (done); `01` exceptions (done) plus a backend bullet for `safe-fetch.ts`.

## 9. Conflicts with other sessions

None at present: the prior session's uncommitted playlist work is preserved unchanged on
`wip/playlist-import-prior-session` (754f35a) and is not merged; it is the rejected design.

## 10. Waves

Each wave is one worker in its own worktree. The coordinator lands each, runs the gate, drives the real stack, and runs
`npm run dist:win`.

| Wave | Scope | Acceptance |
|---|---|---|
| **W0 docs** (coordinator) | Section 8. | The planning agent says "ready". |
| **W1 backend schema and import** | Migration `022` (with backup and `foreign_key_check`); `safe-fetch.ts` (the guard, used by every fetch); `playlist-import.ts`; planner (3.6); repositories; routes (`import`, `POST /api/playlists`, `PATCH`, `DELETE` with cascade); `@fastify/multipart`; address-rule public check; stricter M3U detection; env playlist seeding removed; the deletions in section 5; tests. | Backend suite green; migration test on the live-channel fixture; live: upload and URL import answer in seconds, re-upload of `us.m3u` is `0 created, 0 updated`. |
| **W2 backend sync, status, logos, stop** | Rewritten sync (3.4); `logo-cache.ts`; `stream-check.ts`; `channel-health.ts`; `logo-resolver` fixes; per-playlist flight and semaphore; job-runner started-not-awaited, abort plumbing, `POST /api/jobs/:id/stop`; schedule floor; `PATCH /api/channels`; `/logos/c/`; the admin-channels filters; tests. | Sync tests green; live: a run answers `202`; after refresh logos on disk, statuses set, `/logos/c/<hash>.png` returns the image; stop and resume work. |
| **W3 admin Playlists and Jobs** (after W2) | Section 4.1 Playlists and Jobs parts; `shared/http` `form`. | Section 4.3 rows for Playlists and Jobs. |
| **W4 admin Channels** (parallel with W3) | Section 4.1 Channels part. | Section 4.3 Channels row. |

W1 and W2 are sequential (same services). W3 and W4 run in parallel once W2 lands. No fileserver or interface wave.

## 11. What is not built, and why

| Not built | Why |
|---|---|
| A stored copy of the uploaded file | Nothing reads it back. |
| A local path source, or an mtime or hash watcher | Upload copies the content; there is no external file to watch. |
| A content hash of the playlist body, or ETag conditional GET | The download is needed anyway; re-importing writes only if the plan is non-empty. |
| Prune, dry run, `kept`, `removed` | `Disable` over a `Dead` filter replaces them. |
| `GET|POST /api/playlist-sync` | Duplicate of the jobs. |
| An SVG logo cache | A script-capable file. |
| A shared `Upload` component | One consumer. |
| Client-side chunking of the bulk call | 5,000 ids fits one request. |
| Stopping a catalog job | `title-sync.ts` has no cancellation hook. |
| A job-level cursor for resume | Ordering plus the 7-day window already resume. |

## 12. Open questions for the owner

None blocking. Decisions recorded 2026-10-18: delete cascades; the four rule exceptions approved; ping is a per-URL manifest
request with no host shortcut; the first pass runs at the next start; stop and resume in scope; the fileserver and interface
are out of scope. Open for review: re-approval of this v2 after the planning agent's re-check.

## 13. Risks

- A first-run burst of 2,598 requests: bounded by the semaphore, the 16-at-a-time cap and the 10-minute budget.
- The channels rebuild on the live database: guarded by the backup, `foreign_key_check` and the video-preserving fixture test.
- A server serving a non-image under an image type: the magic-byte and dimension checks cover it.
- Hand-deleted channels return on the next import: documented, and Disable is the workflow.
- `38` and `41` promised paging the code lacks (`usePlaylistChannels`): W3 closes it.
- A worker may re-add a Name field, the toggles, a host shortcut or a direct `fetch`: the briefs quote the relevant sections.
