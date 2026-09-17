#!/usr/bin/env bun
// @bun

// src/cli.ts
import { createInterface } from "readline/promises";

// src/domain/fuzzy-match.ts
function editDistance(left, right) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const table = Array.from({ length: rows }, () => new Array(columns).fill(0));
  for (let row = 0;row < rows; row += 1)
    table[row][0] = row;
  for (let column = 0;column < columns; column += 1)
    table[0][column] = column;
  for (let row = 1;row < rows; row += 1) {
    for (let column = 1;column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      let best = Math.min(table[row - 1][column] + 1, table[row][column - 1] + 1, table[row - 1][column - 1] + cost);
      const transposed = row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1];
      if (transposed)
        best = Math.min(best, table[row - 2][column - 2] + 1);
      table[row][column] = best;
    }
  }
  return table[left.length][right.length];
}
function maxDistanceFor(token) {
  if (token.length <= 3)
    return 1;
  if (token.length <= 6)
    return 2;
  return 3;
}
function findClosest(token, candidates) {
  const needle = token.toLowerCase();
  if (needle.length < 2)
    return;
  const prefixMatches = candidates.filter((candidate) => candidate.toLowerCase().startsWith(needle) && candidate !== token);
  if (needle.length >= 3 && prefixMatches.length === 1)
    return prefixMatches[0];
  const limit = maxDistanceFor(needle);
  let best;
  let bestDistance = Number.POSITIVE_INFINITY;
  let tied = false;
  for (const candidate of candidates) {
    if (candidate === token)
      continue;
    const distance = editDistance(needle, candidate.toLowerCase());
    if (distance > limit)
      continue;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
      tied = false;
    } else if (distance === bestDistance) {
      tied = true;
    }
  }
  return tied ? undefined : best;
}

// src/domain/autocorrect.ts
var AUTO_CORRECT_THRESHOLD = 3;
var GIVE_UP_AFTER_REJECTIONS = 2;
function decideCorrection(memory, token, candidates) {
  const records = memory[token] ?? {};
  const learned = Object.entries(records).filter(([candidate, record2]) => candidates.includes(candidate) && record2.accepted > record2.rejected).sort(([, left], [, right]) => right.accepted - left.accepted)[0];
  if (learned !== undefined) {
    const [correction, record2] = learned;
    return { correction, mode: record2.accepted >= AUTO_CORRECT_THRESHOLD && record2.rejected === 0 ? "auto" : "prompt" };
  }
  const closest = findClosest(token, candidates);
  if (closest === undefined)
    return;
  const record = records[closest];
  if (record !== undefined && isIgnored(record))
    return;
  return { correction: closest, mode: "prompt" };
}
function recordDecision(memory, token, correction, accepted) {
  const current = memory[token]?.[correction] ?? { accepted: 0, rejected: 0 };
  const updated = accepted ? { accepted: current.accepted + 1, rejected: current.rejected } : { accepted: current.accepted, rejected: current.rejected + 1 };
  return { ...memory, [token]: { ...memory[token], [correction]: updated } };
}
function forgetTypo(memory, token) {
  const { [token]: _removed, ...rest } = memory;
  return rest;
}
function isAutoCorrected(record) {
  return record.accepted >= AUTO_CORRECT_THRESHOLD && record.rejected === 0;
}
function isIgnored(record) {
  return record.accepted === 0 && record.rejected >= GIVE_UP_AFTER_REJECTIONS;
}
var ID_LIST_PART = /^\d+(-\d+)?$/;
function argumentsFitShape(shape, rest, taskIds) {
  switch (shape) {
    case "none":
      return rest.every((argument) => argument.startsWith("-"));
    case "task-id": {
      const first = rest[0];
      return first !== undefined && taskIds.has(first.replace(/^#/, ""));
    }
    case "task-ids":
      if (rest.length === 0)
        return false;
      if (rest.length === 1 && rest[0] === "all")
        return true;
      return rest.every((argument) => argument.replace(/^#/, "").split(",").every((part) => ID_LIST_PART.test(part)));
    case "text":
      return rest.length > 0;
    case "any":
      return rest.length <= 3;
  }
}
function replaceToken(args, token, correction) {
  const index = args.findIndex((argument2) => argument2 === token || argument2.startsWith(`${token}=`) || argument2.endsWith(`=${token}`));
  if (index === -1)
    return;
  const argument = args[index];
  const replacement = argument === token ? correction : argument.startsWith(`${token}=`) ? `${correction}${argument.slice(token.length)}` : `${argument.slice(0, argument.length - token.length)}${correction}`;
  return [...args.slice(0, index), replacement, ...args.slice(index + 1)];
}

// src/autocorrect.ts
var DIM = "\x1B[2m";
var BOLD = "\x1B[1m";
var RESET = "\x1B[0m";
async function correctCommandName(args, registry, store, io) {
  const [token, ...rest] = args;
  if (token === undefined)
    return;
  const dashed = token.startsWith("-");
  const candidates = registry.listCommands().flatMap((command) => [command.name, ...command.help.aliases ?? []]).filter((name) => name.startsWith("-") === dashed);
  const pendingIds = new Set((await store.loadTasks()).filter((task) => task.status === "pending").map((task) => task.id));
  return await applyCorrection(args, token, candidates, store, io, (correction) => {
    const command = registry.getCommand(correction);
    return command !== undefined && argumentsFitShape(command.help.positional ?? "none", rest, pendingIds);
  });
}
async function correctRejectedToken(error, commandName, args, store, io) {
  return await applyCorrection(args, error.token, error.candidates, store, io, () => true, commandName);
}
async function applyCorrection(args, token, candidates, store, io, accepts, commandName) {
  const memory = await store.loadTypoMemory();
  const decision = decideCorrection(memory, token, candidates);
  if (decision === undefined || !accepts(decision.correction))
    return;
  const corrected = replaceToken(args, token, decision.correction);
  if (corrected === undefined)
    return;
  if (decision.mode === "auto") {
    io.notify(`${DIM}autocorrected ${token} \u2192 ${decision.correction}  (todo typos forget ${token} to stop)${RESET}
`);
    return corrected;
  }
  const shown = commandName === undefined ? corrected : [commandName, ...corrected];
  const answer = await io.confirm(`Did you mean ${BOLD}todo ${shown.join(" ")}${RESET}? [Y/n] `);
  if (answer === undefined)
    return;
  const updated = recordDecision(memory, token, decision.correction, answer);
  await store.saveTypoMemory(updated);
  const record = updated[token]?.[decision.correction];
  if (answer && record !== undefined && isAutoCorrected(record)) {
    io.notify(`${DIM}learned: ${token} now autocorrects to ${decision.correction}${RESET}
`);
  }
  return answer ? corrected : undefined;
}

// src/domain/user-input-error.ts
class UserInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserInputError";
  }
}

// src/domain/unknown-token-error.ts
class UnknownTokenError extends UserInputError {
  token;
  candidates;
  kind;
  constructor(message, token, candidates, kind) {
    super(message);
    this.token = token;
    this.candidates = candidates;
    this.kind = kind;
    this.name = "UnknownTokenError";
  }
}

// src/domain/due-date.ts
var DEFAULT_TIME = { hours: 9, minutes: 0 };
var EVENING_TIME = { hours: 20, minutes: 0 };
var KEYWORD_DAY_OFFSETS = new Map([
  ["today", 0],
  ["tonight", 0],
  ["tomorrow", 1],
  ["yesterday", -1]
]);
var NUMBER_WORDS = new Map([
  ["a", 1],
  ["an", 1],
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
  ["eleven", 11],
  ["twelve", 12]
]);
var UNITS = new Map([
  ["m", "minute"],
  ["min", "minute"],
  ["mins", "minute"],
  ["minute", "minute"],
  ["minutes", "minute"],
  ["h", "hour"],
  ["hr", "hour"],
  ["hrs", "hour"],
  ["hour", "hour"],
  ["hours", "hour"],
  ["d", "day"],
  ["day", "day"],
  ["days", "day"],
  ["w", "week"],
  ["wk", "week"],
  ["wks", "week"],
  ["week", "week"],
  ["weeks", "week"],
  ["mo", "month"],
  ["mos", "month"],
  ["month", "month"],
  ["months", "month"],
  ["y", "year"],
  ["yr", "year"],
  ["yrs", "year"],
  ["year", "year"],
  ["years", "year"]
]);
var WEEKDAYS = new Map([
  ["sunday", 0],
  ["sun", 0],
  ["monday", 1],
  ["mon", 1],
  ["tuesday", 2],
  ["tue", 2],
  ["tues", 2],
  ["wednesday", 3],
  ["wed", 3],
  ["thursday", 4],
  ["thu", 4],
  ["thur", 4],
  ["thurs", 4],
  ["friday", 5],
  ["fri", 5],
  ["saturday", 6],
  ["sat", 6]
]);
var MONTHS = new Map([
  ["january", 1],
  ["jan", 1],
  ["february", 2],
  ["feb", 2],
  ["march", 3],
  ["mar", 3],
  ["april", 4],
  ["apr", 4],
  ["may", 5],
  ["june", 6],
  ["jun", 6],
  ["july", 7],
  ["jul", 7],
  ["august", 8],
  ["aug", 8],
  ["september", 9],
  ["sep", 9],
  ["sept", 9],
  ["october", 10],
  ["oct", 10],
  ["november", 11],
  ["nov", 11],
  ["december", 12],
  ["dec", 12]
]);
function parseDueDate(value, now = new Date) {
  const timestamp = tryParseDueDate(value, now);
  if (timestamp === undefined)
    throw new UserInputError(`Invalid due date: ${value}`);
  return timestamp;
}
function tryParseDueDate(value, now = new Date) {
  const original = value.trim().replace(/\s+/g, " ");
  if (original.length === 0)
    return;
  const { date, time } = splitDateAndTime(original.toLowerCase());
  for (const parse of DATE_PARSERS) {
    const timestamp = parse(date, time, now);
    if (timestamp !== undefined)
      return timestamp;
  }
  const native = Date.parse(original);
  return Number.isNaN(native) ? undefined : native;
}
function splitDateAndTime(input) {
  const tokens = input.split(" ");
  const last = tokens[tokens.length - 1];
  if (last === undefined)
    return { date: input, time: undefined };
  if ((last === "am" || last === "pm") && tokens.length >= 2) {
    const merged = parseTimeOfDay(`${tokens[tokens.length - 2]}${last}`);
    if (merged !== undefined)
      return { date: dropTrailingAt(tokens.slice(0, -2)), time: merged };
  }
  const time = parseTimeOfDay(last);
  if (time !== undefined)
    return { date: dropTrailingAt(tokens.slice(0, -1)), time };
  return { date: input, time: undefined };
}
function dropTrailingAt(tokens) {
  return (tokens[tokens.length - 1] === "at" ? tokens.slice(0, -1) : tokens).join(" ");
}
function parseTimeOfDay(token) {
  const match = token.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?(am|pm)?$/);
  if (match === null)
    return;
  const meridiem = match[3];
  if (!token.includes(":") && meridiem === undefined)
    return;
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  if (minutes > 59)
    return;
  let hours = Number(match[1]);
  if (meridiem !== undefined) {
    if (hours < 1 || hours > 12)
      return;
    hours = hours % 12 + (meridiem === "pm" ? 12 : 0);
  }
  if (hours > 23)
    return;
  return { hours, minutes };
}
function parseClockTime(date, time, now) {
  if (date.length > 0 || time === undefined)
    return;
  const target = withTime(now, time);
  if (target.getTime() <= now.getTime())
    target.setDate(target.getDate() + 1);
  return target.getTime();
}
function parseKeywordDate(date, time, now) {
  const offset = KEYWORD_DAY_OFFSETS.get(date);
  if (offset === undefined)
    return;
  const target = new Date(now);
  target.setDate(target.getDate() + offset);
  return withTime(target, time ?? (date === "tonight" ? EVENING_TIME : DEFAULT_TIME)).getTime();
}
function parseWeekdayDate(date, time, now) {
  const match = date.match(/^(?:(next|last|this|coming)\s+)?([a-z]+)$/);
  if (match === null)
    return;
  const weekday = WEEKDAYS.get(match[2] ?? "");
  if (weekday === undefined)
    return;
  const target = new Date(now);
  const current = target.getDay();
  const forward = (weekday - current + 7) % 7 || 7;
  const backward = (current - weekday + 7) % 7 || 7;
  target.setDate(target.getDate() + (match[1] === "last" ? -backward : forward));
  return withTime(target, time ?? DEFAULT_TIME).getTime();
}
function parseRelativeDate(date, time, now) {
  let tokens = date.split(" ");
  let past = false;
  if (tokens[tokens.length - 1] === "ago") {
    past = true;
    tokens = tokens.slice(0, -1);
  } else if (tokens.length >= 3 && tokens[tokens.length - 2] === "from" && tokens[tokens.length - 1] === "now") {
    tokens = tokens.slice(0, -2);
  }
  if (tokens[0] === "in")
    tokens = tokens.slice(1);
  const direction = tokens[0];
  if (tokens.length === 2 && (direction === "next" || direction === "last")) {
    const unit2 = UNITS.get(tokens[1] ?? "");
    if (unit2 === undefined)
      return;
    const target = shift(now, unit2, direction === "next" ? 1 : -1);
    return withTime(target, time ?? (unit2 === "minute" || unit2 === "hour" ? undefined : DEFAULT_TIME)).getTime();
  }
  const [amountToken, unitToken] = readAmountAndUnit(tokens);
  if (amountToken === undefined || unitToken === undefined)
    return;
  const amount = readAmount(amountToken);
  const unit = UNITS.get(unitToken);
  if (amount === undefined || unit === undefined)
    return;
  return withTime(shift(now, unit, past ? -amount : amount), time).getTime();
}
function readAmountAndUnit(tokens) {
  if (tokens.length === 2)
    return [tokens[0], tokens[1]];
  if (tokens.length !== 1)
    return [undefined, undefined];
  const compact = (tokens[0] ?? "").match(/^([+-]?\d+)([a-z]+)$/);
  return compact === null ? [undefined, undefined] : [compact[1], compact[2]];
}
function readAmount(token) {
  const word = NUMBER_WORDS.get(token);
  if (word !== undefined)
    return word;
  return /^[+-]?\d+$/.test(token) ? Number(token) : undefined;
}
function parseCalendarDate(date, time, now) {
  const parts = date.split(/[/\-. ]+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 3)
    return;
  const monthNameIndex = parts.findIndex((part) => MONTHS.has(part));
  const fields = monthNameIndex === -1 ? readNumericDate(parts) : readNamedMonthDate(parts, monthNameIndex);
  if (fields === undefined)
    return;
  const year = fields.year ?? now.getFullYear();
  if (fields.month < 1 || fields.month > 12 || fields.day < 1 || fields.day > 31)
    return;
  const applied = time ?? DEFAULT_TIME;
  const target = new Date(year, fields.month - 1, fields.day, applied.hours, applied.minutes, 0, 0);
  const isRoundTrip = target.getFullYear() === year && target.getMonth() === fields.month - 1 && target.getDate() === fields.day;
  return isRoundTrip ? target.getTime() : undefined;
}
function readNumericDate(parts) {
  if (!parts.every((part) => /^\d+$/.test(part)))
    return;
  const numbers = parts.map(Number);
  if (parts.length === 3) {
    const [first2, second2, third] = numbers;
    if (third === undefined)
      return;
    if ((parts[0] ?? "").length === 4)
      return { year: first2, month: second2, day: third };
    if (second2 > 12 && first2 <= 12)
      return { year: expandYear(third), month: first2, day: second2 };
    return { year: expandYear(third), month: second2, day: first2 };
  }
  const [first, second] = numbers;
  if (second > 12 && first <= 12)
    return { year: undefined, month: first, day: second };
  return { year: undefined, month: second, day: first };
}
function readNamedMonthDate(parts, monthNameIndex) {
  const month = MONTHS.get(parts[monthNameIndex] ?? "");
  if (month === undefined)
    return;
  const rest = parts.filter((_, index) => index !== monthNameIndex);
  if (!rest.every((part) => /^\d+$/.test(part)))
    return;
  if (rest.length === 1) {
    const value = Number(rest[0]);
    if ((rest[0] ?? "").length === 4 || value > 31)
      return { year: expandYear(value), month, day: 1 };
    return { year: undefined, month, day: value };
  }
  if (rest.length !== 2)
    return;
  const first = Number(rest[0]);
  const second = Number(rest[1]);
  if ((rest[0] ?? "").length === 4 || first > 31)
    return { year: expandYear(first), month, day: second };
  return { year: expandYear(second), month, day: first };
}
function expandYear(year) {
  return year < 100 ? 2000 + year : year;
}
function shift(now, unit, amount) {
  const target = new Date(now);
  if (unit === "minute")
    target.setMinutes(target.getMinutes() + amount);
  else if (unit === "hour")
    target.setHours(target.getHours() + amount);
  else if (unit === "day")
    target.setDate(target.getDate() + amount);
  else if (unit === "week")
    target.setDate(target.getDate() + amount * 7);
  else if (unit === "month")
    addMonths(target, amount);
  else
    addMonths(target, amount * 12);
  return target;
}
function addMonths(target, amount) {
  const day = target.getDate();
  target.setDate(1);
  target.setMonth(target.getMonth() + amount);
  target.setDate(Math.min(day, daysInMonth(target.getFullYear(), target.getMonth())));
}
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function withTime(date, time) {
  const target = new Date(date);
  if (time !== undefined)
    target.setHours(time.hours, time.minutes, 0, 0);
  return target;
}
var DATE_PARSERS = [parseClockTime, parseKeywordDate, parseWeekdayDate, parseRelativeDate, parseCalendarDate];

// src/domain/task-tree.ts
function buildTaskTreeRows(visibleTasks, allTasks, options = {}) {
  const compare = options.compare ?? (() => 0);
  const collapsedIds = options.collapsedIds ?? new Set;
  const visibleIds = new Set(visibleTasks.map((task) => task.id));
  const childrenByParent = new Map;
  for (const task of visibleTasks) {
    const parentKey = task.parentId !== undefined && visibleIds.has(task.parentId) && task.parentId !== task.id ? task.parentId : undefined;
    const siblings = childrenByParent.get(parentKey) ?? [];
    siblings.push(task);
    childrenByParent.set(parentKey, siblings);
  }
  for (const siblings of childrenByParent.values())
    siblings.sort(compare);
  const rows = [];
  const visited = new Set;
  const visit = (parentKey, depth, trail) => {
    const siblings = childrenByParent.get(parentKey) ?? [];
    siblings.forEach((task, index) => {
      if (visited.has(task.id))
        return;
      visited.add(task.id);
      const siblingFollows = [...trail, index < siblings.length - 1];
      const children = childrenByParent.get(task.id) ?? [];
      const collapsed = collapsedIds.has(task.id);
      rows.push({
        task,
        depth,
        siblingFollows,
        hasChildren: children.length > 0,
        childCount: children.length,
        collapsed,
        progress: getTaskProgress(allTasks, task.id)
      });
      if (!collapsed)
        visit(task.id, depth + 1, siblingFollows);
    });
  };
  visit(undefined, 0, []);
  return rows;
}
function collectDescendantIds(tasks, rootIds) {
  const childrenByParent = new Map;
  for (const task of tasks) {
    if (task.parentId === undefined)
      continue;
    const children = childrenByParent.get(task.parentId) ?? [];
    children.push(task.id);
    childrenByParent.set(task.parentId, children);
  }
  const descendants = new Set;
  const queue = [...rootIds];
  while (queue.length > 0) {
    const id = queue.pop();
    for (const childId of childrenByParent.get(id) ?? []) {
      if (descendants.has(childId))
        continue;
      descendants.add(childId);
      queue.push(childId);
    }
  }
  for (const id of rootIds)
    descendants.delete(id);
  return descendants;
}
function collectSubtreeIds(tasks, rootIds) {
  const roots = [...rootIds];
  return new Set([...roots, ...collectDescendantIds(tasks, roots)]);
}
function excludeHiddenSubtrees(tasks) {
  const hiddenIds = collectSubtreeIds(tasks, tasks.filter((task) => task.hidden === true).map((task) => task.id));
  return tasks.filter((task) => !hiddenIds.has(task.id));
}
function findTaskByIdOrDescription(tasks, target) {
  const trimmed = target.trim();
  if (/^#?\d+$/.test(trimmed))
    return findTask(tasks, trimmed.replace(/^#/, ""));
  const needle = trimmed.toLowerCase();
  const matches = tasks.filter((task) => task.status === "pending" && task.description.toLowerCase() === needle);
  const match = matches.find((task) => task.kind === "epic") ?? matches[0];
  if (match === undefined)
    throw new UserInputError(`Task not found: ${target}`);
  return match;
}
function getTaskProgress(tasks, id) {
  const descendantIds = collectDescendantIds(tasks, [id]);
  let completed = 0;
  for (const task of tasks) {
    if (descendantIds.has(task.id) && task.status === "completed")
      completed += 1;
  }
  return { total: descendantIds.size, completed };
}
function isEpic(task, tasks) {
  return task.kind === "epic" || countDescendants(tasks, task.id) > 0;
}
function findTask(tasks, id) {
  const task = tasks.find((candidate) => candidate.id === id);
  if (task === undefined)
    throw new UserInputError(`Task not found: ${id}`);
  return task;
}
function moveTask(tasks, id, parentId, now = Date.now()) {
  const task = findTask(tasks, id);
  if (parentId !== undefined) {
    findTask(tasks, parentId);
    if (parentId === id || collectDescendantIds(tasks, [id]).has(parentId)) {
      throw new UserInputError(`Cannot move #${id} under #${parentId}: it would nest inside itself`);
    }
    task.parentId = parentId;
  } else {
    delete task.parentId;
  }
  task.updatedAt = now;
  return task;
}
function completeSubtrees(tasks, rootIds, now = Date.now()) {
  const ids = collectSubtreeIds(tasks, rootIds);
  let changed = 0;
  for (const task of tasks) {
    if (!ids.has(task.id) || task.status === "completed")
      continue;
    task.status = "completed";
    task.updatedAt = now;
    changed += 1;
  }
  return changed;
}
function countDescendants(tasks, id) {
  return collectDescendantIds(tasks, [id]).size;
}

// src/plugins/add.ts
var addPlugin = {
  name: "add",
  description: "Creates tasks.",
  register(app) {
    app.command("add", "Add one or more tasks.", async ({ args, store, stdout }) => {
      const newTasks = await createTasks(store, args);
      for (const task of newTasks)
        stdout.write(formatAddedTask(task));
    }, {
      group: "Create",
      positional: "text",
      usage: ["todo add <description>[, <description>] [options]", "todo <description>[, <description>] [options]"],
      details: [
        "The add verb is optional: any unknown first word starts a task description.",
        "Separate several tasks with commas. The first --option ends the description;",
        "use a standalone -- when a description itself starts with a dash."
      ],
      options: [
        { flag: "--due <time>", description: "Due date: 1h, 30m, tomorrow, monday, next week, 16/08/2026" },
        { flag: "--priority <level>", description: "none (default), low, medium, or high" },
        { flag: "--reminders <minutes>", description: "Comma list of minutes before the due date to notify (alias --remind)" },
        { flag: "--under <id>", description: "Nest the new task under an existing task (aliases --parent, --in)" }
      ],
      examples: [
        { command: "todo buy oat milk", note: "implicit add" },
        { command: "todo buy oat milk, call dentist --priority high", note: "two tasks, both high" },
        { command: "todo add call dentist -- --due tomorrow --reminders 10,30" },
        { command: "todo add polish hero --under 2", note: "subtask of #2" }
      ]
    });
  }
};
async function createTasks(store, args, defaults = {}) {
  const options = parseAddArguments(args).map((option) => ({ ...defaults, ...option }));
  const tasks = await store.loadTasks();
  const config = await store.loadConfig();
  const now = Date.now();
  for (const option of options) {
    if (option.parentId !== undefined)
      findTask(tasks, option.parentId);
  }
  const newTasks = options.map((option, index) => createTask(option, getNextId(tasks) + index, now, config.defaultReminderOffsets));
  await store.saveTasks([...tasks, ...newTasks]);
  return newTasks;
}
function formatAddedTask(task) {
  const noun = task.kind === "epic" ? "epic" : "task";
  const location = task.parentId === undefined ? "" : ` under #${task.parentId}`;
  return `Added ${noun} ${task.id}${location}: ${task.description}
`;
}
function parseAddArguments(args, now = new Date) {
  const optionStart = args.findIndex((argument) => argument === "--" || argument.startsWith("--"));
  const descriptionParts = optionStart === -1 ? args : args.slice(0, optionStart);
  const optionArguments = optionStart === -1 ? [] : args.slice(optionStart);
  if (optionArguments[0] === "--")
    optionArguments.shift();
  const descriptions = parseDescriptions(descriptionParts);
  if (descriptions.length === 0) {
    throw new UserInputError("Usage: todo <description>[, <description>] [--due <time>] [--priority <level>] [--reminders <minutes>] [--under <id>]");
  }
  const options = { priority: "none" };
  for (let index = 0;index < optionArguments.length; index += 1) {
    const argument = optionArguments[index];
    if (argument === undefined)
      continue;
    const [name, inlineValue] = splitOption(argument);
    let value = inlineValue;
    if (value === undefined) {
      const valueParts = [];
      while (index + 1 < optionArguments.length) {
        const nextArgument = optionArguments[index + 1];
        if (nextArgument === undefined || nextArgument.startsWith("--"))
          break;
        valueParts.push(nextArgument);
        index += 1;
      }
      value = valueParts.join(" ");
    }
    if (value.length === 0) {
      throw new UserInputError(`Missing value for ${name}`);
    }
    if (name === "--priority") {
      options.priority = parsePriority(value);
    } else if (name === "--under" || name === "--parent" || name === "--in") {
      options.parentId = parseTaskIdArgument(value);
    } else if (name === "--due") {
      options.dueDate = parseDueDate(value, now);
    } else if (name === "--reminders" || name === "--remind" || name === "--r") {
      options.reminderOffsets = parseReminderOffsets(value);
    } else {
      throw new UnknownTokenError(`Unknown option: ${name}`, name, ADD_OPTION_NAMES, "option");
    }
  }
  return descriptions.map((description) => ({ ...options, description }));
}
function parseDescriptions(parts) {
  const descriptions = [];
  let words = [];
  function finishDescription() {
    const description = words.join(" ").trim();
    if (description.length > 0)
      descriptions.push(description);
    words = [];
  }
  for (const part of parts) {
    const startsWithSeparator = part.startsWith(",");
    const endsWithSeparator = part.endsWith(",");
    if (startsWithSeparator)
      finishDescription();
    const word = part.slice(startsWithSeparator ? 1 : 0, endsWithSeparator ? -1 : undefined);
    if (word.length > 0)
      words.push(word);
    if (endsWithSeparator)
      finishDescription();
  }
  finishDescription();
  return descriptions;
}
function createTask(options, id, now, defaultReminderOffsets) {
  const task = {
    id: `${id}`,
    description: options.description,
    status: "pending",
    priority: options.priority,
    createdAt: now,
    updatedAt: now,
    reminderOffsets: options.reminderOffsets ?? defaultReminderOffsets,
    notificationsSent: { reminders: [], overdue: false }
  };
  if (options.dueDate !== undefined)
    task.dueDate = options.dueDate;
  if (options.parentId !== undefined)
    task.parentId = options.parentId;
  if (options.kind !== undefined)
    task.kind = options.kind;
  return task;
}
var ADD_OPTION_NAMES = ["--due", "--priority", "--under", "--parent", "--in", "--reminders", "--remind"];
var PRIORITIES = ["none", "low", "medium", "high"];
function splitOption(argument) {
  const equalsIndex = argument.indexOf("=");
  if (equalsIndex === -1)
    return [argument, undefined];
  return [argument.slice(0, equalsIndex), argument.slice(equalsIndex + 1)];
}
function parsePriority(value) {
  if (value === "none" || value === "low" || value === "medium" || value === "high")
    return value;
  throw new UnknownTokenError(`Invalid priority: ${value}`, value, PRIORITIES, "value");
}
function parseTaskIdArgument(value) {
  const id = value.trim().replace(/^#/, "");
  if (!/^\d+$/.test(id))
    throw new UserInputError(`Invalid task ID: ${value}`);
  return id;
}
function parseReminderOffsets(value) {
  const offsets = value.split(",").map((offset) => Number(offset.trim()));
  if (offsets.length === 0 || offsets.some((offset) => !Number.isFinite(offset) || offset < 0)) {
    throw new UserInputError(`Invalid reminders: ${value}`);
  }
  return offsets;
}
function getNextId(tasks) {
  const numericIds = tasks.map((task) => Number.parseInt(task.id, 10)).filter((id) => Number.isFinite(id));
  return (numericIds.length === 0 ? 0 : Math.max(...numericIds)) + 1;
}

// src/domain/task.ts
var DEFAULT_CONFIG = {
  schemaVersion: 1,
  defaultReminderOffsets: [10, 30, 60],
  showNotificationsOnStartup: true,
  showCompletedTasksByDefault: false,
  shellDisplayLimit: 5,
  undoTimeout: 5000,
  autocorrect: true,
  collapsedEpicIds: []
};
var UNLIMITED_SHELL_DISPLAY = 0;

// src/domain/shell-display-limit.ts
function parseShellDisplayLimit(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "all" || normalized === "unlimited")
    return UNLIMITED_SHELL_DISPLAY;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new UserInputError(`Invalid task count: ${value}. Use a whole number or 'all'.`);
  }
  return parsed;
}
function normalizeShellDisplayLimit(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : DEFAULT_CONFIG.shellDisplayLimit;
}
function toShellDisplayCount(limit) {
  return limit === UNLIMITED_SHELL_DISPLAY ? Number.POSITIVE_INFINITY : limit;
}
function formatShellDisplayLimit(limit) {
  return limit === UNLIMITED_SHELL_DISPLAY ? "all" : `${limit}`;
}

// src/plugins/config.ts
var DIM2 = "\x1B[2m";
var RESET2 = "\x1B[0m";
var SETTINGS = [
  {
    name: "shell-limit",
    description: "Pending tasks shown in the shell panel (number, or 'all')",
    read(config) {
      return formatShellDisplayLimit(normalizeShellDisplayLimit(config.shellDisplayLimit));
    },
    apply(config, value) {
      return { ...config, shellDisplayLimit: parseShellDisplayLimit(value) };
    }
  },
  {
    name: "startup-notifications",
    description: "Send desktop notifications for due tasks on startup (on/off)",
    read(config) {
      return formatBoolean(config.showNotificationsOnStartup);
    },
    apply(config, value) {
      return { ...config, showNotificationsOnStartup: parseBoolean(value) };
    }
  },
  {
    name: "show-completed",
    description: "Include completed tasks in listings by default (on/off)",
    read(config) {
      return formatBoolean(config.showCompletedTasksByDefault);
    },
    apply(config, value) {
      return { ...config, showCompletedTasksByDefault: parseBoolean(value) };
    }
  },
  {
    name: "autocorrect",
    description: "Suggest and learn corrections for mistyped commands and options (on/off)",
    read(config) {
      return formatBoolean(config.autocorrect);
    },
    apply(config, value) {
      return { ...config, autocorrect: parseBoolean(value) };
    }
  }
];
var configPlugin = {
  name: "config",
  description: "Reads and writes persisted settings.",
  register(app) {
    app.command("config", "Read or change persisted settings.", async ({ args, store, stdout }) => {
      const config = await store.loadConfig();
      const [name, ...valueParts] = stripVerb(args);
      if (name === undefined) {
        for (const setting2 of SETTINGS) {
          stdout.write(`${setting2.name.padEnd(22)} ${setting2.read(config)}${DIM2}  ${setting2.description}${RESET2}
`);
        }
        return;
      }
      const setting = findSetting(name);
      if (valueParts.length === 0) {
        stdout.write(`${setting.read(config)}
`);
        return;
      }
      const updated = setting.apply(config, valueParts.join(" "));
      await store.saveConfig(updated);
      stdout.write(`${setting.name} = ${setting.read(updated)}
`);
    }, {
      group: "Settings",
      usage: ["todo config", "todo config <key>", "todo config <key> <value>"],
      details: [
        "Settings live in ~/.dotfiles/todo/config.json. An optional set/get verb is accepted.",
        ...SETTINGS.map((setting) => `${setting.name.padEnd(22)} ${setting.description}`)
      ],
      examples: [
        { command: "todo config shell-limit 15" },
        { command: "todo config shell-limit all" },
        { command: "todo config startup-notifications off" },
        { command: "todo config autocorrect off" }
      ],
      positional: "any"
    });
  }
};
function stripVerb(args) {
  return args[0] === "set" || args[0] === "get" ? args.slice(1) : args;
}
function findSetting(name) {
  const setting = SETTINGS.find((candidate) => candidate.name === name);
  if (setting === undefined) {
    const names = SETTINGS.map((candidate) => candidate.name);
    throw new UnknownTokenError(`Unknown setting: ${name}. Known settings: ${names.join(", ")}`, name, names, "setting");
  }
  return setting;
}
function parseBoolean(value) {
  const normalized = value.trim().toLowerCase();
  if (["on", "true", "yes", "1"].includes(normalized))
    return true;
  if (["off", "false", "no", "0"].includes(normalized))
    return false;
  throw new UnknownTokenError(`Invalid boolean: ${value}. Use on or off.`, value, ["on", "off"], "value");
}
function formatBoolean(value) {
  return value ? "on" : "off";
}

// src/plugins/due.ts
import { randomUUID } from "crypto";

// src/adapters/command-runner.ts
import { spawn as spawn2 } from "child_process";
import { statSync as statSync2 } from "fs";

// src/adapters/sound.ts
import { statSync } from "fs";
import { isAbsolute, resolve } from "path";
import { extname } from "path";

// src/adapters/notifier.ts
import { spawn } from "child_process";
function createNotifier() {
  return {
    async notify({ title, body, urgent }) {
      await runQuietly("notify-send", ["--app-name=todo", `--urgency=${urgent ? "critical" : "normal"}`, title, body]);
    }
  };
}
function runQuietly(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore", ...cwd === undefined ? {} : { cwd } });
    child.on("error", () => resolve(-1));
    child.on("close", (code) => resolve(code ?? -1));
  });
}

// src/adapters/sound.ts
var SUPPORTED_SOUND_EXTENSIONS = [".mp3", ".wav", ".ogg", ".oga", ".flac", ".opus"];
var CUSTOM_PLAYERS = [
  { command: "mpv", args: (path) => ["--no-video", "--really-quiet", path] },
  { command: "ffplay", args: (path) => ["-nodisp", "-autoexit", "-loglevel", "quiet", path] },
  { command: "mpg123", args: (path) => ["-q", path] }
];
function createSoundPlayer() {
  return {
    async play(choice) {
      if (choice.soundMode === "none")
        return;
      if (choice.soundMode === "default") {
        const code = await runQuietly("canberra-gtk-play", ["-i", "message"]);
        if (code !== 0)
          throw new Error("could not play the default notification sound");
        return;
      }
      const path = choice.soundPath;
      if (path === undefined)
        throw new Error("no custom sound path was stored");
      for (const player of CUSTOM_PLAYERS) {
        if (await runQuietly(player.command, player.args(path)) === 0)
          return;
      }
      throw new Error(`no available player could play ${path}`);
    }
  };
}
function resolveSoundChoice(value, cwd = process.cwd()) {
  if (value === "default")
    return { soundMode: "default" };
  if (value === "none")
    return { soundMode: "none" };
  const path = toAbsolutePath(value, cwd);
  const extension = extname(path).toLowerCase();
  if (!SUPPORTED_SOUND_EXTENSIONS.includes(extension)) {
    throw new UserInputError(`Unsupported sound format: ${value}
Supported: ${SUPPORTED_SOUND_EXTENSIONS.join(", ")}`);
  }
  let stats;
  try {
    stats = statSync(path);
  } catch {
    throw new UserInputError(`Sound file not found: ${path}`);
  }
  if (!stats.isFile())
    throw new UserInputError(`Sound path is not a file: ${path}`);
  return { soundMode: "custom", soundPath: path };
}
function toAbsolutePath(value, cwd = process.cwd()) {
  const home = process.env.HOME ?? "";
  if (value === "~")
    return home;
  const expanded = value.startsWith("~/") ? `${home}/${value.slice(2)}` : value;
  return isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
}

// src/adapters/command-runner.ts
var COMMAND_TIMEOUT_MS = 60000;
function createCommandRunner() {
  return {
    run(command, cwd) {
      return new Promise((resolve2) => {
        const child = spawn2("/bin/sh", ["-c", command], {
          stdio: "ignore",
          timeout: COMMAND_TIMEOUT_MS,
          ...cwd === undefined ? {} : { cwd }
        });
        child.on("error", (error) => resolve2({ exitCode: -1, error: error.message }));
        child.on("close", (code, signal) => {
          if (signal !== null)
            return resolve2({ exitCode: -1, error: `terminated by ${signal}` });
          resolve2({ exitCode: code ?? -1 });
        });
      });
    }
  };
}
function resolveCommandCwd(value, cwd = process.cwd()) {
  const path = value === "pwd" ? cwd : toAbsolutePath(value, cwd);
  let stats;
  try {
    stats = statSync2(path);
  } catch {
    throw new UserInputError(`Working directory not found: ${path}`);
  }
  if (!stats.isDirectory())
    throw new UserInputError(`Working directory is not a directory: ${path}`);
  return path;
}

// src/domain/due-expression.ts
var MILLISECONDS_PER_SECOND = 1000;
var SECONDS_PER_DAY = 86400;
var DURATION_UNITS = new Map([
  ["s", "second"],
  ["sec", "second"],
  ["secs", "second"],
  ["second", "second"],
  ["seconds", "second"],
  ["m", "minute"],
  ["min", "minute"],
  ["mins", "minute"],
  ["minute", "minute"],
  ["minutes", "minute"],
  ["h", "hour"],
  ["hr", "hour"],
  ["hrs", "hour"],
  ["hour", "hour"],
  ["hours", "hour"],
  ["d", "day"],
  ["day", "day"],
  ["days", "day"]
]);
var UNIT_SECONDS = {
  second: 1,
  minute: 60,
  hour: 3600
};
var CALENDAR_OFFSETS = new Map([
  ["today", 0],
  ["tomorrow", 1],
  ["yesterday", -1],
  ["next week", 7]
]);
var WEEKDAYS2 = new Map([
  ["sunday", 0],
  ["sun", 0],
  ["monday", 1],
  ["mon", 1],
  ["mo", 1],
  ["tuesday", 2],
  ["tue", 2],
  ["tues", 2],
  ["wednesday", 3],
  ["wed", 3],
  ["thursday", 4],
  ["thu", 4],
  ["thur", 4],
  ["thurs", 4],
  ["friday", 5],
  ["fri", 5],
  ["saturday", 6],
  ["sat", 6]
]);
var MONTHS2 = new Map([
  ["jan", 1],
  ["january", 1],
  ["januari", 1],
  ["feb", 2],
  ["february", 2],
  ["februari", 2],
  ["mar", 3],
  ["march", 3],
  ["mrt", 3],
  ["maart", 3],
  ["apr", 4],
  ["april", 4],
  ["may", 5],
  ["mei", 5],
  ["jun", 6],
  ["june", 6],
  ["juni", 6],
  ["jul", 7],
  ["july", 7],
  ["juli", 7],
  ["aug", 8],
  ["august", 8],
  ["augustus", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["oct", 10],
  ["october", 10],
  ["okt", 10],
  ["oktober", 10],
  ["nov", 11],
  ["november", 11],
  ["dec", 12],
  ["december", 12]
]);
var INVALID_DUE_EXAMPLES = [
  "todo due 27 10m",
  "todo due 27 1h",
  "todo due 27 tomorrow",
  'todo due 27 "next monday"',
  "todo due 27 12-06"
];
function resolveDueExpression(value, now = new Date) {
  return resolveParsedDue(parseDueExpression(value, now), now);
}
function parseDueExpression(value, now = new Date) {
  const parsed = tryParseDueExpression(value, now);
  if (parsed === undefined)
    throw invalidDueError(value);
  return parsed;
}
function tryParseDueExpression(value, now = new Date) {
  const cleaned = value.trim().replace(/\s+/g, " ").toLowerCase();
  if (cleaned.length === 0)
    return;
  const split = splitExplicitTime(cleaned);
  if (split === undefined)
    return;
  const { datePart, time } = split;
  const expression = readExpression(normalizeDecimalComma(datePart), now.getFullYear());
  if (expression === undefined)
    return;
  if (expression.kind === "duration" && time !== undefined)
    return;
  return { expression, time };
}
function invalidDueError(value) {
  const examples = INVALID_DUE_EXAMPLES.map((example) => `  ${example}`).join(`
`);
  return new UserInputError(`Invalid due date: "${value}"

Examples:
${examples}`);
}
function resolveParsedDue({ expression, time }, now = new Date) {
  if (expression.kind === "duration")
    return resolveDuration(expression.amount, expression.unit, now);
  const target = resolveCalendarDate(expression, now);
  const applied = time ?? currentTimeOfDay(now);
  target.setHours(applied.hours, applied.minutes, applied.seconds, 0);
  return target.getTime();
}
function resolveDuration(amount, unit, now) {
  if (unit !== "day")
    return now.getTime() + Math.round(amount * UNIT_SECONDS[unit] * MILLISECONDS_PER_SECOND);
  const wholeDays = Math.floor(amount);
  const target = new Date(now);
  target.setDate(target.getDate() + wholeDays);
  const remainderSeconds = (amount - wholeDays) * SECONDS_PER_DAY;
  return target.getTime() + Math.round(remainderSeconds * MILLISECONDS_PER_SECOND);
}
function resolveCalendarDate(expression, now) {
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
function currentTimeOfDay(now) {
  return { hours: now.getHours(), minutes: now.getMinutes(), seconds: now.getSeconds() };
}
function splitExplicitTime(input) {
  const match = input.match(/^(.*\S)\s+at\s+(\S+)$/);
  if (match === null)
    return { datePart: input, time: undefined };
  const time = parseTimeOfDay2(match[2] ?? "");
  if (time === undefined)
    return;
  return { datePart: match[1] ?? "", time };
}
function parseTimeOfDay2(token) {
  const match = token.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match === null)
    return;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59)
    return;
  return { hours, minutes, seconds };
}
function normalizeDecimalComma(input) {
  return input.replace(/(\d),(\d)/g, "$1.$2");
}
function readExpression(datePart, currentYear) {
  return readDuration(datePart) ?? readCalendarOffset(datePart) ?? readWeekday(datePart) ?? readNumericDate2(datePart, currentYear) ?? readTextualDate(datePart, currentYear);
}
function readDuration(datePart) {
  const match = datePart.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (match === null)
    return;
  const unit = DURATION_UNITS.get(match[2] ?? "");
  const amount = Number(match[1]);
  if (unit === undefined || !Number.isFinite(amount) || amount < 0)
    return;
  return { kind: "duration", amount, unit };
}
function readCalendarOffset(datePart) {
  const days = CALENDAR_OFFSETS.get(datePart);
  return days === undefined ? undefined : { kind: "calendar-offset", days };
}
function readWeekday(datePart) {
  const match = datePart.match(/^next ([a-z]+)$/);
  if (match === null)
    return;
  const weekday = WEEKDAYS2.get(match[1] ?? "");
  return weekday === undefined ? undefined : { kind: "weekday", weekday };
}
function readNumericDate2(datePart, currentYear) {
  const compact = datePart.match(/^(\d{2})(\d{2})$/);
  if (compact !== null)
    return buildDate(currentYear, Number(compact[2]), Number(compact[1]));
  const separated = datePart.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2}|\d{4}))?$/);
  if (separated === null)
    return;
  return buildDate(readYear(separated[3]) ?? currentYear, Number(separated[2]), Number(separated[1]));
}
function readTextualDate(datePart, currentYear) {
  const match = datePart.match(/^(\d{1,2}) ([a-z]+)(?: (\d{2}|\d{4}))?$/);
  if (match === null)
    return;
  const month = MONTHS2.get(match[2] ?? "");
  if (month === undefined)
    return;
  return buildDate(readYear(match[3]) ?? currentYear, month, Number(match[1]));
}
function readYear(token) {
  if (token === undefined)
    return;
  const year = Number(token);
  return token.length === 2 ? 2000 + year : year;
}
function buildDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31)
    return;
  if (!isRealDate(year, month, day))
    return;
  return { kind: "absolute-date", year, month, day };
}
function isRealDate(year, month, day) {
  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day;
}

