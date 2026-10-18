# 38 - Admin Playlists and Jobs plan (Wave 3d)

**Status: plan, written before the code (branch `admin/playlists-jobs`, cut from `family-port` after Wave 3a, `35`, has landed; it runs in
parallel with `36` and `37`, and is accepted after `36` for the one cross-tab read of section 3.4).** Owner, 2026-10-17: no fixture waves; every tab
is built directly against the real backend routes through the service modules, and a wave exits only when every control is really wired and verified.
This document is the Playlists tab and the Jobs tab, wired, including the sync runs and the statusbar's `N syncing`. It supersedes the fixture-first Wave 5
of `28` (Playlists and Jobs; Accounts moved to `35`) and the Playlists and Jobs part of `29` Wave 9 (the routes of 9.4 and 9.5 still govern). The program is
`39`. One worker owns both because a job points at a playlist and they share the run flows. Governed by `00`, `01`, `07`, `26` (3.10, 3.11, 4.9c), `28` (7.2,
7.3, Appendix A rows 76, 77), `29` (5, 9.4, 9.5, 17, 18).

## 1. What exists (verified in source)

| Piece | Where | State |
|---|---|---|
| Wire types and Zod | `services/schemas/playlist-schema.ts` (`PlaylistSchema`: `host`, `masked`, `channels`, `lastSyncedAt?`, `lastOutcome?`), `job-schema.ts` (`JobSchema`: `type`, `schedule`, `config` playlist or catalog, `playlistName?`, `running`, `lastRunAt?`, `lastOutcome?`, `lastCounts?`) | built |
| Services | `services/playlists.ts` (`RecordService<AdminPlaylist, number>`), `services/jobs.ts` (`JobsService`: the four plus `run(id)`) | **stubs: every method refuses with `backend.not_connected`** |
| Backend | Wave 0 landed: B4 (a playlist job's `lastOutcome` is a sentence; `lastCounts` carries `refusalExamples` and `createdIds`, at most 10 each), playlist and job routes, the scheduler | verified in `services/job-runner.ts`, `api/jobs.ts`, `api/playlists.ts` |
| Library and shell | `RecordGrid`, `Checkbox`, `Segmented`, `Select`, `Toggle`, `ArmedButton`, `ListGroup`, `NewRecordGroup`, `WorkspaceFrame`, `RecordRail`, `WorkspaceToolbar`, `IndexToolbar`, the `work` slice and statusbar `N syncing` readout (`lib/running-work.ts`), `requestTab`, `lib/field-checks.ts` (`schedule`), `lib/row-state.ts` (`jobState`, `enabledState`) | built (Wave 2) |
| Pages | `PlaylistsPage.tsx`, `JobsPage.tsx` | index skeleton only |

**Still to build:** `StateWord` and `useRecordForm` come from Wave 3a; `PlaylistRows`-style linked lists reuse `36`'s patterns but nothing of `36`'s files (this wave owns its own).

## 2. Scope

(1) Playlists service, slice, flows, index; (2) Playlist workspace; (3) Jobs service, slice, flows, index, `Run job`; (4) Job workspace, Run and Last run, the
statusbar count. Out of scope: Channels, Titles (read-only cross-references only); `POST /api/playlist-sync` and `/api/titles/sync` (thin wrappers the admin never uses); timers; polling.

## 3. Playlists

### 3.1 Routes (`29` 9.4)

| Method | Route | Body | Answer |
|---|---|---|---|
| `list` | `GET /api/playlists` | none | `{ items: PlaylistView[] }` (never the address) |
| `create` | `POST /api/playlists` | `{ name?, address, enabled? }` | `201` `PlaylistView`; the name defaults to the host |
| `update` | `PATCH /api/playlists/:id` | `{ name?, address?, enabled? }` (`address` replaces the stored one) | `PlaylistView` |
| `remove` | `DELETE /api/playlists/:id` | none | `{ id, released }` (the number of channels kept as hand-made rows) |

The address must be `https` and pass the address rule (`422 playlist.invalid`, field `address`). It is a secret: it is never shown back (the field shows `masked`),
never put in an event, a notice, a log or a URL, and cleared from the form after a successful save. `PlaylistsService.remove` is widened (additive) to answer
`{ id, released }`.

### 3.2 Index

`NewPlaylistForm` (`NewRecordGroup`, `plus`, `pl-`): **Name**, **Address** (`type=password`, `autoComplete="off"`, `spellCheck` off). `Create` is disabled with `Address is
required.`; Name is optional in the backend, but `28` 7.3 lists it as required, so the form requires it (`Name is required.`) and the owner may relax it (open decision in `39`).
The address is checked client-side (`httpsAddress`) and by the backend. The list (`ListGroup`, `list`, `Refresh`): headings `name`, `host`, `channels`, `last synced`,
`state` (`enabled` / `disabled`, dimmed); ticks select (the forward verb `Jobs →` needs no row); `Delete` is an `ArmedButton` whose rest title says `The channels it created stay,
as hand-made rows that no sync touches.`; its notice on success reads `Deleted <name>; <released> channels kept.`.

### 3.3 Workspace (rail `‹ Playlists`, `Details`, `Status`; toolbar `Discard changes`, `Save`, `Jobs →`)

- **Details** (`file-text`): Name, **Address** (a read-only mono field showing `masked`, with a ghost `Replace` in `trailing`: `Replace` unlocks the field as an empty
  `type=password` input, never prefilled, and disables itself with `Type the new value, then Save.`; if the person leaves it empty, no `address` is sent), **Enabled** (`Toggle`).
  One `Save` sends only changed fields; an unlocked, empty address is not a change.
- **Status** (`activity`, read-only): Host, **Channels** (the admin channels whose `source === host`, each a link that calls `requestTab("channels", id)`), Last synced
  (`lastSyncedAt`, local time or `never`), Outcome (`lastOutcome`). There is **no sync button here** - syncing is a Jobs matter (`26` 4.9c).

### 3.4 The cross-tab read

The channel list is `channels.list()` of `36` (`GET /api/admin-channels`, filtered by `source === host`; the backend's channel answer carries `source` but not the playlist
id). The worker calls only the **service interface** (`ChannelsService.list`), never `36`'s slice or components. Until `36` lands that call refuses as not connected; the Status
group then shows its shimmer lines and the notice says so - a visible refusal, not an invented list. This row is accepted after `36` is merged.

## 4. Jobs

### 4.1 Routes (`29` 9.5)

| Method | Route | Body | Answer |
|---|---|---|---|
| `list` | `GET /api/jobs` | none | `{ items: JobView[] }` |
| `create` | `POST /api/jobs` | `{ type: "playlist", name, enabled?, schedule?, config: { playlistId, dryRun?, prune? } }` or `{ type: "catalog", name, enabled?, schedule?, config: { scope, kind, pages? } }` | `201` `JobView` |
| `update` | `PATCH /api/jobs/:id` | `{ name?, enabled?, schedule?, config? }` (`type` never changes; `config` is merged over the job's own and checked against its type) | `JobView` |
| `remove` | `DELETE /api/jobs/:id` | none | `{ id }` |
| `run` | `POST /api/jobs/:id/run` | a playlist job: `{ dryRun?, prune? }` once; a catalog job: none | `202` `JobView` |

`JobsService.run` is widened (additive) to `run(id, override?)`. **Run semantics.** A playlist job is awaited by the backend: the `202` already carries the new `lastOutcome` and
`lastCounts`, so the page shows them at once (the call may take up to the 15 s fetch timeout per playlist; the control stays busy: `Running.`). A catalog job is started: the `202` says
`running: true`; the row shows `running` with the pulsing 48px bar, the notice says `Started <name>.`, and the page learns of the end only on `Refresh` (the list heading, or the
workspace's Last run `Refresh`). **No polling.** The refusals are `409 sync.busy`, `422 job.disabled` (the message gives the reason: a disabled job, or a missing or disabled playlist),
`503 tmdb.unavailable`, `503 playlist.unreachable`, `422 playlist.invalid`, `409 playlist.busy`; each is the `Run job` control's field error (on the workspace) and the notice.

### 4.2 Index

`NewJobForm` (`NewRecordGroup`, `plus`, `jb-`): **Name**, **Type** (`Segmented` Playlist / Catalog - the row switcher), then **Playlist** (`Select` of the playlist records,
read from `playlists.list()`; disabled playlists are listed but marked `disabled` and refuse with the backend's reason) for a playlist job, or **Scope** (`Segmented` Trending /
Popular) and **Kind** (`Segmented` Movies / Series) for a catalog job; the rows a Type does not use are not rendered and leave the required list. `Create` is disabled with
`<Label> is required.`; a catalog job has `pages` 1 to 25 (default left to the backend). The list (`ListGroup`, `timer`, `Refresh`): headings `name`, `type`, `target` (the playlist name,
or scope + kind), `schedule`, `last run`, `outcome`, `state` (`idle`, `running` with the pulsing bar, `failed`, `disabled`: `jobState`); ticks arm the toolbar; `Delete` is an `ArmedButton`
(deleting a job changes nothing it created).

**Toolbar `Run job`** (the one filled verb) acts on the ticked jobs, **one after another** (the backend allows one playlist sync at a time, `playlist.busy`); a refusal on one is reported on the
notice and the rest continue. It is disabled, in this priority order, with: `Tick a job first` (none ticked); `Jobs that are disabled cannot run.` (a ticked job is disabled);
`A ticked job is already running.`; `A ticked job's playlist is disabled.` (from `playlistName` and the playlists list); `The admin backend cannot be reached.` (`lib/job-run-gate.ts`, pure).

### 4.3 Workspace (rail `‹ Jobs`, `Details`, `Schedule`, `Run`, `Last run`; toolbar `Discard changes`, `Save`, `Channels →` for a playlist job or `Titles →` for a catalog job)

- **Details** (`file-text`): Name, Type (read-only), Playlist (`Select`) or Scope and Kind (a catalog), **Enabled**, Pages (catalog).
- **Schedule** (`clock`): Interval (text; the page checks `^[1-9]\d*[mh]$|^off$` by `lib/field-checks.ts` `schedule`, a bad value is the `Row`'s `error` and the notice; the backend normalises it
  and answers `422 job.invalid` field `schedule` otherwise). The tip lists `6h`, `30m`, `24h`, `off`.
- **Run** (`play`): a playlist job has **Dry run** and **Prune** (`Toggle`s; the Prune tip says it deletes synced channels whose entry vanished, and that edited ones are kept) and `Run job`;
  a catalog job has `Run job`. `Run job` on the workspace sends the toggles' current values as the once-only override (`{ dryRun, prune }`) and is disabled with the same reasons as the toolbar's plus
  `Save the job first` while the draft is dirty.
- **Last run** (`history`, read-only; a heading `Refresh`): State (word), When, Outcome (`lastOutcome`, a sentence after B4), Counts (a playlist job: `created`, `updated`, `kept`, `skipped`, `refused`,
  `removed`; a catalog job: titles stored and stale), **Refused** (`refusalExamples`, at most 10 strings) and **Created** (`createdIds`, each a link that calls `requestTab("channels", id)`),
  read defensively from the loose `lastCounts` record (an absent key draws a shimmer line, never a sentence). Forward verbs: `Channels →` (a playlist job) or `Titles →` (a catalog job) call `requestTab`.

### 4.4 The statusbar

`N syncing` is the count of loaded jobs with `running === true`, written with `setWork({ syncing })` by the jobs slice after every load and write, and shown over a full pulsing bar
(the Wave 2 statusbar). It changes only on those events: no timer. A catalog job started shows `1 syncing` until a `Refresh` reads it `running: false`. `Stop` stays disabled with `A sync cannot be
cancelled.`.

## 5. Cross-tab effects (through the one stale registry, `39` section 5)

Deleting a playlist removes its jobs (`playlist-service.ts` `remove`) and detaches its channels. After a successful delete the flow calls `markStale("jobs")` and `markStale("channels")` (a
`stale` record in the baseline `store/slices/stale.ts` of `35`); each tab's load hook re-reads the next time its tab is shown. This wave never writes another tab's slice.

## 6. Files

Paths under `src/admin/src/`; "C" create, "U" update; the limit is 200 lines (tests 250).

| Act | File | Responsibility |
|---|---|---|
| U | `services/playlists.ts` (80), `services/jobs.ts` (90) | the routes over `request`; `remove` answers `{ id, released }`; `run(id, override?)`; lenient lists (an unreadable row is dropped and counted) |
| C | `lib/playlist-draft.ts` (70), `lib/playlist-body.ts` (50), `lib/playlist-rows.ts` (40) | draft with the replace state; changed-fields body; row view |
| C | `lib/job-draft.ts` (100), `lib/job-body.ts` (80), `lib/job-rows.ts` (60), `lib/job-run-gate.ts` (60), `lib/job-counts.ts` (60) | draft; create and PATCH bodies (config merge); rows; the `Run job` reasons; the defensive reading of `lastCounts` |
| C | `store/playlists-slice.ts` (90), `store/jobs-slice.ts` (110) | status, items, ticks, `unreachable`; jobs add `running` bookkeeping and write `setWork({ syncing })` |
| C | `services/playlist-flows.ts` (130), `services/job-flows.ts` (190), `services/job-run-queue.ts` (70) | create, save, remove, refresh; run one, run the ticked ones in sequence; `serial` guard; typed results |
| C | `hooks/usePlaylistsLoad.ts`, `hooks/usePlaylistActions.ts`, `hooks/useJobsLoad.ts`, `hooks/useJobActions.ts` | small |
| C | `components/playlists/PlaylistsIndex.tsx`, `NewPlaylistForm.tsx`, `PlaylistRows.tsx`, `PlaylistWorkspace.tsx`, `PlaylistDetailsGroup.tsx`, `PlaylistStatusGroup.tsx` | 3.2, 3.3 |
| C | `components/jobs/JobsIndex.tsx`, `NewJobForm.tsx`, `JobRows.tsx`, `JobWorkspace.tsx`, `JobDetailsGroup.tsx`, `JobScheduleGroup.tsx`, `JobRunGroup.tsx`, `JobLastRunGroup.tsx` | 4.2, 4.3 |
| C | `constants/playlist-copy.ts`, `job-copy.ts`, `playlist-grid.ts`, `job-grid.ts` | labels, tips, reasons, columns |
| U | `pages/PlaylistsPage.tsx`, `pages/JobsPage.tsx` | the only readers of `workspaces.playlists` / `workspaces.jobs` |

No library change, no backend change, no change to `app-store.ts`, `index-frames.ts` or `package.json`.

## 7. Tests (`node:test`, written AND run by the worker; no server, no browser)

| File | Cases |
|---|---|
| `playlists-service.test.ts` | list/create/PATCH/delete bodies; the address is never read back; `Replace` sends `address`, an unchanged one sends nothing; `remove` answers `released`; `422` carries `field` |
| `playlist-draft.test.ts`, `playlist-flows.test.ts`, `playlists-slice.test.ts` | the Replace state machine (locked, unlocked and empty is no change, `Type the new value, then Save.`); create/save/remove flows and notices; delete marks `jobs` and `channels` stale; the address never reaches a notice, event or state; `serial` drop |
| `jobs-service.test.ts` | create bodies by type; PATCH `config` merge; `run` with and without the override; `202` mapping; the refusal codes |
| `job-run-gate.test.ts` | the reasons in priority order (none ticked, disabled, running, playlist disabled, unreachable) |
| `job-run-queue.test.ts` | ticked jobs run one after another; a refusal does not stop the rest; each refusal is reported; a changed `serial` stops the queue |
| `job-counts.test.ts`, `job-schedule-field.test.ts` | reading an absent or odd `lastCounts` key; `6h`, `30m`, `24h`, `off` accepted, `x` refused |
| `jobs-slice.test.ts` | `running` rows count into `setWork({ syncing })` after every load and write; reset on sign-out |
| `playlists-markup.test.ts`, `jobs-markup.test.ts` | New forms (Type switching the rows, address `type=password`), grids (headings, state words, the running bar, dim), workspaces (masked address with `Replace`, the Status channel links, Schedule error, Run toggles, Last run lines, the forward verbs), skeletons |

Plus `typecheck`, `lint`, `node scripts/check-rules.mjs`, clean.

## 8. Failure modes

- A stub left behind blocks the exit: no `PlaylistsService` or `JobsService` method may still refuse as not connected.
- **A long awaited run:** a playlist run holds one HTTP call; the control shows `Running.`; a second press is ignored; leaving the tab does not cancel it; a late answer after sign-out is dropped.
- **A catalog run's end is not pushed:** `running` stays until a `Refresh`.
- **The address is a secret:** never in a log, notice, event row, URL or error; the unlock field is empty and cleared after a save.
- **A job whose playlist was deleted elsewhere** is gone on the next read; the open workspace closes with a notice.
- **The playlist select is empty or failed:** the New form's Playlist row is a shimmer and `Create` says `Playlist is required.`; no invented rows.

## 9. Brief headings

1. **Where.** Worktree `D:\Projects\.giga-worktrees\admin-playlists-jobs`, branch `admin/playlists-jobs`, cut from `family-port` after Wave 3a. Owned: section 6. Off limits: `src/backend`, `src/frontend`, `src/fileserver`, `src/shared/*`, other tabs' files, `store/app-store.ts`, `store/slices/*` except its two, `index-frames.ts`, `package.json`, `.env`, `docs/**`.
2. **Rules.** As `36` section 11. 3. **Role.** Four commits per section 2; writes and runs tests; no browser or server; no doc edit.
4. **Read first.** `AGENTS.md`; `07` 6; `01`; this document; `35` (the pattern); `29` 5, 7, 9.4, 9.5; `26` 3.10, 3.11, 4.9c; `28` 7.2, 7.3; the foundation files; the backend's `api/jobs.ts`, `api/playlists.ts`, `types/job.ts`, `services/job-runner.ts` read-only.
5. **Scope.** Section 6. 6. **Report.** `07` 6.4 and every gap filled.

## 10. The coordinator's acceptance

Temporary backend (`39` 7) with `ALLOW_LOOPBACK_STREAMS` and a local test playlist served from a throwaway static server on a free port (the owner's playlists and TMDB token are never used); `TMDB_BASE` at the backend tests' local stub for the catalog job.
1. Playlists: create (the address refused unless it passes the address rule), the masked address with `Replace`, edit, `Enabled`, Status with channel links (after `36`), delete two-step with its notice.
2. Jobs: create a playlist job and a catalog job, `Run job` with `Dry run` (counts at once), `Prune` tip, the toolbar run on two ticked jobs in sequence with a forced refusal on one, a catalog run showing `running`, `1 syncing`, the pulsing bar, then `Refresh` shows the outcome; Last run counts, refused examples, created ids as links; a bad interval as a field error; `Channels →` / `Titles →`; the disabled reasons.
3. Both sizes, dark and light; console clean; every request carries `Authorization`; no storage; records created are deleted; owner data untouched.

## 11. Doc against code: differences found (2026-10-17)

| # | Doc says | Code does |
|---|---|---|
| 1 | `28` Wave 5: Playlists, Jobs and Accounts, from fixtures | superseded: Accounts moved to `35`; this wave is wired directly |
| 2 | `29` 9.5: `Run job` for a playlist job carries `{ dryRun?, prune? }` once | `JobsService.run(id)` in the foundation takes no body; widened here (additive) |
| 3 | `29` 9.4: delete answers `{ id, released }` | `RecordService.remove` types `{ id }`; widened here |
| 4 | `28` 7.3: a playlist's Name is required | `PlaylistInputSchema` has `name` optional (the host is the default); the form requires it by the doc |
| 5 | `29` 9.5 / 18 B4: refusal examples and created ids may be absent | landed in the backend (`refusalExamples`, `createdIds`), but `JobSchema.lastCounts` is a loose record: read defensively |
| 6 | `29` 9.4: a playlist's channels are found by `source === host` | the backend's channel answer has `source` but no playlist id, so the match is by host (two playlists on one host share channels) |
| 7 | `28` Wave 5: `job-schedule-field` accepts `6h`, `30m`, `24h`, `off` | `field-checks.schedule` accepts any `<n>m` / `<n>h` and `off`; the backend normalises |
