# 31 - Default source plan

**Status: plan, written before the code (branch `admin/default-source`, base `0b2cf65`).** Owner, 2026-10-17: when the
source is changed with the dropdown in the Player, that choice is saved as the default source, is selected when a
video is played, and is still the default after a reload or relaunch.

## 1. What exists today (verified)

- No `defaultSource` setting exists anywhere (fileserver `types/settings.ts`, `docs/03` section 3.2, the interface's
  `Settings`). The word appears nowhere in source.
- The dropdown is `components/player/PlayerSourceControl.tsx`, fed by `PlayerPage` -> `onSelect` (`setSource(id)`,
  `setUserInitiated(true)`).
- `hooks/usePlayerSources.ts` builds the item's sources (`lib/player-sources.ts`: provider rows ordered by the
  catalog `order`, id `provider:<providerId>`; the app's stream `app`; a local file `local`) and, in an effect on the
  sources, commits `selectedPlayerSource(sources, store.playerMedia.activeSourceId)`: the store's current choice if the
  item still has it, otherwise the first source.
- `playerMedia.activeSourceId` lives in the store only. It is never written to the fileserver.

## 2. Root cause

The choice is session memory: it is held in `playerMedia.activeSourceId`, which survives only while the page lives (and
only for items that still offer that id). A reload or relaunch starts at `null`, so the first source is always
selected. A choice made while one item played is also lost as a preference once an item without that source is
opened, because the store then falls back to the first source and overwrites it.

## 3. Design

**The setting.** A fileserver setting `defaultSource`: `string | null`, default `null` (the first source, as today).
The value is a source id exactly as the Player names it (`provider:<providerId>`, `app`; `local` is the only source of
a local file so it is never stored). Grammar: 1 to 200 characters or null; an invalid stored value reads as `null`
(`docs/03` section 3.2). It is saved by the existing settings write-back (`PATCH /api/settings`, debounced), which is
the system's persistence for preferences; no browser storage.

**Choosing.** The dropdown's `onSelect` switches the stage (as today) and calls `setPlayback({ defaultSource: id })`.
The store marks the settings changed, the write-back saves it, and the answer is committed like any setting.

**Applying.** `usePlayerSources` selects, for each newly resolved list of sources: the saved default when the item
offers it, otherwise the first source. (The saved default is read when the sources resolve, not as an effect
dependency, so choosing a source never restarts the stage.) Because choosing also saves the default, the stored
default is the choice in every case; `activeSourceId` only mirrors the effective source.

**Fallback.** A title that does not offer the saved source plays its first source and the saved default is left
alone: a source missing from one title (a provider with no URL shape for series, an item with no stream address) must
not erase the preference for the next title. A local file always uses `local`. Only an explicit pick changes the
default.

**Hydration.** The setting arrives in the startup snapshot (`GET /api/state` settings part) with the others, so after a
reload or relaunch the default is in the store before a Play can open the Player.

## 4. Change list

| File | Change |
|---|---|
| `fileserver/src/types/settings.ts` | the key, its schema, default and refusal message |
| `fileserver/src/services/settings-service.ts` | `defaultSource` in the answer |
| `fileserver/test/settings.test.ts` | the default answer carries `defaultSource: null`; new test: patch, read back, null resets, invalid refused |
| `frontend/src/services/schemas/settings-schema.ts`, `types/settings.ts`, `constants/settings-defaults.ts` | the key (in `PlaybackPrefs`) |
| `frontend/src/store/slices/playback-slice.ts` | default value |
| `frontend/src/store/settings-state.ts`, `shell-hydration.ts` | field, patch and settle for the key |
| `frontend/src/lib/player-sources.ts` | `preferredPlayerSource(sources, saved)` |
| `frontend/src/hooks/usePlayerSources.ts` | apply the saved default |
| `frontend/src/pages/PlayerPage.tsx` | the pick saves the default |
| `frontend/test/player-sources.test.ts` | preferred source, fallback, local |
| `docs/03` section 3.2 | should list `defaultSource` (not edited here) |

## 5. Failure modes

| Failure | Behaviour |
|---|---|
| Fileserver offline when picking | The pick still switches the stage; the settings write-back reports its usual notice and the store reverts to the committed value on refusal, so the default is the last saved one |
| Saved source gone from the catalog | The first source plays; the saved id stays until another explicit pick |
| Saved source offered by this item but failing | The stage's own failure note and Retry; the person picks another source, which becomes the default |
| Settings not yet hydrated | The default is `null` until the snapshot lands; the first source plays |
| Two windows | Last pick wins (settings are one row per key) |

## 6. Coordinator checklist (real stack)

1. `GET http://127.0.0.1:8090/api/settings` carries `defaultSource: null` before any pick.
2. In the Electron window (9222) open a title with two or more sources, pick the second in the Source dropdown:
   within a second `GET /api/settings` shows `defaultSource: "provider:<id>"`.
3. Open a different title that offers the same source: it starts on that source. One that does not: it starts on its
   first source, and `GET /api/settings` still shows the saved id.
4. Reload the window, and fully quit and relaunch the app: Play a title; the saved source is selected in the
   dropdown and hosted.
5. Pick the first source again: the setting changes to it. Restore the owner's original value afterwards.