// src/presentation/due-format.ts
var MINUTE_MS = 60000;
var HOUR_MS = 60 * MINUTE_MS;
var DAY_MS = 24 * HOUR_MS;
var SOON_WINDOW_MS = 30 * MINUTE_MS;
var DUE_COLORS = {
  reset: "\x1B[0m",
  dim: "\x1B[2m",
  bold: "\x1B[1m",
  overdue: "\x1B[38;5;203m",
  soon: "\x1B[38;5;229m",
  upcoming: "\x1B[38;5;116m",
  label: "\x1B[38;5;147m"
};
var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function getDueUrgency(dueAt, now) {
  if (dueAt < now)
    return "overdue";
  return dueAt - now <= SOON_WINDOW_MS ? "soon" : "upcoming";
}
function getUrgencyColor(dueAt, now) {
  return DUE_COLORS[getDueUrgency(dueAt, now)];
}
function formatAbsoluteDue(dueAt) {
  const date = new Date(dueAt);
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = MONTH_NAMES[date.getMonth()];
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${day} ${month} ${date.getFullYear()} \xB7 ${hours}:${minutes}`;
}
function formatRelativeDue(dueAt, now) {
  const difference = dueAt - now;
  const parts = splitDuration(Math.abs(difference), 2);
  return difference < 0 ? `overdue by ${parts}` : `in ${parts}`;
}
function formatCompactDue(dueAt, now) {
  if (dueAt < now)
    return `overdue ${splitDuration(now - dueAt, 1)}`;
  const difference = dueAt - now;
  if (difference < HOUR_MS)
    return `due in ${splitDuration(difference, 1)}`;
  const dayGap = countCalendarDaysBetween(now, dueAt);
  if (dayGap === 0)
    return `due in ${splitDuration(difference, 1)}`;
  if (dayGap === 1)
    return "due tomorrow";
  return `due ${formatShortDate(dueAt, now)}`;
}
function formatShortDate(dueAt, now) {
  const date = new Date(dueAt);
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear() === new Date(now).getFullYear() ? "" : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${month}${year}`;
}
function formatSound(reminder) {
  if (reminder.soundMode === "none")
    return "none";
  if (reminder.soundMode === "default")
    return "default";
  return reminder.soundPath ?? "custom";
}
function formatNotifyState(reminder) {
  return reminder.firedAt === undefined ? "enabled" : `fired ${formatAbsoluteDue(reminder.firedAt)}`;
}
function countCalendarDaysBetween(from, to) {
  const start = startOfDay(new Date(from));
  const end = startOfDay(new Date(to));
  return Math.round((end - start) / DAY_MS);
}
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
function splitDuration(milliseconds, maximumParts) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const units = [
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
    [1, "s"]
  ];
  const parts = [];
  let remaining = totalSeconds;
  for (const [size, suffix] of units) {
    const amount = Math.floor(remaining / size);
    if (amount === 0 && parts.length === 0)
      continue;
    if (amount > 0)
      parts.push(`${amount}${suffix}`);
    remaining -= amount * size;
    if (parts.length >= maximumParts)
      break;
  }
  return parts.length === 0 ? "0s" : parts.join(" ");
}

