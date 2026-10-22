import { parseDuration } from "../domain/duration";
import { findClosest } from "../domain/fuzzy-match";
import type { Task } from "../domain/task";
import { isEpic } from "../domain/task-tree";
import { UnknownTokenError } from "../domain/unknown-token-error";
import { UserInputError } from "../domain/user-input-error";
import { ParsedInput } from "./parsed-input";
import { childNames, commandLine, findChild, findFlag, flagSpellings, formatUsage, HELP_FLAGS, visibleFlags } from "./tree";
import type { ArgSpec, CommandSpec, ValueKind } from "./types";

export interface ParseOptions {
  /** Existing board names; `board-name` values are checked against them when present. */
  boardNames?: ReadonlyArray<string>;
  /** Decides whether an unknown first word is close enough to a command to be a typo rather than a task. */
  isNearMiss?: (token: string, candidates: ReadonlyArray<string>) => boolean;
  /** Treat an unknown first word as a task even when it looks like a typo. */
  forceImplicitAdd?: boolean;
  /** Current tasks; when set with `strict`, task and epic values must name real ones. */
  tasks?: ReadonlyArray<Task>;
  strict?: boolean;
}

export type ParseResult =
  | { kind: "help"; path: CommandSpec[] }
  | { kind: "run"; path: CommandSpec[]; node: CommandSpec; input: ParsedInput };

const IMPLICIT_ADD = "add";
const IMPLICIT_SUB = "sub";
const TASK_ID = /^#?\d+$/;
const TASK_ID_LIST_PART = /^#?\d+(-\d+)?$/;

export function isFlagToken(token: string): boolean {
  return /^--?[a-zA-Z]/.test(token);
}

/** Walks the command tree along argv, then binds and validates the remaining arguments of the node it lands on. */
export function parse(root: CommandSpec, argv: ReadonlyArray<string>, options: ParseOptions = {}): ParseResult {
  const separator = argv.indexOf("--");
  const beforeSeparator = separator === -1 ? argv : argv.slice(0, separator);
  const wantsHelp = beforeSeparator.some((token) => HELP_FLAGS.has(token));
  const tokens = wantsHelp ? [...beforeSeparator.filter((token) => !HELP_FLAGS.has(token)), ...(separator === -1 ? [] : argv.slice(separator))] : [...argv];

  const path: CommandSpec[] = [];
  let node = root;
  let index = 0;
  for (;;) {
    if (node.subcommands === undefined || node.subcommands.length === 0) break;
    const token = tokens[index];
    if (token === undefined || token === "--") {
      if (wantsHelp || node.run !== undefined) break;
      const fallback = defaultChild(node);
      if (fallback === undefined) throw new UserInputError(usageMessage(path));
      path.push(fallback);
      node = fallback;
      continue;
    }

    const child = findChild(node, token);
    if (child !== undefined) {
      path.push(child);
      node = child;
      index += 1;
      continue;
    }

    if (node === root) {
      const implicit = resolveImplicitCommand(root, tokens.slice(index), options);
      path.push(implicit);
      node = implicit;
      break;
    }
    if (isFlagToken(token) || (node.args ?? []).length > 0) {
      if (node.run !== undefined || wantsHelp) break;
      const fallback = defaultChild(node);
      if (fallback !== undefined && (isFlagToken(token) || (fallback.args ?? []).length > 0)) {
        path.push(fallback);
        node = fallback;
        continue;
      }
    }
    if (wantsHelp && isFlagToken(token)) break;
    throw unknownChild(node, token);
  }

  if (wantsHelp) return { kind: "help", path };
  if (node.run === undefined) throw new UserInputError(usageMessage(path));
  return { kind: "run", path, node, input: bind(path, node, tokens.slice(index), options) };
}

function defaultChild(node: CommandSpec): CommandSpec | undefined {
  return node.defaultSubcommand === undefined ? undefined : findChild(node, node.defaultSubcommand);
}

function unknownChild(node: CommandSpec, token: string): UnknownTokenError {
  const noun = node.subcommandNoun ?? "subcommand";
  return new UnknownTokenError(`Unknown ${noun}: ${token}`, token, childNames(node), noun === "setting" ? "setting" : "command");
}

