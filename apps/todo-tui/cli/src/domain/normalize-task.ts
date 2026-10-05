import type { NotificationState, SoundMode, Task, TaskKind, TaskPriority, TaskReminder, TaskStatus } from "./task";

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
  if (typeof value.parentId === "string" && value.parentId.length > 0) {
    task.parentId = value.parentId;
  }
  const kind = readKind(value.kind);
  if (kind !== undefined) task.kind = kind;
  if (value.hidden === true) task.hidden = true;

  const reminder = readReminder(value.reminder);
  if (reminder !== undefined) {
    task.reminder = reminder;
    task.dueDate = reminder.dueAt;
  }

  return task;
}

/** A malformed reminder is dropped rather than thrown on, so a bad entry can never wedge the scheduler. */
function readReminder(value: unknown): TaskReminder | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.id !== "string" || value.id.length === 0) return undefined;
  if (typeof value.dueAt !== "number" || !Number.isFinite(value.dueAt)) return undefined;

  const reminder: TaskReminder = {
    id: value.id,
    dueAt: value.dueAt,
    expression: typeof value.expression === "string" ? value.expression : "",
    createdAt: typeof value.createdAt === "number" && Number.isFinite(value.createdAt) ? value.createdAt : value.dueAt,
    soundMode: readSoundMode(value.soundMode),
  };

  if (typeof value.soundPath === "string" && value.soundPath.length > 0) reminder.soundPath = value.soundPath;
  if (typeof value.run === "string" && value.run.length > 0) reminder.run = value.run;
  if (typeof value.cwd === "string" && value.cwd.length > 0) reminder.cwd = value.cwd;
  if (typeof value.firedAt === "number" && Number.isFinite(value.firedAt)) reminder.firedAt = value.firedAt;
  if (typeof value.soundError === "string") reminder.soundError = value.soundError;
  if (typeof value.runExitCode === "number" && Number.isFinite(value.runExitCode)) reminder.runExitCode = value.runExitCode;
  if (typeof value.runError === "string") reminder.runError = value.runError;
  return reminder;
}

function readSoundMode(value: unknown): SoundMode {
  return value === "none" || value === "custom" ? value : "default";
}

function readStatus(value: unknown, index: number): TaskStatus {
  if (value === "pending" || value === "completed") return value;
  throw new Error(`Task at index ${index} has an invalid status`);
}

function readKind(value: unknown): TaskKind | undefined {
  return value === "epic" ? "epic" : undefined;
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
