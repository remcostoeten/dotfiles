# Arch Linux

## Dependencies

```sh
sudo pacman -S keyd
sudo systemctl enable --now keyd
```

keyd is in the official `extra` repository. AUR helpers (`paru`/`yay`) are
detected and shown as an alternative, clearly labeled as community packages —
the app never runs an AUR helper on its own.

## Install Keybind Manager

From the repository:

```sh
cd packaging/arch
makepkg -si
```

This installs:

- `/usr/bin/keybind-manager` (GUI + CLI)
- `/usr/bin/keybind-manager-helper` (privileged helper, only runs via pkexec)
- `/usr/share/polkit-1/actions/org.remcostoeten.keybind-manager.policy`
- desktop entry and icons

## Verify

```sh
keybind-manager status
```

Expected: your distro, `KDE`, session type, keyd version, service enabled and
active. Works identically on Plasma X11 and Plasma Wayland.
