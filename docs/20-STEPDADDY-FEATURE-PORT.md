# 20 - StepDaddy Feature Port Plan

**Status: research and port plan, rewritten 2026-10-16 after owner review.** The first draft of this
document graded StepDaddyLiveHD features by implementation complexity without asking where each one
would render, without checking Giga Stream's build status, and without respect for the product model.
This rewrite corrects all three. It inventories both backends against what the docs and the source
actually say, interrogates every candidate feature with the same five questions, ranks the
survivors by value to the product, and plans the ports in dependency order.

This is **not** an integration of StepDaddyLiveHD into Giga Stream: no Python, no sidecar (`01`
section 1.5), nothing outside the locked stack (`01` section 2). StepDaddy's code is a behavioural
reference for features the product decides it wants, re-implemented under `01`'s rules. Citations
look like (`06` §3.2) for documents and `src/backend/src/config.ts` for source that was read; build
status claims cite `03`'s status table and, where the source differs from it, section 8 of this
document. StepDaddy file paths are relative to `D:\Projects\stepdaddy-livehd-main\StepDaddyLiveHD\`.

## 1. How this document decides

Every candidate feature answers five questions, and the answer to the first can end the feature:

- **(a) Where does it render?** Which pane, strip, popup or window of `02`/`06` — or nowhere. A
  backend route with no surface is dead code, not a win. If there is no home, the feature stops
  here or goes to section 6 for an owner decision on placement.
- **(b) What does the user get?** One sentence in product terms.
- **(c) Is it already Giga Stream's own plan?** Cite the section and its build status (`03` status
  table; `19` §1 for what the mockup fakes). A feature `03` already specifies is not a port, and
  this document must say so rather than claim it.
- **(d) What must exist first?** The dependency chain; a feature whose dependencies do not exist is
  ranked behind them, whatever its complexity.
- **(e) Which governing-rule amendments does it need?** Named precisely. An amendment is an owner
  decision made in the governing document before the code, not a footnote to it.

Complexity is recorded but never sorts the list; value (what the user gets × how well it fits) does.

## 2. Giga Stream backend inventory, with build status

Read in full: `src/backend/src` (all of it), `src/fileserver/src` (all of it), `src/live-server/src`
(all of it). Statuses are `03`'s table (2026-10-16) checked against the source.

### 2.1 Admin backend — `src/backend` (port 8091, `~/.giga-stream-admin`)

| Feature | Where | Status |
|---|---|---|
| Composition root, start refusals, TLS/CORS policy | `src/backend/src/app.ts`, `network-policy.ts` | done (`03` §1-2) |
| Sign-in, refresh rotation with reuse detection, lockout, scrypt | `api/auth.ts`, `services/auth-service.ts`, `jwt.ts`, `password.ts`, `sign-in-limiter.ts` | done (`03` §7.12) |
| Admin accounts, roles, last-owner guard | `api/accounts.ts`, `services/account-service.ts`, `bootstrap-owner.ts` | done (`03` §7.11) |
| Channels CRUD, https address rule, revision bump | `api/channels.ts`, `services/channel-service.ts`, `address-rule.ts` | done (`03` §7.2-7.3). A channel record is `id, name, category, number?, logoUrl?, streamUrl, revision` — there is **no `tvgId` field** (`types/channel.ts`, `03` §7.2) |
| Providers CRUD — records only (`name, source, api_key, is_active`) | `api/providers.ts`, `services/provider-service.ts` | done (`03` §7.2b); no provider logic exists anywhere, by design (`00` §5) |
| Titles: browse/search/genres/detail/seasons/recommendations, OMDb block | `api/titles.ts`, `services/title-*.ts` | done (`03` §7.4). **Title answers carry no `streamUrl`** — see section 8 |
| TMDB client (paced, backed off, merged), OMDb client (budgeted) | `services/tmdb-client.ts`, `omdb-client.ts` | done (`03` §7.6) |
| Catalog sync: single-flight job, audited, `TMDB_SYNC_SCHEDULE` | `services/title-sync.ts`, armed in `app.ts` | done (`03` §7.6b). `01` §4.4 and `03` §7.6b both name it the system's **only** background timer |
| Audit log, owner-only | `api/audit.ts`, `services/audit-service.ts` | done (`03` §7.13) |
| Socket `/ws`: hello + `channels.changed` / `providers.changed` / `titles.synced` | `api/socket.ts`, `events/*` | done (`03` §7.8) |
| Store: numbered forward-only migrations, one revision counter | `store/*`, migrations `001-init.sql`…`004-titles.sql` | done (`03` §7.9) |

Not present anywhere in the backend, planned or built: EPG, playlist import, logo/category
enrichment, subtitles, any per-title playable-address work beyond `16`'s plan.

### 2.2 Fileserver — `src/fileserver` (port 8090, `~/.giga-stream`)

| Feature | Where | Status |
|---|---|---|
| Static delivery, Electron host, guards, ad blocking | `build-app.ts`, `app/main.ts`, `app/guards.ts` | done (outside `03`'s table) |
| Settings (`GET`/`PATCH /api/settings`, incl. `adminUrl`) | `routes/settings.ts`, `services/settings-service.ts` | done (`03` §3.2) |
| Shell state, last channel | `routes/shell-state.ts`, `store/channel-state-repository.ts` | done (`03` §3.3) |
| Live view + probe + channels routes + `GET /api/state` | `routes/channels.ts`, `state.ts`, `services/live-channels-service.ts`, `stream-probe.ts`, `admin-client.ts` | done (`03` §3.4, 4, 5) |
| Library query, titles pass-through | none | **not started** (`03` status: phase 7) |
| Collections, folders, scans, jobs, local media, image cache | none | **not started** (`03` status: phase 6) |
| Favorites, watch history | none | **not started** (`03` status: phase 8). The **database schema already holds the tables** — `favorites`, `watch_entries`, `collections`, `collection_items`, `collection_folders`, `local_files`, `jobs` are created by `store/migrations/001-init.sql` (kept from the archive; `002` keeps them, verified) — but no repository, service or route code touches them: `build-app.ts` registers six route groups only, and `routes/state.ts:27` answers `collections: []` |
| What the interface shows meanwhile | — | the mockup keeps favorites, history, watch progress, collections and settings in **localStorage**, shaped like `03` part A's records; the catalog is a fixture until phase 7 (`19` §1) |

### 2.3 Live server — `src/live-server` (port 8097)

Complete for its spec (`10`): loop/encode channels over real files, wall-clock sliding window,
supervised ffmpeg, Range media serving, generated logos, fault injection. It is a development
stream origin on loopback; `13` §9 (G7) replaces the seeded channels with operator-published real
channels for live use — the live server itself is not the production source.

### 2.4 The interface, summarized from `02`/`06` (read in full; it decides section 4)

Three surfaces, always mounted, no router, no fourth surface (`04` §1). **Live**: playback settings
(left), the player (centre — permanently; "It is always on the stage", `06` §3.1), channels (right,
260-440px, `02` §1.3) whose only extra is a collapsible **Details** strip at the foot — name,
category, number, revision (`06` §3.2) — and whose rows have **no context menu** ("the interface has
no channel verbs", `06` §3.2) and **no Now Playing block** (`06` §3.2). **Library**: collections rail,
body (type strip `All · Movies · TV · Local`, Continue Watching, poster grid/list, History), filters
(`06` §4). **Player**: tabs, episode browser, stage, Details (Overview/Details/Watch), Related
(`06` §5). Windows: Settings and Collections only; popups: Title information and Add to collection
only — that is the entire flow table of `04` §2. No titlebar search (`02` §1.1); `Ctrl+F` focuses
the active surface's own search (`06` §8).

## 3. StepDaddy backend inventory

A single Python FastAPI app (`backend.py`) with seven routers. Read in full last session and
re-verified where cited. Compact, organized by what could interest Giga Stream:

| Domain | What it does | Where |
|---|---|---|
| Live channel core | DaddyLive catalog with mirror failover; per-channel watch-page scrape → m3u8; HLS relay through `/content`+`/key` (XOR-tokenized URL+referer); segment prefetch; dead-channel and CDN-block tracking | `step_daddy.py`, `backend.py`, `utils.py` |
| Supplement sources | Free-TV / iptv-org / Adult Swim M3U fetchers (CDN failover, caps, platform tags); dulo.cx JWT playback-session resolve; ntv.cx embed scrape + referer-keyed manifest | `supplements/open_iptv.py`, `dulo.py`, `ntv.py`, `catalog.py` |
| M3U parsing | EXTINF attributes → name/tvg-id/logo/group-title/url | `supplements/m3u_parse.py` |
| EPG | windowed XMLTV parse (gz, caps); channel→tvg-id mapping (android map, name overrides, id bridge, suffix expansion, authoritative pins); WOFTV/Pluto/epg.pw merges; lazy gap-fill worker; now/next, schedule, batch, events, filtered XMLTV export; gzip disk cache | `epg.py`, `supplements/woftv_epg.py`, `pluto_epg.py`, `epgpw_*.py`, `episode_meta.py`, `episode_resolve.py` |
| Programme metadata | TVmaze + Cinemeta lookup for on-air programmes, poster HEAD-probe | `title_metadata.py` |
| VOD | 17-provider embed catalog (risk tiers, frameability, language hints); 9 direct HLS/MP4 extractors; OMSS client; Cinemeta catalog; resolve sessions + HLS/MP4 proxy + download | `vod_sources.py`, `vod_resolver.py`, `vod_extractors.py`, `omss_client.py`, `vod_catalog.py`, `backend.py` |
| VOD library | watched/favorite/bookmark/reminder/recents/progress/continue-watching; Trakt device auth, scrobble, history/watchlist sync | `vod_library.py`, `trakt_auth.py` |
| Subtitles | Wyzie search by TMDB id; SRT→VTT; fetch | `subtitle_service.py` |
| Party | rooms, WS sync (clock/chat/reactions/remote/WebRTC AV), LAN presence, invite pages, catchup ffmpeg timeshift ring | `party.py`, `catchup.py`, `party_pages.py` |
| Music/radio | ytmusicapi browse + A–Z directories; yt-dlp audio resolve + byte proxy + iframe fallback; Radio Browser mirror client + classification + dial + ICY now-playing; collaborative playlists | `music_ytm_client.py`, `music_stream.py`, `music_listen_routes.py`, `radio_browser.py`, `radio_dial.py`, `radio_nowplaying.py`, `music_library_routes.py` |
| Platform | unified search; HMAC share links; channel reports; client stability metrics; free-tier probes; per-IP stream rate limit; PIN auth with guest grace; household settings toggles; logo resolver + `/logo` proxy; taxonomy facets | `unified_search.py`, `backend.py`, `channel_report_routes.py`, `stability_routes.py`, `free_tier_routes.py`, `rate_limit.py`, `pin_auth.py`, `supplements/settings.py`, `supplements/logo_resolve.py`, `supplements/taxonomy.py` |

## 4. The interrogation — surviving features

### F1. Playlist sync — import plus scheduled refresh (admin backend)

**Owner decision, 2026-10-16:** the import is not a one-shot loader. The existing catalog-sync
scheduler precedent (`03` §7.6b) is extended: the sync runs on demand **and** on
`PLAYLIST_SYNC_SCHEDULE`, matching channels to playlist entries and updating them, so an imported
channel list does not silently rot. F3 (enrichment) is folded into this feature; F2 (EPG) is
deferred, but `tvgId` lands with this feature because the sync's own update matching uses it. The
contract is `03` §7.2c, written before the code.

- **(a) Where does it render?** Indirectly, and legitimately: channels are "published elsewhere"
  (`06` §3.2) — there is no administrator screen in the product (`03` §7: "a screen for
  administrators is not part of this document"), so an operator feature renders through the
  **channels pane**: the rows, logos, status dots and the category select that Live already shows
  (`06` §3.2). The sync itself is backend API, like channel CRUD itself (`03` §7.2).
- **(b) What does the user get?** Live stops being four test channels (`03` §7.7) and becomes real
  TV: hundreds of channels with names, logos and categories, published by pointing the backend at a
  playlist — and kept current by the schedule, with changed stream addresses refreshed and vanished
  entries reported instead of rotting as silent offline rows.
- **(c) Already planned?** No. `13` §9 (G7, "Real channels") says "channels an operator publishes"
  with `https` HLS addresses only, but no import mechanism is specified anywhere in `00`-`19`.
  Channel CRUD itself is done (`03` §7.2). The refresh half reuses the catalog-sync precedent
  (`03` §7.6b: single-flight, audited, actor `system`, schedule default off) rather than inventing
  a second mechanism — the owner's instruction, 2026-10-16.
- **(d) What must exist first?** Nothing — channels, the address rule, the audit log and the probe
  (`03` §5.2) all exist. This is the foundation deferred features (F2 EPG) would depend on.
- **(e) Amendments?** Written before the code, all landed 2026-10-16: `03` §7.2c (the sync routes,
  answer, update and prune semantics, caps), `03` §7.2 (`tvgId`/`source` fields on
  `BackendChannel`), `03` §7.13 (`channel.imported` action), `03` §8 (`playlist.invalid`,
  `playlist.busy`, `playlist.unreachable`), `01` §4.4 (the timer exception now names both
  backend schedulers). The https-only address rule (`03` §7.3) is **kept, not relaxed**: `13` §9
  already commits to "a stream that only plays through a relay is not used", so `http://` entries
  in public playlists are skipped and counted, not imported broken.

What is ported from StepDaddy: the M3U parser behaviour (`supplements/m3u_parse.py` — tvg-id,
tvg-logo, group-title, name; dedupe by name+url), the CDN-failover fetch with size caps
(`supplements/open_iptv.py`), the skip-and-count honesty (its per-source stats), and the
existing-logo-wins priority of its logo resolver (`supplements/logo_resolve.py`). What is not:
DaddyLive's channel scraping, the Dulo/NTV resolvers (section 6 — they exist to mint playable
addresses, which `00` §5 bans), and StepDaddy's re-fetch-everything model — the sync owns rows and
updates them, it does not mirror the playlist.

### F2. EPG now/next for the selected channel (admin backend + fileserver)

**Owner decision, 2026-10-16: deferred.** The placement question stays open (Details strip rows or
a channel popup) and the value of now/next alone did not clear the owner's bar. Deferred, not
refused: `tvgId` lands with F1 — the sync's own update matching uses it — so the exact-tvg-id join
this feature needs stays cheap whenever it is revisited. The plan in section 9.3 is retained
unchanged against that day.

- **(a) Where does it render?** A traditional grid guide has **no home**: the centre pane is
  permanently the player (`06` §3.1), the channels pane is a 260-440px column (`02` §1.3), a fourth
  surface is not contemplated (`04` §1; `06` §10 bans it), and 06 currently forbids both a channel
  context menu ("the row has no context menu", `06` §3.2) and a Now Playing block. The two shapes
  that fit inside `04`/`06`'s rules:
  - **Option 1 — Details strip rows.** The channels pane's foot already has a collapsible
    key/value strip (`06` §3.2 "Details"). Adding `On now` and `Next` rows (programme title and
    end time, a dash with no data) is the smallest possible change: an additive amendment to
    `06` §3.2's Details contents. It renders for the **selected** channel, which is exactly what
    the strip documents.
  - **Option 2 — a channel information popup.** A per-row info glyph (a read verb, like a card's
    Info in Library, `06` §4.2) anchoring a compact popup with a few hours of schedule. This needs
    a new control on the channel row and a new row in `04` §2's flow table — a larger `06` §3.2
    amendment, and the precedent for popups exists (`06` §2.7, the two existing popups).
  
  **Verdict: needs an owner decision on placement before any backend work.** This document does not
  choose between the options; it records that Option 1 is the smaller amendment.
- **(b) What does the user get?** While zapping, the strip under the channel list says what is on
  now and what is next — "NBA Basketball, until 8:00" — instead of a bare name and category.
- **(c) Already planned?** No. `00`-`19` do not mention EPG anywhere.
- **(d) What must exist first?** F1, necessarily: EPG joins channels to programme data by the
  playlist's `tvg-id`, and today's channel records have **no tvg-id field at all** (`03` §7.2,
  `types/channel.ts` — verified). Four seeded test channels with no tvg-ids would make an EPG
  pipeline worth nothing, which is the dependency chain the first draft inverted. Note the
  simplification this dependency buys: because Giga Stream imports the tvg-id **with** the channel
  (F1), StepDaddy's entire fuzzy-mapping apparatus — the android id map, name overrides, id
  bridge, quality/region suffix expansion, authoritative pins (`epg.py` `EpgChannelMapper`) — is
  **not ported**; the join is exact. Only if real feeds prove otherwise does mapping machinery
  return.
- **(e) Amendments?** `06` §3.2 (or §3.2 + `04` §2 for Option 2); an additive `03` §7.4c for the
  backend routes and an additive fileserver passthrough; a `tvgId` field on `BackendChannel`
  (`03` §7.2 — additive, older readers ignore it, `01` §8); and, only if the owner also wants a
  scheduled warm-up, an amendment to the one-timer rule (`01` §4.4; `03` §7.6b "This scheduler is
  the system's only background timer"). **The port is shaped to need no timer at all**: now/next is
  answered fill-through on read with a freshness window, exactly like titles (`03` §7.6b
  fill-through; `services/title-reads.ts` is the pattern), so the default needs no amendment to
  `01` §4.4. The warm-up is optional and only then touches the rule.

What is ported from StepDaddy: the windowed XMLTV download-and-parse (gz, size cap, bounded time
window, dedupe — `epg.py` `_parse_feed_into`), and the now/next answer shape (`get_now_next`).
What is not, because no grid consumes it: batch now/next and batch schedule endpoints (a grid needs
them; the Details strip asks for one channel), the XMLTV export (no external client exists in this
product), the background gap-fill worker (fill-through covers it), and the WOFTV/Pluto/epg.pw merges
(StepDaddy's fixes for its own regional-duplicate problem).

### F3. Logo and category enrichment (admin backend) — folded into F1

**Owner decision, 2026-10-16: part of F1, not a separate feature.** The category mapping
(`group-title` → `category`) is the guaranteed half — it comes from the playlist itself with
near-total coverage and fills the channels pane's category select (`06` §3.2). The logo resolver
is best-effort polish: an entry with no `tvg-logo` may get one from the iptv-org index; a miss
degrades to the row's existing glyph fallback (`06` §3.2), never a broken image. Both ship inside
the sync (`03` §7.2c, "Enrichment"). The interrogation is retained for the record:

- **(a) Where does it render?** Directly in surfaces that exist: the channel row's 56px logo box
  with glyph fallback (`06` §3.2) and the category select with counts (`06` §3.2).
- **(b) What does the user get?** Rows with real logos instead of glyph fallbacks, and a category
  dropdown that reflects the playlist's groups (News, Sports, Movies…) instead of whatever one
  string the operator typed by hand.
- **(c) Already planned?** The **image cache** (`03` §3.11) is the native answer for serving logo
  bytes — specified, **not started** (phase 6/7 per `03` status); the mockup loads logos today
  (`19` §3). Logo *resolution* — filling a missing `tvg-logo` from iptv-org's logo index — is not
  planned anywhere. Taxonomy facets (genre/country/language, `supplements/taxonomy.py`) have **no
  surface**: the channels pane has one category select and nothing else (`06` §3.2), so the facets
  are not ported; only the group-title → `category` mapping is.
- **(d) What must exist first?** F1 (enrichment runs during import, on the entries being created).
  The image cache (phase 6) is a follow-on, not a blocker: until it lands, direct https logo
  addresses render in the mockup exactly as `19` §3 describes.
- **(e) Amendments?** None beyond F1's. Enrichment happens at **write** time only — per-read
  network calls would change what `03` §7.2's cheap public reads cost, and are refused.

What is ported: the iptv-org `logos.json`/`channels.json` index with CDN failover and a
disk-cached, TTL-bounded index (`supplements/logo_resolve.py`), and the existing-logo-wins priority.
Not ported: the `/logo/{b64}` runtime proxy (`03` §3.11's image cache is the native equivalent —
specified, better), and the multi-facet taxonomy.

### F4. Watch history and favorites (fileserver) — Giga Stream's own plan, not a port

- **(a) Where does it render?** Fully specified surfaces: Library's History and Favorites views,
  Continue Watching, the History context menu and two-step Clear history (`06` §4.1-4.2), the
  Title information popup's Watch block (`06` §4.4), Player's Watch block with Favorite and Remove
  from History (`06` §5.4), Resume/Start over and the 30-second progress writes with monotonic
  `playbackId`/`seq` (`06` §5.3).
- **(b) What does the user get?** A title left partway offers Resume; History and Favorites are
  real views; progress survives restarts — the core of Library and Player.
- **(c) Already planned?** **Yes, completely** — this is the correction the first draft needed.
  `03` §3.12 (favorites) and §3.13 (watch history, with the `WatchWrite` shape and the seq rule)
  are fully specified and marked **not started (phase 8)**; the routes feed `03` §3.5's
  history/favorites/collection views; the schema tables already exist (`store/migrations/001-init.sql`
  — `favorites`, `watch_entries` — kept by `002`, verified in source); the mockup fakes them in
  localStorage (`19` §1). **StepDaddy's `vod_library.py` is a behavioural reference for details
  only.** Two details worth carrying: its continue-watching window (2-95% of duration,
  `list_continue_watching`) matches the shape `03` §3.5's continue route needs, and its ≥95%
  "watched" threshold is already `03` §3.13's *(default)* — a nice confirmation, not a port.
- **(d) What must exist first?** Nothing from StepDaddy. It is sequenced by `08` phase 8 (and
  phase 7 for the title data it links to).
- **(e) Amendments?** None — it is specified work. This document's only instruction: build it from
  `03`, not from StepDaddy.

### F5. Trakt sync (fileserver)

**Owner decision, 2026-10-16: dropped — the owner has no Trakt account.** The interrogation and the
plan in section 9.5 are retained unchanged against the day that changes; no work is planned, and
nothing in F4 (watch state) depends on it — F4 is complete without it.

- **(a) Where does it render?** A new group in the Settings window — Connect (device code), status
  row, Disconnect — following the window's existing form grammar (`06` §6.1 groups and rows; the
  About group already links out safely, `06` §6.2). Sync itself is invisible: it happens on the
  same watch-state transitions F4 already writes. The Library and Player surfaces do not change.
- **(b) What does the user get?** Watched marks, watchlist adds and playback progress appear in
  their Trakt account without thinking about it.
- **(c) Already planned?** No — `00`-`19` mention Trakt nowhere.
- **(d) What must exist first?** F4/phase 8 (the local watch state Trakt mirrors), and the
  interface's Settings window (phase 5, `08`). Ranked here because its dependency is the product's
  own next phase, not new port work.
- **(e) Amendments?** `03` gains a section (fileserver: `POST /api/trakt/device/start`,
  `GET /api/trakt/device/poll`, `POST /api/trakt/logout`, `GET /api/trakt/status`; tokens are the
  user's data, stored in the fileserver's database); `06` §6.2 gains the Settings group; and `01`
  §1/§1.2 gains one sentence naming Trakt as the fileserver's single additional external service —
  today the fileserver talks to nobody but the interface and the backend (`01` §1 diagram), so this
  is a real topology amendment, small and explicit.

What is ported from StepDaddy: the device-code flow and its poll cadence (`trakt_auth.py`
`device_start`/`device_poll`), and the transition hooks — history on first watched, history-remove
on unwatched, watchlist on bookmark toggles (`vod_library.py` `_sync_trakt`), scrobble
start/pause/stop on progress writes (`trakt_scrobble`). Its per-PIN-session identity becomes the
fileserver's own device/session row; Giga Stream has no PIN sessions (`00` §5).

## 5. The interrogation — features needing an owner decision on placement before any work

These have real value but no render home under the current `04`/`06`; work is refused until the
owner picks one of the recorded options (or says no).

### F6. Subtitle search for app-owned playback

- **(a) Where?** No home today: titles play in the provider's embedded player, which owns its
  subtitles through its documented `subtitleParam` (`13` §3 decided; `16` §4; the Settings row
  `subtitleLanguage` feeds it, `03` §3.2), and the app's own `<video>` currently plays only local
  files (no external subtitles exist for them) and test streams. **If** stream-style providers
  (`16` §3.2) are ever adopted, there is a clean placement with no new control: fetched VTT tracks
  are added as `<track>` elements and chosen through the browser's own CC menu, which the stage
  already uses (`06` §3.1/§5.3 "the browser's own controls"). Until then a subtitle route is dead
  code.
- **(b)** Subtitles in the user's chosen language on titles that play in the app's own player.
- **(c)** Not planned. The Settings row `subtitleLanguage` exists for the embed path.
- **(d)** Stream-style playback (post-`14`, `16` §3.2) — nothing else gives it value.
- **(e)** `03` section + nothing structural, once the playback path exists.

### F7. Music (YouTube Music browse) and radio

- **(a) Where?** No home. Library is defined as "titles and your own video files" with collections,
  favorites and watch history (`00` §3, `02` §4); its type strip is exactly `All · Movies · TV ·
  Local` (`06` §4.2); a fourth surface is banned (`04` §1, `06` §10). Realistic options within the
  rules: (i) a `Music` segment in Library's type strip plus a `music` tab kind in Player — a real
  product-model change touching `00` §3, `02` §1.3/§4, `06` §4-5 and `03` §3.5's `LibraryItem`
  kinds; (ii) not now. There is no smaller shape that is honest.
- **(b)** A music section: browse artists/albums/playlists, search, and play, plus radio stations
  by genre and location.
- **(c)** Not planned anywhere.
- **(d)** The placement decision itself; then a new domain from scratch. Note also that StepDaddy's
  implementation rests on Python-only tools (`ytmusicapi`, `yt-dlp` — `music_ytm_client.py`,
  `music_stream.py`); under the locked stack (`01` §2) the browse surface must come from a Node
  client and the playback default inverts to the YouTube iframe embed (the embed-family mechanism
  `16` §5.1 already defines), with server-side extraction optional and off by default.
- **(e)** `00` §3, `01` (topology: a fifth program or a fileserver surface), `02`, `06`, `03` —
  all of them. This is why it is gated, not ranked.

### F8. Channel reports

- **(a) Where?** Nowhere under the current `06`: channel rows have no context menu and "the
  interface has no channel verbs" (`06` §3.2), so an intake needs a new per-row control and a
  `04` §2 flow row — an owner decision on placement. The operator's triage side has no surface at
  all (there is no administrator screen, `03` §7). And most of the value is already covered: the
  probe marks broken streams offline on every read (`03` §5.2) and the notice line carries
  failures; StepDaddy needed reports because it scraped flaky third-party channels for anonymous
  users — Giga Stream publishes operator-chosen channels.
- **(b)** A way to tell the operator "this channel shows the wrong thing" beyond the offline dot.
- **(c)** Not planned; nearest existing pieces are the probe and the audit log.
- **(d)** Real channels (F1) would have to exist first for reports to mean anything.
- **(e)** `06` §3.2 (a row control), `04` §2 (a flow), `03` (an intake route) — all pending the
  placement decision.

## 6. Does not fit the product model — explicit findings, not failures

Each kept out with its five answers, tersely. These are the ports the first draft proposed; the
product model is why they are refused.

| StepDaddy feature | (a) Where would it render? | (b)-(e) in short | Refusal grounds |
|---|---|---|---|
| **Unified search** (`unified_search.py`, `/search`) | No home: `02` §1.1 bans a titlebar search; `06` §8 makes `Ctrl+F` focus the active surface's search; each surface searches its own data (channels `06` §3.2, Library `06` §4.3) | (b) one search across everything; (c) not planned — the per-surface model **is** the plan; (d) nothing would fix (a); (e) amendments to `02`, `04`, `06` against their grain | The product model is deliberately per-surface search. A feature with no surface is not a win |
| **Watch party** (`party.py`) | No home: three surfaces always mounted, no fourth (`04` §1; `06` §10); every flow is in `04` §2's table and a party is not among them | (b) watching together; (c) not planned; (d) everything — a party surface, invite UI, member lists; (e) `01` §4.4's no-WebSocket rule, `04` §1, `06` — and the product is a single-user desktop app (`00` §1) | No surface, banned transport, single-user product |
| **Catchup timeshift** (`catchup.py`) | No home: it exists in StepDaddy only to give parties a shared seekable live timeline; Live's stage has no seek-back UI (`06` §3.1 player, `06` §3.3 live-edge readout) | (b) rewind live TV; (c) not planned; (d) a party surface (refused above) or a Live DVR surface that does not exist; (e) `06` §3 transport changes | Its only consumer is a feature with no home |
| **Share links** (`backend.py` `/share/*`) | No home: `00` §5 bans "any playback window outside the app" outright | (b) send a friend a stream link; (c) banned, not unplanned; (d) moot; (e) an `00` §5 amendment the owner has never contemplated | Governing ban |
| **HLS relay, key proxy, direct stream extractors, Dulo/NTV resolvers** (`step_daddy.py`, `vod_resolver.py`, `supplements/dulo.py`, `ntv.py`) | No home and no route: `00` §5 bans "a step that resolves a channel or title into a stream, and any relay or proxy of video"; `13` §3 (G3) repeats it: "No stream extraction, request interception, access-control or DRM bypass, and no proxying are added to make something play" | (b) playable addresses from scraped hosts; (c) the decided path is the providers' **embedded players** (`13`, owner 2026-10-16; `16`), with stream-style providers served by an external CinePro Core instance's own proxy (`15` §4, `16` §3.2) — never by Giga Stream code; (d) nothing; (e) an `00` §5 reversal | Governing ban, twice, with the provider-embed decision already made |
| **PIN auth and guest grace** (`pin_auth.py`) | No home: `00` §5 bans accounts and sign-in for the product; the admin backend already has the stronger JWT auth (`03` §7.12) | (b) household gate; (c) N/A by ban; (d) moot; (e) `00` §5 reversal | Governing ban; admin auth already exists |
| **Client stability metrics, free-tier probes, health dashboards** (`stability_routes.py`, `free_tier_routes.py`, `/health/visual`) | No home: these are single-user VPS ops tools; the product's visible failure surface is the Events drawer (`06` §7) and the statusbar's notice line (`06` §1.2), which already exist | (b) operator telemetry; (c) not planned; the drawer is the plan; (d) moot; (e) none could create a surface | The product already shows failures where they belong; there is no ops console to render the rest |
| **Per-IP stream rate limiting** (`rate_limit.py`) | No home: it protects a public media gateway; Giga Stream's live server is a loopback development origin (`10`), the backend serves JSON only (`01` §7), and the fileserver serves one local user | (b) abuse protection; (c) N/A — nothing public serves media; (d) a public deployment that does not exist; (e) none | Deployment model mismatch |
| **Collaborative playlists, share deep-links** (`music_library_routes.py`, `music_share.py`) | No home: they depend on F7 (music) and on multi-user sharing in a single-user product (`00` §1) | (b) shared playlists; (c) not planned; (d) music placement + a social model; (e) as F7 and more | Depends on a gated feature and a banned social model |
| **Cinemeta VOD catalog** (`vod_catalog.py`) | No gap: Giga Stream owns TMDB (`11`), with the title store, OMDb enrichment and the sync all done (`03` §7.4, 7.6, 7.6b status **done**) | (b) a keyless catalog; (c) already better: built; (d) moot; (e) none | Not a gap |
| **Logo proxy** (`/logo/{b64}` + disk cache) | No gap: `03` §3.11's image cache is the native equivalent — specified, phase 6; StepDaddy's is a workaround for the same need | (b) logo bytes; (c) planned; (d) phase 6; (e) none | Already specified better |
| **EPG XMLTV export** (`/epg.xml`) | No consumer: it serves external IPTV client apps; Giga Stream's only client is its own interface | — | No external client exists |
| **Neighbour/order zapping routes** (`/channels/neighbors`, `/channels/order`) | Already covered: the channels pane has arrow-key navigation and published order (`06` §3.2, `08` phase 4) | — | Not a gap |

## 7. The ranked list — and the owner's decisions on it (2026-10-16)

| # | Feature | What the user gets | Where it renders | Decision |
|---|---|---|---|---|
| 1 | **F1 Playlist sync** (import + scheduled refresh, enrichment folded in) | Live becomes real TV: hundreds of named channels with logos and categories, kept current by the schedule | The channels pane it fills (`06` §3.2) | **landed 2026-10-16** — the only port work; contract `03` §7.2c, built per section 9.1 and verified over HTTP against a live iptv-org playlist |
| 2 | **F4 Watch history + favorites** | resume, History, Favorites — the core of Library and Player | fully specified: `06` §4, §5.3-5.4 | **planned as Giga Stream's own phase 8** (`03` §3.12/3.13) — not a port; StepDaddy is reference only |
| 3 | **F2 EPG now/next** | what is on now and next while zapping | pending placement: Details strip rows or a channel popup | **deferred**; `tvgId` lands with F1 so the join stays cheap |
| 4 | **F5 Trakt sync** | watch state mirrors to a Trakt account, silently | Settings window group + hooks on F4's writes | **dropped** — no Trakt account |
| — | F6 Subtitle search | subtitles on app-owned playback | browser CC menu via `<track>`, only once stream-style playback exists | **owner decision** (needs `16` §3.2) |
| — | F7 Music + radio | a music/radio section | no surface; Library type-strip expansion or nothing | **owner decision** |
| — | F8 Channel reports | tell the operator a channel is wrong | a new per-row control the interface currently forbids | **owner decision** |

## 8. Verified doc-versus-source findings

Recorded because the first draft asserted build status without checking; each was verified in
source for this document.

1. **`03` §7.5's status row is ahead of the code.** The status table says the stream-address rule
   is "in progress — the dev template rule is built", but no `MOVIE_STREAM_TEMPLATE` or
   `EPISODE_STREAM_TEMPLATE` exists anywhere under `src/backend` (searched), `config.ts` does not
   parse them, and title answers carry no `streamUrl` (`services/title-shapes.ts`). Titles therefore
   cannot play from a stream address today. This is not a StepDaddy gap — the decided path is
   provider embeds (`13`) — but `08` phase 9's "test-server titles in the app's `<video>`" check
   cannot pass as specified until §7.5 is actually built or rewritten from `14`'s results. Flagged
   to the owner; no port in this document depends on it.
2. **The fileserver's user-data tables exist in schema but not in code.** `store/migrations/001-init.sql`
   creates `collections`, `collection_items`, `collection_folders`, `local_files`, `favorites`,
   `watch_entries` and `jobs`; `002-drop-synced-catalog.sql` keeps them (verified by reading both).
   No repository or route touches them (`build-app.ts` registers six route groups;
   `routes/state.ts:27` answers `collections: []`), which matches `03`'s "not started (phase 8)".
   So phase 6/8 is schema-present, code-absent — porting work there is greenfield code over an
   existing schema, not a migration project.
3. **What is mockup versus real** (`19` §1): channels and backend state are real (the seeded four);
   the catalog is a fixture until phase 7; favorites, history, watch progress, collections and
   settings are localStorage in the mockup. Any port that touches those surfaces lands in the
   mockup as fixture behaviour until its phase does.
4. **A doc tension to resolve before phase 9, noted for the owner:** `06` §10 says the built Player
   has "no source or provider control", while `16` §6 plans a Provider chip and picker in the Player
   stage toolbar. `19` §5 explains the PoC's picker rail is the instrument that phase 9 replaces;
   whichever way `06` §10 and `16` §6 are reconciled decides where F6's subtitles and any future
   provider-adjacent control render.

## 9. Implementation plan, in dependency order

Conventions throughout (`01`): routes do parse → one service call → envelope; SQL only under
`store/`; numbered forward-only migrations; limits and error codes in `constants/`; env only in
`config.ts`; every contract change lands in `03` **before** the code (`08` §0 contract-first); test
seams inject clock and fetch, nothing sleeps.

### 9.1 F1 — playlist sync: import + scheduled refresh + enrichment (admin backend)

The contract is `03` §7.2c (landed 2026-10-16); everything below implements it. Conventions:
`01` (parse → one service call → envelope; SQL under `store/`; numbered forward-only migrations;
limits and error codes in `constants/`; env only in `config.ts`; tests inject clock and fetch).

Create:

- `src/backend/src/services/m3u-parser.ts` — EXTINF attribute parse to `{ name, tvgId?, logoUrl?,
  groupTitle?, streamUrl }`; dedupe key `name + "|" + streamUrl` (StepDaddy's rule, verified
  `supplements/open_iptv.py`).
- `src/backend/src/services/playlist-sync-service.ts` — the run of `03` §7.2c: fetch each
  configured playlist with a timeout and the byte cap, parse, apply the address rule per entry
  (https only — skipped and counted, never imported broken, per `13` §9), `groupTitle → category`,
  match against sync-owned rows (same host first, then `tvgId`, then exact `name`), update changed
  fields in place, create unmatched entries, count vanished rows as `removed`, delete them only
  with `prune: true`; `dryRun` computes the counts without writing. Single-flight: a second start
  is `409 playlist.busy`. One revision bump and one `channels.changed` frame per run, one audit
  entry (`channel.imported`, counts + hosts only, never queries).
- `src/backend/src/services/logo-resolver.ts` — the iptv-org `logos.json`/`channels.json` indexes
  (CDN failover), resolved by `tvgId` first and normalized `name` second, disk-cached under the
  data folder with `LOGO_INDEX_TTL_HOURS`; the entry's own `tvg-logo` always wins
  (StepDaddy's priority, `supplements/logo_resolve.py`). Write-time only, called by the sync
  service; a miss imports the row with no logo. No runtime proxy — the bytes are the image
  cache's business (`03` §3.11).
- `src/backend/src/services/playlist-schedule.ts` — `PLAYLIST_SYNC_SCHEDULE` interval handling,
  the `title-sync.ts` schedule pattern: armed in `app.ts` only when both `PLAYLIST_URLS` and a
  schedule are set; the scheduled run is actor `system`.
- `src/backend/src/api/playlist-sync.ts` — `POST /api/playlist-sync` (owner/editor; body
  `{ dryRun?, prune? }`; answers `202` with the `03` §7.2c counts) and `GET /api/playlist-sync`
  (`running`, `startedAt`, `lastRunAt`, `lastOutcome`, `counts`, `schedule`, `playlists`).
- `src/backend/src/types/playlist-sync.ts` — the Zod schemas.
- `src/backend/test/playlist-sync.test.ts` — fixture playlists on disk; injected fetch and clock;
  covers: parse, dedupe, address-rule refusal counting, create/update match paths, prune on/off,
  dry run, single-flight, the schedule, enrichment with and without a logo index, revision/event
  semantics (one bump per run), and the audit entry.

Modify:

- `src/backend/src/store/migrations/005-channels-tvg-id.sql` — `ALTER TABLE channels ADD COLUMN
  tvg_id TEXT` and `ADD COLUMN source TEXT` (both nullable; `source` is the playlist host that
  created the row — sync-owned rows only; hand-created rows are never touched by the sync).
- `src/backend/src/store/channel-repository.ts`, `src/backend/src/types/channel.ts`,
  `src/backend/src/services/channel-service.ts` — read/write the optional `tvgId` and `source`
  (`03` §7.2); CRUD still treats both as ordinary optional fields.
- `src/backend/src/app.ts` (register routes, arm the schedule), `src/backend/src/services/service-registry.ts`,
  `src/backend/src/config.ts` (`PLAYLIST_URLS`, `PLAYLIST_SYNC_SCHEDULE`,
  `PLAYLIST_SYNC_MAX_BYTES`, `PLAYLIST_SYNC_MAX`, `LOGO_INDEX_TTL_HOURS`),
  `src/backend/src/constants/errors.ts` (`playlist.invalid`, `playlist.busy`,
  `playlist.unreachable`), `src/backend/src/constants/limits.ts`.

Out of scope: the fileserver and the interface (channels flow through the existing live view,
revision and `channels.changed`); EPG (F2, deferred); anything in `16`'s provider path.

### 9.2 F3 — logo and category enrichment

Folded into 9.1 by the owner's decision: `logo-resolver.ts` and the `groupTitle → category`
mapping are part of the sync service. No separate deliverable.

### 9.3 F2 — EPG now/next (admin backend + fileserver; deferred by the owner, 2026-10-16)

Backend — the pipeline, shaped to one channel at a time and no timer by default:

- `src/backend/src/services/epg/epg-service.ts` — `nowNext(channel)`: read the store when fresh
  (`EPG_FRESH_HOURS`, default 6), else fetch the feeds, parse, upsert, answer. Fill-through on read,
  the `title-reads.ts` pattern; no background worker, no revision bump, no socket frame (EPG is
  not channel data, the same reasoning as `03` §7.6b's "titles are not channel data").
- `src/backend/src/services/epg/epg-feeds.ts` — https-validated `EPG_URLS` (config-validated like
  `TMDB_BASE`), download with timeout and `EPG_MAX_FEED_MB` cap, gunzip, streaming windowed parse
  into `Programme` rows (start/stop within `EPG_HOURS` ahead, `EPG_PAST_MINUTES` behind; dedupe by
  tvg-id + start + title — StepDaddy's `_parse_feed_into` behaviour).
- `src/backend/src/services/epg/epg-shapes.ts` — constants and the `Programme`/answer shapes.
- `src/backend/src/store/migrations/006-epg.sql` — `epg_programmes (tvg_id, title, category,
  start_at, stop_at, season?, episode?, year?, fetched_at)` with an index on `(tvg_id, start_at)`;
  freshness is `fetched_at` per feed run, pruned past the window.
- `src/backend/src/store/epg-repository.ts`, `src/backend/src/types/epg.ts`.
- `src/backend/src/api/epg.ts` — `GET /api/channels/:channelId/epg` (public read, like channels):
  answers `{ channelId, tvgId?, hasData, now?, next? }`, each programme `{ title, start, stop,
  category? }` (Unix milliseconds, `03` §2). `epg.unavailable` (503) when no feed can be fetched and
  nothing is stored — the `tmdb.unavailable` precedent. **No batch, no schedule, no export** —
  nothing consumes them (section 4/F2).
- `src/backend/test/epg.test.ts` — a small gzipped XMLTV fixture; injected fetch and clock.

Fileserver — a passthrough, not a store (`03` §5's rule: backend data is read live, never written):

- `src/fileserver/src/routes/epg.ts` — `GET /api/channels/:channelId/epg`, one live read from the
  backend per request, in memory only; `503 backend.unreachable` / `502 backend.bad_response`
  exactly as the channels routes do.
- Modify `src/fileserver/src/build-app.ts`, `src/fileserver/src/services/app-services.ts`.

Interface (recorded for the placement decision, not built by this plan): Option 1 adds `On now` and
`Next` rows to the channels pane Details strip — a `06` §3.2 amendment naming the two rows, their
dash state, and that they are facts of the last read like the status dots (`06` §3.2 "When the dots
move"); Option 2 adds the row glyph and a `04` §2 flow. The owner picks; the backend above serves
either unchanged.

Only if the owner also wants a warm-up: `EPG_SYNC_SCHEDULE` mirroring `TMDB_SYNC_SCHEDULE`
(`config.ts`, `app.ts` arm/clear beside the title schedule), **with** the `01` §4.4 one-timer
amendment written first. Default is off, exactly like the title schedule's default.

### 9.4 F4 — watch history and favorites: build `03` §3.12/3.13 (phase 8)

No port. The instruction this document adds: implement `PUT /api/watch` (the `WatchWrite` shape and
the seq rule, `03` §3.13), `DELETE /api/watch/:watchId`, `DELETE /api/watch`, `PUT/DELETE
/api/favorites/:kind/:itemId`, over the existing `watch_entries`/`favorites` tables
(`store/migrations/001-init.sql`, verified present) — files under `src/fileserver/src/routes/`,
`services/`, `store/` following the settings-service pattern, sequenced by `08` phase 8 and wired
to `03` §3.5's views. StepDaddy's `vod_library.py` may be consulted for the continue-watching
window (2-95%) when `03` §3.5's continue route needs its *(default)* pinned; nothing else comes
from it.

### 9.5 F5 — Trakt sync (fileserver; dropped by the owner, 2026-10-16)

No work is planned — the owner has no Trakt account. Retained unchanged against a revisit:

Create:

- `src/fileserver/src/services/trakt-client.ts` — device-code start/poll with the documented
  interval and `slow_down` handling (StepDaddy `trakt_auth.py` as reference), token rows in the
  fileserver's database via `src/fileserver/src/store/migrations/004-trakt-tokens.sql`
  (`trakt_tokens: session_id, access_token, refresh_token, expires_at, username, connected_at` —
  the user's own data, the fileserver's to keep, `01` §1.2); scrobble and history/watchlist calls
  with timeouts and a size cap, never blocking a local write on the network answer (StepDaddy's
  local-first ordering, `vod_library.py` `upsert_item`).
- `src/fileserver/src/routes/trakt.ts` — the four routes of section 4/F5.
- `src/fileserver/src/types/trakt.ts`.

Modify: `build-app.ts`, `app-services.ts`; the phase-8 watch-history service gains the transition
hooks (watched→history add, unwatched→remove, favorite→watchlist, progress writes→scrobble), each
fire-and-forget with one notice-line outcome on failure (`04` §6's single-flight honesty).

Docs first: `03` §3.14 (the routes and shapes), `06` §6.2 (the Settings group: a Connect row that
answers the device code and the activation link — opened through the safe external navigation the
About group already uses — a status row, a Disconnect row), and `01` §1's diagram plus one sentence
naming Trakt as the fileserver's single additional external service.

### 9.6 F6-F8 — no work until the owner decides placement

Each records its options in section 5; on a decision, the plan is written the same way as the
above — contract into `03`/`06`/`04` first, then files. On "no", they join section 6 with the
decision noted.

## 10. Acceptance

1. Every governing-document amendment the planned work needs — `03` §7.2c, §7.2's `tvgId`/`source`,
   §7.13's `channel.imported`, §8's playlist codes, `01` §4.4's two-scheduler exception — is
   written into the governing document **before** the code that relies on it (all landed
   2026-10-16), and `scripts/check-rules` still passes.
2. The five-question interrogation of section 4/5/6 remains true at the end: every surviving
   feature renders in a named pane, strip, popup or window of `06`.
3. The playlist sync's visible result is run and looked at (`01` §10): a configured playlist fills
   the channels pane with logos and categories; a changed playlist entry updates its channel on
   the next run; `prune: true` removes a vanished channel; the offline dots tell the truth on
   Refresh. EPG (F2) and Trakt (F5) have no visible result — deferred and dropped.
4. Tests inject clock and fetch; playlist fixtures live on disk; nothing sleeps; the gate passes.
