#!/bin/bash
# Rebuild the apos admin-UI bundle and report its size + top contributors.
# Usage: claude-tools/rebuild-and-measure.sh [label]
#
# The build harness lives in claude-tools/build-harness.js and is copied into
# packages/vite/test/ only for the duration of the run (it needs that location
# for apostrophe module resolution), then removed so it never joins the CI
# test glob.
set -e
ROOT=/srv/workspace/apostrophecms/apostrophe
LABEL="${1:-run}"
LOG="$ROOT/claude-tools/logs/apos-build-${LABEL}-$(date +%s).log"
DIST="$ROOT/packages/vite/test/apos-build/@apostrophecms/vite/default/dist/apos-build.js"
BASELINE="$ROOT/claude-tools/bundle-baselines/apos-build.baseline.js"
HARNESS_SRC="$ROOT/claude-tools/build-harness.js"
HARNESS_DST="$ROOT/packages/vite/test/build-harness.js"

cleanup() { rm -f "$HARNESS_DST"; }
trap cleanup EXIT

cp "$HARNESS_SRC" "$HARNESS_DST"
cd "$ROOT/packages/vite"
# Clean prior build artifacts + vite cache so source edits are picked up.
rm -rf "$ROOT/packages/vite/test/apos-build" \
       "$ROOT/packages/vite/test/data/temp" \
       "$ROOT/packages/vite/test/public/apos-frontend" 2>/dev/null || true

echo "[$LABEL] building... (log: $LOG)"
NODE_ENV=production npx mocha test/build-harness.js > "$LOG" 2>&1 || true

if [ ! -f "$DIST" ]; then
  echo "BUILD FAILED — see $LOG"; tail -30 "$LOG"; exit 1
fi

SIZE=$(stat -c%s "$DIST")
GZIP=$(gzip -c "$DIST" | wc -c)
echo "[$LABEL] apos-build.js = $SIZE bytes ($(echo "scale=1;$SIZE/1024"|bc) KB), gzip $(echo "scale=1;$GZIP/1024"|bc) KB"
if [ -f "$BASELINE" ]; then
  BSIZE=$(stat -c%s "$BASELINE")
  DELTA=$((SIZE - BSIZE))
  echo "[$LABEL] delta vs baseline: $DELTA bytes ($(echo "scale=1;$DELTA/1024"|bc) KB)"
fi
echo ""
node "$ROOT/claude-tools/analyze-bundle.js" "$DIST" 2>&1 | sed -n '1,25p'
