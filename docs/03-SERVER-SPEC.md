# 03 - Server Specification

**Status: governing contract for the two servers, rewritten 2026-10-16.** Every route, answer and field
that crosses a program boundary is named here; adding one means changing this document first. Who owns
what is in `01`; what the interface does with it is in `02` and `06`. Which phase builds each part is `08`.

**Build status (2026-10-16, end of day).** Where a section stands, checked by its tests:

| Section | Part | Status |
|---|---|---|
| 1-2 Programs, conventions | — | **done** (both servers boot; the envelope and error codes are in) |
| 3.1 Health (fileserver) | A | **done** (`state.test.ts`: own state and the backend view) |
| 3.2-3.3 Settings, shell state | A | **done** (`settings.test.ts`, `shell-state.test.ts`: defaults, whole-request refusal, restart persistence) |
| 3.4 Channels pass-through | A | **done** (`channels.test.ts` against the real backend: fill, q/category, categories over the whole view, last channel) |
| 3.5-3.6 Library query, titles pass-through | A | **done** (`library.test.ts`, `titles.test.ts`: views, sorts, facets, the cursor, `titlesAvailable`/`trending` honest against a down backend, images rewritten through the cache, providers attached, related fallbacks - seams shaped as the real backend answers them, plus the real backend's honest no-TMDB lane) |
| 3.7-3.10 Collections, folders, jobs, local media | A | **done** (`collections/folders-scans/jobs/media.test.ts`: names, tokens, the NDJSON scan stream, one scan per folder, 202 cancelling, interrupted at start, 206/416 ranges with ETag and If-Range - against the real backend as a child process) |
| 3.11 Image cache | A | **done** (`image-cache.test.ts`: hash ids, the 10 s/10 MiB/image-only fetch, 404 on failure, six-month prune, stills by poster-fetch; channel logos rewrite through the cache) |
| 3.12-3.13 Favorites, watch history | A | **done** (`favorites-watch.test.ts`: idempotent favorites; seq-ordered watch writes, sticky watched at 95 percent, episode identity, remove one, clear all) |
| 4-6 State and updates, live view, storage | A | **done** (`state.test.ts` now carries live collections and jobs; the live view keeps its TTL and clear-on-failure; migrations `001`/`002` ported unchanged, `003` new) |
| 7.1 Health | B | **done** |
| 7.2 Channels | B | **done** (`channels.test.ts`, `seed-and-store.test.ts`; `tvgId`/`source` landed with 7.2c; live channels, `enabled`, faults, rebuild and revert landed with the merge of the live server, 2026-10-17, `26`) |
| 7.2b Providers | B | **done** (`providers.test.ts`) |
| 7.2c Playlist import and sync | B | **being rebuilt** (owner, 2026-10-18; plan `43`): the 2026-10-16 import-plus-prune sync is replaced by a file or web-address **import**, a per-playlist **sync job** (image cache, per-channel live/dead check, stop and resume) and a bulk channel `Enable`; this section is the contract, the code follows wave by wave |
| 7.3 Stream and image addresses | B | **done** (the address rule; part of every channel change) |
| 7.4 Titles (TMDB proxy routes) | B | **done** (`titles.test.ts`: browse, search, genres, detail, seasons, recommendations; detail enriches thin rows and, with `OMDB_API_KEY`, carries the `omdb` block — `11` section 7). **Gap found 2026-10-17:** the TV detail never carried `seasons` — the mapping of TMDB's `seasons[]` was unspecified in the type and untested, so the Player's episode browser never started; remediation in 7.4 and 7.6b lands with the mapping, the store-heal rule, and detail/seasons tests against the real chain |
| 7.5 The stream address rule | B | **in progress** — the dev template rule is built; the sources rule is specified (see 7.5, from `14`'s results) and lands with wave A of `22` |
| 7.6 TMDB client | B | **done** (read token, ~5/s pacing, `429` backoff, merged in-flight requests) |
| 7.6b The catalog sync | B | **done** (`titles.test.ts`: store fill-through, restart from store, single-flight admin sync, the outcome in the status, audit as `system`, `TMDB_SYNC_SCHEDULE` warm-up, no revision bump; `404` from TMDB is `title.not_found`) |
| 7.7-7.9 Test channels, socket, storage | B | **done** (the socket removed 2026-10-17, `7.8`) |
| 7.10-7.12 Network, accounts, sign-in | B | **done** (`network.test.ts`, `accounts.test.ts`, `auth.test.ts`) |
| 7.13 Audit log | B | **done** (sync entries included) |
| 8 Errors | B | **done** |

There are two servers, and they are separate programs:

- **The fileserver** (Part A) serves the interface. Every route the interface calls is a fileserver
  route. It keeps device-local data and reads the admin Turso database directly for channels, titles and
  account data. Its only admin API data call is the provider read (`64`).
- **The admin backend** (Part B) holds the channels, and is the app's window onto TMDB's titles (`11`):
  it browses, searches and describes them, and gives each movie and episode its stream address from a
  rule. Only the fileserver reads from it; a signed-in admin changes the channels.

Values marked *(default)* were chosen while writing this document, not decided by the owner; they can
change without a design discussion.

## 1. Programs, ports and configuration

Development and production never share a port (owner, 2026-10-17), so the installed app runs beside
the dev stack. `NODE_ENV=production` selects the production column: the packaged Electron app sets it
(`src/app/production-env.ts`), and the backend's `npm start` loads it from its
`production.env`, which also pins the port over a development `PORT` in a local `.env`. `PORT` set in the
environment overrides either.

| Program | Development | Production |
|---|---|---|
| Interface (Vite; proxies `/api` and `/ws` to the fileserver) | 5171 (`npm run dev`) | 5271 (`npm run preview`, proxying to 8190) |
| Fileserver | 8090 | 8190 (the packaged app) |
| Admin backend | 8091 | 8191 |
| Admin app (Vite, base `/admin/`; proxies `/api`, `/live`, `/logos` and `/test` to the backend) | 5172 (`npm run dev`) | served by the backend at `/admin/` |

The fileserver's default admin address follows the same column: `http://127.0.0.1:8091` in development,
`http://127.0.0.1:8191` in the packaged app, until Settings ▸ Admin backend names another. Both servers
bind `127.0.0.1` unless `HOST` says otherwise.

**Fileserver environment:** `PORT`, `HOST`, `DATA_DIR` (default `~/.giga-stream`), `WEB_DIST` (the built
interface, default `src/frontend/dist`; point it at `src/mockup` to serve the proof of concept of `14`),
`ALLOW_INSECURE_ADMIN` (accept a plain `http` admin address off loopback; development only),
`TEST_FOLDER_ROOT` (tests only: lets a browser run choose a folder under this root without Electron's
picker), `GIGA_APP_URL` (desktop shell only: the page the window loads),
`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (the admin database; required for direct admin reads), `JWT_SECRET`
(account sessions), `ADMIN_MEDIA_TARGET` (optional `/live` and `/logos` byte origin),
`REQUIRE_ACCOUNT_WRITES` (deployment only, plan `62` wave 0: set on a public deployment, it makes the
unauthenticated write routes for settings, favorites, collections and watch history refuse with the standard
envelope, `403 writes.closed`; never set on a desktop, whose local writes are the point).

**Serving the interface** (as the other family apps do). The fileserver serves the built interface on its
own origin: `index.html`, `favicon.svg`/`favicon.ico` and Vite's `assets/`. A GET that is no route, no
`/api` or `/healthz` address and no file answers `index.html`; everything else keeps the JSON 404. With no
`index.html` in `WEB_DIST`, nothing is served there. The Electron window loads `GIGA_APP_URL` when it is set;
otherwise, unpackaged, the Vite dev server on 5171 when it answers within three seconds, so edits reload in
place; otherwise the fileserver's own origin. The root `npm run dev` starts Vite beside the backend and the
Electron app, so the development window always loads it.

**Admin backend environment:** `PORT`, `HOST`, `DATA_DIR` (default `~/.giga-stream-admin`),
`JWT_SECRET` (signs access tokens, section 7.12), `ADMIN_BOOTSTRAP_USERNAME` (`ADMIN_BOOTSTRAP_EMAIL` is read when only that old name is set) and
`ADMIN_BOOTSTRAP_PASSWORD` (the first admin account, section 7.11), `TLS_CERT_FILE` and `TLS_KEY_FILE`, `TRUST_PROXY`, `ALLOW_INSECURE_HTTP` and
`CORS_ORIGINS` (serving over the network, section 7.10), `TMDB_READ_TOKEN` (`11`), `TMDB_SYNC_SCHEDULE`
(the catalog-sync interval, section 7.6b; default off; `PLAYLIST_URLS` and `PLAYLIST_SYNC_SCHEDULE` are retired:
playlists are imported, section 7.2c), `OMDB_API_KEY` (detail enrichment, `11`
section 7; absent means details stay TMDB-shaped), `MOVIE_STREAM_TEMPLATE` and
`EPISODE_STREAM_TEMPLATE` (the stream address rule, section 7.5), `SEED_TEST_CHANNELS` (seeds the four live test
channels, section 7.7), `TEST_PAGE` (serves `/test/player.html`), `FIXTURE_DIR` (the test
videos, default `<tmp>/giga-stream-fixtures`), `CACHE_DIR` (default `<DATA_DIR>/cache`), `ADMIN_DIST` (the built
admin app served at `/admin/`, default `src/admin/dist`), `PLAYLIST_SYNC_MAX_BYTES`, `PLAYLIST_SYNC_MAX`,
`LOGO_INDEX_TTL_HOURS`, and the TMDB/OMDb base and daily-limit settings (`src/backend/src/config.ts` is the list).
`dev.env` loads first in development, then `.env`.

## 2. Conventions

Both servers answer in one envelope:

```ts
type Success<T> = { ok: true; data: T };
type Failure = { ok: false; error: { code: string; message: string } };
```

`code` is dotted and stable (section 8); `message` is a plain sentence fit for the statusbar. JSON fields
are `camelCase`, ids are opaque strings, times are Unix milliseconds, media positions are integer
milliseconds, and an absent optional value is omitted. An unknown `/api` route is `404 route.not_found`. A
malformed request is `400 request.invalid`. An unexpected failure is `500 internal.failure`, logged with a
correlation id, never with a stack trace. A private file path never appears in a URL, a response or a log.

An item in the user's data is named by kind and id:

```ts
type ItemRef = { kind: "title"; id: string } | { kind: "local"; id: string };
```

---

# Part A - The fileserver

## 3. Routes

### 3.1 Health

`GET /healthz` returns `{ role: "fileserver", version, backend: "up" | "down" }`.

### 3.2 Settings

`GET /api/settings` returns every setting with its default filled in. `PATCH /api/settings` takes any of
them; each row is validated on its own, and an invalid or unknown row refuses the whole request
(`422 settings.invalid`, naming the row). It returns the committed settings.
A stored value that no longer validates reads as its default; an unknown stored key is ignored.

| Key | Values | Default |
|---|---|---|
| `theme` | `dark`, `light`, `system` | `dark` |
| `themeAccent` | `amber`, `blue`, `green`, `violet`, `rose` | `amber` |
| `reducedMotion` | `system`, `off`, `on` | `system` |
| `uiZoom` | 0.5 to 3 | `1` |
| `autoplay` | boolean | `false` |
| `videoQuality` | `auto`, `higher`, `saver` | `auto` |
| `audioLanguage` | a BCP-47 tag or `null` (the stream's own default track) | `null` |
| `subtitleLanguage` | a BCP-47 tag or `null` (captions off) | `null` |
| `lowLatency` | boolean | `false` |
| `pictureFit` | `fit`, `fill`, `original` | `fit` |
| `resumeMode` | `ask`, `resume`, `restart` | `ask` |
| `watchedPercent` | `90`, `95`, `100` | `90` |
| `liveOnOpen` | `last`, `none` | `last` |
| `libraryView` | `grid`, `list`, `rows` | `grid` |
| `libraryScope` | canonical non-empty array of `movie`, `tv`, `local` | `["movie", "tv", "local"]` |
| `librarySort` | `newest`, `oldest`, `az`, `year` | `newest` |
| `showContinue` | boolean | `true` |
| `pauseHistory` | boolean | `false` |
| `rescanOnStartup` | boolean | `true` |
| `adminUrl` | an `http` or `https` URL | `http://127.0.0.1:8091` |

`adminUrl` is the admin backend's address. It must be `https`, or `http` on `127.0.0.1` or `localhost`,
unless `ALLOW_INSECURE_ADMIN` is set. Saving a new address drops the old connection, clears the live view
at once and connects to the new one (section 5).

### 3.3 Shell state

```ts
interface ShellState {
  activeSurface: "live" | "library" | "player";
  paneVisibility: Record<string, boolean>;   // pane id to shown
  paneSizes: Record<string, number[]>;       // pane id to CSS pixel sizes
}
```

Pane ids: `live.settings`, `live.channels`, `library.rail`, `library.filters`, `player.browser`,
`player.inspector`, `player.related`. This is the shape the archive stored, kept so an existing saved
layout still loads. `GET /api/shell-state` returns it. `PATCH /api/shell-state` takes any part of it; the
two maps merge by pane id. An unknown pane id or a size that is not a positive finite number refuses the
whole request (`422 settings.invalid`). It returns the committed state. Sizes
are stored as sent; the interface clamps them to the limits in `02` section 1.3 when it applies them.

### 3.4 Channels

```ts
interface Channel {
  id: string;
  name: string;
  category: string;
  number?: string;
  logoUrl?: string;        // an image-cache address (3.11)
  revision: number;        // the backend's revision of this channel
  streamUrl: string;       // the HLS address exactly as the backend has it; the player loads it
  status: "live" | "offline" | "unknown";   // the last probe (section 5.2)
  checkedAt?: number;      // when that probe ran
}

interface ChannelList {
  items: Channel[];                                   // ordered by number, then name
  categories: Array<{ value: string; count: number }>;
  revision: number;                                   // the backend revision the list was read at
}
```

| Route | Behaviour |
|---|---|
| `GET /api/channels` | query `q` (case-insensitive, over name and number) and `category`; the matching channels from the live view as a `ChannelList` (categories always counted over the whole view). An empty view answers an empty list, not an error |
| `POST /api/channels/refresh` | reads the channels from the backend again, probes every stream, replaces the live view and answers the whole `ChannelList`. `503 backend.unreachable` if the backend does not answer; `502 backend.bad_response` if its answer cannot be read |
| `PATCH /api/channels/last` | body `{ channelId }`; remembers the channel Live opens on next time and answers the committed id. `404 channel.not_found` if it is not in the live view |

The last channel is reported (in the state answer) only while it is in the live view. The view and
its dots are refreshed when they are read - on demand or by a refresh - never on a timer (section 5.1).

### 3.5 The library query

`GET /api/library` answers what Library's body shows (`06` section 4.2), combining TMDB's titles (browsed
through the backend, section 7.4) with the user's own files and data.

| Parameter | Values | Default |
|---|---|---|
| `view` | `all`, `history`, `favorites`, `collection` | `all` |
| `collectionId` | a collection id; required with `view=collection` | |
| `type` | repeatable `movie`, `tv`, `local`; absent or legacy scalar `all` means all three | all three |
| `q` | text, case-insensitive over title and file name | |
| `sort` | `newest`, `oldest`, `az`, `year`, `trending` | `newest` |
| `genre` | repeatable; an item matches any | |
| `year` | a year | |
| `watched` | `all`, `unwatched`, `watching`, `watched` | `all` |
| `cursor` | paging; the answer's `nextCursor` | |

```ts
interface LibraryItem {
  ref: ItemRef;
  watchId?: string;          // History rows only: the watch entry this row is
  kind: "movie" | "tv" | "local";
  title: string;             // a local file's display name
  year?: number;
  posterUrl?: string;        // an image-cache address; a local file's still
  quality?: string;          // a real value only: from a local file's height; TMDB titles have none
  genres: string[];
  favorite: boolean;
  collectionSource?: "manual" | "folder";   // present only for view=collection
  progress?: { positionMs: number; durationMs?: number; state: "watching" | "watched";
               season?: number; episode?: number };
}

interface LibraryPage {
  items: LibraryItem[];
  total?: number;            // when known (TMDB reports its own totals)
  nextCursor?: string;
  facets: { genres: string[]; years: number[] };   // the choices for the Genre and Year filters
  trending: boolean;         // whether the trending sort can be offered (11 section 4)
  titlesAvailable: boolean;  // false while the backend cannot be reached: title regions are skeletons
}
```

- **Media kinds.** Repeated `type` values select any canonical non-empty combination of Movies, TV and Local
  (`?type=movie&type=tv`). No `type` and legacy scalar `type=all` mean all three; scalar concrete values mean a
  singleton; duplicates canonicalize; `all` mixed with specifics means all; an empty/unknown value is
  `422 library.invalid`. Selected title kinds are browsed through the backend (section 7.4); selected local rows are
  merged first in `view=all`. Pages hold 20 mixed rows, and `nextCursor` carries the positions in local and title
  sources independently.
- **`history`, `favorites`, `collection`.** These hold items the user chose, so they are listed from the
  fileserver's own tables: `history` is the watch entries, newest first, one row per entry; `favorites` the
  favorited items; `collection` a collection's manual members and the files of its folders. A title's
  card facts come from the backend's title detail, kept in memory for the session. All filters and sorts
  apply over these lists.
- **Sorts.** `newest` and `oldest` by release date (a local file by when it was found); `az` by title;
  `year` by year, newest first; `trending` by TMDB's popularity, offered only while `trending` is true.
  A sort that is not offered is `422 library.invalid`.
- **Facets.** In `all`, the genres are TMDB's genre names for the kind shown (both lists when both kinds
  are) and the years run from this year back; in the other views they are the genres and years present
  in the list. A selected value stays listed even when nothing matches.
- **Watched** narrows by the user's own watch state; over TMDB's pages it is applied page by page, so a
  page can come back with fewer than 20 items.
- An unknown `collectionId` is `404 collection.not_found`.

`GET /api/library/continue` answers up to 10 `LibraryItem`s whose progress is `watching`, most recently
watched first (`06` section 4.2, Continue Watching).

### 3.6 Titles

The backend's titles as the fileserver caches them (section 5, plan `46`): the Library and the search read the cache; a title's
detail is read live (it carries the Player's sources, never cached) and written through. A title id is the kind and TMDB id, for example `movie-603` or `tv-1399`.

```ts
interface TitleDetail {
  id: string;
  kind: "movie" | "tv";
  title: string;
  year?: number;
  plot?: string;
  rating?: number;           // 0 to 10
  genres: string[];
  cast: string[];            // at most ten names
  runtimeMs?: number;        // a movie
  seasons?: Array<{ season: number; episodeCount: number }>;   // a series
  posterUrl?: string;        // image-cache addresses
  backdropUrl?: string;
  streamUrl?: string;        // a movie's stream address; the player loads it. Absent when no rule is set
  sources?: TitleSource[];   // the playable provider sources, in preference order (section 7.5)
}

interface Episode {
  season: number;
  episode: number;
  title?: string;
  airDate?: string;
  runtimeMs?: number;
  stillUrl?: string;         // an image-cache address
  streamUrl?: string;        // this exact episode's stream address; absent when no rule is set
  sources?: TitleSource[];   // this exact episode's playable sources (section 7.5)
}

interface TitleSource {
  providerId: number;
  name: string;              // display name ("VidSrc")
  url: string;               // the embed address for this exact title or episode, https (7.3)
  origin: string;            // the origin allowed to post messages
  order: number;
  startParam?: string;       // the resume parameter, seconds, when documented
  subtitlesParam?: string;   // the subtitle-language parameter, when documented
  frameOrigins?: string[];   // the nested-frame origins the player really uses (14 section 2.4)
  messageShape?: "vidsrc-status" | "player-event";   // absent: no documented messages
}
```

| Route | Behaviour |
|---|---|
| `GET /api/titles/:titleId` | a `TitleDetail`; `404 title.not_found` |
| `GET /api/titles/:titleId/seasons/:season` | `{ episodes: Episode[] }` in episode order; `404 title.not_found` |
| `GET /api/titles/:titleId/related` | `{ basis: "tmdb" \| "genre-year" \| "genre" \| "year", items: LibraryItem[] }`, at most 20 (`06` section 5.5) |

All three answer `503 backend.unreachable` while the backend cannot be reached. Related titles are TMDB's
recommendations (`basis: "tmdb"`); when TMDB has none, TMDB titles of the same genre and year, then
genre, then year. A title with neither `streamUrl` nor `sources` keeps Play disabled, with the reason
`No stream source is set up for titles.` as its tooltip.

- **With providers**, the fileserver reads active providers live from the backend (section 7.2b) when
  a title or episode is requested, and attaches the title's **sources** (section 7.5) to the answer —
  the provider records themselves stop at the fileserver. The client then plays
  through a source's embedded player. The fileserver holds the providers in its in-memory view
  like channels: read on demand, kept for the request, never stored.

### 3.7 Collections

```ts
interface Collection {
  id: string;
  name: string;
  type: "movie" | "tv" | "local";   // what it holds, the owner's tag
  itemCount: number;         // manual members plus the files of its folders
  folders: Folder[];
  scanning: boolean;         // any of its folders is being scanned
  createdAt: number;
  updatedAt: number;
}
```

| Route | Behaviour |
|---|---|
| `GET /api/collections` | every collection, alphabetical |
| `POST /api/collections` | `{ name, type }`; answers `201` with it |
| `PATCH /api/collections/:collectionId` | `{ name?, type? }` |
| `DELETE /api/collections/:collectionId` | removes it, its members, its folders and their file records; files on disk are never touched |
| `PUT /api/collections/:collectionId/items` | body `ItemRef`; adds a manual member (adding one already there is no change) |
| `DELETE /api/collections/:collectionId/items/:kind/:itemId` | removes a manual member |
| `GET /api/items/:kind/:itemId/collections` | `{ memberships: Array<{ collectionId, source: "manual" | "folder" }> }`; one row per collection the item appears in, so the interface never mistakes a folder-derived membership for one DELETE can remove |

A name is 1 to 80 characters after trimming *(default)* and unique, ignoring case (`422 collection.invalid`). An
unknown id is `404 collection.not_found`. Every write answers with the collection and its folders
as they now stand.

### 3.8 Folders and scans

```ts
interface Folder {
  id: string;
  collectionId: string;
  name: string;              // the folder's own name, never its path
  fileCount: number;
  scanning: boolean;
  lastScannedAt?: number;
}
```

| Route | Behaviour |
|---|---|
| `POST /api/fs/dialog` | opens the native folder picker (Electron only) and answers `{ token, name }`. A browser answers `409 fs.desktop_required`; a cancelled picker `409 fs.cancelled` |
| `POST /api/collections/:collectionId/folders` | `{ token }`; attaches the chosen folder and queues its scan; answers `201` with the `Folder` |
| `GET /api/folders/:folderId/scan` | the folder's queued, running or cancelling scan as a **streamed NDJSON body**: `found`, `probed`, `progress`, then terminal `done` or `cancelled`. Catch-up lines already produced are sent first; a scan that just settled remains available for terminal catch-up for this fileserver run. `409 job.not_running` only when there is no queued, active or retained terminal scan. A client that goes away does not stop the scan; the job runs on (3.9) |
| `PUT /api/folders/:folderId` | `{ token }`; replaces the folder's location and rescans it |
| `POST /api/folders/:folderId/rescan` | queues a scan; `409 job.running` if one is already running for it |
| `DELETE /api/folders/:folderId` | detaches it and removes its file records; files on disk are never touched |

A token stands for the chosen path inside the fileserver; it is single-use and expires after 10 minutes
*(default)* (`422 fs.invalid_selection`, as is a folder that is missing or not a folder). With `TEST_FOLDER_ROOT` set,
`POST /api/fs/dialog` takes `{ name }`, a folder directly under that root, so a browser test can choose one.

**A scan** walks the folder and its subfolders for `.mp4`, `.m4v`, `.mkv`, `.webm`, `.mov`, `.avi` and `.ts`
files *(default)*. New files are added, changed files (size or modified time) are updated, missing files are removed.
Each new or changed file gets a **media probe** (ffprobe: duration, width, height, video and audio codec,
container; a file ffprobe cannot read is kept and marked unplayable with the reason) and then a **still**
(one frame with ffmpeg's `thumbnail` filter, kept in the image cache). Scans, probes and stills run as jobs
(3.9), one scan per folder at a time. Files are only ever read.

The scan itself is the shared library's async generator (`scanFolder`, `src/shared/media`): it yields a
`found` event for each file as the walk discovers it, then a `probed` and a `progress` event for each file
whose facts come back, then `done` — and the scan route (`GET /api/folders/:folderId/scan`) streams those
events line by line, NDJSON, as the generator yields them. That is how progress reaches the interface with
no socket and no polling: one request, one streamed answer, in the shape the generator already produces.
The HTTP wire shape removes every `absolutePath` before serialization. `found` and `probed` file entries carry
only the relative `path`, size/modified facts and documented media facts; terminal `done` carries only
`found`, `probed` and `unplayable` counts (no repeated file inventory). A local absolute path never crosses the
server boundary, and retained terminal catch-up is bounded.

### 3.9 Jobs

```ts
interface Job {
  id: string;
  kind: "folder-scan" | "media-probe" | "poster-fetch";   // poster-fetch makes a local file's still
  label: string;             // a short sentence: "Scanning Movies", never a path
  folderId?: string;         // required for folder-scan jobs; absent for other kinds
  state: "queued" | "running" | "cancelling" | "done" | "failed" | "cancelled" | "interrupted";
  percent?: number;
  error?: { code: string; message: string };
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}
```

| Route | Behaviour |
|---|---|
| `GET /api/jobs` | every job, newest first |
| `POST /api/jobs/:jobId/cancel` | a queued or running job; answers `202` with it in `cancelling`. `409 job.not_running` otherwise |
| `DELETE /api/jobs/:jobId` | removes a settled job; `409 job.not_settled` otherwise |

An unknown id is `404 job.not_found`. At start, every job left `queued`, `running` or `cancelling` is marked
`interrupted`; none is resumed. The kind names are the ones the existing database's `jobs` table accepts.

### 3.10 Local media

`GET|HEAD /api/media/local/:localFileId` serves a file by its id: a full response or one byte range (`206`;
an unsatisfiable range is `416 playback.range_invalid`), with `Accept-Ranges`, a strong `ETag`, `If-Range`,
`Content-Length` and the type from the file's container. An abandoned request stops reading. An unknown id
or a file gone from disk is `404 media.not_found`. It never redirects to `file:`.

`GET /api/media/local/:localFileId/info` answers `{ id, title, durationMs?, sizeBytes?, width?, height?,
videoCodec?, audioCodec?, container?, playable, error?, collectionIds, folderName }` for the Player's
details (`06` section 5.2).

### 3.11 The image cache

`GET|HEAD /api/images/:imageId` serves a cached image with an `ETag` and a long cache lifetime; an unknown
id is `404 image.not_found`.

- Every image address the fileserver passes to the interface (a channel's logo, a title's poster,
  backdrop or episode still) is rewritten to `/api/images/<imageId>`, where `imageId` is derived from the
  source address. The source must pass the backend's address rule (section 7.3).
- The first request fetches the image from its source (10 second timeout and at most 10 MiB *(default)*, an
  `image/*` answer only) and keeps it under `DATA_DIR/images`; later requests are served from disk. A source that
  fails answers `404 image.not_found`, and the interface shows the fallback.
- A local file's still is written there by its `poster-fetch` job.
- Images older than six months are deleted at start (`11` section 6).

### 3.12 Favorites

`PUT /api/favorites/:kind/:itemId` adds a favorite; `DELETE` the same address removes it. Both are
idempotent, answer `{ ref, favorite }`.

### 3.13 Watch history

```ts
interface WatchWrite {
  item: ItemRef;
  season?: number;           // a series episode only
  episode?: number;
  positionMs: number;
  durationMs?: number;
  playbackId: string;        // minted by the interface for each playback
  seq: number;               // 1, 2, 3 ... within that playback
}
```

| Route | Behaviour |
|---|---|
| `PUT /api/watch` | records progress for the item (and exact episode). A write whose `seq` is not higher than the last applied for its `playbackId` is ignored, so a late write never rewinds progress. At 95 percent of the duration *(default)* the entry becomes `watched`. Answers `{ applied, entry }`. **Where it lands (owner, 2026-10-20, plan `63`):** a request marked `x-giga-runtime: electron` writes the fileserver's own store, as the desktop always has; any other request is a browser - it must carry the account's bearer and is passed to the backend's `PUT /api/account/watch`, so a browser's history is the account's cloud rows; a browser write with no account is refused `401`. The same fork governs the two `DELETE`s |
| `DELETE /api/watch/:watchId` | removes one entry (Remove from History); the fork above decides which store |
| `DELETE /api/watch` | clears all history; favorites, collections and files are untouched; the fork above decides which store |

Channels never create watch entries. `entry` is `{ watchId, item, season?, episode?, positionMs, durationMs?,
state, updatedAt }`; an unknown `watchId` is `404 watch.not_found`.

## 4. State and updates

There is no socket. `GET /api/state` answers the complete picture in one request:

```ts
interface State {
  version: string;
  host: { runtime: "electron" | "browser" };   // the folder picker exists only in "electron"
  settings: Settings;
  shell: ShellState;
  backend: BackendState;
  channels: ChannelList;            // the whole live view; empty before the first read
  lastChannelId?: string;
  collections: Collection[];
  jobs: Job[];                      // unsettled jobs and the 50 most recent settled ones (default)
}

interface BackendState {
  url: string;                      // adminUrl
  connected: boolean;
  revision?: number;                // the backend's revision at the last read
  readAt?: number;                  // when the live view was last read
  error?: { code: string; message: string };
}
```

- **Writes answer.** Every write route returns what changed (the settings, the shell state, the
  collection, the job), so the interface learns the consequence of its own action from the answer
  itself. Nothing is echoed on a second channel, because there is no second channel.
- **Reads happen on interaction.** The interface asks for state when it mounts, when it switches
  surface, after its own actions, and when the person presses Refresh. Nothing re-reads on an
  interval (`01` section 4.4).
- **Long work streams.** A folder scan answers as one streamed NDJSON body reporting progress as it
  happens (3.8); every other route answers whole.
- **Connection is a fact of the last read.** `backend.connected` and `backend.readAt` describe the
  last request, not a live link: the fileserver holds no connection open to the backend (5.1) and
  learns its reachability by asking. The statusbar's word follows the last request's outcome.
- The parts of the answer are validated separately by the interface (`02` section 2.3): a channel
  list that cannot be read becomes "no list" and one notice, and never costs the saved shell.

## 5. The backend cache (owner, 2026-10-18; plan `46`)

**Transport amendment (owner, 2026-10-20; plan `64`).** Every channel and title cache fill below reads the admin
Turso database directly. References in this section to backend catalog HTTP routes describe the old transport and are
superseded. Provider records are still read through `GET /api/admin/providers` and are never cached.

### 5.1 Freshness: launch and page reads, no timers

The fileserver keeps a **snapshot of the backend's channels and titles in its own database** (section 6), written by a
background sync. A dataset (`channels`, `titles`) is **due** when it was never synced, its `source_key` (a hash of the current
`adminUrl`) differs, `now - synced_at >= CACHE_WINDOW_MS` (6 hours), or the clock moved back; a dataset whose last attempt failed
is not due again for `CACHE_RETRY_GAP_MS` (5 minutes) unless the user asks. The check runs **only** at launch (the app starts
the sync detached) and when a page reads the dataset (`GET /api/channels`, `GET /api/state`, every `/api/library*` and title
route): **no timer drives it.** A warm, due dataset is served from the cache at once and refreshed in the background
(stale-while-revalidate, one run at a time per dataset); a cold one (never synced) is awaited once, then served. The page that
triggered a refresh is not updated mid-view; the next read sees the new data. `POST /api/channels/refresh` and
`POST /api/library/refresh` force a sync, join a run in flight and answer `503 backend.unreachable` / `502
backend.bad_response` on failure with the cache still serving. An `adminUrl` that points at a different backend purges the cache.

### 5.2 What is synced

Public reads only (no `Authorization`, no cookie). **Channels:** one `GET {adminUrl}/api/channels`, replaced whole in one
transaction (id, position, name, number, category, logo address, stream address, revision). **Titles:** the genre dictionary,
then `GET {adminUrl}/api/titles/catalog?after=<id>&limit=500` pages (store-only, never TMDB; section 7.4) upserted page by page,
then a sweep of titles the catalog no longer lists. A failed or cut-off sync keeps the cache and stamps only an error code. What is
never stored: providers, a title's `streamUrl` and `sources`, episodes. The fileserver **no longer probes streams** and keeps no
live/dead status: the admin curated the list. The previous live view, its 30 second TTL (`LIVE_VIEW_TTL_MS`) and the probe are removed.

### 5.3 Reads

Channels (list, categories, search, last channel) and **every Library read** (`view=all` pages, sorts, filters, facets, totals,
trending by the stored popularity, history, favorites, collections, Continue, and **search, which only queries the cache**) are
answered from the cache; with the backend unreachable they keep working from it. A title's detail (`GET /api/titles/:id`) is read
live first, because it carries the Player's `sources` and `streamUrl`, which are never cached; on success its display fields are
written through to the cache, and when the backend is unreachable it is answered from the cache without sources (`fromCache:
true`). Seasons, episodes and related stay live.

## 6. Storage

One `node:sqlite` database in `DATA_DIR`, with one owner, WAL where supported and foreign keys on.
Migrations are numbered, forward-only and transactional, and a database at a newer schema than the
fileserver knows is refused (`store.newer_schema`).

Migrations `001` and `002` are kept exactly as they were in the archive, so an existing database opens
unchanged. **Migration `003`**:

- copies `admin_target.base_url`, if a row exists, into `settings` as `adminUrl`, then drops `admin_target`;
- renames the stored setting `galleryView` to `libraryView`, keeping its value;
- changes a stored `themeAccent` of `"emerald"` to `"green"`;

so nothing the user saved resets. After it, the database holds:

| Table | Holds |
|---|---|
| `settings` | a key and a validated JSON value |
| `shell_state` | the one shell-state record |
| `channel_state` | the last channel id |
| `collections` | id, name, times |
| `collection_items` | a collection's manual members, by item kind and id |
| `collection_folders` | an attached folder: its private path, its name, the last scan |
| `local_files` | a found file: its private path, its folder and collection, size, modified time, the probe's facts, playable or not and why, its still's image id |
| `favorites` | an item kind and id, when it was added |
| `watch_entries` | an item kind and id, season and episode, position, duration, state, updated |
| `jobs` | kind, label, state, percent, error, times; the request holds ids, never a path |

The image cache is files under `DATA_DIR/images`, not rows. **Migration `006` (owner, 2026-10-18, `46`) adds the backend cache:**
`cache_state` (per dataset: `source_key`, `synced_at`, `attempted_at`, `error_code`, `revision`, `run`), `cached_channels` (id,
position, name, number, category, logo address, stream address, revision), `cached_titles` (id, kind, title, year, rating,
popularity, poster and backdrop addresses, and the nullable detail columns plot, cast, runtime, seasons, detail time, plus the
sweep bookkeeping `in_catalog` and `seen_run`), `cached_title_genres` and `cached_genres`. There is no table of providers, and no
column for a title's `streamUrl` or `sources`, a token or a secret.

---

# Part B - The admin backend

## 7. The admin backend

One Fastify server with its own `node:sqlite` database in its `DATA_DIR`, run on the user's machine, a LAN
host or a cloud host (section 7.10). It holds:

- **the channels** (section 7.2): public reads, so the fileserver can read them; create, update and
  delete by a signed-in admin;
- **the providers** (section 7.2b): the titles' playback sources, the same model as the PoC's provider
  records (`14` section 5.1, `16` section 4); public reads so the fileserver can hand each title its
  playable providers, create, update and delete by a signed-in admin;
- **the admin accounts** (section 7.11): who may sign in, and what each may do;
- **sign-in** (section 7.12): username and password give a short-lived JWT access token and a rotating
  refresh token; every change is made with an access token;
- **the audit log** (section 7.13): who changed what, and when.

It is also the only program that calls TMDB (`11`). A change is live as soon as it is saved; there are no
drafts. Every channel or provider change raises the backend's `revision` counter by one, which a reader
sees in its next answer (the backend has no socket, `7.8`). The routes are the backend's whole interface; a screen for administrators is not part
of this document.

### 7.1 Health

`GET /healthz` returns `{ role: "admin-backend", version, revision, tmdb: "configured" | "absent", liveChannels }`
(`liveChannels` counts the live channels the engine holds).

### 7.2 Channels

```ts
interface BackendChannel {
  id: string;
  name: string;
  category: string;
  number?: string;
  logoUrl?: string;        // the logo's source; the fileserver's image cache fetches it
  streamUrl: string;       // the HLS address
  tvgId?: string;          // the playlist's tvg-id; the playlist sync's update key (7.2c)
  source?: string;         // derived from the parent playlist (its host, or its file name), never stored (7.2c)
  playlistId?: number;     // the parent playlist, a foreign key with cascade (7.2c); absent on a hand-made row
  // Admin read only (not on the public channel answer): the sync's per-channel verdict and cached logo (7.2c).
  status?: "live" | "dead"; // the last stream verdict of this channel's own URL; absent = not checked
  checkedAt?: number;      // when that verdict was taken
  cachedLogoUrl?: string;  // the relative /logos/c/<file> of the backend's cached copy; logoUrl stays the source address
  revision: number;        // the revision at which this channel last changed
}
```

| Route | Who | Behaviour |
|---|---|---|
| `GET /api/channels` | anyone | every channel, ordered by number then name: `{ items: BackendChannel[], revision }` |
| `GET /api/channels/:channelId` | anyone | one channel |
| `POST /api/channels` | signed in | `{ name, category, number?, logoUrl?, streamUrl }`; answers `201` with the channel. A live channel's `number` is optional too (owner, 2026-10-17: there is no guide, the admin sends none; an existing number is kept; several live rows may have none) |
| `PATCH /api/channels/:channelId` | signed in | changes any of those fields |
| `DELETE /api/channels/:channelId` | signed in | removes it; answers `{ id }` |

An unknown id is `404 channel.not_found`; an invalid field is `422 channel.invalid`, naming the field.
Each change raises the revision and writes an audit entry.

**Since the merge of the live server (`26`, built)** a channel row also carries `kind` (`stream` or `live`), `enabled`,
`editedFields`, `syncName`, `playlistId`, and for `kind: live` its mode, captions, variants, folder or videos; the live
channels are served by this backend itself. The table above is the stream rows' shape; the complete route table is
`26` section 3.3: `POST`/`PATCH` take a body discriminated by `kind`, and signed-in admins also have
`GET /api/admin-channels` (state, problem, renditions, playlist, now playing, fault), `PUT`/`DELETE /api/channels/:id/fault`,
`POST /api/channels/:id/rebuild`, `POST /api/channels/:id/revert`, `GET|HEAD /live/:id/master.m3u8` (and its renditions and
segments, with `Range`), `GET /logos/:id.png`, `GET /test/player.html` (only with `TEST_PAGE=true`), and the static
`/admin/` app. Further codes: `channel.taken` (409), `fault.invalid` (400), `path.invalid` (400), `playlist.unavailable`
(500), `range.unsatisfiable` (416).

**`GET /api/admin-channels` paging (`41` section 3.1, built).** Signed in, `Cache-Control: no-store`. Without query
parameters it answers every row, `{ items: AdminChannel[], revision }`, exactly as before. `limit` turns paging on and is
required by every other parameter (a filter or sort without it is `400 request.invalid`, `field: limit`, never silently
ignored):

| Parameter | Values | Meaning |
|---|---|---|
| `limit` | 1 to 200 | page size |
| `offset` | 0 to 10,000,000 (default 0) | rows to skip |
| `q` | up to 120 characters (trimmed; empty is no search) | case-insensitive contains over `name`, `number`, `tvg_id` and the parent playlist's name and host; `%`, `_` and `\` are literal |
| `kind` | `live` \| `stream` | |
| `origin` | `synced` \| `edited` \| `manual` | stream rows only: has a playlist and no edits, has a playlist and edits, no playlist (`playlist_id`) |
| `status` | `live` \| `dead` \| `unchecked` | stream rows only: the sync's verdict (`7.2c`); `unchecked` = never checked |
| `playlist` | a playlist id | the channels of that playlist |
| `enabled` | `true` \| `false` | |
| `state` | `preparing` \| `starting` \| `live` \| `restarting` \| `stopped` \| `failed` | live rows only: the engine's state of each live row, applied as an id set |
| *(`source`)* | *removed* | the wire field `source` is derived from the playlist and nothing filters by it any more |
| `sort` | `number` (default) \| `name` \| `category` \| `kind` \| `playlist` | `number` is numeric; rows with no number (or no playlist) last in either direction |
| `dir` | `asc` (default) \| `desc` | |

The paged answer is `{ items: AdminChannel[], revision, total, offset, limit }`; `total` counts the rows the filters keep,
before `limit`. The order is total and stable: the sort, then the name (case-insensitive), then the id. Paging runs in SQL
(`store/channel-page.ts`) and only the returned rows are decorated with the engine's state. `revision` is the change marker.
An invalid value is `400 request.invalid` naming the field.

### 7.2b Providers

Providers are the sources that produce playback URLs for a title. They follow the same admin-edit,
public-read pattern as channels: the fileserver reads them live, and the admin interface edits them.

```ts
interface BackendProvider {
  id: number;
  name: string;
  source: string;            // string identifying the external service; unique per provider
  is_active: boolean;        // whether the provider should be used
  order: number;             // preference order for auto-selection and the picker's sort
  family: "embed" | "stream";// how it plays (16 section 3)
  movieTemplate?: string;    // embed address with {tmdbId} (embed family; null: no movie source)
  episodeTemplate?: string;  // embed address with {tmdbId}, {season}, {episode}
  startParam?: string;       // the documented start-position parameter, seconds
  subtitlesParam?: string;   // the documented subtitle-language parameter
  origin?: string;           // the origin allowed to post messages (embed family)
  frameOrigins?: string[];   // the nested-frame origins the player really uses (14 section 2.4)
  messageShape?: "vidsrc-status" | "player-event";   // the documented message shape, if any
  created_at: string;        // ISO-8601 timestamp
}
```

| Route | Who | Behaviour |
|---|---|---|
| `GET /api/providers` | anyone | every provider: `{ items: BackendProvider[] }` |
| `GET /api/providers/:providerId` | anyone | one provider |
| `POST /api/providers` | signed in | `{ name, source, order?, family, movieTemplate?, episodeTemplate?, startParam?, subtitlesParam?, origin?, frameOrigins?, messageShape? }`; answers `201` with the provider |
| `PUT /api/providers/:providerId` | signed in | changes any of those fields |
| `DELETE /api/providers/:providerId` | signed in | removes it; answers `{ id }` |

An unknown id is `404 provider.not_found`; an invalid field is `422 provider.invalid`, naming the field.
Each change raises the backend revision by one and writes an audit entry. The fileserver reads providers
live on demand, as it reads channels (`3.4`), so its next read has the change.

**Seeding.** `src/backend/scripts/seed-providers.ts` is the seeder: run by hand, it signs in with the
bootstrap admin, skips when any provider exists, and creates the catalog through these routes — every
embed host of `18` section 2 with its templates and parameters as captured (TV shapes marked verified or
presumed there), and the stream-family records with their own `source` values and no templates. A provider
of the stream family produces no source until one is proven playable without a resolve step (`00`
section 5).

### 7.2c The playlist sync

**Import and sync are two different actions** (owner, 2026-10-18; plan `43`). The **import** is a one-shot act by an
operator: it creates a playlist record and all its channels, in one request, from a file or a web address. The
**sync** is a recurring job per playlist: it caches the channels' images and records whether each stream is live. Import
does no per-channel network work; sync owns every image download and stream check. They share only the parser and the
address rule, never a lock or a call.

A channel created by an import carries `playlistId`, a real foreign key to its parent playlist (`ON DELETE CASCADE`;
foreign keys are enforced); an operator's hand-made rows (`playlistId` absent) are never touched by either. Imported
channels land **disabled** (`enabled: false`); the operator enables them (the admin's bulk `Enable`, `7.2`).

- **Playlist record** (`playlists`): `id`, `name` (unique, case-insensitive), `kind` (`file` or `url`), `url` (a secret:
  the web address, `url` kind only, unique; **returned in full to a signed-in admin, not masked** (owner, 2026-10-18);
  audit and logs still carry the host only), `fileName` (`file` kind only,
  unique), `host` (`url` kind only), `enabled`. There is no stored sentence and no sync timestamp on it: the last run
  lives on the playlist's one sync job (`26` 3.11). A derived name (the file name, or for a web address the URL's last
  path segment without its extension, else the host) that clashes is suffixed ` (2)`, ` (3)`; only a typed name is
  `409 playlist.taken`; a file re-import keeps the playlist's current name. The uploaded file itself is **not kept**. Precedence of the three
  `enabled` switches: a channel is published when `channel.enabled` and (it has no playlist or `playlist.enabled`); a
  disabled playlist stops its sync, manual or scheduled; a disabled job stops only the scheduled run.
- **Import.** `POST /api/playlists/import` takes `multipart/form-data` with exactly one `file` part (at most 8 MiB; a
  second file part or a truncated one is `400 request.invalid`); the playlist's name and `fileName` come from the
  sanitized filename (basename, lowercase, runs of anything but `a-z0-9._-` become `-`,
  must end `.m3u` or `.m3u8`; the same `fileName` updates the same playlist in place). `POST /api/playlists` with
  `{ url, name?, enabled? }` is the **web-address import**: it fetches the address once through the guarded fetch (7.3;
  15 s, 8 MiB hard cap, never a silent truncation). Both **read and parse first and write nothing until they succeed**:
  not an M3U (`#EXTM3U` as the first non-empty line, or an `#EXTINF` in the first 20 lines) is `422 playlist.invalid`; an
  unreachable address is `503 playlist.unreachable`; neither creates a record. Every entry's `streamUrl` and `logoUrl`
  passes the address rule (7.3; a failing entry is skipped and counted, never imported broken), names are NFC-normalised,
  duplicates (`name` and `streamUrl`) are dropped, at most `PLAYLIST_SYNC_MAX` *(default 5000)* entries are taken, and the
  entries are matched only against **this playlist's own rows** in three passes (exact name and stream; name alone when
  unique; stream alone; `tvgId` only breaks ties). Then ONE synchronous transaction does the duplicate check, the playlist
  insert, the channel writes (updates change `streamUrl`, `logoUrl`, `category`; new entries are created disabled; nothing
  is ever deleted), the playlist's sync job and one revision bump **only if a row changed** (a re-import with nothing new
  writes and bumps nothing). The `UNIQUE` columns decide a concurrent double import: the loser is `409 playlist.taken`
  (the same for a duplicate name, `url` or `fileName`). The answer is the playlist view (below) plus `created` and
  `imported { created, updated, skipped, refused, refusalExamples }` (the examples carry an entry's name only, never an
  address); `201` for a new playlist, `200` for a replaced one. The playlist's sync job (`Sync <name>`, `24h`,
  enabled, due at once) is created in the same transaction.
