#!/usr/bin/env bash
# Create a Debian 12 build root under WSL, run the Linux build, and copy its
# payload into the repository. Invoke from WSL at the repository root.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT="${ROOT:-/var/lib/giga-ffmpeg-bookworm}"
SOURCE_TAR="${SOURCE_TAR:-/mnt/d/ffbuild/ffmpeg-9.0.1.tar.xz}"

[[ -f "$SOURCE_TAR" ]] || { echo "FFmpeg source archive not found at $SOURCE_TAR" >&2; exit 1; }
command -v debootstrap >/dev/null || {
  sudo apt-get update
  sudo apt-get install -y debootstrap debian-archive-keyring
}
if [[ ! -x "$ROOT/bin/bash" ]]; then
  sudo debootstrap --arch=amd64 --variant=minbase bookworm "$ROOT" http://deb.debian.org/debian
fi

sudo mkdir -p "$ROOT/build" "$ROOT/out" "$ROOT/work"
sudo rm -rf "$ROOT/build/ffmpeg-9.0.1"
sudo tar -xJf "$SOURCE_TAR" -C "$ROOT/build"
sudo cp "$REPO/scripts/ffmpeg/build-ffmpeg-linux.sh" "$ROOT/work/"
sudo chroot "$ROOT" /bin/bash -lc \
  "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y build-essential nasm pkg-config libx264-dev libssl-dev zlib1g-dev ca-certificates && /work/build-ffmpeg-linux.sh"
mkdir -p "$REPO/tools/ffmpeg/linux-x64/bin"
sudo cp -a "$ROOT/out/." "$REPO/tools/ffmpeg/linux-x64/bin/"
sha256sum "$SOURCE_TAR" | awk '{ print $1 "  ffmpeg-9.0.1.tar.xz" }' \
  > "$REPO/tools/ffmpeg/linux-x64/bin/source-sha256.txt"
sudo chown -R "$(id -u):$(id -g)" "$REPO/tools/ffmpeg/linux-x64"
echo "Linux payload: $REPO/tools/ffmpeg/linux-x64/bin"
