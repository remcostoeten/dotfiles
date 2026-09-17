import { findClosest } from "./fuzzy-match";

export interface TypoRecord {
  accepted: number;
  rejected: number;
}

export type TypoMemory = Record<string, Record<string, TypoRecord>>;

export type CorrectionMode = "auto" | "prompt";

export interface CorrectionDecision {
  correction: string;
  mode: CorrectionMode;
}

export type ArgumentShape = "none" | "task-id" | "task-ids" | "text" | "any";

export const AUTO_CORRECT_THRESHOLD = 3;
const GIVE_UP_AFTER_REJECTIONS = 2;

export function decideCorrection(memory: TypoMemory, token: string, candidates: ReadonlyArray<string>): CorrectionDecision | undefined {
  const records = memory[token] ?? {};
  const learned = Object.entries(records)
    .filter(([candidate, record]) => candidates.includes(candidate) && record.accepted > record.rejected)
    .sort(([, left], [, right]) => right.accepted - left.accepted)[0];

  if (learned !== undefined) {
    const [correction, record] = learned;
    return { correction, mode: record.accepted >= AUTO_CORRECT_THRESHOLD && record.rejected === 0 ? "auto" : "prompt" };
  }

  const closest = findClosest(token, candidates);
  if (closest === undefined) return undefined;
  const record = records[closest];
  if (record !== undefined && isIgnored(record)) return undefined;
  return { correction: closest, mode: "prompt" };
}

export function recordDecision(memory: TypoMemory, token: string, correction: string, accepted: boolean): TypoMemory {
  const current = memory[token]?.[correction] ?? { accepted: 0, rejected: 0 };
  const updated: TypoRecord = accepted
    ? { accepted: current.accepted + 1, rejected: current.rejected }
    : { accepted: current.accepted, rejected: current.rejected + 1 };
  return { ...memory, [token]: { ...memory[token], [correction]: updated } };
}

export function forgetTypo(memory: TypoMemory, token: string): TypoMemory {
  const { [token]: _removed, ...rest } = memory;
  return rest;
}

export function isAutoCorrected(record: TypoRecord): boolean {
  return record.accepted >= AUTO_CORRECT_THRESHOLD && record.rejected === 0;
}

export function isIgnored(record: TypoRecord): boolean {
  return record.accepted === 0 && record.rejected >= GIVE_UP_AFTER_REJECTIONS;
}

const ID_LIST_PART = /^\d+(-\d+)?$/;

/** Guards first-word corrections: the remaining arguments must look like what the corrected command expects. */
export function argumentsFitShape(shape: ArgumentShape, rest: ReadonlyArray<string>, taskIds: ReadonlySet<string>): boolean {
  switch (shape) {
    case "none":
      return rest.every((argument) => argument.startsWith("-"));
    case "task-id": {
      const first = rest[0];
      return first !== undefined && taskIds.has(first.replace(/^#/, ""));
    }
    case "task-ids":
      if (rest.length === 0) return false;
      if (rest.length === 1 && rest[0] === "all") return true;
      return rest.every((argument) => argument.replace(/^#/, "").split(",").every((part) => ID_LIST_PART.test(part)));
    case "text":
      return rest.length > 0;
    case "any":
      return rest.length <= 3;
  }
}

/** Swaps the mistyped token for its correction, also inside `--name=value` arguments. Undefined when the token is not a standalone argument. */
export function replaceToken(args: ReadonlyArray<string>, token: string, correction: string): string[] | undefined {
  const index = args.findIndex((argument) => argument === token || argument.startsWith(`${token}=`) || argument.endsWith(`=${token}`));
  if (index === -1) return undefined;
  const argument = args[index]!;
  const replacement = argument === token
    ? correction
    : argument.startsWith(`${token}=`)
      ? `${correction}${argument.slice(token.length)}`
      : `${argument.slice(0, argument.length - token.length)}${correction}`;
  return [...args.slice(0, index), replacement, ...args.slice(index + 1)];
}
