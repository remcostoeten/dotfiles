import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "@/src/cli";
import { DEFAULT_CONFIG } from "@/src/domain/task";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

let dataDirectory = "";
let store: TodoStore;
let output = "";
const originalStdout = process.stdout.write;
const originalStderr = process.stderr.write;
const originalDataDir = process.env.DOTFILES_DATA_DIR;

beforeEach(async () => {
  dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-cli-"));
  process.env.DOTFILES_DATA_DIR = dataDirectory;
  store = new TodoStore(getTodoPaths(dataDirectory));
  await store.saveConfig({ ...DEFAULT_CONFIG, showNotificationsOnStartup: false, autocorrect: false });
  output = "";
  const capture = (chunk: string | Uint8Array): boolean => {
    output += chunk.toString();
    return true;
  };
  process.stdout.write = capture as typeof process.stdout.write;
  process.stderr.write = capture as typeof process.stderr.write;
  process.exitCode = 0;
});

afterEach(async () => {
  process.stdout.write = originalStdout;
  process.stderr.write = originalStderr;
  process.exitCode = undefined;
  if (originalDataDir === undefined) delete process.env.DOTFILES_DATA_DIR;
  else process.env.DOTFILES_DATA_DIR = originalDataDir;
  await rm(dataDirectory, { force: true, recursive: true });
});

test("hide as the first argument hides by id or by name", async () => {
  await run(["epic", "my-epic"]);
  await run(["epic", "My Epic"]);
  await run(["add", "loose"]);

  await run(["hide", "1"]);
  await run(["hide", "My Epic"]);

  const tasks = await store.loadTasks();
  expect(tasks.map((task) => [task.description, task.status, task.hidden])).toEqual([
    ["my-epic", "pending", true],
    ["My Epic", "pending", true],
    ["loose", "pending", undefined],
  ]);
});

test.each([
  [["fix", "hide", "button"], "fix hide button"],
  [["implement", "hide", "logic"], "implement hide logic"],
  [["foo", "hide", "3"], "foo hide 3"],
])("%p is added as a plain task, not treated as hide", async (args, description) => {
  await run(["add", "seed"]);
  await run(["add", "second"]);
  await run(["add", "third"]);
  await run(args);

  const tasks = await store.loadTasks();
  expect(tasks.map((task) => task.description)).toEqual(["seed", "second", "third", description]);
  expect(tasks.some((task) => task.hidden === true)).toBe(false);
  expect(process.exitCode).toBe(0);
});

test("epic hide and epic hide-menu create epics named hide", async () => {
  await run(["epic", "hide"]);
  await run(["epic", "hide-menu"]);

  const tasks = await store.loadTasks();
  expect(tasks.map((task) => [task.description, task.kind, task.hidden])).toEqual([
    ["hide", "epic", undefined],
    ["hide-menu", "epic", undefined],
  ]);
});

test("hide without a target reports usage and creates nothing", async () => {
  await run(["hide"]);

  expect(output).toContain("Usage: todo hide <id|name>");
  expect(output).toContain("Run 'todo hide --help' for details.");
  expect(process.exitCode).toBe(1);
  expect(await store.loadTasks()).toEqual([]);
});

test("hide --help documents the command", async () => {
  await run(["hide", "--help"]);
  expect(output).toContain("todo hide <id>");
  expect(output).toContain("todo hide <epic or task name>");

  output = "";
  await run(["--help"]);
  expect(output).toMatch(/hide\s+Hide a task or epic/);
});
