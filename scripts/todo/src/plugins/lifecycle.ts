import { UserInputError } from "../domain/user-input-error";
import { formatTaskForDisplay } from "../presentation/task-format";
import type { TodoPlugin } from "./types";

const DIM = "\u001B[2m";
const GREEN = "\u001B[32m";
const RESET = "\u001B[0m";

export const lifecyclePlugin: TodoPlugin = {
  name: "lifecycle",
  description: "Completes, edits, and archives tasks.",
  register(app) {
    app.command("done", "Mark a task as completed.", async ({ args, store, stdout }) => {
      const id = requireTaskId(args, "Usage: todo done <id>");
      const tasks = await store.loadTasks();
      const task = tasks.find((candidate) => candidate.id === id);
      if (task === undefined) throw new UserInputError(`Task not found: ${id}`);
      if (task.status === "completed") {
        stdout.write(`${DIM}Task already completed${RESET}\n`);
        return;
      }

      task.status = "completed";
      task.updatedAt = Date.now();
      await store.saveTasks(tasks);
      stdout.write(`${GREEN}Task marked as completed${RESET}\n`);
    });

    app.command("edit", "Change a task description.", async ({ args, store, stdout }) => {
      const id = requireFirstArgument(args, "Usage: todo edit <id> <description>");
      const description = args.slice(1).join(" ").trim();
      if (description.length === 0) throw new UserInputError("Usage: todo edit <id> <description>");

      const tasks = await store.loadTasks();
      const task = tasks.find((candidate) => candidate.id === id);
      if (task === undefined) throw new UserInputError(`Task not found: ${id}`);

      task.description = description;
      task.updatedAt = Date.now();
      await store.saveTasks(tasks);
      stdout.write(`${GREEN}Updated task ${task.id}${RESET}\n`);
    });

    app.command("archive", "List completed tasks.", async ({ args, store, stdout }) => {
      if (args.length > 0) throw new UserInputError("Usage: todo archive");

      const tasks = await store.loadTasks();
      const archivedTasks = tasks.filter((task) => task.status === "completed").sort((left, right) => right.updatedAt - left.updatedAt);
      if (archivedTasks.length === 0) {
        stdout.write(`${DIM}No archived tasks found${RESET}\n`);
        return;
      }

      for (const task of archivedTasks) stdout.write(`${formatTaskForDisplay(task)}\n`);
    });
  },
};

function requireTaskId(args: string[], usage: string): string {
  const id = args[0];
  if (args.length !== 1 || id === undefined || id.trim().length === 0) throw new UserInputError(usage);
  return id;
}

function requireFirstArgument(args: string[], usage: string): string {
  const value = args[0];
  if (value === undefined || value.trim().length === 0) throw new UserInputError(usage);
  return value;
}
