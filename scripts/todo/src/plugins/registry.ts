import type { CommandHandler, TodoApplication, TodoPlugin } from "./types";

interface RegisteredCommand {
  description: string;
  handler: CommandHandler;
}

export class PluginRegistry implements TodoApplication {
  private readonly commands = new Map<string, RegisteredCommand>();

  use(plugin: TodoPlugin): void {
    plugin.register(this);
  }

  command(name: string, description: string, handler: CommandHandler): void {
    if (this.commands.has(name)) {
      throw new Error(`Command already registered: ${name}`);
    }
    this.commands.set(name, { description, handler });
  }

  getCommand(name: string): RegisteredCommand | undefined {
    return this.commands.get(name);
  }

  listCommands(): ReadonlyArray<{ name: string; description: string }> {
    return [...this.commands.entries()]
      .map(([name, command]) => ({ name, description: command.description }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}
