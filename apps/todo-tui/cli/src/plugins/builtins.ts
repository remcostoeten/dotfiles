import type { CommandSpec } from "../command-spec/types";
import { addCommand } from "./add";
import { archiveCommand } from "./archive";
import { boardCommand, focusCommand } from "./board";
import { completionsCommand } from "./completions";
import { configCommand } from "./config";
import { dueCommand } from "./due";
import { epicCommands } from "./epic";
import { helpCommand } from "./help";
import { interactiveCommand } from "./interactive";
import { lifecycleCommands } from "./lifecycle";
import { rmCommand } from "./remove";
import { listCommand, panelCommand } from "./tasks";
import { typosCommand } from "./typos";
import { snoozeCommand, undoCommand } from "./undo";
import { visibilityCommands } from "./visibility";

/** The root of the command tree: every top-level command in the order the overview lists them within a group. */
export function createCommandTree(): CommandSpec {
  return {
    name: "todo",
    summary: "tasks, epics and boards from the shell",
    subcommands: [
      addCommand,
      ...epicCommands.filter((command) => command.group === "Create"),
      boardCommand,
      focusCommand,
      listCommand,
      panelCommand,
      archiveCommand,
      interactiveCommand,
      ...lifecycleCommands,
      dueCommand,
      ...epicCommands.filter((command) => command.group !== "Create"),
      snoozeCommand,
      ...visibilityCommands,
      rmCommand,
      undoCommand,
      configCommand,
      helpCommand,
      typosCommand,
      completionsCommand,
    ],
  };
}
