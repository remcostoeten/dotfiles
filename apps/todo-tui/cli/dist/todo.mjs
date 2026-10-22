#!/usr/bin/env bun
// @bun

// src/cli.ts
import { createInterface } from "readline/promises";

// src/domain/fuzzy-match.ts
function editDistance(left, right) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const table = Array.from({ length: rows }, () => new Array(columns).fill(0));
  for (let row = 0;row < rows; row += 1)
    table[row][0] = row;
  for (let column = 0;column < columns; column += 1)
    table[0][column] = column;
  for (let row = 1;row < rows; row += 1) {
    for (let column = 1;column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      let best = Math.min(table[row - 1][column] + 1, table[row][column - 1] + 1, table[row - 1][column - 1] + cost);
      const transposed = row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1];
      if (transposed)
        best = Math.min(best, table[row - 2][column - 2] + 1);
      table[row][column] = best;
    }
  }
  return table[left.length][right.length];
}
function maxDistanceFor(token) {
  if (token.length <= 3)
    return 1;
  if (token.length <= 6)
    return 2;
  return 3;
}
function findClosest(token, candidates) {
  const needle = token.toLowerCase();
  if (needle.length < 2)
    return;
  const prefixMatches = candidates.filter((candidate) => candidate.toLowerCase().startsWith(needle) && candidate !== token);
  if (needle.length >= 3 && prefixMatches.length === 1)
    return prefixMatches[0];
  const limit = maxDistanceFor(needle);
  let best;
  let bestDistance = Number.POSITIVE_INFINITY;
  let tied = false;
  for (const candidate of candidates) {
    if (candidate === token)
      continue;
    const distance = editDistance(needle, candidate.toLowerCase());
    if (distance > limit)
      continue;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
      tied = false;
    } else if (distance === bestDistance) {
      tied = true;
    }
  }
  return tied ? undefined : best;
}

// src/domain/autocorrect.ts
var AUTO_CORRECT_THRESHOLD = 3;
var GIVE_UP_AFTER_REJECTIONS = 2;
function decideCorrection(memory, token, candidates) {
  const records = memory[token] ?? {};
  const learned = Object.entries(records).filter(([candidate, record]) => candidates.includes(candidate) && record.accepted > record.rejected).sort(([, left], [, right]) => right.accepted - left.accepted)[0];
  if (learned !== undefined) {
    const [correction, record] = learned;
    return { correction, mode: record.accepted >= AUTO_CORRECT_THRESHOLD && record.rejected === 0 ? "auto" : "prompt" };
  }
  const closest = findClosest(token, candidates);
  if (closest === undefined)
    return;
  const record = records[closest];
  if (record !== undefined && isIgnored(record))
    return;
  return { correction: closest, mode: "prompt" };
}
function recordDecision(memory, token, correction, accepted) {
  const current = memory[token]?.[correction] ?? { accepted: 0, rejected: 0 };
  const updated = accepted ? { accepted: current.accepted + 1, rejected: current.rejected } : { accepted: current.accepted, rejected: current.rejected + 1 };
  return { ...memory, [token]: { ...memory[token], [correction]: updated } };
}
function forgetTypo(memory, token) {
  const { [token]: _removed, ...rest } = memory;
  return rest;
}
function isAutoCorrected(record) {
  return record.accepted >= AUTO_CORRECT_THRESHOLD && record.rejected === 0;
}
function isIgnored(record) {
  return record.accepted === 0 && record.rejected >= GIVE_UP_AFTER_REJECTIONS;
}
function replaceToken(args, token, correction) {
  const index = args.findIndex((argument) => argument === token || argument.startsWith(`${token}=`) || argument.endsWith(`=${token}`));
  if (index === -1)
    return;
  const argument = args[index];
  const replacement = argument === token ? correction : argument.startsWith(`${token}=`) ? `${correction}${argument.slice(token.length)}` : `${argument.slice(0, argument.length - token.length)}${correction}`;
  return [...args.slice(0, index), replacement, ...args.slice(index + 1)];
}

// src/autocorrect.ts
var DIM = "\x1B[2m";
var BOLD = "\x1B[1m";
var RESET = "\x1B[0m";
async function resolveTypo(error, argv, store, io) {
  const memory = await store.loadTypoMemory();
  const decision = decideCorrection(memory, error.token, error.candidates);
  if (decision === undefined)
    return { kind: "none" };
  const corrected = replaceToken(argv, error.token, decision.correction);
  if (corrected === undefined)
    return { kind: "none" };
  if (decision.mode === "auto") {
    io.notify(`${DIM}autocorrected ${error.token} \u2192 ${decision.correction}  (todo typos forget ${error.token} to stop)${RESET}
`);
    return { kind: "corrected", argv: corrected };
  }
  const answer = await io.confirm(`Did you mean ${BOLD}todo ${corrected.join(" ")}${RESET}? [Y/n] `);
  if (answer === undefined)
    return { kind: "unanswered", suggestion: decision.correction };
  const updated = recordDecision(memory, error.token, decision.correction, answer);
  await store.saveTypoMemory(updated);
  const record = updated[error.token]?.[decision.correction];
  if (answer && record !== undefined && isAutoCorrected(record)) {
    io.notify(`${DIM}learned: ${error.token} now autocorrects to ${decision.correction}${RESET}
`);
  }
  return answer ? { kind: "corrected", argv: corrected } : { kind: "declined" };
}

// src/command-spec/tree.ts
var HELP_FLAGS = new Set(["-h", "--help"]);
function findChild(node, token) {
  return node.subcommands?.find((child) => child.name === token || child.aliases?.includes(token) === true);
}
function childNames(node) {
  return (node.subcommands ?? []).filter((child) => child.hidden !== true).flatMap((child) => [child.name, ...child.aliases ?? []]);
}
function flagSpellings(flag) {
  return [`--${flag.name}`, ...(flag.aliases ?? []).map((alias) => `--${alias}`), ...flag.short === undefined ? [] : [`-${flag.short}`]];
}
function findFlag(node, spelling) {
  return node.flags?.find((flag) => flagSpellings(flag).includes(spelling));
}
function visibleFlags(node) {
  return (node.flags ?? []).filter((flag) => flag.hidden !== true);
}
function walkSpecs(root) {
  const visits = [];
  function visit(node, path) {
    for (const child of node.subcommands ?? []) {
      const childPath = [...path, child];
      visits.push({ node: child, path: childPath });
      visit(child, childPath);
    }
  }
  visit(root, []);
  return visits;
}
function commandLine(path) {
  return ["todo", ...path.map((node) => node.name)].join(" ");
}
function valuePlaceholder(kind, fallback) {
  if (typeof kind === "object")
    return kind.oneOf.join("|");
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
      return "min,\u2026";
    default:
      return fallback;
  }
}
function formatArg(arg) {
  const label = `${typeof arg.kind === "object" ? arg.kind.oneOf.join("|") : arg.name}${arg.variadic === true ? "\u2026" : ""}`;
  return arg.optional === true ? `[${label}]` : `<${label}>`;
}
function formatFlag(flag) {
  const spelling = `--${flag.name}`;
  return flag.value === undefined ? spelling : `${spelling} <${valuePlaceholder(flag.value, flag.name)}>`;
}
var MAX_INLINE_FLAGS = 4;
function formatUsage(path) {
  const node = path[path.length - 1];
  if (node === undefined)
    return ["todo <command> [arguments]"];
  const base = commandLine(path);
  const lines = [];
  if (node.run !== undefined || node.defaultSubcommand !== undefined) {
    const args = (node.args ?? []).map(formatArg);
    const flags = visibleFlags(node);
    const flagText = flags.length > MAX_INLINE_FLAGS ? ["[options]"] : flags.map((flag) => `[${formatFlag(flag)}]`);
    lines.push([base, ...args, ...flagText].join(" "));
  }
  if ((node.subcommands ?? []).some((child) => child.hidden !== true))
    lines.push(`${base} <command>`);
  return lines;
}

// src/domain/visibility-alias.ts
var ACTION_LETTERS = { o: "open", c: "close" };
var TARGET_LETTERS = { a: "all" };
var HELP_TOKENS = new Set(["help", "-h", "--help"]);
var VISIBILITY_ALIASES = [
  { alias: "-oa", meaning: "open all" },
  { alias: "-ca", meaning: "close all" },
  { alias: "--o --a", meaning: "open all" },
  { alias: "--c --a", meaning: "close all" },
  { alias: "-o <epic>", meaning: "open <epic>" },
  { alias: "-c <epic>", meaning: "close <epic>" }
];
function isHelpToken(token) {
  return HELP_TOKENS.has(token);
}
function expandVisibilityAliases(args) {
  const letters = [];
  let index = 0;
  for (;index < args.length; index += 1) {
    const parsed = readAliasLetters(args[index]);
    if (parsed === undefined)
      break;
    letters.push(...parsed);
  }
  if (letters.length === 0 || new Set(letters).size !== letters.length)
    return;
  const actions = letters.filter((letter) => (letter in ACTION_LETTERS));
  const targets = letters.filter((letter) => (letter in TARGET_LETTERS));
  const action = actions[0];
  if (action === undefined || actions.length !== 1)
    return;
  const rest = args.slice(index);
  const help = rest.filter(isHelpToken).map((token) => token === "help" ? "--help" : token);
  const selectors = rest.filter((token) => !isHelpToken(token));
  if (selectors.some((token) => token.startsWith("-")))
    return;
  if (targets.length === 0 && selectors.length === 0 && help.length === 0)
    return;
  return [ACTION_LETTERS[action], ...targets.map((letter) => TARGET_LETTERS[letter]), ...selectors, ...help];
}
function readAliasLetters(token) {
  if (token.startsWith("--")) {
    const body = token.slice(2);
    return body.length === 1 && isAliasLetter(body) ? [body] : undefined;
  }
  if (!token.startsWith("-") || token.length < 2)
    return;
  const letters = [...token.slice(1)];
  return letters.every(isAliasLetter) ? letters : undefined;
}
function isAliasLetter(letter) {
  return letter in ACTION_LETTERS || letter in TARGET_LETTERS;
}

// src/presentation/help-format.ts
var GROUP_ORDER = ["Create", "Boards", "View", "Change", "Epic visibility", "Remove", "Settings"];
var INDENT = "  ";
var COLOR_PALETTE = {
  reset: "\x1B[0m",
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  accent: "\x1B[38;5;208m",
  heading: "\x1B[38;5;147m",
  command: "\x1B[38;5;114m",
  placeholder: "\x1B[38;5;116m",
  flag: "\x1B[38;5;229m"
};
var PLAIN_PALETTE = {
  reset: "",
  bold: "",
  dim: "",
  accent: "",
  heading: "",
  command: "",
  placeholder: "",
  flag: ""
};
function supportsColor() {
  if (process.env.NO_COLOR !== undefined)
    return false;
  if (process.env.FORCE_COLOR !== undefined)
    return true;
  return process.stdout.isTTY === true;
}
function formatHelpOverview(root, useColor = supportsColor()) {
  const p = useColor ? COLOR_PALETTE : PLAIN_PALETTE;
  const commands = visibleChildren(root);
  const lines = [""];
  lines.push(`${INDENT}${p.accent}${p.bold}\u2713 todo${p.reset}  ${p.dim}\xB7${p.reset}  tasks, epics and boards from the shell`);
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
  return `${lines.join(`
`)}
`;
}
function formatCommandHelp(path, useColor = supportsColor()) {
  const node = path[path.length - 1];
  if (node === undefined)
    throw new Error("formatCommandHelp needs a command path");
  const p = useColor ? COLOR_PALETTE : PLAIN_PALETTE;
  const lines = [""];
  lines.push(`${INDENT}${p.accent}${p.bold}${commandLine(path)}${p.reset}  ${p.dim}\xB7${p.reset}  ${node.summary}`);
  if (node.aliases !== undefined && node.aliases.length > 0) {
    lines.push(`${INDENT}${p.dim}aliases:${p.reset} ${node.aliases.map((alias) => `${p.command}${alias}${p.reset}`).join(`${p.dim},${p.reset} `)}`);
  }
  lines.push("");
  lines.push(heading("Usage", p));
  for (const usage of formatUsage(path))
    lines.push(`${INDENT}${INDENT}${highlightUsage(usage, p)}`);
  const args = node.args ?? [];
  pushTable(lines, "Arguments", args.map((arg) => ({ left: formatArg(arg), right: arg.description })), p);
  const children = visibleChildren(node);
  pushTable(lines, "Commands", children.map((child) => ({
    left: formatCommandLabel(child),
    right: `${child.summary}${child.name === node.defaultSubcommand ? " (default)" : ""}`
  })), p);
  pushTable(lines, "Options", visibleFlags(node).map((flag) => ({
    left: [formatFlag(flag), ...(flag.aliases ?? []).map((alias) => `--${alias}`), ...flag.short === undefined ? [] : [`-${flag.short}`]].join(", "),
    right: flag.description
  })), p);
  if (node.details !== undefined && node.details.length > 0) {
    lines.push("");
    lines.push(heading("Details", p));
    for (const detail of node.details)
      lines.push(`${INDENT}${INDENT}${highlightInline(detail, p)}`);
  }
  for (const section of node.sections ?? [])
    pushSection(lines, section, p);
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
  return `${lines.join(`
`)}
`;
}
function pushTable(lines, title, rows, p) {
  if (rows.length === 0)
    return;
  lines.push("");
  lines.push(heading(title, p));
  const width = Math.max(...rows.map((row) => row.left.length));
  for (const row of rows) {
    const padding = " ".repeat(width - row.left.length + 3);
    lines.push(`${INDENT}${INDENT}${highlightInline(row.left, p)}${padding}${highlightInline(row.right, p)}`);
  }
}
function pushSection(lines, section, p) {
  if (section.rows.length === 0)
    return;
  lines.push("");
  lines.push(heading(section.heading, p));
  const width = Math.max(...section.rows.map((row) => row.right === undefined ? 0 : row.left.length));
  for (const row of section.rows) {
    if (row.right === undefined) {
      lines.push(`${INDENT}${INDENT}${highlightUsage(row.left, p)}`);
      continue;
    }
    const padding = " ".repeat(width - row.left.length + 3);
    lines.push(`${INDENT}${INDENT}${highlightInline(row.left, p)}${padding}${p.dim}${row.right}${p.reset}`);
  }
}
function visibleChildren(node) {
  return (node.subcommands ?? []).filter((child) => child.hidden !== true);
}
function formatCommandLabel(command) {
  const aliases = command.aliases ?? [];
  return aliases.length === 0 ? command.name : `${command.name}, ${aliases.join(", ")}`;
}
function colorCommandLabel(command, p) {
  const aliases = command.aliases ?? [];
  const name = `${p.command}${p.bold}${command.name}${p.reset}`;
  return aliases.length === 0 ? name : `${name}${p.dim}, ${aliases.join(", ")}${p.reset}`;
}
function groupCommands(commands) {
  const groups = new Map(GROUP_ORDER.map((group) => [group, []]));
  for (const command of commands)
    groups.get(command.group ?? "Settings")?.push(command);
  return [...groups.entries()].filter(([, members]) => members.length > 0).map(([name, members]) => ({ name, commands: members }));
}
function heading(text, p) {
  return `${INDENT}${p.heading}${p.bold}${text.toUpperCase()}${p.reset}`;
}
function highlightUsage(usage, p) {
  const tokens = usage.split(" ");
  return tokens.map((token, index) => {
    if (index === 0 && token === "todo")
      return `${p.dim}todo${p.reset}`;
    if (index === 1 && tokens[0] === "todo" && /^[a-z-]+$/.test(token))
      return `${p.command}${token}${p.reset}`;
    return highlightInline(token, p);
  }).join(" ");
}
function highlightInline(text, p) {
  return text.replace(/<[^>]+>/g, (match) => `${p.placeholder}${match}${p.reset}`).replace(/(^|[\s[(|,])(--?[a-z][\w-]*)/g, (_match, lead, flag) => `${lead}${p.flag}${flag}${p.reset}`).replace(/`([^`]+)`/g, (_match, code) => `${p.command}${code}${p.reset}`);
}

// src/domain/user-input-error.ts
class UserInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserInputError";
  }
}

// src/domain/duration.ts
var MAX_BOARD_DURATION_MS = 24 * 60 * 60 * 1000;
var MIN_BOARD_DURATION_MS = 60000;
function parseDuration(word) {
  const durationMs = readDuration(word);
  if (durationMs > MAX_BOARD_DURATION_MS)
    throw new UserInputError("A timed board lasts at most 24h");
  if (durationMs < MIN_BOARD_DURATION_MS)
    throw new UserInputError("A timed board needs at least a minute");
  return durationMs;
}
function readDuration(word) {
  if (/^\d+(\.\d+)?$/.test(word))
    return Number(word) * 60 * 60 * 1000;
  const match = /^(?:(\d+)h)?(?:(\d+)m)?$/.exec(word);
  if (match === null || match[1] === undefined && match[2] === undefined) {
    throw new UserInputError(`Not a duration: ${word} (try 4h or 90m)`);
  }
  return Number(match[1] ?? 0) * 60 * 60 * 1000 + Number(match[2] ?? 0) * 60 * 1000;
}
function formatDuration(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0 && rest > 0)
    return `${hours}h${String(rest).padStart(2, "0")}m`;
  if (hours > 0)
    return `${hours}h`;
  if (rest > 0)
    return `${rest}m`;
  return "<1m";
}

// src/domain/task-tree.ts
function buildTaskTreeRows(visibleTasks, allTasks, options = {}) {
  const compare = options.compare ?? (() => 0);
  const collapsedIds = options.collapsedIds ?? new Set;
  const visibleIds = new Set(visibleTasks.map((task) => task.id));
  const childrenByParent = new Map;
  for (const task of visibleTasks) {
    const parentKey = task.parentId !== undefined && visibleIds.has(task.parentId) && task.parentId !== task.id ? task.parentId : undefined;
    const siblings = childrenByParent.get(parentKey) ?? [];
    siblings.push(task);
    childrenByParent.set(parentKey, siblings);
  }
  for (const siblings of childrenByParent.values())
    siblings.sort(compare);
  const rows = [];
  const visited = new Set;
  const visit = (parentKey, depth, trail) => {
    const siblings = childrenByParent.get(parentKey) ?? [];
    siblings.forEach((task, index) => {
      if (visited.has(task.id))
        return;
      visited.add(task.id);
      const siblingFollows = [...trail, index < siblings.length - 1];
      const children = childrenByParent.get(task.id) ?? [];
      const collapsed = collapsedIds.has(task.id);
      rows.push({
        task,
        depth,
        siblingFollows,
        hasChildren: children.length > 0,
        childCount: children.length,
        collapsed,
        progress: getTaskProgress(allTasks, task.id)
      });
      if (!collapsed)
        visit(task.id, depth + 1, siblingFollows);
    });
  };
  visit(undefined, 0, []);
  return rows;
}
function collectDescendantIds(tasks, rootIds) {
  const childrenByParent = new Map;
  for (const task of tasks) {
    if (task.parentId === undefined)
      continue;
    const children = childrenByParent.get(task.parentId) ?? [];
    children.push(task.id);
    childrenByParent.set(task.parentId, children);
  }
  const descendants = new Set;
  const queue = [...rootIds];
  while (queue.length > 0) {
    const id = queue.pop();
    for (const childId of childrenByParent.get(id) ?? []) {
      if (descendants.has(childId))
        continue;
      descendants.add(childId);
      queue.push(childId);
    }
  }
  for (const id of rootIds)
    descendants.delete(id);
  return descendants;
}
function collectSubtreeIds(tasks, rootIds) {
  const roots = [...rootIds];
  return new Set([...roots, ...collectDescendantIds(tasks, roots)]);
}
function excludeHiddenSubtrees(tasks) {
  const hiddenIds = collectSubtreeIds(tasks, tasks.filter((task) => task.hidden === true).map((task) => task.id));
  return tasks.filter((task) => !hiddenIds.has(task.id));
}
function findTaskByIdOrDescription(tasks, target) {
  const trimmed = target.trim();
  if (/^#?\d+$/.test(trimmed))
    return findTask(tasks, trimmed.replace(/^#/, ""));
  const needle = trimmed.toLowerCase();
  const matches = tasks.filter((task) => task.status === "pending" && task.description.toLowerCase() === needle);
  const match = matches.find((task) => task.kind === "epic") ?? matches[0];
  if (match === undefined)
    throw new UserInputError(`Task not found: ${target}`);
  return match;
}
function getTaskProgress(tasks, id) {
  const descendantIds = collectDescendantIds(tasks, [id]);
  let completed = 0;
  for (const task of tasks) {
    if (descendantIds.has(task.id) && task.status === "completed")
      completed += 1;
  }
  return { total: descendantIds.size, completed };
}
function isEpic(task, tasks) {
  return task.kind === "epic" || countDescendants(tasks, task.id) > 0;
}
function findTask(tasks, id) {
  const task = tasks.find((candidate) => candidate.id === id);
  if (task === undefined)
    throw new UserInputError(`Task not found: ${id}`);
  return task;
}
function moveTask(tasks, id, parentId, now = Date.now()) {
  const task = findTask(tasks, id);
  if (parentId !== undefined) {
    findTask(tasks, parentId);
    if (parentId === id || collectDescendantIds(tasks, [id]).has(parentId)) {
      throw new UserInputError(`Cannot move #${id} under #${parentId}: it would nest inside itself`);
    }
    task.parentId = parentId;
  } else {
    delete task.parentId;
  }
  task.updatedAt = now;
  return task;
}
function reorderTask(tasks, id, position, now = Date.now()) {
  const task = findTask(tasks, id);
  let anchorTask;
  if (position.type === "before" || position.type === "after") {
    anchorTask = findTask(tasks, position.anchorId);
    if (anchorTask.id === task.id)
      throw new UserInputError(`Cannot reorder #${id} relative to itself`);
    if (anchorTask.parentId !== task.parentId) {
      throw new UserInputError(`Cannot reorder #${id} next to #${position.anchorId}: they are not siblings`);
    }
  }
  const fromIndex = tasks.indexOf(task);
  tasks.splice(fromIndex, 1);
  let insertIndex;
  if (position.type === "top" || position.type === "bottom") {
    const siblingIndexes = tasks.reduce((indexes, candidate, index) => {
      if (candidate.parentId === task.parentId)
        indexes.push(index);
      return indexes;
    }, []);
    insertIndex = position.type === "top" ? siblingIndexes[0] ?? 0 : (siblingIndexes.at(-1) ?? tasks.length - 1) + 1;
  } else {
    const anchorIndex = tasks.indexOf(anchorTask);
    insertIndex = position.type === "before" ? anchorIndex : anchorIndex + 1;
  }
  tasks.splice(insertIndex, 0, task);
  task.updatedAt = now;
  return task;
}
function completeSubtrees(tasks, rootIds, now = Date.now()) {
  const ids = collectSubtreeIds(tasks, rootIds);
  let changed = 0;
  for (const task of tasks) {
    if (!ids.has(task.id) || task.status === "completed")
      continue;
    task.status = "completed";
    task.updatedAt = now;
    changed += 1;
  }
  return changed;
}
function countDescendants(tasks, id) {
  return collectDescendantIds(tasks, [id]).size;
}

// src/domain/unknown-token-error.ts
class UnknownTokenError extends UserInputError {
  token;
  candidates;
  kind;
  implicitAddFallback;
  constructor(message, token, candidates, kind, implicitAddFallback = false) {
    super(message);
    this.token = token;
    this.candidates = candidates;
    this.kind = kind;
    this.implicitAddFallback = implicitAddFallback;
    this.name = "UnknownTokenError";
  }
}

// src/command-spec/parsed-input.ts
class ParsedInput {
  path;
  argValues;
  flagValues;
  positionals;
  constructor(path, argValues, flagValues, positionals) {
    this.path = path;
    this.argValues = argValues;
    this.flagValues = flagValues;
    this.positionals = positionals;
  }
  arg(name) {
    const value = this.argValues.get(name)?.[0];
    if (value === undefined)
      throw new Error(`Argument ${name} was not bound`);
    return value;
  }
  optionalArg(name) {
    return this.argValues.get(name)?.[0];
  }
  args(name) {
    return [...this.argValues.get(name) ?? []];
  }
  flag(name) {
    return this.flagValues.has(name);
  }
  value(name) {
    const value = this.flagValues.get(name);
    return typeof value === "string" ? value : undefined;
  }
}