- **Sync (a `playlist` job; the job's `playlistId` column, one job per playlist).** `POST /api/jobs/:id/run` starts it
  and answers `202` at once; the result is read on a refresh. One run at a time **per playlist** (`409 sync.busy`); two
  one shared limit bounds all playlists (16 stream checks and logo downloads at once, and at most 2 at once to one host;
  every URL still gets its own request); a playlist job's schedule is at least 15 minutes (`422 job.invalid`); the
  scheduler starts a run and re-arms at once, never awaiting it. A playlist job is part of its playlist: it is created
  and deleted with it, `POST /api/jobs` creates catalog jobs only, `DELETE /api/jobs/:id` on a playlist job is
  `422 job.invalid`, `PATCH` changes `enabled` and `schedule` only, and its name is not stored (it reads `Sync <playlist
  name>`). Steps: (1) refuse a
  disabled playlist (`422 job.disabled`); (2) a **file** playlist is never re-read (the upload was the read); a **web**
  playlist is fetched on every run and imported (create and update only; it writes only if something changed); a fetch
  failure is recorded as `source: unreachable` and the run goes on; (3) fill missing `logoUrl`s from the iptv-org index
  (`tvgId` first, then the name with accents folded; an existing `logoUrl` wins; the index is loaded once per run, a bad row
  is skipped, a failed load is retried after one hour); (4) **cache the images**: each distinct `logoUrl` not tried in
  the last 7 days, or whose cached file is missing, is downloaded (10 s, 1 MiB, `image/*` with PNG, JPEG, GIF or WebP magic
  bytes, at most 1 MiB; SVG is never cached) into `DATA_DIR/logo-cache/<first 32 hex of
  sha256(bytes)>.<ext>`; an identical image already on disk is not rewritten, so identical images are stored once; a
  failure keeps the previous file; at the end of the run, files no channel references are deleted (a row whose file is
  missing is re-downloaded next run);
  (5) **check every stream**: each of the playlist's channels, enabled or not, ordered by check time (never checked first,
  then oldest, then id), is asked for **its own exact stream URL** (5 s, first 64 KiB, 16 at a time, 10 minutes in all):
  `live` when the answer is 2xx and the body, after a byte-order mark and whitespace, starts `#EXTM3U`, else `dead` (a
  DNS or refused failure on that URL is `dead` for that channel only; a stream that is not HLS is `dead`). A host-level
  check (ping, TCP connect, DNS) is never a channel's verdict and there is no host shortcut. A verdict is written only
  per distinct URL (`WHERE playlistId = ? AND streamUrl = ?`, so a channel edited or removed mid-run no longer matches), in
  batches of 200, **taking no revision** (the sync-owned columns are admin-only; the revision counts what a public reader
  can see); (6) record on the job `lastRunAt`, `lastResult` (`ok`, `failed` or `stopped`) and the typed `lastCounts`.
  **Counts contract** (the backend and the admin each hold a schema; this table is the contract): a playlist run is
  `{ created, updated, skipped, refused, source: "unchanged"|"updated"|"file"|"unreachable", logosCached, logosFailed,
  live, dead, unchecked, refusalExamples, stopped? }`; a catalog run is `{ titles, stale, stopped? }`; a failed run of
  either is `{ code }` (the `AppError` code, or `internal.failure`). No sentence is stored and an exception's message is
  never stored; the admin words the result. The run is audited as `playlist.synced` with the counts and the host.
