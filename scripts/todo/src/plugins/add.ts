import { parseDueDate } from "../domain/due-date";
import type { Task, TaskPriority } from "../domain/task";
import { UserInputError } from "../domain/user-input-error";
import type { TodoStore } from "../storage/todo-store";
import type { TodoPlugin } from "./types";

interface AddOptions {
  description: string;
  dueDate?: number;
  priority: TaskPriority;
  reminderOffsets?: number[];
}

export const addPlugin: TodoPlugin = {
  name: "add",
  description: "Creates tasks.",
  register(app) {
    app.command("add", "Add a task. Options: --due, --priority, --reminders.", async ({ args, store, stdout }) => {
      const newTasks = await createTasks(store, args);
      for (const task of newTasks) stdout.write(`Added task ${task.id}: ${task.description}\n`);
    });
  },
};

export async function createTasks(store: TodoStore, args: string[]): Promise<Task[]> {
  const options = parseAddArguments(args);
  const tasks = await store.loadTasks();
  const config = await store.loadConfig();
  const now = Date.now();
  const newTasks = options.map((option, index) => createTask(option, getNextId(tasks) + index, now, config.defaultReminderOffsets));
  await store.saveTasks([...tasks, ...newTasks]);
  return newTasks;
}

export function parseAddArguments(args: string[], now = new Date()): AddOptions[] {
  const optionStart = args.findIndex((argument) => argument === "--" || argument.startsWith("--"));
  const descriptionParts = optionStart === -1 ? args : args.slice(0, optionStart);
  const optionArguments = optionStart === -1 ? [] : args.slice(optionStart);
  if (optionArguments[0] === "--") optionArguments.shift();

  const descriptions = descriptionParts.join(" ").split(",").map((description) => description.trim()).filter(Boolean);
  if (descriptions.length === 0) {
    throw new UserInputError("Usage: todo <description>[, <description>] [--due <time>] [--priority <level>] [--reminders <minutes>]");
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
  return task;
}

function splitOption(argument: string): [string, string | undefined] {
  const equalsIndex = argument.indexOf("=");
  if (equalsIndex === -1) return [argument, undefined];
  return [argument.slice(0, equalsIndex), argument.slice(equalsIndex + 1)];
}

function parsePriority(value: string): TaskPriority {
  if (value === "none" || value === "low" || value === "medium" || value === "high") return value;
  throw new UserInputError(`Invalid priority: ${value}`);
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
