# 32 - Library windowing plan

**Status: plan, written before the code (branch `feat/library-windowing`, from `family-port`).** The Library loads
by paging and loads images lazily, but every loaded card stays in the DOM. Measured on the owner's real app after deep
scrolling (27,000 titles in the library): 834 to 1,077 cards, 63,677 DOM nodes, renderer 4.6 to 7 GB, 8 fps. The goal:
DOM size, page size and renderer memory stay bounded by the window's area, never by scroll depth.

## 1. What exists today (verified in source)

- `LibraryBody` owns one scroller (`overflow-y-auto`, `useScrollTopWhileLoading`). Inside it, in order: the Continue
  strip, `PosterGrid` or `PosterList`, the loading tail (`PosterGridSkeleton tail` / `SkeletonRows`), then
  `LibraryPager`, whose `div` is the sentinel (`useLibraryPager`: an `IntersectionObserver` rooted at the nearest
  scroller, 240px look-ahead, plus one manual position check per observer creation).
- `PosterGrid` is a CSS grid, `repeat(auto-fill, minmax(144px, 1fr))`, gap 12, padding 12; it maps **every** item
  to a `PosterCard`. `PosterList` maps every item to a `PosterListRow`. A card is about 60 DOM nodes.
- Keyboard: `card-keys.navigateCards` reads the cards that exist in the DOM (`[data-primary]`, their `top`) and
  derives the column count from them. It cannot move to a card that is not mounted.
