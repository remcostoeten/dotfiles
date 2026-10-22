import type { ParsedInput } from "../command-spec/parsed-input";
import type { CommandContext, CommandSpec } from "../command-spec/types";
import { getActiveBoard, isTimed, laneOf, remainingMs, type Board, type Lane } from "../domain/boards";
import { formatDuration } from "../domain/duration";
import { normalizePanelBoards, parsePanelBoards } from "../domain/panel-boards";
import { normalizePanelLayout, parsePanelLayout } from "../domain/panel-layout";
import { normalizePanelLimit, parsePanelLimit, toPanelRowCount } from "../domain/panel-limit";
import type { PanelBoards, PanelLayout, Task } from "../domain/task";
import { buildTaskTreeRows, excludeHiddenSubtrees } from "../domain/task-tree";
import { UserInputError } from "../domain/user-input-error";
import { formatTaskRowForShellDisplay, formatTaskTreeRowForDisplay, getVisibleLength, isOverdue, isUpcoming, truncateVisible } from "../presentation/task-format";
import { loadBoards } from "../services/boards";
import type { TodoStore } from "../storage/todo-store";

const DIM = "\u001B[2m";
const RESET = "\u001B[0m";
const GREEN = "\u001B[38;5;166m";
const BOLD = "\u001B[1m";
const PANEL_WIDTH = 72;

interface PanelLine {
  left: string;
  right: string;
}

export const panelCommand: CommandSpec = {
  name: "panel",
  summary: "Print the compact task panel shown at shell startup.",
  group: "View",
  flags: [
    { name: "side", description: "Board lanes in columns, however narrow the terminal" },
    { name: "stack", description: "Board lanes stacked" },
    { name: "boards", description: "Every board as a column, the active one marked with *" },
    { name: "limit", value: "count-or-all", description: "Rows per lane before folding the rest into a summary line" },
    { name: "all", description: "Every pending task, ignoring the active board and the limit" },
  ],
  details: [
    "Runs automatically when todo gets no arguments and stdin is not a terminal.",
    "With an active board it shows the Now and Later lanes; otherwise every pending task, plus one line per running timed board.",
    "With --boards, or panel-boards set to all, every board gets a column with its Now lane and, when filled, its Later lane.",
    "Tasks hidden with `todo hide` stay out. TODO_PANEL_LIMIT, TODO_PANEL_LAYOUT and TODO_PANEL_BOARDS override the configured values.",
  ],
  examples: [{ command: "todo panel" }, { command: "todo panel --side --limit 3" }, { command: "todo panel --boards" }, { command: "todo panel --all" }],
  run: runPanel,
};

export const listCommand: CommandSpec = {
  name: "list",
  aliases: ["tree"],
  summary: "List tasks as a tree.",
  group: "View",
  flags: [
    { name: "all", description: "Every task including completed and hidden ones, ignoring the active board" },
    { name: "overdue", description: "Only pending tasks past their due date" },
    { name: "upcoming", description: "Only pending tasks due soon" },
  ],
  details: [
    "Pending tasks by default, without anything hidden via `todo hide`.",
    "With an active board only its Now and Later lanes are listed; --all lifts that. Filtered views show matches flat when their parent is not part of the result.",
  ],
  examples: [{ command: "todo list" }, { command: "todo tree --overdue" }, { command: "todo list --all" }],
  async run(input, { store, stdout }) {
    await listTasks(store, stdout, readListFilter(input));
  },
};

type ListFilter = "pending" | "all" | "overdue" | "upcoming";

function readListFilter(input: ParsedInput): ListFilter {
  const filters = (["all", "overdue", "upcoming"] as const).filter((name) => input.flag(name));
  if (filters.length > 1) throw new UserInputError("Use one of --all, --overdue or --upcoming");
  return filters[0] ?? "pending";
}

