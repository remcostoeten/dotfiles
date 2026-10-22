# Plan: declarative command layer + boards

Self-contained brief for an agent rewriting the `todo` CLI API. Nobody depends
on the current API yet, so breaking changes are fine. Read the whole file
before starting.

## Context

- Repo root: `~/.config/dotfiles`. App: `apps/todo-tui`.
  - `cli/` — Bun/TypeScript CLI (`cli/todo.ts` → `cli/src/cli.ts`). Owns every
    mutation. Built to `cli/dist/todo.mjs` (`bun run build`).
  - `internal/`, `cmd/` — Go TUI (reusable-tui framework). Reads the data
    files; mutates by shelling out to the CLI (`internal/todo/cli.go`,
    `CLI.Run`). Built to `~/.config/dotfiles/bin/todo-tui`
    (`go build -trimpath -o ../../bin/todo-tui ./cmd/todo-tui` from `apps/todo-tui`).
  - `~/.config/dotfiles/bin/todo` — wrapper: bare `todo`/`todo i` in a TTY
    execs the Go TUI, everything else runs `bun cli/dist/todo.mjs`.
  - `cli/src/plugins/interactive.ts` — legacy TS taskboard, fallback when the
    Go TUI is missing. Keep it compiling and working; it does not need boards.
- Shell startup: `vendor/fish/runtime.fish` calls
  `configs/fish/functions/show_todos_startup.fish`, which runs
  `todo shell-display`. Bare non-TTY `todo` also defaults to `shell-display`
  (`cli/src/cli.ts`).
- Fish completions: `configs/fish/completions/todo.fish` (hand-written, stale).
- Data: `$DOTFILES_DATA_DIR/todo/` (default `~/.dotfiles/todo/`):
  `tasks.json`, `config.json`, `focus.json`, `removed.json`, `undo.json`,
  `typos.json`.

### Current command machinery (what gets replaced)

- `cli/src/plugins/types.ts`: `TodoPlugin.register(app)` →
  `app.command(name, description, handler, help)`. `CommandHelp` holds
  free-text `usage`, `details`, `options`, `examples`, `aliases`, `ownHelp`,
  and a coarse `positional: ArgumentShape` ("none" | "task-id" | "task-ids" |
  "text" | "any").
- Every handler parses `args: string[]` by hand. Consequences found in testing:
  - `todo focus pin --help`, `todo config shell-limit --help` print the parent
    command's help, not the subcommand's.
  - `todo focus foucs` is read as a duration; no typo suggestion.
  - `todo add x --laetr` → "Missing value for --laetr" instead of "did you mean --later".
  - `todo shell-display --sied` silently ignores the unknown flag.
  - `focus`/`board` has zero fish completions.
- Autocorrect: `cli/src/autocorrect.ts` + `cli/src/domain/autocorrect.ts`
  (typo memory in `typos.json`, `UnknownTokenError` carries candidates,
  interactive confirm only on a TTY). Reuse the memory/decision logic; feed it
  from the new spec instead of per-handler candidate lists.
- Help rendering: `cli/src/presentation/help-format.ts`, `help-browser.ts`,
  `cli/src/plugins/help.ts`.
- `cli/src/domain/visibility-alias.ts` expands `-o`, `-c`, `-t`, `-oa`, … before dispatch.

## Decisions already made (do not re-litigate)

1. Replace "focus" with generic **boards**. A board is a curated view of task
   ids with two lanes, `now` and `later`, and an optional expiry. Boards are
   views, not ownership: a task can sit on several boards; epics stay the
   ownership tree.
2. One board can be **active**. The active board drives the shell panel,
   `todo list` and the TUI's initial view. `todo board off` shows all tasks;
   timers keep running while inactive.
3. Tasks created while a board is active join it (`now` lane; `--later` for
   the later lane; `--off-board` to skip).
4. Lanes are fixed: exactly `now` and `later`. Display labels: **Now** and
   **Later** (commands and UI use the same words).
5. `shell-display` → `panel`; config `shell-limit` → `panel-limit`,
   `shell-layout` → `panel-layout` (`auto` | `side` | `stack`).
6. Remove top-level `toggle` (epic visibility keeps `open`/`close`), remove
   `rmall` (`rm all` stays), remove the toggle aliases (`-t`, `-tr`,
   `--t --r`). Keep `-o`, `-c`, `-oa`, `-ca`.
