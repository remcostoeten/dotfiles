#!/usr/bin/env bash

# Dotfiles Complete Setup Script
#
# Modes:
#   - Interactive (default): ./init.sh
#     Installs critical packages, then interactively installs additional tools.
#
#   - Barebones: ./init.sh --barebones
#     Installs only the critical packages required for the dotfiles system to function.
#
#   - Override OS/Manager: ./init.sh [os] [package_manager]
#     e.g., ./init.sh linux apt
#     e.g., ./init.sh macos brew

set -euo pipefail

# --- Configuration ---
DOTFILES_REPO="${DOTFILES_REPO:-https://github.com/remcostoeten/dotfiles}"
DOTFILES_DIR="$HOME/.config/dotfiles"
SECRETS_GIST_ID_FILE="$HOME/.dotfiles-secrets-gist"
CRITICAL_PACKAGES_FILE="$DOTFILES_DIR/configs/critical-packages.json"
ADDITIONAL_PACKAGES_FILE="$DOTFILES_DIR/configs/additional-packages.json"

# --- Colors and Formatting ---
RED='[0;31m'
GREEN='[0;32m'
YELLOW='[1;33m'
BLUE='[0;34m'
PURPLE='[0;35m'
CYAN='[0;36m'
NC='[0m' # No Color
BOLD='[1m'

# --- Logging ---
LOG_FILE="/tmp/dotfiles-init.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2> >(tee -a "$LOG_FILE" >&2)

# --- Utility Functions ---
log_info() { echo -e "${CYAN}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_header() {
    echo -e "
${BOLD}${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${BLUE}                    $1${NC}"
    echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════${NC}
"
}

# --- System State ---
OS=""
PKG_MGR=""
PKG_UPDATE=""
PKG_INSTALL=""
BAREBONES=false

# --- Error Handling ---
trap 'log_error "Setup failed at line $LINENO. Check $LOG_FILE for details."; exit 1' ERR

# --- Core Functions ---

detect_system() {
    log_info "Detecting system..."
    local detected_os
    local detected_pkg_mgr

    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        detected_os="linux"
        if command -v apt &> /dev/null; then detected_pkg_mgr="apt";
        elif command -v dnf &> /dev/null; then detected_pkg_mgr="dnf";
        elif command -v pacman &> /dev/null; then detected_pkg_mgr="pacman";
        elif command -v zypper &> /dev/null; then detected_pkg_mgr="zypper";
        elif command -v yay &> /dev/null; then detected_pkg_mgr="yay";
        else
            log_error "Unsupported Linux distribution. Please use override: ./init.sh linux <pkg_mgr>"
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        detected_os="macos"
        if ! command -v brew &> /dev/null; then
            log_info "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        detected_pkg_mgr="brew"
    else
        log_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi

    # Set globals, allowing for overrides
    OS=${1:-$detected_os}
    PKG_MGR=${2:-$detected_pkg_mgr}

    case "$PKG_MGR" in
        apt)
            PKG_UPDATE="sudo apt update"
            PKG_INSTALL="sudo apt install -y"
            ;;
        dnf)
            PKG_UPDATE="sudo dnf check-update || true"
            PKG_INSTALL="sudo dnf install -y"
            ;;
        pacman|yay)
            PKG_UPDATE="sudo pacman -Sy"
            PKG_INSTALL="sudo pacman -S --noconfirm"
            ;;
        zypper)
            PKG_UPDATE="sudo zypper refresh"
            PKG_INSTALL="sudo zypper install -y"
            ;;
        brew)
            PKG_UPDATE="brew update"
            PKG_INSTALL="brew install"
            ;;
        npm)
            PKG_UPDATE=""
            PKG_INSTALL="npm install -g"
            ;;
        *)
            log_error "Unsupported package manager: $PKG_MGR"
            exit 1
            ;;
    esac

    log_success "System: $OS, Package Manager: $PKG_MGR"
}

parse_args() {
    local os_arg=""
    local pkg_mgr_arg=""

    for arg in "$@"; do
        if [[ "$arg" == "--barebones" ]]; then
            BAREBONES=true
            log_info "Running in --barebones mode"
        elif [[ -z "$os_arg" ]]; then
            os_arg="$arg"
        elif [[ -z "$pkg_mgr_arg" ]]; then
            pkg_mgr_arg="$arg"
        fi
    done
    detect_system "$os_arg" "$pkg_mgr_arg"
}

