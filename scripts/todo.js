#!/usr/bin/env bun
// @bun

// scripts/todo.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import readline from "readline";
var DOTFILES_DATA_DIR = process.env.HOME + "/.dotfiles";
var TODOS_DIR = join(DOTFILES_DATA_DIR, "todo");
var TASKS_FILE = join(TODOS_DIR, "tasks.json");
var CONFIG_FILE = join(TODOS_DIR, "config.json");
var levenshtein = function(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
};
var KNOWN_COMMANDS = ["help", "count", "list", "done", "delete", "rm", "rmall", "edit", "shell-display", "interactive", "archive"];
var normalizeCommand = function(input) {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
};
var stripVowels = function(input) {
  return input.replace(/[aeiou]/g, "");
};
var getBigrams = function(input) {
  if (input.length < 2) return new Set([input]);
  const grams = new Set();
  for (let i = 0; i < input.length - 1; i++) {
    grams.add(input.slice(i, i + 2));
  }
  return grams;
};
var diceCoefficient = function(a, b) {
  const left = getBigrams(a);
  const right = getBigrams(b);
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const gram of left) {
    if (right.has(gram)) overlap++;
  }
  return 2 * overlap / (left.size + right.size);
};
var commonPrefixRatio = function(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  let idx = 0;
  while (idx < a.length && idx < b.length && a[idx] === b[idx]) {
    idx++;
  }
  return idx / maxLen;
};
var subsequenceRatio = function(a, b) {
  if (!a.length || !b.length) return 0;
  let idx = 0;
  for (const char of b) {
    if (idx < a.length && a[idx] === char) {
      idx++;
    }
  }
  return idx / a.length;
};
var hasAdjacentTransposition = function(a, b) {
  if (a.length !== b.length || a.length < 2) return false;
  for (let i = 0; i < a.length - 1; i++) {
    if (a[i] !== b[i]) {
      return a.slice(0, i) + a[i + 1] + a[i] + a.slice(i + 2) === b;
    }
  }
  return false;
};
var scoreCommandMatch = function(input, candidate) {
  const normalizedInput = normalizeCommand(input);
  const normalizedCandidate = normalizeCommand(candidate);
  if (!normalizedInput || !normalizedCandidate) {
    return 0;
  }
  if (normalizedInput === normalizedCandidate) {
    return 1;
  }
  const maxLen = Math.max(normalizedInput.length, normalizedCandidate.length);
  const distance = levenshtein(normalizedInput, normalizedCandidate);
  const editScore = 1 - distance / maxLen;
  const ngramScore = diceCoefficient(normalizedInput, normalizedCandidate);
  const prefixScore = commonPrefixRatio(normalizedInput, normalizedCandidate);
  const subseqScore = subsequenceRatio(normalizedInput, normalizedCandidate);
  const deVoweledInput = stripVowels(normalizedInput);
  const deVoweledCandidate = stripVowels(normalizedCandidate);
  let score = editScore * 0.45 + ngramScore * 0.25 + prefixScore * 0.15 + subseqScore * 0.15;
  if (hasAdjacentTransposition(normalizedInput, normalizedCandidate)) {
    score += 0.08;
  }
  if (normalizedInput.length >= 3 && deVoweledInput === deVoweledCandidate) {
    score += 0.12;
  }
  if (normalizedCandidate.length - normalizedInput.length <= 2 && subseqScore === 1) {
    score += 0.06;
  }
  if (Math.abs(normalizedInput.length - normalizedCandidate.length) > 3) {
    score -= 0.08;
  }
  return Math.max(0, Math.min(1, score));
};
var suggestCorrection = function(input) {
  const normalizedInput = normalizeCommand(input);
  if (normalizedInput.length < 3) {
    return null;
  }
  const ranked = KNOWN_COMMANDS.map((command) => ({
    command,
    score: scoreCommandMatch(input, command)
  })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const runnerUp = ranked[1];
  if (!best) {
    return null;
  }
  const threshold = normalizedInput.length <= 4 ? 0.66 : 0.72;
  const margin = runnerUp ? best.score - runnerUp.score : best.score;
  if (best.score < threshold || margin < 0.06) {
    return null;
  }
  return best.command;
};
var COLORS = {
  RESET: "\x1B[0m",
  BRIGHT: "\x1B[1m",
  DIM: "\x1B[2m",
  RED: "\x1B[31m",
  GREEN: "\x1B[32m",
  YELLOW: "\x1B[33m",
  BLUE: "\x1B[34m",
  MAGENTA: "\x1B[35m",
  CYAN: "\x1B[36m",
  WHITE: "\x1B[37m",
  BG_RED: "\x1B[41m",
  BG_GREEN: "\x1B[42m",
  BG_YELLOW: "\x1B[43m",
  BG_BLUE: "\x1B[44m",
  BG_MAGENTA: "\x1B[45m",
  BG_CYAN: "\x1B[46m",
  TEXT: "\x1B[38;5;231m",
  SUBTEXT1: "\x1B[38;5;224m",
  SUBTEXT0: "\x1B[38;5;217m",
  OVERLAY2: "\x1B[38;5;210m",
  OVERLAY1: "\x1B[38;5;203m",
  OVERLAY0: "\x1B[38;5;196m",
  SURFACE2: "\x1B[38;5;189m",
  SURFACE1: "\x1B[38;5;182m",
  SURFACE0: "\x1B[38;5;175m",
  BASE: "\x1B[38;5;168m",
  MANTLE: "\x1B[38;5;161m",
  CRUST: "\x1B[38;5;154m",
  MAUVE: "\x1B[38;5;147m",
  PINK: "\x1B[38;5;219m",
  RED2: "\x1B[38;5;203m",
  MAROON: "\x1B[38;5;167m",
  PEACH: "\x1B[38;5;208m",
  YELLOW2: "\x1B[38;5;229m",
  GREEN2: "\x1B[38;5;166m",
  TEAL: "\x1B[38;5;150m",
  SKY: "\x1B[38;5;116m",
  SAPPHIRE: "\x1B[38;5;125m",
  BLUE2: "\x1B[38;5;137m",
  LAVENDER: "\x1B[38;5;183m"
};
var PRIORITY = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  NONE: "none"
};
var PRIORITY_COLORS = {
  high: COLORS.RED2,
  medium: COLORS.YELLOW2,
  low: COLORS.SKY,
  none: COLORS.SUBTEXT0
};
var DEFAULT_CONFIG = {
  defaultReminderOffsets: [10, 30, 60],
  showNotificationsOnStartup: true,
  showCompletedTasksByDefault: false,
  visualPreferences: {
    theme: "dark"
  },
  undoTimeout: 30000
};
var UNDO_FILE = join(TODOS_DIR, "undo.json");
function ensureTodosDir() {
  if (!existsSync(TODOS_DIR)) {
    mkdirSync(TODOS_DIR, { recursive: true });
  }
}
function loadTasks() {
  ensureTodosDir();
  if (!existsSync(TASKS_FILE)) {
    return [];
  }
  try {
    const content = readFileSync(TASKS_FILE, "utf8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}
function saveTasks(tasks) {
  ensureTodosDir();
  writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}
function saveUndo(tasks) {
  ensureTodosDir();
  const config = loadConfig();
  const undoData = {
    tasks: tasks,
    timestamp: Date.now(),
    expiresAt: Date.now() + config.undoTimeout
  };
  writeFileSync(UNDO_FILE, JSON.stringify(undoData, null, 2));
}
function loadUndo() {
  if (!existsSync(UNDO_FILE)) return null;
  try {
    const content = readFileSync(UNDO_FILE, "utf8");
    const data = JSON.parse(content);
    if (Date.now() > data.expiresAt) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
function clearUndo() {
  if (existsSync(UNDO_FILE)) {
    const fs = require("fs");
    fs.unlinkSync(UNDO_FILE);
  }
}
function getSnoozeTime(input) {
  const trimmed = input.trim().toLowerCase();
  const now = Date.now();
  const today = new Date;
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  
  const hourMatch = trimmed.match(/^(\d+)\s*(?:h|hour|hours)$/);
  if (hourMatch) return now + parseInt(hourMatch[1]) * 60 * 60 * 1000;
  
  const minMatch = trimmed.match(/^(\d+)\s*(?:m|min|minute|minutes)$/);
  if (minMatch) return now + parseInt(minMatch[1]) * 60 * 1000;
  
  const dayMatch = trimmed.match(/^(\d+)\s*(?:d|day|days)$/);
  if (dayMatch) return now + parseInt(dayMatch[1]) * 24 * 60 * 60 * 1000;
  
  if (trimmed === "tomorrow") {
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow.getTime();
  }
  
  if (trimmed === "monday" || trimmed === "tuesday" || trimmed === "wednesday" || 
      trimmed === "thursday" || trimmed === "friday" || trimmed === "saturday" || trimmed === "sunday") {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const targetDay = days.indexOf(trimmed);
    const currentDay = today.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    const target = new Date(todayStart);
    target.setDate(target.getDate() + daysUntil);
    target.setHours(9, 0, 0, 0);
    return target.getTime();
  }
  
  if (trimmed === "next week") {
    const nextWeek = new Date(todayStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(9, 0, 0, 0);
    return nextWeek.getTime();
  }
  
  return null;
}
function getNextId(tasks) {
  if (tasks.length === 0) return "1";
  const maxId = Math.max(...tasks.map((t) => parseInt(t.id) || 0));
  return (maxId + 1).toString();
}

function loadConfig() {
  ensureTodosDir();
  if (!existsSync(CONFIG_FILE)) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  try {
    const content = readFileSync(CONFIG_FILE, "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch {
    return DEFAULT_CONFIG;
  }
}
function saveConfig(config) {
  ensureTodosDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
function readSingleKey() {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      resolve("");
      return;
    }
    const wasRaw = stdin.isRaw;
    const onData = (buffer) => {
      const key = buffer.toString("utf8");
      cleanup();
      resolve(key);
    };
    const cleanup = () => {
      stdin.off("data", onData);
      if (!wasRaw && stdin.isTTY) {
        stdin.setRawMode(false);
      }
      stdin.pause();
    };
    stdin.resume();
    if (!wasRaw) {
      stdin.setRawMode(true);
    }
    stdin.on("data", onData);
  });
}
async function promptCommandCorrection(input, suggestion) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return null;
  }
  process.stdout.write(`${COLORS.CYAN}Did you mean: ${suggestion}? [Y/n/c] ${COLORS.RESET}`);
  const key = (await readSingleKey()).trim().toLowerCase();
  process.stdout.write("\n");
  if (key === "" || key === "y") {
    return suggestion;
  }
  if (key === "n") {
    return null;
  }
  if (key === "c") {
    const custom = (await prompt(colorizeCommandPrompt(input))).trim();
    return custom || null;
  }
  return null;
}
function colorizeCommandPrompt(input) {
  return `${COLORS.CYAN}Custom command for "${input}": ${COLORS.RESET}`;
}
function parseTime(input) {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "0") {
    return null;
  }
  const now = Date.now();
  const today = new Date;
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const hourMatch = trimmed.match(/^(\d+)\s*(?:h|hour|hours)$/);
  if (hourMatch) {
    return now + parseInt(hourMatch[1]) * 60 * 60 * 1000;
  }
  const minMatch = trimmed.match(/^(\d+)\s*(?:min|minute|minutes)$/);
  if (minMatch) {
    return now + parseInt(minMatch[1]) * 60 * 1000;
  }
  const dayMatch = trimmed.match(/^(\d+)\s*(?:d|day|days)$/);
  if (dayMatch) {
    return now + parseInt(dayMatch[1]) * 24 * 60 * 60 * 1000;
  }
  const weekMatch = trimmed.match(/^(\d+)\s*(?:w|week|weeks)$/);
  if (weekMatch) {
    return now + parseInt(weekMatch[1]) * 7 * 24 * 60 * 60 * 1000;
  }
  const inMatch = trimmed.match(/^in\s+(.+)$/);
  if (inMatch) {
    return parseTime(inMatch[1]);
  }
  if (trimmed === "tomorrow") {
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.getTime();
  }
  if (trimmed === "this week") {
    const sunday = new Date(todayStart);
    const dayOfWeek = sunday.getDay();
    const daysUntilSunday = (7 - dayOfWeek) % 7 || 7;
    sunday.setDate(sunday.getDate() + daysUntilSunday);
    return sunday.getTime();
  }
  const amPmMatch = trimmed.match(/^(\d+)\s*(am|pm)$/);
  if (amPmMatch) {
    let hours = parseInt(amPmMatch[1]);
    const period = amPmMatch[2];
    if (period === "pm" && hours !== 12)
      hours += 12;
    if (period === "am" && hours === 12)
      hours = 0;
    const target = new Date(todayStart);
    target.setHours(hours, 0, 0, 0);
    if (target.getTime() < now) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const target = new Date(todayStart);
    target.setHours(hours, minutes, 0, 0);
    if (target.getTime() < now) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }
  const dateTimeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (dateTimeMatch) {
    const dateStr = dateTimeMatch[1];
    const hours = dateTimeMatch[2] ? parseInt(dateTimeMatch[2]) : 0;
    const minutes = dateTimeMatch[3] ? parseInt(dateTimeMatch[3]) : 0;
    const target = new Date(dateStr);
    target.setHours(hours, minutes, 0, 0);
    return target.getTime();
  }
  return null;
}
function formatTimeRemaining(timestamp) {
  const now = Date.now();
  const diff = timestamp - now;
  const absDiff = Math.abs(diff);
  if (diff < 0) {
    const minutes = Math.floor(absDiff / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) {
      return `${days}d overdue`;
    } else if (hours > 0) {
      return `${hours}h overdue`;
    } else {
      return `${minutes} min ago`;
    }
  } else {
    const minutes = Math.floor(absDiff / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) {
      const remainingHours = hours % 24;
      const remainingMinutes = minutes % 60;
      const parts = [];
      if (days > 0)
        parts.push(`${days}d`);
      if (remainingHours > 0)
        parts.push(`${remainingHours}h`);
      if (remainingMinutes > 0 && days === 0)
        parts.push(`${remainingMinutes}m`);
      return `in ${parts.join(" ")}`;
    } else if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `in ${hours}h ${remainingMinutes}m` : `in ${hours}h`;
    } else {
      return `in ${minutes}m`;
    }
  }
}
function formatDueDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getTime() >= today.getTime() && date.getTime() < tomorrow.getTime()) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `today ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  } else if (date.getTime() >= tomorrow.getTime() && date.getTime() < tomorrow.getTime() + 24 * 60 * 60 * 1000) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `tomorrow ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  } else {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
}
function isUpcoming(timestamp) {
  const now = Date.now();
  const diff = timestamp - now;
  return diff > 0 && diff < 30 * 60 * 1000;
}
function isOverdue(timestamp) {
  return timestamp < Date.now();
}
function sendNotification(title, message) {
  try {
    spawnSync("notify-send", [title, message], { stdio: "ignore" });
  } catch {}
}
function checkAndSendNotifications(tasks) {
  const now = Date.now();
  for (const task of tasks) {
    if (task.status !== "pending" || !task.dueDate)
      continue;
    if (isOverdue(task.dueDate) && !task.notificationsSent.overdue) {
      sendNotification("Task Overdue", `${task.description} - due ${formatDueDate(task.dueDate)}`);
      task.notificationsSent.overdue = true;
    }
    for (const offset of task.reminderOffsets) {
      const reminderTime = task.dueDate - offset * 60 * 1000;
      if (now >= reminderTime && !task.notificationsSent.reminders.includes(offset)) {
        sendNotification("Task Reminder", `${task.description} - due in ${offset} minutes`);
        task.notificationsSent.reminders.push(offset);
      }
    }
  }
  saveTasks(tasks);
}
function getUrgencyColor(timestamp) {
  if (!timestamp)
    return COLORS.SUBTEXT0;
  if (isOverdue(timestamp)) {
    return COLORS.RED2;
  } else if (isUpcoming(timestamp)) {
    return COLORS.YELLOW2;
  } else {
    const now = Date.now();
    const diff = timestamp - now;
    const hours = diff / (60 * 60 * 1000);
    if (hours < 2) {
      return COLORS.PEACH;
    } else {
      return COLORS.SUBTEXT0;
    }
  }
}
function formatTaskForDisplay(task, showId = false) {
  const parts = [];
  if (task.dueDate) {
    if (isUpcoming(task.dueDate)) {
      parts.push(`${COLORS.YELLOW2}[UPCOMING]${COLORS.RESET}`);
    } else if (isOverdue(task.dueDate)) {
      parts.push(`${COLORS.RED2}[OVERDUE]${COLORS.RESET}`);
    }
  }
  if (task.priority && task.priority !== PRIORITY.NONE && task.priority !== "none") {
    parts.push(`${PRIORITY_COLORS[task.priority] || COLORS.SUBTEXT0}[${task.priority.toUpperCase()}]${COLORS.RESET}`);
  }
  const color = getUrgencyColor(task.dueDate);
  parts.push(`${color}${task.description}${COLORS.RESET}`);
  if (task.dueDate) {
    const timeStr = formatTimeRemaining(task.dueDate);
    parts.push(`${COLORS.DIM}- due ${timeStr}${COLORS.RESET}`);
  }
  if (showId) {
    parts.push(`${COLORS.DIM}(${task.id})${COLORS.RESET}`);
  }
  return parts.join(" ");
}
function displayTasksForShell(tasks) {
  const pending = tasks.filter((t) => t.status === "pending");
  if (pending.length === 0)
    return;

  // Sort by due date first, then creation date
  pending.sort((a, b) => {
    if (a.dueDate && b.dueDate)
      return a.dueDate - b.dueDate;
    if (a.dueDate)
      return -1;
    if (b.dueDate)
      return 1;
    return a.createdAt - b.createdAt;
  });

  // Limit to 5 tasks max
  const displayTasks = pending.slice(0, 5);
  const hasMore = pending.length > 5;

  console.log(`${COLORS.BRIGHT}${COLORS.MAUVE}📋 Tasks (${pending.length})${COLORS.RESET}`);

  for (const task of displayTasks) {
    const createdDate = new Date(task.createdAt);
    const createdStr = createdDate.toLocaleDateString() + " " + createdDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const parts = [];

    // Status prefix
    if (task.dueDate) {
      if (isUpcoming(task.dueDate)) {
        parts.push(`${COLORS.YELLOW2}[UPCOMING]${COLORS.RESET}`);
      } else if (isOverdue(task.dueDate)) {
        parts.push(`${COLORS.RED2}[OVERDUE]${COLORS.RESET}`);
      }
    }

    // Description (truncate to 50 chars max for single line)
    const color = getUrgencyColor(task.dueDate);
    let description = task.description;
    if (description.length > 50) {
      description = description.substring(0, 47) + "...";
    }
    parts.push(`${color}${description}${COLORS.RESET}`);

    // Due date
    if (task.dueDate) {
      const timeStr = formatTimeRemaining(task.dueDate);
      parts.push(`${COLORS.DIM}- due ${timeStr}${COLORS.RESET}`);
    }

    // Created timestamp (shortened format)
    const shortDate = createdDate.toLocaleDateString() + " " + createdDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    parts.push(`${COLORS.DIM}(${shortDate})${COLORS.RESET}`);

    console.log(`  ${parts.join(" ")}`);
  }

  if (hasMore) {
    console.log(`  ${COLORS.DIM}... and ${pending.length - 5} more tasks${COLORS.RESET}`);
  }
}

