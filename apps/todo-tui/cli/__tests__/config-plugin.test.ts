import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runTodo } from "./support/run-todo";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("config lists the current settings", async () => {
  const store = await createStore();

  const output = await runConfigCommand([], store);

  expect(output).toContain("panel-limit");
  expect(output).toContain("startup-notifications");
  expect(output).toContain("show-completed");
});

test("config persists the panel limit", async () => {
  const store = await createStore();

  expect(await runConfigCommand(["panel-limit", "20"], store)).toContain("panel-limit = 20");
  expect((await store.loadConfig()).panelLimit).toBe(20);
  expect(await runConfigCommand(["panel-limit"], store)).toBe("20\n");
});

test("config persists the panel layout and rejects unknown ones", async () => {
  const store = await createStore();

  expect(await runConfigCommand(["panel-layout"], store)).toBe("auto\n");
  expect(await runConfigCommand(["panel-layout", "side"], store)).toContain("panel-layout = side");
  expect((await store.loadConfig()).panelLayout).toBe("side");
  expect(runConfigCommand(["panel-layout", "sideways"], store)).rejects.toThrow("Unknown value for panel-layout: sideways");
});

test("config accepts all as an unlimited panel limit", async () => {
  const store = await createStore();

  expect(await runConfigCommand(["panel-limit", "all"], store)).toContain("panel-limit = all");
  expect((await store.loadConfig()).panelLimit).toBe(0);
});

test("config rejects unknown settings and invalid values", async () => {
  const store = await createStore();

  expect(runConfigCommand(["shell-colour", "blue"], store)).rejects.toThrow("Unknown setting");
  expect(runConfigCommand(["panel-limit", "x2"], store)).rejects.toThrow("Invalid count");
  expect(runConfigCommand(["startup-notifications", "maybe"], store)).rejects.toThrow("Unknown value for startup-notifications: maybe");
});

test("config toggles booleans with on and off", async () => {
  const store = await createStore();

  await runConfigCommand(["startup-notifications", "off"], store);
  expect((await store.loadConfig()).showNotificationsOnStartup).toBe(false);

  await runConfigCommand(["startup-notifications", "on"], store);
  expect((await store.loadConfig()).showNotificationsOnStartup).toBe(true);
});

test("config reads the pre-rename shell keys once and writes panel keys", async () => {
  const store = await createStore();
  const { panelLimit: _limit, panelLayout: _layout, ...rest } = await store.loadConfig();
  await Bun.write(join(dirname(store.tasksFile), "config.json"), JSON.stringify({ ...rest, shellDisplayLimit: 9, shellLayout: "stack" }));

  expect(await runConfigCommand(["panel-limit"], store)).toBe("9\n");
  expect(await runConfigCommand(["panel-layout"], store)).toBe("stack\n");
  await runConfigCommand(["autocorrect", "off"], store);
  const saved = JSON.parse(await Bun.file(join(dirname(store.tasksFile), "config.json")).text());
  expect(saved).toMatchObject({ panelLimit: 9, panelLayout: "stack" });
  expect(saved.shellDisplayLimit).toBeUndefined();
});

async function createStore(): Promise<TodoStore> {
  const dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-"));
  temporaryDirectories.push(dataDirectory);
  return new TodoStore(getTodoPaths(dataDirectory));
}

async function runConfigCommand(args: string[], store: TodoStore): Promise<string> {
  return await runTodo(store, ["config", ...args]);
}