// src/command-spec/parse.ts
var IMPLICIT_ADD = "add";
var IMPLICIT_SUB = "sub";
var TASK_ID = /^#?\d+$/;
var TASK_ID_LIST_PART = /^#?\d+(-\d+)?$/;
function isFlagToken(token) {
  return /^--?[a-zA-Z]/.test(token);
}
function parse(root, argv, options = {}) {
  const separator = argv.indexOf("--");
  const beforeSeparator = separator === -1 ? argv : argv.slice(0, separator);
  const wantsHelp = beforeSeparator.some((token) => HELP_FLAGS.has(token));
  const tokens = wantsHelp ? [...beforeSeparator.filter((token) => !HELP_FLAGS.has(token)), ...separator === -1 ? [] : argv.slice(separator)] : [...argv];
  const path = [];
  let node = root;
  let index = 0;
  for (;; ) {
    if (node.subcommands === undefined || node.subcommands.length === 0)
      break;
    const token = tokens[index];
    if (token === undefined || token === "--") {
      if (wantsHelp || node.run !== undefined)
        break;
      const fallback = defaultChild(node);
      if (fallback === undefined)
        throw new UserInputError(usageMessage(path));
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
      if (node.run !== undefined || wantsHelp)
        break;
      const fallback = defaultChild(node);
      if (fallback !== undefined && (isFlagToken(token) || (fallback.args ?? []).length > 0)) {
        path.push(fallback);
        node = fallback;
        continue;
      }
    }
    if (wantsHelp && isFlagToken(token))
      break;
    throw unknownChild(node, token);
  }
  if (wantsHelp)
    return { kind: "help", path };
  if (node.run === undefined)
    throw new UserInputError(usageMessage(path));
  return { kind: "run", path, node, input: bind(path, node, tokens.slice(index), options) };
}
function defaultChild(node) {
  return node.defaultSubcommand === undefined ? undefined : findChild(node, node.defaultSubcommand);
}
function unknownChild(node, token) {
  const noun = node.subcommandNoun ?? "subcommand";
  return new UnknownTokenError(`Unknown ${noun}: ${token}`, token, childNames(node), noun === "setting" ? "setting" : "command");
}
function resolveImplicitCommand(root, rest, options) {
  const [token = "", ...others] = rest;
  if (isFlagToken(token)) {
    const candidates = [...childNames(root).filter((name) => name.startsWith("-")), ...HELP_FLAGS];
    throw new UnknownTokenError(`Unknown option: ${token}`, token, candidates, "option");
  }
  if (TASK_ID.test(token) && others.length > 0)
    return requireChild(root, IMPLICIT_SUB);
  const candidates = childNames(root).filter((name) => !name.startsWith("-"));
  if (options.forceImplicitAdd !== true && options.isNearMiss?.(token, candidates) === true) {
    const plausible = candidates.filter((name) => argumentsFit(root, name, others, options));
    if (plausible.length > 0 && options.isNearMiss(token, plausible)) {
      throw new UnknownTokenError(`Unknown command: ${token}`, token, plausible, "command", true);
    }
  }
  return requireChild(root, IMPLICIT_ADD);
}
function argumentsFit(root, name, rest, options) {
  try {
    const strict = { strict: true, ...options.tasks === undefined ? {} : { tasks: options.tasks }, ...options.boardNames === undefined ? {} : { boardNames: options.boardNames } };
    return parse(root, [name, ...rest], strict).kind === "run";
  } catch (error) {
    if (error instanceof UserInputError)
      return false;
    throw error;
  }
}
function requireChild(node, name) {
  const child = findChild(node, name);
  if (child === undefined)
    throw new Error(`Command tree has no ${name}`);
  return child;
}
function usageMessage(path) {
  const help = path.length === 0 ? "todo help" : `${commandLine(path)} --help`;
  return `Usage: ${formatUsage(path).join(`
       `)}
Run '${help}' for details.`;
}
function bind(path, node, tokens, options) {
  const positionals = [];
  const flags = new Map;
  let flagsEnded = false;
  for (let index = 0;index < tokens.length; index += 1) {
    const token = tokens[index];
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
      if (inline !== undefined)
        throw new UserInputError(`${spelling} takes no value`);
      flags.set(flag.name, true);
      continue;
    }
    let value = inline;
    if (value === undefined) {
      const next = tokens[index + 1];
      if (next === undefined || next === "--" || isFlagToken(next))
        throw new UserInputError(`Missing value for ${spelling}`);
      const words = [next];
      index += 1;
      while (flag.greedy === true && index + 1 < tokens.length && tokens[index + 1] !== "--" && !isFlagToken(tokens[index + 1])) {
        words.push(tokens[index + 1]);
        index += 1;
      }
      value = words.join(" ");
    }
    if (value.length === 0)
      throw new UserInputError(`Missing value for ${spelling}`);
    flags.set(flag.name, validateValue(flag.value, value, spelling, options));
  }
  const values = new Map;
  let cursor = 0;
  for (const arg of node.args ?? []) {
    const taken = arg.variadic === true ? positionals.slice(cursor) : positionals.slice(cursor, cursor + 1);
    cursor += taken.length;
    if (taken.length === 0) {
      if (arg.optional === true)
        continue;
      throw new UserInputError(usageMessage(path));
    }
    if (cursor === taken.length)
      rejectNearChild(node, taken[0]);
    values.set(arg.name, taken.map((token) => validateArgument(node, arg, token, options)));
  }
  const extra = positionals[cursor];
  if (extra !== undefined) {
    if ((node.subcommands ?? []).length > 0)
      throw unknownChild(node, extra);
    throw new UserInputError(`Unexpected argument: ${extra}
${usageMessage(path)}`);
  }
  return new ParsedInput(path.map((step) => step.name), values, flags, positionals);
}
function rejectNearChild(node, token) {
  if (TASK_ID.test(token) || findClosest(token, childNames(node)) === undefined)
    return;
  throw unknownChild(node, token);
}
function validateArgument(node, arg, token, options) {
  try {
    const label = (node.args ?? []).length === 1 ? node.name : arg.name;
    return validateValue(arg.kind, token, label, options);
  } catch (error) {
    if (error instanceof UserInputError && !(error instanceof UnknownTokenError) && findClosest(token, childNames(node)) !== undefined) {
      throw unknownChild(node, token);
    }
    throw error;
  }
}
function validateValue(kind, raw, label, options = {}) {
  const value = validateShape(kind, raw, label, options);
  if (options.strict === true && options.tasks !== undefined)
    requireExisting(kind, value, options.tasks);
  return value;
}
function requireExisting(kind, value, tasks) {
  if (!taskValueExists(kind, value, tasks))
    throw new UserInputError(`No such task: ${value}`);
}
function taskValueExists(kind, value, tasks) {
  const pending = tasks.filter((task) => task.status === "pending");
  const id = value.replace(/^#/, "");
  const name = value.trim().toLowerCase();
  const matches = (task) => task.id === id || task.description.trim().toLowerCase() === name;
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
function validateShape(kind, raw, label, options) {
  if (typeof kind === "object")
    return chooseOne(kind.oneOf, raw, label);
  switch (kind) {
    case "task-id":
    case "pending-task-id":
    case "epic-id":
      if (!TASK_ID.test(raw.trim()))
        throw new UserInputError(`Invalid task ID: ${raw}`);
      return raw.trim().replace(/^#/, "");
    case "parent-id":
      if (["root", "top", "-"].includes(raw.trim()))
        return raw.trim();
      if (!TASK_ID.test(raw.trim()))
        throw new UserInputError(`Invalid parent: ${raw}. Use a task ID or root.`);
      return raw.trim().replace(/^#/, "");
    case "task-ids":
      if (!raw.split(",").every((part) => TASK_ID_LIST_PART.test(part.trim())))
        throw new UserInputError(`Invalid task ID list: ${raw}`);
      return raw;
    case "priority":
      return chooseOne(["none", "low", "medium", "high"], raw, label);
    case "count-or-all":
      if (!/^(\d+|all|unlimited)$/i.test(raw.trim()))
        throw new UserInputError(`Invalid count: ${raw}. Use a whole number or 'all'.`);
      return raw.trim().toLowerCase();
    case "minutes":
      if (!raw.split(",").every((part) => /^\d+$/.test(part.trim())))
        throw new UserInputError(`Invalid reminders: ${raw}`);
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
function chooseOne(choices, raw, label) {
  const match = choices.find((choice) => choice.toLowerCase() === raw.trim().toLowerCase());
  if (match !== undefined)
    return match;
  throw new UnknownTokenError(`Unknown value for ${label}: ${raw}`, raw, choices, "value");
}
function matchBoardName(raw, names) {
  if (names === undefined)
    return raw;
  const match = names.find((name) => name.toLowerCase() === raw.trim().toLowerCase());
  if (match !== undefined)
    return match;
  if (names.length === 0)
    throw new UserInputError(`No board named ${raw} \xB7 todo board new ${raw} creates it`);
  throw new UnknownTokenError(`Unknown board: ${raw}`, raw, names, "value");
}

// src/command-spec/execute.ts
async function executeCommand(root, argv, context, options = {}) {
  const result = parse(root, argv, options);
  if (result.kind === "help") {
    context.stdout.write(result.path.length === 0 ? formatHelpOverview(root) : formatCommandHelp(result.path));
    return;
  }
  await result.node.run?.(result.input, context);
}

// src/notifications.ts
import { spawnSync } from "child_process";
async function sendDueNotifications(store, now = Date.now()) {
  const tasks = await store.loadTasks();
  let changed = false;
  for (const task of tasks) {
    if (task.status !== "pending" || task.dueDate === undefined)
      continue;
    if (task.reminder !== undefined)
      continue;
    if (task.dueDate < now && !task.notificationsSent.overdue) {
      sendNotification("Task Overdue", `${task.description} - due ${formatDueDate(task.dueDate)}`);
      task.notificationsSent.overdue = true;
      changed = true;
    }
    for (const offset of task.reminderOffsets) {
      if (now < task.dueDate - offset * 60000 || task.notificationsSent.reminders.includes(offset))
        continue;
      sendNotification("Task Reminder", `${task.description} - due in ${offset} minutes`);
      task.notificationsSent.reminders.push(offset);
      changed = true;
    }
  }
  if (changed)
    await store.saveTasks(tasks);
}
function sendNotification(title, message) {
  spawnSync("notify-send", [title, message], { stdio: "ignore" });
}
function formatDueDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(timestamp);
}
function resetNotificationState(task) {
  task.notificationsSent = { reminders: [], overdue: false };
  if (task.reminder !== undefined)
    delete task.reminder.firedAt;
}

// src/domain/due-date.ts
var DEFAULT_TIME = { hours: 9, minutes: 0 };
var EVENING_TIME = { hours: 20, minutes: 0 };
var KEYWORD_DAY_OFFSETS = new Map([
  ["today", 0],
  ["tonight", 0],
  ["tomorrow", 1],
  ["yesterday", -1]
]);
var NUMBER_WORDS = new Map([
  ["a", 1],
  ["an", 1],
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
  ["eleven", 11],
  ["twelve", 12]
]);
var UNITS = new Map([
  ["m", "minute"],
  ["min", "minute"],
  ["mins", "minute"],
  ["minute", "minute"],
  ["minutes", "minute"],
  ["h", "hour"],
  ["hr", "hour"],
  ["hrs", "hour"],
  ["hour", "hour"],
  ["hours", "hour"],
  ["d", "day"],
  ["day", "day"],
  ["days", "day"],
  ["w", "week"],
  ["wk", "week"],
  ["wks", "week"],
  ["week", "week"],
  ["weeks", "week"],
  ["mo", "month"],
  ["mos", "month"],
  ["month", "month"],
  ["months", "month"],
  ["y", "year"],
  ["yr", "year"],
  ["yrs", "year"],
  ["year", "year"],
  ["years", "year"]
]);
var WEEKDAYS = new Map([
  ["sunday", 0],
  ["sun", 0],
  ["monday", 1],
  ["mon", 1],
  ["tuesday", 2],
  ["tue", 2],
  ["tues", 2],
  ["wednesday", 3],
  ["wed", 3],
  ["thursday", 4],
  ["thu", 4],
  ["thur", 4],
  ["thurs", 4],
  ["friday", 5],
  ["fri", 5],
  ["saturday", 6],
  ["sat", 6]
]);
var MONTHS = new Map([
  ["january", 1],
  ["jan", 1],
  ["february", 2],
  ["feb", 2],
  ["march", 3],
  ["mar", 3],
  ["april", 4],
  ["apr", 4],
  ["may", 5],
  ["june", 6],
  ["jun", 6],
  ["july", 7],
  ["jul", 7],
  ["august", 8],
  ["aug", 8],
  ["september", 9],
  ["sep", 9],
  ["sept", 9],
  ["october", 10],
  ["oct", 10],
  ["november", 11],
  ["nov", 11],
  ["december", 12],
  ["dec", 12]
]);
function parseDueDate(value, now = new Date) {
  const timestamp = tryParseDueDate(value, now);
  if (timestamp === undefined)
    throw new UserInputError(`Invalid due date: ${value}`);
  return timestamp;
}
function tryParseDueDate(value, now = new Date) {
  const original = value.trim().replace(/\s+/g, " ");
  if (original.length === 0)
    return;
  const { date, time } = splitDateAndTime(original.toLowerCase());
  for (const parse of DATE_PARSERS) {
    const timestamp = parse(date, time, now);
    if (timestamp !== undefined)
      return timestamp;
  }
  const native = Date.parse(original);
  return Number.isNaN(native) ? undefined : native;
}
function splitDateAndTime(input) {
  const tokens = input.split(" ");
  const last = tokens[tokens.length - 1];
  if (last === undefined)
    return { date: input, time: undefined };
  if ((last === "am" || last === "pm") && tokens.length >= 2) {
    const merged = parseTimeOfDay(`${tokens[tokens.length - 2]}${last}`);
    if (merged !== undefined)
      return { date: dropTrailingAt(tokens.slice(0, -2)), time: merged };
  }
  const time = parseTimeOfDay(last);
  if (time !== undefined)
    return { date: dropTrailingAt(tokens.slice(0, -1)), time };
  return { date: input, time: undefined };
}
function dropTrailingAt(tokens) {
  return (tokens[tokens.length - 1] === "at" ? tokens.slice(0, -1) : tokens).join(" ");
}
function parseTimeOfDay(token) {
  const match = token.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?(am|pm)?$/);
  if (match === null)
    return;
  const meridiem = match[3];
  if (!token.includes(":") && meridiem === undefined)
    return;
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  if (minutes > 59)
    return;
  let hours = Number(match[1]);
  if (meridiem !== undefined) {
    if (hours < 1 || hours > 12)
      return;
    hours = hours % 12 + (meridiem === "pm" ? 12 : 0);
  }
  if (hours > 23)
    return;
  return { hours, minutes };
}
function parseClockTime(date, time, now) {
  if (date.length > 0 || time === undefined)
    return;
  const target = withTime(now, time);
  if (target.getTime() <= now.getTime())
    target.setDate(target.getDate() + 1);
  return target.getTime();
}
function parseKeywordDate(date, time, now) {
  const offset = KEYWORD_DAY_OFFSETS.get(date);
  if (offset === undefined)
    return;
  const target = new Date(now);
  target.setDate(target.getDate() + offset);
  return withTime(target, time ?? (date === "tonight" ? EVENING_TIME : DEFAULT_TIME)).getTime();
}
function parseWeekdayDate(date, time, now) {
  const match = date.match(/^(?:(next|last|this|coming)\s+)?([a-z]+)$/);
  if (match === null)
    return;
  const weekday = WEEKDAYS.get(match[2] ?? "");
  if (weekday === undefined)
    return;
  const target = new Date(now);
  const current = target.getDay();
  const forward = (weekday - current + 7) % 7 || 7;
  const backward = (current - weekday + 7) % 7 || 7;
  target.setDate(target.getDate() + (match[1] === "last" ? -backward : forward));
  return withTime(target, time ?? DEFAULT_TIME).getTime();
}
function parseRelativeDate(date, time, now) {
  let tokens = date.split(" ");
  let past = false;
  if (tokens[tokens.length - 1] === "ago") {
    past = true;
    tokens = tokens.slice(0, -1);
  } else if (tokens.length >= 3 && tokens[tokens.length - 2] === "from" && tokens[tokens.length - 1] === "now") {
    tokens = tokens.slice(0, -2);
  }
  if (tokens[0] === "in")
    tokens = tokens.slice(1);
  const direction = tokens[0];
  if (tokens.length === 2 && (direction === "next" || direction === "last")) {
    const unit = UNITS.get(tokens[1] ?? "");
    if (unit === undefined)
      return;
    const target = shift(now, unit, direction === "next" ? 1 : -1);
    return withTime(target, time ?? (unit === "minute" || unit === "hour" ? undefined : DEFAULT_TIME)).getTime();
  }
  const [amountToken, unitToken] = readAmountAndUnit(tokens);
  if (amountToken === undefined || unitToken === undefined)
    return;
  const amount = readAmount(amountToken);
  const unit = UNITS.get(unitToken);
  if (amount === undefined || unit === undefined)
    return;
  return withTime(shift(now, unit, past ? -amount : amount), time).getTime();
}
function readAmountAndUnit(tokens) {
  if (tokens.length === 2)
    return [tokens[0], tokens[1]];
  if (tokens.length !== 1)
    return [undefined, undefined];
  const compact = (tokens[0] ?? "").match(/^([+-]?\d+)([a-z]+)$/);
  return compact === null ? [undefined, undefined] : [compact[1], compact[2]];
}
function readAmount(token) {
  const word = NUMBER_WORDS.get(token);
  if (word !== undefined)
    return word;
  return /^[+-]?\d+$/.test(token) ? Number(token) : undefined;
}
function parseCalendarDate(date, time, now) {
  const parts = date.split(/[/\-. ]+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 3)
    return;
  const monthNameIndex = parts.findIndex((part) => MONTHS.has(part));
  const fields = monthNameIndex === -1 ? readNumericDate(parts) : readNamedMonthDate(parts, monthNameIndex);
  if (fields === undefined)
    return;
  const year = fields.year ?? now.getFullYear();
  if (fields.month < 1 || fields.month > 12 || fields.day < 1 || fields.day > 31)
    return;
  const applied = time ?? DEFAULT_TIME;
  const target = new Date(year, fields.month - 1, fields.day, applied.hours, applied.minutes, 0, 0);
  const isRoundTrip = target.getFullYear() === year && target.getMonth() === fields.month - 1 && target.getDate() === fields.day;
  return isRoundTrip ? target.getTime() : undefined;
}
function readNumericDate(parts) {
  if (!parts.every((part) => /^\d+$/.test(part)))
    return;
  const numbers = parts.map(Number);
  if (parts.length === 3) {
    const [first, second, third] = numbers;
    if (third === undefined)
      return;
    if ((parts[0] ?? "").length === 4)
      return { year: first, month: second, day: third };
    if (second > 12 && first <= 12)
      return { year: expandYear(third), month: first, day: second };
    return { year: expandYear(third), month: second, day: first };
  }
  const [first, second] = numbers;
  if (second > 12 && first <= 12)
    return { year: undefined, month: first, day: second };
  return { year: undefined, month: second, day: first };
}
function readNamedMonthDate(parts, monthNameIndex) {
  const month = MONTHS.get(parts[monthNameIndex] ?? "");
  if (month === undefined)
    return;
  const rest = parts.filter((_, index) => index !== monthNameIndex);
  if (!rest.every((part) => /^\d+$/.test(part)))
    return;
  if (rest.length === 1) {
    const value = Number(rest[0]);
    if ((rest[0] ?? "").length === 4 || value > 31)
      return { year: expandYear(value), month, day: 1 };
    return { year: undefined, month, day: value };
  }
  if (rest.length !== 2)
    return;
  const first = Number(rest[0]);
  const second = Number(rest[1]);
  if ((rest[0] ?? "").length === 4 || first > 31)
    return { year: expandYear(first), month, day: second };
  return { year: expandYear(second), month, day: first };
}
function expandYear(year) {
  return year < 100 ? 2000 + year : year;
}
function shift(now, unit, amount) {
  const target = new Date(now);
  if (unit === "minute")
    target.setMinutes(target.getMinutes() + amount);
  else if (unit === "hour")
    target.setHours(target.getHours() + amount);
  else if (unit === "day")
    target.setDate(target.getDate() + amount);
  else if (unit === "week")
    target.setDate(target.getDate() + amount * 7);
  else if (unit === "month")
    addMonths(target, amount);
  else
    addMonths(target, amount * 12);
  return target;
}
function addMonths(target, amount) {
  const day = target.getDate();
  target.setDate(1);
  target.setMonth(target.getMonth() + amount);
  target.setDate(Math.min(day, daysInMonth(target.getFullYear(), target.getMonth())));
}
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function withTime(date, time) {
  const target = new Date(date);
  if (time !== undefined)
    target.setHours(time.hours, time.minutes, 0, 0);
  return target;
}
var DATE_PARSERS = [parseClockTime, parseKeywordDate, parseWeekdayDate, parseRelativeDate, parseCalendarDate];

// src/domain/boards.ts
var LANE_LABELS = { now: "Now", later: "Later" };
function findBoard(state, name) {
  const needle = name.trim().toLowerCase();
  return state.boards.find((board) => board.name.toLowerCase() === needle);
}
function requireBoard(state, name) {
  const board = findBoard(state, name);
  if (board !== undefined)
    return board;
  const names = state.boards.map((candidate) => candidate.name);
  if (names.length === 0)
    throw new UserInputError(`No board named ${name} \xB7 todo board new ${name} creates it`);
  throw new UnknownTokenError(`Unknown board: ${name}`, name, names, "value");
}
function getActiveBoard(state) {
  return state.active === undefined ? undefined : findBoard(state, state.active);
}
function isTimed(board) {
  return board.expiresAt !== undefined;
}
function isExpired(board, now = Date.now()) {
  return board.expiresAt !== undefined && board.expiresAt <= now;
}
function remainingMs(board, now = Date.now()) {
  return board.expiresAt === undefined ? Number.POSITIVE_INFINITY : Math.max(0, board.expiresAt - now);
}
function laneOf(board, tasks, id) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set;
  let current = id;
  while (current !== undefined && !seen.has(current)) {
    if (board.now.includes(current))
      return "now";
    if (board.later.includes(current))
      return "later";
    seen.add(current);
    current = byId.get(current)?.parentId;
  }
  return;
}
function collectLaneIds(board, tasks, lane) {
  return new Set(tasks.filter((task) => laneOf(board, tasks, task.id) === lane).map((task) => task.id));
}
function findListedAncestor(board, tasks, id) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set([id]);
  let current = byId.get(id)?.parentId;
  while (current !== undefined && !seen.has(current)) {
    if (board.now.includes(current) || board.later.includes(current))
      return current;
    seen.add(current);
    current = byId.get(current)?.parentId;
  }
  return;
}
function placeOnBoard(board, tasks, id, lane) {
  const ancestor = findListedAncestor(board, tasks, id);
  if (ancestor !== undefined) {
    throw new UserInputError(`#${id} sits under #${ancestor} on ${board.name} and moves with it \xB7 move #${ancestor} instead`);
  }
  const current = board.now.includes(id) ? "now" : board.later.includes(id) ? "later" : undefined;
  const folded = collectDescendantIds([...tasks], [id]);
  const keep = (item) => item !== id && !folded.has(item);
  const next = { ...board, now: board.now.filter(keep), later: board.later.filter(keep) };
  next[lane] = [...next[lane], id];
  return { board: next, change: current === undefined ? "added" : current === lane ? "unchanged" : "moved" };
}
function takeOffBoard(board, tasks, id) {
  if (board.now.includes(id) || board.later.includes(id)) {
    return { board: { ...board, now: board.now.filter((item) => item !== id), later: board.later.filter((item) => item !== id) }, removed: true };
  }
  const ancestor = findListedAncestor(board, tasks, id);
  if (ancestor !== undefined) {
    throw new UserInputError(`#${id} sits under #${ancestor} on ${board.name} \xB7 take #${ancestor} off instead`);
  }
  return { board, removed: false };
}
function moveBetweenBoards(state, tasks, id, fromName, toName, lane) {
  const from = requireBoard(state, fromName);
  const to = requireBoard(state, toName);
  if (from.name === to.name)
    throw new UserInputError(`#${id} is already on ${to.name}`);
  const currentLane = laneOf(from, tasks, id);
  if (currentLane === undefined)
    throw new UserInputError(`#${id} is not on ${from.name}`);
  const taken = takeOffBoard(from, tasks, id);
  const target = lane ?? currentLane;
  const placed = placeOnBoard(to, tasks, id, target);
  return { state: replaceBoard(replaceBoard(state, from.name, taken.board), to.name, placed.board), from, to, lane: target };
}
function replaceBoard(state, name, board) {
  const needle = name.toLowerCase();
  return { ...state, boards: state.boards.map((candidate) => candidate.name.toLowerCase() === needle ? board : candidate) };
}
function createBoard(state, name, now, durationMs) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0)
    throw new UserInputError("A board needs a name");
  if (findBoard(state, trimmed) !== undefined)
    throw new UserInputError(`A board named ${trimmed} already exists \xB7 todo board use ${trimmed}`);
  const board = { name: trimmed, createdAt: now, ...durationMs === undefined ? {} : { expiresAt: now + durationMs }, now: [], later: [] };
  return { state: { active: board.name, boards: [...state.boards, board] }, board };
}
function renameBoard(state, from, to) {
  const board = requireBoard(state, from);
  const trimmed = to.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0)
    throw new UserInputError("A board needs a name");
  const clash = findBoard(state, trimmed);
  if (clash !== undefined && clash !== board)
    throw new UserInputError(`A board named ${clash.name} already exists`);
  const renamed = replaceBoard(state, board.name, { ...board, name: trimmed });
  const wasActive = state.active !== undefined && state.active.toLowerCase() === board.name.toLowerCase();
  return wasActive ? { ...renamed, active: trimmed } : renamed;
}
function deleteBoard(state, name) {
  const needle = name.toLowerCase();
  const boards = state.boards.filter((board) => board.name.toLowerCase() !== needle);
  return state.active !== undefined && state.active.toLowerCase() === needle ? { boards } : { ...state, boards };
}
function extendBoard(board, durationMs, now = Date.now()) {
  if (!isTimed(board))
    throw new UserInputError(`${board.name} has no timer \xB7 only timed boards can be extended`);
  const expiresAt = Math.max(board.expiresAt, now) + durationMs;
  if (expiresAt > now + MAX_BOARD_DURATION_MS)
    throw new UserInputError("A board can run at most 24h from now");
  return { ...board, expiresAt };
}
function purgeTaskIds(state, ids) {
  return {
    ...state,
    boards: state.boards.map((board) => ({ ...board, now: board.now.filter((id) => !ids.has(id)), later: board.later.filter((id) => !ids.has(id)) }))
  };
}
function collectSessionRoots(board, tasks) {
  return tasks.filter((task) => task.parentId === undefined && task.createdAt >= board.createdAt && (board.now.includes(task.id) || board.later.includes(task.id)));
}
function defaultBoardName(state, timestamp) {
  const base = `Focus ${formatBoardDate(timestamp)}`;
  if (findBoard(state, base) === undefined)
    return base;
  for (let suffix = 2;; suffix += 1) {
    const candidate = `${base} (${suffix})`;
    if (findBoard(state, candidate) === undefined)
      return candidate;
  }
}
var MONTHS2 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatBoardDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.getDate()} ${MONTHS2[date.getMonth()]}`;
}
function migrateLegacyFocus(legacy, tasks) {
  const excluded = new Set(legacy.excluded ?? []);
  const seeds = [...legacy.pinned ?? [], ...tasks.filter((task) => task.createdAt >= legacy.startedAt).map((task) => task.id)].filter((id) => !excluded.has(id));
  const members = new Set(seeds);
  for (const id of collectDescendantIds([...tasks], seeds)) {
    if (!excluded.has(id))
      members.add(id);
  }
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const roots = [...members].filter((id) => {
    const parentId = byId.get(id)?.parentId;
    return parentId === undefined || !members.has(parentId);
  });
  const later = (legacy.later ?? []).filter((id) => members.has(id));
  const name = legacy.title === undefined || legacy.title.trim() === "" ? `Focus ${formatBoardDate(legacy.startedAt)}` : legacy.title.trim();
  const board = {
    name,
    createdAt: legacy.startedAt,
    expiresAt: legacy.expiresAt,
    now: roots.filter((id) => !later.includes(id)).sort(compareIds),
    later
  };
  return legacy.hidden === true ? { boards: [board] } : { active: name, boards: [board] };
}
function compareIds(left, right) {
  return Number(left) - Number(right);
}
function normalizeBoards(value) {
  if (typeof value !== "object" || value === null)
    return { boards: [] };
  const raw = value;
  const boards = (Array.isArray(raw.boards) ? raw.boards : []).flatMap((entry) => {
    if (typeof entry !== "object" || entry === null)
      return [];
    const board = entry;
    if (typeof board.name !== "string" || board.name.trim() === "")
      return [];
    const ids = (list) => Array.isArray(list) ? list.filter((id) => typeof id === "string") : [];
    return [{
      name: board.name,
      createdAt: typeof board.createdAt === "number" ? board.createdAt : 0,
      ...typeof board.expiresAt === "number" ? { expiresAt: board.expiresAt } : {},
      now: ids(board.now),
      later: ids(board.later)
    }];
  });
  const state = { boards };
  if (typeof raw.active === "string") {
    const active = findBoard(state, raw.active);
    if (active !== undefined)
      state.active = active.name;
  }
  return state;
}

// src/services/boards.ts
async function loadBoards(store, now = Date.now()) {
  let state = await store.loadBoardsFile();
  if (state === undefined) {
    const legacy = await store.loadLegacyFocus();
    state = legacy === undefined ? { boards: [] } : migrateLegacyFocus(legacy, await store.loadTasks());
    if (legacy !== undefined) {
      await store.saveBoards(state);
      await store.deleteLegacyFocus();
    }
  }
  const expired = state.boards.filter((board) => isExpired(board, now));
  if (expired.length === 0)
    return state;
  for (const board of expired) {
    await wrapUpBoard(store, board, now);
    state = deleteBoard(state, board.name);
  }
  await store.saveBoards(state);
  return state;
}
async function readBoardNames(store) {
  const state = await store.loadBoardsFile();
  return state?.boards.map((board) => board.name) ?? [];
}
async function wrapUpBoard(store, board, now = Date.now()) {
  const tasks = await store.loadTasks();
  const sessionRoots = collectSessionRoots(board, tasks);
  if (board.expiresAt === undefined || sessionRoots.length === 0)
    return;
  const epic = {
    id: `${nextTaskId(tasks)}`,
    description: board.name,
    status: sessionRoots.every((task) => task.status === "completed") ? "completed" : "pending",
    priority: "none",
    kind: "epic",
    createdAt: board.createdAt,
    updatedAt: now,
    reminderOffsets: [],
    notificationsSent: { reminders: [], overdue: false }
  };
  for (const task of sessionRoots) {
    task.parentId = epic.id;
    task.updatedAt = now;
  }
  await store.saveTasks([...tasks, epic]);
  return epic;
}
async function placeNewTasks(store, state, tasks, created, placement) {
  const board = getActiveBoard(state);
  if (board === undefined || placement.offBoard === true || created.length === 0)
    return;
  const lane = placement.later === true ? "later" : "now";
  let next = board;
  for (const task of created) {
    if (laneOfParent(next, tasks, task) !== undefined)
      continue;
    next = placeOnBoard(next, tasks, task.id, lane).board;
  }
  await store.saveBoards(replaceBoard(state, board.name, next));
}
function checkPlacement(state, tasks, parentIds, placement) {
  if (placement.later === true && placement.offBoard === true)
    throw new UserInputError("--later and --off-board contradict each other");
  if (placement.later !== true)
    return;
  const board = getActiveBoard(state);
  if (board === undefined)
    throw new UserInputError("--later needs an active board \xB7 todo board use <name> or todo board new <name>");
  for (const parentId of parentIds) {
    if (parentId === undefined)
      continue;
    const parentLane = laneOf(board, tasks, parentId);
    if (parentLane === "now")
      throw new UserInputError(`#${parentId} is in Now on ${board.name}; its subtasks follow it \xB7 move #${parentId} to Later instead`);
  }
}
function laneOfParent(board, tasks, task) {
  return task.parentId === undefined ? undefined : laneOf(board, tasks, task.parentId);
}
function nextTaskId(tasks) {
  const numericIds = tasks.map((task) => Number.parseInt(task.id, 10)).filter((id) => Number.isFinite(id));
  return (numericIds.length === 0 ? 0 : Math.max(...numericIds)) + 1;
}

