# 01 - Architecture and Style Guide

**Status: governing engineering standard.** This document is normative. Its rules are mirrored by
executable checks in `scripts/check-rules.mjs`, and a change that breaks one fails the gate.
Product behavior belongs to `00`, the interface to `02`, the servers to `03`.

## 1. Programs and ownership

```text
 Interface (src/frontend)
   same-origin REST, to the fileserver only
   (it never calls the admin backend, TMDB or OMDb)
        |
        v
 Fileserver (src/fileserver)  :8090 loopback
   owns YOUR data: settings, layout, collections, favorites,
   watch history, local files, jobs (its own SQLite, ~/.giga-stream)
   cache: a snapshot of the backend's channels and titles (display data
   only, synced in the background, at most every 6 hours; `46`) and the
   image cache; providers and their sources are never stored
        |
        | live reads on demand: /api/library, /api/titles*,
        | /api/channels, /api/providers (never stored; the revision
        | in an answer says whether the view moved)
        v
 Admin backend (src/backend)  :8091 loopback, TLS off loopback (03 section 7.10)
   owns: channels, providers, admin accounts, the title store,
   the audit log, the revision counter
   one timer in the whole system: TMDB_SYNC_SCHEDULE (section 4.4)
        |                     |
        v                     v
   TMDB (api.themoviedb.org/3)   OMDb (omdbapi.com) - detail enrichment
   browse, discover, search,    by IMDb id, 1,000/day budget, on read only
   detail, seasons, related,   (11 section 7)
   trending/popular (sync + fill-through, 03 section 7.6b)

 Poster and still bytes: image.tmdb.org -> FILESERVER only (its image cache,
 fetched lazily on first request), never through the backend (section 7).
 Player in the interface --loads the stream address--> stream origin
 (in development: the backend's live test channels, 10);
 provider titles play in the provider's embedded player in the stage (14).
```

| | Interface | Fileserver | Admin backend |
|---|---|---|---|
| Talks to | fileserver only | interface, backend | fileserver (answers), TMDB, OMDb |
| Owns | nothing persisted | your data (settings, layout, collections, favorites, history, local files) | channels, providers, accounts, the title store, audit |
| Port | - | 8090 | 8091 |
| Database | - | `~/.giga-stream` | `~/.giga-stream-admin` |
| External bytes | - | images (through its cache), streams (published addresses) | none — JSON metadata only |

Which sections of each server exist, and their build status, is the table at the top of `03`; what each
phase delivers is `08`.

### 1.1 Interface - `src/frontend`

React renderer. It presents, interacts, plays media in a browser `<video>`, and holds transient UI
state. It has no Node, filesystem, SQLite or provider access. All of its communication goes through
the fileserver's same-origin `services/`. It never contacts the admin backend. The exceptions to
"everything through the fileserver" are the player loading a stream address that a channel or title
carries, and the Player stage hosting a provider's embedded player for a title (`00` section 2, `14`);
both addresses are published data, never an application API. The frame rules (sandbox, message origins,
refused popups and navigation) are written here from the results of `14`.

### 1.2 Fileserver - `src/fileserver`

The application server for the interface, and the Electron host in desktop mode. It owns:

- delivery of the built interface;
- everything local: `node:sqlite` with settings, shell state (layout), collections, favorites,
  watch history, local files and jobs; folder scans and Range media routes for local files;
- a local cache of the backend's channels and titles (display data only), written to the same database and synced in the
  background at launch and when a page reads it after 6 hours (`46`); the backend's providers and their sources are never
  stored;
- the image cache: images from the backend, on disk under the data folder, fetched lazily on first request;
- one transport: REST answers. A long-running operation (a folder scan) answers as one streamed
  NDJSON body that reports progress as it happens; there is no WebSocket and no push channel;
- Electron lifecycle, preload, safe navigation and native folder selection.

It holds no provider code and does not know what a provider is. It resolves nothing, relays nothing
and serves no fixture media.

### 1.3 Admin backend - `src/backend`

One optional Fastify server, on the user's machine, a LAN host or a cloud host. It owns a separate
`node:sqlite` database: the channels with their stream addresses, and its TMDB cache. It is the only
program that calls TMDB, and it gives each title its stream address from a rule (`03` section 7.5).
Providers, when they come (`13`), live here and nowhere else. It never stores user-local paths,
watch history or collections, and never serves local files or video bytes.

### 1.4 The live engine - inside the admin backend (`src/backend/src/live`)

There is no separate live server any more (merged into the backend and `src/live-server` deleted, 2026-10-17, `26`). The
backend is also a stream origin (`10`): channels of real video files, each a looping playlist, served as live HLS around
the clock from `/live/<id>/...` and `/logos/<id>.png` on the backend's own port and database, managed through its CRUD
routes (a signed-in admin writes). The seeded test channels are live channels of the backend. The interface's player
loads their stream addresses like any published stream address; no program imports the backend or calls its engine API.
It is not packaged with the app.

### 1.5 Not in the system

No CLI, Rust runtime, Python sidecar, inference worker or second renderer architecture.

## 2. Locked stack

