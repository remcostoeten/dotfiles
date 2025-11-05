#!/bin/bash

################################################################################
# Dotfiles Setup Script - Modular Version
#
# This is the main orchestrator that sources modular components from setup/
# For the original monolithic version, see: setup.sh.original (2,776 lines)
#
# Structure:
#   setup/core/        - Core utilities (colors, config, helpers, args, progress)
#   setup/packages/    - Package definitions by category (19 files)
#   setup/installers/  - Installation logic
#   setup/modules/     - Feature modules (menu, fish, fonts, gnome)
#   setup/loader.sh    - Loads all modules
################################################################################

set +e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source all modular components
if [ ! -f "$SCRIPT_DIR/setup/loader.sh" ]; then
    echo "Error: setup/loader.sh not found. Run from dotfiles directory."
    exit 1
fi

source "$SCRIPT_DIR/setup/loader.sh"

################################################################################
# Main Installation Flow
################################################################################

main() {
    # Initialize data directory
    init_data_directory

    # Parse command line arguments
    parse_args "$@"

    # Show main menu if no arguments provided
    if [ $# -eq 0 ]; then
        echo "Interactive menu not yet implemented in modular version."
        echo "Use --help to see available options."
        echo ""
        echo "For now, use the original version:"
        echo "  ./setup.sh.original"
        exit 0
    fi

    print_header "Starting Dotfiles Setup"

    # System update
    if [ "$SKIP_SYSTEM_UPDATE" != true ] && [ "$DRY_RUN" != true ]; then
        print_status "Updating system packages..."
        if [ "$VERBOSE" = true ]; then
            sudo apt-get update
            sudo apt-get upgrade -y
        else
            sudo apt-get update >/dev/null 2>&1
            sudo apt-get upgrade -y >/dev/null 2>&1
        fi
        print_success "System updated"
    elif [ "$DRY_RUN" = true ]; then
        print_dry_run "Would update system packages"
    fi

    # Install essential packages
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "essential" ]; then
        print_header "Essential Packages"
        for pkg in "${ESSENTIAL_PACKAGES[@]}"; do
            install_package_new "$pkg"
        done
    fi

    # Install languages
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "languages" ]; then
        print_header "Programming Languages"
        for pkg in "${LANGUAGES[@]}"; do
            install_package_new "$pkg"
        done
    fi

    # Install editors
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "editors" ]; then
        print_header "Code Editors"
        for pkg in "${EDITORS[@]}"; do
            install_package_new "$pkg"
        done
    fi

    # Install package managers
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "package-managers" ]; then
        print_header "Package Managers"
        for pkg in "${PACKAGE_MANAGERS[@]}"; do
            install_package_new "$pkg"
        done
    fi

    # Install git tools
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "git" ]; then
        print_header "Git Tools"
        for pkg in "${GIT_TOOLS[@]}"; do
            install_package_new "$pkg"
        done
    fi

    # Install CLI utilities
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "cli" ]; then
        print_header "CLI Utilities"
        for pkg in "${CLI_UTILITIES[@]}"; do
            # Old format: "package:display"
            IFS=':' read -ra parts <<< "$pkg"
            local package="${parts[0]}"
            local display="${parts[1]:-$package}"
            # Convert to new format for installer
            install_package_new "$package|apt||$display"
        done
    fi

    # Install browsers
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "browsers" ]; then
        print_header "Browsers"
        for pkg in "${BROWSERS[@]}"; do
            IFS=':' read -ra parts <<< "$pkg"
            install_package_new "${parts[0]}|apt||${parts[1]}"
        done
    fi

    # Install communication apps
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "communication" ]; then
        print_header "Communication Apps"
        for pkg in "${COMMUNICATION_APPS[@]}"; do
            IFS=':' read -ra parts <<< "$pkg"
            install_package_new "${parts[0]}|apt||${parts[1]}"
        done
    fi

    # Install media apps
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "media" ]; then
        print_header "Media & Graphics"
        for pkg in "${MEDIA_APPS[@]}"; do
            IFS=':' read -ra parts <<< "$pkg"
            install_package_new "${parts[0]}|apt||${parts[1]}"
        done
    fi

    # Install DevOps tools
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "devops" ]; then
        print_header "DevOps Tools"
        for pkg in "${DEVOPS_TOOLS[@]}"; do
            IFS=':' read -ra parts <<< "$pkg"
            install_package_new "${parts[0]}|apt||${parts[1]}"
        done
    fi

    # Install system utilities
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "system" ]; then
        print_header "System Utilities"
        for pkg in "${SYSTEM_UTILS[@]}"; do
            IFS=':' read -ra parts <<< "$pkg"
            install_package_new "${parts[0]}|apt||${parts[1]}"
        done
    fi

    # Install hardware tools
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "hardware" ]; then
        print_header "Hardware Tools"
        for pkg in "${HARDWARE_TOOLS[@]}"; do
            IFS=':' read -ra parts <<< "$pkg"
            install_package_new "${parts[0]}|apt||${parts[1]}"
        done
    fi

    # Install automation tools
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "automation" ]; then
        print_header "Automation Tools"
        for pkg in "${AUTOMATION_TOOLS[@]}"; do
            IFS=':' read -ra parts <<< "$pkg"
            install_package_new "${parts[0]}|apt||${parts[1]}"
        done
    fi

    # Install GNOME tools
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "gnome" ]; then
        if [ -n "$XDG_CURRENT_DESKTOP" ] && [[ "$XDG_CURRENT_DESKTOP" == *"GNOME"* ]]; then
            print_header "GNOME Tools"
            for pkg in "${GNOME_TOOLS[@]}"; do
                IFS=':' read -ra parts <<< "$pkg"
                install_package_new "${parts[0]}|apt||${parts[1]}"
            done
        fi
    fi

    # Install snap packages
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "snaps" ]; then
        print_header "Snap Packages"
        for pkg in "${SNAP_PACKAGES[@]}"; do
            IFS=':' read -ra parts <<< "$pkg"
            install_package_new "${parts[0]}|snap||${parts[1]}"
        done
    fi

    # Install curl tools
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "tools" ]; then
        print_header "Essential Tools"
        for tool in "${CURL_TOOLS[@]}"; do
            IFS=':' read -ra parts <<< "$tool"
            local name="${parts[0]}"
            local url="${parts[1]}"
            local display="${parts[2]:-$name}"
            install_package_new "$name|curl|$url|$display"
        done
    fi

    # Install NPM tools
    if [ -z "$INSTALL_SECTION" ] || [ "$INSTALL_SECTION" = "npm-tools" ]; then
        print_header "NPM CLI Tools"
        for tool in "${NPM_CLI_TOOLS[@]}"; do
            IFS=':' read -ra parts <<< "$tool"
            install_package_new "${parts[0]}|npm||${parts[1]}"
        done
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
    print_info "Successful: $TOTAL_SUCCESS | Failed: $TOTAL_FAILED"
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
    echo "  2. Run './setup.sh --help' for more options"
    echo ""
    print_info "Progress saved to: $PROGRESS_FILE"
}

################################################################################
# Run Main
################################################################################

main "$@"
