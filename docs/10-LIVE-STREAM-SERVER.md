# 10 - Live Server

**Status: 2026-10-17. The standalone program `src/live-server` NO LONGER EXISTS.** Its engine was merged into the admin
backend (`src/backend/src/live`, the routes in `src/backend/src/api/live-*.ts` and `admin-channels.ts`) and its channels
are rows of the backend's own database (`kind: live`, migrations 008 to 016; `26` sections 2 to 3, which are the current
description of the merged backend, its routes, auth, configuration and ports: 8091 in development, 8191 in production).
Everything below describes the engine's behaviour (HLS shape, loop and encode modes, playlists, faults, the test channels)
and is still accurate for that; where it says "the live server", its own port 8097/8197, its own database
`live-server.db`, `live:start`/`live:dev`, the loopback-only write gate (`access.loopback_only`, retired: writes need a
signed-in admin) or "run it separately", read the backend instead, as each place below now says.

It runs channels of real video files as live HLS, around the clock: the four test channels (`SEED_TEST_CHANNELS`) and any
channel of your own videos, managed through the backend's CRUD routes; a change is live without a restart. Verified: the
engine's `live-*.test.ts` files in `src/backend/test` over the real store, ffprobe and encoder (CRUD, persistence,
playlists, the switch between videos in every rendition, Range, CORS, faults, encode mode), and the opt-in
headless-Chrome tests. It replaced the earlier `scripts/live-server` tool.

The admin backend's seeded channels point straight at it (`03` section 7.7); nothing sits between the
player and it. It is never imported by the interface, the fileserver or the backend, and it is not part
of the packaged app.

## 1. What a live test proved (2026-10-15)

A one-off run with the bundled ffmpeg (`09`) and headless Chrome, from FFmpeg's generators (before the
fixture files):

| Fact | Measured |
|---|---|
| Encoder | ffmpeg `-re` from `testsrc2` + `sine`, two video variants (640x360 at 800 kb/s, 1280x720 at 2.5 Mb/s), one audio group, 2 s segments, a 6-segment window, program date-time |
| Player | hls.js in headless Chrome (muted), the way Live plays |
| Playback | `currentTime` advanced 4.0 s per 4 s for 20 s, about 30 fps, 2 frames dropped at start then none |
| Live behaviour | the playlist reloaded every 2 s with a steady 6-fragment window; latency held at 6.3 s (three segments) |
| Quality | both levels listed; ABR switched 360p to 720p at 2.6 s |
| Audio | one English rendition selected and decoding |

## 2. Requirements

1. **Real live HLS.** Playlists without `EXT-X-ENDLIST`, a moving media sequence, program date-time,
   two or more video qualities, an audio group, and channels with WebVTT captions.
2. **Channels are data.** Each channel is a row in the backend's database (section 3.2), created,
   read, changed and deleted through its routes (section 3.1). A change is live at once: the channel is
   rebuilt in the background and keeps playing its old stream until the new one is ready.
3. **Each channel plays a playlist of videos** (owner, 2026-10-16), like a broadcast schedule: an ordered list
   of real video files played one after another, the whole list looping forever. A channel's videos are
   either:
   - `videos`: absolute file paths, in play order; or
   - `folder`: an absolute folder path, read with the shared folder scanner (`src/shared/media`); every
     playable video in it and its subfolders plays, in path order.
4. **Two modes**, per channel.
   - `loop` (the default): no encoder while running. Each video is encoded once into a multi-variant VOD
     HLS ladder, cached; the channel's schedule is their segments in list order, served as a live sliding
     window computed from the wall clock (media sequence = elapsed time / segment duration), wrapping at
     the end of the list. Cheap enough to run all day. Each video is cut to whole 2 s segments (the clock
     gives every segment exactly 2 s), and the AAC encoder's last frame past the cut (a 21 ms segment) is
     dropped, so every rendition switches videos at the same segment number.
   - `encode`: one real-time ffmpeg per channel reads the list through FFmpeg's concat demuxer in a loop
     (`-re -stream_loop -1 -f concat -i <list>`) and encodes the live ladder. Realistic timing, encoder
     load and segment cadence; for latency work. The files of one list must share their codecs, size and
     rate (the fixtures do).
   - In both, each switch to the next video is an `EXT-X-DISCONTINUITY`, captions follow each video when
     the channel is captioned, and the channel reports its playlist and the video playing now.
5. **Fault injection** on demand, per channel, to drive Live's failure treatments (`06` section 3.1):
   `stall` (the playlist stops advancing), `segment-404`, `slow-segments`, `playlist-500`,
   `discontinuity`, `restart` (the media sequence resets), `end` (`EXT-X-ENDLIST`), and clearing.
