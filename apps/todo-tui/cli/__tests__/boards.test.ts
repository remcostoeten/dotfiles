import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectLaneIds, laneOf, migrateLegacyFocus, placeOnBoard, type Board } from "@/src/domain/boards";
import { parseDuration } from "@/src/domain/duration";
import type { Task } from "@/src/domain/task";
import { UserInputError } from "@/src/domain/user-input-error";
import { loadBoards } from "@/src/services/boards";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";
import { runTodo } from "./support/run-todo";

const temporaryDirectories: string[] = [];
const HOUR = 3_600_000;

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("board new creates and activates; use, off and list follow", async () => {
  const store = await createStore([]);
  expect(await runTodo(store, ["board"])).toContain("No boards yet");

  expect(await runTodo(store, ["board", "new", "projecten"])).toContain("projecten is active");
  expect(await runTodo(store, ["board", "new", "deploy", "day", "--for", "4h"])).toContain("deploy day is active");
  let listing = strip(await runTodo(store, ["board"]));
  expect(listing).toContain("* deploy day");
  expect(listing).toMatch(/deploy day .*(3h59m|4h) left/);

  await runTodo(store, ["board", "use", "PROJECTEN"]);
  expect((await store.loadBoardsFile())?.active).toBe("projecten");
  await runTodo(store, ["board", "off"]);
  expect((await store.loadBoardsFile())?.active).toBeUndefined();
  listing = strip(await runTodo(store, ["board"]));
  expect(listing).toContain("No active board");
  await expect(runTodo(store, ["board", "new", "Projecten"])).rejects.toThrow("already exists");
});

test("add, rm, later and now move root ids between lanes; subtasks follow", async () => {
  const store = await createStore([task(1, { kind: "epic" }), task(2, { parentId: "1" }), task(3), task(4)]);
  await runTodo(store, ["board", "new", "werk"]);

  expect(strip(await runTodo(store, ["board", "add", "1", "#3"]))).toContain("Added #3 to Now on werk");
  expect(strip(await runTodo(store, ["board", "add", "3"]))).toContain("#3 is already in Now");
  expect(strip(await runTodo(store, ["board", "later", "1"]))).toContain("Moved #1 to Later");
  expect(strip(await runTodo(store, ["board", "now", "4"]))).toContain("Added #4 to Now");
  await expect(runTodo(store, ["board", "later", "2"])).rejects.toThrow("move #1 instead");
  await expect(runTodo(store, ["board", "rm", "2"])).rejects.toThrow("take #1 off instead");
  await expect(runTodo(store, ["board", "add", "9"])).rejects.toThrow("Task not found");

  const board = (await store.loadBoardsFile())!.boards[0]!;
  expect(board).toMatchObject({ now: ["3", "4"], later: ["1"] });
  const tasks = await store.loadTasks();
  expect([...collectLaneIds(board, tasks, "later")].sort()).toEqual(["1", "2"]);

  const shown = strip(await runTodo(store, ["board", "show"]));
  expect(shown.indexOf("Now")).toBeLessThan(shown.indexOf("Task 3"));
  expect(shown.indexOf("Later")).toBeLessThan(shown.indexOf("Task 2"));

  expect(strip(await runTodo(store, ["board", "rm", "3"]))).toContain("Took #3 off werk");
  expect(strip(await runTodo(store, ["board", "rm", "3"]))).toContain("#3 is not on werk");
  expect((await store.loadTasks()).map((item) => item.id)).toEqual(["1", "2", "3", "4"]);
});