7. Keep `hide`/`unhide` (keeps a task out of default views; distinct from boards).
8. All board mutations go through the CLI. The Go TUI only reads
   `boards.json`; its `f`, `L`, `F`, `b` keys call `todo board …`.
9. No backwards-compat aliases for removed commands. One-time data migration
   from `focus.json` is required (below).

## Target API

```
todo <description>[, …] [--due] [--priority] [--reminders] [--under <id>] [--later] [--off-board]

CREATE
  add <desc>[, …] [--due <time>] [--priority <level>] [--reminders <min,…>] [--under <id>] [--later] [--off-board]
  epic <desc>
  sub <id> <desc>[, …]

BOARDS
  board                              list boards; * marks active; remaining time for timed boards
  board new <name> [--for <dur>]     create and activate
  board use <name>                   activate
  board off                          no active board (all tasks); timers keep running
  board show [name]                  print Now and Later lanes (default: active)
  board add <id…> [--later] [--on <name>]     idempotent
  board rm <id…> [--on <name>]                take off the board; task stays
  board later <id…> [--on <name>]             move to Later (adds if not on the board)
  board now <id…> [--on <name>]               move to Now (adds if not on the board)
  board extend <dur> [--on <name>]            timed boards only
  board rename <old> <new>
  board end [name]                   delete; tasks created on a timed board are nested under an epic named after it
  focus <dur> [title]                shortcut: board new <title|"Focus <date>"> --for <dur>

VIEW
  list, tree [--all | --overdue | --upcoming]     active board by default; --all ignores it
  panel [--side | --stack] [--limit <n|all>] [--all]
  archive, removed, trash
  interactive, i

CHANGE
  done, due, edit, move (mv), reorder, snooze, hide, unhide

EPIC VISIBILITY
  open, close   (aliases -o <epic>, -c <epic>, -oa, -ca)

REMOVE
  rm, delete (rm all = every pending task), undo (revert, restore)

SETTINGS
  config [key [value]]   keys: panel-limit, panel-layout, startup-notifications, show-completed, autocorrect
  help [command …]
  typos
  completions fish       print generated fish completions
```

Board names: case-insensitive match, stored as typed, must be unique, may
contain spaces (quote them). `--on` and positional board names get typo
correction against existing board names.

Durations: reuse `parseFocusSpec`/`parseFocusDuration` rules (`4h`, `90m`,
`2h30m`, bare hours, max 24h, min 1m). `extend` may not push past 24h from now.

### Storage

`boards.json` replaces `focus.json`:

```json
{
  "active": "projecten",
  "boards": [
    { "name": "projecten", "createdAt": 0, "expiresAt": 0, "now": ["101"], "later": ["104"] }
  ]
}
```

