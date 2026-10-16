# 19 - Mockup V2: Building the Full Interface

**Status: plan, 2026-10-16 (rev 3).** The mockup is the **full interface design realized in
HTML/CSS/JS** — every surface, pane, popup, window, drawer and key of `06`, at production fidelity —
with the provider proof of concept living inside the Player surface, where provider titles play
(`06` section 5.3). Nothing is disabled-as-a-placeholder and nothing is deferred: if a control exists
in `06` it works in the mockup, against real services where they exist (the backend's channels API,
the fileserver) and against fixture data where the backend phase has not landed (the TMDB catalog).
The design system comes verbatim from the checked mockup (`giga-stream-poc/src/mockup`: tokens,
controls, shell) which implements `01` section 9's grammar; `06` section 2's surface rules are the
acceptance criteria for every pane.

## 1. Data strategy (what is real, what is fixture)

| Data | Source in the mockup |
|---|---|
| Channels + revision | **real**: `GET /api/channels` on the admin backend (public read, `03` 7.2); the four seeded test channels serve it; refresh re-reads |
| Backend state (statusbar connection, Settings → Admin backend) | **real**: `GET /healthz` (role, revision, tmdb state) |
| Catalog titles, posters, details, seasons, episodes, related | **fixture now, real at phase 7**: `data/catalog.json` (TMDB ids, `image.tmdb.org` poster/still paths, ~14 titles, episode lists for two series) stands in for the backend's synced title store (`03` section 7.6b); when phase 7 lands the pages read `GET /api/library` and the title routes — fill-through means even the first browse fills the store, and `TMDB_SYNC_SCHEDULE` keeps trending and popular warm |
| Playback of a fixture title | **real provider embeds**: the thirty hosts of `18` via `data/providers.json` (the PoC's core); a test-server `<video>` stream is a per-title fixture field used only to exercise the `<video>` path (`06` section 5.3 keeps both) |
| Favorites, history, watch progress, collections, settings | **mockup-local**: `localStorage`, shaped exactly as `03` part A's records would have them; the fileserver's collection routes replace this in phase 4 of `08` |
| Provider check results | **real**: saved through the fileserver's PoC results route (`14` section 2), as before |

## 2. Shell (`06` section 1) — everything works

- **Titlebar (40px)**: left-pane toggle (per-surface, pressed state, restores committed size) · brand
  tile + lockup · centred recessed **Live / Library / Player** switch with sliding chip (`Ctrl+1/2/3`) ·
  bottom-pane toggle (lit on Player; disabled with tooltip elsewhere) · right-pane toggle · window
  controls through the preload capabilities. Drag region and caption-button reserve exactly as the old
  `frame.css` and the fileserver shell do it.
- **Statusbar (24px)**: connection dot + lowercase mono word driven by real health polling
  (`connecting/ready/reconnecting`, sentence as tooltip) · the notice line as a polite live region with
  info/warn/error tones carrying every outcome and refusal · **Events** toggle (drawer) · **Settings**
  toggle (window). Both light while open.
- **Panes and sashes** (`06` section 1.3): the exact min/preferred/max table per pane, Allotment-style
  drag with pointer capture, collapse commits then 100 ms tween, closed-pane sash locked, sizes and
  visibility persisted (`localStorage` in the mockup, the store in production) and restored at launch,
  sub-1000px collapse order right-then-left.
- **Show on settle** (`06` section 1.4): mount invisible, apply layout, snap, reveal two frames later.

## 3. Live surface (`06` section 3) — full build, real channels

- **Channels (right)**: heading + count, **Refresh** calling the backend and reporting on the notice
  line; search field with 250 ms debounce and clear control; category select with counts; channel rows
  with 56px 4:3 logo boxes (shimmer/fallback), number, name, status dot (live/offline/unprobed),
  category label, accent `live` marker on the playing row, accent-bar selection; keyboard row movement
  (`06` section 8); the **Details** collapsible (name/category/number/revision mono rows) at the foot;
  14 skeleton rows for every loading/empty/search-miss/unreachable state.
- **Player (centre)**: a `<video>` with the browser's own controls, hls.js driving when possible;
  `06` section 3.1's exact state table (loading → player alone; failed → centred note with icon,
  sentence, **Retry**; no channels → same with **Refresh channels**); first frame = ready; a playing
  stream survives list refreshes; nothing drawn over the player while it loads. Streams come from the
  channels' `streamUrl` (the seeded test channels point at the streaming test server).
