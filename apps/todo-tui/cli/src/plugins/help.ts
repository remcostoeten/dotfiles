import { emitKeypressEvents } from "node:readline";
import { UnknownTokenError } from "../domain/unknown-token-error";
import { HelpBrowser, type HelpKey, type HelpTerminal } from "../presentation/help-browser";
import { buildHelpDocument } from "../presentation/help-document";
import { formatCommandHelp, formatHelpOverview, supportsColor } from "../presentation/help-format";
import { childNames, findChild } from "../command-spec/tree";
import type { CommandSpec } from "../command-spec/types";

export const helpCommand: CommandSpec = {
  name: "help",
  summary: "Browse the searchable help, or show help for one command.",
  group: "Settings",
  args: [{ name: "command", kind: "text", variadic: true, optional: true, description: "Command path, e.g. board add" }],
  flags: [{ name: "plain", description: "Print the overview instead of opening the browser" }],
  details: [
    "With no arguments in a terminal this opens the searchable help browser:",
    "j/k or the arrow keys scroll, ^d/^u page, g/G jump to the ends, / searches,",
    "Enter runs the search, n and N step through the matches, and q quits.",
    "Piped or redirected output stays plain, as does `todo help --plain`.",
  ],
  examples: [{ command: "todo help rm" }, { command: "todo help board later" }, { command: "todo board add --help" }, { command: "todo help --plain | less" }],
  async run(input, { root, stdout }) {
    const words = input.args("command");
    if (words.length > 0) {
      stdout.write(formatCommandHelp(resolveHelpPath(root, words)));
      return;
    }
    if (input.flag("plain") || !isInteractiveTerminal()) {
      stdout.write(formatHelpOverview(root));
      return;
    }
    await browseHelp(root);
  },
};

/** Follows command names (and aliases) down the tree, rejecting unknown ones with typo candidates. */
export function resolveHelpPath(root: CommandSpec, words: ReadonlyArray<string>): CommandSpec[] {
  const path: CommandSpec[] = [];
  let node = root;
  for (const word of words) {
    const child = findChild(node, word);
    if (child === undefined) {
      const noun = path.length === 0 ? "command" : node.subcommandNoun ?? "subcommand";
      throw new UnknownTokenError(`Unknown ${noun}: ${word}`, word, childNames(node), noun === "setting" ? "setting" : "command");
    }
    path.push(child);
    node = child;
  }
  return path;
}

function isInteractiveTerminal(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

async function browseHelp(root: CommandSpec): Promise<void> {
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

  const browser = new HelpBrowser(buildHelpDocument(root, supportsColor()), terminal);
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
