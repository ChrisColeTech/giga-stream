# 57 - Choice controls and the cross-app chip audit (plan v1)

> **Amended 2026-10-19 (owner; superseded in part by `58`).** The full `Filters · N` popup, toolbar Sort and applied
> filter-token strip built by this plan are rejected. `58` restores a quick toolbar Media multi-picker and View picker,
> keeps the full filter pane (Sort included), and replaces ChoiceMenu/ChoicePicker/GenrePopover with one shared
> single/multi choice-popover family.

**Status: v1 (2026-10-19).** Owner: "there is no consistency or standard here for when you are using a chip vs drop
down. can you tell me when we should use chips vs dropdowns? how many chips are 'too many chips' that should use a
dropdown instead. how many is too many on a form if there are a bunch of chip form controls across form groups? we
need to do a frontend and admin console sweep to make sure we dont have chip overload." The standard is written in
`01` (Choice controls) by this change. Scope: shared choice primitives, frontend filters/settings, admin forms/query
grammar, and persisted settings migrations in both servers. Landing (`07` 6.1): backend/fileserver settings contracts
and the shared choice foundation first; then the admin and frontend consumer waves cut from that landed baseline.

## 1. Why (observed across both apps)

- No shared primitive or governing doc set a count limit. Existing screens use up to four pills in one control and
  seven on a page, but the owner rejects that density: visible pills are the binary `option 1 | option 2` control, not
  a compressed dropdown.
- The definite overload is the frontend Genre popover: a dynamic/unbounded, server-populated genre set rendered as an
  ad-hoc chip cloud (one tab stop per genre), searchable only at 12. It violates the small-fixed-set meaning of pills.
- The audit finds conversions in both apps under that rule (Scope, Kind, Library Type/View, Resume, collections Type
  and live Qualities). Theme and Reduce motion are corrected to true binary pairs (Light/Dark, Off/On). Dynamic and
  long sets already use native selects. The Channels query row is a
  separate responsive-layout outlier: seven SELECTS without the shared `QueryBar` grammar.

## 2. Decisions

1. **The family standard is `01` Choice controls.** `Segmented`: exactly two fixed peer modes. `Select`: three or more,
   any catch-all + specifics, dynamic/record-backed/unbounded, long, secondary/technical, or a pair that cannot fit.
   Supplied multi-choice: checklist. `ChipsInput`: entered freeform tokens only. Boolean: Toggle. Navigation: TabPill.
2. **Hard budgets:** one pair per group; two pairs (4 pills) per form/page. A third pair becomes Select. Conditional
   pairs count together; entered tokens, tabs, badges and swatches do not count.
3. **Width:** a pair stays one line and never wraps/truncates. If the labels do not fit, use Select.
4. **Frontend Genre becomes a searchable multi-select checklist.** Keep the field-shaped trigger, selected summary,
   search-at-12, scrolling, Escape/focus dismissal and multi-selection; replace the rounded `aria-pressed` chip cloud
   with checkmark/checkbox rows. It is not native Select (multi-choice) and not ChipsInput (supplied vocabulary).
5. **Admin conversions:** Job Scope (4) and Kind (All/Movies/Series) become Selects; live Qualities (3, multi) becomes
   a compact checklist. Appearance Theme becomes `Light | Dark` and Reduce motion `Off | On`, both Segmented pairs.
   Other binary pairs stay segmented: channel Kind, provider Family, playlist Source, live Plays and Mode, title Kind,
   Stored/Browse.
6. **Channels query row adopts `QueryBar`.** Its seven QuerySelect controls and search/sort use the same container-
   responsive grammar as every other admin list (search first line below the container threshold, selects wrapped on
   the second), without changing any control type or option.
7. **Frontend conversions beyond Genre:** collection Type (3), Library default View (3), Playback Resume (3), Library
   Type (All/Movies/TV/Local) and Library View (Grid/List/Rows) move to the Library filter grammar below. Theme becomes
   `Light | Dark` and Reduce motion `Off | On`, both Segmented pairs. Other true two-mode pairs stay segmented. Live
   Qualities' admin checklist is not a frontend preference conversion; the frontend rail already uses Select.
8. **There is no live `system` value.** New defaults: Dark, Reduce motion Off. Data migrations rewrite previously
   persisted `theme: "system"` to `dark` and `motion: "system"` to `off` BEFORE the settings JSON reaches an app
   schema. Runtime types, read/write schemas, stores, defaults, controls and API bodies accept only Light/Dark and
   Off/On; an external payload containing `system` is refused. The old word exists only inside the one migration and
   its migration fixture/assertion, never as an application value.
9. **Compliance:** consumer-built interactive pill clouds outside `Segmented` and exempt navigation are prohibited.
   Apps add inventory tests pinning each Segmented to exactly 2, one pair per group and two per page. The primitive does
   not crash at runtime - the test/lint contract catches repository violations.
10. **The Library uses faceted pickers, not a row of selects.** The page toolbar carries `Filters · N` (active-filter
    count), `Sort: <value>` and `View: <value>` menu buttons. The filter pane holds field-shaped picker rows: Media
    (All/Movies/TV/Local, single-choice checkmark rows), Genre (searchable multi-select checklist), Year (scrollable/
    searchable single-choice list, Any year first), Watched (single-choice checkmark rows) and one Clear filters.
    Active non-default values render as removable applied-filter tokens (state, not offered-choice chips). Sort and View
    remain outside the filter pane as operation menus; View rows carry their Grid/List/Rows icons. At narrow width the
    pane collapses and `Filters · N` opens the same content as a popover/drawer - no duplicate state or option source.

## 3. Changes from what is merged

- `src/shared/ui`: binary-pair constants/tests; `ChipGroup` is removed from form-choice use (kept only if a non-form
  consumer earns it); disabled-pair reasons use the focusable-tooltip pattern instead of title-only copy.
- `src/frontend` + `src/fileserver`: the Library's picker/menu/filter-token components (the Genre checklist included),
  dedicated markup/interaction tests and one shared query state; a compliance inventory over every Segmented/
  ChipGroup consumer; the fileserver state migration rewrites old System values, then frontend settings schemas/types/
  defaults contain no System branch.
- `src/admin`: `ChannelQueryRow` through `QueryBar`/`SortControl`; guide-compliance/choice inventory tests; no field
  control conversion beyond the binary Appearance correction; the backend `admin_ui_state` migration rewrites old
  System values, then admin settings schemas/types/defaults contain no System branch.

## 4. Tests

- Shared choice semantics and limits; navigation/ChipsInput exemptions; disabled reasons keyboard-reachable.
- Library filters: Media/Year/Watched single-choice menu rows; dynamic Genre checklist, multi-select and search at 12;
  Filters active count; removable applied tokens; Sort/View menus; wide pane and narrow popover share state/options;
  keyboard/Escape/focus dismissal; no `aria-pressed` offered-choice cloud.
- Admin/front-end inventories: every Segmented exactly 2, at most one pair/group and two/page; no ad-hoc pill groups. Channels query
  responsive markup at wide and narrow container sizes.
- Settings: only Light/Dark and Off/On render; new defaults Dark/Off; migrations map old System data before parsing;
  all current schemas reject System.
- Gate, then real visual drive at 1600x1000 and 900x640: Library filters/Genre, live-channel workspace, job forms,
  Appearance, Channels query bar; console clean.

## 5. Docs (coordinator)

`01` carries the standard (done). `06` Genre becomes a searchable checklist while the narrow-rail Select rule stays;
`26`/`28` cross-reference the count budgets and the Channels query grammar. `02` keeps TabPill navigation distinct.
