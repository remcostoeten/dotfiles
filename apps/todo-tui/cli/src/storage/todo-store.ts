import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { normalizeTasks } from "../domain/normalize-task";
import type { TypoMemory } from "../domain/autocorrect";
import { normalizeBoards, type BoardsState, type LegacyFocusBoard } from "../domain/boards";
import { DEFAULT_CONFIG, type RemovedTask, type Task, type TodoConfig, type UndoData } from "../domain/task";

export interface TodoPaths {
  dataDir: string;
  tasksFile: string;
  configFile: string;
  undoFile: string;
  removedFile: string;
  typosFile: string;
  boardsFile: string;
  focusFile: string;
  lockFile: string;
}

export function getTodoPaths(dataDir = process.env.DOTFILES_DATA_DIR ?? join(process.env.HOME ?? ".", ".dotfiles")): TodoPaths {
  const todoDir = join(dataDir, "todo");
  return {
    dataDir: todoDir,
    tasksFile: join(todoDir, "tasks.json"),
    configFile: join(todoDir, "config.json"),
    undoFile: join(todoDir, "undo.json"),
    removedFile: join(todoDir, "removed.json"),
    typosFile: join(todoDir, "typos.json"),
    boardsFile: join(todoDir, "boards.json"),
    focusFile: join(todoDir, "focus.json"),
    lockFile: join(todoDir, "reminders.lock"),
  };
}

interface LegacyConfigKeys {
  shellDisplayLimit?: number;
  shellLayout?: TodoConfig["panelLayout"];
}

const LOCK_POLL_MS = 25;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 30_000;

export class TodoStore {
  constructor(private readonly paths: TodoPaths = getTodoPaths()) {}

  get tasksFile(): string {
    return this.paths.tasksFile;
  }

