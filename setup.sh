#!/bin/bash

# Interactive Dotfiles Setup Script for Ubuntu/Debian
# Allows selective installation of packages and tools

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Override exit on error for specific functions - we handle errors manually
set +e  # Don't exit on error - we'll handle it manually

# Colors for output
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly YELLOW='\033[1;33m'
readonly RED='\033[0;31m'
readonly CYAN='\033[0;36m'
readonly MAGENTA='\033[0;35m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# Configuration file to save progress
readonly PROGRESS_FILE="$HOME/.config/dotfiles/.setup_progress.json"
readonly DOTFILES_DIR="$HOME/.config/dotfiles"

# Dry run mode flag
DRY_RUN=false
DRY_RUN_SECTION=""

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --dry-run-section)
                DRY_RUN=true
                DRY_RUN_SECTION="$2"
                shift 2
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --dry-run              Show what would be installed without actually installing"
                echo "  --dry-run-section NAME  Dry run for a specific section only"
                echo "  -h, --help              Show this help message"
                echo ""
                echo "Example sections:"
                echo "  dev, cli, browsers, snaps, config-apps, git, fish, fonts"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Helper functions
print_status() { echo -e "${BLUE}→${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_info() { echo -e "${CYAN}ℹ${NC} $1"; }
print_header() { echo -e "\n${BOLD}${MAGENTA}$1${NC}"; }
print_dry_run() { echo -e "${YELLOW}[DRY RUN]${NC} $1"; }

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Save progress
save_progress() {
    local category="$1"
    local item="$2"
    local status="$3"
    
    if [ ! -f "$PROGRESS_FILE" ]; then
        echo "{}" > "$PROGRESS_FILE"
    fi
    
    # Use jq if available, otherwise simple JSON manipulation
    if command_exists jq; then
        local content=$(cat "$PROGRESS_FILE")
        echo "$content" | jq ". + {\"$category\": (.${category} // {}) + {\"$item\": \"$status\"}}" > "$PROGRESS_FILE"
    else
        # Fallback: simple append (won't handle duplicates perfectly)
        echo "{\"$category\": {\"$item\": \"$status\"}}" >> "$PROGRESS_FILE"
    fi
}

# Check if item was already installed successfully
is_completed() {
    local category="$1"
    local item="$2"
    
    if [ ! -f "$PROGRESS_FILE" ]; then
        return 1
    fi
    
    if command_exists jq; then
        local status=$(jq -r ".${category}.${item} // \"\"" "$PROGRESS_FILE" 2>/dev/null)
        [ "$status" = "completed" ]
    else
        grep -q "\"$item\".*\"completed\"" "$PROGRESS_FILE" 2>/dev/null
    fi
}

# Install package with error handling
install_package() {
    local package="$1"
    local name="${2:-$package}"
    
    if [ "$DRY_RUN" = true ]; then
        print_dry_run "Would install: $name"
        return 0
    fi
    
    if is_completed "packages" "$package"; then
        print_success "$name already installed (skipped)"
        return 0
    fi
    
    # Special handling for GitHub CLI
    if [ "$package" = "gh" ]; then
        install_github_cli "$name"
        return $?
    fi
    
    # Special handling for lazygit and lazydocker
    if [ "$package" = "lazygit" ] || [ "$package" = "lazydocker" ]; then
        install_lazy_tool "$package" "$name"
        return $?
    fi
    
    # Special handling for OpenRGB
    if [ "$package" = "openrgb" ]; then
        install_openrgb "$name"
        return $?
    fi
    
    # Special handling for NVIDIA tools
    if [ "$package" = "nvidia-settings" ] || [ "$package" = "nvidia-utils" ]; then
        install_nvidia_tools "$package" "$name"
        return $?
    fi
    
    if dpkg -l | grep -q "^ii.*$package "; then
        print_success "$name already installed"
        save_progress "packages" "$package" "completed"
        return 0
    fi
    
    print_status "Installing $name..."
    if sudo apt-get install -y "$package" >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "packages" "$package" "completed"
        return 0
    else
        print_error "Failed to install $name"
        save_progress "packages" "$package" "failed"
        return 1
    fi
}

# Install GitHub CLI
install_github_cli() {
    local name="${1:-gh}"
    
    if is_completed "packages" "gh"; then
        print_success "$name already installed (skipped)"
        return 0
    fi
    
    if command_exists gh; then
        print_success "$name already installed"
        save_progress "packages" "gh" "completed"
        return 0
    fi
    
    print_status "Installing GitHub CLI..."
    
    # Add GitHub CLI repository and install
    if curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg >/dev/null 2>&1 && \
       echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null 2>&1 && \
       sudo apt update >/dev/null 2>&1 && \
       sudo apt install -y gh >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "packages" "gh" "completed"
        return 0
    else
        print_warning "Failed to install GitHub CLI via apt, trying alternative method..."
        # Fallback: try snap
        if command_exists snap; then
            if sudo snap install gh >/dev/null 2>&1; then
                print_success "$name installed via snap"
                save_progress "packages" "gh" "completed"
                return 0
            fi
        fi
        print_error "Failed to install $name"
        save_progress "packages" "gh" "failed"
        return 1
    fi
}

# Install lazygit or lazydocker
install_lazy_tool() {
    local package="$1"
    local name="${2:-$package}"
    
    if is_completed "packages" "$package"; then
        print_success "$name already installed (skipped)"
        return 0
    fi
    
    if command_exists "$package"; then
        print_success "$name already installed"
        save_progress "packages" "$package" "completed"
        return 0
    fi
    
    print_status "Installing $name..."
    
    # Get latest release URL from GitHub
    local repo=""
    if [ "$package" = "lazygit" ]; then
        repo="jesseduffield/lazygit"
    elif [ "$package" = "lazydocker" ]; then
        repo="jesseduffield/lazydocker"
    else
        print_error "Unknown lazy tool: $package"
        return 1
    fi
    
    # Detect architecture
    local arch=""
    case "$(uname -m)" in
        x86_64) arch="x86_64" ;;
        aarch64|arm64) arch="arm64" ;;
        *) print_error "Unsupported architecture for $name"; return 1 ;;
    esac
    
    # Get latest release
    local latest_url=$(curl -s https://api.github.com/repos/$repo/releases/latest | grep "browser_download_url.*Linux_${arch}.tar.gz" | head -1 | cut -d'"' -f4)
    
    if [ -z "$latest_url" ]; then
        print_warning "Could not determine download URL for $name"
        print_info "You can install manually from: https://github.com/$repo/releases"
        return 1
    fi
    
    # Download and install
    local temp_dir=$(mktemp -d)
    cd "$temp_dir" || return 1
    
    if wget -q "$latest_url" -O "${package}.tar.gz" 2>/dev/null; then
        tar -xzf "${package}.tar.gz" 2>/dev/null
        local binary=$(find . -name "$package" -type f | head -1)
        if [ -n "$binary" ] && [ -f "$binary" ]; then
            sudo mv "$binary" "/usr/local/bin/$package"
            sudo chmod +x "/usr/local/bin/$package"
            print_success "$name installed successfully"
            save_progress "packages" "$package" "completed"
            cd - >/dev/null
            rm -rf "$temp_dir"
            return 0
        fi
    fi
    
    print_error "Failed to install $name"
    save_progress "packages" "$package" "failed"
    cd - >/dev/null
    rm -rf "$temp_dir"
    return 1
}

# Install via snap
install_snap() {
    local package="$1"
    local name="${2:-$package}"
    
    if is_completed "snaps" "$package"; then
        print_success "$name already installed (skipped)"
        return 0
    fi
    
    if ! command_exists snap; then
        print_warning "snapd not installed. Installing snapd..."
        if ! install_package "snapd" "snapd"; then
            print_error "Failed to install snapd. Cannot install $name"
            return 1
        fi
        sudo systemctl enable --now snapd.socket
    fi
    
    print_status "Installing $name via snap..."
    if sudo snap install "$package" >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "snaps" "$package" "completed"
        return 0
    else
        print_error "Failed to install $name"
        save_progress "snaps" "$package" "failed"
        return 1
    fi
}