export async function listTasks(store: TodoStore, stdout: CommandContext["stdout"], filter: ListFilter = "pending"): Promise<void> {
  const tasks = await store.loadTasks();
  const now = Date.now();
  const visible = filterTasks(tasks, filter, now);
  const collapsedIds = await store.loadCollapsedEpicIds();
  const board = filter === "all" ? undefined : getActiveBoard(await loadBoards(store, now));
  if (board !== undefined) {
    writeBoard(board, visible, tasks, stdout, now, collapsedIds);
    return;
  }

  const rows = buildTaskTreeRows(visible, tasks, { compare: compareTasks, collapsedIds });
  if (rows.length === 0) {
    stdout.write(`${DIM}No tasks found${RESET}\n`);
    return;
  }
  for (const row of rows) stdout.write(`${formatTaskTreeRowForDisplay(row, now)}\n`);
}

/** Prints a board header and its Now and Later lanes as trees. */
export function writeBoard(board: Board, visible: Task[], tasks: Task[], stdout: CommandContext["stdout"], now: number, collapsedIds: ReadonlySet<string>): void {
  stdout.write(`${BOLD}${board.name}${RESET}${formatBoardTimer(board, now, " · ")}\n`);
  const lanes = splitLanes(board, visible, tasks);
  if (lanes.now.length === 0 && lanes.later.length === 0) {
    stdout.write(`${DIM}Nothing on the board yet · todo board add <id> pulls a task in${RESET}\n`);
    return;
  }
  for (const lane of ["now", "later"] as const) {
    if (lane === "later" && lanes.later.length === 0) continue;
    stdout.write(`${lane === "later" ? "\n" : ""}${BOLD}${LANE_TITLES[lane]}${RESET}\n`);
    if (lanes[lane].length === 0) stdout.write(`${DIM}nothing here · todo board now <id>${RESET}\n`);
    for (const row of buildTaskTreeRows(lanes[lane], tasks, { compare: compareTasks, collapsedIds: new Set(collapsedIds) })) {
      stdout.write(`${formatTaskTreeRowForDisplay(row, now)}\n`);
    }
  }
}

const LANE_TITLES: Record<Lane, string> = { now: "Now", later: "Later" };

export function splitLanes(board: Board, visible: Task[], tasks: Task[]): Record<Lane, Task[]> {
  return {
    now: visible.filter((task) => laneOf(board, tasks, task.id) === "now"),
    later: visible.filter((task) => laneOf(board, tasks, task.id) === "later"),
  };
}

/** `3h left` for timed boards, nothing for untimed ones. */
export function formatBoardTimer(board: Board, now: number, prefix = ""): string {
  return isTimed(board) ? `${DIM}${prefix}${formatDuration(remainingMs(board, now))} left${RESET}` : "";
}

