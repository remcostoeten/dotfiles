import type { Task, TaskPriority } from "../domain/task";
import type { TaskTreeRow } from "../domain/task-tree";
import { formatCompactDue } from "./due-format";

const RESET = "\u001B[0m";
const DIM = "\u001B[2m";
const BOLD = "\u001B[1m";
const GREEN = "\u001B[38;5;114m";
const RED = "\u001B[38;5;203m";
const YELLOW = "\u001B[38;5;229m";
const PEACH = "\u001B[38;5;208m";
const SKY = "\u001B[38;5;116m";
const SUBTEXT = "\u001B[38;5;217m";

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  none: SUBTEXT,
  low: SKY,
  medium: YELLOW,
  high: RED,
};

export function formatTaskForDisplay(task: Task, now = Date.now()): string {
  return formatTask(task, task.description, now, true);
}

/** Renders one tree row for `todo list`: connector glyphs, the task, and an epic progress badge. */
export function formatTaskTreeRowForDisplay(row: TaskTreeRow, now = Date.now()): string {
  const description = row.hasChildren || row.task.kind === "epic" ? `${BOLD}${row.task.description}${RESET}` : row.task.description;
  return `${formatTreePrefix(row)}${formatTask(row.task, description, now, true)}${formatRowSuffix(row)}`;
}

export function formatTaskForShellDisplay(task: Task, now = Date.now()): { left: string; right: string } {
  return formatTaskRowForShellDisplay({ task, depth: 0, siblingFollows: [false], hasChildren: false, childCount: 0, collapsed: false, progress: { total: 0, completed: 0 } }, now);
}

export function formatTaskRowForShellDisplay(row: TaskTreeRow, now = Date.now()): { left: string; right: string } {
  const prefix = formatTreePrefix(row);
  const badge = formatRowSuffix(row);
  const description = truncate(row.task.description, Math.max(12, 38 - getVisibleLength(prefix) - getVisibleLength(badge)));
  const emphasized = row.hasChildren || row.task.kind === "epic" ? `${BOLD}${description}${RESET}` : description;
  const taskText = formatTask(row.task, emphasized, now, false);
  const id = `${DIM}#${row.task.id.padStart(2, "0")}${RESET}`;
  return {
    left: `${id}  ${prefix}${taskText}${badge}`,
    right: `${DIM}${formatCreatedAt(row.task.createdAt)}${RESET}`,
  };
}

/** Box-drawing connectors for a nested row: `│  ` for continuing ancestors, `├─ ` or `└─ ` for the row itself. */
export function formatTreePrefix(row: TaskTreeRow): string {
  if (row.depth === 0) return "";
  const guides = row.siblingFollows.slice(1, -1).map((follows) => (follows ? "│  " : "   "));
  const connector = row.siblingFollows[row.siblingFollows.length - 1] ? "├─ " : "└─ ";
  return `${DIM}${guides.join("")}${connector}${RESET}`;
}

export function formatProgressBadge(row: TaskTreeRow): string {
  if (row.progress.total > 0) {
    const color = row.progress.completed === row.progress.total ? GREEN : SKY;
    return ` ${color}[${row.progress.completed}/${row.progress.total}]${RESET}`;
  }
  return row.task.kind === "epic" ? ` ${DIM}[epic]${RESET}` : "";
}

/** A collapsed epic trades its progress badge for the count of subtickets folded away. */
export function formatCollapsedSummary(row: TaskTreeRow): string {
  return ` ${SKY}●${RESET} ${DIM}${row.childCount} subticket${row.childCount === 1 ? "" : "s"}${RESET}`;
}

function formatRowSuffix(row: TaskTreeRow): string {
  return row.collapsed ? formatCollapsedSummary(row) : formatProgressBadge(row);
}

function formatTask(task: Task, description: string, now: number, includeId: boolean): string {
  const parts: string[] = [];

  if (task.priority !== "none") {
    parts.push(`${PRIORITY_COLORS[task.priority]}[${task.priority.toUpperCase()}]${RESET}`);
  }

  parts.push(`${getUrgencyColor(task.dueDate, now)}${description}${RESET}`);

  if (task.dueDate !== undefined) {
    parts.push(`${getUrgencyColor(task.dueDate, now)}${formatCompactDue(task.dueDate, now)}${RESET}`);
  }

  if (includeId) parts.push(`${DIM}(${task.id})${RESET}`);
  return parts.join(" ");
}

export function isUpcoming(timestamp: number, now = Date.now()): boolean {
  const difference = timestamp - now;
  return difference > 0 && difference < 30 * 60 * 1000;
}

export function isOverdue(timestamp: number, now = Date.now()): boolean {
  return timestamp < now;
}

function getUrgencyColor(timestamp: number | undefined, now: number): string {
  if (timestamp === undefined) return SUBTEXT;
  if (isOverdue(timestamp, now)) return RED;
  if (isUpcoming(timestamp, now)) return YELLOW;
  if ((timestamp - now) / (60 * 60 * 1000) < 2) return PEACH;
  return SUBTEXT;
}

function truncate(value: string, maximumLength: number): string {
  return value.length > maximumLength ? `${value.slice(0, maximumLength - 3)}...` : value;
}

export function getVisibleLength(value: string): number {
  return value.replace(/\u001B\[[0-9;]*m/g, "").length;
}

function formatCreatedAt(timestamp: number): string {
  const date = new Date(timestamp);
  const month = date.toLocaleString(undefined, { month: "short" });
  const day = date.getDate().toString().padStart(2, "0");
  const time = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  return `${day} ${month} · ${time}`;
}
