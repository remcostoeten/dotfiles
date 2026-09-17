export type TaskId = string;

export type TaskStatus = "pending" | "completed";
export type TaskPriority = "none" | "low" | "medium" | "high";
export type TaskKind = "epic";

export interface NotificationState {
  reminders: number[];
  overdue: boolean;
}

export type SoundMode = "default" | "none" | "custom";

/**
 * The due schedule owned by the `due` command: at most one per task. Fired state belongs to this
 * record, so replacing the schedule (which mints a new `id`) rearms the notification by construction.
 */
export interface TaskReminder {
  /** Identity of this schedule; a replacement due date gets a fresh one. */
  id: string;
  /** Absolute local timestamp, and the scheduling source of truth. */
  dueAt: number;
  /** What the user typed, kept for display and debugging only. */
  expression: string;
  createdAt: number;
  soundMode: SoundMode;
  /** Absolute path, resolved and validated when the due date was configured. */
  soundPath?: string;
  run?: string;
  /** Absolute working directory for `run`. */
  cwd?: string;
  firedAt?: number;
  soundError?: string;
  runExitCode?: number;
  runError?: string;
}

export interface Task {
  id: TaskId;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  updatedAt: number;
  dueDate?: number;
  parentId?: TaskId;
  kind?: TaskKind;
  hidden?: boolean;
  reminderOffsets: number[];
  notificationsSent: NotificationState;
  /** Set by `todo due`; when present it owns the task's due date and notification. */
  reminder?: TaskReminder;
}

export interface TodoConfig {
  schemaVersion: 1;
  defaultReminderOffsets: number[];
  showNotificationsOnStartup: boolean;
  showCompletedTasksByDefault: boolean;
  shellDisplayLimit: number;
  undoTimeout: number;
  autocorrect: boolean;
  /** Ids of epics collapsed in the list and shell panel; everything else renders expanded. */
  collapsedEpicIds: TaskId[];
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
  undoTimeout: 86_400_000,
  autocorrect: true,
  collapsedEpicIds: [],
};

export const UNLIMITED_SHELL_DISPLAY = 0;
