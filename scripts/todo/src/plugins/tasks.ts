import { normalizeShellDisplayLimit, parseShellDisplayLimit, toShellDisplayCount } from "../domain/shell-display-limit";
import type { Task } from "../domain/task";
import { UserInputError } from "../domain/user-input-error";
import { formatTaskForDisplay, formatTaskForShellDisplay, getVisibleLength, isOverdue, isUpcoming } from "../presentation/task-format";
import { removeAllPendingTasks } from "./remove";
import type { TodoPlugin } from "./types";

const DIM = "\u001B[2m";
const RESET = "\u001B[0m";
const GREEN = "\u001B[38;5;166m";
const PANEL_WIDTH = 72;

export const tasksPlugin: TodoPlugin = {
  name: "tasks",
  description: "Lists tasks.",
  register(app) {
    app.command("shell-display", "Show pending tasks for shell startup; --limit <n|all> overrides the configured count.", async ({ args, store, stdout }) => {
      const tasks = await store.loadTasks();
      const pendingTasks = tasks.filter((task) => task.status === "pending").sort(compareTasksForShell);

      if (pendingTasks.length === 0) {
        const completedCount = tasks.filter((task) => task.status === "completed").length;
        const completedText = completedCount > 0 ? `${DIM} · ${completedCount} completed${RESET}` : "";
        stdout.write(formatShellPanel([{ left: `${GREEN}✓ All caught up${RESET}${completedText}`, right: "" }]));
        return;
      }

      const config = await store.loadConfig();
      const limit = resolveShellDisplayLimit(args, config.shellDisplayLimit);
      const now = Date.now();
      const lines = pendingTasks.slice(0, limit).map((task) => formatTaskForShellDisplay(task, now));
      const hiddenTaskCount = pendingTasks.length - lines.length;
      if (hiddenTaskCount > 0) {
        lines.push({
          left: `${DIM}↳ ${hiddenTaskCount} more task${hiddenTaskCount === 1 ? "" : "s"}${RESET}`,
          right: `${DIM}todo config shell-limit all${RESET}`,
        });
      }
      stdout.write(formatShellPanel(lines));
    });

    app.command("list", "List tasks, optionally filtered by --all, --overdue, or --upcoming.", async ({ args, store, stdout }) => {
      if (args[0] === "delete" && args[1] === "all") {
        if (args.length !== 2) throw new UserInputError("Usage: todo list delete all");
        await removeAllPendingTasks(store, stdout);
        return;
      }

      const tasks = await store.loadTasks();
      const now = Date.now();
      const filteredTasks = filterTasks(tasks, args[0], now).sort(compareTasks);

      if (filteredTasks.length === 0) {
        stdout.write(`${DIM}No tasks found${RESET}\n`);
        return;
      }

      for (const task of filteredTasks) {
        stdout.write(`${formatTaskForDisplay(task, now)}\n`);
      }
    });
  },
};

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

function filterTasks(tasks: Task[], filter: string | undefined, now: number): Task[] {
  if (filter === "--all") return [...tasks];

  const pendingTasks = tasks.filter((task) => task.status === "pending");
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
