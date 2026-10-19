# 53 - The admin workspaces' fields and verbs (plan v1)

**Status: v1 (2026-10-18).** Owner: "on the titles workspave plot and cast details should be text areas"; "why is it a
one line text area?"; "on jobs the run job action should be in the tool bar, its literally the action when viewing the
workspace, the Run section is redundant". Scope: the shared kit's `Textarea` (one defect, no consumer change), the
Title workspace's Plot and Cast fields, the Jobs workspace's Run verb. The security question's move to the account is
`54`, not here. Landing (`07` 6.1): one wave, one worker, branch `feat/workspace-fields-verbs`, cut from `family-port`;
its files do not overlap `52`'s, so either order lands.

## 1. Why (observed in the merged code and the running app)

- The Title workspace's Plot is already the kit's `Textarea` (`rows` 4) but draws ONE LINE TALL. `field-class.ts`'s
  `FIELD` carries the one-line field height `h-ctl-md`; `Textarea` layers `h-auto` over it, but `cn` only joins class
  names and the generated stylesheet emits `.h-ctl-md` AFTER `.h-auto` (measured in the running admin's CSS), so the
  fixed height wins the cascade and the `rows` attribute is squashed. The admin's Plot is the family's only textarea
  consumer today (the interface has none), so the defect hid.
- The Cast field beside it is a single-line `Input` (`TitleTextRow`), and a cast list runs long; the owner wants both
  fields as text areas. `commaItems` - the Cast draft's splitter, `lib/title-units.ts:18` - splits commas only, so
  names typed one per line would not parse.
- The Jobs workspace's Run section (`JobRunGroup`: the ghost `Run job`/`Resume` and `Stop` in a mid-page group) holds
  the workspace's action, while the page toolbar - where a workspace's verbs live - shows only `Discard changes` and
  the forward verb.

## 2. Decisions

1. **The kit's `Textarea` gets its own height.** `field-class.ts` splits in two: `FIELD_BASE` (every field class
   except the height) and `FIELD` (unchanged: `FIELD_BASE` + `h-ctl-md`). `Input` and `Select` keep `FIELD`;
   `Textarea` composes `FIELD_BASE` + `h-auto resize-y py-2 leading-5`, so `rows` decides its height and the resize
   grip stays. No `!important`, no cascade fight; the fix reaches every future textarea consumer for free.
2. **Cast becomes a text area beside the Plot**: the same kit `Textarea`, `rows` 3 (Plot keeps its 4), the draft value
   unchanged (text). `commaItems` splits on commas AND newlines (trimmed, empties dropped, one of each - the genres'
   single-line field cannot hold a newline, so its behaviour is unchanged). `CAST_TIP` says one name per line or
   comma-separated. The Plot group's comment and the skeleton page keep their shapes.
3. **Run moves to the toolbar; the Run section dies.** *(Amended 2026-10-18, superseded by `55` decision 6: `Run job` is the
   Jobs workspace's PROMOTE - `Save` then `Run job` on the toolbar's RIGHT, nothing on the left but `Discard changes` - and `Stop`
   never sits on the toolbar; the statusbar's Stop owns stopping. `Save` itself moved from the form's end to the toolbar by `55`
   decision 1, on every workspace.)* As built here: `JobRunGroup` deleted; the rail and the scroll spy lose `jw-run`
   (`JOB_SECTIONS`); the run gate functions (`workspaceRunReason`/`workspaceStopReason`) move to the toolbar's call site
   unchanged; `workspace-verbs.ts` gains a verb shape for a toolbar verb whose label is not a forward destination.
4. Out of scope: the statusbar's Stop (`50`), the Jobs index, the tables of `52`, the security question of `54`.

## 3. Changes from what is merged

- `src/shared/ui`: `controls/field-class.ts` (`FIELD_BASE` beside `FIELD`), `controls/Textarea.tsx` (composes
  `FIELD_BASE`); `Input.tsx` and `Select.tsx` untouched (they keep `FIELD`). A kit markup test asserts a textarea
  carries `h-auto` and not `h-ctl-md`.
- `src/admin/src/components/titles/`: `TitlePlotGroup.tsx` (the Cast row becomes the `Textarea`; `TitleTextRow` keeps
  its other users - the worker verifies and lists them); the plot/cast markup tests.
- `src/admin/src/lib/title-units.ts` (`commaItems` splits newlines) and its unit tests; `constants/title-copy.ts`
  (`CAST_TIP`).
- `src/admin/src/components/jobs/`: `JobWorkspace.tsx` (the toolbar's verbs; the `jw-run` section removed),
  `JobRunGroup.tsx` deleted; `components/records/WorkspaceToolbar.tsx` (the verbs slot), `lib/workspace-verbs.ts` (the
  verb shape); `constants/job-copy.ts` (`JOB_SECTIONS` loses `Run`); the jobs markup tests (the toolbar's verbs with
  their reasons, the rail without `Run`).

## 4. Tests

- Kit: the textarea's classes (`h-auto`, no `h-ctl-md`, `rows` honoured); `Input` and `Select` unchanged.
- Admin: the Cast field renders a 3-row text area with its label and `aria-label`; the Plot textarea 4 rows;
  `commaItems("A\nB, C")` is `["A", "B", "C"]`; the Jobs toolbar renders `Run job` with the gate reason as its tooltip,
  `Stop` with its reason, `Discard changes`, the forward verb; the rail lists no `Run`; the run gate's unit tests keep
  passing unchanged.
- The gate, then the real drive on the running stack (the admin at 5172, both required sizes): the Title workspace's
  Plot and Cast draw multi-line and save (a list with newline names round-trips through the detail), the Jobs toolbar
  runs a job and stops it, console clean.

## 5. Docs (coordinator)

`00` gains the row. `37` section 4.3 (the Cast field), `38` section 4.3 (Run in the toolbar, no Run section), `26` (the
Title workspace's Plot group words and the Jobs workspace's toolbar and rail), `28` where it pins the Run group or
the toolbar's verbs.
