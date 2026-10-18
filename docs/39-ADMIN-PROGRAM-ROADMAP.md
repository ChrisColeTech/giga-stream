# 39 - Admin program roadmap (the wired program, no fixture waves)

**Status: the program plan from 2026-10-17; it supersedes the wave order of `27`, `28` and `29`.** Owner: no fixture waves. Every tab is built directly
against the real backend routes through the service modules (the stubs of the foundation replaced by real calls); pages call typed service methods and
never hold fixture data; a service that is not wired surfaces as a visible refusal; a wave exits only when every control is really wired and verified.
Tabs run as parallel workers after Accounts, where their files do not overlap. This document holds the order, the file ownership that keeps parallel
workers from colliding, the progress table and the coordinator's acceptance method. The per-wave plans are `35` (Accounts), `36` (Channels and Preview),
`37` (Providers and Titles), `38` (Playlists and Jobs), `40` (password reset by security question); the sweep is section 8. The reference content of `26`, `28` and `29` (look, fields, copy, routes,
wire shapes, state persistence) still governs; only their fixture-first wave split is retired.

**Amended 2026-10-17 (owner):** "lets add some bulk actions when we select them. and add a password reset button to the login form. give them a real id number, not derived. optional playlist name is fine, but name should be in
the same order on each form for consistency." That adds the program rules of section 5.0, the shared bulk piece (section 6), two backend waves and the reset gate (section 7, `40`), and settles four open decisions (section 11).

**Amended again 2026-10-17 (owner, second round; supersedes the defaults written above where they differ):** (a) "id should be the id number we generate. create a sequence for the tables or something" and, corrected, **every** channel, account and title, synced and manual, gets a generated integer `idNumber` from a per-table sequence, existing rows numbered in creation order in migration `018`; the string keys stay (section 7.1). (b) "bulk delete should apply for manual and auto added": Titles bulk `Delete` covers manual and synced titles; the backend's real behaviour is stated in `37`. (c) "lets do security question instead of email for password reset": the reset is a security question with a hashed answer, with no email, no code and no Electron dialog (`40`, migration `019`). (d) 3a's Id column lands after B2 (section 2).

## 1. What has landed (verified in git, 2026-10-17)

| Piece | What | Where |
|---|---|---|
| Wave 0 | the backend: B1 per-account UI state (`017`, `GET`/`PUT /api/auth/me/state`), B2 provider `enabled` and `null` clears, B3 title body limit, B4 job outcome sentence and counts, B5 audit names and `editedFields`, B6 live-smoke port | `5749213`, `6432525`, `9045a8d` |
| Wave 1 | the shared library: `src/shared/ui`, `src/shared/http`, the pane engine, windows, shell | `d1aa570`, `51e2cec`, `6914728`, `4f21c11` |
| Wave 2 | the admin shell: titlebar, statusbar, Events drawer, Settings window, six tab pages (index skeleton), shared record pieces | `4aca5f8` |
| Wave 2a | the auth gate (`34`): the full-window wall, the form, the `AuthPort` seam | `487b934`, `a19845e` |
| **F** (foundation) | library `RecordGrid`, `RecordGridRow`, `SkeletonGrid`, `Checkbox`, pill `ChipGroup`; channel wire types and pure helpers; the request layer (`services/api.ts`, `session-api.ts`), the real auth port, the tokens in the session slice, zod schemas for every resource, `constants/api-sentences.ts`, the typed service modules (accounts real; channels, providers, titles, playlists, jobs, audit, account-state, health **not connected**), fixtures deleted | `6fcbeda`, `4386de2`, `07b60d7` on `admin/channels`, merging into `family-port` |

## 2. The order and the parallelism

```text
backend, independent (cut now):   B2 generated ids (018) --+    B3 security-question reset (019, after B2 merges) --+
F (landing) --> [B2 landed] --> 3a Accounts (35) --+--> 3b Channels + Preview (36) --+                   |
                                                   +--> 3c Providers + Titles (37) --+--> 4 Sweep (section 8) --> done
                                                   +--> 3d Playlists + Jobs (38) ----+                   |
                                                   +--> R reset gate (40) (needs 3a and B3) -------------+
```

- **B2 first, now.** The backend generates the integer `idNumber` for every channel, account and title from per-table sequences (section 7.1). It touches only `src/backend`, so it runs beside F and **must have landed before 3a is cut**: the Accounts `Id` column and row (`35`) show the generated number, so 3a's Id column lands after B2 and not before. 3b (Channels: no id sent on create, the number shown) and 3c (every title's `Id`) depend on it too.
  **B3** (security-question password reset, `40`) is also backend-only and independent of B2's tables; it takes migration `019` and so is merged after B2 (the numbers `018` and `019` must follow the order).
