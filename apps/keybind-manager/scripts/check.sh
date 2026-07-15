#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
cargo fmt --all --manifest-path src-tauri/Cargo.toml --check
cargo clippy --workspace --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --workspace --manifest-path src-tauri/Cargo.toml
pnpm typecheck
pnpm test
pnpm build
