# 09 - The FFmpeg build

**Status: verified 2026-10-16** (the verify script's offline checks all pass; the binary's own build
configuration matches section 2). Giga Stream builds its own `ffmpeg.exe` and `ffprobe.exe` (FFmpeg
9.0.1) into `tools/ffmpeg/bin` (gitignored). It is not a downloaded general-purpose build: it starts
from GigaCut Rust's component set and adds exactly what streaming needs, following the method of
`D:\Projects\giga-extension\docs\05-FFMPEG-BUILD.md` (enable only what the product uses; the configure
log beside the binaries is the record).

Build script: `scripts/ffmpeg/build-ffmpeg.sh`. Verify script: `scripts/ffmpeg/verify-ffmpeg.ps1`.

## 1. What uses it

| User | Job | Needs |
|---|---|---|
| The fixture files and the streaming test server (`10`) | Making the fixture files (`10` section 2.1); encoding a file into a multi-variant VOD HLS ladder with an audio group and WebVTT subtitles (loop mode), and looping a file into a continuously updated sliding-window playlist (encode mode) | lavfi `testsrc2`, `smptehdbars`, `mandelbrot`, `sine`; `hflip`, `hue`; `libx264`, `aac`; `hls`, `mpegts` and `webvtt` muxers; `srt` demuxer; `webvtt` encoder |
| Fileserver media probe and stills (the Library, phase 6 of `08`) | Duration, dimensions and codecs of a local file; a still per file | `ffprobe`, every decoder and demuxer, `thumbnail`, `scale`, `mjpeg`/`png` encoders |
| Decode paths and diagnostics | Reading remote HLS or media over HTTPS; raw RGBA and `f32le` audio | `http`, `https`, `tls` (Schannel), the `hls` demuxer, `rawvideo`, `pcm_f32le` |

The interface never runs ffmpeg; Live and Player play through `<video>` and hls.js (`02`).

## 2. What is in the build

Base: GigaCut Rust's 2026-10-12 build (`D:\Projects\giga-cut-rust\tools\ffmpeg\bin\configure.log`):
shared DLLs, every decoder, demuxer and parser, GigaCut's encoder, muxer and filter lists, the `lavfi`
input device, NVENC and D3D11VA/DXVA2, and the external libraries x264, x265, dav1d, libvpx,
rubberband and vid.stab. Added for Giga Stream:

| Component | Added | Why |
|---|---|---|
| Network | `--enable-network --enable-schannel` | HTTPS through Windows' own TLS; no OpenSSL |
| Protocols | `http, https, tls, tcp, crypto, data, httpproxy` (beside `file, pipe`) | Reading remote HLS and media. HLS input is the `hls` demuxer, already in GigaCut's set; FFmpeg 9 has no separate `hls` protocol |
| Muxers | `hls, segment, mpegts, webvtt, pcm_f32le` | HLS streams; raw float audio. The configure name is `pcm_f32le`; on the command line it is `-f f32le` |
| Encoders | `pcm_f32le, webvtt, subrip` | Float audio output; subtitle tracks in HLS |
| Filters | `thumbnail` | A representative still for a local file |
| Filters | `hue`, `smptehdbars`, `mandelbrot` | Distinct sources for the test server's channels (`10` section 3.2) |

Everything else stays off: no other protocols, devices or external libraries.

### 2.1 Licensing

`--enable-gpl` with x264 and x265: the binaries are **GPL version 2 or later**, as GigaCut's are.
They are separate executables the fileserver spawns. Shipping them in the packaged app needs the GPL
notice and a source offer (the FFmpeg 9.0.1 tarball and this script). An LGPL build would drop x264
and x265, and with them H.264 and HEVC encoding; only the test server encodes, so the shipped product
could use an LGPL decode-only variant if the owner prefers.

## 3. Rebuilding

### 3.1 Prerequisites

- MSYS2 at `C:\msys64` with the MinGW64 toolchain, `make`, `nasm` and `pkgconf`.
- Static dependencies under `D:\ffbuild\deps` (`lib-static/` with `libx264.a`, `libx265.a`,
  `libdav1d.a`, `libvpx.a`, `librubberband.a`, `libfftw3.a`, `libsamplerate.a`, `libz.a`,
  `libwinpthread.a`; `lib/pkgconfig/` with `x265.pc`, `vidstab.pc`, `ffnvcodec.pc`; the NVENC
  headers). Their package revisions are written to `tools/ffmpeg/bin/library-revisions.txt`.
