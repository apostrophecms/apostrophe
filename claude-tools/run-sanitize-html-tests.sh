#!/bin/bash
# Run the sanitize-html package mocha suite and log full output to
# claude-tools/logs/sanitize-html.log. Prints a summary of failing tests.
#
# Usage:
#   ./claude-tools/run-sanitize-html-tests.sh                 # whole suite
#   ./claude-tools/run-sanitize-html-tests.sh "<grep string>" # filter by title
#
# Runs one suite at a time only. Does not run lint (use `npm test` for that).

set -u
grep_filter="${1:-}"

root="$(cd "$(dirname "$0")/.." && pwd)"
logdir="$root/claude-tools/logs"
mkdir -p "$logdir"
log="$logdir/sanitize-html.log"
: > "$log"

cd "$root/packages/sanitize-html"

echo "=== sanitize-html tests ${grep_filter:+(grep: $grep_filter) }($(date -Is)) ===" | tee -a "$log"

if [[ -n "$grep_filter" ]]; then
  ./node_modules/.bin/mocha --reporter spec --grep "$grep_filter" >> "$log" 2>&1
else
  ./node_modules/.bin/mocha --reporter spec >> "$log" 2>&1
fi
code=$?

echo "=== exit=$code ===" | tee -a "$log"

# Surface the passing/failing counts and any failing test titles.
echo "--- summary ---"
grep -E "passing|failing|pending" "$log" | tail -3
if [[ "$code" -ne 0 ]]; then
  echo "--- failing tests ---"
  # Mocha lists failures as a numbered block after the spec output.
  awk '/^  [0-9]+\) /{flag=1} flag' "$log" | grep -E "^\s+[0-9]+\)" || true
fi
echo "Full log: $log"
exit "$code"
