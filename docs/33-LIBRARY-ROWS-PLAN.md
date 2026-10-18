# 33 - Library Rows plan

**Status: plan v2, written before the code (branch `fix/rows-paging`, from `family-port`).** Version 1 (branch
`fix/rows-grouping`) stopped the shelves from popping in and moving; it is kept in section 1 because its settled-reveal
rules carry over. Version 2 replaces its 120-item sample and its 10-card cap: each shelf is its own paged query.

## 1. History

### 1.1 Version 1 (`fix/rows-grouping`)

Owner: "when I change the view to rows, the posters pop in and out and shift around until they settle. They should be
grouped while showing the skeletons and then display settled." Measured: Grid to Rows mounted about 1,052 poster cards
in one commit, then the shelves kept regrouping as every page landed. Version 1 grouped the first `ROWS_READ_ITEMS` =
120 items of the current query once, behind the skeleton, capped each shelf at `ROWS_SHELF_CARDS` = 10 mounted cards,
dropped the pager from Rows, and kept the shelves until a real invalidation. What it got right, and version 2 keeps:

- the whole Rows view shows the shelf skeleton until it is ready, then reveals once;
- no shelf reorders and no card moves between shelves after it appears;
- a filter, sort or search change, Refresh, or an invalidating write (favourite, watch, Remove from history) sends Rows
  back through the skeleton;
- returning to the Library keeps the shelves (no reload, no skeleton);
- posters load on the shimmer tile in a reserved 2:3 frame and fade in.

### 1.2 Why version 2 (owner report, 2026-10-17)

"The gallery rows aren't loading more after the first load, they aren't loading any more posters and some of the rows
aren't filled. The more button is not enabled." Measured on the owner's app:

1. Rows grouped only the first 120 items of the query, so a genre shelf held only what that sample happened to carry:
   Sci-Fi & Fantasy 4 cards, Mystery 3, while the server has hundreds of each.
2. Each shelf mounted at most 10 cards and never asked for more; See all was the only way past them.
3. A shelf's `Scroll right` chevron was disabled with `The row is already at its end.` as soon as its few cards fit,
   although the server had more.

The cause is the design itself: shelves cut from one shared sample cannot be filled, and a capped shelf cannot page.

## 2. Design (version 2)

### 2.1 The shelf list is decided up front (pure, `lib/rows-shelves.ts`)

The list is decided once per invalidation key, from the current query, the main query's first page (its genre facets),
the collections and the Continue watching setting, never by grouping items. In order:

1. **Continue watching**: when the setting is on, not in History, and the Watched filter is All or Watching.
2. **Favorites** and 3. **each collection, alphabetical**: only when the rail's view is All (the server cannot intersect
   two views, and inside Favorites or a collection the view itself is already the narrowing).
4. **Movies, TV, Local files**: each kind the type strip allows (All: three; one kind: that one).
5. **Genres**: the first `GENRE_SHELVES_MAX` = 6 of the server's genre facets for the query, in the facets' own order;
   when the Genre filter has values, the first six of those instead (a genre shelf inside a genre filter is that genre).
   The facets carry no counts, so "top" is the server's order.

A shelf whose first page answers empty is dropped behind the skeleton, before the reveal; no shelf disappears once
shown. A shelf whose first page fails is dropped the same way and its sentence is said once.

### 2.2 Each shelf is its own query

Through the one request layer (`services/library.ts`, `readLibrary`), each shelf reads `GET /api/library` with the
current Library query (search, genres, year, watched, sort, rail view, type strip) plus its own narrowing:

| Shelf | Narrowing |
|---|---|
| Continue watching | `watched=watching` (history-backed in All, `03` section 3.5: one row per item, the most recently watched first under Newest) |
| Favorites | `view=favorites` |
| A collection | `view=collection&collectionId=<id>` |
| Movies / TV / Local files | `type=movie` / `type=tv` / `type=local` |
| A genre | `genre=<name>` (one value) |

A shelf holds its loaded items, the server's `total` and its `nextCursor`. `services/rows-reader.ts` owns the reads of
one plan: every first page in parallel, one next page per shelf at a time, an abort for the whole plan on invalidation,
and a generation check so a late answer never lands in a newer plan. Pages only append (deduplicated by row identity),
so a shown card never moves.

### 2.3 Reveal

Rows shows `RowsSkeleton` until: the main query's first page is fresh for this key, the side data (collections) has
answered, the title regions are available (or the type strip is Local), and **every planned shelf's first page has
answered**. The shown shelf ids are then fixed for the key (the non-empty ones, in plan order) and only grow in cards.

### 2.4 Paging a shelf (horizontal look-ahead)