- **Stop and resume.** `POST /api/jobs/:id/stop` (signed in, audited `job.stopped`, `202`) cancels a running playlist job
  and keeps everything already written (`409 job.not_running` when idle; a catalog job stops too, `44`). A job answer carries `progress` while it runs, and
  `GET /api/jobs/events` (a read-only server-sent-event stream for a signed-in admin: `snapshot`, `progress`, `finished`;
  job ids and numbers only; no heartbeat; `01` 4.4's dated exception) pushes it. A stopped run
  records `lastResult: stopped` and `stopped: true` in its counts, and sets `lastRunAt`, so the schedule does not fire it
  early. **Resume** is `POST /api/jobs/:id/run` again: the check order and the 7-day image window make it continue where
  it stopped. Pausing the schedule is the job's `Enabled` toggle; it does not stop a run in progress.
- **Channels' fields** `status` (`live`, `dead`; absent means not checked), `checkedAt`, and `cachedLogoUrl` (the relative
  `/logos/c/<file>`) join the **admin** channel answer only (`7.2`); the public channel read is unchanged; `logoUrl` stays
  the source address everywhere. A write that changes a channel's `streamUrl` or `logoUrl` clears the dependent verdict
  or cached file in the same statement. The channels' `source` is derived from the playlist (its host, or its file name),
  not stored.
