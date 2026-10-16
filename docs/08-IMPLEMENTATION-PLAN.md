# 08 - Implementation Plan

**Status: the build plan from the restart, rewritten 2026-10-16.** Every feature of `06`, the phase that
builds it, what it needs from the servers and the screen, and the check that proves it. It owns no
contract: where it and `00`-`06` disagree, those documents win and this plan is corrected. How the work is
done and delegated is `07`.

## 0. Starting point and method

The repository was restarted from empty on 2026-10-16. The earlier work is in
`D:\Projects\giga-stream-archive-20261015`: its git history (branch `live-restart`, tag
`before-live-restart`), the earlier docs, `scripts/`, `tools/ffmpeg` and the owner's TMDB credentials file.

- **Contract first.** Every route, frame and table of every phase is in `03`. A phase starts by checking
  its sections of `03` against `06`; a change found there goes into `03` before any code.
- **Port from source where it matches.** The archive's code is ported where it already does what the docs
  say (`07` section 2) and checked line by line; nothing is copied the docs do not call for.
- **Visible and checked.** A phase is done when its checks pass in the browser and in the Electron window,
  compared with a fresh reference where one exists, and the gate passes (`07` section 5).
- **The owner's data.** The fileserver database at `~/.giga-stream` is at schema 2. Migrations `001` and
  `002` stay exactly as the archive has them, so it opens unchanged; later migrations are new.

## 1. Titles and providers

- **Titles** are TMDB's, browsed, searched and described through the admin backend (`11`): any movie or
  series TMDB has, with its poster, plot, genres, cast, seasons and episodes. Nobody adds titles.
- **Titles play through the providers' embedded players** (owner, 2026-10-16; `12` section 7). How is
  proved first by the provider proof of concept (phase P, `14`), against the real services. Its results
  are written into `03` and `06` before phases 7 and 9 build title playback.
- **Until then**, the backend's address rule (`03` section 7.5) points titles at the live server's test channels
  (`10`), so the rest of the Player can be built and checked against a real stream.

The TMDB calls Library needs were checked live on 2026-10-16 (`11` section 3). Tests use hand-written
TMDB-shaped answers, never recorded ones (`11` section 6).

## 2. Phases

### Phase 0 - Scaffold

| Feature | Delivers | Checked by |
|---|---|---|
| Repository | `git init`, `.gitignore`, `.gitattributes`, `.nvmrc` (24.11.1), root `package.json`, `AGENTS.md` | the base commit |
| FFmpeg | `tools/ffmpeg/bin` restored (`09`) | `scripts/ffmpeg/verify-ffmpeg.ps1` passes |
| Shared media library | `src/shared/media` (`01` section 4.2): find and run the bundled FFmpeg and ffprobe, read a file's facts, find the video files in a folder | its tests pass; the live server and the fixture script use it |
| Fixture files | `scripts/fixtures/make-fixtures.mjs` (`10` section 2.1): three programmes per test channel and the news captions, cached per machine | a fresh cache is made and each file probes as H.264 + AAC at its listed length |
| Live server | `src/live-server` (`10`): channels as playlists of real videos, live HLS in loop and encode mode, its own `node:sqlite` store, channel CRUD live without a restart, faults, the four seeded test channels | built 2026-10-16: its tests pass (CRUD, persistence, the switch between videos in every rendition, encode mode) and the headless-Chrome tests pass, including playback across a switch |
| Rule checker and gate | `scripts/check-rules` to `01`; `scripts/check/gate.mjs` | the checker's tests pass; the gate prints `gate: PASS` |
| Browser harness | `scripts/browser`: headless Chrome over DevTools, screenshots, page evaluation | it captures a screenshot of a running page (needed from phase 3) |

### Phase P - Provider playback proof of concept

`14`. It runs now, beside phases 1-5, because it shares no code with them.

