import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "@/src/domain/task";
import { duePlugin } from "@/src/plugins/due";
import { PluginRegistry } from "@/src/plugins/registry";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("sets a due date and stores an armed reminder against the stable id", async () => {
  const store = await createStore([createTask({ id: "27", description: "send invoice" })]);

  const output = await runDue(["27", "1h"], store);

  const [task] = await store.loadTasks();
  expect(task?.reminder?.dueAt).toBeGreaterThan(Date.now());
  expect(task?.reminder?.firedAt).toBeUndefined();
  expect(task?.reminder?.expression).toBe("1h");
  expect(task?.dueDate).toBe(task?.reminder?.dueAt as number);
  expect(output).toContain("Due #27");
});

test("accepts a #-prefixed id and a multi-word expression with a time", async () => {
  const store = await createStore([createTask({ id: "27" })]);

  await runDue(["#27", "next", "monday", "at", "09:00"], store);

  const due = new Date((await store.loadTasks())[0]?.reminder?.dueAt as number);
  expect(due.getDay()).toBe(1);
  expect(due.getHours()).toBe(9);
  expect(due.getMinutes()).toBe(0);
});

test("resolves a todo by its exact name using the existing lookup", async () => {
  const store = await createStore([createTask({ id: "27", description: "send invoice" })]);

  await runDue(["send invoice", "2h"], store);

  expect((await store.loadTasks())[0]?.reminder).toBeDefined();
});

test("inspecting shows the exact timestamp, relative distance, and reminder state", async () => {
  const store = await createStore([createTask({ id: "27", description: "send invoice" })]);
  await runDue(["27", "2h"], store);

  const output = await runDue(["27"], store);

  expect(output).toContain("Todo #27");
  expect(output).toContain("Due:");
  expect(output).toContain("Relative:");
  expect(output).toMatch(/in (2h|1h 59m)/);
  expect(output).toContain("enabled");
  expect(output).toContain("default");
});

test("inspecting a todo without a due date says so instead of failing", async () => {
  const store = await createStore([createTask({ id: "27" })]);

  expect(await runDue(["27"], store)).toContain("No due date");
});

test("a replacement due date invalidates the previous schedule and rearms", async () => {
  const store = await createStore([createTask({ id: "27" })]);
  await runDue(["27", "tomorrow"], store);

  const first = (await store.loadTasks())[0]?.reminder;
  await markFired(store, "27");
  await runDue(["27", "2h"], store);

  const second = (await store.loadTasks())[0]?.reminder;
  expect(second?.id).not.toBe(first?.id as string);
  expect(second?.firedAt).toBeUndefined();
  expect(second?.dueAt).not.toBe(first?.dueAt as number);
});

test("a replacement reminder does not inherit the previous sound or trigger", async () => {
  const store = await createStore([createTask({ id: "27" })]);
  await runDue(["27", "1h", "--sound", "none", "--run", "echo one"], store);
  await runDue(["27", "2h"], store);

  const reminder = (await store.loadTasks())[0]?.reminder;
  expect(reminder?.soundMode).toBe("default");
  expect(reminder?.run).toBeUndefined();
});

test("clear removes the due date but keeps the todo", async () => {
  const store = await createStore([createTask({ id: "27", description: "send invoice" })]);
  await runDue(["27", "1h"], store);

  expect(await runDue(["27", "clear"], store)).toContain("Cleared");

  const [task] = await store.loadTasks();
  expect(task?.description).toBe("send invoice");
  expect(task?.reminder).toBeUndefined();
  expect(task?.dueDate).toBeUndefined();
  expect(await runDue(["27"], store)).toContain("No due date");
});

test("remove is accepted as a synonym of clear", async () => {
  const store = await createStore([createTask({ id: "27" })]);
  await runDue(["27", "1h"], store);

  await runDue(["27", "remove"], store);

  expect((await store.loadTasks())[0]?.reminder).toBeUndefined();
});

test("reset rearms the current schedule without changing the due date", async () => {
  const store = await createStore([createTask({ id: "27" })]);
  await runDue(["27", "yesterday"], store);
  const before = (await store.loadTasks())[0]?.reminder;
  await markFired(store, "27");

  expect(await runDue(["27", "reset"], store)).toContain("Rearmed");

  const after = (await store.loadTasks())[0]?.reminder;
  expect(after?.firedAt).toBeUndefined();
  expect(after?.dueAt).toBe(before?.dueAt as number);
  expect(after?.id).toBe(before?.id as string);
});

test("reset refuses a todo that has no due date", async () => {
  const store = await createStore([createTask({ id: "27" })]);

  expect(runDue(["27", "reset"], store)).rejects.toThrow("has no due date to reset");
});

