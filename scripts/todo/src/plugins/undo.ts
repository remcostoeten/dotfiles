import { resetNotificationState } from "../notifications";
import { tryParseDueDate } from "../domain/due-date";
import { UserInputError } from "../domain/user-input-error";
import type { Task } from "../domain/task";
import type { TodoPlugin } from "./types";

const DIM = "\u001B[2m";
const GREEN = "\u001B[32m";
const RESET = "\u001B[0m";

export const undoPlugin: TodoPlugin = {
  name: "undo",
  description: "Restores the most recently deleted tasks or snoozes a task.",
  register(app) {
    app.command("undo", "Restore the most recently deleted task or tasks.", async ({ args, store, stdout }) => {
      if (args.length > 0) throw new UserInputError("Usage: todo undo");
      const undo = await store.loadUndo();
      if (undo === undefined || undo.tasks.length === 0) {
        stdout.write(`${DIM}Nothing to undo${RESET}\n`);
        return;
      }

      const tasks = await store.loadTasks();
      const restoredTasks = restoreTasks(tasks, undo.tasks);
      await store.saveTasks([...tasks, ...restoredTasks]);
      await store.clearUndo();
      stdout.write(`${GREEN}Restored ${restoredTasks.length} task(s)${RESET}\n`);
    });

    app.command("snooze", "Snooze a task: todo snooze <id> <1h|tomorrow|monday>.", async ({ args, store, stdout }) => {
      if (args.length < 2) throw new UserInputError("Usage: todo snooze <id> <1h|30m|tomorrow|monday|next week|16/08/2026>");
      const id = args[0];
      if (id === undefined) throw new UserInputError("Missing task ID");
      const dueDate = tryParseDueDate(args.slice(1).join(" "));
      if (dueDate === undefined) throw new UserInputError("Invalid snooze time");

      const tasks = await store.loadTasks();
      const task = tasks.find((item) => item.id === id);
      if (task === undefined) throw new UserInputError(`Task not found: ${id}`);
      task.dueDate = dueDate;
      task.updatedAt = Date.now();
      resetNotificationState(task);
      await store.saveTasks(tasks);
      stdout.write(`${GREEN}Snoozed #${task.id}${RESET}\n`);
    });
  },
};

export function restoreTasks(tasks: Task[], deletedTasks: Task[]): Task[] {
  let nextId = getNextId(tasks);
  return deletedTasks.map((task) => ({ ...task, id: `${nextId++}`, updatedAt: Date.now() }));
}

function getNextId(tasks: Task[]): number {
  const ids = tasks.map((task) => Number.parseInt(task.id, 10)).filter(Number.isFinite);
  return (ids.length === 0 ? 0 : Math.max(...ids)) + 1;
}
