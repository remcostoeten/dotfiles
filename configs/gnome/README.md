# 🎨 GNOME Aesthetic Configuration - Hyprland-Inspired

Transform your GNOME desktop into a beautiful, transparent, blurred aesthetic machine inspired by Hyprland's visual style - without leaving GNOME!

## ✨ Features

- **Transparent Top Panel**: Beautiful blur effects with dynamic transparency
- **Custom Lock Screen**: Aesthetic lock screen with blur and modern styling
- **GTK Theming**: Rounded corners, smooth animations, and transparency throughout
- **Window Effects**: Modern blur effects and smooth transitions
- **Enhanced Animations**: Smooth, buttery animations everywhere
- **Beautiful Typography**: Clean, modern font rendering

## 📦 What's Included

```
configs/gnome/
├── setup-aesthetic-gnome.sh        # Master setup script (run this!)
├── apply-gnome-aesthetics.sh       # GNOME settings configuration
├── apply-gtk-styling.sh            # GTK theme application
├── install-extensions.sh           # Extension installer
├── gtk/
│   ├── gtk-3.0.css                # GTK 3 custom styling
│   └── gtk-4.0.css                # GTK 4 custom styling
└── lock-screen/
    └── configure-lock-screen.sh    # Lock screen & GDM styling
```

## 🚀 Quick Start

### One-Command Setup

```bash
cd ~/.config/dotfiles/configs/gnome
./setup-aesthetic-gnome.sh
```

This will:
1. Check and install dependencies
2. Apply blur and transparency settings
3. Configure GTK theming with custom CSS
4. Set up beautiful lock screen
5. Optionally install additional aesthetic extensions

### Manual Setup

If you prefer step-by-step installation:

```bash
# 1. Apply GNOME aesthetic settings
./apply-gnome-aesthetics.sh

# 2. Apply GTK styling
./apply-gtk-styling.sh

# 3. Configure lock screen
./lock-screen/configure-lock-screen.sh

# 4. (Optional) Install additional extensions
./install-extensions.sh
```

## 📋 Prerequisites

### Already Installed ✅
Your system already has these great extensions:
- `blur-my-shell` - Transparency and blur effects
- `just-perfection-desktop` - Interface customization
- `space-bar` - Workspace bar
- `undecorate` - Window decoration control
- `tiling-assistant` - Window tiling

### Recommended Additions
The setup script can install these for you:
- **Burn My Windows** - Beautiful window open/close effects
- **Vitals** - System monitor in top bar
- **User Themes** - Custom theme support
- **Grand Theft Focus** - Window focus management

## 🎨 What Gets Configured

### Panel & Top Bar
- **Transparency**: 60% opacity with blur
- **Blur Sigma**: 30px for smooth effect
- **Dynamic Updates**: Panel adapts to window state
- **Clean Layout**: Optimized spacing and padding

### Windows
- **Rounded Corners**: 12px radius on all windows
- **Blur Effects**: Background blur on dialogs and menus
- **Smooth Animations**: 200ms cubic-bezier transitions
- **Shadow Effects**: Subtle shadows for depth

### Lock Screen
- **Beautiful Clock**: Large, elegant typography
- **Blurred Background**: 50px sigma blur effect
- **Transparent Notifications**: Semi-transparent notification cards
- **Modern Login Dialog**: Rounded, blurred login form

### GTK Applications
- **Transparent Headerbars**: 80% opacity with backdrop blur
- **Rounded Elements**: 8-12px radius on buttons, entries, cards
- **Smooth Hover Effects**: Transform and shadow on interaction
- **Custom Scrollbars**: Minimal, rounded scrollbars

## ⚙️ Customization

### Adjust Blur Strength

```bash
# Panel blur (0-100, default: 30)
gsettings set org.gnome.shell.extensions.blur-my-shell.panel sigma 40

# Lock screen blur (0-100, default: 50)
gsettings set org.gnome.shell.extensions.blur-my-shell.lockscreen sigma 60
```

### Adjust Transparency

```bash
# Panel transparency (0.0-1.0, default: 0.6)
gsettings set org.gnome.shell.extensions.blur-my-shell.panel brightness 0.5

# Dock transparency (0.0-1.0, default: 0.3)
gsettings set org.gnome.shell.extensions.dash-to-dock background-opacity 0.4
```