- **3a first, alone.** Accounts needs the shared record pieces (`StateWord`, `useRecordForm`), the per-tab slice registry and the stale registry (section 5), and now the **shared bulk piece** (section 6); every
  other wave needs those, so 3a lands them first. 3a also finishes the real session (the actor's id, the serial, the audit service wired).
- **R (the reset gate view)** is an admin-only wave that runs in parallel with 3b to 3d once 3a and B3 have landed; it owns the gate files, which no tab wave touches.
- **3b, 3c, 3d in parallel**, each cut from the same `family-port` commit after 3a. Their owned files do not overlap (section 4); the only shared files are the ones in section 5, which they do not edit.
  One cross-tab dependency: 3d's Playlist Status lists a playlist's channels through `channels.list()`; it works against the service interface and is **accepted after 3b has merged** (until then it shows a visible refusal). Landing order: 3a, 3b, 3c, 3d.
- **4 after all three**: it touches every tab's results (the audit sentences, the keyboard pass, the both-size sweep) and the shared files they must not edit.
- A wave never starts on a partial predecessor; the coordinator accepts each (section 9) before the next cut.

## 3. The waves

| Wave | What | Worker | Doc | Depends on | Status | Landed in |
|---|---|---|---|---|---|---|
| 0 | backend changes (B1 to B6) | B | `29` 18, 19 | nothing | Done | `5749213`, `6432525`, `9045a8d` |
| 1 | shared library | U1 to U4 | `27` | Wave 0 not needed | Done | `d1aa570`, `51e2cec`, `6914728`, `4f21c11` |
| 2 | admin shell and record pieces | A | `28` | Wave 1 | Done (visual acceptance of the fixture pages is moot; superseded) | `4aca5f8` |
| 2a | auth gate and form | A2 | `34` | Wave 2 | Done | `487b934`, `a19845e` |
| F | foundation: library pieces, request layer, real auth, schemas, service stubs | A | this document | Wave 2a | Landing (merging `admin/channels` into `family-port`) | `6fcbeda`, `4386de2`, `07b60d7` |
| B2 | backend: generated `idNumber` for every channel, account and title (migration `018`: per-table sequences, existing rows numbered in creation order; string keys unchanged) | B2 | this document, section 7.1 | nothing | Not started | |
| B3 | backend: password reset by security question (migration `019`: question and answer hash on accounts, the attempt table; `PUT /api/auth/me/security-question`, `reset-start`, `reset`) | B3 | `40` | B2 merged (migration order) | Not started | |
| 3a | real sign-in finished, the shared record pieces and the **bulk piece**, and the Accounts tab with its bulk verbs | A | `35` | F, B2 | Not started | |
| 3b | Channels and the Preview window, with bulk verbs | A | `36` | 3a, B2 | Not started | |
| 3c | Providers and Titles, with bulk verbs | A | `37` | 3a, B2 | Not started | |
| 3d | Playlists and Jobs, with bulk verbs | A | `38` | 3a (and 3b for one acceptance row) | Not started | |
| R | the reset views in the gate (`Forgot password?`, email, question, answer) and Settings > Account (the security question) | A | `40` | 3a, B3 | Not started | |
| 4 | sweep: account state, About, README, no-fixtures, accessibility, both sizes, build and serve | A | this document, section 8 | 3a to 3d, R | Not started | |

Retired by this program: `28` Waves 3 to 6 and `29` Waves 7 to 10 as written (their content is split across `35` to `38` and Wave 4).

## 4. File ownership per worker

Paths under `src/admin/src/` unless marked. A worker edits only its row; anything else it needs is reported and the coordinator decides.

| Worker | Owns (create and edit) |
|---|---|
| 3a | `store/session-slice.ts`, `store/audit-slice.ts`, `store/app-store.ts`, `store/selectors.ts`, `store/slices/*` (all six placeholders, the registry, `stale.ts`), `store/accounts-slice.ts`; `types/auth.ts`, `types/admin-account.ts`; `services/accounts.ts`, `audit.ts`, `account-flows.ts`, `account-password-flow.ts`, `schemas/account-schema.ts`, `schemas/audit-schema.ts`; `components/accounts/*`, `components/session/SessionState.tsx`, `components/records/StateWord.tsx`, `hooks/useRecordForm.ts`, `hooks/useAccountsLoad.ts`, `useAccountActions.ts`, `useAuditTail.ts`; `lib/account-*.ts`, `lib/audit-merge.ts`, `lib/format-when.ts`, `lib/event-sentence.ts`; `components/chrome/AppShell.tsx`, `AdminEventsDrawer.tsx`; `constants/account-*.ts`; `pages/AccountsPage.tsx`; `src/shared/http/src/api-error.ts`, `create-api.ts` |
| 3b | `store/channels-slice.ts`, `store/slices/channels.ts`; `services/channels.ts`, `channel-flows.ts`, `preview-player.ts`, `schemas/channel-schema.ts`; `components/channels/*`, `components/records/FolderRow.tsx`, `VideoList.tsx`; `components/overlays/OverlayHost.tsx`, `types/overlays.ts`; `hooks/useChannelsLoad.ts`, `useChannelActions.ts`, `usePreviewSession.ts`, `usePreviewPlayer.ts`; `lib/channel-*.ts`, `preview-*.ts`, `video-order.ts`; `constants/channel-*.ts`, `preview-copy.ts`; `pages/ChannelsPage.tsx` |
| 3c | `store/providers-slice.ts`, `titles-slice.ts`, `store/slices/providers.ts`, `titles.ts`; `services/providers.ts`, `titles.ts`, `provider-flows.ts`, `title-flows.ts`, `schemas/provider-schema.ts`, `title-schema.ts`; `components/providers/*`, `components/titles/*`, `components/records/SeasonList.tsx`; `hooks/useProviders*.ts`, `useTitle*.ts`; `lib/provider-*.ts`, `title-*.ts`, `season-edit.ts`; `constants/provider-*.ts`, `title-*.ts`; `pages/ProvidersPage.tsx`, `TitlesPage.tsx`; library: `src/shared/ui/src/controls/ChipsInput.tsx` and its test |
| 3d | `store/playlists-slice.ts`, `jobs-slice.ts`, `store/slices/playlists.ts`, `jobs.ts`; `services/playlists.ts`, `jobs.ts`, `playlist-flows.ts`, `job-flows.ts`, `job-run-queue.ts`, `schemas/playlist-schema.ts`, `job-schema.ts`; `components/playlists/*`, `components/jobs/*`; `hooks/usePlaylists*.ts`, `useJob*.ts`; `lib/playlist-*.ts`, `job-*.ts`; `constants/playlist-*.ts`, `job-*.ts`; `pages/PlaylistsPage.tsx`, `JobsPage.tsx` |
| 4 | `services/health.ts`, `account-state.ts`, `schemas/health-schema.ts`, `account-state-schema.ts`; `store/ui-state-slice.ts`; `hooks/useAccountHydration.ts`, `useShellWriteback.ts`, `useSettingsWriteback.ts`; `components/session/SessionState.tsx` (adds the hooks); `components/settings/*`; `lib/account-state-map.ts`; `lib/event-sentence.ts`; `README.md`; `vite.config.mts`; `src/shared/http` (the root-path option); `test/no-fixtures.test.ts`; any file for the a11y and keyboard pass |
| 3a (added) | the bulk piece: `lib/bulk-plan.ts`, `lib/bulk-run.ts`, `hooks/useBulkAction.ts`, `components/records/BulkReport.tsx`; the additive edits to `components/records/IndexToolbar.tsx`, `lib/index-verbs.ts`, `store/work-slice.ts`, `lib/running-work.ts`, `components/chrome/AdminStatusbar.tsx` (`N working`) and, in the library, `src/shared/ui/src/shell/ToolbarStrip.tsx` (an armed two-step verb) with its test |
| B2 | `src/backend/**` for ids: `store/migrations/018-id-numbers.sql`, `store/id-sequence.ts`, `store/title-repository.ts` (the first-insert take), `store/account-repository.ts`, the channel create in `services/channel-service.ts` and `types/channel-input.ts` (optional live id), `services/account-service.ts`, `services/title-records.ts`, `services/title-sync.ts`, `services/title-list-cache.ts`, `services/title-reads.ts`, the answer types and views, `test/id-numbers*.test.ts`. **Not** the fileserver's title store (section 7.1) |
| B3 | `src/backend/**` for the security-question reset: `store/migrations/019-security-questions.sql`, `store/reset-attempts-repository.ts`, `store/account-repository.ts` (the two fields), `constants/security-questions.ts`, `services/security-question-service.ts`, `api/auth-security.ts`, `types/account.ts` (schemas, `securityQuestionSet`), `constants/errors.ts` (`auth.reset_invalid`), `services/service-registry.ts`, `app.ts` (register), tests (`40` section 3.4). No Electron, no tray, no sink |
| R | `components/session/*` (gate: `ForgotLink`, `ResetEmailForm`, `ResetAnswerForm`), `pages/SignInPage.tsx`, `lib/gate-state.ts` (untouched), `lib/reset-state.ts`, `constants/sign-in-copy.ts`, `constants/reset-copy.ts`, `constants/security-questions.ts`, `services/auth-port.ts`, `services/security-question.ts`, `types/auth.ts`, `hooks/useReset*.ts`, `lib/auth-errors.ts`, `constants/api-sentences.ts` (the reset sentence), `constants/settings-sections.ts` and `components/settings/SecurityQuestionSection.tsx` (the Settings > Account page: **R owns these; Wave 4 does not touch them**), tests (`40` section 4.5) |
| coordinator | root `package.json` (`dev`, `kill-ports`, `admin:build`), `scripts/**`, `AGENTS.md`, `docs/**`, every `.env`, the merges |

**Frozen after F** (nobody edits them in 3a to 3d; a need is reported): `services/session-api.ts`, `services/api.ts`, `services/auth-port.ts`, `services/service-types.ts`, `services/not-connected.ts`, `constants/api-sentences.ts`, `lib/field-checks.ts`, `lib/row-state.ts`, `lib/auth-errors.ts`, `constants/index-frames.ts`, `constants/record-copy.ts`, `store/workspace-slice.ts`, `store/work-slice.ts`, `store/panes-slice.ts`, `lib/running-work.ts`, `components/records/{ListGroup,NewRecordGroup,RecordRail,WorkspaceToolbar}.tsx` (and `IndexToolbar.tsx`, `ToolbarStrip.tsx`, `work-slice.ts` after 3a's additive bulk edits), `components/chrome/{AdminTitlebar,AdminStatusbar,WorkspaceFrame,TabPage}.tsx`, `src/shared/ui` except the named additive ones. A new error code's sentence is added to `api-sentences.ts` by the coordinator at merge.

## 5. Program rules and the collision plan

### 5.0 Program rules (owner, 2026-10-17; they bind every tab doc, and amend `28` 7.3 without rewriting it)

1. **Name first.** On every New form and every Details group the order is: the record's **Name** first; then the kind / type / family switch where there is one; then the record's own fields; then the optional ones; then the read-only facts, with **`Id`** last.
   New account is `Name`, `Email`, `Password`; New channel `Name`, `Kind`, `Number`, `Category`, `Folder` or `Stream address`; New provider `Name`, `Family`, `Source`, `Movie template`; New title `Title` (its name), `Kind`, `Year`; New playlist `Name` (optional, still first), `Address`;
   New job `Name`, `Type`, then its target. `28` 7.3's table lists Email before Name for an account; that line is superseded.
2. **Every record shows a real id number.** A list has an `id` column (mono, first) and Details a read-only `Id` row (last). Providers, playlists and jobs show their existing integer `id`; **channels, accounts and every title (synced and manual) show the generated `idNumber`**, from a per-table sequence, never reused (section 7.1). A synced title's TMDB id is shown in its own row, never as its Id. The admin derives no id.
3. **Ticks arm bulk verbs.** Every list's toolbar carries bulk verbs on the ticked rows, through the one shared piece of section 6; a verb that cannot run is disabled with its reason as a tooltip (`Button reason`), never `aria-disabled`.

### 5.1 The collision plan (shared files)

The shared surface of the app is the store and a few lists of constants. The plan removes it before the parallel waves start:

1. **One additive registry, built by 3a.** `store/slices/index.ts` is the only place `app-store.ts` reads tab state from: `export type TabSlices = ChannelsSlice & ProvidersSlice & TitlesSlice & PlaylistsSlice & JobsSlice & AccountsSlice` and
   `export function tabSlices(set, get): TabSlices`. 3a creates **six files**, `store/slices/{channels,providers,titles,playlists,jobs,accounts}.ts`, each exporting its slice type and factory. The five tabs not yet built are **placeholders**:
   an empty slice interface and a factory that returns `{}`. 3a writes the accounts one for real. `app-store.ts` spreads `tabSlices(set, get)` once. From then on each parallel worker replaces **only its own** `store/slices/<tab>.ts` (re-exporting its `store/<tab>-slice.ts`) and never opens `app-store.ts`, the registry or another tab's file. Result: no two workers edit the same line.
2. **One stale registry** (`store/slices/stale.ts`, 3a): `stale: Record<Tab, boolean>` and `markStale(tab)` / `clearStale(tab)`. A flow that changes another tab's data (deleting a playlist removes its jobs and detaches its channels) calls `markStale`; the other tab's load hook re-reads when it is next shown. No worker writes another tab's slice.
3. **Per-tab check files.** `lib/field-checks.ts` stays frozen; each tab puts its rules in `lib/<tab>-checks.ts` importing its primitives. Copy lives in `constants/<tab>-copy.ts`; the shared `record-copy.ts` is frozen.
4. **One owner per cross-cutting file:** `OverlayHost.tsx` and `types/overlays.ts` are 3b's (the `preview` flow); `ChipsInput.tsx` is 3c's; `AppShell.tsx`, `AdminEventsDrawer.tsx`, `event-sentence.ts` are 3a's, then 4's; `README.md`, `vite.config.mts`, `OverlayHost` bounds persistence are 4's.
5. **Tests:** a worker adds new files under `test/` and `test/support/`; it never edits another wave's test or a shared support file (`fake-backend.ts`, `store.ts`); a support need is a new file `test/support/<tab>-*.ts`.
6. **Services:** a worker may widen its own service interface additively (`run(id, override?)`, `detail`), never `service-types.ts`.
7. **Merging.** The coordinator merges in landing order (B2, B3, 3a, 3b, 3c, 3d, R, 4; B2 before B3 because of the migration numbers `018` and `019`). Every worker's branch is cut from the same `family-port` commit and never rebases. Expected conflicts: none. If git reports one, the coordinator resolves it only in a registry or test-support file, records it in the merge commit, and sends any conflict inside a worker's own files back to that worker with the exact output (`07` 6.5, step 4). After each merge the coordinator runs `node scripts/check/gate.mjs` before cutting or accepting the next.
8. **Backend and package files:** only the backend workers B2 and B3 edit `src/backend` (their rows in section 4); no admin worker edits it, and nobody edits root `package.json`, `scripts/**` or any `.env`.
9. **The shared bulk piece** (section 6) is 3a's and frozen after it lands; 3b to 3d add only their own `lib/<tab>-bulk.ts` and pass it to `useBulkAction`.

## 6. The shared bulk piece (built by 3a, consumed by 3b to 3d)

**Decision.** No new backend bulk endpoint: the code has none and needs none (every record has its single-record routes). The client runs the single-record calls, one after another, through one shared hook. A bulk verb is a pure plan plus a runner:

```ts
// lib/bulk-plan.ts (pure, no React, no services)
interface BulkVerb<Item> {
  readonly id: string;                         // "disable"
  readonly label: string;                      // "Disable"
  readonly summary: (n: number) => string;     // "Disabled 3 accounts"
  readonly eligible: (item: Item, ctx: BulkContext) => string | undefined;   // a reason to SKIP this row; undefined = run it
  readonly allSkipped: string;                 // the verb's disabled reason when no row can run and no row gave one
}
interface BulkPlan<Item> { readonly run: readonly Item[]; readonly skipped: readonly { item: Item; reason: string }[]; readonly reason: string | undefined }
planBulk<Item>(ticked: readonly Item[], verb: BulkVerb<Item>, ctx: BulkContext): BulkPlan<Item>
//   reason = "Tick a row first" when nothing is ticked; else, when run is empty, the first skipped reason (or verb.allSkipped); else undefined.
//   ctx carries what a rule needs (the signed-in account id, the whole list): a rule that depends on the others (keep one account enabled) sees the plan so far through ctx.

// lib/bulk-run.ts (pure of React; callbacks injected)
interface BulkFailure<Item> { readonly item: Item; readonly sentence: string }
interface BulkResult<Item> { readonly done: readonly Item[]; readonly failed: readonly BulkFailure<Item>[]; readonly aborted: boolean }
runBulk<Item>(opts: {
  items: readonly Item[];
  run: (item: Item) => Promise<void>;          // the single-record call; rejects with an ApiError
  isCurrent: () => boolean;                    // false (a new sign-in, a sign-out) stops the run: aborted = true
  onProgress: (done: number, total: number) => void;
}): Promise<BulkResult<Item>>
//   strictly sequential; a rejection is recorded with its sentence (ApiError.message) and the next item runs; never throws.
bulkSummary(verb, plan, result): string       // "Disabled 3 of 4 accounts; 1 failed; 1 skipped."

// hooks/useBulkAction.ts
useBulkAction<Item>(opts: {
  noun: { one: string; many: string };         // "account" / "accounts"
  idOf: (item: Item) => string | number;
  labelOf: (item: Item) => string;             // for the per-row failure list
  reload: () => Promise<void>;                 // re-reads the tab's list ONCE at the end
  keepTicked: (ids: readonly (string | number)[]) => void;   // the slice's ticked ids after a run
}): {
  start(verb: BulkVerb<Item>, plan: BulkPlan<Item>, run: (item: Item) => Promise<void>): Promise<void>;
  working: boolean;
  progress: { done: number; total: number } | null;
  report: { failed: BulkFailure<Item>[]; skipped: { item: Item; reason: string }[] } | null;
  dismiss(): void;
}
```

**Behaviour (the same on every tab).**
1. The toolbar's bulk verbs are always drawn beside the forward verb; each is disabled with `plan.reason` as its tooltip (`Tick a row first` until a row is ticked). A destructive verb (`Delete`) is a **two-step toolbar verb**: the first press turns its label into `Delete N <noun>?` and arms it for 4 s, blur or `Escape` disarms, the second press runs it (`ToolbarStrip` gains an additive `armed` field; it uses the library's `useArmedAction`).
2. `start` records the session `serial`, sets `work.working` to the number of rows to run (the statusbar reads `N working` over the pulsing bar, beside `N preparing` / `N syncing`), then `runBulk`s the eligible rows. One failure never stops the rest. Each outcome is classified once: done, failed (with its sentence), or skipped before the run (with its reason).
3. At the end: one `say` summary on the notice line (`warn` when anything failed, else `info`), `reload()` exactly once, `work.working` back to zero, succeeded rows unticked, **failed and skipped rows stay ticked** (`keepTicked`).
4. `BulkReport` (a small component, `components/records/BulkReport.tsx`) draws under the toolbar only while `report` has failed or skipped rows: one line per row, `<label>: <sentence>`, with a `Dismiss` ghost button; it is content, not an empty state, and it disappears on `dismiss` or the next run.
5. A run that meets a changed `serial` (sign-out, a new session) stops with `aborted` and writes nothing to the store. While `working`, every bulk verb and the New form's `Create` of that tab are disabled with `Working.`.
6. The statusbar `Stop` stays disabled: no route stops a record call; the in-flight call finishes, the rest are not started only if the session ended.

**Tests (written and run by 3a, `src/admin/test`):** `bulk-plan.test.ts` (reason priority: nothing ticked, all skipped, first skipped reason; a rule that sees earlier plan rows), `bulk-run.test.ts` (strict order; a failure does not stop the rest; progress callbacks; `isCurrent` false aborts and reports `aborted`; never throws; the sentence is the `ApiError` message), `bulk-summary.test.ts` (the sentence for done/failed/skipped combinations), `bulk-report-markup.test.ts` (rows, `Dismiss`, absent when empty), `bulk-work.test.ts` (`working` set and cleared; `N working` readout), `toolbar-armed-markup.test.ts` in `src/shared/ui/test` (rest label, armed label, disarm on blur, reason wrapper unchanged). Each tab adds `<tab>-bulk.test.ts` for its rules.

## 7. Backend waves B2 (real ids) and B3 (password reset)

### 7.1 B2 - real id numbers (owner: "give them a real id number, not derived")

**What the code has (read, 2026-10-17).** Providers, playlists and jobs have `INTEGER PRIMARY KEY AUTOINCREMENT` ids (never reused). Channels have a `TEXT` id (a stream row `ch_<uuid>`, a live row the kebab-case string the caller sends, required on create);
accounts `acct_<uuid>`; titles `movie-603` / `tv-1399` for synced rows and `custom-<uuid>` for manual ones. The fileserver and players read the channel's string id (`/live/<id>/master.m3u8`, `/logos/<id>.png`, `channel_videos.channel_id`, `GET /api/channels`).

**Rule (uniform, owner 2026-10-17, second round: "I said a few responses back we should be generating ids").** Every record the admin lists carries a **generated integer `idNumber`** from a per-table sequence: channels (stream and live), accounts, and **every title, synced (TMDB) and manual alike**. A number is assigned on insert, never reused, never renumbered, and never derived from a string or from TMDB. Providers, playlists and jobs keep their existing integer `id` (`AUTOINCREMENT`, unchanged). **The string keys stay exactly as they are**: channel `ch_<uuid>` or `live-<n>`, account `acct_<uuid>`, title `movie-603` / `tv-1399` (synced) and `custom-<uuid>` (manual). The fileserver's title cache, `watch_entries.item_id`, `favorites` and `collection_items` keep referencing those strings; nothing in the fileserver changes.

**The one open choice (not in this plan, for the owner later):** whether the generated `idNumber` should eventually **replace the string key everywhere**. That would rewrite fileserver watch history, favourites and collections, and the title ids in every stored reference, so it is a separate migration with its own plan. Until then the number is the displayed Id and the string is the key.

**Two title stores (the workers must touch the right one).**
- **The backend's catalogue**: the backend `titles` table (`src/backend/src/store/migrations/004-titles.sql`, rebuilt by `009-title-records.sql`), with `origin` `tmdb` or `manual`, its `store/title-repository.ts`, and the sync, the list cache and the title records that write it (`services/title-sync.ts`, `title-list-cache.ts`, `title-reads.ts`, `title-records.ts`). **B2 changes this store.** The admin reads it through `/api/titles*`.
- **The fileserver's cache**: the fileserver `titles` table (`src/fileserver/src/store/migrations/001-init.sql`, "normalized provider/admin title cache"), read by the fileserver's `services/admin-titles.ts` and `titles-service.ts`, and referenced by `watch_entries`, `favorites` and `collection_items`. **B2 does not change this store.** B2 checks only that the fileserver's title reads ignore the new `idNumber` field.

**Backend change (worker B2; `src/backend` only; migration `018-id-numbers.sql`).**

The mechanics, in order, inside the one migration transaction:
1. `CREATE TABLE id_sequences (name TEXT PRIMARY KEY, next INTEGER NOT NULL CHECK (next >= 1))`. SQLite has no sequence objects, so each table's sequence is a row here. Rows are `channels`, `accounts` and `titles`. (A table-level `AUTOINCREMENT` cannot be added to an existing table, and its numbers would be the rowid, which the owner does not want to tie to storage.)
2. `ALTER TABLE channels ADD COLUMN id_number INTEGER`, the same on `admin_accounts` and on `titles`. Nullable, because `ALTER` cannot add a `UNIQUE NOT NULL` column to a populated table; the application always fills it.
3. **Backfill, every existing row, in creation order** (one statement per table):
   - channels: `UPDATE channels SET id_number = (SELECT n FROM (SELECT rowid AS rid, ROW_NUMBER() OVER (ORDER BY created_at, rowid) AS n FROM channels) r WHERE r.rid = channels.rowid);`
   - admin_accounts: the same with `admin_accounts` (`created_at`, then `rowid`).
   - titles: the same ordered by `rowid` alone, because the table keeps no creation time (the 009 rebuild copied the rows in their old rowid order, and every later row gets a larger rowid). Synced and manual titles are numbered together in that order; the order is the only one the store knows, so it is stated, not improved on.
4. `INSERT INTO id_sequences (name, next) VALUES ('channels', COALESCE((SELECT MAX(id_number) FROM channels), 0) + 1), ('accounts', COALESCE((SELECT MAX(id_number) FROM admin_accounts), 0) + 1), ('titles', COALESCE((SELECT MAX(id_number) FROM titles), 0) + 1);` The counter starts **above the largest number already given**, so nothing collides.
5. `CREATE UNIQUE INDEX channels_id_number ON channels (id_number) WHERE id_number IS NOT NULL;` and the same for `admin_accounts` and `titles`.

Runtime (`store/id-sequence.ts`, SQL only under `store/`): `take(name)` reads `next`, writes `next + 1` and returns the value read, inside the insert's transaction. The counter only goes up: a deleted row's number is never given again, and a row re-created later (a synced title the sync brings back, a synced channel the next sync re-creates) takes a **new** number. The Delete tooltips already say a synced row returns; they now say it returns with a new Id.

Where `take` is called: a channel create (stream and live, `channel-service.ts`), an account create (`account-service.ts`), a manual title create (`title-records.ts`), and **the first insert** of a title row in `store/title-repository.ts` `put` (a synced title from the sync, the list cache or a detail read). An update keeps its number. A synced title's number is therefore its sequence number, **not** its TMDB id.
- Channel create: `id` becomes **optional** on a live channel (`types/channel-input.ts`); absent, the backend assigns the string id `live-<idNumber>` (kebab-case, within `LIVE_ID_MAX`); a caller-supplied id (scripts, the seeded test channels, tests) is still validated and kept. Stream rows keep `ch_<uuid>`. The admin sends no id.
- Answers gain `idNumber: number` on `BackendChannel` (admin and public reads), `AdminAccount`, and **every** `AdminTitleRow` (synced and manual; the title list, detail and writes). Additive: the fileserver's channel schema is non-strict (no `.strict()` in `live-view.ts` or `live-channels-service.ts`); B2 checks that the fileserver's title reads ignore the new field, and the gate runs its tests.
- Tests (`test/id-numbers.test.ts`, `id-numbers-migration.test.ts`; written and run by B2): the migration fills a 017 database in creation order for channels, accounts and titles (titles by rowid); the counters start at max + 1; `user_version` is at least 18; a create of each kind takes the next number; a delete then a create never reuses a number; a synced title first inserted by a sync gets a number and an update keeps it; a title re-inserted after a delete takes a new number; two creates in one transaction differ; a live create without an id gets `live-<n>` and one with an id keeps it; the answers carry `idNumber`; the public `GET /api/channels` and `/api/titles` carry it; the fileserver's title reads still pass a title with the new field; the newer-schema rule still refuses an older binary.
- Effects: `36` (channels: the `id` column and `Id` row show `idNumber`), `35` (accounts), `37` (every title's `Id`), `38` (none: playlists and jobs keep their ids), `29` section 5 (shapes), the fileserver (no table change, no read change).

**The title Id, decided (owner, second round):** every title shows its generated `idNumber` as `Id`, on every title list and in Details, read-only. A synced title's TMDB id is still `tmdbId` and is shown in its own row ("TMDB id"), never as the Id. The earlier judgement "a synced title's Id is its TMDB id" is withdrawn.

### 7.2 B3 - security-question password reset

`40` is the whole plan (backend worker B3 and the gate view R). It replaces the earlier email and local-code design in full: there is no email, no reset code, no console sink, no Electron dialog and no tray action. B3 adds, in migration `019-security-questions.sql`: a security question (a picklist number) and a scrypt hash of its normalised answer on `admin_accounts`, and a `reset_attempts` table keyed by the normalised email (so an unknown email locks the same way). Routes: `PUT /api/auth/me/security-question` (signed in, own account, current password required), `POST /api/auth/reset-start` (answers the account's question, or a stable decoy question for any other email) and `POST /api/auth/reset` (one `auth.reset_invalid` for every failure; five wrong answers lock the email for 15 minutes; success replaces the password, revokes every session and clears the lockout). B3 does not touch the title or channel stores and is merged after B2 (`019` follows `018`).

## 8. Wave 4 - the sweep (one worker, after 3a to 3d and R)

Scope, in this order (one commit each):

1. **Account state** (`29` 12.2, the routes exist: Wave 0 B1): `services/account-state.ts` real, `services/schemas/account-state-schema.ts` (strict out, tolerant per part in), `lib/account-state-map.ts`, `store/ui-state-slice.ts`, `hooks/useAccountHydration.ts`, `useShellWriteback.ts`, `useSettingsWriteback.ts`, added to `SessionState`; the 1.5 s reveal fallback and the 400 ms shell debounce are the only two timers (`29` 12.2); the source-scan test names those two hook files. The window bounds `OverlayHost` already holds go through `rememberChild`.
2. **About and health** (`29` 12.1): `services/health.ts` real. `createApi` accepts only `/api/` paths, so `@giga/http` gains an additive `rootPaths` option (`["/healthz"]`) and `vite.config.mts` proxies `/healthz` (and `/admin` stays the backend's). About shows the app version (`__ADMIN_VERSION__`), the backend's version and revision, the address, `TMDB: configured / absent`, the runtime (`Electron` or `Browser`); unread facts draw shimmer lines.
3. **The Events drawer on the real audit log** is wired in 3a (`35` section 5.7); here the sweep checks every area's sentence against real entries from 3b to 3d (names from the held lists, `29` 11) and extends `lib/event-sentence.ts` for any action seen; `Clear` is on-screen only, the 200-row cap.
4. **README and the no-fixtures scan:** `src/admin/README.md` corrected; `test/no-fixtures.test.ts` (no `fixtures/` import, no `not_connected` service left, no `aria-disabled`, no placeholder, no storage, `setTimeout` only in the two named hooks, `fetch` only in `services/api.ts`).
5. **Accessibility and keyboard pass:** `Tab` order skips a closed pane; `Escape` closes the drawer then a window; `Ctrl+1` to `Ctrl+6`, `Ctrl+,`, `Ctrl+0`, `Ctrl+F` on Titles; every control labelled; every disabled control carries its reason; focus returns to the opener of every window; no horizontal page scroll at 900.
6. **Build and serve** (`29` 14): `npm run build --prefix src/admin` then the backend serves `/admin/` (a reload on a deep path opens the app; `assets/` immutable); the coordinator's root edits from `29` 22 (`dev`, `kill-ports` with 5172, `admin:build`, `ELECTRON_HOMES` for `src/backend/src/app/`, the docs listed there).

Exit: the six checks pass, a full pass of all six tabs at both sizes (section 9), the gate and the live smoke pass, `npm run dist:win` run (the installer holds the fileserver and the interface only; say so).

## 9. The coordinator's acceptance method (every wave)

**Automated.** After each merge: `node scripts/check/gate.mjs` (typecheck, lint, rule checker, every program's tests on free ports and temporary `DATA_DIR`s) must print `gate: PASS`.

**The real wire, on a temporary backend.** The coordinator starts a fresh backend per drive, never the owner's: `PORT` a free port (distinct per wave: 8391 for 3a, 8392 for 3b, 8393 for 3c, 8394 for 3d, 8395 for 4, 8396 for B2, 8397 for B3 and R; never 8090, 8091, 8190, 8191, 3001, 5171, 5172, 5271, 5272, 9222, 9223), `DATA_DIR` an empty folder under `%TEMP%`, a throwaway `JWT_SECRET`, a **test bootstrap owner** (`ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`; the constants of `35` section 3.3), `ADMIN_DIST` the landed tree's `src/admin/dist` built with `npm run build --prefix src/admin`, the variables in the process environment and **no `--env-file`** (the owner's `src/backend/.env` is never loaded: `config.ts` reads `process.env` only and `DATA_DIR` otherwise defaults to the owner's `~\.giga-stream-admin`). It is launched detached through `Win32_Process.Create` (`07` 4) with the PID kept, checked (`GET /healthz`, `admin.db` in the temp folder, the owner's data folder's timestamps unchanged), and stopped by PID. Per wave, extra throwaways: the fixture videos of `scripts/fixtures` for 3b; the backend's local TMDB stub (`TMDB_BASE`) and no token for 3c; `ALLOW_LOOPBACK_STREAMS` with a throwaway static playlist server for 3d.

**Visual.** The real built admin in the connected Chrome (`http://127.0.0.1:<port>/admin/`) at **1600 x 1000** and **900 x 640**, dark and light, each touched surface compared with the interface's equivalent screen (the Collections window for the pattern, Settings for the window) and the mockup (`D:\Projects\giga-stream-poc\src\admin-mockup`, served only with the owner's say) for content; measured, not eyeballed: heights (titlebar 40, statusbar 24, toolbar 40, form row 36, grid row 36, drawer 160), one label column per page, the six New forms the same shape. A page-level recorder (a `fetch` wrapper in the page, outside the repository, never writing to the server) proves every `/api` request but login and refresh carries `Authorization`; `localStorage`, `sessionStorage`, cookies and IndexedDB are empty before and after; the console is clean. A skeleton wears no sentence; state is a word, never a dot; a control is wired or disabled with its reason.
**The Electron windows.** The backend's own window (debug port 9223) and the desktop app's (9222) are looked at on the owner's real stack for UI state only (the gate, the shell, `Choose` opening its dialog and being cancelled); nothing is written to the owner's data and no sign-in is attempted on the owner's backend. The caption strip follows a theme switch. A drive that must write (every create, save and delete) runs on the temporary backend, in Chrome.
**Cleanup.** Every `zz-drive-*` record is removed, the temp backend stopped by PID, its folder deleted, the owner's data confirmed untouched; the result and anything unverified are reported as they ran. After a wave the coordinator runs `npm run dist:win` and states that the admin and the backend are not in the installer (`07` 6.5).

## 10. The worker brief headings (every wave, `07` 6.2)

1. **Where** - worktree `D:\Projects\.giga-worktrees\<name>`, branch, base commit, owned paths (section 4), off limits. 2. **Rules** - `AGENTS.md`, `07`, `01`, the wave's doc, the owner's rules (no fixture, no fake feature, skeletons not sentences, no storage, no timers outside the two named, files at most 200 lines, never print a secret). 3. **Role** - what it does and does not do; writes AND runs its fast unit tests, the typecheck, the lint and `node scripts/check-rules.mjs`; starts no server or browser; edits no doc; commits on its branch, never pushes or merges. 4. **Read first** - the wave's doc and the sections it names, then the source files. 5. **Scope** - file by file; out of scope. 6. **Report** - `07` 6.4 plus every gap filled and every signature that differed.

| Wave | Worktree | Branch | Cut from |
|---|---|---|---|
| B2 | `backend-ids` | `backend/ids` | `family-port` now (backend only) |
| B3 | `backend-reset` | `backend/reset` | `family-port` after B2 merges |
| 3a | `admin-accounts` | `admin/accounts` | `family-port` after F and B2 |
| 3b | `admin-channels-tab` | `admin/channels-tab` | `family-port` after 3a |
| 3c | `admin-providers-titles` | `admin/providers-titles` | `family-port` after 3a |
| 3d | `admin-playlists-jobs` | `admin/playlists-jobs` | `family-port` after 3a |
| R | `admin-reset-gate` | `admin/reset-gate` | `family-port` after 3a and B3 |
| 4 | `admin-sweep` | `admin/sweep` | `family-port` after 3d and R |

The two backend workers follow `07` 6.1 (one worker per real sub-project, the admin backend): B2 and B3 are separate only because they are independent and ordered by migration number; either brief says the same rules apply (tests written AND run, fast, temporary `DATA_DIR`).

## 11. Open decisions for the owner

Settled by the owner's 2026-10-17 answers (struck from the defaults): ticks now arm bulk verbs (was decision 1); a channel's id is a real backend-assigned number (was 2); a playlist's Name is optional and Name is first on every form (was 3).

| # | Decision | Default taken |
|---|---|---|
| 1 | ~~Ticks only select~~ | **settled:** bulk verbs (section 6) |
| 2 | ~~Channel id derived~~ | **settled:** a real `idNumber` (section 7.1) |
| 3 | ~~Playlist Name required~~ | **settled:** optional, still first (section 5.0) |
| 4 | `07` 6.3 says a worker does not run the suite; this program has workers write AND run their fast tests | run them; amend `07` 6.3 |
| 5 | ~~No password-reset path~~ | **settled (second round):** a security question with a hashed answer, set while signed in; no email, no code (`40`) |
| 6 | The stale `PORT=3001` line in `src/backend/.env` | the coordinator backs up and removes it (`35` 3.2) |
| 7 | `npm run dev` replaces the headless backend with the backend's Electron window (`29` 14) | replace, in Wave 4 |
| 8 | The sweep's account-state persistence comes last | last: it changes nothing a tab needs to be usable |
| 9 | ~~A synced title's `Id` is its TMDB id~~ | **settled (second round, owner: "I said a few responses back we should be generating ids"):** every title, synced and manual, shows its generated `idNumber` as `Id`; the TMDB id is its own row (section 7.1) |
| 10 | Bulk `Delete` on Titles removes manual titles only | **settled (second round, owner: "bulk delete should apply for manual and auto added"):** manual and synced; a synced title comes back on the next catalog sync or browse that lists it; the summary says so (`37`) |
| 12 | Whether the generated number should later replace the string key everywhere (rewrites fileserver watch history, favourites and collections) | **open, not in this plan** (section 7.1); the string key stays until the owner asks for that migration |
| 13 | The reset's answers: a fixed picklist of eight questions; a question-less account gets a generic reason; accounts start without a question | as stated (`40` section 7); the owner may overrule |
| 11 | Bulk `Disable` / `Delete` on Accounts skips the signed-in account and keeps one account enabled | as stated (`35` 5.10) |

## 12. Doc against code: differences found (2026-10-17)

| # | Doc says | Code does |
|---|---|---|
| 1 | `27` and `28` list Wave 3 as "In progress (`admin/channels`)" with fixtures | the branch landed only the foundation (library pieces, helpers, request layer, services); no channel page, fixture or `StateWord` exists there |
| 2 | `28` progress table: Wave 2 created `useRecordForm`, `useFixtureLoad` | neither file exists in the tree |
| 3 | `29` 7: `services/api.ts` adapts `createApi` with a retry hook | built as `session-api.ts` (the logic, pure) plus `api.ts` (the store wiring); `createApi` has no retry hook and none was added |
| 4 | `01` 6: the store holds no promise and does no I/O | the foundation's `store/audit-slice.ts` awaits `audit.list` inside slice actions; `35` moves that into a hook |
| 5 | `34` 5: the gate maps four codes | `lib/auth-errors.ts` maps any other 4xx to `invalid` and any 5xx or unreadable answer to `unreachable` |
| 6 | `07` 6.3: workers do not run tests | this program asks them to (decision 4) |
| 7 | `29` 14 and 22: the `npm run dev` stack change and the check-rules edit are "when this lands" | not applied; they are the coordinator's, in Wave 4 |
| 8 | `37`/`38`: the foundation's `RecordService` types every `update` as a PATCH-like call | providers save by `PUT`; jobs and playlists widen `run` and `remove` additively |
| 9 | `28` 7.3: field order is required fields first; an account's New form is `Email`, `Name`, `Password`; `28` 7.2 gives each index a single forward verb | superseded by the rules of 5.0 (Name first, `Id` last, bulk verbs) |
| 10 | `29` 5: `BackendChannel.id`, `AdminAccount.id` and `AdminTitleRow.id` are the only ids; a live channel's `id` is required on create | each gains `idNumber`; a live create sends no id (7.1) |
| 11 | `34` 3 / `03` 7.12: no "forgot password" and no reset route; the gate has "no text link" | superseded by `40` (the gate gains `Forgot password?`; the backend gains two routes) |
| 12 | `01` 6 says no timers | the reset lock is a stored time checked on use; nothing is armed (`40` section 5) |
| 14 | `29` 18 and `36` 3.2 (earlier drafts): channel and title ids derived from a name, or a title's Id is its TMDB id | superseded (owner, second round): every channel, account and title gets a generated `idNumber` from a sequence; the string keys stay (7.1) |
| 15 | `01` 4.1 and `03` 7.9: "one owner of each SQLite database" with two title stores | two title stores exist, the backend catalogue (`titles`, backend migrations 004 and 009) and the fileserver cache (`titles`, fileserver migration 001); B2 changes only the first (section 7.1) |
| 13 | `ToolbarStrip` verbs are plain buttons | a destructive bulk verb needs the two-step; the strip gains an additive `armed` field (section 6) |
