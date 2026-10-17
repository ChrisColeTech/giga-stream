# 28 - Admin Visual Parity Plan

**Status: PLAN, written 2026-10-17 beside the scaffold (`src/admin` cloned, the backend's Electron host built). Nothing in
this document is built yet.** It turns the cloned template into the admin app's look: every page of the admin mockup,
drawn from typed fixtures, with no network. The wiring to the backend is `29-ADMIN-BACKEND-WIRING-PLAN.md`. What the admin
is, its pages and its decisions are `26`; this document only plans how the clone gets there. Where this and `26`, `01` or
`07` disagree, those win and this is corrected first.

Governed by `00`, `01` (rules), `02` and `06` (the window and its chrome), `07` (protocol and delegation), `26` (the admin),
and `27` (the shared UI library the admin is built on; see section 3).

## 1. Goal and non-goals

**Goal.** `src/admin` renders, in the family's own components, every page the admin mockup
(`D:\Projects\giga-stream-poc\src\admin-mockup`) draws, to the pixel the coordinator can measure, at 1600 x 1000 and at the
900 x 640 minimum: the titlebar with its six-tab pill, the statusbar, the Events drawer, the Settings window, the sign-in
page, and for each of Channels, Providers, Titles, Playlists, Jobs and Accounts an index and a workspace (Channels has two
workspaces, live and stream). Every control either works against the fixtures or is visibly disabled with its reason as a
tooltip. The two-step delete, the toggles, the pickers, the folds, the rail sash, the theme, accent, motion and zoom all
work. In Electron the caption-button strip follows the theme.

**Non-goals.**
- No network: nothing calls the backend, `services/api.ts` does not exist yet (`29`). Data is fixtures.
- No new design. The mockup and the family frontend are the design; where they differ, section 5 says which wins.
- No timers that send requests, no browser storage, no polling (`01` 4.4). The one timer allowed is the fixture-load
  stand-in of section 8, deleted in `29`.
- No change to `src/frontend`. Pieces the admin needs that the frontend also has move to `src/shared/ui` under `27`'s steps,
  not into a copy.

## 2. Rules that hold

`AGENTS.md` and `01` bind every file: TypeScript strict, no `any`, `@ts-ignore` or double assertion; files at most 200
measured lines (tests 250); one exported component per file; `PascalCase.tsx`, hooks `useThing.ts`, everything else
kebab-case; no `utils`/`helpers`/`misc`/`common`; copy and numbers in named constants; one Zustand store. A control works or
is visibly disabled with its reason as a tooltip; no text under a control; loading and empty content are skeletons; state is a
word or an accent strip, never a dot; destructive actions are the inline `ArmedButton`; `alert`, `confirm` and `prompt` do
not exist. `07` binds the workers: edit with the editor tools one file at a time, write tests but do not run the suite, start
no program, open no browser, never edit a doc, commit without pushing.

## 3. The shared UI library and what this plan assumes of it

The owner's direction (2026-10-17): the admin is built on a shared UI library, not on a copy of the frontend's. `27` extracts
the family UI to `src/shared/ui` (source alias `@giga/ui/*`) and a React-free `src/shared/http`. The scaffold keeps the
template's own copies in `src/admin/src` so the app compiles today. This plan therefore works in two modes, and every wave
says which one it is in:

- **Copy mode.** The step of `27` that owns a piece has not landed. The worker uses the template copy in `src/admin`, leaves it
  where it is, and imports it by `@/...`.
- **Library mode.** The step has landed. The worker imports the piece from `@giga/ui/...` and deletes the template copy in the
  same commit (section 4.2 lists each file and the step that retires it). A piece the admin needs that the library lacks is
  built straight into `src/shared/ui` by the admin wave (section 4.3), never into `src/admin`.

The step numbers below are `27`'s section 5 (0 scaffold; 1 tokens, CSS, fonts; 2a controls, 2b form and tooltip, 2c skeletons
and lists; 3 small decouples; 4 shell chrome; 5 `http`; 6 chrome slice and events drawer; 7 windows; 8 pane engine; 9
admin-only pieces). `27` also fixes the dependency: **the admin does not wait for steps 6 to 8.** Its shell waves depend on
steps 0 to 4 and 9; until step 6 it keeps the eight chrome fields (theme, accent, motion, zoom, events, notice, overlay, fold)
in its own small store and swaps to the factory later; until step 8 its workspace rail is a width and a sash, not the pane
engine; its sign-in and wiring waves (`29`) depend on step 5. The library's folders are `styles`, `controls`, `form`, `lists`,
`shell`, `windows`, `menus`, `panes`, `hooks`, `lib`, `store` (`27` section 2), so imports read `@giga/ui/controls/Button`,
`@giga/ui/shell/Titlebar` and so on.

## 4. Inventory of the template (`src/admin/src` as cloned)

The template is the Giga Stream interface at phase 1 (`@giga/stream-frontend` before the rename): three surfaces (Live,
Library, Player), the Collections and Title windows, fixtures and refusing stubs. 267 files. Its shell is the admin's shell;
its content is not.

### 4.1 What is kept, replaced or removed

