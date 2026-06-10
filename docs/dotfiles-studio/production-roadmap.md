# Dotfiles Studio production roadmap

This roadmap describes what is needed before Dotfiles Studio can honestly be
called production-ready as a graphical installer and dotfiles bootstrapper.

The current app is a usable MVP. It detects the machine, shows a resolved
catalog, streams `setup.sh`, and now exposes distro-aware command previews.
Production readiness requires stronger installer contracts, better privilege
handling, clearer failure recovery, packaging, and distro validation.

## Product definition

Dotfiles Studio is production-ready when a user on a supported Linux distro can
launch the app, understand exactly what will run, install selected sections or
items, recover from failures, and trust that the UI reflects the actual
installer behavior.

The app must not imply support where the script cannot deliver it. If a package
is unavailable, skipped, risky, or distro-specific, the UI must say so before
the user starts an install.

## Supported platforms

### Tier 1

Tier 1 platforms should be tested before every release:

- Ubuntu LTS
- Debian stable
- Arch Linux
- EndeavourOS or another common Arch derivative

### Tier 2

Tier 2 platforms should be best-effort with clear caveats:

- Linux Mint
- Pop!_OS
- Zorin OS
- Manjaro
- CachyOS

### Unsupported

Unsupported platforms should still show useful diagnostics:

- Fedora
- openSUSE
- NixOS
- Alpine
- immutable distros such as Fedora Silverblue

For unsupported platforms, install buttons must be disabled unless a specific
installer path exists.

## Release gates

### Alpha

Alpha means the app is useful for the repo owner and safe enough for local
iteration.

Required:

- App launches from source with `wails dev`.
- App builds with `wails build`.
- Catalog resolves package manager, distro family, package name, command
  preview, and availability.
- Dry-run mode works for full setup, categories, and packages.
- Install logs stream into the UI.
- Running install can be cancelled.
- Unsupported package manager disables install actions.

### Beta

Beta means a technically comfortable user can run it on a supported distro.

Required:

- Privilege flow works from a desktop launch.
- Every catalog item has a verified presence check.
- Every category has a dry-run summary.
- Per-item and per-category failure states are persisted for the session.
- Failed installs can be retried without restarting the app.
- The app distinguishes skipped, unavailable, installed, missing, running,
  failed, and succeeded states.
- There is a documented support matrix.
- Basic automated tests cover distro resolution and command previews.

### Release candidate

Release candidate means the app is ready to hand to users without standing next
to them.

Required:

- Packaged artifact is produced for at least AppImage or deb.
- Release artifact includes version metadata.
- CI runs Go tests, frontend build, lint/type checks, and package build.
- Smoke tests run in containers for Ubuntu, Debian, and Arch.
- Installer output is structured enough for reliable UI state.
- Destructive or broad actions require confirmation.
- App has a first-run warning that explains what setup can change.
- Recovery instructions are available from the UI after failures.

### Stable

Stable means repeated installs across supported platforms are predictable.

Required:

- Signed or checksumed release artifacts.
- Versioned installer/catalog contract.
- Migration strategy for changed catalog IDs.
- Regression test suite for supported distros.
- Crash/error reporting path that does not leak secrets.
- Release notes for changed install behavior.
- Clear rollback and backup story for config changes.

## Architecture work

### 1. Single source of truth for catalog

Current risk: the Go catalog mirrors `setup.sh` manually. That can drift.

Target:

- Move package/category metadata to a machine-readable manifest, for example
  `setup/catalog.yaml` or `setup/catalog.json`.
- Let both `setup.sh` and the Wails backend read the same metadata.
- Keep shell functions for imperative installers, but declare their public
  package IDs in the manifest.

Manifest should include:

- category ID
- category label
- category description
- item ID
- item label
- installer method
- supported distro families
- package name per distro family
- presence checks per distro family
- required commands
- privilege requirement
- destructive behavior flag
- post-install notes

Acceptance criteria:

- Adding a package in one place updates both CLI and GUI.
- A test fails if `setup.sh --package` accepts an ID missing from the manifest.
- A test fails if the manifest declares an ID the script cannot install.

### 2. Installer capability API

Current risk: the GUI infers what will happen.

Target:

- Add `setup.sh --describe --json`.
- Add `setup.sh --category <id> --dry-run --json`.
- Add `setup.sh --package <id> --dry-run --json`.

JSON should report:

- detected distro
- package manager
- supported status
- planned commands
- skipped steps
- warnings
- required privileges
- estimated affected files

