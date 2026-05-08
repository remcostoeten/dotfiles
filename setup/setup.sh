#!/bin/bash
set -euo pipefail

DRY_RUN=false
VERBOSE=false
START_TIME=$(date +%s)

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
    --category C    Install only specific category (essential, langs, fonts, tools, terminals, curl-tools, npm-tools, git-tools, editors, docker, system, hardware, media, desktop, hyprland)
    --package P     Install specific package
    -h, --help      Show this help message

Examples:
    $(basename "$0")                      # Install all essential packages
    $(basename "$0") --category curl-tools # Install only curl-based tools
    $(basename "$0") --package starship   # Install only starship
    $(basename "$0") --dry-run             # Show what would be installed
EOF
}

preflight() {
    local repo_root="$SCRIPT_DIR/.."

    if [[ ! -d "$repo_root/configs" || ! -d "$repo_root/setup/lib" ]]; then
        log_error "This setup script must run from a complete dotfiles checkout."
        log_error "Expected repo layout under: $repo_root"
        return 1
    fi

    if ! command -v sudo >/dev/null 2>&1; then
        log_error "sudo is required before this setup can install packages."
        return 1
    fi

    case "$(detect_package_manager)" in
        apt|pacman)
            ;;
        *)
            log_error "No supported package manager found. Supported: apt, pacman."
            return 1
            ;;
    esac
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

    local tmp_sudoers
    tmp_sudoers="$(mktemp)"
    printf '%s\n' "$sudoers_entry" > "$tmp_sudoers"

    if ! sudo visudo -cf "$tmp_sudoers" >/dev/null 2>&1; then
        rm -f "$tmp_sudoers"
        log_error "Generated sudoers entry failed validation."
        return 1
    fi

    sudo install -o root -g root -m 0440 "$tmp_sudoers" "$sudoers_file"
    rm -f "$tmp_sudoers"

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
    setup_wallpaper_rotation
    
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
        if command -v apt >/dev/null 2>&1; then
            sudo rm -f /etc/apt/sources.list.d/thopiekar* 2>/dev/null || true
            sudo add-apt-repository -y ppa:papirus/papirus 2>&1 | grep -v "^Hit:" | grep -v "^Get:" | grep -v "^Ign:" | grep -v "^Reading" || true
            sudo apt update -qq 2>&1 | grep -v "^Hit:" | grep -v "^Get:" | grep -v "^Reading" || true
            sudo apt install -y -qq papirus-icon-theme 2>&1 | grep -v "^Selecting" | grep -v "^Preparing" | grep -v "^Unpacking" | grep -v "^Setting up" || true
        elif command -v pacman >/dev/null 2>&1; then
            sudo pacman -S --noconfirm --needed papirus-icon-theme >/dev/null 2>&1 || true
        fi
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

setup_wallpaper_rotation() {
    log_step "Setting up wallpaper rotation service..."
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN]${NC} Would set up wallpaper rotation timer"
        return 0
    fi

    local systemd_dir="$HOME/.config/systemd/user"
    mkdir -p "$systemd_dir"

    cat > "$systemd_dir/wallpaper-rotate.service" << EOF
[Unit]
Description=Wallpaper random rotation

[Service]
Type=oneshot
ExecStart=$HOME/.config/dotfiles/bin/wallpaper random
EOF

    cat > "$systemd_dir/wallpaper-rotate.timer" << 'EOF'
[Unit]
Description=Wallpaper random rotation every minute

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
Persistent=true

[Install]
WantedBy=timers.target
EOF

    systemctl --user daemon-reload 2>/dev/null || true
    systemctl --user enable --now wallpaper-rotate.timer 2>/dev/null || true

    log_success "Wallpaper rotation enabled"
}

set_default_terminal() {
    local terminal="$1"
    log_info "Setting $terminal as default terminal..."

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN]${NC} Would set $terminal as default terminal"
        return 0
    fi
    
    if command -v gsettings &> /dev/null; then
        gsettings set org.gnome.desktop.default-applications.terminal exec "$terminal"
        gsettings set org.gnome.desktop.default-applications.terminal exec-arg "-e"
    fi
    
    log_success "$terminal set as default terminal"
}

