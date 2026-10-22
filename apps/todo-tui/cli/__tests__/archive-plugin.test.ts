import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArchiveArgs } from "@/src/domain/archive";
import type { Task } from "@/src/domain/task";
import { runTodo } from "./support/run-todo";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("archive lists completed tasks newest first", async () => {
  const store = await createStore([
    createTask("1", { description: "Older", status: "completed", updatedAt: 10 }),
    createTask("2", { description: "Pending", updatedAt: 30 }),
    createTask("3", { description: "Newer", status: "completed", updatedAt: 20 }),
  ]);

  const output = await runCommand("archive", [], store);
  expect(output.indexOf("Newer")).toBeLessThan(output.indexOf("Older"));
  expect(output).not.toContain("Pending");
});

test("archive reports when there is nothing archived", async () => {
  const store = await createStore([createTask("1")]);

  expect(await runCommand("archive", [], store)).toContain("No archived tasks found");
});

test("rm keeps removed tasks in the archive with their subtasks", async () => {
  const store = await createStore([createTask("1", { description: "Parent" }), createTask("2", { description: "Child", parentId: "1" }), createTask("3")]);

  await runCommand("rm", ["1"], store);

  expect((await store.loadTasks()).map((task) => task.id)).toEqual(["3"]);
  expect((await store.loadRemoved()).map((entry) => [entry.ref, entry.task.description])).toEqual([[1, "Parent"], [2, "Child"]]);
  const output = await runCommand("archive", ["--removed"], store);
  expect(output).toContain("r1");
  expect(output).toContain("Child");
});

test("undo takes the restored batch back out of the archive", async () => {
  const store = await createStore([createTask("1"), createTask("2")]);

  await runCommand("rm", ["1"], store);
  await runCommand("rm", ["2"], store);
  await runCommand("undo", [], store);

  expect((await store.loadRemoved()).map((entry) => entry.task.id)).toEqual(["1"]);
});

test("archive restore recreates removed tasks and keeps their tree", async () => {
  const store = await createStore([createTask("1", { description: "Parent" }), createTask("2", { description: "Child", parentId: "1" }), createTask("5")]);
  await runCommand("rm", ["1"], store);

  expect(await runCommand("archive", ["restore", "r1,r2"], store)).toContain("Restored 2 task(s)");

  const tasks = await store.loadTasks();
  const parent = tasks.find((task) => task.description === "Parent");
  const child = tasks.find((task) => task.description === "Child");
  expect(parent?.id).toBe("6");
  expect(child?.parentId).toBe("6");
  expect(await store.loadRemoved()).toEqual([]);
});

test("archive restore --to re-assigns under another task", async () => {
  const store = await createStore([createTask("1"), createTask("2", { description: "Epic" })]);
  await runCommand("rm", ["1"], store);

  await runCommand("archive", ["restore", "r1", "--to", "2"], store);

  expect((await store.loadTasks()).find((task) => task.description === "Task 1")?.parentId).toBe("2");
});

test("archive restore reopens completed tasks and rejects unknown refs", async () => {
  const store = await createStore([createTask("1", { status: "completed" })]);

  await runCommand("archive", ["restore", "#1"], store);
  expect((await store.loadTasks())[0]?.status).toBe("pending");
  await expect(runCommand("archive", ["restore", "r9"], store)).rejects.toThrow("Not in archive: r9");
});

test("archive filters by text, kind and date", async () => {
  const store = await createStore([createTask("1", { description: "buy milk", status: "completed", updatedAt: 1 }), createTask("2", { description: "buy bread" })]);
  await runCommand("rm", ["2"], store);

  const output = await runCommand("archive", ["buy", "--since", "1d"], store);
  expect(output).toContain("bread");
  expect(output).not.toContain("milk");
  expect(await runCommand("archive", ["--done"], store)).not.toContain("bread");
});

test("parseArchiveArgs reads flags and query words", () => {
  const now = new Date(2026, 8, 23, 12);
  const parsed = parseArchiveArgs(["groceries", "--removed", "--since", "7d", "-i"], now);
  expect(parsed.interactive).toBe(true);
  expect(parsed.filter.kind).toBe("removed");
  expect(parsed.filter.query).toBe("groceries");
  expect(parsed.filter.since).toBeLessThan(now.getTime());
});

function createTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    description: `Task ${id}`,
    status: "pending",
    priority: "none",
    createdAt: 1,
    updatedAt: 1,
    reminderOffsets: [],
    notificationsSent: { reminders: [], overdue: false },
    ...overrides,
  };
}

async function createStore(tasks: Task[]): Promise<TodoStore> {
  const dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-"));
  temporaryDirectories.push(dataDirectory);
  const store = new TodoStore(getTodoPaths(dataDirectory));
  await store.saveTasks(tasks);
  return store;
}

async function runCommand(name: string, args: string[], store: TodoStore): Promise<string> {
  return await runTodo(store, [name, ...args]);
}
