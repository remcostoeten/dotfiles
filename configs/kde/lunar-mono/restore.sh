#!/usr/bin/env bash
set -euo pipefail

backup="${1:-$(cat ~/.local/share/rice-backups/latest-lunar)}"
[ -d "$backup/config" ] || { echo "No backup at $backup" >&2; exit 1; }

for file in kdeglobals kwinrc kwinrulesrc plasmarc plasmashellrc kcminputrc kscreenlockerrc dolphinrc konsolerc; do
  [ -f "$backup/config/$file" ] && cp "$backup/config/$file" ~/.config/"$file"
done
rm -f ~/.config/breezerc
[ -f "$backup/config/plasma-org.kde.plasma.desktop-appletsrc" ] && cp "$backup/config/plasma-org.kde.plasma.desktop-appletsrc" ~/.config/

dotfiles=~/.config/dotfiles/configs
sed -i '/^include lunar-mono.conf$/d' "$dotfiles/kitty/kitty.conf"
cp "$backup/config/fastfetch/config.jsonc" "$dotfiles/fastfetch/config.jsonc"
cp "$backup/config/starship.toml" "$dotfiles/starship/starship.toml"

plasma-apply-colorscheme "$(kreadconfig6 --file kdeglobals --group General --key ColorScheme)" || true
plasma-apply-desktoptheme "$(kreadconfig6 --file plasmarc --group Theme --key name)" || true
/usr/lib/plasma-changeicons "$(kreadconfig6 --file kdeglobals --group Icons --key Theme)" || true

index=1
for id in $(qdbus6 --literal org.kde.KWin /VirtualDesktopManager org.freedesktop.DBus.Properties.Get org.kde.KWin.VirtualDesktopManager desktops | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'); do
  name=$(kreadconfig6 --file kwinrc --group Desktops --key "Name_$index")
  qdbus6 org.kde.KWin /VirtualDesktopManager org.kde.KWin.VirtualDesktopManager.setDesktopName "$id" "$name"
  index=$((index + 1))
done

qdbus6 org.kde.KWin /KWin reconfigure
systemctl --user restart plasma-plasmashell.service
echo "Restored from $backup"