function resolveImplicitCommand(root: CommandSpec, rest: ReadonlyArray<string>, options: ParseOptions): CommandSpec {
  const [token = "", ...others] = rest;
  if (isFlagToken(token)) {
    const candidates = [...childNames(root).filter((name) => name.startsWith("-")), ...HELP_FLAGS];
    throw new UnknownTokenError(`Unknown option: ${token}`, token, candidates, "option");
  }
  if (TASK_ID.test(token) && others.length > 0) return requireChild(root, IMPLICIT_SUB);

  const candidates = childNames(root).filter((name) => !name.startsWith("-"));
  if (options.forceImplicitAdd !== true && options.isNearMiss?.(token, candidates) === true) {
    const plausible = candidates.filter((name) => argumentsFit(root, name, others, options));
    if (plausible.length > 0 && options.isNearMiss(token, plausible)) {
      throw new UnknownTokenError(`Unknown command: ${token}`, token, plausible, "command", true);
    }
  }
  return requireChild(root, IMPLICIT_ADD);
}

/** Whether the words after a mistyped command would parse for the command it resembles. */
function argumentsFit(root: CommandSpec, name: string, rest: ReadonlyArray<string>, options: ParseOptions): boolean {
  try {
    const strict: ParseOptions = { strict: true, ...(options.tasks === undefined ? {} : { tasks: options.tasks }), ...(options.boardNames === undefined ? {} : { boardNames: options.boardNames }) };
    return parse(root, [name, ...rest], strict).kind === "run";
  } catch (error: unknown) {
    if (error instanceof UserInputError) return false;
    throw error;
  }
}

function requireChild(node: CommandSpec, name: string): CommandSpec {
  const child = findChild(node, name);
  if (child === undefined) throw new Error(`Command tree has no ${name}`);
  return child;
}

function usageMessage(path: ReadonlyArray<CommandSpec>): string {
  const help = path.length === 0 ? "todo help" : `${commandLine(path)} --help`;
  return `Usage: ${formatUsage(path).join("\n       ")}\nRun '${help}' for details.`;
}

function bind(path: CommandSpec[], node: CommandSpec, tokens: ReadonlyArray<string>, options: ParseOptions): ParsedInput {
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();
  let flagsEnded = false;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (!flagsEnded && token === "--") {
      flagsEnded = true;
      continue;
    }
    if (flagsEnded || !isFlagToken(token)) {
      positionals.push(token);
      continue;
    }

    const equals = token.startsWith("--") ? token.indexOf("=") : -1;
    const spelling = equals === -1 ? token : token.slice(0, equals);
    const inline = equals === -1 ? undefined : token.slice(equals + 1);
    const flag = findFlag(node, spelling);
    if (flag === undefined) {
      throw new UnknownTokenError(`Unknown option: ${spelling}`, spelling, visibleFlags(node).flatMap(flagSpellings), "option");
    }
    if (flag.value === undefined) {
      if (inline !== undefined) throw new UserInputError(`${spelling} takes no value`);
      flags.set(flag.name, true);
      continue;
    }

    let value = inline;
    if (value === undefined) {
      const next = tokens[index + 1];
      if (next === undefined || next === "--" || isFlagToken(next)) throw new UserInputError(`Missing value for ${spelling}`);
      const words = [next];
      index += 1;
      while (flag.greedy === true && index + 1 < tokens.length && tokens[index + 1] !== "--" && !isFlagToken(tokens[index + 1]!)) {
        words.push(tokens[index + 1]!);
        index += 1;
      }
      value = words.join(" ");
    }
    if (value.length === 0) throw new UserInputError(`Missing value for ${spelling}`);
    flags.set(flag.name, validateValue(flag.value, value, spelling, options));
  }

  const values = new Map<string, string[]>();
  let cursor = 0;
  for (const arg of node.args ?? []) {
    const taken = arg.variadic === true ? positionals.slice(cursor) : positionals.slice(cursor, cursor + 1);
    cursor += taken.length;
    if (taken.length === 0) {
      if (arg.optional === true) continue;
      throw new UserInputError(usageMessage(path));
    }
    if (cursor === taken.length) rejectNearChild(node, taken[0]!);
    values.set(arg.name, taken.map((token) => validateArgument(node, arg, token, options)));
  }

  const extra = positionals[cursor];
  if (extra !== undefined) {
    if ((node.subcommands ?? []).length > 0) throw unknownChild(node, extra);
    throw new UserInputError(`Unexpected argument: ${extra}\n${usageMessage(path)}`);
  }
  return new ParsedInput(path.map((step) => step.name), values, flags, positionals);
}

/** The first positional of a node with subcommands sits where a subcommand would: one that nearly matches is a typo. */
function rejectNearChild(node: CommandSpec, token: string): void {
  if (TASK_ID.test(token) || findClosest(token, childNames(node)) === undefined) return;
  throw unknownChild(node, token);
}

