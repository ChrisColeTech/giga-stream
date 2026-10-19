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

# Each program owns its package.json and lockfile (no root workspaces, docs/01).
install_and_build() {
  local program="$1" script="$2"
  echo "── installing src/$program"
  (cd "src/$program" && { npm ci --no-audit --no-fund || npm install --no-audit --no-fund; })
  echo "── building src/$program"
  (cd "src/$program" && eval "$script")
}

install_and_build admin "npm run build"
node scripts/stage-admin-public.mjs
install_and_build frontend "npm run build"
install_and_build backend "npm run build"
install_and_build fileserver "npm run build"

echo "── build complete"
