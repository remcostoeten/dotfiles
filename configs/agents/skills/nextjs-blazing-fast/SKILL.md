---
name: nextjs-blazing-fast
description: Make a Next.js App Router app fast and prove it. Covers the Next 16.3+ stack (Cache Components with 'use cache', cacheTag, cacheLife and updateTag, Suspense streaming, Partial Prefetching, React Compiler, inlined CSS, typed routes, View Transitions), the static-shell refactor patterns that make navigations instant, server and bundle performance rules (waterfalls, RSC serialization, React.cache, after(), barrel imports, next/dynamic), NextFaster-style image prefetching, and the verification loop that proves the result with @next/playwright instant() guards, skeleton CLS and pixel-diff QA, and runtime checks through /_next/mcp. Use whenever the user wants a Next.js site or route faster or instant, mentions slow navigations, loading spinners, skeleton or Suspense fallback quality, layout shift, Core Web Vitals, TBT, LCP or TTI, ISR or caching strategy, cacheComponents, 'use cache', partialPrefetching, prefetch = 'partial', reactCompiler, blocking-prerender build errors, instant() tests, or upgrading to Next 16+. Also use it to judge whether an app fits this stack, and proactively when a Next.js app still uses export const revalidate or dynamic segment configs. Not for non-Next frameworks or the Pages Router; for page-load measurement without code changes use web-perf.
---

# Making Next.js apps blazingly fast

This skill takes an App Router app from "pages are dynamic and wait on data" to "every navigation commits a prerendered shell immediately and streams only per-request data", then proves it with tests that keep it that way.

Three ideas carry the whole skill:

1. **Static by default, dynamic holes explicit.** Under `cacheComponents` everything prerenders unless you mark it. Uncached data, request data and nondeterministic values must be cached or sit behind `<Suspense>`. The build errors this produces are the feature working.
2. **Maximize the static shell.** Hoist everything that renders the same for every request above the boundaries. Push each `<Suspense>` down to the single read it guards. One coarse boundary near the top is the main anti-pattern.
3. **Prove it, don't eyeball it.** An instant route is one whose shell commits under the `instant()` lock on a production build. A good skeleton is one that matches the loaded layout at every breakpoint. Both are tested, and the tests ship.

## Version gate

Check `next` in `package.json` first.

- **16.3+**: everything here applies. `partialPrefetching` is a top-level config key, per-segment opt-in is `export const prefetch = 'partial'`, and `@next/playwright` `instant()` plus `experimental.exposeTestingApiInProductionBuild` exist.
- **Older canary apps** may still use `export const prefetch = 'allow-runtime'`. That is the pre-release spelling; move to `'partial'` when upgrading.
- **Below 16**: upgrade first (`npx @next/codemod upgrade`), then come back. Don't apply these patterns piecemeal on an old version; the verdicts are meaningless there.

## Architecture fit: assess before touching code

Give the user a verdict per area, not per app: "caching fits the catalog pages but not the live order board" is the useful shape.

**Good fit:** App Router; Server Components reading data that is shared or cacheable per user; content that tolerates some staleness (catalogs, docs, feeds, dashboards with minute-level freshness).

**Partial fit:** heavily personalized apps (shell and shared data cached, per-user reads behind Suspense or `'use cache: private'`); apps whose whole page depends on URL data (the shell stays thin; per-link prefetching is the lever, see `references/shell-patterns.md` pattern 10).

**Poor fit, recommend against:** Pages Router with no migration appetite; hard-realtime data where any caching is a correctness bug (Suspense streaming still helps, skip the caching); apps whose bottleneck is measurably elsewhere (a 2 MB hydration payload, slow third-party scripts). Measure with web-perf first in that case.

**Mostly static sites** (marketing, docs, a shell that serves an SPA): the shell is already big. The work is the build route table, bundle rules, image and font hygiene, and skeleton fidelity where anything streams. Say so instead of running the full optimizer loop.

## Pick the track

| The user wants | Track | Read |
|---|---|---|
| Turn on the stack, or fix the build errors `cacheComponents` surfaced | A. Adopt | `references/adopt-cache-components.md` |
| A specific route or navigation to be instant | B. Optimize a route | `references/shell-patterns.md`, then `references/instant-guard.md` |
| Better loading states, less layout shift on stream-in | C. Skeleton fidelity | `references/skeleton-qa.md` |
| General server, bundle and data-fetching speed | D. Server and bundle rules | `references/server-and-bundle.md` |
| Image-heavy navigation, analytics, image cache | E. NextFaster layer | `references/nextfaster-patterns.md` |
| Confirm an edit works in the running app | Dev loop | `references/dev-loop.md` |

Tracks compose in the order A, B, C. D and E are independent and can run any time.

## Track A: adopt the stack (summary)

Order matters; each step's errors are easier once the previous step is clean.

