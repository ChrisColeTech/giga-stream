# 45 - One TanStack table system for the admin index lists (plan)

**Status: PROPOSED 2026-10-18; awaiting the owner's answers to section 11 (esp. the stack amendment, section 7).** Written by a
read-only planning pass (references: `giga-extension` downloads/history/settings tables, `giga-cut-poc` `DataTable`). Docs before
code (`07`). Scope: the admin app (`src/admin`) and `src/shared/ui`.

## 0. Verdict

Adapt, do not copy near-verbatim.

- **Copy the structure:** one `useTable` per list; a typed feature set from `tableFeatures()`; one column-definition array;
  `flexRender` for headers and cells; one CSS-grid template string shared by the header and every row; controlled sorting and
  visibility state.
- **Do not copy three things:** (1) their sizing model: both references use fixed-px columns with `minWidth = sum` and
  `overflow-auto`, so they scroll sideways below their total width, which is exactly the owner's complaint - we use fluid
  `minmax/fr` columns plus priority hiding; (2) their row model: they hand TanStack the whole array and append pages; we have
  index-addressed server paging (`41` 4.2), so TanStack sees only the mounted rows; (3) their `any`: the installed 9.2.4 has
  `helper.columns([...])` and a typed `columnMeta` slot, so our `banned-code` rule stays satisfied.
