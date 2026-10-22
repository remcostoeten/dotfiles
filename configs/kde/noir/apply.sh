#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
dotfiles=~/.config/dotfiles/configs
font="Maple Mono Normal NF"

backup=~/.local/share/rice-backups/pre-noir-$(date +%Y%m%d-%H%M%S)
mkdir -p "$backup/config"
(cd ~/.config && cp -aL --parents kdeglobals kwinrc kwinrulesrc plasmarc plasmashellrc plasma-org.kde.plasma.desktop-appletsrc kcminputrc kscreenlockerrc dolphinrc konsolerc breezerc fastfetch/config.jsonc ghostty/config "$backup/config/" 2>/dev/null || true)
cp "$dotfiles/starship/.active-prompt" "$backup/active-prompt" 2>/dev/null || true
qdbus6 org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.wallpaper 0 | awk -F': ' '/^Image:/{print $2}' > "$backup/wallpaper" || true
echo "$backup" > ~/.local/share/rice-backups/latest-noir

yay -S --needed --noconfirm maplemononormal-nf plasma6-applets-virtual-desktop-bar-wayland

mkdir -p ~/.local/share/color-schemes
cp "$here/Noir.colors" ~/.local/share/color-schemes/
plasma-apply-colorscheme Noir
plasma-apply-desktoptheme breeze-dark
/usr/lib/plasma-changeicons Tela-circle-grey

wallpaper=$(find "$dotfiles/wallpapers/noir" -maxdepth 1 -type f \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.webp' \) ! -name 'noir-ember.png' | sort | head -1)
plasma-apply-wallpaperimage "${wallpaper:-$dotfiles/wallpapers/noir/noir-ember.png}"

kwriteconfig6 --file kdeglobals --group KDE --key widgetStyle Breeze
for key in font menuFont toolBarFont fixed; do
  kwriteconfig6 --file kdeglobals --group General --key "$key" "$font,10,-1,5,400,0,0,0,0,0,0,0,0,0,0,1"
done
kwriteconfig6 --file kdeglobals --group General --key smallestReadableFont "$font,8,-1,5,400,0,0,0,0,0,0,0,0,0,0,1"
kwriteconfig6 --file kdeglobals --group WM --key activeFont "$font,9,-1,5,400,0,0,0,0,0,0,0,0,0,0,1"

kwriteconfig6 --file kwinrc --group org.kde.kdecoration2 --key library org.kde.breeze
kwriteconfig6 --file kwinrc --group org.kde.kdecoration2 --key theme Breeze
kwriteconfig6 --file kwinrc --group org.kde.kdecoration2 --key ButtonsOnLeft ""
kwriteconfig6 --file kwinrc --group org.kde.kdecoration2 --key ButtonsOnRight X
kwriteconfig6 --file kwinrc --group org.kde.kdecoration2 --key BorderSize Tiny
kwriteconfig6 --file kwinrc --group org.kde.kdecoration2 --key BorderSizeAuto false
kwriteconfig6 --file breezerc --group Common --key OutlineCloseButton false
kwriteconfig6 --file breezerc --group Common --key OutlineIntensity OutlineHigh
kwriteconfig6 --file breezerc --group Common --key ShadowSize ShadowSmall
kwriteconfig6 --file breezerc --group Windeco --key TitleAlignment AlignLeft
kwriteconfig6 --file breezerc --group Windeco --key ButtonSize ButtonTiny
kwriteconfig6 --file breezerc --group Windeco --key DrawBackgroundGradient false
kwriteconfig6 --file breezerc --group Windeco --key DrawBorderOnMaximizedWindows false
qdbus6 org.kde.KWin /KWin reconfigure

qdbus6 org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript "$(cat "$here/layout.js")"

grep -q '^include noir.conf$' "$dotfiles/kitty/kitty.conf" || printf '\ninclude noir.conf\n' >> "$dotfiles/kitty/kitty.conf"
ln -sf "$dotfiles/kitty/noir.conf" ~/.config/kitty/noir.conf
pkill -USR1 -x kitty || true

sed -i "s/^theme = .*/theme = noir/; s/^font-family = .*/font-family = \"$font\"/; s/^font-size = .*/font-size = 13/" "$dotfiles/ghostty/config"

cp "$dotfiles/fastfetch/noir.jsonc" "$dotfiles/fastfetch/config.jsonc"
echo noir > "$dotfiles/nvim/.rice-colorscheme"
fish -c 'dotfiles prompt noir'

systemctl --user restart plasma-plasmashell.service
echo "Applied. Backup: $backup"
