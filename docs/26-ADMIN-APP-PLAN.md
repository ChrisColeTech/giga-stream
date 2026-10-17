# 26 - Admin App and the Single Backend

**Status: PLAN, revised 2026-10-17. Nothing here is built.** *Verified* marks a fact read in the code or a doc on
this date. *Decided* marks the owner's words. Everything else is a proposal; section 10 lists the decisions and the
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
- **Decided:** the nav rail carries the admin's tabs. Each tab has an index page and a workspace.
- **Decided:** the work is split into waves and given to workers under the delegation protocol (`07` section 6). The
  coordinator writes docs and briefs, lands, checks and reports; it does not implement.

## 2. What the two servers are today

### 2.1 Admin backend, `src/backend` (verified)

Fastify 5, zod and one `node:sqlite` handle (`store/database.ts`). Port 8091, 8191 in production. `DATA_DIR` defaults
to `~/.giga-stream-admin`, with `admin.db` inside it.

- **Routes:** `/healthz`; `/api/auth/*` (login, refresh, logout, me, password); `/api/admin-accounts` (owner);
  `/api/audit` (owner); `/api/channels` (reads public, writes owner or editor); `/api/providers`; `/api/titles`
  (TMDB); `/api/playlist-sync`.
- **Channels are stored stream-address rows:** `id` (`ch_<uuid>`), `name`, `category` (free text), `number` (TEXT),
  `logo_url`, `stream_url`, `revision`, and for playlist-synced rows `tvg_id` and `source`.
- **Auth:** HS256 JWT valid 15 minutes, a rotating refresh token, a sign-in rate limit and a lockout. Every change
  writes an audit entry. `api/guard.ts` `signedIn(services, request, roles)` gates writes.
- **Network policy** (`network-policy.ts`): refuses to listen off loopback over plain http unless
  `TLS_CERT_FILE`/`TLS_KEY_FILE`, `TRUST_PROXY` or `ALLOW_INSECURE_HTTP` is set. No-store routes: `/api/auth`,
  `/api/admin-accounts`, `/api/audit`.
- **CORS:** methods GET, POST, PATCH, DELETE. No `Range` header.
- **Build:** `tsc`, `rootDir: "src"`, into `dist/`. Development runs `tsx`. Tests are `tsx --test`.

### 2.2 Live server, `src/live-server` (verified)

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
| Who may write | owner or editor, JWT | this computer only, no sign-in | owner or editor, JWT (D2) |
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

### 3.2 Store (proposed)

Migration `008-live-channels.sql`, forward-only:

- `channels` gains `kind TEXT NOT NULL DEFAULT 'stream' CHECK (kind IN ('stream', 'live'))`. `stream_url` becomes
  nullable: a live row stores none. The live fields are `live_mode`, `live_captions`, `live_variants` (JSON) and
  `live_folder`.
- `channel_videos (channel_id, position, path)`, cascading on delete, holds a `videos` source in order.
- A live row's `revision` and audit entries work as a stream row's do.
- The owner's existing `live-server.db` is imported by a one-shot script the owner runs, never by the server at
  runtime and never by a worker against the owner's data (D13).

### 3.3 Routes (proposed)

Reads stay public and keep the shape the fileserver reads. Writes need a signed-in owner or editor.

