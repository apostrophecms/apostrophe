#!/bin/bash
# Run a single apostrophe core mocha spec against a chosen DB adapter and log
# output to claude-tools/logs/spec-<name>-<adapter>.log. Usage:
#
#   ./claude-tools/run-core-spec.sh test/rich-text-field.js
#   ./claude-tools/run-core-spec.sh test/rich-text-field.js postgres
#   ./claude-tools/run-core-spec.sh test/rich-text-field.js sqlite
#
# Defaults to the mongodb adapter. NEVER run multiple adapters or multiple
# specs in parallel — the test suite is not designed for concurrent runs and
# the host has limited resources.

set -u
spec="${1:-}"
adapter="${2:-mongodb}"
if [[ -z "$spec" ]]; then
  echo "usage: $0 <test/spec.js> [mongodb|postgres|sqlite]" >&2
  exit 2
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
logdir="$root/claude-tools/logs"
mkdir -p "$logdir"
name="$(basename "$spec" .js)"
log="$logdir/spec-$name-$adapter.log"
: > "$log"

echo "=== $spec ($adapter) $(date -Is) ===" | tee -a "$log"

cd "$root/packages/apostrophe"

extra=()
if [[ "$adapter" == "postgres" ]]; then
  extra=(env PGPASSWORD=testpassword)
fi

APOS_TEST_DB_PROTOCOL="$adapter" "${extra[@]}" npx mocha -t 20000 "$spec" >> "$log" 2>&1
code=$?
echo "=== exit=$code ===" | tee -a "$log"

echo
echo "--- failures ---"
grep -nE "^\s+[0-9]+\) |failing|passing|pending" "$log" | head -60

# A spec that never reached the database still prints "N passing" for whatever
# ran before the connection was attempted, so a passing count on its own proves
# nothing about the adapter. Say so loudly instead.
if grep -q "startup-error" "$log"; then
  echo
  echo "!!! STARTUP ERROR — this run never connected to $adapter, the counts above are meaningless"
  grep -m3 "startup-error" -A2 "$log"
  code=1
fi

echo "--- full log: $log ---"
exit "$code"
