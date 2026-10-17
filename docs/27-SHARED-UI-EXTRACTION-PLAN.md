# 27 - Shared UI Extraction Plan

**Status: PLAN (2026-10-17). Nothing here is built.** It moves the family UI that `src/frontend` carries into a shared
library, `src/shared/ui`, and the request layer into `src/shared/http`, so the admin app (`26`, `28`, `29`) is built on the
same code as the interface instead of on a copy. Evidence: the recon of `src/frontend` (17,545 lines plus 5,114 of tests):
about 2,960 lines move as they are, about 2,870 after decoupling, about 11,700 stay with the interface.

The owner's decisions (2026-10-17): the admin is built on a shared UI library now, not as a copy; the Segmented control
stays the interface's rounded pills; `Enabled` is the family `Toggle` switch; the source alias is accepted
(`resolve.alias`, `server.fs.allow`, `dedupe`); the family-file diff check (`23` section 3.1) retires once the library is
the source of truth; `01` sections 4.1 and 4.2 and the rule checker are amended to allow a React/TSX shared library.

## 1. What moves and what stays

| Moves as it is (imports become relative) | Moves after a named decoupling | Stays in `src/frontend` |
|---|---|---|
| the controls kit: `Button`, `IconButton`, `Field`, `Toggle`, `Segmented`, `ChipGroup`, `ChipsInput`, `InlineLink`, `NumberField`, `NumericInput`, `SliderField`, `Form` (`Workspace`, `Group`, `Row`, `Wide`, `Actions`), `NavRail`, `Tooltip` and `InfoTip`, `SkeletonRows`, `SkeletonCards`, `Reveal`, `DataTable`, `ActionList`, `SplitList`, `AppIcon`, the context menu and its types, `cn`, `bus`, `useArmedAction` | `ArmedButton` (the 2-step time becomes a default prop), `Section` and `useReduceMotion` (read a context or the `data-motion` attribute, not the store), `Swatches` (a generic accent id), `Brand` (subtitle and icon props), `PageTabs` to `TabPill`, `Titlebar`, `Statusbar`, `RunningWork` (presentational only), `AppShell` (slots), `EventRow`, `EventsDrawer` (props), `event-log` (`restEvent` takes its words), toast/`say`, `ChildWindow` and its parts, `useChildWindowBox` (props), the Settings window frame, `useTheme` (values as arguments), `useShellKeyboard` (a key map), the pane engine (`usePaneTween`, `useWorkspaceSplit`, `WorkspaceSplit`, `pane-collapse`) with a `PaneHost` and a limits table, `index.css` and `workspace.css` (split into shared and delta files), `services/api.ts` and `error-sentence.ts` (to `shared/http`) | Library, Live, Player and Collections components, hooks, services and pages; `constants/surfaces.ts`; hydration and write-back (`useAppHydration`, `useShellWriteback`, `services/shell-state`); Theatre and `useNativeOverlay`; `services/desktop.ts`, `guard-events.ts`, `player-policy.ts` (the only `window.pocHost` users); `PosterImage`, `LogoImage`; the domain parts of `lib/` and `types/` |
| tokens, `base.css`, `fonts.css`, `keyframes.css`, `motion-reduce.css`, the four `woff2` fonts, the envelope schema | | |

