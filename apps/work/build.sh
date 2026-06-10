#!/usr/bin/env bash
# Build the `work` launcher and install it to ~/.config/dotfiles/bin/work.
# Run this on each machine (Go required).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../../bin/work"

cd "$HERE"
# Don't clobber a symlink (older bash version) — replace with the real binary.
[ -L "$OUT" ] && rm -f "$OUT"

go build -trimpath -ldflags "-s -w" -o "$OUT" .
echo "built $OUT"
