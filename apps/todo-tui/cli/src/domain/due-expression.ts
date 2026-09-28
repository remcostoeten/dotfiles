import { UserInputError } from "./user-input-error";

export interface TimeOfDay {
  hours: number;
  minutes: number;
  seconds: number;
}

export type DurationUnit = "second" | "minute" | "hour" | "day";

export type DueExpression =
  | { kind: "duration"; amount: number; unit: DurationUnit }
  | { kind: "calendar-offset"; days: number }
  | { kind: "weekday"; weekday: number }
  | { kind: "absolute-date"; year: number; month: number; day: number };

export interface ParsedDue {
  expression: DueExpression;
  time: TimeOfDay | undefined;
}

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_DAY = 86_400;

const DURATION_UNITS = new Map<string, DurationUnit>([
  ["s", "second"], ["sec", "second"], ["secs", "second"], ["second", "second"], ["seconds", "second"],
  ["m", "minute"], ["min", "minute"], ["mins", "minute"], ["minute", "minute"], ["minutes", "minute"],
  ["h", "hour"], ["hr", "hour"], ["hrs", "hour"], ["hour", "hour"], ["hours", "hour"],
  ["d", "day"], ["day", "day"], ["days", "day"],
]);

const UNIT_SECONDS: Record<Exclude<DurationUnit, "day">, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
};

const CALENDAR_OFFSETS = new Map<string, number>([
  ["today", 0],
  ["tomorrow", 1],
  ["yesterday", -1],
  ["next week", 7],
]);

const WEEKDAYS = new Map<string, number>([
  ["sunday", 0], ["sun", 0],
  ["monday", 1], ["mon", 1], ["mo", 1],
  ["tuesday", 2], ["tue", 2], ["tues", 2],
  ["wednesday", 3], ["wed", 3],
  ["thursday", 4], ["thu", 4], ["thur", 4], ["thurs", 4],
  ["friday", 5], ["fri", 5],
  ["saturday", 6], ["sat", 6],
]);

const MONTHS = new Map<string, number>([
  ["jan", 1], ["january", 1], ["januari", 1],
  ["feb", 2], ["february", 2], ["februari", 2],
  ["mar", 3], ["march", 3], ["mrt", 3], ["maart", 3],
  ["apr", 4], ["april", 4],
  ["may", 5], ["mei", 5],
  ["jun", 6], ["june", 6], ["juni", 6],
  ["jul", 7], ["july", 7], ["juli", 7],
  ["aug", 8], ["august", 8], ["augustus", 8],
  ["sep", 9], ["sept", 9], ["september", 9],
  ["oct", 10], ["october", 10], ["okt", 10], ["oktober", 10],
  ["nov", 11], ["november", 11],
  ["dec", 12], ["december", 12],
]);

const INVALID_DUE_EXAMPLES = [
  "todo due 27 10m",
  "todo due 27 1h",
  "todo due 27 tomorrow",
  'todo due 27 "next monday"',
  "todo due 27 12-06",
];

/**
 * Resolves a due expression against the current local OS time and timezone.
 *
 * @throws UserInputError when the value matches none of the supported forms.
 */
export function resolveDueExpression(value: string, now: Date = new Date()): number {
  return resolveParsedDue(parseDueExpression(value, now), now);
}

/**
 * Normalizes a due expression into the small internal model every accepted spelling shares.
 *
 * @throws UserInputError when the value matches none of the supported forms.
 */
export function parseDueExpression(value: string, now: Date = new Date()): ParsedDue {
  const parsed = tryParseDueExpression(value, now);
  if (parsed === undefined) throw invalidDueError(value);
  return parsed;
}

/** Same as {@link parseDueExpression} but returns `undefined` instead of throwing. */
export function tryParseDueExpression(value: string, now: Date = new Date()): ParsedDue | undefined {
  const cleaned = value.trim().replace(/\s+/g, " ").toLowerCase();
  if (cleaned.length === 0) return undefined;

  const split = splitExplicitTime(cleaned);
  if (split === undefined) return undefined;
  const { datePart, time } = split;

  const expression = readExpression(normalizeDecimalComma(datePart), now.getFullYear());
  if (expression === undefined) return undefined;
  if (expression.kind === "duration" && time !== undefined) return undefined;
  return { expression, time };
}

export function invalidDueError(value: string): UserInputError {
  const examples = INVALID_DUE_EXAMPLES.map((example) => `  ${example}`).join("\n");
  return new UserInputError(`Invalid due date: "${value}"\n\nExamples:\n${examples}`);
}

/** Converts a normalized expression into an absolute timestamp in the current local timezone. */
export function resolveParsedDue({ expression, time }: ParsedDue, now: Date = new Date()): number {
  if (expression.kind === "duration") return resolveDuration(expression.amount, expression.unit, now);

  const target = resolveCalendarDate(expression, now);
  const applied = time ?? currentTimeOfDay(now);
  target.setHours(applied.hours, applied.minutes, applied.seconds, 0);
  return target.getTime();
}

