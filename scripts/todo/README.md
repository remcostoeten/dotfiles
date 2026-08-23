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
bun run dev rm 1,5,9,10-15
bun run dev delete 1,3-5
bun run dev delete all
bun run dev rmall
bun run dev done 1
bun run dev edit 1 buy oat milk
bun run dev archive
```

## Settings

Settings live in `~/.dotfiles/todo/config.json` and are edited with `config`:

```sh
todo config                       # list every setting
todo config shell-limit           # read one setting
todo config shell-limit 15        # show 15 pending tasks on shell startup
todo config shell-limit all       # show every pending task (0 works too)
todo config startup-notifications off
todo config show-completed on
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
`j`/`k` to navigate, `Enter` to complete, `a` to add, `d` to delete, `u` or
`Ctrl+Z` within five seconds to undo a deletion, `?` for
help, and `q` to exit.

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