install_packages_from_file() {
    local file="$1"
    local is_critical="$2"
    local interactive="$3"

    if [[ ! -f "$file" ]]; then
        log_error "Package file not found: $file"
        return 1
    fi

    log_header "Processing packages from $file"

    # Update package manager once before installing
    if [[ -n "$PKG_UPDATE" ]]; then
        log_info "Updating package manager index..."
        eval "$PKG_UPDATE"
    fi

    for pkg_name in $(jq -r '.[].name' "$file"); do
        local pkg_info=$(jq -r ".[] | select(.name == "$pkg_name")" "$file")
        local pkg_desc=$(echo "$pkg_info" | jq -r '.description')
        
        # Find the correct command
        local cmd=$(echo "$pkg_info" | jq -r ".commands[] | select(.os == "$OS" and .manager == "$PKG_MGR") | .command")
        # Fallback to manager-only command (for npm, etc.)
        if [[ -z "$cmd" ]]; then
            cmd=$(echo "$pkg_info" | jq -r ".commands[] | select(.manager == "$PKG_MGR" and .os == null) | .command")
        fi
        # Fallback to default (linux, apt)
        if [[ -z "$cmd" ]]; then
            cmd=$(echo "$pkg_info" | jq -r ".commands[] | select(.os == "linux" and .manager == "apt") | .command")
        fi

        if [[ -z "$cmd" ]]; then
            log_warning "No suitable installation command found for '$pkg_name' on $OS/$PKG_MGR. Skipping."
            continue
        fi

        if command -v "$pkg_name" &>/dev/null; then
            log_success "'$pkg_name' is already installed."
            continue
        fi

        if [[ "$interactive" == "true" ]]; then
            echo -e "
${BOLD}${PURPLE}Install additional tool: $pkg_name?${NC}"
            echo -e "$pkg_desc"
            read -p "Continue with installation? [Y/n] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Nn]$ ]]; then
                log_info "Skipping '$pkg_name'."
                continue
            fi
        fi

        log_info "Installing '$pkg_name'..."
        echo -e "Running command: ${YELLOW}$cmd${NC}"

        if eval "$cmd"; then
            log_success "Successfully installed '$pkg_name'."
        else
            if [[ "$is_critical" == "true" ]]; then
                log_error "Failed to install critical package '$pkg_name'. Aborting."
                exit 1
            else
                log_warning "Failed to install '$pkg_name'. Continuing..."
            fi
        fi
    done
}

# --- Placeholder functions from original script ---
# (These would be integrated similarly but are kept simple for this refactoring)

install_github_cli() {
    log_header "Installing GitHub CLI"
    if command -v gh &> /dev/null; then
        log_success "GitHub CLI already installed."
        return
    fi
    # Simplified for brevity - original logic can be restored
    eval "$PKG_INSTALL gh" || log_warning "Could not install gh via package manager. Please install it manually."
}

install_fzf() {
    log_header "Installing fzf"
    if command -v fzf &> /dev/null; then
        log_success "fzf already installed."
        return
    fi
    eval "$PKG_INSTALL fzf" || {
        log_info "fzf not in package manager, installing from git..."
        git clone --depth 1 https://github.com/junegunn/fzf.git ~/.fzf
        ~/.fzf/install --all --no-update-rc
    }
}

setup_dotfiles() {
    log_header "Setting up Dotfiles"
    if [[ -d "$DOTFILES_DIR" ]]; then
        log_info "Dotfiles directory exists, updating..."
        cd "$DOTFILES_DIR" && git pull origin main || log_warning "Failed to update dotfiles"
    else
        log_info "Cloning dotfiles repository..."
        git clone "$DOTFILES_REPO" "$DOTFILES_DIR"
    fi
    cd "$DOTFILES_DIR"
    chmod +x "$DOTFILES_DIR"/bin/*
    log_success "Dotfiles repository ready"
}

setup_github_auth() {
    log_header "Setting up GitHub Authentication"
    if gh auth status &> /dev/null; then
        log_success "Already authenticated to GitHub."
        return
    fi
    log_info "GitHub CLI authentication required."
    gh auth login --web --scopes "gist"
}

setup_secrets_sync() {
    log_header "Setting up Secrets Sync"
    # This function's logic remains complex and is kept as a placeholder.
    # It would use `gh` which is installed as a critical dependency.
    log_info "Running secrets sync setup..."
    if [[ -f "$DOTFILES_DIR/bin/dotfiles-secrets-sync" ]]; then
        "$DOTFILES_DIR/bin/dotfiles" secrets-sync init || log_warning "Secret sync setup had issues."
    else
        log_warning "dotfiles-secrets-sync script not found."
    fi
}

install_dotfiles() {
    log_header "Installing Dotfiles"
    cd "$DOTFILES_DIR"
    if [[ -f "bin/dotfiles" ]]; then
        ./bin/dotfiles install
        log_success "Dotfiles installed"
    else
        log_error "Dotfiles install script not found"
    fi
}

final_setup() {
    log_header "🎉 Setup Complete!"
    echo -e "${GREEN}Your dotfiles initial setup is complete!${NC}
"
    echo -e "${BOLD}Next steps:${NC}"
    echo -e "1. ${CYAN}Restart your terminal${NC} or run: source ~/.${SHELL##*/}rc"
    echo -e "2. ${CYAN}Explore commands${NC} with: dotfiles help"
}

# --- Main Execution ---
main() {
    log_header "🚀 Dotfiles Setup"
    parse_args "$@"

    if [[ "$BAREBONES" == "false" ]]; then
        echo -e "${BOLD}This script will:${NC}"
        echo "• Install critical dependencies (git, jq, curl, etc.)"
        echo "• Install GitHub CLI and fzf"
        echo "• Clone and set up your dotfiles"
        echo "• Configure secrets sync with GitHub gists"
        echo "• Interactively install additional CLI tools"
        echo ""
        read -p "Continue with setup? [Y/n] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            log_info "Setup cancelled."
            exit 0
        fi
    fi

    # 1. Critical Packages
    install_packages_from_file "$CRITICAL_PACKAGES_FILE" true false

    # 2. Core Tooling (gh, fzf)
    install_github_cli
    install_fzf

    # 3. Dotfiles Repo
    setup_dotfiles

    if [[ "$BAREBONES" == "true" ]]; then
        log_success "Barebones setup complete. Critical packages and dotfiles repo are ready."
        exit 0
    fi

    # --- Full Interactive Setup ---

    # 4. Additional Packages (Interactive)
    install_packages_from_file "$ADDITIONAL_PACKAGES_FILE" false true

    # 5. GitHub Auth & Secrets
    setup_github_auth
    setup_secrets_sync

    # 6. Install dotfiles configs
    install_dotfiles

    # 7. Finalize
    final_setup
}

main "$@"