| Path (under `src/admin/`) | Disposition |
|---|---|
| `index.html`, `public/favicon.svg`, `vite.config.mts`, `tsconfig*.json`, `package.json` | **kept** as scaffolded (base `/admin/`, port 5172). `package.json` loses `hls.js` and `@radix-ui/react-dropdown-menu` when their last user goes (waves 1 and 5) |
| `src/main.tsx` | **kept** |
| `src/index.css`, `src/styles/*.css`, `src/assets/fonts/*` | **kept in copy mode; retired by step 1** (tokens, base, fonts, keyframes, reduced motion). `styles/video.css` and the video/stage tokens are **removed** (no player) |
| `src/components/chrome/App.tsx` | **kept**; mounts the same two hooks |
| `src/components/chrome/AppShell.tsx` | **rewritten**: titlebar, the six tab pages, the sign-in page, the events drawer, the statusbar, the overlay host. No context menu host |
| `src/components/chrome/Brand.tsx` | **changed**: the mono subtitle `ADMIN` beside the lockup (mockup `.brand .sub`) |
| `src/components/chrome/PageTabs.tsx` | **renamed `TabPill.tsx`**, six tabs, the interface's equal-width grid (`27` section 1; section 5, item 3) |
| `src/components/chrome/Titlebar.tsx` | **changed**: left toggle (disabled on an index, reason `This page has no left pane.`), brand, centred pill, Events toggle, right toggle disabled (`The admin has no right pane.`) |
| `src/components/chrome/Statusbar.tsx`, `RunningWork.tsx` | **changed**: `N preparing` / `N syncing` over a pulsing full bar, `Stop` always disabled with a reason (mockup `statusbar.js`) |
| `src/components/chrome/EventsDrawer.tsx`, `EventRow.tsx` | **changed**: the audit-style row (time, tone word, area, sentence), `Load older` row at the top, `N events` count; **retired to the library by step 6** |
| `src/components/chrome/WorkspaceSplit.tsx`, `hooks/useWorkspaceSplit.ts`, `hooks/usePaneTween.ts`, `lib/pane-collapse.ts`, `styles/workspace.css`, `types/panes.ts`, `test/shell-collapse.test.ts` | **removed** from the admin: its rail is a width and a sash (`RailSash.tsx`, `useRailWidth.ts`; `27` section 5, "the admin does not wait for step 8"). Step 8 moves the engine to the library for the interface; the admin may adopt it later, which is not part of this plan |
| `src/components/ui/*` (30 files) | **kept in copy mode; retired by steps 2a, 2b, 2c, 3** (section 4.2). `ContextMenu*`, `PosterImage`, `LogoImage` (if unused), `SliderField`, `NumberField`, `SplitList`, `ActionList`, `Section`, `Reveal` are **removed** with no admin user |
| `src/components/overlays/ChildWindow.tsx`, `ChildGrips.tsx`, `ChildScrim.tsx`, `OverlayHost.tsx`, `SettingsWindow.tsx` | **kept**, `OverlayHost` and `SettingsWindow` changed; the window frame **retired by step 7** |
| `src/components/overlays/CollectionsWindow.tsx`, `TitleInfoWindow.tsx` | **removed** |
| `src/components/settings/*` | `SettingsRail.tsx`, `AppearanceSection.tsx`, `ZoomStepper.tsx`, `AboutSection.tsx` **changed**; `AdminBackendSection.tsx`, `LibrarySection.tsx`, `PlaybackSection.tsx` **removed**; `SessionSection.tsx` **new** |
| `src/components/collections/*` | **removed** after their pattern is copied into the admin's own index/workspace files (section 6); `CollectionsIndex`, `CollectionWorkspace`, `NewCollectionForm`, `CollectionRows`, `FolderControls` are the references the Channels worker reads |
| `src/components/library/*`, `live/*`, `player/*`, `popups/*` | **removed** (demo content). `live/LivePlayer.tsx` is read once for the video element's props; the admin has no player in this plan |
| `src/pages/LibraryPage.tsx`, `LivePage.tsx`, `PlayerPage.tsx` | **removed**; replaced by six `*Page.tsx` and `SignInPage.tsx` (section 6) |
| `src/store/app-store.ts`, `navigation-slice.ts`, `selectors.ts` | **rewritten**: one store, the admin's slices (section 6.3); the chrome slice is spread in from the library after step 6 |
| `src/constants/surfaces.ts` | **replaced by `constants/tabs.ts`** |
| `src/constants/settings-sections.ts`, `child-window.ts`, `motion.ts`, `timing.ts`, `popups.ts` | `settings-sections` **rewritten** (three sections); `child-window`, `motion`, `timing` **kept** (retired by steps 1 and 7); `popups.ts` **removed** |
| `src/hooks/*` | kept: `useArmedAction`, `useChildWindowBox`, `useChildWindowKeys`, `useReduceMotion`, `useScrollSpy`, `useShellKeyboard` (rewritten), `useTheme`, `useViewport`. Removed: `useWorkspaceSplit`, `usePaneTween`, `useCollectionVerbs`, `useContextMenu`, `useLibraryRequest`, `useLiveActions`, `usePopupFrame` |
| `src/lib/*` | kept: `bus.ts` (if used), `cn.ts`, `child-bounds.ts`, `settings-zoom.ts`, `text-field.ts`. Removed: `pane-collapse.ts`, every `collections-*`, `library-*`, `live-*`, `player-*`, `rows-*`, `menu.ts`, `playback-prefs.ts`, `popup-place.ts`, `poster-tone.ts`, `settings-address.ts`, `settings-language.ts`, `collection-menu.ts` |
| `src/fixtures/*` | **removed**, replaced by the admin's (section 8) |
| `src/services/*` | **removed** (`not-connected.ts` and its refusing stubs); the admin's only service in this plan is `services/admin-host.ts` (the Electron preload, section 9.5) |
| `src/types/*` | kept: `child-window.ts`, `overlays.ts` (trimmed), `shell.ts` (trimmed to `Tab`, theme, accent, motion), `events.ts` (areas changed). Removed: `channel`, `collection`, `job`, `library`, `menu`, `player`, `settings`, `title` (the admin's own replace them) |
| `test/*.test.ts` | kept and adapted: `child-bounds`, `overlays`, `settings-zoom`, `shell-collapse`, `shell-keyboard`, `app-store`. **Removed:** `collections-*`, `library-*`, `live-*`, `player-*`, `playback-prefs`, `rows-*`, `settings-address`, `settings-language` |

### 4.2 What `@giga/ui` retires, file by file

Applied by the first wave after the named step lands (library mode). Until then the file stays.

| Template file(s) | Step | Becomes |
|---|---|---|
| `src/index.css` tokens, `src/styles/base.css`, `fonts.css`, `keyframes.css`, `motion-reduce.css`, `src/assets/fonts/*` | 1 | the library's CSS import in `main.tsx`; Tailwind `@source` and Vite `fs.allow`/`dedupe` set in `vite.config.mts` |
| `components/ui/Button.tsx`, `IconButton.tsx`, `Field.tsx`, `Toggle.tsx`, `Segmented.tsx`, `ChipGroup.tsx`, `ChipsInput.tsx`, `InlineLink.tsx`, `lib/cn.ts` | 2a | `@giga/ui/controls/*`, `@giga/ui/lib/cn` |
| `components/ui/Form.tsx` (split under 200 lines by the step), `NumericInput.tsx`, `Tooltip.tsx` (with `InfoTip`) | 2b | `@giga/ui/form/*` |
| `components/ui/SkeletonRows.tsx`, `SkeletonCards.tsx` (`SHIMMER`), `NavRail.tsx`, `DataTable.tsx` | 2c | `@giga/ui/lists/*` |
| `components/ui/ArmedButton.tsx`, `Swatches.tsx`, `hooks/useArmedAction.ts`, `hooks/useReduceMotion.ts`, `constants/timing.ts`, `constants/motion.ts`, `lib/text-field.ts` | 3 | `@giga/ui/controls/*`, `@giga/ui/hooks/*`, `@giga/ui/lib/*` (state taken by argument or context) |
| `components/chrome/Brand.tsx`, `TabPill.tsx`, `Titlebar.tsx`, `Statusbar.tsx`, `RunningWork.tsx`, `EventRow.tsx` | 4 | `@giga/ui/shell/*`; the admin passes its brand subtitle, tabs, toggles and running work as props |
| `components/chrome/EventsDrawer.tsx`, `hooks/useTheme.ts`, `hooks/useShellKeyboard.ts` (the key map), the chrome fields of `store/app-store.ts` (`eventsOpen`, `events`, `notice`, `say`, `overlay`, `uiZoom`, `theme`, `accent`, `motion`, `folded`, `childBounds`) | 6 | `@giga/ui/store/chrome-slice` factory spread into the admin's single store; `@giga/ui/shell/EventsDrawer`; `@giga/ui/hooks/*` |
| `components/overlays/ChildWindow.tsx`, `ChildGrips.tsx`, `ChildScrim.tsx`, `hooks/useChildWindowBox.ts`, `useChildWindowKeys.ts`, `lib/child-bounds.ts`, `constants/child-window.ts`, `types/child-window.ts`, the Settings frame | 7 | `@giga/ui/windows/*` |
| `hooks/useScrollSpy.ts`, `useViewport.ts`, `lib/settings-zoom.ts` | whichever step `27` assigns (2c or 3) | `@giga/ui/hooks/*`, `@giga/ui/lib/*` |

Not in the table, because the admin does not use them: the pane engine (step 8; section 4.1 removes it), the context menu and
its types, `NumberField`, `SliderField`, `Section`, `ActionList`, `SplitList`, `Reveal`. The admin never imports them.

Tests that cover a retired file move with it to the library (`27` owns that); the admin keeps only tests of its own files.

### 4.3 Admin-only pieces built into the library (step 9)

`27` section 5, step 9 names these; the admin waves write them straight into `src/shared/ui` (not `src/admin`) because the interface can
use them too. Each is built by the wave that first needs it, with its test in the library, in the folder `27` section 2 gives it.

| Piece | Library home | Responsibility | First needed by |
|---|---|---|---|
| `RecordGrid` (+ `RecordGridRow`, `SkeletonGrid`) | `lists/` | the index list: a header row of lowercase mono column names, a selection column, 36px rows with a selected fill and hover, mono numbers, a trailing cell, skeleton rows in the header's own column set, a dimmed disabled row, the state word | wave 2 |
| `Checkbox` | `controls/` | the row-selection tick (20px, accent when on); **row selection only**, never a field (`Enabled` is the `Toggle`) | wave 2 |
| `ToolbarStrip` | `shell/` | the 40px strip under the titlebar: right-aligned verbs, one filled-accent forward verb | wave 2 |
| the reason button | `controls/` (`Button` gains a `reason` prop; `27` step 9 fixes the name, this plan calls it `ReasonButton`) | stays focusable and in place when disabled, ignores clicks, shows the reason in the styled tooltip (a native `title` does not show on a disabled button in Chrome) | wave 1 |
| the tooltip arrow that follows its anchor, and the shell's 900 x 640 minimum size | `form/`, `shell/` | as the mockup draws them | wave 1 |

`FolderRow` (info glyph, a mono field, the bordered icon-and-text `Choose` button at the trailing edge) and `StateWord` are not on
`27`'s list; they are admin-only and live in `src/admin/src/components/records/`. If step 9 has not landed when a wave needs a
library piece, the worker builds it in `src/admin/src/components/records/` (copy mode) and moves it, a pure move, when the
library exists.

## 5. Mockup against the family frontend: what wins

The mockup was drawn from the family mockup in plain CSS; the app is drawn in the frontend's components. Where the two differ,
the owner has decided (2026-10-17) or this plan takes the simplest reading and says so. The coordinator's acceptance compares
against the mockup **after wave 0 has aligned it**.

| # | Difference | Resolved to | Mockup change (wave 0) |
|---|---|---|---|
| 1 | **Segmented.** The mockup's `.seg` is one bordered rectangle with square-cornered segments; the frontend's `Segmented` is flat pills (hairline edge, accent tint when on) | **the frontend's pills** (owner) | `css/controls/fields.css` `.seg` and `css/admin/form.css` `.row .control > .seg`: a row of rounded-full pills, 6px gap, no outer border, 36px tall in a form row, equal segments |
| 2 | **`Enabled`.** A field on the record, never a section or a chip | **the family `Toggle` switch** (owner); the tick boxes in a list's first column are **row selection only** | none expected: every `Enabled` in the mockup is already `.tgl role="switch"`; verify none is a `.chk`, and that the list header's select-all is labelled as selection |
| 3 | **Tab pill.** The template's `PageTabs` is an equal-width grid at 12px (`27` section 1 keeps it); the mockup's pill is content-sized at 13px with `padding: 3px 10px` | **the interface's equal-width grid**, unless the 900px probe (wave 1 acceptance, with the Electron caption strip's 138px subtracted from the titlebar) shows the pill touching the brand or the toggles; then both apps take a content-sized variant (a `TabPill` prop in the library) | `.pill` becomes an equal-width grid at 12px, so the two can be compared; reverted with the app if the probe fails |
| 4 | **Theme.** The mockup draws only dark (`Light` and `System` disabled "only the dark theme is drawn") | **the app's three themes** (the template's tokens already have them) | Theme row enabled, with the light tokens, so the comparison is possible |
| 5 | **UI zoom.** The template's Appearance has a zoom stepper; the mockup does not; `26` 4.2 lists theme, accent and reduce motion; the owner's brief lists zoom | **keep the zoom row** (already built, `Ctrl+0` resets it) | add the `UI zoom` row (a stepper, 50% to 300%) |
| 6 | **Icons.** The mockup uses lucide 0.469 by CDN; the app uses `lucide-react` 1.x | **`lucide-react`**; section 7.1 maps every glyph by name | none |
| 7 | **Durations.** The mockup's 83 / 167 / 250 / 333 ms and `.12s` literals vs the interface's 70 / 140 / 200 / 280 ms (`27` section 1) | **the interface's tokens** | `css/tokens.css` durations set to the interface's |
| 8 | **Disabled controls.** The mockup's use `aria-disabled` plus a swallowed click; the interface's `Button` uses `disabled` and a tooltip on a wrapper | **the reason button** (section 4.3, kept from the mockup per `27` section 1): focusable, reason in the styled tooltip | none |
| 9 | **Input focus ring, `Select` chevron, accent ink, tooltip arrow.** | the interface's ring, lucide `ChevronDown`, accent ink; the mockup's tooltip arrow that follows its anchor (`27` section 1) | `.inp:focus`, `select.inp` chevron, `--accent-ink` aligned |
| 10 | **Skeleton timing.** The mockup shows grid skeleton rows for `MOCK_LOAD_MS` (600 ms) | **same**, through the fixture-load stand-in (section 8) | none |