// src/plugins/add.ts
var PLACEMENT_FLAGS = [
  { name: "later", description: "Put the new tasks in the active board's Later lane" },
  { name: "off-board", description: "Keep the new tasks off the active board" }
];
var TASK_FLAGS = [
  { name: "due", value: "due-time", greedy: true, description: "Due date: 1h, 30m, tomorrow, monday, next week, 16/08/2026" },
  { name: "priority", value: "priority", description: "none (default), low, medium, or high" },
  { name: "reminders", aliases: ["remind"], value: "minutes", description: "Comma list of minutes before the due date to notify" }
];
var UNDER_FLAG = { name: "under", aliases: ["parent", "in"], value: "task-id", description: "Nest the new tasks under an existing task" };
var addCommand = {
  name: "add",
  summary: "Add one or more tasks.",
  group: "Create",
  args: [{ name: "description", kind: "text", variadic: true, description: "Task text; separate several tasks with commas" }],
  flags: [...TASK_FLAGS, UNDER_FLAG, ...PLACEMENT_FLAGS],
  details: [
    "The add verb is optional: any unknown first word starts a task description.",
    "Separate several tasks with commas. Use a standalone -- when a description itself starts with a dash.",
    "While a board is active, new tasks join its Now lane; --later puts them in Later, --off-board keeps them off.",
    "There is no --on for add. Activate the board first with `todo board use <name>`, or place the task afterwards with `todo board add <id> --on <name>`."
  ],
  examples: [
    { command: "todo buy oat milk", note: "implicit add" },
    { command: "todo buy oat milk, call dentist --priority high", note: "two tasks, both high" },
    { command: "todo add call dentist --due tomorrow --reminders 10,30" },
    { command: "todo add polish hero --under 2", note: "subtask of #2" },
    { command: "todo add read that paper --later", note: "Later lane of the active board" },
    { command: "todo add renew passport --off-board", note: "on no board" },
    { command: "todo add -- -v flag is broken", note: "text that starts with a dash" }
  ],
  async run(input, { store, stdout }) {
    const tasks = await insertTasks(store, readAddOptions(input), readPlacement(input));
    for (const task of tasks)
      stdout.write(formatAddedTask(task));
  }
};
function readPlacement(input) {
  return { later: input.flag("later"), offBoard: input.flag("off-board") };
}
function parseAddArguments(args, now = new Date) {
  const result = parse({ name: "todo", summary: "", subcommands: [addCommand] }, ["add", ...args]);
  if (result.kind !== "run")
    throw new UserInputError("Usage: todo add <description>[, <description>]");
  return readAddOptions(result.input, now);
}
function readAddOptions(input, now = new Date, defaults = {}, words = input.args("description")) {
  const descriptions = parseDescriptions(words);
  if (descriptions.length === 0)
    throw new UserInputError("Usage: todo add <description>[, <description>]");
  const options = { priority: "none", ...defaults };
  const priority = input.value("priority");
  if (priority !== undefined)
    options.priority = priority;
  const due = input.value("due");
  if (due !== undefined)
    options.dueDate = parseDueDate(due, now);
  const reminders = input.value("reminders");
  if (reminders !== undefined)
    options.reminderOffsets = reminders.split(",").map((offset) => Number(offset.trim()));
  const under = input.value("under");
  if (under !== undefined)
    options.parentId = under;
  return descriptions.map((description) => ({ ...options, description }));
}
async function createTasks(store, args, defaults = {}) {
  const options = parseAddArguments(args).map((option) => ({ ...option, ...defaults }));
  return await insertTasks(store, options, {});
}
async function insertTasks(store, options, placement) {
  const tasks = await store.loadTasks();
  const config = await store.loadConfig();
  const now = Date.now();
  for (const option of options) {
    if (option.parentId !== undefined)
      findTask(tasks, option.parentId);
  }
  const boards = await loadBoards(store, now);
  checkPlacement(boards, tasks, options.map((option) => option.parentId), placement);
  const firstId = nextTaskId(tasks);
  const created = options.map((option, index) => createTask(option, firstId + index, now, config.defaultReminderOffsets));
  const allTasks = [...tasks, ...created];
  await store.saveTasks(allTasks);
  await placeNewTasks(store, boards, allTasks, created, placement);
  return created;
}
function formatAddedTask(task) {
  const noun = task.kind === "epic" ? "epic" : "task";
  const location = task.parentId === undefined ? "" : ` under #${task.parentId}`;
  return `Added ${noun} ${task.id}${location}: ${task.description}
`;
}
function parseDescriptions(parts) {
  const descriptions = [];
  let words = [];
  function finishDescription() {
    const description = words.join(" ").trim();
    if (description.length > 0)
      descriptions.push(description);
    words = [];
  }
  for (const part of parts) {
    const startsWithSeparator = part.startsWith(",");
    const endsWithSeparator = part.endsWith(",");
    if (startsWithSeparator)
      finishDescription();
    const word = part.slice(startsWithSeparator ? 1 : 0, endsWithSeparator ? -1 : undefined);
    if (word.length > 0)
      words.push(word);
    if (endsWithSeparator)
      finishDescription();
  }
  finishDescription();
  return descriptions;
}
function createTask(options, id, now, defaultReminderOffsets) {
  const task = {
    id: `${id}`,
    description: options.description,
    status: "pending",
    priority: options.priority,
    createdAt: now,
    updatedAt: now,
    reminderOffsets: options.reminderOffsets ?? defaultReminderOffsets,
    notificationsSent: { reminders: [], overdue: false }
  };
  if (options.dueDate !== undefined)
    task.dueDate = options.dueDate;
  if (options.parentId !== undefined)
    task.parentId = options.parentId;
  if (options.kind !== undefined)
    task.kind = options.kind;
  return task;
}
function parseTaskIdArgument(value) {
  const id = value.trim().replace(/^#/, "");
  if (!/^\d+$/.test(id))
    throw new UserInputError(`Invalid task ID: ${value}`);
  return id;
}

// src/plugins/archive.ts
import { emitKeypressEvents } from "readline";

// src/plugins/undo.ts
var DIM2 = "\x1B[2m";
var GREEN = "\x1B[32m";
var RESET2 = "\x1B[0m";
var undoCommand = {
  name: "undo",
  aliases: ["revert", "restore"],
  summary: "Restore the most recently deleted task or tasks.",
  group: "Remove",
  details: ["Only the most recent rm, rm all, or taskboard delete is kept. Restored tasks get fresh IDs and do not return to boards."],
  examples: [
    { command: "todo undo", note: "bring back what the last rm removed, under new IDs" },
    { command: "todo archive restore r3", note: "an older removal" }
  ],
  async run(_input, { store, stdout }) {
    const undo = await store.loadUndo();
    if (undo === undefined || undo.tasks.length === 0) {
      stdout.write(`${DIM2}Nothing to undo${RESET2}
`);
      return;
    }
    const tasks = await store.loadTasks();
    const restoredTasks = restoreTasks(tasks, undo.tasks);
    await store.saveTasks([...tasks, ...restoredTasks]);
    await store.forgetRemovedBatch(undo.timestamp);
    await store.clearUndo();
    stdout.write(`${GREEN}Restored ${restoredTasks.length} task(s)${RESET2}
`);
  }
};
var snoozeCommand = {
  name: "snooze",
  summary: "Push a task's due date forward.",
  group: "Change",
  args: [
    { name: "id", kind: "task-id", description: "Task to snooze" },
    { name: "time", kind: "due-time", variadic: true, description: "1h, 30m, tomorrow, monday, next week, 16/08/2026" }
  ],
  details: ["Sets a new due date and resets reminder notifications for the task."],
  examples: [
    { command: "todo snooze 4 1h" },
    { command: "todo snooze 4 tomorrow" },
    { command: "todo snooze 4 next week" },
    { command: "todo snooze 4 16/08/2026" }
  ],
  async run(input, { store, stdout }) {
    const id = input.arg("id");
    const dueDate = tryParseDueDate(input.args("time").join(" "));
    if (dueDate === undefined)
      throw new UserInputError("Invalid snooze time");
    const tasks = await store.loadTasks();
    const task = tasks.find((item) => item.id === id);
    if (task === undefined)
      throw new UserInputError(`Task not found: ${id}`);
    task.dueDate = dueDate;
    task.updatedAt = Date.now();
    if (task.reminder !== undefined)
      task.reminder.dueAt = dueDate;
    resetNotificationState(task);
    await store.saveTasks(tasks);
    stdout.write(`${GREEN}Snoozed #${task.id}${RESET2}
`);
  }
};
function restoreTasks(tasks, deletedTasks) {
  let nextId = nextTaskId(tasks);
  const existingIds = new Set(tasks.map((task) => task.id));
  const idMap = new Map(deletedTasks.map((task) => [task.id, `${nextId++}`]));
  const now = Date.now();
  return deletedTasks.map((task) => {
    const restored = { ...task, id: idMap.get(task.id) ?? task.id, updatedAt: now };
    const parentId = task.parentId === undefined ? undefined : idMap.get(task.parentId) ?? (existingIds.has(task.parentId) ? task.parentId : undefined);
    if (parentId === undefined)
      delete restored.parentId;
    else
      restored.parentId = parentId;
    return restored;
  });
}

// src/domain/archive.ts
function buildArchiveEntries(tasks, removed) {
  const done = tasks.filter((task) => task.status === "completed").map((task) => ({ kind: "done", ref: `#${task.id}`, at: task.updatedAt, task }));
  const gone = removed.map((entry) => ({ kind: "removed", ref: `r${entry.ref}`, at: entry.removedAt, task: entry.task }));
  return [...done, ...gone].sort((left, right) => right.at - left.at);
}
function filterArchive(entries, filter) {
  const needle = filter.query?.trim().toLowerCase() ?? "";
  return entries.filter((entry) => (filter.kind === undefined || entry.kind === filter.kind) && (filter.since === undefined || entry.at >= filter.since) && (filter.until === undefined || entry.at <= filter.until) && (needle.length === 0 || entry.task.description.toLowerCase().includes(needle) || entry.ref === needle));
}
function parseArchiveDate(value, now = new Date) {
  const shorthand = value.trim().match(/^(\d+)([hdw])$/i);
  const timestamp = tryParseDueDate(shorthand ? `-${shorthand[1]}${shorthand[2]}` : value, now);
  if (timestamp === undefined)
    throw new UserInputError(`Invalid date: ${value}`);
  return timestamp;
}
function parseArchiveArgs(args, now = new Date) {
  const filter = {};
  const words = [];
  let interactive = false;
  for (let index = 0;index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--removed" || arg === "--deleted")
      filter.kind = "removed";
    else if (arg === "--done" || arg === "--completed")
      filter.kind = "done";
    else if (arg === "-i" || arg === "--interactive")
      interactive = true;
    else if (arg === "--since" || arg === "--until") {
      const value = args[index + 1];
      if (value === undefined)
        throw new UserInputError(`Missing value for ${arg}`);
      filter[arg === "--since" ? "since" : "until"] = parseArchiveDate(value, now);
      index += 1;
    } else if (arg.startsWith("--"))
      throw new UserInputError(`Unknown option: ${arg}`);
    else
      words.push(arg);
  }
  if (words.length > 0)
    filter.query = words.join(" ");
  return { filter, interactive };
}
function restoreArchiveEntries(tasks, removed, refs, parentId, now = Date.now()) {
  if (typeof parentId === "string" && !tasks.some((task) => task.id === parentId && task.status === "pending")) {
    throw new UserInputError(`Parent task not found: ${parentId}`);
  }
  const removedRefs = new Set;
  const doneIds = new Set;
  for (const raw of refs) {
    const ref = raw.trim().toLowerCase();
    const removedMatch = ref.match(/^r(\d+)$/);
    if (removedMatch)
      removedRefs.add(Number(removedMatch[1]));
    else if (/^#?\d+$/.test(ref))
      doneIds.add(ref.replace(/^#/, ""));
    else
      throw new UserInputError(`Invalid archive reference: ${raw} (use r3 for removed, #12 for completed)`);
  }
  const picked = removed.filter((entry) => removedRefs.has(entry.ref));
  const missingRemoved = [...removedRefs].filter((ref) => !picked.some((entry) => entry.ref === ref));
  const reopened = tasks.filter((task) => doneIds.has(task.id) && task.status === "completed");
  const missingDone = [...doneIds].filter((id) => !reopened.some((task) => task.id === id));
  const missing = [...missingRemoved.map((ref) => `r${ref}`), ...missingDone.map((id) => `#${id}`)];
  if (missing.length > 0)
    throw new UserInputError(`Not in archive: ${missing.join(", ")}`);
  const recreated = restoreTasks(tasks, picked.map((entry) => entry.task));
  const recreatedIds = new Set(recreated.map((task) => task.id));
  for (const task of recreated) {
    task.status = "pending";
    if (parentId !== undefined && (task.parentId === undefined || !recreatedIds.has(task.parentId)))
      assignParent(task, parentId);
  }
  for (const task of reopened) {
    task.status = "pending";
    task.updatedAt = now;
    if (parentId !== undefined && parentId !== task.id)
      assignParent(task, parentId);
  }
  return {
    tasks: [...tasks, ...recreated],
    removed: removed.filter((entry) => !removedRefs.has(entry.ref)),
    restored: [...recreated, ...reopened]
  };
}
function assignParent(task, parentId) {
  if (parentId === null)
    delete task.parentId;
  else
    task.parentId = parentId;
}

// src/presentation/due-format.ts
var MINUTE_MS = 60000;
var HOUR_MS = 60 * MINUTE_MS;
var DAY_MS = 24 * HOUR_MS;
var SOON_WINDOW_MS = 30 * MINUTE_MS;
var DUE_COLORS = {
  reset: "\x1B[0m",
  dim: "\x1B[2m",
  bold: "\x1B[1m",
  overdue: "\x1B[38;5;203m",
  soon: "\x1B[38;5;229m",
  upcoming: "\x1B[38;5;116m",
  label: "\x1B[38;5;147m"
};
var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function getDueUrgency(dueAt, now) {
  if (dueAt < now)
    return "overdue";
  return dueAt - now <= SOON_WINDOW_MS ? "soon" : "upcoming";
}
function getUrgencyColor(dueAt, now) {
  return DUE_COLORS[getDueUrgency(dueAt, now)];
}
function formatAbsoluteDue(dueAt) {
  const date = new Date(dueAt);
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = MONTH_NAMES[date.getMonth()];
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${day} ${month} ${date.getFullYear()} \xB7 ${hours}:${minutes}`;
}
function formatRelativeDue(dueAt, now) {
  const difference = dueAt - now;
  const parts = splitDuration(Math.abs(difference), 2);
  return difference < 0 ? `overdue by ${parts}` : `in ${parts}`;
}
function formatCompactDue(dueAt, now) {
  if (dueAt < now)
    return `overdue ${splitDuration(now - dueAt, 1)}`;
  const difference = dueAt - now;
  if (difference < HOUR_MS)
    return `due in ${splitDuration(difference, 1)}`;
  const dayGap = countCalendarDaysBetween(now, dueAt);
  if (dayGap === 0)
    return `due in ${splitDuration(difference, 1)}`;
  if (dayGap === 1)
    return "due tomorrow";
  return `due ${formatShortDate(dueAt, now)}`;
}
function formatShortDate(dueAt, now) {
  const date = new Date(dueAt);
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear() === new Date(now).getFullYear() ? "" : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${month}${year}`;
}
function formatSound(reminder) {
  if (reminder.soundMode === "none")
    return "none";
  if (reminder.soundMode === "default")
    return "default";
  return reminder.soundPath ?? "custom";
}
function formatNotifyState(reminder) {
  return reminder.firedAt === undefined ? "enabled" : `fired ${formatAbsoluteDue(reminder.firedAt)}`;
}
function countCalendarDaysBetween(from, to) {
  const start = startOfDay(new Date(from));
  const end = startOfDay(new Date(to));
  return Math.round((end - start) / DAY_MS);
}
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
function splitDuration(milliseconds, maximumParts) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const units = [
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
    [1, "s"]
  ];
  const parts = [];
  let remaining = totalSeconds;
  for (const [size, suffix] of units) {
    const amount = Math.floor(remaining / size);
    if (amount === 0 && parts.length === 0)
      continue;
    if (amount > 0)
      parts.push(`${amount}${suffix}`);
    remaining -= amount * size;
    if (parts.length >= maximumParts)
      break;
  }
  return parts.length === 0 ? "0s" : parts.join(" ");
}

// src/presentation/ansi-text.ts
var ANSI_PATTERN = /\u001B\[[0-9;]*m/g;
function stripAnsi(value) {
  return value.replace(ANSI_PATTERN, "");
}
function getVisibleWidth(value) {
  return stripAnsi(value).length;
}
function clipVisible(value, width) {
  if (width <= 0)
    return "";
  if (getVisibleWidth(value) <= width)
    return value;
  let result = "";
  let visible = 0;
  for (const token of tokenize(value)) {
    if (token.escape) {
      result += token.text;
      continue;
    }
    for (const character of token.text) {
      if (visible === width)
        return `${result}\x1B[0m`;
      result += character;
      visible += 1;
    }
  }
  return `${result}\x1B[0m`;
}
function highlightVisibleRanges(value, ranges, on, off) {
  if (ranges.length === 0)
    return value;
  const starts = new Map(ranges.map((range) => [range.start, range]));
  const ends = new Map(ranges.map((range) => [range.end, range]));
  let result = "";
  let visible = 0;
  let activeOff;
  for (const token of tokenize(value)) {
    if (token.escape) {
      result += token.text;
      continue;
    }
    for (const character of token.text) {
      const ending = ends.get(visible);
      if (activeOff !== undefined && ending !== undefined) {
        result += activeOff;
        activeOff = undefined;
      }
      const starting = starts.get(visible);
      if (starting !== undefined) {
        result += starting.on ?? on;
        activeOff = starting.off ?? off;
      }
      result += character;
      visible += 1;
    }
  }
  return activeOff === undefined ? result : `${result}${activeOff}`;
}
function tokenize(value) {
  const tokens = [];
  let lastIndex = 0;
  for (const match of value.matchAll(ANSI_PATTERN)) {
    if (match.index > lastIndex)
      tokens.push({ text: value.slice(lastIndex, match.index), escape: false });
    tokens.push({ text: match[0], escape: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < value.length)
    tokens.push({ text: value.slice(lastIndex), escape: false });
  return tokens;
}

// src/plugins/archive.ts
var DIM3 = "\x1B[2m";
var GREEN2 = "\x1B[32m";
var RED = "\x1B[38;5;203m";
var MAUVE = "\x1B[38;5;147m";
var SELECTED = "\x1B[48;5;60m";
var RESET3 = "\x1B[0m";
var archiveCommand = {
  name: "archive",
  aliases: ["removed", "trash"],
  summary: "List completed and removed tasks, newest first.",
  group: "View",
  args: [{ name: "text", kind: "text", variadic: true, optional: true, description: "Only entries whose description contains this" }],
  flags: [
    { name: "removed", aliases: ["deleted"], description: "Only removed tasks" },
    { name: "done", aliases: ["completed"], description: "Only completed tasks" },
    { name: "since", value: "due-time", description: "Newer than: 7d, 12h, 2w (ago) or a date" },
    { name: "until", value: "due-time", description: "Older than: 7d, 12h, 2w (ago) or a date" },
    { name: "interactive", short: "i", description: "Open the restore picker" }
  ],
  details: [
    "`todo rm` never deletes: removed tasks are kept in ~/.dotfiles/todo/removed.json as r<n>.",
    "Completed tasks are listed as #<id>. Restoring a removed task recreates it with a fresh ID; restoring a completed one reopens it.",
    "Dates accept 7d/12h/2w (ago) or any due-date form (yesterday, 16/08/2026).",
    "-i opens a picker: type to filter, Tab cycles all/removed/done, Space marks, Enter restores, Ctrl+T restores under a chosen parent."
  ],
  examples: [
    { command: "todo archive --removed --since 7d" },
    { command: "todo archive groceries" },
    { command: "todo archive restore r3 r4", note: "recreate two removed tasks" },
    { command: "todo archive restore r3 --to 12", note: "recreate under task #12" },
    { command: "todo archive -i" }
  ],
  subcommands: [
    {
      name: "restore",
      summary: "Bring archived tasks back.",
      args: [{ name: "ref", kind: "archive-ref", variadic: true, description: "r<n> for removed tasks, #<id> or <id> for completed ones" }],
      flags: [{ name: "to", value: "parent-id", description: "Restore under this task, or top for the top level" }],
      details: ["Removed tasks come back with fresh IDs; completed ones reopen with their own ID. Find refs with `todo archive`."],
      examples: [
        { command: "todo archive restore r3" },
        { command: "todo archive restore r3,r4 #12", note: "two removed tasks and a completed one" },
        { command: "todo archive restore r3 --to 12", note: "under task #12" },
        { command: "todo archive restore r3 --to top", note: "at the top level" }
      ],
      async run(input, { store, stdout }) {
        const to = input.value("to");
        const parentId = to === undefined ? undefined : to === "top" || to === "root" || to === "-" ? null : to;
        const refs = input.args("ref").flatMap((ref) => ref.split(",").filter((part) => part.length > 0));
        const restored = await applyRestore(store, refs, parentId);
        stdout.write(`${GREEN2}Restored ${restored.length} task(s): ${restored.map((task) => `#${task.id}`).join(", ")}${RESET3}
`);
      }
    }
  ],
  run: runArchive
};
async function runArchive(input, { store, stdout }) {
  const { filter, interactive } = parseArchiveArgs(toArchiveArgs(input));
  if (interactive) {
    if (!process.stdin.isTTY)
      throw new UserInputError("todo archive -i needs a terminal");
    await runArchivePicker(store, filter);
    return;
  }
  const entries = filterArchive(buildArchiveEntries(await store.loadTasks(), await store.loadRemoved()), filter);
  if (entries.length === 0) {
    stdout.write(`${DIM3}No archived tasks found${RESET3}
`);
    return;
  }
  for (const entry of entries)
    stdout.write(`${formatArchiveEntry(entry)}
`);
}
function toArchiveArgs(input) {
  const args = [...input.args("text")];
  if (input.flag("removed"))
    args.push("--removed");
  if (input.flag("done"))
    args.push("--done");
  if (input.flag("interactive"))
    args.push("-i");
  for (const name of ["since", "until"]) {
    const value = input.value(name);
    if (value !== undefined)
      args.push(`--${name}`, value);
  }
  return args;
}
async function applyRestore(store, refs, parentId) {
  const result = restoreArchiveEntries(await store.loadTasks(), await store.loadRemoved(), refs, parentId);
  await store.saveTasks(result.tasks);
  await store.saveRemoved(result.removed);
  return result.restored;
}
function formatArchiveEntry(entry, now = Date.now()) {
  const badge = entry.kind === "removed" ? `${RED}removed${RESET3}` : `${GREEN2}done   ${RESET3}`;
  return `${MAUVE}${entry.ref.padEnd(5)}${RESET3} ${badge} ${DIM3}${formatShortDate(entry.at, now).padEnd(11)}${RESET3} ${entry.task.description}`;
}
var KIND_CYCLE = [undefined, "removed", "done"];

class ArchivePicker {
  entries;
  baseFilter;
  pendingTasks;
  query;
  kind;
  index = 0;
  marked = new Set;
  message = "";
  parentStage;
  closed = false;
  constructor(entries, baseFilter, pendingTasks) {
    this.entries = entries;
    this.baseFilter = baseFilter;
    this.pendingTasks = pendingTasks;
    this.query = baseFilter.query ?? "";
    this.kind = baseFilter.kind;
  }
  get visible() {
    return filterArchive(this.entries, { ...this.baseFilter, kind: this.kind, query: this.query });
  }
  get parentMatches() {
    const stage = this.parentStage;
    if (stage === undefined)
      return [];
    const needle = stage.query.toLowerCase();
    return stage.candidates.filter((task) => needle.length === 0 || task.description.toLowerCase().includes(needle) || task.id === needle.replace(/^#/, ""));
  }
  replaceEntries(entries) {
    this.entries = entries;
    this.marked.clear();
    this.index = Math.min(this.index, Math.max(0, this.visible.length - 1));
  }
  handleKey(character, key) {
    if (key.name === "escape" || key.ctrl && key.name === "c") {
      if (this.parentStage !== undefined)
        this.parentStage = undefined;
      else
        this.closed = true;
      return;
    }
    return this.parentStage === undefined ? this.handleListKey(character, key) : this.handleParentKey(character, key);
  }
  selectedRefs() {
    if (this.marked.size > 0)
      return [...this.marked];
    const current = this.visible[this.index];
    return current === undefined ? [] : [current.ref];
  }
  handleListKey(character, key) {
    const count = this.visible.length;
    if (key.name === "up")
      this.index = Math.max(0, this.index - 1);
    else if (key.name === "down")
      this.index = Math.min(Math.max(0, count - 1), this.index + 1);
    else if (key.name === "tab") {
      this.kind = KIND_CYCLE[(KIND_CYCLE.indexOf(this.kind) + 1) % KIND_CYCLE.length];
      this.index = 0;
    } else if (key.name === "space") {
      const current = this.visible[this.index];
      if (current !== undefined) {
        if (this.marked.has(current.ref))
          this.marked.delete(current.ref);
        else
          this.marked.add(current.ref);
        this.index = Math.min(Math.max(0, count - 1), this.index + 1);
      }
    } else if (key.name === "return") {
      const refs = this.selectedRefs();
      if (refs.length > 0)
        return { refs };
    } else if (key.ctrl && key.name === "t") {
      if (this.selectedRefs().length > 0)
        this.parentStage = { candidates: this.pendingTasks(), query: "", index: 0 };
    } else if (key.name === "backspace") {
      this.query = this.query.slice(0, -1);
      this.index = 0;
    } else if (character !== undefined && !key.ctrl && character.length === 1 && character >= " ") {
      this.query += character;
      this.index = 0;
    }
    return;
  }
  handleParentKey(character, key) {
    const stage = this.parentStage;
    if (stage === undefined)
      return;
    const options = this.parentMatches.length + 1;
    if (key.name === "up")
      stage.index = Math.max(0, stage.index - 1);
    else if (key.name === "down")
      stage.index = Math.min(options - 1, stage.index + 1);
    else if (key.name === "return") {
      const parent = stage.index === 0 ? null : this.parentMatches[stage.index - 1]?.id ?? null;
      this.parentStage = undefined;
      return { refs: this.selectedRefs(), parentId: parent };
    } else if (key.name === "backspace") {
      stage.query = stage.query.slice(0, -1);
      stage.index = 0;
    } else if (character !== undefined && !key.ctrl && character.length === 1 && character >= " ") {
      stage.query += character;
      stage.index = 0;
    }
    return;
  }
  render(width, height) {
    const lines = [];
    const listHeight = Math.max(3, height - 5);
    if (this.parentStage !== undefined) {
      lines.push(`${MAUVE}restore ${this.selectedRefs().join(" ")} under\u2026${RESET3}  ${DIM3}filter:${RESET3} ${this.parentStage.query}\u258F`);
      const options = ["(top level)", ...this.parentMatches.map((task) => `#${task.id} ${task.description}`)];
      const start = Math.max(0, this.parentStage.index - listHeight + 1);
      options.slice(start, start + listHeight).forEach((option, offset) => {
        lines.push(start + offset === this.parentStage?.index ? `${SELECTED}${clipVisible(`\u203A ${option}`, width)}${RESET3}` : clipVisible(`  ${option}`, width));
      });
      lines.push(`${DIM3}\u2191\u2193 choose \xB7 Enter restore here \xB7 Esc back${RESET3}`);
      return lines.join(`
`);
    }
    const visible = this.visible;
    const kindLabel = this.kind ?? "all";
    lines.push(`${MAUVE}todo archive${RESET3} ${DIM3}\xB7 ${kindLabel} \xB7 ${visible.length} match(es)${RESET3}  ${DIM3}filter:${RESET3} ${this.query}\u258F`);
    if (visible.length === 0)
      lines.push(`${DIM3}  nothing matches${RESET3}`);
    const start = Math.max(0, this.index - listHeight + 1);
    visible.slice(start, start + listHeight).forEach((entry, offset) => {
      const mark = this.marked.has(entry.ref) ? `${GREEN2}\u25CF${RESET3}` : " ";
      const line = clipVisible(`${mark} ${formatArchiveEntry(entry)}`, width);
      lines.push(start + offset === this.index ? `${SELECTED}${line}${RESET3}` : line);
    });
    if (this.message.length > 0)
      lines.push(`${GREEN2}${this.message}${RESET3}`);
    lines.push(`${DIM3}type to filter \xB7 Tab all/removed/done \xB7 Space mark \xB7 Enter restore \xB7 Ctrl+T restore under\u2026 \xB7 Esc quit${RESET3}`);
    return lines.join(`
`);
  }
}
async function runArchivePicker(store, filter) {
  const terminal = process.stdout;
  let tasks = await store.loadTasks();
  const load = async () => buildArchiveEntries(tasks, await store.loadRemoved());
  const picker = new ArchivePicker(await load(), filter, () => tasks.filter((task) => task.status === "pending"));
  const wasRaw = process.stdin.isRaw;
  const draw = () => {
    const output = picker.render(terminal.columns ?? 80, terminal.rows ?? 24);
    terminal.write(`\x1B[H${output.split(`
`).join(`\x1B[K
`)}\x1B[K\x1B[J`);
  };
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  terminal.write("\x1B[?1049h\x1B[?25l");
  await new Promise((resolve) => {
    let busy = false;
    const handleKeypress = (character, key) => {
      if (busy)
        return;
      const request = picker.handleKey(character, key ?? {});
      if (picker.closed) {
        process.stdin.off("keypress", handleKeypress);
        process.stdout.off("resize", draw);
        resolve();
        return;
      }
      if (request === undefined) {
        draw();
        return;
      }
      busy = true;
      applyRestore(store, request.refs, request.parentId).then(async (restored) => {
        tasks = await store.loadTasks();
        picker.replaceEntries(await load());
        picker.message = `Restored ${restored.map((task) => `#${task.id}`).join(", ")}`;
      }).catch((error) => {
        picker.message = error instanceof Error ? error.message : String(error);
      }).finally(() => {
        busy = false;
        draw();
      });
    };
    process.stdin.on("keypress", handleKeypress);
    process.stdout.on("resize", draw);
    draw();
  });
  terminal.write("\x1B[?25h\x1B[?1049l");
  if (!wasRaw)
    process.stdin.setRawMode(false);
  process.stdin.pause();
}

// src/domain/task.ts
var DEFAULT_CONFIG = {
  schemaVersion: 1,
  defaultReminderOffsets: [10, 30, 60],
  showNotificationsOnStartup: true,
  showCompletedTasksByDefault: false,
  panelLimit: 5,
  panelLayout: "auto",
  panelBoards: "active",
  undoTimeout: 86400000,
  autocorrect: true,
  collapsedEpicIds: []
};
var UNLIMITED_PANEL_ROWS = 0;

// src/domain/panel-boards.ts
var PANEL_BOARDS = ["active", "all"];
function parsePanelBoards(value) {
  const normalized = value.trim().toLowerCase();
  const boards = PANEL_BOARDS.find((candidate) => candidate === normalized);
  if (boards === undefined) {
    throw new UnknownTokenError(`Unknown value for panel-boards: ${value}`, value, PANEL_BOARDS, "value");
  }
  return boards;
}
function normalizePanelBoards(value) {
  return PANEL_BOARDS.find((candidate) => candidate === value) ?? DEFAULT_CONFIG.panelBoards;
}

// src/domain/panel-layout.ts
var PANEL_LAYOUTS = ["auto", "side", "stack"];
function parsePanelLayout(value) {
  const normalized = value.trim().toLowerCase();
  const layout = PANEL_LAYOUTS.find((candidate) => candidate === normalized);
  if (layout === undefined) {
    throw new UnknownTokenError(`Unknown value for panel-layout: ${value}`, value, PANEL_LAYOUTS, "value");
  }
  return layout;
}
function normalizePanelLayout(value) {
  return PANEL_LAYOUTS.find((candidate) => candidate === value) ?? DEFAULT_CONFIG.panelLayout;
}

// src/domain/panel-limit.ts
function parsePanelLimit(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "all" || normalized === "unlimited")
    return UNLIMITED_PANEL_ROWS;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new UserInputError(`Invalid task count: ${value}. Use a whole number or 'all'.`);
  }
  return parsed;
}
function normalizePanelLimit(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : DEFAULT_CONFIG.panelLimit;
}
function toPanelRowCount(limit) {
  return limit === UNLIMITED_PANEL_ROWS ? Number.POSITIVE_INFINITY : limit;
}
function formatPanelLimit(limit) {
  return limit === UNLIMITED_PANEL_ROWS ? "all" : `${limit}`;
}

// src/presentation/task-format.ts
var RESET4 = "\x1B[0m";
var DIM4 = "\x1B[2m";
var BOLD2 = "\x1B[1m";
var GREEN3 = "\x1B[38;5;114m";
var RED2 = "\x1B[38;5;203m";
var YELLOW = "\x1B[38;5;229m";
var PEACH = "\x1B[38;5;208m";
var SKY = "\x1B[38;5;116m";
var SUBTEXT = "\x1B[38;5;217m";
var PRIORITY_COLORS = {
  none: SUBTEXT,
  low: SKY,
  medium: YELLOW,
  high: RED2
};
function formatTaskTreeRowForDisplay(row, now = Date.now()) {
  const description = row.hasChildren || row.task.kind === "epic" ? `${BOLD2}${row.task.description}${RESET4}` : row.task.description;
  return `${formatTreePrefix(row)}${formatTask(row.task, description, now, true)}${formatRowSuffix(row)}`;
}
function formatTaskRowForShellDisplay(row, now = Date.now()) {
  const prefix = formatTreePrefix(row);
  const badge = formatRowSuffix(row);
  const description = truncate(row.task.description, Math.max(12, 38 - getVisibleLength(prefix) - getVisibleLength(badge)));
  const emphasized = row.hasChildren || row.task.kind === "epic" ? `${BOLD2}${description}${RESET4}` : description;
  const taskText = formatTask(row.task, emphasized, now, false);
  const id = `${DIM4}#${row.task.id.padStart(2, "0")}${RESET4}`;
  return {
    left: `${id}  ${prefix}${taskText}${badge}`,
    right: `${DIM4}${formatCreatedAt(row.task.createdAt)}${RESET4}`
  };
}
function formatTreePrefix(row) {
  if (row.depth === 0)
    return "";
  const guides = row.siblingFollows.slice(1, -1).map((follows) => follows ? "\u2502  " : "   ");
  const connector = row.siblingFollows[row.siblingFollows.length - 1] ? "\u251C\u2500 " : "\u2514\u2500 ";
  return `${DIM4}${guides.join("")}${connector}${RESET4}`;
}
function formatProgressBadge(row) {
  if (row.progress.total > 0) {
    const color = row.progress.completed === row.progress.total ? GREEN3 : SKY;
    return ` ${color}[${row.progress.completed}/${row.progress.total}]${RESET4}`;
  }
  return row.task.kind === "epic" ? ` ${DIM4}[epic]${RESET4}` : "";
}
function formatCollapsedSummary(row) {
  return ` ${SKY}\u25CF${RESET4} ${DIM4}${row.childCount} subticket${row.childCount === 1 ? "" : "s"}${RESET4}`;
}
function formatRowSuffix(row) {
  return row.collapsed ? formatCollapsedSummary(row) : formatProgressBadge(row);
}
function formatTask(task, description, now, includeId) {
  const parts = [];
  if (task.priority !== "none") {
    parts.push(`${PRIORITY_COLORS[task.priority]}[${task.priority.toUpperCase()}]${RESET4}`);
  }
  parts.push(`${getUrgencyColor2(task.dueDate, now)}${description}${RESET4}`);
  if (task.dueDate !== undefined) {
    parts.push(`${getUrgencyColor2(task.dueDate, now)}${formatCompactDue(task.dueDate, now)}${RESET4}`);
  }
  if (includeId)
    parts.push(`${DIM4}(${task.id})${RESET4}`);
  return parts.join(" ");
}
function isUpcoming(timestamp, now = Date.now()) {
  const difference = timestamp - now;
  return difference > 0 && difference < 30 * 60 * 1000;
}
function isOverdue(timestamp, now = Date.now()) {
  return timestamp < now;
}
function getUrgencyColor2(timestamp, now) {
  if (timestamp === undefined)
    return SUBTEXT;
  if (isOverdue(timestamp, now))
    return RED2;
  if (isUpcoming(timestamp, now))
    return YELLOW;
  if ((timestamp - now) / (60 * 60 * 1000) < 2)
    return PEACH;
  return SUBTEXT;
}
function truncate(value, maximumLength) {
  return value.length > maximumLength ? `${value.slice(0, maximumLength - 3)}...` : value;
}
function truncateVisible(value, width) {
  if (getVisibleLength(value) <= width)
    return value;
  let output = "";
  let visible = 0;
  for (const token of value.match(/\u001B\[[0-9;]*m|[^\u001B]/gu) ?? []) {
    if (token.startsWith("\x1B")) {
      output += token;
    } else if (visible < width - 1) {
      output += token;
      visible += 1;
    }
  }
  return `${output}\u2026${RESET4}`;
}
function getVisibleLength(value) {
  return value.replace(/\u001B\[[0-9;]*m/g, "").length;
}
function formatCreatedAt(timestamp) {
  const date = new Date(timestamp);
  const month = date.toLocaleString(undefined, { month: "short" });
  const day = date.getDate().toString().padStart(2, "0");
  const time = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  return `${day} ${month} \xB7 ${time}`;
}

// src/plugins/tasks.ts
var DIM5 = "\x1B[2m";
var RESET5 = "\x1B[0m";
var GREEN4 = "\x1B[38;5;166m";
var BOLD3 = "\x1B[1m";
var PANEL_WIDTH = 72;
var panelCommand = {
  name: "panel",
  summary: "Print the compact task panel shown at shell startup.",
  group: "View",
  flags: [
    { name: "side", description: "Board lanes in columns, however narrow the terminal" },
    { name: "stack", description: "Board lanes stacked" },
    { name: "boards", description: "Every board as a column, the active one marked with *" },
    { name: "limit", value: "count-or-all", description: "Rows per lane before folding the rest into a summary line" },
    { name: "all", description: "Every pending task, ignoring the active board and the limit" }
  ],
  details: [
    "Runs automatically when todo gets no arguments and stdin is not a terminal.",
    "With an active board it shows the Now and Later lanes; otherwise every pending task, plus one line per running timed board.",
    "With --boards, or panel-boards set to all, every board gets a column with its Now lane and, when filled, its Later lane.",
    "Tasks hidden with `todo hide` stay out. TODO_PANEL_LIMIT, TODO_PANEL_LAYOUT and TODO_PANEL_BOARDS override the configured values."
  ],
  examples: [{ command: "todo panel" }, { command: "todo panel --side --limit 3" }, { command: "todo panel --boards" }, { command: "todo panel --all" }],
  run: runPanel
};
var listCommand = {
  name: "list",
  aliases: ["tree"],
  summary: "List tasks as a tree.",
  group: "View",
  flags: [
    { name: "all", description: "Every task including completed and hidden ones, ignoring the active board" },
    { name: "overdue", description: "Only pending tasks past their due date" },
    { name: "upcoming", description: "Only pending tasks due soon" }
  ],
  details: [
    "Pending tasks by default, without anything hidden via `todo hide`.",
    "With an active board only its Now and Later lanes are listed; --all lifts that. Filtered views show matches flat when their parent is not part of the result."
  ],
  examples: [{ command: "todo list" }, { command: "todo tree --overdue" }, { command: "todo list --all" }],
  async run(input, { store, stdout }) {
    await listTasks(store, stdout, readListFilter(input));
  }
};
function readListFilter(input) {
  const filters = ["all", "overdue", "upcoming"].filter((name) => input.flag(name));
  if (filters.length > 1)
    throw new UserInputError("Use one of --all, --overdue or --upcoming");
  return filters[0] ?? "pending";
}
async function listTasks(store, stdout, filter = "pending") {
  const tasks = await store.loadTasks();
  const now = Date.now();
  const visible = filterTasks(tasks, filter, now);
  const collapsedIds = await store.loadCollapsedEpicIds();
  const board = filter === "all" ? undefined : getActiveBoard(await loadBoards(store, now));
  if (board !== undefined) {
    writeBoard(board, visible, tasks, stdout, now, collapsedIds);
    return;
  }
  const rows = buildTaskTreeRows(visible, tasks, { compare: compareTasks, collapsedIds });
  if (rows.length === 0) {
    stdout.write(`${DIM5}No tasks found${RESET5}
`);
    return;
  }
  for (const row of rows)
    stdout.write(`${formatTaskTreeRowForDisplay(row, now)}
`);
}
function writeBoard(board, visible, tasks, stdout, now, collapsedIds) {
  stdout.write(`${BOLD3}${board.name}${RESET5}${formatBoardTimer(board, now, " \xB7 ")}
`);
  const lanes = splitLanes(board, visible, tasks);
  if (lanes.now.length === 0 && lanes.later.length === 0) {
    stdout.write(`${DIM5}Nothing on the board yet \xB7 todo board add <id> pulls a task in${RESET5}
`);
    return;
  }
  for (const lane of ["now", "later"]) {
    if (lane === "later" && lanes.later.length === 0)
      continue;
    stdout.write(`${lane === "later" ? `
` : ""}${BOLD3}${LANE_TITLES[lane]}${RESET5}
`);
    if (lanes[lane].length === 0)
      stdout.write(`${DIM5}nothing here \xB7 todo board now <id>${RESET5}
`);
    for (const row of buildTaskTreeRows(lanes[lane], tasks, { compare: compareTasks, collapsedIds: new Set(collapsedIds) })) {
      stdout.write(`${formatTaskTreeRowForDisplay(row, now)}
`);
    }
  }
}
var LANE_TITLES = { now: "Now", later: "Later" };
function splitLanes(board, visible, tasks) {
  return {
    now: visible.filter((task) => laneOf(board, tasks, task.id) === "now"),
    later: visible.filter((task) => laneOf(board, tasks, task.id) === "later")
  };
}
function formatBoardTimer(board, now, prefix = "") {
  return isTimed(board) ? `${DIM5}${prefix}${formatDuration(remainingMs(board, now))} left${RESET5}` : "";
}
async function runPanel(input, { store, stdout }) {
  const tasks = await store.loadTasks();
  const now = Date.now();
  const state = await loadBoards(store, now);
  const showAll = input.flag("all");
  const board = showAll ? undefined : getActiveBoard(state);
  const pendingTasks = excludeHiddenSubtrees(tasks).filter((task) => task.status === "pending");
  const config = await store.loadConfig();
  const limit = resolvePanelLimit(showAll ? "all" : input.value("limit"), config.panelLimit);
  const layout = resolvePanelLayout(input, config.panelLayout);
  const boards = resolvePanelBoards(input, config.panelBoards);
  const collapsedIds = await store.loadCollapsedEpicIds();
  function buildLines(lane) {
    const rows = buildTaskTreeRows(lane, tasks, { compare: compareTasksForPanel, collapsedIds });
    const lines = rows.slice(0, limit).map((row) => formatTaskRowForShellDisplay(row, now));
    const hiddenTaskCount = rows.length - lines.length;
    if (hiddenTaskCount > 0) {
      lines.push({
        left: `${DIM5}\u21B3 ${hiddenTaskCount} more task${hiddenTaskCount === 1 ? "" : "s"}${RESET5}`,
        right: `${DIM5}todo config panel-limit all${RESET5}`
      });
    }
    return lines;
  }
  function buildBoardColumn(column) {
    const lanes = splitLanes(column, pendingTasks, tasks);
    const name = `${BOLD3}${column.name === state.active ? "* " : ""}${column.name}${RESET5}`;
    const on = `--on ${quoteBoardName(column.name)}`;
    if (lanes.now.length === 0 && lanes.later.length === 0) {
      return [{ left: `${name}${DIM5} \xB7 nothing on it yet \xB7 todo board add <id> ${on}${RESET5}`, right: formatBoardTimer(column, now) }];
    }
    const lines = [{ left: `${name} ${DIM5}\xB7 Now${RESET5}`, right: formatBoardTimer(column, now) }];
    lines.push(...lanes.now.length === 0 ? [{ left: `${DIM5}nothing in Now \xB7 todo board now <id> ${on}${RESET5}`, right: "" }] : buildLines(lanes.now));
    if (lanes.later.length > 0)
      lines.push({ left: `${BOLD3}Later${RESET5}`, right: `${DIM5}${lanes.later.length}${RESET5}` }, ...buildLines(lanes.later));
    return lines;
  }
  if (!showAll && boards === "all" && state.boards.length > 0) {
    stdout.write(formatPanels(state.boards.map(buildBoardColumn), layout));
    return;
  }
  if (board !== undefined) {
    const lanes = splitLanes(board, pendingTasks, tasks);
    const title = { left: `${BOLD3}${board.name}${RESET5} ${DIM5}\xB7 Now${RESET5}`, right: formatBoardTimer(board, now) };
    if (lanes.now.length === 0 && lanes.later.length === 0) {
      stdout.write(formatPanels([[{ ...title, left: `${BOLD3}${board.name}${RESET5}${DIM5} \xB7 nothing on it yet \xB7 todo board add <id>${RESET5}` }]], layout));
      return;
    }
    const nowPanel = [title, ...lanes.now.length === 0 ? [{ left: `${DIM5}nothing in Now \xB7 todo board now <id>${RESET5}`, right: "" }] : buildLines(lanes.now)];
    if (lanes.later.length === 0) {
      stdout.write(formatPanels([nowPanel], layout));
      return;
    }
    const laterPanel = [{ left: `${BOLD3}Later${RESET5}`, right: `${DIM5}${lanes.later.length}${RESET5}` }, ...buildLines(lanes.later)];
    stdout.write(formatPanels([nowPanel, laterPanel], layout));
    return;
  }
  const footer = showAll ? [] : state.boards.filter(isTimed).map((running) => ({
    left: `${DIM5}${running.name} \xB7 ${formatDuration(remainingMs(running, now))} left \xB7 todo board use ${quoteBoardName(running.name)}${RESET5}`,
    right: ""
  }));
  if (pendingTasks.length === 0) {
    const completedCount = tasks.filter((task) => task.status === "completed").length;
    const completedText = completedCount > 0 ? `${DIM5} \xB7 ${completedCount} completed${RESET5}` : "";
    stdout.write(formatPanels([[{ left: `${GREEN4}\u2713 All caught up${RESET5}${completedText}`, right: "" }, ...footer]], layout));
    return;
  }
  stdout.write(formatPanels([[...buildLines(pendingTasks), ...footer]], layout));
}
function quoteBoardName(name) {
  return /\s/.test(name) ? `"${name}"` : name;
}
function resolvePanelLimit(requested, configuredLimit) {
  const value = requested ?? process.env.TODO_PANEL_LIMIT;
  const limit = value === undefined || value === "" ? normalizePanelLimit(configuredLimit) : parsePanelLimit(value);
  return toPanelRowCount(limit);
}
function resolvePanelLayout(input, configuredLayout) {
  if (input.flag("side") && input.flag("stack"))
    throw new UserInputError("Use --side or --stack, not both");
  if (input.flag("side"))
    return "side";
  if (input.flag("stack"))
    return "stack";
  const fromEnvironment = process.env.TODO_PANEL_LAYOUT;
  return fromEnvironment === undefined || fromEnvironment === "" ? normalizePanelLayout(configuredLayout) : parsePanelLayout(fromEnvironment);
}
function resolvePanelBoards(input, configured) {
  if (input.flag("boards"))
    return "all";
  const fromEnvironment = process.env.TODO_PANEL_BOARDS;
  return fromEnvironment === undefined || fromEnvironment === "" ? normalizePanelBoards(configured) : parsePanelBoards(fromEnvironment);
}
function filterTasks(tasks, filter, now) {
  if (filter === "all")
    return [...tasks];
  const pendingTasks = excludeHiddenSubtrees(tasks).filter((task) => task.status === "pending");
  if (filter === "overdue")
    return pendingTasks.filter((task) => task.dueDate !== undefined && isOverdue(task.dueDate, now));
  if (filter === "upcoming")
    return pendingTasks.filter((task) => task.dueDate !== undefined && isUpcoming(task.dueDate, now));
  return pendingTasks;
}
function compareTasks(left, right) {
  if (left.dueDate !== undefined && right.dueDate !== undefined)
    return left.dueDate - right.dueDate;
  if (left.dueDate !== undefined)
    return -1;
  if (right.dueDate !== undefined)
    return 1;
  return 0;
}
function compareTasksForPanel(left, right) {
  const dueDateOrder = compareTasks(left, right);
  return dueDateOrder === 0 ? left.createdAt - right.createdAt : dueDateOrder;
}
var PANEL_GAP = 2;
var MIN_SIDE_BY_SIDE_WIDTH = 56;
var MIN_FORCED_SIDE_WIDTH = 24;
function formatPanels(panels, layout) {
  const fittedWidth = Math.min(PANEL_WIDTH, Math.floor((readTerminalColumns() - PANEL_GAP * (panels.length - 1)) / panels.length) - 4);
  const sideBySide = panels.length > 1 && (layout === "side" || layout === "auto" && fittedWidth >= MIN_SIDE_BY_SIDE_WIDTH);
  if (!sideBySide) {
    return panels.map((lines) => `${formatPanel(lines, PANEL_WIDTH).join(`
`)}
`).join("");
  }
  const width = Math.max(MIN_FORCED_SIDE_WIDTH, fittedWidth);
  const height = Math.max(...panels.map((lines) => lines.length));
  const boxes = panels.map((lines) => formatPanel([...lines, ...Array.from({ length: height - lines.length }, () => ({ left: "", right: "" }))], width));
  return boxes[0].map((_, row) => boxes.map((box) => box[row]).join(" ".repeat(PANEL_GAP))).join(`
`) + `
`;
}
function readTerminalColumns() {
  return process.stdout.columns ?? (Number(process.env.COLUMNS) || 80);
}
function formatPanel(lines, width) {
  const rowsFitRight = lines.slice(1).every((line) => fitsRight(line, width));
  const shown = lines.map((line, index) => index === 0 || rowsFitRight ? line : { ...line, right: "" });
  return [formatPanelBorder("\u256D", "\u256E", width), ...shown.map((line) => formatPanelLine(line, width)), formatPanelBorder("\u2570", "\u256F", width)];
}
function fitsRight({ left, right }, width) {
  return right === "" || getVisibleLength(left) + 1 + getVisibleLength(right) <= width;
}
function formatPanelLine(line, width) {
  const right = fitsRight(line, width) ? line.right : "";
  const left = truncateVisible(line.left, width - (right === "" ? 0 : getVisibleLength(right) + 1));
  const padding = " ".repeat(Math.max(0, width - getVisibleLength(left) - getVisibleLength(right)));
  return `${DIM5}\u2502${RESET5} ${left}${padding}${right} ${DIM5}\u2502${RESET5}`;
}
function formatPanelBorder(left, right, width) {
  return `${DIM5}${left}${"\u2500".repeat(width + 2)}${right}${RESET5}`;
}

// src/plugins/board.ts
var DIM6 = "\x1B[2m";
var GREEN5 = "\x1B[32m";
var BOLD4 = "\x1B[1m";
var ACCENT = "\x1B[38;5;208m";
var RESET6 = "\x1B[0m";
var ON_FLAG = { name: "on", value: "board-name", description: "Board to change instead of the active one" };
var IDS_ARG = { name: "id", kind: "pending-task-id", variadic: true, description: "Tasks to change; their subtasks follow them" };
var boardCommand = {
  name: "board",
  summary: "Curated views of tasks with Now and Later lanes.",
  group: "Boards",
  defaultSubcommand: "list",
  details: [
    "A board is a view, not a folder: a task can sit on several boards, and epics still own the tree.",
    "One board can be active. It drives the shell panel, `todo list` and the TUI's first view; new tasks join its Now lane.",
    "Lanes hold top-level picks; a task's subtasks follow it and cannot be moved on their own.",
    "A timed board ends itself: tasks created on it move under an epic named after it.",
    "To add new tasks to another board, activate it first with `todo board use`, or add them and place them with `todo board add <id> --on <name>`.",
    'Quote board names that contain spaces when they are a single argument: `todo board use "werk fixes"`.'
  ],
  examples: [
    { command: "todo board new projecten", note: "create and activate" },
    { command: 'todo board new "deploy day" --for 4h', note: "a timed board" },
    { command: "todo board use werk", note: "switch the active board" },
    { command: "todo board add 12 14", note: "onto the active board, in Now" },
    { command: "todo board later 14", note: "Now \u2192 Later" },
    { command: "todo board move 12 --to werk", note: "move #12 off the active board onto werk" },
    { command: "todo board end projecten", note: "delete a board; its tasks stay" },
    { command: "todo board off", note: "back to all tasks" }
  ],
  subcommands: [
    {
      name: "list",
      aliases: ["ls"],
      summary: "List boards; * marks the active one.",
      details: ["Each row shows how many tasks sit in Now and Later, and the time left on a timed board."],
      examples: [{ command: "todo board" }, { command: "todo board ls" }],
      run: runList
    },
    {
      name: "new",
      summary: "Create a board and make it active.",
      args: [{ name: "name", kind: "text", variadic: true, description: "Board name; spaces are fine" }],
      flags: [{ name: "for", value: "duration", description: "Make it a timed board: 4h, 90m, 2h30m (24h at most)" }],
      details: ["The new board starts empty and becomes active, so tasks you add next join its Now lane."],
      examples: [
        { command: "todo board new projecten" },
        { command: "todo board new deploy day --for 4h", note: "ends itself after 4 hours" },
        { command: "todo board new release --for 2h30m" }
      ],
      async run(input, context) {
        const duration = input.value("for");
        await startBoard(context, input.args("name").join(" "), duration === undefined ? undefined : parseDuration(duration));
      }
    },
    {
      name: "use",
      summary: "Make a board the active one.",
      args: [{ name: "name", kind: "board-name", description: "Board to activate" }],
      details: ["The active board drives the shell panel and `todo list`, and new tasks join its Now lane."],
      examples: [{ command: "todo board use werk" }, { command: 'todo board use "werk fixes"', note: "quote names with spaces" }],
      async run(input, { store, stdout }) {
        const state = await loadBoards(store);
        const board = requireBoard(state, input.arg("name"));
        await store.saveBoards({ ...state, active: board.name });
        stdout.write(`${GREEN5}${board.name} is active${RESET6}${formatBoardTimer(board, Date.now(), " \xB7 ")}
`);
      }
    },
    {
      name: "off",
      summary: "Show all tasks again; boards and their timers keep running.",
      details: ["New tasks stay off every board until one is active again."],
      examples: [{ command: "todo board off" }, { command: "todo board use werk", note: "turn a board back on" }],
      async run(_input, { store, stdout }) {
        const state = await loadBoards(store);
        const { active: _active, ...rest } = state;
        await store.saveBoards(rest);
        stdout.write(`${GREEN5}No active board${RESET6} ${DIM6}\xB7 all tasks show; timed boards keep counting down${RESET6}
`);
      }
    },
    {
      name: "show",
      summary: "Print a board's Now and Later lanes.",
      args: [{ name: "name", kind: "board-name", optional: true, description: "Board to show; defaults to the active one" }],
      examples: [{ command: "todo board show", note: "the active board" }, { command: "todo board show werk" }],
      async run(input, { store, stdout }) {
        const now = Date.now();
        const state = await loadBoards(store, now);
        const board = resolveBoard(state, input.optionalArg("name"));
        const tasks = await store.loadTasks();
        const visible = excludeHiddenSubtrees(tasks).filter((task) => task.status === "pending");
        writeBoard(board, visible, tasks, stdout, now, await store.loadCollapsedEpicIds());
      }
    },
    {
      name: "add",
      summary: "Put tasks on a board (Now unless --later).",
      args: [IDS_ARG],
      flags: [{ name: "later", description: "Put them in Later" }, ON_FLAG],
      details: ["Idempotent: a task already on the board just moves to the requested lane."],
      examples: [
        { command: "todo board add 12", note: "Now lane of the active board" },
        { command: "todo board add 12 13 --later --on projecten" },
        { command: 'todo board add 12 --on "werk fixes"' }
      ],
      run: (input, context) => placeTasks(input, context, input.flag("later") ? "later" : "now")
    },
    {
      name: "rm",
      aliases: ["remove"],
      summary: "Take tasks off a board; the tasks themselves stay.",
      args: [IDS_ARG],
      flags: [ON_FLAG],
      details: ["To delete a task, use `todo rm`."],
      examples: [{ command: "todo board rm 12" }, { command: "todo board rm 12 13 --on werk" }],
      run: removeTasks
    },
    {
      name: "move",
      aliases: ["mv"],
      summary: "Move tasks to another board, keeping their lane.",
      args: [IDS_ARG],
      flags: [
        { name: "to", value: "board-name", description: "Board to move them to" },
        { name: "from", value: "board-name", description: "Board to take them off; defaults to the active one" },
        { name: "later", description: "Put them in Later on the new board" },
        { name: "now", description: "Put them in Now on the new board" }
      ],
      details: [
        "The tasks leave the old board and land in the same lane on the new one, unless --later or --now says otherwise.",
        "Subtasks follow their parent. To keep a task on both boards, use `todo board add <id> --on <board>` instead."
      ],
      examples: [
        { command: "todo board move 12 --to werk", note: "from the active board" },
        { command: "todo board mv 12 13 --to werk --from cleanup" },
        { command: 'todo board move 12 --to "werk fixes" --later' }
      ],
      run: moveTasks
    },
    {
      name: "later",
      summary: "Move tasks to Later, adding them when needed.",
      args: [IDS_ARG],
      flags: [ON_FLAG],
      examples: [{ command: "todo board later 14" }, { command: "todo board later 14 15 --on werk" }],
      run: (input, context) => placeTasks(input, context, "later")
    },
    {
      name: "now",
      summary: "Move tasks to Now, adding them when needed.",
      args: [IDS_ARG],
      flags: [ON_FLAG],
      examples: [{ command: "todo board now 14" }, { command: "todo board now 14 --on werk" }],
      run: (input, context) => placeTasks(input, context, "now")
    },
    {
      name: "extend",
      summary: "Give a timed board more time.",
      args: [{ name: "duration", kind: "duration", description: "Extra time: 1h, 30m, 1h30m" }],
      flags: [ON_FLAG],
      details: ["The board can never run past 24h from now. An untimed board cannot be extended."],
      examples: [{ command: "todo board extend 1h" }, { command: 'todo board extend 30m --on "deploy day"' }],
      async run(input, { store, stdout }) {
        const now = Date.now();
        const state = await loadBoards(store, now);
        const board = resolveBoard(state, input.value("on"));
        const extended = extendBoard(board, parseDuration(input.arg("duration")), now);
        await store.saveBoards(replaceBoard(state, board.name, extended));
        stdout.write(`${GREEN5}${board.name} runs until ${formatClock(extended.expiresAt ?? now)}${RESET6}${formatBoardTimer(extended, now, " \xB7 ")}
`);
      }
    },
    {
      name: "rename",
      summary: "Rename a board.",
      args: [
        { name: "old", kind: "board-name", description: "Current name" },
        { name: "new", kind: "text", variadic: true, description: "New name" }
      ],
      examples: [{ command: "todo board rename werk werk oud" }, { command: 'todo board rename "werk fixes" bugs' }],
      async run(input, { store, stdout }) {
        const state = await loadBoards(store);
        const board = requireBoard(state, input.arg("old"));
        const name = input.args("new").join(" ");
        await store.saveBoards(renameBoard(state, board.name, name));
        stdout.write(`${GREEN5}Renamed ${board.name} \u2192 ${name.trim()}${RESET6}
`);
      }
    },
    {
      name: "end",
      aliases: ["delete"],
      summary: "Delete a board; a timed one nests its new tasks under an epic.",
      args: [{ name: "name", kind: "board-name", optional: true, description: "Board to end; defaults to the active one" }],
      details: ["Top-level tasks created on a timed board move under a new epic named after it. Tasks are never deleted."],
      examples: [
        { command: "todo board end", note: "the active board" },
        { command: "todo board end cleanup" },
        { command: 'todo board delete "werk fixes"' }
      ],
      async run(input, { store, stdout }) {
        const now = Date.now();
        const state = await loadBoards(store, now);
        const board = resolveBoard(state, input.optionalArg("name"));
        const epic = await wrapUpBoard(store, board, now);
        await store.saveBoards(deleteBoard(state, board.name));
        const nested = epic === undefined ? "" : ` \xB7 its tasks are under epic #${epic.id} ${epic.description}`;
        stdout.write(`${GREEN5}Ended ${board.name}${RESET6}${DIM6}${nested}${RESET6}
`);
      }
    }
  ]
};
var focusCommand = {
  name: "focus",
  summary: "Start a timed board: shortcut for board new --for.",
  group: "Boards",
  args: [
    { name: "duration", kind: "duration", description: "How long it runs: 4h, 90m, 2h30m (24h at most)" },
    { name: "title", kind: "text", variadic: true, optional: true, description: "Board name; defaults to Focus <date>" }
  ],
  examples: [{ command: "todo focus 4h" }, { command: "todo focus 90m deploy day" }],
  async run(input, context) {
    const title = input.args("title").join(" ").trim();
    const state = await loadBoards(context.store);
    await startBoard(context, title === "" ? defaultBoardName(state, Date.now()) : title, parseDuration(input.arg("duration")));
  }
};
async function startBoard({ store, stdout }, name, durationMs) {
  const now = Date.now();
  const { state, board } = createBoard(await loadBoards(store, now), name, now, durationMs);
  await store.saveBoards(state);
  const timer = durationMs === undefined ? "" : ` ${DIM6}\xB7 ${formatDuration(durationMs)}${RESET6}`;
  stdout.write(`${GREEN5}${board.name} is active${RESET6}${timer} ${DIM6}\xB7 new tasks join it; todo board add <id> pulls others in${RESET6}
`);
}
async function runList(_input, { store, stdout }) {
  const now = Date.now();
  const state = await loadBoards(store, now);
  if (state.boards.length === 0) {
    stdout.write(`${DIM6}No boards yet \xB7 todo board new <name> [--for 4h]${RESET6}
`);
    return;
  }
  const tasks = (await store.loadTasks()).filter((task) => task.status === "pending");
  const active = getActiveBoard(state);
  const width = Math.max(...state.boards.map((board) => board.name.length));
  for (const board of state.boards) {
    const marker = board === active ? `${ACCENT}*${RESET6}` : " ";
    const name = board === active ? `${BOLD4}${board.name.padEnd(width)}${RESET6}` : board.name.padEnd(width);
    const counts = `${collectLaneIds(board, tasks, "now").size} now \xB7 ${collectLaneIds(board, tasks, "later").size} later`;
    stdout.write(`${marker} ${name}  ${DIM6}${counts}${RESET6}${formatBoardTimer(board, now, " \xB7 ")}
`);
  }
  if (active === undefined)
    stdout.write(`${DIM6}No active board \xB7 todo board use <name>${RESET6}
`);
}
function resolveBoard(state, name) {
  if (name !== undefined)
    return requireBoard(state, name);
  const active = getActiveBoard(state);
  if (active === undefined)
    throw new UserInputError("No active board \xB7 todo board use <name>, or name one with --on <name>");
  return active;
}
async function placeTasks(input, { store, stdout }, lane) {
  const { state, board, tasks } = await loadTarget(store, input);
  let next = board;
  const lines = [];
  for (const id of input.args("id")) {
    findTask(tasks, id);
    const result = placeOnBoard(next, tasks, id, lane);
    next = result.board;
    lines.push(result.change === "unchanged" ? `${DIM6}#${id} is already in ${LANE_LABELS[lane]} on ${board.name}${RESET6}` : `${GREEN5}${result.change === "added" ? "Added" : "Moved"} #${id} to ${LANE_LABELS[lane]} on ${board.name}${RESET6}`);
  }
  await store.saveBoards(replaceBoard(state, board.name, next));
  stdout.write(`${lines.join(`
`)}
`);
}
async function removeTasks(input, { store, stdout }) {
  const { state, board, tasks } = await loadTarget(store, input);
  let next = board;
  const lines = [];
  for (const id of input.args("id")) {
    findTask(tasks, id);
    const result = takeOffBoard(next, tasks, id);
    next = result.board;
    lines.push(result.removed ? `${GREEN5}Took #${id} off ${board.name}${RESET6}` : `${DIM6}#${id} is not on ${board.name}${RESET6}`);
  }
  await store.saveBoards(replaceBoard(state, board.name, next));
  stdout.write(`${lines.join(`
`)}
`);
}
async function moveTasks(input, { store, stdout }) {
  const toName = input.value("to");
  if (toName === undefined)
    throw new UserInputError("Usage: todo board move <id\u2026> --to <board> [--from <board>]");
  if (input.flag("later") && input.flag("now"))
    throw new UserInputError("Pick one of --later and --now");
  const lane = input.flag("later") ? "later" : input.flag("now") ? "now" : undefined;
  let state = await loadBoards(store);
  const fromName = resolveBoard(state, input.value("from")).name;
  const tasks = await store.loadTasks();
  const lines = [];
  for (const id of input.args("id")) {
    findTask(tasks, id);
    const moved = moveBetweenBoards(state, tasks, id, fromName, toName, lane);
    state = moved.state;
    lines.push(`${GREEN5}Moved #${id} from ${moved.from.name} to ${LANE_LABELS[moved.lane]} on ${moved.to.name}${RESET6}`);
  }
  await store.saveBoards(state);
  stdout.write(`${lines.join(`
`)}
`);
}
async function loadTarget(store, input) {
  const state = await loadBoards(store);
  return { state, board: resolveBoard(state, input.value("on")), tasks: await store.loadTasks() };
}
function formatClock(timestamp) {
  return new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// src/command-spec/completions.ts
var DYNAMIC_KINDS = ["task", "epic", "board", "archive"];
var PRIORITIES = ["none", "low", "medium", "high"];
function dynamicKindOf(kind) {
  if (typeof kind === "object")
    return;
  switch (kind) {
    case "task-id":
    case "pending-task-id":
    case "task-ids":
    case "task-selector":
    case "parent-id":
      return "task";
    case "epic-id":
    case "epic-selector":
      return "epic";
    case "board-name":
      return "board";
    case "archive-ref":
      return "archive";
    default:
      return;
  }
}
function staticValues(kind) {
  if (typeof kind === "object")
    return kind.oneOf;
  if (kind === "priority")
    return PRIORITIES;
  if (kind === "count-or-all")
    return ["all"];
  return;
}
var PRELUDE = `# Generated from the command spec by \`todo completions fish\`. Do not edit by hand.

complete -c todo -e
complete -c todo -f

function __todo_walk --description 'Print the canonical todo command path and the count of arguments after it'
    set -l tokens (commandline -opc)
    set -e tokens[1]
    set -l path
    set -l extra 0
    for token in $tokens
        if string match -q -- '-*' $token
            continue
        end
        if test $extra -eq 0
            set -l key (string join ' ' -- $path $token)
            set -l index (contains -i -- $key $__todo_node_keys)
            if test -n "$index"
                set path (string split ' ' -- $__todo_node_paths[$index])
                continue
            end
        end
        set extra (math $extra + 1)
    end
    echo "path:$path"
    echo $extra
end

function __todo_at --description 'True when the command line sits right after the given todo command path'
    set -l state (__todo_walk)
    test "$state[1]" = "path:$argv[1]"; and test "$state[2]" -eq 0
end

function __todo_in --description 'True when the command line is inside the given todo command path'
    set -l state (__todo_walk)
    test "$state[1]" = "path:$argv[1]"
end
`;
function generateFishCompletions(root) {
  const keys = [];
  const paths = [];
  const lines = [];
  function visit(node, path) {
    const at = path.join(" ");
    for (const child of node.subcommands ?? []) {
      if (child.hidden === true)
        continue;
      const childPath = [...path, child.name];
      for (const spelling of [child.name, ...child.aliases ?? []].filter((name) => !name.startsWith("-"))) {
        keys.push([...path, spelling].join(" "));
        paths.push(childPath.join(" "));
      }
      lines.push(`complete -c todo -n ${quote(`__todo_at '${at}'`)} -a ${quote(child.name)} -d ${quote(child.summary)}`);
    }
    if (path.length > 0) {
      const firstArg = node.args?.[0];
      if (firstArg !== undefined) {
        const values = valueSource(firstArg.kind);
        if (values !== undefined)
          lines.push(`complete -c todo -n ${quote(`__todo_in '${at}'`)} -a ${values}`);
      }
      for (const flag of visibleFlags(node)) {
        const names = flagSpellings(flag).map((spelling) => spelling.startsWith("--") ? `-l ${spelling.slice(2)}` : `-s ${spelling.slice(1)}`);
        const source = flag.value === undefined ? undefined : valueSource(flag.value);
        const value = flag.value === undefined ? "" : flag.value === "path" ? " -r -F" : ` -x${source === undefined ? "" : ` -a ${source}`}`;
        lines.push(`complete -c todo -n ${quote(`__todo_in '${at}'`)} ${names.join(" ")}${value} -d ${quote(flag.description)}`);
      }
    }
    for (const child of node.subcommands ?? []) {
      if (child.hidden !== true)
        visit(child, [...path, child.name]);
    }
  }
  visit(root, []);
  return [
    PRELUDE,
    `set -g __todo_node_keys ${keys.map(quote).join(" ")}`,
    `set -g __todo_node_paths ${paths.map(quote).join(" ")}`,
    "",
    "complete -c todo -s h -l help -d 'Show help for the command'",
    ...lines,
    ""
  ].join(`
`);
}
function valueSource(kind) {
  const dynamic = dynamicKindOf(kind);
  if (dynamic !== undefined)
    return `'(todo completions --list ${dynamic})'`;
  const values = staticValues(kind);
  return values === undefined ? undefined : quote(values.join(" "));
}
function quote(value) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

// src/plugins/completions.ts
var completionsCommand = {
  name: "completions",
  summary: "Print shell completions generated from the command tree.",
  group: "Settings",
  flags: [{ name: "list", value: { oneOf: [...DYNAMIC_KINDS] }, hidden: true, description: "Print live values for one completion kind" }],
  details: ["The committed file lives at configs/fish/completions/todo.fish; regenerate it after changing commands."],
  examples: [{ command: "todo completions fish > ~/.config/fish/completions/todo.fish" }],
  subcommands: [
    {
      name: "fish",
      summary: "Fish completions for every command, flag and value.",
      run(_input, { root, stdout }) {
        stdout.write(generateFishCompletions(root));
      }
    }
  ],
  async run(input, { store, stdout }) {
    const kind = input.value("list");
    if (kind === undefined)
      throw new UserInputError("Usage: todo completions fish");
    for (const line of await listCompletionValues(store, kind))
      stdout.write(`${line}
`);
  }
};
async function listCompletionValues(store, kind) {
  if (kind === "board") {
    const state = await store.loadBoardsFile();
    return (state?.boards ?? []).map((board) => `${board.name}	${board.name === state?.active ? "active board" : board.expiresAt === undefined ? "board" : "timed board"}`);
  }
  if (kind === "archive") {
    const removed = await store.loadRemoved();
    const completed = (await store.loadTasks()).filter((task) => task.status === "completed");
    return [...removed.map((entry) => `r${entry.ref}	${clean(entry.task.description)}`), ...completed.map((task) => `${task.id}	${clean(task.description)}`)];
  }
  const tasks = await store.loadTasks();
  const pending = tasks.filter((task) => task.status === "pending");
  const matching = kind === "epic" ? pending.filter((task) => isEpic(task, tasks)) : pending;
  return matching.map((task) => `${task.id}	${clean(task.description)}`);
}
function clean(value) {
  return value.replace(/\s+/g, " ").trim();
}

// src/plugins/config.ts
var DIM7 = "\x1B[2m";
var RESET7 = "\x1B[0m";
var SWITCH = { oneOf: ["on", "off"] };
var SETTINGS = [
  {
    name: "panel-limit",
    description: "Pending tasks shown per lane in the shell panel (number, or 'all')",
    value: "count-or-all",
    read: (config) => formatPanelLimit(normalizePanelLimit(config.panelLimit)),
    apply: (config, value) => ({ ...config, panelLimit: parsePanelLimit(value) })
  },
  {
    name: "panel-layout",
    description: "Board lanes in the shell panel: auto (columns when wide), side (always columns) or stack",
    value: { oneOf: PANEL_LAYOUTS },
    read: (config) => normalizePanelLayout(config.panelLayout),
    apply: (config, value) => ({ ...config, panelLayout: parsePanelLayout(value) })
  },
  {
    name: "panel-boards",
    description: "Boards in the shell panel: active (its Now and Later lanes) or all (one column per board)",
    value: { oneOf: PANEL_BOARDS },
    read: (config) => normalizePanelBoards(config.panelBoards),
    apply: (config, value) => ({ ...config, panelBoards: parsePanelBoards(value) })
  },
  {
    name: "startup-notifications",
    description: "Send desktop notifications for due tasks on startup (on/off)",
    value: SWITCH,
    read: (config) => formatBoolean(config.showNotificationsOnStartup),
    apply: (config, value) => ({ ...config, showNotificationsOnStartup: value === "on" })
  },
  {
    name: "show-completed",
    description: "Include completed tasks in listings by default (on/off)",
    value: SWITCH,
    read: (config) => formatBoolean(config.showCompletedTasksByDefault),
    apply: (config, value) => ({ ...config, showCompletedTasksByDefault: value === "on" })
  },
  {
    name: "autocorrect",
    description: "Suggest and learn corrections for mistyped commands, options and values (on/off)",
    value: SWITCH,
    read: (config) => formatBoolean(config.autocorrect),
    apply: (config, value) => ({ ...config, autocorrect: value === "on" })
  }
];
function settingCommand(setting) {
  return {
    name: setting.name,
    summary: setting.description,
    args: [{ name: "value", kind: setting.value, optional: true, description: "New value; omit to print the current one" }],
    async run(input, { store, stdout }) {
      const config = await store.loadConfig();
      const value = input.optionalArg("value");
      if (value === undefined) {
        stdout.write(`${setting.read(config)}
`);
        return;
      }
      const updated = setting.apply(config, value);
      await store.saveConfig(updated);
      stdout.write(`${setting.name} = ${setting.read(updated)}
`);
    }
  };
}
var configCommand = {
  name: "config",
  summary: "Read or change persisted settings.",
  group: "Settings",
  subcommandNoun: "setting",
  subcommands: SETTINGS.map(settingCommand),
  details: ["Settings live in ~/.dotfiles/todo/config.json. TODO_PANEL_LIMIT, TODO_PANEL_LAYOUT and TODO_PANEL_BOARDS override the panel settings."],
  examples: [
    { command: "todo config", note: "every setting with its value" },
    { command: "todo config panel-limit 15" },
    { command: "todo config panel-limit all" },
    { command: "todo config panel-layout side", note: "lanes in columns even on a narrow terminal" },
    { command: "todo config panel-boards all", note: "every board side by side at shell startup" },
    { command: "todo config startup-notifications off" }
  ],
  async run(_input, { store, stdout }) {
    const config = await store.loadConfig();
    for (const setting of SETTINGS) {
      stdout.write(`${setting.name.padEnd(22)} ${setting.read(config)}${DIM7}  ${setting.description}${RESET7}
`);
    }
  }
};
function formatBoolean(value) {
  return value ? "on" : "off";
}

// src/plugins/due.ts
import { randomUUID } from "crypto";

// src/adapters/command-runner.ts
import { spawn as spawn2 } from "child_process";
import { statSync as statSync2 } from "fs";

// src/adapters/sound.ts
import { statSync } from "fs";
import { isAbsolute, resolve } from "path";
import { extname } from "path";

// src/adapters/notifier.ts
import { spawn } from "child_process";
function createNotifier() {
  return {
    async notify({ title, body, urgent }) {
      await runQuietly("notify-send", ["--app-name=todo", `--urgency=${urgent ? "critical" : "normal"}`, title, body]);
    }
  };
}
function runQuietly(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore", ...cwd === undefined ? {} : { cwd } });
    child.on("error", () => resolve(-1));
    child.on("close", (code) => resolve(code ?? -1));
  });
}

// src/adapters/sound.ts
var SUPPORTED_SOUND_EXTENSIONS = [".mp3", ".wav", ".ogg", ".oga", ".flac", ".opus"];
var CUSTOM_PLAYERS = [
  { command: "mpv", args: (path) => ["--no-video", "--really-quiet", path] },
  { command: "ffplay", args: (path) => ["-nodisp", "-autoexit", "-loglevel", "quiet", path] },
  { command: "mpg123", args: (path) => ["-q", path] }
];
function createSoundPlayer() {
  return {
    async play(choice) {
      if (choice.soundMode === "none")
        return;
      if (choice.soundMode === "default") {
        const code = await runQuietly("canberra-gtk-play", ["-i", "message"]);
        if (code !== 0)
          throw new Error("could not play the default notification sound");
        return;
      }
      const path = choice.soundPath;
      if (path === undefined)
        throw new Error("no custom sound path was stored");
      for (const player of CUSTOM_PLAYERS) {
        if (await runQuietly(player.command, player.args(path)) === 0)
          return;
      }
      throw new Error(`no available player could play ${path}`);
    }
  };
}
function resolveSoundChoice(value, cwd = process.cwd()) {
  if (value === "default")
    return { soundMode: "default" };
  if (value === "none")
    return { soundMode: "none" };
  const path = toAbsolutePath(value, cwd);
  const extension = extname(path).toLowerCase();
  if (!SUPPORTED_SOUND_EXTENSIONS.includes(extension)) {
    throw new UserInputError(`Unsupported sound format: ${value}
Supported: ${SUPPORTED_SOUND_EXTENSIONS.join(", ")}`);
  }
  let stats;
  try {
    stats = statSync(path);
  } catch {
    throw new UserInputError(`Sound file not found: ${path}`);
  }
  if (!stats.isFile())
    throw new UserInputError(`Sound path is not a file: ${path}`);
  return { soundMode: "custom", soundPath: path };
}
function toAbsolutePath(value, cwd = process.cwd()) {
  const home = process.env.HOME ?? "";
  if (value === "~")
    return home;
  const expanded = value.startsWith("~/") ? `${home}/${value.slice(2)}` : value;
  return isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
}

// src/adapters/command-runner.ts
var COMMAND_TIMEOUT_MS = 60000;
function createCommandRunner() {
  return {
    run(command, cwd) {
      return new Promise((resolve) => {
        const child = spawn2("/bin/sh", ["-c", command], {
          stdio: "ignore",
          timeout: COMMAND_TIMEOUT_MS,
          ...cwd === undefined ? {} : { cwd }
        });
        child.on("error", (error) => resolve({ exitCode: -1, error: error.message }));
        child.on("close", (code, signal) => {
          if (signal !== null)
            return resolve({ exitCode: -1, error: `terminated by ${signal}` });
          resolve({ exitCode: code ?? -1 });
        });
      });
    }
  };
}
function resolveCommandCwd(value, cwd = process.cwd()) {
  const path = value === "pwd" ? cwd : toAbsolutePath(value, cwd);
  let stats;
  try {
    stats = statSync2(path);
  } catch {
    throw new UserInputError(`Working directory not found: ${path}`);
  }
  if (!stats.isDirectory())
    throw new UserInputError(`Working directory is not a directory: ${path}`);
  return path;
}

// src/domain/due-expression.ts
var MILLISECONDS_PER_SECOND = 1000;
var SECONDS_PER_DAY = 86400;
var DURATION_UNITS = new Map([
  ["s", "second"],
  ["sec", "second"],
  ["secs", "second"],
  ["second", "second"],
  ["seconds", "second"],
  ["m", "minute"],
  ["min", "minute"],
  ["mins", "minute"],
  ["minute", "minute"],
  ["minutes", "minute"],
  ["h", "hour"],
  ["hr", "hour"],
  ["hrs", "hour"],
  ["hour", "hour"],
  ["hours", "hour"],
  ["d", "day"],
  ["day", "day"],
  ["days", "day"]
]);
var UNIT_SECONDS = {
  second: 1,
  minute: 60,
  hour: 3600
};
var CALENDAR_OFFSETS = new Map([
  ["today", 0],
  ["tomorrow", 1],
  ["yesterday", -1],
  ["next week", 7]
]);
var WEEKDAYS2 = new Map([
  ["sunday", 0],
  ["sun", 0],
  ["monday", 1],
  ["mon", 1],
  ["mo", 1],
  ["tuesday", 2],
  ["tue", 2],
  ["tues", 2],
  ["wednesday", 3],
  ["wed", 3],
  ["thursday", 4],
  ["thu", 4],
  ["thur", 4],
  ["thurs", 4],
  ["friday", 5],
  ["fri", 5],
  ["saturday", 6],
  ["sat", 6]
]);
var MONTHS3 = new Map([
  ["jan", 1],
  ["january", 1],
  ["januari", 1],
  ["feb", 2],
  ["february", 2],
  ["februari", 2],
  ["mar", 3],
  ["march", 3],
  ["mrt", 3],
  ["maart", 3],
  ["apr", 4],
  ["april", 4],
  ["may", 5],
  ["mei", 5],
  ["jun", 6],
  ["june", 6],
  ["juni", 6],
  ["jul", 7],
  ["july", 7],
  ["juli", 7],
  ["aug", 8],
  ["august", 8],
  ["augustus", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["oct", 10],
  ["october", 10],
  ["okt", 10],
  ["oktober", 10],
  ["nov", 11],
  ["november", 11],
  ["dec", 12],
  ["december", 12]
]);
var INVALID_DUE_EXAMPLES = [
  "todo due 27 10m",
  "todo due 27 1h",
  "todo due 27 tomorrow",
  'todo due 27 "next monday"',
  "todo due 27 12-06"
];
function resolveDueExpression(value, now = new Date) {
  return resolveParsedDue(parseDueExpression(value, now), now);
}
function parseDueExpression(value, now = new Date) {
  const parsed = tryParseDueExpression(value, now);
  if (parsed === undefined)
    throw invalidDueError(value);
  return parsed;
}
function tryParseDueExpression(value, now = new Date) {
  const cleaned = value.trim().replace(/\s+/g, " ").toLowerCase();
  if (cleaned.length === 0)
    return;
  const split = splitExplicitTime(cleaned);
  if (split === undefined)
    return;
  const { datePart, time } = split;
  const expression = readExpression(normalizeDecimalComma(datePart), now.getFullYear());
  if (expression === undefined)
    return;
  if (expression.kind === "duration" && time !== undefined)
    return;
  return { expression, time };
}
function invalidDueError(value) {
  const examples = INVALID_DUE_EXAMPLES.map((example) => `  ${example}`).join(`
`);
  return new UserInputError(`Invalid due date: "${value}"

Examples:
${examples}`);
}
function resolveParsedDue({ expression, time }, now = new Date) {
  if (expression.kind === "duration")
    return resolveDuration(expression.amount, expression.unit, now);
  const target = resolveCalendarDate(expression, now);
  const applied = time ?? currentTimeOfDay(now);
  target.setHours(applied.hours, applied.minutes, applied.seconds, 0);
  return target.getTime();
}
function resolveDuration(amount, unit, now) {
  if (unit !== "day")
    return now.getTime() + Math.round(amount * UNIT_SECONDS[unit] * MILLISECONDS_PER_SECOND);
  const wholeDays = Math.floor(amount);
  const target = new Date(now);
  target.setDate(target.getDate() + wholeDays);
  const remainderSeconds = (amount - wholeDays) * SECONDS_PER_DAY;
  return target.getTime() + Math.round(remainderSeconds * MILLISECONDS_PER_SECOND);
}
function resolveCalendarDate(expression, now) {
  if (expression.kind === "calendar-offset") {
    const target = new Date(now);
    target.setDate(target.getDate() + expression.days);
    return target;
  }
  if (expression.kind === "weekday") {
    const target = new Date(now);
    const forward = (expression.weekday - target.getDay() + 7) % 7 || 7;
    target.setDate(target.getDate() + forward);
    return target;
  }
  return new Date(expression.year, expression.month - 1, expression.day);
}
function currentTimeOfDay(now) {
  return { hours: now.getHours(), minutes: now.getMinutes(), seconds: now.getSeconds() };
}
function splitExplicitTime(input) {
  const match = input.match(/^(.*\S)\s+at\s+(\S+)$/);
  if (match === null)
    return { datePart: input, time: undefined };
  const time = parseTimeOfDay2(match[2] ?? "");
  if (time === undefined)
    return;
  return { datePart: match[1] ?? "", time };
}
function parseTimeOfDay2(token) {
  const match = token.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match === null)
    return;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59)
    return;
  return { hours, minutes, seconds };
}
function normalizeDecimalComma(input) {
  return input.replace(/(\d),(\d)/g, "$1.$2");
}
function readExpression(datePart, currentYear) {
  return readDuration2(datePart) ?? readCalendarOffset(datePart) ?? readWeekday(datePart) ?? readNumericDate2(datePart, currentYear) ?? readTextualDate(datePart, currentYear);
}
function readDuration2(datePart) {
  const match = datePart.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (match === null)
    return;
  const unit = DURATION_UNITS.get(match[2] ?? "");
  const amount = Number(match[1]);
  if (unit === undefined || !Number.isFinite(amount) || amount < 0)
    return;
  return { kind: "duration", amount, unit };
}
function readCalendarOffset(datePart) {
  const days = CALENDAR_OFFSETS.get(datePart);
  return days === undefined ? undefined : { kind: "calendar-offset", days };
}
function readWeekday(datePart) {
  const match = datePart.match(/^next ([a-z]+)$/);
  if (match === null)
    return;
  const weekday = WEEKDAYS2.get(match[1] ?? "");
  return weekday === undefined ? undefined : { kind: "weekday", weekday };
}
function readNumericDate2(datePart, currentYear) {
  const compact = datePart.match(/^(\d{2})(\d{2})$/);
  if (compact !== null)
    return buildDate(currentYear, Number(compact[2]), Number(compact[1]));
  const separated = datePart.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2}|\d{4}))?$/);
  if (separated === null)
    return;
  return buildDate(readYear(separated[3]) ?? currentYear, Number(separated[2]), Number(separated[1]));
}
function readTextualDate(datePart, currentYear) {
  const match = datePart.match(/^(\d{1,2}) ([a-z]+)(?: (\d{2}|\d{4}))?$/);
  if (match === null)
    return;
  const month = MONTHS3.get(match[2] ?? "");
  if (month === undefined)
    return;
  return buildDate(readYear(match[3]) ?? currentYear, month, Number(match[1]));
}
function readYear(token) {
  if (token === undefined)
    return;
  const year = Number(token);
  return token.length === 2 ? 2000 + year : year;
}
function buildDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31)
    return;
  if (!isRealDate(year, month, day))
    return;
  return { kind: "absolute-date", year, month, day };
}
function isRealDate(year, month, day) {
  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day;
}

// src/scheduler/daemon.ts
import { watch } from "fs";
import { dirname } from "path";

// src/scheduler/reminder-processor.ts
async function processDueReminders(store, effects, now = Date.now()) {
  const claimed = await store.runExclusive(async () => {
    const tasks = await store.loadTasks();
    const ready = tasks.filter((task) => isReadyToFire(task, now));
    if (ready.length === 0)
      return [];
    for (const task of ready) {
      if (task.reminder !== undefined)
        task.reminder.firedAt = now;
    }
    await store.saveTasks(tasks);
    return ready.map((task) => ({ task, reminder: { ...task.reminder } }));
  });
  if (claimed.length === 0)
    return [];
  const outcomes = await Promise.all(claimed.map(({ task, reminder }) => deliver(task, reminder, effects)));
  await recordOutcomes(store, outcomes);
  return claimed.map(({ task, reminder }) => ({ taskId: task.id, reminderId: reminder.id, description: task.description }));
}
function isReadyToFire(task, now) {
  const reminder = task.reminder;
  if (reminder === undefined)
    return false;
  return task.status === "pending" && reminder.firedAt === undefined && reminder.dueAt <= now;
}
function findNextWakeAt(tasks, now) {
  const upcoming = tasks.filter((task) => task.reminder !== undefined && task.status === "pending" && task.reminder.firedAt === undefined).map((task) => task.reminder.dueAt).filter((dueAt) => dueAt > now);
  return upcoming.length === 0 ? undefined : Math.min(...upcoming);
}
async function deliver(task, reminder, effects) {
  const outcome = { taskId: task.id, reminderId: reminder.id };
  try {
    await effects.notifier.notify({
      title: "Todo due",
      body: `#${task.id} \xB7 ${task.description}`,
      urgent: true
    });
  } catch {}
  try {
    await effects.sound.play(reminder);
  } catch (error) {
    outcome.soundError = error instanceof Error ? error.message : String(error);
  }
  if (reminder.run !== undefined) {
    const result = await effects.runner.run(reminder.run, reminder.cwd);
    outcome.runExitCode = result.exitCode;
    if (result.error !== undefined)
      outcome.runError = result.error;
  }
  return outcome;
}
async function recordOutcomes(store, outcomes) {
  const interesting = outcomes.filter((outcome) => outcome.soundError !== undefined || outcome.runExitCode !== undefined);
  if (interesting.length === 0)
    return;
  await store.runExclusive(async () => {
    const tasks = await store.loadTasks();
    let changed = false;
    for (const outcome of interesting) {
      const reminder = tasks.find((task) => task.id === outcome.taskId)?.reminder;
      if (reminder === undefined || reminder.id !== outcome.reminderId)
        continue;
      if (outcome.soundError !== undefined)
        reminder.soundError = outcome.soundError;
      if (outcome.runExitCode !== undefined)
        reminder.runExitCode = outcome.runExitCode;
      if (outcome.runError !== undefined)
        reminder.runError = outcome.runError;
      changed = true;
    }
    if (changed)
      await store.saveTasks(tasks);
  });
}

// src/scheduler/daemon.ts
var MAX_SLEEP_MS = 15 * 60 * 1000;
var MIN_SLEEP_MS = 250;
var WATCH_DEBOUNCE_MS = 150;
async function runScheduler(store, options = {}) {
  const effects = options.effects ?? createDefaultEffects();
  const watcher = watchTasksFile(store);
  try {
    for (let cycle = 0;options.maxCycles === undefined || cycle < options.maxCycles; cycle += 1) {
      if (options.signal?.aborted === true)
        return;
      await processDueReminders(store, effects);
      const nextWakeAt = findNextWakeAt(await store.loadTasks(), Date.now());
      options.onCycle?.(nextWakeAt);
      if (options.maxCycles !== undefined && cycle + 1 >= options.maxCycles)
        return;
      await sleepUntil(nextWakeAt, watcher.changed, options.signal);
    }
  } finally {
    watcher.close();
  }
}
function createDefaultEffects() {
  return { notifier: createNotifier(), sound: createSoundPlayer(), runner: createCommandRunner() };
}
function watchTasksFile(store) {
  const directory = dirname(store.tasksFile);
  let notify;
  let timer;
  let handle;
  try {
    handle = watch(directory, () => {
      if (timer !== undefined)
        clearTimeout(timer);
      timer = setTimeout(() => notify?.(), WATCH_DEBOUNCE_MS);
    });
    handle.on("error", () => {
      return;
    });
  } catch {
    handle = undefined;
  }
  return {
    changed: () => new Promise((resolve) => {
      notify = resolve;
    }),
    close() {
      if (timer !== undefined)
        clearTimeout(timer);
      handle?.close();
    }
  };
}
function sleepUntil(nextWakeAt, changed, signal) {
  const requested = nextWakeAt === undefined ? MAX_SLEEP_MS : nextWakeAt - Date.now();
  const duration = Math.max(MIN_SLEEP_MS, Math.min(MAX_SLEEP_MS, requested));
  return new Promise((resolve) => {
    const timer = setTimeout(finish, duration);
    function finish() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    }
    signal?.addEventListener("abort", finish, { once: true });
    changed().then(finish);
  });
}

