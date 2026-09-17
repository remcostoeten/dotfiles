import { expect, test } from "bun:test";
import { parseDueExpression, resolveDueExpression, tryParseDueExpression } from "@/src/domain/due-expression";

/** A Monday, so `next monday` has to roll a full week forward. */
const NOW = new Date(2026, 8, 7, 18, 30, 15);

function resolved(value: string, now: Date = NOW): Date {
  return new Date(resolveDueExpression(value, now));
}

function expectDate(value: string, year: number, month: number, day: number, hours: number, minutes: number, seconds = 0): void {
  expect(resolved(value)).toEqual(new Date(year, month - 1, day, hours, minutes, seconds, 0));
}

function expectOffsetSeconds(value: string, seconds: number): void {
  expect(resolveDueExpression(value, NOW) - NOW.getTime()).toBe(seconds * 1000);
}

test("parses every spelling of seconds", () => {
  for (const value of ["1s", "1 sec", "1 second", "1 seconds"]) expectOffsetSeconds(value, 1);
  for (const value of ["30s", "30 sec", "30 seconds"]) expectOffsetSeconds(value, 30);
});

test("parses every spelling of minutes", () => {
  for (const value of ["1m", "1 min", "1 minute", "1 minutes"]) expectOffsetSeconds(value, 60);
  for (const value of ["10m", "10 min", "10 minutes"]) expectOffsetSeconds(value, 600);
});

test("parses every spelling of hours", () => {
  for (const value of ["1h", "1 hr", "1 hour", "1 hours"]) expectOffsetSeconds(value, 3600);
  for (const value of ["3h", "3 hours"]) expectOffsetSeconds(value, 10_800);
});

test("parses days as calendar days that keep the local clock time", () => {
  expectDate("1d", 2026, 9, 8, 18, 30, 15);
  expectDate("2d", 2026, 9, 9, 18, 30, 15);
  expectDate("1 day", 2026, 9, 8, 18, 30, 15);
  expectDate("2 days", 2026, 9, 9, 18, 30, 15);
});

test("both decimal separators mean the same duration", () => {
  for (const value of ["3.5h", "3,5h", "3.5 hours", "3,5 hours"]) expectOffsetSeconds(value, 12_600);
  expect(resolveDueExpression("3.5h", NOW)).toBe(resolveDueExpression("3,5h", NOW));
});

test("3.5 hours is 210 minutes is 12600 seconds", () => {
  const target = resolveDueExpression("3.5h", NOW);
  expect(target).toBe(resolveDueExpression("210m", NOW));
  expect(target).toBe(resolveDueExpression("12600s", NOW));
});

test("supports decimals on the other duration units", () => {
  expectOffsetSeconds("1.5h", 5400);
  expectOffsetSeconds("1,5h", 5400);
  expectOffsetSeconds("30.5m", 1830);
  expectDate("2.5d", 2026, 9, 10, 6, 30, 15);
  expect(resolveDueExpression("2.5d", NOW)).toBe(resolveDueExpression("2,5d", NOW));
});

test("a whole-day duration survives a daylight-saving transition on its clock time", () => {
  const beforeTransition = new Date(2026, 2, 28, 14, 0, 0);
  expect(new Date(resolveDueExpression("1d", beforeTransition))).toEqual(new Date(2026, 2, 29, 14, 0, 0, 0));
});

test("parses the relative calendar keywords at the current clock time", () => {
  expectDate("today", 2026, 9, 7, 18, 30, 15);
  expectDate("tomorrow", 2026, 9, 8, 18, 30, 15);
  expectDate("yesterday", 2026, 9, 6, 18, 30, 15);
  expectDate("next week", 2026, 9, 14, 18, 30, 15);
});

test("next <weekday> accepts every spelling and is always strictly in the future", () => {
  const spellings: Array<[string[], number]> = [
    [["next monday", "next mon", "next mo"], 14],
    [["next tuesday", "next tue", "next tues"], 8],
    [["next wednesday", "next wed"], 9],
    [["next thursday", "next thu", "next thur", "next thurs"], 10],
    [["next friday", "next fri"], 11],
    [["next saturday", "next sat"], 12],
    [["next sunday", "next sun"], 13],
  ];

  for (const [values, day] of spellings) {
    for (const value of values) {
      expect(resolved(value)).toEqual(new Date(2026, 8, day, 18, 30, 15, 0));
      expect(resolved(value).getTime()).toBeGreaterThan(NOW.getTime());
    }
  }
});

test("next <weekday> on that same weekday means the following week", () => {
  expect(NOW.getDay()).toBe(1);
  expect(resolved("next monday").getDate()).toBe(14);
});

test("weekday matching is case insensitive", () => {
  for (const value of ["NEXT MONDAY", "Next Monday", "next monday"]) {
    expect(resolved(value)).toEqual(new Date(2026, 8, 14, 18, 30, 15, 0));
  }
});

