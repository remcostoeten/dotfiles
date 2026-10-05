import { collectDescendantIds, completeSubtrees, findTaskByIdOrDescription } from "../domain/task-tree";
import { UserInputError } from "../domain/user-input-error";
import { formatTaskForDisplay } from "../presentation/task-format";
import type { CommandContext, TodoPlugin } from "./types";

const DIM = "\u001B[2m";
const GREEN = "\u001B[32m";
const RESET = "\u001B[0m";

export const lifecyclePlugin: TodoPlugin = {
  name: "lifecycle",
  description: "Completes, edits, and archives tasks.",
  register(app) {
    app.command("done", "Complete a task and everything under it.", async ({ args, store, stdout }) => {
      const id = requireTaskId(args, "Usage: todo done <id>").replace(/^#/, "");
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
    }, {
      group: "Change",
      positional: "task-id",
      usage: ["todo done <id>"],
      details: ["Completed tasks leave the list and show up in `todo archive`."],
      examples: [{ command: "todo done 1" }, { command: "todo done #12" }],
    });

    app.command("edit", "Replace a task description.", async ({ args, store, stdout }) => {
      const id = requireFirstArgument(args, "Usage: todo edit <id> <description>");
      const description = args.slice(1).join(" ").trim();
      if (description.length === 0) throw new UserInputError("Usage: todo edit <id> <description>");

      const tasks = await store.loadTasks();
      const task = tasks.find((candidate) => candidate.id === id);
      if (task === undefined) throw new UserInputError(`Task not found: ${id}`);

      task.description = description;
      task.updatedAt = Date.now();
      await store.saveTasks(tasks);
      stdout.write(`${GREEN}Updated task ${task.id}${RESET}\n`);
    }, {
      group: "Change",
      positional: "task-id",
      usage: ["todo edit <id> <description>"],
      examples: [{ command: "todo edit 1 buy oat milk" }],
    });

    app.command("hide", "Hide a task or epic from the shell panel and list.", (context) => setHidden(context, true), {
      group: "Change",
      positional: "any",
      usage: ["todo hide <id>", "todo hide <epic or task name>"],
      details: [
        "Only recognised as the first word: `todo fix hide button` still adds a task.",
        "A numeric target is a task ID; anything else must match a pending description exactly.",
        "Hidden tasks stay pending and keep their subtasks; `todo list --all` and `todo unhide` bring them back.",
      ],
      examples: [
        { command: "todo hide 33" },
        { command: "todo hide my-epic" },
        { command: "todo hide \"Website redesign\"", note: "quote names with spaces" },
      ],
    });

    app.command("unhide", "Show a hidden task or epic again.", (context) => setHidden(context, false), {
      group: "Change",
      positional: "any",
      usage: ["todo unhide <id>", "todo unhide <epic or task name>"],
      examples: [{ command: "todo unhide 33" }, { command: "todo unhide my-epic" }],
    });

    app.command("archive", "List completed tasks, newest first.", async ({ args, store, stdout }) => {
      if (args.length > 0) throw new UserInputError("Usage: todo archive");

      const tasks = await store.loadTasks();
      const archivedTasks = tasks.filter((task) => task.status === "completed").sort((left, right) => right.updatedAt - left.updatedAt);
      if (archivedTasks.length === 0) {
        stdout.write(`${DIM}No archived tasks found${RESET}\n`);
        return;
      }

      for (const task of archivedTasks) stdout.write(`${formatTaskForDisplay(task)}\n`);
    }, {
      group: "View",
      usage: ["todo archive"],
    });
  },
};

async function setHidden({ args, store, stdout }: CommandContext, hidden: boolean): Promise<void> {
  const verb = hidden ? "hide" : "unhide";
  const target = args.join(" ").trim();
  if (target.length === 0) throw new UserInputError(`Usage: todo ${verb} <id|name>`);

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

function requireTaskId(args: string[], usage: string): string {
  const id = args[0];
  if (args.length !== 1 || id === undefined || id.trim().length === 0) throw new UserInputError(usage);
  return id;
}

function requireFirstArgument(args: string[], usage: string): string {
  const value = args[0];
  if (value === undefined || value.trim().length === 0) throw new UserInputError(usage);
  return value;
}
