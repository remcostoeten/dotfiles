#!/bin/bash

# OpenTUI Setup Bootstrap Script
# This script installs prerequisites and sets up the OpenTUI setup system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOTFILES_DIR="${HOME}/.config/dotfiles"
OPENTUI_DIR="${DOTFILES_DIR}/opentui-setup"
INSTALL_DIR="${HOME}/.local/share/opentui-setup"

# Print functions
print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} ${GREEN}OpenTUI Setup Bootstrap${NC} ${BLUE}                                         ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_status() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running on supported system
check_system() {
    print_status "Checking system compatibility..."

    if ! command -v apt-get >/dev/null 2>&1; then
        print_error "This script requires apt-get (Ubuntu/Debian)"
        exit 1
    fi

    if ! command -v sudo >/dev/null 2>&1; then
        print_error "sudo is required but not installed"
        exit 1
    fi

    print_success "System compatibility verified"
}

# Install Git if not present
install_git() {
    print_status "Installing Git..."

    if command -v git >/dev/null 2>&1; then
        print_success "Git is already installed"
        return 0
    fi

    if sudo apt-get update && sudo apt-get install -y git; then
        print_success "Git installed successfully"
    else
        print_error "Failed to install Git"
        exit 1
    fi
}

# Clone dotfiles repository
clone_dotfiles() {
    print_status "Cloning dotfiles repository..."

    if [ -d "$DOTFILES_DIR" ]; then
        print_warning "Dotfiles directory already exists"
        read -p "Do you want to remove and re-clone? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$DOTFILES_DIR"
        else
            print_status "Using existing dotfiles directory"
            return 0
        fi
    fi

    # Create parent directory if needed
    mkdir -p "$(dirname "$DOTFILES_DIR")"

    if git clone https://github.com/remcostoeten/dotfiles.git "$DOTFILES_DIR"; then
        print_success "Dotfiles repository cloned"
    else
        print_error "Failed to clone dotfiles repository"
        exit 1
    fi
}

# Install Fish shell
install_fish() {
    print_status "Installing Fish shell..."

    if command -v fish >/dev/null 2>&1; then
        print_success "Fish shell is already installed"
        return 0
    fi

    if sudo apt-get install -y fish; then
        print_success "Fish shell installed successfully"
    else
        print_error "Failed to install Fish shell"
        exit 1
    fi
}

# Install Bun runtime
install_bun() {
    print_status "Installing Bun runtime..."

    if command -v bun >/dev/null 2>&1; then
        print_success "Bun is already installed"
        return 0
    fi

    # Install Bun using official installer
    if curl -fsSL https://bun.sh/install | bash; then
        # Add Bun to PATH for current session
        export BUN_INSTALL="$HOME/.bun"
        export PATH="$BUN_INSTALL/bin:$PATH"

        # Add to .bashrc if not already there
        if ! grep -q 'bun/install' "$HOME/.bashrc" 2>/dev/null; then
            echo '# Bun' >> "$HOME/.bashrc"
            echo 'export BUN_INSTALL="$HOME/.bun"' >> "$HOME/.bashrc"
            echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> "$HOME/.bashrc"
        fi

        print_success "Bun installed successfully"
    else
        print_error "Failed to install Bun"
        exit 1
    fi
}

# Install Node.js if Bun installation fails (fallback)
install_nodejs() {
    print_status "Installing Node.js (fallback)..."

    if command -v node >/dev/null 2>&1; then
        print_success "Node.js is already installed"
        return 0
    fi

    # Install Node.js via NodeSource
    if curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs; then
        print_success "Node.js installed successfully"
    else
        print_error "Failed to install Node.js"
        exit 1
    fi
}

# Install npm/pnpm if needed
install_package_managers() {
    print_status "Checking package managers..."

    # npm comes with Node.js
    if command -v npm >/dev/null 2>&1; then
        print_success "npm is available"
    else
        print_warning "npm not found"
    fi

    # Install pnpm if requested
    if command -v pnpm >/dev/null 2>&1; then
        print_success "pnpm is already installed"
    else
        print_status "Installing pnpm..."
        if npm install -g pnpm 2>/dev/null || curl -fsSL https://get.pnpm.io/install.sh | sh; then
            print_success "pnpm installed successfully"
        else
            print_warning "Could not install pnpm (optional)"
        fi
    fi
}

