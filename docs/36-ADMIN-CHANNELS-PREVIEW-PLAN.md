# 36 - Admin Channels and Preview plan (Wave 3b)

**Status: plan, written before the code (branch `admin/channels-tab`, cut from `family-port` after Wave 3a, `35`, has landed).** Amended 2026-10-17 (owner): bulk verbs on the ticked rows, Name first, and the backend assigns a new live channel's id (3.2).
Owner, 2026-10-17: no fixture waves; every tab is built directly against the real backend routes through the service
modules, and a wave exits only when every control is really wired and verified. This document is the Channels tab end to
end, with the Preview window. It supersedes the fixture-first Wave 3 of `28` (its reference content - the look, the
fields, the field order, the copy - still governs) and replaces Wave 8's Channels and Preview part of `29` (its routes,
Preview section 9.7 and live flows section 10 still govern). The program is `39`. Governed by `00`, `01`, `07`, `26`
(4.5, 4.5a, 4.6, 4.7), `28` (7.2, 7.3, 7.4, Appendix A), `29` (5, 9.1, 9.7, 10, 13).

## 1. What exists (verified in source, 2026-10-17, branch `admin/channels`, commits `6fcbeda` `4386de2` `07b60d7`)

| Piece | Where | State |
|---|---|---|
| `RecordGrid`, `RecordGridRow`, `SkeletonGrid`, `GridLayout`, `Checkbox`, pill `ChipGroup` with `min` | `src/shared/ui/src/{lists,controls}` | built, string-render tested |
| Wire types | `types/admin-channel.ts` | built (the backend's own shapes) |
| Zod | `services/schemas/channel-schema.ts` (`ChannelSchema`, `ChannelListSchema`) | built; the list fails whole if one row fails (to tighten, 3.2) |
| Pure helpers | `lib/channel-rows.ts` (`channelRows`, `isSynced`), `lib/channel-draft.ts` (`draftOf`, `sameDraft`, `rebuilds`), `lib/channel-check.ts` (`checkChannel`), `lib/live-time.ts`, `lib/row-state.ts` (`channelState`) | built |
| Copy | `constants/channel-copy.ts` (categories, variants, labels), `constants/channel-tips.ts` | built |
| The service | `services/channels.ts` (`ChannelsService`: `list create update remove rebuild revert`) | **a stub: every method refuses with `backend.not_connected`** |
| Request layer | `services/api.ts` (`request`), `services/session-api.ts` | built, real |
| Folder picker | `services/admin-host.ts` (`hostAvailable`, `chooseFolder`) | built (Wave 2) |
| Shell pieces | `ListGroup`, `NewRecordGroup`, `WorkspaceFrame`, `RecordRail`, `WorkspaceToolbar`, `IndexToolbar`, `TabPage`, `workspaces` slice, `work` slice (`setWork`), the statusbar's `N preparing` readout | built (Wave 2) |
| `ChannelsPage.tsx` | draws `IndexToolbar` + `IndexSkeleton` only | to fill |
| `hls.js` | in `src/admin/package.json` | present |

**Still to build** (named by the owner's brief): `StateWord`, `FolderRow`, `useRecordForm`, `VideoList` and the other record
pieces below. `StateWord` and `useRecordForm` are shared by every tab and are built by Wave 3a (`35` section 4.2); if the
worker finds them absent it stops, reports, and the coordinator lands them first - it does not write a second copy.
`FolderRow` and `VideoList` are Channels-only and are built here.

## 2. Scope

The whole Channels tab, wired, in this order (one commit each):

1. **Service and store.** `services/channels.ts` real; `store/channels-slice.ts`; `services/channel-flows.ts`; the loads.
2. **Index.** New channel form, the list, `Refresh`, `Delete`, the toolbar `Preview →` gate, the statusbar count.
3. **Live workspace.** Details, Playback, Status, `Rebuild`.
4. **Stream workspace.** Details with `Edited` tags and `Revert to playlist`, Stream with a refused address, Status.
5. **Preview.** The child window, the player, the status line, `Retry`, closing.

Out of scope: any other tab; the timers and polling `01` 4.4 forbids (the state words move only on `Refresh`, a write's answer or
the Status heading's `Refresh`); a stop-a-build route (the statusbar `Stop` stays disabled with its reason).

## 3. The wire (the real routes, `29` section 9.1)

### 3.1 Routes the service calls

| Method | Route | Body | Answer |
|---|---|---|---|
| `list` | `GET /api/admin-channels` | none | `{ items: AdminChannel[], revision }` |
| `create` live | `POST /api/channels` | `{ kind: "live", name, category, number, folder }` (no `id`: the backend assigns it, 3.2) or the same with `videos: string[]` in place of `folder`; `mode`, `captions`, `variants` optional | `201` `LiveAdminChannel`, `state: "preparing"` |
| `create` stream | `POST /api/channels` | `{ kind: "stream", name, category, number?, logoUrl?, streamUrl }` | `201` `StreamAdminChannel` |
| `update` | `PATCH /api/channels/:id` | only the changed fields of `name category number logoUrl streamUrl mode captions variants folder videos enabled`; `kind` may be echoed; `folder` and `videos` are exclusive and replace each other | the `AdminChannel` (a live row `preparing` after a source, mode, caption or quality change) |
| `remove` | `DELETE /api/channels/:id` | none | `{ id }` |
| `rebuild` | `POST /api/channels/:id/rebuild` | none | `LiveAdminChannel`; `422 channel.invalid` field `enabled` while disabled, and for a stream row |
| `revert` | `POST /api/channels/:id/revert` | none | `StreamAdminChannel` with `editedFields` cleared; `422` field `source` for a hand-made row |

Read in the backend (`types/channel-input.ts`, `services/live-channel-rules.ts`): a live **id** is required on create, kebab-case, at
most 64 (`LIVE_ID_MAX`); the **number** is a whole number 1 to 9999; a live PATCH that carries `streamUrl` or `logoUrl` is
refused (`A live channel has no streamUrl: its address is the backend's own.`); a new source replaces the old one whole; a missing folder
or video is refused at write time (`That folder does not exist.`, field `folder` or `videos.<n>`); `channel.taken` (409) names no field.

### 3.2 Service decisions

- Every method goes through `request(path, schema, { method, body })`; the answer replaces the record by id in the slice.
  A create or update answer is parsed with `ChannelSchema`; a malformed answer is `backend.bad_response` and the page re-reads.
- `list` parses `items` one row at a time (`z.array(z.unknown())`, each row `ChannelSchema.safeParse`): an unreadable row is
  dropped and counted, one `warn` notice (`N channels could not be read.`), the rest shown (`01` section 8). The schema file gains
  `ChannelListLenientSchema`; `ChannelListSchema` stays for the tests.
- **The backend assigns a new live channel's id** (owner, final: no id changes beyond this). Today the backend requires a caller-sent kebab-case `id` on a live create, while it assigns a stream channel's id itself (`ch_<uuid>`, `services/channel-service.ts`). This wave makes the live create the same: **the create body sends no `id`**, the admin never derives one from the Name (`lib/channel-id.ts` does not exist), and the backend assigns `live-<uuid>` (lower-case, kebab-case, 41 characters, within `LIVE_ID_MAX`, so `/live/<id>/...` and `/logos/<id>.png` keep working). **Existing ids are untouched**; a caller-sent id (the seeded test channels, scripts, tests) is still accepted and validated as today. The small backend change is part of this wave (section 4): `types/channel-input.ts` makes `id` optional on the live input, `services/channel-service.ts` assigns `live-<randomUUID()>` when it is absent, and `src/backend/test/channels.test.ts` gains a create without an id. The `Id` row in Details stays the read-only string `id`, as `28` 7.3 already had it. A 409 on a live create is `channel.taken` on the number, shown under Number with `Another channel already has that number.`.
- `number` is sent as text (`"7"`), never a JSON number. `variants` are sent as the list in the order chosen.

## 4. Pieces to build, by file

Paths under `src/admin/src/`. "C" create, "U" update. Bounds are expected sizes; the limit is 200 (tests 250).

| Act | File | Responsibility |
|---|---|---|
| U | `services/channels.ts` (90) | the table of 3.1 over `request`; `ChannelsService` is unchanged |
| U | `services/schemas/channel-schema.ts` | `ChannelListLenientSchema` |
| C | `lib/channel-bulk.ts` (70) | pure: the bulk verbs' eligibility and reasons (5.3) |
| C | `lib/channel-body.ts` (80) | pure: a create body from a New form (no id), a PATCH body from `draft` against the saved channel (only changed fields; `folder`/`videos` only when the source changed; `number` as text) |
| C | `lib/channel-guard.ts` (70) | pure: every disabled reason of this tab (`Rebuild`, `Preview →` index and workspace, `Revert`, `Delete` tooltip of a synced row) |
| C | `lib/preview-state.ts` (50), `lib/preview-address.ts` (20) | pure: the status line, `Retry` visibility, skeleton flag, attach rule; the path-only address (`new URL(streamUrl).pathname` for a live row) |
| C | `lib/video-order.ts` (30) | pure: move up/down, remove, add keeping order |
| C | `store/channels-slice.ts` (110) | `channels: { status, items, revision, unreachable, ticked }`, `preview: { channelId, serial } \| null`; actions `startLoad`, `loaded`, `loadFailed`, `upsert`, `remove`, `tick`, `tickAll`, `openPreview`, `closePreview`, `reset` |
| C | `services/channel-flows.ts` (180) | `create`, `save`, `remove`, `rebuild`, `revert`, `refresh`, each with the store and the service injected; a `serial` guard; typed results `{ ok } \| { ok: false; field?; sentence }` |
| C | `hooks/useChannelsLoad.ts` (40), `hooks/useChannelActions.ts` (80) | load when the tab is first shown after sign-in; the actions |
| C | `hooks/usePreviewSession.ts` (70), `hooks/usePreviewPlayer.ts` (60) | the window's session over `GET /api/admin-channels`; the player instance, destroyed on unmount |
| C | `services/preview-player.ts` (90) | pure of React: drives `<video>` and hls.js (`28` 7.4, `29` 9.7) |
| C | `components/records/StateWord.tsx`, `useRecordForm` | **Wave 3a's**; consumed |
| C | `components/records/FolderRow.tsx` (70), `components/records/VideoList.tsx` (120) | a `Row` with a mono field and a trailing ghost `Choose` button; the live source's ordered rows and the add row (a path field and `Add`; no `Choose`: the preload picks folders only) |
| C | `components/channels/ChannelsIndex.tsx` (60), `NewChannelForm.tsx` (140), `NewChannelRows.tsx` (110), `ChannelsList.tsx` (60), `ChannelRows.tsx` (110), `ChannelRow.tsx` (70) | index |
| C | `components/channels/ChannelWorkspace.tsx` (60), `LiveDetailsGroup.tsx` (150), `PlaybackGroup.tsx` (80), `LiveStatusGroup.tsx` (100), `PlaylistRows.tsx` (50) | live workspace |
| C | `components/channels/StreamDetailsGroup.tsx` (110), `StreamAddressGroup.tsx` (60), `StreamStatusGroup.tsx` (60) | stream workspace |
| C | `components/channels/PreviewWindow.tsx` (60), `PreviewStage.tsx` (60), `PreviewStatus.tsx` (40) | the window |
| C | `constants/preview-copy.ts` (30), `constants/channel-grid.ts` (20) | the window's words; the list's column set |
| U | `pages/ChannelsPage.tsx` | the only reader of `workspaces.channels` and `channels.preview` |
| U | `components/overlays/OverlayHost.tsx`, `types/overlays.ts` | add the `preview` flow (this wave owns both files) |
| U | `lib/running-work.ts` use | `setWork({ preparing })` is written by the slice after every load or write: the count of live rows in `preparing`, `starting` or `restarting`; nothing else touches the work slice's `preparing` |
| U | `lib/event-sentence.ts` | not touched (Wave 4 sweep owns it) |

No change under `src/shared/ui` is planned; a gap found is added additively with its library test and named in the report.
One small backend change (3.2): `src/backend/src/types/channel-input.ts` (`id` optional on a live create), `src/backend/src/services/channel-service.ts` (assigns `live-<uuid>` when absent) and a case in `src/backend/test/channels.test.ts`. No other change to `src/backend`, and none to `package.json` or `index-frames.ts`.

## 5. The index

`AccountsPage` (`35`) is the pattern: `ChannelsPage` shows `ChannelsIndex` while `workspaces.channels` is null, else
`ChannelWorkspace`. `useChannelsLoad(active)` reads once when the tab is first shown after sign-in.

### 5.1 New channel (`NewRecordGroup`, icon `plus`, id prefix `ch-`)

> **Channel number removed (owner, 2026-10-17).** There is no guide, so the admin has no Number: not in New channel, the list (no `number` column, sorted by name), either Details group, the drafts, the bodies or the checks; `channel.taken` no longer goes under a Number row. The backend takes a live `number` as optional (stream already did); the admin never sends or shows one, and a number an old channel has is kept. Every Number mention below is superseded by this note.

Rows in this order (`28` 7.3): **Name**, **Kind** (`Segmented` Live / Stream, equal segments, a row switcher), **Number**, **Category**,
then by kind: **Folder** (`FolderRow`, live) or **Stream address** (stream). The rows a kind does not use are not rendered and
leave the required list. An info glyph on every row except Name (`channel-tips.ts`). No placeholders. Category is a
six-value `Select` for live and a text `Input` for stream. `Create` is `Button variant="primary"` in the group's `Actions`,
disabled with `<Label> is required.` for the first empty required field, `Saving.` while a call runs, or `The admin backend
cannot be reached.` while the slice is `unreachable`. Value refusals (`checkChannel`: a number outside 1 to 9999, an address
that is not https) show under their rows, `aria-invalid`, after the press; the backend's `channel.invalid` `details.field`
(`name`, `number`, `category`, `folder`, `videos.<n>`, `streamUrl`, `logoUrl`) goes under the same row (`ApiError.field`, added by `35`).
On success the answer is inserted, the form clears, the notice reads `<name> is preparing.` for a live row and `Created <name>.`
for a stream row, and the work count updates.

**Choose.** `FolderRow`'s `Choose` calls `chooseFolder()` through `services/admin-host.ts` (the Electron preload exposes exactly
`chooseFolder` and `setOverlay`). A path writes into the field only, never saves; `null` (cancelled) changes nothing. In a
plain browser (`!hostAvailable()`) the button stays in place, disabled, with `Folders can be chosen only in the backend's own
window; type the path.`, and the field is a typed path. `Choose` exists only on Folder rows.

### 5.2 The list (`ListGroup`, icon `radio`, title `Channels`, heading action ghost `Refresh`)

> **Superseded for long lists by `41` (owner, 2026-10-17: "the tables are long, why is there no paging and virtualization").** The paragraph below describes a list read whole and drawn whole. A synced playlist makes the Channels list thousands of rows, so it is **server-paged** (`GET /api/admin-channels` gains `limit` / `offset` / `total`, `q`, `kind`, `origin`, `enabled`, `state`, `source`, `sort`, `dir`) and drawn by the **windowed `RecordGrid`** above 100 rows, with a search box, filters and sortable headers (`41` sections 3.1, 4, 5.1, 6). `Refresh` re-reads the rows in view and keeps the scroll position; the header tick selects the loaded rows and `Select all M matching` is a separate step. At or under 100 rows the list is exactly as described here.

`RecordGrid` over the rows of `channelRows`; headings `number`, `name`, `category`, `kind`, `state`, `mode`, `now playing` (the fault column was removed, owner 2026-10-17; the number column goes with `fix/simplify-forms`)
(`constants/channel-grid.ts`, tracks in rem, the end track fits `Delete Fixture Entertainment?`, a minimum width inside its own
scroller). Select-all tick `Select all channels` (`mixed` over a part); row tick `Select <name>`; a press on the data cells opens
the workspace (no `Open` button, no double click); the state column is the `StateWord` of `channelState`; a disabled row is
dimmed to 45% (its word `disabled`). The end is the library `ArmedButton` `Delete`, question
`Delete <name>?`, re-arming after 4 s, disarmed by blur and `Escape`; its rest title is the synced row's `DELETE_SYNCED_TIP`
(a synced row is really deleted and the next sync adds it again; the tip points to `Enabled`) or nothing. `SkeletonGrid`
while `idle` or `loading` or empty - never a sentence over it, never an empty card. A failed read keeps the last rows and sets one
`warn` notice; with no rows it keeps the skeleton. `Refresh` re-reads `GET /api/admin-channels` and replaces the list.

### 5.3 The toolbar

`IndexToolbar` with the one filled forward verb `Preview →` (`lib/channel-guard.ts`): disabled with `Tick a row first` (none ticked)
or `Tick only one row` (two or more); with one ticked row, live or stream, it calls `openPreview(id)`. A New form never gates it.

**Bulk verbs** (owner, 2026-10-17; the mechanism - one sequential runner, a failure never stops the rest, a summary on the notice, `N working`, the failure list under the toolbar, one re-read at the end,
failed and skipped rows stay ticked - is `39` section 6, built by Wave 3a and consumed here through `useBulkAction`). Ghost verbs beside `Preview →`, always drawn, disabled with `Tick a row first` until a row is ticked:

| Verb | Calls | Skipped, with its reason | Verb disabled (reason) when |
|---|---|---|---|
| `Enable` | `PATCH { enabled: true }` | already enabled: `Already enabled.` | all skipped: `Every ticked channel is already enabled.` |
| `Disable` | `PATCH { enabled: false }` | already disabled: `Already disabled.` | all skipped: `Every ticked channel is already disabled.` |
| `Rebuild` | `POST .../rebuild` | a stream channel: `A stream channel has nothing to rebuild.`; a disabled one: `Enable the channel to rebuild it.` | nothing left: the first skipped reason |
| `Delete` | `DELETE` (two-step: `Delete N channels?`) | none; the tooltip of a synced row's single `Delete` (the next sync adds it again) is repeated in the summary | none ticked |
| `Preview →` | single row only (5.3 above) | | as above |

`Rebuild` answers `preparing` per row, so the summary reads `Rebuilding 3 of 4 channels; 1 skipped.` and the statusbar `N preparing` updates once, with the final re-read. Disabling a live channel stops it; enabling starts it.

### 5.4 The statusbar

`N preparing` is the count of live rows whose state is `preparing`, `starting` or `restarting`, written with `setWork` by the slice
on every load and every write (and on delete). It changes only on those events: no timer. `Stop` stays disabled with `A channel
build cannot be cancelled; change or delete the channel.` (the readout owner is the Wave 2 statusbar).

## 6. The live workspace (`ChannelWorkspace`, rail `‹ Channels`, `Details`, `Playback`, `Status`)

`WorkspaceFrame` + `RecordRail` (sections a module constant) + `WorkspaceToolbar` with `Discard changes`, `Save` and the filled
`Preview →`. It opens from the held list; if the id is no longer in a `ready` list it closes with a `warn` notice and re-reads.
The draft is `draftOf(channel)` kept by `useRecordForm`; `dirty` is `!sameDraft`. `Discard changes` restores it. ONE `Save` per page
sends `lib/channel-body.ts`'s changed-fields PATCH; Save is disabled with `Nothing has changed.`, a required-field reason from
`checkChannel`, `Saving.`, or the unreachable sentence. The answer replaces the record and the baseline.

**Details** (`file-text`; action slot `Rebuild`, `hammer`): Name, Kind (read-only), Number, Category (`Select` of six), **Plays**
(`Segmented` Folder / Videos), the **Folder** `FolderRow` or the **Videos** `VideoList` (ordered rows: index, path, up, down - the
moved-past-the-end buttons disabled `Already first` / `Already last` - and remove; an add row with a path field and `Add`), **Enabled**
(`Toggle`; a disabled channel stops, an enabled one starts), **Logo** (read-only `LogoImage` of `logoUrl`; a live row's logo is
`/logos/<id>.png`; the glyph on error), **Id** (read-only). `Rebuild` is a ghost verb in the group's action slot that calls
`POST .../rebuild`; disabled with `Save the channel first` while the draft is dirty and with `Enable the channel to rebuild it.`
while disabled; the answer shows `preparing`.

**Playback** (`play`): Mode (`Segmented` Loop / Encode, the cost in the tip), Captions (`Toggle`), Qualities (the pill `ChipGroup`,
`min` 2, the last two cannot be switched off, with their reason).

There is no Fault group: fault injection was removed from the admin (owner, 2026-10-17: "why would I sabotage my own broadcast").

**Status** (`activity`; a heading `Refresh` that re-reads `GET /api/admin-channels` and replaces the list): while `state` is
`preparing`, `starting` or `restarting` the facts are replaced by shimmer lines in their shape (the group keeps its heading and
rows); otherwise the state word, a `failed` row's `problem` as the first line, `Renditions`, the **playlist** (`PlaylistRows`: ordered
rows, name and `mm:ss` from `durationMs`, the playing row `nowPlaying.index` in the accent text), and the **stream address** (`streamUrl`) in a mono
field with a copy `IconButton` in `trailing`. The copy guards the clipboard: `navigator.clipboard` may be absent on a plain-http LAN page, then the
notice says `The address could not be copied.`; success says `Address copied.`.

**Flows.** A source, mode, caption or quality change (`rebuilds(channel, draft)`) answers `preparing`: the notice says `<name> is
preparing.` and the Status group shows its skeleton until a `Refresh`. A backend restart stops every live channel until it
rebuilds (`26` D4): the next read shows them `preparing`; nothing is coded for it.

## 7. The stream workspace (rail `‹ Channels`, `Details`, `Stream`, `Status`)

**Details**: Name, Kind (read-only), Number, Category (free text), Enabled; for a **synced** row (`isSynced`: it carries `source`) an
action slot `Revert to playlist` (`undo-2`, an `ArmedButton`-free ghost `Button`, one press, because it only drops local edits; disabled
with `This channel was made by hand; there is nothing to revert.` for a hand-made row and with `Nothing was edited.` when
`editedFields` is empty). A field in `editedFields` wears an **`Edited`** tag after its label (the `Row`'s `trailing`, a word, not a dot) and its tip says the
next sync keeps it. **Stream**: Stream address and Logo address, each checked (https) client-side and by the backend; a refused address is the `Row`'s
`error` under its row (`channel.invalid` field `streamUrl` / `logoUrl`, or the client's `Stream address must be an https address.`),
`aria-invalid`, with the same sentence on the notice line. **Status**: `Id`, `Synced from <host>` (`source`) or `Added by hand`, `Revision`. The toolbar
is `Discard changes`, `Save` and the filled `Preview →`. `Revert to playlist` posts `.../revert`, replaces the record, clears the `Edited` tags and says `Reverted <name>.`.
A hand-made stream row is fully editable; a synced row's fields are editable (the sync merges under `editedFields`, `26` 3.10).

## 8. The Preview window (`26` 4.5a, `28` 7.4, `29` 9.7)

A modal work window: the library `ChildWindow` with `workSpec("preview", "Preview", { width: 640, body: 420, minWidth: 420,
minBody: 300 })`, opened by `Preview →` (index, one ticked row; workspace, a saved channel) through the one open flow
(`overlay === "preview"`; opening it replaces Settings and the reverse). `channels.preview = { channelId, serial }` is the request value.
Moved by its header, resized by its edges, closed by its `X` or `Escape` (not while typing), focus returns to the opener, its bounds go through `ChildMemory`
(`rememberChild("preview", box)`, kept for the run; Wave 4 saves it per account).

- **What is read.** On open, one `GET /api/admin-channels` replaces the slice; the window finds its channel by id. A missing channel
  says `That channel does not exist.` on the status line and offers `Retry`.
- **The address.** A live channel plays `new URL(streamUrl).pathname` (same-origin: the Vite proxy forwards `/live`, the backend serves
  it in production; never CORS). A stream channel plays its `streamUrl` as answered. The row's `streamUrl` is `<caller origin>/live/<id>/master.m3u8`;
  there is no `masterUrl` field (`26` 4.5a is stale).
- **The player** (`services/preview-player.ts`, at most 90 lines, no React, no fetch): hls.js whenever `Hls.isSupported()`, the browser's native HLS
  (`canPlayType("application/vnd.apple.mpegurl")`) only as the fallback, else `This browser cannot play HLS streams.`; muted; the native
  controls; no quality, track or latency control. `usePreviewPlayer` owns the instance and destroys it on unmount. The `<video>` is always mounted,
  fitted whole on `--color-stage` (dark in every theme).
- **Attach rule.** A live channel attaches only while `state` is `live` or `restarting`. `preparing` and `starting` show the `SHIMMER`
  skeleton over the stage and attach nothing; `stopped` and `failed` attach nothing and the line says why (`failed` with its `problem`).
  A stream channel always attaches. A state change is seen only on `Retry`: no timer, no polling.
- **The status line** (`lib/preview-state.ts`, mono, one line): a live channel shows its state word and `problem`, then the player's error; a stream channel shows
  the player's phase (`loading`, `playing`) or its error. Player errors from hls.js: a fatal network error on the manifest (`manifestLoadError`,
  `manifestLoadTimeOut`, `manifestParsingError`) is `manifest failed`; any other fatal network error is `unreachable`; a fatal media error or the video
  element's own error is `media error`.
- **`Retry`** (ghost, beside the line) is shown when the state is `failed` or `stopped` or the player has an error. It reads `GET /api/admin-channels` once, updates the slice,
  and re-attaches when the channel is then attachable.
- **Close.** `X`, `Escape` or another flow replacing it calls the player's `detach()` first: the engine is destroyed, the video paused, its `src` removed and
  loaded empty, so every request stops at once; then the flow closes. Unmounting destroys again if still alive.
- **Disabled reasons.** The index verb: `Tick a row first`, `Tick only one row`. The workspace verb: `Save the channel first` while the draft is dirty. A New form never gates it.
  A stream row's workspace verb behaves identically.

### 8.1 The Preview toolbar (owner, 2026-10-18; supersedes the state row and `Retry` under the stage)

Reference, read 2026-10-18: LoRA Studio's gallery viewer (`giga-lora-studio` `components/viewer/ViewerStage.tsx`: a top toolbar with
Previous / Next icon buttons, a `N / total` counter, the item's name, then the verbs and a close; `min-h-10`, hairline underneath) and the
Library's Title information window (`Actions pinned` directly under the header, nothing at the foot). The Preview copies that layout.

- **Position.** One toolbar strip directly under the window header (the shared `Actions` with `pinned`, as Title information
  does). There is NO row under the stage: the stage fills the body.
- **Left, in this order:** `Previous` (chevron-left) and `Next` (chevron-right) icon buttons, the position `N / total` (mono, faint,
  tabular), the channel's name (truncating, with a tooltip), and the state word (`live`, `loading`, `failed`, `missing`: `8` status line)
  after the name. Right: `Enable` / `Disable` (one button showing the action the channel can take), `Mark live` / `Mark dead` (one button, the
  other verdict than the channel's own; a stream channel only), and `Retry` when it is offered (as before: failed or stopped state, a
  player error, a missing channel).
- **Browsing.** Previous and Next walk the channels the Channels list currently shows (its search, filters and sort), in that order, from
  the channel being previewed; the position is that channel's place among them. They move the request value (`channels.preview`
  `channelId`, new `serial`), so the window stays open at its place and size, the old player detaches first and the new channel
  attaches, with the same attach rule. `ArrowLeft` / `ArrowRight` do the same while focus is not in a field or on the video's own
  controls. At the first or last channel the button is disabled with the reason `This is the first channel.` / `This is the last
  channel.`; a list holding one channel disables both with `Only one channel.` The walk never wraps and never reads the list again.
  If the list is only partly loaded the walk covers the loaded rows and Next at the end of them reads the next page through the list's
  own load-more (never a new route).
- **Enable / Disable** is the Channels list's own single-row action (`PATCH /api/channels/:id { enabled }` via the existing flow: same
  notice, same audit, the row and the window update together). The label is `Disable` for an enabled channel and `Enable` for a disabled
  one. A synced stream channel obeys its playlist (`published` stays false while the playlist is disabled): the notice already says so.
