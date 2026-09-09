import { AUTO_CORRECT_THRESHOLD, forgetTypo, isAutoCorrected, isIgnored } from "../domain/autocorrect";
import { UserInputError } from "../domain/user-input-error";
import type { TodoPlugin } from "./types";

const DIM = "[2m";
const GREEN = "[32m";
const RESET = "[0m";

export const typosPlugin: TodoPlugin = {
  name: "typos",
  description: "Shows and forgets learned typo corrections.",
  register(app) {
    app.command("typos", "Review or forget learned typo corrections.", async ({ args, store, stdout }) => {
      const [verb, target] = args;
      const memory = await store.loadTypoMemory();

      if (verb === undefined) {
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
        return;
      }

      if (verb === "forget") {
        if (target === undefined || args.length !== 2) throw new UserInputError("Usage: todo typos forget <typo>");
        if (memory[target] === undefined) throw new UserInputError(`Nothing learned for: ${target}`);
        await store.saveTypoMemory(forgetTypo(memory, target));
        stdout.write(`${GREEN}Forgot ${target}${RESET}\n`);
        return;
      }

      if (verb === "reset") {
        if (args.length !== 1) throw new UserInputError("Usage: todo typos reset");
        await store.saveTypoMemory({});
        stdout.write(`${GREEN}Forgot all learned typos${RESET}\n`);
        return;
      }

      throw new UserInputError("Usage: todo typos [forget <typo> | reset]");
    }, {
      group: "Settings",
      positional: "any",
      usage: ["todo typos", "todo typos forget <typo>", "todo typos reset"],
      details: [
        "A mistyped command or option with one close match prompts \"did you mean\".",
        `Accepting the same correction ${AUTO_CORRECT_THRESHOLD} times makes it run automatically, with a notice each time.`,
        "Declining the same correction twice stops the prompt for that word. Turn everything off with `todo config autocorrect off`.",
      ],
      examples: [{ command: "todo typos" }, { command: "todo typos forget dne" }],
    });
  },
};
