# Todo rewrite

This is the TypeScript todo manager. The bundled CLI is the active command.

## Development

```sh
cd ~/.config/dotfiles/apps/todo-tui/cli
bun run dev help
bun run build
bun run typecheck
bun test
```

## Commands

Task descriptions do not need quotes or the `add` command. Separate multiple
tasks with commas; whitespace around a comma is ignored. A standalone `--` ends
option parsing, for descriptions that start with a dash.

```sh
bun run dev buy oat milk
bun run dev buy oat milk, call dentist --priority high
bun run dev add call dentist --due tomorrow --reminders 10,30
bun run dev
bun run dev list
bun run dev panel
bun run dev interactive
bun run dev --help
bun run dev board add --help   # help for any node; `todo help board add` works too
bun run dev rm 1,5,9,10-15
bun run dev delete 1,3-5
bun run dev rm all
bun run dev done 1
bun run dev edit 1 buy oat milk
bun run dev hide 33              # keep #33 pending but out of the shell panel and list
bun run dev hide "My Epic"       # by exact name; hides the whole subtree
bun run dev unhide 33
bun run dev archive
```

## Epics and subtasks

Any task can hold subtasks, to any depth. An *epic* is just a task created with
`epic` so it is bold and shows a `[done/total]` badge even while empty; a plain
task grows the same badge as soon as something is nested under it.

```sh
todo epic Website redesign            # Added epic 1: Website redesign
todo sub 1 fix header, fix footer     # two subtasks under #1
todo add polish hero --under 2        # --under / --parent / --in work on add too
todo list                             # renders the tree
todo move 5 2                         # re-parent #5 under #2
todo move 5 root                      # back to the top level
todo done 1                           # completes #1 and everything under it
todo rm 1                             # deletes #1 and its subtree; undo restores all of it
```

`list`, `tree`, and the panel render nesting with `├─`/`└─` connectors.
Filtered views (`--overdue`, `today`, search) show matches flat when their
parent is not part of the result.

Taskboard keys: `A` adds a subtask under the selected task, `E` adds an epic,
`>` nests the selected task under the one above it, `<` moves it up a level,
`←`/`h` collapses (or jumps to the parent), `→`/`l` expands (or jumps to the
first child). `Enter` and `d` act on the whole subtree.

## Searchable help

`todo help` in a terminal opens a keyboard-driven pager over the whole reference
— the overview followed by every command's own help — under a sticky bar that
holds the search field and the match counter.

| Key | Action |
| --- | --- |
| `j` `k` `↑` `↓` | scroll a line (the mouse wheel scrolls too) |
| `^d` `^u` | half a page; `space`/`b` and `PgDn`/`PgUp` move a full page |
| `g` `G` | top and bottom (`Home`/`End` work as well) |
| `/` | focus the search field; typing filters the body to matching lines |
| `Enter` | run the search: the full text returns with matches highlighted |
| `n` `N` | next and previous match, wrapping, shown as `3/19 matches` |
| `Esc` | cancel while typing; clear an active search in browse mode |
| `q` `^C` | quit |

`todo help <command>`, `todo <command> --help`, piped output, and
`todo help --plain` all stay plain text.

## Boards

A board is a curated view of task ids with two lanes, `now` and `later` (shown as
**Now** and **Later**), and an optional timer. Lanes hold top-level picks; a
task's subtasks follow it and cannot be moved on their own. A task can be on
several boards.

```sh
todo board new projecten              # create and activate
todo board new deploy day --for 4h    # a timed board (24h at most)
todo focus 90m                        # shortcut: timed board named Focus <date>
todo board                            # list boards; * marks the active one
todo board use projecten              # activate (names ignore case)
todo board add 12 14                  # onto the active board, in Now
todo board later 14 --on projecten    # --on targets any board
todo board now 14
todo board rm 12                      # off the board; the task stays
todo board show                       # Now and Later lanes
todo board extend 30m                 # timed boards only, never past 24h from now
todo board rename projecten werk
todo board off                        # all tasks again; timers keep running
todo board end deploy day             # delete; a timed board nests its new tasks under an epic
```

The active board drives the panel, `todo list` and the TUI's first view. New
tasks join its Now lane; `--later` puts them in Later, `--off-board` keeps them
off. `todo list --all` and `todo panel --all` ignore the board. Completing a
task leaves it listed (readers only show pending tasks); `rm` takes it off every
board.

Boards live in `~/.dotfiles/todo/boards.json`. An expired timed board is wrapped
up on the next command: the top-level tasks created on it move under a new epic
named after it. A pre-boards `focus.json` is converted once, on first use.

## Epic visibility

Epics render expanded by default. Collapsing one folds it into a single line —
`joram ● 2 subtickets` — and hides its children in `list` and the shell panel.
This is presentation state only: nothing about the tasks changes.

