#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../../bin/rig"

cd "$HERE"
cargo build --release -j 2
rm -f "$OUT"
cp target/release/rig "$OUT"
echo "built $OUT"