- **Revision.** An import bumps the revision once, only if it wrote a row. A sync's verdict and logo writes take none
  (admin-only columns); a playlist's `enabled` change does bump it (it changes the published set), and a public channel
  read joins the playlist's `enabled`.

| Route | Who | Behaviour |
|---|---|---|
| `POST /api/playlists/import` | signed in | the file import above |
| `POST /api/playlists` | signed in | the web-address import above |
| `GET /api/playlists`, `GET`, `PATCH`, `DELETE /api/playlists/:id` | signed in | the record; `PATCH` renames, enables, or replaces a `url` playlist's address; `DELETE` removes the playlist **and its channels and sync job in one transaction** (see below; one revision bump, one `playlist.deleted` audit entry with the counts and host) |
| `POST /api/jobs/:id/run`, `POST /api/jobs/:id/stop` | signed in | run (start, resume) and stop a job |
| `PATCH /api/channels` | signed in | bulk `{ enabled, ids[] }` (1-5,000, one request, no client chunking) on stream channels; one transaction, one revision, one audit entry `channel.enabled_bulk`; answers `{ changed, unchanged, skipped }` (flipped / already in that state / live-kind or unknown ids) |
| `GET /logos/c/<file>` | public | a cached image by its hash name (`^[0-9a-f]{32}\.(png\|jpg\|gif\|webp)$`; `immutable`, `nosniff`) |

