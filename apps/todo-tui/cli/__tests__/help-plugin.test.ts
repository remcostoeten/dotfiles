import { expect, test } from "bun:test";

import { builtInPlugins } from "@/src/plugins/builtins";
import { PluginRegistry } from "@/src/plugins/registry";
import { formatCommandHelp, formatHelpOverview } from "@/src/presentation/help-format";

const ESCAPE = "\u001B";

function createRegistry(): PluginRegistry {
  const registry = new PluginRegistry();
  for (const plugin of builtInPlugins) registry.use(plugin);
  return registry;
}

test("aliases resolve to the primary command and stay out of the command list", () => {
  const registry = createRegistry();
  expect(registry.getCommand("delete")).toBe(registry.getCommand("rm"));
  expect(registry.getCommand("mv")).toBe(registry.getCommand("move"));
  expect(registry.getCommand("tree")).toBe(registry.getCommand("list"));
  for (const alias of ["i", "-i", "--interactive"]) {
    expect(registry.getCommand(alias)).toBe(registry.getCommand("interactive"));
  }
  const names = registry.listCommands().map((command) => command.name);
  expect(names).not.toContain("delete");
  expect(names).toContain("rm");
});

test("overview groups commands and shows aliases inline", () => {
  const output = formatHelpOverview(createRegistry().listCommands(), false);
  expect(output).toContain("CREATE");
  expect(output).toContain("REMOVE");
  expect(output).toContain("rm, delete");
  expect(output).toContain("list, tree");
  expect(output.indexOf("CREATE")).toBeLessThan(output.indexOf("VIEW"));
  expect(output).not.toContain(ESCAPE);
});

test("command help renders usage, options, and examples", () => {
  const registry = createRegistry();
  const add = registry.listCommands().find((command) => command.name === "add");
  if (add === undefined) throw new Error("add command missing");
  const output = formatCommandHelp(add, false);
  expect(output).toContain("todo add  ·  Add one or more tasks.");
  expect(output).toContain("USAGE");
  expect(output).toContain("--due <time>");
  expect(output).toContain("$ todo buy oat milk");
});

test("help <command> writes that command's help and accepts aliases", () => {
  const registry = createRegistry();
  const help = registry.getCommand("help");
  if (help === undefined) throw new Error("help command missing");
  let output = "";
  const stdout = {
    write(chunk: string) {
      output += chunk;
      return true;
    },
  };
  help.handler({ args: ["delete"], store: {} as never, stdout, stderr: stdout, commands: registry.listCommands() });
  expect(output).toContain("todo rm");
  expect(output).toContain("aliases: delete");
});

test("colored output uses the palette escapes", () => {
  const output = formatHelpOverview(createRegistry().listCommands(), true);
  expect(output).toContain(`${ESCAPE}[38;5;208m`);
  expect(output).toContain(`${ESCAPE}[0m`);
});
