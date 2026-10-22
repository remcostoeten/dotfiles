import type { RemovedTask, Task, TaskId } from "./task";
import { tryParseDueDate } from "./due-date";
import { UserInputError } from "./user-input-error";
import { restoreTasks } from "../plugins/undo";

export type ArchiveKind = "removed" | "done";

export interface ArchiveEntry {
  kind: ArchiveKind;
  /** `r<n>` for removed tasks, `#<id>` for completed ones. */
  ref: string;
  /** When the task was removed or last touched as completed. */
  at: number;
  task: Task;
}

export interface ArchiveFilter {
  kind?: ArchiveKind | undefined;
  query?: string;
  since?: number;
  until?: number;
}

/** Completed and removed tasks, newest first. */
export function buildArchiveEntries(tasks: Task[], removed: RemovedTask[]): ArchiveEntry[] {
  const done = tasks.filter((task) => task.status === "completed").map((task): ArchiveEntry => ({ kind: "done", ref: `#${task.id}`, at: task.updatedAt, task }));
  const gone = removed.map((entry): ArchiveEntry => ({ kind: "removed", ref: `r${entry.ref}`, at: entry.removedAt, task: entry.task }));
  return [...done, ...gone].sort((left, right) => right.at - left.at);
}

export function filterArchive(entries: ArchiveEntry[], filter: ArchiveFilter): ArchiveEntry[] {
  const needle = filter.query?.trim().toLowerCase() ?? "";
  return entries.filter((entry) =>
    (filter.kind === undefined || entry.kind === filter.kind)
    && (filter.since === undefined || entry.at >= filter.since)
    && (filter.until === undefined || entry.at <= filter.until)
    && (needle.length === 0 || entry.task.description.toLowerCase().includes(needle) || entry.ref === needle));
}

/** Accepts `7d`, `12h`, `2w` as "that long ago", otherwise any due-date expression (`yesterday`, `16/08/2026`). */
export function parseArchiveDate(value: string, now: Date = new Date()): number {
  const shorthand = value.trim().match(/^(\d+)([hdw])$/i);
  const timestamp = tryParseDueDate(shorthand ? `-${shorthand[1]}${shorthand[2]}` : value, now);
  if (timestamp === undefined) throw new UserInputError(`Invalid date: ${value}`);
  return timestamp;
}

export interface ArchiveArgs {
  filter: ArchiveFilter;
  interactive: boolean;
}

export function parseArchiveArgs(args: ReadonlyArray<string>, now: Date = new Date()): ArchiveArgs {
  const filter: ArchiveFilter = {};
  const words: string[] = [];
  let interactive = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--removed" || arg === "--deleted") filter.kind = "removed";
    else if (arg === "--done" || arg === "--completed") filter.kind = "done";
    else if (arg === "-i" || arg === "--interactive") interactive = true;
    else if (arg === "--since" || arg === "--until") {
      const value = args[index + 1];
      if (value === undefined) throw new UserInputError(`Missing value for ${arg}`);
      filter[arg === "--since" ? "since" : "until"] = parseArchiveDate(value, now);
      index += 1;
    } else if (arg.startsWith("--")) throw new UserInputError(`Unknown option: ${arg}`);
    else words.push(arg);
  }
  if (words.length > 0) filter.query = words.join(" ");
  return { filter, interactive };
}

export interface RestoreResult {
  tasks: Task[];
  removed: RemovedTask[];
  restored: Task[];
}

/**
 * Brings archive entries back as pending tasks. Removed tasks are recreated with fresh IDs; completed
 * ones are reopened in place. `parentId` re-assigns every restored root under that task (`null` = top level).
 */
export function restoreArchiveEntries(tasks: Task[], removed: RemovedTask[], refs: ReadonlyArray<string>, parentId?: TaskId | null, now = Date.now()): RestoreResult {
  if (typeof parentId === "string" && !tasks.some((task) => task.id === parentId && task.status === "pending")) {
    throw new UserInputError(`Parent task not found: ${parentId}`);
  }

  const removedRefs = new Set<number>();
  const doneIds = new Set<TaskId>();
  for (const raw of refs) {
    const ref = raw.trim().toLowerCase();
    const removedMatch = ref.match(/^r(\d+)$/);
    if (removedMatch) removedRefs.add(Number(removedMatch[1]));
    else if (/^#?\d+$/.test(ref)) doneIds.add(ref.replace(/^#/, ""));
    else throw new UserInputError(`Invalid archive reference: ${raw} (use r3 for removed, #12 for completed)`);
  }

  const picked = removed.filter((entry) => removedRefs.has(entry.ref));
  const missingRemoved = [...removedRefs].filter((ref) => !picked.some((entry) => entry.ref === ref));
  const reopened = tasks.filter((task) => doneIds.has(task.id) && task.status === "completed");
  const missingDone = [...doneIds].filter((id) => !reopened.some((task) => task.id === id));
  const missing = [...missingRemoved.map((ref) => `r${ref}`), ...missingDone.map((id) => `#${id}`)];
  if (missing.length > 0) throw new UserInputError(`Not in archive: ${missing.join(", ")}`);

  const recreated = restoreTasks(tasks, picked.map((entry) => entry.task));
  const recreatedIds = new Set(recreated.map((task) => task.id));
  for (const task of recreated) {
    task.status = "pending";
    if (parentId !== undefined && (task.parentId === undefined || !recreatedIds.has(task.parentId))) assignParent(task, parentId);
  }
  for (const task of reopened) {
    task.status = "pending";
    task.updatedAt = now;
    if (parentId !== undefined && parentId !== task.id) assignParent(task, parentId);
  }

  return {
    tasks: [...tasks, ...recreated],
    removed: removed.filter((entry) => !removedRefs.has(entry.ref)),
    restored: [...recreated, ...reopened],
  };
}

function assignParent(task: Task, parentId: TaskId | null): void {
  if (parentId === null) delete task.parentId;
  else task.parentId = parentId;
}