Resolved differences between the interface and the admin mockup (the interface's version wins): durations 70 / 140 / 200 /
280 ms; the raised `Button`; the Segmented pills at the interface's size with a field size that makes a row's control
span the row (36px, equal segments); the lucide `ChevronDown` in `Select`; the input focus ring; the tab pill's equal-width
grid; the light theme and the accent ink. Kept from the mockup into the library: the tooltip arrow that follows its
anchor, the disabled-with-reason button (`aria-disabled`, the reason as a styled tooltip, a click guard), `Load older` in
the Events drawer, the checkbox, the record grid and the toolbar strip.

## 2. The target tree

```text
src/shared/ui/
  package.json  tsconfig.json     own typecheck and test; the same pinned versions as src/frontend
                                  (react, react-dom, framer-motion, lucide-react, zod, zustand, radix dropdown-menu 2.1.24)
  src/
    styles/    tokens.css  base.css  fonts.css  keyframes.css  motion-reduce.css  pane.css   + assets/fonts/*.woff2
    controls/  Button IconButton Field Toggle Segmented ChipGroup ChipsInput InlineLink Checkbox* ArmedButton Swatches
    form/      Form NumberField NumericInput SliderField Tooltip
    lists/     DataTable ActionList SplitList RecordGrid* SkeletonRows SkeletonCards SkeletonGrid* Reveal NavRail
    shell/     Brand TabPill Titlebar Statusbar RunningWork EventRow EventsDrawer AppShell ToolbarStrip*
    windows/   ChildWindow ChildGrips ChildScrim useChildWindowBox useChildWindowKeys PopupPanel usePopupFrame SettingsFrame
    menus/     ContextMenu ContextMenuRow ContextMenuSubmenu types
    panes/     usePaneTween useWorkspaceSplit WorkspaceSplit pane-collapse
    hooks/     useTheme useReduceMotion useArmedAction useViewport useShellKeys
    lib/       cn bus text-field event-log child-bounds popup-place settings-zoom
    store/     chrome-slice.ts     a factory: theme, accent, motion, uiZoom, eventsOpen, events, notice/say, logEvent,
                                   clearEvents, overlay, childBounds, folded
src/shared/http/                   createApi, ApiError, envelope-schema, error-sentence (an injected table); React-free
```

`*` marks what does not exist in the interface and is built straight into the library by the admin waves. File names keep
the interface's conventions: components `PascalCase.tsx`, hooks `useThing.ts`, everything else kebab-case; files at most
200 lines (`Form` 307, `Section` 338 and `ActionList` 212 are split as they move).

## 3. How the two apps consume it

- **A source alias, not a built package** (`src/shared/media` is built because Node and Electron cannot run TypeScript;
  both UI consumers are bundlers, and a third build would race the two that already share `dist`). `tsconfig.app.json`
  gets `paths` `@giga/ui/*` to `../shared/ui/src/*` and `@giga/http/*` to `../shared/http/src/*`; `vite.config.mts` gets
  `resolve.alias`, `resolve.dedupe` for react, react-dom, framer-motion, zustand and lucide-react, and
  `server.fs.allow: [repoRoot]` (the root has no `workspaces`, so Vite would answer 403 for `../shared/ui`).
- **Tailwind 4** scans only under the Vite root: each app's CSS adds `@source "../../shared/ui/src";`. The library's CSS is
  imported by relative path; step 1 verifies that `@theme` inside an imported file and the font `url()` rebasing work with
  the pinned Tailwind and Vite.
- **Packages:** `src/shared/ui/package.json` pins the same versions as the interface; TypeScript redirects duplicates of
  one name and version, Vite's `dedupe` handles the runtime.
- **The interface's Electron build is unchanged:** `dist:win` builds `src/frontend` with Vite, which bundles the library
  into `frontend/dist`; `electron-builder.config.cjs` ships only that and `shared/media/dist`.
- **The store:** every component and hook takes values and callbacks. Each app spreads `createChromeSlice(set, get)` into
  its own single `create()` call, so "one zustand store per program" (`01` section 4.1) holds. The interface keeps its
  `shell-slice.ts` as the adapter; the admin's store is the chrome slice plus its tab, rail and sign-in fields.
- **The panes:** the engine takes a `PaneHost = { getState(), subscribe(cb) }` (a zustand hook satisfies it) and a limits
  table instead of `constants/surfaces.ts`.

## 4. What the amendments are (the coordinator makes them as each step lands, never before)

| Where | Change |
|---|---|
| `01` section 4.2 | a shared library may be React/TSX consumed by source alias (`src/shared/ui`), or React-free (`src/shared/http`); the Node-strippable rule stays for the libraries tools run |
| `01` section 4.1 | the one request layer is `shared/http`'s `createApi`; each app keeps a thin `services/api.ts` adapter |
| `23` section 3.1 | the diff-to-family check retires; `scripts/check-rules/rules/family-files.mjs` is removed or re-pointed at `src/shared/ui` (the ceiling and one-component rules then apply to the library) |
| `scripts/check-rules` | `PROGRAM_ROOTS` gain `src/admin`, `src/shared/ui`, `src/shared/http`; `size-and-naming.mjs` treats `src/shared/ui/src/(components dirs)` as PascalCase and `hooks` as `useThing`; `frontend-structure`, `type-scale`, the raw-hex rule and the transport rules cover `admin` and `shared/ui`; `import-boundaries` adds `admin` and forbids `shared/ui` importing a program |
| gate | typecheck, lint and test steps for `shared/ui`, `shared/http` and `admin` (a folder without `package.json` is skipped, so they can land early); oxlint for the library |
| `AGENTS.md`, `00`, `07` | layout and the doc index when the plans land |

## 5. The steps (each is a worker's brief; verification for every step is the gate plus the coordinator's visual acceptance)

Visual acceptance, every step: with the owner's real `npm run dev` stack running, the coordinator drives the touched
surfaces in the real Electron window (made visible; a covered Chromium window stops painting) and a Chrome tab on 5171 at
1600x1000 and 900x640, compares with the previous behaviour, and reads the console and network; the gate stays green.

| Step | Moves | Files | Risk | Specific checks |
|---|---|---|---|---|
| 0 | scaffold and rules: `src/shared/ui` and `src/shared/http` folders with `package.json`, `tsconfig.json`, gate steps, the Vite alias, `fs.allow`, `dedupe`, `@source`, `tsconfig` paths, the rule-checker and `01` amendments | `scripts/check-rules/*`, `scripts/check/gate.mjs`, `src/frontend/vite.config.mts`, `tsconfig.app.json` | low | gate green; checker unit tests for the new roots |
| 1 | tokens, CSS and fonts: `index.css` splits into the library's `tokens.css` and the interface's delta (stage, spot, theatre, workspace, video); `base`, `fonts`, `keyframes`, `motion-reduce`; the `woff2` files | `src/frontend/src/index.css`, `styles/*`, `assets/fonts` | low | light theme, the five accents, fonts in the network tab, reduced motion |
| 2a | the button family: `Button`, `IconButton`, `Field`, `Toggle`, `Segmented` (adds a field size), `ChipGroup`, `ChipsInput`, `InlineLink`, `cn` | `components/ui/*`, about 50 import rewrites | low (mechanical) | Live, Library, Player, Settings, Collections |
| 2b | form and tooltip: `Form` (split under 200 lines), `NumberField`, `NumericInput`, `SliderField`, `Tooltip` | the same | low | Settings, Collections |
| 2c | skeletons and lists: `SkeletonRows` (22 consumers), `SkeletonCards`, `Reveal`, `DataTable`, `NavRail`, `ActionList`, `SplitList`, `AppIcon`; one `SHIMMER` | the same | low | every loading state |
| 3 | small decouples: `ArmedButton`, `Section`, `useReduceMotion`, `Swatches`, one `motion`/`timing` constants file | six files | medium (`usePaneTween` and the fold animation read reduced motion) | reduce-motion on and off; a pane tween |
| 4 | shell chrome, presentational: `Brand`, `TabPill`, `Titlebar`, `Statusbar`, `RunningWork`, `EventRow`, `AppShell` slots; the interface keeps adapters | `components/chrome/*`, `test/theatre-mode.test.ts` | medium (Theatre and the idle `chrome-bar` rules) | Theatre on and off, the 5-second idle hide, tab switch |
| 5 | `shared/http`: `createApi` (a base, headers, `onEvent`, `onUnauthorized`, an injected sentence table); the interface's `services/api.ts` and `error-sentence.ts` become adapters | `services/api.ts`, `lib/error-sentence.ts`, `test/api.test.ts` | low to medium | real fileserver calls; error sentences |
| 6 | the chrome slice factory, `useTheme(values)`, the key-map hook, the Events drawer (props, `Load older`, the N events line) | `store/slices/shell-slice.ts`, `hooks/useTheme.ts`, `EventsDrawer.tsx` | medium to high (the store feeds every surface) | theme, accent, zoom, Events open and close, notices |
| 7 | windows: `ChildWindow` and parts, `useChildWindowBox` (props), popups, the Settings frame | `components/overlays/*`, `popups/*`, `settings/*` | medium | Settings and Collections windows: drag, resize, `Escape`, focus return |
| 8 | the pane engine: `PaneHost` and a limits table into `usePaneTween`, `useWorkspaceSplit`, `WorkspaceSplit`, `pane-collapse` | five files, `workspace.css` | **high** (Allotment timing; the stale-video history) | toggle, drag, collapse, reopen, a narrow window falling and rising, Theatre, all three surfaces, a video after panes change while hidden |
| 9 | the admin-only pieces, built by the admin's waves directly into the library: `Checkbox` (row selection), `RecordGrid` with its skeleton and a state word, `ToolbarStrip`, a button that takes a disabled `reason`, the shell's minimum size, the tooltip arrow that follows its anchor | `src/shared/ui` | low | comparison with the mockup |

**The admin does not wait for steps 6 to 8.** Its shell waves depend on steps 0 to 4 and 9; until step 6 lands it defines
the eight chrome fields in its own small store and swaps to the factory later; until step 8 lands its workspace rail is a
width and a sash. Its sign-in and wiring waves (`29`) depend on step 5.

## 6. Delegation (`07` section 6; few workers, one per real sub-project)

| Worker | Steps | Owns | Lands before |
|---|---|---|---|
| U1 | 0, 1, 2a, 2b, 2c | `src/shared/ui`, `src/shared/http` scaffold, `src/frontend` import rewrites, the checker and gate edits | everything below |
| U2 | 3, 4 | the shell chrome and small decouples | the admin's shell wave |
| U3 | 5, 6 | `shared/http`, the chrome slice, `useTheme`, the Events drawer | the admin's wiring wave |
| U4 | 7, 8 | windows and the pane engine | nothing blocks on it |

The coordinator lands each branch in order: merge, run the gate, run the visual acceptance above, commit; a failure goes
back to the same worker with the exact output (`07` section 6.5). `src/frontend` and the admin are never edited by two
workers at once.

## 7. Risks

- **The store is the single source for every surface** (step 6): the factory must keep every selector and the persisted
  shape the interface writes back, or hydration breaks.
- **Allotment timing** (step 8): a pane change while a surface is hidden must still repaint its video; the existing
  repaint hook stays in the interface and is a slot of the shared `WorkspaceSplit`.
- **Tailwind class scanning:** a missing `@source` silently drops classes; step 0 adds a check (a class used only by the
  library must render in both apps).
- **Tests that import moved files** (`child-bounds`, `event-log`, `settings-zoom`, `shell-collapse`, `theatre-idle`,
  `overlays`, `shell-keyboard`, `api`, `theatre-mode`, `app-store`, `writeback`): each step moves or re-points its tests.
- **Fonts:** the `woff2` files are served by the fileserver for the interface and by the backend for the admin
  (`admin-static-service.ts` already serves them).

## 8. Exit criteria

The interface renders as before on every surface at both sizes; the gate passes with `shared/ui`, `shared/http` and the
admin in it; `src/frontend` holds no copy of a moved file; the family-file check is retired; the admin imports its
primitives from `@giga/ui` and `@giga/http` only.
