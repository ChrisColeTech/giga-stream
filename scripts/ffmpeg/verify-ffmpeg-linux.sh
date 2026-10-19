#!/usr/bin/env bash
set -euo pipefail

BIN="${1:-$(cd "$(dirname "$0")/../.." && pwd)/tools/ffmpeg/linux-x64/bin}"
FFMPEG="$BIN/ffmpeg"
FFPROBE="$BIN/ffprobe"
[[ -x "$FFMPEG" && -x "$FFPROBE" ]]
"$FFMPEG" -hide_banner -version | grep -q 'ffmpeg version 9\.0\.1'
"$FFPROBE" -hide_banner -version | grep -q 'ffprobe version 9\.0\.1'

listing="$(
  "$FFMPEG" -hide_banner -protocols
  "$FFMPEG" -hide_banner -muxers
  "$FFMPEG" -hide_banner -demuxers
  "$FFMPEG" -hide_banner -encoders
  "$FFMPEG" -hide_banner -filters
)"
for item in https hls libx264 aac pcm_f32le webvtt png mjpeg thumbnail smptehdbars mandelbrot; do
  grep -q "$item" <<< "$listing" || {
    echo "missing FFmpeg component: $item" >&2
    exit 1
  }
done
if ldd "$FFMPEG" "$FFPROBE" | grep -Eq 'lib(x264|ssl|crypto|z)\.so'; then
  echo "a bundled dependency was linked dynamically" >&2
  exit 1
fi
(cd "$BIN" && sha256sum --check SHA256SUMS)

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
"$FFMPEG" -hide_banner -loglevel error -y \
  -f lavfi -i testsrc2=size=640x360:rate=30 \
  -f lavfi -i sine=frequency=440:sample_rate=48000 \
  -t 2 -c:v libx264 -pix_fmt yuv420p -c:a aac "$work/video.mp4"
codecs="$("$FFPROBE" -v error -show_entries stream=codec_name -of csv=p=0 "$work/video.mp4" | paste -sd, -)"
[[ "$codecs" = "h264,aac" ]] || { echo "unexpected fixture codecs: $codecs" >&2; exit 1; }
"$FFMPEG" -hide_banner -loglevel error -y -i "$work/video.mp4" \
  -vf thumbnail,scale=320:-2 -frames:v 1 "$work/still.jpg"
test -s "$work/still.jpg"
mkdir "$work/hls"
"$FFMPEG" -hide_banner -loglevel error -y -i "$work/video.mp4" \
  -c:v libx264 -c:a aac -f hls -hls_time 1 -hls_playlist_type vod "$work/hls/index.m3u8"
"$FFMPEG" -hide_banner -loglevel error -i "$work/hls/index.m3u8" -frames:v 1 -f null -
echo VERIFY-OK
