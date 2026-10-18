# 26 - Admin App and the Single Backend

**Status: revised 2026-10-17. The merged backend (sections 3.x, Waves 1b and 2) is built and landed: the live server is
gone, its engine runs in `src/backend/src/live`, migrations 008 to 016 are applied, titles, playlists and jobs are
records, and roles and the provider key were removed. The admin app (section 4, `src/admin`), the backend's Electron
host (4.1) and the mockup's acceptance are NOT built: they are planned in `27`, `28` and `29`.** *Verified* marks a fact read
in the code or a doc on this date. *Decided* marks the owner's words. Everything else is a proposal; section 10 lists the decisions and the
defaults the waves take until the owner redirects. When a wave lands, its part of this document becomes fact and is
amended.

**Revision note.** The first draft put the mockup in `giga-stream/src/admin-mockup`, cloned it from the older
`giga-stream/src/mockup`, wrote its own shell classes, and was written by the coordinator. All four were wrong. This
revision moves the mockup to the proof-of-concept folder, clones the family shell from the mockup there, corrects the
shell to `02`, `04` and `06`, corrects the root-route rule (`01` section 4.3), and assigns every code piece to a worker
(section 6).

Governed by `00`, `01` (ownership, stack, rules), `02` (the window), `03` (routes and ports), `04` (navigation), `06`
(pages and panes), `07` (the protocol) and `10` (the live server). The family grammar is the giga-lora-trainer guides
`01` and `06` and the family ui kit in `src/frontend/src/components/ui`, copied per `23`.

## 1. What is decided

- **Decided (owner, 2026-10-17):** a live-server admin app that administers the live stream channels.
- **Decided:** merge the admin CRUD backend (`src/backend`) and the live server (`src/live-server`) into one backend.
- **Decided:** the admin app follows the family grammar and style, starting from a clone of the proof-of-concept
  mockup with its domain logic stripped. The clone goes in the proof-of-concept folder,
  `D:\Projects\giga-stream-poc\src\admin-mockup`.
- **Decided:** each tab has an index page and a workspace. The owner first wrote "tabs in the nav rail", then, seeing
  the first mockup, pointed to `docs/reference/family`: the tabs are the titlebar's centred tab pill, an index has no
  rail, and a workspace has the rail with the escape button above its section links.
- **Decided:** the work is split into waves and given to workers under the delegation protocol (`07` section 6). The
  coordinator writes docs and briefs, lands, checks and reports; it does not implement.

## 2. What the two servers were before the merge (historical; they are one backend now, section 3)

### 2.1 Admin backend, `src/backend` (verified)

Fastify 5, zod and one `node:sqlite` handle (`store/database.ts`). Port 8091, 8191 in production. `DATA_DIR` defaults
to `~/.giga-stream-admin`, with `admin.db` inside it.

- **Routes:** `/healthz`; `/api/auth/*` (login, refresh, logout, me, password); `/api/admin-accounts`;
  `/api/audit`; `/api/channels` (reads public, writes signed in); `/api/providers`; `/api/titles`
  (TMDB); `/api/playlist-sync`.
- **Channels are stored stream-address rows:** `id` (`ch_<uuid>`), `name`, `category` (free text), `number` (TEXT),
  `logo_url`, `stream_url`, `revision`, and for playlist-synced rows `tvg_id` and `source`.
- **Auth:** HS256 JWT valid 15 minutes, a rotating refresh token, a sign-in rate limit and a lockout. Every change
  writes an audit entry. `api/guard.ts` `signedIn(services, request)` gates writes. There are no roles (D22): every signed-in admin is equal.
- **Network policy** (`network-policy.ts`): refuses to listen off loopback over plain http unless
  `TLS_CERT_FILE`/`TLS_KEY_FILE`, `TRUST_PROXY` or `ALLOW_INSECURE_HTTP` is set. No-store routes: `/api/auth`,
  `/api/admin-accounts`, `/api/audit`, `/api/admin-channels`.
- **CORS:** methods GET, POST, PATCH, PUT, DELETE (providers use PUT). The `/live` and `/logos` plugins answer GET and
  HEAD and accept `Range`.
- **Build:** `tsc`, `rootDir: "src"`, into `dist/`. Development runs `tsx`. Tests are `tsx --test`.

### 2.2 Live server, `src/live-server` (historical: deleted; its engine is `src/backend/src/live`)

Fastify, zod and `node:sqlite` (`<DATA_DIR>/live-server.db`, `~/.giga-stream-live` by default). Ports 8097 and 8197.
Its own composition root (`app.ts`), runs its TypeScript directly with `.ts` import extensions, and imports
`../../shared/media/src/ffmpeg/locate-tool.ts`.

- **A channel:** `id` (kebab-case), `name`, `category` (News, Sports, Music, Kids, Movies, Entertainment), `number`
  (integer 1 to 9999), `mode` (`loop` or `encode`), `captions`, `variants` (360p, 720p, 1080p; at least two, none
  repeated), and exactly one of `folder` (absolute path) or `videos` (up to 2000 absolute paths).
- **Its answer:** `state` (preparing, starting, live, restarting, stopped, failed), `problem`, `renditions`,
  `playlist` (name and duration per video), `nowPlaying`, `fault`, `masterUrl`, `logoUrl`.
- **Faults**, in memory, one per channel: `stall`, `segment-404`, `slow-segments`, `playlist-500`, `discontinuity`,
  `restart`, `end`.
- **Writes:** `fromThisComputer()` accepts a change only when the TCP peer is loopback. There is no sign-in.
- **Routes:** `/healthz`; `/api/channels` CRUD; `PUT` and `DELETE /api/channels/:id/fault`; `/live/:id/master.m3u8`,
  the renditions and segments (with `Range`); `/logos/:id.png`; `/test/player.html` when `TEST_PAGE=true`.
- **Engine:** loop mode encodes each video once into a cached VOD ladder and serves the list as a clock-driven sliding
  window; encode mode runs one real-time ffmpeg per channel. `stream/process-tree.ts` kills the ffmpeg tree.
- **Tests:** 40 over the real store, ffprobe and encoder, plus opt-in headless-Chrome tests.

### 2.3 Where the two collide

| Concern | Admin backend | Live server | Merged answer |
|---|---|---|---|
| Channel record | stream-address row | playlist of videos | one table with a `kind` (D1) |
| Channel id | minted `ch_<uuid>` | kebab-case, given | both kept; unique across kinds |
| `number` | TEXT | integer | TEXT on the wire; live validates digits |
| `category` | free text | six fixed values | fixed for `live`; free text for `stream` (D12) |
| Who may write | any signed-in admin, JWT | this computer only, no sign-in | any signed-in admin, JWT (D2) |
| Stream address | stored; passes the address rule (`03` 7.3) | derived from its own origin | derived at read time (D3) |
| Stream paths | none | root `/live`, `/logos` | the same root paths, a sanctioned exception (D14) |
| Port | 8091 / 8191 | 8097 / 8197 | the backend's; the live port retires |
| Database / data | `admin.db`, `~/.giga-stream-admin` | `live-server.db`, `~/.giga-stream-live` | one `admin.db`, one `DATA_DIR` with `cache/` |
| CORS | GET, POST, PATCH, DELETE; no `Range` | adds HEAD, PUT; `Range` | the stream routes take the live set |
| Module style | `.js` imports, `tsc`, `rootDir: src` | `.ts` imports, run directly, imports `src/shared` | ported to the backend's style; the `shared/media` import needs a build change (3.8) |
| Timers | two schedulers (`01` 4.4) | encoder restart and fault timing | `01` section 4.4 is amended (section 11) |

The fileserver's `ChannelSchema` (`src/fileserver/src/services/admin-client.ts`) is not strict, so extra fields are
safe. It requires `number` as a string and `streamUrl` as a non-empty string. A live channel must answer both.

`01` section 4.3 says every route begins `/api`, "besides the live server's stream addresses (`/live/...`,
`/logos/...` and its test page ...), which players load directly and which answer bytes, not the envelope." The root
`/live` paths are therefore already sanctioned; `AGENTS.md` leaves the exception out. The first draft of this plan
missed it and proposed moving them under `/api`.

