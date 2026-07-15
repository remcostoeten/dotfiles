#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
pnpm install
cargo build --release --manifest-path src-tauri/Cargo.toml -p keybind-helper
exec pnpm tauri build --bundles deb
