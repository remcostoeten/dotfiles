import { listEpicIds, pruneCollapsedIds, resolveEpic, setEpicVisibility, type VisibilityAction } from "../domain/epic-visibility";
import { UserInputError } from "../domain/user-input-error";
import { isHelpToken } from "../domain/visibility-alias";
import { formatCommandHelp } from "../presentation/help-format";
import type { CommandContext, CommandHelp, CommandSummary, TodoPlugin } from "./types";

const GREEN = "\u001B[32m";
const RESET = "\u001B[0m";

type VisibilityTarget = "epic" | "all" | "reset";

interface VisibilityRequest {
  action: VisibilityAction;
  target: VisibilityTarget;
  selector?: string;
  help: boolean;
}

export const visibilityPlugin: TodoPlugin = {
  name: "visibility",
  description: "Collapses and expands epics in the task list.",
  register(app) {
    for (const action of ["toggle", "open", "close"] as const) {
      app.command(action, ACTION_DESCRIPTIONS[action], (context) => runVisibility(action, context), COMMAND_HELP[action]);
    }
  },
};

async function runVisibility(action: VisibilityAction, { args, store, stdout }: CommandContext): Promise<void> {
  const request = parseVisibilityRequest(action, args);
  if (request.help) {
    stdout.write(formatCommandHelp(getHelpPage(request)));
    return;
  }

  const tasks = await store.loadTasks();
  const collapsedIds = pruneCollapsedIds(await store.loadCollapsedEpicIds(), tasks);

  if (request.target === "reset") {
    await store.saveCollapsedEpicIds([]);
    stdout.write(`${GREEN}Epic visibility reset${RESET}\n`);
    return;
  }

  if (request.target === "all") {
    const epicIds = listEpicIds(tasks);
    await store.saveCollapsedEpicIds(setEpicVisibility(collapsedIds, epicIds, action));
    stdout.write(`${GREEN}${formatAllMessage(action, epicIds.length)}${RESET}\n`);
    return;
  }

  const epic = resolveEpic(tasks, request.selector ?? "");
  const next = setEpicVisibility(collapsedIds, [epic.id], action);
  await store.saveCollapsedEpicIds(next);
  stdout.write(`${GREEN}${next.has(epic.id) ? "Closed" : "Opened"} epic: ${epic.description}${RESET}\n`);
}

/** Normalizes both the canonical and the alias-expanded argv into one request; never touches stored state. */
export function parseVisibilityRequest(action: VisibilityAction, args: ReadonlyArray<string>): VisibilityRequest {
  const help = args.some(isHelpToken);
  const rest = args.filter((argument) => !isHelpToken(argument));
  const keywords = rest.filter((argument) => argument === "all" || argument === "reset");

  if (keywords.length > 1) {
    throw new UserInputError(
      `all and reset are mutually exclusive selectors for todo ${action}.\n` +
        `Usage: todo ${action} all${action === "toggle" ? `\n       todo toggle reset` : ""}`,
    );
  }

  if (rest.length === 0) {
    if (help) return { action, target: "epic", help: true };
    throw new UserInputError(formatUsage(action));
  }

  if (rest.length === 1 && rest[0] === "all") return { action, target: "all", help };
  if (rest.length === 1 && rest[0] === "reset") {
    if (action !== "toggle") throw new UserInputError(`Resetting epic visibility is only available as 'todo toggle reset'.`);
    return { action, target: "reset", help };
  }

  return { action, target: "epic", selector: rest.join(" "), help };
}

function formatUsage(action: VisibilityAction): string {
  return `Usage: todo ${action} <epic>\n       todo ${action} all${action === "toggle" ? `\n       todo toggle reset` : ""}`;
}

function formatAllMessage(action: VisibilityAction, epicCount: number): string {
  if (action === "open") return "Opened all epics";
  if (action === "close") return "Closed all epics";
  return `Toggled ${epicCount} epic${epicCount === 1 ? "" : "s"}`;
}

