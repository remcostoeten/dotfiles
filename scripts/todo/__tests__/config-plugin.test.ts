import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configPlugin } from "@/src/plugins/config";
import { PluginRegistry } from "@/src/plugins/registry";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("config lists the current settings", async () => {
  const store = await createStore();

  const output = await runConfigCommand([], store);

  expect(output).toContain("shell-limit");
  expect(output).toContain("startup-notifications");
  expect(output).toContain("show-completed");
});

test("config persists the shell limit", async () => {
  const store = await createStore();

  expect(await runConfigCommand(["shell-limit", "20"], store)).toContain("shell-limit = 20");
  expect((await store.loadConfig()).shellDisplayLimit).toBe(20);
  expect(await runConfigCommand(["shell-limit"], store)).toBe("20\n");
});

test("config accepts all as an unlimited shell limit", async () => {
  const store = await createStore();

  expect(await runConfigCommand(["shell-limit", "all"], store)).toContain("shell-limit = all");
  expect((await store.loadConfig()).shellDisplayLimit).toBe(0);
});

test("config rejects unknown settings and invalid values", async () => {
  const store = await createStore();

  expect(runConfigCommand(["shell-colour", "blue"], store)).rejects.toThrow("Unknown setting");
  expect(runConfigCommand(["shell-limit", "-2"], store)).rejects.toThrow("Invalid task count");
  expect(runConfigCommand(["startup-notifications", "maybe"], store)).rejects.toThrow("Invalid boolean");
});

test("config toggles booleans with on and off", async () => {
  const store = await createStore();

  await runConfigCommand(["startup-notifications", "off"], store);
  expect((await store.loadConfig()).showNotificationsOnStartup).toBe(false);

  await runConfigCommand(["startup-notifications", "on"], store);
  expect((await store.loadConfig()).showNotificationsOnStartup).toBe(true);
});

async function createStore(): Promise<TodoStore> {
  const dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-"));
  temporaryDirectories.push(dataDirectory);
  return new TodoStore(getTodoPaths(dataDirectory));
}

async function runConfigCommand(args: string[], store: TodoStore): Promise<string> {
  const registry = new PluginRegistry();
  registry.use(configPlugin);
  const command = registry.getCommand("config");
  if (!command) throw new Error("Command not registered: config");

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
