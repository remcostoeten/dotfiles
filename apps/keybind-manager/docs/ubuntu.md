# Ubuntu, Kubuntu, KDE neon

## keyd

On releases where keyd is packaged (Ubuntu 25.04+ universe):

```sh
sudo apt install keyd
sudo systemctl enable --now keyd
```

On older releases the app shows verified build-from-source instructions
instead of adding a PPA silently:

```sh
sudo apt install git build-essential
git clone https://github.com/rvaiya/keyd
cd keyd && make && sudo make install
sudo systemctl enable --now keyd
```

Keybind Manager never adds third-party repositories or pipes remote scripts
into a shell; installation commands are shown for you to run deliberately.

## Install Keybind Manager

Build the `.deb` (includes the helper and polkit policy):

```sh
pnpm install
cargo build --release --manifest-path src-tauri/Cargo.toml -p keybind-helper
pnpm tauri build --bundles deb
sudo apt install ./src-tauri/target/release/bundle/deb/*.deb
```

## Notes

- Works on Plasma X11 and Plasma Wayland sessions alike, since keyd remaps at
  the evdev layer.
- KDE neon is Ubuntu-based and follows the same path; the app detects it via
  `ID_LIKE` in `/etc/os-release`.
