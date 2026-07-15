# Architecture

## Crates

```
src-tauri/
  core/     keybind-core        pure logic, no Tauri, fully unit-tested
  helper/   keybind-helper      privileged helper binary (no GUI deps)
  .         keybind-manager     Tauri shell: thin commands + CLI
```

### keybind-core

- `model` — backend-independent configuration model (`AppConfig`, `Profile`,
  `Mapping`, `KeyInput`, `KeyAction`, `Layer`) with schema versioning and
  `migrate()` for forward migrations. Newer schemas are rejected safely.
- `keyd::generate` — deterministic conversion of the model into managed keyd
  files (one per enabled profile: `/etc/keyd/keybind-manager-<id>.conf`).
  Tap+hold pairs merge into `overload(...)`; hold-only becomes `layer(...)`;
  source modifiers become composite layer sections (`[control+alt]`).
- `keyd::parse` — parses managed files back into the model; unknown entries
  are preserved verbatim (`Profile.preserved`) and re-emitted on generation.
- `validation` — duplicate/unknown-key/missing-layer/bad-hold errors and
  dangerous-mapping warnings (essential keys, both Controls, etc.). Errors
  block apply; warnings can be overridden.
- `distro` / `devices` — parsing of `/etc/os-release` and
  `/proc/bus/input/devices` as pure string functions so tests need no system
  access.
- `export` — deterministic TOML bundles (hardware ids stripped by default).

### keybind-helper (runs as root via pkexec)

One fixed action set, no arbitrary input:

- `apply` — JSON payload on stdin `{files, prior, force}`. Validates names
  against `^keybind-manager[a-z0-9.-]*\.conf$`, sizes, and null bytes.
  Detects external modification by comparing prior hashes, backs up existing
  managed files, writes each file atomically (temp file + fsync + rename,
  0600 root:root), reloads keyd, verifies the service is active, and restores
  the backup automatically when verification fails.
- `restore`, `reload`, `enable-service`, `disable-service`, `hashes`.

It never touches files outside `/etc/keyd`, never follows symlinks, and
refuses unmanaged filenames, so `default.conf` or other user configs are
never modified.

### keybind-manager (Tauri shell)

Commands stay thin — every `#[tauri::command]` validates its payload through
`model::migrate` and delegates to `store`, `system`, `applying`, or
`dotfiles`. Errors cross the boundary as structured
`{code, message, detail?, retryable, action?}` objects.

The same binary doubles as the CLI (`export`, `apply`, `validate`,
`status`) for dotfiles-driven workflows.

## Backend abstraction

keyd is the first and primary backend. The generation/parse/apply pipeline is
isolated in `keybind_core::keyd` plus `applying.rs`, so an additional backend
(kanata, xremap, KDE XKB options) plugs in by providing the same
generate/validate/apply surface over the shared normalized model. Frontend
code only ever sees the normalized model, never keyd syntax.

## Apply pipeline

```
validate model ─▶ generate files ─▶ preview (user confirms)
      ─▶ pkexec helper: hash check ─▶ backup ─▶ atomic writes
      ─▶ systemctl reload-or-restart keyd ─▶ verify active
      ─▶ on failure: restore backup ─▶ reload ─▶ report "rolled back"
```

The GUI reports the phases (validating / requesting authorization / writing /
verifying / applied / rolled back / failed) without simulated progress.

## Frontend

SolidJS with fine-grained state:

- `app/utilities/store.ts` — one `createStore` for the draft config plus a
  dirty flag; native data (capabilities, devices, keyd status) lives in
  `createResource`s that are cached for the session.
- `modules/{status,profiles,mappings,devices,settings}` — feature modules per
  the `components/hooks/utilities/types/api` layout.
- Validation runs against the Rust validator on each edit (debounced by
  resource semantics), so the editor and the apply path share one source of
  truth.

The shell renders immediately; backend-derived panels show skeletons until
their resources resolve.
