# todo-tui

A terminal application, scaffolded from
[reusable-tui](https://github.com/remcostoeten/reusable-tui).

## Run

    make run

## Layout

    cmd/todo-tui/main.go      entrypoint: config, logging, runtime
    internal/app/app.go       composition root
    internal/app/register.go  the module list — one line per screen
    internal/modules/*/       your screens
    internal/tui/             the shell; you rarely edit this

Adding a screen is a directory under `internal/modules` and a line in
`register.go`. A module registers its routes, commands, key bindings and
status items into a `Registrar`; the command palette, the help overlay and
the status bar are generated from that registry, so a verb you add shows up in
all three without being listed anywhere else.

`app.Build` freezes the registry and reports duplicate routes, malformed
bindings and keymap conflicts before the first frame is drawn.

## Keys

`tab` cycles focus · `v` badges every region and jumps to the one you press ·
`alt+hjkl` moves geometrically · `[` and `]` change section · `ctrl+k` opens the
palette · `?` lists every command · `ctrl+t` cycles `dark`, `dim`, `high-contrast`
and `ascii` · `q` quits.

## Boards

A board is a curated view of tasks with two lanes, **Now** and **Later**. Boards
are views, not folders: a task can sit on several, and epics still own the tree.
They live in `boards.json` next to `tasks.json`; the CLI owns every write and
the TUI only reads the file.

Each board appears in the sidebar after the fixed workspaces, with its Later
lane indented under it (`* ` marks the active board, timed boards show the time
left). The TUI opens on the active board.

| Key | Action |
| --- | --- |
| `F` | new timed board: `4h`, `90m deploy day` (24h at most) |
| `b` | activate the next board; after the last one, board off |
| `B` | board off: all tasks show, timers keep running |
| `f` | put the selected task on the board in view (or the active one), or take it off |
| `L` | move the selected task between Now and Later |
| `a` | in a board lane adds into that lane; elsewhere adds off the board |
| `\|` or `S` | split: another board opens beside the ones in view, up to three; with three open, keeps only the focused one |
| `ctrl+w` | close the focused pane of a split |

In a split, `tab` and `alt+h`/`alt+l` move between the trees, and the sidebar
picks the board for the tree last focused. Every verb acts on the focused
tree. A new pane shows a board not yet open, then a Later lane. The sidebar
hides when the trees would get narrower than 40 columns.

The CLI drives the same boards: `todo board new <name> [--for 4h]`,
`todo board use|off|show|add|rm|later|now|extend|rename|end`, and the shortcut
`todo focus 4h [name]`. While a board is active, `todo list` and the shell panel
show its lanes and new tasks join its Now lane (`--later`, `--off-board`). When a
timed board runs out, the top-level tasks created on it move under an epic named
after it. A pre-boards `focus.json` is migrated once, on first use.

## Development

    make test     # go test ./...
    make lint     # golangci-lint run ./...
    make build    # bin/todo-tui

`internal/tui/boundaries_test.go` enforces the layering: the shell never
imports a module, the runtime never imports the shell.