`GET /api/playlist-sync` and `POST /api/playlist-sync` no longer exist: the jobs are the sync. The playlist view is
`{ id, name, kind, url?, host?, fileName?, enabled, channels, enabledChannels, live, dead, lastRunAt?, lastResult?,
lastCounts? }` (the last three joined from its job). Every import and every sync is one audit entry (`playlist.imported`,
`playlist.synced`) with counts and each playlist's **host** only (never its query, which can carry credentials, and never
a logo address or an exception message). A body that is not an M3U playlist is `422 playlist.invalid`; a duplicate is
`409 playlist.taken`. `PATCH` may replace `url` only for a `url` playlist (`422 playlist.invalid`, field `url`). **`DELETE`
aborts that playlist's running sync (waiting at most 10 s), then deletes the playlist and, through the foreign keys, its
channels and its sync job, in one transaction** (hand-made channels and other playlists' channels are untouched; the
answer is `{ id, deletedChannels, deletedJobs }`).

### 7.3 Stream and image addresses

Every `streamUrl`, `logoUrl`, address produced by the stream rule (7.5) and image source must be `http` or `https` and
carry no credentials (owner, 2026-10-18: many IPTV playlists use `http`; the earlier https-only rule is retired, and with
it `ALLOW_LOOPBACK_STREAMS`). TMDB's image host is `https` and passes.

