---
name: instant-perf-harness
description: How to prove an app's interaction budgets with numbers instead of feel — a benchmark harness that runs a production build against deterministic scale fixtures, measures dispatch time, time to next paint, frame gaps, dropped frames, long tasks, long animation frames, React commit counts, host mount counts, and network/bridge calls per interaction phase, then gates on P95/max budgets and stores raw samples. Ships drop-in TypeScript helpers. Use this whenever the user wants to benchmark or regression-test UI responsiveness, set up a performance gate or perf CI, verify "zero re-renders while typing" or "no network on navigation", compare two architectures or libraries with measurements, or asks why an interaction feels janky and needs evidence. Prefer this over Lighthouse-style page-load audits when the question is interaction latency inside a running app.
---

# Instant perf harness

Page-load tools (Lighthouse, Core Web Vitals) answer "how fast does it open". An instant app needs a different question answered: "after it is open, does every interaction finish inside one frame, and did it touch anything it should not have?" This harness answers that, and turns the contract in `instant-app` into a gate.

Two kinds of evidence, both required:

- **Timing** — distributions, not averages. P95 and max against the budgets.
- **Structure** — counts that must be exactly zero or exactly N: React commits while typing, host remounts, network or bridge calls during navigation, new resource loads. Structural counts are deterministic, so they work on any CI machine and catch architectural rot long before timing moves.

## Shape

```text
perf/
├── index.html, main.tsx   mounts the REAL app shell + store inside <Profiler>
├── fixture.ts             deterministic data at scale
├── bridge-mock.ts         counting fake for network/IPC
├── metrics.ts, phase.ts   copied from this skill's assets/
├── harness.ts             phases: selection, keyboard nav, typing, palette, reorder
├── vite.config.ts         production build of perf/
└── run.mjs                build → preview → headless Chrome → collect → gate → write JSON
```

Copy `assets/metrics.ts` and `assets/phase.ts` into the project; they are dependency-free. Read them before writing phases — `startPhase`, `measureInteraction`, and `stopPhase` are the whole API.

## Rules that make the numbers trustworthy

- **Production build only.** Dev React is several times slower and StrictMode double-renders. Build with the app's real production config, serve with `vite preview`.
- **Mount the real thing.** Real shell, real store, real components. Only the outermost I/O boundary (fetch, WebSocket, Tauri `invoke`) is replaced, by a fake that counts calls. A harness around a simplified component tree measures nothing useful.
- **Deterministic fixtures at scale.** Generate from a seeded PRNG; never commit generated data. For a task app: 1,000 and 10,000 tasks, 50 projects, deep and wide groupings, 10,000 command-palette entries, long titles, a view with 2,000 visible-eligible rows. Small fixtures hide O(n) work on the interaction path.
- **Warm, then measure.** Run each interaction once untimed so JIT and caches settle, then collect at least 100 samples per phase.
- **Foreground, fixed hardware.** `requestAnimationFrame` is throttled in hidden tabs, so launch Chrome headed-offscreen or with `--disable-renderer-backgrounding --disable-background-timer-throttling --disable-backgrounding-occluded-windows`. Record machine metadata with every result. Timing gates run on one named reference machine; shared CI runs only the structural gates.
- **Estimate the display's frame time** (`estimateFrameDuration`) instead of assuming 16.67 ms; a dropped frame is a gap above 1.5× that estimate.

## Writing a phase

```ts
async function runSelection(): Promise<PhaseResult> {
  const baseline = new Set(performance.getEntriesByType("resource").map((entry) => entry.name));
  for (const id of fixture.measuredIds) {
    flushSync(() => store.select(id));
    await nextFrame();
  }
  const phase = startPhase("selection");
  for (let index = 0; index < 300; index += 1) {
    const id = fixture.measuredIds[index % fixture.measuredIds.length];
    await measureInteraction(phase, () => flushSync(() => store.select(id)));
  }
  return stopPhase(phase, estimatedFrameMs, baseline);
}
```

- `flushSync` forces React's commit inside the measured window so dispatch time includes render.
- For **input latency** (typing, keyboard nav) drive real trusted key events from the runner over CDP (`Input.dispatchKeyEvent`) and measure `event.timeStamp` → next `requestAnimationFrame` in a capture-phase listener. Synthetic `dispatchEvent` skips the browser's input pipeline and under-reports.
- Feed `<Profiler onRender>` durations into `phase.reactCommitMs`; the length of that array is the commit count for the phase.
- Count host mounts with a `MutationObserver` watching for added nodes matching the persistent host's selector. After startup the count must not change.
- To instrument a hot internal (an editor's state install, a cache prune) wrap the prototype method for the duration of the run and restore it afterwards. Never leave instrumentation in the shipped bundle.

## Gates

Express every gate as a named boolean so a failure says what broke:

```js
const gates = {
  selectionP95Under8ms: selection.summary.dispatch.p95Ms < 8,
  selectionMaxUnderFrame: selection.summary.nextPaint.maxMs < 16.67,
  switchesDroppedNoFrames: keyboard.droppedFrames === 0,
  navigationMadeNoNetworkCalls: bridge.callsDuring("selection") === 0,
  navigationLoadedNoResources: selection.newResources.length === 0,
  typingCommittedNoReact: typing.reactCommits === 0,
  hostNeverRemounted: mounts.after === mounts.before,
  noLongTasks: selection.longTasks.length === 0,
};
```

Add render-count gates for each row of the render-allowances table in `instant-app` — for example renaming one task commits exactly one row.

Exit non-zero when any gate fails, and print the failing gate names with their measured values.

## Recording results

Write raw samples plus summaries, the git revision, the command, and machine metadata to a JSON file, and a short Markdown record beside it stating what was measured and what it does **not** prove (for example "renderer only; persistence not exercised"). Commit both. A budget claim without a committed measurement is an opinion, and an architecture change that fails a budget needs a written decision and a replacement measurement before it merges.

## Comparing alternatives

When choosing between libraries or designs, build each candidate as a minimal spike against the **same** fixture and phases, record all results, and decide from the numbers. Keep the winning spike's assertions as regression tests; delete the losers. Decide late — defer the choice until the measurement exists rather than picking by reputation.

## Day-to-day companions

The harness is the gate, not the debugger. While developing use React DevTools Profiler or React Scan to spot stray renders, and the Performance panel for flame charts. Those tools show where to look; only the harness proves the contract holds.