- `expiresAt` omitted for untimed boards. A lane lists **root ids**; a task's
  descendants follow it (same rule as today's `later`). A descendant cannot be
  moved independently — error suggests moving the root.
- Expired timed boards are wrapped up lazily on any load (existing
  `wrapUpFocus` behaviour: top-level tasks created during the board →
  new epic named after the board), then removed; if it was active, `active`
  becomes unset.
- Completing/removing a task leaves its id in lanes; readers filter to
  pending tasks. `rm` purges ids from all boards.
- Migration: on first load, if `focus.json` exists and `boards.json` does not,
  convert it (title → name or `Focus <date>`; `startedAt` → `createdAt`;
  members computed with the old rules (pinned + created-since-start −
  excluded) → `now`, old `later` → `later`; old `hidden: true` → not active),
  write `boards.json`, delete `focus.json`. Test it.

## Architecture: one command spec drives everything

Introduce `cli/src/command-spec/` (name it as you like) with a declarative tree:

```ts
interface CommandSpec {
  name: string;
  aliases?: string[];
  summary: string;
  group?: CommandGroup;
  details?: string[];
  examples?: CommandExample[];
  args?: ArgSpec[];            // positionals, in order
  flags?: FlagSpec[];
  subcommands?: CommandSpec[];
  defaultSubcommand?: string;  // e.g. `board` → list
  run?: (input: ParsedInput, context: CommandContext) => Promise<void>;
}
interface ArgSpec  { name: string; kind: ValueKind; variadic?: boolean; optional?: boolean; description: string }
interface FlagSpec { name: string; short?: string; aliases?: string[]; value?: ValueKind; description: string }
type ValueKind =
  | "text" | "task-id" | "pending-task-id" | "epic-id" | "board-name"
  | "duration" | "due-time" | "priority" | "count-or-all"
  | { oneOf: string[] };
```

From this single tree derive:

1. **Parser** (`parse(spec, argv)`): walks subcommands, binds positionals and
   flags, validates value kinds, rejects unknown subcommands/flags/values with
   `UnknownTokenError` carrying the right candidate list. `--` ends flag
   parsing. Boolean flags take no value (fixes `--later`). Handlers receive
   typed `ParsedInput`, never raw argv.
2. **Help**: `-h`/`--help` anywhere in argv shows help for the deepest matched
   (sub)command, e.g. `todo board add --help`, `todo config panel-layout -h`.
   `todo help board add` does the same. Generated usage lines, flag tables and
   subcommand lists; keep the current visual style of `help-format.ts`.
   Commands with rich prose help (`due`) keep it via `details`.
3. **Typo detection** at every level: command, subcommand, flag, enum value,
   config key, board name. Reuse `decideCorrection`/typo memory. Non-TTY:
   print `Unknown X: foo. Did you mean bar?` and exit 1 (never prompt).
   Implicit add (unknown first word = task description) stays, but only when
   no command/alias is within typo distance — a near-miss prompts on a TTY
   (as now) and on non-TTY errors with the suggestion instead of silently
   adding a task. Keep `argumentsFitShape`-style guard using `args`.
4. **Completions**: `todo completions fish` generates the fish file from the
   spec: commands, aliases, subcommands, flags with descriptions, enum values,
   dynamic values (`task-id` → pending task ids with descriptions,
   `epic-id`, `board-name` → names from `boards.json`, config keys/values).
   Dynamic lookups call back into `todo` (e.g. hidden
   `todo completions --list board-name`) or read JSON with `jq`-free fish;
   pick one, keep it fast (<50 ms feel). Write the output to
   `configs/fish/completions/todo.fish`; add a test that regenerates and
   diffs against the committed file.
5. **Spec conformance test**: iterates every node in the tree and asserts:
   has a summary; `--help` and `-h` render its own help (not the parent's);
   every flag/subcommand appears in generated completions; a one-letter typo
   of every subcommand and flag yields a suggestion; no two siblings collide.

Plugins become modules exporting `CommandSpec`s; `PluginRegistry` becomes a
tree registry. Delete `ownHelp`, `positional`, free-text `options`/`usage`
once nothing uses them.

## Phases

Each phase ends green: `cd cli && bunx tsc --noEmit && bun test`, and for Go
phases `go vet ./... && go test ./...` from `apps/todo-tui`.

### Phase 1 — Command spec layer (no behaviour change except fixes)

1. Build spec types, parser, help renderer, typo integration, completions
   generator, conformance test.
2. Port every existing command onto it one plugin at a time, keeping current
   names (focus, shell-display, …) so behaviour tests keep passing.
3. Remove top-level `toggle`, `rmall`, toggle aliases (decision 6); update
   tests and `visibility-alias.ts`.
4. Generate and commit `configs/fish/completions/todo.fish`.

Acceptance: all probes in "Verification" behave correctly for existing
commands; conformance test covers 100% of nodes.

### Phase 2 — Boards (CLI)

1. `cli/src/domain/boards.ts`: model, membership (roots + descendants),
   lanes, toggle/move rules, expiry wrap-up, migration from `focus.json`.
   Port the useful parts of `domain/focus.ts`, then delete it.
2. `TodoStore`: `loadBoards`/`saveBoards` (atomic write, like other files),
   remove focus methods.
3. `board` command tree + `focus` shortcut per Target API.
4. `add`/`sub`/`epic`: `--later`, `--off-board`; new tasks join the active
   board (lane per flag).
5. `list` shows the active board (header with name + remaining time, then
   Now, then Later); `--all` ignores it.
6. Rename `shell-display` → `panel`, config keys → `panel-*`
   (`TodoConfig.shellDisplayLimit`/`shellLayout` → `panelLimit`/`panelLayout`;
   read old keys once as fallback, write new). Env vars:
   `TODO_PANEL_LIMIT`, `TODO_PANEL_LAYOUT`.
7. Panel: active board → Now and Later panels, laid out per `panel-layout`
   (current `formatShellLanes` logic in `plugins/tasks.ts`: side by side when
   ≥56 inner cols each in `auto`, forced columns with ANSI-aware truncation in
   `side`, per-panel date dropping). No active board but timed boards running
   → normal panel plus one dim footer line per running board
   (`projecten · 3h left · todo board use projecten`).
8. Update `show_todos_startup.fish` and the non-TTY default in `cli.ts` to `panel`.

### Phase 3 — Go TUI

1. `internal/todo`: replace `focus.go` with `boards.go` (read-only model +
   `Members`, `NowIDs`, `LaterIDs`, filters). Delete `FocusStore.Save/Clear`
   usage; keep a loader for `boards.json`. Handle expiry display only
   (the CLI wraps up; the TUI calls `todo board show` or any cheap command on
   tick when it sees an expired board, as it does today with `focus end`).
2. Sidebar: after the fixed workspaces, one entry per board
   (`name · 3h left` when timed, `*` or accent for active) with an indented
   `later` child.
3. Keys (update `internal/modules/board/module.go` verbs):
   `F` new timed board (prompt: `4h deploy day`), `b` switch board (cycle or
   picker), `f` add/remove selected task on the board in view (or active),
   `L` Now ↔ Later, `B` board off. Adding with `a` from a board lane passes
   `--later` or nothing; from a non-board workspace passes `--off-board`.
   Every mutation via `v.run(…, "board", …)`.
4. Update Go tests (`internal/modules/board/focus_test.go`,
   `internal/todo/focus_test.go`) — the fixture fakes the CLI with a shell
   script; extend it or use the real built CLI with a temp `DOTFILES_DATA_DIR`.

### Phase 4 — Docs, completions, build

1. Regenerate completions; run `fish -n` on the file.
2. Update `apps/todo-tui/README.md` and `apps/todo-tui/cli/README.md`.
3. `bun run build` (cli), rebuild `bin/todo-tui`.
4. Update memory note if the agent keeps one for todo-tui.

## Verification (run all; paste results in the final report)

Always export a temp data dir first. Pass arguments as separate words
(quote the whole invocation only through `"$@"`); a previous session added
junk tasks to real data by passing a whole probe string as one argument.

```bash
export DOTFILES_DATA_DIR="$(mktemp -d)"
t() { bun ~/.config/dotfiles/apps/todo-tui/cli/todo.ts "$@" </dev/null; }
```

- Help at every depth: `t board --help`, `t board add -h`, `t config panel-layout --help`, `t help board later` — each shows its own node.
- Typos (non-TTY must error with suggestion, exit 1, and create nothing):
  `t bord`, `t board ad 3`, `t board use projcten`, `t add x --laetr`,
  `t panel --sied`, `t config panel-layot side`, `t config panel-layout sid`.
  After all of them `jq length "$DOTFILES_DATA_DIR/todo/tasks.json"` is unchanged.
- Implicit add still works: `t buy milk` adds a task.
- Boards: new/use/off/add/rm/later/now/extend/rename/end, `--on`, `--later`,
  `--off-board`, expiry wrap-up into an epic, migration from a hand-written
  `focus.json`.
- Panel: `COLUMNS=160`, `90`, `60` with layout auto/side/stack; board off →
  all tasks + footer for running timed boards.
- Completions: `todo completions fish | fish -n`; committed file matches.
- TUI: `go test ./...`; manual run of `bin/todo-tui` with a temp data dir
  (`DOTFILES_DATA_DIR=… ~/.config/dotfiles/bin/todo-tui`).

## Rules for the executing agent

- House style (`~/.claude/CLAUDE.md`): `function` declarations for standalone
  functions (no `const f = () =>`), arrow callbacks; no empty catch; a single
  non-exported type in a file is named `Props`; no explanatory comments (JSDoc
  on helpers, and "why" notes on workarounds only).
- Never run probes against real data (`~/.dotfiles/todo`). If it happens,
  restore from a copy you made first and say so.
- The git tree has unrelated uncommitted work (bpr, gpr, keybind-manager,
  aliases…). Touch only `apps/todo-tui/**`,
  `configs/fish/completions/todo.fish`,
  `configs/fish/functions/show_todos_startup.fish`, `bin/todo-tui`. Do not
  commit unless asked.
- Final report: files changed, checks run with results, anything skipped or risky.