// src/domain/visibility-alias.ts
var ACTION_LETTERS = { t: "toggle", o: "open", c: "close" };
var TARGET_LETTERS = { a: "all", r: "reset" };
var HELP_TOKENS = new Set(["help", "-h", "--help"]);
var VISIBILITY_ALIASES = [
  { alias: "-tr", meaning: "toggle reset" },
  { alias: "-oa", meaning: "open all" },
  { alias: "-ca", meaning: "close all" },
  { alias: "--t --r", meaning: "toggle reset" },
  { alias: "--o --a", meaning: "open all" },
  { alias: "--c --a", meaning: "close all" },
  { alias: "-t <epic>", meaning: "toggle <epic>" },
  { alias: "-o <epic>", meaning: "open <epic>" },
  { alias: "-c <epic>", meaning: "close <epic>" }
];
function isHelpToken(token) {
  return HELP_TOKENS.has(token);
}
function expandVisibilityAliases(args) {
  const letters = [];
  let index = 0;
  for (;index < args.length; index += 1) {
    const parsed = readAliasLetters(args[index]);
    if (parsed === undefined)
      break;
    letters.push(...parsed);
  }
  if (letters.length === 0 || new Set(letters).size !== letters.length)
    return;
  const actions = letters.filter((letter) => (letter in ACTION_LETTERS));
  const targets = letters.filter((letter) => (letter in TARGET_LETTERS));
  const action = actions[0];
  if (action === undefined || actions.length !== 1)
    return;
  const rest = args.slice(index);
  const help = rest.filter(isHelpToken);
  const selectors = rest.filter((token) => !isHelpToken(token));
  if (selectors.some((token) => token.startsWith("-")))
    return;
  if (targets.length === 0 && selectors.length === 0 && help.length === 0)
    return;
  return [ACTION_LETTERS[action], ...targets.map((letter) => TARGET_LETTERS[letter]), ...selectors, ...help];
}
function readAliasLetters(token) {
  if (token.startsWith("--")) {
    const body = token.slice(2);
    return body.length === 1 && isAliasLetter(body) ? [body] : undefined;
  }
  if (!token.startsWith("-") || token.length < 2)
    return;
  const letters = [...token.slice(1)];
  return letters.every(isAliasLetter) ? letters : undefined;
}
function isAliasLetter(letter) {
  return letter in ACTION_LETTERS || letter in TARGET_LETTERS;
}

// src/presentation/help-format.ts
var GROUP_ORDER = ["Create", "View", "Change", "Epic visibility", "Remove", "Settings"];
var INDENT = "  ";
var COLOR_PALETTE = {
  reset: "\x1B[0m",
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  accent: "\x1B[38;5;208m",
  heading: "\x1B[38;5;147m",
  command: "\x1B[38;5;114m",
  placeholder: "\x1B[38;5;116m",
  flag: "\x1B[38;5;229m"
};
var PLAIN_PALETTE = {
  reset: "",
  bold: "",
  dim: "",
  accent: "",
  heading: "",
  command: "",
  placeholder: "",
  flag: ""
};
function supportsColor() {
  if (process.env.NO_COLOR !== undefined)
    return false;
  if (process.env.FORCE_COLOR !== undefined)
    return true;
  return process.stdout.isTTY === true;
}
function formatHelpOverview(commands, useColor = supportsColor()) {
  const p = useColor ? COLOR_PALETTE : PLAIN_PALETTE;
  const lines = [""];
  lines.push(`${INDENT}${p.accent}${p.bold}\u2713 todo${p.reset}  ${p.dim}\xB7${p.reset}  tasks, epics and subtasks from the shell`);
  lines.push("");
  lines.push(heading("Usage", p));
  lines.push(`${INDENT}${INDENT}${highlightUsage("todo <description>[, <description>] [--due <time>] [--priority <level>]", p)}`);
  lines.push(`${INDENT}${INDENT}${highlightUsage("todo <command> [arguments]", p)}`);
  lines.push(`${INDENT}${INDENT}${highlightUsage("todo <command> --help", p)}`);
  const width = Math.max(...commands.map((command) => formatCommandLabel(command).length));
  for (const group of groupCommands(commands)) {
    lines.push("");
    lines.push(heading(group.name, p));
    for (const command of group.commands) {
      const label = formatCommandLabel(command);
      const padding = " ".repeat(width - label.length + 3);
      lines.push(`${INDENT}${INDENT}${colorCommandLabel(command, p)}${padding}${command.description}`);
    }
  }
  lines.push("");
  lines.push(heading("Aliases", p));
  const aliasWidth = Math.max(...VISIBILITY_ALIASES.map((alias) => alias.alias.length));
  for (const { alias, meaning } of VISIBILITY_ALIASES) {
    const padding = " ".repeat(aliasWidth - alias.length + 3);
    lines.push(`${INDENT}${INDENT}${highlightInline(alias, p)}${padding}${p.dim}${meaning}${p.reset}`);
  }
  lines.push("");
  lines.push(`${INDENT}${p.dim}Plain text is added as a task. Run${p.reset} ${p.command}todo <command> --help${p.reset} ${p.dim}for details on any command.${p.reset}`);
  lines.push("");
  return `${lines.join(`
`)}
`;
}
function formatCommandHelp(command, useColor = supportsColor()) {
  const p = useColor ? COLOR_PALETTE : PLAIN_PALETTE;
  const help = command.help;
  const lines = [""];
  lines.push(`${INDENT}${p.accent}${p.bold}todo ${command.name}${p.reset}  ${p.dim}\xB7${p.reset}  ${command.description}`);
  if (help.aliases !== undefined && help.aliases.length > 0) {
    lines.push(`${INDENT}${p.dim}aliases:${p.reset} ${help.aliases.map((alias) => `${p.command}${alias}${p.reset}`).join(`${p.dim},${p.reset} `)}`);
  }
  lines.push("");
  lines.push(heading("Usage", p));
  for (const usage of help.usage ?? [`todo ${command.name}`]) {
    lines.push(`${INDENT}${INDENT}${highlightUsage(usage, p)}`);
  }
  if (help.aliasNotes !== undefined && help.aliasNotes.length > 0) {
    lines.push("");
    lines.push(heading("Aliases", p));
    for (const alias of help.aliasNotes)
      lines.push(`${INDENT}${INDENT}${highlightInline(alias, p)}`);
  }
  if (help.details !== undefined && help.details.length > 0) {
    lines.push("");
    lines.push(heading("Details", p));
    for (const detail of help.details)
      lines.push(`${INDENT}${INDENT}${highlightInline(detail, p)}`);
  }
  if (help.options !== undefined && help.options.length > 0) {
    lines.push("");
    lines.push(heading("Options", p));
    const width = Math.max(...help.options.map((option) => option.flag.length));
    for (const option of help.options) {
      const padding = " ".repeat(width - option.flag.length + 3);
      lines.push(`${INDENT}${INDENT}${highlightInline(option.flag, p)}${padding}${highlightInline(option.description, p)}`);
    }
  }
  if (help.examples !== undefined && help.examples.length > 0) {
    lines.push("");
    lines.push(heading("Examples", p));
    const width = Math.max(...help.examples.map((example) => example.command.length));
    for (const example of help.examples) {
      const note = example.note === undefined ? "" : `${" ".repeat(width - example.command.length + 3)}${p.dim}# ${example.note}${p.reset}`;
      lines.push(`${INDENT}${INDENT}${p.dim}$${p.reset} ${highlightUsage(example.command, p)}${note}`);
    }
  }
  lines.push("");
  return `${lines.join(`
`)}
`;
}
function formatHelpSections(title, subtitle, sections, useColor = supportsColor()) {
  const p = useColor ? COLOR_PALETTE : PLAIN_PALETTE;
  const lines = [""];
  lines.push(`${INDENT}${p.accent}${p.bold}${title}${p.reset}  ${p.dim}\xB7${p.reset}  ${subtitle}`);
  for (const section of sections) {
    if (section.rows.length === 0)
      continue;
    lines.push("");
    lines.push(heading(section.heading, p));
    const width = Math.max(...section.rows.map((row) => row.right === undefined ? 0 : row.left.length));
    for (const row of section.rows) {
      if (row.right === undefined) {
        lines.push(`${INDENT}${INDENT}${highlightUsage(row.left, p)}`);
        continue;
      }
      const padding = " ".repeat(width - row.left.length + 3);
      lines.push(`${INDENT}${INDENT}${highlightInline(row.left, p)}${padding}${p.dim}${row.right}${p.reset}`);
    }
  }
  lines.push("");
  return `${lines.join(`
`)}
`;
}
function formatCommandLabel(command) {
  const aliases = command.help.aliases ?? [];
  return aliases.length === 0 ? command.name : `${command.name}, ${aliases.join(", ")}`;
}
function colorCommandLabel(command, p) {
  const aliases = command.help.aliases ?? [];
  const name = `${p.command}${p.bold}${command.name}${p.reset}`;
  return aliases.length === 0 ? name : `${name}${p.dim}, ${aliases.join(", ")}${p.reset}`;
}
function heading(text, p) {
  return `${INDENT}${p.heading}${p.bold}${text.toUpperCase()}${p.reset}`;
}
function groupCommands(commands) {
  const groups = new Map(GROUP_ORDER.map((group) => [group, []]));
  for (const command of commands) {
    groups.get(command.help.group ?? "Settings")?.push(command);
  }
  return [...groups.entries()].filter(([, members]) => members.length > 0).map(([name, members]) => ({ name, commands: members }));
}
function highlightUsage(usage, p) {
  const tokens = usage.split(" ");
  return tokens.map((token, index) => {
    if (index === 0 && token === "todo")
      return `${p.dim}todo${p.reset}`;
    if (index === 1 && tokens[0] === "todo" && /^[a-z-]+$/.test(token))
      return `${p.command}${token}${p.reset}`;
    return highlightInline(token, p);
  }).join(" ");
}
function highlightInline(text, p) {
  return text.replace(/<[^>]+>/g, (match) => `${p.placeholder}${match}${p.reset}`).replace(/(^|[\s[(|,])(--?[a-z][\w-]*)/g, (_match, lead, flag) => `${lead}${p.flag}${flag}${p.reset}`).replace(/`([^`]+)`/g, (_match, code) => `${p.command}${code}${p.reset}`);
}

// src/presentation/due-help.ts
function formatDueHelp(topic, useColor = supportsColor()) {
  const page = PAGES[topic];
  return formatHelpSections(page.title, page.subtitle, page.sections, useColor);
}
var OVERVIEW = {
  title: "todo due",
  subtitle: "due dates, reminders, and what happens when one fires",
  sections: [
    {
      heading: "Usage",
      rows: [
        { left: "todo due <todo> <when>" },
        { left: "todo due <todo> <when> at <time>" },
        { left: "todo due <todo>" },
        { left: "todo due <todo> clear" },
        { left: "todo due <todo> reset" },
        { left: "todo due list" }
      ]
    },
    {
      heading: "Relative",
      rows: [
        { left: "30s", right: "30 seconds" },
        { left: "10m", right: "10 minutes" },
        { left: "1h", right: "1 hour" },
        { left: "3,5h", right: "3.5 hours (3.5h works too)" },
        { left: "2d", right: "2 calendar days" }
      ]
    },
    {
      heading: "Calendar",
      rows: [
        { left: "today", right: "today at the current clock time" },
        { left: "tomorrow", right: "tomorrow at the current clock time" },
        { left: "yesterday", right: "already overdue, on purpose" },
        { left: "next week", right: "same weekday, seven days on" },
        { left: "next monday", right: "the next Monday strictly after today" },
        { left: "next tue", right: "abbreviations work for every weekday" }
      ]
    },
    {
      heading: "Dates",
      rows: [
        { left: "1206", right: "12 June, current year" },
        { left: "12-06", right: "day first, the Dutch way" },
        { left: "12 jul", right: "English or Dutch month names" },
        { left: "12 juli", right: "same date as 12 jul" },
        { left: "12-06-2027", right: "two-digit years read as 20YY" }
      ]
    },
    {
      heading: "Times",
      rows: [
        { left: "tomorrow at 09:00", right: "HH:mm or HH:mm:ss, 24 hour" },
        { left: "next monday at 14:30" },
        { left: "12-06 at 18:00" }
      ]
    },
    {
      heading: "Notification",
      rows: [
        { left: "--sound default", right: "the desktop notification sound" },
        { left: "--sound none", right: "notify silently" },
        { left: "--sound ~/Music/reminder.mp3", right: "validated and stored as an absolute path" }
      ]
    },
    {
      heading: "Trigger",
      rows: [
        { left: '--run "bun run build"', right: "runs once when this reminder fires" },
        { left: "--cwd ~/projects/dora", right: "directory to run it in" },
        { left: "--cwd pwd", right: "capture the current directory now" }
      ]
    },
    {
      heading: "Examples",
      rows: [
        { left: "todo due 27 tomorrow" },
        { left: "todo due 27 10m" },
        { left: "todo due 27 3,5h" },
        { left: 'todo due 27 "next monday" at 09:00' },
        { left: "todo due 27 12-06 at 14:00" },
        { left: "todo due 27 1h --sound ~/Music/todo.mp3" },
        { left: 'todo due 27 10m --run "bun run build" --cwd pwd' }
      ]
    },
    {
      heading: "Notes",
      rows: [
        { left: "Omitting a time keeps the current local clock time." },
        { left: "Past dates are valid; they store, render overdue, and notify once." },
        { left: "`m` always means minutes. There is no month unit." },
        { left: "Run `todo due daemon --help` for background delivery." }
      ]
    }
  ]
};
var PAGES = {
  due: OVERVIEW,
  list: {
    title: "todo due list",
    subtitle: "every todo that currently has a due date",
    sections: [
      { heading: "Usage", rows: [{ left: "todo due list [overdue|today|week]" }] },
      {
        heading: "Filters",
        rows: [
          { left: "overdue", right: "only todos already past their due date" },
          { left: "today", right: "overdue plus anything due before midnight" },
          { left: "week", right: "overdue plus the next seven days" }
        ]
      },
      {
        heading: "Details",
        rows: [
          { left: "Overdue first, most overdue at the top, then upcoming soonest first." },
          { left: "Completed todos keep their due date but are left out of this list." }
        ]
      },
      { heading: "Examples", rows: [{ left: "todo due list" }, { left: "todo due list overdue" }] }
    ]
  },
  inspect: {
    title: "todo due <todo>",
    subtitle: "show the due date, reminder state, and trigger for one todo",
    sections: [
      { heading: "Usage", rows: [{ left: "todo due <todo>" }] },
      {
        heading: "Details",
        rows: [
          { left: "Shows the exact timestamp, how far away it is, and whether it has notified." },
          { left: "The todo can be an ID, #ID, or the exact name of a pending todo." }
        ]
      },
      { heading: "Examples", rows: [{ left: "todo due 27" }, { left: "todo due #27" }] }
    ]
  },
  clear: {
    title: "todo due <todo> clear",
    subtitle: "remove a due date and its reminder",
    sections: [
      { heading: "Usage", rows: [{ left: "todo due <todo> clear" }, { left: "todo due <todo> remove" }] },
      {
        heading: "Details",
        rows: [
          { left: "Removes the due date and cancels its scheduled reminder." },
          { left: "The todo itself is kept. `clear` is the canonical spelling." }
        ]
      },
      { heading: "Examples", rows: [{ left: "todo due 27 clear" }] }
    ]
  },
  reset: {
    title: "todo due <todo> reset",
    subtitle: "rearm the notification without changing the due date",
    sections: [
      { heading: "Usage", rows: [{ left: "todo due <todo> reset" }] },
      {
        heading: "Details",
        rows: [
          { left: "Clears the fired state of the current schedule so it can notify again." },
          { left: "The due date, sound, and trigger command are all left alone." },
          { left: "An already-overdue reminder fires again on the scheduler's next cycle." }
        ]
      },
      { heading: "Examples", rows: [{ left: "todo due 27 reset" }] }
    ]
  },
  daemon: {
    title: "todo due daemon",
    subtitle: "the background scheduler that delivers reminders",
    sections: [
      {
        heading: "Usage",
        rows: [{ left: "todo due daemon run" }, { left: "todo due daemon install" }, { left: "todo due daemon status" }]
      },
      {
        heading: "Details",
        rows: [
          { left: "One scheduler handles every reminder; there is no process per todo." },
          { left: "`install` writes a systemd user service and enables it, so reminders survive a reboot." },
          { left: "`run` stays in the foreground and is what the service starts." },
          { left: "Any `todo` command also delivers overdue reminders, so this is a delivery" },
          { left: "guarantee rather than a requirement." }
        ]
      },
      { heading: "Examples", rows: [{ left: "todo due daemon install" }, { left: "todo due daemon status" }] }
    ]
  }
};

// src/scheduler/daemon.ts
import { watch } from "fs";
import { dirname } from "path";

// src/scheduler/reminder-processor.ts
async function processDueReminders(store, effects, now = Date.now()) {
  const claimed = await store.runExclusive(async () => {
    const tasks = await store.loadTasks();
    const ready = tasks.filter((task) => isReadyToFire(task, now));
    if (ready.length === 0)
      return [];
    for (const task of ready) {
      if (task.reminder !== undefined)
        task.reminder.firedAt = now;
    }
    await store.saveTasks(tasks);
    return ready.map((task) => ({ task, reminder: { ...task.reminder } }));
  });
  if (claimed.length === 0)
    return [];
  const outcomes = await Promise.all(claimed.map(({ task, reminder }) => deliver(task, reminder, effects)));
  await recordOutcomes(store, outcomes);
  return claimed.map(({ task, reminder }) => ({ taskId: task.id, reminderId: reminder.id, description: task.description }));
}
function isReadyToFire(task, now) {
  const reminder = task.reminder;
  if (reminder === undefined)
    return false;
  return task.status === "pending" && reminder.firedAt === undefined && reminder.dueAt <= now;
}
function findNextWakeAt(tasks, now) {
  const upcoming = tasks.filter((task) => task.reminder !== undefined && task.status === "pending" && task.reminder.firedAt === undefined).map((task) => task.reminder.dueAt).filter((dueAt) => dueAt > now);
  return upcoming.length === 0 ? undefined : Math.min(...upcoming);
}
async function deliver(task, reminder, effects) {
  const outcome = { taskId: task.id, reminderId: reminder.id };
  try {
    await effects.notifier.notify({
      title: "Todo due",
      body: `#${task.id} \xB7 ${task.description}`,
      urgent: true
    });
  } catch {}
  try {
    await effects.sound.play(reminder);
  } catch (error) {
    outcome.soundError = error instanceof Error ? error.message : String(error);
  }
  if (reminder.run !== undefined) {
    const result = await effects.runner.run(reminder.run, reminder.cwd);
    outcome.runExitCode = result.exitCode;
    if (result.error !== undefined)
      outcome.runError = result.error;
  }
  return outcome;
}
async function recordOutcomes(store, outcomes) {
  const interesting = outcomes.filter((outcome) => outcome.soundError !== undefined || outcome.runExitCode !== undefined);
  if (interesting.length === 0)
    return;
  await store.runExclusive(async () => {
    const tasks = await store.loadTasks();
    let changed = false;
    for (const outcome of interesting) {
      const reminder = tasks.find((task) => task.id === outcome.taskId)?.reminder;
      if (reminder === undefined || reminder.id !== outcome.reminderId)
        continue;
      if (outcome.soundError !== undefined)
        reminder.soundError = outcome.soundError;
      if (outcome.runExitCode !== undefined)
        reminder.runExitCode = outcome.runExitCode;
      if (outcome.runError !== undefined)
        reminder.runError = outcome.runError;
      changed = true;
    }
    if (changed)
      await store.saveTasks(tasks);
  });
}

// src/scheduler/daemon.ts
var MAX_SLEEP_MS = 15 * 60 * 1000;
var MIN_SLEEP_MS = 250;
var WATCH_DEBOUNCE_MS = 150;
async function runScheduler(store, options = {}) {
  const effects = options.effects ?? createDefaultEffects();
  const watcher = watchTasksFile(store);
  try {
    for (let cycle = 0;options.maxCycles === undefined || cycle < options.maxCycles; cycle += 1) {
      if (options.signal?.aborted === true)
        return;
      await processDueReminders(store, effects);
      const nextWakeAt = findNextWakeAt(await store.loadTasks(), Date.now());
      options.onCycle?.(nextWakeAt);
      if (options.maxCycles !== undefined && cycle + 1 >= options.maxCycles)
        return;
      await sleepUntil(nextWakeAt, watcher.changed, options.signal);
    }
  } finally {
    watcher.close();
  }
}
function createDefaultEffects() {
  return { notifier: createNotifier(), sound: createSoundPlayer(), runner: createCommandRunner() };
}
function watchTasksFile(store) {
  const directory = dirname(store.tasksFile);
  let notify;
  let timer;
  let handle;
  try {
    handle = watch(directory, () => {
      if (timer !== undefined)
        clearTimeout(timer);
      timer = setTimeout(() => notify?.(), WATCH_DEBOUNCE_MS);
    });
    handle.on("error", () => {
      return;
    });
  } catch {
    handle = undefined;
  }
  return {
    changed: () => new Promise((resolve2) => {
      notify = resolve2;
    }),
    close() {
      if (timer !== undefined)
        clearTimeout(timer);
      handle?.close();
    }
  };
}
function sleepUntil(nextWakeAt, changed, signal) {
  const requested = nextWakeAt === undefined ? MAX_SLEEP_MS : nextWakeAt - Date.now();
  const duration = Math.max(MIN_SLEEP_MS, Math.min(MAX_SLEEP_MS, requested));
  return new Promise((resolve2) => {
    const timer = setTimeout(finish, duration);
    function finish() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve2();
    }
    signal?.addEventListener("abort", finish, { once: true });
    changed().then(finish);
  });
}

