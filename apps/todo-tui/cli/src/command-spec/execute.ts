import { formatCommandHelp, formatHelpOverview } from "../presentation/help-format";
import { parse, type ParseOptions } from "./parse";
import type { CommandContext, CommandSpec } from "./types";

/** Parses argv against the tree and runs the matched command, or prints help when -h/--help was given. Errors propagate. */
export async function executeCommand(root: CommandSpec, argv: ReadonlyArray<string>, context: CommandContext, options: ParseOptions = {}): Promise<void> {
  const result = parse(root, argv, options);
  if (result.kind === "help") {
    context.stdout.write(result.path.length === 0 ? formatHelpOverview(root) : formatCommandHelp(result.path));
    return;
  }
  await result.node.run?.(result.input, context);
}
