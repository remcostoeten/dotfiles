import type { TaskReminder } from "../domain/task";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Anything due inside this window renders as urgent rather than merely upcoming. */
export const SOON_WINDOW_MS = 30 * MINUTE_MS;

export const DUE_COLORS = {
  reset: "\u001B[0m",
  dim: "\u001B[2m",
  bold: "\u001B[1m",
  overdue: "\u001B[38;5;203m",
  soon: "\u001B[38;5;229m",
  upcoming: "\u001B[38;5;116m",
  label: "\u001B[38;5;147m",
};

/** Fixed so month names stay three letters regardless of the host's ICU data or locale. */
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type DueUrgency = "overdue" | "soon" | "upcoming";

export function getDueUrgency(dueAt: number, now: number): DueUrgency {
  if (dueAt < now) return "overdue";
  return dueAt - now <= SOON_WINDOW_MS ? "soon" : "upcoming";
}

export function getUrgencyColor(dueAt: number, now: number): string {
  return DUE_COLORS[getDueUrgency(dueAt, now)];
}

/** `08 Sep 2026 · 16:42` — the exact timestamp, shown only by `todo due <id>`. */
export function formatAbsoluteDue(dueAt: number): string {
  const date = new Date(dueAt);
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = MONTH_NAMES[date.getMonth()];
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${day} ${month} ${date.getFullYear()} · ${hours}:${minutes}`;
}

/** `in 18h 23m` / `overdue by 1d 2h` — two-unit precision for the inspect view. */
export function formatRelativeDue(dueAt: number, now: number): string {
  const difference = dueAt - now;
  const parts = splitDuration(Math.abs(difference), 2);
  return difference < 0 ? `overdue by ${parts}` : `in ${parts}`;
}

/**
 * The short form shown on ordinary task rows: `due in 10m`, `due tomorrow`, `due 12 Sep`,
 * `overdue 3d`. Single unit only, so a row never grows noticeably wider.
 */
export function formatCompactDue(dueAt: number, now: number): string {
  if (dueAt < now) return `overdue ${splitDuration(now - dueAt, 1)}`;

  const difference = dueAt - now;
  if (difference < HOUR_MS) return `due in ${splitDuration(difference, 1)}`;

  const dayGap = countCalendarDaysBetween(now, dueAt);
  if (dayGap === 0) return `due in ${splitDuration(difference, 1)}`;
  if (dayGap === 1) return "due tomorrow";
  return `due ${formatShortDate(dueAt, now)}`;
}

/** `12 Sep`, or `12 Sep 2027` once the year differs from the current one. */
export function formatShortDate(dueAt: number, now: number): string {
  const date = new Date(dueAt);
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear() === new Date(now).getFullYear() ? "" : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${month}${year}`;
}

/** How the reminder's sound is described in the inspect view. */
export function formatSound(reminder: TaskReminder): string {
  if (reminder.soundMode === "none") return "none";
  if (reminder.soundMode === "default") return "default";
  return reminder.soundPath ?? "custom";
}

export function formatNotifyState(reminder: TaskReminder): string {
  return reminder.firedAt === undefined ? "enabled" : `fired ${formatAbsoluteDue(reminder.firedAt)}`;
}

/** Whole calendar days between two instants, ignoring the clock time on either side. */
export function countCalendarDaysBetween(from: number, to: number): number {
  const start = startOfDay(new Date(from));
  const end = startOfDay(new Date(to));
  return Math.round((end - start) / DAY_MS);
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Renders a span as up to `maximumParts` descending units, e.g. `1d 2h` or `20m`. */
function splitDuration(milliseconds: number, maximumParts: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const units: Array<[number, string]> = [
    [86_400, "d"],
    [3600, "h"],
    [60, "m"],
    [1, "s"],
  ];

  const parts: string[] = [];
  let remaining = totalSeconds;
  for (const [size, suffix] of units) {
    const amount = Math.floor(remaining / size);
    if (amount === 0 && parts.length === 0) continue;
    if (amount > 0) parts.push(`${amount}${suffix}`);
    remaining -= amount * size;
    if (parts.length >= maximumParts) break;
  }
  return parts.length === 0 ? "0s" : parts.join(" ");
}
