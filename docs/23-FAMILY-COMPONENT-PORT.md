# 23 - Family Component Port

**Status: the plan, 2026-10-16, for replacing the interface's component layer with the family's, and rebuilding the
surfaces on it.** It owns the reason, the scope (every file replaced, kept and deleted), the waves and the visual gate.
Where it and `21` disagree, this document wins for the component layer and the surfaces it rebuilds. The product is
`00`, the screens are `02`, `04`, `05` and `06`, the rules are `01`, and process is `07`.

---

## 1. Why

Five rounds of review did not make the Player's bottom rail, the card buttons, or the headers and type match the family.
The owner pointed to Giga LoRA Studio's code and screenshots each time. The code was compared on 2026-10-16, and the
cause is the component layer, not the pane layout:

- **Every shared component with the same name differs from LoRA's.** Ten of ten: `Button`, `IconButton`, `Section`,
  `Segmented`, `SkeletonCards`, `SkeletonRows`, `StatusDot`, `ContextMenu`, `ContextMenuRow`, `ContextMenuSubmenu`.
- **Seventeen of LoRA's twenty-seven shared components do not exist here.** In their place are stand-ins written for
  Giga Stream: `Group`, `Row`, `Workspace`, `Rail`, `RailRow`, `RailSection`, `SelectField`, `TextField`, `Switch`, `Tip`,
  `Disclosure`, `FoldBody`, `PillChoice`, `Skeleton`.
- **The template was a fork.** Its README says it was extracted from an older Giga Stream commit, not from the family's
  current code. A family token was then changed here (`--duration-fade` 70 ms to 140 ms).
- **The specs added chrome the reference does not have** (a header and a fold on the related band, a tint on empty
  tiles, a 12 px label scale in `21` section 8a), and each round built that chrome faithfully.
- **Seven agents restyled surfaces in parallel**, each from its own reading, and the shared components were edited on three
  branches at once and merged by picking one side.
- **Nothing was compared with the reference on screen** until the fifth round, because workers may not open a browser and
  the coordinator looked only at landing.

The pane layout itself matches: in both apps the bottom pane is a full-width sibling of the row (`WorkspaceSplit`).

## 2. Decisions

1. **The reference is Giga LoRA Studio's interface**, `D:\Projects\giga-lora-studio\src\frontend\src`, as it stood on
   2026-10-16. That folder has no git history to pin, so the files ported are listed in section 3 with their line counts,
   and a later difference is found by comparing with that list. The owner's image `docs/reference/family/studio.jpg` is an
   older build (a header over the rail, square tiles); the live code wins where they differ.
2. **Ported files are copied, not rewritten.** A file in section 3.1 is copied byte for byte. The one change allowed is a
   recorded delta (section 3.1, "Deltas"). Nobody restyles a ported file to taste.
3. **Type and motion come from the family's components and tokens.** `21` section 8a's type scale is retired: a label is
   `Form`'s `FIELD_LABEL`, a section header is `Section`'s, a rail row is `NavRail`'s, and so on. Motion is the family's
   vocabulary in `index.css` and `constants/motion.ts`: fade 70 ms, fast 140 ms, collapse 100 ms, move 200 ms, page 280 ms.
   `02` section 6 is amended to say so.
4. **Rules for ported files.** A ported file keeps the family's shape, so it may exceed 200 lines and may export several
   components (`Form`, `NavRail`, `Section`, `Tooltip`). The checker reads the list in section 3.1 from
   `scripts/check-rules/family-files.mjs` and exempts those files from the size and one-component rules only. Every other
   rule still applies (strict TypeScript, no `any`, no fetch, no storage). `01` section 5 is amended to say so.
5. **The coordinator does the port and the rebuild itself**, wave by wave, without parallel surface agents, so one hand
   picks every class. An agent may be used for a mechanical task with no visual judgement, briefed with exact file lists.
6. **Every wave passes a visual gate** (section 5) against LoRA running on its own fileserver, side by side, at the same
   window size, before the next wave starts.
7. **Branch.** The work is on `family-port`, cut from `phase1-look` at `3dc08ac`. It is merged back when the owner signs
   off. There is no remote, so nothing is pushed.

## 3. Scope

Paths are under `src/frontend/src/` unless stated.

### 3.1 Copied from the family (verbatim)

