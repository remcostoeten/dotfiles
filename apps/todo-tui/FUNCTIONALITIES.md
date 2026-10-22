# Functionalities

Everything `todo` and the taskboard TUI can do. `todo <command> --help` has the
full reference for any command.

## Launching

| Command | Result |
| --- | --- |
| `todo` in a terminal | opens the taskboard TUI |
| `todo i`, `-i`, `--interactive`, `interactive` | opens the taskboard TUI |
| `todo` without a terminal | prints the shell panel |
| `todo <text>` | adds a task; any unknown first word starts a description |

## CLI

### Create

| Command | What it does |
| --- | --- |
| `todo add <text>[, <text>]` | add one or more tasks; `add` is optional |
| `todo epic <name>[, <name>]` | create epics, which render bold with a `[done/total]` badge |
| `todo sub <parent> <text>[, <text>]` | add subtasks under a task ID or exact task name |
| `todo <id> <text>` | same as `todo sub <id> <text>` |

Options for `add`, `epic` and `sub`:

| Option | Effect |
| --- | --- |
| `--due <time>` | due date, see [Due dates](#due-dates) |
| `--priority <level>` | `none`, `low`, `medium` or `high` |
| `--reminders <min,…>`, `--remind` | minutes before the due date to notify |
| `--under <id>`, `--parent`, `--in` | nest under an existing task (`add`, `epic`) |
| `--later` | put new tasks in the active board's Later lane |
| `--off-board` | keep new tasks off the active board |
| `--` | ends option parsing, for text starting with a dash |

### View

| Command | What it does |
| --- | --- |
| `todo list`, `todo tree` | pending tasks as a tree, limited to the active board |
| `todo list --all` | every task, including completed and hidden, ignoring the board |
| `todo list --overdue` | pending tasks past their due date |
| `todo list --upcoming` | pending tasks due soon |
| `todo panel` | the compact panel the shell prints at startup |
| `todo panel --side` / `--stack` | board lanes in columns or stacked |
| `todo panel --boards` | every board as a column, active one marked `*` |
| `todo panel --limit <n\|all>` | rows per lane before a `↳ n more tasks` line |
| `todo panel --all` | every pending task, ignoring the board and the limit |
| `todo archive` (`removed`, `trash`) | completed and removed tasks, newest first |
| `todo archive <text>` | archive entries containing the text |
| `todo archive --removed` / `--done` | only removed or only completed entries |
| `todo archive --since <t>` / `--until <t>` | filter by age: `7d`, `12h`, `2w` or a date |
| `todo archive restore r3 r4` | recreate removed tasks with fresh IDs |
| `todo archive restore r3 --to 12` | recreate under task #12 |
| `todo archive -i` | restore picker: type to filter, `Tab` cycles all/removed/done, `Space` marks, `Enter` restores, `Ctrl+T` restores under a chosen parent |

### Change

| Command | What it does |
| --- | --- |
| `todo done <id>` | complete a task and its subtree |
| `todo edit <id> <text>` | replace a description |
| `todo hide <id\|name>` | keep a task pending but out of the panel and list |
| `todo unhide <id\|name>` | show a hidden task again |
| `todo move <id> <parent>` (`mv`) | re-parent with its subtree; `root`, `top` or `-` for the top level |
| `todo reorder <id> --before <id>` | place above a sibling; also `--after`, `--top`, `--bottom` |
| `todo snooze <id> <time>` | push the due date forward and reset reminders |

### Due dates and reminders

| Command | What it does |
| --- | --- |
| `todo due <task> <when>` | set a due date; the task is an ID, `#ID` or exact name |
| `todo due <task>` | show the due date and reminder state |
| `todo due <task> clear` (`remove`) | drop the due date |
| `todo due <task> reset` | rearm a fired reminder |
| `todo due <task> <when> --sound <s>` | `default`, `none` or an absolute sound file path |
| `todo due <task> <when> --run <cmd> [--cwd <dir>]` | run a command when the reminder fires; `--cwd pwd` captures the current directory |
| `todo due list [overdue\|today\|week]` | pending tasks with a due date, most urgent first |
| `todo due daemon` (`run`) | run the reminder scheduler in the foreground |
| `todo due daemon install` | write and enable a systemd user service |
| `todo due daemon status` | report whether the service runs |

Reminders notify natively once, even after the shell that set them exits. Any
`todo` command also delivers overdue reminders.

### Epic visibility

| Command | What it does |
| --- | --- |
| `todo close <epic>` | collapse an epic into one `● n subtickets` line |
| `todo open <epic>` | expand it again |
| `todo close all` / `todo open all` | collapse or expand every epic |
| `todo -c <epic>`, `todo -o <epic>` | shorthand for one epic |
| `todo -ca`, `--c --a` / `todo -oa`, `--o --a` | shorthand for all |

Visibility is presentation state, stored in `collapsedEpicIds`.

### Remove and undo

| Command | What it does |
| --- | --- |
| `todo rm <ids>` (`delete`) | remove tasks and their subtrees; IDs, comma lists, ranges like `10-15` |
| `todo rm all` | remove every pending task |
| `todo undo` (`revert`, `restore`) | restore the most recent removal with fresh IDs |

Removed tasks move to the archive and leave every board.

### Boards

A board is a view with **Now** and **Later** lanes and an optional timer. A
task can sit on several boards. The active board drives the panel,
`todo list`, the TUI's first view and where new tasks land.

| Command | What it does |
| --- | --- |
| `todo board` (`list`, `ls`) | list boards; `*` marks the active one |
| `todo board new <name> [--for 4h]` | create and activate, optionally timed (24h at most) |
| `todo focus <duration> [name]` | shortcut for a timed board, named `Focus <date>` by default |
| `todo board use <name>` | activate a board |
| `todo board off` | no active board; timers keep running |
| `todo board show [name]` | print the Now and Later lanes |
| `todo board add <ids>` | put tasks on a board, in Now unless `--later` |
| `todo board rm <ids>` (`remove`) | take tasks off a board |
| `todo board later <ids>` / `now <ids>` | move tasks between lanes |
| `todo board move <ids> --to <name>` (`mv`) | move tasks off the active board (or `--from <name>`) onto another, keeping their lane unless `--later` or `--now` |
| `todo board extend <duration>` | give a timed board more time, never past 24h from now |
| `todo board rename <old> <new>` | rename a board |
| `todo board end [name]` (`delete`) | delete a board, the active one by default |

`--on <board>` targets a board other than the active one. When a timed board
expires, the top-level tasks created on it move under an epic named after it.

### Settings

| Command | What it does |
| --- | --- |
| `todo config` | list every setting |
| `todo config <key> [value]` | read or change one setting |
| `todo typos` | list learned typo corrections |
| `todo typos forget <word>` / `reset` | forget one or all |
| `todo completions fish` | print fish completions |
| `todo help` | searchable help pager |
| `todo help <command>`, `todo <command> --help` | plain help for one command |

| Setting | Values |
| --- | --- |
| `panel-limit` | number of tasks per lane, or `all` (default `5`) |
| `panel-layout` | `auto`, `side` or `stack` |
| `panel-boards` | `active` or `all` |
| `startup-notifications` | `on` or `off` |
| `show-completed` | `on` or `off` |
| `autocorrect` | `on` or `off` |

`TODO_PANEL_LIMIT`, `TODO_PANEL_LAYOUT` and `TODO_PANEL_BOARDS` override the
panel settings per invocation.

### Typo correction

A mistyped command, option, setting, value or board name with one close match
prompts `Did you mean …? [Y/n]`. Accepting the same correction three times
makes it automatic; declining twice stops the prompt. Without a terminal the
command fails with the suggestion and writes nothing.

### Help pager

| Key | Action |
| --- | --- |
| `j` `k` `↑` `↓`, mouse wheel | scroll a line |
| `^d` `^u` | half a page |
| `space` `b`, `PgDn` `PgUp` | full page |
| `g` `G`, `Home` `End` | top and bottom |
| `/` | search; typing filters to matching lines |
| `Enter` | run the search with highlights |
| `n` `N` | next and previous match |
| `Esc` | cancel or clear the search |
| `q` `^C` | quit |

### Due dates

| Form | Examples |
| --- | --- |
| Keywords | `today`, `tonight`, `tomorrow`, `yesterday` |
| Weekdays | `monday`, `next friday`, `next tue`, `last friday` |
| Relative | `in 2 weeks`, `3 days ago`, `2 days from now`, `next week`, `last month` |
| Shorthand | `30s`, `30m`, `1h`, `3,5h`, `2d`, `2w`, `-2d`, `+3d` |
| Clock time | `15:30`, `3pm` |
| Calendar date | `16/08/2026`, `16-08-2026`, `16.08.2026`, `16/08`, `1206`, `2026-08-16` |
| Month names | `16 aug 2026`, `aug 16 2026`, `16 august`, Dutch names too |
| Date plus time | `16/08/2026 15:30`, `tomorrow 7:15`, `16 08 2026 at 3pm` |

Numeric dates are day first. `m` always means minutes. Past dates are accepted
and render as overdue.

## Taskboard TUI

The screen has a sidebar of workspaces and up to three task trees side by
side. The sidebar lists `all tasks`, `today`, `overdue`, `high priority` and
`archive`, then each board with its Later lane indented under it. `*` marks the
active board and timed boards show their time left. The TUI opens on the
active board.

### Global keys

| Key | Action |
| --- | --- |
| `tab` / `shift+tab` | next or previous region |
| `ctrl+g` | badge every region and jump to the one pressed |
| `alt+h` `alt+j` `alt+k` `alt+l` | move focus geometrically |
| `]` / `[` | next or previous section |
| `alt+left` / `alt+right` | back and forward |
| `esc` | leave a drilled-in screen, or close an overlay |
| `ctrl+k` | command palette |
| `?` | every key and command available here |
| `ctrl+t` | cycle themes: `dark`, `dim`, `high-contrast`, `ascii` |
| `q`, `ctrl+c` | quit |

### Tree navigation

| Key | Action |
| --- | --- |
| `j` `k`, `↓` `↑` | move the cursor |
| `PgDn` `PgUp` | move a page |
| `g` `G`, `Home` `End` | first and last row |
| `h`, `←` | collapse, or jump to the parent |
| `l`, `→` | expand, or jump to the first child |

### Task verbs

| Key | Action |
| --- | --- |
| `enter`, `space` | complete the task and its subtree; in the archive, restore it |
| `a` | add tasks; commas separate several, CLI flags like `--due` work |
| `A` | add a subtask under the selected task |
| `E` | add an epic |
| `e` | edit the description |
| `d` | delete the task and its subtree, after confirming |
| `u`, `ctrl+z` | undo the last complete, or restore the last delete |
| `t` | set the due date; `none` clears it |
| `s` | snooze |
| `p` | cycle priority |
| `x` | mark for batch completion |
| `c` | complete every marked task |
| `>` | nest under the task above |
| `<` | move up one level |
| `/` | search; `esc` clears it |
| `v` | toggle the archive |
| `r` | refresh |

### Board verbs

| Key | Action |
| --- | --- |
| `F` | new timed board: `4h`, `90m deploy day` |
| `b` | activate the next board; after the last, board off |
| `B` | board off |
| `f` | put the task on the board in view (or the active one), or take it off |
| `L` | move the task between Now and Later |
| `m` | move the task off the board in view onto another; the prompt suggests the board open in another pane |
| `a` in a lane | add into that lane; elsewhere adds off the board |
| `\|`, `S` | split: open another board beside, up to three; with three, keep only the focused one |
| `ctrl+w` | close the focused pane |
| palette: End Board | delete the board in view, after confirming |

In a split, `tab` and `alt+h`/`alt+l` move between trees, and every verb acts
on the focused tree. The sidebar hides when trees would get narrower than 40
columns.
