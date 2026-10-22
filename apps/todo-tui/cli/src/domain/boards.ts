import { MAX_BOARD_DURATION_MS } from "./duration";
import type { Task, TaskId } from "./task";
import { collectDescendantIds } from "./task-tree";
import { UnknownTokenError } from "./unknown-token-error";
import { UserInputError } from "./user-input-error";

export type Lane = "now" | "later";

export const LANES: Lane[] = ["now", "later"];
export const LANE_LABELS: Record<Lane, string> = { now: "Now", later: "Later" };

/** A curated view of task ids shared with the TUI through boards.json. Lanes hold root ids; descendants follow them. */
export interface Board {
  name: string;
  createdAt: number;
  expiresAt?: number;
  now: TaskId[];
  later: TaskId[];
}

export interface BoardsState {
  active?: string;
  boards: Board[];
}

/** The pre-boards focus.json shape, read once for migration. */
export interface LegacyFocusBoard {
  title?: string;
  startedAt: number;
  expiresAt: number;
  pinned?: TaskId[];
  excluded?: TaskId[];
  later?: TaskId[];
  hidden?: boolean;
}

export type PlaceChange = "added" | "moved" | "unchanged";

export function findBoard(state: BoardsState, name: string): Board | undefined {
  const needle = name.trim().toLowerCase();
  return state.boards.find((board) => board.name.toLowerCase() === needle);
}

export function requireBoard(state: BoardsState, name: string): Board {
  const board = findBoard(state, name);
  if (board !== undefined) return board;
  const names = state.boards.map((candidate) => candidate.name);
  if (names.length === 0) throw new UserInputError(`No board named ${name} · todo board new ${name} creates it`);
  throw new UnknownTokenError(`Unknown board: ${name}`, name, names, "value");
}

export function getActiveBoard(state: BoardsState): Board | undefined {
  return state.active === undefined ? undefined : findBoard(state, state.active);
}

export function isTimed(board: Board): board is Board & { expiresAt: number } {
  return board.expiresAt !== undefined;
}

export function isExpired(board: Board, now = Date.now()): boolean {
  return board.expiresAt !== undefined && board.expiresAt <= now;
}

export function remainingMs(board: Board, now = Date.now()): number {
  return board.expiresAt === undefined ? Number.POSITIVE_INFINITY : Math.max(0, board.expiresAt - now);
}

/** The lane a task shows in: the lane of its nearest ancestor-or-self listed on the board. */
export function laneOf(board: Board, tasks: ReadonlyArray<Task>, id: TaskId): Lane | undefined {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set<TaskId>();
  let current: TaskId | undefined = id;
  while (current !== undefined && !seen.has(current)) {
    if (board.now.includes(current)) return "now";
    if (board.later.includes(current)) return "later";
    seen.add(current);
    current = byId.get(current)?.parentId;
  }
  return undefined;
}

export function collectLaneIds(board: Board, tasks: ReadonlyArray<Task>, lane: Lane): Set<TaskId> {
  return new Set(tasks.filter((task) => laneOf(board, tasks, task.id) === lane).map((task) => task.id));
}

export function collectBoardIds(board: Board, tasks: ReadonlyArray<Task>): Set<TaskId> {
  return new Set(tasks.filter((task) => laneOf(board, tasks, task.id) !== undefined).map((task) => task.id));
}

function findListedAncestor(board: Board, tasks: ReadonlyArray<Task>, id: TaskId): TaskId | undefined {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set<TaskId>([id]);
  let current = byId.get(id)?.parentId;
  while (current !== undefined && !seen.has(current)) {
    if (board.now.includes(current) || board.later.includes(current)) return current;
    seen.add(current);
    current = byId.get(current)?.parentId;
  }
  return undefined;
}

