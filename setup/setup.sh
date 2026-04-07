#!/bin/bash
set -euo pipefail

DRY_RUN=false
VERBOSE=false

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"
export SCRIPT_DIR

source "$LIB_DIR/logger.sh"
source "$LIB_DIR/executor.sh"
source "$LIB_DIR/packages.sh"
source "$LIB_DIR/installers.sh"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
    --dry-run       Show what would be installed without installing
    --verbose       Show detailed output
    --category C    Install only specific category (essential, langs, fonts, tools, terminals, curl-tools, npm-tools, git-tools, editors, docker, system, hardware, media, desktop)
    --package P     Install specific package
    -h, --help      Show this help message

Examples:
    $(basename "$0")                      # Install all essential packages
    $(basename "$0") --category curl-tools # Install only curl-based tools
    $(basename "$0") --package starship   # Install only starship
    $(basename "$0") --dry-run             # Show what would be installed
EOF
}

setup_passwordless_sudo() {
    local current_user
    current_user="$(whoami)"
    local sudoers_file="/etc/sudoers.d/99-${current_user}-nopasswd"
    local sudoers_entry="${current_user} ALL=(ALL) NOPASSWD:ALL"
    
    if sudo test -f "$sudoers_file" 2>/dev/null; then
        if sudo grep -qF "$sudoers_entry" "$sudoers_file" 2>/dev/null; then
            return 0
        fi
    fi
    
    log_info "Configuring passwordless sudo (requires password once)..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN]${NC} Would configure passwordless sudo"
        return 0
    fi
    
    echo "$sudoers_entry" | sudo tee "$sudoers_file" > /dev/null
    sudo chmod 440 "$sudoers_file" 2>/dev/null || true
    
    log_success "Passwordless sudo configured"
}

configure_desktop() {
    log_info "Configuring GNOME desktop aesthetics..."
    
    if ! command -v gsettings &>/dev/null; then
        log_warn "gsettings not found - skipping desktop config"
        return 0
    fi
    
    configure_dark_theme
    configure_hide_dock
    configure_window_controls
    configure_animations
    configure_icons
    configure_cursor
    configure_top_bar
    configure_fonts
    
    log_success "Desktop aesthetics configured"
}

configure_dark_theme() {
    log_step "Setting dark theme..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN]${NC} Would set dark theme"
        return 0
    fi
    gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark' 2>/dev/null || true
    gsettings set org.gnome.desktop.interface gtk-theme 'Yaru-dark' 2>/dev/null || true
    gsettings set org.gnome.desktop.interface icon-theme 'Papirus-Dark' 2>/dev/null || true
    gsettings set org.gnome.shell.extensions.user-theme name 'Yaru-dark' 2>/dev/null || true
    log_success "Dark theme configured"
}

configure_hide_dock() {
    log_step "Configuring dock (hide mode)..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN]${NC} Would hide dock"
        return 0
    fi
    gsettings set org.gnome.shell.extensions.dash-to-dock autohide true 2>/dev/null || true
    gsettings set org.gnome.shell.extensions.dash-to-dock dock-position 'LEFT' 2>/dev/null || true
    gsettings set org.gnome.shell.extensions.dash-to-dock transparency-mode 'DYNAMIC' 2>/dev/null || true
    gsettings set org.gnome.shell.extensions.dash-to-dock background-opacity 0.3 2>/dev/null || true
    gsettings set org.gnome.shell.extensions.dash-to-dock customize-alphas true 2>/dev/null || true
    gsettings set org.gnome.shell.extensions.dash-to-dock min-alpha 0.2 2>/dev/null || true
    gsettings set org.gnome.shell.extensions.dash-to-dock max-alpha 0.6 2>/dev/null || true
    gsettings set org.gnome.shell.extensions.dash-to-dock running-indicator-style 'DOTS' 2>/dev/null || true
    log_success "Dock configured (hidden, left side)"
}

configure_window_controls() {
    log_step "Configuring window controls..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN]${NC} Would set window controls"
        return 0
    fi
    gsettings set org.gnome.desktop.wm.preferences button-layout 'close,minimize,maximize:' 2>/dev/null || true
    gsettings set org.gnome.mutter center-new-windows true 2>/dev/null || true
    log_success "Window controls configured"
}

