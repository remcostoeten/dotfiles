import { expect, test } from "bun:test";
import type { Task } from "@/src/domain/task";
import { buildTaskTreeRows, collectSubtreeIds, completeSubtrees, getTaskProgress, moveTask } from "@/src/domain/task-tree";
import { restoreTasks } from "@/src/plugins/undo";

test("lays out nested tasks depth first with sibling guides", () => {
  const tasks = [
    createTask({ id: "1", kind: "epic" }),
    createTask({ id: "2", parentId: "1" }),
    createTask({ id: "3", parentId: "1" }),
    createTask({ id: "4", parentId: "2" }),
    createTask({ id: "5" }),
  ];

  const rows = buildTaskTreeRows(tasks, tasks, { compare: (left, right) => Number(left.id) - Number(right.id) });

  expect(rows.map((row) => [row.task.id, row.depth, row.siblingFollows])).toEqual([
    ["1", 0, [true]],
    ["2", 1, [true, true]],
    ["4", 2, [true, true, false]],
    ["3", 1, [true, false]],
    ["5", 0, [false]],
  ]);
  expect(rows[0]?.hasChildren).toBe(true);
  expect(rows[0]?.progress).toEqual({ total: 3, completed: 0 });
});

test("collapsed rows hide their children but keep the toggle state", () => {
  const tasks = [createTask({ id: "1" }), createTask({ id: "2", parentId: "1" })];

  const rows = buildTaskTreeRows(tasks, tasks, { collapsedIds: new Set(["1"]) });

  expect(rows.map((row) => row.task.id)).toEqual(["1"]);
  expect(rows[0]).toMatchObject({ hasChildren: true, collapsed: true });
});

test("a task whose parent is filtered out is shown as a root", () => {
  const all = [createTask({ id: "1", status: "completed" }), createTask({ id: "2", parentId: "1" })];

  const rows = buildTaskTreeRows(all.filter((task) => task.status === "pending"), all);

  expect(rows).toMatchObject([{ task: { id: "2" }, depth: 0 }]);
});

test("subtree helpers include every descendant", () => {
  const tasks = [
    createTask({ id: "1" }),
    createTask({ id: "2", parentId: "1" }),
    createTask({ id: "3", parentId: "2", status: "completed" }),
    createTask({ id: "4" }),
  ];

  expect([...collectSubtreeIds(tasks, ["1"])].sort()).toEqual(["1", "2", "3"]);
  expect(getTaskProgress(tasks, "1")).toEqual({ total: 2, completed: 1 });
  expect(completeSubtrees(tasks, ["1"], 99)).toBe(2);
  expect(tasks.map((task) => task.status)).toEqual(["completed", "completed", "completed", "pending"]);
});

test("moveTask re-parents and rejects cycles", () => {
  const tasks = [createTask({ id: "1" }), createTask({ id: "2", parentId: "1" }), createTask({ id: "3" })];

  moveTask(tasks, "3", "2");
  expect(tasks[2]?.parentId).toBe("2");
  moveTask(tasks, "3", undefined);
  expect(tasks[2]?.parentId).toBeUndefined();
  expect(() => moveTask(tasks, "1", "2")).toThrow("nest inside itself");
  expect(() => moveTask(tasks, "1", "1")).toThrow("nest inside itself");
  expect(() => moveTask(tasks, "1", "42")).toThrow("Task not found: 42");
});

test("restoring a deleted subtree keeps its internal parent links", () => {
  const existing = [createTask({ id: "1" }), createTask({ id: "9" })];
  const deleted = [createTask({ id: "5", parentId: "9" }), createTask({ id: "6", parentId: "5" }), createTask({ id: "7", parentId: "404" })];

  const restored = restoreTasks(existing, deleted);

  expect(restored.map((task) => [task.id, task.parentId])).toEqual([
    ["10", "9"],
    ["11", "10"],
    ["12", undefined],
  ]);
  expect("parentId" in restored[2]!).toBe(false);
});

function createTask(overrides: Partial<Task>): Task {
  return {
    id: "1",
    description: `Task ${overrides.id ?? "1"}`,
    status: "pending",
    priority: "none",
    createdAt: 1,
    updatedAt: 1,
    reminderOffsets: [],
    notificationsSent: { reminders: [], overdue: false },
    ...overrides,
  };
}
