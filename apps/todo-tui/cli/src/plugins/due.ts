import { randomUUID } from "node:crypto";
import { resolveCommandCwd } from "../adapters/command-runner";
import { resolveSoundChoice, type SoundChoice } from "../adapters/sound";
import { resolveDueExpression } from "../domain/due-expression";
import type { Task, TaskReminder } from "../domain/task";
import { findTaskByIdOrDescription } from "../domain/task-tree";
import { UserInputError } from "../domain/user-input-error";
import {
  DUE_COLORS,
  formatAbsoluteDue,
  formatCompactDue,
  formatNotifyState,
  formatRelativeDue,
  formatSound,
  getUrgencyColor,
} from "../presentation/due-format";
import { formatDueHelp, type DueHelpTopic } from "../presentation/due-help";
import { runScheduler } from "../scheduler/daemon";
import { installService, isServiceActive, SERVICE_NAME } from "../scheduler/service";
import type { TodoStore } from "../storage/todo-store";
import type { CommandContext, TodoPlugin } from "./types";

const { reset, dim, bold, label } = DUE_COLORS;
const HELP_TOKENS = new Set(["help", "-h", "--help"]);
const CLEAR_WORDS = new Set(["clear", "remove"]);
const DUE_USAGE = "Usage: todo due <todo> <when> | todo due <todo> [clear|reset] | todo due list";

export const duePlugin: TodoPlugin = {
  name: "due",
  description: "Set, inspect, and clear due dates with reminders.",
  register(app) {
    app.command("due", "Set, inspect, and clear due dates with reminders.", dueCommand, {
      group: "Change",
      positional: "any",
      ownHelp: true,
      usage: [
        "todo due <todo> <when> [at <time>] [options]",
        "todo due <todo>",
        "todo due <todo> clear",
        "todo due <todo> reset",
        "todo due list [overdue|today|week]",
      ],
      details: [
        "Relative (10m, 1h, 3,5h, 2d), calendar (tomorrow, next monday), and dates (12-06, 12 juli).",
        "A due date notifies once, natively, even after the shell that set it has exited.",
        "Run `todo due --help` for the full date syntax.",
      ],
      options: [
        { flag: "--sound <default|none|file>", description: "Notification sound; a custom file is stored as an absolute path" },
        { flag: "--run <command>", description: "Command to execute once when the reminder fires" },
        { flag: "--cwd <path|pwd>", description: "Working directory for --run; pwd captures the current one" },
      ],
      examples: [
        { command: "todo due 27 tomorrow" },
        { command: "todo due 27 3,5h" },
        { command: "todo due 27 \"next monday\" at 09:00" },
        { command: "todo due 27 10m --run \"bun run build\" --cwd pwd" },
        { command: "todo due list overdue" },
      ],
    });
  },
};

async function dueCommand(context: CommandContext): Promise<void> {
  const { args, stdout } = context;

  const helpIndex = args.findIndex((argument) => HELP_TOKENS.has(argument));
  if (helpIndex !== -1) {
    stdout.write(formatDueHelp(readHelpTopic(args.slice(0, helpIndex))));
    return;
  }

  const [first, ...rest] = args;
  if (first === undefined) throw new UserInputError(DUE_USAGE);
  if (first === "list") return await listDue(context, rest);
  if (first === "daemon") return await daemonCommand(context, rest);
  return await targetedDueCommand(context, first, rest);
}

/** Picks the most specific help page for the arguments that came before the help token. */
function readHelpTopic(prefix: string[]): DueHelpTopic {
  if (prefix.length === 0) return "due";
  if (prefix[0] === "list") return "list";
  if (prefix[0] === "daemon") return "daemon";
  if (prefix[1] !== undefined && CLEAR_WORDS.has(prefix[1])) return "clear";
  if (prefix[1] === "reset") return "reset";
  if (prefix.length === 1) return "inspect";
  return "due";
}

async function targetedDueCommand({ store, stdout }: CommandContext, selector: string, rest: string[]): Promise<void> {
  const verb = rest[0];

  if (verb === undefined) {
    const task = findTaskByIdOrDescription(await store.loadTasks(), selector);
    stdout.write(formatInspect(task, Date.now()));
    return;
  }

  if (CLEAR_WORDS.has(verb)) {
    if (rest.length !== 1) throw new UserInputError(`Usage: todo due ${selector} clear`);
    return await mutate(store, selector, (tasks, task) => clearDue(tasks, task, stdout));
  }

  if (verb === "reset") {
    if (rest.length !== 1) throw new UserInputError(`Usage: todo due ${selector} reset`);
    return await mutate(store, selector, (tasks, task) => resetDue(tasks, task, stdout));
  }

  // Options are validated before the lock is taken, so bad input fails fast holding nothing.
  const options = parseDueOptions(rest);
  return await mutate(store, selector, (tasks, task) => setDue(tasks, task, options, stdout));
}

/**
 * Runs a due-date change as one locked read-modify-write, so two terminals editing different
 * todos at the same time cannot clobber each other's task file.
 */
