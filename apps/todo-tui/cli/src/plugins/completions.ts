import { DYNAMIC_KINDS, generateFishCompletions, type DynamicKind } from "../command-spec/completions";
import type { CommandSpec } from "../command-spec/types";
import { isEpic } from "../domain/task-tree";
import { UserInputError } from "../domain/user-input-error";
import type { TodoStore } from "../storage/todo-store";

export const completionsCommand: CommandSpec = {
  name: "completions",
  summary: "Print shell completions generated from the command tree.",
  group: "Settings",
  flags: [{ name: "list", value: { oneOf: [...DYNAMIC_KINDS] }, hidden: true, description: "Print live values for one completion kind" }],
  details: ["The committed file lives at configs/fish/completions/todo.fish; regenerate it after changing commands."],
  examples: [{ command: "todo completions fish > ~/.config/fish/completions/todo.fish" }],
  subcommands: [
    {
      name: "fish",
      summary: "Fish completions for every command, flag and value.",
      run(_input, { root, stdout }) {
        stdout.write(generateFishCompletions(root));
      },
    },
  ],
  async run(input, { store, stdout }) {
    const kind = input.value("list");
    if (kind === undefined) throw new UserInputError("Usage: todo completions fish");
    for (const line of await listCompletionValues(store, kind as DynamicKind)) stdout.write(`${line}\n`);
  },
};

/** Tab-separated `value<TAB>description` lines for fish's dynamic completions. */
export async function listCompletionValues(store: TodoStore, kind: DynamicKind): Promise<string[]> {
  if (kind === "board") {
    const state = await store.loadBoardsFile();
    return (state?.boards ?? []).map((board) => `${board.name}\t${board.name === state?.active ? "active board" : board.expiresAt === undefined ? "board" : "timed board"}`);
  }
  if (kind === "archive") {
    const removed = await store.loadRemoved();
    const completed = (await store.loadTasks()).filter((task) => task.status === "completed");
    return [...removed.map((entry) => `r${entry.ref}\t${clean(entry.task.description)}`), ...completed.map((task) => `${task.id}\t${clean(task.description)}`)];
  }
  const tasks = await store.loadTasks();
  const pending = tasks.filter((task) => task.status === "pending");
  const matching = kind === "epic" ? pending.filter((task) => isEpic(task, tasks)) : pending;
  return matching.map((task) => `${task.id}\t${clean(task.description)}`);
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
