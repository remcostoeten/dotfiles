#!/usr/bin/env bash

# Zed Editor Setup Script
# This script builds and installs Zed editor from source

set -euo pipefail  # Exit on error, undefined vars, pipe failures

readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly YELLOW='\033[1;33m'
readonly RED='\033[0;31m'
readonly CYAN='\033[0;36m'
readonly MAGENTA='\033[0;35m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

readonly ZED_REPO="https://github.com/zed-industries/zed.git"
readonly ZED_INSTALL_DIR="$HOME/tmp/zed"
readonly CLEANUP_ON_EXIT=true

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_header() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                        SETUP ZED                          ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

cleanup() {
    if [[ "$CLEANUP_ON_EXIT" == "true" && -d "$ZED_INSTALL_DIR" ]]; then
        log_info "Cleaning up temporary directory: $ZED_INSTALL_DIR"
        rm -rf "$ZED_INSTALL_DIR"
    fi
}

handle_error() {
    local exit_code=$?
    log_error "Script failed with exit code $exit_code"
    cleanup
    exit $exit_code
}

validate_dependencies() {
    log_info "Validating dependencies..."

    if ! command -v git &> /dev/null; then
        log_error "Git is not installed. Please install git first."
        exit 1
    fi
    log_success "Git is available"

    # Check for rustup
    if ! command -v rustup &> /dev/null; then
        log_error "Rustup is not installed"
        log_info "Install Rustup with: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        exit 1
    fi
    log_success "Rustup is available: $(rustup --version)"

    # Check for cargo
    if ! command -v cargo &> /dev/null; then
        log_error "Cargo is not available. Rust installation may be incomplete."
        exit 1
    fi
    log_success "Cargo is available: $(cargo --version)"
}

# Setup environment
setup_environment() {
    log_info "Setting up environment..."

    # check if already cloned and ask if they want fresh
    if [[ -d "$ZED_INSTALL_DIR" ]]; then
        log_warning "Zed directory already exists: $ZED_INSTALL_DIR"
        read -p "Do you want to remove and re-clone? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$ZED_INSTALL_DIR"
        else
            log_info "Using existing Zed directory"
        fi
    fi

    # Create parent directory if it doesn't exist
    mkdir -p "$(dirname "$ZED_INSTALL_DIR")"
    log_success "Environment setup complete"
}

# Clone Zed repository
clone_zed() {
    # Check if directory already exists and has content
    if [[ -d "$ZED_INSTALL_DIR" ]] && [[ -n "$(ls -A "$ZED_INSTALL_DIR" 2>/dev/null)" ]]; then
        log_info "Using existing Zed directory, skipping clone"
        return 0
    fi

    log_info "Cloning Zed repository from: $ZED_REPO"

    if ! git clone "$ZED_REPO" "$ZED_INSTALL_DIR"; then
        log_error "Failed to clone Zed repository"
        exit 1
    fi

    log_success "Zed cloned successfully to: $ZED_INSTALL_DIR"
}

# Build and install Zed
build_and_install_zed() {
    log_info "Building and installing Zed..."

    # Change to Zed directory
    cd "$ZED_INSTALL_DIR" || {
        log_error "Failed to change directory to: $ZED_INSTALL_DIR"
        exit 1
    }

    # Verify the build script exists
    if [[ ! -f "script/install-linux" ]]; then
        log_error "Build script not found: script/install-linux"
        exit 1
    fi

    log_info "Running Zed build script..."
    if ! ./script/install-linux; then
        log_error "Zed build failed"
        exit 1
    fi

    log_success "Zed installed successfully!"
}

# Main execution
main() {
    # Set up error handling
    trap handle_error ERR
    trap cleanup EXIT

    log_header

    # Validate dependencies
    validate_dependencies

    # Setup environment
    setup_environment

    # Clone repository
    clone_zed

    # Build and install
    build_and_install_zed

    log_success "Zed setup completed successfully!"
    log_info "You can now run Zed from your applications menu or command line"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
