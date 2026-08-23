import { UserInputError } from "../domain/user-input-error";
import type { CommandContext, TodoPlugin } from "./types";

const DIM = "\u001B[2m";
const GREEN = "\u001B[32m";
const RESET = "\u001B[0m";

export const removePlugin: TodoPlugin = {
  name: "remove",
  description: "Removes tasks.",
  register(app) {
    app.command("rm", "Remove tasks by ID, comma list, or inclusive range.", removeById);
    app.command("delete", "Alias for rm.", removeById);

    app.command("rmall", "Remove all pending tasks.", async ({ args, store, stdout }) => {
      if (args.length > 0) throw new UserInputError("Usage: todo rmall");
      await removeAllPendingTasks(store, stdout);
    });
  },
};

async function removeById({ args, store, stdout }: CommandContext): Promise<void> {
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
  stdout.write(`${GREEN}Deleted ${matchingIds.size} task(s)${RESET}\n`);
}

export async function removeAllPendingTasks(store: CommandContext["store"], stdout: CommandContext["stdout"]): Promise<void> {
  const tasks = await store.loadTasks();
  const pendingTasks = tasks.filter((task) => task.status === "pending");
  if (pendingTasks.length === 0) {
    stdout.write(`${DIM}No tasks to delete${RESET}\n`);
    return;
  }

  await store.saveUndo(pendingTasks);
  await store.saveTasks(tasks.filter((task) => task.status !== "pending"));
  stdout.write(`${GREEN}Deleted ${pendingTasks.length} task(s)${RESET}\n`);
}

function parseTaskIds(value: string): Set<string> {
  const ids = new Set<string>();
  for (const part of value.split(",").map((item) => item.trim())) {
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
