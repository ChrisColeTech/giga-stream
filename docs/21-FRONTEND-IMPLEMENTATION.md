# 21 - Frontend Visual Design (Phase 1)

**Status: the plan for phase 1 (look and feel) of `src/frontend`.** It names what each surface must build, the
family standard each part follows, the files each owner creates, updates and deletes, the worktrees the work is
split across, and the checks that prove it. The product is `00`; the interface is `02`, `04`, `05` and `06`; the
wire is `03`; how work is run is `07`; the engineering rules are `01`. Where this document and those disagree,
those win and this document is corrected first.

Phase 2 (wiring to the fileserver) is `22-FRONTEND-WIRING.md`. This document is the look only.

**The component layer is `23`'s.** The ui components this document planned (sections 3.3a, 3.4a and 4.2) were replaced
by Giga LoRA Studio's, copied verbatim (`23-FAMILY-COMPONENT-PORT.md`, section 3). Each retired name below points at
its replacement; `23` section 3.3 is the full map.

**As built (2026-10-17).** Phase 1 and phase 1a are built on `family-port`, and `25`'s remediation waves are done.
The surfaces as they are written are `06`; the rules are `01` section 9; the family deltas are `23` section 3. Sections
3 to 5 below are the original plan and are kept as the decision trail; where a row disagrees with `06`, `06` is the
app. The plan's items that the owner's reviews changed:

| Planned here | As built | Why |
|---|---|---|
| Player tabs, a tab menu, a stage toolbar, a Resume banner, a Watch block | one item at a time; the stage's context menu; Resume and Start over in the inspector's footer while paused (Resume = Ask); no Watch block | owner, 2026-10-16: two toolbars repeated the title, the Watch block was read-only, tabs were not wanted |
| Statusbar connection word and dot | running work (bar, count, Stop), the notice line with a tone glyph, Events, Settings | dots are banned; LoRA's progress bar shows what runs |
| Status dots on channel rows and collection rows | a left-edge status strip and a status word on channels; a shimmer count while a collection scans | dots are banned |
| Collections table with a detail pane, rename on the index | Sensenova's index (create form, rows, `Remove` two-step) and workspace (rail, Details, Folders, Videos) | owner: the family's dataset index and workspace |
| Events drawer severity filter and close control | header of `Events`, count, Clear; the statusbar door or Escape closes it | the log is short; one way to close |
| Clear filters disabled at defaults | always enabled, pinned at the pane's foot | owner |
| Title information's Watch block | a Progress row; genres and cast as name chips; 180px poster; the one group does not fold | `25` VG-050, VG-065 |
| `TwoStep` for destructive actions | `ArmedButton`, with blur and Escape disarm | `25` VG-033 |

---

## 1. Scope and rules

**Three steps, in order.** *Phase 1* draws the look and makes local behaviour work against fixtures. *Phase 1a* makes
every control that needs the fileserver **enabled** and wires it to a stub method in `src/services/`: the stub refuses
with "The fileserver is not connected.", and the press reports that once on the notice line (`04` section 6). Nothing is
disabled merely because it needs the fileserver. *Phase 2* replaces the stub bodies with real calls (`22`).

- **Phase 1 only.** Nothing calls the fileserver. Data comes from typed fixtures in `src/fixtures/` (phase 1
  stand-ins, deleted in phase 2). No browser storage, no WebSocket, no polling, no timers that send requests.
- **The family standard comes first.** Where a family app has solved a surface, its files are ported near-verbatim
  and edited only where Giga Stream's spec differs (`07` section 2, "port from source, not from docs"). The
  sources checked are in section 2.1.
- **The admin backend is never contacted.** No backend address, port `8091`, TMDB, OMDb or live-server URL appears
  in `src/frontend` (`01` sections 1.1 and 4.4). The Settings Address field is drawn from a fixture with no value;
  it is enabled, and a committed address is sent to the fileserver's `saveSetting` stub, never to the backend.
- **A control works or is visibly disabled.** Since phase 1a a control that needs the fileserver is enabled and calls
  its stub, which refuses once on the notice line; a control is disabled only for a reason in the app itself (Rescan
  while that folder scans, Create with a blank name, Clear history with no history), with that reason as its tooltip
  (`06` section 2, rule 3; family rule 16). A control whose behaviour is local (toggles, folds, sashes, selection,
  menus, popups, theme, accent, zoom, keys, navigation between surfaces) works fully.
- **Ephemeral surface state is local.** Selection, search text and filter values of a surface live in component
  state in phase 1. Folded sections, the preferences, the shared marks (favourites, memberships) and the
  cross-surface requests (`requestPlay`, `requestLibrary`, `openCollections`) are the store's (`02` section 2.1).
  Phase 2 moves what it must into the store (`22` section 4).
- **Owner decisions in force:**
  - one worker per surface (seven workers, section 4), at the owner's direction (`07` section 6.1, as amended);
  - each worker works in its own worktree and branch (`07` section 6.2 and 6.3);
  - the coordinator lands every branch, runs the checks and reviews each surface in the browser (`07` section 6.5);
  - Add to collection is the family's `Collections ▸` submenu, not a popup (section 2.3).
- **Defaults taken where the owner has not answered** (section 8).

### 2.1 Family sources checked

| Source | What it settles for Giga Stream |
|---|---|
| Giga Images, `src/frontend/src` (`lib/menu.ts`, `types/menu.ts`, `hooks/useContextMenu.ts`, `components/ui/ContextMenu*.tsx`, `hooks/useCardMenu.ts`) and `docs/frontend/00`, "Context menu actions" | the one context menu, summoned by `openMenu` and rendered by the shell. Collection membership is a `Collections ▸` submenu with check marks, toggled inline with no dialog. Ported in section 4.1 |
| Giga LoRA Studio, `docs/03`, "Frontend Rules — surfaces, panes, and popups" (locked 2026-09-04), and `docs/04` | Radix menus are the library for menus (confirms the `01` section 2 amendment). The only floating UI is a menu or option popover anchored to its opener. A confirmation is an inline two-step. Disabled controls say why. Its own `src/frontend/src/components/ui/ContextMenu*` files are the same as Giga Images' |
| Giga Cut Rust, `crates/ui/src/popup_contract.rs` and `crates/ui/src/state/popup/kind.rs` | the authored popup standard that `01` section 9 and `06` section 4.4 use: compact 242, standard 460, wide 602, with the draft, live and operation policies. One popup open at a time. Title information is a live, wide authored popup of this standard |

