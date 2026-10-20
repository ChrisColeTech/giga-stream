# 61 - Browser localStorage persistence plan

**Status: plan, written before the code (coordinator, branch `dev`, base `d33a55a`).** Owner, 2026-10-19: "how
would we add localstorage persistence to the frontend when running in the browser, but when running on desktop
persist to the sqlite db?" — with the answer that user accounts are coming to the backend API, so collections
and favorites will be stored with the user account, while shell/layout, watch history and settings become local
in the browser. This document records what the code does today (read file by file; the code wins over the
docs), the design, the change list in two waves, the tests, the failure modes and how the coordinator verifies
it on the real stack. The follow-up plan is `docs/62` (user accounts on the backend): it moves settings,
collections and favorites to the account and adds the frontend auth gate, keeping this plan's local stores as
the signed-out and offline state.

## 1. What exists today (verified)

### 1.1 Frontend (`src/frontend/src`)

| Piece | Where | Finding |
|---|---|---|
| Snapshot read | `services/state.ts` | `readState` is one `GET /api/state`; `decodeState` validates each part with its zod schema and collects failures in `unreadable`. Parts: `version`, `host` (with `runtime`), `settings`, `shell`, `backend`, `channels`, `lastChannelId`, `collections`, `jobs`. |
| Shell transport | `services/shell-state.ts` | `readShellState`/`patchShellState` on `GET`/`PATCH /api/shell-state`; `fromWireShell`/`toWireShell` map the seven panes (`PANES`, lines 6-14) and clamp sizes to pane limits. |
| Settings transport | `services/settings.ts` | `readSettings`/`patchSettings`/`saveSetting` on `GET`/`PATCH /api/settings`; every patch is parsed by `SettingsPatchSchema` first. |
| Watch transport | `services/watch.ts` | `writeWatch` is `PUT /api/watch` (`quiet`, optional `keepalive`), `removeWatch`/`clearWatch` are `DELETE`s. |
| Library reads | `services/library.ts` | `readLibrary` asks `GET /api/library` with `view`, `watched` and the rest of the query — the fileserver decorates rows with watch marks and filters; `readContinue` asks `GET /api/library/continue`. `libraryRowIdentity` prefers `item.watchId`. |
| Shell writeback | `hooks/useShellWriteback.ts` | `startShellWriteback`: store subscribe → 400 ms debounce → `write` (`patchShellState`) → `markShellSaved`. Gated by `shellWriteEnabled`; failures are spoken, never retried silently. |
| Settings writeback | `hooks/useSettingsWriteback.ts` | The same machinery with `write: patchSettings` (line 85). |
| Hydration | `store/shell-hydration.ts` | `applySnapshot` runs once; `shellWriteEnabled` is true only when the snapshot carried a `shell` part, `settingsWriteEnabled` only when it carried `settings`. `lastChannelId` comes from the snapshot or null. |
| Title memory | `store/library-item-memory.ts` | An incremental, indexed merge of every `LibraryItem` ever read — the natural join point for building cards from watch entries. |
| Runtime signal | `services/desktop.ts` | Returns `window.pocHost`, null in a browser; `pocHost.runtime === "electron"` already decides native behaviour in `PlayerStage.tsx`, `useNativeOverlay`, `guard-events`, `player-policy`. |

### 1.2 Fileserver (`src/fileserver/src`)

| Piece | Where | Finding |
|---|---|---|
| State route | `routes/state.ts` | `GET /api/state` answers everything at once; `lastChannelId` rides along only when the `liveOnOpen` setting is `"last"` (lines 17-19). No writes. |
| Shell route | `routes/shell-state.ts` | `GET`/`PATCH /api/shell-state`; a refused patch is `422 settings.invalid`, whole. |
| Last channel write | `routes/channels.ts` line 36 | `services.channelState.writeLastChannelId(body.channelId)` — the frontend has no local notion of it. |
| Watch store | `store/watch-repository.ts`, `services/watch-service.ts` | `watch_entries` in `node:sqlite`; sticky `watched`; the `watchedPercent` setting is read at each write (`app-services.ts` 128-131). |
| Library lists | `services/library-lists.ts` | History and Continue are computed server-side from the watch table (Continue: newest `watching` entry per item, at most 10). The `?watched=` filter of `/api/library` is server-side too. |

### 1.3 Rules that own this today

- `docs/01` line 213: "No browser storage: nothing the user chose lives in `localStorage`, `sessionStorage` or
  IndexedDB."
- `docs/02` line 131: "The interface never reads or writes browser storage."
- `docs/04` lines 60-63: what survives a restart is only what the fileserver stores.
- `scripts/check-rules/rules/transport-and-routes.mjs` lines 50-52: a hard finding for the bare word
  `localStorage`/`sessionStorage`/`indexedDB` anywhere in a client program — the gate fails before any review.

All four must be amended in the same wave that adds the code, or the change cannot land.

## 2. Target design

### 2.1 Where each domain lives

