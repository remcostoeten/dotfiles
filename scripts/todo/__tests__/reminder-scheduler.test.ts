import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRecordingCommandRunner, type CommandRunner } from "@/src/adapters/command-runner";
import { createRecordingNotifier } from "@/src/adapters/notifier";
import { createSilentSoundPlayer, type SoundPlayer } from "@/src/adapters/sound";
import type { Task, TaskReminder } from "@/src/domain/task";
import { runScheduler } from "@/src/scheduler/daemon";
import { findNextWakeAt, processDueReminders, type ReminderEffects } from "@/src/scheduler/reminder-processor";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("fires a reminder whose due time has passed", async () => {
  const store = await createStore([withReminder(createTask({ id: "27", description: "send invoice" }), { dueAt: past() })]);
  const effects = createEffects();

  const fired = await processDueReminders(store, effects);

  expect(fired).toHaveLength(1);
  expect(effects.notifier.sent).toEqual([{ title: "Todo due", body: "#27 · send invoice", urgent: true }]);
});

test("does not fire a reminder that is not due yet", async () => {
  const store = await createStore([withReminder(createTask({ id: "27" }), { dueAt: future() })]);
  const effects = createEffects();

  expect(await processDueReminders(store, effects)).toHaveLength(0);
  expect(effects.notifier.sent).toHaveLength(0);
});

test("fires exactly once, however many times processing runs", async () => {
  const store = await createStore([withReminder(createTask({ id: "27" }), { dueAt: past() })]);
  const effects = createEffects();

  await processDueReminders(store, effects);
  await processDueReminders(store, effects);
  await processDueReminders(store, effects);

  expect(effects.notifier.sent).toHaveLength(1);
  expect((await store.loadTasks())[0]?.reminder?.firedAt).toBeGreaterThan(0);
});

test("a restart does not re-fire an already fired reminder", async () => {
  const paths = getTodoPaths(await createTemporaryDirectory());
  const first = new TodoStore(paths);
  await first.saveTasks([withReminder(createTask({ id: "27" }), { dueAt: past() })]);
  const effects = createEffects();
  await processDueReminders(first, effects);

  const afterRestart = new TodoStore(paths);
  await processDueReminders(afterRestart, effects);

  expect(effects.notifier.sent).toHaveLength(1);
});

test("a reminder that came due while nothing was running fires on the next cycle", async () => {
  const store = await createStore([withReminder(createTask({ id: "27" }), { dueAt: future() })]);
  const effects = createEffects();
  await processDueReminders(store, effects);
  expect(effects.notifier.sent).toHaveLength(0);

  await reschedule(store, "27", past());
  await processDueReminders(store, effects);

  expect(effects.notifier.sent).toHaveLength(1);
});

test("a long suspend is just a late cycle: every overdue reminder fires, each once", async () => {
  const store = await createStore([
    withReminder(createTask({ id: "1" }), { dueAt: past(3 * 86_400_000) }),
    withReminder(createTask({ id: "2" }), { dueAt: past(2 * 86_400_000) }),
    withReminder(createTask({ id: "3" }), { dueAt: past(86_400_000) }),
  ]);
  const effects = createEffects();

  await processDueReminders(store, effects);
  await processDueReminders(store, effects);

  expect(effects.notifier.sent).toHaveLength(3);
});

test("a replacement schedule is eligible even though the previous one already fired", async () => {
  const store = await createStore([withReminder(createTask({ id: "27" }), { dueAt: past() })]);
  const effects = createEffects();
  await processDueReminders(store, effects);

  const tasks = await store.loadTasks();
  const task = tasks[0] as Task;
  task.reminder = { ...(task.reminder as TaskReminder), id: "replacement", dueAt: past() };
  delete task.reminder.firedAt;
  task.dueDate = task.reminder.dueAt;
  await store.saveTasks(tasks);

  await processDueReminders(store, effects);

  expect(effects.notifier.sent).toHaveLength(2);
});

test("a deleted todo never notifies and does not disturb the others", async () => {
  const store = await createStore([
    withReminder(createTask({ id: "27" }), { dueAt: past() }),
    withReminder(createTask({ id: "28", description: "survivor" }), { dueAt: past() }),
  ]);
  await store.saveTasks((await store.loadTasks()).filter((task) => task.id !== "27"));
  const effects = createEffects();

  await processDueReminders(store, effects);

  expect(effects.notifier.sent).toHaveLength(1);
  expect(effects.notifier.sent[0]?.body).toContain("survivor");
});

