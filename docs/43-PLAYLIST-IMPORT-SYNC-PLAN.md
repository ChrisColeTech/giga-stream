# 43 - Playlist import, sync, logo cache and stream status (plan)

**Status: REVISED 2026-10-18 after two hostile reviews (v3); not yet re-approved.** Owner-approved scope and decisions stand
(2026-10-18); round one found six blockers and about two dozen should-fix items, round two five more blockers (the
migration order, name uniqueness, `safe-fetch` on `node:https`, the wave split, revisions); all are folded in below. No code
is written until the planning agent re-reviews this version and says "ready". Supersedes `42` sections 2-4 and keeps its rulings 1-5.
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
**Naming:** a derived name (the file name, or for a web address the URL's last path segment without its extension, else the
host) that clashes is made unique with ` (2)`, ` (3)`, so a second list from one host imports; only a name the user typed
(the JSON `name`, or a `PATCH`) is `409 playlist.taken`. A file re-import keeps the playlist's current name (the owner may
have renamed it) and a file playlist's `kind` never changes.

**`sync_jobs`** (rebuilt): `id`, `name` (**catalog jobs only**; a playlist job's name is not stored, the view shows
`Sync <playlist name>`, so a rename can never leave it stale), `type`, `enabled`, `schedule`, `config` (catalog only:
`scope`, `kind`, `pages`; `{}` for a playlist job), `playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE`,
`CHECK ((type='playlist') = (playlist_id IS NOT NULL))`, a partial `UNIQUE (playlist_id) WHERE playlist_id IS NOT NULL`
(exactly one sync job per playlist), `last_run_at`, `last_result` (`'ok'|'failed'|'stopped'`), `last_counts` (typed JSON,
validated on write and on read), `created_at`. There is **no `last_outcome`** on either job type: no sentence is stored, a
failure stores its dotted code in `last_counts` (`internal.failure` for anything unexpected), never `error.message`, and the
admin words every result from the typed counts. The backend and the admin each hold a schema for the counts (the programs
never import each other, `01` 4.2); the contract is the counts table in `03` 7.2c. **A playlist job is part of its
playlist:** created and deleted with it; `POST /api/jobs` creates **catalog jobs only**; `DELETE /api/jobs/:id` on a
playlist job is `422 job.invalid`; `PATCH` changes `enabled` and `schedule` only. The admin disables the row and bulk
`Delete` for a playlist job with `A playlist's job goes with the playlist.`

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
(the job's values joined in). The admin channel answer also carries `published` (`channel.enabled` and (no playlist or
`playlist.enabled`)) so a channel of a disabled playlist is not shown as simply enabled, and `source` / `playlistName`,
**derived by a `LEFT JOIN playlists`** in the repository's `list`, `find` and `page` (read-only, never written).
**Precedence of the three `enabled` switches:** a channel is published when `channel.enabled` and (it has no playlist, or
`playlist.enabled`); the **public read joins the playlist's `enabled`**, and changing a playlist's `enabled` bumps the
revision (it changes what a public reader sees). `playlist.enabled = false` stops that playlist's sync,
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
in an outcome, audit entry or log (map to a fixed code). Refusal examples carry the entry **name only**, never the
full stream URL. A stream URL from a credentialed playlist is itself a credential: it is published by the public channel
read, so such a playlist should not be imported into a published channel list (documented in `03`).

### 3.2 Import and playlist routes

Signed in, audited, dotted codes. A duplicate `url`, `file_name` or typed name (case-insensitive) is `409 playlist.taken`; a
derived name that clashes is suffixed instead (3.1); `playlist.invalid` is for content only; `playlist.*` always means an M3U record, never a live
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
| `PATCH /api/channels` | **New** bulk: `{ enabled, ids[] }`, 1-5,000 ids (about 210 KB; the route sets `bodyLimit` to `CHANNEL_BODY_LIMIT_BYTES`); no client chunking. Stream rows only. One transaction, one revision, one audit entry `channel.enabled_bulk`. Answers `{ changed, unchanged, skipped }` (flipped / already in that state / live-kind or unknown ids). Invalid body `422 channel.invalid` (field `ids`). |
| `GET /api/admin-channels` | Adds `status` (`live|dead|unchecked`) and `playlist` (id) filters in `store/channel-page.ts`; the `source` filter is removed; `sort=playlist`; `q` matches name, number, tvg id and the playlist's name and host. |
| `GET /logos/c/<file>` | Serves a cached image; name must match `^[0-9a-f]{32}\.(png|jpg|gif|webp)$`; public, `immutable`, `nosniff`; no traversal possible. Live PNG ids at `/logos/<id>.png` are unchanged. |
| `GET|POST /api/playlist-sync` | **Removed.** |