// src/scheduler/service.ts
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
var SERVICE_NAME = "todo-scheduler.service";
function getServicePath() {
  return join(process.env.HOME ?? ".", ".config", "systemd", "user", SERVICE_NAME);
}
function buildServiceUnit(executable) {
  return [
    "[Unit]",
    "Description=todo reminder scheduler",
    "After=graphical-session.target",
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=${executable} due daemon run`,
    "Restart=always",
    "RestartSec=5",
    "",
    "[Install]",
    "WantedBy=default.target",
    ""
  ].join(`
`);
}
function findTodoExecutable() {
  const installed = join(process.env.HOME ?? ".", ".config", "dotfiles", "bin", "todo");
  if (existsSync(installed))
    return installed;
  const script = process.argv[1];
  return script === undefined ? installed : `${process.execPath} ${script}`;
}
async function installService() {
  const path = getServicePath();
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, buildServiceUnit(findTodoExecutable()), "utf8");
  await runQuietly("systemctl", ["--user", "daemon-reload"]);
  const enabled = await runQuietly("systemctl", ["--user", "enable", "--now", SERVICE_NAME]) === 0;
  return { path, enabled };
}
async function isServiceActive() {
  return await runQuietly("systemctl", ["--user", "is-active", "--quiet", SERVICE_NAME]) === 0;
}

// src/plugins/due.ts
var { reset, dim, bold, label } = DUE_COLORS;
var HELP_TOKENS2 = new Set(["help", "-h", "--help"]);
var CLEAR_WORDS = new Set(["clear", "remove"]);
var DUE_USAGE = "Usage: todo due <todo> <when> | todo due <todo> [clear|reset] | todo due list";
var duePlugin = {
  name: "due",
  description: "Set, inspect, and clear due dates with reminders.",
  register(app) {
    app.command("due", "Set, inspect, and clear due dates with reminders.", dueCommand, {
      group: "Change",
      positional: "any",
      ownHelp: true,
      usage: [
        "todo due <todo> <when> [at <time>] [options]",
        "todo due <todo>",
        "todo due <todo> clear",
        "todo due <todo> reset",
        "todo due list [overdue|today|week]"
      ],
      details: [
        "Relative (10m, 1h, 3,5h, 2d), calendar (tomorrow, next monday), and dates (12-06, 12 juli).",
        "A due date notifies once, natively, even after the shell that set it has exited.",
        "Run `todo due --help` for the full date syntax."
      ],
      options: [
        { flag: "--sound <default|none|file>", description: "Notification sound; a custom file is stored as an absolute path" },
        { flag: "--run <command>", description: "Command to execute once when the reminder fires" },
        { flag: "--cwd <path|pwd>", description: "Working directory for --run; pwd captures the current one" }
      ],
      examples: [
        { command: "todo due 27 tomorrow" },
        { command: "todo due 27 3,5h" },
        { command: 'todo due 27 "next monday" at 09:00' },
        { command: 'todo due 27 10m --run "bun run build" --cwd pwd' },
        { command: "todo due list overdue" }
      ]
    });
  }
};
async function dueCommand(context) {
  const { args, stdout } = context;
  const helpIndex = args.findIndex((argument) => HELP_TOKENS2.has(argument));
  if (helpIndex !== -1) {
    stdout.write(formatDueHelp(readHelpTopic(args.slice(0, helpIndex))));
    return;
  }
  const [first, ...rest] = args;
  if (first === undefined)
    throw new UserInputError(DUE_USAGE);
  if (first === "list")
    return await listDue(context, rest);
  if (first === "daemon")
    return await daemonCommand(context, rest);
  return await targetedDueCommand(context, first, rest);
}
function readHelpTopic(prefix) {
  if (prefix.length === 0)
    return "due";
  if (prefix[0] === "list")
    return "list";
  if (prefix[0] === "daemon")
    return "daemon";
  if (prefix[1] !== undefined && CLEAR_WORDS.has(prefix[1]))
    return "clear";
  if (prefix[1] === "reset")
    return "reset";
  if (prefix.length === 1)
    return "inspect";
  return "due";
}
async function targetedDueCommand({ store, stdout }, selector, rest) {
  const verb = rest[0];
  if (verb === undefined) {
    const task = findTaskByIdOrDescription(await store.loadTasks(), selector);
    stdout.write(formatInspect(task, Date.now()));
    return;
  }
  if (CLEAR_WORDS.has(verb)) {
    if (rest.length !== 1)
      throw new UserInputError(`Usage: todo due ${selector} clear`);
    return await mutate(store, selector, (tasks, task) => clearDue(tasks, task, stdout));
  }
  if (verb === "reset") {
    if (rest.length !== 1)
      throw new UserInputError(`Usage: todo due ${selector} reset`);
    return await mutate(store, selector, (tasks, task) => resetDue(tasks, task, stdout));
  }
  const options = parseDueOptions(rest);
  return await mutate(store, selector, (tasks, task) => setDue(tasks, task, options, stdout));
}
async function mutate(store, selector, change) {
  await store.runExclusive(async () => {
    const tasks = await store.loadTasks();
    const task = findTaskByIdOrDescription(tasks, selector);
    if (change(tasks, task))
      await store.saveTasks(tasks);
  });
}
function setDue(tasks, task, options, stdout) {
  const { when, sound, run, cwd } = options;
  const now = new Date;
  const dueAt = resolveDueExpression(when, now);
  const reminder = {
    id: randomUUID(),
    dueAt,
    expression: when,
    createdAt: now.getTime(),
    soundMode: sound.soundMode
  };
  if (sound.soundPath !== undefined)
    reminder.soundPath = sound.soundPath;
  if (run !== undefined)
    reminder.run = run;
  if (cwd !== undefined)
    reminder.cwd = cwd;
  task.reminder = reminder;
  task.dueDate = dueAt;
  task.updatedAt = now.getTime();
  const color = getUrgencyColor(dueAt, now.getTime());
  stdout.write(`${color}Due #${task.id}${reset} ${bold}${formatAbsoluteDue(dueAt)}${reset} ${dim}(${formatRelativeDue(dueAt, now.getTime())})${reset}
`);
  return true;
}
function clearDue(_tasks, task, stdout) {
  if (task.reminder === undefined && task.dueDate === undefined) {
    stdout.write(`${dim}#${task.id} has no due date${reset}
`);
    return false;
  }
  delete task.reminder;
  delete task.dueDate;
  task.updatedAt = Date.now();
  stdout.write(`${DUE_COLORS.upcoming}Cleared the due date on #${task.id}${reset}
`);
  return true;
}
function resetDue(_tasks, task, stdout) {
  const reminder = task.reminder;
  if (reminder === undefined)
    throw new UserInputError(`#${task.id} has no due date to reset. Set one with 'todo due ${task.id} <when>'.`);
  delete reminder.firedAt;
  delete reminder.soundError;
  delete reminder.runExitCode;
  delete reminder.runError;
  task.updatedAt = Date.now();
  const relative = formatRelativeDue(reminder.dueAt, Date.now());
  stdout.write(`${DUE_COLORS.upcoming}Rearmed the reminder on #${task.id}${reset} ${dim}(due ${formatAbsoluteDue(reminder.dueAt)}, ${relative})${reset}
`);
  return true;
}
var DUE_FLAGS = ["--sound", "--run", "--cwd"];
function parseDueOptions(rest) {
  const flagStart = rest.findIndex((argument) => argument.startsWith("--"));
  const whenParts = flagStart === -1 ? rest : rest.slice(0, flagStart);
  const when = whenParts.join(" ").trim();
  if (when.length === 0)
    throw new UserInputError(DUE_USAGE);
  let sound = { soundMode: "default" };
  let run;
  let cwd;
  let rawCwd;
  const flagArguments = flagStart === -1 ? [] : rest.slice(flagStart);
  for (let index = 0;index < flagArguments.length; index += 1) {
    const argument = flagArguments[index];
    if (argument === undefined)
      continue;
    const equalsIndex = argument.indexOf("=");
    const name = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);
    let value = equalsIndex === -1 ? "" : argument.slice(equalsIndex + 1);
    if (equalsIndex === -1) {
      const valueParts = [];
      while (index + 1 < flagArguments.length) {
        const next = flagArguments[index + 1];
        if (next === undefined || next.startsWith("--"))
          break;
        valueParts.push(next);
        index += 1;
      }
      value = valueParts.join(" ");
    }
    if (value.length === 0)
      throw new UserInputError(`Missing value for ${name}`);
    if (name === "--sound")
      sound = resolveSoundChoice(value);
    else if (name === "--run")
      run = value;
    else if (name === "--cwd")
      rawCwd = value;
    else
      throw new UserInputError(`Unknown option: ${name}
Supported: ${DUE_FLAGS.join(", ")}`);
  }
  if (rawCwd !== undefined) {
    if (run === undefined)
      throw new UserInputError("--cwd only applies to --run; add a --run command or drop --cwd.");
    cwd = resolveCommandCwd(rawCwd);
  }
  return { when, sound, run, cwd };
}
function formatInspect(task, now) {
  const lines = [`${bold}Todo #${task.id}${reset} ${dim}${task.description}${reset}`];
  const reminder = task.reminder;
  if (reminder === undefined) {
    if (task.dueDate === undefined) {
      lines.push(`${dim}No due date. Set one with 'todo due ${task.id} tomorrow'.${reset}`);
      return `${lines.join(`
`)}
`;
    }
    lines.push(row("Due", `${formatAbsoluteDue(task.dueDate)}`));
    lines.push(row("Relative", formatRelativeDue(task.dueDate, now)));
    lines.push(row("Notify", `${dim}legacy reminder from 'todo add --due'${reset}`));
    return `${lines.join(`
`)}
`;
  }
  const color = getUrgencyColor(reminder.dueAt, now);
  lines.push(row("Due", `${color}${formatAbsoluteDue(reminder.dueAt)}${reset}`));
  lines.push(row("Relative", `${color}${formatRelativeDue(reminder.dueAt, now)}${reset}`));
  lines.push(row("Notify", task.status === "completed" ? "suppressed (completed)" : formatNotifyState(reminder)));
  lines.push(row("Sound", formatSound(reminder)));
  if (reminder.soundError !== undefined)
    lines.push(row("Sound error", `${DUE_COLORS.overdue}${reminder.soundError}${reset}`));
  if (reminder.run !== undefined)
    lines.push(row("Run", reminder.run));
  if (reminder.cwd !== undefined)
    lines.push(row("Cwd", reminder.cwd));
  if (reminder.runExitCode !== undefined)
    lines.push(row("Run result", formatRunResult(reminder)));
  return `${lines.join(`
`)}
`;
}
function formatRunResult(reminder) {
  if (reminder.runError !== undefined)
    return `${DUE_COLORS.overdue}${reminder.runError}${reset}`;
  const code = reminder.runExitCode;
  return code === 0 ? "exit 0" : `${DUE_COLORS.overdue}exit ${code}${reset}`;
}
function row(name, value) {
  return `${label}${`${name}:`.padEnd(11)}${reset}${value}`;
}
async function listDue({ store, stdout }, rest) {
  const filter = readListFilter(rest);
  const now = Date.now();
  const tasks = (await store.loadTasks()).filter((task) => task.status === "pending" && task.dueDate !== undefined);
  const matching = tasks.filter((task) => matchesFilter(task.dueDate, filter, now)).sort(compareByUrgency);
  if (matching.length === 0) {
    stdout.write(`${dim}No todos with a due date${filter === "all" ? "" : ` (${filter})`}${reset}
`);
    return;
  }
  const width = Math.min(28, Math.max(...matching.map((task) => task.description.length)));
  for (const task of matching) {
    const dueAt = task.dueDate;
    const color = getUrgencyColor(dueAt, now);
    const id = `${dim}#${task.id.padStart(2, "0")}${reset}`;
    const description = truncate(task.description, width).padEnd(width);
    stdout.write(`${id}  ${description}  ${color}${formatCompactDue(dueAt, now)}${reset}
`);
  }
}
function readListFilter(rest) {
  const [filter, ...extra] = rest;
  if (filter === undefined)
    return "all";
  if (extra.length > 0)
    throw new UserInputError("Usage: todo due list [overdue|today|week]");
  if (filter === "overdue" || filter === "today" || filter === "week")
    return filter;
  throw new UserInputError(`Unknown filter: ${filter}
Usage: todo due list [overdue|today|week]`);
}
function matchesFilter(dueAt, filter, now) {
  if (filter === "all")
    return true;
  if (filter === "overdue")
    return dueAt < now;
  const end = new Date(now);
  if (filter === "today")
    end.setHours(23, 59, 59, 999);
  else
    end.setDate(end.getDate() + 7);
  return dueAt <= end.getTime();
}
function compareByUrgency(left, right) {
  return left.dueDate - right.dueDate;
}
function truncate(value, maximumLength) {
  return value.length > maximumLength ? `${value.slice(0, maximumLength - 1)}\u2026` : value;
}
async function daemonCommand({ store, stdout }, rest) {
  const action = rest[0] ?? "run";
  if (rest.length > 1)
    throw new UserInputError("Usage: todo due daemon [run|install|status]");
  if (action === "run") {
    await runScheduler(store);
    return;
  }
  if (action === "install") {
    const { path, enabled } = await installService();
    stdout.write(`${DUE_COLORS.upcoming}Wrote ${path}${reset}
`);
    stdout.write(enabled ? `${DUE_COLORS.upcoming}Enabled and started ${SERVICE_NAME}${reset}
` : `${DUE_COLORS.overdue}Could not enable ${SERVICE_NAME}; start it with 'systemctl --user enable --now ${SERVICE_NAME}'${reset}
`);
    return;
  }
  if (action === "status") {
    const active = await isServiceActive();
    stdout.write(active ? `${DUE_COLORS.upcoming}${SERVICE_NAME} is running${reset}
` : `${dim}${SERVICE_NAME} is not running. Install it with 'todo due daemon install'.${reset}
`);
    return;
  }
  throw new UserInputError("Usage: todo due daemon [run|install|status]");
}

// src/plugins/epic.ts
var GREEN = "\x1B[32m";
var RESET3 = "\x1B[0m";
var epicPlugin = {
  name: "epic",
  description: "Groups tasks under epics and moves them around the tree.",
  register(app) {
    app.command("epic", "Create an epic that groups subtasks.", async ({ args, store, stdout }) => {
      if (args.length === 0)
        throw new UserInputError("Usage: todo epic <name>[, <name>] [--under <id>]");
      const epics = await createTasks(store, args, { kind: "epic" });
      for (const epic of epics)
        stdout.write(formatAddedTask(epic));
    }, {
      group: "Create",
      positional: "text",
      usage: ["todo epic <name>[, <name>] [options]"],
      details: [
        "An epic is a task that renders bold with a [done/total] badge even while empty.",
        "Accepts the same options as `todo add`."
      ],
      options: [
        { flag: "--due <time>", description: "Due date for the epic itself" },
        { flag: "--priority <level>", description: "none, low, medium, or high" },
        { flag: "--under <id>", description: "Nest the epic under another task" }
      ],
      examples: [
        { command: "todo epic Website redesign" },
        { command: "todo epic Q4 launch, Hiring --priority high" }
      ]
    });
    app.command("sub", "Add subtasks under an existing task.", async ({ args, store, stdout }) => {
      const { parentId, rest } = resolveSubTarget(await store.loadTasks(), args);
      const tasks = await createTasks(store, rest, { parentId });
      for (const task of tasks)
        stdout.write(formatAddedTask(task));
    }, {
      group: "Create",
      positional: "task-id",
      usage: ["todo sub <id|name> <description>[, <description>] [options]"],
      details: [
        "The parent can be a task ID or the exact name of an existing task; the longest matching",
        "name wins and the description starts right after it.",
        "Nesting has no depth limit. Accepts the same options as `todo add` except --under."
      ],
      options: [
        { flag: "--due <time>", description: "Due date for each new subtask" },
        { flag: "--priority <level>", description: "none, low, medium, or high" },
        { flag: "--reminders <minutes>", description: "Minutes before the due date to notify" }
      ],
      examples: [
        { command: "todo sub 1 fix header, fix footer", note: "two subtasks under #1" },
        { command: "todo sub new month pay rent", note: "under the task named new month" },
        { command: "todo sub 3 write tests --due friday" }
      ]
    });
    app.command("move", "Re-parent a task inside the tree.", moveCommand, {
      group: "Change",
      positional: "task-id",
      aliases: ["mv"],
      usage: ["todo move <id> <parent-id>", "todo move <id> root"],
      details: ["The whole subtree moves along. root, top, and - all mean the top level."],
      examples: [
        { command: "todo move 5 2", note: "nest #5 under #2" },
        { command: "todo move 5 root", note: "back to the top level" }
      ]
    });
  }
};
function resolveSubTarget(tasks, args) {
  const [first, ...rest] = args;
  if (first === undefined)
    throw new UserInputError(SUB_USAGE);
  if (/^#?\d+$/.test(first.trim())) {
    if (rest.length === 0)
      throw new UserInputError(SUB_USAGE);
    return { parentId: parseTaskIdArgument(first), rest };
  }
  const nameLimit = getNameLimit(args);
  for (let length = nameLimit;length > 0; length -= 1) {
    const match = findTaskByName(tasks, args.slice(0, length).join(" "));
    if (match === undefined)
      continue;
    return { parentId: match.id, rest: args.slice(length) };
  }
  throw new UserInputError(`Task not found: ${args.slice(0, nameLimit).join(" ")}`);
}
function getNameLimit(args) {
  const stop = args.findIndex((argument) => argument.startsWith("--") || argument.endsWith(","));
  const limit = stop === -1 ? args.length : stop;
  return Math.min(limit, args.length - 1);
}
function findTaskByName(tasks, name) {
  const needle = normalizeName(name);
  if (needle.length === 0)
    return;
  const matches = tasks.filter((task) => normalizeName(task.description) === needle);
  const pending = matches.filter((task) => task.status === "pending");
  const candidates = pending.length > 0 ? pending : matches;
  return candidates.find((task) => task.kind === "epic") ?? candidates[0];
}
function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
var SUB_USAGE = "Usage: todo sub <id|name> <description>[, <description>]";
async function moveCommand({ args, store, stdout }) {
  const [id, target] = args;
  if (id === undefined || target === undefined || args.length !== 2)
    throw new UserInputError("Usage: todo move <id> <parent-id|root>");
  const tasks = await store.loadTasks();
  const parentId = isRootTarget(target) ? undefined : parseTaskIdArgument(target);
  const task = moveTask(tasks, parseTaskIdArgument(id), parentId);
  await store.saveTasks(tasks);
  stdout.write(parentId === undefined ? `${GREEN}Moved #${task.id} to the top level${RESET3}
` : `${GREEN}Moved #${task.id} under #${parentId}${RESET3}
`);
}
function isRootTarget(value) {
  return value === "root" || value === "top" || value === "-";
}

// src/plugins/help.ts
import { emitKeypressEvents } from "readline";

// src/domain/help-search.ts
function findMatches(lines, query) {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0)
    return [];
  const matches = [];
  lines.forEach((line, index) => {
    const haystack = line.toLowerCase();
    let from = 0;
    for (;; ) {
      const start = haystack.indexOf(needle, from);
      if (start === -1)
        break;
      matches.push({ line: index, start, end: start + needle.length });
      from = start + needle.length;
    }
  });
  return matches;
}
function findMatchingLines(lines, query) {
  return [...new Set(findMatches(lines, query).map((match) => match.line))];
}
function stepMatch(current, total, direction) {
  if (total === 0)
    return -1;
  return ((current + direction) % total + total) % total;
}
function matchesOnLine(matches, line) {
  return matches.filter((match) => match.line === line);
}

