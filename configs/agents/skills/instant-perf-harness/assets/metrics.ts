export type TimingSummary = { p50Ms: number; p95Ms: number; p99Ms: number; maxMs: number };

function percentile(sorted: readonly number[], fraction: number): number {
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index] ?? 0;
}

export function summarize(samples: readonly number[]): TimingSummary {
  const sorted = [...samples].sort((left, right) => left - right);
  return {
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    maxMs: sorted.at(-1) ?? 0,
  };
}

export function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/** Median frame interval of the current display, so dropped-frame detection adapts to 60/120/144 Hz. */
export async function estimateFrameDuration(): Promise<number> {
  const samples: number[] = [];
  let previous = await nextFrame();
  for (let index = 0; index < 12; index += 1) {
    const current = await nextFrame();
    samples.push(current - previous);
    previous = current;
  }
  return summarize(samples).p50Ms;
}