// src/scheduler/service.ts
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
var SERVICE_NAME = "todo-scheduler.service";
function getServicePath() {
  return join(process.env.HOME ?? ".", ".config", "systemd", "user", SERVICE_NAME);
}
function buildServiceUnit(executable) {
  return [
    "[Unit]",
    "Description=todo reminder scheduler",
    "After=graphical-session.target",
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=${executable} due daemon run`,
    "Restart=always",
    "RestartSec=5",
    "",
    "[Install]",
    "WantedBy=default.target",
    ""
  ].join(`
`);
}
function findTodoExecutable() {
  const installed = join(process.env.HOME ?? ".", ".config", "dotfiles", "bin", "todo");
  if (existsSync(installed))
    return installed;
  const script = process.argv[1];
  return script === undefined ? installed : `${process.execPath} ${script}`;
}
async function installService() {
  const path = getServicePath();
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, buildServiceUnit(findTodoExecutable()), "utf8");
  await runQuietly("systemctl", ["--user", "daemon-reload"]);
  const enabled = await runQuietly("systemctl", ["--user", "enable", "--now", SERVICE_NAME]) === 0;
  return { path, enabled };
}
async function isServiceActive() {
  return await runQuietly("systemctl", ["--user", "is-active", "--quiet", SERVICE_NAME]) === 0;
}

// src/plugins/due.ts
var { reset, dim, bold, label } = DUE_COLORS;
var CLEAR_WORDS = new Set(["clear", "remove"]);
var dueCommand = {
  name: "due",
  summary: "Set, inspect, and clear due dates with reminders.",
  group: "Change",
  args: [
    { name: "todo", kind: "task-selector", description: "Task ID, #ID, or the exact name of a pending task" },
    { name: "when", kind: "due-time", variadic: true, optional: true, description: "When it is due, or clear / remove / reset; omit to inspect" }
  ],
  flags: [
    { name: "sound", value: "path", description: "default, none, or a sound file stored as an absolute path" },
    { name: "run", value: "shell-command", description: "Command to execute once when the reminder fires" },
    { name: "cwd", value: "path", description: "Working directory for --run; pwd captures the current one" }
  ],
  details: [
    "A due date notifies once, natively, even after the shell that set it has exited.",
    "`todo due <todo>` shows the due date and reminder state; `clear` (or `remove`) drops it; `reset` rearms a fired reminder without changing it.",
    "Omitting a time keeps the current local clock time. Past dates are valid; they store, render overdue, and notify once.",
    "`m` always means minutes. There is no month unit."
  ],
  sections: [
    {
      heading: "Relative",
      rows: [
        { left: "30s", right: "30 seconds" },
        { left: "10m", right: "10 minutes" },
        { left: "1h", right: "1 hour" },
        { left: "3,5h", right: "3.5 hours (3.5h works too)" },
        { left: "2d", right: "2 calendar days" }
      ]
    },
    {
      heading: "Calendar",
      rows: [
        { left: "today", right: "today at the current clock time" },
        { left: "tomorrow", right: "tomorrow at the current clock time" },
        { left: "yesterday", right: "already overdue, on purpose" },
        { left: "next week", right: "same weekday, seven days on" },
        { left: "next monday", right: "the next Monday strictly after today" },
        { left: "next tue", right: "abbreviations work for every weekday" }
      ]
    },
    {
      heading: "Dates",
      rows: [
        { left: "1206", right: "12 June, current year" },
        { left: "12-06", right: "day first, the Dutch way" },
        { left: "12 jul", right: "English or Dutch month names" },
        { left: "12 juli", right: "same date as 12 jul" },
        { left: "12-06-2027", right: "two-digit years read as 20YY" }
      ]
    },
    {
      heading: "Times",
      rows: [
        { left: "tomorrow at 09:00", right: "HH:mm or HH:mm:ss, 24 hour" },
        { left: "next monday at 14:30" },
        { left: "12-06 at 18:00" }
      ]
    }
  ],
  examples: [
    { command: "todo due 27 tomorrow" },
    { command: "todo due 27 3,5h" },
    { command: "todo due 27 next monday at 09:00" },
    { command: 'todo due 27 10m --run "bun run build" --cwd pwd' },
    { command: "todo due 27 clear" },
    { command: "todo due list overdue" }
  ],
  subcommands: [
    {
      name: "list",
      summary: "Every pending todo that has a due date, most urgent first.",
      args: [{ name: "filter", kind: { oneOf: ["overdue", "today", "week"] }, optional: true, description: "overdue, today (plus overdue) or week (plus overdue)" }],
      details: ["Overdue first, most overdue at the top, then upcoming soonest first. Completed todos are left out."],
      examples: [{ command: "todo due list" }, { command: "todo due list overdue" }],
      run: (input, context) => listDue(context, input.optionalArg("filter") ?? "all")
    },
    {
      name: "daemon",
      summary: "The background scheduler that delivers reminders.",
      defaultSubcommand: "run",
      details: [
        "One scheduler handles every reminder; there is no process per todo.",
        "Any `todo` command also delivers overdue reminders, so the daemon is a delivery guarantee rather than a requirement."
      ],
      subcommands: [
        {
          name: "run",
          summary: "Run the scheduler in the foreground; this is what the service starts.",
          details: ["Useful for debugging reminders. Stop it with Ctrl+C."],
          examples: [{ command: "todo due daemon run" }],
          async run(_input, { store }) {
            await runScheduler(store);
          }
        },
        {
          name: "install",
          summary: "Write and enable a systemd user service so reminders survive a reboot.",
          examples: [{ command: "todo due daemon install" }, { command: "todo due daemon status", note: "check it is running" }],
          async run(_input, { stdout }) {
            const { path, enabled } = await installService();
            stdout.write(`${DUE_COLORS.upcoming}Wrote ${path}${reset}
`);
            stdout.write(enabled ? `${DUE_COLORS.upcoming}Enabled and started ${SERVICE_NAME}${reset}
` : `${DUE_COLORS.overdue}Could not enable ${SERVICE_NAME}; start it with 'systemctl --user enable --now ${SERVICE_NAME}'${reset}
`);
          }
        },
        {
          name: "status",
          summary: "Report whether the service is running.",
          examples: [{ command: "todo due daemon status" }],
          async run(_input, { stdout }) {
            const active = await isServiceActive();
            stdout.write(active ? `${DUE_COLORS.upcoming}${SERVICE_NAME} is running${reset}
` : `${dim}${SERVICE_NAME} is not running. Install it with 'todo due daemon install'.${reset}
`);
          }
        }
      ]
    }
  ],
  run: runDue
};
async function runDue(input, context) {
  const { store, stdout } = context;
  const selector = input.arg("todo");
  const when = input.args("when");
  const verb = when[0];
  if (verb === undefined) {
    const task = findTaskByIdOrDescription(await store.loadTasks(), selector);
    stdout.write(formatInspect(task, Date.now()));
    return;
  }
  if (CLEAR_WORDS.has(verb) && when.length === 1) {
    return await mutate(store, selector, (tasks, task) => clearDue(tasks, task, stdout));
  }
  if (verb === "reset" && when.length === 1) {
    return await mutate(store, selector, (tasks, task) => resetDue(tasks, task, stdout));
  }
  const options = readDueOptions(input);
  return await mutate(store, selector, (tasks, task) => setDue(tasks, task, options, stdout));
}
async function mutate(store, selector, change) {
  await store.runExclusive(async () => {
    const tasks = await store.loadTasks();
    const task = findTaskByIdOrDescription(tasks, selector);
    if (change(tasks, task))
      await store.saveTasks(tasks);
  });
}
function setDue(tasks, task, options, stdout) {
  const { when, sound, run, cwd } = options;
  const now = new Date;
  const dueAt = resolveDueExpression(when, now);
  const reminder = {
    id: randomUUID(),
    dueAt,
    expression: when,
    createdAt: now.getTime(),
    soundMode: sound.soundMode
  };
  if (sound.soundPath !== undefined)
    reminder.soundPath = sound.soundPath;
  if (run !== undefined)
    reminder.run = run;
  if (cwd !== undefined)
    reminder.cwd = cwd;
  task.reminder = reminder;
  task.dueDate = dueAt;
  task.updatedAt = now.getTime();
  const color = getUrgencyColor(dueAt, now.getTime());
  stdout.write(`${color}Due #${task.id}${reset} ${bold}${formatAbsoluteDue(dueAt)}${reset} ${dim}(${formatRelativeDue(dueAt, now.getTime())})${reset}
`);
  return true;
}
function clearDue(_tasks, task, stdout) {
  if (task.reminder === undefined && task.dueDate === undefined) {
    stdout.write(`${dim}#${task.id} has no due date${reset}
`);
    return false;
  }
  delete task.reminder;
  delete task.dueDate;
  task.updatedAt = Date.now();
  stdout.write(`${DUE_COLORS.upcoming}Cleared the due date on #${task.id}${reset}
`);
  return true;
}
function resetDue(_tasks, task, stdout) {
  const reminder = task.reminder;
  if (reminder === undefined)
    throw new UserInputError(`#${task.id} has no due date to reset. Set one with 'todo due ${task.id} <when>'.`);
  delete reminder.firedAt;
  delete reminder.soundError;
  delete reminder.runExitCode;
  delete reminder.runError;
  task.updatedAt = Date.now();
  const relative = formatRelativeDue(reminder.dueAt, Date.now());
  stdout.write(`${DUE_COLORS.upcoming}Rearmed the reminder on #${task.id}${reset} ${dim}(due ${formatAbsoluteDue(reminder.dueAt)}, ${relative})${reset}
`);
  return true;
}
function readDueOptions(input) {
  const when = input.args("when").join(" ").trim();
  const soundValue = input.value("sound");
  const sound = soundValue === undefined ? { soundMode: "default" } : resolveSoundChoice(soundValue);
  const run = input.value("run");
  const rawCwd = input.value("cwd");
  if (rawCwd !== undefined && run === undefined)
    throw new UserInputError("--cwd only applies to --run; add a --run command or drop --cwd.");
  return { when, sound, run, cwd: rawCwd === undefined ? undefined : resolveCommandCwd(rawCwd) };
}
function formatInspect(task, now) {
  const lines = [`${bold}Todo #${task.id}${reset} ${dim}${task.description}${reset}`];
  const reminder = task.reminder;
  if (reminder === undefined) {
    if (task.dueDate === undefined) {
      lines.push(`${dim}No due date. Set one with 'todo due ${task.id} tomorrow'.${reset}`);
      return `${lines.join(`
`)}
`;
    }
    lines.push(row("Due", `${formatAbsoluteDue(task.dueDate)}`));
    lines.push(row("Relative", formatRelativeDue(task.dueDate, now)));
    lines.push(row("Notify", `${dim}legacy reminder from 'todo add --due'${reset}`));
    return `${lines.join(`
`)}
`;
  }
  const color = getUrgencyColor(reminder.dueAt, now);
  lines.push(row("Due", `${color}${formatAbsoluteDue(reminder.dueAt)}${reset}`));
  lines.push(row("Relative", `${color}${formatRelativeDue(reminder.dueAt, now)}${reset}`));
  lines.push(row("Notify", task.status === "completed" ? "suppressed (completed)" : formatNotifyState(reminder)));
  lines.push(row("Sound", formatSound(reminder)));
  if (reminder.soundError !== undefined)
    lines.push(row("Sound error", `${DUE_COLORS.overdue}${reminder.soundError}${reset}`));
  if (reminder.run !== undefined)
    lines.push(row("Run", reminder.run));
  if (reminder.cwd !== undefined)
    lines.push(row("Cwd", reminder.cwd));
  if (reminder.runExitCode !== undefined)
    lines.push(row("Run result", formatRunResult(reminder)));
  return `${lines.join(`
`)}
`;
}
function formatRunResult(reminder) {
  if (reminder.runError !== undefined)
    return `${DUE_COLORS.overdue}${reminder.runError}${reset}`;
  const code = reminder.runExitCode;
  return code === 0 ? "exit 0" : `${DUE_COLORS.overdue}exit ${code}${reset}`;
}
function row(name, value) {
  return `${label}${`${name}:`.padEnd(11)}${reset}${value}`;
}
async function listDue({ store, stdout }, filter) {
  const now = Date.now();
  const tasks = (await store.loadTasks()).filter((task) => task.status === "pending" && task.dueDate !== undefined);
  const matching = tasks.filter((task) => matchesFilter(task.dueDate, filter, now)).sort(compareByUrgency);
  if (matching.length === 0) {
    stdout.write(`${dim}No todos with a due date${filter === "all" ? "" : ` (${filter})`}${reset}
`);
    return;
  }
  const width = Math.min(28, Math.max(...matching.map((task) => task.description.length)));
  for (const task of matching) {
    const dueAt = task.dueDate;
    const color = getUrgencyColor(dueAt, now);
    const id = `${dim}#${task.id.padStart(2, "0")}${reset}`;
    const description = truncate2(task.description, width).padEnd(width);
    stdout.write(`${id}  ${description}  ${color}${formatCompactDue(dueAt, now)}${reset}
`);
  }
}
function matchesFilter(dueAt, filter, now) {
  if (filter === "all")
    return true;
  if (filter === "overdue")
    return dueAt < now;
  const end = new Date(now);
  if (filter === "today")
    end.setHours(23, 59, 59, 999);
  else
    end.setDate(end.getDate() + 7);
  return dueAt <= end.getTime();
}
function compareByUrgency(left, right) {
  return left.dueDate - right.dueDate;
}
function truncate2(value, maximumLength) {
  return value.length > maximumLength ? `${value.slice(0, maximumLength - 1)}\u2026` : value;
}

// src/plugins/epic.ts
var GREEN6 = "\x1B[32m";
var RESET8 = "\x1B[0m";
var epicCommand = {
  name: "epic",
  summary: "Create an epic that groups subtasks.",
  group: "Create",
  args: [{ name: "name", kind: "text", variadic: true, description: "Epic name; separate several with commas" }],
  flags: [...TASK_FLAGS, { name: "under", aliases: ["parent", "in"], value: "task-id", description: "Nest the epic under another task" }, ...PLACEMENT_FLAGS],
  details: [
    "An epic is a task that renders bold with a [done/total] badge even while empty.",
    "Accepts the same options as `todo add`."
  ],
  examples: [
    { command: "todo epic Website redesign" },
    { command: "todo epic Q4 launch, Hiring --priority high" }
  ],
  async run(input, { store, stdout }) {
    const epics = await insertTasks(store, readAddOptions(input, new Date, { kind: "epic" }, input.args("name")), readPlacement(input));
    for (const epic of epics)
      stdout.write(formatAddedTask(epic));
  }
};
var subCommand = {
  name: "sub",
  summary: "Add subtasks under an existing task.",
  group: "Create",
  args: [
    { name: "parent", kind: "task-selector", description: "Parent task ID, or the exact name of a task" },
    { name: "description", kind: "text", variadic: true, description: "Subtask text; separate several with commas" }
  ],
  flags: [...TASK_FLAGS, ...PLACEMENT_FLAGS],
  details: [
    "The parent can be a task ID or the exact name of an existing task; the longest matching",
    "name wins and the description starts right after it. `todo 3 fix header` is the same as `todo sub 3 fix header`.",
    "Nesting has no depth limit. Subtasks of a task on the active board follow it there."
  ],
  examples: [
    { command: "todo sub 1 fix header, fix footer", note: "two subtasks under #1" },
    { command: "todo sub new month pay rent", note: "under the task named new month" },
    { command: "todo sub 3 write tests --due friday" }
  ],
  async run(input, { store, stdout }) {
    const { parentId, rest } = resolveSubTarget(await store.loadTasks(), [...input.positionals]);
    const tasks = await insertTasks(store, readAddOptions(input, new Date, { parentId }, rest), readPlacement(input));
    for (const task of tasks)
      stdout.write(formatAddedTask(task));
  }
};
var moveCommand = {
  name: "move",
  aliases: ["mv"],
  summary: "Re-parent a task inside the tree.",
  group: "Change",
  args: [
    { name: "id", kind: "task-id", description: "Task to move" },
    { name: "parent", kind: "parent-id", description: "New parent ID, or root / top / - for the top level" }
  ],
  details: [
    "The whole subtree moves along. root, top, and - all mean the top level.",
    "This changes the tree, not boards. To move a task to another board, use `todo board move <id> --to <board>`."
  ],
  examples: [
    { command: "todo move 5 2", note: "nest #5 under #2" },
    { command: "todo move 5 root", note: "back to the top level" }
  ],
  run: runMove
};
var reorderCommand = {
  name: "reorder",
  summary: "Change a task's position among its siblings.",
  group: "Change",
  args: [{ name: "id", kind: "task-id", description: "Task to reposition" }],
  flags: [
    { name: "before", value: "task-id", description: "Place right above this sibling" },
    { name: "after", value: "task-id", description: "Place right below this sibling" },
    { name: "top", description: "First among its siblings" },
    { name: "bottom", description: "Last among its siblings" }
  ],
  details: [
    "Only changes position among siblings under the same epic, or the top level; it never re-parents.",
    "Use `todo move` to change parents. Give exactly one of the options."
  ],
  examples: [
    { command: "todo reorder 5 --before 2", note: "#5 goes right above #2" },
    { command: "todo reorder 5 --after 2", note: "#5 goes right below #2" },
    { command: "todo reorder 5 --top", note: "first among its siblings" }
  ],
  run: runReorder
};
function resolveSubTarget(tasks, args) {
  const [first, ...rest] = args;
  if (first === undefined)
    throw new UserInputError(SUB_USAGE);
  if (/^#?\d+$/.test(first.trim())) {
    if (rest.length === 0)
      throw new UserInputError(SUB_USAGE);
    return { parentId: parseTaskIdArgument(first), rest };
  }
  const nameLimit = getNameLimit(args);
  for (let length = nameLimit;length > 0; length -= 1) {
    const match = findTaskByName(tasks, args.slice(0, length).join(" "));
    if (match === undefined)
      continue;
    return { parentId: match.id, rest: args.slice(length) };
  }
  throw new UserInputError(`Task not found: ${args.slice(0, nameLimit).join(" ")}`);
}
function getNameLimit(args) {
  const stop = args.findIndex((argument) => argument.startsWith("--") || argument.endsWith(","));
  const limit = stop === -1 ? args.length : stop;
  return Math.min(limit, args.length - 1);
}
function findTaskByName(tasks, name) {
  const needle = normalizeName(name);
  if (needle.length === 0)
    return;
  const matches = tasks.filter((task) => normalizeName(task.description) === needle);
  const pending = matches.filter((task) => task.status === "pending");
  const candidates = pending.length > 0 ? pending : matches;
  return candidates.find((task) => task.kind === "epic") ?? candidates[0];
}
function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
var SUB_USAGE = "Usage: todo sub <parent> <description\u2026>";
async function runMove(input, { store, stdout }) {
  const tasks = await store.loadTasks();
  const target = input.arg("parent");
  const parentId = isRootTarget(target) ? undefined : parseTaskIdArgument(target);
  const task = moveTask(tasks, input.arg("id"), parentId);
  await store.saveTasks(tasks);
  stdout.write(parentId === undefined ? `${GREEN6}Moved #${task.id} to the top level${RESET8}
` : `${GREEN6}Moved #${task.id} under #${parentId}${RESET8}
`);
}
function isRootTarget(value) {
  return value === "root" || value === "top" || value === "-";
}
async function runReorder(input, { store, stdout }) {
  const position = readReorderPosition(input);
  const tasks = await store.loadTasks();
  const task = reorderTask(tasks, input.arg("id"), position);
  await store.saveTasks(tasks);
  stdout.write(`${GREEN6}Reordered #${task.id}${RESET8}
`);
}
function readReorderPosition(input) {
  const positions = [];
  const before = input.value("before");
  const after = input.value("after");
  if (before !== undefined)
    positions.push({ type: "before", anchorId: before });
  if (after !== undefined)
    positions.push({ type: "after", anchorId: after });
  if (input.flag("top"))
    positions.push({ type: "top" });
  if (input.flag("bottom"))
    positions.push({ type: "bottom" });
  const [position] = positions;
  if (position === undefined || positions.length > 1)
    throw new UserInputError("Usage: todo reorder <id> --before <id>|--after <id>|--top|--bottom");
  return position;
}
var epicCommands = [epicCommand, subCommand, moveCommand, reorderCommand];

// src/plugins/help.ts
import { emitKeypressEvents as emitKeypressEvents2 } from "readline";

// src/domain/help-search.ts
function findMatches(lines, query) {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0)
    return [];
  const matches = [];
  lines.forEach((line, index) => {
    const haystack = line.toLowerCase();
    let from = 0;
    for (;; ) {
      const start = haystack.indexOf(needle, from);
      if (start === -1)
        break;
      matches.push({ line: index, start, end: start + needle.length });
      from = start + needle.length;
    }
  });
  return matches;
}
function findMatchingLines(lines, query) {
  return [...new Set(findMatches(lines, query).map((match) => match.line))];
}
function stepMatch(current, total, direction) {
  if (total === 0)
    return -1;
  return ((current + direction) % total + total) % total;
}
function matchesOnLine(matches, line) {
  return matches.filter((match) => match.line === line);
}

