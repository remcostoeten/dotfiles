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

test("undo restores removed tasks with fresh IDs", async () => {
  const store = await createStore([createTask(1)]);
  await store.saveUndo([createTask(8), createTask(9)]);

  expect(await runCommand("undo", [], store)).toContain("Restored 2 task(s)");
  expect((await store.loadTasks()).map((task) => task.id)).toEqual(["1", "2", "3"]);
  expect(await store.loadUndo()).toBeUndefined();
});

test("snooze sets a due date and resets notification state", async () => {
  const store = await createStore([{ ...createTask(1), notificationsSent: { reminders: [10], overdue: true } }]);

  expect(await runCommand("snooze", ["1", "1h"], store)).toContain("Snoozed #1");
  expect(await store.loadTasks()).toMatchObject([{ dueDate: expect.any(Number), notificationsSent: { reminders: [], overdue: false } }]);
});

function createTask(id: number): Task {
  return {
    id: `${id}`,
    description: `Task ${id}`,
    status: "pending",
    priority: "none",
    createdAt: id,
    updatedAt: id,
    reminderOffsets: [],
    notificationsSent: { reminders: [], overdue: false },
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