# Install via curl script
install_curl_script() {
    local url="$1"
    local name="$2"
    local args="${3:-}"
    
    if is_completed "tools" "$name"; then
        print_success "$name already installed (skipped)"
        return 0
    fi
    
    # Special handling for uvx (uv installer)
    if [ "$name" = "uvx" ]; then
        if command_exists uv; then
            print_success "$name already installed (uv is available)"
            save_progress "tools" "$name" "completed"
            return 0
        fi
    fi
    
    # Check if already installed
    if [ "$name" = "bun" ] && [ -d "$HOME/.bun" ] && [ -f "$HOME/.bun/bin/bun" ]; then
        print_success "$name already installed"
        save_progress "tools" "$name" "completed"
        return 0
    fi
    
    if [ "$name" = "pnpm" ] && command_exists pnpm; then
        print_success "$name already installed"
        save_progress "tools" "$name" "completed"
        return 0
    fi
    
    if [ "$name" = "turso" ] && command_exists turso; then
        print_success "$name already installed"
        save_progress "tools" "$name" "completed"
        return 0
    fi
    
    if [ "$name" = "uvx" ] && command_exists uv; then
        print_success "$name already installed (uv available)"
        save_progress "tools" "$name" "completed"
        return 0
    fi
    
    if [ "$name" = "nvm" ] && [ -d "$HOME/.nvm" ]; then
        print_success "$name already installed"
        save_progress "tools" "$name" "completed"
        return 0
    fi
    
    if [ "$name" = "vercel" ] && command_exists vercel; then
        print_success "$name already installed"
        save_progress "tools" "$name" "completed"
        return 0
    fi
    
    if [ "$name" = "netlify" ] && command_exists netlify; then
        print_success "$name already installed"
        save_progress "tools" "$name" "completed"
        return 0
    fi
    
    print_status "Installing $name..."
    
    # Different installers need different handling
    local install_cmd=""
    if [ "$name" = "starship" ]; then
        install_cmd="curl -fsSL \"$url\" | sh -s -- -y"
    elif [ "$name" = "pnpm" ]; then
        install_cmd="curl -fsSL \"$url\" | sh -"
    elif [ "$name" = "turso" ]; then
        install_cmd="curl -sSfL \"$url\" | bash"
    elif [ "$name" = "uvx" ]; then
        install_cmd="curl -LsSf https://astral.sh/uv/install.sh | sh"
    elif [ "$name" = "vercel" ]; then
        install_cmd="curl -fsSL \"$url\" | sh"
    elif [ "$name" = "netlify" ]; then
        install_cmd="curl -fsSL \"$url\" | sh"
    elif [ "$name" = "nvm" ]; then
        install_cmd="curl -o- \"$url\" | bash"
    else
        install_cmd="curl -fsSL \"$url\" | bash"
    fi
    
    if eval "$install_cmd" >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "tools" "$name" "completed"
        
        # Add to PATH if needed
        if [ "$name" = "bun" ]; then
            export BUN_INSTALL="$HOME/.bun"
            export PATH="$BUN_INSTALL/bin:$PATH"
            if [ -f "$HOME/.bashrc" ] && ! grep -q "BUN_INSTALL" "$HOME/.bashrc"; then
                echo "" >> "$HOME/.bashrc"
                echo "# Bun" >> "$HOME/.bashrc"
                echo "export BUN_INSTALL=\"\$HOME/.bun\"" >> "$HOME/.bashrc"
                echo "export PATH=\"\$BUN_INSTALL/bin:\$PATH\"" >> "$HOME/.bashrc"
            fi
        fi
        
        if [ "$name" = "pnpm" ]; then
            export PNPM_HOME="$HOME/.local/share/pnpm"
            export PATH="$PNPM_HOME:$PATH"
            if [ -f "$HOME/.bashrc" ] && ! grep -q "PNPM_HOME" "$HOME/.bashrc"; then
                echo "" >> "$HOME/.bashrc"
                echo "# pnpm" >> "$HOME/.bashrc"
                echo "export PNPM_HOME=\"\$HOME/.local/share/pnpm\"" >> "$HOME/.bashrc"
                echo "export PATH=\"\$PNPM_HOME:\$PATH\"" >> "$HOME/.bashrc"
            fi
        fi
        
        if [ "$name" = "turso" ]; then
            export TURSO_INSTALL="$HOME/.turso"
            export PATH="$TURSO_INSTALL:$PATH"
            if [ -f "$HOME/.bashrc" ] && ! grep -q "TURSO_INSTALL" "$HOME/.bashrc"; then
                echo "" >> "$HOME/.bashrc"
                echo "# Turso CLI" >> "$HOME/.bashrc"
                echo "export TURSO_INSTALL=\"\$HOME/.turso\"" >> "$HOME/.bashrc"
                echo "export PATH=\"\$TURSO_INSTALL:\$PATH\"" >> "$HOME/.bashrc"
            fi
        fi
        
        if [ "$name" = "uvx" ]; then
            export PATH="$HOME/.cargo/bin:$PATH"
            if [ -f "$HOME/.bashrc" ] && ! grep -q "\.cargo/bin" "$HOME/.bashrc"; then
                echo "" >> "$HOME/.bashrc"
                echo "# uv (includes uvx)" >> "$HOME/.bashrc"
                echo "export PATH=\"\$HOME/.cargo/bin:\$PATH\"" >> "$HOME/.bashrc"
            fi
        fi
        
        if [ "$name" = "nvm" ]; then
            export NVM_DIR="$HOME/.nvm"
            if [ -f "$HOME/.bashrc" ] && ! grep -q "NVM_DIR" "$HOME/.bashrc"; then
                echo "" >> "$HOME/.bashrc"
                echo "# NVM" >> "$HOME/.bashrc"
                echo "export NVM_DIR=\"\$HOME/.nvm\"" >> "$HOME/.bashrc"
                echo "[ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"" >> "$HOME/.bashrc"
                echo "[ -s \"\$NVM_DIR/bash_completion\" ] && \. \"\$NVM_DIR/bash_completion\"" >> "$HOME/.bashrc"
            fi
        fi
        
        if [ "$name" = "vercel" ] || [ "$name" = "netlify" ]; then
            # These typically install to ~/.local/bin or similar
            if [ -f "$HOME/.bashrc" ] && ! grep -q "\.local/bin" "$HOME/.bashrc"; then
                echo "" >> "$HOME/.bashrc"
                echo "# Local bin (for vercel, netlify, etc.)" >> "$HOME/.bashrc"
                echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$HOME/.bashrc"
            fi
        fi
        
        return 0
    else
        print_error "Failed to install $name"
        save_progress "tools" "$name" "failed"
        return 1
    fi
}

# Install via cargo
install_cargo() {
    local package="$1"
    local name="${2:-$package}"
    
    if is_completed "cargo" "$package"; then
        print_success "$name already installed (skipped)"
        return 0
    fi
    
    if ! command_exists cargo; then
        print_warning "Cargo not found. Install Rust first."
        return 1
    fi
    
    print_status "Installing $name via cargo..."
    if cargo install "$package" >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "cargo" "$package" "completed"
        return 0
    else
        print_error "Failed to install $name"
        save_progress "cargo" "$package" "failed"
        return 1
    fi
}

# Install via npm
install_npm() {
    local package="$1"
    local name="${2:-$package}"
    local global="${3:-true}"
    
    if is_completed "npm" "$package"; then
        print_success "$name already installed (skipped)"
        return 0
    fi
    
    if ! command_exists npm; then
        print_warning "npm not found. Install Node.js first."
        return 1
    fi
    
    print_status "Installing $name via npm..."
    local cmd="npm install"
    [ "$global" = "true" ] && cmd="npm install -g"
    
    if $cmd "$package" >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "npm" "$package" "completed"
        return 0
    else
        print_error "Failed to install $name"
        save_progress "npm" "$package" "failed"
        return 1
    fi
}