const ACTION_DESCRIPTIONS: Record<VisibilityAction, string> = {
  toggle: "Collapse an expanded epic, or expand a collapsed one.",
  open: "Expand an epic so its subtickets render again.",
  close: "Collapse an epic into a single subticket-count line.",
};

const EPIC_DETAILS = [
  "<epic> is an epic name or an epic ID, with or without the leading #. Quote names with spaces.",
  "Visibility is presentation state only: nothing about the tasks themselves changes.",
];

const COMMAND_HELP: Record<VisibilityAction, CommandHelp> = {
  toggle: {
    group: "Epic visibility",
    positional: "any",
    ownHelp: true,
    aliasNotes: ["-t <epic>", "--t <epic>", "-ta", "-tr"],
    usage: ["todo toggle <epic>", "todo toggle all", "todo toggle reset"],
    details: [...EPIC_DETAILS, "`todo toggle all` inverts every epic independently; `todo toggle reset` expands everything again."],
    examples: [
      { command: "todo toggle joram" },
      { command: "todo toggle 36" },
      { command: "todo toggle #36" },
      { command: "todo toggle all", note: "same as todo -ta" },
      { command: "todo toggle reset", note: "same as todo -tr" },
    ],
  },
  open: {
    group: "Epic visibility",
    positional: "any",
    ownHelp: true,
    aliasNotes: ["-o <epic>", "--o <epic>", "-oa"],
    usage: ["todo open <epic>", "todo open all"],
    details: [...EPIC_DETAILS, "Idempotent: opening an already-open epic leaves it open."],
    examples: [{ command: "todo open joram" }, { command: "todo open 36" }, { command: "todo open all", note: "same as todo -oa" }],
  },
  close: {
    group: "Epic visibility",
    positional: "any",
    ownHelp: true,
    aliasNotes: ["-c <epic>", "--c <epic>", "-ca"],
    usage: ["todo close <epic>", "todo close all"],
    details: [...EPIC_DETAILS, "Idempotent: closing an already-closed epic leaves it closed.", "A closed epic renders as `name ● 2 subtickets` and hides its children."],
    examples: [{ command: "todo close joram" }, { command: "todo close #36" }, { command: "todo close all", note: "same as todo -ca" }],
  },
};

const TARGET_HELP: Record<string, CommandSummary> = {
  "toggle all": {
    name: "toggle all",
    description: "Invert every epic's visibility independently.",
    help: {
      aliasNotes: ["-ta", "--t --a"],
      usage: ["todo toggle all"],
      details: ["Each epic flips on its own: open epics close, closed epics open.", "This is not a bulk 'set everything to one state' — use `todo open all` or `todo close all` for that."],
      examples: [{ command: "todo toggle all" }, { command: "todo -ta" }],
    },
  },
  "toggle reset": {
    name: "toggle reset",
    description: "Drop all persisted epic visibility overrides.",
    help: {
      aliasNotes: ["-tr", "--t --r"],
      usage: ["todo toggle reset"],
      details: ["Clears the stored state instead of writing an explicit open state per epic.", "The default is expanded, so every epic — including future ones — renders open again."],
      examples: [{ command: "todo toggle reset" }, { command: "todo -tr" }],
    },
  },
  "open all": {
    name: "open all",
    description: "Expand every epic.",
    help: {
      aliasNotes: ["-oa", "--o --a"],
      usage: ["todo open all"],
      details: ["Idempotent: epics that are already open stay open."],
      examples: [{ command: "todo open all" }, { command: "todo -oa" }],
    },
  },
  "close all": {
    name: "close all",
    description: "Collapse every epic.",
    help: {
      aliasNotes: ["-ca", "--c --a"],
      usage: ["todo close all"],
      details: ["Idempotent: epics that are already closed stay closed.", "Epics created later still default to open."],
      examples: [{ command: "todo close all" }, { command: "todo -ca" }],
    },
  },
};

function getHelpPage(request: VisibilityRequest): CommandSummary {
  const page = TARGET_HELP[`${request.action} ${request.target}`];
  if (page !== undefined) return page;
  return { name: request.action, description: ACTION_DESCRIPTIONS[request.action], help: COMMAND_HELP[request.action] };
}