Wave 0 also adds to the mockup anything the app needs that it lacks and `26` requires; there is nothing else known today.

## 6. The target tree of `src/admin/src`

Every file at most 200 lines (the bound beside it is the expected size), one component per file. "(lib)" marks a piece that moves
to `@giga/ui` in library mode and is not written under `src/admin` at all.

### 6.1 Shell and shared admin pieces

| File | Responsibility | Bound |
|---|---|---|
| `main.tsx` | mounts `<App/>`; imports the CSS | 12 |
| `components/chrome/App.tsx` | `useTheme`, `useShellKeyboard`, `MotionConfig`, `AppShell` | 25 |
| `components/chrome/AppShell.tsx` | the flex column: titlebar, signed-in pages or the sign-in page, events drawer, statusbar, overlay host | 60 |
| `components/chrome/Brand.tsx`, `TabPill.tsx`, `Titlebar.tsx`, `Statusbar.tsx`, `RunningWork.tsx`, `EventsDrawer.tsx`, `EventRow.tsx` | as section 4.1 (all (lib) after steps 4 and 6) | 25 to 90 |
| `components/chrome/WorkspaceFrame.tsx` | a workspace: the rail (width from the store, collapsed by the titlebar toggle in 100 ms, `inert` when closed), `RailSash`, and the centre with the toolbar plus the scrolling page; takes `rail`, `toolbar`, `children` | 70 |
| `components/chrome/RailSash.tsx`, `hooks/useRailWidth.ts` | the 1px sash that turns accent on hover or drag (pointer capture, arrow keys step 16, Home/End), clamped to the tab's limits; replaces the pane engine until the admin adopts it | 50, 60 |
| `components/records/ToolbarStrip.tsx` | (library, `shell/`, step 9) | 40 |
| `components/records/RecordGrid.tsx`, `RecordGridRow.tsx` | (library, `lists/`, step 9) | 150, 80 |
| `components/records/Checkbox.tsx` | (library, `controls/`, step 9) | 40 |
| the reason button (`ReasonButton`) | (library, `controls/`, step 9; a `reason` prop on `Button`) | 30 |
| `components/records/StateWord.tsx`, `FolderRow.tsx` | admin-only, stay in `src/admin` | 30, 70 |
| `components/records/RecordRail.tsx` | `NavRail` with the `‹ <Tab>` back button and the section links, driven by `useScrollSpy`; takes `back`, `sections`, `spy` | 50 |
| `components/records/WorkspaceToolbar.tsx` | the workspace toolbar: `Discard changes` (ghost), `Save` (edged), the forward verb (filled accent); each prop is a `{ label, onPress, reason? }` | 60 |
| `components/records/NewRecordGroup.tsx` | the "New <record>" `Group` frame: plus tile, title, fold, children, the final `Create` primary | 50 |
| `components/records/ListGroup.tsx` | the list `Group` frame: tile, title, heading action slot (`Refresh`, `Older`/`Newer`), the grid as its body | 50 |
| `components/records/FieldError.tsx` | the `row-err` line under a row (role alert, 14px, `--st-failed`) | 20 |
| `components/records/VideoList.tsx` | the live source's ordered video rows (index, path, up, down, remove) and the add row (a path field and `Add`; no `Choose`, because the preload's picker is for folders only, `29` section 13) | 120 |
| `components/records/SeasonList.tsx` | the title's editable seasons (season, episode count, remove) and `Add season` | 100 |
| `components/session/SignInForm.tsx` | the sign-in `Group` (Email, Password, `Sign in`) | 70 |
| `pages/SignInPage.tsx` | centres `SignInForm` in the page area; the titlebar and statusbar stay | 30 |
| `components/settings/SettingsRail.tsx`, `AppearanceSection.tsx`, `ZoomStepper.tsx`, `SessionSection.tsx`, `AboutSection.tsx` | Settings' rail and three sections | 40 to 80 |
| `components/overlays/ChildWindow.tsx`, `ChildGrips.tsx`, `ChildScrim.tsx` | (lib) step 7 | as copied |
| `components/overlays/OverlayHost.tsx`, `SettingsWindow.tsx` | the one open flow, Settings | 25, 60 |
| `hooks/useShellKeyboard.ts` | `Ctrl+1`..`Ctrl+6` pick the tabs, `Ctrl+,` opens Settings, `Ctrl+0` resets zoom, `Escape` closes the events drawer | 80 |
| `hooks/useCaptionOverlay.ts` | in Electron, pushes the theme's bar colours to `window.adminHost.setOverlay` on theme or accent change; a browser does nothing | 40 |
| `hooks/useFixtureLoad.ts` | the stand-in: a list wears skeleton rows for `FIXTURE_LOAD_MS` on first open; deleted by `29` | 30 |
| `hooks/useRecordForm.ts` | a record form's draft: initial values, dirty, `discard`, field errors, required-field check against `lib/field-checks.ts` | 90 |
| `constants/tabs.ts` | `TABS` (id, label, left-pane limits `{ min: 190, max: 380, preferred: 240 }`, no right or bottom pane), `TAB_ORDER`, `DEFAULT_TAB = "channels"` | 40 |
| `constants/record-copy.ts` | tooltips, reasons, titles shared by every tab (`TICK_FIRST`, `LAST_ACCOUNT`, `NO_LEFT_PANE`, `NO_RIGHT_PANE`, the two-step sentences) | 60 |
| `constants/channel-copy.ts`, `provider-copy.ts`, `title-copy.ts`, `playlist-copy.ts`, `job-copy.ts`, `account-copy.ts` | the tab's labels, info-glyph tips (copied from the mockup's `data-tip`), options | 40 to 90 |
| `constants/fixture-switches.ts` | reads `?signedin=0`, `?load=0`, `?testpage=0` (mockup parity); deleted by `29` | 20 |
| `lib/field-checks.ts` | pure: required, 1 to 9999, https address, schedule `^\d+[mh]$|off`, year, rating | 80 |
| `lib/row-state.ts` | pure: a record to its state word and row `data-st` (channel, title, job, playlist, provider, account) | 90 |
| `lib/event-sentence.ts` | pure: an audit-shaped fixture entry to its tone, area and one sentence (`ada@example.test updated channel Fixture News`); reused unchanged by `29` | 100 |
| `lib/live-time.ts` | pure: `00:42` style duration, clock | 25 |
| `services/admin-host.ts` | `hostAvailable()`, `chooseFolder()`, `setOverlay()` over `window.adminHost` (section 9.5); the only service in this plan | 50 |
| `store/app-store.ts` | the one store | 150 |
| `store/workspace-slice.ts` | `tab`, `open` (the open workspace id per tab), `openWorkspace`, `closeWorkspace`, `requestTab` (forward verbs and links) | 70 |
| `store/session-slice.ts` | `signedIn`, `actor` (fixture), `signOut`; replaced by `29`'s real session | 40 |
| `store/selectors.ts` | `useTab`, `usePaneOpen`, `useWorkSurfaceOpen` | 25 |
| `types/shell.ts`, `overlays.ts`, `child-window.ts`, `events.ts` | trimmed; `EventArea` = `Connection | Session | Channel | Provider | Title | Playlist | Job | Account` | 15 to 45 |
| `types/admin-channel.ts`, `admin-provider.ts`, `admin-title.ts`, `admin-playlist.ts`, `admin-job.ts`, `admin-account.ts`, `admin-audit.ts` | the **backend's own response shapes** (listed in `29` section 5), so wiring replaces only the source of the data | 30 to 80 |

