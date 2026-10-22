import { collectSessionRoots, deleteBoard, getActiveBoard, isExpired, laneOf, migrateLegacyFocus, placeOnBoard, replaceBoard, type Board, type BoardsState, type Lane } from "../domain/boards";
import type { Task, TaskId } from "../domain/task";
import { UserInputError } from "../domain/user-input-error";
import type { TodoStore } from "../storage/todo-store";

/**
 * Loads boards.json, migrating a legacy focus.json on first use and wrapping up every timed board
 * that has run out, so callers only ever see live boards.
 */
export async function loadBoards(store: TodoStore, now = Date.now()): Promise<BoardsState> {
  let state = await store.loadBoardsFile();
  if (state === undefined) {
    const legacy = await store.loadLegacyFocus();
    state = legacy === undefined ? { boards: [] } : migrateLegacyFocus(legacy, await store.loadTasks());
    if (legacy !== undefined) {
      await store.saveBoards(state);
      await store.deleteLegacyFocus();
    }
  }

  const expired = state.boards.filter((board) => isExpired(board, now));
  if (expired.length === 0) return state;
  for (const board of expired) {
    await wrapUpBoard(store, board, now);
    state = deleteBoard(state, board.name);
  }
  await store.saveBoards(state);
  return state;
}

/** Board names as stored, without running expiry, for validating arguments before a command runs. */
export async function readBoardNames(store: TodoStore): Promise<string[]> {
  const state = await store.loadBoardsFile();
  return state?.boards.map((board) => board.name) ?? [];
}

/**
 * Ends a timed board's session: the top-level tasks created on it move under a new epic named
 * after the board, so the work stays together once the board is gone.
 */
export async function wrapUpBoard(store: TodoStore, board: Board, now = Date.now()): Promise<Task | undefined> {
  const tasks = await store.loadTasks();
  const sessionRoots = collectSessionRoots(board, tasks);
  if (board.expiresAt === undefined || sessionRoots.length === 0) return undefined;
  const epic: Task = {
    id: `${nextTaskId(tasks)}`,
    description: board.name,
    status: sessionRoots.every((task) => task.status === "completed") ? "completed" : "pending",
    priority: "none",
    kind: "epic",
    createdAt: board.createdAt,
    updatedAt: now,
    reminderOffsets: [],
    notificationsSent: { reminders: [], overdue: false },
  };
  for (const task of sessionRoots) {
    task.parentId = epic.id;
    task.updatedAt = now;
  }
  await store.saveTasks([...tasks, epic]);
  return epic;
}

export interface BoardPlacement {
  later?: boolean;
  offBoard?: boolean;
}

/**
 * Puts freshly created tasks on the active board. A task whose parent is already on the board
 * follows it; asking for Later there only works when the parent is in Later too.
 */
export async function placeNewTasks(store: TodoStore, state: BoardsState, tasks: Task[], created: Task[], placement: BoardPlacement): Promise<void> {
  const board = getActiveBoard(state);
  if (board === undefined || placement.offBoard === true || created.length === 0) return;
  const lane: Lane = placement.later === true ? "later" : "now";
  let next = board;
  for (const task of created) {
    if (laneOfParent(next, tasks, task) !== undefined) continue;
    next = placeOnBoard(next, tasks, task.id, lane).board;
  }
  await store.saveBoards(replaceBoard(state, board.name, next));
}

/** Rejects `--later` where it cannot apply, before anything is written. */
export function checkPlacement(state: BoardsState, tasks: ReadonlyArray<Task>, parentIds: ReadonlyArray<TaskId | undefined>, placement: BoardPlacement): void {
  if (placement.later === true && placement.offBoard === true) throw new UserInputError("--later and --off-board contradict each other");
  if (placement.later !== true) return;
  const board = getActiveBoard(state);
  if (board === undefined) throw new UserInputError("--later needs an active board · todo board use <name> or todo board new <name>");
  for (const parentId of parentIds) {
    if (parentId === undefined) continue;
    const parentLane = laneOf(board, tasks, parentId);
    if (parentLane === "now") throw new UserInputError(`#${parentId} is in Now on ${board.name}; its subtasks follow it · move #${parentId} to Later instead`);
  }
}

function laneOfParent(board: Board, tasks: ReadonlyArray<Task>, task: Task): Lane | undefined {
  return task.parentId === undefined ? undefined : laneOf(board, tasks, task.parentId);
}

export function nextTaskId(tasks: ReadonlyArray<Task>): number {
  const numericIds = tasks.map((task) => Number.parseInt(task.id, 10)).filter((id) => Number.isFinite(id));
  return (numericIds.length === 0 ? 0 : Math.max(...numericIds)) + 1;
}
