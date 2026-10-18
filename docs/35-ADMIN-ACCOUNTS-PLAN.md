# 35 - Admin accounts plan (Wave 3a: real sign-in finished and the Accounts tab)

**Status: plan, revised 2026-10-17 after the foundation (`admin/channels`: `6fcbeda`, `4386de2`, `07b60d7`) put the request layer, the real auth port and the
service modules in place; branch `admin/accounts`, cut from `family-port` once the foundation has merged.** Owner, 2026-10-17: "let's do the accounts next wave so I can
create an account", and no fixture waves (`39`). This wave finishes what the foundation left of the real session, wires the audit log into the Events drawer, builds the
shared record pieces and the per-tab registries every later tab needs, and builds the Accounts tab end to end on real data, so the owner can sign in with their existing
account and create another. It takes Wave 5's Accounts part (`28`), Wave 7's remaining session and audit part and Wave 10's Accounts part (`29`); `39` holds the program.
It follows `07` section 6 and is governed by `00`, `01`, `07`, `26` (D5 memory-only tokens, D22 no roles), `28`, `29`, `34`.

## 0. What the foundation already built (verified in source on `admin/channels`)

| Built | Where |
|---|---|
| The request layer: the bearer from the in-memory tokens, a refresh before the access token runs out (30 s skew), one shared refresh promise, one retry after a 401, the session ended when a refresh fails | `services/session-api.ts` (pure), `services/api.ts` (the store wiring, the only caller of `fetch`) |
| The real auth port (`POST /api/auth/login`, `/logout`), the gate's refusal kinds | `services/auth-port.ts`, `services/auth.ts`, `lib/auth-errors.ts` |
| The tokens in the session slice, `adoptTokens`, `endSession`, `signOut`; the app always starts signed out | `store/session-slice.ts`, `types/auth.ts` |
| Every error sentence of `29` section 7 | `constants/api-sentences.ts` (`ERROR_SENTENCES`, `FAILURE_CODES`, `REFRESH_SKEW_MS`) |
| Zod for every resource | `services/schemas/*` (session, account, audit, channel, provider, title, playlist, job, health, account-state) |
| `services/accounts.ts`: **real** (`GET`, `POST`, `PATCH`, `DELETE /api/admin-accounts`) | `services/accounts.ts` |
| The other services as typed stubs that refuse with `backend.not_connected` | `channels`, `providers`, `titles`, `playlists`, `jobs`, `audit`, `account-state`, `health` |
| The audit slice (`loadAudit`, `loadOlder`, `olderCursor`) over the `audit` stub | `store/audit-slice.ts` |
| Tests: the request layer and the session (`api.test.ts`, `auth-session.test.ts`), the services' shape (`services-shape.test.ts`), `test/support/fake-backend.ts` | `src/admin/test` |
| The fixtures, the fixture sign-in and the `?signedin=0` switch are gone | |

So this wave does **not** build a request layer, an auth port, schemas, sentences or the refresh. What is left of the session is below (section 5.2).

## 1. Decisions