### 6.2 The six tabs

| Tab | Index | Workspace |
|---|---|---|
| Channels | `pages/ChannelsPage.tsx` (30) chooses index or workspace from `open.channels`; `components/channels/ChannelsIndex.tsx` (50), `NewChannelForm.tsx` (140), `ChannelRows.tsx` (110, columns and `Delete`) | `ChannelWorkspace.tsx` (60, live or stream), `LiveDetailsGroup.tsx` (150), `PlaybackGroup.tsx` (80), `FaultGroup.tsx` (90), `LiveStatusGroup.tsx` (100), `PlaylistRows.tsx` (50), `StreamDetailsGroup.tsx` (110), `StreamAddressGroup.tsx` (60), `StreamStatusGroup.tsx` (60) |
| Providers | `ProvidersPage.tsx`, `providers/ProvidersIndex.tsx`, `NewProviderForm.tsx` (110), `ProviderRows.tsx` | `ProviderWorkspace.tsx`, `ProviderDetailsGroup.tsx` (110), `ProviderTemplatesGroup.tsx` (90), `ProviderPlayerGroup.tsx` (90) |
| Titles | `TitlesPage.tsx`, `titles/TitlesIndex.tsx`, `NewTitleForm.tsx` (80), `TitleListGroup.tsx` (130: search, kind chips, sort, `Older`/`Newer`), `TitleRows.tsx` | `TitleWorkspace.tsx`, `TitleDetailsGroup.tsx` (160), `TitlePlotGroup.tsx` (70), `TitleSeasonsGroup.tsx` (60), `TitleSourcesGroup.tsx` (60) |
| Playlists | `PlaylistsPage.tsx`, `playlists/PlaylistsIndex.tsx`, `NewPlaylistForm.tsx` (70), `PlaylistRows.tsx` | `PlaylistWorkspace.tsx`, `PlaylistDetailsGroup.tsx` (90, masked address with `Replace`), `PlaylistStatusGroup.tsx` (80) |
| Jobs | `JobsPage.tsx`, `jobs/JobsIndex.tsx` (the filled `Run job` verb on the ticked rows), `NewJobForm.tsx` (140, Type switches the rows), `JobRows.tsx` | `JobWorkspace.tsx`, `JobDetailsGroup.tsx` (120), `JobScheduleGroup.tsx` (60), `JobRunGroup.tsx` (90), `JobLastRunGroup.tsx` (110) |
| Accounts | `AccountsPage.tsx`, `accounts/AccountsIndex.tsx`, `NewAccountForm.tsx` (80), `AccountRows.tsx` | `AccountWorkspace.tsx`, `AccountDetailsGroup.tsx` (80), `AccountPasswordGroup.tsx` (60) |

A tab's `*Page.tsx` is the only file that reads `open[tab]`. Each page stays mounted when another tab is active (it is hidden), so
scroll and form state survive a tab switch, as the mockup does.

## 7. Design authority: page by page

The mockup root is `D:\Projects\giga-stream-poc\src\admin-mockup` (`html/` partials, `css/`, `js/`), served at
`http://127.0.0.1:5190/` by `npm run admin-mockup` (the coordinator starts it only after asking the owner). The family
screenshots are in `docs/reference/family/` (gitignored, local): `datasets-index.jpg` (titlebar, folder row, group),
`dataset-workspace.jpg` (rail), `training-index.jpg` and `training-workspace.jpg` (toolbar verbs, list), `setup.jpg`
(statusbar), `events-drawer.jpg`. The template's reference components are the starting point for each row.

### 7.1 Shell