6. **On the LAN, safely.** It serves the streams to whatever `HOST` it binds (loopback by default; `0.0.0.0`
   for the LAN). Changes — channel CRUD and faults — are accepted only from this computer (the TCP peer is
   loopback), so nobody on the network can change what it plays. It has no sign-in and must not face the
   internet.
7. **Offline.** No network; it uses only the bundled ffmpeg, found and run through the shared media
   library (`01` section 4.2).

### 2.1 The fixture files

Made by `scripts/fixtures/make-fixtures.mjs` (`npm run fixtures`) with the bundled FFmpeg, following Giga
Cut's fixture script: each file is a real H.264 + AAC MP4 (and, where listed, an SRT caption file beside
it), made from FFmpeg's test sources so the picture and tone tell one file from another (the bundled build
has no font, so nothing is drawn in text). They are made once per machine into `<temp>/giga-stream-fixtures`
(the live server's default `FIXTURE_DIR`); the folder's marker holds the set's signature, so a changed set
is remade in place. Never committed.

Three programmes per test channel, each with its own picture and tone; lengths differ so the switches
fall at different times. The bundled build's picture sources are `testsrc2`, `smptehdbars`, `mandelbrot`,
`color` and `nullsrc`, varied with `hue` and `hflip`.

| Channel | Programme files, in order | Picture | Tone | Length |
|---|---|---|---|---|
| `fx-news` | `live/news-1.mp4` | `testsrc2` | 440 Hz | 30 s |
| | `live/news-2.mp4` | `testsrc2`, hue 90 | 494 Hz | 20 s |
| | `live/news-3.mp4` | `testsrc2`, hue 200 | 523 Hz | 40 s |
| `fx-sports` | `live/sports-1.mp4` | `smptehdbars` | 660 Hz | 40 s |
| | `live/sports-2.mp4` | `smptehdbars`, mirrored | 698 Hz | 30 s |
| | `live/sports-3.mp4` | solid green `color` | 740 Hz | 20 s |
| `fx-music` | `live/music-1.mp4` | `mandelbrot` | 880 Hz | 20 s |
| | `live/music-2.mp4` | `mandelbrot`, hue 120 | 988 Hz | 40 s |
| | `live/music-3.mp4` | solid purple `color` | 1047 Hz | 30 s |
| `fx-kids` | `live/kids-1.mp4` | `testsrc2`, mirrored, hue 120 | 550 Hz | 20 s |
| | `live/kids-2.mp4` | solid orange `color` | 587 Hz | 30 s |
| | `live/kids-3.mp4` | `testsrc2`, mirrored, hue 300 | 622 Hz | 40 s |

Every programme of `fx-news` has an SRT beside it (`live/news-1.en.srt`, ...): one numbered cue every 5 s
naming the programme. All files are 1920x1080 at 30 fps; video is H.264 High, yuv420p, a keyframe every
2 s, audio AAC stereo at 48 kHz, so the files of one list can be joined by the concat demuxer. The same
script makes the Library's folder fixtures when phase 6 of `08` needs them; they are listed here then.

## 3. Shape

```text
src/live-server/                 (the former program's layout, kept for the file names: the code now lives under
                                 src/backend/src/live, api/live-*.ts, store/ and test/live-*.test.ts)
  package.json, tsconfig.json    start, dev:test-channels, typecheck, test
  test-channels.env              the development setup: the seed, the player page, its own data folder
  src/
    server.ts                    entry: build, listen, stop on SIGINT/SIGTERM
    app.ts                       composition root: config, store, services, routes; starts every channel
    config.ts                    the only reader of process.env (section 4)
    api/                         routes: parse, one service call, the envelope
      channels.ts                CRUD (section 3.1)
      faults.ts                  set and clear a channel's fault
      media.ts                   the stream addresses: /live, /logos, the test page; Range
      health.ts, envelope.ts, parse-input.ts, guard.ts (this-computer-only changes; the caller's base URL)
    services/
      channel-service.ts         CRUD rules: defaults, conflicts, source checks; each change applied live
      channel-runtime.ts         the running channels: build in the background, swap when ready, state
      channel-videos.ts          a channel's videos, found and read with the shared scanner and ffprobe
      stream-service.ts          a channel's bytes with its fault applied; logos
      fault-state.ts             per-channel faults and their effect on playlists and segments
      test-channels.ts           the seed of the four test channels
      service-registry.ts        the services composition root
    store/                       node:sqlite: database, migrate, migrations/001-init.sql, channel-repository
    stream/                      the HLS machinery: the recipe, the loop encode and schedule, the loop and
                                 encode channels, playlist rendering, parsing and editing, logos, test page
    types/, constants/
  test/                          CRUD, stream and pure tests (npm test); hls-playback (opt-in, Chrome)
```

### 3.1 Routes

Every answer that is not stream bytes is the standard envelope (`01` section 8). Reads are open; the
writes (POST, PATCH, PUT, DELETE) need a signed-in admin (the loopback-only gate and `access.loopback_only` are retired).

| Route | Purpose |
|---|---|
| `GET /healthz` | the backend's: `{ role: "admin-backend", version, revision, tmdb, liveChannels }` (`03` section 7.1) |
| `GET /api/channels` | Every channel, by number (the shape below) |
| `GET /api/channels/:id` | One channel |
| `POST /api/channels` | Create: `{ id, name, category, number, mode?, captions?, variants?, folder | videos }`; 201, state `preparing` |
| `PATCH /api/channels/:id` | Change any field but `id`; a new `folder` replaces `videos` and the other way round; state `preparing` |
| `DELETE /api/channels/:id` | Stop and delete; `{ id }` |
| `PUT /api/channels/:id/fault` | `{ fault, durationMs?, delayMs? }`: one of the faults in section 2 |
| `DELETE /api/channels/:id/fault` | Back to normal |
| `GET|HEAD /live/:id/master.m3u8` | Multi-variant master |
| `GET|HEAD /live/:id/:rendition/index.m3u8` | Media playlist (`no-store`) |
| `GET|HEAD /live/:id/:rendition/:segment` | Segment bytes (Range, immutable cache) |
| `GET /logos/:id.png` | The channel's generated logo |
| `GET /test/player.html?channel=:id` | A bare hls.js player, only with `TEST_PAGE=true` |

A channel answers as its stored fields (`id`, `name`, `category`, `number`, `mode`, `captions`, `variants`,
`folder` or `videos`) plus `masterUrl` and `logoUrl` (built from the address the caller used), `state`
(`preparing`, `starting`, `live`, `restarting`, `stopped`, `failed`), `problem` (why it failed, one
sentence), `fault`, `renditions`, `playlist` (`[{ name, durationMs }]`) and `nowPlaying` (`{ index, name }`).

Errors: `channel.invalid` (422, the field named in `details.field`; also a folder or file that does not
exist), `channel.taken` (409, the id or the number), `channel.not_found`, `fault.invalid`,
`access.loopback_only`, `path.invalid`, `media.not_found`, `playlist.unavailable`, `range.unsatisfiable`,
`request.invalid`, `route.not_found`, `internal.failure`. Playlists are `application/vnd.apple.mpegurl`;
segments `video/mp2t`; subtitles `text/vtt`. CORS answers loopback origins and those in `CORS_ORIGINS`, and
it is load-bearing: the interface loads playlists and segments from the backend's port directly.

### 3.2 Store

The backend's one `node:sqlite` database, `<DATA_DIR>/admin.db` (the old `live-server.db` is only read by the one-shot
importer `src/backend/scripts/import-live-server-db.ts`), owned by the store (`01` section 4.1); forward-only
numbered migrations. `channels` holds each channel's fields (`number` unique, `variants` as JSON, `folder`
or null); `channel_videos` holds a `videos` channel's paths with their positions, deleted with the channel.
Loop mode's encodes are files, not rows: `<CACHE_DIR>/items/<hash>/`, one per video, keyed by its path,
size, modified time, captions, the channel's variants and the recipe version, so channels that share a
video share its encode and a changed file is encoded again. Encode mode writes its live window under
`<DATA_DIR>/encode/` and removes it when the channel stops.