### Modify GTK Styling

Edit the CSS files:
- GTK 3: `~/.config/gtk-3.0/gtk.css`
- GTK 4: `~/.config/gtk-4.0/gtk.css`

Changes take effect for newly opened applications.

### Change Rounded Corner Radius

In GTK CSS files, adjust `border-radius` values:
```css
/* More rounded */
button { border-radius: 12px; }

/* Less rounded */
button { border-radius: 6px; }
```

## 🔧 Troubleshooting

### Panel Not Transparent?

```bash
# Ensure blur-my-shell is enabled
gnome-extensions enable blur-my-shell@aunetx

# Restart GNOME Shell
# On X11: Alt+F2, type 'r', press Enter
# On Wayland: Log out and back in
```

### GTK Styling Not Applied?

```bash
# Re-apply GTK styling
./apply-gtk-styling.sh

# Restart affected applications
```

### Lock Screen Looks Wrong?

The GDM styling requires sudo access:
```bash
cd lock-screen
./configure-lock-screen.sh
# Then follow the instructions to apply GDM CSS
```

### Extensions Not Working?

```bash
# List installed extensions
gnome-extensions list

# Check extension status
gnome-extensions info blur-my-shell@aunetx

# Enable extension
gnome-extensions enable blur-my-shell@aunetx
```

## 🎯 Tips & Tricks

### Best Wallpapers
Use wallpapers with:
- Dark or muted colors (works better with transparency)
- Subtle patterns (not too busy)
- High resolution (4K recommended)

### Performance Optimization
If you experience lag:
```bash
# Reduce blur sigma
gsettings set org.gnome.shell.extensions.blur-my-shell.panel sigma 15

# Disable dynamic blur
gsettings set org.gnome.shell.extensions.blur-my-shell.panel override-background-dynamically false
```

### Font Recommendations
For the best aesthetic:
- **UI Font**: Inter, SF Pro, or Segoe UI
- **Monospace**: JetBrains Mono, Fira Code, or Cascadia Code

Install Inter font:
```bash
mkdir -p ~/.local/share/fonts
cd /tmp
wget https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip
unzip Inter-4.0.zip -d inter
cp inter/*.ttf ~/.local/share/fonts/
fc-cache -f
```

Then set it:
```bash
gsettings set org.gnome.desktop.interface font-name 'Inter 10'
```

## 🔄 Updating

To update your configuration:
```bash
cd ~/.config/dotfiles
git pull
cd configs/gnome
./setup-aesthetic-gnome.sh
```

## 🗑️ Uninstalling

To revert changes:
```bash
# Reset GNOME settings
gsettings reset-recursively org.gnome.shell.extensions.blur-my-shell
gsettings reset-recursively org.gnome.shell.extensions.dash-to-dock

# Remove custom GTK CSS
rm ~/.config/gtk-3.0/gtk.css
rm ~/.config/gtk-4.0/gtk.css

# Disable extensions
gnome-extensions disable blur-my-shell@aunetx
```

## 📸 Screenshots

Before running the setup, consider taking screenshots to compare!

## 🤝 Contributing

Found a cool tweak? Create a PR or issue in the dotfiles repo!

## 📚 Resources

- [Blur My Shell Extension](https://extensions.gnome.org/extension/3193/blur-my-shell/)
- [GNOME Extensions](https://extensions.gnome.org/)
- [GTK CSS Tutorial](https://docs.gtk.org/gtk3/css-properties.html)
- [Hyprland](https://hyprland.org/) - Inspiration for this aesthetic

## ⚡ Additional Extensions to Try

Install these manually from [extensions.gnome.org](https://extensions.gnome.org):

1. **Material Shell** - Tiling window manager
2. **Compiz Windows Effect** - Wobbly windows
3. **Desktop Cube** - 3D workspace switching
4. **Window Corners** - Force rounded corners
5. **Transparent Window Moving** - Transparency when dragging

## 🎊 Enjoy Your Beautiful Desktop!

Your GNOME desktop should now look stunning with:
- ✨ Transparent, blurred panels
- 🎨 Beautiful animations
- 🔒 Aesthetic lock screen
- 💫 Smooth transitions everywhere

**Welcome to aesthetic GNOME!** 🚀

