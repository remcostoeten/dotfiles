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
import { runScheduler } from "../scheduler/daemon";
import { installService, isServiceActive, SERVICE_NAME } from "../scheduler/service";
import type { TodoStore } from "../storage/todo-store";
import type { ParsedInput } from "../command-spec/parsed-input";
import type { CommandContext, CommandSpec } from "../command-spec/types";

const { reset, dim, bold, label } = DUE_COLORS;
const CLEAR_WORDS = new Set(["clear", "remove"]);

export const dueCommand: CommandSpec = {
  name: "due",
  summary: "Set, inspect, and clear due dates with reminders.",
  group: "Change",
  args: [
    { name: "todo", kind: "task-selector", description: "Task ID, #ID, or the exact name of a pending task" },
    { name: "when", kind: "due-time", variadic: true, optional: true, description: "When it is due, or clear / remove / reset; omit to inspect" },
  ],
  flags: [
    { name: "sound", value: "path", description: "default, none, or a sound file stored as an absolute path" },
    { name: "run", value: "shell-command", description: "Command to execute once when the reminder fires" },
    { name: "cwd", value: "path", description: "Working directory for --run; pwd captures the current one" },
  ],
  details: [
    "A due date notifies once, natively, even after the shell that set it has exited.",
    "`todo due <todo>` shows the due date and reminder state; `clear` (or `remove`) drops it; `reset` rearms a fired reminder without changing it.",
    "Omitting a time keeps the current local clock time. Past dates are valid; they store, render overdue, and notify once.",
    "`m` always means minutes. There is no month unit.",
  ],
  sections: [
    {
      heading: "Relative",
      rows: [
        { left: "30s", right: "30 seconds" },
        { left: "10m", right: "10 minutes" },
        { left: "1h", right: "1 hour" },
        { left: "3,5h", right: "3.5 hours (3.5h works too)" },
        { left: "2d", right: "2 calendar days" },
      ],
    },
    {
      heading: "Calendar",
      rows: [
        { left: "today", right: "today at the current clock time" },
        { left: "tomorrow", right: "tomorrow at the current clock time" },
        { left: "yesterday", right: "already overdue, on purpose" },
        { left: "next week", right: "same weekday, seven days on" },
        { left: "next monday", right: "the next Monday strictly after today" },
        { left: "next tue", right: "abbreviations work for every weekday" },
      ],
    },
    {
      heading: "Dates",
      rows: [
        { left: "1206", right: "12 June, current year" },
        { left: "12-06", right: "day first, the Dutch way" },
        { left: "12 jul", right: "English or Dutch month names" },
        { left: "12 juli", right: "same date as 12 jul" },
        { left: "12-06-2027", right: "two-digit years read as 20YY" },
      ],
    },
    {
      heading: "Times",
      rows: [
        { left: "tomorrow at 09:00", right: "HH:mm or HH:mm:ss, 24 hour" },
        { left: "next monday at 14:30" },
        { left: "12-06 at 18:00" },
      ],
    },
  ],
  examples: [
    { command: "todo due 27 tomorrow" },
    { command: "todo due 27 3,5h" },
    { command: "todo due 27 next monday at 09:00" },
    { command: "todo due 27 10m --run \"bun run build\" --cwd pwd" },
    { command: "todo due 27 clear" },
    { command: "todo due list overdue" },
  ],
  subcommands: [
    {
      name: "list",
      summary: "Every pending todo that has a due date, most urgent first.",
      args: [{ name: "filter", kind: { oneOf: ["overdue", "today", "week"] }, optional: true, description: "overdue, today (plus overdue) or week (plus overdue)" }],
      details: ["Overdue first, most overdue at the top, then upcoming soonest first. Completed todos are left out."],
      examples: [{ command: "todo due list" }, { command: "todo due list overdue" }],
      run: (input, context) => listDue(context, (input.optionalArg("filter") ?? "all") as DueListFilter),
    },
    {
      name: "daemon",
      summary: "The background scheduler that delivers reminders.",
      defaultSubcommand: "run",
      details: [
        "One scheduler handles every reminder; there is no process per todo.",
        "Any `todo` command also delivers overdue reminders, so the daemon is a delivery guarantee rather than a requirement.",
      ],
      subcommands: [
        {
          name: "run",
          summary: "Run the scheduler in the foreground; this is what the service starts.",
          details: ["Useful for debugging reminders. Stop it with Ctrl+C."],
          examples: [{ command: "todo due daemon run" }],
          async run(_input, { store }) {
            await runScheduler(store);
          },
        },
        {
          name: "install",
          summary: "Write and enable a systemd user service so reminders survive a reboot.",
          examples: [{ command: "todo due daemon install" }, { command: "todo due daemon status", note: "check it is running" }],
          async run(_input, { stdout }) {
            const { path, enabled } = await installService();
            stdout.write(`${DUE_COLORS.upcoming}Wrote ${path}${reset}\n`);
            stdout.write(enabled ? `${DUE_COLORS.upcoming}Enabled and started ${SERVICE_NAME}${reset}\n` : `${DUE_COLORS.overdue}Could not enable ${SERVICE_NAME}; start it with 'systemctl --user enable --now ${SERVICE_NAME}'${reset}\n`);
          },
        },
        {
          name: "status",
          summary: "Report whether the service is running.",
          examples: [{ command: "todo due daemon status" }],
          async run(_input, { stdout }) {
            const active = await isServiceActive();
            stdout.write(active ? `${DUE_COLORS.upcoming}${SERVICE_NAME} is running${reset}\n` : `${dim}${SERVICE_NAME} is not running. Install it with 'todo due daemon install'.${reset}\n`);
          },
        },
      ],
    },
  ],
  run: runDue,
};

async function runDue(input: ParsedInput, context: CommandContext): Promise<void> {
  const { store, stdout } = context;
  const selector = input.arg("todo");
  const when = input.args("when");
  const verb = when[0];

  if (verb === undefined) {
    const task = findTaskByIdOrDescription(await store.loadTasks(), selector);
    stdout.write(formatInspect(task, Date.now()));
    return;
  }

  if (CLEAR_WORDS.has(verb) && when.length === 1) {
    return await mutate(store, selector, (tasks, task) => clearDue(tasks, task, stdout));
  }

  if (verb === "reset" && when.length === 1) {
    return await mutate(store, selector, (tasks, task) => resetDue(tasks, task, stdout));
  }

  const options = readDueOptions(input);
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

function readDueOptions(input: ParsedInput): DueOptions {
  const when = input.args("when").join(" ").trim();
  const soundValue = input.value("sound");
  const sound: SoundChoice = soundValue === undefined ? { soundMode: "default" } : resolveSoundChoice(soundValue);
  const run = input.value("run");
  const rawCwd = input.value("cwd");
  if (rawCwd !== undefined && run === undefined) throw new UserInputError("--cwd only applies to --run; add a --run command or drop --cwd.");
  return { when, sound, run, cwd: rawCwd === undefined ? undefined : resolveCommandCwd(rawCwd) };
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

async function listDue({ store, stdout }: CommandContext, filter: DueListFilter): Promise<void> {
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