Where the two families differ: Giga Images and Giga LoRA allow only menus as floating UI, while Giga Cut allows
authored popups. The owner decided Title information is a work window (section 8, question 5), so Giga Stream
uses neither family's popup for it. It follows Giga Images for membership, which is the family's answer for
collections. Also, Giga LoRA's skeleton rule allows a one-line reason as the empty state. Giga Stream's `06` section 2
forbids text over a skeleton, so Giga Stream keeps its own rule.

## 2. Amendments made with this document

These spec changes are made first, so the code follows them (`07` section 2). Each is already applied in its file.

| File | Change | Why |
|---|---|---|
| `01` section 2 | adds the context-menu library, `@radix-ui/react-dropdown-menu` pinned at `2.1.24` | the family's menu needs a one-level submenu, which Radix provides; `01` says a locked dependency changes only after the doc does |
| `04` section 2 | Add to collection becomes the `Collections ▸` submenu, opened from a card's menu, Title information's Collections button or the Player's Watch block | the family has no membership popup |
| `06` section 4.2 | the card's context menu lists `Collections ▸` in place of "Add to collection" | family standard |
| `06` section 4.4 | the action strip's button is **Collections**; a collection toggled from it applies at once | family standard |
| `06` section 4.5 | the popup is replaced by the submenu, which is the app's one context menu | family standard; no new overlay type |
| `06` section 5.4 | the Watch block's button is **Collections** | family standard |
| `06` section 9 | `ContextMenu` added to the building blocks | the one menu, summoned by `openMenu` |

**No new overlay type.** `OverlayId` stays `settings`, `collections` and `title-info`. The context menu is not an
overlay: it is the family's menu host, mounted by the shell and summoned over the bus (`01` section 9 allows "a menu
or select for a choice"; `02` section 5 is unchanged).

## 3. What each surface must build

Each row is a control or behaviour missing from, or only a placeholder in, the template. `06` numbers are the spec.

### 3.1 Shell (titlebar, statusbar, panes, keys, menu host)

| Item | Spec | State in template |
|---|---|---|
| The one context menu host mounted by the shell, rendering `menu:open` requests | `01` section 9; family `AppShell` | missing |
| Pane collapse below 1000 px work width: the right pane collapses first, then the left; the centre never does | `06` 1.3 | missing |
| Statusbar notice line shows a sentence from any outcome | `06` 1.2 | slot exists; `say()` has no caller |
| Statusbar connection word and dot, with the sentence as tooltip | `06` 1.2 | fixture `ready` (preview) |
| `Ctrl+0` resets zoom; zoom applies to the whole interface | `06` 8, `03` 3.2 | key missing; `uiZoom` in the store |
| `Ctrl+F` focuses the active surface's search (the element with `data-search` inside the active page) | `06` 8 | missing |
| Titlebar, surface switch, pane toggles, brand, window controls (native overlay) | `06` 1.1 | done |

### 3.2 Live (`06` section 3)

| Item | Spec | State in template |
|---|---|---|
| Player stage: `<video>` fills the stage, fitted whole; always on the stage; loading shows the player alone | `06` 3.1 | placeholder |
| Failed note over the picture: icon, title, one sentence, Retry; disabled in phase 1 | `06` 3.1 | missing |
| No-channels note with `Refresh channels`, disabled in phase 1 | `06` 3.1 | missing |
| Channels heading with `Channels`, the total, and a Refresh icon | `06` 3.2 | missing |
| Search field with a clear control; category select with counts, All first | `06` 3.2 | missing |
| Channel rows: 56 px 4:3 logo or glyph, number, name on one line, status dot with category, playing marker, selected bar | `06` 3.2 | missing |
| Skeleton rows, at least 14, for loading and empty | `06` 3.2 | missing |
| Details section: name, category, number, revision; a dash when nothing is selected | `06` 3.2 | missing |
| Up, Down, Home and End move the selection; Enter selects (plays in phase 2) | `06` 3.2, `02` 3.2 | missing |
| Playback settings: five collapsible sections (Video, Display, Audio, Captions, Playback), each row a mono label beside its control | `06` 3.3 | placeholder |
| Fit, Fill, Original always usable | `06` 3.3 | missing |
| Disabled rows show their reason as a tooltip, with the reasons of `06` 3.3 | `06` 3.3 | missing |

### 3.3 Library (`06` section 4)

| Item | Spec | State in template |
|---|---|---|
| Views section: All, History, Favorites, with counts | `06` 4.1 | missing |
| Collections section: every collection, alphabetical; scan dot; context menu Rename and Remove (two-step) | `06` 4.1 | missing |
| Type strip: All, Movies, TV, Local, equal segments | `06` 4.2 | missing |
| Continue Watching strip (drawn only with progress), up to 10 cards with Play and Info | `06` 4.2 | missing |
| Poster grid: cards at least 144 px, 2:3, with favourite mark, quality (real value only), progress bar, watched check, Play, Info | `06` 4.2 | missing |
| Card context menu: Play or Open, Info, Favorite or Unfavorite, `Collections ▸` | `06` 4.2 | missing |
| List view with the same commands | `06` 4.2 | missing |
| History strip with two-step `Clear history` (second press within four seconds) | `06` 4.2 | missing |
| Loading and empty: 12 card skeletons (10 row skeletons in the list) | `06` 4.2 | missing |
| Filters: Search, View (Grid / List), Sort (Newest, Oldest, A to Z, Year; Trending hidden in phase 1), Genre popover with chips, Year select, Watched select, Clear filters | `06` 4.3 | placeholder |
| Title information work window (`06` 4.4): a modal child window with the frame of `02` section 5, header with X, 180 px artwork, identity, plot, cast chips, runtime or seasons, watch block, action strip (Favorite, Collections, Play or Open in Player) | `06` 4.4 | placeholder reading `Not loaded yet` |
| `Collections ▸` submenu (`06` 4.5): every collection, check mark for membership, a click toggles membership inline | `06` 4.5 | missing |

