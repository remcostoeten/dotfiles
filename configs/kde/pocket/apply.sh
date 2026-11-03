#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
dotfiles=~/.config/dotfiles/configs
sddm_theme=/usr/share/sddm/themes/pocket

backup=~/.local/share/rice-backups/pre-pocket-$(date +%Y%m%d-%H%M%S)
mkdir -p "$backup/config"
(cd ~/.config && cp -aL --parents kdeglobals kwinrc kwinrulesrc plasmarc plasmashellrc plasma-org.kde.plasma.desktop-appletsrc kscreenlockerrc gtk-3.0/settings.ini gtk-3.0/gtk.css Cursor/User/settings.json fastfetch/config.jsonc ghostty/config "$backup/config/" 2>/dev/null || true)
cp -a ~/.config/gtk-4.0 "$backup/gtk-4.0" 2>/dev/null || true
cp "$dotfiles/ide/all-editors/settings.json" "$backup/zed-settings.json"
cp "$dotfiles/starship/.active-prompt" "$backup/active-prompt" 2>/dev/null || true
kreadconfig6 --file kdeglobals --group General --key ColorScheme > "$backup/colorscheme"
echo "$backup" > ~/.local/share/rice-backups/latest-pocket

sudo pacman -S --needed --noconfirm quickshell matugen
"$(command -v yay || command -v paru)" -S --needed --noconfirm otf-departure-mono spicetify-bin

plasma-apply-desktoptheme default
qdbus6 org.kde.kded6 /modules/gtkconfig org.kde.GtkConfig.setGtkTheme Breeze
rm -f ~/.config/gtk-4.0/assets ~/.config/gtk-4.0/gtk-dark.css
printf "@import 'colors.css';\n" > ~/.config/gtk-4.0/gtk.css

rules="$(kreadconfig6 --file kwinrulesrc --group General --key rules)"
if [[ ",$rules," != *",pocket-no-titlebars,"* ]]; then
  rules="${rules:+$rules,}pocket-no-titlebars"
  kwriteconfig6 --file kwinrulesrc --group General --key rules "$rules"
  kwriteconfig6 --file kwinrulesrc --group General --key count "$(tr ',' '\n' <<< "$rules" | grep -c .)"
fi
kwriteconfig6 --file kwinrulesrc --group pocket-no-titlebars --key Description "Pocket: no title bars"
kwriteconfig6 --file kwinrulesrc --group pocket-no-titlebars --key noborder true
kwriteconfig6 --file kwinrulesrc --group pocket-no-titlebars --key noborderrule 2
kwriteconfig6 --file kwinrulesrc --group pocket-no-titlebars --key types 33
qdbus6 org.kde.KWin /KWin reconfigure

qdbus6 org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript "$(cat "$here/layout.js")"

mkdir -p ~/.config/autostart
ln -sf "$here/quickshell.desktop" ~/.config/autostart/pocket-quickshell.desktop
pgrep -x qs >/dev/null || qs -d

sed -i "s/^theme = .*/theme = pocket/; s/^background-blur = .*/background-blur = true/" "$dotfiles/ghostty/config"
grep -q '^gtk-custom-css = themes/pocket-gtk.css$' "$dotfiles/ghostty/config" ||
  sed -i '/^gtk-custom-css = gtk.css$/a gtk-custom-css = themes/pocket-gtk.css' "$dotfiles/ghostty/config"

python3 -I - "$dotfiles/ide/all-editors/settings.json" <<'EOF'
import re
import sys

path = sys.argv[1]
with open(path) as handle:
    body = handle.read()
updated = re.sub(r'("theme":\s*\{[^}]*?"dark":\s*)"[^"]*"', r'\1"Pocket"', body, count=1)
with open(path, "w") as handle:
    handle.write(updated)
EOF

if [[ -d /opt/spotify ]]; then
  sudo chmod a+wr /opt/spotify /opt/spotify/Apps
  sudo chmod -R a+wr /opt/spotify/Apps
  mkdir -p ~/.config/spicetify/Themes/Pocket
  ln -sf "$here/spicetify/user.css" ~/.config/spicetify/Themes/Pocket/user.css
fi

sudo install -d "$sddm_theme" "$sddm_theme/dynamic"
sudo install -m644 "$here/sddm/Main.qml" "$here/sddm/metadata.desktop" "$here/sddm/theme.conf" "$sddm_theme/"
sudo chown "$USER" "$sddm_theme/dynamic"
sudo ln -sfn dynamic/theme.conf "$sddm_theme/theme.conf.user"
printf '[Theme]\nCurrent=pocket\n' | sudo tee /etc/sddm.conf.d/zz-pocket.conf >/dev/null

systemctl --user link "$here/systemd/pocket-recolor.service" "$here/systemd/pocket-recolor.path"
systemctl --user enable --now pocket-recolor.path

"$here/recolor"
fish -c 'dotfiles prompt pocket'

if [[ -d /opt/spotify ]]; then
  spicetify config current_theme Pocket color_scheme wallpaper
  spicetify backup apply || spicetify apply || true
fi

echo "Applied. Backup: $backup"
