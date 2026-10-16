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
   image cache: the only backend-derived bytes on its disk
   passes the backend's channels, titles and providers through
   in memory, never to its database
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
 (in development: the streaming test server, scripts/live-server);
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
- one in-memory live view of the backend's channels, titles and providers, read from the backend
  on demand, never written to disk;
- the image cache: images from the backend, on disk under the data folder, fetched lazily on first
  request, the only thing kept from the backend;
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

### 1.4 Not in the system

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
| Servers | Fastify 5 (the admin backend adds `@fastify/websocket` for its read-only socket) |
| Local data | `node:sqlite` (fileserver) and `node:sqlite` (backend), separate databases |
| Desktop | Electron, sandboxed renderer, context isolation, no Node integration |
| Live playback | hls.js whenever the browser can run it; the browser's own HLS only as a fallback |
| Icons | lucide-react |
| Quality | oxlint, TypeScript, an executable architecture checker |

Changing a locked dependency requires updating this document first.

## 3. Repository layout

```text
giga-stream/
|-- docs/
|-- scripts/
|   |-- check-rules.mjs         the executable copy of this guide's rules
|   |-- check/                  the gate
|   |-- fixtures/               makes the test video files (`10` section 2.1)
|   `-- live-server/            the streaming test server (development and tests)
|-- src/
|   |-- frontend/src/           components, hooks, lib, pages, services, store, styles, types, constants
|   |-- fileserver/src/         app, routes, services, store, types
|   |-- backend/src/            api, services, store, events, types, constants
|   |-- shared/                 libraries any program or tool may import (section 4.2); not programs
|   `-- mockup/                 the provider playback proof of concept (`14`): plain HTML, CSS, JS; not a
|                               program, never packaged, and outside the rules below
`-- package.json                aggregate dev, build, check and test scripts
```

Folders named `utils`, `util`, `helpers`, `misc` or `common` are forbidden. Name the domain.

## 4. Dependency and ownership rules

### 4.1 One of each

- One interface request layer (`services/api.ts`); there is no interface WebSocket.
- One Zustand store.
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
  reading a file's facts with ffprobe, and finding the video files in a folder). Any program, the
  streaming test server and the fixture tools may import it; it never imports a program, and it holds
  no state of its own (no database, server or socket). It follows every rule of this guide. It is
  written in TypeScript using only syntax Node can strip (no `enum`, `namespace` or parameter
  properties), so the `.mjs` tools run it directly and the programs compile it with their own code.
- Electron imports are confined to `src/fileserver/src/app`.
- `node:sqlite`, filesystem paths and child processes are service concerns, never route or interface
  concerns. SQL strings exist only under `store/`.

### 4.3 Route boundary

Every route does exactly: parse and validate input, make one service or repository call, map the
result to the standard envelope. A route never opens files, queries SQLite, creates sockets or
spawns processes. Every route begins `/api`; `/healthz` and `/ws` are the only root exceptions.

### 4.4 Interface transport boundary

- Components, pages, hooks and the store never call `fetch` or construct a `WebSocket`.
- Application URLs are relative. A backend URL never appears in interface source, except as the
  Settings draft that is sent to the fileserver.
- REST performs every mutation; each answer reports the consequence of the write, so the interface
  learns what changed from the call it just made, not from a second channel.
- There is no WebSocket anywhere in the system. The interface reads state when it needs it — mount,
  a surface switch, after its own actions, a Refresh — and never on an interval: no polling, no
  long polling, no SSE subscriptions, no request loops or timers, in any program or tool.
- One exception for streamed answers: a long-running operation (a folder scan, `03` section 3.8)
  answers with a single streamed NDJSON body that reports progress as the work happens — one
  request, one answer, not polling.
- The system's single timer exception is the admin backend's catalog-sync scheduler (`03` section
  7.6b): an internal timer, armed by `TMDB_SYNC_SCHEDULE`, that pulls **title metadata** into the
  title store. Images are never part of it: image bytes are fetched and served by the fileserver's
  image cache (`03` section 3.11) lazily on first request — the backend never stores or serves a
  media byte (section 7).
- No browser storage: nothing the user chose lives in `localStorage`, `sessionStorage` or IndexedDB.
  Saved state is a fileserver row.

## 5. TypeScript and source rules

- `strict` everywhere; the servers also enable `noUncheckedIndexedAccess`.
- `any`, `@ts-ignore` and double assertions are forbidden. External values start as `unknown` and are
  validated and narrowed. State machines are discriminated unions.
- Source files are at most 200 measured lines and tests 250, wrapping logical lines at 120 columns.
- One exported React component per file; the filename matches the export; named exports.
- Components are `PascalCase.tsx`, hooks `useThing.ts`, everything else kebab-case. Types live under
  `types/`, one domain per file. No arbitrary barrels.
- No configuration literals in components: ports, timings, limits and copy live in named constants.
  Constants are `SCREAMING_SNAKE_CASE` in kebab-case files.
- Comments explain non-obvious decisions, not syntax.

## 6. Interface layers

- **Components** render props and call named callbacks. They do no I/O, touch no storage, own no
  application timers or global listeners, and do no pane math.
- **Hooks** connect React's lifecycle to services and the store. One hook, one concern.
- **The store** holds transient UI state and the projections the surfaces share. It performs no I/O
  and holds no promise, timer, DOM node or media element. Components select the narrowest slice.
- **Services** own REST, decoding, retries and the streamed scan body, and return typed domain results.
- **`lib`** is pure: no React, Zustand, services, store or device APIs.

## 7. Server rules

### Fileserver

- Repositories own SQL, services compose repositories, routes call services.
- Migrations are forward-only, numbered and transactional; a newer schema is refused.
- Backend data is read live on demand, held in memory, and never written to the database. A failed
  read clears the in-memory view and sets the backend error; local data stays usable, and the next
  successful read refills the view.
- Local paths never enter a URL or a DTO. Local files always play through Range routes; `file:` is
  forbidden.
- Jobs that outlive a request are persisted, cancellable and marked `interrupted` after a restart.
- A scan is answered as one streamed NDJSON body (section 4.4); a client going away never stops the
  job it started.
- Navigation guards cover `will-navigate`, redirects, frames and new windows. The preload exposes
  named capabilities only; generic `invoke`, raw IPC and Node objects are banned.

### Backend

- Reads are public; every change needs a signed-in admin's JWT and writes an audit entry (`03` sections
  7.11-7.13). Off loopback it runs only behind TLS (`03` section 7.10).
- The backend's socket, where a client still wants one, carries the revision only; the reader reads again.
- No route accepts, uploads or serves video, local files or media bytes.

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

### Shell

One persistent window: a titlebar (brand, the Live / Library / Player switch, pane toggles, window
controls), the active surface, an optional events drawer and a statusbar (connection, one notice line,
Events and Settings). Surfaces stay mounted so selection, scroll and playback survive a switch.

### Surfaces

- Workspaces fill the window. Panes use Allotment and collapse fully to zero; centre stages do not
  collapse.
- Pane toolbars use icons, not text buttons. Context actions stay contextual.
- A region that is loading or empty draws skeletons in the shape of its content. No sentence is placed
  over a skeleton, and there are no separate empty-state compositions.
- No explanatory text under a control. A disabled control stays in place and shows its reason as a
  tooltip.
- A control either works or is visibly disabled; no control does nothing.
- Colour is never the only signal.

### Forms

Forms are one column, at most 760px, of groups and rows: a group has a heading and a folding body; a
row is a label and a control. One primary commit sits at the end of the final group. Destructive
actions are an inline two-step: the first press arms the same control and names the consequence, the
second confirms; a timeout, focus loss or Escape disarms. `alert`, `confirm`, `prompt`, ad hoc modals
and feature-built focus traps are forbidden.

### Overlays

Use the smallest surface that fits: a menu or select for a choice; a tooltip for an explanation; an
authored popup (compact 242px, standard 460px, wide 602px) for bounded information or an editor,
nonmodal and anchored to its opener; a modal work window for a substantial task; a drawer for an
operational utility. Only one popup or work window is open at a time. A popup is not a focus trap;
focus returns to its opener only if it still exists.

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