# Install dependencies for OpenTUI setup
install_dependencies() {
    print_status "Installing OpenTUI dependencies..."

    cd "$OPENTUI_DIR"

    if command -v bun >/dev/null 2>&1; then
        if bun install; then
            print_success "Dependencies installed with Bun"
        else
            print_error "Failed to install dependencies with Bun"
            exit 1
        fi
    elif command -v npm >/dev/null 2>&1; then
        if npm install; then
            print_success "Dependencies installed with npm"
        else
            print_error "Failed to install dependencies with npm"
            exit 1
        fi
    else
        print_error "No package manager available"
        exit 1
    fi
}

# Verify all critical components are working
verify_setup() {
    print_status "Verifying setup..."

    local errors=0

    # Check Git
    if ! command -v git >/dev/null 2>&1; then
        print_error "Git is not available"
        ((errors++))
    else
        print_success "Git is working"
    fi

    # Check Bun/Node
    if command -v bun >/dev/null 2>&1; then
        print_success "Bun is working"
    elif command -v node >/dev/null 2>&1; then
        print_success "Node.js is working"
    else
        print_error "Neither Bun nor Node.js is available"
        ((errors++))
    fi

    # Check dotfiles directory
    if [ -d "$DOTFILES_DIR" ]; then
        print_success "Dotfiles directory exists"
    else
        print_error "Dotfiles directory not found"
        ((errors++))
    fi

    # Check OpenTUI setup directory
    if [ -d "$OPENTUI_DIR" ]; then
        print_success "OpenTUI setup directory exists"
    else
        print_error "OpenTUI setup directory not found"
        ((errors++))
    fi

    # Check if dependencies are installed
    if [ -f "$OPENTUI_DIR/package.json" ] && [ -d "$OPENTUI_DIR/node_modules" ]; then
        print_success "Dependencies are installed"
    else
        print_error "Dependencies not properly installed"
        ((errors++))
    fi

    if [ $errors -eq 0 ]; then
        print_success "All components verified successfully"
        return 0
    else
        print_error "$errors components failed verification"
        return 1
    fi
}

# Create launcher script
create_launcher() {
    print_status "Creating launcher script..."

    local launcher_dir="$HOME/.local/bin"
    mkdir -p "$launcher_dir"

    cat > "$launcher_dir/opentui-setup" << 'EOF'
#!/bin/bash
# OpenTUI Setup Launcher

cd "$HOME/.config/dotfiles/opentui-setup"

if command -v bun >/dev/null 2>&1; then
    bun setup "$@"
elif command -v node >/dev/null 2>&1; then
    node_modules/.bin/bun setup "$@"
else
    echo "Error: Neither Bun nor Node.js is available"
    exit 1
fi
EOF

    chmod +x "$launcher_dir/opentui-setup"

    # Add ~/.local/bin to PATH if not already there
    if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
        export PATH="$HOME/.local/bin:$PATH"
    fi

    print_success "Launcher script created: opentui-setup"
}

# Show next steps
show_next_steps() {
    echo ""
    print_success "Bootstrap completed successfully!"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Restart your terminal or run: source ~/.bashrc"
    echo "2. Run the setup: opentui-setup"
    echo "   Or: cd ~/.config/dotfiles/opentui-setup && bun setup"
    echo ""
    echo -e "${BLUE}What the setup will do:${NC}"
    echo "• Configure Fish shell with all aliases and functions"
    echo "• Symlink config files (kitty, nvim, wezterm, etc.)"
    echo "• Install selected packages with error handling"
    echo "• Set up development environment"
    echo "• Install Nerd Fonts and configure GNOME aesthetics"
    echo ""
    echo -e "${BLUE}Commands you'll have after setup:${NC}"
    echo "• govee - Launch Govee app in Android emulator"
    echo "• feeld - Launch Feeld app in Android emulator"
    echo "• df - Launch dotfiles menu (or use df -h for disk usage)"
    echo "• All your custom Fish aliases and functions"
    echo ""
}

# Main execution
main() {
    print_header

    # Parse arguments
    SKIP_GIT=false
    SKIP_BUN=false

    for arg in "$@"; do
        case $arg in
            --skip-git)
                SKIP_GIT=true
                ;;
            --skip-bun)
                SKIP_BUN=true
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-git    Skip Git installation"
                echo "  --skip-bun    Skip Bun installation"
                echo "  --help, -h    Show this help message"
                exit 0
                ;;
        esac
    done

    check_system

    if [ "$SKIP_GIT" = false ]; then
        install_git
    fi

    clone_dotfiles

    if [ "$SKIP_BUN" = false ]; then
        install_bun || install_nodejs
    fi

    install_package_managers
    install_dependencies

    if verify_setup; then
        create_launcher
        show_next_steps
    else
        print_error "Setup verification failed"
        exit 1
    fi
}

# Run main function
main "$@"