# Install npm CLI tool
install_npm_tool() {
    local package="$1"
    local name="${2:-$package}"
    
    if is_completed "tools" "$name"; then
        print_success "$name already installed (skipped)"
        return 0
    fi
    
    if command_exists "$name" || command_exists "$package"; then
        print_success "$name already installed"
        save_progress "tools" "$name" "completed"
        return 0
    fi
    
    if ! command_exists npm && ! command_exists pnpm; then
        print_warning "npm or pnpm not found. Please install Node.js first."
        return 1
    fi
    
    print_status "Installing $name via npm/pnpm..."
    
    local install_cmd=""
    if command_exists pnpm; then
        install_cmd="pnpm add -g $package"
    else
        install_cmd="npm install -g $package"
    fi
    
    if eval "$install_cmd" >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "tools" "$name" "completed"
        return 0
    else
        print_error "Failed to install $name"
        save_progress "tools" "$name" "failed"
        return 1
    fi
}

# Install OpenRGB
install_openrgb() {
    local name="${1:-OpenRGB}"
    
    if is_completed "packages" "openrgb"; then
        print_success "$name already installed (skipped)"
        return 0
    fi
    
    if command_exists openrgb; then
        print_success "$name already installed"
        save_progress "packages" "openrgb" "completed"
        return 0
    fi
    
    print_status "Installing $name..."
    
    # Try apt first
    if sudo apt-get install -y openrgb >/dev/null 2>&1; then
        print_success "$name installed successfully via apt"
        save_progress "packages" "openrgb" "completed"
        return 0
    fi
    
    # Try adding PPA if apt install fails
    print_status "Adding OpenRGB PPA..."
    if sudo add-apt-repository -y ppa:thopiekar/openrgb >/dev/null 2>&1; then
        sudo apt update >/dev/null 2>&1
        if sudo apt-get install -y openrgb >/dev/null 2>&1; then
            print_success "$name installed successfully via PPA"
            save_progress "packages" "openrgb" "completed"
            return 0
        fi
    fi
    
    print_error "Failed to install $name"
    print_info "You can try installing manually: sudo add-apt-repository ppa:thopiekar/openrgb && sudo apt update && sudo apt install openrgb"
    save_progress "packages" "openrgb" "failed"
    return 1
}

# Install NVIDIA tools
install_nvidia_tools() {
    local package="$1"
    local name="${2:-$package}"
    
    if is_completed "packages" "$package"; then
        print_success "$name already installed (skipped)"
        return 0
    fi
    
    if dpkg -l | grep -q "^ii.*$package "; then
        print_success "$name already installed"
        save_progress "packages" "$package" "completed"
        return 0
    fi
    
    print_status "Installing $name..."
    
    # Check if NVIDIA GPU is present
    if ! lspci | grep -i nvidia >/dev/null 2>&1; then
        print_warning "No NVIDIA GPU detected. Skipping $name installation."
        return 1
    fi
    
    if sudo apt-get install -y "$package" >/dev/null 2>&1; then
        print_success "$name installed successfully"
        save_progress "packages" "$package" "completed"
        
        # For nvidia-settings, provide helpful info
        if [ "$package" = "nvidia-settings" ]; then
            print_info "NVIDIA Settings installed. You can configure fan curves with: nvidia-settings"
            print_info "For automatic fan control, consider installing: nvidia-ml-py3 (Python package)"
        fi
        
        return 0
    else
        print_error "Failed to install $name"
        save_progress "packages" "$package" "failed"
        return 1
    fi
}

# Select snap packages
select_snap_packages() {
    local category="$1"
    local title="$2"
    local -n packages="$3"
    
    print_header "$title"
    
    local selected=()
    local index=1
    
    for package in "${packages[@]}"; do
        local name="${package%%:*}"
        local display="${package##*:}"
        
        local installed=""
        if snap list "$name" >/dev/null 2>&1; then
            installed=" [INSTALLED]"
        fi
        
        echo -e "  ${CYAN}[$index]${NC} $display$installed"
        ((index++))
    done
    
    echo -e "  ${CYAN}[a]${NC} Select all"
    echo -e "  ${CYAN}[s]${NC} Skip this category"
    echo ""
    
    read -p "Select packages (comma-separated numbers, 'a' for all, 's' to skip): " selection
    
    if [ "$selection" = "s" ] || [ -z "$selection" ]; then
        return 1
    fi
    
    if [ "$selection" = "a" ]; then
        selected=("${packages[@]}")
    else
        IFS=',' read -ra indices <<< "$selection"
        for idx in "${indices[@]}"; do
            idx=$(echo "$idx" | xargs)
            if [[ "$idx" =~ ^[0-9]+$ ]] && [ "$idx" -ge 1 ] && [ "$idx" -le "${#packages[@]}" ]; then
                selected+=("${packages[$((idx-1))]}")
            fi
        done
    fi
    
    local failed=0
    for package in "${selected[@]}"; do
        local name="${package%%:*}"
        local display="${package##*:}"
        
        if ! install_snap "$name" "$display"; then
            ((failed++))
        fi
    done
    
    return $failed
}

# ============================================================================
# PACKAGE DEFINITIONS - Organized by category
# ============================================================================

# Essential system packages
declare -a ESSENTIAL_PACKAGES=(
    "git"
    "curl"
    "wget"
    "build-essential"
    "ca-certificates"
    "gnupg"
    "software-properties-common"
    "fish"
)

# Development tools
declare -a DEV_TOOLS=(
    "python3"
    "python3-pip"
    "python3-venv"
    "nodejs"
    "npm"
    "neovim"
)

# Android Development (optional)
declare -a ANDROID_TOOLS=(
    "android-studio:Android Studio"
)

# Modern CLI utilities
declare -a CLI_UTILITIES=(
    "ripgrep:ripgrep"
    "fd-find:fd"
    "fzf:fzf"
    "zoxide:zoxide"
    "eza:eza"
    "bat:bat"
    "htop:htop"
    "tree:tree"
    "jq:jq"
    "unzip:unzip"
    "zip:zip"
    "xclip:xclip"
    "wl-clipboard:wl-clipboard"
    "wget:wget"
    "bc:bc"
    "libnotify-bin:libnotify-bin"
)

# Automation & Testing tools
declare -a AUTOMATION_TOOLS=(
    "xdotool:xdotool"
    "ydotool:ydotool"
)

# Media playback (for alarm script)
declare -a MEDIA_PLAYBACK=(
    "mpv:mpv"
    "pulseaudio-utils:pulseaudio-utils"
)

# GNOME specific tools
declare -a GNOME_TOOLS=(
    "gnome-shell-extensions:gnome-shell-extensions"
    "dconf-cli:dconf-cli"
)

# Communication & Social
declare -a COMMUNICATION_APPS=(
    "discord:Discord"
    "slack:Slack"
    "telegram-desktop:Telegram"
)

# Development editors & IDEs (moved to snap packages)
# declare -a EDITORS=(
#     "code:Visual Studio Code"
#     "cursor:Cursor Editor"
# )

# Media & Graphics
declare -a MEDIA_APPS=(
    "gimp:GIMP"
    "inkscape:Inkscape"
    "vlc:VLC Media Player"
    "obs-studio:OBS Studio"
)

# Browsers
declare -a BROWSERS=(
    "firefox:Firefox"
    "google-chrome-stable:Google Chrome"
    "brave-browser:Brave Browser"
)

# Container & DevOps
declare -a DEVOPS_TOOLS=(
    "docker.io:Docker"
    "docker-compose:Docker Compose"
    "kubectl:kubectl"
)

# System utilities
declare -a SYSTEM_UTILS=(
    "htop:htop"
    "btop:btop"
    "neofetch:neofetch"
    "timeshift:Timeshift"
)

# Hardware & GPU tools
declare -a HARDWARE_TOOLS=(
    "openrgb:OpenRGB"
    "nvidia-settings:NVIDIA Settings"
    "nvidia-utils:NVIDIA Utils"
)

# Tools installed via snap
declare -a SNAP_PACKAGES=(
    "whatsapp-for-linux:WhatsApp"
    "spotify:Spotify"
    "obsidian:Obsidian"
    "signal-desktop:Signal"
    "code:Visual Studio Code"
    "cursor:Cursor Editor"
)

