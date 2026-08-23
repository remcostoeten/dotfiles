import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addPlugin, parseAddArguments } from "@/src/plugins/add";
import { PluginRegistry } from "@/src/plugins/registry";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("treats unquoted words before options as one description", () => {
  expect(parseAddArguments(["buy", "oat", "milk", "--priority", "high"])).toMatchObject([{ description: "buy oat milk", priority: "high" }]);
});

test("accepts an explicit option separator", () => {
  expect(parseAddArguments(["review", "todo", "architecture", "--", "--priority=low"])).toMatchObject([{ description: "review todo architecture", priority: "low" }]);
});

test("parses due dates and reminder offsets", () => {
  const now = new Date("2026-08-15T12:00:00+02:00");
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  expect(parseAddArguments(["call", "dentist", "--due", "tomorrow", "--reminders", "10,30"], now)).toEqual([{ description: "call dentist", priority: "none", dueDate: tomorrow.getTime(), reminderOffsets: [10, 30] }]);
});

test("accepts the legacy reminder option aliases", () => {
  expect(parseAddArguments(["call", "dentist", "--r", "10,30"])).toMatchObject([{ reminderOffsets: [10, 30] }]);
  expect(parseAddArguments(["call", "dentist", "--remind", "10,30"])).toMatchObject([{ reminderOffsets: [10, 30] }]);
});

test("splits comma-separated descriptions without preserving comma whitespace", () => {
  expect(parseAddArguments(["first", "task", ",second", "task,", "third", "task", "--priority", "low"])).toEqual([
    { description: "first task", priority: "low" },
    { description: "second task", priority: "low" },
    { description: "third task", priority: "low" },
  ]);
});

test("persists the complete unquoted description", async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-"));
  temporaryDirectories.push(dataDirectory);
  const store = new TodoStore(getTodoPaths(dataDirectory));
  const registry = new PluginRegistry();
  registry.use(addPlugin);
  const command = registry.getCommand("add");
  if (!command) throw new Error("Add command not registered");
  const output: string[] = [];
  const stdout = {
    write(chunk: string | Uint8Array) {
      output.push(chunk.toString());
      return true;
    },
  } as Pick<typeof process.stdout, "write">;

  await command.handler({
    args: ["write", "migration", "tests", "--priority", "medium"],
    store,
    stdout,
    stderr: stdout,
    commands: registry.listCommands(),
  });

  expect(await store.loadTasks()).toMatchObject([
    {
      id: "1",
      description: "write migration tests",
      status: "pending",
      priority: "medium",
    },
  ]);
  expect(output.join("")).toBe("Added task 1: write migration tests\n");
});

test("creates multiple tasks with the same options", async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-"));
  temporaryDirectories.push(dataDirectory);
  const store = new TodoStore(getTodoPaths(dataDirectory));
  const registry = new PluginRegistry();
  registry.use(addPlugin);
  const command = registry.getCommand("add");
  if (!command) throw new Error("Add command not registered");
  const output: string[] = [];
  const stdout = { write(chunk: string | Uint8Array) { output.push(chunk.toString()); return true; } } as Pick<typeof process.stdout, "write">;

  await command.handler({ args: ["first", ",", "second", "--priority", "high"], store, stdout, stderr: stdout, commands: registry.listCommands() });

  expect(await store.loadTasks()).toMatchObject([
    { id: "1", description: "first", priority: "high" },
    { id: "2", description: "second", priority: "high" },
  ]);
  expect(output.join("")).toBe("Added task 1: first\nAdded task 2: second\n");
});

test("collects multi word option values up to the next option", () => {
  const now = new Date(2026, 7, 19, 9, 44, 0);
  expect(parseAddArguments(["fix", "reiskosten", "--due", "two", "weeks", "ago"], now)).toMatchObject([
    { description: "fix reiskosten", dueDate: new Date(2026, 7, 5, 9, 44, 0).getTime() },
  ]);
  expect(parseAddArguments(["fix", "reiskosten", "--due", "16", "08", "2026", "--priority", "high"], now)).toMatchObject([
    { description: "fix reiskosten", dueDate: new Date(2026, 7, 16, 9, 0, 0).getTime(), priority: "high" },
  ]);
});

test("reports a missing option value when no words follow", () => {
  expect(() => parseAddArguments(["fix", "reiskosten", "--due"])).toThrow("Missing value for --due");
  expect(() => parseAddArguments(["fix", "reiskosten", "--due", "--priority", "high"])).toThrow("Missing value for --due");
});

test("rejects unknown options", () => {
  expect(() => parseAddArguments(["write", "tests", "--urgent", "yes"])).toThrow("Unknown option: --urgent");
});