- The FFmpeg 9.0.1 source, unpacked (default `D:\ffbuild-staging\src\ffmpeg-9.0.1`; the tarball is
  `D:\ffbuild\ffmpeg-9.0.1.tar.xz`).

### 3.2 Build

```powershell
$env:MSYSTEM = 'MINGW64'
C:\msys64\usr\bin\bash.exe -lc "bash /d/Projects/giga-stream/scripts/ffmpeg/build-ffmpeg.sh"
```

Environment overrides: `SRC`, `DEPS`, `STAGE` (scratch, default `D:\ffbuild-stream`), `OUT` (default
`tools/ffmpeg/bin`), `JOBS`. The script writes `configure.log`, `make.log` and `install.log` to
`STAGE`, and copies the programs, their DLLs, `configure.log` and `library-revisions.txt` to `OUT`.

## 4. Verifying a build

```powershell
pwsh scripts/ffmpeg/verify-ffmpeg.ps1                     # no network
pwsh scripts/ffmpeg/verify-ffmpeg.ps1 -HttpsUrl <url>     # adds a real HTTPS/HLS probe
```

One line per check: the version; the required protocols and components; a test MP4 (H.264 + AAC); an
RGBA decode and a one-second `f32le` decode (exactly 384,000 bytes); a still; the four channel sources
render; a multi-variant VOD HLS master with audio and subtitle groups; reading that HLS back; a live
sliding-window stream (no `EXT-X-ENDLIST` while running, the media sequence advancing); and the
optional HTTPS probe. The exit code is 0 only when all pass.

## 5. The commands, for reference

These are the encodes the verify script runs, and the shape the test server uses.

```powershell
$ff = 'tools\ffmpeg\bin\ffmpeg.exe'
# A Range-servable MP4
& $ff -f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 `
  -t 20 -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart video.mp4
# VOD HLS: two variants, one audio group, one WebVTT subtitle group (subs.srt is a small SRT file).
# The hls muxer takes subtitles only inside a video variant (s:N beside v:N); a subtitle-only
# variant fails with "No streams to mux".
& $ff -i video.mp4 -i subs.srt -map 0:v -map 0:v -map 0:a -map 1:s -map 1:s -c:v libx264 -pix_fmt yuv420p `
  -s:v:0 640x360 -b:v:0 800k -s:v:1 1280x720 -b:v:1 2500k -c:a aac -c:s webvtt `
  -var_stream_map "v:0,s:0,agroup:aud,sgroup:sub,name:360p v:1,s:1,agroup:aud,sgroup:sub,name:720p a:0,agroup:aud,language:en,name:audio" `
  -master_pl_name master.m3u8 -hls_time 2 -hls_playlist_type vod -hls_segment_filename "%v/seg%03d.ts" "%v/index.m3u8"
# A live stream: runs until stopped
& $ff -re -f lavfi -i testsrc2=size=1280x720:rate=30 -re -f lavfi -i sine=frequency=440:sample_rate=48000 `
  -c:v libx264 -preset veryfast -tune zerolatency -g 60 -pix_fmt yuv420p -c:a aac `
  -f hls -hls_time 2 -hls_list_size 6 -hls_flags delete_segments+program_date_time live/index.m3u8
```

Two facts about ffmpeg's HLS master output that a reader of it must handle:

- It writes one `SUBTITLES` entry per variant (`subtitle_0`, `subtitle_1`), each `DEFAULT=YES`, in the
  same group. The HLS specification allows one default per group, and a player lists both; the test
  server's `fx-news` channel shows both in the captions list.
- The audio-only rendition also appears as its own `EXT-X-STREAM-INF`. That is valid; something that
  counts video variants counts the entries with `RESOLUTION`.

## 6. History

| Date | Change |
|---|---|
| 2026-10-15 | First Giga Stream build: GigaCut's 9.0.1 set plus network (Schannel), the HLS, MPEG-TS, WebVTT and `pcm_f32le` muxers, the `pcm_f32le`, `webvtt` and `subrip` encoders and the `thumbnail` filter. The first attempt named the muxer `f32le` (configure ignores unknown names) and listed a nonexistent `hls` protocol; both corrected. Verified offline, and against the public Mux test stream (`https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`): ffprobe read every variant (H.264 + AAC) and a 2 s remote `f32le` decode gave 766,680 bytes (768,000 less AAC priming). |
| 2026-10-16 | Re-verified after the restart: every offline check passes and `ffmpeg -version`'s configuration matches section 2. The binaries are kept in the archive's `tools/` and restored to `tools/ffmpeg/bin` in phase 0 of `08`. |
