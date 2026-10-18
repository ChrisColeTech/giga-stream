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
| 7.2c Playlist sync | B | **done** (`playlist-sync.test.ts`: parse, dedupe, address-rule refusals, create/update/removed match paths, prune, dry run, single-flight, schedule, enrichment, one revision bump per run; landed 2026-10-16 and driven over HTTP against a live iptv-org playlist — boot run, dry run, update repair, prune, hand-row isolation, restart persistence) |
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
  route. It keeps your own data (settings, layout, collections, favorites, watch history, your own video
  files) and reads the backend's channels and titles live, without storing them.
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
picker), `GIGA_APP_URL` (desktop shell only: the page the window loads).

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
(the catalog-sync interval, section 7.6b; default off), `PLAYLIST_URLS` and `PLAYLIST_SYNC_SCHEDULE`
(the playlist sync, section 7.2c; both default off/absent), `OMDB_API_KEY` (detail enrichment, `11`
section 7; absent means details stay TMDB-shaped), `MOVIE_STREAM_TEMPLATE` and
`EPISODE_STREAM_TEMPLATE` (the stream address rule, section 7.5), `SEED_TEST_CHANNELS` (seeds the four live test
channels, section 7.7), `ALLOW_LOOPBACK_STREAMS`, `TEST_PAGE` (serves `/test/player.html`), `FIXTURE_DIR` (the test
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
| `type` | `all`, `movie`, `tv`, `local` | `all` |
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

- **`all`.** Titles are browsed from TMDB through the backend (section 7.4): with `q`, TMDB's search;
  otherwise TMDB's lists in the chosen sort, narrowed by genre and year. `type=movie` or `tv` browses one
  kind; `type=local` lists only the user's files; `type=all` lists the user's matching files first, then
  the titles *(default)*. Pages are the backend's pages (20 titles), and `nextCursor` carries the position
  in both.
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

TMDB's titles, passed through from the backend. Nothing is stored; an answer is kept in memory for the
session. A title id is the kind and TMDB id, for example `movie-603` or `tv-1399`.

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
| `PUT /api/watch` | records progress for the item (and exact episode). A write whose `seq` is not higher than the last applied for its `playbackId` is ignored, so a late write never rewinds progress. At 95 percent of the duration *(default)* the entry becomes `watched`. Answers `{ applied, entry }` |
| `DELETE /api/watch/:watchId` | removes one entry (Remove from History) |
| `DELETE /api/watch` | clears all history; favorites, collections and files are untouched |

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

## 5. The live view

### 5.1 Reading the backend

The fileserver keeps the backend's channels in memory, the **live view**. It is never written to disk.
Titles are not listed in advance; they are asked for page by page (sections 3.5 and 3.6). The fileserver
holds no connection open to the backend — it reads on demand:

- On a channels or state read: if the view is empty, or older than `LIVE_VIEW_TTL_MS` *(default 30 s)*,
  it reads `GET {adminUrl}/api/channels` and replaces the view. The revision in the backend's answer
  says whether the list moved; a read can also compare it and skip the fetch when the view already holds
  that revision.
- `POST /api/channels/refresh` reads the channels again regardless of the TTL.
- **Loss.** A read that fails clears the live view, sets `backend.error` and answers as section 3.4 says
  (`503 backend.unreachable`, `502 backend.bad_response`). While the backend is unreachable the channel
  list is empty, the library query reports `titlesAvailable: false` and the title routes answer `503`.
  The next successful read refills the view. Nothing watches for the backend's return; the next request
  is what finds it.
- An answer the fileserver cannot read sets `backend.error` (`backend.bad_response`) and leaves the view
  as it was.

### 5.2 The probe

After every channel read, each channel's `streamUrl` is probed, and the read's answer carries the
round's statuses. One probe is one `GET` of the address: 4 second timeout, redirects followed, at most 64 KiB
of the body read. A `2xx` answer whose body begins `#EXTM3U` is `live`; anything else (another status, a
timeout, a network error, another body) is `offline`; never probed is `unknown`. At most 6 probes run at
once, and an address shared by several channels is probed once. A re-read keeps a channel's last status
until its new probe finishes, unless its `streamUrl` changed.

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

The image cache is files under `DATA_DIR/images`, not rows. Nothing from the backend is stored: there is
no table of channels, titles or providers.

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
  source?: string;         // the playlist host that created the row; sync-owned rows only (7.2c)
  revision: number;        // the revision at which this channel last changed
}
```

| Route | Who | Behaviour |
|---|---|---|
| `GET /api/channels` | anyone | every channel, ordered by number then name: `{ items: BackendChannel[], revision }` |
| `GET /api/channels/:channelId` | anyone | one channel |
| `POST /api/channels` | signed in | `{ name, category, number?, logoUrl?, streamUrl }`; answers `201` with the channel |
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

The playlist sync turns configured M3U playlists into channels, and keeps them current. It is the only
mechanism besides channel CRUD that writes channels, and it writes only rows it owns: a channel created
by the sync carries `source` (the playlist URL's host); an operator's hand-created rows (`source` absent)
are never updated or removed by it.

- **Playlists.** `PLAYLIST_URLS` — a comma-separated list of `https` playlist addresses *(default:
  unset; with it unset the sync has nothing to do and the schedule stays unarmed)*. `PLAYLIST_SYNC_SCHEDULE`
  (default off) accepts an interval such as `6h` or `24h`; when set, the backend runs the sync on that
  interval after start-up. A scheduled run is audited with the actor `system`.
- **The run.** Each playlist is fetched once with a timeout and a size cap (`PLAYLIST_SYNC_MAX_BYTES`,
  *(default 8 MiB)*; at most `PLAYLIST_SYNC_MAX` *(default 5000)* entries per playlist). Each
  `#EXTINF` entry is parsed to `name`, `tvgId?`, `logoUrl?`, `groupTitle?`, `streamUrl` (the
  `group-title` becomes the `category`). Every entry passes the address rule (7.3): an `http` address
  is **skipped and counted, never imported broken**. Entries are matched to the store's sync-owned rows
  (the same playlist host first, any other sync-owned row by `tvgId` then by exact `name`): a match
  updates `streamUrl`, `logoUrl`, `category` and `number` when they changed; an unmatched entry creates
  a row; a sync-owned row whose entry vanished from the playlist is counted as `removed` and, only with
  `prune: true`, deleted. Duplicate entries (the same `name` and `streamUrl`) are deduped. The run is
  single-flight: a second start is `409 playlist.busy`.
