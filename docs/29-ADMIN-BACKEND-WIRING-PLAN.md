# 29 - Admin Backend Wiring Plan (Wave 0 and Waves 7 to 10 of the admin program)

> **Amended 2026-10-18 (owner):** there is no sign-in rate limit and no lockout. `auth.rate_limited` and `auth.locked`
> no longer exist; every sentence below about them, and the `locked` / `rate_limited` refusal kinds, no longer applies.

> **Superseded by `39-ADMIN-PROGRAM-ROADMAP.md` for the wave order (owner, 2026-10-17: no fixture waves).** Wave 0 is done. The request layer, the real auth port, the tokens, the
> zod schemas and the typed service stubs landed in the foundation (`07b60d7`); Waves 7 to 10 below are retired and split: Accounts and the audit log are `35`, Channels and Preview `36`,
> Providers and Titles `37`, Playlists and Jobs `38`, and account-state persistence, health and About, the README and the build/serve sweep are Wave 4 of `39`. The reference content of this
> document - the wire shapes (5), the routes (9), the Preview rules (9.7), the persistence design (12.2), the static serving (14), the differences (17) and the backend changes (18) - still governs.
> Corrections found since: the request layer is `services/session-api.ts` plus `services/api.ts` (not one file with a retry hook); the full-window gate replaced 6.1's "titlebar and statusbar stay";
> `createApi` takes only `/api/` paths, so `/healthz` needs an additive option (Wave 4).

**Status: PLAN, revised 2026-10-17 (Preview is a child window with no test page; Settings persist per account; the shared-UI
extraction is Wave 1). Nothing in this document is built, except where a section says "built" (the backend's Electron host
and its `/admin/` static serving, sections 14 and 15).** It replaces the fixtures of `28-ADMIN-VISUAL-PARITY-PLAN.md` with the
real admin backend, as `22` did for the interface. What the admin is, its pages and decisions are `26`; the look is `28`; the
shared UI and request library it is built on is `27` (**Wave 1: `27` steps 0 to 8; no admin page work starts until it has
landed and been accepted**); the backend's contract is `03` section 7 and, where the two differ, **the code wins** (section 17
lists every difference found). Governed by `00`, `01`, `07`.

The wave numbers are the program's, the same in `27`, `28` and `29`: **Wave 0** (the backend, section 19, worker B, independent,
may start at once), Wave 1 (`27`), Waves 2 to 6 (`28`), **Waves 7 to 10** (this document, worker A, after Wave 6 and Wave 0 have
landed and been accepted).

## 1. Goal and non-goals

**Goal.** Every control of `src/admin` calls the backend through one request layer and shows what it answers: sign-in with the
in-memory session, the six tabs' lists and records, every create, save, delete, rebuild, revert, sync run and password
change, the Events drawer's audit rows, the Settings window's session and about facts, **the Preview window's playback of a
saved channel**, `Choose` through the Electron preload, and **the settings and shell layout saved per signed-in account in the
backend and restored once after sign-in**. The fixtures, the fixture-load stand-in and the query switches of `28` are deleted. A
control either works against the real backend or is visibly disabled with the backend's reason.

**Non-goals.** No polling, socket or browser storage (`01` 4.4, `26` D5, D19): the page reads on mount, on a tab switch, after
its own writes and on `Refresh`. The only timers are the two the interface already names (`02` section 2.3): the 400 ms shell
write-back debounce and the 1.5 s reveal fallback (section 12.2); neither polls. Nothing is stored in the browser or in Electron's
profile. No stop-a-build route (`26` 4.12 item 7): the statusbar's `Stop` stays disabled with its reason. No streamed status, no
push channel. No test page: the backend's `/test/player.html` stays for development and the admin never uses it.

## 2. Rules that hold

`AGENTS.md`, `01` and `07` as in `28` section 2, plus: every wire value is `unknown` until Zod has validated it, and a part of
an answer the admin cannot read is one notice on the statusbar and never costs the rest of the answer (`01` section 8: the
parts of a snapshot are validated separately; an unknown extra field is ignored). Components, pages, hooks and the store never
call `fetch`; the request layer is the only caller. Application URLs are relative (`/api/...`); no backend address appears in
`src/admin` source. Tests inject the fetch and the clock and sleep for nothing (`01` section 10).

## 3. Choices made where the docs left a gap

1. **Preview** (`26` 4.5a, owner 2026-10-17). `Preview →` opens the Preview child window of `28` section 7.4 (the template's
   `ChildWindow`) on a saved channel: a 16:9 HLS video, one mono status line and a `Retry`. It is wired in section 9.7: no
   iframe, no `/test/player.html`, no `testPage` field in `/healthz`, no `TEST_PAGE` dependency (the env value stays for the
   backend's own test page only). Both channel kinds preview; a stopped or failed channel still opens it and says why.
2. **Session** (`26` D5). The access token lives in the store's session slice, in memory only. The refresh token is the backend's httpOnly `giga_refresh` cookie (`03` section 7.12); on load the app sends one `POST /api/auth/refresh` with no body behind a shimmer wall and shows the gate only if that fails. Nothing is written to `localStorage`, `sessionStorage` or IndexedDB, and the app never reads the cookie.
3. **Refresh is lazy and single-flight.** There is no timer: a request that finds the access token within `REFRESH_SKEW_MS` (30 s) of `accessExpiresAt`, or that is answered `401 auth.unauthorized`, makes one refresh through a shared promise, then retries once. The refresh token is single-use and a second use revokes every session of the account (`03` 7.12), so two requests must never refresh at once; section 6 makes that a tested rule.
4. **Titles list.** `GET /api/titles` is TMDB-backed (browse by `page`, TMDB-sized pages), so the Titles index pages with `Older` / `Newer` over `page` and `totalPages`, and the `Older` / `Newer` controls disable at the ends with their reasons. With no `TMDB_READ_TOKEN` and no manual title the read is `503 tmdb.unavailable`: the list shows its skeleton and the notice says why.
5. **Playlist Status channels.** The backend's channel answer carries `source` (the playlist's host) but not the playlist id, so the playlist's channels are the admin channels whose `source` equals its `host`.
6. **Event sentences** are built by the admin from the audit entry and the names it already holds (section 11); an entry about a record the admin has not loaded names its id.
7. **Dev ports** (section 14): Vite 5172 forwards to `ADMIN_BACKEND_URL`, default `http://127.0.0.1:8091` (`03` section 1). The owner's local `src/backend/.env` sets `PORT=3001`, which is a stale value from before the ports table (`07` 2 says fix it): the coordinator backs it up and removes that line, or sets `ADMIN_BACKEND_URL` in `src/admin/.env`.
8. **Account state** (`26` D16; section 12.2). One row per account in `admin_ui_state`, two documents (`settings`, `shell`), each written whole and independently; the last write wins per document, nothing merges between two windows; the per-tab pane records are keyed by tab (the two Channels workspaces share one pane); the events band's openness is remembered (the interface never restores its drawer; the owner's `26` 4.2 asks for it here); no workspace, scroll, fold or search text is remembered; a state write writes no audit entry (it is a preference, not an administrative change, and a pane drag would otherwise fill the log).

## 4. Dependencies

| On | What |
|---|---|
| Wave 1 (`27` steps 0 to 8), Waves 2 to 6 (`28`) | landed and accepted: the library, the pages, store slices and components wired here. The wiring waves start from `family-port` after Wave 6 |
| `27` step 5 | `@giga/http`: `createApi({ base, headers, onEvent, onUnauthorized, sentences })`, `ApiError`, the envelope schema. **Wave 7 (the request layer) depends on it**; the admin's `services/api.ts` is a thin adapter over it. Reconcile the option names with `27` when step 5 lands; if `createApi` lacks a hook (the retry after refresh), the adapter wraps it rather than the library growing an auth concept |
| `27` step 6 | the chrome slice (events, notice, `say(sentence, tone, area)`, overlay, `childBounds`): the Events drawer's rows enter through it, and the state hydration writes into it |
| `27` step 7 | the Settings frame and `ChildWindow` the Preview window and the persisted bounds use |
| `27` step 9 / `28` section 4.3 | the record pieces already used by `28` |
| Wave 0 (the backend) | the changes of section 18, made by the backend worker first: **B1 (the account state routes) before Wave 7 can pass its acceptance**, B2 (providers) before Wave 8, B3 to B5 (titles, job outcomes, audit names) before Wave 9 |

## 5. The wire shapes (copied from `src/backend/src/types` and the services, 2026-10-17)

> **Amended (owner, 2026-10-17; `36`, `40`).** No id changes: every record keeps its existing `id`. A live channel's create body no longer needs an `id`; the
> backend assigns `live-<uuid>`, as it assigns `ch_<uuid>` to stream channels. The security-question reset routes of `40` (migration `018`) join the auth routes. The
> shapes below are otherwise unchanged.

`types/admin-*.ts` already hold these shapes from `28`; the first wiring wave adds their Zod schemas under `services/schemas/`,
one file per resource (`channel-schema.ts`, `provider-schema.ts`, `title-schema.ts`, `playlist-schema.ts`, `job-schema.ts`,
`account-schema.ts`, `audit-schema.ts`, `session-schema.ts`, `health-schema.ts`, `account-state-schema.ts`). Schemas are non-strict
(unknown fields are ignored) except where a field's absence is an error and except the two account-state documents, which are strict
on the way out (the request) and tolerant per part on the way in (section 12.2).

