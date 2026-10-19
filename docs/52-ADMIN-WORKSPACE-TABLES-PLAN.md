# 52 - The workspace lists become the standard tables (plan v1)

**Status: v1 (2026-10-18).** Owner: "on the admin ui - on the workspaces - the lists should be proper tables. use an
agent to read the arch guide and study the table usage on the indexes and document our standards. then write a new plan
to convert the lists to our standard table. this should apply everywhere in the admin app where we are displaying
tables and lists that users can act on, like the two on channels workspace. once the agent understands the correct
table pattern and style on the indexes - they should document it in the style guide and add a section for tables and
lists standards, then write the new plan following our naminig convention." The standard is documented in `01` section
9 (Tables and lists) by this change; `45` built it for the indexes. Scope: the admin app (`src/admin`); `src/shared/ui`
only for one additive prop (decision 6) - no other kit change is needed. Landing (`07` 6.1): one wave, one worker,
branch `feat/workspace-tables`, cut from `family-port` (the `50`/`51` waves have landed; no file it owns overlaps -
verified against their section 3 lists); the kit edit rides the wave, since only the admin consumes `RecordTableRow`.

## 1. Why (observed in the merged code)

- The six indexes and the Deleted titles group render the standard `RecordTable` (verified: `ChannelRows`,
  `ProviderRows`, `TitleRows`, `TitleStoredRows`, `PlaylistRows` of the playlists tab, `JobRows`, `AccountRows`,
  `DeletedTitlesGroup`). The workspaces hold none.
- The owner's two are hand-rolled `<ol>`/`<li>` rows: `components/records/VideoList.tsx` (a live channel's Details >
  Videos: numbered mono paths, up/down/remove icon buttons, an add row) and `components/channels/PlaylistRows.tsx` (its
  Status > Playlist: numbered names with `mm:ss`, the entry on air in accent text). Both are rows of divs.
- What they lack against the standard: no header row or column words; their own row grammar (`h-8` playlist rows, its
  own hover class on the videos row) beside the kit's `h-9 rounded-ctl hover:bg-hov` vocabulary; their own shimmer lines
  (`PlaylistRows` draws three) instead of `RecordTableSkeletonRow` on the table's own `--cols`; per-row actions drawn
  outside the fixed end column; and no windowing - both lists map every entry however long (a live channel's videos run
  to 2,000; a folder's playlist to hundreds), where the kit mounts only the rows near the viewport above 100 rows.

## 2. Decisions

1. **The conversion rule** (`01` section 9, Tables and lists): every admin list of parallel record rows is the kit's
   `RecordTable`; a plain list stays only for non-tabular display (names under one label); a label and its control stay
   a form `Row`.
2. **The Playlist** (the live workspace's Status group) becomes a read-only `RecordTable`, `size="bounded"`,
   `ticks={false}`: columns `#` (number), `name` (name), `duration` (mono) - exactly what each row shows today. The
   entry on air carries `state: "playing"` (so `data-st="playing"`) and its name cell draws in the accent, a custom
   cell; `aria-current` is dropped, because the kit's row has no such slot and the marker is the state - an honest
   consequence, not silent loss. While the channel is building the table is `waiting`: the standard skeleton rows in
   the table's own columns (the three invented shimmer lines go). Nothing sorts: play order is the order; the
   headings are not buttons.
3. **The Videos** (the live workspace's Details group) becomes a `RecordTable`, `size="bounded"`, `ticks={false}`:
   columns `#` (number), `path` (mono); the end cell holds the up, down and remove icon buttons with their reasons
   (`Already first`, `Already last`) in a wider `endPx` column. The add row (the path field and `Add`) stays under the
   table inside the same `Row`; `lib/video-order.ts`, the draft and the form's one Save are unchanged.
4. **Windowing, no paging.** Both lists arrive with the channel and are held in memory; no page is asked for. Above 100
   rows each table windows through a synthetic `paging` (`total`, `rowAt` over its own array, no `onNeedRange`), so the
   kit's virtual body mounts only the rows near the viewport; at or under 100 every row is mapped.
5. **No selection anywhere.** No workspace list gains a tick column: no verbs act on a playlist entry, and a video
   path's verbs are per-row icons. Bulk select is not invented where no bulk verb exists.
6. **One kit change.** `RecordRowView.onOpen` becomes optional; `RecordTableRow` draws the spanning open button
   only when one is given, else the cells sit directly on the `--cols` tracks. A workspace list has no record to
   open, and a control that does nothing is banned (`01` section 9). Nothing else: `ticks={false}`, a custom
   `endPx`, `bounded`, `waiting` and the header's empty first cell outside a `SelectAllScope` all exist in the kit;
   `bounded` is its compact mode, so no variant is added.
7. **What stays a list, and why.** The job workspace's Refused examples (`JobLastRunGroup.tsx`: at most ten names, one
   label, read-only - backend-bounded, `41` section 2); the synced series' season counts (`TitleSeasonsGroup.tsx`:
   label/value `Row`s); the Events drawer (its own `EventRow` grammar, `26` section 4.9); `FolderRow` and `FileRow`
   (single form rows). `SeasonList` stays the form grammar: each row is a labelled editor of draft values (a number
   input, a title input), not a record with cells and an end; inputs in table cells would break the one-label-per-row
   rule. This is the line decision 1 draws; the owner redirects if the seasons should be tabular.
8. **Where each lives:** the groups do not move - the Status group's `Playlist` `Row` (after Renditions, before Stream
   address) and the Details group's `Videos` `Row` (in place of `Folder` when `Plays` is `Videos`), each wrapped to the
   row's full width. The New channel form gains nothing: its live source is one folder field (`NewChannelRows.tsx`).

