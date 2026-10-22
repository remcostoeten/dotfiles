import type { CommandSpec } from "../command-spec/types";
import { resetNotificationState } from "../notifications";
import { tryParseDueDate } from "../domain/due-date";
import { UserInputError } from "../domain/user-input-error";
import type { Task } from "../domain/task";
import { nextTaskId } from "../services/boards";

const DIM = "\u001B[2m";
const GREEN = "\u001B[32m";
const RESET = "\u001B[0m";

export const undoCommand: CommandSpec = {
  name: "undo",
  aliases: ["revert", "restore"],
  summary: "Restore the most recently deleted task or tasks.",
  group: "Remove",
  details: ["Only the most recent rm, rm all, or taskboard delete is kept. Restored tasks get fresh IDs and do not return to boards."],
  examples: [
    { command: "todo undo", note: "bring back what the last rm removed, under new IDs" },
    { command: "todo archive restore r3", note: "an older removal" },
  ],
  async run(_input, { store, stdout }) {
    const undo = await store.loadUndo();
    if (undo === undefined || undo.tasks.length === 0) {
      stdout.write(`${DIM}Nothing to undo${RESET}\n`);
      return;
    }

    const tasks = await store.loadTasks();
    const restoredTasks = restoreTasks(tasks, undo.tasks);
    await store.saveTasks([...tasks, ...restoredTasks]);
    await store.forgetRemovedBatch(undo.timestamp);
    await store.clearUndo();
    stdout.write(`${GREEN}Restored ${restoredTasks.length} task(s)${RESET}\n`);
  },
};

export const snoozeCommand: CommandSpec = {
  name: "snooze",
  summary: "Push a task's due date forward.",
  group: "Change",
  args: [
    { name: "id", kind: "task-id", description: "Task to snooze" },
    { name: "time", kind: "due-time", variadic: true, description: "1h, 30m, tomorrow, monday, next week, 16/08/2026" },
  ],
  details: ["Sets a new due date and resets reminder notifications for the task."],
  examples: [
    { command: "todo snooze 4 1h" },
    { command: "todo snooze 4 tomorrow" },
    { command: "todo snooze 4 next week" },
    { command: "todo snooze 4 16/08/2026" },
  ],
  async run(input, { store, stdout }) {
    const id = input.arg("id");
    const dueDate = tryParseDueDate(input.args("time").join(" "));
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
  },
};

/** Re-inserts deleted tasks with fresh IDs, keeping parent links inside the restored set and to still-existing tasks. */
export function restoreTasks(tasks: Task[], deletedTasks: Task[]): Task[] {
  let nextId = nextTaskId(tasks);
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