test("a past expression is stored, renders overdue, and stays armed", async () => {
  const store = await createStore([createTask({ id: "27" })]);

  await runDue(["27", "yesterday"], store);

  const reminder = (await store.loadTasks())[0]?.reminder;
  expect(reminder?.dueAt).toBeLessThan(Date.now());
  expect(reminder?.firedAt).toBeUndefined();
  expect(await runDue(["27"], store)).toContain("overdue by");
});

test("a future expression stays upcoming", async () => {
  const store = await createStore([createTask({ id: "27" })]);

  await runDue(["27", "2d"], store);

  const reminder = (await store.loadTasks())[0]?.reminder;
  expect(reminder?.dueAt).toBeGreaterThan(Date.now());
  expect(reminder?.firedAt).toBeUndefined();

  const output = await runDue(["27"], store);
  expect(output).toMatch(/in (2d|1d 23h)/);
  expect(output).not.toContain("overdue");
});

test("due list orders overdue first and then upcoming soonest first", async () => {
  const now = Date.now();
  const store = await createStore([
    createTask({ id: "12", description: "deploy release", dueDate: now - 2 * 86_400_000 }),
    createTask({ id: "27", description: "send invoice", dueDate: now + 90 * 60_000 }),
    createTask({ id: "33", description: "write docs", dueDate: now + 30 * 3_600_000 }),
    createTask({ id: "41", description: "no due date" }),
    createTask({ id: "50", description: "completed", status: "completed", dueDate: now }),
  ]);

  const output = await runDue(["list"], store);

  expect(output.indexOf("deploy release")).toBeLessThan(output.indexOf("send invoice"));
  expect(output.indexOf("send invoice")).toBeLessThan(output.indexOf("write docs"));
  expect(output).not.toContain("no due date");
  expect(output).not.toContain("completed");
  expect(output).toContain("overdue 2d");
  expect(output).toContain("due in 1h");
});

test("due list filters by overdue, today, and week", async () => {
  const now = Date.now();
  const store = await createStore([
    createTask({ id: "1", description: "past", dueDate: now - 3_600_000 }),
    createTask({ id: "2", description: "soon", dueDate: now + 60_000 }),
    createTask({ id: "3", description: "nextmonth", dueDate: now + 40 * 86_400_000 }),
  ]);

  expect(await runDue(["list", "overdue"], store)).toContain("past");
  expect(await runDue(["list", "overdue"], store)).not.toContain("soon");
  expect(await runDue(["list", "week"], store)).toContain("soon");
  expect(await runDue(["list", "week"], store)).not.toContain("nextmonth");
  expect(runDue(["list", "nonsense"], store)).rejects.toThrow("Unknown filter");
});

test("due list says so when nothing has a due date", async () => {
  const store = await createStore([createTask({ id: "1" })]);

  expect(await runDue(["list"], store)).toContain("No todos with a due date");
});

test("a custom sound path is expanded, validated, and stored as an absolute path", async () => {
  const directory = await createTemporaryDirectory();
  const soundPath = join(directory, "alert.mp3");
  await writeFile(soundPath, "");
  const store = await createStore([createTask({ id: "27" })]);

  await runDue(["27", "1h", "--sound", soundPath], store);

  const reminder = (await store.loadTasks())[0]?.reminder;
  expect(reminder?.soundMode).toBe("custom");
  expect(reminder?.soundPath).toBe(soundPath);
});

test("sound accepts default and none", async () => {
  const store = await createStore([createTask({ id: "27" })]);

  await runDue(["27", "1h", "--sound", "none"], store);
  expect((await store.loadTasks())[0]?.reminder?.soundMode).toBe("none");

  await runDue(["27", "1h", "--sound", "default"], store);
  expect((await store.loadTasks())[0]?.reminder?.soundMode).toBe("default");
});

test("an unusable sound is rejected before anything is saved", async () => {
  const directory = await createTemporaryDirectory();
  const store = await createStore([createTask({ id: "27" })]);

  expect(runDue(["27", "1h", "--sound", join(directory, "missing.mp3")], store)).rejects.toThrow("Sound file not found");
  expect(runDue(["27", "1h", "--sound", directory], store)).rejects.toThrow("Unsupported sound format");
  expect((await store.loadTasks())[0]?.reminder).toBeUndefined();
});

test("a directory with an audio extension is rejected as not a file", async () => {
  const directory = await createTemporaryDirectory();
  const fake = join(directory, "notaudio.mp3");
  await mkdir(fake);
  const store = await createStore([createTask({ id: "27" })]);

  expect(runDue(["27", "1h", "--sound", fake], store)).rejects.toThrow("not a file");
});

