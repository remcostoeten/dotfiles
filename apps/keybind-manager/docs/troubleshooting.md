# Troubleshooting

## The header says "keyd not installed"

Install keyd (Diagnostics tab shows the exact commands for your
distribution), then enable it:

```sh
sudo systemctl enable --now keyd
```

## Apply fails with "authorization was cancelled or denied"

The polkit prompt was dismissed, or the policy file is missing. Check:

```sh
ls /usr/share/polkit-1/actions/org.remcostoeten.keybind-manager.policy
ls /usr/bin/keybind-manager-helper
```

Both are installed by the native packages; the AppImage cannot provide them.

## Apply reports "rolled back"

keyd failed to reload the new configuration, and the previous working files
were restored automatically. Check the service log for the parse error:

```sh
journalctl -u keyd -n 20
```

## "was modified outside Keybind Manager"

A managed file under `/etc/keyd` changed since the last apply (manual edit,
other tool). Review it, then either re-import it or use "Overwrite anyway".
Files not named `keybind-manager*.conf` are never touched.

## A mapping works in the GUI preview but not in some app

If keyd applies a mapping, it works everywhere (X11, Wayland, XWayland) —
check `sudo keyd monitor` to confirm events. If two keyd config files match
the same keyboard (e.g. your own `default.conf` with `*` ids and a managed
profile with `*` ids), keyd picks one; scope the profile to specific devices
on the Devices tab.

## Keyboard feels wrong after experimenting

Suspend remapping from the header (stops keyd), or restore the previous
configuration:

```sh
pkexec keybind-manager-helper restore
```

Worst case, remove the managed files entirely:

```sh
sudo rm /etc/keyd/keybind-manager-*.conf && sudo systemctl restart keyd
```

## Escape is remapped and dialogs won't close

All dialogs also close via their ✕ button and the mouse; the capture dialog
never grabs the keyboard globally.