# Tools installed via curl scripts
declare -a CURL_TOOLS=(
    "bun:https://bun.sh/install:bun"
    "starship:https://starship.rs/install.sh:starship"
    "nvm:https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh:nvm"
    "pnpm:https://get.pnpm.io/install.sh:pnpm"
    "turso:https://get.tur.so/install.sh:turso"
    "uvx:https://astral.sh/uv/install.sh:uvx"
    "vercel:https://vercel.com/cli.sh:vercel"
    "netlify:https://cli.netlify.com/install.sh:netlify"
)

# CLI tools installed via npm/pnpm (after node is installed)
declare -a NPM_CLI_TOOLS=(
    "gemini-cli:gemini-cli"
)

# Config-based applications
# Maps config directory names to their package names and symlink targets
declare -A CONFIG_APPS=(
    ["nvim"]="neovim:~/.config/nvim"
    ["wezterm"]="wezterm:~/.config/wezterm"
    ["kitty"]="kitty:~/.config/kitty"
    ["hyprland"]="hyprland:~/.config/hypr"
    ["waybar"]="waybar:~/.config/waybar"
)

# Special cases for configs that need different handling
declare -A CONFIG_SPECIAL=(
    ["wezterm"]="configs/wezterm/.config/wezterm:~/.config/wezterm"
)

# ============================================================================
# INTERACTIVE SELECTION FUNCTIONS
# ============================================================================

# Show menu and get selections
select_packages() {
    local category="$1"
    local title="$2"
    local -n packages="$3"
    
    print_header "$title"
    
    local selected=()
    local index=1
    
    # Display packages
    for package in "${packages[@]}"; do
        local name="${package%%:*}"
        local display="${package##*:}"
        
        # Check if already installed
        local installed=""
        if command_exists "$name" || dpkg -l | grep -q "^ii.*$name "; then
            installed=" [INSTALLED]"
        fi
        
        echo -e "  ${CYAN}[$index]${NC} $display$installed"
        ((index++))
    done
    
    echo -e "  ${CYAN}[a]${NC} Select all"
    echo -e "  ${CYAN}[s]${NC} Skip this category"
    echo ""
    
    read -p "Select packages (comma-separated numbers, 'a' for all, 's' to skip): " selection
    
    if [ "$selection" = "s" ] || [ -z "$selection" ]; then
        return 1
    fi
    
    if [ "$selection" = "a" ]; then
        selected=("${packages[@]}")
    else
        IFS=',' read -ra indices <<< "$selection"
        for idx in "${indices[@]}"; do
            idx=$(echo "$idx" | xargs) # trim whitespace
            if [[ "$idx" =~ ^[0-9]+$ ]] && [ "$idx" -ge 1 ] && [ "$idx" -le "${#packages[@]}" ]; then
                selected+=("${packages[$((idx-1))]}")
            fi
        done
    fi
    
    # Install selected packages
    local failed=0
    for package in "${selected[@]}"; do
        local name="${package%%:*}"
        local display="${package##*:}"
        
        if ! install_package "$name" "$display"; then
            ((failed++))
        fi
    done
    
    if [ $failed -gt 0 ]; then
        print_warning "$failed package(s) failed to install"
        return 1
    fi
    
    return 0
}

# Install tool via curl script
select_curl_tools() {
    local category="$1"
    local title="$2"
    local -n tools="$3"
    
    print_header "$title"
    
    local selected=()
    local index=1
    
    for tool in "${tools[@]}"; do
        IFS=':' read -ra parts <<< "$tool"
        local name="${parts[0]}"
        local url="${parts[1]}"
        local display="${parts[2]:-$name}"
        
        local installed=""
        if command_exists "$name"; then
            installed=" [INSTALLED]"
        fi
        
        echo -e "  ${CYAN}[$index]${NC} $display$installed"
        ((index++))
    done
    
    echo -e "  ${CYAN}[a]${NC} Select all"
    echo -e "  ${CYAN}[s]${NC} Skip this category"
    echo ""
    
    read -p "Select tools (comma-separated numbers, 'a' for all, 's' to skip): " selection
    
    if [ "$selection" = "s" ] || [ -z "$selection" ]; then
        return 1
    fi
    
    if [ "$selection" = "a" ]; then
        selected=("${tools[@]}")
    else
        IFS=',' read -ra indices <<< "$selection"
        for idx in "${indices[@]}"; do
            idx=$(echo "$idx" | xargs)
            if [[ "$idx" =~ ^[0-9]+$ ]] && [ "$idx" -ge 1 ] && [ "$idx" -le "${#tools[@]}" ]; then
                selected+=("${tools[$((idx-1))]}")
            fi
        done
    fi
    
    local failed=0
    for tool in "${selected[@]}"; do
        IFS=':' read -ra parts <<< "$tool"
        local name="${parts[0]}"
        local url="${parts[1]}"
        local display="${parts[2]:-$name}"
        
        if ! install_curl_script "$url" "$name"; then
            ((failed++))
        fi
    done
    
    return $failed
}

# Install npm CLI tools
select_npm_tools() {
    local category="$1"
    local title="$2"
    local -n tools="$3"
    
    # Check if Node.js is installed
    if ! command_exists npm && ! command_exists pnpm; then
        print_warning "npm or pnpm not found. Skipping npm CLI tools installation."
        print_info "Please install Node.js first (it's in Development Tools)"
        return 1
    fi
    
    print_header "$title"
    
    local selected=()
    local index=1
    
    for tool in "${tools[@]}"; do
        IFS=':' read -ra parts <<< "$tool"
        local package="${parts[0]}"
        local name="${parts[1]:-$package}"
        
        local installed=""
        if command_exists "$package" || command_exists "$name"; then
            installed=" [INSTALLED]"
        fi
        
        echo -e "  ${CYAN}[$index]${NC} $name$installed"
        ((index++))
    done
    
    echo -e "  ${CYAN}[a]${NC} Select all"
    echo -e "  ${CYAN}[s]${NC} Skip this category"
    echo ""
    
    read -p "Select tools (comma-separated numbers, 'a' for all, 's' to skip): " selection
    
    if [ "$selection" = "s" ] || [ -z "$selection" ]; then
        return 1
    fi
    
    if [ "$selection" = "a" ]; then
        selected=("${tools[@]}")
    else
        IFS=',' read -ra indices <<< "$selection"
        for idx in "${indices[@]}"; do
            idx=$(echo "$idx" | xargs)
            if [[ "$idx" =~ ^[0-9]+$ ]] && [ "$idx" -ge 1 ] && [ "$idx" -le "${#tools[@]}" ]; then
                selected+=("${tools[$((idx-1))]}")
            fi
        done
    fi
    
    local failed=0
    for tool in "${selected[@]}"; do
        IFS=':' read -ra parts <<< "$tool"
        local package="${parts[0]}"
        local name="${parts[1]:-$package}"
        
        if ! install_npm_tool "$package" "$name"; then
            ((failed++))
        fi
    done
    
    return $failed
}

# ============================================================================
# MAIN SETUP FUNCTIONS
# ============================================================================

update_system() {
    print_header "System Update"
    print_status "Updating package lists..."
    sudo apt update
    print_status "Upgrading system packages..."
    sudo apt upgrade -y
    print_success "System updated"
}