| Source (LoRA `src/frontend/src/`) | Lines | Destination |
|---|---:|---|
| `index.css` | 236 | `index.css` |
| `styles/base.css`, `styles/fonts.css`, `styles/keyframes.css`, `styles/motion-reduce.css` | - | `styles/` (same names) |
| `constants/motion.ts` | 33 | `constants/motion.ts` (new) |
| `types/menu.ts` | - | `types/menu.ts` |
| `components/ui/ActionList.tsx` | 212 | same |
| `components/ui/AppIcon.tsx` | 31 | same |
| `components/ui/Button.tsx` | 73 | same |
| `components/ui/ChipGroup.tsx` | 53 | same |
| `components/ui/ChipsInput.tsx` | 123 | same |
| `components/ui/ContextMenu.tsx` | 75 | same |
| `components/ui/ContextMenuRow.tsx` | 64 | same |
| `components/ui/ContextMenuSubmenu.tsx` | 45 | same |
| `components/ui/Field.tsx` | 41 | same |
| `components/ui/Form.tsx` | 308 | same |
| `components/ui/IconButton.tsx` | 40 | same |
| `components/ui/InlineLink.tsx` | 13 | same |
| `components/ui/NavRail.tsx` | 92 | same |
| `components/ui/NumberField.tsx` | 92 | same |
| `components/ui/NumericInput.tsx` | 88 | same |
| `components/ui/Reveal.tsx` | 31 | same |
| `components/ui/Section.tsx` | 334 | same |
| `components/ui/Segmented.tsx` | 71 | same |
| `components/ui/SkeletonCards.tsx` | 68 | same |
| `components/ui/SkeletonRows.tsx` | 54 | same |
| `components/ui/SliderField.tsx` | 86 | same |
| `components/ui/SplitList.tsx` | 165 | same |
| `components/ui/StatusDot.tsx` | 20 | same |
| `components/ui/Toggle.tsx` | 104 | same |
| `components/ui/Tooltip.tsx` | 108 | same |

**Not copied:** `LoraRows.tsx` (needs LoRA's model types) and `PathField.tsx` (needs LoRA's studio service). Neither has a
use in Giga Stream.

**Deltas (the only edits allowed to a copied file):**

- `index.css`: the accent family `emerald` is named `green`, because the fileserver's setting is `themeAccent: green`
  (`03` section 3.2). Four selectors and one swatch token change; no value changes.
- `index.css`: one `@import "./styles/workspace.css";` stays, because Giga Stream's pane layout (`WorkspaceSplit`, the
  collapse tween) keeps its own classes. LoRA's own `.workspace-split` layer is copied and unused.

### 3.2 Kept (Giga Stream's own; no family equivalent)

| File | Why |
|---|---|
| `components/ui/DataTable.tsx` | the Collections tables; restyled to the family's tokens if it differs from `Form` |
| `components/ui/Swatches.tsx` | the accent picker; the family's settings use the same five families |
| `components/ui/PosterImage.tsx`, `components/ui/LogoImage.tsx` | the poster and logo boxes are Giga Stream's data |
| `components/chrome/*`, `components/overlays/*` | the shell, the work-window frame and the overlay host keep their behaviour; they take the family's components |
| `styles/workspace.css`, `hooks/useWorkspaceSplit.ts`, `hooks/usePaneTween.ts` | the pane layout, which already matches the family's |
| `store/`, `fixtures/`, `services/`, `lib/`, `types/` (except `types/menu.ts`) | not part of the look |

### 3.3 Deleted (replaced by a family component)

