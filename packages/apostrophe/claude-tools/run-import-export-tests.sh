#!/bin/bash
# Run the @apostrophecms/import-export test suite against a chosen DB adapter and
# log output to claude-tools/logs/import-export-<adapter>.log. Usage:
#
#   ./claude-tools/run-import-export-tests.sh mongodb
#   ./claude-tools/run-import-export-tests.sh sqlite
#   ./claude-tools/run-import-export-tests.sh sqlite test/gzip-extract.js   # one file
#   ./claude-tools/run-import-export-tests.sh mongodb "" "locale"           # mocha --grep
#
# Arg 2 limits the run to specific spec file(s); arg 3 is passed to --grep.
# The package's own `npm test` splits the run (test/import-page.js is run
# separately because it cannot share a process with the rest), so this script
# mirrors that split when running the whole suite.
#
# NEVER run multiple adapters in parallel — the test suite is not designed
# for concurrent runs and the host has limited resources.

set -u
adapter="${1:-mongodb}"
spec="${2:-}"
grep_filter="${3:-}"

root="$(cd "$(dirname "$0")/.." && pwd)"
logdir="$root/claude-tools/logs"
mkdir -p "$logdir"
log="$logdir/import-export-$adapter.log"
: > "$log"

echo "=== $adapter import-export tests ($(date -Is)) spec='${spec}' grep='${grep_filter}' ===" | tee -a "$log"

cd "$root/packages/import-export"

extra=()
if [[ "$adapter" == "postgres" ]]; then
  extra=(env PGPASSWORD=testpassword)
fi

mocha_args=(-t 25000)
if [[ -n "$grep_filter" ]]; then
  mocha_args+=(--grep "$grep_filter")
fi

code=0
if [[ -n "$spec" ]]; then
  APOS_TEST_DB_PROTOCOL="$adapter" "${extra[@]}" ../../node_modules/.bin/mocha \
    "${mocha_args[@]}" "$spec" >> "$log" 2>&1 || code=$?
else
  # Whole suite: same split the package's npm test script uses.
  APOS_TEST_DB_PROTOCOL="$adapter" "${extra[@]}" ../../node_modules/.bin/mocha \
    "${mocha_args[@]}" --ignore=test/import-page.js >> "$log" 2>&1 || code=$?
  APOS_TEST_DB_PROTOCOL="$adapter" "${extra[@]}" ../../node_modules/.bin/mocha \
    "${mocha_args[@]}" test/import-page.js >> "$log" 2>&1 || code=$?
fi

echo "=== exit=$code ===" | tee -a "$log"

echo ""
echo "----- SUMMARY -----"
grep -nE "passing|failing|pending" "$log" | tail -6
echo "----- FAILURES (if any) -----"
# Mocha prints failing tests as numbered "N) title" blocks; show them so there
# is never a need to re-run the suite just to find out what failed.
awk '/^  [0-9]+\) /{flag=1} flag{print} /^$/{if(flag>0)flag++} flag>4{flag=0}' "$log" | head -80
echo "-------------------"
echo "full log: $log"

exit "$code"
