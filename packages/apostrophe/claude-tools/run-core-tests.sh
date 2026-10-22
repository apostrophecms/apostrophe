#!/bin/bash
# Run the apostrophe core test suite against a chosen DB adapter and log
# output to claude-tools/logs/core-<adapter>.log. Usage:
#
#   ./claude-tools/run-core-tests.sh mongodb
#   ./claude-tools/run-core-tests.sh postgres
#   ./claude-tools/run-core-tests.sh sqlite
#
# NEVER run multiple adapters in parallel — the test suite is not designed
# for concurrent runs and the host has limited resources.

set -u
adapter="${1:-}"
if [[ -z "$adapter" ]]; then
  echo "usage: $0 <mongodb|postgres|sqlite>" >&2
  exit 2
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
logdir="$root/claude-tools/logs"
mkdir -p "$logdir"
log="$logdir/core-$adapter.log"
: > "$log"

echo "=== $adapter core tests ($(date -Is)) ===" | tee -a "$log"

cd "$root/packages/apostrophe"

extra=()
if [[ "$adapter" == "postgres" ]]; then
  extra=(env PGPASSWORD=testpassword)
fi

APOS_TEST_DB_PROTOCOL="$adapter" "${extra[@]}" npm run test:base >> "$log" 2>&1
code=$?
echo "=== exit=$code ===" | tee -a "$log"
exit "$code"
