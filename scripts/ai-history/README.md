# ai-history

One browsable, filterable view over every Claude Code and Codex session on this
machine. Reads `~/.claude` and `~/.codex` and never writes to either.

```
ai-history                                  interactive list, newest first
ai-history --grep shieldcn                  find the session that touched it
ai-history --project dora --since 2w        narrow by cwd and time
ai-history --tool codex --json | jq         machine-readable
ai-history --stats --since 30d              totals by project, tool, day and model
```

## Sources

| File | Role |
| --- | --- |
| `~/.claude/history.jsonl` | every prompt typed into Claude Code; reaches further back than the transcripts do |
| `~/.claude/projects/<slug>/<sessionId>.jsonl` | full Claude transcripts, plus `<sessionId>/subagents/agent-*.jsonl` |
| `~/.codex/history.jsonl` | every prompt typed into Codex (`ts` is seconds, not milliseconds) |
| `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | Codex transcripts, plus `~/.codex/archived_sessions` |
| `~/.codex/session_index.jsonl` | Codex `thread_name` values, used as the display title |

Session titles come from Claude's `ai-title` records and Codex's `thread_name`,
falling back to the first typed prompt. Cost, duration and line counts come from
Claude's `cost-state` record; Codex records no cost, so those cells stay blank
rather than reading `$0.00`.

Subagent traffic — Claude sidechains, `subagents/` transcripts, and Codex
rollouts with `thread_source: "subagent"` — is hidden unless you pass
`--include-subagents`. Workflow runs under `subagents/workflows/wf_*` are always
excluded.

Claude deletes transcripts after `cleanupPeriodDays`, but `history.jsonl`
outlives them. Those sessions still appear, marked with a `·` next to the source
glyph, and cannot be resumed.

## Keys

`ai-history` opens in filter mode: everything you type filters the list live. `esc`
clears the filter, then drops to browse mode, then quits.

| Key | Does |
| --- | --- |
| `↑` `↓` `ctrl-p` `ctrl-n` | move |
| `pgup` `pgdn` `ctrl-u` `ctrl-d` | page |
| `enter` | open the detail view |
| `esc` | detail → list, filter → browse, browse → quit |
| `ctrl-y` / `y` | copy the resume command (`wl-copy`, then `xclip`) |
| `ctrl-r` / `r` | run the resume command — press twice to confirm |
| `ctrl-o` / `o` | open the session cwd in `$EDITOR` |
| `t` | expand or collapse tool calls in the detail view |
| `?` | help overlay |
| `q` | quit (browse mode) |

Plain `y` / `r` / `o` / `q` only act in browse mode; in filter mode they are
just characters, so typing `readme` can never fire the resume binding.

## Searching

`--grep` searches titles, cwd, indexed prompts, and then the transcript bodies —
but only the parts a session actually authored: its prompts, the model's
replies, and the commands it chose to run. Captured command output and injected
context (skill catalogues, `AGENTS.md`, system prompts) are skipped on purpose;
they are near-identical in every transcript, so matching them made a search for
`shieldcn` return 528 files instead of 13. Pass `--shallow` to search only the
index.

The live filter in the TUI is index-only, so it stays instant; use `--grep` when
you need the bodies.

## Cache

`~/.cache/ai-history/index.json`, keyed by path + mtime + size. Only changed files are
re-parsed. `--reindex` forces a full rebuild; `--verbose` prints the counts and
timing to stderr.

Warm start is ~120ms on ~4900 sessions. A full rebuild over ~1500 Claude
transcripts and ~1500 Codex rollouts is ~3.2s.

## Completions

`configs/fish/completions/ai-history.fish`, symlinked into
`~/.config/fish/completions/` and declared in `dotfiles-studio.toml`. Values for
`--project`, `--branch` and `--tool` are pulled live from the index:

```
ai-history --complete projects    # name<TAB>N sessions, most-used first
ai-history --complete branches
ai-history --complete tools
```

Only fish is wired up. `configs/zsh/completions/` exists in this repo but is not
on `fpath`, so a zsh file there would never load.

## Development

```
bun ai-history.ts --help
bunx tsc --noEmit
```

No runtime dependencies — raw ANSI and stdin raw mode.
