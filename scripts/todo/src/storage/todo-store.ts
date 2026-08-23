import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { normalizeTasks } from "../domain/normalize-task";
import { DEFAULT_CONFIG, type Task, type TodoConfig, type UndoData } from "../domain/task";

export interface TodoPaths {
  dataDir: string;
  tasksFile: string;
  configFile: string;
  undoFile: string;
}

export function getTodoPaths(dataDir = process.env.DOTFILES_DATA_DIR ?? join(process.env.HOME ?? ".", ".dotfiles")): TodoPaths {
  const todoDir = join(dataDir, "todo");
  return {
    dataDir: todoDir,
    tasksFile: join(todoDir, "tasks.json"),
    configFile: join(todoDir, "config.json"),
    undoFile: join(todoDir, "undo.json"),
  };
}

export class TodoStore {
  constructor(private readonly paths: TodoPaths = getTodoPaths()) {}

  async loadTasks(): Promise<Task[]> {
    return normalizeTasks(await this.readJson<unknown>(this.paths.tasksFile, []));
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    await this.writeJsonAtomically(this.paths.tasksFile, tasks);
  }

  async loadConfig(): Promise<TodoConfig> {
    const saved = await this.readJson<Partial<TodoConfig>>(this.paths.configFile, {});
    return { ...DEFAULT_CONFIG, ...saved, schemaVersion: 1, undoTimeout: DEFAULT_CONFIG.undoTimeout };
  }

  async saveConfig(config: TodoConfig): Promise<void> {
    await this.writeJsonAtomically(this.paths.configFile, config);
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

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
