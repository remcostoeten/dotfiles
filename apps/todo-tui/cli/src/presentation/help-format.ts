import { commandLine, formatArg, formatFlag, formatUsage, visibleFlags } from "../command-spec/tree";
import type { CommandGroup, CommandSpec, HelpSection } from "../command-spec/types";
import { VISIBILITY_ALIASES } from "../domain/visibility-alias";

const GROUP_ORDER: CommandGroup[] = ["Create", "Boards", "View", "Change", "Epic visibility", "Remove", "Settings"];
const INDENT = "  ";

interface Palette {
  reset: string;
  bold: string;
  dim: string;
  accent: string;
  heading: string;
  command: string;
  placeholder: string;
  flag: string;
}

const COLOR_PALETTE: Palette = {
  reset: "\u001B[0m",
  bold: "\u001B[1m",
  dim: "\u001B[2m",
  accent: "\u001B[38;5;208m",
  heading: "\u001B[38;5;147m",
  command: "\u001B[38;5;114m",
  placeholder: "\u001B[38;5;116m",
  flag: "\u001B[38;5;229m",
};

const PLAIN_PALETTE: Palette = {
  reset: "",
  bold: "",
  dim: "",
  accent: "",
  heading: "",
  command: "",
  placeholder: "",
  flag: "",
};

export function supportsColor(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) return true;
  return process.stdout.isTTY === true;
}