| Route | Who | Change |
|---|---|---|
| `GET /api/channels` | anyone | same shape; a live row's `streamUrl` is built from the caller's origin |
| `GET /api/channels/:id` | anyone | same |
| `POST /api/channels` | owner, editor | body discriminated by `kind`: `stream` (today's body) or `live` (id, name, category, number, mode, captions, variants, folder or videos) |
| `PATCH /api/channels/:id` | owner, editor | the same discriminator; a change to a live channel rebuilds it |
| `DELETE /api/channels/:id` | owner, editor | stops the runtime, then deletes |
| `PUT /api/channels/:id/fault` | owner, editor | `{ fault, durationMs?, delayMs? }`; live channels only |
| `DELETE /api/channels/:id/fault` | owner, editor | clears |
| `GET /api/admin-channels` | owner, editor | the full admin view: state, problem, renditions, playlist, nowPlaying, fault, mode, source |
| `POST /api/channels/:id/rebuild` | owner, editor | re-reads a folder source and rebuilds (today a PATCH of the same folder) |
| `GET\|HEAD /live/:id/master.m3u8` (renditions, segments) | anyone | the same bytes as today; `Range`; playlists `no-store`, segments immutable |
| `GET /logos/:id.png` | anyone | the generated logo |
| `GET /test/player.html` | anyone | only with `TEST_PAGE=true` |

Errors keep the live server's codes (`channel.invalid` 422 naming the field, `channel.taken` 409, `fault.invalid` 400,
`media.not_found` 404, `range.unsatisfiable` 416) in the backend's envelope. `access.loopback_only` retires with the
loopback gate (D2). `/api/admin-channels` joins the no-store list.

### 3.4 Auth and the network (proposed)

- Writes are gated by `signedIn(..., ANY_ADMIN)`. Every write route has a test for 401 without a token and for a
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

One `.env` and one `production.env`, as the backend has. `PORT` 8091 in development, 8191 in production. `CACHE_DIR`
defaults to `<DATA_DIR>/cache`. `FIXTURE_DIR` and `TEST_PAGE` carry over. `ADMIN_DIST` names the built admin app
(default `src/admin/dist`; with no `index.html` there, nothing is served). `SEED_TEST_CHANNELS` seeds the four `fx-*`
channels as `kind: live` served by the backend itself, which replaces the `03` 7.7 rule that points them at a second
server. The live server's `CORS_ORIGINS` folds into the backend's.

### 3.7 Scripts and ports (proposed; Wave 2)

`npm run dev` drops the `live-server` entry; `live:dev` folds into `dev` with `SEED_TEST_CHANNELS=true`. `kill-ports`
drops 8097. `live:start` and `test:live-server` retire. `03` section 1's port table loses its live row. These edits are
Wave 2, after parity, because the live server keeps running until then.

### 3.8 Build (proposed)

`src/backend/tsconfig.json` has `rootDir: "src"` and the engine imports `src/shared/media`. The worker follows how
`src/fileserver` already imports `src/shared` and picks the smallest change that keeps `npm run build` and `npm start`
working. The options: (a) widen `rootDir` and emit under `dist/backend/...`; (b) a copy of `locate-tool` in the backend,
which breaks `01` section 4.1 (one of each); (c) run the backend under `tsx` in production. (a) is preferred. The
worker reports which it took and why.

### 3.9 Tests (proposed)

- Port the 40 live tests into `src/backend/test`, with temporary data and free ports. The worker writes them and does
  not run them (`07` section 6.3).
- The default run stays in seconds. The ffmpeg-dependent tests and the Chrome tests are opt-in
  (`LIVE_ENGINE_TESTS=1`) and run once at the end of the wave.
- **Parity:** every row of `10` section 3.1 has a test on the merged backend before `src/live-server` is deleted.

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
- It is not part of the Electron app (`AGENTS.md`, Commands).

### 4.2 Shell (proposed; `02` section 1, `06` section 1)

The window is a titlebar (40px), the active page, an optional events band (160px) and a statusbar (24px). The admin
runs in a browser tab, so there are no window controls. The minimum size is 900 x 640.

- **Titlebar:** far left, the nav-rail toggle (ghost icon button, tooltip); then the brand: an accent icon tile and the
  two-line mono wordmark `GIGA / STREAM` with the mono subtitle `admin`. The centre is empty, because the tabs are in
  the nav rail (D10). Right: the events-band toggle; the right-pane toggle stays in place, disabled with its reason,
  because no admin page has a right pane.
- **Nav rail** (the left pane; min 190, preferred 236, max 380; collapsible; Allotment sash): the tabs
  **Channels**, **Accounts** and **Audit**. Accounts and Audit are visibly disabled for an editor, with "Owners only" as
  the tooltip. The rail is the only navigation: there is no router and no URL segment (`04` section 1). `Ctrl+1`,
  `Ctrl+2` and `Ctrl+3` pick the tabs.
