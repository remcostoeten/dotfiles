#!/usr/bin/env bash
set -euo pipefail

theme_id="RemcoTopbar"
panel_id="${1:-59}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source_theme="$script_dir/desktoptheme/$theme_id"
target_theme="$HOME/.local/share/plasma/desktoptheme/$theme_id"
base_theme="$HOME/.local/share/plasma/desktoptheme/Layan"

if [[ ! -d "$base_theme" ]]; then
  echo "Missing base Plasma theme: $base_theme" >&2
  exit 1
fi

rm -rf "$target_theme"
cp -a "$base_theme" "$target_theme"
cp "$source_theme/metadata.json" "$target_theme/metadata.json"
cp "$source_theme/metadata.desktop" "$target_theme/metadata.desktop"
cp "$source_theme/colors" "$target_theme/colors"
cp "$source_theme/widgets/panel-background.svg" "$target_theme/widgets/panel-background.svg"

kwriteconfig6 --file plasmarc --group Theme --key name "$theme_id"

qdbus6 org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript "
var panel = panelById($panel_id);
if (panel) {
  panel.location = 'top';
  panel.height = 34;
  panel.floating = true;
  panel.alignment = 'center';
  panel.hiding = 'none';
}
"

kquitapp6 plasmashell >/dev/null 2>&1 || true
if command -v kstart6 >/dev/null 2>&1; then
  kstart6 plasmashell >/dev/null 2>&1 &
else
  setsid -f plasmashell --replace >/tmp/remco-plasmashell.log 2>&1
fi
