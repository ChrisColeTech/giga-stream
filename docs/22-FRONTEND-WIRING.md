# 22 - Frontend Wiring

**Status: the plan for phase 2 of `src/frontend`, revised 2026-10-17 with the owner's direction: the provider
embed proven by `14`, a source control on the Player stage, the full network log in the events drawer, the ad
blocker surfaced, and the settings round trip.** It says which route each control reads or writes, which service
and schema carry it, how the store and hydration work, what the backend and fileserver must add, and what proves
it. The look is `21`; the window and surfaces are `02`, `04`, `05` and `06`; the wire is `03`; how work is run is
`07`; the engineering rules are `01`. Where this document and those disagree, those win and this document is
corrected first.

---

## 0. What the source says today (checked 2026-10-17)

- **Frontend.** Phase 1 is complete (with `25`'s visual-gap waves on top: the events drawer has real rows fed by
  `say()`, the store carries a library request, preferences apply at once and save only the admin address —
  VG-005, VG-063, VG-082), and phase 2 has not started: every service file returns
  `notConnected()` synchronously (`services/not-connected.ts`); `state`, `shell-state`, `ndjson`, `scan-stream`,
  `titles`, `favorites`, `watch`, `local-media`, `desktop` and `stream-player` do not exist yet. The store holds
  no server state beyond that; the Statusbar has **no connection word** yet; the stage renders a bare `<video>`
  with no source; `lib/player-view.ts` reads fixtures at module
  scope. `hls.js`, `zod` and the Radix menu are already dependencies; tests run on `node:test` through `tsx`.
  Vite serves 5171 and proxies `/api` to 8090.
- **Fileserver.** Every route of `03` part A is built and tested (195 tests across the repo). It attaches the
  backend's active provider records to title and season answers today. Its Electron host (`src/app`) already
  runs the ad blocker (`app/ad-blocker.ts`, Ghostery's ads-and-tracking lists, with the `ad*`/`ads` name
  backstop `app/ad-hosts.ts`), refuses popups, off-origin navigations, foreign player-frame navigations and
  every permission but fullscreen (`app/guards.ts`), and reports each event to the page through the preload's
  one named capability `window.pocHost.onGuard` (`app/preload.cts`, channel `poc:guard`). Static serving
  whitelists only `/`, `/index.html` and first segments `html|css|js|data` — **a built React bundle
  (`assets/...`) would be refused**, and there is no SPA fallback. Its `Settings` implements only 8 of the 19
  keys of `03` section 3.2.
- **Backend.** Providers are a table and CRUD (`7.2b`) with `id, name, source, api_key, is_active, created_at` —
  no templates, no seed. The stream-address rule (`7.5`) fills `streamUrl` from `MOVIE_STREAM_TEMPLATE` /
  `EPISODE_STREAM_TEMPLATE`.
- **The PoC (`14`, proven in Electron).** The embed is a 16:9 iframe with
  `allow="autoplay; fullscreen; encrypted-media; picture-in-picture"`, `referrerPolicy="origin"`, optional
  `sandbox="allow-scripts allow-same-origin allow-presentation"`; the nested-frame guard and dialog no-ops
  (`frame-guard.js`) become Electron main-process enforcement/injection for the player frame and its children;
  the renderer sets the active source's policy through one named preload capability. The message decode table
  (`messages.js`) reads `vidsrc-status`, VixSrc's `event`-object shape, the common `player-event` shape and
  `MEDIA_DATA`, position and duration in seconds. `data/providers.json` carries, per provider, the movie and
  episode templates, the `startAt` and subtitle parameter names, the allowed message origin, the frame origins
  and the availability routes. The Electron runs (`14` section 6.2) played VixSrc and VidZee movies and exact
  episodes with Ghostery on; VidSrc's episode played after the first ad-layer press.

## 0.1 Amendments made with this revision (docs first, `07` section 2)

| File | Change | Why |
|---|---|---|
| `03` §3.6 | `TitleDetail` and `Episode` gain `sources?: TitleSource[]` (the shape below). The fileserver attaches the title's **sources** instead of the raw provider records; provider records (and their `api_key`) stop at the fileserver | the credentials never belong in the renderer; the client loads addresses, it does not read provider rows |
| `03` §7.2b | the provider record gains `order` (number), `family` (`"embed" \| "stream"`), `movieTemplate?`, `episodeTemplate?`, `startParam?`, `subtitlesParam?`, `origin?`, `frameOrigins?`, `messageShape?`; POST/PUT accept them; migration adds the columns | `16` §4's shape, trimmed to what `14` proved; the archive backend held templates (`12` §1.1) |
| `03` §7.5 | the sources rule: the backend fills, per title and per episode, one `TitleSource` per active provider whose template applies, ordered by `order` then id; a provider without a template for the kind yields no source; the stream rule is unchanged for the dev lane | the promised "fields that carry it ... written here from the results of `14`" |
| `03` §1, §7.2b | the seeder is `src/backend/scripts/seed-providers.ts` — the one mechanism, no new env flag. Wave A upgrades it to the full catalog: every embed host of `18` §2 with its templates and parameters as captured (TV shapes marked verified or presumed), and the CinePro rows carrying their **own** `source` values (today the script collapses them all to `"cinepro"`, which the sources fill cannot tell apart). Skip-if-seeded stays | the owner's live database holds zero providers today, and this script is how providers have always arrived |
| `06` §5.3, §10 | the stage toolbar gains a **Source** control when a title has two or more playable sources; `06` §10's "no source or provider control" is replaced (owner, this session) | the owner asked for source switching on the player screen |
| `22` §8 | resolved in place; no `01` change — the guard reports ride the preload's named capability (`01` §7), not an application transport | the one push in the system is the desktop shell's |

