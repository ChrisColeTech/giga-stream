# 29 - Admin Backend Wiring Plan

**Status: PLAN, written 2026-10-17 beside the scaffold. Nothing in this document is built, except where a section says
"built" (the backend's Electron host and its `/admin/` static serving, sections 14 and 15).** It replaces the fixtures of
`28-ADMIN-VISUAL-PARITY-PLAN.md` with the real admin backend, as `22` did for the interface. What the admin is, its pages
and decisions are `26`; the look is `28`; the shared UI and request library it is built on is `27`; the backend's contract is
`03` section 7 and, where the two differ, **the code wins** (section 17 lists every difference found). Governed by `00`, `01`,
`07`.

## 1. Goal and non-goals

**Goal.** Every control of `src/admin` calls the backend through one request layer and shows what it answers: sign-in with the
in-memory session, the six tabs' lists and records, every create, save, delete, rebuild, fault, revert, sync run and password
change, the Events drawer's audit rows, the Settings window's session and about facts, and `Choose` through the Electron
preload. The fixtures, the fixture-load stand-in and the query switches of `28` are deleted. A control either works against the
real backend or is visibly disabled with the backend's reason.

**Non-goals.** No polling, timer, socket or browser storage (`01` 4.4, `26` D5, D19): the page reads on mount, on a tab
switch, after its own writes and on `Refresh`. No admin-side persistence of theme or panes (`26` D16). No stop-a-build route
(`26` 4.12 item 7): the statusbar's `Stop` stays disabled with its reason. No streamed status, no push channel.

## 2. Rules that hold

`AGENTS.md`, `01` and `07` as in `28` section 2, plus: every wire value is `unknown` until Zod has validated it, and a part of
an answer the admin cannot read is one notice on the statusbar and never costs the rest of the answer (`01` section 8: the
parts of a snapshot are validated separately; an unknown extra field is ignored). Components, pages, hooks and the store never
call `fetch`; the request layer is the only caller. Application URLs are relative (`/api/...`); no backend address appears in
`src/admin` source. Tests inject the fetch and the clock and sleep for nothing (`01` section 10).

## 3. Choices made where the docs left a gap

1. **Preview** (`26` 4.5, 4.6). The window denies new windows and keeps the page on its own origins, so `/test/player.html` cannot open in a tab. `Preview →` opens a work window (`ChildWindow`) titled with the channel holding an `<iframe src="/test/player.html?channel=<id>">`: the same-origin test page the backend serves with `TEST_PAGE=true`, a bare hls.js player that reports its state. The frontend's `LivePlayer` is a bare `<video>` with no HLS (the interface attaches hls.js in its own `stream-player` service), so the admin does not grow a second player; the test page is the player. `Preview` is enabled when exactly one channel is ticked (or the workspace is open on a live channel), the channel is `live`, and `testPage` is true in `GET /healthz` (a field this plan adds, section 18). A stream channel has no preview.
2. **Session** (`26` D5). The access token and the refresh token live in the store's session slice, in memory only. A reload signs in again. Nothing is written to `localStorage`, `sessionStorage`, IndexedDB or a cookie.
3. **Refresh is lazy and single-flight.** There is no timer: a request that finds the access token within `REFRESH_SKEW_MS` (30 s) of `accessExpiresAt`, or that is answered `401 auth.unauthorized`, makes one refresh through a shared promise, then retries once. The refresh token is single-use and a second use revokes every session of the account (`03` 7.12), so two requests must never refresh at once; section 6 makes that a tested rule.
4. **Titles list.** `GET /api/titles` is TMDB-backed (browse by `page`, TMDB-sized pages), so the Titles index pages with `Older` / `Newer` over `page` and `totalPages`, and the `Older` / `Newer` controls disable at the ends with their reasons. With no `TMDB_READ_TOKEN` and no manual title the read is `503 tmdb.unavailable`: the list shows its skeleton and the notice says why.
5. **Playlist Status channels.** The backend's channel answer carries `source` (the playlist's host) but not the playlist id, so the playlist's channels are the admin channels whose `source` equals its `host`.
6. **Event sentences** are built by the admin from the audit entry and the names it already holds (section 11); an entry about a record the admin has not loaded names its id.
7. **Dev ports** (section 14): Vite 5172 forwards to `ADMIN_BACKEND_URL`, default `http://127.0.0.1:8091` (`03` section 1). The owner's local `src/backend/.env` sets `PORT=3001`, which is a stale value from before the ports table (`07` 2 says fix it): the coordinator backs it up and removes that line, or sets `ADMIN_BACKEND_URL` in `src/admin/.env`.

## 4. Dependencies

