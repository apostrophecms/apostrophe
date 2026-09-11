#!/bin/bash
# Run the apostrophe core mocha suite serially, logging everything so the
# failures can be read afterwards without running it again.
#
#   ./claude-tools/run-core-suite.sh                 # whole suite, mongodb
#   ./claude-tools/run-core-suite.sh test/pages.js   # one or more specs
#   APOS_TEST_DB_PROTOCOL=postgresql ./claude-tools/run-core-suite.sh
#
# Afterwards:
#   ./claude-tools/run-core-suite.sh --failures      # which tests failed
#
# The suite is designed to run one spec at a time; never add -j or run two
# copies of this at once.
#
# For a handful of specs with a separate log and exit status per spec, use
# run-core-specs.sh instead. This one is for the whole suite in one process.

set -u

root="$(cd "$(dirname "$0")/.." && pwd)"
pkg="$root/packages/apostrophe"
logdir="$root/claude-tools/logs"
mkdir -p "$logdir"

protocol="${APOS_TEST_DB_PROTOCOL:-mongodb}"
log="$logdir/core-$protocol.log"

if [[ "${1:-}" == "--failures" ]]; then
  if [[ ! -f "$log" ]]; then
    echo "no log at $log" >&2
    exit 1
  fi
  echo "=== $log ==="
  grep -E '^\s+[0-9]+\) |passing|failing|pending' "$log"
  exit 0
fi

cd "$pkg" || exit 1

echo "protocol: $protocol"
echo "log:      $log"
: > "$log"

APOS_TEST_DB_PROTOCOL="$protocol" npx mocha -t 10000 "$@" >> "$log" 2>&1
status=$?

echo
echo "=== summary ==="
grep -E 'passing|failing|pending' "$log"

if [[ $status -ne 0 ]]; then
  echo
  echo "=== failing tests ==="
  # The numbered list mocha prints after the dots, one line per failure
  grep -E '^\s+[0-9]+\) ' "$log"
fi

echo
echo "exit: $status (full output in $log)"
exit $status
