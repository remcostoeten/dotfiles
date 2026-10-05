import type { Task } from "../domain/task";
import { moveTask } from "../domain/task-tree";
import { UserInputError } from "../domain/user-input-error";
import { createTasks, formatAddedTask, parseTaskIdArgument } from "./add";
import type { CommandContext, TodoPlugin } from "./types";

const GREEN = "\u001B[32m";
const RESET = "\u001B[0m";

export const epicPlugin: TodoPlugin = {
  name: "epic",
  description: "Groups tasks under epics and moves them around the tree.",
  register(app) {
    app.command(
      "epic",
      "Create an epic that groups subtasks.",
      async ({ args, store, stdout }) => {
        if (args.length === 0) throw new UserInputError("Usage: todo epic <name>[, <name>] [--under <id>]");
        const epics = await createTasks(store, args, { kind: "epic" });
        for (const epic of epics) stdout.write(formatAddedTask(epic));
      },
      {
        group: "Create",
        positional: "text",
        usage: ["todo epic <name>[, <name>] [options]"],
        details: [
          "An epic is a task that renders bold with a [done/total] badge even while empty.",
          "Accepts the same options as `todo add`.",
        ],
        options: [
          { flag: "--due <time>", description: "Due date for the epic itself" },
          { flag: "--priority <level>", description: "none, low, medium, or high" },
          { flag: "--under <id>", description: "Nest the epic under another task" },
        ],
        examples: [
          { command: "todo epic Website redesign" },
          { command: "todo epic Q4 launch, Hiring --priority high" },
        ],
      },
    );

    app.command(
      "sub",
      "Add subtasks under an existing task.",
      async ({ args, store, stdout }) => {
        const { parentId, rest } = resolveSubTarget(await store.loadTasks(), args);
        const tasks = await createTasks(store, rest, { parentId });
        for (const task of tasks) stdout.write(formatAddedTask(task));
      },
      {
        group: "Create",
        positional: "task-id",
        usage: ["todo sub <id|name> <description>[, <description>] [options]"],
        details: [
          "The parent can be a task ID or the exact name of an existing task; the longest matching",
          "name wins and the description starts right after it.",
          "Nesting has no depth limit. Accepts the same options as `todo add` except --under.",
        ],
        options: [
          { flag: "--due <time>", description: "Due date for each new subtask" },
          { flag: "--priority <level>", description: "none, low, medium, or high" },
          { flag: "--reminders <minutes>", description: "Minutes before the due date to notify" },
        ],
        examples: [
          { command: "todo sub 1 fix header, fix footer", note: "two subtasks under #1" },
          { command: "todo sub new month pay rent", note: "under the task named new month" },
          { command: "todo sub 3 write tests --due friday" },
        ],
      },
    );

    app.command("move", "Re-parent a task inside the tree.", moveCommand, {
      group: "Change",
      positional: "task-id",
      aliases: ["mv"],
      usage: ["todo move <id> <parent-id>", "todo move <id> root"],
      details: ["The whole subtree moves along. root, top, and - all mean the top level."],
      examples: [
        { command: "todo move 5 2", note: "nest #5 under #2" },
        { command: "todo move 5 root", note: "back to the top level" },
      ],
    });
  },
};

interface SubTarget {
  parentId: string;
  rest: string[];
}

/** Resolves the parent from a leading task ID or from the longest leading run of words matching a task name. */
export function resolveSubTarget(tasks: Task[], args: string[]): SubTarget {
  const [first, ...rest] = args;
  if (first === undefined) throw new UserInputError(SUB_USAGE);
  if (/^#?\d+$/.test(first.trim())) {
    if (rest.length === 0) throw new UserInputError(SUB_USAGE);
    return { parentId: parseTaskIdArgument(first), rest };
  }

  const nameLimit = getNameLimit(args);
  for (let length = nameLimit; length > 0; length -= 1) {
    const match = findTaskByName(tasks, args.slice(0, length).join(" "));
    if (match === undefined) continue;
    return { parentId: match.id, rest: args.slice(length) };
  }
  throw new UserInputError(`Task not found: ${args.slice(0, nameLimit).join(" ")}`);
}

function getNameLimit(args: string[]): number {
  const stop = args.findIndex((argument) => argument.startsWith("--") || argument.endsWith(","));
  const limit = stop === -1 ? args.length : stop;
  return Math.min(limit, args.length - 1);
}

function findTaskByName(tasks: Task[], name: string): Task | undefined {
  const needle = normalizeName(name);
  if (needle.length === 0) return undefined;
  const matches = tasks.filter((task) => normalizeName(task.description) === needle);
  const pending = matches.filter((task) => task.status === "pending");
  const candidates = pending.length > 0 ? pending : matches;
  return candidates.find((task) => task.kind === "epic") ?? candidates[0];
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const SUB_USAGE = "Usage: todo sub <id|name> <description>[, <description>]";

async function moveCommand({ args, store, stdout }: CommandContext): Promise<void> {
  const [id, target] = args;
  if (id === undefined || target === undefined || args.length !== 2) throw new UserInputError("Usage: todo move <id> <parent-id|root>");
  const tasks = await store.loadTasks();
  const parentId = isRootTarget(target) ? undefined : parseTaskIdArgument(target);
  const task = moveTask(tasks, parseTaskIdArgument(id), parentId);
  await store.saveTasks(tasks);
  stdout.write(parentId === undefined ? `${GREEN}Moved #${task.id} to the top level${RESET}\n` : `${GREEN}Moved #${task.id} under #${parentId}${RESET}\n`);
}

function isRootTarget(value: string): boolean {
  return value === "root" || value === "top" || value === "-";
}
