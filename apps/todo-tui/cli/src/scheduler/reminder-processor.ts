import type { CommandRunner } from "../adapters/command-runner";
import type { Notifier } from "../adapters/notifier";
import type { SoundPlayer } from "../adapters/sound";
import type { Task, TaskReminder } from "../domain/task";
import type { TodoStore } from "../storage/todo-store";

export interface ReminderEffects {
  notifier: Notifier;
  sound: SoundPlayer;
  runner: CommandRunner;
}

export interface FiredReminder {
  taskId: string;
  reminderId: string;
  description: string;
}

interface EffectOutcome {
  taskId: string;
  reminderId: string;
  soundError?: string;
  runExitCode?: number;
  runError?: string;
}

/**
 * Fires every armed reminder whose due time has passed. Reminders are marked fired and persisted
 * *before* any side effect runs, so a crash mid-notification costs one notification rather than
 * repeating it forever; exactly-once per schedule is the stronger guarantee.
 *
 * Notification, sound, and the optional command are independent: each one's failure is recorded
 * and the others still run.
 */
export async function processDueReminders(store: TodoStore, effects: ReminderEffects, now = Date.now()): Promise<FiredReminder[]> {
  const claimed = await store.runExclusive(async () => {
    const tasks = await store.loadTasks();
    const ready = tasks.filter((task) => isReadyToFire(task, now));
    if (ready.length === 0) return [];

    for (const task of ready) {
      if (task.reminder !== undefined) task.reminder.firedAt = now;
    }
    await store.saveTasks(tasks);
    return ready.map((task) => ({ task, reminder: { ...(task.reminder as TaskReminder) } }));
  });

  if (claimed.length === 0) return [];

  const outcomes = await Promise.all(claimed.map(({ task, reminder }) => deliver(task, reminder, effects)));
  await recordOutcomes(store, outcomes);

  return claimed.map(({ task, reminder }) => ({ taskId: task.id, reminderId: reminder.id, description: task.description }));
}

/** A completed task keeps its due date but never notifies; `todo due <id> reset` rearms it. */
export function isReadyToFire(task: Task, now: number): boolean {
  const reminder = task.reminder;
  if (reminder === undefined) return false;
  return task.status === "pending" && reminder.firedAt === undefined && reminder.dueAt <= now;
}

/** The earliest armed reminder still in the future, or `undefined` when nothing is scheduled. */
export function findNextWakeAt(tasks: Task[], now: number): number | undefined {
  const upcoming = tasks
    .filter((task) => task.reminder !== undefined && task.status === "pending" && task.reminder.firedAt === undefined)
    .map((task) => (task.reminder as TaskReminder).dueAt)
    .filter((dueAt) => dueAt > now);
  return upcoming.length === 0 ? undefined : Math.min(...upcoming);
}

async function deliver(task: Task, reminder: TaskReminder, effects: ReminderEffects): Promise<EffectOutcome> {
  const outcome: EffectOutcome = { taskId: task.id, reminderId: reminder.id };

  try {
    await effects.notifier.notify({
      title: "Todo due",
      body: `#${task.id} · ${task.description}`,
      urgent: true,
    });
  } catch {
    // A failed notification is still a fired reminder; retrying would spam on every cycle.
  }

  try {
    await effects.sound.play(reminder);
  } catch (error: unknown) {
    outcome.soundError = error instanceof Error ? error.message : String(error);
  }

  if (reminder.run !== undefined) {
    const result = await effects.runner.run(reminder.run, reminder.cwd);
    outcome.runExitCode = result.exitCode;
    if (result.error !== undefined) outcome.runError = result.error;
  }

  return outcome;
}

/** Writes back what each effect did, skipping reminders that were replaced or deleted meanwhile. */
async function recordOutcomes(store: TodoStore, outcomes: EffectOutcome[]): Promise<void> {
  const interesting = outcomes.filter((outcome) => outcome.soundError !== undefined || outcome.runExitCode !== undefined);
  if (interesting.length === 0) return;

  await store.runExclusive(async () => {
    const tasks = await store.loadTasks();
    let changed = false;
    for (const outcome of interesting) {
      const reminder = tasks.find((task) => task.id === outcome.taskId)?.reminder;
      if (reminder === undefined || reminder.id !== outcome.reminderId) continue;
      if (outcome.soundError !== undefined) reminder.soundError = outcome.soundError;
      if (outcome.runExitCode !== undefined) reminder.runExitCode = outcome.runExitCode;
      if (outcome.runError !== undefined) reminder.runError = outcome.runError;
      changed = true;
    }
    if (changed) await store.saveTasks(tasks);
  });
}
