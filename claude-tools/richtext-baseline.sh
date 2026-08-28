#!/bin/bash
# Usage: ./claude-tools/richtext-baseline.sh off|on|status
#
# Toggles the rich text schema field work in and out of the tree so that a
# Cypress spec can be run against a pristine apostrophe (`off`) and then
# against the refactor again (`on`), to tell a real regression apart from a
# failure this sandbox already had.
#
# `off` stashes the apostrophe changes and the testbed schema/test changes
# (the testbed cannot even boot without the field type, since modules/topic
# declares `richText` fields), rebuilds the admin assets and restarts the
# app. `on` restores both stashes and does the same.
#
# The testbed app.js sandbox patch (claude-tools/sandbox-patch.sh) is left
# alone in both directions, because the app cannot boot without it here.
#
# Before stashing anything, `off` copies every file it is about to touch to
# claude-tools/backups/, so nothing can be lost if a stash goes wrong.

set -euo pipefail

apos="$(cd "$(dirname "$0")/.." && pwd)"
testbed=/srv/workspace/apostrophecms/testbed
backups="$apos/claude-tools/backups"
message='richtext-field-wip'
testbed_files=(modules/topic/index.js cypress/tests/fields.cy.js cypress/support/selectors.js)

stash_of() {
  git -C "$1" stash list --format='%gd %gs' | grep -F "$message" | head -1 | cut -d' ' -f1
}

case "${1:-status}" in
  off)
    mkdir -p "$backups"
    tar czf "$backups/apostrophe-$(date +%s).tgz" -C "$apos" \
      $(git -C "$apos" status --porcelain -- packages/ | awk '{ print $2 }')
    tar czf "$backups/testbed-$(date +%s).tgz" -C "$testbed" "${testbed_files[@]}"

    # Limited to packages/, so that this script and the logs stay in place
    # while it is running
    git -C "$apos" stash push -u -m "$message" -- packages/ > /dev/null
    git -C "$testbed" stash push -m "$message" -- "${testbed_files[@]}" > /dev/null
    echo "stashed; rebuilding"
    ;;
  on)
    apos_stash=$(stash_of "$apos")
    testbed_stash=$(stash_of "$testbed")
    if [ -z "$apos_stash" ] || [ -z "$testbed_stash" ]; then
      echo "expected a '$message' stash in both trees" >&2
      exit 1
    fi
    git -C "$testbed" stash pop "$testbed_stash" > /dev/null
    git -C "$apos" stash pop "$apos_stash" > /dev/null
    echo "restored; rebuilding"
    ;;
  status)
    echo "apostrophe: $(git -C "$apos" status --porcelain | wc -l) changed file(s), stash '$(stash_of "$apos")'"
    echo "testbed:    $(git -C "$testbed" status --porcelain | wc -l) changed file(s), stash '$(stash_of "$testbed")'"
    exit 0
    ;;
  *)
    echo "usage: $0 off|on|status" >&2
    exit 2
    ;;
esac

cd "$testbed"
npm run build:ci > "$apos/claude-tools/logs/testbed-build.log" 2>&1
echo "assets rebuilt"
./claude-tools/start-app-sandbox.sh mongodb