setup_dotfiles() {
    print_header "Dotfiles Setup"
    
    if [ ! -d "$DOTFILES_DIR" ]; then
        print_warning "Dotfiles directory not found at $DOTFILES_DIR"
        read -p "Enter dotfiles directory path (or press Enter to skip): " custom_dir
        if [ -n "$custom_dir" ]; then
            DOTFILES_DIR="$custom_dir"
        else
            print_warning "Skipping dotfiles setup"
            return 1
        fi
    fi
    
    # Create fish config symlink (cfg is the entry point)
    if [ -f "$DOTFILES_DIR/cfg" ]; then
        print_status "Creating fish config symlink..."
        mkdir -p "$HOME/.config/fish"
        
        local fish_config="$HOME/.config/fish/config.fish"
        local already_linked=false
        
        # Check if already correctly symlinked
        if [ -L "$fish_config" ]; then
            local target=$(readlink "$fish_config")
            if [ "$target" = "$DOTFILES_DIR/cfg" ] || [ "$target" = "../dotfiles/cfg" ] || [ "$target" = "~/.config/dotfiles/cfg" ]; then
                already_linked=true
                print_success "✓ Fish config already correctly symlinked"
                print_info "  cfg → ~/.config/fish/config.fish (entry point)"
            fi
        fi
        
        if [ "$already_linked" = false ]; then
            # Backup existing config if it exists
            if [ -e "$fish_config" ] && [ ! -L "$fish_config" ]; then
                print_warning "Backing up existing fish config..."
                mv "$fish_config" "${fish_config}.bak.$(date +%s)" 2>/dev/null || true
            fi
            
            # Create symlink
            if ln -sf "$DOTFILES_DIR/cfg" "$fish_config" 2>/dev/null; then
                print_success "✓ Created fish config symlink: $fish_config → cfg"
                print_info "  cfg is the entry point that sources configs/fish/aliases/*.fish"
                print_info "  Fish shell configuration initialized!"
            else
                print_error "Failed to create fish config symlink"
            fi
        fi
    else
        print_warning "cfg file not found at $DOTFILES_DIR/cfg"
    fi
    
    # Create symlinks for fish functions (to standard fish location)
    if [ -d "$DOTFILES_DIR/configs/fish/functions" ]; then
        print_status "Creating fish functions symlinks..."
        mkdir -p "$HOME/.config/fish/functions"
        
        local function_count=0
        for func_file in "$DOTFILES_DIR/configs/fish/functions"/*.fish; do
            if [ -f "$func_file" ]; then
                local func_name=$(basename "$func_file")
                local fish_func_target="$HOME/.config/fish/functions/$func_name"
                
                # Check if already correctly symlinked
                if [ -L "$fish_func_target" ]; then
                    local target=$(readlink "$fish_func_target")
                    if [ "$target" = "$func_file" ] || [ "$target" = "../../configs/fish/functions/$func_name" ]; then
                        continue
                    fi
                fi
                
                # Backup existing function if it exists
                if [ -e "$fish_func_target" ] && [ ! -L "$fish_func_target" ]; then
                    mv "$fish_func_target" "${fish_func_target}.bak.$(date +%s)" 2>/dev/null || true
                fi
                
                # Create symlink
                if ln -sf "$func_file" "$fish_func_target" 2>/dev/null; then
                    ((function_count++))
                fi
            fi
        done
        
        if [ $function_count -gt 0 ]; then
            print_success "✓ Created $function_count fish function symlinks"
            print_info "  configs/fish/functions/*.fish → ~/.config/fish/functions/*.fish"
        else
            print_info "All fish functions already symlinked"
        fi
    fi
    
    # Create symlinks for all scripts in scripts/ directory
    print_status "Creating symlinks from scripts/ to bin/..."
    if [ -d "$DOTFILES_DIR/scripts" ]; then
        local symlink_count=0
        for script in "$DOTFILES_DIR/scripts"/*; do
            if [ -f "$script" ] && [ ! -d "$script" ]; then
                local script_name=$(basename "$script")
                # Skip documentation and config files
                if [[ "$script_name" == *.md ]] || [[ "$script_name" == *.txt ]] || \
                   [[ "$script_name" == *.json ]] || [[ "$script_name" == *.lock ]] || \
                   [[ "$script_name" == *.pyc ]] || [[ "$script_name" == "__pycache__" ]]; then
                    continue
                fi
                
                local bin_target="$DOTFILES_DIR/bin/$script_name"
                
                # Skip if already a correct symlink
                if [ -L "$bin_target" ]; then
                    local target=$(readlink "$bin_target")
                    if [ "$target" = "../scripts/$script_name" ] || [ "$target" = "$script" ]; then
                        continue
                    fi
                fi
                
                # Create symlink
                if [ -e "$bin_target" ] && [ ! -L "$bin_target" ]; then
                    print_warning "Backing up existing $script_name"
                    mv "$bin_target" "${bin_target}.backup.$(date +%s)" 2>/dev/null || true
                fi
                
                if ln -sf "../scripts/$script_name" "$bin_target" 2>/dev/null; then
                    ((symlink_count++))
                fi
            fi
        done
        if [ $symlink_count -gt 0 ]; then
            print_success "Created $symlink_count symlinks from scripts/ to bin/"
        else
            print_info "All scripts already symlinked"
        fi
    fi
    
    # Add to PATH
    if [ -d "$DOTFILES_DIR/bin" ]; then
        if [ -f "$HOME/.bashrc" ] && ! grep -q "dotfiles/bin" "$HOME/.bashrc"; then
            echo "" >> "$HOME/.bashrc"
            echo "# Dotfiles bin directory" >> "$HOME/.bashrc"
            echo "export PATH=\"\$HOME/.config/dotfiles/bin:\$PATH\"" >> "$HOME/.bashrc"
            print_success "Added dotfiles/bin to .bashrc"
        fi
        
        find "$DOTFILES_DIR/bin" -type f -exec chmod +x {} \; 2>/dev/null || true
    fi
    
    if [ -d "$DOTFILES_DIR/scripts" ]; then
        if [ -f "$HOME/.bashrc" ] && ! grep -q "dotfiles/scripts" "$HOME/.bashrc"; then
            echo "export PATH=\"\$HOME/.config/dotfiles/scripts:\$PATH\"" >> "$HOME/.bashrc"
        fi
        
        find "$DOTFILES_DIR/scripts" -type f \( -name "*.sh" -o -name "*.py" -o -name "*.ts" -o -name "*.fish" -o -name "*.js" \) -exec chmod +x {} \; 2>/dev/null || true
    fi
    
    # Create dotfiles CLI config
    if [ ! -f "$DOTFILES_DIR/.dotfiles-cli.json" ]; then
        print_status "Creating dotfiles CLI config..."
        cat > "$DOTFILES_DIR/.dotfiles-cli.json" << 'EOF'
{
  "layout": "categories",
  "banner": "modern",
  "includeAliases": true,
  "includeFunctions": true,
  "groupAliases": true,
  "preferBinOverScripts": true,
  "fzfHeight": "90%",
  "showDescriptions": true,
  "enableCategories": true,
  "recentItems": []
}
EOF
        print_success "Created dotfiles CLI config"
    fi
    
    # Create git config symlink
    if [ -f "$DOTFILES_DIR/configs/git/.gitconfig" ]; then
        print_status "Creating git config symlink..."
        local git_config="$HOME/.gitconfig"
        
        if [ -L "$git_config" ]; then
            local target=$(readlink "$git_config")
            if [ "$target" = "$DOTFILES_DIR/configs/git/.gitconfig" ] || [ "$target" = "../dotfiles/configs/git/.gitconfig" ]; then
                print_success "✓ Git config already correctly symlinked"
            else
                print_warning "Backing up existing git config..."
                mv "$git_config" "${git_config}.bak.$(date +%s)" 2>/dev/null || true
                ln -sf "$DOTFILES_DIR/configs/git/.gitconfig" "$git_config"
                print_success "✓ Created git config symlink: $git_config → configs/git/.gitconfig"
            fi
        elif [ -e "$git_config" ]; then
            print_warning "Backing up existing git config..."
            mv "$git_config" "${git_config}.bak.$(date +%s)" 2>/dev/null || true
            ln -sf "$DOTFILES_DIR/configs/git/.gitconfig" "$git_config"
            print_success "✓ Created git config symlink: $git_config → configs/git/.gitconfig"
        else
            ln -sf "$DOTFILES_DIR/configs/git/.gitconfig" "$git_config"
            print_success "✓ Created git config symlink: $git_config → configs/git/.gitconfig"
        fi
    fi
    
    # Create Cursor config symlinks (settings.json and keybindings.json)
    if [ -d "$DOTFILES_DIR/configs/cursor" ]; then
        print_status "Creating Cursor config symlinks..."
        mkdir -p "$HOME/.config/Cursor/User"
        
        for config_file in settings.json keybindings.json; do
            if [ -f "$DOTFILES_DIR/configs/cursor/$config_file" ]; then
                local cursor_config="$HOME/.config/Cursor/User/$config_file"
                
                if [ -L "$cursor_config" ]; then
                    local target=$(readlink "$cursor_config")
                    if [ "$target" = "$DOTFILES_DIR/configs/cursor/$config_file" ] || [ "$target" = "../../dotfiles/configs/cursor/$config_file" ]; then
                        continue
                    fi
                fi
                
                if [ -e "$cursor_config" ] && [ ! -L "$cursor_config" ]; then
                    print_warning "Backing up existing Cursor $config_file..."
                    mv "$cursor_config" "${cursor_config}.bak.$(date +%s)" 2>/dev/null || true
                fi
                
                if ln -sf "$DOTFILES_DIR/configs/cursor/$config_file" "$cursor_config" 2>/dev/null; then
                    print_success "✓ Created Cursor $config_file symlink"
                fi
            fi
        done
    fi
    
    # Initialize git submodules (e.g., env-private)
    if [ -f "$DOTFILES_DIR/.gitmodules" ]; then
        print_status "Initializing git submodules..."
        (cd "$DOTFILES_DIR" && git submodule update --init --recursive >/dev/null 2>&1)
        if [ $? -eq 0 ]; then
            print_success "Git submodules initialized"
        else
            print_warning "Failed to initialize git submodules. Please check .gitmodules."
        fi
    fi
    
    # Create common directories
    print_status "Creating common directories..."
    local dirs=(
        "$HOME/programs"
        "$HOME/tmp"
        "$HOME/sandbox"
        "$HOME/dev"
        "$HOME/Audio"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            if mkdir -p "$dir" 2>/dev/null; then
                print_success "✓ Created directory: $dir"
            else
                print_error "Failed to create directory: $dir"
            fi
        else
            print_info "Directory already exists: $dir"
        fi
    done
    
    # Download alarm sound if Audio directory exists and sound doesn't exist
    if [ -d "$HOME/Audio" ] && [ ! -f "$HOME/Audio/alarm.mp3" ]; then
        print_status "Downloading alarm sound..."
        if command_exists curl; then
            if curl -L -f -s -o "$HOME/Audio/alarm.mp3" "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" >/dev/null 2>&1; then
                print_success "✓ Downloaded alarm sound to ~/Audio/alarm.mp3"
            else
                print_warning "Failed to download alarm sound. You can manually add ~/Audio/alarm.mp3"
            fi
        else
            print_warning "curl not found, skipping alarm sound download"
        fi
    fi
}

setup_config_apps() {
    print_header "Configuration-Based Applications"
    print_info "Detecting applications with configs in configs/ directory..."
    echo ""
    
    if [ ! -d "$DOTFILES_DIR/configs" ]; then
        print_warning "configs/ directory not found"
        return 1
    fi
    
    local config_dirs=()
    for dir in "$DOTFILES_DIR/configs"/*; do
        if [ -d "$dir" ]; then
            local dir_name=$(basename "$dir")
            # Skip fish and gnome (handled separately)
            if [ "$dir_name" != "fish" ] && [ "$dir_name" != "gnome" ]; then
                config_dirs+=("$dir_name")
            fi
        fi
    done
    
    if [ ${#config_dirs[@]} -eq 0 ]; then
        print_info "No config directories found (excluding fish/gnome)"
        return 0
    fi
    
    print_info "Found config directories: ${config_dirs[*]}"
    echo ""
    
    local selected_apps=()
    local index=1
    
    # Show available config apps
    for app in "${config_dirs[@]}"; do
        local package_info="${CONFIG_APPS[$app]:-}"
        local app_name="${app}"
        local installed=""
        
        if [ -n "$package_info" ]; then
            local package="${package_info%%:*}"
            if command_exists "$package" || command_exists "$app" || dpkg -l | grep -q "^ii.*$package "; then
                installed=" [INSTALLED]"
            fi
        fi
        
        echo -e "  ${CYAN}[$index]${NC} $app_name$installed"
        ((index++))
    done
    
    echo -e "  ${CYAN}[a]${NC} Select all"
    echo -e "  ${CYAN}[s]${NC} Skip this section"
    echo ""
    
    read -p "Select apps to install and configure (comma-separated numbers, 'a' for all, 's' to skip): " selection
    
    if [ "$selection" = "s" ] || [ -z "$selection" ]; then
        return 1
    fi
    
    if [ "$selection" = "a" ]; then
        selected_apps=("${config_dirs[@]}")
    else
        IFS=',' read -ra indices <<< "$selection"
        for idx in "${indices[@]}"; do
            idx=$(echo "$idx" | xargs)
            if [[ "$idx" =~ ^[0-9]+$ ]] && [ "$idx" -ge 1 ] && [ "$idx" -le "${#config_dirs[@]}" ]; then
                selected_apps+=("${config_dirs[$((idx-1))]}")
            fi
        done
    fi
    
    # Install and configure selected apps
    local failed=0
    for app in "${selected_apps[@]}"; do
        local package_info="${CONFIG_APPS[$app]:-}"
        
        if [ -z "$package_info" ]; then
            print_warning "$app: No package mapping found, skipping installation"
            # Still try to create symlink if config exists
            create_config_symlink "$app" || ((failed++))
            continue
        fi
        
        local package="${package_info%%:*}"
        local symlink_target="${package_info##*:}"
        
        # Special handling for wezterm
        if [ "$app" = "wezterm" ]; then
            install_wezterm || print_warning "Failed to install wezterm, but will still try to create symlink"
        else
            # Install package
            print_status "Installing $package for $app..."
            if ! install_package "$package" "$app"; then
                print_warning "Failed to install $package, but will still try to create symlink"
            fi
        fi
        
        # Create symlink
        create_config_symlink "$app" || ((failed++))
    done
    
    return $failed
}

# Install wezterm (requires special handling)
install_wezterm() {
    if is_completed "config-apps" "wezterm"; then
        print_success "wezterm already installed (skipped)"
        return 0
    fi
    
    if command_exists wezterm; then
        print_success "wezterm already installed"
        save_progress "config-apps" "wezterm" "completed"
        return 0
    fi
    
    print_status "Installing wezterm..."
    
    # Wezterm installation via GitHub releases
    local temp_dir=$(mktemp -d)
    cd "$temp_dir" || return 1
    
    # Detect architecture
    local arch=""
    case "$(uname -m)" in
        x86_64) arch="x86_64" ;;
        aarch64|arm64) arch="aarch64" ;;
        *) print_error "Unsupported architecture for wezterm"; cd - >/dev/null; rm -rf "$temp_dir"; return 1 ;;
    esac
    
    # Get latest release URL
    local latest_url=$(curl -s https://api.github.com/repos/wez/wezterm/releases/latest | grep "browser_download_url.*Ubuntu${arch}.deb" | head -1 | cut -d'"' -f4)
    
    if [ -z "$latest_url" ]; then
        print_warning "Could not determine wezterm download URL"
        print_info "You can install manually from: https://wezfurlong.org/wezterm/install/linux.html"
        cd - >/dev/null
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Download and install
    if wget -q "$latest_url" -O wezterm.deb 2>/dev/null; then
        if sudo dpkg -i wezterm.deb >/dev/null 2>&1 || sudo apt-get install -f -y >/dev/null 2>&1; then
            print_success "wezterm installed successfully"
            save_progress "config-apps" "wezterm" "completed"
            cd - >/dev/null
            rm -rf "$temp_dir"
            return 0
        fi
    fi
    
    # Fallback: try using cargo if available
    if command_exists cargo; then
        print_info "Trying alternative installation via cargo..."
        if cargo install --locked wezterm >/dev/null 2>&1; then
            print_success "wezterm installed via cargo"
            save_progress "config-apps" "wezterm" "completed"
            cd - >/dev/null
            rm -rf "$temp_dir"
            return 0
        fi
    fi
    
    print_warning "Failed to install wezterm automatically"
    print_info "You can install manually from: https://wezfurlong.org/wezterm/install/linux.html"
    cd - >/dev/null
    rm -rf "$temp_dir"
    return 1
}

create_config_symlink() {
    local app="$1"
    local source_dir="$DOTFILES_DIR/configs/$app"
    local symlink_target=""
    
    # Check for special case mappings
    if [ -n "${CONFIG_SPECIAL[$app]:-}" ]; then
        local special_info="${CONFIG_SPECIAL[$app]}"
        source_dir="$DOTFILES_DIR/${special_info%%:*}"
        symlink_target="${special_info##*:}"
    elif [ -n "${CONFIG_APPS[$app]:-}" ]; then
        local package_info="${CONFIG_APPS[$app]}"
        symlink_target="${package_info##*:}"
    else
        # Default: try to infer from app name
        symlink_target="$HOME/.config/$app"
    fi
    
    if [ -z "$symlink_target" ]; then
        print_warning "Could not determine symlink target for $app"
        return 1
    fi
    
    if [ ! -d "$source_dir" ]; then
        print_warning "Source directory not found: $source_dir"
        return 1
    fi
    
    print_status "Creating symlink for $app config..."
    
    # Expand ~ in symlink_target
    symlink_target="${symlink_target/#\~/$HOME}"
    
    # Create parent directory if needed
    local parent_dir=$(dirname "$symlink_target")
    mkdir -p "$parent_dir"
    
    # Backup existing config if it exists
    if [ -e "$symlink_target" ] || [ -L "$symlink_target" ]; then
        if [ -L "$symlink_target" ]; then
            local current_target=$(readlink "$symlink_target")
            # Check if already pointing to correct location
            if [ "$current_target" = "$source_dir" ] || [ "$current_target" = "../configs/$app" ] || [ "$current_target" = "../../configs/$app/.config/wezterm" ]; then
                print_success "$app config already correctly symlinked"
                return 0
            fi
        fi
        print_warning "Backing up existing $app config..."
        mv "$symlink_target" "${symlink_target}.backup.$(date +%s)" 2>/dev/null || true
    fi
    
    # Create symlink
    if ln -sf "$source_dir" "$symlink_target"; then
        print_success "Created symlink: $symlink_target -> $source_dir"
        return 0
    else
        print_error "Failed to create symlink for $app"
        return 1
    fi
}

setup_gnome_aesthetics() {
    print_header "GNOME Aesthetic Setup"
    
    if [ ! -d "$DOTFILES_DIR/configs/gnome" ]; then
        print_info "GNOME configs directory not found, skipping"
        return 0
    fi
    
    print_info "This will set up a beautiful GNOME desktop with:"
    echo "  • Transparent and blurred panels"
    echo "  • Custom GTK theming"
    echo "  • Aesthetic lock screen"
    echo "  • Beautiful animations and effects"
    echo ""
    
    read -p "Set up GNOME aesthetics? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Skipping GNOME aesthetic setup"
        return 0
    fi
    
    # Ensure GNOME tools are installed
    if ! command_exists gnome-extensions; then
        print_status "Installing gnome-shell-extensions..."
        install_package "gnome-shell-extensions" "gnome-shell-extensions" || {
            print_warning "Failed to install gnome-shell-extensions"
            return 1
        }
    fi
    
    if ! command_exists gsettings; then
        print_status "Installing dconf-cli..."
        install_package "dconf-cli" "dconf-cli" || {
            print_warning "Failed to install dconf-cli"
            return 1
        }
    fi
    
    local setup_script="$DOTFILES_DIR/configs/gnome/setup-aesthetic-gnome.sh"
    
    if [ -f "$setup_script" ]; then
        print_status "Running GNOME aesthetic setup..."
        if bash "$setup_script"; then
            print_success "GNOME aesthetic setup completed!"
            print_info "You may need to log out and log back in for all changes to take effect"
        else
            print_warning "GNOME aesthetic setup encountered some issues"
        fi
    else
        print_warning "GNOME setup script not found at $setup_script"
    fi
}

setup_fish_shell() {
    print_header "Fish Shell Setup"
    
    if ! command_exists fish; then
        print_warning "Fish shell not installed"
        return 1
    fi
    
    read -p "Set fish as default shell? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        chsh -s /usr/bin/fish || print_warning "Failed to set fish as default (may require logout/login)"
        print_success "Fish set as default shell (restart terminal to apply)"
    fi
}

install_nerd_fonts() {
    print_header "Nerd Fonts Installation"
    print_info "Installing popular Nerd Fonts in the background..."
    print_info "This may take a few minutes (fonts are large downloads)"
    
    local fonts_dir="$HOME/.local/share/fonts"
    mkdir -p "$fonts_dir"
    
    # List of popular Nerd Fonts to install
    local fonts=(
        "FiraCode"
        "JetBrainsMono"
        "CaskaydiaCove"
        "Hack"
        "Iosevka"
        "Meslo"
        "SourceCodePro"
    )
    
    # Function to install a single font in background
    install_font_background() {
        local font_name="$1"
        local font_url="https://github.com/ryanoasis/nerd-fonts/releases/latest/download/${font_name}.zip"
        local temp_dir=$(mktemp -d)
        
        cd "$temp_dir" || return 1
        
        # Download font
        if wget -q "$font_url" -O "${font_name}.zip" 2>/dev/null; then
            # Extract fonts (unzip without progress, quiet mode)
            unzip -q -o "${font_name}.zip" -d "$fonts_dir" 2>/dev/null || true
            # Clean up extracted files, keep only .ttf files
            find "$fonts_dir" -name "*.otf" -delete 2>/dev/null || true
            cd - >/dev/null
            rm -rf "$temp_dir"
            return 0
        else
            cd - >/dev/null
            rm -rf "$temp_dir"
            return 1
        fi
    }
    
    # Install fonts in parallel (background jobs)
    local installed=0
    local failed=0
    
    for font in "${fonts[@]}"; do
        # Check if font already installed
        if find "$fonts_dir" -name "*${font}*" -type f | grep -q "${font}"; then
            print_success "$font Nerd Font already installed (skipped)"
            continue
        fi
        
        print_status "Installing $font Nerd Font..."
        # Run in background without throttling
        install_font_background "$font" &
    done
    
    # Wait for all background jobs to complete
    wait
    
    # Refresh font cache
    print_status "Refreshing font cache..."
    fc-cache -f "$fonts_dir" >/dev/null 2>&1 || true
    
    # Count installed fonts
    local font_count=$(find "$fonts_dir" -name "*Nerd*" -type f 2>/dev/null | wc -l)
    
    if [ "$font_count" -gt 0 ]; then
        print_success "✓ Nerd Fonts installation completed!"
        print_info "  Installed $font_count font files"
        print_info "  Fonts available: JetBrains Mono, Fira Code, Caskaydia Cove, Hack, and more"
        print_info "  Use fc-list | grep -i nerd to see all installed Nerd Fonts"
    else
        print_warning "No Nerd Fonts were installed. Check your internet connection."
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    # Parse command line arguments
    parse_args "$@"
    
    clear
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BOLD}${YELLOW}"
        echo "╔════════════════════════════════════════════════════════════╗"
        echo "║     DRY RUN MODE - No changes will be made               ║"
        if [ -n "$DRY_RUN_SECTION" ]; then
            echo "║     Section: $DRY_RUN_SECTION"
        fi
        echo "╚════════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
        echo ""
    else
        echo -e "${BOLD}${MAGENTA}"
        echo "╔════════════════════════════════════════════════════════════╗"
        echo "║     Interactive Dotfiles Setup for Ubuntu/Debian         ║"
        echo "╚════════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
    fi
    
    # Check if running on Ubuntu/Debian
    if ! command_exists apt-get; then
        print_error "This script is designed for Ubuntu/Debian systems"
        exit 1
    fi
    
    # Check for sudo
    if ! command_exists sudo; then
        print_error "sudo is required but not installed"
        exit 1
    fi
    
    # Check for resume
    if [ -f "$PROGRESS_FILE" ]; then
        print_info "Previous progress found: $PROGRESS_FILE"
        read -p "Resume previous installation? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            rm -f "$PROGRESS_FILE"
            print_info "Progress file removed. Starting fresh installation."
        else
            print_info "Resuming previous installation. Already completed items will be skipped."
        fi
    fi
    
    # System update (always run, unless dry run)
    if [ "$DRY_RUN" != true ]; then
        update_system
    else
        print_dry_run "Would run: sudo apt update && sudo apt upgrade -y"
    fi
    
    # Check if running specific section dry run
    local run_section=""
    if [ -n "$DRY_RUN_SECTION" ]; then
        case "$DRY_RUN_SECTION" in
            dev|cli|browsers|snaps|config-apps|git|fish|fonts|communication|media|devops|system|automation|media-playback|gnome|tools|android)
                run_section="$DRY_RUN_SECTION"
                print_info "Dry run mode: Only showing section '$run_section'"
                ;;
            *)
                print_error "Unknown section: $DRY_RUN_SECTION"
                print_info "Available sections: dev, cli, browsers, snaps, config-apps, git, fish, fonts, communication, media, devops, system, automation, media-playback, gnome, tools, android"
                exit 1
                ;;
        esac
    fi
    
    # Essential packages (always install)
    if [ -z "$run_section" ] || [ "$run_section" = "essential" ]; then
        print_header "Essential Packages"
        print_info "These are required for the setup to work properly"
        for package in "${ESSENTIAL_PACKAGES[@]}"; do
            install_package "$package" "$package" || true
        done
    fi
    
    # Dotfiles setup (always run, but respect dry run)
    if [ -z "$run_section" ] || [ "$run_section" = "config" ]; then
        setup_dotfiles
    fi
    
    # Install Python dependencies if requirements.txt exists
    if [ -f "$DOTFILES_DIR/setup/requirements.txt" ]; then
        print_header "Python Dependencies"
        print_status "Installing Python dependencies from setup/requirements.txt..."
        if pip3 install --user -r "$DOTFILES_DIR/setup/requirements.txt" >/dev/null 2>&1; then
            print_success "Python dependencies installed"
        else
            print_warning "Some Python dependencies failed to install. You can install manually with: pip3 install -r setup/requirements.txt"
        fi
    fi
    
    # Interactive selections
    echo ""
    print_info "You can now select which categories to install"
    echo ""
    
    # Development tools
    if [ -z "$run_section" ] || [ "$run_section" = "dev" ]; then
        print_info "Press Enter to continue or Ctrl+C to exit at any time"
        echo ""
        select_packages "dev" "Development Tools" DEV_TOOLS || true
    fi
    
    # Git tools (lazygit, lazydocker)
    if [ -z "$run_section" ] || [ "$run_section" = "git" ]; then
        select_packages "git-tools" "Git Tools (lazygit, lazydocker)" GIT_TOOLS || true
    fi
    
    # CLI utilities
    if [ -z "$run_section" ] || [ "$run_section" = "cli" ]; then
        select_packages "cli" "Modern CLI Utilities" CLI_UTILITIES || true
    fi
    
    # Communication apps
    if [ -z "$run_section" ] || [ "$run_section" = "communication" ]; then
        select_packages "communication" "Communication & Social Apps" COMMUNICATION_APPS || true
    fi
    
    # Media apps
    if [ -z "$run_section" ] || [ "$run_section" = "media" ]; then
        select_packages "media" "Media & Graphics Apps" MEDIA_APPS || true
    fi
    
    # Browsers
    if [ -z "$run_section" ] || [ "$run_section" = "browsers" ]; then
        select_packages "browsers" "Web Browsers" BROWSERS || true
    fi
    
    # DevOps tools
    if [ -z "$run_section" ] || [ "$run_section" = "devops" ]; then
        select_packages "devops" "DevOps & Container Tools" DEVOPS_TOOLS || true
    fi
    
    # System utilities
    if [ -z "$run_section" ] || [ "$run_section" = "system" ]; then
        select_packages "system" "System Utilities" SYSTEM_UTILS || true
    fi
    
    # Hardware & GPU tools (NVIDIA, OpenRGB)
    if [ -z "$run_section" ] || [ "$run_section" = "hardware" ]; then
        select_packages "hardware" "Hardware & GPU Tools (NVIDIA, OpenRGB)" HARDWARE_TOOLS || true
    fi
    
    # Snap packages (includes editors like Cursor, VS Code, WhatsApp)
    if [ -z "$run_section" ] || [ "$run_section" = "snaps" ]; then
        select_snap_packages "snaps" "Snap Packages (includes Cursor, VS Code, WhatsApp, etc.)" SNAP_PACKAGES || true
    fi
    
    # Automation tools
    if [ -z "$run_section" ] || [ "$run_section" = "automation" ]; then
        select_packages "automation" "Automation & Testing Tools (xdotool, ydotool)" AUTOMATION_TOOLS || true
    fi
    
    # Media playback
    if [ -z "$run_section" ] || [ "$run_section" = "media-playback" ]; then
        select_packages "media-playback" "Media Playback (for alarm script)" MEDIA_PLAYBACK || true
    fi
    
    # GNOME tools (if GNOME desktop)
    if [ -z "$run_section" ] || [ "$run_section" = "gnome" ]; then
        if [ -n "$XDG_CURRENT_DESKTOP" ] && [[ "$XDG_CURRENT_DESKTOP" == *"GNOME"* ]]; then
            select_packages "gnome" "GNOME Tools" GNOME_TOOLS || true
        fi
    fi
    
    # Curl-installed tools (bun, starship, nvm, pnpm, turso, vercel, netlify)
    if [ -z "$run_section" ] || [ "$run_section" = "tools" ]; then
        select_curl_tools "tools" "Essential Tools (bun, starship, nvm, pnpm, turso, vercel, netlify)" CURL_TOOLS || true
    fi
    
    # npm CLI tools (gemini-cli, etc.)
    if [ -z "$run_section" ] || [ "$run_section" = "npm-tools" ]; then
        select_npm_tools "npm-tools" "NPM CLI Tools (gemini-cli, etc.)" NPM_CLI_TOOLS || true
    fi
    
    # Android Development Tools (optional)
    if [ -z "$run_section" ] || [ "$run_section" = "android" ]; then
        select_snap_packages "android" "Android Development Tools" ANDROID_TOOLS || true
    fi
    
    # Config-based applications (nvim, wezterm, kitty, etc.)
    if [ -z "$run_section" ] || [ "$run_section" = "config-apps" ]; then
        setup_config_apps || true
    fi
    
    # GNOME Aesthetic Setup (if GNOME desktop)
    if [ -z "$run_section" ] || [ "$run_section" = "gnome" ]; then
        if [ -n "$XDG_CURRENT_DESKTOP" ] && [[ "$XDG_CURRENT_DESKTOP" == *"GNOME"* ]]; then
            setup_gnome_aesthetics || true
        fi
    fi
    
    # Setup fish shell
    if [ -z "$run_section" ] || [ "$run_section" = "fish" ]; then
        setup_fish_shell
    fi
    
    # Install Nerd Fonts (background, no throttling)
    if [ -z "$run_section" ] || [ "$run_section" = "fonts" ]; then
        install_nerd_fonts
    fi
    
    # Summary
    if [ "$DRY_RUN" = true ]; then
        echo ""
        print_header "Dry Run Complete!"
        print_info "No changes were made. Run without --dry-run to install."
        return 0
    fi
    echo ""
    print_header "Setup Complete!"
    print_success "Installation finished"
    echo ""
    
    # Show failed installations if any
    if [ -f "$PROGRESS_FILE" ] && command_exists jq; then
        local failed=$(jq -r '.[] | to_entries[] | select(.value == "failed") | .key' "$PROGRESS_FILE" 2>/dev/null | wc -l)
        if [ "$failed" -gt 0 ]; then
            print_warning "$failed installation(s) failed. You can rerun this script to retry."
        fi
    fi
    
    print_info "Next steps:"
    echo "  1. Restart your terminal or run: source ~/.bashrc"
    echo "  2. If you set fish as default, restart your terminal"
    echo "  3. Run 'dotfiles' or 'df' to launch the interactive menu"
    echo ""
    print_info "Progress saved to: $PROGRESS_FILE"
    print_info "You can rerun './setup.sh' to resume or install additional packages"
    
    # Cleanup progress file on successful completion (optional)
    read -p "Remove progress file? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f "$PROGRESS_FILE"
        print_success "Progress file removed"
    fi
}

# Run main function
main "$@"