test("board move takes tasks off one board and onto another, keeping their lane", async () => {
  const store = await createStore([task(1, { kind: "epic" }), task(2, { parentId: "1" }), task(3), task(4)]);
  await runTodo(store, ["board", "new", "werk"]);
  await runTodo(store, ["board", "new", "cleanup"]);
  await runTodo(store, ["board", "add", "1", "3"]);
  await runTodo(store, ["board", "later", "4"]);

  expect(strip(await runTodo(store, ["board", "move", "1", "4", "--to", "WERK"]))).toContain("Moved #4 from cleanup to Later on werk");
  expect(strip(await runTodo(store, ["board", "mv", "3", "--to", "werk", "--from", "cleanup", "--later"]))).toContain("Moved #3 from cleanup to Later on werk");
  let state = (await store.loadBoardsFile())!;
  expect(state.boards).toMatchObject([{ name: "werk", now: ["1"], later: ["4", "3"] }, { name: "cleanup", now: [], later: [] }]);

  await expect(runTodo(store, ["board", "move", "2", "--to", "cleanup", "--from", "werk"])).rejects.toThrow("take #1 off instead");
  await expect(runTodo(store, ["board", "move", "1", "--to", "werk"])).rejects.toThrow("#1 is not on cleanup");
  await expect(runTodo(store, ["board", "move", "1", "--to", "werk", "--from", "werk"])).rejects.toThrow("already on werk");
  await expect(runTodo(store, ["board", "move", "1"])).rejects.toThrow("--to <board>");
  await expect(runTodo(store, ["board", "move", "1", "--to", "cleanup", "--from", "werk", "--now", "--later"])).rejects.toThrow("Pick one");
  state = (await store.loadBoardsFile())!;
  expect(state.boards[0]).toMatchObject({ now: ["1"], later: ["4", "3"] });
});

test("--on targets another board and needs no active one", async () => {
  const store = await createStore([task(1), task(2)]);
  await runTodo(store, ["board", "new", "a"]);
  await runTodo(store, ["board", "new", "b"]);
  await runTodo(store, ["board", "off"]);
  await expect(runTodo(store, ["board", "add", "1"])).rejects.toThrow("No active board");

  await runTodo(store, ["board", "add", "1", "--later", "--on", "a"]);
  await runTodo(store, ["board", "add", "2", "--on", "B"]);
  const state = (await store.loadBoardsFile())!;
  expect(state.boards).toMatchObject([{ name: "a", now: [], later: ["1"] }, { name: "b", now: ["2"], later: [] }]);
});

test("new tasks join the active board unless --off-board, --later picks Later", async () => {
  const store = await createStore([]);
  await expect(runTodo(store, ["add", "x", "--later"])).rejects.toThrow("--later needs an active board");
  expect(await store.loadTasks()).toEqual([]);

  await runTodo(store, ["board", "new", "werk"]);
  await runTodo(store, ["add", "first"]);
  await runTodo(store, ["add", "second", "--later"]);
  await runTodo(store, ["add", "third", "--off-board"]);
  await runTodo(store, ["epic", "grouped", "--later"]);
  await runTodo(store, ["sub", "4", "child"]);
  await expect(runTodo(store, ["sub", "1", "nested", "--later"])).rejects.toThrow("#1 is in Now");

  expect((await store.loadBoardsFile())!.boards[0]).toMatchObject({ now: ["1"], later: ["2", "4"] });
  const tasks = await store.loadTasks();
  expect(laneOf((await store.loadBoardsFile())!.boards[0]!, tasks, "5")).toBe("later");
});

test("list and panel show the active board; --all and board off lift it", async () => {
  const store = await createStore([task(1, { description: "on board" }), task(2, { description: "elsewhere" })]);
  await runTodo(store, ["board", "new", "werk", "--for", "2h"]);
  await runTodo(store, ["board", "add", "1"]);

  const listed = strip(await runTodo(store, ["list"]));
  expect(listed).toContain("werk · ");
  expect(listed).toContain("on board");
  expect(listed).not.toContain("elsewhere");
  expect(strip(await runTodo(store, ["list", "--all"]))).toContain("elsewhere");
  expect(strip(await runTodo(store, ["panel"]))).not.toContain("elsewhere");

  await runTodo(store, ["board", "off"]);
  const panel = strip(await runTodo(store, ["panel"]));
  expect(panel).toContain("elsewhere");
  expect(panel).toMatch(/werk · (1h59m|2h) left · todo board use werk/);
});

