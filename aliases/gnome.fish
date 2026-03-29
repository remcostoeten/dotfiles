#!/usr/bin/env fish

# GNOME aesthetic configuration aliases

# DOCSTRING: Setup aesthetic GNOME with Hyprland-style transparency and blur
alias gnome-aesthetic "~/.config/dotfiles/configs/gnome/setup-aesthetic-gnome.sh"

# DOCSTRING: Apply GNOME aesthetic settings
alias gnome-apply "~/.config/dotfiles/configs/gnome/apply-gnome-aesthetics.sh"

# DOCSTRING: Apply GTK styling
alias gnome-gtk "~/.config/dotfiles/configs/gnome/apply-gtk-styling.sh"

# DOCSTRING: Configure lock screen
alias gnome-lock "~/.config/dotfiles/configs/gnome/lock-screen/configure-lock-screen.sh"

# DOCSTRING: Install GNOME extensions
alias gnome-extensions "~/.config/dotfiles/configs/gnome/install-extensions.sh"

# DOCSTRING: Restart GNOME Shell (X11 only)
function gnome-restart
    if test "$XDG_SESSION_TYPE" = wayland
        echo "⚠️  On Wayland, you need to log out and log back in"
        echo "Run: gnome-session-quit --logout --no-prompt"
    else
        echo "🔄 Restarting GNOME Shell..."
        killall -SIGQUIT gnome-shell
    end
end

# DOCSTRING: Open GNOME aesthetic documentation
function gnome-help
    if command -v bat &>/dev/null
        bat ~/.config/dotfiles/configs/gnome/README.md
    else if command -v less &>/dev/null
        less ~/.config/dotfiles/configs/gnome/README.md
    else
        cat ~/.config/dotfiles/configs/gnome/README.md
    end
end

# DOCSTRING: Quick blur adjustment
function gnome-blur
    if test (count $argv) -eq 0
        echo "Current blur settings:"
        echo "  Panel: "(gsettings get org.gnome.shell.extensions.blur-my-shell.panel sigma)
        echo "  Overview: "(gsettings get org.gnome.shell.extensions.blur-my-shell.overview sigma)
        echo "  Lockscreen: "(gsettings get org.gnome.shell.extensions.blur-my-shell.lockscreen sigma)
        echo ""
        echo "Usage: gnome-blur <strength>"
        echo "  strength: 15 (light), 30 (medium), 50 (strong)"
    else
        set -l blur_strength $argv[1]
        echo "🎨 Setting blur strength to $blur_strength..."
        gsettings set org.gnome.shell.extensions.blur-my-shell.panel sigma $blur_strength
        gsettings set org.gnome.shell.extensions.blur-my-shell.overview sigma (math "$blur_strength * 2")
        gsettings set org.gnome.shell.extensions.blur-my-shell.lockscreen sigma (math "$blur_strength * 1.5")
        echo "✅ Blur strength updated!"
    end
end

# DOCSTRING: Quick transparency adjustment
function gnome-transparency
    if test (count $argv) -eq 0
        echo "Current transparency (brightness):"
        echo "  Panel: "(gsettings get org.gnome.shell.extensions.blur-my-shell.panel brightness)
        echo "  Dock: "(gsettings get org.gnome.shell.extensions.dash-to-dock background-opacity)
        echo ""
        echo "Usage: gnome-transparency <level>"
        echo "  level: 0.3 (very transparent) to 1.0 (opaque)"
    else
        set -l transparency $argv[1]
        echo "🎨 Setting transparency to $transparency..."
        gsettings set org.gnome.shell.extensions.blur-my-shell.panel brightness $transparency
        gsettings set org.gnome.shell.extensions.dash-to-dock background-opacity $transparency
        echo "✅ Transparency updated!"
    end
end

# DOCSTRING: Toggle dark mode
function gnome-dark
    set -l current (gsettings get org.gnome.desktop.interface color-scheme)
    if string match -q "*dark*" $current
        echo "☀️  Switching to light mode..."
        gsettings set org.gnome.desktop.interface color-scheme prefer-light
    else
        echo "🌙 Switching to dark mode..."
        gsettings set org.gnome.desktop.interface color-scheme prefer-dark
    end
end

# DOCSTRING: Set wallpaper for both desktop and lock screen
function gnome-wallpaper
    if test (count $argv) -eq 0
        echo "Usage: gnome-wallpaper <path-to-image>"
        echo "Example: gnome-wallpaper ~/Pictures/wallpaper.jpg"
    else
        set -l wallpaper_path (realpath $argv[1])
        if test -f $wallpaper_path
            echo "🖼️  Setting wallpaper..."
            gsettings set org.gnome.desktop.background picture-uri "file://$wallpaper_path"
            gsettings set org.gnome.desktop.screensaver picture-uri "file://$wallpaper_path"
            echo "✅ Wallpaper set for desktop and lock screen!"
        else
            echo "❌ File not found: $wallpaper_path"
        end
    end
end
