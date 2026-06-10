# Dotfiles Studio Wails architecture

This document describes the Wails-based path for Dotfiles Studio. It is meant
to turn the existing dotfiles and setup automation into a real desktop
executable with a polished UI, while keeping the backend authority local and
small.

## Why Wails

Wails fits this project because the app is local-first and backend-heavy:

- the app needs filesystem access, git, ssh, package managers, and privilege
  checks
- the UI should feel native without shipping Chromium
- the backend can stay in Go, which matches the existing `cmd/df` work and the
  shell-automation style already in the repo
- the frontend can be built with React and TypeScript, which keeps the UI fast
  to iterate

The key architectural rule is simple: the renderer is only a client. All
filesystem writes, command execution, git inspection, and watcher logic live in
Go.

## Product shape

The first executable should cover the full bootstrap and management loop for a
fresh machine:

1. detect the machine state
2. install prerequisites
3. clone or attach the dotfiles repo
4. choose a profile
5. apply packages and config links
6. watch for drift
7. inspect logs, diffs, and conflicts

That gives you a useful app before you attempt every edge case of two-way sync.

## Proposed repo layout

Recommended top-level shape:

```text
apps/dotfiles-studio/
  frontend/
  backend/
  assets/
  build/
  docs/
```

Suggested backend split:

```text
apps/dotfiles-studio/backend/
  cmd/
  domain/
  services/
  adapters/
  events/
  state/
  errors/
```

Suggested frontend split:

```text
apps/dotfiles-studio/frontend/src/
  app/
  features/
    bootstrap/
    packages/
    configs/
    sync/
    logs/
    settings/
  lib/
    api/
    events/
    models/
    state/
```

This keeps the UI, core state, and backend commands separated enough that the
app can grow without collapsing into one giant command file.

## Backend layers

### 1. Domain layer

This is where the app models the world:

- `Workspace`
- `Module`
- `Profile`
- `PackageItem`
- `ConfigItem`
- `SyncTarget`
- `Task`
- `TaskRun`
- `Dependency`
- `Conflict`
- `LogEntry`

These types should be independent of Wails and independent of the renderer.

### 2. Service layer

Services own the actual work:

- workspace detection
- setup plan generation
- package installation
- config linking
- file read/write with conflict checks
- git status and diff
- dependency validation
- log streaming
- profile resolution

Each service should be callable from the UI through a narrow Wails binding, but
the service itself should stay testable without Wails.

### 3. Adapters

Adapters bridge to the real system:

- shell commands
- filesystem reads and writes
- git subprocess calls
- package manager calls
- desktop environment detection
- symlink and backup handling

The goal is to isolate anything unstable or platform-specific in one place.

### 4. Event pipeline

Wails event support should be used for streaming state, not for RPC. Use
bindings for request/response, and events for progress, logs, watcher changes,
and completion notifications.

Example events:

- `task.started`
- `task.progress`
- `task.finished`
- `task.failed`
- `log.appended`
- `workspace.changed`
- `file.changed`
- `git.changed`
- `sync.conflict`

## Backend command surface

The first bindings should be intentionally small:

```text
ScanWorkspace(root) -> WorkspaceSnapshot
ListModules(workspaceID) -> []Module
ListItems(moduleID, kind) -> []PackageItem | []ConfigItem
ReadFile(path) -> FilePayload
WriteFileAtomic(path, content, expectedHash) -> WriteResult
GetGitStatus(root) -> GitStatus
GetGitDiff(root, path) -> GitDiff
GetDependencyStatus(workspaceID) -> DependencyStatus
CreateBootstrapPlan(profileID) -> BootstrapPlan
RunTask(taskID) -> TaskRun
CancelTask(taskRunID) -> CancelResult
GetLogs(taskRunID) -> []LogEntry
WatchPaths(paths) -> WatchRegistration
SetProfile(profileID) -> ProfileResult
GetSettings() -> Settings
UpdateSettings(settings) -> Settings
```

The UI should never ask for arbitrary shell execution. Every action must map to
an explicit command or task.

## Command boundaries

Keep the trust boundary tight:

- the main window can read metadata and request safe actions
- bootstrap actions can install packages only through approved task types
- file writes must be atomic and conflict-aware
- destructive actions must require an explicit user confirmation
- anything needing sudo should be mediated by a dedicated task with a clear
  audit trail

Do not expose a generic shell runner to the renderer.

## UI layout

The UI should feel like a control center, not a marketing page:

- left navigation for Overview, Bootstrap, Packages, Configs, Sync, Logs, and
  Settings
- central workspace for the active view
- right inspector for the selected item
- bottom drawer for live logs and task output

The first screen should show:

- machine summary
- current workspace status
- pending setup tasks
- recent task activity
- visible risk and conflict states

## Bootstrap flow

Bootstrap is the best first executable path because it matches the fresh-machine
problem directly.

Suggested sequence:

1. detect OS, package manager, desktop session, and git availability
2. verify SSH or GitHub auth readiness
3. clone or attach the repo
4. choose a profile or machine preset
5. install essentials
6. apply shell and desktop configuration
7. link configs and verify results
8. surface follow-up actions and warnings

That flow should support:

- retry
- skip where safe
- dry-run
- per-step logs
- post-step validation

## Config and sync model

Two-way sync should be treated as a separate capability from bootstrap.

The app should understand these states:

- repo template
- live file
- linked file
- copied file
- missing file
- modified locally
- conflicted

The sync engine should produce an apply plan before writing anything. The plan
must list:

- files to create, update, delete, or relink
- expected backups
- dependency warnings
- conflicts
- privilege requirements

## Storage model

Use the filesystem as the source of truth for content. Use SQLite only for
metadata and app state:

- cached scans
- watcher state
- recent tasks
- UI preferences
- parse results
- audit events

Do not store config content as the canonical copy in SQLite.

## Frontend contract

The frontend should talk to generated Wails bindings only. Keep a local API
layer in TypeScript so the components never call bindings directly.

Suggested frontend patterns:

- `api/` for typed backend calls
- `events/` for subscriptions
- `models/` for UI-facing data types
- `state/` for view state and selection
- `features/` for each screen area

This keeps the frontend swappable and makes testing easier.

## Logging and progress

Long-running operations must stream progress instead of freezing the UI.

Required behaviors:

- live progress updates for setup tasks
- incremental log append events
- clear success, warning, and failure states
- cancel support for cancellable tasks
- final summary after completion

## Packaging model

The final product should ship as a native desktop executable with a small
installer or archive per platform. The app itself should be the primary entry
point, and the bootstrap flow should still be available from inside the app.

The install story should look like:

1. download the app
2. launch it
3. bootstrap the machine from inside the app
4. keep the app available for ongoing package/config management

## Suggested first milestone

Build the first Wails slice around the `bootstrap` and `packages` screens.
Those two screens prove:

- state inspection
- task execution
- progress events
- logs
- package install paths
- error handling

Once those work, `configs` and `sync` can reuse the same service primitives.

