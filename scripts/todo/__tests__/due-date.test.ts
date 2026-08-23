import { expect, test } from "bun:test";
import { parseDueDate, tryParseDueDate } from "@/src/domain/due-date";

const NOW = new Date(2026, 7, 19, 9, 44, 0);

function parsed(value: string): Date {
  return new Date(parseDueDate(value, NOW));
}

function expectDate(value: string, year: number, month: number, day: number, hours: number, minutes: number): void {
  expect(parsed(value)).toEqual(new Date(year, month - 1, day, hours, minutes, 0, 0));
}

test("reads numeric dates day first across every separator", () => {
  expectDate("16/08/2026", 2026, 8, 16, 9, 0);
  expectDate("16-08-2026", 2026, 8, 16, 9, 0);
  expectDate("16.08.2026", 2026, 8, 16, 9, 0);
  expectDate("16 08 2026", 2026, 8, 16, 9, 0);
  expectDate("16/08/26", 2026, 8, 16, 9, 0);
});

test("reads a leading four digit year as ISO order", () => {
  expectDate("2026-08-16", 2026, 8, 16, 9, 0);
  expectDate("2026/08/16", 2026, 8, 16, 9, 0);
});

test("falls back to month first when the second field cannot be a month", () => {
  expectDate("08/16/2026", 2026, 8, 16, 9, 0);
});

test("defaults a missing year to the current one", () => {
  expectDate("16/08", 2026, 8, 16, 9, 0);
});

test("reads month names in either position", () => {
  expectDate("16 aug 2026", 2026, 8, 16, 9, 0);
  expectDate("aug 16 2026", 2026, 8, 16, 9, 0);
  expectDate("16 august 2026", 2026, 8, 16, 9, 0);
  expectDate("16 aug", 2026, 8, 16, 9, 0);
});

test("applies a trailing time to a date", () => {
  expectDate("16/08/2026 15:30", 2026, 8, 16, 15, 30);
  expectDate("16/08/2026 at 15:30", 2026, 8, 16, 15, 30);
  expectDate("16 08 2026 3pm", 2026, 8, 16, 15, 0);
  expectDate("tomorrow 7:15", 2026, 8, 20, 7, 15);
});

test("reads relative offsets in the past", () => {
  expectDate("two weeks ago", 2026, 8, 5, 9, 44);
  expectDate("3 days ago", 2026, 8, 16, 9, 44);
  expectDate("a month ago", 2026, 7, 19, 9, 44);
  expectDate("-2d", 2026, 8, 17, 9, 44);
});

test("reads relative offsets in the future", () => {
  expectDate("in 2 weeks", 2026, 9, 2, 9, 44);
  expectDate("2w", 2026, 9, 2, 9, 44);
  expectDate("3 days", 2026, 8, 22, 9, 44);
  expectDate("2 days from now", 2026, 8, 21, 9, 44);
});

test("keeps the existing keyword and clock behaviour", () => {
  expectDate("tomorrow", 2026, 8, 20, 9, 0);
  expectDate("yesterday", 2026, 8, 18, 9, 0);
  expectDate("today", 2026, 8, 19, 9, 0);
  expectDate("15:30", 2026, 8, 19, 15, 30);
  expectDate("03:00", 2026, 8, 20, 3, 0);
});

test("keeps the existing snooze shorthand behaviour", () => {
  expectDate("1h", 2026, 8, 19, 10, 44);
  expectDate("30m", 2026, 8, 19, 10, 14);
  expectDate("next week", 2026, 8, 26, 9, 0);
});

test("resolves weekdays forwards and backwards", () => {
  expectDate("monday", 2026, 8, 24, 9, 0);
  expectDate("next friday", 2026, 8, 21, 9, 0);
  expectDate("last friday", 2026, 8, 14, 9, 0);
  expectDate("wednesday", 2026, 8, 26, 9, 0);
});

test("shifts relative offsets from the exact current time", () => {
  const now = new Date(2026, 7, 19, 9, 44, 30);
  expect(parseDueDate("1h", now)).toBe(now.getTime() + 3_600_000);
  expect(parseDueDate("2 weeks ago", now)).toBe(new Date(2026, 7, 5, 9, 44, 30).getTime());
});

test("clamps month arithmetic instead of overflowing", () => {
  expect(new Date(parseDueDate("1 month", new Date(2026, 0, 31, 9, 0)))).toEqual(new Date(2026, 1, 28, 9, 0, 0, 0));
});

test("rejects impossible and unparseable values", () => {
  expect(tryParseDueDate("31/02/2026", NOW)).toBeUndefined();
  expect(tryParseDueDate("16/13/2026", NOW)).toBeUndefined();
  expect(tryParseDueDate("two weeks agoo", NOW)).toBeUndefined();
  expect(tryParseDueDate("", NOW)).toBeUndefined();
  expect(() => parseDueDate("not a date", NOW)).toThrow("Invalid due date: not a date");
});
