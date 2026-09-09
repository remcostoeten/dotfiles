const ANSI_PATTERN = /\u001B\[[0-9;]*m/g;

export interface VisibleRange {
  start: number;
  end: number;
  /** Overrides the default codes for this range, so one pass can style a current match differently. */
  on?: string;
  off?: string;
}

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}

export function getVisibleWidth(value: string): number {
  return stripAnsi(value).length;
}

/** Cuts a styled string to `width` visible characters, keeping every escape sequence it passed. */
export function clipVisible(value: string, width: number): string {
  if (width <= 0) return "";
  if (getVisibleWidth(value) <= width) return value;

  let result = "";
  let visible = 0;
  for (const token of tokenize(value)) {
    if (token.escape) {
      result += token.text;
      continue;
    }
    for (const character of token.text) {
      if (visible === width) return `${result}\u001B[0m`;
      result += character;
      visible += 1;
    }
  }
  return `${result}\u001B[0m`;
}

/** Wraps the given visible-column ranges in `on`/`off` codes without disturbing the colors already in the string. */
export function highlightVisibleRanges(value: string, ranges: ReadonlyArray<VisibleRange>, on: string, off: string): string {
  if (ranges.length === 0) return value;
  const starts = new Map(ranges.map((range) => [range.start, range]));
  const ends = new Map(ranges.map((range) => [range.end, range]));

  let result = "";
  let visible = 0;
  let activeOff: string | undefined;
  for (const token of tokenize(value)) {
    if (token.escape) {
      result += token.text;
      continue;
    }
    for (const character of token.text) {
      const ending = ends.get(visible);
      if (activeOff !== undefined && ending !== undefined) {
        result += activeOff;
        activeOff = undefined;
      }
      const starting = starts.get(visible);
      if (starting !== undefined) {
        result += starting.on ?? on;
        activeOff = starting.off ?? off;
      }
      result += character;
      visible += 1;
    }
  }
  return activeOff === undefined ? result : `${result}${activeOff}`;
}

interface Token {
  text: string;
  escape: boolean;
}

function tokenize(value: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  for (const match of value.matchAll(ANSI_PATTERN)) {
    if (match.index > lastIndex) tokens.push({ text: value.slice(lastIndex, match.index), escape: false });
    tokens.push({ text: match[0], escape: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < value.length) tokens.push({ text: value.slice(lastIndex), escape: false });
  return tokens;
}