async function runPanel(input: ParsedInput, { store, stdout }: CommandContext): Promise<void> {
  const tasks = await store.loadTasks();
  const now = Date.now();
  const state = await loadBoards(store, now);
  const showAll = input.flag("all");
  const board = showAll ? undefined : getActiveBoard(state);
  const pendingTasks = excludeHiddenSubtrees(tasks).filter((task) => task.status === "pending");
  const config = await store.loadConfig();
  const limit = resolvePanelLimit(showAll ? "all" : input.value("limit"), config.panelLimit);
  const layout = resolvePanelLayout(input, config.panelLayout);
  const boards = resolvePanelBoards(input, config.panelBoards);
  const collapsedIds = await store.loadCollapsedEpicIds();

  function buildLines(lane: Task[]): PanelLine[] {
    const rows = buildTaskTreeRows(lane, tasks, { compare: compareTasksForPanel, collapsedIds });
    const lines = rows.slice(0, limit).map((row) => formatTaskRowForShellDisplay(row, now));
    const hiddenTaskCount = rows.length - lines.length;
    if (hiddenTaskCount > 0) {
      lines.push({
        left: `${DIM}↳ ${hiddenTaskCount} more task${hiddenTaskCount === 1 ? "" : "s"}${RESET}`,
        right: `${DIM}todo config panel-limit all${RESET}`,
      });
    }
    return lines;
  }

  function buildBoardColumn(column: Board): PanelLine[] {
    const lanes = splitLanes(column, pendingTasks, tasks);
    const name = `${BOLD}${column.name === state.active ? "* " : ""}${column.name}${RESET}`;
    const on = `--on ${quoteBoardName(column.name)}`;
    if (lanes.now.length === 0 && lanes.later.length === 0) {
      return [{ left: `${name}${DIM} · nothing on it yet · todo board add <id> ${on}${RESET}`, right: formatBoardTimer(column, now) }];
    }
    const lines: PanelLine[] = [{ left: `${name} ${DIM}· Now${RESET}`, right: formatBoardTimer(column, now) }];
    lines.push(...(lanes.now.length === 0 ? [{ left: `${DIM}nothing in Now · todo board now <id> ${on}${RESET}`, right: "" }] : buildLines(lanes.now)));
    if (lanes.later.length > 0) lines.push({ left: `${BOLD}Later${RESET}`, right: `${DIM}${lanes.later.length}${RESET}` }, ...buildLines(lanes.later));
    return lines;
  }

  if (!showAll && boards === "all" && state.boards.length > 0) {
    stdout.write(formatPanels(state.boards.map(buildBoardColumn), layout));
    return;
  }

  if (board !== undefined) {
    const lanes = splitLanes(board, pendingTasks, tasks);
    const title: PanelLine = { left: `${BOLD}${board.name}${RESET} ${DIM}· Now${RESET}`, right: formatBoardTimer(board, now) };
    if (lanes.now.length === 0 && lanes.later.length === 0) {
      stdout.write(formatPanels([[{ ...title, left: `${BOLD}${board.name}${RESET}${DIM} · nothing on it yet · todo board add <id>${RESET}` }]], layout));
      return;
    }
    const nowPanel = [title, ...(lanes.now.length === 0 ? [{ left: `${DIM}nothing in Now · todo board now <id>${RESET}`, right: "" }] : buildLines(lanes.now))];
    if (lanes.later.length === 0) {
      stdout.write(formatPanels([nowPanel], layout));
      return;
    }
    const laterPanel = [{ left: `${BOLD}Later${RESET}`, right: `${DIM}${lanes.later.length}${RESET}` }, ...buildLines(lanes.later)];
    stdout.write(formatPanels([nowPanel, laterPanel], layout));
    return;
  }

  const footer: PanelLine[] = showAll
    ? []
    : state.boards.filter(isTimed).map((running) => ({
        left: `${DIM}${running.name} · ${formatDuration(remainingMs(running, now))} left · todo board use ${quoteBoardName(running.name)}${RESET}`,
        right: "",
      }));

  if (pendingTasks.length === 0) {
    const completedCount = tasks.filter((task) => task.status === "completed").length;
    const completedText = completedCount > 0 ? `${DIM} · ${completedCount} completed${RESET}` : "";
    stdout.write(formatPanels([[{ left: `${GREEN}✓ All caught up${RESET}${completedText}`, right: "" }, ...footer]], layout));
    return;
  }

  stdout.write(formatPanels([[...buildLines(pendingTasks), ...footer]], layout));
}

export function quoteBoardName(name: string): string {
  return /\s/.test(name) ? `"${name}"` : name;
}

function resolvePanelLimit(requested: string | undefined, configuredLimit: number): number {
  const value = requested ?? process.env.TODO_PANEL_LIMIT;
  const limit = value === undefined || value === "" ? normalizePanelLimit(configuredLimit) : parsePanelLimit(value);
  return toPanelRowCount(limit);
}

function resolvePanelLayout(input: ParsedInput, configuredLayout: PanelLayout): PanelLayout {
  if (input.flag("side") && input.flag("stack")) throw new UserInputError("Use --side or --stack, not both");
  if (input.flag("side")) return "side";
  if (input.flag("stack")) return "stack";
  const fromEnvironment = process.env.TODO_PANEL_LAYOUT;
  return fromEnvironment === undefined || fromEnvironment === "" ? normalizePanelLayout(configuredLayout) : parsePanelLayout(fromEnvironment);
}

