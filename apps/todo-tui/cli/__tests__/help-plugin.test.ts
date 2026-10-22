import { expect, test } from "bun:test";

import { createCommandTree } from "@/src/plugins/builtins";
import { resolveHelpPath } from "@/src/plugins/help";
import { formatCommandHelp, formatHelpOverview } from "@/src/presentation/help-format";
import { findChild } from "@/src/command-spec/tree";
import { UnknownTokenError } from "@/src/domain/unknown-token-error";
import { runTodo } from "./support/run-todo";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ESCAPE = "\u001B";

test("aliases resolve to the primary command", () => {
  const root = createCommandTree();
  expect(findChild(root, "delete")).toBe(findChild(root, "rm"));
  expect(findChild(root, "mv")).toBe(findChild(root, "move"));
  expect(findChild(root, "tree")).toBe(findChild(root, "list"));
  for (const alias of ["i", "-i", "--interactive"]) {
    expect(findChild(root, alias)).toBe(findChild(root, "interactive"));
  }
});

test("overview groups commands and shows aliases inline", () => {
  const output = formatHelpOverview(createCommandTree(), false);
  expect(output).toContain("CREATE");
  expect(output).toContain("BOARDS");
  expect(output).toContain("REMOVE");
  expect(output).toContain("rm, delete");
  expect(output).toContain("list, tree");
  expect(output).not.toMatch(/^\s+toggle\s/m);
  expect(output).not.toContain("rmall");
  expect(output.indexOf("CREATE")).toBeLessThan(output.indexOf("BOARDS"));
  expect(output).not.toContain(ESCAPE);
});

test("command help renders generated usage, options, and examples", () => {
  const root = createCommandTree();
  const output = formatCommandHelp(resolveHelpPath(root, ["add"]), false);
  expect(output).toContain("todo add  ·  Add one or more tasks.");
  expect(output).toContain("USAGE");
  expect(output).toContain("--due <time>");
  expect(output).toContain("--later");
  expect(output).toContain("$ todo buy oat milk");
});

test("help follows nested paths and aliases", async () => {
  const store = new TodoStore(getTodoPaths(await mkdtemp(join(tmpdir(), "dotfiles-todo-help-"))));
  expect(await runTodo(store, ["help", "delete"])).toContain("aliases: delete");
  expect(await runTodo(store, ["help", "board", "later"])).toContain("todo board later  ·");
  expect(() => resolveHelpPath(createCommandTree(), ["board", "latr"])).toThrow(UnknownTokenError);
});

test("colored output uses the palette escapes", () => {
  const output = formatHelpOverview(createCommandTree(), true);
  expect(output).toContain(`${ESCAPE}[38;5;208m`);
  expect(output).toContain(`${ESCAPE}[0m`);
});
