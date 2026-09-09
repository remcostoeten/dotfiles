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
    }, {
      group: "Remove",
      aliases: ["revert", "restore"],
      usage: ["todo undo"],
      details: ["Only the most recent rm, rmall, or taskboard delete is kept. Restored tasks get fresh IDs."],
    });

    app.command("snooze", "Push a task's due date forward.", async ({ args, store, stdout }) => {
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
      if (task.reminder !== undefined) task.reminder.dueAt = dueDate;
      resetNotificationState(task);
      await store.saveTasks(tasks);
      stdout.write(`${GREEN}Snoozed #${task.id}${RESET}\n`);
    }, {
      group: "Change",
      positional: "task-id",
      usage: ["todo snooze <id> <time>"],
      details: ["Sets a new due date and resets reminder notifications for the task."],
      examples: [
        { command: "todo snooze 4 1h" },
        { command: "todo snooze 4 tomorrow" },
        { command: "todo snooze 4 next week" },
        { command: "todo snooze 4 16/08/2026" },
      ],
    });
  },
};

/** Re-inserts deleted tasks with fresh IDs, keeping parent links inside the restored set and to still-existing tasks. */
export function restoreTasks(tasks: Task[], deletedTasks: Task[]): Task[] {
  let nextId = getNextId(tasks);
  const existingIds = new Set(tasks.map((task) => task.id));
  const idMap = new Map(deletedTasks.map((task) => [task.id, `${nextId++}`]));
  const now = Date.now();
  return deletedTasks.map((task) => {
    const restored: Task = { ...task, id: idMap.get(task.id) ?? task.id, updatedAt: now };
    const parentId = task.parentId === undefined ? undefined : idMap.get(task.parentId) ?? (existingIds.has(task.parentId) ? task.parentId : undefined);
    if (parentId === undefined) delete restored.parentId;
    else restored.parentId = parentId;
    return restored;
  });
}

function getNextId(tasks: Task[]): number {
  const ids = tasks.map((task) => Number.parseInt(task.id, 10)).filter(Number.isFinite);
  return (ids.length === 0 ? 0 : Math.max(...ids)) + 1;
}