**The sync-owned columns** (`status`, `checked_at`, `logo_file`, `logo_checked_at`) are admin-only: writing them takes **no
revision** and does not change a row's `revision` (the revision counts what a public reader can see: create, update,
enable, delete and a playlist's `enabled`; per-batch revisions would drop the admin's held pages about 13 times a run). The
admin reads health on `Refresh` (no polling). `PATCH /api/channels` answers `{ changed, unchanged, skipped }` (`changed` =
flipped, `unchanged` = already in that state, `skipped` = live-kind or unknown ids) and sets its own `bodyLimit` to
`CHANNEL_BODY_LIMIT_BYTES` (the app default is 64 KiB). The admin-channels `source` filter is **deleted** (nothing sets it
any more), `sort=source` becomes `sort=playlist`, `origin` is by `playlist_id`, and `q` matches name, number, tvg id and the
playlist's name and host.

Any write that changes a channel's `stream_url` or `logo_url` (an admin edit, a re-import) resets the dependent sync-owned
columns in the same statement (`status`, `checked_at` for a URL change; `logo_file`, `logo_checked_at` for a logo change).

### 3.4 The job and the sync algorithm

Job types stay `playlist` and `catalog`. `POST /api/jobs/:id/run` for a playlist job is **started, not awaited**: `202` with
`running: true`; the result is read on a refresh. A playlist job's schedule must be at least **15 minutes**
(`422 job.invalid`, field `schedule`). A playlist job is created only by an import (`NewJobForm` creates catalog jobs only).
The first pass after the migration starts after the server is listening, never during boot.

Limits (named constants): run wall clock 30 min; probe budget 10 min; logo fetch 10 s, 1 MiB; stream check 5 s, first
64 KiB; playlist fetch 15 s. **Two global semaphores shared by all playlists:** stream checks 16 at a time, logo downloads
8 at a time, and in each **at most 2 at a time to one host** (a credentialed provider list is mostly one host; sixteen
parallel connections to one subscription can get it banned). This is not a host shortcut: every URL still gets its own
request. The playlist fetch and the logo-index download are outside them. A web playlist is re-fetched every run, so the
15-minute floor is also the provider's load.

**Single flight is per playlist** (`409 sync.busy`). **The scheduler never awaits a run:** it starts a playlist run and
re-arms at once, and a running job is not due, so one long sync cannot starve the catalog job or freeze re-arming. Existing
playlist-job schedules under 15 minutes are set to `15m` by the migration. The scheduler never returns a due time earlier
than process start plus `FIRST_RUN_GRACE_MS` (30 s, an injected-clock constant), so a due-at-once job never runs during boot.

1. **Claim** the playlist's flight. Refuse a disabled playlist (`422 job.disabled`). A disabled job refuses only the
   schedule.
2. **Re-read.** `file`: skip. `url`: fetch through `safe-fetch` on **every** run and pass the text to `importText`, which
   writes only if its plan is non-empty (create and update, never delete). A fetch failure is `source: unreachable` in the
   counts (the run is still `ok`) and the run goes on.
3. **Resolve missing logo addresses** for this playlist's rows with no `logo_url` and no edited `logoUrl`: load the iptv-org
   index once per run through `safe-fetch` (`safeParse`, a bad row is skipped, a failed load is stamped on disk and retried
   after one hour), look up by `tvgId` then by name (accents folded before stripping, so `Télé` is `tele`), set `logo_url`
   with `UPDATE channels SET logo_url = ? WHERE playlist_id = ? AND sync_name = ? AND logo_url IS NULL`.
