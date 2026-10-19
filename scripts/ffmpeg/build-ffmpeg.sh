#!/usr/bin/env bash
# Build Giga Stream's Windows ffmpeg 9.0.1 into tools/ffmpeg/win32-x64/bin (docs/09-FFMPEG-BUILD.md).
#
# Start from GigaCut's component set (D:\Projects\giga-cut-rust\tools\ffmpeg\bin\configure.log)
# and add exactly what streaming and its fixtures need:
#   - network: http, https, tls (Windows Schannel), tcp, crypto, data, httpproxy (HLS input is the
#     hls demuxer, already in GigaCut's set; FFmpeg 9 has no separate hls protocol)
#   - HLS out: hls, segment, mpegts and webvtt muxers; webvtt and subrip encoders
#   - raw audio out: the pcm_f32le muxer (`-f f32le`) and encoder (the desktop player's sound)
#   - stills: the thumbnail filter
#   - live fixture channels (docs/10): hue, smptehdbars and mandelbrot test sources
# Adding a component means adding it to the lists below, never swapping in a downloaded build.
#
# Run from MSYS2 (MINGW64), with the static dependencies already under $DEPS:
#   MSYSTEM=MINGW64 /c/msys64/usr/bin/bash -lc "bash /d/Projects/giga-stream/scripts/ffmpeg/build-ffmpeg.sh"
# Environment: SRC (unpacked ffmpeg-9.0.1), DEPS, STAGE (build scratch), OUT (install), JOBS.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${SRC:-/d/ffbuild-staging/src/ffmpeg-9.0.1}"
DEPS="${DEPS:-/d/ffbuild/deps}"
STAGE="${STAGE:-/d/ffbuild-stream}"
OUT="${OUT:-$REPO/tools/ffmpeg/win32-x64/bin}"
JOBS="${JOBS:-16}"

[[ -x "$SRC/configure" ]] || { echo "ffmpeg source not found at $SRC" >&2; exit 1; }
[[ -d "$DEPS/lib-static" ]] || { echo "static dependencies not found at $DEPS" >&2; exit 1; }

export PKG_CONFIG_PATH="$DEPS/lib/pkgconfig:${PKG_CONFIG_PATH:-}"

PROTOCOLS="file,pipe,http,https,tls,tcp,crypto,data,httpproxy"
FILTERS="adelay,afade,aformat,amix,anull,anullsrc,apad,aresample,areverse,asetpts,asettb,asplit,\
atempo,atrim,color,concat,copy,crop,fade,format,fps,hflip,loop,loudnorm,null,nullsrc,overlay,pad,\
reverse,rubberband,scale,select,setpts,setsar,settb,sine,split,testsrc2,tile,transpose,trim,vflip,\
vidstabdetect,vidstabtransform,unsharp,volume,zoompan,xfade,acrossfade,geq,blend,rotate,\
colorchannelmixer,stereotools,asetrate,pan,join,channelsplit,channelmap,amerge,minterpolate,\
thumbnail,hue,smptehdbars,mandelbrot"
ENCODERS="libx264,libx265,h264_nvenc,hevc_nvenc,mjpeg,png,rawvideo,aac,pcm_s16le,wrapped_avframe,\
prores_ks,qtrle,pcm_s24le,libvpx_vp9,pcm_f32le,webvtt,subrip"
MUXERS="mp4,mov,matroska,webm,image2,image2pipe,rawvideo,wav,pcm_s16le,null,adts,\
hls,segment,mpegts,webvtt,pcm_f32le"

rm -rf "$STAGE/build" "$STAGE/out"
mkdir -p "$STAGE/build" "$STAGE/out" "$OUT"
cd "$STAGE/build"

"$SRC/configure" \
  --prefix="$STAGE/out" \
  --pkg-config-flags=--static \
  --disable-doc --disable-debug --disable-autodetect \
  --enable-network --enable-schannel \
  --enable-shared --disable-static \
  --extra-ldflags="-static-libgcc -static-libstdc++ -L$DEPS/lib-static" \
  --extra-libs="-Wl,-Bstatic -lwinpthread -Wl,-Bdynamic" \
  --disable-programs --enable-ffmpeg --enable-ffprobe \
  --disable-protocols --enable-protocol="$PROTOCOLS" \
  --disable-devices --enable-indev=lavfi \
  --disable-encoders --enable-encoder="$ENCODERS" \
  --disable-muxers --enable-muxer="$MUXERS" \
  --disable-filters --enable-filter="$FILTERS" \
  --enable-zlib --enable-gpl \
  --enable-libx264 --enable-libx265 --enable-libvidstab --enable-librubberband \
  --enable-libdav1d --enable-libvpx \
  --enable-nvenc --enable-ffnvcodec \
  --enable-d3d11va --enable-dxva2 \
  > "$STAGE/configure.log" 2>&1 || { tail -40 "$STAGE/configure.log"; exit 1; }

make -j"$JOBS" > "$STAGE/make.log" 2>&1 || { tail -60 "$STAGE/make.log"; exit 1; }
make install > "$STAGE/install.log" 2>&1 || { tail -30 "$STAGE/install.log"; exit 1; }

# Ship the programs and their DLLs only, plus the record of what went in.
find "$OUT" -maxdepth 1 -type f \( -name '*.exe' -o -name '*.dll' \) -delete
cp "$STAGE/out/bin/"*.exe "$STAGE/out/bin/"*.dll "$OUT/"
cp "$STAGE/configure.log" "$OUT/configure.log"
for lib in x264 x265 dav1d libvpx rubberband vid.stab; do
  pacman -Q "mingw-w64-x86_64-$lib" 2>/dev/null || true
done > "$OUT/library-revisions.txt"

"$OUT/ffmpeg.exe" -hide_banner -version | head -1
echo BUILD-OK
