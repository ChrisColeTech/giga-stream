# 22 - Frontend Wiring

**Status: the plan for phase 2 of `src/frontend`: connecting the look that `21` builds to the fileserver.** It
says which route each control reads or writes, which service and schema carry it, how the store and hydration work,
and what proves it. The look is `21`; the window and surfaces are `02`, `04`, `05` and `06`; the wire is `03`; how
work is run is `07`; the engineering rules are `01`. Where this document and those disagree, those win and this
document is corrected first.

This plan is written now and is revised when phase 1 is signed off, since the signed-off look may change the
control list in section 3.

---

## 1. Rules that hold

- **The frontend talks only to the fileserver.** Every request is relative (`/api/...`), proxied to the fileserver in
  development (`03` section 1). The interface never contacts the admin backend, its port `8091`, TMDB, OMDb or the
  live server's own API (`01` sections 1.1 and 4.4). A stream address the fileserver gives a channel or title is the
  one external address the player loads (`01` section 1.1).
- **The Settings Address row edits `adminUrl` through `PATCH /api/settings`** (`03` section 3.2). The interface sends
  the address the person typed and nothing else; it never sends a request to that address.
- **One request layer.** `services/api.ts` is the only `fetch` (`02` section 2.2). Components, pages, hooks and the
  store never call `fetch` or construct a socket.
- **No WebSocket, no polling, no timers that send requests** (`01` section 4.4, `03` section 4). The state is read on
  mount, on a surface switch, after an action, and on Refresh. The only timers are the ones `02` names: the 250 ms
  search pause, the 400 ms shell write-back, the 1.5 s hydration fallback, the 30 s progress write, and the active
  tab's close timeout (`06` section 5.1).
- **The one streamed body is the folder scan** (`03` section 3.8). `services/ndjson.ts` reads it one line at a time;
  a body that ends without a `done` line is one error.
- **No browser storage.** Saved state is a fileserver row (`02` section 2.3).
- **Every wire value is `unknown` until Zod has validated it** (`01` section 2). A part of an answer the interface
  cannot read is one notice on the statusbar, and never costs the rest of the answer (`01` section 8).

## 2. The service layer

One resource module holds one call each (`02` section 2.2). Every module is named for its resource, in kebab-case.

| File | Routes (`03` section) |
|---|---|
| `services/api.ts` | the only `fetch`: relative URLs, the envelope, aborts, a refusal turned into an error with its code and sentence (`03` section 2) |
| `services/ndjson.ts` | reads a streamed NDJSON body line by line (`03` section 3.8) |
| `services/state.ts` | `GET /api/state` (3, `03` section 4) |
| `services/shell-state.ts` | `GET` and `PATCH /api/shell-state` (`03` section 3.3) |
| `services/settings.ts` | `GET` and `PATCH /api/settings` (`03` section 3.2) |
| `services/channels.ts` | `GET /api/channels`, `POST /api/channels/refresh`, `PATCH /api/channels/last` (`03` section 3.4) |
| `services/stream-player.ts` | attaches `hls.js` to the `<video>` when the browser can run it; the browser's own HLS is the fallback (`02` section 3.1) |
| `services/library.ts` | `GET /api/library`, `GET /api/library/continue` (`03` section 3.5) |
| `services/titles.ts` | `GET /api/titles/:id`, `.../seasons/:season`, `.../related` (`03` section 3.6) |
| `services/collections.ts` | `GET`, `POST`, `PATCH`, `DELETE` `/api/collections`; `PUT` and `DELETE` `.../items`; `GET /api/items/:kind/:id/collections` (`03` section 3.7) |
| `services/folders.ts` | `POST /api/fs/dialog`, `POST /api/collections/:id/folders`, `PUT`, `POST .../rescan`, `DELETE /api/folders/:id` (`03` section 3.8) |
| `services/scan-stream.ts` | `GET /api/folders/:id/scan` as NDJSON (`03` section 3.8) |
| `services/jobs.ts` | `GET /api/jobs`, `POST .../cancel`, `DELETE /api/jobs/:id` (`03` section 3.9) |
| `services/local-media.ts` | `GET /api/media/local/:id/info`, and the media address for the `<video>` (`03` section 3.10) |
| `services/favorites.ts` | `PUT` and `DELETE /api/favorites/:kind/:itemId` (`03` section 3.12) |
| `services/watch.ts` | `PUT /api/watch`, `DELETE /api/watch/:id`, `DELETE /api/watch` (`03` section 3.13) |
| `services/desktop.ts` | the folder picker and the window controls, through the preload's named capabilities only (`01` section 7); in a browser the picker answers `409 fs.desktop_required` and is shown disabled |

