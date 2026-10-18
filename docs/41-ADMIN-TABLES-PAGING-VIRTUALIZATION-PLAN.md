# 41 - Admin tables: paging, virtualization, search and the stored-titles list

**Status: plan, written before the code (waves T0, B4, T1, T2, T3 of section 8).** Owner, 2026-10-17: "the tables are long, why is there no paging and virtualization on the tables. Plan that too", and, about Titles: "the titles aren't loading all titles." Today every admin list reads its whole answer and draws every row. That is fine for the lists that stay small and wrong for the two that do not: Channels (a synced IPTV playlist is thousands of rows) and Titles (the admin only ever shows a TMDB browse page, never what the backend stores). This document decides, list by list, what each needs; specifies one shared windowed grid and one paging contract; adds the one backend route Titles was missing; and plans the workers. It builds on `32` and `33` (the interface's windowing and its pager), `36` to `39` (the tabs) and `29` (B7, the stored-titles route, optional there and required now). Governed by `00`, `01`, `07`, `26`, `28`.

## 1. What exists and what is measured (verified in source, `family-port` at `0f31982`)

### 1.1 The grid and the lists

- **`RecordGrid` / `RecordGridRow` / `SkeletonGrid`** (`src/shared/ui/src/lists`): a header row, then a `ul` of 36px rows; the grid draws **every child it is given**. Its only scroller is `overflow-x-auto` around a `minWidth` box, so a narrow window scrolls the list sideways; vertically it grows with its rows and the **page** scrolls.
- **Every admin list reads its whole answer:** `ChannelRows` maps `channelRows(items)` over `GET /api/admin-channels` (all rows, `{ items, revision }`); Providers, Playlists, Jobs, Accounts the same over their list routes. `ChannelsState.items`, `selectAllState`, `pruneTicks` all assume the full list is in memory.
- **Titles** reads a TMDB browse page (`GET /api/titles`, `kind=all`, 20 per kind per page, `Older` / `Newer`, `totalPages` capped at 500 per kind) or a TMDB search page, plus the small `Deleted titles` list (`GET /api/titles/deleted`, read whole, `DeletedTitlesGroup`).
- **The Events drawer** (library `EventsDrawer`) keeps at most 200 rows (`EVENT_LOG_LIMIT`); the audit route pages by keyset (`GET /api/audit?limit&before`, `limit` 1 to 200, answers `nextBefore`).

### 1.2 The interface's windowing (`32`, `33`) and how it was fixed

`src/frontend/src/lib/window-rows.ts` is pure: `rowLayout`, `rowCount`, `visibleRows` (clamps a stale or non-finite offset), `nonEmptyRange` (a non-empty list never has an empty window), `windowSegments` (blank gaps plus the mounted rows, a pinned focused row kept mounted), `anchorOf` / `scrollTopForAnchor` (re-flow), `scrollTopToReveal`, `gridStep` (arrow keys by index), `resetsToTop` (a view switch or first read starts at the top, a revisit keeps the offset). `hooks/useWindowedRows.ts` measures with a `ResizeObserver` and the scroller's scroll events (no timers), treats a zero size as a hidden surface (changes nothing, restores the last offset when shown), and **holds the scroller in state** (`useState` + an effect that re-reads `scroller.current` after every commit): the fix of `32` "Fixed: grid after Rows", because the scroller is the parent of the list and its ref is not attached when the hook's layout effects first run, so a one-commit mount left the window unbound and blank. `lib/library-pager.ts` holds the paging marker's rules: `pagerCanRequest` (a scroller with no height requests nothing; "without this a hidden Library chained pages forever"), `withinLookAhead`, `requestVisiblePageOnce` (an in-flight guard that a declined request releases), `mayChain` / `MAX_UNSCROLLED_PAGES = 8`, `nearestScroller`. Constants: `OVERSCAN_ROWS = 2`, `PAGER_LOOK_AHEAD = 240`.

### 1.3 The data, measured

| Source | Size | Evidence |
|---|---|---|
| Stored titles on the owner's backend | **5,532 movies + 5,389 series = 10,921** (tmdb origin) | measured by the coordinator on the owner's backend |
| TMDB totals | 20,001 movies + 7,021 series = 27,022 | same |
| What `GET /api/titles` can ever show | 20 per kind per page, 500 pages per kind: **at most 10,000 movies and 7,021 series, one page at a time**, and **nothing that is only stored** | `api/titles.ts` (`BrowseQuery.page` max 500); `title-reads.ts` browse is TMDB discover |
| Synced channels | one row per playlist entry; an IPTV list is **thousands** (5,000 to 20,000 is ordinary); live channels stay a handful | `playlist-sync-service.ts`, `store/channel-repository.ts` (`list()` has no limit) |
| Accounts, providers, playlists, jobs | tens | `PLAYLISTS_MAX = 20` (`constants/limits.ts`); four seeded catalog jobs plus one per playlist; providers are the embed and stream sources |
| Audit log | unbounded in the database (every write is a row) | `audit_log`, `AUDIT_PAGE_MAX = 200`; the drawer holds 200 |

So: Titles "is not loading all titles" because the admin's list **is** the TMDB browse, never the store; Channels will not scale at all; the rest are small.

## 2. Decisions, list by list

Thresholds: **windowing engages above 100 rows** (`WINDOW_MIN_ROWS`); a list at or under 100 rows renders exactly as today (a plain `RecordGrid`, no scroller of its own). Server paging is page size **100** (`PAGE_SIZE`), at most 200 (the backend maximum, as audit).

| List | Size | Server paging | Client virtualization | Search / filter | Why |
|---|---|---|---|---|---|
| **Channels** (index) | thousands | **Yes**: `limit` / `offset` / `total` on `GET /api/admin-channels` (3.1) | **Yes** | **Server-side** `q`, `kind`, `origin`, `enabled`, `state`, `source`; column sort | 5,000 rows cannot be read, drawn or searched whole |
| **Titles, Stored** (new main mode) | 11,000 now, 27,000+ | **Yes**: new `GET /api/titles/stored` (3.2) | **Yes** | **Server-side** `q`, `kind`, `origin`, `edited`, `enabled`; column sort | the store was never listed; it is the real inventory |
| **Titles, Browse TMDB** (separate mode) | 40 rows a page | **Already** (TMDB `page`, `Older` / `Newer`) | **No** (40 rows) | TMDB `search` (Enter) and Kind / Sort as today | a TMDB page is small by construction |
| **Deleted titles** | tens to hundreds (a bulk delete of synced titles adds many) | **No** (read whole) until it passes **5,000** rows, then the same `limit` / `offset` on `/api/titles/deleted` (a later, additive change) | **Yes above 100** (client-only) | client-side filter box above 100 | cheap rows (id and name); all in memory is fine at this size |
| **Channel Status: playlist** (a live channel's ordered playlist) | up to hundreds (a folder of videos) | No (it arrives with the channel) | **Yes above 100**, read-only list | none | one read-only list inside a workspace |
| **Playlist Status: channels** (the channels a playlist created) | up to thousands | **Yes**: the Channels route with `source=<host>` (3.1), 100 at a time | **Yes** above 100 | none (it is already filtered by host) | today it would read the whole channel list and filter in the browser |
| **Providers**, **Playlists**, **Jobs**, **Accounts** | tens | **No** | **No** | none | small lists stay simple (`>100` would only mean a misuse) |
| **Events drawer** | at most 200 held | **Already** keyset (`before`, `limit`) | **No** (200 rows of one line) | none | unchanged: the cap and `Load older` are the paging |
| Seasons / episodes editor, VideoList, Frame origins | tens (a manual series may hold 500 episodes) | No | **No** now; the season editor is windowed only if a season passes 100 episodes (a later, separate change) | none | not tables of records |
| Job Last run lists (refused, created) | at most 10 | No | No | none | bounded by the backend |

The interface's Live surface also reads `GET /api/channels` whole; that public route is **not** changed here (the fileserver and its own windowing are a separate matter).

## 3. The backend (worker B4; `src/backend` only)

### 3.1 Channels: additive paging on `GET /api/admin-channels`

*Amended 2026-10-18 (plan `43`): the route gains two filters, `status` (`live`, `dead`, `unchecked`) and `playlist` (a playlist id), and the Channels first row gains the `Stream status` and `Playlist` selects; bulk `Enable` and `Disable` over ticked stream channels (4.5) go through `PATCH /api/channels` in 500-id chunks, one revision and one audit entry per chunk, instead of one `PATCH` per channel.*

Today: `services.channels.listAdmin(base)` -> every row, decorated (`adminChannel`), `{ items, revision }`. Additive, with the old answer when no paging parameter is given (so nothing that already calls it breaks):

`GET /api/admin-channels?limit=100&offset=0&q=&kind=&origin=&enabled=&state=&source=&sort=&dir=`

| Parameter | Values | Meaning |
|---|---|---|
| `limit` | 1 to 200 | page size; **its presence turns paging on** |
| `offset` | integer >= 0 | rows to skip |
| `q` | up to 120 characters | case-insensitive contains over `name`, `number`, `tvg_id`, `source` (the playlist host) |
| `kind` | `live` \| `stream` | |
| `origin` | `synced` \| `edited` \| `manual` | stream rows only (a row with `source` and no edited fields is synced, with edited fields edited, with no `source` manual); implies `kind=stream` |
| `enabled` | `true` \| `false` | |
| `state` | `preparing` \| `starting` \| `live` \| `restarting` \| `stopped` \| `failed` | live rows only; implies `kind=live`; computed from the engine for the (few) live rows, then applied as an id set |
| `source` | a playlist host | exact match; the Playlist Status list and the "channels of this playlist" link |
| `sort` | `number` (default) \| `name` \| `category` \| `kind` \| `source` | `number` is numeric (`CAST` of the text, rows with no number last) |
| `dir` | `asc` (default) \| `desc` | |

Answer: `{ items, revision, total, offset, limit }`, where `total` is the count **after** the filters and before `limit`. **The order is total and stable:** the chosen sort, then `name`, then the string `id`, so two reads of one page return the same rows and a page boundary never repeats or skips a row while nothing changed. Invalid values are `400 request.invalid` naming the field (the existing `parseInput`). Paging is done in SQL (`store/channel-repository.ts` `page(filter, sort, limit, offset)` returning `{ rows, total }`); the service decorates **only the returned rows** with the live engine state. Signed in, `no-store` (already). `revision` is the existing counter; it changes on every channel write, which is the page set's change marker (4.3).

### 3.2 Titles: the stored-titles list `GET /api/titles/stored` (the optional B7 of `29`, now required)

Lists every row of the backend `titles` table (`origin` `tmdb` and `manual`), **never calls TMDB**, signed in, `no-store`.

`GET /api/titles/stored?limit=100&offset=0&q=&kind=all&origin=all&edited=&enabled=&sort=title&dir=asc`

| Parameter | Values | Meaning |
|---|---|---|
| `limit` / `offset` | 1 to 200 (default 100) / >= 0 | as 3.1 |
| `q` | up to 200 characters | case-insensitive contains over the stored title text (`json_extract(payload, '$.title')`; `%` and `_` escaped) |
| `kind` | `movie` \| `tv` \| `all` (default) | |
| `origin` | `tmdb` \| `manual` \| `all` (default) | |
| `edited` | `true` \| `false` | has / has no `edited_fields` |
| `enabled` | `true` \| `false` | |
| `sort` | `title` (default, case-insensitive) \| `year` \| `rating` \| `fetched` (when it was stored or refreshed) | |
| `dir` | `asc` \| `desc` | |

Answer: `{ items: AdminTitleRow[], total, offset, limit, inventory: { movie, tv, manual, edited, disabled }, version }`. `items` use the existing admin row (`viewOf`: `id` string such as `movie-603`, `kind`, `title`, `year`, `rating`, `genres`, `posterUrl`, `tmdbId`, `state` = `synced` | `edited` | `manual`, `enabled`, `editedFields`). `inventory` is the whole store's counts (for the heading readout `10,921 stored`), independent of the filters. `version` = `count || ':' || max(fetched_at)` of the whole table (the change marker, 4.3). Total order: the sort, then the string `id`. Soft-deleted titles are not in the table (migration `020` removes the stored copy), so they never appear.

Mechanics: a new `store/title-repository.ts` `page(filter, sort, limit, offset)` and `inventory()`; `services/title-stored-service.ts`; `api/titles.ts` registers `/api/titles/stored` **before** `/api/titles/:titleId`. **`network-policy.ts` `PUBLIC_READ` must exclude it**, as it excludes `sync` and `deleted`: `titles(?!\/(sync|deleted|stored)(\/|\?|$))`, otherwise the route would be a cacheable public read. Search and sort read the title out of the JSON payload; at 27,000 rows that is a scan of tens of milliseconds, measured in acceptance. If it measures slower than **100 ms** at the real size, a follow-up adds a `VIRTUAL` generated column `title_text AS (json_extract(payload, '$.title'))` and an index on it (migration, additive); it is not built speculatively.

### 3.3 What does not change

`GET /api/providers`, `/api/playlists`, `/api/jobs`, `/api/admin-accounts`: no paging parameters (small). `GET /api/audit`: the existing `limit` / `before` keyset, unchanged: the log is append-only and read newest-first, which is exactly what a keyset cursor is for; it needs no random access. `GET /api/channels` (public) and `GET /api/titles` (TMDB browse) are unchanged.

### 3.4 Backend tests (written AND run by B4; temporary `DATA_DIR`; hand-moved clock)

`channels-paging.test.ts`: with 250 seeded stream rows and 3 live rows: `limit=100` returns 100 rows and `total` 253; pages 0, 100, 200 cover every id exactly once in the stable order; a second read of one page is identical; `offset` past the end is an empty page with the true `total`; each filter alone and combined (`q` on name, number, `tvg_id`, host; `kind`; `origin`; `enabled`; `state` on live rows; `source`); numeric sort puts 2 before 10 and no-number rows last; `dir=desc`; invalid values are `400`; no `limit` returns the old whole answer unchanged; the decorate step runs only for the returned rows (a spy counts); a write changes `revision`. `titles-stored.test.ts`: 150 stored rows (movie, tv, manual, edited, disabled): total, inventory and pages as above; `q` is case-insensitive and treats `%` literally; every filter; every sort and `dir`; deterministic tie order; no TMDB call (the TMDB stub is never hit); 401 without a token; the response is `no-store`; soft-deleted titles are absent; `/api/titles/stored` is not swallowed by `/:titleId`; `PUBLIC_READ` does not match it. `network.test.ts` (updated): the private-route list includes it.

## 4. The shared mechanism (worker T0)

### 4.1 What moves, what is new

Moved (pure, with their tests) from the interface to the shared library, and re-exported by one-line shims so the interface's imports and tests do not change:

| From | To | Why |
|---|---|---|
| `src/frontend/src/lib/window-rows.ts` | `src/shared/ui/src/lib/window-rows.ts` | the closed-form maths (`visibleRows`, `nonEmptyRange`, `windowSegments`, `scrollTopToReveal`, `gridStep`, `resetsToTop`); the admin needs the single-column case, and one copy means one fix |
| `src/frontend/src/types/window-rows.ts` | `src/shared/ui/src/lib/window-types.ts` | its types |
| the pure functions of `src/frontend/src/lib/library-pager.ts` (`pagerCanRequest`, `withinLookAhead`, `requestVisiblePageOnce`, `mayChain`, `nearestScroller`, `pagerStalled`) | `src/shared/ui/src/lib/pager-rules.ts` | the hidden / zero-size rule and the in-flight guard are the lessons of `32`; both programs need them |
| their frontend unit tests | `src/shared/ui/test/` (copies; the frontend keeps its own running through the shim) | the maths is then tested where it lives |

`useWindowedRows.ts` and `WindowedRows.tsx` are **not** moved: they are two-dimensional (columns, re-flow anchors, store events). The admin gets a one-dimensional hook built on the same maths.

New in `src/shared/ui/src`:

| File | Responsibility |
|---|---|
| `hooks/useWindowedList.ts` | the one-column engine over a scroller **held in state** (the `32` fix, copied as the pattern): measures with a `ResizeObserver` and scroll events, no timers; a zero size is a hidden surface (it changes nothing and, when shown again, restores the last offset); answers `{ range, segments, pin, focusIndex }` for `count` rows of `ROW_HEIGHT = 36`; overscan `OVERSCAN_ROWS = 2`; resets to the top when `resetKey` changes (a query change), keeps the offset on a revisit (`resetsToTop`) |
| `lists/WindowedRecordGrid.tsx` | the windowed `RecordGrid` (4.2) |
| `lists/RecordGridSkeletonRow.tsx` | one shimmer row in the header's own columns, for rows whose page is not loaded |
| `lists/record-grid-sort.ts` | `SortState`, `nextSort(current, key)`, and the `aria-sort` attribute value (the header cell becomes a button when the column is sortable) |
| `lib/window-constants.ts` | `ROW_HEIGHT = 36`, `HEADER_HEIGHT`, `WINDOW_MIN_ROWS = 100`, `PAGE_SIZE = 100`, `LIST_MIN_HEIGHT = 288`, `LIST_PAGE_MARGIN = 96`, `MAX_PAGES_KEPT = 30` |

### 4.2 `WindowedRecordGrid`

```ts
interface WindowedRecordGridProps<Row> {
  ariaLabel: string; layout: GridLayout; headings: readonly GridHeading[];
  total: number;                                   // rows matching the query (known from the first page)
  rowAt: (index: number) => Row | undefined;       // undefined: that row's page is not loaded
  idOf: (row: Row) => string;
  renderRow: (row: Row, index: number) => ReactNode;   // returns a RecordGridRow (state word, dim, tick, open, Delete: all unchanged)
  selection: ListSelection;                        // 4.4
  sort?: { state: SortState; onSort: (key: string) => void };
  resetKey: string;                                // the query: a change scrolls to the top
  onNeedRange: (first: number, last: number) => boolean;  // asks for the rows the window shows; answers whether a read was requested
}
```

- **Below `WINDOW_MIN_ROWS` rows the component renders the plain `RecordGrid`** over every loaded row (no scroller of its own): small lists, and the first moments of a big one, look and behave exactly as today.
- **Above it the grid owns its scroller** (both axes). The horizontal overflow that `RecordGrid` puts around its `minWidth` box has to live in the same element as the vertical one, because `position: sticky` does not work through an `overflow-x: auto` ancestor that is not the vertical scroller; so the windowed grid is one scroller with the **header sticky at its top** and the rows in a block of `total * 36px`. Its height is the content height up to the available height, `min(total * 36 + HEADER_HEIGHT, max(LIST_MIN_HEIGHT, pageHeight - LIST_PAGE_MARGIN))`, where `pageHeight` is the page scroller's `clientHeight`, read in state with a `ResizeObserver` (about 10 rows at 900 x 640, about 20 at 1600 x 1000). The page keeps scrolling normally around it.
- **Window and tail.** Only the rows the viewport touches (plus overscan and the focused row) are mounted, between blank gaps that keep the scrollbar honest. A mounted row whose page is not loaded renders `RecordGridSkeletonRow`; when its page arrives the row appears in place (`Reveal` is not used: a row fades in only on the first page). There is no end-of-list sentinel: loading is **driven by the visible range** (`onNeedRange`), which is why a scrollbar drag to the middle fetches the middle.
- **Paging marker rules, kept.** `onNeedRange` is a no-op while the scroller has no height (`pagerCanRequest`: a hidden tab never requests a page); a request already in flight for a page is not repeated (`requestVisiblePageOnce` guard, per page); at most `ceil(visible rows / PAGE_SIZE) + 2` pages are asked for per evaluation (a viewport touches one or two pages plus the look-ahead page), so the chain cap is the geometry itself and `MAX_UNSCROLLED_PAGES` is kept as a hard bound of 8 per evaluation. No timer and no poll: evaluations happen on scroll, resize, count change and page arrival.
- **Scroll position.** Kept when the tab is shown again (a hidden tab reports zero size; the hook restores the last offset when it is shown). Reset to the top when `resetKey` changes (a search, a filter, a sort, a mode switch), and on the first read after sign-in.
- **Keyboard.** Each row's spanning button is the primary (`data-primary`); `ArrowUp` / `ArrowDown`, `Home`, `End`, `PageUp`, `PageDown` move focus **by index** (`gridStep` with one column), so they reach rows that are not mounted yet: the hook scrolls the row into view, mounts it (pinned) and focuses it. The focused row stays mounted while focus is in it, so a row whose `Delete` is armed (the library `ArmedButton`) keeps its armed question until blur, `Escape` or the 4 s timeout, as today; an armed row scrolled out of the window is disarmed by unmounting (the same as blur). `Space` on a focused tick toggles it; `Tab` order is header, then the mounted rows in order.
- **Accessibility.** The list is `role="table"`-free: it stays the grid's `ul` with `aria-label`, `aria-rowcount` = `total` and each mounted `li` carries `aria-rowindex`; skeleton rows are `aria-hidden`. A sortable header cell is a button with `aria-sort`.

### 4.3 The paged list state (admin, worker T0): `lib/paged-list.ts` (pure) and `store/slices/paged.ts`

Every long list keeps the same state, built by one factory so Channels and Titles do not each invent it:

```ts
interface PagedState<Row> {
  status: "idle" | "loading" | "ready" | "failed";
  query: PagedQuery;                        // q, filters, sort, dir: serialises to a stable key
  total: number | null;                     // null until the first page
  pageSize: number;                         // 100
  pages: Readonly<Record<number, readonly Row[]>>;   // loaded pages by index; at most MAX_PAGES_KEPT kept
  loading: readonly number[];               // page indexes in flight
  version: string | number | null;          // revision / version of the last page (the change marker)
  unreachable: boolean;
  inventory?: Readonly<Record<string, number>>;
}
```

Pure functions (`lib/paged-list.ts`): `pagesForRange(first, last, pageSize, total)`; `rowAt(state, index)`; `acceptPage(state, index, rows, total, version)` (a page whose `version` differs from the state's means the set changed under it: **all pages are dropped**, this page kept, the visible pages re-read); `evict(state, centre)` (drops the pages farthest from the viewport above `MAX_PAGES_KEPT`; an evicted row shows a skeleton row and is re-read when it scrolls back); `patchRow(state, id, row)` (a write's answer replaces the row wherever it is loaded); `removeRow(state, id)` and `addedRow(state)` (the `total` moves by one, the pages are marked stale); `resetFor(state, nextQuery)` (a query change drops everything, status back to `loading`, scroll to the top via `resetKey = queryKey`).

- **`Refresh`** re-reads **the pages the viewport shows** and keeps the scroll position (`version` and `total` refreshed); it does not jump to the top. A **query change** is what resets to the top.
- **A stale mark** (`markStale("channels")`, for example after a playlist delete detaches channels) drops every page and re-reads the window the next time the tab is shown; if the tab is open it re-reads at once. This is the "stale marking re-reads" rule, applied to the window rather than only to the first page.
- **A write** patches the loaded row by id (`patchRow`) or, for a create or delete, adjusts `total` and re-reads the visible pages once (the position of a new row depends on the sort, so the slice does not guess it). Nothing is optimistic.
- **Memory:** at most `MAX_PAGES_KEPT = 30` pages (3,000 rows) per list; rows are the small admin shapes, so the heap stays flat however far the person scrolls.

### 4.4 Selection that outlives the rows: `lib/list-selection.ts` (pure)

Ticks are **ids**, not row objects, so they survive paging and eviction.

```ts
type ListSelection =
  | { mode: "ids"; ids: ReadonlySet<string> }                        // ticked rows
  | { mode: "all-matching"; queryKey: string; except: ReadonlySet<string> };   // every row of the current query but these
```

- **Row tick** adds or removes one id (in `all-matching` mode it edits `except`).
- **Header tick** = **all loaded rows** of the current query (every row in the kept pages; the tooltip says `Select the N rows loaded`). It never silently means "everything".
- **`Select all M matching`**: once the header tick is on and `M = total > loaded`, a ghost verb with that label appears in the list heading's action slot; pressing it switches to `all-matching` mode (the readout says `All 5,000 selected`, and `Clear selection` replaces it). A query change while in `all-matching` mode **returns to `ids` mode with nothing ticked** (the selection described rows of another query), unless the person keeps the ticks by selecting ids.
- **Shift-click** a tick selects the **range** from the last ticked row to the clicked row by index. Rows in unloaded pages are read first (the pages between are requested, at most 50 pages; the tick completes when they arrive), then every row in the range is ticked.
- **Readout:** the list heading shows `N selected` and, when different, `of M` (mono, faint); the count is `ids.size` or `total - except.size`.
- A row removed by a delete leaves the selection; a failed or skipped row of a bulk run stays selected (the existing rule).

### 4.5 Bulk actions over ticked rows that span pages (extends `39` section 6)

`hooks/useBulkSelection.ts` (T0) turns a `ListSelection` into the items the unchanged `planBulk` / `runBulk` / `useBulkAction` take:

1. `ids` mode: the rows of those ids that are loaded come from the pages; **ids that are not loaded are fetched** (the same route with `q`-less pages, or for a short id list one read per missing page); the plan needs full rows (a stream row cannot `Rebuild`; a manual title cannot `Revert`).
2. `all-matching` mode: the hook **pages the whole result** (`limit=200`, sequentially) into memory (a `Resolving` phase that sets `work.working` to the number of rows still to resolve, so the statusbar reads `N working`), drops `except`, and hands the full rows on. 5,000 channels are 25 reads; 27,000 titles are 135.
3. The plan, the armed two-step (`Delete 5,000 channels?`, the count in the question), the sequential run, the per-row failure list, the one re-read at the end and the kept ticks are **exactly the shared piece's**; the summary counts (`Deleted 4,998 of 5,000 channels; 2 failed.`) come from the run, not the page.
4. At the end the slice drops its pages and re-reads the visible window once (the `total` has changed), and the selection keeps only the failed and skipped ids (`ids` mode).
5. No bulk endpoint is added: each delete is the existing `DELETE` (audited, revision bumped). The acceptance measures the time per call; if the p95 is over **20 ms** at the real size, a follow-up adds an additive `POST /api/channels/bulk` (`{ ids, op }`); it is not built now.

## 5. Per-list wiring (workers T1 to T3)

### 5.1 Channels (worker T1)

`services/channels.ts` gains `page(query, pageIndex)` over the new parameters (the old `list()` stays for the Preview window's single read and the tests). `ChannelsState` gains `paged: PagedState<AdminChannel>` (replacing `items` for the list; `items` is kept as a derived read of the loaded pages for the code that finds a channel by id: a workspace opens from the row the person clicked and the slice keeps that row in an `opened` record, which every write's answer replaces, so a workspace never depends on its page staying loaded). `ChannelsList` shows the search field, filters and sort; `ChannelRows` renders `WindowedRecordGrid`. The statusbar `N preparing` counts **live rows only**, which are few: `state=live` rows are read once (`state` not `live`: `kind=live`, `limit=200`) and counted, independent of the window. `Preview →` needs exactly one ticked row: it takes the one id from the selection (one id in `ids` mode; in `all-matching` mode it is disabled with `Select one channel.`).

### 5.2 Titles (worker T2): `Stored | Browse TMDB`

The Titles list heading gains a `Segmented` (`Stored`, `Browse TMDB`), **`Stored` the default** and the page's main list. `TitlesState` gains `mode` and `stored: PagedState<AdminTitleRow>`; the existing browse state (`page`, `totalPages`, `search`, `kinds`, `sort`, `Older` / `Newer`) is kept untouched and shown only in `Browse TMDB`.

- **Stored:** `WindowedRecordGrid` over `GET /api/titles/stored`; heading controls: the search field (Enter or its button), Kind chips (`Movies`, `Series`; at least one), Origin pills (`All`, `Synced`, `Hand-made`), `Edited` and `Disabled` toggle chips, a heading readout `10,921 stored` (from `inventory`), `Refresh`, and `Sync now` (5.3). Columns: `title`, `kind`, `year`, `rating`, `state`, `stored` (when it was fetched); sortable: title, year, rating, stored.
- **Browse TMDB:** as `37` section 4.2 today, labelled by the segment. Its purpose is **finding titles TMDB has that the store lacks**: reading a browse or search page stores what it reads (`storeListItems`, existing behaviour), so browsing is how the store grows; switching back to `Stored` shows the new rows (sorted by `stored`, newest first, they are on top).
- **Delete means the same in both modes** (the backend's soft delete, `03` 7.4, migration `020`): a **synced** title's `DELETE` removes the stored copy and records its identity in `deleted_titles`, so browse, search, detail and the catalog sync skip it until it is restored; a **hand-made** title is deleted for real. In `Stored` mode the row leaves the list at once (the `total` and `inventory` fall by one, the window re-reads); in `Browse TMDB` mode the next read of that page lacks the title (its `skipped` count rises). The single-row `Delete`, the bulk `Delete` (manual and synced alike) and the summary text are unchanged from `37`.
- **`Deleted titles`** stays one group below the list, **in both modes**; `Restore` (row and bulk) drops the record, and the title **returns on the next browse or sync** (it is not in the stored list until then: restoring does not recreate the stored copy, and the notice already says so). It is windowed client-side above 100 rows (section 2).
- **Soft-delete's effect on `Stored`:** only the stored copy is removed. The title's TMDB identity moves to `Deleted titles`; it reappears in `Stored` only after a restore followed by a browse or sync.

### 5.3 Filling the store: the sync schedule and `Sync now` (T2, with the Jobs tab unchanged)

On the owner's backend `TMDB_SYNC_SCHEDULE` is **unset**, so nothing fills the store automatically; the 10,921 stored rows came from browsing. A trending or popular catalog job pulls `pages` (1 to 25) of one TMDB list per run: at most 500 titles, and it cannot reach the long tail of 27,000. The fill is the **discover** catalog job (owner, 2026-10-17, closes decision 2): one walk of `/discover/movie` then `/discover/tv` by popularity, up to 500 pages per kind (03 §7.6b).
- **How growth is made routine:** the supported way is a job record, not the environment: on the Jobs tab set each catalog job `Enabled` with an interval (`24h`) and its `pages` (25). The plan records this as the owner's setup step and the coordinator's checklist item; no code is needed.
- **`Sync now` exists in the Titles list heading** (a ghost verb, `Stored` mode): it runs **every enabled catalog job** through the shared bulk runner (`jobs.run`, sequential, one failure never stops the rest, summary on the notice, `N syncing` in the statusbar). Disabled with `TMDB is not configured on the backend.` when `health.tmdb` is `absent`, with `No catalog job is enabled. Enable one on the Jobs tab.` when none is enabled, and with `A sync is already running.` while one is `running`. It uses the Jobs service the Jobs tab already has (no new route).
- **How the list reflects growth:** a catalog job's end is not pushed (no polling), so the heading readout and the first page are re-read by `Refresh`, and automatically once after `Sync now`'s own run answers. The readout `10,921 stored` and the `stored` column (newest first) show the change; the `inventory` movie / series split is the tooltip of the readout.

### 5.4 Deleted titles, Playlist Status channels, Channel Status playlist (worker T3)

`DeletedTitlesGroup` uses the plain grid up to 100 rows and the windowed grid above (client-held rows, `rowAt` over the in-memory list, no paging). The Playlist Status channel links read `GET /api/admin-channels?source=<host>&limit=100` and window above 100 rows (the first page fills the group; further pages load as it scrolls). The live channel's Status playlist (`PlaylistRows`) windows above 100 entries (read-only, in memory).

## 6. Search, filter and sort

- **Server-side for Channels and Stored titles** (the full set is not in memory, so a browser filter would be wrong). **Search runs as you type** (owner, 2026-10-18; this replaces the earlier "Enter only" rule): the field's text is **debounced by 200 ms** (a one-shot timer owned by a hook, cleared on every keystroke and on unmount; it is not polling, `01` 4.3 clarified) and then re-queries - the previous in-flight request is aborted (`AbortController`), a result for an older `queryKey` is dropped, and the list resets to the top; Enter fires the query at once; IME composition fires on `compositionend`. A small clear (x) inside the field empties it and queries at once. Each filter is a pill or a chip that applies at once and resets the list to the top. The query is serialised to a stable `queryKey`; a result arriving for an older `queryKey` is dropped (the `serial` rule of `35`).
- **Channels:** search (`q`), `Kind` pills (`All`, `Live`, `Stream`), `Origin` pills for stream rows (`All`, `Synced`, `Edited`, `Hand-made`), `State` pills (`All`, `Enabled`, `Disabled`), and a live `State` Select that appears only for `Kind: Live`. Opened from a playlist's channel link, the list arrives with `source=<host>` shown as a removable chip (`From <host>`).
- **Stored titles:** search, Kind chips, Origin pills, `Edited`, `Disabled`.
- **Sort:** the header cell of a sortable column is a button; the first press sorts ascending, the second descending (`nextSort`); one sort at a time; the default is stable (Channels by number, Stored by title). Server-side, since the order must hold across unloaded pages. Channels: `number`, `name`, `category`, `kind`, `source`. Stored titles: `title`, `year`, `rating`, `stored`. Small lists are not sortable (no header buttons).
- The Browse TMDB mode keeps TMDB's own search, Kind chips and Sort pills.

## 7. Workers, ownership and the progress table

| Wave | What | Worker | Depends on | Status |
|---|---|---|---|---|
| **B4** | backend: `GET /api/admin-channels` paging and filters; `GET /api/titles/stored`; `PUBLIC_READ` exclusion; tests (section 3) | B4 (backend) | nothing | Not started |
| **T0** | shared: the moved maths and pager rules (with frontend shims), `useWindowedList`, `WindowedRecordGrid`, `RecordGridSkeletonRow`, sort header, constants; admin: `lib/paged-list.ts`, `lib/list-selection.ts`, `store/slices/paged.ts`, `hooks/usePagedList.ts`, `hooks/useBulkSelection.ts`; tests (section 9) | T0 | nothing (runs beside B4) | Not started |
| **T1** | Channels adopts it (5.1) | A | B4, T0 | Not started |
| **T2** | Titles `Stored | Browse TMDB`, `Sync now`, delete semantics in both modes (5.2, 5.3) | A | B4, T0 | Not started |
| **T3** | Deleted titles, Playlist Status channels, Channel Status playlist (5.4) | A | T0 (and T1 for the `source` filter) | Not started |

Order: B4 and T0 in parallel; then T1 and T2 in parallel (their files do not overlap); then T3. Landing order B4, T0, T1, T2, T3; the gate (`node scripts/check/gate.mjs`) after each merge. Each wave is cut from the same `family-port` commit after the one before it lands, as `39` section 5.

**File ownership (so parallel workers cannot collide).**

| Worker | Owns |
|---|---|
| B4 | `src/backend/src/api/admin-channels.ts`, `api/titles.ts` (the one new route), `network-policy.ts` (one line), `services/channel-service.ts` (`listAdmin`), `services/title-stored-service.ts`, `services/service-registry.ts`, `store/channel-repository.ts` (`page`), `store/title-repository.ts` (`page`, `inventory`), `types/channel-query.ts`, `types/title-stored.ts`, `constants/limits.ts` (the page limits), tests |
| T0 | `src/shared/ui/src/lib/{window-rows,window-types,pager-rules,window-constants}.ts`, `hooks/useWindowedList.ts`, `lists/{WindowedRecordGrid,RecordGridSkeletonRow}.tsx`, `lists/record-grid-sort.ts`, `lists/RecordGrid.tsx` (additive: sortable heading cells), their tests in `src/shared/ui/test`; `src/frontend/src/lib/window-rows.ts`, `lib/library-pager.ts`, `types/window-rows.ts` (shims only); admin `lib/paged-list.ts`, `lib/list-selection.ts`, `store/slices/paged.ts`, `hooks/usePagedList.ts`, `hooks/useBulkSelection.ts`, `components/records/ListSearch.tsx`, `ListFilters.tsx`, `SelectionReadout.tsx` |
| T1 | `services/channels.ts`, `services/channel-flows.ts`, `store/channels-slice.ts`, `components/channels/{ChannelsList,ChannelRows,ChannelRow,ChannelsIndex,ChannelsToolbar}.tsx`, `lib/channel-list.ts`, `lib/channel-query.ts`, `hooks/useChannelsLoad.ts`, `useChannelBulk.ts`, `constants/channel-grid.ts`, `channel-copy.ts`, tests |
| T2 | `services/titles.ts`, `services/title-flows.ts`, `store/titles-slice.ts`, `components/titles/*` (not `DeletedTitlesGroup.tsx`), `lib/title-query.ts`, `lib/title-rows.ts`, `hooks/useTitlesLoad.ts`, `useTitleBulk.ts`, `constants/title-copy.ts`, `title-grid.ts`, tests |
| T3 | `components/titles/DeletedTitlesGroup.tsx`, `hooks/useDeletedTitles.ts`, `components/playlists/PlaylistStatusGroup.tsx`, `hooks/usePlaylistChannels.ts`, `components/channels/PlaylistRows.tsx` |

Shared files nobody else touches: `store/app-store.ts` (the registry means no edit), `store/slices/index.ts`, `lib/bulk-plan.ts`, `lib/bulk-run.ts`, `hooks/useBulkAction.ts` (frozen after `39` 3a; `useBulkSelection` feeds them), `services/session-api.ts`, `constants/api-sentences.ts`. A new error sentence is added by the coordinator at merge.

## 8. Tests (`node:test`, fast, written AND run by the worker; no server, no browser)

| Piece | Cases |
|---|---|
| T0 `window-rows` (shared) | the interface's cases, moved; single-column: `visibleRows` for a 5,000-row list at the top, middle and end; a stale offset past the end still shows the last rows; `nonEmptyRange` never empty; `windowSegments` with a pinned row; `gridStep` with one column (`Up`, `Down`, `Home`, `End`, `PageUp`, `PageDown`); the frontend shims re-export the same functions |
| T0 `pager-rules` | zero-height scroller requests nothing; the in-flight guard and a declined request releasing it; `mayChain` bound |
| T0 `useWindowedList` (string-render + pure core) | the mounted row count is flat (rows in view + 2 overscan each side + pinned) for 100, 5,000 and 27,000 rows; a zero size changes nothing and a later size restores the offset; `resetKey` change returns to the top; the scroller is read from state (a one-commit mount of scroller and list binds the listener) |
| T0 `WindowedRecordGrid` markup | at or under 100 rows it renders the plain grid; above, the sticky header, the spacer height `total * 36`, skeleton rows for unloaded pages, `aria-rowcount`, `aria-rowindex`, `aria-sort`, the selection column, the state word and dimmed row unchanged |
| T0 `paged-list` | `pagesForRange`; a page with a different `version` drops all pages; eviction keeps the nearest `MAX_PAGES_KEPT`; `patchRow` / `removeRow` / `addedRow`; `resetFor` on a query change; an answer for an old `queryKey` is dropped |
| T0 `list-selection` | row tick; header tick = loaded rows; `all-matching` with `except`; the counts; a query change returns to `ids` mode empty; shift-click range across unloaded pages requests the pages between and ticks all |
| T0 `useBulkSelection` core | `ids` mode fetches missing rows; `all-matching` pages the whole result at `limit=200` in order, drops `except`, sets `working`; the shared plan and runner see full rows; failed and skipped ids stay selected; a changed `serial` stops resolving |
| T1 / T2 | the query builders (`channel-query`, `title-query`) produce the contract of section 3 exactly; a filter change resets; Channels: `Preview →` with one id and with `all-matching`; Titles: the mode switch keeps each mode's state, `Sync now` reasons in priority order, `inventory` readout, delete in each mode updates `total`; the services parse a page row by row (an unreadable row dropped and counted) |
| T3 | Deleted titles plain at 100 and windowed at 101; the `source` read |

Plus `typecheck`, `lint` and `node scripts/check-rules.mjs` for each worker (files at most 200 lines, tests 250).

## 9. Failure modes

- **A hidden tab** has no height: no page is requested and the offset is restored when shown (`pagerCanRequest`, the `32` rule). A hidden list that chained pages forever was the original bug.
- **The scroller not yet attached** on a one-commit mount: the hook follows the live element in state and rebinds (the `32` fix); a blank window is never possible for a non-empty list (`nonEmptyRange`).
- **The set changes between page reads** (a sync inserts rows, someone deletes): the answer's `version` / `revision` differs, so the slice drops all pages and re-reads the window; a row may briefly show a skeleton, never a duplicate or a hole that persists.
- **An old answer after a query change or sign-out** is dropped by `queryKey` and `serial`.
- **A very large `all-matching` run** takes time (sequential deletes): the statusbar shows `N working` and the notice a running count; the armed question names the count; the run stops at once if the session ends. Memory holds only the resolved small rows.
- **Offset drift on a live list** (the live channel set changes): bounded by the version rule above; a page boundary can repeat or skip a row only between a change and the next read, which the re-read removes.
- **Search on 27,000 stored titles** reads JSON per row; measured in acceptance, with the generated-column follow-up named in 3.2.
- **Backend unreachable** while paging: the pages loaded stay, the failed page shows skeleton rows, writes are disabled with the unreachable sentence until a read succeeds (the existing rule).
- **Sorting / filtering a list while a bulk run is in flight**: the controls are disabled with `Working.` until it ends.

## 10. The coordinator's acceptance (a temporary backend; the owner's data is never touched)

A fresh backend per `39` section 9 (`DATA_DIR` under `%TEMP%`, a throwaway `JWT_SECRET`, the test bootstrap owner, a free port, `ADMIN_DIST` the built admin, no `--env-file`).

1. **Seed.** Channels: a throwaway local playlist server (outside the repository) serving a synthetic M3U of **5,000 entries** with `ALLOW_LOOPBACK_STREAMS`, run through a playlist job; the backend then holds 5,000 synced stream rows plus a few live ones. Titles: a harness script outside the repository writes **12,000 rows** (mixed movie / tv, tmdb / manual, some edited, some disabled) into the temporary database while the backend is stopped; the backend is restarted. Nothing is written to the owner's data.
2. **Backend over HTTP.** `admin-channels?limit=100&offset=0` returns 100 rows and `total` 5,003; walking every page covers each id once; `q`, `kind`, `origin`, `enabled`, `source`, numeric sort and `dir` behave; the unpaged call still returns the whole list. `titles/stored` returns 100 rows, `total` 12,000, `inventory`; `q`, filters and sorts; **no TMDB request** is made (the TMDB base points at nothing); a request without a token is `401`; the answer is `no-store`. Search over 12,000 rows is under 100 ms.
3. **Chrome at 1600 x 1000 and 900 x 640, dark and light.** Channels: the list has its own scroller with a sticky header; **the DOM row count stays flat** (`document.querySelectorAll` of the grid's `li` is at most 30 at 1600 x 1000, at most 20 at 900 x 640) while scrolling top to bottom, by wheel, keyboard and a scrollbar drag to 50% (skeleton rows, then data); `performance.memory.usedJSHeapSize` after scrolling the whole list is within a small margin of its value at the top (flat, not growing); the horizontal scroll at 900 is inside the list only; the page itself never scrolls horizontally.
4. **Selection and bulk.** Tick 30 rows on page 1, scroll to row 3,000 and tick 30 more: the readout says `60 selected`; the header tick means the rows loaded; `Select all 5,003 matching` appears and switches to all-matching; shift-click ticks a range across unloaded pages; `Delete` over a ticked range of 300: the armed question says `Delete 300 channels?`, the run shows `N working`, the summary counts match, the list re-reads once, the `total` falls by 300, failed rows (force one) stay ticked; the time per delete is recorded. `Rebuild` over live rows only.
5. **Query, sort, filters.** A search resets to the top and shows `total` for the query; each filter pill; a header sort toggles asc / desc and holds across a scrollbar drag; clearing everything returns to the default order; revisiting the tab keeps the offset; switching tab and back does not re-request while nothing changed.
6. **Titles.** `Stored` is the default and lists all 12,000 with the `12,000 stored` readout; the mode switch to `Browse TMDB` keeps the old controls (against the backend's TMDB stub); Delete of a synced and a manual title in each mode; `Deleted titles` shows the synced one; `Restore`; `Sync now` reasons (no job enabled, then enable a catalog job and run it against the TMDB stub: the readout grows after the run's own re-read and `Refresh`).
7. **Small lists unchanged.** Providers, Playlists, Jobs, Accounts, the Events drawer and a 100-row Deleted titles list render as before (no inner scroller).
8. **Wire and storage.** Every `/api` request but login / refresh / reset carries `Authorization`; no storage writes; the console is clean; no timer or poll is added (the source scan test of `39` section 8 stays green). Records created are removed; the temporary backend is stopped by PID and its folder deleted; the owner's data is confirmed untouched. On the owner's real stack, only the Titles `Stored` list is looked at read-only (it lists the real 10,921 rows; nothing is changed).

## 11. Open decisions for the owner

| # | Decision | Default taken |
|---|---|---|
| 1 | `Stored` is the default Titles mode, `Browse TMDB` a segment beside it | as stated |
| 2 | A catalog job reaches at most 500 titles per run (25 pages of trending or popular). Filling the store toward 27,000 needs a wider scope (a `discover` scope walking up to 500 pages per kind) | **decided owner 2026-10-17**: built as the discover scope of the catalog job (03 §7.6b), one job for both kinds; the four per-slice jobs retired |
| 3 | The header tick selects the rows loaded; `Select all M matching` is a separate, visible step | as stated (no silent "everything") |
| 4 | Bulk deletes stay N sequential single calls; a bulk endpoint is added only if the measured time per call is over 20 ms | as stated |
| 5 | The public `GET /api/channels` (the interface's Live surface) and the fileserver's reads are not paged here | out of scope; a separate plan if the Live surface needs it |

## 12. Doc against code: differences found (2026-10-17)

| # | Doc says | Code does |
|---|---|---|
| 1 | `29` 9.3: the Titles list is "the admin's list of titles" (`GET /api/titles`) | it is a TMDB browse (20 per kind per page, 500 pages), never the stored rows; 5,532 + 5,389 stored titles are unreachable from the admin (B7 of `29` was left optional) |
| 2 | `29` 8: "Only Titles pages" | Channels will need paging too: `listAdmin` returns every row, `ChannelRows` draws them all |
| 3 | `28` 4.3 / `RecordGrid`: "a list's own horizontal scroller" | a sticky header cannot work through an `overflow-x: auto` ancestor that does not scroll vertically; the windowed grid is one scroller for both axes (4.2) |
| 4 | `32` 2.5: the pager is an end-of-list sentinel | index-addressed paging (scrollbar jumps) cannot use a sentinel; loading is driven by the visible range, keeping the same hidden-surface and in-flight rules |
| 5 | `network-policy.ts` `PUBLIC_READ` lists `titles` except `sync` and `deleted` | `stored` must be excluded too, or the new route is classed a public cacheable read |
| 6 | `37` 4.2 / `36` 5.2: "`SkeletonGrid` while idle or loading" | for a paged list the skeleton is per row of an unloaded page, in place; `SkeletonGrid` stays the first-read fallback |
| 7 | `39` 6: the bulk piece's plan takes the ticked rows as they are loaded | for a long list the rows may not be loaded; `useBulkSelection` resolves them first (4.5) |
| 8 | `37` / `29`: catalog sync "fills the catalogue" | a run reaches at most 500 titles; on the owner's backend `TMDB_SYNC_SCHEDULE` is unset, so the four seeded jobs are off |