test("a completed todo does not notify, play a sound, or run its command", async () => {
  const store = await createStore([
    withReminder(createTask({ id: "27", status: "completed" }), { dueAt: past(), run: "echo hi" }),
  ]);
  const effects = createEffects();

  await processDueReminders(store, effects);

  expect(effects.notifier.sent).toHaveLength(0);
  expect(effects.sound.played).toHaveLength(0);
  expect(effects.runner.calls).toHaveLength(0);
  expect((await store.loadTasks())[0]?.reminder?.firedAt).toBeUndefined();
});

test("reopening a todo whose reminder never fired makes it eligible again", async () => {
  const store = await createStore([
    withReminder(createTask({ id: "27", status: "completed" }), { dueAt: past() }),
  ]);
  const effects = createEffects();
  await processDueReminders(store, effects);

  const tasks = await store.loadTasks();
  (tasks[0] as Task).status = "pending";
  await store.saveTasks(tasks);
  await processDueReminders(store, effects);

  expect(effects.notifier.sent).toHaveLength(1);
});

test("reopening a todo after its reminder fired does not re-fire it, but reset does", async () => {
  const store = await createStore([withReminder(createTask({ id: "27" }), { dueAt: past() })]);
  const effects = createEffects();
  await processDueReminders(store, effects);

  const reopened = await store.loadTasks();
  (reopened[0] as Task).status = "pending";
  await store.saveTasks(reopened);
  await processDueReminders(store, effects);
  expect(effects.notifier.sent).toHaveLength(1);

  const rearmed = await store.loadTasks();
  delete (rearmed[0] as Task).reminder?.firedAt;
  await store.saveTasks(rearmed);
  await processDueReminders(store, effects);

  expect(effects.notifier.sent).toHaveLength(2);
});

test("the optional command runs once, in the stored working directory", async () => {
  const store = await createStore([
    withReminder(createTask({ id: "27" }), { dueAt: past(), run: "bun run build", cwd: "/tmp" }),
  ]);
  const effects = createEffects();

  await processDueReminders(store, effects);
  await processDueReminders(store, effects);

  expect(effects.runner.calls).toEqual([{ command: "bun run build", cwd: "/tmp" }]);
  expect((await store.loadTasks())[0]?.reminder?.runExitCode).toBe(0);
});

test("a failing command is recorded but never retried, and the notification stays fired", async () => {
  const store = await createStore([withReminder(createTask({ id: "27" }), { dueAt: past(), run: "exit 1" })]);
  const effects = createEffects({ runner: createRecordingCommandRunner(1) });

  await processDueReminders(store, effects);
  await processDueReminders(store, effects);

  const reminder = (await store.loadTasks())[0]?.reminder;
  expect(reminder?.runExitCode).toBe(1);
  expect(reminder?.firedAt).toBeGreaterThan(0);
  expect(effects.notifier.sent).toHaveLength(1);
});

test("a sound failure stops neither the notification nor the command, and is recorded", async () => {
  const store = await createStore([withReminder(createTask({ id: "27" }), { dueAt: past(), run: "echo hi" })]);
  const failingSound: SoundPlayer = {
    async play() {
      throw new Error("no player available");
    },
  };
  const effects = createEffects({ sound: failingSound });

  await processDueReminders(store, effects);

  expect(effects.notifier.sent).toHaveLength(1);
  expect(effects.runner.calls).toHaveLength(1);
  expect((await store.loadTasks())[0]?.reminder?.soundError).toBe("no player available");
});

test("a failing notification still leaves the reminder fired rather than retrying forever", async () => {
  const store = await createStore([withReminder(createTask({ id: "27" }), { dueAt: past() })]);
  const effects = createEffects({
    notifier: {
      sent: [],
      async notify() {
        throw new Error("no notification daemon");
      },
    },
  });

  await processDueReminders(store, effects);
  await processDueReminders(store, effects);

  expect((await store.loadTasks())[0]?.reminder?.firedAt).toBeGreaterThan(0);
});