### 3.3a Library's family alignment: Giga LoRA's gallery

The owner asked for Library to be similar to Giga LoRA's gallery. Its source is `D:\Projects\giga-lora-studio\src\frontend\src`
(`components/ui/NavRail.tsx`, `components/media/HandoffStrip.tsx`, `components/media/MediaGrid.tsx`,
`components/gallery/ImageFilters.tsx`, `components/layout/WorkspaceSplit.tsx`). Items below are adopted where `06`
section 4 allows them. Items in the second list need the owner's decision first (section 8, questions 6 and 7).

**Adopted now:**

| Item | Giga LoRA | Giga Stream |
|---|---|---|
| Left rail rows | 32 px tall, 13 px text, a 2 px accent bar on the selected row | the same: LoRA's `NavRail`, `NavGroup` and `NavItem`, copied (`23`) |
| Centre strip | the flex-none strip with a bottom border (`HandoffStrip.tsx`) above the scroll area | the type strip sits in it (`06` section 4.2, "the shared strip surface") |
| Grid | `repeat(auto-fill, minmax(…px, 1fr))`, gap 12, padding 12 | `minmax(144px, 1fr)`, gap 12, padding 12; six to eight across at 1600 px, as `06` section 4.2 requires |
| Tile controls | shown on hover and on focus | Play and Info shown on hover and on keyboard focus, never hover alone (`06` section 4.2) |
| Right pane | each control a bold label over a 36 px field | the same (`06` section 4.3) |
| Clear filters | ghost, disabled while every filter is at its default | the same (`06` section 4.3) |
| Menus | `openMenu` at the pointer, Radix rows, a disabled row keeps its reason | the same (section 4.1) |
| Skeletons | `SkeletonCards` and `SkeletonRows` for loading and empty | the same, with the card drawn 2:3 (see question 6) |

**Owner decisions (section 8):**

| Item | Giga LoRA | Giga Stream spec | Recommendation |
|---|---|---|---|
| Card shape | square picture | 2:3 poster (`06` section 4.2) | keep 2:3; a movie poster is not square |
| Tile size | a slider, 120 to 320 | "There is no tile-size slider" (`06` section 4.3) | keep the spec; the grid already fills the width |
| Selection | multi-select with keep and reject decisions, and a selection bar | one primary selection per pane (`06` section 2, rule 5) | keep the spec; Library browses, it does not curate |
| Empty and error | a one-line sentence, and a silent failure | skeletons only, and a failure keeps the last cards with one notice (`06` sections 2 and 4.2) | keep the spec |
| Albums grouped by day | yes | not in `06` section 4 | leave out |
| Rail width | 220 px | 288 px (`02` section 1.3) | keep the spec |

**Known differences in LoRA's own source**, recorded so they are not copied: its rail comments describe a Captions
view that the code no longer has; its doc 06 says the bottom pane is used on Crop only, and its table gives the
tools surface a bottom rail; and its delete in the context menu fires with no two-step.

### 3.4 Player (`06` section 5)

| Item | Spec | State in template |
|---|---|---|
| Tabs above the stage: glyph or poster, title, close; one per movie, series, or local file; at most 12 | `06` 5.1 | missing |
| Tab context menu: Close, Close others, Reveal in Library | `06` 5.1 | missing |
| Episode browser (left): series header with title, season select; episode rows (still, `E1`, title, duration, watch marker); movie chapter; local-file facts | `06` 5.2 | placeholder |
| Stage toolbar: media kind icon, title with episode or file name; icon buttons Retry, Reveal in Library, Fullscreen | `06` 5.3 | missing |
| Stage: `<video>` with the browser's controls; the failed note; no tab open means the player alone with nothing over it | `06` 5.3 | placeholder |
| Resume banner above the control bar: Resume and Start over (disabled in phase 1) | `06` 5.3 | missing |
| Inspector (right): Overview (poster, identity, plot, rating, genres), Details (genres, cast, runtime or seasons, local file facts), Watch (progress, Favorite, collections, Collections button, Remove from History) | `06` 5.4 | placeholder |
| Related band (bottom): toolbar `Related`, its basis, collapse toggle; 2:3 cards, at most 20; 8 skeletons; local files collapsed with the reason | `06` 5.5 | placeholder |

### 3.3c Library's Rows view (owner decision, 2026-10-16)

The Library gets a third presentation, Rows, beside Grid (the default) and List. The spec is `06` section 4.2, "Rows", and
its wiring is `22` section 3.3. Rows shows the same cards as the grid, grouped into shelves:

| Shelf | Source | Shown when |
|---|---|---|
| Continue Watching | the continue answer, as the grid's strip | there is progress |
| Favorites | the favourites of the store's marks | there is at least one |
| Each collection, alphabetical | the collections rail | the collection has items |
| Movies, TV, Local files | the kinds of the library items | the kind has items |
| Up to six genres | the facets, with at least three items each | the genre has three or more |

Each shelf has a heading with its count and a **See all** that opens the grid with the group applied. A row scrolls
sideways with chevrons at its edges, and keeps the grid's keys within a row. Its cards are the grid's `PosterCard`, and its
Continue Watching cards are the Continue cards. Netflix's rows are the model: horizontal shelves with headings, and cards at
the grid's size. A shelf is a presentation of the grid's query, so no shelf adds a request of its own in phase 1.

The grouping is a pure function in `lib/rows-shelves.ts`, tested under `test/rows-shelves.test.ts`. It is the one piece with
logic, so it carries the tests.

