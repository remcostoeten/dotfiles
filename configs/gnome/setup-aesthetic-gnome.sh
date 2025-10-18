#!/usr/bin/env bash

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

banner() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║        🎨 GNOME Aesthetic Setup - Hyprland Style 🎨       ║"
    echo "║                                                            ║"
    echo "║          Transform your GNOME into a beautiful            ║"
    echo "║          transparent, blurred, aesthetic machine          ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_step() {
    echo -e "\n${CYAN}${BOLD}━━━ $1 ━━━${NC}\n"
}

confirm() {
    local prompt="$1"
    local default="${2:-n}"
    
    if [ "$default" = "y" ]; then
        prompt="$prompt [Y/n] "
    else
        prompt="$prompt [y/N] "
    fi
    
    read -p "$(echo -e ${YELLOW}${prompt}${NC})" response
    response=${response:-$default}
    
    [[ "$response" =~ ^[Yy]$ ]]
}

check_dependencies() {
    log_step "Checking dependencies"
    
    local missing_deps=()
    
    if ! command -v gnome-extensions &> /dev/null; then
        missing_deps+=("gnome-shell-extensions")
    fi
    
    if ! command -v gsettings &> /dev/null; then
        missing_deps+=("gsettings")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        if confirm "Install missing dependencies?"; then
            sudo apt update
            sudo apt install -y "${missing_deps[@]}"
        else
            log_error "Cannot proceed without dependencies"
            exit 1
        fi
    fi
    
    log_success "All dependencies satisfied"
}

install_fonts() {
    log_step "Installing recommended fonts"
    
    if confirm "Install Inter font for beautiful UI?"; then
        log_info "Installing Inter font..."
        mkdir -p ~/.local/share/fonts
        
        if command -v wget &> /dev/null; then
            cd /tmp
            wget -q "https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip" -O inter.zip
            unzip -q inter.zip -d inter
            cp inter/*.ttf ~/.local/share/fonts/
            fc-cache -f
            rm -rf inter inter.zip
            log_success "Inter font installed"
        else
            log_warning "wget not found, skipping font installation"
        fi
    fi
}

main() {
    banner
    
    log_info "This script will transform your GNOME desktop with:"
    echo "  • Transparent and blurred top panel"
    echo "  • Beautiful window effects and animations"
    echo "  • Custom GTK theming with rounded corners"
    echo "  • Aesthetic lock screen styling"
    echo "  • Enhanced visual effects throughout"
    echo ""
    
    if ! confirm "Continue with setup?" "y"; then
        log_warning "Setup cancelled"
        exit 0
    fi
    
    check_dependencies
    
    install_fonts
    
    log_step "Applying GNOME aesthetic configuration"
    if [ -f "$SCRIPT_DIR/apply-gnome-aesthetics.sh" ]; then
        bash "$SCRIPT_DIR/apply-gnome-aesthetics.sh"
    else
        log_error "apply-gnome-aesthetics.sh not found"
    fi
    
    log_step "Applying GTK custom styling"
    if [ -f "$SCRIPT_DIR/apply-gtk-styling.sh" ]; then
        bash "$SCRIPT_DIR/apply-gtk-styling.sh"
    else
        log_error "apply-gtk-styling.sh not found"
    fi
    
    log_step "Configuring lock screen"
    if [ -f "$SCRIPT_DIR/lock-screen/configure-lock-screen.sh" ]; then
        bash "$SCRIPT_DIR/lock-screen/configure-lock-screen.sh"
    else
        log_error "configure-lock-screen.sh not found"
    fi
    
    if confirm "Install additional aesthetic extensions?"; then
        log_step "Installing GNOME extensions"
        if [ -f "$SCRIPT_DIR/install-extensions.sh" ]; then
            bash "$SCRIPT_DIR/install-extensions.sh" || log_warning "Some extensions may have failed to install"
        fi
    fi
    
    echo ""
    log_success "╔═══════════════════════════════════════════════════════╗"
    log_success "║  ✨ GNOME Aesthetic Setup Complete! ✨                ║"
    log_success "╚═══════════════════════════════════════════════════════╝"
    echo ""
    log_info "Next steps:"
    echo "  1. Log out and log back in for all changes to take effect"
    echo "  2. Or restart GNOME Shell: Press Alt+F2, type 'r', press Enter"
    echo "  3. For GDM (login screen) styling, see:"
    echo "     $SCRIPT_DIR/lock-screen/configure-lock-screen.sh"
    echo ""
    log_info "To customize further:"
    echo "  • Extensions: gnome-extensions prefs <extension-name>"
    echo "  • GTK CSS: Edit ~/.config/gtk-3.0/gtk.css or ~/.config/gtk-4.0/gtk.css"
    echo "  • Blur settings: Configured in blur-my-shell extension"
    echo ""
    
    if confirm "Restart GNOME Shell now?"; then
        if [ "$XDG_SESSION_TYPE" = "wayland" ]; then
            log_warning "On Wayland, you need to log out and log back in"
            if confirm "Log out now?"; then
                gnome-session-quit --logout --no-prompt
            fi
        else
            log_info "Restarting GNOME Shell..."
            killall -SIGQUIT gnome-shell
        fi
    fi
}

main "$@"

