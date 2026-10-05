import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addPlugin } from "@/src/plugins/add";
import { epicPlugin } from "@/src/plugins/epic";
import { lifecyclePlugin } from "@/src/plugins/lifecycle";
import { PluginRegistry } from "@/src/plugins/registry";
import { tasksPlugin } from "@/src/plugins/tasks";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("hide by id keeps the task pending but drops its subtree from shell-display and list", async () => {
  const store = await createStore();
  await run(store, "epic", ["Website", "redesign"]);
  await run(store, "sub", ["1", "fix", "header"]);
  await run(store, "add", ["loose"]);

  expect(stripAnsi(await run(store, "hide", ["1"]))).toContain("Hid #1: Website redesign");

  const tasks = await store.loadTasks();
  expect(tasks.map((task) => [task.id, task.status, task.hidden])).toEqual([
    ["1", "pending", true],
    ["2", "pending", undefined],
    ["3", "pending", undefined],
  ]);

  const panel = stripAnsi(await run(store, "shell-display", []));
  expect(panel).not.toContain("Website redesign");
  expect(panel).not.toContain("fix header");
  expect(panel).toContain("loose");

  const list = stripAnsi(await run(store, "list", []));
  expect(list).not.toContain("Website redesign");
  expect(list).toContain("loose");
  expect(stripAnsi(await run(store, "list", ["--all"]))).toContain("Website redesign");
});

test("hide resolves epic names, including quoted names with spaces", async () => {
  const store = await createStore();
  await run(store, "epic", ["my-epic"]);
  await run(store, "epic", ["My", "Epic"]);

  expect(stripAnsi(await run(store, "hide", ["my-epic"]))).toContain("Hid #1: my-epic");
  expect(stripAnsi(await run(store, "hide", ["My Epic"]))).toContain("Hid #2: My Epic");
  expect((await store.loadTasks()).every((task) => task.hidden === true)).toBe(true);
});

test("hide without a target errors instead of creating a task", async () => {
  const store = await createStore();
  await expect(run(store, "hide", [])).rejects.toThrow("Usage: todo hide <id|name>");
  await expect(run(store, "hide", ["nope"])).rejects.toThrow("Task not found: nope");
  expect(await store.loadTasks()).toEqual([]);
});

test("unhide restores a hidden task", async () => {
  const store = await createStore();
  await run(store, "add", ["thing"]);
  await run(store, "hide", ["#1"]);
  expect(stripAnsi(await run(store, "hide", ["1"]))).toContain("already hidden");
  expect(stripAnsi(await run(store, "unhide", ["thing"]))).toContain("Unhid #1: thing");
  expect((await store.loadTasks())[0]?.hidden).toBeUndefined();
  expect(stripAnsi(await run(store, "shell-display", []))).toContain("thing");
});

async function createStore(): Promise<TodoStore> {
  const dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-"));
  temporaryDirectories.push(dataDirectory);
  return new TodoStore(getTodoPaths(dataDirectory));
}

async function run(store: TodoStore, name: string, args: string[]): Promise<string> {
  const registry = new PluginRegistry();
  for (const plugin of [addPlugin, epicPlugin, lifecyclePlugin, tasksPlugin]) registry.use(plugin);
  const command = registry.getCommand(name);
  if (command === undefined) throw new Error(`Command not registered: ${name}`);

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

function stripAnsi(value: string): string {
  return value.replace(/\[[0-9;]*m/g, "");
}