```sh
todo close joram                  # by name; also `todo close 36` or `todo close #36`
todo open "client work"           # quote names with spaces, as everywhere else
todo close all                    # collapse every epic
todo open all                     # expand every epic
```

Shorthand only counts as a command when the whole expression resolves: an action
letter (`o`, `c`) plus either the target letter `a` or an epic.

```sh
todo -ca      todo --c --a        # close all
todo -oa      todo --o --a        # open all
todo -c joram todo -o 36          # one epic
```

`--help` and `-h` work at every level (`todo close all --help`) and never mutate
state. State lives in `collapsedEpicIds` in the config file, as the
set of closed epic IDs, so new epics default to open and renames keep their
state.

## Settings

Settings live in `~/.dotfiles/todo/config.json` and are edited with `config`:

```sh
todo config                       # list every setting
todo config panel-limit           # read one setting
todo config panel-limit 15        # show 15 tasks per lane in the shell panel
todo config panel-limit all       # show every pending task (0 works too)
todo config panel-layout side     # board lanes in columns at any width (auto, side, stack)
todo config panel-boards all      # every board as a column at shell startup (active, all)
todo config startup-notifications off
todo config show-completed on
todo config autocorrect off       # disable "did you mean" prompts and learned corrections
```

The old `shell-limit`/`shell-layout` values in `config.json` are read once and
written back under the new keys.

`todo panel` is what the shell prints at startup (and what bare `todo` prints
without a terminal). Its settings can be overridden per invocation:

```sh
todo panel --limit 12
todo panel --side
todo panel --boards               # every board as a column, the active one marked with *
todo panel --all                  # every pending task, ignoring the board and the limit
TODO_PANEL_LIMIT=3 TODO_PANEL_LAYOUT=stack TODO_PANEL_BOARDS=all todo panel
```

Precedence is `--limit`/`--all`, then `TODO_PANEL_LIMIT`, then `panel-limit`
from the config file (default `5`); `panel-boards` follows the same chain. Whatever is hidden is summarised by the
`↳ n more tasks` line, which also prints the command that reveals the rest. With
no active board, every running timed board gets a dim footer line such as
`projecten · 3h left · todo board use projecten`.

Supported add options are `--due`, `--priority`, `--reminders`, `--under`,
`--later` and `--off-board`. Priorities are `none`, `low`, `medium`, and `high`.

## Typo correction

A mistyped command, subcommand, option, setting, value or board name that has
exactly one close match prompts `Did you mean todo done 3? [Y/n]`. An unknown
first word is only treated as a typo when the rest of the line fits the command
it resembles (`donw 3` where task 3 exists, `lsit` with no arguments); ordinary
task text such as `todo buy milk` is added as a task, and declining the prompt
adds it too.

Without a terminal nothing is asked: the command fails with exit code 1 and
`Unknown option: --laetr. Did you mean --later?`, and nothing is written.

Answers are remembered in `~/.dotfiles/todo/typos.json`. Accepting the same
correction three times switches it to automatic: the corrected command runs
straight away with a dim `autocorrected dne → done` notice. Declining the same
suggestion twice stops it from being offered again.

```sh
todo typos               # list learned corrections and their state
todo typos forget dne    # drop one learned typo
todo typos reset         # forget everything
```

## Due dates

The `--due` value runs until the next `--option`, so multi-word dates do not need
quotes. It accepts:

| Form | Examples |
| --- | --- |
| Keywords | `today`, `tonight`, `tomorrow`, `yesterday` |
| Weekdays | `monday`, `next friday`, `last friday` |
| Relative | `in 2 weeks`, `two weeks ago`, `3 days ago`, `2 days from now`, `next week`, `last month` |
| Shorthand | `30m`, `1h`, `2w`, `-2d`, `+3d` |
| Clock time | `15:30`, `3pm` |
| Calendar date | `16/08/2026`, `16-08-2026`, `16.08.2026`, `16 08 2026`, `16/08`, `2026-08-16` |
| Month names | `16 aug 2026`, `aug 16 2026`, `16 august` |
| Date plus time | `16/08/2026 15:30`, `16 08 2026 at 3pm`, `tomorrow 7:15` |

Rules worth knowing:

- Numeric dates are read **day first** (`16/08/2026` is 16 August). A value that
  cannot be a day-first date falls back to month-first, so `08/16/2026` still
  resolves to 16 August. A leading four-digit year means ISO order.
- Dates in the past are accepted and render as `[OVERDUE]`. Only the bare clock
  form rolls forward: `15:30` means tomorrow if 15:30 already passed today.
- A date with no time lands at 09:00. A missing year means the current year.
- Numeric offsets keep the current time of day (`2 weeks ago` at 09:44 lands at
  09:44), while `next week` and `last month` snap to 09:00.

The same syntax is used by `todo snooze <id> <when>` and by the `s` and due-date
prompts in the interactive taskboard.

Run `todo` in a terminal to open the keyboard taskboard. Use `↑`/`↓` or
`j`/`k` to navigate, `Enter` to complete, `a` to add, `A` to add a subtask,
`E` to add an epic, `d` to delete, `u` or `Ctrl+Z` within five seconds to undo
a deletion, `?` for help, and `q` to exit.

## Architecture

- `src/domain`: task, board and configuration types plus pure rules.
- `src/storage`: persistence, atomic writes, and data migrations.
- `src/services`: board loading, expiry wrap-up and placement of new tasks.
- `src/command-spec`: the declarative command tree and everything derived from
  it — parser, help, typo candidates, fish completions.
- `src/plugins`: first-party modules, each exporting `CommandSpec`s; the root
  tree is assembled in `plugins/builtins.ts`.
- `src/cli.ts`: dispatch, typo prompts and application assembly.

Every command, subcommand, argument and flag is declared once as a
`CommandSpec`. Handlers receive a parsed `ParsedInput`, never raw argv. The
conformance test (`__tests__/command-spec.test.ts`) walks every node and checks
its help, completions and typo suggestions.

## Completions

`configs/fish/completions/todo.fish` is generated; regenerate it after changing
a command:

```sh
todo completions fish > ~/.config/dotfiles/configs/fish/completions/todo.fish
```

Task, epic, board and archive values are listed live through the hidden
`todo completions --list <task|epic|board|archive>`. A test fails when the
committed file drifts from the tree.

## Migration rule

The new store intentionally points to the existing `~/.dotfiles/todo/tasks.json`
data. The production launcher runs the bundled `dist/todo.mjs`; rebuild it with
`bun run build` after changing the TypeScript source.
