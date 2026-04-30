# ADR-001: Build Dotfiles Studio as a local desktop app

**Status:** Proposed
**Date:** April 30, 2026
**Deciders:** Remco Stoeten

## Context

Dotfiles Studio needs to manage real dotfiles on a local machine. The app must
read and edit files under the dotfiles repository and live locations such as
`~/.config`, detect symlinks and copied files, watch external changes, show
history, and provide previews for selected configuration formats.

This repository already has the boundaries the app must respect. User-facing
commands live in `bin/`, source templates live in `configs/`, setup and symlink
creation live in `setup/`, and private or machine-specific state lives outside
the public repository. The rofi launcher is the first useful proof of concept:
it reads templates from `configs/rofi`, live files from `~/.config/rofi`, and
falls back to repository files when live files are missing.

Existing setup behavior is also part of the product model. The setup layer backs
up replaced targets under `.dotfiles/setup-backups/<timestamp>` before creating
symlinks. Runtime tools commonly store user state under `$HOME/.dotfiles` or
`$XDG_STATE_HOME/dotfiles`. Dotfiles Studio must surface these conventions
instead of inventing hidden state locations.

## Decision

Build Dotfiles Studio as a local-first desktop app with this stack:

- Use `Tauri 2` for the desktop shell, native commands, filesystem access,
  application capabilities, and packaging.
- Use `React`, `TypeScript`, and `Vite` for the renderer.
- Use `Monaco` for raw editing and diff views.
- Use `SQLite` for local metadata, caches, drafts, UI state, and audit events.
- Use the filesystem as the source of truth for configuration content.
- Use `git` as the durable history and rollback layer.
- Implement privileged behavior in Rust commands exposed through narrow Tauri
  command contracts.
- Use the repository's existing backup and state conventions for apply plans,
  dry runs, and generated metadata.

Do not use Next.js as the primary shell for this app. Tauri can host a static
Next.js export, but this project benefits more from a focused React and Vite
renderer because the server-side parts of Next.js are not the app boundary.

## Options considered

### Tauri 2, React, TypeScript, and Vite

This option keeps native authority in Rust and keeps the renderer focused on
interface work.

| Dimension | Assessment |
| --- | --- |
| Complexity | Medium |
| Local filesystem fit | High |
| Security model | High |
| Desktop packaging | High |
| Frontend velocity | High |

**Pros:**

- Gives the app a clear trust boundary between the renderer and native code.
- Supports scoped permissions and per-window capabilities.
- Keeps the frontend lightweight and compatible with Monaco.
- Avoids server runtime assumptions inside a desktop app.

**Cons:**

- Requires Rust command code and typed frontend wrappers.
- Requires discipline around capabilities and command boundaries.

### Electron, React, and TypeScript

This option gives fast access to Node APIs and a large ecosystem.

| Dimension | Assessment |
| --- | --- |
| Complexity | Medium |
| Local filesystem fit | High |
| Security model | Medium |
| Desktop packaging | High |
| Frontend velocity | High |

**Pros:**

- Familiar Node-based implementation path.
- Strong ecosystem for desktop developer tools.

**Cons:**

- Larger runtime footprint.
- More care required around renderer privileges and IPC.
- Easier to blur the boundary between UI code and machine authority.

### Browser app with local agent

This option uses a web UI that talks to a local daemon or CLI.

| Dimension | Assessment |
| --- | --- |
| Complexity | High |
| Local filesystem fit | Medium |
| Security model | Medium |
| Desktop packaging | Low |
| Frontend velocity | Medium |

**Pros:**

- Keeps a familiar web deployment model.
- Could support remote machines later.

**Cons:**

- Adds daemon lifecycle, authentication, and local networking concerns early.
- Makes offline packaging and trust harder than a desktop shell.
- Pushes the project toward sync and remote concerns before local editing works.

## Consequences

The app must treat the renderer as untrusted. React components can request
operations, but Rust commands own filesystem reads, writes, watches, git calls,
and profile resolution.

The app must not make SQLite the canonical store for file contents. SQLite can
cache parse results, drafts, window state, and audit records, but real dotfiles
remain on disk and git remains the durable history mechanism.

The first implementation slice must prove these behaviors before broader module
support starts:

- Scan `configs/rofi` and `~/.config/rofi`.
- Resolve repository files, live files, and fallback files.
- Open a file in Monaco.
- Save with an expected content hash.
- Detect external changes through a watcher.
- Show git status and a per-file diff.
- Show whether files are tracked, modified, or untracked before applying
  changes.
- Validate rofi dependencies such as `rofi`, `lua`, `rg`, `fd` or `fdfind`,
  `xdg-open`, and the configured terminal.

## Command boundary

The first backend commands are:

- `scan_workspace(root) -> WorkspaceSnapshot`
- `list_module_files(workspace_id, module_id) -> Vec<FileNode>`
- `read_file(path) -> FilePayload`
- `write_file_atomic(path, content, expected_hash) -> WriteResult`
- `watch_paths(paths) -> WatchRegistration`
- `git_status(root) -> GitStatus`
- `git_diff_file(root, path) -> GitDiff`
- `dependency_status(module_id) -> DependencyStatus`
- `create_apply_plan(module_id, profile_id) -> ApplyPlan`

Every command must return typed errors that the UI can render without parsing
strings.

## Write policy

Writes must be atomic and conflict-aware.

1. Read the current disk hash.
2. Compare it with the editor's `expected_hash`.
3. Return a conflict if the file changed externally.
4. Write content to a temporary file in the same directory.
5. Move the temporary file into place.
6. Emit a filesystem event and audit entry.
7. Refresh git status for the affected repository.

## Security policy

Capabilities must stay narrow.

- The main window can scan known workspace roots and read metadata.
- Editor windows can read and write only approved workspace and live config
  roots.
- Admin windows can change roots, profiles, and destructive settings.

Do not expose a generic shell command runner to the renderer.

Rofi bang commands are executable configuration. The app can parse and preview
`bang-commands.lua`, but running a bang command or the launcher must go through a
module-specific command that can show the exact command, target paths, and risks
before execution.

## Next steps

Create the implementation plan in `docs/dotfiles-studio/implementation-plan.md`
and use `configs/rofi` as the first vertical slice.
