#!/bin/bash
# Point ~/apostrophecms/astro-public-demo at this working tree instead of its
# published npm installs, so changes to packages/apostrophe and
# packages/apostrophe-astro can be tested end to end. Reversible.
#
#   ./claude-tools/link-astro-demo.sh link
#   ./claude-tools/link-astro-demo.sh unlink
#   ./claude-tools/link-astro-demo.sh status
#
# The published installs are moved aside to <name>.published rather than
# deleted, so unlink restores exactly what npm put there.

set -u

root="$(cd "$(dirname "$0")/.." && pwd)"
demo="${ASTRO_DEMO:-$HOME/apostrophecms/astro-public-demo}"

pairs=(
  "$demo/backend/node_modules/apostrophe|$root/packages/apostrophe"
  "$demo/frontend/node_modules/@apostrophecms/apostrophe-astro|$root/packages/apostrophe-astro"
)

action="${1:-status}"

for pair in "${pairs[@]}"; do
  target="${pair%%|*}"
  source="${pair##*|}"
  saved="$target.published"
  case "$action" in
    link)
      if [[ -L "$target" ]]; then
        echo "already linked: $target"
        continue
      fi
      if [[ -e "$target" && ! -e "$saved" ]]; then
        mv "$target" "$saved" || exit 1
        echo "saved published copy: $saved"
      elif [[ -e "$target" ]]; then
        rm -rf "$target" || exit 1
      fi
      ln -s "$source" "$target" || exit 1
      echo "linked: $target -> $source"
      ;;
    unlink)
      if [[ -L "$target" ]]; then
        rm "$target" || exit 1
      fi
      if [[ -e "$saved" ]]; then
        mv "$saved" "$target" || exit 1
        echo "restored published copy: $target"
      else
        echo "no published copy saved for $target (run npm install there)"
      fi
      ;;
    status)
      if [[ -L "$target" ]]; then
        echo "linked:    $target -> $(readlink "$target")"
      elif [[ -e "$target" ]]; then
        echo "published: $target"
      else
        echo "missing:   $target"
      fi
      ;;
    *)
      echo "usage: $0 [link|unlink|status]" >&2
      exit 2
      ;;
  esac
done
