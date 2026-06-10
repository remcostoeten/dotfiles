# Dotfiles Studio Wails slice 1

This slice adds structure around the bootstrap screen without crossing into
editing yet.

The goal is to prove that the app can inspect the repository, understand a
small set of modules, and show live file bindings in a desktop shell.

## Scope

Build a read-only workspace shell with:

1. A left sidebar for navigation.
2. A module list for the first dotfiles areas.
3. A file binding inspector.
4. A compact bottom panel for git state and validation notes.

This slice should feel like the start of a real manager, but it must not allow
editing or applying changes yet.

## First user journey

1. Launch the app.
2. See the workspace summary from slice 0.
3. Switch from the bootstrap view to the workspace view.
4. Inspect modules like `fuzzel` and `ghostty`.
5. See which files are repo templates, live files, symlinks, or missing.
6. See basic git state for the workspace.

## Non-goals

Do not build these in slice 1:

- raw editing
- save flows
- conflict dialogs
- diff viewer
- apply plans
- package installation
- profile switching
- sync logic

## Backend contract

Expose only these additional backend actions for slice 1:

```text
list_modules(workspaceRoot) -> ModuleSummary[]
list_module_files(workspaceRoot, moduleId) -> FileNode[]
read_binding_state(path) -> BindingSnapshot
git_status(workspaceRoot) -> GitStatus
dependency_status(moduleId) -> DependencyStatus
```

The backend should still keep `scan_workspace` and bootstrap support from slice
0. Slice 1 just adds structure around them.

## Core data

The module summary only needs enough data to power navigation:

```ts
type ModuleSummary = {
  id: string;
  name: string;
  path: string;
  fileCount: number;
  enabled: boolean;
  category: "desktop" | "shell" | "editor" | "terminal" | "tooling" | "other";
};
```

The file node only needs enough data to describe what the app found:

```ts
type FileNode = {
  path: string;
  kind: "file" | "directory" | "symlink" | "missing";
  binding: "symlink" | "copy" | "fallback" | "unbound" | "missing";
  isTracked: boolean;
  isModified: boolean;
};
```

The binding snapshot should explain what the app sees without requiring an
editor:

```ts
type BindingSnapshot = {
  repoPath: string | null;
  livePath: string | null;
  binding: "symlink" | "copy" | "fallback" | "unbound" | "missing";
  state: "clean" | "modified" | "missing" | "unknown";
};
```

## UI contract

The workspace view should have four parts:

- sidebar navigation
- module list
- file and binding inspector
- bottom strip for git and dependency state

The layout must remain compact on smaller desktop windows. The point is to show
the structure of the repo, not to make a decorative dashboard.

## Interaction model

Selecting a module must:

1. Load the module summary.
2. Load its file list.
3. Load binding state for the selected file.
4. Show git status if available.
5. Show dependency checks relevant to that module.

The workspace is still read-only. Clicking items only reveals information.

## Validation rules

Slice 1 should surface these states clearly:

- module exists
- module missing
- file exists only in repo
- file exists only in live config
- file is symlinked
- file is copied
- file is missing
- git is dirty
- git is clean
- dependency missing

Do not hide missing or dirty states behind neutral styling.

## Acceptance criteria

Slice 1 is complete when all of these are true:

1. The app can switch from bootstrap to workspace navigation.
2. The backend lists at least two modules.
3. The UI shows module files and binding mode.
4. The inspector shows repo path and live path when they exist.
5. Git state is visible in the shell.
6. Dependency warnings are visible in the shell.
7. No edit or apply action is exposed yet.

## Implementation order

1. Add the sidebar shell.
2. Add module discovery.
3. Add file and binding summaries.
4. Add git and dependency badges.
5. Add the inspector pane.
6. Keep all actions read-only.

## Next slice

Once this slice works, the next step is to open one real file in Monaco and
make save behavior conflict-aware.