- **Mark live / Mark dead.** A manual verdict on a stream channel's own stream address, the same `status` the sync writes (`43`, the
  per-channel live/dead verdict) with `checkedAt` = now. New backend route `PUT /api/channels/:channelId/status { status: "live" | "dead" }`:
  admin only, stream channels only (`422 channel.not_stream` for a live channel, `404 channel.not_found`), writes `status` and `checked_at`
  only (a sync-owned column set: no revision bump, no `edited_fields`, the row's other columns untouched), audited as `channel.status.set`
  with the old and new verdict, answers the channel row. The next sync run overwrites it with its own check (the owner's choice: the
  mark is a hand-set verdict, not a lock). The button shows for a stream channel only; for a live channel it is absent, not disabled. After
  the call the Channels row's `live` / `dead` word and the window update.
- **Disabled reasons** follow the rule: Previous/Next as above; Enable/Disable and Mark: `The admin backend is not reachable.` while
  `unreachable`; Mark: none for a channel with a stream address.
- Tests: the route (auth, stream only, writes only status/checked_at, no revision bump, audit, 404/422), the walk (order follows the list's
  query, ends disabled with their reasons, single channel, keys not in a field), the toolbar markup (order, no row under the stage), the
  mark and enable flows updating row and window.

### 8.2 The title bar is the channel, and the window reads ONE channel (owner, 2026-10-18; supersedes "What is read" and `Retry` above)

Owner: "the title bar says Preview, instead of the videos title ... retry button appears to refresh the entire list and not just the
loaded preview, what does retry even do?". Verified: `usePreviewSession` calls `flows.refresh`, which is `GET /api/admin-channels` with no
`limit` = ALL channels (2,602 rows today), on every open, every Retry and (as built) the list's pages are dropped by it.

- **The title bar** (the `ChildWindow` header) shows the CHANNEL'S NAME (`Close <name>` for the X), not `Preview`; while the channel is
  being read the header wears a short shimmer where the name goes (never the word `Preview`, never a sentence). The toolbar no longer
  carries the name: left = the verbs, right = the state word, `N / total` and Previous / Next. A step updates the header at once.
- **One-channel read.** New backend route `GET /api/admin-channels/:channelId` (signed-in admin, `Cache-Control: no-store`, the same
  admin view of ONE row as the list: `404 channel.not_found`). The window reads it on open, on each step to a neighbour whose row the list
  does not already hold (a held row shows at once and is read afresh in the background only for a live channel), and on `Retry`. The
  Preview NEVER calls `GET /api/admin-channels` without `limit`, never replaces the Channels slice, and never drops the list's loaded
  pages; the one row it reads is upserted into the slice by id (the existing `channelUpsert`).
- **What `Retry` is for.** It plays THAT channel again: it re-reads that one channel (a live channel's `state` may have moved
  `failed` -> `preparing` -> `live`; a stream channel's address may have been edited) and then attaches the player again (the attempt is
  raised even when the address did not change, as built). It is offered only when there is something to retry: the player reported an
  error, a live channel is `failed` or `stopped`, or the channel was missing. It never touches the list.
- Tests: the new route (auth, one row, 404, no-store); the session reads exactly one channel on open, one on each Retry, one on a step to an
  unheld row, and NEVER the list route (a fake counts both); the header shows the channel's name and `Close <name>`; the toolbar has no name;
  the list's pages survive opening, stepping and Retry.

### 8.3 A status bar in the child window template (owner, 2026-10-18; supersedes where 8.1 puts the state word and the count)

Owner: "so lets add a status bar to our child window template. it looks silly you have the status labels and counts in the toolbar. just
give them a proper status bar". A window's STATE (words, counts) belongs in a status bar at its foot; the toolbar holds only controls.

- **The template.** `ChildWindow` (`src/shared/ui/src/windows/ChildWindow.tsx`) gains an optional `status` prop `{ left?: ReactNode; right?:
  ReactNode }`. Absent, nothing is drawn and every existing window (Settings, Collections, Title information, ...) is unchanged. Present, a
  `ChildStatusbar` strip (new file in `windows/`, one exported component) is drawn as the LAST row inside the window frame, below the body
  (the body keeps `flex-1 min-h-0`; the strip is `flex-none`): the main window's statusbar metrics (`shell/Statusbar.tsx`): `h-6`, hairline
  above (`border-t border-hair`), `font-sans text-xs text-muted`, `gap-2.5`, items left, a `flex-1` spacer, items right; it spans the window's
  full inner width. The strip is for state only: words and counts, never a control, a notice sentence or a progress bar (the app's one
  notice line stays in the main statusbar). Plain text items use the muted colour; a state that is a failure may take the status tone
  colour of the word (`st-failed`), never a dot (`06` section 1 rule 10).
- **The Preview uses it.** Left: the state word (`live`, `loading`, `failed`, `missing`; the same `previewLine` words, `role="status"`).
  Right: the position `N / total` (mono, tabular, faint; the shimmer pill while the window reads, as built). The toolbar (8.1) keeps ONLY the
  verbs on the left (Enable / Disable, Mark live / Mark dead, Retry) and Previous / Next on the right; the name stays in the header (8.2), the
  state word and the count leave the toolbar.
- Tests: `ChildWindow` without `status` renders no strip (a markup test on an existing window); with `status` renders the strip after the body
  with left and right items; the Preview markup test expects the state word and `N / total` in the strip and not in the toolbar.

### 8.4 Child windows maximize (owner, 2026-10-18: "i need to be able to maximize the child windows")

A template feature in `ChildWindow`, so EVERY child window (Preview, Settings, Collections, Title information, ...) gets it; a spec may opt out
with `maximizable: false` (default true).

- **The control.** A second bordered `IconButton` in the header, left of the close X (the header is the one place edged icon buttons are
  allowed, `01` Buttons and surfaces): `Maximize2` while normal (aria-label and tooltip `Maximize <name>`), `Minimize2` while maximized
  (`Restore <name>`). New rows in the icon vocabulary (`01`): `Maximize, Restore` -> `Maximize2`, `Minimize2` (LoRA Trainer's viewer uses
  `Maximize2` for its enlarge verb; here it is the window verb).
- **Also:** a double-click on the header (not on a button) toggles it, the desktop convention.
- **Maximized.** The window fills the main window's available area: the main window minus its titlebar and its statusbar (the chrome stays
  visible and the scrim behaves as for a normal modal window); the box is derived from the container, so resizing the main window keeps it
  maximized and fitted. While maximized the grips are not drawn and the header does not drag.