// src/presentation/ansi-text.ts
var ANSI_PATTERN = /\u001B\[[0-9;]*m/g;
function stripAnsi(value) {
  return value.replace(ANSI_PATTERN, "");
}
function getVisibleWidth(value) {
  return stripAnsi(value).length;
}
function clipVisible(value, width) {
  if (width <= 0)
    return "";
  if (getVisibleWidth(value) <= width)
    return value;
  let result = "";
  let visible = 0;
  for (const token of tokenize(value)) {
    if (token.escape) {
      result += token.text;
      continue;
    }
    for (const character of token.text) {
      if (visible === width)
        return `${result}\x1B[0m`;
      result += character;
      visible += 1;
    }
  }
  return `${result}\x1B[0m`;
}
function highlightVisibleRanges(value, ranges, on, off) {
  if (ranges.length === 0)
    return value;
  const starts = new Map(ranges.map((range) => [range.start, range]));
  const ends = new Map(ranges.map((range) => [range.end, range]));
  let result = "";
  let visible = 0;
  let activeOff;
  for (const token of tokenize(value)) {
    if (token.escape) {
      result += token.text;
      continue;
    }
    for (const character of token.text) {
      const ending = ends.get(visible);
      if (activeOff !== undefined && ending !== undefined) {
        result += activeOff;
        activeOff = undefined;
      }
      const starting = starts.get(visible);
      if (starting !== undefined) {
        result += starting.on ?? on;
        activeOff = starting.off ?? off;
      }
      result += character;
      visible += 1;
    }
  }
  return activeOff === undefined ? result : `${result}${activeOff}`;
}
function tokenize(value) {
  const tokens = [];
  let lastIndex = 0;
  for (const match of value.matchAll(ANSI_PATTERN)) {
    if (match.index > lastIndex)
      tokens.push({ text: value.slice(lastIndex, match.index), escape: false });
    tokens.push({ text: match[0], escape: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < value.length)
    tokens.push({ text: value.slice(lastIndex), escape: false });
  return tokens;
}

// src/presentation/help-browser.ts
var RESET4 = "\x1B[0m";
var DIM3 = "\x1B[2m";
var BOLD2 = "\x1B[1m";
var ACCENT = "\x1B[38;5;208m";
var HEADING = "\x1B[38;5;147m";
var MATCH_ON = "\x1B[48;5;238m";
var MATCH_OFF = "\x1B[49m";
var CURRENT_ON = "\x1B[48;5;208m\x1B[38;5;232m";
var CURRENT_OFF = "\x1B[49m\x1B[39m";
var HEADER_HEIGHT = 3;
var FOOTER_HEIGHT = 1;

class HelpBrowser {
  lines;
  terminal;
  mode = "browse";
  offset = 0;
  savedOffset = 0;
  query = "";
  draft = "";
  matches = [];
  matchIndex = -1;
  done = false;
  constructor(lines, terminal) {
    this.lines = lines;
    this.terminal = terminal;
  }
  get closed() {
    return this.done;
  }
  handleKey(key) {
    if (key.ctrl === true && key.name === "c") {
      this.done = true;
      return;
    }
    if (this.mode === "search")
      this.handleSearchKey(key);
    else
      this.handleBrowseKey(key);
  }
  render() {
    const width = Math.max(40, this.terminal.columns);
    const body = this.visibleLines();
    const height = this.bodyHeight;
    this.offset = clamp(this.offset, 0, Math.max(0, body.length - height));
    const window = body.slice(this.offset, this.offset + height);
    const lines = [...this.renderHeader(width, body.length)];
    for (const index of window)
      lines.push(this.renderLine(index, width));
    for (let filler = window.length;filler < height; filler += 1)
      lines.push("");
    lines.push(this.renderFooter(width));
    return lines.join(`
`);
  }
  visibleLines() {
    if (this.mode === "search" && this.draft.trim().length > 0) {
      return findMatchingLines(this.lines.map((line) => line.plain), this.draft);
    }
    return this.lines.map((_line, index) => index);
  }
  get bodyHeight() {
    return Math.max(1, Math.max(8, this.terminal.rows) - HEADER_HEIGHT - FOOTER_HEIGHT);
  }
  handleBrowseKey(key) {
    const half = Math.max(1, Math.floor(this.bodyHeight / 2));
    if (key.sequence === "/") {
      this.mode = "search";
      this.savedOffset = this.offset;
      this.draft = "";
      this.offset = 0;
      return;
    }
    if (key.sequence === "n" || isEnter(key))
      return this.stepToMatch(1);
    if (key.sequence === "N")
      return this.stepToMatch(-1);
    if (key.sequence === "q" || key.name === "escape" && this.query.length === 0) {
      this.done = true;
      return;
    }
    if (key.name === "escape") {
      this.clearSearch();
      return;
    }
    if (key.sequence === "j" || key.name === "down")
      this.scroll(1);
    else if (key.sequence === "k" || key.name === "up")
      this.scroll(-1);
    else if (key.ctrl === true && key.name === "d")
      this.scroll(half);
    else if (key.ctrl === true && key.name === "u")
      this.scroll(-half);
    else if (key.name === "pagedown" || key.name === "space" || key.sequence === " ")
      this.scroll(this.bodyHeight);
    else if (key.name === "pageup" || key.sequence === "b")
      this.scroll(-this.bodyHeight);
    else if (key.sequence === "g" || key.name === "home")
      this.offset = 0;
    else if (key.sequence === "G" || key.name === "end")
      this.offset = Number.MAX_SAFE_INTEGER;
  }
  handleSearchKey(key) {
    if (isEnter(key)) {
      this.commitSearch();
      return;
    }
    if (key.name === "escape") {
      this.mode = "browse";
      this.draft = "";
      this.offset = this.savedOffset;
      return;
    }
    if (key.name === "backspace") {
      this.draft = this.draft.slice(0, -1);
      this.offset = 0;
      return;
    }
    if (key.ctrl === true && key.name === "u") {
      this.draft = "";
      this.offset = 0;
      return;
    }
    if (key.ctrl !== true && key.sequence !== undefined && key.sequence.length === 1 && key.sequence >= " ") {
      this.draft += key.sequence;
      this.offset = 0;
    }
  }
  commitSearch() {
    this.query = this.draft.trim();
    this.matches = findMatches(this.lines.map((line) => line.plain), this.query);
    this.mode = "browse";
    this.draft = "";
    if (this.matches.length === 0) {
      this.matchIndex = -1;
      this.offset = this.savedOffset;
      return;
    }
    this.matchIndex = 0;
    this.centerOn(this.matches[0].line);
  }
  clearSearch() {
    this.query = "";
    this.matches = [];
    this.matchIndex = -1;
  }
  stepToMatch(direction) {
    const next = stepMatch(this.matchIndex, this.matches.length, direction);
    if (next === -1)
      return;
    this.matchIndex = next;
    this.centerOn(this.matches[next].line);
  }
  centerOn(line) {
    this.offset = Math.max(0, line - Math.floor(this.bodyHeight / 2));
  }
  scroll(amount) {
    this.offset = Math.max(0, this.offset + amount);
  }
  renderHeader(width, bodyLength) {
    const counter = `${HEADING}${this.counterText(bodyLength)}${RESET4}`;
    const name = `${ACCENT}${BOLD2}\u2713 todo help${RESET4}`;
    const subtitle = `  ${DIM3}\xB7  searchable command reference${RESET4}`;
    const title = getVisibleWidth(name) + getVisibleWidth(subtitle) + getVisibleWidth(counter) + 6 <= width ? `${name}${subtitle}` : name;
    return [
      clipVisible(padBetween(`  ${title}`, `${counter}  `, width), width),
      clipVisible(`  ${this.renderSearchBar()}`, width),
      `${DIM3}${"\u2500".repeat(width)}${RESET4}`
    ];
  }
  renderSearchBar() {
    if (this.mode === "search")
      return `${HEADING}/${RESET4} ${this.draft}${BOLD2}\u258F${RESET4}`;
    if (this.query.length > 0)
      return `${HEADING}/${RESET4} ${this.query}   ${DIM3}n next \xB7 N previous \xB7 Esc clear${RESET4}`;
    return `${DIM3}/ to search \xB7 j k \u2191 \u2193 to scroll${RESET4}`;
  }
  counterText(bodyLength) {
    if (this.mode === "search") {
      if (this.draft.trim().length === 0)
        return "type to filter";
      return bodyLength === 1 ? "1 matching line" : `${bodyLength} matching lines`;
    }
    if (this.query.length > 0) {
      if (this.matches.length === 0)
        return `0/0 matches for "${this.query}"`;
      return `${this.matchIndex + 1}/${this.matches.length} matches`;
    }
    const last = Math.min(bodyLength, this.offset + this.bodyHeight);
    return `${last}/${bodyLength} lines`;
  }
  renderFooter(width) {
    const options = this.mode === "search" ? [["Enter search", "Esc cancel", "^u clear"], ["Enter search", "Esc cancel"]] : [["j k \u2191 \u2193 scroll", "^d ^u page", "g G ends", "/ search", "n N matches", "q quit"], ["j k scroll", "/ search", "n N matches", "q quit"], ["/ search", "q quit"]];
    const hints = options.find((candidate) => candidate.join(" \xB7 ").length + 2 <= width) ?? options[options.length - 1];
    return clipVisible(`${DIM3}  ${hints.join(" \xB7 ")}${RESET4}`, width);
  }
  renderLine(index, width) {
    const line = this.lines[index];
    if (line === undefined)
      return "";
    const needle = this.mode === "search" ? this.draft : this.query;
    if (needle.trim().length === 0)
      return clipVisible(line.text, width);
    const current = this.matches[this.matchIndex];
    const ranges = matchesOnLine(findMatches([line.plain], needle), 0).map((match) => ({
      start: match.start,
      end: match.end,
      ...current !== undefined && current.line === index && current.start === match.start ? { on: CURRENT_ON, off: CURRENT_OFF } : {}
    }));
    return clipVisible(highlightVisibleRanges(line.text, ranges, MATCH_ON, MATCH_OFF), width);
  }
}
function isEnter(key) {
  return key.name === "return" || key.name === "enter";
}
function padBetween(left, right, width) {
  const padding = " ".repeat(Math.max(1, width - getVisibleWidth(left) - getVisibleWidth(right)));
  return `${left}${padding}${right}`;
}
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum));
}

// src/presentation/help-document.ts
function buildHelpDocument(commands, useColor) {
  const sections = [formatHelpOverview(commands, useColor), ...commands.map((command) => formatCommandHelp(command, useColor))];
  const lines = sections.join(`
`).split(`
`);
  return collapseBlankRuns(lines).map((text) => ({ text, plain: stripAnsi(text) }));
}
function collapseBlankRuns(lines) {
  const result = [];
  for (const line of lines) {
    const blank = stripAnsi(line).trim().length === 0;
    if (blank && result.length > 0 && stripAnsi(result[result.length - 1]).trim().length === 0)
      continue;
    result.push(line);
  }
  while (result.length > 0 && stripAnsi(result[result.length - 1]).trim().length === 0)
    result.pop();
  return result;
}