// src/presentation/help-browser.ts
var RESET9 = "\x1B[0m";
var DIM8 = "\x1B[2m";
var BOLD5 = "\x1B[1m";
var ACCENT2 = "\x1B[38;5;208m";
var HEADING = "\x1B[38;5;147m";
var MATCH_ON = "\x1B[48;5;238m";
var MATCH_OFF = "\x1B[49m";
var CURRENT_ON = "\x1B[48;5;208m\x1B[38;5;232m";
var CURRENT_OFF = "\x1B[49m\x1B[39m";
var HEADER_HEIGHT = 3;
var FOOTER_HEIGHT = 1;

class HelpBrowser {
  lines;
  terminal;
  mode = "browse";
  offset = 0;
  savedOffset = 0;
  query = "";
  draft = "";
  matches = [];
  matchIndex = -1;
  done = false;
  constructor(lines, terminal) {
    this.lines = lines;
    this.terminal = terminal;
  }
  get closed() {
    return this.done;
  }
  handleKey(key) {
    if (key.ctrl === true && key.name === "c") {
      this.done = true;
      return;
    }
    if (this.mode === "search")
      this.handleSearchKey(key);
    else
      this.handleBrowseKey(key);
  }
  render() {
    const width = Math.max(40, this.terminal.columns);
    const body = this.visibleLines();
    const height = this.bodyHeight;
    this.offset = clamp(this.offset, 0, Math.max(0, body.length - height));
    const window = body.slice(this.offset, this.offset + height);
    const lines = [...this.renderHeader(width, body.length)];
    for (const index of window)
      lines.push(this.renderLine(index, width));
    for (let filler = window.length;filler < height; filler += 1)
      lines.push("");
    lines.push(this.renderFooter(width));
    return lines.join(`
`);
  }
  visibleLines() {
    if (this.mode === "search" && this.draft.trim().length > 0) {
      return findMatchingLines(this.lines.map((line) => line.plain), this.draft);
    }
    return this.lines.map((_line, index) => index);
  }
  get bodyHeight() {
    return Math.max(1, Math.max(8, this.terminal.rows) - HEADER_HEIGHT - FOOTER_HEIGHT);
  }
  handleBrowseKey(key) {
    const half = Math.max(1, Math.floor(this.bodyHeight / 2));
    if (key.sequence === "/") {
      this.mode = "search";
      this.savedOffset = this.offset;
      this.draft = "";
      this.offset = 0;
      return;
    }
    if (key.sequence === "n" || isEnter(key))
      return this.stepToMatch(1);
    if (key.sequence === "N")
      return this.stepToMatch(-1);
    if (key.sequence === "q" || key.name === "escape" && this.query.length === 0) {
      this.done = true;
      return;
    }
    if (key.name === "escape") {
      this.clearSearch();
      return;
    }
    if (key.sequence === "j" || key.name === "down")
      this.scroll(1);
    else if (key.sequence === "k" || key.name === "up")
      this.scroll(-1);
    else if (key.ctrl === true && key.name === "d")
      this.scroll(half);
    else if (key.ctrl === true && key.name === "u")
      this.scroll(-half);
    else if (key.name === "pagedown" || key.name === "space" || key.sequence === " ")
      this.scroll(this.bodyHeight);
    else if (key.name === "pageup" || key.sequence === "b")
      this.scroll(-this.bodyHeight);
    else if (key.sequence === "g" || key.name === "home")
      this.offset = 0;
    else if (key.sequence === "G" || key.name === "end")
      this.offset = Number.MAX_SAFE_INTEGER;
  }
  handleSearchKey(key) {
    if (isEnter(key)) {
      this.commitSearch();
      return;
    }
    if (key.name === "escape") {
      this.mode = "browse";
      this.draft = "";
      this.offset = this.savedOffset;
      return;
    }
    if (key.name === "backspace") {
      this.draft = this.draft.slice(0, -1);
      this.offset = 0;
      return;
    }
    if (key.ctrl === true && key.name === "u") {
      this.draft = "";
      this.offset = 0;
      return;
    }
    if (key.ctrl !== true && key.sequence !== undefined && key.sequence.length === 1 && key.sequence >= " ") {
      this.draft += key.sequence;
      this.offset = 0;
    }
  }
  commitSearch() {
    this.query = this.draft.trim();
    this.matches = findMatches(this.lines.map((line) => line.plain), this.query);
    this.mode = "browse";
    this.draft = "";
    if (this.matches.length === 0) {
      this.matchIndex = -1;
      this.offset = this.savedOffset;
      return;
    }
    this.matchIndex = 0;
    this.centerOn(this.matches[0].line);
  }
  clearSearch() {
    this.query = "";
    this.matches = [];
    this.matchIndex = -1;
  }
  stepToMatch(direction) {
    const next = stepMatch(this.matchIndex, this.matches.length, direction);
    if (next === -1)
      return;
    this.matchIndex = next;
    this.centerOn(this.matches[next].line);
  }
  centerOn(line) {
    this.offset = Math.max(0, line - Math.floor(this.bodyHeight / 2));
  }
  scroll(amount) {
    this.offset = Math.max(0, this.offset + amount);
  }
  renderHeader(width, bodyLength) {
    const counter = `${HEADING}${this.counterText(bodyLength)}${RESET9}`;
    const name = `${ACCENT2}${BOLD5}\u2713 todo help${RESET9}`;
    const subtitle = `  ${DIM8}\xB7  searchable command reference${RESET9}`;
    const title = getVisibleWidth(name) + getVisibleWidth(subtitle) + getVisibleWidth(counter) + 6 <= width ? `${name}${subtitle}` : name;
    return [
      clipVisible(padBetween(`  ${title}`, `${counter}  `, width), width),
      clipVisible(`  ${this.renderSearchBar()}`, width),
      `${DIM8}${"\u2500".repeat(width)}${RESET9}`
    ];
  }
  renderSearchBar() {
    if (this.mode === "search")
      return `${HEADING}/${RESET9} ${this.draft}${BOLD5}\u258F${RESET9}`;
    if (this.query.length > 0)
      return `${HEADING}/${RESET9} ${this.query}   ${DIM8}n next \xB7 N previous \xB7 Esc clear${RESET9}`;
    return `${DIM8}/ to search \xB7 j k \u2191 \u2193 to scroll${RESET9}`;
  }
  counterText(bodyLength) {
    if (this.mode === "search") {
      if (this.draft.trim().length === 0)
        return "type to filter";
      return bodyLength === 1 ? "1 matching line" : `${bodyLength} matching lines`;
    }
    if (this.query.length > 0) {
      if (this.matches.length === 0)
        return `0/0 matches for "${this.query}"`;
      return `${this.matchIndex + 1}/${this.matches.length} matches`;
    }
    const last = Math.min(bodyLength, this.offset + this.bodyHeight);
    return `${last}/${bodyLength} lines`;
  }
  renderFooter(width) {
    const options = this.mode === "search" ? [["Enter search", "Esc cancel", "^u clear"], ["Enter search", "Esc cancel"]] : [["j k \u2191 \u2193 scroll", "^d ^u page", "g G ends", "/ search", "n N matches", "q quit"], ["j k scroll", "/ search", "n N matches", "q quit"], ["/ search", "q quit"]];
    const hints = options.find((candidate) => candidate.join(" \xB7 ").length + 2 <= width) ?? options[options.length - 1];
    return clipVisible(`${DIM8}  ${hints.join(" \xB7 ")}${RESET9}`, width);
  }
  renderLine(index, width) {
    const line = this.lines[index];
    if (line === undefined)
      return "";
    const needle = this.mode === "search" ? this.draft : this.query;
    if (needle.trim().length === 0)
      return clipVisible(line.text, width);
    const current = this.matches[this.matchIndex];
    const ranges = matchesOnLine(findMatches([line.plain], needle), 0).map((match) => ({
      start: match.start,
      end: match.end,
      ...current !== undefined && current.line === index && current.start === match.start ? { on: CURRENT_ON, off: CURRENT_OFF } : {}
    }));
    return clipVisible(highlightVisibleRanges(line.text, ranges, MATCH_ON, MATCH_OFF), width);
  }
}
function isEnter(key) {
  return key.name === "return" || key.name === "enter";
}
function padBetween(left, right, width) {
  const padding = " ".repeat(Math.max(1, width - getVisibleWidth(left) - getVisibleWidth(right)));
  return `${left}${padding}${right}`;
}
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum));
}

