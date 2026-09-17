const ACTION_LETTERS: Record<string, string> = { t: "toggle", o: "open", c: "close" };
const TARGET_LETTERS: Record<string, string> = { a: "all", r: "reset" };
const HELP_TOKENS = new Set(["help", "-h", "--help"]);

export interface AliasSummary {
  alias: string;
  meaning: string;
}

export const VISIBILITY_ALIASES: AliasSummary[] = [
  { alias: "-tr", meaning: "toggle reset" },
  { alias: "-oa", meaning: "open all" },
  { alias: "-ca", meaning: "close all" },
  { alias: "--t --r", meaning: "toggle reset" },
  { alias: "--o --a", meaning: "open all" },
  { alias: "--c --a", meaning: "close all" },
  { alias: "-t <epic>", meaning: "toggle <epic>" },
  { alias: "-o <epic>", meaning: "open <epic>" },
  { alias: "-c <epic>", meaning: "close <epic>" },
];

export function isHelpToken(token: string): boolean {
  return HELP_TOKENS.has(token);
}

/**
 * Rewrites a complete epic-visibility alias expression into its canonical argv, or returns undefined so the
 * arguments keep their existing meaning. Only a full expression counts: an action letter plus either a target
 * letter, an epic selector, or a help token. `-t`, `--o` and friends on their own stay untouched.
 */
export function expandVisibilityAliases(args: ReadonlyArray<string>): string[] | undefined {
  const letters: string[] = [];
  let index = 0;
  for (; index < args.length; index += 1) {
    const parsed = readAliasLetters(args[index]!);
    if (parsed === undefined) break;
    letters.push(...parsed);
  }
  if (letters.length === 0 || new Set(letters).size !== letters.length) return undefined;

  const actions = letters.filter((letter) => letter in ACTION_LETTERS);
  const targets = letters.filter((letter) => letter in TARGET_LETTERS);
  const action = actions[0];
  if (action === undefined || actions.length !== 1) return undefined;

  const rest = args.slice(index);
  const help = rest.filter(isHelpToken);
  const selectors = rest.filter((token) => !isHelpToken(token));
  if (selectors.some((token) => token.startsWith("-"))) return undefined;
  if (targets.length === 0 && selectors.length === 0 && help.length === 0) return undefined;

  return [ACTION_LETTERS[action]!, ...targets.map((letter) => TARGET_LETTERS[letter]!), ...selectors, ...help];
}

function readAliasLetters(token: string): string[] | undefined {
  if (token.startsWith("--")) {
    const body = token.slice(2);
    return body.length === 1 && isAliasLetter(body) ? [body] : undefined;
  }
  if (!token.startsWith("-") || token.length < 2) return undefined;
  const letters = [...token.slice(1)];
  return letters.every(isAliasLetter) ? letters : undefined;
}

function isAliasLetter(letter: string): boolean {
  return letter in ACTION_LETTERS || letter in TARGET_LETTERS;
}