- Selection is the page's `selected` id. `useLibraryRequest` reveals a card by `document.querySelector
  ([data-card-id])` in one `requestAnimationFrame`, so a card that is not mounted is never found.
- The store's `libraryItems` is rebuilt by `rememberLibraryItems` after every page: a new `Map` of all n items with a
  template-string key each, then a new array. n grows by 20 to 40 a page, so reading the whole library is O(n squared).
  `appendLibraryPage` builds a `Set` of all identities per page and `LibraryPage` re-resolves all n items per page
  (the same order of growth, much cheaper per item).
- Already fixed and kept as is: no paging while the surface is hidden (`pagerCanRequest`, `mayChain`), returning to
  the Library does not reload (`reloadDecision`), the loading tail shows `pagerSkeletonCount` skeletons on the grid's
  columns, posters load on the shimmer tile and fade in (`PosterImage`).
- Rows view: shelves of horizontal rows (`ShelfRow`), every item of a shelf mounted.

## 2. Design

One windowing engine for the two vertical views (grid, list), no dependency (`01` section 2: the stack is locked; an
in-house implementation is small and fully testable because fixed geometry makes the maths closed-form).

### 2.1 Fixed geometry, derived from the width

Windowing needs a row height known without mounting the row. Everything is a function of the container's content
width `W` (the width inside its padding, so the scrollbar is already excluded):

- **Grid.** `columns = max(1, floor((W + gap) / (144 + gap)))` is exactly CSS `auto-fill, minmax(144px, 1fr)` with
  gap 12. `cardWidth = (W - (columns - 1) * gap) / columns`. A card is the 2:3 art (`cardWidth * 1.5`) plus the fixed
  chrome under it (gap 4 + the 20px title line + gap 4 + the 24px verb row = 52). `rowHeight = ceil(cardWidth * 1.5
  + 52)`, `pitch = rowHeight + 12`. Rows are laid out with explicit `columns` (`repeat(columns, minmax(0, 1fr))`), so the
  render and the maths cannot disagree.
- **List.** One column, `rowHeight` is a constant (the row's content is a 54px thumbnail with 6px padding: 66px),
  `pitch = 66 + 4`. `PosterListRow` is given that height explicitly, so a row with a progress bar or a long facts line
  never changes the pitch.
- `lib/window-rows.ts` holds all of it as pure functions of a `RowSpec` (min column width, gap, art aspect, chrome,
  or a fixed row height).

### 2.2 The window

`hooks/useWindowedRows` owns the measurements and returns what to render. A `ResizeObserver` on the grid container
(width) and on the scroller (viewport height) and a passive `scroll` listener on the scroller call one `measure()`.
There are no timers, no `requestAnimationFrame` loop, no polling. `measure()`:

1. reads the container width, the scroller's `clientHeight` and `scrollTop`, and the grid's top inside the scroller's
   content (the Continue strip above it changes height; rect difference plus `scrollTop`);
2. a zero width or height means the surface is hidden: it changes nothing (the last layout and range stay);
3. computes `layout` (section 2.1) and the visible rows `[first, last]` widened by `OVERSCAN_ROWS = 2` rows each side
   (rows, not pixels, so the mounted-row bound is independent of the window size);
4. sets state only when `layout` or the range really changed. A scroll inside the same range renders nothing.

Rendering (`WindowedRows`): the container holds, in order, a **top spacer** (`firstRow * pitch`), the mounted rows
(each `display: grid`, `height: rowHeight`, `margin-bottom: gap`, keyed by row index), and a **bottom spacer**
(`(totalRows - lastRow - 1) * pitch`). The total height is always `totalRows * pitch`, so the scrollbar and the
sentinel behave as if everything were mounted. Rows not contiguous with the range (a pinned row, 2.4) get a spacer on
each side: the renderer works from a sorted list of mounted row indices and emits one spacer per gap
(`windowSegments`).

### 2.3 Scroll position, revisit and width changes

- **Revisit.** A hidden surface is `display: none` (`WorkspaceSplit`), so every measurement is zero and ignored
  (2.2 step 2); nothing reloads (`reloadDecision`), so the same `count`, range and `scrollTop` apply on show. As a
  belt for engines that drop a hidden element's scroll offset, `measure()` remembers the last visible `scrollTop` (on
  every scroll event) and, when the surface comes back with an unchanged layout and a different `scrollTop`, puts the
  remembered one back.
- **Anchor.** On every measure the index of the first fully visible item is kept: `anchor = firstVisibleRow *
  columns` plus the fraction of the row already scrolled past. When the layout changes (columns or pitch: a narrower
  window, the filters pane opening), a layout effect runs **after** the new spacer heights are in the DOM (the
  browser would otherwise clamp `scrollTop` to the old height) and sets `scrollTop = gridTop + floor(anchor / newColumns)
  * newPitch + fraction * newPitch`, then re-measures. The first item on screen stays the first item on screen
  while the grid re-flows; before paint, so there is no visible jump.
- **New list.** A first-page read sets `scrollTop = 0` (`useScrollTopWhileLoading`) and clears the list, which draws the
  card skeletons and unmounts the windowed grid; the next list starts from a fresh engine. Appending a page changes only
  `count`: the range, the anchor and `scrollTop` are untouched.

### 2.4 Keyboard, focus and Tab order

- **A focused card is never unmounted.** The container records the item index of the last card that received focus
  (React `onFocus` bubbles) as `pinned`. Its row joins the mounted rows (2.2) even outside the range, and stays
  until another card is focused. It also covers the things that hand focus back to a card after it has left it:
  Title information returns focus to the card's art button; the context menu and the details popover return to their
  opener. At most one extra row is ever mounted. A pinned row keeps its DOM position, so Tab order is the document order
  of the mounted rows: after the last mounted card the next Tab stop is the pager tail, never a lost place.
- **Arrow keys, Home, End.** `navigateCards` is replaced by index arithmetic, `gridStep(key, index, columns, count)`
  (the grid's `columns`; the list's is 1), so it works for cards that are not mounted. The handler takes the index
  from the focused card (`data-index`), computes the target, scrolls it into the window
  (`scrollToIndex`, nearest alignment, then a synchronous `measure()`), and focuses its `[data-primary]` button in the
  layout effect that follows the render that mounted it (`pendingFocus`). Selection moves with focus as today.
  ArrowDown on the last loaded row selects nothing new (the same edge rule as `cardStep`).
- **Reveal (`select this card`).** `useLibraryRequest` keeps its work (clear the filters, select the id) and also
  publishes `reveal = { id, serial }` through a new `setReveal` target of the page. The windowed grid receives
  `reveal`; when its `serial` is new and the id is in the loaded list (also if the list lands later: the effect
  depends on the id lookup), it calls `focusIndex(index)` (scroll into the window, then focus the card).
  The old `[data-card-id]` lookup stays for the Rows view only, and is harmless otherwise.
- **Details popover, context menu.** They hang off the card that opened them (`DetailsGlyph` is inside the card; the
  menu is a coordinate anchor with closures). The popover is hover or focus driven and is allowed to disappear with
  the card when the pointer has scrolled away; a context menu already open does not depend on the card staying mounted.
  A pinned card (above) stays mounted through both.
- **Selection.** Props only (`selected` id); a card that is remounted draws `aria-pressed` and the accent ring from it.
  Nothing about selection lives in the windowing engine.

### 2.5 Paging interaction

`LibraryBody` keeps its order: windowed grid or list, then the loading tail, then `LibraryPager`. Because the
bottom spacer stands for every unmounted row, the grid's box is `totalRows * pitch` tall, so the tail and the
sentinel sit at the end of the virtual height, exactly where the last loaded card ends. The tail
(`PosterGridSkeleton tail`) draws on the same `auto-fill` columns and padding as the windowed rows, so its columns
equal `columns` (the formula in 2.1 is the CSS rule). The pager's request rules are not touched: the IntersectionObserver
is evaluated against real layout, and a sentinel far below the viewport is simply not intersecting. One consequence worth
stating: with 27,000 titles, jumping the scrollbar to the bottom reaches the end of what is **loaded**, then paging
continues as today.

### 2.6 Images, memory, nodes

Only mounted cards have an `<img>`, so only mounted cards load posters; unmounting removes the element, which cancels
a pending request and frees the decoded bitmap when nothing else holds it. `PosterImage` is unchanged
(`loading="lazy"`, shimmer under the fade).

Bound: mounted cards = `columns * (visibleRows + 2 * OVERSCAN_ROWS + 1 pinned)`. At a 1,500px body and 900px viewport
that is 9 columns by about 9 rows = 80 cards (about 4,800 nodes at about 60 per card). At 4K width, 24 columns by 12
rows = about 290 cards. In the list: about 25 rows. The count follows the window's area and **not** the number of
titles loaded: 1,000 or 27,000 loaded titles mount the same cards. Plus the tail: at most 40 skeleton cards, only while a
page loads. This replaces 63,677 nodes with a few thousand.

### 2.7 The list view

Windowed with the same engine (one column, fixed 66px row): a 27,000-row list has the same DOM problem and the same
fix. `PosterList` and `PosterGrid` are two thin users of `WindowedRows`.

### 2.8 The Rows view: not in this build

Shelves are horizontal rows that each hold all their items (the Movies shelf of a 1,000-title library mounts about 500
cards). Windowing them is the same engine on the horizontal axis, but a shelf also owns chevron scrolling, edge
measurement and `rows-navigation`, and its card width is a share of the shelf's width. That is a second piece of
work with its own acceptance, and it is the follow-up: `RowsShelf` would mount `columnsInView + 2 * overscan` cards
between two horizontal spacers. This build leaves Rows unchanged and reports it. (A product shortcut, capping the cards
per shelf at "See all", is a spec change and is not taken here.)

## 3. The store's `libraryItems`

`rememberLibraryItems` becomes incremental: the slice keeps a private `Map<key, index>` beside the array (derived
cache, not state, not exposed). A page adds its new items to the end and replaces a changed item in place; nothing is
rebuilt. The array is still copied once per page (a pointer copy, no string keys, no Map), so the cost per page falls
from n key strings and n Map inserts to n pointer copies; reads stay `find` over the array (a click, a Play, never a
render path). `appendLibraryPage`'s per-page `Set` and `resolveItems` stay: linear, cheap per item, and the windowed grid
no longer renders n cards from them. If measurement shows them above a frame at tens of thousands of items, the follow-up
is to hold the identity set in the page ref.

## 4. Files

| File | Role |
|---|---|
| `lib/window-rows.ts` | pure: `rowLayout`, `visibleRows`, `windowSegments`, `anchorFor`, `scrollTopForAnchor`, `scrollTopToReveal`, `gridStep` |
| `constants/library-window.ts` | `OVERSCAN_ROWS`, the grid and list `RowSpec`s |
| `hooks/useWindowedRows.ts` | the observers, the range state, the anchor, `scrollToIndex`, `focusIndex` |
| `components/library/WindowedRows.tsx` | renders spacers and rows, owns key handling and focus pinning |
| `components/library/PosterGrid.tsx`, `PosterList.tsx` | thin users of `WindowedRows` |
| `components/library/PosterCard.tsx`, `PosterListRow.tsx` | `index` prop (`data-index`); the list row's fixed height |
| `components/library/LibraryBody.tsx`, `pages/LibraryPage.tsx`, `hooks/useLibraryRequest.ts` | pass the scroller and `reveal` |
| `store/slices/library-slice.ts` | incremental `rememberLibraryItems` |
| `components/library/card-keys.ts` | deleted (replaced by `gridStep`) |

## 5. Tests

`node:test`, all seconds-fast, written and run by the worker: `test/window-rows.test.ts` (columns equal the CSS rule at
many widths, row pitch, visible range with overscan and at both ends, segments with and without a pinned row, anchor
round trip across a column change, reveal alignment, `gridStep` on a ragged last row); `test/windowed-rows-markup.test.ts`
(`renderToStaticMarkup`: only the range's cards, the two spacer heights, total height equals `rows * pitch`, a pinned
row, one card per index with `data-index`, the list); the store's incremental `rememberLibraryItems` in
`test/app-store.test.ts` style. Behaviour that needs a layout engine is in section 7.

## 6. Failure modes and the answer to each

- **Hidden surface measures 0**: ignored; last layout and `scrollTop` kept (2.3).
- **Chrome drops a hidden scroller's offset**: the remembered `scrollTop` is restored on show.
- **Card chrome taller than 52px** (a font or token change): rows would overlap their gap; the constant is in one place
  (`library-window.ts`) and the real-stack check (section 7) compares a card's box to the pitch.
- **Fast scrollbar drag**: a range far from the last one mounts in one render; spacers keep the height.
- **Query change mid-scroll**: the list clears, the engine unmounts, a fresh one starts at the top.
- **A page lands while scrolled mid-list**: only `count` and the bottom spacer change; nothing above moves.
- **No `ResizeObserver`** (test environments): the hook is effect-only, so server rendering draws the seeded range
  from the `measured` prop and nothing throws.
- **Focus on a card that scrolls out**: it is pinned (2.4); focus is never lost to `body` by windowing.
- **Sub-pixel widths**: `getBoundingClientRect` widths (fractional) are used, rows carry explicit `columns`; the tail
  uses the CSS rule, and the two agree except at an exact boundary, where the tail may differ by one placeholder.

## 7. The coordinator's real-stack checklist (not run by the worker)

On the owner's real stack (`07` section 4), Library, All, grid view, Chrome MCP or the Electron window on 9222:

1. Script a deep scroll: scroll the Library scroller to its bottom repeatedly until about 1,000 cards are loaded
   (`document.querySelectorAll('[data-card-id]').length` is the **mounted** count; the loaded count is the scroller's
   `scrollHeight / pitch * columns`). `document.getElementsByTagName('*').length` and the renderer's memory
   (`Performance.getMetrics`, `JSHeapUsedSize`, or the Task Manager) at 100, 400 and 1,000 loaded cards: flat (a few
   thousand nodes, not 63,000); mounted cards flat and under about 120 at 1,500px.
2. No blank gaps: at five scroll positions (top, 25%, 50%, 75%, end) every point of the viewport is covered by a
   mounted card; no scroll position shows a spacer in the viewport.
3. Tail: at the end of the loaded list the skeleton tail shows below the last row in the same columns (count 40 in
   All, 20 in Movies, TV and Local), and the next page appends without a jump.
4. Revisit: scroll to mid-list, switch to Player and back: `scrollTop` and the first visible card unchanged, nothing
   reloaded (no `/api/library` request).
5. Resize: narrow and widen the window (and open and close the Filters pane): the first visible card stays first, the
   columns change, no blank band, no jump.
6. Keyboard: focus a card, ArrowDown ten times, Home, End: focus and selection follow, the card is on screen, and a
   focused card scrolled out of view by the wheel is still in the DOM until another gets focus. Tab leaves the grid in
   order.
7. Reveal: Player, Reveal in Library for a title that is deep in the list: the grid scrolls to it and focuses it.
8. A card's context menu and Details popover still open and anchor to the card; Title information closes with focus
   back on the card.
9. List view: the same steps 1, 2, 4 and 5; rows are 66px and never overlap.
10. Posters: only mounted cards request `/api/images`; no accent colours while loading (the shimmer).