// src/presentation/help-document.ts
function buildHelpDocument(root, useColor) {
  const pages = walkSpecs(root).filter(({ path }) => path.every((node) => node.hidden !== true)).map(({ path }) => formatCommandHelp(path, useColor));
  const lines = [formatHelpOverview(root, useColor), ...pages].join(`
`).split(`
`);
  return collapseBlankRuns(lines).map((text) => ({ text, plain: stripAnsi(text) }));
}
function collapseBlankRuns(lines) {
  const result = [];
  for (const line of lines) {
    const blank = stripAnsi(line).trim().length === 0;
    if (blank && result.length > 0 && stripAnsi(result[result.length - 1]).trim().length === 0)
      continue;
    result.push(line);
  }
  while (result.length > 0 && stripAnsi(result[result.length - 1]).trim().length === 0)
    result.pop();
  return result;
}

// src/plugins/help.ts
var helpCommand = {
  name: "help",
  summary: "Browse the searchable help, or show help for one command.",
  group: "Settings",
  args: [{ name: "command", kind: "text", variadic: true, optional: true, description: "Command path, e.g. board add" }],
  flags: [{ name: "plain", description: "Print the overview instead of opening the browser" }],
  details: [
    "With no arguments in a terminal this opens the searchable help browser:",
    "j/k or the arrow keys scroll, ^d/^u page, g/G jump to the ends, / searches,",
    "Enter runs the search, n and N step through the matches, and q quits.",
    "Piped or redirected output stays plain, as does `todo help --plain`."
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
  }
};
function resolveHelpPath(root, words) {
  const path = [];
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
function isInteractiveTerminal() {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}
async function browseHelp(root) {
  const terminal = {
    write(text) {
      process.stdout.write(text);
    },
    get columns() {
      return process.stdout.columns ?? 80;
    },
    get rows() {
      return process.stdout.rows ?? 24;
    }
  };
  const browser = new HelpBrowser(buildHelpDocument(root, supportsColor()), terminal);
  const wasRaw = process.stdin.isRaw;
  const draw = () => {
    terminal.write(`\x1B[H${browser.render().split(`
`).join(`\x1B[K
`)}\x1B[K\x1B[J`);
  };
  emitKeypressEvents2(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  terminal.write("\x1B[?1049h\x1B[?1007h\x1B[?25l");
  await new Promise((resolve) => {
    const handleKeypress = (_character, key) => {
      if (key !== undefined)
        browser.handleKey(key);
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
  terminal.write("\x1B[?25h\x1B[?1007l\x1B[?1049l");
  if (!wasRaw)
    process.stdin.setRawMode(false);
  process.stdin.pause();
}

// src/plugins/interactive.ts
import { emitKeypressEvents as emitKeypressEvents3 } from "readline";
var DIM9 = "\x1B[2m";
var RESET10 = "\x1B[0m";
var BRIGHT = "\x1B[1m";
var MAUVE2 = "\x1B[38;5;147m";
var GREEN7 = "\x1B[38;5;166m";
var RED3 = "\x1B[38;5;203m";
var BLUE = "\x1B[38;5;116m";
var SELECTED2 = "\x1B[48;5;60m";
var PANEL_WIDTH2 = 72;
var VISIBLE_TASK_COUNT = 8;
var ADD_MODES = new Set(["adding", "adding-subtask", "adding-epic"]);
var WORKSPACES = [
  { key: "all", label: "all tasks" },
  { key: "today", label: "today" },
  { key: "overdue", label: "overdue" },
  { key: "high", label: "high priority" },
  { key: "archive", label: "archive" }
];
var interactiveCommand = {
  name: "interactive",
  aliases: ["i", "-i", "--interactive"],
  summary: "Open the keyboard-driven taskboard.",
  group: "View",
  details: [
    "Opens automatically when todo runs with no arguments in a terminal; the `todo` wrapper starts the Go TUI when it is installed.",
    "This built-in taskboard is the fallback. Press ? inside for the key map."
  ],
  async run(_input, { store }) {
    const taskboard = new Taskboard(store);
    await taskboard.start();
  }
};

class Taskboard {
  store;
  tasks = [];
  rows = [];
  sourceTasks = [];
  allTasks = [];
  collapsedIds = new Set;
  selectedIndex = 0;
  scrollOffset = 0;
  mode = "normal";
  view = "pending";
  focus = "tasks";
  workspaceIndex = 0;
  draft = "";
  searchQuery = "";
  selectedTaskIds = new Set;
  message = "";
  resolveClose;
  wasRaw = false;
  constructor(store) {
    this.store = store;
  }
  async start() {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      await this.refresh();
      process.stdout.write(this.render());
      return;
    }
    await this.refresh();
    this.wasRaw = process.stdin.isRaw;
    emitKeypressEvents3(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("keypress", this.handleKeypress);
    process.stdout.write("\x1B[?25l");
    this.draw();
    await new Promise((resolve) => {
      this.resolveClose = resolve;
    });
  }
  handleKeypress = (_, key) => {
    this.processKeypress(key).catch((error) => {
      this.message = error instanceof Error ? error.message : String(error);
      this.mode = "normal";
      this.draw();
    });
  };
  async processKeypress(key) {
    if (key.ctrl && key.name === "c") {
      this.close();
      return;
    }
    if (ADD_MODES.has(this.mode) || this.mode === "editing" || this.mode === "snoozing" || this.mode === "setting-due") {
      await this.processAddKeypress(key);
      return;
    }
    if (this.mode === "searching") {
      this.processSearchKeypress(key);
      return;
    }
    if (this.mode === "confirming-delete") {
      await this.processDeleteKeypress(key);
      return;
    }
    if (this.mode === "help") {
      if (key.name === "escape" || key.name === "return" || key.sequence === "?" || key.name === "q") {
        this.mode = "normal";
        this.draw();
      }
      return;
    }
    if (key.name === "tab") {
      this.focus = this.focus === "workspaces" ? "tasks" : "workspaces";
      this.draw();
      return;
    }
    if (this.focus === "workspaces") {
      if (key.name === "up" || key.sequence === "k")
        await this.moveWorkspace(-1);
      else if (key.name === "down" || key.sequence === "j")
        await this.moveWorkspace(1);
      else if (key.name === "return" || key.name === "space")
        this.focus = "tasks";
      else if (key.sequence === "q" || key.name === "escape")
        this.close();
      this.draw();
      return;
    }
    if (key.name === "up" || key.sequence === "k") {
      this.moveSelection(-1);
    } else if (key.name === "down" || key.sequence === "j") {
      this.moveSelection(1);
    } else if (key.name === "return" || key.name === "space") {
      await this.completeSelectedTask();
    } else if (key.sequence === "a") {
      this.startAdding("adding");
    } else if (key.sequence === "A") {
      if (this.selectedTask !== undefined && this.view === "pending")
        this.startAdding("adding-subtask");
    } else if (key.sequence === "E") {
      this.startAdding("adding-epic");
    } else if (key.name === "left" || key.sequence === "h") {
      this.collapseOrAscend();
    } else if (key.name === "right" || key.sequence === "l") {
      this.expandOrDescend();
    } else if (key.sequence === ">") {
      await this.indentSelectedTask();
    } else if (key.sequence === "<") {
      await this.outdentSelectedTask();
    } else if (key.sequence === "d") {
      if (this.selectedTask !== undefined)
        this.mode = "confirming-delete";
    } else if (key.sequence === "e") {
      this.editSelectedTask();
    } else if (key.sequence === "s") {
      this.snoozeSelectedTask();
    } else if (key.sequence === "u" || key.ctrl === true && key.name === "z") {
      await this.undoDelete();
    } else if (key.sequence === "p") {
      await this.cyclePriority();
    } else if (key.sequence === "t") {
      this.setDueDate();
    } else if (key.sequence === "x") {
      this.toggleTaskSelection();
    } else if (key.sequence === "c") {
      await this.completeSelectedTasks();
    } else if (key.sequence === "/") {
      this.mode = "searching";
      this.searchQuery = "";
      this.message = "";
    } else if (key.sequence === "v") {
      await this.toggleView();
    } else if (key.sequence === "r") {
      await this.refresh();
      this.message = "Refreshed";
    } else if (key.sequence === "?") {
      this.mode = "help";
    } else if (key.sequence === "q" || key.name === "escape") {
      this.close();
      return;
    }
    this.draw();
  }
  async processAddKeypress(key) {
    if (key.name === "escape") {
      this.mode = "normal";
      this.draft = "";
    } else if (key.name === "backspace") {
      this.draft = this.draft.slice(0, -1);
    } else if (key.name === "return") {
      if (ADD_MODES.has(this.mode))
        await this.addDraft();
      else if (this.mode === "editing")
        await this.saveEditedTask();
      else if (this.mode === "snoozing")
        await this.saveSnoozedTask();
      else
        await this.saveDueDate();
    } else if (key.sequence !== undefined && key.sequence >= " ") {
      this.draft += key.sequence;
    }
    this.draw();
  }
  processSearchKeypress(key) {
    if (key.name === "escape") {
      this.mode = "normal";
      this.searchQuery = "";
      this.applySearch();
    } else if (key.name === "backspace") {
      this.searchQuery = this.searchQuery.slice(0, -1);
      this.applySearch();
    } else if (key.name === "return") {
      this.mode = "normal";
    } else if (key.sequence !== undefined && key.sequence >= " ") {
      this.searchQuery += key.sequence;
      this.applySearch();
    }
    this.draw();
  }
  startAdding(mode) {
    this.mode = mode;
    this.draft = "";
    this.message = "";
  }
  collapseOrAscend() {
    const row = this.selectedRow;
    if (row === undefined)
      return;
    if (row.hasChildren && !row.collapsed) {
      this.collapsedIds.add(row.task.id);
      this.rebuildRows(row.task.id);
      return;
    }
    const parentIndex = this.rows.findIndex((candidate) => candidate.task.id === row.task.parentId);
    if (parentIndex !== -1) {
      this.selectedIndex = parentIndex;
      this.ensureSelectedTaskIsVisible();
    }
  }
  expandOrDescend() {
    const row = this.selectedRow;
    if (row === undefined || !row.hasChildren)
      return;
    if (row.collapsed) {
      this.collapsedIds.delete(row.task.id);
      this.rebuildRows(row.task.id);
      return;
    }
    this.moveSelection(1);
  }
  async indentSelectedTask() {
    const row = this.selectedRow;
    if (row === undefined || this.view === "archive")
      return;
    let target;
    for (let index = this.selectedIndex - 1;index >= 0; index -= 1) {
      const candidate = this.rows[index];
      if (candidate === undefined || candidate.depth < row.depth)
        break;
      if (candidate.depth === row.depth) {
        target = candidate.task;
        break;
      }
    }
    if (target === undefined) {
      this.message = "No task above to nest under";
      return;
    }
    await this.reparent(row.task.id, target.id);
  }
  async outdentSelectedTask() {
    const row = this.selectedRow;
    if (row === undefined || this.view === "archive")
      return;
    if (row.task.parentId === undefined) {
      this.message = "Already at the top level";
      return;
    }
    const parent = this.allTasks.find((candidate) => candidate.id === row.task.parentId);
    await this.reparent(row.task.id, parent?.parentId);
  }
  async reparent(id, parentId) {
    const tasks = await this.store.loadTasks();
    moveTask(tasks, id, parentId);
    await this.store.saveTasks(tasks);
    if (parentId !== undefined)
      this.collapsedIds.delete(parentId);
    this.message = parentId === undefined ? `Moved #${id} to the top level` : `Moved #${id} under #${parentId}`;
    await this.refresh(id);
  }
  editSelectedTask() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined)
      return;
    this.mode = "editing";
    this.draft = selectedTask.description;
    this.message = "";
  }
  async saveEditedTask() {
    const description = this.draft.trim();
    const selectedTask = this.selectedTask;
    if (description.length === 0) {
      this.message = "Enter a task description";
      return;
    }
    if (selectedTask === undefined)
      return;
    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined)
      return;
    task.description = description;
    task.updatedAt = Date.now();
    await this.store.saveTasks(tasks);
    this.mode = "normal";
    this.draft = "";
    this.message = `Updated #${task.id}`;
    await this.refresh(task.id);
  }
  snoozeSelectedTask() {
    if (this.selectedTask === undefined || this.view === "archive")
      return;
    this.mode = "snoozing";
    this.draft = "";
    this.message = "";
  }
  async saveSnoozedTask() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined)
      return;
    const dueDate = tryParseDueDate(this.draft);
    if (dueDate === undefined) {
      this.message = "Use 30m, 1h, tomorrow, monday, next week, or 16/08/2026";
      return;
    }
    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined)
      return;
    if (dueDate === undefined)
      delete task.dueDate;
    else
      task.dueDate = dueDate;
    task.updatedAt = Date.now();
    resetNotificationState(task);
    await this.store.saveTasks(tasks);
    this.mode = "normal";
    this.draft = "";
    this.message = `Snoozed #${task.id}`;
    await this.refresh(task.id);
  }
  setDueDate() {
    if (this.selectedTask === undefined || this.view === "archive")
      return;
    this.mode = "setting-due";
    this.draft = "";
    this.message = "";
  }
  async saveDueDate() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined)
      return;
    const value = this.draft.trim().toLowerCase();
    const dueDate = value === "0" || value === "none" ? undefined : tryParseDueDate(value);
    if (value.length === 0 || dueDate === undefined && value !== "0" && value !== "none") {
      this.message = "Use 30m, 1h, tomorrow, 16/08/2026, two weeks ago, or none";
      return;
    }
    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined)
      return;
    if (dueDate === undefined)
      delete task.dueDate;
    else
      task.dueDate = dueDate;
    task.updatedAt = Date.now();
    resetNotificationState(task);
    await this.store.saveTasks(tasks);
    this.mode = "normal";
    this.draft = "";
    this.message = dueDate === undefined ? `Cleared due date for #${task.id}` : `Updated due date for #${task.id}`;
    await this.refresh(task.id);
  }
  async cyclePriority() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined || this.view === "archive")
      return;
    const priorities = ["none", "low", "medium", "high"];
    const priority = priorities[(priorities.indexOf(selectedTask.priority) + 1) % priorities.length];
    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined || priority === undefined)
      return;
    task.priority = priority;
    task.updatedAt = Date.now();
    await this.store.saveTasks(tasks);
    this.message = `Priority #${task.id}: ${priority}`;
    await this.refresh(task.id);
  }
  toggleTaskSelection() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined || this.view === "archive")
      return;
    if (this.selectedTaskIds.has(selectedTask.id))
      this.selectedTaskIds.delete(selectedTask.id);
    else
      this.selectedTaskIds.add(selectedTask.id);
    this.message = `${this.selectedTaskIds.size} selected`;
  }
  async completeSelectedTasks() {
    if (this.view === "archive")
      return;
    const selectedTask = this.selectedTask;
    const ids = this.selectedTaskIds.size > 0 ? this.selectedTaskIds : new Set(selectedTask === undefined ? [] : [selectedTask.id]);
    if (ids.size === 0)
      return;
    const tasks = await this.store.loadTasks();
    const completed = completeSubtrees(tasks, ids);
    await this.store.saveTasks(tasks);
    this.selectedTaskIds.clear();
    this.message = `Completed ${completed} task${completed === 1 ? "" : "s"}`;
    await this.refresh();
  }
  async undoDelete() {
    const undo = await this.store.loadUndo();
    if (undo === undefined || undo.tasks.length === 0) {
      this.message = "Nothing to undo";
      return;
    }
    const tasks = await this.store.loadTasks();
    const restoredTasks = restoreTasks(tasks, undo.tasks);
    await this.store.saveTasks([...tasks, ...restoredTasks]);
    await this.store.forgetRemovedBatch(undo.timestamp);
    await this.store.clearUndo();
    this.message = `Restored ${restoredTasks.length} task${restoredTasks.length === 1 ? "" : "s"}`;
    await this.refresh(restoredTasks[0]?.id);
  }
  async processDeleteKeypress(key) {
    if (key.sequence?.toLowerCase() === "y") {
      await this.deleteSelectedTask();
    } else if (key.sequence?.toLowerCase() === "n" || key.name === "escape") {
      this.mode = "normal";
      this.message = "Delete cancelled";
    }
    this.draw();
  }
  async addDraft() {
    const input = this.draft.trim();
    if (input.length === 0) {
      this.message = "Enter a task description";
      return;
    }
    try {
      const defaults = this.addDefaults();
      const addedTasks = await createTasks(this.store, input.split(/\s+/), defaults);
      this.mode = "normal";
      this.draft = "";
      if (defaults.parentId !== undefined)
        this.collapsedIds.delete(defaults.parentId);
      const noun = defaults.kind === "epic" ? "epic" : defaults.parentId === undefined ? "task" : "subtask";
      this.message = `Added ${addedTasks.length} ${noun}${addedTasks.length === 1 ? "" : "s"}`;
      await this.refresh(addedTasks[0]?.id);
    } catch (error) {
      this.message = error instanceof UserInputError ? error.message : "Could not add task";
    }
  }
  addDefaults() {
    if (this.mode === "adding-epic")
      return { kind: "epic" };
    if (this.mode === "adding-subtask" && this.selectedTask !== undefined)
      return { parentId: this.selectedTask.id };
    return {};
  }
  async completeSelectedTask() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined)
      return;
    const tasks = await this.store.loadTasks();
    const task = tasks.find((item) => item.id === selectedTask.id);
    if (task === undefined)
      return;
    if (this.view === "archive") {
      task.status = "pending";
      task.updatedAt = Date.now();
      this.message = `Restored #${task.id}`;
    } else {
      const completed = completeSubtrees(tasks, [task.id]);
      this.message = completed > 1 ? `Completed #${task.id} and ${completed - 1} subtask${completed === 2 ? "" : "s"}` : `Completed #${task.id}`;
    }
    await this.store.saveTasks(tasks);
    await this.refresh();
  }
  async deleteSelectedTask() {
    const selectedTask = this.selectedTask;
    if (selectedTask === undefined)
      return;
    const tasks = await this.store.loadTasks();
    const subtreeIds = collectSubtreeIds(tasks, [selectedTask.id]);
    await this.store.saveUndo(tasks.filter((task) => subtreeIds.has(task.id)));
    await this.store.saveTasks(tasks.filter((task) => !subtreeIds.has(task.id)));
    this.mode = "normal";
    const subtaskText = subtreeIds.size > 1 ? ` and ${subtreeIds.size - 1} subtask${subtreeIds.size === 2 ? "" : "s"}` : "";
    this.message = `Deleted #${selectedTask.id}${subtaskText} \xB7 u/Ctrl+Z to undo (5s)`;
    await this.refresh();
  }
  subtaskCountOf(id) {
    return collectDescendantIds(this.allTasks, [id]).size;
  }
  async refresh(selectedId) {
    this.allTasks = await this.store.loadTasks();
    this.sourceTasks = filterWorkspaceTasks(this.allTasks, this.workspace.key);
    this.applySearch();
    if (selectedId !== undefined)
      this.selectRow(selectedId);
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.rows.length - 1));
    this.scrollOffset = Math.min(this.scrollOffset, Math.max(0, this.rows.length - VISIBLE_TASK_COUNT));
    this.ensureSelectedTaskIsVisible();
  }
  applySearch() {
    const query = this.searchQuery.trim().toLowerCase();
    this.tasks = query.length === 0 ? [...this.sourceTasks] : this.sourceTasks.filter((task) => task.description.toLowerCase().includes(query));
    this.rebuildRows();
  }
  rebuildRows(selectedId) {
    this.rows = buildTaskTreeRows(this.tasks, this.allTasks, { compare: compareTasks2, collapsedIds: this.collapsedIds });
    if (selectedId !== undefined)
      this.selectRow(selectedId);
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.rows.length - 1));
    this.ensureSelectedTaskIsVisible();
  }
  selectRow(id) {
    const matchingIndex = this.rows.findIndex((row) => row.task.id === id);
    if (matchingIndex !== -1)
      this.selectedIndex = matchingIndex;
  }
  async toggleView() {
    const wasArchive = this.workspace.key === "archive";
    this.workspaceIndex = wasArchive ? 0 : WORKSPACES.findIndex((workspace) => workspace.key === "archive");
    this.view = wasArchive ? "pending" : "archive";
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.message = this.view === "archive" ? "Archive" : "Open tasks";
    await this.refresh();
  }
  moveSelection(offset) {
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex + offset, this.rows.length - 1));
    this.ensureSelectedTaskIsVisible();
  }
  async moveWorkspace(offset) {
    const workspace = WORKSPACES.length;
    this.workspaceIndex = (this.workspaceIndex + offset + workspace) % workspace;
    this.view = this.workspace.key === "archive" ? "archive" : "pending";
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.selectedTaskIds.clear();
    await this.refresh();
  }
  get workspace() {
    return WORKSPACES[this.workspaceIndex] ?? WORKSPACES[0];
  }
  ensureSelectedTaskIsVisible() {
    if (this.selectedIndex < this.scrollOffset)
      this.scrollOffset = this.selectedIndex;
    if (this.selectedIndex >= this.scrollOffset + VISIBLE_TASK_COUNT) {
      this.scrollOffset = this.selectedIndex - VISIBLE_TASK_COUNT + 1;
    }
  }
  get selectedRow() {
    return this.rows[this.selectedIndex];
  }
  get selectedTask() {
    return this.selectedRow?.task;
  }
  draw() {
    process.stdout.write(`\x1B[2J\x1B[H${this.render()}`);
  }
  render() {
    if ((process.stdout.columns ?? 0) >= 100)
      return this.renderWorkspaceLayout();
    const lines = this.mode === "help" ? this.helpLines() : this.taskLines();
    const output = [formatPanelBorder2("\u256D", "\u256E")];
    const status = this.view === "pending" ? `${this.tasks.length} open` : `${this.tasks.length} done`;
    const dueTodayCount = this.tasks.filter((task) => task.dueDate !== undefined && isToday(task.dueDate)).length;
    const dueToday = this.view === "pending" && dueTodayCount > 0 ? `${DIM9} \xB7 ${dueTodayCount} due today${RESET10}` : "";
    const title = this.view === "archive" ? `${BRIGHT}${MAUVE2}todo${RESET10} ${DIM9}\xB7 archive${RESET10}` : `${BRIGHT}${MAUVE2}todo${RESET10}`;
    output.push(formatPanelLine2(title, `${GREEN7}\u25CF ${status}${RESET10}${dueToday}`));
    output.push(formatPanelBorder2("\u251C", "\u2524"));
    for (const line of lines)
      output.push(formatPanelLine2(line));
    output.push(formatPanelBorder2("\u251C", "\u2524"));
    output.push(formatPanelLine2(this.footerLeft, this.footerRight));
    output.push(formatPanelBorder2("\u2570", "\u256F"));
    return `${output.join(`
`)}
`;
  }
  renderWorkspaceLayout() {
    const width = Math.min(Math.max(process.stdout.columns ?? 110, 100), 140);
    const sidebarWidth = 22;
    const taskWidth = width - sidebarWidth - 7;
    const bodyHeight = Math.max(12, Math.min((process.stdout.rows ?? 24) - 6, 22));
    const workspaceLines = this.workspaceLines(sidebarWidth);
    const taskLines = this.workspaceTaskLines(taskWidth);
    const output = [formatSplitBorder("\u256D", "\u252C", "\u256E", sidebarWidth, taskWidth, "Workspaces", this.view === "archive" ? "Archive" : "Todos")];
    for (let index = 0;index < bodyHeight; index += 1) {
      const left = workspaceLines[index] ?? "";
      const right = taskLines[index] ?? "";
      output.push(formatSplitLine(left, right, sidebarWidth, taskWidth));
    }
    output.push(formatSplitBorder("\u251C", "\u2534", "\u2524", sidebarWidth, taskWidth));
    output.push(formatStatusLine(this.footerLeft, this.footerRight, width - 2));
    output.push(`${DIM9}\u2570${"\u2500".repeat(width - 2)}\u256F${RESET10}`);
    return `${output.join(`
`)}
`;
  }
  workspaceLines(width) {
    return WORKSPACES.map((workspace, index) => {
      const count = filterWorkspaceTasks(this.allTasks, workspace.key).length;
      const selected = this.focus === "workspaces" && index === this.workspaceIndex;
      const marker = index === this.workspaceIndex ? `${GREEN7}\u203A${RESET10}` : " ";
      const content = `${marker} ${workspace.label} ${DIM9}(${count})${RESET10}`;
      return selected ? `${SELECTED2}${fit(content, width)}${RESET10}` : content;
    });
  }
  workspaceTaskLines(width) {
    if (this.mode === "help")
      return this.helpLines();
    if (ADD_MODES.has(this.mode))
      return this.addPromptLines();
    if (this.mode === "editing")
      return [`${GREEN7}edit #${this.selectedTask?.id ?? ""}${RESET10}`, `${DIM9}>${RESET10} ${this.draft}${BRIGHT}\u258F${RESET10}`, `${DIM9}Enter to save \xB7 Esc to cancel${RESET10}`];
    if (this.mode === "snoozing")
      return [`${GREEN7}snooze #${this.selectedTask?.id ?? ""}${RESET10}`, `${DIM9}>${RESET10} ${this.draft}${BRIGHT}\u258F${RESET10}`, `${DIM9}30m \xB7 1h \xB7 tomorrow \xB7 monday \xB7 next week${RESET10}`];
    if (this.mode === "setting-due")
      return [`${GREEN7}due date #${this.selectedTask?.id ?? ""}${RESET10}`, `${DIM9}>${RESET10} ${this.draft}${BRIGHT}\u258F${RESET10}`, `${DIM9}30m \xB7 1h \xB7 tomorrow \xB7 monday \xB7 next week \xB7 none${RESET10}`];
    if (this.mode === "searching")
      return [`${GREEN7}search${RESET10}`, `${DIM9}/${RESET10} ${this.searchQuery}${BRIGHT}\u258F${RESET10}`, `${DIM9}Enter to keep filter \xB7 Esc to clear${RESET10}`];
    if (this.mode === "confirming-delete")
      return this.deletePromptLines();
    if (this.rows.length === 0)
      return [`${GREEN7}\u2713 All caught up${RESET10}`, `${DIM9}Press a to add a task \xB7 E for an epic${RESET10}`];
    const header = `${DIM9}PRI  ID    TITLE${" ".repeat(Math.max(1, width - 53))}CREATED       UPDATED       DUE${RESET10}`;
    const rows = this.rows.slice(this.scrollOffset, this.scrollOffset + VISIBLE_TASK_COUNT).map((row, index) => {
      const selected = this.scrollOffset + index === this.selectedIndex;
      const marked = this.selectedTaskIds.has(row.task.id);
      const marker = selected ? `${GREEN7}\u203A${RESET10}` : marked ? `${GREEN7}\u2713${RESET10}` : `${DIM9}\xB7${RESET10}`;
      const content = `${marker} ${formatWorkspaceTask(row, width - 2)}`;
      return selected && this.focus === "tasks" ? highlight(fit(content, width)) : content;
    });
    return [header, ...rows];
  }
  taskLines() {
    if (ADD_MODES.has(this.mode))
      return this.addPromptLines();
    if (this.mode === "editing")
      return [`${GREEN7}edit #${this.selectedTask?.id ?? ""}${RESET10}`, `${DIM9}>${RESET10} ${this.draft}${BRIGHT}\u258F${RESET10}`, `${DIM9}Enter to save \xB7 Esc to cancel${RESET10}`];
    if (this.mode === "snoozing")
      return [`${GREEN7}snooze #${this.selectedTask?.id ?? ""}${RESET10}`, `${DIM9}>${RESET10} ${this.draft}${BRIGHT}\u258F${RESET10}`, `${DIM9}30m \xB7 1h \xB7 tomorrow \xB7 monday \xB7 next week${RESET10}`];
    if (this.mode === "setting-due")
      return [`${GREEN7}due date #${this.selectedTask?.id ?? ""}${RESET10}`, `${DIM9}>${RESET10} ${this.draft}${BRIGHT}\u258F${RESET10}`, `${DIM9}30m \xB7 1h \xB7 tomorrow \xB7 monday \xB7 next week \xB7 none${RESET10}`];
    if (this.mode === "searching")
      return [`${GREEN7}search${RESET10}`, `${DIM9}/${RESET10} ${this.searchQuery}${BRIGHT}\u258F${RESET10}`, `${DIM9}Enter to keep filter \xB7 Esc to clear${RESET10}`];
    if (this.mode === "confirming-delete")
      return this.deletePromptLines();
    if (this.rows.length === 0) {
      const emptyAction = this.view === "pending" ? "Press a to add a task \xB7 E for an epic" : "Press v to return to open tasks";
      return [`${GREEN7}\u2713 All caught up${RESET10}`, `${DIM9}${emptyAction}${RESET10}`];
    }
    const header = formatCompactHeader(PANEL_WIDTH2 - 3);
    const visibleRows = this.rows.slice(this.scrollOffset, this.scrollOffset + VISIBLE_TASK_COUNT);
    const rows = visibleRows.map((row, index) => {
      const selected = this.scrollOffset + index === this.selectedIndex;
      const marked = this.selectedTaskIds.has(row.task.id);
      const marker = selected ? `${GREEN7}\u203A${RESET10}` : marked ? `${GREEN7}\u2713${RESET10}` : `${DIM9}\xB7${RESET10}`;
      const content = `${marker} ${formatCompactTask(row, PANEL_WIDTH2 - 3)}`;
      return selected ? highlight(fit(content, PANEL_WIDTH2 - 1)) : content;
    });
    return [header, ...rows];
  }
  addPromptLines() {
    const title = this.mode === "adding-epic" ? "new epic" : this.mode === "adding-subtask" ? `new subtask under #${this.selectedTask?.id ?? ""}` : "new task";
    return [`${GREEN7}${title}${RESET10}`, `${DIM9}>${RESET10} ${this.draft}${BRIGHT}\u258F${RESET10}`, `${DIM9}Enter to save \xB7 comma separates several \xB7 Esc to cancel${RESET10}`];
  }
  deletePromptLines() {
    const id = this.selectedTask?.id ?? "";
    const subtaskCount = id.length > 0 ? this.subtaskCountOf(id) : 0;
    const subtaskText = subtaskCount > 0 ? ` and ${subtaskCount} subtask${subtaskCount === 1 ? "" : "s"}` : "";
    return [`${RED3}Delete #${id}${subtaskText}?${RESET10}`, `${DIM9}Press y to delete \xB7 n or Esc to cancel${RESET10}`];
  }
  helpLines() {
    return [
      `${GREEN7}\u2191/k  \u2193/j${RESET10}  move selection`,
      `${GREEN7}\u2190/h  \u2192/l${RESET10}  collapse or expand \xB7 jump to parent/child`,
      `${GREEN7}Enter${RESET10}  complete selected task (and its subtasks)`,
      `${GREEN7}a${RESET10}  add task    ${GREEN7}A${RESET10}  add subtask under selected    ${GREEN7}E${RESET10}  add epic`,
      `${GREEN7}>${RESET10}  nest under the task above    ${GREEN7}<${RESET10}  move up one level`,
      `${GREEN7}e${RESET10}  edit selected task`,
      `${GREEN7}d${RESET10}  delete selected task and its subtasks`,
      `${GREEN7}u / Ctrl+Z${RESET10}  undo last deletion (within 5s)`,
      `${GREEN7}s${RESET10}  snooze selected task`,
      `${GREEN7}p${RESET10}  cycle priority`,
      `${GREEN7}t${RESET10}  set or clear due date`,
      `${GREEN7}x${RESET10}  mark task for batch completion`,
      `${GREEN7}c${RESET10}  complete marked task(s)`,
      `${GREEN7}/${RESET10}  search current view`,
      `${GREEN7}v${RESET10}  toggle completed archive`,
      `${GREEN7}Enter${RESET10}  restore selected task in archive`,
      `${GREEN7}r${RESET10}  refresh`,
      `${GREEN7}q${RESET10}  quit`,
      `${DIM9}Press Esc, Enter, ? or q to return${RESET10}`
    ];
  }
  get footerLeft() {
    if (this.mode === "help")
      return `${DIM9}?${RESET10} help`;
    const action = this.view === "pending" ? "complete" : "restore";
    const position = this.tasks.length > 0 ? `${this.selectedIndex + 1}/${this.tasks.length} \xB7 ` : "";
    return this.message.length > 0 ? `${GREEN7}${this.message}${RESET10}` : `${DIM9}${position}\u2191\u2193${RESET10} navigate \xB7 ${DIM9}Enter${RESET10} ${action}`;
  }
  get footerRight() {
    if (this.mode === "help")
      return `${DIM9}q${RESET10} close`;
    return `${DIM9}A${RESET10} sub \xB7 ${DIM9}E${RESET10} epic \xB7 ${DIM9}?${RESET10} help \xB7 ${DIM9}q${RESET10} quit`;
  }
  close() {
    process.stdin.off("keypress", this.handleKeypress);
    if (!this.wasRaw)
      process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write(`\x1B[?25h
`);
    this.resolveClose?.();
  }
}
function compareTasks2(left, right) {
  if (left.dueDate !== undefined && right.dueDate !== undefined)
    return left.dueDate - right.dueDate;
  if (left.dueDate !== undefined)
    return -1;
  if (right.dueDate !== undefined)
    return 1;
  return left.createdAt - right.createdAt;
}
function formatPanelLine2(left, right = "") {
  const padding = " ".repeat(Math.max(1, PANEL_WIDTH2 - getVisibleLength(left) - getVisibleLength(right)));
  return `${DIM9}\u2502${RESET10} ${left}${padding}${right} ${DIM9}\u2502${RESET10}`;
}
function formatPanelBorder2(left, right) {
  return `${DIM9}${left}${"\u2500".repeat(PANEL_WIDTH2 + 2)}${right}${RESET10}`;
}
function filterWorkspaceTasks(tasks, workspace) {
  if (workspace === "archive")
    return tasks.filter((task) => task.status === "completed");
  const pendingTasks = tasks.filter((task) => task.status === "pending");
  if (workspace === "today")
    return pendingTasks.filter((task) => task.dueDate !== undefined && isToday(task.dueDate));
  if (workspace === "overdue")
    return pendingTasks.filter((task) => task.dueDate !== undefined && isOverdue(task.dueDate));
  if (workspace === "high")
    return pendingTasks.filter((task) => task.priority === "high");
  return pendingTasks;
}
function isToday(timestamp) {
  const now = new Date;
  const date = new Date(timestamp);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}
