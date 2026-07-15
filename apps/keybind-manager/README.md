# Keybind Manager

A small, fast desktop app for KDE Plasma that manages system-wide keyboard
remappings through [keyd](https://github.com/rvaiya/keyd). Because keyd works
below the display server, the same mappings work identically on Plasma X11,
Plasma Wayland, native Wayland apps, and XWayland apps.

- Tauri 2 + Rust backend, SolidJS + TypeScript frontend
- Unprivileged GUI; a narrowly-scoped polkit helper performs the only
  privileged operations (writing managed files under `/etc/keyd`, reloading
  `keyd.service`)
- Atomic writes, automatic backup, automatic rollback on failed reloads
- Deterministic TOML exports designed for dotfiles repositories
- CLI: `keybind-manager export | apply | validate | status`

## Supported platforms

Arch Linux, Ubuntu, Kubuntu, and KDE neon with KDE Plasma, on both X11 and
Wayland sessions. Detection is capability-based (`/etc/os-release`,
`XDG_SESSION_TYPE`, `XDG_CURRENT_DESKTOP`, installed package managers,
systemd, polkit), not hardcoded per distribution.

## Install

See [docs/arch-linux.md](docs/arch-linux.md) and [docs/ubuntu.md](docs/ubuntu.md).

## Quick start

1. Open Keybind Manager (no root needed).
2. Check the header: it shows your distro, session type, and keyd status.
3. Add a mapping — e.g. **+ Swap Caps/Esc** or **+ Tap/hold Caps** (tap for
   Escape, hold for Control).
4. Press **Apply**. You'll see a preview of the generated keyd config, then a
   single polkit prompt. The mapping is live immediately and survives reboots.
5. Export to your dotfiles from the **Dotfiles** tab; re-apply on another
   machine with `keybind-manager apply ./keyboard/config.toml`.

## Development

```sh
pnpm install
pnpm tauri dev        # GUI with hot reload
cargo test --workspace --manifest-path src-tauri/Cargo.toml
pnpm test && pnpm typecheck
```

Golden files for the keyd generator live in `src-tauri/core/tests/golden/`;
regenerate them with `KEYBIND_BLESS=1 cargo test --test golden`.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — module layout, backend abstraction, apply pipeline
- [SECURITY.md](SECURITY.md) — threat model and privilege boundaries
- [docs/dotfiles.md](docs/dotfiles.md) — dotfiles workflow
- [docs/troubleshooting.md](docs/troubleshooting.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
