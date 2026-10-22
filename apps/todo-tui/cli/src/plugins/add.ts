import { parse } from "../command-spec/parse";
import type { ParsedInput } from "../command-spec/parsed-input";
import type { CommandSpec, FlagSpec } from "../command-spec/types";
import { parseDueDate } from "../domain/due-date";
import type { Task, TaskKind, TaskPriority } from "../domain/task";
import { findTask } from "../domain/task-tree";
import { UserInputError } from "../domain/user-input-error";
import { checkPlacement, loadBoards, nextTaskId, placeNewTasks, type BoardPlacement } from "../services/boards";
import type { TodoStore } from "../storage/todo-store";

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

export const PLACEMENT_FLAGS: FlagSpec[] = [
  { name: "later", description: "Put the new tasks in the active board's Later lane" },
  { name: "off-board", description: "Keep the new tasks off the active board" },
];

export const TASK_FLAGS: FlagSpec[] = [
  { name: "due", value: "due-time", greedy: true, description: "Due date: 1h, 30m, tomorrow, monday, next week, 16/08/2026" },
  { name: "priority", value: "priority", description: "none (default), low, medium, or high" },
  { name: "reminders", aliases: ["remind"], value: "minutes", description: "Comma list of minutes before the due date to notify" },
];

const UNDER_FLAG: FlagSpec = { name: "under", aliases: ["parent", "in"], value: "task-id", description: "Nest the new tasks under an existing task" };

export const addCommand: CommandSpec = {
  name: "add",
  summary: "Add one or more tasks.",
  group: "Create",
  args: [{ name: "description", kind: "text", variadic: true, description: "Task text; separate several tasks with commas" }],
  flags: [...TASK_FLAGS, UNDER_FLAG, ...PLACEMENT_FLAGS],
  details: [
    "The add verb is optional: any unknown first word starts a task description.",
    "Separate several tasks with commas. Use a standalone -- when a description itself starts with a dash.",
    "While a board is active, new tasks join its Now lane; --later puts them in Later, --off-board keeps them off.",
    "There is no --on for add. Activate the board first with `todo board use <name>`, or place the task afterwards with `todo board add <id> --on <name>`.",
  ],
  examples: [
    { command: "todo buy oat milk", note: "implicit add" },
    { command: "todo buy oat milk, call dentist --priority high", note: "two tasks, both high" },
    { command: "todo add call dentist --due tomorrow --reminders 10,30" },
    { command: "todo add polish hero --under 2", note: "subtask of #2" },
    { command: "todo add read that paper --later", note: "Later lane of the active board" },
    { command: "todo add renew passport --off-board", note: "on no board" },
    { command: "todo add -- -v flag is broken", note: "text that starts with a dash" },
  ],
  async run(input, { store, stdout }) {
    const tasks = await insertTasks(store, readAddOptions(input), readPlacement(input));
    for (const task of tasks) stdout.write(formatAddedTask(task));
  },
};

export function readPlacement(input: ParsedInput): BoardPlacement {
  return { later: input.flag("later"), offBoard: input.flag("off-board") };
}

/** Parses `add` arguments through the command spec; kept for callers that hold raw words, like the legacy taskboard. */
export function parseAddArguments(args: string[], now = new Date()): AddOptions[] {
  const result = parse({ name: "todo", summary: "", subcommands: [addCommand] }, ["add", ...args]);
  if (result.kind !== "run") throw new UserInputError("Usage: todo add <description>[, <description>]");
  return readAddOptions(result.input, now);
}

export function readAddOptions(input: ParsedInput, now = new Date(), defaults: CreateTaskDefaults = {}, words = input.args("description")): AddOptions[] {
  const descriptions = parseDescriptions(words);
  if (descriptions.length === 0) throw new UserInputError("Usage: todo add <description>[, <description>]");

  const options: Omit<AddOptions, "description"> = { priority: "none", ...defaults };
  const priority = input.value("priority");
  if (priority !== undefined) options.priority = priority as TaskPriority;
  const due = input.value("due");
  if (due !== undefined) options.dueDate = parseDueDate(due, now);
  const reminders = input.value("reminders");
  if (reminders !== undefined) options.reminderOffsets = reminders.split(",").map((offset) => Number(offset.trim()));
  const under = input.value("under");
  if (under !== undefined) options.parentId = under;
  return descriptions.map((description) => ({ ...options, description }));
}

/** Creates tasks from raw words; new tasks join the active board. */
export async function createTasks(store: TodoStore, args: string[], defaults: CreateTaskDefaults = {}): Promise<Task[]> {
  const options = parseAddArguments(args).map((option) => ({ ...option, ...defaults }));
  return await insertTasks(store, options, {});
}

export async function insertTasks(store: TodoStore, options: AddOptions[], placement: BoardPlacement): Promise<Task[]> {
  const tasks = await store.loadTasks();
  const config = await store.loadConfig();
  const now = Date.now();
  for (const option of options) {
    if (option.parentId !== undefined) findTask(tasks, option.parentId);
  }
  const boards = await loadBoards(store, now);
  checkPlacement(boards, tasks, options.map((option) => option.parentId), placement);

  const firstId = nextTaskId(tasks);
  const created = options.map((option, index) => createTask(option, firstId + index, now, config.defaultReminderOffsets));
  const allTasks = [...tasks, ...created];
  await store.saveTasks(allTasks);
  await placeNewTasks(store, boards, allTasks, created, placement);
  return created;
}

export function formatAddedTask(task: Task): string {
  const noun = task.kind === "epic" ? "epic" : "task";
  const location = task.parentId === undefined ? "" : ` under #${task.parentId}`;
  return `Added ${noun} ${task.id}${location}: ${task.description}\n`;
}

export function parseDescriptions(parts: ReadonlyArray<string>): string[] {
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

/** Accepts `12` or `#12`. */
export function parseTaskIdArgument(value: string): string {
  const id = value.trim().replace(/^#/, "");
  if (!/^\d+$/.test(id)) throw new UserInputError(`Invalid task ID: ${value}`);
  return id;
}

export function getNextId(tasks: Task[]): number {
  return nextTaskId(tasks);
}