| Domain | Desktop (Electron) | Browser |
|---|---|---|
| Shell: surface, panes, sizes | fileserver SQLite over REST (today, unchanged) | `localStorage` |
| Settings | fileserver SQLite over REST (unchanged) | `localStorage` |
| Watch history | fileserver SQLite over REST (unchanged) | IndexedDB (never `localStorage`: a per-episode log grows past its ~5 MB) |
| Last channel | fileserver SQLite (unchanged) | `localStorage` |
| Favorites, collections | server today; user accounts in `docs/62` — out of scope here | server today; accounts in `docs/62` |
| Settings (signed in, once `docs/62` lands) | the account, local as cache | the account, local as signed-out and offline store |
| Catalog, channels, jobs, live, titles | live from the fileserver, never persisted | same |

### 2.2 The resolver: one switch per domain, two inputs

`services/persistence.ts` defines **the** storage abstraction, designed once here so `docs/62` adds a backend
instead of a second switch: one `DomainStore` per persisted domain (`read`/`write`, zod at the boundary), and
one resolver `storeFor(domain)` consulted at each access — never frozen at boot — over two inputs:
`runtime` (`window.pocHost?.runtime === "electron"`, the signal `services/desktop.ts` already uses) and
`signedIn` (fixed to signed-out until `docs/62` supplies the session; the resolver then routes settings,
favorites and collections to the account backend with no new mechanism). Backends: the server store (today's
REST calls, verbatim) and the local store (§ 2.3). The three transport services (`shell-state.ts`,
`settings.ts`, `watch.ts`) call the resolver instead of `api()` directly, with **identical signatures** — the
writeback hooks, the revision machinery and their tests do not change.

### 2.3 The local stores

`services/local-state.ts` owns `window.localStorage` for the small domains: keys `giga.v1.shell`,
`giga.v1.settings`, `giga.v1.lastChannelId`, JSON, validated with the **wire schemas the fileserver already
answers with** (`ShellStateSchema`, `SettingsSchema`) — a corrupt, hand-edited or outdated blob is discarded
exactly like a failed part of `decodeState`: reported in an `unreadable` list, state falls back to defaults. A
failed `setItem` (quota, private mode) is spoken to the events drawer as a warning; the in-memory store keeps
working. The version prefix (`v1`) is the migration hook for later waves. `services/local-watch.ts` (§ 2.5)
owns IndexedDB the same way; the rule checker's allow-list names both files and nothing else, and
`sessionStorage` and IndexedDB stay banned everywhere else.

### 2.4 Hydration in the browser

`applySnapshot` gains a browser mode: `shell`, `settings` and `lastChannelId` come from `local-state`; `host`,
`backend`, `channels`, `collections`, `jobs` and `version` still come from `GET /api/state` as today.
`shellWriteEnabled`/`settingsWriteEnabled` become true as soon as the local parts are applied — a down or
unreachable fileserver no longer blocks layout and theme persistence. Writes go local without a server round
trip. The desktop path is byte-identical to today.

### 2.5 The local watch store (browser only), on shared semantics

**One implementation, not a port.** The review of this plan rejected a client-side re-implementation as a
drift risk, so the pure entry semantics move to `src/shared/watch`: identity (item plus exact episode), the
`watchedPercent` threshold applied at write time, sticky `watched`, newest-first ordering, Continue (newest
`watching` entry per item, at most 10) and the history page slice. `docs/01` section 4.2 exists for exactly
this: a shared library any program may import. The fileserver's `watch-service` and `library-lists` are
refactored onto it (their behaviour and their tests stay green, unchanged), and the frontend's
`services/local-watch.ts` consumes the same functions — there is nothing to drift.

`local-watch.ts` keeps the entries in IndexedDB (object store `watch`, key = entry identity, database
`giga.v1`) — a per-episode log outgrows `localStorage`'s ~5 MB. Reads and writes are async, which the writeback
shape already tolerates; the `pagehide`/`visibilitychange` flush stays, since an IndexedDB put is not
synchronous. Each write's answer carries the same `entry` the server answers with, so `PlayerProgress` and the
item watch marks are untouched.

**The `?watched=` filter is out of v1 in the browser.** The library is ~43,000 titles served in pages; the
client cannot filter correctly on the pages it has loaded, and shipping watched ids per query is a server
change plus a history leak. In the browser runtime the Library's watched control renders visibly disabled with
its truthful reason (the docs/06 rule: a control works or is visibly disabled); the desktop's server-side
filter is unchanged. Revisit when accounts own watch state.

Continue and History in the browser are computed from the local entries and joined to the store's title memory
(`library-item-memory`), with `GET /api/titles/:id` as the fallback for an entry whose title was never read;
history pages client-side at the server's page size.

### 2.6 Data flow

```text
browser                                                  desktop (unchanged)
  UI action → store (revisions, as today)                  UI action → store
    → useShellWriteback / useSettingsWriteback               → writeback hooks
    → patchShellState / patchSettings                        → REST → fileserver SQLite
    → persistence.ts → local-state.ts → localStorage        watch: PUT /api/watch → SQLite
  playback → usePlayerProgress → writeWatch
    → resolver → local-watch.ts → IndexedDB
  Library read → /api/library (catalog only)
    → decorate + continue/history locally (src/shared/watch)
    → the watched filter control is disabled in the browser (v1)
```

