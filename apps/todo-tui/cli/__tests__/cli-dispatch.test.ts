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

  expect(output).toContain("Usage: todo hide <task…>");
  expect(output).toContain("Run 'todo hide --help' for details.");
  expect(process.exitCode).toBe(1);
  expect(await store.loadTasks()).toEqual([]);
});

test("hide --help documents the command", async () => {
  await run(["hide", "--help"]);
  expect(output).toContain("todo hide <task…>");
  expect(output).toContain("Task ID, or the exact name");

  output = "";
  await run(["--help"]);
  expect(output).toMatch(/hide\s+Hide a task or epic/);
});

test.each([
  [["bord"], "Unknown command: bord. Did you mean board?"],
  [["board", "ad", "3"], "Unknown subcommand: ad. Did you mean add?"],
  [["board", "use", "projcten"], "Unknown board: projcten. Did you mean projecten?"],
  [["add", "x", "--laetr"], "Unknown option: --laetr. Did you mean --later?"],
  [["panel", "--sied"], "Unknown option: --sied. Did you mean --side?"],
  [["config", "panel-layot", "side"], "Unknown setting: panel-layot. Did you mean panel-layout?"],
  [["config", "panel-layout", "sid"], "Unknown value for panel-layout: sid. Did you mean side?"],
])("without a terminal %p fails with a suggestion and changes nothing", async (args, message) => {
  await store.saveConfig({ ...DEFAULT_CONFIG, showNotificationsOnStartup: false, autocorrect: true });
  await store.saveTasks([]);
  await store.saveBoards({ boards: [{ name: "projecten", createdAt: 0, now: [], later: [] }] });
  const restore = withoutTerminal();
  try {
    await run(args);
  } finally {
    restore();
  }

  expect(output).toContain(message);
  expect(process.exitCode).toBe(1);
  expect(await store.loadTasks()).toEqual([]);
  expect((await store.loadConfig()).panelLayout).toBe("auto");
});

test("implicit add still works and a far-off first word is a task", async () => {
  await store.saveConfig({ ...DEFAULT_CONFIG, showNotificationsOnStartup: false, autocorrect: true });
  const restore = withoutTerminal();
  try {
    await run(["buy", "milk"]);
  } finally {
    restore();
  }
  expect((await store.loadTasks()).map((task) => task.description)).toEqual(["buy milk"]);
  expect(process.exitCode).toBe(0);
});

function withoutTerminal(): () => void {
  const stdinTty = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  const stdoutTty = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
  Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
  return () => {
    for (const [stream, descriptor] of [[process.stdin, stdinTty], [process.stdout, stdoutTty]] as const) {
      if (descriptor === undefined) delete (stream as { isTTY?: boolean }).isTTY;
      else Object.defineProperty(stream, "isTTY", descriptor);
    }
  };
}
