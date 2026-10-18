# 35 - Admin accounts plan (Wave 3a: real sign-in and the Accounts tab)

**Status: plan, written before the code (branch `admin/accounts`, cut from `family-port` after Wave 3 has landed and
been accepted).** Owner, 2026-10-17: "let's do the accounts next wave so I can create an account." This wave makes the
admin's sign-in real (the gate of `34` talks to the backend) and builds the Accounts tab end to end on real data, so the
owner can sign in with their existing account and create another. Everything else stays as it is. It is a vertical
slice taken out of three waves of the program: Wave 5's Accounts part (`28`), Wave 7's request-layer, auth, session and
audit part, and Wave 10's Accounts part (`29`); section 4.5 lists the edits that keep those tables true. It follows
`07` section 6 (one worker, a worktree, owned paths, tests written and not run by the worker, the coordinator lands it
and runs the real checks). Governed by `00`, `01`, `07`, `26` (D5 memory-only tokens, D22 no roles), `28`, `29`, `34`.

## 1. Decisions

| # | Decision |
|---|---|
| 1 | One worker (A, the admin worker), one worktree, five commits in the order of section 2. No backend change (section 8); one additive change in `src/shared/http` (`ApiError.field`, section 5.1). |
| 2 | The seam of `34` stays: `AuthPort` is widened (`refresh`, tokens and the account id in the session) and `services/auth.ts` becomes the real port. `fixtures/auth-port.ts`, `fixtures/audit.ts`, the actor half of `fixtures/session.ts` and `constants/fixture-switches.ts` are deleted. The admin always starts on the gate; `?signedin=0` is gone. |
| 3 | Tokens live in the session slice, in memory only; nothing is written to the browser (`26` D5). A reload signs in again. |
| 4 | Two `createApi` instances over `@giga/http`: the public one (no `Authorization`: login, refresh, logout) and the signed one (bearer from the slice, read per request). `services/api.ts` wraps the signed one with the lazy single-flight refresh and one retry; `@giga/http` gains no auth concept. |
| 5 | No `onEvent`, no `restEvent`: a finished request carries no sentence. The hook that made a failed call says the `ApiError` sentence once on the notice line with `warn` (the chrome slice's `say` also writes the drawer row for `warn` and `error`). A success is a notice only; the audit row is the record. |
| 6 | The gate maps `auth.invalid_credentials` to `invalid`, `auth.locked` to `locked`, `auth.rate_limited` to `rate_limited`, and every other failure (`backend.unreachable`, `backend.bad_response`, a 5xx) to `unreachable`. A session that ends under the app always shows `34`'s notice `Your session ended. Sign in again.`; the refresh failure's own sentence is not shown. |
| 7 | Own-account effects end the session locally with a notice: a new password for yourself (`Password changed. Sign in again.`), disabling or deleting yourself (`Your account was disabled.` / `Your account was deleted.`). Changing your own email or name updates the signed-in actor and nothing else. |
| 8 | A password change of any account goes through `PATCH /api/admin-accounts/:id { password }`, never `POST /api/auth/password`: the Password group has only `New password` (`28` 7.3) and the PATCH needs no current password. Both revoke the account's sessions. |
| 9 | The Accounts list has the tick column of the mockup (`accounts-index.html`) and `29`'s family of lists, though Accounts has no forward verb (`28` 7.2): the ticks only select. If the coordinator's visual acceptance judges a tick that arms nothing a `01` section 9 breach, the fix is to drop the grid's `selection` prop and its slice field; nothing else changes. |
| 10 | The Events drawer reads `GET /api/audit` (cheap: one service, one pure merge, no new component); the fixture drawer is deleted. The drawer reads after sign-in, after each of this wave's writes and on `Load older`. |
| 11 | The Accounts workspace opens from the list already held (no `GET /:id`, `29` section 8). The List `Refresh` re-reads the accounts and the audit tail together. |
| 12 | Verification runs on a temporary backend that serves the built admin on its own free port, with a temporary `DATA_DIR`; the owner's backend, database and `.env` are never read or written by it (section 3). |

## 2. Scope, in order (five commits)

1. **Shared request layer.** `src/shared/http` `ApiError` carries `field` and `correlationId` from `error.details`.
2. **Request layer and real sign-in.** `services/api.ts`, `session-access.ts`, `session-refresh.ts`, the schemas,
   `lib/error-sentence.ts` (all of `29` section 7's table), `lib/refusal-kind.ts`, the real `services/auth.ts`, the
   session slice with tokens, serial and the actor id, `store/session-access-binding.ts`, `SessionState`, the hooks
   adapted, the fixtures deleted, the tests updated.
3. **Audit tail.** `services/audit.ts`, the audit schema, `lib/audit-merge.ts`, the rewritten audit slice, `useAuditTail`,
   the drawer wired, `lib/event-sentence.ts` taught the account actions the backend really writes.
4. **Accounts data.** `types/admin-account.ts`, `services/accounts.ts`, the account schema, `store/accounts-slice.ts`,
   `lib/account-guard.ts`, `lib/account-draft.ts`, `lib/account-rows.ts`, `lib/format-when.ts`, `services/account-flows.ts`
   and `services/account-password-flow.ts`, `hooks/useAccountsLoad.ts`, `hooks/useAccountActions.ts`.
5. **Accounts UI.** `components/accounts/*`, `constants/account-*.ts`, `pages/AccountsPage.tsx`, the Session section.

## 3. The first sign-in, the temporary backend, and the owner's checklist

### 3.1 How the first account exists

The backend creates the first account itself: at start, with **no accounts** and both `ADMIN_BOOTSTRAP_EMAIL` and
`ADMIN_BOOTSTRAP_PASSWORD` set, it creates one named `Admin` (`services/bootstrap-admin.ts`, `03` 7.11); with accounts
present it ignores both, so changing them later changes nothing; with neither set it starts and logs that nobody can
sign in. `JWT_SECRET` (32 characters or more) is required to start. The owner's `src/backend/.env` already carries
these three names; **the plan and the worker never read, print or copy their values**, and no step of this wave edits
that file's secrets. The owner signs in with the email and password they set there. There is no password-reset route and
none is added; if the owner cannot sign in, that is a decision for the owner (an offline reset tool would be its own
plan), not something this wave improvises.

### 3.2 The dev port line (a fix this wave carries, `AGENTS.md` "fix the obvious bug")

The admin's Vite forwards `/api` to `ADMIN_BACKEND_URL`, default `http://127.0.0.1:8091`, while the owner's local
`src/backend/.env` sets `PORT=3001` (stale, `29` section 3 item 7). With real sign-in the mismatch is no longer
invisible: every sign-in fails as unreachable. Before the visual acceptance the coordinator reads **only the `PORT`
line** of `src/backend/.env` (by line range, never the file), backs the file up, and removes that line if it is
`3001` (the code default is 8091); `scripts/check/live-smoke.mjs` already follows the `PORT` line, `GIGA_SMOKE_BACKEND`
or 8091. If the owner wants 3001 kept, `ADMIN_BACKEND_URL` goes in `src/admin/.env` instead. Either way, one anonymous
`GET http://127.0.0.1:5172/api/auth/me` must answer `401 auth.unauthorized` (an envelope, not Vite's page): that is the
proof the proxy reaches a live backend, and it writes nothing.

### 3.3 Verifying on a temporary backend (coordinator, never the owner's data)

`DATA_DIR` defaults to `~/.giga-stream-admin`, which is the owner's real database, so the variable is always set
explicitly and checked. Test-only constants (a throwaway database that is deleted afterwards; none is the owner's):

| Variable | Value |
|---|---|
| `PORT` | a free port such as `8391` (never 8090, 8091, 8190, 8191, 3001, 5171, 5172, 5271, 5272, 9222, 9223) |
| `DATA_DIR` | `%TEMP%\giga-accounts-verify` (created empty for the run) |
| `JWT_SECRET` | `zz-verify-secret-not-real-0123456789abcdef` |
| `ADMIN_BOOTSTRAP_EMAIL` | `zz-owner@example.test` (the account is named `Admin`) |
| `ADMIN_BOOTSTRAP_PASSWORD` | `zz-verify-owner-password-1` |
| `ADMIN_DIST` | the landed tree's `src/admin/dist`, built with `npm run build --prefix src/admin` |

Start it from `src/backend` with the variables in the **process environment** and without any `--env-file`
(`node src/build-shared.ts && npx tsx src/server.ts`; `config.ts` reads `process.env` only, and a real variable beats an
env file anyway), detached through `Win32_Process.Create` as `07` section 4 shows, keeping the PID. Do not use
`npm run dev` in `src/backend`: it loads `.env`. Then check, before any browser: `GET /healthz` answers
`role: "admin-backend"`; `Test-Path $env:TEMP\giga-accounts-verify\admin.db` is true; the owner's
`~\.giga-stream-admin` has no new or modified file (timestamps compared before and after). The admin is served by that
backend at `http://127.0.0.1:8391/admin/` (same origin, no Vite, no collision with the owner's 5172). Stop it by PID
at the end and delete the temporary folder.

### 3.4 The owner's checklist (the real app, once this has landed)

1. Start the stack as usual (`npm run dev`); open the admin in its backend window or at `http://127.0.0.1:5172/admin/`.
2. Sign in with the existing account's email and password. A wrong try shows `The email or password is wrong.`; five
   wrong ones lock that account for 15 minutes, so do not guess.
3. Press `Ctrl+6` (Accounts). The list shows your own row, state `enabled`, last sign-in `never` or a time; its
   `Delete` is disabled (the last enabled account).
4. Under **New account** type the new person's email, name and a password of at least 12 characters; `Create` is
   disabled with `Email is required.` and its siblings until all three are filled. Press `Create`.
5. The row appears in the list; the notice says `Created <email>.`; the Events drawer (statusbar `Events`) shows
   `<you> created account <email>`.
6. Optional: open a second admin window, sign in as the new account, and see it in the same list. To give someone a new
   password later: open the row, `New password`, `Set new password` (it signs that account out everywhere).

## 4. Dependencies and ordering

### 4.1 Order

Waves run one at a time and are accepted before the next (`28` section 10). This wave is cut **after Wave 3** (Channels
with the Preview UI) is landed, accepted and committed on `family-port`, and **before Wave 4**. Waves 4, 5 and later are
cut from this wave's result, so they inherit the real gate: a fixture tab can be looked at only while signed in, which
needs a backend (section 3.3 for checks; the owner's own backend in daily use). The mockup parity switch `?signedin=0`
no longer exists.

### 4.2 What it consumes from Wave 3 (read at cut time; the brief carries the landed signatures)

| File | Used for |
|---|---|
| `src/shared/ui/src/lists/RecordGrid.tsx` (`RecordGrid`, `GridHeading`, `GridSelection`) | the Accounts list with its select-all tick |
| `src/shared/ui/src/lists/RecordGridRow.tsx` | one row: state word, dim, tick, spanning open button, the end `Delete` |
| `src/shared/ui/src/lists/SkeletonGrid.tsx` | the list while it loads or is empty |
| `src/shared/ui/src/lists/record-grid-layout.ts` (`GridLayout`) | the column set in `constants/account-grid.ts` |
| `src/shared/ui/src/controls/Checkbox.tsx` | the ticks (through the grid) |
| `src/admin/src/components/records/StateWord.tsx` | the `enabled` / `disabled` word in a row |
| `src/admin/src/hooks/useRecordForm.ts` | the New form and the workspace draft: dirty, discard, field errors |

`ChipGroup` (pill) is not used. Wave 2 already supplies `ListGroup`, `NewRecordGroup`, `WorkspaceFrame`, `RecordRail`,
`WorkspaceToolbar`, `IndexToolbar`, `lib/row-state.ts` (`enabledState`), `lib/field-checks.ts`, `LAST_ACCOUNT` in
`constants/record-copy.ts`, and the library's `ArmedButton`, `Toggle`, `Input`, `Row`, `Group`, `Tooltip`.
**`hooks/useRecordForm.ts` is in `28`'s Wave 2 row but is not in the tree** (nor are `useFixtureLoad` or `StateWord`);
if Wave 3 did not land it, the worker writes it to `28` section 6.1's description (at most 90 lines) and reports it.

### 4.3 What stays fixture

Channels, Providers, Titles, Playlists and Jobs pages and their fixtures (Waves 3 to 5 and 8 to 9); Settings > About's
facts (`fixtures/session.ts` keeps only `ABOUT_FACTS` and its header says so); appearance, tab, panes and bounds stay
in memory and start at the defaults (Wave 7's account state); the statusbar's work counts. `GET /healthz`, `GET
/api/auth/me` and `/api/auth/me/state` are not called this wave.

### 4.4 How fixture shells coexist with real auth

`AppShell` already mounts no page, titlebar, drawer or statusbar while signed out (`34` section 4). The fixture pages
mount exactly as today once `signedIn` is true, which now means a real session. Nothing a fixture page does touches the
network, and `no-network-storage` still holds for them. Fixture pages that write event rows through `logEvent` keep
working: the audit merge (section 5.7) keeps local rows by id. On sign-out or a session ending, the slice's reset
returns the tab, workspaces, overlay, events and accounts to the start; Wave 3's fixture slices hold no account's data.

### 4.5 What this absorbs, and the table edits the coordinator makes

| Wave | Taken by this wave | Left |
|---|---|---|
| `28` Wave 5 | the Accounts tab (UI, built on real data, no `fixtures/accounts.ts`) | Playlists and Jobs |
| `29` Wave 7 | `services/api.ts`, `services/auth.ts`, `services/schemas/{session,audit}-schema.ts`, `services/audit.ts`, `lib/error-sentence.ts` (the whole table), the session slice's tokens, the audit rows in the drawer, deletion of `fixtures/session.ts` actor half, `fixtures/audit.ts`, the `signedin` switch; `SessionState.tsx` (created here, empty of hydration) | `services/health.ts`, `services/account-state.ts`, `lib/account-state-map.ts`, `store/ui-state-slice.ts`, the three hydration and write-back hooks (added to `SessionState`), About facts, the `/healthz` Vite proxy, the version define, the reveal |
| `29` Wave 10 | `services/accounts.ts`, its schema, slice, the wired Accounts pages, the own-password flow, `account-last-admin` and `own-password` tests | the sweep, `README.md` final, `fixture-switches` (already gone), the Electron `Choose` and build checks |

Edits the coordinator makes when this lands (and records in the commit): `28` section 3.1 and `27`/`29` wave lists gain
**Wave 3a** (this document); `28` progress table gains a row `3a | Landed | <commit> | the files of section 6 |` and
Wave 5's row loses the Accounts files and tests (`account-guard.test.ts`); `29` progress table: Wave 7's Creates/Updates/
Deletes lose the items above, Wave 10 keeps only the sweep; `29` sections 6.1, 6.2 and 7 get the corrections of section
12 (full-window gate, `onEvent` unused, the refresh sentence, `ApiError.field`); `34` section 5 gets "replaced by Wave 3a,
not Wave 7"; `AGENTS.md` and `07` need nothing.

## 5. Design

### 5.1 `@giga/http`

`ApiError` gains `readonly field?: string` and `readonly correlationId?: string`; its constructor takes an optional
fourth argument `{ field?, correlationId? }`. `createApi`'s `refused()` and `refusal()` pass `details.field` when it is a
string and `correlationId` when present. Additive: `src/frontend/src/services/desktop.ts` builds an `ApiError` with three
arguments and is untouched. The server's sentence still wins over the program's table (`errorSentence`), so the table of
`29` section 7 is the fallback and the text for the layer's own codes.

### 5.2 The request layer (`services/api.ts`)

```ts
createRequestLayer(deps?: { fetch?: FetchLike; access?: SessionAccess })
  -> { request<T>(path, schema, options?), publicRequest<T>(path, schema, options?) }
export const { request, publicRequest } = createRequestLayer();
```

`services/session-access.ts` is the seam to the store: `SessionAccess { tokens(): SessionTokens | null; replace(tokens:
SessionTokens): void; end(sentence: string): void; now(): number }` with `bindSessionAccess(access)` and
`sessionAccess()`; `store/session-access-binding.ts` binds the real store at the end of `app-store.ts`; tests bind fakes.
Both layers use `base: ""` (paths begin `/api/`, which `createApi` enforces), `failureCodes {invalid:
"backend.bad_response", unreachable: "backend.unreachable"}`, `sentences: ERROR_SENTENCES`, `defaultArea: "Connection"`,
no `onEvent`, no `onUnauthorized`. The signed layer's `headers` getter returns `{ authorization: "Bearer <access>" }`
from `access.tokens()` at each request, or nothing when there is no session.

`request(path, schema, options)`:

1. No tokens: throw `ApiError("auth.unauthorized", ...)` without sending (the gate is already showing).
2. If `accessExpiresAt - now() < REFRESH_SKEW_MS` (30 000, `constants/session-timing.ts`): `await refreshOnce()`.
3. Remember `sent = tokens.accessToken`; call the signed `api`.
4. On `ApiError` `auth.unauthorized`, once: if the slice's access token is no longer `sent` (another request refreshed
   first) retry at once with the new token and do not refresh; otherwise `await refreshOnce()` then retry once.
5. A second `auth.unauthorized`, or a refresh that rejects: `access.end(SESSION_ENDED_NOTICE)` (ignored when already
   signed out) and rethrow.

`refreshOnce()` (`services/session-refresh.ts`, `createRefresher({ post, access })`) is one shared promise: it posts
`/api/auth/refresh { refreshToken }` through the **public** layer, parses a `Session`, calls `access.replace(tokens)`,
and clears the promise when it settles. It never retries (the refresh token is single-use and a second use revokes
every session of the account, `03` 7.12); any failure, including a transport failure, rejects every waiter once and
ends the session. No timer, no polling.

### 5.3 The auth port (`types/auth.ts`, `services/auth.ts`)

```ts
interface SessionActor { id: string; email: string; name: string }
interface SessionTokens { accessToken: string; accessExpiresAt: number; refreshToken: string; refreshExpiresAt: number }
interface AuthSession { actor: SessionActor; tokens: SessionTokens }
interface AuthPort {
  signIn(email, password): Promise<AuthResult>;   // POST /api/auth/login, public; never rejects
  refresh(): Promise<AuthResult>;                 // POST /api/auth/refresh with the held refresh token; used by session-refresh
  signOut(): Promise<void>;                       // POST /api/auth/logout { refreshToken }; never rejects; no tokens: no request
}
```

`lib/refusal-kind.ts` is the pure mapping of decision 6. `useSignIn` and `useSignOut` keep their shape: they await the
port and hand the answer to the store; the only change is the imports. The `Sign in` flow shows the three sentences of
`constants/sign-in-copy.ts` unchanged.

### 5.4 The session slice

`SessionSlice` keeps `signedIn`, `actor`, `gate`, `beginSignIn`, `finishSignIn`, `endSession`, `signOut` (`34`
section 5) and gains `tokens: SessionTokens | null`, `serial: number` (raised at every sign-in), `replaceTokens(tokens)`
and `updateActor(account)`. It starts **signed out always**. `finishSignIn` on success sets `signedIn`, `actor`,
`tokens`, `serial + 1`, empty `events`, a fresh accounts and audit state; `signedOut()` clears tokens and resets the tab,
workspaces, overlay, events, audit and accounts. `serial` is how a late answer from an earlier session is recognised and
dropped (section 5.6). Tokens are never copied into a notice, an event row, a URL or the console.

### 5.5 Accounts data

`services/accounts.ts` over `request`: `listAccounts()` -> `{ items, unreadable }` (the answer's `items` is
`z.array(z.unknown())`; each row is parsed on its own, an unreadable row is counted and dropped, `01` section 8);
`createAccount({ email, name, password })` (`POST`, trimmed email and name, password untouched); `updateAccount(id,
patch)` (`PATCH`, only the fields given: `email`, `name`, `disabled`, `password`); `deleteAccount(id)` (`DELETE`,
`{ id }`). Every write answers the account (or `{ id }`) and is validated; a malformed answer is `backend.bad_response`
and the hook re-reads the list.

`store/accounts-slice.ts`: `accounts: { status: "idle" | "loading" | "ready" | "failed"; items: AdminAccount[];
unreachable: boolean; ticked: string[] }` and actions `startLoad`, `loaded(items)`, `loadFailed(unreachable)`,
`upsert(account)` (kept sorted by lower-cased email, as the backend does), `remove(id)`, `tick(id, on)`,
`tickAll(on)`, `markUnreachable(bool)`. `unreachable` is set by a transport failure and cleared by the next successful
read; while set, every write is disabled with `The admin backend cannot be reached.` (`29` section 8).

`services/account-flows.ts` (`createAccountFlows(deps)`) holds the orchestration the hooks call, with the store and the
services injected so the tests drive it with fakes: `create`, `save`, `remove`, `refresh`, and
`services/account-password-flow.ts` holds `setPassword`. Each flow records `serial` before it awaits and writes to the
store only if `serial` is unchanged after. Results are typed (`{ ok: true } | { ok: false; field?; sentence }`) so the
form puts a field-named refusal under its row (`ApiError.field`: `email`, `name`, `password`; any other field is
notice-only). Flows:

| Flow | Route | On success | On failure |
|---|---|---|---|
| create | `POST /api/admin-accounts` | `upsert`; the form clears; notice `Created <email>.`; reload the audit tail (`limit=10`) | `account.email_taken` under Email; `account.invalid` under its field; else `warn` notice; the form keeps its values |
| save | `PATCH` the changed fields | `upsert`; baseline = the answer; notice `Saved <email>.`; own account: `updateActor`; own `disabled: true`: end the session with `Your account was disabled.`; audit tail | `account.last_admin` under Enabled; `email_taken` under Email; `account.not_found` closes the workspace with a `warn` notice and re-reads the list |
| setPassword | `PATCH { password }` | other account: notice `Password set; <email> is signed out everywhere.`, field cleared; own account: end the session with `Password changed. Sign in again.` (no logout call: the token is already dead) | under `New password`; the field is not cleared |
| remove | `DELETE` | `remove`; notice `Deleted <email>.`; own account: end the session with `Your account was deleted.`; audit tail | `account.last_admin`: the row stays, notice says why; `account.not_found`: the row is removed (it is already gone) and the list re-read |
| refresh | `GET` list and `GET /api/audit?limit=50`, together | `loaded`; `unreadable` rows: one `warn` notice `N accounts could not be read.` | keeps the last items, `loadFailed`, one `warn` notice |

A password is never put in a notice, an event row, the store or an error: the field's value is read from the form at
press time, sent, and the form state cleared on success.

### 5.6 The Accounts UI (`components/accounts/*`)

`AccountsPage` is the only reader of `workspaces.accounts`: null shows `AccountsIndex`, an id shows `AccountWorkspace`.
`useAccountsLoad(active)` loads when the tab is first shown after sign-in (status `idle`) and never again by itself.

- **AccountsIndex** (60): `IndexToolbar` (empty strip, Accounts is the last tab), `NewAccountForm`, `AccountsList`.
- **NewAccountForm** (110): `NewRecordGroup` (`user-plus`, `New account`), rows in this order and no others: `Email`
  (`type=email`, `autoComplete="off"`), `Name`, `Password` (`type=password`, `autoComplete="new-password"`). No role, no
  info glyph on these three (`26` 4.4). `Create` is disabled with `Email is required.`, then `Name is required.`, then
  `Password is required.`, then `Saving.` while a call runs, or the unreachable sentence. Pressing it runs the value
  checks first (section 5.8); a refusal shows under its row with `aria-invalid`.
- **AccountsList** (60): `ListGroup` (`users`, `Accounts`) with a ghost `Refresh` in the heading slot (`refresh-cw`);
  `SkeletonGrid` while `idle` or `loading` or when there are no items (never a sentence over it, never an empty card);
  a failed read keeps the last rows and sets one notice.
- **AccountRows / AccountRow** (110 / 70): `RecordGrid` with headings `email`, `name`, `state`, `last sign-in`, the
  select-all tick (`Select all accounts`, `mixed` over a part), rows through `RecordGridRow` with `StateWord`
  (`enabled` / `disabled`, a disabled row dimmed), the time in mono as `YYYY-MM-DD HH:mm` local (`never` if absent),
  tick label `Select <email>`, a press opens the workspace, the end is an `ArmedButton` `Delete` whose question is
  `Delete <email>?`; disabled with `The last enabled account cannot be deleted.` for the last enabled account (computed
  from the list by `lib/account-guard.ts`), at rest titled `Deletes the account and ends its sessions.`; also disabled
  with the unreachable sentence or while the call runs. The column set is `constants/account-grid.ts` (tracks in rem;
  the end track fits `Delete someone@example.test?`).
- **AccountWorkspace** (90): `WorkspaceFrame` (tab `accounts`), `RecordRail` (`‹ Accounts`, `Details`, `Password`, the
  key list a module constant), `WorkspaceToolbar` with `Discard changes` and `Save` only (no forward verb).
  Opens from the held list; if the account is no longer in a `ready` list it closes with a notice (`account.not_found`).
- **AccountDetailsGroup** (90): `Group` `Details` (`user`): `Email`, `Name`, `Enabled` (`Toggle`, the inverse of
  `disabled`, with the tip `A disabled account cannot sign in.`), `Last sign-in` (read only). `Enabled` is disabled with
  `The last enabled account cannot be disabled.` while this is the last enabled account. One `Save` per page sends only
  the changed fields of `email`, `name`, `disabled`.
- **AccountPasswordGroup** (70): `Group` `Password` (`key-round`): `New password` (`type=password`,
  `autoComplete="new-password"`) and a ghost `Set new password` inside the library `Tooltip` with `Signs this account out
  everywhere`; disabled with `Type a new password.` or the length refusal until valid. It is its own verb and is not
  part of `Save`.
- **Session section**: unchanged apart from reading the actor's id-bearing shape; `Sign out` still returns to the gate.

### 5.7 The Events drawer from the audit log

`services/audit.ts` `readAudit({ limit, before? })` -> `{ entries, nextBefore, unreadable }` (entries parsed one at a
time, `AuditEntry` of `types/admin-audit.ts`). `lib/audit-merge.ts` is pure: it converts entries with `eventFromAudit`
(names: the held accounts as id -> email), reverses the newest-first page, merges into the held rows by id (an audit row
has the id `audit-<id>`, a local `say`/`logEvent` row keeps its own), keeps time order and the 200-row cap. The slice
keeps `audit: { read: boolean; nextBefore: number | null }`: a tail read sets the cursor only if none was read; `Load
older` always sets it and passes `before=<smallest audit id held>`; `Load older` is available only when `read` and
`nextBefore !== null`. `hooks/useAuditTail.ts` returns `{ reload, loadOlder }`; `components/session/SessionState.tsx`
(renders nothing, mounted by `AppShell` only while signed in, `key` = the session `serial`) calls `reload` on mount;
`AdminEventsDrawer` uses `loadOlder`. `lib/event-sentence.ts` changes for the Account area: the name is `detail.email`
(the backend writes it on `account.created` and `account.deleted`), else the held email for the subject id, else
`detail.name`, else the id; no field named `password` is ever read.

### 5.8 Field checks (`lib/field-checks.ts`, with `constants/account-limits.ts` mirroring `03` 7.11)

`emailAddress` (`name@host.tld`, at most 254), `nameLength` (1 to 80 after trim), `passwordLength` (12 to 256, never
trimmed): sentences `Email must look like name@example.com.`, `Name must be 1 to 80 characters.`, `Password must be at
least 12 characters.` The backend's own sentence for a bad field (`The password is not valid.`) is only the fallback.

## 6. Files

Paths under `src/admin/src/` unless marked. "C" create, "U" update, "D" delete. Bounds are expected sizes (limit 200,
tests 250).

| Act | File | Responsibility |
|---|---|---|
| U | `src/shared/http/src/api-error.ts`, `create-api.ts` | `field` and `correlationId` (5.1) |
| U | `src/shared/http/test/create-api.test.ts` | the three new tests |
| C | `types/admin-account.ts` (20) | the backend's `AdminAccount` |
| U | `types/auth.ts` (50) | `SessionActor.id`, `SessionTokens`, `AuthSession.tokens`, `AuthPort.refresh` |
| C | `services/api.ts` (120) | the two layers, the refresh rule |
| C | `services/session-access.ts` (45), `services/session-refresh.ts` (70) | the seam; the single-flight refresher |
| U | `services/auth.ts` (110) | the real port (was the fixture re-export) |
| C | `services/schemas/session-schema.ts`, `account-schema.ts`, `audit-schema.ts` (30 each) | Zod for the wire (non-strict) |
| C | `services/accounts.ts` (90), `services/audit.ts` (60) | the routes |
| C | `services/account-flows.ts` (170), `services/account-password-flow.ts` (60) | the orchestration (5.5) |
| C | `constants/session-timing.ts` (10), `account-copy.ts` (70), `account-grid.ts` (20), `account-limits.ts` (12) | `REFRESH_SKEW_MS`; labels, tips, notices; the grid; limits |
| U | `constants/sign-in-copy.ts` | nothing removed; `SESSION_ENDED_NOTICE` is already there |
| C | `lib/error-sentence.ts` (90), `lib/refusal-kind.ts` (25) | `29` section 7's table; the gate mapping |
| C | `lib/account-guard.ts` (45), `lib/account-draft.ts` (60), `lib/account-rows.ts` (60), `lib/format-when.ts` (20), `lib/audit-merge.ts` (60) | pure |
| U | `lib/field-checks.ts`, `lib/event-sentence.ts` | 5.8; 5.7 |
| C | `store/accounts-slice.ts` (100), `store/session-access-binding.ts` (30) | 5.5; the binding |
| U | `store/session-slice.ts`, `store/audit-slice.ts`, `store/app-store.ts`, `store/selectors.ts` | 5.4; 5.7 |
| C | `hooks/useAccountsLoad.ts` (40), `hooks/useAccountActions.ts` (70), `hooks/useAuditTail.ts` (50) | hooks over the flows |
| C | `components/session/SessionState.tsx` (25) | the signed-in mount point (Wave 7 adds the hydration hooks) |
| C | `components/accounts/AccountsIndex.tsx`, `NewAccountForm.tsx`, `AccountsList.tsx`, `AccountRows.tsx`, `AccountRow.tsx`, `AccountWorkspace.tsx`, `AccountDetailsGroup.tsx`, `AccountPasswordGroup.tsx` | 5.6 |
| U | `pages/AccountsPage.tsx`, `components/chrome/AppShell.tsx` (mount `SessionState`), `components/chrome/AdminEventsDrawer.tsx`, `components/settings/SessionSection.tsx` | |
| U | `fixtures/session.ts` | only `ABOUT_FACTS` stays |
| D | `fixtures/auth-port.ts`, `fixtures/audit.ts`, `constants/fixture-switches.ts`, `test/auth-port.test.ts` | the fixture sign-in, drawer and switch |
| U | `README.md` | the `?signedin=0` line is gone; sign-in is real |

No file under `src/shared/ui` changes (Wave 3 supplies the list). If a library gap shows, the worker adds the smallest
additive change with its library test and names it in the report. Nothing under `src/backend`.

## 7. Tests (`node:test`, fast, injected fetch, clock and fakes; the worker writes them AND runs them)

The worker runs its own tests this wave (owner's instruction for this plan): `npm test` in `src/admin` and in
`src/shared/http`, with `typecheck`, `lint` and `node scripts/check-rules.mjs`. Each is short; none starts a server,
opens a browser or sleeps.

| File | Cases |
|---|---|
| `shared/http/test/create-api.test.ts` | a refusal carries `details.field`; no `details` leaves `field` undefined; a non-string `field` is ignored |
| `request-layer.test.ts` | the bearer comes from the getter at each request; public requests carry no `authorization`; a non-envelope is `backend.bad_response`; a rejected fetch is `backend.unreachable`; a token inside the skew refreshes before the call, a fresh one does not; a 401 refreshes once and retries with the new token; **two concurrent 401s make exactly one refresh call and both retry**; a request that lost the race retries with the new token and does not refresh; a second 401 ends the session once with `Your session ended. Sign in again.`; a failed refresh and a transport failure of the refresh both end the session and are not retried; no tokens: no request is sent; `ApiError.field` reaches the caller |
| `session-refresh.test.ts` | the promise is shared and then cleared; the next refresh sends the newest refresh token; a rejection reaches every waiter |
| `auth-service.test.ts` | `signIn` posts `/api/auth/login` with the trimmed email and the password, returns the actor with its id and the tokens; each refusal code maps to its kind; `backend.bad_response` and a 500 map to `unreachable`; `signOut` posts the held refresh token and resolves on every failure; with no tokens it sends nothing; `refresh` returns tokens or a refusal |
| `refusal-kind.test.ts` | every code of 5.3 and an unknown error |
| `error-sentences.test.ts` | every code of `29` section 7's table has a sentence ending in a full stop; the `account.*`, `auth.*` and `backend.*` sentences are word for word |
| `session-slice.test.ts` (rewritten) | starts signed out with no switch; sign-in stores tokens, actor id and a raised serial; `replaceTokens` keeps the actor; `updateActor`; `endSession` leaves the notice and clears tokens, accounts, audit, events; `signOut` likewise with nothing said; a second `beginSignIn` while submitting changes nothing; a refusal keeps the gate with the sentence |
| `accounts-service.test.ts` | the list route and an unreadable row dropped and counted; create sends `{email,name,password}` with trimmed email and name; update sends only the given fields; delete route; a malformed answer is `backend.bad_response`; `409` and `422` carry their `field` |
| `accounts-slice.test.ts` | the status transitions; `upsert` keeps case-insensitive email order and replaces by id; `remove`; select-all `mixed`; ticks pruned when a row goes; reset on sign-out; `unreachable` set and cleared |
| `account-guard.test.ts` | the last enabled account: Delete and disabling refused with their reasons; two enabled: both allowed; a disabled account is always deletable; counts |
| `account-draft.test.ts` | dirty; only changed fields in the patch; trims; discard restores; `Enabled` is the inverse of `disabled` |
| `account-checks.test.ts` | required reasons in order; email shape; name 1 to 80; password 11 refused, 12 and 256 accepted, 257 refused, whitespace kept |
| `account-flows.test.ts` | the flows table of 5.5 row by row: create success and clear; `email_taken` under Email; save own email updates the actor; save own `disabled` ends the session; other account's password notice and cleared field; own password ends the session with `Password changed. Sign in again.`; delete other; delete own; `last_admin` keeps the row; a changed `serial` drops the answer; a transport failure sets `unreachable`; **no notice, event, state or error contains the password** |
| `audit-tail.test.ts` | per-entry validation; newest at the foot; de-dup by id; the 200 cap; local rows survive and interleave by time; the cursor rules and `before` = the smallest held id; `Load older` unavailable without `nextBefore` and before the first read; account sentences use the email |
| `event-sentence.test.ts` (updated) | `account.created`/`deleted` name the email, `updated` the held email or the name; inline entries replace `fixtures/audit` |
| `accounts-markup.test.ts` | New form rows in order with password type and `new-password`, no placeholder, `Create` reasons; the grid headings, ticks, state words, dimmed disabled row, last-account `Delete` disabled with its title, `never`; skeleton when loading; workspace groups, `Enabled` switch and its reasons, `Set new password` with its tooltip, toolbar with Discard and Save only, rail `‹ Accounts` |
| `no-network-storage.test.ts` (kept) + `no-fixtures.test.ts` | no `fetch(`, storage, cookie, `setInterval` or `setTimeout` in `src/admin/src`; no import of `fixtures/auth-port`, `fixtures/audit`, `fixture-switches` or `FIXTURE_ACTOR`; `Authorization` appears only in `services/api.ts` |
| updated | `events-paging.test.ts`, `gate-cover.test.ts`, `gate-markup.test.ts`, `chrome-markup.test.ts`, `settings-markup.test.ts`, `test/support/store.ts` (a `signInForTest` helper) for the new session shape and the signed-out start |

## 8. Backend changes

**None are required.** The code already has every route and rule: `POST /api/auth/login|refresh|logout`, `GET
/api/auth/me`, `GET|POST /api/admin-accounts`, `PATCH|DELETE /api/admin-accounts/:id`, `GET /api/audit`, the 15-minute
access token, the single-use refresh token, `session_version` revocation, the ten-a-minute address limit (in memory) and
the five-failure 15-minute lockout, the last-enabled-account rule, and tests for them (`test/auth.test.ts`,
`accounts.test.ts`, `audit.test.ts`). Two quirks found are handled in the admin, not changed: the audit detail of
`account.created`/`deleted` holds the email, not a name (5.7), and a disabled account's sign-in answers the same `auth.invalid_credentials` as a wrong
password (so the gate shows `The email or password is wrong.`). The coordinator runs the backend suite in the gate as always.

## 9. Failure modes

- **Two requests 401 together:** one refresh; the loser retries with the new token. A refresh token used twice would
  revoke every session, so a bug here reads as random sign-outs; its test is the guard.
- **A flaky network during a refresh ends the session** (the single-use token may already be spent): by design, `29`
  section 6.2.
- **A late answer after sign-out or a new sign-in:** every flow and the loads compare the recorded `serial`; a stale
  answer writes nothing.
- **Sign-out fails on the wire:** the session is cleared anyway; `auth.refresh_invalid` is ignored.
- **A stale list:** the last enabled account may be a different one on the server (`409 account.last_admin`): the row
  stays, the sentence says why, the list is re-read. An account deleted elsewhere (`404`): removed locally.
- **No push:** another window's disable or delete is seen on this window's next request (any `Refresh`, a save), which
  returns to the gate; nothing polls.
- **The backend is down:** the gate says `The admin backend cannot be reached.` and keeps the typed values; a signed-in
  write disables its controls with the same reason until a read succeeds.
- **The proxy points at nothing** (section 3.2): a non-envelope answer maps to `unreachable`, never a blank screen.
- **A malformed row or answer:** one row is dropped with one notice; the rest of the list stays.
- **Secrets:** tokens and passwords exist only in the store (tokens) and in a form field (passwords) and are never
  logged, stringified into a notice or put in a URL; nothing is written to the browser.
- **One address, one limiter:** both browser windows reach the backend from `127.0.0.1`, so the ten-a-minute sign-in
  limit is shared; the lockout drive in section 11 stays under it.

## 10. The worker brief (headings, `07` section 6.2)

1. **Where.** Worktree `D:\Projects\.giga-worktrees\admin-accounts`, branch `admin/accounts`, cut from `family-port` after
   Wave 3 has landed and been accepted (the coordinator commits the baseline first). May change: `src/admin/**`,
   `src/shared/http/**`; `src/shared/ui/**` only for a gap, additive and tested, named in the report.
2. **Rules.** `AGENTS.md`, `07`, `01`; this plan; the owner's: no fake features, a control works or is disabled with its
   reason, skeletons never a sentence over them, no browser storage, no timers, edit with the editor tools one file at a
   time, files at most 200 lines and tests 250, one exported component per file, `PascalCase.tsx` / `useThing.ts` /
   kebab-case, no `utils`/`helpers`/`common`, never print or copy a secret or an `.env` value, never touch the owner's
   data directory or `.env`.
3. **Role.** Implements sections 5 and 6 in the five commits of section 2. Writes AND runs its tests (section 7), the
   typecheck, the lint and `node scripts/check-rules.mjs`, all clean; does not start a server or a browser; edits no doc;
   commits on its branch, never pushes, merges or rebases; lists every gap it filled.
4. **Read first.** `AGENTS.md`; `07` sections 6.2 to 6.4; `01` sections 4, 5, 6, 8, 9; this document; `29` sections 5
   to 8 and 9.6; `34`; `28` section 7.3 and Appendix A rows 4, 12, 73; `03` sections 7.11 to 7.13; then the code:
   `src/shared/http/src/*`, `src/admin/src/{types/auth.ts,services/auth.ts,store/session-slice.ts,store/audit-slice.ts,
   hooks/useSignIn.ts,hooks/useSignOut.ts,lib/event-sentence.ts,lib/gate-state.ts}`, the Wave 3 files of section 4.2
   (the brief pastes their landed signatures), and `src/backend/src/{api/auth.ts,api/accounts.ts,services/account-service.ts,
   services/auth-service.ts,types/account.ts}` as read-only reference.
5. **Scope.** Section 6, nothing more. Off limits: `src/backend`, `src/frontend`, `src/fileserver`, root `package.json`,
   `scripts/**`, `docs/**`, every `.env`, any data folder, the other tabs' pages and fixtures.
6. **Report.** `07` section 6.4, plus: any Wave 3 signature that differed, whether it had to write `useRecordForm`, and
   every choice where this plan was silent.

## 11. The coordinator's acceptance

Pre-flight (section 3.2): the `PORT` line, the 401 through 5172. Landing: read the diff, `npm ci` where a lockfile
changed (none expected), `node scripts/check/gate.mjs`, `npm run build --prefix src/admin`.

**On the temporary backend** (section 3.3), the real built admin in Chrome at `http://127.0.0.1:8391/admin/`, at 1600 x
1000 and 900 x 640, a page-level recorder installed first (a `fetch` wrapper in the page that logs each `/api` URL and
whether it carried `Authorization`; it never writes to the server):

1. **Gate.** Starts on the full-window gate. Wrong password: `The email or password is wrong.` under Password,
   password cleared, email kept. Backend stopped (by PID): `The admin backend cannot be reached.`, values kept; restart
   it. Sign in as `zz-owner@example.test`: the shell appears, `Signed in.`.
2. **Create.** `Ctrl+6`: skeleton, then one row (`zz-owner`, state `enabled`, Delete disabled with `The last enabled
   account cannot be deleted.`). `Create` is disabled with each required reason in turn; a password of 11 characters is
   refused under Password after the press; fill `zz-second@example.test`, `Second`, a 12-character password; `Create`.
   The row is listed, the form is empty, the drawer shows `zz-owner@example.test created account
   zz-second@example.test`. Creating it again shows `Another account already uses that email.` under Email.
3. **Second window.** A second tab, sign in as the second account (its own session). Both sessions list both accounts.
4. **Disable.** In the first tab open the second account, switch `Enabled` off, `Save`: the notice says it is signed out
   everywhere. In the second tab press the list `Refresh`: the gate returns with `Your session ended. Sign in again.`;
   signing in as it now says `The email or password is wrong.`. Enable it again, save.
5. **Password.** Set a new password on the second account (`Set new password`; tooltip `Signs this account out
   everywhere`); the second tab returns to the gate; the old password is refused, the new one signs in.
6. **Last enabled.** Disable every account but the owner: the owner's row Delete and its `Enabled` switch are disabled
   with their reasons; force the server rule through a stale list (disable in tab two, delete in tab one) and see
   `This is the last enabled account; another one is needed first.` with the row kept.
7. **Own password.** As `zz-owner`, set a new password on its own row: the gate returns with `Password changed. Sign in
   again.`; the new password signs in. Own delete, once there is a second enabled account: gate with `Your account was
   deleted.` (use a throwaway third account).
8. **Lock.** With a throwaway account, five wrong passwords answer `The email or password is wrong.`; the sixth attempt,
   even with the right password, answers `This account is locked for a while after failed sign-ins.`. Eleven fast
   attempts in a minute: `Too many sign-in attempts; wait a minute.`; wait a minute before continuing.
9. **Refresh.** Restart the temporary backend (same `DATA_DIR`, same port) with a different `JWT_SECRET`: the held access
   token is dead, the refresh token is not. In a signed-in tab press `Refresh`: the recorder shows two `401`s, **one**
   `POST /api/auth/refresh`, two retries answered `200`, and the list stays. Restore the first secret afterwards.
10. **Wire and storage.** Every `/api` request except `login`, `refresh` and `logout` carried `Authorization`; in the
    page, `localStorage.length`, `sessionStorage.length`, `document.cookie` and `indexedDB.databases()` are empty before
    and after; no `Authorization` value appears in any notice or drawer row; the console has no errors or warnings.
11. **Look.** Both sizes, dark and light: the New form, the list (rows 36px, columns lined up with the header, the
    horizontal scroll inside the list only), the workspace, the armed `Delete zz-second@example.test?` re-arming after
    4 s, the skeleton, disabled tooltips; compared with the Collections window of the interface for the pattern and with the
    mockup's `accounts-index.html` and `account-workspace.html` for content. The Events drawer pages with `Load older`.

**On the real stack (read-only):** the gate renders at 5172 and in the backend window; the anonymous `GET /api/auth/me`
answers 401; **no sign-in is attempted on the owner's backend** (the coordinator holds no credentials and a wrong try
would add an audit row and a failure count to the owner's data). The owner then follows section 3.4.

Then stop the temporary backend by PID, delete its folder, confirm the owner's data folder is untouched, run `npm run
dist:win` as `07` section 6.5 requires and say plainly that nothing of this wave ships in the installer (the admin and
the backend are not in it).

## 12. Doc against code: every difference found (2026-10-17)

| # | Doc says | Code does |
|---|---|---|
| 1 | `29` 7: the layer has base `/api`, and `/healthz` is read through it with `base: ""` | `createApi` refuses any path not beginning `/api/` (it throws `TypeError`), and `base` is a prefix; the admin uses base `""` and `/healthz` cannot use this layer (Wave 7) |
| 2 | `29` 7: `ApiError { code, status, message, field? }` | `ApiError` has no `field` and `createApi` drops `error.details`; this wave adds it (5.1) |
| 3 | `29` 7 table: "the sentence the admin shows" | `errorSentence` prefers the server's message and uses the table only as a fallback and for the layer's own codes; the backend's validation sentences are generic (`The password is not valid.`), so the length rules are checked client-side first |
| 4 | `29` 6.2 and 7: a failed refresh shows `auth.refresh_invalid`'s sentence; `34`: the notice `Your session ended. Sign in again.` | decision 6: the notice always |
| 5 | `29` 6.1: the titlebar and statusbar stay at the gate; `28` Wave 2 acceptance: `Sign out` returns to the page with the chrome | `34` section 4 and the built `AppShell`: the gate owns the whole window; `29` 6.1 and 28's acceptance line are stale |
| 6 | `29` 8: `session-slice` holds `session`, `signIn(session)`, `signOut()` | built: `signedIn`, `actor`, `gate`, `beginSignIn`, `finishSignIn`, `endSession`, `signOut` (`34`); this wave adds the tokens, `serial` and the id |
| 7 | `34` 5: four refusal kinds, mapped from four codes | a dead dev proxy or a 5xx yields `backend.bad_response` or `internal.failure`; both map to `unreachable` (decision 6) |
| 8 | `29` 7: `onEvent` appends one drawer row per failed call | `RequestEvent` carries method, status, elapsed and area only, no sentence; the hook says the failure instead (decision 5) |
| 9 | `29` 11: `account.created`/`deleted` rows name `detail.name` | the backend writes `{ email }` for created and deleted, `{ name, fields }` for updated; the built `nameOf` would show the account id (5.7) |
| 10 | `29` 6.2: own password via the Accounts workspace "or `POST /api/auth/password`" | the PATCH needs no current password, the POST does (`currentPassword`); the UI has only `New password` (decision 8) |
| 11 | `29` 7 and 14: `/healthz` is read at the root | `vite.config.mts` proxies `/api`, `/live`, `/logos`, `/test` only; `/healthz` in dev returns Vite's page (Wave 7 adds the proxy) |
| 12 | `28` progress table, Wave 2 "Creates": `useRecordForm`, `useFixtureLoad`, `StateWord`-adjacent files | none of `hooks/useRecordForm.ts`, `hooks/useFixtureLoad.ts`, `components/records/StateWord.tsx` is in the tree (4.2) |
| 13 | `28` 7.2 / 9: the Accounts toolbar has no verb; ticks arm the toolbar | the mockup's Accounts list has ticks that arm nothing (decision 9) |
| 14 | `29` 9.6 / `28` 9.3: the last enabled account's Delete is guarded | the backend also refuses *disabling* it (`409 account.last_admin`), so the workspace's `Enabled` is guarded too |
| 15 | `03` 7.12: five wrong passwords lock the account | the fifth wrong answer is still `auth.invalid_credentials`; the sixth attempt, even with the right password, is `auth.locked` |
| 16 | `03` 7.12: refresh and logout are "anyone with a refresh token" | a used or revoked token on logout is `401 auth.refresh_invalid`; `useSignOut` ignores it |
| 17 | `AGENTS.md` / `29` 3.7: dev backend on 8091 | the owner's local `.env` `PORT` is stale (3001) so the admin's proxy misses it; fixed in section 3.2 |
| 18 | `03` 7.11: "an email already used is `409 account.email_taken`" | emails are compared case-insensitively (`email_key`), so `A@x` and `a@x` collide; the sort order is by that key |

## 13. Done when

The owner signs in to the real admin with their existing account, opens Accounts, creates an account with an email, a
name and a password of at least 12 characters, sees it listed and audited, and the new person can sign in; a disabled
or re-passworded account is returned to the gate on its next request; the last enabled account cannot be deleted or
disabled; a token expiring refreshes once without a visible blip; every request but the three public ones carries the
bearer; nothing is written to the browser; no fixture sign-in, drawer or switch remains; the gate, the admin and
shared-http tests pass; the coordinator's section 11 drives pass on the temporary backend; the owner's data was never
touched by verification.