class TodoTUI {
  rl;
  selectedIndex = 0;
  tasks = [];
  filteredTasks = [];
  searchQuery = "";
  isSearching = false;
  selectedTasks = new Set;
  currentView = "main";
  constructor() {
    // Create readline interface but don't use it for key events
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Enable keypress events
    readline.emitKeypressEvents(process.stdin);

    // Set raw mode for immediate key input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      // Ensure stdin is in the correct state
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
    }
  }
  loadTasks() {
    this.tasks = loadTasks();
    this.filteredTasks = this.tasks.filter((t) => t.status === "pending" || loadConfig().showCompletedTasksByDefault);
    this.sortTasks();
  }
  sortTasks() {
    const priorityOrder = { [PRIORITY.HIGH]: 0, [PRIORITY.MEDIUM]: 1, [PRIORITY.LOW]: 2, [PRIORITY.NONE]: 3 };
    this.filteredTasks.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === "pending")
          return -1;
        if (b.status === "pending")
          return 1;
      }
      const pa = priorityOrder[a.priority] ?? 3;
      const pb = priorityOrder[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      if (a.dueDate && b.dueDate) {
        return a.dueDate - b.dueDate;
      }
      if (a.dueDate)
        return -1;
      if (b.dueDate)
        return 1;
      return a.createdAt - b.createdAt;
    });
  }
  clearScreen() {
    process.stdout.write("\x1B[2J\x1B[0f");
  }
  renderMainMenu() {
    this.clearScreen();
    const letterT = [
      "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557",
      "\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D",
      "   \u2588\u2588\u2551   ",
      "   \u2588\u2588\u2551   ",
      "   \u2588\u2588\u2551   ",
      "   \u255A\u2550\u255D   "
    ];
    const letterO = [
      " \u2588\u2588\u2588\u2588\u2588\u2588\u2557 ",
      "\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557",
      "\u2588\u2588\u2551   \u2588\u2588\u2551",
      "\u2588\u2588\u2551   \u2588\u2588\u2551",
      "\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D",
      " \u255A\u2550\u2550\u2550\u2550\u2550\u255D "
    ];
    const letterD = [
      "\u2588\u2588\u2588\u2588\u2588\u2588\u2557  ",
      "\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557 ",
      "\u2588\u2588\u2551  \u2588\u2588\u2551 ",
      "\u2588\u2588\u2551  \u2588\u2588\u2551 ",
      "\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D ",
      "\u255A\u2550\u2550\u2550\u2550\u2550\u255D  "
    ];
    const letterS = [
      " \u2588\u2588\u2588\u2588\u2588\u2588\u2557 ",
      "\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D ",
      "\u255A\u2588\u2588\u2588\u2588\u2588\u2557  ",
      " \u255A\u2550\u2550\u2550\u2588\u2588\u2557 ",
      "\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D ",
      "\u255A\u2550\u2550\u2550\u2550\u2550\u255D  "
    ];
    const letters = [letterT, letterO, letterD, letterO, letterS];
    const bannerColors = [COLORS.PINK, COLORS.MAUVE, COLORS.SKY, COLORS.PEACH, COLORS.YELLOW2, COLORS.RED2];
    const asciiBanner = Array.from({ length: 6 }, (_, row) => {
      const rowText = letters.map((letter) => letter[row]).join("  ");
      return `${bannerColors[row]}${rowText}${COLORS.RESET}`;
    });
    asciiBanner.forEach((line) => console.log(line));
    console.log("");
    const menuItems = [
      "(1) Create todo",
      "(2) Delete todo",
      "(3) Edit todo",
      "(4) List todos",
      "(5) Archive",
      "(6) Help",
      "(7) Exit"
    ];
    menuItems.forEach((item, index) => {
      const isSelected = this.selectedIndex === index;
      const prefix = isSelected ? `${COLORS.BG_BLUE}${COLORS.BRIGHT} \u25B6 ` : "   ";
      const suffix = isSelected ? ` ${COLORS.RESET}` : "";
      console.log(`${prefix}${item}${suffix}`);
    });
    console.log(`
  ${COLORS.DIM}Use arrow keys or number keys (1-7) to navigate${COLORS.RESET}`);
  }
  renderTaskList(title, showActions = true) {
    this.clearScreen();
    console.log(`${COLORS.BRIGHT}${COLORS.MAUVE}${title}${COLORS.RESET}
`);
    if (this.isSearching) {
      console.log(`${COLORS.CYAN}Search: ${this.searchQuery}${COLORS.RESET}
`);
    }
    if (this.filteredTasks.length === 0) {
      console.log(`${COLORS.DIM}No tasks found${COLORS.RESET}
`);
    } else {
      const startIdx = Math.max(0, this.selectedIndex - 9);
      const endIdx = Math.min(this.filteredTasks.length, startIdx + 10);
      for (let i = startIdx;i < endIdx; i++) {
        const task = this.filteredTasks[i];
        const isSelected = this.selectedIndex === i;
        const isMarked = this.selectedTasks.has(i);
        let prefix = "   ";
        if (isSelected) {
          prefix = `${COLORS.BG_BLUE}${COLORS.BRIGHT} \u25B6 `;
        } else if (isMarked) {
          prefix = `${COLORS.GREEN} \u2713 `;
        }
        const suffix = isSelected ? ` ${COLORS.RESET}` : "";
        const taskStr = formatTaskForDisplay(task, true);
        console.log(`${prefix}${taskStr}${suffix}`);
      }
    }
    if (showActions) {
      console.log(`
 ${COLORS.YELLOW2}[jk]${COLORS.DIM}/Arrows: Nav | ${COLORS.YELLOW2}[Space]${COLORS.DIM}: Select | ${COLORS.YELLOW2}[c]${COLORS.DIM}: Done | ${COLORS.YELLOW2}[e]${COLORS.DIM}: Edit | ${COLORS.YELLOW2}[d]${COLORS.DIM}: Delete
 ${COLORS.YELLOW2}[u]${COLORS.DIM}: Undo | ${COLORS.YELLOW2}[s]${COLORS.DIM}: Snooze | ${COLORS.YELLOW2}[p]${COLORS.DIM}: Priority | ${COLORS.YELLOW2}[t]${COLORS.DIM}: Due | ${COLORS.YELLOW2}[/]${COLORS.DIM}: Search | ${COLORS.YELLOW2}[Esc]${COLORS.DIM}: Back${COLORS.RESET}`);
    }
  }
  async promptInput(prompt) {
    return new Promise((resolve) => {
      // Disable raw mode for readline questions
      if (process.stdin.isTTY && process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
      }

      this.rl.question(prompt, (answer) => {
        // Re-enable raw mode after getting answer
        if (process.stdin.isTTY && process.stdin.setRawMode) {
          process.stdin.setRawMode(true);
          process.stdin.resume();
        }
        resolve(answer.trim());
      });
    });
  }
  async createTodo() {
    this.clearScreen();
    console.log(`${COLORS.BRIGHT}${COLORS.MAUVE}Create Todo${COLORS.RESET}
`);
    const description = await this.promptInput("Enter todo description: ");
    if (!description) {
      return;
    }
    let dueDate = null;
    while (true) {
      const dueInput = await this.promptInput("Enter due date (0 for none): ");
      const parsed = parseTime(dueInput);
      if (parsed !== null || dueInput === "0") {
        dueDate = parsed || undefined;
        break;
      } else {
        console.log(`${COLORS.RED}Invalid time format. Examples: 1h, 2h, 10min, tomorrow, 15pm, 12:30${COLORS.RESET}`);
      }
    }
    const priorityInput = await this.promptInput("Priority (h=high, m=medium, l=low, n=none) [n]: ");
    let priority = PRIORITY.NONE;
    if (priorityInput.toLowerCase() === "h") priority = PRIORITY.HIGH;
    else if (priorityInput.toLowerCase() === "m") priority = PRIORITY.MEDIUM;
    else if (priorityInput.toLowerCase() === "l") priority = PRIORITY.LOW;
    console.log(`
 ${COLORS.CYAN}Preview:${COLORS.RESET}`);
    console.log(`Description: ${description}`);
    console.log(`Due: ${dueDate ? formatDueDate(dueDate) : "None"}`);
    console.log(`Priority: ${priority !== PRIORITY.NONE ? priority.toUpperCase() : "None"}`);
    const confirm = (await this.promptInput(`
Add this task? (Y/n): `)).toLowerCase();
    if (confirm && confirm !== "y") {
      return;
    }
    const wantReminders = await this.promptInput("Receive system notification reminder? (Y/n): ");
    let reminderOffsets = [];
    if (wantReminders.toLowerCase() !== "n" && dueDate) {
      const reminderInput = await this.promptInput("Remind how many minutes before due time? ");
      const cleaned = reminderInput.replace(/[\[\]]/g, "");
      const offsets = cleaned.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
      reminderOffsets = offsets.length > 0 ? offsets : loadConfig().defaultReminderOffsets;
    }
    const task = {
      id: getNextId(this.tasks),
      description,
      dueDate,
      priority,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "pending",
      reminderOffsets,
      notificationsSent: { reminders: [] }
    };
    this.tasks.push(task);
    saveTasks(this.tasks);
    this.loadTasks();
    console.log(`${COLORS.GREEN}Task created successfully!${COLORS.RESET}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  async deleteTodos() {
    this.selectedTasks.clear();
    this.selectedIndex = 0;
    this.filteredTasks = this.tasks.filter((t) => t.status === "pending");
    this.sortTasks();
    return new Promise((resolve) => {
      const handleKeypress = async (str, key) => {
        // Debug: uncomment to see what keys are being received
        // console.log('Key received:', { str, key });

        if (key.name === "escape") {
          process.stdin.removeListener("keypress", handleKeypress);
          resolve();
          return;
        }
        if (key.name === "up" || key.name === "k") {
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          this.renderTaskList("Delete Todos");
        } else if (key.name === "down" || key.name === "j") {
          this.selectedIndex = Math.min(this.filteredTasks.length - 1, this.selectedIndex + 1);
          this.renderTaskList("Delete Todos");
        } else if (key.name === "space") {
          if (this.selectedTasks.has(this.selectedIndex)) {
            this.selectedTasks.delete(this.selectedIndex);
          } else {
            this.selectedTasks.add(this.selectedIndex);
          }
          this.renderTaskList("Delete Todos");
        } else if (key.name === "a" && !key.ctrl) {
          for (let i = 0;i < this.filteredTasks.length; i++) {
            this.selectedTasks.add(i);
          }
          this.renderTaskList("Delete Todos");
        } else if (key.name === "e") {
          const task = this.filteredTasks[this.selectedIndex];
          if (task) {
            process.stdin.removeListener("keypress", handleKeypress);
            await this.editTaskDetails(task);
            resolve();
          }
        } else if (key.name === "d") {
          const task = this.filteredTasks[this.selectedIndex];
          if (task) {
            this.tasks = this.tasks.filter((t) => t.id !== task.id);
            saveTasks(this.tasks);
            this.loadTasks();
            console.log(`${COLORS.GREEN}Task deleted${COLORS.RESET}`);
            await new Promise((r) => setTimeout(r, 1000));
            process.stdin.removeListener("keypress", handleKeypress);
            resolve();
          }
        } else if (key.name === "r") {
          const task = this.filteredTasks[this.selectedIndex];
          if (task) {
            task.status = task.status === "completed" ? "pending" : "completed";
            task.updatedAt = Date.now();
            saveTasks(this.tasks);
            this.loadTasks();
            this.renderTaskList("Delete Todos");
          }
        } else if (key.name === "return") {
          if (this.selectedTasks.size > 0) {
            const toDelete = Array.from(this.selectedTasks).map((i) => this.filteredTasks[i].id);
            this.tasks = this.tasks.filter((t) => !toDelete.includes(t.id));
            saveTasks(this.tasks);
            this.loadTasks();
            console.log(`${COLORS.GREEN}Deleted ${toDelete.length} task(s)${COLORS.RESET}`);
            await new Promise((r) => setTimeout(r, 1000));
          }
          process.stdin.removeListener("keypress", handleKeypress);
          resolve();
        }
      };
      process.stdin.on("keypress", handleKeypress);
      this.renderTaskList("Delete Todos");
    });
  }
  async editTodo() {
    this.selectedIndex = 0;
    this.filteredTasks = this.tasks.filter((t) => t.status === "pending");
    this.sortTasks();
    return new Promise((resolve) => {
      const handleKeypress = async (str, key) => {
        // Debug: uncomment to see what keys are being received
        // console.log('Key received:', { str, key });

        if (key.name === "escape") {
          process.stdin.removeListener("keypress", handleKeypress);
          resolve();
          return;
        }
        if (key.name === "up" || key.name === "k") {
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          this.renderTaskList("Edit Todo");
        } else if (key.name === "down" || key.name === "j") {
          this.selectedIndex = Math.min(this.filteredTasks.length - 1, this.selectedIndex + 1);
          this.renderTaskList("Edit Todo");
        } else if (key.name === "d") {
          const task = this.filteredTasks[this.selectedIndex];
          if (task) {
            this.tasks = this.tasks.filter((t) => t.id !== task.id);
            saveTasks(this.tasks);
            this.loadTasks();
            console.log(`${COLORS.GREEN}Task deleted${COLORS.RESET}`);
            await new Promise((r) => setTimeout(r, 1000));
            process.stdin.removeListener("keypress", handleKeypress);
            resolve();
          }
        } else if (key.name === "r") {
          const task = this.filteredTasks[this.selectedIndex];
          if (task) {
            task.status = task.status === "completed" ? "pending" : "completed";
            task.updatedAt = Date.now();
            saveTasks(this.tasks);
            this.loadTasks();
            this.renderTaskList("Edit Todo");
          }
        } else if (key.name === "return") {
          const task = this.filteredTasks[this.selectedIndex];
          if (task) {
            process.stdin.removeListener("keypress", handleKeypress);
            await this.editTaskDetails(task);
            resolve();
          }
        }
      };
      process.stdin.on("keypress", handleKeypress);
      this.renderTaskList("Edit Todo");
    });
  }
  async listTodos() {
    this.selectedIndex = 0;
    this.isSearching = false;
    this.searchQuery = "";
    this.selectedTasks.clear();
    this.filteredTasks = this.tasks.filter((t) => t.status === "pending" || loadConfig().showCompletedTasksByDefault);
    this.sortTasks();
    return new Promise((resolve) => {
      const handleKeypress = async (str, key) => {
        if (key.name === "escape") {
          if (this.isSearching) {
            this.isSearching = false;
            this.searchQuery = "";
            this.loadTasks();
            this.renderTaskList("List Todos");
            return;
          }
          process.stdin.removeListener("keypress", handleKeypress);
          resolve();
          return;
        }
        if (this.isSearching) {
          if (key.name === "return") {
            this.isSearching = false;
            this.applySearch();
            this.renderTaskList("List Todos");
          } else if (key.name === "backspace") {
            this.searchQuery = this.searchQuery.slice(0, -1);
            this.applySearch();
            this.renderTaskList("Search Tasks");
          } else if (str && str.length === 1 && !key.ctrl) {
            this.searchQuery += str;
            this.applySearch();
            this.renderTaskList("Search Tasks");
          }
          return;
        }
        if (key.name === "up" || key.name === "k") {
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          this.renderTaskList("List Todos");
        } else if (key.name === "down" || key.name === "j") {
          this.selectedIndex = Math.min(this.filteredTasks.length - 1, this.selectedIndex + 1);
          this.renderTaskList("List Todos");
        } else if (key.name === "space") {
          if (this.selectedTasks.has(this.selectedIndex)) {
            this.selectedTasks.delete(this.selectedIndex);
          } else {
            this.selectedTasks.add(this.selectedIndex);
          }
          this.renderTaskList("List Todos");
        } else if (key.name === "a" && !key.ctrl) {
          for (let i = 0; i < this.filteredTasks.length; i++) {
            this.selectedTasks.add(i);
          }
          this.renderTaskList("List Todos");
        } else if (key.name === "c") {
          if (this.selectedTasks.size > 0) {
            const toComplete = Array.from(this.selectedTasks).map((i) => this.filteredTasks[i].id);
            for (const id of toComplete) {
              const t = this.tasks.find((t2) => t2.id === id);
              if (t) {
                t.status = "completed";
                t.updatedAt = Date.now();
              }
            }
            saveTasks(this.tasks);
            this.loadTasks();
            this.selectedTasks.clear();
            console.log(`${COLORS.GREEN}Completed ${toComplete.length} task(s)${COLORS.RESET}`);
            await new Promise((r) => setTimeout(r, 1000));
          } else {
            const task = this.filteredTasks[this.selectedIndex];
            if (task) {
              task.status = "completed";
              task.updatedAt = Date.now();
              saveTasks(this.tasks);
              this.loadTasks();
              console.log(`${COLORS.GREEN}Task completed${COLORS.RESET}`);
              await new Promise((r) => setTimeout(r, 1000));
            }
          }
          this.renderTaskList("List Todos");
        } else if (key.name === "r") {
          const task = this.filteredTasks[this.selectedIndex];
          if (task) {
            task.status = task.status === "completed" ? "pending" : "completed";
            task.updatedAt = Date.now();
            saveTasks(this.tasks);
            this.loadTasks();
            this.renderTaskList("List Todos");
          }
        } else if (key.name === "s") {
          const task = this.filteredTasks[this.selectedIndex];
          if (task) {
            process.stdin.removeListener("keypress", handleKeypress);
            await this.snoozeTask(task);
            process.stdin.on("keypress", handleKeypress);
            this.renderTaskList("List Todos");
          }
        } else if (key.name === "p") {
          const task = this.filteredTasks[this.selectedIndex];
          if (task) {
            process.stdin.removeListener("keypress", handleKeypress);
            await this.setPriority(task);
            saveTasks(this.tasks);
            this.loadTasks();
            this.renderTaskList("List Todos");
            process.stdin.on("keypress", handleKeypress);
          }
        } else if (key.name === "t") {
          const task = this.filteredTasks[this.selectedIndex];
          if (task) {
            process.stdin.removeListener("keypress", handleKeypress);
            await this.quickDueDate(task);
            saveTasks(this.tasks);
            this.loadTasks();
            this.renderTaskList("List Todos");
            process.stdin.on("keypress", handleKeypress);
          }
        } else if (key.name === "d") {
          const task = this.filteredTasks[this.selectedIndex];
          if (task) {
            saveUndo([task]);
            this.tasks = this.tasks.filter((t) => t.id !== task.id);
            saveTasks(this.tasks);
            this.loadTasks();
            console.log(`${COLORS.GREEN}Task deleted (${COLORS.YELLOW2}press u to undo${COLORS.GREEN})${COLORS.RESET}`);
            await new Promise((r) => setTimeout(r, 1500));
            this.renderTaskList("List Todos");
          }
        } else if (key.name === "u") {
          const undoData = loadUndo();
          if (undoData && undoData.tasks && undoData.tasks.length > 0) {
            for (const restoredTask of undoData.tasks) {
              restoredTask.id = getNextId(this.tasks);
              this.tasks.push(restoredTask);
            }
            saveTasks(this.tasks);
            this.loadTasks();
            clearUndo();
            console.log(`${COLORS.GREEN}Task restored!${COLORS.RESET}`);
            await new Promise((r) => setTimeout(r, 1000));
          } else {
            console.log(`${COLORS.DIM}Nothing to undo${COLORS.RESET}`);
            await new Promise((r) => setTimeout(r, 1000));
          }
          this.renderTaskList("List Todos");
        } else if (key.name === "/") {
          this.isSearching = true;
          this.searchQuery = "";
          this.renderTaskList("Search Tasks");
        } else if (key.name === "return" || key.name === "e") {
          const task = this.filteredTasks[this.selectedIndex];
          if (task) {
            process.stdin.removeListener("keypress", handleKeypress);
            await this.editTaskDetails(task);
            resolve();
          }
        }
      };
      process.stdin.on("keypress", handleKeypress);
      this.renderTaskList("List Todos");
    });
  }
  applySearch() {
    if (!this.searchQuery) {
      this.filteredTasks = this.tasks.filter((t) => t.status === "pending" || loadConfig().showCompletedTasksByDefault);
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredTasks = this.tasks.filter((t) => 
        (t.status === "pending" || loadConfig().showCompletedTasksByDefault) &&
        (t.description.toLowerCase().includes(query) || (t.priority && t.priority.includes(query)))
      );
    }
    this.sortTasks();
  }
  async snoozeTask(task) {
    this.clearScreen();
    console.log(`${COLORS.BRIGHT}${COLORS.MAUVE}Snooze Task${COLORS.RESET}
`);
    console.log(`Task: ${task.description}
`);
    console.log(`${COLORS.DIM}Snooze options:${COLORS.RESET}`);
    console.log(`  1h  - 1 hour`);
    console.log(`  3h  - 3 hours`);
    console.log(`  tomorrow - tomorrow 9am`);
    console.log(`  monday...sunday - next specific day 9am`);
    console.log(`  next week - next week 9am`);
    const input = await this.promptInput("Snooze until: ");
    const snoozeTime = getSnoozeTime(input);
    if (snoozeTime) {
      task.dueDate = snoozeTime;
      task.notificationsSent = { reminders: [], overdue: false };
      task.updatedAt = Date.now();
      console.log(`${COLORS.GREEN}Snoozed to ${formatDueDate(snoozeTime)}${COLORS.RESET}`);
    } else {
      console.log(`${COLORS.RED}Invalid snooze time${COLORS.RESET}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  async setPriority(task) {
    this.clearScreen();
    console.log(`${COLORS.BRIGHT}${COLORS.MAUVE}Set Priority${COLORS.RESET}
`);
    console.log(`Task: ${task.description}
`);
    console.log(`Current: ${task.priority || PRIORITY.NONE}
`);
    const input = await this.promptInput("Priority (h=high, m=medium, l=low, n=none): ");
    if (input.toLowerCase() === "h") task.priority = PRIORITY.HIGH;
    else if (input.toLowerCase() === "m") task.priority = PRIORITY.MEDIUM;
    else if (input.toLowerCase() === "l") task.priority = PRIORITY.LOW;
    else task.priority = PRIORITY.NONE;
    task.updatedAt = Date.now();
    console.log(`${COLORS.GREEN}Priority set to ${task.priority.toUpperCase()}${COLORS.RESET}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  async quickDueDate(task) {
    this.clearScreen();
    console.log(`${COLORS.BRIGHT}${COLORS.MAUVE}Quick Due Date${COLORS.RESET}
`);
    console.log(`Task: ${task.description}
`);
    console.log(`Current: ${task.dueDate ? formatDueDate(task.dueDate) : "None"}
`);
    console.log(`${COLORS.DIM}Quick options: 1h, 2h, tomorrow, monday, this week${COLORS.RESET}`);
    const input = await this.promptInput("New due date: ");
    if (input === "0" || input.toLowerCase() === "none") {
      task.dueDate = undefined;
      console.log(`${COLORS.GREEN}Due date cleared${COLORS.RESET}`);
    } else {
      const parsed = parseTime(input);
      if (parsed) {
        task.dueDate = parsed;
        task.notificationsSent = { reminders: [], overdue: false };
        console.log(`${COLORS.GREEN}Due date set to ${formatDueDate(parsed)}${COLORS.RESET}`);
      } else {
        console.log(`${COLORS.RED}Invalid date format${COLORS.RESET}`);
      }
    }
    task.updatedAt = Date.now();
    await new Promise((r) => setTimeout(r, 1500));
  }
  async editTaskDetails(task) {
    this.clearScreen();
    console.log(`${COLORS.BRIGHT}${COLORS.MAUVE}Edit Todo${COLORS.RESET}
`);
    console.log(`Current: ${task.description}
`);
    const description = await this.promptInput("Enter new description (or press Enter to keep): ");
    if (description) {
      task.description = description;
    }
    console.log(`
Current due date: ${task.dueDate ? formatDueDate(task.dueDate) : "None"}`);
    const dueInput = await this.promptInput("Enter new due date (0 for none, Enter to keep): ");
    if (dueInput) {
      if (dueInput === "0") {
        task.dueDate = undefined;
      } else {
        const parsed = parseTime(dueInput);
        if (parsed !== null) {
          task.dueDate = parsed;
        } else {
          console.log(`${COLORS.RED}Invalid time format${COLORS.RESET}`);
        }
      }
    }
    task.updatedAt = Date.now();
    saveTasks(this.tasks);
    this.loadTasks();
    console.log(`${COLORS.GREEN}Task updated!${COLORS.RESET}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  showHelp() {
    this.clearScreen();
    console.log(`${COLORS.BRIGHT}${COLORS.MAUVE}Help${COLORS.RESET}
`);
    console.log(`${COLORS.BRIGHT}Navigation:${COLORS.RESET}`);
    console.log(`  ${COLORS.YELLOW2}[↑↓/jk]${COLORS.RESET} Move selection`);
    console.log(`  ${COLORS.YELLOW2}[1-7]${COLORS.RESET} Select menu option`);
    console.log(`  ${COLORS.YELLOW2}[Enter]${COLORS.RESET} Confirm`);
    console.log(`  ${COLORS.YELLOW2}[Esc]${COLORS.RESET} Go back
`);
    console.log(`${COLORS.BRIGHT}Task List Actions:${COLORS.RESET}`);
    console.log(`  ${COLORS.YELLOW2}[e]${COLORS.RESET} Edit task`);
    console.log(`  ${COLORS.YELLOW2}[d]${COLORS.RESET} Delete task`);
    console.log(`  ${COLORS.YELLOW2}[u]${COLORS.RESET} Undo delete`);
    console.log(`  ${COLORS.YELLOW2}[r]${COLORS.RESET} Toggle complete`);
    console.log(`  ${COLORS.YELLOW2}[c]${COLORS.RESET} Complete task(s)`);
    console.log(`  ${COLORS.YELLOW2}[s]${COLORS.RESET} Snooze task`);
    console.log(`  ${COLORS.YELLOW2}[p]${COLORS.RESET} Set priority`);
    console.log(`  ${COLORS.YELLOW2}[t]${COLORS.RESET} Quick due date`);
    console.log(`  ${COLORS.YELLOW2}[Space]${COLORS.RESET} Toggle selection`);
    console.log(`  ${COLORS.YELLOW2}[a]${COLORS.RESET} Select all`);
    console.log(`  ${COLORS.YELLOW2}[/]${COLORS.RESET} Search
`);
    console.log(`${COLORS.BRIGHT}Time Formats:${COLORS.RESET}`);
    console.log(`  Relative: 1h, 2h, 10min, 1d, 1w, in 2h`);
    console.log(`  Clock: 12am, 3pm, 12:30, 15:00`);
    console.log(`  Special: tomorrow, this week`);
    console.log(`  Date: 2025-11-10 14:30
`);
    console.log(`${COLORS.BRIGHT}Prefixes:${COLORS.RESET}`);
    console.log(`  [UPCOMING]: Task due in less than 30 minutes`);
    console.log(`  [OVERDUE]: Task due time has passed`);
    console.log(`  [HIGH/MEDIUM/LOW]: Priority
`);
    console.log(`${COLORS.DIM}Press any key to continue...${COLORS.RESET}`);
    process.stdin.setRawMode(false);
    process.stdin.once("data", () => {
      process.stdin.setRawMode(true);
    });
  }
  async showArchive() {
    this.selectedIndex = 0;
    const archivedTasks = this.tasks.filter((t) => t.status === "completed");
    archivedTasks.sort((a, b) => b.updatedAt - a.updatedAt);
    if (archivedTasks.length === 0) {
      this.clearScreen();
      console.log(`${COLORS.BRIGHT}${COLORS.MAUVE}Archive${COLORS.RESET}
`);
      console.log(`${COLORS.DIM}No completed tasks yet${COLORS.RESET}
`);
      console.log(`${COLORS.DIM}Press any key to continue...${COLORS.RESET}`);
      process.stdin.setRawMode(false);
      process.stdin.once("data", () => {
        process.stdin.setRawMode(true);
      });
      return;
    }
    return new Promise((resolve) => {
      const handleKeypress = async (str, key) => {
        if (key.name === "escape" || key.name === "return") {
          process.stdin.removeListener("keypress", handleKeypress);
          resolve();
          return;
        }
        if (key.name === "up" || key.name === "k") {
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          this.renderArchive(archivedTasks);
        } else if (key.name === "down" || key.name === "j") {
          this.selectedIndex = Math.min(archivedTasks.length - 1, this.selectedIndex + 1);
          this.renderArchive(archivedTasks);
        } else if (key.name === "d") {
          const task = archivedTasks[this.selectedIndex];
          if (task) {
            this.tasks = this.tasks.filter((t) => t.id !== task.id);
            saveTasks(this.tasks);
            console.log(`${COLORS.GREEN}Task permanently deleted${COLORS.RESET}`);
            await new Promise((r) => setTimeout(r, 1000));
            process.stdin.removeListener("keypress", handleKeypress);
            resolve();
          }
        } else if (key.name === "r") {
          const task = archivedTasks[this.selectedIndex];
          if (task) {
            task.status = "pending";
            task.updatedAt = Date.now();
            saveTasks(this.tasks);
            console.log(`${COLORS.GREEN}Task restored${COLORS.RESET}`);
            await new Promise((r) => setTimeout(r, 1000));
            process.stdin.removeListener("keypress", handleKeypress);
            resolve();
          }
        }
      };
      process.stdin.on("keypress", handleKeypress);
      this.renderArchive(archivedTasks);
    });
  }
  renderArchive(tasks) {
    this.clearScreen();
    console.log(`${COLORS.BRIGHT}${COLORS.MAUVE}Archive (${tasks.length} completed)${COLORS.RESET}
`);
    const startIdx = Math.max(0, this.selectedIndex - 9);
    const endIdx = Math.min(tasks.length, startIdx + 10);
    for (let i = startIdx; i < endIdx; i++) {
      const task = tasks[i];
      const isSelected = this.selectedIndex === i;
      let prefix = "   ";
      if (isSelected) {
        prefix = `${COLORS.BG_BLUE}${COLORS.BRIGHT} \u25B6 `;
      }
      const suffix = isSelected ? ` ${COLORS.RESET}` : "";
      const completedDate = new Date(task.updatedAt).toLocaleDateString();
      console.log(`${prefix}${COLORS.DIM}${task.description}${COLORS.RESET} ${COLORS.DIM}(${completedDate})${COLORS.RESET}${suffix}`);
    }
    console.log(`
${COLORS.DIM}Arrow keys: Navigate | r: Restore | d: Delete permanently | Esc: Back${COLORS.RESET}`);
  }
  async run() {
    this.loadTasks();
    return new Promise((resolve) => {
      const handleKeypress = async (str, key) => {
        if (this.currentView === "main") {
          if (key.name === "up" || key.name === "k") {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.renderMainMenu();
          } else if (key.name === "down" || key.name === "j") {
            this.selectedIndex = Math.min(6, this.selectedIndex + 1);
            this.renderMainMenu();
          } else if (key.name === "return") {
            await this.handleMainMenuSelection();
          } else if (key.name && /^[1-7]$/.test(key.name)) {
            this.selectedIndex = parseInt(key.name) - 1;
            await this.handleMainMenuSelection();
          } else if (key.name === "c" && key.ctrl) {
            process.stdin.removeListener("keypress", handleKeypress);
            process.stdin.setRawMode(false);
            resolve();
          }
        }
      };
      process.stdin.on("keypress", handleKeypress);
      this.renderMainMenu();
    });
  }
  async handleMainMenuSelection() {
    switch (this.selectedIndex) {
      case 0:
        await this.createTodo();
        this.renderMainMenu();
        break;
      case 1:
        await this.deleteTodos();
        this.renderMainMenu();
        break;
      case 2:
        await this.editTodo();
        this.renderMainMenu();
        break;
      case 3:
        await this.listTodos();
        this.renderMainMenu();
        break;
      case 4:
        await this.showArchive();
        this.renderMainMenu();
        break;
      case 5:
        this.showHelp();
        this.renderMainMenu();
        break;
      case 6:
        process.stdin.setRawMode(false);
        process.exit(0);
    }
  }
  cleanup() {
    // Restore terminal state
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
    this.rl.close();
  }
}
async function handleCLI(args) {
  const tasks = loadTasks();
  const config = loadConfig();
  if (args.length === 0) {
    displayTasksForShell(tasks);
    return;
  }
  const command = args[0];
  if (command === "-h" || command === "--help") {
    console.log(`${COLORS.BRIGHT}Todo Manager${COLORS.RESET}
`);
    console.log(`Usage:`);
    console.log(`  todo                    # Show upcoming tasks (for shell startup)`);
    console.log(`  todo shell-display      # Show tasks for shell startup (explicit)`);
    console.log(`  todo count              # Show number of pending tasks`);
    console.log(`  todo interactive        # Launch interactive menu`);
    console.log(`  todo "Task" 15pm        # Create task`);
    console.log(`  todo "Task" 15pm --r 10,30,60  # Create with reminders`);
    console.log(`  todo list               # List all pending tasks (shows IDs)`);
    console.log(`  todo list --all         # List all tasks including completed`);
    console.log(`  todo list --overdue     # List overdue tasks`);
    console.log(`  todo list --upcoming    # List upcoming tasks`);
    console.log(`  todo done <id>          # Mark task as done`);
    console.log(`  todo delete <id>       # Delete task by ID`);
    console.log(`  todo delete <id1,id2>  # Delete multiple tasks`);
    console.log(`  todo delete all        # Delete all pending tasks`);
    console.log(`  todo rmall             # Delete all pending tasks`);
    console.log(`  todo list delete all   # Delete all pending tasks`);
    console.log(`  todo edit <id> <desc>  # Edit task`);
    console.log(`  todo help              # Show this help`);
    return;
  }
  if (command === "count") {
    const pendingCount = tasks.filter((t) => t.status === "pending").length;
    console.log(pendingCount);
    return;
  }
  if (command === "list") {
    const subCmd = args[1];
    if (subCmd === "delete" && args[2] === "all") {
      const pending = tasks.filter((t) => t.status === "pending");
      if (pending.length === 0) {
        console.log(`${COLORS.DIM}No tasks to delete${COLORS.RESET}`);
        return;
      }
      const toDelete = pending.map((t) => t.id);
      const remaining = tasks.filter((t) => !toDelete.includes(t.id));
      saveTasks(remaining);
      console.log(`${COLORS.GREEN}Deleted ${pending.length} task(s)${COLORS.RESET}`);
      return;
    }
    let filtered = tasks.filter((t) => t.status === "pending");
    const filter = args[1];
    if (filter === "--overdue") {
      filtered = filtered.filter((t) => t.dueDate && isOverdue(t.dueDate));
    } else if (filter === "--upcoming") {
      filtered = filtered.filter((t) => t.dueDate && isUpcoming(t.dueDate));
    } else if (filter === "--all") {
      filtered = tasks;
    }
    filtered.sort((a, b) => {
      if (a.dueDate && b.dueDate)
        return a.dueDate - b.dueDate;
      if (a.dueDate)
        return -1;
      if (b.dueDate)
        return 1;
      return 0;
    });
    filtered.forEach((task) => {
      console.log(formatTaskForDisplay(task, true));
    });
    if (filtered.length === 0) {
      console.log(`${COLORS.DIM}No tasks found${COLORS.RESET}`);
    }
    return;
  }
  if (command === "done") {
    const id = args[1];
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.status = "completed";
      task.updatedAt = Date.now();
      saveTasks(tasks);
      console.log(`${COLORS.GREEN}Task marked as completed${COLORS.RESET}`);
    } else {
      console.log(`${COLORS.RED}Task not found${COLORS.RESET}`);
      process.exit(1);
    }
    return;
  }
  if (command === "delete" || command === "rm" || command === "rmall") {
    const target = args[1];
    if (command === "rmall" || !target) {
      const pending = tasks.filter((t) => t.status === "pending");
      if (pending.length === 0) {
        console.log(`${COLORS.DIM}No tasks to delete${COLORS.RESET}`);
        return;
      }
      const toDelete = pending.map((t) => t.id);
      const remaining = tasks.filter((t) => !toDelete.includes(t.id));
      saveTasks(remaining);
      console.log(`${COLORS.GREEN}Deleted ${toDelete.length} task(s)${COLORS.RESET}`);
      return;
    }
    if (target === "all") {
      const pending = tasks.filter((t) => t.status === "pending");
      if (pending.length === 0) {
        console.log(`${COLORS.DIM}No tasks to delete${COLORS.RESET}`);
        return;
      }
      const toDelete = pending.map((t) => t.id);
      const remaining = tasks.filter((t) => !toDelete.includes(t.id));
      saveTasks(remaining);
      console.log(`${COLORS.GREEN}Deleted ${toDelete.length} task(s)${COLORS.RESET}`);
      return;
    }
    const ids = target.split(",").map((s) => s.trim());
    const toDelete = ids.filter((id) => tasks.some((t) => t.id === id));
    if (toDelete.length === 0) {
      console.log(`${COLORS.RED}No tasks found with ID(s): ${ids.join(", ")}${COLORS.RESET}`);
      process.exit(1);
    }
    const remaining = tasks.filter((t) => !toDelete.includes(t.id));
    saveTasks(remaining);
    console.log(`${COLORS.GREEN}Deleted ${toDelete.length} task(s)${COLORS.RESET}`);
    return;
  }
  if (command === "edit") {
    displayTasksForShell(tasks);
    return;
  }
  if (command === "shell-display") {
    displayTasksForShell(tasks);
    return;
  }
  if (command === "archive") {
    const archivedTasks = tasks.filter((t) => t.status === "completed");
    archivedTasks.sort((a, b) => b.updatedAt - a.updatedAt);
    archivedTasks.forEach((task) => {
      console.log(formatTaskForDisplay(task, true));
    });
    if (archivedTasks.length === 0) {
      console.log(`${COLORS.DIM}No archived tasks found${COLORS.RESET}`);
    }
    return;
  }
  if (command === "help") {
    console.log(`${COLORS.BRIGHT}Todo Manager${COLORS.RESET}
`);
    console.log(`Usage:`);
    console.log(`  todo                    # Show upcoming tasks (for shell startup)`);
    console.log(`  todo shell-display      # Show tasks for shell startup (explicit)`);
    console.log(`  todo count              # Show number of pending tasks`);
    console.log(`  todo interactive        # Launch interactive menu`);
    console.log(`  todo "Task" 15pm        # Create task`);
    console.log(`  todo "Task" 15pm --r 10,30,60  # Create with reminders`);
    console.log(`  todo list               # List all tasks`);
    console.log(`  todo list --overdue     # List overdue tasks`);
    console.log(`  todo list --upcoming    # List upcoming tasks`);
    console.log(`  todo done <id>          # Mark task as done`);
    console.log(`  todo delete <id>       # Delete task by ID`);
    console.log(`  todo delete <id1,id2>  # Delete multiple tasks`);
    console.log(`  todo delete all        # Delete all pending tasks`);
    console.log(`  todo rmall             # Delete all pending tasks`);
    console.log(`  todo list delete all   # Delete all pending tasks`);
    console.log(`  todo edit <id> <desc>  # Edit task`);
    console.log(`  todo help              # Show this help`);
    return;
  }
  const typo = suggestCorrection(command);
  if (command.startsWith('"') || (!command.startsWith("-") && !KNOWN_COMMANDS.includes(command) && !typo)) {
    let description = "";
    let timeStr = "";
    let reminderOffsets = [];
    let i = 0;
    if (args[i].startsWith('"')) {
      description = args[i].slice(1);
      i++;
      while (i < args.length && !args[i].endsWith('"')) {
        description += " " + args[i];
        i++;
      }
      if (i < args.length) {
        description += " " + args[i].slice(0, -1);
        i++;
      }
    } else {
      description = args[i];
      i++;
    }
    if (i < args.length && !args[i].startsWith("--")) {
      timeStr = args[i];
      i++;
    }
    if (i < args.length && (args[i] === "--r" || args[i] === "--remind")) {
      i++;
      if (i < args.length) {
        const reminderStr = args[i].replace(/[\[\]]/g, "");
        reminderOffsets = reminderStr.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
      }
    }
    const dueDate = timeStr ? parseTime(timeStr) : null;
    if (!description) {
      console.log(`${COLORS.RED}Error: Description required${COLORS.RESET}`);
      console.log(`Did you mean: todo "Description" ${timeStr || "15pm"}${reminderOffsets.length > 0 ? ` --r ${reminderOffsets.join(",")}` : ""}`);
      process.exit(1);
      return;
    }
    if (timeStr && !dueDate) {
      console.log(`${COLORS.RED}Error: Invalid time format${COLORS.RESET}`);
      console.log(`Did you mean: todo "${description}" ${timeStr.replace(/pp/g, "pm").replace(/r10/g, "--r 10")}${reminderOffsets.length > 0 ? ` --r ${reminderOffsets.join(",")}` : ""}`);
      process.exit(1);
      return;
    }
    const task = {
      id: getNextId(tasks),
      description,
      dueDate: dueDate || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "pending",
      reminderOffsets: reminderOffsets.length > 0 ? reminderOffsets : config.defaultReminderOffsets,
      notificationsSent: { reminders: [] }
    };
    tasks.push(task);
    saveTasks(tasks);
    console.log(`${COLORS.GREEN}Task created: ${description}${COLORS.RESET}`);
    return;
  }
  const suggestion = suggestCorrection(command);
  console.log(`${COLORS.RED}Unknown command: ${command}${COLORS.RESET}`);
  if (suggestion) {
    const correctedCommand = await promptCommandCorrection(command, suggestion);
    if (correctedCommand) {
      await handleCLI([correctedCommand, ...args.slice(1)]);
      return;
    }
  }
  console.log(`${COLORS.DIM}Use 'todo help' for usage information${COLORS.RESET}`);
  process.exit(1);
}
async function main() {
  const args = process.argv.slice(2);
  const isInteractive = process.stdin.isTTY && args.length === 0 || args[0] === "interactive";
  if (isInteractive) {
    const tui = new TodoTUI;
    const tasks = loadTasks();
    const config = loadConfig();
    if (config.showNotificationsOnStartup) {
      checkAndSendNotifications(tasks);
    }
    try {
      await tui.run();
    } finally {
      tui.cleanup();
    }
  } else {
    await handleCLI(args);
  }
}
main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
