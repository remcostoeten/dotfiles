import type { CommandContext, CommandSpec } from "../command-spec/types";
import type { ParsedInput } from "../command-spec/parsed-input";
import type { Task } from "../domain/task";
import { type ReorderPosition, moveTask, reorderTask } from "../domain/task-tree";
import { UserInputError } from "../domain/user-input-error";
import { formatAddedTask, insertTasks, parseTaskIdArgument, PLACEMENT_FLAGS, readAddOptions, readPlacement, TASK_FLAGS } from "./add";

const GREEN = "\u001B[32m";
const RESET = "\u001B[0m";

export const epicCommand: CommandSpec = {
  name: "epic",
  summary: "Create an epic that groups subtasks.",
  group: "Create",
  args: [{ name: "name", kind: "text", variadic: true, description: "Epic name; separate several with commas" }],
  flags: [...TASK_FLAGS, { name: "under", aliases: ["parent", "in"], value: "task-id", description: "Nest the epic under another task" }, ...PLACEMENT_FLAGS],
  details: [
    "An epic is a task that renders bold with a [done/total] badge even while empty.",
    "Accepts the same options as `todo add`.",
  ],
  examples: [
    { command: "todo epic Website redesign" },
    { command: "todo epic Q4 launch, Hiring --priority high" },
  ],
  async run(input, { store, stdout }) {
    const epics = await insertTasks(store, readAddOptions(input, new Date(), { kind: "epic" }, input.args("name")), readPlacement(input));
    for (const epic of epics) stdout.write(formatAddedTask(epic));
  },
};

export const subCommand: CommandSpec = {
  name: "sub",
  summary: "Add subtasks under an existing task.",
  group: "Create",
  args: [
    { name: "parent", kind: "task-selector", description: "Parent task ID, or the exact name of a task" },
    { name: "description", kind: "text", variadic: true, description: "Subtask text; separate several with commas" },
  ],
  flags: [...TASK_FLAGS, ...PLACEMENT_FLAGS],
  details: [
    "The parent can be a task ID or the exact name of an existing task; the longest matching",
    "name wins and the description starts right after it. `todo 3 fix header` is the same as `todo sub 3 fix header`.",
    "Nesting has no depth limit. Subtasks of a task on the active board follow it there.",
  ],
  examples: [
    { command: "todo sub 1 fix header, fix footer", note: "two subtasks under #1" },
    { command: "todo sub new month pay rent", note: "under the task named new month" },
    { command: "todo sub 3 write tests --due friday" },
  ],
  async run(input, { store, stdout }) {
    const { parentId, rest } = resolveSubTarget(await store.loadTasks(), [...input.positionals]);
    const tasks = await insertTasks(store, readAddOptions(input, new Date(), { parentId }, rest), readPlacement(input));
    for (const task of tasks) stdout.write(formatAddedTask(task));
  },
};

export const moveCommand: CommandSpec = {
  name: "move",
  aliases: ["mv"],
  summary: "Re-parent a task inside the tree.",
  group: "Change",
  args: [
    { name: "id", kind: "task-id", description: "Task to move" },
    { name: "parent", kind: "parent-id", description: "New parent ID, or root / top / - for the top level" },
  ],
  details: [
    "The whole subtree moves along. root, top, and - all mean the top level.",
    "This changes the tree, not boards. To move a task to another board, use `todo board move <id> --to <board>`.",
  ],
  examples: [
    { command: "todo move 5 2", note: "nest #5 under #2" },
    { command: "todo move 5 root", note: "back to the top level" },
  ],
  run: runMove,
};

export const reorderCommand: CommandSpec = {
  name: "reorder",
  summary: "Change a task's position among its siblings.",
  group: "Change",
  args: [{ name: "id", kind: "task-id", description: "Task to reposition" }],
  flags: [
    { name: "before", value: "task-id", description: "Place right above this sibling" },
    { name: "after", value: "task-id", description: "Place right below this sibling" },
    { name: "top", description: "First among its siblings" },
    { name: "bottom", description: "Last among its siblings" },
  ],
  details: [
    "Only changes position among siblings under the same epic, or the top level; it never re-parents.",
    "Use `todo move` to change parents. Give exactly one of the options.",
  ],
  examples: [
    { command: "todo reorder 5 --before 2", note: "#5 goes right above #2" },
    { command: "todo reorder 5 --after 2", note: "#5 goes right below #2" },
    { command: "todo reorder 5 --top", note: "first among its siblings" },
  ],
  run: runReorder,
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

const SUB_USAGE = "Usage: todo sub <parent> <description…>";

async function runMove(input: ParsedInput, { store, stdout }: CommandContext): Promise<void> {
  const tasks = await store.loadTasks();
  const target = input.arg("parent");
  const parentId = isRootTarget(target) ? undefined : parseTaskIdArgument(target);
  const task = moveTask(tasks, input.arg("id"), parentId);
  await store.saveTasks(tasks);
  stdout.write(parentId === undefined ? `${GREEN}Moved #${task.id} to the top level${RESET}\n` : `${GREEN}Moved #${task.id} under #${parentId}${RESET}\n`);
}

function isRootTarget(value: string): boolean {
  return value === "root" || value === "top" || value === "-";
}

async function runReorder(input: ParsedInput, { store, stdout }: CommandContext): Promise<void> {
  const position = readReorderPosition(input);
  const tasks = await store.loadTasks();
  const task = reorderTask(tasks, input.arg("id"), position);
  await store.saveTasks(tasks);
  stdout.write(`${GREEN}Reordered #${task.id}${RESET}\n`);
}

function readReorderPosition(input: ParsedInput): ReorderPosition {
  const positions: ReorderPosition[] = [];
  const before = input.value("before");
  const after = input.value("after");
  if (before !== undefined) positions.push({ type: "before", anchorId: before });
  if (after !== undefined) positions.push({ type: "after", anchorId: after });
  if (input.flag("top")) positions.push({ type: "top" });
  if (input.flag("bottom")) positions.push({ type: "bottom" });
  const [position] = positions;
  if (position === undefined || positions.length > 1) throw new UserInputError("Usage: todo reorder <id> --before <id>|--after <id>|--top|--bottom");
  return position;
}

export const epicCommands: CommandSpec[] = [epicCommand, subCommand, moveCommand, reorderCommand];
