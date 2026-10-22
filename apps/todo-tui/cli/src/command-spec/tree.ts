import type { ArgSpec, CommandSpec, FlagSpec, ValueKind } from "./types";

export const HELP_FLAGS: ReadonlySet<string> = new Set(["-h", "--help"]);

export function findChild(node: CommandSpec, token: string): CommandSpec | undefined {
  return node.subcommands?.find((child) => child.name === token || child.aliases?.includes(token) === true);
}

/** Names and aliases of the visible children, used as typo candidates. */
export function childNames(node: CommandSpec): string[] {
  return (node.subcommands ?? []).filter((child) => child.hidden !== true).flatMap((child) => [child.name, ...(child.aliases ?? [])]);
}

export function flagSpellings(flag: FlagSpec): string[] {
  return [`--${flag.name}`, ...(flag.aliases ?? []).map((alias) => `--${alias}`), ...(flag.short === undefined ? [] : [`-${flag.short}`])];
}

export function findFlag(node: CommandSpec, spelling: string): FlagSpec | undefined {
  return node.flags?.find((flag) => flagSpellings(flag).includes(spelling));
}

export function visibleFlags(node: CommandSpec): FlagSpec[] {
  return (node.flags ?? []).filter((flag) => flag.hidden !== true);
}

export interface SpecVisit {
  node: CommandSpec;
  path: CommandSpec[];
}

/** Every node below the root, depth first, with the chain of nodes that leads to it. */
export function walkSpecs(root: CommandSpec): SpecVisit[] {
  const visits: SpecVisit[] = [];
  function visit(node: CommandSpec, path: CommandSpec[]): void {
    for (const child of node.subcommands ?? []) {
      const childPath = [...path, child];
      visits.push({ node: child, path: childPath });
      visit(child, childPath);
    }
  }
  visit(root, []);
  return visits;
}

export function commandLine(path: ReadonlyArray<CommandSpec>): string {
  return ["todo", ...path.map((node) => node.name)].join(" ");
}

export function valuePlaceholder(kind: ValueKind, fallback: string): string {
  if (typeof kind === "object") return kind.oneOf.join("|");
  switch (kind) {
    case "duration":
      return "dur";
    case "board-name":
      return "name";
    case "due-time":
      return "time";
    case "priority":
      return "level";
    case "count-or-all":
      return "n|all";
    case "task-id":
    case "pending-task-id":
    case "epic-id":
      return "id";
    case "parent-id":
      return "id|root";
    case "minutes":
      return "min,…";
    default:
      return fallback;
  }
}

export function formatArg(arg: ArgSpec): string {
  const label = `${typeof arg.kind === "object" ? arg.kind.oneOf.join("|") : arg.name}${arg.variadic === true ? "…" : ""}`;
  return arg.optional === true ? `[${label}]` : `<${label}>`;
}

export function formatFlag(flag: FlagSpec): string {
  const spelling = `--${flag.name}`;
  return flag.value === undefined ? spelling : `${spelling} <${valuePlaceholder(flag.value, flag.name)}>`;
}

const MAX_INLINE_FLAGS = 4;

/** Generated usage lines for a node: its own invocation and, when it has children, the subcommand form. */
export function formatUsage(path: ReadonlyArray<CommandSpec>): string[] {
  const node = path[path.length - 1];
  if (node === undefined) return ["todo <command> [arguments]"];
  const base = commandLine(path);
  const lines: string[] = [];
  if (node.run !== undefined || node.defaultSubcommand !== undefined) {
    const args = (node.args ?? []).map(formatArg);
    const flags = visibleFlags(node);
    const flagText = flags.length > MAX_INLINE_FLAGS ? ["[options]"] : flags.map((flag) => `[${formatFlag(flag)}]`);
    lines.push([base, ...args, ...flagText].join(" "));
  }
  if ((node.subcommands ?? []).some((child) => child.hidden !== true)) lines.push(`${base} <command>`);
  return lines;
}
