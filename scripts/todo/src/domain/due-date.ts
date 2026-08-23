import { UserInputError } from "./user-input-error";

interface TimeOfDay {
  hours: number;
  minutes: number;
}

interface DateFields {
  year: number | undefined;
  month: number;
  day: number;
}

type DateUnit = "minute" | "hour" | "day" | "week" | "month" | "year";

type DateParser = (date: string, time: TimeOfDay | undefined, now: Date) => number | undefined;

const DEFAULT_TIME: TimeOfDay = { hours: 9, minutes: 0 };
const EVENING_TIME: TimeOfDay = { hours: 20, minutes: 0 };

const KEYWORD_DAY_OFFSETS = new Map<string, number>([
  ["today", 0],
  ["tonight", 0],
  ["tomorrow", 1],
  ["yesterday", -1],
]);

const NUMBER_WORDS = new Map<string, number>([
  ["a", 1], ["an", 1], ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5], ["six", 6],
  ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10], ["eleven", 11], ["twelve", 12],
]);

const UNITS = new Map<string, DateUnit>([
  ["m", "minute"], ["min", "minute"], ["mins", "minute"], ["minute", "minute"], ["minutes", "minute"],
  ["h", "hour"], ["hr", "hour"], ["hrs", "hour"], ["hour", "hour"], ["hours", "hour"],
  ["d", "day"], ["day", "day"], ["days", "day"],
  ["w", "week"], ["wk", "week"], ["wks", "week"], ["week", "week"], ["weeks", "week"],
  ["mo", "month"], ["mos", "month"], ["month", "month"], ["months", "month"],
  ["y", "year"], ["yr", "year"], ["yrs", "year"], ["year", "year"], ["years", "year"],
]);

const WEEKDAYS = new Map<string, number>([
  ["sunday", 0], ["sun", 0],
  ["monday", 1], ["mon", 1],
  ["tuesday", 2], ["tue", 2], ["tues", 2],
  ["wednesday", 3], ["wed", 3],
  ["thursday", 4], ["thu", 4], ["thur", 4], ["thurs", 4],
  ["friday", 5], ["fri", 5],
  ["saturday", 6], ["sat", 6],
]);

const MONTHS = new Map<string, number>([
  ["january", 1], ["jan", 1],
  ["february", 2], ["feb", 2],
  ["march", 3], ["mar", 3],
  ["april", 4], ["apr", 4],
  ["may", 5],
  ["june", 6], ["jun", 6],
  ["july", 7], ["jul", 7],
  ["august", 8], ["aug", 8],
  ["september", 9], ["sep", 9], ["sept", 9],
  ["october", 10], ["oct", 10],
  ["november", 11], ["nov", 11],
  ["december", 12], ["dec", 12],
]);

/**
 * Parses a due date, accepting keywords (`tomorrow`, `yesterday`), relative offsets
 * (`in 2 weeks`, `two weeks ago`, `-3d`), weekdays (`monday`, `last friday`), clock
 * times (`15:30`, `3pm`), and calendar dates (`16/08/2026`, `16 08 2026`, `16 aug 2026`,
 * `2026-08-16`) with an optional trailing time. Numeric dates are read day-first.
 *
 * @throws UserInputError when the value matches none of the supported forms.
 */
export function parseDueDate(value: string, now: Date = new Date()): number {
  const timestamp = tryParseDueDate(value, now);
  if (timestamp === undefined) throw new UserInputError(`Invalid due date: ${value}`);
  return timestamp;
}

/** Same as {@link parseDueDate} but returns `undefined` instead of throwing. */
export function tryParseDueDate(value: string, now: Date = new Date()): number | undefined {
  const original = value.trim().replace(/\s+/g, " ");
  if (original.length === 0) return undefined;

  const { date, time } = splitDateAndTime(original.toLowerCase());
  for (const parse of DATE_PARSERS) {
    const timestamp = parse(date, time, now);
    if (timestamp !== undefined) return timestamp;
  }

  const native = Date.parse(original);
  return Number.isNaN(native) ? undefined : native;
}

