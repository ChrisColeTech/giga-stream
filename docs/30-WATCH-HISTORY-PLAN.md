# 30 - Watch history plan

**Status: plan, written before the code (worker H2, branch `admin/watch-history`, base `6126c72`).** Owner, 2026-10-17:
"continue watching is not working properly. when i click play it should add the video to my history, i should be able to
close and relaunch the app and see my recently watched, and the percentage or time watched should be correct where
possible." This document records what the code does today (read file by file; the code wins over the docs), the root
cause of each symptom, the design that fixes it on both programs, the change list, the tests, the failure modes and how
the coordinator verifies it on the real stack.

## 1. What exists today (verified)

### 1.1 Fileserver (`src/fileserver`)

| Piece | Where | Finding |
|---|---|---|
| Table | `src/store/migrations/001-init.sql` 159-174 | `watch_entries`: one row per item + exact episode (unique `COALESCE` index), `idx_watch_updated`. Sound. |
| Store | `src/store/watch-repository.ts` | `upsert` is autocommit through `node:sqlite` (synchronous, WAL set in `store/database.ts`), so the row is committed before the response is built. `update` keeps the old duration when the write has none (`COALESCE`). Sound. |
| Service | `src/services/watch-service.ts` | Ordering by `seq` per `playbackId` (in memory, unbounded `Map`); sticky `watched`; threshold read from the `watchedPercent` setting at each write (`app-services.ts` 128-131; default 90, `docs/03` line 144). **Gaps:** `pauseHistory` is never read, so the server cannot honour "stop new entries"; a position past the duration is stored as sent; the `seq` map never shrinks. |
| Route | `src/routes/watch.ts` | `PUT /api/watch`, `DELETE /api/watch/:watchId`, `DELETE /api/watch`. The body schema accepts floats, negatives, empty ids. |
| Reads | `services/library-lists.ts` `historyRows`, `continueItems`; `store/library-repository.ts` `listWatchEntries` | History: every entry, newest first (`updated_at DESC, rowid DESC`). Continue: newest entry of each item, `watching` only, at most `CONTINUE_MAX` = 10, newest first. Sound. |
| Tests | `test/favorites-watch.test.ts`, `test/library.test.ts` 168-210 | Ordering, sticky, setting-driven threshold, episode identity, remove/clear, seeded history and continue. **No test reopens the data folder after a write; none covers `pauseHistory`.** |
| Quit | `src/app/main.ts` 145-155 | `window-all-closed` -> `app.quit()` -> `before-quit` -> `server.close()` (Fastify lets an accepted request finish, then closes). |

The fileserver is nearly right. Its defects are the missing `pauseHistory` rule and weak input validation.

### 1.2 Interface (`src/frontend/src`)

The brief assumed `playItem` and `playEpisode` do the work; they do not. They are dead phase-1 stubs
(`services/library.ts` 148-152) that nothing calls. The real path is:

`playRef` (`components/library/library-service.ts` 24) -> `requestPlay` (`store/navigation-slice.ts` 41) -> `PlayerPage`
(`pages/PlayerPage.tsx` 88-94) -> `openItem` -> session `open` -> `playbackKey` changes -> effect (113) `progress.begin(...)`
-> `usePlayerProgress` (`hooks/usePlayerProgress.ts`) -> `PlayerProgress` (`lib/player-progress.ts`) -> `writeWatch`
(`services/watch.ts`) -> `PUT /api/watch`. A series with no progress starts nothing until an episode is chosen
(`docs/06` lines 467, 575), and the same chain runs from `chooseEpisode`.

What is wired: monotonic `seq` per `playbackId`; the exact episode; `pauseHistory` check at `begin`; Library re-reads
on mount, on becoming the active surface, and on `libraryRefreshSerial` (`hooks/useLibraryData.ts` 144-150); embeds feed
position through decoded `postMessage` (`lib/embed-messages.ts`, `lib/embed-playback.ts`).

## 2. Root cause of each symptom

1. **Play does not add to history.** `PlayerProgress.flush` returns without writing until `update()` has run
   (`hasPosition`, `player-progress.ts` 71), and `update()` is called only from a `timeupdate` or a provider message. The
   timer then writes every 30 seconds (`PROGRESS_INTERVAL_MS`). A person who presses Play and leaves, or whose provider
   embed never reports a position, creates no row at all. Nothing writes at the moment of the press.
2. **Close and relaunch loses it.** There is no `pagehide`, `visibilitychange` or quit flush. `usePlayerProgress` flushes
   only when the Player component deactivates or unmounts, and an Electron window closing runs neither as an awaited
   write. With a 30-second cadence, up to 30 seconds of position, and the whole row for a short session, is lost.
