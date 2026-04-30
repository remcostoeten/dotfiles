# UI agent working contract

This document gives UI agents the rules for building and changing Dotfiles
Studio. Use it when creating screens, components, state flows, and visual
patterns for the Tauri desktop app.

## Mission

Build the interface for a local-first dotfiles manager. The UI helps users
inspect, edit, preview, diff, and manage real configuration files without hiding
the filesystem and git behavior underneath.

The app must feel like a desktop developer tool. Prioritize compact layouts,
clear hierarchy, keyboard-driven workflows, and accurate state over decorative
presentation.

## Non-goals

The UI agent does not own privileged machine behavior.

- Do not read or write files directly from React components.
- Do not call raw Tauri `invoke` from view components.
- Do not create a generic shell execution UI.
- Do not make SQLite or frontend state the source of truth for file contents.
- Do not replace raw editing with structured forms.
- Do not show secret files by default.
- Do not offer apply actions without a visible diff and backup summary.

## Product shape

The primary workspace has five persistent regions:

- Global sidebar for top-level sections.
- Explorer pane for modules, files, and bindings.
- Central editor area with tabs and Monaco.
- Inspector or preview pane for metadata and structured views.
- Bottom panel for diffs, problems, git status, watcher events, and logs.

Primary sections:

- Workspace
- Modules
- Profiles
- History
- Preview
- Settings

## UI entities

Use these names consistently in component props, labels, and model types:

- `Workspace`
- `Module`
- `File`
- `Binding`
- `Profile`
- `Draft`
- `ValidationResult`
- `HistoryEntry`

Binding modes:

- `symlink`
- `copy`
- `fallback`
- `unbound`
- `missing`

## State boundaries

Use command and event wrappers from `src/lib/commands` and `src/lib/events`.
Do not call backend commands directly in leaf components.

Use local component state for:

- hover state
- open menus
- selected tabs inside a local panel
- temporary form input
- drag state

Use feature state for:

- active workspace
- selected module
- open file tabs
- dirty files
- conflict banners
- bottom panel selection
- watcher event stream

Use backend state for:

- file contents
- filesystem metadata
- symlink resolution
- git status
- profile resolution
- validation results

## Component rules

Prefer feature folders over type-only folders. A component that exists only for
the editor belongs near the editor feature.

Use these component categories:

- `Shell` components define app frame and persistent regions.
- `Feature` components own product behavior for a domain.
- `Panel` components render bounded workspace regions.
- `Primitive` components are reusable controls with no product behavior.

Keep components small enough that their data dependencies are obvious.

## Interaction rules

Opening a file must:

1. Read content through the file command wrapper.
2. Create or reuse a Monaco model for the canonical file URI.
3. Store the base content hash with the tab.
4. Mark the tab clean until local edits occur.
5. Show file metadata in the inspector.
6. Show tracked, modified, or untracked state when git data is available.

Saving a file must:

1. Send the current content and expected hash to `write_file_atomic`.
2. Show a conflict state if the backend reports a hash mismatch.
3. Refresh the tab hash after a successful write.
4. Refresh git status for the workspace.

External file changes must:

1. Update explorer badges.
2. Mark open tabs as stale when needed.
3. Offer reload, compare, and overwrite actions for conflicts.

Applying a module change must:

1. Show the apply plan before any write happens.
2. Show the target live paths and backup paths.
3. Show git state for affected files.
4. Show dependency and validation warnings.
5. Require a deliberate user action to continue.

## Visual rules

Build a dense desktop tool, not a marketing page.

- Use split panes, compact toolbars, tabs, lists, inspectors, and bottom panels.
- Keep cards rare and only use them for repeated items, dialogs, or framed
  tools.
- Show state with badges, icons, color accents, and concise labels.
- Keep empty states useful and compact.
- Use Monaco for raw editing and diff views.
- Keep structured previews adjacent to raw file context.
- Show filesystem paths directly when they affect trust or recovery.

## Accessibility rules

The UI must support keyboard-heavy use.

- Keep focus visible in panes, trees, tabs, menus, and dialogs.
- Preserve logical tab order across the shell.
- Add command palette actions for common workflows.
- Add labels or tooltips for icon-only buttons.
- Do not rely on color alone for file status.

## Performance rules

The app can become large, so avoid full-tree rerenders.

- Virtualize large file lists and event logs.
- Lazy-load Monaco.
- Reuse Monaco models per file URI.
- Dispose Monaco models when tabs close.
- Debounce noisy watcher updates before rendering them.

## Change checklist

Before finishing a UI change, verify:

- The change keeps privileged behavior behind command wrappers.
- Dirty, loading, empty, error, and conflict states are represented.
- The layout remains usable at narrow desktop widths.
- The UI does not hide repo path, live path, or binding mode when they matter.
- Apply flows include a diff, backup path, and git state summary.
- Keyboard navigation still reaches the changed controls.