function splitDateAndTime(input: string): { date: string; time: TimeOfDay | undefined } {
  const tokens = input.split(" ");
  const last = tokens[tokens.length - 1];
  if (last === undefined) return { date: input, time: undefined };

  if ((last === "am" || last === "pm") && tokens.length >= 2) {
    const merged = parseTimeOfDay(`${tokens[tokens.length - 2]}${last}`);
    if (merged !== undefined) return { date: dropTrailingAt(tokens.slice(0, -2)), time: merged };
  }

  const time = parseTimeOfDay(last);
  if (time !== undefined) return { date: dropTrailingAt(tokens.slice(0, -1)), time };
  return { date: input, time: undefined };
}

function dropTrailingAt(tokens: string[]): string {
  return (tokens[tokens.length - 1] === "at" ? tokens.slice(0, -1) : tokens).join(" ");
}

function parseTimeOfDay(token: string): TimeOfDay | undefined {
  const match = token.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?(am|pm)?$/);
  if (match === null) return undefined;

  const meridiem = match[3];
  if (!token.includes(":") && meridiem === undefined) return undefined;

  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  if (minutes > 59) return undefined;

  let hours = Number(match[1]);
  if (meridiem !== undefined) {
    if (hours < 1 || hours > 12) return undefined;
    hours = (hours % 12) + (meridiem === "pm" ? 12 : 0);
  }
  if (hours > 23) return undefined;
  return { hours, minutes };
}

function parseClockTime(date: string, time: TimeOfDay | undefined, now: Date): number | undefined {
  if (date.length > 0 || time === undefined) return undefined;
  const target = withTime(now, time);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime();
}

function parseKeywordDate(date: string, time: TimeOfDay | undefined, now: Date): number | undefined {
  const offset = KEYWORD_DAY_OFFSETS.get(date);
  if (offset === undefined) return undefined;
  const target = new Date(now);
  target.setDate(target.getDate() + offset);
  return withTime(target, time ?? (date === "tonight" ? EVENING_TIME : DEFAULT_TIME)).getTime();
}

function parseWeekdayDate(date: string, time: TimeOfDay | undefined, now: Date): number | undefined {
  const match = date.match(/^(?:(next|last|this|coming)\s+)?([a-z]+)$/);
  if (match === null) return undefined;
  const weekday = WEEKDAYS.get(match[2] ?? "");
  if (weekday === undefined) return undefined;

  const target = new Date(now);
  const current = target.getDay();
  const forward = (weekday - current + 7) % 7 || 7;
  const backward = (current - weekday + 7) % 7 || 7;
  target.setDate(target.getDate() + (match[1] === "last" ? -backward : forward));
  return withTime(target, time ?? DEFAULT_TIME).getTime();
}

function parseRelativeDate(date: string, time: TimeOfDay | undefined, now: Date): number | undefined {
  let tokens = date.split(" ");
  let past = false;

  if (tokens[tokens.length - 1] === "ago") {
    past = true;
    tokens = tokens.slice(0, -1);
  } else if (tokens.length >= 3 && tokens[tokens.length - 2] === "from" && tokens[tokens.length - 1] === "now") {
    tokens = tokens.slice(0, -2);
  }
  if (tokens[0] === "in") tokens = tokens.slice(1);

  const direction = tokens[0];
  if (tokens.length === 2 && (direction === "next" || direction === "last")) {
    const unit = UNITS.get(tokens[1] ?? "");
    if (unit === undefined) return undefined;
    const target = shift(now, unit, direction === "next" ? 1 : -1);
    return withTime(target, time ?? (unit === "minute" || unit === "hour" ? undefined : DEFAULT_TIME)).getTime();
  }

  const [amountToken, unitToken] = readAmountAndUnit(tokens);
  if (amountToken === undefined || unitToken === undefined) return undefined;

  const amount = readAmount(amountToken);
  const unit = UNITS.get(unitToken);
  if (amount === undefined || unit === undefined) return undefined;

  return withTime(shift(now, unit, past ? -amount : amount), time).getTime();
}

