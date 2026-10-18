# 50 - The status bar and the shell polish (plan v1)

**Status: v1 (2026-10-18).** Owner: "on the status bar, there is a label that says layout saved. its pointless, a user cant do
anything with that, and they dont really need to know. its more for debugging ... it should only display status labels and
progress - not 'informational' labels"; "i want a similar style spotlight bg like we have on the theater mode center stage, on
every center stage in normal mode in the admin and frontend. it can be the same one we use on theatre mode"; "in theatre mode,
the progsss bar in teh status bar needs a subtle outline like teh nav pill has because its blending in with the background";
"the progress bar needs to update realtime for all loading events, like when the library is loading, video is loading, and teh
progress bar stops when the data is at rest"; "the stop button should become enabled when a video is playing, and actually stop
or pause the video in which ever player that is playing"; "make is so that the modal backdrop does not cover the title bar, the
buttons on the title bars should go unselected and disabled whena modal is open"; "give teh spotlight search a backdrop, it
should be consistent with the rest of the apps backdrops"; "make the child windows a little bigger initially, they should take
up more real estate". Docs first (`07`). Scope: the shared kit (`src/shared/ui`), the frontend's chrome and pages, the admin's
chrome. The channel-health words and the Preview's toggles are doc `51`, not here. This is a shared-kit wave: both programs
move together, without per-program rework. Landing (`07` 6.1): `feat/shell-kit` (the kit below, plus the mechanical view
adaptation of the two running-work wrappers so every landing compiles) and `feat/online-offline` (`51`'s backend) run in
parallel; `feat/shell-frontend` and `feat/shell-admin` (the frontend and admin below, `51`'s admin included) are cut only
after those land.

## 1. Why (observed in the merged code)

- The statusbar's notice line shows every `say()`, and routine confirmations dominate it: `Layout saved.` fires on every pane
  toggle, resize commit and surface change (`useShellWriteback.ts:40`, debounced 400 ms), beside `Settings saved.`,
  `State restored.`, `Zoom reset to 100%.`, `Channels refreshed.`, the admin's `Saved X.` set and `Synced: ...`. None names a
  state a user acts on; all are debug-grade.
- The statusbar's progress bar reads only the fileserver's jobs (`RunningWork`: `jobs.filter(isLive)`). The interface's own
  loading - the library's reads and paging, the player's pending reads and `{kind:"loading"}` stage, the live stage's
  `loading`, the spotlight's `searching` - is invisible there, and every one of those signals already lives in the one store.
- In theatre the token remap turns `--color-surface` to `#000`, so the progress track (`bg-surface`) sits black on the black
  bar. The track has no edge; the nav pill keeps its `border-ctl-edge` (not remapped) and stays visible.
- The kit's `RunningWork` exists twice: `shell/RunningWork.tsx` and the admin's look-alike `AdminRunningWork.tsx:34-61`. The
  bar's Stop cancels a job only; nothing stops a playing video.
- `ChildScrim` paints a second wash strip ACROSS the titlebar (`data-scrim-titlebar`), so the sleeping controls behind it are
  hidden instead of visibly asleep; the theatre button does not sleep at all (it has no `reason`, `Titlebar.tsx:45-57`).
- The spotlight search's full-window catcher (`SpotlightCatcher`, z-46) is invisible: no backdrop, unlike every other
  overlay; `TitleSpotlight`'s own comment promises "no scrim", which the owner has reversed.
- Child windows open at `WORK_WIDTH 960 x WORK_BODY 700` (Title information 640x480, Preview 640x450), capped at 80% of the
  room - small on today's displays - and a remembered bound restores the old size forever.
- The theatre spotlight (`workspace.css:10-21`, `--color-spot` = white 4.5%) exists only under `:root[data-theatre]`, and the
  token lives in the frontend's `index.css`: normal-mode centre panes (the frontend's three surfaces and all six admin tabs)
  have no spotlight.

## 2. Decisions

1. **The statusbar speaks status and progress only.** Shared `say()` changes: an `info` sentence no longer touches the notice
   line - it appends an info row to the events drawer (the drawer is the record); `warn`/`error` are unchanged (notice line +
   events row). The debug-grade sentences are DELETED outright, not even the drawer: `Layout saved.`,
   `Settings saved.`, `State restored.`, `Zoom reset to 100%.`, `Channels refreshed.`, the admin's `Saved X.` set (the saved
   form is on screen; the audit carries the record) and `Synced: ...` (the Jobs row carries it), `Stopping N syncs.`, and
   `Running work is stopping.` / `Folder scan is stopping.` (the readout says `stopping` instead). Outcome sentences worth a
   record keep their words as drawer rows only: the collections' `saved / was created / removed`, the scan's
   `cancelled / finished`, and the library's seam notices. The failure warns keep everything they say today.
2. **One RunningWork, and the theatre outline.** The admin's duplicate is deleted. The kit's `RunningWork` takes a built view
   `{ active, percent, readout, stoppable, stopTitle, stopReason }`; the admin's `lib/running-work.ts` `workView` stays the
   admin's builder, the frontend gains one. The track gains the nav pill's edge - `border border-ctl-edge`, a 1px outline the
   theatre remap cannot darken - so the bar reads on black; the rest of its look is unchanged.