- **Centre:** the active tab's index or workspace. Pages stay mounted, so scroll and form state survive a tab switch.
  Opening a workspace is a store request, as `requestLibrary` is in `02`.
- **Statusbar:** running work first (the channels `preparing` or `starting`, shown as `N preparing` over a pulsing
  full bar because their progress is unknown, and **Stop**, disabled with the reason "A channel build cannot be
  cancelled; change or delete the channel."); then one polite notice line; then `Events` and `Settings`.
- **Events band** (160px above the statusbar, `06` section 7): mono rows of time, tone word, area (Channel, Account,
  Session, Connection), the normalised sentence; at most 200 rows; **Clear**; shimmer lines when empty.
- **Settings window** (a modal work window, `06` section 6.1): Appearance (theme, accent, reduce motion), Session (who is
  signed in; **Sign out**), About (version, backend revision, the address in use).
- **Persistence:** none in version one. A reload opens on Channels with default panes and the default theme, because
  browser storage is forbidden and the admin has no fileserver of its own to save to (D16).

### 4.3 Sign-in gate (proposed)

Without a session the centre is a sign-in page (email, password, one primary `Sign in`). It is a page, not a modal; the
titlebar and statusbar stay. It calls `POST /api/auth/login`. The access token lives in memory; where the refresh token
lives is D5. A 401 on any call returns to the gate with the reason on the notice line.

### 4.4 Tabs and their pages (proposed)

| Tab | Index page | Workspace | Who |
|---|---|---|---|
| **Channels** | create form, then the channel grid (both kinds) | one channel workspace per channel (live or stream) | owner, editor |
| **Accounts** | create form, then the accounts grid | one account workspace per account | owner |
| **Audit** | filter strip, then the audit grid, newest first | none (D6) | owner |

Later tabs, not in version one (D7): Providers (index and workspace), Titles, Playlists (sync status and a dry run).

### 4.5 Channels index (proposed)

- **Form at the top** (one `Group`, "Create channel"): kind (Segmented: Live or Stream; Stream shows an address field,
  Live shows its source); name; category (select of six); number; id (kebab-case, live only); mode (Segmented: Loop or
  Encode; the cost is a tooltip); captions (Toggle); qualities (ChipGroup, at least two); source (Segmented: Folder or
  Videos, then a path field or an ordered list). One commit at the end of the group: `Create`, the one primary. A
  refusal names its field, on the notice line and beside the row.
- **Grid below**, no rail: a checkbox first column, then number, name, category, kind (a word), state (a word with a
  left-edge accent strip; a stream row shows "Synced" when it carries a `source`), mode, now playing, fault (a word,
  only when set). At the row end, `Delete` as an `ArmedButton` naming the channel.
- **Toolbar** (icons, ghost, tooltips and accessible names), right only: `Open`, the forward verb. It acts on the
  ticked row and is disabled, with its reason, when no row or more than one is ticked. Refresh sits in the Group's
  action slot.
- Loading and empty show skeleton rows. No sentence sits over them.

### 4.6 Channel workspace, live (proposed)

- **Page rail** (inside the page, beside the nav rail): `‹ Channels` as a button above the list, then the sections
  **details · source · playback · fault · status**. The rail scrolls one centre page; it does not swap the stage (the
  family rule, lora `06` section 1a). Two rails side by side is a proposal the mockup tests (D17).
- **Centre:** one scrolling `Form` page of groups.
  - **details:** name, category, number, id (read-only after create), logo (a preview).
  - **source:** Segmented Folder or Videos. A folder field. Or the ordered video list: add by path, remove, move up and
    down. A changed source saves and rebuilds, which shows `preparing`.
  - **playback:** mode, captions, qualities. The tooltips carry the cost (loop is cheap; encode is a real-time ffmpeg
    per channel, `10` section 2).
  - **fault:** a select of the seven faults, a duration, a delay, `Apply` and `Clear`. The tooltip marks it a test tool.
    `Apply` is disabled, with its reason, while the channel is not live.
  - **status** (read-only; skeleton while `preparing`): the state word, the `problem` sentence (only when `failed`, a
    line in the body), renditions, the playlist (ordered rows with durations; the playing one carries the accent strip),
    and the stream address with a copy icon.
- **Toolbar** (icons, ghost, tooltips): left, `Rebuild`. Right, `Discard changes`, then `Preview →`, the forward verb,
  which opens the channel's test player when `TEST_PAGE` is on and is disabled with its reason otherwise.
- **The one primary, `Save`,** sits at the end of the final group, not in the toolbar (`01` section 9, Buttons).
- **No delete here.** Delete lives on the index row (the family rule).

### 4.7 Channel workspace, stream (proposed)

Rail: details, stream, status. Details: name, category, number, logo. Stream: the stream address and logo address, each
checked against the address rule, the refusal shown as a field error. Status: `Synced from <host>` when the row has a
`source`; synced rows are read-only with the tooltip "Owned by the playlist sync" (D15). Toolbar as the live one, without
`Rebuild` and `Preview`.

### 4.8 Accounts index and workspace (proposed; owner)

- **Index:** create form (email, name, role Segmented Owner or Editor, password of at least twelve characters,
  `Create`). Grid: email, name, role word, state word with an accent strip (Active or Disabled), last sign-in. Row end:
  `Delete` as an `ArmedButton`; the last enabled owner's refusal (`account.last_owner`) is the disabled reason on that
  row. Toolbar right: `Open`.
- **Workspace:** page rail `‹ Accounts`, then details (email, name, role, disabled) and password (`Set new password`,
  whose tooltip says it signs this account out everywhere). Toolbar icons: `Discard changes`, then `Activity →`, the
  forward verb, which opens Audit filtered to this account. `Save` at the end of the details group.

### 4.9 Audit index (proposed; owner)

A search strip (action or subject), no rail. The grid lists entries newest first: time, actor email, action (dotted,
mono), subject, detail (mono). Toolbar right: `Older`, which pages with `before`. Read-only.

### 4.10 Empty, loading and failure (proposed)

Loading and empty draw skeletons in the page's own shape; no sentence sits over a skeleton. A failed read keeps the last
good content and sets one notice (`06` section 2, rule 2). An unreachable backend leaves the nav rail and statusbar in
place, keeps the last content, and disables writes with their reason.

### 4.11 What the admin app does not have

The public channel viewer or player; providers and titles (version one); a second sign-in; polling or a socket;
browser-stored tokens (D5); modals or confirm dialogs other than the Settings work window (inline two-step only); a
Refresh in a toolbar; text under a control; a dot for state.

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
| none | `html/navrail.html`, `channels-index.html`, `channel-workspace.html`, `accounts-index.html`, `account-workspace.html`, `audit-index.html`, `signin.html`, `settings.html` | new, per section 4 |

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
| Accounts and Audit | **A** (continued) | the same worktree | `src/admin/**` | as above |

One worker per real sub-project (`07` 6.1): the backend merge is one worker and the admin app is one worker. The
coordinator never splits one piece, and owns all docs, landing, real checks, visual acceptance and the report.

### 6.2 Baseline

Worktrees are cut from a commit, so the plan is committed first on a named baseline branch, `admin-baseline`, made from
the current `family-port` HEAD (`8add254`) with only `docs/26-ADMIN-APP-PLAN.md` added. The owner's working tree has
uncommitted changes in `docs/03`, `docs/06`, `docs/11`, `src/backend/src/services/title-reads.ts`, `title-shapes.ts`,
`src/backend/test/title-stubs.ts`, `titles.test.ts`, and the frontend's `Statusbar.tsx`, `WorkspaceSplit.tsx`,
`TitleInfoWindow.tsx` and `workspace.css`. They are not mine, so they are not in the baseline and not in any worktree.
Worker B's branch therefore lacks the title edits; they touch no channel code, and landing merges the two.

### 6.3 Waves and landing order

| Wave | Who | Delivers | Depends on | Accepted when |
|---|---|---|---|---|
| 0 | coordinator | this plan, `admin-baseline`, the worktree | - | done |
| 1a | **M** | the admin mockup (section 5) | the plan | the coordinator has served it (asking the owner first), compared it with section 4 and the family mockup in the connected Chrome MCP at 1600 x 1000 and 900 x 640, and the owner has seen it |
| 1b | **B** | the merged backend (section 3), `/admin/` static route, tests written | the plan, defaults D1 to D4, D12 to D15 | typecheck, lint, `check-rules` clean in its report; then the coordinator's gate, a real run on a free port with a temporary `DATA_DIR` (a channel built from the fixtures, its streams played, 401 without a token, no ffmpeg left at stop), and `10` section 5 re-run |
| 2 | **R** | `src/live-server` removed; scripts, ports and kill-ports updated | 1b landed; the owner's approval (it deletes a program) and D13 settled | the gate passes with the program gone; `npm run dev` starts without it |
| 3 | **A** | `src/admin`: shell, sign-in, Channels index and both workspaces | 1a accepted, 1b landed | gate; Chrome MCP visual acceptance at both sizes against the mockup (`07` section 5); the real wire against the merged backend |
| 4 | **A** | Accounts, Audit, Settings window | 3 landed | the same |

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

Providers, titles and playlist administration screens (version one); changes to the Electron app or the fileserver beyond
what the fileserver already tolerates; TMDB; payments; multiple admin tenants; a public channel browser.

## 10. Owner decisions

Each has a recommended default. The waves proceed on the defaults and are redirected if the owner says otherwise.

- **D1.** One channels table with a `kind` column (recommended), or two tables with a union read.
- **D2.** Live writes need a signed-in owner or editor; the loopback-only gate retires (recommended).
- **D3.** Live stream addresses are built from the caller's origin at read time, and the address rule does not apply to
  them (recommended).
- **D4.** Accept that restarting the admin backend stops live channels (recommended). The alternative is keeping the engine
  as a child process the backend supervises.
- **D5.** The refresh token lives in memory only, so a reload signs in again (recommended). `sessionStorage` is browser
  storage, which `01` section 4.4 forbids.
- **D6.** The Audit tab is index only (recommended).
- **D7.** Providers and titles tabs are out of version one (recommended).
- **D8.** The production admin is served by the backend at `/admin/` (recommended).
- **D9.** The development admin uses Vite on port 5172; this needs a row in `03` section 1.
- **D10.** The nav rail replaces the titlebar's tab pill (your words); the titlebar keeps the brand and the toggles.
- **D11.** Fault injection is visible to editors and owners, marked as a test tool (recommended).
- **D12.** Live categories are the six fixed values; stream rows keep free text (recommended).
- **D13.** Your existing `~/.giga-stream-live` channels are imported once, by a script you run (recommended), or you start
  fresh. Wave 1b writes the script and does not run it on your data.
- **D14.** *(Corrected.)* The stream paths stay at root `/live/...` and `/logos/...`, the exception `01` section 4.3
  already allows (recommended). No move under `/api`.
- **D15.** Playlist-synced rows are read-only in the admin (recommended).
- **D16.** The admin persists nothing in version one (recommended). Persisting theme and panes would need a backend
  settings row per account.
- **D17.** Two rails side by side: the nav rail, then a workspace's own section rail (recommended to try in the mockup).
  The alternative is one left pane that shows the tabs on an index and the section rail inside a workspace.

## 11. Docs to amend when the waves land

The coordinator amends these, after landing and not before: `01` sections 1.3, 1.4, 3, 4.3 (the `/admin/` static route
joins the root exceptions) and 4.4 (the engine's timers); `03` sections 1 and 7 (the routes of 3.3, the port table,
7.7); `10` (rewritten for the engine inside the backend); `AGENTS.md` (layout, ports, the `/live` exception); and the
index tables in `00` and `AGENTS.md`, which stop at `14` today and need `15` to `26`.
