import { emitKeypressEvents } from "node:readline";
import type { Task } from "../domain/task";
import { buildTaskTreeRows, collectDescendantIds, collectSubtreeIds, completeSubtrees, moveTask, type TaskTreeRow } from "../domain/task-tree";
import { UserInputError } from "../domain/user-input-error";
import { formatProgressBadge, formatTreePrefix, getVisibleLength, isOverdue, isUpcoming } from "../presentation/task-format";
import { createTasks, type CreateTaskDefaults } from "./add";
import { resetNotificationState } from "../notifications";
import { tryParseDueDate } from "../domain/due-date";
import { restoreTasks } from "./undo";
import type { TodoPlugin } from "./types";

const DIM = "\u001B[2m";
const RESET = "\u001B[0m";
const BRIGHT = "\u001B[1m";
const MAUVE = "\u001B[38;5;147m";
const GREEN = "\u001B[38;5;166m";
const RED = "\u001B[38;5;203m";
const BLUE = "\u001B[38;5;116m";
const SELECTED = "\u001B[48;5;60m";
const PANEL_WIDTH = 72;
const VISIBLE_TASK_COUNT = 8;

type Mode = "normal" | "adding" | "adding-subtask" | "adding-epic" | "editing" | "snoozing" | "setting-due" | "searching" | "confirming-delete" | "help";
const ADD_MODES: ReadonlySet<Mode> = new Set(["adding", "adding-subtask", "adding-epic"]);
type TaskView = "pending" | "archive";
type Focus = "workspaces" | "tasks";

interface Workspace {
  key: "all" | "today" | "overdue" | "high" | "archive";
  label: string;
}

const WORKSPACES: Workspace[] = [
  { key: "all", label: "all tasks" },
  { key: "today", label: "today" },
  { key: "overdue", label: "overdue" },
  { key: "high", label: "high priority" },
  { key: "archive", label: "archive" },
];

interface Key {
  ctrl?: boolean;
  name?: string;
  sequence?: string;
}

export const interactivePlugin: TodoPlugin = {
  name: "interactive",
  description: "Open the keyboard-controlled taskboard.",
  register(app) {
    app.command("interactive", "Open the keyboard-driven taskboard.", async ({ store }) => {
      const taskboard = new Taskboard(store);
      await taskboard.start();
    }, {
      group: "View",
      aliases: ["i", "-i", "--interactive"],
      usage: ["todo interactive", "todo i", "todo -i", "todo --interactive", "todo"],
      details: ["Opens automatically when todo runs with no arguments in a terminal. Press ? inside for the key map."],
    });
  },
};

class Taskboard {
  private tasks: Task[] = [];
  private rows: TaskTreeRow[] = [];
  private sourceTasks: Task[] = [];
  private allTasks: Task[] = [];
  private collapsedIds = new Set<string>();
  private selectedIndex = 0;
  private scrollOffset = 0;
  private mode: Mode = "normal";
  private view: TaskView = "pending";
  private focus: Focus = "tasks";
  private workspaceIndex = 0;
  private draft = "";
  private searchQuery = "";
  private selectedTaskIds = new Set<string>();
  private message = "";
  private resolveClose: (() => void) | undefined;
  private wasRaw = false;

  constructor(private readonly store: Parameters<typeof createTasks>[0]) {}