Every remote address the **backend itself fetches** because it came from playlist content or an admin (a playlist, the
logo index, a logo, a stream check) goes through one function built on `node:https`: it refuses a host that resolves to
**loopback** (`127/8`, `::1`, `0.0.0.0`, `::`) or **link-local** (`169.254/16`, `fe80::/10`) addresses (an IPv4-mapped IPv6
form is judged by the IPv4 inside it), so a playlist cannot aim the backend at itself or at a cloud metadata address;
private LAN addresses (`10/8`, `172.16/12`, `192.168/16`) are allowed, because a home IPTV box lives there. It follows at
most 3 redirects (each re-checked the same way), refuses a URL with credentials, asks for `identity` encoding, caps the
bytes while streaming, applies a timeout, and sends no cookies and a fixed User-Agent. The fixed provider hosts (TMDB,
OMDb) and the backend's own calls are not covered.

### 7.4 Titles

**`GET /api/titles/catalog?after=<id>&limit=<1..500>`** (public, `Cache-Control` as the other public reads; owner 2026-10-18, plan
`46`): the fileserver's sync read. Store-only, it **never asks TMDB**. Enabled titles (synced and manual, edited values already in
the payload) in `id` order after `after`; answer `{ items: [{ id, kind, title, year?, rating?, popularity?, posterUrl?,
backdropUrl?, genres }], next? }`, where `next` is the last id when more follow; it never carries `streamUrl`, `sources` or
`enabled`; registered before `/api/titles/:titleId`; a stored row that fails the stored-title schema is skipped. The **public channel
answer** (7.2) also carries `cachedLogoUrl` (the backend's hash-named cached logo) for stream rows.

The backend browses, searches and describes TMDB's titles on demand (`11` section 5). Titles are also ordinary records
an admin can create, edit and delete (`POST`, `PATCH`, `DELETE /api/titles`, `26` section 3.11; a sync never overwrites
an edited title, and a deleted synced title stays deleted until it is restored). Any movie or series TMDB has can be listed. A title id is the kind and TMDB id, `movie-603` or `tv-1399`.

```ts
interface BackendTitle {
  id: string;
  tmdbId: number;
  kind: "movie" | "tv";
  title: string;
  year?: number;
  genres: string[];
  rating?: number;
  posterUrl?: string;        // TMDB image addresses (11 section 2)
  backdropUrl?: string;
  popularity?: { score: number; readAt: number };   // TMDB popularity and when it was read
  seasons?: Array<{ season: number; episodeCount: number }>;   // a series (remediation 2026-10-17)
  streamUrl?: string;        // a movie's address from the rule (7.5)
}
```

| Route | Behaviour |
|---|---|
| `GET /api/titles` | a page of titles: `kind` (`movie`, `tv`, or both), `sort` (`newest`, `oldest`, `az`, `year`, `trending`), `genre` (repeatable), `year`, `page`; answers `{ items: BackendTitle[], page, totalPages, totalResults, skipped }` (`skipped`: rows of this page left out, below) |
| `GET /api/titles/search` | `q`, `kind`, `page`; TMDB's search, people left out; the same answer shape |
| `GET /api/titles/genres` | TMDB's genre names for movies and for series |
| `GET /api/titles/:titleId` | the title with `plot`, `cast` (ten names), `runtimeMs` (a movie) or `seasons` (a series); a thin list row is refetched whole on read; with `OMDB_API_KEY`, an `omdb` block (age rating, ratings, awards, box office — `11` section 7.2) |
| `GET /api/titles/:titleId/seasons/:season` | `{ episodes }`: each with season, episode, title, air date, runtime, still address and its `streamUrl` from the rule |
| `GET /api/titles/:titleId/recommendations` | `{ items: BackendTitle[] }`: TMDB's recommendations, first page, in TMDB's order |
| `DELETE /api/titles/:titleId` | signed in, audited `title.deleted`; answers `{ id }`. A title made by hand is deleted for real; a **synced** title is deleted and **stays deleted** (below) |
| `GET /api/titles/stored` | signed in, `Cache-Control: no-store`, never a public read (`PUBLIC_READ` excludes it); every row of the `titles` table, synced and made by hand, read from the store alone (**never TMDB**; it works with no TMDB token). Query: `limit` 1 to 200 (default 100), `offset` 0 to 10,000,000 (default 0), `q` up to 200 characters (case-insensitive contains over the stored title, `%` `_` `\` literal), `kind` `movie`\|`tv`\|`all` (default), `origin` `tmdb`\|`manual`\|`all` (default), `edited` `true`\|`false`, `enabled` `true`\|`false`, `sort` `title` (default, case-insensitive)\|`year`\|`rating`\|`fetched`, `dir` `asc` (default)\|`desc`. Answers `{ items: StoredTitleRow[], total, offset, limit, inventory: { movie, tv, manual, edited, disabled }, version }` (`29` section 5): `total` after the filters; `inventory` counts the whole store, whatever the filters; `version` is `count:max(fetched_at)` of the whole table. The order is total: the sort (rows without a year or rating last in either direction), then the id. A deleted synced title has no stored copy, so it is never listed. Invalid values are `400 request.invalid` naming the field (`41` section 3.2) |
| `GET /api/titles/deleted` | signed in, `Cache-Control: no-store`; `{ items: DeletedTitle[] }`, the latest deletion first |
| `DELETE /api/titles/deleted/:titleId` | signed in, audited `title.restored`; the id is `movie-603`; removes the record and answers `{ id }`; `404 title.not_found` when none is recorded |

**A deleted synced title stays deleted** (owner, 2026-10-17; migration `020-deleted-titles.sql`). Deleting a title whose
origin is `tmdb` removes the stored copy (and any admin edits with it) and records its TMDB identity in `deleted_titles`
(`kind`, `tmdb_id`, `title`, `deleted_at`; primary key `kind, tmdb_id`; `title` is the last known title text, kept only to
name the row in the restore list). A title made by hand (`custom-<uuid>`) is never recorded. Every read that lists or
fetches TMDB titles then skips a recorded one:

- Browse, search and recommendations leave it out of `items`; the catalog sync (both the trending and popular scopes and
  the `titles` ids scope) neither fetches, inserts nor refreshes it; the list cache never stores it.
- A detail, seasons or recommendations read of a recorded id answers `404 title.not_found`, exactly as for a title that
  does not exist, whatever TMDB says. The fileserver reads titles only through these routes, so a deleted title simply
  vanishes from its catalogue answers.
- **Paging.** A browse or search page is one TMDB page, so a page that loses titles is thinner and keeps its place (page
  `n` is TMDB's page `n` minus the skipped titles; TMDB's `totalPages` is unchanged). The answer carries `skipped`: how
  many of that page's rows were left out (deleted titles, and disabled titles on a public read). A reader fills from it
  the way the library pages do (section 3.5): a page with `skipped > 0` counts as thinned, so the fileserver reads the next
  page and tops up until it holds a page, never answering a short or empty page with a cursor.
- **Restore.** `DELETE /api/titles/deleted/:titleId` removes the record; the title returns on the next browse, search or
  catalog sync that lists it, as a plain synced title (its earlier edits are gone).

```ts
interface DeletedTitle {
  id: string;        // movie-603
  kind: "movie" | "tv";
  tmdbId: number;
  title?: string;    // the last known title text; absent when none was kept
  deletedAt: number; // epoch ms
}
```

- `trending` uses TMDB's trending list; the other sorts and the genre and year narrowing use TMDB's
  discover lists (`11` section 3), with the vote floor `11` records on the release-date and name sorts.
  Paging stops at TMDB's page 500.
- An id TMDB does not know is `404 title.not_found`. Without `TMDB_READ_TOKEN`, or when TMDB cannot be
  reached and nothing is cached, the title routes answer `503 tmdb.unavailable`.

**The seasons mapping (remediation, owner, 2026-10-17).** The detail route's `seasons` for a series is
mapped by the backend from TMDB's `GET /tv/{id}` answer: `seasons[].season_number` becomes `season`,
`seasons[].episode_count` becomes `episodeCount` (`11` section 3). Season 0 (Specials) and seasons with
an `episode_count` of 0 are left out; TMDB's array order is kept, so `seasons[0]` is the lowest real
season. The field names are translated here, never passed through raw — TMDB's snake_case names would
answer no reader. This mapping was missing from the first build (`BackendTitle` above had no `seasons`
and `detailOf` dropped TMDB's array), which left every series without seasons or episodes: the Player
only requests a season after seeing `seasons[0]` in the detail, so an absent array silently disables the
whole episode browser, and the seasons route itself is never reached. Both reference backends confirm
the shape: mediamash-backend maps `season_number > 0` into a detail payload that carries seasons from
the first response; core-main (OMSS) types TMDB's `seasons[]` but never maps it — the same failure this
remediation closes. The fileserver accepts both entry shapes (`{ season, episodeCount }` and, after a
season read, `{ season, episodes[] }` — a per-season read replaces that season's entry with its episode
list, `03` section 7.4's seasons route).

### 7.5 The stream address rule

A title's stream address is worked out from its TMDB id, not stored per title. `MOVIE_STREAM_TEMPLATE` is
an address in which `{tmdbId}` is replaced; `EPISODE_STREAM_TEMPLATE` is one in which `{tmdbId}`,
`{season}` and `{episode}` are replaced. The backend fills them in on every title and episode it answers;
a template that is not set leaves `streamUrl` absent. Each address must pass 7.3.

- **For development**, the templates point at one of the backend's own live test channels (for example every movie at
  `http://127.0.0.1:8091/live/fx-sports/master.m3u8` and every episode at
  `http://127.0.0.1:8091/live/fx-kids/master.m3u8`; the port the local `.env` gives the backend), so any TMDB title plays a test stream in the app's
  own `<video>` and Player can be built and checked end to end.
- **With providers**, a title plays in a provider's embedded player, not from a stream address (owner,
  2026-10-16; `12` section 7; `14`). The backend fills, on every title detail and every episode it
  answers, one `TitleSource` (section 3.6) per active provider of the embed family whose template applies
  — the movie template with `{tmdbId}` filled for a movie, the episode template with `{tmdbId}`, `{season}`
  and `{episode}` for an episode — ordered by `order` then id. A provider without a template for the kind,
  or of the stream family, yields no source. Each address must pass 7.3. The sources are what playback
  uses; the stream rule above stays the development lane, and plays when a title carries no sources.

