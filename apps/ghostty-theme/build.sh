#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../../bin/ghostty-theme"

cd "$HERE"
rm -f "$OUT"
go build -trimpath -ldflags "-s -w" -o "$OUT" .
echo "built $OUT"
