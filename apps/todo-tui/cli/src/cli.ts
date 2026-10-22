import { createInterface } from "node:readline/promises";
import { resolveTypo, type AutocorrectIo } from "./autocorrect";
import { executeCommand } from "./command-spec/execute";
import type { ParseOptions } from "./command-spec/parse";
import { decideCorrection } from "./domain/autocorrect";
import { UnknownTokenError } from "./domain/unknown-token-error";
import { UserInputError } from "./domain/user-input-error";
import { expandVisibilityAliases } from "./domain/visibility-alias";
import { sendDueNotifications } from "./notifications";
import { createCommandTree } from "./plugins/builtins";
import { createDefaultEffects } from "./scheduler/daemon";
import { processDueReminders } from "./scheduler/reminder-processor";
import { readBoardNames } from "./services/boards";
import { TodoStore } from "./storage/todo-store";

const MAX_CORRECTIONS_PER_RUN = 4;

/** The daemon runs its own processing loop, and completions must stay fast and silent. */
function skipsStartupWork(args: ReadonlyArray<string>): boolean {
  return (args[0] === "due" && args[1] === "daemon") || args[0] === "completions";
}

export async function run(args: string[]): Promise<void> {
  const root = createCommandTree();
  const store = new TodoStore();
  const config = await store.loadConfig();
  if (config.showNotificationsOnStartup && !skipsStartupWork(args)) {
    await sendDueNotifications(store);
    await processDueReminders(store, createDefaultEffects());
  }

  const io = createTerminalIo();
  const expanded = expandVisibilityAliases(args) ?? args;
  let argv = expanded.length > 0 ? expanded : [process.stdin.isTTY && process.stdout.isTTY ? "interactive" : "panel"];
  const typoMemory = config.autocorrect ? await store.loadTypoMemory() : undefined;
  const options: ParseOptions = {
    boardNames: await readBoardNames(store),
    tasks: await store.loadTasks(),
    ...(typoMemory === undefined ? {} : { isNearMiss: (token: string, candidates: ReadonlyArray<string>) => decideCorrection(typoMemory, token, candidates) !== undefined }),
  };
  const context = { store, stdout: process.stdout, stderr: process.stderr, root };

  for (let attempt = 0; attempt <= MAX_CORRECTIONS_PER_RUN; attempt += 1) {
    try {
      await executeCommand(root, argv, context, options);
      return;
    } catch (error: unknown) {
      if (!(error instanceof UserInputError)) throw error;
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

function fail(message: string): void {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function createTerminalIo(): AutocorrectIo {
  return {
    async confirm(question) {
      if (!process.stdin.isTTY || !process.stdout.isTTY) return undefined;
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
    },
  };
}