## 3. The merged backend

### 3.1 Shape (proposed)

```text
src/backend/src/
  live/                     the live engine, ported from src/live-server (its docs/10 section 3 shape)
    engine/                 channel runtime, channel videos, fault state, stream service
    stream/                 recipe, loop and encode channels, playlist render and edit, logos, process tree
  api/channels.ts           the one channel CRUD, both kinds
  api/live-faults.ts        PUT and DELETE .../fault
  api/admin-channels.ts     the admin's full read (3.3)
  api/live-streams.ts       /live/... and /logos/... : playlists, renditions, segments, logos, the test page
  api/admin-static.ts       /admin/ : the built admin app, when present (4.1)
```

The exact file list belongs to the worker, within the 200-line rule of `01`.

### 3.2 Store (built: migrations 008 to 016, forward-only)

008 live channels, 009 title records, 010 sync edits, 011 sync settings, 012 drop tombstones, 013 `enabled`, 014 playlists
and jobs (`playlists` has `id, name, address, host, enabled, last_synced_at, last_outcome, created_at`), 015 accounts
without `role`, 016 providers without `api_key`. Migration `008-live-channels.sql`:

- `channels` gains `kind TEXT NOT NULL DEFAULT 'stream' CHECK (kind IN ('stream', 'live'))`. `stream_url` becomes
  nullable: a live row stores none. The live fields are `live_mode`, `live_captions`, `live_variants` (JSON) and
  `live_folder`.
- `channel_videos (channel_id, position, path)`, cascading on delete, holds a `videos` source in order.
- A live row's `revision` and audit entries work as a stream row's do.
- The owner's existing `live-server.db` is imported by a one-shot script the owner runs, never by the server at
  runtime and never by a worker against the owner's data (D13).

### 3.3 Routes (proposed)

Reads stay public and keep the shape the fileserver reads. Writes need a signed-in admin.

| Route | Who | Change |
|---|---|---|
| `GET /api/channels` | anyone | same shape; a live row's `streamUrl` is built from the caller's origin |
| `GET /api/channels/:id` | anyone | same |
| `POST /api/channels` | signed in | body discriminated by `kind`: `stream` (today's body) or `live` (id, name, category, number, mode, captions, variants, folder or videos) |
| `PATCH /api/channels/:id` | signed in | the same discriminator; a change to a live channel rebuilds it |
| `DELETE /api/channels/:id` | signed in | stops the runtime, then deletes |
| `PUT /api/channels/:id/fault` | signed in | `{ fault, durationMs?, delayMs? }`; live channels only |
| `DELETE /api/channels/:id/fault` | signed in | clears |
| `GET /api/admin-channels` | signed in | the full admin view: state, problem, renditions, playlist, nowPlaying, fault, mode, source |
| `POST /api/channels/:id/rebuild` | signed in | re-reads a folder source and rebuilds (today a PATCH of the same folder) |
| `POST /api/channels/:id/revert` | signed in | clears a synced channel's `edited_fields` so the next sync overwrites it again (3.10) |
| `GET\|HEAD /live/:id/master.m3u8` (renditions, segments) | anyone | the same bytes as today; `Range`; playlists `no-store`, segments immutable |
| `GET /logos/:id.png` | anyone | the generated logo |
| `GET /test/player.html` | anyone | only with `TEST_PAGE=true` |

Errors keep the live server's codes (`channel.invalid` 422 naming the field, `channel.taken` 409, `fault.invalid` 400,
`media.not_found` 404, `range.unsatisfiable` 416) in the backend's envelope. `access.loopback_only` retires with the
loopback gate (D2). `/api/admin-channels` joins the no-store list.

### 3.4 Auth and the network (proposed)

- Writes are gated by `signedIn(services, request)`; every account is equal. Every write route has a test for 401 without a token and for a
  disabled account.
- Reads of channels and streams stay open, as the live server's reads were.
- Serving a LAN goes through the backend's network policy. Today the live server serves a LAN over plain http with
  `HOST=0.0.0.0`; merged, the backend refuses to start without TLS, `TRUST_PROXY` or `ALLOW_INSECURE_HTTP`. That is
  stricter and intended, and it changes the LAN setup.
- A live address is the backend's own. The address rule (`03` 7.3) applies to stream and logo rows, not to addresses
  the backend builds for itself (D3).

### 3.5 Runtime (proposed)

- The channel runtime starts in the same process. Saved channels build in the background at start so the backend
  answers at once.
- The runtime owns its ffmpeg children. Shutdown stops them through `process-tree` and leaves no ffmpeg running
  (`10` section 5).
- A failing channel becomes `failed` with its `problem`. It never takes the backend down; a test proves it.
- **Restart cost (D4):** restarting the admin backend stops every live channel until it rebuilds. Today a backend
  restart leaves the live server playing.

### 3.6 Configuration (proposed)

`dev.env` (committed development defaults: `SEED_TEST_CHANNELS=true`, `TEST_PAGE=true`, loaded first), `.env` (secrets
and local overrides) and `production.env`. `PORT` 8091 in development, 8191 in production. `CACHE_DIR`
defaults to `<DATA_DIR>/cache`. `FIXTURE_DIR` and `TEST_PAGE` carry over. `ADMIN_DIST` names the built admin app
(default `src/admin/dist`; with no `index.html` there, nothing is served). `SEED_TEST_CHANNELS` seeds the four `fx-*`
channels as `kind: live` served by the backend itself, which replaces the `03` 7.7 rule that points them at a second
server. The live server's `CORS_ORIGINS` folds into the backend's.

### 3.7 Scripts and ports (done, Wave 2)

