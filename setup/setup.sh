#!/bin/bash
# Modern Setup Script Launcher
# This is a convenience wrapper around the TUI-based setup application

set -e

# Colors for output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Ensure sudo never prompts once configuration is stored in sudoers.d
ensure_passwordless_sudo() {
    local current_user
    current_user="$(whoami)"
    local sudoers_file="/etc/sudoers.d/99-${current_user}-nopasswd"
    local sudoers_entry="${current_user} ALL=(ALL) NOPASSWD:ALL"

    if sudo test -f "$sudoers_file"; then
        if sudo grep -qF "$sudoers_entry" "$sudoers_file"; then
            echo -e "${GREEN}✓ Passwordless sudo already configured${NC}"
            return
        fi
    fi

    echo -e "${YELLOW}Configuring passwordless sudo (requires your password once)...${NC}"

    local tmp_file
    tmp_file="$(mktemp)"
    echo "$sudoers_entry" > "$tmp_file"
    sudo chown root:root "$tmp_file"
    sudo chmod 440 "$tmp_file"

    if sudo visudo -cf "$tmp_file"; then
        sudo mv "$tmp_file" "$sudoers_file"
        echo -e "${GREEN}✓ Passwordless sudo configured${NC}"
    else
        echo -e "${RED}Failed to validate sudoers change; aborting${NC}"
        rm -f "$tmp_file"
        exit 1
    fi
}

ensure_passwordless_sudo

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          MODERN SYSTEM SETUP - Interactive TUI Edition       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Error: Bun is not installed${NC}"
    echo -e "${YELLOW}Install Bun with: curl -fsSL https://bun.sh/install | bash${NC}"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    cd "$SCRIPT_DIR"
    bun install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
fi

# Run the setup application
echo -e "${GREEN}Launching interactive setup...${NC}"
echo ""
cd "$SCRIPT_DIR"
bun run interactive-setup.ts