- **Restore** returns the window to the box it had (its size and place before maximizing). The remembered bounds (`ChildMemory`, per
  `spec.key`, kept for the run) keep the NORMAL box only; the maximized flag is remembered for the run too, so closing and reopening a window
  that was maximized opens it maximized, and `Restore` goes to the remembered normal box. A window opened for the first time is normal.
- `Escape` and the X still close; a maximized window's content (the Preview's stage, the toolbar and the status bar of 8.3) simply gets the
  space: the stage letterboxes (`object-contain`) and the toolbar and status bar keep their sizes.
- Tests: toggling by the button and by the double-click; the maximized box equals the container area and follows a container resize; Restore
  returns the previous box exactly; the normal box is not overwritten by maximizing; the flag survives close and reopen for the run; no grips
  and no drag while maximized; `maximizable: false` draws no button; an existing window's markup gains only the one button.

### 8.5 The provider preview and the title preview (owner, 2026-10-18; `55` decisions 2-4, 7-8)

Two more preview child windows on the channels preview's template (8.1-8.3), opened by a row's eye (`Preview provider` /
`Preview title`, before the armed `Delete`) and by the workspace promote (`Preview →`; `Save the provider first` /
`Save the title first` while the draft differs). Absent, not disabled, where nothing can be previewed: a stream-family or
template-less provider; a title with no TMDB id.

