import type { ParsedInput } from "../command-spec/parsed-input";
import type { CommandContext, CommandSpec } from "../command-spec/types";
import { listEpicIds, pruneCollapsedIds, resolveEpic, setEpicVisibility, type VisibilityAction } from "../domain/epic-visibility";
import { listTasks } from "./tasks";

const GREEN = "\u001B[32m";
const RESET = "\u001B[0m";

type OpenOrClose = Exclude<VisibilityAction, "toggle">;

const EPIC_DETAILS = [
  "<epic> is an epic name or an epic ID, with or without the leading #. Quote names with spaces.",
  "Visibility is presentation state only: nothing about the tasks themselves changes.",
];

function visibilityCommand(action: OpenOrClose): CommandSpec {
  const verb = action === "open" ? "Expand" : "Collapse";
  const letter = action === "open" ? "o" : "c";
  return {
    name: action,
    summary: action === "open" ? "Expand an epic so its subtickets render again." : "Collapse an epic into a single subticket-count line.",
    group: "Epic visibility",
    args: [{ name: "epic", kind: "epic-selector", variadic: true, description: "Epic ID or exact epic name" }],
    details: [
      ...EPIC_DETAILS,
      `Idempotent: ${action === "open" ? "opening an already-open" : "closing an already-closed"} epic leaves it that way.`,
      `Shorthand: \`todo -${letter} <epic>\`, \`todo -${letter}a\` for all.`,
    ],
    examples: [
      { command: `todo ${action} joram` },
      { command: `todo ${action} #36` },
      { command: `todo ${action} all`, note: `same as todo -${letter}a` },
    ],
    subcommands: [
      {
        name: "all",
        summary: `${verb} every epic.`,
        details: ["Idempotent: epics already in that state stay there. Epics created later still default to open."],
        examples: [{ command: `todo ${action} all` }, { command: `todo -${letter}a`, note: "shorthand" }],
        run: (_input, context) => applyToAll(action, context),
      },
    ],
    run: (input, context) => applyToEpic(action, input, context),
  };
}

async function applyToAll(action: OpenOrClose, { store, stdout }: CommandContext): Promise<void> {
  const tasks = await store.loadTasks();
  const collapsedIds = pruneCollapsedIds(await store.loadCollapsedEpicIds(), tasks);
  await store.saveCollapsedEpicIds(setEpicVisibility(collapsedIds, listEpicIds(tasks), action));
  stdout.write(`${GREEN}${action === "open" ? "Opened" : "Closed"} all epics${RESET}\n`);
  await listTasks(store, stdout);
}

async function applyToEpic(action: OpenOrClose, input: ParsedInput, { store, stdout }: CommandContext): Promise<void> {
  const tasks = await store.loadTasks();
  const collapsedIds = pruneCollapsedIds(await store.loadCollapsedEpicIds(), tasks);
  const epic = resolveEpic(tasks, input.args("epic").join(" "));
  const next = setEpicVisibility(collapsedIds, [epic.id], action);
  await store.saveCollapsedEpicIds(next);
  stdout.write(`${GREEN}${next.has(epic.id) ? "Closed" : "Opened"} epic: ${epic.description}${RESET}\n`);
  await listTasks(store, stdout);
}

export const visibilityCommands: CommandSpec[] = [visibilityCommand("open"), visibilityCommand("close")];