async function mutate(store: TodoStore, selector: string, change: (tasks: Task[], task: Task) => boolean): Promise<void> {
  await store.runExclusive(async () => {
    const tasks = await store.loadTasks();
    const task = findTaskByIdOrDescription(tasks, selector);
    if (change(tasks, task)) await store.saveTasks(tasks);
  });
}

function setDue(tasks: Task[], task: Task, options: DueOptions, stdout: CommandContext["stdout"]): boolean {
  const { when, sound, run, cwd } = options;
  const now = new Date();

  const dueAt = resolveDueExpression(when, now);
  const reminder: TaskReminder = {
    id: randomUUID(),
    dueAt,
    expression: when,
    createdAt: now.getTime(),
    soundMode: sound.soundMode,
  };
  if (sound.soundPath !== undefined) reminder.soundPath = sound.soundPath;
  if (run !== undefined) reminder.run = run;
  if (cwd !== undefined) reminder.cwd = cwd;

  task.reminder = reminder;
  task.dueDate = dueAt;
  task.updatedAt = now.getTime();

  const color = getUrgencyColor(dueAt, now.getTime());
  stdout.write(`${color}Due #${task.id}${reset} ${bold}${formatAbsoluteDue(dueAt)}${reset} ${dim}(${formatRelativeDue(dueAt, now.getTime())})${reset}\n`);
  return true;
}

function clearDue(_tasks: Task[], task: Task, stdout: CommandContext["stdout"]): boolean {
  if (task.reminder === undefined && task.dueDate === undefined) {
    stdout.write(`${dim}#${task.id} has no due date${reset}\n`);
    return false;
  }
  delete task.reminder;
  delete task.dueDate;
  task.updatedAt = Date.now();
  stdout.write(`${DUE_COLORS.upcoming}Cleared the due date on #${task.id}${reset}\n`);
  return true;
}

/** Rearms the current schedule without touching its due date, sound, or trigger command. */
function resetDue(_tasks: Task[], task: Task, stdout: CommandContext["stdout"]): boolean {
  const reminder = task.reminder;
  if (reminder === undefined) throw new UserInputError(`#${task.id} has no due date to reset. Set one with 'todo due ${task.id} <when>'.`);

  delete reminder.firedAt;
  delete reminder.soundError;
  delete reminder.runExitCode;
  delete reminder.runError;
  task.updatedAt = Date.now();

  const relative = formatRelativeDue(reminder.dueAt, Date.now());
  stdout.write(`${DUE_COLORS.upcoming}Rearmed the reminder on #${task.id}${reset} ${dim}(due ${formatAbsoluteDue(reminder.dueAt)}, ${relative})${reset}\n`);
  return true;
}

interface DueOptions {
  when: string;
  sound: SoundChoice;
  run: string | undefined;
  cwd: string | undefined;
}

const DUE_FLAGS = ["--sound", "--run", "--cwd"];

/** Splits the when-expression from the flags. Everything before the first `--flag` is the date. */
function parseDueOptions(rest: string[]): DueOptions {
  const flagStart = rest.findIndex((argument) => argument.startsWith("--"));
  const whenParts = flagStart === -1 ? rest : rest.slice(0, flagStart);
  const when = whenParts.join(" ").trim();
  if (when.length === 0) throw new UserInputError(DUE_USAGE);

  let sound: SoundChoice = { soundMode: "default" };
  let run: string | undefined;
  let cwd: string | undefined;
  let rawCwd: string | undefined;

  const flagArguments = flagStart === -1 ? [] : rest.slice(flagStart);
  for (let index = 0; index < flagArguments.length; index += 1) {
    const argument = flagArguments[index];
    if (argument === undefined) continue;
    const equalsIndex = argument.indexOf("=");
    const name = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);

    let value = equalsIndex === -1 ? "" : argument.slice(equalsIndex + 1);
    if (equalsIndex === -1) {
      const valueParts: string[] = [];
      while (index + 1 < flagArguments.length) {
        const next = flagArguments[index + 1];
        if (next === undefined || next.startsWith("--")) break;
        valueParts.push(next);
        index += 1;
      }
      value = valueParts.join(" ");
    }
    if (value.length === 0) throw new UserInputError(`Missing value for ${name}`);

    if (name === "--sound") sound = resolveSoundChoice(value);
    else if (name === "--run") run = value;
    else if (name === "--cwd") rawCwd = value;
    else throw new UserInputError(`Unknown option: ${name}\nSupported: ${DUE_FLAGS.join(", ")}`);
  }

  if (rawCwd !== undefined) {
    if (run === undefined) throw new UserInputError("--cwd only applies to --run; add a --run command or drop --cwd.");
    cwd = resolveCommandCwd(rawCwd);
  }

  return { when, sound, run, cwd };
}