function readAmountAndUnit(tokens: string[]): [string | undefined, string | undefined] {
  if (tokens.length === 2) return [tokens[0], tokens[1]];
  if (tokens.length !== 1) return [undefined, undefined];
  const compact = (tokens[0] ?? "").match(/^([+-]?\d+)([a-z]+)$/);
  return compact === null ? [undefined, undefined] : [compact[1], compact[2]];
}

function readAmount(token: string): number | undefined {
  const word = NUMBER_WORDS.get(token);
  if (word !== undefined) return word;
  return /^[+-]?\d+$/.test(token) ? Number(token) : undefined;
}

function parseCalendarDate(date: string, time: TimeOfDay | undefined, now: Date): number | undefined {
  const parts = date.split(/[/\-. ]+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return undefined;

  const monthNameIndex = parts.findIndex((part) => MONTHS.has(part));
  const fields = monthNameIndex === -1 ? readNumericDate(parts) : readNamedMonthDate(parts, monthNameIndex);
  if (fields === undefined) return undefined;

  const year = fields.year ?? now.getFullYear();
  if (fields.month < 1 || fields.month > 12 || fields.day < 1 || fields.day > 31) return undefined;

  const applied = time ?? DEFAULT_TIME;
  const target = new Date(year, fields.month - 1, fields.day, applied.hours, applied.minutes, 0, 0);
  const isRoundTrip = target.getFullYear() === year && target.getMonth() === fields.month - 1 && target.getDate() === fields.day;
  return isRoundTrip ? target.getTime() : undefined;
}

function readNumericDate(parts: string[]): DateFields | undefined {
  if (!parts.every((part) => /^\d+$/.test(part))) return undefined;
  const numbers = parts.map(Number) as [number, number, number?];

  if (parts.length === 3) {
    const [first, second, third] = numbers;
    if (third === undefined) return undefined;
    if ((parts[0] ?? "").length === 4) return { year: first, month: second, day: third };
    if (second > 12 && first <= 12) return { year: expandYear(third), month: first, day: second };
    return { year: expandYear(third), month: second, day: first };
  }

  const [first, second] = numbers;
  if (second > 12 && first <= 12) return { year: undefined, month: first, day: second };
  return { year: undefined, month: second, day: first };
}

function readNamedMonthDate(parts: string[], monthNameIndex: number): DateFields | undefined {
  const month = MONTHS.get(parts[monthNameIndex] ?? "");
  if (month === undefined) return undefined;

  const rest = parts.filter((_, index) => index !== monthNameIndex);
  if (!rest.every((part) => /^\d+$/.test(part))) return undefined;

  if (rest.length === 1) {
    const value = Number(rest[0]);
    if ((rest[0] ?? "").length === 4 || value > 31) return { year: expandYear(value), month, day: 1 };
    return { year: undefined, month, day: value };
  }

  if (rest.length !== 2) return undefined;
  const first = Number(rest[0]);
  const second = Number(rest[1]);
  if ((rest[0] ?? "").length === 4 || first > 31) return { year: expandYear(first), month, day: second };
  return { year: expandYear(second), month, day: first };
}

function expandYear(year: number): number {
  return year < 100 ? 2000 + year : year;
}

function shift(now: Date, unit: DateUnit, amount: number): Date {
  const target = new Date(now);
  if (unit === "minute") target.setMinutes(target.getMinutes() + amount);
  else if (unit === "hour") target.setHours(target.getHours() + amount);
  else if (unit === "day") target.setDate(target.getDate() + amount);
  else if (unit === "week") target.setDate(target.getDate() + amount * 7);
  else if (unit === "month") addMonths(target, amount);
  else addMonths(target, amount * 12);
  return target;
}

function addMonths(target: Date, amount: number): void {
  const day = target.getDate();
  target.setDate(1);
  target.setMonth(target.getMonth() + amount);
  target.setDate(Math.min(day, daysInMonth(target.getFullYear(), target.getMonth())));
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function withTime(date: Date, time: TimeOfDay | undefined): Date {
  const target = new Date(date);
  if (time !== undefined) target.setHours(time.hours, time.minutes, 0, 0);
  return target;
}

const DATE_PARSERS: DateParser[] = [parseClockTime, parseKeywordDate, parseWeekdayDate, parseRelativeDate, parseCalendarDate];