| On | What |
|---|---|
| `28` | the pages, store slices and components wired here; waves 1 to 5 of `28` are landed and accepted |
| `27` step 5 | `@giga/http`: `createApi({ base, headers, onEvent, onUnauthorized, sentences })`, `ApiError`, the envelope schema. Wiring waves wait for it; the admin's `services/api.ts` is a thin adapter over it. Reconcile the option names with `27` when step 5 lands; if `createApi` lacks a hook (the retry after refresh), the adapter wraps it rather than the library growing an auth concept |
| `27` step 6 | the chrome slice (events, notice, `say`): the Events drawer's rows enter through it |
| `27` step 9 | the record pieces already used by `28` |
| the backend | the changes of section 18, made by the backend worker first (wave 0 here) |

## 5. The wire shapes (copied from `src/backend/src/types` and the services, 2026-10-17)

`types/admin-*.ts` already hold these shapes from `28`; this wave adds their Zod schemas under `services/schemas/`, one file per
resource (`channel-schema.ts`, `provider-schema.ts`, `title-schema.ts`, `playlist-schema.ts`, `job-schema.ts`,
`account-schema.ts`, `audit-schema.ts`, `session-schema.ts`, `health-schema.ts`). Schemas are non-strict (unknown fields are
ignored) except where a field's absence is an error.

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
  state: ChannelState; problem?: string; fault: string | null; renditions: string[];
  playlist: { name: string; durationMs: number }[]; nowPlaying: { index: number; name: string } | null }
type AdminChannel = StreamAdminChannel | LiveAdminChannel;             // GET /api/admin-channels: { items, revision }
// live id: kebab-case, at most 64; number: whole 1..9999 sent as text or integer; category: News Sports Music Kids Movies Entertainment
// faults: stall segment-404 slow-segments playlist-500 discontinuity restart end

// providers (types/provider.ts)           snake_case is the backend's own for two fields
interface BackendProvider { id: number; name; source; is_active: boolean; order: number; family: "embed" | "stream";
  movieTemplate?; episodeTemplate?; startParam?; subtitlesParam?; origin?; frameOrigins?: string[];
  messageShape?: "vidsrc-status" | "player-event"; created_at: string /* ISO */ }

// titles (services/title-overlay.ts, title-shapes.ts)
interface AdminTitleRow { id: string /* movie-603 | tv-1399 | custom-<uuid> */; kind: "movie" | "tv"; title: string; year?: number;
  rating?: number; genres?: string[]; posterUrl?; backdropUrl?; tmdbId?: number; streamUrl?; state: "synced" | "edited" | "manual"; enabled?: boolean }
// detail adds plot?, cast?: string[], runtimeMs? (movie), seasons? [{ season, episodeCount } | { season, episodes[] }], sources? TitleSource[]
// list: { items, page, totalPages, totalResults }

// playlists (types/playlist.ts)
interface PlaylistView { id: number; name; host; masked; enabled: boolean; channels: number; lastSyncedAt?: number; lastOutcome?: string }

// jobs (types/job.ts)
interface JobView { id: number; name; type: "playlist" | "catalog"; enabled: boolean; schedule: string /* "6h" | "30m" | "24h" | "off" */;
  config: { playlistId; dryRun; prune } | { scope: "trending" | "popular"; kind: "movie" | "tv"; pages: number };
  playlistName?: string; running: boolean; lastRunAt?: number; lastOutcome?: string; lastCounts?: Record<string, unknown>; createdAt: number }

// accounts and session (types/account.ts)
interface AdminAccount { id; email; name; disabled: boolean; createdAt: number; updatedAt: number; lastSignInAt?: number }
interface Session { accessToken; accessExpiresAt: number; refreshToken; refreshExpiresAt: number; account: AdminAccount }

// audit (store/audit-repository.ts)
interface AuditEntry { id: number; at: number; actorId?; actorEmail?; action: string; subject?: string; detail?: Record<string, unknown>; address?: string }
// GET /api/audit -> { items: AuditEntry[] /* newest first */, nextBefore?: number }

