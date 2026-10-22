#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../../bin/ghostty-theme"

cd "$HERE"
cargo build --release
rm -f "$OUT"
cp target/release/ghostty-theme "$OUT"
echo "built $OUT"
