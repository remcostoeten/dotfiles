import { createInterface } from "node:readline/promises";
import { correctCommandName, correctRejectedToken, type AutocorrectIo } from "./autocorrect";
import { UnknownTokenError } from "./domain/unknown-token-error";
import { builtInPlugins } from "./plugins/builtins";
import { findCommand } from "./plugins/help";
import { PluginRegistry } from "./plugins/registry";
import { TodoStore } from "./storage/todo-store";
import { UserInputError } from "./domain/user-input-error";
import { sendDueNotifications } from "./notifications";
import { createDefaultEffects } from "./scheduler/daemon";
import { processDueReminders } from "./scheduler/reminder-processor";
import { expandVisibilityAliases } from "./domain/visibility-alias";
import { formatCommandHelp } from "./presentation/help-format";
import type { CommandHandler } from "./plugins/types";

const HELP_FLAGS = new Set(["-h", "--help"]);

/** The daemon runs its own processing loop; catching up here first would only race with it. */
function isSchedulerInvocation(args: string[]): boolean {
  return args[0] === "due" && args[1] === "daemon";
}

export async function run(args: string[]): Promise<void> {
  const registry = new PluginRegistry();
  for (const plugin of builtInPlugins) registry.use(plugin);

  const store = new TodoStore();
  const config = await store.loadConfig();
  if (config.showNotificationsOnStartup && !isSchedulerInvocation(args)) {
    await sendDueNotifications(store);
    await processDueReminders(store, createDefaultEffects());
  }
  const io = createTerminalIo();
  let invocation = expandVisibilityAliases(args) ?? args;
  const requestedCommandName = invocation[0];
  let commandName = requestedCommandName !== undefined && HELP_FLAGS.has(requestedCommandName)
    ? "help"
    : requestedCommandName ?? (process.stdin.isTTY && process.stdout.isTTY ? "interactive" : "shell-display");
  let command = registry.getCommand(commandName);
  if (command === undefined && config.autocorrect) {
    const corrected = await correctCommandName(invocation, registry, store, io);
    if (corrected !== undefined && corrected[0] !== undefined) {
      invocation = corrected;
      commandName = corrected[0];
      command = registry.getCommand(commandName);
    }
  }

  const addCommand = registry.getCommand("add");
  const useImplicitAdd = command === undefined && invocation.length > 0 && !commandName.startsWith("--");
  const handler = command?.handler ?? (useImplicitAdd ? addCommand?.handler : undefined);
  if (handler === undefined) {
    process.stderr.write(`Unknown command: ${commandName}\nRun 'todo help' for usage.\n`);
    process.exitCode = 1;
    return;
  }

  if (command !== undefined && command.name !== "help" && command.help.ownHelp !== true && invocation.slice(1).some((argument) => HELP_FLAGS.has(argument))) {
    process.stdout.write(formatCommandHelp(findCommand(registry.listCommands(), command.name)));
    return;
  }

  let commandArgs = command === undefined ? invocation : invocation.slice(1);
  for (let attempt = 0; attempt < MAX_CORRECTIONS_PER_RUN; attempt += 1) {
    try {
      await runCommand(handler, commandArgs, registry, store);
      return;
    } catch (error: unknown) {
      if (!(error instanceof UserInputError)) throw error;
      if (error instanceof UnknownTokenError && config.autocorrect) {
        const corrected = await correctRejectedToken(error, command?.name, commandArgs, store, io);
        if (corrected !== undefined) {
          commandArgs = corrected;
          continue;
        }
      }
      process.stderr.write(`${error.message}\n`);
      if (command !== undefined && error.message.startsWith("Usage:")) {
        process.stderr.write(`Run 'todo ${command.name} --help' for details.\n`);
      }
      process.exitCode = 1;
      return;
    }
  }
}

const MAX_CORRECTIONS_PER_RUN = 4;

function createTerminalIo(): AutocorrectIo {
  return {
    async confirm(question) {
      if (!process.stdin.isTTY || !process.stdout.isTTY) return undefined;
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      try {
        const answer = (await prompt.question(question)).trim().toLowerCase();
        return answer === "" || answer === "y" || answer === "yes";
      } finally {
        prompt.close();
      }
    },
    notify(message) {
      process.stderr.write(message);
    },
  };
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
