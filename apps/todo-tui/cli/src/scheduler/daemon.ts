import { watch } from "node:fs";
import { dirname } from "node:path";
import { createCommandRunner } from "../adapters/command-runner";
import { createNotifier } from "../adapters/notifier";
import { createSoundPlayer } from "../adapters/sound";
import type { TodoStore } from "../storage/todo-store";
import { findNextWakeAt, processDueReminders, type ReminderEffects } from "./reminder-processor";

/**
 * Ceiling on how long the scheduler will sleep. Timers do not advance across suspend on every
 * system, so waking a few times an hour bounds how late a reminder can be after a resume while
 * still being nowhere near a busy loop.
 */
const MAX_SLEEP_MS = 15 * 60 * 1000;
const MIN_SLEEP_MS = 250;
/** Coalesces the burst of writes a single `todo` command makes. */
const WATCH_DEBOUNCE_MS = 150;

export interface DaemonOptions {
  effects?: ReminderEffects;
  /** Stops the loop after this many cycles; tests use it to avoid running forever. */
  maxCycles?: number;
  onCycle?: (nextWakeAt: number | undefined) => void;
  signal?: AbortSignal;
}

/**
 * The one process responsible for every reminder. It never holds a timer per todo: each cycle
 * fires what is due, then sleeps until the nearest upcoming due time, waking early when the task
 * file changes. Because readiness is recomputed from persisted state on every cycle, a restart,
 * a reboot, or a resume from suspend all just look like an early wake-up.
 */
export async function runScheduler(store: TodoStore, options: DaemonOptions = {}): Promise<void> {
  const effects = options.effects ?? createDefaultEffects();
  const watcher = watchTasksFile(store);

  try {
    for (let cycle = 0; options.maxCycles === undefined || cycle < options.maxCycles; cycle += 1) {
      if (options.signal?.aborted === true) return;

      await processDueReminders(store, effects);
      const nextWakeAt = findNextWakeAt(await store.loadTasks(), Date.now());
      options.onCycle?.(nextWakeAt);

      if (options.maxCycles !== undefined && cycle + 1 >= options.maxCycles) return;
      await sleepUntil(nextWakeAt, watcher.changed, options.signal);
    }
  } finally {
    watcher.close();
  }
}

export function createDefaultEffects(): ReminderEffects {
  return { notifier: createNotifier(), sound: createSoundPlayer(), runner: createCommandRunner() };
}

interface TasksWatcher {
  changed: () => Promise<void>;
  close: () => void;
}

/** Watches the containing directory, because the atomic rename replaces the task file's inode. */
function watchTasksFile(store: TodoStore): TasksWatcher {
  const directory = dirname(store.tasksFile);
  let notify: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  let handle: ReturnType<typeof watch> | undefined;
  try {
    handle = watch(directory, () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => notify?.(), WATCH_DEBOUNCE_MS);
    });
    handle.on("error", () => undefined);
  } catch {
    handle = undefined;
  }

  return {
    changed: () => new Promise<void>((resolve) => {
      notify = resolve;
    }),
    close() {
      if (timer !== undefined) clearTimeout(timer);
      handle?.close();
    },
  };
}

function sleepUntil(nextWakeAt: number | undefined, changed: () => Promise<void>, signal: AbortSignal | undefined): Promise<void> {
  const requested = nextWakeAt === undefined ? MAX_SLEEP_MS : nextWakeAt - Date.now();
  const duration = Math.max(MIN_SLEEP_MS, Math.min(MAX_SLEEP_MS, requested));

  return new Promise<void>((resolve) => {
    const timer = setTimeout(finish, duration);
    function finish(): void {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    }
    signal?.addEventListener("abort", finish, { once: true });
    void changed().then(finish);
  });
}
