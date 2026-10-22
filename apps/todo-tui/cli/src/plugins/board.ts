import type { ParsedInput } from "../command-spec/parsed-input";
import type { CommandContext, CommandSpec, FlagSpec } from "../command-spec/types";
import {
  collectLaneIds,
  createBoard,
  defaultBoardName,
  deleteBoard,
  extendBoard,
  getActiveBoard,
  LANE_LABELS,
  moveBetweenBoards,
  placeOnBoard,
  renameBoard,
  replaceBoard,
  requireBoard,
  takeOffBoard,
  type Board,
  type BoardsState,
  type Lane,
} from "../domain/boards";
import { formatDuration, parseDuration } from "../domain/duration";
import { excludeHiddenSubtrees, findTask } from "../domain/task-tree";
import { UserInputError } from "../domain/user-input-error";
import { loadBoards, wrapUpBoard } from "../services/boards";
import type { TodoStore } from "../storage/todo-store";
import { formatBoardTimer, writeBoard } from "./tasks";

const DIM = "\u001B[2m";
const GREEN = "\u001B[32m";
const BOLD = "\u001B[1m";
const ACCENT = "\u001B[38;5;208m";
const RESET = "\u001B[0m";

const ON_FLAG: FlagSpec = { name: "on", value: "board-name", description: "Board to change instead of the active one" };
const IDS_ARG = { name: "id", kind: "pending-task-id", variadic: true, description: "Tasks to change; their subtasks follow them" } as const;

