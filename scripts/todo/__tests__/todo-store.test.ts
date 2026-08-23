import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "@/src/domain/task";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";


const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("persists tasks without changing their data", async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-"));
  temporaryDirectories.push(dataDirectory);
  const store = new TodoStore(getTodoPaths(dataDirectory));
  const task = {
    id: "1",
    description: "Write migration tests",
    status: "pending" as const,
    priority: "high" as const,
    createdAt: 1,
    updatedAt: 1,
    reminderOffsets: [10],
    notificationsSent: { reminders: [], overdue: false },
  };

  await store.saveTasks([task]);

  expect(await store.loadTasks()).toEqual([task]);
});

test("uses the documented defaults when configuration does not exist", async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-"));
  temporaryDirectories.push(dataDirectory);
  const store = new TodoStore(getTodoPaths(dataDirectory));

  expect(await store.loadConfig()).toEqual(DEFAULT_CONFIG);
});

test("uses a five-second undo window for existing configuration", async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-"));
  temporaryDirectories.push(dataDirectory);
  const paths = getTodoPaths(dataDirectory);
  const store = new TodoStore(paths);
  await mkdir(paths.dataDir, { recursive: true });
  await writeFile(paths.configFile, JSON.stringify({ undoTimeout: 30_000 }), "utf8");

  await store.saveUndo([]);

  const undo = JSON.parse(await readFile(paths.undoFile, "utf8")) as { timestamp: number; expiresAt: number };
  expect(undo.expiresAt - undo.timestamp).toBe(5_000);
});

test("normalizes tasks written by the legacy command", async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-"));
  temporaryDirectories.push(dataDirectory);
  const paths = getTodoPaths(dataDirectory);
  const store = new TodoStore(paths);
  const legacyTask = {
    id: "1",
    description: "Keep legacy data readable",
    status: "pending" as const,
    createdAt: 1,
    updatedAt: 1,
    reminderOffsets: [10, 30],
    notificationsSent: { reminders: [10] },
  };
  await mkdir(paths.dataDir, { recursive: true });
  await writeFile(paths.tasksFile, JSON.stringify([legacyTask]), "utf8");

  expect(await store.loadTasks()).toEqual([
    {
      ...legacyTask,
      priority: "none",
      notificationsSent: { reminders: [10], overdue: false },
    },
  ]);
});