3. **Percent and time are wrong or absent.** `PlayerProgress.update` resets `durationMs` to `undefined` whenever one
   report lacks it, a `loadedmetadata` does not report at all, the end of the media does not report its own position
   (a `pause` and `ended` write the last `timeupdate`, which can be seconds short), and nothing falls back to the title's
   runtime for an embed that reports position without duration.
4. **Resume is stale and can unmount the player.** Resume reads `item.progress` from the item snapshot taken when the
   item was opened (`tab.libraryItem`, then the store's last Library read), never the progress just written. Once the
   progress is live, a naive fix would also flip `resumeOf(view)` mid-playback and the Resume gate
   (`waitingForResume`, `PlayerPage.tsx` 62) would unmount the stage. The decision must be frozen per playback.
5. **Library goes stale until a surface switch.** No write asks Library to refresh; the History and Continue regions
   only change when the person re-enters Library, and that read can run before the Player's last write lands.
6. **Rules broken.** `usePlayerProgress` uses `setInterval` (`docs/01` 4.4 forbids timers/polling). Each REST call, a
   progress write included, adds an Events row, so a periodic write would fill the 200-row drawer.
7. **`pauseHistory`** is checked only in the interface at `begin`; the fileserver ignores it.
8. **Removal from the Player** (`PlayerPage.tsx` 166) calls `removeWatch` directly and never refreshes Library or
   forgets the item's progress.

## 3. Target design

### 3.1 Data flow

```text
Play (card, Continue card, Title information, related card, episode choice)
  -> requestPlay / chooseEpisode -> PlayerPage opens the item, session key = ref + exact episode
  -> begin(identity, key)           a fresh playbackId, seq 0; flushes the previous playback first
  -> sources resolve (>= 1 playable source)
  -> open(key, openingPosition)     ONE write at once: state watching, position = saved position (or 0), no invented duration
  -> media events                   loadedmetadata / timeupdate / seeked / pause / ended report; a write is sent when due
  -> lifecycle                      pagehide, visibilitychange hidden, deactivate, item switch, close: write with keepalive
  -> each write's answer            remembered as the item's watch mark; boundary writes request a Library refresh
Library (startup, activation, refresh serial) -> GET /api/library/continue and ?view=history -> cards from the fileserver
```

### 3.2 Write protocol (`PUT /api/watch`, unchanged route)

Body: `{ item: {kind, id}, season?, episode?, positionMs, durationMs?, playbackId, seq }`; integers only, `seq` from 1,
increasing within one playback. One `playbackId` per (open item + exact episode) playback, minted at `begin`.

A write is sent:

| Trigger | Position | Notes |
|---|---|---|
| `open` (press of Play, an episode choice) | saved position when resuming (`resumeMode` not `restart` and a saved `watching` position exists), otherwise 0 | Once per playback, after the first playable source resolves, so an item that cannot play never enters History. No duration (the server keeps the stored one) |
| `loadedmetadata` | the (re-applied) opening position | Forced write only when it first teaches the duration, so the percentage exists if the person leaves at once |
| `timeupdate` / `seeked` | `currentTime` | Throttled **by media time**: due when `|position - lastWritten| >= 10 000 ms` (also on a rewind or a seek that large). `lib/watch-throttle.ts`, pure |
| `pause` | `currentTime` | Always |
| `ended` | the duration | Always; the server flips to `watched` |
| Start over | 0 | Always |
| `pagehide`, `visibilitychange` hidden | last known | `fetch` with `keepalive: true` through `services/api.ts` |
| Player deactivates, item switch, Close | last known | Awaited (`settleFinalProgress`, 1 second cap) |
| Provider embed message | the message's position and duration | Same throttle; `pause`/`ended` messages always |

No timers: the only schedulers are media and page events. `pauseHistory` stops every write at the source (`setEnabled`)
and at the server (below). Live channels never reach the Player's progress (Live is a different surface).

**Durations.** A native element's finite `duration` wins. A live or unknown duration (`Infinity`, `NaN`) sends none and
the opening seek is skipped. An embed that reports a position but no duration uses the title's TMDB runtime (movie
`runtimeMs`, episode `runtimeMs`); a local file's own `durationMs` is already the element's duration. An embed that
reports nothing keeps its row at the saved position with no percentage. The last known duration is kept when a later
report lacks one.

**Watched.** The server alone decides: `positionMs >= durationMs * watchedPercent / 100`, sticky. The interface sends
the real position and the real duration and sends `positionMs = durationMs` at `ended`. `watchedPercent` defaults to 90
everywhere (`docs/03` line 144 and the code); `docs/03` line 479 still says 95 (doc error, section 9).

