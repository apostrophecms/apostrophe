#!/bin/bash
# Run the sanitize-html mocha suite, logging full output to
# claude-tools/logs/sanitize-html.log and printing a summary of ONLY the
# specific tests that failed (so we never have to re-run from scratch to find
# out what broke). Optional first arg is a mocha --grep filter, e.g.:
#
#   ./claude-tools/run-sanitize-html-tests.sh                 # whole suite
#   ./claude-tools/run-sanitize-html-tests.sh 'GHSA-jxwj'     # just matching tests
#
# NEVER run test suites in parallel — they are designed to run one at a time
# and the host has limited resources.

set -u
grep_filter="${1:-}"

root="$(cd "$(dirname "$0")/.." && pwd)"
logdir="$root/claude-tools/logs"
mkdir -p "$logdir"
log="$logdir/sanitize-html.log"
: > "$log"

cd "$root/packages/sanitize-html"

echo "=== sanitize-html mocha ${grep_filter:+(grep: $grep_filter) }($(date -Is)) ===" | tee -a "$log"

if [[ -n "$grep_filter" ]]; then
  ./node_modules/.bin/mocha --grep "$grep_filter" >> "$log" 2>&1
else
  ./node_modules/.bin/mocha >> "$log" 2>&1
fi
code=$?

echo "=== exit=$code ===" | tee -a "$log"
echo
echo "----- passing/failing summary -----"
# mocha default (spec) reporter: passing/failing counts and the failure list.
grep -E '[0-9]+ (passing|pending|failing)' "$log" || true
if grep -qE '[1-9][0-9]* failing' "$log"; then
  echo
  echo "----- FAILED TESTS -----"
  # Numbered failure headers look like "  1) sanitizeHtml ... : <title>"
  grep -E '^[[:space:]]+[0-9]+\)' "$log" || true
fi
echo "(full log: $log)"
exit "$code"