test("--cwd pwd captures the current directory rather than the literal word", async () => {
  const store = await createStore([createTask({ id: "27" })]);

  await runDue(["27", "10m", "--run", "bun run build", "--cwd", "pwd"], store);

  const reminder = (await store.loadTasks())[0]?.reminder;
  expect(reminder?.run).toBe("bun run build");
  expect(reminder?.cwd).toBe(process.cwd());
});

test("a relative cwd becomes absolute and a missing one is rejected", async () => {
  const store = await createStore([createTask({ id: "27" })]);

  await runDue(["27", "10m", "--run", "echo hi", "--cwd", "."], store);
  expect((await store.loadTasks())[0]?.reminder?.cwd).toBe(process.cwd());

  expect(runDue(["27", "10m", "--run", "echo hi", "--cwd", "/definitely/not/here"], store)).rejects.toThrow("Working directory not found");
});

test("--cwd without --run is refused rather than silently ignored", async () => {
  const store = await createStore([createTask({ id: "27" })]);

  expect(runDue(["27", "10m", "--cwd", "pwd"], store)).rejects.toThrow("--cwd only applies to --run");
});

test("an unknown flag names the supported ones", async () => {
  const store = await createStore([createTask({ id: "27" })]);

  expect(runDue(["27", "10m", "--bogus", "x"], store)).rejects.toThrow("Unknown option: --bogus");
});

test("every help form renders and none of them mutate anything", async () => {
  const store = await createStore([createTask({ id: "27" })]);
  await runDue(["27", "tomorrow"], store);
  const before = JSON.stringify(await store.loadTasks());

  expect(await runDue(["help"], store)).toContain("todo due");
  expect(await runDue(["-h"], store)).toContain("RELATIVE");
  expect(await runDue(["--help"], store)).toContain("CALENDAR");
  expect(await runDue(["list", "--help"], store)).toContain("todo due list");
  expect(await runDue(["27", "--help"], store)).toContain("todo due <todo>");
  expect(await runDue(["27", "clear", "--help"], store)).toContain("remove a due date");
  expect(await runDue(["27", "reset", "--help"], store)).toContain("rearm the notification");
  expect(await runDue(["daemon", "--help"], store)).toContain("background scheduler");

  expect(JSON.stringify(await store.loadTasks())).toBe(before);
});

test("help wins over a clear or reset that would otherwise run", async () => {
  const store = await createStore([createTask({ id: "27" })]);
  await runDue(["27", "tomorrow"], store);

  await runDue(["27", "clear", "-h"], store);
  await runDue(["27", "reset", "help"], store);

  expect((await store.loadTasks())[0]?.reminder).toBeDefined();
});

test("an unknown todo and a malformed date are both rejected", async () => {
  const store = await createStore([createTask({ id: "27" })]);

  expect(runDue(["99", "1h"], store)).rejects.toThrow("Task not found");
  expect(runDue(["27", "10x"], store)).rejects.toThrow('Invalid due date: "10x"');
  expect((await store.loadTasks())[0]?.reminder).toBeUndefined();
});

test("concurrent due changes to different todos do not clobber each other", async () => {
  const paths = getTodoPaths(await createTemporaryDirectory());
  const store = new TodoStore(paths);
  await store.saveTasks(Array.from({ length: 8 }, (_unused, index) => createTask({ id: `${index + 1}` })));

  await Promise.all(
    Array.from({ length: 8 }, (_unused, index) => runDue([`${index + 1}`, `${index + 1}h`], new TodoStore(paths))),
  );

  const tasks = await store.loadTasks();
  expect(tasks.filter((task) => task.reminder !== undefined)).toHaveLength(8);
});

async function markFired(store: TodoStore, id: string): Promise<void> {
  const tasks = await store.loadTasks();
  const reminder = tasks.find((task) => task.id === id)?.reminder;
  if (reminder !== undefined) reminder.firedAt = Date.now();
  await store.saveTasks(tasks);
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "todo-due-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function createStore(tasks: Task[]): Promise<TodoStore> {
  const store = new TodoStore(getTodoPaths(await createTemporaryDirectory()));
  await store.saveTasks(tasks);
  return store;
}

export function createTask(overrides: Partial<Task>): Task {
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

async function runDue(args: string[], store: TodoStore): Promise<string> {
  const registry = new PluginRegistry();
  registry.use(duePlugin);
  const command = registry.getCommand("due");
  if (command === undefined) throw new Error("due command not registered");

  let output = "";
  const stdout = {
    write(chunk: string | Uint8Array) {
      output += chunk.toString();
      return true;
    },
  } as Pick<typeof process.stdout, "write">;

  await command.handler({ args, store, stdout, stderr: stdout, commands: registry.listCommands() });
  return output;
}
