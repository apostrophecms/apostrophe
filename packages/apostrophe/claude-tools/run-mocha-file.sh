#!/usr/bin/env bash
# Run one (or more) mocha test files serially, logging full stdout+stderr to a
# file, then print a concise report of which specific tests passed/failed.
#
# Usage: claude-tools/run-mocha-file.sh <logfile> <test/file.js> [more files...]
# Env:   APOS_TEST_DB_PROTOCOL (mongodb|postgres|sqlite) is honored by the suite.
set -uo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: $0 <logfile> <test/file.js> [more files...]" >&2
  exit 2
fi

LOG="$1"; shift
cd "$(dirname "$0")/.." || exit 1

# One at a time. NEVER run our suites in parallel.
npx mocha -t 10000 "$@" > "$LOG" 2>&1
CODE=$?

echo "===== exit code: $CODE  (log: $LOG) ====="
echo "----- passing (✓/√) -----"
grep -aE '^\s*(✓|√|[0-9]+ passing)' "$LOG" | sed 's/^/  /'
echo "----- FAILING -----"
# Mocha marks failures as "  1) suite: title" and a summary "N failing".
grep -aE '^\s*[0-9]+\) |[0-9]+ failing' "$LOG" | sed 's/^/  /'
echo "----- last lines -----"
tail -n 5 "$LOG"
exit $CODE