- **The stage is an IFRAME, not a `<video>`** (the interface's embed rules, `EmbedHost.tsx`): `src="about:blank"` at
  rest, `allow="autoplay; fullscreen; encrypted-media; picture-in-picture"`, `allowFullScreen`,
  `referrerPolicy="origin"`, NO `sandbox` attribute, `bg-stage`. The backend's Electron window follows the policy
  (`admin:set-player-policy` / `admin:clear-player-policy`, the fileserver's player-policy port): set before
  `frame.src`, cleared on close.
- **The provider preview's toolbar**: the `Enabled` labelled toggle (8.1's pattern) and a `Title` `Select` - the stored
  movies with a TMDB id the app holds, default the first; choosing one builds the URL from the provider's
  `movieTemplate` filled with the title's `tmdbId` (the backend's `fill` rule: `{tmdbId}/{season}/{episode}` only, a
  missing value stays literal) and reloads the frame; the policy follows the URL's origin.
- **The title preview's toolbar**: the title's `Enabled` labelled toggle and a `Provider` `Select` - a movie: the
  detail's `sources`; a series: the first episode's sources (`GET /api/titles/:id/seasons/:season`); choosing one loads
  that source's `url` and follows its `origin`/`frameOrigins`.
- **The providers index's `source` column becomes `host`** (mono): the embed template's host
  (`new URL(movieTemplate).host`), the source slug for a stream-family provider. The template itself stays a workspace
  field.