Acceptance criteria:

- The GUI command preview comes from installer output, not duplicated Go logic.
- Dry-run JSON is stable enough to snapshot-test.
- Human log output and machine JSON can coexist without breaking each other.

### 3. Structured install events

Current risk: the UI only sees text logs and an exit code.

Target:

- Emit structured install events from `setup.sh`.
- Keep plain logs for terminals.
- Let the Wails app parse event lines such as JSON prefixed by a sentinel.

Event types:

- `step:start`
- `step:skip`
- `step:success`
- `step:failure`
- `package:start`
- `package:success`
- `package:failure`
- `category:start`
- `category:success`
- `category:failure`
- `sudo:required`
- `backup:created`

Acceptance criteria:

- UI can mark one failed item inside a category install.
- UI can show which step is currently running.
- UI can retry failed package IDs after a category failure.

## Privilege model

Current risk: desktop-launched installs can fail because `sudo` has no terminal
prompt.

Target behavior:

- Detect whether passwordless sudo is available.
- Detect whether a polkit agent is available.
- Prefer `pkexec` for desktop privilege prompts where appropriate.
- Fall back to launching a terminal command if neither passwordless sudo nor
  polkit is usable.
- Explain the selected privilege path before install.

Implementation options:

- Short term: block privileged installs unless passwordless sudo is available,
  with a clear command to enable it.
- Medium term: support `pkexec` helper for privileged package-manager commands.
- Long term: split privileged operations into a minimal helper with a narrow
  command allowlist.

Acceptance criteria:

- A GUI launch can install packages on Ubuntu without pre-opening a terminal.
- A GUI launch can install packages on Arch without pre-opening a terminal.
- The app never hangs invisibly waiting for a sudo password.
- The user can see why an install is blocked.

## Distro support

### Package manager mapping

Required package managers:

- `apt`
- `pacman`

Future candidates:

- `dnf`
- `zypper`
- `apk`

For each supported package manager, define:

- install command
- package presence command
- update/cache command
- repository setup support
- package name mapping
- known unavailable packages

Acceptance criteria:

- Package mapping tests cover every catalog item on `apt` and `pacman`.
- Skipped packages are explicit and visible.
- Unsupported package managers disable install actions with a clear reason.

### Presence checks

Current risk: binary names do not always match package IDs.

Required checks:

- `fd-find`: `fdfind` on Debian, `fd` on Arch
- `bat`: `batcat` on Debian, `bat` on Arch
- `gh`: package is `github-cli` on Arch, binary is `gh`
- `vscode`: package may be `code`, binary is `code`
- `docker.io`: package maps to `docker` on Arch, binary is `docker`
- `rustup`: check `rustup`, `rustc`, or `cargo`
- `python3-pip`: check `pip3` or package database

Acceptance criteria:

- Installed dots are reliable on Ubuntu, Debian, and Arch.
- Items without a meaningful binary check show `managed` or `package check`
  instead of pretending to know.

### Desktop support

Desktop configuration must be separated from package installation.

Supported desktop targets:

- GNOME
- KDE Plasma
- Hyprland

Required behavior:

- Detect current desktop.
- Show only relevant desktop actions by default.
- Allow advanced users to reveal other desktop targets.
- Dry-run desktop changes before applying.

Acceptance criteria:

- GNOME users are not shown KDE changes as a normal install path.
- Hyprland package/config flow is clearly separate from GNOME/KDE theming.
- Desktop actions list affected files/settings.

## UX requirements

### Main catalog

The catalog must show:

- category name
- category support status
- section command preview
- item install method
- item package name for current distro
- item command preview
- installed/skipped/unavailable/running/failed/succeeded state
- whether sudo or network access is required

### Install flow

Before install:

- show summary of planned actions
- show unsupported/skipped items
- show privilege path
- show whether dry-run is enabled

During install:

- show current category
- show current item
- stream logs
- show structured progress
- allow cancel

After install:

- show succeeded items
- show failed items
- show skipped items
- show retry actions
- refresh presence checks
- preserve logs until the user clears them

### Failure recovery

Failures must be actionable.

Required:

- Store last install result in memory.
- Show failed package ID, method, command, and exit code.
- Provide retry button for failed packages.
- Provide copyable/manual command.
- Link to relevant logs inside the app.

Acceptance criteria:

- A failed Spotify install on a system without snap says snap is missing.
- A failed pacman package shows the exact package name.
- A cancelled install is not displayed as a normal failure.

