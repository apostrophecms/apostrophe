#!/bin/bash
# Start, stop and inspect ~/apostrophecms/astro-public-demo (Apostrophe backend
# on 3000, Astro frontend on 4321), logging both to claude-tools/logs so the
# output can be read later without re-running anything.
#
#   ./claude-tools/astro-demo.sh start        # both, in the background
#   ./claude-tools/astro-demo.sh start-backend
#   ./claude-tools/astro-demo.sh stop
#   ./claude-tools/astro-demo.sh status
#   ./claude-tools/astro-demo.sh log backend|frontend [lines]
#
# Run ./claude-tools/link-astro-demo.sh link first to test the working tree
# rather than the published packages.

set -u

root="$(cd "$(dirname "$0")/.." && pwd)"
demo="${ASTRO_DEMO:-$HOME/apostrophecms/astro-public-demo}"
logdir="$root/claude-tools/logs"
mkdir -p "$logdir"

backend_log="$logdir/astro-demo-backend.log"
frontend_log="$logdir/astro-demo-frontend.log"
backend_pid="$logdir/astro-demo-backend.pid"
frontend_pid="$logdir/astro-demo-frontend.pid"

start_backend() {
  stop_one "$backend_pid" backend
  : > "$backend_log"
  # nodemon restarts on every file change under node_modules/apostrophe, which
  # is a symlink to the working tree here — noisy and slow. Run node directly
  (cd "$demo/backend" && \
    APOS_EXTERNAL_FRONT_KEY=dev APOS_DEV=1 \
    node app.js >> "$backend_log" 2>&1 & echo $! > "$backend_pid")
  echo "backend starting (pid $(cat "$backend_pid")), log: $backend_log"
}

start_frontend() {
  stop_one "$frontend_pid" frontend
  : > "$frontend_log"
  (cd "$demo/frontend" && \
    APOS_EXTERNAL_FRONT_KEY=dev \
    npx astro dev >> "$frontend_log" 2>&1 & echo $! > "$frontend_pid")
  echo "frontend starting (pid $(cat "$frontend_pid")), log: $frontend_log"
}

stop_one() {
  local file="$1" name="$2"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file")"
    if kill -0 "$pid" 2>/dev/null; then
      pkill -P "$pid" 2>/dev/null
      kill "$pid" 2>/dev/null
      sleep 1
      kill -9 "$pid" 2>/dev/null
      echo "stopped $name (pid $pid)"
    fi
    rm -f "$file"
  fi
}

wait_for() {
  local url="$1" name="$2" tries="${3:-60}"
  for ((i = 0; i < tries; i++)); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      echo "$name is up: $url"
      return 0
    fi
    sleep 1
  done
  echo "$name did NOT come up at $url after ${tries}s" >&2
  return 1
}

case "${1:-status}" in
  start)
    start_backend
    wait_for http://localhost:3000/ backend 90 || { tail -30 "$backend_log"; exit 1; }
    start_frontend
    wait_for http://localhost:4321/ frontend 90 || { tail -30 "$frontend_log"; exit 1; }
    ;;
  start-backend)
    start_backend
    wait_for http://localhost:3000/ backend 90 || { tail -30 "$backend_log"; exit 1; }
    ;;
  start-frontend)
    start_frontend
    wait_for http://localhost:4321/ frontend 90 || { tail -30 "$frontend_log"; exit 1; }
    ;;
  stop)
    stop_one "$frontend_pid" frontend
    stop_one "$backend_pid" backend
    ;;
  status)
    for pair in "$backend_pid:backend" "$frontend_pid:frontend"; do
      file="${pair%%:*}"; name="${pair##*:}"
      if [[ -f "$file" ]] && kill -0 "$(cat "$file")" 2>/dev/null; then
        echo "$name running (pid $(cat "$file"))"
      else
        echo "$name not running"
      fi
    done
    ;;
  log)
    case "${2:-backend}" in
      backend) tail -n "${3:-40}" "$backend_log" ;;
      frontend) tail -n "${3:-40}" "$frontend_log" ;;
      *) echo "usage: $0 log backend|frontend [lines]" >&2; exit 2 ;;
    esac
    ;;
  *)
    echo "usage: $0 [start|start-backend|start-frontend|stop|status|log]" >&2
    exit 2
    ;;
esac
