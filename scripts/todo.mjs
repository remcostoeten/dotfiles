#!/usr/bin/env bun
// @bun

// src/domain/user-input-error.ts
class UserInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserInputError";
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

// src/plugins/add.ts
var addPlugin = {
  name: "add",
  description: "Creates tasks.",
  register(app) {
    app.command("add", "Add a task. Options: --due, --priority, --reminders.", async ({ args, store, stdout }) => {
      const newTasks = await createTasks(store, args);
      for (const task of newTasks)
        stdout.write(`Added task ${task.id}: ${task.description}
`);
    });
  }
};
async function createTasks(store, args) {
  const options = parseAddArguments(args);
  const tasks = await store.loadTasks();
  const config = await store.loadConfig();
  const now = Date.now();
  const newTasks = options.map((option, index) => createTask(option, getNextId(tasks) + index, now, config.defaultReminderOffsets));
  await store.saveTasks([...tasks, ...newTasks]);
  return newTasks;
}
function parseAddArguments(args, now = new Date) {
  const optionStart = args.findIndex((argument) => argument === "--" || argument.startsWith("--"));
  const descriptionParts = optionStart === -1 ? args : args.slice(0, optionStart);
  const optionArguments = optionStart === -1 ? [] : args.slice(optionStart);
  if (optionArguments[0] === "--")
    optionArguments.shift();
  const descriptions = descriptionParts.join(" ").split(",").map((description) => description.trim()).filter(Boolean);
  if (descriptions.length === 0) {
    throw new UserInputError("Usage: todo <description>[, <description>] [--due <time>] [--priority <level>] [--reminders <minutes>]");
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
    } else if (name === "--due") {
      options.dueDate = parseDueDate(value, now);
    } else if (name === "--reminders" || name === "--remind" || name === "--r") {
      options.reminderOffsets = parseReminderOffsets(value);
    } else {
      throw new UserInputError(`Unknown option: ${name}`);
    }
  }
  return descriptions.map((description) => ({ ...options, description }));
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
  return task;
}
function splitOption(argument) {
  const equalsIndex = argument.indexOf("=");
  if (equalsIndex === -1)
    return [argument, undefined];
  return [argument.slice(0, equalsIndex), argument.slice(equalsIndex + 1)];
}
function parsePriority(value) {
  if (value === "none" || value === "low" || value === "medium" || value === "high")
    return value;
  throw new UserInputError(`Invalid priority: ${value}`);
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
  undoTimeout: 5000
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
var DIM = "\x1B[2m";
var RESET = "\x1B[0m";
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
  }
];
var configPlugin = {
  name: "config",
  description: "Reads and writes persisted settings.",
  register(app) {
    app.command("config", "Show settings, or set one with 'todo config <key> <value>'.", async ({ args, store, stdout }) => {
      const config = await store.loadConfig();
      const [name, ...valueParts] = stripVerb(args);
      if (name === undefined) {
        for (const setting2 of SETTINGS) {
          stdout.write(`${setting2.name.padEnd(22)} ${setting2.read(config)}${DIM}  ${setting2.description}${RESET}
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
    });
  }
};
function stripVerb(args) {
  return args[0] === "set" || args[0] === "get" ? args.slice(1) : args;
}
function findSetting(name) {
  const setting = SETTINGS.find((candidate) => candidate.name === name);
  if (setting === undefined) {
    throw new UserInputError(`Unknown setting: ${name}. Known settings: ${SETTINGS.map((candidate) => candidate.name).join(", ")}`);
  }
  return setting;
}
function parseBoolean(value) {
  const normalized = value.trim().toLowerCase();
  if (["on", "true", "yes", "1"].includes(normalized))
    return true;
  if (["off", "false", "no", "0"].includes(normalized))
    return false;
  throw new UserInputError(`Invalid boolean: ${value}. Use on or off.`);
}
function formatBoolean(value) {
  return value ? "on" : "off";
}

// src/plugins/help.ts
var helpPlugin = {
  name: "help",
  description: "Lists available commands.",
  register(app) {
    app.command("help", "Show available commands.", ({ stdout, commands }) => {
      stdout.write(`Todo (TypeScript rewrite)

Commands:
`);
      for (const command of commands) {
        stdout.write(`  ${command.name.padEnd(16)} ${command.description}
`);
      }
    });
  }
};

// src/plugins/interactive.ts
import { emitKeypressEvents } from "readline";

// src/presentation/task-format.ts
var RESET2 = "\x1B[0m";
var DIM2 = "\x1B[2m";
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
function formatTaskForShellDisplay(task, now = Date.now()) {
  const description = truncate(task.description, 38);
  const taskText = formatTask(task, description, now, false);
  const id = `${DIM2}#${task.id.padStart(2, "0")}${RESET2}`;
  return {
    left: `${id}  ${taskText}`,
    right: `${DIM2}${formatCreatedAt(task.createdAt)}${RESET2}`
  };
}
function formatTask(task, description, now, includeId) {
  const parts = [];
  if (task.dueDate !== undefined) {
    if (isUpcoming(task.dueDate, now)) {
      parts.push(`${YELLOW}[UPCOMING]${RESET2}`);
    } else if (isOverdue(task.dueDate, now)) {
      parts.push(`${RED}[OVERDUE]${RESET2}`);
    }
  }
  if (task.priority !== "none") {
    parts.push(`${PRIORITY_COLORS[task.priority]}[${task.priority.toUpperCase()}]${RESET2}`);
  }
  parts.push(`${getUrgencyColor(task.dueDate, now)}${description}${RESET2}`);
  if (task.dueDate !== undefined) {
    parts.push(`${DIM2}- due ${formatTimeRemaining(task.dueDate, now)}${RESET2}`);
  }
  if (includeId)
    parts.push(`${DIM2}(${task.id})${RESET2}`);
  return parts.join(" ");
}
function isUpcoming(timestamp, now = Date.now()) {
  const difference = timestamp - now;
  return difference > 0 && difference < 30 * 60 * 1000;
}
function isOverdue(timestamp, now = Date.now()) {
  return timestamp < now;
}
function getUrgencyColor(timestamp, now) {
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
function formatTimeRemaining(timestamp, now) {
  const difference = timestamp - now;
  const absoluteMinutes = Math.floor(Math.abs(difference) / (60 * 1000));
  const hours = Math.floor(absoluteMinutes / 60);
  const days = Math.floor(hours / 24);
  if (difference < 0) {
    if (days > 0)
      return `${days}d overdue`;
    if (hours > 0)
      return `${hours}h overdue`;
    return `${absoluteMinutes} min ago`;
  }
  if (days > 0) {
    const remainingHours = hours % 24;
    return `in ${remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`}`;
  }
  if (hours > 0) {
    const remainingMinutes = absoluteMinutes % 60;
    return remainingMinutes > 0 ? `in ${hours}h ${remainingMinutes}m` : `in ${hours}h`;
  }
  return `in ${absoluteMinutes}m`;
}
function truncate(value, maximumLength) {
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
}

// src/plugins/undo.ts
var DIM3 = "\x1B[2m";
var GREEN = "\x1B[32m";
var RESET3 = "\x1B[0m";
var undoPlugin = {
  name: "undo",
  description: "Restores the most recently deleted tasks or snoozes a task.",
  register(app) {
    app.command("undo", "Restore the most recently deleted task or tasks.", async ({ args, store, stdout }) => {
      if (args.length > 0)
        throw new UserInputError("Usage: todo undo");
      const undo = await store.loadUndo();
      if (undo === undefined || undo.tasks.length === 0) {
        stdout.write(`${DIM3}Nothing to undo${RESET3}
`);
        return;
      }
      const tasks = await store.loadTasks();
      const restoredTasks = restoreTasks(tasks, undo.tasks);
      await store.saveTasks([...tasks, ...restoredTasks]);
      await store.clearUndo();
      stdout.write(`${GREEN}Restored ${restoredTasks.length} task(s)${RESET3}
`);
    });
    app.command("snooze", "Snooze a task: todo snooze <id> <1h|tomorrow|monday>.", async ({ args, store, stdout }) => {
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
      resetNotificationState(task);
      await store.saveTasks(tasks);
      stdout.write(`${GREEN}Snoozed #${task.id}${RESET3}
`);
    });
  }
};
function restoreTasks(tasks, deletedTasks) {
  let nextId = getNextId2(tasks);
  return deletedTasks.map((task) => ({ ...task, id: `${nextId++}`, updatedAt: Date.now() }));
}
function getNextId2(tasks) {
  const ids = tasks.map((task) => Number.parseInt(task.id, 10)).filter(Number.isFinite);
  return (ids.length === 0 ? 0 : Math.max(...ids)) + 1;
}

// src/plugins/interactive.ts
var DIM4 = "\x1B[2m";
var RESET4 = "\x1B[0m";
var BRIGHT = "\x1B[1m";
var MAUVE = "\x1B[38;5;147m";
var GREEN2 = "\x1B[38;5;166m";
var RED2 = "\x1B[38;5;203m";
var BLUE = "\x1B[38;5;116m";
var SELECTED = "\x1B[48;5;60m";
var PANEL_WIDTH = 72;
var VISIBLE_TASK_COUNT = 8;
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
    app.command("interactive", "Open the keyboard-controlled taskboard.", async ({ store }) => {
      const taskboard = new Taskboard(store);
      await taskboard.start();
    });
  }
};

class Taskboard {
  store;
  tasks = [];
  sourceTasks = [];
  allTasks = [];
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
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("keypress", this.handleKeypress);
    process.stdout.write("\x1B[?25l");
    this.draw();
    await new Promise((resolve) => {
      this.resolveClose = resolve;
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
    if (this.mode === "adding" || this.mode === "editing" || this.mode === "snoozing" || this.mode === "setting-due") {
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
      this.mode = "adding";
      this.draft = "";
      this.message = "";
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
      if (this.mode === "adding")
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
    const now = Date.now();
    for (const task of tasks) {
      if (!ids.has(task.id))
        continue;
      task.status = "completed";
      task.updatedAt = now;
    }
    await this.store.saveTasks(tasks);
    this.selectedTaskIds.clear();
    this.message = `Completed ${ids.size} task${ids.size === 1 ? "" : "s"}`;
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
      const addedTasks = await createTasks(this.store, input.split(/\s+/));
      this.mode = "normal";
      this.draft = "";
      this.message = `Added ${addedTasks.length} task${addedTasks.length === 1 ? "" : "s"}`;
      await this.refresh(addedTasks[0]?.id);
    } catch (error) {
      this.message = error instanceof UserInputError ? error.message : "Could not add task";
    }
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
      this.message = `Restored #${task.id}`;
    } else {
      task.status = "completed";
      this.message = `Completed #${task.id}`;
    }
    task.updatedAt = Date.now();
    await this.store.saveTasks(tasks);
    await this.refresh();
  }
  async deleteSelectedTask() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined)
      return;
    const tasks = await this.store.loadTasks();
    await this.store.saveUndo([selectedTask]);
    await this.store.saveTasks(tasks.filter((task) => task.id !== selectedTask.id));
    this.mode = "normal";
    this.message = `Deleted #${selectedTask.id} \xB7 u/Ctrl+Z to undo (5s)`;
    await this.refresh();
  }
  async refresh(selectedId) {
    this.allTasks = await this.store.loadTasks();
    this.sourceTasks = filterWorkspaceTasks(this.allTasks, this.workspace.key).sort(compareTasks);
    this.applySearch();
    if (selectedId !== undefined) {
      const matchingIndex = this.tasks.findIndex((task) => task.id === selectedId);
      if (matchingIndex !== -1)
        this.selectedIndex = matchingIndex;
    }
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.tasks.length - 1));
    this.scrollOffset = Math.min(this.scrollOffset, Math.max(0, this.tasks.length - VISIBLE_TASK_COUNT));
    this.ensureSelectedTaskIsVisible();
  }
  applySearch() {
    const query = this.searchQuery.trim().toLowerCase();
    this.tasks = query.length === 0 ? [...this.sourceTasks] : this.sourceTasks.filter((task) => task.description.toLowerCase().includes(query));
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.tasks.length - 1));
    this.ensureSelectedTaskIsVisible();
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
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex + offset, this.tasks.length - 1));
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
  get selectedTask() {
    return this.tasks[this.selectedIndex];
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
    const dueToday = this.view === "pending" && dueTodayCount > 0 ? `${DIM4} \xB7 ${dueTodayCount} due today${RESET4}` : "";
    const title = this.view === "archive" ? `${BRIGHT}${MAUVE}todo${RESET4} ${DIM4}\xB7 archive${RESET4}` : `${BRIGHT}${MAUVE}todo${RESET4}`;
    output.push(formatPanelLine(title, `${GREEN2}\u25CF ${status}${RESET4}${dueToday}`));
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
    output.push(`${DIM4}\u2570${"\u2500".repeat(width - 2)}\u256F${RESET4}`);
    return `${output.join(`
`)}
`;
  }
  workspaceLines(width) {
    return WORKSPACES.map((workspace, index) => {
      const count = filterWorkspaceTasks(this.allTasks, workspace.key).length;
      const selected = this.focus === "workspaces" && index === this.workspaceIndex;
      const marker = index === this.workspaceIndex ? `${GREEN2}\u203A${RESET4}` : " ";
      const content = `${marker} ${workspace.label} ${DIM4}(${count})${RESET4}`;
      return selected ? `${SELECTED}${fit(content, width)}${RESET4}` : content;
    });
  }
  workspaceTaskLines(width) {
    if (this.mode === "help")
      return this.helpLines();
    if (this.mode === "adding")
      return [`${GREEN2}new task${RESET4}`, `${DIM4}>${RESET4} ${this.draft}${BRIGHT}\u258F${RESET4}`, `${DIM4}Enter to save \xB7 Esc to cancel${RESET4}`];
    if (this.mode === "editing")
      return [`${GREEN2}edit #${this.selectedTask?.id ?? ""}${RESET4}`, `${DIM4}>${RESET4} ${this.draft}${BRIGHT}\u258F${RESET4}`, `${DIM4}Enter to save \xB7 Esc to cancel${RESET4}`];
    if (this.mode === "snoozing")
      return [`${GREEN2}snooze #${this.selectedTask?.id ?? ""}${RESET4}`, `${DIM4}>${RESET4} ${this.draft}${BRIGHT}\u258F${RESET4}`, `${DIM4}30m \xB7 1h \xB7 tomorrow \xB7 monday \xB7 next week${RESET4}`];
    if (this.mode === "setting-due")
      return [`${GREEN2}due date #${this.selectedTask?.id ?? ""}${RESET4}`, `${DIM4}>${RESET4} ${this.draft}${BRIGHT}\u258F${RESET4}`, `${DIM4}30m \xB7 1h \xB7 tomorrow \xB7 monday \xB7 next week \xB7 none${RESET4}`];
    if (this.mode === "searching")
      return [`${GREEN2}search${RESET4}`, `${DIM4}/${RESET4} ${this.searchQuery}${BRIGHT}\u258F${RESET4}`, `${DIM4}Enter to keep filter \xB7 Esc to clear${RESET4}`];
    if (this.mode === "confirming-delete")
      return [`${RED2}Delete #${this.selectedTask?.id ?? ""}?${RESET4}`, `${DIM4}Press y to delete \xB7 n or Esc to cancel${RESET4}`];
    if (this.tasks.length === 0)
      return [`${GREEN2}\u2713 All caught up${RESET4}`, `${DIM4}Press a to add a task${RESET4}`];
    const header = `${DIM4}PRI  ID    TITLE${" ".repeat(Math.max(1, width - 53))}CREATED       UPDATED       DUE${RESET4}`;
    const rows = this.tasks.slice(this.scrollOffset, this.scrollOffset + VISIBLE_TASK_COUNT).map((task, index) => {
      const selected = this.scrollOffset + index === this.selectedIndex;
      const marked = this.selectedTaskIds.has(task.id);
      const marker = selected ? `${GREEN2}\u203A${RESET4}` : marked ? `${GREEN2}\u2713${RESET4}` : `${DIM4}\xB7${RESET4}`;
      const content = `${marker} ${formatWorkspaceTask(task, width - 2)}`;
      return selected && this.focus === "tasks" ? highlight(fit(content, width)) : content;
    });
    return [header, ...rows];
  }
  taskLines() {
    if (this.mode === "adding")
      return [`${GREEN2}add task${RESET4}`, `${DIM4}>${RESET4} ${this.draft}${BRIGHT}\u258F${RESET4}`, `${DIM4}Enter to save \xB7 Esc to cancel${RESET4}`];
    if (this.mode === "editing")
      return [`${GREEN2}edit #${this.selectedTask?.id ?? ""}${RESET4}`, `${DIM4}>${RESET4} ${this.draft}${BRIGHT}\u258F${RESET4}`, `${DIM4}Enter to save \xB7 Esc to cancel${RESET4}`];
    if (this.mode === "snoozing")
      return [`${GREEN2}snooze #${this.selectedTask?.id ?? ""}${RESET4}`, `${DIM4}>${RESET4} ${this.draft}${BRIGHT}\u258F${RESET4}`, `${DIM4}30m \xB7 1h \xB7 tomorrow \xB7 monday \xB7 next week${RESET4}`];
    if (this.mode === "setting-due")
      return [`${GREEN2}due date #${this.selectedTask?.id ?? ""}${RESET4}`, `${DIM4}>${RESET4} ${this.draft}${BRIGHT}\u258F${RESET4}`, `${DIM4}30m \xB7 1h \xB7 tomorrow \xB7 monday \xB7 next week \xB7 none${RESET4}`];
    if (this.mode === "searching")
      return [`${GREEN2}search${RESET4}`, `${DIM4}/${RESET4} ${this.searchQuery}${BRIGHT}\u258F${RESET4}`, `${DIM4}Enter to keep filter \xB7 Esc to clear${RESET4}`];
    if (this.mode === "confirming-delete")
      return [`${RED2}Delete #${this.selectedTask?.id ?? ""}?${RESET4}`, `${DIM4}Press y to delete \xB7 n or Esc to cancel${RESET4}`];
    if (this.tasks.length === 0) {
      const emptyAction = this.view === "pending" ? "Press a to add a task" : "Press v to return to open tasks";
      return [`${GREEN2}\u2713 All caught up${RESET4}`, `${DIM4}${emptyAction}${RESET4}`];
    }
    const header = formatCompactHeader(PANEL_WIDTH - 3);
    const visibleTasks = this.tasks.slice(this.scrollOffset, this.scrollOffset + VISIBLE_TASK_COUNT);
    const rows = visibleTasks.map((task, index) => {
      const selected = this.scrollOffset + index === this.selectedIndex;
      const marked = this.selectedTaskIds.has(task.id);
      const marker = selected ? `${GREEN2}\u203A${RESET4}` : marked ? `${GREEN2}\u2713${RESET4}` : `${DIM4}\xB7${RESET4}`;
      const content = `${marker} ${formatCompactTask(task, PANEL_WIDTH - 3)}`;
      return selected ? highlight(fit(content, PANEL_WIDTH - 1)) : content;
    });
    return [header, ...rows];
  }
  helpLines() {
    return [
      `${GREEN2}\u2191/k  \u2193/j${RESET4}  move selection`,
      `${GREEN2}Enter${RESET4}  complete selected task`,
      `${GREEN2}a${RESET4}  add task`,
      `${GREEN2}e${RESET4}  edit selected task`,
      `${GREEN2}d${RESET4}  delete selected task`,
      `${GREEN2}u / Ctrl+Z${RESET4}  undo last deletion (within 5s)`,
      `${GREEN2}s${RESET4}  snooze selected task`,
      `${GREEN2}p${RESET4}  cycle priority`,
      `${GREEN2}t${RESET4}  set or clear due date`,
      `${GREEN2}x${RESET4}  mark task for batch completion`,
      `${GREEN2}c${RESET4}  complete marked task(s)`,
      `${GREEN2}/${RESET4}  search current view`,
      `${GREEN2}v${RESET4}  toggle completed archive`,
      `${GREEN2}Enter${RESET4}  restore selected task in archive`,
      `${GREEN2}r${RESET4}  refresh`,
      `${GREEN2}q${RESET4}  quit`,
      `${DIM4}Press Esc, Enter, ? or q to return${RESET4}`
    ];
  }
  get footerLeft() {
    if (this.mode === "help")
      return `${DIM4}?${RESET4} help`;
    const action = this.view === "pending" ? "complete" : "restore";
    const position = this.tasks.length > 0 ? `${this.selectedIndex + 1}/${this.tasks.length} \xB7 ` : "";
    return this.message.length > 0 ? `${GREEN2}${this.message}${RESET4}` : `${DIM4}${position}\u2191\u2193${RESET4} navigate \xB7 ${DIM4}Enter${RESET4} ${action}`;
  }
  get footerRight() {
    if (this.mode === "help")
      return `${DIM4}q${RESET4} close`;
    return `${DIM4}e${RESET4} edit \xB7 ${DIM4}v${RESET4} archive \xB7 ${DIM4}?${RESET4} help \xB7 ${DIM4}q${RESET4} quit`;
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
  return `${DIM4}\u2502${RESET4} ${left}${padding}${right} ${DIM4}\u2502${RESET4}`;
}
function formatPanelBorder(left, right) {
  return `${DIM4}${left}${"\u2500".repeat(PANEL_WIDTH + 2)}${right}${RESET4}`;
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
function formatWorkspaceTask(task, width) {
  const priority = task.priority === "high" ? `${RED2}high${RESET4}` : task.priority === "medium" ? `${MAUVE}med${RESET4}` : task.priority === "low" ? `${BLUE}low${RESET4}` : `${DIM4}\u2014${RESET4}`;
  const id = `${DIM4}#${task.id.padStart(2, "0")}${RESET4}`;
  const createdAt = formatTaskDate(task.createdAt);
  const updatedAt = formatTaskDate(task.updatedAt);
  const due = formatDueLabel(task);
  const metadataWidth = getVisibleLength(priority) + getVisibleLength(id) + getVisibleLength(createdAt) + getVisibleLength(updatedAt) + getVisibleLength(due) + 12;
  const descriptionWidth = Math.max(12, width - metadataWidth);
  const description = truncateTaskDescription(task.description, descriptionWidth);
  const content = `${fit(priority, 4)} ${id}  ${description}`;
  const padding = " ".repeat(Math.max(1, width - getVisibleLength(content) - getVisibleLength(createdAt) - getVisibleLength(updatedAt) - getVisibleLength(due) - 6));
  return `${content}${padding}${createdAt}  ${updatedAt}  ${due}`;
}
function formatCompactTask(task, width) {
  const id = `${DIM4}#${task.id.padStart(2, "0")}${RESET4}`;
  const updatedAt = `${DIM4}${formatRelativeTime(task.updatedAt)}${RESET4}`;
  const due = formatDueLabel(task);
  const fixedWidth = 4 + 2 + 9 + 2 + 12;
  const description = truncateTaskDescription(task.description, Math.max(12, width - fixedWidth));
  return `${fit(id, 4)}  ${fit(description, Math.max(12, width - fixedWidth))}  ${fit(updatedAt, 9)}  ${fit(due, 12)}`;
}
function formatCompactHeader(width) {
  const fixedWidth = 4 + 2 + 9 + 2 + 12;
  const descriptionWidth = Math.max(12, width - fixedWidth);
  return `${DIM4}  ${fit("ID", 4)}  ${fit("TASK", descriptionWidth)}  ${fit("UPDATED", 9)}  ${fit("DUE", 12)}${RESET4}`;
}
function formatDueLabel(task) {
  if (task.dueDate === undefined)
    return `${DIM4}\u2014${RESET4}`;
  if (isOverdue(task.dueDate))
    return `${RED2}overdue${RESET4}`;
  if (isUpcoming(task.dueDate))
    return `${MAUVE}soon${RESET4}`;
  const date = new Date(task.dueDate);
  const label = isToday(task.dueDate) ? `today ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}` : formatTaskDate(task.dueDate);
  return `${DIM4}${label}${RESET4}`;
}
function formatTaskDate(timestamp) {
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleString(undefined, { month: "short" });
  const time = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  return `${DIM4}${day} ${month} ${time}${RESET4}`;
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
  return `${SELECTED}${value.replaceAll(RESET4, `${RESET4}${SELECTED}`)}${RESET4}`;
}
function formatSplitLine(left, right, leftWidth, rightWidth) {
  return `${DIM4}\u2502${RESET4} ${fit(left, leftWidth)} ${DIM4}\u2502${RESET4} ${fit(right, rightWidth)} ${DIM4}\u2502${RESET4}`;
}
function formatSplitBorder(left, middle, right, leftWidth, rightWidth, leftTitle, rightTitle) {
  const leftSegment = formatBorderSegment(leftWidth + 2, leftTitle);
  const rightSegment = formatBorderSegment(rightWidth + 2, rightTitle);
  return `${DIM4}${left}${leftSegment}${middle}${rightSegment}${right}${RESET4}`;
}
function formatBorderSegment(width, title) {
  if (title === undefined)
    return "\u2500".repeat(width);
  return `\u2500 ${title} ${"\u2500".repeat(Math.max(0, width - title.length - 3))}`;
}
function formatStatusLine(left, right, width) {
  const status = `${BRIGHT}${MAUVE}\u25CF NORMAL${RESET4}`;
  const date = `${DIM4}${new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short" }).format()}${RESET4}`;
  const content = `${status}  ${left}`;
  const padding = " ".repeat(Math.max(1, width - getVisibleLength(content) - getVisibleLength(right) - getVisibleLength(date)));
  return `${DIM4}\u2502${RESET4} ${content}${padding}${right}  ${date} ${DIM4}\u2502${RESET4}`;
}

// src/plugins/lifecycle.ts
var DIM5 = "\x1B[2m";
var GREEN3 = "\x1B[32m";
var RESET5 = "\x1B[0m";
var lifecyclePlugin = {
  name: "lifecycle",
  description: "Completes, edits, and archives tasks.",
  register(app) {
    app.command("done", "Mark a task as completed.", async ({ args, store, stdout }) => {
      const id = requireTaskId(args, "Usage: todo done <id>");
      const tasks = await store.loadTasks();
      const task = tasks.find((candidate) => candidate.id === id);
      if (task === undefined)
        throw new UserInputError(`Task not found: ${id}`);
      if (task.status === "completed") {
        stdout.write(`${DIM5}Task already completed${RESET5}
`);
        return;
      }
      task.status = "completed";
      task.updatedAt = Date.now();
      await store.saveTasks(tasks);
      stdout.write(`${GREEN3}Task marked as completed${RESET5}
`);
    });
    app.command("edit", "Change a task description.", async ({ args, store, stdout }) => {
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
      stdout.write(`${GREEN3}Updated task ${task.id}${RESET5}
`);
    });
    app.command("archive", "List completed tasks.", async ({ args, store, stdout }) => {
      if (args.length > 0)
        throw new UserInputError("Usage: todo archive");
      const tasks = await store.loadTasks();
      const archivedTasks = tasks.filter((task) => task.status === "completed").sort((left, right) => right.updatedAt - left.updatedAt);
      if (archivedTasks.length === 0) {
        stdout.write(`${DIM5}No archived tasks found${RESET5}
`);
        return;
      }
      for (const task of archivedTasks)
        stdout.write(`${formatTaskForDisplay(task)}
`);
    });
  }
};
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
var DIM6 = "\x1B[2m";
var GREEN4 = "\x1B[32m";
var RESET6 = "\x1B[0m";
var removePlugin = {
  name: "remove",
  description: "Removes tasks.",
  register(app) {
    app.command("rm", "Remove tasks by ID, comma list, or inclusive range.", removeById);
    app.command("delete", "Alias for rm.", removeById);
    app.command("rmall", "Remove all pending tasks.", async ({ args, store, stdout }) => {
      if (args.length > 0)
        throw new UserInputError("Usage: todo rmall");
      await removeAllPendingTasks(store, stdout);
    });
  }
};
async function removeById({ args, store, stdout }) {
  if (args.length !== 1 || args[0] === undefined) {
    throw new UserInputError("Usage: todo rm <id[,id|start-end,...]>");
  }
  if (args[0] === "all") {
    await removeAllPendingTasks(store, stdout);
    return;
  }
  const ids = parseTaskIds(args[0]);
  const tasks = await store.loadTasks();
  const matchingIds = new Set(tasks.filter((task) => ids.has(task.id)).map((task) => task.id));
  if (matchingIds.size === 0) {
    throw new UserInputError(`No tasks found with ID(s): ${[...ids].join(", ")}`);
  }
  await store.saveUndo(tasks.filter((task) => matchingIds.has(task.id)));
  await store.saveTasks(tasks.filter((task) => !matchingIds.has(task.id)));
  stdout.write(`${GREEN4}Deleted ${matchingIds.size} task(s)${RESET6}
`);
}
async function removeAllPendingTasks(store, stdout) {
  const tasks = await store.loadTasks();
  const pendingTasks = tasks.filter((task) => task.status === "pending");
  if (pendingTasks.length === 0) {
    stdout.write(`${DIM6}No tasks to delete${RESET6}
`);
    return;
  }
  await store.saveUndo(pendingTasks);
  await store.saveTasks(tasks.filter((task) => task.status !== "pending"));
  stdout.write(`${GREEN4}Deleted ${pendingTasks.length} task(s)${RESET6}
`);
}
function parseTaskIds(value) {
  const ids = new Set;
  for (const part of value.split(",").map((item) => item.trim())) {
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
var DIM7 = "\x1B[2m";
var RESET7 = "\x1B[0m";
var GREEN5 = "\x1B[38;5;166m";
var PANEL_WIDTH2 = 72;
var tasksPlugin = {
  name: "tasks",
  description: "Lists tasks.",
  register(app) {
    app.command("shell-display", "Show pending tasks for shell startup; --limit <n|all> overrides the configured count.", async ({ args, store, stdout }) => {
      const tasks = await store.loadTasks();
      const pendingTasks = tasks.filter((task) => task.status === "pending").sort(compareTasksForShell);
      if (pendingTasks.length === 0) {
        const completedCount = tasks.filter((task) => task.status === "completed").length;
        const completedText = completedCount > 0 ? `${DIM7} \xB7 ${completedCount} completed${RESET7}` : "";
        stdout.write(formatShellPanel([{ left: `${GREEN5}\u2713 All caught up${RESET7}${completedText}`, right: "" }]));
        return;
      }
      const config = await store.loadConfig();
      const limit = resolveShellDisplayLimit(args, config.shellDisplayLimit);
      const now = Date.now();
      const lines = pendingTasks.slice(0, limit).map((task) => formatTaskForShellDisplay(task, now));
      const hiddenTaskCount = pendingTasks.length - lines.length;
      if (hiddenTaskCount > 0) {
        lines.push({
          left: `${DIM7}\u21B3 ${hiddenTaskCount} more task${hiddenTaskCount === 1 ? "" : "s"}${RESET7}`,
          right: `${DIM7}todo config shell-limit all${RESET7}`
        });
      }
      stdout.write(formatShellPanel(lines));
    });
    app.command("list", "List tasks, optionally filtered by --all, --overdue, or --upcoming.", async ({ args, store, stdout }) => {
      if (args[0] === "delete" && args[1] === "all") {
        if (args.length !== 2)
          throw new UserInputError("Usage: todo list delete all");
        await removeAllPendingTasks(store, stdout);
        return;
      }
      const tasks = await store.loadTasks();
      const now = Date.now();
      const filteredTasks = filterTasks(tasks, args[0], now).sort(compareTasks2);
      if (filteredTasks.length === 0) {
        stdout.write(`${DIM7}No tasks found${RESET7}
`);
        return;
      }
      for (const task of filteredTasks) {
        stdout.write(`${formatTaskForDisplay(task, now)}
`);
      }
    });
  }
};
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
function filterTasks(tasks, filter, now) {
  if (filter === "--all")
    return [...tasks];
  const pendingTasks = tasks.filter((task) => task.status === "pending");
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
  return `${DIM7}\u2502${RESET7} ${left}${padding}${right} ${DIM7}\u2502${RESET7}`;
}
function formatPanelBorder2(left, right) {
  return `${DIM7}${left}${"\u2500".repeat(PANEL_WIDTH2 + 2)}${right}${RESET7}`;
}

// src/plugins/builtins.ts
var builtInPlugins = [addPlugin, configPlugin, helpPlugin, interactivePlugin, lifecyclePlugin, removePlugin, tasksPlugin, undoPlugin];

// src/plugins/registry.ts
class PluginRegistry {
  commands = new Map;
  use(plugin) {
    plugin.register(this);
  }
  command(name, description, handler) {
    if (this.commands.has(name)) {
      throw new Error(`Command already registered: ${name}`);
    }
    this.commands.set(name, { description, handler });
  }
  getCommand(name) {
    return this.commands.get(name);
  }
  listCommands() {
    return [...this.commands.entries()].map(([name, command]) => ({ name, description: command.description })).sort((left, right) => left.name.localeCompare(right.name));
  }
}

// src/storage/todo-store.ts
import { mkdir, readFile, rename, unlink, writeFile } from "fs/promises";
import { dirname, join } from "path";

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
  return task;
}
function readStatus(value, index) {
  if (value === "pending" || value === "completed")
    return value;
  throw new Error(`Task at index ${index} has an invalid status`);
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
function getTodoPaths(dataDir = process.env.DOTFILES_DATA_DIR ?? join(process.env.HOME ?? ".", ".dotfiles")) {
  const todoDir = join(dataDir, "todo");
  return {
    dataDir: todoDir,
    tasksFile: join(todoDir, "tasks.json"),
    configFile: join(todoDir, "config.json"),
    undoFile: join(todoDir, "undo.json")
  };
}

class TodoStore {
  paths;
  constructor(paths = getTodoPaths()) {
    this.paths = paths;
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
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}
`, "utf8");
    await rename(temporaryPath, path);
  }
}
function isMissingFile(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/cli.ts
async function run(args) {
  const registry = new PluginRegistry;
  for (const plugin of builtInPlugins)
    registry.use(plugin);
  const store = new TodoStore;
  const config = await store.loadConfig();
  if (config.showNotificationsOnStartup)
    await sendDueNotifications(store);
  const requestedCommandName = args[0];
  const commandName = requestedCommandName === "-h" || requestedCommandName === "--help" ? "help" : requestedCommandName ?? (process.stdin.isTTY && process.stdout.isTTY ? "interactive" : "shell-display");
  const command = registry.getCommand(commandName);
  const addCommand = registry.getCommand("add");
  const useImplicitAdd = command === undefined && args.length > 0 && !commandName.startsWith("--");
  const handler = command?.handler ?? (useImplicitAdd ? addCommand?.handler : undefined);
  if (handler === undefined) {
    process.stderr.write(`Unknown command: ${commandName}
Run 'todo help' for usage.
`);
    process.exitCode = 1;
    return;
  }
  try {
    await runCommand(handler, command === undefined ? args : args.slice(1), registry, store);
  } catch (error) {
    if (!(error instanceof UserInputError))
      throw error;
    process.stderr.write(`${error.message}
`);
    process.exitCode = 1;
  }
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