4. **Cache logos:** distinct `logo_url`s whose `logo_checked_at` is NULL or older than 7 days, or whose `logo_file` is
   missing on disk. Download through `safe-fetch`, validate (3.1), hash, write `<hash>.<ext>` atomically (temp + rename) if
   absent, then `UPDATE channels SET logo_file = ?, logo_checked_at = ? WHERE playlist_id = ? AND logo_url = ?` (one
   statement per distinct URL, no revision). A failure sets
   `logo_checked_at` only. Then garbage-collect (3.1).
5. **Check streams** of this playlist, enabled or not, ordered `checked_at IS NOT NULL, checked_at, id` (a total order, so the
   same subset is never starved). Each distinct stream URL is requested through `safe-fetch`: `live` if 2xx and the body,
   after stripping a BOM and whitespace, starts `#EXTM3U`; anything else, including a DNS or refused failure **on that URL**,
   is `dead` for that channel only (a non-HLS stream is therefore `dead`; the word's tooltip says "no HLS manifest"). A
   verdict is written **per distinct URL**: `UPDATE channels SET status = ?, checked_at = ? WHERE playlist_id = ? AND
   stream_url = ?` (naturally compare-and-set: a channel edited or deleted mid-run no longer matches and is skipped), in
   batches of 200 per transaction, **taking no revision** (3.3). A logo write is the same with `logo_url`. When the probe
   budget ends the rest stay unchecked and go first next run.
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

Every request to an address that comes from **playlist content or an admin** (a playlist, the logo index, a logo, a stream
check) goes through it. Fixed provider hosts (TMDB, OMDb) and the backend's own calls (`app-url`, health) do not. It is built
on **`node:https`** (and `node:http` only on loopback with `ALLOW_LOOPBACK_STREAMS`), **not on `fetch`**: the global `fetch`
(undici) cannot be told which address to connect to, and the npm `undici` package is outside the locked stack (`01` 2). A
`lookup` hook resolves the name once, refuses any non-public result, and returns the validated address, which is the one
connected to (TLS server name and certificate validation still use the host name, because only DNS is overridden); it
handles both the single-address and the `all: true` callback forms (Node's happy-eyeballs uses the latter). IP-literal hosts
never call `lookup` and are checked directly with `net.isIP`. **Refused:** IPv4 `0/8, 10/8, 100.64/10, 127/8, 169.254/16,
172.16/12, 192.0.0/24, 192.0.2/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4, 240/4`; IPv6 `::`, `::1`,
IPv4-mapped (the embedded address is checked), NAT64 `64:ff9b::/96`, 6to4 `2002::/16` (embedded address checked), Teredo,
documentation, ULA, link-local, site-local, multicast. It sends `Accept-Encoding: identity` (so no decompression and no
bomb), `Connection: close`, a fixed User-Agent and no cookies, refuses userinfo, follows at most 3 redirects (each
re-resolved and re-validated, `https` only, never https to http), counts bytes while streaming and destroys the socket at the
cap. **Tests** inject `lookup` and a `transport` through `createSafeFetch({ lookup, transport })` (a seam separate from the
existing `makeApp({ fetch })` one, which TMDB and OMDb keep); one real-socket test on `127.0.0.1` with the dev flag covers
redirects and caps, since a fake transport cannot test the pinning.
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
writes), migration `022-playlist-model.sql`, a counts schema in the backend and one in the admin, both following the table
in `03` 7.2c. Also deleted: `sync_jobs.last_outcome` and `types/playlist-sync.ts`.

## 6. Migration and the owner's data (no destruction)

`022` begins with the line `-- migrate: backup`. When a pending migration carries it **and** the database's `user_version`
is above 0 (so never on a fresh database), `migrate.ts` writes `VACUUM INTO '<db>.pre-<version>'` before the migration loop
and **outside any transaction** (`VACUUM INTO` cannot run in one, and `migrate.ts:44-47` wraps every migration in
`runInTransaction`; skipped when that file already exists, because `VACUUM INTO` fails on an existing file). After **every**
migration's SQL, inside its transaction, `migrate.ts` runs `PRAGMA foreign_key_check` and **throws on any row** (after the
commit `user_version` would already be 22). Order matters, because adding a cascading reference and then dropping the
parent table cascades:
1. **`playlists`** (nothing references it yet): create `playlists_next` (3.1: the `kind` CHECK, `name TEXT NOT NULL COLLATE
   NOCASE UNIQUE`); copy with **explicit ids** (`stored:<n>` -> `kind='file', file_name=<n>, host NULL`; else `kind='url',
   url=address, host`; clashing names get ` (2)` by `ROW_NUMBER`); `UPDATE sqlite_sequence SET seq = (SELECT seq FROM
   sqlite_sequence WHERE name='playlists') WHERE name='playlists_next'` (so a deleted playlist's id is never reused and old
   audit subjects do not collide); drop `playlists`; rename. The playlist's old `last_synced_at` and `last_outcome` are
   **not** carried over.