`npm run dev` runs the backend, the interface's Vite and the fileserver's Electron app; the live server, `live:dev`,
`live:start` and `test:live-server` are gone. `kill-ports` is `5171 8090 8091 3001`. `03` section 1's port table still has
a live row to remove (the coordinator's amendment list, section 11).

### 3.8 Build (done)

`src/backend` builds `src/shared/media` into its own `dist` with `node src/build-shared.ts` (esbuild plus a
declaration-only `tsc`), the way `src/fileserver` does; `rootDir` stays `src` and `dist/server.js` keeps its layout.

### 3.9 Tests (done)

- The live tests live in `src/backend/test` (`live-*.test.ts`), with temporary data and free ports. Workers write them
  and do not run them (`07` section 6.3).
- The default run stays in seconds. The ffmpeg-dependent tests and the Chrome tests are opt-in
  (`LIVE_ENGINE_TESTS=1`) and run once at the end of the wave.
- **Parity:** every row of `10` section 3.1 has a test on the merged backend; `src/live-server` was deleted after that.

### 3.10 How the two syncs work, and the rules for admin edits (built; the gaps below were verified before the rules and are now closed by rules 1 to 6)

**Playlist sync** (`playlist-sync-service.ts`). It owns only rows that have a `source` (the playlist host); a hand-made
row has none and is never matched, updated or removed. For each playlist entry it looks for a match, first among rows of
the same host and then among all sync-owned rows, by `tvgId` and, failing that, by **exact `name`**. A match keeps its
`id`, `name`, `tvgId` and `source`, and **takes the entry's `streamUrl` always, its `category` and `number` and `logoUrl`
whenever the entry has one**. No match creates a row; a sync-owned row with no entry is `removed`, and with `prune` it is
deleted.

**Catalog sync** (`title-sync.ts`). A title is keyed by **kind and TMDB id**, never by name. A bulk sync walks TMDB's
trending or popular list and, per result, keeps the stored payload if it is fresh and replaces it with TMDB's thin list
row if it is missing or stale (a read then heals a thin row by refetching the detail). The explicit-ids scope calls
`ensureTitle("movie", id)`, so **a series id is always fetched as a movie**.

**The gaps that admin edits fall into** (none was reachable before the admin could edit):

| # | Gap | Today |
|---|---|---|
| a | An admin edits a synced channel's `streamUrl`, `category`, `number` or `logoUrl` | the next sync overwrites it |
| b | An admin **renames** a synced channel with no `tvgId` | it no longer matches its entry by name, so the sync creates a **duplicate** with the original name, and `prune` deletes the renamed row |
| c | An admin **deletes** a synced channel | the next sync creates it again, with a new id |
| d | `prune` | deletes a sync-owned row whose entry vanished, including one the admin edited |
| e | An admin edits a synced title | a bulk sync, a stale read or the healing refetch replaces the edited payload |
| f | An admin **deletes** a synced title | the next read by id (fill-through) or sync brought it back (closed by D20's amendment: the deletion is recorded and stays) |
| g | Sync by ids on a series | fetches it as a movie (an existing bug that `Sync selected` would hit) |

**The rules** (decided as defaults; the owner redirects, 2026-10-17):
1. A row an admin has edited records **which fields** (`edited_fields`). A sync merges the source under those fields and
   never overwrites them. This applies to synced channels and to titles alike, in the one place each is written.
2. A synced channel remembers the playlist's own name (`sync_name`) separately from its display name, and matches by
   `tvgId`, then `sync_name`. Renaming never breaks the match.
3. `prune` never deletes a row that has `edited_fields`; it counts it as `kept`.
4. **`Enabled` is a field on the record, drawn as a switch** (owner, 2026-10-17: "enabled/disable should be a checkbox on the record, not an
   entirely new section and category"). It replaces the tombstone, the "Ignored entries" group and the `Deleted` filter
   of the first version of this rule. A disabled channel or title stays in its list and is hidden from the public reads;
   a sync still updates it but never re-enables it. **Deleting a synced channel really deletes it**, and the next sync
   adds it again; the Delete tooltip on a synced row says so and points to `Enabled`. **Deleting a synced title** is
   different (D20, amended): its TMDB identity is recorded in `deleted_titles`, no browse, search, detail or sync stores it
   again, and `Restore` under `Deleted titles` lets it return.
5. `Revert` on an edited row clears its `edited_fields` (titles refetch from TMDB; channels take the next sync's values).
6. The ids scope takes a title id (`movie-603`, `tv-1399`), not a bare number.

### 3.11 Playlists and jobs: records with `Enabled` (decided, owner, 2026-10-17)

The syncs were environment variables read once at start (`TMDB_SYNC_SCHEDULE`, `PLAYLIST_SYNC_SCHEDULE`,
`PLAYLIST_URLS`) and two global status routes, so an admin could neither change a schedule, add a playlist, nor turn
one off. An admin app manages **records**. The owner: *"we need a jobs tab for the sync jobs, the title and playlist
should be crud for titles and playlists."* So there are two new record types: a **playlist** and a **job**.

- **Playlists** (`playlists` table): `id`, `name`, `address` (a secret: never returned, audited by host only, `https` only
  by the address rule of `03` 7.3), `enabled`, `created_at`. Routes (signed in, audited): `GET` and `POST
  /api/playlists`; `GET`, `PATCH`, `DELETE /api/playlists/:id`. An answer is `{ id, name, host, masked, enabled, channels,
  lastSyncedAt, lastOutcome }`; `PATCH` with `address` replaces it. Deleting a playlist keeps the channels it created and
  clears their `source`, so they become hand-made rows that no sync touches (the Delete tooltip says so). A disabled
  playlist is skipped by every job.
- **Jobs** (`sync_jobs` table): `id`, `name`, `type` (`playlist` or `catalog`), `enabled`, `schedule` (`"6h"`, `"30m"`,
  `"24h"` or `"off"`), `config` JSON, `last_run_at`, `last_outcome`, `last_counts` JSON, `created_at`. A playlist job's
  config is `playlistId`, `dryRun` and `prune`; a catalog job's is `scope` (`trending`, `popular` or `discover`), `kind`
  (`movie` or `tv`, unused by `discover`) and `pages` (each kind's cap; up to 500 for discover). Routes (signed in, audited): `GET` and `POST /api/jobs`; `GET`, `PATCH`, `DELETE
  /api/jobs/:id`; `POST /api/jobs/:id/run` (single-flight per job, `409 sync.busy`; a disabled job or a job whose
  playlist is disabled is refused with `422 job.disabled` and its reason). A playlist job syncs only its playlist, under
  the rules of 3.10; a catalog job syncs its scope.
- **Seeding** (first start only, from the environment): each `PLAYLIST_URLS` entry becomes a playlist and a playlist job
  for it (schedule `PLAYLIST_SYNC_SCHEDULE`); the catalog job - the library fill, scope `discover` - is created with
  schedule `TMDB_SYNC_SCHEDULE` when that is set, else `off` (runnable on demand). The four per-slice catalog jobs
  (trending and popular, movies and series) are retired (owner, 2026-10-17): no longer seeded, existing records deleted. The existing `POST/GET /api/titles/sync` and `POST/GET /api/playlist-sync`
  keep working as thin wrappers over the same services the jobs use; they do not go through the job records.
- **Scheduling:** one timer for the whole backend, armed for the earliest due `enabled` job with a schedule; it runs that
  job, then re-arms (`01` section 4.4 still names two env-armed schedulers and must be amended to this one timer). A change to a job's `enabled` or `schedule`, or a
  playlist's `enabled`, re-arms at once, with no restart.
- **`Enabled` everywhere:** `channels.enabled` and `titles.enabled` are new columns (default on). The public reads
  (`GET /api/channels`, `/api/titles*`) leave disabled rows out, so the fileserver sees only enabled ones; the admin reads
  (`GET /api/admin-channels`, and the title reads with an admin's token) include them. Providers already have `is_active`
  and accounts `disabled`; the admin shows both as the same `Enabled` control, inverted for accounts.
- **Not settings:** `PLAYLIST_SYNC_MAX_BYTES`, `PLAYLIST_SYNC_MAX`, `LOGO_INDEX_TTL_HOURS`, `TMDB_READ_TOKEN`, `OMDB_API_KEY`
  and the port, host, TLS and JWT variables stay environment-only. (The TMDB and OMDb keys are secrets that an admin may
  one day want to set from a page; that is a separate decision, D21.)

## 4. The admin app

### 4.1 Program and location (proposed)

- `D:\Projects\giga-stream-poc\src\admin-mockup\`: a plain HTML, CSS and JS clone of
  `D:\Projects\giga-stream-poc\src\mockup`, with its provider logic stripped (section 5). It is the design authority for
  the admin app. It is never packaged and sits outside the program rules (`01` section 3, the mockup row).
- `src/admin/` in `giga-stream`: React 19, Vite, TypeScript strict, Tailwind 4 tokens, zustand, framer-motion,
  lucide-react, and the family ui kit copied from `src/frontend/src/components/ui` verbatim (`23`). `services/api.ts` is
  the only network layer; no polling, no socket, no browser storage (`01` section 4.4). Built after the mockup is
  accepted and the backend merge has landed.
- **Served:** in production by the backend at `/admin/` from `ADMIN_DIST` (the same origin, so no CORS), the pattern the
  fileserver uses for the interface (`03` section 1). In development, Vite on a new port, 5172 proposed (D8, D9).
- **The backend gets an Electron host** (owner, 2026-10-17: "add electron to the backend server"). Electron code lives only
  in the backend's `src/app` folder, as in the fileserver (`01` section 4.2, which today confines Electron to
  `src/fileserver/src/app` and must be amended; NOT built yet, `28` and `29` plan it): a main process that opens one window on the
  backend's own `/admin/` page and answers the preload's IPC (the native folder picker for `Choose`, the window-overlay
  colours for the caption buttons). Started as a plain server (`npm start`) the backend stays headless and serves the same
  pages to a browser, where `Choose` is not available (a typed path only). **The backend app closes to the tray** (owner,
  2026-10-17: "backend server should close to tray"): the window's close button hides the window and the backend, with
  every live channel it is running, keeps running; a tray icon (tooltip `Giga Stream Admin` and the backend's address)
  opens the window again on a click, and its menu has `Open Giga Stream Admin` and `Quit`; only `Quit` stops the backend
  and exits (when the app only attached to an already running backend, `Quit` stops nothing but itself). A second launch
  shows the existing window instead of starting another. The admin is not part of the desktop app's
  installer (`AGENTS.md`, Commands): the backend ships separately.

### 4.2 Shell (proposed; `02` section 1, `06` section 1)

The window is a titlebar (40px), the active page, an optional events band (160px) and a statusbar (24px). The admin
runs in the backend's Electron window (a browser tab when the backend runs headless); in Electron the caption buttons
follow the theme through the preload's overlay colours (4.1). The minimum size is 900 x 640.

- **Titlebar** (as `docs/reference/family/datasets-index.jpg`): far left, the left-pane toggle (ghost icon button),
  then the brand: an accent icon tile and the two-line mono wordmark `GIGA / STREAM` with the mono subtitle `ADMIN`.
  **Centre: the tab pill**, a recessed rounded track holding **Channels · Providers · Titles · Playlists · Jobs ·
  Accounts**, the active tab the filled chip. Every tab is open to every signed-in admin. Right: the
  events-band toggle and the right-pane toggle (disabled, with its reason, where a page has no right pane). The pill is
  the only navigation between tabs; there is no router and no URL segment (`04` section 1); `Ctrl+1` to
  `Ctrl+6` pick the tabs. **There is no persistent navigation rail** (the owner's correction, 2026-10-17, after seeing the
  first mockup: the tabs are at the top, as in the family).
- **Left pane:** present only on a workspace, where it is that workspace's rail (`‹ Channels` escape button above the
  section links; family `NavRail`). An index has no rail.
- **Centre:** the active tab's index or workspace, under a toolbar strip. Pages stay mounted, so scroll and form state
  survive a tab switch. Opening a workspace is a store request, as `requestLibrary` is in `02`.
- **Statusbar:** running work first (the channels `preparing` or `starting`, shown as `N preparing` over a pulsing
  full bar because their progress is unknown, and **Stop**, disabled with the reason "No route stops a channel build yet."
  The engine can abort one channel's build (`channel-runtime.ts` keeps an `AbortController` per channel), but no route
  exposes it; section 4.12 item 7); then one polite notice line; then `Events` and `Settings`.
- **Events band** (160px above the statusbar, `06` section 7): mono rows of time, tone word, area (Channel, Provider, Title,
  Playlist, Job, Account, Session, Connection), the normalised sentence; at most 200 rows; **Clear**; shimmer lines when empty.
- **Settings window** (a modal work window, `06` section 6.1, the interface's `SettingsWindow` frame from the shared
  library): Appearance (theme, accent, reduce motion, interface zoom), Session (who is signed in; **Sign out**), About
  (version, backend revision, the address in use).
- **Persistence** (decided, owner, 2026-10-17: the Settings window and its persistence were a gap; D16): the admin saves
  its settings the way the interface does, to its own server. The backend keeps ONE row per signed-in account in a new
  table (`admin_ui_state`: `account_id`, `settings` JSON, `shell` JSON, `updated_at`; migration 017) behind
  `GET /api/auth/me/state` and `PUT /api/auth/me/state` (signed in, whole-document write with the interface's
  write-back rules: committed on change, one request at a time, a refusal rolls the field back and posts a notice).
  `settings` holds theme, accent, reduce motion and zoom; `shell` holds the last tab, which workspace panes and the
  events band are open and their sizes, and the work windows' remembered bounds. Reads happen once after sign-in; until
  then (the sign-in screen) the defaults apply (dark, amber). Nothing is stored in the browser (`01` 4.4) and nothing in
  Electron's profile. The pattern is the interface's `/api/settings` and `/api/shell-state` hydration and write-back
  hooks (`22`), pointed at these two routes.

### 4.3 Sign-in gate (proposed)

Without a session the centre is a sign-in page (username, password, one primary `Sign in`, and a `Forgot password?` link to the reset views of `40`). It is a page, not a modal; the
titlebar and statusbar stay. It calls `POST /api/auth/login`. The access token lives in memory; where the refresh token
lives is D5. A 401 on any call returns to the gate with the reason on the notice line.

### 4.4 The page model: one record pattern for every tab (owner rules, 2026-10-17)

The first pages mixed control panels into indexes, invented an "Ignored" section and a "Deleted" chip, and put fields in a
different order on every page. The owner: *"enabled/disable should be a checkbox on the record, not an entirely new
section and category. ... the controls orders are not consistent, they dont start with the important and required fields
up top. ... none of these pages are proper indexes following the family pattern, taking me to the workspaces."* Every tab
is now the family's record pattern and nothing else:

1. **An index is three things:** the toolbar strip (one forward verb), a **New <record>** group, and the **list group**.
   The New group holds only the required fields and one primary `Create`. Nothing else is on an index: no sync panel, no
   status panel, no schedule panel.
2. **A click on a row opens that record's workspace** (the rail with `‹ <Tab>`, its sections, one scrolling page,
   `Discard changes · Save · <forward verb>`). Everything that configures or acts on a record is in its workspace.
3. **`Enabled` is a switch on the record** (the family's `Toggle`, the boolean control of the family screenshots such as
   "Snap to buckets"; owner, 2026-10-17: a checkbox does not make sense for an enabled/disabled control), never a
   section, chip, tab or category. The tick boxes in an index list's first column are row selection for the toolbar
   verbs, not `Enabled`. A
   disabled record stays in its list, dimmed, with the state word `disabled`.
4. **One field order, everywhere:** (1) the identity and required fields, in the order a person decides them; (2)
   `Enabled`; (3) the optional fields, most used first; (4) read-only facts last. The New form is group (1) only, and the
   same fields come first in the workspace's Details, in the same order.
5. **State is a word in the list** (`live`, `preparing`, `failed`, `disabled`, `edited`, `manual`), never a section.
7. **One form pattern** (owner, 2026-10-17, after the six New forms disagreed: the Kind or Type selector was first on
   Channels and Jobs, second on Titles, third on Providers and Accounts; selectors were 126 to 151 px wide while every
   input spanned the row; info glyphs sat on arbitrary rows; Playlists used different row markup):
   - **Row 1 is always the record's name** (Name, Title). **Row 2 is the Kind, Type or Family selector** when the
     record has one that changes the rows below it (Channels: Kind; Providers: Family; Jobs: Type); the rows it switches
     follow it directly. A selector that does not switch rows (Titles' Kind) is an ordinary field and sits
     where the field-order table puts it.
   - **Every control spans the row at 36px**, a Segmented included (equal segments). The one exception is a Toggle.
   - **An info glyph sits on every row except a row labelled Name, Title, Username or Password** (their labels explain
     themselves); every other row has one.
   - **One row markup for every form and workspace:** `<div class="row"><label>Label ⓘ</label><div class="control">…</div></div>`,
     with a label element on every row (a Segmented row's too) and `.row-field` for a trailing button. No page builds its
     own variant.
   - **A form is checked by measurement, not by eye:** the coordinator runs one probe over all six New forms (row order,
     control types, widths, glyphs, markup) and every form must produce the same shape.
6. **Every tab is a record type with an index and a workspace.** The audit log is not a record type an admin works on, so
   it is not a tab: it is the Events drawer (4.9).

| Tab | Record | List columns (after the checkbox) | Workspace rail | Index forward verb | Who |
|---|---|---|---|---|---|
| **Channels** | a channel, live or stream | name, category, kind, state, mode, now playing | details · source · playback · fault · status (a stream channel: details · stream · status) | `Preview →` | signed in |
| **Providers** | a provider | order, name, source, family, state | details · templates · player | `Titles →` | signed in |
| **Titles** | a title | title, kind, year, rating, state | details · people and plot · seasons · sources | `Jobs →` | signed in |
| **Playlists** | a playlist (an M3U address) | name, host, channels, last synced, state | details · status | `Jobs →` | signed in |
| **Jobs** | a sync job (a playlist sync or a catalog sync) | name, type, target, schedule, last run, outcome, state | details · schedule · run · last run | `Run job` (acts on the ticked jobs) | signed in |
| **Accounts** | an admin account | username, state, last sign-in | details · password | none (the last tab, as Studio is the family's) | signed in |

**The tab pill is Channels · Providers · Titles · Playlists · Jobs · Accounts** (owner, 2026-10-17: "we need a jobs
tab for the sync jobs, the title and playlist should be crud for titles and playlists"). Titles and Playlists are plain
CRUD records. **Jobs** holds the syncs: each sync is a record with its own schedule, `Enabled` and `Run job` (3.11), so
an admin starts, schedules, enables and disables a sync the same way as anything else, and nothing about syncing sits on
the Titles or Playlists pages.

**Field order per record** (this is the order of the New form and of the workspace's Details group; `*` = required):

| Record | 1. Required | 2. Enabled | 3. Optional, most used first | 4. Read-only |
|---|---|---|---|---|
| Live channel | Name*, Kind*, Category*, Source* (Folder or Videos, then the path or list) | `Enabled` | Mode, Captions, Qualities, Logo | Id, State, Renditions, Playlist, Stream address |
| Stream channel | Name*, Category*, Stream address* (no Number: removed, owner, 2026-10-17, there is no guide) | `Enabled` | Logo address | Id, Synced from |
| Provider | Name*, Family*, Source*, Movie template* (embed) | `Enabled` | Order, Episode template, Start parameter, Subtitle parameter, Origin, Frame origins, Message shape | Created |
| Title | Title*, Kind*, Year* | `Enabled` | TMDB id, Rating, Genres, Runtime, Poster, Backdrop, Plot, Cast, Stream address, Seasons | State, Sources |
| Playlist | Name*, Address* | `Enabled` | none | Host, Channels, Last synced, Outcome |
| Playlist job | Name*, Type*, Playlist* (a select of the playlist records) | `Enabled` | Schedule, Dry run, Prune | Last run, Outcome, Counts |
| Catalog job | Name*, Type*, Scope* (Trending, Popular or Library), Kind* (not asked for Library) | `Enabled` | Pages, Schedule | Last run, Outcome, Titles |
| Account | Username*, Password* (New only; no Name: removed, owner, 2026-10-17) | `Enabled` | none | Last sign-in, Security question (`Set` or `Not set`) |

### 4.5 Channels index (proposed)

- **Form at the top** (one `Group`, "Create channel"): kind (Segmented: Live or Stream; Stream shows an address field,
  Live shows its source); name; category (select of six); number; id (kebab-case, live only); mode (Segmented: Loop or
  Encode; the cost is a tooltip); captions (Toggle); qualities (ChipGroup, at least two); source (Segmented: Folder or
  Videos, then a path field or an ordered list). One commit at the end of the group: `Create`, the one primary. A
  refusal names its field, on the notice line and beside the row.
- **Folder row = the family pattern** (`datasets-index.jpg`, `06` section 6.3 "Folder ... Choose"): the info glyph after
  the label, the mono field spanning the row, and a bordered icon-and-text button at the row's trailing edge: a folder
  glyph and `Choose`. The same row and button are used for the Source group's Folder in the workspace, and the Videos
  list's add row uses it for a file. `Choose` opens the native folder picker (D18, decided by the owner): the admin
  runs in the backend's own Electron window (4.1), so the main process's `dialog.showOpenDialog` answers with a path on the
  backend's machine, exactly as the desktop app's pickers do. There is no popup and no directory-listing route.
- **List group below** ("Channels", with `Refresh` in its heading's action slot), no rail: a checkbox first column,
  then number, name, category, kind (a word), state (a word with a left-edge accent strip; a stream row shows "Synced"
  when it carries a `source`), mode, now playing, fault (a word, only when set). Ticking a row arms the toolbar verb;
  clicking the row opens its workspace (no `Open` button, no double-click). At the row end, `Delete` as an
  `ArmedButton` naming the channel.
- **Toolbar** (the strip above the groups, as `datasets-index.jpg` and `training-index.jpg`): right only, ONE forward
  verb in the filled accent, `Preview →`, acting on the ticked channel (it opens the Preview window, 4.5a; disabled, with its
  reason, when no row or more than one is ticked). Nothing else is in an index toolbar.
- Loading and empty show skeleton rows. No sentence sits over them.

### 4.5a The Preview window (decided, owner, 2026-10-17)

The owner: *"we can preview the channel once we save it; it can be a popup or child window, it doesn't need to be a full
page; just a simple preview to make sure it works, in the family style and grammar."* `Preview →` (the Channels index's
toolbar verb for the one ticked channel, and the workspace toolbar's verb once the channel is saved) opens a **child work
window** (the shared library's `ChildWindow`, moved by its header, resized by its edges, closed by its `X` or `Escape`,
focus returned to the opener; `06` section 9) titled `Preview`, standard size, holding:

- a 16:9 video that plays the channel: a live channel through its own `masterUrl` (`/live/<id>/master.m3u8` on the
  backend's origin), a stream channel through its `streamUrl`; HLS through the same player library the interface's
  `LivePlayer` uses (`hls.js`, or the browser's native HLS where present), muted until the person unmutes, with the native
  controls;
- under it, ONE mono status line from what the player and `GET /api/admin-channels` say: the channel's state
  (`preparing`, `starting`, `live`, `restarting`, `stopped`, `failed`) and its `problem`, and the player's own error when it
  cannot load or play (`manifest failed`, `media error`, an unreachable address), with a ghost `Retry` verb beside it. While
  the channel is `preparing` or `starting` the stage shows skeleton, never an empty card.
- no other controls: no quality picker, no fault injection, no test page. It does not depend on `TEST_PAGE` and needs no
  `/healthz` field. The backend's `/test/player.html` stays for development and is not used by the admin.

It opens on a channel that exists and is saved; a `failed` or `stopped` channel still opens it and says why. Closing the
window stops the playback. Its bounds are remembered with the other work windows (4.2 Persistence).

### 4.6 Channel workspace, live (proposed)

- **Rail** (the left pane, `dataset-workspace.jpg`): `‹ Channels` as a full-width edged button above the list, then the
  sections **details · source · playback · fault · status** as plain links, the current one in the accent with a
  left-edge strip. The rail scrolls one centre page; it does not swap the stage (the family rule, lora `06` section
  1a).
- **Centre:** one scrolling `Form` page of groups.
  - **details:** name, category, number, id (read-only after create), logo (a preview).
  - **source:** Segmented Folder or Videos. A folder field. Or the ordered video list: add by path, remove, move up and
    down. A changed source saves and rebuilds, which shows `preparing`.
  - **playback:** mode, captions, qualities. The tooltips carry the cost (loop is cheap; encode is a real-time ffmpeg
    per channel, `10` section 2).
  - **fault:** removed from the admin, owner 2026-10-17 (the backend keeps its routes). Was: a select of the seven faults, a duration, a delay, `Apply` and `Clear`. The tooltip marks it a test tool.
    `Apply` is disabled, with its reason, while the channel is not live.
  - **status** (read-only; skeleton while `preparing`): the state word, the `problem` sentence (only when `failed`, a
    line in the body), renditions, the playlist (ordered rows with durations; the playing one carries the accent strip),
    and the stream address with a copy icon.
- **Toolbar** (as `training-workspace.jpg`), right: `Discard changes` (ghost), `Save` (edged), then `Preview →`, the
  forward verb in the filled accent, which opens the Preview window (4.5a) for the saved channel; it is disabled, with
  the reason "Save the channel first", while the page has unsaved changes or is a New form. `Rebuild` is a pressed verb in the source group's action slot. ONE Save for the page, because a
  channel is a single PATCH.
- **No delete here.** Delete lives on the index row (the family rule).

### 4.7 Channel workspace, stream (proposed)

Rail: details, stream, status. Details: name, category, number, logo. Stream: the stream address and logo address, each
checked against the address rule, the refusal shown as a field error. Status: `Synced from <host>` when the row has a
`source`; synced rows are read-only with the tooltip "Owned by the playlist sync" (D15). Toolbar as the live one, without
`Rebuild` and `Preview`.

### 4.8 Accounts index and workspace (proposed; owner)

- **Index:** New account (Name, Username, Password of 1 to 256 characters, `Create`);
  the list (username, name, state, last sign-in); row end `Delete` as an `ArmedButton` (the last enabled account's
  refusal is that row's disabled reason). The toolbar strip has no verb: Accounts is the last tab.
- **Workspace:** rail `‹ Accounts`, then **details** (Name, Username, `Enabled`; the stored `disabled` flag, shown
  inverted) and **password** (`Set new password`, whose tip says it signs this account out everywhere). Toolbar:
  `Discard changes`, `Save`.

### 4.9 The audit log is the Events drawer (decided, owner, 2026-10-17)

The owner: *"audit events should display in the event drawer, not have a full tab; it is not a workspace item, I can't do
anything on this screen."* So there is no Audit tab, index or workspace.

- **The Events drawer** (the 160px band above the statusbar, `06` section 7, `events-drawer.jpg`) shows the backend's audit
  entries as its rows, with the page's own notices and failures: time, tone word, area (Channel, Provider, Title,
  Playlist, Job, Account, Session), and one plain sentence built from the entry (`ada@example.test updated channel
  Fixture News`). `auth.login_failed` and failed syncs are `warn` or `error`; everything else `info`.
- **Where the rows come from:** `GET /api/audit` (any signed-in admin, `03` 7.13), read when the drawer opens, after the page's own
  writes, and by `Refresh`; never on a timer (`01` 4.4). The newest row is at the foot. A `Load older` row at the top reads
  the next page (`before`). **Clear** empties the list on screen only. At most 200 rows are held.
- There is no filter, as the family drawer has none. A row carries the subject's name so a person can find what changed;
  rows are not links.

### 4.9a Providers index and workspace (proposed; `03` section 7.2b)

- **Index:** New provider (Name, Source, Family Segmented Embed or Stream, Movie template for an embed provider, `Create`);
  the list (order, name, source, family, state); row end `Delete` as an `ArmedButton`. Toolbar: `Titles →`.
- **Workspace:** rail `‹ Providers`, then **details · templates · player**. Details: Name, Source, Family, `Enabled`
  (the stored `is_active`), Order. Templates: Movie template, Episode template (the `{tmdbId}` / `{season}` /
  `{episode}` placeholders are in the info tip), Start parameter, Subtitle parameter. Player: Origin, Frame origins (a
  chips input), Message shape. Toolbar: `Discard changes`, `Save`, `Titles →`. `PUT` is the save.
- **There is no API key.** Providers are embed or stream templates; nothing in the product reads a provider's key. The
  stored `api_key` field (`03` 7.2b) is dead and is removed (D24).

### 4.9b Titles (proposed; `03` sections 7.4 and 7.6b)

A title is a record, like a channel. There is no sync panel on this tab; syncing is the **Jobs** tab (4.9c).

- **Index:** New title (Title, Kind Segmented Movie or Series, Year, `Create`); the list group (title, kind, year, rating,
  state: `synced`, `edited`, `manual` or `disabled`) with a search field, kind chips and a sort Segmented in its heading
  area and `Older` / `Newer` in its action slot; row end `Delete` as an `ArmedButton`. Toolbar: `Jobs →`.
- **Workspace:** rail `‹ Titles`, then **details · people and plot · seasons · sources**. Details: Title, Kind (fixed after
  create), Year, `Enabled`, then TMDB id, Rating, Genres, Runtime, Poster address, Backdrop address, Stream address.
  People and plot: Plot, Cast. Seasons (a series): an editable ordered list. Sources: the stream sources the providers
  produce, read-only because they are derived. Toolbar: `Discard changes`, `Save`, `Jobs →`.
- **An edited synced title** is marked `edited`; the sync never overwrites its edited fields (3.10). `Revert to TMDB` in
  Details' action slot drops the edits and refetches; it is disabled, with its reason, for a manual title. `Delete` on a
  synced title says in its tooltip that the next sync adds it again and points to `Enabled`.

### 4.9c Playlists and Jobs (proposed; `03` sections 7.2c and 7.6b; backend 3.11)

**Playlists** are a plain CRUD tab, like Providers.

- **Index:** New playlist (Name, Address, `Create`); the list (name, host, channels, last synced, state); row end `Delete`
  as an `ArmedButton` (the tooltip says the channels it created stay, as hand-made rows). Toolbar: `Jobs →`.
- **Workspace:** rail `‹ Playlists`, then **details · status**. Details: Name, Address (masked, with `Replace`, never
  shown back), `Enabled`. Status (read-only): host, channels synced from it (each a link to its channel), last synced,
  outcome. Toolbar: `Discard changes`, `Save`, `Jobs →`.

**Jobs** hold the syncs. Nothing about syncing sits on the Titles or Playlists pages.

- **Index:** New job (Type Segmented Playlist or Catalog; Name; then, for a playlist job, Playlist (a select of the
  playlist records), and for a catalog job, Scope Segmented Trending, Popular or Library — Kind Segmented Movies or
  Series, not asked for Library;
  `Create`); the list (name, type, target, schedule, last run, outcome, state: `idle`, `running`, `failed` or
  `disabled`); row end `Delete` as an `ArmedButton`. Toolbar: `Run job`, the verb in the filled accent, acting on the
  ticked jobs (like `Start training`); disabled, with its reason, when none is ticked or a ticked job is disabled, already
  running, or has a disabled playlist.
- **Workspace:** rail `‹ Jobs`, then **details · schedule · run · last run**. Details: Name, Type (fixed after create),
  Playlist (a select) or Scope and Kind (a catalog), `Enabled`, Pages (a catalog). Schedule: the interval (`6h`, `30m`,
  `24h` or `off`; a bad value is a field error). Run: a playlist job has `Dry run` and `Prune` (the tip says it deletes
  synced channels whose entry vanished, and that edited ones are kept) and `Run job`; a catalog job has `Run job`. Last run
  (read-only): the state word, when it ran, the outcome sentence, and the counts (a playlist job: created, updated, kept,
  skipped, refused, removed, with the refusal examples and the created ids, each a link to its channel; a catalog job:
  titles stored and stale). Toolbar: `Discard changes`, `Save`, and the forward verb `Channels →` (a playlist job) or
  `Titles →` (a catalog job).
- `409 sync.busy`, `503 tmdb.unavailable`, `503 playlist.unreachable` and `422 playlist.invalid` are shown as the field
  error on `Run job`.

### 4.10 Empty, loading and failure (proposed)

Loading and empty draw skeletons in the page's own shape; no sentence sits over a skeleton. A failed read keeps the last
good content and sets one notice (`06` section 2, rule 2). An unreachable backend leaves the tab pill and statusbar in
place, keeps the last content, and disables writes with their reason.

### 4.11 What the admin app does not have

The public channel viewer or player; a second sign-in; polling or a socket;
browser-stored tokens (D5); modals or confirm dialogs other than the Settings work window (inline two-step only); a
Refresh in a toolbar; text under a control; a dot for state.

### 4.12 Limits and gaps (verified 2026-10-17)

Every place the admin cannot do what an admin should, why, and what would lift it. Nothing here is read-only because
of taste; each row names its source. The first draft of this plan had no such list, and several limits appeared only
as page behaviour in the mockup.

| # | Limit | Source | What it blocks | Lifted by |
|---|---|---|---|---|
| 1 | **Nothing pushes state to the page.** The backend has no socket and no streamed status route (`03` 7.8, removed); `01` 4.4 forbids polling and timers in the interface. | the docs, verified in the routes | State words that change on their own: a channel going `preparing` to `live`, a sync `running` to finished. The page learns only on an action of its own or `Refresh`. The mockup shows state changing by itself, which the real app cannot do under today's rules. | D19: a streamed status route, or an amendment |
| 2 | **Titles had no write route (lifted, built).** The store mirrored TMDB; "nobody adds a title" (`03` 7.6b); a sync replaces stored payloads, so an edit would be lost. | a documented design decision, not a technical impossibility | Create, edit and delete of a title | **Decided (D20): titles are ordinary records.** `POST`, `PATCH`, `DELETE /api/titles`; a sync never overwrites a title or field an admin edited |
| 3 | **A playlist sync overwrote `streamUrl`, `logoUrl`, `category` and `number` of a synced row (lifted, built)** (verified in `playlist-sync-service.ts` before the rules), re-creates a deleted one, and duplicates a renamed one. | the sync's design | Reliable edit and delete of a synced channel | **Decided: the rules of 3.10** (edited fields, `sync_name`, `Enabled`, `prune` skips edited rows) |
| 4 | **A folder is a path on the backend's machine.** A plain browser cannot return one from a native dialog. | the architecture | A working `Choose` button | **Decided (D18):** the admin runs in the backend's own Electron window, so `Choose` is the native picker |
| 5 | **Restarting the backend stops every live channel** until it rebuilds. | the merge (D4) | Restarting to apply config without a stream gap | keeping the engine as a supervised child |
| 6 | **The admin had nothing to persist its settings to.** Browser storage is forbidden (`01` 4.4) and the backend had no settings row. | `01` 4.4 | Remembered theme, tab, panes | **Decided (D16):** a per-account `admin_ui_state` row, `GET`/`PUT /api/auth/me/state` (migration 017; planned in `29`) |
| 7 | **No route stops one channel's build.** The engine holds an abort per channel, but only the whole-process shutdown and a PATCH or DELETE of the channel use it. | verified in `channel-runtime.ts` and the route list | The statusbar `Stop` | a stop route |
| 8 | **A provider's `api_key` was stored but never used (lifted, built).** Nothing in the backend, fileserver or interface read it; migration 016 dropped it. | verified in the code | A key field on the provider form | D24: removed |
| 9 | **The refresh token has no safe browser home** under the no-storage rule. | `01` 4.4 | Staying signed in across a reload | D5 |

Items 2, 3 and 7 are backend work, and item 1 is a design decision that changes what every page can show. They are
decisions for the owner, not defaults for a worker to take.

## 5. The mockup, `D:\Projects\giga-stream-poc\src\admin-mockup`

**Source (verified 2026-10-17):** `D:\Projects\giga-stream-poc\src\mockup`. Its family shell is: `css/tokens.css`,
`base.css`, `fonts.css` with `fonts/*.woff2`, `controls/buttons.css`, `fields.css`, `indicators.css`,
`shell/frame.css`, `shell/statusbar.css`; `js/core/dom.js`, `bus.js`, `state.js`, `event-log.js`, `load-partials.js`,
`app.js`, `statusbar.js`; `html/titlebar.html`, `statusbar.html`, `logs.html`; lucide icons by script tag. Its provider
logic is `providers.js`, `embed.js`, `frame-guard.js`, `messages.js`, `guards.js`, `runtime.js`, `picker.js`,
`checks.js`, `checklist.js`, `results.js`, `availability.js`, `query.js`, `build-providers.mjs`, `check*.mjs`,
`network-rules.cjs`, `data/`, `results/`, `css/poc/` and the picker, stage and checklist partials.

| Source | Admin mockup | Action |
|---|---|---|
| `css/tokens.css`, `base.css`, `fonts.css`, `fonts/`, `controls/*` | same | copy verbatim; fonts are binary, copied by the worker's shell |
| `css/shell/frame.css`, `statusbar.css` | same | copy verbatim; the titlebar pill is unused |
| `css/styles.css` | same | rewrite the import list for the admin |
| `js/core/dom.js`, `bus.js` | same | copy verbatim |
| `js/state.js`, `js/app.js`, `js/config.js`, `js/load-partials.js`, `js/statusbar.js`, `js/event-log.js` | same | adapt: tabs, selection, the shell, no provider logic |
| `html/titlebar.html`, `statusbar.html`, `logs.html` | same | adapt to 4.2 (the events band replaces the two logs) |
| the provider files listed above | none | not copied |
| none | `css/admin/*.css` | the form grammar (Workspace, Group, Row, Actions), the grid, skeletons, the rail, the work window |
| none | `html/channels-index.html`, `channel-workspace.html`, `channel-workspace-stream.html`, `providers-index.html`, `provider-workspace.html`, `titles-index.html`, `title-workspace.html`, `playlists-index.html`, `playlist-workspace.html`, `jobs-index.html`, `job-workspace.html`, `accounts-index.html`, `account-workspace.html`, `signin.html`, `settings.html` | new, per section 4 (one record pattern, 4.4) |

**Mockup versus interface differences, resolved to the interface** (owner, 2026-10-17): the Segmented control is the
interface's rounded pills (the mockup drew a bordered rectangle); `Enabled` is the family `Toggle` switch (the mockup drew a
checkbox); durations, the raised `Button`, the input focus ring and the tab pill's equal-width grid follow the interface
(`27` section 1 lists them). The mockup's tooltip arrow that follows its anchor is kept.

The pages use the family classes (`.btn`, `.icon-btn`, `.inp`, `.seg`, `data-active`, `data-on`) and add no second
control system. Toolbars are icons with tooltips; no text sits under a control; skeletons are the empty state; fixture
rows are marked as fixtures in a comment. The mockup is the look and the grammar, not the wiring. The partial loader uses
`fetch`, so it is served over http.

## 6. Delegation and waves (`07` section 6)

### 6.1 The split and who owns which path

| Piece | Worker | Where it works | Paths it may change | Off limits |
|---|---|---|---|---|
| Admin mockup | **M** | `D:\Projects\giga-stream-poc\src\admin-mockup` (new folder; that tree is not a git repository, so there is no worktree and no branch) | `giga-stream-poc/src/admin-mockup/**` | everything else, including `giga-stream-poc/src/mockup/**` and all of `giga-stream` |
| Backend merge | **B** | worktree `D:\Projects\.giga-worktrees\backend-merge`, branch `admin/backend-merge` | `src/backend/**`; `scripts/check-rules/**` only if a rule must learn the new layout, listed in the report | `src/live-server/**`, `src/fileserver/**`, `src/frontend/**`, root `package.json`, `docs/**` |
| Retire the live server | **R** | worktree `...\.giga-worktrees\retire-live`, branch `admin/retire-live` | `src/live-server/**` (delete), root `package.json`, `scripts/**` that name it | `src/backend/**`, docs |
| Admin shell and Channels | **A** | worktree `...\.giga-worktrees\admin-app`, branch `admin/app` | `src/admin/**` (new); the admin lines of root `package.json` | every other program, docs |
| Accounts, Jobs and the remaining tabs | **A** (continued) | the same worktree | `src/admin/**` | as above |

One worker per real sub-project (`07` 6.1): the backend merge is one worker and the admin app is one worker. The
coordinator never splits one piece, and owns all docs, landing, real checks, visual acceptance and the report.

### 6.2 Baseline

Worktrees are cut from a commit, so the baseline is committed first on `family-port` (every later worker is cut from the
then-current HEAD, never from uncommitted work). The first baseline, `admin-baseline`, was made on 2026-10-17 for Waves 1b
and 2; both have landed and been merged into `family-port`.

### 6.3 Waves and landing order

| Wave | Who | Delivers | Depends on | Accepted when |
|---|---|---|---|---|
| 0 | coordinator | this plan, `admin-baseline`, the worktree | - | done |
| 1a | **M** | the admin mockup (section 5) | the plan | the coordinator has served it (asking the owner first), compared it with section 4 and the family mockup in the connected Chrome MCP at 1600 x 1000 and 900 x 640, and the owner has seen it |
| 1b | **B** | the merged backend (section 3), `/admin/` static route, tests written | the plan, defaults D1 to D4, D12 to D15 | typecheck, lint, `check-rules` clean in its report; then the coordinator's gate, a real run on a free port with a temporary `DATA_DIR` (a channel built from the fixtures, its streams played, 401 without a token, no ffmpeg left at stop), and `10` section 5 re-run |
| 2 | **R** | `src/live-server` removed; scripts, ports and kill-ports updated | 1b landed; the owner's approval (it deletes a program) and D13 settled | the gate passes with the program gone; `npm run dev` starts without it |
| 3 | **A** | `src/admin`: shell, sign-in, Channels index and both workspaces | 1a accepted, 1b landed | gate; Chrome MCP visual acceptance at both sizes against the mockup (`07` section 5); the real wire against the merged backend |
| 4 | **A** | the remaining tabs (Providers, Titles, Playlists, Jobs, Accounts), the audit rows in the Events drawer, the Settings window | 3 landed | the same |

**Status (2026-10-17):** waves 0, 1b and 2 are landed. Wave 1a's mockup exists and was reviewed by the owner (roles, the
API key, the segmented control and the Enabled control were corrected afterwards). Waves 3 and 4 are replanned: the admin is
built on the shared UI library (`27`), customised from the template for visual parity (`28`), then wired to the backend
(`29`), with the backend's Electron host (4.1) added by the first of those workers.

Landing order: 1b, then 2, then 3, then 4; 1a lands (is accepted) before 3 starts. Wave 1a and 1b run in parallel
because they share no path. A failed check goes back to the same worker with the exact output (`07` 6.5).

### 6.4 The briefs

Each brief has the six parts of `07` section 6.2: where; rules; role; read first; scope; report. The common rules, quoted
in every brief: edit with the editor tools one file at a time and never write a script that writes source; commit on the
branch and never push, merge or rebase; do not run the test suite, start a program, open a browser or take a screenshot;
never edit a document; take the simplest reading where the docs leave a gap and list it in the report; preserve unrelated
work.

- **M:** read `AGENTS.md`, `07`, this document sections 1, 4 and 5, `02` section 1, `06` sections 1, 2 and 7, `01`
  section 9, lora `06` sections 1a and 2.4b, then the source mockup. Build section 5's table.
- **B:** read `AGENTS.md`, `07`, `01` sections 4 and 7, `03` sections 1 and 7, `10`, this document section 3, then the
  two servers' code. Build section 3.
- **R:** read `AGENTS.md`, `07`, this document 3.7, `10` and the root `package.json`.
- **A:** read `AGENTS.md`, `07`, `01`, `02`, `04`, `06`, `23`, this document section 4, the mockup folder, then the
  frontend's `components/ui` and `components/chrome`.

## 7. Verification

- Each wave: the gate (`node scripts/check/gate.mjs`) prints `gate: PASS` and its result is reported as it ran. Real-wire
  checks run the programs on free ports with temporary data, never the owner's `~/.giga-stream-live`, `~/.giga-stream-admin`
  or running app. A frontend wave also gets Chrome MCP acceptance at both required sizes with a console and network check.
- A route parity table: each row of 3.3 and of `10` section 3.1 has a test on the merged backend.
- Stop processes by PID, never by image name.
- The coordinator asks before starting any program the owner did not ask for.

## 8. Risks

1. A backend restart stops every live channel (D4).
2. In-process ffmpeg could starve the admin API. Each encode runs as its own child with a concurrency cap; measure in 1b.
3. `01` section 4.4 allows only two timers; encoder supervision and restart backoff need an amendment (section 11).
4. The `rootDir` change (3.8) alters the production start path; test it before the merge lands.
5. Loopback-only writes were the live server's only protection; every JWT-gated write route needs its tests.
6. Worker B's branch lacks the owner's uncommitted title edits; the merge must be checked for overlap.
7. The mockup worker cannot see a browser, which is the failure `23` section 1 records; the coordinator's Chrome check at
   landing is the only visual gate, so defects come back to M with screenshots.

## 9. Out of scope

Changes to the desktop app (`src/fileserver`) beyond
what the fileserver already tolerates; TMDB; payments; multiple admin tenants; a public channel browser.

## 10. Owner decisions

Each has a recommended default. The waves proceed on the defaults and are redirected if the owner says otherwise.

- **D1.** One channels table with a `kind` column (recommended), or two tables with a union read.
- **D2.** Live writes need a signed-in admin; the loopback-only gate retires (recommended).
- **D3.** Live stream addresses are built from the caller's origin at read time, and the address rule does not apply to
  them (recommended).
- **D4.** Accept that restarting the admin backend stops live channels (recommended). The alternative is keeping the engine
  as a child process the backend supervises.
- **D5.** The access token lives in memory only. The refresh token is an httpOnly, same-site cookie the backend sets
  (owner, 2026-10-18: a reload must not sign the admin out), so a reload restores the session with one silent refresh.
  The app code never touches `sessionStorage`, `localStorage` or `document.cookie`, which `01` section 4.4 forbids.
- **D6.** *(Retired.)* There is no Audit tab; the audit log is the Events drawer (4.9).
- **D23.** *(Retired with roles, D22.)* Every signed-in admin reads the audit log in the Events drawer.
- **D22.** *(Decided, owner, 2026-10-17: "i didnt ask for roles… that extra mess we dont need".)* There are no roles. The
  backend's `owner` and `editor` roles came with its first commit, not from the owner; they are removed: every signed-in
  admin account is equal and may do everything, accounts have a username (the sign-in name, not an email: owner, 2026-10-17), a password and `Enabled` (no separate name: removed, owner, 2026-10-17).
- **D7.** *(Reversed by the owner, 2026-10-17.)* Providers, Titles and Playlists are tabs in version one: an admin has to
  be able to start a sync from a page.
- **D8.** The production admin is served by the backend at `/admin/` (recommended).
- **D9.** The development admin uses Vite on port 5172; this needs a row in `03` section 1.
- **D10.** *(Reversed by the owner, 2026-10-17.)* The tabs are the titlebar's tab pill, as in the family. No persistent
  nav rail.
- **D11.** Fault injection is visible to every signed-in admin, marked as a test tool (recommended).
- **D12.** Live categories are the six fixed values; stream rows keep free text (recommended).
- **D13.** Your existing `~/.giga-stream-live` channels are imported once, by a script you run (recommended), or you start
  fresh. Wave 1b writes the script and does not run it on your data.
- **D14.** *(Corrected.)* The stream paths stay at root `/live/...` and `/logos/...`, the exception `01` section 4.3
  already allows (recommended). No move under `/api`.
- **D15.** *(Reversed.)* Playlist-synced rows are editable in the admin. The next sync overwrites four of their fields
  (4.12 item 3); a pinned flag would stop that and is a backend change.
- **D19.** *(Decided for version one.)* Saving works as in any admin app: a write answers with the saved record and the
  list shows it. Background state (a channel finishing its build, a sync finishing) is read again by `Refresh` and
  after the page's own actions, with no polling and no socket (`01` 4.4). Streaming the progress of an operation (4.12
  item 1, option B) is a later improvement, not a requirement.
- **D24.** *(Decided, owner, 2026-10-17: "providers dont even use api keys to my knowledge".)* A provider has no API key.
  The stored `api_key` is read by nothing (verified in the backend, fileserver and interface), so the column, the field, the
  schema and the contract line in `03` 7.2b are removed; the provider form has no key field.
- **D21.** Whether the TMDB read token and the OMDb key become admin-editable settings (a masked field with `Replace`,
  stored, never returned) or stay environment-only (recommended until asked).
- **D20.** *(Decided, owner, 2026-10-17: "this is a crud app".)* Titles are ordinary records: create, edit, delete. The
  one rule the sync adds is that it never overwrites a title or field an admin edited. Manual titles carry their own id
  (`custom-<uuid>`); an optional TMDB id lets the providers produce sources for it. *(Amended, owner, 2026-10-17: a
  deleted **synced** title stays deleted. Delete removes the stored copy and records the TMDB identity in
  `deleted_titles` (migration 020); browse, search, detail and the sync skip it; the Titles tab's `Deleted titles` group
  lists and restores them, `GET /api/titles/deleted` and `DELETE /api/titles/deleted/:id`, `03` section 7.4. A manual
  title is deleted for real and never recorded.)*
- **D16.** *(Decided, owner, 2026-10-17, reversing the earlier default of persisting nothing.)* The admin persists
  its settings and shell layout per signed-in account in the backend (`admin_ui_state`, `GET`/`PUT /api/auth/me/state`,
  4.2 Persistence).
- **D18.** *(Decided, owner, 2026-10-17: "follow the family convention and do what we are doing for the other folder
  pickers; we dont have a complex popup, it just shows the native folder picker".)* `Choose` is the native folder picker
  of the backend's Electron window. No popup and no directory-listing route.
- **D17.** *(Retired.)* There is one rail, a workspace's own; an index has none.

## 11. Docs to amend when the waves land

The coordinator amends these, after landing and not before: `01` sections 1.3, 1.4, 3, 4.3 (the `/admin/` static route
joins the root exceptions) and 4.4 (the engine's timers); `03` sections 1 and 7 (the routes of 3.3, the port table,
7.7); `10` (rewritten for the engine inside the backend); `AGENTS.md` (layout, ports, the `/live` exception); and the
index tables in `00` and `AGENTS.md`, which stop at `14` today and need `15` to `23` and `25` to `29` (there is no `24`).