  async start(): Promise<void> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      await this.refresh();
      process.stdout.write(this.render());
      return;
    }

    await this.refresh();
    this.wasRaw = process.stdin.isRaw;
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("keypress", this.handleKeypress);
    process.stdout.write("\u001B[?25l");
    this.draw();

    await new Promise<void>((resolve) => {
      this.resolveClose = resolve;
    });
  }

  private handleKeypress = (_: string, key: Key): void => {
    void this.processKeypress(key).catch((error: unknown) => {
      this.message = error instanceof Error ? error.message : String(error);
      this.mode = "normal";
      this.draw();
    });
  };

  private async processKeypress(key: Key): Promise<void> {
    if (key.ctrl && key.name === "c") {
      this.close();
      return;
    }

    if (ADD_MODES.has(this.mode) || this.mode === "editing" || this.mode === "snoozing" || this.mode === "setting-due") {
      await this.processAddKeypress(key);
      return;
    }

    if (this.mode === "searching") {
      this.processSearchKeypress(key);
      return;
    }

    if (this.mode === "confirming-delete") {
      await this.processDeleteKeypress(key);
      return;
    }

    if (this.mode === "help") {
      if (key.name === "escape" || key.name === "return" || key.sequence === "?" || key.name === "q") {
        this.mode = "normal";
        this.draw();
      }
      return;
    }

    if (key.name === "tab") {
      this.focus = this.focus === "workspaces" ? "tasks" : "workspaces";
      this.draw();
      return;
    }

    if (this.focus === "workspaces") {
      if (key.name === "up" || key.sequence === "k") await this.moveWorkspace(-1);
      else if (key.name === "down" || key.sequence === "j") await this.moveWorkspace(1);
      else if (key.name === "return" || key.name === "space") this.focus = "tasks";
      else if (key.sequence === "q" || key.name === "escape") this.close();
      this.draw();
      return;
    }

    if (key.name === "up" || key.sequence === "k") {
      this.moveSelection(-1);
    } else if (key.name === "down" || key.sequence === "j") {
      this.moveSelection(1);
    } else if (key.name === "return" || key.name === "space") {
      await this.completeSelectedTask();
    } else if (key.sequence === "a") {
      this.startAdding("adding");
    } else if (key.sequence === "A") {
      if (this.selectedTask !== undefined && this.view === "pending") this.startAdding("adding-subtask");
    } else if (key.sequence === "E") {
      this.startAdding("adding-epic");
    } else if (key.name === "left" || key.sequence === "h") {
      this.collapseOrAscend();
    } else if (key.name === "right" || key.sequence === "l") {
      this.expandOrDescend();
    } else if (key.sequence === ">") {
      await this.indentSelectedTask();
    } else if (key.sequence === "<") {
      await this.outdentSelectedTask();
    } else if (key.sequence === "d") {
      if (this.selectedTask !== undefined) this.mode = "confirming-delete";
    } else if (key.sequence === "e") {
      this.editSelectedTask();
    } else if (key.sequence === "s") {
      this.snoozeSelectedTask();
    } else if (key.sequence === "u" || (key.ctrl === true && key.name === "z")) {
      await this.undoDelete();
    } else if (key.sequence === "p") {
      await this.cyclePriority();
    } else if (key.sequence === "t") {
      this.setDueDate();
    } else if (key.sequence === "x") {
      this.toggleTaskSelection();
    } else if (key.sequence === "c") {
      await this.completeSelectedTasks();
    } else if (key.sequence === "/") {
      this.mode = "searching";
      this.searchQuery = "";
      this.message = "";
    } else if (key.sequence === "v") {
      await this.toggleView();
    } else if (key.sequence === "r") {
      await this.refresh();
      this.message = "Refreshed";
    } else if (key.sequence === "?") {
      this.mode = "help";
    } else if (key.sequence === "q" || key.name === "escape") {
      this.close();
      return;
    }
    this.draw();
  }

  private async processAddKeypress(key: Key): Promise<void> {
    if (key.name === "escape") {
      this.mode = "normal";
      this.draft = "";
    } else if (key.name === "backspace") {
      this.draft = this.draft.slice(0, -1);
    } else if (key.name === "return") {
      if (ADD_MODES.has(this.mode)) await this.addDraft();
      else if (this.mode === "editing") await this.saveEditedTask();
      else if (this.mode === "snoozing") await this.saveSnoozedTask();
      else await this.saveDueDate();
    } else if (key.sequence !== undefined && key.sequence >= " ") {
      this.draft += key.sequence;
    }
    this.draw();
  }

  private processSearchKeypress(key: Key): void {
    if (key.name === "escape") {
      this.mode = "normal";
      this.searchQuery = "";
      this.applySearch();
    } else if (key.name === "backspace") {
      this.searchQuery = this.searchQuery.slice(0, -1);
      this.applySearch();
    } else if (key.name === "return") {
      this.mode = "normal";
    } else if (key.sequence !== undefined && key.sequence >= " ") {
      this.searchQuery += key.sequence;
      this.applySearch();
    }
    this.draw();
  }

  private startAdding(mode: "adding" | "adding-subtask" | "adding-epic"): void {
    this.mode = mode;
    this.draft = "";
    this.message = "";
  }

  private collapseOrAscend(): void {
    const row = this.selectedRow;
    if (row === undefined) return;
    if (row.hasChildren && !row.collapsed) {
      this.collapsedIds.add(row.task.id);
      this.rebuildRows(row.task.id);
      return;
    }
    const parentIndex = this.rows.findIndex((candidate) => candidate.task.id === row.task.parentId);
    if (parentIndex !== -1) {
      this.selectedIndex = parentIndex;
      this.ensureSelectedTaskIsVisible();
    }
  }

  private expandOrDescend(): void {
    const row = this.selectedRow;
    if (row === undefined || !row.hasChildren) return;
    if (row.collapsed) {
      this.collapsedIds.delete(row.task.id);
      this.rebuildRows(row.task.id);
      return;
    }
    this.moveSelection(1);
  }

  private async indentSelectedTask(): Promise<void> {
    const row = this.selectedRow;
    if (row === undefined || this.view === "archive") return;
    let target: Task | undefined;
    for (let index = this.selectedIndex - 1; index >= 0; index -= 1) {
      const candidate = this.rows[index];
      if (candidate === undefined || candidate.depth < row.depth) break;
      if (candidate.depth === row.depth) {
        target = candidate.task;
        break;
      }
    }
    if (target === undefined) {
      this.message = "No task above to nest under";
      return;
    }
    await this.reparent(row.task.id, target.id);
  }

  private async outdentSelectedTask(): Promise<void> {
    const row = this.selectedRow;
    if (row === undefined || this.view === "archive") return;
    if (row.task.parentId === undefined) {
      this.message = "Already at the top level";
      return;
    }
    const parent = this.allTasks.find((candidate) => candidate.id === row.task.parentId);
    await this.reparent(row.task.id, parent?.parentId);
  }

  private async reparent(id: string, parentId: string | undefined): Promise<void> {
    const tasks = await this.store.loadTasks();
    moveTask(tasks, id, parentId);
    await this.store.saveTasks(tasks);
    if (parentId !== undefined) this.collapsedIds.delete(parentId);
    this.message = parentId === undefined ? `Moved #${id} to the top level` : `Moved #${id} under #${parentId}`;
    await this.refresh(id);
  }

  private editSelectedTask(): void {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined) return;
    this.mode = "editing";
    this.draft = selectedTask.description;
    this.message = "";
  }

  private async saveEditedTask(): Promise<void> {
    const description = this.draft.trim();
    const selectedTask = this.selectedTask;
    if (description.length === 0) {
      this.message = "Enter a task description";
      return;
    }
    if (selectedTask === undefined) return;

    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined) return;

    task.description = description;
    task.updatedAt = Date.now();
    await this.store.saveTasks(tasks);
    this.mode = "normal";
    this.draft = "";
    this.message = `Updated #${task.id}`;
    await this.refresh(task.id);
  }

  private snoozeSelectedTask(): void {
    if (this.selectedTask === undefined || this.view === "archive") return;
    this.mode = "snoozing";
    this.draft = "";
    this.message = "";
  }

  private async saveSnoozedTask(): Promise<void> {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined) return;
    const dueDate = tryParseDueDate(this.draft);
    if (dueDate === undefined) {
      this.message = "Use 30m, 1h, tomorrow, monday, next week, or 16/08/2026";
      return;
    }

    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined) return;

    if (dueDate === undefined) delete task.dueDate;
    else task.dueDate = dueDate;
    task.updatedAt = Date.now();
    resetNotificationState(task);
    await this.store.saveTasks(tasks);
    this.mode = "normal";
    this.draft = "";
    this.message = `Snoozed #${task.id}`;
    await this.refresh(task.id);
  }

  private setDueDate(): void {
    if (this.selectedTask === undefined || this.view === "archive") return;
    this.mode = "setting-due";
    this.draft = "";
    this.message = "";
  }

  private async saveDueDate(): Promise<void> {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined) return;
    const value = this.draft.trim().toLowerCase();
    const dueDate = value === "0" || value === "none" ? undefined : tryParseDueDate(value);
    if (value.length === 0 || (dueDate === undefined && value !== "0" && value !== "none")) {
      this.message = "Use 30m, 1h, tomorrow, 16/08/2026, two weeks ago, or none";
      return;
    }

    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined) return;

    if (dueDate === undefined) delete task.dueDate;
    else task.dueDate = dueDate;
    task.updatedAt = Date.now();
    resetNotificationState(task);
    await this.store.saveTasks(tasks);
    this.mode = "normal";
    this.draft = "";
    this.message = dueDate === undefined ? `Cleared due date for #${task.id}` : `Updated due date for #${task.id}`;
    await this.refresh(task.id);
  }

  private async cyclePriority(): Promise<void> {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined || this.view === "archive") return;
    const priorities: Task["priority"][] = ["none", "low", "medium", "high"];
    const priority = priorities[(priorities.indexOf(selectedTask.priority) + 1) % priorities.length];
    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined || priority === undefined) return;
    task.priority = priority;
    task.updatedAt = Date.now();
    await this.store.saveTasks(tasks);
    this.message = `Priority #${task.id}: ${priority}`;
    await this.refresh(task.id);
  }

  private toggleTaskSelection(): void {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined || this.view === "archive") return;
    if (this.selectedTaskIds.has(selectedTask.id)) this.selectedTaskIds.delete(selectedTask.id);
    else this.selectedTaskIds.add(selectedTask.id);
    this.message = `${this.selectedTaskIds.size} selected`;
  }

  private async completeSelectedTasks(): Promise<void> {
    if (this.view === "archive") return;
    const selectedTask = this.selectedTask;
    const ids = this.selectedTaskIds.size > 0 ? this.selectedTaskIds : new Set(selectedTask === undefined ? [] : [selectedTask.id]);
    if (ids.size === 0) return;
    const tasks = await this.store.loadTasks();
    const completed = completeSubtrees(tasks, ids);
    await this.store.saveTasks(tasks);
    this.selectedTaskIds.clear();
    this.message = `Completed ${completed} task${completed === 1 ? "" : "s"}`;
    await this.refresh();
  }

  private async undoDelete(): Promise<void> {
    const undo = await this.store.loadUndo();
    if (undo === undefined || undo.tasks.length === 0) {
      this.message = "Nothing to undo";
      return;
    }

    const tasks = await this.store.loadTasks();
    const restoredTasks = restoreTasks(tasks, undo.tasks);
    await this.store.saveTasks([...tasks, ...restoredTasks]);
    await this.store.clearUndo();
    this.message = `Restored ${restoredTasks.length} task${restoredTasks.length === 1 ? "" : "s"}`;
    await this.refresh(restoredTasks[0]?.id);
  }

  private async processDeleteKeypress(key: Key): Promise<void> {
    if (key.sequence?.toLowerCase() === "y") {
      await this.deleteSelectedTask();
    } else if (key.sequence?.toLowerCase() === "n" || key.name === "escape") {
      this.mode = "normal";
      this.message = "Delete cancelled";
    }
    this.draw();
  }

  private async addDraft(): Promise<void> {
    const input = this.draft.trim();
    if (input.length === 0) {
      this.message = "Enter a task description";
      return;
    }

    try {
      const defaults = this.addDefaults();
      const addedTasks = await createTasks(this.store, input.split(/\s+/), defaults);
      this.mode = "normal";
      this.draft = "";
      if (defaults.parentId !== undefined) this.collapsedIds.delete(defaults.parentId);
      const noun = defaults.kind === "epic" ? "epic" : defaults.parentId === undefined ? "task" : "subtask";
      this.message = `Added ${addedTasks.length} ${noun}${addedTasks.length === 1 ? "" : "s"}`;
      await this.refresh(addedTasks[0]?.id);
    } catch (error: unknown) {
      this.message = error instanceof UserInputError ? error.message : "Could not add task";
    }
  }

  private addDefaults(): CreateTaskDefaults {
    if (this.mode === "adding-epic") return { kind: "epic" };
    if (this.mode === "adding-subtask" && this.selectedTask !== undefined) return { parentId: this.selectedTask.id };
    return {};
  }

  private async completeSelectedTask(): Promise<void> {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined) return;

    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined) return;

    if (this.view === "archive") {
      task.status = "pending";
      task.updatedAt = Date.now();
      this.message = `Restored #${task.id}`;
    } else {
      const completed = completeSubtrees(tasks, [task.id]);
      this.message = completed > 1 ? `Completed #${task.id} and ${completed - 1} subtask${completed === 2 ? "" : "s"}` : `Completed #${task.id}`;
    }
    await this.store.saveTasks(tasks);
    await this.refresh();
  }

  private async deleteSelectedTask(): Promise<void> {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined) return;

    const tasks = await this.store.loadTasks();
    const subtreeIds = collectSubtreeIds(tasks, [selectedTask.id]);
    await this.store.saveUndo(tasks.filter((task) => subtreeIds.has(task.id)));
    await this.store.saveTasks(tasks.filter((task) => !subtreeIds.has(task.id)));
    this.mode = "normal";
    const subtaskText = subtreeIds.size > 1 ? ` and ${subtreeIds.size - 1} subtask${subtreeIds.size === 2 ? "" : "s"}` : "";
    this.message = `Deleted #${selectedTask.id}${subtaskText} · u/Ctrl+Z to undo (5s)`;
    await this.refresh();
  }

  private subtaskCountOf(id: string): number {
    return collectDescendantIds(this.allTasks, [id]).size;
  }

  private async refresh(selectedId?: string): Promise<void> {
    this.allTasks = await this.store.loadTasks();
    this.sourceTasks = filterWorkspaceTasks(this.allTasks, this.workspace.key);
    this.applySearch();
    if (selectedId !== undefined) this.selectRow(selectedId);
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.rows.length - 1));
    this.scrollOffset = Math.min(this.scrollOffset, Math.max(0, this.rows.length - VISIBLE_TASK_COUNT));
    this.ensureSelectedTaskIsVisible();
  }

  private applySearch(): void {
    const query = this.searchQuery.trim().toLowerCase();
    this.tasks = query.length === 0 ? [...this.sourceTasks] : this.sourceTasks.filter((task) => task.description.toLowerCase().includes(query));
    this.rebuildRows();
  }

  private rebuildRows(selectedId?: string): void {
    this.rows = buildTaskTreeRows(this.tasks, this.allTasks, { compare: compareTasks, collapsedIds: this.collapsedIds });
    if (selectedId !== undefined) this.selectRow(selectedId);
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.rows.length - 1));
    this.ensureSelectedTaskIsVisible();
  }

  private selectRow(id: string): void {
    const matchingIndex = this.rows.findIndex((row) => row.task.id === id);
    if (matchingIndex !== -1) this.selectedIndex = matchingIndex;
  }

  private async toggleView(): Promise<void> {
    const wasArchive = this.workspace.key === "archive";
    this.workspaceIndex = wasArchive ? 0 : WORKSPACES.findIndex((workspace) => workspace.key === "archive");
    this.view = wasArchive ? "pending" : "archive";
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.message = this.view === "archive" ? "Archive" : "Open tasks";
    await this.refresh();
  }

  private moveSelection(offset: number): void {
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex + offset, this.rows.length - 1));
    this.ensureSelectedTaskIsVisible();
  }

  private async moveWorkspace(offset: number): Promise<void> {
    const workspace = WORKSPACES.length;
    this.workspaceIndex = (this.workspaceIndex + offset + workspace) % workspace;
    this.view = this.workspace.key === "archive" ? "archive" : "pending";
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.selectedTaskIds.clear();
    await this.refresh();
  }

  private get workspace(): Workspace {
    return WORKSPACES[this.workspaceIndex] ?? WORKSPACES[0]!;
  }

  private ensureSelectedTaskIsVisible(): void {
    if (this.selectedIndex < this.scrollOffset) this.scrollOffset = this.selectedIndex;
    if (this.selectedIndex >= this.scrollOffset + VISIBLE_TASK_COUNT) {
      this.scrollOffset = this.selectedIndex - VISIBLE_TASK_COUNT + 1;
    }
  }

  private get selectedRow(): TaskTreeRow | undefined {
    return this.rows[this.selectedIndex];
  }

  private get selectedTask(): Task | undefined {
    return this.selectedRow?.task;
  }

  private draw(): void {
    process.stdout.write(`\u001B[2J\u001B[H${this.render()}`);
  }

  private render(): string {
    if ((process.stdout.columns ?? 0) >= 100) return this.renderWorkspaceLayout();

    const lines = this.mode === "help" ? this.helpLines() : this.taskLines();
    const output = [formatPanelBorder("╭", "╮")];
    const status = this.view === "pending" ? `${this.tasks.length} open` : `${this.tasks.length} done`;
    const dueTodayCount = this.tasks.filter((task) => task.dueDate !== undefined && isToday(task.dueDate)).length;
    const dueToday = this.view === "pending" && dueTodayCount > 0 ? `${DIM} · ${dueTodayCount} due today${RESET}` : "";
    const title = this.view === "archive" ? `${BRIGHT}${MAUVE}todo${RESET} ${DIM}· archive${RESET}` : `${BRIGHT}${MAUVE}todo${RESET}`;
    output.push(formatPanelLine(title, `${GREEN}● ${status}${RESET}${dueToday}`));
    output.push(formatPanelBorder("├", "┤"));
    for (const line of lines) output.push(formatPanelLine(line));
    output.push(formatPanelBorder("├", "┤"));
    output.push(formatPanelLine(this.footerLeft, this.footerRight));
    output.push(formatPanelBorder("╰", "╯"));
    return `${output.join("\n")}\n`;
  }

  private renderWorkspaceLayout(): string {
    const width = Math.min(Math.max(process.stdout.columns ?? 110, 100), 140);
    const sidebarWidth = 22;
    const taskWidth = width - sidebarWidth - 7;
    const bodyHeight = Math.max(12, Math.min((process.stdout.rows ?? 24) - 6, 22));
    const workspaceLines = this.workspaceLines(sidebarWidth);
    const taskLines = this.workspaceTaskLines(taskWidth);
    const output = [formatSplitBorder("╭", "┬", "╮", sidebarWidth, taskWidth, "Workspaces", this.view === "archive" ? "Archive" : "Todos")];

    for (let index = 0; index < bodyHeight; index += 1) {
      const left = workspaceLines[index] ?? "";
      const right = taskLines[index] ?? "";
      output.push(formatSplitLine(left, right, sidebarWidth, taskWidth));
    }

    output.push(formatSplitBorder("├", "┴", "┤", sidebarWidth, taskWidth));
    output.push(formatStatusLine(this.footerLeft, this.footerRight, width - 2));
    output.push(`${DIM}╰${"─".repeat(width - 2)}╯${RESET}`);
    return `${output.join("\n")}\n`;
  }

  private workspaceLines(width: number): string[] {
    return WORKSPACES.map((workspace, index) => {
      const count = filterWorkspaceTasks(this.allTasks, workspace.key).length;
      const selected = this.focus === "workspaces" && index === this.workspaceIndex;
      const marker = index === this.workspaceIndex ? `${GREEN}›${RESET}` : " ";
      const content = `${marker} ${workspace.label} ${DIM}(${count})${RESET}`;
      return selected ? `${SELECTED}${fit(content, width)}${RESET}` : content;
    });
  }

  private workspaceTaskLines(width: number): string[] {
    if (this.mode === "help") return this.helpLines();
    if (ADD_MODES.has(this.mode)) return this.addPromptLines();
    if (this.mode === "editing") return [`${GREEN}edit #${this.selectedTask?.id ?? ""}${RESET}`, `${DIM}>${RESET} ${this.draft}${BRIGHT}▏${RESET}`, `${DIM}Enter to save · Esc to cancel${RESET}`];
    if (this.mode === "snoozing") return [`${GREEN}snooze #${this.selectedTask?.id ?? ""}${RESET}`, `${DIM}>${RESET} ${this.draft}${BRIGHT}▏${RESET}`, `${DIM}30m · 1h · tomorrow · monday · next week${RESET}`];
    if (this.mode === "setting-due") return [`${GREEN}due date #${this.selectedTask?.id ?? ""}${RESET}`, `${DIM}>${RESET} ${this.draft}${BRIGHT}▏${RESET}`, `${DIM}30m · 1h · tomorrow · monday · next week · none${RESET}`];
    if (this.mode === "searching") return [`${GREEN}search${RESET}`, `${DIM}/${RESET} ${this.searchQuery}${BRIGHT}▏${RESET}`, `${DIM}Enter to keep filter · Esc to clear${RESET}`];
    if (this.mode === "confirming-delete") return this.deletePromptLines();
    if (this.rows.length === 0) return [`${GREEN}✓ All caught up${RESET}`, `${DIM}Press a to add a task · E for an epic${RESET}`];

    const header = `${DIM}PRI  ID    TITLE${" ".repeat(Math.max(1, width - 53))}CREATED       UPDATED       DUE${RESET}`;
    const rows = this.rows.slice(this.scrollOffset, this.scrollOffset + VISIBLE_TASK_COUNT).map((row, index) => {
      const selected = this.scrollOffset + index === this.selectedIndex;
      const marked = this.selectedTaskIds.has(row.task.id);
      const marker = selected ? `${GREEN}›${RESET}` : marked ? `${GREEN}✓${RESET}` : `${DIM}·${RESET}`;
      const content = `${marker} ${formatWorkspaceTask(row, width - 2)}`;
      return selected && this.focus === "tasks" ? highlight(fit(content, width)) : content;
    });
    return [header, ...rows];
  }

  private taskLines(): string[] {
    if (ADD_MODES.has(this.mode)) return this.addPromptLines();
    if (this.mode === "editing") return [`${GREEN}edit #${this.selectedTask?.id ?? ""}${RESET}`, `${DIM}>${RESET} ${this.draft}${BRIGHT}▏${RESET}`, `${DIM}Enter to save · Esc to cancel${RESET}`];
    if (this.mode === "snoozing") return [`${GREEN}snooze #${this.selectedTask?.id ?? ""}${RESET}`, `${DIM}>${RESET} ${this.draft}${BRIGHT}▏${RESET}`, `${DIM}30m · 1h · tomorrow · monday · next week${RESET}`];
    if (this.mode === "setting-due") return [`${GREEN}due date #${this.selectedTask?.id ?? ""}${RESET}`, `${DIM}>${RESET} ${this.draft}${BRIGHT}▏${RESET}`, `${DIM}30m · 1h · tomorrow · monday · next week · none${RESET}`];
    if (this.mode === "searching") return [`${GREEN}search${RESET}`, `${DIM}/${RESET} ${this.searchQuery}${BRIGHT}▏${RESET}`, `${DIM}Enter to keep filter · Esc to clear${RESET}`];
    if (this.mode === "confirming-delete") return this.deletePromptLines();
    if (this.rows.length === 0) {
      const emptyAction = this.view === "pending" ? "Press a to add a task · E for an epic" : "Press v to return to open tasks";
      return [`${GREEN}✓ All caught up${RESET}`, `${DIM}${emptyAction}${RESET}`];
    }

    const header = formatCompactHeader(PANEL_WIDTH - 3);
    const visibleRows = this.rows.slice(this.scrollOffset, this.scrollOffset + VISIBLE_TASK_COUNT);
    const rows = visibleRows.map((row, index) => {
      const selected = this.scrollOffset + index === this.selectedIndex;
      const marked = this.selectedTaskIds.has(row.task.id);
      const marker = selected ? `${GREEN}›${RESET}` : marked ? `${GREEN}✓${RESET}` : `${DIM}·${RESET}`;
      const content = `${marker} ${formatCompactTask(row, PANEL_WIDTH - 3)}`;
      return selected ? highlight(fit(content, PANEL_WIDTH - 1)) : content;
    });
    return [header, ...rows];
  }

  private addPromptLines(): string[] {
    const title = this.mode === "adding-epic" ? "new epic" : this.mode === "adding-subtask" ? `new subtask under #${this.selectedTask?.id ?? ""}` : "new task";
    return [`${GREEN}${title}${RESET}`, `${DIM}>${RESET} ${this.draft}${BRIGHT}▏${RESET}`, `${DIM}Enter to save · comma separates several · Esc to cancel${RESET}`];
  }

  private deletePromptLines(): string[] {
    const id = this.selectedTask?.id ?? "";
    const subtaskCount = id.length > 0 ? this.subtaskCountOf(id) : 0;
    const subtaskText = subtaskCount > 0 ? ` and ${subtaskCount} subtask${subtaskCount === 1 ? "" : "s"}` : "";
    return [`${RED}Delete #${id}${subtaskText}?${RESET}`, `${DIM}Press y to delete · n or Esc to cancel${RESET}`];
  }

  private helpLines(): string[] {
    return [
      `${GREEN}↑/k  ↓/j${RESET}  move selection`,
      `${GREEN}←/h  →/l${RESET}  collapse or expand · jump to parent/child`,
      `${GREEN}Enter${RESET}  complete selected task (and its subtasks)`,
      `${GREEN}a${RESET}  add task    ${GREEN}A${RESET}  add subtask under selected    ${GREEN}E${RESET}  add epic`,
      `${GREEN}>${RESET}  nest under the task above    ${GREEN}<${RESET}  move up one level`,
      `${GREEN}e${RESET}  edit selected task`,
      `${GREEN}d${RESET}  delete selected task and its subtasks`,
      `${GREEN}u / Ctrl+Z${RESET}  undo last deletion (within 5s)`,
      `${GREEN}s${RESET}  snooze selected task`,
      `${GREEN}p${RESET}  cycle priority`,
      `${GREEN}t${RESET}  set or clear due date`,
      `${GREEN}x${RESET}  mark task for batch completion`,
      `${GREEN}c${RESET}  complete marked task(s)`,
      `${GREEN}/${RESET}  search current view`,
      `${GREEN}v${RESET}  toggle completed archive`,
      `${GREEN}Enter${RESET}  restore selected task in archive`,
      `${GREEN}r${RESET}  refresh`,
      `${GREEN}q${RESET}  quit`,
      `${DIM}Press Esc, Enter, ? or q to return${RESET}`,
    ];
  }

  private get footerLeft(): string {
    if (this.mode === "help") return `${DIM}?${RESET} help`;
    const action = this.view === "pending" ? "complete" : "restore";
    const position = this.tasks.length > 0 ? `${this.selectedIndex + 1}/${this.tasks.length} · ` : "";
    return this.message.length > 0 ? `${GREEN}${this.message}${RESET}` : `${DIM}${position}↑↓${RESET} navigate · ${DIM}Enter${RESET} ${action}`;
  }

  private get footerRight(): string {
    if (this.mode === "help") return `${DIM}q${RESET} close`;
    return `${DIM}A${RESET} sub · ${DIM}E${RESET} epic · ${DIM}?${RESET} help · ${DIM}q${RESET} quit`;
  }

  private close(): void {
    process.stdin.off("keypress", this.handleKeypress);
    if (!this.wasRaw) process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write("\u001B[?25h\n");
    this.resolveClose?.();
  }
}