configure_animations() {
    log_step "Configuring animations..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN]${NC} Would configure animations"
        return 0
    fi
    gsettings set org.gnome.desktop.interface reduce-motion true 2>/dev/null || true
    gsettings set org.gnome.desktop.interface enable-animations false 2>/dev/null || true
    log_success "Animations configured (reduced)"
}

configure_icons() {
    log_step "Installing icon theme..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN]${NC} Would install Papirus icons"
        return 0
    fi
    if fc-list | grep -qi "Papirus"; then
        log_success "Papirus icons already installed"
    else
        sudo rm -f /etc/apt/sources.list.d/thopiekar* 2>/dev/null || true
        sudo add-apt-repository -y ppa:papirus/papirus 2>&1 | grep -v "^Hit:" | grep -v "^Get:" | grep -v "^Ign:" | grep -v "^Reading" || true
        sudo apt update -qq 2>&1 | grep -v "^Hit:" | grep -v "^Get:" | grep -v "^Reading" || true
        sudo apt install -y -qq papirus-icon-theme 2>&1 | grep -v "^Selecting" | grep -v "^Preparing" | grep -v "^Unpacking" | grep -v "^Setting up" || true
    fi
    gsettings set org.gnome.desktop.interface icon-theme 'Papirus-Dark' 2>/dev/null || true
    log_success "Icon theme configured"
}

configure_cursor() {
    log_step "Configuring cursor theme..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN]${NC} Would configure cursor"
        return 0
    fi
    gsettings set org.gnome.desktop.interface cursor-theme 'Bibata-Modern-Classic' 2>/dev/null || true
    log_success "Cursor theme configured"
}

configure_top_bar() {
    log_step "Configuring top bar..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN]${NC} Would configure top bar"
        return 0
    fi
    gsettings set org.gnome.desktop.interface show-battery-percentage true 2>/dev/null || true
    gsettings set org.gnome.desktop.interface clock-format '24h' 2>/dev/null || true
    gsettings set org.gnome.desktop.interface clock show-weekday true 2>/dev/null || true
    log_success "Top bar configured"
}

configure_fonts() {
    log_step "Configuring fonts..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN]${NC} Would configure fonts"
        return 0
    fi
    gsettings set org.gnome.desktop.interface font-antialiasing 'rgba' 2>/dev/null || true
    gsettings set org.gnome.desktop.interface font-hinting 'slight' 2>/dev/null || true
    gsettings set org.gnome.desktop.interface document-font-name 'Inter 11' 2>/dev/null || true
    gsettings set org.gnome.desktop.interface font-name 'Inter 11' 2>/dev/null || true
    gsettings set org.gnome.desktop.interface monospace-font-name 'JetBrains Mono 11' 2>/dev/null || true
    log_success "Fonts configured"
}

set_default_terminal() {
    local terminal="$1"
    log_info "Setting $terminal as default terminal..."
    
    if command -v gsettings &> /dev/null; then
        gsettings set org.gnome.desktop.default-applications.terminal exec "$terminal"
        gsettings set org.gnome.desktop.default-applications.terminal exec-arg "-e"
    fi
    
    log_success "$terminal set as default terminal"
}