// src/plugins/help.ts
var PLAIN_FLAG = "--plain";
var helpPlugin = {
  name: "help",
  description: "Browse the searchable help, or show details for one command.",
  register(app) {
    app.command("help", "Browse the searchable help, or show details for one command.", async ({ args, stdout, commands }) => {
      const [name] = args.filter((argument) => argument !== PLAIN_FLAG);
      if (name !== undefined) {
        stdout.write(formatCommandHelp(findCommand(commands, name)));
        return;
      }
      if (args.includes(PLAIN_FLAG) || !isInteractiveTerminal()) {
        stdout.write(formatHelpOverview(commands));
        return;
      }
      await browseHelp(commands);
    }, {
      group: "Settings",
      usage: ["todo help", "todo help <command>", "todo help --plain", "todo <command> --help"],
      details: [
        "With no arguments in a terminal this opens the searchable help browser:",
        "j/k or the arrow keys scroll, ^d/^u page, g/G jump to the ends, / searches,",
        "Enter runs the search, n and N step through the matches, and q quits.",
        "Piped or redirected output stays plain, as does `todo help --plain`."
      ],
      options: [{ flag: "--plain", description: "Print the overview instead of opening the browser" }],
      examples: [{ command: "todo help rm" }, { command: "todo sub --help" }, { command: "todo help --plain | less" }],
      positional: "any"
    });
  }
};
function findCommand(commands, name) {
  const command = commands.find((candidate) => candidate.name === name || candidate.help.aliases?.includes(name));
  if (command === undefined) {
    const names = commands.flatMap((candidate) => [candidate.name, ...candidate.help.aliases ?? []]);
    throw new UnknownTokenError(`Unknown command: ${name}
Run 'todo help' for the list of commands.`, name, names, "command");
  }
  return command;
}
function isInteractiveTerminal() {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}
async function browseHelp(commands) {
  const terminal = {
    write(text) {
      process.stdout.write(text);
    },
    get columns() {
      return process.stdout.columns ?? 80;
    },
    get rows() {
      return process.stdout.rows ?? 24;
    }
  };
  const browser = new HelpBrowser(buildHelpDocument(commands, supportsColor()), terminal);
  const wasRaw = process.stdin.isRaw;
  const draw = () => {
    terminal.write(`\x1B[H${browser.render().split(`
`).join(`\x1B[K
`)}\x1B[K\x1B[J`);
  };
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  terminal.write("\x1B[?1049h\x1B[?1007h\x1B[?25l");
  await new Promise((resolve2) => {
    const handleKeypress = (_character, key) => {
      if (key !== undefined)
        browser.handleKey(key);
      if (browser.closed) {
        process.stdin.off("keypress", handleKeypress);
        process.stdout.off("resize", draw);
        resolve2();
        return;
      }
      draw();
    };
    process.stdin.on("keypress", handleKeypress);
    process.stdout.on("resize", draw);
    draw();
  });
  terminal.write("\x1B[?25h\x1B[?1007l\x1B[?1049l");
  if (!wasRaw)
    process.stdin.setRawMode(false);
  process.stdin.pause();
}

// src/plugins/interactive.ts
import { emitKeypressEvents as emitKeypressEvents2 } from "readline";

// src/presentation/task-format.ts
var RESET5 = "\x1B[0m";
var DIM4 = "\x1B[2m";
var BOLD3 = "\x1B[1m";
var GREEN2 = "\x1B[38;5;114m";
var RED = "\x1B[38;5;203m";
var YELLOW = "\x1B[38;5;229m";
var PEACH = "\x1B[38;5;208m";
var SKY = "\x1B[38;5;116m";
var SUBTEXT = "\x1B[38;5;217m";
var PRIORITY_COLORS = {
  none: SUBTEXT,
  low: SKY,
  medium: YELLOW,
  high: RED
};
function formatTaskForDisplay(task, now = Date.now()) {
  return formatTask(task, task.description, now, true);
}
function formatTaskTreeRowForDisplay(row2, now = Date.now()) {
  const description = row2.hasChildren || row2.task.kind === "epic" ? `${BOLD3}${row2.task.description}${RESET5}` : row2.task.description;
  return `${formatTreePrefix(row2)}${formatTask(row2.task, description, now, true)}${formatRowSuffix(row2)}`;
}
function formatTaskRowForShellDisplay(row2, now = Date.now()) {
  const prefix = formatTreePrefix(row2);
  const badge = formatRowSuffix(row2);
  const description = truncate2(row2.task.description, Math.max(12, 38 - getVisibleLength(prefix) - getVisibleLength(badge)));
  const emphasized = row2.hasChildren || row2.task.kind === "epic" ? `${BOLD3}${description}${RESET5}` : description;
  const taskText = formatTask(row2.task, emphasized, now, false);
  const id = `${DIM4}#${row2.task.id.padStart(2, "0")}${RESET5}`;
  return {
    left: `${id}  ${prefix}${taskText}${badge}`,
    right: `${DIM4}${formatCreatedAt(row2.task.createdAt)}${RESET5}`
  };
}
function formatTreePrefix(row2) {
  if (row2.depth === 0)
    return "";
  const guides = row2.siblingFollows.slice(1, -1).map((follows) => follows ? "\u2502  " : "   ");
  const connector = row2.siblingFollows[row2.siblingFollows.length - 1] ? "\u251C\u2500 " : "\u2514\u2500 ";
  return `${DIM4}${guides.join("")}${connector}${RESET5}`;
}
function formatProgressBadge(row2) {
  if (row2.progress.total > 0) {
    const color = row2.progress.completed === row2.progress.total ? GREEN2 : SKY;
    return ` ${color}[${row2.progress.completed}/${row2.progress.total}]${RESET5}`;
  }
  return row2.task.kind === "epic" ? ` ${DIM4}[epic]${RESET5}` : "";
}
function formatCollapsedSummary(row2) {
  return ` ${SKY}\u25CF${RESET5} ${DIM4}${row2.childCount} subticket${row2.childCount === 1 ? "" : "s"}${RESET5}`;
}
function formatRowSuffix(row2) {
  return row2.collapsed ? formatCollapsedSummary(row2) : formatProgressBadge(row2);
}
function formatTask(task, description, now, includeId) {
  const parts = [];
  if (task.priority !== "none") {
    parts.push(`${PRIORITY_COLORS[task.priority]}[${task.priority.toUpperCase()}]${RESET5}`);
  }
  parts.push(`${getUrgencyColor2(task.dueDate, now)}${description}${RESET5}`);
  if (task.dueDate !== undefined) {
    parts.push(`${getUrgencyColor2(task.dueDate, now)}${formatCompactDue(task.dueDate, now)}${RESET5}`);
  }
  if (includeId)
    parts.push(`${DIM4}(${task.id})${RESET5}`);
  return parts.join(" ");
}
function isUpcoming(timestamp, now = Date.now()) {
  const difference = timestamp - now;
  return difference > 0 && difference < 30 * 60 * 1000;
}
function isOverdue(timestamp, now = Date.now()) {
  return timestamp < now;
}
function getUrgencyColor2(timestamp, now) {
  if (timestamp === undefined)
    return SUBTEXT;
  if (isOverdue(timestamp, now))
    return RED;
  if (isUpcoming(timestamp, now))
    return YELLOW;
  if ((timestamp - now) / (60 * 60 * 1000) < 2)
    return PEACH;
  return SUBTEXT;
}
function truncate2(value, maximumLength) {
  return value.length > maximumLength ? `${value.slice(0, maximumLength - 3)}...` : value;
}
function getVisibleLength(value) {
  return value.replace(/\u001B\[[0-9;]*m/g, "").length;
}
function formatCreatedAt(timestamp) {
  const date = new Date(timestamp);
  const month = date.toLocaleString(undefined, { month: "short" });
  const day = date.getDate().toString().padStart(2, "0");
  const time = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  return `${day} ${month} \xB7 ${time}`;
}

// src/notifications.ts
import { spawnSync } from "child_process";
async function sendDueNotifications(store, now = Date.now()) {
  const tasks = await store.loadTasks();
  let changed = false;
  for (const task of tasks) {
    if (task.status !== "pending" || task.dueDate === undefined)
      continue;
    if (task.reminder !== undefined)
      continue;
    if (task.dueDate < now && !task.notificationsSent.overdue) {
      sendNotification("Task Overdue", `${task.description} - due ${formatDueDate(task.dueDate)}`);
      task.notificationsSent.overdue = true;
      changed = true;
    }
    for (const offset of task.reminderOffsets) {
      if (now < task.dueDate - offset * 60000 || task.notificationsSent.reminders.includes(offset))
        continue;
      sendNotification("Task Reminder", `${task.description} - due in ${offset} minutes`);
      task.notificationsSent.reminders.push(offset);
      changed = true;
    }
  }
  if (changed)
    await store.saveTasks(tasks);
}
function sendNotification(title, message) {
  spawnSync("notify-send", [title, message], { stdio: "ignore" });
}
function formatDueDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(timestamp);
}
function resetNotificationState(task) {
  task.notificationsSent = { reminders: [], overdue: false };
  if (task.reminder !== undefined)
    delete task.reminder.firedAt;
}

// src/plugins/undo.ts
var DIM5 = "\x1B[2m";
var GREEN3 = "\x1B[32m";
var RESET6 = "\x1B[0m";
var undoPlugin = {
  name: "undo",
  description: "Restores the most recently deleted tasks or snoozes a task.",
  register(app) {
    app.command("undo", "Restore the most recently deleted task or tasks.", async ({ args, store, stdout }) => {
      if (args.length > 0)
        throw new UserInputError("Usage: todo undo");
      const undo = await store.loadUndo();
      if (undo === undefined || undo.tasks.length === 0) {
        stdout.write(`${DIM5}Nothing to undo${RESET6}
`);
        return;
      }
      const tasks = await store.loadTasks();
      const restoredTasks = restoreTasks(tasks, undo.tasks);
      await store.saveTasks([...tasks, ...restoredTasks]);
      await store.clearUndo();
      stdout.write(`${GREEN3}Restored ${restoredTasks.length} task(s)${RESET6}
`);
    }, {
      group: "Remove",
      usage: ["todo undo"],
      details: ["Only the most recent rm, rmall, or taskboard delete is kept. Restored tasks get fresh IDs."]
    });
    app.command("snooze", "Push a task's due date forward.", async ({ args, store, stdout }) => {
      if (args.length < 2)
        throw new UserInputError("Usage: todo snooze <id> <1h|30m|tomorrow|monday|next week|16/08/2026>");
      const id = args[0];
      if (id === undefined)
        throw new UserInputError("Missing task ID");
      const dueDate = tryParseDueDate(args.slice(1).join(" "));
      if (dueDate === undefined)
        throw new UserInputError("Invalid snooze time");
      const tasks = await store.loadTasks();
      const task = tasks.find((item) => item.id === id);
      if (task === undefined)
        throw new UserInputError(`Task not found: ${id}`);
      task.dueDate = dueDate;
      task.updatedAt = Date.now();
      if (task.reminder !== undefined)
        task.reminder.dueAt = dueDate;
      resetNotificationState(task);
      await store.saveTasks(tasks);
      stdout.write(`${GREEN3}Snoozed #${task.id}${RESET6}
`);
    }, {
      group: "Change",
      positional: "task-id",
      usage: ["todo snooze <id> <time>"],
      details: ["Sets a new due date and resets reminder notifications for the task."],
      examples: [
        { command: "todo snooze 4 1h" },
        { command: "todo snooze 4 tomorrow" },
        { command: "todo snooze 4 next week" },
        { command: "todo snooze 4 16/08/2026" }
      ]
    });
  }
};
function restoreTasks(tasks, deletedTasks) {
  let nextId = getNextId2(tasks);
  const existingIds = new Set(tasks.map((task) => task.id));
  const idMap = new Map(deletedTasks.map((task) => [task.id, `${nextId++}`]));
  const now = Date.now();
  return deletedTasks.map((task) => {
    const restored = { ...task, id: idMap.get(task.id) ?? task.id, updatedAt: now };
    const parentId = task.parentId === undefined ? undefined : idMap.get(task.parentId) ?? (existingIds.has(task.parentId) ? task.parentId : undefined);
    if (parentId === undefined)
      delete restored.parentId;
    else
      restored.parentId = parentId;
    return restored;
  });
}
function getNextId2(tasks) {
  const ids = tasks.map((task) => Number.parseInt(task.id, 10)).filter(Number.isFinite);
  return (ids.length === 0 ? 0 : Math.max(...ids)) + 1;
}

// src/plugins/interactive.ts
var DIM6 = "\x1B[2m";
var RESET7 = "\x1B[0m";
var BRIGHT = "\x1B[1m";
var MAUVE = "\x1B[38;5;147m";
var GREEN4 = "\x1B[38;5;166m";
var RED2 = "\x1B[38;5;203m";
var BLUE = "\x1B[38;5;116m";
var SELECTED = "\x1B[48;5;60m";
var PANEL_WIDTH = 72;
var VISIBLE_TASK_COUNT = 8;
var ADD_MODES = new Set(["adding", "adding-subtask", "adding-epic"]);
var WORKSPACES = [
  { key: "all", label: "all tasks" },
  { key: "today", label: "today" },
  { key: "overdue", label: "overdue" },
  { key: "high", label: "high priority" },
  { key: "archive", label: "archive" }
];
var interactivePlugin = {
  name: "interactive",
  description: "Open the keyboard-controlled taskboard.",
  register(app) {
    app.command("interactive", "Open the keyboard-driven taskboard.", async ({ store }) => {
      const taskboard = new Taskboard(store);
      await taskboard.start();
    }, {
      group: "View",
      aliases: ["i", "-i", "--interactive"],
      usage: ["todo interactive", "todo i", "todo -i", "todo --interactive", "todo"],
      details: ["Opens automatically when todo runs with no arguments in a terminal. Press ? inside for the key map."]
    });
  }
};

class Taskboard {
  store;
  tasks = [];
  rows = [];
  sourceTasks = [];
  allTasks = [];
  collapsedIds = new Set;
  selectedIndex = 0;
  scrollOffset = 0;
  mode = "normal";
  view = "pending";
  focus = "tasks";
  workspaceIndex = 0;
  draft = "";
  searchQuery = "";
  selectedTaskIds = new Set;
  message = "";
  resolveClose;
  wasRaw = false;
  constructor(store) {
    this.store = store;
  }
  async start() {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      await this.refresh();
      process.stdout.write(this.render());
      return;
    }
    await this.refresh();
    this.wasRaw = process.stdin.isRaw;
    emitKeypressEvents2(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("keypress", this.handleKeypress);
    process.stdout.write("\x1B[?25l");
    this.draw();
    await new Promise((resolve2) => {
      this.resolveClose = resolve2;
    });
  }
  handleKeypress = (_, key) => {
    this.processKeypress(key).catch((error) => {
      this.message = error instanceof Error ? error.message : String(error);
      this.mode = "normal";
      this.draw();
    });
  };
  async processKeypress(key) {
    if (key.ctrl && key.name === "c") {
      this.close();
      return;
    }
    if (ADD_MODES.has(this.mode) || this.mode === "editing" || this.mode === "snoozing" || this.mode === "setting-due") {
      await this.processAddKeypress(key);
      return;
    }
    if (this.mode === "searching") {
      this.processSearchKeypress(key);
      return;
    }
    if (this.mode === "confirming-delete") {
      await this.processDeleteKeypress(key);
      return;
    }
    if (this.mode === "help") {
      if (key.name === "escape" || key.name === "return" || key.sequence === "?" || key.name === "q") {
        this.mode = "normal";
        this.draw();
      }
      return;
    }
    if (key.name === "tab") {
      this.focus = this.focus === "workspaces" ? "tasks" : "workspaces";
      this.draw();
      return;
    }
    if (this.focus === "workspaces") {
      if (key.name === "up" || key.sequence === "k")
        await this.moveWorkspace(-1);
      else if (key.name === "down" || key.sequence === "j")
        await this.moveWorkspace(1);
      else if (key.name === "return" || key.name === "space")
        this.focus = "tasks";
      else if (key.sequence === "q" || key.name === "escape")
        this.close();
      this.draw();
      return;
    }
    if (key.name === "up" || key.sequence === "k") {
      this.moveSelection(-1);
    } else if (key.name === "down" || key.sequence === "j") {
      this.moveSelection(1);
    } else if (key.name === "return" || key.name === "space") {
      await this.completeSelectedTask();
    } else if (key.sequence === "a") {
      this.startAdding("adding");
    } else if (key.sequence === "A") {
      if (this.selectedTask !== undefined && this.view === "pending")
        this.startAdding("adding-subtask");
    } else if (key.sequence === "E") {
      this.startAdding("adding-epic");
    } else if (key.name === "left" || key.sequence === "h") {
      this.collapseOrAscend();
    } else if (key.name === "right" || key.sequence === "l") {
      this.expandOrDescend();
    } else if (key.sequence === ">") {
      await this.indentSelectedTask();
    } else if (key.sequence === "<") {
      await this.outdentSelectedTask();
    } else if (key.sequence === "d") {
      if (this.selectedTask !== undefined)
        this.mode = "confirming-delete";
    } else if (key.sequence === "e") {
      this.editSelectedTask();
    } else if (key.sequence === "s") {
      this.snoozeSelectedTask();
    } else if (key.sequence === "u" || key.ctrl === true && key.name === "z") {
      await this.undoDelete();
    } else if (key.sequence === "p") {
      await this.cyclePriority();
    } else if (key.sequence === "t") {
      this.setDueDate();
    } else if (key.sequence === "x") {
      this.toggleTaskSelection();
    } else if (key.sequence === "c") {
      await this.completeSelectedTasks();
    } else if (key.sequence === "/") {
      this.mode = "searching";
      this.searchQuery = "";
      this.message = "";
    } else if (key.sequence === "v") {
      await this.toggleView();
    } else if (key.sequence === "r") {
      await this.refresh();
      this.message = "Refreshed";
    } else if (key.sequence === "?") {
      this.mode = "help";
    } else if (key.sequence === "q" || key.name === "escape") {
      this.close();
      return;
    }
    this.draw();
  }
  async processAddKeypress(key) {
    if (key.name === "escape") {
      this.mode = "normal";
      this.draft = "";
    } else if (key.name === "backspace") {
      this.draft = this.draft.slice(0, -1);
    } else if (key.name === "return") {
      if (ADD_MODES.has(this.mode))
        await this.addDraft();
      else if (this.mode === "editing")
        await this.saveEditedTask();
      else if (this.mode === "snoozing")
        await this.saveSnoozedTask();
      else
        await this.saveDueDate();
    } else if (key.sequence !== undefined && key.sequence >= " ") {
      this.draft += key.sequence;
    }
    this.draw();
  }
  processSearchKeypress(key) {
    if (key.name === "escape") {
      this.mode = "normal";
      this.searchQuery = "";
      this.applySearch();
    } else if (key.name === "backspace") {
      this.searchQuery = this.searchQuery.slice(0, -1);
      this.applySearch();
    } else if (key.name === "return") {
      this.mode = "normal";
    } else if (key.sequence !== undefined && key.sequence >= " ") {
      this.searchQuery += key.sequence;
      this.applySearch();
    }
    this.draw();
  }
  startAdding(mode) {
    this.mode = mode;
    this.draft = "";
    this.message = "";
  }
  collapseOrAscend() {
    const row2 = this.selectedRow;
    if (row2 === undefined)
      return;
    if (row2.hasChildren && !row2.collapsed) {
      this.collapsedIds.add(row2.task.id);
      this.rebuildRows(row2.task.id);
      return;
    }
    const parentIndex = this.rows.findIndex((candidate) => candidate.task.id === row2.task.parentId);
    if (parentIndex !== -1) {
      this.selectedIndex = parentIndex;
      this.ensureSelectedTaskIsVisible();
    }
  }
  expandOrDescend() {
    const row2 = this.selectedRow;
    if (row2 === undefined || !row2.hasChildren)
      return;
    if (row2.collapsed) {
      this.collapsedIds.delete(row2.task.id);
      this.rebuildRows(row2.task.id);
      return;
    }
    this.moveSelection(1);
  }
  async indentSelectedTask() {
    const row2 = this.selectedRow;
    if (row2 === undefined || this.view === "archive")
      return;
    let target;
    for (let index = this.selectedIndex - 1;index >= 0; index -= 1) {
      const candidate = this.rows[index];
      if (candidate === undefined || candidate.depth < row2.depth)
        break;
      if (candidate.depth === row2.depth) {
        target = candidate.task;
        break;
      }
    }
    if (target === undefined) {
      this.message = "No task above to nest under";
      return;
    }
    await this.reparent(row2.task.id, target.id);
  }
  async outdentSelectedTask() {
    const row2 = this.selectedRow;
    if (row2 === undefined || this.view === "archive")
      return;
    if (row2.task.parentId === undefined) {
      this.message = "Already at the top level";
      return;
    }
    const parent = this.allTasks.find((candidate) => candidate.id === row2.task.parentId);
    await this.reparent(row2.task.id, parent?.parentId);
  }
  async reparent(id, parentId) {
    const tasks = await this.store.loadTasks();
    moveTask(tasks, id, parentId);
    await this.store.saveTasks(tasks);
    if (parentId !== undefined)
      this.collapsedIds.delete(parentId);
    this.message = parentId === undefined ? `Moved #${id} to the top level` : `Moved #${id} under #${parentId}`;
    await this.refresh(id);
  }
  editSelectedTask() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined)
      return;
    this.mode = "editing";
    this.draft = selectedTask.description;
    this.message = "";
  }
  async saveEditedTask() {
    const description = this.draft.trim();
    const selectedTask = this.selectedTask;
    if (description.length === 0) {
      this.message = "Enter a task description";
      return;
    }
    if (selectedTask === undefined)
      return;
    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined)
      return;
    task.description = description;
    task.updatedAt = Date.now();
    await this.store.saveTasks(tasks);
    this.mode = "normal";
    this.draft = "";
    this.message = `Updated #${task.id}`;
    await this.refresh(task.id);
  }
  snoozeSelectedTask() {
    if (this.selectedTask === undefined || this.view === "archive")
      return;
    this.mode = "snoozing";
    this.draft = "";
    this.message = "";
  }
  async saveSnoozedTask() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined)
      return;
    const dueDate = tryParseDueDate(this.draft);
    if (dueDate === undefined) {
      this.message = "Use 30m, 1h, tomorrow, monday, next week, or 16/08/2026";
      return;
    }
    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined)
      return;
    if (dueDate === undefined)
      delete task.dueDate;
    else
      task.dueDate = dueDate;
    task.updatedAt = Date.now();
    resetNotificationState(task);
    await this.store.saveTasks(tasks);
    this.mode = "normal";
    this.draft = "";
    this.message = `Snoozed #${task.id}`;
    await this.refresh(task.id);
  }
  setDueDate() {
    if (this.selectedTask === undefined || this.view === "archive")
      return;
    this.mode = "setting-due";
    this.draft = "";
    this.message = "";
  }
  async saveDueDate() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined)
      return;
    const value = this.draft.trim().toLowerCase();
    const dueDate = value === "0" || value === "none" ? undefined : tryParseDueDate(value);
    if (value.length === 0 || dueDate === undefined && value !== "0" && value !== "none") {
      this.message = "Use 30m, 1h, tomorrow, 16/08/2026, two weeks ago, or none";
      return;
    }
    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined)
      return;
    if (dueDate === undefined)
      delete task.dueDate;
    else
      task.dueDate = dueDate;
    task.updatedAt = Date.now();
    resetNotificationState(task);
    await this.store.saveTasks(tasks);
    this.mode = "normal";
    this.draft = "";
    this.message = dueDate === undefined ? `Cleared due date for #${task.id}` : `Updated due date for #${task.id}`;
    await this.refresh(task.id);
  }
  async cyclePriority() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined || this.view === "archive")
      return;
    const priorities = ["none", "low", "medium", "high"];
    const priority = priorities[(priorities.indexOf(selectedTask.priority) + 1) % priorities.length];
    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined || priority === undefined)
      return;
    task.priority = priority;
    task.updatedAt = Date.now();
    await this.store.saveTasks(tasks);
    this.message = `Priority #${task.id}: ${priority}`;
    await this.refresh(task.id);
  }
  toggleTaskSelection() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined || this.view === "archive")
      return;
    if (this.selectedTaskIds.has(selectedTask.id))
      this.selectedTaskIds.delete(selectedTask.id);
    else
      this.selectedTaskIds.add(selectedTask.id);
    this.message = `${this.selectedTaskIds.size} selected`;
  }
  async completeSelectedTasks() {
    if (this.view === "archive")
      return;
    const selectedTask = this.selectedTask;
    const ids = this.selectedTaskIds.size > 0 ? this.selectedTaskIds : new Set(selectedTask === undefined ? [] : [selectedTask.id]);
    if (ids.size === 0)
      return;
    const tasks = await this.store.loadTasks();
    const completed = completeSubtrees(tasks, ids);
    await this.store.saveTasks(tasks);
    this.selectedTaskIds.clear();
    this.message = `Completed ${completed} task${completed === 1 ? "" : "s"}`;
    await this.refresh();
  }
  async undoDelete() {
    const undo = await this.store.loadUndo();
    if (undo === undefined || undo.tasks.length === 0) {
      this.message = "Nothing to undo";
      return;
    }
    const tasks = await this.store.loadTasks();
    const restoredTasks = restoreTasks(tasks, undo.tasks);
    await this.store.saveTasks([...tasks, ...restoredTasks]);
    await this.store.clearUndo();
    this.message = `Restored ${restoredTasks.length} task${restoredTasks.length === 1 ? "" : "s"}`;
    await this.refresh(restoredTasks[0]?.id);
  }
  async processDeleteKeypress(key) {
    if (key.sequence?.toLowerCase() === "y") {
      await this.deleteSelectedTask();
    } else if (key.sequence?.toLowerCase() === "n" || key.name === "escape") {
      this.mode = "normal";
      this.message = "Delete cancelled";
    }
    this.draw();
  }
  async addDraft() {
    const input = this.draft.trim();
    if (input.length === 0) {
      this.message = "Enter a task description";
      return;
    }
    try {
      const defaults = this.addDefaults();
      const addedTasks = await createTasks(this.store, input.split(/\s+/), defaults);
      this.mode = "normal";
      this.draft = "";
      if (defaults.parentId !== undefined)
        this.collapsedIds.delete(defaults.parentId);
      const noun = defaults.kind === "epic" ? "epic" : defaults.parentId === undefined ? "task" : "subtask";
      this.message = `Added ${addedTasks.length} ${noun}${addedTasks.length === 1 ? "" : "s"}`;
      await this.refresh(addedTasks[0]?.id);
    } catch (error) {
      this.message = error instanceof UserInputError ? error.message : "Could not add task";
    }
  }
  addDefaults() {
    if (this.mode === "adding-epic")
      return { kind: "epic" };
    if (this.mode === "adding-subtask" && this.selectedTask !== undefined)
      return { parentId: this.selectedTask.id };
    return {};
  }
  async completeSelectedTask() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined)
      return;
    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined)
      return;
    if (this.view === "archive") {
      task.status = "pending";
      task.updatedAt = Date.now();
      this.message = `Restored #${task.id}`;
    } else {
      const completed = completeSubtrees(tasks, [task.id]);
      this.message = completed > 1 ? `Completed #${task.id} and ${completed - 1} subtask${completed === 2 ? "" : "s"}` : `Completed #${task.id}`;
    }
    await this.store.saveTasks(tasks);
    await this.refresh();
  }
  async deleteSelectedTask() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined)
      return;
    const tasks = await this.store.loadTasks();
    const subtreeIds = collectSubtreeIds(tasks, [selectedTask.id]);
    await this.store.saveUndo(tasks.filter((task) => subtreeIds.has(task.id)));
    await this.store.saveTasks(tasks.filter((task) => !subtreeIds.has(task.id)));
    this.mode = "normal";
    const subtaskText = subtreeIds.size > 1 ? ` and ${subtreeIds.size - 1} subtask${subtreeIds.size === 2 ? "" : "s"}` : "";
    this.message = `Deleted #${selectedTask.id}${subtaskText} \xB7 u/Ctrl+Z to undo (5s)`;
    await this.refresh();
  }
  subtaskCountOf(id) {
    return collectDescendantIds(this.allTasks, [id]).size;
  }
  async refresh(selectedId) {
    this.allTasks = await this.store.loadTasks();
    this.sourceTasks = filterWorkspaceTasks(this.allTasks, this.workspace.key);
    this.applySearch();
    if (selectedId !== undefined)
      this.selectRow(selectedId);
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.rows.length - 1));
    this.scrollOffset = Math.min(this.scrollOffset, Math.max(0, this.rows.length - VISIBLE_TASK_COUNT));
    this.ensureSelectedTaskIsVisible();
  }
  applySearch() {
    const query = this.searchQuery.trim().toLowerCase();
    this.tasks = query.length === 0 ? [...this.sourceTasks] : this.sourceTasks.filter((task) => task.description.toLowerCase().includes(query));
    this.rebuildRows();
  }
  rebuildRows(selectedId) {
    this.rows = buildTaskTreeRows(this.tasks, this.allTasks, { compare: compareTasks, collapsedIds: this.collapsedIds });
    if (selectedId !== undefined)
      this.selectRow(selectedId);
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.rows.length - 1));
    this.ensureSelectedTaskIsVisible();
  }
  selectRow(id) {
    const matchingIndex = this.rows.findIndex((row2) => row2.task.id === id);
    if (matchingIndex !== -1)
      this.selectedIndex = matchingIndex;
  }
  async toggleView() {
    const wasArchive = this.workspace.key === "archive";
    this.workspaceIndex = wasArchive ? 0 : WORKSPACES.findIndex((workspace) => workspace.key === "archive");
    this.view = wasArchive ? "pending" : "archive";
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.message = this.view === "archive" ? "Archive" : "Open tasks";
    await this.refresh();
  }
  moveSelection(offset) {
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex + offset, this.rows.length - 1));
    this.ensureSelectedTaskIsVisible();
  }
  async moveWorkspace(offset) {
    const workspace = WORKSPACES.length;
    this.workspaceIndex = (this.workspaceIndex + offset + workspace) % workspace;
    this.view = this.workspace.key === "archive" ? "archive" : "pending";
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.selectedTaskIds.clear();
    await this.refresh();
  }
  get workspace() {
    return WORKSPACES[this.workspaceIndex] ?? WORKSPACES[0];
  }
  ensureSelectedTaskIsVisible() {
    if (this.selectedIndex < this.scrollOffset)
      this.scrollOffset = this.selectedIndex;
    if (this.selectedIndex >= this.scrollOffset + VISIBLE_TASK_COUNT) {
      this.scrollOffset = this.selectedIndex - VISIBLE_TASK_COUNT + 1;
    }
  }
  get selectedRow() {
    return this.rows[this.selectedIndex];
  }
  get selectedTask() {
    return this.selectedRow?.task;
  }
  draw() {
    process.stdout.write(`\x1B[2J\x1B[H${this.render()}`);
  }
  render() {
    if ((process.stdout.columns ?? 0) >= 100)
      return this.renderWorkspaceLayout();
    const lines = this.mode === "help" ? this.helpLines() : this.taskLines();
    const output = [formatPanelBorder("\u256D", "\u256E")];
    const status = this.view === "pending" ? `${this.tasks.length} open` : `${this.tasks.length} done`;
    const dueTodayCount = this.tasks.filter((task) => task.dueDate !== undefined && isToday(task.dueDate)).length;
    const dueToday = this.view === "pending" && dueTodayCount > 0 ? `${DIM6} \xB7 ${dueTodayCount} due today${RESET7}` : "";
    const title = this.view === "archive" ? `${BRIGHT}${MAUVE}todo${RESET7} ${DIM6}\xB7 archive${RESET7}` : `${BRIGHT}${MAUVE}todo${RESET7}`;
    output.push(formatPanelLine(title, `${GREEN4}\u25CF ${status}${RESET7}${dueToday}`));
    output.push(formatPanelBorder("\u251C", "\u2524"));
    for (const line of lines)
      output.push(formatPanelLine(line));
    output.push(formatPanelBorder("\u251C", "\u2524"));
    output.push(formatPanelLine(this.footerLeft, this.footerRight));
    output.push(formatPanelBorder("\u2570", "\u256F"));
    return `${output.join(`
`)}
`;
  }
  renderWorkspaceLayout() {
    const width = Math.min(Math.max(process.stdout.columns ?? 110, 100), 140);
    const sidebarWidth = 22;
    const taskWidth = width - sidebarWidth - 7;
    const bodyHeight = Math.max(12, Math.min((process.stdout.rows ?? 24) - 6, 22));
    const workspaceLines = this.workspaceLines(sidebarWidth);
    const taskLines = this.workspaceTaskLines(taskWidth);
    const output = [formatSplitBorder("\u256D", "\u252C", "\u256E", sidebarWidth, taskWidth, "Workspaces", this.view === "archive" ? "Archive" : "Todos")];
    for (let index = 0;index < bodyHeight; index += 1) {
      const left = workspaceLines[index] ?? "";
      const right = taskLines[index] ?? "";
      output.push(formatSplitLine(left, right, sidebarWidth, taskWidth));
    }
    output.push(formatSplitBorder("\u251C", "\u2534", "\u2524", sidebarWidth, taskWidth));
    output.push(formatStatusLine(this.footerLeft, this.footerRight, width - 2));
    output.push(`${DIM6}\u2570${"\u2500".repeat(width - 2)}\u256F${RESET7}`);
    return `${output.join(`
`)}
`;
  }
  workspaceLines(width) {
    return WORKSPACES.map((workspace, index) => {
      const count = filterWorkspaceTasks(this.allTasks, workspace.key).length;
      const selected = this.focus === "workspaces" && index === this.workspaceIndex;
      const marker = index === this.workspaceIndex ? `${GREEN4}\u203A${RESET7}` : " ";
      const content = `${marker} ${workspace.label} ${DIM6}(${count})${RESET7}`;
      return selected ? `${SELECTED}${fit(content, width)}${RESET7}` : content;
    });
  }
  workspaceTaskLines(width) {
    if (this.mode === "help")
      return this.helpLines();
    if (ADD_MODES.has(this.mode))
      return this.addPromptLines();
    if (this.mode === "editing")
      return [`${GREEN4}edit #${this.selectedTask?.id ?? ""}${RESET7}`, `${DIM6}>${RESET7} ${this.draft}${BRIGHT}\u258F${RESET7}`, `${DIM6}Enter to save \xB7 Esc to cancel${RESET7}`];
    if (this.mode === "snoozing")
      return [`${GREEN4}snooze #${this.selectedTask?.id ?? ""}${RESET7}`, `${DIM6}>${RESET7} ${this.draft}${BRIGHT}\u258F${RESET7}`, `${DIM6}30m \xB7 1h \xB7 tomorrow \xB7 monday \xB7 next week${RESET7}`];
    if (this.mode === "setting-due")
      return [`${GREEN4}due date #${this.selectedTask?.id ?? ""}${RESET7}`, `${DIM6}>${RESET7} ${this.draft}${BRIGHT}\u258F${RESET7}`, `${DIM6}30m \xB7 1h \xB7 tomorrow \xB7 monday \xB7 next week \xB7 none${RESET7}`];
    if (this.mode === "searching")
      return [`${GREEN4}search${RESET7}`, `${DIM6}/${RESET7} ${this.searchQuery}${BRIGHT}\u258F${RESET7}`, `${DIM6}Enter to keep filter \xB7 Esc to clear${RESET7}`];
    if (this.mode === "confirming-delete")
      return this.deletePromptLines();
    if (this.rows.length === 0)
      return [`${GREEN4}\u2713 All caught up${RESET7}`, `${DIM6}Press a to add a task \xB7 E for an epic${RESET7}`];
    const header = `${DIM6}PRI  ID    TITLE${" ".repeat(Math.max(1, width - 53))}CREATED       UPDATED       DUE${RESET7}`;
    const rows = this.rows.slice(this.scrollOffset, this.scrollOffset + VISIBLE_TASK_COUNT).map((row2, index) => {
      const selected = this.scrollOffset + index === this.selectedIndex;
      const marked = this.selectedTaskIds.has(row2.task.id);
      const marker = selected ? `${GREEN4}\u203A${RESET7}` : marked ? `${GREEN4}\u2713${RESET7}` : `${DIM6}\xB7${RESET7}`;
      const content = `${marker} ${formatWorkspaceTask(row2, width - 2)}`;
      return selected && this.focus === "tasks" ? highlight(fit(content, width)) : content;
    });
    return [header, ...rows];
  }
  taskLines() {
    if (ADD_MODES.has(this.mode))
      return this.addPromptLines();
    if (this.mode === "editing")
      return [`${GREEN4}edit #${this.selectedTask?.id ?? ""}${RESET7}`, `${DIM6}>${RESET7} ${this.draft}${BRIGHT}\u258F${RESET7}`, `${DIM6}Enter to save \xB7 Esc to cancel${RESET7}`];
    if (this.mode === "snoozing")
      return [`${GREEN4}snooze #${this.selectedTask?.id ?? ""}${RESET7}`, `${DIM6}>${RESET7} ${this.draft}${BRIGHT}\u258F${RESET7}`, `${DIM6}30m \xB7 1h \xB7 tomorrow \xB7 monday \xB7 next week${RESET7}`];
    if (this.mode === "setting-due")
      return [`${GREEN4}due date #${this.selectedTask?.id ?? ""}${RESET7}`, `${DIM6}>${RESET7} ${this.draft}${BRIGHT}\u258F${RESET7}`, `${DIM6}30m \xB7 1h \xB7 tomorrow \xB7 monday \xB7 next week \xB7 none${RESET7}`];
    if (this.mode === "searching")
      return [`${GREEN4}search${RESET7}`, `${DIM6}/${RESET7} ${this.searchQuery}${BRIGHT}\u258F${RESET7}`, `${DIM6}Enter to keep filter \xB7 Esc to clear${RESET7}`];
    if (this.mode === "confirming-delete")
      return this.deletePromptLines();
    if (this.rows.length === 0) {
      const emptyAction = this.view === "pending" ? "Press a to add a task \xB7 E for an epic" : "Press v to return to open tasks";
      return [`${GREEN4}\u2713 All caught up${RESET7}`, `${DIM6}${emptyAction}${RESET7}`];
    }
    const header = formatCompactHeader(PANEL_WIDTH - 3);
    const visibleRows = this.rows.slice(this.scrollOffset, this.scrollOffset + VISIBLE_TASK_COUNT);
    const rows = visibleRows.map((row2, index) => {
      const selected = this.scrollOffset + index === this.selectedIndex;
      const marked = this.selectedTaskIds.has(row2.task.id);
      const marker = selected ? `${GREEN4}\u203A${RESET7}` : marked ? `${GREEN4}\u2713${RESET7}` : `${DIM6}\xB7${RESET7}`;
      const content = `${marker} ${formatCompactTask(row2, PANEL_WIDTH - 3)}`;
      return selected ? highlight(fit(content, PANEL_WIDTH - 1)) : content;
    });
    return [header, ...rows];
  }
  addPromptLines() {
    const title = this.mode === "adding-epic" ? "new epic" : this.mode === "adding-subtask" ? `new subtask under #${this.selectedTask?.id ?? ""}` : "new task";
    return [`${GREEN4}${title}${RESET7}`, `${DIM6}>${RESET7} ${this.draft}${BRIGHT}\u258F${RESET7}`, `${DIM6}Enter to save \xB7 comma separates several \xB7 Esc to cancel${RESET7}`];
  }
  deletePromptLines() {
    const id = this.selectedTask?.id ?? "";
    const subtaskCount = id.length > 0 ? this.subtaskCountOf(id) : 0;
    const subtaskText = subtaskCount > 0 ? ` and ${subtaskCount} subtask${subtaskCount === 1 ? "" : "s"}` : "";
    return [`${RED2}Delete #${id}${subtaskText}?${RESET7}`, `${DIM6}Press y to delete \xB7 n or Esc to cancel${RESET7}`];
  }
  helpLines() {
    return [
      `${GREEN4}\u2191/k  \u2193/j${RESET7}  move selection`,
      `${GREEN4}\u2190/h  \u2192/l${RESET7}  collapse or expand \xB7 jump to parent/child`,
      `${GREEN4}Enter${RESET7}  complete selected task (and its subtasks)`,
      `${GREEN4}a${RESET7}  add task    ${GREEN4}A${RESET7}  add subtask under selected    ${GREEN4}E${RESET7}  add epic`,
      `${GREEN4}>${RESET7}  nest under the task above    ${GREEN4}<${RESET7}  move up one level`,
      `${GREEN4}e${RESET7}  edit selected task`,
      `${GREEN4}d${RESET7}  delete selected task and its subtasks`,
      `${GREEN4}u / Ctrl+Z${RESET7}  undo last deletion (within 5s)`,
      `${GREEN4}s${RESET7}  snooze selected task`,
      `${GREEN4}p${RESET7}  cycle priority`,
      `${GREEN4}t${RESET7}  set or clear due date`,
      `${GREEN4}x${RESET7}  mark task for batch completion`,
      `${GREEN4}c${RESET7}  complete marked task(s)`,
      `${GREEN4}/${RESET7}  search current view`,
      `${GREEN4}v${RESET7}  toggle completed archive`,
      `${GREEN4}Enter${RESET7}  restore selected task in archive`,
      `${GREEN4}r${RESET7}  refresh`,
      `${GREEN4}q${RESET7}  quit`,
      `${DIM6}Press Esc, Enter, ? or q to return${RESET7}`
    ];
  }
  get footerLeft() {
    if (this.mode === "help")
      return `${DIM6}?${RESET7} help`;
    const action = this.view === "pending" ? "complete" : "restore";
    const position = this.tasks.length > 0 ? `${this.selectedIndex + 1}/${this.tasks.length} \xB7 ` : "";
    return this.message.length > 0 ? `${GREEN4}${this.message}${RESET7}` : `${DIM6}${position}\u2191\u2193${RESET7} navigate \xB7 ${DIM6}Enter${RESET7} ${action}`;
  }
  get footerRight() {
    if (this.mode === "help")
      return `${DIM6}q${RESET7} close`;
    return `${DIM6}A${RESET7} sub \xB7 ${DIM6}E${RESET7} epic \xB7 ${DIM6}?${RESET7} help \xB7 ${DIM6}q${RESET7} quit`;
  }
  close() {
    process.stdin.off("keypress", this.handleKeypress);
    if (!this.wasRaw)
      process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write(`\x1B[?25h
`);
    this.resolveClose?.();
  }
}
function compareTasks(left, right) {
  if (left.dueDate !== undefined && right.dueDate !== undefined)
    return left.dueDate - right.dueDate;
  if (left.dueDate !== undefined)
    return -1;
  if (right.dueDate !== undefined)
    return 1;
  return left.createdAt - right.createdAt;
}
function formatPanelLine(left, right = "") {
  const padding = " ".repeat(Math.max(1, PANEL_WIDTH - getVisibleLength(left) - getVisibleLength(right)));
  return `${DIM6}\u2502${RESET7} ${left}${padding}${right} ${DIM6}\u2502${RESET7}`;
}
function formatPanelBorder(left, right) {
  return `${DIM6}${left}${"\u2500".repeat(PANEL_WIDTH + 2)}${right}${RESET7}`;
}
function filterWorkspaceTasks(tasks, workspace) {
  if (workspace === "archive")
    return tasks.filter((task) => task.status === "completed");
  const pendingTasks = tasks.filter((task) => task.status === "pending");
  if (workspace === "today")
    return pendingTasks.filter((task) => task.dueDate !== undefined && isToday(task.dueDate));
  if (workspace === "overdue")
    return pendingTasks.filter((task) => task.dueDate !== undefined && isOverdue(task.dueDate));
  if (workspace === "high")
    return pendingTasks.filter((task) => task.priority === "high");
  return pendingTasks;
}
function isToday(timestamp) {
  const now = new Date;
  const date = new Date(timestamp);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}