// health (api/health.ts, services/service-registry.ts)
{ role: "admin-backend"; version; revision: number; tmdb: "configured" | "absent"; liveChannels: number; testPage: boolean /* added, section 18 */ }
```

## 6. Auth

### 6.1 The gate and the session

- **Gate.** `AppShell` shows the sign-in page (`28`) while `session` is null; the titlebar and statusbar stay. The pages are not mounted
  until a session exists, so no read is sent signed-out. A reload starts here.
- **Sign in.** `POST /api/auth/login { email, password }` (no token) answers a `Session`. The store keeps it in `session-slice`
  (`accessToken`, `accessExpiresAt`, `refreshToken`, `refreshExpiresAt`, `account`). On success: close nothing, mount the pages, load
  the active tab, read the audit tail (section 11), say `Signed in.`
- **Failures** (`401 auth.invalid_credentials`, `429 auth.rate_limited`, `429 auth.locked`) show their sentences under the form's Password row and on
  the notice line; the form keeps the email and clears the password. The backend answers the same sentence for an unknown email
  and a wrong password.
- **Sign out** (Settings > Session): `POST /api/auth/logout { refreshToken }`, then clear the session whatever the answer is
  (`401 auth.refresh_invalid` is ignored: the session is gone either way). Every page's loaded records are dropped.
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
- `now` is injected (`01` section 10). There is no `setInterval` and no `setTimeout`.
- Changing **your own** password (Accounts workspace, or `POST /api/auth/password`) revokes your sessions, including this one: after the
  answer, the admin signs out locally and shows the gate with the notice `Password changed. Sign in again.` Changing **another**
  account's password or `disabled` revokes that account's sessions; the admin tells the person on the notice line.
- A disabled or deleted own account gives `401` on the next call and the refresh fails the same way: the gate, with
  `auth.refresh_invalid`'s sentence.

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
| `auth.invalid_credentials` | 401 | The email or password is wrong. |
| `auth.refresh_invalid` | 401 | That session has ended; sign in again. |
| `auth.rate_limited` | 429 | Too many sign-in attempts; wait a minute. |
| `auth.locked` | 429 | This account is locked for a while after failed sign-ins. |
| `account.not_found` | 404 | That account does not exist. |
| `account.invalid` | 422 | the backend's sentence (names the field) |
| `account.email_taken` | 409 | Another account already uses that email. |
| `account.last_admin` | 409 | This is the last enabled account; another one is needed first. |
| `channel.not_found` | 404 | That channel does not exist. |
| `channel.invalid` | 422 | the backend's sentence (names the field); under that field's row |
| `channel.taken` | 409 | Another channel already has that id or number. |
| `fault.invalid` | 400 | That fault is not valid. |
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
| `channels-slice.ts` | `channels: { status: "idle" \| "loading" \| "ready" \| "failed"; items: AdminChannel[]; revision }`, `ticked: ids` |
| `providers-slice.ts`, `titles-slice.ts` (adds `page`, `totalPages`, `search`, `kinds`, `sort`), `playlists-slice.ts`, `jobs-slice.ts`, `accounts-slice.ts` | the same shape |
| `events` (the chrome slice) | audit rows and the page's own failures, newest last, at most 200, `olderCursor` |
| `health` | `{ testPage, revision, version, tmdb }` read at mount and by Refresh |

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
| create live | `POST /channels` | `{ kind: "live", id, name, category, number, mode?, captions?, variants?, folder }`, or the same with `videos: string[]` in place of `folder` (exactly one of the two) | `201` `LiveAdminChannel` (`state: "preparing"`) |
| create stream | `POST /channels` | `{ kind: "stream", name, category, number?, logoUrl?, streamUrl }` | `201` `StreamAdminChannel` |
| save | `PATCH /channels/:id` | changed fields of `name category number logoUrl streamUrl mode captions variants folder videos enabled` (`kind` may be echoed; `folder` and `videos` are exclusive and replace each other) | the `AdminChannel` (a live row `preparing` while it rebuilds) |
| delete | `DELETE /channels/:id` | - | `{ id }` (a synced row is really deleted; the tooltip says the next sync adds it again) |
| rebuild | `POST /channels/:id/rebuild` | - | `LiveAdminChannel`; refused `422 channel.invalid` (field `enabled`) while disabled |
| revert | `POST /channels/:id/revert` | - | `StreamAdminChannel` with `editedFields` cleared; refused (field `source`) for a hand-made row |
| apply fault | `PUT /channels/:id/fault` | `{ fault, durationMs?, delayMs? }` (positive ints, at most 24 h) | `{ id, fault }` |
| clear fault | `DELETE /channels/:id/fault` | - | `{ id, fault: null }` |

- **Required-field and number refusals** are client-side first (`lib/field-checks.ts`), then the backend's `channel.invalid` with
  `details.field`, shown under the named row. `channel.taken` (409) names no field: shown under Number (and Id for live).
- **Live states.** `preparing` and `starting` and `restarting` draw the Status group's skeleton and count in the statusbar's `N preparing`; `live` enables
  `Apply` and `Preview`; `stopped` and `failed` show their word, and `failed` shows `problem` as the first Status line; a disabled channel is dimmed with `disabled`.
  The page learns of a state change only on `Refresh`, a write of its own, or the workspace's `Refresh` in the Status heading (a `GET /admin-channels` that replaces the list): no polling.
  After a save or rebuild the page does **not** wait: the answer says `preparing`, the notice says `Fixture News is preparing.` and Refresh shows `live` later.
- **`fault`** in the answer is a word or `null`; it shows in the list only when set.
- **Status playlist** rows come from `playlist[]` (name, `durationMs` as `mm:ss`); the playing row is `nowPlaying.index`.
- **Stream address** shown for a live row is the answer's `streamUrl` (built from the caller's origin, so it works from `/admin/`); the copy
  icon writes it to the clipboard (`navigator.clipboard`, guarded: a plain-http page on a LAN address is not a secure context and has none, so the notice then says `The address could not be copied.`).
- **Preview** per section 3, item 1. **Choose** per section 13.
- **Logo** preview is `<img src={logoUrl}>` (a live row's `/logos/<id>.png` is served by the backend; a stream row's is an external https address); a broken image shows the glyph.

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
| create | `POST /admin-accounts` | `{ email, name, password }` (password 12 to 256 characters) | `201` account |
| save | `PATCH /admin-accounts/:id` | any of `email name password disabled` (`Enabled` is `!disabled`) | account |
| delete | `DELETE /admin-accounts/:id` | - | `{ id }` |

`409 account.email_taken` shows under Email; `409 account.last_admin` is the refusal of the last enabled account's Delete or disable, and the page disables those two controls
for it with the reason up front (computed from the list). `password` set on another account revokes that account's sessions.

## 10. Live-channel flows

1. **Create a live channel** (New form `Create`): `POST /channels`; the answer (`preparing`) is inserted; the notice reads `<name> is preparing.`; the statusbar counts it.
   A source the engine cannot read is not a create error: the channel becomes `failed` with a `problem` the next read shows.
2. **Edit a source** (Folder, Videos, mode, captions, qualities): Save sends the changed fields; the answer is `preparing`; Status shows its skeleton until Refresh.
3. **Rebuild** re-reads a folder; the old stream keeps playing until the new is ready (backend comment); the page shows `preparing`.
4. **Faults** are in memory on the backend and vanish on its restart; `Apply` is enabled only when `state === "live"`; the list's fault word comes from `fault`.
5. **Restart of the backend stops every live channel until it rebuilds** (`26` D4): the admin shows them `preparing` on the next read; nothing special is coded.
6. **Disabling** a live channel stops it (`stopped`); enabling starts it.

## 11. The Events drawer

- **Audit rows.** `GET /audit?limit=50` is read after sign-in, when the drawer opens, after each of the page's own writes (once, `limit=10`), and by `Refresh`; it returns newest first. The drawer stores rows
  **oldest first, newest at the foot** (it reverses the page), de-duplicated by `id`, at most 200. `Load older` reads `GET /audit?limit=50&before=<smallest id held>` and prepends; it is
  disabled with `No older events.` when the last answer had no `nextBefore`. `Clear` empties the list on screen only.
- **Sentence and tone** (`lib/event-sentence.ts`, built in `28`, unchanged): `actor = actorEmail ?? "system"`; `<actor> <verb> <area> <name>` where the name is `detail.name` (created, deleted), else the
  name the admin holds for `subject`, else the id. Actions to area and verb:

| Action | Area | Sentence | Tone |
|---|---|---|---|
| `auth.login` / `auth.logout` | Session | `<actor> signed in` / `signed out` | info |
| `auth.login_failed` | Session | `Sign-in failed for <detail.email>` | warn |
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

  Audit `updated` entries carry only the changed field names and the subject id (B5 adds the name); the admin supplies the name from its lists.
- **The page's own REST events.** A failed call adds a `Connection` or area row (section 7); a success adds none (the audit row is the success). The notice line says each outcome in one sentence.
- The statusbar `Events` count and the drawer's `N events` are the held rows.

## 12. Settings, About, Session

- **Appearance** is store-only (`28`); nothing is sent anywhere.
- **Session** shows `session.account.email` and `name`, and `Sign out` (6.1).
- **About** shows the app version (`__ADMIN_VERSION__` defined by Vite from `package.json`), the backend's `version` and `revision` from `GET /healthz`, the backend address (`location.origin`),
  `TMDB: configured / absent`, and the runtime (`Electron` when `window.adminHost` exists, else `Browser`). Facts that failed to load draw the dash and a skeleton, never an error sentence.

## 13. `Choose` and the Electron preload

`services/admin-host.ts` (built in `28`) wraps `window.adminHost`: `hostAvailable()` is `typeof window.adminHost?.chooseFolder === "function"`; `chooseFolder()` resolves the chosen absolute path or `null`.
The backend's host (built, section 14) opens `dialog.showOpenDialog({ properties: ["openDirectory"] })` over its window and answers the first path; the IPC checks that the sender is the main frame at the backend's origin or the Vite origin.

- `FolderRow` `Choose` writes the path into the field only; it does not save. A `null` (cancelled) changes nothing.
- In a plain browser (`window.adminHost` undefined) the field stays a typed path and `Choose` is visibly disabled: `Folders can be chosen only in the backend's own window; type the path.`
- **`Choose` appears only on Folder rows.** The preload exposes exactly `chooseFolder` and `setOverlay` (a directory picker); a file picker is not in this plan. So the Videos list's add row is a path field and `Add`, with no `Choose`
  (`26` 4.5 and the mockup draw a file `Choose` there; `28` wave 0 removes it from the mockup, and `28` section 6.1 `VideoList` is a field and `Add`). A person lists videos by typing paths, or uses the Folder source.