function formatTreeLabel(row, width) {
  const prefix = formatTreePrefix(row);
  const toggle = row.hasChildren ? row.collapsed ? `${MAUVE2}\u25B8${RESET10} ` : `${DIM9}\u25BE${RESET10} ` : "";
  const badge = formatProgressBadge(row);
  const descriptionWidth = Math.max(8, width - getVisibleLength(prefix) - getVisibleLength(toggle) - getVisibleLength(badge));
  const description = truncateTaskDescription(row.task.description, descriptionWidth);
  const emphasized = row.hasChildren || row.task.kind === "epic" ? `${BRIGHT}${description}${RESET10}` : description;
  return `${prefix}${toggle}${emphasized}${badge}`;
}
function formatWorkspaceTask(row, width) {
  const task = row.task;
  const priority = task.priority === "high" ? `${RED3}high${RESET10}` : task.priority === "medium" ? `${MAUVE2}med${RESET10}` : task.priority === "low" ? `${BLUE}low${RESET10}` : `${DIM9}\u2014${RESET10}`;
  const id = `${DIM9}#${task.id.padStart(2, "0")}${RESET10}`;
  const createdAt = formatTaskDate(task.createdAt);
  const updatedAt = formatTaskDate(task.updatedAt);
  const due = formatDueLabel(task);
  const metadataWidth = getVisibleLength(priority) + getVisibleLength(id) + getVisibleLength(createdAt) + getVisibleLength(updatedAt) + getVisibleLength(due) + 12;
  const descriptionWidth = Math.max(12, width - metadataWidth);
  const description = formatTreeLabel(row, descriptionWidth);
  const content = `${fit(priority, 4)} ${id}  ${description}`;
  const padding = " ".repeat(Math.max(1, width - getVisibleLength(content) - getVisibleLength(createdAt) - getVisibleLength(updatedAt) - getVisibleLength(due) - 6));
  return `${content}${padding}${createdAt}  ${updatedAt}  ${due}`;
}
function formatCompactTask(row, width) {
  const task = row.task;
  const id = `${DIM9}#${task.id.padStart(2, "0")}${RESET10}`;
  const updatedAt = `${DIM9}${formatRelativeTime(task.updatedAt)}${RESET10}`;
  const due = formatDueLabel(task);
  const fixedWidth = 4 + 2 + 9 + 2 + 12;
  const description = formatTreeLabel(row, Math.max(12, width - fixedWidth));
  return `${fit(id, 4)}  ${fit(description, Math.max(12, width - fixedWidth))}  ${fit(updatedAt, 9)}  ${fit(due, 12)}`;
}
function formatCompactHeader(width) {
  const fixedWidth = 4 + 2 + 9 + 2 + 12;
  const descriptionWidth = Math.max(12, width - fixedWidth);
  return `${DIM9}  ${fit("ID", 4)}  ${fit("TASK", descriptionWidth)}  ${fit("UPDATED", 9)}  ${fit("DUE", 12)}${RESET10}`;
}
function formatDueLabel(task) {
  if (task.dueDate === undefined)
    return `${DIM9}\u2014${RESET10}`;
  if (isOverdue(task.dueDate))
    return `${RED3}overdue${RESET10}`;
  if (isUpcoming(task.dueDate))
    return `${MAUVE2}soon${RESET10}`;
  const date = new Date(task.dueDate);
  const label = isToday(task.dueDate) ? `today ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}` : formatTaskDate(task.dueDate);
  return `${DIM9}${label}${RESET10}`;
}
function formatTaskDate(timestamp) {
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleString(undefined, { month: "short" });
  const time = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  return `${DIM9}${day} ${month} ${time}${RESET10}`;
}
function formatRelativeTime(timestamp, now = Date.now()) {
  const elapsedMinutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (elapsedMinutes < 1)
    return "now";
  if (elapsedMinutes < 60)
    return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24)
    return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays < 7 ? `${elapsedDays}d ago` : formatTaskDate(timestamp);
}
function truncateTaskDescription(value, width) {
  return value.length > width ? `${value.slice(0, Math.max(1, width - 3))}...` : value;
}
function fit(value, width) {
  return `${value}${" ".repeat(Math.max(0, width - getVisibleLength(value)))}`;
}
function highlight(value) {
  return `${SELECTED2}${value.replaceAll(RESET10, `${RESET10}${SELECTED2}`)}${RESET10}`;
}
function formatSplitLine(left, right, leftWidth, rightWidth) {
  return `${DIM9}\u2502${RESET10} ${fit(left, leftWidth)} ${DIM9}\u2502${RESET10} ${fit(right, rightWidth)} ${DIM9}\u2502${RESET10}`;
}
function formatSplitBorder(left, middle, right, leftWidth, rightWidth, leftTitle, rightTitle) {
  const leftSegment = formatBorderSegment(leftWidth + 2, leftTitle);
  const rightSegment = formatBorderSegment(rightWidth + 2, rightTitle);
  return `${DIM9}${left}${leftSegment}${middle}${rightSegment}${right}${RESET10}`;
}
function formatBorderSegment(width, title) {
  if (title === undefined)
    return "\u2500".repeat(width);
  return `\u2500 ${title} ${"\u2500".repeat(Math.max(0, width - title.length - 3))}`;
}
function formatStatusLine(left, right, width) {
  const status = `${BRIGHT}${MAUVE2}\u25CF NORMAL${RESET10}`;
  const date = `${DIM9}${new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short" }).format()}${RESET10}`;
  const content = `${status}  ${left}`;
  const padding = " ".repeat(Math.max(1, width - getVisibleLength(content) - getVisibleLength(right) - getVisibleLength(date)));
  return `${DIM9}\u2502${RESET10} ${content}${padding}${right}  ${date} ${DIM9}\u2502${RESET10}`;
}