| Surface | Mockup files | Template/library parts | Notes |
|---|---|---|---|
| Titlebar (40px) | `html/titlebar.html`, `css/shell/frame.css`, `css/admin/shell.css` | `Titlebar`, `Brand`, `TabPill`, `IconButton` | Glyphs: `panel-left`, `tv`, `panel-bottom`, `panel-right`. Pill tabs, in order: Channels, Providers, Titles, Playlists, Jobs, Accounts. The pill is the only navigation. Left toggle is the rail; on an index it is disabled with `This page has no left pane.` |
| Statusbar (24px) | `html/statusbar.html`, `css/shell/statusbar.css`, `css/admin/status.css`, `js/statusbar.js` | `Statusbar`, `RunningWork` | 112px track, `idle` or `N preparing`/`N syncing`, `Stop` (`square`) always disabled with its reason (`A channel build cannot be cancelled; change or delete the channel.` / `A sync cannot be cancelled.` / `Nothing to stop`), one polite notice with a `circle-alert` glyph for warn and error, `Events` (`panel-bottom`, lit while open), `Settings` (`settings`) |
| Events drawer (160px) | `html/events.html`, `js/event-log.js`, `css/admin/status.css` | `EventsDrawer`, `EventRow` | Head `Events`, `N events`, `Clear`; rows 64/48/88/rest columns; `Load older` row at the top; shimmer lines when empty; slides 100 ms; at most 200 rows |
| Settings window | `html/settings.html`, `css/admin/window.css` | `SettingsWindow`, `ChildWindow`, `SettingsRail` | Scrim from the titlebar's bottom edge; window `min(80vw, 860px)` by `min(80vh, 560px)`, minimum 658 x 412; rail 150px (210 from 1200); three pages: Appearance (`palette`: Theme, Reduce motion, Accent), Session (`user`: Signed in as, `Sign out`), About (`info`: Version, Backend revision, Address); label column 152 |
| Sign-in | `html/signin.html`, `css/admin/signin.css` | `SignInForm`, `Group`, `Row`, `Input` | A page in the centre, not a modal; titlebar and statusbar stay; Email, Password, one primary `Sign in` |

### 7.2 Indexes and workspaces

Every page is `Workspace`/`Group`/`Row` of the form kit with the mockup's markup order and tips. The group icons (lucide names) are
fixed by the mockup:

| Page | Mockup file(s) | Group (icon) | Toolbar | Rail |
|---|---|---|---|---|
| Channels index | `channels-index.html`, `js/grid.js` | New channel (`plus`), Channels (`radio`, `Refresh` in the action slot) | `Preview →` (filled), needs exactly one ticked row and `TEST_PAGE` | none |
| Live channel | `channel-workspace.html`, `js/workspace.js`, `js/vlist.js` | Details (`file-text`, `Rebuild` `hammer`), Playback (`play`), Fault (`zap`), Status (`activity`) | `Discard changes`, `Save`, `Preview →` | `‹ Channels`, Details, Playback, Fault, Status |
| Stream channel | `channel-workspace-stream.html`, `js/stream.js` | Details (`file-text`, `Revert to playlist` `undo-2`, synced rows only), Stream (`radio`), Status (`activity`) | `Discard changes`, `Save` | `‹ Channels`, Details, Stream, Status |
| Providers index | `providers-index.html` | New provider (`plus`), Providers (`plug`) | `Titles →` | none |
| Provider | `provider-workspace.html`, `js/chips.js` | Details (`file-text`), Templates (`link`), Player (`monitor-play`) | `Discard changes`, `Save`, `Titles →` | `‹ Providers`, Details, Templates, Player |
| Titles index | `titles-index.html`, `js/titles.js` | New title (`plus`), Titles (`clapperboard`; `Older`, `Newer`; search, Kind chips, Sort) | `Jobs →` | none |
| Title | `title-workspace.html` | Details (`file-text`, `Revert to TMDB`), People and plot (`users`), Seasons (`layers`, series only), Sources (`plug`) | `Discard changes`, `Save`, `Jobs →` | `‹ Titles`, Details, People and plot, Seasons (series), Sources |
| Playlists index | `playlists-index.html` | New playlist (`plus`), Playlists (`list`) | `Jobs →` | none |
| Playlist | `playlist-workspace.html` | Details (`file-text`), Status (`activity`) | `Discard changes`, `Save`, `Jobs →` | `‹ Playlists`, Details, Status |
| Jobs index | `jobs-index.html`, `js/sync.js` | New job (`plus`), Jobs (`timer`) | `Run job` (filled, acts on the ticked rows) | none |
| Job | `job-workspace.html`, `js/schedule.js` | Details (`file-text`), Schedule (`clock`), Run (`play`), Last run (`history`) | `Discard changes`, `Save`, `Channels →` (playlist job) or `Titles →` (catalog job) | `‹ Jobs`, Details, Schedule, Run, Last run |
| Accounts index | `accounts-index.html` | New account (`user-plus`), Accounts (`users`) | none | none |
| Account | `account-workspace.html` | Details (`user`), Password (`key-round`) | `Discard changes`, `Save` | `‹ Accounts`, Details, Password |

The workspace rail is 240px wide, clamped 190 to 380, resized by a 1px sash that turns accent on hover or drag, and collapses by
the titlebar toggle in 100 ms. The groups are separated by the accent-cored splitter the `Group` draws itself.

### 7.3 Fields, in the order of `26` 4.4

The New form and the workspace's Details carry the same fields in the same order: **(1) required, (2) Enabled, (3) optional,
(4) read-only**. Row 1 is always the record's name (Name, Title, Email); row 2 is the Kind, Type or Family control **when it
switches the rows below it**. An info glyph sits on every row except Name, Title, Email and Password. Every control spans the
row at 36px (a Segmented included, equal segments); the Toggle is the one exception. One row markup everywhere: label with its
glyph, `control`, `FieldError`.

| Record | New form (required only) | Details order |
|---|---|---|
| Live channel | Name, Kind, Number, Category, Folder (with `Choose`) | Name, Kind (read-only), Number, Category, Plays (Folder or Videos), Folder or the Videos list, Enabled, Logo, Id (read-only) |
| Stream channel | Name, Kind, Number, Category (free text), Stream address | Name, Kind, Number, Category, Stream address, Enabled; Stream group: Logo address; Status: Id, Synced from |
| Provider | Name, Family, Source, Movie template (embed only) | Name, Family, Source, Movie template, Enabled, Order, Created (read-only); Templates: Episode template, Start parameter, Subtitle parameter; Player: Origin, Frame origins (chips), Message shape |
| Title | Title, Kind, Year | Title, Kind (read-only), Year, Enabled, TMDB id, Rating, Genres, Runtime, Poster address, Backdrop address, Stream address, State (read-only); People and plot: Plot, Cast; Seasons |
| Playlist | Name, Address | Name, Address (masked, `Replace`), Enabled; Status: Host, Channels, Last synced, Outcome |
| Job | Name, Type, then Playlist (a select) or Scope and Kind | Name, Type (read-only), Playlist or Scope and Kind, Enabled, Pages; Schedule: Interval; Run: Dry run, Prune, `Run job`; Last run: State, When, Outcome, Counts, Refused, Created (playlist) or Titles, Stale (catalog) |
| Account | Email, Name, Password | Email, Name, Enabled, Last sign-in (read-only); Password: New password |

`Kind` is a Segmented (Live or Stream) in Channels; `Family` (Embed or Stream) in Providers; `Type` (Playlist or Catalog) in
Jobs; Titles' Kind (Movie or Series) is an ordinary field in row 2 because it does not switch rows. `Category` is a six-value
`Select` for live and free text for stream. The refusal of a required field is the `FieldError` under the row, the same sentence
on the notice line, and the field gets `aria-invalid`.

## 8. Fixtures

`src/admin/src/fixtures/`, typed with the `types/admin-*.ts` shapes (the backend's own, so `29` replaces the source and not
the shape). Example hosts only (`example.test`). The data is the mockup's `js/fixtures.js`, `event-log.js` and the grid rows of
`html/*-index.html`:

