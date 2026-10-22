#!/usr/bin/env bash
set -euo pipefail

backup="${1:-$(cat ~/.local/share/rice-backups/latest-noir)}"
[ -d "$backup/config" ] || { echo "No backup at $backup" >&2; exit 1; }
dotfiles=~/.config/dotfiles/configs

for file in kdeglobals kwinrc kwinrulesrc plasmarc plasmashellrc kcminputrc kscreenlockerrc dolphinrc konsolerc plasma-org.kde.plasma.desktop-appletsrc; do
  [ -f "$backup/config/$file" ] && cp "$backup/config/$file" ~/.config/"$file"
done
if [ -f "$backup/config/breezerc" ]; then cp "$backup/config/breezerc" ~/.config/breezerc; else rm -f ~/.config/breezerc; fi

sed -i '/^include noir.conf$/d' "$dotfiles/kitty/kitty.conf"
pkill -USR1 -x kitty || true
[ -f "$backup/config/ghostty/config" ] && cp "$backup/config/ghostty/config" "$dotfiles/ghostty/config"
[ -f "$backup/config/fastfetch/config.jsonc" ] && cp "$backup/config/fastfetch/config.jsonc" "$dotfiles/fastfetch/config.jsonc"
rm -f "$dotfiles/nvim/.rice-colorscheme"
[ -f "$backup/active-prompt" ] && fish -c "dotfiles prompt $(cat "$backup/active-prompt")"

plasma-apply-colorscheme "$(kreadconfig6 --file kdeglobals --group General --key ColorScheme)" || true
plasma-apply-desktoptheme "$(kreadconfig6 --file plasmarc --group Theme --key name)" || true
/usr/lib/plasma-changeicons "$(kreadconfig6 --file kdeglobals --group Icons --key Theme)" || true
[ -s "$backup/wallpaper" ] && plasma-apply-wallpaperimage "$(sed 's|^file://||' "$backup/wallpaper")" || true

qdbus6 org.kde.KWin /KWin reconfigure
systemctl --user restart plasma-plasmashell.service
echo "Restored from $backup"
