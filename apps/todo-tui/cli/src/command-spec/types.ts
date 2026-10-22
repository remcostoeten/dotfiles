import type { TodoStore } from "../storage/todo-store";
import type { ParsedInput } from "./parsed-input";

export type CommandGroup = "Create" | "Boards" | "View" | "Change" | "Epic visibility" | "Remove" | "Settings";

export type ValueKind =
  | "text"
  | "task-id"
  | "pending-task-id"
  | "task-ids"
  | "task-selector"
  | "parent-id"
  | "epic-id"
  | "epic-selector"
  | "board-name"
  | "duration"
  | "due-time"
  | "priority"
  | "count-or-all"
  | "minutes"
  | "archive-ref"
  | "path"
  | "shell-command"
  | { oneOf: string[] };

export interface ArgSpec {
  name: string;
  kind: ValueKind;
  variadic?: boolean;
  optional?: boolean;
  description: string;
}

export interface FlagSpec {
  name: string;
  short?: string;
  aliases?: string[];
  value?: ValueKind;
  /** The value swallows following words until the next flag, so `--due next week` needs no quotes. */
  greedy?: boolean;
  /** Left out of help and completions. */
  hidden?: boolean;
  description: string;
}

export interface CommandExample {
  command: string;
  note?: string;
}

export interface HelpRow {
  left: string;
  right?: string;
}

export interface HelpSection {
  heading: string;
  rows: HelpRow[];
}

export interface CommandContext {
  store: TodoStore;
  stdout: Pick<typeof process.stdout, "write">;
  stderr: Pick<typeof process.stderr, "write">;
  root: CommandSpec;
}

export type CommandRun = (input: ParsedInput, context: CommandContext) => Promise<void> | void;

export interface CommandSpec {
  name: string;
  aliases?: string[];
  summary: string;
  group?: CommandGroup;
  details?: string[];
  /** Extra reference tables shown after the details, for commands with a syntax of their own. */
  sections?: HelpSection[];
  examples?: CommandExample[];
  args?: ArgSpec[];
  flags?: FlagSpec[];
  subcommands?: CommandSpec[];
  defaultSubcommand?: string;
  /** What an unknown child is called in errors, e.g. `setting` for config keys. */
  subcommandNoun?: string;
  /** Left out of the overview, completions and help browser. */
  hidden?: boolean;
  run?: CommandRun;
}