```ts
interface TitleSource {
  providerId: number;
  name: string;             // display name ("VidSrc")
  url: string;              // the embed address for this exact title (or episode), https per 7.3
  origin: string;           // the origin allowed to post messages
  order: number;
  startParam?: string;      // the resume parameter, seconds, when documented
  subtitlesParam?: string;  // the subtitle-language parameter, when documented
  frameOrigins?: string[];  // the nested-frame origins the player really uses (`14` §2.4)
  messageShape?: "vidsrc-status" | "player-event";   // absent: no documented messages
}
```

---

## 1. Rules that hold

- **The frontend talks only to the fileserver.** Every request is relative (`/api/...`), proxied to the fileserver in
  development (`03` section 1). The interface never contacts the admin backend, its port, TMDB, OMDb or the
  live server's own API (`01` sections 1.1 and 4.4). The addresses the player loads — a channel's `streamUrl`, a
  local file's Range route, a source's embed `url` — are the one external exception (`01` section 1.1), published
  data, never an application API.
- **The Settings Address row edits `adminUrl` through `PATCH /api/settings`** (`03` section 3.2). The interface sends
  the address the person typed and nothing else; it never sends a request to that address.
- **One request layer.** `services/api.ts` is the only `fetch` (`02` section 2.2). Components, pages, hooks and the
  store never call `fetch` or construct a socket. The embed host loads the source's address in an iframe; it makes
  no requests of its own except the provider availability check, which is a dev-harness concern and stays out of
  the product (`16` §7 keeps the PoC's harness for that).
- **No WebSocket, no polling, no timers that send requests** (`01` section 4.4, `03` section 4). The state is read on
  mount, on a surface switch, after an action, and on Refresh. The only timers are the ones `02` names: the 250 ms
  search pause, the 400 ms shell write-back, the 1.5 s hydration fallback, the 30 s progress write, and the active
  tab's close timeout (`06` section 5.1). The one push in the system is the Electron preload's `pocHost.onGuard`
  (`01` section 7) — the desktop shell reporting what it refused.
- **The one streamed body is the folder scan** (`03` section 3.8). `services/ndjson.ts` reads it one line at a time;
  a body that ends without a `done` line is one error.
- **No browser storage.** Saved state is a fileserver row (`02` section 2.3).
- **Every wire value is `unknown` until Zod has validated it** (`01` section 2). A part of an answer the interface
  cannot read is one notice on the statusbar, and never costs the rest of the answer (`01` section 8).
- **Embed containment is the PoC's, verbatim.** The frame allow list, the referrer policy, the browser-case
  sandbox, the nested-frame guard and the dialog no-ops are ported from the PoC (`14` §2.2–2.4), not redesigned.
  In Electron the frame runs unsandboxed (the proven configuration: Ghostery, the name backstop and the shell
  guards contain it); in a browser it always runs sandboxed, and the interface says `unprotected` where the
  mockup's statusbar said it (`14` §2.3; `16` §9.4 defaulted).

## 2. The service layer

One resource module holds one call each (`02` section 2.2). Every module is named for its resource, in kebab-case.

| File | Routes (`03` section) |
|---|---|
| `services/api.ts` | the only `fetch`: relative URLs, the envelope, aborts, a refusal turned into an error with its code and sentence, and one events row per call (`03` section 2, `22` §3.7) |
| `services/ndjson.ts` | reads a streamed NDJSON body line by line (`03` section 3.8) |
| `services/state.ts` | `GET /api/state` (`03` section 4) |
| `services/shell-state.ts` | `GET` and `PATCH /api/shell-state` (`03` section 3.3) |
| `services/settings.ts` | `GET` and `PATCH /api/settings` (`03` section 3.2) |
| `services/channels.ts` | `GET /api/channels`, `POST /api/channels/refresh`, `PATCH /api/channels/last` (`03` section 3.4) |
| `services/stream-player.ts` | attaches `hls.js` to the `<video>` when the browser can run it; the browser's own HLS is the fallback; reports its events (`02` section 3.1, `22` §3.7) |
| `services/library.ts` | `GET /api/library`, `GET /api/library/continue` (`03` section 3.5) |
| `services/titles.ts` | `GET /api/titles/:id`, `.../seasons/:season`, `.../related` (`03` section 3.6) — the detail and episodes carry `sources` |
| `services/collections.ts` | `GET`, `POST`, `PATCH`, `DELETE` `/api/collections`; `PUT` and `DELETE` `.../items`; `GET /api/items/:kind/:id/collections` (`03` section 3.7) |
| `services/folders.ts` | `POST /api/fs/dialog`, `POST /api/collections/:id/folders`, `PUT`, `POST .../rescan`, `DELETE /api/folders/:id` (`03` section 3.8) |
| `services/scan-stream.ts` | `GET /api/folders/:id/scan` as NDJSON (`03` section 3.8) |
| `services/jobs.ts` | `GET /api/jobs`, `POST .../cancel`, `DELETE /api/jobs/:id` (`03` section 3.9) |
| `services/local-media.ts` | `GET /api/media/local/:id/info`, and the media address for the `<video>` (`03` section 3.10) |
| `services/favorites.ts` | `PUT` and `DELETE /api/favorites/:kind/:itemId` (`03` section 3.12) |
| `services/watch.ts` | `PUT /api/watch`, `DELETE /api/watch/:id`, `DELETE /api/watch` (`03` section 3.13) |
| `services/desktop.ts` | the folder picker and the window controls, through the preload's named capabilities only (`01` section 7); in a browser the picker answers `409 fs.desktop_required` and is shown disabled |

**Schemas.** One Zod schema file per resource under `services/schemas/` (`envelope-schema.ts`, `state-schema.ts`,
`settings-schema.ts`, `channel-schema.ts`, `library-schema.ts`, `title-schema.ts` — with `source-schema.ts` for
`TitleSource` — `collection-schema.ts`, `job-schema.ts`, `watch-schema.ts`). The phase 1 types in `src/types/` are
checked against `03` in the wave that wires them; a mismatch is a phase 1 bug and is fixed in the same wave. The
known mismatches to fix while wiring: the fileserver's `Settings` gains its 11 missing keys (§5.1); the
`watchedPercent` values `90|95|100` are the literals `03` names; `LibraryPage.total` is absent more often than the
phase 1 type says.

**Errors.** `lib/error-sentence.ts` is the one mapping from dotted codes to sentences (`01` section 4.1). A refusal
shows its sentence once on the notice line.

**The embed library is not a REST service:** `lib/embed-url.ts` builds the address from a `TitleSource`, resume
seconds and the subtitle language; `lib/embed-messages.ts` is the PoC decode table, seconds to milliseconds;
the desktop service sets/clears the source policy through the preload's named capability. Electron owns the
static frame/dialog guard because a renderer cannot reach a cross-origin `contentDocument`; a browser relies on
the iframe sandbox. These pieces are unit-tested (`14` §2.2–2.4, strengthened at product integration).

## 3. What each surface reads and writes

Each row names a control of `21`, the route it uses, and what it does on the answer. Phase 1 drew the control
disabled, or local, where the row says so.

### 3.1 Shell

| Control | Route | Behaviour |
|---|---|---|
| Hydration on mount | `GET /api/state` | the saved surface, pane visibility and sizes are applied once; the interface shows after two animation frames; a 1.5 s fallback shows defaults (`02` section 2.3) |
| Pane toggles, pane sizes | `PATCH /api/shell-state` | written 400 ms after the last change, never before hydration (`02` section 2.3, item 6) |
| Statusbar notice | the outcome of the last request | no connection dot or word (`02` §1.2, `06` §1.2); a refusal replaces the one notice sentence and a later success may replace it with its outcome |
| Notice line | any refusal or outcome | one sentence, the server's own, or `could not reach the fileserver` (`04` section 6) |
| `Ctrl+0` and the zoom stepper | `PATCH /api/settings` `uiZoom` | applies at once |
| Runtime facts (About, and the drawer's guard rows) | `window.pocHost` | `runtime` is `electron` when the capability exists, `browser` otherwise; in a browser the drawer opens with one info row saying the shell guards are absent (`14` §2.3) |

### 3.2 Live

| Control | Route | Behaviour |
|---|---|---|
| Channel list and search | `GET /api/channels?q=&category=` | the search waits 250 ms; a newer keystroke abandons the older request; a failed request keeps the last rows and says why (`06` section 3.2) |
| Refresh | `POST /api/channels/refresh` | the whole list, every stream's status and the dots update from the answer (`03` section 3.4) |
| A row, click or Enter | `PATCH /api/channels/last`; the player loads `streamUrl` | the channel plays and is remembered as the last one |
| Live opens on the last channel | `GET /api/state` `lastChannelId` | the last channel is selected on launch if it is still in the live view |
| Stage | `stream-player.ts` | ready on the first frame; a failed stream shows the note with Retry, which loads the same address again (`06` section 3.1) |
| No-channels note | `POST /api/channels/refresh` | Refresh channels is enabled |
| Playback settings | the attached `hls.js` levels, tracks and latency | quality, audio, captions, latency enabled with the stream's real values; a row the stream cannot serve keeps its reason (`06` section 3.3) |
| Fit, Fill, Original | none | local, always usable (`06` section 3.3) |

#### 3.2a Channel and stream lifecycle

**Loading the list.** The channels are read on interaction, never on a timer (`03` §4): the mount state read carries
the whole list; switching to the Live surface re-reads it; search and category re-query it (`GET /api/channels?q=
&category=`, 250 ms debounce, a newer request abandons the older); the Refresh control and the no-channels note call
`POST /api/channels/refresh`, which re-reads regardless of the live view's 30 s TTL and re-probes every stream. A
refused read keeps the last rows and says why; with the backend unreachable the list is skeletons and the next
request is what finds the backend again (`03` §5.1). Probe statuses arrive with each read's answer (`03` §5.2).

**Loading the stream.** A row click or Enter selects, `PATCH /api/channels/last` remembers it, and the stage's
`<video>` attaches `channel.streamUrl` through `services/stream-player.ts` — `hls.js` when the browser can run it,
the browser's own HLS otherwise (`02` §3.1). The address is published data: the player loads the origin directly,
the fileserver never relays it (`00` §5). Ready is the first frame; a failed stream shows the note with Retry, which
attaches the same address again; nothing is drawn over the player while it loads (`00` §4.2). A playing stream
survives list re-reads.

**Start and auto-start.** A user gesture (row click, Enter) attaches and plays. On launch, when `liveOnOpen` is
`last` and the state's `lastChannelId` is still in the view, Live selects that channel and attaches its stream.
What `autoplay` means on the element is this plan's stated default, not a documented rule *(default, the owner's to
change)*: `autoplay` on plays at once; `autoplay` off (the `03` §3.2 default) shows the first frame paused until
play; a refused `play()` stays paused at the first frame, and nothing is force-muted. `liveOnOpen: none` attaches
nothing.

**Pause.** The browser's own controls (the family decision, `21` §3.4a) and the video's own keys; the paused state
is component state today and moves to the playback slice at wiring *(default)*. Channels never write watch history
(`03` §3.13).

**Titles and local files (Player).** The same stage grammar: sources or `streamUrl` per §3.4, local files through
the Range route. `resumeMode`'s values are read as named *(default, no doc spells them)*: `ask` shows the Resume /
Start over banner, `resume` seeks to the watched position at once, `restart` starts at zero; progress writes per §3.4.

### 3.3 Library

| Control | Route | Behaviour |
|---|---|---|
| Views and collections counts | `GET /api/library?view=` | counts appear once a view has been queried (`06` section 4.1) |
| Type strip, sort, filters, search | `GET /api/library` with `type`, `sort`, `genre`, `year`, `watched`, `q` | the previous cards stay while the next result loads; superseded requests are abandoned (`03` section 3.5) |
| Trending sort | `trending` in the library answer | offered only when `trending` is true (`06` section 4.3) |
| Continue Watching | `GET /api/library/continue` | drawn only with progress (`06` section 4.2) |
| Favourite | `PUT` and `DELETE /api/favorites/:kind/:itemId` | applies at once |
| Card menu, `Collections ▸` | `GET /api/collections`; `GET /api/items/:kind/:id/collections`; `PUT` and `DELETE .../items` | each row reports manual vs folder membership; a manual check toggles at once, while a folder-derived check is disabled with its reason; no dialog (`06` section 4.5, family standard) |
| Title information | `GET /api/titles/:id`; `.../seasons/:season`; `.../related` | the wide popup reads the detail; Play is enabled when the title has a `streamUrl` or at least one source, and disabled with `No stream source is set up for titles.` otherwise (`03` section 3.6) |
| Clear history | `DELETE /api/watch` | the two-step's second press clears all history; favourites, collections and files are untouched |
| Remove from History | `DELETE /api/watch/:watchId` | removes one entry |
| Rows shelves (`06` section 4.2) | the same `GET /api/library` answer, grouped in the client: the facets' genres, the kinds, the collections list, the favourites; no shelf adds a request | shelves are groups of the one query, so a change to the query changes every shelf; a group with no items is not drawn |
| Image failure | `GET /api/images/:id` | only that image shows its fallback; the query is not failed (`03` section 3.11) |

### 3.4 Player

| Control | Route | Behaviour |
|---|---|---|
| Local file | `GET /api/media/local/:id/info`; the Range route `GET /api/media/local/:id` | the file plays in the `<video>` and seeks through byte ranges (`03` section 3.10) |
| Test-server title and episode | the `streamUrl` from `GET /api/titles/:id` and `.../seasons/:season` | plays in the `<video>` like a channel (`06` section 5.3) |
| **Provider source (embed)** | the `sources` on the same answers | the stage hosts the source's embed address in the iframe of §3.4a; resume passes the watched seconds through `startParam`; progress comes from the decoded messages (`03` §7.5, `14`, `12` §2.3) |
| **Source control** | none (local choice) | on the stage toolbar when the title has two or more of {its sources, its `streamUrl` if any}: lists them, marks the active one; picking one clean-stops the current embed (src to `about:blank`, frame removed) and hosts the next (`06` §5.3 as amended). Default, no pick: the first source by order; the `streamUrl`, when present, is listed last as `App player` |
| Progress | `PUT /api/watch` | every 30 s while playing and on pause, end, seek settle, tab switch and close; each playback numbers its writes from 1, and a lower number never replaces a higher one (`03` section 3.13, `06` section 5.3). For an embed the position is the last decoded message's, and the write also fires on `pause`/`ended` messages and on clean stop |
| Resume and Start over | the watch entry in the title's detail | the banner shows where the title was left; Resume re-opens with `startAt` seconds for an embed, seek for the app's own media (`06` section 5.3) |
| Episode browser | `GET /api/titles/:id/seasons/:season` | changing the season starts nothing; choosing an episode loads that exact episode — for an embed, the episode source's own address (`03` §3.6) |
| Related band | `GET /api/titles/:id/related` | at most 20 cards; a local file's band stays collapsed with its reason (`06` section 5.5) |
| Watch block: Favourite, Collections, Remove from History | as in 3.3 | as in 3.3 |

Playback priority when both exist: sources win (the embed is the product path for titles); `streamUrl` plays when
there are no sources, which is exactly the dev-template lane (`03` §7.5). Stated default, not an open question.

### 3.4a The embed host (ported from the PoC, `14` §2.2–2.4)

- The stage swaps the `<video>` for a 16:9 iframe: `allow="autoplay; fullscreen; encrypted-media;
  picture-in-picture"`, `allowFullscreen`, `referrerPolicy="origin"`; `sandbox="allow-scripts allow-same-origin
  allow-presentation"` in the browser case, no sandbox attribute in Electron (the proven configuration).
- On frame load the nested-frame guard is installed: the source's `frameOrigins` are the allowed hosts, any other
  nested frame is pointed at `about:blank` and logged, `alert`/`confirm`/`prompt` become no-ops
  (`lib/frame-guard.ts`, the PoC's script verbatim).
- Messages: only frames whose `origin` equals the source's `origin` are decoded; everything else is one events row
  (`warn`). Decoded `timeupdate` positions feed progress; `pause` and `ended` fire their writes
  (`lib/embed-messages.ts`, the PoC's decode table).
- Retry re-creates the iframe with a fresh address. Tab switch, close and source switch clean-stop first: src to
  `about:blank`, frame removed (`14` check 13).
- A source whose frame never reports and never errors is the loading state, not a failure; the stage shows the
  player alone while it loads (`06` §3.1's grammar).
- **Sources without documented messages play but report nothing** *(a fact of the catalog, not a defect)*: only
  VidSrc, VixSrc, VidZee and VidSrc.su have documented player messages (`18` §6), and only some hosts document a
  start parameter (`18` §3). A source with neither shows no progress, offers no resume, and its drawer rows show
  load and guards only — the picker marks such a row so the choice is informed. The verified shapes win where a
  host's docs disagree with what it really posts (`12` §2.3, the VixSrc `event`-object case).

### 3.5 Settings

| Control | Route | Behaviour |
|---|---|---|
| Theme, Reduce motion, Accent, UI zoom | `PATCH /api/settings` | each applies at once and is saved (`03` section 3.2) |
| Autoplay, Subtitle language, Default view | `PATCH /api/settings` | saved; Default view changes the library's presentation |
| Address | `PATCH /api/settings` `adminUrl` | saved like any other row; the fileserver connects to it and the lists follow (`03` section 3.2) |
| State | `GET /api/state` `backend` | connected or not, the backend's revision, when the channels were read, the error if any (`03` section 4) |
| Collections | opens the Collections window | as the Library rail |
| Open History | closes Settings and selects History | as `04` section 2 |

The Settings window reads the committed settings from the store (today it reads the fixture constant — a phase 1
bug this plan fixes). The hydration applies the server's theme, accent, motion, zoom, playback and library values;
a control writes through `PATCH` and applies the committed answer, so what the server refused never sticks.

#### 5.1 Fileserver gap: the missing 11 settings keys

The built `Settings` (`src/fileserver/src/types/settings.ts`) implements 8 of the 19 keys of `03` §3.2. This plan
adds the missing 11 with their per-key schemas, defaults and refusal messages, and extends `settings.test.ts`:
`videoQuality` (`auto|higher|saver`), `audioLanguage` (BCP-47 tag or null), `lowLatency` (boolean),
`pictureFit` (`fit|fill|original`), `resumeMode` (`ask|resume|restart`), `watchedPercent` (`90|95|100`),
`liveOnOpen` (`last|none`), `librarySort` (`newest|oldest|az|year`), `showContinue`, `pauseHistory`,
`rescanOnStartup` (booleans). The watch threshold (`watchedPercent`) is read where the watch service marks
`watched` (today a constant); `liveOnOpen` gates whether the state answer carries `lastChannelId`.

### 3.6 Collections window

| Control | Route | Behaviour |
|---|---|---|
| Create | `POST /api/collections` | the new collection is listed at once |
| Rename | `PATCH /api/collections/:id` | the name changes at once |
| Remove collection | `DELETE /api/collections/:id` | the two-step's second press removes it; files on disk are never touched (`03` section 3.7) |
| Members | `DELETE /api/collections/:id/items/:kind/:itemId` | removes a manual member |
| Attach folder | `POST /api/fs/dialog`, then `POST /api/collections/:id/folders` | the native picker answers a token and a name, never a path; the scan streams (`03` section 3.8) |
| Scan progress | `GET /api/folders/:id/scan` as NDJSON | events arrive while the scan runs; a closed window does not stop the scan |
| Replace, Rescan, Cancel scan, Remove folder | `PUT`, `POST .../rescan`, `POST /api/jobs/:id/cancel`, `DELETE /api/folders/:id` | each acts on its folder; Cancel scan cancels the job (`03` section 3.9) |
| Jobs | `GET /api/jobs` | the window reads the jobs of its folders |

### 3.7 Events drawer — the network log

The drawer shows the traffic the interface can truly see (`21` §9). Its rows come from five sources:

| Source | Rows | Area |
|---|---|---|
| `services/api.ts` | one row per REST call: method, host (`fileserver`), status, ms; failures `warn`/`error` | Connection |
| `services/stream-player.ts` | manifest load, level switch, fragment-load failures, fatal errors | Media |
| The embed host | load outcome with the source's host; frame-guard refusals; dialog no-ops; a decoded-message summary (event, position, host) | Provider |
| `window.pocHost.onGuard` (Electron) | `popup`, `navigate`, `frame navigate`, `player hijack`, `permission`, `ad blocked` — exactly what `guards.ts` and `ad-blocker.ts` already report, host only | Connection / Provider |
| The hydration and Refresh outcomes | one row per state read that changed something the person can see | Connection |

Rules: a row keeps the method, host and status, and **never a path, query, token or raw URL** (`06` section 7; the
PoC logged full addresses — the port keeps host only). Areas gain `Provider` beside Connection, Catalog, Scan,
Media, Playback (`19` §7). At most 200 rows, newest first; the severity filter and Clear are as `06` §7; Clear
empties the list only. Honest limits, said in the row's tooltip where it matters: in a browser nothing inside a
cross-origin iframe is visible; in Electron the ad blocker reports what it **blocked**, not what it allowed
(`session.webRequest` is not used); `<img>` loads (posters, logos) are not logged. What is seeable is logged; what
is not, is not claimed.

The events log exists as of `25` wave 1 (VG-005): the store holds `events` rows, `clearEvents`, and `say()`
appends every warn or error notice as a row. This plan extends that log — it does not build a parallel one:
`types/events.ts` gains the `Provider` area, the slice gains one `logEvent` action (append, id, the 200-row cap)
fed by `services/api.ts`, the stream player, the embed host and the guard receiver, and the pure cap/format
helper lives under `lib/` (named for the domain), unit-tested. The severity filter of `06` §7 filters these rows;
Clear empties the list only. Nothing polls.

### 3.8 The ad blocker

Already running in the Electron host (`app/ad-blocker.ts` + `app/ad-hosts.ts`): Ghostery's ads-and-tracking lists
on the session, the `ad*`/`ads` host-resolver backstop, fail-soft (a first launch with no network starts
unblocked and says so). This plan wires what the interface shows of it: every `ad blocked` report is an events row
(host and request type), the About section's runtime facts say `Ad blocking: on` in Electron and `unprotected`
in a browser, and provider embeds are always sandboxed in the browser case (`14` §2.3). No new setting: the
blocker is on wherever the desktop shell runs (`16` §9.4 defaulted). The PoC's strict-mode allow lists stay a
PoC instrument (`16` §7).

### 3.9 Images — where each one loads

Every image address an answer carries is already same-origin (`/api/images/<id>`, the cache's rewrite, `03` §3.11).
They load as plain `<img src>` — never through `services/api.ts` *(default: an `<img>` is not a `fetch`, and `21` §9's
list of what is loggable does not include them, but no rule names images)* — so they are not rows in the drawer.
The route answers a strong `ETag` and a long cache lifetime, so reloads
are `304`s from the cache on disk; the first-ever request fills the cache lazily (10 s timeout, ≤10 MiB,
`image/*` only); a failed source answers `404 image.not_found` and only that image swaps to its glyph — the query
and every other image are untouched (`06` §2, `21` §4.2's `PosterImage` and `LogoImage`).

| Surface | Spot | Component | Answer field |
|---|---|---|---|
| Live | channel rows | `LogoImage`, 4:3 at 56 px | `Channel.logoUrl` |
| Library | grid, list, Rows shelves | `PosterImage`, 2:3 ≥144 px | `LibraryItem.posterUrl` |
| Library | Continue Watching cards | `PosterImage` | `LibraryItem.posterUrl` (continue answer) |
| Library | Title information window | 180 px artwork | `TitleDetail.posterUrl` |
| Player | episode browser rows | 16:9 still with fallback | `Episode.stillUrl` |
| Player | inspector Overview | poster at pane width | `TitleDetail.posterUrl` |
| Player | related band | square 140 px thumbs (the poster cropped to fit *(default: `object-cover`, no second request)*) | `RelatedAnswer.items[].posterUrl` |
| Collections window | members table | image column *(default: the member's `posterUrl`, the one image a row carries)* | `LibraryItem.posterUrl` |

Local files' stills are written by the scan's `poster-fetch` job: a just-scanned file shows the glyph, and its still
appears at the next library read — no polling. Phase 1's glyphs-only default (`21` §8, question 1) ends wave by wave
as each surface receives its real answers (2.2 logos, 2.4 posters, 2.5 stills).

## 4. Store

`02` section 2.1 names three slices, `shell`, `live` and `playback`. The template kept the collections in the shell.
So `02` section 2.1 is amended first, to add a `library` slice for collections and the views' counts. Then:

| File | Holds |
|---|---|
| `store/app-store.ts` | composes the slices |
| `store/slices/shell-slice.ts` | surface, pane visibility and sizes, the events drawer, the open flow and its item, theme, accent, motion, zoom, notice and folds |
| `store/slices/live-slice.ts` | the channel list as received, search and category, the selected and playing channel, the stage state |
| `store/slices/playback-slice.ts` | what the player reports, the user's playback choices, the tabs and their stage state, **each tab's `sources` and active source id** |
| `store/slices/library-slice.ts` | collections, the views' counts, the current library query |

The store performs no I/O and holds no promise, timer, DOM node or media element (`02` section 2.1). The events
rows live in the store as built (`25` VG-005) and grow by the one `logEvent` action of §3.7.

## 5. Hydration and write-back

`02` section 2.3 is the sequence, and the code follows it: the interface mounts invisible; the state read arrives and
its parts are validated separately; the saved shell is applied once; the panes snap; the interface shows after two
frames; a 1.5 s fallback shows defaults without writing them back; later changes are written back 400 ms after the last
change; a later state read never re-applies the saved shell.

## 5.2 Fileserver gap: serving the built interface

`build-app.ts` whitelists `/`, `/index.html` and first segments `html|css|js|data`. The React build emits
`assets/...`, so the built interface cannot be served. This plan extends the whitelist with `assets` (and the
favicon) and adds the SPA entry: a GET that is not `/api`, not `/healthz` and not a served file answers
`index.html`. `WEB_DIST` keeps its meaning; the Electron and gateway lanes point it at `src/frontend/dist`
(a root `web:build` script builds the interface first). The PoC's static folder and `/api/poc/results` are
untouched. Also landed here: the scan walk reports `null` percent while the walk runs (`22` §7a.2, the one-line
fix), so the status bar draws an indeterminate bar instead of a false 0 %.

## 6. Waves

Each wave wires one surface's controls. The frontend work follows the per-surface owners of `21` §5 (the owner's
directed split); every code wave has a worker (`07` §6.1, owner 2026-10-17). Foundation waves are delegated and
landed sequentially before dependent worktrees are cut; the coordinator documents, briefs, reviews, lands, checks
and packages, but does not implement wave code.

| Wave | Worker | Delivers | Proof |
|---|---|---|---|
| A | backend worker | the provider fields, migration, CRUD, the sources fill on detail and season answers, `scripts/seed-providers.ts` upgraded to the full catalog (all of `18` §2's embed hosts + the stream-family rows with their own `source` values), tests | the gate's backend steps; sources on a title answer for every active provider whose template applies, in order; no source without a template; a fresh seeded database lists the whole catalog with distinct sources |
| B | fileserver worker | the 11 settings keys; `sources` pass-through (schemas, types, service); provider records stop being attached; static whitelist `assets` + SPA entry; scan percent `null`; `watchedPercent`/`liveOnOpen` read their settings; tests | the gate's fileserver steps; settings round trip over HTTP; a built `assets` bundle served; sources on title and episode answers |
| 2.0 | foundation worker | `services/api.ts`, `services/ndjson.ts`, the schemas, `lib/error-sentence.ts`, `lib/event-log.ts`, the rule that refuses the admin backend's address in `src/frontend` (`01` §1.1) | `test/api.test.ts`, `test/event-log.test.ts` pass; the rule checker reports the new rule |
| 2.1 | state worker | the slices of §4, `services/state.ts`, `services/shell-state.ts`, `services/settings.ts`, the hydration and write-back hooks, the notice outcomes, the Settings window reading the store | a fileserver on a free port with a temporary `DATA_DIR` restores the saved surface and layout, and writes nothing before it has restored them |
| 2.2 | live worker | `services/channels.ts`, `services/stream-player.ts`, the channel search and the stage | Live opens on the last channel; Refresh updates the dots; a test channel plays |
| 2.3 | collections worker | `services/collections.ts`, `services/folders.ts`, `services/jobs.ts`, `services/desktop.ts`, `services/scan-stream.ts` | settings survive a restart; a collection is created and removed; a folder's scan streams and the indeterminate bar shows |
| 2.4 | library worker | `services/library.ts`, `services/titles.ts`, `services/favorites.ts`, `services/watch.ts`; the menu's `Collections ▸` wired | the views show their counts; a favourite persists; a collection toggled from the card's menu is listed after a restart |
| 2.5 | player worker | `services/local-media.ts`, the progress hook, the tabs, `lib/embed-url.ts`, `lib/embed-messages.ts`, `lib/frame-guard.ts`, the embed host component, the stage Source control | a local file plays and seeks; progress survives a restart; Resume works; with the seeder run, a title's first source plays in the embed and switching sources clean-stops and re-hosts |
| 2.6 | events worker | the events wiring of §3.7 across api, stream player, embed host and `pocHost.onGuard`; the drawer UI | a connection loss, a failed stream, a refused popup and a blocked ad each produce a row; host only, no paths |
| 2.7 | cleanup worker | fixtures deleted; `web:build`; the full walks | `grep` finds no import of `fixtures/`; the gate passes; the walks of `05` §3–5 run against the fileserver; the Electron window runs the embed with the guards and the blocked-ad rows |

Landing order: A and B land first (independent programs, disjoint paths), then 2.0/2.1, then 2.6's drawer rides
last among the frontend waves only if its sources exist — in practice 2.2, 2.3 and 2.4 land in any order (disjoint
folders), 2.5 after 2.4, 2.6 after 2.5, 2.7 last.

**Checks, every wave** (`07` sections 4 and 5): the gate's steps pass; the rule checker finds no reference to
the admin backend in `src/frontend`; the fileserver runs on a free port with a temporary `DATA_DIR`, never
`~/.giga-stream`; the wired surface is driven in the browser against it and looked at at both sizes; the embed
waves are also driven in the Electron window (that is where the guards live). The fileserver is started only with
the owner's say (`07` section 4).

**Workers.** One per wave, in worktrees under `D:\Projects\.giga-worktrees\` cut from the baseline the coordinator
commits first (`07` §6.2). Workers write the tests their brief names and do not run them; the coordinator lands
every branch, runs the gate and the real checks, and sends any failure back to the same worker with the exact
output (`07` §6.5).

## 7. Done when

Every control of `21` that was disabled or local in phase 1 either works against the fileserver or is disabled with the
reason the fileserver gives; a title plays through its provider's embedded player with resume, progress and source
switching; the events drawer shows the network log of §3.7; the settings round trip persists every key of `03` §3.2;
the walks of `05` section 3, 4 and 5 run in the browser against the fileserver; the fixtures are gone; and the gate's
frontend steps pass. The Electron window is checked in wave 2.7 and again in `08` phase 11.

## 7a. Scan progress: what the server gives and what is missing (checked 2026-10-16)

The shared scanner (`src/shared/media/src/scan/folder-scan.ts`) yields `found`, `probed`, `progress` (found,
probed, total) and `done`. The fileserver's scan runner (`services/scan-service.ts`) records each found file at
once, so a collection's item count rises during a scan, and `GET /api/folders/:folderId/scan` streams the events
as NDJSON with a catch-up snapshot. Wave B fixes the one server gap: the walk reports percent `null`
(indeterminate) while `total` is unknown, instead of `0`. The other two notes stand: a scan the interface did not
start is learned of at the next state read, and `poster-fetch`/`media-probe` percent changes are seen at the next
state read — enough for the rail and the status bar, by the no-polling rule.

Wave 2.3 closes the stream-boundary details: queued scans own their catch-up stream before a runner starts;
terminal catch-up remains available for the fileserver run; `cancelled` is terminal success; serialized file
events omit `absolutePath`, and terminal `done` repeats no file inventory; folder-scan Job answers carry
`folderId` so cancellation never guesses by label.

## 8. Decisions taken (formerly open questions)

1. **Events drawer rows.** Network traffic per §3.7: host only, never a path or query; the guard reports arrive
   through `pocHost.onGuard` (the preload's named capability, `01` §7 — not an application push); the embed's
   allowed requests are not visible in either runtime and the drawer does not claim them; `<img>` loads are not
   logged. Provider records' `data/providers.json` question is dissolved: the backend now carries the templates
   (§0.1), so the interface needs no provider catalog at all.
2. **Provider stage.** Built in wave 2.5 from the PoC's proven mechanics, per §3.4a. Embed-family providers only;
   stream-family sources wait until one is proven playable without a resolve step (`00` §5, `16` §3.2).
3. **Source preference persistence.** In-session only in this phase: the pick lives in the playback slice, the next
   open auto-selects the first source by order. A per-title stored preference (`16` §6.3) is user data and waits
   for its own contract change in `03` (fileserver table) — noted, not built here.
4. **Providers and `api_key`.** The fileserver stops attaching raw provider records; answers carry `sources`
   (§0.1). The credentials never reach the renderer.
5. **Browser-case containment.** Provider embeds are always sandboxed in a browser, unsandboxed in Electron; the
   interface says `unprotected` in the browser case (`14` §2.3, `16` §9.4 defaulted).
6. **Autoplay (§3.2a).** The setting governs unattended attaches only; a click always plays. Off: first frame
   paused; a refused `play()` never force-mutes.
7. **resumeMode (§3.2a).** Read literally: banner / seek-now / zero.
8. **Sources beat `streamUrl` (§3.4).** When both exist the embed plays and `streamUrl` is listed last in the
   picker as `App player`; with no sources the stream plays as today.
9. **Source pick is in-session (§3.4).** A stored per-title preference is a `03` contract change (a fileserver
   table, `16` §6.3's shape) — deferred, not forgotten.
10. **Provider records stop at the fileserver (§0.1).** Answers carry `sources`; `api_key` never reaches the
    renderer; the fileserver's provider-attachment tests are rewritten in wave B.
