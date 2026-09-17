import type { Task, TaskId } from "./task";
import { UserInputError } from "./user-input-error";

export interface TaskTreeRow {
  task: Task;
  depth: number;
  /** One entry per ancestor level plus the row itself; true when a later sibling follows at that level. */
  siblingFollows: boolean[];
  /** Whether any visible child sits under this row, collapsed or not. */
  hasChildren: boolean;
  /** Direct visible children of this row, collapsed or not. */
  childCount: number;
  collapsed: boolean;
  progress: TaskProgress;
}

export interface TaskProgress {
  total: number;
  completed: number;
}

export interface TaskTreeOptions {
  compare?: (left: Task, right: Task) => number;
  collapsedIds?: ReadonlySet<TaskId>;
}

/**
 * Lays out `visibleTasks` as an indented tree. A task whose parent is not visible becomes a root,
 * so filtered views still show their matches instead of hiding them under an absent parent.
 * `allTasks` is only used for progress counts.
 */
export function buildTaskTreeRows(visibleTasks: Task[], allTasks: Task[], options: TaskTreeOptions = {}): TaskTreeRow[] {
  const compare = options.compare ?? (() => 0);
  const collapsedIds = options.collapsedIds ?? new Set<TaskId>();
  const visibleIds = new Set(visibleTasks.map((task) => task.id));
  const childrenByParent = new Map<TaskId | undefined, Task[]>();

  for (const task of visibleTasks) {
    const parentKey = task.parentId !== undefined && visibleIds.has(task.parentId) && task.parentId !== task.id ? task.parentId : undefined;
    const siblings = childrenByParent.get(parentKey) ?? [];
    siblings.push(task);
    childrenByParent.set(parentKey, siblings);
  }
  for (const siblings of childrenByParent.values()) siblings.sort(compare);

  const rows: TaskTreeRow[] = [];
  const visited = new Set<TaskId>();
  const visit = (parentKey: TaskId | undefined, depth: number, trail: boolean[]): void => {
    const siblings = childrenByParent.get(parentKey) ?? [];
    siblings.forEach((task, index) => {
      if (visited.has(task.id)) return;
      visited.add(task.id);
      const siblingFollows = [...trail, index < siblings.length - 1];
      const children = childrenByParent.get(task.id) ?? [];
      const collapsed = collapsedIds.has(task.id);
      rows.push({
        task,
        depth,
        siblingFollows,
        hasChildren: children.length > 0,
        childCount: children.length,
        collapsed,
        progress: getTaskProgress(allTasks, task.id),
      });
      if (!collapsed) visit(task.id, depth + 1, siblingFollows);
    });
  };
  visit(undefined, 0, []);
  return rows;
}

/** Every descendant of the given roots, not including the roots themselves. */
export function collectDescendantIds(tasks: Task[], rootIds: Iterable<TaskId>): Set<TaskId> {
  const childrenByParent = new Map<TaskId, TaskId[]>();
  for (const task of tasks) {
    if (task.parentId === undefined) continue;
    const children = childrenByParent.get(task.parentId) ?? [];
    children.push(task.id);
    childrenByParent.set(task.parentId, children);
  }

  const descendants = new Set<TaskId>();
  const queue = [...rootIds];
  while (queue.length > 0) {
    const id = queue.pop()!;
    for (const childId of childrenByParent.get(id) ?? []) {
      if (descendants.has(childId)) continue;
      descendants.add(childId);
      queue.push(childId);
    }
  }
  for (const id of rootIds) descendants.delete(id);
  return descendants;
}

/** The given ids plus everything nested underneath them. */
export function collectSubtreeIds(tasks: Task[], rootIds: Iterable<TaskId>): Set<TaskId> {
  const roots = [...rootIds];
  return new Set([...roots, ...collectDescendantIds(tasks, roots)]);
}

/** Drops hidden tasks together with everything nested underneath them. */
export function excludeHiddenSubtrees(tasks: Task[]): Task[] {
  const hiddenIds = collectSubtreeIds(tasks, tasks.filter((task) => task.hidden === true).map((task) => task.id));
  return tasks.filter((task) => !hiddenIds.has(task.id));
}

/** Resolves `12`, `#12`, or an exact (case-insensitive) description of a pending task. */
export function findTaskByIdOrDescription(tasks: Task[], target: string): Task {
  const trimmed = target.trim();
  if (/^#?\d+$/.test(trimmed)) return findTask(tasks, trimmed.replace(/^#/, ""));
  const needle = trimmed.toLowerCase();
  const matches = tasks.filter((task) => task.status === "pending" && task.description.toLowerCase() === needle);
  const match = matches.find((task) => task.kind === "epic") ?? matches[0];
  if (match === undefined) throw new UserInputError(`Task not found: ${target}`);
  return match;
}

export function getTaskProgress(tasks: Task[], id: TaskId): TaskProgress {
  const descendantIds = collectDescendantIds(tasks, [id]);
  let completed = 0;
  for (const task of tasks) {
    if (descendantIds.has(task.id) && task.status === "completed") completed += 1;
  }
  return { total: descendantIds.size, completed };
}

export function isEpic(task: Task, tasks: Task[]): boolean {
  return task.kind === "epic" || countDescendants(tasks, task.id) > 0;
}

export function findTask(tasks: Task[], id: TaskId): Task {
  const task = tasks.find((candidate) => candidate.id === id);
  if (task === undefined) throw new UserInputError(`Task not found: ${id}`);
  return task;
}

/** Re-parents a task, rejecting moves that would create a cycle. `undefined` moves it to the top level. */
export function moveTask(tasks: Task[], id: TaskId, parentId: TaskId | undefined, now = Date.now()): Task {
  const task = findTask(tasks, id);
  if (parentId !== undefined) {
    findTask(tasks, parentId);
    if (parentId === id || collectDescendantIds(tasks, [id]).has(parentId)) {
      throw new UserInputError(`Cannot move #${id} under #${parentId}: it would nest inside itself`);
    }
    task.parentId = parentId;
  } else {
    delete task.parentId;
  }
  task.updatedAt = now;
  return task;
}

/** Marks the tasks and every descendant completed; returns how many actually changed. */
export function completeSubtrees(tasks: Task[], rootIds: Iterable<TaskId>, now = Date.now()): number {
  const ids = collectSubtreeIds(tasks, rootIds);
  let changed = 0;
  for (const task of tasks) {
    if (!ids.has(task.id) || task.status === "completed") continue;
    task.status = "completed";
    task.updatedAt = now;
    changed += 1;
  }
  return changed;
}

function countDescendants(tasks: Task[], id: TaskId): number {
  return collectDescendantIds(tasks, [id]).size;
}
