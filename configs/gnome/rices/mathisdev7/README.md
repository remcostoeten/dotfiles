# mathisdev7 GNOME rice (Ubuntu)

Replicates the look-and-feel from `mathisdev7/dotfiles` (GNOME on Ubuntu 24.04): Ghostty palette, Conky clock widget, btop/cava/rofi/neofetch configs, wallpapers, and GNOME + extension settings.

## Run

From this dotfiles repo:

- `bin/gnome-rice-mathisdev7 --dry-run`
- `bin/gnome-rice-mathisdev7`

## Notes

- This applies **GNOME settings** via `gsettings` and loads **extension settings** via `dconf`.
- Theme/icon/font names are set to match the upstream rice (`WhiteSur-Dark`, `Papirus-Dark`, `Inter`, `Ubuntu Sans Mono`). Install those on your system if you want the exact visuals.
- Extension installation uses `extensions.gnome.org` and `gnome-extensions install`; it works best while logged into a GNOME session.