detect_desktop() {
    local desktop="${XDG_CURRENT_DESKTOP:-}"
    local session="${XDG_SESSION_DESKTOP:-${DESKTOP_SESSION:-}}"
    local session_type="${XDG_SESSION_TYPE:-}"

    if [[ "$desktop" =~ [Hh]yprland ]] || [[ "$session" =~ [Hh]yprland ]] || command -v hyprctl &>/dev/null; then
        echo "hyprland"
    elif [[ "$desktop" =~ GNOME ]] || [[ "$session" =~ GNOME ]] || [[ "$desktop" =~ ubuntu ]] || [[ "$session" =~ ubuntu ]]; then
        echo "gnome"
    elif [[ -n "$desktop" ]]; then
        echo "$desktop"
    elif [[ -n "$session" ]]; then
        echo "$session"
    elif [[ "$session_type" == "wayland" ]]; then
        echo "wayland"
    else
        echo "none"
    fi
}

detect_distro() {
    if [[ -r /etc/os-release ]]; then
        source /etc/os-release
        echo "${PRETTY_NAME:-${ID:-unknown}}"
    else
        echo "unknown"
    fi
}

_show_system_info_cached=0
_cache_os_family=""
_cache_distro=""
_cache_desktop=""
_cache_pm=""

supports_emoji() {
    if [[ "${TERM:-}" =~ linux ]]; then
        return 1
    fi
    if [[ "${LC_ALL:-${LC_CTYPE:-$LANG}}" =~ (C|POSIX|ASCII) ]]; then
        return 1
    fi
    return 0
}

show_system_info() {
    if [[ $_show_system_info_cached -eq 0 ]]; then
        _cache_os_family=$(detect_os_family)
        _cache_distro=$(detect_distro)
        _cache_desktop=$(detect_desktop)
        _cache_pm=$(detect_package_manager)
        _cache_arch=$(uname -m 2>/dev/null || echo "unknown")
        _cache_kernel=$(uname -r 2>/dev/null | cut -d'-' -f1 || echo "unknown")
        _cache_hostname=$(hostname 2>/dev/null || echo "unknown")
        _cache_uptime=$(uptime -p 2>/dev/null | sed 's/^up //' || echo "unknown")
        _show_system_info_cached=1
    fi

    local os_icon desktop_icon uptime_icon host_icon
    if supports_emoji; then
        case "$_cache_os_family" in
            arch) os_icon="🦀" ;;
            debian) os_icon="🌀" ;;
            *) os_icon="🐧" ;;
        esac
        case "$_cache_desktop" in
            gnome|GNOME) desktop_icon="🖥" ;;
            hyprland|Hyprland) desktop_icon="🌊" ;;
            none) desktop_icon="❌" ;;
            *) desktop_icon="📱" ;;
        esac
        uptime_icon="⏱"
        host_icon="🖥"
    else
        case "$_cache_os_family" in
            arch) os_icon="(a)" ;;
            debian) os_icon="(d)" ;;
            *) os_icon="(*)" ;;
        esac
        case "$_cache_desktop" in
            gnome|GNOME) desktop_icon="[gnome]" ;;
            hyprland|Hyprland) desktop_icon="[hypr]" ;;
            none) desktop_icon="[none]" ;;
            *) desktop_icon="[?]" ;;
        esac
        uptime_icon="T"
        host_icon="H"
    fi

    local term_width
    term_width=$(tput cols 2>/dev/null || echo 50)
    local line_len=$((term_width - 4))
    [[ $line_len -lt 20 ]] && line_len=20
    local line=$(printf '─%.0s' $(seq 1 "$line_len"))

    local timestamp
    timestamp=$(date '+%H:%M:%S')

    printf '\n%b╭%s╮%b\n' "$CYAN" "$line" "$NC"
    printf '│ %b%s %s%b %-14s  %b%s %s%b │\n' \
        "$GREEN" "$os_icon" "$_cache_os_family" "$NC" \
        "$_cache_distro" \
        "$BLUE" "$desktop_icon" "$_cache_desktop" "$NC"
    printf '│ %b%s %s %b%s %s %b│\n' \
        "$GRAY" "$uptime_icon" "$_cache_uptime" "$NC" "$host_icon" "$_cache_hostname" "$NC"
    printf '│ %b%-10s%b %-14s %b%-10s%b %-8s │\n' \
        "$GRAY" "Arch:" "$NC" "$_cache_arch" \
        "$GRAY" "Kernel:" "$NC" "$_cache_kernel"
    printf '│ %b%-10s%b %-14s %b%-10s%b %-8s │\n' \
        "$GRAY" "Package:" "$NC" "$_cache_pm" \
        "$GRAY" "Shell:" "$NC" "${SHELL##*/}"
    printf '│ %b%-10s%b %-14s %b%-10s%b %-8s │\n' \
        "$GRAY" "Time:" "$NC" "$timestamp" \
        "$GRAY" "Host:" "$NC" "$_cache_hostname"
    printf '%b╰%s╯%b\n' "$CYAN" "$line" "$NC"
    echo ""
}