**Schemas.** One Zod schema file per resource under `services/schemas/` (`envelope-schema.ts`, `state-schema.ts`,
`settings-schema.ts`, `channel-schema.ts`, `library-schema.ts`, `title-schema.ts`, `collection-schema.ts`,
`job-schema.ts`, `watch-schema.ts`). The phase 1 types in `src/types/` are checked against `03` in the wave that
wires them; a mismatch is a phase 1 bug and is fixed in the same wave.

**Errors.** `lib/error-sentence.ts` is the one mapping from dotted codes to sentences (`01` section 4.1). A refusal
shows its sentence once on the notice line.

## 3. What each surface reads and writes

Each row names a control of `21`, the route it uses, and what it does on the answer. Phase 1 drew the control
disabled, or local, where the row says so.

### 3.1 Shell

| Control | Route | Behaviour |
|---|---|---|
| Hydration on mount | `GET /api/state` | the saved surface, pane visibility and sizes are applied once; the interface shows after two animation frames; a 1.5 s fallback shows defaults (`02` section 2.3) |
| Pane toggles, pane sizes | `PATCH /api/shell-state` | written 400 ms after the last change, never before hydration (`02` section 2.3, item 6) |
| Statusbar connection | the outcome of the last request | `connecting` while the first state read is in flight, `ready` after a request succeeds, `reconnecting` after one fails (`03` section 4; `06` section 1.2) |
| Notice line | any refusal or outcome | one sentence, the server's own, or `could not reach the fileserver` (`04` section 6) |
| `Ctrl+0` and the zoom stepper | `PATCH /api/settings` `uiZoom` | applies at once |

### 3.2 Live

| Control | Route | Behaviour |
|---|---|---|
| Channel list and search | `GET /api/channels?q=&category=` | the search waits 250 ms; a newer keystroke abandons the older request; a failed request keeps the last rows and says why (`06` section 3.2) |
| Refresh | `POST /api/channels/refresh` | the whole list, every stream's status and the dots update from the answer (`03` section 3.4) |
| A row, click or Enter | `PATCH /api/channels/last`; the player loads `streamUrl` | the channel plays and is remembered as the last one |
| Live opens on the last channel | `GET /api/state` `lastChannelId` | the last channel is selected on launch if it is still in the live view |
| Stage | `stream-player.ts` | ready on the first frame; a failed stream shows the note with Retry, which loads the same address again (`06` section 3.1) |
| No-channels note | `POST /api/channels/refresh` | Refresh channels is enabled |
| Playback settings | the attached `hls.js` levels, tracks and latency | quality, audio, captions, latency enabled with the stream's real values; a row the stream cannot serve keeps its reason (`06` section 3.3) |
| Fit, Fill, Original | none | local, always usable (`06` section 3.3) |

### 3.3 Library

| Control | Route | Behaviour |
|---|---|---|
| Views and collections counts | `GET /api/library?view=` | counts appear once a view has been queried (`06` section 4.1) |
| Type strip, sort, filters, search | `GET /api/library` with `type`, `sort`, `genre`, `year`, `watched`, `q` | the previous cards stay while the next result loads; superseded requests are abandoned (`03` section 3.5) |
| Trending sort | `trending` in the library answer | offered only when `trending` is true (`06` section 4.3) |
| Continue Watching | `GET /api/library/continue` | drawn only with progress (`06` section 4.2) |
| Favourite | `PUT` and `DELETE /api/favorites/:kind/:itemId` | applies at once |
| Card menu, `Collections ▸` | `GET /api/collections`; `GET /api/items/:kind/:id/collections`; `PUT` and `DELETE .../items` | each row is a check toggled at once, inline, with no dialog (`06` section 4.5, family standard) |
| Title information | `GET /api/titles/:id`; `.../seasons/:season`; `.../related` | the wide popup reads the detail; Play is enabled when the title has a `streamUrl`, and disabled with `No stream source is set up for titles.` otherwise (`03` section 3.6) |
| Clear history | `DELETE /api/watch` | the two-step's second press clears all history; favourites, collections and files are untouched |
| Remove from History | `DELETE /api/watch/:watchId` | removes one entry |
| Image failure | `GET /api/images/:id` | only that image shows its fallback; the query is not failed (`03` section 3.11) |

