# 51 - Online and offline: the channel health words (plan v1)

**Status: v1 (2026-10-18).** Owner: "on the backend lets change the terminology from 'live/dead' -> 'online/offline' across
the app surfaces and docs"; "add a status label to the preview child windows status bar to indicate online/offline. and change
the enable/disable and mark dead/alive buttons to family styled toggle switches with simple enabled and online labels next to
them". Extends `43` (the playlist sync that introduced the verdict) and `36` (the Preview). Docs first (`07`). Scope: the
backend's channel health, the admin's channels and playlists surfaces, the docs. The frontend has no channel-health vocabulary
(its `Channel` type carries no status, `46` D.2) and takes nothing. This is a shared-vocabulary wave; the shell polish of the
same turn is doc `50`. Landing (`07` 6.1): the backend lands as `feat/online-offline` beside `50`'s kit wave; the admin
surfaces land as `feat/shell-admin` after both.

## 1. Why (observed in the merged code)

- One column holds the verdict: `channels.status`, CHECK `('live','dead')`, NULL until a check runs (migration `022`; only
  stream rows may have it). The words travel through about 8 backend files, the admin's channels and playlists surfaces and
  seven docs.
- `live` is overloaded: a stream row's verdict word and the live-streaming feature's on-air state (`ChannelState "live"`,
  `kind 'live'`, the `/live` routes) share it, and a row's `data-st="live"` can mean either. `online`/`offline` says what a
  check found, matches the owner's words, and frees `live` to mean the feature alone.
- The Preview hides the verdict: its status bar words only the play state, and the toolbar's verbs are prose buttons
  (`Enable`/`Disable` with a Check/X icon, `Mark live`/`Mark dead`) where the family's control for a record's boolean is the
  Toggle (`Toggle.tsx`: "a boolean on a record is the Toggle").

## 2. Decisions

1. **The words.** A checked stream is `online` (the probe answered 2xx + `#EXTM3U`) or `offline` (it did not); unchecked stays
   NULL, filtered as `unchecked` and shown as `Not checked`. UNCHANGED: `kind 'stream' | 'live'`, the engine's `ChannelState`
   (`live` = on air), the `/live` and `/logos` routes and the live server, the stable error code `channel.not_stream`. The
   route `PUT /api/channels/:channelId/status` keeps its name; its body values become `{ status: "online" | "offline" }`.
2. **Migration `029`.** Rebuilds the `status` CHECK with `('online','offline')` and maps the stored values
   (`live -> online`, `dead -> offline`); rewrites the stored `jobs.last_counts` JSON keys (`live/dead` -> `online/offline`).
   Audit history is NOT rewritten: old `channel.status.set` rows keep the words they were written with.
3. **The API surface.** The admin-channels `status` filter takes `online, offline, unchecked`; `PlaylistView`'s counts become
   `online`/`offline`; the run-counts schema the same. A stale saved admin filter holding `live` or `dead` parses to `all`
   (state, not data; the admin's list queries are not persisted data).
4. **The admin's words.** The notice `Marked X online/offline.`; the status filter's choices `Online / Offline / Not checked`;
   the row words `online` (hint `The address answered with an HLS manifest`) and `offline` (`No HLS manifest at this
   address`), `not checked` when NULL; the playlists' counts line `... 1,904 online · 640 offline`, its `online`/`offline`
   columns and sorts; the run summary `Synced: ... 1,904 online, 640 offline.` wherever the Jobs surfaces show it.
5. **The Preview's status bar gains the health word.** Left side, before the play state: `online` / `offline` /
   `not checked` from the open channel's `status` (tones as the family words them: `offline` may take the failed tone,
   `not checked` faint), then today's line (`playing`, `loading`, the player's failure word, or a live-kind channel's engine
   word - the on-air sense, unchanged). State only, per the child statusbar's rules: no dot, no control, no progress.
6. **The Preview's toolbar becomes two toggles.** The family Toggle with a plain label beside it - `Enabled` and `Online`,
   text-xs muted, the label part of the control's hit target: `Enabled` (checked = the channel is enabled; the existing
   `PATCH { enabled }` verb) and `Online` (stream channels only, absent for a live-kind channel exactly as `Mark` is today;
   checked = `online`; flipping records the verdict through the status verb; NULL shows off and the tooltip says a check has
   not run). Disabled keeps its reason as a tooltip (reading, unreachable, saving) as every control does.
   `verdictToSet`'s player-failed guess is deleted - the toggle is explicit, not a guess. The channels LIST's bulk
   `Enable`/`Disable` stay buttons (many rows, not one record's boolean), as do `Retry`, `Previous` and `Next`.
7. **The frontend takes nothing.** Its channels stay unchecked-and-unworded (`46` D.2); its live surfaces keep the streaming
   sense of `live` everywhere.

## 3. Changes from what is merged

- Backend: migration `029`; `store/channel-health.ts`, `channel-rows.ts`, `channel-page.ts`, `channel-stats.ts`,
  `channel-repository.ts`; `types/channel.ts`, `channel-status.ts`, `channel-query.ts`, `job-counts.ts`, `playlist.ts`;
  `services/channel-verdict.ts`, `stream-check.ts`, `playlist-job.ts`, `playlist-view.ts`.
- Admin: `services/schemas/channel-schema.ts`, `playlist-schema.ts`, `run-counts-schema.ts`; `lib/preview-verbs.ts` (the
  toggle plan), `lib/row-state.ts`, `lib/channel-query.ts`; `constants/channel-copy.ts`, `channel-query-copy.ts`,
  `channel-tips.ts`; `components/channels/PreviewToolbar.tsx` (the toggles), `PreviewWindow.tsx` (the health word),
  `components/playlists/playlist-columns.ts`, `lib/playlist-rows.ts`, `lib/playlist-counts.ts`, `lib/run-words.ts`,
  `constants/list-query-copy.ts`, `lib/list-specs.ts`, `lib/channel-rows.ts`, `components/channels/channel-columns.ts`.
- Frontend and `src/shared`: nothing.

## 4. Tests

- Backend (the fake probe): migration `029` maps stored rows and `last_counts` keys; a verdict round-trips
  `online`/`offline`; an unchecked stream stays NULL; the filter takes the new values and a legacy `live`/`dead` value is
  refused (`query.status` parse); playlist counts and the playlist view carry the new fields; the status route refuses a
  live-kind channel as today; the probe's rule (2xx + `#EXTM3U` -> `online`, else `offline`) is word-for-word the old rule.
- Admin: the toggle plan (checked from the channel, `Online` absent for live-kind, the reasons as tooltips); the preview
  status bar's health word beside the play state; the schema round trip; the markup tests' new words and column ids.
- The gate (`scripts/check/gate.mjs`), then a real drive against the running stack: mark a channel offline and back online in
  the Preview, watch the toggles, the status bar's word and the rows' words re-read; run a playlist sync and read the new
  counts; both window sizes.

## 5. Docs (coordinator)

`00` gains the row. `03` §7.2c (the probe's verdict words, the status table, the counts), `26` (the counts and the live/dead
columns), `28` (the row words), `36` §8.1 and §8.3 (the toggles, the health word), `41` (the filter values), `43` (the
verdict words, the counts sentence, the migration note), `45` (the playlist column lists). Historical notes that describe the
past in the old words (`20`, `46`) stay as written.
