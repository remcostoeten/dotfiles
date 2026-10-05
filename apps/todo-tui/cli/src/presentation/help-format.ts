import { VISIBILITY_ALIASES } from "../domain/visibility-alias";
import type { CommandGroup, CommandHelp, CommandSummary } from "../plugins/types";

const GROUP_ORDER: CommandGroup[] = ["Create", "View", "Change", "Epic visibility", "Remove", "Settings"];
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
export function formatHelpOverview(commands: ReadonlyArray<CommandSummary>, useColor = supportsColor()): string {
  const p = useColor ? COLOR_PALETTE : PLAIN_PALETTE;
  const lines: string[] = [""];
  lines.push(`${INDENT}${p.accent}${p.bold}✓ todo${p.reset}  ${p.dim}·${p.reset}  tasks, epics and subtasks from the shell`);
  lines.push("");
  lines.push(heading("Usage", p));
  lines.push(`${INDENT}${INDENT}${highlightUsage("todo <description>[, <description>] [--due <time>] [--priority <level>]", p)}`);
  lines.push(`${INDENT}${INDENT}${highlightUsage("todo <command> [arguments]", p)}`);
  lines.push(`${INDENT}${INDENT}${highlightUsage("todo <command> --help", p)}`);

  const width = Math.max(...commands.map((command) => formatCommandLabel(command).length));
  for (const group of groupCommands(commands)) {
    lines.push("");
    lines.push(heading(group.name, p));
    for (const command of group.commands) {
      const label = formatCommandLabel(command);
      const padding = " ".repeat(width - label.length + 3);
      lines.push(`${INDENT}${INDENT}${colorCommandLabel(command, p)}${padding}${command.description}`);
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

/** Renders `todo <command> --help`. */
export function formatCommandHelp(command: CommandSummary, useColor = supportsColor()): string {
  const p = useColor ? COLOR_PALETTE : PLAIN_PALETTE;
  const help = command.help;
  const lines: string[] = [""];
  lines.push(`${INDENT}${p.accent}${p.bold}todo ${command.name}${p.reset}  ${p.dim}·${p.reset}  ${command.description}`);
  if (help.aliases !== undefined && help.aliases.length > 0) {
    lines.push(`${INDENT}${p.dim}aliases:${p.reset} ${help.aliases.map((alias) => `${p.command}${alias}${p.reset}`).join(`${p.dim},${p.reset} `)}`);
  }

  lines.push("");
  lines.push(heading("Usage", p));
  for (const usage of help.usage ?? [`todo ${command.name}`]) {
    lines.push(`${INDENT}${INDENT}${highlightUsage(usage, p)}`);
  }

  if (help.aliasNotes !== undefined && help.aliasNotes.length > 0) {
    lines.push("");
    lines.push(heading("Aliases", p));
    for (const alias of help.aliasNotes) lines.push(`${INDENT}${INDENT}${highlightInline(alias, p)}`);
  }

  if (help.details !== undefined && help.details.length > 0) {
    lines.push("");
    lines.push(heading("Details", p));
    for (const detail of help.details) lines.push(`${INDENT}${INDENT}${highlightInline(detail, p)}`);
  }

  if (help.options !== undefined && help.options.length > 0) {
    lines.push("");
    lines.push(heading("Options", p));
    const width = Math.max(...help.options.map((option) => option.flag.length));
    for (const option of help.options) {
      const padding = " ".repeat(width - option.flag.length + 3);
      lines.push(`${INDENT}${INDENT}${highlightInline(option.flag, p)}${padding}${highlightInline(option.description, p)}`);
    }
  }

  if (help.examples !== undefined && help.examples.length > 0) {
    lines.push("");
    lines.push(heading("Examples", p));
    const width = Math.max(...help.examples.map((example) => example.command.length));
    for (const example of help.examples) {
      const note = example.note === undefined ? "" : `${" ".repeat(width - example.command.length + 3)}${p.dim}# ${example.note}${p.reset}`;
      lines.push(`${INDENT}${INDENT}${p.dim}$${p.reset} ${highlightUsage(example.command, p)}${note}`);
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export interface HelpRow {
  left: string;
  right?: string;
}

export interface HelpSection {
  heading: string;
  rows: HelpRow[];
}

/**
 * Renders an ad-hoc help page in the same visual language as `todo <command> --help`, for
 * commands whose subcommands each need their own contextual page.
 */
export function formatHelpSections(title: string, subtitle: string, sections: HelpSection[], useColor = supportsColor()): string {
  const p = useColor ? COLOR_PALETTE : PLAIN_PALETTE;
  const lines: string[] = [""];
  lines.push(`${INDENT}${p.accent}${p.bold}${title}${p.reset}  ${p.dim}·${p.reset}  ${subtitle}`);

  for (const section of sections) {
    if (section.rows.length === 0) continue;
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

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function formatCommandLabel(command: CommandSummary): string {
  const aliases = command.help.aliases ?? [];
  return aliases.length === 0 ? command.name : `${command.name}, ${aliases.join(", ")}`;
}

function colorCommandLabel(command: CommandSummary, p: Palette): string {
  const aliases = command.help.aliases ?? [];
  const name = `${p.command}${p.bold}${command.name}${p.reset}`;
  return aliases.length === 0 ? name : `${name}${p.dim}, ${aliases.join(", ")}${p.reset}`;
}

function heading(text: string, p: Palette): string {
  return `${INDENT}${p.heading}${p.bold}${text.toUpperCase()}${p.reset}`;
}

function groupCommands(commands: ReadonlyArray<CommandSummary>): Array<{ name: string; commands: CommandSummary[] }> {
  const groups = new Map<CommandGroup, CommandSummary[]>(GROUP_ORDER.map((group) => [group, []]));
  for (const command of commands) {
    groups.get(command.help.group ?? "Settings")?.push(command);
  }
  return [...groups.entries()].filter(([, members]) => members.length > 0).map(([name, members]) => ({ name, commands: members }));
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
