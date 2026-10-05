import type { CommandHandler, CommandHelp, CommandSummary, TodoApplication, TodoPlugin } from "./types";

interface RegisteredCommand {
  name: string;
  description: string;
  handler: CommandHandler;
  help: CommandHelp;
}

export class PluginRegistry implements TodoApplication {
  private readonly commands = new Map<string, RegisteredCommand>();

  use(plugin: TodoPlugin): void {
    plugin.register(this);
  }

  command(name: string, description: string, handler: CommandHandler, help: CommandHelp = {}): void {
    const registered: RegisteredCommand = { name, description, handler, help };
    for (const commandName of [name, ...(help.aliases ?? [])]) {
      if (this.commands.has(commandName)) {
        throw new Error(`Command already registered: ${commandName}`);
      }
      this.commands.set(commandName, registered);
    }
  }

  getCommand(name: string): RegisteredCommand | undefined {
    return this.commands.get(name);
  }

  /** Primary commands only; aliases are folded into each summary's `help.aliases`. */
  listCommands(): ReadonlyArray<CommandSummary> {
    return [...this.commands.entries()]
      .filter(([name, command]) => name === command.name)
      .map(([name, command]) => ({ name, description: command.description, help: command.help }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}
