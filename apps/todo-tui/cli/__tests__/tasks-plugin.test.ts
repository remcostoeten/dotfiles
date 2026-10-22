import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "@/src/domain/task";
import { runTodo } from "./support/run-todo";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("list defaults to pending tasks ordered by due date", async () => {
  const store = await createStore([
    createTask({ id: "1", description: "No deadline" }),
    createTask({ id: "2", description: "Later", dueDate: Date.now() + 4 * 60 * 60 * 1000 }),
    createTask({ id: "3", description: "Completed", status: "completed" }),
    createTask({ id: "4", description: "Sooner", dueDate: Date.now() + 3 * 60 * 60 * 1000 }),
  ]);

  const output = await runTasksCommand("list", [], store);

  expect(output).not.toContain("Completed");
  expect(output.indexOf("Sooner")).toBeLessThan(output.indexOf("Later"));
  expect(output.indexOf("Later")).toBeLessThan(output.indexOf("No deadline"));
});

test("list supports all, overdue, and upcoming filters", async () => {
  const now = Date.now();
  const store = await createStore([
    createTask({ id: "1", description: "Overdue", dueDate: now - 60_000 }),
    createTask({ id: "2", description: "Upcoming", dueDate: now + 10 * 60_000 }),
    createTask({ id: "3", description: "Later", dueDate: now + 3 * 60 * 60_000 }),
    createTask({ id: "4", description: "Completed", status: "completed" }),
  ]);

  expect(await runTasksCommand("list", ["--overdue"], store)).toContain("Overdue");
  expect(await runTasksCommand("list", ["--overdue"], store)).not.toContain("Upcoming");
  expect(await runTasksCommand("list", ["--upcoming"], store)).toContain("Upcoming");
  expect(await runTasksCommand("list", ["--upcoming"], store)).not.toContain("Later");
  expect(await runTasksCommand("list", ["--all"], store)).toContain("Completed");
});

test("panel shows the first five pending tasks in shell order", async () => {
  const now = Date.now();
  const store = await createStore([
    createTask({ id: "1", description: "First", createdAt: 1 }),
    createTask({ id: "2", description: "Due first", dueDate: now + 60_000, createdAt: 6 }),
    createTask({ id: "3", description: "Second", createdAt: 2 }),
    createTask({ id: "4", description: "Third", createdAt: 3 }),
    createTask({ id: "5", description: "Fourth", createdAt: 4 }),
    createTask({ id: "6", description: "Hidden", createdAt: 5 }),
    createTask({ id: "7", description: "Completed", status: "completed" }),
  ]);

  const output = await runTasksCommand("panel", [], store);

  expect(output).not.toContain("open");
  expect(output.indexOf("Due first")).toBeLessThan(output.indexOf("First"));
  expect(output).toContain("\u001B[2m#02\u001B[0m");
  expect(output).not.toContain("Hidden");
  expect(output).toContain("↳ 1 more task");
});

test("panel honours the configured limit", async () => {
  const store = await createStore(buildPendingTasks(8));
  await store.saveConfig({ ...(await store.loadConfig()), panelLimit: 7 });

  const output = await runTasksCommand("panel", [], store);

  expect(output).toContain("Task 7");
  expect(output).not.toContain("Task 8");
  expect(output).toContain("↳ 1 more task");
});

test("panel shows every pending task when the limit is all", async () => {
  const store = await createStore(buildPendingTasks(12));
  await store.saveConfig({ ...(await store.loadConfig()), panelLimit: 0 });

  const output = await runTasksCommand("panel", [], store);

  expect(output).toContain("Task 12");
  expect(output).not.toContain("more task");
});

test("panel arguments and TODO_PANEL_LIMIT override the configured limit", async () => {
  const store = await createStore(buildPendingTasks(6));

  expect(await runTasksCommand("panel", ["--limit", "2"], store)).toContain("↳ 4 more tasks");
  expect(await runTasksCommand("panel", ["--limit=3"], store)).toContain("↳ 3 more tasks");
  expect(await runTasksCommand("panel", ["--all"], store)).toContain("Task 6");

  process.env.TODO_PANEL_LIMIT = "1";
  try {
    expect(await runTasksCommand("panel", [], store)).toContain("↳ 5 more tasks");
  } finally {
    delete process.env.TODO_PANEL_LIMIT;
  }
});

test("panel rejects a limit that is not a count", async () => {
  const store = await createStore(buildPendingTasks(2));

  expect(runTasksCommand("panel", ["--limit", "lots"], store)).rejects.toThrow("Invalid count");
});

test("panel reports completed tasks when no tasks are pending", async () => {
  const store = await createStore([createTask({ status: "completed" })]);

  expect(await runTasksCommand("panel", [], store)).toContain("✓ All caught up");
  expect(await runTasksCommand("panel", [], store)).toContain("· 1 completed");
});

async function createStore(tasks: Task[]): Promise<TodoStore> {
  const dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-"));
  temporaryDirectories.push(dataDirectory);
  const store = new TodoStore(getTodoPaths(dataDirectory));
  await store.saveTasks(tasks);
  return store;
}

function buildPendingTasks(count: number): Task[] {
  return Array.from({ length: count }, (_unused, index) =>
    createTask({ id: `${index + 1}`, description: `Task ${index + 1}`, createdAt: index + 1 }));
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

async function runTasksCommand(name: string, args: string[], store: TodoStore): Promise<string> {
  return await runTodo(store, [name, ...args]);
}
