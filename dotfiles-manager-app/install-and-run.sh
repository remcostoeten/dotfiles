#!/bin/bash

# Dotfiles Manager v2.0 - Installation & Setup Script
# This script handles all dependencies and setup

set -e

echo "🚀 Dotfiles Manager v2.0 - Installation Script"
echo "==============================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check Node.js
print_info "Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js installed: $NODE_VERSION"
    
    # Check if version is 18+
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        print_warning "Node.js 18+ recommended (you have v$NODE_MAJOR)"
    fi
else
    print_error "Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check bun
print_info "Checking bun installation..."
if command -v bun &> /dev/null; then
    bun_VERSION=$(bun --version)
    print_success "bun installed: $bun_VERSION"
else
    print_error "bun not found. Please install bun"
    exit 1
fi

# Check Rust/Cargo
print_info "Checking Rust/Cargo installation..."
if command -v cargo &> /dev/null; then
    CARGO_VERSION=$(cargo --version)
    print_success "Cargo installed: $CARGO_VERSION"
else
    print_error "Cargo not found. Install from: https://rustup.rs/"
    exit 1
fi

echo ""
echo "📦 Installing Dependencies..."
echo "=============================="

# Install bun dependencies
print_info "Installing bun dependencies..."
bun install
print_success "bun dependencies installed"

# Create icons directory
print_info "Setting up icons directory..."
mkdir -p src-tauri/icons

# Check if icon exists
if [ ! -f "src-tauri/icons/icon.png" ]; then
    print_warning "Icon file not found at src-tauri/icons/icon.png"
    print_info "Attempting to create placeholder icon..."
    
    # Try to download a default icon
    if command -v curl &> /dev/null; then
        print_info "Downloading default icon..."
        curl -s -L "https://raw.githubusercontent.com/tauri-apps/tauri/dev/tooling/cli/icon.png" -o "src-tauri/icons/icon.png" 2>/dev/null || true
    elif command -v wget &> /dev/null; then
        print_info "Downloading default icon..."
        wget -q "https://raw.githubusercontent.com/tauri-apps/tauri/dev/tooling/cli/icon.png" -O "src-tauri/icons/icon.png" 2>/dev/null || true
    fi
    
    if [ -f "src-tauri/icons/icon.png" ]; then
        print_success "Icon downloaded successfully"
    else
        print_warning "Could not download icon. You may need to provide one manually."
        print_info "Place a 256x256 PNG at: src-tauri/icons/icon.png"
    fi
else
    print_success "Icon file found"
fi

# Create backup directory
print_info "Creating backup directory..."
mkdir -p ~/.dotfiles-backups
chmod 755 ~/.dotfiles-backups
print_success "Backup directory created at ~/.dotfiles-backups"

# Verify dotfiles directory
print_info "Checking dotfiles directory..."
if [ -d ~/.config/dotfiles ]; then
    print_success "Dotfiles found at ~/.config/dotfiles"
    
    # Check for setup.sh
    if [ -f ~/.config/dotfiles/setup.sh ]; then
        print_success "setup.sh found"
    else
        print_warning "setup.sh not found in dotfiles directory"
    fi
else
    print_warning "Dotfiles directory not found at ~/.config/dotfiles"
    print_info "Expected location: ~/.config/dotfiles"
fi

echo ""
echo "✅ Installation Complete!"
echo "========================"
echo ""
echo "📋 Quick Start:"
echo "   1. Run in development: bun run tauri dev"
echo "   2. Build for production: bun run tauri build"
echo ""
echo "📚 Documentation:"
echo "   - Quick Start: see QUICK_START.md"
echo "   - Features: see NEW_FEATURES.md"
echo "   - Implementation: see IMPLEMENTATION_SUMMARY.md"
echo ""

# Ask if user wants to run now
read -p "Do you want to start the app now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Starting Dotfiles Manager in development mode..."
    echo ""
    bun run tauri dev
else
    print_info "You can start the app later with: bun run tauri dev"
fi

echo ""
print_success "Setup complete! Happy dotfiles management! 🎉"