- `useCaptionOverlay` (built in `28`) calls `adminHost.setOverlay` with the theme's bar colours; refused off Windows.

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
(for example `http://localhost:5172` rather than `127.0.0.1`) would be cross-origin to nothing, since the proxy makes every call same-origin; only a bare backend address typed into a browser tab with a different admin origin would need `CORS_ORIGINS`.

**`npm run dev`.** Proposal for the root `package.json` (the coordinator applies it). The window attaches to a backend that already answers, but in a concurrent start the attach check can run before the headless
backend listens, and the window would then start a second backend on the same port. So the stack **replaces** the headless backend entry with the window's, which owns the backend: in `dev`, change the `concurrently` list to
`--names backend,frontend,electron,admin --prefix-colors cyan,magenta,yellow,green` with the commands `"npm run dev:stack --prefix src/backend"` (the backend inside Electron on 8091, opening the admin on Vite once it answers), `"npm run dev --prefix src/frontend"`,
`"npm run dev --prefix src/fileserver"` and `"npm run dev --prefix src/admin"`; `kill-ports` gains `5172`; a root `dev:headless` keeps the old backend command for automation that does not want a window. This changes what `npm run dev` starts
(a second Electron window, with the debug port 9223), so it is the owner's call; the default taken is the replace. `dist:win` is unchanged: the backend and the admin are not in the desktop installer.

