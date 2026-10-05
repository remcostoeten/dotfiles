# Todo rewrite

This is the TypeScript todo manager. The bundled CLI is the active command.

## Development

```sh
cd ~/.config/dotfiles/scripts/todo
bun run dev help
bun run build
bun run typecheck
bun test
```

## Commands

Task descriptions do not need quotes or the `add` command. Separate multiple
tasks with commas; whitespace around a comma is ignored. The first `--option`
starts the option list; a standalone `--` can be used as an explicit separator.

```sh
bun run dev buy oat milk
bun run dev buy oat milk, call dentist --priority high
bun run dev add call dentist -- --due tomorrow --reminders 10,30
bun run dev
bun run dev list
bun run dev shell-display
bun run dev interactive
bun run dev --help
bun run dev rm --help          # per-command help; `todo help rm` works too
bun run dev rm 1,5,9,10-15
bun run dev delete 1,3-5
bun run dev delete all
bun run dev rmall
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

`list`, `tree`, and the shell panel render nesting with `├─`/`└─` connectors.
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

## Epic visibility

Epics render expanded by default. Collapsing one folds it into a single line —
`joram ● 2 subtickets` — and hides its children in `list` and the shell panel.
This is presentation state only: nothing about the tasks changes.

```sh
todo close joram                  # by name; also `todo close 36` or `todo close #36`
todo open "client work"           # quote names with spaces, as everywhere else
todo toggle 36                    # invert one epic
todo close all                    # collapse every epic
todo open all                     # expand every epic
todo toggle all                   # invert each epic independently
todo toggle reset                 # forget every override; everything expands again
```

Shorthand only counts as a command when the whole expression resolves: an action
letter (`t`, `o`, `c`) plus either a target letter (`a`, `r`) or an epic.

```sh
todo -ca      todo --c --a        # close all
todo -oa      todo --o --a        # open all
todo -tr      todo --t --r        # toggle reset
todo -t joram todo --t 36         # toggle one epic
```

`todo -t`, `todo --o` and the other halves keep whatever they meant before.
`help`, `--help`, and `-h` work at every level (`todo close all --help`) and
never mutate state. State lives in `collapsedEpicIds` in the config file, as the
set of closed epic IDs, so new epics default to open and renames keep their
state.

## Settings

Settings live in `~/.dotfiles/todo/config.json` and are edited with `config`:

```sh
todo config                       # list every setting
todo config shell-limit           # read one setting
todo config shell-limit 15        # show 15 pending tasks on shell startup
todo config shell-limit all       # show every pending task (0 works too)
todo config startup-notifications off
todo config show-completed on
todo config autocorrect off       # disable "did you mean" prompts and learned corrections
```

An optional `set`/`get` verb is accepted, so `todo config set shell-limit 15`
and `todo config get shell-limit` work too.

The shell panel count can also be overridden per invocation, which is handy for
testing a value before persisting it:

```sh
todo shell-display --limit 12
todo shell-display --all
TODO_SHELL_LIMIT=3 todo shell-display
```

Precedence is `--limit`/`--all`, then `TODO_SHELL_LIMIT`, then `shell-limit`
from the config file (default `5`). Whatever is hidden is summarised by the
`↳ n more tasks` line, which also prints the command that reveals the rest.

Supported add options are `--due`, `--priority`, and `--reminders`. Priorities
are `none`, `low`, `medium`, and `high`.

## Typo correction

A mistyped command, option, setting, or value that has exactly one close match
prompts `Did you mean todo done 3? [Y/n]`. It only kicks in when the input
would otherwise fail: an unknown first word is corrected only when the rest of
the line fits the corrected command (`dne 3` where task 3 exists, `lsit` with
no arguments), so ordinary task text such as `todo buy milk` is never touched.
Without a terminal nothing is asked and the old behaviour applies.

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

An option value runs until the next `--option`, so multi-word dates do not need
quotes. `--due` accepts:

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

- `src/domain`: stable task and configuration types.
- `src/storage`: persistence, atomic writes, and future schema migrations.
- `src/plugins`: first-party feature modules registered explicitly.
- `src/cli.ts`: only command dispatch and application assembly.

Features are implemented as explicit in-process `TodoPlugin` modules. Do not
add dynamic third-party loading until there is a real external-plugin use case.

## Migration rule

The new store intentionally points to the existing `~/.dotfiles/todo/tasks.json`
data. The production launcher runs the bundled `../todo.mjs`; rebuild it with
`bun run build` after changing the TypeScript source.
