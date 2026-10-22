#!/bin/bash
# Run the @apostrophecms/form test suite against a chosen DB adapter and log
# output to claude-tools/logs/form-<adapter>.log. Usage:
#
#   ./claude-tools/run-form-tests.sh mongodb
#   ./claude-tools/run-form-tests.sh postgres
#   ./claude-tools/run-form-tests.sh sqlite
#   ./claude-tools/run-form-tests.sh mongodb "orphan"   # only tests matching grep
#
# The optional second argument is passed to `mocha --grep` so you can run
# just the tests you care about while iterating.
#
# NEVER run multiple adapters in parallel — the test suite is not designed
# for concurrent runs and the host has limited resources.

set -u
adapter="${1:-mongodb}"
grep_filter="${2:-}"

root="$(cd "$(dirname "$0")/.." && pwd)"
logdir="$root/claude-tools/logs"
mkdir -p "$logdir"
log="$logdir/form-$adapter.log"
: > "$log"

echo "=== $adapter form tests ($(date -Is)) grep='${grep_filter}' ===" | tee -a "$log"

cd "$root/packages/form"

extra=()
if [[ "$adapter" == "postgres" ]]; then
  extra=(env PGPASSWORD=testpassword)
fi

mocha_args=(-t 25000)
if [[ -n "$grep_filter" ]]; then
  mocha_args+=(--grep "$grep_filter")
fi

APOS_TEST_DB_PROTOCOL="$adapter" "${extra[@]}" ../../node_modules/.bin/mocha "${mocha_args[@]}" >> "$log" 2>&1
code=$?

echo "=== exit=$code ===" | tee -a "$log"

echo ""
echo "----- FAILURES (if any) -----"
# Mocha marks failing tests with a numbered list under "N passing/failing".
# Print the failing test titles and the summary line for a quick report.
grep -nE "passing|failing|pending" "$log" | tail -5
echo "-----------------------------"
# Extract the "N) test title" blocks that mocha prints for failures.
awk '/^  [0-9]+\) /{flag=1} flag{print} /^$/{if(flag>0)flag++} flag>3{flag=0}' "$log" | head -60

exit "$code"