## 15. Empty, loading and failure states

As `28` section 9.10 and `26` 4.10: skeletons in the page's own shape for loading and empty; a failed read keeps the last good content and sets one notice; an unreachable backend leaves the pill and statusbar in place, keeps the last content and
disables writes with `The admin backend cannot be reached.`; no sentence over a skeleton; no empty-state card. The sign-in gate shows the same shape while `GET /healthz` is unreachable (the Sign in button works; its failure reads `backend.unreachable`).

## 16. Test strategy

- **Workers** write fast `node:test` tests under `src/admin/test/` with an injected fetch (a function returning envelopes) and an injected clock; nothing sleeps, no server starts. They do not run them (`07` 6.3).
- **Coordinator, automated.** The gate (`node scripts/check/gate.mjs`) runs the admin's typecheck, lint and tests, and the backend's tests, on free ports and temporary `DATA_DIR`s.
- **Coordinator, the real wire.** Against a backend on a free port with a temporary `DATA_DIR`, `JWT_SECRET`, a bootstrap admin and `TEST_PAGE=true` (no owner data): sign in, create one of each record through the same HTTP calls the admin makes, run a playlist job against a local test playlist,
  start a catalog job with a stubbed TMDB base, apply a fault to a seeded live channel, change a password and watch the old session die, read `/audit`. **The gate's live smoke** (`scripts/check/live-smoke.mjs`) finds the backend by `GIGA_SMOKE_BACKEND`, else the `PORT` in `src/backend/.env` or `dev.env`, else 8091 (it defaults to 3001 today: B6).
- **Coordinator, visual.** On the owner's real stack (`07` 4, 5): the admin in a Chrome tab on 5172 and in the backend's Electron window through port 9223, at 1600 x 1000 and 900 x 640, comparing to `28`'s fixtures-driven result for the same states; console and network clean; every request carries the bearer token and none goes to a host other than the backend.
  The coordinator changes only UI state and puts it back; it never deletes or overwrites the owner's records without asking (`07` 4); a write drive uses records it creates and removes, named `zz-drive-...`, after asking.

## 17. Doc against code: every difference found (2026-10-17)