test("reads compact and separated numeric dates day first", () => {
  expectDate("1206", 2026, 6, 12, 18, 30, 15);
  expectDate("12-06", 2026, 6, 12, 18, 30, 15);
  expectDate("0101", 2026, 1, 1, 18, 30, 15);
  expectDate("01-01", 2026, 1, 1, 18, 30, 15);
  expectDate("3112", 2026, 12, 31, 18, 30, 15);
  expectDate("31-12", 2026, 12, 31, 18, 30, 15);
});

test("reads English and Dutch month names to the same date", () => {
  const months: Array<[string[], number]> = [
    [["12 jan", "12 january", "12 januari"], 1],
    [["12 feb", "12 february", "12 februari"], 2],
    [["12 mar", "12 march", "12 mrt", "12 maart"], 3],
    [["12 apr", "12 april"], 4],
    [["12 may", "12 mei"], 5],
    [["12 jun", "12 june", "12 juni"], 6],
    [["12 jul", "12 july", "12 juli"], 7],
    [["12 aug", "12 august", "12 augustus"], 8],
    [["12 sep", "12 september"], 9],
    [["12 oct", "12 october", "12 okt", "12 oktober"], 10],
    [["12 nov", "12 november"], 11],
    [["12 dec", "12 december"], 12],
  ];

  for (const [values, month] of months) {
    for (const value of values) {
      expect(resolved(value)).toEqual(new Date(2026, month - 1, 12, 18, 30, 15, 0));
    }
  }
});

test("reads explicit years, with two-digit years as 20YY", () => {
  expectDate("12-06-2027", 2027, 6, 12, 18, 30, 15);
  expectDate("12-06-27", 2027, 6, 12, 18, 30, 15);
  expectDate("12 june 2027", 2027, 6, 12, 18, 30, 15);
  expectDate("12 jun 2027", 2027, 6, 12, 18, 30, 15);
  expectDate("12 juni 2027", 2027, 6, 12, 18, 30, 15);
});

test("a missing year means the current one, even when that is already past", () => {
  const target = resolveDueExpression("12-06", NOW);
  expect(new Date(target).getFullYear()).toBe(2026);
  expect(target).toBeLessThan(NOW.getTime());
});

test("applies an explicit at <time>", () => {
  expectDate("tomorrow at 09:00", 2026, 9, 8, 9, 0);
  expectDate("tomorrow at 09:00:30", 2026, 9, 8, 9, 0, 30);
  expectDate("next monday at 14:30", 2026, 9, 14, 14, 30);
  expectDate("12-06 at 18:45", 2026, 6, 12, 18, 45);
  expectDate("12 july at 08:15", 2026, 7, 12, 8, 15);
  expectDate("12-06 at 18:00", 2026, 6, 12, 18, 0);
});

test("normalizes every spelling into the same internal representation", () => {
  const monday = { kind: "weekday", weekday: 1 } as const;
  for (const value of ["next monday", "next mon", "next mo"]) {
    expect(parseDueExpression(value, NOW).expression).toEqual(monday);
  }

  const threeAndAHalfHours = { kind: "duration", amount: 3.5, unit: "hour" } as const;
  for (const value of ["3.5h", "3,5h", "3.5 hours", "3,5 hours"]) {
    expect(parseDueExpression(value, NOW).expression).toEqual(threeAndAHalfHours);
  }
});

test("rejects malformed expressions", () => {
  for (const value of ["10x", "next potato", "32-13", "31-02", "3201", "32-01", "99-99", "-5h", "3,,5h", "1mo", ""]) {
    expect(tryParseDueExpression(value, NOW)).toBeUndefined();
  }
});

test("rejects impossible times", () => {
  for (const value of ["tomorrow at 25:00", "tomorrow at 12:99", "tomorrow at 14:30:99", "tomorrow at 10:99"]) {
    expect(tryParseDueExpression(value, NOW)).toBeUndefined();
  }
});

test("m is minutes and there is no month unit", () => {
  expectOffsetSeconds("1m", 60);
  expect(tryParseDueExpression("1mo", NOW)).toBeUndefined();
  expect(tryParseDueExpression("1 month", NOW)).toBeUndefined();
  expect(parseDueExpression("next mo", NOW).expression).toEqual({ kind: "weekday", weekday: 1 });
});

test("an explicit time is refused on a duration, which has no calendar day to anchor it", () => {
  expect(tryParseDueExpression("2h at 09:00", NOW)).toBeUndefined();
});

test("the error names the input and shows examples", () => {
  expect(() => resolveDueExpression("10x", NOW)).toThrow('Invalid due date: "10x"');
  expect(() => resolveDueExpression("10x", NOW)).toThrow("todo due 27 tomorrow");
});

test("resolves relative expressions against the supplied current time", () => {
  const evening = new Date(2026, 8, 7, 18, 30, 0);
  expect(new Date(resolveDueExpression("1h", evening))).toEqual(new Date(2026, 8, 7, 19, 30, 0, 0));
  expect(new Date(resolveDueExpression("tomorrow", evening))).toEqual(new Date(2026, 8, 8, 18, 30, 0, 0));
});