function resolvePanelBoards(input: ParsedInput, configured: PanelBoards): PanelBoards {
  if (input.flag("boards")) return "all";
  const fromEnvironment = process.env.TODO_PANEL_BOARDS;
  return fromEnvironment === undefined || fromEnvironment === "" ? normalizePanelBoards(configured) : parsePanelBoards(fromEnvironment);
}

function filterTasks(tasks: Task[], filter: ListFilter, now: number): Task[] {
  if (filter === "all") return [...tasks];
  const pendingTasks = excludeHiddenSubtrees(tasks).filter((task) => task.status === "pending");
  if (filter === "overdue") return pendingTasks.filter((task) => task.dueDate !== undefined && isOverdue(task.dueDate, now));
  if (filter === "upcoming") return pendingTasks.filter((task) => task.dueDate !== undefined && isUpcoming(task.dueDate, now));
  return pendingTasks;
}

function compareTasks(left: Task, right: Task): number {
  if (left.dueDate !== undefined && right.dueDate !== undefined) return left.dueDate - right.dueDate;
  if (left.dueDate !== undefined) return -1;
  if (right.dueDate !== undefined) return 1;
  return 0;
}

function compareTasksForPanel(left: Task, right: Task): number {
  const dueDateOrder = compareTasks(left, right);
  return dueDateOrder === 0 ? left.createdAt - right.createdAt : dueDateOrder;
}

const PANEL_GAP = 2;
const MIN_SIDE_BY_SIDE_WIDTH = 56;
const MIN_FORCED_SIDE_WIDTH = 24;

/** Draws one boxed panel per lane: in columns when the layout asks for it or `auto` finds room, stacked otherwise. */
function formatPanels(panels: PanelLine[][], layout: PanelLayout): string {
  const fittedWidth = Math.min(PANEL_WIDTH, Math.floor((readTerminalColumns() - PANEL_GAP * (panels.length - 1)) / panels.length) - 4);
  const sideBySide = panels.length > 1 && (layout === "side" || (layout === "auto" && fittedWidth >= MIN_SIDE_BY_SIDE_WIDTH));
  if (!sideBySide) {
    return panels.map((lines) => `${formatPanel(lines, PANEL_WIDTH).join("\n")}\n`).join("");
  }
  const width = Math.max(MIN_FORCED_SIDE_WIDTH, fittedWidth);
  const height = Math.max(...panels.map((lines) => lines.length));
  const boxes = panels.map((lines) => formatPanel([...lines, ...Array.from({ length: height - lines.length }, () => ({ left: "", right: "" }))], width));
  return boxes[0]!.map((_, row) => boxes.map((box) => box[row]).join(" ".repeat(PANEL_GAP))).join("\n") + "\n";
}

function readTerminalColumns(): number {
  return process.stdout.columns ?? (Number(process.env.COLUMNS) || 80);
}

function formatPanel(lines: PanelLine[], width: number): string[] {
  const rowsFitRight = lines.slice(1).every((line) => fitsRight(line, width));
  const shown = lines.map((line, index) => (index === 0 || rowsFitRight ? line : { ...line, right: "" }));
  return [formatPanelBorder("╭", "╮", width), ...shown.map((line) => formatPanelLine(line, width)), formatPanelBorder("╰", "╯", width)];
}

function fitsRight({ left, right }: PanelLine, width: number): boolean {
  return right === "" || getVisibleLength(left) + 1 + getVisibleLength(right) <= width;
}

function formatPanelLine(line: PanelLine, width: number): string {
  const right = fitsRight(line, width) ? line.right : "";
  const left = truncateVisible(line.left, width - (right === "" ? 0 : getVisibleLength(right) + 1));
  const padding = " ".repeat(Math.max(0, width - getVisibleLength(left) - getVisibleLength(right)));
  return `${DIM}│${RESET} ${left}${padding}${right} ${DIM}│${RESET}`;
}

function formatPanelBorder(left: string, right: string, width: number): string {
  return `${DIM}${left}${"─".repeat(width + 2)}${right}${RESET}`;
}
