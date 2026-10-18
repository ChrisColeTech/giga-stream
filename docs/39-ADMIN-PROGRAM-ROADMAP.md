# 39 - Admin program roadmap (the wired program, no fixture waves)

**Status: the program plan from 2026-10-17; it supersedes the wave order of `27`, `28` and `29`.** Owner: no fixture waves. Every tab is built directly
against the real backend routes through the service modules (the stubs of the foundation replaced by real calls); pages call typed service methods and
never hold fixture data; a service that is not wired surfaces as a visible refusal; a wave exits only when every control is really wired and verified.
Tabs run as parallel workers after Accounts, where their files do not overlap. This document holds the order, the file ownership that keeps parallel
workers from colliding, the progress table and the coordinator's acceptance method. The per-wave plans are `35` (Accounts), `36` (Channels and Preview),
`37` (Providers and Titles), `38` (Playlists and Jobs); the sweep is section 6. The reference content of `26`, `28` and `29` (look, fields, copy, routes,
wire shapes, state persistence) still governs; only their fixture-first wave split is retired.

## 1. What has landed (verified in git, 2026-10-17)

| Piece | What | Where |
|---|---|---|
| Wave 0 | the backend: B1 per-account UI state (`017`, `GET`/`PUT /api/auth/me/state`), B2 provider `enabled` and `null` clears, B3 title body limit, B4 job outcome sentence and counts, B5 audit names and `editedFields`, B6 live-smoke port | `5749213`, `6432525`, `9045a8d` |
| Wave 1 | the shared library: `src/shared/ui`, `src/shared/http`, the pane engine, windows, shell | `d1aa570`, `51e2cec`, `6914728`, `4f21c11` |
| Wave 2 | the admin shell: titlebar, statusbar, Events drawer, Settings window, six tab pages (index skeleton), shared record pieces | `4aca5f8` |
| Wave 2a | the auth gate (`34`): the full-window wall, the form, the `AuthPort` seam | `487b934`, `a19845e` |
| **F** (foundation) | library `RecordGrid`, `RecordGridRow`, `SkeletonGrid`, `Checkbox`, pill `ChipGroup`; channel wire types and pure helpers; the request layer (`services/api.ts`, `session-api.ts`), the real auth port, the tokens in the session slice, zod schemas for every resource, `constants/api-sentences.ts`, the typed service modules (accounts real; channels, providers, titles, playlists, jobs, audit, account-state, health **not connected**), fixtures deleted | `6fcbeda`, `4386de2`, `07b60d7` on `admin/channels`, merging into `family-port` |

## 2. The order and the parallelism

```text
F (landing) --> 3a Accounts (35) --+--> 3b Channels + Preview (36) --+
                                   +--> 3c Providers + Titles (37) --+--> 4 Sweep (section 6) --> done
                                   +--> 3d Playlists + Jobs (38) ----+
```

