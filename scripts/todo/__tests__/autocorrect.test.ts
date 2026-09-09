import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { correctCommandName, correctRejectedToken, type AutocorrectIo } from "@/src/autocorrect";
import { argumentsFitShape, decideCorrection, recordDecision, replaceToken, type TypoMemory } from "@/src/domain/autocorrect";
import { editDistance, findClosest } from "@/src/domain/fuzzy-match";
import type { Task } from "@/src/domain/task";
import { UnknownTokenError } from "@/src/domain/unknown-token-error";
import { builtInPlugins } from "@/src/plugins/builtins";
import { PluginRegistry } from "@/src/plugins/registry";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

const COMMANDS = ["add", "done", "list", "rm", "rmall", "sub", "snooze", "interactive", "config", "help"];

test("editDistance counts edits and adjacent transpositions", () => {
  expect(editDistance("done", "done")).toBe(0);
  expect(editDistance("dne", "done")).toBe(1);
  expect(editDistance("odne", "done")).toBe(1);
  expect(editDistance("buy", "sub")).toBe(2);
});

test("findClosest returns the unique closest candidate within the length-based limit", () => {
  expect(findClosest("dne", COMMANDS)).toBe("done");
  expect(findClosest("lsit", COMMANDS)).toBe("list");
  expect(findClosest("interactiv", COMMANDS)).toBe("interactive");
  expect(findClosest("buy", COMMANDS)).toBeUndefined();
  expect(findClosest("x", COMMANDS)).toBeUndefined();
  expect(findClosest("done", COMMANDS)).toBeUndefined();
});

test("findClosest refuses ties and accepts unique prefixes", () => {
  expect(findClosest("rmm", ["rm", "rmall"])).toBe("rm");
  expect(findClosest("bat", ["cat", "hat"])).toBeUndefined();
  expect(findClosest("conf", COMMANDS)).toBe("config");
});

test("decideCorrection prompts for fresh typos and auto-applies after three acceptances", () => {
  let memory: TypoMemory = {};
  expect(decideCorrection(memory, "dne", COMMANDS)).toEqual({ correction: "done", mode: "prompt" });

  memory = recordDecision(memory, "dne", "done", true);
  memory = recordDecision(memory, "dne", "done", true);
  expect(decideCorrection(memory, "dne", COMMANDS)).toEqual({ correction: "done", mode: "prompt" });

  memory = recordDecision(memory, "dne", "done", true);
  expect(decideCorrection(memory, "dne", COMMANDS)).toEqual({ correction: "done", mode: "auto" });
});

test("decideCorrection stops suggesting after two rejections", () => {
  let memory: TypoMemory = recordDecision({}, "sun", "sub", false);
  expect(decideCorrection(memory, "sun", COMMANDS)).toEqual({ correction: "sub", mode: "prompt" });

  memory = recordDecision(memory, "sun", "sub", false);
  expect(decideCorrection(memory, "sun", COMMANDS)).toBeUndefined();
});

test("decideCorrection prefers a learned correction over the fuzzy closest match", () => {
  const memory = recordDecision({}, "ls", "list", true);
  expect(decideCorrection(memory, "ls", COMMANDS)).toEqual({ correction: "list", mode: "prompt" });
});

test("argumentsFitShape guards command-name corrections", () => {
  const ids = new Set(["3", "7"]);
  expect(argumentsFitShape("none", [], ids)).toBe(true);
  expect(argumentsFitShape("none", ["--all"], ids)).toBe(true);
  expect(argumentsFitShape("none", ["milk"], ids)).toBe(false);
  expect(argumentsFitShape("task-id", ["3"], ids)).toBe(true);
  expect(argumentsFitShape("task-id", ["#7", "text"], ids)).toBe(true);
  expect(argumentsFitShape("task-id", ["9"], ids)).toBe(false);
  expect(argumentsFitShape("task-id", [], ids)).toBe(false);
  expect(argumentsFitShape("task-ids", ["1", "2,3", "4-6"], ids)).toBe(true);
  expect(argumentsFitShape("task-ids", ["all"], ids)).toBe(true);
  expect(argumentsFitShape("task-ids", ["milk"], ids)).toBe(false);
  expect(argumentsFitShape("text", ["buy", "milk"], ids)).toBe(true);
  expect(argumentsFitShape("text", [], ids)).toBe(false);
  expect(argumentsFitShape("any", ["a", "b", "c", "d"], ids)).toBe(false);
});

