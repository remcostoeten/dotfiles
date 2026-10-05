import { argumentsFitShape, decideCorrection, isAutoCorrected, recordDecision, replaceToken } from "./domain/autocorrect";
import type { UnknownTokenError } from "./domain/unknown-token-error";
import type { PluginRegistry } from "./plugins/registry";
import type { TodoStore } from "./storage/todo-store";

export interface AutocorrectIo {
  /** Resolves undefined when no question could be asked, for example without a terminal. */
  confirm(question: string): Promise<boolean | undefined>;
  notify(message: string): void;
}

const DIM = "[2m";
const BOLD = "[1m";
const RESET = "[0m";

/** Corrects a mistyped command name when the remaining arguments fit the corrected command. Returns the corrected argv, or undefined. */
export async function correctCommandName(args: ReadonlyArray<string>, registry: PluginRegistry, store: TodoStore, io: AutocorrectIo): Promise<string[] | undefined> {
  const [token, ...rest] = args;
  if (token === undefined) return undefined;

  const dashed = token.startsWith("-");
  const candidates = registry
    .listCommands()
    .flatMap((command) => [command.name, ...(command.help.aliases ?? [])])
    .filter((name) => name.startsWith("-") === dashed);

  const pendingIds = new Set((await store.loadTasks()).filter((task) => task.status === "pending").map((task) => task.id));
  return await applyCorrection(args, token, candidates, store, io, (correction) => {
    const command = registry.getCommand(correction);
    return command !== undefined && argumentsFitShape(command.help.positional ?? "none", rest, pendingIds);
  });
}

/** Corrects the token a command rejected while running. Returns the corrected command arguments, or undefined. */
export async function correctRejectedToken(
  error: UnknownTokenError,
  commandName: string | undefined,
  args: ReadonlyArray<string>,
  store: TodoStore,
  io: AutocorrectIo,
): Promise<string[] | undefined> {
  return await applyCorrection(args, error.token, error.candidates, store, io, () => true, commandName);
}

async function applyCorrection(
  args: ReadonlyArray<string>,
  token: string,
  candidates: ReadonlyArray<string>,
  store: TodoStore,
  io: AutocorrectIo,
  accepts: (correction: string) => boolean,
  commandName?: string,
): Promise<string[] | undefined> {
  const memory = await store.loadTypoMemory();
  const decision = decideCorrection(memory, token, candidates);
  if (decision === undefined || !accepts(decision.correction)) return undefined;

  const corrected = replaceToken(args, token, decision.correction);
  if (corrected === undefined) return undefined;

  if (decision.mode === "auto") {
    io.notify(`${DIM}autocorrected ${token} → ${decision.correction}  (todo typos forget ${token} to stop)${RESET}\n`);
    return corrected;
  }

  const shown = commandName === undefined ? corrected : [commandName, ...corrected];
  const answer = await io.confirm(`Did you mean ${BOLD}todo ${shown.join(" ")}${RESET}? [Y/n] `);
  if (answer === undefined) return undefined;

  const updated = recordDecision(memory, token, decision.correction, answer);
  await store.saveTypoMemory(updated);
  const record = updated[token]?.[decision.correction];
  if (answer && record !== undefined && isAutoCorrected(record)) {
    io.notify(`${DIM}learned: ${token} now autocorrects to ${decision.correction}${RESET}\n`);
  }
  return answer ? corrected : undefined;
}
