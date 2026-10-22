import type { CommandContext, CommandSpec } from "../command-spec/types";
import { purgeTaskIds } from "../domain/boards";
import type { TaskId } from "../domain/task";
import { collectSubtreeIds } from "../domain/task-tree";
import { UserInputError } from "../domain/user-input-error";
import type { TodoStore } from "../storage/todo-store";

const DIM = "\u001B[2m";
const GREEN = "\u001B[32m";
const RESET = "\u001B[0m";

export const rmCommand: CommandSpec = {
  name: "rm",
  aliases: ["delete"],
  summary: "Remove tasks and their subtasks.",
  group: "Remove",
  args: [{ name: "ids", kind: "task-ids", variadic: true, description: "IDs, comma lists, or inclusive ranges like 10-15" }],
  subcommands: [
    {
      name: "all",
      summary: "Remove every pending task.",
      details: ["Removed tasks move to the archive. `todo undo` brings them back."],
      examples: [{ command: "todo rm all" }, { command: "todo undo", note: "bring them all back" }],
      async run(_input, { store, stdout }) {
        await removeAllPendingTasks(store, stdout);
      },
    },
  ],
  details: [
    "Nothing is deleted: removed tasks move to the archive (`todo archive --removed`). `todo undo` restores the last removal; `todo archive restore r<n>` any older one.",
    "Removed tasks also leave every board.",
  ],
  examples: [
    { command: "todo rm 4", note: "one task and everything nested under it" },
    { command: "todo rm 1 2 3 4", note: "several IDs separated by spaces" },
    { command: "todo rm 1,5,9,10-15", note: "IDs and inclusive ranges" },
    { command: "todo rm all", note: "every pending task" },
  ],
  async run(input, { store, stdout }) {
    const ids = parseTaskIds(input.args("ids").join(","));
    const tasks = await store.loadTasks();
    const requestedIds = tasks.filter((task) => ids.has(task.id)).map((task) => task.id);
    if (requestedIds.length === 0) {
      throw new UserInputError(`No tasks found with ID(s): ${[...ids].join(", ")}`);
    }

    const matchingIds = collectSubtreeIds(tasks, requestedIds);
    await store.saveUndo(tasks.filter((task) => matchingIds.has(task.id)));
    await store.saveTasks(tasks.filter((task) => !matchingIds.has(task.id)));
    await purgeFromBoards(store, matchingIds);
    const subtaskCount = matchingIds.size - requestedIds.length;
    const subtaskText = subtaskCount > 0 ? ` including ${subtaskCount} subtask(s)` : "";
    stdout.write(`${GREEN}Deleted ${matchingIds.size} task(s)${subtaskText}${RESET} ${DIM}· archived, restore with todo undo or todo archive -i${RESET}\n`);
  },
};

export async function removeAllPendingTasks(store: TodoStore, stdout: CommandContext["stdout"]): Promise<void> {
  const tasks = await store.loadTasks();
  const pendingTasks = tasks.filter((task) => task.status === "pending");
  if (pendingTasks.length === 0) {
    stdout.write(`${DIM}No tasks to delete${RESET}\n`);
    return;
  }

  await store.saveUndo(pendingTasks);
  await store.saveTasks(tasks.filter((task) => task.status !== "pending"));
  await purgeFromBoards(store, new Set(pendingTasks.map((task) => task.id)));
  stdout.write(`${GREEN}Deleted ${pendingTasks.length} task(s)${RESET} ${DIM}· archived, restore with todo undo or todo archive -i${RESET}\n`);
}

async function purgeFromBoards(store: TodoStore, ids: ReadonlySet<TaskId>): Promise<void> {
  const state = await store.loadBoardsFile();
  if (state === undefined) return;
  await store.saveBoards(purgeTaskIds(state, ids));
}

function parseTaskIds(value: string): Set<string> {
  const ids = new Set<string>();
  for (const part of value.split(",").map((item) => item.trim().replace(/^#/, ""))) {
    if (part.length === 0) throw new UserInputError(`Invalid task ID list: ${value}`);

    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > end || end - start > 10_000) throw new UserInputError(`Invalid task ID range: ${part}`);
      for (let id = start; id <= end; id += 1) ids.add(`${id}`);
      continue;
    }

    if (!/^\d+$/.test(part)) throw new UserInputError(`Invalid task ID: ${part}`);
    ids.add(part);
  }
  return ids;
}
