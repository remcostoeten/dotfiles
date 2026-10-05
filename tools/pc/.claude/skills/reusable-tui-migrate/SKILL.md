---
name: reusable-tui-migrate
description: Migrate an existing Go CLI onto the reusable-tui framework — scaffold a project from the template, move the old CLI's domain logic into packages, turn its subcommands into modules (routes, commands, key bindings, status items), keep headless flags working, and finish with green tests. Use whenever the user wants to "port", "migrate", "move", "convert" or "rebuild" a Go CLI/tool into this TUI framework or into a project scaffolded from it, or asks how to give an existing Go command-line tool a TUI using this template.
---

# Migrate a Go CLI onto reusable-tui

[reusable-tui](https://github.com/remcostoeten/reusable-tui) is a **template, not a library**. A migration never imports it into the old CLI. It scaffolds a new project and moves the old CLI's logic in.

## 0. Gather inputs

Ask only for what is missing:

- **Old CLI path**: the directory of the existing Go CLI.
- **Target directory**, **module path** and **binary name**. Default to the old CLI's module path and binary name so installs and imports keep working.
- **Headless usage**: whether scripts or cron call the old CLI non-interactively. The default answer is yes, so its flags and subcommands must keep working.

## 1. Locate or create the project

Check where you are:

- **Scaffolded project** (`internal/app/register.go` exists and `cmd/create-tui` does not): migrate here and skip to step 2.
- **reusable-tui template repo** (`cmd/create-tui` exists): scaffold first, keeping the demo modules as reference:

  ```sh
  go run ./cmd/create-tui -local . -demo -module <module> -name <name> -y <target-dir>
  ```

- **Anywhere else**, typically the old CLI's own repo after installing this skill with `npx skills add remcostoeten/reusable-tui`: scaffold from GitHub into a **sibling** directory:

  ```sh
  go run github.com/remcostoeten/reusable-tui/cmd/create-tui@latest -demo -module <module> -name <name> -y <target-dir>
  ```

  If `@latest` fails because no tag has been published yet, append `-ref <default branch>` (for example `-ref master`).

In both scaffold cases, continue working in `<target-dir>`. If the target sits inside the old CLI's directory, or would overwrite it, stop and ask.

## 2. Learn the framework before writing code

Read these files in the project. They are the source of truth, and this skill only summarises them.

- `README.md`: layout and keys.
- `internal/app/register.go`: the module list, with one line per module and module state built here.
- `internal/tui/core/registry/registry.go`: `Module`, `Registrar`, `Context`, `View`, and `Services`/`Get[T]`.
- `internal/tui/command/command.go`: `Command{ID, Title, Category, Description, Keywords, Dangerous, When, Run}`.
- The demo modules, each a reference for one pattern:
  - `home`: a view with focus regions, layout, panels and a scroll area.
  - `manager`: a master-detail screen with commands, key bindings, `navigation.Push`, a confirm dialog through `overlay.Ask`, toasts through `registry.Notify`, and a status item.
  - `settings`: config-backed state.
- `internal/tui/ui`: the widget set. Use these widgets before writing new ones.
- `cmd/<name>/main.go`: the entrypoint (config, logging, `app.Build`, `runtime.Run`).

Key facts:

- A module is a struct with `ID()` and `Register(*registry.Registrar)`. It registers `Route` (a screen), `Command` (a verb), `Bind` (a key that points at a command ID), `StatusItem`, `Service` and `Subscribe` (background producers such as tickers and watchers).
- Commands appear in the palette, the help overlay and the key hints automatically. Never list them anywhere else by hand.
- Views are immutable-style: `Update` copies the view, changes the copy and returns it. `Render` records region rects, and `FocusRegions` declares the focus ring.
- `internal/tui` is the shell. Do not edit it. `internal/tui/boundaries_test.go` fails if the shell imports a module.

## 3. Survey the old CLI and propose a mapping. Stop for approval.

Read the old CLI: its entrypoint, flag and command library (cobra, urfave/cli, flag, kong), subcommands, config files, env vars, output formats and long-running operations.

Present a mapping table and **wait for the user to confirm it** before writing code:

| Old CLI | New home |
| --- | --- |
| `tool list`, `tool show <id>` | module `items`: list route, plus detail route through `navigation.Push` |
| `tool delete <id>` | command `items.delete`, `Dangerous: true`, confirmed with `overlay.Ask` |
| `tool sync` (slow) | command running a `tea.Cmd`, with a progress status item and a toast on completion |
| `--config`, `TOOL_*` env | `internal/<domain>/config`, passed to modules through `app.Deps` |
| `tool sync --json` (scripts) | stays headless in `cmd/<name>/main.go` |

Also list what has no natural screen, and propose to keep it headless-only.

## 4. Migrate in this order

1. **Domain first.** Move non-UI logic into `internal/<domain>/...` packages, keeping the code as close to unchanged as possible. Strip `fmt.Print*` and `os.Exit` out of the logic, and return values and errors instead. Carry the old tests over and make them pass before any UI exists.
2. **Headless path.** In `cmd/<name>/main.go`, when the arguments name a subcommand or a headless flag, run the domain function, print the result and exit **before** `app.Build`. Preserve the old flag names, output formats and exit codes exactly. Only a bare invocation (or an explicit `tui` subcommand, if the old CLI already used bare invocation for something) opens the TUI. Keep the framework's own flags (`-theme`, `-log-level`).
3. **Modules.** Create one directory per feature under `internal/modules/`, and add one line per module in `register.go`. Wire dependencies through `app.Deps` and constructor arguments. Use `Services` only when two modules truly share something.
4. **Async work.** Anything slow (network, disk, subprocess) runs in a `tea.Cmd` and reports back with a message. Never block `Update`. Use `Subscribe` for watchers and tickers.
5. **Errors and feedback.** Show errors through `registry.Notify(ui.Toast{Severity: ...})` or an empty or error state in the view, never by printing. Destructive verbs set `Dangerous: true` and ask for confirmation.
6. **Remove the demo.** Delete `home`, `manager` and `settings` and their lines in `register.go`, unless the user wants to keep settings. Check that nothing else imports them.

## 5. Verify

Run the following and fix everything before reporting done:

```sh
go build ./... && go vet ./... && go test ./...
make lint   # skip with a note if golangci-lint is not installed
```

- `TestBuildSucceeds` catches duplicate routes, malformed bindings and keymap conflicts. Resolve a conflict by changing the new binding, never by editing the shell.
- Golden tests: re-record them only for intentional UI changes (`go test ./... -update`), then review the diff.
- Test the headless path by running the old CLI's common commands against the new binary and comparing output and exit codes.
- Test the TUI with `make run`. Check every route, `ctrl+k` to confirm the migrated commands are listed, `?` for help, and `ctrl+t` through the `ascii` theme, which must stay usable with no colour.

## 6. Report

Give the mapping as built, any behaviour that changed on purpose, any old features not yet migrated, and the check results.
