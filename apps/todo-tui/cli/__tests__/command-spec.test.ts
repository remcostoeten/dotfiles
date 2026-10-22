import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateFishCompletions } from "@/src/command-spec/completions";
import { parse } from "@/src/command-spec/parse";
import { childNames, flagSpellings, HELP_FLAGS, visibleFlags, walkSpecs } from "@/src/command-spec/tree";
import type { CommandSpec } from "@/src/command-spec/types";
import { decideCorrection } from "@/src/domain/autocorrect";
import { UnknownTokenError } from "@/src/domain/unknown-token-error";
import { createCommandTree } from "@/src/plugins/builtins";
import { formatCommandHelp } from "@/src/presentation/help-format";

const root = createCommandTree();
const nodes = walkSpecs(root).filter(({ path }) => path.every((node) => node.hidden !== true));
const completions = generateFishCompletions(root);
const COMPLETIONS_FILE = join(import.meta.dir, "../../../../configs/fish/completions/todo.fish");

function names(path: ReadonlyArray<CommandSpec>): string[] {
  return path.map((node) => node.name);
}

function label(path: ReadonlyArray<CommandSpec>): string {
  return names(path).join(" ");
}

/** A one-letter slip: the last character typed twice. */
function typo(word: string): string {
  return `${word}${word[word.length - 1]}`;
}

function rejected(argv: string[]): UnknownTokenError {
  try {
    parse(root, argv, { boardNames: [] });
  } catch (error: unknown) {
    if (error instanceof UnknownTokenError) return error;
    throw error;
  }
  throw new Error(`todo ${argv.join(" ")} parsed without complaint`);
}

describe.each(nodes.map(({ path }) => [label(path), path] as const))("todo %s", (_name, path) => {
  const node = path[path.length - 1]!;
  const parent = path.slice(0, -1);

  test("has a summary", () => {
    expect(node.summary.trim().length).toBeGreaterThan(0);
  });

  test.each([...HELP_FLAGS])("%s renders its own help", (flag) => {
    const result = parse(root, [...names(path), flag]);
    expect(result.kind).toBe("help");
    expect(names(result.path)).toEqual(names(path));
    expect(formatCommandHelp(result.path, false)).toContain(`todo ${label(path)}  ·  ${node.summary}`);
  });

  test("appears in the generated completions with every flag", () => {
    expect(completions).toContain(`-n '__todo_at \\'${label(parent)}\\'' -a '${node.name}'`);
    for (const flag of visibleFlags(node)) {
      expect(completions).toContain(`-n '__todo_in \\'${label(path)}\\'' -l ${flag.name}`);
    }
  });

  test("a one-letter typo of its name gets a suggestion", () => {
    const candidates = parent.length === 0 ? childNames(root).filter((name) => !name.startsWith("-")) : rejected([...names(parent), typo(node.name)]).candidates;
    expect(decideCorrection({}, typo(node.name), candidates)?.correction).toBe(node.name);
  });

  test("a one-letter typo of each flag gets a suggestion", () => {
    if (node.run === undefined) return;
    for (const flag of visibleFlags(node)) {
      const error = rejected([...names(path), typo(`--${flag.name}`)]);
      expect(decideCorrection({}, error.token, error.candidates)?.correction).toBe(`--${flag.name}`);
    }
  });

  test("children and flags do not collide", () => {
    const children = (node.subcommands ?? []).flatMap((child) => [child.name, ...(child.aliases ?? [])]);
    expect(new Set(children).size).toBe(children.length);
    const spellings = (node.flags ?? []).flatMap(flagSpellings);
    expect(new Set(spellings).size).toBe(spellings.length);
    expect(spellings.filter((spelling) => HELP_FLAGS.has(spelling))).toEqual([]);
    if (node.defaultSubcommand !== undefined) expect(children).toContain(node.defaultSubcommand);
  });
});

test("the root has no colliding command names", () => {
  const all = (root.subcommands ?? []).flatMap((child) => [child.name, ...(child.aliases ?? [])]);
  expect(new Set(all).size).toBe(all.length);
});

test("the committed fish completions match the command tree", async () => {
  expect(await readFile(COMPLETIONS_FILE, "utf8")).toBe(completions);
});

describe("parser", () => {
  test("help flags anywhere show the deepest matched node", () => {
    const result = parse(root, ["board", "add", "12", "--later", "-h"]);
    expect(result.kind === "help" && label(result.path)).toBe("board add");
  });

  test("-- ends option parsing and help detection", () => {
    const result = parse(root, ["add", "--", "--help", "me"]);
    expect(result.kind === "run" && result.input.args("description")).toEqual(["--help", "me"]);
  });

  test("boolean flags take no value and value flags need one", () => {
    const result = parse(root, ["add", "x", "--later", "y"]);
    expect(result.kind === "run" && result.input.args("description")).toEqual(["x", "y"]);
    expect(() => parse(root, ["add", "x", "--later=yes"])).toThrow("takes no value");
    expect(() => parse(root, ["add", "x", "--priority"])).toThrow("Missing value for --priority");
  });

  test("greedy values collect words up to the next flag", () => {
    const result = parse(root, ["add", "x", "--due", "next", "week", "--later"]);
    expect(result.kind === "run" && result.input.value("due")).toBe("next week");
  });

  test("unknown first words become tasks unless they look like a command", () => {
    const options = { isNearMiss: (token: string, candidates: ReadonlyArray<string>) => decideCorrection({}, token, candidates) !== undefined, boardNames: [] };
    expect(label(parse(root, ["buy", "milk"], options).path)).toBe("add");
    expect(label(parse(root, ["3", "fix", "header"], options).path)).toBe("sub");
    expect(() => parse(root, ["bord"], options)).toThrow("Unknown command: bord");
    expect(label(parse(root, ["bord"], { ...options, forceImplicitAdd: true }).path)).toBe("add");
  });

  test("board names are matched case-insensitively and typos are candidates", () => {
    const result = parse(root, ["board", "use", "PROJECTEN"], { boardNames: ["projecten"] });
    expect(result.kind === "run" && result.input.arg("name")).toBe("projecten");
    expect(() => parse(root, ["board", "use", "projcten"], { boardNames: [] })).toThrow("No board named projcten");
    expect(() => parse(root, ["board", "use", "projcten"], { boardNames: ["projecten", "werk"] })).toThrow(UnknownTokenError);
  });
});
