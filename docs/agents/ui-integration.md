# UI integration contract

This document defines how the Dotfiles Studio UI talks to the Tauri backend.
Use it when adding frontend features that read files, write files, watch paths,
resolve profiles, or show git state.

## Boundary

React components do not own filesystem, git, watcher, or profile behavior. They
call typed wrappers that invoke Tauri commands and subscribe to typed events.

The backend returns domain results and typed errors. The frontend renders those
states without parsing process output or string-matching error messages.

## Command wrappers

Create frontend wrappers under:

```text
src/lib/commands/
```

Initial wrappers:

- `workspaceCommands.scanWorkspace`
- `workspaceCommands.listModuleFiles`
- `fileCommands.readFile`
- `fileCommands.writeFileAtomic`
- `watchCommands.watchPaths`
- `watchCommands.unwatch`
- `gitCommands.status`
- `gitCommands.diffFile`
- `profileCommands.listProfiles`
- `profileCommands.resolveEffectiveView`
- `dependencyCommands.status`
- `applyCommands.createPlan`
- `applyCommands.applyPlan`
- `rofiCommands.validateConfig`
- `rofiCommands.runLauncher`

Leaf components must import these wrappers or feature hooks. They must not call
Tauri `invoke` directly.

## Events

Create frontend event subscriptions under:

```text
src/lib/events/
```

Initial events:

- `fs://changed`
- `fs://watch-error`
- `git://status-changed`
- `profile://effective-view-changed`
- `validation://updated`
- `dependency://status-changed`

Normalize event payloads before they reach React state.

## File payload

`readFile` returns the data needed to render an editor tab and inspector.

```ts
type FilePayload = {
  path: string;
  content: string;
  contentHash: string;
  sizeBytes: number;
  modifiedAt: string;
  format: FileFormat;
  symlink: SymlinkInfo | null;
  binding: Binding | null;
};
```

## Atomic write result

`writeFileAtomic` must require the hash the editor loaded.

```ts
type WriteFileAtomicInput = {
  path: string;
  content: string;
  expectedHash: string;
};

type WriteFileAtomicResult =
  | {
      status: "written";
      path: string;
      newHash: string;
      modifiedAt: string;
    }
  | {
      status: "conflict";
      path: string;
      expectedHash: string;
      actualHash: string;
      diskModifiedAt: string;
    };
```

The UI must never treat a conflict as a successful save.

## Watch event payload

Watch events describe what changed and whether the app caused the change.

```ts
type FileWatchEvent = {
  path: string;
  kind: "created" | "modified" | "removed" | "renamed" | "binding_changed";
  source: "self_write" | "external_write" | "git_operation" | "unknown";
  previousPath?: string;
  contentHash?: string;
  occurredAt: string;
};
```

Open tabs react to events as follows:

- `self_write`: refresh metadata without interrupting the editor.
- `external_write`: mark the tab stale and offer reload, compare, or overwrite.
- `removed`: show a missing-file state.
- `renamed`: update the tab path when the backend can prove the rename.
- `binding_changed`: refresh inspector and explorer binding state.

## Error model

Backend errors must include a stable code.

```ts
type AppError = {
  code:
    | "not_found"
    | "permission_denied"
    | "stale_write"
    | "invalid_path"
    | "not_utf8"
    | "git_error"
    | "watch_error"
    | "unknown";
  message: string;
  path?: string;
  details?: unknown;
};
```

The UI maps error codes to product states:

- `not_found`: missing file state
- `permission_denied`: permissions callout
- `stale_write`: conflict modal
- `invalid_path`: blocked operation message
- `not_utf8`: read-only binary state
- `git_error`: bottom panel git error
- `watch_error`: watcher event log entry

## Save flow

Use this flow for every editor save:

1. Read the active tab content from the Monaco model.
2. Call `fileCommands.writeFileAtomic` with `expectedHash`.
3. If the result is `written`, update the tab hash and clear dirty state.
4. If the result is `conflict`, keep dirty state and open conflict resolution.
5. Refresh git status for the active workspace.

## Conflict flow

A conflict means the disk changed after the editor loaded the file.

The conflict UI must offer:

- reload disk version
- compare disk version with editor draft
- overwrite disk version with current draft
- keep editing without saving

Overwrite must call `writeFileAtomic` again with the latest disk hash.

## Git flow

Git state is advisory in the UI. It must never replace filesystem checks.

Use git for:

- explorer dirty badges
- bottom panel diffs
- file history
- later commit and restore workflows

Do not use git status to decide whether a file write is safe. Use content
hashes from the filesystem.

The UI must surface dirty and untracked git state before apply operations. Git
state is context for recovery and review; filesystem hashes remain the write
safety mechanism.

## Profile flow

Profiles resolve an effective workspace view.

The UI can switch profiles by asking the backend to resolve:

- enabled modules
- path overrides
- ignored files
- live roots
- inherited rules

Switching a profile must not write files unless the user starts an explicit
apply operation.

## Apply plan

Apply operations are two-step. The UI first asks the backend to create a plan,
then asks the backend to apply that exact plan.

```ts
type ApplyPlan = {
  id: string;
  moduleId: string;
  profileId?: string;
  createdAt: string;
  changes: ApplyChange[];
  backups: BackupTarget[];
  gitStatus: GitStatus;
  validationIssues: ValidationIssue[];
  dependencyWarnings: DependencyWarning[];
};
```

The UI must render the plan before enabling apply.

## Rofi commands

Rofi-specific command execution must stay behind module commands.

```ts
type RofiValidationResult = {
  files: ValidationIssue[];
  bangCommands: {
    bang: string;
    type: "url" | "shell" | "terminal" | "command";
    template: string;
    description?: string;
    valid: boolean;
  }[];
};
```

`rofiCommands.runLauncher` can start `bin/launcher` for smoke testing. It must
return dependency errors instead of falling through to a generic shell runner.
