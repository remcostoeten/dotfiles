# Contributing

## Setup

```sh
pnpm install
pnpm tauri dev
```

Rust 1.80+, pnpm 9+, and the Tauri Linux prerequisites (webkit2gtk-4.1, gtk3)
are required. keyd itself is only needed to test applying for real.

## Checks to run before a PR

```sh
cargo test --workspace --manifest-path src-tauri/Cargo.toml
cargo clippy --workspace --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt --all --manifest-path src-tauri/Cargo.toml --check
pnpm typecheck && pnpm test && pnpm build
```

## Conventions

- TypeScript: `type` aliases (no interfaces), function declarations for
  standalone functions, arrow functions for callbacks, kebab-case filenames,
  no classes, no `any`, no explanatory comments.
- Rust: business logic lives in `keybind-core` or app modules, never in
  `#[tauri::command]` handlers. Anything touching the filesystem or processes
  should be a pure function over strings where possible so it can be tested
  without system access.
- Generator changes must update the golden files deliberately:
  `KEYBIND_BLESS=1 cargo test --test golden` and review the diff.
- Privileged-helper changes require a corresponding SECURITY.md review.