## 3. Changes from what is merged

- `src/shared/ui`: `lists/record-table-types.ts` and `lists/RecordTableRow.tsx` (the optional open); its test
  `src/shared/ui/test/record-table-markup.test.ts` gains a no-open row case. No other kit file.
- `src/admin/src/components/channels/`: `PlaylistRows.tsx` rewritten as the playlist `RecordTable` (same props, same
  place in `LiveStatusGroup.tsx`'s `Row`); new `playlist-entry-columns.ts`; `LiveDetailsGroup.tsx` unchanged.
- `src/admin/src/components/records/`: `VideoList.tsx` rewritten as the videos `RecordTable` plus the add row (same
  props, same place in `LiveDetailsGroup.tsx`'s `Row`); new `video-entry-columns.ts` beside it (both lists are the
  Channels tab's; the `*-columns.ts` pattern, one per list).
- `src/admin/src/constants/channel-copy.ts`: the column words and any new reasons the lists need.
- Tests updated: `channel-workspace-markup.test.ts` (the Videos and playlist cases), `video-list.test.ts` (the
  `video-order` cases stay; the markup cases re-render through the table), `table-columns.test.ts` (the two new column
  defs: unique ids, a priority-0 grow column, the sizes). Untouched: `channels-paged-markup`, `playlists-markup`,
  `titles-stored-markup`, the `preview-*` suites.

## 4. Tests

- The markup test per converted list asserts: the columns in order under their words; no tick column; the header's first
  cell empty (no `All` outside a scope); the playing row's `data-st="playing"` and accent name cell; the end actions and
  their disabled reasons; the standard skeleton rows while the channel builds; a no-open row draws no button.
- The windowing test: a 200-entry list keeps the mounted `li` count near the viewport; a 10-entry list maps every row.
- The gate (`node scripts/check/gate.mjs`), then the real drive on the running stack: the admin at 5172 at both required
  sizes (1600 x 1000, 900 x 640), a live channel workspace's Videos (add, move, remove, save) and Status playlist (the
  on-air entry lit; a building channel shows the skeletons), a >100-entry playlist proving the window, no horizontal
  scrollbar at 900, console clean.

## 5. Docs (coordinator)

`00` gains the row for `52`. `01` section 9 carries the standard (done by this change). `26` sections 4.5 to 4.7 (the
workspace words that name the playlist rows and the videos list; `36` sections 6 and 7 are the finer amendments). `28`
section 6.1 (the `VideoList` row) and section 9 item 2 where they describe the lists' grammar. `45` gains a
cross-reference: its scope was the index lists, and `52` carries the same standard into the workspaces.