### 3.3 The test channels

With `SEED_TEST_CHANNELS=true`, a backend with no channels creates these, each a list of its three
fixture files from `FIXTURE_DIR`; a missing fixture stops the start with the command that makes them.

| Id | Name | Category | Number | Videos (section 2.1) | Captions | Variants |
|---|---|---|---|---|---|---|
| `fx-news` | Fixture News | News | 1 | `news-1`, `news-2`, `news-3` (90 s) | yes | 360p, 720p |
| `fx-sports` | Fixture Sports | Sports | 2 | `sports-1`, `sports-2`, `sports-3` (90 s) | no | 360p, 720p, 1080p |
| `fx-music` | Fixture Music | Music | 3 | `music-1`, `music-2`, `music-3` (90 s) | no | 360p, 720p |
| `fx-kids` | Fixture Kids | Kids | 4 | `kids-1`, `kids-2`, `kids-3` (90 s) | no | 360p, 720p |

## 4. How it runs

| Context | Command | Behaviour |
|---|---|---|
| Your channels | `npm start` in `src/backend` | production: port 8191 (`production.env`, `03` section 1), data in `~/.giga-stream-admin`, `.env` read if present |
| App development | `npm run dev` at the root | makes the fixtures, then starts the backend with `src/backend/dev.env` (the four test channels and the player page) beside the interface and the app |
| Tests | `npm test` in `src/backend`; `LIVE_ENGINE_TESTS=1` adds the engine and Chrome tests | temporary data folders and free ports |

