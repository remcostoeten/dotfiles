/** Optimal string alignment distance: edits plus adjacent transpositions. */
export function editDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const table: number[][] = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));
  for (let row = 0; row < rows; row += 1) table[row]![0] = row;
  for (let column = 0; column < columns; column += 1) table[0]![column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      let best = Math.min(
        table[row - 1]![column]! + 1,
        table[row]![column - 1]! + 1,
        table[row - 1]![column - 1]! + cost,
      );
      const transposed = row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1];
      if (transposed) best = Math.min(best, table[row - 2]![column - 2]! + 1);
      table[row]![column] = best;
    }
  }
  return table[left.length]![right.length]!;
}

export function maxDistanceFor(token: string): number {
  if (token.length <= 3) return 1;
  if (token.length <= 6) return 2;
  return 3;
}

/**
 * Picks the single closest candidate for a mistyped token, or undefined when nothing is close enough
 * or two candidates are equally close. A unique prefix match wins for tokens of three characters or more.
 */
export function findClosest(token: string, candidates: ReadonlyArray<string>): string | undefined {
  const needle = token.toLowerCase();
  if (needle.length < 2) return undefined;

  const prefixMatches = candidates.filter((candidate) => candidate.toLowerCase().startsWith(needle) && candidate !== token);
  if (needle.length >= 3 && prefixMatches.length === 1) return prefixMatches[0];

  const limit = maxDistanceFor(needle);
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  let tied = false;
  for (const candidate of candidates) {
    if (candidate === token) continue;
    const distance = editDistance(needle, candidate.toLowerCase());
    if (distance > limit) continue;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
      tied = false;
    } else if (distance === bestDistance) {
      tied = true;
    }
  }
  return tied ? undefined : best;
}
