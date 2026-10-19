# 58 - The Library restores quick Media and one choice-popover family (plan v1)

**Status: v1 (2026-10-19).** Owner: "the popover menu is just a variation of the select list, so now you have two
competeing styles in the ui kit"; "the popovers arent consistent - some have a combo box, others dont, none of them
allows multi select"; "some of them have random widths that dont even match the trigger width. and some you cant even
see the trigger, it just looks like text"; "i dont like the full filter and sort menu on the toolbar, thats redundant";
"you completely swapped the controls that were there - you replaced the quick filter for all|movie|tv|local with the
full blown filters menu"; "all we needed was a quick popover drop down for media types like we have for view." Amends
`57`'s Library decisions. Scope: shared choice popover, frontend Library composition/query, fileserver Library/settings
contract. Landing (`07` 6.1): shared foundation; fileserver contract/migration; frontend correction last.

## 1. Why (verified in merged code)

- `ChoiceMenu` (single toolbar), `ChoicePicker` (single field), `GenrePopover` (multi field) and the Library Filters
  `PopupPanel` are four implementations. Triggers use ghost or geometry-only classes, popup widths are independently
  190/220/240/260px, and search is absent/Boolean/threshold-based. The result is competing styles, invisible-looking
  triggers and unrelated popup widths.
- The toolbar duplicates the right pane (`Filters · N` dialog + Sort) and removed the fast media-type control. The
  owner needs Media available directly without opening the full filter surface.
- Media is currently one scalar (`all | movie | tv | local`) through LibraryQuery, saved `libraryScope`, the request's
  one `type` parameter and the fileserver route/filter. The SQL title query already accepts a kind array, but the HTTP,
  settings and local-list boundary do not - true Movies+TV/Local selection needs a contract change.

## 2. Decisions

1. **One shared ChoicePopover family** (`01` Choice popovers): single/multi discriminated props; field/toolbar triggers
   use the same dropdown field chrome and display ONLY the selected summary (label remains accessible); popup width
   exactly matches the trigger; automatic search at 12; common check/check-box rows and keyboard/focus/Escape.
   It replaces `ChoiceMenu`, `ChoicePicker` and Genre's own menu. `PopupPanel` is not a choice list; native Select remains
   ordinary static single-choice form/settings input.
2. **Library toolbar:** `<Media summary>` MULTI-select quick popover; `<Grid/List/Rows>` single popover with icons;
   spacer; Refresh; Search. The visible trigger never prefixes `Media:` or `View:`. DELETE `Filters · N`, toolbar Sort,
   Filters PopupPanel and applied-filter tokens.
3. **Full filter pane stays full.** Order: Title, Media (the same ChoicePopover/state as toolbar), Genre (multi,
   searchable checklist), Year (single, searchable/scrollable), Watched (single), Sort (single), Clear filters. The
   right-pane toggle remains the way to show/hide it; no duplicate full filter dialog.
4. **Media semantics:** stored value is a canonical non-empty array of `movie | tv | local` in that order. All is a
   DERIVED complete-set state, never stored beside specifics. All -> choose a specific starts its singleton; specifics
   toggle independently; selecting all three canonicalizes to All; removing the last resets to All. Trigger summaries:
   All, Movies, TV, Local, Movies + TV, Movies + Local, TV + Local.
5. **Wire contract:** repeatable `type` (`?type=movie&type=tv`). No type and legacy scalar `all` mean all three;
   legacy scalar concrete values mean singleton; repeated values dedupe/canonicalize; all mixed with specifics means
   all; empty/unknown -> `422 library.invalid`. Cached-title SQL already receives title-kind arrays; mixed local/title
   pagination keeps its cursor shape.
6. **Saved setting migration 009:** `libraryScope` scalar becomes the canonical array (`all` -> all three; concrete ->
   singleton). Frontend/fileserver schemas and equality/writeback use arrays after migration; no permanent runtime
   scalar compatibility branch.
7. **Sort/View distinction:** Sort returns to the filter pane because it changes result order; View stays a quick
   toolbar control because it changes presentation only. Neither counts as an applied filter.
8. **No filter-token strip.** The quick Media summary and the full pane show state directly. Clear filters restores
   Title/Media/Genre/Year/Watched defaults while retaining Sort; View is never a filter.

## 3. Changes from what is merged

- `src/shared/ui`: new `ChoicePopover` family under menus/choices, using the shared menu rows and full field skin;
  interaction/geometry/search tests. No change to PopupPanel/native Select.
- `src/fileserver`: route normalization for scalar/repeated `type`, Library query membership and kind arrays, settings
  schema + migration `009-library-scope-list.sql`, mixed-kind/local tests.
- `src/frontend`: LibraryQuery/settings scope arrays; service URL/cache keys; restore/writeback/equality; paging/Rows
  consumers; LibraryToolbar/Filters corrected; ChoiceMenu/ChoicePicker/AppliedFilters/filter-state deleted; Genre uses
  shared multi ChoicePopover; updated query/filter/settings/interaction tests.

## 4. Tests

- Shared: field/toolbar triggers visibly skinned; popup match/min trigger width; single closes/multi stays; check rows;
  search exactly at 12; keyboard/Home/End/Tab/Escape/focus return; no consumer-owned width.
- Fileserver: every media combination in all/history/favorites/collections; mixed local/title pagination; scalar legacy
  URLs; repeated canonical URLs; bad values; migration all four legacy values, unrelated settings preserved.
- Frontend: quick Media multi behavior and summaries; toolbar has Media/View/Refresh/Search only; right pane includes
  Sort/full facets; toolbar/pane share one query; Genre multi/search; restored arrays; no Filters popup/count/tokens.
- Gate, then real stack at 1600x1000 and 900x640: quick switching Media combinations, View menu, full pane, Genre,
  mixed Local+Movie results, console/network clean.

## 5. Docs (coordinator)

`01` carries ChoicePopover (done). `02` settings/libraryScope array contract; `03` repeatable Library `type` and setting
migration; `06` Library toolbar/pane composition; `57` amendment note (done).