- **Playback settings (left)**: the five collapsible sections with every row of `06` section 3.3 —
  quality select from the real hls levels, resolution/bitrate readouts, fit (Fit/Fill/Original),
  aspect, audio track + language, captions select, latency Normal/Low, live-edge readout — each row
  that the current stream cannot serve **disabled in place with exactly the six documented tooltip
  sentences**.

## 4. Library surface (`06` section 4) — full build, fixture catalog

- **Collections (left)**: Views (All, History, Favorites) and Collections sections, collapsible
  (`06` section 2.8); rows with glyph, name, count (only once queried), scan dot, accent-bar selection,
  context menu (Rename/Remove on collections; two-step remove stating `Original files remain
  untouched.`); the full-width **Manage collections** footer opening the Collections window.
- **Body (centre)**: the `All · Movies · TV · Local` type strip; the **Continue Watching** strip (at
  most 10 cards, poster/label/progress/resume fact/Play/Info, absent when empty); the **poster grid**
  (2:3 cards ≥144px with poster, favorite mark, real quality, progress bar, watched check, explicit
  Play and Info, two-line title, year; context menus; arrow-key navigation) and the **list view**;
  **History** rows with watch ids, Remove from History, and the two-step **Clear history** strip;
  state table of `06` section 4.2 (12 card / 10 row skeletons, paging trails, last-good on failure,
  per-image fallback).
- **Filters (right)**: search (combines with everything), View segmented, Sort select (Trending only
  when the fixture carries a real popularity signal), Genre multi-choice chip popover with search at
  12+, Year select, Watched select, **Clear filters**; label stacked over a 36px control; choices keep
  superseded values listed.
- **Popups**: **Title information** (Wide 602px, Live policy: poster + identity + plot/cast/runtime,
  Watch block, Favorite/Add to collection/Play action strip; body scrolls, header and actions fixed,
  focus return rules) and **Add to collection** (Compact 242px, search over collections with check
  rows, applies at once, stays open).

## 5. Player surface (`06` section 5) — full build; the provider PoC plays here

- **Tabs** (`06` section 5.1): one per movie/series/local title, poster + title + close, reopen
  activates, `Sxx Exx` subtitle on episode change, limit 12 with LRU close after final progress write,
  active-tab close waits, context menu (Close / Close others / Reveal in Library), inactive tabs keep
  detail and scroll but hold no media element.
- **Episode browser (left)**: series header + season select with episode counts, `EpisodeCard` rows
  (16:9 still with fallback, `E1` numbering, title, duration/progress, watch marker; activation loads
  the exact episode in-tab; virtualized; 10 skeletons); the movie chapter; the local-file chapter.
- **Stage (centre)**: toolbar (media-kind icon · title with episode/file name · **Retry**,
  **Reveal in Library**, **Fullscreen**); the `<video>` with browser controls and `06` section 3.1's
  state grammar; the **Resume / Start over** banner against the watch record; progress writes every
  ≥30 s and on pause/ended/seek/switch/close with monotonic numbering; `F` fullscreen.
  **Provider titles play in the provider's embedded player hosted in the stage in place of the
  `<video>`** (`06` section 5.3): the thirty hosts of `18`, chosen by the PoC picker (below), with the
  documented start-position parameter for resume and the documented messages feeding progress where a
  provider documents them (`12`, `18` section 3.1).
