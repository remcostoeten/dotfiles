import type { NotificationState, Task, TaskPriority, TaskStatus } from "./task";

export function normalizeTasks(value: unknown): Task[] {
  if (!Array.isArray(value)) {
    throw new Error("Tasks data must be an array");
  }

  return value.map((task, index) => normalizeTask(task, index));
}

function normalizeTask(value: unknown, index: number): Task {
  if (!isRecord(value)) {
    throw new Error(`Task at index ${index} must be an object`);
  }

  const task: Task = {
    id: readString(value.id, "id", index),
    description: readString(value.description, "description", index),
    status: readStatus(value.status, index),
    priority: readPriority(value.priority),
    createdAt: readNumber(value.createdAt, "createdAt", index),
    updatedAt: readNumber(value.updatedAt, "updatedAt", index),
    reminderOffsets: readNumberArray(value.reminderOffsets),
    notificationsSent: readNotificationState(value.notificationsSent),
  };

  if (typeof value.dueDate === "number" && Number.isFinite(value.dueDate)) {
    task.dueDate = value.dueDate;
  }

  return task;
}

function readStatus(value: unknown, index: number): TaskStatus {
  if (value === "pending" || value === "completed") return value;
  throw new Error(`Task at index ${index} has an invalid status`);
}

function readPriority(value: unknown): TaskPriority {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "none";
}

function readNotificationState(value: unknown): NotificationState {
  if (!isRecord(value)) return { reminders: [], overdue: false };

  return {
    reminders: readNumberArray(value.reminders),
    overdue: value.overdue === true,
  };
}

function readNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
}

function readString(value: unknown, field: string, index: number): string {
  if (typeof value === "string") return value;
  throw new Error(`Task at index ${index} has an invalid ${field}`);
}

function readNumber(value: unknown, field: string, index: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error(`Task at index ${index} has an invalid ${field}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
