# 🎨 GNOME Aesthetic Setup - Quick Reference

## 🚀 Installation

```bash
cd ~/.config/dotfiles/configs/gnome
./setup-aesthetic-gnome.sh
```

## ⚡ Quick Commands

### Restart GNOME Shell
```bash
# X11 session
Alt+F2 → type 'r' → Enter

# Wayland session (requires logout)
gnome-session-quit --logout --no-prompt
```

### Extension Management
```bash
# List extensions
gnome-extensions list

# Enable extension
gnome-extensions enable blur-my-shell@aunetx

# Disable extension
gnome-extensions disable blur-my-shell@aunetx

# Configure extension
gnome-extensions prefs blur-my-shell@aunetx
```

## 🎚️ Quick Tweaks

### Transparency Levels
```bash
# More transparent panel
gsettings set org.gnome.shell.extensions.blur-my-shell.panel brightness 0.4

# Less transparent panel
gsettings set org.gnome.shell.extensions.blur-my-shell.panel brightness 0.8
```

### Blur Intensity
```bash
# Stronger blur
gsettings set org.gnome.shell.extensions.blur-my-shell.panel sigma 50

# Lighter blur
gsettings set org.gnome.shell.extensions.blur-my-shell.panel sigma 20
```

### Dock Position & Size
```bash
# Left side dock
gsettings set org.gnome.shell.extensions.dash-to-dock dock-position 'LEFT'

# Larger icons
gsettings set org.gnome.shell.extensions.dash-to-dock dash-max-icon-size 56

# Smaller icons
gsettings set org.gnome.shell.extensions.dash-to-dock dash-max-icon-size 32
```

### Animations Speed
```bash
# Faster animations
gsettings set org.gnome.desktop.interface enable-animations true
gsettings set org.gnome.shell.extensions.just-perfection animation 4

# Slower animations
gsettings set org.gnome.shell.extensions.just-perfection animation 1
```

## 🎨 Theme Switching

### Dark Mode
```bash
gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'
```

### Light Mode
```bash
gsettings set org.gnome.desktop.interface color-scheme 'prefer-light'
```

## 🔧 Common Fixes

### Panel not transparent?
```bash
gsettings set org.gnome.shell.extensions.blur-my-shell.panel blur true
gnome-extensions enable blur-my-shell@aunetx
```

### Extensions not loading?
```bash
# Log out and back in, or:
killall -SIGQUIT gnome-shell  # X11 only
```

### Reset to defaults?
```bash
gsettings reset-recursively org.gnome.shell.extensions.blur-my-shell
```

## 📁 Important Files

```
~/.config/gtk-3.0/gtk.css          # GTK 3 styling
~/.config/gtk-4.0/gtk.css          # GTK 4 styling
~/.config/gtk-3.0/settings.ini     # GTK 3 settings
~/.local/share/gnome-shell/extensions/  # Extensions
```

## 🎯 Current Configuration

| Feature | Value |
|---------|-------|
| Panel Blur | 30px sigma |
| Panel Transparency | 60% |
| Lock Screen Blur | 50px sigma |
| Dock Transparency | 30% |
| Icon Size | 42px |
| Animation Speed | Medium (2) |
| Corner Radius | 12px |

## 🔗 Useful Links

- [Extensions](https://extensions.gnome.org/)
- [GTK CSS Docs](https://docs.gtk.org/gtk3/css-properties.html)
- [Full README](./README.md)

## 💡 Pro Tips

1. **Wallpaper Matters**: Use dark, subtle wallpapers for best effect
2. **Font Quality**: Install Inter or SF Pro for crisp text
3. **Performance**: Lower blur sigma if lagging (15-20 is good)
4. **Backup Settings**: `dconf dump / > gnome-settings-backup.dconf`