test("panel shows every board in columns when panel-boards is all", async () => {
  const store = await createStore([task(1, { description: "on werk" }), task(2, { description: "on thuis" }), task(3, { description: "elsewhere" })]);
  await runTodo(store, ["board", "new", "werk"]);
  await runTodo(store, ["board", "add", "1"]);
  await runTodo(store, ["board", "new", "thuis"]);
  await runTodo(store, ["board", "add", "2", "--later"]);
  expect(strip(await runTodo(store, ["panel"]))).not.toContain("on werk");

  expect(await runTodo(store, ["config", "panel-boards", "all"])).toContain("panel-boards = all");
  const panel = strip(await runTodo(store, ["panel", "--side"]));
  const titles = panel.split("\n").find((line) => line.includes("Now"));
  expect(titles).toContain("werk · Now");
  expect(titles).toContain("* thuis · Now");
  expect(panel).toContain("on werk");
  expect(panel).toContain("Later");
  expect(panel).toContain("on thuis");
  expect(panel).not.toContain("elsewhere");

  expect(strip(await runTodo(store, ["panel", "--all"]))).toContain("elsewhere");
  await runTodo(store, ["config", "panel-boards", "active"]);
  expect(strip(await runTodo(store, ["panel", "--boards"]))).toContain("werk · Now");
});

test("rm purges task ids from every board", async () => {
  const store = await createStore([task(1), task(2)]);
  await runTodo(store, ["board", "new", "a"]);
  await runTodo(store, ["board", "add", "1", "2"]);
  await runTodo(store, ["board", "new", "b"]);
  await runTodo(store, ["board", "later", "1"]);
  await runTodo(store, ["rm", "1"]);
  expect((await store.loadBoardsFile())!.boards).toMatchObject([{ now: ["2"], later: [] }, { now: [], later: [] }]);
});

test("extend, rename and end", async () => {
  const store = await createStore([]);
  await runTodo(store, ["board", "new", "plain"]);
  await expect(runTodo(store, ["board", "extend", "1h"])).rejects.toThrow("only timed boards");

  await runTodo(store, ["focus", "2h", "sprint"]);
  const before = (await store.loadBoardsFile())!.boards[1]!.expiresAt!;
  await runTodo(store, ["board", "extend", "30m"]);
  expect((await store.loadBoardsFile())!.boards[1]!.expiresAt).toBe(before + 30 * 60_000);
  await expect(runTodo(store, ["board", "extend", "23h"])).rejects.toThrow("24h from now");

  await runTodo(store, ["board", "rename", "sprint", "big", "sprint"]);
  expect((await store.loadBoardsFile())).toMatchObject({ active: "big sprint" });
  await expect(runTodo(store, ["board", "rename", "big sprint", "PLAIN"])).rejects.toThrow("already exists");

  await runTodo(store, ["add", "session work"]);
  expect(strip(await runTodo(store, ["board", "end"]))).toContain("its tasks are under epic #2 big sprint");
  const tasks = await store.loadTasks();
  expect(tasks.find((item) => item.id === "1")?.parentId).toBe("2");
  expect((await store.loadBoardsFile())).toEqual({ boards: [expect.objectContaining({ name: "plain" })] });

  await runTodo(store, ["board", "end", "plain"]);
  expect((await store.loadBoardsFile())).toEqual({ boards: [] });
});

test("focus without a title names the board after the date", async () => {
  const store = await createStore([]);
  expect(strip(await runTodo(store, ["focus", "90m"]))).toMatch(/Focus \d+ \w+ is active · 1h30m/);
  await runTodo(store, ["focus", "1h"]);
  expect((await store.loadBoardsFile())!.boards.map((board) => board.name)[1]).toMatch(/\(2\)$/);
});