function compareTasks(left: Task, right: Task): number {
  if (left.dueDate !== undefined && right.dueDate !== undefined) return left.dueDate - right.dueDate;
  if (left.dueDate !== undefined) return -1;
  if (right.dueDate !== undefined) return 1;
  return left.createdAt - right.createdAt;
}

function formatPanelLine(left: string, right = ""): string {
  const padding = " ".repeat(Math.max(1, PANEL_WIDTH - getVisibleLength(left) - getVisibleLength(right)));
  return `${DIM}│${RESET} ${left}${padding}${right} ${DIM}│${RESET}`;
}

function formatPanelBorder(left: string, right: string): string {
  return `${DIM}${left}${"─".repeat(PANEL_WIDTH + 2)}${right}${RESET}`;
}

function filterWorkspaceTasks(tasks: Task[], workspace: Workspace["key"]): Task[] {
  if (workspace === "archive") return tasks.filter((task) => task.status === "completed");

  const pendingTasks = tasks.filter((task) => task.status === "pending");
  if (workspace === "today") return pendingTasks.filter((task) => task.dueDate !== undefined && isToday(task.dueDate));
  if (workspace === "overdue") return pendingTasks.filter((task) => task.dueDate !== undefined && isOverdue(task.dueDate));
  if (workspace === "high") return pendingTasks.filter((task) => task.priority === "high");
  return pendingTasks;
}