```ts
// the envelope (types/envelope.ts)
type Success<T> = { ok: true; data: T };
type Failure = { ok: false; error: { code: string; message: string; details?: Record<string, unknown>; correlationId?: string } };
// details.field names the offending field of a 4xx refusal; message is already a plain sentence

// channels (types/channel.ts, channel-input.ts, live-stream.ts)
type ChannelState = "preparing" | "starting" | "live" | "restarting" | "stopped" | "failed";
interface BackendChannel { id; name; category; number?: string; logoUrl?: string; streamUrl: string; kind: "stream" | "live";
                           tvgId?: string; source?: string; revision: number }
interface StreamAdminChannel extends BackendChannel { kind: "stream"; enabled: boolean; editedFields?: string[] }
interface LiveAdminChannel extends BackendChannel {
  kind: "live"; enabled: boolean; mode: "loop" | "encode"; captions: boolean; variants: ("360p" | "720p" | "1080p")[];
  folder?: string; videos?: string[];                                  // exactly one of the two
  state: ChannelState; problem?: string; renditions: string[];
  playlist: { name: string; durationMs: number }[]; nowPlaying: { index: number; name: string } | null }
type AdminChannel = StreamAdminChannel | LiveAdminChannel;             // GET /api/admin-channels: { items, revision }
// paged (41 section 3.1; `limit` turns it on, every other parameter needs it; 03 section 7.2 has the parameters):
// GET /api/admin-channels?limit&offset&q&kind&origin&enabled&state&source&sort&dir
//   -> { items: AdminChannel[]; revision: number; total: number /* after the filters */; offset: number; limit: number }
// a live row's streamUrl is `<caller origin>/live/<id>/master.m3u8` (channel-views.ts); there is no `masterUrl` field
// live id: kebab-case, at most 64; number: whole 1..9999 sent as text or integer; category: News Sports Music Kids Movies Entertainment

// providers (types/provider.ts)           snake_case is the backend's own for two fields
interface BackendProvider { id: number; name; source; is_active: boolean; order: number; family: "embed" | "stream";
  movieTemplate?; episodeTemplate?; startParam?; subtitlesParam?; origin?; frameOrigins?: string[];
  messageShape?: "vidsrc-status" | "player-event"; created_at: string /* ISO */ }

// titles (services/title-overlay.ts, title-shapes.ts)
interface AdminTitleRow { id: string /* movie-603 | tv-1399 | custom-<uuid> */; kind: "movie" | "tv"; title: string; year?: number;
  rating?: number; genres?: string[]; posterUrl?; backdropUrl?; tmdbId?: number; streamUrl?; state: "synced" | "edited" | "manual"; enabled?: boolean }
// detail adds plot?, cast?: string[], runtimeMs? (movie), seasons? [{ season, episodeCount } | { season, episodes[] }], sources? TitleSource[]
// list: { items, page, totalPages, totalResults }
// stored (41 section 3.2, built; signed in, no-store, never TMDB; 03 section 7.4 has the parameters):
// GET /api/titles/stored?limit&offset&q&kind&origin&edited&enabled&sort=title|year|rating|fetched&dir
interface StoredTitleRow { id; kind: "movie" | "tv"; title: string; year?: number; rating?: number; genres?: string[]; posterUrl?;
  backdropUrl?; tmdbId?: number; streamUrl?; state: "synced" | "edited" | "manual"; enabled: boolean; editedFields: string[];
  fetchedAt: number /* when it was stored or refreshed, epoch ms */ }       // an AdminTitleRow plus fetchedAt; never seasons
//   -> { items: StoredTitleRow[]; total: number; offset: number; limit: number;
//        inventory: { movie: number; tv: number; manual: number; edited: number; disabled: number } /* the whole store */;
//        version: string /* "count:maxFetchedAt", the change marker */ }

// playlists (types/playlist.ts)
interface PlaylistView { id: number; name; host; masked; enabled: boolean; channels: number; lastSyncedAt?: number; lastOutcome?: string }

// jobs (types/job.ts)
interface JobView { id: number; name; type: "playlist" | "catalog"; enabled: boolean; schedule: string /* "6h" | "30m" | "24h" | "off" */;
  config: { playlistId; dryRun; prune } | { scope: "trending" | "popular"; kind: "movie" | "tv"; pages: number };
  playlistName?: string; running: boolean; lastRunAt?: number; lastOutcome?: string; lastCounts?: Record<string, unknown>; createdAt: number }

// accounts and session (types/account.ts)
interface AdminAccount { id; username; disabled: boolean; createdAt: number; updatedAt: number; lastSignInAt?: number; securityQuestionSet: boolean }
interface Session { accessToken; accessExpiresAt: number; refreshToken; refreshExpiresAt: number; account: AdminAccount }

// audit (store/audit-repository.ts)
interface AuditEntry { id: number; at: number; actorId?; actorUsername?; action: string; subject?; detail?: Record<string, unknown>; address?: string }
// GET /api/audit -> { items: AuditEntry[] /* newest first */, nextBefore?: number }

// health (api/health.ts, services/service-registry.ts)
{ role: "admin-backend"; version; revision: number; tmdb: "configured" | "absent"; liveChannels: number }

// account state (types/ui-state.ts, new in Wave 0, B1; field by field in section 12.2)
type TabId = "channels" | "providers" | "titles" | "playlists" | "jobs" | "accounts";
interface AdminSettings { theme: "dark" | "light" | "system"; themeAccent: "amber" | "blue" | "green" | "violet" | "rose";
                          reducedMotion: "system" | "off" | "on"; uiZoom: number /* 0.5 to 3, steps of 0.1 */ }
interface PaneState { open: boolean; width: number }
interface WindowBox { x: number; y: number; width: number; height: number }
interface AdminShell { tab: TabId; panes: Partial<Record<TabId, PaneState>>; eventsOpen: boolean;
                       windows: Partial<Record<"settings" | "preview", WindowBox>> }
// GET /api/auth/me/state -> { settings: AdminSettings; shell: AdminShell; updatedAt?: number }
// PUT /api/auth/me/state { settings?: AdminSettings; shell?: AdminShell } (at least one section) -> the same answer
```

## 6. Auth

### 6.1 The gate and the session

- **Gate.** `AppShell` shows the sign-in page (`28`) while `session` is null; the titlebar and statusbar stay, in the default theme and accent (dark, amber): the signed-in account's saved appearance is not known until it signs in. The pages are not mounted until a session exists, so no read is sent signed-out. A reload starts here.
- **Sign in.** `POST /api/auth/login { username, password }` (no token) answers a `Session`. The store keeps it in `session-slice`
  (`accessToken`, `accessExpiresAt`, `refreshToken`, `refreshExpiresAt`, `account`). On success: close nothing, mount the pages **invisible**, read the account state and apply it once (section 12.2), reveal, load the active tab (the restored one), read the audit tail (section 11), say `Signed in.`
- **Failures** (`401 auth.invalid_credentials`, `429 auth.rate_limited`, `429 auth.locked`) show their sentences under the form's Password row and on
  the notice line; the form keeps the username and clears the password. The backend answers the same sentence for an unknown username
  and a wrong password.
- **Sign out** (Settings > Session): first the pending shell write is flushed once (section 12.2; a failure is ignored), then `POST /api/auth/logout { refreshToken }`, then clear the session whatever the answer is
  (`401 auth.refresh_invalid` is ignored: the session is gone either way). Every page's loaded records are dropped, the account-state slice is reset and the appearance returns to the defaults (dark, amber, motion following the system, zoom 1), so the sign-in page never wears the previous account's theme.
- **Account facts.** The signed-in account is `session.account`; `GET /api/auth/me` (signed in) exists and is read once after a
  refresh to refresh the displayed name; it is not needed to sign in.

### 6.2 Refresh and 401

```text
request(path, init):
  if no session and the route is not public            -> ApiError auth.unauthorized (the gate is shown)
  if session.accessExpiresAt - now() < REFRESH_SKEW_MS  -> await refreshOnce()
  send with Authorization: Bearer <accessToken>
  on 401 auth.unauthorized and not yet retried          -> await refreshOnce(); send once more
  on 401 again, or refresh failed                       -> clearSession(); notice "Your session ended. Sign in again."; gate
refreshOnce(): one shared promise. POST /api/auth/refresh { refreshToken } -> new Session replaces the old whole.
  failure auth.refresh_invalid or any transport failure of the refresh -> the promise rejects; every waiter fails once.
```

- The refresh token is **single-use**; presenting a used one revokes all of the account's sessions (`03` 7.12). Hence the shared
  promise, and the rule that the refresh body is never retried: a transport failure during refresh clears the session instead.
- `now` is injected (`01` section 10). There is no `setInterval` and no polling timer.
- Changing **your own** password (Accounts workspace, or `POST /api/auth/password`) revokes your sessions, including this one: after the
  answer, the admin signs out locally and shows the gate with the notice `Password changed. Sign in again.` Changing **another**
  account's password or `disabled` revokes that account's sessions; the admin tells the person on the notice line.
- A disabled or deleted own account gives `401` on the next call and the refresh fails the same way: the gate, with
  `auth.refresh_invalid`'s sentence. A pending state write at that moment is dropped (it could not be sent).

### 6.3 Public reads

`GET /healthz` is public and read before sign-in (the gate shows the backend address and, when the backend is unreachable, the
reason). `GET /api/channels`, `/api/providers` and `/api/titles*` are public reads the interface uses; the admin uses the admin
reads below instead, which need the token.

## 7. The request layer

`src/admin/src/services/api.ts` is the only file that calls `fetch` (`01` 4.1); it adapts `@giga/http`'s `createApi`:

- **Base** `/api`; `/healthz` is read at the root by `services/health.ts` through the same adapter with `base: ""`.
- **Headers** `Authorization: Bearer <token>` from the session slice (a getter, never a captured value), `Content-Type: application/json`
  for a body.
- **Envelope.** `{ ok, data } | { ok: false, error }`; a body that is not an envelope is `backend.bad_response`; a transport failure (fetch
  rejects) is `backend.unreachable`. Both are client-side codes.
- **Schemas.** Each service module passes its Zod schema; a mismatch is `backend.bad_response` naming the path, and the part of a list
  that fails is dropped with one notice, the rest shown (`01` section 8).
- **Events.** `onEvent` appends one drawer row per failed call (area from the route, tone `warn` for 4xx, `error` for 5xx and transport)
  and one notice; a success is not an event (the audit rows tell it, section 11).
- **Errors.** `ApiError { code, status, message, field? }`; `message` is the backend's sentence when it names a field
  (`details.field`), otherwise the table below. `lib/error-sentence.ts` is the one mapping (`01` 4.1). The sentences are the backend's
  own where they are already plain:

| Code | Status | Sentence the admin shows |
|---|---|---|
| `auth.unauthorized` | 401 | Sign in to do that. |
| `auth.invalid_credentials` | 401 | The username or password is wrong. |
| `auth.refresh_invalid` | 401 | That session has ended; sign in again. |
| `auth.rate_limited` | 429 | Too many sign-in attempts; wait a minute. |
| `auth.locked` | 429 | This account is locked for a while after failed sign-ins. |
| `account.not_found` | 404 | That account does not exist. |
| `account.invalid` | 422 | the backend's sentence (names the field) |
| `account.username_taken` | 409 | Another account already uses that username. |
| `auth.reset_invalid` | 401 | That answer is not right, or the reset is not available for this username. |
| `account.last_admin` | 409 | This is the last enabled account; another one is needed first. |
| `account_state.invalid` | 422 | the backend's sentence (names the field) |
| `channel.not_found` | 404 | That channel does not exist. |
| `channel.invalid` | 422 | the backend's sentence (names the field); under that field's row |
| `channel.taken` | 409 | Another channel already has that id or number. |
| `fault.invalid` | 400 | (backend only; the admin no longer words it, owner 2026-10-17) |
| `path.invalid` | 400 | That address is not valid. |
| `media.not_found` | 404 | That part of the stream is not available. |
| `range.unsatisfiable` | 416 | That byte range is outside the file. |
| `provider.not_found` / `provider.invalid` | 404 / 422 | That provider does not exist. / the backend's sentence |
| `title.not_found` | 404 | That title does not exist. |
| `title.invalid` | 422 | the backend's sentence (names the field) |
| `title.manual` | 409 | A title made by hand has no TMDB copy to go back to. |
| `tmdb.unavailable` | 503 | The title service cannot be reached right now. |
| `playlist.not_found` / `playlist.invalid` | 404 / 422 | That playlist does not exist. / the backend's sentence |
| `playlist.unreachable` | 503 | A playlist cannot be reached right now. |
| `playlist.busy` | 409 | A playlist sync is already running. |
| `playlist.unavailable` | 500 | The playlist is not available. |
| `job.not_found` | 404 | That job does not exist. |
| `job.invalid` | 422 | the backend's sentence (names the field) |
| `job.disabled` | 422 | the backend's sentence (the reason: disabled job, missing or disabled playlist) |
| `sync.busy` | 409 | That job is already running. / A catalog sync is already running. |
| `sync.invalid` | 422 | That sync request is not valid. |
| `request.invalid` | 400 | The request was not understood. |
| `route.not_found` | 404 | There is nothing at that address. |
| `internal.failure` | 500 | Something went wrong on the server. (the correlation id goes to the drawer row) |
| `store.newer_schema`, `store.migrate`, `store.failed` | 500 | the backend's sentence |
| `backend.unreachable` | - | The admin backend cannot be reached. |
| `backend.bad_response` | - | The backend answered something this app cannot read. |

