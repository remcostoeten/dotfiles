# Debian / Ubuntu packaging

The `.deb` is produced by Tauri's bundler and already includes the privileged
helper and the polkit policy (see `bundle.linux.deb.files` in
`src-tauri/tauri.conf.json`):

```sh
pnpm install
cargo build --release --manifest-path src-tauri/Cargo.toml -p keybind-helper
pnpm tauri build --bundles deb
```

Output lands in `src-tauri/target/release/bundle/deb/`.

Declared dependencies: `keyd`, `policykit-1`. On releases where `keyd` is not
in the configured repositories, the app shows verified build-from-source
instructions instead of adding third-party repositories.

## Uninstall behavior

Removing the package does not delete `/etc/keyd/keybind-manager-*.conf`, so an
uninstall never silently reverts the user's active keyboard layout. Remove the
managed files manually (or via the app before uninstalling) if the mappings
should go away:

```sh
sudo rm /etc/keyd/keybind-manager-*.conf && sudo systemctl reload-or-restart keyd
```

## AppImage caveat

The AppImage target runs the GUI fine but cannot install the polkit policy or
the privileged helper into `/usr`. Apply/rollback therefore requires a native
package (or manually installing `keybind-manager-helper` and the policy file).
The AppImage documents this limitation on the Diagnostics tab.