/**
 * Whole days shift the calendar date and keep the local clock time, so a DST transition never
 * moves the reminder off its hour. Any fractional remainder is added afterwards as elapsed
 * seconds (0.5d = 43200 elapsed seconds), which keeps `2.5d` deterministic.
 */
function resolveDuration(amount: number, unit: DurationUnit, now: Date): number {
  if (unit !== "day") return now.getTime() + Math.round(amount * UNIT_SECONDS[unit] * MILLISECONDS_PER_SECOND);

  const wholeDays = Math.floor(amount);
  const target = new Date(now);
  target.setDate(target.getDate() + wholeDays);
  const remainderSeconds = (amount - wholeDays) * SECONDS_PER_DAY;
  return target.getTime() + Math.round(remainderSeconds * MILLISECONDS_PER_SECOND);
}

function resolveCalendarDate(expression: Exclude<DueExpression, { kind: "duration" }>, now: Date): Date {
  if (expression.kind === "calendar-offset") {
    const target = new Date(now);
    target.setDate(target.getDate() + expression.days);
    return target;
  }

  if (expression.kind === "weekday") {
    const target = new Date(now);
    const forward = (expression.weekday - target.getDay() + 7) % 7 || 7;
    target.setDate(target.getDate() + forward);
    return target;
  }

  return new Date(expression.year, expression.month - 1, expression.day);
}

function currentTimeOfDay(now: Date): TimeOfDay {
  return { hours: now.getHours(), minutes: now.getMinutes(), seconds: now.getSeconds() };
}

/** Peels a trailing `at <time>` off the expression; the `at` keyword is required. */
function splitExplicitTime(input: string): { datePart: string; time: TimeOfDay | undefined } | undefined {
  const match = input.match(/^(.*\S)\s+at\s+(\S+)$/);
  if (match === null) return { datePart: input, time: undefined };

  const time = parseTimeOfDay(match[2] ?? "");
  if (time === undefined) return undefined;
  return { datePart: match[1] ?? "", time };
}

export function parseTimeOfDay(token: string): TimeOfDay | undefined {
  const match = token.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match === null) return undefined;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) return undefined;
  return { hours, minutes, seconds };
}

/** `3,5h` and `3.5h` are the same duration; a comma anywhere else is left alone so it fails validation. */
function normalizeDecimalComma(input: string): string {
  return input.replace(/(\d),(\d)/g, "$1.$2");
}

function readExpression(datePart: string, currentYear: number): DueExpression | undefined {
  return readDuration(datePart)
    ?? readCalendarOffset(datePart)
    ?? readWeekday(datePart)
    ?? readNumericDate(datePart, currentYear)
    ?? readTextualDate(datePart, currentYear);
}

function readDuration(datePart: string): DueExpression | undefined {
  const match = datePart.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (match === null) return undefined;

  const unit = DURATION_UNITS.get(match[2] ?? "");
  const amount = Number(match[1]);
  if (unit === undefined || !Number.isFinite(amount) || amount < 0) return undefined;
  return { kind: "duration", amount, unit };
}

function readCalendarOffset(datePart: string): DueExpression | undefined {
  const days = CALENDAR_OFFSETS.get(datePart);
  return days === undefined ? undefined : { kind: "calendar-offset", days };
}

function readWeekday(datePart: string): DueExpression | undefined {
  const match = datePart.match(/^next ([a-z]+)$/);
  if (match === null) return undefined;
  const weekday = WEEKDAYS.get(match[1] ?? "");
  return weekday === undefined ? undefined : { kind: "weekday", weekday };
}

function readNumericDate(datePart: string, currentYear: number): DueExpression | undefined {
  const compact = datePart.match(/^(\d{2})(\d{2})$/);
  if (compact !== null) return buildDate(currentYear, Number(compact[2]), Number(compact[1]));

  const separated = datePart.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2}|\d{4}))?$/);
  if (separated === null) return undefined;
  return buildDate(readYear(separated[3]) ?? currentYear, Number(separated[2]), Number(separated[1]));
}

function readTextualDate(datePart: string, currentYear: number): DueExpression | undefined {
  const match = datePart.match(/^(\d{1,2}) ([a-z]+)(?: (\d{2}|\d{4}))?$/);
  if (match === null) return undefined;

  const month = MONTHS.get(match[2] ?? "");
  if (month === undefined) return undefined;
  return buildDate(readYear(match[3]) ?? currentYear, month, Number(match[1]));
}

/** Two-digit years are always read as 2000 + YY, so `27` is 2027 and never 1927. */
function readYear(token: string | undefined): number | undefined {
  if (token === undefined) return undefined;
  const year = Number(token);
  return token.length === 2 ? 2000 + year : year;
}

function buildDate(year: number, month: number, day: number): DueExpression | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  if (!isRealDate(year, month, day)) return undefined;
  return { kind: "absolute-date", year, month, day };
}

/** Rejects days the month does not have, so `31-02` never rolls over into March. */
function isRealDate(year: number, month: number, day: number): boolean {
  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day;
}