## 8. Store, load, save, delete

One store (`28` 6.1), with these slices added or changed; none holds a promise, timer or node:

| Slice | State |
|---|---|
| `session-slice.ts` | `session`, `signIn(session)`, `signOut()` (replaces the fixture actor) |
| `ui-state-slice.ts` | the account state's bookkeeping (section 12.2): `hydrationApplied`, `shellVisible`, `settingsWriteEnabled`, `shellWriteEnabled`, `committedSettings`, `committedShell`, `settingsRevision`, `savedSettingsRevision`, `applyAccountState`, `acceptSettings`, `rejectSettings`, `markShellSaved`, `resetAccountState` |
| `channels-slice.ts` | `channels: { status: "idle" \| "loading" \| "ready" \| "failed"; items: AdminChannel[]; revision }`, `ticked: ids`, `preview: { channelId, serial } \| null` |
| `providers-slice.ts`, `titles-slice.ts` (adds `page`, `totalPages`, `search`, `kinds`, `sort`), `playlists-slice.ts`, `jobs-slice.ts`, `accounts-slice.ts` | the same shape |
| `events` (the chrome slice) | audit rows and the page's own failures, newest last, at most 200, `olderCursor` |
| `health` | `{ revision, version, tmdb }` read at mount and by Refresh |

**Load.** A tab loads when it is first shown after sign-in and on its `Refresh`; staying on a tab does not reload it. A workspace
opens from the list already in the store (a click on a row), then `GET`s nothing more for channels, providers, playlists, jobs and
accounts (their list answers carry the whole record); a title's workspace reads `GET /api/titles/:id?includeDisabled=true` for the fields a list row
lacks (plot, cast, seasons, sources). A deep reload cannot reopen a workspace (no router); the tab opens on its index.

**Skeletons.** `status: "loading"` and a list with no items draw the grid skeleton in the header's columns; `failed` keeps the last items
and sets one notice, and with no last items draws the skeleton; the statusbar and tab pill stay. Writes disable with the reason
`The admin backend cannot be reached.` after a transport failure, until the next successful read.

