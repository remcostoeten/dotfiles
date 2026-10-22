#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
dotfiles=~/.config/dotfiles/configs

backup=~/.local/share/rice-backups/pre-lunar-mono-$(date +%Y%m%d-%H%M%S)
mkdir -p "$backup/config"
(cd ~/.config && cp -aL --parents kdeglobals kwinrc kwinrulesrc plasmarc plasmashellrc plasma-org.kde.plasma.desktop-appletsrc kcminputrc kscreenlockerrc dolphinrc konsolerc fastfetch starship.toml "$backup/config/" 2>/dev/null || true)
echo "$backup" > ~/.local/share/rice-backups/latest-lunar

yay -S --needed --noconfirm darkly-bin gruvbox-plus-icon-theme cava plasma6-applets-kurve-git plasma6-applets-plasmusic-toolbar plasma6-applets-virtual-desktop-bar-wayland

mkdir -p ~/.local/share/color-schemes
cp "$here/LunarMono.colors" ~/.local/share/color-schemes/
plasma-apply-colorscheme LunarMono
plasma-apply-desktoptheme breeze-dark
/usr/lib/plasma-changeicons Gruvbox-Plus-Dark
plasma-apply-wallpaperimage "$dotfiles/wallpapers/lunar/artemis-ii-setting-earth.png"

kwriteconfig6 --file kdeglobals --group KDE --key widgetStyle Darkly
for key in font menuFont toolBarFont fixed; do
  kwriteconfig6 --file kdeglobals --group General --key "$key" "JetBrains Mono,10,-1,5,400,0,0,0,0,0,0,0,0,0,0,1"
done
kwriteconfig6 --file kdeglobals --group General --key smallestReadableFont "JetBrains Mono,8,-1,5,400,0,0,0,0,0,0,0,0,0,0,1"
kwriteconfig6 --file kdeglobals --group WM --key activeFont "JetBrains Mono,9,-1,5,400,0,0,0,0,0,0,0,0,0,0,1"

kwriteconfig6 --file kwinrc --group org.kde.kdecoration2 --key library org.kde.breeze
kwriteconfig6 --file kwinrc --group org.kde.kdecoration2 --key theme Breeze
kwriteconfig6 --file kwinrc --group org.kde.kdecoration2 --key ButtonsOnLeft ""
kwriteconfig6 --file kwinrc --group org.kde.kdecoration2 --key ButtonsOnRight IAX
kwriteconfig6 --file kwinrc --group org.kde.kdecoration2 --key BorderSize None
kwriteconfig6 --file kwinrc --group org.kde.kdecoration2 --key BorderSizeAuto false
kwriteconfig6 --file breezerc --group Common --key OutlineCloseButton false
kwriteconfig6 --file breezerc --group Windeco --key TitleAlignment AlignCenterFullWidth
kwriteconfig6 --file breezerc --group Windeco --key ButtonSize ButtonSmall
kwriteconfig6 --file breezerc --group Windeco --key DrawBackgroundGradient false

set -- あ い う え お か き く け こ
for id in $(qdbus6 --literal org.kde.KWin /VirtualDesktopManager org.freedesktop.DBus.Properties.Get org.kde.KWin.VirtualDesktopManager desktops | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'); do
  [ $# -gt 0 ] || break
  qdbus6 org.kde.KWin /VirtualDesktopManager org.kde.KWin.VirtualDesktopManager.setDesktopName "$id" "$1"
  shift
done
qdbus6 org.kde.KWin /KWin reconfigure

qdbus6 org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript "$(cat "$here/layout.js")"

grep -q '^include lunar-mono.conf$' "$dotfiles/kitty/kitty.conf" || printf '\ninclude lunar-mono.conf\n' >> "$dotfiles/kitty/kitty.conf"
ln -sf "$dotfiles/kitty/lunar-mono.conf" ~/.config/kitty/lunar-mono.conf
fish -c 'dotfiles prompt lunar'

systemctl --user restart plasma-plasmashell.service
echo "Applied. Backup: $backup"
