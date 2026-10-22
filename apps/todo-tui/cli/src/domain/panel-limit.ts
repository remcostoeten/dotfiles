import { DEFAULT_CONFIG, UNLIMITED_PANEL_ROWS } from "./task";
import { UserInputError } from "./user-input-error";

/** Parses a user supplied panel row count. `all` and `0` both mean "every pending task". */
export function parsePanelLimit(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (normalized === "all" || normalized === "unlimited") return UNLIMITED_PANEL_ROWS;

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new UserInputError(`Invalid task count: ${value}. Use a whole number or 'all'.`);
  }
  return parsed;
}

/** Falls back to the default when a stored config value was hand edited into something unusable. */
export function normalizePanelLimit(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : DEFAULT_CONFIG.panelLimit;
}

/** Turns a stored limit into a slice length, where the unlimited sentinel keeps every task. */
export function toPanelRowCount(limit: number): number {
  return limit === UNLIMITED_PANEL_ROWS ? Number.POSITIVE_INFINITY : limit;
}

export function formatPanelLimit(limit: number): string {
  return limit === UNLIMITED_PANEL_ROWS ? "all" : `${limit}`;
}
