#!/bin/bash
set -euo pipefail

VERSION="${VERSION:-1.0.0}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_NAME="df"

echo "Installing df CLI v$VERSION..."

mkdir -p "$INSTALL_DIR"

echo "Building..."
cd "$REPO_DIR"
go build -o "$BIN_NAME" .

echo "Installing to $INSTALL_DIR..."
cp "$BIN_NAME" "$INSTALL_DIR/df"
chmod +x "$INSTALL_DIR/df"

echo "✓ Installed df to $INSTALL_DIR/df"

which df

echo ""
echo "Usage:"
echo "  df              # List all items"
echo "  df --aliases    # Show aliases"
echo "  df --functions # Show functions"
echo "  df --scripts   # Show scripts"
echo "  df --binaries # Show binaries"
echo "  df --modules  # Show modules"
echo "  df --search <term>  # Search"
echo "  df --run <name>     # Run a script"
echo "  df --help          # Show help"