- **Enrichment.** An entry with no `tvg-logo` may be given one at write time from the iptv-org logo
  index (`logos.json`, `channels.json`), matched by `tvgId` first and normalized `name` second,
  disk-cached under the data folder with a TTL (`LOGO_INDEX_TTL_HOURS`, *(default 24)*). An existing
  `logoUrl` always wins; a miss imports the row with no logo. Enrichment happens at write time only,
  never per read.
- **Revision.** One run bumps the revision once, whatever it changed; channels are channel data (`7.6b`
  is the contrast).

| Route | Who | Behaviour |
|---|---|---|
| `POST /api/playlist-sync` | signed in | body `{ dryRun?: boolean, prune?: boolean }`; a dry run writes nothing. Answers `202` with `{ created, updated, skipped, refused, removed, refusalExamples }` and the ids of the first *(default 10)* created rows |
| `GET /api/playlist-sync` | signed in | `{ running, startedAt, lastRunAt, lastOutcome, counts, schedule, playlists }` |

Every run — manual, dry or scheduled — is one audit entry, action `channel.imported`, with the counts and
each playlist's **host** (never its query, which can carry credentials). A playlist that cannot be
fetched fails the run with `503 playlist.unreachable`; a body that is not an M3U playlist is
`422 playlist.invalid`.

### 7.3 Stream and image addresses

Every `streamUrl`, `logoUrl`, address produced by the stream rule (7.5) and image source must be `https`. With
`ALLOW_LOOPBACK_STREAMS=true` (default `false`; never set in production), `http` on exactly `127.0.0.1` or
`localhost`, any port, is also accepted. Nothing else is. TMDB's image host is `https` and passes.

### 7.4 Titles

