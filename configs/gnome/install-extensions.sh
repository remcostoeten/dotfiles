#!/usr/bin/env bash

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

EXTENSIONS=(
    "3193"  # Blur my Shell
    "307"   # Dash to Dock
    "19"    # User Themes
    "1460"  # Vitals (system monitor)
    "4679"  # Burn My Windows (beautiful window effects)
    "5410"  # Grand Theft Focus (focus stealing prevention)
    "6203"  # Quick Settings Tweaker
)

check_internet() {
    if ! ping -c 1 extensions.gnome.org &> /dev/null; then
        log_warning "Cannot reach extensions.gnome.org. Please check your internet connection."
        return 1
    fi
    return 0
}

install_extension() {
    local extension_id=$1
    log_info "Installing extension ID: $extension_id"
    
    if command -v gnome-extensions-cli &> /dev/null; then
        gnome-extensions-cli install "$extension_id"
    elif command -v gext &> /dev/null; then
        gext install "$extension_id"
    else
        log_warning "No extension installer found. Installing gnome-shell-extension-installer..."
        
        if command -v wget &> /dev/null; then
            wget -O /tmp/gnome-shell-extension-installer "https://github.com/brunelli/gnome-shell-extension-installer/raw/master/gnome-shell-extension-installer"
            chmod +x /tmp/gnome-shell-extension-installer
            sudo mv /tmp/gnome-shell-extension-installer /usr/local/bin/
            /usr/local/bin/gnome-shell-extension-installer "$extension_id" --yes
        else
            log_warning "wget not found. Please install extensions manually from extensions.gnome.org"
            log_info "Extension ID: $extension_id - Visit: https://extensions.gnome.org/extension/$extension_id/"
            return 1
        fi
    fi
}

log_info "🔌 Installing additional GNOME extensions for aesthetics..."

if ! check_internet; then
    log_warning "Skipping extension installation due to connectivity issues."
    exit 1
fi

for ext_id in "${EXTENSIONS[@]}"; do
    install_extension "$ext_id" || log_warning "Failed to install extension $ext_id"
    sleep 1
done

log_success "✨ Extension installation complete!"
log_info "Please log out and log back in, or restart GNOME Shell (Alt+F2, type 'r')"
log_info "Then run apply-gnome-aesthetics.sh to configure them."

