# 25 - Visual Gaps and Remediation

**Status: done (2026-10-17), on branch `family-port`.** Every fix has landed and every record decision is written
into the specs; section 6 gives each finding's status and commit. An audit of every surface against the
family standard (Sensenova LoRA Trainer, Giga LoRA Studio, Giga Cut's button rules) and the owner's rulings,
driven in the browser at four widths. Frontend only. Each finding has a decision: **fix**, **record** (the
behaviour is an owner decision or a deliberate exception; the docs are corrected instead), or **defer**.

When every wave is done, the specs (`01`, `02`, `06`, `21`, `23`) are rewritten to describe the app as written
(section 4). The finding tables below keep each finding as it was planned; section 6 is what landed.

## 1. Findings

### 1.1 Shell

| Id | Finding | Decision | Files |
|---|---|---|---|
| VG-001 | A collapsed pane keeps its controls in the tab order | fix: `inert` on a closed pane | `components/chrome/WorkspaceSplit.tsx` |
| VG-002 | Ctrl+F focuses a search field inside a collapsed pane | fix: skip zero-size and inert fields | `hooks/useShellKeyboard.ts` |
| VG-003 | A pane collapsed by the width line never comes back; its notice stays | fix: an auto-collapse returns when the width does | `hooks/useWorkspaceSplit.ts` |
| VG-004 | The statusbar Settings door lights while the scrim covers it | fix: the door is not lit or pressed while a modal is up | `components/chrome/Statusbar.tsx` |
| VG-005 | The Events drawer is shimmer only: no rows, count, Clear | fix: a store event log fed by `say()`, rows, count, Clear | `components/chrome/EventsDrawer.tsx`, new `components/chrome/EventRow.tsx`, `store/app-store.ts`, `types/events.ts` |
| VG-006 | Warn notices are illegible on the light theme | fix: the notice text is `text-text` with a warn glyph | `components/chrome/Statusbar.tsx` |
| VG-007 | Arbitrary radii and spacing in `PageTabs` and `Brand` | record: they are the family brand and tabs, copied as drawn | none |

### 1.2 Live

| Id | Finding | Decision | Files |
|---|---|---|---|
| VG-010 | The selected channel row wears two left-edge strips | fix: selected is the fill; the strip is the status | `components/live/ChannelRow.tsx` |
| VG-011 | The playing marker "live" reads like the status word "Live" | fix: "Playing" | `lib/live-constants.ts` |
| VG-012 | Activating a channel calls nothing | fix: `rememberLastChannel` stub, refusal said | `hooks/useLiveActions.ts`, `pages/LivePage.tsx` |
| VG-013 | The channels head and search use another control height | fix: rail control height; the head stays LoRA's queue head (recorded) | `components/live/ChannelSearch.tsx` |
| VG-014 | Details heads with the name and repeats it | fix: the heading is "Details" | `components/live/ChannelDetails.tsx` |
| VG-015 | Readouts left-aligned on Live, right-aligned on Player | fix: one alignment (value at the row's right edge, as the rail facts) | `components/live/PlaybackRow.tsx` |
| VG-016 | Two stage-note designs | fix: Player's note matches Live's | `components/player/StageNote.tsx` |
| VG-017 | Growing sections leave blank space in short rails | record: the family accordion's grow model | none |

### 1.3 Library

| Id | Finding | Decision | Files |
|---|---|---|---|
| VG-020 | Rows ignores the rail source, type strip, search, sort and filters | fix: Rows takes the narrowed set; the type strip stays | `pages/LibraryPage.tsx`, `components/library/rows/LibraryRows.tsx`, `components/library/LibraryBody.tsx` |
| VG-021 | List thumbnails draw a crushed fallback title | fix: pass the poster; no fallback title in a small box | `components/library/PosterListRow.tsx`, `components/ui/PosterImage.tsx` |
| VG-022 | List-row verbs do not line up | fix: fixed-width Play/Open | `components/library/PosterListRow.tsx` |
| VG-023 | The Genre trigger is a raised button among fields | fix: it is drawn as a field | `components/library/GenrePopover.tsx` |
| VG-024 | Clear filters wipes the search and forces "newest" | fix: keeps the search; sort returns to the Default sort setting | `lib/library-query.ts`, `components/library/LibraryFilters.tsx` |
| VG-025 | Continue watching ignores the rail source; two orders | fix: one function takes the source and one order | `lib/library-query.ts`, `components/library/LibraryBody.tsx`, `lib/rows-shelves.ts` |
| VG-026 | Remove from History can never be used (no watch ids) | fix: fixture watch ids | `fixtures/titles.ts` |
| VG-027 | The collection menu's Rename and Remove are dead; Remove is danger at rest | fix: both open the Collections window on that collection | `components/library/rail-menu.ts`, `components/library/CollectionsSection.tsx`, `store/app-store.ts`, `components/overlays/CollectionsWindow.tsx` |
| VG-028 | Cards lack the title line, watched check and quality of `06` §4.2 | record: the owner chose LoRA's tile; the title is the tooltip | `docs/06` |
| VG-029 | Continue cards have no menu and do not select | fix: menu and selection | `components/library/ContinueCard.tsx`, `components/library/ContinueStrip.tsx`, `components/library/LibraryBody.tsx` |
| VG-030 | Five heading styles across surfaces | record: the mapping (section 3) | `docs/01` |
| VG-031 | Rows chevrons are raised in the body | record: over-art controls are an exception | `docs/01` |
| VG-032 | No glyphs in the rail | record: Sensenova's rail is text | `docs/06` |
| VG-033 | Three two-step patterns, three copies | fix: one `ArmedButton` with blur and Escape disarm; the copy names what dies | new `components/ui/ArmedButton.tsx` (Giga Stream's own), `components/library/HistoryStrip.tsx`, `components/settings/LibrarySection.tsx`, `components/collections/CollectionRows.tsx` |
| VG-034 | Remove from History is danger at rest in the stage menu | fix | `lib/player-stage-menu.ts` |
| VG-035 | A click opens Info, Enter only selects | fix: Enter opens Info | `components/library/card-keys.ts` |
| VG-063, VG-041 | Settings' Open History and the Player's Reveal in Library land on whatever source was set | fix: a library request in the store (source, item) | `store/app-store.ts`, `pages/LibraryPage.tsx`, `components/overlays/SettingsWindow.tsx`, `pages/PlayerPage.tsx` |
| VG-081 | No Library setting is read | fix: view and sort seed the page; Continue watching obeys its toggle; Default view offers Rows | `pages/LibraryPage.tsx`, `components/library/LibraryBody.tsx`, `lib/rows-shelves.ts`, `components/settings/LibrarySection.tsx`, `types/settings.ts` |

### 1.4 Player

| Id | Finding | Decision | Files |
|---|---|---|---|
| VG-040 | Reopening the item playing, and opening a series, still call `playItem`; choosing an episode calls nothing | fix | `pages/PlayerPage.tsx` |
| VG-042 | The movie row is a button that does nothing | fix: a static row | `components/player/EpisodeRow.tsx`, `components/player/PlayerBrowser.tsx` |
| VG-043 | A series opens on season 1, not the resumable one | fix | `lib/player-session.ts` |
| VG-044 | Favourite and membership in the Player do not use the shared marks | fix | `pages/PlayerPage.tsx`, `lib/player-view.ts` |
| VG-045 | Inspector sections each scroll | record: the owner asked for each section to scroll rather than squeeze | `docs/06` |
| VG-046 | A local file's Details is an empty half pane | fix: its facts | `components/player/InspectorDetails.tsx` |
| VG-047 | Right-click on the idle stage opens the browser's video menu | fix | `components/player/PlayerStage.tsx` |
| VG-048 | The stage turns white on the light theme (Player and Live) | fix: a theme-independent stage color | `index.css` (delta), `components/player/PlayerStage.tsx`, `components/live/LivePlayer.tsx`, `styles/video.css` |
| VG-049 | The label column is sized for labels that are gone | fix | `components/player/PlayerRow.tsx` |
| VG-050 | Genres are chips in the Player, text in Title information | fix: chips in both | `components/library/TitleInfoBody.tsx` |
| VG-051 | The related band is a listbox with no arrow keys | fix: a list of buttons | `components/player/PlayerRelated.tsx`, `components/player/RelatedCard.tsx` |
| VG-052 | The stage fixture is keyed so a failed stage can never show | fix | `fixtures/player.ts` |
| VG-062 | Title information stays open over the Player after Play | fix | `store/app-store.ts` |
| VG-080 | `pictureFit`, `resumeMode`, `liveOnOpen` are not read | fix: Player fit, the Resume footer obeys the mode, Live opens on the last channel; the stream preferences wait for streams (phase 2) | `components/player/PlayerStage.tsx`, `components/player/PlayerInspector.tsx`, `pages/LivePage.tsx` |

### 1.5 Windows

| Id | Finding | Decision | Files |
|---|---|---|---|
| VG-060 | Moving between the Collections index and a workspace drops focus to `body` and the modal swallows every key | fix: focus moves with the view; a key on `body` re-focuses the frame | `components/overlays/CollectionsWindow.tsx`, `hooks/useChildWindowKeys.ts` |
| VG-061 | `NavRail` is Sensenova's, unrecorded; `Section` and `motion-reduce.css` deltas unrecorded | record in `23` | `docs/23` |
| VG-064 | The Settings label column moves from section to section | fix: one column for the window | `components/overlays/SettingsWindow.tsx`, `components/settings/*Section.tsx` |
| VG-065 | Title information: 140 px poster, Actions floating mid-window, the one group foldable | fix: 180 px poster, Actions pinned, group not foldable | `components/overlays/TitleInfoWindow.tsx`, `components/library/TitleInfoBody.tsx` |
| VG-066 | Form group folds do not persist | defer: the family Form keeps them local | none |
| VG-067 | Collections index has no scan state; "Delete" vs the rail's "Remove" | fix: scan word in the row; "Remove"; layout recorded as Sensenova's | `components/collections/CollectionRows.tsx`, `docs/06` |
| VG-068 | Two table-header styles in one window | fix: the index header matches `DataTable` | `components/collections/CollectionRows.tsx` |
| VG-069 | "last scan" truncates | fix: a shorter date | `lib/collections-scan.ts` |
| VG-070 | "View licences" is disabled | fix: enabled, calls a stub | `components/settings/AboutSection.tsx`, `services/settings.ts` |
| VG-071 | A lit toggle in the body is edged | fix: tint and glyph only | `components/library/PosterListRow.tsx`, `components/overlays/TitleInfoWindow.tsx` |
| VG-072 | The Settings tabpanel is named by its id | fix | `components/overlays/SettingsWindow.tsx` |
| VG-082 | Setting changes do not call `saveSetting` | record: preferences apply at once and save in phase 2; a refusal on every click would drown the notice line | `docs/22` |

## 2. Remediation waves

Each wave ends with the gate (typecheck, lint, tests, rules) and a look in the browser, and is one commit.

1. **Shell and keyboard:** VG-001 to 006, VG-060, VG-062, VG-072.
2. **Library:** VG-020 to 027, 029, 033 to 035, 041, 063, 081.
3. **Player:** VG-040, 042 to 044, 046 to 052, 080.
4. **Live:** VG-010 to 016.
5. **Windows:** VG-064, 065, 067 to 071.
6. **Docs:** the record decisions, then section 4.

Deferred: VG-066, and the enhancements (section 7).

## 3. Heading styles in use (VG-030)

| Role | Style | Where |
|---|---|---|
| Page group | `Form` `Group`: 48px tile, mono 28 | Settings, Collections, Title information |
| Rail section | `Section` header: 11px sans semibold, faint, chevron | Live and Player rails |
| Rail group | `NavRail` heading: 12px sans, dim | Library rail |
| Strip or shelf | mono 12, faint, count dim | Continue watching, Rows shelves, Live channels head |
| Filter label | 14px sans semibold | Library filters pane |

## 4. Docs to the code

After wave 5, `01` §9, `02`, `06`, `21` and `23` are rewritten to the app as written: the standards actually
implemented, each exception with the case that forces it, and nothing that describes removed behaviour. Done in wave
6 (section 6).

## 5. Where each record decision is written

| Id | Written in |
|---|---|
| VG-007 | `01` section 9, Headings: the brand and the surface switch keep the family's radii and spacing |
| VG-017 | `06` section 2, rule 8: the accordion's grow model, and the space it leaves in a short rail |
| VG-028 | `06` section 4.2, Poster grid: LoRA's tile; the title is the tooltip |
| VG-030 | `01` section 9, Headings: the five heading roles (section 3 above) |
| VG-031 | `01` section 9, Buttons and surfaces: the over-art chevron exception |
| VG-032 | `06` section 4.1: Sensenova's rail is text, no glyphs |
| VG-045 | `06` section 5.4: each open block scrolls inside its share (owner) |
| VG-061 | `23` section 3.1: `NavRail` is Sensenova's build; the `Section`, `motion-reduce.css`, `ContextMenu` and `--color-stage` deltas |
| VG-082 | `06` section 6.2: preferences apply at once and save in phase 2; only the admin address saves now |

## 6. Status

| Wave | Commit | Findings fixed |
|---|---|---|
| 1. Shell and keyboard | `c7ec634` | VG-001, 002, 003, 004, 005, 006, 060, 062, 072 |
| 2. Library | `2b97573` | VG-020, 021, 022, 023, 024, 025, 026, 027, 029, 033, 034, 035, 041, 063, 081 |
| 3. Player | `964c8f4` | VG-016, 040, 042, 043, 044, 046, 047, 048, 049, 050, 051, 052, 080 (Player: Picture fit, the Resume footer) |
| 4. Live | `176872e` | VG-010, 011, 012, 013, 014, 015, 080 (Live: opens on the last channel) |
| 5. Windows | `0152287` | VG-064, 065, 067, 068, 069, 070, 071 |
| 6. Docs | `d6b4d0d` | VG-007, 017, 028, 030, 031, 032, 045, 061, 082 recorded (section 5); `01`, `02`, `06`, `21`, `23` rewritten to the app |

**Deferred:** VG-066 (form group folds are the family `Form`'s local state), and the enhancements of section 7.

**Deviations from the plan:**

- **VG-016** was planned for wave 4 (Live) and landed in wave 3: the Player's stage note was rebuilt on Live's
  `LiveNote` while the Player's stage was open for VG-047 and VG-048.
- **VG-067** planned "a scan word in the row" of the Collections index. It landed as the rail's shimmer count in the
  videos cell, with the partial count as its tooltip. Earlier in the same session the owner rejected a scan column on
  that index ("it sounds like a waste of space"), and a scan word would have brought it back in all but name; the
  shimmer count is the design the rail already uses, so the index and the rail say "scanning" the same way.
- **Found while verifying wave 2, fixed in it:** a context-menu row that opened a work window left the window deaf to
  Escape (the menu's focus trap and Radix's timed close-focus pulled focus back to the rail). The menu now runs a row's
  action after it closes (`01` section 9, `23` section 3.1). The History strip was also missing from the Rows view, and
  was added there.

## 7. Enhancements (deferred)

Grid density by pane width; real fixture posters to judge tile contrast; hug-content rail sections; the notice
fading to the Events log; one shared rail-row component; keyboard help; a per-row scan strip on the Collections
index.