### 3.4 Player

| Control | Route | Behaviour |
|---|---|---|
| Local file | `GET /api/media/local/:id/info`; the Range route `GET /api/media/local/:id` | the file plays in the `<video>` and seeks through byte ranges (`03` section 3.10) |
| Test-server title and episode | the `streamUrl` from `GET /api/titles/:id` and `.../seasons/:season` | plays in the `<video>` like a channel (`06` section 5.3) |
| Progress | `PUT /api/watch` | every 30 s while playing and on pause, end, seek settle, tab switch and close; each playback numbers its writes from 1, and a lower number never replaces a higher one (`03` section 3.13, `06` section 5.3) |
| Resume and Start over | the watch entry in the title's detail | the banner shows where the title was left (`06` section 5.3) |
| Episode browser | `GET /api/titles/:id/seasons/:season` | changing the season starts nothing; choosing an episode loads that exact episode |
| Related band | `GET /api/titles/:id/related` | at most 20 cards; a local file's band stays collapsed with its reason (`06` section 5.5) |
| Watch block: Favourite, Collections, Remove from History | as in 3.3 | as in 3.3 |
| Provider titles | not in this phase | `06` section 5.3 is written from the results of `14` first; the stage's provider case stays disabled with its reason until then |

### 3.5 Settings

| Control | Route | Behaviour |
|---|---|---|
| Theme, Reduce motion, Accent, UI zoom | `PATCH /api/settings` | each applies at once and is saved (`03` section 3.2) |
| Autoplay, Subtitle language, Default view | `PATCH /api/settings` | saved; Default view changes the library's presentation |
| Address | `PATCH /api/settings` `adminUrl` | saved like any other row; the fileserver connects to it and the lists follow (`03` section 3.2) |
| State | `GET /api/state` `backend` | connected or not, the backend's revision, when the channels were read, the error if any (`03` section 4) |
| Collections | opens the Collections window | as the Library rail |
| Open History | closes Settings and selects History | as `04` section 2 |

### 3.6 Collections window

| Control | Route | Behaviour |
|---|---|---|
| Create | `POST /api/collections` | the new collection is listed at once |
| Rename | `PATCH /api/collections/:id` | the name changes at once |
| Remove collection | `DELETE /api/collections/:id` | the two-step's second press removes it; files on disk are never touched (`03` section 3.7) |
| Members | `DELETE /api/collections/:id/items/:kind/:itemId` | removes a manual member |
| Attach folder | `POST /api/fs/dialog`, then `POST /api/collections/:id/folders` | the native picker answers a token and a name, never a path; the scan streams (`03` section 3.8) |
| Scan progress | `GET /api/folders/:id/scan` as NDJSON | events arrive while the scan runs; a closed window does not stop the scan |
| Replace, Rescan, Cancel scan, Remove folder | `PUT`, `POST .../rescan`, `POST /api/jobs/:id/cancel`, `DELETE /api/folders/:id` | each acts on its folder; Cancel scan cancels the job (`03` section 3.9) |
| Jobs | `GET /api/jobs` | the window reads the jobs of its folders |

### 3.7 Events drawer

`03` does not say what produces the drawer's rows. The default in force is that the interface records its own events:
connection changes, request outcomes and scan events. The owner confirms this before the wave is built (section 6, question 1).

## 4. Store

