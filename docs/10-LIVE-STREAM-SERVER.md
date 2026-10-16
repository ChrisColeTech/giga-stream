# 10 - Live Stream Server (development and test)

**Status: 2026-10-16.** The channels stream **playlists of real video files**, made once with the bundled
FFmpeg the way Giga Cut makes its test media (`D:\Projects\giga-cut\scripts\ui-cases\fixture.mjs`). Streaming
one fixture file per channel, found and loaded through the shared folder scanner, is built and verified
(its tests and the headless-Chrome playback tests pass); playlists (section 2, item 3) are being built.
Encode mode has never been run.

A repository tool that publishes real, continuously running HLS live channels for development and
tests, so the Live surface, the channel refresh and probe, hls.js, quality, audio, captions and the
failure treatments are exercised against genuine live streams of genuine video files. It is not a
production program and never ships in the packaged app. The admin backend's seeded channels point
straight at it (`03` section 7.7); nothing sits between the player and it.

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
2. **Several channels** matching the admin backend's seeded channels (ids, names, numbers, categories,
   logos), each visually and audibly distinct so a test can tell which channel is on screen.
3. **Each channel plays a playlist of videos** (owner, 2026-10-16), like a broadcast schedule: an ordered list
   of video files played one after another, the whole list looping forever. Never a generator rendered
   live. A channel's list is either:
   - `playlist`: named fixture files (section 2.1), as the four test channels use; or
   - `folder`: a folder on disk, read with the shared folder scanner (`src/shared/media`); every playable
     video in it plays, in path order, so a channel can stream any set of real videos.
4. **Two modes.**
   - `encode`: one real-time ffmpeg per channel reads the list through FFmpeg's concat demuxer in a loop
     (`-re -stream_loop -1 -f concat -i <list>`) and encodes the live ladder. Realistic timing, encoder
     load and segment cadence; for development and latency work. The files of one list must share their
     codecs, size and rate (the fixtures do).
   - `loop`: no encoder while running. Each video is encoded once into a multi-variant VOD HLS ladder,
     cached under the output folder; the channel's schedule is their segments in list order, served as a
     live sliding window computed from the wall clock (media sequence = elapsed time / segment duration),
     wrapping at the end of the list. Deterministic, cheap and fast to start; the default for tests.
   - In both, each switch to the next video is an `EXT-X-DISCONTINUITY` (the next file's timestamps start
     again), and captions follow each video when the channel is captioned.
   - `/channels.json` lists each channel's playlist (each video's name and length) and the video playing
     now.
5. **Fault injection** on demand, per channel, to drive Live's failure treatments (`06` section 3.1):
   `stall` (the playlist stops advancing), `segment-404`, `slow-segments`, `playlist-500`,
   `discontinuity`, `restart` (the media sequence resets), `end` (`EXT-X-ENDLIST`), and recovery.
6. **Run during development and tests.** One command for a developer; a programmatic start on a free
   port with an isolated output folder for harnesses; clean shutdown; no stale segments left behind.
7. **Offline.** No network; it uses only the bundled ffmpeg, found and run through the shared media
   library (`src/shared/media`, `01` section 4.2).
8. **Never in the product.** Not imported by the interface, the fileserver or the backend; not packaged.

### 2.1 The fixture files

Made by `scripts/fixtures/make-fixtures.mjs` with the bundled FFmpeg, following Giga Cut's fixture
script: each file is a real H.264 + AAC MP4 (and, where listed, an SRT caption file beside it), made from
FFmpeg's test sources so the picture and tone tell one file from another (the bundled build has no font,
so nothing is drawn in text). They are made once per machine into a versioned cache
(`<temp>/giga-stream-fixtures-v<N>`; raising `N` remakes them) and never committed. The live server makes
any that are missing when it starts, so nothing has to be prepared by hand.

Three programmes per channel, each with its own picture and tone, so a viewer and a test can tell which
one is playing; lengths differ so the switches fall at different times. The bundled build's picture
sources are `testsrc2`, `smptehdbars`, `mandelbrot`, `color` and `nullsrc`, varied with `hue` and `hflip`.

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

Every programme of a captioned channel (`fx-news`) has an SRT beside it (`live/news-1.en.srt`, ...): one
numbered cue every 5 s naming the programme. All files are 1920x1080 at 30 fps; video is H.264 High,
yuv420p, a keyframe every 2 s (so 2 s segments cut cleanly), audio AAC stereo at 48 kHz, so the files of one
list can be joined by the concat demuxer. The same
script makes the Library's folder fixtures (your own video files: several containers, a nested folder,
and one unreadable file) when phase 6 of `08` needs them; they are listed here then.

## 3. Shape