test("findNextWakeAt picks the nearest armed reminder and ignores the rest", async () => {
  const now = Date.now();
  const tasks = [
    withReminder(createTask({ id: "1" }), { dueAt: now + 60_000 }),
    withReminder(createTask({ id: "2" }), { dueAt: now + 10_000 }),
    withReminder(createTask({ id: "3" }), { dueAt: now + 5_000, firedAt: now }),
    withReminder(createTask({ id: "4", status: "completed" }), { dueAt: now + 1_000 }),
    withReminder(createTask({ id: "5" }), { dueAt: now - 1_000 }),
  ];

  expect(findNextWakeAt(tasks, now)).toBe(now + 10_000);
  expect(findNextWakeAt([], now)).toBeUndefined();
});

test("the scheduler loop fires what is due and reports when it next needs to wake", async () => {
  const dueAt = Date.now() + 3_600_000;
  const store = await createStore([
    withReminder(createTask({ id: "1" }), { dueAt: past() }),
    withReminder(createTask({ id: "2" }), { dueAt }),
  ]);
  const effects = createEffects();
  const wakes: Array<number | undefined> = [];

  await runScheduler(store, { effects, maxCycles: 1, onCycle: (next) => wakes.push(next) });

  expect(effects.notifier.sent).toHaveLength(1);
  expect(wakes).toEqual([dueAt]);
});

test("a scheduler and a CLI processing at the same time still fire each reminder once", async () => {
  const paths = getTodoPaths(await createTemporaryDirectory());
  const store = new TodoStore(paths);
  await store.saveTasks([
    withReminder(createTask({ id: "1" }), { dueAt: past() }),
    withReminder(createTask({ id: "2" }), { dueAt: past() }),
  ]);
  const effects = createEffects();

  await Promise.all([
    processDueReminders(new TodoStore(paths), effects),
    processDueReminders(new TodoStore(paths), effects),
    processDueReminders(new TodoStore(paths), effects),
  ]);

  expect(effects.notifier.sent).toHaveLength(2);
});

test("stale reminder state is dropped on load instead of crashing the scheduler", async () => {
  const store = await createStore([createTask({ id: "27" })]);
  const tasks = await store.loadTasks();
  (tasks[0] as unknown as Record<string, unknown>).reminder = { nonsense: true };
  await store.saveTasks(tasks as Task[]);

  const effects = createEffects();
  await processDueReminders(store, effects);

  expect((await store.loadTasks())[0]?.reminder).toBeUndefined();
  expect(effects.notifier.sent).toHaveLength(0);
});

function past(offset = 60_000): number {
  return Date.now() - offset;
}

function future(offset = 3_600_000): number {
  return Date.now() + offset;
}

async function reschedule(store: TodoStore, id: string, dueAt: number): Promise<void> {
  const tasks = await store.loadTasks();
  const task = tasks.find((candidate) => candidate.id === id);
  if (task?.reminder !== undefined) {
    task.reminder.dueAt = dueAt;
    task.dueDate = dueAt;
  }
  await store.saveTasks(tasks);
}

interface Effects extends ReminderEffects {
  notifier: ReturnType<typeof createRecordingNotifier>;
  sound: ReturnType<typeof createSilentSoundPlayer>;
  runner: ReturnType<typeof createRecordingCommandRunner>;
}

function createEffects(overrides: Partial<{ notifier: unknown; sound: SoundPlayer; runner: CommandRunner }> = {}): Effects {
  return {
    notifier: createRecordingNotifier(),
    sound: createSilentSoundPlayer(),
    runner: createRecordingCommandRunner(),
    ...overrides,
  } as Effects;
}

function withReminder(task: Task, overrides: Partial<TaskReminder> & { dueAt: number }): Task {
  const reminder: TaskReminder = {
    id: `reminder-${task.id}`,
    expression: "test",
    createdAt: 1,
    soundMode: "default",
    ...overrides,
  };
  return { ...task, reminder, dueDate: reminder.dueAt };
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "todo-sched-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function createStore(tasks: Task[]): Promise<TodoStore> {
  const store = new TodoStore(getTodoPaths(await createTemporaryDirectory()));
  await store.saveTasks(tasks);
  return store;
}

function createTask(overrides: Partial<Task>): Task {
  return {
    id: "1",
    description: "Task",
    status: "pending",
    priority: "none",
    createdAt: 1,
    updatedAt: 1,
    reminderOffsets: [],
    notificationsSent: { reminders: [], overdue: false },
    ...overrides,
  };
}