install_category() {
    local category="$1"
    
    case "$category" in
        essential)
            install_apt "git"
            install_apt "curl"
            install_apt "wget"
            install_apt "build-essential"
            install_apt "ca-certificates"
            install_apt "gnupg"
            install_apt "software-properties-common"
            install_apt "fish"
            setup_config_symlinks
            ;;
        langs)
            install_apt "python3"
            install_apt "python3-pip"
            install_apt "python3-venv"
            install_apt "nodejs"
            install_curl "https://get.pnpm.io/install.sh" "pnpm" "sh"
            install_curl "https://bun.sh/install" "bun" "bash"
            install_curl "https://sh.rustup.rs" "rustup" "bash" "-s -y"
            install_dotnet
            ;;
        tools)
            install_apt "neovim"
            install_apt "vim"
            install_apt "ripgrep"
            install_apt "fd-find"
            install_apt "fzf"
            install_apt "zoxide"
            install_apt "eza"
            install_apt "bat"
            install_apt "htop"
            install_apt "tree"
            install_apt "jq"
            ;;
        terminals)
            install_ghostty
            set_default_terminal ghostty
            ;;
        curl-tools)
            install_curl "https://starship.rs/install.sh" "starship" "sh"
            setup_starship_config
            install_curl "https://fnm.vercel.app/install" "fnm" "bash"
            install_curl "https://sh.rustup.rs" "rustup" "bash" "-y"
            install_curl "https://astral.sh/uv/install.sh" "uv" "sh"
            install_curl "https://get.tur.so/install.sh" "turso" "sh"
            ;;
        npm-tools)
            install_npm "vercel" "vercel"
            install_npm "@google/gemini-cli" "gemini"
            ;;
        git-tools)
            install_apt "gh"
            install_github "jesseduffield/lazygit" "lazygit"
            install_github "jesseduffield/lazydocker" "lazydocker"
            ;;
        editors)
            install_zed
            install_vscode
            install_opencode
            ;;
        docker)
            install_apt "docker.io"
            install_apt "docker-compose"
            ;;
        system)
            install_apt "neofetch" "Neofetch"
            install_apt "btop" "Btop"
            ;;
        hardware)
            install_nvidia
            install_openrgb
            ;;
        media)
            install_apt "vlc" "VLC"
            install_snap "spotify" "Spotify" "--classic"
            ;;
        fonts)
            install_all_fonts
            ;;
        desktop)
            configure_desktop
            ;;
        *)
            log_error "Unknown category: $category"
            return 1
            ;;
    esac
}

install_package() {
    local pkg="$1"
    local method
    local extra
    local shell
    local flags
    
    method=$(get_method "$pkg")
    extra=$(get_extra "$pkg")
    shell=$(get_shell "$pkg")
    flags=$(get_flags "$pkg")
    
    if [[ -z "$method" ]]; then
        log_error "Unknown package: $pkg"
        return 1
    fi
    
    case "$method" in
        apt)
            install_apt "$pkg" "$pkg"
            ;;
        curl)
            install_curl "$extra" "$pkg" "$shell" "$flags"
            ;;
        npm)
            install_npm "$pkg" "$pkg"
            ;;
        github)
            install_github "$extra" "$pkg"
            ;;
        snap)
            install_snap "$pkg" "$pkg" "$flags"
            ;;
        script)
            case "$pkg" in
                zed) install_zed ;;
                vscode) install_vscode ;;
                opencode) install_opencode ;;
                *) log_error "Unknown script package: $pkg" ;;
            esac
            ;;
        *)
            log_error "Unknown method: $method"
            return 1
            ;;
    esac
}

install_all() {
    install_category "essential"
    install_category "langs"
    install_category "tools"
    install_category "curl-tools"
    install_category "git-tools"
    install_category "editors"
    install_category "terminals"
    install_category "docker"
    install_category "fonts"
}

category=""
package=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --category)
            category="$2"
            shift 2
            ;;
        --package)
            package="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

setup_passwordless_sudo

init_packages

log_header "Setup - Shell Installer"

if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}━━━ DRY RUN MODE - No changes will be made ━━━${NC}"
    echo ""
fi

run_with_progress() {
    local cat="$1"
    set_progress_category "$cat"
    install_category "$cat"
    update_progress "$cat"
}

if [[ -n "$category" ]]; then
    log_info "Installing category: $category"
    init_progress 1
    run_with_progress "$category"
elif [[ -n "$package" ]]; then
    log_info "Installing package: $package"
    init_progress 1
    install_package "$package"
    update_progress "$package"
else
    init_progress 9
    run_with_progress "essential"
    run_with_progress "langs"
    run_with_progress "tools"
    run_with_progress "curl-tools"
    run_with_progress "git-tools"
    run_with_progress "editors"
    run_with_progress "terminals"
    run_with_progress "docker"
    run_with_progress "fonts"
fi

echo ""
if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}━━━ DRY RUN COMPLETE ━━━${NC}"
    echo "Run without --dry-run to apply changes"
else
    log_success "Setup complete!"
fi