- **The child status bar** (8.3): left the state words (loading, ready, failed), right the chosen title's or source's
  name. No walk, no `Retry` (an iframe exposes no error to re-press).
- Tests: the frame rules (`allow`, no `sandbox`, `about:blank` at rest), the URL builders (`{tmdbId}` fill, a missing id
  literal, the `https://` requirement, the series' episode sources), the dropdowns' data and defaults, the eyes beside
  Delete, the policy set/change/clear, the Host column, the promotes.

## 9. Tests (`node:test`, written AND run by the worker; no server, no browser, no sleeping)

| File | Cases |
|---|---|
| `channels-service.test.ts` | each route of 3.1 with the body it sends (fake backend from `test/support/fake-backend.ts`): create live with a folder and with videos, create stream, only changed fields in a PATCH, `folder` and `videos` exclusive, number as text, rebuild, revert; the list drops an unreadable row and counts it; `409` and `422` carry `field` |
| `channel-body.test.ts` | the create body carries no `id`; the PATCH body |
| `channel-bulk.test.ts` | each verb's skip rules and reasons (stream/disabled/already), the disabled reasons, the plan over mixed ticked rows; a run through the shared runner with one forced failure keeps the rest |
| `channel-guard.test.ts` | every reason in order: `Preview →` index (none, two, one live, one stream), workspace (dirty, new), `Rebuild` (dirty, disabled), `Revert` (hand-made, nothing edited) |
| `channels-slice.test.ts` | the status transitions; `upsert` replaces by id; `remove`; ticks pruned with their row; `reset` on sign-out; `setWork({ preparing })` counts `preparing`, `starting`, `restarting` after every load and write |
| `channel-flows.test.ts` | the create, save, remove, rebuild, revert flows: answer replaces the record, form clears, notices, `channel.invalid` field to its row, `channel.taken` under Number, a changed `serial` drops the answer, a transport failure sets `unreachable` and disables writes until a read |
| `video-list.test.ts`, `video-order.test.ts` | move up/down, remove, add keeps order, numbering, `Already first` / `Already last` |
| `channels-markup.test.ts` | the New form in each kind (rows in order, no placeholder, `Create` reasons, `Choose` disabled with its reason without a host, enabled with one), the grid (headings, ticks, state words, dim, `Delete` question, synced tip), the live workspace groups (Plays switch, VideoList, `Rebuild` reasons, `Apply` reason, qualities `min`), the stream workspace (`Edited` tag, `Revert to playlist`, the refused-address `error`), skeletons while loading and preparing |
| `preview-player.test.ts` | with a fake engine and a fake video: hls.js used when supported, native HLS only as the fallback, neither gives the sentence; the three fatal-error mappings; `detach` destroys, pauses and empties `src`; a second `detach` is harmless |
| `preview-session.test.ts`, `preview-state.test.ts`, `preview-gate.test.ts` | attach only when `live` or `restarting`, the path of `streamUrl`, a stream row always; `preparing`/`starting` flag the skeleton and attach nothing; `failed` shows its problem; `Retry` reads exactly once; a missing channel; nothing polls; the gate reasons |
| `no-fixtures.test.ts` (shared, owned by `39`) | unchanged: no `fixtures/` import anywhere |

Plus `typecheck`, `lint`, `node scripts/check-rules.mjs`, all clean.

## 10. Failure modes

- **A stub left behind:** any method still `backend.not_connected` shows `This is not connected to the admin backend yet.` and the control is disabled with that
  reason; the wave does not exit while any `ChannelsService` method refuses.
- **No push:** a channel going `preparing` to `live` appears only on `Refresh`, a write's answer, the Status `Refresh` or the Preview `Retry`.
- **A folder path:** a live row's `folder` and `videos` are local paths; they appear in the workspace fields only - never in an event sentence, a notice or a log.
- **A rebuild of a disabled channel** is refused (`422`, field `enabled`); the verb says why before the press.
- **A late answer** after sign-out or a new sign-in is dropped (`serial`), exactly as `35` section 5.5.
- **The player outlives the window:** the `detach()` path is the only way the window closes; a test asserts it.
- **A stream origin that refuses cross-origin manifests** shows `manifest failed` or `unreachable`: the honest result.
- **The Preview video and decode:** after heavy GPU work Chrome's video decode can wedge machine-wide; if the stage stays black while `fetch` of the manifest works, restart Chrome before calling it a bug.

## 11. The worker brief (headings, `07` section 6.2)

1. **Where.** Worktree `D:\Projects\.giga-worktrees\admin-channels-tab`, branch `admin/channels-tab`, cut from `family-port` after Wave 3a is landed. May change: the files of section 4, `src/admin/test`, and in `src/backend` only the three files of 3.2 (the live-id change). Off limits: the rest of `src/backend`, `src/frontend`,
   `src/fileserver`, `src/shared/*` (a gap is added additively and named), the other tabs' pages, slices and services, `store/app-store.ts`, `store/slices/*` except `channels`, `index-frames.ts`, `package.json`, every `.env`, `docs/**`.
2. **Rules.** `AGENTS.md`, `07`, `01`; this plan; no fixture and no fake feature; a control works or is disabled with its reason; skeletons never a sentence over them; no browser storage, no timers; files at most 200 lines; never print a secret.
3. **Role.** Implements sections 3 to 8 in the five commits of section 2; writes and runs its tests; no browser, no server; edits no doc; commits on its branch, never pushes or merges.
4. **Read first.** `AGENTS.md`; `07` 6; `01` 4, 5, 6, 8, 9; this document; `35` (the pattern: slice, flows, serial, notices); `29` 5, 7, 9.1, 9.7, 10, 13; `26` 4.5 to 4.7; `28` 7.2 to 7.4; the foundation files of section 1; the backend's `api/channels.ts`, `api/admin-channels.ts`, `types/channel-input.ts`, `services/live-channel-rules.ts` as read-only reference; the library's `ChildWindow`, `RecordGrid`, `ArmedButton`, `Toggle`, `Segmented`, `ChipGroup`.
5. **Scope.** Section 4; out of scope as section 2.
6. **Report.** `07` 6.4, plus every gap filled (the first one: anything the live-id change did not cover) and any signature of `StateWord` / `useRecordForm` that differed.

## 12. The coordinator's acceptance

On a temporary backend (`39` section 9): `FIXTURE_DIR` of videos (`npm run fixtures` output, `scripts/fixtures`) as the live folders; the real built admin in Chrome at 1600 x 1000 and 900 x 640, plus the backend's Electron window for `Choose`.

1. Index: skeleton, then the rows; ticks arm `Preview →` with the three reasons; row click opens the workspace; armed `Delete <name>?` re-arms after 4 s and disarms on blur and `Escape`; `Refresh`.
2. Create a live channel `zz-drive-news` from a fixture folder (typed path in Chrome; `Choose` in Electron): it shows `preparing`, the statusbar `1 preparing`; after `Refresh`, `live`, and the count clears.
3. Live workspace: edit name, number, category, mode, captions, qualities (the last two cannot be switched off), switch Plays to Videos and back, move/remove/add videos; `Save` sends only changed fields (the network tab's body); `Discard changes`; `Rebuild`; `Enabled` off stops it.
4. Stream workspace: create a stream channel; refuse a non-https address under its row; edit; a synced row (seed one through a local test playlist on the temporary backend with `ALLOW_LOOPBACK_STREAMS`) shows `Edited` after a save and `Revert to playlist` clears it.
5. Preview: opens from the index and from the workspace; plays the live channel through its own path with hls.js (network: `master.m3u8` and segments from the page origin, no iframe, no `/test/` request); the line says `live`; closing stops all requests; focus returns to the opener; a `failed` or `stopped` channel opens it with the reason and `Retry`; a `preparing` one shows the skeleton; a stream channel plays or shows its error; after an edit `Preview →` says `Save the channel first`.
6. Wire: every `/api` request but login and refresh carries `Authorization`; no storage writes; console clean; both sizes, dark and light, compared with the interface's Collections window for the pattern and the mockup's `channels-index.html`, `channel-workspace*.html` for content.
7. Every `zz-drive-*` record created is deleted; the owner's data is untouched.

## 13. Doc against code: differences found (2026-10-17)

| # | Doc says | Code does |
|---|---|---|
| 1 | `26` 4.5a: Preview plays `masterUrl` | no admin answer has it; the live row's `streamUrl` is `<caller origin>/live/<id>/master.m3u8` (`29` 9.7 already corrects it) |
| 2 | `28` 7.3: the live New form has Name, Kind, Number, Category, Folder | superseded (owner, 2026-10-17): the backend assigns a new live channel's id (`live-<uuid>`, 3.2); the form sends none and derives none. Also: Name is first on every form (`39` section 5) |
| 10 | `28` 7.2: the Channels toolbar has `Preview →` only; ticks arm one verb | superseded (owner, 2026-10-17): bulk verbs `Enable`, `Disable`, `Rebuild`, `Delete` beside it (5.3) |
| 11 | `29` 9.1: a live create body carries `id` | the backend now assigns it when absent (3.2); the admin sends none |
| 3 | `28` Wave 3 / `29` Wave 8 plan fixtures first, then a wiring wave | superseded: this wave is wired directly; `FIXTURE_BUILD_MS`, `useFixtureLoad`, `fixtures/channels.ts` do not exist |
| 4 | `28` Wave 2 row lists `useRecordForm`, `StateWord` as created | neither is in the tree; they are Wave 3a's (`35`) |
| 5 | `29` 9.1: a live PATCH may change `logoUrl` | refused (`A live channel has no logoUrl...`); the live Logo row is read-only |
| 6 | `29` 7: `ApiError.field` | the foundation's `ApiError` has none; `35` adds it, and this wave depends on it |
| 7 | `26` 4.6 rail: `details · source · playback · fault · status` | `28` 7.2 folds the source into Details (Plays switch); this plan follows `28`; the fault section is removed (owner, 2026-10-17) |
| 8 | `26` 4.7: stream rows are read-only with "Owned by the playlist sync" | rule 1 of `26` 3.10 and the backend let a synced row be edited (`editedFields`); this plan follows the backend |
| 9 | `29` 9.1: `Rebuild` on any live channel | the backend refuses it while disabled and for a stream row |