| # | Decision |
|---|---|
| 1 | One worker (A), one worktree, five commits in the order of section 2. No backend change (section 8); one additive change in `src/shared/http` (`ApiError.field`, 5.1). |
| 2 | Tokens stay in the session slice, in memory only (`26` D5). A reload signs in again. Nothing is written to the browser. |
| 3 | A failed call is said once by the hook that made it, with the `ApiError` sentence on the notice line (`warn`; the chrome slice's `say` also writes the drawer row for `warn` and `error`). A success is a notice only; the audit row is the record. `onEvent` stays unused (a finished request carries no sentence). |
| 4 | The gate's refusal kinds are the foundation's `refusalFor` (`invalid` for a wrong pair and any other 4xx, `locked`, `rate_limited`, `unreachable` for transport, unreadable and 5xx answers). A session that ends under the app always shows `34`'s notice `Your session ended. Sign in again.`; the refresh failure's own sentence is not shown. |
| 5 | Own-account effects end the session locally with a notice: a new password for yourself (`Password changed. Sign in again.`), disabling or deleting yourself (`Your account was disabled.` / `Your account was deleted.`). Changing your own email or name updates the signed-in actor and nothing else. The signed-in actor gains its **account id** (the foundation's `SessionActor` has only email and name, and an email can change). |
| 6 | A password change of any account goes through `PATCH /api/admin-accounts/:id { password }`, never `POST /api/auth/password`: the Password group has only `New password` (`28` 7.3) and the PATCH needs no current password. Both revoke the account's sessions. |
| 7 | **Ticks arm bulk verbs** (owner, 2026-10-17: "add some bulk actions when we select them"; this supersedes the earlier "ticks only select" default). The Accounts toolbar offers `Enable`, `Disable` and `Delete` on the ticked rows (5.10), through the shared bulk piece this wave builds for every tab (`39` section 6). |
| 8 | The Events drawer reads `GET /api/audit`: the `audit` service is wired, and the I/O the foundation put inside `store/audit-slice.ts` moves into a hook (`01` section 6: the store holds no promise and does no I/O). |
| 9 | The Accounts workspace opens from the list already held (no `GET /:id`, `29` section 8). The list `Refresh` re-reads the accounts and the audit tail together. |
| 10 | This wave builds what every later tab shares: `StateWord`, `useRecordForm`, the per-tab slice registry and the stale registry (section 5.6), so the parallel waves of `39` never edit the same file. |
| 11 | Verification runs on a temporary backend that serves the built admin on its own free port, with a temporary `DATA_DIR`; the owner's backend, database and `.env` are never read or written by it (section 3). |

| 12 | **Name comes first on every form** (owner, 2026-10-17): New account is `Name`, `Email`, `Password`; Details is `Name`, `Email`, `Enabled`, `Last sign-in`. This is a program rule (`39` section 5). |
| 13 | **A generated id number** (owner, second round: "I said a few responses back we should be generating ids"). Every account shows its backend-generated integer `idNumber` from the accounts sequence (migration `018`, Wave B2 of `39` section 7.1) as the list column `id` and the read-only `Id` row in Details. The number is **never derived and never reused**; the string id `acct_<uuid>` stays the key everywhere. **3a's Id column lands after B2**: 3a is cut only after B2 has merged, so the column and row never show a placeholder. |
| 14 | **Security question (`40`).** Accounts gain a read-only Details fact `Security question` (`Set` or `Not set`, from the answer's `securityQuestionSet`), placed after `Last sign-in` and before `Id`. The question itself is set by the account's own owner in Settings > Account (R, `40` 4.2), not in this Accounts workspace; no admin sets another account's question. |

## 2. Scope, in order (six commits)

1. **Shared request layer.** `src/shared/http` `ApiError` carries `field` and `correlationId` from `error.details` (5.1).
2. **The session finished.** The actor's id, the sign-in serial, the resets (5.2); the slice registry and the stale registry (5.6); `StateWord` and `useRecordForm` (5.7).
3. **Audit tail.** `services/audit.ts` wired, the audit slice made pure, `useAuditTail`, `lib/audit-merge.ts`, the drawer, `lib/event-sentence.ts` taught the account actions (5.5).
4. **Accounts data.** The accounts list tolerant per row, `store/accounts-slice.ts`, the pure libs, `services/account-flows.ts` and `account-password-flow.ts`, the hooks.
5. **The bulk piece** every tab uses (`39` section 6): `lib/bulk-plan.ts`, `lib/bulk-run.ts`, `hooks/useBulkAction.ts`, `components/records/BulkReport.tsx`, the toolbar's armed (two-step) verb in `ToolbarStrip`, `IndexToolbar` taking bulk verbs, the work slice's `working` count and the statusbar's `N working`.
6. **Accounts UI.** `components/accounts/*`, `pages/AccountsPage.tsx`, the Session section, the Accounts bulk verbs (5.10).

## 3. The first sign-in, the temporary backend, and the owner's checklist

### 3.1 How the first account exists

The backend creates the first account itself: at start, with **no accounts** and both `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` set, it creates one named `Admin`
(`services/bootstrap-admin.ts`, `03` 7.11); with accounts present it ignores both, so changing them later changes nothing; with neither set it starts and logs that nobody can sign in.
`JWT_SECRET` (32 characters or more) is required to start. The owner's `src/backend/.env` already carries these three names; **the plan and the worker never read, print or copy their values**.
The owner signs in with the email and password they set there. There is no password-reset route and none is added; a forgotten owner password is the owner's decision (`39` open decision 5).

### 3.2 The dev port line (a fix this wave carries, `AGENTS.md` "fix the obvious bug")

The admin's Vite forwards `/api` to `ADMIN_BACKEND_URL`, default `http://127.0.0.1:8091`, while the owner's local `src/backend/.env` sets `PORT=3001` (stale, `29` section 3 item 7). With real
sign-in the mismatch is visible: every sign-in fails as unreachable. Before the visual acceptance the coordinator reads **only the `PORT` line** of `src/backend/.env` (by line range, never the file),
backs the file up, and removes that line if it is `3001` (the code default is 8091). If the owner wants 3001 kept, `ADMIN_BACKEND_URL` goes in `src/admin/.env` instead. Either way one anonymous
`GET http://127.0.0.1:5172/api/auth/me` must answer `401 auth.unauthorized` as an envelope (not Vite's page): the proof the proxy reaches a live backend; it writes nothing.

### 3.3 Verifying on a temporary backend (coordinator, never the owner's data)

`DATA_DIR` defaults to `~/.giga-stream-admin`, which is the owner's real database, so the variable is always set explicitly and checked. Test-only constants (a throwaway database deleted afterwards):

| Variable | Value |
|---|---|
| `PORT` | `8391` (a free port; never 8090, 8091, 8190, 8191, 3001, 5171, 5172, 5271, 5272, 9222, 9223) |
| `DATA_DIR` | `%TEMP%\giga-accounts-verify` (created empty for the run) |
| `JWT_SECRET` | `zz-verify-secret-not-real-0123456789abcdef` |
| `ADMIN_BOOTSTRAP_EMAIL` | `zz-owner@example.test` (the account is named `Admin`) |
| `ADMIN_BOOTSTRAP_PASSWORD` | `zz-verify-owner-password-1` |
| `ADMIN_DIST` | the landed tree's `src/admin/dist`, built with `npm run build --prefix src/admin` |

Start it from `src/backend` with the variables in the **process environment** and without any `--env-file` (`node src/build-shared.ts && npx tsx src/server.ts`; `config.ts` reads `process.env` only), detached
through `Win32_Process.Create` as `07` section 4 shows, keeping the PID. Do not use `npm run dev` in `src/backend`: it loads `.env`. Then check, before any browser: `GET /healthz` answers `role: "admin-backend"`;
`Test-Path $env:TEMP\giga-accounts-verify\admin.db` is true; the owner's `~\.giga-stream-admin` has no new or modified file (timestamps before and after). The admin is served by that backend at
`http://127.0.0.1:8391/admin/` (same origin, no Vite, no collision with the owner's 5172). Stop it by PID at the end and delete the temporary folder. The generalised recipe is `39` section 9.

### 3.4 The owner's checklist (the real app, once this has landed)

1. Start the stack as usual (`npm run dev`); open the admin in its backend window or at `http://127.0.0.1:5172/admin/`.
2. Sign in with the existing account's email and password. A wrong try shows `The email or password is wrong.`; five wrong ones lock that account for 15 minutes, so do not guess.
3. Press `Ctrl+6` (Accounts). The list shows your own row, state `enabled`, last sign-in a time; its `Delete` is disabled (the last enabled account).
4. Under **New account** type the new person's name, email and a password of at least 12 characters (in that order); `Create` is disabled with `Name is required.` and its siblings until all three are filled. Press `Create`.
5. The row appears; the notice says `Created <email>.`; the Events drawer (statusbar `Events`) shows `<you> created account <email>`.
6. Optional: open a second admin window, sign in as the new account, and see it in the same list. To give someone a new password later: open the row, `New password`, `Set new password` (it signs that account out everywhere).

## 4. Dependencies and ordering

### 4.1 Order

`39` section 2: F lands and **B2 (the generated ids, migration `018`) merges**, then 3a alone, then 3b, 3c and 3d in parallel. 3a is cut only after B2, because its Id column is the generated number. 3a starts from `family-port` after the foundation has merged; it needs nothing from the Channels page work (the earlier "Wave 3" that planned it
is retired: Channels is `36`). 3a lands first because it builds the shared pieces (decision 10); the parallel waves are cut from its result and inherit the real gate: a tab can be looked at only while signed in, so
every drive needs a backend (section 3.3).

### 4.2 What it consumes (all in the foundation commit `6fcbeda` and Wave 2)

| File | Used for |
|---|---|
| `src/shared/ui/src/lists/RecordGrid.tsx` (`RecordGrid`, `GridHeading`, `GridSelection`), `RecordGridRow.tsx`, `SkeletonGrid.tsx`, `record-grid-layout.ts` (`GridLayout`) | the Accounts list with its select-all tick |
| `src/shared/ui/src/controls/Checkbox.tsx` | the ticks (through the grid) |
| Wave 2: `ListGroup`, `NewRecordGroup`, `WorkspaceFrame`, `RecordRail`, `WorkspaceToolbar`, `IndexToolbar`, `TabPage`, `lib/row-state.ts` (`enabledState`), `lib/field-checks.ts`, `LAST_ACCOUNT` in `constants/record-copy.ts`, the library's `ArmedButton`, `Toggle`, `Input`, `Row`, `Group`, `Tooltip` | the page |
| Foundation: `services/accounts.ts`, `services/schemas/account-schema.ts`, `services/api.ts`, `constants/api-sentences.ts`, `test/support/fake-backend.ts` | the data |

`StateWord` and `useRecordForm` are **not** in the tree (the `28` progress table lists `useRecordForm` as a Wave 2 file; it never existed): this wave builds them (5.7).

### 4.3 What stays not connected

`channels`, `providers`, `titles`, `playlists`, `jobs`, `account-state` and `health` stay as the foundation's refusing stubs until their waves (`36` to `38`, Wave 4 of `39`); their pages stay the index skeletons.
Settings > About shows dashes (no health), and appearance, tab, panes and bounds stay in memory at the defaults. `GET /healthz`, `GET /api/auth/me` and `/api/auth/me/state` are not called this wave.

### 4.4 How the shell behaves

`AppShell` mounts no page while signed out; after sign-in the six pages mount as today. Pages whose service is a stub keep their skeleton and, if they ever call it, show the typed refusal: a visible refusal, never an
invented row. On sign-out or a session ending, the slice's reset returns the tab, workspaces, overlay, events, audit and accounts to the start (5.2). (The foundation branch still draws the sign-in page inside the
chrome; the merge with `family-port`'s full-window wall of `34` section 4 is the coordinator's, and the gate-cover tests are the guard.)

### 4.5 What this absorbs, and the table edits the coordinator makes

| Wave | Taken by this wave | Left |
|---|---|---|
| `28` Wave 5 | the Accounts tab (built on real data) | Playlists and Jobs: now `38` |
| `29` Wave 7 | the actor id and serial, the audit service and slice, `SessionState.tsx` (empty of hydration) | Wave 4 of `39`: account state, health and About, the hooks added to `SessionState` |
| `29` Wave 10 | the Accounts service use, slice, pages, own-password flow | the sweep: Wave 4 of `39` |

The coordinator makes the table edits when this lands: `39` section 3 (status and commit) and the progress tables of `27`, `28` and `29` (already pointing to `39`); `34` section 5's note; `AGENTS.md` and `07` need nothing.

## 5. Design

### 5.1 `@giga/http`

`ApiError` gains `readonly field?: string` and `readonly correlationId?: string`; its constructor takes an optional fourth argument `{ field?, correlationId? }`. `createApi`'s `refused()` and `refusal()`
pass `details.field` when it is a string and `correlationId` when present. Additive: `src/frontend/src/services/desktop.ts` builds an `ApiError` with three arguments and is untouched. The server's sentence still wins over the
program's table (`errorSentence`), so `constants/api-sentences.ts` is the fallback and the text for the layer's own codes.

### 5.2 The session finished (`types/auth.ts`, `store/session-slice.ts`, `services/auth-port.ts`)

- `SessionActor` gains `id: string | number` (the account id as the backend gives it); `createAuthPort` fills it from `session.account.id`. The own-account tests compare ids, never emails.
- The slice gains `serial: number`, raised at every sign-in (`finishSignIn`), and `updateActor(account)`. `signedOut()` also resets the accounts registry slice (`store/slices/accounts.ts`), the audit state and the stale registry. The foundation's `adoptTokens` and `endSession` are kept.
- A late answer from an earlier session is recognised by its recorded `serial` and dropped (every flow and load, 5.4). Tokens are never copied into a notice, an event row, a URL or the console.
- Nothing else changes: `services/session-api.ts`, `services/api.ts`, `lib/auth-errors.ts` and the sentences are frozen (`39` section 4).

### 5.3 Accounts data

`services/accounts.ts` is real. This wave tightens it: the list is parsed row by row (`z.array(z.unknown())`, each row `AccountSchema.safeParse`), an unreadable row is counted and dropped, `01` section 8 (`AccountListLenientSchema`
in `schemas/account-schema.ts`); the create body is built by `lib/account-body.ts` (trimmed email and name, the password untouched); a malformed write answer is `backend.bad_response` and the hook re-reads the list.

`store/accounts-slice.ts` (registered by `store/slices/accounts.ts`): `accounts: { status: "idle" | "loading" | "ready" | "failed"; items: AdminAccount[]; unreachable: boolean; ticked: (string | number)[] }` and actions `startLoad`,
`loaded(items)`, `loadFailed(unreachable)`, `upsert(account)` (kept sorted by lower-cased email, as the backend does), `remove(id)`, `tick(id, on)`, `tickAll(on)`, `markUnreachable(bool)`. `unreachable` is set by a transport failure and
cleared by the next successful read; while set, every write is disabled with `The admin backend cannot be reached.` (`29` section 8).

### 5.4 Flows (`services/account-flows.ts`, `services/account-password-flow.ts`)

`createAccountFlows(deps)` holds the orchestration the hooks call, with the store and the services injected so the tests drive it with fakes. Each flow records `serial` before it awaits and writes only if it is unchanged after.
Results are typed (`{ ok: true } | { ok: false; field?; sentence }`) so the form puts a field-named refusal under its row (`ApiError.field`: `email`, `name`, `password`; any other field is notice-only).

| Flow | Route | On success | On failure |
|---|---|---|---|
| create | `POST /api/admin-accounts` | `upsert`; the form clears; notice `Created <email>.`; reload the audit tail (`limit=10`) | `account.email_taken` under Email; `account.invalid` under its field; else a `warn` notice; the form keeps its values |
| save | `PATCH` the changed fields | `upsert`; baseline = the answer; notice `Saved <email>.`; own account: `updateActor`; own `disabled: true`: end the session with `Your account was disabled.`; audit tail | `account.last_admin` under Enabled; `email_taken` under Email; `account.not_found` closes the workspace with a `warn` notice and re-reads the list |
| setPassword | `PATCH { password }` | other account: notice `Password set; <email> is signed out everywhere.`, field cleared; own account: end the session with `Password changed. Sign in again.` (no logout call: the token is already dead) | under `New password`; the field is not cleared |
| remove | `DELETE` | `remove`; notice `Deleted <email>.`; own account: end the session with `Your account was deleted.`; audit tail | `account.last_admin`: the row stays, the notice says why; `account.not_found`: the row is removed (it is already gone) and the list re-read |
| refresh | `GET` the list and `GET /api/audit?limit=50`, together | `loaded`; unreadable rows: one `warn` notice `N accounts could not be read.` | keeps the last items, `loadFailed`, one `warn` notice |

A password is never put in a notice, an event row, the store or an error: the field's value is read from the form at press time, sent, and the form state cleared on success.

### 5.5 The Events drawer from the audit log

`services/audit.ts` is wired: `list({ limit?, before? })` -> `GET /api/audit?limit=&before=`, parsed entry by entry (`AuditEntrySchema`; an unreadable entry is counted and dropped). `lib/audit-merge.ts` is pure: it converts entries with
`eventFromAudit` (names: the held accounts as id -> email), reverses the newest-first page, merges into the held rows by id (an audit row has the id `audit-<id>`; a local `say`/`logEvent` row keeps its own), keeps time order and
the 200-row cap. `store/audit-slice.ts` keeps `events` and `olderCursor` but loses its async actions: it gains pure setters (`takeAudit(rows, nextBefore, mode)`), and `hooks/useAuditTail.ts` (`{ reload, loadOlder }`) awaits the service and calls them.
`reload` sets the cursor only if none was read; `Load older` always sets it and passes `before=<smallest audit id held>`; it is available only when a cursor exists. `components/session/SessionState.tsx` (renders nothing, mounted by `AppShell` only
while signed in, `key` = the session `serial`) calls `reload` on mount (replacing `useSignIn`'s `loadAudit` call); `AdminEventsDrawer` uses `loadOlder`. `lib/event-sentence.ts` changes for the Account area: the name is `detail.email` (the backend writes it
on `account.created` and `account.deleted`), else the held email for the subject id, else `detail.name`, else the id; no field named `password` is ever read. A refusal is one `warn` notice and changes nothing else.

### 5.6 The registries every later tab shares (`store/slices/`)

`store/slices/index.ts` exports `TabSlices` and `tabSlices(set, get)`, the only place `store/app-store.ts` reads tab state from. Six files, `store/slices/{channels,providers,titles,playlists,jobs,accounts}.ts`, each export a slice type and a factory:
`accounts` is real here; the other five are **placeholders** (an empty interface and a factory returning `{}`) that their waves replace. `store/slices/stale.ts` holds `stale: Record<Tab, boolean>`, `markStale(tab)`, `clearStale(tab)`, reset on sign-out. `app-store.ts`
spreads `tabSlices(set, get)` and the stale slice once. `39` section 5 explains why.

### 5.7 The shared record pieces

`components/records/StateWord.tsx` (at most 30 lines): the word of a `RowState` (`lib/row-state.ts`) in its tone colour (`done`, `loading`, `failed`, `faint`, `accent`), `data-st` on the cell, a word and never a dot. `hooks/useRecordForm.ts` (at most 90 lines):
`useRecordForm<D>({ initial, same })` -> `{ draft, set, dirty, discard, reset(next), errors, setError, clearErrors }`; `dirty` is a fact about values (`!same(draft, baseline)`), `reset(next)` takes a saved record's draft as the new baseline, `setError(field, sentence)`
puts a refusal under its row. Both are consumed unchanged by every tab; their signatures are frozen after this wave.

### 5.8 The Accounts UI (`components/accounts/*`)

`AccountsPage` is the only reader of `workspaces.accounts`: null shows `AccountsIndex`, an id shows `AccountWorkspace`. `useAccountsLoad(active)` loads when the tab is first shown after sign-in (status `idle`) or after `stale.accounts`, and not otherwise.

- **AccountsIndex** (60): `IndexToolbar` (empty strip, Accounts is the last tab), `NewAccountForm`, `AccountsList`.
- **NewAccountForm** (110): `NewRecordGroup` (`user-plus`, `New account`), rows in this order and no others: `Name`, `Email` (`type=email`, `autoComplete="off"`), `Password` (`type=password`, `autoComplete="new-password"`). No role, no info glyph on
  these three (`26` 4.4). `Create` is disabled with `Name is required.`, then `Email is required.`, then `Password is required.`, then `Saving.` while a call runs, or the unreachable sentence. Pressing it runs the value checks first (5.9); a refusal shows under its row with `aria-invalid`.
- **AccountsList** (60): `ListGroup` (`users`, `Accounts`) with a ghost `Refresh` in the heading slot (`refresh-cw`); `SkeletonGrid` while `idle` or `loading` or with no items (never a sentence over it, never an empty card); a failed read keeps the last rows and sets one notice.
- **AccountRows / AccountRow** (110 / 70): `RecordGrid` with headings `id`, `name`, `email`, `state`, `last sign-in` (`id` is `idNumber`, mono), the select-all tick (`Select all accounts`, `mixed` over a part), rows through `RecordGridRow` with `StateWord` (`enabled` / `disabled`, a disabled row dimmed),
  the time in mono as `YYYY-MM-DD HH:mm` local (`never` if absent), tick label `Select <email>`, a press opens the workspace, the end is an `ArmedButton` `Delete`, question `Delete <email>?`; disabled with `The last enabled account cannot be deleted.` for the last
  enabled account (computed from the list by `lib/account-guard.ts`), at rest titled `Deletes the account and ends its sessions.`; also disabled with the unreachable sentence or while the call runs. The column set is `constants/account-grid.ts` (tracks in rem; the end track fits `Delete someone@example.test?`).
- **AccountWorkspace** (90): `WorkspaceFrame` (tab `accounts`), `RecordRail` (`‹ Accounts`, `Details`, `Password`, the key list a module constant), `WorkspaceToolbar` with `Discard changes` and `Save` only. Opens from the held list; if the account is no longer in a `ready` list it closes with a notice.
- **AccountDetailsGroup** (90): `Group` `Details` (`user`): `Name`, `Email`, `Enabled` (`Toggle`, the inverse of `disabled`, tip `A disabled account cannot sign in.`), then the read-only facts `Last sign-in`, `Security question` (`Set` / `Not set`, `40`) and `Id` (the generated `idNumber`, last). `Enabled` is disabled with `The last enabled account cannot be disabled.` while this is the last enabled account.
  One `Save` per page sends only the changed fields of `email`, `name`, `disabled`.
- **AccountPasswordGroup** (70): `Group` `Password` (`key-round`): `New password` (`type=password`, `autoComplete="new-password"`) and a ghost `Set new password` inside the library `Tooltip` with `Signs this account out everywhere`; disabled with `Type a new password.` or the length
  refusal until valid. It is its own verb and is not part of `Save`.
- **Session section**: unchanged; `Sign out` still returns to the gate.

### 5.9 Field checks (`lib/account-checks.ts`, with `constants/account-limits.ts` mirroring `03` 7.11)

`lib/field-checks.ts` is frozen; the account rules live in `lib/account-checks.ts` using its primitives: `emailAddress` (`name@host.tld`, at most 254), `nameLength` (1 to 80 after trim), `passwordLength` (12 to 256, never trimmed). Sentences: `Email must look like name@example.com.`, `Name must be 1 to 80 characters.`,
`Password must be at least 12 characters.`. The backend's own sentence for a bad field (`The password is not valid.`) is only the fallback.

### 5.10 Bulk actions on the ticked accounts (the mechanism is `39` section 6)

The toolbar strip carries, left of nothing else (Accounts has no forward verb), the ghost verbs **`Enable`**, **`Disable`** and **`Delete`** (two-step: the first press turns the label into `Delete N accounts?`, the second within 4 s runs it; blur or `Escape` disarms).
They are always drawn and disabled with `Tick a row first` until a row is ticked. Each runs the single-record call on every eligible ticked row through `useBulkAction`: `Enable` and `Disable` are `PATCH { disabled }`, `Delete` is `DELETE`. `lib/account-bulk.ts` (pure) decides eligibility:

| Verb | Skipped, with its reason | Verb disabled (reason) when |
|---|---|---|
| `Enable` | an account already enabled: `Already enabled.` | every ticked account is already enabled: `Every ticked account is already enabled.` |
| `Disable` | an already disabled account: `Already disabled.`; the signed-in account: `You cannot disable the account you are signed in with.`; any account whose disabling would leave no enabled account (the plan keeps at least one enabled, taking the rows in list order): `The last enabled account cannot be disabled.` | nothing is left to run: the first skipped reason |
| `Delete` | the signed-in account: `You cannot delete the account you are signed in with.`; any account whose deletion would leave no enabled account: `The last enabled account cannot be deleted.` | nothing is left to run: the first skipped reason |

The signed-in account is recognised by `actor.id`. The backend's own `409 account.last_admin` and `404 account.not_found` are still handled per row as failures (a stale list). `Disable` on others revokes their sessions; the summary says so (`Disabled 2 of 3 accounts; they are signed out everywhere.`).
The skipped and failed rows are listed under the toolbar by `BulkReport` with each sentence; the list is re-read once at the end; succeeded rows are unticked, failed and skipped rows stay ticked. A single-row action in the workspace is unchanged.

## 6. Files

Paths under `src/admin/src/` unless marked. "C" create, "U" update, "D" delete. Bounds are expected sizes (limit 200; tests 250).

| Act | File | Responsibility |
|---|---|---|
| U | `src/shared/http/src/api-error.ts`, `create-api.ts`; `src/shared/http/test/create-api.test.ts` | `field`, `correlationId` (5.1); three new tests |
| U | `types/auth.ts` (50) | `SessionActor.id` |
| U | `services/auth-port.ts` | fills the actor id |
| U | `store/session-slice.ts`, `store/audit-slice.ts`, `store/app-store.ts`, `store/selectors.ts` | 5.2, 5.5, 5.6 |
| C | `store/slices/index.ts`, `slices/{channels,providers,titles,playlists,jobs}.ts` (placeholders), `slices/accounts.ts`, `slices/stale.ts` | 5.6 |
| C | `store/accounts-slice.ts` (100) | 5.3 |
| C | `types/admin-account.ts` (20) | the backend's `AdminAccount` (re-exporting the schema type) |
| U | `services/accounts.ts`, `services/schemas/account-schema.ts`, `services/audit.ts`, `services/schemas/audit-schema.ts` | tolerant list; the audit wired |
| C | `services/account-flows.ts` (170), `services/account-password-flow.ts` (60) | 5.4 |
| C | `lib/account-guard.ts` (45), `lib/account-draft.ts` (60), `lib/account-rows.ts` (60), `lib/account-body.ts` (25), `lib/account-checks.ts` (40), `lib/format-when.ts` (20), `lib/audit-merge.ts` (60) | pure |
| U | `lib/event-sentence.ts` | 5.5 |
| C | `constants/account-copy.ts` (70), `account-grid.ts` (20), `account-limits.ts` (12) | labels, tips, notices; the grid; limits |
| C | `hooks/useAccountsLoad.ts` (40), `useAccountActions.ts` (70), `useAuditTail.ts` (50), `useRecordForm.ts` (90) | hooks |
| U | `hooks/useSignIn.ts` | drops the `loadAudit` call |
| C | `components/records/StateWord.tsx` (30), `components/session/SessionState.tsx` (25) | 5.7, 5.5 |
| C | `lib/bulk-plan.ts`, `lib/bulk-run.ts`, `hooks/useBulkAction.ts`, `components/records/BulkReport.tsx` | the shared bulk piece (`39` section 6) |
| U | `src/shared/ui/src/shell/ToolbarStrip.tsx` (+ test), `components/records/IndexToolbar.tsx`, `lib/index-verbs.ts`, `store/work-slice.ts`, `lib/running-work.ts` | the armed (two-step) toolbar verb; bulk verbs beside the forward verb; `working` count and `N working` |
| C | `lib/account-bulk.ts` (70) | 5.10 |
| C | `components/accounts/AccountsIndex.tsx`, `NewAccountForm.tsx`, `AccountsList.tsx`, `AccountRows.tsx`, `AccountRow.tsx`, `AccountWorkspace.tsx`, `AccountDetailsGroup.tsx`, `AccountPasswordGroup.tsx` | 5.8 |
| U | `pages/AccountsPage.tsx`, `components/chrome/AppShell.tsx` (mounts `SessionState`), `components/chrome/AdminEventsDrawer.tsx`, `components/settings/SessionSection.tsx` | |
| U | `README.md` | the `?signedin=0` line is gone; sign-in is real |

No file under `src/shared/ui` changes. Nothing under `src/backend`. Deleted by the foundation already: `fixtures/*`, `constants/fixture-switches.ts`, `test/auth-port.test.ts`.

## 7. Tests (`node:test`, fast, injected fetch and fakes; the worker writes them AND runs them)

The worker runs its own tests this wave (owner's instruction; `39` open decision 4): `npm test` in `src/admin` and `src/shared/http`, with `typecheck`, `lint` and `node scripts/check-rules.mjs`. None starts a server, opens a browser or sleeps.
The request layer and the session already have their tests (`api.test.ts`, `auth-session.test.ts`); they are updated only where the actor id changes them.

| File | Cases |
|---|---|
| `shared/http/test/create-api.test.ts` | a refusal carries `details.field`; no `details` leaves `field` undefined; a non-string `field` is ignored |
| `session-slice.test.ts` (updated) | sign-in stores tokens, the actor with its id and a raised serial; `updateActor`; `endSession` leaves the notice and clears tokens, accounts, audit, events, stale; `signOut` likewise with nothing said; a second `beginSignIn` while submitting changes nothing |
| `accounts-service.test.ts` | the list route and an unreadable row dropped and counted; create body trims email and name and leaves the password; update sends only the given fields; delete route; a malformed answer is `backend.bad_response`; `409` and `422` carry their `field` |
| `accounts-slice.test.ts` | the status transitions; `upsert` keeps case-insensitive email order and replaces by id; `remove`; select-all `mixed`; ticks pruned when a row goes; reset on sign-out; `unreachable` set and cleared |
| `slices-registry.test.ts` | `tabSlices` returns all six slices' state; a placeholder adds no keys; `markStale`/`clearStale`; reset on sign-out |
| `account-guard.test.ts` | the last enabled account: Delete and disabling refused with their reasons; two enabled: both allowed; a disabled account is always deletable |
| `account-draft.test.ts`, `account-checks.test.ts`, `account-body.test.ts`, `format-when.test.ts` | dirty; only changed fields; discard; `Enabled` is the inverse of `disabled`; required reasons in order; email shape; name 1 to 80; password 11 refused, 12 and 256 accepted, 257 refused, whitespace kept; the time as `YYYY-MM-DD HH:mm` built from local parts |
| `record-form.test.ts` | `useRecordForm` logic through its pure core: dirty by value, typing a value back is clean, `reset` rebases, field errors set and cleared |
| `account-flows.test.ts` | the table of 5.4 row by row: create success and clear; `email_taken` under Email; save own email updates the actor; save own `disabled` ends the session; other account's password notice and cleared field; own password ends the session with `Password changed. Sign in again.`; delete other; delete own; `last_admin` keeps the row; a changed `serial` drops the answer; a transport failure sets `unreachable`; **no notice, event, state or error contains the password** |
| `audit-tail.test.ts` | per-entry validation; newest at the foot; de-dup by id; the 200 cap; local rows survive and interleave by time; the cursor rules and `before` = the smallest held id; `Load older` unavailable without a cursor; the store has no async action; account sentences use the email |
| `event-sentence.test.ts` (updated) | `account.created` and `deleted` name the email, `updated` the held email or the name; inline entries |
| `bulk-plan.test.ts`, `bulk-run.test.ts`, `bulk-report-markup.test.ts`, `toolbar-armed-markup.test.ts` (library), `account-bulk.test.ts`, `bulk-work.test.ts` | the shared signatures and cases of `39` section 6; the account rules of 5.10 row by row (own account, last enabled, already enabled, order); `N working` while a run is in flight |
| `accounts-markup.test.ts` | New form rows in order with password type and `new-password`, no placeholder, `Create` reasons; the grid headings, ticks, state words, dimmed disabled row, last-account `Delete` disabled with its title, `never`; skeleton when loading; workspace groups, `Enabled` switch and its reasons, `Set new password` with its tooltip, toolbar with Discard and Save only, rail `‹ Accounts` |
| `no-network-storage.test.ts` (kept) | still passes unchanged |
| updated | `gate-cover.test.ts`, `chrome-markup.test.ts`, `settings-markup.test.ts`, `test/support/store.ts` for the actor id and the registry |

## 8. Backend changes

**For 3a itself, none is required, but two backend waves come first.** B2 (`39` 7.1, migration `018`) must have merged before 3a is cut: the Id column shows the generated `idNumber`. B3 (`40`) is not needed by 3a; it is needed only by R. The code already has every route and rule that 3a uses: `POST /api/auth/login|refresh|logout`, `GET /api/auth/me`, `GET|POST /api/admin-accounts`, `PATCH|DELETE /api/admin-accounts/:id`, `GET /api/audit`, the 15-minute access token, the single-use refresh token, `session_version`
revocation, the ten-a-minute address limit (in memory) and the five-failure 15-minute lockout, the last-enabled-account rule, and tests for them (`test/auth.test.ts`, `accounts.test.ts`, `audit.test.ts`). Two quirks are handled in the admin, not changed: the audit detail of
`account.created` and `deleted` holds the email, not a name (5.5), and a disabled account's sign-in answers the same `auth.invalid_credentials` as a wrong password (so the gate shows `The email or password is wrong.`).

## 9. Failure modes

- **Two requests 401 together:** one refresh, the loser retries with the new token (the foundation's rule and tests). A refresh token used twice would revoke every session; a bug here reads as random sign-outs.
- **A flaky network during a refresh ends the session** (the single-use token may already be spent): by design, `29` section 6.2.
- **A late answer after sign-out or a new sign-in:** every flow and load compares the recorded `serial`; a stale answer writes nothing.
- **Sign-out fails on the wire:** the session is cleared anyway; `auth.refresh_invalid` is ignored.
- **A stale list:** the last enabled account may differ on the server (`409 account.last_admin`): the row stays, the sentence says why, the list is re-read. An account deleted elsewhere (`404`): removed locally.
- **No push:** another window's disable or delete is seen on this window's next request (any `Refresh`, a save), which returns to the gate; nothing polls.
- **The backend is down:** the gate says `The admin backend cannot be reached.` and keeps the typed values; a signed-in write disables its controls with the same reason until a read succeeds.
- **The proxy points at nothing** (3.2): a non-envelope answer maps to `unreachable`, never a blank screen.
- **A malformed row or answer:** one row is dropped with one notice; the rest of the list stays.
- **Secrets:** tokens and passwords exist only in the store (tokens) and in a form field (passwords) and are never logged, stringified into a notice or put in a URL; nothing is written to the browser.
- **One address, one limiter:** both browser windows reach the backend from `127.0.0.1`, so the ten-a-minute sign-in limit is shared; the lockout drive stays under it.

## 10. The worker brief (headings, `07` section 6.2)

1. **Where.** Worktree `D:\Projects\.giga-worktrees\admin-accounts`, branch `admin/accounts`, cut from `family-port` after the foundation has merged. May change: the files of section 6, `src/admin/test`, `src/shared/http`. Off limits: `src/backend`, `src/frontend`,
   `src/fileserver`, `src/shared/ui`, root `package.json`, `scripts/**`, `docs/**`, every `.env`, any data folder, the other tabs' pages and services, the frozen files of `39` section 4.
2. **Rules.** `AGENTS.md`, `07`, `01`; this plan; no fixture, no fake feature, a control works or is disabled with its reason, skeletons never a sentence over them, no browser storage, no timers, edit with the editor tools one file at a time, files at most 200 lines and tests 250, one exported component
   per file, `PascalCase.tsx` / `useThing.ts` / kebab-case, no `utils`/`helpers`/`common`, never print or copy a secret or an `.env` value, never touch the owner's data directory.
3. **Role.** Implements sections 5 and 6 in the six commits of section 2. Writes AND runs its tests (section 7), the typecheck, the lint and `node scripts/check-rules.mjs`, all clean; starts no server or browser; edits no doc; commits on its branch, never pushes, merges or rebases; lists every gap it filled.
4. **Read first.** `AGENTS.md`; `07` 6.2 to 6.4; `01` 4, 5, 6, 8, 9; this document and `39`; `29` 5 to 8 and 9.6; `34`; `28` 7.3 and Appendix A rows 4, 12, 73; `03` 7.11 to 7.13; then the code: `src/shared/http/src/*`, the foundation's `services/session-api.ts`, `api.ts`, `auth-port.ts`,
   `accounts.ts`, `audit.ts`, `store/session-slice.ts`, `audit-slice.ts`, `lib/event-sentence.ts`, `lib/auth-errors.ts`, `test/support/fake-backend.ts`, and `src/backend/src/{api/auth.ts,api/accounts.ts,services/account-service.ts,services/auth-service.ts,types/account.ts}` as read-only reference.
5. **Scope.** Section 6, nothing more.
6. **Report.** `07` section 6.4, plus every choice where this plan was silent.

## 11. The coordinator's acceptance

Pre-flight (3.2): the `PORT` line, the 401 through 5172. Landing: read the diff, `npm ci` where a lockfile changed (none expected), `node scripts/check/gate.mjs`, `npm run build --prefix src/admin`.

**On the temporary backend** (3.3), the real built admin in Chrome at `http://127.0.0.1:8391/admin/`, at 1600 x 1000 and 900 x 640, a page-level recorder installed first (a `fetch` wrapper in the page that logs each `/api` URL and whether it carried `Authorization`; it never writes to the server):

1. **Gate.** Starts on the full-window gate. Wrong password: `The email or password is wrong.` under Password, password cleared, email kept. Backend stopped (by PID): `The admin backend cannot be reached.`, values kept; restart it. Sign in as `zz-owner@example.test`: the shell appears, `Signed in.`.
2. **Create.** `Ctrl+6`: skeleton, then one row (`zz-owner`, state `enabled`, Delete disabled with `The last enabled account cannot be deleted.`). `Create` is disabled with each required reason in turn; a password of 11 characters is refused under Password after the press; fill `zz-second@example.test`,
   `Second`, a 12-character password; `Create`. The row is listed, the form is empty, the drawer shows `zz-owner@example.test created account zz-second@example.test`. Creating it again shows `Another account already uses that email.` under Email.
3. **Second window.** A second tab, sign in as the second account (its own session). Both sessions list both accounts.
4. **Disable.** In the first tab open the second account, switch `Enabled` off, `Save`: the notice says it is signed out everywhere. In the second tab press the list `Refresh`: the gate returns with `Your session ended. Sign in again.`; signing in as it now says `The email or password is wrong.`. Enable it again, save.
5. **Password.** Set a new password on the second account (`Set new password`; tooltip `Signs this account out everywhere`); the second tab returns to the gate; the old password is refused, the new one signs in.
6. **Last enabled.** Disable every account but the owner: the owner's row Delete and its `Enabled` switch are disabled with their reasons; force the server rule through a stale list (disable in tab two, delete in tab one) and see `This is the last enabled account; another one is needed first.` with the row kept.
7. **Own password.** As `zz-owner`, set a new password on its own row: the gate returns with `Password changed. Sign in again.`; the new password signs in. Own delete, once there is a second enabled account: gate with `Your account was deleted.` (use a throwaway third account).
8. **Lock.** With a throwaway account, five wrong passwords answer `The email or password is wrong.`; the sixth attempt, even with the right password, answers `This account is locked for a while after failed sign-ins.`. Eleven fast attempts in a minute: `Too many sign-in attempts; wait a minute.`; wait a minute before continuing.
9. **Refresh.** Restart the temporary backend (same `DATA_DIR`, same port) with a different `JWT_SECRET`: the held access token is dead, the refresh token is not. In a signed-in tab press `Refresh`: the recorder shows two `401`s, **one** `POST /api/auth/refresh`, two retries answered `200`, and the list stays. Restore the first secret afterwards.
10. **Wire and storage.** Every `/api` request except `login` and `refresh` carried `Authorization`; in the page, `localStorage.length`, `sessionStorage.length`, `document.cookie` and `indexedDB.databases()` are empty before and after; no token appears in any notice or drawer row; the console has no errors or warnings.
11. **Bulk.** Tick two throwaway accounts and the owner: the bulk verbs enable; `Disable` skips `zz-owner` (the signed-in account) with its reason and disables the other two (their next call returns to the gate); `Enable` re-enables them; `Delete` shows `Delete 2 accounts?`, disarms on blur/`Escape`/4 s, deletes them; tick only the owner: `Delete` is disabled with the reason; a forced stale row shows a per-row failure under the toolbar while the rest complete; the list is re-read once; `N working` shows during the run; failed rows stay ticked.
12. **Look.** Both sizes, dark and light: the New form, the list (rows 36px, columns lined up with the header, horizontal scroll inside the list only), the workspace, the armed `Delete zz-second@example.test?` re-arming after 4 s, the skeleton, disabled tooltips; compared with the interface's Collections window for the pattern and with the mockup's
    `accounts-index.html` and `account-workspace.html` for content. The Events drawer pages with `Load older`.

**On the real stack (read-only):** the gate renders at 5172 and in the backend window; the anonymous `GET /api/auth/me` answers 401; **no sign-in is attempted on the owner's backend** (the coordinator holds no credentials and a wrong try would add an audit row and a failure count to the owner's data). The owner then follows 3.4.
Then stop the temporary backend by PID, delete its folder, confirm the owner's data folder is untouched, run `npm run dist:win` as `07` section 6.5 requires and say plainly that nothing of this wave ships in the installer.

## 12. Doc against code: every difference found (2026-10-17)

| # | Doc says | Code does |
|---|---|---|
| 1 | `29` 7: the layer has base `/api`, and `/healthz` is read through it with `base: ""` | `createApi` refuses any path not beginning `/api/` (`TypeError`); the foundation uses base `""`; `/healthz` needs an additive `rootPaths` option (Wave 4) |
| 2 | `29` 7: `ApiError { code, status, message, field? }` | `ApiError` has no `field` and `createApi` drops `error.details`; this wave adds it (5.1) |
| 3 | `29` 7 table: "the sentence the admin shows" | `errorSentence` prefers the server's message and uses the table as a fallback and for the layer's own codes; the backend's validation sentences are generic (`The password is not valid.`), so length rules are checked client-side first |
| 4 | `29` 6.2 and 7: a failed refresh shows `auth.refresh_invalid`'s sentence; `34`: the notice `Your session ended. Sign in again.` | decision 4: the notice always |
| 5 | `29` 6.1: the titlebar and statusbar stay at the gate; `28` Wave 2 acceptance: `Sign out` returns to the page with the chrome | `34` section 4 and `family-port`'s `AppShell`: the gate owns the whole window; those lines are stale. The foundation branch predates that change and still draws the page inside the chrome (merge conflict to resolve for the wall) |
| 6 | `29` 8: `session-slice` holds `session`, `signIn(session)`, `signOut()` | built: `signedIn`, `actor`, `tokens`, `gate`, `beginSignIn`, `finishSignIn`, `adoptTokens`, `endSession`, `signOut` |
| 7 | `34` 5: four refusal kinds from four codes | `refusalFor` maps any other 4xx to `invalid` and 5xx or unreadable to `unreachable` (decision 4) |
| 8 | `29` 7: `onEvent` appends one drawer row per failed call | `RequestEvent` carries method, status, elapsed and area only, no sentence; the hook says the failure (decision 3) |
| 9 | `29` 11: `account.created`/`deleted` rows name `detail.name` | the backend writes `{ email }` for created and deleted, `{ name, fields }` for updated; `nameOf` would show the account id (5.5) |
| 10 | `29` 6.2: own password via the Accounts workspace "or `POST /api/auth/password`" | the PATCH needs no current password, the POST does; the UI has only `New password` (decision 6) |
| 11 | `29` 7 and 14: `/healthz` is read at the root | `vite.config.mts` proxies `/api`, `/live`, `/logos`, `/test` only; `/healthz` in dev returns Vite's page (Wave 4) |
| 12 | `28` progress table, Wave 2 "Creates": `useRecordForm`, `useFixtureLoad` | none of them, nor `StateWord`, is in the tree (5.7) |
| 13 | `28` 7.2 / 9: the Accounts toolbar has no verb; ticks arm the toolbar | superseded (owner, 2026-10-17): the toolbar carries bulk verbs on the ticked rows (decision 7, 5.10) |
| 14 | `29` 9.6 / `28` 9.3: the last enabled account's Delete is guarded | the backend also refuses *disabling* it, so the workspace's `Enabled` is guarded too |
| 15 | `03` 7.12: five wrong passwords lock the account | the fifth wrong answer is still `auth.invalid_credentials`; the sixth attempt, even with the right password, is `auth.locked` |
| 16 | `03` 7.12: refresh and logout are "anyone with a refresh token" | a used or revoked token on logout is `401 auth.refresh_invalid`; sign-out ignores it |
| 17 | `AGENTS.md` / `29` 3.7: dev backend on 8091 | the owner's local `.env` `PORT` is stale (3001) so the admin's proxy misses it (3.2) |
| 18 | `03` 7.11: "an email already used is `409 account.email_taken`" | emails are compared case-insensitively (`email_key`), so `A@x` and `a@x` collide; the list is sorted by that key |
| 19 | `01` 6: the store holds no promise and does no I/O | the foundation's `store/audit-slice.ts` awaits `audit.list` inside its actions; this wave moves that into a hook |
| 20 | `35` (first version) planned a request layer, schemas and sentences | the foundation built them; this revision removes that scope |
| 21 | `28` 7.3: the Account New form is `Email`, `Name`, `Password`; `26` 4.8 lists Email first | superseded (owner, 2026-10-17): Name first (decision 12) |
| 22 | `29` 5: `AdminAccount.id` is a string | `acct_<uuid>`; an `idNumber` is added by migration `018` and the shapes of `29` 5 gain it (decision 13) |
| 23 | `35` (second round) said no id was generated for accounts beyond the string key | every account gets a generated `idNumber` from the accounts sequence (`39` 7.1); the string key stays |

## 13. Done when

The owner signs in to the real admin with their existing account, opens Accounts, creates an account with an email, a name and a password of at least 12 characters, sees it listed and audited, and the new person can sign in; a disabled or re-passworded account is returned to the gate on its next request;
the last enabled account cannot be deleted or disabled; a token expiring refreshes once without a visible blip; every request but login and refresh carries the bearer; nothing is written to the browser; the Events drawer shows the real audit log; the shared record pieces and the slice and stale registries exist for
the parallel waves; the gate, the admin and shared-http tests pass; the coordinator's section 11 drives pass on the temporary backend; the owner's data was never touched by verification.