export const boardCommand: CommandSpec = {
  name: "board",
  summary: "Curated views of tasks with Now and Later lanes.",
  group: "Boards",
  defaultSubcommand: "list",
  details: [
    "A board is a view, not a folder: a task can sit on several boards, and epics still own the tree.",
    "One board can be active. It drives the shell panel, `todo list` and the TUI's first view; new tasks join its Now lane.",
    "Lanes hold top-level picks; a task's subtasks follow it and cannot be moved on their own.",
    "A timed board ends itself: tasks created on it move under an epic named after it.",
    "To add new tasks to another board, activate it first with `todo board use`, or add them and place them with `todo board add <id> --on <name>`.",
    "Quote board names that contain spaces when they are a single argument: `todo board use \"werk fixes\"`.",
  ],
  examples: [
    { command: "todo board new projecten", note: "create and activate" },
    { command: "todo board new \"deploy day\" --for 4h", note: "a timed board" },
    { command: "todo board use werk", note: "switch the active board" },
    { command: "todo board add 12 14", note: "onto the active board, in Now" },
    { command: "todo board later 14", note: "Now → Later" },
    { command: "todo board move 12 --to werk", note: "move #12 off the active board onto werk" },
    { command: "todo board end projecten", note: "delete a board; its tasks stay" },
    { command: "todo board off", note: "back to all tasks" },
  ],
  subcommands: [
    {
      name: "list",
      aliases: ["ls"],
      summary: "List boards; * marks the active one.",
      details: ["Each row shows how many tasks sit in Now and Later, and the time left on a timed board."],
      examples: [{ command: "todo board" }, { command: "todo board ls" }],
      run: runList,
    },
    {
      name: "new",
      summary: "Create a board and make it active.",
      args: [{ name: "name", kind: "text", variadic: true, description: "Board name; spaces are fine" }],
      flags: [{ name: "for", value: "duration", description: "Make it a timed board: 4h, 90m, 2h30m (24h at most)" }],
      details: ["The new board starts empty and becomes active, so tasks you add next join its Now lane."],
      examples: [
        { command: "todo board new projecten" },
        { command: "todo board new deploy day --for 4h", note: "ends itself after 4 hours" },
        { command: "todo board new release --for 2h30m" },
      ],
      async run(input, context) {
        const duration = input.value("for");
        await startBoard(context, input.args("name").join(" "), duration === undefined ? undefined : parseDuration(duration));
      },
    },
    {
      name: "use",
      summary: "Make a board the active one.",
      args: [{ name: "name", kind: "board-name", description: "Board to activate" }],
      details: ["The active board drives the shell panel and `todo list`, and new tasks join its Now lane."],
      examples: [{ command: "todo board use werk" }, { command: "todo board use \"werk fixes\"", note: "quote names with spaces" }],
      async run(input, { store, stdout }) {
        const state = await loadBoards(store);
        const board = requireBoard(state, input.arg("name"));
        await store.saveBoards({ ...state, active: board.name });
        stdout.write(`${GREEN}${board.name} is active${RESET}${formatBoardTimer(board, Date.now(), " · ")}\n`);
      },
    },
    {
      name: "off",
      summary: "Show all tasks again; boards and their timers keep running.",
      details: ["New tasks stay off every board until one is active again."],
      examples: [{ command: "todo board off" }, { command: "todo board use werk", note: "turn a board back on" }],
      async run(_input, { store, stdout }) {
        const state = await loadBoards(store);
        const { active: _active, ...rest } = state;
        await store.saveBoards(rest);
        stdout.write(`${GREEN}No active board${RESET} ${DIM}· all tasks show; timed boards keep counting down${RESET}\n`);
      },
    },
    {
      name: "show",
      summary: "Print a board's Now and Later lanes.",
      args: [{ name: "name", kind: "board-name", optional: true, description: "Board to show; defaults to the active one" }],
      examples: [{ command: "todo board show", note: "the active board" }, { command: "todo board show werk" }],
      async run(input, { store, stdout }) {
        const now = Date.now();
        const state = await loadBoards(store, now);
        const board = resolveBoard(state, input.optionalArg("name"));
        const tasks = await store.loadTasks();
        const visible = excludeHiddenSubtrees(tasks).filter((task) => task.status === "pending");
        writeBoard(board, visible, tasks, stdout, now, await store.loadCollapsedEpicIds());
      },
    },
    {
      name: "add",
      summary: "Put tasks on a board (Now unless --later).",
      args: [IDS_ARG],
      flags: [{ name: "later", description: "Put them in Later" }, ON_FLAG],
      details: ["Idempotent: a task already on the board just moves to the requested lane."],
      examples: [
        { command: "todo board add 12", note: "Now lane of the active board" },
        { command: "todo board add 12 13 --later --on projecten" },
        { command: "todo board add 12 --on \"werk fixes\"" },
      ],
      run: (input, context) => placeTasks(input, context, input.flag("later") ? "later" : "now"),
    },
    {
      name: "rm",
      aliases: ["remove"],
      summary: "Take tasks off a board; the tasks themselves stay.",
      args: [IDS_ARG],
      flags: [ON_FLAG],
      details: ["To delete a task, use `todo rm`."],
      examples: [{ command: "todo board rm 12" }, { command: "todo board rm 12 13 --on werk" }],
      run: removeTasks,
    },
    {
      name: "move",
      aliases: ["mv"],
      summary: "Move tasks to another board, keeping their lane.",
      args: [IDS_ARG],
      flags: [
        { name: "to", value: "board-name", description: "Board to move them to" },
        { name: "from", value: "board-name", description: "Board to take them off; defaults to the active one" },
        { name: "later", description: "Put them in Later on the new board" },
        { name: "now", description: "Put them in Now on the new board" },
      ],
      details: [
        "The tasks leave the old board and land in the same lane on the new one, unless --later or --now says otherwise.",
        "Subtasks follow their parent. To keep a task on both boards, use `todo board add <id> --on <board>` instead.",
      ],
      examples: [
        { command: "todo board move 12 --to werk", note: "from the active board" },
        { command: "todo board mv 12 13 --to werk --from cleanup" },
        { command: "todo board move 12 --to \"werk fixes\" --later" },
      ],
      run: moveTasks,
    },
    {
      name: "later",
      summary: "Move tasks to Later, adding them when needed.",
      args: [IDS_ARG],
      flags: [ON_FLAG],
      examples: [{ command: "todo board later 14" }, { command: "todo board later 14 15 --on werk" }],
      run: (input, context) => placeTasks(input, context, "later"),
    },
    {
      name: "now",
      summary: "Move tasks to Now, adding them when needed.",
      args: [IDS_ARG],
      flags: [ON_FLAG],
      examples: [{ command: "todo board now 14" }, { command: "todo board now 14 --on werk" }],
      run: (input, context) => placeTasks(input, context, "now"),
    },
    {
      name: "extend",
      summary: "Give a timed board more time.",
      args: [{ name: "duration", kind: "duration", description: "Extra time: 1h, 30m, 1h30m" }],
      flags: [ON_FLAG],
      details: ["The board can never run past 24h from now. An untimed board cannot be extended."],
      examples: [{ command: "todo board extend 1h" }, { command: "todo board extend 30m --on \"deploy day\"" }],
      async run(input, { store, stdout }) {
        const now = Date.now();
        const state = await loadBoards(store, now);
        const board = resolveBoard(state, input.value("on"));
        const extended = extendBoard(board, parseDuration(input.arg("duration")), now);
        await store.saveBoards(replaceBoard(state, board.name, extended));
        stdout.write(`${GREEN}${board.name} runs until ${formatClock(extended.expiresAt ?? now)}${RESET}${formatBoardTimer(extended, now, " · ")}\n`);
      },
    },
    {
      name: "rename",
      summary: "Rename a board.",
      args: [
        { name: "old", kind: "board-name", description: "Current name" },
        { name: "new", kind: "text", variadic: true, description: "New name" },
      ],
      examples: [{ command: "todo board rename werk werk oud" }, { command: "todo board rename \"werk fixes\" bugs" }],
      async run(input, { store, stdout }) {
        const state = await loadBoards(store);
        const board = requireBoard(state, input.arg("old"));
        const name = input.args("new").join(" ");
        await store.saveBoards(renameBoard(state, board.name, name));
        stdout.write(`${GREEN}Renamed ${board.name} → ${name.trim()}${RESET}\n`);
      },
    },
    {
      name: "end",
      aliases: ["delete"],
      summary: "Delete a board; a timed one nests its new tasks under an epic.",
      args: [{ name: "name", kind: "board-name", optional: true, description: "Board to end; defaults to the active one" }],
      details: ["Top-level tasks created on a timed board move under a new epic named after it. Tasks are never deleted."],
      examples: [
        { command: "todo board end", note: "the active board" },
        { command: "todo board end cleanup" },
        { command: "todo board delete \"werk fixes\"" },
      ],
      async run(input, { store, stdout }) {
        const now = Date.now();
        const state = await loadBoards(store, now);
        const board = resolveBoard(state, input.optionalArg("name"));
        const epic = await wrapUpBoard(store, board, now);
        await store.saveBoards(deleteBoard(state, board.name));
        const nested = epic === undefined ? "" : ` · its tasks are under epic #${epic.id} ${epic.description}`;
        stdout.write(`${GREEN}Ended ${board.name}${RESET}${DIM}${nested}${RESET}\n`);
      },
    },
  ],
};

