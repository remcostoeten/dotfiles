# todo-tui

A todo manager in two parts that share one set of JSON files:

- `cli/`: the Bun `todo` command, written in TypeScript. It owns every write.
- Everything else: the Go taskboard TUI (`bin/todo-tui`), built on
  [reusable-tui](https://github.com/remcostoeten/reusable-tui). It reads the
  files directly and performs every mutation by running the CLI.

`~/.config/dotfiles/bin/todo` is the launcher. In a terminal, bare `todo` (or
`todo i`, `-i`, `--interactive`, `interactive`) execs the TUI; anything else
runs `bun cli/dist/todo.mjs`.

A full list of commands, keys and settings is in
[FUNCTIONALITIES.md](FUNCTIONALITIES.md). Keep it in sync when adding or
changing a command, key binding or setting.

## Data

All state lives in `~/.dotfiles/todo/`:

| File | Contents |
| --- | --- |
| `tasks.json` | tasks, epics and subtasks |
| `boards.json` | boards, lanes, timers and the active board |
| `config.json` | settings and `collapsedEpicIds` |
| `removed.json` | removed tasks, restorable as `r<n>` |
| `undo.json` | the last deletion, for `todo undo` |
| `typos.json` | learned typo corrections |

Never point tests or experiments at the real directory.

## Commands

```sh
make help          # every Go target
make test          # go test ./...
make lint          # golangci-lint run ./...
make golden        # rewrite internal/app/testdata after an intended frame change
make build         # build into bin/todo-tui, which the launcher runs

cd cli
bun test
bun run typecheck
bun run build      # rebuild dist/todo.mjs; the launcher runs this bundle
```

## Rules

- The TUI never writes `tasks.json` or `boards.json`. A new TUI verb calls the
  CLI through `internal/todo/cli.go`; if the CLI lacks the verb, add it there
  first.
- After changing TypeScript source, run `bun run build`, or the launcher keeps
  running the old bundle.
- Every CLI command, argument and flag is declared once as a `CommandSpec` in
  `cli/src/plugins/`. Help, parsing, typo suggestions and completions derive
  from it. After changing a command, regenerate the fish completions:
  `todo completions fish > ~/.config/dotfiles/configs/fish/completions/todo.fish`.
  A test fails when the committed file drifts.
- TUI verbs and keys are declared in `internal/modules/board/module.go`;
  global keys in `internal/app/keymap.go`. The palette, help overlay and status
  bar are generated from these, so never list a key anywhere else in the TUI.
- `internal/tui/` is the reusable-tui shell. Edit it rarely.
  `internal/tui/boundaries_test.go` enforces that the shell never imports a
  module and the runtime never imports the shell.
- Code style, comments and prose follow the `generic-program-rules` skill.

## Layout

```
cmd/todo-tui/main.go        entrypoint
internal/app/               composition root, module list, global keymap
internal/modules/board/     the taskboard screen: sidebar, task trees, splits
internal/todo/              task and board models, file readers, CLI bridge
internal/tui/               reusable-tui shell, widgets, layout, themes
cli/todo.ts                 CLI entry
cli/src/command-spec/       declarative command tree, parser, completions
cli/src/plugins/            one module per command group
cli/src/domain/             pure rules: due dates, trees, boards, autocorrect
cli/src/storage/            persistence and migrations
cli/src/services/           board loading, expiry wrap-up, task placement
cli/src/scheduler/          reminder daemon and systemd service
cli/src/presentation/       help pager and task formatting
```
