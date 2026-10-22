import { nextFrame, summarize, type TimingSummary } from "./metrics";

type LongFrame = { startTime: number; durationMs: number; blockingDurationMs: number };

export type Phase = {
  name: string;
  startedAt: number;
  dispatchMs: number[];
  nextPaintMs: number[];
  frameGapsMs: number[];
  reactCommitMs: number[];
  longTasks: number[];
  longAnimationFrames: LongFrame[];
  observers: PerformanceObserver[];
  stopFrames: () => void;
};

export type PhaseResult = {
  summary: Record<"dispatch" | "nextPaint" | "frameGaps" | "reactCommit", TimingSummary>;
  droppedFrames: number;
  longTasks: number[];
  longAnimationFrames: LongFrame[];
  reactCommits: number;
  newResources: string[];
};

function startFrameMonitor(phase: Phase): () => void {
  let running = true;
  let previous = 0;
  function tick(now: number) {
    if (!running) return;
    if (previous > 0) phase.frameGapsMs.push(now - previous);
    previous = now;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return () => {
    running = false;
  };
}

function observe(phase: Phase, type: string, onEntry: (entry: PerformanceEntry) => void) {
  if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
  const observer = new PerformanceObserver((list) => list.getEntries().forEach(onEntry));
  observer.observe({ type });
  phase.observers.push(observer);
}

export function startPhase(name: string): Phase {
  const phase: Phase = {
    name,
    startedAt: performance.now(),
    dispatchMs: [],
    nextPaintMs: [],
    frameGapsMs: [],
    reactCommitMs: [],
    longTasks: [],
    longAnimationFrames: [],
    observers: [],
    stopFrames: () => undefined,
  };
  phase.stopFrames = startFrameMonitor(phase);
  observe(phase, "longtask", (entry) => phase.longTasks.push(entry.duration));
  observe(phase, "long-animation-frame", (entry) => {
    const frame = entry as PerformanceEntry & { blockingDuration?: number };
    phase.longAnimationFrames.push({
      startTime: frame.startTime,
      durationMs: frame.duration,
      blockingDurationMs: frame.blockingDuration ?? 0,
    });
  });
  return phase;
}

export async function stopPhase(
  phase: Phase,
  estimatedFrameMs: number,
  resourceBaseline: ReadonlySet<string>,
): Promise<PhaseResult> {
  await nextFrame();
  for (const observer of phase.observers) {
    observer.takeRecords();
    observer.disconnect();
  }
  phase.stopFrames();
  return {
    summary: {
      dispatch: summarize(phase.dispatchMs),
      nextPaint: summarize(phase.nextPaintMs),
      frameGaps: summarize(phase.frameGapsMs),
      reactCommit: summarize(phase.reactCommitMs),
    },
    droppedFrames: phase.frameGapsMs.filter((gap) => gap > estimatedFrameMs * 1.5).length,
    longTasks: phase.longTasks,
    longAnimationFrames: phase.longAnimationFrames.filter(
      (frame) => frame.startTime + frame.durationMs >= phase.startedAt,
    ),
    reactCommits: phase.reactCommitMs.length,
    newResources: performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => !resourceBaseline.has(name)),
  };
}

/**
 * Measures one synchronous interaction: time inside the dispatch, then time until the next frame.
 * Wrap the dispatch in `flushSync` so React's commit lands inside the measured window.
 */
export async function measureInteraction(phase: Phase, dispatch: () => void): Promise<void> {
  await nextFrame();
  const started = performance.now();
  dispatch();
  phase.dispatchMs.push(performance.now() - started);
  const paintStarted = performance.now();
  await nextFrame();
  phase.nextPaintMs.push(performance.now() - paintStarted);
}