function isToday(timestamp: number): boolean {
  const now = new Date();
  const date = new Date(timestamp);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function formatTreeLabel(row: TaskTreeRow, width: number): string {
  const prefix = formatTreePrefix(row);
  const toggle = row.hasChildren ? (row.collapsed ? `${MAUVE}▸${RESET} ` : `${DIM}▾${RESET} `) : "";
  const badge = formatProgressBadge(row);
  const descriptionWidth = Math.max(8, width - getVisibleLength(prefix) - getVisibleLength(toggle) - getVisibleLength(badge));
  const description = truncateTaskDescription(row.task.description, descriptionWidth);
  const emphasized = row.hasChildren || row.task.kind === "epic" ? `${BRIGHT}${description}${RESET}` : description;
  return `${prefix}${toggle}${emphasized}${badge}`;
}

function formatWorkspaceTask(row: TaskTreeRow, width: number): string {
  const task = row.task;
  const priority = task.priority === "high" ? `${RED}high${RESET}` : task.priority === "medium" ? `${MAUVE}med${RESET}` : task.priority === "low" ? `${BLUE}low${RESET}` : `${DIM}—${RESET}`;
  const id = `${DIM}#${task.id.padStart(2, "0")}${RESET}`;
  const createdAt = formatTaskDate(task.createdAt);
  const updatedAt = formatTaskDate(task.updatedAt);
  const due = formatDueLabel(task);
  const metadataWidth = getVisibleLength(priority) + getVisibleLength(id) + getVisibleLength(createdAt) + getVisibleLength(updatedAt) + getVisibleLength(due) + 12;
  const descriptionWidth = Math.max(12, width - metadataWidth);
  const description = formatTreeLabel(row, descriptionWidth);
  const content = `${fit(priority, 4)} ${id}  ${description}`;
  const padding = " ".repeat(Math.max(1, width - getVisibleLength(content) - getVisibleLength(createdAt) - getVisibleLength(updatedAt) - getVisibleLength(due) - 6));
  return `${content}${padding}${createdAt}  ${updatedAt}  ${due}`;
}

function formatCompactTask(row: TaskTreeRow, width: number): string {
  const task = row.task;
  const id = `${DIM}#${task.id.padStart(2, "0")}${RESET}`;
  const updatedAt = `${DIM}${formatRelativeTime(task.updatedAt)}${RESET}`;
  const due = formatDueLabel(task);
  const fixedWidth = 4 + 2 + 9 + 2 + 12;
  const description = formatTreeLabel(row, Math.max(12, width - fixedWidth));
  return `${fit(id, 4)}  ${fit(description, Math.max(12, width - fixedWidth))}  ${fit(updatedAt, 9)}  ${fit(due, 12)}`;
}

function formatCompactHeader(width: number): string {
  const fixedWidth = 4 + 2 + 9 + 2 + 12;
  const descriptionWidth = Math.max(12, width - fixedWidth);
  return `${DIM}  ${fit("ID", 4)}  ${fit("TASK", descriptionWidth)}  ${fit("UPDATED", 9)}  ${fit("DUE", 12)}${RESET}`;
}

function formatDueLabel(task: Task): string {
  if (task.dueDate === undefined) return `${DIM}—${RESET}`;
  if (isOverdue(task.dueDate)) return `${RED}overdue${RESET}`;
  if (isUpcoming(task.dueDate)) return `${MAUVE}soon${RESET}`;
  const date = new Date(task.dueDate);
  const label = isToday(task.dueDate) ? `today ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}` : formatTaskDate(task.dueDate);
  return `${DIM}${label}${RESET}`;
}

function formatTaskDate(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleString(undefined, { month: "short" });
  const time = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  return `${DIM}${day} ${month} ${time}${RESET}`;
}

function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const elapsedMinutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (elapsedMinutes < 1) return "now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays < 7 ? `${elapsedDays}d ago` : formatTaskDate(timestamp);
}