- **3a first, alone.** Accounts needs the shared record pieces (`StateWord`, `useRecordForm`), the per-tab slice registry and the stale registry (section 5); every
  other wave needs those, so 3a lands them first. 3a also finishes the real session (the actor's id, the serial, the audit service wired).
- **3b, 3c, 3d in parallel**, each cut from the same `family-port` commit after 3a. Their owned files do not overlap (section 4); the only shared files are the ones in section 5, which they do not edit.
  One cross-tab dependency: 3d's Playlist Status lists a playlist's channels through `channels.list()`; it works against the service interface and is **accepted after 3b has merged** (until then it shows a visible refusal). Landing order: 3a, 3b, 3c, 3d.
- **4 after all three**: it touches every tab's results (the audit sentences, the keyboard pass, the both-size sweep) and the shared files they must not edit.
- A wave never starts on a partial predecessor; the coordinator accepts each (section 7) before the next cut.

## 3. The waves

| Wave | What | Worker | Doc | Depends on | Status | Landed in |
|---|---|---|---|---|---|---|
| 0 | backend changes (B1 to B6) | B | `29` 18, 19 | nothing | Done | `5749213`, `6432525`, `9045a8d` |
| 1 | shared library | U1 to U4 | `27` | Wave 0 not needed | Done | `d1aa570`, `51e2cec`, `6914728`, `4f21c11` |
| 2 | admin shell and record pieces | A | `28` | Wave 1 | Done (visual acceptance of the fixture pages is moot; superseded) | `4aca5f8` |
| 2a | auth gate and form | A2 | `34` | Wave 2 | Done | `487b934`, `a19845e` |
| F | foundation: library pieces, request layer, real auth, schemas, service stubs | A | this document | Wave 2a | Landing (merging `admin/channels` into `family-port`) | `6fcbeda`, `4386de2`, `07b60d7` |
| 3a | real sign-in finished and the Accounts tab | A | `35` | F | Not started | |
| 3b | Channels and the Preview window | A | `36` | 3a | Not started | |
| 3c | Providers and Titles | A | `37` | 3a | Not started | |
| 3d | Playlists and Jobs | A | `38` | 3a (and 3b for one acceptance row) | Not started | |
| 4 | sweep: account state, About, README, no-fixtures, accessibility, both sizes, build and serve | A | this document, section 6 | 3a to 3d | Not started | |

Retired by this program: `28` Waves 3 to 6 and `29` Waves 7 to 10 as written (their content is split across `35` to `38` and Wave 4).

## 4. File ownership per worker

Paths under `src/admin/src/` unless marked. A worker edits only its row; anything else it needs is reported and the coordinator decides.

| Worker | Owns (create and edit) |
|---|---|
| 3a | `store/session-slice.ts`, `store/audit-slice.ts`, `store/app-store.ts`, `store/selectors.ts`, `store/slices/*` (all six placeholders, the registry, `stale.ts`), `store/accounts-slice.ts`; `types/auth.ts`, `types/admin-account.ts`; `services/accounts.ts`, `audit.ts`, `account-flows.ts`, `account-password-flow.ts`, `schemas/account-schema.ts`, `schemas/audit-schema.ts`; `components/accounts/*`, `components/session/SessionState.tsx`, `components/records/StateWord.tsx`, `hooks/useRecordForm.ts`, `hooks/useAccountsLoad.ts`, `useAccountActions.ts`, `useAuditTail.ts`; `lib/account-*.ts`, `lib/audit-merge.ts`, `lib/format-when.ts`, `lib/event-sentence.ts`; `components/chrome/AppShell.tsx`, `AdminEventsDrawer.tsx`; `constants/account-*.ts`; `pages/AccountsPage.tsx`; `src/shared/http/src/api-error.ts`, `create-api.ts` |
| 3b | `store/channels-slice.ts`, `store/slices/channels.ts`; `services/channels.ts`, `channel-flows.ts`, `preview-player.ts`, `schemas/channel-schema.ts`; `components/channels/*`, `components/records/FolderRow.tsx`, `VideoList.tsx`; `components/overlays/OverlayHost.tsx`, `types/overlays.ts`; `hooks/useChannelsLoad.ts`, `useChannelActions.ts`, `usePreviewSession.ts`, `usePreviewPlayer.ts`; `lib/channel-*.ts`, `preview-*.ts`, `video-order.ts`; `constants/channel-*.ts`, `preview-copy.ts`; `pages/ChannelsPage.tsx` |
| 3c | `store/providers-slice.ts`, `titles-slice.ts`, `store/slices/providers.ts`, `titles.ts`; `services/providers.ts`, `titles.ts`, `provider-flows.ts`, `title-flows.ts`, `schemas/provider-schema.ts`, `title-schema.ts`; `components/providers/*`, `components/titles/*`, `components/records/SeasonList.tsx`; `hooks/useProviders*.ts`, `useTitle*.ts`; `lib/provider-*.ts`, `title-*.ts`, `season-edit.ts`; `constants/provider-*.ts`, `title-*.ts`; `pages/ProvidersPage.tsx`, `TitlesPage.tsx`; library: `src/shared/ui/src/controls/ChipsInput.tsx` and its test |
| 3d | `store/playlists-slice.ts`, `jobs-slice.ts`, `store/slices/playlists.ts`, `jobs.ts`; `services/playlists.ts`, `jobs.ts`, `playlist-flows.ts`, `job-flows.ts`, `job-run-queue.ts`, `schemas/playlist-schema.ts`, `job-schema.ts`; `components/playlists/*`, `components/jobs/*`; `hooks/usePlaylists*.ts`, `useJob*.ts`; `lib/playlist-*.ts`, `job-*.ts`; `constants/playlist-*.ts`, `job-*.ts`; `pages/PlaylistsPage.tsx`, `JobsPage.tsx` |
| 4 | `services/health.ts`, `account-state.ts`, `schemas/health-schema.ts`, `account-state-schema.ts`; `store/ui-state-slice.ts`; `hooks/useAccountHydration.ts`, `useShellWriteback.ts`, `useSettingsWriteback.ts`; `components/session/SessionState.tsx` (adds the hooks); `components/settings/*`; `lib/account-state-map.ts`; `lib/event-sentence.ts`; `README.md`; `vite.config.mts`; `src/shared/http` (the root-path option); `test/no-fixtures.test.ts`; any file for the a11y and keyboard pass |
| coordinator | root `package.json` (`dev`, `kill-ports`, `admin:build`), `scripts/**`, `AGENTS.md`, `docs/**`, every `.env`, the merges |

**Frozen after F** (nobody edits them in 3a to 3d; a need is reported): `services/session-api.ts`, `services/api.ts`, `services/auth-port.ts`, `services/service-types.ts`, `services/not-connected.ts`, `constants/api-sentences.ts`, `lib/field-checks.ts`, `lib/row-state.ts`, `lib/auth-errors.ts`, `constants/index-frames.ts`, `constants/record-copy.ts`, `store/workspace-slice.ts`, `store/work-slice.ts`, `store/panes-slice.ts`, `lib/running-work.ts`, `components/records/{ListGroup,NewRecordGroup,RecordRail,WorkspaceToolbar,IndexToolbar}.tsx`, `components/chrome/{AdminTitlebar,AdminStatusbar,WorkspaceFrame,TabPage}.tsx`, `src/shared/ui` except the named additive ones. A new error code's sentence is added to `api-sentences.ts` by the coordinator at merge.

## 5. The collision plan (shared files)

The shared surface of the app is the store and a few lists of constants. The plan removes it before the parallel waves start:

1. **One additive registry, built by 3a.** `store/slices/index.ts` is the only place `app-store.ts` reads tab state from: `export type TabSlices = ChannelsSlice & ProvidersSlice & TitlesSlice & PlaylistsSlice & JobsSlice & AccountsSlice` and
   `export function tabSlices(set, get): TabSlices`. 3a creates **six files**, `store/slices/{channels,providers,titles,playlists,jobs,accounts}.ts`, each exporting its slice type and factory. The five tabs not yet built are **placeholders**:
   an empty slice interface and a factory that returns `{}`. 3a writes the accounts one for real. `app-store.ts` spreads `tabSlices(set, get)` once. From then on each parallel worker replaces **only its own** `store/slices/<tab>.ts` (re-exporting its `store/<tab>-slice.ts`) and never opens `app-store.ts`, the registry or another tab's file. Result: no two workers edit the same line.
2. **One stale registry** (`store/slices/stale.ts`, 3a): `stale: Record<Tab, boolean>` and `markStale(tab)` / `clearStale(tab)`. A flow that changes another tab's data (deleting a playlist removes its jobs and detaches its channels) calls `markStale`; the other tab's load hook re-reads when it is next shown. No worker writes another tab's slice.
3. **Per-tab check files.** `lib/field-checks.ts` stays frozen; each tab puts its rules in `lib/<tab>-checks.ts` importing its primitives. Copy lives in `constants/<tab>-copy.ts`; the shared `record-copy.ts` is frozen.
4. **One owner per cross-cutting file:** `OverlayHost.tsx` and `types/overlays.ts` are 3b's (the `preview` flow); `ChipsInput.tsx` is 3c's; `AppShell.tsx`, `AdminEventsDrawer.tsx`, `event-sentence.ts` are 3a's, then 4's; `README.md`, `vite.config.mts`, `OverlayHost` bounds persistence are 4's.
5. **Tests:** a worker adds new files under `test/` and `test/support/`; it never edits another wave's test or a shared support file (`fake-backend.ts`, `store.ts`); a support need is a new file `test/support/<tab>-*.ts`.
6. **Services:** a worker may widen its own service interface additively (`run(id, override?)`, `detail`), never `service-types.ts`.
7. **Merging.** The coordinator merges in landing order (3a, 3b, 3c, 3d, 4). Every worker's branch is cut from the same `family-port` commit and never rebases. Expected conflicts: none. If git reports one, the coordinator resolves it only in a registry or test-support file, records it in the merge commit, and sends any conflict inside a worker's own files back to that worker with the exact output (`07` 6.5, step 4). After each merge the coordinator runs `node scripts/check/gate.mjs` before cutting or accepting the next.
8. **Backend and package files** are nobody's to touch inside a wave: no worker edits `src/backend`, root `package.json`, `scripts/**` or any `.env`.

## 6. Wave 4 - the sweep (one worker, after 3a to 3d)

Scope, in this order (one commit each):

1. **Account state** (`29` 12.2, the routes exist: Wave 0 B1): `services/account-state.ts` real, `services/schemas/account-state-schema.ts` (strict out, tolerant per part in), `lib/account-state-map.ts`, `store/ui-state-slice.ts`, `hooks/useAccountHydration.ts`, `useShellWriteback.ts`, `useSettingsWriteback.ts`, added to `SessionState`; the 1.5 s reveal fallback and the 400 ms shell debounce are the only two timers (`29` 12.2); the source-scan test names those two hook files. The window bounds `OverlayHost` already holds go through `rememberChild`.
2. **About and health** (`29` 12.1): `services/health.ts` real. `createApi` accepts only `/api/` paths, so `@giga/http` gains an additive `rootPaths` option (`["/healthz"]`) and `vite.config.mts` proxies `/healthz` (and `/admin` stays the backend's). About shows the app version (`__ADMIN_VERSION__`), the backend's version and revision, the address, `TMDB: configured / absent`, the runtime (`Electron` or `Browser`); unread facts draw shimmer lines.
3. **The Events drawer on the real audit log** is wired in 3a (`35` section 5.7); here the sweep checks every area's sentence against real entries from 3b to 3d (names from the held lists, `29` 11) and extends `lib/event-sentence.ts` for any action seen; `Clear` is on-screen only, the 200-row cap.
4. **README and the no-fixtures scan:** `src/admin/README.md` corrected; `test/no-fixtures.test.ts` (no `fixtures/` import, no `not_connected` service left, no `aria-disabled`, no placeholder, no storage, `setTimeout` only in the two named hooks, `fetch` only in `services/api.ts`).
5. **Accessibility and keyboard pass:** `Tab` order skips a closed pane; `Escape` closes the drawer then a window; `Ctrl+1` to `Ctrl+6`, `Ctrl+,`, `Ctrl+0`, `Ctrl+F` on Titles; every control labelled; every disabled control carries its reason; focus returns to the opener of every window; no horizontal page scroll at 900.
6. **Build and serve** (`29` 14): `npm run build --prefix src/admin` then the backend serves `/admin/` (a reload on a deep path opens the app; `assets/` immutable); the coordinator's root edits from `29` 22 (`dev`, `kill-ports` with 5172, `admin:build`, `ELECTRON_HOMES` for `src/backend/src/app/`, the docs listed there).

Exit: the six checks pass, a full pass of all six tabs at both sizes (section 7), the gate and the live smoke pass, `npm run dist:win` run (the installer holds the fileserver and the interface only; say so).

## 7. The coordinator's acceptance method (every wave)

**Automated.** After each merge: `node scripts/check/gate.mjs` (typecheck, lint, rule checker, every program's tests on free ports and temporary `DATA_DIR`s) must print `gate: PASS`.

**The real wire, on a temporary backend.** The coordinator starts a fresh backend per drive, never the owner's: `PORT` a free port (distinct per wave: 8391 for 3a, 8392 for 3b, 8393 for 3c, 8394 for 3d, 8395 for 4; never 8090, 8091, 8190, 8191, 3001, 5171, 5172, 5271, 5272, 9222, 9223), `DATA_DIR` an empty folder under `%TEMP%`, a throwaway `JWT_SECRET`, a **test bootstrap owner** (`ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`; the constants of `35` section 3.3), `ADMIN_DIST` the landed tree's `src/admin/dist` built with `npm run build --prefix src/admin`, the variables in the process environment and **no `--env-file`** (the owner's `src/backend/.env` is never loaded: `config.ts` reads `process.env` only and `DATA_DIR` otherwise defaults to the owner's `~\.giga-stream-admin`). It is launched detached through `Win32_Process.Create` (`07` 4) with the PID kept, checked (`GET /healthz`, `admin.db` in the temp folder, the owner's data folder's timestamps unchanged), and stopped by PID. Per wave, extra throwaways: the fixture videos of `scripts/fixtures` for 3b; the backend's local TMDB stub (`TMDB_BASE`) and no token for 3c; `ALLOW_LOOPBACK_STREAMS` with a throwaway static playlist server for 3d.

**Visual.** The real built admin in the connected Chrome (`http://127.0.0.1:<port>/admin/`) at **1600 x 1000** and **900 x 640**, dark and light, each touched surface compared with the interface's equivalent screen (the Collections window for the pattern, Settings for the window) and the mockup (`D:\Projects\giga-stream-poc\src\admin-mockup`, served only with the owner's say) for content; measured, not eyeballed: heights (titlebar 40, statusbar 24, toolbar 40, form row 36, grid row 36, drawer 160), one label column per page, the six New forms the same shape. A page-level recorder (a `fetch` wrapper in the page, outside the repository, never writing to the server) proves every `/api` request but login and refresh carries `Authorization`; `localStorage`, `sessionStorage`, cookies and IndexedDB are empty before and after; the console is clean. A skeleton wears no sentence; state is a word, never a dot; a control is wired or disabled with its reason.
**The Electron windows.** The backend's own window (debug port 9223) and the desktop app's (9222) are looked at on the owner's real stack for UI state only (the gate, the shell, `Choose` opening its dialog and being cancelled); nothing is written to the owner's data and no sign-in is attempted on the owner's backend. The caption strip follows a theme switch. A drive that must write (every create, save and delete) runs on the temporary backend, in Chrome.
**Cleanup.** Every `zz-drive-*` record is removed, the temp backend stopped by PID, its folder deleted, the owner's data confirmed untouched; the result and anything unverified are reported as they ran. After a wave the coordinator runs `npm run dist:win` and states that the admin and the backend are not in the installer (`07` 6.5).

## 8. The worker brief headings (every wave, `07` 6.2)

1. **Where** - worktree `D:\Projects\.giga-worktrees\<name>`, branch, base commit, owned paths (section 4), off limits. 2. **Rules** - `AGENTS.md`, `07`, `01`, the wave's doc, the owner's rules (no fixture, no fake feature, skeletons not sentences, no storage, no timers outside the two named, files at most 200 lines, never print a secret). 3. **Role** - what it does and does not do; writes AND runs its fast unit tests, the typecheck, the lint and `node scripts/check-rules.mjs`; starts no server or browser; edits no doc; commits on its branch, never pushes or merges. 4. **Read first** - the wave's doc and the sections it names, then the source files. 5. **Scope** - file by file; out of scope. 6. **Report** - `07` 6.4 plus every gap filled and every signature that differed.

| Wave | Worktree | Branch | Cut from |
|---|---|---|---|
| 3a | `admin-accounts` | `admin/accounts` | `family-port` after F |
| 3b | `admin-channels-tab` | `admin/channels-tab` | `family-port` after 3a |
| 3c | `admin-providers-titles` | `admin/providers-titles` | `family-port` after 3a |
| 3d | `admin-playlists-jobs` | `admin/playlists-jobs` | `family-port` after 3a |
| 4 | `admin-sweep` | `admin/sweep` | `family-port` after 3d |

## 9. Open decisions for the owner

| # | Decision | Default taken |
|---|---|---|
| 1 | Lists whose toolbar has no row-dependent verb (Accounts, Providers, Playlists) carry a tick column that only selects | keep, for parity with the mockup; drop the `selection` prop if it reads as a control that does nothing |
| 2 | A new live channel has no Id row; the id is derived from the name | derived, read-only in Details |
| 3 | A playlist's Name is required in the form (the backend defaults it to the host) | required, per `28` 7.3 |
| 4 | `07` 6.3 says a worker does not run the suite; this program has workers write AND run their fast tests | run them; amend `07` 6.3 |
| 5 | No password-reset path exists; a forgotten owner password has no in-app recovery | none planned; an offline tool would be its own plan |
| 6 | The stale `PORT=3001` line in `src/backend/.env` | the coordinator backs up and removes it (`35` 3.2) |
| 7 | `npm run dev` replaces the headless backend with the backend's Electron window (`29` 14) | replace, in Wave 4 |
| 8 | The sweep's account-state persistence comes last | last: it changes nothing a tab needs to be usable |

## 10. Doc against code: differences found (2026-10-17)

| # | Doc says | Code does |
|---|---|---|
| 1 | `27` and `28` list Wave 3 as "In progress (`admin/channels`)" with fixtures | the branch landed only the foundation (library pieces, helpers, request layer, services); no channel page, fixture or `StateWord` exists there |
| 2 | `28` progress table: Wave 2 created `useRecordForm`, `useFixtureLoad` | neither file exists in the tree |
| 3 | `29` 7: `services/api.ts` adapts `createApi` with a retry hook | built as `session-api.ts` (the logic, pure) plus `api.ts` (the store wiring); `createApi` has no retry hook and none was added |
| 4 | `01` 6: the store holds no promise and does no I/O | the foundation's `store/audit-slice.ts` awaits `audit.list` inside slice actions; `35` moves that into a hook |
| 5 | `34` 5: the gate maps four codes | `lib/auth-errors.ts` maps any other 4xx to `invalid` and any 5xx or unreadable answer to `unreachable` |
| 6 | `07` 6.3: workers do not run tests | this program asks them to (decision 4) |
| 7 | `29` 14 and 22: the `npm run dev` stack change and the check-rules edit are "when this lands" | not applied; they are the coordinator's, in Wave 4 |
| 8 | `37`/`38`: the foundation's `RecordService` types every `update` as a PATCH-like call | providers save by `PUT`; jobs and playlists widen `run` and `remove` additively |
