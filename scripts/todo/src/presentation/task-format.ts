import type { Task, TaskPriority } from "../domain/task";

const RESET = "\u001B[0m";
const DIM = "\u001B[2m";
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

export function formatTaskForShellDisplay(task: Task, now = Date.now()): { left: string; right: string } {
  const description = truncate(task.description, 38);
  const taskText = formatTask(task, description, now, false);
  const id = `${DIM}#${task.id.padStart(2, "0")}${RESET}`;
  return {
    left: `${id}  ${taskText}`,
    right: `${DIM}${formatCreatedAt(task.createdAt)}${RESET}`,
  };
}

function formatTask(task: Task, description: string, now: number, includeId: boolean): string {
  const parts: string[] = [];

  if (task.dueDate !== undefined) {
    if (isUpcoming(task.dueDate, now)) {
      parts.push(`${YELLOW}[UPCOMING]${RESET}`);
    } else if (isOverdue(task.dueDate, now)) {
      parts.push(`${RED}[OVERDUE]${RESET}`);
    }
  }

  if (task.priority !== "none") {
    parts.push(`${PRIORITY_COLORS[task.priority]}[${task.priority.toUpperCase()}]${RESET}`);
  }

  parts.push(`${getUrgencyColor(task.dueDate, now)}${description}${RESET}`);

  if (task.dueDate !== undefined) {
    parts.push(`${DIM}- due ${formatTimeRemaining(task.dueDate, now)}${RESET}`);
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

function formatTimeRemaining(timestamp: number, now: number): string {
  const difference = timestamp - now;
  const absoluteMinutes = Math.floor(Math.abs(difference) / (60 * 1000));
  const hours = Math.floor(absoluteMinutes / 60);
  const days = Math.floor(hours / 24);

  if (difference < 0) {
    if (days > 0) return `${days}d overdue`;
    if (hours > 0) return `${hours}h overdue`;
    return `${absoluteMinutes} min ago`;
  }

  if (days > 0) {
    const remainingHours = hours % 24;
    return `in ${remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`}`;
  }

  if (hours > 0) {
    const remainingMinutes = absoluteMinutes % 60;
    return remainingMinutes > 0 ? `in ${hours}h ${remainingMinutes}m` : `in ${hours}h`;
  }

  return `in ${absoluteMinutes}m`;
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
