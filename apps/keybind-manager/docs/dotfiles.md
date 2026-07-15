# Dotfiles workflow

## Export

In the GUI, open **Dotfiles → Export…** and pick a directory inside your
dotfiles repository (e.g. `~/dotfiles/keyboard`). Or from the CLI:

```sh
keybind-manager export --profile default --dir ~/dotfiles/keyboard
```

This writes:

```
dotfiles/keyboard/
  config.toml    # deterministic, schema-versioned, no timestamps
  install.sh     # idempotent bootstrap, never installs packages silently
```

Hardware ids (vendor:product) are omitted by default so the file is portable;
enable "Include hardware ids" if a profile should stay scoped to a specific
keyboard across machines.

Because the export is deterministic, re-exporting an unchanged config
produces no diff — safe for source control.

## Apply on another machine

```sh
cd ~/dotfiles/keyboard
./install.sh --check     # validate only, non-interactive
./install.sh             # prompts before applying
./install.sh --yes       # deliberate non-interactive apply
```

or directly:

```sh
keybind-manager validate ./config.toml
keybind-manager apply ./config.toml
```

`apply` runs the same validation → generate → atomic write → reload → verify
→ rollback pipeline as the GUI, including the polkit prompt.

## Importing into the GUI

**Dotfiles → Import…** previews the profiles in the bundle (mapping and layer
counts) before anything is merged into the editor, and nothing touches
`/etc/keyd` until you press Apply. The generated root-owned keyd files never
live in your repository — only the portable TOML does.
