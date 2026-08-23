import { DEFAULT_CONFIG, UNLIMITED_SHELL_DISPLAY } from "./task";
import { UserInputError } from "./user-input-error";

/** Parses a user supplied shell task count. `all` and `0` both mean "every pending task". */
export function parseShellDisplayLimit(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (normalized === "all" || normalized === "unlimited") return UNLIMITED_SHELL_DISPLAY;

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new UserInputError(`Invalid task count: ${value}. Use a whole number or 'all'.`);
  }
  return parsed;
}

/** Falls back to the default when a stored config value was hand edited into something unusable. */
export function normalizeShellDisplayLimit(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : DEFAULT_CONFIG.shellDisplayLimit;
}

/** Turns a stored limit into a slice length, where the unlimited sentinel keeps every task. */
export function toShellDisplayCount(limit: number): number {
  return limit === UNLIMITED_SHELL_DISPLAY ? Number.POSITIVE_INFINITY : limit;
}

export function formatShellDisplayLimit(limit: number): string {
  return limit === UNLIMITED_SHELL_DISPLAY ? "all" : `${limit}`;
}
