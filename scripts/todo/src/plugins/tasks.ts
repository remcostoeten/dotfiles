import { normalizeShellDisplayLimit, parseShellDisplayLimit, toShellDisplayCount } from "../domain/shell-display-limit";
import type { Task } from "../domain/task";
import { buildTaskTreeRows, excludeHiddenSubtrees } from "../domain/task-tree";
import { UnknownTokenError } from "../domain/unknown-token-error";
import { UserInputError } from "../domain/user-input-error";
import { formatTaskRowForShellDisplay, formatTaskTreeRowForDisplay, getVisibleLength, isOverdue, isUpcoming } from "../presentation/task-format";
import { removeAllPendingTasks } from "./remove";
import type { CommandContext, TodoPlugin } from "./types";

const DIM = "\u001B[2m";
const RESET = "\u001B[0m";
const GREEN = "\u001B[38;5;166m";
const PANEL_WIDTH = 72;

export const tasksPlugin: TodoPlugin = {
  name: "tasks",
  description: "Lists tasks.",
  register(app) {
    app.command("shell-display", "Print the compact pending-task panel used at shell startup.", async ({ args, store, stdout }) => {
      const tasks = await store.loadTasks();
      const pendingTasks = excludeHiddenSubtrees(tasks).filter((task) => task.status === "pending");

      if (pendingTasks.length === 0) {
        const completedCount = tasks.filter((task) => task.status === "completed").length;
        const completedText = completedCount > 0 ? `${DIM} · ${completedCount} completed${RESET}` : "";
        stdout.write(formatShellPanel([{ left: `${GREEN}✓ All caught up${RESET}${completedText}`, right: "" }]));
        return;
      }

      const config = await store.loadConfig();
      const limit = resolveShellDisplayLimit(args, config.shellDisplayLimit);
      const now = Date.now();
      const rows = buildTaskTreeRows(pendingTasks, tasks, { compare: compareTasksForShell, collapsedIds: await store.loadCollapsedEpicIds() });
      const lines = rows.slice(0, limit).map((row) => formatTaskRowForShellDisplay(row, now));
      const hiddenTaskCount = rows.length - lines.length;
      if (hiddenTaskCount > 0) {
        lines.push({
          left: `${DIM}↳ ${hiddenTaskCount} more task${hiddenTaskCount === 1 ? "" : "s"}${RESET}`,
          right: `${DIM}todo config shell-limit all${RESET}`,
        });
      }
      stdout.write(formatShellPanel(lines));
    }, {
      group: "View",
      usage: ["todo shell-display [--limit <n|all>]"],
      details: ["Runs automatically when stdin is not a terminal. TODO_SHELL_LIMIT overrides the configured count too.", "Tasks hidden with `todo hide` stay out of the panel."],
      options: [
        { flag: "--limit <n|all>", description: "Rows to show before folding the rest into a summary line" },
        { flag: "--all", description: "Same as --limit all" },
      ],
    });

    app.command("list", "List tasks as a tree.", async ({ args, store, stdout }) => {
      if (args[0] === "delete" && args[1] === "all") {
        if (args.length !== 2) throw new UserInputError("Usage: todo list delete all");
        await removeAllPendingTasks(store, stdout);
        return;
      }
      await listTasks(args, store, stdout);
    }, {
      group: "View",
      aliases: ["tree"],
      usage: ["todo list [filter]"],
      details: ["Pending tasks by default, without anything hidden via `todo hide`. Filtered views show matches flat when their parent is not part of the result."],
      options: [
        { flag: "--all", description: "Include completed and hidden tasks" },
        { flag: "--overdue", description: "Only pending tasks past their due date" },
        { flag: "--upcoming", description: "Only pending tasks due soon" },
      ],
      examples: [{ command: "todo list" }, { command: "todo tree --overdue" }, { command: "todo list delete all", note: "same as todo rm all" }],
    });
  },
};

async function listTasks(args: string[], store: CommandContext["store"], stdout: CommandContext["stdout"]): Promise<void> {
  const tasks = await store.loadTasks();
  const now = Date.now();
  const rows = buildTaskTreeRows(filterTasks(tasks, args[0], now), tasks, { compare: compareTasks, collapsedIds: await store.loadCollapsedEpicIds() });

  if (rows.length === 0) {
    stdout.write(`${DIM}No tasks found${RESET}\n`);
    return;
  }

  for (const row of rows) {
    stdout.write(`${formatTaskTreeRowForDisplay(row, now)}\n`);
  }
}

function resolveShellDisplayLimit(args: string[], configuredLimit: number): number {
  const requested = readLimitArgument(args) ?? process.env.TODO_SHELL_LIMIT;
  const limit = requested === undefined ? normalizeShellDisplayLimit(configuredLimit) : parseShellDisplayLimit(requested);
  return toShellDisplayCount(limit);
}

function readLimitArgument(args: string[]): string | undefined {
  if (args.includes("--all")) return "all";

  const inlineArgument = args.find((argument) => argument.startsWith("--limit="));
  if (inlineArgument !== undefined) return inlineArgument.slice("--limit=".length);

  const flagIndex = args.indexOf("--limit");
  if (flagIndex === -1) return undefined;

  const value = args[flagIndex + 1];
  if (value === undefined) throw new UserInputError("Usage: todo shell-display --limit <count|all>");
  return value;
}

const LIST_FILTERS = ["--all", "--overdue", "--upcoming"];

function filterTasks(tasks: Task[], filter: string | undefined, now: number): Task[] {
  if (filter !== undefined && filter.startsWith("-") && !LIST_FILTERS.includes(filter)) {
    throw new UnknownTokenError(`Unknown option: ${filter}`, filter, LIST_FILTERS, "option");
  }
  if (filter === "--all") return [...tasks];

  const pendingTasks = excludeHiddenSubtrees(tasks).filter((task) => task.status === "pending");
  if (filter === "--overdue") {
    return pendingTasks.filter((task) => task.dueDate !== undefined && isOverdue(task.dueDate, now));
  }
  if (filter === "--upcoming") {
    return pendingTasks.filter((task) => task.dueDate !== undefined && isUpcoming(task.dueDate, now));
  }
  return pendingTasks;
}

function compareTasks(left: Task, right: Task): number {
  if (left.dueDate !== undefined && right.dueDate !== undefined) return left.dueDate - right.dueDate;
  if (left.dueDate !== undefined) return -1;
  if (right.dueDate !== undefined) return 1;
  return 0;
}

function compareTasksForShell(left: Task, right: Task): number {
  const dueDateOrder = compareTasks(left, right);
  return dueDateOrder === 0 ? left.createdAt - right.createdAt : dueDateOrder;
}

function formatShellPanel(lines: Array<{ left: string; right: string }>): string {
  const output = [formatPanelBorder("╭", "╮")];
  for (const line of lines) {
    output.push(formatPanelLine(line.left, line.right));
  }
  output.push(formatPanelBorder("╰", "╯"));
  return `${output.join("\n")}\n`;
}

function formatPanelLine(left: string, right = ""): string {
  const padding = " ".repeat(Math.max(1, PANEL_WIDTH - getVisibleLength(left) - getVisibleLength(right)));
  return `${DIM}│${RESET} ${left}${padding}${right} ${DIM}│${RESET}`;
}

function formatPanelBorder(left: string, right: string): string {
  return `${DIM}${left}${"─".repeat(PANEL_WIDTH + 2)}${right}${RESET}`;
}