| File | Content |
|---|---|
| `channels.ts` | six live channels (Fixture News/Sports/Music/Kids/Movies/Archive: states live, preparing, live, stopped, failed, stopped-and-disabled) and three stream channels (two synced, one edited, one by hand); the live ones carry settings, playlist rows with durations, `nowPlaying`, renditions |
| `providers.ts` | Cinezo, VidSrc, VixSrc (enabled) and VidZee (disabled) with templates, parameters, origins, frame origins, message shapes |
| `titles.ts` | The Matrix, Game of Thrones (3 seasons), Inception (edited), Breaking Bad, a manual title, a disabled series |
| `playlists.ts` | IPTV main (enabled), Community lists (disabled), with host, masked address, channel ids, last sync, outcome |
| `jobs.ts` | Sync IPTV main, Sync Community lists, Trending movies, Trending series, Popular movies (failed), Popular series (disabled), with schedule, counts, refusals, created ids |
| `accounts.ts` | ada (enabled), ed and eve (disabled), last sign-in |
| `audit.ts` | the mockup's 13 recent and 8 older entries as `AuditEntry` shapes; `lib/event-sentence.ts` turns them into rows |
| `session.ts` | the fixture actor `ada@example.test` |

`constants/fixture-switches.ts` keeps the mockup's `?signedin=0`, `?load=0`, `?testpage=0` so the two apps can be put in the same
state for comparison. `hooks/useFixtureLoad.ts` shows the grid skeleton for `FIXTURE_LOAD_MS = 600` on first open.

## 9. Shared decisions

1. **One record pattern.** An index is the toolbar strip, a New group, and the list group, nothing else; a click on a row (not on its tick or its `Delete`) opens the workspace; there is no `Open` button or double-click. A workspace is the rail, one scrolling page of groups, and the toolbar; ONE `Save` per page. Delete lives on the index row only.
2. **State is a word** in the list (`live`, `preparing`, `failed`, `stopped`, `disabled`, `synced`, `edited`, `manual`, `idle`, `running`), coloured by state; a disabled record stays in its list dimmed to 45%; a running job also shows a pulsing 48px bar. No dots.
3. **Two-step delete** is `ArmedButton`, ghost `Delete` at rest, the danger question naming the record (`Delete Fixture News?`) when armed, re-arming after `TWO_STEP_MS` (4 s), disarmed by blur and Escape. A synced row's, a title's and a playlist's tooltips say what happens next (mockup `data-tip`). The last enabled account's `Delete` is disabled with `The last enabled account cannot be deleted.`
4. **Tooltips on disabled controls** through `ReasonButton`; a disabled `Segmented` chip carries `disabledReason`. Every info glyph is an `InfoTip` with the mockup's sentence.
5. **No roles and no provider API key** exist anywhere (`26` D22, D24). No role column, no key field, no role gate on a tab.
6. **Appearance.** Theme (Dark, Light, System), Reduce motion (Follow system, Off, On), Accent (amber, blue, emerald/green, violet, rose swatches), UI zoom; all applied at once through the store; nothing persisted (`26` D16): a reload starts at defaults.
7. **Window.** Minimum 900 x 640; the design size is 1600 x 1000; the page never scrolls horizontally except a list's own scroller (`.grid-scroll`), whose columns have the mockup's minimums.
8. **Caption buttons.** In Electron (`window.adminHost` present) the titlebar leaves the strip free (`pr-[calc(100%-env(titlebar-area-width,100%)+8px)]`, as the template does) and `useCaptionOverlay` calls `setOverlay({ color: <panel>, symbolColor: <faint> })` when the theme changes. The values are the tokens `--panel` and `--faint` read from the document, not literals. In a browser the hook does nothing.
9. **`Choose`.** `FolderRow` calls `chooseFolder()`; when `window.adminHost` is absent the button stays in place, visibly disabled, with the tooltip `Folders can be chosen only in the backend's own window; type the path.`; the field stays a typed path. A cancelled dialog (`null`) changes nothing.
10. **Skeletons.** A list that is loading or empty draws `SkeletonRows` in the header's column set inside the group; a preparing live channel's Status group swaps its facts for shimmer lines in their shape; the events drawer shows four shimmer lines when empty. No sentence ever sits over a skeleton.
11. **Forward verbs** (`Titles →`, `Jobs →`, `Channels →`) call `requestTab(tab, id?)`, which switches the tab and opens the named workspace or its index; a link from a Playlist's channels or a Job's created ids opens that channel.
12. **Fixture edits** persist in the store for the session so a Save, a Create and a Delete are visible in the list, and each writes the event row the mockup writes (`ada@example.test created channel Fixture Sports`). A write on a fixture row that `26` says the backend refuses (a synced row's address) shows the refusal the same way.

## 10. Waves

One worker owns `src/admin` for waves 1 to 5, in one worktree, because it is one sub-project (`07` 6.1) and its pieces share the
shell, the store and the record components; the owner's rule is few agents. The mockup worker of wave 0 owns the mockup folder,
a different sub-project that is not a git repository. The coordinator accepts each wave visually before the next begins, so a
wave is a checkpoint, not a worker.

| Piece | Worker | Where | Paths | Off limits |
|---|---|---|---|---|
| Mockup alignment (wave 0) | **M** | `D:\Projects\giga-stream-poc\src\admin-mockup`, in place (no git, no worktree) | `admin-mockup/**` | `giga-stream-poc/src/mockup/**`, everything in `giga-stream` |
| Admin parity (waves 1 to 5) | **A** | worktree `D:\Projects\.giga-worktrees\admin-parity`, branch `admin/parity`, cut from the landed `admin/admin-scaffold` | `src/admin/**`; `src/shared/ui/**` for step-9 pieces once `27` has created it | `src/frontend`, `src/fileserver`, `src/backend`, root `package.json`, `scripts/**`, docs, any `.env`, any `data/` |

Every wave: `npm ci` (in its own worktree only), `npm run typecheck`, `npm run lint`, `node scripts/check-rules.mjs` from the
root, all clean; tests written and **not run**; one commit per wave on the branch (never pushed, merged or rebased). The report
follows `07` 6.4.

### Wave 0 - the mockup agrees with the app (worker M)

- **Does.** Items 1, 3, 4, 5, 7 and 9 of section 5: restyle `.seg` as pills; make `.pill` the interface's equal-width grid at 12px; enable Light and System with the light tokens; add the `UI zoom` row; set the durations to 70 / 140 / 200 / 280 ms and align the input focus ring, `select` chevron and accent ink; verify every `Enabled` is `.tgl` and every list tick is `.chk` labelled as selection (change the header's select-all label to `Select all <records>`); remove the file `Choose` button from the Videos add row (the native picker chooses folders only; section 5 gains no row because it is a contract fact, `29` section 13).
- **Files.** `css/controls/fields.css`, `css/controls/buttons.css`, `css/admin/form.css`, `css/admin/controls.css`, `css/admin/shell.css`, `css/tokens.css` (light tokens, durations), `html/settings.html`, `html/channel-workspace.html`, `js/settings.js`. If the coordinator has already made any of these changes, the worker verifies and skips them.
- **Depends on.** Nothing. Runs first and in parallel with wave 1.
- **Tests.** None (plain HTML).
- **Acceptance** (coordinator, owner asked first): serve the mockup on 5190; open Channels' New form: the Kind control is two rounded pills filling the row, no outer rectangle; open Settings: Theme Light switches the page light; a UI zoom row exists. Compare to the frontend's Library rail `Segmented`. Failure: any square-cornered `.seg`, any checkbox that acts as `Enabled`.
- **Exit.** The three changes are visible and the owner has seen the pills.

### Wave 1 - shell and shared record pieces (worker A)