/** Puts a task in a lane, adding it when needed. Listed descendants fold into it, since they follow it anyway. */
export function placeOnBoard(board: Board, tasks: ReadonlyArray<Task>, id: TaskId, lane: Lane): { board: Board; change: PlaceChange } {
  const ancestor = findListedAncestor(board, tasks, id);
  if (ancestor !== undefined) {
    throw new UserInputError(`#${id} sits under #${ancestor} on ${board.name} and moves with it · move #${ancestor} instead`);
  }
  const current: Lane | undefined = board.now.includes(id) ? "now" : board.later.includes(id) ? "later" : undefined;
  const folded = collectDescendantIds([...tasks], [id]);
  const keep = (item: TaskId): boolean => item !== id && !folded.has(item);
  const next: Board = { ...board, now: board.now.filter(keep), later: board.later.filter(keep) };
  next[lane] = [...next[lane], id];
  return { board: next, change: current === undefined ? "added" : current === lane ? "unchanged" : "moved" };
}

export function takeOffBoard(board: Board, tasks: ReadonlyArray<Task>, id: TaskId): { board: Board; removed: boolean } {
  if (board.now.includes(id) || board.later.includes(id)) {
    return { board: { ...board, now: board.now.filter((item) => item !== id), later: board.later.filter((item) => item !== id) }, removed: true };
  }
  const ancestor = findListedAncestor(board, tasks, id);
  if (ancestor !== undefined) {
    throw new UserInputError(`#${id} sits under #${ancestor} on ${board.name} · take #${ancestor} off instead`);
  }
  return { board, removed: false };
}

/**
 * @name moveBetweenBoards
 * @description Takes a task off one board and puts it on another. It keeps the
 * lane it had unless a lane is given; its subtasks follow it.
 *
 * @example
 * const { state: next, lane } = moveBetweenBoards(state, tasks, "12", "cleanup", "werk");
 */
export function moveBetweenBoards(state: BoardsState, tasks: ReadonlyArray<Task>, id: TaskId, fromName: string, toName: string, lane?: Lane): { state: BoardsState; from: Board; to: Board; lane: Lane } {
  const from = requireBoard(state, fromName);
  const to = requireBoard(state, toName);
  if (from.name === to.name) throw new UserInputError(`#${id} is already on ${to.name}`);
  const currentLane = laneOf(from, tasks, id);
  if (currentLane === undefined) throw new UserInputError(`#${id} is not on ${from.name}`);
  const taken = takeOffBoard(from, tasks, id);
  const target = lane ?? currentLane;
  const placed = placeOnBoard(to, tasks, id, target);
  return { state: replaceBoard(replaceBoard(state, from.name, taken.board), to.name, placed.board), from, to, lane: target };
}

export function replaceBoard(state: BoardsState, name: string, board: Board): BoardsState {
  const needle = name.toLowerCase();
  return { ...state, boards: state.boards.map((candidate) => (candidate.name.toLowerCase() === needle ? board : candidate)) };
}

export function createBoard(state: BoardsState, name: string, now: number, durationMs?: number): { state: BoardsState; board: Board } {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) throw new UserInputError("A board needs a name");
  if (findBoard(state, trimmed) !== undefined) throw new UserInputError(`A board named ${trimmed} already exists · todo board use ${trimmed}`);
  const board: Board = { name: trimmed, createdAt: now, ...(durationMs === undefined ? {} : { expiresAt: now + durationMs }), now: [], later: [] };
  return { state: { active: board.name, boards: [...state.boards, board] }, board };
}

export function renameBoard(state: BoardsState, from: string, to: string): BoardsState {
  const board = requireBoard(state, from);
  const trimmed = to.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) throw new UserInputError("A board needs a name");
  const clash = findBoard(state, trimmed);
  if (clash !== undefined && clash !== board) throw new UserInputError(`A board named ${clash.name} already exists`);
  const renamed = replaceBoard(state, board.name, { ...board, name: trimmed });
  const wasActive = state.active !== undefined && state.active.toLowerCase() === board.name.toLowerCase();
  return wasActive ? { ...renamed, active: trimmed } : renamed;
}

export function deleteBoard(state: BoardsState, name: string): BoardsState {
  const needle = name.toLowerCase();
  const boards = state.boards.filter((board) => board.name.toLowerCase() !== needle);
  return state.active !== undefined && state.active.toLowerCase() === needle ? { boards } : { ...state, boards };
}