2. **`sync_jobs`** (no children): create `sync_jobs_next` (3.1) and copy: for `json_valid(config)` playlist rows,
   `playlist_id = (SELECT id FROM playlists WHERE id = json_extract(config,'$.playlistId'))` (NULL when the playlist is
   gone; then drop those rows); keep the lowest `id` per playlist. `last_run_at` is **NULL** for every playlist job (so the
   first pass runs after the grace); `last_result` and `last_counts` are NULL for playlist jobs (the old shape - `removed`,
   `kept`, `createdIds` - is obsolete; validation on read treats an invalid value as absent, never as an error); catalog jobs
   keep `last_run_at` and `last_counts`, and `last_result` = `ok` when `last_outcome='ok'` else `failed`. `config='{}'` for
   playlist jobs. The playlist-job schedule: `CASE WHEN schedule='off' THEN 'off' WHEN schedule GLOB '*ms' OR schedule GLOB
   '*[0-9]s' THEN '15m' WHEN schedule GLOB '*[0-9]m' AND CAST(schedule AS INTEGER) < 15 THEN '15m' ELSE schedule END`. Then
   insert a job (`WHERE NOT EXISTS`, not `NOT IN`) for every playlist without one: `name NULL, type 'playlist', enabled 1,
   schedule '24h', config '{}', last_run_at NULL, created_at = CAST(strftime('%s','now') AS INTEGER) * 1000`; create the
   partial `UNIQUE`; `UPDATE sqlite_sequence` for `sync_jobs` to the old maximum as in step 1; drop the old table; rename.
3. **`channels`:** `CREATE TEMP TABLE channel_videos_keep AS SELECT * FROM channel_videos` (the cascade on drop would
   empty it, `008-live-channels.sql:43`). `UPDATE channels SET playlist_id = NULL WHERE kind = 'live'` (the new CHECK would
   abort the copy otherwise). Set `playlist_id = NULL` where that playlist does not exist. For rows with
   `playlist_id IS NULL AND source IS NOT NULL`: set `playlist_id` to the playlist whose `host = source` or
   `'stored:' || file_name = source` when **exactly one** matches; otherwise leave it NULL and clear `sync_name` and
   `edited_fields` (hand-made; the migration test lists them). Create `channels_next` with **every column of 008, 010, 013
   and 014** (`id, name, category, number, logo_url, stream_url, revision, created_at, tvg_id, kind, live_*,
   edited_fields, sync_name, enabled`), `playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE`, the sync-owned
   `status` (CHECK live/dead), `checked_at`, `logo_file`, `logo_checked_at`, **no `source`**, the 008 kind-consistency
   CHECK, `CHECK (playlist_id IS NULL OR (kind='stream' AND sync_name IS NOT NULL))` and `CHECK (status IS NULL OR
   kind='stream')`; copy with `COALESCE(sync_name, name)` for rows that have a `playlist_id`; drop `channels`; rename
   `channels_next` (renaming the new table in does not repoint `channel_videos`: its reference resolves by name again);
   **recreate `channels_live_number` (008:39) and create `channels_playlist`**; restore `channel_videos` from the temp
   table; drop the temp tables.
The migration test **builds a version-21 database at test time** (reading the 001-021 files in order, setting `PRAGMA
user_version = 21`, then inserting live channels with
videos, a synced playlist with channels, a job with `dryRun`/`prune`, a channel with a dangling `playlist_id`, two
playlists on one host; no binary fixture is committed) and asserts: equal `channels` and `channel_videos` counts, the
live-number index, every backfill and the ambiguous-source report, the schedule clamp, the backup file, and a clean
`foreign_key_check`.

