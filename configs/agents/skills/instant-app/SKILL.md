---
name: instant-app
description: The performance contract for apps that must feel instant — Linear-style task apps, note apps, dashboards, any local-first or optimistic UI on web or desktop. Defines what "instant" means (same-frame feedback, no async boundary on interaction paths), the millisecond budgets, the hard invariants, and the per-interaction render allowances, and doubles as a review checklist. Use this whenever the user starts a new app and says it should be fast, instant, snappy, "no loading times", "like Linear", local-first, or offline-capable; whenever a change adds a spinner, skeleton, `await` in an event handler, lazy route, or fetch-on-navigate; and whenever reviewing a diff in an app that already adopted this contract. Entry point for the instant-* skill set — read it first, then follow its pointers to instant-store, instant-startup, instant-perf-harness, and instant-sync-choice.
---

# Instant app contract

An app feels instant because of one rule, not because of a language or framework:

> After startup, no user interaction is allowed to wait on anything asynchronous.

Rust, SQLite, Tauri, WASM — none of those make an app fast. An app written in plain React is instant when the rule holds and sluggish when it does not. Everything below is that rule made specific enough to build against and to review against.

Startup is the one place expensive work is allowed. Spend the budget there deliberately (see `instant-startup`), then never pay again.

## What "instant" means

Same-frame feedback with no visible intermediate state. The user's input and the painted result share one event task and one frame. A spinner that shows for 40 ms is not "fast", it is a broken contract — the fix is never a faster spinner, it is removing the wait.

## Budgets

Measure on a production build on fixed hardware (see `instant-perf-harness`). Dev builds lie.

| Interaction | Target |
| --- | --- |
| Selection feedback (row, item, tab) | Same event task, no async boundary |
| Switching the main view to cached content | P95 < 8 ms, max < 16.67 ms |
| Command palette open | P95 < 8 ms |
| Create, move, reorder, complete | P95 < 8 ms |
| Keystroke to paint | P95 < 8 ms, max < 16.67 ms |
| Drag frame | max < 16.67 ms |
| Main-thread task during navigation | none above 8 ms |
| Dropped frames across 100 rapid switches | zero |

8 ms is half a 60 Hz frame: it leaves the browser the other half for style, layout, and paint. 16.67 ms is the hard ceiling because beyond it a frame is visibly dropped.

## Hard invariants

Each of these exists because it was the cause of a real regression.

- No network request, IPC call, or database read during navigation. Navigation reads memory.
- No parsing or expensive derivation during navigation. Derive at write time or startup, cache the result.
- No route, component, or editor chunk loaded after startup. Lazy loading trades a one-time startup cost for a recurring interaction cost — the wrong trade here.
- No component remount on navigation. Keep one persistent host and swap its state; a remount throws away DOM, focus, scroll, and warmed-up internals.
- No skeleton or spinner for content that is already cached. Skeletons are for the first cold load only.
- No shell re-render from typing, dragging, or selection. High-frequency interaction stays inside the component that owns it.
- No broad store subscription where a selector can express the dependency.
- No awaited work between the user's input and the local state update. Update locally, paint, then queue the durable work.
- No profiling or render-scanning instrumentation in production bundles.
- Rendered DOM for lists is bounded by the viewport, not by data size.

## Render allowances

For each interaction, this is the complete list of what may re-render. Anything else rendering is a regression **even if the frame budget still passes** — budgets pass on a fast dev machine long after the architecture has started to rot.

| Interaction | Allowed React work |
| --- | --- |
| Typing in an input/editor | That input's own view only |
| Drag | The dragged component only; one state commit when the gesture ends |
| Selecting an item | Previous row, next row, and direct consumers of the selection |
| Editing one field | Consumers of that field only |
| Command palette query | The palette result surface only |
| Toggling a task complete | That row, plus counters that actually changed value |

A component that renders identical output is a bug. Fix the subscription, do not reach for `memo` first — `memo` hides a too-broad subscription instead of removing it.

## Review mode

When reviewing a diff in an app under this contract, walk the interaction paths the diff touches and ask:

1. Is there an `await`, `.then`, `fetch`, `invoke`, `import()`, or query hook between the event handler and the visible result? If so the local update must come first and the wait must move behind it.
2. Does any new subscription select more than it renders? `useStore((s) => s)` or selecting a whole collection to read one field re-renders on every unrelated change.
3. Does a new selector return a fresh object or array each call? That defeats equality and re-renders every time. Select primitives or stable references, or pass an equality function.
4. Is anything conditionally mounted that used to be persistent (ternary swapping two editors, keyed remounts, route-level `Suspense`)?
5. Did a loading, pending, or skeleton state appear on a path that has cached data? Check that empty states key off "loaded and empty", not "not loaded yet" — that mix-up produces empty-state flashes.
6. Is derived state being synchronised with an effect instead of computed during render? That costs an extra commit per change.
7. Does a list render every item? Above a few hundred rows it needs a viewport-bounded row pool.
8. Does a failed write surface anywhere? Optimistic UI without visible failure handling silently loses data.

Report findings as: the interaction path, which invariant it breaks, and the smallest change that restores it.

## Known traps

- **StrictMode and refs**: a `mountedRef` set in an effect cleanup and never re-armed on the second mount silently disables whatever it guards. Re-arm it at the top of the effect.
- **`isPending` vs `isLoading`**: treating "no data yet" as "empty" flashes the empty state before cached data lands.
- **Native `<dialog>` top layer**: anything that must appear above a modal dialog has to be rendered inside it or hoisted to the shell; z-index cannot beat the top layer.
- **Focus inside scrollers on Chromium 144+/WebView2**: an autofocused input inside a scroll container can lose focus on open. Focus explicitly after mount.
- **Reordering**: integer positions force rewriting every sibling. Use fractional indexing (a sortable string key per item) so a move writes one record.
- **Ghost rows**: a cache restore racing a server response can resurrect deleted items. Deletions need tombstones or revision checks, not just absence.
- **Hidden tabs**: `requestAnimationFrame` is throttled in background tabs, so frame measurements taken there are meaningless.

## Where to go next

- State layer and optimistic writes → `instant-store`
- Boot sequence, auth without a loading screen, bundling → `instant-startup`
- Proving the budgets with numbers → `instant-perf-harness`
- Picking how data reaches the server → `instant-sync-choice`
