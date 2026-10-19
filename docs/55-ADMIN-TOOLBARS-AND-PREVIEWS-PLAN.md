# 55 - The admin's toolbars, saves and previews (plan v1)

**Status: v1 (2026-10-18).** Owner: "on the workspaces, the toolbar has a discard button, but the save button is missing
on the right"; "on providers index, we need preview buttons like we have for channels index. it should launch the preview
with a the titles we have in our db or something to make sure the video loads. the providers preview child window should
have a drop down in the tool bar with the titles. i need the same type of preview so i can mark them enabled/disabled";
"there should be a preview button next to the delete on providers"; "providers workspace is missing the save button and
missing the preview button, why does it have a button to titles, that is not the promote action here"; "same for titles,
wiorkspace is missing save in toolbar and the promote action is not 'jobs'. on titles it should also have a preview
button, and the titles preview child window should have a drop down in the tool bar to let me change the provider
source"; "on playlist worksapce the toolbar is missing save on the right"; "the jobs toolbars are not correct at all. on
the index, the promote action should be run job, it should not be on the table toolbar. and on the workspace, the toolbar
is completely wrong. the left should have the discard button, and the right should have save and run job. the stop button
is in the status bar, so it is redundant in the toolbar"; "on accouns toolbar, the save button is completely missing. it
has two save buttons on the form but that not correct. move all the save buttons from the form to the toolbar. there
should be one save to save the entire record, not multiple save buttons per form". Amends `53` decision 3 (the Jobs
toolbar verbs) and `01` section 9's Forms and Toolbar words. Scope: the admin app and the backend's Electron window.

## 1. Why (observed in the merged code)

- Every workspace toolbar renders `Discard changes` and a forward verb only (`WorkspaceToolbar.tsx`: "`Save details` ends
  the form's body, never here"); the one commit hides at the end of each form (`SaveDetails` ends the Stream, Playback,
  Player, Images/Seasons, Details, Details and Schedule groups), and the Accounts page carries three commit buttons
  (`Save details`, `Set new password`, `Save question`) - two of them saves.
- The Providers index's `source` column reads the right field, but the stored value is the PoC's slug (`vidsrc` beside
  the name `VidSrc`), so it displays like a duplicate of Name. The list route already returns the FULL record
  (`movieTemplate`, `origin`, `frameOrigins`... - nothing is withheld to a detail); there is no `host` field, but the
  template's host is derivable (`https://vidsrc.sh/embed/movie/{tmdbId}` -> `vidsrc.sh`). The template is never visible on
  the index at all.
- The Jobs index toolbar is empty; `Run job` sits on the bulk strip (acting on the ticked set, `useJobBulk.ts`); the Jobs
  workspace toolbar (per `53`) holds `Run job` and `Stop` on the LEFT with `Discard`, and a forward verb the owner rejects.
- The Channels tab has a preview window; Providers and Titles have none. The providers/titles workspaces' forward verbs
  (`Titles ->`, `Jobs ->`) are tab hops, not the promote action of those records. The admin has no iframe anywhere, and
  the backend's Electron window (`guards.ts`) refuses every frame navigation whose origin is not the app's own - a
  provider embed would be blocked in the packaged admin; the fileserver solved exactly this with its player-policy
  machinery (`src/fileserver/src/app/{player-policy,guards,ad-blocker}.ts`).

## 2. Decisions

1. **The toolbar standard (`01` section 9 amended).** A workspace's toolbar: LEFT, `Discard changes` only. RIGHT, `Save`
   (the one primary, `size="sm"`), then the page's promote action rightmost. The form's trailing `SaveDetails` is DELETED
   from every group; the save's wiring (the record's own flow, `Nothing has changed.` and the page's own reason) moves to
   the toolbar unchanged. A group keeps only verbs that are actions, not saves (`Set new password`, `Rebuild`,
   `Refresh`, the `Revert` icons) - and `Save question` is NOT one of them (decision 5).