function formatTreeLabel(row2, width) {
  const prefix = formatTreePrefix(row2);
  const toggle = row2.hasChildren ? row2.collapsed ? `${MAUVE}\u25B8${RESET7} ` : `${DIM6}\u25BE${RESET7} ` : "";
  const badge = formatProgressBadge(row2);
  const descriptionWidth = Math.max(8, width - getVisibleLength(prefix) - getVisibleLength(toggle) - getVisibleLength(badge));
  const description = truncateTaskDescription(row2.task.description, descriptionWidth);
  const emphasized = row2.hasChildren || row2.task.kind === "epic" ? `${BRIGHT}${description}${RESET7}` : description;
  return `${prefix}${toggle}${emphasized}${badge}`;
}
function formatWorkspaceTask(row2, width) {
  const task = row2.task;
  const priority = task.priority === "high" ? `${RED2}high${RESET7}` : task.priority === "medium" ? `${MAUVE}med${RESET7}` : task.priority === "low" ? `${BLUE}low${RESET7}` : `${DIM6}\u2014${RESET7}`;
  const id = `${DIM6}#${task.id.padStart(2, "0")}${RESET7}`;
  const createdAt = formatTaskDate(task.createdAt);
  const updatedAt = formatTaskDate(task.updatedAt);
  const due = formatDueLabel(task);
  const metadataWidth = getVisibleLength(priority) + getVisibleLength(id) + getVisibleLength(createdAt) + getVisibleLength(updatedAt) + getVisibleLength(due) + 12;
  const descriptionWidth = Math.max(12, width - metadataWidth);
  const description = formatTreeLabel(row2, descriptionWidth);
  const content = `${fit(priority, 4)} ${id}  ${description}`;
  const padding = " ".repeat(Math.max(1, width - getVisibleLength(content) - getVisibleLength(createdAt) - getVisibleLength(updatedAt) - getVisibleLength(due) - 6));
  return `${content}${padding}${createdAt}  ${updatedAt}  ${due}`;
}
function formatCompactTask(row2, width) {
  const task = row2.task;
  const id = `${DIM6}#${task.id.padStart(2, "0")}${RESET7}`;
  const updatedAt = `${DIM6}${formatRelativeTime(task.updatedAt)}${RESET7}`;
  const due = formatDueLabel(task);
  const fixedWidth = 4 + 2 + 9 + 2 + 12;
  const description = formatTreeLabel(row2, Math.max(12, width - fixedWidth));
  return `${fit(id, 4)}  ${fit(description, Math.max(12, width - fixedWidth))}  ${fit(updatedAt, 9)}  ${fit(due, 12)}`;
}
function formatCompactHeader(width) {
  const fixedWidth = 4 + 2 + 9 + 2 + 12;
  const descriptionWidth = Math.max(12, width - fixedWidth);
  return `${DIM6}  ${fit("ID", 4)}  ${fit("TASK", descriptionWidth)}  ${fit("UPDATED", 9)}  ${fit("DUE", 12)}${RESET7}`;
}
function formatDueLabel(task) {
  if (task.dueDate === undefined)
    return `${DIM6}\u2014${RESET7}`;
  if (isOverdue(task.dueDate))
    return `${RED2}overdue${RESET7}`;
  if (isUpcoming(task.dueDate))
    return `${MAUVE}soon${RESET7}`;
  const date = new Date(task.dueDate);
  const label2 = isToday(task.dueDate) ? `today ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}` : formatTaskDate(task.dueDate);
  return `${DIM6}${label2}${RESET7}`;
}
function formatTaskDate(timestamp) {
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleString(undefined, { month: "short" });
  const time = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  return `${DIM6}${day} ${month} ${time}${RESET7}`;
}
function formatRelativeTime(timestamp, now = Date.now()) {
  const elapsedMinutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (elapsedMinutes < 1)
    return "now";
  if (elapsedMinutes < 60)
    return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24)
    return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays < 7 ? `${elapsedDays}d ago` : formatTaskDate(timestamp);
}
function truncateTaskDescription(value, width) {
  return value.length > width ? `${value.slice(0, Math.max(1, width - 3))}...` : value;
}
function fit(value, width) {
  return `${value}${" ".repeat(Math.max(0, width - getVisibleLength(value)))}`;
}
function highlight(value) {
  return `${SELECTED}${value.replaceAll(RESET7, `${RESET7}${SELECTED}`)}${RESET7}`;
}
function formatSplitLine(left, right, leftWidth, rightWidth) {
  return `${DIM6}\u2502${RESET7} ${fit(left, leftWidth)} ${DIM6}\u2502${RESET7} ${fit(right, rightWidth)} ${DIM6}\u2502${RESET7}`;
}
function formatSplitBorder(left, middle, right, leftWidth, rightWidth, leftTitle, rightTitle) {
  const leftSegment = formatBorderSegment(leftWidth + 2, leftTitle);
  const rightSegment = formatBorderSegment(rightWidth + 2, rightTitle);
  return `${DIM6}${left}${leftSegment}${middle}${rightSegment}${right}${RESET7}`;
}
function formatBorderSegment(width, title) {
  if (title === undefined)
    return "\u2500".repeat(width);
  return `\u2500 ${title} ${"\u2500".repeat(Math.max(0, width - title.length - 3))}`;
}
function formatStatusLine(left, right, width) {
  const status = `${BRIGHT}${MAUVE}\u25CF NORMAL${RESET7}`;
  const date = `${DIM6}${new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short" }).format()}${RESET7}`;
  const content = `${status}  ${left}`;
  const padding = " ".repeat(Math.max(1, width - getVisibleLength(content) - getVisibleLength(right) - getVisibleLength(date)));
  return `${DIM6}\u2502${RESET7} ${content}${padding}${right}  ${date} ${DIM6}\u2502${RESET7}`;
}

