import { decideCorrection, isAutoCorrected, recordDecision, replaceToken } from "./domain/autocorrect";
import type { UnknownTokenError } from "./domain/unknown-token-error";
import type { TodoStore } from "./storage/todo-store";

export interface AutocorrectIo {
  /** Resolves undefined when no question could be asked, for example without a terminal. */
  confirm(question: string): Promise<boolean | undefined>;
  notify(message: string): void;
}

export type TypoOutcome =
  | { kind: "corrected"; argv: string[] }
  | { kind: "declined" }
  | { kind: "unanswered"; suggestion: string }
  | { kind: "none" };

const DIM = "\u001B[2m";
const BOLD = "\u001B[1m";
const RESET = "\u001B[0m";

/**
 * Decides what to do with a rejected token: apply a learned correction, ask on a terminal, or hand back
 * the suggestion when nobody can be asked. Answers are remembered in the typo memory.
 */
export async function resolveTypo(error: UnknownTokenError, argv: ReadonlyArray<string>, store: TodoStore, io: AutocorrectIo): Promise<TypoOutcome> {
  const memory = await store.loadTypoMemory();
  const decision = decideCorrection(memory, error.token, error.candidates);
  if (decision === undefined) return { kind: "none" };

  const corrected = replaceToken(argv, error.token, decision.correction);
  if (corrected === undefined) return { kind: "none" };

  if (decision.mode === "auto") {
    io.notify(`${DIM}autocorrected ${error.token} → ${decision.correction}  (todo typos forget ${error.token} to stop)${RESET}\n`);
    return { kind: "corrected", argv: corrected };
  }

  const answer = await io.confirm(`Did you mean ${BOLD}todo ${corrected.join(" ")}${RESET}? [Y/n] `);
  if (answer === undefined) return { kind: "unanswered", suggestion: decision.correction };

  const updated = recordDecision(memory, error.token, decision.correction, answer);
  await store.saveTypoMemory(updated);
  const record = updated[error.token]?.[decision.correction];
  if (answer && record !== undefined && isAutoCorrected(record)) {
    io.notify(`${DIM}learned: ${error.token} now autocorrects to ${decision.correction}${RESET}\n`);
  }
  return answer ? { kind: "corrected", argv: corrected } : { kind: "declined" };
}