The owner's 1 playlist and 2,598 channels (`source = stored:us.m3u`, disabled, no `tvg_id`) survive: the playlist becomes
`kind='file', file_name='us.m3u'`, the channels get their `playlist_id` (so deleting that playlist later removes them), new
columns are NULL (not checked), and `data/playlists/us.m3u`, if present, is left on disk, inert. The new job is due after
the 30 s grace; W1a's first pass is step 2 only (a file playlist reads nothing), so it is quiet. The logo and status pass
arrives with W2: its migration **`023`** is one statement, `UPDATE sync_jobs SET last_run_at = NULL WHERE type='playlist'`,
so the first pass (logos, then 2,598 stream checks within the 10-minute budget) runs at the first start after W2 and is
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
`stream_url` changed mid-run; sync writes take no revision; ordering is total; per-playlist flight;
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

W0 is complete only when these carry v3: `03` 7.2 (the admin-channels parameter table: remove `source`; `q` over name,
number, tvg_id and the playlist's name and host; `origin` by `playlist_id`; add `status` and `playlist`; `sort=playlist`),
7.2c (incl. the typed counts contract table), 7.3, 7.9, 7.13 (remove `playlist.created`), 8; `26` 3.11 (fields, precedence,
the Jobs bullet, seeding) and 4.9c (rewritten, not bannered); `38` (rewritten sections, not only the banner); `41`; `28`
9; the `01` per-page forward-verb list (`Channels →` on a playlist workspace) and the `safe-fetch` bullet scoped to
playlist-content addresses; `20` amendment (done). Status 2026-10-18: `03`, `26`, `01` and this document carry v3; `38`,
`28` and the `01` forward-verb list are the open items.

## 9. Conflicts with other sessions

None at present: the prior session's uncommitted playlist work is preserved unchanged on
`wip/playlist-import-prior-session` (754f35a) and is not merged; it is the rejected design.

## 10. Waves

Each wave is one worker in its own worktree. The coordinator lands each, runs the gate, drives the real stack, and runs
`npm run dist:win`.

| Wave | Scope | Acceptance |
|---|---|---|
| **W0 docs** (coordinator) | Section 8. | The planning agent says "ready". |
| **W1a backend schema and import** | `migrate.ts` backup (outside the transaction) and in-transaction `foreign_key_check`; migration `022`; `safe-fetch.ts` (built on `node:https`, 3.8) used by every playlist-content fetch; repositories (playlists, jobs, channels with the joined `source`/`published`/`playlistName`; the public read joins the playlist's `enabled`); the planner (3.6, reading only that playlist's rows); `playlist-import.ts`; routes (`import`, `POST /api/playlists`, `PATCH`, `DELETE` with cascade); `@fastify/multipart`; address-rule public check; stricter M3U detection; **a minimal playlist-job body = step 2 only** (started not awaited, typed result, scheduler non-blocking, 15-minute floor, catalog-only `POST /api/jobs`); removal of the old sync, `sync-seed` playlist half, `PLAYLIST_URLS`, the aggregate route, `playlists.address`, `channels.source` and every use in the inventory below; tests. | Backend suite green; migration test on the test-built v21 database; live: upload and URL import answer in seconds, re-upload of `us.m3u` is `0 created, 0 updated` with no revision bump, and a playlist job run re-reads and records a typed result. No logos or statuses yet (they are NULL; the system is consistent). |
| **W1b admin wire and import UI** (released together with W1a, no release between) | `url`/view shapes, `playlist-schema`, `FileRow`, the `Source` choice, the import flow, `shared/http` `form`, `NewJobForm` catalog-only, the delete question, playlist-job rows (no delete), `Channels →`, derived `source`/`published`, **and the Jobs `Run` group (no flags, the "Started" notice) and `Last run` words from typed counts** (the Jobs wire files listed below). | The admin matches the backend; section 4.3 rows for Playlists and the Jobs `Run`/`Last run`. |
| **W2 backend sync steps 3-5, stop, bulk** | `logo-cache.ts`, `stream-check.ts`, `channel-health.ts` (per-URL targeted writes, no revision), `logo-resolver` fixes, the two global semaphores with the per-host cap, abort plumbing and `POST /api/jobs/:id/stop`, `PATCH /api/channels`, the `status`/`playlist` filters, `/logos/c/`, migration `023` (section 6); tests. | Sync tests green; live: after a run logos are on disk, statuses set, `/logos/c/<hash>.png` returns the image; stop and resume work. |
| **W3 admin Jobs, Channels** (after W2) | `Stop`, `Resume` and the Channels tab parts of section 4.1 (stream column, selects, one-call bulk, workspace logo and status). | Section 4.3 rows for Jobs `Stop`/`Resume` and Channels. |

W1a and W1b land and are released together. Between waves the system is consistent (before W2, statuses are NULL).

**`source` / `address` inventory a W1a worker must change** (not exhaustive: `grep` before finishing): backend
`store/channel-repository.ts` (`ChannelRow`, `COLUMNS`, `detach`, `update`, `toRecord`, `listSynced`, `insert`),
`store/channel-page.ts` (`ORIGIN_WHERE`, `q`, the source filter, sort), `types/channel-query.ts`, `types/channel.ts`,
`services/channel-views.ts`, `channel-service.ts` (revert guard), `stream-channel-rules.ts`, `test-channels.ts`,
`playlist-sync-plan.ts`, `playlist-sync-service.ts` (`target.address`), `job-runner.ts`, `sync-seed.ts`,
`playlist-repository.ts`, `playlist-service.ts`, `types/playlist.ts`, `api/playlists.ts`, `constants/limits.ts`, and their
tests; admin `schemas/playlist-schema.ts`, `services/playlists.ts`, `playlist-body.ts`, `playlist-draft.ts`,
`field-checks.httpsAddress`, the `ADDRESS_*` copy, `NewPlaylistForm`, `PlaylistDetailsGroup`, `StreamStatusGroup`,
`channel-query-copy.ts`, `usePlaylistChannels.ts` (deleted), `channel-guard.ts`, `channel-query.ts`, `channel-rows.ts`,
`channel-schema.ts`, `types/admin-channel.ts`, and their tests. `jobs.test.ts` creates playlist jobs through
`POST /api/jobs` and is rewritten. Also (W1a): `app.ts` (multipart registration, the `outbound` seam), `config.ts`,
`service-registry.ts`, `constants/errors.ts` (remove `playlistBusy`, add `playlistTaken` and `jobNotRunning`), `api/jobs.ts`,
`types/job.ts`, `job-service.ts`, `job-repository.ts` (`recordRun`, `removeOfPlaylist`, `PlaylistJobConfig`), `job-runner.ts`
(catalog recording moves to `last_result`/typed counts), `sync-scheduler.ts` (non-blocking, `FIRST_RUN_GRACE_MS`),
`types/playlist-sync.ts` (deleted), `api/admin-channels.ts`, and the tests `test/test-app.ts`, `no-store.test.ts`,
`audit.test.ts`, `seed-repair.test.ts`, `job-scheduler.test.ts`, `paging-kit.ts`. W1b's Jobs wire: `job-schema.ts`,
`job-flows.ts` (`answer.lastOutcome`), `job-rows.ts` (`lastRunFailed`), `JobLastRunGroup.tsx`, `playlist-bulk.ts`
(`jobForPlaylists`), `NewJobForm.tsx`, `JobPlaylistSelect.tsx`, `JobDetailsGroup.tsx`, `job-draft.ts`, `job-body.ts`,
`job-checks.ts`, `job-copy.ts`, `PlaylistStatusGroup.tsx`; `DELETE /api/playlists/:id` answers `{ id, deletedChannels,
deletedJobs }` (admin `PlaylistDeletedSchema` is `{ id, released }` today). No fileserver or interface wave.

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
are out of scope. No question is open.

## 13. Risks

- A first-run burst of 2,598 requests: bounded by the semaphore, the 16-at-a-time cap and the 10-minute budget.
- The channels rebuild on the live database: guarded by the backup, `foreign_key_check` and the video-preserving fixture test.
- A server serving a non-image under an image type: the magic-byte and dimension checks cover it.
- Hand-deleted channels return on the next import: documented, and Disable is the workflow.
- `38` and `41` promised paging the code lacks (`usePlaylistChannels`): W3 closes it.
- A worker may re-add a Name field, the toggles, a host shortcut or a direct `fetch`: the briefs quote the relevant sections.