Each shelf row is its own horizontal scroller with a zero-width sentinel after its last card. An `IntersectionObserver`
rooted at that row, with a horizontal margin of `ROWS_LOOK_AHEAD` px, asks the reader for the shelf's next page when the
sentinel comes near; the same rules as `lib/library-pager.ts`: never while the row has no width (hidden surface,
collapsed pane), at most `MAX_UNSCROLLED_PAGES` chained without the user scrolling that row, one request at a time, no
timers. On creation the position is checked once by hand (an observer reports changes only). While a page loads, the
shelf's tail draws `ROWS_TAIL_SKELETONS` card skeletons. A failed next page says its sentence and ends that shelf at
its loaded cards until the next invalidation (no retry loop).

### 2.5 Bounded mounting (horizontal windowing, `lib/shelf-window.ts`)

A shelf row is a flex track: the cards keep version 1's widths (six poster columns fill the rail, never under 144 px;
two and a half Continue cards), and only the cards the row's viewport touches, plus `ROWS_WINDOW_BUFFER` cards each side,
are mounted. Blank spacers whose CSS widths are exact multiples of the card pitch stand for the rest, so the row scrolls
as if every card were there (as `docs/32`'s grid does vertically). The focused card stays mounted. Before the row is
measured it mounts its first `ROWS_FIRST_WINDOW` cards. Worst case is about 14 cards per shelf whatever its length.

### 2.6 The chevrons

`Scroll right` is enabled while there is more to see: cards beyond the visible part of the row (mounted or not) or a
next page the server says exists. A press scrolls one row width and, when that brings the end within a row width and a
next page exists, asks for it at once. It is disabled only at the true end (`The row is already at its end.`).
`Scroll left` is disabled only at the start.

### 2.7 Keyboard, selection, memory

Left and Right move across a shelf's loaded cards by index (a card not mounted is mounted, focused and scrolled into
view), Home and End go to its first and last loaded card, Up and Down go to the nearest card horizontally in the shelf
above or below. Selection, See all, Remove from history and the card menus are unchanged. Each shelf's horizontal
scroll position is remembered by shelf id for the key, so returning to the Library tab, or switching Grid and back to
Rows, puts every row back where it was; a hidden row (zero width) never records a position.

## 3. Failure modes

- A shelf's first page fails: the shelf is dropped before the reveal; the sentence is said once per plan.
- A next page fails: the sentence; the shelf ends at its cards until Refresh or another invalidation.
- The main page or the side data fails: the skeleton stays (as version 1); Refresh retries.
- Titles unavailable: skeleton, then a new plan once they answer.
- Everything empty: zero shelves; `RowsSkeleton` stays (skeleton for empty, `AGENTS.md`).
- Hidden surface: the observers do nothing at zero width; no plan is started while Rows is not the shown view.
- An invalidation while pages are in flight: the plan's reads are aborted and a late answer is ignored.

## 4. Tests (node:test)

`rows-plan.test.ts`: the shelf list from facets, collections and settings; the per-shelf query. `shelf-window.test.ts`:
the range and spacer maths, the segments with a pinned card, the horizontal look-ahead and the pager decision (zero size
never requests; bounded chain). `rows-navigation.test.ts`: the arrow rule (cards beyond the view or another page:
enabled; true end: disabled with its reason), in-row steps. `rows-reader.test.ts`: reveal only after every first page,
empty shelves dropped, next pages append without reordering, a stale plan's answer ignored. `rows-markup.test.ts`: a
shelf track with spacers and tail skeletons, and the skeleton view.

## 5. Coordinator's real-stack checklist

1. Switch to Rows: skeleton first, then every shelf at once, each filled (a genre shelf holds a full page, not 3 or 4).
2. Scroll a shelf right (wheel, drag or `Scroll right`): near its end, card skeletons at its tail, then more posters.
   Keep going: pages keep coming until the server's end; then `Scroll right` is disabled with its reason.
3. `Scroll right` is enabled on every shelf that has more on the server, even when its first cards fit.
4. Mounted cards stay bounded: `document.querySelectorAll('[data-card]').length` is about 14 per shelf, however far a
   shelf is scrolled.
5. No shelf appears, disappears or reorders, and no card moves, after the reveal for the same query.
6. Change a filter, the search, the sort, press Refresh, favourite a title, remove a Continue entry: back through the
   skeleton, then new shelves.
7. Switch to Live and back, and Grid and back: the shelves and their horizontal positions are kept.
8. Arrow keys across and between shelves, Home and End, selection, See all, Remove from history, back-to-top work.
9. Network: one `GET /api/library` per shelf on reveal, then one per page as a shelf is scrolled; nothing while hidden.
