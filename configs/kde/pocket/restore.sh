#!/usr/bin/env bash
set -euo pipefail

backup="${1:-$(cat ~/.local/share/rice-backups/latest-pocket)}"
[ -d "$backup/config" ] || { echo "No backup at $backup" >&2; exit 1; }
dotfiles=~/.config/dotfiles/configs

systemctl --user disable --now pocket-recolor.path || true
rm -f ~/.config/autostart/pocket-quickshell.desktop
pkill -x qs || true

for file in kdeglobals kwinrc kwinrulesrc plasmarc plasmashellrc kscreenlockerrc plasma-org.kde.plasma.desktop-appletsrc gtk-3.0/settings.ini gtk-3.0/gtk.css Cursor/User/settings.json; do
  [ -f "$backup/config/$file" ] && cp "$backup/config/$file" ~/.config/"$file"
done
if [ -d "$backup/gtk-4.0" ]; then
  rm -rf ~/.config/gtk-4.0
  cp -a "$backup/gtk-4.0" ~/.config/gtk-4.0
fi

[ -f "$backup/config/ghostty/config" ] && cp "$backup/config/ghostty/config" "$dotfiles/ghostty/config"
[ -f "$backup/config/fastfetch/config.jsonc" ] && cp "$backup/config/fastfetch/config.jsonc" "$dotfiles/fastfetch/config.jsonc"
[ -f "$backup/zed-settings.json" ] && cp "$backup/zed-settings.json" "$dotfiles/ide/all-editors/settings.json"
[ -f "$backup/active-prompt" ] && fish -c "dotfiles prompt $(cat "$backup/active-prompt")"

spicetify restore || true
sudo rm -f /etc/sddm.conf.d/zz-pocket.conf

plasma-apply-colorscheme "$(cat "$backup/colorscheme")" || true
plasma-apply-desktoptheme "$(kreadconfig6 --file plasmarc --group Theme --key name)" || true
qdbus6 org.kde.kded6 /modules/gtkconfig org.kde.GtkConfig.setGtkTheme "$(kreadconfig6 --file gtk-3.0/settings.ini --group Settings --key gtk-theme-name)" || true

qdbus6 org.kde.KWin /KWin reconfigure
systemctl --user restart plasma-plasmashell.service
echo "Restored from $backup"
