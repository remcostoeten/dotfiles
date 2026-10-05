import { collectSubtreeIds } from "../domain/task-tree";
import { UserInputError } from "../domain/user-input-error";
import type { CommandContext, TodoPlugin } from "./types";

const DIM = "\u001B[2m";
const GREEN = "\u001B[32m";
const RESET = "\u001B[0m";

export const removePlugin: TodoPlugin = {
  name: "remove",
  description: "Removes tasks.",
  register(app) {
    app.command("rm", "Remove tasks and their subtasks.", removeById, {
      group: "Remove",
      positional: "task-ids",
      aliases: ["delete"],
      usage: ["todo rm <id...>", "todo rm <id[,id|start-end,...]>", "todo rm all"],
      details: ["Removed tasks go to the undo buffer; `todo undo` restores them with fresh IDs."],
      examples: [
        { command: "todo rm 4", note: "one task and everything nested under it" },
        { command: "todo rm 1 2 3 4", note: "several IDs separated by spaces" },
        { command: "todo rm 1,5,9,10-15", note: "IDs and inclusive ranges" },
        { command: "todo rm all", note: "every pending task" },
      ],
    });

    app.command(
      "rmall",
      "Remove every pending task.",
      async ({ args, store, stdout }) => {
        if (args.length > 0) throw new UserInputError("Usage: todo rmall");
        await removeAllPendingTasks(store, stdout);
      },
      {
        group: "Remove",
        usage: ["todo rmall"],
        details: ["Completed tasks stay in the archive. `todo undo` brings the removed tasks back."],
      },
    );
  },
};

async function removeById({ args, store, stdout }: CommandContext): Promise<void> {
  if (args.length === 0) {
    throw new UserInputError("Usage: todo rm <id...> | todo rm <id[,id|start-end,...]> | todo rm all");
  }

  if (args.length === 1 && args[0] === "all") {
    await removeAllPendingTasks(store, stdout);
    return;
  }

  const ids = parseTaskIds(args.join(","));
  const tasks = await store.loadTasks();
  const requestedIds = tasks.filter((task) => ids.has(task.id)).map((task) => task.id);
  if (requestedIds.length === 0) {
    throw new UserInputError(`No tasks found with ID(s): ${[...ids].join(", ")}`);
  }

  const matchingIds = collectSubtreeIds(tasks, requestedIds);
  await store.saveUndo(tasks.filter((task) => matchingIds.has(task.id)));
  await store.saveTasks(tasks.filter((task) => !matchingIds.has(task.id)));
  const subtaskCount = matchingIds.size - requestedIds.length;
  const subtaskText = subtaskCount > 0 ? ` including ${subtaskCount} subtask(s)` : "";
  stdout.write(`${GREEN}Deleted ${matchingIds.size} task(s)${subtaskText}${RESET}\n`);
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