`02` section 2.1 names three slices, `shell`, `live` and `playback`. The template kept the collections in the shell.
So `02` section 2.1 is amended first, to add a `library` slice for collections and the views' counts. Then:

| File | Holds |
|---|---|
| `store/app-store.ts` | composes the slices |
| `store/slices/shell-slice.ts` | surface, pane visibility and sizes, the events drawer, the open flow and its item, theme, accent, motion, zoom, notice, folds |
| `store/slices/live-slice.ts` | the channel list as received, search and category, the selected and playing channel, the stage state, the connection |
| `store/slices/playback-slice.ts` | what the player reports, the user's playback choices, the tabs and their stage state |
| `store/slices/library-slice.ts` | collections, the views' counts, the current library query |

The store performs no I/O and holds no promise, timer, DOM node or media element (`02` section 2.1).

## 5. Hydration and write-back

`02` section 2.3 is the sequence, and the code follows it: the interface mounts invisible; the state read arrives and
its parts are validated separately; the saved shell is applied once; the panes snap; the interface shows after two
frames; a 1.5 s fallback shows defaults without writing them back; later changes are written back 400 ms after the last
change; a later state read never re-applies the saved shell.

## 6. Waves

Each wave wires one surface's controls, using the owners and worktrees of `21` section 5, unless the owner directs a
different split when phase 2 starts.

| Wave | Delivers | Proof |
|---|---|---|
| 2.0 Boundary | `services/api.ts`, `services/ndjson.ts`, the schemas, `lib/error-sentence.ts`, the check that refuses the admin backend's address in `src/frontend` (`01` section 1.1) | `test/api.test.ts` passes; the rule checker reports the new rule |
| 2.1 Store and hydration | the slices of section 4, `services/state.ts`, `services/shell-state.ts`, `services/settings.ts`, the hydration and write-back hooks | a fileserver on a free port with a temporary `DATA_DIR` restores the saved surface and layout, and writes nothing before it has restored them |
| 2.2 Live | `services/channels.ts`, `services/stream-player.ts`, the channel search and the stage | Live opens on the last channel; Refresh updates the dots; a test channel plays |
| 2.3 Settings and Collections | `services/settings.ts`, `services/collections.ts`, `services/folders.ts`, `services/jobs.ts`, `services/desktop.ts`, `services/scan-stream.ts` | settings survive a restart; a collection is created and removed; a folder's scan streams |
| 2.4 Library | `services/library.ts`, `services/titles.ts`, `services/favorites.ts`, `services/watch.ts`; the menu's `Collections ▸` wired | the views show their counts; a favourite persists; a collection toggled from the card's menu is listed after a restart |
| 2.5 Player | `services/local-media.ts`, the progress hook, the tabs | a local file plays and seeks; progress survives a restart; Resume works |
| 2.6 Events | the events the interface records itself | a connection loss and a failed stream each produce a row |
| 2.7 Fixtures gone | `src/fixtures/` deleted | `grep` finds no import of `fixtures/`; the gate's frontend steps pass |

**Checks, every wave** (`07` sections 4 and 5): the gate's frontend steps pass; the rule checker finds no reference to
the admin backend; the fileserver runs on a free port with a temporary `DATA_DIR`, never `~/.giga-stream`; the wired
surface is driven in the browser against it and looked at at both sizes. The fileserver is started only with the
owner's say (`07` section 4).

**Workers.** A non-visual layer (services, schemas, store slices, tests) can be briefed to one worker under `07`
section 6.2. The visual wiring of each surface is done by that surface's owner, as in `21`.

## 7. Done when

Every control of `21` that was disabled or local in phase 1 either works against the fileserver or is disabled with the
reason the fileserver gives; the walks of `05` section 3, 4 and 5 run in the browser against the fileserver; the
fixtures are gone; and the gate's frontend steps pass. The Electron window is checked in phase 2's final wave (`08`
phase 11), not here.

## 8. Open questions

1. **Events drawer rows (wave 2.6).** `03` does not say where the rows come from. The default is the interface's own
   record of connection changes, request outcomes and scan events. The owner confirms this before the wave is built.
2. **Provider stage (`06` 5.3).** Outside this phase. It waits for the write-up from `14`.
