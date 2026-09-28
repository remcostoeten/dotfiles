import type { CommandSummary } from "../plugins/types";
import { stripAnsi } from "./ansi-text";
import { formatCommandHelp, formatHelpOverview } from "./help-format";

export interface HelpLine {
  /** The styled line as it is drawn. */
  text: string;
  /** The same line without escapes, which is what searching and filtering work on. */
  plain: string;
}

/** The overview followed by every command's own help, so one buffer holds everything worth searching. */
export function buildHelpDocument(commands: ReadonlyArray<CommandSummary>, useColor: boolean): HelpLine[] {
  const sections = [formatHelpOverview(commands, useColor), ...commands.map((command) => formatCommandHelp(command, useColor))];
  const lines = sections.join("\n").split("\n");
  return collapseBlankRuns(lines).map((text) => ({ text, plain: stripAnsi(text) }));
}

function collapseBlankRuns(lines: string[]): string[] {
  const result: string[] = [];
  for (const line of lines) {
    const blank = stripAnsi(line).trim().length === 0;
    if (blank && result.length > 0 && stripAnsi(result[result.length - 1]!).trim().length === 0) continue;
    result.push(line);
  }
  while (result.length > 0 && stripAnsi(result[result.length - 1]!).trim().length === 0) result.pop();
  return result;
}