| Giga Stream file | Family replacement |
|---|---|
| `components/ui/Group.tsx`, `Row.tsx`, `Workspace.tsx` | `Form.tsx`: `Group`, `Row`, `Workspace`, `Actions` |
| `components/ui/Section.tsx`, `RailSection.tsx`, `Disclosure.tsx`, `FoldBody.tsx` | `Section.tsx` (controlled: `open`, `onToggle`; the store's `folded` map supplies them) |
| `components/ui/Rail.tsx`, `RailRow.tsx` | `NavRail.tsx`: `NavRail`, `NavGroup`, `NavItem` |
| `components/ui/SelectField.tsx`, `TextField.tsx` | `Field.tsx`: `Select`, `Input` |
| `components/ui/Switch.tsx` | `Toggle.tsx` |
| `components/ui/Tip.tsx` | `Tooltip.tsx`: `InfoTip`, `Tooltip` |
| `components/ui/PillChoice.tsx` | `Segmented.tsx` or `ChipGroup.tsx` |
| `components/ui/Skeleton.tsx`, `constants/skeleton.ts`, `Strip.tsx` | `SkeletonRows.tsx`, `SkeletonCards.tsx` (`SHIMMER`); the strip is a plain row |
| `styles/themes.css` | the theme and accent families live in the family's `index.css` |

### 3.4 Spec changes made with this document

| Doc | Change |
|---|---|
| `01` section 5 | ported family files keep their shape; the checker exempts them from the size and one-component rules (decision 4) |
| `02` section 6 | the motion durations are the family's (decision 3) |
| `06` section 5.5 | the related band is LoRA's `PastRuns` rail, copied: a row of thumbnails, no header, no fold, no tint; an empty or loading band is the rail's skeleton |
| `21` section 8a | retired; this document replaces it |

## 4. Waves

Each wave ends with the checks of `07` section 5 and the visual gate of section 5, and is committed on `family-port`.

### Wave 1 - The family's foundation

- Copy section 3.1. Apply the deltas.
- Add `scripts/check-rules/family-files.mjs` and teach the size and frontend-structure rules to skip its files.
- Delete section 3.3, and move every caller to the family component: about 120 call sites in the shell, the overlays and
  the four surfaces. Each call takes the family component's own props; a caller that needs a look the family component
  does not give is changed, not the component.
- The app runs, every surface draws on the family's components, and the checks pass.
- **Gate:** the titlebar, the statusbar, the context menu, a work window, a section header and a form row are compared
  with LoRA's.

### Wave 2 - Player, as LoRA's Studio

- The page follows LoRA's `pages/StudioPage.tsx`: left rail of `Section`s (the episode browser, as `ComposeRail` lays out
  its groups), the stage in the centre, the inspector on the right as `Section`s of `Form` rows, the bottom rail.
- The bottom rail is `components/generate/PastRuns.tsx` copied, with its data replaced by the related titles.
- **Gate:** the Player beside LoRA's Studio, region by region: the left rail, the right rail, the bottom rail.

### Wave 3 - Library, as LoRA's Gallery

- The rail is `NavRail` (Views, then Collections), as LoRA's `components/gallery/GalleryNav.tsx`.
- The filter pane is LoRA's `components/gallery/ImageFilters.tsx` pattern (a label over each control).
- The grid takes LoRA's `components/media/MediaGrid.tsx` tile chrome, with Giga Stream's 2:3 poster (owner decision).
- The Rows view keeps its shelves, on the family's components.
- **Gate:** the Library beside LoRA's Gallery.

### Wave 4 - Live

- The playback settings are `Section`s of `Form` rows, as LoRA's compose rail. The channel list is LoRA's queue rail
  pattern (rows, `SkeletonRows` while loading). The stage is unchanged.
- **Gate:** Live beside LoRA's Studio rails.

### Wave 5 - Windows

- Settings, Collections and Title information bodies are `Form` (`Workspace`, `Group`, `Row`, `Actions`), as LoRA's
  settings panes. The frame stays.
- **Gate:** Settings beside LoRA's Settings.

### Wave 6 - Guard rails

- The rule checker flags an arbitrary pixel text size (`text-[13px]`) in a surface file, outside `components/ui` (the
  family components and the poster and logo boxes), so the type cannot drift again (`scripts/check-rules/rules/type-scale.mjs`).
  It does not flag `font-mono` or `text-xs`: LoRA's own surfaces use those scale steps (QueueRow, JobDetails, the gallery
  album header), and the rows copied from them would fail a rule the family itself does not keep. A surface file that
  copies a LoRA surface's arbitrary size verbatim is listed in the rule with its source (the Settings rail).
- The docs that still describe the old components are corrected (`21` sections 3 to 5).

## 5. The visual gate

- LoRA runs on its own fileserver (`src/fileserver`, `npx tsx src/server.ts`, port 8790) with a temporary `DATA_DIR`, and
  its first-run setup is skipped without downloading anything. Giga Stream runs on its dev server on a free port.
- Both are opened in the same browser window size, and the same region is captured in each: the titlebar, each rail, each
  section header, a form row, a button, the bottom rail.
- A wave passes when the regions match. A difference that stays is listed in the wave's commit message with its reason
  (Giga Stream's data, a spec decision of the owner's). Anything else is fixed before the next wave.

## 6. Done when

All six waves are committed on `family-port`, every surface has passed its gate, the checks of `07` section 5 pass, and
the owner has signed off. Then `family-port` is merged into `phase1-look`.
