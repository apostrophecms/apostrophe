#!/bin/bash
# Usage: ./claude-tools/run-pro-translation-tests.sh [spec ...]
# Example: ./claude-tools/run-pro-translation-tests.sh test/translation.spec.js
#
# Runs the mocha suite of the @apostrophecms-pro/automatic-translation checkout
# in ../automatic-translation against the core working tree, which is the only
# way to exercise pro translation behavior that depends on unreleased core
# field types.
#
# That checkout installs neither `apostrophe` (a devDependency pinned to
# `#main`) nor mocha, so this links the working tree in as `apostrophe` and
# borrows the monorepo's mocha. Everything else it needs is already installed
# there.
#
# Output goes to claude-tools/logs/pro-translation-<timestamp>.log, and the
# failing test names are echoed at the end.

set -uo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
pro="$(cd "$root/.." && pwd)/automatic-translation"
core="$root/packages/apostrophe"
mocha="$root/node_modules/.bin/mocha"

if [ ! -d "$pro" ]; then
  echo "no automatic-translation checkout at $pro" >&2
  exit 1
fi
if [ ! -x "$mocha" ]; then
  echo "no mocha at $mocha; run pnpm install in the monorepo" >&2
  exit 1
fi

# The suite boots a real apostrophe, so it needs the core working tree rather
# than whatever `#main` would install
ln -sfn "$core" "$pro/node_modules/apostrophe"

# Booting loads every bundled provider, so the provider SDKs have to resolve
# even for a suite that only exercises one of them. They are missing from the
# checkout's partial install; borrow them from the testbed, which has a
# complete one, rather than reaching for the network
testbed="$(cd "$root/.." && pwd)/testbed"
for dep in @google-cloud/translate deepl-node; do
  if (cd "$pro" && node -p "require.resolve('$dep')" >/dev/null 2>&1); then
    continue
  fi
  found="$(cd "$testbed" && node -e "
    const p = require.resolve('$dep');
    const m = p.match(/^(.*\/node_modules\/${dep//\//\\/})\//);
    process.stdout.write(m ? m[1] : '');
  " 2>/dev/null)"
  if [ -n "$found" ]; then
    mkdir -p "$pro/node_modules/$(dirname "$dep")"
    ln -sfn "$found" "$pro/node_modules/$dep"
  else
    echo "warning: could not resolve $dep for the pro checkout" >&2
  fi
done

mkdir -p "$root/claude-tools/logs"
log="$root/claude-tools/logs/pro-translation-$(date +%Y%m%d-%H%M%S).log"

specs=("$@")
if [ ${#specs[@]} -eq 0 ]; then
  specs=("test/translation.spec.js")
fi

{
  echo "=== pro automatic-translation: ${specs[*]} ==="
  echo "core: $(git -C "$root" rev-parse --abbrev-ref HEAD) $(git -C "$root" rev-parse --short HEAD)"
  echo "pro:  $(git -C "$pro" rev-parse --abbrev-ref HEAD) $(git -C "$pro" rev-parse --short HEAD)"
  echo "start: $(date -Iseconds)"
} | tee "$log"

cd "$pro"
CODE=0
"$mocha" "${specs[@]}" >> "$log" 2>&1 || CODE=$?
echo "exit code: $CODE" >> "$log"

echo
echo "log: $log"
grep -E "^\s+[0-9]+ (passing|failing|pending)" "$log"
if [ "$CODE" -ne 0 ]; then
  echo "--- failing tests ---"
  # mocha lists each failure as "  N) <suite>" followed by the test name
  grep -E "^\s+[0-9]+\) " -A 2 "$log"
fi

exit $CODE