  /**
   * Serializes a read-modify-write of the task file across processes, so the CLI and the
   * scheduler cannot both decide the same reminder is ready to fire. Falls through to running
   * the operation unlocked if the lock cannot be taken, because losing a reminder is worse than
   * racing for one.
   */
  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const acquired = await this.acquireLock();
    try {
      return await operation();
    } finally {
      if (acquired) await this.releaseLock();
    }
  }

  private async acquireLock(): Promise<boolean> {
    await mkdir(this.paths.dataDir, { recursive: true });
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const handle = await open(this.paths.lockFile, "wx");
        await handle.write(`${process.pid}\n`);
        await handle.close();
        return true;
      } catch (error: unknown) {
        if (!isExistingFile(error)) return false;
        if (await this.breakStaleLock()) continue;
        await delay(LOCK_POLL_MS);
      }
    }
    return false;
  }

  private async breakStaleLock(): Promise<boolean> {
    try {
      const stats = await stat(this.paths.lockFile);
      if (Date.now() - stats.mtimeMs < LOCK_STALE_MS) return false;
      await unlink(this.paths.lockFile);
      return true;
    } catch {
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await unlink(this.paths.lockFile);
    } catch (error: unknown) {
      if (!isMissingFile(error)) throw error;
    }
  }

  async loadTasks(): Promise<Task[]> {
    return normalizeTasks(await this.readJson<unknown>(this.paths.tasksFile, []));
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    await this.writeJsonAtomically(this.paths.tasksFile, tasks);
  }

  /** Reads config.json; the pre-rename shellDisplayLimit/shellLayout keys fill in panel settings once and are dropped on the next save. */
  async loadConfig(): Promise<TodoConfig> {
    const { shellDisplayLimit, shellLayout, ...saved } = await this.readJson<Partial<TodoConfig> & LegacyConfigKeys>(this.paths.configFile, {});
    const undoTimeout = typeof saved.undoTimeout === "number" && saved.undoTimeout > 0 ? saved.undoTimeout : DEFAULT_CONFIG.undoTimeout;
    return {
      ...DEFAULT_CONFIG,
      ...(shellDisplayLimit === undefined ? {} : { panelLimit: shellDisplayLimit }),
      ...(shellLayout === undefined ? {} : { panelLayout: shellLayout }),
      ...saved,
      schemaVersion: 1,
      undoTimeout,
    };
  }

  async saveConfig(config: TodoConfig): Promise<void> {
    await this.writeJsonAtomically(this.paths.configFile, config);
  }

  async loadCollapsedEpicIds(): Promise<Set<string>> {
    const saved = (await this.loadConfig()).collapsedEpicIds;
    return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []);
  }

  async saveCollapsedEpicIds(ids: Iterable<string>): Promise<void> {
    const config = await this.loadConfig();
    const collapsedEpicIds = [...new Set(ids)].sort((left, right) => Number(left) - Number(right));
    await this.saveConfig({ ...config, collapsedEpicIds });
  }

  /** Stores removed tasks for `todo undo` and permanently in the removed archive under the same timestamp. */
  async saveUndo(tasks: Task[]): Promise<void> {
    const config = await this.loadConfig();
    const removed = await this.loadRemoved();
    const timestamp = Math.max(Date.now(), ...removed.map((entry) => entry.removedAt + 1));
    await this.appendRemoved(removed, tasks, timestamp);
    await this.writeJsonAtomically(this.paths.undoFile, {
      tasks,
      timestamp,
      expiresAt: timestamp + config.undoTimeout,
    } satisfies UndoData);
  }

  async loadUndo(): Promise<UndoData | undefined> {
    const undo = await this.readJson<UndoData | undefined>(this.paths.undoFile, undefined);
    if (undo === undefined || Date.now() > undo.expiresAt) {
      await this.clearUndo();
      return undefined;
    }
    return undo;
  }

  async loadRemoved(): Promise<RemovedTask[]> {
    const saved = await this.readJson<unknown>(this.paths.removedFile, []);
    if (!Array.isArray(saved)) return [];
    const tasks = normalizeTasks(saved.map((entry: { task?: unknown }) => entry.task));
    return saved.map((entry: { ref: number; removedAt: number }, index) => ({ ref: entry.ref, removedAt: entry.removedAt, task: tasks[index] as Task }));
  }

  async saveRemoved(entries: RemovedTask[]): Promise<void> {
    await this.writeJsonAtomically(this.paths.removedFile, entries);
  }

  /** Drops a removal batch from the archive once `undo` has put it back into the task list. */
  async forgetRemovedBatch(removedAt: number): Promise<void> {
    const entries = await this.loadRemoved();
    const kept = entries.filter((entry) => entry.removedAt !== removedAt);
    if (kept.length !== entries.length) await this.saveRemoved(kept);
  }

  private async appendRemoved(entries: RemovedTask[], tasks: Task[], removedAt: number): Promise<void> {
    if (tasks.length === 0) return;
    let nextRef = entries.reduce((max, entry) => Math.max(max, entry.ref), 0) + 1;
    await this.saveRemoved([...entries, ...tasks.map((task) => ({ ref: nextRef++, removedAt, task }))]);
  }

  async loadTypoMemory(): Promise<TypoMemory> {
    return await this.readJson<TypoMemory>(this.paths.typosFile, {});
  }

  async saveTypoMemory(memory: TypoMemory): Promise<void> {
    await this.writeJsonAtomically(this.paths.typosFile, memory);
  }

  /** The saved boards, or undefined when boards.json does not exist yet. */
  async loadBoardsFile(): Promise<BoardsState | undefined> {
    const saved = await this.readJson<unknown>(this.paths.boardsFile, undefined);
    return saved === undefined ? undefined : normalizeBoards(saved);
  }

  async saveBoards(state: BoardsState): Promise<void> {
    await this.writeJsonAtomically(this.paths.boardsFile, state);
  }

  async loadLegacyFocus(): Promise<LegacyFocusBoard | undefined> {
    const board = await this.readJson<Partial<LegacyFocusBoard> | undefined>(this.paths.focusFile, undefined);
    if (board === undefined || typeof board.startedAt !== "number" || typeof board.expiresAt !== "number") return undefined;
    return board as LegacyFocusBoard;
  }

  async deleteLegacyFocus(): Promise<void> {
    try {
      await unlink(this.paths.focusFile);
    } catch (error: unknown) {
      if (!isMissingFile(error)) throw error;
    }
  }

  async clearUndo(): Promise<void> {
    try {
      await unlink(this.paths.undoFile);
    } catch (error: unknown) {
      if (!isMissingFile(error)) throw error;
    }
  }

  private async readJson<T>(path: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await readFile(path, "utf8")) as T;
    } catch (error: unknown) {
      if (isMissingFile(error)) return fallback;
      throw new Error(`Could not read ${path}: ${formatError(error)}`);
    }
  }

  private async writeJsonAtomically(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporaryPath, path);
  }
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isExistingFile(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
