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
var DEFAULT_CONFIG = {
  defaultReminderOffsets: [10, 30, 60],
  showNotificationsOnStartup: true,
  showCompletedTasksByDefault: false,
  visualPreferences: {
    theme: "dark"
  }
};
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
    this.filteredTasks.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === "pending")
          return -1;
        if (b.status === "pending")
          return 1;
      }
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
      "(4) Help",
      "(5) Exit"
    ];
    menuItems.forEach((item, index) => {
      const isSelected = this.selectedIndex === index;
      const prefix = isSelected ? `${COLORS.BG_BLUE}${COLORS.BRIGHT} \u25B6 ` : "   ";
      const suffix = isSelected ? ` ${COLORS.RESET}` : "";
      console.log(`${prefix}${item}${suffix}`);
    });
    console.log(`
${COLORS.DIM}Use arrow keys or number keys (1-5) to navigate${COLORS.RESET}`);
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
${COLORS.DIM}Arrow keys: Navigate | Space: Select | Enter: Confirm | e: Edit | d: Delete | r: Toggle | /: Search | Esc: Back${COLORS.RESET}`);
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
    console.log(`
${COLORS.CYAN}Preview:${COLORS.RESET}`);
    console.log(`Description: ${description}`);
    console.log(`Due: ${dueDate ? formatDueDate(dueDate) : "None"}`);
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
      id: Date.now().toString(),
      description,
      dueDate,
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
    console.log(`  Arrow keys or j/k: Move selection`);
    console.log(`  Number keys (1-5): Select menu option`);
    console.log(`  Enter: Confirm selection`);
    console.log(`  Esc: Go back
`);
    console.log(`${COLORS.BRIGHT}Task List Actions:${COLORS.RESET}`);
    console.log(`  e: Edit selected task`);
    console.log(`  d: Delete selected task`);
    console.log(`  r: Toggle complete status`);
    console.log(`  Space: Toggle selection`);
    console.log(`  a: Select all`);
    console.log(`  /: Enter search mode`);
    console.log(`  Esc: Exit search mode
`);
    console.log(`${COLORS.BRIGHT}Time Formats:${COLORS.RESET}`);
    console.log(`  Relative: 1h, 2h, 10min, 1d, 1w, in 2h`);
    console.log(`  Clock: 12am, 3pm, 12:30, 15:00`);
    console.log(`  Special: tomorrow, this week`);
    console.log(`  Date: 2025-11-10 14:30
`);
    console.log(`${COLORS.BRIGHT}Prefixes:${COLORS.RESET}`);
    console.log(`  [UPCOMING]: Task due in less than 30 minutes`);
    console.log(`  [OVERDUE]: Task due time has passed
`);
    console.log(`${COLORS.DIM}Press any key to continue...${COLORS.RESET}`);
    process.stdin.setRawMode(false);
    process.stdin.once("data", () => {
      process.stdin.setRawMode(true);
    });
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
            this.selectedIndex = Math.min(4, this.selectedIndex + 1);
            this.renderMainMenu();
          } else if (key.name === "return") {
            await this.handleMainMenuSelection();
          } else if (key.name && /^[1-5]$/.test(key.name)) {
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
        this.showHelp();
        this.renderMainMenu();
        break;
      case 4:
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
  if (command === "count") {
    const pendingCount = tasks.filter((t) => t.status === "pending").length;
    console.log(pendingCount);
    return;
  }
  if (command === "list") {
    const filter = args[1];
    let filtered = tasks.filter((t) => t.status === "pending");
    if (filter === "--overdue") {
      filtered = filtered.filter((t) => t.dueDate && isOverdue(t.dueDate));
    } else if (filter === "--upcoming") {
      filtered = filtered.filter((t) => t.dueDate && isUpcoming(t.dueDate));
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
      console.log(formatTaskForDisplay(task));
    });
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
  if (command === "edit") {
    const id = args[1];
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      console.log(`${COLORS.RED}Task not found${COLORS.RESET}`);
      process.exit(1);
      return;
    }
    if (args[2]) {
      task.description = args.slice(2).join(" ");
      task.updatedAt = Date.now();
      saveTasks(tasks);
      console.log(`${COLORS.GREEN}Task updated${COLORS.RESET}`);
    } else {
      console.log(`${COLORS.RED}Usage: todo edit <id> <new description>${COLORS.RESET}`);
      process.exit(1);
    }
    return;
  }
  if (command === "shell-display") {
    displayTasksForShell(tasks);
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
    console.log(`  todo edit <id> <desc>   # Edit task`);
    console.log(`  todo help               # Show this help`);
    return;
  }
  if (command.startsWith('"') || !command.startsWith("-")) {
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
      id: Date.now().toString(),
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
  console.log(`${COLORS.RED}Unknown command: ${command}${COLORS.RESET}`);
  console.log(`Use 'todo help' for usage information`);
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
