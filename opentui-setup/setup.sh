#!/bin/bash

# Modern Setup Script Launcher
# This is a convenience wrapper around the OpenTUI-based setup application

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          MODERN SYSTEM SETUP - OpenTUI Edition          ║"
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
bun run src/index.tsx