export const focusCommand: CommandSpec = {
  name: "focus",
  summary: "Start a timed board: shortcut for board new --for.",
  group: "Boards",
  args: [
    { name: "duration", kind: "duration", description: "How long it runs: 4h, 90m, 2h30m (24h at most)" },
    { name: "title", kind: "text", variadic: true, optional: true, description: "Board name; defaults to Focus <date>" },
  ],
  examples: [{ command: "todo focus 4h" }, { command: "todo focus 90m deploy day" }],
  async run(input, context) {
    const title = input.args("title").join(" ").trim();
    const state = await loadBoards(context.store);
    await startBoard(context, title === "" ? defaultBoardName(state, Date.now()) : title, parseDuration(input.arg("duration")));
  },
};

async function startBoard({ store, stdout }: CommandContext, name: string, durationMs: number | undefined): Promise<void> {
  const now = Date.now();
  const { state, board } = createBoard(await loadBoards(store, now), name, now, durationMs);
  await store.saveBoards(state);
  const timer = durationMs === undefined ? "" : ` ${DIM}· ${formatDuration(durationMs)}${RESET}`;
  stdout.write(`${GREEN}${board.name} is active${RESET}${timer} ${DIM}· new tasks join it; todo board add <id> pulls others in${RESET}\n`);
}