## 3. What does not change

- **The fileserver.** No route, service, store or schema change. Every REST answer keeps its shape; a browser
  that ignores the `shell`/`settings` parts of `/api/state` is just a client that does not use them.
- The writeback machinery: revisions, the 400 ms debounce, `markShellSaved`/`markSettingsSaved`, refusal speech.
- Favorites and collections: still the fileserver's routes until accounts land; deliberately not forked.
- The admin app: untouched.

## 4. Change list

### Wave 1 — the seam, shell, settings, last channel

| File | Change |
|---|---|
| `src/frontend/src/services/persistence.ts` | new: the runtime fork, the two backends |
| `src/frontend/src/services/local-state.ts` | new: the only `localStorage` access; keys, zod validation, unreadable reporting |
| `src/frontend/src/services/shell-state.ts` | route calls through the backend; signatures unchanged |
| `src/frontend/src/services/settings.ts` | same |
| `src/frontend/src/store/shell-hydration.ts` | browser mode sources shell/settings/lastChannelId locally; write gates open without a server answer |
| the frontend's last-channel write site | in browser mode, mirror `writeLastChannelId` into `giga.v1.lastChannelId` |
| `scripts/check-rules/rules/transport-and-routes.mjs` | allow `localStorage` in `services/local-state.ts` only (a `LOCAL_STATE_HOME` test beside `FETCH_HOMES`); keep `sessionStorage`/`indexedDB` banned |
| `docs/01` line 213, `docs/02` line 131, `docs/04` lines 60-63 | amend: browser storage on the browser runtime only, for the four local domains, never providers, tokens or secrets |
| tests | below |

### Wave 2 — local watch and the library join

| File | Change |
|---|---|
| `src/shared/watch` | new: the pure entry semantics (identity, threshold, sticky, ordering, continue, history page) |
| `src/fileserver/src/services/watch-service.ts`, `library-lists.ts` | refactored onto `src/shared/watch`; behaviour and tests unchanged |
| `src/frontend/src/services/local-watch.ts` | new: the IndexedDB store over the shared semantics |
| `src/frontend/src/services/watch.ts` | route through the resolver |
| `src/frontend/src/services/library.ts`, `hooks/useLibraryData.ts` | browser-mode decoration, Continue/History from local entries |
| the Library watched control | visibly disabled with its truthful reason in the browser runtime |
| `docs/02`, `docs/06` | the Continue/History sections note the browser computation and the disabled filter |

## 5. Tests (`node:test`, mirrors of the fileserver's own)

- `local-state`: round-trip per domain; corrupt JSON discarded and reported; a schema-mismatched (older) blob
  discarded; a throwing `setItem` spoken as a warning with state intact; the rule checker accepts
  `local-state.ts` and still rejects `localStorage` anywhere else in a client.
- `local-watch`: round-trips over an IndexedDB stub; the fileserver's watch-suite assertions run against
  `src/shared/watch` itself — the same suite both programs inherit, so there is no ported copy to drift; title
  join with the `/api/titles/:id` fallback; the watched control disabled in the browser and working on desktop.
- `persistence`: resolver selection per (runtime, session) with a fake `window`; desktop delegates to the same
  REST calls as today; the session input is present and pinned to signed-out until `docs/62`.
- `hydration`/`writeback`: browser mode hydrates and enables writes with no server answer; the desktop tests
  pass unchanged.

## 6. Failure modes

| Failure | Behaviour |
|---|---|
| Quota exceeded / private browsing (a failed write) | warning in the events drawer; the session keeps its state; nothing crashes |
| IndexedDB unavailable (rare; old embedded webviews) | the browser runtime degrades to read-only history: entries are kept in memory for the session, not persisted, spoken once |
| Watched filter in the browser | visibly disabled with its truthful reason in v1; no wrong or holey results are ever shown |
| Corrupt or outdated blob | discarded, counted in `unreadable`, defaults apply, the next write replaces it |
| Two browser tabs | last write wins; `storage`-event sync is explicitly out of scope (a follow-up if wanted) |
| Clock moved backwards | only reorders local history; no server semantics involved |
| First paint theme flash | the browser can read `giga.v1.settings` before React mounts; noted as an option, not in scope |

## 7. Verification on the real stack (coordinator)

1. Chrome on the Vite port 5171 (browser runtime): change layout and theme, play a title to build position,
   close the tab, reopen — everything restored; the fileserver's database gained no shell/settings/watch rows.
2. The Electron window of `npm run dev` (desktop runtime): restart the app — restored from SQLite as today; the
   DevTools application tab shows no `giga.v1.*` keys.
3. Browser tab with the fileserver stopped: layout and theme still hydrate; the catalog shows not-connected;
   no console errors.
4. `node scripts/check/gate.mjs` with the amended rule checker, then the wave's normal visual acceptance at
   both required sizes.
