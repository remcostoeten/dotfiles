import { emitKeypressEvents } from "node:readline";
import { UnknownTokenError } from "../domain/unknown-token-error";
import { HelpBrowser, type HelpKey, type HelpTerminal } from "../presentation/help-browser";
import { buildHelpDocument } from "../presentation/help-document";
import { formatCommandHelp, formatHelpOverview, supportsColor } from "../presentation/help-format";
import type { CommandSummary, TodoPlugin } from "./types";

const PLAIN_FLAG = "--plain";

export const helpPlugin: TodoPlugin = {
  name: "help",
  description: "Browse the searchable help, or show details for one command.",
  register(app) {
    app.command(
      "help",
      "Browse the searchable help, or show details for one command.",
      async ({ args, stdout, commands }) => {
        const [name] = args.filter((argument) => argument !== PLAIN_FLAG);
        if (name !== undefined) {
          stdout.write(formatCommandHelp(findCommand(commands, name)));
          return;
        }
        if (args.includes(PLAIN_FLAG) || !isInteractiveTerminal()) {
          stdout.write(formatHelpOverview(commands));
          return;
        }
        await browseHelp(commands);
      },
      {
        group: "Settings",
        usage: ["todo help", "todo help <command>", "todo help --plain", "todo <command> --help"],
        details: [
          "With no arguments in a terminal this opens the searchable help browser:",
          "j/k or the arrow keys scroll, ^d/^u page, g/G jump to the ends, / searches,",
          "Enter runs the search, n and N step through the matches, and q quits.",
          "Piped or redirected output stays plain, as does `todo help --plain`.",
        ],
        options: [{ flag: "--plain", description: "Print the overview instead of opening the browser" }],
        examples: [{ command: "todo help rm" }, { command: "todo sub --help" }, { command: "todo help --plain | less" }],
        positional: "any",
      },
    );
  },
};

export function findCommand(commands: ReadonlyArray<CommandSummary>, name: string): CommandSummary {
  const command = commands.find((candidate) => candidate.name === name || candidate.help.aliases?.includes(name));
  if (command === undefined) {
    const names = commands.flatMap((candidate) => [candidate.name, ...(candidate.help.aliases ?? [])]);
    throw new UnknownTokenError(`Unknown command: ${name}\nRun 'todo help' for the list of commands.`, name, names, "command");
  }
  return command;
}

function isInteractiveTerminal(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

async function browseHelp(commands: ReadonlyArray<CommandSummary>): Promise<void> {
  const terminal: HelpTerminal = {
    write(text) {
      process.stdout.write(text);
    },
    get columns() {
      return process.stdout.columns ?? 80;
    },
    get rows() {
      return process.stdout.rows ?? 24;
    },
  };

  const browser = new HelpBrowser(buildHelpDocument(commands, supportsColor()), terminal);
  const wasRaw = process.stdin.isRaw;
  const draw = (): void => {
    terminal.write(`\u001B[H${browser.render().split("\n").join("\u001B[K\n")}\u001B[K\u001B[J`);
  };

  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  terminal.write("\u001B[?1049h\u001B[?1007h\u001B[?25l");

  await new Promise<void>((resolve) => {
    const handleKeypress = (_character: string, key: HelpKey | undefined): void => {
      if (key !== undefined) browser.handleKey(key);
      if (browser.closed) {
        process.stdin.off("keypress", handleKeypress);
        process.stdout.off("resize", draw);
        resolve();
        return;
      }
      draw();
    };
    process.stdin.on("keypress", handleKeypress);
    process.stdout.on("resize", draw);
    draw();
  });

  terminal.write("\u001B[?25h\u001B[?1007l\u001B[?1049l");
  if (!wasRaw) process.stdin.setRawMode(false);
  process.stdin.pause();
}