### 7.6 TMDB

The backend calls TMDB only as `11` section 5 describes: with `TMDB_READ_TOKEN` in the `Authorization`
header, at most about 5 requests a second, backing off on `429`, and merging identical requests. Its
answers live in the title store (7.6b), fresh for days (details, seasons, genres, recommendations) or
hours (lists, popularity), never past six months. When TMDB cannot be reached the title routes answer
from the store.

### 7.6b The catalog sync

The title store is the backend's own SQLite (`7.9`): a synced mirror of the TMDB answers the title
routes need, so the library survives a TMDB outage and a backend restart, and so popularity and list
order are stable between reads. Nothing here is an administered record: sync changes no revision, and
nobody "adds a title" — the store only ever mirrors TMDB.

- **Fill-through.** Every title route answers from the store when the entry exists and is fresh; on a
  miss or staleness it fetches TMDB, stores the answer, then answers. A restart serves everything the
  store already holds.
- **Healing an old shape (owner, 2026-10-17).** A stored entry is fresh for days, so when the detail
  contract gains a field the old rows cannot carry it. The rule: on a detail read, a stored payload that
  is missing a field the contract gives its shape — a series detail without `seasons` — is refetched
  whole once, and the refetched payload replaces it. Later reads are ordinary fill-through again.
- **Bulk sync (admin).** `POST /api/titles/sync` — body `{ scope: "trending" | "popular", kind:
  "movie" | "tv", pages? }`, `{ scope: "discover", pages? }`, or `{ scope: "titles", ids: [...] }`.
  Trending and popular walk TMDB's lists for that kind (first `pages`, default 5) — freshness slices
  for the browse rows. Discover is the **library fill** (owner, 2026-10-17): one run walks TMDB's
  `/discover/movie` then `/discover/tv` sorted by popularity — `kind` is not part of the request, the
  walk covers both kinds. `pages` caps each kind's walk (default 100, at most `DISCOVER_PAGES_MAX`
  500, TMDB's own page cap; ≈ 10,000 titles per kind), so a run lifts the store toward the ~27,000
  library target (`32`, `41`). Each scope stores each title and its popularity, and refetches stale
  details. Signed in only. It runs as one background job: a second start is `409
  sync.busy`, and `GET /api/titles/sync` answers `{ running, startedAt, lastRunAt, lastOutcome,
  titles, stale, schedule }`. The job honours the `7.6` rate limit and backoff, and stops between
  pages on shutdown.
- **Schedule hook.** `TMDB_SYNC_SCHEDULE` (default off) accepts an interval such as `6h` or `24h`;
  when set, it arms the discover job (the library fill) on that interval after start-up and every
  interval after. A scheduled run is audited with the actor `system`; a manual run
  with the admin's account.
- **The freshness jobs are retired (owner, 2026-10-17).** The four seeded catalog jobs (trending and
  popular, movies and series) warmed browse slices the title routes fill through on demand anyway;
  nothing read from them and they never ran. The backend seeds one catalog job - the discover library
  fill - and no longer seeds the four; existing records can be deleted. The trending and popular
  scopes stay available (the New Job form, a manual `POST /api/titles/sync`) for an occasional
  warm-up.
- **Outcome.** A finished sync is reported only by `GET /api/titles/sync` (`lastRunAt`, `lastOutcome`,
  `titles`, `stale`) and its audit entries. The revision counter is untouched: titles
  are not channel data. The fileserver reads titles on demand (`3.5`, `3.6`) and warms its image cache
  lazily on first request (`3.11`).
- **Audit.** Every start, finish and failure is an audit entry (`7.13`), with the scope, kind, page
  counts and the outcome sentence; never a token. This scheduler and the playlist-sync scheduler
  (`7.2c`) are the system's only background timers (`01` section 4.4).

Migration `004-titles.sql` creates the store: `titles` (kind, tmdb_id, payload, popularity_score,
popularity_read_at, fetched_at; primary key kind+tmdb_id) and `title_lists` (key, ids, fetched_at),
where a list key is the kind, sort, filters and page of one `7.4` browse answer. Migration
`020-deleted-titles.sql` adds `deleted_titles` (kind, tmdb_id, title, deleted_at; primary key kind+tmdb_id): the synced
titles an admin deleted, which no read or sync stores again until it is restored (`7.4`). A payload is TMDB's
metadata answer as JSON — image **paths**, never image bytes (`01` section 7). List routes answer
from a stored list when TMDB cannot be reached and the snapshot is within its hours; per-title routes
answer from `titles` within their days.

### 7.7 Test channels

With `SEED_TEST_CHANNELS=true`, a backend with no channels creates four `kind: live` channels: `fx-news`, `fx-sports`,
`fx-music` and `fx-kids`, with the names, numbers and categories of `10` section 3.2, each a list of three fixture
videos from `FIXTURE_DIR` (made by `npm run fixtures`), served by the backend itself at `/live/<id>/master.m3u8` and
`/logos/<id>.png`. It needs no `ALLOW_LOOPBACK_STREAMS`: a live row stores no address. A database from before the
merge that holds these ids as legacy `stream` rows (loopback address on the retired live server's port, never
edited) has them converted to live rows in place, keeping the ids, on the next start; any other row is left alone.
Missing fixture files refuse to start, naming `npm run fixtures`.

### 7.8 The socket (removed)

The backend's read-only `/ws` (a `hello` with the revision, then a frame per change) was removed on
2026-10-17: no program connected to it, and the fileserver already reads channels, providers and titles
live, taking the `revision` from each answer. `GET /healthz` reports the current revision.

### 7.9 Storage

Forward-only, numbered migrations, as the fileserver's (section 6). Tables: `channels`, the `revision`
counter, `admin_accounts`, `refresh_tokens` (hashes only), `audit_log`, `providers`, `channel_videos`, `playlists`,
`sync_jobs`, `sync_seed`, and the title store (`7.6b`). It holds no
Giga Stream user data, no local paths and no media beyond the playlist logos: `DATA_DIR/logo-cache/` holds one file per
distinct cached channel image, named by the hash of its bytes (`7.2c`), served at `GET /logos/c/<file>`; an uploaded
playlist file is read and discarded, never kept. Foreign keys are enforced: deleting a playlist cascades to its channels
and its sync job, and a migration that rebuilds a table is preceded by a `VACUUM INTO` backup and followed by
`PRAGMA foreign_key_check`.

