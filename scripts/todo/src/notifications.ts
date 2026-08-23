import { spawnSync } from "node:child_process";
import type { Task } from "./domain/task";
import type { TodoStore } from "./storage/todo-store";

export async function sendDueNotifications(store: TodoStore, now = Date.now()): Promise<void> {
  const tasks = await store.loadTasks();
  let changed = false;

  for (const task of tasks) {
    if (task.status !== "pending" || task.dueDate === undefined) continue;

    if (task.dueDate < now && !task.notificationsSent.overdue) {
      sendNotification("Task Overdue", `${task.description} - due ${formatDueDate(task.dueDate)}`);
      task.notificationsSent.overdue = true;
      changed = true;
    }

    for (const offset of task.reminderOffsets) {
      if (now < task.dueDate - offset * 60_000 || task.notificationsSent.reminders.includes(offset)) continue;
      sendNotification("Task Reminder", `${task.description} - due in ${offset} minutes`);
      task.notificationsSent.reminders.push(offset);
      changed = true;
    }
  }

  if (changed) await store.saveTasks(tasks);
}

function sendNotification(title: string, message: string): void {
  spawnSync("notify-send", [title, message], { stdio: "ignore" });
}

function formatDueDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(timestamp);
}

export function resetNotificationState(task: Task): void {
  task.notificationsSent = { reminders: [], overdue: false };
}
