#!/usr/bin/env bash
# Install OS-level keyd patches by symlinking them into /etc/keyd and reloading.
# Idempotent: safe to re-run. Requires root (for /etc and keyd reload).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/keyd-zoom65-ctrl-capslock-swap.conf"
DEST="/etc/keyd/zoom65.conf"

if [[ $EUID -ne 0 ]]; then
  echo "This needs root. Re-run with: sudo $0" >&2
  exit 1
fi

if ! command -v keyd >/dev/null 2>&1; then
  echo "keyd is not installed. Install it first (e.g. 'sudo pacman -S keyd')." >&2
  exit 1
fi

[[ -f "$SRC" ]] || { echo "Patch file not found: $SRC" >&2; exit 1; }

mkdir -p /etc/keyd
ln -sfn "$SRC" "$DEST"
echo "Linked: $DEST -> $SRC"

systemctl enable --now keyd >/dev/null 2>&1 || true
keyd reload
echo "keyd reloaded."

echo
echo "Keyboards keyd is now managing:"
keyd list-keyboards || true

echo
echo "Done. Test: press the key labelled Ctrl (should act as Ctrl) and"
echo "the key labelled Caps Lock (should toggle Caps Lock)."
