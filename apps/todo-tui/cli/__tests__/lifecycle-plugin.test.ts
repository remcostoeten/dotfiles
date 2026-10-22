import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "@/src/domain/task";
import { UserInputError } from "@/src/domain/user-input-error";
import { runTodo } from "./support/run-todo";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("done completes a pending task and records an update time", async () => {
  const store = await createStore([createTask({ id: "1", updatedAt: 1 })]);

  expect(await runCommand("done", ["1"], store)).toContain("Task marked as completed");
  expect(await store.loadTasks()).toMatchObject([{ id: "1", status: "completed" }]);
  expect((await store.loadTasks())[0]?.updatedAt).toBeGreaterThan(1);
});

test("done leaves an already completed task unchanged", async () => {
  const store = await createStore([createTask({ id: "1", status: "completed", updatedAt: 42 })]);

  expect(await runCommand("done", ["1"], store)).toContain("Task already completed");
  expect((await store.loadTasks())[0]?.updatedAt).toBe(42);
});

test("done rejects missing and unknown IDs", async () => {
  const store = await createStore([createTask({ id: "1" })]);

  await expect(runCommand("done", [], store)).rejects.toThrow("Usage: todo done <id>");
  await expect(runCommand("done", ["2"], store)).rejects.toBeInstanceOf(UserInputError);
});

test("edit updates a task description without changing its task state", async () => {
  const store = await createStore([createTask({ id: "1", description: "Old description", priority: "high", dueDate: 123 })]);

  expect(await runCommand("edit", ["1", "New", "description"], store)).toContain("Updated task 1");
  expect(await store.loadTasks()).toMatchObject([{ id: "1", description: "New description", status: "pending", priority: "high", dueDate: 123 }]);
});

test("edit rejects an empty description and unknown task", async () => {
  const store = await createStore([createTask({ id: "1" })]);

  await expect(runCommand("edit", ["1"], store)).rejects.toThrow("Usage: todo edit <id> <description…>");
  await expect(runCommand("edit", ["2", "Missing"], store)).rejects.toThrow("Task not found: 2");
});

function createTask(overrides: Partial<Task> = {}): Task {
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
