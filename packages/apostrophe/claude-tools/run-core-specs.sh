#!/bin/bash
# Run several apostrophe core mocha specs, ONE AT A TIME, against a chosen DB
# adapter, and print a per-spec pass/fail summary at the end. Each spec keeps
# its own log at claude-tools/logs/spec-<name>-<adapter>.log, so a failure can
# be examined without running anything again. Usage:
#
#   ./claude-tools/run-core-specs.sh mongodb test/areas.js test/widgets.js
#   ./claude-tools/run-core-specs.sh postgres test/schemas.js
#
# NEVER run these in parallel — the suite is not designed for concurrent runs
# and the host has limited resources.

set -u
adapter="${1:-}"
shift || true
if [[ -z "$adapter" || $# -eq 0 ]]; then
  echo "usage: $0 <mongodb|postgres|sqlite> <test/spec.js> [test/spec.js ...]" >&2
  exit 2
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
summary=()
failed=0

for spec in "$@"; do
  "$root/claude-tools/run-core-spec.sh" "$spec" "$adapter" > /dev/null 2>&1
  code=$?
  name="$(basename "$spec" .js)"
  log="$root/claude-tools/logs/spec-$name-$adapter.log"
  counts="$(grep -oE "[0-9]+ (passing|failing|pending)" "$log" | tr '\n' ' ')"
  if [[ $code -eq 0 ]]; then
    summary+=("ok       $spec  ($counts)")
  else
    failed=1
    summary+=("FAILED   $spec  ($counts)  log: $log")
  fi
  echo "$(printf '%-40s' "$spec") exit=$code  $counts"
done

echo
echo "=== summary ($adapter) ==="
printf '%s\n' "${summary[@]}"

if [[ $failed -ne 0 ]]; then
  echo
  echo "=== failing test names ==="
  for spec in "$@"; do
    name="$(basename "$spec" .js)"
    log="$root/claude-tools/logs/spec-$name-$adapter.log"
    if grep -qE "[0-9]+ failing" "$log"; then
      echo "--- $spec ---"
      grep -E "^\s+[0-9]+\) |^\s+[0-9]+\)" -A 3 "$log" | head -60
    fi
  done
fi

exit "$failed"