3. **The progress bar reads every loading event.** The frontend store gains `activity` - a `{ library, video, live, search }`
   flag set - written by the hooks that already own the loading state (`useLibraryData`'s read/paging, `usePlayerData`'s
   pendings and the stage's `loading`, `useStreamPlayer`'s stage, `useTitleSpotlight`'s `searching`). The view's priority: a
   live job first (determinate, `N running · X%`), then `searching` (`Searching titles`), then the library
   (`Loading library`), then the video (`Loading video`), then live (`Starting stream`); an indeterminate source pulses
   (`pulse-busy`, `percent: null`). At rest the bar empties and the readout returns to `idle`. Store flags are reactive, so
   the bar moves in real time with no polling. The admin's view is unchanged (its progress already rides the store).
4. **Stop stops playback.** The store gains a `stopRequest` serial. The statusbar's Stop is enabled while a job runs (today's
   cancel) OR a video plays; the title becomes `Stop playback` in that mode, and `Nothing is running.` stays the disabled
   reason. On the serial: `NativePlayer` pauses the element (the position stays, Resume keeps its job), the live stage
   detaches its engine back to its idle note, and an embed blanks its frame (`stopEmbed` - a provider iframe cannot be
   paused from outside; reopening the source plays again). `stoppable` reads `playerMedia.stage` (`native`/`embed` and not
   paused) and the live stage (`loading`/`ready`). A second press while stopping does nothing (guarded, as the admin's is).
5. **The backdrop leaves the titlebar.** `ChildScrim` loses the titlebar strip; the wash starts at `TITLEBAR_HEIGHT` (40),
   exactly as its main wash already does, and the titlebar keeps its native drag. The sleeping controls become visible as
   asleep: the tabs and pane toggles already disable with reasons and drop their pressed look (`TabPill` holds `data-active`
   only while not disabled); the theatre button joins them - `disabled`, the sleeping `reason`, and
   `on={theatre && !asleep}` so it reads unselected. The statusbar stays washed.
6. **The spotlight search gets the family backdrop.** The catcher becomes the backdrop: `bg-scrim` at z-46 under the panel
   (z-47), the same `--color-scrim` as the child scrim. A press on it still closes the spotlight; the title-information
   child scrim (z-48) still washes both; no dialog semantics are added.
7. **Child windows open bigger.** `WORK_WIDTH` 960 -> 1200, `WORK_BODY` 700 -> 840; Title information 640x480 -> 880x620;
   Preview 640x450 -> 820x560. Minimums and the 80% cap stay (a small window still decides). The memory keys gain a version
   (`settings@2`, `collections@2`, `title-info@2`, `preview@2`) so an old remembered box cannot restore the small size; the
   first open after the wave lands centred at the new size and is remembered as usual.
8. **The spotlight on every centre pane.** `--color-spot` moves into the kit's `tokens.css`; the `.pane-center::after` rule
   moves into the kit's `pane.css` and drops its `[data-theatre]` requirement - the same ellipse (62% 58% at 50% 46%), the
   same 4.5% white, over every `.pane-center` in both programs, theatre included (the tokens' theatre remap keeps that
   rendering identical to today). It stays a pseudo-element: `pointer-events: none`, over the recessed surface, behind
   nothing. The frontend's `workspace.css` keeps only the idle fade.

## 3. Changes from what is merged

- `src/shared/ui`: `shell/RunningWork.tsx` (the view prop, the edge), `windows/ChildScrim.tsx` (no titlebar strip),
  `lib/child-metrics.ts` (the sizes, the memory version), `styles/tokens.css` (`--color-spot`), `styles/pane.css` (the
  spotlight rule), `store/chrome-slice.ts` (`say()` info -> drawer row only).
- `src/frontend`: the deleted sentences in `hooks/useShellWriteback.ts`, `useSettingsWriteback.ts`, `useAppHydration.ts`,
  `useShellKeyboard.ts`, `useLiveActions.ts`; `components/chrome/RunningWork.tsx` (the view builder, the playback stop); the
  shell slice (`activity`, `stopRequest`) fed by `useLibraryData`, `usePlayerData`, `useStreamPlayer`, `useTitleSpotlight`;
  the stop consumers `NativePlayer.tsx`, `LivePlayer.tsx`/`useStreamPlayer.ts`, `EmbedHost.tsx`; `Titlebar.tsx` (the
  sleeping theatre button); `SpotlightCatcher.tsx` (the backdrop); `TitleInfoWindow.tsx` (880x620);
  `styles/workspace.css` (the theatre-only spotlight rule deleted, the idle fade kept).
- `src/admin`: `components/chrome/AdminRunningWork.tsx` deleted (the shared component takes the view); `AdminStatusbar.tsx`
  passes `workView`'s output; `constants/preview-copy.ts` (the Preview 820x560); the deleted `Saved X.` / `Synced` /
  `Stopping N syncs.` says in the copy constants and flows.

## 4. Tests

- Shared: an `info` say sets no notice and appends a drawer row, `warn`/`error` as before; RunningWork renders a built view
  (percent, pulse, readout, stop title, disabled reason tooltip) and the track's edge class; ChildScrim renders the one wash
  from the titlebar height and no titlebar strip; child-metrics: the new defaults, the cap, the versioned memory key.
- Frontend: the view builder's priority (job > search > library > video > live) and its idle; a `stopRequest` pauses a fake
  video element, detaches a fake live engine and blanks a fake embed; the theatre button disabled with its reason while a
  child window is open; the spotlight backdrop is `bg-scrim` at z-46 under the panel.
- Admin: `workView` feeds the shared component unchanged; the notice set is warn/error only.
- Visual acceptance on the real `npm run dev` stack in connected Chrome at both required sizes: the spotlight on every centre
  pane (Library, Live, Player and the six admin tabs), theatre's outlined bar with a running and an idle fill, a modal with
  the titlebar visible and its controls asleep, the bigger windows on first open, the backdrop behind the spotlight search.

## 5. Docs (coordinator)

`00` gains the row. `02` (the statusbar's words: status and progress only; the spotlight's backdrop), `06` (the statusbar,
the spotlight and the child-window sections), `27` (the kit inventory's RunningWork/Scrim API words).
