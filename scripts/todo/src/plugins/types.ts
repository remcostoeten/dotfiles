import type { ArgumentShape } from "../domain/autocorrect";
import type { TodoStore } from "../storage/todo-store";

export interface CommandOption {
  flag: string;
  description: string;
}

export interface CommandExample {
  command: string;
  note?: string;
}

export type CommandGroup = "Create" | "View" | "Change" | "Epic visibility" | "Remove" | "Settings";

export interface CommandHelp {
  group?: CommandGroup;
  /** Extra invokable names for the command; each one is registered in the command table. */
  aliases?: string[];
  /** Shorthand spellings shown in help but never registered as command names. */
  aliasNotes?: string[];
  /** The command renders its own contextual help, so the CLI must not intercept -h/--help for it. */
  ownHelp?: boolean;
  usage?: string[];
  details?: string[];
  options?: CommandOption[];
  examples?: CommandExample[];
  /** What the arguments after the command name look like; guards typo correction of the command name. Defaults to "none". */
  positional?: ArgumentShape;
}

export interface CommandSummary {
  name: string;
  description: string;
  help: CommandHelp;
}

export interface CommandContext {
  args: string[];
  store: TodoStore;
  stdout: Pick<typeof process.stdout, "write">;
  stderr: Pick<typeof process.stderr, "write">;
  commands: ReadonlyArray<CommandSummary>;
}

export type CommandHandler = (context: CommandContext) => Promise<void> | void;

export interface TodoPlugin {
  name: string;
  description: string;
  register(app: TodoApplication): void;
}

export interface TodoApplication {
  command(name: string, description: string, handler: CommandHandler, help?: CommandHelp): void;
}
