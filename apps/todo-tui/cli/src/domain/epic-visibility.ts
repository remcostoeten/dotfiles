import type { Task, TaskId } from "./task";
import { findTaskByIdOrDescription, isEpic } from "./task-tree";
import { UserInputError } from "./user-input-error";

export type VisibilityAction = "toggle" | "open" | "close";

export function listEpicIds(tasks: Task[]): TaskId[] {
  return tasks.filter((task) => isEpic(task, tasks)).map((task) => task.id);
}

/** Resolves an epic from `36`, `#36`, or an exact epic name, with epic-specific errors. */
export function resolveEpic(tasks: Task[], target: string): Task {
  const trimmed = target.trim();
  const numeric = /^#?\d+$/.test(trimmed);
  let task: Task;
  try {
    task = findTaskByIdOrDescription(tasks, trimmed);
  } catch (error: unknown) {
    if (!(error instanceof UserInputError)) throw error;
    throw new UserInputError(numeric ? `Epic #${trimmed.replace(/^#/, "")} not found` : `Epic not found: ${trimmed}`);
  }
  if (!isEpic(task, tasks)) throw new UserInputError(`Todo #${task.id} is not an epic.`);
  return task;
}

export function setEpicVisibility(collapsedIds: ReadonlySet<TaskId>, ids: Iterable<TaskId>, action: VisibilityAction): Set<TaskId> {
  const next = new Set(collapsedIds);
  for (const id of ids) {
    if (action === "close") next.add(id);
    else if (action === "open") next.delete(id);
    else if (next.has(id)) next.delete(id);
    else next.add(id);
  }
  return next;
}

/** Drops persisted ids whose epic no longer exists, so deleted epics cannot leak into later writes. */
export function pruneCollapsedIds(collapsedIds: Iterable<TaskId>, tasks: Task[]): Set<TaskId> {
  const epicIds = new Set(listEpicIds(tasks));
  return new Set([...collapsedIds].filter((id) => epicIds.has(id)));
}
