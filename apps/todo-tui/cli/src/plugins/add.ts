import { parseDueDate } from "../domain/due-date";
import type { Task, TaskKind, TaskPriority } from "../domain/task";
import { findTask } from "../domain/task-tree";
import { UnknownTokenError } from "../domain/unknown-token-error";
import { UserInputError } from "../domain/user-input-error";
import type { TodoStore } from "../storage/todo-store";
import type { TodoPlugin } from "./types";

export interface AddOptions {
  description: string;
  dueDate?: number;
  priority: TaskPriority;
  reminderOffsets?: number[];
  parentId?: string;
  kind?: TaskKind;
}

export interface CreateTaskDefaults {
  parentId?: string;
  kind?: TaskKind;
}

export const addPlugin: TodoPlugin = {
  name: "add",
  description: "Creates tasks.",
  register(app) {
    app.command(
      "add",
      "Add one or more tasks.",
      async ({ args, store, stdout }) => {
        const newTasks = await createTasks(store, args);
        for (const task of newTasks) stdout.write(formatAddedTask(task));
      },
      {
        group: "Create",
        positional: "text",
        usage: ["todo add <description>[, <description>] [options]", "todo <description>[, <description>] [options]"],
        details: [
          "The add verb is optional: any unknown first word starts a task description.",
          "Separate several tasks with commas. The first --option ends the description;",
          "use a standalone -- when a description itself starts with a dash.",
        ],
        options: [
          { flag: "--due <time>", description: "Due date: 1h, 30m, tomorrow, monday, next week, 16/08/2026" },
          { flag: "--priority <level>", description: "none (default), low, medium, or high" },
          { flag: "--reminders <minutes>", description: "Comma list of minutes before the due date to notify (alias --remind)" },
          { flag: "--under <id>", description: "Nest the new task under an existing task (aliases --parent, --in)" },
        ],
        examples: [
          { command: "todo buy oat milk", note: "implicit add" },
          { command: "todo buy oat milk, call dentist --priority high", note: "two tasks, both high" },
          { command: "todo add call dentist -- --due tomorrow --reminders 10,30" },
          { command: "todo add polish hero --under 2", note: "subtask of #2" },
        ],
      },
    );
  },
};

export async function createTasks(store: TodoStore, args: string[], defaults: CreateTaskDefaults = {}): Promise<Task[]> {
  const options = parseAddArguments(args).map((option) => ({ ...defaults, ...option }));
  const tasks = await store.loadTasks();
  const config = await store.loadConfig();
  const now = Date.now();
  for (const option of options) {
    if (option.parentId !== undefined) findTask(tasks, option.parentId);
  }
  const newTasks = options.map((option, index) => createTask(option, getNextId(tasks) + index, now, config.defaultReminderOffsets));
  await store.saveTasks([...tasks, ...newTasks]);
  return newTasks;
}

export function formatAddedTask(task: Task): string {
  const noun = task.kind === "epic" ? "epic" : "task";
  const location = task.parentId === undefined ? "" : ` under #${task.parentId}`;
  return `Added ${noun} ${task.id}${location}: ${task.description}\n`;
}

export function parseAddArguments(args: string[], now = new Date()): AddOptions[] {
  const optionStart = args.findIndex((argument) => argument === "--" || argument.startsWith("--"));
  const descriptionParts = optionStart === -1 ? args : args.slice(0, optionStart);
  const optionArguments = optionStart === -1 ? [] : args.slice(optionStart);
  if (optionArguments[0] === "--") optionArguments.shift();

  const descriptions = parseDescriptions(descriptionParts);
  if (descriptions.length === 0) {
    throw new UserInputError("Usage: todo <description>[, <description>] [--due <time>] [--priority <level>] [--reminders <minutes>] [--under <id>]");
  }

  const options: Omit<AddOptions, "description"> = { priority: "none" };
  for (let index = 0; index < optionArguments.length; index += 1) {
    const argument = optionArguments[index];
    if (argument === undefined) continue;
    const [name, inlineValue] = splitOption(argument);

    let value = inlineValue;
    if (value === undefined) {
      const valueParts: string[] = [];
      while (index + 1 < optionArguments.length) {
        const nextArgument = optionArguments[index + 1];
        if (nextArgument === undefined || nextArgument.startsWith("--")) break;
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

function parseDescriptions(parts: string[]): string[] {
  const descriptions: string[] = [];
  let words: string[] = [];

  function finishDescription(): void {
    const description = words.join(" ").trim();
    if (description.length > 0) descriptions.push(description);
    words = [];
  }

  for (const part of parts) {
    const startsWithSeparator = part.startsWith(",");
    const endsWithSeparator = part.endsWith(",");

    if (startsWithSeparator) finishDescription();

    const word = part.slice(startsWithSeparator ? 1 : 0, endsWithSeparator ? -1 : undefined);
    if (word.length > 0) words.push(word);

    if (endsWithSeparator) finishDescription();
  }

  finishDescription();
  return descriptions;
}

function createTask(options: AddOptions, id: number, now: number, defaultReminderOffsets: number[]): Task {
  const task: Task = {
    id: `${id}`,
    description: options.description,
    status: "pending",
    priority: options.priority,
    createdAt: now,
    updatedAt: now,
    reminderOffsets: options.reminderOffsets ?? defaultReminderOffsets,
    notificationsSent: { reminders: [], overdue: false },
  };

  if (options.dueDate !== undefined) task.dueDate = options.dueDate;
  if (options.parentId !== undefined) task.parentId = options.parentId;
  if (options.kind !== undefined) task.kind = options.kind;
  return task;
}

const ADD_OPTION_NAMES = ["--due", "--priority", "--under", "--parent", "--in", "--reminders", "--remind"];
const PRIORITIES = ["none", "low", "medium", "high"];

function splitOption(argument: string): [string, string | undefined] {
  const equalsIndex = argument.indexOf("=");
  if (equalsIndex === -1) return [argument, undefined];
  return [argument.slice(0, equalsIndex), argument.slice(equalsIndex + 1)];
}

function parsePriority(value: string): TaskPriority {
  if (value === "none" || value === "low" || value === "medium" || value === "high") return value;
  throw new UnknownTokenError(`Invalid priority: ${value}`, value, PRIORITIES, "value");
}

/** Accepts `12` or `#12`. */
export function parseTaskIdArgument(value: string): string {
  const id = value.trim().replace(/^#/, "");
  if (!/^\d+$/.test(id)) throw new UserInputError(`Invalid task ID: ${value}`);
  return id;
}

function parseReminderOffsets(value: string): number[] {
  const offsets = value.split(",").map((offset) => Number(offset.trim()));
  if (offsets.length === 0 || offsets.some((offset) => !Number.isFinite(offset) || offset < 0)) {
    throw new UserInputError(`Invalid reminders: ${value}`);
  }
  return offsets;
}

function getNextId(tasks: Task[]): number {
  const numericIds = tasks.map((task) => Number.parseInt(task.id, 10)).filter((id) => Number.isFinite(id));
  return (numericIds.length === 0 ? 0 : Math.max(...numericIds)) + 1;
}
