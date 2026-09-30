#!/bin/bash
# Hunt intermittent failures in @apostrophecms/import-export by running the same
# spec repeatedly against one DB adapter, one run at a time. Usage:
#
#   ./claude-tools/repeat-import-export-tests.sh 30 sqlite
#   ./claude-tools/repeat-import-export-tests.sh 30 mongodb test/index.js
#   ./claude-tools/repeat-import-export-tests.sh 50 sqlite test/index.js "override"
#
# Each iteration writes claude-tools/logs/repeat-<adapter>/run-NNN.log, so a
# failure never has to be reproduced twice just to read its output. A summary
# naming the failing iterations and the failing test titles is printed at the
# end and also stored as summary.log in the same directory.
#
# NEVER run two of these at once: the suite is not designed for concurrent runs
# and the host has limited resources.

set -u
runs="${1:-20}"
adapter="${2:-mongodb}"
spec="${3:-test/index.js}"
grep_filter="${4:-}"

root="$(cd "$(dirname "$0")/.." && pwd)"
logdir="$root/claude-tools/logs/repeat-$adapter"
rm -rf "$logdir"
mkdir -p "$logdir"
summary="$logdir/summary.log"
: > "$summary"

cd "$root/packages/import-export"

extra=()
if [[ "$adapter" == "postgres" ]]; then
  extra=(env PGPASSWORD=testpassword)
fi

mocha_args=(-t 25000)
if [[ -n "$grep_filter" ]]; then
  mocha_args+=(--grep "$grep_filter")
fi

{
  echo "=== repeat: runs=$runs adapter=$adapter spec=$spec grep='${grep_filter}' ==="
  echo "=== started $(date -Is) ==="
} | tee -a "$summary"

failures=0
for ((i = 1; i <= runs; i++)); do
  log=$(printf "%s/run-%03d.log" "$logdir" "$i")
  code=0
  APOS_TEST_DB_PROTOCOL="$adapter" "${extra[@]}" ../../node_modules/.bin/mocha \
    "${mocha_args[@]}" "$spec" > "$log" 2>&1 || code=$?
  if [[ "$code" -ne 0 ]]; then
    failures=$((failures + 1))
    {
      printf 'run %03d: FAILED (exit=%d) -> %s\n' "$i" "$code" "$log"
      # Mocha's numbered "N) title" blocks name the specific failing tests.
      grep -E "^  [0-9]+\) |^       [0-9]+\) " "$log" | head -20
      grep -E "^ +(good|bad|total|[-+]) " "$log" | head -20
    } | tee -a "$summary"
  else
    printf 'run %03d: ok (%s)\n' "$i" "$(grep -oE '[0-9]+ passing' "$log" | tail -1)" | tee -a "$summary"
  fi
done

{
  echo "=== finished $(date -Is): $failures/$runs runs failed ==="
  echo "logs: $logdir"
} | tee -a "$summary"

exit 0