The backend browses, searches and describes TMDB's titles on demand (`11` section 5). Titles are also ordinary records
an admin can create, edit and delete (`POST`, `PATCH`, `DELETE /api/titles`, `26` section 3.11; a sync never overwrites
an edited title). Any movie or series TMDB has can be listed. A title id is the kind and TMDB id, `movie-603` or `tv-1399`.

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
| `GET /api/titles` | a page of titles: `kind` (`movie`, `tv`, or both), `sort` (`newest`, `oldest`, `az`, `year`, `trending`), `genre` (repeatable), `year`, `page`; answers `{ items: BackendTitle[], page, totalPages, totalResults }` |
| `GET /api/titles/search` | `q`, `kind`, `page`; TMDB's search, people left out; the same answer shape |
| `GET /api/titles/genres` | TMDB's genre names for movies and for series |
| `GET /api/titles/:titleId` | the title with `plot`, `cast` (ten names), `runtimeMs` (a movie) or `seasons` (a series); a thin list row is refetched whole on read; with `OMDB_API_KEY`, an `omdb` block (age rating, ratings, awards, box office — `11` section 7.2) |
| `GET /api/titles/:titleId/seasons/:season` | `{ episodes }`: each with season, episode, title, air date, runtime, still address and its `streamUrl` from the rule |
| `GET /api/titles/:titleId/recommendations` | `{ items: BackendTitle[] }`: TMDB's recommendations, first page, in TMDB's order |

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
  "movie" | "tv", pages? }`, or `{ scope: "titles", ids: [...] }` — walks TMDB's trending or popular
  lists for that kind (first `pages`, default 5), storing each title and its popularity, and refetching
  stale details. Signed in only. It runs as one background job: a second start is `409
  sync.busy`, and `GET /api/titles/sync` answers `{ running, startedAt, lastRunAt, lastOutcome,
  titles, stale, schedule }`. The job honours the `7.6` rate limit and backoff.
- **Schedule hook.** `TMDB_SYNC_SCHEDULE` (default off) accepts an interval such as `6h` or `24h`;
  when set, the backend runs the trending and popular warm-up for both kinds on that interval after
  start-up and every interval after. A scheduled run is audited with the actor `system`; a manual run
  with the admin's account.
- **Outcome.** A finished sync is reported only by `GET /api/titles/sync` (`lastRunAt`, `lastOutcome`,
  `titles`, `stale`) and its audit entries. The revision counter is untouched: titles
  are not channel data. The fileserver reads titles on demand (`3.5`, `3.6`) and warms its image cache
  lazily on first request (`3.11`).
- **Audit.** Every start, finish and failure is an audit entry (`7.13`), with the scope, kind, page
  counts and the outcome sentence; never a token. This scheduler and the playlist-sync scheduler
  (`7.2c`) are the system's only background timers (`01` section 4.4).

Migration `004-titles.sql` creates the store: `titles` (kind, tmdb_id, payload, popularity_score,
popularity_read_at, fetched_at; primary key kind+tmdb_id) and `title_lists` (key, ids, fetched_at),
where a list key is the kind, sort, filters and page of one `7.4` browse answer. A payload is TMDB's
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
Giga Stream user data, no local paths and no media.

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
| `POST /api/admin-accounts` | signed in | `{ username, name, password }`; answers `201` with the account |
| `PATCH /api/admin-accounts/:accountId` | signed in | any of `username`, `name`, `disabled`, `password` |
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
| `POST /api/auth/refresh` | anyone with a refresh token | `{ refreshToken }`; answers a new `Session`, and the old refresh token stops working |
| `POST /api/auth/logout` | anyone with a refresh token | `{ refreshToken }`; ends that session; answers `{ signedOut: true }` |
| `GET /api/auth/me` | signed in | the signed-in `AdminAccount` |
| `POST /api/auth/password` | signed in | `{ currentPassword, newPassword }`; changes it and revokes all of the account's sessions |
| `PUT /api/auth/me/security-question` | signed in | `{ currentPassword, question (1 to 8), answer }`; sets the account's own question; `200 { set: true }`; a wrong current password is `401 auth.invalid_credentials` with `details.field: "currentPassword"`; `422 account.invalid` names `answer` or `question` |
| `POST /api/auth/reset-start` | anyone | `{ username }`; answers `200 { question }` for every username (a stand-in for an unknown name or an account with no question); `429 auth.rate_limited` |
| `POST /api/auth/reset` | anyone | `{ username, answer, newPassword }`; right answer: sets the password, ends every session, `200 { reset: true }`; every refusal is `401 auth.reset_invalid`; a `newPassword` outside 1 to 256 characters is `422 account.invalid` (field `newPassword`); `429 auth.rate_limited` (docs/40) |

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
  refuses to start without one). It lives 15 minutes and carries `iss` and `aud` (`giga-stream-admin`),
  `sub` (the account id), `ver` (the account's session version), `iat` and `exp`. A token with any
  other algorithm, issuer or audience, a bad signature, or an expired time is refused.
- **Every request is checked against the account** as it is now: a disabled or deleted account, or a
  `ver` that no longer matches, is refused. That is how a revocation takes effect at once.
- **The refresh token** is 32 random bytes, stored only as a SHA-256 hash, valid for 30 days and used
  once: refreshing replaces it. Presenting a refresh token that was already used revokes every session of
  that account, since only a copied token is used twice.
- **Limits.** Ten sign-in attempts a minute from one address (`429 auth.rate_limited`); five wrong
  passwords in a row lock the account for 15 minutes (`429 auth.locked`). An unknown username and a wrong
  password give the same answer (`401 auth.invalid_credentials`).
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
`channel.imported`, `channel.fault_set`, `channel.fault_cleared`, `channel.rebuilt`, `channel.reverted`,
`provider.created`, `provider.updated`, `provider.deleted`, `title.created`, `title.updated`, `title.deleted`,
`title.reverted`, `playlist.created`, `playlist.updated`, `playlist.deleted`, `job.created`, `job.updated`,
`job.deleted`, `sync.started`. A password, token or hash is never written to it.

## 8. Errors

```text
route.not_found        request.invalid        internal.failure
settings.invalid       library.invalid
channel.not_found      channel.invalid        title.not_found
playlist.invalid       playlist.busy
collection.not_found   collection.invalid     watch.not_found
fs.desktop_required    fs.cancelled           fs.invalid_selection
job.not_found          job.not_running        job.not_settled        job.running
media.not_found        playback.range_invalid image.not_found
backend.unreachable    backend.bad_response   tmdb.unavailable
store.open             store.newer_schema     store.migrate          store.failed
auth.unauthorized      auth.invalid_credentials auth.refresh_invalid
auth.rate_limited      auth.locked            auth.reset_invalid
account.not_found      account.invalid        account.username_taken account.last_admin
```

The admin backend also owns these (not in the fileserver): `channel.taken`, `fault.invalid`, `path.invalid`,
`playlist.unavailable`, `playlist.unreachable`, `playlist.not_found`, `range.unsatisfiable`, `job.invalid`,
`job.disabled`, `title.invalid`, `title.manual`, `provider.not_found`, `provider.invalid`, `sync.busy`, `sync.invalid`.
`job.not_found` is the backend's missing sync job and the fileserver's missing scan job: two meanings, one code.

| Status | Used for |
|---|---|
| 400 | `request.invalid` |
| 401 | `auth.unauthorized`, `auth.invalid_credentials`, `auth.refresh_invalid`, `auth.reset_invalid` |
| 404 | the `*.not_found` codes |
| 409 | `fs.desktop_required`, `fs.cancelled`, `job.not_running`, `job.not_settled`, `job.running`, `account.username_taken`, `account.last_admin`, `channel.taken`, `title.manual`, `sync.busy`, `playlist.busy` |
| 429 | `auth.rate_limited`, `auth.locked` |
| 416 | `playback.range_invalid`, `range.unsatisfiable` |
| 422 | `settings.invalid`, `library.invalid`, `channel.invalid`, `account.invalid`, `collection.invalid`, `fs.invalid_selection`, `playlist.invalid`, `job.invalid`, `job.disabled`, `title.invalid`, `provider.invalid`, `sync.invalid` |
| 502 | `backend.bad_response` |
| 503 | `backend.unreachable`, `tmdb.unavailable`, `playlist.unreachable` |
| 500 | `internal.failure` and the `store.*` codes |
