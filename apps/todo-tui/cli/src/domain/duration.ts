import { UserInputError } from "./user-input-error";

export const MAX_BOARD_DURATION_MS = 24 * 60 * 60 * 1000;
const MIN_BOARD_DURATION_MS = 60_000;

/** Reads "4h", "90m", "2h30m" or a bare hour count, between one minute and 24 hours. */
export function parseDuration(word: string): number {
  const durationMs = readDuration(word);
  if (durationMs > MAX_BOARD_DURATION_MS) throw new UserInputError("A timed board lasts at most 24h");
  if (durationMs < MIN_BOARD_DURATION_MS) throw new UserInputError("A timed board needs at least a minute");
  return durationMs;
}

function readDuration(word: string): number {
  if (/^\d+(\.\d+)?$/.test(word)) return Number(word) * 60 * 60 * 1000;
  const match = /^(?:(\d+)h)?(?:(\d+)m)?$/.exec(word);
  if (match === null || (match[1] === undefined && match[2] === undefined)) {
    throw new UserInputError(`Not a duration: ${word} (try 4h or 90m)`);
  }
  return Number(match[1] ?? 0) * 60 * 60 * 1000 + Number(match[2] ?? 0) * 60 * 1000;
}

export function formatDuration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0 && rest > 0) return `${hours}h${String(rest).padStart(2, "0")}m`;
  if (hours > 0) return `${hours}h`;
  if (rest > 0) return `${rest}m`;
  return "<1m";
}