function truncateTaskDescription(value: string, width: number): string {
  return value.length > width ? `${value.slice(0, Math.max(1, width - 3))}...` : value;
}

function fit(value: string, width: number): string {
  return `${value}${" ".repeat(Math.max(0, width - getVisibleLength(value)))}`;
}

function highlight(value: string): string {
  return `${SELECTED}${value.replaceAll(RESET, `${RESET}${SELECTED}`)}${RESET}`;
}

function formatSplitLine(left: string, right: string, leftWidth: number, rightWidth: number): string {
  return `${DIM}│${RESET} ${fit(left, leftWidth)} ${DIM}│${RESET} ${fit(right, rightWidth)} ${DIM}│${RESET}`;
}

function formatSplitBorder(left: string, middle: string, right: string, leftWidth: number, rightWidth: number, leftTitle?: string, rightTitle?: string): string {
  const leftSegment = formatBorderSegment(leftWidth + 2, leftTitle);
  const rightSegment = formatBorderSegment(rightWidth + 2, rightTitle);
  return `${DIM}${left}${leftSegment}${middle}${rightSegment}${right}${RESET}`;
}

function formatBorderSegment(width: number, title?: string): string {
  if (title === undefined) return "─".repeat(width);
  return `─ ${title} ${"─".repeat(Math.max(0, width - title.length - 3))}`;
}

function formatStatusLine(left: string, right: string, width: number): string {
  const status = `${BRIGHT}${MAUVE}● NORMAL${RESET}`;
  const date = `${DIM}${new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short" }).format()}${RESET}`;
  const content = `${status}  ${left}`;
  const padding = " ".repeat(Math.max(1, width - getVisibleLength(content) - getVisibleLength(right) - getVisibleLength(date)));
  return `${DIM}│${RESET} ${content}${padding}${right}  ${date} ${DIM}│${RESET}`;
}
