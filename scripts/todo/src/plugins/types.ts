import type { TodoStore } from "../storage/todo-store";

export interface CommandContext {
  args: string[];
  store: TodoStore;
  stdout: Pick<typeof process.stdout, "write">;
  stderr: Pick<typeof process.stderr, "write">;
  commands: ReadonlyArray<{ name: string; description: string }>;
}

export type CommandHandler = (context: CommandContext) => Promise<void> | void;

export interface TodoPlugin {
  name: string;
  description: string;
  register(app: TodoApplication): void;
}

export interface TodoApplication {
  command(name: string, description: string, handler: CommandHandler): void;
}