// src/plugins/lifecycle.ts
var DIM7 = "\x1B[2m";
var GREEN5 = "\x1B[32m";
var RESET8 = "\x1B[0m";
var lifecyclePlugin = {
  name: "lifecycle",
  description: "Completes, edits, and archives tasks.",
  register(app) {
    app.command("done", "Complete a task and everything under it.", async ({ args, store, stdout }) => {
      const id = requireTaskId(args, "Usage: todo done <id>").replace(/^#/, "");
      const tasks = await store.loadTasks();
      const task = tasks.find((candidate) => candidate.id === id);
      if (task === undefined)
        throw new UserInputError(`Task not found: ${id}`);
      const descendantIds = collectDescendantIds(tasks, [id]);
      const pendingSubtaskCount = tasks.filter((candidate) => descendantIds.has(candidate.id) && candidate.status === "pending").length;
      if (task.status === "completed" && pendingSubtaskCount === 0) {
        stdout.write(`${DIM7}Task already completed${RESET8}
`);
        return;
      }
      completeSubtrees(tasks, [id]);
      await store.saveTasks(tasks);
      const subtaskText = pendingSubtaskCount > 0 ? ` with ${pendingSubtaskCount} subtask(s)` : "";
      stdout.write(`${GREEN5}Task marked as completed${subtaskText}${RESET8}
`);
    }, {
      group: "Change",
      positional: "task-id",
      usage: ["todo done <id>"],
      details: ["Completed tasks leave the list and show up in `todo archive`."],
      examples: [{ command: "todo done 1" }, { command: "todo done #12" }]
    });
    app.command("edit", "Replace a task description.", async ({ args, store, stdout }) => {
      const id = requireFirstArgument(args, "Usage: todo edit <id> <description>");
      const description = args.slice(1).join(" ").trim();
      if (description.length === 0)
        throw new UserInputError("Usage: todo edit <id> <description>");
      const tasks = await store.loadTasks();
      const task = tasks.find((candidate) => candidate.id === id);
      if (task === undefined)
        throw new UserInputError(`Task not found: ${id}`);
      task.description = description;
      task.updatedAt = Date.now();
      await store.saveTasks(tasks);
      stdout.write(`${GREEN5}Updated task ${task.id}${RESET8}
`);
    }, {
      group: "Change",
      positional: "task-id",
      usage: ["todo edit <id> <description>"],
      examples: [{ command: "todo edit 1 buy oat milk" }]
    });
    app.command("hide", "Hide a task or epic from the shell panel and list.", (context) => setHidden(context, true), {
      group: "Change",
      positional: "any",
      usage: ["todo hide <id>", "todo hide <epic or task name>"],
      details: [
        "Only recognised as the first word: `todo fix hide button` still adds a task.",
        "A numeric target is a task ID; anything else must match a pending description exactly.",
        "Hidden tasks stay pending and keep their subtasks; `todo list --all` and `todo unhide` bring them back."
      ],
      examples: [
        { command: "todo hide 33" },
        { command: "todo hide my-epic" },
        { command: 'todo hide "Website redesign"', note: "quote names with spaces" }
      ]
    });
    app.command("unhide", "Show a hidden task or epic again.", (context) => setHidden(context, false), {
      group: "Change",
      positional: "any",
      usage: ["todo unhide <id>", "todo unhide <epic or task name>"],
      examples: [{ command: "todo unhide 33" }, { command: "todo unhide my-epic" }]
    });
    app.command("archive", "List completed tasks, newest first.", async ({ args, store, stdout }) => {
      if (args.length > 0)
        throw new UserInputError("Usage: todo archive");
      const tasks = await store.loadTasks();
      const archivedTasks = tasks.filter((task) => task.status === "completed").sort((left, right) => right.updatedAt - left.updatedAt);
      if (archivedTasks.length === 0) {
        stdout.write(`${DIM7}No archived tasks found${RESET8}
`);
        return;
      }
      for (const task of archivedTasks)
        stdout.write(`${formatTaskForDisplay(task)}
`);
    }, {
      group: "View",
      usage: ["todo archive"]
    });
  }
};
async function setHidden({ args, store, stdout }, hidden) {
  const verb = hidden ? "hide" : "unhide";
  const target = args.join(" ").trim();
  if (target.length === 0)
    throw new UserInputError(`Usage: todo ${verb} <id|name>`);
  const tasks = await store.loadTasks();
  const task = findTaskByIdOrDescription(tasks, target);
  if (task.hidden === true === hidden) {
    stdout.write(`${DIM7}Task #${task.id} is already ${hidden ? "hidden" : "visible"}${RESET8}
`);
    return;
  }
  if (hidden)
    task.hidden = true;
  else
    delete task.hidden;
  task.updatedAt = Date.now();
  await store.saveTasks(tasks);
  stdout.write(`${GREEN5}${hidden ? "Hid" : "Unhid"} #${task.id}: ${task.description}${RESET8}
`);
}
function requireTaskId(args, usage) {
  const id = args[0];
  if (args.length !== 1 || id === undefined || id.trim().length === 0)
    throw new UserInputError(usage);
  return id;
}
function requireFirstArgument(args, usage) {
  const value = args[0];
  if (value === undefined || value.trim().length === 0)
    throw new UserInputError(usage);
  return value;
}

// src/plugins/remove.ts
var DIM8 = "\x1B[2m";
var GREEN6 = "\x1B[32m";
var RESET9 = "\x1B[0m";
var removePlugin = {
  name: "remove",
  description: "Removes tasks.",
  register(app) {
    app.command("rm", "Remove tasks and their subtasks.", removeById, {
      group: "Remove",
      positional: "task-ids",
      aliases: ["delete"],
      usage: ["todo rm <id...>", "todo rm <id[,id|start-end,...]>", "todo rm all"],
      details: ["Removed tasks go to the undo buffer; `todo undo` restores them with fresh IDs."],
      examples: [
        { command: "todo rm 4", note: "one task and everything nested under it" },
        { command: "todo rm 1 2 3 4", note: "several IDs separated by spaces" },
        { command: "todo rm 1,5,9,10-15", note: "IDs and inclusive ranges" },
        { command: "todo rm all", note: "every pending task" }
      ]
    });
    app.command("rmall", "Remove every pending task.", async ({ args, store, stdout }) => {
      if (args.length > 0)
        throw new UserInputError("Usage: todo rmall");
      await removeAllPendingTasks(store, stdout);
    }, {
      group: "Remove",
      usage: ["todo rmall"],
      details: ["Completed tasks stay in the archive. `todo undo` brings the removed tasks back."]
    });
  }
};
async function removeById({ args, store, stdout }) {
  if (args.length === 0) {
    throw new UserInputError("Usage: todo rm <id...> | todo rm <id[,id|start-end,...]> | todo rm all");
  }
  if (args.length === 1 && args[0] === "all") {
    await removeAllPendingTasks(store, stdout);
    return;
  }
  const ids = parseTaskIds(args.join(","));
  const tasks = await store.loadTasks();
  const requestedIds = tasks.filter((task) => ids.has(task.id)).map((task) => task.id);
  if (requestedIds.length === 0) {
    throw new UserInputError(`No tasks found with ID(s): ${[...ids].join(", ")}`);
  }
  const matchingIds = collectSubtreeIds(tasks, requestedIds);
  await store.saveUndo(tasks.filter((task) => matchingIds.has(task.id)));
  await store.saveTasks(tasks.filter((task) => !matchingIds.has(task.id)));
  const subtaskCount = matchingIds.size - requestedIds.length;
  const subtaskText = subtaskCount > 0 ? ` including ${subtaskCount} subtask(s)` : "";
  stdout.write(`${GREEN6}Deleted ${matchingIds.size} task(s)${subtaskText}${RESET9}
`);
}
async function removeAllPendingTasks(store, stdout) {
  const tasks = await store.loadTasks();
  const pendingTasks = tasks.filter((task) => task.status === "pending");
  if (pendingTasks.length === 0) {
    stdout.write(`${DIM8}No tasks to delete${RESET9}
`);
    return;
  }
  await store.saveUndo(pendingTasks);
  await store.saveTasks(tasks.filter((task) => task.status !== "pending"));
  stdout.write(`${GREEN6}Deleted ${pendingTasks.length} task(s)${RESET9}
`);
}
function parseTaskIds(value) {
  const ids = new Set;
  for (const part of value.split(",").map((item) => item.trim().replace(/^#/, ""))) {
    if (part.length === 0)
      throw new UserInputError(`Invalid task ID list: ${value}`);
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > end || end - start > 1e4)
        throw new UserInputError(`Invalid task ID range: ${part}`);
      for (let id = start;id <= end; id += 1)
        ids.add(`${id}`);
      continue;
    }
    if (!/^\d+$/.test(part))
      throw new UserInputError(`Invalid task ID: ${part}`);
    ids.add(part);
  }
  return ids;
}

// src/plugins/tasks.ts
var DIM9 = "\x1B[2m";
var RESET10 = "\x1B[0m";
var GREEN7 = "\x1B[38;5;166m";
var PANEL_WIDTH2 = 72;
var tasksPlugin = {
  name: "tasks",
  description: "Lists tasks.",
  register(app) {
    app.command("shell-display", "Print the compact pending-task panel used at shell startup.", async ({ args, store, stdout }) => {
      const tasks = await store.loadTasks();
      const pendingTasks = excludeHiddenSubtrees(tasks).filter((task) => task.status === "pending");
      if (pendingTasks.length === 0) {
        const completedCount = tasks.filter((task) => task.status === "completed").length;
        const completedText = completedCount > 0 ? `${DIM9} \xB7 ${completedCount} completed${RESET10}` : "";
        stdout.write(formatShellPanel([{ left: `${GREEN7}\u2713 All caught up${RESET10}${completedText}`, right: "" }]));
        return;
      }
      const config = await store.loadConfig();
      const limit = resolveShellDisplayLimit(args, config.shellDisplayLimit);
      const now = Date.now();
      const rows = buildTaskTreeRows(pendingTasks, tasks, { compare: compareTasksForShell, collapsedIds: await store.loadCollapsedEpicIds() });
      const lines = rows.slice(0, limit).map((row2) => formatTaskRowForShellDisplay(row2, now));
      const hiddenTaskCount = rows.length - lines.length;
      if (hiddenTaskCount > 0) {
        lines.push({
          left: `${DIM9}\u21B3 ${hiddenTaskCount} more task${hiddenTaskCount === 1 ? "" : "s"}${RESET10}`,
          right: `${DIM9}todo config shell-limit all${RESET10}`
        });
      }
      stdout.write(formatShellPanel(lines));
    }, {
      group: "View",
      usage: ["todo shell-display [--limit <n|all>]"],
      details: ["Runs automatically when stdin is not a terminal. TODO_SHELL_LIMIT overrides the configured count too.", "Tasks hidden with `todo hide` stay out of the panel."],
      options: [
        { flag: "--limit <n|all>", description: "Rows to show before folding the rest into a summary line" },
        { flag: "--all", description: "Same as --limit all" }
      ]
    });
    app.command("list", "List tasks as a tree.", async ({ args, store, stdout }) => {
      if (args[0] === "delete" && args[1] === "all") {
        if (args.length !== 2)
          throw new UserInputError("Usage: todo list delete all");
        await removeAllPendingTasks(store, stdout);
        return;
      }
      await listTasks(args, store, stdout);
    }, {
      group: "View",
      aliases: ["tree"],
      usage: ["todo list [filter]"],
      details: ["Pending tasks by default, without anything hidden via `todo hide`. Filtered views show matches flat when their parent is not part of the result."],
      options: [
        { flag: "--all", description: "Include completed and hidden tasks" },
        { flag: "--overdue", description: "Only pending tasks past their due date" },
        { flag: "--upcoming", description: "Only pending tasks due soon" }
      ],
      examples: [{ command: "todo list" }, { command: "todo tree --overdue" }, { command: "todo list delete all", note: "same as todo rm all" }]
    });
  }
};
async function listTasks(args, store, stdout) {
  const tasks = await store.loadTasks();
  const now = Date.now();
  const rows = buildTaskTreeRows(filterTasks(tasks, args[0], now), tasks, { compare: compareTasks2, collapsedIds: await store.loadCollapsedEpicIds() });
  if (rows.length === 0) {
    stdout.write(`${DIM9}No tasks found${RESET10}
`);
    return;
  }
  for (const row2 of rows) {
    stdout.write(`${formatTaskTreeRowForDisplay(row2, now)}
`);
  }
}
function resolveShellDisplayLimit(args, configuredLimit) {
  const requested = readLimitArgument(args) ?? process.env.TODO_SHELL_LIMIT;
  const limit = requested === undefined ? normalizeShellDisplayLimit(configuredLimit) : parseShellDisplayLimit(requested);
  return toShellDisplayCount(limit);
}
function readLimitArgument(args) {
  if (args.includes("--all"))
    return "all";
  const inlineArgument = args.find((argument) => argument.startsWith("--limit="));
  if (inlineArgument !== undefined)
    return inlineArgument.slice("--limit=".length);
  const flagIndex = args.indexOf("--limit");
  if (flagIndex === -1)
    return;
  const value = args[flagIndex + 1];
  if (value === undefined)
    throw new UserInputError("Usage: todo shell-display --limit <count|all>");
  return value;
}
var LIST_FILTERS = ["--all", "--overdue", "--upcoming"];
function filterTasks(tasks, filter, now) {
  if (filter !== undefined && filter.startsWith("-") && !LIST_FILTERS.includes(filter)) {
    throw new UnknownTokenError(`Unknown option: ${filter}`, filter, LIST_FILTERS, "option");
  }
  if (filter === "--all")
    return [...tasks];
  const pendingTasks = excludeHiddenSubtrees(tasks).filter((task) => task.status === "pending");
  if (filter === "--overdue") {
    return pendingTasks.filter((task) => task.dueDate !== undefined && isOverdue(task.dueDate, now));
  }
  if (filter === "--upcoming") {
    return pendingTasks.filter((task) => task.dueDate !== undefined && isUpcoming(task.dueDate, now));
  }
  return pendingTasks;
}
function compareTasks2(left, right) {
  if (left.dueDate !== undefined && right.dueDate !== undefined)
    return left.dueDate - right.dueDate;
  if (left.dueDate !== undefined)
    return -1;
  if (right.dueDate !== undefined)
    return 1;
  return 0;
}
function compareTasksForShell(left, right) {
  const dueDateOrder = compareTasks2(left, right);
  return dueDateOrder === 0 ? left.createdAt - right.createdAt : dueDateOrder;
}
function formatShellPanel(lines) {
  const output = [formatPanelBorder2("\u256D", "\u256E")];
  for (const line of lines) {
    output.push(formatPanelLine2(line.left, line.right));
  }
  output.push(formatPanelBorder2("\u2570", "\u256F"));
  return `${output.join(`
`)}
`;
}
function formatPanelLine2(left, right = "") {
  const padding = " ".repeat(Math.max(1, PANEL_WIDTH2 - getVisibleLength(left) - getVisibleLength(right)));
  return `${DIM9}\u2502${RESET10} ${left}${padding}${right} ${DIM9}\u2502${RESET10}`;
}
function formatPanelBorder2(left, right) {
  return `${DIM9}${left}${"\u2500".repeat(PANEL_WIDTH2 + 2)}${right}${RESET10}`;
}

// src/plugins/typos.ts
var DIM10 = "\x1B[2m";
var GREEN8 = "\x1B[32m";
var RESET11 = "\x1B[0m";
var typosPlugin = {
  name: "typos",
  description: "Shows and forgets learned typo corrections.",
  register(app) {
    app.command("typos", "Review or forget learned typo corrections.", async ({ args, store, stdout }) => {
      const [verb, target] = args;
      const memory = await store.loadTypoMemory();
      if (verb === undefined) {
        const entries = Object.entries(memory).flatMap(([typo, corrections]) => Object.entries(corrections).map(([correction, record]) => ({ typo, correction, record })));
        if (entries.length === 0) {
          stdout.write(`${DIM10}No learned typos yet. Corrections are learned when you answer a "did you mean" prompt.${RESET11}
`);
          return;
        }
        for (const { typo, correction, record } of entries) {
          const state = isAutoCorrected(record) ? "auto" : isIgnored(record) ? "ignored" : `prompts (${record.accepted}/${AUTO_CORRECT_THRESHOLD} until auto)`;
          stdout.write(`${typo.padEnd(18)} \u2192 ${correction.padEnd(18)} ${DIM10}${state}${RESET11}
`);
        }
        return;
      }
      if (verb === "forget") {
        if (target === undefined || args.length !== 2)
          throw new UserInputError("Usage: todo typos forget <typo>");
        if (memory[target] === undefined)
          throw new UserInputError(`Nothing learned for: ${target}`);
        await store.saveTypoMemory(forgetTypo(memory, target));
        stdout.write(`${GREEN8}Forgot ${target}${RESET11}
`);
        return;
      }
      if (verb === "reset") {
        if (args.length !== 1)
          throw new UserInputError("Usage: todo typos reset");
        await store.saveTypoMemory({});
        stdout.write(`${GREEN8}Forgot all learned typos${RESET11}
`);
        return;
      }
      throw new UserInputError("Usage: todo typos [forget <typo> | reset]");
    }, {
      group: "Settings",
      positional: "any",
      usage: ["todo typos", "todo typos forget <typo>", "todo typos reset"],
      details: [
        'A mistyped command or option with one close match prompts "did you mean".',
        `Accepting the same correction ${AUTO_CORRECT_THRESHOLD} times makes it run automatically, with a notice each time.`,
        "Declining the same correction twice stops the prompt for that word. Turn everything off with `todo config autocorrect off`."
      ],
      examples: [{ command: "todo typos" }, { command: "todo typos forget dne" }]
    });
  }
};

// src/domain/epic-visibility.ts
function listEpicIds(tasks) {
  return tasks.filter((task) => isEpic(task, tasks)).map((task) => task.id);
}
function resolveEpic(tasks, target) {
  const trimmed = target.trim();
  const numeric = /^#?\d+$/.test(trimmed);
  let task;
  try {
    task = findTaskByIdOrDescription(tasks, trimmed);
  } catch (error) {
    if (!(error instanceof UserInputError))
      throw error;
    throw new UserInputError(numeric ? `Epic #${trimmed.replace(/^#/, "")} not found` : `Epic not found: ${trimmed}`);
  }
  if (!isEpic(task, tasks))
    throw new UserInputError(`Todo #${task.id} is not an epic.`);
  return task;
}
function setEpicVisibility(collapsedIds, ids, action) {
  const next = new Set(collapsedIds);
  for (const id of ids) {
    if (action === "close")
      next.add(id);
    else if (action === "open")
      next.delete(id);
    else if (next.has(id))
      next.delete(id);
    else
      next.add(id);
  }
  return next;
}
function pruneCollapsedIds(collapsedIds, tasks) {
  const epicIds = new Set(listEpicIds(tasks));
  return new Set([...collapsedIds].filter((id) => epicIds.has(id)));
}

// src/plugins/visibility.ts
var GREEN9 = "\x1B[32m";
var RESET12 = "\x1B[0m";
var visibilityPlugin = {
  name: "visibility",
  description: "Collapses and expands epics in the task list.",
  register(app) {
    for (const action of ["toggle", "open", "close"]) {
      app.command(action, ACTION_DESCRIPTIONS[action], (context) => runVisibility(action, context), COMMAND_HELP[action]);
    }
  }
};
async function runVisibility(action, { args, store, stdout }) {
  const request = parseVisibilityRequest(action, args);
  if (request.help) {
    stdout.write(formatCommandHelp(getHelpPage(request)));
    return;
  }
  const tasks = await store.loadTasks();
  const collapsedIds = pruneCollapsedIds(await store.loadCollapsedEpicIds(), tasks);
  if (request.target === "reset") {
    await store.saveCollapsedEpicIds([]);
    stdout.write(`${GREEN9}Epic visibility reset${RESET12}
`);
    return;
  }
  if (request.target === "all") {
    const epicIds = listEpicIds(tasks);
    await store.saveCollapsedEpicIds(setEpicVisibility(collapsedIds, epicIds, action));
    stdout.write(`${GREEN9}${formatAllMessage(action, epicIds.length)}${RESET12}
`);
    return;
  }
  const epic = resolveEpic(tasks, request.selector ?? "");
  const next = setEpicVisibility(collapsedIds, [epic.id], action);
  await store.saveCollapsedEpicIds(next);
  stdout.write(`${GREEN9}${next.has(epic.id) ? "Closed" : "Opened"} epic: ${epic.description}${RESET12}
`);
}
function parseVisibilityRequest(action, args) {
  const help = args.some(isHelpToken);
  const rest = args.filter((argument) => !isHelpToken(argument));
  const keywords = rest.filter((argument) => argument === "all" || argument === "reset");
  if (keywords.length > 1) {
    throw new UserInputError(`all and reset are mutually exclusive selectors for todo ${action}.
` + `Usage: todo ${action} all${action === "toggle" ? `
       todo toggle reset` : ""}`);
  }
  if (rest.length === 0) {
    if (help)
      return { action, target: "epic", help: true };
    throw new UserInputError(formatUsage(action));
  }
  if (rest.length === 1 && rest[0] === "all")
    return { action, target: "all", help };
  if (rest.length === 1 && rest[0] === "reset") {
    if (action !== "toggle")
      throw new UserInputError(`Resetting epic visibility is only available as 'todo toggle reset'.`);
    return { action, target: "reset", help };
  }
  return { action, target: "epic", selector: rest.join(" "), help };
}
function formatUsage(action) {
  return `Usage: todo ${action} <epic>
       todo ${action} all${action === "toggle" ? `
       todo toggle reset` : ""}`;
}
function formatAllMessage(action, epicCount) {
  if (action === "open")
    return "Opened all epics";
  if (action === "close")
    return "Closed all epics";
  return `Toggled ${epicCount} epic${epicCount === 1 ? "" : "s"}`;
}
var ACTION_DESCRIPTIONS = {
  toggle: "Collapse an expanded epic, or expand a collapsed one.",
  open: "Expand an epic so its subtickets render again.",
  close: "Collapse an epic into a single subticket-count line."
};
var EPIC_DETAILS = [
  "<epic> is an epic name or an epic ID, with or without the leading #. Quote names with spaces.",
  "Visibility is presentation state only: nothing about the tasks themselves changes."
];
var COMMAND_HELP = {
  toggle: {
    group: "Epic visibility",
    positional: "any",
    ownHelp: true,
    aliasNotes: ["-t <epic>", "--t <epic>", "-ta", "-tr"],
    usage: ["todo toggle <epic>", "todo toggle all", "todo toggle reset"],
    details: [...EPIC_DETAILS, "`todo toggle all` inverts every epic independently; `todo toggle reset` expands everything again."],
    examples: [
      { command: "todo toggle joram" },
      { command: "todo toggle 36" },
      { command: "todo toggle #36" },
      { command: "todo toggle all", note: "same as todo -ta" },
      { command: "todo toggle reset", note: "same as todo -tr" }
    ]
  },
  open: {
    group: "Epic visibility",
    positional: "any",
    ownHelp: true,
    aliasNotes: ["-o <epic>", "--o <epic>", "-oa"],
    usage: ["todo open <epic>", "todo open all"],
    details: [...EPIC_DETAILS, "Idempotent: opening an already-open epic leaves it open."],
    examples: [{ command: "todo open joram" }, { command: "todo open 36" }, { command: "todo open all", note: "same as todo -oa" }]
  },
  close: {
    group: "Epic visibility",
    positional: "any",
    ownHelp: true,
    aliasNotes: ["-c <epic>", "--c <epic>", "-ca"],
    usage: ["todo close <epic>", "todo close all"],
    details: [...EPIC_DETAILS, "Idempotent: closing an already-closed epic leaves it closed.", "A closed epic renders as `name \u25CF 2 subtickets` and hides its children."],
    examples: [{ command: "todo close joram" }, { command: "todo close #36" }, { command: "todo close all", note: "same as todo -ca" }]
  }
};
var TARGET_HELP = {
  "toggle all": {
    name: "toggle all",
    description: "Invert every epic's visibility independently.",
    help: {
      aliasNotes: ["-ta", "--t --a"],
      usage: ["todo toggle all"],
      details: ["Each epic flips on its own: open epics close, closed epics open.", "This is not a bulk 'set everything to one state' \u2014 use `todo open all` or `todo close all` for that."],
      examples: [{ command: "todo toggle all" }, { command: "todo -ta" }]
    }
  },
  "toggle reset": {
    name: "toggle reset",
    description: "Drop all persisted epic visibility overrides.",
    help: {
      aliasNotes: ["-tr", "--t --r"],
      usage: ["todo toggle reset"],
      details: ["Clears the stored state instead of writing an explicit open state per epic.", "The default is expanded, so every epic \u2014 including future ones \u2014 renders open again."],
      examples: [{ command: "todo toggle reset" }, { command: "todo -tr" }]
    }
  },
  "open all": {
    name: "open all",
    description: "Expand every epic.",
    help: {
      aliasNotes: ["-oa", "--o --a"],
      usage: ["todo open all"],
      details: ["Idempotent: epics that are already open stay open."],
      examples: [{ command: "todo open all" }, { command: "todo -oa" }]
    }
  },
  "close all": {
    name: "close all",
    description: "Collapse every epic.",
    help: {
      aliasNotes: ["-ca", "--c --a"],
      usage: ["todo close all"],
      details: ["Idempotent: epics that are already closed stay closed.", "Epics created later still default to open."],
      examples: [{ command: "todo close all" }, { command: "todo -ca" }]
    }
  }
};
function getHelpPage(request) {
  const page = TARGET_HELP[`${request.action} ${request.target}`];
  if (page !== undefined)
    return page;
  return { name: request.action, description: ACTION_DESCRIPTIONS[request.action], help: COMMAND_HELP[request.action] };
}

// src/plugins/builtins.ts
var builtInPlugins = [addPlugin, configPlugin, duePlugin, epicPlugin, helpPlugin, interactivePlugin, lifecyclePlugin, removePlugin, tasksPlugin, typosPlugin, undoPlugin, visibilityPlugin];

// src/plugins/registry.ts
class PluginRegistry {
  commands = new Map;
  use(plugin) {
    plugin.register(this);
  }
  command(name, description, handler, help = {}) {
    const registered = { name, description, handler, help };
    for (const commandName of [name, ...help.aliases ?? []]) {
      if (this.commands.has(commandName)) {
        throw new Error(`Command already registered: ${commandName}`);
      }
      this.commands.set(commandName, registered);
    }
  }
  getCommand(name) {
    return this.commands.get(name);
  }
  listCommands() {
    return [...this.commands.entries()].filter(([name, command]) => name === command.name).map(([name, command]) => ({ name, description: command.description, help: command.help })).sort((left, right) => left.name.localeCompare(right.name));
  }
}

// src/storage/todo-store.ts
import { mkdir as mkdir2, open, readFile, rename, stat, unlink, writeFile as writeFile2 } from "fs/promises";
import { dirname as dirname2, join as join2 } from "path";

// src/domain/normalize-task.ts
function normalizeTasks(value) {
  if (!Array.isArray(value)) {
    throw new Error("Tasks data must be an array");
  }
  return value.map((task, index) => normalizeTask(task, index));
}
function normalizeTask(value, index) {
  if (!isRecord(value)) {
    throw new Error(`Task at index ${index} must be an object`);
  }
  const task = {
    id: readString(value.id, "id", index),
    description: readString(value.description, "description", index),
    status: readStatus(value.status, index),
    priority: readPriority(value.priority),
    createdAt: readNumber(value.createdAt, "createdAt", index),
    updatedAt: readNumber(value.updatedAt, "updatedAt", index),
    reminderOffsets: readNumberArray(value.reminderOffsets),
    notificationsSent: readNotificationState(value.notificationsSent)
  };
  if (typeof value.dueDate === "number" && Number.isFinite(value.dueDate)) {
    task.dueDate = value.dueDate;
  }
  if (typeof value.parentId === "string" && value.parentId.length > 0) {
    task.parentId = value.parentId;
  }
  const kind = readKind(value.kind);
  if (kind !== undefined)
    task.kind = kind;
  if (value.hidden === true)
    task.hidden = true;
  const reminder = readReminder(value.reminder);
  if (reminder !== undefined) {
    task.reminder = reminder;
    task.dueDate = reminder.dueAt;
  }
  return task;
}
function readReminder(value) {
  if (!isRecord(value))
    return;
  if (typeof value.id !== "string" || value.id.length === 0)
    return;
  if (typeof value.dueAt !== "number" || !Number.isFinite(value.dueAt))
    return;
  const reminder = {
    id: value.id,
    dueAt: value.dueAt,
    expression: typeof value.expression === "string" ? value.expression : "",
    createdAt: typeof value.createdAt === "number" && Number.isFinite(value.createdAt) ? value.createdAt : value.dueAt,
    soundMode: readSoundMode(value.soundMode)
  };
  if (typeof value.soundPath === "string" && value.soundPath.length > 0)
    reminder.soundPath = value.soundPath;
  if (typeof value.run === "string" && value.run.length > 0)
    reminder.run = value.run;
  if (typeof value.cwd === "string" && value.cwd.length > 0)
    reminder.cwd = value.cwd;
  if (typeof value.firedAt === "number" && Number.isFinite(value.firedAt))
    reminder.firedAt = value.firedAt;
  if (typeof value.soundError === "string")
    reminder.soundError = value.soundError;
  if (typeof value.runExitCode === "number" && Number.isFinite(value.runExitCode))
    reminder.runExitCode = value.runExitCode;
  if (typeof value.runError === "string")
    reminder.runError = value.runError;
  return reminder;
}
function readSoundMode(value) {
  return value === "none" || value === "custom" ? value : "default";
}
function readStatus(value, index) {
  if (value === "pending" || value === "completed")
    return value;
  throw new Error(`Task at index ${index} has an invalid status`);
}
function readKind(value) {
  return value === "epic" ? "epic" : undefined;
}
function readPriority(value) {
  if (value === "low" || value === "medium" || value === "high")
    return value;
  return "none";
}
function readNotificationState(value) {
  if (!isRecord(value))
    return { reminders: [], overdue: false };
  return {
    reminders: readNumberArray(value.reminders),
    overdue: value.overdue === true
  };
}
function readNumberArray(value) {
  if (!Array.isArray(value))
    return [];
  return value.filter((item) => typeof item === "number" && Number.isFinite(item));
}
function readString(value, field, index) {
  if (typeof value === "string")
    return value;
  throw new Error(`Task at index ${index} has an invalid ${field}`);
}
function readNumber(value, field, index) {
  if (typeof value === "number" && Number.isFinite(value))
    return value;
  throw new Error(`Task at index ${index} has an invalid ${field}`);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/storage/todo-store.ts
function getTodoPaths(dataDir = process.env.DOTFILES_DATA_DIR ?? join2(process.env.HOME ?? ".", ".dotfiles")) {
  const todoDir = join2(dataDir, "todo");
  return {
    dataDir: todoDir,
    tasksFile: join2(todoDir, "tasks.json"),
    configFile: join2(todoDir, "config.json"),
    undoFile: join2(todoDir, "undo.json"),
    typosFile: join2(todoDir, "typos.json"),
    lockFile: join2(todoDir, "reminders.lock")
  };
}
var LOCK_POLL_MS = 25;
var LOCK_TIMEOUT_MS = 5000;
var LOCK_STALE_MS = 30000;

class TodoStore {
  paths;
  constructor(paths = getTodoPaths()) {
    this.paths = paths;
  }
  get tasksFile() {
    return this.paths.tasksFile;
  }
  async runExclusive(operation) {
    const acquired = await this.acquireLock();
    try {
      return await operation();
    } finally {
      if (acquired)
        await this.releaseLock();
    }
  }
  async acquireLock() {
    await mkdir2(this.paths.dataDir, { recursive: true });
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const handle = await open(this.paths.lockFile, "wx");
        await handle.write(`${process.pid}
`);
        await handle.close();
        return true;
      } catch (error) {
        if (!isExistingFile(error))
          return false;
        if (await this.breakStaleLock())
          continue;
        await delay(LOCK_POLL_MS);
      }
    }
    return false;
  }
  async breakStaleLock() {
    try {
      const stats = await stat(this.paths.lockFile);
      if (Date.now() - stats.mtimeMs < LOCK_STALE_MS)
        return false;
      await unlink(this.paths.lockFile);
      return true;
    } catch {
      return false;
    }
  }
  async releaseLock() {
    try {
      await unlink(this.paths.lockFile);
    } catch (error) {
      if (!isMissingFile(error))
        throw error;
    }
  }
  async loadTasks() {
    return normalizeTasks(await this.readJson(this.paths.tasksFile, []));
  }
  async saveTasks(tasks) {
    await this.writeJsonAtomically(this.paths.tasksFile, tasks);
  }
  async loadConfig() {
    const saved = await this.readJson(this.paths.configFile, {});
    return { ...DEFAULT_CONFIG, ...saved, schemaVersion: 1, undoTimeout: DEFAULT_CONFIG.undoTimeout };
  }
  async saveConfig(config) {
    await this.writeJsonAtomically(this.paths.configFile, config);
  }
  async loadCollapsedEpicIds() {
    const saved = (await this.loadConfig()).collapsedEpicIds;
    return new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : []);
  }
  async saveCollapsedEpicIds(ids) {
    const config = await this.loadConfig();
    const collapsedEpicIds = [...new Set(ids)].sort((left, right) => Number(left) - Number(right));
    await this.saveConfig({ ...config, collapsedEpicIds });
  }
  async saveUndo(tasks) {
    const config = await this.loadConfig();
    const timestamp = Date.now();
    await this.writeJsonAtomically(this.paths.undoFile, {
      tasks,
      timestamp,
      expiresAt: timestamp + config.undoTimeout
    });
  }
  async loadUndo() {
    const undo = await this.readJson(this.paths.undoFile, undefined);
    if (undo === undefined || Date.now() > undo.expiresAt) {
      await this.clearUndo();
      return;
    }
    return undo;
  }
  async loadTypoMemory() {
    return await this.readJson(this.paths.typosFile, {});
  }
  async saveTypoMemory(memory) {
    await this.writeJsonAtomically(this.paths.typosFile, memory);
  }
  async clearUndo() {
    try {
      await unlink(this.paths.undoFile);
    } catch (error) {
      if (!isMissingFile(error))
        throw error;
    }
  }
  async readJson(path, fallback) {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (isMissingFile(error))
        return fallback;
      throw new Error(`Could not read ${path}: ${formatError(error)}`);
    }
  }
  async writeJsonAtomically(path, value) {
    await mkdir2(dirname2(path), { recursive: true });
    const temporaryPath = `${path}.${process.pid}.tmp`;
    await writeFile2(temporaryPath, `${JSON.stringify(value, null, 2)}
`, "utf8");
    await rename(temporaryPath, path);
  }
}
function isMissingFile(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
function isExistingFile(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}
function delay(milliseconds) {
  return new Promise((resolve2) => setTimeout(resolve2, milliseconds));
}
function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/cli.ts
var HELP_FLAGS = new Set(["-h", "--help"]);
function isSchedulerInvocation(args) {
  return args[0] === "due" && args[1] === "daemon";
}
async function run(args) {
  const registry = new PluginRegistry;
  for (const plugin of builtInPlugins)
    registry.use(plugin);
  const store = new TodoStore;
  const config = await store.loadConfig();
  if (config.showNotificationsOnStartup && !isSchedulerInvocation(args)) {
    await sendDueNotifications(store);
    await processDueReminders(store, createDefaultEffects());
  }
  const io = createTerminalIo();
  let invocation = expandVisibilityAliases(args) ?? args;
  const requestedCommandName = invocation[0];
  let commandName = requestedCommandName !== undefined && HELP_FLAGS.has(requestedCommandName) ? "help" : requestedCommandName ?? (process.stdin.isTTY && process.stdout.isTTY ? "interactive" : "shell-display");
  let command = registry.getCommand(commandName);
  if (command === undefined && config.autocorrect) {
    const corrected = await correctCommandName(invocation, registry, store, io);
    if (corrected !== undefined && corrected[0] !== undefined) {
      invocation = corrected;
      commandName = corrected[0];
      command = registry.getCommand(commandName);
    }
  }
  const addCommand = registry.getCommand("add");
  const useImplicitAdd = command === undefined && invocation.length > 0 && !commandName.startsWith("--");
  const handler = command?.handler ?? (useImplicitAdd ? addCommand?.handler : undefined);
  if (handler === undefined) {
    process.stderr.write(`Unknown command: ${commandName}
Run 'todo help' for usage.
`);
    process.exitCode = 1;
    return;
  }
  if (command !== undefined && command.name !== "help" && command.help.ownHelp !== true && invocation.slice(1).some((argument) => HELP_FLAGS.has(argument))) {
    process.stdout.write(formatCommandHelp(findCommand(registry.listCommands(), command.name)));
    return;
  }
  let commandArgs = command === undefined ? invocation : invocation.slice(1);
  for (let attempt = 0;attempt < MAX_CORRECTIONS_PER_RUN; attempt += 1) {
    try {
      await runCommand(handler, commandArgs, registry, store);
      return;
    } catch (error) {
      if (!(error instanceof UserInputError))
        throw error;
      if (error instanceof UnknownTokenError && config.autocorrect) {
        const corrected = await correctRejectedToken(error, command?.name, commandArgs, store, io);
        if (corrected !== undefined) {
          commandArgs = corrected;
          continue;
        }
      }
      process.stderr.write(`${error.message}
`);
      if (command !== undefined && error.message.startsWith("Usage:")) {
        process.stderr.write(`Run 'todo ${command.name} --help' for details.
`);
      }
      process.exitCode = 1;
      return;
    }
  }
}
var MAX_CORRECTIONS_PER_RUN = 4;
function createTerminalIo() {
  return {
    async confirm(question) {
      if (!process.stdin.isTTY || !process.stdout.isTTY)
        return;
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      try {
        const answer = (await prompt.question(question)).trim().toLowerCase();
        return answer === "" || answer === "y" || answer === "yes";
      } finally {
        prompt.close();
      }
    },
    notify(message) {
      process.stderr.write(message);
    }
  };
}
async function runCommand(handler, args, registry, store) {
  await handler({
    args,
    store,
    stdout: process.stdout,
    stderr: process.stderr,
    commands: registry.listCommands()
  });
}

// todo.ts
await run(process.argv.slice(2));