| # | Doc says | Code does |
|---|---|---|
| 1 | `03` 7.2b `PUT /api/providers` changes any field incl. active | `ProviderPatchSchema` has no `enabled`/`is_active`; create forces on; update keeps `current.is_active`; an optional field cannot be cleared (B2) |
| 2 | `26` 4.9c a playlist job's Last run shows refusal examples and created ids, and an outcome sentence | `lastOutcome` is `"ok"` or the error message; `lastCounts` is `{ created, updated, skipped, refused, removed, kept }` only (B4) |
| 3 | `26` 4.9b Titles workspace shows which fields were edited | the admin title view carries `state` but not `editedFields`; `GET /api/channels` stream rows do carry `editedFields` (B5) |
| 4 | `26` 4.9 Events rows read "ada updated channel Fixture News" | `*.updated`, `*.reverted`, `channel.rebuilt`, `channel.fault_*` audit entries carry the subject id and changed field names, not the record's name (B5) |
| 5 | `26` 4.5 `Preview →` reads `TEST_PAGE` | nothing in a public or admin answer says it; `GET /healthz` has `liveChannels` but no `testPage` (B1) |
| 6 | `03` 7.4 lists titles as `BackendTitle` | the admin reads add `state`, `enabled` (with `includeDisabled` and a token) and detail adds `sources`; manual titles carry `custom-<uuid>` ids and `seasons` with `episodes[]` |
| 7 | `03` 7.2c playlist sync is `POST /api/playlist-sync` | still present as a thin wrapper; the admin uses jobs; the wrapper does not record on a job |
| 8 | `26` 3.3 `POST /api/channels/:id/rebuild` "re-reads a folder source" | also refuses a disabled channel (`422 channel.invalid`, field `enabled`) and a stream channel |
| 9 | `26` 4.6 the Videos list adds a file with `Choose` | the preload exposes a folder picker only (`properties: ["openDirectory"]`), so `Choose` on a file is not available (section 13) |
| 10 | `03` 7.10 "account routes" are no-store | `isPrivateRoute` covers `/api/auth`, `/api/admin-accounts`, `/api/audit`, `/api/admin-channels`; `/api/jobs` and `/api/playlists` are not (they hold no secret) |
| 11 | the brief expected a `GET /api/me` gap | `GET /api/auth/me` exists (`api/auth.ts`); no gap |
| 12 | `03` 7.11 `PATCH` accepts `password` | yes; a change to another account's `password`/`disabled` revokes its sessions, and the answer does not say so |
| 13 | `01` 4.3 body limit | `REQUEST_BODY_LIMIT_BYTES` is 65,536 for every route except channel writes (256 KiB): `POST/PATCH /api/titles` carry `seasons` up to 100 seasons by 500 episodes and can exceed it (B3) |
| 14 | `scripts/check/live-smoke.mjs` | defaults the backend to `http://127.0.0.1:3001`, the owner's stale `.env` port (B6) |
| 15 | `AGENTS.md` ports | the backend's dev port is 8091; the owner's local `.env` sets `PORT=3001` (a stale value) and `src/backend/.env` is the coordinator's to fix (section 3, item 7) |

## 18. Backend changes the wiring needs

Made by the backend worker first (wave 0 below), each with a test in `src/backend/test` (written, not run).

| # | Change | Files |
|---|---|---|
| B1 | `GET /healthz` adds `testPage: boolean` (`TEST_PAGE`), through `services.health()` | `src/backend/src/services/service-registry.ts`, `api/health.ts`, `test/` |
| B2 | Providers: `ProviderInputSchema`/`ProviderPatchSchema` accept `enabled: boolean`; `create` and `update` write `is_active` from it; `update` clears an optional field when the patch carries `null` (the patch schema allows `null` for the optional fields); `BackendProvider` keeps `is_active` | `types/provider.ts`, `services/provider-service.ts` |
| B3 | `POST /api/titles` and `PATCH /api/titles/:id` take the channel writes' larger body limit (`CHANNEL_BODY_LIMIT_BYTES`) | `api/titles.ts`, `constants/limits.ts` |
| B4 | A playlist job's `lastOutcome` is a sentence (`Synced: 3 created, 12 updated.`, `Dry run. ...`); its `lastCounts` adds `refusalExamples` (at most 10 strings) and `createdIds` (at most 10 ids) | `services/job-runner.ts`, `store/job-repository.ts` |
| B5 | Audit `detail` of `*.updated`, `*.reverted`, `channel.rebuilt`, `channel.fault_*` adds `name`; the admin title view adds `editedFields` | `services/channel-service.ts`, `provider-service.ts`, `playlist-service.ts`, `title-records.ts`, `title-overlay.ts` |
| B6 | `scripts/check/live-smoke.mjs` finds the backend by `GIGA_SMOKE_BACKEND`, else the `PORT` line of `src/backend/.env`, then `dev.env`, else `http://127.0.0.1:8091` | `scripts/check/live-smoke.mjs` (the coordinator's; named here so a worker's brief can carry it, `07` 2) |
| B7 | (optional, not required) a route that lists the stored titles only (edited and manual), so the Titles tab works with no TMDB token | decided later; not in the waves |

## 19. Waves

One worker per real sub-project (`07` 6.1): **B** owns `src/backend` (wave 0), **A** owns `src/admin` (waves 1 to 4) in one worktree. The coordinator lands each, runs the gate and the real checks, and visually accepts waves 1 to 4 at both sizes.
A wave's worker: `npm ci` in its own worktree, typecheck, lint, `node scripts/check-rules.mjs`, all clean; tests written, not run; one commit per wave; never pushes; reports per `07` 6.4.

### Wave 0 - backend changes (worker B)

