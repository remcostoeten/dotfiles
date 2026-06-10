# Dotfiles Studio implementation plan

This plan describes the first useful build of Dotfiles Studio. It starts with
the fuzzel configuration because the repository already contains a small but
complete local-first workflow: repository templates, live files, fallback
behavior, a launcher script, and a small INI config.

## Scope

The first milestone is a working vertical slice, not full dotfiles coverage.
The app must open, inspect, edit, save, watch, and diff fuzzel files before it
adds profiles, sync, or plugin systems.

The first module is `fuzzel`.

Relevant repository files:

- `bin/launcher`
- `configs/fuzzel/fuzzel.ini`
- `setup/lib/installers.sh`

Relevant live files:

- `~/.config/fuzzel/fuzzel.ini`

Existing setup conventions:

- Setup creates backups under `.dotfiles/setup-backups/<timestamp>` before it
  replaces existing config targets.
- Runtime state can live under `$HOME/.dotfiles` or
  `${XDG_STATE_HOME:-$HOME/.local/state}/dotfiles`.
- The launcher command delegates to `fuzzel` when available and KDE KRunner
  otherwise.

## Product milestone

The first milestone is complete when you can:

1. Launch the desktop app.
2. Select the `fuzzel` module.
3. See repository files and live file bindings.
4. Open `fuzzel.ini` in Monaco.
5. Edit and save the file with conflict detection.
6. Change the same file outside the app and see the UI update.
7. View git status and a diff for the edited file.
8. See tracked, modified, and untracked state before applying changes.
9. See a dependency check for `fuzzel` or KDE KRunner.

## Phase 0: Scaffold the app

Create the app skeleton with Tauri 2, React, TypeScript, and Vite.

Recommended location:

```text
apps/dotfiles-studio/
```

Recommended structure:

```text
apps/dotfiles-studio/
  src/
    app/
    features/
      editor/
      explorer/
      git/
      history/
      preview/
      profiles/
      workspace/
    lib/
      commands/
      events/
      models/
      state/
    styles/
  src-tauri/
    src/
      commands/
      domain/
      infra/
      events/
      error/
    capabilities/
```

The scaffold must include:

- Tauri command invocation wrappers.
- Shared TypeScript types for command payloads.
- A basic shell with sidebar, explorer, editor, inspector, and bottom panel.
- A SQLite initialization path, even if the first tables are minimal.
- A path policy that distinguishes repository roots, live config roots, backup
  roots, and generated state roots.

## Phase 1: Model workspace and fuzzel bindings

Implement the data model that lets the app explain what exists on disk.

Core models:

- `Workspace`
- `Module`
- `FileNode`
- `Binding`
- `FilePayload`
- `GitStatus`
- `ValidationResult`

Binding modes:

- `symlink`
- `copy`
- `fallback`
- `unbound`
- `missing`

For fuzzel, detect:

- repository templates under `configs/fuzzel`
- live files under `~/.config/fuzzel`
- missing live files that fall back to repository templates
- symlinks created by setup
- normal copied files
- tracked, modified, and untracked git state

## Phase 2: Implement safe file reads and writes

Implement these commands:

- `scan_workspace`
- `list_module_files`
- `read_file`
- `write_file_atomic`

`read_file` must return:

- content
- content hash
- file size
- last modified time
- detected format
- symlink metadata

`write_file_atomic` must require:

- path
- new content
- expected content hash

If the expected hash does not match the current file hash, the command must
return a conflict instead of overwriting.

## Phase 3: Add live watching

Implement `watch_paths` and backend-to-frontend events for file changes.

Normalize watcher events into:

- `created`
- `modified`
- `removed`
- `renamed`
- `binding_changed`

The UI must distinguish app writes from external writes. The first version can
track this with a short-lived write marker keyed by path and hash.

## Phase 4: Add git visibility

Add a thin git layer before building a full history UI.

Implement:

- `git_status`
- `git_diff_file`

Show git state in:

- explorer badges
- editor tab dirty state
- bottom panel diff tab
- inspector metadata

Do not implement commit creation until save, diff, and conflict handling feel
reliable.

The UI must show a dirty or untracked repository state before a user applies
changes to live paths. It can warn without blocking during the PoC, but the
state must be visible.

## Phase 5: Add the fuzzel structured preview

Keep Monaco as the primary editor. Add a structured preview for `fuzzel.ini`
after raw editing works.
- `template`
- `description`
- `terminal`

The first preview only needs to show parsed command rows, invalid entries, and
the command that would run for sample query text.

Add a separate smoke-test action for the launcher. It must call a
module-specific backend command that runs `bin/launcher` and reports missing
dependencies. Do not expose arbitrary shell execution from the UI.

## Phase 6: Add profiles

Add profiles after the file and watcher model is stable.

Profile concepts:

- profile name
- inherited profile
- enabled modules
- live root overrides
- ignored files
- machine tags
- secret boundaries

Profiles must resolve an effective view of the filesystem. They must not copy
or rewrite files until the user explicitly applies a change.

Apply plans must include:

- files that will be created, changed, removed, or symlinked
- backup paths
- git status for affected files
- dependency warnings
- validation warnings

## Definition of done

The first release candidate for the fuzzel slice must satisfy these checks:

- Editing a file cannot silently clobber an external change.
- Missing live files are shown clearly as fallback bindings.
- Symlinked files are identified in the inspector.
- The UI can recover after an external file edit.
- Git diff works for the currently open file.
- The raw editor remains available for every supported file.

## Deferred work

These features are important but not part of the first milestone:

- cloud sync
- remote machines
- plugin marketplace
- full profile application engine
- generic shell command execution
- commit creation
- every config module
- structured editors for all formats
