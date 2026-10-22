# Wails to Tauri migration plan

## Purpose

Replace the Wails runtime and Go backend with Tauri v2 and Rust while preserving the current React experience. This document is an execution plan, not a request to begin the migration.

## Current architecture

- The frontend is a Vite and React application in `frontend/`.
- `frontend/src/lib/api.ts` is the hand-written boundary between React and generated Wails bindings in `frontend/wailsjs/`.
- The Go `App` exposes commands for system information, package management, and install processes.
- The frontend receives three Wails events: `install:start`, `install:line`, and `install:exit`.

## Migration constraints

- Do not import Tauri directly from React components. `api.ts` remains the only frontend transport boundary.
- Do not remove Wails or generated `wailsjs` bindings until Tauri reaches feature parity and passes the acceptance checks below.
- Preserve the existing user-facing command names and event payloads where possible. A deliberate contract change requires a matching UI update and test.
- Keep the first migration target Linux desktop. Do not claim mobile support unless it is explicitly implemented and tested.

## Phase 0: Baseline and contract inventory

1. Create a dedicated migration branch.
2. Record the current Wails, Go, Node, and package-manager versions.
3. Run and record the existing frontend build and Go tests before changes.
4. Add contract tests around `api.ts` or document each operation in a machine-readable table before swapping its implementation.
5. Capture manual baseline behavior for package operations on a Linux machine.

### Frontend command contract

The Tauri adapter must preserve these `api.ts` functions unless a later task explicitly changes the frontend contract.

| Domain | Operations |
| --- | --- |
| System | `systemInfo`, `catalog`, `checkPresence` |
| Installation | `runInstall`, `runUninstall`, `verifyInstall`, `cancelInstall` |
| Packages | `packagesLoad`, `packagesSave`, `packagesImport`, `packagesPickFile`, `packagesInstall`, `packagesRun`, `packagesUninstall`, `packagesVerify`, `packagesCheckSource`, `packagesInstallAURHelper` |

### Frontend event contract

| Event | Payload | Required behavior |
| --- | --- | --- |
| `install:start` | `{ kind, id, command }` | Emitted once when an install process starts. |
| `install:line` | `string` | Emits process output in display order. |
| `install:exit` | `{ code, ok }` | Emitted once when the process ends or fails to start. |

## Phase 1: Add a Tauri v2 shell beside Wails

1. Add `src-tauri/` without changing the existing Wails build path.
2. Use `src-tauri/src/main.rs` only as a thin entry point and place application setup and commands in `src-tauri/src/lib.rs`.
3. Configure the existing Vite scripts as Tauri's development and build steps.
4. Add a minimal `capabilities/default.json` for the main window and events.
5. Add Tauri development and production scripts following the project's existing script conventions.
6. Confirm that the existing React frontend starts in a blank Tauri shell.

### Tauri implementation rules

- Register every command in `tauri::generate_handler!`.
- Use owned parameters for asynchronous commands.
- Return `Result<T, AppError>` from Rust commands.
- Keep long-running or blocking process work off the main thread.
- Use managed state for install cancellation.
- Add capabilities before relying on a Tauri plugin or API.

## Phase 2: Create the Tauri adapter behind `api.ts`

1. Replace generated Wails function imports with `invoke` from `@tauri-apps/api/core`.
2. Replace Wails event subscriptions with Tauri listeners while preserving the unsubscribe functions returned by `onInstallStart`, `onInstallLine`, and `onInstallExit`.
3. Remove dependencies on generated Wails model classes by keeping frontend-owned DTO types in `api.ts`.
4. Convert and validate command input at the adapter boundary.
5. Add adapter-level tests for command names, argument shapes, response shapes, event decoding, and listener cleanup.

The first adapter implementation may be guarded by a build-time runtime flag so Wails remains available for comparison. Do not maintain two independent UI implementations.

## Phase 3: Port the backend in vertical slices

Complete one slice, including automated tests and manual verification, before starting the next one.

### Slice A: System information and catalog

- Port `SystemInfo`, `Catalog`, and `CheckPresence`.
- Serialize Rust responses to the current frontend shapes.
- Verify all fields shown by the system-information panel.

### Slice B: Package manifest persistence

- Port manifest parsing, validation, normalization, loading, saving, and import.
- Port the package-file picker with a Tauri dialog integration.
- Preserve malformed-manifest errors and import merge behavior.

### Slice C: Installation and process lifecycle

- Port install, uninstall, verification, source checking, AUR-helper setup, and category runs.
- Replace Go process management with Rust child-process handling.
- Implement cancellation through managed application state.
- Emit the three installation events with the documented payloads and ordering.
- Test success, command failure, cancellation, unavailable package managers, and a process that fails to start.

## Phase 4: Permissions, packaging, and security review

1. Start with `core:default` and explicit event permissions.
2. Add the dialog capability required for package-file selection.
3. Decide whether package commands run through Rust's process APIs or a Tauri shell plugin. If a plugin is used, scope executable names and arguments as narrowly as feasible.
4. Do not grant broad filesystem access merely to read and write the package manifest; use application paths or a tightly scoped capability.
5. Review every privilege boundary around `sudo` and package-manager commands before release.
6. Configure Linux bundling and verify the produced package on a clean test machine or container where feasible.

## Phase 5: Parity verification

The migration is ready to switch only when all conditions are true:

- The frontend builds successfully with the Tauri runtime.
- Rust tests cover each command family.
- The existing Go test cases have equivalent Rust coverage or an explicit, reviewed rationale for any removed behavior.
- Every `api.ts` operation has a working Tauri implementation.
- All three frontend events have verified payloads, ordering, and cleanup.
- Install cancellation terminates the child process and leaves the UI in a usable state.
- Package load, save, import, install, uninstall, and verify work against a real configuration.
- The app packages and launches without the Wails runtime.

## Phase 6: Cutover and cleanup

1. Make the Tauri scripts the default development and production paths.
2. Keep Wails only for one agreed stabilization period and define a rollback decision owner.
3. Remove Wails configuration, Go code, generated `wailsjs` bindings, and obsolete dependencies only after the stabilization period succeeds.
4. Update the README, developer setup, release process, and continuous integration for Tauri.

## Suggested work breakdown

| Milestone | Deliverable | Exit criterion |
| --- | --- | --- |
| M0 | Baseline and contract inventory | Current behavior and tests are recorded. |
| M1 | Tauri shell | Existing frontend runs in Tauri. |
| M2 | Tauri `api.ts` adapter | UI uses the Tauri adapter without direct Tauri imports. |
| M3 | System and package persistence | Read/write/import behavior matches Wails. |
| M4 | Process operations | Progress, errors, and cancellation match Wails. |
| M5 | Release candidate | All Phase 5 checks pass and a package launches. |
| M6 | Cleanup | Wails is removed after stabilization. |

## Decisions required before implementation

- Is the target Linux-only, or must the new architecture support other desktop platforms from the first release?
- Must the current Go implementation be ported directly, or may package behavior be redesigned while preserving the UI contract?
- What is the preferred release and rollback strategy during the period where both runtimes exist?
- Which application paths and user-selected directories may the new backend read or write?
