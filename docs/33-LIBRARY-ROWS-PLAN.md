# 33 - Library Rows plan

**Status: plan, written before the code (branch `fix/rows-grouping`, from `family-port`).** Owner: "when I change the
view to rows, the posters pop in and out and shift around until they settle. They should be grouped while showing the
skeletons and then display settled." Measured on the real app: Grid to Rows mounts about 1,052 poster cards in one
synchronous commit (a stall of about a second), then shelves keep changing.

## 1. What exists today (verified in source)

- `LibraryPage` passes `shown` (the loaded pages of the current query, resolved with marks) and `continuing` to
  `LibraryRows`, which calls `buildShelves` in a `useMemo` over them, so **every change of `items` regroups live**.
- `genreShelves` ranks genres by count over the items it is given, assigns each title to one shelf, and sorts shelves
  by count. Adding a page changes counts, so genre shelves appear, disappear, reorder, and titles move between them.
- Rows still draws the end-of-list pager (`rowsRenderState.showPager = hasMore || paging`), so while the rows have room
  it chains pages (up to `MAX_UNSCROLLED_PAGES` = 8, and the grid's loaded pages are reused, so a deep grid read means
  a thousand-card Rows). Each page re-runs the grouping above.
- `ShelfRow` mounts every item of a shelf; a shelf of 400 titles is 400 cards. Posters are `loading="lazy"` on the
  shimmer tile with a 2:3 frame (`PosterImage`), so the images fade in without moving anything; the movement is all
  regrouping.
- `continuing` and the collections arrive from `readSideData` after the first page, so the Continue and collection
  shelves also pop in after the rest.

## 2. Causes

1. The grouping reads an unbounded, growing set (the whole loaded list), and regroups on every append.
2. The pager chains pages under shelves that are horizontal rows (the pager makes no sense for them).
3. Side data (Continue, collections) lands after the first paint of the shelves.
4. Every shelf item is mounted.

## 3. Design

### 3.1 The settled data set

Rows groups the **first `ROWS_READ_ITEMS` = 120 items of the current query** (`page.items.slice(0, 120)`, the
query's Newest/own sort order, which is stable because pages only ever append). Justification: a page is 20 titles per
kind (`LIBRARY_PAGE_SIZE`), so All = 40 per page: 3 pages; a single kind = 20 per page: 6 pages. A genre shelf needs
`GENRE_MIN_ITEMS` = 3 titles after earlier shelves took theirs and at most `GENRE_SHELVES_MAX` = 6 are drawn, so
120 titles is far over the 3 x 6 = 18 minimum and gives the shelves a real spread, while staying a handful of reads.
The grouping never reads beyond it, so a deep grid read (hundreds of items) does not change the shelves.

Rows **reuses the loaded pages** instead of owning a second read: the grid, the list and Rows share one
`useLibraryData` read, so the persisted-state and revisit rules (`library-reload`: returning to the Library keeps the
list) are untouched. A view switch to Rows with fewer than 120 items loaded asks for pages (one at a time, through the
hook's own `loadMore`, in an effect on the page changes; no timer and no pager) until 120 are held or the cursor is
exhausted.

### 3.2 Settled state (pure, `lib/rows-settle.ts`)

`rowsReady` is true when: the first page is not loading, the side data (Continue, collections) has answered, the
title regions are not still loading, and the page holds `ROWS_READ_ITEMS` items or has no next cursor. Until then Rows
draws `RowsSkeleton` only. `nextRowsSnapshot(previous, input)` returns the snapshot of finished shelves:

- not ready or `loading` -> `null` (skeleton);
- ready and no snapshot -> build the shelves once from the bounded set;
- snapshot exists and its **invalidation key** is unchanged -> the same snapshot object (nothing regroups);
- key changed -> `null` first (skeleton), then a rebuild when ready again. A visible shelf never morphs.

Invalidation key: query key (source, scope, search, sort, genres, year, watched), `libraryRefreshSerial` (Refresh,
favourite and watch writes, scans), `showContinue`, the collections signature (ids and names) and the removed-history
count (Remove from history). A background side refresh (showing the Library again) does not change the key, and a
Refresh button press sets `loading`, which also drops the snapshot. Later pages, side data and marks changes do not
touch a settled snapshot (the shelves are built from the snapshot's items with the marks of the moment it settled; a
favourite toggle still updates its card in place, and its shelf membership catches up at the serial bump the write
makes, through the skeleton).

### 3.3 Bounded mounting and geometry

Each shelf mounts at most `ROWS_SHELF_CARDS` = 10 cards (`shelfCards`): six fill the rail, four scroll with the
chevrons. The heading count and See all still describe the whole shelf; See all opens the grid for the rest. Worst case
is 3 type shelves + Favorites + Continue (10) + 6 genre shelves + collections, about 100 cards, typical 60, instead of
1,000. Cards already reserve a 2:3 frame (`PosterImage`, `ContinueCard`) and the shelf columns are fixed shares, so
nothing shifts as images load.

### 3.4 No pager

The Rows view no longer renders `LibraryPager` and `rowsRenderState` loses `showPager`. Rows' only page requests are
the bounded fill of 3.1.

## 4. Failure modes

- A page read fails: `loading`/`paging` clear, the hook says the sentence; the snapshot becomes ready with what is held
  (a short set groups as shelves) once no further page is pending, instead of a skeleton forever. The fill effect asks
  at most once per page change.
- Titles unavailable (`titleRegionsLoading`): skeleton (as the grid shows its tail), shelves once they answer.
- Empty result: a settled empty snapshot is zero shelves; `RowsSkeleton` stays (skeleton for empty, per AGENTS.md).
- Hidden surface: the fill effect does nothing while `active` is false (no paging out of sight).

## 5. Tests (node:test)

`test/rows-settle.test.ts`: builder stable and deterministic over a fixed set (same input twice, input order of later
pages irrelevant beyond the bound); rows state (skeleton until ready, shelves, the same object on later pages, null on
key change, null on loading); per-shelf cap; `renderToStaticMarkup` of the skeleton state and of a settled shelf.

## 6. Coordinator's real-stack checklist

1. Switch Grid to Rows and back repeatedly with the window on top: skeleton first, then settled shelves.
2. No card moves, appears or vanishes after first appearance for the same query; images fade in on their frames.
3. Mounted card count is a few dozen to about a hundred (`document.querySelectorAll('[data-card]').length`), not 1,000.
4. No long task on the switch (Performance panel).
5. Change a filter, the search, the sort or press Refresh: back through the skeleton, then new settled shelves.
6. Favourite a title, remove a Continue entry: shelves rebuild through the skeleton.
7. Arrow keys, Home/End, selection, Continue progress, See all, Remove from history, back-to-top still work.
8. Returning to the Library keeps the shelves (no reload, no skeleton).
