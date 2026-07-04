#!/usr/bin/env bash
# Build the `bpr` tool and install it to ~/.config/dotfiles/bin/bpr.
# Run this on each machine (Go required). The previous bash implementation is
# preserved at bin/bpr.bash.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../../bin/bpr"

cd "$HERE"
[ -L "$OUT" ] && rm -f "$OUT"

go build -trimpath -ldflags "-s -w" -o "$OUT" .
echo "built $OUT"
