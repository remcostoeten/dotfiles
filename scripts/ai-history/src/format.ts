import type { TSession } from "./types";

let colorOn = true;

export function setColor(enabled: boolean): void {
  colorOn = enabled;
}

export function colorEnabled(): boolean {
  return colorOn;
}

function wrap(code: string, text: string): string {
  return colorOn ? `\x1b[${code}m${text}\x1b[0m` : text;
}

export const dim = (text: string) => wrap("2", text);
export const bold = (text: string) => wrap("1", text);
export const red = (text: string) => wrap("31", text);
export const green = (text: string) => wrap("32", text);
export const yellow = (text: string) => wrap("33", text);
export const blue = (text: string) => wrap("34", text);
export const magenta = (text: string) => wrap("35", text);
export const cyan = (text: string) => wrap("36", text);
export const white = (text: string) => wrap("97", text);
export const invert = (text: string) => wrap("7", text);

export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

export function visibleWidth(text: string): number {
  return stripAnsi(text).length;
}

export function pad(text: string, width: number): string {
  const size = visibleWidth(text);
  return size >= width ? text : text + " ".repeat(width - size);
}

export function padStart(text: string, width: number): string {
  const size = visibleWidth(text);
  return size >= width ? text : " ".repeat(width - size) + text;
}

export function truncate(text: string, width: number): string {
  if (width <= 0) return "";
  const plain = stripAnsi(text);
  if (plain.length <= width) return text;
  return `${plain.slice(0, Math.max(0, width - 1))}…`;
}

export function toolGlyph(session: TSession): string {
  return session.tool === "claude" ? magenta("●") : cyan("◆");
}

export function formatTime(ms: number): string {
  if (!ms) return "—";
  const date = new Date(ms);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const clock = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (sameDay) return clock;
  const days = Math.floor((now.getTime() - ms) / 86_400_000);
  if (days < 7 && days >= 0) {
    return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()]} ${clock}`;
  }
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${clock}`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return "";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h${String(minutes % 60).padStart(2, "0")}`;
}

export function formatCost(usd: number | null): string {
  if (usd === null) return "";
  if (usd < 0.01) return "$0.00";
  return `$${usd.toFixed(2)}`;
}

export function formatLines(added: number | null, removed: number | null): string {
  if (added === null && removed === null) return "";
  if (!added && !removed) return "";
  return `+${added ?? 0}/-${removed ?? 0}`;
}

export function formatDate(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function resumeCommand(session: TSession): string {
  const cwd = session.cwd || ".";
  return session.tool === "claude"
    ? `cd ${shellQuote(cwd)} && claude --resume ${session.id}`
    : `cd ${shellQuote(cwd)} && codex resume ${session.id}`;
}

export function shellQuote(value: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}