async function runList(_input: ParsedInput, { store, stdout }: CommandContext): Promise<void> {
  const now = Date.now();
  const state = await loadBoards(store, now);
  if (state.boards.length === 0) {
    stdout.write(`${DIM}No boards yet · todo board new <name> [--for 4h]${RESET}\n`);
    return;
  }
  const tasks = (await store.loadTasks()).filter((task) => task.status === "pending");
  const active = getActiveBoard(state);
  const width = Math.max(...state.boards.map((board) => board.name.length));
  for (const board of state.boards) {
    const marker = board === active ? `${ACCENT}*${RESET}` : " ";
    const name = board === active ? `${BOLD}${board.name.padEnd(width)}${RESET}` : board.name.padEnd(width);
    const counts = `${collectLaneIds(board, tasks, "now").size} now · ${collectLaneIds(board, tasks, "later").size} later`;
    stdout.write(`${marker} ${name}  ${DIM}${counts}${RESET}${formatBoardTimer(board, now, " · ")}\n`);
  }
  if (active === undefined) stdout.write(`${DIM}No active board · todo board use <name>${RESET}\n`);
}

function resolveBoard(state: BoardsState, name: string | undefined): Board {
  if (name !== undefined) return requireBoard(state, name);
  const active = getActiveBoard(state);
  if (active === undefined) throw new UserInputError("No active board · todo board use <name>, or name one with --on <name>");
  return active;
}

async function placeTasks(input: ParsedInput, { store, stdout }: CommandContext, lane: Lane): Promise<void> {
  const { state, board, tasks } = await loadTarget(store, input);
  let next = board;
  const lines: string[] = [];
  for (const id of input.args("id")) {
    findTask(tasks, id);
    const result = placeOnBoard(next, tasks, id, lane);
    next = result.board;
    lines.push(result.change === "unchanged"
      ? `${DIM}#${id} is already in ${LANE_LABELS[lane]} on ${board.name}${RESET}`
      : `${GREEN}${result.change === "added" ? "Added" : "Moved"} #${id} to ${LANE_LABELS[lane]} on ${board.name}${RESET}`);
  }
  await store.saveBoards(replaceBoard(state, board.name, next));
  stdout.write(`${lines.join("\n")}\n`);
}

async function removeTasks(input: ParsedInput, { store, stdout }: CommandContext): Promise<void> {
  const { state, board, tasks } = await loadTarget(store, input);
  let next = board;
  const lines: string[] = [];
  for (const id of input.args("id")) {
    findTask(tasks, id);
    const result = takeOffBoard(next, tasks, id);
    next = result.board;
    lines.push(result.removed ? `${GREEN}Took #${id} off ${board.name}${RESET}` : `${DIM}#${id} is not on ${board.name}${RESET}`);
  }
  await store.saveBoards(replaceBoard(state, board.name, next));
  stdout.write(`${lines.join("\n")}\n`);
}

async function moveTasks(input: ParsedInput, { store, stdout }: CommandContext): Promise<void> {
  const toName = input.value("to");
  if (toName === undefined) throw new UserInputError("Usage: todo board move <id…> --to <board> [--from <board>]");
  if (input.flag("later") && input.flag("now")) throw new UserInputError("Pick one of --later and --now");
  const lane: Lane | undefined = input.flag("later") ? "later" : input.flag("now") ? "now" : undefined;
  let state = await loadBoards(store);
  const fromName = resolveBoard(state, input.value("from")).name;
  const tasks = await store.loadTasks();
  const lines: string[] = [];
  for (const id of input.args("id")) {
    findTask(tasks, id);
    const moved = moveBetweenBoards(state, tasks, id, fromName, toName, lane);
    state = moved.state;
    lines.push(`${GREEN}Moved #${id} from ${moved.from.name} to ${LANE_LABELS[moved.lane]} on ${moved.to.name}${RESET}`);
  }
  await store.saveBoards(state);
  stdout.write(`${lines.join("\n")}\n`);
}

async function loadTarget(store: TodoStore, input: ParsedInput): Promise<{ state: BoardsState; board: Board; tasks: Awaited<ReturnType<TodoStore["loadTasks"]>> }> {
  const state = await loadBoards(store);
  return { state, board: resolveBoard(state, input.value("on")), tasks: await store.loadTasks() };
}

function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