### 3.3 Read protocol and hydration

Library reads `GET /api/library/continue` (up to 10, newest first, `watching` only) and `GET /api/library?view=history`
on mount, whenever it becomes the active surface, and on `libraryRefreshSerial`. That already hydrates after a relaunch:
the rows, progress bar (`positionMs / durationMs`) and `N min left` / `Watched` come from the fileserver's rows. Boundary
writes (open, pause, end, flush) call `requestLibraryRefresh()` after the write settles, so Continue and History update
without a surface switch. Throttled mid-playback writes do not refresh (they would reload Library every 10 seconds).

**Watch marks.** Each write answer's entry is stored in the one store (`watchMarks`, by item key: `{ watchId, progress }`).
The Player prefers a mark over the item snapshot, so reopening an item in the same session resumes at the position just
written. A removal replaces the mark with a tombstone so the Player never resumes a deleted entry.

**Resume freeze.** `hooks/usePlayerResume.ts` captures the resume point once per `playbackKey` and owns the choice
(`ask` / `resume` / `restart`), the opening position and `waitingForResume`; the live progress changes after that never
move the stage.

**Episode navigation (`59`).** Episode-row presses and the compact Previous/Next footer share one operation: advance
the existing latest-navigation generation; await the current recorder's `flush(false)`; if still latest, dispatch the
exact returned season/episode and let the playback-key effect begin its distinct watch identity. A later episode press,
Close or title open supersedes the pending switch. Cross-season adjacency reads/caches actual season responses, skips
empty/Season 0 and never manufactures an episode from summary counts. Resume capability follows the active source:
native/app streams yes; embeds only with `startParam`.

### 3.4 Server changes

1. `routes/watch.ts`: integers only (`positionMs >= 0`, `durationMs > 0`, `season`/`episode` > 0, `seq >= 1`), ids and
   `playbackId` non-empty and bounded.
2. `services/watch-service.ts`: `paused: () => boolean` (the `pauseHistory` setting) - a paused write changes nothing and
   answers `{ applied: false, entry: <existing or null> }`; the position is clamped to a known duration; the per-playback
   `seq` map is bounded (oldest dropped past 512 playbacks).
3. `services/app-services.ts`: passes `paused`.
4. Tests (section 6).

## 4. Interface change list

| File | Change | Size bound |
|---|---|---|
| `services/api.ts` | `ApiOptions.keepalive` (passed to `fetch`) and `quiet` (a successful call adds no Events row; a failure still does) | <= 120 |
| `services/watch.ts` | `writeWatch(write, {keepalive})`, quiet | <= 30 |
| `services/library.ts` | delete the dead `playItem` / `playEpisode` / `removeHistoryEntry` stubs and their imports | -6 |
| `lib/watch-throttle.ts` (new) | `WATCH_WRITE_EVERY_MS`, `writeDue` | <= 30 |
| `lib/player-progress.ts` | `PlayerProgress`: `key`, `open`, `update` (throttle, duration kept, first duration forces a write), `restart`, `flush(keepalive)`; delete the 30 second constant; `ProgressBeginQueue.settled` | <= 150 |
| `lib/watch-marks.ts` (new) | `WatchMark`, `markOf(entry)`, `withWatchMark(item, mark)` | <= 50 |
| `lib/player-view.ts` | `resumeOf` requires a real saved position (> 0) | +1 |
| `lib/player-opening.ts` | `applyOpeningPosition` skips an unknown or live duration; `reportedDuration` (the embed runtime fallback rule) | +20 |
| `store/slices/watch-slice.ts` (new) | `watchMarks`, `rememberWatch`, `forgetWatch`, `forgetAllWatch` | <= 70 |
| `store/app-store.ts` | spread the slice | +3 |
| `hooks/usePlayerProgress.ts` | rewrite without `setInterval`: session, begin/open/update/playing/restart/flush, `pagehide` and `visibilitychange` listeners, one failure notice until a success, library refresh at boundaries | <= 150 |
| `hooks/usePlayerResume.ts` (new) | frozen resume point, choice, opening position, `waiting` | <= 70 |
| `pages/PlayerPage.tsx` | use both hooks; open effect; mark-merged item; embed duration fallback; remove through `removeWatchEntry` | <= 200 |
| `components/player/NativePlayer.tsx` | report on `loadedmetadata`, `seeked`, `timeupdate`, `ended` (position = duration); drop `onSeeked` | <= 100 |
| `components/player/PlayerStage.tsx` | drop `onSeeked` wiring | -1 |
| `components/library/library-service.ts` | removals and clear also update the watch marks | +6 |
| `components/settings/LibrarySection.tsx` | Clear history also forgets the marks | +1 |