1. **Cheap wins:** `reactCompiler: true` (install `babel-plugin-react-compiler`), `typedRoutes: true`, `experimental.inlineCss: true`. Fix `typedRoutes` errors with `href as Route`.
2. **Delete legacy segment configs:** `revalidate`, `dynamic`, `fetchCache`, `runtime`. Tell the user when this drops an edge runtime or removes a `force-dynamic` someone relied on.
3. **Cache the data layer:** `'use cache'` at the top of the function that reads, with `cacheTag` per written entity and an explicit `cacheLife`. Invalidate with `updateTag` in the server action that wrote (read-your-writes) and `revalidateTag` from webhooks. High-frequency, low-stakes writes do not invalidate.
4. **Turn on `cacheComponents: true`** and work the build errors with `next build --debug-prerender`, scoped by `--debug-build-paths "app/<route>/**"`. Every error links a `nextjs.org/docs/messages/<slug>` page; apply that page's recipe.
5. **Purge render-time nondeterminism** (`Date.now()`, `Math.random()`, `crypto.randomUUID()`): `connection()` plus `<Suspense>` for per-request values, `'use cache'` for values that may be fixed, `useId()` in client components.
6. **Partial Prefetching** (`partialPrefetching: true`) once the app builds clean. View Transitions and `useOffline` are polish, not speed; say so.

Full detail, error table and invalidation design: `references/adopt-cache-components.md`.

## Track B: make a route instant (summary)

Run once per target navigation. The loop is test-driven and the test is the deliverable.

```
- [ ] 0 RIG        production build with the testing API exposed; record it in instant-nav.rig.md
- [ ] 1 BASELINE   unlocked, as the test user: the shell marker renders (scaffold, deleted later)
- [ ] 2 RED        under instant(): the shell does not commit; verify it is red for the right reason
- [ ] 3 FIX        hoist the static, push each Suspense down to the read it guards
- [ ] 4 GREEN      the locked test passes on the production build
- [ ] 5 PARITY     same content, redirects, 404s, client state; only instant-ness changed
- [ ] 6 DIFF       revert only the fix → RED, re-apply → GREEN
- [ ] 7 FIDELITY   skeleton matches loaded layout at desktop and mobile widths (track C)
```

Non-negotiables:

- **Never measure on `next dev`.** It does not prefetch and its lock is unreliable for blocking routes.
- **The measured build must be built with `experimental.exposeTestingApiInProductionBuild`.** Without it `instant()` silently no-ops and every test passes vacuously. Gate it on an env var that is never set for real production, and set it at build time, not start time.
- **`instant()` is a ruler, not a stopwatch.** Assert presence under the lock. No custom timeouts, no retries, no hover-warming.
- **Validates-as-instant is not good-loading-state.** `fallback={null}` passes validation with a blank screen. Every data boundary gets a real skeleton; `null` is only for gates that render nothing on success.
- **Reuse existing loading UI** (`loading.tsx`, a colocated `*Skeleton`, the component's own fallback) before writing a skeleton. Never hand-build a page-mirroring skeleton.

The blocker most often found in real apps: a top-level `await` (params, session, auth gate) in a layout on a route where some dynamic segment lacks `generateStaticParams`. The fix is to render `children` unconditionally and move the await into a Suspense-wrapped child. Recipes for every blocker shape: `references/shell-patterns.md`. Rig, test templates, RED-trust checklist and differential: `references/instant-guard.md`.

## Track C: skeleton fidelity (summary)

`instant()` proves the shell commits; it does not prove the shell looks right. The skeleton QA spec captures the locked state and the loaded state per route and viewport, compares landmark bounding boxes (layout shift) and pixel diff (structural mismatch), and prints a fix hint per failure. It runs on the same production rig as track B. Setup, config and fix patterns: `references/skeleton-qa.md`; spec and report script in `assets/`.

## Verification and the scoreboard

A green typecheck proves nothing here. Cache Components errors appear during prerendering, which only a production build does.

1. `next build` fully green. Read the route table: `○` static, `◐` partial prerender (static shell plus streamed holes), `ƒ` dynamic. Every `ƒ` deserves a reason; a route you expected to be `○` or `◐` that came out `ƒ` is reading uncached or request data at the top somewhere.
2. Track B guards green on the rig, with the differential shown.
3. Track C skeleton spec green at desktop and mobile widths.
4. During development, `references/dev-loop.md` for runtime checks against `next dev`, never as the verdict.

## Report to the user

Speak in what the user sees, not in rig vocabulary:

- One line per navigation: what commits instantly, what streams in, what is still dynamic and why.
- Behavior changes you introduced: dropped edge runtime, a cache that now refreshes hourly, a redirect that now happens at request time.
- Before and after screenshots, or drive the browser, so the user sees the shell commit. Identical before and after means the fix did nothing; roll it back.
- Ask only at genuine forks: a change in behavior, a security-sensitive read, a route that is dynamic by design. With no one to ask, take the safe default (defer behind Suspense rather than guess a `cacheLife`) and note the assumption.

## Reference implementation

`~/dev/performance-demo` (Next 16.3 canary, `cacheComponents`, `reactCompiler`, `partialPrefetching`, `inlineCss`, `viewTransition`, `useOffline`, `typedRoutes`). Read its `next.config.ts`, `features/*/*-queries.ts` for tag granularity and `components/ui/nav-link.tsx` for hover-gated prefetch. It still uses the canary spelling `prefetch = 'allow-runtime'`; write `'partial'` in new code.