- **The PoC harness in this surface**: the provider select, the docs link, the test-title presets, the
  start-at/subtitles/sandbox controls and the `14` checklist live as an extra collapsible rail section
  in the left pane, headed `Provider PoC`, with a note that production replaces it with automatic
  provider selection (`06` section 10: the built Player has **no source or provider control** — this
  section is the PoC's instrument, removed when `08` phase 9 builds selection). Provider/selection
  facts render in the right pane as an additional **Provider PoC** block beside Overview/Details/Watch.
- **Details (right)**: Overview / Details / Watch collapsible blocks exactly as `06` section 5.4,
  including the poster at pane width, cast chips, the Watch block's favorite toggle, collections list,
  Add to collection popup, Remove from History.
- **Related (bottom)**: full-width band with basis readout (fixture `TMDB` recommendations per title),
  2:3 cards, at most 20, activation opens/reuses a tab keeping the current, 8 skeletons, collapse
  toggle; disabled with `No related titles for local files.` for local.

## 6. Windows (`06` section 6) — both, fully functional

- **The frame** (`06` section 6.1): frameless panel, header with `X` named `Close <title>`, eight resize
  grips, scrim below the titlebar, 150px icon rail + 760px workspace, group rows (252px label column,
  info glyph, 22px pills, 20px swatches), centred open at content size clamped to 80% / 658×412,
  move/resize/remember.
- **Settings** (`06` section 6.2): Appearance (Theme Dark/Light/System, Reduce motion, Accent swatches —
  all **functional** through the token system: `[data-accent]` swaps the family, light theme via
  token overrides, `Ctrl+0` zoom reset), Playback (Autoplay, Subtitle language), Library (Default view,
  **Collections** opens the window, **Open History**), Admin backend (address row; state block reading
  the real `/healthz`: connected, revision, last channel read, error), About (version/build, runtime
  mode, safe external links, the TMDB notice). One commit at the end; no Cancel.
- **Collections** (`06` section 6.3): All + every collection; New collection group (name + Create);
  collections table with counts and scan state; per-collection member table (image/title/year/remove),
  attached folders (name, indexed count, scan state, last scan, Replace/Rescan/Cancel/Remove),
  **Attach folder** (the fileserver's native dialog where Electron provides it; disabled with its
  tooltip in the browser), Rename, two-step Remove collection.

## 7. Events drawer and keys (`06` sections 7–8) — full build

- **Events drawer**: 160px band above the statusbar; header with count, severity filter, **Clear**,
  close; rows of time, tone icon, area (Connection, Catalog, Scan, Media, Playback — plus the PoC's
  `Provider` area), normalized sentence, short identity; 200-row cap; no secret, path or token;
  Clear empties only the list. The PoC's message/event streams and the provider `postMessage` log are
  rows in this drawer (raw payload behind the row's expandable detail — the one mockup addition, needed
  by `14` check 5).
- **Keys**: the full `06` section 8 table — surface switch, Settings, zoom reset, search focus,
  Escape order, channel rows, player transport keys (on the `<video>`; provider iframes own their
  transport, `12` section 2.2); global keys yield to fields, selects, menus, popups, IME.

## 8. What the current v2 mockup is missing (the gap list)

| Area | v2 today | The build |
|---|---|---|
| Shell | `#app` divs; one-line titlebar; static statusbar | full titlebar + statusbar + sash panes + show-on-settle (`06` section 1) |
| Tokens/controls | hex literals, system-ui, ad-hoc css | the family `tokens.css`/`base.css`/`controls/*` verbatim; `06` section 9's blocks as shared modules |
| Live | absent | full surface on real channels + hls.js (`06` section 3) |
| Library | absent | full surface on the fixture catalog + localStorage records, both popups (`06` section 4) |
| Player | bare iframe slot | tabs, episode browser, production stage toolbar, details blocks, related band — with provider embeds in the stage (`06` section 5) |
| Windows | absent | Settings and Collections, full frame machinery (`06` section 6) |
| Events/keys | one flat list; none | the drawer grammar and the key table (`06` sections 7–8) |
| PoC harness | the whole page | a PoC rail section inside Player + a details block + drawer rows; checklist and `__poc.snapshot()` preserved for `check.mjs` |

## 9. Build order

1. **Design system**: copy `css/` (tokens, base, controls, shell, fonts) and `index.html` from
   `giga-stream-poc` verbatim; extract the `06` section 9 building blocks as shared partials/modules
   (RailSection, Segmented, StatusDot, Strip, DataTable skeleton sets).
2. **Shell**: titlebar, statusbar, sash panes with the metrics table, persistence, show-on-settle,
   notice line wired to real health polling.
3. **Live**: channels pane on the real backend API, player on hls.js, playback settings with the
   documented disabled-row tooltips.
4. **Library**: fixture catalog + localStorage records; body/grid/list/history, filters, both popups.
5. **Player**: tabs, episode browser, stage (video + provider embed paths), details, related; the PoC
   rail section hosting the thirty providers, availability, messages decode, checklist, results saving.
6. **Windows**: Settings (functional appearance) and Collections.
7. **Events drawer + keys**.
8. **Tooling**: `check.mjs`, `check-electron.mjs`, `network-rules.cjs`, `results/`; `runtime.js`
   re-exposes `window.__poc.snapshot()`; automated pass over the thirty providers.
9. **Verification**: a pane-by-pane walk against `06` — every control present and working or disabled
   with exactly its documented tooltip; skeletons shaped as content; no sentence under a control;
   selected ≠ playing; one scroll container per pane; the `14` checks re-run in Electron.

## 10. Fixtures to author

`data/catalog.json`: 14 titles (the two `14` test titles first) with TMDB id, IMDb id, kind, title,
year, genres, rating, poster/backdrop paths, quality, plot, cast, runtime/seasons; episode lists for
two series; per-title related (TMDB recommendations as fixture ids); two local-file entries; the four
seeded test channels come live from the backend, not fixtures.