### 3.4a Player's family alignment: Giga Cut's studio

The owner asked for the studio, which is Player, to be similar to Giga Cut. Cut's studio is egui (Rust), so the
source for rules and copy is `docs/06` of Giga Cut's TypeScript app (`D:\Projects\giga-cut\docs\06-PAGES-AND-PANES.md`),
and the Rust panels are the reference for behaviour (`D:\Projects\giga-cut-rust\crates\ui\src\panels\`). Items below
are adopted where `06` section 5 allows them. Items in the second list need the owner's decision (section 8).

**Adopted now:**

| Item | Giga Cut | Giga Stream |
|---|---|---|
| Layout | the row is browser | viewer | inspector, and the timeline is a sibling of the whole row | the same: episode browser | stage | inspector, with the related band a sibling of the row (`02` section 1.3) |
| Stage | the frame keeps its aspect and is contain-fitted inside a 16 px pad, in a scroll area | the picture fitted whole, with a 16 px pad (`06` section 3.1) |
| Stage toolbar | left: a kind readout; centre: the title, with the name beneath; right: icon actions | left: the media kind icon; centre: the title and the episode or file name; right: Retry, Reveal in Library, Fullscreen (`06` section 5.3) |
| Fullscreen | the viewer is repainted over the whole screen; the same button or Escape returns | `F` and the Fullscreen button, as `06` section 8 |
| Inspector group | a folding header with a triangle, the title, and the info glyph; the state is kept by id | superseded by `23`: LoRA's `Section` (a turning chevron and the title; the fold kept by id in the store) |
| Inspector row | a label, a control, and a tooltip for the reason when the row cannot be used; the row dims | superseded by `23`: LoRA's rail row (`NumberField`'s `FIELD_ROW` and `FIELD_LABEL`), dimmed with its reason as the tooltip |
| Read-only fact | a label and a mono value, with no control | the Details block's facts, as `06` section 5.4 |
| Refused menu rows | listed and off, with the reason on the row | the same, for the tab menu and the card menu (`06` section 2, rule 3) |
| Popups | the Compact, Standard and Wide classes and the Draft, Live and Operation policies | the same classes; no popup is in use until one is decided (section 8, question 5 decided: Title information is a work window) |
| Loading | skeleton blocks with a sweep, and a static gradient under reduced motion | `SHIMMER` already gives a sweep; the reduced-motion case follows `02` section 6 |

**Owner decisions (section 8):**

| Item | Giga Cut | Giga Stream spec | Recommendation |
|---|---|---|---|
| Transport | a custom Play, timecode and rate bar | the browser's own controls; a custom control bar is a later phase (`06` section 3.1, 5.3) | keep the browser's controls |
| Inspector content | tabs: Video, Color, Audio, Info | three blocks: Overview, Details, Watch (`06` section 5.4) | keep the blocks; the fold and rows come from Cut |
| Empty text | "No color corrections are applied." and a placeholder stage | no sentence over a skeleton (`06` section 2, rule 1) | keep the spec |
| Related band | none in Cut; the browser's footer bar is the nearest | a band across the bottom of the work (`06` section 5.5) | keep the spec |
| Browser | a tree of Media, Folders, Keywords and Collections | the episode browser, with a season select and episode rows (`06` section 5.2) | keep the spec |

**Known differences in Cut's own source**, recorded so they are not copied: its tree and palette limits disagree
between `06` and the Rust constants; its `06` says the Index opens by default, and the code keeps it closed; its `06`
says tables show skeletons, and the table code never does; and its inspector tab list in `06` omits Color.

### 3.5 Settings window (`06` section 6.2)

| Item | Spec | State in template |
|---|---|---|
| Five sections: Appearance, Playback, Library, Admin backend, About | `06` 6.2 | rail done; bodies placeholder |
| Appearance: Theme, Reduce motion, Accent, UI zoom (0.5 to 3, a stepper; `Ctrl+0` resets) | `06` 6.2 | UI zoom missing |
| Playback: Autoplay (switch), Subtitle language (select) | `06` 6.2 | disabled placeholder rows |
| Library: Default view (Grid / List), Collections (opens the Collections window), Open History (closes Settings and selects History) | `06` 6.2 | disabled placeholder rows |
| Admin backend: Address (text field, disabled, no value in phase 1), State (connected or not, revision, when read, error) | `06` 6.2 | disabled placeholder rows |
| About: version and build, runtime mode, licences, TMDB logo and notice | `06` 6.2, `11` section 6 | disabled placeholder rows |
| A row: label in a 252 px column with its info glyph, 24 px control; under about 420 px the label stacks | `06` 6.1 | missing |

### 3.6 Collections window (`06` section 6.3)

| Item | Spec | State in template |
|---|---|---|
| New collection group: name field and `Create` at the last row (disabled in phase 1) | `06` 6.3 | disabled placeholder |
| Collections table: name, counts, scan state; selecting a row shows its detail | `06` 6.3 | table with no rows |
| Detail: name, members table (image, title, year, remove), folders table (name, indexed count, scan state, last scan; Replace, Rescan, Cancel scan, Remove), Attach folder | `06` 6.3 | missing |
| Rename at the last row; two-step Remove collection that states `Original files remain untouched.` | `06` 6.3, `04` 5 | missing |

### 3.7 Events drawer (`06` section 7)

| Item | Spec | State in template |
|---|---|---|
| 160 px band above the statusbar; header with `Events`, the row count, a severity filter, Clear, close | `06` 7 | placeholder (190 px, shimmer lines) |
| Rows: time, tone icon, area (Connection, Catalog, Scan, Media, Playback), sentence, optional identity | `06` 7 | missing |
| At most 200 rows; Clear empties the list only | `06` 7 | missing |

## 4. Shared parts (Wave 0, coordinator)

Built by the coordinator and committed to the baseline before any worker is briefed (`07` section 6.2 and the
worktree rule). Surfaces read these files but do not edit them. A surface that needs a change to a shared part
asks the coordinator, who makes it on the baseline branch.

### 4.1 Ported from the family's menu (near-verbatim, `07` section 2)

Source: `D:\Projects\giga-images\src\frontend\src`. Token names are the same family tokens; each file is copied and
changed only where Giga Stream's `index.css` lacks a name it uses.

| Action | File | From |
|---|---|---|
| Create | `src/frontend/src/lib/bus.ts` | `lib/bus.ts`: `on` and `emit` only; the events ring is the Events owner's concern and is not ported here |
| Create | `src/frontend/src/lib/menu.ts` | `lib/menu.ts`: `openMenu` |
| Create | `src/frontend/src/types/menu.ts` | `types/menu.ts`: `MenuItem`, `MenuRow`, `MenuAnchor` |
| Create | `src/frontend/src/hooks/useContextMenu.ts` | `hooks/useContextMenu.ts` |
| Create | `src/frontend/src/components/ui/ContextMenu.tsx` | `components/ui/ContextMenu.tsx` |
| Create | `src/frontend/src/components/ui/ContextMenuRow.tsx` | `components/ui/ContextMenuRow.tsx` (`MENU_PANEL` and the row styles) |
| Create | `src/frontend/src/components/ui/ContextMenuSubmenu.tsx` | `components/ui/ContextMenuSubmenu.tsx` |
| Update | `package.json` | `"@radix-ui/react-dropdown-menu": "2.1.24"`, pinned exactly; `npm install` in `src/frontend` updates `package-lock.json` |

Before the install, `npm view @radix-ui/react-dropdown-menu@2.1.24 time` confirms the version is at least two weeks old
(`07` section 4 and the family rule). If it is not, the coordinator records the newest eligible version here first.

### 4.2 New shared parts for Giga Stream

| Action | File | Purpose |
|---|---|---|
| Create | `src/frontend/src/lib/collection-menu.ts` | pure: `collectionMenuRows(collections, isMember, toggle): MenuRow[]`, the `Collections ▸` submenu's rows; with no collection, one disabled row with its reason |
| Retired (`23`) | `SelectField.tsx` | replaced by LoRA's `Field` `Select` with `<option>`s |
| Retired (`23`) | `Switch.tsx` | replaced by LoRA's `Toggle` |
| Retired (`23`) | `RailSection.tsx` | replaced by LoRA's `Section` (controlled; the fold is the store's `folded[id]`) |
| Retired (`23`) | `RailRow.tsx` | replaced by LoRA's `NavItem` (navigation) and the rail row of `NumberField` (settings) |
| Retired (`23`) | `Skeleton.tsx` | replaced by `SHIMMER` from LoRA's `SkeletonRows` or `SkeletonCards` |
| Copied (`23`) | `src/frontend/src/components/ui/SkeletonRows.tsx` | LoRA's, verbatim: rows in the queue row's shape |
| Copied (`23`) | `src/frontend/src/components/ui/SkeletonCards.tsx` | LoRA's, verbatim, with `ThumbnailRailSkeleton` for the related band |
| Create | `src/frontend/src/components/ui/PosterImage.tsx` | 2:3 image box; the fallback glyph when no image is given |
| Create | `src/frontend/src/components/ui/LogoImage.tsx` | 4:3 logo box; a shimmer while loading and a glyph when none |
| Create | `src/frontend/src/components/overlays/TitleInfoWindow.tsx` | the Title information work window of `06` 4.4, on the `ChildWindow` frame, reading its item from the store |
| Update | `src/frontend/src/components/overlays/OverlayHost.tsx` | mounts `TitleInfoWindow` in the work-window slot for `title-info`; still one open flow |
| Update | `src/frontend/src/constants/popups.ts` | `title-info` leaves the popup set; the popup set is empty until a popup is decided |
| Update | `src/frontend/src/store/app-store.ts` | `uiZoom` (default 1), `setZoom` (clamped 0.5 to 3), `overlayItem`, and `openOverlay(id, anchor?, item?)` |
| Update | `src/frontend/src/types/collection.ts` | `CollectionFolder` (`03` 3.8, `06` 6.3) |
| Create | `src/frontend/src/types/events.ts` | `EventRow` and `EventArea` (`06` 7) |
| Create | `src/frontend/src/fixtures/channels.ts` | the four test channels of `10` and fourteen or more other rows; categories with counts |
| Create | `src/frontend/src/fixtures/titles.ts` | library items (movies, series, local files, progress, favourites), title details, a series' episodes, related titles |
| Create | `src/frontend/src/fixtures/collections.ts` | Views and collections with counts, members, folders and a membership map |
| Create | `src/frontend/src/fixtures/player.ts` | Player tabs and the stage state of each |
| Create | `src/frontend/src/fixtures/events.ts` | event rows of each area and tone |
| Create | `src/frontend/src/fixtures/settings.ts` | settings values for the look; the Address field has no value |
| Keep | `src/frontend/src/fixtures/connection.ts` | the preview connection word |

**Mounted by the shell (Shell owner, `components/chrome/AppShell.tsx`):** `useContextMenu()`, and
`{menu !== null && <ContextMenu anchor={menu.anchor} items={menu.items} onClose={close} />}`, as the family's
`AppShell` does.

**Wave 0 is done** when the baseline passes the checks in section 6, and every shared part renders in one scratch
view that is looked at and removed before the baseline commit.

## 5. The owner of each path

Seven owners, one per surface. An owner edits only its listed paths. A path listed for nobody is not edited.

| Owner | Edits |
|---|---|
| Shell | `components/chrome/` (except `EventsDrawer.tsx`, `EventRow.tsx`), `hooks/useShellKeyboard.ts`, `hooks/useWorkspaceSplit.ts`, `hooks/usePaneTween.ts`, `styles/workspace.css` |
| Live | `components/live/`, `pages/LivePage.tsx` |
| Library | `components/library/` (except `CollectionsFooter.tsx`, which keeps its behaviour), `components/overlays/TitleInfoWindow.tsx`, `pages/LibraryPage.tsx` |
| Player | `components/player/`, `pages/PlayerPage.tsx`, and the Player entry of `constants/surfaces.ts` only (the LoRA Studio geometry of section 9) |
| Settings | `components/overlays/SettingsWindow.tsx`, `components/settings/`, `constants/settings-sections.ts` |
| Collections | `components/overlays/CollectionsWindow.tsx`, `components/collections/` |
| Events | `components/chrome/EventsDrawer.tsx`, `components/chrome/EventRow.tsx` |
| Rows | `components/library/rows/` (new), `lib/rows-*.ts`, `test/rows-*.test.ts`, and the Rows option of the view switch in `pages/LibraryPage.tsx` only |

An owner may add pure helpers under `src/frontend/src/lib/`, named with its surface prefix (`live-`, `library-`,
`player-`, `settings-`, `collections-`, `events-`), and never a shared name. Fixtures and every shared part are read-only.
Each owner adds tests for its pure logic under `src/frontend/test/`, named for the surface (for example
`test/live-channel-filter.test.ts`). The owner writes them and does not run them (`07` section 6.3).

### 5.1 Shell

- **Creates:** nothing; it mounts the menu host from section 4.
- **Updates:** `components/chrome/AppShell.tsx` (mounts `useContextMenu` and `ContextMenu`; applies `uiZoom` to the
  document); `hooks/useWorkspaceSplit.ts` (the 1000 px collapse, right then left); `hooks/useShellKeyboard.ts`
  (`Ctrl+0` calls `setZoom(1)`; `Ctrl+F` focuses `[data-search]` in the active page); `components/chrome/Statusbar.tsx`
  (the notice line shows `say()` sentences; the connection word stays a fixture).
- **Read first:** `docs/02` 1.3, 6; `docs/04` 1, 5; `docs/06` 1, 8; the family's `AppShell.tsx`, `useContextMenu.ts`.
- **Out of scope:** surface contents and the Events drawer.

### 5.2 Live

- **Creates:** `components/live/LivePlayer.tsx` (the stage's `<video>`, always rendered), `StreamNote.tsx`,
  `NoChannelsNote.tsx`, `ChannelSearch.tsx`, `ChannelList.tsx`, `ChannelRow.tsx`, `ChannelDetails.tsx`,
  `PlaybackPane.tsx`, `PlaybackSection.tsx`, `PlaybackRow.tsx`.
- **Updates:** `pages/LivePage.tsx`; `components/live/LiveStage.tsx`, `LiveChannelsPane.tsx`, `LiveSettingsPane.tsx`.
- **Read first:** `docs/06` 3, 2, 9; `docs/02` 3; `docs/05` 3.
- **Phase 1 behaviour:** Up, Down, Home and End move the selection; a click or Enter selects a row and shows it as
  playing in the marker, with no stream. Refresh and Retry are disabled with their reasons.

### 5.3 Library

- **Creates:** `components/library/ViewsSection.tsx`, `CollectionsSection.tsx`, `TypeStrip.tsx`,
  `ContinueStrip.tsx`, `ContinueCard.tsx`, `PosterCard.tsx`, `PosterGrid.tsx`, `PosterList.tsx`, `HistoryStrip.tsx`,
  `CardMenu.ts` (the card's context-menu rows, built with `openMenu` from `lib/menu.ts`), `GenrePopover.tsx`.
- **Updates:** `pages/LibraryPage.tsx`; `components/library/LibraryRail.tsx`, `LibraryBody.tsx`,
  `LibraryFilters.tsx`.
- **Read first:** `docs/06` 4, 2, 9; `docs/02` 3, 5; `docs/04` 2, 5; the family's `hooks/useCardMenu.ts`; Giga LoRA's
  `components/ui/NavRail.tsx`, `components/media/HandoffStrip.tsx`, `components/media/MediaGrid.tsx`,
  `components/gallery/ImageFilters.tsx` (section 3.3a).
- **Phase 1 behaviour:** the card's context menu opens on right-click and on its menu button, with
  `Collections ▸` built by `collectionMenuRows`; a click toggles the check mark in the fixture only (local, as the
  look); View toggles Grid and List locally; Sort and filters narrow the fixture list; Info opens the Title information work window;
  Clear history arms and disarms. Play and Favourite are disabled with reasons.

### 5.4 Player

- **Creates:** `components/player/PlayerTabs.tsx`, `PlayerTab.tsx`, `EpisodeBrowser.tsx`, `EpisodeRow.tsx`,
  `StageToolbar.tsx`, `ResumeBanner.tsx`, `InspectorOverview.tsx`, `InspectorDetails.tsx`, `InspectorWatch.tsx`,
  `RelatedCard.tsx`.
- **Updates:** `pages/PlayerPage.tsx`; `components/player/PlayerStage.tsx`, `PlayerBrowser.tsx`,
  `PlayerInspector.tsx`, `PlayerRelated.tsx`.
- **Read first:** `docs/06` 5, 2, 9; `docs/02` 3.1, 4; `docs/05` 4; Giga Cut's `docs/06` (TypeScript app) and the Rust
  panels `panels/inspector/{group,row,fact,cells}.rs`, `panels/viewer/{topbar,stage}.rs`,
  `popups/host.rs`, `popup_contract.rs` (section 3.4a).
- **Phase 1 behaviour:** tabs open from fixtures and switch locally; closing and reopening works; episode rows select
  locally with the exact-episode marker and load nothing; the Watch block's **Collections** button opens the same
  `Collections ▸` menu, anchored to the button through `openMenu`; Resume and Retry are disabled.

### 5.5 Settings

- **Creates:** `components/settings/ZoomStepper.tsx`, `SettingsRow.tsx`, `PlaybackSection.tsx`, `LibrarySection.tsx`,
  `AdminBackendSection.tsx`, `AboutSection.tsx`.
- **Updates:** `components/overlays/SettingsWindow.tsx`; `components/settings/SettingsRail.tsx`,
  `AppearanceSection.tsx` (adds UI zoom); `constants/settings-sections.ts` (five sections, no pending copy).
- **Deletes:** `components/settings/PendingSection.tsx`.
- **Read first:** `docs/06` 6.1, 6.2; `docs/02` 5; `docs/03` 3.2.
- **Phase 1 behaviour:** Theme, Reduce motion, Accent and UI zoom apply at once. Autoplay, Subtitle language and
  Default view are local. Collections opens the Collections window; Open History closes Settings and selects History.
  Address and State are disabled with reasons.

### 5.6 Collections

- **Creates:** `components/collections/CollectionDetail.tsx`, `CollectionMembers.tsx`, `CollectionFolders.tsx`,
  `CollectionRemove.tsx` (the two-step), `CollectionRename.tsx`.
- **Updates:** `components/overlays/CollectionsWindow.tsx`; `components/collections/CollectionsTable.tsx`,
  `CollectionCreateGroup.tsx`.
- **Read first:** `docs/06` 6.3, 2, 9; `docs/04` 2, 5; `docs/02` 5.
- **Phase 1 behaviour:** selecting a collection changes the detail locally; Rename edits the name in the look only;
  the two-step Remove arms and disarms; Attach folder and Create are disabled with reasons.

### 5.7 Events

- **Creates:** `components/chrome/EventRow.tsx`.
- **Updates:** `components/chrome/EventsDrawer.tsx`.
- **Read first:** `docs/06` 7, 2; `docs/02` 1.3.
- **Phase 1 behaviour:** the severity filter (a `Segmented`) filters the fixture rows locally; Clear empties the local
  list; the close control and `Escape` close the drawer.

## 6. Worktrees, branches and checks

**Baseline.** Wave 0 is committed to `phase1-look`, cut from `main`, before any worker is briefed (`07` section 6.2,
the worktree rule). The commit holds the copied `src/frontend`, the Vite change, the amendments in section 2 and the
Wave 0 files of section 4, with their own paths only. Nothing else lands on it except landings.

**Worktrees.** One per owner, cut from the baseline commit:

| Owner | Worktree | Branch |
|---|---|---|
| Shell | `D:\Projects\.giga-worktrees\p1-shell` | `phase1/shell` |
| Live | `D:\Projects\.giga-worktrees\p1-live` | `phase1/live` |
| Library | `D:\Projects\.giga-worktrees\p1-library` | `phase1/library` |
| Player | `D:\Projects\.giga-worktrees\p1-player` | `phase1/player` |
| Settings | `D:\Projects\.giga-worktrees\p1-settings` | `phase1/settings` |
| Collections | `D:\Projects\.giga-worktrees\p1-collections` | `phase1/collections` |
| Events | `D:\Projects\.giga-worktrees\p1-events` | `phase1/events` |
| Rows | `D:\Projects\.giga-worktrees\p1-rows` | `phase1/rows` |

Each owner runs `npm ci` in its own worktree's `src/frontend`, never in a tree whose app is running (`07` section 4).

**Landing order:** Events, Settings, Collections, Shell, Live, Library, Player. The first three touch no path another
owner edits. Shell touches only chrome and hooks. Live, Library and Player each own their folder. A conflict in a
shared path is a defect in an owner's brief and goes back to that owner.

**Each owner, before reporting** (`07` section 6.3): `npm ci`; `npm run typecheck`; `npm run lint`;
`node scripts/check-rules.mjs` from the repository root, every error fixed. Tests are written and not run. No server
is started and no browser is opened.

**The coordinator, at each landing** (`07` section 6.5):

1. Read the report as a claim, and read the diff.
2. Merge into `phase1-look`; run `npm run typecheck`, `npm run lint`, `npm test` and the rule checker in `src/frontend`.
3. Start the interface on a free port (not 5171, which is the owner's running app) and open the surface in the browser
   at `1600 x 1000` and the `900 x 640` minimum. Compare it with the reference in `docs/reference/` and with the
   surface before the landing.
4. A failure goes back to the same owner with the exact output.
5. Record what landed and what was looked at in the landing commit message.

## 7. Done when

Phase 1 is done when every row of section 3 is built or deliberately disabled with its reason; every landed branch
passes section 6; each surface has been reviewed by the owner, one checkpoint per surface; and the dead placeholders
(`components/chrome/PanePlaceholder.tsx`, `components/settings/PendingSection.tsx`, `constants/collections.ts`, the
Providers rows, and any popup for Add to collection) are gone, with a grep proving nothing imports them.

## 8. Open questions, decisions and defaults in force

**Decided by the owner:**

- **Title information is a work window** (`06` section 4.4), on the `ChildWindow` frame of `02` section 5, not a popup.
- **Cards are 2:3 posters**, with no tile-size slider.
- **Library selection is single**, and empty and error states are skeletons, as `06` section 2 says.
- **Player's inspector keeps the spec's blocks** (Overview, Details, Watch). Cut's fold, row and fact styling are used for them.
- **Player's geometry is Giga LoRA Studio's**: left 236, right 280, bottom 140 (clamps 190–380, 220–420, 60–280), with its
  centre floor kept at 520 so the stage holds video. `02` section 1.3 and `06` section 1.3 carry the new numbers.
- **Events drawer rows are network traffic**, from the probe in section 9.

**Still open or defaulted:**

1. **Posters and logos.** Default: fallback glyphs in phase 1, no stand-in images.
2. **Events drawer row shape.** Set by the probe (section 9) and `22` section 3.7.
3. **Provider stage (`06` 5.3).** Outside phase 1. Waits for the write-up from `14`.
4. **Radix pin.** Default: `2.1.24`, the version Giga Images runs, checked against the two-week rule in section 4.1.

## 8a. Visual sweep (2026-10-16) - retired

Retired on 2026-10-16 by `23`: type and motion come from the family's components and tokens, copied verbatim, not from
the scale below. The text is kept for the record only.

The owner's review found the surfaces inconsistent. This sweep sets one set of rules, and every surface meets them before
its phase 1 is signed off. The reference for the look is the family: Giga Images' Generate and Studio (sidebars, controls),
Giga LoRA Studio (the bottom rail, the grid), and Netflix's catalogue (the card and its buttons). The tokens are the family's.

**Type. One scale, used the same way everywhere:**

| Role | Face and size | Where |
|---|---|---|
| Section header | sans 11px semibold, faint; sentence case | every collapsible section (`Section`) |
| Control label | sans 12px, muted | the label beside a control (`Row`, `SettingsRow`) |
| Body text | sans 13px, text colour | descriptions, lists, names |
| Title on a poster | sans 15px semibold, text colour | the fallback poster |
| Value, count, timecode, identifier | mono 11px | values only; never a label |
| Hint or disabled text | sans 12px, dim | a disabled reason is a tooltip, not visible text |

No visible text is smaller than 11px. No mono text is used for a label or a header.

**Motion. Only the family's durations and eases, from `index.css` and `constants/timing.ts`:** 140 ms for hover, press
and colour changes (`duration-fade`); 200 ms for an entrance or a panel move (`duration-move`); 280 ms only for a full
page transition. The ease is `ease-linear` for colour and `ease-in` for entrances. Reduced motion turns every one of them
off. A card's hover lift is 2% over 140 ms. Nothing else moves on hover.

**Icons. The accent marks state, and nothing else.** An icon is `text-muted` by default and `text-accent-text` only when it
is on: a selected row, an on toggle, a playing channel, a favourite that is set. A decorative icon never takes the accent.

**Buttons on cards.** The card's controls are the family's round icon buttons (`IconButton`, bordered, 28 px), not
text buttons: a primary round Play, and round Info and menu buttons beside it. They sit in one row at the poster's
lower left, appear on hover and on keyboard focus, and never sit over the centre of the card. The menu button is at the
top right. No system or browser button look: the family's `Button` and `IconButton` only.

**Rails and bottom bands.** The Player's related band is a port of Giga LoRA Studio's bottom rail (`components/generate/
PastRuns.tsx` in `D:\Projects\giga-lora-studio`): the same panel ground, the same thumbnail frame, the same hover and
selected render, the same row scroll. The owner's review (2026-10-16) set the band to match the Studio's image: 140 px high, square thumbnails with no caption, the lowercase mono header with the count. The differences that stay are the spec's: eight card skeletons. Earlier, the band was 2:3 posters at 210 px high; that is retired. If a difference is found that is not on that list, it is a defect.

**Readability.** Text sits on the surface tokens at the scale above. Muted text is the secondary colour, dim is for
hints and disabled text only. A line never breaks a word; a long title is truncated with an ellipsis and its full text
in the tooltip.

## 9. Events and the provider embed (probe)

A read-only probe of `D:\Projects\giga-stream-poc\src\mockup` answered how the mockup embeds a provider's player and
logs traffic. Its findings:

- **The embed.** A sandboxed or unsandboxed iframe with a fixed `allow` list and `referrerPolicy` `origin`
  (`js\embed.js:23-27`, `js\config.js:10-11`). The mockup sends nothing to the embed, and accepts every window message
  without checking its origin (`js\messages.js:40-55`). A refused frame may still log as `ok`; this is untested.
- **What the page can see.** In a browser, nothing inside a cross-origin iframe: no requests, statuses or timings. In
  Electron, the repository reports only requests the ad blocker *blocks* (`src\fileserver\src\app\ad-blocker.ts`);
  allowed requests are not reported, and `session.webRequest` is not used.
- **What the interface can log truthfully.** Its own requests (the REST calls of `services/api.ts`, phase 2); the stream's
  HLS events (fragment loads, level switches, errors) for channels and test titles; the embed's load outcome; and, in
  Electron, the count and host of blocked requests.
- **The mockup logs full URLs.** `js\embed.js:39` and `:101` log whole addresses, which breaks `06` section 7's rule of
  no path, query or token. The drawer keeps host only.
- **The POC is incomplete.** `data\providers.json`, `js\core\fetch.js` and the Electron host files the notes cite are
  not in `giga-stream-poc\src\mockup`, so the providers' origins cannot be read from it.

The Events drawer is network traffic, as the owner expects. The row shape and the questions it raises are in `22`
section 3.7 and section 8.

## 10. Retired questions

Kept so the decision trail is visible:

- Title information as a popup, or a work window: decided, see above.
- Library's card shape, tile size, selection and empty states: decided, see above.
- Player's transport and inspector content: decided, see above.

1. **Posters and logos.** Default: fallback glyphs in phase 1, no stand-in images. The owner may replace them with a
   fixed set.
2. **Events drawer rows.** Default: fixture rows in phase 1. Their source is decided in `22` section 8.
3. **Provider stage (`06` 5.3).** Outside phase 1. Waits for the write-up from `14`.
4. **Radix pin.** Default: `2.1.24`, the version Giga Images runs, checked against the two-week rule in section 4.1.
5. **Title information as a popup.** Default: keep the authored popup (`06` section 4.4, Giga Cut's standard). Giga
   Images and Giga LoRA allow only menus as floating UI. If you want the family's menu-only rule here too, Title
   information becomes a work window, which `06` would need to say.
6. **Library's card shape and tile size.** LoRA draws square tiles with a size slider. The spec draws 2:3 posters with
   no slider. Recommendation: 2:3 posters, no slider (section 3.3a). Confirm or change.
7. **Library's selection and empty states.** LoRA allows multi-select with keep and reject decisions, and writes a
   sentence for empty and error states. The spec allows one primary selection, and skeletons only. Recommendation:
   the spec (section 3.3a). Confirm or change.
8. **Player's transport and inspector content.** Cut has a custom transport and four inspector tabs (Video, Color, Audio,
   Info). The spec has the browser's own controls and three inspector blocks (Overview, Details, Watch). Recommendation:
   the spec's controls and blocks, with Cut's fold, row and fact styling (section 3.4a). Confirm or change.
