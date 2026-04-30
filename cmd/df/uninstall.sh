#!/bin/bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

echo "Uninstalling df CLI..."

rm -f "$INSTALL_DIR/df"

if which df &>/dev/null; then
    echo "⚠ df still in PATH. You may need to restart your shell."
else
    echo "✓ Removed df from $INSTALL_DIR"
fi

echo "Done."