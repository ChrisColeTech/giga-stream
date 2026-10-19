#!/usr/bin/env bash
# Build the single giga-stream Render service: the admin backend (the console
# staged into its public/ folder) and the fileserver (which serves the built
# interface from src/frontend/dist and reverse-proxies /admin (stripped),
# /api/admin, /live and /logos to the backend over loopback).
# render.yaml points buildCommand here.
set -euo pipefail
cd "$(dirname "$0")/.."

# The backend and fileserver carry electron as a devDependency (the desktop
# hosts they power locally). No electron binary is needed to build or run the
# servers, so the download is skipped — several hundred MB saved per deploy.
export ELECTRON_SKIP_BINARY_DOWNLOAD=1

for tool in ffmpeg ffprobe; do
  test -x "tools/ffmpeg/linux-x64/bin/$tool" || {
    echo "missing executable tools/ffmpeg/linux-x64/bin/$tool" >&2
    exit 1
  }
done

# Each program owns its package.json and lockfile (no root workspaces, docs/01).
# Render sets NODE_ENV=production for the service, and npm then skips devDependencies. Every program's
# build runs tsc and vite, which are devDependencies (with @types/node and the Tailwind plugin), so the
# installs ask for them with --include=dev; the runtime keeps NODE_ENV=production.
install_program() {
  local program="$1"
  echo "── installing src/$program"
  (cd "src/$program" && { npm ci --include=dev --no-audit --no-fund || npm install --include=dev --no-audit --no-fund; })
}

install_and_build() {
  local program="$1" script="$2"
  install_program "$program"
  echo "── building src/$program"
  (cd "src/$program" && eval "$script")
}

# The admin and the interface typecheck and bundle the shared library sources, which resolve react, zod and lucide
# from src/shared/<pkg>/node_modules, so those packages are installed before either builds.
install_program shared/ui
install_program shared/http
install_and_build admin "npm run build"
node scripts/stage-admin-public.mjs
install_and_build frontend "npm run build"
install_and_build backend "npm run build"
install_and_build fileserver "npm run build"

echo "── build complete"
