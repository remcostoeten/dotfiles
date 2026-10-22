---
name: instant-startup
description: How to design the boot sequence of an instant-feeling authenticated app so there is no loading screen after the first ever visit — one bootstrap that hydrates the whole working set into memory, local snapshot first and server reconcile second, optimistic cached session instead of blocking on an auth round trip, a single eagerly loaded bundle, service worker app shell, and a thin Tauri desktop wrapper. Use this whenever the user is setting up app entry, routing, auth gating, code splitting, PWA/offline shell, or a desktop wrapper for a local-first or "instant" app; whenever the app shows a spinner, splash, or skeleton on reload or on login-protected routes; when cold start or time-to-interactive is the complaint; or when deciding between lazy routes and one bundle.
---

# Instant startup

Startup is the only moment an instant app is allowed to do expensive work, so the goal is twofold: make the first-ever load acceptable, and make every later load show real content on the first paint. The most common way "instant" apps end up slow is not rendering — it is a boot sequence that serially awaits auth, then data, then a route chunk, each behind its own spinner.

## The boot sequence

```text
1. HTML + one JS bundle            from service worker cache after first visit
2. read local snapshot             IndexedDB: session hint, records, pending ops, UI state
3. build store, replay pending ops synchronous once the snapshot is in memory
4. first paint = real content      no skeleton, last view restored
5. background: validate session    401 → sign-out flow
6. background: pull server delta   applied through no-op-preserving reducers
7. background: flush pending ops
```

Steps 5–7 never block 4. On a returning visit the network is not on the critical path at all, which is also what makes the app work offline for free.

On the **first ever** visit there is no snapshot: show one deliberate loading state, fetch the full working set in a single request, write the snapshot, continue at step 3. That is the only loading screen the app has.

## One bootstrap, whole working set

Load everything the user can navigate to into memory at once — for a task app that is every open task, project, label, and member of the active workspace. A few thousand small records are a few hundred KB; holding them is far cheaper than any scheme for fetching them on demand, and it is what makes navigation a memory read.

- One `bootstrap()` call returns one snapshot. Not a waterfall of per-collection queries.
- Bound the working set by product rules, not pagination: archived and completed-long-ago items are fetched on demand behind an explicit "show archived" action, which is allowed to show a loading state because it is not a cached path.
- Normalise and build indexes (by project, by status, rank order) during bootstrap, before first paint, so nothing derives on navigation.
- Persist the snapshot incrementally afterwards (write changed records, not the whole blob) and debounce it; persistence is never on an interaction path.
- Version the snapshot schema. On mismatch, discard and refetch rather than migrating in the client — the server is the authority, the local copy is a cache.
- Restore UI state too: last route, selection, scroll, expanded groups, open panes. Returning to exactly where you were is a large part of perceived speed.

## Auth without a loading screen

Blocking render on a session check puts a network round trip in front of every launch. Instead:

- Store a **session hint** locally next to the snapshot: user id, workspace id, display fields. Not the credential — the credential stays in an httpOnly cookie (web) or the OS keychain (desktop).
- Hint present → render the app from the snapshot immediately and validate in the background. If validation fails, drop to the sign-in surface and clear the snapshot for that account.
- Hint absent → render the sign-in surface immediately. Either way, the first paint is decided synchronously from local data.
- Key snapshots by account id so switching accounts swaps stores rather than leaking one user's cache into another's session, and clear on sign-out.
- The server still authorises every read and write. Optimistic rendering only ever shows the user their own previously fetched data, so it costs nothing in security; it just refuses to make them wait to see it.
- With SSR frameworks, do not gate the app route on a server-side session fetch; that reintroduces the round trip. Serve a static shell and let the client decide.

## One bundle

Route-level code splitting optimises first load at the price of a network wait on first navigation to each route, which breaks the contract. For an app (not a marketing site) prefer:

- A single eagerly loaded chunk for everything reachable by navigation. Measure it; a task app should land well under 300 KB gzipped, and the service worker makes it a one-time cost.
- Lazy-load only what sits behind an explicit, rare, heavyweight action whose wait the user expects — an importer, a chart library, an AI panel — and prefetch it on idle or on hover of its trigger.
- Keep the marketing/landing site a separate build so its concerns never pull the app toward splitting.
- No `Suspense` boundaries on navigation paths. A boundary that can suspend is a loading state waiting to happen.

## Service worker

Precache the HTML shell and the hashed bundle, serve cache-first, update in the background, and apply the update on next launch (or via an unobtrusive "reload to update" prompt). Never let the worker intercept API or sync traffic — stale API responses fight the store. This one step turns every revisit into a zero-network boot.

## Desktop wrapper

For an app whose data model is small structured records, the desktop build should be a **thin Tauri shell around the same web bundle**: same store, same IndexedDB snapshot, same sync. Use Rust only for what the web cannot do — tray, global shortcut, deep links, keychain for the credential, auto-update.

A native Rust domain layer with its own SQLite is justified only when the product genuinely needs it: very large documents, a canonical single-file database users own, filesystem/Git integration, or local end-to-end encryption at rest. It roughly doubles the persistence surface (native adapter + browser adapter + generated contracts between them), so choose it on requirements, not on the assumption that native means fast.

Desktop-specific boot notes: show the window only after first paint (create it hidden, reveal from the renderer, with a ~2 s failsafe) to avoid a white flash; make sure the auth client tolerates the `tauri://` origin; on Linux, WebKitGTK rendering quirks are per-backend — gate workarounds on the detected backend, never globally.

## Checklist

- Reload with the network disabled after one visit: does real content appear on first paint?
- Is there any `await` before the first render on a returning visit other than the local snapshot read?
- Does a first navigation to every route complete with zero network requests?
- Does sign-out clear the snapshot, and does account B never see account A's cache?
- Does a snapshot schema bump recover by refetching rather than crashing?
