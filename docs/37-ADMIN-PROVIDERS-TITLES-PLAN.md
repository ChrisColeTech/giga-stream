# 37 - Admin Providers and Titles plan (Wave 3c)

**Status: plan, written before the code (branch `admin/providers-titles`, cut from `family-port` after Wave 3a, `35`, has landed; it runs in
parallel with `36` and `38`).** Owner, 2026-10-17: no fixture waves; every tab is built directly against the real backend routes through the
service modules, and a wave exits only when every control is really wired and verified. This document is the Providers tab and the Titles tab, wired.
It supersedes the fixture-first Wave 4 of `28` (its reference content - the look, the field order, the copy - still governs) and the Providers
and Titles part of `29` Wave 8 and 9 (the routes of 9.2 and 9.3 still govern). The program is `39`. One worker owns both tabs because they share
`ChipsInput` and the record pieces and have no file in common with any other wave. Governed by `00`, `01`, `07`, `26` (4.9a, 4.9b, 3.10), `28`
(7.2, 7.3, Appendix A), `29` (5, 9.2, 9.3, 17, 18).

## 1. What exists (verified in source)

| Piece | Where | State |
|---|---|---|
| Wire types and Zod | `services/schemas/provider-schema.ts` (`ProviderSchema`, `ProviderListSchema`), `services/schemas/title-schema.ts` (`TitleRowSchema`, `TitleDetailSchema`, `TitleListSchema`) | built |
| Services | `services/providers.ts` (`RecordService<AdminProvider, number>`), `services/titles.ts` (`RecordService<AdminTitleRow, string, TitleList>`) | **stubs: every method refuses with `backend.not_connected`** |
| Backend | Wave 0 landed: B2 (a provider's `enabled`, `null` clears an optional field), B3 (title writes take the 256 KiB limit), B5 (`editedFields` on the admin title view, names on audit detail) | verified in `types/provider.ts`, `api/titles.ts`, `services/title-overlay.ts` |
| Library | `RecordGrid`, `Checkbox`, pill `ChipGroup` (with `min`), `Segmented`, `Select`, `Toggle`, `ChipsInput`, `ArmedButton`, `NumericInput`, `Textarea` | built; `ChipsInput` lacks a `className` |
| Shell and record frame | `ListGroup`, `NewRecordGroup`, `WorkspaceFrame`, `RecordRail`, `WorkspaceToolbar`, `IndexToolbar`, `TabPage`, `requestTab`, `lib/row-state.ts` (`enabledState`, `titleState`), `lib/field-checks.ts` | built (Wave 2) |
| Pages | `ProvidersPage.tsx`, `TitlesPage.tsx` | index skeleton only |

**Still to build:** `StateWord` and `useRecordForm` come from Wave 3a (`35`); this wave builds `SeasonList`, the `ChipsInput` `className`, and everything
below.

## 2. Scope

Both tabs, wired, in this order (one commit each): (1) Providers service, slice, flows, index; (2) Provider workspace; (3) Titles service, slice, flows,
index with search, kind chips, sort and paging; (4) Title workspace with Seasons, Sources, `Revert to TMDB`. Out of scope: Jobs and Playlists (`38`),
the sync (a Jobs-tab matter); no timers, no polling.

## 3. Providers

### 3.1 Routes (`29` 9.2; the backend's `api/providers.ts`)

| Method | Route | Body | Answer |
|---|---|---|---|
| `list` | `GET /api/providers` (public) | none | `{ items: BackendProvider[] }` |
| `create` | `POST /api/providers` | `{ name, source, family?, order?, enabled?, movieTemplate?, episodeTemplate?, startParam?, subtitlesParam?, origin?, frameOrigins?, messageShape? }` | `201` provider |
| `update` | **`PUT`** `/api/providers/:id` | any of the same fields; **absent keeps, `null` clears an optional field** (B2) | provider |
| `remove` | `DELETE /api/providers/:id` | none | `{ id }` |

**The save is a `PUT`, not a `PATCH`** (the backend registers `app.put`); the foundation's `RecordService` names the method `update`, so
`services/providers.ts` implements it as `request(path, schema, { method: "PUT", body })`. Wire fields: `is_active` and `created_at` are the backend's
snake_case (the schema reads them as is; the form calls `is_active` `Enabled`), `enabled` is the write name.
Refusals are `422 provider.invalid` naming a field: a template not https or missing `{tmdbId}`; an episode template missing a placeholder
(`{tmdbId}`, `{season}`, `{episode}`); an origin that is not an https origin without a path; more than 8 frame origins. `Order` is a number.
There is no API key (`26` D24).

### 3.2 Index

`NewProviderForm` (`NewRecordGroup`, `plus`, id prefix `pv-`): **Name**, **Family** (`Segmented` Embed / Stream, a row switcher: an embed provider
shows the **Movie template** row, a stream provider does not), **Source**, **Movie template** (embed only). `Create` is disabled with `<Label> is required.`;
the template needs `https` and `{tmdbId}` (client-side by `lib/provider-checks.ts`, then the backend's `422` under the named row). The list
(`ListGroup`, `plug`, `Refresh`): `RecordGrid` with headings `order`, `name`, `source`, `family`, `state`; the state word is `enabled` or `disabled`
(`enabledState(is_active)`), a disabled provider dimmed; row `Delete` is an `ArmedButton`; skeleton while loading or empty. Rows sort by `order`, then name.
**Bulk verbs** (owner, 2026-10-17; the mechanism is `39` section 6, consumed through `useBulkAction`): ghost verbs `Enable`, `Disable` and `Delete` beside the forward verb `Titles →`, always drawn, disabled with `Tick a row first`
until a row is ticked (`lib/provider-bulk.ts`, pure): `Enable` / `Disable` are `PUT { enabled }`, skipping a provider already in that state (`Already enabled.` / `Already disabled.`; all skipped: `Every ticked provider is already enabled.` / `...disabled.`);
`Delete` is `DELETE`, two-step (`Delete N providers?`), nothing skipped. A disabled provider stays in its list, dimmed.

### 3.3 Workspace (rail `‹ Providers`, `Details`, `Templates`, `Player`; toolbar `Discard changes`, `Save`, `Preview →`)

*(Amended 2026-10-18, `55` decisions 1-2: the toolbar is `Discard changes` LEFT, then `Save` and `Preview →` (the provider
preview, `36` 8.5) RIGHT - the trailing save left the form's body (`01` Forms, amended); the promote is the preview, not
`Titles →`. The Providers index's `source` column becomes `host` - the embed template's host, the source slug for a
stream-family provider - and the row gains the `Preview provider` eye beside the armed `Delete`, absent for a
stream-family or template-less provider.)*

- **Details** (`file-text`): Name, Family (`Segmented`; changing it is allowed and re-renders the template rows), Source, Movie template (embed),
  **Enabled** (`Toggle` over `is_active`), Order (`NumericInput`), Created (read-only, `YYYY-MM-DD HH:mm` local).
- **Templates** (`link`): Episode template (the info tip carries the `{tmdbId}`, `{season}`, `{episode}` placeholders), Start parameter, Subtitle parameter.
- **Player** (`monitor-play`): Origin, **Frame origins** (`ChipsInput`: Enter or comma adds, a chip's X removes, a malformed origin or a ninth is refused inline with its sentence;
  the chips box takes the field height through the new `className`), **Message shape** (`Select`: None, `vidsrc-status`, `player-event`).
- One `Save` sends a `PUT` of **only the changed fields**; a field the person emptied is sent as `null` (clears); the answer replaces the record and the baseline.
  `Enabled` is writable (B2). Save is disabled with `Nothing has changed.`, a required-field reason, `Saving.` or the unreachable sentence.

## 4. Titles

### 4.1 Routes (`29` 9.3)

| Action | Route | Body or query | Answer |
|---|---|---|---|
| list | `GET /api/titles` | `kind=movie\|tv\|all`, `sort=newest\|oldest\|az\|year\|trending`, `genre?`, `year?`, `page`, `includeDisabled=true` | `{ items: AdminTitleRow[], page, totalPages, totalResults }`; page 1 carries the manual titles; `kind=all` makes two TMDB reads on the backend |
| search | `GET /api/titles/search` | `q`, `kind=movie\|tv` (one kind), `page`, `includeDisabled=true` | the same shape |
| detail | `GET /api/titles/:id` | `includeDisabled=true` | the row plus `plot cast runtimeMs seasons sources` |
| create (manual) | `POST /api/titles` | `{ kind, title, year?, genres?, rating?, posterUrl?, backdropUrl?, plot?, cast?, runtimeMs?, seasons?, streamUrl?, tmdbId? }` | `201` row, `state: "manual"`, id `custom-<uuid>` |
| save | `PATCH /api/titles/:id` | changed fields; `null` clears an optional one; `enabled`; `tmdbId` only on a manual title | row |
| delete | `DELETE /api/titles/:id` | none | `{ id }` (a synced title stays deleted until restored; the tooltip says so) |
| list deleted | `GET /api/titles/deleted` | none | `{ items: { id, kind, tmdbId, title?, deletedAt }[] }`, latest first; `title` is the last known text |
| restore | `DELETE /api/titles/deleted/:id` | none (`:id` like `movie-603`) | `{ id }`; the title returns on the next browse or sync; `404 title.not_found` when none is recorded |
| revert | `POST /api/titles/:id/revert` | none | the row refetched from TMDB; `409 title.manual` for a manual title |

The admin token is required for `includeDisabled`. With no `TMDB_READ_TOKEN` and no manual title the read is `503 tmdb.unavailable`: the list keeps its
skeleton and the notice says `The title service cannot be reached right now.`; a manual title can still be created (it is stored locally).
The foundation's `TitlesService` lacks `detail` and `revert`; this wave adds them to that file (additive). Body limit: titles take the 256 KiB limit (B3).
Strict bodies: a PATCH sends only changed fields; `year` 1800 to 2200, `rating` 0 to 10, `runtimeMs` whole, `genres` at most 20, `cast` at most 50,
`seasons` at most 100 by 500 episodes (`types/title-input.ts`).

### 4.2 Index

> **Superseded in part by `41` (owner, 2026-10-17: "the titles aren't loading all titles").** The list below is a TMDB **browse** (20 per kind per page, 500 pages, nothing that is only stored); the backend holds far more (10,921 stored on the owner's backend). The Titles list gains a `Stored | Browse TMDB` segment: **`Stored` is the main list**, a server-paged, windowed grid over the new `GET /api/titles/stored` (search, Kind / Origin / Edited / Disabled filters, sortable headers, an `N stored` readout, `Sync now`); **`Browse TMDB` is this section, unchanged**, for finding titles TMDB has that the store lacks. Delete (soft delete) and `Deleted titles` mean the same in both modes (`41` 5.2). Sections 4.1 to 4.4 below describe Browse mode; `41` 5.2 and 5.3 describe Stored mode and how the store grows.

`NewTitleForm` (`NewRecordGroup`, `plus`, `nt-`): **Title** (the record's name, so first), **Kind** (`Segmented` Movie / Series - an ordinary row 2 that switches nothing), **Year**.
`Create` posts a manual title. The list group (`ListGroup`, `clapperboard`, title `Titles`) heading area holds, in order: the **search** field (carries
`data-search` so `Ctrl+F` focuses it; runs on `Enter` and on its own button, never as you type), the **Kind chips** (pill `ChipGroup`, `min` 1: at least
one stays on), the **Sort** pills (`Segmented`: Newest, Oldest, A-Z, Year, Trending); the action slot holds `Older` and `Newer`, plus `Refresh`.
- Empty search and any chips: `GET /api/titles` with `kind=all` when both chips are on, else the one kind.
- Non-empty search: `GET /api/titles/search`, one call per ticked kind; with both chips on the worker makes two calls and merges the rows by title,
  and `totalPages` is the larger of the two (`TitleListGroup` owns this; `lib/title-query.ts` and `lib/title-merge.ts` are pure).
- `Older` raises `page`, `Newer` lowers it, each re-reads; `Newer` is disabled at page 1 with `This is the first page.`, `Older` at `totalPages` with `This is
  the last page.`. A search, a kind change or a sort change returns to page 1. Page, search text, kinds and sort live in the slice (and are not remembered across sessions).
- Headings `title`, `kind`, `year`, `rating`, `state`; state words `synced`, `edited` (its tooltip `edited: plot` names the `editedFields`), `manual`, `disabled` (`titleState`); `Jobs →` in the toolbar;
  `Delete` is an `ArmedButton` whose rest title for a synced title says it stays deleted and points to `Deleted titles`.
- **Bulk verbs** (owner, 2026-10-17; `39` section 6; `lib/title-bulk.ts`, pure), ghost, beside `Jobs →`, disabled with `Tick a row first` until a row is ticked:

  | Verb | Calls | Skipped, with its reason | Verb disabled when |
  |---|---|---|---|
  | `Enable` / `Disable` | `PATCH { enabled }` | already in that state: `Already enabled.` / `Already disabled.` | all skipped |
  | `Revert to TMDB` | `POST .../revert` | a manual title: `A title made by hand has no TMDB copy to go back to.`; an unedited synced title: `Nothing was edited.` | nothing left: the first skipped reason |
  | `Delete` | `DELETE` (two-step: `Delete N titles?`), **manual and synced titles alike** (owner, 2026-10-17: "bulk delete should apply for manual and auto added") | none | none ticked |

  **What the backend does with a deleted synced title (soft delete, owner, 2026-10-17; migration `020`, `03` section 7.4):** `DELETE` removes the stored copy (its admin edits go with it) and records the title's TMDB identity in `deleted_titles`. Browse, search, detail and the catalog sync then skip it, so it stays deleted until it is restored under `Deleted titles` (4.4). A title made by hand is deleted for real and never recorded. The admin adds no refusal. The run's summary says it: `Deleted 5 titles; 3 were synced and stay deleted until restored under Deleted titles.` (the count of synced ones from the plan; `; 1 failed` and `; 1 skipped` follow as for every bulk run), and each synced row's single `Delete` has the rest tooltip `Deletes the title and keeps it deleted: no browse or catalog sync adds it back. Restore it under Deleted titles.`. After a synced title is deleted (single or bulk) the `Deleted titles` list is read again; the list's `Refresh` reads it too.

  The single-row `Delete` of a synced title in the grid keeps its place. Search, paging and a kind or sort change keep the ticks of rows still on the page and drop the others.

### 4.3 Workspace (rail `‹ Titles`, `Details`, `Plot`, `Images`, `Seasons` (series only); toolbar `Discard changes`, `Save`, `Preview →`)

*(Amended 2026-10-18, `55` decisions 1-2: the toolbar is `Discard changes` LEFT, then `Save` and `Preview →` (the title
preview, `36` 8.5) RIGHT - the trailing save left the form's body (`01` Forms, amended); the promote is the preview, not
`Jobs →`. The Titles index gains the `Preview title` eye beside the armed `Delete`, absent for a TMDB-less title.)*

The workspace opens from the held row, then reads `GET /api/titles/:id?includeDisabled=true` for the fields a list row lacks (plot, cast, runtime, seasons, sources);
its groups wear shimmer lines in their shape until it answers.
- **Details** (`file-text`; action slot `Revert to TMDB`, `undo-2`): Title, Kind (read-only), Year, **Enabled**, **TMDB id** (editable only on a manual title; read-only on a synced
  one), Rating, Genres (comma list, sent as `string[]`), Runtime (minutes in the form, `runtimeMs` on the wire; `lib/title-units.ts`), Stream address, State
  (read-only word). `Revert to TMDB` is disabled with `A title made by hand has no TMDB copy to go back to.` for a manual title, with `Nothing was edited.` when `editedFields` is empty, and
  otherwise posts `.../revert` (an `ArmedButton`-free ghost verb: it only drops local edits).
- **Plot** (`users`): Plot (`Textarea`, 4 rows), Cast (a `Textarea`, 3 rows - one name per line or comma-separated, `53`; both fields draw multi-line: the kit's `Textarea` no longer inherits the one-line field height).
- **Images** (`image`): Poster address, Backdrop address.
- **Seasons** (`layers`, series only): for a **manual** series an editable ordered `SeasonList` (season number, episodes with number and title, remove, `Add season`); for a **synced**
  series the seasons are read-only with their `episodeCount`. A movie's workspace has no Seasons rail item and no Seasons group.
- There is no Sources group (owner, 2026-10-17: a read-only list took the space of the fields an admin fills in); every field the backend's `TitlePatch` accepts is a control above.
- One `Save` sends only changed fields (`lib/title-body.ts`); a cleared optional field is `null`; the answer replaces the row and baseline.

### 4.4 Deleted titles (soft delete)

`DeletedTitlesGroup` (`trash-2`, id `ti-deleted`) is the Titles page's second group, under the list. It reads `GET /api/titles/deleted` when the tab first shows, after a synced title is deleted and on `Refresh`; its rows live in the titles slice (`titles.deleted`: `status`, `items`, `ticked`). The list is a `RecordGrid` with a select-all tick, headings `name` (first: the title text kept at delete time, or the id such as `movie-603` when none was kept), `kind` and `deleted` (`YYYY-MM-DD HH:mm`), and each row ends with a ghost `Restore` (its tooltip `Lets the title return on the next browse or sync.`). Pressing a row ticks it. While the list is read, and while it holds nothing, the group shows shimmer rows: **the skeleton is the empty state**, never a sentence.

- **Row `Restore`** (`DELETE /api/titles/deleted/:id` through `flows.restore`) says `Restored <title>. It returns on the next browse or sync.`, drops the row and re-reads the audit tail. A `404 title.not_found` says its sentence and reads the list again.
- **Bulk `Restore`** (the heading's action slot) runs the ticked rows through the shared bulk piece (`lib/bulk-plan.ts`, `useBulkAction`, `services/bulk-run.ts`): one `DELETE` per row, a failure never stops the rest, one summary `Restored 3 titles; they return on the next browse or sync.` (`; 1 failed` follows) and a re-read at the end; the rows that finished are unticked, the failed ones stay ticked and are listed under the heading (`BulkNotes`). A plan skips nothing, so only the shared reasons disable it: `Tick a row first`, `Saving.`, `The admin backend cannot be reached.` (natively disabled, the reason as its focusable tooltip).
- Files: `components/titles/DeletedTitlesGroup.tsx`, `hooks/useDeletedTitles.ts`, `lib/title-restore.ts` (pure: names, ticks, plan, words, reasons), `services/title-deleted-flow.ts`, the restore call in `services/title-bulk.ts`, `listDeleted` and `restore` in `services/titles.ts` (zod `DeletedTitleListSchema`), copy in `constants/title-copy.ts`, columns in `constants/title-grid.ts`. Tests: `title-restore.test.ts` (service, flows, bulk run, plan), `titles-deleted-markup.test.ts`, and the new wording in `title-bulk.test.ts` and `titles-markup.test.ts`.

## 5. Files

Paths under `src/admin/src/`; "C" create, "U" update. The limit is 200 lines (tests 250).

| Act | File | Responsibility |
|---|---|---|
| U | `services/providers.ts` (80), `services/titles.ts` (130), `services/schemas/title-schema.ts` | the routes above over `request`; lenient list parsing (an unreadable row is dropped and counted); `detail`, `revert`; the schema gains the title detail's `editedFields` |
| C | `lib/provider-checks.ts` (80), `lib/provider-body.ts` (70), `lib/provider-draft.ts` (80), `lib/provider-rows.ts` (40) | template and origin rules; create and PUT bodies; draft and `sameDraft`; row view |
| C | `lib/provider-bulk.ts` (50), `lib/title-bulk.ts` (70) | the bulk verbs' eligibility and reasons |
| C | `lib/title-query.ts` (70), `lib/title-merge.ts` (40), `lib/title-body.ts` (90), `lib/title-draft.ts` (100), `lib/title-units.ts` (30), `lib/title-rows.ts` (50), `lib/season-edit.ts` (50) | the list and search queries and merging; bodies; draft; minutes/`runtimeMs`, comma lists; row view; season list edits |
| C | `store/providers-slice.ts` (90), `store/titles-slice.ts` (130) | status, items, ticks, `unreachable`; titles add `page`, `totalPages`, `search`, `kinds`, `sort`, `detail` |
| C | `services/provider-flows.ts` (150), `services/title-flows.ts` (180) | create, save, remove, refresh, revert; `serial` guard; typed results |
| C | `hooks/useProvidersLoad.ts`, `hooks/useProviderActions.ts`, `hooks/useTitlesLoad.ts`, `hooks/useTitleActions.ts`, `hooks/useTitleDetail.ts` | small |
| C | `components/providers/ProvidersIndex.tsx`, `NewProviderForm.tsx`, `ProviderRows.tsx`, `ProviderWorkspace.tsx`, `ProviderDetailsGroup.tsx`, `ProviderTemplatesGroup.tsx`, `ProviderPlayerGroup.tsx` | 3.2, 3.3 |
| C | `components/titles/TitlesIndex.tsx`, `NewTitleForm.tsx`, `TitleListGroup.tsx`, `TitleRows.tsx`, `TitleWorkspace.tsx`, `TitleDetailsGroup.tsx`, `TitlePlotGroup.tsx`, `TitleSeasonsGroup.tsx`, `TitleSourcesGroup.tsx` | 4.2, 4.3 |
| C | `components/records/SeasonList.tsx` (100) | the editable seasons |
| C | `constants/provider-copy.ts`, `title-copy.ts`, `provider-grid.ts`, `title-grid.ts` | labels, tips, reasons, columns |
| U | `pages/ProvidersPage.tsx`, `pages/TitlesPage.tsx` | the only readers of `workspaces.providers` / `workspaces.titles` |
| U | `src/shared/ui/src/controls/ChipsInput.tsx` (+ test `chips-input-markup.test.ts`) | additive `className` reaching the chips box (`27`/`28` section 4.3) |

No other library change, no backend change, no change to `app-store.ts` (the slices register through `store/slices/providers.ts` and `titles.ts`, `39` section 5).

## 6. Tests (`node:test`, written AND run by the worker; no server, no browser)

| File | Cases |
|---|---|
| `providers-service.test.ts` | list, create, **PUT** (method and only changed fields), `null` clears, `enabled` round-trips, delete; an unreadable row dropped and counted; `422` carries `field` |
| `provider-checks.test.ts`, `provider-body.test.ts`, `provider-draft.test.ts` | https and `{tmdbId}`; the episode placeholders; origin https without path; at most 8 frame origins; bodies; dirty and discard |
| `providers-slice.test.ts`, `provider-flows.test.ts` | transitions, replace by id, ticks; create/save/remove flows, field refusals under their rows, `serial` drop, `unreachable` |
| `titles-service.test.ts` | query building (`includeDisabled`, `kind=all`, paging, sort); search per kind; detail; PATCH with `null`; create body; revert; `503 tmdb.unavailable` |
| `title-query.test.ts`, `title-merge.test.ts` | search by Enter only; two kinds merged by title, larger `totalPages`; a search/kind/sort change resets to page 1 |
| `title-units.test.ts`, `title-body.test.ts`, `title-draft.test.ts`, `season-edit.test.ts` | minutes to `runtimeMs`; comma lists; changed fields only; `null` clears; season add/remove/reorder |
| `titles-slice.test.ts`, `title-flows.test.ts`, `titles-paging.test.ts` | paging bounds (`This is the first page.`, `This is the last page.`); `Revert to TMDB` refused for manual; delete; `serial` drop; unreachable |
| `provider-bulk.test.ts`, `title-bulk.test.ts` | each verb's skip rules and reasons, the disabled reasons, the plan over mixed ticked rows (manual/synced/edited, enabled/disabled), a run through the shared runner with one forced failure; ticks dropped for rows that leave the page |
| `providers-markup.test.ts`, `titles-markup.test.ts` | New forms (rows in order, Family switching the Movie template row, Kind not switching anything), grids (headings, state words, dim, tick, `Delete`), the list heading controls, the workspaces' groups, a movie with no Seasons rail item, `Revert to TMDB` reasons, skeletons, `ChipsInput` for frame origins |
| `chips-input-markup.test.ts` (library) | the `className` reaches the chips box |

Plus `typecheck`, `lint`, `node scripts/check-rules.mjs`, clean.

## 7. Failure modes

- A stub left behind: any `ProvidersService` or `TitlesService` method still `backend.not_connected` blocks the exit (visible disabled control with `This is not connected to the admin backend yet.`).
- `PUT` partial semantics: absent keeps, `null` clears; the form must send `null` for an emptied optional field and nothing for an unchanged one.
- No TMDB token: Titles list is a skeleton plus one notice; creating a manual title still works; the worker does not fake rows.
- Two kinds on search is two requests: one failing keeps the other's rows and sets a notice.
- A late answer after sign-out or a new session is dropped (`serial`).
- A manual series can exceed 64 KiB: B3 lifted that to 256 KiB; a larger body is `request.invalid`.

## 8. Brief headings

1. **Where.** Worktree `D:\Projects\.giga-worktrees\admin-providers-titles`, branch `admin/providers-titles`, cut from `family-port` after Wave 3a. Owned: section 5. Off limits: `src/backend`, `src/frontend`, `src/fileserver`, other tabs' files, `store/app-store.ts`, `store/slices/*` except its two, `index-frames.ts`, `package.json`, `.env`, `docs/**`; the library only for `ChipsInput`.
2. **Rules.** As `36` section 11. 3. **Role.** Four commits per section 2; writes and runs tests; no browser or server; no doc edit.
4. **Read first.** `AGENTS.md`; `07` 6; `01`; this document; `35` (the pattern); `29` 5, 7, 9.2, 9.3; `26` 4.9a, 4.9b, 3.10; `28` 7.2, 7.3; the foundation files; the backend's `api/providers.ts`, `api/titles.ts`, `types/provider.ts`, `types/title-input.ts` read-only.
5. **Scope.** Section 5. 6. **Report.** `07` 6.4 and every gap filled.

## 9. The coordinator's acceptance

Temporary backend (`39` 9) with `TMDB_READ_TOKEN` unset (the Titles list then shows its skeleton and the notice; manual titles are still driven) and, for the synced behaviour, the backend's titles stubs (`TMDB_BASE` pointed at a local stub the backend tests already use, `test/title-stubs.ts`) - never the owner's token.
1. Providers: create (Embed needs the Movie template; Stream does not), edit every field, `Enabled` off and on (the row dims), frame origins (add, remove, a malformed one and a ninth refused inline), message shape, `Save` sends only changed fields by `PUT`, `null` clears; delete two-step; `Titles →`.
2. Titles: create a manual movie and a manual series (seasons editor), search by Enter, both chips and one chip (the last cannot switch off), every sort, `Older`/`Newer` bounds, edit and save, `Enabled`, `Revert to TMDB` disabled for manual with its reason, a synced stubbed title shows `edited` after a save and reverts, Sources read-only, delete two-step with its tooltip.
3. Both sizes, dark and light; console clean; every request carries `Authorization`; no storage; `Ctrl+F` focuses the search; records created are deleted; owner data untouched.

## 10. Doc against code: differences found (2026-10-17)

| # | Doc says | Code does |
|---|---|---|
| 1 | `29` 9.2 / `03` 7.2b: save is "PUT with a partial body" and `RecordService.update` reads like a PATCH | the route is `PUT`; the shared `RecordService` names it `update`, so the Providers service must send the method itself |
| 2 | `28` Wave 4 plans fixtures first | superseded; no `fixtures/providers.ts` or `titles.ts` exists |
| 3 | `29` 18 B2 "gap: Enabled cannot be written" | landed: `enabled` on create and update, `null` clears |
| 4 | `29` 9.3: the list returns `AdminTitleRow` with `editedFields` | the row schema in the foundation (`title-schema.ts`) has no `editedFields`; B5 puts it on the admin view, so the schema gains it |
| 5 | `28` 7.2: Titles search "carries `data-search`" | the shell key hook's `Ctrl+F` already looks for `data-search` (`lib/shell-actions.ts`); the field must set it |
| 6 | `29` 9.3 "with both Kind chips on, search makes two calls" | `GET /api/titles` already merges two kinds on the backend (`kind=all`); only search needs the admin to merge |
| 7 | `26` 4.9b: a manual row's id `custom-0001` | the backend id is `custom-<uuid>`; the tooltip shows the id as the backend gives it |
| 8 | `28` 7.2: Providers and Titles toolbars have only the forward verb | superseded (owner, 2026-10-17): bulk verbs on the ticked rows (3.2, 4.2) |
| 9 | `26` 3.10 rule 4: deleting a synced row really deletes it and the next sync adds it again | true of channels, and of titles until 2026-10-17 (no tombstone since `012`, so a synced title returned on a browse, search, detail read or sync). **Superseded for titles (owner, 2026-10-17):** a deleted synced title is recorded (`deleted_titles`, migration `020`) and stays deleted; `Deleted titles` restores it (4.2, 4.4) |
