# 28 - Admin Visual Parity Plan (Waves 2 to 6 of the admin program)

**Status: PLAN, revised 2026-10-17 (the owner made the shared-UI extraction the first wave and named the template the authority
for look, feel and behaviour). Nothing in this document is built yet.** **Wave 1 = `27` steps 0 to 8; no admin page work starts
until it has landed and been accepted.** This document is Waves 2 to 6: it turns the cloned template into the admin app's
look, every page of the admin mockup drawn from typed fixtures with no network, on the library Wave 1 delivers. The wiring to
the backend is `29-ADMIN-BACKEND-WIRING-PLAN.md` (Waves 7 to 10, with the backend's own Wave 0). What the admin is, its pages
and its decisions are `26`; this document only plans how the clone gets there. Where this and `26`, `01` or `07` disagree,
those win and this is corrected first.

Governed by `00`, `01` (rules), `02` and `06` (the window and its chrome), `07` (protocol and delegation), `26` (the admin),
and `27` (the shared UI library the admin is built on; Wave 1).

## 1. Goal and non-goals

**Goal.** `src/admin` renders, in the family's own components, every page the admin mockup
(`D:\Projects\giga-stream-poc\src\admin-mockup`) draws, at 1600 x 1000 and at the 900 x 640 minimum: the titlebar with its
six-tab pill, the statusbar, the Events drawer, the Settings window (Appearance, Session, About), the Preview window, the
sign-in page, and for each of Channels, Providers, Titles, Playlists, Jobs and Accounts an index and a workspace (Channels has
two workspaces, live and stream). It looks, feels and behaves as the template does (the family's production frontend,
`src/admin/src` as cloned and its original `D:\Projects\giga-template-react\src\frontend`), and carries the mockup's content
and structure. Every control either works against the fixtures or is visibly disabled with its reason as a tooltip. The
two-step delete, the toggles, the pickers, the folds, the rail and its sash, the theme, accent, motion and zoom all work. In
Electron the caption-button strip follows the theme.

**Non-goals.**
- No network: nothing calls the backend, `services/api.ts` does not exist yet (`29`). Data is fixtures.
- No persistence: Appearance, the last tab, the panes and the window bounds live in the store and start from the defaults on
  every load. `29` saves them per account (`26` D16).
- No new design. The template and the mockup are the design; Appendix A says which wins for every difference found.
- No timers that send requests, no browser storage, no polling (`01` 4.4). The only timers are the fixture stand-ins of
  section 8, deleted in `29`.
- No change to `src/frontend`. Pieces the admin needs that the interface also has are in `src/shared/ui` (Wave 1); pieces only
  the admin needs are built into the library by the admin wave that first needs them (section 4.3), never into a copy.

## 2. Rules that hold

`AGENTS.md` and `01` bind every file: TypeScript strict, no `any`, `@ts-ignore` or double assertion; files at most 200
measured lines (tests 250); one exported component per file; `PascalCase.tsx`, hooks `useThing.ts`, everything else
kebab-case; no `utils`/`helpers`/`misc`/`common`; copy and numbers in named constants; one Zustand store. A control works or
is visibly disabled with its reason as a tooltip; no text under controls; loading and empty content are skeletons; state is a
word, never a dot; destructive actions are the inline `ArmedButton`; `alert`, `confirm` and `prompt` do not exist; no
placeholder text. `07` binds the workers: edit with the editor tools one file at a time, write tests but do not run the
suite, start no program, open no browser, never edit a doc, commit without pushing.

## 3. The program, the authorities and the library

### 3.1 The waves (the same list in `27`, `28` and `29`)

| Wave | What | Worker | Document |
|---|---|---|---|
| 0 | backend changes, including per-account UI state | B | `29` |
| **1** | **the shared library: `27` steps 0 to 8. No admin page work starts until it has landed and been accepted** | U1, U2, U3, U4 | `27` |
| 2 | shell and shared record pieces, with the Settings window | A | `28` |
| 3 | Channels, with the Preview window's UI | A | `28` |
| 4 | Providers and Titles | A | `28` |
| 5 | Playlists, Jobs and Accounts | A | `28` |
| 6 | audit rows, sweep, tests | A | `28` |
| 7 | request layer, auth, shell wiring, Settings persistence | A | `29` |
| 8 | Channels, Providers and the Preview window wired | A | `29` |
| 9 | Titles, Playlists, Jobs wired | A | `29` |
| 10 | Accounts wired, sweep | A | `29` |

Step 9 of `27` (the admin-only library pieces) is built inside Waves 2 to 6, by the wave that first needs each piece
(section 4.3).

### 3.2 The authorities (owner, 2026-10-17)

*"The mockup's behavior is mostly correct, but the template has the correct behavior since it is a clone of a production app.
You'll have to reconcile that properly. Besides that, the template shows you how it should look and feel."*

- **The template is the authority for look, feel and behaviour:** tokens, controls, forms, the disabled model, the two-step
  delete, tooltips, the Events drawer, keyboard, focus, theming and zoom, panes and rails, skeletons, notices, the work
  windows, the Settings window. Its code is `src/admin/src` (the clone) and, where the clone is the older snapshot, the
  interface's build of the same file in `src/frontend/src` (`27` section 1: the library takes the interface's build).
- **The mockup is the authority only for the admin-specific content and structure:** the six tabs, each index and workspace,
  the field order, the New forms, the toolbars, the fixtures' shapes, and the admin-only behaviours the template has no
  equivalent for (row selection arming a forward verb, the record grid, the state word, the toolbar strip, `Load older`,
  the masked secret, the video and season lists).
- **Where they differ,** Appendix A gives the verdict, one row per behaviour, with the template files each verdict uses. The
  mockup is not edited: it is read for content and structure. Its look and its behaviour are not built where Appendix A says the
  template wins (for example its tooltip bubble, its `aria-disabled` model, its placeholders, its hand-made window, its
  custom rail sash and its content-sized hand-drawn controls).

### 3.3 What Wave 1 gives the admin

`27` section 2's tree, imported as `@giga/ui/<folder>/<File>` and `@giga/http/<File>`: `styles` (tokens, base, fonts,
keyframes, motion-reduce, video), `controls` (`Button`, `IconButton`, `Field`, `Toggle`, `Segmented` with the field size,
`ChipGroup`, `ChipsInput`, `InlineLink`, `ArmedButton`, `Swatches`), `form` (`Form`, `NumericInput`, `Tooltip`), `lists`
(`DataTable`, `SkeletonRows`, `SkeletonCards`, `Reveal`, `NavRail`), `shell` (`Brand`, `TabPill`, `Titlebar`, `Statusbar`,
`RunningWork`, `EventRow`, `EventsDrawer`, `AppShell`), `windows` (`ChildWindow`, `SettingsFrame`, `PopupPanel`), `panes`
(`WorkspaceSplit` and its engine, with `PaneHost` and a limits table), `hooks`, `lib`, `store/chrome-slice`. After Wave 1 the
template's own copies of all of these are gone from `src/admin` (`27` section 6.3), so **every wave in this document works
against the library; there is no copy mode.**

## 4. Inventory of the template after Wave 1

The template is the Giga Stream interface at phase 1 (`@giga/stream-frontend` before the rename): three surfaces (Live,
Library, Player), the Collections and Title windows, fixtures and refusing stubs. After Wave 1 `src/admin/src` holds that
demo app without its UI kit, chrome frame, window frame or pane engine (they are imports now). Its content is not the admin's.

### 4.1 What is kept, replaced or removed