/** Pushes a timed board's end back, never beyond 24h from now. */
export function extendBoard(board: Board, durationMs: number, now = Date.now()): Board {
  if (!isTimed(board)) throw new UserInputError(`${board.name} has no timer · only timed boards can be extended`);
  const expiresAt = Math.max(board.expiresAt, now) + durationMs;
  if (expiresAt > now + MAX_BOARD_DURATION_MS) throw new UserInputError("A board can run at most 24h from now");
  return { ...board, expiresAt };
}

/** Drops removed task ids from every lane. */
export function purgeTaskIds(state: BoardsState, ids: ReadonlySet<TaskId>): BoardsState {
  return {
    ...state,
    boards: state.boards.map((board) => ({ ...board, now: board.now.filter((id) => !ids.has(id)), later: board.later.filter((id) => !ids.has(id)) })),
  };
}

/** Top-level tasks created while a timed board ran and listed on it: these move under its epic when it ends. */
export function collectSessionRoots(board: Board, tasks: ReadonlyArray<Task>): Task[] {
  return tasks.filter((task) => task.parentId === undefined && task.createdAt >= board.createdAt && (board.now.includes(task.id) || board.later.includes(task.id)));
}

export function defaultBoardName(state: BoardsState, timestamp: number): string {
  const base = `Focus ${formatBoardDate(timestamp)}`;
  if (findBoard(state, base) === undefined) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base} (${suffix})`;
    if (findBoard(state, candidate) === undefined) return candidate;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatBoardDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** Converts a focus.json board with the old membership rules: pinned plus created-since-start, minus excluded. */
export function migrateLegacyFocus(legacy: LegacyFocusBoard, tasks: ReadonlyArray<Task>): BoardsState {
  const excluded = new Set(legacy.excluded ?? []);
  const seeds = [...(legacy.pinned ?? []), ...tasks.filter((task) => task.createdAt >= legacy.startedAt).map((task) => task.id)].filter((id) => !excluded.has(id));
  const members = new Set(seeds);
  for (const id of collectDescendantIds([...tasks], seeds)) {
    if (!excluded.has(id)) members.add(id);
  }
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const roots = [...members].filter((id) => {
    const parentId = byId.get(id)?.parentId;
    return parentId === undefined || !members.has(parentId);
  });
  const later = (legacy.later ?? []).filter((id) => members.has(id));
  const name = legacy.title === undefined || legacy.title.trim() === "" ? `Focus ${formatBoardDate(legacy.startedAt)}` : legacy.title.trim();
  const board: Board = {
    name,
    createdAt: legacy.startedAt,
    expiresAt: legacy.expiresAt,
    now: roots.filter((id) => !later.includes(id)).sort(compareIds),
    later,
  };
  return legacy.hidden === true ? { boards: [board] } : { active: name, boards: [board] };
}

function compareIds(left: TaskId, right: TaskId): number {
  return Number(left) - Number(right);
}

/** Tolerates a hand-edited boards.json: drops malformed boards and an active name that no longer exists. */
export function normalizeBoards(value: unknown): BoardsState {
  if (typeof value !== "object" || value === null) return { boards: [] };
  const raw = value as { active?: unknown; boards?: unknown };
  const boards = (Array.isArray(raw.boards) ? raw.boards : []).flatMap((entry: unknown): Board[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const board = entry as Partial<Record<keyof Board, unknown>>;
    if (typeof board.name !== "string" || board.name.trim() === "") return [];
    const ids = (list: unknown): TaskId[] => (Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : []);
    return [{
      name: board.name,
      createdAt: typeof board.createdAt === "number" ? board.createdAt : 0,
      ...(typeof board.expiresAt === "number" ? { expiresAt: board.expiresAt } : {}),
      now: ids(board.now),
      later: ids(board.later),
    }];
  });
  const state: BoardsState = { boards };
  if (typeof raw.active === "string") {
    const active = findBoard(state, raw.active);
    if (active !== undefined) state.active = active.name;
  }
  return state;
}
