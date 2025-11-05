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

log_info "🔒 Configuring beautiful lock screen..."

log_info "Setting lock screen preferences..."
gsettings set org.gnome.desktop.screensaver lock-enabled true
gsettings set org.gnome.desktop.screensaver lock-delay 0
gsettings set org.gnome.desktop.session idle-delay 600
gsettings set org.gnome.desktop.screensaver show-notifications true
gsettings set org.gnome.desktop.screensaver show-full-name-in-top-bar true
gsettings set org.gnome.desktop.screensaver user-switch-enabled true

log_info "Configuring GDM (login screen) for aesthetics..."

GDM_CSS_DIR="/usr/share/gnome-shell/theme"
CUSTOM_GDM_CSS="$HOME/.config/dotfiles/configs/gnome/lock-screen/gdm3.css"

if [ -d "$GDM_CSS_DIR" ]; then
    log_info "Creating custom GDM CSS..."

    cat > "$CUSTOM_GDM_CSS" << 'EOF'
/* Custom GDM/Lock Screen Styling - Hyprland-inspired aesthetic */

#lockDialogGroup {
  background: rgba(26, 26, 26, 0.95);
  backdrop-filter: blur(40px);
}

.login-dialog {
  border: none;
  background: rgba(45, 45, 45, 0.85);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}

.login-dialog .modal-dialog-button {
  border-radius: 10px;
  padding: 12px 24px;
  transition: all 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.login-dialog .modal-dialog-button:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.login-dialog StEntry {
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px;
  transition: all 200ms ease;
}

.login-dialog StEntry:focus {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(100, 181, 246, 0.6);
  box-shadow: 0 0 0 3px rgba(100, 181, 246, 0.2);
}

#panel {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

#panel .panel-button {
  transition: all 150ms ease;
}

#panel .panel-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.screen-shield-background {
  background: radial-gradient(circle at center, rgba(45, 45, 45, 0.9), rgba(26, 26, 26, 1));
}

.unlock-dialog-clock {
  font-size: 64px;
  font-weight: 300;
  text-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

.unlock-dialog-clock-time {
  font-weight: 200;
  letter-spacing: 2px;
}

.unlock-dialog-clock-date {
  font-size: 18px;
  font-weight: 300;
  margin-top: 12px;
}

.unlock-dialog-notifications-container {
  background: rgba(45, 45, 45, 0.8);
  backdrop-filter: blur(15px);
  border-radius: 12px;
  padding: 8px;
}

.notification-banner {
  background: rgba(60, 60, 60, 0.9);
  border-radius: 10px;
  padding: 12px;
  margin: 4px;
}
EOF

    log_success "Custom GDM CSS created at: $CUSTOM_GDM_CSS"
    log_warning "To apply GDM styling, you need to run (requires sudo):"
    log_info "  sudo cp $CUSTOM_GDM_CSS $GDM_CSS_DIR/gnome-shell.css"
    log_info "  Then restart GDM: sudo systemctl restart gdm"
    log_warning "⚠️  This will log you out! Save your work first."
else
    log_error "GDM CSS directory not found at $GDM_CSS_DIR"
fi

log_info "Setting beautiful lock screen wallpaper preferences..."
gsettings set org.gnome.desktop.background picture-options 'zoom'
gsettings set org.gnome.desktop.screensaver picture-options 'zoom'

log_success "✨ Lock screen configuration complete!"
log_info "For the GDM changes to take effect, run:"
echo -e "${YELLOW}sudo cp $CUSTOM_GDM_CSS $GDM_CSS_DIR/gnome-shell.css && sudo systemctl restart gdm${NC}"