## 5. Quit path

Closing the window runs `pagehide`: the flush is a `keepalive` fetch, which the browser process owns after the page is
gone and which the loopback fileserver receives before `before-quit` closes the listener (`server.close()` lets an
accepted request finish). The fileserver needs no change. A write lost to an abnormal kill costs at most 10 seconds of
media time because the previous throttled write and every pause are already stored.

## 6. Tests (written, not run by the worker)

Fileserver (`test/watch-persistence.test.ts`, node:test, injected clock, no sleeps): a write survives closing and
reopening the same data folder (history and continue answers, progress, `Watched`); `pauseHistory` suppresses writes and
leaves existing entries; position clamps to duration; malformed bodies (float, negative, empty playbackId, `seq` 0) are
400; the per-playback `seq` map is bounded; continue shows an entry opened at position 0 with no duration.

Interface (`test/`): `watch-throttle.test.ts` (due/not due, rewind, seek, first write); `player-progress.test.ts` updated
(open once and idempotent, throttle by media time, duration retained, first duration forces a write, restart writes 0,
keepalive flag passed, paused enabled flag, begin queue, opening seek skipped for live media, the embed runtime
fallback rule); `watch-marks.test.ts` (marks, the Resume read of a mark, `resumeOf` ignoring position 0, and the watch
slice's remember / forget / forget all); `api.test.ts` (keepalive passed to fetch, quiet adds no row on success and one on
failure).

## 7. Failure modes

| Failure | Behaviour |
|---|---|
| Fileserver offline | A write rejects (`fileserver.unreachable`); one warning on the notice line until a write succeeds, never one per write; playback continues |
| Refused write (400/404/5xx) | Same notice; the next boundary retries with a higher `seq` |
| Two windows | Each playback has its own `playbackId`; the last writer wins the row; `seq` ordering applies per playback |
| Late write after a newer one | Ignored by the server (`applied: false`) and never rewinds |
| Clock skew | The interface sends no time; `updated_at` is the fileserver's clock |
| History paused | Nothing is written by the interface or accepted by the server; existing entries stay |
| Live or unknown duration | No percentage, no resume seek |

## 8. How the coordinator verifies it (real stack, `docs/07` section 4)

1. `npm run dev` stack up (fileserver 8090, interface 5171, Electron window debug port 9222). Note the current
   `GET http://127.0.0.1:8090/api/library?view=history` and `/api/library/continue`.
2. In the Electron window (CDP on 9222), open a title whose stream address is a live test channel of the backend and press
   Play. Within a second `GET /api/library?view=history` shows the row with `progress.state = "watching"`.
3. Let it play past 10 seconds of media time; `GET /api/library/continue` shows `positionMs` advancing in steps of about
   10 seconds and, for a finite VOD or local file, a `durationMs`.
4. Pause: the row's position equals the paused time. Seek 60 seconds ahead: the next write carries it.
5. Close the window and relaunch the app: Continue Watching shows the item (newest first, at most 10) with the progress
   bar and `N min left`; History shows the entry; Resume offers the saved time and resumes there.
6. Play to the end of a short local file: `state` becomes `watched`, the card reads `Watched`, it leaves Continue.
7. Settings > Library: Pause history on, play something: no new row. Continue watching off hides the strip.
8. Report every console error and every non-OK `/api/watch` answer.

## 9. Choices made, and errors in other documents

**Choices.** (1) A series with no progress still creates no row until an episode is chosen, as `docs/06` 467 and 575 say;
the episode choice is the Play press for a series. (2) The opening write waits for the first playable source so an item
with nothing to play never enters History. (3) The threshold is the fileserver's `watchedPercent` setting (90 by
default); the interface never decides `watched`. (4) One resume point per title (its newest entry), as `LibraryItem.progress`
models it; an older episode's position is not offered. (5) Throttle by media time (10 seconds), not by wall clock, so
paused media writes nothing and a fast seek writes at once. (6) A new write answer is kept as the item's mark rather than
adding a read route. (7) No grace delay is added to the fileserver's quit.

**Doc errors found (not edited).** `docs/03` line 479 says the entry becomes watched at 95 percent "(default)"; the
default is 90 (`docs/03` line 144; the code and its test). `docs/03` line 18 says "sticky watched at 95 percent". `docs/22`
line 269 and `docs/06` section 5.3 describe a "30 s progress write"; this plan replaces it with the 10-second media-time
throttle and the lifecycle flushes. `docs/22` line 321 says the watch threshold is "today a constant"; it is the setting.
`docs/03` section 3.13 should list `pauseHistory` as the server rule.