**Save and create: refetch the record, never trust the draft.** A write answers the saved record (channels, accounts, playlists, jobs,
titles, providers), which replaces that record in the list (matched by id) and in the open workspace's draft baseline; `Discard
changes` restores the baseline. A create inserts the answer and clears the New form. No optimistic update: the buttons show
their busy state (disabled, reason `Saving.`) for the call.

**Delete: two-step, then remove from the list on the answer** (`{ id }`). A playlist delete also removes that playlist's jobs
(`playlist-service.ts` `remove`) and detaches its channels, so the Jobs and Channels lists are marked stale and reload on their
next view; the answer's `released` count goes into the notice (`Deleted IPTV main; 14 channels kept.`). A failed delete leaves the row and says why.

**Pagination.** Only Titles pages (`page`, TMDB pages of 20): `Older` raises `page`, `Newer` lowers it, each re-reads the list;
`Newer` is disabled at page 1 (`This is the first page.`), `Older` at `totalPages` (`This is the last page.`). A search, a kind
change or a sort change returns to page 1. The audit log pages with `before` (section 11).

## 9. The tabs: every route

All routes are under `/api`; all except sign-in need `Authorization: Bearer`. "Draft" is the workspace's changed fields only
(a PATCH body is `strict`: a field the route does not know is `422`, so the draft sends only what changed).

### 9.1 Channels

| Action | Route | Body | Answer |
|---|---|---|---|
| list, Refresh | `GET /admin-channels` | - | `{ items: AdminChannel[], revision }` |
| create live | `POST /channels` | `{ kind: "live", id, name, category, number?, mode?, captions?, variants?, folder }`, or the same with `videos: string[]` in place of `folder` (exactly one of the two) | `201` `LiveAdminChannel` (`state: "preparing"`) |
| create stream | `POST /channels` | `{ kind: "stream", name, category, number?, logoUrl?, streamUrl }` | `201` `StreamAdminChannel` |
| save | `PATCH /channels/:id` | changed fields of `name category number logoUrl streamUrl mode captions variants folder videos enabled` (`kind` may be echoed; `folder` and `videos` are exclusive and replace each other) | the `AdminChannel` (a live row `preparing` while it rebuilds) |
| delete | `DELETE /channels/:id` | - | `{ id }` (a synced row is really deleted; the tooltip says the next sync adds it again) |
| rebuild | `POST /channels/:id/rebuild` | - | `LiveAdminChannel`; refused `422 channel.invalid` (field `enabled`) while disabled |
| revert | `POST /channels/:id/revert` | - | `StreamAdminChannel` with `editedFields` cleared; refused (field `source`) for a hand-made row |
| (fault) | `PUT` and `DELETE /channels/:id/fault` | the backend keeps these routes for the interface's failure tests; **the admin does not call them** (removed, owner 2026-10-17) | - |

- **Required-field and number refusals** are client-side first (`lib/field-checks.ts`), then the backend's `channel.invalid` with
  `details.field`, shown under the named row. `channel.taken` (409) names no field: it was shown under Number (and Id for live); the Number row is removed (owner, 2026-10-17), so it reads on the notice line only.
- **Live states.** `preparing` and `starting` and `restarting` draw the Status group's skeleton and count in the statusbar's `N preparing`; `live` enables
  `Apply` and makes `Preview` play; `stopped` and `failed` show their word, and `failed` shows `problem` as the first Status line; a disabled channel is dimmed with `disabled`.
  The page learns of a state change only on `Refresh`, a write of its own, or the workspace's `Refresh` in the Status heading (a `GET /admin-channels` that replaces the list): no polling.
  After a save or rebuild the page does **not** wait: the answer says `preparing`, the notice says `Fixture News is preparing.` and Refresh shows `live` later.
- **`fault`** in the answer is ignored by the admin: it neither shows it nor parses it (removed, owner 2026-10-17).
- **Status playlist** rows come from `playlist[]` (name, `durationMs` as `mm:ss`); the playing row is `nowPlaying.index`.
- **Stream address** shown for a live row is the answer's `streamUrl` (built from the caller's origin, so it works from `/admin/`); the copy
  icon writes it to the clipboard (`navigator.clipboard`, guarded: a plain-http page on a LAN address is not a secure context and has none, so the notice then says `The address could not be copied.`).
- **Preview** per section 9.7. **Choose** per section 13.
- **Logo** preview is `<img src={logoUrl}>` through `LogoImage` (a live row's `/logos/<id>.png` is served by the backend; a stream row's is an external https address); a broken image shows the glyph.

### 9.2 Providers

| Action | Route | Body | Answer |
|---|---|---|---|
| list | `GET /providers` (public) | - | `{ items: BackendProvider[] }` |
| create | `POST /providers` | `{ name, source, family?, order?, movieTemplate?, episodeTemplate?, startParam?, subtitlesParam?, origin?, frameOrigins?, messageShape? }` | `201` provider |
| save | `PUT /providers/:id` | any of the same fields (**a PUT with a partial body**: absent keeps) | provider |
| delete | `DELETE /providers/:id` | - | `{ id }` |

Refusals are `422 provider.invalid` naming the field (template not https or missing `{tmdbId}`; episode template missing a placeholder; origin
not an https origin without a path; at most 8 frame origins). **Backend gaps found here (section 18):** `Enabled` (`is_active`) cannot be written by
either route today (create forces on, update keeps), and an optional field cannot be cleared (`?? current`). The `Enabled` toggle is **disabled with the reason
"The backend cannot change this yet."** until backend change B2 lands; the workspace does not pretend.

### 9.3 Titles

| Action | Route | Body / query | Answer |
|---|---|---|---|
| list | `GET /titles` | `kind=movie\|tv\|all`, `sort=newest\|oldest\|az\|year\|trending`, `genre?`, `year?`, `page`, `includeDisabled=true` | `{ items: AdminTitleRow[], page, totalPages, totalResults }` (page 1 carries the manual titles) |
| search | `GET /titles/search` | `q`, `kind=movie\|tv` (one kind), `page`, `includeDisabled=true` | the same |
| detail | `GET /titles/:id` | `includeDisabled=true` | the row plus `plot cast runtimeMs seasons sources` |
| create (manual) | `POST /titles` | `{ kind, title, year?, genres?, rating?, posterUrl?, backdropUrl?, plot?, cast?, runtimeMs?, seasons?, streamUrl?, tmdbId? }` | `201` row (`state: "manual"`, id `custom-<uuid>`) |
| save | `PATCH /titles/:id` | changed fields; `null` clears an optional one; `enabled`; `tmdbId` only on a manual title | row |
| delete | `DELETE /titles/:id` | - | `{ id }` (a synced title returns on the next sync or read; the tooltip says so) |
| revert | `POST /titles/:id/revert` | - | row refetched from TMDB; `409 title.manual` for a manual title |

- The list needs the admin's token for `includeDisabled` (a request without it ignores the flag). `kind=all` makes two TMDB reads on the backend.
- **Search** runs on Enter and on the field's own button, never as you type (a debounce would be a timer, `01` 4.4); an empty field reads `GET /titles`, otherwise `GET /titles/search`.
  The search route takes one kind, so with both Kind chips on, the page makes two calls (`movie`, `tv`) and merges the rows by title; `TitleListGroup` owns that, and its paging then follows the larger `totalPages`.
- **Genres** are a comma list in the form, sent as `string[]`; **Cast** likewise; **Runtime** is minutes in the form and `runtimeMs` on the wire (`lib/title-units.ts`, tested).
- **Seasons** of a manual series: `[{ season, episodes: [{ episode, title?, ... }] }]`; a synced series' seasons (`episodeCount`) are shown read-only.
- Body limit: a manual series can exceed the backend's 64 KiB default; see B3.

### 9.4 Playlists

| Action | Route | Body | Answer |
|---|---|---|---|
| list | `GET /playlists` | - | `{ items: PlaylistView[] }` (never the address) |
| create | `POST /playlists` | `{ name?, address, enabled? }` | `201` `PlaylistView` (name defaults to the host) |
| save | `PATCH /playlists/:id` | `{ name?, address?, enabled? }` (`address` replaces the stored one) | `PlaylistView` |
| delete | `DELETE /playlists/:id` | - | `{ id, released }` |

The address must be `https` and pass the address rule (`422 playlist.invalid`, field `address`). It is never shown back: the field shows `masked` read-only with `Replace`.
Status: Host, Channels (the admin channels with `source === host`, each a link), Last synced (`lastSyncedAt`), Outcome (`lastOutcome`).

### 9.5 Jobs (the syncs)

| Action | Route | Body | Answer |
|---|---|---|---|
| list | `GET /jobs` | - | `{ items: JobView[] }` |
| create | `POST /jobs` | `{ type: "playlist", name, enabled?, schedule?, config: { playlistId, dryRun?, prune? } }` or `{ type: "catalog", name, enabled?, schedule?, config: { scope, kind, pages? } }` | `201` `JobView` |
| save | `PATCH /jobs/:id` | `{ name?, enabled?, schedule?, config? }` (`type` never changes; `config` is merged over the job's own) | `JobView` |
| delete | `DELETE /jobs/:id` | - | `{ id }` |
| run | `POST /jobs/:id/run` | playlist job: `{ dryRun?, prune? }` once; catalog job: none | `202` `JobView` |
| playlists for the select | `GET /playlists` | - | as 9.4 |

- **Run.** A playlist job is awaited by the backend: the `202` already carries the new `lastOutcome` and `lastCounts`, so the page shows them at once. A catalog job
  is started: the `202` says `running: true`; the page marks the row `running` with the pulsing bar and shows `Started <name>.` The page learns of its end only on
  `Refresh` (the Jobs heading action) or the workspace's `Refresh` in Last run; the statusbar's `N syncing` counts jobs the last read marked `running`. No polling.
- **Refusals** show on `Run job` as its field error and on the notice line: `409 sync.busy`, `422 job.disabled` (reason in the message), `503 tmdb.unavailable`,
  `503 playlist.unreachable`, `422 playlist.invalid`, `409 playlist.busy`.
- **The toolbar's `Run job`** runs the ticked jobs one after another (not in parallel: one playlist sync at a time, `playlist.busy`); a refusal on one is reported and the rest continue.
  It is disabled with a reason when none is ticked, a ticked job is disabled or running, or its playlist is disabled (`JobView.playlistName` and the playlists list say which).
- **Schedule** is a text field; the backend normalises it (`6h`, `30m`, `24h`, `off`) and answers `422 job.invalid` (field `schedule`) otherwise. The page's own check is `^\d+[mh]$|^off$`.
- **Last run** reads `lastRunAt`, `lastOutcome`, `lastCounts`. Today a playlist job's `lastOutcome` is the word `ok` or an error message and its `lastCounts` has no refusal
  examples or created ids (section 18, B4); until fixed, the Refused and Created rows show what is present and are skeletons otherwise.
- Deleting a job changes nothing it created.

### 9.6 Accounts

| Action | Route | Body | Answer |
|---|---|---|---|
| list | `GET /admin-accounts` | - | `{ items: AdminAccount[] }` |
| create | `POST /admin-accounts` | `{ username, password }` (password 1 to 256 characters; `name` removed, owner, 2026-10-17) | `201` account |
| save | `PATCH /admin-accounts/:id` | any of `username password disabled` (`Enabled` is `!disabled`) | account |
| delete | `DELETE /admin-accounts/:id` | - | `{ id }` |

`409 account.username_taken` shows under Username; `409 account.last_admin` is the refusal of the last enabled account's Delete or disable, and the page disables those two controls
for it with the reason up front (computed from the list). `password` set on another account revokes that account's sessions.

### 9.7 Preview (`26` section 4.5a; the window's UI is `28` section 7.4)

The window opens on a **saved** channel: `preview = { channelId, serial }` is set in the channels slice by `Preview →` (the
Channels index's verb on the one ticked row, or the workspace's verb), then the one open flow becomes `preview` (the request value
and its serial, as `01` section 6 asks). There is no `<iframe>`, no `/test/player.html` and no `testPage` anywhere in this
design.

- **What is read.** On open, one `GET /admin-channels` replaces the channels slice (the list may be stale); the window finds its
  channel by id. A channel that is no longer there says `That channel does not exist.` on the status line (the existing
  `channel.not_found` sentence) and offers `Retry`, which reads again.
- **The address.** A live channel plays through its own stream address: the answer's `streamUrl` (`/live/<id>/master.m3u8`; the
  backend builds it from the caller's origin, `channel-views.ts`; `26` 4.5a calls it `masterUrl`, the wire field is `streamUrl`),
  taken as its **path on the page's own origin** (`new URL(streamUrl).pathname`), so the request is same-origin in the Vite
  development server and in production and never depends on CORS. A stream channel plays through its `streamUrl` as answered
  (an external https address; a refusal by that origin shows as the player's error).
- **The player.** `services/preview-player.ts` (at most 90 lines; pure of React, fetch-free: it drives the `<video>` and hls.js)
  takes the same decisions as the interface's `StreamPlayerController` (`src/frontend/src/services/stream-player.ts`, reached from
  `components/live/LivePlayer.tsx` through `hooks/useStreamPlayer.ts`, with the engine wrapper `services/stream-player-engine.ts`
  and `styles/video.css`): **hls.js whenever `Hls.isSupported()`, the browser's native HLS only as the fallback**
  (`canPlayType("application/vnd.apple.mpegurl")`), else the error `This browser cannot play HLS streams.`; muted; the native
  controls; no quality, track, latency or caption preference (the interface's controller has them, the Preview does not need
  them, so the controller itself is not copied). The admin adds **no new package**: `hls.js` (^1.7.3, the interface's pin) is
  already in `src/admin/package.json` from the clone, and the plan keeps it where it earlier planned to remove it.
  `hooks/usePreviewPlayer.ts` owns the instance for the window and destroys it on unmount.
- **The status line** (`lib/preview-state.ts`, built in `28`) takes, from the channel and the player: the state word and `problem`
  of a live channel, and the player's error. Player errors, mapped from hls.js: a fatal network error on the manifest
  (`manifestLoadError`, `manifestLoadTimeOut`, `manifestParsingError`) is `manifest failed`; any other fatal network error is
  `unreachable`; a fatal media error, or the video element's own error, is `media error`.
- **When it attaches.** A live channel attaches only while `state` is `live` or `restarting`; `preparing` and `starting` show the
  skeleton and attach nothing; `stopped` and `failed` attach nothing and the line says why (`failed` with its `problem`). A stream
  channel always attaches. A state change is seen only on `Retry`: no timer, no polling.
- **`Retry`** reads `GET /admin-channels` once, updates the slice, and, when the channel is then attachable, re-attaches the player
  (`StreamPlayerController.retry` does the same on its own address). It is shown when the state is `failed` or `stopped`, or the
  player has an error.
- **Close.** The window's close (the `X`, `Escape`, or another flow replacing it) calls the player's `detach()` first: the engine
  is destroyed, the video paused, its `src` removed and loaded empty, so playback stops at once, then the flow closes. Unmounting
  destroys again if it is still alive.
- **The disabled reasons.** The index verb: `Tick a row first`, `Tick only one row`. The workspace verb: `Save the channel first`
  while the draft is dirty. A New form is the index's, not a workspace, so it never gates the verb.
- **Bounds.** The window's box is remembered with the other work windows (`shell.windows.preview`, section 12.2).
- **Tests.** Section 19, Wave 8.

## 10. Live-channel flows

1. **Create a live channel** (New form `Create`): `POST /channels`; the answer (`preparing`) is inserted; the notice reads `<name> is preparing.`; the statusbar counts it.
   A source the engine cannot read is not a create error: the channel becomes `failed` with a `problem` the next read shows.
2. **Edit a source** (Folder, Videos, mode, captions, qualities): Save sends the changed fields; the answer is `preparing`; Status shows its skeleton until Refresh.
3. **Rebuild** re-reads a folder; the old stream keeps playing until the new is ready (backend comment); the page shows `preparing`.
4. **Faults** are in memory on the backend and vanish on its restart; the admin has no fault control (removed, owner 2026-10-17).
5. **Restart of the backend stops every live channel until it rebuilds** (`26` D4): the admin shows them `preparing` on the next read; nothing special is coded.
6. **Disabling** a live channel stops it (`stopped`); enabling starts it.

## 11. The Events drawer

- **Audit rows.** `GET /audit?limit=50` is read after sign-in, when the drawer opens, after each of the page's own writes (once, `limit=10`), and by `Refresh`; it returns newest first. The drawer stores rows
  **oldest first, newest at the foot** (it reverses the page), de-duplicated by `id`, at most 200. `Load older` reads `GET /audit?limit=50&before=<smallest id held>` and prepends; it is
  disabled with `No older events.` when the last answer had no `nextBefore`. `Clear` empties the list on screen only.
- **Sentence and tone** (`lib/event-sentence.ts`, built in `28`, unchanged): `actor = actorUsername ?? "system"`; `<actor> <verb> <area> <name>` where the name is `detail.name` (created, deleted), else the
  name the admin holds for `subject`, else the id. Actions to area and verb:

| Action | Area | Sentence | Tone |
|---|---|---|---|
| `auth.login` / `auth.logout` | Session | `<actor> signed in` / `signed out` | info |
| `auth.login_failed` | Session | `Sign-in failed for <detail.username>` | warn |
| `auth.password_changed` | Session | `<actor> changed a password` | info |
| `account.created` / `updated` / `deleted` | Account | `<actor> created / updated / deleted account <name or id>` | info |
| `channel.created` / `updated` / `deleted` / `rebuilt` / `reverted` | Channel | `<actor> created / updated / deleted / rebuilt / reverted channel <name>` | info |
| `channel.fault_set` / `fault_cleared` | Channel | `<actor> applied fault <detail.fault> to <name>` / `cleared the fault on <name>` | info |
| `channel.imported` | Channel | `<actor or system> synced channels: <counts from detail>` | info (warn when `detail.refused > 0`) |
| `provider.*` | Provider | as channel | info |
| `title.*` | Title | as channel (`detail.title`) | info |
| `playlist.*` | Playlist | as channel (`detail.host`) | info |
| `job.created` / `updated` / `deleted` | Job | as channel | info |
| `sync.started` | Job | `<actor or system> started a catalog sync` | info |
| any action with a failure word in its `detail` (`detail.outcome` of a failed sync) | by prefix | the outcome sentence | error |

  Audit `updated` entries carry only the changed field names and the subject id (B5 adds the name); the admin supplies the name from its lists. A write of the account state is **not** audited (section 3, item 8), so it has no row.
- **The page's own REST events.** A failed call adds a `Connection` or area row (section 7); a success adds none (the audit row is the success). The notice line says each outcome in one sentence.
- The statusbar `Events` count and the drawer's `N events` are the held rows.

## 12. Settings, About, Session, and their persistence

### 12.1 The three pages

- **Appearance** is the store's (`28`): each choice applies at once and is saved by the write-back of section 12.2.
- **Session** shows `session.account.username` (no `name`: removed, owner, 2026-10-17), and `Sign out` (6.1).
- **About** shows the app version (`__ADMIN_VERSION__` defined by Vite from `package.json`), the backend's `version` and `revision` from `GET /healthz`, the backend address (`location.origin`),
  `TMDB: configured / absent`, and the runtime (`Electron` when `window.adminHost` exists, else `Browser`). Facts that failed to load draw the dash and a skeleton, never an error sentence.

### 12.2 Persistence: the account state (decided, owner 2026-10-17, `26` D16 and 4.2)

The admin saves its settings and shell layout the way the interface does, to its own server: **per signed-in account**, in the
backend, behind `GET /api/auth/me/state` and `PUT /api/auth/me/state`. Nothing is stored in the browser or in Electron's
profile (`01` 4.4). The pattern is the interface's hydration and write-back (`02` section 2.3, `22` section 5: `useAppHydration`,
`useShellWriteback`, `useSettingsWriteback`, `store/shell-hydration.ts`, `store/settings-state.ts`, `services/shell-state.ts`,
`services/settings.ts`, all read for this section), adapted to two whole documents.

**The routes** (signed in; any account's own row only; the principal is the token's account):

| Route | Behaviour |
|---|---|
| `GET /api/auth/me/state` | `{ settings, shell, updatedAt? }`. With no row the defaults and no `updatedAt`. A stored document that no longer reads (an older shape) is answered as that document's defaults and logged, never a `500` |
| `PUT /api/auth/me/state` | body `{ settings?, shell? }`, at least one; each present section replaces that stored document **whole**; an absent section is untouched; answers the same shape as the `GET` (the stored state). Unknown keys anywhere are refused: `422 account_state.invalid` naming the field |

Both answers are `no-store` already (`isPrivateRoute` covers `/api/auth`). Body limit: the default (the documents are under 2 KiB).

**The `settings` document** (the interface's `/api/settings` key names for the same four settings, `03` section 3.2):

| Field | Type and values | Default | Remembered for |
|---|---|---|---|
| `theme` | `"dark"` \| `"light"` \| `"system"` | `"dark"` | Settings > Appearance > Theme |
| `themeAccent` | `"amber"` \| `"blue"` \| `"green"` \| `"violet"` \| `"rose"` | `"amber"` | Accent |
| `reducedMotion` | `"system"` \| `"off"` \| `"on"` | `"system"` | Reduce motion (Follow system, Off, On) |
| `uiZoom` | number from 0.5 to 3 in steps of 0.1 (`Math.round(v * 10) / 10 === v`) | `1` | UI zoom (`Ctrl+0` resets it) |

**The `shell` document:**

| Field | Type and values | Default | Remembered for |
|---|---|---|---|
| `tab` | `"channels"` \| `"providers"` \| `"titles"` \| `"playlists"` \| `"jobs"` \| `"accounts"` | `"channels"` | the last tab; restored to that tab's **index** (a workspace is never restored: there is no router) |
| `panes` | object with at most the six tab ids as keys, each `{ open: boolean, width: integer 120 to 800 }` | `{}` (a missing tab is open at 240) | each tab's workspace rail: open or collapsed, and its width. A saved width is clamped to the tab's limits (190 to 380) when applied. The two Channels workspaces share the Channels pane |
| `eventsOpen` | boolean | `false` | the Events band open or closed |
| `windows` | object with at most the keys `settings` and `preview`, each `{ x, y, width, height }` of integers 0 to 20000 (width and height at least 1) | `{}` | the work windows' last place and size; an opened window is put back inside the main window by the window's own clamp |

Not remembered, by decision: the open workspace and its draft, selections and ticks, search text, sort and page, folds, scroll
positions, the events list, notices.

**Schemas.** Zod on both sides, strict (`.strict()` on every object, so an unknown key is refused). The backend's are the
authority (`src/backend/src/types/ui-state.ts`: `AdminSettingsSchema`, `AdminShellSchema`, `UiStatePutSchema`, with the
defaults in `constants/ui-state.ts`); the admin's mirror them in `services/schemas/account-state-schema.ts`. On the way **in** the
admin validates the two parts separately (`01` section 8): a part that does not read is that part's defaults plus one notice
(`Some saved state could not be read: settings.`) and never costs the other part.

**Backend changes (Wave 0, B1):** section 18.

**Frontend, files (Wave 7), adapted from the interface:**

| File | Role |
|---|---|
| `services/account-state.ts` | `readAccountState(signal)` (parts validated separately, `unreadable` listed) and `writeAccountState(body)` over `services/api.ts` |
| `lib/account-state-map.ts` | pure: `settingsOf(state)`, `shellOf(state)` (the projections that are written), `sameSettings`, `sameShell`, `applyToStore(...)` input shapes, and the pane-width clamp against `constants/tabs.ts` |
| `store/ui-state-slice.ts` | the bookkeeping of section 8; `applyAccountState` (apply once), `acceptSettings`, `rejectSettings`, `resetAccountState` |
| `hooks/useAccountHydration.ts` | `useAppHydration` for the account state: read once after sign-in, apply once, reveal |
| `hooks/useShellWriteback.ts` | `useShellWriteback`: `startShellWriteback(deps)` with an injected scheduler, the 400 ms debounce |
| `hooks/useSettingsWriteback.ts` | `useSettingsWriteback`: `startSettingsWriteback(deps)`, serialised, rolled back on a refusal |
| `components/session/SessionState.tsx` | renders nothing; calls the three hooks; `AppShell` mounts it only while a session exists, keyed by the account id, so signing in as another account starts clean |

**Hydration (once, after sign-in).** Before it, the defaults apply (the sign-in page is dark and amber). After `Sign in` answers:

1. The signed-in pages mount **invisible** (the titlebar and statusbar stay); `readAccountState` runs. A 1.5 s fallback
   (`HYDRATION_FALLBACK_MS`) reveals the pages with the defaults if the answer is late; **nothing is written back until the saved
   state has been applied**, so the defaults can never replace what was saved, and the answer still applies whenever it arrives.
2. The answer is applied **once** per sign-in (`hydrationApplied`): theme, accent, motion and zoom into the chrome slice; the tab
   into the workspace slice; each tab's pane into the panes slice (clamped); `eventsOpen` into the chrome slice; each saved window
   into `childBounds`. The bounds are applied through the chrome slice's `rememberChild`, and the baselines are then set from the
   applied state, so applying causes no write.
3. The pages are revealed two animation frames later, after the panes have settled; the active tab's list loads (section 8).
4. A later read never re-applies; there is no second read in a session.
5. **A failed read** (transport, `401` after the refresh failed, an answer that is not an envelope): one notice (`Your settings
   could not be loaded; changes will not be saved this session.`), the defaults stay, and write-back stays **off** for the session
   (a whole-document write of defaults would overwrite the saved state). The next sign-in reads again.

**Write-back (the interface's rules).** A change is committed on change; one request at a time per document; never before
hydration.

- **Settings** (`startSettingsWriteback`): on a change of the projection, `PUT { settings }` with the whole four-field document.
  Requests are serialised; a change that arrives while one is in flight is coalesced into the next. The answer is accepted as the
  committed baseline (`acceptSettings`). On a refusal (`422`, or any failure) the fields **roll back to the committed baseline**
  unless a newer local change exists (that one is already queued), and one warn notice says the backend's sentence. There is no
  timer.
- **Shell** (`startShellWriteback`): the projection `shellOf(state)` is compared with the last queued one by value; a change
  schedules `PUT { shell }` **400 ms** after the last change (`SHELL_WRITE_DELAY_MS`), one in flight at a time, the latest wins. On a
  refusal one warn notice; the local layout is **kept** (it is the person's screen, not a draft) and the next change writes
  again. Projections are used instead of revision counters so the library's chrome actions (`toggleEvents`, `rememberChild`) need no
  change.
- A successful write says `Settings saved.` or `Layout saved.` on the notice line, as the interface does.
- Both hooks use an injected scheduler and clock, so the tests drive them with fakes (`01` section 10). The two timers
  (`HYDRATION_FALLBACK_MS`, `SHELL_WRITE_DELAY_MS`) are the only timers in the admin besides the fixture stand-ins `28` deletes; the
  source-scan test (section 19) names the two hook files as the allowed users of `setTimeout`.

**Stale writes (two windows).** The state is read once per sign-in, so two windows on the same account do not follow each other. Each
section is written whole and the **last write wins**: if window A changes the theme and window B then changes its zoom, B's next
settings write carries B's theme and replaces A's. Nothing merges and nothing is refused as stale; this is one person with two windows,
and a reload re-reads the stored state. The answer to each write re-aligns that writer's committed baseline. Shell and settings
are independent documents, so a pane drag in one window never overwrites an appearance change made in the other.

**Sign-out, and signing in as another account.** Sign-out flushes the pending shell write once (a failure is ignored), logs out, then
`resetAccountState` clears `hydrationApplied`, the baselines and both write switches, and puts the appearance, the tab, the panes,
the events band and the window bounds back to the defaults. `SessionState` unmounts with the session, so no write-back survives it.
Signing in as another account mounts a fresh `SessionState` (keyed by the account id) and hydrates from **that** account's row; the
two accounts never see each other's state. A session that ends by itself (a `401` the refresh cannot repair) drops the pending
write, since it could not be sent.

**On the Electron host.** `window.adminHost.setOverlay` follows the theme: `useCaptionOverlay` (`28`) runs when `theme`, `themeAccent`
or `uiZoom` change, so it fires when the hydration applies a saved light theme and again when sign-out resets to the defaults; it
reads `--color-panel` and `--color-faint` from the document after `useTheme` has stamped the attributes. Before sign-in the window
is dark and the strip is dark.

### 12.3 Doc against code for this section

`03` section 7.9 lists no `admin_ui_state` table and section 7.12 no state routes; they are added by Wave 0's landing (section 22).
The interface never restores its Events drawer (`02` section 2.3, item 3); the admin does, by the owner's `26` 4.2.

## 13. `Choose` and the Electron preload

`services/admin-host.ts` (built in `28`) wraps `window.adminHost`: `hostAvailable()` is `typeof window.adminHost?.chooseFolder === "function"`; `chooseFolder()` resolves the chosen absolute path or `null`.
The backend's host (built, section 14) opens `dialog.showOpenDialog({ properties: ["openDirectory"] })` over its window and answers the first path; the IPC checks that the sender is the main frame at the backend's origin or the Vite origin.

- `FolderRow` `Choose` writes the path into the field only; it does not save. A `null` (cancelled) changes nothing.
- In a plain browser (`window.adminHost` undefined) the field stays a typed path and `Choose` is visibly disabled: `Folders can be chosen only in the backend's own window; type the path.`
- **`Choose` appears only on Folder rows.** The preload exposes exactly `chooseFolder` and `setOverlay` (a directory picker); a file picker is not in this plan. So the Videos list's add row is a path field and `Add`, with no `Choose`
  (`26` 4.5 and the mockup draw a file `Choose` there; `28` section 6.1 `VideoList` is a field and `Add`). A person lists videos by typing paths, or uses the Folder source.