| Feature | Delivers | Checked by |
|---|---|---|
| Docs first | each provider's own documentation read; `providers.json` written from it | the documentation URL is recorded per provider |
| Test page and shell | `src/mockup` (plain HTML, CSS and JS, laid out like Giga Images' `mockup-v2`): the picker, the stage, the message and event logs, the checklist, in Chrome and in Electron | it hosts a provider's embed page in both |
| The checks | `14` section 4, for VidSrc, VixSrc and VidZee | the results table in `14`; `12` updated with the verified facts |
| The other 47 | the same, from the owner's list | their rows in the summary |
| Design written up | `03`, `06`, `01`, `02` and `13` updated from the results (`14` section 7) | before phases 7 and 9 |

### Phase 1 - Admin backend: channels, accounts, sign-in

`03` sections 7.1-7.3 and 7.7-7.13.

| Feature | Delivers | Checked by |
|---|---|---|
| Store | `channels`, the revision counter, `admin_accounts`, `refresh_tokens`, `audit_log`; numbered migrations | tests; data survives a restart |
| Sign-in | login, refresh with rotation and reuse detection, logout, me, change password; HS256 access tokens; sign-in limits and lockout | tests; a real run signs in, refreshes and signs out |
| Admin accounts | owner-only CRUD, roles, revocation on change, the last-owner guard, the bootstrap owner | tests |
| Audit log | an entry per sign-in and change; owner-only reads | tests |
| Network | TLS from certificate files, or behind a trusted proxy; refuses plain `http` off loopback; `CORS_ORIGINS` | tests; a real run over `https` on a LAN address |
| Channel routes | public reads; `POST`, `PATCH`, `DELETE` with an access token | tests; a real run: a change is listed at once |
| Provider CRUD | requested by the owner (2026-10-16); **not specified and not built by the coordinator**, which declined provider integration (`12` section 7, `14`). The routes, auth and storage above take a further resource without redesign | - |
| Stream-address rule | `https` only, loopback with `ALLOW_LOOPBACK_STREAMS` | a real run refuses an `http` address without the flag |
| Test channels | `SEED_TEST_CHANNELS` creates the four channels of `10` | a real run lists them |
| Socket | `/ws`: hello, `channels.changed` | a real run: a change is announced |

### Phase 2 - Fileserver: Live

`03` sections 3.1-3.4, 4 (state and updates), 5 (the live view, read on demand) and 6 (the store
and migrations).

| Feature | Delivers | Checked by |
|---|---|---|
| Store | `node:sqlite`; migrations `001`, `002` (unchanged) and `003` (backend address into settings) | a copy of a schema-2 database opens and migrates |
| Settings | `GET`/`PATCH /api/settings`, including `adminUrl` | tests; settings survive a restart |
| Shell state | `GET`/`PATCH /api/shell-state` | tests; the layout survives a restart |
| State | `GET /api/state` — the complete picture in one answer (`03` section 4) | tests; the answer's parts validate separately |
| Live view | on-demand channel reads with the TTL and revision check, probe rounds after each read, the clear-on-failure and refill-on-next-read behaviour | a real run: fills, clears when the backend stops, refills when the next request finds it again; changing `adminUrl` switches backends |
| Probe | one `GET` per stream, 4 s, 64 KiB, at most 6 at once | a real run against the test server: every channel `live` |
| Channel routes | `GET /api/channels`, `POST /api/channels/refresh`, `PATCH /api/channels/last` | tests; a real run |
| Socket | `/ws`: hello and the frames of `03` section 4 | tests; a real run |
| Electron host | the window (`02` section 1), the preload, safe navigation | the app opens in Electron |

Phases 1 and 2 can run in parallel, one worker each (section 3).

### Phase 3 - Interface shell

`02` sections 1-2, `06` sections 1-2 and 9.

| Feature | Delivers | Checked by |
|---|---|---|
| Window | titlebar (brand, Live / Library / Player switch, pane toggles, window controls), statusbar (connection, notice, Events, Settings) | compared with a fresh screenshot of Giga Images' shell |
| Panes | Allotment panes for all three surfaces, collapse with the tween, sizes within the `02` section 1.3 limits | collapse and restore in the browser and Electron |
| State | the one store, `services/api.ts` (REST answers and the scan's streamed NDJSON body), the state read on mount | the statusbar shows `connecting`, `ready`, `reconnecting` as requests fail and succeed again |
| Hydration | restore the saved tab and layout from `GET /api/state`, reveal after it settles, never write before restoring | the app reopens on the saved tab and layout with no flash |
| Building blocks | the `06` section 9 components, each once | used by every later phase |
| Surface keys | `Ctrl+1/2/3` | they switch surfaces |

### Phase 4 - Live

`06` section 3.

| Feature | Delivers | Checked by |
|---|---|---|
| Player | `<video>` with hls.js (native HLS only as fallback), the failed and no-channels notes with Retry and Refresh | the `05` section 3 walk |
| Channels pane | heading and Refresh, search and category, rows with logo fallback, status dot, playing marker, selection, Details | the `05` section 3 walk; skeletons while loading and with the backend stopped |
| Last channel | Live opens on the last channel chosen | restart and it reopens on it |
| Playback settings | Video, Display, Audio, Captions, Playback rows; disabled rows with their reason as a tooltip; Fit / Fill / Original always usable | each row acts on a test channel (`fx-news` for captions, `fx-sports` for three qualities) |
| Channel keys | Up, Down, Home, End move the selection; Enter plays | keyboard walk |
| Failures | a test-server fault (`10` section 2) brings up the failed note; Retry after `clear` plays again | the fault routes |

### Phase 5 - Settings window

`06` sections 6.1 and 6.2.

| Feature | Delivers | Checked by |
|---|---|---|
| Work window frame | the modal window: move, resize, scrim, `X` and `Escape`, focus return | compared with a fresh Giga Cut capture |
| Appearance | Theme, Reduce motion, Accent, UI zoom (`Ctrl+0` resets) | each applies at once and survives a restart |
| Playback | Autoplay, Subtitle language | saved; used by Player in phase 9 |
| Admin backend | the Address row (`adminUrl`) and the State row | changing the address switches backends; the state follows |
| About | version, runtime mode, licences, the TMDB logo and notice | shown |
| `Ctrl+,` | opens Settings | key walk |

The Library row (Default view, Collections, Open History) is wired in phase 8, when those exist.

### Phase 6 - Your own files and collections (fileserver)

`03` sections 3.5 (local files only), 3.7-3.13, 4.

| Feature | Delivers | Checked by |
|---|---|---|
| Collections | create, rename, remove (files untouched), add and remove members | tests; a real run |
| Folder selection | `POST /api/fs/dialog` (Electron's native picker, a selection token, never a path) | in Electron, a folder is chosen |
| Folders | attach to a collection, replace, rescan, remove | a real run against a temporary folder of test videos |
| Jobs | the `jobs` table: queued, running, cancelling, done, failed, cancelled, interrupted; cancel; dismiss; restart marks unfinished jobs interrupted | tests; a scan cancelled mid-way; a restart during a scan |
| Scan | find video files in an attached folder, record them in `local_files` | the test folder's files are listed |
| Scan progress | `GET /api/folders/:folderId/scan` streams the scan's `ScanEvent`s as NDJSON, line by line, as the shared library's generator yields them (`03` section 3.8) | a scan's events arrive while it runs; a client going away does not stop the scan |
| Media probe | ffprobe each file for duration, size, dimensions and codecs; mark unplayable files | values match the test files |
| Stills | one still per local file with ffmpeg, kept in the image cache | each test file has a still |
| Local media | `GET`/`HEAD` by opaque id with byte ranges | a test file plays and seeks in the browser |
| Image cache | `GET /api/images/:imageId`; images fetched once from their source and kept on disk; channel logos switch to it | Live's logos appear; a missing image shows its fallback |
| Favorites | add and remove a favorite for a title or a local file | tests |
| Watch history | progress writes with the per-playback order rule, remove one entry, clear all | tests |
| Socket | frames for collections, jobs and favorites | a real run |

### Phase 7 - Titles (admin backend, then the fileserver's pass-through)

`03` sections 7.4-7.6b, then 3.5 and 3.6.

| Feature | Delivers | Checked by |
|---|---|---|
| TMDB proxy | title pages in each sort with genre and year, search, genres, detail, seasons and episodes, recommendations; at most about 5 requests a second, backed off on `429` | tests with hand-written TMDB answers; then a real run |
| Title store | migration `004-titles.sql` (`03` section 7.6b): `titles` and `title_lists`; every route answers from the store when fresh, fills through on a miss, and answers from the store when TMDB cannot be reached | a restart answers everything already synced without touching TMDB; a stale entry refetches |
| Catalog sync | the sync service: fill-through, `POST /api/titles/sync` (trending/popular per kind, or explicit ids) as a single-flight background job, `GET /api/titles/sync` status, the `titles.synced` socket event, audit entries, and the `TMDB_SYNC_SCHEDULE` hook (default off) | a bulk run walks the lists within the rate limit; a second start is `409 sync.busy`; a scheduled run is audited as `system`; no revision bump |
| Title playback fields | as phase P wrote them into `03`: the providers' embed addresses per title and episode, and the test-server address rule for development | every title and episode answered carries them |
| Fileserver pass-through | `GET /api/library` with titles, the title routes, session memory; nothing stored on the fileserver | with the backend stopped, title regions are skeletons and local data still works |

### Phase 8 - Library

`06` section 4.

| Feature | Delivers | Checked by |
|---|---|---|
| Collections rail | All, History, Favorites, the collections; counts; scan dot; Rename and Remove in the context menu; **Manage collections** | the `05` section 4 walk |
| Type strip | All, Movies, TV, Local | each scope narrows the results |
| Continue Watching | up to 10 cards with progress, Play and Info, shown only when there is progress | appears after watching part of a title |
| Grid and list | poster cards (favorite, quality, progress, watched, Play, Info), the list view, selection and arrow keys, context menu | the walk; compared with references |
| History | watch entries, Remove from History, two-step Clear history | the walk |
| Filters | search, view, sort (Trending only with a real popularity signal), genre, year, watched, Clear filters | each filter narrows; facets update |
| Title information popup | artwork, identity, plot, cast, runtime or seasons, watch state, Favorite, Add to collection, Play | the walk |
| Add to collection popup | search, check marks, add at once | the walk |
| Collections window | `06` section 6.3: create, rename, members, attach folder, scans, two-step remove | the `05` section 5 walk |
| Settings, Library row | Default view, Collections, Open History | each acts |
| `Ctrl+F` | focus the active surface's search | key walk |

### Phase 9 - Player

`06` section 5.

| Feature | Delivers | Checked by |
|---|---|---|
| Tabs | one per movie, series or local file; reuse; at most 12; close after the final progress write; Close others; Reveal in Library | the `05` section 4 walk |
| Episode browser | season select, episode rows with still, number, title, duration, watch marker; movie and local-file views | an exact episode loads; changing season starts nothing |
| Stage | local files and test-server titles in the app's `<video>`; provider titles in the provider's embedded player, as phase P wrote it into `06`; the toolbar (Retry, Reveal in Library, Fullscreen), the failed note | a local file, a test movie and episode, and a provider movie and exact episode play, in the browser and in Electron |
| Resume and progress | Resume / Start over; writes every 30 s and on pause, end, seek, tab switch and close; for a provider title, from its messages and its start parameter | progress survives a restart; resume works |
| Details | Overview, Details, Watch blocks; Favorite; collections; Add to collection; Remove from History | the walk |
| Related | the band: TMDB recommendations or genre and year; disabled for local files | cards open their tabs |
| Opening rules | Play from a card, Info, a related card, Reveal in Library (`06` section 5.6) | each path |
| Player keys | Space, Left, Right, `M`, `F` | key walk |

### Phase 10 - Events drawer

`06` section 7: the drawer with its rows, severity filter, Clear and the 200-row limit. Checked by
producing a connection loss, a scan and a failed stream and reading their rows.

### Phase 11 - Walkthrough and packaging

The whole of `05` scripted in the browser harness and repeated in the Electron window; then the packaged
app, with FFmpeg's licence notice (`09` section 2.1). Done when every `05` section passes in both, and the
packaged app runs the same walk.

## 3. Delegation

One worker per real sub-project (`07` section 6): phase 1 (admin backend) and phase 2 (fileserver) run in
parallel; phase 6 (fileserver) and phase 7's backend part (admin backend) can too. The coordinator writes
every doc, does phase P and every interface phase (3-5, 8-10) itself, lands each worker's branch and runs
the real checks.

## 4. Known gaps carried in

- **Keys.** The archive's interface never implemented `Ctrl+1/2/3`, `Ctrl+,`, `Ctrl+0` or `Ctrl+F`;
  phases 3, 5 and 8 build them.
- **TMDB.** `11` was checked live on 2026-10-15 and 2026-10-16; anything phase 7 finds different is
  corrected there first.
