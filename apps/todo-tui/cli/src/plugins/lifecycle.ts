import type { CommandContext, CommandSpec } from "../command-spec/types";
import type { ParsedInput } from "../command-spec/parsed-input";
import { collectDescendantIds, completeSubtrees, findTaskByIdOrDescription } from "../domain/task-tree";
import { UserInputError } from "../domain/user-input-error";

const DIM = "\u001B[2m";
const GREEN = "\u001B[32m";
const RESET = "\u001B[0m";

export const doneCommand: CommandSpec = {
  name: "done",
  summary: "Complete a task and everything under it.",
  group: "Change",
  args: [{ name: "id", kind: "pending-task-id", description: "Task to complete" }],
  details: ["Completed tasks leave the list and show up in `todo archive`."],
  examples: [{ command: "todo done 1" }, { command: "todo done #12" }],
  async run(input, { store, stdout }) {
    const id = input.arg("id");
    const tasks = await store.loadTasks();
    const task = tasks.find((candidate) => candidate.id === id);
    if (task === undefined) throw new UserInputError(`Task not found: ${id}`);
    const descendantIds = collectDescendantIds(tasks, [id]);
    const pendingSubtaskCount = tasks.filter((candidate) => descendantIds.has(candidate.id) && candidate.status === "pending").length;
    if (task.status === "completed" && pendingSubtaskCount === 0) {
      stdout.write(`${DIM}Task already completed${RESET}\n`);
      return;
    }

    completeSubtrees(tasks, [id]);
    await store.saveTasks(tasks);
    const subtaskText = pendingSubtaskCount > 0 ? ` with ${pendingSubtaskCount} subtask(s)` : "";
    stdout.write(`${GREEN}Task marked as completed${subtaskText}${RESET}\n`);
  },
};

export const editCommand: CommandSpec = {
  name: "edit",
  summary: "Replace a task description.",
  group: "Change",
  args: [
    { name: "id", kind: "task-id", description: "Task to edit" },
    { name: "description", kind: "text", variadic: true, description: "The new description" },
  ],
  details: ["Only the text changes. Due date, priority, subtasks and boards stay as they are."],
  examples: [{ command: "todo edit 1 buy oat milk" }, { command: "todo edit 7 -- -v flag is broken", note: "text that starts with a dash" }],
  async run(input, { store, stdout }) {
    const id = input.arg("id");
    const description = input.args("description").join(" ").trim();
    if (description.length === 0) throw new UserInputError("Usage: todo edit <id> <description…>");

    const tasks = await store.loadTasks();
    const task = tasks.find((candidate) => candidate.id === id);
    if (task === undefined) throw new UserInputError(`Task not found: ${id}`);

    task.description = description;
    task.updatedAt = Date.now();
    await store.saveTasks(tasks);
    stdout.write(`${GREEN}Updated task ${task.id}${RESET}\n`);
  },
};

export const hideCommand: CommandSpec = {
  name: "hide",
  summary: "Hide a task or epic from the shell panel and list.",
  group: "Change",
  args: [{ name: "task", kind: "task-selector", variadic: true, description: "Task ID, or the exact name of a pending task or epic" }],
  details: [
    "Only recognised as the first word: `todo fix hide button` still adds a task.",
    "A numeric target is a task ID; anything else must match a pending description exactly.",
    "Hidden tasks stay pending and keep their subtasks; `todo list --all` and `todo unhide` bring them back.",
    "Hiding is separate from boards: a hidden task stays out of every default view.",
  ],
  examples: [
    { command: "todo hide 33" },
    { command: "todo hide my-epic" },
    { command: "todo hide \"Website redesign\"", note: "quote names with spaces" },
  ],
  run: (input, context) => setHidden(input, context, true),
};

export const unhideCommand: CommandSpec = {
  name: "unhide",
  summary: "Show a hidden task or epic again.",
  group: "Change",
  args: [{ name: "task", kind: "task-selector", variadic: true, description: "Task ID, or the exact name of a hidden task or epic" }],
  examples: [{ command: "todo unhide 33" }, { command: "todo unhide my-epic" }],
  run: (input, context) => setHidden(input, context, false),
};

async function setHidden(input: ParsedInput, { store, stdout }: CommandContext, hidden: boolean): Promise<void> {
  const target = input.args("task").join(" ").trim();
  const tasks = await store.loadTasks();
  const task = findTaskByIdOrDescription(tasks, target);
  if ((task.hidden === true) === hidden) {
    stdout.write(`${DIM}Task #${task.id} is already ${hidden ? "hidden" : "visible"}${RESET}\n`);
    return;
  }

  if (hidden) task.hidden = true;
  else delete task.hidden;
  task.updatedAt = Date.now();
  await store.saveTasks(tasks);
  stdout.write(`${GREEN}${hidden ? "Hid" : "Unhid"} #${task.id}: ${task.description}${RESET}\n`);
}

export const lifecycleCommands: CommandSpec[] = [doneCommand, editCommand, hideCommand, unhideCommand];
