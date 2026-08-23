import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "@/src/domain/task";
import { removePlugin } from "@/src/plugins/remove";
import { PluginRegistry } from "@/src/plugins/registry";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("rm removes comma-separated IDs and inclusive ranges", async () => {
  const store = await createStore([1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 15, 16].map((id) => createTask(id)));

  await runCommand("rm", ["1, 5,9,10-15"], store);

  expect((await store.loadTasks()).map((task) => task.id)).toEqual(["2", "3", "4", "16"]);
});

test("delete is an alias for rm", async () => {
  const store = await createStore([createTask(1), createTask(2), createTask(3), createTask(4)]);

  expect(await runCommand("delete", ["1,3-4"], store)).toContain("Deleted 3 task(s)");
  expect((await store.loadTasks()).map((task) => task.id)).toEqual(["2"]);
});

test("delete all removes pending tasks and preserves completed tasks", async () => {
  const store = await createStore([createTask(1), createTask(2, "completed")]);

  expect(await runCommand("delete", ["all"], store)).toContain("Deleted 1 task(s)");
  expect((await store.loadTasks()).map((task) => task.id)).toEqual(["2"]);
});

test("rmall removes pending tasks and preserves completed tasks", async () => {
  const store = await createStore([createTask(1), createTask(2, "completed")]);

  expect(await runCommand("rmall", [], store)).toContain("Deleted 1 task(s)");
  expect((await store.loadTasks()).map((task) => task.id)).toEqual(["2"]);
});

function createTask(id: number, status: Task["status"] = "pending"): Task {
  return {
    id: `${id}`,
    description: `Task ${id}`,
    status,
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
  const registry = new PluginRegistry();
  registry.use(removePlugin);
  const command = registry.getCommand(name);
  if (!command) throw new Error(`Command not registered: ${name}`);

  let output = "";
  const stdout = { write(chunk: string | Uint8Array) { output += chunk.toString(); return true; } } as Pick<typeof process.stdout, "write">;
  await command.handler({ args, store, stdout, stderr: stdout, commands: registry.listCommands() });
  return output;
}
