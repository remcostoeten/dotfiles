import { afterEach, expect, mock, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sendDueNotifications } from "@/src/notifications";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

const temporaryDirectories: string[] = [];

mock.module("node:child_process", () => ({ spawnSync: mock(() => ({ status: 0 })) }));

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("marks elapsed reminders and overdue notices as sent", async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-"));
  temporaryDirectories.push(dataDirectory);
  const store = new TodoStore(getTodoPaths(dataDirectory));
  const now = 1_000_000;
  await store.saveTasks([{
    id: "1",
    description: "Call dentist",
    status: "pending",
    priority: "none",
    createdAt: now,
    updatedAt: now,
    dueDate: now - 1,
    reminderOffsets: [10, 30],
    notificationsSent: { reminders: [], overdue: false },
  }]);

  await sendDueNotifications(store, now);
  await sendDueNotifications(store, now);

  expect(await store.loadTasks()).toMatchObject([{ notificationsSent: { reminders: [10, 30], overdue: true } }]);
});
