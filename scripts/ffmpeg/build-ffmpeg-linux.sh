#!/usr/bin/env bash
# Build the Debian 12 x64 FFmpeg payload used by Render. Run inside Debian 12;
# scripts/ffmpeg/build-linux-wsl.sh creates that environment from WSL.
set -euo pipefail

SRC="${SRC:-/build/ffmpeg-9.0.1}"
STAGE="${STAGE:-/build/giga-ffmpeg}"
OUT="${OUT:-/out}"
JOBS="${JOBS:-$(nproc)}"
DEPS="$STAGE/deps"

[[ -x "$SRC/configure" ]] || { echo "FFmpeg source not found at $SRC" >&2; exit 1; }
for package in libx264-dev libssl-dev zlib1g-dev; do
  dpkg-query -W -f='${Status}' "$package" 2>/dev/null | grep -q "ok installed" || {
    echo "missing Debian build package: $package" >&2
    exit 1
  }
done

rm -rf "$STAGE"
mkdir -p "$STAGE/build" "$STAGE/install" "$DEPS/lib/pkgconfig" "$OUT"
for archive in libx264.a libssl.a libcrypto.a libz.a; do
  found="$(find /usr/lib -name "$archive" -print -quit)"
  [[ -n "$found" ]] || { echo "missing static archive: $archive" >&2; exit 1; }
  cp "$found" "$DEPS/lib/"
done
for package in x264 openssl libssl libcrypto zlib; do
  source_pc="$(find /usr/lib -path '*/pkgconfig/'"$package"'.pc' -print -quit)"
  [[ -n "$source_pc" ]] || { echo "missing pkg-config file: $package.pc" >&2; exit 1; }
  sed -e "s|^prefix=.*|prefix=$DEPS|" \
    -e 's|^libdir=.*|libdir=${prefix}/lib|' \
    -e 's|^includedir=.*|includedir=/usr/include|' \
    "$source_pc" > "$DEPS/lib/pkgconfig/$package.pc"
done

export LC_ALL=C
export TZ=UTC
export SOURCE_DATE_EPOCH=0
export PKG_CONFIG_LIBDIR="$DEPS/lib/pkgconfig"

FILTERS="aresample,color,format,hflip,hue,mandelbrot,null,scale,sine,smptehdbars,testsrc2,thumbnail"
ENCODERS="libx264,mjpeg,png,rawvideo,aac,pcm_s16le,pcm_s24le,pcm_f32le,wrapped_avframe,webvtt,subrip"
MUXERS="mp4,mov,matroska,webm,image2,image2pipe,rawvideo,wav,pcm_s16le,pcm_f32le,null,adts,hls,segment,mpegts,webvtt"
PROTOCOLS="file,pipe,http,https,tls,tcp,crypto,data,httpproxy"

cd "$STAGE/build"
"$SRC/configure" \
  --prefix="$STAGE/install" \
  --pkg-config-flags=--static \
  --extra-cflags="-ffile-prefix-map=$SRC=." \
  --extra-ldflags="-L$DEPS/lib -Wl,-z,relro,-z,now" \
  --disable-doc --disable-debug --disable-autodetect \
  --enable-static --disable-shared \
  --disable-programs --enable-ffmpeg --enable-ffprobe \
  --enable-network --enable-openssl --enable-zlib \
  --enable-gpl --enable-version3 --enable-libx264 \
  --disable-protocols --enable-protocol="$PROTOCOLS" \
  --disable-devices --enable-indev=lavfi \
  --disable-encoders --enable-encoder="$ENCODERS" \
  --disable-muxers --enable-muxer="$MUXERS" \
  --disable-filters --enable-filter="$FILTERS" \
  > "$STAGE/configure.log" 2>&1 || { tail -60 "$STAGE/configure.log"; exit 1; }

make -j"$JOBS" > "$STAGE/make.log" 2>&1 || { tail -80 "$STAGE/make.log"; exit 1; }
make install > "$STAGE/install.log" 2>&1 || { tail -40 "$STAGE/install.log"; exit 1; }
install -m 0755 "$STAGE/install/bin/ffmpeg" "$STAGE/install/bin/ffprobe" "$OUT/"
cp "$STAGE/configure.log" "$OUT/configure.log"
dpkg-query -W -f='${Package}=${Version}\n' \
  gcc libc6-dev libx264-dev libssl-dev make nasm pkg-config zlib1g-dev \
  > "$OUT/library-revisions.txt"
(cd "$OUT" && sha256sum ffmpeg ffprobe > SHA256SUMS)
"$OUT/ffmpeg" -hide_banner -version | head -1
echo BUILD-OK