- **Mode.** Library mode for the steps that have landed, copy mode for the rest. **Depends on `27` steps 0 to 4 and the step-9 reason button; it must not wait for steps 5 to 8.** Until step 6 the store carries the eight chrome fields itself (`store/chrome-fields.ts`, deleted at the swap); until step 7 the Settings window uses the template's `ChildWindow`; the rail is `WorkspaceFrame` with `RailSash`.
- **Does.** Strips the demo (sections 4.1: components, pages, fixtures, services, types, tests listed as removed); writes `constants/tabs.ts`, the three store slices, `Brand` (ADMIN), `TabPill`, `Titlebar`, `Statusbar`/`RunningWork`, `EventsDrawer`/`EventRow` (fixture rows, `Load older`), `AppShell`, `useShellKeyboard`, `WorkspaceFrame`, `RecordRail`, `WorkspaceToolbar`, `NewRecordGroup`, `ListGroup`, `FieldError`, `ReasonButton`, `SignInForm`/`SignInPage`, six empty `*Page.tsx` that show their index skeleton (a `ListGroup` of skeleton rows under a `NewRecordGroup` frame, no fields yet), `SettingsWindow` with its three sections, `useCaptionOverlay`, `services/admin-host.ts`, `fixtures/session.ts`, `constants/fixture-switches.ts`.
- **Files owned.** Everything in section 6.1 not marked step 9, plus the removals.
- **Depends on.** Wave 0 for the Segmented pills only (the Kind rows come in wave 2); `27` steps 0 to 4 (copy mode otherwise).
- **Tests (written, not run), `test/`.** `tabs-config.test.ts` (six tabs in order, left limits, no right/bottom); `workspace-slice.test.ts` (open and close a workspace per tab, `requestTab` switches tab and opens, tabs stay independent); `shell-keyboard.test.ts` (rewritten: `Ctrl+1`..`Ctrl+6`, `Ctrl+,`, `Ctrl+0`, Escape closes the drawer, typing in a field is ignored); `event-sentence.test.ts` (each audit action to its area, tone and sentence; failed login is warn; a password never appears); `field-checks.test.ts`; `row-state.test.ts`; `settings-zoom.test.ts` kept; `overlays.test.ts` and `shell-collapse.test.ts` adapted.
- **Acceptance** (coordinator, Chrome MCP against `npm run dev --prefix src/admin` on 5172 with the backend not required; mockup on 5190, both at 1600 x 1000 and 900 x 640):
  1. Titlebar: height 40px; left toggle, brand (`GIGA` / `STREAM` / `ADMIN`), the six tabs centred on the **titlebar** (not among siblings), Events toggle, right toggle disabled with its reason. At 900px the pill does not touch the brand or the toggles.
  2. Statusbar: 24px, `idle` with an empty track, `Stop` disabled with `Nothing to stop`, `Events`, `Settings`; the notice appears on a refusal (try `Create` empty once wave 2 lands) and not before.
  3. Events drawer opens in 100 ms to 160px with rows time/tone/area/sentence and `Load older`; `Clear` empties to four shimmer lines.
  4. Settings: scrim below the titlebar, three rail items, Theme/Accent/Reduce motion/Zoom work and change the page at once; `Sign out` returns to the sign-in page with the chrome in place; `?signedin=0` opens on sign-in.
  5. Tabs switch with the pill and `Ctrl+1`..`Ctrl+6`; the left toggle is disabled on every index.
  6. Console clean; no network request to `/api` (fixtures only).
  **Failure:** a text sentence over a skeleton, a dot for state, a tab that remounts (scroll lost), a horizontal page scroll at 900, a literal colour in a component, any `fetch`.
- **Exit.** The coordinator's six checks pass; `npm ls` shows no `hls.js` user left or the dependency is removed.

### Wave 2 - Channels (worker A)

