# Dotfiles Studio Wails slice 0

This is the smallest useful Wails version of Dotfiles Studio.

The goal is not to manage every dotfile yet. The goal is to prove that the app
can open as a real desktop executable, inspect the current machine, and start a
single bootstrap action with live feedback.

## Scope

Build one Wails window with three visible areas:

1. A compact workspace summary at the top.
2. One primary action button for the bootstrap flow.
3. A bottom log panel that streams task output.

That is enough to validate the desktop shell, backend binding, event pipeline,
and privilege boundary without building the full editor or sync system yet.

## First user journey

1. Launch the app.
2. See whether a dotfiles workspace is present.
3. See the detected OS and package manager.
4. Click `Start bootstrap`.
5. Watch live progress and logs.
6. See success or failure with a stable error state.

## Non-goals

Do not build these in slice 0:

- file editor
- diff viewer
- sync engine
- profiles
- module browser
- config preview
- conflict resolution UI
- commit or push actions

## Backend contract

Expose only these backend actions for slice 0:

```text
scan_workspace(root) -> WorkspaceSnapshot
run_bootstrap_essentials(root) -> TaskRun
subscribe_task_events(taskRunId) -> stream
cancel_task(taskRunId) -> CancelResult
```

The backend must also return typed errors, at minimum:

- `not_found`
- `permission_denied`
- `command_failed`
- `invalid_workspace`
- `unknown`

## Workspace snapshot

The first scan only needs to return a small summary:

```ts
type WorkspaceSnapshot = {
  root: string;
  repoName: string;
  gitPresent: boolean;
  workspacePresent: boolean;
  packageManager: "apt" | "pacman" | "unknown";
  desktopSession: string | null;
  hasSudo: boolean;
  timestamp: string;
};
```

This is enough to decide whether the machine is ready for bootstrap and to show
the user what the app detected.

## Task model

Treat bootstrap as one cancellable task.

```ts
type TaskRun = {
  id: string;
  name: "bootstrap_essentials";
  status: "idle" | "running" | "success" | "failed" | "cancelled";
  startedAt: string | null;
  finishedAt: string | null;
};
```

The task should emit incremental events:

- `task.started`
- `task.progress`
- `task.log`
- `task.finished`
- `task.failed`

## UI contract

Keep the first screen intentionally small:

- title and app name in the window chrome
- one status strip with detected workspace details
- one large primary button for `Start bootstrap`
- one cancel button that only appears while the task is running
- one log drawer with timestamped lines

The UI should not try to be the full dotfiles manager yet. It should feel like a
control panel for the first install pass.

## Acceptance criteria

Slice 0 is complete when all of these are true:

1. The app launches as a desktop executable.
2. The backend scans the current workspace or reports that none is present.
3. The primary action starts a real bootstrap task.
4. Task progress appears live in the UI.
5. Log output is visible while the task runs.
6. Failures are surfaced through typed UI state, not raw shell output alone.
7. The code path for bootstrap is separate from the UI layer.

## Implementation order

1. Scaffold the Wails project.
2. Add `scan_workspace`.
3. Add the `TaskRun` event stream.
4. Render the summary strip and action button.
5. Wire the log drawer.
6. Add cancel and failure states.

## Next slice

Once slice 0 works, the next step is to add a module list and file state for a
single dotfiles area such as `fuzzel` or `ghostty`.

