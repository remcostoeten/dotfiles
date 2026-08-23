import type { TodoPlugin } from "./types";

export const helpPlugin: TodoPlugin = {
  name: "help",
  description: "Lists available commands.",
  register(app) {
    app.command("help", "Show available commands.", ({ stdout, commands }) => {
      stdout.write("Todo (TypeScript rewrite)\n\nCommands:\n");
      for (const command of commands) {
        stdout.write(`  ${command.name.padEnd(16)} ${command.description}\n`);
      }
    });
  },
};
