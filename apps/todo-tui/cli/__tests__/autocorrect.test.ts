import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveTypo, type AutocorrectIo } from "@/src/autocorrect";
import { parse, type ParseResult } from "@/src/command-spec/parse";
import { decideCorrection, recordDecision, replaceToken, type TypoMemory } from "@/src/domain/autocorrect";
import { editDistance, findClosest } from "@/src/domain/fuzzy-match";
import type { Task } from "@/src/domain/task";
import { UnknownTokenError } from "@/src/domain/unknown-token-error";
import { createCommandTree } from "@/src/plugins/builtins";
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

test("replaceToken swaps standalone tokens and inline option parts", () => {
  expect(replaceToken(["--prioirty", "high"], "--prioirty", "--priority")).toEqual(["--priority", "high"]);
  expect(replaceToken(["--prioirty=high"], "--prioirty", "--priority")).toEqual(["--priority=high"]);
  expect(replaceToken(["--priority=hgih"], "hgih", "high")).toEqual(["--priority=high"]);
  expect(replaceToken(["buy", "milk"], "oat", "add")).toBeUndefined();
});

test("a mistyped command whose arguments fit prompts, and acceptance rewrites argv", async () => {
  const store = await createStore([createTask(3)]);
  const io = createIo(true);

  const error = await rejectedToken(["donw", "3"], store);
  expect(error.implicitAddFallback).toBe(true);
  expect(await resolveTypo(error, ["donw", "3"], store, io)).toEqual({ kind: "corrected", argv: ["done", "3"] });
  expect(io.questions[0]).toContain("todo done 3");
  expect((await store.loadTypoMemory()).donw?.done).toEqual({ accepted: 1, rejected: 0 });
});

test("a typo equally close to two commands is added as a task rather than guessed", async () => {
  const store = await createStore([createTask(3)]);

  expect(editDistance("dne", "done")).toBe(editDistance("dne", "due"));
  expect(pathOf(await parseWithTypos(["dne", "3"], store))).toBe("add");
});

test("a mistyped command whose arguments do not fit becomes a task", async () => {
  const store = await createStore([createTask(3)]);

  expect(pathOf(await parseWithTypos(["dne", "buy", "milk"], store))).toBe("add");
  expect(pathOf(await parseWithTypos(["dome"], store))).toBe("add");
  expect(pathOf(await parseWithTypos(["buy", "milk"], store))).toBe("add");
  expect(pathOf(await parseWithTypos(["loose", "task"], store))).toBe("add");
});

test("declining a suggestion is remembered and no prompt is answered without a terminal", async () => {
  const store = await createStore([createTask(3)]);

  const donw = await rejectedToken(["donw", "3"], store);
  expect(await resolveTypo(donw, ["donw", "3"], store, createIo(false))).toEqual({ kind: "declined" });
  expect((await store.loadTypoMemory()).donw?.done).toEqual({ accepted: 0, rejected: 1 });

  const lsit = await rejectedToken(["lsit"], store);
  expect(await resolveTypo(lsit, ["lsit"], store, createIo(undefined))).toEqual({ kind: "unanswered", suggestion: "list" });
  expect((await store.loadTypoMemory()).lsit).toBeUndefined();
});

test("a learned typo autocorrects without a prompt and prints a notice", async () => {
  const store = await createStore([createTask(3)]);
  await store.saveTypoMemory({ dne: { done: { accepted: 3, rejected: 0 } } });
  const io = createIo(false);

  const error = await rejectedToken(["dne", "3"], store);
  expect(await resolveTypo(error, ["dne", "3"], store, io)).toEqual({ kind: "corrected", argv: ["done", "3"] });
  expect(io.questions).toHaveLength(0);
  expect(io.notices.join("")).toContain("autocorrected dne → done");
});

test("a rejected option is corrected from the parser's candidates", async () => {
  const store = await createStore([]);
  const io = createIo(true);
  const error = await rejectedToken(["add", "milk", "--prioirty", "high"], store);

  expect(error.candidates).toContain("--priority");
  expect(await resolveTypo(error, ["add", "milk", "--prioirty", "high"], store, io)).toEqual({ kind: "corrected", argv: ["add", "milk", "--priority", "high"] });
  expect(io.questions[0]).toContain("todo add milk --priority high");
});

async function parseWithTypos(argv: string[], store: TodoStore): Promise<ParseResult> {
  const memory = await store.loadTypoMemory();
  return parse(createCommandTree(), argv, {
    tasks: await store.loadTasks(),
    boardNames: [],
    isNearMiss: (token, candidates) => decideCorrection(memory, token, candidates) !== undefined,
  });
}

async function rejectedToken(argv: string[], store: TodoStore): Promise<UnknownTokenError> {
  try {
    await parseWithTypos(argv, store);
  } catch (error: unknown) {
    if (error instanceof UnknownTokenError) return error;
    throw error;
  }
  throw new Error(`${argv.join(" ")} parsed without a typo`);
}

function pathOf(result: ParseResult): string {
  return result.path.map((node) => node.name).join(" ");
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