```text
scripts/live-server/
  live-server.mjs        entry and startLiveServer(): parse options, start channels and the server, stop
  channel-catalog.mjs    reads channels.json; validates ids, names, numbers, categories, modes, playlists
  channel-playlist.mjs   finds and loads each channel's videos: fixture files, or a folder through the scanner
  channel-recipe.mjs     a channel's variants, audio and captions as ffmpeg maps and flags
  channels.json          the four channels and their playlists (match the backend's seed)
  encoder-args.mjs       encode mode's ffmpeg arguments (the concat list, looped)
  encoder-channel.mjs    encode mode: spawns and supervises one ffmpeg per channel
  loop-source-args.mjs   the one-off VOD encode of one video
  loop-source.mjs        encodes and loads each video once, cached per file, and joins them into a schedule
  loop-channel.mjs       loop mode: the wall-clock window over the schedule
  live-playlist.mjs      renders media and master playlists (pure)
  playlist-parse.mjs     reads playlists (pure)
  playlist-edit.mjs      rewrites them for faults (pure)
  fault-state.mjs        per-channel fault switches and their effect on playlists and segments
  http-server.mjs        node:http: the routes below, CORS, cache headers, Range
  http-response.mjs      response helpers
  control-routes.mjs     the fault routes
  mime-types.mjs         content types
  logo-png.mjs           the generated channel logos
  process-tree.mjs       stopping ffmpeg children cleanly
  test-page.mjs          an optional player page for manual checks
  test/                  channel-catalog, encoder-args, fault-state, http-server, live-playlist,
                         loop-channel; hls-playback (opt-in, headless Chrome + hls.js)
```

It uses Node built-ins and the shared media library (`src/shared/media`) to find and run FFmpeg; the
Chrome check drives DevTools with Node's built-in `WebSocket`.

### 3.1 Routes

| Route | Purpose |
|---|---|
| `GET /healthz` | Liveness, mode, channel count |
| `GET /channels.json` | The running channels: id, name, number, category, mode, master URL, logo URL, state, fault, renditions |
| `GET|HEAD /live/:channelId/master.m3u8` | Multi-variant master |
| `GET|HEAD /live/:channelId/:rendition/index.m3u8` | Media playlist (`no-store`) |
| `GET|HEAD /live/:channelId/:rendition/:segment` | Segment bytes (Range, immutable cache) |
| `GET /logos/:channelId.png` | The channel's logo |
| `POST /control/:channelId/fault` | Body `{ fault, durationMs?, delayMs? }`; one of the faults in section 2 |
| `POST /control/:channelId/clear` | Back to normal |
| `GET /test/player.html` | Only with `--test-page` |

Playlists are `application/vnd.apple.mpegurl` with `cache-control: no-store`; segments `video/mp2t`;
subtitles `text/vtt`. Every response carries CORS headers, and they are load-bearing: the interface
loads playlists and segments from this port directly. Control routes answer loopback peers only.

### 3.2 Channels

| Id | Name | Category | Playlist (section 2.1) | Captions | Variants | Purpose |
|---|---|---|---|---|---|---|
| `fx-news` | Fixture News | News | `news-1`, `news-2`, `news-3` (90 s) | yes | 360p, 720p | the captions row; the first channel |
| `fx-sports` | Fixture Sports | Sports | `sports-1`, `sports-2`, `sports-3` (90 s) | no | 360p, 720p, 1080p | quality switching under three variants |
| `fx-music` | Fixture Music | Music | `music-1`, `music-2`, `music-3` (90 s) | no | 360p, 720p | the audio-only rendition listed |
| `fx-kids` | Fixture Kids | Kids | `kids-1`, `kids-2`, `kids-3` (90 s) | no | 360p, 720p | search and category filtering |

## 4. How it runs

| Context | Command | Behaviour |
|---|---|---|
| Developer | `node scripts/live-server/live-server.mjs` (the root `live:dev` script) | **encode** mode (the command line's default) on port 8097, all channels, output under `.live-server/` (gitignored) |
| Test streams for the app | `node scripts/live-server/live-server.mjs --mode loop --port 8097` | loop mode on the port the seeded channels name |
| One channel | `node scripts/live-server/live-server.mjs --channel fx-news --mode encode` | for latency or encoder experiments |
| A harness | `startLiveServer({ mode: "loop", port: 0, outDir })` | a free port and an isolated output folder; returns `{ url, port, pid, mode, channels, outDir, faults, stop() }` |

Options: `--mode encode|loop`, `--port` (8097), `--out` (`.live-server/`), `--channel` (repeatable),
`--test-page`. When it is listening it prints `LIVE_SERVER_READY {json}`.

**It stops when its stdin closes** if stdin is not a terminal, which is how a harness stops it. Started
in the background from a shell, it exits at once unless stdin is held open (for example
`tail -f /dev/null | node scripts/live-server/live-server.mjs --mode loop --port 8097`). It also stops on
`SIGINT` and `SIGTERM`, and stopping it stops every ffmpeg it started.

## 5. Acceptance

- The master lists at least two video levels and the audio group; captions on `fx-news`.
- Playback starts within 5 s; `currentTime` advances within 10 percent of wall time over 20 s.
- Latency stays within the window (at most three segments plus one of slack).
- ABR reaches the top level on loopback; audio decodes.
- A fault that stops a stream (`segment-404`, `playlist-500`, `end`, a long `stall`) brings up Live's
  failure note (`06` section 3.1); after `clear`, its Retry plays the channel again without reloading
  the page. Which note each fault produces is not otherwise specified.
- Each channel plays its programmes in order, switching at their lengths (each switch an
  `EXT-X-DISCONTINUITY`), and keeps playing when the list loops; `/channels.json` names the one playing.
- A channel given a `folder` plays every playable video the scanner finds there, in path order.
- With the fixture cache emptied, the server makes the files and starts without help.
- Stopping the server leaves no ffmpeg process and no output folder.

The pure tests run with `node --test scripts/live-server/test/*.test.mjs`. The browser check is opt-in
(`LIVE_SERVER_BROWSER=1`) because it needs Chrome.