// src/plugins/lifecycle.ts
var DIM10 = "\x1B[2m";
var GREEN8 = "\x1B[32m";
var RESET11 = "\x1B[0m";
var doneCommand = {
  name: "done",
  summary: "Complete a task and everything under it.",
  group: "Change",
  args: [{ name: "id", kind: "pending-task-id", description: "Task to complete" }],
  details: ["Completed tasks leave the list and show up in `todo archive`."],
  examples: [{ command: "todo done 1" }, { command: "todo done #12" }],
  async run(input, { store, stdout }) {
    const id = input.arg("id");
    const tasks = await store.loadTasks();
    const task = tasks.find((candidate) => candidate.id === id);
    if (task === undefined)
      throw new UserInputError(`Task not found: ${id}`);
    const descendantIds = collectDescendantIds(tasks, [id]);
    const pendingSubtaskCount = tasks.filter((candidate) => descendantIds.has(candidate.id) && candidate.status === "pending").length;
    if (task.status === "completed" && pendingSubtaskCount === 0) {
      stdout.write(`${DIM10}Task already completed${RESET11}
`);
      return;
    }
    completeSubtrees(tasks, [id]);
    await store.saveTasks(tasks);
    const subtaskText = pendingSubtaskCount > 0 ? ` with ${pendingSubtaskCount} subtask(s)` : "";
    stdout.write(`${GREEN8}Task marked as completed${subtaskText}${RESET11}
`);
  }
};
var editCommand = {
  name: "edit",
  summary: "Replace a task description.",
  group: "Change",
  args: [
    { name: "id", kind: "task-id", description: "Task to edit" },
    { name: "description", kind: "text", variadic: true, description: "The new description" }
  ],
  details: ["Only the text changes. Due date, priority, subtasks and boards stay as they are."],
  examples: [{ command: "todo edit 1 buy oat milk" }, { command: "todo edit 7 -- -v flag is broken", note: "text that starts with a dash" }],
  async run(input, { store, stdout }) {
    const id = input.arg("id");
    const description = input.args("description").join(" ").trim();
    if (description.length === 0)
      throw new UserInputError("Usage: todo edit <id> <description\u2026>");
    const tasks = await store.loadTasks();
    const task = tasks.find((candidate) => candidate.id === id);
    if (task === undefined)
      throw new UserInputError(`Task not found: ${id}`);
    task.description = description;
    task.updatedAt = Date.now();
    await store.saveTasks(tasks);
    stdout.write(`${GREEN8}Updated task ${task.id}${RESET11}
`);
  }
};
var hideCommand = {
  name: "hide",
  summary: "Hide a task or epic from the shell panel and list.",
  group: "Change",
  args: [{ name: "task", kind: "task-selector", variadic: true, description: "Task ID, or the exact name of a pending task or epic" }],
  details: [
    "Only recognised as the first word: `todo fix hide button` still adds a task.",
    "A numeric target is a task ID; anything else must match a pending description exactly.",
    "Hidden tasks stay pending and keep their subtasks; `todo list --all` and `todo unhide` bring them back.",
    "Hiding is separate from boards: a hidden task stays out of every default view."
  ],
  examples: [
    { command: "todo hide 33" },
    { command: "todo hide my-epic" },
    { command: 'todo hide "Website redesign"', note: "quote names with spaces" }
  ],
  run: (input, context) => setHidden(input, context, true)
};
var unhideCommand = {
  name: "unhide",
  summary: "Show a hidden task or epic again.",
  group: "Change",
  args: [{ name: "task", kind: "task-selector", variadic: true, description: "Task ID, or the exact name of a hidden task or epic" }],
  examples: [{ command: "todo unhide 33" }, { command: "todo unhide my-epic" }],
  run: (input, context) => setHidden(input, context, false)
};
async function setHidden(input, { store, stdout }, hidden) {
  const target = input.args("task").join(" ").trim();
  const tasks = await store.loadTasks();
  const task = findTaskByIdOrDescription(tasks, target);
  if (task.hidden === true === hidden) {
    stdout.write(`${DIM10}Task #${task.id} is already ${hidden ? "hidden" : "visible"}${RESET11}
`);
    return;
  }
  if (hidden)
    task.hidden = true;
  else
    delete task.hidden;
  task.updatedAt = Date.now();
  await store.saveTasks(tasks);
  stdout.write(`${GREEN8}${hidden ? "Hid" : "Unhid"} #${task.id}: ${task.description}${RESET11}
`);
}
var lifecycleCommands = [doneCommand, editCommand, hideCommand, unhideCommand];

// src/plugins/remove.ts
var DIM11 = "\x1B[2m";
var GREEN9 = "\x1B[32m";
var RESET12 = "\x1B[0m";
var rmCommand = {
  name: "rm",
  aliases: ["delete"],
  summary: "Remove tasks and their subtasks.",
  group: "Remove",
  args: [{ name: "ids", kind: "task-ids", variadic: true, description: "IDs, comma lists, or inclusive ranges like 10-15" }],
  subcommands: [
    {
      name: "all",
      summary: "Remove every pending task.",
      details: ["Removed tasks move to the archive. `todo undo` brings them back."],
      examples: [{ command: "todo rm all" }, { command: "todo undo", note: "bring them all back" }],
      async run(_input, { store, stdout }) {
        await removeAllPendingTasks(store, stdout);
      }
    }
  ],
  details: [
    "Nothing is deleted: removed tasks move to the archive (`todo archive --removed`). `todo undo` restores the last removal; `todo archive restore r<n>` any older one.",
    "Removed tasks also leave every board."
  ],
  examples: [
    { command: "todo rm 4", note: "one task and everything nested under it" },
    { command: "todo rm 1 2 3 4", note: "several IDs separated by spaces" },
    { command: "todo rm 1,5,9,10-15", note: "IDs and inclusive ranges" },
    { command: "todo rm all", note: "every pending task" }
  ],
  async run(input, { store, stdout }) {
    const ids = parseTaskIds(input.args("ids").join(","));
    const tasks = await store.loadTasks();
    const requestedIds = tasks.filter((task) => ids.has(task.id)).map((task) => task.id);
    if (requestedIds.length === 0) {
      throw new UserInputError(`No tasks found with ID(s): ${[...ids].join(", ")}`);
    }
    const matchingIds = collectSubtreeIds(tasks, requestedIds);
    await store.saveUndo(tasks.filter((task) => matchingIds.has(task.id)));
    await store.saveTasks(tasks.filter((task) => !matchingIds.has(task.id)));
    await purgeFromBoards(store, matchingIds);
    const subtaskCount = matchingIds.size - requestedIds.length;
    const subtaskText = subtaskCount > 0 ? ` including ${subtaskCount} subtask(s)` : "";
    stdout.write(`${GREEN9}Deleted ${matchingIds.size} task(s)${subtaskText}${RESET12} ${DIM11}\xB7 archived, restore with todo undo or todo archive -i${RESET12}
`);
  }
};
async function removeAllPendingTasks(store, stdout) {
  const tasks = await store.loadTasks();
  const pendingTasks = tasks.filter((task) => task.status === "pending");
  if (pendingTasks.length === 0) {
    stdout.write(`${DIM11}No tasks to delete${RESET12}
`);
    return;
  }
  await store.saveUndo(pendingTasks);
  await store.saveTasks(tasks.filter((task) => task.status !== "pending"));
  await purgeFromBoards(store, new Set(pendingTasks.map((task) => task.id)));
  stdout.write(`${GREEN9}Deleted ${pendingTasks.length} task(s)${RESET12} ${DIM11}\xB7 archived, restore with todo undo or todo archive -i${RESET12}
`);
}
async function purgeFromBoards(store, ids) {
  const state = await store.loadBoardsFile();
  if (state === undefined)
    return;
  await store.saveBoards(purgeTaskIds(state, ids));
}
function parseTaskIds(value) {
  const ids = new Set;
  for (const part of value.split(",").map((item) => item.trim().replace(/^#/, ""))) {
    if (part.length === 0)
      throw new UserInputError(`Invalid task ID list: ${value}`);
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > end || end - start > 1e4)
        throw new UserInputError(`Invalid task ID range: ${part}`);
      for (let id = start;id <= end; id += 1)
        ids.add(`${id}`);
      continue;
    }
    if (!/^\d+$/.test(part))
      throw new UserInputError(`Invalid task ID: ${part}`);
    ids.add(part);
  }
  return ids;
}

// src/plugins/typos.ts
var DIM12 = "\x1B[2m";
var GREEN10 = "\x1B[32m";
var RESET13 = "\x1B[0m";
var typosCommand = {
  name: "typos",
  summary: "Review or forget learned typo corrections.",
  group: "Settings",
  details: [
    'A mistyped command, subcommand, option, value or board name with one close match prompts "did you mean".',
    `Accepting the same correction ${AUTO_CORRECT_THRESHOLD} times makes it run automatically, with a notice each time.`,
    "Declining the same correction twice stops the prompt for that word. Without a terminal the suggestion is printed and the command fails.",
    "Turn everything off with `todo config autocorrect off`."
  ],
  examples: [{ command: "todo typos" }, { command: "todo typos forget dne" }],
  subcommands: [
    {
      name: "forget",
      summary: "Forget what was learned for one typo.",
      args: [{ name: "typo", kind: "text", description: "The mistyped word as shown by todo typos" }],
      examples: [{ command: "todo typos forget borad" }],
      async run(input, { store, stdout }) {
        const target = input.arg("typo");
        const memory = await store.loadTypoMemory();
        if (memory[target] === undefined)
          throw new UserInputError(`Nothing learned for: ${target}`);
        await store.saveTypoMemory(forgetTypo(memory, target));
        stdout.write(`${GREEN10}Forgot ${target}${RESET13}
`);
      }
    },
    {
      name: "reset",
      summary: "Forget every learned typo.",
      examples: [{ command: "todo typos reset" }],
      async run(_input, { store, stdout }) {
        await store.saveTypoMemory({});
        stdout.write(`${GREEN10}Forgot all learned typos${RESET13}
`);
      }
    }
  ],
  async run(_input, { store, stdout }) {
    const memory = await store.loadTypoMemory();
    const entries = Object.entries(memory).flatMap(([typo, corrections]) => Object.entries(corrections).map(([correction, record]) => ({ typo, correction, record })));
    if (entries.length === 0) {
      stdout.write(`${DIM12}No learned typos yet. Corrections are learned when you answer a "did you mean" prompt.${RESET13}
`);
      return;
    }
    for (const { typo, correction, record } of entries) {
      const state = isAutoCorrected(record) ? "auto" : isIgnored(record) ? "ignored" : `prompts (${record.accepted}/${AUTO_CORRECT_THRESHOLD} until auto)`;
      stdout.write(`${typo.padEnd(18)} \u2192 ${correction.padEnd(18)} ${DIM12}${state}${RESET13}
`);
    }
  }
};

// src/domain/epic-visibility.ts
function listEpicIds(tasks) {
  return tasks.filter((task) => isEpic(task, tasks)).map((task) => task.id);
}
function resolveEpic(tasks, target) {
  const trimmed = target.trim();
  const numeric = /^#?\d+$/.test(trimmed);
  let task;
  try {
    task = findTaskByIdOrDescription(tasks, trimmed);
  } catch (error) {
    if (!(error instanceof UserInputError))
      throw error;
    throw new UserInputError(numeric ? `Epic #${trimmed.replace(/^#/, "")} not found` : `Epic not found: ${trimmed}`);
  }
  if (!isEpic(task, tasks))
    throw new UserInputError(`Todo #${task.id} is not an epic.`);
  return task;
}
function setEpicVisibility(collapsedIds, ids, action) {
  const next = new Set(collapsedIds);
  for (const id of ids) {
    if (action === "close")
      next.add(id);
    else if (action === "open")
      next.delete(id);
    else if (next.has(id))
      next.delete(id);
    else
      next.add(id);
  }
  return next;
}
function pruneCollapsedIds(collapsedIds, tasks) {
  const epicIds = new Set(listEpicIds(tasks));
  return new Set([...collapsedIds].filter((id) => epicIds.has(id)));
}

// src/plugins/visibility.ts
var GREEN11 = "\x1B[32m";
var RESET14 = "\x1B[0m";
var EPIC_DETAILS = [
  "<epic> is an epic name or an epic ID, with or without the leading #. Quote names with spaces.",
  "Visibility is presentation state only: nothing about the tasks themselves changes."
];
function visibilityCommand(action) {
  const verb = action === "open" ? "Expand" : "Collapse";
  const letter = action === "open" ? "o" : "c";
  return {
    name: action,
    summary: action === "open" ? "Expand an epic so its subtickets render again." : "Collapse an epic into a single subticket-count line.",
    group: "Epic visibility",
    args: [{ name: "epic", kind: "epic-selector", variadic: true, description: "Epic ID or exact epic name" }],
    details: [
      ...EPIC_DETAILS,
      `Idempotent: ${action === "open" ? "opening an already-open" : "closing an already-closed"} epic leaves it that way.`,
      `Shorthand: \`todo -${letter} <epic>\`, \`todo -${letter}a\` for all.`
    ],
    examples: [
      { command: `todo ${action} joram` },
      { command: `todo ${action} #36` },
      { command: `todo ${action} all`, note: `same as todo -${letter}a` }
    ],
    subcommands: [
      {
        name: "all",
        summary: `${verb} every epic.`,
        details: ["Idempotent: epics already in that state stay there. Epics created later still default to open."],
        examples: [{ command: `todo ${action} all` }, { command: `todo -${letter}a`, note: "shorthand" }],
        run: (_input, context) => applyToAll(action, context)
      }
    ],
    run: (input, context) => applyToEpic(action, input, context)
  };
}
async function applyToAll(action, { store, stdout }) {
  const tasks = await store.loadTasks();
  const collapsedIds = pruneCollapsedIds(await store.loadCollapsedEpicIds(), tasks);
  await store.saveCollapsedEpicIds(setEpicVisibility(collapsedIds, listEpicIds(tasks), action));
  stdout.write(`${GREEN11}${action === "open" ? "Opened" : "Closed"} all epics${RESET14}
`);
  await listTasks(store, stdout);
}
async function applyToEpic(action, input, { store, stdout }) {
  const tasks = await store.loadTasks();
  const collapsedIds = pruneCollapsedIds(await store.loadCollapsedEpicIds(), tasks);
  const epic = resolveEpic(tasks, input.args("epic").join(" "));
  const next = setEpicVisibility(collapsedIds, [epic.id], action);
  await store.saveCollapsedEpicIds(next);
  stdout.write(`${GREEN11}${next.has(epic.id) ? "Closed" : "Opened"} epic: ${epic.description}${RESET14}
`);
  await listTasks(store, stdout);
}
var visibilityCommands = [visibilityCommand("open"), visibilityCommand("close")];

// src/plugins/builtins.ts
function createCommandTree() {
  return {
    name: "todo",
    summary: "tasks, epics and boards from the shell",
    subcommands: [
      addCommand,
      ...epicCommands.filter((command) => command.group === "Create"),
      boardCommand,
      focusCommand,
      listCommand,
      panelCommand,
      archiveCommand,
      interactiveCommand,
      ...lifecycleCommands,
      dueCommand,
      ...epicCommands.filter((command) => command.group !== "Create"),
      snoozeCommand,
      ...visibilityCommands,
      rmCommand,
      undoCommand,
      configCommand,
      helpCommand,
      typosCommand,
      completionsCommand
    ]
  };
}

// src/storage/todo-store.ts
import { mkdir as mkdir2, open, readFile, rename, stat, unlink, writeFile as writeFile2 } from "fs/promises";
import { dirname as dirname2, join as join2 } from "path";

// src/domain/normalize-task.ts
function normalizeTasks(value) {
  if (!Array.isArray(value)) {
    throw new Error("Tasks data must be an array");
  }
  return value.map((task, index) => normalizeTask(task, index));
}
function normalizeTask(value, index) {
  if (!isRecord(value)) {
    throw new Error(`Task at index ${index} must be an object`);
  }
  const task = {
    id: readString(value.id, "id", index),
    description: readString(value.description, "description", index),
    status: readStatus(value.status, index),
    priority: readPriority(value.priority),
    createdAt: readNumber(value.createdAt, "createdAt", index),
    updatedAt: readNumber(value.updatedAt, "updatedAt", index),
    reminderOffsets: readNumberArray(value.reminderOffsets),
    notificationsSent: readNotificationState(value.notificationsSent)
  };
  if (typeof value.dueDate === "number" && Number.isFinite(value.dueDate)) {
    task.dueDate = value.dueDate;
  }
  if (typeof value.parentId === "string" && value.parentId.length > 0) {
    task.parentId = value.parentId;
  }
  const kind = readKind(value.kind);
  if (kind !== undefined)
    task.kind = kind;
  if (value.hidden === true)
    task.hidden = true;
  const reminder = readReminder(value.reminder);
  if (reminder !== undefined) {
    task.reminder = reminder;
    task.dueDate = reminder.dueAt;
  }
  return task;
}
function readReminder(value) {
  if (!isRecord(value))
    return;
  if (typeof value.id !== "string" || value.id.length === 0)
    return;
  if (typeof value.dueAt !== "number" || !Number.isFinite(value.dueAt))
    return;
  const reminder = {
    id: value.id,
    dueAt: value.dueAt,
    expression: typeof value.expression === "string" ? value.expression : "",
    createdAt: typeof value.createdAt === "number" && Number.isFinite(value.createdAt) ? value.createdAt : value.dueAt,
    soundMode: readSoundMode(value.soundMode)
  };
  if (typeof value.soundPath === "string" && value.soundPath.length > 0)
    reminder.soundPath = value.soundPath;
  if (typeof value.run === "string" && value.run.length > 0)
    reminder.run = value.run;
  if (typeof value.cwd === "string" && value.cwd.length > 0)
    reminder.cwd = value.cwd;
  if (typeof value.firedAt === "number" && Number.isFinite(value.firedAt))
    reminder.firedAt = value.firedAt;
  if (typeof value.soundError === "string")
    reminder.soundError = value.soundError;
  if (typeof value.runExitCode === "number" && Number.isFinite(value.runExitCode))
    reminder.runExitCode = value.runExitCode;
  if (typeof value.runError === "string")
    reminder.runError = value.runError;
  return reminder;
}
function readSoundMode(value) {
  return value === "none" || value === "custom" ? value : "default";
}
function readStatus(value, index) {
  if (value === "pending" || value === "completed")
    return value;
  throw new Error(`Task at index ${index} has an invalid status`);
}
function readKind(value) {
  return value === "epic" ? "epic" : undefined;
}
function readPriority(value) {
  if (value === "low" || value === "medium" || value === "high")
    return value;
  return "none";
}
function readNotificationState(value) {
  if (!isRecord(value))
    return { reminders: [], overdue: false };
  return {
    reminders: readNumberArray(value.reminders),
    overdue: value.overdue === true
  };
}
function readNumberArray(value) {
  if (!Array.isArray(value))
    return [];
  return value.filter((item) => typeof item === "number" && Number.isFinite(item));
}
function readString(value, field, index) {
  if (typeof value === "string")
    return value;
  throw new Error(`Task at index ${index} has an invalid ${field}`);
}
function readNumber(value, field, index) {
  if (typeof value === "number" && Number.isFinite(value))
    return value;
  throw new Error(`Task at index ${index} has an invalid ${field}`);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/storage/todo-store.ts
function getTodoPaths(dataDir = process.env.DOTFILES_DATA_DIR ?? join2(process.env.HOME ?? ".", ".dotfiles")) {
  const todoDir = join2(dataDir, "todo");
  return {
    dataDir: todoDir,
    tasksFile: join2(todoDir, "tasks.json"),
    configFile: join2(todoDir, "config.json"),
    undoFile: join2(todoDir, "undo.json"),
    removedFile: join2(todoDir, "removed.json"),
    typosFile: join2(todoDir, "typos.json"),
    boardsFile: join2(todoDir, "boards.json"),
    focusFile: join2(todoDir, "focus.json"),
    lockFile: join2(todoDir, "reminders.lock")
  };
}
var LOCK_POLL_MS = 25;
var LOCK_TIMEOUT_MS = 5000;
var LOCK_STALE_MS = 30000;

class TodoStore {
  paths;
  constructor(paths = getTodoPaths()) {
    this.paths = paths;
  }
  get tasksFile() {
    return this.paths.tasksFile;
  }
  async runExclusive(operation) {
    const acquired = await this.acquireLock();
    try {
      return await operation();
    } finally {
      if (acquired)
        await this.releaseLock();
    }
  }
  async acquireLock() {
    await mkdir2(this.paths.dataDir, { recursive: true });
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const handle = await open(this.paths.lockFile, "wx");
        await handle.write(`${process.pid}
`);
        await handle.close();
        return true;
      } catch (error) {
        if (!isExistingFile(error))
          return false;
        if (await this.breakStaleLock())
          continue;
        await delay(LOCK_POLL_MS);
      }
    }
    return false;
  }
  async breakStaleLock() {
    try {
      const stats = await stat(this.paths.lockFile);
      if (Date.now() - stats.mtimeMs < LOCK_STALE_MS)
        return false;
      await unlink(this.paths.lockFile);
      return true;
    } catch {
      return false;
    }
  }
  async releaseLock() {
    try {
      await unlink(this.paths.lockFile);
    } catch (error) {
      if (!isMissingFile(error))
        throw error;
    }
  }
  async loadTasks() {
    return normalizeTasks(await this.readJson(this.paths.tasksFile, []));
  }
  async saveTasks(tasks) {
    await this.writeJsonAtomically(this.paths.tasksFile, tasks);
  }
  async loadConfig() {
    const { shellDisplayLimit, shellLayout, ...saved } = await this.readJson(this.paths.configFile, {});
    const undoTimeout = typeof saved.undoTimeout === "number" && saved.undoTimeout > 0 ? saved.undoTimeout : DEFAULT_CONFIG.undoTimeout;
    return {
      ...DEFAULT_CONFIG,
      ...shellDisplayLimit === undefined ? {} : { panelLimit: shellDisplayLimit },
      ...shellLayout === undefined ? {} : { panelLayout: shellLayout },
      ...saved,
      schemaVersion: 1,
      undoTimeout
    };
  }
  async saveConfig(config) {
    await this.writeJsonAtomically(this.paths.configFile, config);
  }
  async loadCollapsedEpicIds() {
    const saved = (await this.loadConfig()).collapsedEpicIds;
    return new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : []);
  }
  async saveCollapsedEpicIds(ids) {
    const config = await this.loadConfig();
    const collapsedEpicIds = [...new Set(ids)].sort((left, right) => Number(left) - Number(right));
    await this.saveConfig({ ...config, collapsedEpicIds });
  }
  async saveUndo(tasks) {
    const config = await this.loadConfig();
    const removed = await this.loadRemoved();
    const timestamp = Math.max(Date.now(), ...removed.map((entry) => entry.removedAt + 1));
    await this.appendRemoved(removed, tasks, timestamp);
    await this.writeJsonAtomically(this.paths.undoFile, {
      tasks,
      timestamp,
      expiresAt: timestamp + config.undoTimeout
    });
  }
  async loadUndo() {
    const undo = await this.readJson(this.paths.undoFile, undefined);
    if (undo === undefined || Date.now() > undo.expiresAt) {
      await this.clearUndo();
      return;
    }
    return undo;
  }
  async loadRemoved() {
    const saved = await this.readJson(this.paths.removedFile, []);
    if (!Array.isArray(saved))
      return [];
    const tasks = normalizeTasks(saved.map((entry) => entry.task));
    return saved.map((entry, index) => ({ ref: entry.ref, removedAt: entry.removedAt, task: tasks[index] }));
  }
  async saveRemoved(entries) {
    await this.writeJsonAtomically(this.paths.removedFile, entries);
  }
  async forgetRemovedBatch(removedAt) {
    const entries = await this.loadRemoved();
    const kept = entries.filter((entry) => entry.removedAt !== removedAt);
    if (kept.length !== entries.length)
      await this.saveRemoved(kept);
  }
  async appendRemoved(entries, tasks, removedAt) {
    if (tasks.length === 0)
      return;
    let nextRef = entries.reduce((max, entry) => Math.max(max, entry.ref), 0) + 1;
    await this.saveRemoved([...entries, ...tasks.map((task) => ({ ref: nextRef++, removedAt, task }))]);
  }
  async loadTypoMemory() {
    return await this.readJson(this.paths.typosFile, {});
  }
  async saveTypoMemory(memory) {
    await this.writeJsonAtomically(this.paths.typosFile, memory);
  }
  async loadBoardsFile() {
    const saved = await this.readJson(this.paths.boardsFile, undefined);
    return saved === undefined ? undefined : normalizeBoards(saved);
  }
  async saveBoards(state) {
    await this.writeJsonAtomically(this.paths.boardsFile, state);
  }
  async loadLegacyFocus() {
    const board = await this.readJson(this.paths.focusFile, undefined);
    if (board === undefined || typeof board.startedAt !== "number" || typeof board.expiresAt !== "number")
      return;
    return board;
  }
  async deleteLegacyFocus() {
    try {
      await unlink(this.paths.focusFile);
    } catch (error) {
      if (!isMissingFile(error))
        throw error;
    }
  }
  async clearUndo() {
    try {
      await unlink(this.paths.undoFile);
    } catch (error) {
      if (!isMissingFile(error))
        throw error;
    }
  }
  async readJson(path, fallback) {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (isMissingFile(error))
        return fallback;
      throw new Error(`Could not read ${path}: ${formatError(error)}`);
    }
  }
  async writeJsonAtomically(path, value) {
    await mkdir2(dirname2(path), { recursive: true });
    const temporaryPath = `${path}.${process.pid}.tmp`;
    await writeFile2(temporaryPath, `${JSON.stringify(value, null, 2)}
`, "utf8");
    await rename(temporaryPath, path);
  }
}
function isMissingFile(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
function isExistingFile(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}
function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/cli.ts
var MAX_CORRECTIONS_PER_RUN = 4;
function skipsStartupWork(args) {
  return args[0] === "due" && args[1] === "daemon" || args[0] === "completions";
}
async function run(args) {
  const root = createCommandTree();
  const store = new TodoStore;
  const config = await store.loadConfig();
  if (config.showNotificationsOnStartup && !skipsStartupWork(args)) {
    await sendDueNotifications(store);
    await processDueReminders(store, createDefaultEffects());
  }
  const io = createTerminalIo();
  const expanded = expandVisibilityAliases(args) ?? args;
  let argv = expanded.length > 0 ? expanded : [process.stdin.isTTY && process.stdout.isTTY ? "interactive" : "panel"];
  const typoMemory = config.autocorrect ? await store.loadTypoMemory() : undefined;
  const options = {
    boardNames: await readBoardNames(store),
    tasks: await store.loadTasks(),
    ...typoMemory === undefined ? {} : { isNearMiss: (token, candidates) => decideCorrection(typoMemory, token, candidates) !== undefined }
  };
  const context = { store, stdout: process.stdout, stderr: process.stderr, root };
  for (let attempt = 0;attempt <= MAX_CORRECTIONS_PER_RUN; attempt += 1) {
    try {
      await executeCommand(root, argv, context, options);
      return;
    } catch (error) {
      if (!(error instanceof UserInputError))
        throw error;
      if (error instanceof UnknownTokenError && config.autocorrect) {
        const outcome = await resolveTypo(error, argv, store, io);
        if (outcome.kind === "corrected") {
          argv = outcome.argv;
          continue;
        }
        if (outcome.kind === "declined" && error.implicitAddFallback) {
          options.forceImplicitAdd = true;
          continue;
        }
        if (outcome.kind === "unanswered") {
          fail(`${error.message}. Did you mean ${outcome.suggestion}?`);
          return;
        }
      }
      fail(error.message);
      return;
    }
  }
}
function fail(message) {
  process.stderr.write(`${message}
`);
  process.exitCode = 1;
}
function createTerminalIo() {
  return {
    async confirm(question) {
      if (!process.stdin.isTTY || !process.stdout.isTTY)
        return;
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
    }
  };
}

// todo.ts
await run(process.argv.slice(2));