test("an expired timed board wraps its session up into an epic and stops being active", async () => {
  const now = Date.now();
  const store = await createStore([task(1, { createdAt: now - 2 * HOUR }), task(2, { createdAt: now - 30 * 60_000 }), task(3, { createdAt: now - 20 * 60_000 })]);
  await store.saveBoards({
    active: "sprint",
    boards: [
      { name: "sprint", createdAt: now - HOUR, expiresAt: now - 1, now: ["1", "2"], later: [] },
      { name: "keep", createdAt: now - HOUR, now: ["3"], later: [] },
    ],
  });

  const state = await loadBoards(store, now);
  expect(state).toEqual({ boards: [{ name: "keep", createdAt: now - HOUR, now: ["3"], later: [] }] });
  const tasks = await store.loadTasks();
  const epic = tasks.find((item) => item.kind === "epic");
  expect(epic?.description).toBe("sprint");
  expect(tasks.find((item) => item.id === "2")?.parentId).toBe(epic?.id);
  expect(tasks.find((item) => item.id === "1")?.parentId).toBeUndefined();
  expect(tasks.find((item) => item.id === "3")?.parentId).toBeUndefined();
});

test("focus.json migrates once into boards.json with the old membership rules", async () => {
  const startedAt = Date.now() - HOUR;
  const store = await createStore([
    task(1, { createdAt: 1 }),
    task(2, { createdAt: 2 }),
    task(3, { createdAt: startedAt + 1 }),
    task(4, { createdAt: startedAt + 2, parentId: "3" }),
    task(5, { createdAt: startedAt + 3 }),
    task(6, { createdAt: startedAt + 4 }),
  ]);
  const paths = getTodoPaths(temporaryDirectories[temporaryDirectories.length - 1]!);
  await writeFile(paths.focusFile, JSON.stringify({ title: "deploy", startedAt, expiresAt: startedAt + 4 * HOUR, pinned: ["1"], excluded: ["6"], later: ["5"] }));

  const state = await loadBoards(store);
  expect(state).toEqual({ active: "deploy", boards: [{ name: "deploy", createdAt: startedAt, expiresAt: startedAt + 4 * HOUR, now: ["1", "3"], later: ["5"] }] });
  expect(await store.loadBoardsFile()).toEqual(state);
  expect(await Bun.file(paths.focusFile).exists()).toBe(false);
});

test("a hidden untitled legacy board migrates inactive with a dated name", () => {
  const state = migrateLegacyFocus({ startedAt: Date.UTC(2026, 8, 26, 12), expiresAt: Date.UTC(2026, 8, 26, 16), hidden: true }, []);
  expect(state.active).toBeUndefined();
  expect(state.boards[0]?.name).toBe("Focus 26 Sep");
});

test("placing a parent folds listed children into it", () => {
  const board: Board = { name: "b", createdAt: 0, now: ["2"], later: [] };
  const tasks = [task(1), task(2, { parentId: "1" })];
  expect(placeOnBoard(board, tasks, "1", "later")).toEqual({ board: { ...board, now: [], later: ["1"] }, change: "added" });
});

test("durations are bounded to a minute and a day", () => {
  expect(parseDuration("2h30m")).toBe(150 * 60_000);
  expect(parseDuration("1.5")).toBe(90 * 60_000);
  expect(() => parseDuration("25h")).toThrow(UserInputError);
  expect(() => parseDuration("0m")).toThrow(UserInputError);
  expect(() => parseDuration("soon")).toThrow("Not a duration");
});

function strip(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, "");
}

function task(id: number, overrides: Partial<Task> = {}): Task {
  return {
    id: `${id}`,
    description: `Task ${id}`,
    status: "pending",
    priority: "none",
    createdAt: id,
    updatedAt: id,
    reminderOffsets: [],
    notificationsSent: { reminders: [], overdue: false },
    ...overrides,
  };
}

async function createStore(tasks: Task[]): Promise<TodoStore> {
  const dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-boards-"));
  temporaryDirectories.push(dataDirectory);
  const store = new TodoStore(getTodoPaths(dataDirectory));
  await store.saveTasks(tasks);
  return store;
}
