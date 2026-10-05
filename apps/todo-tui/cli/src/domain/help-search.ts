export interface SearchMatch {
  line: number;
  start: number;
  end: number;
}

/** Every case-insensitive occurrence of `query`, in document order. */
export function findMatches(lines: ReadonlyArray<string>, query: string): SearchMatch[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  const matches: SearchMatch[] = [];
  lines.forEach((line, index) => {
    const haystack = line.toLowerCase();
    let from = 0;
    for (;;) {
      const start = haystack.indexOf(needle, from);
      if (start === -1) break;
      matches.push({ line: index, start, end: start + needle.length });
      from = start + needle.length;
    }
  });
  return matches;
}

/** Indices of the lines that contain the query, for the filtered view shown while typing. */
export function findMatchingLines(lines: ReadonlyArray<string>, query: string): number[] {
  return [...new Set(findMatches(lines, query).map((match) => match.line))];
}

/** Wraps around both ends; returns -1 when there is nothing to step through. */
export function stepMatch(current: number, total: number, direction: 1 | -1): number {
  if (total === 0) return -1;
  return (((current + direction) % total) + total) % total;
}

export function matchesOnLine(matches: ReadonlyArray<SearchMatch>, line: number): SearchMatch[] {
  return matches.filter((match) => match.line === line);
}
