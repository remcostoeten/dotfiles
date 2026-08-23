import { builtInPlugins } from "./plugins/builtins";
import { PluginRegistry } from "./plugins/registry";
import { TodoStore } from "./storage/todo-store";
import { UserInputError } from "./domain/user-input-error";
import { sendDueNotifications } from "./notifications";
import type { CommandHandler } from "./plugins/types";

export async function run(args: string[]): Promise<void> {
  const registry = new PluginRegistry();
  for (const plugin of builtInPlugins) registry.use(plugin);

  const store = new TodoStore();
  const config = await store.loadConfig();
  if (config.showNotificationsOnStartup) await sendDueNotifications(store);
  const requestedCommandName = args[0];
  const commandName = requestedCommandName === "-h" || requestedCommandName === "--help"
    ? "help"
    : requestedCommandName ?? (process.stdin.isTTY && process.stdout.isTTY ? "interactive" : "shell-display");
  const command = registry.getCommand(commandName);
  const addCommand = registry.getCommand("add");
  const useImplicitAdd = command === undefined && args.length > 0 && !commandName.startsWith("--");
  const handler = command?.handler ?? (useImplicitAdd ? addCommand?.handler : undefined);
  if (handler === undefined) {
    process.stderr.write(`Unknown command: ${commandName}\nRun 'todo help' for usage.\n`);
    process.exitCode = 1;
    return;
  }

  try {
    await runCommand(handler, command === undefined ? args : args.slice(1), registry, store);
  } catch (error: unknown) {
    if (!(error instanceof UserInputError)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

async function runCommand(handler: CommandHandler, args: string[], registry: PluginRegistry, store: TodoStore): Promise<void> {
  await handler({
    args,
    store,
    stdout: process.stdout,
    stderr: process.stderr,
    commands: registry.listCommands(),
  });
}
