export type TaskId = string;

export type TaskStatus = "pending" | "completed";
export type TaskPriority = "none" | "low" | "medium" | "high";

export interface NotificationState {
  reminders: number[];
  overdue: boolean;
}

export interface Task {
  id: TaskId;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  updatedAt: number;
  dueDate?: number;
  reminderOffsets: number[];
  notificationsSent: NotificationState;
}

export interface TodoConfig {
  schemaVersion: 1;
  defaultReminderOffsets: number[];
  showNotificationsOnStartup: boolean;
  showCompletedTasksByDefault: boolean;
  shellDisplayLimit: number;
  undoTimeout: number;
}

export interface UndoData {
  tasks: Task[];
  timestamp: number;
  expiresAt: number;
}

export const DEFAULT_CONFIG: TodoConfig = {
  schemaVersion: 1,
  defaultReminderOffsets: [10, 30, 60],
  showNotificationsOnStartup: true,
  showCompletedTasksByDefault: false,
  shellDisplayLimit: 5,
  undoTimeout: 5_000,
};

export const UNLIMITED_SHELL_DISPLAY = 0;
