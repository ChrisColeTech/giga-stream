# 05-END-TO-END-FLOW.md

Status: **2026-10-15.** Walks the surfaces of `06`. Requirements: `00`. Navigation: `04`. Wire: `03`.

---

## 1. The pieces

```
┌───────────────────────────── the user's PC ─────────────────────────────┐
│ Electron — the interface                                                │
│   Live · Library · Player · windows and popups                          │
│   the player: <video> + hls.js, loading a stream address directly       │
│     │ services/ (REST, one origin :8090)        ▲ WS frames (hello,      │
│     ▼                                           │  channels, jobs)       │
│  fileserver (Fastify in Electron main)                                  │
│    node:sqlite — settings · layout · collections · favorites · history  │
│    · local files · jobs      image cache (the only thing from the       │
│    backend that is kept)     in-memory live view of the backend's data  │
│                     │ HTTP + the backend's socket, read-only            │
│                     ▼                                                   │
│  folders of your own video files — read in place, never written         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ▼
                  admin backend (a server: this PC, a LAN host or the cloud)
                    node:sqlite — channels and their stream addresses
                    TMDB titles on demand, each with an address from a rule

   stream origin ── HLS, loaded straight into the player ──▶ the interface
   (in development: the live server's test channels, src/live-server, :8097)
```

The fileserver and the interface never see a provider. The admin backend never carries video.

## 2. First launch (from zero)

1. **The window opens** invisible and shows itself a moment later, once the fileserver's first `hello`
   has arrived. A fresh data folder has no saved layout, so it opens on **Library** with every pane at its
   preferred size. The statusbar reads `ready`.
2. **The backend.** The fileserver connects to the admin backend at the default address,
   `http://127.0.0.1:8091`. If nothing answers there, the channel and title lists are skeleton rows,
   Library's local parts work, and **Live** shows the player alone with a note over it and a Refresh
   action. Nothing is saved from the backend, so there is nothing stale to show.
3. **Settings ▸ Admin backend** (`Ctrl+,`) — if the backend is somewhere else, type its address. It is
   saved like any other setting; the fileserver connects to it and reads the channels, and the lists
   follow without navigating away. The row beside it shows whether the backend is answering. There is no
   key, login or account field.
4. **Live ▸ the channels** arrive with their logos (or glyphs, until the images are cached), each with a
   status dot; the player loads the first channel's stream.

## 3. A Live session

1. **Open Live** (`Ctrl+1`). The settings are on the left, the player in the centre and the channels on
   the right. The last channel you chose is already loading; on a first run it is the first channel.
2. **Watch.** The player loads the channel's stream address straight from its origin. If the browser will
   not start it unasked, the loaded player waits paused with its own Play control.
3. **Choose another channel** — click a row or press `Enter`. The new stream loads at once and the row
   carries the playing marker; the choice is remembered. The arrow keys only move the selection.
4. **Find a channel** — type in the search field or pick a category; the list narrows after a short pause
   without interrupting what is playing.
5. **Refresh** — the icon beside the heading reads the list from the backend again and refreshes every
   stream's status. A channel that has stopped answering turns to the offline dot; one that came back turns
   live.
6. **Adjust** — the left pane shows what is playing (quality, resolution, bitrate, aspect, language, live
   edge) and lets you change quality, audio, captions, latency and how the picture fits. Fit, Fill and
   Original works whatever is playing.
7. **A stream fails** — a centred note over the player says why in one sentence, with **Retry**, which
   loads the same address again. A stream that is playing keeps playing if the list under it is cleared.
8. **Switch to Library** — Live keeps playing; switch back and nothing has moved.

## 4. Library and Player

1. **Library** — collections on the left, the body in the centre, filters on the right. Choose All,
   History, Favorites or a collection; narrow with the type strip (All / Movies / TV / Local) and the filters.
2. **Info** on a card opens the Title information popup without stopping anything; **Play** opens a Player
   tab.
3. **Player** — one title or local file at a time, filling the stage as Live's channel does; for a series, choose a season and an episode and that exact
   episode loads. The stage's controls are the browser's own. Progress is written about every 30 seconds
   while playing and on pause, seek, switch and close.
4. **Resume** — a title you left partway offers its recorded position.
5. **Back to Library** — switch with the titlebar or `Ctrl+2`; Library is exactly as you left it.

Titles are read live from the backend like channels, so with the backend gone Library's title regions are
skeletons while local files, collections, favorites and history stay usable.

## 5. Attach and play a local folder

1. **Manage collections** — the footer of Library's rail opens the Collections window.
2. **Create** a collection: a name, then **Create** at the last row.
3. **Attach folder** — the OS folder dialog opens; the interface receives a selection token and the folder's
   name, never a path. The fileserver attaches the folder and queues a recursive scan; the statusbar and the
   window show the same job, and files appear as they are found. Your files are read in place and never
   written.
4. **Play** a local card — the Player plays the file through the fileserver's Range route; seeking
   proves `206`.
5. **Remove** — a two-step on the collection's own control; the index rows go, your files and history do not.

## 6. Second launch

The window opens on the tab you left, with your pane layout; Live opens on your last channel. Nothing
else is restored: no window, popup or drawer, no selection, and the channel and title lists are read
live again. Cached images are reused. If the backend is down, the lists are skeletons and the player
stays; if it is back, they fill.

## 7. Failure modes

| Symptom | Meaning / fix |
|---|---|
| The channel list stays skeleton rows | the backend cannot be reached, or has no channels — Settings ▸ Admin backend, or Refresh |
| A channel's dot is offline | its stream address did not answer like a playlist at the last probe — Refresh probes it again |
| A stream fails after Choose | the note names why; **Retry** loads the same address again |
| `ready` never shows, notice reads "could not be read" | the fileserver and this version of the interface disagree about a message; the notice names which |
| The statusbar says `reconnecting` | the socket to the fileserver dropped; loaded media keeps playing; a fresh `hello` re-syncs |
| The app opens on the wrong tab | the fileserver was slow and showed defaults; it restores your tab when it answers, and writes nothing until it has |
| A control is dimmed | nothing for it to act on — hover it for the reason |
| A local file is missing | its card says unavailable; **Rescan** or remove it; no path is shown |
| Poster or logo missing | that image shows its fallback; the list is unaffected |
| `<label> was interrupted` | a job was running when the app last closed; nothing resumes by itself |
| A folder selection is refused | the line names why: missing, outside the allowed root, or not a folder |
| The database is newer than the app | startup refuses with an upgrade remedy; the database is untouched |