- **Row height stays 36px** (LoRA's grammar, already identical everywhere); the references' 24px mono is an owner question.

## 1. Measured facts and causes (admin at 1094px wide, 2026-10-18)

Every table has the same 36px row pitch, but: Channels (2,876px tall) and Providers (1,472px) grow to full height so the PAGE
scrolls; Titles is a fixed ~519px inner scroller (its header is 1026px vs 1036px for the others because of the scrollbar);
Playlists' grid is 1280px inside a 1046px scroller and Jobs' is 1184px inside 1036px (horizontal scrollbars); Accounts is
exactly 1046px. Causes: the 100-row threshold decides the scroll strategy (`WindowedRecordGrid.tsx:18`, `RecordGrid.tsx:30-31`,
`list-window.ts:23-26`); each list hard-codes its own `minWidth` (50-80rem) and a 12-20rem `end` track
(`constants/*-grid.ts`); a scroller with a scrollbar is 10px narrower. No mechanism for individual rows being wider was found
in code: the pilot must measure `li` widths with a DOM probe before that claim is accepted as fixed.

The admin uses no TanStack today; the LoRA apps declare `@tanstack/react-table` but never import it.

## 2. Target design

### 2.1 What TanStack does here

Used: column definitions with typed meta, header groups and `flexRender`, sorting state (client `createSortedRowModel` for short
lists, `manualSorting` for server lists), `columnVisibility` (driven by the fit function), `columnSizing` metadata, `getRowId`.
Not used: `rowSelectionFeature` (our selection is by id across pages with `all-matching` + `except`, which `Record<id,boolean>`
cannot express), column resizing, a column chooser. Rows given to TanStack: in-memory lists get all rows; paged lists get only
the loaded rows of the mounted window (about 30); skeleton rows for unloaded indexes are rendered by index outside TanStack.
`@tanstack/react-virtual` supplies the window (`count = total`, fixed `estimateSize` 36, overscan 2, scroller held in state); the
paging contract stays (`onNeedRange`, `resetKey`, `useRangePager`, `range-pages`, `pager-rules`). Keep `useWindowedList` until the
Virtual wrapper passes the hidden-tab and pinned-focus parity tests (W4).

### 2.2 One column-definition API (`shared/ui/src/lib/record-columns.ts`)

`RecordColumnMeta { kind: "name"|"text"|"mono"|"number"|"state"|"custom"; grow?: number; priority: number }` (0 = never hidden;
higher hides first); `recordFeatures = tableFeatures({ rowSortingFeature, columnVisibilityFeature, columnSizingFeature,
sortedRowModel, columnMeta })`. Each table: `createColumnHelper<typeof recordFeatures, <Tab>RowView>()` and
`export const <tab>Columns = column.columns([...])`. `size` is the minimum in px, converted to rem so the 12px header and 14px
rows align. The row type is the existing `*RowView` (`lib/*-rows.ts` and tests untouched). Cells return content only; the table
wraps each in a `min-w-0 overflow-hidden` span with the `kind` class and `title` for text.

### 2.3 One sizing model that always fits

`fitColumns(columns, width, {tick, endPx})` (pure) returns a visibility record: available = scroller `clientWidth` - 24 padding - 20
tick - 88 end - 12 per gap; while minimums exceed it, hide the highest-`priority` column; priority 0 never hides.
`columnTemplate(visible)` builds one string (`{size}rem` fixed, `minmax({size}rem,{grow}fr)` grow) set once as the CSS variable
`--cols` on the table root; the header, every row and every skeleton row use `grid-template-columns: var(--cols)`.
`useElementWidth(scroller)` is a `ResizeObserver` hook (no timers; a 0 width changes nothing). The end column is a fixed 5.5rem
(`Delete`/`Restore`); the armed question is `whitespace-nowrap`, right-aligned in a `relative z-10 overflow-visible` cell and grows
leftwards over its neighbours. The scroller has `overflow-x:auto` as a last-resort safety net only and `scrollbar-gutter: stable`,
so every table has identical content width and left edge; acceptance asserts `scrollWidth === clientWidth`.

Starting priorities (tuned against acceptance): Channels: name (grow), state always; hide order now playing, mode, category, kind,
stream. Providers: name, state; order, source, family. Playlists: name, state; dead, live, enabled, source, last run, channels.
Jobs: name, state (holds the running bar); last run, outcome, schedule, target, type. Accounts: username, state; last sign-in.
Titles: title, state; rating, year, kind. Deleted: name; kind, deleted.

### 2.4 One scroll strategy: the table fills the pane and scrolls inside

Every table is a scroll box with a sticky header and never grows the page (the family form kit's `Workspace fill`/`Group fill`
props already exist and were never used). The `New <record>` group stays above the list as an auto-height block; the list group is
`flex-1` with `TABLE_MIN_HEIGHT` = header + 8 x 36 = 317px, last child of a `min-h-full flex-col` column: a tall pane fills to the
bottom edge; a shorter pane scrolls once, to reach a table still at least 8 rows tall; a short list leaves blank space under its
last row, as the references do. The 100-row threshold stops choosing the scroll strategy (it only decides, inside the body,
virtualized vs plainly mapped); `listHeight`, `useHostHeight`, `LIST_PAGE_MARGIN`, `LIST_MIN_HEIGHT` are deleted. Honest
consequence: at a ~730px-high window the form + 317px do not fit, so the page still scrolls once (question 1). Deleted titles uses
the same component with `size="bounded"` (height `min(content, 10 rows + header)`, inner scroll, below the filling list): the only
bounded table, a CSS variant.

### 2.5 Everything else, one place each

Row: `RecordTableRow`, `li`, 36px, grid `var(--cols)`: tick, a spanning primary button over a subgrid of `flexRender`ed cells, the
end cell; per-table `rowView(row) => { state, dimmed, label, onOpen, end }` replaces the ten hand-written row components. Header:
sticky in the same scroller; first cell is the three-state `All` (existing `SelectAllScope`/`useSelectAll`) above the row ticks;
sortable headings are buttons with `aria-sort` from `column.getIsSorted()`; server lists keep `GridSort {state, onSort(key)}`
(`channel-query.ts` `pressHeading`/`nextSort`, `record-grid-sort.ts` untouched); client lists use `createSortedRowModel`.
Selection: `ListSelection` stays the source of truth; the table takes `isTicked(id)`; header `All` ticks loaded rows; `Select all M
matching` stays in `TableStrip`. Query bar: the new `QueryBar`, `QuerySearch`, `QuerySelect`, `SortControl` plug into
`TableStrip query=`, neither touched nor duplicated here. Skeleton: `RecordTableSkeletonRow`, one shimmer per visible column on the
same `--cols`, no sentences. Data contract: today's `WindowedRecordGridProps` with `layout`/`headings`/`renderRow` replaced by
`columns`/`rowView`; `total`, `rowAt`, `idOf`, `resetKey`, `onNeedRange`, `pageSize` kept; an in-memory list passes `rowAt = i =>
rows[i]` and no `onNeedRange`.

## 3. Files

**Deleted** (`src/shared/ui/src`): `lists/RecordGrid.tsx`, `RecordGridHead.tsx`, `RecordGridRow.tsx`, `RecordGridSkeletonRow.tsx`,
`SkeletonGrid.tsx`, `WindowedRecordGrid.tsx`, `WindowedRecordList.tsx`, `windowed-grid-types.ts`, `record-grid-layout.ts`;
`hooks/useHostHeight.ts`, and (after the W4 parity gate) `hooks/useWindowedList.ts` + `lib/list-window.ts`; their tests. Admin:
`constants/{channel,provider,title,playlist,job,account}-grid.ts`, `components/{channels/ChannelRow, playlists/PlaylistRow,
jobs/JobRow, accounts/AccountRow, titles/TitleRowItem}.tsx`, `test/grid-layouts.test.ts`.
**Kept:** `lists/{TableStrip, SelectAllScope, select-all-context, record-grid-classes (CELL_*), record-grid-sort}`, the query-bar
components, `controls/{Checkbox, AllCheckbox, ArmedButton}`, `lib/{list-selection, range-pages, pager-rules, window-rows,
window-types, shimmer}`, `hooks/{useRangePager, useSelectAll}`, `lib/window-constants.ts` (edited: add `TABLE_MIN_HEIGHT`, `ROW_GAP`,
`END_COLUMN_PX`). Not touched: `lists/DataTable.tsx` (the interface's Collections window; the new component is `RecordTable`), all
admin `lib/*-rows.ts`, services, slices, `useBulkSelection`.
**New** (<= 200 lines each, one component per file): `lists/{RecordTable, RecordTableHead, RecordTableRow, RecordTableBody,
RecordTableSkeletonRow}.tsx`, `lists/record-table-types.ts`, `hooks/{useRecordTable, useElementWidth, useRowWindow}.ts`,
`lib/record-columns.ts`; per admin tab `components/<tab>/<Tab>Columns.tsx`; `ListGroup` gains `fill`. TanStack is confined to
`useRecordTable.ts`, `record-columns.ts` and the three presentational files: swapping it later costs one folder.

## 4. Migration order

One kit, then one table family per wave, each a worker branch cut from `family-port`; the gate runs after each merge; each wave is
accepted in Chrome at 900 and 1264.
- **W0 (coordinator):** this doc; amend `01`, `28`, `41` (section 6); add the dependencies; `shared-ui-consumption.mjs` and the
  admin `vite.config.mts` `dedupe`.
- **W1 shared kit:** `RecordTable` and friends, `fitColumns`, `columnTemplate`, tests; plain-map body only; extend `ListGroup`,
  verify `Workspace fill`.
- **W2 pilot:** Providers + Accounts, then Playlists + Jobs (wide tables prove priority hiding at 900; Jobs proves a custom cell).
- **W3:** Titles Browse + Deleted (`Older/Newer`, `Restore`, the `bounded` variant).
- **W4:** Channels + Titles Stored (paged, virtualized: `useRowWindow`, `onNeedRange`, `resetKey`, server sort, `Select all M
  matching`; the Virtual parity gate; fold the `stream` column of the Channels worker into `channelColumns`).
- **W5 sweep:** delete the old kit, `check-rules`/lint/gate, final Chrome pass on all eight lists, docs reconciled.
`feat/query-bar` and `feat/channels-admin` land first (done 2026-10-18); W4 rebases onto them.

## 5. Tests

Fast `node:test`, string-render, no browser. `record-columns.test.ts` (`fitColumns` hides in priority order, never priority 0,
monotonic, no-op when the width suffices; `columnTemplate` one string). `record-table-markup.test.ts` (header cells equal visible
defs; head/row/skeleton share `--cols`; hidden columns absent; `aria-sort`; header `All`; dimmed row, state word, end cell;
`bounded`). `row-window.test.ts` (ported from `list-window.test.ts`: mounted-row count flat for 100, 5,000, 27,000 rows; zero-size
scroller changes nothing; `resetKey` returns to top; focused row stays mounted; keyboard moves by index). Kept: `list-selection`,
`pager-rules`, `range-pages`, `table-strip-*`. Admin `table-columns.test.ts` replaces `grid-layouts.test.ts` (unique ids, a
priority-0 grow column, `fitColumns` at 842px keeps the priority-0 set, at 1206px shows all, date columns hold 16 mono characters
whole). The nine admin markup tests are updated.

## 6. Docs to update first (W0)

`01`: section 2 stack rows (7); a Tables subsection in section 9 (fit, one scroll, 36px, header `All`); correct selection-toolbar
item 3 and the sentence "a tick in the table's header is a second row of controls" (the code and `41` put `All` in the header);
section 5 note that `helper.columns()` removes the need for `any`. `41`: mark 1.1 and 4.2 superseded; "windowed above 100 / plain at
or under" becomes "body-only". `28`: Appendix A rows 32-36 and 6.x item 7 become "no horizontal scroll at 900 or wider". `43`
4.1 and `44` 4 are unaffected beyond the priority table.

## 7. Locked-stack amendment (owner authorization required)

| Concern | Choice |
|---|---|
| Tables | `@tanstack/react-table` v9 (`^9.2.4`, the references' pin): `useTable` + `tableFeatures`; sorting, visibility and sizing metadata only |
| Row windowing | `@tanstack/react-virtual` `^3.14.x`, long admin lists only |

Add to `src/shared/ui/package.json` and `src/admin/package.json` (same ranges); `src/admin/vite.config.mts` `resolve.dedupe` gains
both; `scripts/check-rules/rules/shared-ui-consumption.mjs` gains an admin-only pin list (the frontend does not import TanStack).
v9 is the `latest` dist-tag (9.3.1) and what both working references run (9.2.4); we use 4 features and confine it to one folder.
Not installed in giga-stream today: `npm install` is the first step of W1.

## 8. Per-table acceptance (Chrome, 900 and 1264, real stack)

Every table: (1) scroller `scrollWidth === clientWidth` (no horizontal scrollbar); (2) every `li` 36px, header 29px; (3) the header's
first-cell left edge, rows' left edge and content width identical across all eight tables; (4) header width equals row width; (5)
the only vertical scroll inside the table is its own with a sticky header, the page scrolls only when form + 317px exceeds the pane;
(6) unloaded rows show skeleton rows in the same columns. Per table: Providers/Accounts all columns at both sizes, blank space
beneath, no page growth; Playlists at 900 `dead`, `live`, `enabled`, `last run` hidden as needed, all 8 at 1264; Jobs at 900 `last
run` and `outcome` hide first, the running bar stays in the state cell; Titles Browse 40 rows plain, `Older/Newer`, state word and
dimmed row unchanged; Deleted titles bounded at 10 rows, `Restore` fits 5.5rem; Channels 80 and 5,000 rows, DOM `li` <= 30 at
1264x1000 and <= 20 at 900x640 while scrolling, header sort and `SortControl` agree, `Select all M matching` works, header `All`
is mixed after ticking some; Titles Stored the same against the 10,921 real rows, read-only.

## 9. Risks

Locked-stack amendment blocks W1 until approved. TanStack v9 maturity (isolated to one folder; verify `useTable`,
`createColumnHelper().columns`, `metaHelper` early). Virtualization + selection (selection is by id so unmounting is safe;
shift-click ranges exist in `list-selection.ts` but are not wired to rows; keep the focused row mounted via `rangeExtractor`;
hidden-tab `enabled` + offset restore: the W4 parity gate). The armed-question overlay needs `overflow: visible` on the end cell and
a z-index above the primary button (fallback: a fixed 12rem end cell for Channels only). Bundle size baseline 613,253 bytes; expect
about 10 KB gzip; abort and ask above 40 KB gzip. 200-line limits (`RecordTableBody` is the one to watch; split a virtual body).
Page scroll at short windows is design-inherent (2.4). The other branches (`feat/sync-progress` job rows work through
`lib/job-rows.ts`, which is kept).

## 10. Not built

Column resize and chooser, TanStack row selection, context menus, a second density, horizontal scrolling by design.

## 11. Open questions for the owner

1. **The New-record form above the list.** At ~730px window height the page still scrolls once. (a) keep the form open on top
   (default); (b) start the `New <record>` group collapsed on index pages so the table fills; (c) a popup from the page toolbar.
2. **Row height:** keep 36px (default), or the references' dense 24px mono?
3. **Deleted titles:** its own bounded group under Stored (default) or a third segment of the Titles list?
4. **Hidden columns:** confirm that at 900px lower-priority columns are hidden (values stay in the workspace) rather than the table
   scrolling sideways.
5. **Authorize the two stack rows** (section 7).