| Setting | Default | |
|---|---|---|
| `PORT` | 8091; 8191 when `NODE_ENV=production` | 0 picks a free port |
| `HOST` | `127.0.0.1` | `0.0.0.0` serves the LAN; changes stay this-computer-only |
| `DATA_DIR` | `~/.giga-stream-admin` | the database and encode mode's output |
| `CACHE_DIR` | `<DATA_DIR>/cache` | loop mode's encodes; large |
| `SEED_TEST_CHANNELS` | `false` | the four test channels on an empty database |
| `FIXTURE_DIR` | `<temp>/giga-stream-fixtures` | where the seed finds the fixture files |
| `TEST_PAGE` | `false` | serves `/test/player.html` |
| `CORS_ORIGINS` | empty | more browser origins, comma-separated |

At start every saved channel is built in the background, so the server answers at once and each
channel's state says how far it got; the first start of a large folder takes as long as its encodes.

### 4.1 Adding and editing channels and videos

From the admin app (`28`, `29`) or any HTTP client with a signed-in admin's bearer token. A channel of your videos,
listed (`"kind": "live"`; the number is a string):

```http
POST http://127.0.0.1:8091/api/channels
{ "kind": "live", "id": "home", "name": "Home Videos", "category": "Entertainment", "number": "5",
  "videos": ["D:/Videos/2019-beach.mp4", "D:/Videos/2021-birthday.mp4"] }
```

or a folder: `"folder": "D:/Videos/home"` in place of `videos`. Then:

- **Add, remove or reorder videos:** `PATCH /api/channels/home` with the whole new `videos` list. A
  `folder` channel plays what is in the folder when it is (re)built; after changing the files, PATCH the
  channel (any field, even the same `folder`) to rebuild it.
- **Rename, renumber, change mode, captions or qualities:** `PATCH` those fields.
- **Delete:** `DELETE /api/channels/home`.
- **Watch:** `masterUrl` in any HLS player, or `/test/player.html?channel=home` with `TEST_PAGE=true`.
- `GET /api/channels/home` shows `state`; a `failed` channel's `problem` names the file and the reason.
- The app sees the channel at once: a live row is a channel of the same backend (`03` section 7.2), and the
  fileserver reads it from there.

## 5. Acceptance

- The master lists at least two video levels and the audio group; captions on `fx-news`.
- Playback starts within 5 s; `currentTime` advances within 10 percent of wall time over 20 s.
- Latency stays within the window (at most three segments plus one of slack).
- ABR reaches the top level on loopback; audio decodes.
- A fault that stops a stream (`segment-404`, `playlist-500`, `end`, a long `stall`) brings up Live's
  failure note (`06` section 3.1); after clearing, its Retry plays the channel again without reloading the
  page. Which note each fault produces is not otherwise specified.
- Each channel plays its videos in order, switching at their lengths (each switch an
  `EXT-X-DISCONTINUITY` in every rendition), and keeps playing when the list loops; the channel names the
  one playing, and playback in the browser runs on across a switch.
- A created or changed channel answers `preparing`, then plays; it survives a restart; a deleted one is
  gone, stream included; a bad one is refused naming the field; an unplayable video leaves it `failed`
  naming the file; a change from another computer is refused.
- Stopping the server leaves no ffmpeg process and no encode-mode output; the encode cache stays.

## 6. Known limits

Found on the fixtures; each matters for real videos and none is handled yet:

- **The picture is scaled to the exact 16:9 size of each quality**, so a portrait or 4:3 video is
  stretched.
- **The keyframe interval is 60 frames**, 2 s only at 30 fps; at other or variable rates the segments
  are not 2 s and loop mode's clock drifts from the video.
- **A video without an audio track** cannot be encoded (the recipe maps `0:a:0`).
- **Loop mode's schedule restarts at the first video on every start** (its clock begins at the start).
- **The encode cache is never pruned**, and a quality is stored per video: about 1.5 GB per hour of video
  for 360p+720p, 3.7 GB with 1080p.