2. **The promote action per page.** Channels workspaces keep `Preview ->` (unchanged); the Providers workspace's promote
   becomes `Preview ->` (opens the provider preview; `Save the provider first` while dirty); the Titles workspace's
   promote becomes `Preview ->` likewise (`Save the title first`); the Playlists workspace keeps `Channels ->`; the Jobs
   workspace's promote becomes `Run job` (decision 6); Accounts keeps none. The index toolbars: Providers and Titles keep
   their tab verbs; the Jobs index's promote becomes `Run job`, and `run` leaves the bulk strip (decision 6).
3. **The providers index column.** The `source` column becomes `host` (header `host`, mono): the embed template's origin
   (`new URL(movieTemplate).host`) for an embed provider with a template, the source slug for a stream-family provider
   (it has no template - "a stream provider produces no source until one is proven playable"). The template itself stays
   a workspace field, never an index column.
4. **Preview buttons beside Delete.** The Providers and Titles indexes gain the channels' eye (`Preview provider`,
   `Preview title`) in the row's end, before the armed `Delete`, with the channels' tooltip shape. The channels' eye is
   unchanged.
5. **One Save commits the entire record (Accounts).** The toolbar `Save` sends the account fields; when the Security
   question group holds a draft (a question chosen and an answer typed), the same press commits the question after the
   fields (the question's own reasons gate the whole Save while a draft is present; an empty draft skips the question).
   `Save details` and `Save question` are deleted from the form; `Set new password` stays on the form (an action that
   signs the account out everywhere, not a save).
6. **The Jobs toolbars corrected (amends `53` decision 3).** The workspace toolbar: LEFT `Discard changes` only; RIGHT
   `Save` then `Run job` (the promote; `Resume` after a stopped run; the run gate's reasons as its tooltip). `Stop`
   LEAVES the toolbar - the statusbar's Stop stops every running job (`50`), so the workspace one is redundant. The index
   toolbar's promote is `Run job`, running the ticked set with today's gate reasons (`Tick a job first`, `A ticked job is
   already running.`, ...); `run` is removed from the bulk strip, which keeps `stop`, `enable`, `disable`, `delete`.
7. **The provider preview window** (`OverlayId` gains `provider-preview`; `workSpec("provider-preview", ...)` at the
   channels preview's 820x560 size; one open replaces another). The stage is an IFRAME by the interface's embed rules
   (`EmbedHost.tsx`: no `sandbox` attribute, `allow="autoplay; fullscreen; encrypted-media; picture-in-picture"`,
   `referrerPolicy="origin"`, `src="about:blank"` to stop, `bg-stage`). The toolbar (`Actions pinned`): the `Enabled`
   toggle (the provider's own, the channels preview's labelled pattern) and a `Title` `Select` (the stored titles the
   list already holds, paged reads for more; the default is the first stored movie with a TMDB id) - choosing one builds
   the embed URL from the provider's `movieTemplate` filled with the title's `tmdbId` (the backend's `fill` rule,
   `{tmdbId}/{season}/{episode}` only, mirrored as an admin lib) and reloads the frame. Offered for embed-family
   providers with a template only; a stream-family provider has no embed to preview (the eye is absent, like the
   channels' mark for a live-kind channel).
8. **The title preview window** (`title-preview`, same shape): the stage iframe plays the title; the toolbar holds the
   `Enabled` toggle (the title's own) and a `Provider` `Select` - the title's available sources (a movie: the detail's
   `sources`, built by the backend from the active embed providers; a series: the first episode's sources from the
   seasons read) - choosing one loads that source's `url` (with its `origin`/`frameOrigins` for the window policy).
   Changing the dropdown is the "change the provider source" the owner asked for.
9. **The Electron window learns the embed policy (backend wave).** The fileserver's player-policy machinery is ported to
   the backend's Electron host: a `PlayerPolicyAuthority` the preview drives (`setPlayerPolicy({ origin, frameOrigins })`
   on open/change, cleared on close), a frame guard that allows the policy's origins on `will-frame-navigate` (beside
   the app's own), and the ad-blocker over the same session - so the preview behaves like the interface's player. The
   window keeps `contextIsolation`, the renderer sandbox and every other guard. In a dev Chrome tab none of this is
   needed (no CSP, no frame guard) - the wave is for the packaged window.
10. **What is not changing.** The channels preview window; the statusbar's Stop; the forms' groups and fields (only
    their trailing saves move); the tables standard (`52`, still awaiting its go); `Set new password`.

## 3. Changes from what is merged

- `src/backend` (wave 1, `feat/admin-embed-policy`): the Electron host's `app/guards.ts` gains the player-policy port (a
  frame guard beside `judgeNavigation`, the policy authority module, the ad-blocker), `main.ts` wires it; tests per the
  fileserver's guard tests' pattern.
- `src/admin` (wave 2, `feat/workspace-toolbars`): `components/records/{WorkspaceToolbar,SaveDetails}.tsx` (SaveDetails
  deleted; the toolbar gains the Save slot), `lib/workspace-verbs.ts` (the SaveVerb stays, the wiring moves), every
  workspace's save call site (`StreamWorkspace`, `LiveWorkspace` via its groups, `ProviderWorkspace`, `TitleWorkspace`/
  `TitleEditor`, `PlaylistWorkspace`, `JobWorkspace`, `AccountWorkspace`), the groups that lose their trailing
  `SaveDetails`, the Accounts question flow (draft-in-Save), `useForwardVerbs`/`INDEX_FRAMES` (the Jobs index promote),
  `lib/job-bulk.ts` (`run` out of the strip), `constants/{record-copy,job-copy,index-frames}.ts`; the markup tests.
- `src/admin` (wave 3, `feat/provider-title-previews`, cut after wave 1): `types/overlays.ts` + `OverlayHost` (two new
  ids), the providers/titles slices' preview request values, `components/providers/ProviderPreviewWindow.tsx` + toolbar
  + stage + session/keys hooks, `components/titles/TitlePreviewWindow.tsx` + its pieces (both by the channels preview's
  file shape, under the 200-line cap), the admin's `lib/embed-url.ts` mirror (`fill`, the URL builder), the providers'
  eye + the Host column (`provider-columns.ts`, `provider-rows.ts`), the titles' eye, the workspaces' promote changes,
  `constants/provider-copy.ts`/`title-copy.ts`/`preview-copy.ts`; the markup and flow tests per the channels preview's
  suites.
- `src/frontend`: nothing.

## 4. Tests

- Wave 1: the frame guard allows the policy's origin and refuses an unmanaged one; the policy clears on close; the
  ad-blocker's rules load; every existing guard test keeps passing.
- Wave 2: each workspace's toolbar markup (Discard left; Save then the promote right; no trailing SaveDetails on the
  form; the Accounts page with no `Save question`); the Save's reasons (`Nothing has changed.`, the page's own); the
  Accounts compound save (fields, fields+question, the question's refusal gating the whole Save, the empty draft
  skipping the question); the Jobs index promote (the ticked set, the gate reasons) and the strip without `run`; the
  Jobs workspace without `Stop`.
- Wave 3: each window's markup (the toolbar's toggle + Select, the iframe with `allow` and no `sandbox`, the status
  words), the URL builders (`{tmdbId}` fill, the series' episode sources), the open/change/close policy calls, the Host
  column (template host, slug fallback), the eyes beside Delete.
- The gate after each wave, then the real drive: both previews on the running stack (a provider with a stored title -
  the video loads; the title's provider dropdown switching sources; the Enabled toggles flipping the rows), the toolbars
  on every workspace at both required sizes, the packaged window (`dist:win` is the fileserver's, so the drive covers
  the backend window via `npm run dev`'s Electron), console clean.

## 5. Docs (coordinator)

`00` has no plan index (verified: its table ends at `14`) - nothing to add there. `01` section 9 amended (the Forms'
commit moves to the toolbar; the Toolbar law's sentence; the promote actions). `26` (the workspace toolbars and the
previews' sections), `28` (the toolbar rows it pins), `35` (the Accounts one-Save), `36` (two new sections, 8.x, after
the channels preview's - the previews' governing words), `37` (the Titles preview and promote), `38` (the Jobs toolbars,
amending `53`'s amendment), `53` (its decision 3 superseded by this plan's decision 6).
