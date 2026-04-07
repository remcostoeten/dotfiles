#!/usr/bin/env fish

function _rice_die
    echo "gnome-rice-mathisdev7: $argv" >&2
    exit 1
end

function _rice_has --argument-names cmd
    command -q $cmd
end

function _rice_ts
    date "+%Y%m%d-%H%M%S"
end

function _rice_backup_file --argument-names backup_root dst
    if test -e "$dst"
        set -l rel (string replace -r '^/+' '' -- "$dst")
        set -l out "$backup_root/$rel"
        mkdir -p (dirname "$out")
        cp -a "$dst" "$out"
    end
end

function _rice_copy_file --argument-names dry_run src dst backup_root
    if test "$dry_run" = "1"
        echo "DRY: install $src -> $dst"
        return 0
    end

    _rice_backup_file "$backup_root" "$dst"
    mkdir -p (dirname "$dst")
    cp -a "$src" "$dst"
end

function _rice_shell_major
    if not _rice_has gnome-shell
        _rice_die "missing `gnome-shell` (are you on GNOME?)"
    end

    set -l raw (gnome-shell --version)
    set -l major (string match -r '[0-9]+' -- "$raw" | head -n 1)
    test -n "$major"; or _rice_die "could not parse GNOME Shell version from: $raw"
    echo "$major"
end

function _rice_install_extension --argument-names dry_run pk shell_major
    _rice_has curl; or _rice_die "missing `curl`"
    _rice_has jq; or _rice_die "missing `jq`"
    _rice_has gnome-extensions; or _rice_die "missing `gnome-extensions` (install `gnome-shell-extensions`)"

    set -l info_url "https://extensions.gnome.org/extension-info/?pk=$pk&shell_version=$shell_major"
    set -l json (curl -fsSL "$info_url"); or _rice_die "failed to fetch extension info for pk=$pk"

    set -l uuid (echo "$json" | jq -r '.uuid')
    set -l download_url (echo "$json" | jq -r '.download_url')

    if test -z "$uuid" -o "$uuid" = "null"
        _rice_die "extensions.gnome.org returned no uuid for pk=$pk (shell=$shell_major)"
    end
    if test -z "$download_url" -o "$download_url" = "null"
        _rice_die "extensions.gnome.org returned no download_url for pk=$pk (shell=$shell_major)"
    end

    set -l zip "/tmp/$uuid.shell$shell_major.zip"
    if test "$dry_run" = "1"
        echo "DRY: install extension pk=$pk uuid=$uuid"
        return 0
    end

    curl -fsSL "https://extensions.gnome.org$download_url" -o "$zip"; or _rice_die "failed downloading $uuid"
    gnome-extensions install --force "$zip"; or true
    gnome-extensions enable "$uuid"; or true
end

function _rice_apply_extension_settings --argument-names dry_run script_dir
    _rice_has dconf; or _rice_die "missing `dconf` (install `dconf-cli`)"

    set -l in "$script_dir/dconf/gnome-extensions.dconf.in"
    test -f "$in"; or _rice_die "missing $in"

    if test "$dry_run" = "1"
        echo "DRY: dconf load /org/gnome/shell/extensions/ < (template)"
        return 0
    end

    set -l tmp (mktemp)
    sed "s|__HOME__|$HOME|g" "$in" > "$tmp"
    dconf load /org/gnome/shell/extensions/ < "$tmp"
    rm -f "$tmp"
end

function _rice_apply_gsettings --argument-names dry_run wallpaper_path
    _rice_has gsettings; or _rice_die "missing `gsettings`"

    if test "$dry_run" = "1"
        echo "DRY: apply GNOME gsettings (theme/fonts/wm/wallpaper)"
        return 0
    end

    # Interface
    gsettings set org.gnome.desktop.interface clock-format '12h'
    gsettings set org.gnome.desktop.interface clock-show-weekday true
    gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'
    gsettings set org.gnome.desktop.interface enable-hot-corners false
    gsettings set org.gnome.desktop.interface show-battery-percentage true

    gsettings set org.gnome.desktop.interface cursor-size 24
    gsettings set org.gnome.desktop.interface font-name 'Inter 11'
    gsettings set org.gnome.desktop.interface document-font-name 'Inter 11'
    gsettings set org.gnome.desktop.interface monospace-font-name 'Ubuntu Sans Mono 11'

    gsettings set org.gnome.desktop.interface gtk-theme 'WhiteSur-Dark'
    gsettings set org.gnome.desktop.interface icon-theme 'Papirus-Dark'

    # WM
    gsettings set org.gnome.desktop.wm.preferences button-layout ':minimize,maximize,close'
    gsettings set org.gnome.desktop.wm.preferences num-workspaces 4
    gsettings set org.gnome.desktop.wm.preferences titlebar-font 'Inter Bold 11'

    # Wallpaper
    if test -n "$wallpaper_path"
        set -l uri "file://$wallpaper_path"
        gsettings set org.gnome.desktop.background picture-uri "$uri"
        gsettings set org.gnome.desktop.background picture-uri-dark "$uri"
        gsettings set org.gnome.desktop.screensaver picture-uri "$uri"
    end

    # Dash-to-dock settings (Ubuntu Dock / Dash to Dock)
    if gsettings list-schemas | grep -q '^org.gnome.shell.extensions.dash-to-dock$'
        gsettings set org.gnome.shell.extensions.dash-to-dock autohide true
        gsettings set org.gnome.shell.extensions.dash-to-dock background-opacity 0.6
        gsettings set org.gnome.shell.extensions.dash-to-dock transparency-mode 'DYNAMIC'
        gsettings set org.gnome.shell.extensions.dash-to-dock dock-position 'BOTTOM'
        gsettings set org.gnome.shell.extensions.dash-to-dock dash-max-icon-size 48
        gsettings set org.gnome.shell.extensions.dash-to-dock click-action 'focus-or-appspread'
        gsettings set org.gnome.shell.extensions.dash-to-dock running-indicator-style 'DOTS'
        gsettings set org.gnome.shell.extensions.dash-to-dock show-mounts false
        gsettings set org.gnome.shell.extensions.dash-to-dock show-trash false
    end