function formatInspect(task: Task, now: number): string {
  const lines = [`${bold}Todo #${task.id}${reset} ${dim}${task.description}${reset}`];
  const reminder = task.reminder;

  if (reminder === undefined) {
    if (task.dueDate === undefined) {
      lines.push(`${dim}No due date. Set one with 'todo due ${task.id} tomorrow'.${reset}`);
      return `${lines.join("\n")}\n`;
    }
    lines.push(row("Due", `${formatAbsoluteDue(task.dueDate)}`));
    lines.push(row("Relative", formatRelativeDue(task.dueDate, now)));
    lines.push(row("Notify", `${dim}legacy reminder from 'todo add --due'${reset}`));
    return `${lines.join("\n")}\n`;
  }

  const color = getUrgencyColor(reminder.dueAt, now);
  lines.push(row("Due", `${color}${formatAbsoluteDue(reminder.dueAt)}${reset}`));
  lines.push(row("Relative", `${color}${formatRelativeDue(reminder.dueAt, now)}${reset}`));
  lines.push(row("Notify", task.status === "completed" ? "suppressed (completed)" : formatNotifyState(reminder)));
  lines.push(row("Sound", formatSound(reminder)));
  if (reminder.soundError !== undefined) lines.push(row("Sound error", `${DUE_COLORS.overdue}${reminder.soundError}${reset}`));
  if (reminder.run !== undefined) lines.push(row("Run", reminder.run));
  if (reminder.cwd !== undefined) lines.push(row("Cwd", reminder.cwd));
  if (reminder.runExitCode !== undefined) lines.push(row("Run result", formatRunResult(reminder)));
  return `${lines.join("\n")}\n`;
}

function formatRunResult(reminder: TaskReminder): string {
  if (reminder.runError !== undefined) return `${DUE_COLORS.overdue}${reminder.runError}${reset}`;
  const code = reminder.runExitCode;
  return code === 0 ? "exit 0" : `${DUE_COLORS.overdue}exit ${code}${reset}`;
}

function row(name: string, value: string): string {
  return `${label}${`${name}:`.padEnd(11)}${reset}${value}`;
}

type DueListFilter = "all" | "overdue" | "today" | "week";

async function listDue({ store, stdout }: CommandContext, rest: string[]): Promise<void> {
  const filter = readListFilter(rest);
  const now = Date.now();
  const tasks = (await store.loadTasks()).filter((task) => task.status === "pending" && task.dueDate !== undefined);
  const matching = tasks.filter((task) => matchesFilter(task.dueDate as number, filter, now)).sort(compareByUrgency);

  if (matching.length === 0) {
    stdout.write(`${dim}No todos with a due date${filter === "all" ? "" : ` (${filter})`}${reset}\n`);
    return;
  }

  const width = Math.min(28, Math.max(...matching.map((task) => task.description.length)));
  for (const task of matching) {
    const dueAt = task.dueDate as number;
    const color = getUrgencyColor(dueAt, now);
    const id = `${dim}#${task.id.padStart(2, "0")}${reset}`;
    const description = truncate(task.description, width).padEnd(width);
    stdout.write(`${id}  ${description}  ${color}${formatCompactDue(dueAt, now)}${reset}\n`);
  }
}

function readListFilter(rest: string[]): DueListFilter {
  const [filter, ...extra] = rest;
  if (filter === undefined) return "all";
  if (extra.length > 0) throw new UserInputError("Usage: todo due list [overdue|today|week]");
  if (filter === "overdue" || filter === "today" || filter === "week") return filter;
  throw new UserInputError(`Unknown filter: ${filter}\nUsage: todo due list [overdue|today|week]`);
}

function matchesFilter(dueAt: number, filter: DueListFilter, now: number): boolean {
  if (filter === "all") return true;
  if (filter === "overdue") return dueAt < now;
  const end = new Date(now);
  if (filter === "today") end.setHours(23, 59, 59, 999);
  else end.setDate(end.getDate() + 7);
  return dueAt <= end.getTime();
}

/** Overdue first with the most overdue at the top, then upcoming soonest first. */
function compareByUrgency(left: Task, right: Task): number {
  return (left.dueDate as number) - (right.dueDate as number);
}

function truncate(value: string, maximumLength: number): string {
  return value.length > maximumLength ? `${value.slice(0, maximumLength - 1)}…` : value;
}

async function daemonCommand({ store, stdout }: CommandContext, rest: string[]): Promise<void> {
  const action = rest[0] ?? "run";
  if (rest.length > 1) throw new UserInputError("Usage: todo due daemon [run|install|status]");

  if (action === "run") {
    await runScheduler(store);
    return;
  }

  if (action === "install") {
    const { path, enabled } = await installService();
    stdout.write(`${DUE_COLORS.upcoming}Wrote ${path}${reset}\n`);
    stdout.write(enabled ? `${DUE_COLORS.upcoming}Enabled and started ${SERVICE_NAME}${reset}\n` : `${DUE_COLORS.overdue}Could not enable ${SERVICE_NAME}; start it with 'systemctl --user enable --now ${SERVICE_NAME}'${reset}\n`);
    return;
  }

  if (action === "status") {
    const active = await isServiceActive();
    stdout.write(active ? `${DUE_COLORS.upcoming}${SERVICE_NAME} is running${reset}\n` : `${dim}${SERVICE_NAME} is not running. Install it with 'todo due daemon install'.${reset}\n`);
    return;
  }

  throw new UserInputError("Usage: todo due daemon [run|install|status]");
}