- **Worktree.** `D:\Projects\.giga-worktrees\wire-backend`, branch `admin/wire-backend`, cut from the landed `family-port` containing the scaffold. **Owns** `src/backend/**` and `scripts/check/live-smoke.mjs`. **Off limits** every other program, docs, `.env`.
- **Does.** B1 to B6. **Depends on** nothing. **Tests (written, not run).** `health.test.ts` (testPage true and false); `providers.test.ts` (enabled on create and update, null clears a field, a bad template refused); `titles.test.ts` (a title body over 64 KiB is accepted, over 256 KiB refused); `jobs.test.ts` (a playlist run's sentence and counts with examples and ids; a dry run says so); `audit.test.ts` (names on updated entries); `title-edit` (editedFields on the admin view).
- **Acceptance.** Gate backend steps; `GET /healthz` on a free port shows `testPage`; a provider created with `enabled: false` reads back `is_active: false`.
- **Exit.** The coordinator has merged it and the next waves are cut from it.

### Wave 1 - request layer, auth, shell wiring (worker A)

- **Worktree.** `D:\Projects\.giga-worktrees\admin-wire`, branch `admin/wire`, from the landed `28`. **Depends on** `28` complete; `27` steps 5 and 6; wave 0.
- **Files.** `services/api.ts`, `services/auth.ts`, `services/health.ts`, `services/audit.ts`, `services/schemas/{envelope,session,health,audit}-schema.ts`, `lib/error-sentence.ts`, `store/session-slice.ts` (real session), the events wiring, `components/session/SignInForm.tsx` and `SignInPage.tsx` wired, Settings Session and About, the gate screen's backend facts, `vite.config.mts` `define` for the version, deletion of `fixtures/session.ts`, `fixtures/audit.ts`, `constants/fixture-switches.ts` `signedin` switch, `hooks/useFixtureLoad.ts`.
- **Tests.** `api.test.ts` (envelope parse; a non-envelope is `backend.bad_response`; fetch rejection is `backend.unreachable`; the bearer header comes from the getter; every code of section 7 has a sentence); `auth-session.test.ts` (login stores the session in memory; **two concurrent 401s make exactly one refresh call and each request retries once**; a failed refresh clears the session and the gate shows; refresh skew uses the injected clock; logout clears even on `auth.refresh_invalid`; own password change signs out); `event-sentence.test.ts` extended with names from lists and ids; `audit-paging.test.ts` (newest at the foot, de-dup, 200 cap, `before` cursor, `Load older` disabled without `nextBefore`); `no-storage.test.ts` (a source scan: no `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `setInterval`, `setTimeout` in `src/admin/src` outside the allowed hooks, and no `fetch` outside `services/api.ts`).
- **Acceptance** (real stack, owner's say): sign in with a real account; a wrong password shows its sentence under Password; a reload returns to the gate; sign out returns to the gate and the next sign in works; the Events drawer shows the real audit tail with the sign-in at the foot; the network tab shows `Authorization` on every request and no storage writes; an expired access token (wait 15 min or revoke by changing the password elsewhere) refreshes once without a visible blip, or returns to the gate with the notice.
- **Exit.** The gate and the real-wire checks pass; `grep` finds no `fixtures/session` or `audit` import.

### Wave 2 - Channels and Providers (worker A)

- **Files.** `services/channels.ts`, `providers.ts`, schemas, `store/channels-slice.ts`, `providers-slice.ts`, the pages and components of `28` wired (New form `Create`, `Save`, `Delete`, `Rebuild`, `Revert`, fault `Apply`/`Clear`, `Refresh`), the statusbar's `N preparing`, `Preview` window (`components/channels/PreviewWindow.tsx`), `FolderRow` wired to `admin-host`, `hooks/useChannelsLoad.ts` (loads when first shown). Deletes `fixtures/channels.ts`, `providers.ts`.
- **Tests.** `channels-service.test.ts` (each route of 9.1 with the body it sends: only changed fields in a PATCH; folder and videos exclusive; number sent as text), `channels-slice.test.ts` (answer replaces the record by id; delete removes it; a failed read keeps items), `channel-refusals.test.ts` (`channel.invalid` field to row; `channel.taken` under Number), `fault-service.test.ts`, `providers-service.test.ts` (PUT partial; `enabled` after B2), `preview-gate.test.ts` (enabled only for one ticked live channel with `testPage`).
- **Acceptance.** Create `zz-drive-news` live channel from a fixture folder via `Choose` in Electron; it shows `preparing` then (after Refresh) `live`; Preview plays; apply `segment-404`, Clear; edit and Save; Rebuild; Delete (armed question then removal); a stream channel is created, edited, and a synced one shows `Edited` after a save and `Revert to playlist` works; provider create/save/`Enabled`; every state word as in `28`. Both sizes; console and network clean. Records created are deleted afterwards.
- **Exit.** As above; no import of the two fixtures.

### Wave 3 - Titles, Playlists, Jobs (worker A)

- **Files.** `services/titles.ts`, `playlists.ts`, `jobs.ts`, schemas, slices, `lib/title-units.ts`, wired components, the Jobs toolbar `Run job`, the statusbar's `N syncing`, `Load` of playlists for the Jobs select. Deletes the three fixtures.
- **Tests.** `titles-service.test.ts` (query building: `includeDisabled`, `kind=all`, paging, search by Enter; PATCH with `null` clears), `title-units.test.ts`, `playlists-service.test.ts` (address never read back; `Replace` sends `address`), `jobs-service.test.ts` (create bodies by type; patch `config` merge; run body override), `job-run-queue.test.ts` (ticked jobs run one after another; a refusal does not stop the rest), `playlist-delete.test.ts` (jobs and channels marked stale), `titles-paging.test.ts`.
- **Acceptance.** Create a manual title and a playlist (a local test playlist address is refused by the address rule unless `ALLOW_LOOPBACK_STREAMS`; the coordinator uses a temporary-DATA_DIR backend for this drive, not the owner's), a playlist job, `Run job` with Dry run; Last run shows the counts; a catalog job started shows `running` and, after Refresh, its outcome; a title's Seasons, `Revert to TMDB`, `Enabled`; the tooltips of the two-step deletes.
- **Exit.** As above.

### Wave 4 - Accounts, sweep (worker A)

- **Files.** `services/accounts.ts`, schemas, slice, wired Accounts pages, own-password flow, a pass over the app for remaining fixtures (`grep` finds none), `constants/fixture-switches.ts` deleted, `README.md` updated, the version define, all files under 200 lines.
- **Tests.** `accounts-service.test.ts`, `account-last-admin.test.ts` (the controls disabled from the list), `own-password.test.ts`, `no-fixtures.test.ts` (source scan for `fixtures/` imports).
- **Acceptance.** Create an account, sign in as it in a second window, disable it from the first: its next call returns to the gate; change its password; the last enabled account's Delete is disabled with its reason; full sweep of all six tabs at both sizes; the Electron window's `Choose` and caption strip; `npm run build` and the backend serving `/admin/` (a reload on `/admin/channels`-style paths opens the app; assets immutable).
- **Exit.** Section 20.

## 20. Done when

No control calls a stub or reads a fixture; every route of section 9 is used by a control or is listed as not needed; the Events drawer shows the real audit log; a reload signs in again; the gate passes with the admin's tests and the live smoke; the coordinator's real-wire drive and the visual acceptance at both sizes pass; the backend serves the built admin at `/admin/` and its Electron window opens it.

## 21. Risks

1. **Refresh reuse revokes every session** (`03` 7.12): a second use of one refresh token logs the admin out everywhere. The single-flight rule and its test are the guard; a bug there looks like random sign-outs.
2. **No push**: a channel's `preparing` to `live` and a catalog sync's end are seen only on Refresh. The statusbar and rows can show `preparing` stale; the Refresh action is one press away in every list heading. Streaming status (`26` D19, later) lifts it.
3. **Titles need TMDB.** Without a token and without manual titles the tab is a skeleton with a notice; B7 would fix it.
4. **A playlist job awaits the whole sync** in one HTTP call (up to the fetch timeout, 15 s per playlist); the button shows its busy state; a long run can hit the browser's patience. Mitigation: none in version one.
5. **Stale titles in `GET /titles` pages**: the merged manual titles appear on page 1 only.
6. **Dev-stack race**: the window's attach check may precede the backend; section 14 removes it by letting the window own the backend in the stack.
7. **`Choose` on a file** is not available (section 13); live channels with a `videos` list are typed or built from a folder.
8. **Secrets in rows**: a live row's `folder`/`videos` are local paths and are in `admin-channels` answers (no-store, signed in only); the admin must not put them in an event sentence or a log.

## 22. What the coordinator changes when this lands

- **Root `package.json`:** the `dev` entries and `kill-ports` of section 14 (and `28` section 14); `admin:build`. **`scripts/check/gate.mjs`:** the admin steps; **`live-smoke.mjs`** (B6).
- **`AGENTS.md`:** layout (`src/admin`), the ports row for 5172, "the backend has an Electron window; the admin runs in it", `kill-ports`.
- **`docs/01`:** 1.3 (the backend's Electron host), 4.2 (Electron homes: `src/fileserver/src/app` and `src/backend/src/app`), 4.3 (`/admin/` joins the root exceptions), 4.4 (the one timer).
- **`docs/03`:** 7.1 (`testPage`), 7.2 (the complete channel contract), 7.2b (`enabled`), the job outcome shape, section 1 (5172).
- **`docs/26`:** the status line and section 4.1 as built; **`docs/06`:** the admin is not a surface of the interface.
- **`scripts/check-rules`:** `ELECTRON_HOMES` gains `src/backend/src/app/` (the only violation the checker reports on the scaffold); the roots and rules of `27` section 4.