### 7.10 Running over the network

The backend binds `127.0.0.1` by default. To serve a LAN or the internet, set `HOST` (for example
`0.0.0.0`) and choose how the connection is protected, because passwords and tokens cross it:

| Setting | Meaning |
|---|---|
| `TLS_CERT_FILE` and `TLS_KEY_FILE` | the backend serves `https` and `wss` itself, with this certificate and key (PEM) |
| `TRUST_PROXY=true` | a reverse proxy in front terminates TLS; the client's address is taken from `X-Forwarded-For` for the sign-in limits and the audit log |
| `ALLOW_INSECURE_HTTP=true` | plain `http` off loopback, for development on a trusted network only |

On any address other than loopback with none of these set, the backend **refuses to start**, naming the
three settings. The fileserver accepts a plain `http` backend address only on loopback (section 3.2).

`CORS_ORIGINS` (comma-separated origins, default none) lets a browser page on those origins call the
backend; other programs (the fileserver, an operator's scripts) do not need it. Answers to the sign-in and
account, audit and admin-channel routes carry `Cache-Control: no-store`.

### 7.11 Admin accounts

```ts
interface AdminAccount {
  id: string;
  username: string;         // the sign-in name: any text, trimmed, 1 to 254 characters, no format; unique without case
  name: string;
  disabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastSignInAt?: number;
  securityQuestionSet: boolean; // read only; whether the account has set its question (docs/40), never the question
}
```

| Route | Who | Behaviour |
|---|---|---|
| `GET /api/admin-accounts` | signed in | every account, by username: `{ items: AdminAccount[] }` |
| `GET /api/admin-accounts/:accountId` | signed in | one account |
| `POST /api/admin-accounts` | signed in | `{ username, password }`; answers `201` with the account (`name` removed: owner, 2026-10-17; migration 021 drops the column) |
| `PATCH /api/admin-accounts/:accountId` | signed in | any of `username`, `disabled`, `password` |
| `DELETE /api/admin-accounts/:accountId` | signed in | removes it; answers `{ id }` |

There are no roles (owner, 2026-10-17): every signed-in account is equal and may call every write and read route.

- A password is 1 to 256 characters, stored only as a scrypt hash with its own salt.
- Changing an account's password or `disabled`, or deleting it, **revokes all of its sessions at
  once** (section 7.12).
- The last enabled account cannot be disabled or deleted (`409 account.last_admin`), so the backend
  always has someone who can sign in.
- A username already used is `409 account.username_taken`, naming the field `username`; an unknown id `404 account.not_found`; an invalid
  field `422 account.invalid`, naming the field.
- **The first account.** When the backend starts with no accounts and `ADMIN_BOOTSTRAP_USERNAME` (or the
  old `ADMIN_BOOTSTRAP_EMAIL`, when only that is set) and `ADMIN_BOOTSTRAP_PASSWORD` are set, it creates that account. With no accounts and neither set, it starts,
  serves reads, and logs that nobody can sign in.

### 7.12 Sign-in and tokens

| Route | Who | Behaviour |
|---|---|---|
| `POST /api/auth/login` | anyone | `{ username, password }`; answers a `Session` |
| `POST /api/auth/refresh` | anyone with a refresh token | the token comes from `{ refreshToken }` or, when there is no body, from the `giga_refresh` cookie; answers a new `Session` and sets the cookie again, and the old refresh token stops working; with no token, a bad or a used one: `401 auth.refresh_invalid` and the cookie is cleared |
| `POST /api/auth/logout` | anyone with a refresh token | the token as for refresh; ends that session, clears the cookie; answers `{ signedOut: true }` |

`login` and `refresh` also set the refresh token as the cookie `giga_refresh` (`HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age` 365 days; `Secure` only over https), so a page reload restores the session without any browser storage in the app. The access token is never in it. Logout, a password change, a security-question reset and an own `PATCH /api/admin-accounts/:id` password or disabled change clear it. CORS stays closed: the admin is same-origin through its Vite proxy or the backend's own `/admin/`.
| `GET /api/auth/me` | signed in | the signed-in `AdminAccount` |
| `POST /api/auth/password` | signed in | `{ currentPassword, newPassword }`; changes it and revokes all of the account's sessions |
| `PUT /api/admin-accounts/:id/security-question` | signed in | `{ question (1 to 8), answer }`; sets that account's reset question (`54`; no current password - the actor is a signed-in admin); `200 { set: true }`; `404 account.not_found`; `422 account.invalid` names `answer` or `question` |
| `POST /api/auth/reset-start` | anyone | `{ username }`; answers `200 { question }` for every username (a stand-in for an unknown name or an account with no question) |
| `POST /api/auth/reset` | anyone | `{ username, answer, newPassword }`; right answer: sets the password, ends every session, `200 { reset: true }`; every refusal is `401 auth.reset_invalid`; a `newPassword` outside 1 to 256 characters is `422 account.invalid` (field `newPassword`); no attempt limit and no lock (owner, 2026-10-18) |

```ts
interface Session {
  accessToken: string;        // JWT, sent as Authorization: Bearer <accessToken>
  accessExpiresAt: number;
  refreshToken: string;       // opaque; kept by the client, never sent anywhere else
  refreshExpiresAt: number;
  account: AdminAccount;
}
```

- **The access token** is a JWT signed with HS256 and `JWT_SECRET` (at least 32 characters; the backend
  refuses to start without one). It lives 30 days (owner, 2026-10-18: no visible session timeout; it was 15 minutes) and carries `iss` and `aud` (`giga-stream-admin`),
  `sub` (the account id), `ver` (the account's session version), `iat` and `exp`. A token with any
  other algorithm, issuer or audience, a bad signature, or an expired time is refused.
- **Every request is checked against the account** as it is now: a disabled or deleted account, or a
  `ver` that no longer matches, is refused. That is how a revocation takes effect at once.
- **The refresh token** is 32 random bytes, stored only as a SHA-256 hash, valid for 365 days (each refresh issues a new
  one, so an account in use never times out) and used once: refreshing replaces it. Presenting a refresh token that was already used revokes every session of
  that account, since only a copied token is used twice.
- **No limits.** There is no sign-in rate limit and no lockout (owner, 2026-10-18: a single-owner tool). An unknown
  username and a wrong password give the same answer (`401 auth.invalid_credentials`).
- A missing, malformed, expired or revoked access token is `401 auth.unauthorized`; a refresh token that is unknown, used, expired or revoked
  is `401 auth.refresh_invalid`.
- Changing `JWT_SECRET` ends every access token; sessions continue through their refresh tokens.

### 7.13 Audit log

| Route | Who | Behaviour |
|---|---|---|
| `GET /api/audit` | signed in | entries newest first: `limit` (1 to 200, default 50) and `before` (an entry id) page through them; `{ items, nextBefore? }` |

An entry is `{ id, at, actorId?, actorUsername?, action, subject?, detail?, address? }`. Actions:
`auth.login`, `auth.login_failed`, `auth.logout`, `auth.password_changed`, `account.created`,
`account.updated`, `account.deleted`, `channel.created`, `channel.updated`, `channel.deleted`,
`channel.enabled_bulk`, `playlist.imported`, `playlist.synced`, `job.stopped`, `channel.fault_set`, `channel.fault_cleared`, `channel.rebuilt`, `channel.reverted`,
`provider.created`, `provider.updated`, `provider.deleted`, `title.created`, `title.updated`, `title.deleted`,
`title.reverted`, `title.restored`, `playlist.updated`, `playlist.deleted`, `job.created`, `job.updated`,
`job.deleted`, `sync.started`. A password, token or hash is never written to it.

## 8. Errors

```text
route.not_found        request.invalid        internal.failure
settings.invalid       library.invalid
channel.not_found      channel.invalid        title.not_found
playlist.invalid       playlist.taken
collection.not_found   collection.invalid     watch.not_found
fs.desktop_required    fs.cancelled           fs.invalid_selection
job.not_found          job.not_running        job.not_settled        job.running
media.not_found        playback.range_invalid image.not_found
backend.unreachable    backend.bad_response   tmdb.unavailable
store.open             store.newer_schema     store.migrate          store.failed
auth.unauthorized      auth.invalid_credentials auth.refresh_invalid
auth.reset_invalid
account.not_found      account.invalid        account.username_taken account.last_admin
```

The admin backend also owns these (not in the fileserver): `channel.taken`, `fault.invalid`, `path.invalid`,
`playlist.unavailable`, `playlist.unreachable`, `playlist.not_found`, `range.unsatisfiable`, `job.invalid`,
`job.disabled`, `title.invalid`, `title.manual`, `provider.not_found`, `provider.invalid`, `sync.busy`, `sync.invalid`.
`job.not_found` is the backend's missing sync job and the fileserver's missing scan job: two meanings, one code. The
backend also answers `job.not_running` (409, `POST /api/jobs/:id/stop` on an idle job) and `playlist.taken` (409, a
duplicate name, web address or file name); `playlist.busy` is retired (one run at a time per playlist is `sync.busy`);
`channel.imported` stays only for the live server's folder import (`10`); a playlist import is `playlist.imported`.

| Status | Used for |
|---|---|
| 400 | `request.invalid` |
| 401 | `auth.unauthorized`, `auth.invalid_credentials`, `auth.refresh_invalid`, `auth.reset_invalid` |
| 404 | the `*.not_found` codes |
| 409 | `fs.desktop_required`, `fs.cancelled`, `job.not_running`, `job.not_settled`, `job.running`, `account.username_taken`, `account.last_admin`, `channel.taken`, `title.manual`, `sync.busy`, `playlist.taken` |
| 416 | `playback.range_invalid`, `range.unsatisfiable` |
| 422 | `settings.invalid`, `library.invalid`, `channel.invalid`, `account.invalid`, `collection.invalid`, `fs.invalid_selection`, `playlist.invalid`, `job.invalid`, `job.disabled`, `title.invalid`, `provider.invalid`, `sync.invalid` |
| 502 | `backend.bad_response` |
| 503 | `backend.unreachable`, `tmdb.unavailable`, `playlist.unreachable` |
| 500 | `internal.failure` and the `store.*` codes |
