#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
db="${BRAVE_PROFILE:-$HOME/.config/BraveSoftware/Brave-Browser/Default}/Sync Data/LevelDB"

if pgrep -x brave >/dev/null; then
  echo "Brave is running. Quit it fully first, then rerun." >&2
  exit 1
fi
[ -d "$here/node_modules/classic-level" ] || (cd "$here" && npm i --silent)

backup="$db.bak-$(date +%Y%m%d-%H%M%S)"
cp -r "$db" "$backup"
echo "Backup: $backup"
node "$here/purge.js" "$db" --apply