/** A positional that fails its own kind but resembles a subcommand is reported as a mistyped subcommand. */
function validateArgument(node: CommandSpec, arg: ArgSpec, token: string, options: ParseOptions): string {
  try {
    const label = (node.args ?? []).length === 1 ? node.name : arg.name;
    return validateValue(arg.kind, token, label, options);
  } catch (error: unknown) {
    if (error instanceof UserInputError && !(error instanceof UnknownTokenError) && findClosest(token, childNames(node)) !== undefined) {
      throw unknownChild(node, token);
    }
    throw error;
  }
}

/** Checks a value against its kind and returns it normalized (ids without `#`, enum values and board names as stored). */
export function validateValue(kind: ValueKind, raw: string, label: string, options: ParseOptions = {}): string {
  const value = validateShape(kind, raw, label, options);
  if (options.strict === true && options.tasks !== undefined) requireExisting(kind, value, options.tasks);
  return value;
}

/** Used when guessing whether a mistyped command was meant: its task arguments must point at real tasks. */
function requireExisting(kind: ValueKind, value: string, tasks: ReadonlyArray<Task>): void {
  if (!taskValueExists(kind, value, tasks)) throw new UserInputError(`No such task: ${value}`);
}

function taskValueExists(kind: ValueKind, value: string, tasks: ReadonlyArray<Task>): boolean {
  const pending = tasks.filter((task) => task.status === "pending");
  const id = value.replace(/^#/, "");
  const name = value.trim().toLowerCase();
  const matches = (task: Task): boolean => task.id === id || task.description.trim().toLowerCase() === name;
  switch (kind) {
    case "task-id":
      return tasks.some((task) => task.id === value);
    case "pending-task-id":
      return pending.some((task) => task.id === value);
    case "task-selector":
      return pending.some(matches);
    case "epic-id":
    case "epic-selector":
      return pending.some((task) => matches(task) && isEpic(task, [...tasks]));
    default:
      return true;
  }
}

function validateShape(kind: ValueKind, raw: string, label: string, options: ParseOptions): string {
  if (typeof kind === "object") return chooseOne(kind.oneOf, raw, label);
  switch (kind) {
    case "task-id":
    case "pending-task-id":
    case "epic-id":
      if (!TASK_ID.test(raw.trim())) throw new UserInputError(`Invalid task ID: ${raw}`);
      return raw.trim().replace(/^#/, "");
    case "parent-id":
      if (["root", "top", "-"].includes(raw.trim())) return raw.trim();
      if (!TASK_ID.test(raw.trim())) throw new UserInputError(`Invalid parent: ${raw}. Use a task ID or root.`);
      return raw.trim().replace(/^#/, "");
    case "task-ids":
      if (!raw.split(",").every((part) => TASK_ID_LIST_PART.test(part.trim()))) throw new UserInputError(`Invalid task ID list: ${raw}`);
      return raw;
    case "priority":
      return chooseOne(["none", "low", "medium", "high"], raw, label);
    case "count-or-all":
      if (!/^(\d+|all|unlimited)$/i.test(raw.trim())) throw new UserInputError(`Invalid count: ${raw}. Use a whole number or 'all'.`);
      return raw.trim().toLowerCase();
    case "minutes":
      if (!raw.split(",").every((part) => /^\d+$/.test(part.trim()))) throw new UserInputError(`Invalid reminders: ${raw}`);
      return raw;
    case "duration":
      parseDuration(raw);
      return raw;
    case "board-name":
      return matchBoardName(raw, options.boardNames);
    default:
      return raw;
  }
}

function chooseOne(choices: ReadonlyArray<string>, raw: string, label: string): string {
  const match = choices.find((choice) => choice.toLowerCase() === raw.trim().toLowerCase());
  if (match !== undefined) return match;
  throw new UnknownTokenError(`Unknown value for ${label}: ${raw}`, raw, choices, "value");
}

function matchBoardName(raw: string, names: ReadonlyArray<string> | undefined): string {
  if (names === undefined) return raw;
  const match = names.find((name) => name.toLowerCase() === raw.trim().toLowerCase());
  if (match !== undefined) return match;
  if (names.length === 0) throw new UserInputError(`No board named ${raw} · todo board new ${raw} creates it`);
  throw new UnknownTokenError(`Unknown board: ${raw}`, raw, names, "value");
}
