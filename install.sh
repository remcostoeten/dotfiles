#!/usr/bin/env bash

# Dotfiles installation script
# This script clones the dotfiles repository and runs the bootstrap

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOTFILES_REPO="https://github.com/YOUR_USERNAME/dotfiles.git"
DOTFILES_DIR="$HOME/.config/dotfiles"

echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Dotfiles Installation Script      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}✗ Git is not installed. Please install git first.${NC}"
    exit 1
fi

# Check if Fish is installed
if ! command -v fish &> /dev/null; then
    echo -e "${YELLOW}⚠ Fish shell is not installed.${NC}"
    echo "Please install Fish shell first:"
    echo ""
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v apt &> /dev/null; then
            echo "  sudo apt update && sudo apt install fish"
        elif command -v dnf &> /dev/null; then
            echo "  sudo dnf install fish"
        elif command -v pacman &> /dev/null; then
            echo "  sudo pacman -S fish"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  brew install fish"
    fi
    
    echo ""
    exit 1
fi

# Prepare Neovim configuration
mkdir -p $DOTFILES_DIR/config/nvim
if [ -d ~/.config/nvim ]; then
    echo -e "${BLUE}→ Moving existing Neovim configuration to $DOTFILES_DIR/config/nvim${NC}"
    cp -r ~/.config/nvim/* $DOTFILES_DIR/config/nvim/
    rm -rf ~/.config/nvim
fi
ln -sf $DOTFILES_DIR/config/nvim ~/.config/nvim

# Check if dotfiles directory already exists
if [ -d "$DOTFILES_DIR" ]; then
    echo -e "${YELLOW}⚠ Dotfiles directory already exists at $DOTFILES_DIR${NC}"
    read -p "Do you want to backup and continue? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        backup_dir="$DOTFILES_DIR.backup.$(date +%Y%m%d_%H%M%S)"
        echo -e "${BLUE}→ Backing up to $backup_dir${NC}"
        mv "$DOTFILES_DIR" "$backup_dir"
    else
        echo "Installation cancelled."
        exit 0
    fi
fi

# Clone the repository
echo -e "${BLUE}→ Cloning dotfiles repository...${NC}"
git clone "$DOTFILES_REPO" "$DOTFILES_DIR"

# Make bootstrap script executable
chmod +x "$DOTFILES_DIR/bootstrap.fish"

# Run the bootstrap script
echo ""
echo -e "${BLUE}→ Running bootstrap script...${NC}"
cd "$DOTFILES_DIR"
fish bootstrap.fish

echo ""
echo -e "${GREEN}✓ Installation complete!${NC}"
echo ""
echo "To get started:"
echo "  1. Restart your terminal or run: exec fish"
echo "  2. Your dotfiles are located at: $DOTFILES_DIR"
echo "  3. Run 'symlink-manager status' to check symlink status"
echo ""
