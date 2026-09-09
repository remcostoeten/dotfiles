import { buildIndex } from "./index-build";
import { applyFilters, deepGrep, emptyFilters, parseWhen, type TFilters } from "./filter";
import { bold, dim, setColor } from "./format";
import { printCompletions, printList, printStats, toJson } from "./report";
import { runTui } from "./tui";
import type { TTool } from "./types";

function usage(): string {
  return `${bold("ai-history")} — one browsable view over every Claude Code and Codex session

  ai-history                 interactive, filterable list (newest first)
  ai-history [filters] [--json]
                             headless output for piping

filters
  --project <substr>         match against the session cwd
  --tool claude|codex        only one tool
  --since <expr>             "3d", "2w", "12h", "2026-08-01"
  --until <expr>             same syntax
  --grep <pattern>           search titles, cwd, prompts and transcript bodies
                             (regex when the pattern compiles as one)
  --shallow                  restrict --grep to the index; skips transcript bodies
  --branch <name>            exact git branch match
  --limit <n>                default 50 headless, unlimited interactive
  --include-subagents        include subagent / sidechain sessions

output
  --json                     machine-readable, for jq
  --stats                    aggregate summary instead of a list
  --no-color                 plain text (also automatic when piped)
  --reindex                  force a full cache rebuild
  --verbose                  print index counts and timing to stderr
  --complete <projects|branches|tools>
                             list known values, one per line, for shell completion
  -h, --help                 this text`;
}

type TOptions = {
  filters: TFilters;
  limit: number | null;
  json: boolean;
  stats: boolean;
  reindex: boolean;
  shallow: boolean;
  verbose: boolean;
  help: boolean;
  complete: string | null;
  interactive: boolean;
  error: string | null;
};

function parseArgs(argv: string[]): TOptions {
  const options: TOptions = {
    filters: emptyFilters(),
    limit: null,
    json: false,
    stats: false,
    reindex: false,
    shallow: false,
    verbose: false,
    help: false,
    complete: null,
    interactive: true,
    error: null,
  };
  let colorOverride = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = () => argv[++i];

    switch (arg) {
      case "-h":
      case "--help":
        options.help = true;
        break;
      case "--project": {
        const value = next();
        if (!value) options.error = "--project needs a value";
        else {
          options.filters.project = value;
          options.interactive = false;
        }
        break;
      }
      case "--tool": {
        const value = next();
        if (value !== "claude" && value !== "codex") options.error = "--tool must be claude|codex";
        else {
          options.filters.tool = value as TTool;
          options.interactive = false;
        }
        break;
      }
      case "--since":
      case "--until": {
        const value = next();
        const when = value ? parseWhen(value) : null;
        if (when === null) options.error = `${arg} could not parse "${value ?? ""}"`;
        else {
          if (arg === "--since") options.filters.since = when;
          else options.filters.until = when;
          options.interactive = false;
        }
        break;
      }
      case "--grep": {
        const value = next();
        if (!value) options.error = "--grep needs a pattern";
        else {
          options.filters.grep = value;
          options.interactive = false;
        }
        break;
      }
      case "--branch": {
        const value = next();
        if (!value) options.error = "--branch needs a value";
        else {
          options.filters.branch = value;
          options.interactive = false;
        }
        break;
      }
      case "--limit": {
        const value = Number(next());
        if (!Number.isFinite(value) || value <= 0) options.error = "--limit needs a positive number";
        else options.limit = Math.floor(value);
        break;
      }
      case "--include-subagents":
        options.filters.includeSubagents = true;
        break;
      case "--json":
        options.json = true;
        options.interactive = false;
        break;
      case "--stats":
        options.stats = true;
        options.interactive = false;
        break;
      case "--no-color":
        colorOverride = false;
        break;
      case "--reindex":
        options.reindex = true;
        break;
      case "--shallow":
        options.shallow = true;
        break;
      case "--verbose":
        options.verbose = true;
        break;
      case "--complete": {
        const value = next();
        if (!value) options.error = "--complete needs projects|branches|tools";
        else {
          options.complete = value;
          options.interactive = false;
        }
        break;
      }
      case "--interactive":
        options.interactive = true;
        break;
      default:
        options.error = `unknown option: ${arg}`;
    }
  }

  setColor(colorOverride && Boolean(process.stdout.isTTY) && !process.env.NO_COLOR);
  return options;
}

export async function run(argv: string[]): Promise<void> {
  const options = parseArgs(argv);

  if (options.error) {
    process.stderr.write(`ai-history: ${options.error}\n\n${usage()}\n`);
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const { sessions, stats } = await buildIndex(options.reindex);

  if (options.complete) {
    printCompletions(sessions, options.complete);
    return;
  }

  if (options.verbose) {
    process.stderr.write(
      `${dim(
        `indexed ${stats.claudeTranscripts} claude transcripts, ${stats.codexRollouts} codex rollouts, ` +
          `${stats.claudePrompts} claude prompts, ${stats.codexThreadNames} codex thread names ` +
          `(${stats.parsed} parsed, ${stats.cached} cached) in ${stats.elapsedMs}ms`,
      )}\n`,
    );
  }

  if (!process.stdout.isTTY) options.interactive = false;

  if (options.interactive && !options.json && !options.stats) {
    await runTui(sessions, options.filters);
    return;
  }

  let matched = applyFilters(sessions, options.filters);

  if (options.filters.grep && !options.shallow) {
    const candidates = applyFilters(sessions, { ...options.filters, grep: null });
    matched = await deepGrep(candidates, matched, options.filters.grep);
  }

  if (options.stats) {
    printStats(matched);
    return;
  }

  const limit = options.limit ?? 50;
  const limited = matched.slice(0, limit);

  if (options.json) {
    process.stdout.write(`${toJson(limited)}\n`);
    return;
  }

  const width = process.stdout.columns ?? 100;
  printList(limited, width);
  if (matched.length > limited.length) {
    process.stderr.write(
      `${dim(`… ${matched.length - limited.length} more; raise --limit to see them`)}\n`,
    );
  }
}
