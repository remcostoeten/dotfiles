import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTodo } from "./support/run-todo";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("epic and sub build a nested tree that list renders with connectors", async () => {
  const store = await createStore();

  expect(await run(store, "epic", ["Website", "redesign"])).toContain("Added epic 1: Website redesign");
  expect(await run(store, "sub", ["1", "fix", "header,", "fix", "footer"])).toContain("Added task 3 under #1: fix footer");
  expect(await run(store, "add", ["polish", "hero", "--under", "#2"])).toContain("Added task 4 under #2: polish hero");

  const tasks = await store.loadTasks();
  expect(tasks.map((task) => [task.id, task.parentId, task.kind])).toEqual([
    ["1", undefined, "epic"],
    ["2", "1", undefined],
    ["3", "1", undefined],
    ["4", "2", undefined],
  ]);

  const output = stripAnsi(await run(store, "list", []));
  expect(output.split("\n").filter(Boolean)).toEqual([
    "Website redesign (1) [0/3]",
    "├─ fix header (2) [0/1]",
    "│  └─ polish hero (4)",
    "└─ fix footer (3)",
  ]);
});

test("sub and --under reject unknown parents", async () => {
  const store = await createStore();

  await expect(run(store, "sub", ["7", "orphan"], )).rejects.toThrow("Task not found: 7");
  await expect(run(store, "add", ["orphan", "--under", "x"])).rejects.toThrow("Invalid task ID: x");
});

test("sub preserves commas inside a quoted description", async () => {
  const store = await createStore();
  await run(store, "epic", ["SDK plans"]);

  expect(await run(store, "sub", ["1", "create sdk plans (TS, Hono, React, NextJS, Rust)"])).toContain(
    "Added task 2 under #1: create sdk plans (TS, Hono, React, NextJS, Rust)",
  );
  expect((await store.loadTasks()).map((task) => task.description)).toEqual([
    "SDK plans",
    "create sdk plans (TS, Hono, React, NextJS, Rust)",
  ]);
});

test("sub accepts the parent name instead of an id", async () => {
  const store = await createStore();
  await run(store, "epic", ["new", "month"]);
  await run(store, "epic", ["new", "month", "planning"]);

  expect(await run(store, "sub", ["new", "month", "this", "is", "a", "sub", "ticket"])).toContain(
    "Added task 3 under #1: this is a sub ticket",
  );
  expect(await run(store, "sub", ["New", "Month", "Planning", "draft", "agenda", "--priority", "high"])).toContain(
    "Added task 4 under #2: draft agenda",
  );
  expect(await run(store, "sub", ["new", "month", "a,", "b"])).toContain("Added task 6 under #1: b");

  await expect(run(store, "sub", ["old", "month", "nope"])).rejects.toThrow("Task not found: old month");
});

test("move re-parents and refuses cycles", async () => {
  const store = await createStore();
  await run(store, "epic", ["Epic"]);
  await run(store, "sub", ["1", "child"]);
  await run(store, "add", ["loose"]);

  expect(await run(store, "move", ["3", "2"])).toContain("Moved #3 under #2");
  expect(await run(store, "mv", ["3", "root"])).toContain("Moved #3 to the top level");
  await expect(run(store, "move", ["1", "2"])).rejects.toThrow("nest inside itself");
});

test("reorder repositions siblings without re-parenting", async () => {
  const store = await createStore();
  await run(store, "epic", ["Epic"]);
  await run(store, "sub", ["1", "a,", "b,", "c"]);

  expect(await run(store, "reorder", ["4", "--top"])).toContain("Reordered #4");
  expect((await store.loadTasks()).map((task) => task.id)).toEqual(["1", "4", "2", "3"]);

  expect(await run(store, "reorder", ["2", "--after", "3"])).toContain("Reordered #2");
  expect((await store.loadTasks()).map((task) => task.id)).toEqual(["1", "4", "3", "2"]);

  await expect(run(store, "reorder", ["2", "--before", "1"])).rejects.toThrow("they are not siblings");
  await expect(run(store, "reorder", ["2"])).rejects.toThrow("Usage: todo reorder");
});

test("rm and done cascade to subtasks", async () => {
  const store = await createStore();
  await run(store, "epic", ["Epic"]);
  await run(store, "sub", ["1", "a,", "b"]);
  await run(store, "sub", ["2", "a1"]);
  await run(store, "add", ["loose"]);

  expect(await run(store, "done", ["2"])).toContain("completed with 1 subtask(s)");
  expect((await store.loadTasks()).filter((task) => task.status === "completed").map((task) => task.id)).toEqual(["2", "4"]);

  expect(await run(store, "rm", ["1"])).toContain("Deleted 4 task(s) including 3 subtask(s)");
  expect((await store.loadTasks()).map((task) => task.id)).toEqual(["5"]);
  expect((await store.loadUndo())?.tasks.map((task) => task.id)).toEqual(["1", "2", "3", "4"]);
});

test("panel counts hidden rows across the whole tree", async () => {
  const store = await createStore();
  await run(store, "epic", ["Epic"]);
  await run(store, "sub", ["1", "a,", "b,", "c"]);

  const output = stripAnsi(await run(store, "panel", ["--limit", "2"]));
  expect(output).toContain("#01  Epic [0/3]");
  expect(output).toContain("#02  ├─ a");
  expect(output).toContain("↳ 2 more tasks");
});

async function createStore(): Promise<TodoStore> {
  const dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-"));
  temporaryDirectories.push(dataDirectory);
  return new TodoStore(getTodoPaths(dataDirectory));
}

async function run(store: TodoStore, name: string, args: string[]): Promise<string> {
  return await runTodo(store, [name, ...args]);
}

function stripAnsi(value: string): string {
  return value.replace(/\[[0-9;]*m/g, "");
}
