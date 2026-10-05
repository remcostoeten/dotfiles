import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { normalizeTasks } from "../domain/normalize-task";
import type { TypoMemory } from "../domain/autocorrect";
import { DEFAULT_CONFIG, type Task, type TodoConfig, type UndoData } from "../domain/task";

export interface TodoPaths {
  dataDir: string;
  tasksFile: string;
  configFile: string;
  undoFile: string;
  typosFile: string;
  lockFile: string;
}

export function getTodoPaths(dataDir = process.env.DOTFILES_DATA_DIR ?? join(process.env.HOME ?? ".", ".dotfiles")): TodoPaths {
  const todoDir = join(dataDir, "todo");
  return {
    dataDir: todoDir,
    tasksFile: join(todoDir, "tasks.json"),
    configFile: join(todoDir, "config.json"),
    undoFile: join(todoDir, "undo.json"),
    typosFile: join(todoDir, "typos.json"),
    lockFile: join(todoDir, "reminders.lock"),
  };
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

  async loadConfig(): Promise<TodoConfig> {
    const saved = await this.readJson<Partial<TodoConfig>>(this.paths.configFile, {});
    const undoTimeout = typeof saved.undoTimeout === "number" && saved.undoTimeout > 0 ? saved.undoTimeout : DEFAULT_CONFIG.undoTimeout;
    return { ...DEFAULT_CONFIG, ...saved, schemaVersion: 1, undoTimeout };
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

  async saveUndo(tasks: Task[]): Promise<void> {
    const config = await this.loadConfig();
    const timestamp = Date.now();
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

  async loadTypoMemory(): Promise<TypoMemory> {
    return await this.readJson<TypoMemory>(this.paths.typosFile, {});
  }

  async saveTypoMemory(memory: TypoMemory): Promise<void> {
    await this.writeJsonAtomically(this.paths.typosFile, memory);
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