| Concern | Choice |
|---|---|
| Interface | React 19, TypeScript strict, Vite |
| Styling | Tailwind CSS v4 through tokens in `index.css` |
| Pane layout | Allotment; one geometry owner per surface |
| Motion | framer-motion |
| UI state | One Zustand store, narrow selectors |
| Validation | Zod at every HTTP, WebSocket, backend-published and persisted-value boundary |
| Servers | Fastify 5 |
| Uploads | `@fastify/multipart`, the admin backend only, for the one playlist-file import (owner, 2026-10-18, plan `43`) |
| Local data | `node:sqlite` (fileserver and backend), separate databases |
| Desktop | Electron, sandboxed renderer, context isolation, no Node integration |
| Live playback | hls.js whenever the browser can run it; the browser's own HLS only as a fallback |
| Icons | lucide-react |
| Tables (admin) | `@tanstack/react-table` v9 (`^9.2.4`, the family references' pin): `useTable` + `tableFeatures`; sorting, visibility and sizing metadata only; confined to `src/shared/ui` (owner, 2026-10-18, plan `45`) |
| Row windowing (admin) | `@tanstack/react-virtual` `^3.14`, the long admin lists only (owner, 2026-10-18, plan `45`) |
| Context menus | @radix-ui/react-dropdown-menu, pinned at 2.1.24: the one context menu and its one-level `Collections ▸` submenu; menus only, never dialogs (the family standard, Giga Images' `docs/frontend/00`) |
| Quality | oxlint, TypeScript, an executable architecture checker |

Changing a locked dependency requires updating this document first.

## 3. Repository layout

```text
giga-stream/
|-- docs/
|-- scripts/
|   |-- check-rules.mjs         the executable copy of this guide's rules
|   |-- check/                  the gate
|   `-- fixtures/               makes the test video files (`10` section 2.1)
|-- src/
|   |-- frontend/src/           components, hooks, lib, pages, services, store, styles, types, constants
|   |-- fileserver/src/         app, routes, services, store, types
|   |-- backend/src/            api, services, store, live (the engine, `10`), types, constants
|   |-- admin/src/              the admin app (`26`, `28`, `29`; planned)
|   |-- shared/                 libraries any program or tool may import (section 4.2); not programs
|   `-- mockup/                 the provider playback proof of concept (`14`): plain HTML, CSS, JS; not a
|                               program, never packaged, and outside the rules below
`-- package.json                aggregate dev, build, check and test scripts
```

Folders named `utils`, `util`, `helpers`, `misc` or `common` are forbidden. Name the domain.

## 4. Dependency and ownership rules

### 4.1 One of each

- One interface request layer (`services/api.ts`); there is no interface WebSocket.
- One Zustand store (`store/app-store.ts`). A slice that would push it past the size rule lives in its own file and is
  spread into the same `create` call, never a second store: `store/navigation-slice.ts` holds the cross-surface requests
  (`02` section 2.1).
- One fileserver Fastify instance; one backend Fastify instance per backend process.
- One owner of each SQLite database.
- One scan-progress stream shape: the shared library's `ScanEvent`, NDJSON (`03` section 3.8).
- One owner of each surface's pane geometry.
- One browser-player controller per active stage.
- One mapping from dotted error codes to user sentences.

### 4.2 Import boundaries

- The interface never imports fileserver or backend source; the fileserver never imports backend
  source; the backend imports neither. They talk over HTTP.
- **A shared library is not a program.** Code more than one program or tool needs lives once, in
  `src/shared/<domain>/` (for example `src/shared/media`: finding and running the bundled FFmpeg,
  reading a file's facts with ffprobe, and finding the video files in a folder). Any program and the
  fixture tools may import it; it never imports a program, and it holds
  no state of its own (no database, server or socket). It follows every rule of this guide. It is
  written in TypeScript using only syntax Node can strip (no `enum`, `namespace` or parameter
  properties), so the `.mjs` tools run it directly and the programs compile it with their own code.
- Electron imports are confined to `src/fileserver/src/app`.
- `node:sqlite`, filesystem paths and child processes are service concerns, never route or interface
  concerns. SQL strings exist only under `store/`.

### 4.3 Route boundary

Every route does exactly: parse and validate input, make one service or repository call, map the
result to the standard envelope. A route never opens files, queries SQLite, creates sockets or
spawns processes. Every route begins `/api`; `/healthz` is the only root exception, besides the backend's stream
addresses (`/live/...`, `/logos/...` and its test page, in `api/live-streams.ts`) and its static `/admin/` app
(`api/admin-static.ts`), which players and the browser load directly and which answer bytes, not the envelope.

### 4.4 Interface transport boundary

- Components, pages, hooks and the store never call `fetch` or construct a `WebSocket`.
- Application URLs are relative. A backend URL never appears in interface source, except as the
  Settings draft that is sent to the fileserver.
- REST performs every mutation; each answer reports the consequence of the write, so the interface
  learns what changed from the call it just made, not from a second channel.
- There is no WebSocket anywhere in the system. The interface reads state when it needs it — mount,
  a surface switch, after its own actions, a Refresh — and never on an interval: no polling, no
  long polling, no SSE subscriptions, no request loops or interval timers, in any program or tool. **Clarified
  2026-10-18 (owner): the rule bans polling, not timers.** A one-shot timer that does not repeat a request on a schedule
  is allowed where a hook needs one - the search field's input debounce (`docs/41` 6) is the case today. **One dated
  exception to "no SSE subscriptions" (owner, 2026-10-18, plan `44`):** `GET /api/jobs/events` (section 4.4).
- One exception for streamed answers: a long-running operation (a folder scan, `03` section 3.8)
  answers with a single streamed NDJSON body that reports progress as the work happens — one
  request, one answer, not polling.
- The system's timer exception covers the admin backend's one internal timer (`sync-scheduler.ts`, `26` section
  3.11): it is armed for the earliest due enabled sync job (a catalog job pulls **title metadata** into the title
  store, a playlist job refreshes the sync-owned channels from an M3U playlist, `03` sections 7.6b and 7.2c); the
  `TMDB_SYNC_SCHEDULE` setting only seeds the first catalog job record (playlist jobs are created by an import, `43`). Every run is audited
  with the actor `system`. Images are never part
  of either: image bytes are fetched and served by the fileserver's image cache (`03` section
  3.11) lazily on first request — the backend never stores or serves a media byte (section 7). **One dated
  exception (owner, 2026-10-18, plan `43`):** a playlist sync job caches the channels' logo images on the backend
  (`DATA_DIR/logo-cache/`, content-hashed, at most 1 MiB each, PNG/JPEG/GIF/WebP only) and the backend serves them at
  `GET /logos/<file>`; no poster, still, video or user media is ever cached by it. No other timer exists anywhere.
- No browser storage on the desktop runtime: nothing the user chose lives in `localStorage`, `sessionStorage`
  or IndexedDB; saved state is a fileserver row. **Amended (owner, 2026-10-19, plan `61`):** the browser
  runtime persists its local domains - shell/layout, settings while signed out, watch history and the last
  channel - in `localStorage` and IndexedDB through `src/frontend/src/services/local-state.ts` and
  `local-watch.ts` only (the rule checker allow-lists exactly those files), every read validated with the wire
  schemas, and never a provider, token or secret. `docs/62` moves settings, favorites and collections to the
  signed-in account and keeps the local stores as the signed-out and offline state.

## 5. TypeScript and source rules

- `strict` everywhere; the servers also enable `noUncheckedIndexedAccess`.
- `any`, `@ts-ignore` and double assertions are forbidden. External values start as `unknown` and are
  validated and narrowed. State machines are discriminated unions.
- Source files are at most 200 measured lines and tests 250, wrapping logical lines at 120 columns.
- A file copied verbatim from a family app (`23` section 3.1, listed in `scripts/check-rules/family-files.mjs`) keeps the
  family's shape: it may exceed 200 lines and export several components. Every other rule applies to it.
- One exported React component per file; the filename matches the export; named exports.
- Components are `PascalCase.tsx`, hooks `useThing.ts`, everything else kebab-case. Types live under
  `types/`, one domain per file. No arbitrary barrels.
- **Naming is decided by where a file lives** (`scripts/check-rules/rules/size-and-naming.mjs`
  enforces the same rule):
  - Components in a `components/` or `pages/` tree, or any `.tsx` in the shared UI library:
    `PascalCase.tsx`, matching the file's one exported component.
  - Hooks in a hooks tree (`src/*/src/hooks/`, `src/shared/ui/src/hooks/`): `useThing.ts`, camelCase.
  - Everywhere else — services, stores, `lib`, `types/`, `api/`, tests: kebab-case. A hook-shaped
    file outside a hooks directory (`src/shared/ui/src/lists/useSelectAll.ts`) is therefore
    kebab-case (`use-select-all.ts`); to keep a hook's camelCase name, move the file into a hooks
    directory.
- No configuration literals in components: ports, timings, limits and copy live in named constants.
  Constants are `SCREAMING_SNAKE_CASE` in kebab-case files.
- Comments explain non-obvious decisions, not syntax.

## 6. Interface layers

- **Components** render props and call named callbacks. They do no I/O, touch no storage, own no
  application timers or global listeners, and do no pane math.
- **Hooks** connect React's lifecycle to services and the store. One hook, one concern.
- **The store** holds transient UI state and the projections the surfaces share. It performs no I/O
  and holds no promise, timer, DOM node or media element. Components select the narrowest slice. One surface asks
  another to do something by a request value with a serial (`requestPlay`, `requestLibrary`), which the receiving
  page reads and acts on; a page never reaches into another page's local state.
- **Services** own REST, decoding, retries and the streamed scan body, and return typed domain results.
- **`lib`** is pure: no React, Zustand, services, store or device APIs.

## 7. Server rules

### Fileserver

- Repositories own SQL, services compose repositories, routes call services.
- Migrations are forward-only, numbered and transactional; a newer schema is refused.
- Backend channels and titles are cached in the fileserver's database as a snapshot (`46`): synced in the background at launch
  and when a page reads them after 6 hours, served from the cache at once (a cache that was never filled is awaited). A failed
  sync keeps the cache and sets the backend error; local data stays usable. **No timer drives it** - staleness is checked at
  launch and on reads only - and nothing from the backend's providers, credentials or provider sources is stored.
- Local paths never enter a URL or a DTO. Local files always play through Range routes; `file:` is
  forbidden.
- Jobs that outlive a request are persisted, cancellable and marked `interrupted` after a restart.
- A scan is answered as one streamed NDJSON body (section 4.4); a client going away never stops the
  job it started.
- Navigation guards cover `will-navigate`, redirects, frames and new windows. The preload exposes
  named capabilities only; generic `invoke`, raw IPC and Node objects are banned.
- Provider-frame policy is one named capability: the renderer sets or clears the active source's exact
  origin and documented nested-frame origins. The Electron main process enforces that policy on every
  player/nested frame and injects the static dialog no-ops; the renderer never reaches through a
  cross-origin `contentDocument` and never supplies executable code over IPC.

### Backend

- Reads are public; every change needs a signed-in admin's JWT and writes an audit entry (`03` sections
  7.11-7.13). Off loopback it runs only behind TLS (`03` section 7.10).
- The backend has no socket (its read-only `/ws` was removed on 2026-10-17; nothing connected to it). Each
  change raises its `revision`, which channel and provider answers and `GET /healthz` carry. **One dated exception
  (owner, 2026-10-18, plan `44`):** a read-only server-sent-event stream, `GET /api/jobs/events`, pushes a running sync's
  progress to a signed-in admin (the statusbar bar must show real progress and application code may not poll). It carries
  job ids and numbers only, has no timer or heartbeat, and no other route streams.
- All backend outbound HTTP to a remote address goes through ONE function (`safe-fetch.ts`: http or https, no loopback or
  link-local targets, bounded redirects and byte caps; `03` 7.3); no service calls `fetch` on a remote address directly. A schema
  enforces its relations with foreign keys, not with service code alone.
- No route accepts, uploads or serves video, local files or media bytes. **Two dated exceptions (owner, 2026-10-18, plan
  `43`):** the backend accepts one uploaded M3U playlist file (`POST /api/playlists/import`, at most 8 MiB, read and
  discarded, never kept), and it serves its own cached channel logos (`GET /logos/c/<file>`, section 4.4).

## 8. Contract grammar

- JSON fields are `camelCase`; REST resources are plural kebab-case nouns.
- Error codes are dotted, domain-first lowercase words.
- IDs are opaque strings. Times are Unix milliseconds; media positions are integer milliseconds.
- An absent optional value is omitted unless `null` has its own documented meaning.
- Success and failure use one envelope: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.
- Refusal messages are plain sentences fit for a status line or tooltip.
- Internal failures are logged with a correlation id; a client never receives a stack trace.
- A part of an answer the interface cannot read is reported, not dropped silently; an answer part of
  a kind the interface does not know is ignored, since a newer server may know more.
- The parts of a snapshot are validated separately, so a mismatch in one part never costs the rest.

## 9. Interface grammar

### Tables and lists (the admin's record lists; plans `45` and `52`, owner 2026-10-18)

One table system for every list of records the admin shows, index or workspace, built on TanStack Table (and TanStack
Virtual for the long lists): one column-definition API (`shared/ui/src/lib/record-columns.ts`); **columns always fit the
pane** (fluid `minmax`/`fr` columns, truncation, and priority-based hiding of the least important columns at narrow
widths) - **no horizontal scrollbar** at 900px or wider; **one scroll strategy** - the table fills the remaining pane
height and scrolls inside itself under a sticky header, and never grows the page (the page scrolls once only when the
form above plus an 8-row table exceed the pane; a `bounded` table is as tall as its rows up to ten, then scrolls inside
itself); **one row height** (36px, header 29px) and one left edge for every table; the tri-state `All` in the header
above the row ticks; skeleton rows in the same columns while loading; sort from the header and from the query bar's
sort control. TanStack is used for column definitions, sorting, visibility and sizing metadata only: selection stays
by id (`ListSelection`) and paging stays index-addressed (`41`). `helper.columns()` types each column's value, so no
`any` is needed.

**The rule.** A set of records shown as parallel rows - an index list or a workspace's list, wherever the admin lists
what a person can open, select, act on per row or read in columns - is the kit's record table
(`lists/RecordTable.tsx`), never hand-rolled rows of divs. `DataTable.tsx` is another table (the interface's
Collections window) and is not the record table. A plain list remains only for non-tabular display (a handful of
names under one label); a label and its control are a form `Row`, never a table.

**The consumer supplies:** the columns (`createColumnHelper<typeof recordFeatures, RowView>()` and
`column.columns([...])`, one `*-columns.ts` file per list; a column's `size` is its minimum width in px, its
`meta` `{ kind, grow?, priority }` names its cell style and its narrow-pane behaviour - `kind` is `name`, `text`,
`mono`, `number`, `state` or `custom`, `priority` 0 never hides and higher hides first, `grow` takes the leftover room
in `fr`); a stable `idOf` string per row; the rows (an in-memory list passes `rows`, a paged one passes `paging`:
`total`, `rowAt`, `resetKey`, `onNeedRange`, `pageSize`); and the `rowView` per row - its state word, its dimming, its
tick, what opens it and its end. A workspace list with no record to open omits the open; the kit then draws no spanning
button, only the cells.

**The kit supplies:** the markup, the header, the selection column, the window, the skeleton and the keyboard. The row
(`RecordTableRow`) is one 36px line on the one `--cols` template the header, every row and every skeleton share: the
tick, one spanning button over the visible cells (Enter and Space open the record), the end cell - a fixed end column
(`END_COLUMN_PX`; wider for two actions) whose armed `Delete` question grows leftwards over its neighbours. The header
(`RecordTableHead`) is 29px, sticky, mono; its first cell is the three-state `All` of a `SelectAllScope` (absent in a
list without ticks); a sortable heading is a button with `aria-sort` and a direction arrow, and a server-sorted list
takes the same press through its `RecordSort`. A state is a `StateWord` tone cell in a `state` column, never a dot; a
disabled record stays in its list dimmed to 45%. The per-row verbs live at the row's end (the `Delete` `ArmedButton`,
`Restore`, icon-only small inner actions); the list's verbs live in the `TableStrip`, the list's first row, never in a
heading and never in the page toolbar. Ticks are ids (`ListSelection`): the header `All` ticks the loaded rows, and
`Select all M matching` is a separate strip verb. Above `WINDOW_MIN_ROWS` (100) a paged table mounts only the rows near
the viewport (`RecordTableVirtualBody` over `useRowWindow`; a skeleton row stands in for each mounted row whose page is
not loaded); at or under it every row is mapped; an in-memory list windows the same way through a synthetic `paging`
over its own array. Nothing read, and nothing to list, draws `RecordTableSkeletonRow`s in the same columns - never a
sentence, never an invented placeholder. The keyboard: the arrows, Home, End, PageUp and PageDown move focus by index in
a windowed body (so they reach rows not mounted yet) and the focused row stays mounted while focus is in it.

**The class vocabulary** (`record-grid-classes.ts`): a name cell is 14px medium on the row's line (`CELL_NAME`), other
text muted (`CELL_TEXT`), a mono cell mono 12px (`CELL_MONO`), a number mono 12px tabular and right-aligned so the
figures compare down the column (`CELL_NUMBER`); a state or custom cell styles itself. The header is
`bg-surface px-3 font-mono text-xs text-dim` on a hairline; the row is `h-9 rounded-ctl px-3 hover:bg-hov`, ticked
`bg-ctl`, dimmed `opacity-45`. No list invents a second vocabulary.

### Shell

One persistent window: a titlebar (brand, the Live / Library / Player switch, pane toggles, window
controls), the active surface, an optional events drawer and a statusbar (running work, one notice line,
Events and Settings). Surfaces stay mounted so selection, scroll and playback survive a switch.

### Surfaces

- Workspaces fill the window. Panes use Allotment and collapse fully to zero; centre stages do not
  collapse. A closed pane is `inert`: its controls leave the tab order, and a shell key (`Ctrl+F`) never
  lands inside it.
- A narrow pane's toolbar (the Live channels head, the Library type strip) uses icons, not text buttons.
  Context actions stay contextual: a verb that could be a toolbar button is a context-menu row first (the
  Player stage has no toolbar at all). A table's selection toolbar is different: its verbs are words with an
  icon, as LoRA Trainer's are (Selection toolbar below). *(Corrected 2026-10-17: this bullet said "pane
  toolbars use icons" for every bar, and the admin's table strips became rows of unlabelled glyphs. LoRA
  Trainer's toolbars draw `‹ › ✕` as icons and every verb that changes something as an icon and a word:
  `pages/gallery/GalleryToolbar.tsx` 28-39, `pages/gallery/viewer/ViewerToolbar.tsx` 48-88.)*
- A region that is loading or empty draws skeletons in the shape of its content. No sentence is placed
  over a skeleton, and there are no separate empty-state compositions. State is never a dot: a state is a
  word, a left-edge accent strip (the family `ACCENT` bar), or a shimmer where a number is still arriving
  (a scanning collection's count).
- No explanatory text under a control. A disabled control stays in place and shows its reason as a
  tooltip.
- A control either works or is visibly disabled; no control does nothing. In phase 1a a control that
  needs the fileserver is enabled and calls its stub in `services/`, which refuses with one sentence on the
  notice line (`21` section 1); it is not disabled for want of a server.
- Colour is never the only signal.

### Forms

Forms are one column at the workspace's full width (the family `Form`'s `Workspace`), of groups and rows: a
group has a heading and a folding body; a row is a label and a control. A window sizes one label column for all its pages (Settings reads
`SETTINGS_LABELS`), so the column does not move as its rail changes page. **A group never ends with a commit (owner, 2026-10-18; `55`): the ONE
primary `Save` sits on the workspace toolbar's right, beside the promote, and commits the entire record** - a group may end with an action
(`Set new password`, `Rebuild`, `Refresh`), never a save. `alert`, `confirm`, `prompt`, ad hoc modals and feature-built focus traps are
forbidden.

Exception: a window that holds exactly one group (Title information) does not fold it, since folding it
would leave only the action strip.

### Two-step

A destructive action is an inline two-step, and it is always `components/ui/ArmedButton` (Giga Stream's
own; it replaced the family `TwoStep`, which had no blur or Escape disarm, and three hand-rolled copies). At
rest it is a ghost button naming the verb (`Remove`, `Clear history`); the first press turns it into the
danger question naming what dies (`Remove Films?`, `Clear all history?`); a second press within
`TWO_STEP_MS` (4 seconds) confirms; the timeout, focus leaving it, or Escape disarms. A remove that touches
no file (one watch entry, a collection whose files stay) is not danger at rest anywhere, including a menu row.

The family does the same (LoRA Trainer `components/ui/TwoStep.tsx` 14 and 58-66: `ghost` at rest, `danger` and
`Press again to confirm` once armed, re-armed after `TWO_STEP_MS`). A two-step is a word and draws no icon, at rest or
armed (`GalleryToolbar.tsx` 34-40, `DatasetRows.tsx` 77-79, `PresetRows.tsx` 78-80: `Delete`, `Purge rejected`, never
a bin). Over a selection the question carries the count (`Delete 3?`, `GalleryToolbar.tsx` 34); beside a row it carries
the row's name (`Delete tesst?`, `DatasetRows.tsx` 77).

Exception: a folder's Remove in the Collections folders table is an icon in a row of icon actions, so it
arms by swapping the row for the consequence in words beside a check icon (`components/collections/FolderControls.tsx`);
the same timeout, blur and close disarm it. An icon cannot turn into a question in place.

### Choice controls: pills, selects and entered values (owner 2026-10-19; `57`)

The distinction is the interaction model, not whether every option can be seen (a dropdown shows all of them when
opened):

- **`Segmented`:** exactly **two** mutually exclusive, fixed, short peer modes whose direct side-by-side comparison and
  one-click switching are the point (`File | Web address`, `Movie | Series`). Neither option is a boolean on/off state,
  a catch-all (`All`, `None`, `Any`, `System`) or navigation. Never a verb, server record, dynamic facet, sort or long
  technical value.
- **`ChipGroup`:** not used for supplied form choices. Multiple supplied choices use a field-shaped checklist (searchable
  when dynamic/large); independent boolean state uses separate Toggles. A chip cloud is never a picker.
- **Native `Select`:** **three or more choices**; any set mixing a catch-all with specific values; any dynamic,
  populated, record-backed or potentially unbounded set; long labels; secondary configuration, sorting, filtering or
  technical metadata; or a narrow pane where the pair cannot remain on one line. `QuerySelect` is the compact
  list-toolbar form of the same rule.
- **`ChipsInput`:** freeform user-entered multi-value tokens only (origins, extensions). Its chips are values already
  entered, not offered choices, so they do not count against the offered-choice limits. A supplied vocabulary never
  uses `ChipsInput`.

Hard limits: one `Segmented` is ONE pair (2 pills); one group contains at most one pair; one form/page shows at most
TWO pairs (4 pills) at once. Conditional controls count together when they can render together. A third pair becomes
`Select`, lowest-priority first. Do not count `TabPill` navigation, read-only name chips/badges, swatches or entered
`ChipsInput` tokens.

A segmented pair stays on ONE line everywhere; it never wraps, scrolls, clips or truncates. If the two labels do not
fit, use `Select`. Three or more single-choice options always use `Select`; supplied multi-choice options use a
checklist.

Binary application state stays `Toggle`, never two pills and never a select. Tabs and surface navigation stay
`TabPill`/`nav`; buttons and verbs never become chips. The pills are real buttons with `aria-pressed`; selects remain
native for their platform menu, keyboard and large-list behavior. A disabled pill's reason follows the family's
focusable-tooltip rule, never title-only copy.

#### Choice popovers (owner 2026-10-19; `58`)

One shared popover family handles choices that need check rows, icons, multi-select or searchable populated options -
never one implementation per feature:

- **Trigger variants:** `field` (full row width) and `toolbar` (compact/intrinsic) use the SAME `FIELD_BASE` dropdown
  chrome - border, surface, radius, focus and chevron - never a raised/gradient button and never transparent text. The
  visible trigger shows ONLY the selected value/summary; the control's label stays in `aria-label` and the external
  form label, never as `Label: value` inside the trigger.
- **Width:** the popup width is exactly its trigger width. A toolbar trigger owns the family's one shared minimum width
  (large enough for its option labels); a field trigger is full width. Consumers never set popup/trigger widths.
- **Single mode:** checkmark/radio rows, one selected, selecting closes.
- **Multi mode:** checkbox rows, selection stays open; an optional All row represents the complete canonical set rather
  than coexisting as a stored value beside specifics.
- **Search:** automatic when `options.length >= 12` (one family constant), absent below it. Search policy never varies
  per consumer.
- **Keyboard:** native/Radix roving rows; search focus on open when present; arrows/Home/End move rows; Enter/Space
  selects/toggles; Escape closes once, clears search and returns focus; Tab closes and continues. No custom focus trap.

`ChoicePopover` is not a second native Select style. Native `Select` remains the ordinary compact form/settings control
for static single-choice values. ChoicePopover is used when the control needs the capabilities above (multi-select,
check rows, search, icons, a toolbar quick picker). `PopupPanel` remains an authored dialog/editor and is never used as
a choice list. Consumer-built choice menus/popovers are prohibited.

### Buttons and surfaces

The family rule, from Giga Cut (`D:\Projects\giga-cut\docs\01-ARCHITECTURE-AND-STYLE-GUIDE.md` §Buttons and
surfaces, owner decisions 2026-09-30; its audit and screenshot sources are Giga Cut `22` §A1). The owner's words
there: *"the buttons should be the modern ghost buttons"* (2026-09-20). **Ghost in the body; edged only in the
chrome; at most one filled accent per surface, as a form's commit.** The titlebar is ghost too (owner,
2026-10-17: the pane toggles and the Theatre button are ghost, matching Giga Cut's titlebar).

| Variant (`components/ui`) | Allowed only here |
|---|---|
| Ghost (`Button variant="ghost"`, `IconButton` plain); the default | Everywhere in the body: pane content, rails, `Group`/`Row`/`Wide`/`Actions` verbs, row and card verbs, popovers, panel footers, notes over a stage |
| Edged (`Button` `default`, `IconButton bordered`; raised in this kit, outlined in Giga Cut's) | Popup headers and standalone body actions only. Nothing in a main OR child-window titlebar |
| Primary (`Button variant="primary"`, the accent fill) | Never in the chrome. The ONE commit at the end of a form's body (`Create`, `Save details`), the one forward verb a panel exists for (`Resume`; Title information's `Play` / `Open in Player`), and the page's forward verb in the page toolbar (`Button size="sm" variant="primary"`, below; LoRA Trainer `pages/datasets/DatasetsIndex.tsx` 66-68, `pages/datasets/DatasetWorkspace.tsx` 67-69, `pages/gallery/GalleryToolbar.tsx` 47-49) |
| Danger (`Button variant="danger"`) | Only the armed state of `ArmedButton`; never resting |
| Icon-only (`IconButton`) | Navigation, dismissal and a row's small inner actions only: `‹ ›` paging, the close `X`, move up and down, remove one entry, a narrow pane's toolbar, a form row's trailing glyph, the titlebar's pane toggles; an `aria-label` and a tooltip always. `bordered` never in the titlebar, only where a standalone icon action needs the edged shape. Never a verb that changes records (LoRA Trainer: `ViewerToolbar.tsx` 80-88, `PromptBank.tsx` 56-64, `UnfreezeGroup.tsx` 43, `Titlebar.tsx` 48) |
| Icon and word (`Button size="sm" variant="ghost"`, the icon first) | Every verb in a list's first row (the table strip) and every `Refresh`; a verb with no family icon (vocabulary below) is the word alone (LoRA Trainer `GalleryToolbar.tsx` 28-36, `CheckpointsView.tsx` 73-91, `DatasetRows.tsx` 44-46) |
| Promote verb (`Button size="sm" variant="primary"`, the operation's words, no arrow unless it opens a child window, a `title`) | The rightmost control of the PAGE toolbar, acting on the current record or ticked set (`Preview`, `Sync now`, `Run job`). Never navigation to another tab: the nav pill owns page navigation. Disabled with its reason (`Tick a row first`) when it needs a ticked row. Never in a list's first row |
| Choice (`Segmented` pair) | Exactly two fixed peer modes under Choice controls above (one pair per group, two per page), never verbs |

*(Corrected 2026-10-17: this table said a primary is never in a toolbar and drew the forward verb as a ghost word in the
table strip, so the admin lost its page toolbar. The reference draws the forward verb as the small primary at the right
of the page toolbar, over every index and workspace: LoRA Trainer `DatasetsIndex.tsx` 64-70 and `DatasetWorkspace.tsx`
61-72.)*

**Titlebar icon rule (owner 2026-10-19; `60`).** Main-window and authored child-window titlebars use the SAME default
ghost `IconButton`: transparent edge/background at rest, hover fill; a toggle gains the outlined/accent `data-on`
state while active. `size-ctl-md`, icons `size-3.75`. Close is always ghost; Maximize/Restore is the window-state
toggle - Maximize ghost while normal, Restore outlined/accent while maximized. They never pass `bordered` or wear the
control gradient/drop shadow. The rule lives in the shared `ChildWindow`, so every
Settings, Preview, Collections and Title information window inherits it without app overrides.
Window-caption icons use the dedicated VS Code chrome set from `react-icons/vsc`: Maximize ->
`VscChromeMaximize`, Restore -> `VscChromeRestore`, Close -> `VscChromeClose`. This is the ONE sanctioned non-Lucide
exception: OS/window chrome needs caption glyphs, not approximate content icons. Lucide `Square`/`Copy` and diagonal
`Maximize2`/`Minimize2` are forbidden in window chrome.

### Page toolbar

Every page opens with its page toolbar (LoRA Trainer `components/layout/Toolbar.tsx` 12-25; the family's
`layout/Toolbar` and `layout/Sep` in `src/shared/ui`):
`<div className={cn(STRIP, 'bg-panel', className)} role="toolbar">{left}<span className="min-w-0 flex-1" aria-hidden />{right}</div>`,
where `STRIP` is `flex flex-none flex-wrap items-center gap-2 border-b border-hair px-3 py-2` (`components/media/HandoffStrip.tsx`
8) and `Sep` is the hairline between clusters (`Toolbar.tsx` 22-25).

- **Placement.** The toolbar is the first child of the centre pane, above the scrolling column, and never scrolls away
  (`DatasetsIndex.tsx` 63-72: the `Toolbar`, then `<div className="min-h-0 flex-1 overflow-y-auto">` holding the New form
  and the rows; `DatasetWorkspace.tsx` 60-73).
- **An index** holds only the page's promote, on the RIGHT. An index with no promote still draws the toolbar, empty, so
  the page keeps its place from tab to tab. A promote acts on the current/ticked records; it NEVER changes tabs (`56`).
- **A workspace** holds `Discard changes` on the LEFT, and on the RIGHT `Save` (the one commit, `55`) then the promote
  rightmost (`DatasetWorkspace.tsx` 61-72). No save ever ends a form's body (Forms, amended).
- **The promote** is `Button size="sm" variant="primary"`: the operation's words and a `title` saying what it does,
  disabled with its reason when it cannot act. Per page (`56`): Channels, Providers and Titles indexes `Preview`
  (exactly one ticked previewable row); Playlists `Sync now` (the ticked set); Jobs `Run job` (the ticked set); Accounts
  none. Channels, Providers and Titles workspaces `Preview` (`Save the record first` while dirty); Playlist `Sync now`;
  Jobs `Run job` (`Resume` after a stopped run); Accounts none. Cross-tab actions (`Titles →`, `Jobs →`, `Channels →`)
  do not exist in page toolbars - the titlebar nav pill is the one navigation control.
- Every button in it has a tooltip (`title`), as LoRA's do.

### Selection toolbar

What acts on the LIST lives in the list's own first row, inside the list group, never on the group heading and never in
the page toolbar (LoRA Studio `components/library/LibraryToolbar.tsx` 7-12: "a heading is tile, title and badge; what
acts on the list sits in the list's first row"). That row is the admin's `TableStrip`, drawn with LoRA Trainer's
gallery-toolbar grammar (`pages/gallery/GalleryToolbar.tsx`, `06` section 2.4, `03` sections 4.2 and 4.3). It holds only
list verbs; the page's forward verb is the page toolbar's. Left to right:

1. **`Refresh`**, the icon and the word, first on the left, then a hairline separator (LoRA `CheckpointsView.tsx` 73-76,
   `Rescan` then `Sep`). LoRA puts a list's `Refresh` on its group heading (`DatasetRows.tsx` 43-46); a Giga Stream
   heading carries no button (Headings), so it is the strip's first verb.
2. **The selection verbs**, always drawn, in a fixed order with the two-step `Delete` last. With nothing ticked each one
   is disabled with its reason (`Tick a row first`; LoRA `Select images first`, `GalleryToolbar.tsx` 28-34), so the bar
   never changes shape when the first row is ticked. *(Corrected 2026-10-17: the strip drew its verbs only while rows
   were ticked; a verb is present and states its refusal before the press, `03` section 4.3.)*
3. **The three-state `All` checkbox** (all, none or some of the listed rows) **sits in the table's HEADER, in the tick
   column directly above the row ticks** (owner, 2026-10-18: a toolbar `All` at the far right was nowhere near the
   checkboxes it controls; LoRA's gallery has no checkbox column, so its right-hand `All` does not apply to a table).
   From "some" a press selects all; from "all" it clears. It replaces a `Clear selection` button: a button cannot show
   whether anything is selected (`06` section 2.4 "Selection is a checkbox, not a pair of verbs"). It obeys the list's
   filters and paging: it means the rows listed, never every record; `Select all M matching` stays in the selection
   toolbar.
4. **Navigation**: a list that pages draws `‹ ›` (`Newer`, `Older`) as icons (LoRA `ViewerToolbar.tsx` 80-85).

No forward verb: it moved to the page toolbar (Page toolbar above). *(Corrected 2026-10-17: item 5 put the forward verb
rightmost in this strip.)*

**No text in the toolbar** (LoRA `03` section 4.2; `06` section 2.4: "Five controls, and no status text"). No
`N selected` count: the count is in the armed question (`Delete 3 channels?`) and the run's summary on the notice line.
The strip is one row (LoRA `components/media/HandoffStrip.tsx` 8: `gap-2 px-3 py-2`, a hairline under it).

A row's own verbs stay at its end, ghost `sm` words in one fixed-width column (`Delete` as the two-step, `Restore`;
LoRA `DatasetRows.tsx` 76-80). Clicking a row opens it; the tick in the first column selects it (`DatasetRows.tsx`
67-69). A form's commit ends the form's body (Forms), never the toolbar.

### Icon vocabulary

One icon per verb, taken from LoRA Trainer or the interface, never chosen per screen. A verb not listed has no icon and
is drawn as its word; a verb is never given an icon to fill a gap.

| Verb | Lucide icon | Source |
|---|---|---|
| Refresh, Rescan | `RefreshCw` | LoRA `DatasetRows.tsx` 45, `CheckpointsView.tsx` 74; interface `TypeStrip.tsx` 24 |
| Enable (include it: LoRA's Keep) | `Check` | LoRA `GalleryToolbar.tsx` 29, `ViewerToolbar.tsx` 65 |
| Disable (exclude it, keep the record: LoRA's Reject) | `X` | LoRA `GalleryToolbar.tsx` 32 |
| Run, Play | `Play` | interface `CardActions.tsx` 22, `TitleInfoWindow.tsx` 75 |
| Restore, Revert to the source | `RotateCcw` | interface `AppearanceSection.tsx` 78 (`Restore defaults`) |
| Preview, View | `Eye` | LoRA `ViewerStrip.tsx` 43 (`View`) |
| Download | `Download` | LoRA `CheckpointsView.tsx` 79 |
| Choose or open a folder | `FolderOpen` | LoRA `PathField.tsx` 36, `DatasetWorkspace.tsx` 65 |
| Attach a folder | `FolderPlus` | interface `CollectionFolders.tsx` 59 |
| Replace a folder | `FolderSync` | interface `FolderControls.tsx` 46 |
| Remove a folder | `FolderMinus` | interface `FolderControls.tsx` 60 |
| Cancel a scan, Stop | `CircleStop`; the statusbar's Stop `Square` | interface `FolderControls.tsx` 58; LoRA `Statusbar.tsx` 71 |
| Choose a file to upload | `Upload` (the ghost `Choose file` button over a hidden file input) | LoRA Studio `ImagesGroup.tsx` |
| Add an entry | `Plus` | LoRA `PromptBank.tsx` 72 |
| Move up, Move down | `ArrowUp`, `ArrowDown` | LoRA `PromptBank.tsx` 56-60 |
| Previous, Next (Newer, Older) | `ChevronLeft`, `ChevronRight` | LoRA `ViewerToolbar.tsx` 80-84 |
| Back (a rail's way back) | `ArrowLeft` | LoRA `NavRail.tsx` 40-41 |
| Close, remove one entry | `X` | LoRA `ViewerToolbar.tsx` 86, `PromptBank.tsx` 62 |
| Reroll | `Dices` | LoRA `ComposeRail.tsx` 66, `RunDetailsGroup.tsx` 26 |
| Explain (the info glyph) | `Info` | LoRA `components/ui/Tooltip.tsx` 97 |
| More (a card's menu) | `Ellipsis` | interface `CardActions.tsx` 40 |
| Delete, Purge, Resume, Save, Create; the admin's `Rebuild` and `Sync now`, which no family app has an icon for | none: the word | LoRA `GalleryToolbar.tsx` 34-40, `CheckpointsView.tsx` 86-91, `PresetWorkspace.tsx` 64-71 |
| A forward verb | none: the word and `→` | LoRA `GalleryToolbar.tsx` 48, `DatasetWorkspace.tsx` 68 |

`X` means two things in the family: Reject (or Disable), always with its word, and Close or remove one entry, an icon
alone. LoRA's viewer draws both on one bar (`ViewerToolbar.tsx` 68 and 87), and the word is what tells them apart. A
group's tile icon (`Group icon=`) names a group, not a verb, and is not in this table.

A lit toggle outside the titlebar is its accent glyph alone (a filled accent star for a favourite), with no
edge and no `on` raise: the list row's star and Title information's Favorite are plain ghost buttons whose
glyph lights. The statusbar's Events door is chrome and keeps its tint while the drawer is open; the Settings
door is not a toggle, since the Settings window's scrim covers it. A control that is not a verb (a select, a
field, the Genre picker that opens like one) is a field, not a button: it draws `Field`'s box and chevron.

Exception: the Rows shelves' edge chevrons are raised round buttons in the body. They sit over artwork,
where a ghost button would vanish against the picture, and they appear only while the row is hovered or
focused.

### Headings

Five heading roles, each one component's, and no surface invents a sixth:

| Role | Style | Where |
|---|---|---|
| Page group | `Form` `Group`: 48px icon tile, mono 28 | Settings, Collections, Title information |
| Rail section | `Section` header: 11px sans semibold, faint, a turning chevron | Live and Player rails |
| Rail group | `NavRail` heading: 12px sans, dim | the Library rail (Views, Collections) |
| Strip or shelf | mono 12, faint, the count dim | Continue watching, the Rows shelves, the Live channels head |
| Filter label | 14px sans semibold over its control | the Library filters pane |

A heading carries nothing: no button, no search, sort or view switch. LoRA Trainer's `Group` has an `action` slot for a
list's `Refresh` (`components/ui/Form.tsx` 58 and 96, `DatasetRows.tsx` 43-46); Giga Stream follows LoRA Studio instead
(`components/library/LibraryToolbar.tsx` 7-12; owner; `06` section 6, the Collections window), so that `Refresh` is the
first verb of the list's first row, and a page's verbs are its page toolbar's.

The brand and the surface switch in the titlebar keep the family's own radii and spacing, drawn as the family
draws them; they are not rebuilt from the token scale.

### Overlays

Use the smallest surface that fits: a menu or select for a choice; a tooltip for an explanation; an
authored popup (compact 242px, standard 460px, wide 602px) for bounded information or an editor,
nonmodal and anchored to its opener; a modal work window for a substantial task; a drawer for an
operational utility. Only one popup or work window is open at a time. A popup is not a focus trap;
focus returns to its opener only if it still exists.

Exception (owner, 2026-10-18): Library's **Search titles** spotlight (`06` section 4.6) is a floating
window modelled on macOS Spotlight (no scrim and no dimming, no dialog role; one floating bar that grows a results list and a
preview pane) that a work window may stack over. A result row's **Info** opens Title information above the spotlight without closing it: the
window's scrim washes over the spotlight, and while the window is open the spotlight ignores outside presses, focus
leaving it and Escape. Closing Title information (its `X`, `Escape`) returns to the spotlight with its query, results
and focused row intact, and focus goes back to the row's Info. This is the only stack: the spotlight never opens over a
window, and nothing opens over Title information while it stands on the spotlight.

The context menu runs a chosen row's action after the menu has closed and given focus back to the row's
opener (`components/ui/ContextMenu.tsx`). A row that opens a work window (a collection's `Rename…`) therefore
hands focus to that window's frame, and the menu's own close never takes it back; run inside the menu's select,
the menu's focus trap would pull focus out of the new window and leave it deaf to its own Escape.

The video stage is dark in every theme (`--color-stage`); the light theme lightens the chrome and panes, never
the picture area.

## 10. Verification

- A visible feature is not done on compilation. It is run, in a browser or the Electron window, and
  looked at.
- The default test run is fast (seconds). Heavy suites are opt-in and run once at the end.
- Checks start the programs on free ports with temporary data folders. They never touch the owner's
  data, saved layout or running app, and they never start a program the owner has not asked for. Page
  level fakes (the state read, a fetch) live in a harness outside the repository.
- Test seams: tests inject the clock, scheduler and fetch; nothing sleeps.
- The gate runs every typecheck, the lint, the rule checker and every program's tests, and must pass
  before work is called done. Its result is reported as it ran.
