# 27 - Shared UI Extraction Plan (Wave 1 of the admin program)

**Status: PLAN, revised 2026-10-17 (the owner made this the first wave of the admin program). Nothing here is built.** It
moves the family UI that `src/frontend` carries into a shared library, `src/shared/ui`, and the request layer into
`src/shared/http`, so the admin app (`26`, `28`, `29`) is built on the same code as the interface instead of on a copy.
Evidence: the recon of `src/frontend` (17,545 lines plus 5,114 of tests): about 2,960 lines move as they are, about 2,870
after decoupling, about 11,700 stay with the interface.

The owner's decisions (2026-10-17): the admin is built on a shared UI library now, not as a copy; **the extraction is the
first wave of the admin program and no admin page work starts until it has landed and been accepted**; the Segmented
control stays the interface's rounded pills; `Enabled` is the family `Toggle` switch; the source alias is accepted
(`resolve.alias`, `server.fs.allow`, `dedupe`); the family-file diff check (`23` section 3.1) retires once the library is
the source of truth; `01` sections 4.1 and 4.2 and the rule checker are amended to allow a React/TSX shared library; **the
template (`src/admin/src` as cloned, and its original `giga-template-react`, which is the family's production frontend) is
the authority for look, feel and behaviour, and the admin mockup only for admin-specific content and structure** (the full
reconciliation is `28` Appendix A).

## 0. The program, and where this document sits

**Order of execution:** Wave 1 first (U1, U2, U3, U4 strictly one after the other). Wave 0 (backend) may run beside Wave 1 at
any time because it touches only `src/backend`. Then Wave 2 and 2a (done). **Superseded, owner 2026-10-17 ("no fixture waves"): the rest of the program is
`39-ADMIN-PROGRAM-ROADMAP.md`** - the foundation F, then Wave 3a (Accounts, `35`), then 3b to 3d in parallel (Channels `36`, Providers and Titles `37`, Playlists and Jobs `38`),
then the sweep (Wave 4). The old fixture-first Waves 3 to 6 and the wiring Waves 7 to 10 below are retired. A wave starts only when its predecessors have landed and been accepted.

**This is the master progress table; `28` and `29` carry the per-wave detail and the coordinator updates all three when a
wave changes state.** States: `Not started`, `In progress` (a worker is running), `Landed` (merged, gate green, awaiting
acceptance), `Done` (visually accepted on the real stack).

| Wave | What | Worker | Plan | Starts when | Status | Landed in (commit) |
|---|---|---|---|---|---|---|
| 0 | backend changes the wiring needs, including per-account UI state (migration 017) | B | `29` | any time; independent of everything below | Done | `5749213`, `6432525` (no stripping, reverted `a0f4460`, `553d1cf`), `9045a8d` (no-store) |
| **1** | **this document, steps 0 to 8: the shared library** | **U1, U2, U3, U4, one after the other** | **`27`** | **done** | **Done** (interface, panes, windows and Library checked on the real stack, 2026-10-17) | `d1aa570`, `51e2cec`, `6914728`, `4f21c11` |
| 2 | admin shell, Settings window, shared record pieces | A | `28` | Wave 1 landed and accepted | Landed (visual acceptance pending) | `4aca5f8` |
| 2a | admin auth gate and login form, Giga Images style (owner, 2026-10-17: login gate and form only, no OAuth; plan in `34`) | A2 | `34` | Wave 2 landed | Landed (checked in Chrome at 1600 wide: gate, wrong password, demo sign-in, Channels skeleton page, console clean) | `487b934` |
| F | foundation: library `RecordGrid`/`Checkbox`/pill `ChipGroup`, channel helpers, the request layer, real auth, schemas, service stubs (the first part of the old Wave 3 and Wave 7) | A | `39` | Wave 2a landed | Landing (`admin/channels`, merging into `family-port`) | `6fcbeda`, `4386de2`, `07b60d7` |
| 3a | real sign-in finished and the Accounts tab | A | `35` | F landed | Not started | |
| 3b | Channels and the Preview window, wired | A | `36` | 3a landed | Not started | |
| 3c | Providers and Titles, wired | A | `37` | 3a landed (parallel with 3b, 3d) | Not started | |
| 3d | Playlists and Jobs, wired | A | `38` | 3a landed (parallel with 3b, 3c) | Not started | |
| 4 | sweep: account state, About, README, no-fixtures, accessibility, both sizes, build and serve | A | `39` | 3a to 3d landed | Not started | |
| 3 to 10 (old) | the fixture-first Waves 3 to 6 (`28`) and the wiring Waves 7 to 10 (`29`) | | | | **Retired (owner, 2026-10-17: no fixture waves); superseded by F and 3a to 4 above and `39`** | |

**Step 9** (the admin-only library pieces: `Checkbox` for row selection, `RecordGrid`, `ToolbarStrip`, the `reason` prop
that makes a disabled button explain itself, a pill `ChipGroup`, the tooltip arrow that follows its anchor, the shell's
minimum size) is **not** in Wave 1. It stays inside the admin waves that first need each piece (section 5, step 9, and
`28` section 4.3), because the interface does not use them and a piece nobody has drawn yet should be built where its first
user is checked.

## 1. What moves and what stays

| Moves as it is (imports become relative) | Moves after a named decoupling | Stays in `src/frontend` |
|---|---|---|
| the controls kit: `Button`, `IconButton`, `Field`, `Toggle`, `Segmented`, `ChipGroup`, `ChipsInput`, `InlineLink`, `NumberField`, `NumericInput`, `SliderField`, `Form` (`Workspace`, `Group`, `Row`, `Wide`, `Actions`), `NavRail`, `Tooltip` and `InfoTip`, `SkeletonRows`, `SkeletonCards`, `Reveal`, `DataTable`, `ActionList`, `SplitList`, `AppIcon`, the context menu and its types, `cn`, `bus`, `useArmedAction`, `useScrollSpy`, `useViewport` | `ArmedButton` (the 2-step time becomes a default prop), `Section` and `useReduceMotion` (read a context or the `data-motion` attribute, not the store), `Swatches` (a generic accent id), `Brand` (subtitle and icon props), `PageTabs` to `TabPill`, `Titlebar`, `Statusbar`, `RunningWork` (presentational only), `AppShell` (slots), `EventRow`, `EventsDrawer` (props), `event-log` (`restEvent` takes its words), toast/`say`, `ChildWindow` and its parts, `useChildWindowBox` (props), the Settings window frame, `useTheme` (values as arguments), `useShellKeyboard` (a key map), the pane engine (`usePaneTween`, `useWorkspaceSplit`, `WorkspaceSplit`, `pane-collapse`) with a `PaneHost` and a limits table, `index.css` and `workspace.css` (split into shared and delta files), `services/api.ts` and `error-sentence.ts` (to `shared/http`) | Library, Live, Player and Collections components, hooks, services and pages; `constants/surfaces.ts`; hydration and write-back (`useAppHydration`, `useShellWriteback`, `services/shell-state`); Theatre and `useNativeOverlay`; `services/desktop.ts`, `guard-events.ts`, `player-policy.ts` (the only `window.pocHost` users); `PosterImage`, `LogoImage`; the domain parts of `lib/` and `types/` |
| tokens (including `--color-stage`, the picture area that is dark in every theme), `base.css`, `fonts.css`, `keyframes.css`, `motion-reduce.css`, `video.css` (the transparent native video-control layers, which the admin's Preview window needs too), the four `woff2` fonts, the envelope schema | | |

**Which build moves.** The library takes the **interface's** build of every file. The admin clone is an older snapshot of the
same code: its `Tooltip` has no `focusable`/`label`, its `Actions pinned` is the old sticky foot, its titlebar toggles are the
raised `bordered` buttons, and it has no hydration, Theatre or native-overlay code. The interface has the owner's later
fixes, so the interface's version is the template's current behaviour; where the clone differs, the clone is the stale copy.
At step 4 the admin's demo shell therefore takes the interface's ghost titlebar toggles. That is expected and part of the
acceptance.

**Differences between the interface and the admin mockup.** They are no longer resolved here case by case. `28` Appendix A
is the one table (template versus mockup, one row per behaviour, with a verdict). What it means for this wave: the library
is the template; the mockup's additions that the owner kept (the tooltip arrow that follows its anchor, `Load older` in the
Events drawer and the `N events` count, the checkbox, the record grid, the toolbar strip, the control spanning a row at 36px
with equal segments) enter the library as the pieces named in this document, and only those.

## 2. The target tree

```text
src/shared/ui/
  package.json  tsconfig.json     own typecheck and test; the same pinned versions as src/frontend
                                  (react, react-dom, framer-motion, lucide-react, zod, zustand, radix dropdown-menu 2.1.24)
  src/
    styles/    tokens.css  base.css  fonts.css  keyframes.css  motion-reduce.css  video.css  pane.css   + assets/fonts/*.woff2
    controls/  Button IconButton Field Toggle Segmented ChipGroup ChipsInput InlineLink Checkbox* ArmedButton Swatches
    form/      Form NumberField NumericInput SliderField Tooltip
    lists/     DataTable ActionList SplitList RecordGrid* SkeletonRows SkeletonCards SkeletonGrid* Reveal NavRail
    shell/     Brand TabPill Titlebar Statusbar RunningWork EventRow EventsDrawer AppShell ToolbarStrip*
    windows/   ChildWindow ChildGrips ChildScrim useChildWindowBox useChildWindowKeys PopupPanel usePopupFrame SettingsFrame
    menus/     ContextMenu ContextMenuRow ContextMenuSubmenu types
    panes/     usePaneTween useWorkspaceSplit WorkspaceSplit pane-collapse
    hooks/     useTheme useReduceMotion useArmedAction useViewport useScrollSpy useShellKeys
    lib/       cn bus text-field event-log child-bounds popup-place settings-zoom
    store/     chrome-slice.ts     a factory: theme, accent, motion, uiZoom, eventsOpen, events, notice/say, logEvent,
                                   clearEvents, overlay, childBounds, folded
  test/        node:test files for the pure helpers and string-rendered markup (section 6.2)
src/shared/http/                   createApi, ApiError, envelope-schema, error-sentence (an injected table); React-free
  test/
```

`*` marks what does not exist in the interface and is built straight into the library by the admin waves (step 9, section
5). File names keep the interface's conventions: components `PascalCase.tsx`, hooks `useThing.ts`, everything else
kebab-case; files at most 200 lines (`Form` 307, `Section` 338 and `ActionList` 212 are split as they move).

## 3. How the two apps consume it

- **A source alias, not a built package** (`src/shared/media` is built because Node and Electron cannot run TypeScript;
  both UI consumers are bundlers, and a third build would race the two that already share `dist`). Each consuming app's
  `tsconfig.app.json` gets `paths` `@giga/ui/*` to `../shared/ui/src/*` and `@giga/http/*` to `../shared/http/src/*`; its
  `vite.config.mts` gets `resolve.alias`, `resolve.dedupe` for react, react-dom, framer-motion, zustand and lucide-react, and
  `server.fs.allow: [repoRoot]` (the root has no `workspaces`, so Vite would answer 403 for `../shared/ui`). The consumers are
  `src/frontend` and `src/admin`. The admin's tests run under `tsx --tsconfig tsconfig.app.json`, which resolves the same
  `paths`.
- **Tailwind 4** scans only under the Vite root: each app's CSS adds `@source "../../shared/ui/src";`. The library's CSS is
  imported by relative path; step 1 verifies that `@theme` inside an imported file and the font `url()` rebasing work with
  the pinned Tailwind and Vite, in both apps.
- **Packages:** `src/shared/ui/package.json` pins the same versions as the interface; TypeScript redirects duplicates of
  one name and version, Vite's `dedupe` handles the runtime.
- **The interface's Electron build is unchanged:** `dist:win` builds `src/frontend` with Vite, which bundles the library
  into `frontend/dist`; `electron-builder.config.cjs` ships only that and `shared/media/dist`. The admin is not in the
  desktop installer (`AGENTS.md`); the backend serves its built `dist` at `/admin/`.
- **The store:** every component and hook takes values and callbacks. Each app spreads `createChromeSlice(set, get)` into
  its own single `create()` call, so "one zustand store per program" (`01` section 4.1) holds. The interface keeps its
  `shell-slice.ts` as the adapter; the admin's store is the chrome slice plus its tab, rail and sign-in fields.
- **The panes:** the engine takes a `PaneHost = { getState(), subscribe(cb) }` (a zustand hook satisfies it) and a limits
  table instead of `constants/surfaces.ts`. The interface's table is its three surfaces; the admin's, written in `28`, is
  six keys of one left pane each.

## 4. What the amendments are (the coordinator makes them as each step lands, never before)

| Where | Change |
|---|---|
| `01` section 4.2 | a shared library may be React/TSX consumed by source alias (`src/shared/ui`), or React-free (`src/shared/http`); the Node-strippable rule stays for the libraries tools run |
| `01` section 4.1 | the one request layer is `shared/http`'s `createApi`; each app keeps a thin `services/api.ts` adapter |
| `23` section 3.1 | the diff-to-family check retires; `scripts/check-rules/rules/family-files.mjs` is removed or re-pointed at `src/shared/ui` (the ceiling and one-component rules then apply to the library) |
| `scripts/check-rules` | `PROGRAM_ROOTS` gain `src/admin`, `src/shared/ui`, `src/shared/http`; `size-and-naming.mjs` treats `src/shared/ui/src/(components dirs)` as PascalCase and `hooks` as `useThing`; `frontend-structure`, `type-scale`, the raw-hex rule and the transport rules cover `admin` and `shared/ui`; `import-boundaries` adds `admin` and forbids `shared/ui` importing a program; a new static rule checks each consuming app's alias, `@source`, `dedupe` and `fs.allow` (section 6.2) |
| gate | typecheck, lint and test steps for `shared/ui`, `shared/http` and `admin` (a folder without `package.json` is skipped, so they can land early); oxlint for the library |
| `AGENTS.md`, `00`, `07` | layout and the doc index when the plans land |
| `01` section 9 (buttons table), at Wave 2 | the admin's toolbar strip may carry `Discard changes` (ghost), `Save` (edged) and one filled forward verb; the table forbids a primary button in a toolbar and the owner's family screenshots (`training-workspace.jpg`) draw it |

## 5. The steps (each is a worker's brief; verification for every step is the gate plus the coordinator's visual acceptance)

Visual acceptance, every step: with the owner's real `npm run dev` stack running, the coordinator drives the touched
surfaces in the real Electron window (made visible; a covered Chromium window stops painting) and a Chrome tab on 5171 at
1600x1000 and 900x640, compares with the previous behaviour (a screenshot of the same state taken before the merge), and
reads the console and network; the gate stays green. **The admin app is checked the same way** (Vite on 5172 and the
backend's own Electron window, debug port 9223) against its own before-state, and each step's admin copy is deleted in the
same commit that rewrites its imports (section 6.3). The admin is still the template's demo during this wave, so "renders
as before" is literal.

| Step | Worker | Moves | Files | Risk | Specific checks |
|---|---|---|---|---|---|
| 0 | U1 | scaffold and rules: `src/shared/ui` and `src/shared/http` folders with `package.json`, `tsconfig.json`, gate steps (including `src/admin`), the Vite alias, `fs.allow`, `dedupe`, `@source`, `tsconfig` paths in **both** apps, the rule-checker and `01` amendments | `scripts/check-rules/*`, `scripts/check/gate.mjs`, `src/frontend` and `src/admin` `vite.config.mts` and `tsconfig.app.json` | low | gate green; checker unit tests for the new roots; the static consumption rule passes for both apps |
| 1 | U1 | tokens, CSS and fonts: `index.css` splits into the library's `tokens.css` and the interface's delta (spot, theatre, workspace); `base`, `fonts`, `keyframes`, `motion-reduce`, `video.css`; `--color-stage`; the `woff2` files | `src/frontend/src/index.css`, `styles/*`, `assets/fonts`; the admin's same files | low | light theme, the five accents, fonts in the network tab of both apps, reduced motion, a dark video stage in the Live surface |
| 2a | U1 | the button family: `Button`, `IconButton`, `Field`, `Toggle`, `Segmented` (adds a **field size**: 36px chips, equal segments, spanning the row), `ChipGroup`, `ChipsInput`, `InlineLink`, `cn`, `bus` | `components/ui/*`, about 50 import rewrites | low (mechanical) | Live, Library, Player, Settings, Collections |
| 2b | U1 | form and tooltip: `Form` (split under 200 lines), `NumberField`, `NumericInput`, `SliderField`, `Tooltip` (the interface's build, with `focusable` and `label`) | the same | low | Settings, Collections |
| 2c | U1 | skeletons, lists and menus: `SkeletonRows` (22 consumers), `SkeletonCards`, `Reveal`, `DataTable`, `NavRail`, `ActionList`, `SplitList`, `AppIcon`, the context menu and its types, `useScrollSpy`, `useViewport`; one `SHIMMER` | the same | low | every loading state; a context menu in Library |
| 3 | U2 | small decouples: `ArmedButton`, `Section`, `useReduceMotion`, `Swatches`, `text-field`, one `motion`/`timing` constants file | six files | medium (`usePaneTween` and the fold animation read reduced motion) | reduce-motion on and off; a pane tween; a two-step Remove |
| 4 | U2 | shell chrome, presentational: `Brand`, `TabPill`, `Titlebar`, `Statusbar`, `RunningWork`, `EventRow`, `AppShell` slots; the interface keeps adapters | `components/chrome/*`, `test/theatre-mode.test.ts` | medium (Theatre and the idle `chrome-bar` rules) | Theatre on and off, the 5-second idle hide, tab switch |
| 5 | U3 | `shared/http`: `createApi` (a base, headers, `onEvent`, `onUnauthorized`, an injected sentence table); the interface's `services/api.ts` and `error-sentence.ts` become adapters | `services/api.ts`, `lib/error-sentence.ts`, `test/api.test.ts` | low to medium | real fileserver calls; error sentences |
| 6 | U3 | the chrome slice factory (`say(sentence, tone, area?)` gains the area the Events row carries), `useTheme(values)`, the key-map hook, the Events drawer (props, `Load older`, the N events line), `settings-zoom` | `store/slices/shell-slice.ts`, `hooks/useTheme.ts`, `EventsDrawer.tsx` | medium to high (the store feeds every surface) | theme, accent, zoom, Events open and close, notices |
| 7 | U4 | windows: `ChildWindow` and parts, `useChildWindowBox` (props), popups, the Settings frame | `components/overlays/*`, `popups/*`, `settings/*` | medium | Settings and Collections windows: drag, resize, `Escape`, focus return |
| 8 | U4 | the pane engine: `PaneHost` and a limits table into `usePaneTween`, `useWorkspaceSplit`, `WorkspaceSplit`, `pane-collapse` | five files, `workspace.css` | **high** (Allotment timing; the stale-video history) | toggle, drag, collapse, reopen, a narrow window falling and rising, Theatre, all three surfaces, a video after panes change while hidden |
| 9 | A, inside Waves 2 to 6 | the admin-only pieces, built by the admin's waves directly into the library: `Checkbox` (row selection), `RecordGrid` with its skeleton and a state word, `ToolbarStrip`, the `reason` prop on `Button` and `IconButton` (a disabled control wrapped in the `Tooltip` with `focusable` and `label`, as `ResumeFooter` does), `ChipGroup` redrawn as pills with a minimum count, `ChipsInput` taking a `className`, the tooltip arrow that follows its anchor, the shell's minimum size (900 x 640) | `src/shared/ui` | low | comparison with the template's equivalent screen (`28`) |

## 6. Wave 1: workers, ownership, order, verification

### 6.1 Workers and dependency order

One worker per real sub-project (`07` 6.1) would be one worker for the whole wave, but the owner's direction is a finer
split for a named plan (`07` 6.1, second bullet): four workers by step group. They run **one after the other**, each cut
from the then-current `family-port` after the previous one has been landed, accepted and committed, because every step edits
`src/frontend` and `src/admin` and the later steps use the earlier ones. (Step 5 touches only the request layer and could run
beside U2; the order is kept strict so no two workers ever edit `src/frontend` or `src/admin` at once.)

| Worker | Steps | Worktree and branch | Owns (may change) | Depends on | Lands before |
|---|---|---|---|---|---|
| U1 | 0, 1, 2a, 2b, 2c | `D:\Projects\.giga-worktrees\ui-foundation`, `ui/foundation` | `src/shared/ui/**`, `src/shared/http/**` (scaffold only), `scripts/check-rules/**`, `scripts/check/gate.mjs`, import rewrites in `src/frontend/**` and `src/admin/**` and the deletion of the copies they replace | the plan | U2 |
| U2 | 3, 4 | `...\ui-shell`, `ui/shell` | `src/shared/ui/**`, `src/frontend/src/components/chrome/**`, `ui/ArmedButton`, `Swatches`, hooks and constants named in the steps, the same files in `src/admin/**`, their tests | U1 landed | U3 |
| U3 | 5, 6 | `...\ui-state`, `ui/state` | `src/shared/http/**`, `src/shared/ui/**`, `src/frontend/src/services/api.ts`, `lib/error-sentence.ts`, `store/slices/shell-slice.ts`, `hooks/useTheme.ts`, `components/chrome/EventsDrawer.tsx`, the same in `src/admin/**`, their tests | U2 landed | U4 |
| U4 | 7, 8 | `...\ui-windows-panes`, `ui/windows-panes` | `src/shared/ui/**`, `src/frontend/src/components/overlays/**`, `popups/**`, `settings/**`, the pane engine files and `styles/workspace.css`, the same in `src/admin/**`, their tests | U3 landed | Wave 2 |

Off limits to every U worker: `src/fileserver`, `src/backend`, `src/shared/media`, any doc, any `.env` or `data/`, the root
`package.json` (the coordinator applies script changes). Each worker follows `07` 6.3: `npm ci` in its own worktree only,
the typecheck of `src/frontend`, `src/admin`, `src/shared/ui` and `src/shared/http` (the ones that exist at its step), the
lint, `node scripts/check-rules.mjs`, all clean; tests written, **not run**; one commit per step on its branch, never
pushed, merged or rebased; the report of `07` 6.4. The admin is edited only for what a step moves: an import rewrite and
the deletion of the copy it replaces. No admin page work, no stripping of the demo (Wave 2 does that), no new admin file.

### 6.1a Wave 1 progress and files by worker

| Worker | Steps | Status | Landed in | Creates | Updates | Deletes (same commit) |
|---|---|---|---|---|---|---|
| U1 | 0, 1, 2a, 2b, 2c | Done | `d1aa570` | `src/shared/ui/**` (`package.json`, `tsconfig.json`, `styles/`, `controls/`, `form/`, `lists/`, `menus/`, `hooks/`, `lib/`, fonts), `src/shared/http/` scaffold, the rule-checker tests of 6.2 | `scripts/check-rules/*`, `scripts/check/gate.mjs`, both apps' `vite.config.mts`, `tsconfig.app.json`, `index.css`, and every import of a moved UI file | the frontend's and admin's copies listed in 6.3 for steps 0 to 2c |
| U2 | 3, 4 | Done | `51e2cec` | `shell/`, `Swatches`, `ArmedButton`, the motion constants in the library | `components/chrome/*` of the interface (become adapters), `test/theatre-mode.test.ts` | the admin's chrome copies of 6.3 for steps 3 and 4 |
| U3 | 5, 6 | Done | `6914728` | `src/shared/http/src/*`, `store/chrome-slice.ts`, `useTheme`, `useShellKeys`, `EventsDrawer` | `services/api.ts`, `lib/error-sentence.ts`, `store/slices/shell-slice.ts`, `test/api.test.ts` (moved) | the admin's copies of 6.3 for steps 5 and 6 |
| U4 | 7, 8 | Done | `4f21c11` | `windows/`, `panes/` | `components/overlays/*`, `popups/*`, `settings/*`, the pane engine files, `styles/workspace.css` | the admin's copies of 6.3 for steps 7 and 8 |

### 6.2 Tests each worker writes (fast, `node:test`, written not run)

The repository's tests are pure TypeScript under `tsx --test`; there is no DOM test environment. Component markup is
asserted with `renderToStaticMarkup` from `react-dom/server` (attributes and classes, no events); behaviour that needs a
timer or an event is moved into a pure helper that is tested with an injected clock (`01` section 10).

| Worker | Tests |
|---|---|
| U1 | `scripts/check-rules/test/shared-ui-roots.test.ts` (the new roots are program roots; library naming; `shared/ui` importing a program is flagged; `admin` is a program root); `scripts/check-rules/test/shared-ui-consumption.test.ts` (a consumer missing the alias, `@source`, `dedupe` or `fs.allow` fails; both real apps pass); `src/shared/ui/test/cn.test.ts`, `label-column.test.ts` (`labelColumn` floor 120 and growth), `segmented-markup.test.ts` (default pills; the field size is 36px, equal segments, spans the row; a disabled option carries `disabledReason` as its title), `form-markup.test.ts` (`Row` renders the glyph only with a `tip`, the error line with `role="alert"`, `trailing`; `Actions pinned` is a top strip), `skeleton-markup.test.ts` (`SkeletonRows` count, `aria-hidden`, one `SHIMMER`), `reveal-markup.test.ts` (skeleton while not ready, `aria-busy`) |
| U2 | `src/shared/ui/test/armed-button-markup.test.ts` (rest ghost, danger when armed through the injected state helper, `title` "Press again to confirm"), `titlebar-markup.test.ts` (a toggle with no pane is disabled with the reason on its wrapper; tabs disabled under an open window with the reason on the track), `tab-pill-markup.test.ts` (equal-width grid, `data-active`), `running-work-markup.test.ts` (idle track and `idle`; indeterminate work fills and pulses; `Stop` disabled with its title), `theatre-mode.test.ts` and `theatre-idle.test.ts` (repointed), `swatches-markup.test.ts` |
| U3 | `src/shared/http/test/api.test.ts` (moved: envelope parse, a non-envelope is `backend.bad_response`, a rejected fetch is `backend.unreachable`, `onEvent` per call, `onUnauthorized` on 401, the injected sentence table), `src/shared/ui/test/chrome-slice.test.ts` (the factory: `say` tones and area, the events cap of 200, `clearEvents`, `folded`, `childBounds`, the zoom clamp, theme/accent/motion setters), `shell-keys.test.ts` (the key map resolves `Ctrl`+digit to an id, `Ctrl+0`, text fields ignored, a modal yields), `events-drawer-markup.test.ts` (`Load older` only when the drawer is given an older page; the `N events` line; Clear disabled when empty), `settings-zoom.test.ts` (moved) |
| U4 | `src/shared/ui/test/child-bounds.test.ts` and `overlays.test.ts` (moved and repointed), `pane-collapse.test.ts` (the moved `shell-collapse`), `pane-host.test.ts` (a limits table answers min, max and preferred per key; a key with no pane is absent; a `PaneHost` fake drives `usePaneTween`'s pure parts), `settings-frame-markup.test.ts` (rail 150, 210 on a wide window; a tablist; the label column is passed in) |

### 6.3 What each step deletes from `src/admin`, in the same commit

The admin template keeps its own copies of the files below until the step that moves them; the step rewrites the admin's
imports to `@giga/ui` and `@giga/http` and deletes the copy. `28` assumes these are gone.

| Step | Deleted from `src/admin/src` (each replaced by an `@giga/ui` import) |
|---|---|
| 1 | tokens in `index.css` (the file keeps its imports and `@source`), `styles/base.css`, `fonts.css`, `keyframes.css`, `motion-reduce.css`, `video.css`, `assets/fonts/*` |
| 2a | `components/ui/Button`, `IconButton`, `Field`, `Toggle`, `Segmented`, `ChipGroup`, `ChipsInput`, `InlineLink`; `lib/cn.ts`, `lib/bus.ts` |
| 2b | `components/ui/Form`, `NumericInput`, `NumberField`, `SliderField`, `Tooltip` (with `InfoTip`) |
| 2c | `components/ui/SkeletonRows`, `SkeletonCards`, `Reveal`, `NavRail`, `DataTable`, `ActionList`, `SplitList`, `AppIcon`, `ContextMenu`, `ContextMenuRow`, `ContextMenuSubmenu`; `types/menu.ts`; `hooks/useScrollSpy`, `useViewport` |
| 3 | `components/ui/ArmedButton`, `Swatches`; `hooks/useArmedAction`, `useReduceMotion`; `constants/timing`, `constants/motion`; `lib/text-field.ts` |
| 4 | `components/chrome/Brand`, `PageTabs` (becomes `TabPill`), `Titlebar`, `Statusbar`, `RunningWork`, `EventRow`; the admin's `AppShell` and `App` are rewritten onto the library's slots |
| 5 | nothing: the clone has no request layer (its `services/*` are refusing stubs); `29` writes the adapter |
| 6 | `components/chrome/EventsDrawer`; the chrome fields of `store/app-store.ts` (`eventsOpen`, `events`, `notice`, `say`, `overlay`, `uiZoom`, `theme`, `accent`, `motion`, `folded`, `childBounds`) become the spread factory; `hooks/useTheme`, `useShellKeyboard` (a key map is passed); `lib/settings-zoom.ts` |
| 7 | `components/overlays/ChildWindow`, `ChildGrips`, `ChildScrim`; `components/popups/PopupPanel`; `hooks/useChildWindowBox`, `useChildWindowKeys`, `usePopupFrame`; `lib/child-bounds.ts`, `popup-place.ts`; `constants/child-window.ts`, `popups.ts`; `types/child-window.ts`, `overlays.ts`; the frame and rail of the Settings window (`SettingsRail`) |
| 8 | `components/chrome/WorkspaceSplit`; `hooks/usePaneTween`, `useWorkspaceSplit`; `lib/pane-collapse.ts`; `styles/workspace.css`; `types/panes.ts`; `test/shell-collapse.test.ts` (the library owns it) |

`PosterImage` and `LogoImage` stay in the admin (27 section 1 keeps them out of the library). Tests of a moved file move with
it; the admin keeps tests of its own files and repoints the rest.

### 6.4 What the coordinator verifies on the real stack after each worker

Common to every worker: merge its branch, `npm ci` where a lockfile changed (never under a running app), run
`node scripts/check/gate.mjs` and require `gate: PASS` with the steps landed so far; then, on the owner's real stack and
with the owner's say for any program start: Chrome on `http://127.0.0.1:5171` (the interface) and `http://127.0.0.1:5172/admin/`
(the admin) at 1600 x 1000 and at 900 x 640, and the real Electron windows made visible (the desktop app on debug port 9222,
the backend's admin window on 9223), each compared with a screenshot of the same state taken before the merge. Console and
network are read; any error, failed answer, missing control or changed look that is not named in the step fails the wave and
goes back to the same worker with the exact output (`07` 6.5). The coordinator changes only UI state and puts it back.

| Worker | The checks that belong to it |
|---|---|
| U1 | Live, Library, Player, Settings and Collections draw as before; every loading state shows its skeleton; light theme and all five accents; the four fonts load from the fileserver (interface) and from the backend's `/admin/` build (admin) with status 200; reduced motion; a class used only by the library renders in **both** apps (the static rule passes and a library-only utility is visible in the admin demo); the Live stage is still dark in the light theme |
| U2 | a two-step Remove arms, re-arms after 4 s, disarms on blur and `Escape`; Reduce motion On/Off with a pane tween and a section fold; Theatre on and off, the 5-second idle hide of the bars, a tab switch; the titlebar in both apps (ghost toggles, a toggle with no pane disabled with its reason, tabs asleep under an open window) |
| U3 | a real fileserver call per surface answers and validates; hydration restores the saved layout; theme, accent, zoom and Reduce motion apply and are saved; the Events drawer opens and closes, shows one Connection row per call and `Load older` only where given a page; a refusal shows its sentence once on the notice line; zoom reset with `Ctrl+0`; the unit test covers the refusal table (a refusal is not provoked on the owner's data) |
| U4 | Settings and Collections windows: open centred at the content's size, drag by the header, resize by all eight grips, `Escape` (not while typing), focus returns to the opener, bounds remembered for the run, pulled back when the window shrinks; panes: toggle, drag, collapse, reopen, a narrow window falling and rising with the notices, Theatre, all three surfaces, and a video that repaints after panes change while its surface was hidden; the same on the admin demo; the Electron windows made visible |

## 7. Risks

- **The store is the single source for every surface** (step 6): the factory must keep every selector and the persisted
  shape the interface writes back, or hydration breaks.
- **Allotment timing** (step 8): a pane change while a surface is hidden must still repaint its video; the existing
  repaint hook stays in the interface and is a slot of the shared `WorkspaceSplit`.
- **Tailwind class scanning:** a missing `@source` silently drops classes; step 0 adds a static rule and step 1 a visible
  check (a class used only by the library must render in both apps).
- **Two consumers, one set of dependencies:** a version drift between `src/frontend`, `src/admin` and `src/shared/ui` would
  load two Reacts; the pins are equal, `dedupe` is set, and the static rule compares the versions.
- **Tests that import moved files** (`child-bounds`, `event-log`, `settings-zoom`, `shell-collapse`, `theatre-idle`,
  `overlays`, `shell-keyboard`, `api`, `theatre-mode`, `app-store`, `writeback`): each step moves or re-points its tests,
  in both apps.
- **Fonts:** the `woff2` files are served by the fileserver for the interface and by the backend for the admin
  (`admin-static-service.ts` already serves them).
- **The admin demo changes slightly** at step 4 (ghost titlebar toggles) and step 8 (the pane engine is the library's); both
  are the interface's current behaviour.

## 8. Exit criteria (Wave 1)

**The interface renders as before; the gate passes with `shared/ui`, `shared/http` and `admin` in it; the template's own
copies in `src/admin` are replaced by `@giga/ui` and `@giga/http` imports.** In full: the interface renders as before on
every surface at both sizes, in the browser and in the Electron window; the gate prints `gate: PASS` with `shared/ui`,
`shared/http` and the admin in it (their typecheck, lint and tests); `src/frontend` holds no copy of a moved file; the
admin holds none of the files section 6.3 lists (`grep` finds none, and the admin imports its primitives, chrome, windows and
pane engine from `@giga/ui`, and has no request code of its own yet); the family-file check is retired; the admin demo still
renders and runs as the template did. Only then does Wave 2 start, from the then-current `family-port`.

## 9. Choices made where the docs left a gap

- Four workers by step group, run strictly in sequence, because every step edits both apps (`07` 6.1: the owner may direct
  a finer split for a named plan; the owner's brief names the workers U1 to U4 for Wave 1).
- The library takes the interface's build of each file, not the older clone's.
- `video.css` and `--color-stage` move into the library (the Preview window is the second user of a dark picture area); the
  Theatre tokens and `workspace.css`'s interface-only rules stay in the interface's delta.
- The context menu and its types, `useScrollSpy` and `useViewport` move at step 2c, `text-field` at step 3, `settings-zoom`
  at step 6; the admin draws no context menu, so its copies are deleted without a replacement import.
- Component tests render to a string; there is no DOM environment.
- The admin's `LogoImage` and `PosterImage` copies stay (they are not in the library).