- `useCaptionOverlay` (built in `28`) calls `adminHost.setOverlay` with the theme's bar colours and the zoomed height; refused off Windows.

## 14. Static serving, ports, the Electron host (built)

**The Electron host** (`src/backend/src/app/`, commit `fd1756d`): `main.ts` makes one `BrowserWindow` (`titleBarStyle: hidden` with the same `titleBarOverlay` the fileserver uses, `contextIsolation`, no node integration,
`sandbox: true`, minimum 900 x 640, `show:false` until `ready-to-show`); `backend-host.ts` starts the backend in-process (`buildApp()`, `listen` on `config.HOST`/`PORT`) or, when `/healthz` already answers with `role: "admin-backend"`
at that address, **attaches** and stops nothing on quit; `load-env.ts` reads `.env` and `dev.env` (development) or `production.env` and `.env` (`--production` or packaged) before `config.ts` is parsed, as `npm run dev` and `npm start` do;
`guards.ts` and `navigation.ts` keep every frame on the backend's origin and the Vite origin and deny new windows; `native-dialog.ts` and `window-overlay.ts` answer the two IPC channels `admin:choose-folder` and `admin:set-overlay`
after `trust.ts` has checked the sender; `preload.cts` exposes exactly `window.adminHost.{chooseFolder, setOverlay}`. The debug port is **9223** unpackaged. Scripts in `src/backend/package.json`: `dev:app` (build, then
`electron .`), `dev:stack` (the same with `--wait-vite`, which waits up to 30 s for Vite on 5172), `start:app` (`electron . --production`). `npm run dev` and `npm start` are unchanged and stay headless. `electron` is a pinned
devDependency (`^42.8.0`, the fileserver's). The rule checker still forbids Electron outside `src/fileserver/src/app`; the one-line change is the coordinator's (`28` section 14).

**The window's page.** Unpackaged and Vite answering on `http://127.0.0.1:5172/admin/`: that URL (edits reload in place); otherwise the backend's own `/admin/`; a missing build is an error message, not a window of JSON.

**Static serving** (`api/admin-static.ts`, `services/admin-static-service.ts`; verified, with additions in `fd1756d`): `GET /admin` redirects to `/admin/`; `GET /admin/*` serves a file under `ADMIN_DIST` (default `src/admin/dist`) with its type
(including `woff2`, `woff`, `ttf`, `otf`, `svg`, `png`, `gif`, `avif`, `wasm`), `Cache-Control: public, max-age=31536000, immutable` under `assets/` (Vite fingerprints) and `no-cache` otherwise, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: same-origin`; a path with no extension that names no file answers `index.html` (a reload or deep link opens the app); a missing file with an extension is the JSON `404 route.not_found`; any path with `..`, a backslash, a NUL
or a dot-file part is `404`; with no `index.html` in the folder nothing is served, and a build made after the backend started is served without a restart. Tests: `test/live-admin-static.test.ts` (existing, extended). Vite's `base: "/admin/"` makes
every built asset address `/admin/assets/...`, which is exactly what this serves.

**Ports.** Development: Vite 5172 (the admin), backend 8091; production: the backend 8191 serving `/admin/`. A new `5272` is the admin's `vite preview`, proxying to the backend like dev. `03` section 1 and `AGENTS.md` gain the 5172 row (`28` section 14).

**CORS.** None: in production the admin is served by the backend (same origin); in development Vite forwards `/api`, `/live`, `/logos` and `/test` (same origin to the browser). The backend's `CORS_ORIGINS` stays empty. A hand-run page on another origin
(for example `http://localhost:5172` rather than `127.0.0.1`) would be cross-origin to nothing, since the proxy makes every call same-origin; only a bare backend address typed into a browser tab with a different admin origin would need `CORS_ORIGINS`. The Preview window loads a live channel by its path on the page's origin (9.7) for the same reason.

**`npm run dev`.** Proposal for the root `package.json` (the coordinator applies it). The window attaches to a backend that already answers, but in a concurrent start the attach check can run before the headless
backend listens, and the window would then start a second backend on the same port. So the stack **replaces** the headless backend entry with the window's, which owns the backend: in `dev`, change the `concurrently` list to
`--names backend,frontend,electron,admin --prefix-colors cyan,magenta,yellow,green` with the commands `"npm run dev:stack --prefix src/backend"` (the backend inside Electron on 8091, opening the admin on Vite once it answers), `"npm run dev --prefix src/frontend"`,
`"npm run dev --prefix src/fileserver"` and `"npm run dev --prefix src/admin"`; `kill-ports` gains `5172`; a root `dev:headless` keeps the old backend command for automation that does not want a window. This changes what `npm run dev` starts
(a second Electron window, with the debug port 9223), so it is the owner's call; the default taken is the replace. `dist:win` is unchanged: the backend and the admin are not in the desktop installer.

## 15. Empty, loading and failure states

As `28` section 9, item 10, and `26` 4.10: skeletons in the page's own shape for loading and empty; a failed read keeps the last good content and sets one notice; an unreachable backend leaves the pill and statusbar in place, keeps the last content and
disables writes with `The admin backend cannot be reached.`; no sentence over a skeleton; no empty-state card. The sign-in gate shows the same shape while `GET /healthz` is unreachable (the Sign in button works; its failure reads `backend.unreachable`). The Preview window's stage is a skeleton while the channel is preparing or starting.

## 16. Test strategy

- **Workers** write fast `node:test` tests under `src/admin/test/` with an injected fetch (a function returning envelopes), an injected clock and an injected scheduler; nothing sleeps, no server starts. They do not run them (`07` 6.3).
- **Coordinator, automated.** The gate (`node scripts/check/gate.mjs`) runs the admin's typecheck, lint and tests, and the backend's tests, on free ports and temporary `DATA_DIR`s.
- **Coordinator, the real wire.** Against a backend on a free port with a temporary `DATA_DIR`, `JWT_SECRET` and a bootstrap admin (no owner data): sign in, create one of each record through the same HTTP calls the admin makes, run a playlist job against a local test playlist,
  start a catalog job with a stubbed TMDB base, apply a fault to a seeded live channel, change a password and watch the old session die, read `/audit`, `PUT` and `GET` the account state for two accounts and watch them stay apart. **The gate's live smoke** (`scripts/check/live-smoke.mjs`) finds the backend by `GIGA_SMOKE_BACKEND`, else the `PORT` in `src/backend/.env` or `dev.env`, else 8091 (it defaults to 3001 today: B6).
- **Coordinator, visual.** On the owner's real stack (`07` 4, 5): the admin in a Chrome tab on 5172 and in the backend's Electron window through port 9223 (made visible), at 1600 x 1000 and 900 x 640, comparing to `28`'s fixtures-driven result for the same states and to the template's equivalent screen in the interface (5171); console and network clean; every request carries the bearer token and none goes to a host other than the backend.
  The coordinator changes only UI state and puts it back; it never deletes or overwrites the owner's records without asking (`07` 4); a write drive uses records it creates and removes, named `zz-drive-...`, after asking. **The account state is UI state:** the drive notes the signed-in account's saved appearance, tab, panes, band and bounds before it starts and restores them at the end.

## 17. Doc against code: every difference found (2026-10-17)

| # | Doc says | Code does |
|---|---|---|
| 1 | `03` 7.2b `PUT /api/providers` changes any field incl. active | `ProviderPatchSchema` has no `enabled`/`is_active`; create forces on; update keeps `current.is_active`; an optional field cannot be cleared (B2) |
| 2 | `26` 4.9c a playlist job's Last run shows refusal examples and created ids, and an outcome sentence | `lastOutcome` is `"ok"` or the error message; `lastCounts` is `{ created, updated, skipped, refused, removed, kept }` only (B4) |
| 3 | `26` 4.9b Titles workspace shows which fields were edited | the admin title view carries `state` but not `editedFields`; `GET /api/channels` stream rows do carry `editedFields` (B5) |
| 4 | `26` 4.9 Events rows read "ada updated channel Fixture News" | `*.updated`, `*.reverted`, `channel.rebuilt`, `channel.fault_*` audit entries carry the subject id and changed field names, not the record's name (B5) |
| 5 | `26` 4.5a Preview plays a live channel through its `masterUrl` | no admin answer has a `masterUrl`; the live row's `streamUrl` is `<caller origin>/live/<id>/master.m3u8` (`channel-views.ts`); the Preview uses `streamUrl` (9.7) |
| 6 | `03` 7.4 lists titles as `BackendTitle` | the admin reads add `state`, `enabled` (with `includeDisabled` and a token) and detail adds `sources`; manual titles carry `custom-<uuid>` ids and `seasons` with `episodes[]` |
| 7 | `03` 7.2c playlist sync is `POST /api/playlist-sync` | still present as a thin wrapper; the admin uses jobs; the wrapper does not record on a job |
| 8 | `26` 3.3 `POST /api/channels/:id/rebuild` "re-reads a folder source" | also refuses a disabled channel (`422 channel.invalid`, field `enabled`) and a stream channel |
| 9 | `26` 4.6 the Videos list adds a file with `Choose` | the preload exposes a folder picker only (`properties: ["openDirectory"]`), so `Choose` on a file is not available (section 13) |
| 10 | `03` 7.10 "account routes" are no-store | `isPrivateRoute` covers `/api/auth`, `/api/admin-accounts`, `/api/audit`, `/api/admin-channels`; `/api/jobs` and `/api/playlists` are not (they hold no secret); the new `/api/auth/me/state` is covered by the `/api/auth` prefix |
| 11 | the brief expected a `GET /api/me` gap | `GET /api/auth/me` exists (`api/auth.ts`); no gap |
| 12 | `03` 7.11 `PATCH` accepts `password` | yes; a change to another account's `password`/`disabled` revokes its sessions, and the answer does not say so |
| 13 | `01` 4.3 body limit | `REQUEST_BODY_LIMIT_BYTES` is 65,536 for every route except channel writes (256 KiB): `POST/PATCH /api/titles` carry `seasons` up to 100 seasons by 500 episodes and can exceed it (B3) |
| 14 | `scripts/check/live-smoke.mjs` | defaults the backend to `http://127.0.0.1:3001`, the owner's stale `.env` port (B6) |
| 15 | `AGENTS.md` ports | the backend's dev port is 8091; the owner's local `.env` sets `PORT=3001` (a stale value) and `src/backend/.env` is the coordinator's to fix (section 3, item 7) |
| 16 | `03` 7.9 lists the backend's tables; 7.12 its auth routes | neither lists `admin_ui_state` or `GET`/`PUT /api/auth/me/state`, which the owner decided (`26` D16) and Wave 0 builds (B1) |
| 17 | `01` 4.4 "no ... timers" in any program | the interface already runs two named timers (the 400 ms shell write-back and the 1.5 s hydration fallback, `02` 2.3); the admin takes the same two (12.2); `01` 4.4 must name them |
| 18 | (2026-10-17) section 7: `services/api.ts` adapts `createApi` and retries after a refresh | built as `services/session-api.ts` (pure logic and tests) plus `services/api.ts` (store wiring); the foundation's `store/audit-slice.ts` also does I/O, against `01` section 6 (moved to a hook by `35`) |
| 19 | (2026-10-17) section 9.2: the provider save is a "PUT with a partial body" | the shared `RecordService.update` is PATCH-shaped in its doc; `37` sends the `PUT` itself |

## 18. Backend changes the wiring needs

Made by the backend worker first (Wave 0 below), each with a test in `src/backend/test` (written, not run).

| # | Change | Files |
|---|---|---|
| B1 | **Per-account UI state.** Migration `017-admin-ui-state.sql` (the last migration today is `016-providers-no-api-key.sql`): `CREATE TABLE admin_ui_state (account_id TEXT PRIMARY KEY REFERENCES admin_accounts (id) ON DELETE CASCADE, settings TEXT NOT NULL, shell TEXT NOT NULL, updated_at INTEGER NOT NULL)`, both columns JSON text. `GET` and `PUT /api/auth/me/state` (12.2): signed in, the token's own account only; a missing row answers the defaults; `PUT` takes `{ settings?, shell? }` (at least one) and replaces each present document whole, in one transaction, with `updated_at` the service's `now()`; unknown keys refused (`.strict()` on every object); a refusal is `422 account_state.invalid` with `details.field` (`parseInput`'s refusal argument); a stored document that no longer parses is answered as the defaults and logged. **No audit entry** (section 3, item 8). Cascade: deleting an account deletes its row. Registered after `registerAuth`; no-store through the existing `/api/auth` prefix; no change to CORS (`PUT` is allowed) or the body limit | `store/migrations/017-admin-ui-state.sql`, `store/ui-state-repository.ts` (SQL only here: `find(accountId)`, `upsert(accountId, sections, now)`), `store/store.ts` (`uiState`), `types/ui-state.ts` (the schemas and types of section 5), `constants/ui-state.ts` (defaults, pane width 120 to 800, window coordinate 0 to 20000), `constants/errors.ts` (`accountStateInvalid`), `services/ui-state-service.ts` (`read(principal)`, `write(principal, body)`), `services/service-registry.ts` (`uiState`), `api/account-state.ts` (parse, one service call, the envelope), `app.ts` (register), `test/` |
| B2 | Providers: `ProviderInputSchema`/`ProviderPatchSchema` accept `enabled: boolean`; `create` and `update` write `is_active` from it; `update` clears an optional field when the patch carries `null` (the patch schema allows `null` for the optional fields); `BackendProvider` keeps `is_active` | `types/provider.ts`, `services/provider-service.ts` |
| B3 | `POST /api/titles` and `PATCH /api/titles/:id` take the channel writes' larger body limit (`CHANNEL_BODY_LIMIT_BYTES`) | `api/titles.ts`, `constants/limits.ts` |
| B4 | A playlist job's `lastOutcome` is a sentence (`Synced: 3 created, 12 updated.`, `Dry run. ...`); its `lastCounts` adds `refusalExamples` (at most 10 strings) and `createdIds` (at most 10 ids) | `services/job-runner.ts`, `store/job-repository.ts` |
| B5 | Audit `detail` of `*.updated`, `*.reverted`, `channel.rebuilt`, `channel.fault_*` adds `name`; the admin title view adds `editedFields` | `services/channel-service.ts`, `provider-service.ts`, `playlist-service.ts`, `title-records.ts`, `title-overlay.ts` |
| B6 | `scripts/check/live-smoke.mjs` finds the backend by `GIGA_SMOKE_BACKEND`, else the `PORT` line of `src/backend/.env`, then `dev.env`, else `http://127.0.0.1:8091` | `scripts/check/live-smoke.mjs` (the coordinator's; named here so a worker's brief can carry it, `07` 2) |
| B7 | (optional, not required) a route that lists the stored titles only (edited and manual), so the Titles tab works with no TMDB token | decided later; not in the waves |

There is no `testPage` field in `/healthz` and none is added: the Preview window needs no such answer.

## 19. Waves

One worker per real sub-project (`07` 6.1): **B** owns `src/backend` (Wave 0), **A** owns `src/admin` (Waves 7 to 10) in one worktree. The coordinator lands each, runs the gate and the real checks, and visually accepts Waves 7 to 10 at both sizes.
A wave's worker: `npm ci` in its own worktree, typecheck, lint, `node scripts/check-rules.mjs`, all clean; tests written, not run; one commit per wave; never pushes; reports per `07` 6.4.

### Progress and files by wave (the coordinator keeps the status column current)

| Wave | Status | Landed in | Creates | Updates | Deletes |
|---|---|---|---|---|---|
| 0 | Done | `5749213`, `6432525`, `9045a8d` | `store/migrations/017-admin-ui-state.sql`, `store/ui-state-repository.ts`, `types/ui-state.ts`, `constants/ui-state.ts`, `services/ui-state-service.ts`, `api/account-state.ts`, and their tests (section 18, B1) | `store/store.ts`, `constants/errors.ts`, `services/service-registry.ts`, `app.ts` (B1); `types/provider.ts`, `services/provider-service.ts` (B2); `api/titles.ts`, `constants/limits.ts` (B3); `services/job-runner.ts`, `store/job-repository.ts` (B4); `channel-service.ts`, `provider-service.ts`, `playlist-service.ts`, `title-records.ts`, `title-overlay.ts` (B5); `scripts/check/live-smoke.mjs` (B6) | none |
| 7 | Retired: split between the foundation F (request layer, auth, schemas; `07b60d7`), `35` (actor id, audit) and Wave 4 of `39` (account state, health, About) | | `services/{api,auth,health,audit,account-state}.ts`, `services/schemas/*`, `lib/{error-sentence,account-state-map}.ts`, `store/ui-state-slice.ts`, `hooks/{useAccountHydration,useShellWriteback,useSettingsWriteback}.ts`, `components/session/SessionState.tsx`, tests | `store/session-slice.ts`, `SignInForm`, `SignInPage`, Settings Session and About, the events wiring, `vite.config.mts` | `fixtures/session.ts`, `fixtures/audit.ts`, the `signedin` switch, `hooks/useFixtureLoad.ts` |
| 8 | Retired: superseded by `36` | | `services/{channels,providers,preview-player}.ts`, schemas, `store/{channels,providers}-slice.ts`, `hooks/{usePreviewPlayer,useChannelsLoad}.ts`, tests | `usePreviewSession.ts` (real session), `PreviewWindow.tsx`, `FolderRow.tsx`, the Channels and Providers pages and components of `28` | `fixtures/channels.ts`, `fixtures/providers.ts` |
| 9 | Retired: superseded by `37` (Titles) and `38` (Playlists, Jobs) | | `services/{titles,playlists,jobs}.ts`, schemas, slices, `lib/title-units.ts`, tests | the Titles, Playlists and Jobs components, the statusbar `N syncing` | the three fixtures |
| 10 | Retired: superseded by `35` (Accounts) and Wave 4 of `39` (sweep) | | `services/accounts.ts`, schema, slice, tests | the Accounts pages, `README.md` | `constants/fixture-switches.ts`, any remaining fixture |

### Wave 0 - backend changes (worker B)

- **Worktree.** `D:\Projects\.giga-worktrees\wire-backend`, branch `admin/wire-backend`, cut from the current `family-port`. **Owns** `src/backend/**` and `scripts/check/live-smoke.mjs`. **Off limits** every other program, docs, `.env`.
- **Does.** B1 to B6. **Depends on** nothing: it can start at once and run beside Wave 1. It must have landed before Wave 7's acceptance (B1) and before Waves 8 and 9 (B2 to B5).
- **Tests (written, not run).** For B1, `account-state.test.ts`: a new account's `GET` answers the defaults with no `updatedAt`; `401` without a token and with a disabled account; `PUT { settings }` then `GET` round-trips and sets `updatedAt`; a `PUT { shell }` leaves `settings` untouched; an unknown key (`settings.foo`, `shell.panes.bar`, a top-level extra) is `422 account_state.invalid` naming the field; an empty body, a bad tab, a width of 40, a zoom of 0.55, a coordinate of -1 are refused; two accounts keep separate rows; deleting the account deletes its row; the answer carries `Cache-Control: no-store`; a stored document that no longer parses is answered as defaults, not a `500`; no audit entry is written; `account-state-migration.test.ts`: migration 017 applies on top of a 016 database and `user_version` is 17, a 017 database opens, and an older binary against it is refused by the existing newer-schema rule. For the rest, `providers.test.ts` (enabled on create and update, null clears a field, a bad template refused); `titles.test.ts` (a title body over 64 KiB is accepted, over 256 KiB refused); `jobs.test.ts` (a playlist run's sentence and counts with examples and ids; a dry run says so); `audit.test.ts` (names on updated entries); `title-edit` (editedFields on the admin view); and `health` stays as it is (no new field).
- **Acceptance.** Gate backend steps; on a free port with a temporary `DATA_DIR`, `PUT` then `GET /api/auth/me/state` for two accounts shows two separate documents; a provider created with `enabled: false` reads back `is_active: false`.
- **Exit.** The coordinator has merged it and the wiring waves are cut from it.

### Wave 7 - request layer, auth, shell wiring, Settings persistence (worker A)

- **Worktree.** `D:\Projects\.giga-worktrees\admin-wire`, branch `admin/wire`, from `family-port` after Waves 0 and 6 have landed. **Depends on** Wave 6 accepted, Wave 0 landed, `27` steps 5, 6 and 7 (Wave 1).
- **Files.** `services/api.ts`, `services/auth.ts`, `services/health.ts`, `services/audit.ts`, `services/account-state.ts`, `services/schemas/{envelope,session,health,audit,account-state}-schema.ts`, `lib/error-sentence.ts`, `lib/account-state-map.ts`, `store/session-slice.ts` (real session), `store/ui-state-slice.ts`, `hooks/useAccountHydration.ts`, `hooks/useShellWriteback.ts`, `hooks/useSettingsWriteback.ts`, `components/session/SessionState.tsx`, the events wiring, `components/session/SignInForm.tsx` and `SignInPage.tsx` wired, Settings Session and About, the gate screen's backend facts, `vite.config.mts` `define` for the version, deletion of `fixtures/session.ts`, `fixtures/audit.ts`, `constants/fixture-switches.ts` `signedin` switch, `hooks/useFixtureLoad.ts`.
- **Tests.** `api.test.ts` (envelope parse; a non-envelope is `backend.bad_response`; fetch rejection is `backend.unreachable`; the bearer header comes from the getter; every code of section 7 has a sentence); `auth-session.test.ts` (login stores the session in memory; **two concurrent 401s make exactly one refresh call and each request retries once**; a failed refresh clears the session and the gate shows; refresh skew uses the injected clock; logout clears even on `auth.refresh_invalid`; own password change signs out); `event-sentence.test.ts` extended with names from lists and ids; `audit-paging.test.ts` (newest at the foot, de-dup, 200 cap, `before` cursor, `Load older` disabled without `nextBefore`); `no-storage.test.ts` (a source scan: no `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `setInterval`, and no `setTimeout` in `src/admin/src` outside `useAccountHydration.ts`, `useShellWriteback.ts` and the fixture stand-ins still alive, and no `fetch` outside `services/api.ts`); for the account state: `account-state-schema.test.ts` (the defaults pass; an unknown key, a bad tab, a width of 40, a zoom of 0.55 are refused; an unreadable part is reported and the other part kept), `account-state-map.test.ts` (store to wire to store round-trips; a saved width is clamped to 190..380; a saved window is kept; an unknown tab falls back to `channels`), `settings-writeback.test.ts` (no write before hydration; serialised; a change during a write is coalesced; a refusal rolls back to the committed baseline and posts one notice; a newer local change is not rolled back), `shell-writeback.test.ts` (400 ms after the last change with a fake scheduler; the latest wins; no write before hydration; a refusal keeps the layout; no write after unmount), `account-hydration.test.ts` (applies once; the 1.5 s fallback reveals the defaults without enabling writes; a late answer still applies; a failed read leaves write-back off and posts the notice; a second read never re-applies), `account-state-reset.test.ts` (sign-out flushes once, then resets to dark, amber, system, 1 and the index of Channels; a second account hydrates its own state; the first account's pending write is never sent as the second's).
- **Acceptance** (real stack, owner's say): sign in with a real account; a wrong password shows its sentence under Password; a reload returns to the gate in the default dark and amber; sign out returns to the gate and the next sign in works; the Events drawer shows the real audit tail with the sign-in at the foot; the network tab shows `Authorization` on every request and no storage writes; an expired access token (wait 15 min or revoke by changing the password elsewhere) refreshes once without a visible blip, or returns to the gate with the notice. **Persistence:** note the account's saved state; choose Light, the rose accent, Reduce motion On, a zoom of 1.2; collapse a workspace rail and resize another; open the Events band; move and resize Settings; switch to Jobs; reload and sign in: every one comes back, the pages appear only after they are applied (no flash of dark), the caption strip in Electron follows the restored theme, and the network tab shows one `GET /api/auth/me/state`, then writes of `settings` and `shell` only after the restore; sign out shows dark and amber; sign in as a second account and see the defaults, change something, sign back in as the first and see its own; open a second window, change the theme in one, the other keeps its own until reloaded (last write wins); put the first account's state back as found.
- **Exit.** The gate and the real-wire checks pass; `grep` finds no `fixtures/session` or `audit` import.

### Wave 8 - Channels, Providers and the Preview window (worker A)

- **Files.** `services/channels.ts`, `providers.ts`, schemas, `store/channels-slice.ts`, `providers-slice.ts`, the pages and components of `28` wired (New form `Create`, `Save`, `Delete`, `Rebuild`, `Revert`, `Refresh`), the statusbar's `N preparing`, **the Preview window wired**: `services/preview-player.ts`, `hooks/usePreviewPlayer.ts`, `hooks/usePreviewSession.ts` (the real session over `GET /admin-channels`, replacing the fixture), `components/channels/PreviewWindow.tsx` (the `Retry`, the close that detaches), `FolderRow` wired to `admin-host`, `hooks/useChannelsLoad.ts` (loads when first shown). Deletes `fixtures/channels.ts`, `providers.ts`.
- **Tests.** `channels-service.test.ts` (each route of 9.1 with the body it sends: only changed fields in a PATCH; folder and videos exclusive; number sent as text), `channels-slice.test.ts` (answer replaces the record by id; delete removes it; a failed read keeps items), `channel-refusals.test.ts` (`channel.invalid` field to row; `channel.taken` under Number), `providers-service.test.ts` (PUT partial; `enabled` after B2); Preview: `preview-player.test.ts` (with a fake engine and a fake video: hls.js is used when supported, the native HLS only as the fallback, neither gives `This browser cannot play HLS streams.`; a fatal manifest error is `manifest failed`, another fatal network error `unreachable`, a media error `media error`; `detach` destroys the engine, pauses and empties the `src`), `preview-session.test.ts` (a live channel attaches only when `live` or `restarting` and uses the path of its `streamUrl`; `preparing` and `starting` attach nothing and flag the skeleton; `failed` shows its problem; a stream channel always attaches with its address as answered; `Retry` reads the channels exactly once and re-attaches when attachable; a missing channel says `That channel does not exist.`; nothing polls), `preview-gate.test.ts` (the verbs' reasons as in 9.7).
- **Acceptance.** Create `zz-drive-news` live channel from a fixture folder via `Choose` in Electron; it shows `preparing` then (after Refresh) `live`; **Preview** opens from the index (one ticked row) and from the workspace, plays the channel through its own address with hls.js (the network tab shows `master.m3u8` and segments from the page's origin, no iframe, no `/test/` request), the status line says `live`, closing stops the requests, and the window returns focus to its opener; a failed or stopped channel opens it and says why with `Retry`; a stream channel plays or says its error; after an edit `Preview →` is disabled with `Save the channel first`; apply `segment-404`, Clear; edit and Save; Rebuild; Delete (armed question then removal); a stream channel is created, edited, and a synced one shows `Edited` after a save and `Revert to playlist` works; provider create/save/`Enabled`; every state word as in `28`. Both sizes; console and network clean. Records created are deleted afterwards.
- **Exit.** As above; no import of the two fixtures.

### Wave 9 - Titles, Playlists, Jobs (worker A)

- **Files.** `services/titles.ts`, `playlists.ts`, `jobs.ts`, schemas, slices, `lib/title-units.ts`, wired components, the Jobs toolbar `Run job`, the statusbar's `N syncing`, `Load` of playlists for the Jobs select. Deletes the three fixtures.
- **Tests.** `titles-service.test.ts` (query building: `includeDisabled`, `kind=all`, paging, search by Enter; PATCH with `null` clears), `title-units.test.ts`, `playlists-service.test.ts` (address never read back; `Replace` sends `address`), `jobs-service.test.ts` (create bodies by type; patch `config` merge; run body override), `job-run-queue.test.ts` (ticked jobs run one after another; a refusal does not stop the rest), `playlist-delete.test.ts` (jobs and channels marked stale), `titles-paging.test.ts`.
- **Acceptance.** Create a manual title and a playlist (a local test playlist address is refused by the address rule unless `ALLOW_LOOPBACK_STREAMS`; the coordinator uses a temporary-DATA_DIR backend for this drive, not the owner's), a playlist job, `Run job` with Dry run; Last run shows the counts; a catalog job started shows `running` and, after Refresh, its outcome; a title's Seasons, `Revert to TMDB`, `Enabled`; the tooltips of the two-step deletes.
- **Exit.** As above.

### Wave 10 - Accounts, sweep (worker A)

- **Files.** `services/accounts.ts`, schemas, slice, wired Accounts pages, own-password flow, a pass over the app for remaining fixtures (`grep` finds none), `constants/fixture-switches.ts` deleted, `README.md` updated, the version define, all files under 200 lines.
- **Tests.** `accounts-service.test.ts`, `account-last-admin.test.ts` (the controls disabled from the list), `own-password.test.ts`, `no-fixtures.test.ts` (source scan for `fixtures/` imports).
- **Acceptance.** Create an account, sign in as it in a second window, disable it from the first: its next call returns to the gate; change its password; the last enabled account's Delete is disabled with its reason; full sweep of all six tabs at both sizes; the Electron window's `Choose` and caption strip; `npm run build` and the backend serving `/admin/` (a reload on `/admin/channels`-style paths opens the app; assets immutable).
- **Exit.** Section 20.

## 20. Done when

No control calls a stub or reads a fixture; every route of section 9 is used by a control or is listed as not needed; the Events drawer shows the real audit log; a reload restores the session from the refresh cookie and then the account's saved appearance and layout once; the Preview window plays a saved channel and stops on close; the gate passes with the admin's tests and the live smoke; the coordinator's real-wire drive and the visual acceptance at both sizes pass; the backend serves the built admin at `/admin/` and its Electron window opens it.

## 21. Risks

1. **Refresh reuse revokes every session** (`03` 7.12): a second use of one refresh token logs the admin out everywhere. The single-flight rule and its test are the guard; a bug there looks like random sign-outs.
2. **No push**: a channel's `preparing` to `live` and a catalog sync's end are seen only on Refresh. The statusbar and rows can show `preparing` stale; the Refresh action is one press away in every list heading, and the Preview window's `Retry` reads again. Streaming status (`26` D19, later) lifts it.
3. **Titles need TMDB.** Without a token and without manual titles the tab is a skeleton with a notice; B7 would fix it.
4. **A playlist job awaits the whole sync** in one HTTP call (up to the fetch timeout, 15 s per playlist); the button shows its busy state; a long run can hit the browser's patience. Mitigation: none in version one.
5. **Stale titles in `GET /titles` pages**: the merged manual titles appear on page 1 only.
6. **Dev-stack race**: the window's attach check may precede the backend; section 14 removes it by letting the window own the backend in the stack.
7. **`Choose` on a file** is not available (section 13); live channels with a `videos` list are typed or built from a folder.
8. **Secrets in rows**: a live row's `folder`/`videos` are local paths and are in `admin-channels` answers (no-store, signed in only); the admin must not put them in an event sentence or a log.
9. **A failed state read turns write-back off** for the session (12.2), so a person whose first read fails changes the appearance for that session only and is told once; the alternative, writing on, would replace the saved state with the defaults.
10. **Two windows overwrite each other's section** (last write wins, 12.2). It is accepted: one person, two windows, a reload re-reads.
11. **A hydration flash.** The pages mount invisible and are revealed two frames after the state applies; if the 1.5 s fallback fires first the person sees the defaults and then, when the answer arrives, the saved appearance. The fallback is the interface's, taken on purpose, and the write switches stay off until the answer applies.
12. **Preview of a stream channel** depends on the stream's own origin allowing a cross-origin manifest read; a refusal shows as `manifest failed` or `unreachable`, which is the honest result.

## 22. What the coordinator changes when this lands

- **Root `package.json`:** the `dev` entries and `kill-ports` of section 14 (and `28` section 14); `admin:build`. **`scripts/check/gate.mjs`:** the admin steps; **`live-smoke.mjs`** (B6).
- **`AGENTS.md`:** layout (`src/admin`), the ports row for 5172, "the backend has an Electron window; the admin runs in it", `kill-ports`.
- **`docs/01`:** 1.3 (the backend's Electron host), 4.2 (Electron homes: `src/fileserver/src/app` and `src/backend/src/app`), 4.3 (`/admin/` joins the root exceptions), 4.4 (the one timer, and the two named write-back and reveal timers of the interface and the admin).
- **`docs/03`:** 7.2 (the complete channel contract), 7.2b (`enabled`), the job outcome shape, section 1 (5172), **7.9 (the `admin_ui_state` table), 7.12 (`GET`/`PUT /api/auth/me/state`) and section 8 (`account_state.invalid`)**. `testPage` is not added to 7.1.
- **`docs/26`:** the status line and section 4.1 as built; 4.5a's `masterUrl` reads `streamUrl`; **`docs/06`:** the admin is not a surface of the interface.
- **`scripts/check-rules`:** `ELECTRON_HOMES` gains `src/backend/src/app/` (the only violation the checker reports on the scaffold); the roots and rules of `27` section 4.