install_hyprland() {
    log_info "Installing Hyprland and configs..."

    install_apt "hyprland" "Hyprland"
    install_apt "waybar" "Waybar"
    install_apt "rofi" "Rofi"
    install_apt "dunst" "Dunst"
    install_apt "brightnessctl" "Brightness control"
    install_apt "playerctl" "Media controls"
    install_apt "polkit-gnome" "Polkit GNOME"
    install_apt "swayosd" "SwayOSD"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would enable SwayOSD libinput backend if available"
    elif command -v swayosd-client &>/dev/null; then
        sudo systemctl enable --now swayosd-libinput-backend.service 2>/dev/null || true
    fi
    
    setup_config_symlinks
    
    log_success "Hyprland configured"
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
            install_apt "npm"
            install_curl "https://get.pnpm.io/install.sh" "pnpm" "sh"
            install_curl "https://bun.sh/install" "bun" "bash"
            install_curl "https://sh.rustup.rs" "rustup" "bash" "-y"
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
            install_apt "fastfetch" "Fastfetch"
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
            local desktop_type
            desktop_type=$(detect_desktop)
            case "$desktop_type" in
                hyprland|Hyprland)
                    install_hyprland
                    ;;
                gnome|GNOME|ubuntu|Ubuntu)
                    configure_desktop
                    ;;
                *)
                    log_warn "No desktop environment detected, skipping desktop config"
                    ;;
            esac
            ;;
        hyprland)
            install_hyprland
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
    install_category "hyprland"
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
            if [[ $# -lt 2 ]]; then
                log_error "--category requires a value"
                exit 1
            fi
            category="$2"
            shift 2
            ;;
        --package)
            if [[ $# -lt 2 ]]; then
                log_error "--package requires a value"
                exit 1
            fi
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

init_packages

log_header "Setup - Shell Installer"

show_system_info

if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}━━━ DRY RUN MODE - No changes will be made ━━━${NC}"
    echo ""
fi

preflight
setup_passwordless_sudo
install_arch_audio
ensure_fish_config
set_fish_default_shell

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
    init_progress 10
    run_with_progress "essential"
    run_with_progress "langs"
    run_with_progress "tools"
    run_with_progress "curl-tools"
    run_with_progress "git-tools"
    run_with_progress "editors"
    run_with_progress "terminals"
    run_with_progress "docker"
    run_with_progress "fonts"
    run_with_progress "hyprland"
fi

echo ""
if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}━━━ DRY RUN COMPLETE ━━━${NC}"
    echo "Run without --dry-run to apply changes"
else
    end_time=$(date +%s)
    elapsed=$((end_time - START_TIME))
    color="${GREEN}"
    [[ $elapsed -gt 60 ]] && color="${YELLOW}"
    [[ $elapsed -gt 300 ]] && color="${RED}"

    term_width=$(tput cols 2>/dev/null || echo 50)
    line=$(printf '═%.0s' $(seq 1 $((term_width - 2))))

    printf '\n%b╔%s╗%b\n' "$GREEN" "$line" "$NC"
    printf '║%*s%b ✓ Setup complete in %s%s%b %*s║\n' \
        $(( (term_width - 25) / 2 )) "" "$NC" "$color" "${elapsed}s" "$NC" \
        $(( (term_width - 25) / 2 )) ""
    printf '%b╚%s╝%b\n' "$GREEN" "$line" "$NC"

    if command -v fastfetch &>/dev/null; then
        echo ""
        fastfetch --logo none --structure os arch kernel de uptime theme 2>/dev/null || true
    fi
fi
