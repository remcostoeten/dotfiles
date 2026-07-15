#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
pnpm install
exec pnpm tauri dev
