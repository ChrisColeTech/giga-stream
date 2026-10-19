#!/usr/bin/env bash
# The single giga-stream Render service: BOTH programs, one public port.
#
# The fileserver is public on $PORT: the interface at /, its own /api, and the
# reverse proxy that forwards /admin (prefix stripped, so the console's built
# /admin/ asset addresses land on the backend's /assets), /api/admin (identity),
# /live and /logos to the admin backend. The backend is the loopback sibling on
# BACKEND_PORT (default 8191, the fileserver's own production default, so the
# saved admin address matches): the console from its public/ folder, the
# /api/admin routes and the live streams.
#
# Either process exiting ends the service, so Render restarts the pair whole.
# render.yaml points startCommand here.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${BACKEND_PORT:=8191}"
export BACKEND_PORT
# One hop behind the fileserver's proxy, which forwards the caller's address.
export ADMIN_PROXY_TARGET="${ADMIN_PROXY_TARGET:-http://127.0.0.1:$BACKEND_PORT}"

# The backend must never take the public $PORT: it is loopback-only, so its
# PORT is set to the sibling port for this process alone.
PORT="$BACKEND_PORT" node src/backend/dist/server.js &
backend=$!
node src/fileserver/dist/server.js &
fileserver=$!

trap 'kill "$backend" "$fileserver" 2>/dev/null || true' EXIT
# wait -n returns when EITHER child exits; a clean exit is still a dead half,
# so the service always ends non-zero and Render replaces the whole pair.
wait -n "$backend" "$fileserver" || true
exit 1
