#!/usr/bin/env bash
# Build the new `gpr` (GitHub TUI) tool and install it to ~/.config/dotfiles/bin/gpr.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../../bin/gpr"

cd "$HERE"
[ -L "$OUT" ] && rm -f "$OUT"

go build -trimpath -ldflags "-s -w" -o "$OUT" .
echo "built $OUT"