/** Renders the `todo help` overview: banner, generic usage, and commands grouped by purpose. */
export function formatHelpOverview(root: CommandSpec, useColor = supportsColor()): string {
  const p = useColor ? COLOR_PALETTE : PLAIN_PALETTE;
  const commands = visibleChildren(root);
  const lines: string[] = [""];
  lines.push(`${INDENT}${p.accent}${p.bold}✓ todo${p.reset}  ${p.dim}·${p.reset}  tasks, epics and boards from the shell`);
  lines.push("");
  lines.push(heading("Usage", p));
  lines.push(`${INDENT}${INDENT}${highlightUsage("todo <description>[, <description>] [--due <time>] [--priority <level>] [--later] [--off-board]", p)}`);
  lines.push(`${INDENT}${INDENT}${highlightUsage("todo <command> [arguments]", p)}`);
  lines.push(`${INDENT}${INDENT}${highlightUsage("todo <command> --help", p)}`);

  const width = Math.max(...commands.map((command) => formatCommandLabel(command).length));
  for (const group of groupCommands(commands)) {
    lines.push("");
    lines.push(heading(group.name, p));
    for (const command of group.commands) {
      const label = formatCommandLabel(command);
      const padding = " ".repeat(width - label.length + 3);
      lines.push(`${INDENT}${INDENT}${colorCommandLabel(command, p)}${padding}${command.summary}`);
    }
  }

  lines.push("");
  lines.push(heading("Aliases", p));
  const aliasWidth = Math.max(...VISIBILITY_ALIASES.map((alias) => alias.alias.length));
  for (const { alias, meaning } of VISIBILITY_ALIASES) {
    const padding = " ".repeat(aliasWidth - alias.length + 3);
    lines.push(`${INDENT}${INDENT}${highlightInline(alias, p)}${padding}${p.dim}${meaning}${p.reset}`);
  }

  lines.push("");
  lines.push(`${INDENT}${p.dim}Plain text is added as a task. Run${p.reset} ${p.command}todo <command> --help${p.reset} ${p.dim}for details on any command.${p.reset}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

/** Renders the help page of one node, e.g. `todo board add --help`. */
export function formatCommandHelp(path: ReadonlyArray<CommandSpec>, useColor = supportsColor()): string {
  const node = path[path.length - 1];
  if (node === undefined) throw new Error("formatCommandHelp needs a command path");
  const p = useColor ? COLOR_PALETTE : PLAIN_PALETTE;
  const lines: string[] = [""];
  lines.push(`${INDENT}${p.accent}${p.bold}${commandLine(path)}${p.reset}  ${p.dim}·${p.reset}  ${node.summary}`);
  if (node.aliases !== undefined && node.aliases.length > 0) {
    lines.push(`${INDENT}${p.dim}aliases:${p.reset} ${node.aliases.map((alias) => `${p.command}${alias}${p.reset}`).join(`${p.dim},${p.reset} `)}`);
  }

  lines.push("");
  lines.push(heading("Usage", p));
  for (const usage of formatUsage(path)) lines.push(`${INDENT}${INDENT}${highlightUsage(usage, p)}`);

  const args = node.args ?? [];
  pushTable(lines, "Arguments", args.map((arg) => ({ left: formatArg(arg), right: arg.description })), p);

  const children = visibleChildren(node);
  pushTable(lines, "Commands", children.map((child) => ({
    left: formatCommandLabel(child),
    right: `${child.summary}${child.name === node.defaultSubcommand ? " (default)" : ""}`,
  })), p);

  pushTable(lines, "Options", visibleFlags(node).map((flag) => ({
    left: [formatFlag(flag), ...(flag.aliases ?? []).map((alias) => `--${alias}`), ...(flag.short === undefined ? [] : [`-${flag.short}`])].join(", "),
    right: flag.description,
  })), p);

  if (node.details !== undefined && node.details.length > 0) {
    lines.push("");
    lines.push(heading("Details", p));
    for (const detail of node.details) lines.push(`${INDENT}${INDENT}${highlightInline(detail, p)}`);
  }

  for (const section of node.sections ?? []) pushSection(lines, section, p);

  if (node.examples !== undefined && node.examples.length > 0) {
    lines.push("");
    lines.push(heading("Examples", p));
    const width = Math.max(...node.examples.map((example) => example.command.length));
    for (const example of node.examples) {
      const note = example.note === undefined ? "" : `${" ".repeat(width - example.command.length + 3)}${p.dim}# ${example.note}${p.reset}`;
      lines.push(`${INDENT}${INDENT}${p.dim}$${p.reset} ${highlightUsage(example.command, p)}${note}`);
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function pushTable(lines: string[], title: string, rows: Array<{ left: string; right: string }>, p: Palette): void {
  if (rows.length === 0) return;
  lines.push("");
  lines.push(heading(title, p));
  const width = Math.max(...rows.map((row) => row.left.length));
  for (const row of rows) {
    const padding = " ".repeat(width - row.left.length + 3);
    lines.push(`${INDENT}${INDENT}${highlightInline(row.left, p)}${padding}${highlightInline(row.right, p)}`);
  }
}

function pushSection(lines: string[], section: HelpSection, p: Palette): void {
  if (section.rows.length === 0) return;
  lines.push("");
  lines.push(heading(section.heading, p));
  const width = Math.max(...section.rows.map((row) => (row.right === undefined ? 0 : row.left.length)));
  for (const row of section.rows) {
    if (row.right === undefined) {
      lines.push(`${INDENT}${INDENT}${highlightUsage(row.left, p)}`);
      continue;
    }
    const padding = " ".repeat(width - row.left.length + 3);
    lines.push(`${INDENT}${INDENT}${highlightInline(row.left, p)}${padding}${p.dim}${row.right}${p.reset}`);
  }
}

export function visibleChildren(node: CommandSpec): CommandSpec[] {
  return (node.subcommands ?? []).filter((child) => child.hidden !== true);
}

export function formatCommandLabel(command: CommandSpec): string {
  const aliases = command.aliases ?? [];
  return aliases.length === 0 ? command.name : `${command.name}, ${aliases.join(", ")}`;
}

function colorCommandLabel(command: CommandSpec, p: Palette): string {
  const aliases = command.aliases ?? [];
  const name = `${p.command}${p.bold}${command.name}${p.reset}`;
  return aliases.length === 0 ? name : `${name}${p.dim}, ${aliases.join(", ")}${p.reset}`;
}

function groupCommands(commands: ReadonlyArray<CommandSpec>): Array<{ name: string; commands: CommandSpec[] }> {
  const groups = new Map<CommandGroup, CommandSpec[]>(GROUP_ORDER.map((group) => [group, []]));
  for (const command of commands) groups.get(command.group ?? "Settings")?.push(command);
  return [...groups.entries()].filter(([, members]) => members.length > 0).map(([name, members]) => ({ name, commands: members }));
}

function heading(text: string, p: Palette): string {
  return `${INDENT}${p.heading}${p.bold}${text.toUpperCase()}${p.reset}`;
}

function highlightUsage(usage: string, p: Palette): string {
  const tokens = usage.split(" ");
  return tokens
    .map((token, index) => {
      if (index === 0 && token === "todo") return `${p.dim}todo${p.reset}`;
      if (index === 1 && tokens[0] === "todo" && /^[a-z-]+$/.test(token)) return `${p.command}${token}${p.reset}`;
      return highlightInline(token, p);
    })
    .join(" ");
}

function highlightInline(text: string, p: Palette): string {
  return text
    .replace(/<[^>]+>/g, (match) => `${p.placeholder}${match}${p.reset}`)
    .replace(/(^|[\s[(|,])(--?[a-z][\w-]*)/g, (_match, lead: string, flag: string) => `${lead}${p.flag}${flag}${p.reset}`)
    .replace(/`([^`]+)`/g, (_match, code: string) => `${p.command}${code}${p.reset}`);
}