| Path (under `src/admin/`) | Disposition |
|---|---|
| `index.html`, `public/favicon.svg`, `vite.config.mts`, `tsconfig*.json`, `package.json` | **kept** as scaffolded (base `/admin/`, port 5172). `package.json` **keeps `hls.js`** (the Preview window plays HLS, section 7.4) and `allotment` (the pane engine) and drops `@radix-ui/react-dropdown-menu` when its last user goes (Wave 2: the admin draws no context menu) |
| `src/main.tsx`, `src/index.css` | **kept**; `index.css` is imports and `@source` only |
| `src/components/chrome/App.tsx` | **rewritten** (`useTheme`, the key-map hook, `useCaptionOverlay`, `MotionConfig`, `AppShell`) |
| `src/components/chrome/AppShell.tsx` | **rewritten**: the library `AppShell` with the admin's slots: titlebar, the six tab pages, the sign-in page, the events drawer, the statusbar, the overlay host. No context menu host |
| `src/components/chrome/WorkspaceSplit.tsx` and the pane engine files | **gone** (Wave 1, step 8); the admin's workspace page uses the library's `WorkspaceSplit` |
| `src/components/ui/*` | **gone** (Wave 1) except `PosterImage.tsx` (removed with the demo) and `LogoImage.tsx` (**kept**: the Channels logo preview uses it) |
| `src/components/overlays/CollectionsWindow.tsx`, `TitleInfoWindow.tsx` | **removed** |
| `src/components/overlays/OverlayHost.tsx`, `SettingsWindow.tsx` | **changed**: the one open flow is `settings` or `preview`; Settings composes the library's `SettingsFrame` |
| `src/components/settings/*` | `AppearanceSection.tsx`, `ZoomStepper.tsx`, `AboutSection.tsx` **changed**; `AdminBackendSection.tsx`, `LibrarySection.tsx`, `PlaybackSection.tsx` **removed**; `SessionSection.tsx` **new** |
| `src/components/collections/*` | **removed** after their pattern is read by the Channels worker (`CollectionsIndex`, `CollectionRows`, `NewCollectionForm`, `CollectionWorkspace`, `CollectionDetailsGroup`, `FolderControls` are the reference screens; the same screens run in the interface's Collections window) |
| `src/components/library/*`, `live/*`, `player/*`, `popups/*` | **removed** (demo content). `live/LivePlayer.tsx` is read once for the video element's props (section 7.4) |
| `src/pages/LibraryPage.tsx`, `LivePage.tsx`, `PlayerPage.tsx` | **removed**; replaced by six `*Page.tsx` and `SignInPage.tsx` (section 6) |
| `src/store/app-store.ts`, `navigation-slice.ts`, `selectors.ts` | **rewritten**: one store, the library's chrome slice spread in, plus the admin's slices (section 6.1) |
| `src/constants/surfaces.ts` | **replaced by `constants/tabs.ts`** (the pane limits table the engine reads) |
| `src/constants/settings-sections.ts` | **rewritten** (three sections and their labels); `child-window`, `motion`, `timing`, `popups` are gone (Wave 1) |
| `src/hooks/*` | kept only if not moved by Wave 1 and used: none expected. Removed: `useCollectionVerbs`, `useContextMenu`, `useLibraryRequest`, `useLiveActions` |
| `src/lib/*` | removed: every `collections-*`, `library-*`, `live-*`, `player-*`, `rows-*`, `menu.ts`, `playback-prefs.ts`, `poster-tone.ts`, `settings-address.ts`, `settings-language.ts`, `collection-menu.ts` |
| `src/fixtures/*` | **removed**, replaced by the admin's (section 8) |
| `src/services/*` | **removed** (`not-connected.ts` and its refusing stubs); the admin's only service in this plan is `services/admin-host.ts` (the Electron preload, section 9.5) |
| `src/types/*` | kept trimmed: `shell.ts` (`Tab`, theme, accent, motion), `events.ts` (areas changed), `overlays.ts`. Removed: `channel`, `collection`, `job`, `library`, `menu`, `player`, `settings`, `title` (the admin's own replace them) |
| `test/*.test.ts` | kept and adapted: `app-store`, `shell-keyboard`, `settings-zoom` (repointed or moved by Wave 1). **Removed:** `collections-*`, `library-*`, `live-*`, `player-*`, `playback-prefs`, `rows-*`, `settings-address`, `settings-language` |

### 4.2 What Wave 1 already retired

`27` section 6.3 lists, step by step, every file Wave 1 deletes from `src/admin` and the `@giga/ui` module that replaces it.
Wave 2's first commit starts from that state; a worker who finds a copy still there reports it, and does not edit it.

### 4.3 Admin-only pieces built into the library (step 9 of `27`)

`27` section 5, step 9 names these; the admin waves write them straight into `src/shared/ui` (not `src/admin`) because the
interface can use them too. Each is built by the wave that first needs it, with its test in the library, in the folder `27`
section 2 gives it.

| Piece | Library home | Responsibility | First needed by |
|---|---|---|---|
| the `reason` prop on `Button` and `IconButton` | `controls/` | the template's disabled model (Appendix A, row 4): the control is natively `disabled` and, when a reason is given, wrapped in the `Tooltip` with `focusable` and a `label` of "Verb. reason", exactly as `ResumeFooter` and `PlayerBrowser` do in the interface; the wrapper is the only addition | Wave 2 |
| `ToolbarStrip` | `shell/` | the 40px strip under the titlebar: right-aligned verbs, `Discard changes` ghost, `Save` edged, one filled forward verb | Wave 2 |
| the tooltip arrow that follows its anchor | `form/` | `Tooltip` gains an arrow offset so a bubble clamped to the viewport still points at its anchor (`26` section 5, kept by `27`) | Wave 2 |
| the shell's minimum size | `shell/` | `AppShell` takes `minSize` (900 x 640): the shell keeps that size and scrolls inside a smaller browser window | Wave 2 |
| `RecordGrid` (+ `RecordGridRow`, `SkeletonGrid`) | `lists/` | the index list in the template's `CollectionRows` vocabulary (header sans 12px semibold faint on the panel over a hairline, rows 36px, a spanning row button, an `ArmedButton` at the end), plus a selection column, a selected fill, a state word, mono numbers, skeleton rows in the header's own column set, a dimmed disabled row, a list-own horizontal scroller with a minimum width | Wave 3 |
| `Checkbox` | `controls/` | the row-selection tick (20px, accent when on); **row selection only**, never a field (`Enabled` is the `Toggle`) | Wave 3 |
| `ChipGroup` as pills | `controls/` | the any-of chip row drawn in the `Segmented` pill vocabulary, with a `min` count (the last required chips cannot be switched off, with their reason) and the field size; no interface surface uses `ChipGroup` today | Wave 3 |
| `ChipsInput` `className` | `controls/` | a row can give the chips box the field height | Wave 4 |

`StateWord`, `FolderRow` (a `Row` with a mono field and a trailing ghost `Choose` button) and the ordered `VideoList` and
`SeasonList` are admin-only and live in `src/admin/src/components/records/`.

## 5. What wins: the rule, and the table

The rule is section 3.2. The table is **Appendix A**; this section lists only what a reader needs before the first wave:

1. **Every control is the template's** (`Button`, `Field`, `Toggle`, `Select`, `Segmented`, `ChipsInput`, `NumericInput`,
   `Tooltip`, `ArmedButton`, `Row`, `Group`): their look, sizes, durations, states and keyboard are not redrawn.
2. **A disabled control is natively `disabled` and its reason rides the focusable `Tooltip`;** nothing in the admin uses
   `aria-disabled` plus a swallowed click (the mockup's model).
3. **The record pattern of `26` section 4.4 is the mockup's:** the toolbar strip, `Discard changes` / `Save` / a forward verb,
   one Save per page, a tick column that arms the toolbar, a click on a row opening its workspace, the field order, the
   Kind/Type/Family switch in row 2, the glyph rule, the state word, `Enabled` as a switch.
4. **Required fields disable `Create` with the reason** (the template); **value refusals** (a number outside 1 to 9999, an
   address the rule refuses, a backend `422`) appear under their row, on the notice line and as `aria-invalid` (the mockup's
   structure, drawn with the template's `Row error`).
5. **The rail, its sash, collapse and the page scroll are the template's pane engine and scroll spy;** the rail's contents
   are the mockup's.
6. **The Settings window is the template's window** (centred at its content's size, at most 80% of the main window, never
   below 658 x 412, moved, resized, remembered, modal); its three pages' content is the mockup's.
7. **Preview** is a template `ChildWindow` (section 7.4).

## 6. The target tree of `src/admin/src`

Every file at most 200 lines (the bound beside it is the expected size), one component per file. "(lib)" marks a piece that
is imported from `@giga/ui` and is not written under `src/admin` at all.

### 6.1 Shell and shared admin pieces

| File | Responsibility | Bound |
|---|---|---|
| `main.tsx` | mounts `<App/>`; imports the CSS | 12 |
| `components/chrome/App.tsx` | `useTheme`, the key-map hook, `useCaptionOverlay`, `MotionConfig`, `AppShell` | 25 |
| `components/chrome/AppShell.tsx` | the library `AppShell` with `minSize`: titlebar, signed-in pages or the sign-in page, events drawer, statusbar, overlay host | 60 |
| `components/chrome/AdminTitlebar.tsx` | the library `Titlebar` with `Brand` subtitle `ADMIN`, the six-tab `TabPill`, the left toggle (disabled on an index, reason `This page has no left pane.`), the Events toggle, the right toggle disabled (`The admin has no right pane.`) | 60 |
| `components/chrome/AdminStatusbar.tsx` | the library `Statusbar` and `RunningWork` with `N preparing` / `N syncing` over a full pulsing bar, `Stop` always disabled with its reason (mockup `statusbar.js`), the notice, `Events`, `Settings` | 50 |
| `components/chrome/AdminEventsDrawer.tsx` | the library `EventsDrawer` fed from the store's events, with `Load older` and the `N events` line | 40 |
| `components/chrome/WorkspaceFrame.tsx` | a workspace: the library `WorkspaceSplit` (left pane `<tab>.left`, limits from `constants/tabs.ts`), the rail as its left pane and, as its centre, the toolbar plus the scrolling page; takes `tab`, `rail`, `toolbar`, `children` | 70 |
| `components/records/RecordRail.tsx` | the library `NavRail` with its `back` button (the template's full-width stock `Button` with an arrow, labelled with the tab) and `NavItem`s driven by `useScrollSpy`; takes `back`, `sections`, `spy` | 50 |
| `components/records/WorkspaceToolbar.tsx` | the library `ToolbarStrip` for a workspace: `Discard changes` (ghost), `Save` (edged), the forward verb (filled accent); each prop is `{ label, onPress, reason? }`; Discard and Save are disabled with `Nothing has changed.` while the draft equals its baseline | 60 |
| `components/records/NewRecordGroup.tsx` | the "New <record>" `Group` frame: plus tile, title, fold, children, the final `Create` primary (disabled with the missing field's reason) | 50 |
| `components/records/ListGroup.tsx` | the list `Group` frame: tile, title, heading action slot (`Refresh`, `Older`/`Newer`), the `RecordGrid` as its body | 50 |
| `components/records/StateWord.tsx`, `FolderRow.tsx` | admin-only; stay in `src/admin` | 30, 70 |
| `components/records/VideoList.tsx` | the live source's ordered video rows (index, path, up, down, remove) and the add row (a path field and `Add`; no `Choose`, because the preload's picker is for folders only, `29` section 13) | 120 |
| `components/records/SeasonList.tsx` | the title's editable seasons (season, episode count, remove) and `Add season` | 100 |
| `components/session/SignInForm.tsx` | the sign-in `Group` (Email, Password, `Sign in`) | 70 |
| `pages/SignInPage.tsx` | centres `SignInForm` in the page area; the titlebar and statusbar stay | 30 |
| `components/settings/AppearanceSection.tsx`, `ZoomStepper.tsx`, `SessionSection.tsx`, `AboutSection.tsx` | Settings' three pages, in the library `SettingsFrame` | 40 to 80 |
| `components/overlays/OverlayHost.tsx`, `SettingsWindow.tsx` | the one open flow (`settings` or `preview`), Settings | 25, 60 |
| `hooks/useShellKeys.ts` | the admin's key map for the library hook: `Ctrl+1`..`Ctrl+6` pick the tabs, `Ctrl+,` opens Settings, `Ctrl+0` resets zoom, `Ctrl+F` focuses the Titles search (`data-search`), `Escape` closes the events drawer | 40 |
| `hooks/useCaptionOverlay.ts` | in Electron, pushes the theme's bar colours (read from `--color-panel` and `--color-faint`) and the height (`(TITLEBAR_HEIGHT - 1) * uiZoom`) to `window.adminHost.setOverlay` on a theme, accent or zoom change; a browser does nothing (adapted from `fe:hooks/useNativeOverlay.ts`) | 40 |
| `hooks/useFixtureLoad.ts` | the stand-in: a list wears skeleton rows for `FIXTURE_LOAD_MS` on first open; deleted by `29` | 30 |
| `hooks/useRecordForm.ts` | a record form's draft: initial values, dirty, `discard`, field errors, required-field check against `lib/field-checks.ts` | 90 |
| `hooks/usePreviewSession.ts` | the Preview window's fixture session: the channel's state and problem, a player error, `retry`; replaced by `29`'s real one | 60 |
| `constants/tabs.ts` | `TABS` (id, label, `Ctrl+N` hint), `TAB_ORDER`, `DEFAULT_TAB = "channels"`, the pane limits table `{ left: { min: 190, max: 380, preferred: 240 } }` per `<tab>.left`, no right or bottom pane | 40 |
| `constants/record-copy.ts` | tooltips, reasons, titles shared by every tab (`TICK_FIRST`, `TICK_ONE`, `SAVE_FIRST`, `NOTHING_CHANGED`, `LAST_ACCOUNT`, `NO_LEFT_PANE`, `NO_RIGHT_PANE`, the two-step sentences) | 60 |
| `constants/channel-copy.ts`, `provider-copy.ts`, `title-copy.ts`, `playlist-copy.ts`, `job-copy.ts`, `account-copy.ts` | the tab's labels (also the `labelColumn` list), info-glyph tips (copied from the mockup's `data-tip`), options | 40 to 90 |
| `constants/preview-copy.ts` | the Preview window's title, state-line words and its `Retry` label | 30 |
| `constants/settings-sections.ts` | the three sections and `SETTINGS_LABELS` | 40 |
| `constants/fixture-switches.ts` | reads `?signedin=0`, `?load=0` (mockup parity); deleted by `29` | 20 |
| `lib/field-checks.ts` | pure: required, 1 to 9999, https address, schedule `^\d+[mh]$|off`, year, rating | 80 |
| `lib/row-state.ts` | pure: a record to its state word and row `data-st` (channel, title, job, playlist, provider, account) | 90 |
| `lib/event-sentence.ts` | pure: an audit-shaped fixture entry to its tone, area and one sentence (`ada@example.test updated channel Fixture News`); reused unchanged by `29` | 100 |
| `lib/preview-state.ts` | pure: a channel's state, problem and the player's error to the one status line, `Retry`'s visibility and whether the stage wears its skeleton | 50 |
| `lib/live-time.ts` | pure: `00:42` style duration, clock | 25 |
| `services/admin-host.ts` | `hostAvailable()`, `chooseFolder()`, `setOverlay()` over `window.adminHost` (section 9.5); the only service in this plan | 50 |
| `store/app-store.ts` | the one store: `createChromeSlice` spread in, plus the slices below | 150 |
| `store/workspace-slice.ts` | `tab`, `open` (the open workspace id per tab), `openWorkspace`, `closeWorkspace`, `requestTab` (forward verbs and links) | 70 |
| `store/panes-slice.ts` | the library's `PaneHost` contract for the left panes: `open`, `sizes`, `openVersion`, `togglePane`, `commitSizes` | 50 |
| `store/session-slice.ts` | `signedIn`, `actor` (fixture), `signOut`; replaced by `29`'s real session | 40 |
| `store/selectors.ts` | `useTab`, `usePaneOpen`, `useWorkSurfaceOpen` | 25 |
| `types/shell.ts`, `events.ts` | trimmed; the event `area` is a string the app types as `Connection | Session | Channel | Provider | Title | Playlist | Job | Account` | 15 to 45 |
| `types/admin-channel.ts`, `admin-provider.ts`, `admin-title.ts`, `admin-playlist.ts`, `admin-job.ts`, `admin-account.ts`, `admin-audit.ts` | the **backend's own response shapes** (listed in `29` section 5), so wiring replaces only the source of the data | 30 to 80 |

### 6.2 The six tabs

| Tab | Index | Workspace |
|---|---|---|
| Channels | `pages/ChannelsPage.tsx` (30) chooses index or workspace from `open.channels`; `components/channels/ChannelsIndex.tsx` (50), `NewChannelForm.tsx` (140), `ChannelRows.tsx` (110, columns and `Delete`) | `ChannelWorkspace.tsx` (60, live or stream), `LiveDetailsGroup.tsx` (150), `PlaybackGroup.tsx` (80), `FaultGroup.tsx` (90), `LiveStatusGroup.tsx` (100), `PlaylistRows.tsx` (50), `StreamDetailsGroup.tsx` (110), `StreamAddressGroup.tsx` (60), `StreamStatusGroup.tsx` (60); the Preview window: `PreviewWindow.tsx` (60), `PreviewStage.tsx` (60), `PreviewStatus.tsx` (40) |
| Providers | `ProvidersPage.tsx`, `providers/ProvidersIndex.tsx`, `NewProviderForm.tsx` (110), `ProviderRows.tsx` | `ProviderWorkspace.tsx`, `ProviderDetailsGroup.tsx` (110), `ProviderTemplatesGroup.tsx` (90), `ProviderPlayerGroup.tsx` (90) |
| Titles | `TitlesPage.tsx`, `titles/TitlesIndex.tsx`, `NewTitleForm.tsx` (80), `TitleListGroup.tsx` (130: search, kind chips, sort, `Older`/`Newer`), `TitleRows.tsx` | `TitleWorkspace.tsx`, `TitleDetailsGroup.tsx` (160), `TitlePlotGroup.tsx` (70), `TitleSeasonsGroup.tsx` (60), `TitleSourcesGroup.tsx` (60) |
| Playlists | `PlaylistsPage.tsx`, `playlists/PlaylistsIndex.tsx`, `NewPlaylistForm.tsx` (70), `PlaylistRows.tsx` | `PlaylistWorkspace.tsx`, `PlaylistDetailsGroup.tsx` (90, masked address with `Replace`), `PlaylistStatusGroup.tsx` (80) |
| Jobs | `JobsPage.tsx`, `jobs/JobsIndex.tsx` (the filled `Run job` verb on the ticked rows), `NewJobForm.tsx` (140, Type switches the rows), `JobRows.tsx` | `JobWorkspace.tsx`, `JobDetailsGroup.tsx` (120), `JobScheduleGroup.tsx` (60), `JobRunGroup.tsx` (90), `JobLastRunGroup.tsx` (110) |
| Accounts | `AccountsPage.tsx`, `accounts/AccountsIndex.tsx`, `NewAccountForm.tsx` (80), `AccountRows.tsx` | `AccountWorkspace.tsx`, `AccountDetailsGroup.tsx` (80), `AccountPasswordGroup.tsx` (60) |

A tab's `*Page.tsx` is the only file that reads `open[tab]`. Each page stays mounted when another tab is active (it is hidden),
so scroll and form state survive a tab switch, as the template's surfaces and the mockup do.

## 7. Design authority: page by page

The mockup root is `D:\Projects\giga-stream-poc\src\admin-mockup` (`html/` partials, `css/`, `js/`), served at
`http://127.0.0.1:5190/` by `npm run admin-mockup` (the coordinator starts it only after asking the owner); it is read for
**content and structure**. The family screenshots are in `docs/reference/family/` (gitignored, local): `datasets-index.jpg`
(titlebar, folder row, group), `dataset-workspace.jpg` (rail), `training-index.jpg` and `training-workspace.jpg` (toolbar
verbs, list), `setup.jpg` (statusbar), `events-drawer.jpg`. **For look, feel and behaviour the reference is the template's
equivalent screen, run in the interface on the owner's stack** (Library > Manage collections is the index and workspace
pattern; Settings is the window; the Live and Player surfaces are the shell), and the template files named in Appendix A.

### 7.1 Shell

| Surface | Mockup files (content) | Template/library parts (look and behaviour) | Notes |
|---|---|---|---|
| Titlebar (40px) | `html/titlebar.html` | `Titlebar`, `Brand`, `TabPill`, `IconButton` (ghost toggles) | Glyphs: `panel-left`, `panel-bottom` (the Events band), `panel-right`. Pill tabs, in order: Channels, Providers, Titles, Playlists, Jobs, Accounts, each titled `<Tab> (Ctrl+N)`. The pill is the only navigation. Left toggle is the rail; on an index it is disabled with `This page has no left pane.` The caption strip is left free as the template does |
| Statusbar (24px) | `html/statusbar.html`, `js/statusbar.js` | `Statusbar`, `RunningWork` | `idle` or `N preparing`/`N syncing` over a full pulsing bar (the progress is unknown), `Stop` (`square`) always disabled with its reason (`A channel build cannot be cancelled; change or delete the channel.` / `A sync cannot be cancelled.` / `Nothing to stop`), one polite notice with a `circle-alert` glyph for warn and error, `Events` (`panel-bottom`, lit while open), `Settings` (`settings`) |
| Events drawer (160px) | `html/events.html`, `js/event-log.js` | `EventsDrawer`, `EventRow` | Head `Events`, `N events`, `Clear`; rows time, tone word, area, sentence; `Load older` row at the top; shimmer lines when empty; tweens 0.1 s; at most 200 rows |
| Settings window | `html/settings.html` | `ChildWindow`, `SettingsFrame` | A modal work window opened by `Ctrl+,` or the statusbar: centred at its content's size (960 x 700 content), at most 80% of the main window, never below 658 x 412, moved by its header, resized by eight grips, remembered for the run, scrim from the titlebar down (the titlebar slice stays a drag strip), the main window deaf behind it. Rail 150px (210 from the `lg` breakpoint); three pages: Appearance (`palette`: Theme, Reduce motion, Accent, UI zoom, `Restore defaults`), Session (`user`: Signed in as, name, `Sign out`), About (`info`: Version, Backend version, Backend revision, Address, Runtime, TMDB); label column from `labelColumn(SETTINGS_LABELS)` so it does not move as the rail changes page |
| Sign-in | `html/signin.html` | `Form`, `Group`, `Row`, `Input` | A page in the centre, not a modal; titlebar and statusbar stay, the tabs are disabled with `Sign in first`; Email, Password, one primary `Sign in`, disabled until both are filled (reason `Enter your email and password.`); `Enter` submits |
| Preview window | none (`26` section 4.5a) | `ChildWindow`, `workSpec` | section 7.4 |

### 7.2 Indexes and workspaces

Every page is `Workspace`/`Group`/`Row` of the form kit with the mockup's markup order and tips. The group icons (lucide names)
are fixed by the mockup:

| Page | Mockup file(s) | Group (icon) | Toolbar | Rail |
|---|---|---|---|---|
| Channels index | `channels-index.html`, `js/grid.js` | New channel (`plus`), Channels (`radio`, `Refresh` in the action slot) | `Preview →` (filled), needs exactly one ticked row (`Tick a row first`, `Tick only one row`); acts on a live or a stream channel | none |
| Live channel | `channel-workspace.html`, `js/workspace.js`, `js/vlist.js` | Details (`file-text`, `Rebuild` `hammer`), Playback (`play`), Fault (`zap`), Status (`activity`) | `Discard changes`, `Save`, `Preview →` (disabled `Save the channel first` while the draft is dirty) | `‹ Channels`, Details, Playback, Fault, Status |
| Stream channel | `channel-workspace-stream.html`, `js/stream.js` | Details (`file-text`, `Revert to playlist` `undo-2`, synced rows only), Stream (`radio`), Status (`activity`) | `Discard changes`, `Save`, `Preview →` (same gate) | `‹ Channels`, Details, Stream, Status |
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

The rail is the library `WorkspaceSplit`'s left pane: 240px by default, clamped 190 to 380, resized by the engine's sash,
collapsed by the titlebar toggle with the engine's 100 ms tween, `inert` while closed. The rail's back button is the
template's: one full-width stock `Button` with an arrow, named for the tab. The groups are separated by the accent-cored
splitter the `Group` draws itself.

### 7.3 Fields, in the order of `26` 4.4

The New form and the workspace's Details carry the same fields in the same order: **(1) required, (2) Enabled, (3) optional,
(4) read-only**. Row 1 is always the record's name (Name, Title, Email); row 2 is the Kind, Type or Family control **when it
switches the rows below it**. An info glyph (the `Row`'s `tip`) sits on every row except Name, Title, Email and Password.
Every control spans the row at 36px (`FIELD_CONTROL`; a Segmented in its field size, equal segments); the Toggle is the one
exception. One row component everywhere: `Row` with its label, glyph, control, `trailing` and `error`. There is no
placeholder text. Each page passes its label list to `Workspace`, so one label column is sized per page by `labelColumn`.

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
`Select` for live and free text for stream. A New form's `Create` is disabled, with the reason `<Label> is required.`, while a
required field is empty (the template's model). A value the page's own checks refuse (a number outside 1 to 9999, an address
the rule refuses) is the `Row`'s `error` under its row, the same sentence on the notice line, and `aria-invalid` on the field;
the rows a Kind or Type switches are rendered or not rendered, not hidden.

### 7.4 The Preview window (`26` section 4.5a)

`Preview →` on the Channels index (one ticked row) and on a channel workspace's toolbar opens a **child window** titled
`Preview`: the template's `ChildWindow` with a spec made by `workSpec("preview", "Preview", { width: 640, body: 420, minWidth:
420, minBody: 300 })`, so it opens centred at that size (at most 80% of the main window), is moved by its header, resized by
its edges, closed by its `X` or `Escape` (not while typing), returns focus to its opener, remembers its bounds with the other
work windows, and is one flow at a time (opening it replaces Settings, and the reverse). It holds exactly:

- a 16:9 stage on `--color-stage` with a `<video controls playsInline muted>` (muted until the person unmutes; the native
  controls), always mounted, fitted whole;
- while the channel is `preparing` or `starting` the stage wears a `SHIMMER` skeleton the size of the picture over the video,
  never an empty card, and nothing is attached;
- under the stage, **one mono status line** and a ghost `Retry`: the channel's state (`preparing`, `starting`, `live`,
  `restarting`, `stopped`, `failed`) and its `problem`, then the player's own error when it cannot load or play
  (`manifest failed`, `media error`, `unreachable`); a stream channel has no state, so its line is the player's phase
  (`loading`, `playing`) or its error;
- no other control: no quality picker, no fault injection, no test page.

In this plan the window runs on fixtures: `usePreviewSession` returns the channel's fixture state and problem and a fixture
player error, and `Retry` sets the notice `Retried.`; the video has no source, so a `live` fixture shows the dark idle stage.
The disabled reasons: the index verb `Tick a row first` / `Tick only one row` (the mockup's), the workspace verb `Save the
channel first` while the draft is dirty. `29` section 9.7 gives the window its real player, state and Retry. The window is a
modal work window, like Settings, because no flow of the app is yet a non-modal tool window (choice, section 15).

The video element, the HLS decision and the dependency are the interface's: `src/frontend/src/components/live/LivePlayer.tsx`
is a bare `<video>` driven by `hooks/useStreamPlayer.ts`, which owns a `StreamPlayerController`
(`services/stream-player.ts`) over a `StreamEngine` (`services/stream-player-engine.ts`, hls.js) and `styles/video.css`
(now in the library). The admin adds `hls.js` (^1.7.3, the interface's pin, already in the cloned `package.json`) and its own
small `services/preview-player.ts` in `29`.

## 8. Fixtures

`src/admin/src/fixtures/`, typed with the `types/admin-*.ts` shapes (the backend's own, so `29` replaces the source and not
the shape). Example hosts only (`example.test`). The data is the mockup's `js/fixtures.js`, `event-log.js` and the grid rows of
`html/*-index.html`:

| File | Content |
|---|---|
| `channels.ts` | six live channels (Fixture News/Sports/Music/Kids/Movies/Archive: states live, preparing, live, stopped, failed, stopped-and-disabled) and three stream channels (two synced, one edited, one by hand); the live ones carry settings, playlist rows with durations, `nowPlaying`, renditions, and `problem` for the failed one (the Preview window reads state and problem here) |
| `providers.ts` | Cinezo, VidSrc, VixSrc (enabled) and VidZee (disabled) with templates, parameters, origins, frame origins, message shapes |
| `titles.ts` | The Matrix, Game of Thrones (3 seasons), Inception (edited), Breaking Bad, a manual title, a disabled series |
| `playlists.ts` | IPTV main (enabled), Community lists (disabled), with host, masked address, channel ids, last sync, outcome |
| `jobs.ts` | Sync IPTV main, Sync Community lists, Trending movies, Trending series, Popular movies (failed), Popular series (disabled), with schedule, counts, refusals, created ids |
| `accounts.ts` | ada (enabled), ed and eve (disabled), last sign-in |
| `audit.ts` | the mockup's 13 recent and 8 older entries as `AuditEntry` shapes; `lib/event-sentence.ts` turns them into rows |
| `session.ts` | the fixture actor `ada@example.test`; Settings' About facts (version, backend revision, runtime) |

`constants/fixture-switches.ts` keeps the mockup's `?signedin=0` and `?load=0` so the two apps can be put in the same state for
comparison (`?testpage=0` is gone: Preview does not depend on `TEST_PAGE`). `hooks/useFixtureLoad.ts` shows the grid skeleton
for `FIXTURE_LOAD_MS = 600` on first open, then `Reveal` fades the rows in.

## 9. Shared decisions

1. **One record pattern.** An index is the toolbar strip, a New group, and the list group, nothing else; a click on a row (not on its tick or its `Delete`) opens the workspace; there is no `Open` button or double-click. A workspace is the rail, one scrolling page of groups, and the toolbar; ONE `Save` per page. Delete lives on the index row only.
2. **State is a word** in the list (`live`, `preparing`, `failed`, `stopped`, `disabled`, `synced`, `edited`, `manual`, `idle`, `running`), coloured by state; a disabled record stays in its list dimmed to 45%; a running job also shows a pulsing 48px bar (the template's `animate-pulse-busy`). No dots, no left-edge strip on a list row.
3. **Two-step delete** is `ArmedButton`: ghost `Delete` at rest, the danger question naming the record (`Delete Fixture News?`) when armed, re-arming after `TWO_STEP_MS` (4 s), disarmed by blur and Escape. A synced row's, a title's and a playlist's tooltips say what happens next (mockup `data-tip` text). The last enabled account's `Delete` is disabled with `The last enabled account cannot be deleted.`
4. **Disabled controls** explain themselves through the `reason` prop (Appendix A, row 4); a disabled `Segmented` chip carries `disabledReason` as its title. Every info glyph is an `InfoTip` with the mockup's sentence.
5. **No roles and no provider API key** exist anywhere (`26` D22, D24). No role column, no key field, no role gate on a tab.
6. **Appearance.** Theme (Dark, Light, System), Reduce motion (Follow system, Off, On), Accent (amber, blue, green, violet, rose swatches), UI zoom with `Restore defaults`; all applied at once through the store. In this plan nothing is saved: a reload starts at the defaults. `29` persists them per account (`26` D16).
7. **Window.** Minimum 900 x 640 (the shell keeps that size and scrolls inside a smaller browser window; the Electron window cannot go below it); the design size is 1600 x 1000; the page never scrolls horizontally except a list's own scroller, whose columns have the mockup's minimums.
8. **Caption buttons.** In Electron (`window.adminHost` present) the titlebar leaves the strip free (`pr-[calc(100%-env(titlebar-area-width,100%)+8px)]`, as the template does) and `useCaptionOverlay` calls `setOverlay({ color, symbolColor, height })` when the theme, the accent or the zoom changes. The values are the tokens `--color-panel` and `--color-faint` read from the document, not literals. In a browser the hook does nothing.
9. **`Choose`.** `FolderRow` calls `chooseFolder()`; when `window.adminHost` is absent the button stays in place, visibly disabled, with the tooltip `Folders can be chosen only in the backend's own window; type the path.`; the field stays a typed path. A cancelled dialog (`null`) changes nothing.
10. **Skeletons.** A list that is loading or empty draws `SkeletonGrid` rows in the header's column set inside the group, and the rows land through `Reveal`; a preparing live channel's Status group swaps its facts for shimmer lines in their shape; the events drawer shows five shimmer lines when empty (the template's). No sentence ever sits over a skeleton.
11. **Forward verbs** (`Titles →`, `Jobs →`, `Channels →`) call `requestTab(tab, id?)`, which switches the tab and opens the named workspace or its index; a link from a Playlist's channels or a Job's created ids opens that channel.
12. **Fixture edits** persist in the store for the session so a Save, a Create and a Delete are visible in the list, and each writes the event row the mockup writes (`ada@example.test created channel Fixture Sports`). A write on a fixture row that `26` says the backend refuses (a synced row's address) shows the refusal the same way.

## 10. Waves

One worker owns `src/admin` for Waves 2 to 6, in one worktree, because it is one sub-project (`07` 6.1) and its pieces share the
shell, the store and the record components; the owner's rule is few agents. The coordinator accepts each wave visually before
the next begins, so a wave is a checkpoint, not a worker.

| Piece | Worker | Where | Paths | Off limits |
|---|---|---|---|---|
| Shared library (Wave 1) | U1, U2, U3, U4 | `27` section 6.1 | `27` section 6.1 | `27` section 6.1 |
| Admin parity (Waves 2 to 6) | **A** | worktree `D:\Projects\.giga-worktrees\admin-parity`, branch `admin/parity`, cut from `family-port` **after Wave 1 is landed and accepted** | `src/admin/**`; `src/shared/ui/**` for the step-9 pieces of section 4.3 and their tests | `src/frontend`, `src/fileserver`, `src/backend`, root `package.json`, `scripts/**`, docs, any `.env`, any `data/` |

Every wave: `npm ci` (in its own worktree only), `npm run typecheck`, `npm run lint`, `node scripts/check-rules.mjs` from the
root, all clean; tests written and **not run**; one commit per wave on the branch (never pushed, merged or rebased). The report
follows `07` 6.4.

### Wave 1 - the shared library (workers U1 to U4)

`27` steps 0 to 8, in the order and with the ownership, tests, per-step admin deletions, real-stack checks and exit criteria of
`27` sections 5 to 8. **Wave 1 = `27` steps 0 to 8; no admin page work starts until it has landed and been accepted.** Its exit
criteria are: the interface renders as before; the gate passes with `shared/ui`, `shared/http` and the admin in it; the
template's own copies in `src/admin` are replaced by `@giga/ui` and `@giga/http` imports.

### Wave 2 - shell and shared record pieces (worker A)

- **Mode.** The library only. **Depends on** Wave 1 accepted. It does not wait for, and does not need, any backend work.
- **Does.** Strips the demo (section 4.1); writes `constants/tabs.ts`, the store slices (the chrome slice spread in, `workspace`,
  `panes`, `session`), the admin adapters (`AdminTitlebar` with the `ADMIN` subtitle and the six-tab pill, `AdminStatusbar`,
  `AdminEventsDrawer` with fixture rows and `Load older`), `AppShell` with `minSize`, `useShellKeys`, `WorkspaceFrame`,
  `RecordRail`, `WorkspaceToolbar`, `NewRecordGroup`, `ListGroup`, `SignInForm`/`SignInPage`, six empty `*Page.tsx` that show their
  index skeleton (a `ListGroup` of skeleton rows under a `NewRecordGroup` frame, no fields yet), `SettingsWindow` with its
  three sections and `OverlayHost`, `useCaptionOverlay`, `services/admin-host.ts`, `fixtures/session.ts`,
  `constants/fixture-switches.ts`. Builds into the library the pieces of section 4.3 marked Wave 2: the `reason` prop,
  `ToolbarStrip`, the tooltip arrow, `AppShell`'s `minSize`.
- **Files owned.** Everything in section 6.1 not marked as a later wave's, the removals, and the Wave 2 library pieces with
  their tests.
- **Tests (written, not run), `src/admin/test/` and `src/shared/ui/test/`.** `tabs-config.test.ts` (six tabs in order, left limits,
  no right/bottom, the `Ctrl+N` hints); `workspace-slice.test.ts` (open and close a workspace per tab, `requestTab` switches tab
  and opens, tabs stay independent); `panes-slice.test.ts` (toggle raises `openVersion`, a size commit does not); `shell-keys.test.ts`
  (rewritten: `Ctrl+1`..`Ctrl+6`, `Ctrl+,`, `Ctrl+0`, `Ctrl+F`, Escape closes the drawer only when no window is open, typing in a field
  is ignored, a modal window yields); `event-sentence.test.ts` (each audit action to its area, tone and sentence; failed login is warn; a
  password never appears); `field-checks.test.ts`; `row-state.test.ts`; `settings-sections.test.ts` (three sections; every row label
  is in `SETTINGS_LABELS`); library: `button-reason-markup.test.ts` (no wrapper without a reason; with one, `disabled` plus a
  focusable tooltip group labelled "Verb. reason"), `toolbar-strip-markup.test.ts`, `tooltip-arrow.test.ts` (the arrow offset follows the anchor and
  is clamped to the bubble), `app-shell-min-size.test.ts`.
- **Acceptance** (coordinator; real stack: the owner's `npm run dev`, Chrome tabs on `http://127.0.0.1:5172/admin/` and on 5171, and the real Electron windows made visible (the backend's admin window on debug port 9223 and the desktop app on 9222), at 1600 x 1000 and at 900 x 640; each admin screen compared with the **template's equivalent screen in the interface**, and its content with the mockup on 5190 (owner asked first)):
  1. Titlebar: height 40px, ghost toggles, the brand with `ADMIN`, the six tabs centred on the **titlebar** (not among siblings), the Events toggle, the right toggle disabled with its reason, the caption strip free in Electron. At 900px the pill does not touch the brand or the toggles.
  2. Statusbar: 24px, `idle` with an empty track, `Stop` disabled with `Nothing to stop`, `Events`, `Settings`; a notice appears on a refusal and not before.
  3. Events drawer opens in 0.1 s to 160px with rows time/tone/area/sentence and `Load older`; `Clear` empties to five shimmer lines.
  4. Settings: opens centred at the template's size, scrim below the titlebar, three rail items, Theme/Accent/Reduce motion/Zoom work and change the page at once, `Restore defaults` works, drag by the header, resize by the grips, `Escape` closes, focus returns to the opener; `Sign out` returns to the sign-in page with the chrome in place; `?signedin=0` opens on sign-in. The caption strip follows a theme switch in Electron.
  5. Tabs switch with the pill and `Ctrl+1`..`Ctrl+6`; the left toggle is disabled on every index; the minimum size holds (a 700 x 500 browser window scrolls inside the shell).
  6. Console clean; no network request to `/api` (fixtures only).
  **Failure:** a text sentence over a skeleton, a dot for state, a tab that remounts (scroll lost), a horizontal page scroll at 900, a literal colour in a component, any `fetch`, a placeholder, an `aria-disabled` control.
- **Exit.** The coordinator's six checks pass; `npm ls` shows `hls.js` still present and no `@radix-ui/react-dropdown-menu` user.

### Wave 3 - Channels, with the Preview window's UI (worker A)

- **Depends on.** Wave 2 accepted.
- **Does.** Builds into the library the pieces of section 4.3 marked Wave 3 (`RecordGrid`/`SkeletonGrid`, `Checkbox`, the pill
  `ChipGroup`) and the admin-only `StateWord` and `FolderRow`. Then `ChannelsPage`, `ChannelsIndex` (toolbar `Preview →`,
  `NewChannelForm`, the list with ticks, `Refresh` in the heading), the live workspace (Details with the Plays switch between
  Folder and the `VideoList`, Playback, Fault, Status with the playlist and the copy icon, skeleton while preparing), the stream
  workspace (Details with `Edited` tags and `Revert to playlist`, Stream with a refused address, Status), `Rebuild` showing
  `preparing` for `FIXTURE_BUILD_MS` (3 s, fixture only), the statusbar's `N preparing`, `Apply` disabled until the channel is
  live; and **the Preview window's UI** (section 7.4): `PreviewWindow`, `PreviewStage`, `PreviewStatus`, `usePreviewSession`
  (fixture), `lib/preview-state.ts`, `constants/preview-copy.ts`, the gating of both `Preview →` verbs.
- **Files owned.** `components/channels/*`, `pages/ChannelsPage.tsx`, `fixtures/channels.ts`, `types/admin-channel.ts`,
  `constants/channel-copy.ts`, `constants/preview-copy.ts`, `components/records/{VideoList,FolderRow,StateWord}`, `hooks/usePreviewSession.ts`,
  `lib/` additions, their tests; the Wave 3 library pieces with their tests.
- **Tests.** `channel-rows.test.ts` (live state to word; synced/edited/disabled words; kind column); `new-channel-form.test.ts` (draft rules:
  Create disabled with the missing field's reason; number 1 to 9999, folder or stream address by kind, the `Row error` text);
  `video-list.test.ts` (move up/down, remove, add keeps order, numbering); `fault-rules.test.ts` (Apply disabled unless live;
  milliseconds numeric); `channel-edit.test.ts` (Save on a synced row marks the field `Edited`; `Revert` clears it);
  `preview-gate.test.ts` (the index verb: none ticked `Tick a row first`, two `Tick only one row`, one ticked live or stream row
  enabled; the workspace verb `Save the channel first` while dirty); `preview-state.test.ts` (each state to its status word;
  `failed` appends its problem; a player error appends after the state; `Retry` shown for `failed`, `stopped` or a player error;
  the skeleton flag only for `preparing` and `starting`); library: `record-grid-markup.test.ts` (header cells, a spanning row button,
  the selection column, the state word, the dimmed disabled row, the min width), `checkbox-markup.test.ts`, `chip-group-markup.test.ts` (the pills, the `min` rule).
- **Acceptance** (as Wave 2's setting; each screen compared with the interface's Collections window, index and workspace, and the
  Settings window for the window frame; content with the mockup's Channels):
  1. Group heading sizes (tile 48, mono title 28/36); the New form's rows each 36px with one label column equal to `labelColumn(labels)`; the Kind pills switch the Folder and Stream address rows; `Create` is disabled with `Name is required.` until a name is typed.
  2. The list: columns and 36px rows as the interface's `CollectionRows` with the tick column and a state word; ticking one row arms `Preview →` (a disabled one shows `Tick a row first`); a row click opens the workspace; the armed `Delete Fixture News?` re-arms after 4 s and disarms on blur and Escape.
  3. The workspace rail has `‹ Channels`, Details, Playback, Fault, Status with the selected one in the accent with a 2px left strip and following the scroll; the sash drags between 190 and 380 and the toggle collapses the rail; Rebuild shows skeleton lines in Status and `1 preparing` in the statusbar and then `Fixture News is live.`
  4. `Choose` is disabled with its tooltip in Chrome; in the Electron window (the backend's own, with the owner's say) it opens the native folder dialog.
  5. **Preview:** `Preview →` on the index (one ticked row) and in the workspace opens the window; it is the template's window (drag, resize, `Escape`, focus returns to the opener, bounds kept for the run); the stage is dark in the light theme; a preparing channel shows the shimmer skeleton and no video; a failed one shows `failed: <problem>` and `Retry`; the workspace verb says `Save the channel first` after an edit.
- **Exit.** Both sizes match; the six-form probe of section 11 passes for the New channel form.

### Wave 4 - Providers and Titles (worker A)

- **Depends on.** Wave 3 accepted.
- **Does.** Builds `ChipsInput`'s `className` into the library. Both tabs, their forms, grids, workspaces. Providers: Family pills switch the template row; Frame origins is `ChipsInput` (Enter or comma adds, the chip's X removes, a malformed origin is refused inline); Message shape is a select (None, vidsrc-status, player-event). Titles: search (carrying `data-search`, so `Ctrl+F` finds it), Kind chips (at least one stays on), Sort pills (Newest, Oldest, A-Z, Year, Trending), `Older`/`Newer`, the state word with `edited: plot` tooltip and `custom-0001` on a manual row, the series-only Seasons rail item and group (`SeasonList`), Sources read-only, `Revert to TMDB` disabled for a manual title with its reason.
- **Files owned.** `components/providers/*`, `components/titles/*`, `pages/ProvidersPage.tsx`, `TitlesPage.tsx`, their fixtures, types, copy, tests.
- **Tests.** `provider-rows.test.ts`, `provider-form.test.ts` (https template needs `{tmdbId}`; episode needs the three placeholders; origin is https with no path; at most 8 frame origins), `title-list-filter.test.ts` (search, kind, sort over fixtures), `title-state.test.ts` (synced, edited, manual, disabled), `season-list.test.ts`, `chips-input-markup.test.ts` (the library `className` reaches the chips box).
- **Acceptance.** As Wave 3, per page; additionally: switching a Title's Kind in the New form changes nothing else (it is not a row switcher); a movie's workspace has no Seasons rail item; Titles' list heading shows `Older`/`Newer`, `Newer` disabled with `This is the first page.`; `Ctrl+F` focuses the Titles search.
- **Exit.** Both sizes match; the probe passes for both New forms.

### Wave 5 - Playlists, Jobs, Accounts (worker A)

- **Depends on.** Wave 4 accepted.
- **Does.** The three tabs. Playlists: masked address with `Replace` (the field unlocks, becomes a password-type input, `Replace` disables with `Type the new value, then Save.`), Status with channel links. Jobs: the Type pills switch Playlist versus Scope and Kind rows; the toolbar `Run job` runs the ticked jobs (fixtures: 3 s of `running`, pulsing bar, `N syncing` in the statusbar, then an event row and a refreshed last run), disabled with a reason when none ticked, a ticked job disabled or running, or its playlist disabled; the workspace `Run job` likewise; a bad interval is a field error. Accounts: `Set new password`, the last enabled account cannot be deleted or disabled, tooltip `Signs this account out everywhere`.
- **Files owned.** `components/playlists/*`, `jobs/*`, `accounts/*`, three pages, fixtures, types, copy, tests.
- **Tests.** `job-run-gate.test.ts` (the reasons, in priority order), `job-schedule-field.test.ts` (`6h`, `30m`, `24h`, `off`; `x` refused), `job-form.test.ts`, `account-guard.test.ts` (last enabled), `playlist-replace.test.ts`, `playlist-rows.test.ts`.
- **Acceptance.** As Wave 3, per page, plus: run a job and see the row's state word turn `running` with the pulsing bar and then `idle`, the Events drawer gain `ada@example.test ran job <name>`, and the Last run group refresh.
- **Exit.** Both sizes match; the probe passes for all six New forms.

### Wave 6 - audit rows, sweep, tests (worker A)

- **Depends on.** Wave 5 accepted.
- **Does.** `Load older` pages through `audit.ts`; every page write appends its event row through `lib/event-sentence.ts`; a pass over the whole app for the leftovers of section 4.1 (`grep` finds no import of a removed file, no `fixtures/` import except pages and stores, no `@radix-ui/react-dropdown-menu`; `hls.js` and `allotment` stay); the `fixture-switches` and `useFixtureLoad` files are marked for deletion by `29`; `src/admin/README.md` is corrected (its plan numbers and file names are stale) and lists the final scripts; every file under 200 lines.
- **Files owned.** `src/admin/**` (the sweep touches any file), `fixtures/audit.ts`.
- **Tests.** `events-store.test.ts` (200-row cap, newest last, `Clear` is on-screen only, older rows prepended in time order); the whole `test/` set typechecks.
- **Acceptance.** The full sweep of section 11 on all pages at both sizes, light and dark, all five accents; the Electron window's caption strip follows a theme switch.
- **Exit.** Section 12.

## 11. The coordinator's visual acceptance, every wave

Run with the owner's say for any program start (`07` 4), on the owner's real stack (`07` 4, 5): Chrome MCP on `http://127.0.0.1:5172/admin/`
(the admin's Vite) and on `http://127.0.0.1:5171` (the interface, for the template's equivalent screen), the real Electron windows
made visible (the backend's admin window on 9223, the desktop app on 9222), and, for content and structure, the mockup on
`http://127.0.0.1:5190/` (owner asked first), the same state in both admin and mockup through the query switches, at **1600 x 1000**
and **900 x 640**.

1. **Screenshot pairs.** For each page in the wave: the index, the workspace, the armed `Delete`, a disabled-control tooltip, the skeleton state (`?load=600` just after open), and the Events drawer open. Compare each pair with the template's equivalent screen for look and feel and with the mockup for content and structure; a difference is a failure unless Appendix A resolved it.
2. **Measure, do not eyeball.** One probe over the page reads, from the DOM: heights (titlebar 40, statusbar 24, toolbar 40, form row control 36, grid row 36, drawer 160), the label column (equal to `labelColumn(labels)` for the page's labels, one value per page), the group tile (48) and title (mono 28/36), the rail (240 default), the order of rows in each New form, the control type of each row, each control's width equals the row's (the Toggle and the chips box excepted for height), an info glyph on every row except Name/Title/Email/Password, one row component (`Row`). The grid header is compared with the interface's `CollectionRows` header in the same window. **All six New forms must produce the same shape** (the probe of `26` 4.4 item 7): row 1 is the name, row 2 the switching selector when there is one, every control full width.
3. **States.** Disabled, dimmed, armed, `edited`, `manual`, `preparing`, `failed`, `running` all drawn as words with the colours of the mockup; no dots anywhere (search the DOM for a rounded 6 to 8px element that carries state).
4. **Console and network.** No console errors or warnings; no request to `/api`, `/live` or any host (fixtures only); no `localStorage`/`sessionStorage`/IndexedDB write.
5. **Keyboard.** `Tab` order skips a closed pane; `Escape` closes the drawer, then a window; `Ctrl+1`..`Ctrl+6`; `Ctrl+0`; `Ctrl+F` on Titles.
6. **Failure means** the wave goes back to worker A with the exact differences; the coordinator does not fix it quietly (`07` 6.5).

## 12. Done when

Every page of section 7 is drawn and matches the template's look and feel and the mockup's content and structure at both
sizes; the six New forms pass the probe; every control works on the fixtures or is disabled with its reason; the removed
template files are gone and `grep` proves nothing imports them; `npm run typecheck`, `npm run lint`, `npm test --prefix src/admin`
and `node scripts/check-rules.mjs` are clean once the rule checker covers `src/admin` (Wave 1); and the owner has seen each
tab, one checkpoint per tab as `07` 2 asks.

## 13. Risks

1. **The pill at 900px.** Six equal-width tabs (the longest label, `Playlists`, sets the width) plus the brand and toggles are tight, most of all in Electron where the caption strip takes 138px; the probe reads the gap, and a collision switches both apps to a content-sized variant (a `TabPill` prop in the library, Wave 2). The probe reads the gap.
2. **Wave 1 is a prerequisite.** If a Wave 1 step is rejected the admin waves wait; there is no copy mode to fall back on. The coordinator does not start Wave 2 on a partial library.
3. **`Group` folding and the rail's scroll spy** share ids; two groups with one id fold together. Ids are prefixed by page (`ch-details`, `lv-playback`), and the spy's key list is a module constant (a new array every render re-binds the scroll listener).
4. **A 200-line limit** on the New forms (Channels, Jobs) is real: each row is a small component or the form splits into `NewChannelForm` plus `NewChannelRows`.
5. **The mockup is plain HTML:** its `aria-disabled` plus swallowed clicks and its `data-tip` tooltips are not carried over; the `reason` prop is the one answer, and a test asserts the wrapper and the native `disabled`.
6. **The pane engine with one left pane per tab** is a use the interface does not make (three surfaces, three panes each): a hidden tab's Allotment measures zero. The engine's repaint and re-measure on show is `27` step 8's risk; Wave 2's acceptance opens every tab's workspace after a tab switch and checks the rail's width and collapse.
7. **Fixtures that look like the real thing** hide missing states; the fixture set includes a failed, a disabled, an edited, a manual and a preparing record so every state word is drawn.
8. **Native `title` on a disabled `Segmented` chip** (the template's model) must be seen to show in Chrome and Electron; if it does not, the chip is wrapped in the focusable `Tooltip` like any other disabled control, in the library.

## 14. What the coordinator changes when this lands

- **Root `package.json`:** `admin:dev` = `npm run dev --prefix src/admin`; `admin:build` = `npm run build --prefix src/admin`; `kill-ports` gains `5172`; the `dev` stack gains the admin's Vite (proposal in `29` section 14). `dist:win` is unchanged: the admin is not in the desktop installer.
- **`scripts/check-rules`:** `load-files.mjs` gets `["admin", "src/admin"]`; `import-boundaries.mjs` gets `admin: "src/admin"` in `PROGRAM_DIRS` and `ELECTRON_HOMES` gains `src/backend/src/app/` (the backend's host, built and currently the only violation the checker reports); `frontend-structure.mjs` and `type-scale.mjs` treat `src/admin/src/(components|pages)` like the frontend's; `frontend-fileserver-only.mjs` becomes `admin-backend-only` for the admin (its `/api` is the backend's). `27` section 4 adds the rest (`PROGRAM_ROOTS` gain `src/admin`, `src/shared/ui`, `src/shared/http`; the family-file diff check retires; the checker's naming and structure rules cover the library).
- **Gate (`scripts/check/gate.mjs`):** typecheck, lint and test steps for `src/admin` (Wave 1, step 0).
- **`AGENTS.md`:** the layout line for `src/admin`, the ports table row `Admin interface | 5172 (Vite) | served at /admin/ by the backend (8191)`, and `kill-ports` text.
- **`docs/01`:** 1.x gains the admin program; 4.1 and 4.2 (`27`); the tree in section 3; section 9's buttons table gains the admin toolbar strip exception (Discard ghost, Save edged, one filled forward verb), which the owner's family screenshots draw and the table forbids today. **`docs/03` section 1:** the port table gains 5172.
- **`docs/26`:** the status line points to `27`, `28` and `29`; the corrections `29` section 17 lists.

## 15. Choices made where the docs left a gap

- One worker for Waves 2 to 6 (a sub-project), not one per tab, per the owner's few-agents rule.
- The mockup is no longer edited (the former Wave 0, worker M, is gone): it is read for content and structure, and Appendix A is the reconciliation.
- Zoom stays in Appearance; Light and System themes are enabled; `Restore defaults` is kept from the template.
- The pill is the template's equal-width grid, with the content-sized variant as the measured fallback.
- The admin's rail is the library's pane engine (Wave 1 lands it before any admin wave), one left pane per tab keyed `<tab>.left`; the mockup's hand-made sash is not built.
- `FolderRow` and `StateWord` are admin-only and stay out of the library; the pieces of section 4.3 are built into it.
- **Disabled controls use the template's model** (a native `disabled` control inside the focusable `Tooltip`), so the mockup's `aria-disabled` model and the earlier `ReasonButton` are dropped; it is the `reason` prop on `Button` and `IconButton`.
- The tooltip arrow that follows its anchor is kept although the template's arrow is centred: `26` section 5 recorded it as the owner's decision and it is additive (an offset prop); it is the one place the mockup wins over the template without being admin-specific.
- A New form's `Create` is disabled with the reason for a missing required field (the template's model) instead of being pressed and refused (the mockup's); value refusals are shown after the press.
- Preview is a modal work window (the app has no non-modal tool window yet), opened centred at a standard size, and `New` is the index's form rather than a workspace, so it never gates `Preview →`.
- `Preview →` exists on stream channels too (`26` 4.5a plays a stream channel through its `streamUrl`).
- The Settings window opens at the template's size, not the mockup's `min(80vw, 860px) x min(80vh, 560px)`.
- Component tests render to a string (`27` section 9); there is no DOM environment.

## Appendix A - Reconciliation: template versus mockup

Method: the template's components, hooks, store and styles (`src/admin/src`, identical to the original
`D:\Projects\giga-template-react\src\frontend\src` but for one file) were read side by side with the mockup's `html/`, `css/` and
`js/` (`D:\Projects\giga-stream-poc\src\admin-mockup`). Paths in the last column are under `src/admin/src/` (they are the
files the library takes in Wave 1); `fe:` marks a file that exists only in `src/frontend/src`, the interface, where the
template's later owner fixes live. Verdicts: **T** = TEMPLATE WINS; **M** = MOCKUP WINS because admin-specific (the owner's
`26` section 4.4 record pattern or a behaviour the template has no equivalent for); **N** = NEW, neither has it. Row 2 is the one
exception, marked **M\***: the mockup wins by an earlier owner decision that the template does not contradict.

| # | Area | Mockup does | Template does | Verdict | What the worker builds (template files) |
|---|---|---|---|---|---|
| 1 | Tooltip bubble | one global `.tip` div appended to `<body>`; `data-tip` on any element; mouseover and focusin delegation; 83 ms fade; Escape hides; a MutationObserver watches `data-tip` | the `Tooltip` component: portaled bubble, hover and keyboard focus, flips below when there is no room, 8px gap, 320px max, 70 ms fade, `aria-describedby`, Escape not special | T | `Tooltip` and `InfoTip` from the library; no `data-tip` anywhere. `components/ui/Tooltip.tsx`, `fe:components/ui/Tooltip.tsx` |
| 2 | Tooltip arrow | the arrow follows the anchor's centre (`--arrow-x`) when the bubble is clamped to the viewport | the arrow is always at the bubble's centre | M\* | an arrow-offset prop on `Tooltip` (4.3, Wave 2); `26` section 5 recorded it as the owner's |
| 3 | Info glyph (component) | `.info` span with `role=button`, 20px, lucide `info` 16px, `cursor: help` | `InfoTip` button 20px, `Info` 16px, `aria-label="About <label>"`, accent on hover and focus | T | `Row`'s `tip` prop. `components/ui/Tooltip.tsx`, `components/ui/Form.tsx` |
| 4 | Disabled with a reason | `aria-disabled="true"` plus `data-tip`, never `disabled`; a capture-phase guard swallows click and Enter; stays focusable | a native `disabled` control inside `<Tooltip text={reason} focusable label="Verb. reason">` (a focusable group); icon buttons carry the reason on a wrapper's `title` | T | the `reason` prop on `Button` and `IconButton` (4.3); `fe:components/player/ResumeFooter.tsx`, `fe:components/player/PlayerBrowser.tsx`, `components/chrome/Titlebar.tsx` |
| 5 | Disabled look | opacity .45, `not-allowed`, hover and active effects removed one by one per variant | `disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none`; `IconButton` `opacity-30` and no pointer events; no per-variant overrides | T | `components/ui/Button.tsx`, `IconButton.tsx` |
| 6 | Disabled `Segmented` chip | `aria-disabled` plus `data-tip` | `disabled`, `title={disabledReason}`, dim text | T | `components/ui/Segmented.tsx` (`disabledReason`); watch risk 8 |
| 7 | Titlebar toggles and tabs asleep | `body[data-win-open]` sets `pointer-events: none; opacity: .45` on the titlebar's icon buttons; no reason; the tab pill disabled signed-out with `Sign in first` | a work window disables the toggles (reason on the wrapper `title`: `Close the open window to change the panes.`) and the tabs (reason on the track); a pane the page lacks is disabled with `<Surface> has no <pane>.` | T | the reasons and wrapper pattern of `components/chrome/Titlebar.tsx`, `PageTabs.tsx`; admin wording for the missing panes (row 55) |
| 8 | Two-step delete (behaviour and look) | `[data-question]`: the label becomes the question, `danger-ghost` (red text, tint, 70% red edge), tip `Press again to confirm`, re-arm 4 s, blur and Escape disarm, then the row is removed from the DOM | `ArmedButton`: ghost at rest, `Button variant="danger"` (raised, red) armed, title `Press again to confirm`, `useArmedAction(TWO_STEP_MS = 4000)`, disarm on blur and on Escape (`stopPropagation`), size `sm` | T | `components/ui/ArmedButton.tsx`, `hooks/useArmedAction.ts`, `constants/surfaces.ts` (`TWO_STEP_MS`) |
| 9 | Two-step delete (wording and tips) | the verb is `Delete`, the question `Delete <name>?`; a synced row's, a title's and a playlist's tooltips say what happens next | the verb is `Remove`, the question `Remove <name>?`, tooltip `Remove the collection; the original files are untouched` | M | `ArmedButton` with `question={`Delete ${name}?`}` and the mockup's `title` per record (`*-copy.ts`) |
| 10 | Page commit model | a toolbar strip: `Discard changes` ghost, `Save` edged, a forward verb filled; ONE Save per page; a notice per verb | one primary `Save details` ending a Details group; no Discard; no toolbar strip | M | `WorkspaceToolbar` on `ToolbarStrip` (4.3); `components/collections/CollectionDetailsGroup.tsx` is the form pattern inside it |
| 11 | Dirty tracking and the commit's state | `Save` and `Discard` always enabled; nothing tracks a change | `Save details` disabled with `Nothing has changed.` or the blank-name reason; the draft is local state keyed by the record | T | `useRecordForm`; Save and Discard disabled with `NOTHING_CHANGED`. `components/collections/CollectionDetailsGroup.tsx`, `lib/collections-name.ts` |
| 12 | Required-field refusal | pressing `Create` with a required field empty puts `<Label> is required.` under the row, sets `aria-invalid`, focuses the field and posts an error notice | `Create` is disabled with the reason (`NAME_BLOCK_REASON`) while the name is blank; Enter in the field creates; a refused create keeps the draft and says why on the notice line | T | `NewRecordGroup`'s `Create` disabled with `<Label> is required.`; Enter in the first field creates. `components/collections/NewCollectionForm.tsx` |
| 13 | Value and backend refusals | a refusal names its field beside the row (`.row-err`, 14px, red), on the notice line, with `aria-invalid`; cleared on the next input | `Row` has an `error` line (14px, `text-st-failed`, `role="alert"`, indented to the control) that no demo form uses; refusals are notice-only | M | `Row error` + notice + `aria-invalid` for number range, address rule and backend `422`; `components/ui/Form.tsx` |
| 14 | Row label markup | `<label class="lab" for>` on every row, `.row-err` as a sibling, rows wrap | `Row`: a `<span>` label (`FIELD_LABEL`, 14px semibold, truncates), the glyph, the control, `trailing`, `error`; the control carries its own `aria-label` | T | `Row` everywhere, `aria-label` on every control; no `<label for>`. `components/ui/Form.tsx` |
| 15 | Label column | fixed `--label-col`: 164px in a page, 152px in Settings, 100px in sign-in | `labelColumn(labels)`: `max(120, ceil(longest * 8) + 36)` px, set once per `Workspace` from the page's label list | T | each page's label constant passed to `Workspace labels`; the probe compares with `labelColumn`. `components/ui/Form.tsx`, `constants/settings-sections.ts` |
| 16 | Field sizes and heights | `.row .inp` 36px, 14px text, 12px padding; `.btn` 28px (`sm` 24); `.seg` 36 | `FIELD_CONTROL` = `h-9! w-full min-w-0 flex-1 px-3! text-sm!` (36px, 14px, 12px); controls 24 / 28 / 32 (`h-ctl-sm/md/lg`); `Button` text 13px | T | `FIELD_CONTROL` on `Input`, `Select`, `NumericInput`; `components/ui/Form.tsx`, `Field.tsx`, `Button.tsx` |
| 17 | Row trailing button (`Choose`) | `.row-field .btn`: bordered, dim, 36px, icon and text, at the row's trailing edge | `Row trailing`: a ghost `Button` md with the icon and text (`FolderOpen` `Choose`) after the field | T | `FolderRow` = `Row` with `trailing`; `components/collections/NewCollectionForm.tsx` |
| 18 | Placeholder text | `placeholder="letters, digits and spaces"`, `1 to 9999`, `milliseconds`, a sample path in several fields | none ("Delta: no placeholder text (banned in Giga Stream)"); the tip carries the format | T | no `placeholder` in the admin; the formats go into the `tip`. `components/collections/NewCollectionForm.tsx` |
| 19 | Segmented shape | one bordered rectangle with square-cornered segments (`.seg`) | flat rounded-full pills, hairline off, accent tint and edge on, `h-7`, 6px gap; `equal` makes a grid of equal chips | T | `Segmented` from the library. `components/ui/Segmented.tsx` |
| 20 | Segmented across a row | in a form row the `.seg` spans the row at 36px with equal segments (owner rule `26` 4.4 item 7) | inline pills at 28px, not spanning (`NewCollectionForm`'s Type) | M | `Segmented size="field"` (`27` step 2a): 36px chips, equal, spanning; Settings' Theme and Reduce motion keep the default inline pills |
| 21 | Any-of chips (Qualities, Kind filter) | `.seg[data-multi][data-min]`: the segmented rectangle, any-of, at least N lit | `ChipGroup`: a recessed track with raised square chips (the nav's look, which `Segmented`'s own comment forbids elsewhere); no minimum; used by no screen | N | `ChipGroup` redrawn as pills with a `min` count and the field size (4.3, Wave 3). `components/ui/ChipGroup.tsx` |
| 22 | Enabled and booleans | `.tgl` 32 x 18, flat knob, `role=switch`, `aria-checked`; `aria-label` | `Toggle`: 32 x 18, knob carries the state (accent gradient on, muted off), raised, focus ring, `role=switch`, `aria-label` required, `readOnly` | T | `Toggle` for `Enabled`, `Captions`, `Dry run`, `Prune`; `components/ui/Toggle.tsx` |
| 23 | Row selection tick | `.chk` 20px, accent tint and a CSS check when on; header select-all labelled as selection | none (the interface has no tick column) | M | `Checkbox` (4.3, Wave 3) drawn in the Toggle and `Field` token vocabulary; the header's is `Select all <records>` |
| 24 | Select | `select.inp` with a gradient "chevron" (a diagonal stroke) | `Select`: a real lucide `ChevronDown` beside the native select, `w-full`, `pr-7` | T | `Select`. `components/ui/Field.tsx` |
| 25 | Chips input (Frame origins) | `.chipsin` 36px min; Enter or comma adds any text as a chip; the X removes; no refusal | `ChipsInput`: raised mono 11px chips; Enter and comma add, Backspace on empty removes the last, Escape clears, paste splits; tokens lowercased and deduped; a malformed token is refused inline (`not accepted: x`) | T | `ChipsInput` with `pattern` for an https origin and `invalidText`; `className` for the row height (4.3, Wave 4); the "at most 8" check in `field-checks`. `components/ui/ChipsInput.tsx` |
| 26 | Number fields | plain text inputs with `inputmode="numeric"` | `NumericInput`: text with `role=spinbutton`, local draft, commit on blur or Enter, clamped, never `NaN`, arrow keys step | T | `NumericInput` where a field always has a number (Pages, Order, a season's episode count, Runtime); a plain `Input` checked by `field-checks` where empty is meaningful (Number, Year, Rating, Duration and Delay). `components/ui/NumericInput.tsx` |
| 27 | Long text (Plot) | `textarea.inp.tall`: 96px minimum, 20px line, vertical resize | `Textarea`: the field classes, `h-auto`, `rows` default 3, `resize-y` | T | `Textarea`. `components/ui/Field.tsx` |
| 28 | Read-only fields and facts | `.inp[readonly]` in `--faint`; `.val` mono readouts with a tone colour | `Input readOnly` (the folder row); `FACT` readouts: `flex h-9 items-center font-mono text-sm text-muted` (About) | T | `Input readOnly` for Kind and Id, `FACT` for state words and renditions. `components/collections/NewCollectionForm.tsx`, `components/settings/AboutSection.tsx` |
| 29 | Group heading, fold, splitter | 48px tile, mono 28/36, chevron turns 100 ms, accent-cored splitter, `Group` actions in the heading | `Group`: the same tile and title, fold from the heading or the chevron (chevron `duration-200`), the same splitter, an `action` slot, `last` | T | `Group`, `Wide`, `Actions`. `components/ui/Form.tsx` |
| 30 | Skeleton primitive and hand-off | `.shimmer` 9px, 1.4 s sweep; content replaces the skeleton instantly after `MOCK_LOAD_MS` | `SHIMMER` 9px, 1.6 s `skel-shimmer`; `Reveal` fades the content in over the skeleton's footprint (`fade-in`, opacity only); `SkeletonRows` mirrors a queue row | T | `SHIMMER` and `Reveal` for every hand-off. `components/ui/SkeletonRows.tsx`, `Reveal.tsx`, `styles/keyframes.css` |
| 31 | Grid skeleton | six skeleton rows in the header's own column set, cell widths cycling, built in JS; Status group swaps facts for shimmer lines in their shape | `SkeletonRows` is the queue-row shape (a thumbnail and two lines); `CollectionRows` shows four of them | M | `SkeletonGrid` and shimmer lines built from `SHIMMER` in the header's column set (4.3, Wave 3); the footprint rule of `SkeletonRows` |
| 32 | Index list markup and type | a `div` grid with ARIA table roles; header 24px mono lowercase 12px faint; rows 36px, 14px | `CollectionRows`: `ul`, a header row (sans 12px semibold, faint, on the panel over a hairline, `py-1.5`), rows `h-9` `rounded-ctl` with `hover:bg-hov`, mono 12px right-aligned numbers, rem tracks so header and rows line up | T | `RecordGrid` with `CollectionRows`'s classes (4.3, Wave 3). `components/collections/CollectionRows.tsx`, `components/ui/DataTable.tsx` |
| 33 | Index columns and narrow windows | one column set per grid (`#gridChannels: 20 56 1.4fr 112 64 96 72 1.2fr 240`...) with a minimum width and a list-own horizontal scroller (`.grid-scroll`) | five columns that always fit; no scroller | M | the mockup's column sets and minimums as `RecordGrid` props; the scroller is the list's own, not the page's |
| 34 | Row click opens the workspace | the whole `.g-row[data-open]` is clickable except the tick and `Delete` | a `<button>` spanning the data cells (keyboard: Enter and Space), the end action a sibling | T | the spanning row button; the tick and `Delete` outside it. `components/collections/CollectionRows.tsx` |
| 35 | Tick column and selection | `.chk` first column; ticking sets a selected fill (`--ctl`) and arms the toolbar's forward verb; header select-all | none | M | the selection column and fill in `RecordGrid`; the toolbar verbs read the ticked ids (`TICK_FIRST`, `TICK_ONE`) |
| 36 | State word and disabled row | a coloured mono word per state; a disabled record dimmed to 45% with `disabled`; a running job a pulsing 48px bar | a list row has no state; a state is "a word, a left-edge strip or a shimmer" (`01`) | M | `StateWord` and the dim in `RecordGrid`; the bar uses the template's `animate-pulse-busy` (1.6 s) |
| 37 | Group heading actions | `Refresh`, `Older`/`Newer`, `Rebuild` buttons in the heading's action slot | the `Group` has an `action` slot; `CollectionRows` omits `Refresh` ("owner: section headers carry no buttons") | M | `Group action` with `Button size="sm"`; the admin lists need `Refresh` (no push, `26` D19) and the Titles pager |
| 38 | Toolbar strip | a 40px panel strip under the titlebar with right-aligned `.btn.sm` verbs; indexes hold only the forward verb | none | M | `ToolbarStrip` (4.3, Wave 2) with `Button size="sm"` |
| 39 | Filled forward verb | the one verb in the filled accent on the strip | `01`'s table forbids a primary button in a toolbar; the owner's family screenshots draw one | M | `Button variant="primary"` in `ToolbarStrip`; the coordinator amends `01` section 9 (section 14) |
| 40 | Workspace rail and back button | `.pagerail` 240px; `.rail-back .btn.sm` full width; `.nav-row` 32px, 13px | `NavRail` with `back`: one full-width stock `Button size="sm"` with `ArrowLeft`; `NavItem` `h-8`, `border-l-2`, `data-selected` = `bg-ctl` + accent text; heading, count | T | `NavRail`, `NavItem`. `components/ui/NavRail.tsx`, `components/collections/CollectionWorkspace.tsx` |
| 41 | Rail width, sash, collapse | own 1px sash (accent on hover and drag), pointer capture, arrows step 16, Home and End; the rail's width transitions 100 ms; `inert` closed | Allotment with the family's themed separator (5px hit area, 2px accent indicator on hover, 70 ms), a collapse tween of 0.1 s written into the split, `inert` while closed, the width rule in `pane-collapse` | T | the library `WorkspaceSplit` (`27` step 8) with the limits table; no `RailSash`. `components/chrome/WorkspaceSplit.tsx`, `hooks/usePaneTween.ts`, `hooks/useWorkspaceSplit.ts`, `lib/pane-collapse.ts`, `styles/workspace.css` |
| 42 | Rail follows the page | `rail.js`: on scroll the last section whose top is within 48px is selected; at the end the last | `useScrollSpy`: the group nearest above the top, the end selects the last, a click pins the entry until the page arrives, smooth scroll | T | `useScrollSpy` with a module-constant key list. `hooks/useScrollSpy.ts` |
| 43 | Rail sections and workspace content | Details, Playback, Fault, Status (live); Details, Stream, Status (stream); each tab's sections as `26` | Details, Folders, Videos (Collections) | M | the mockup's sections and order |
| 44 | Events drawer frame and rows | `.events` 160px, head 30px, rows a four-column grid (64, 48, 88, rest), newest at the foot; Escape closes it | a bottom panel, a framer-motion height tween of 0.1 s, `inert` and `aria-hidden` while closed, head `h-7.5`, flex rows (time, tone word 40, area 80, sentence with a `title`), newest at the foot and kept in view | T | `EventsDrawer`, `EventRow`. `components/chrome/EventsDrawer.tsx`, `EventRow.tsx` |
| 45 | Events head, Load older, Clear | `Events`, `N events`, `Clear` (ghost, disabled `The log is empty.`); a `Load older` row at the top, disabled `No older events.` | `Events`, a bare count, `Clear` (disabled `The log is empty.`); no pager | M | the library drawer's `Load older` row and `N events` line (`27` step 6); the audit rows are the admin's |
| 46 | Events empty | four shimmer lines | five shimmer lines (`WIDTHS`) | T | the library drawer's five. `components/chrome/EventsDrawer.tsx` |
| 47 | Statusbar run bar | a 112 x 6 bar with a hairline border, `idle` or `N preparing`, the bar full and pulsing when busy (1.2 s) | `h-1.5 w-28` rounded bar on `bg-surface`, `animate-pulse-busy` (1.6 s) when the progress is unknown, `idle`, a tooltip | T | `RunningWork`. `components/chrome/RunningWork.tsx` |
| 48 | Statusbar wording and Stop | `N preparing`, `N syncing`, joined by ` · `; `Stop` always disabled with `A channel build cannot be cancelled...`, `A sync cannot be cancelled.`, `Nothing to stop` | `N running · X%`; `Stop` enabled when a job runs, no confirm | M | the admin's counts and the three reasons through `RunningWork`'s props |
| 49 | Notice line | `#sbNotice`, polite, a `circle-alert` glyph for warn and error, a tooltip with the sentence; warn and error are also appended to the log | `role="status"`, keyed by a serial so an identical sentence re-announces, `CircleAlert` in the tone colour, `title`, truncates; an info notice is not an event | T | `Statusbar`'s notice. `components/chrome/Statusbar.tsx`, `store/app-store.ts` (`say`) |
| 50 | Event area per notice | `notify(sentence, tone, area)`: Channel, Job, Session... | `say(sentence, tone)` always logs the area `Connection` | N | `say(sentence, tone, area?)` in the chrome slice (`27` step 6) |
| 51 | Titlebar frame | 40px, `icon-btn` toggles (ghost), the brand, an absolutely centred pill; no caption strip handling | `h-10`, the right padding that leaves Win11's caption strip free (`env(titlebar-area-width)`), `[-webkit-app-region:drag]` with buttons no-drag, ghost pane toggles with accent tint when lit | T | `Titlebar`. `fe:components/chrome/Titlebar.tsx` (ghost); the clone's `bordered` toggles are the stale copy |
| 52 | Brand | tile 22px, `GIGA / STREAM`, and a mono `ADMIN` subtitle (11px, faint, letter-spaced) | tile `size-5.5`, the two-line wordmark; no subtitle | M | `Brand` with a subtitle prop. `components/chrome/Brand.tsx` |
| 53 | Tab pill | content-sized, 13px, `padding: 3px 10px`, `--surface` track, active `--ctl` chip with accent text | `PageTabs`: an inline equal-width grid (`auto-cols-fr`), `p-0.5`, `rounded-[9px]`, 12px, the active tab raised with the accent text | T | `TabPill`; the measured fallback is risk 1. `components/chrome/PageTabs.tsx` |
| 54 | The six tabs and their hints | six tabs; each titled `<Tab> (Ctrl+N)`; signed-out they are disabled with `Sign in first` | three surfaces; no title hints | M | `constants/tabs.ts` with the hints and the signed-out reason |
| 55 | Pane toggles' wording | left toggle disabled `This page has no left pane.`; Events toggle `Toggle the events band`; right toggle disabled `The admin has no right pane.` | `<Surface> has no <pane>.`; `Toggle left pane` | M | the admin's three strings through `Titlebar`'s props (the Events toggle takes the bottom toggle's place) |
| 56 | Keyboard shortcuts | `Ctrl+1`..`Ctrl+6` (not while Settings is open); `Ctrl+,`; Escape closes Settings, then the drawer; typing in a field is not specially handled | `Ctrl+digit`, ignored in text fields and under an open window; `Ctrl+0` resets the zoom with a notice (works under a window); `Ctrl+,` opens Settings (not under a window); `Ctrl+F` focuses the first on-screen `[data-search]`; Escape closes the drawer only when no flow is open; an IME composition owns its keys | T | the library key-map hook with the admin's map (`useShellKeys`); the Titles search carries `data-search`. `hooks/useShellKeyboard.ts`, `lib/text-field.ts` |
| 57 | Theme, accent, light theme | dark only (`Light` and `System` disabled "only the dark theme is drawn"); accent ids `amber`, `blue`, `emerald`, `violet`, `rose` via `color-mix` of `--sw-*` | `useTheme` stamps `data-theme` (dark, light, system followed live), `data-accent` (`green`, not `emerald`), `data-motion` on `<html>`; full light tokens | T | the library tokens and `useTheme`. `index.css`, `hooks/useTheme.ts` |
| 58 | UI zoom and defaults | no zoom row, no defaults button | `ZoomStepper` (0.5 to 3, step 0.1, the end steps disabled with `The smallest zoom is 0.5.`), `document.documentElement.style.zoom`, `Restore defaults` (disabled `Appearance is already at its defaults.`) | T | `ZoomStepper`, `Restore defaults` in the admin's Appearance. `components/settings/AppearanceSection.tsx`, `ZoomStepper.tsx`, `lib/settings-zoom.ts` |
| 59 | Reduced motion | `data-motion` stamp: follow (none), off (`full`), on (`reduce`); zeroes durations with `!important` | `resolveReduceMotion` (system / off / on), `MotionConfig reducedMotion`, `data-motion="reduce"` kill-switch in `motion-reduce.css` | T | `useReduceMotion`, `MotionConfig`. `hooks/useReduceMotion.ts`, `styles/motion-reduce.css` |
| 60 | Settings window frame | a hand-made `.win`: `min(80vw, 860px) x min(80vh, 560px)`, minimum 658 x 412, 44px header with a bordered X, dragged by the header only, no resize, no memory, `inert` on the page behind | `ChildWindow`: opens centred at the content size (960 x 700) but at most 80% of the room, never below 658 x 412, 1px border, 28px header, eight grips, remembers its box, pulled back when the window shrinks, modal | T | `SettingsFrame` + `ChildWindow` + `workSpec`. `components/overlays/ChildWindow.tsx`, `SettingsWindow.tsx`, `constants/child-window.ts`, `lib/child-bounds.ts` |
| 61 | Settings rail | 150px, 210px from 1200px, `.nav-row` | 150px, 210px from `lg`, `NAV_BUTTON` `h-8.5` 13px with an accent left strip | T | `SettingsRail`. `components/settings/SettingsRail.tsx` |
| 62 | Settings content | Appearance: Theme, Reduce motion, Accent (28px circles); Session: Signed in as, Sign out; About: Version, Backend revision, Address | Appearance: Segmented pills, `Swatches` (20px, a 2px ring), zoom, Restore defaults; About: dashes with a tooltip until the server supplies facts | M | the three pages' rows from the mockup, drawn with the template's `Segmented`, `Swatches`, `FACT`; `SessionSection` is new. `components/settings/*` |
| 63 | Work-window keyboard, drag, resize, focus | Escape closes it; focus goes to the X on open and back to the opener; the page behind is `inert`; no keyboard deafness | `useChildWindowKeys`: a modal makes the main window deaf (keys outside are swallowed in capture), Escape closes unless a field is being typed in or a menu is open, focus goes to the frame and returns to the opener if it still exists; `useChildWindowBox` clamps, remembers only the end of a gesture | T | `ChildWindow`, `useChildWindowBox`, `useChildWindowKeys`. `components/overlays/ChildWindow.tsx`, `hooks/useChildWindowBox.ts`, `hooks/useChildWindowKeys.ts` |
| 64 | Scrim | `.scrim` fixed from 40px down, `--scrim` | `ChildScrim`: the wash below the titlebar plus the titlebar slice as a drag strip as wide as `env(titlebar-area-width)` so the caption buttons stay live; a press brings the window forward | T | `ChildScrim`. `components/overlays/ChildScrim.tsx` |
| 65 | Window bounds memory | none (an offset reset on each open) | `rememberChild(key, box)` in the store for the run | N | the same, persisted per account in `29` (`shell.windows`) |
| 66 | Preview window | a `Preview →` verb that notices "Opened the test player." and is disabled when `TEST_PAGE` is off | none | N | the Preview window (section 7.4); no `testPage` |
| 67 | Minimum window size | `.app { min-width: 900px; min-height: 640px }` and `body { overflow: auto }` | `body { overflow: hidden }`; only the Electron host enforces the minimum | M | `AppShell minSize` (4.3, Wave 2); the admin is first-class in a browser tab |
| 68 | Scroll behaviour and scrollbars | `.ws-scroll` scrolls the page; `.grid-scroll` the list sideways; 9px scrollbar | `Workspace` `overflow-y-auto`; 8px scrollbar with a padded thumb; the shell never scrolls | T | `Workspace`; the global scrollbar. `components/ui/Form.tsx`, `styles/base.css` |
| 69 | Durations and easing | 83 / 167 / 250 / 333 ms and `.12s` literals; shimmer 1.4 s; pulse 1.2 s | 70 / 140 / 200 / 280 ms tokens (`--duration-*`), fold and drawer 0.1 s, window entrance 0.2 s fade and rise, shimmer and pulse 1.6 s | T | the tokens; no duration literal in a component. `index.css`, `constants/motion.ts`, `constants/timing.ts` |
| 70 | Buttons and press feedback | flat `--ctl` fill with an inset hairline; primary a flat accent fill | raised: a top-lit gradient, a soft drop, and a press that removes the shadow; primary a gradient; ghost flat | T | `Button`, `IconButton`. `components/ui/Button.tsx`, `IconButton.tsx` |
| 71 | Input focus | `border-color: var(--accent)` only | a border swap plus a 2px accent-tint ring | T | `Input`. `components/ui/Field.tsx` |
| 72 | Context menus | none | the Radix `ContextMenu` with one submenu, a row's action run after the menu closes | T (not used) | nothing: the admin draws no context menu; its row has the click and `Delete`. The dependency goes in Wave 2 |
| 73 | Sign-in gate | a `Group` "Sign in" with Email and Password, a primary `Sign in`, a 480px column, a page not a modal, the tabs disabled; `?signedin=0` | no gate (a `GATE_BEAT_MS` constant is unused); forms submit on Enter, commit disabled with a reason | M | `SignInForm` in the template's `Form`, `Group`, `Row`, `Input`; `Sign in` disabled until both fields are filled. `constants/motion.ts` (the gate beat is not used) |
| 74 | Clipboard copy icon | an `icon-btn` in `.trail` beside the stream address; "Address copied." | `Row trailing` with an `IconButton`; a failed write says why on the notice line | T | `Row trailing` + `IconButton`; the plain-http guard of `29` section 9.1 |
| 75 | Logo preview | `.logo-prev` 96px, 4:3, a glyph | `LogoImage`: 4:3, 56px, the image or the `Tv` glyph on error | T | `LogoImage` in the Details group. `components/ui/LogoImage.tsx` |
| 76 | Ordered lists inside a form | `.vitem` / `.sitem` / `.pitem` rows with up, down and remove icon buttons, an `Add` row; the playing row in the accent | none | M | `VideoList`, `SeasonList`, `PlaylistRows` from `Row`, `IconButton` (disabled `Already first`/`Already last`) and `Input`; the playing row's word in `--color-accent-text` |
| 77 | Masked secret | `Replace` unlocks a read-only field as a password input and disables itself with `Type the new value, then Save.` | none | M | the playlist address row |
| 78 | Rows that a selector switches | `[data-scope][data-kind=...] [data-only=...]` hide rows with CSS | conditional rendering in the component | T | render or do not render the rows; their fields leave the form's required list when not rendered |
| 79 | Icons | lucide 0.469 from a CDN, `<i data-lucide>` | `lucide-react` 1.x components | T | `lucide-react`; the glyph names in section 7.2 |
| 80 | Pages stay mounted | all pages are in the DOM, `hidden` toggled | surfaces stay mounted; the inactive ones hidden | T | `*Page.tsx` mounted always, hidden when inactive |
| 81 | Load stand-in | `MOCK_LOAD_MS` (600 ms) skeleton, `?load=0` | none | N | `useFixtureLoad`, deleted by `29` |
| 82 | Accent id | `emerald` | `green` (the fileserver's setting value) | T | `green` |
| 83 | Closed panes in the tab order | `inert` on a closed rail and the closed events band | `inert` on a closed pane, `inert` and `aria-hidden` on the closed drawer | T | the library's. `hooks/usePaneTween.ts`, `components/chrome/EventsDrawer.tsx` |

The five rows with the most consequence, restated: **4** (the disabled model is the template's, so the mockup's `aria-disabled`
guard and the earlier `ReasonButton` are dropped), **41** (the rail is the template's pane engine, so the plan's hand-made
sash is not built), **12** (a New form's `Create` is disabled with a reason instead of pressed and refused), **32** (the index
list takes the template's `CollectionRows` vocabulary, with the mockup's tick column, columns and state word), and **60** (the
Settings window is the template's window, at its size, resizable and remembered).
