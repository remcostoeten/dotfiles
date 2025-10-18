#!/usr/bin/env bash

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_info "🎨 Applying GNOME Aesthetic Configuration..."

log_info "Configuring Blur My Shell for maximum aesthetics..."
gsettings set org.gnome.shell.extensions.blur-my-shell.panel blur true
gsettings set org.gnome.shell.extensions.blur-my-shell.panel brightness 0.6
gsettings set org.gnome.shell.extensions.blur-my-shell.panel sigma 30
gsettings set org.gnome.shell.extensions.blur-my-shell.panel static-blur true
gsettings set org.gnome.shell.extensions.blur-my-shell.panel override-background true
gsettings set org.gnome.shell.extensions.blur-my-shell.panel override-background-dynamically false
gsettings set org.gnome.shell.extensions.blur-my-shell.panel style-panel 0

log_info "Enabling blur for overview and lock screen..."
gsettings set org.gnome.shell.extensions.blur-my-shell.overview blur true
gsettings set org.gnome.shell.extensions.blur-my-shell.overview brightness 0.5
gsettings set org.gnome.shell.extensions.blur-my-shell.overview sigma 60
gsettings set org.gnome.shell.extensions.blur-my-shell.lockscreen blur true
gsettings set org.gnome.shell.extensions.blur-my-shell.lockscreen brightness 0.4
gsettings set org.gnome.shell.extensions.blur-my-shell.lockscreen sigma 50

log_info "Configuring window blur effects..."
gsettings set org.gnome.shell.extensions.blur-my-shell.window-list blur true
gsettings set org.gnome.shell.extensions.blur-my-shell.appfolder blur true
gsettings set org.gnome.shell.extensions.blur-my-shell.dash-to-dock blur true

log_info "Configuring Just Perfection for clean interface..."
gsettings set org.gnome.shell.extensions.just-perfection panel true
gsettings set org.gnome.shell.extensions.just-perfection panel-in-overview true
gsettings set org.gnome.shell.extensions.just-perfection panel-button-padding-size 8
gsettings set org.gnome.shell.extensions.just-perfection panel-indicator-padding-size 4
gsettings set org.gnome.shell.extensions.just-perfection animation 2
gsettings set org.gnome.shell.extensions.just-perfection workspace-switcher-should-show true
gsettings set org.gnome.shell.extensions.just-perfection startup-status 0

log_info "Configuring window decorations..."
gsettings set org.gnome.desktop.wm.preferences button-layout 'close,minimize,maximize:'
gsettings set org.gnome.mutter center-new-windows true

log_info "Configuring Ubuntu Dock for aesthetics..."
gsettings set org.gnome.shell.extensions.dash-to-dock transparency-mode 'DYNAMIC'
gsettings set org.gnome.shell.extensions.dash-to-dock background-opacity 0.3
gsettings set org.gnome.shell.extensions.dash-to-dock customize-alphas true
gsettings set org.gnome.shell.extensions.dash-to-dock min-alpha 0.2
gsettings set org.gnome.shell.extensions.dash-to-dock max-alpha 0.6
gsettings set org.gnome.shell.extensions.dash-to-dock dock-position 'BOTTOM'
gsettings set org.gnome.shell.extensions.dash-to-dock dash-max-icon-size 42
gsettings set org.gnome.shell.extensions.dash-to-dock apply-custom-theme false
gsettings set org.gnome.shell.extensions.dash-to-dock custom-theme-shrink true
gsettings set org.gnome.shell.extensions.dash-to-dock running-indicator-style 'DOTS'

log_info "Configuring interface fonts and appearance..."
gsettings set org.gnome.desktop.interface font-antialiasing 'rgba'
gsettings set org.gnome.desktop.interface font-hinting 'slight'
gsettings set org.gnome.desktop.interface enable-animations true
gsettings set org.gnome.desktop.interface cursor-blink true
gsettings set org.gnome.desktop.interface gtk-enable-primary-paste false

log_info "Configuring window manager for smooth animations..."
gsettings set org.gnome.mutter experimental-features "['scale-monitor-framebuffer']"
gsettings set org.gnome.desktop.interface enable-hot-corners true

log_info "Configuring lock screen aesthetics..."
gsettings set org.gnome.desktop.screensaver picture-uri "file:///usr/share/backgrounds/ubuntu-default-greyscale-wallpaper.png"
gsettings set org.gnome.desktop.screensaver color-shading-type 'solid'
gsettings set org.gnome.desktop.screensaver primary-color '#1a1a1a'
gsettings set org.gnome.desktop.screensaver secondary-color '#2d2d2d'

log_info "Enabling night light for comfort..."
gsettings set org.gnome.settings-daemon.plugins.color night-light-enabled true
gsettings set org.gnome.settings-daemon.plugins.color night-light-temperature 3700
gsettings set org.gnome.settings-daemon.plugins.color night-light-schedule-automatic true

log_success "✨ GNOME aesthetic configuration applied successfully!"
log_info "You may need to reload GNOME Shell (Alt+F2, type 'r', press Enter)"
log_info "Or log out and log back in for all changes to take effect."