## Safety requirements

### Dry-run correctness

Dry-run must not mutate system state.

Acceptance criteria:

- Dry-run never runs package install commands.
- Dry-run never creates symlinks.
- Dry-run never edits desktop settings.
- Dry-run still reports skipped and unsupported steps.

### Backup and rollback

For config-changing operations:

- create backups before replacing files
- report backup paths to UI
- keep a rollback manifest
- support rollback of the most recent apply operation

Acceptance criteria:

- Any file replacement has a recorded backup path.
- UI can show what changed and where the backup is.

### Confirmation boundaries

Require confirmation for:

- full setup
- driver installation
- desktop setting changes
- Docker group/user changes
- passwordless sudo setup
- deleting or replacing existing config files

Acceptance criteria:

- High-impact actions cannot start from a single accidental click.

## Testing plan

### Unit tests

Go tests:

- distro family detection
- package manager detection fallback
- package-name mapping
- presence-check aliases
- command preview generation
- unsupported package manager behavior

Frontend tests:

- installed/skipped/unavailable rendering
- disabled buttons for unsupported items
- install lifecycle state transitions
- log console behavior

### Integration tests

Use containers where possible:

- Ubuntu LTS
- Debian stable
- Arch Linux

Each container should run:

- `setup.sh --dry-run`
- `setup.sh --category <id> --dry-run`
- `setup.sh --package <id> --dry-run`
- manifest/script consistency checks

### Manual smoke tests

Before release, manually test:

- launch from terminal
- launch from desktop file
- dry-run full setup
- dry-run one category
- dry-run one package
- cancel install
- unsupported package manager simulation
- missing sudo simulation
- missing snap simulation

## Packaging and release

Required artifacts:

- AppImage or tarball for generic Linux
- deb package for Ubuntu/Debian
- optional pacman package or PKGBUILD

Release metadata:

- app version
- git commit
- setup catalog version
- supported distro matrix
- changelog
- checksum file

CI should run:

- `go test ./...`
- frontend type check and build
- `wails build`
- shellcheck for setup scripts
- dry-run smoke tests in containers

## Observability and diagnostics

The app should expose:

- app version
- setup script path
- workspace root
- detected distro
- package manager
- sudo/polkit state
- last install log
- last install result

Diagnostics export should redact:

- usernames in paths where possible
- environment secrets
- tokens
- SSH material

Acceptance criteria:

- A user can send one diagnostics file after failure.
- The file contains enough context to reproduce installer resolution.

## Documentation

Required docs:

- supported distro matrix
- install methods by package
- privilege model
- dry-run behavior
- backup and rollback behavior
- troubleshooting guide
- release checklist

The app should link to local docs when possible.

## Milestone plan

### Milestone 1: Honest catalog

Status: partly implemented.

Remaining:

- Move catalog to shared manifest.
- Add consistency tests.
- Add JSON describe/dry-run output from `setup.sh`.
- Replace Go-side command inference with installer-provided plans.

### Milestone 2: Reliable install state

Build:

- structured installer events
- per-item state model
- retry failed package flow
- persisted session result
- clearer cancel handling

### Milestone 3: Desktop-safe privileges

Build:

- sudo/polkit capability detection
- blocked-state UI for privileged installs
- pkexec or terminal fallback
- confirmation flow for high-impact actions

### Milestone 4: Distro validation

Build:

- container dry-run matrix
- apt/pacman manifest tests
- package availability reporting
- support matrix doc

### Milestone 5: Packaging

Build:

- CI build workflow
- AppImage or tarball artifact
- deb artifact
- checksums
- release notes

### Milestone 6: Config safety

Build:

- backup manifest
- rollback action
- affected-files preview
- desktop setting dry-run details

## Open decisions

- Whether to keep `setup.sh` as the primary installer or move install execution
  into Go with shell scripts only for complex package-specific steps.
- Whether passwordless sudo should be a supported app-managed setup path or
  only documented as an advanced option.
- Whether Spotify should remain snap-based or have distro-specific alternatives.
- Whether VS Code on Arch should use repository `code`, AUR `visual-studio-code-bin`,
  or a documented manual path.
- Whether drivers belong in the default catalog or in an advanced/hardware tab.

## Non-goals for first stable release

- Remote machine management.
- Cloud sync.
- Generic arbitrary command runner.
- Full dotfiles editor.
- Multi-user system administration.
- Support for every Linux distro.