- **Mode.** As wave 1, plus step 9's `RecordGrid`, `Checkbox` and `ToolbarStrip` built here (and the admin-only `StateWord` and `FolderRow` under `src/admin/src/components/records/`); the three go into `src/shared/ui` if it exists, else under `src/admin/src/components/records/`).
- **Does.** `ChannelsPage`, `ChannelsIndex` (toolbar `Preview →`, `NewChannelForm`, the list with ticks, Refresh in the heading), the live workspace (Details with the Plays switch between Folder and the `VideoList`, Playback, Fault, Status with the playlist and the copy icon, skeleton while preparing), the stream workspace (Details with `Edited` tags and `Revert to playlist`, Stream with a refused address, Status), `Rebuild` showing `preparing` for `FIXTURE_BUILD_MS` (3 s, fixture only), the statusbar's `N preparing`, `Apply` disabled until the channel is live, `Preview` gating on one ticked row and `?testpage`.
- **Files owned.** `components/channels/*`, `pages/ChannelsPage.tsx`, `fixtures/channels.ts`, `types/admin-channel.ts`, `constants/channel-copy.ts`, `components/records/{VideoList,FolderRow,...}`, `lib/` additions, their tests.
- **Tests.** `channel-rows.test.ts` (live state to word; synced/edited/disabled words; kind column); `new-channel-form.test.ts` (draft rules: name required, number 1 to 9999, folder or stream address by kind, `FieldError` text); `video-list.test.ts` (move up/down, remove, add keeps order, numbering); `fault-rules.test.ts` (Apply disabled unless live; milliseconds numeric); `channel-edit.test.ts` (Save on a synced row marks the field `Edited`; `Revert` clears it).
- **Acceptance.** Side by side with the mockup's Channels: group heading sizes (tile 48, mono title 28/36), the New form's rows each 36px with label column 164px, the Kind pills switch Folder and Stream address rows; the list grid columns `20 56 1.4fr 112 64 96 72 1.2fr 240` and 36px rows; ticking one row arms `Preview →` (a disabled `Preview →` shows `Tick a row first`); a row click opens the workspace, whose rail has `‹ Channels`, Details, Playback, Fault, Status with the selected one in accent with a 2px left strip; the sash drags between 190 and 380 and the toggle collapses the rail; Rebuild shows skeleton lines in Status and `1 preparing` in the statusbar and then `Fixture News is live.`; the armed `Delete Fixture News?` re-arms after 4 s; `Choose` is disabled with its tooltip in Chrome. In the Electron window (`npm run dev:app --prefix src/backend`, with the owner's say) `Choose` opens the native folder dialog.
- **Exit.** Both sizes match; the six-form probe of section 11 passes for the New channel form.

### Wave 3 - Providers and Titles (worker A)

- **Does.** Both tabs, their forms, grids, workspaces. Providers: Family pills switch the template row; Frame origins is `ChipsInput` (Enter adds, the chip's X removes); Message shape is a select (None, vidsrc-status, player-event). Titles: search, Kind chips (at least one stays on), Sort pills (Newest, Oldest, A-Z, Year, Trending), `Older`/`Newer`, the state word with `edited: plot` tooltip and `custom-0001` on a manual row, the series-only Seasons rail item and group (`SeasonList`), Sources read-only, `Revert to TMDB` disabled for a manual title with its reason.
- **Files owned.** `components/providers/*`, `components/titles/*`, `pages/ProvidersPage.tsx`, `TitlesPage.tsx`, their fixtures, types, copy, tests.
- **Tests.** `provider-rows.test.ts`, `provider-form.test.ts` (https template needs `{tmdbId}`; episode needs the three placeholders; origin is https with no path), `chips-input.test.ts` (add, dedupe, remove), `title-list-filter.test.ts` (search, kind, sort over fixtures), `title-state.test.ts` (synced, edited, manual, disabled), `season-list.test.ts`.
- **Acceptance.** As wave 2, per page; additionally: switching a Title's Kind in the New form changes nothing else (it is not a row switcher); a movie's workspace has no Seasons rail item; Titles' list heading shows `Older`/`Newer`, `Newer` disabled with `This is the first page.`.
- **Exit.** Both sizes match; probe passes for both New forms.

### Wave 4 - Playlists, Jobs, Accounts (worker A)

- **Does.** The three tabs. Playlists: masked address with `Replace` (the field unlocks, becomes a password-type input, `Replace` disables with `Type the new value, then Save.`), Status with channel links. Jobs: the Type pills switch Playlist versus Scope and Kind rows; the toolbar `Run job` runs the ticked jobs (fixtures: 3 s of `running`, pulsing bar, `N syncing` in the statusbar, then an event row and a refreshed last run), disabled with a reason when none ticked, a ticked job disabled or running, or its playlist disabled; the workspace `Run job` likewise; a bad interval is a field error. Accounts: `Set new password`, the last enabled account cannot be deleted or disabled, tooltip `Signs this account out everywhere`.
- **Files owned.** `components/playlists/*`, `jobs/*`, `accounts/*`, three pages, fixtures, types, copy, tests.
- **Tests.** `job-run-gate.test.ts` (the reasons, in priority order), `job-schedule-field.test.ts` (`6h`, `30m`, `24h`, `off`; `x` refused), `job-form.test.ts`, `account-guard.test.ts` (last enabled), `playlist-replace.test.ts`, `playlist-rows.test.ts`.
- **Acceptance.** As wave 2, per page, plus: run a job and see the row's state word turn `running` with the pulsing bar and then `idle`, the Events drawer gain `ada@example.test ran job <name>`, and the Last run group refresh.
- **Exit.** Both sizes match; probe passes for all six New forms.

### Wave 5 - audit rows, sweep, tests (worker A)

- **Does.** `Load older` pages through `audit.ts`; every page write appends its event row through `lib/event-sentence.ts`; a pass over the whole app for the leftovers of section 4.1 (`grep` finds no import of a removed file, no `fixtures/` import except pages and stores, no `hls.js`/radix in `package.json`); the `fixture-switches` and `useFixtureLoad` files are marked for deletion by `29`; `src/admin/README.md` lines for the final scripts; every file under 200 lines.
- **Tests.** `events-store.test.ts` (200-row cap, newest last, `Clear` is on-screen only, older rows prepended in time order); the whole `test/` set typechecks.
- **Acceptance.** The full sweep of section 11 on all pages at both sizes, light and dark, all five accents; the Electron window's caption strip follows a theme switch.
- **Exit.** Section 12.

## 11. The coordinator's visual acceptance, every wave

Run with the owner's say for any program start (`07` 4). Chrome MCP on `http://127.0.0.1:5172/admin/` (the admin's Vite) and the
mockup on `http://127.0.0.1:5190/`, the same state in both through the query switches, at **1600 x 1000** and **900 x 640**.

1. **Screenshot pairs.** For each page in the wave: the index, the workspace, the armed `Delete`, a disabled-control tooltip, the skeleton state (`?load=600` just after open), and the Events drawer open. Compare each pair; a difference is a failure unless section 5 resolved it.
2. **Measure, do not eyeball.** One probe over the page reads, from the DOM: heights (titlebar 40, statusbar 24, toolbar 40, form row control 36, grid row 36, grid header 24, drawer 160), the label column (164 in a page, 152 in Settings), the group tile (48) and title (mono 28/36), the rail (240 default), the sash (1px), the order of rows in each New form, the control type of each row, each control's width equals the row's, an info glyph on every row except Name/Title/Email/Password, one row markup. **All six New forms must produce the same shape** (the probe of `26` 4.4 item 7): row 1 is the name, row 2 the switching selector when there is one, every control full width.
3. **States.** Disabled, dimmed, armed, `edited`, `manual`, `preparing`, `failed`, `running` all drawn as words with the colours of the mockup; no dots anywhere (search the DOM for a rounded 6 to 8px element that carries state).
4. **Console and network.** No console errors or warnings; no request to `/api`, `/live` or any host (fixtures only); no `localStorage`/`sessionStorage`/IndexedDB write.
5. **Keyboard.** `Tab` order skips a closed pane; `Escape` closes the drawer, then a window; `Ctrl+1`..`Ctrl+6`.
6. **Failure means** the wave goes back to worker A with the exact differences; the coordinator does not fix it quietly (`07` 6.5).

## 12. Done when

Every page of section 7 is drawn and matches the mockup at both sizes; the six New forms pass the probe; every control works on
the fixtures or is disabled with its reason; the removed template files are gone and `grep` proves nothing imports them; `npm
run typecheck`, `npm run lint`, `npm test --prefix src/admin` and `node scripts/check-rules.mjs` are clean once the rule checker
covers `src/admin` (section 14); and the owner has seen each tab, one checkpoint per tab as `07` 2 asks.

## 13. Risks

1. **The pill at 900px.** Six equal-width tabs (the longest label, `Playlists`, sets the width) plus the brand and toggles are tight, most of all in Electron where the caption strip takes 138px; the probe reads the gap, and a collision switches both apps to a content-sized variant (section 5, item 3). The probe reads the gap.
2. **Library timing.** Waves may start before `27`'s steps land. Copy mode keeps them moving, and the swap is a mechanical commit; the danger is two copies diverging, so wave 1's brief forbids edits to a template UI file beyond what the admin needs, and lists each such edit in the report.
3. **`Group` folding and the rail's scroll spy** share ids; two groups with one id fold together. Ids are prefixed by page (`ch-details`, `lv-playback`).
4. **A 200-line limit** on the New forms (Channels, Jobs) is real: each row is a small component or the form splits into `NewChannelForm` plus `NewChannelRows`.
5. **The mockup is plain HTML**: `aria-disabled` plus swallowed clicks differ from React's `disabled`; `ReasonButton` is the one answer, and a test asserts it ignores clicks.
6. **Light theme** is untested in the mockup; a token missing there is a wave-0 finding, not an app bug.
7. **Fixtures that look like the real thing** hide missing states; the fixture set includes a failed, a disabled, an edited, a manual and a preparing record so every state word is drawn.
8. **The mockup worker cannot see a browser** (`23` section 1); the coordinator's check is the only visual gate.

## 14. What the coordinator changes when this lands

- **Root `package.json`:** `admin:dev` = `npm run dev --prefix src/admin`; `admin:build` = `npm run build --prefix src/admin`; `kill-ports` gains `5172`; the `dev` stack gains the admin's Vite (proposal in `29` section 12). `dist:win` is unchanged: the admin is not in the desktop installer.
- **`scripts/check-rules`:** `load-files.mjs` gets `["admin", "src/admin"]`; `import-boundaries.mjs` gets `admin: "src/admin"` in `PROGRAM_DIRS` and `ELECTRON_HOMES` gains `src/backend/src/app/` (the backend's host, built and currently the only violation the checker reports); `frontend-structure.mjs` and `type-scale.mjs` treat `src/admin/src/(components|pages)` like the frontend's; `frontend-fileserver-only.mjs` becomes `admin-backend-only` for the admin (its `/api` is the backend's). `27` section 4 adds the rest (`PROGRAM_ROOTS` gain `src/admin`, `src/shared/ui`, `src/shared/http`; the family-file diff check retires; the checker's naming and structure rules cover the library).
- **Gate (`scripts/check/gate.mjs`):** typecheck, lint and test steps for `src/admin`.
- **`AGENTS.md`:** the layout line for `src/admin`, the ports table row `Admin interface | 5172 (Vite) | served at /admin/ by the backend (8191)`, and `kill-ports` text.
- **`docs/01`:** 1.x gains the admin program; 4.1 and 4.2 (`27`); the tree in section 3. **`docs/03` section 1:** the port table gains 5172.
- **`docs/26`:** the status line points to `28` and `29`.

## 15. Choices made where the docs left a gap

- One worker for waves 1 to 5 (a sub-project), not one per tab, per the owner's few-agents rule.
- Zoom stays in Appearance (section 5, item 5); Light and System themes are enabled in the app.
- The pill is the interface's equal-width grid (`27` section 1), the mockup moving to it in wave 0, with the content-sized variant as the measured fallback.
- The admin's rail is a width and a sash, not the pane engine, as `27` section 5 says.
- `FolderRow` and `StateWord` are admin-only and stay out of the library; `27` section 5 step 9 lists the rest.
- The `Preview →` verb is drawn disabled-with-reason when `?testpage=0`, and otherwise only notices `Opened the test player.` in this plan; `29` gives it its real target.
- The step numbers of `27` are taken from the coordinator's summary until `27` lands.
