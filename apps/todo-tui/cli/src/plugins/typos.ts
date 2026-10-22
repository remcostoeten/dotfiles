import type { CommandSpec } from "../command-spec/types";
import { AUTO_CORRECT_THRESHOLD, forgetTypo, isAutoCorrected, isIgnored } from "../domain/autocorrect";
import { UserInputError } from "../domain/user-input-error";

const DIM = "\u001B[2m";
const GREEN = "\u001B[32m";
const RESET = "\u001B[0m";

export const typosCommand: CommandSpec = {
  name: "typos",
  summary: "Review or forget learned typo corrections.",
  group: "Settings",
  details: [
    "A mistyped command, subcommand, option, value or board name with one close match prompts \"did you mean\".",
    `Accepting the same correction ${AUTO_CORRECT_THRESHOLD} times makes it run automatically, with a notice each time.`,
    "Declining the same correction twice stops the prompt for that word. Without a terminal the suggestion is printed and the command fails.",
    "Turn everything off with `todo config autocorrect off`.",
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
        if (memory[target] === undefined) throw new UserInputError(`Nothing learned for: ${target}`);
        await store.saveTypoMemory(forgetTypo(memory, target));
        stdout.write(`${GREEN}Forgot ${target}${RESET}\n`);
      },
    },
    {
      name: "reset",
      summary: "Forget every learned typo.",
      examples: [{ command: "todo typos reset" }],
      async run(_input, { store, stdout }) {
        await store.saveTypoMemory({});
        stdout.write(`${GREEN}Forgot all learned typos${RESET}\n`);
      },
    },
  ],
  async run(_input, { store, stdout }) {
    const memory = await store.loadTypoMemory();
    const entries = Object.entries(memory).flatMap(([typo, corrections]) =>
      Object.entries(corrections).map(([correction, record]) => ({ typo, correction, record })),
    );
    if (entries.length === 0) {
      stdout.write(`${DIM}No learned typos yet. Corrections are learned when you answer a "did you mean" prompt.${RESET}\n`);
      return;
    }
    for (const { typo, correction, record } of entries) {
      const state = isAutoCorrected(record)
        ? "auto"
        : isIgnored(record)
          ? "ignored"
          : `prompts (${record.accepted}/${AUTO_CORRECT_THRESHOLD} until auto)`;
      stdout.write(`${typo.padEnd(18)} → ${correction.padEnd(18)} ${DIM}${state}${RESET}\n`);
    }
  },
};