end

function _rice_install_wallpapers --argument-names dry_run script_dir
    set -l dst_dir "$HOME/.local/share/backgrounds/mathisdev7"
    set -l src_dir "$script_dir/wallpapers"
    test -d "$src_dir"; or _rice_die "missing wallpapers dir: $src_dir"

    if test "$dry_run" = "1"
        echo "DRY: install wallpapers -> $dst_dir" >&2
        echo ""
        return 0
    end

    mkdir -p "$dst_dir"
    cp -a "$src_dir/"*.jpg "$dst_dir/"

    # Return a stable "preferred" wallpaper path (matches upstream dconf).
    echo "$dst_dir/2026-03-31-09-20-03-peakpx.jpg"
end

function main
    set -l self (status --current-filename)
    set -l self_path "$self"
    if _rice_has realpath
        set self_path (realpath "$self")
    else if _rice_has readlink
        set self_path (readlink -f "$self")
    end
    set -l script_dir (dirname "$self_path")
    set -l dry_run 0

    argparse -n gnome-rice-mathisdev7 'h/help' 'dry-run' 'no-apps' 'no-wallpaper' 'no-settings' 'no-extensions' -- $argv
    or _rice_die "invalid args (try --help)"

    if set -q _flag_help
        echo "Usage: gnome-rice-mathisdev7 [--dry-run] [--no-apps] [--no-wallpaper] [--no-settings] [--no-extensions]"
        return 0
    end

    if set -q _flag_dry_run
        set dry_run 1
    end

    set -l backup_root "$HOME/.dotfiles/backups/mathisdev7/"(_rice_ts)
    if test "$dry_run" = "0"
        mkdir -p "$backup_root"
    end

    set -l wallpaper_path ""
    if not set -q _flag_no_wallpaper
        set wallpaper_path (_rice_install_wallpapers $dry_run $script_dir)
    end

    if not set -q _flag_no_apps
        set -l files_root "$script_dir/files"
        test -d "$files_root"; or _rice_die "missing files dir: $files_root"

        _rice_copy_file $dry_run "$files_root/.config/conky/conky.conf" "$HOME/.config/conky/conky.conf" "$backup_root"
        _rice_copy_file $dry_run "$files_root/.config/cava/config" "$HOME/.config/cava/config" "$backup_root"
        _rice_copy_file $dry_run "$files_root/.config/btop/btop.conf" "$HOME/.config/btop/btop.conf" "$backup_root"
        _rice_copy_file $dry_run "$files_root/.config/btop/themes/catppuccin_mocha.theme" "$HOME/.config/btop/themes/catppuccin_mocha.theme" "$backup_root"
        _rice_copy_file $dry_run "$files_root/.config/rofi/config.rasi" "$HOME/.config/rofi/config.rasi" "$backup_root"
        _rice_copy_file $dry_run "$files_root/.config/neofetch/config.conf" "$HOME/.config/neofetch/config.conf" "$backup_root"
        _rice_copy_file $dry_run "$files_root/.config/starship.toml" "$HOME/.config/starship.toml" "$backup_root"

        # Ghostty theme drop-in (does not change your active theme)
        _rice_copy_file $dry_run "$files_root/.config/ghostty/themes/mathisdev7" "$HOME/.config/ghostty/themes/mathisdev7" "$backup_root"
    end

    if not set -q _flag_no_extensions
        set -l shell_major (_rice_shell_major)
        set -l pks 3193 3843 4679 7048 4655 3740 4648 3210
        for pk in $pks
            _rice_install_extension $dry_run $pk $shell_major
        end
        _rice_apply_extension_settings $dry_run $script_dir
    end

    if not set -q _flag_no_settings
        _rice_apply_gsettings $dry_run "$wallpaper_path"
    end

    echo "Done."
    if test "$dry_run" = "0"
        echo "Backups: $backup_root"
        echo "Tip: set Ghostty theme with: theme = mathisdev7 (in ~/.config/ghostty/config)"
        echo "Tip: start Conky with: conky -c ~/.config/conky/conky.conf"
    end
end

main $argv