test("replaceToken swaps standalone tokens and inline option parts", () => {
  expect(replaceToken(["--prioirty", "high"], "--prioirty", "--priority")).toEqual(["--priority", "high"]);
  expect(replaceToken(["--prioirty=high"], "--prioirty", "--priority")).toEqual(["--priority=high"]);
  expect(replaceToken(["--priority=hgih"], "hgih", "high")).toEqual(["--priority=high"]);
  expect(replaceToken(["buy", "milk"], "oat", "add")).toBeUndefined();
});

test("a mistyped command whose arguments fit prompts, and acceptance rewrites argv", async () => {
  const store = await createStore([createTask(3)]);
  const io = createIo(true);

  expect(await correctCommandName(["donw", "3"], createRegistry(), store, io)).toEqual(["done", "3"]);
  expect(io.questions[0]).toContain("todo done 3");
  expect((await store.loadTypoMemory()).donw?.done).toEqual({ accepted: 1, rejected: 0 });
});

test("a typo equally close to two commands is left alone rather than guessed", async () => {
  const store = await createStore([createTask(3)]);
  const io = createIo(true);

  expect(editDistance("dne", "done")).toBe(editDistance("dne", "due"));
  expect(await correctCommandName(["dne", "3"], createRegistry(), store, io)).toBeUndefined();
  expect(io.questions).toHaveLength(0);
});

test("a mistyped command whose arguments do not fit is left alone so it becomes a task", async () => {
  const store = await createStore([createTask(3)]);
  const io = createIo(true);

  expect(await correctCommandName(["dne", "buy", "milk"], createRegistry(), store, io)).toBeUndefined();
  expect(await correctCommandName(["dome"], createRegistry(), store, io)).toBeUndefined();
  expect(await correctCommandName(["buy", "milk"], createRegistry(), store, io)).toBeUndefined();
  expect(io.questions).toHaveLength(0);
});

test("declining a suggestion is remembered and no prompt is shown without a terminal", async () => {
  const store = await createStore([createTask(3)]);

  expect(await correctCommandName(["donw", "3"], createRegistry(), store, createIo(false))).toBeUndefined();
  expect((await store.loadTypoMemory()).donw?.done).toEqual({ accepted: 0, rejected: 1 });

  const silent = createIo(undefined);
  expect(await correctCommandName(["lsit"], createRegistry(), store, silent)).toBeUndefined();
  expect((await store.loadTypoMemory()).lsit).toBeUndefined();
});

test("a learned typo autocorrects without a prompt and prints a notice", async () => {
  const store = await createStore([createTask(3)]);
  await store.saveTypoMemory({ dne: { done: { accepted: 3, rejected: 0 } } });
  const io = createIo(false);

  expect(await correctCommandName(["dne", "3"], createRegistry(), store, io)).toEqual(["done", "3"]);
  expect(io.questions).toHaveLength(0);
  expect(io.notices.join("")).toContain("autocorrected dne → done");
});

test("a rejected option is corrected from the error's candidates", async () => {
  const store = await createStore([]);
  const io = createIo(true);
  const error = new UnknownTokenError("Unknown option: --prioirty", "--prioirty", ["--due", "--priority", "--under"], "option");

  expect(await correctRejectedToken(error, "add", ["milk", "--prioirty", "high"], store, io)).toEqual(["milk", "--priority", "high"]);
  expect(io.questions[0]).toContain("todo add milk --priority high");
});

function createRegistry(): PluginRegistry {
  const registry = new PluginRegistry();
  for (const plugin of builtInPlugins) registry.use(plugin);
  return registry;
}

function createIo(answer: boolean | undefined): AutocorrectIo & { questions: string[]; notices: string[] } {
  const questions: string[] = [];
  const notices: string[] = [];
  return {
    questions,
    notices,
    async confirm(question) {
      questions.push(question);
      return answer;
    },
    notify(message) {
      notices.push(message);
    },
  };
}

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
