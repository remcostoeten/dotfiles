---
name: nextjs-blazing-fast
description: Migrate a Next.js app to the modern performance stack — React Compiler, Cache Components ('use cache' + cacheTag/cacheLife), Suspense streaming, inlined critical CSS, typed routes, partial prefetching, View Transitions, plus NextFaster-style application tricks (viewport/hover image-prefetching links, first-party analytics rewrites, long image-optimizer TTLs). Includes an architecture-fit assessment, so use it to answer "does this app qualify for the fast stack?" across any Next.js repo. Use this whenever the user wants to make a Next.js site faster, mentions slow load times, poor Lighthouse/Core Web Vitals scores, TBT/LCP/TTI problems, ISR or caching strategy, or asks about `cacheComponents`, `'use cache'`, `reactCompiler`, `partialPrefetching`, or upgrading to Next 16+. Also use it proactively when reviewing a Next.js app that still relies on `export const revalidate` / `dynamic` route segment configs, since those are the legacy pattern this replaces. Do not use it for non-Next.js frameworks or for pure runtime profiling with no code changes (use the web-perf skill for measurement).
---

# Making Next.js apps blazingly fast

This skill encodes a migration to the Next 16+ performance stack. The features are individually simple to turn on — the hard part is that `cacheComponents` makes the build *strict* about things that used to pass silently, so enabling it surfaces a cascade of errors in existing code. Most of this skill is about recognizing and fixing those, because that's where the time actually goes.

Reference implementation: `~/dev/performance-demo` (a Next 16.3-canary showcase app). Read its `next.config.ts`, `features/*/\*-queries.ts`, and `components/ui/nav-link.tsx` when you need a concrete example of a pattern below.

## Architecture fit — check before starting

This migration pays off on some apps and is wasted (or harmful) on others. Assess first and tell the user the verdict; don't silently migrate an app that doesn't fit.

**Good fit** (proceed):
- App Router (`app/` directory). The Pages Router cannot use any of this — stop and say so.
- Server Components doing data reads (DB, `fetch`, fs) that are shared across users or cacheable per-user.
- Content that tolerates *some* staleness — catalogs, feeds, articles, dashboards with minute-level freshness.

**Partial fit** (migrate what fits, skip the rest):
- Heavily personalized apps: the shell + shared data get `'use cache'`, per-user reads get `'use cache: private'` or stay dynamic behind Suspense. Still worth it.
- Apps on stable Next: everything except the canary-only features in step 6.

**Poor fit** (recommend against, explain why):
- Pages Router with no migration appetite.
- Hard-realtime data where any caching is a correctness bug (trading, live ops) — Suspense streaming still helps, but skip the caching layer.
- Apps where the bottleneck is measurably elsewhere (huge client bundles, slow third-party scripts): measure first with the web-perf skill; this stack won't fix a 2MB hydration payload.

State the verdict per-area, not just per-app: "caching fits your catalog pages but not your live order board" is the useful shape of answer.

## The mental model

The old model was "pages are dynamic by default; opt into caching with `export const revalidate`". The new model inverts this: **everything is static by default, and you explicitly mark the dynamic holes.** A page becomes an instantly-served static shell with server-streamed dynamic content filling in behind Suspense boundaries.

That inversion is why the build starts failing. Under `cacheComponents`, any uncached data access or nondeterministic value (`Date.now()`, `Math.random()`, `cookies()`) that isn't either cached or wrapped in Suspense is now a hard error — because it would silently block the whole page from prerendering. The errors are the feature working.

## Migration order

Work in this order. Each step's build errors are easier to diagnose when the previous steps are already clean.

### 1. Turn on the cheap wins first

```ts
// next.config.ts
const nextConfig: NextConfig = {
  reactCompiler: true,      // auto-memoization; kills manual memo/useMemo/useCallback churn
  cacheComponents: true,    // the big one — see below
  typedRoutes: true,        // type-checked hrefs
  experimental: {
    inlineCss: true,        // inlines critical CSS, removes a render-blocking request
  },
}
```

Install `babel-plugin-react-compiler` as a dev dependency. `reactCompiler` and `inlineCss` are essentially free — they rarely break anything.

`typedRoutes` will fail typecheck on every dynamically-constructed `href`. Fix with `import type { Route } from 'next'` and cast: `href={someString as Route}`, `router.push(path as Route)`. This is mechanical and safe to delegate to a subagent if there are many.

### 2. Delete legacy route segment configs

`cacheComponents` is incompatible with these and will error on each one:

```bash
grep -rn "^export const \(revalidate\|dynamic\|runtime\|fetchCache\)" src/app
```

Delete them all. Their intent gets re-expressed as `'use cache'` + `cacheLife` in step 3. Two things to flag to the user rather than silently changing:

- Dropping `runtime = 'edge'` moves that route to the Node runtime. Usually fine, but say so.
- `dynamic = 'force-dynamic'` on a route means someone wanted it uncached. Under the new model that's the default, so deleting it is usually correct — but check that the route isn't relying on it for correctness.

### 3. Cache the data layer with `'use cache'`

Put the directive at the top of the *function that reads data*, not on the page. Tag it so writes can invalidate it, and give it a lifetime:

```ts
import { cacheLife, cacheTag } from 'next/cache'

async function getResolvedBlogPosts() {
  'use cache'
  cacheTag('blog-posts')
  cacheLife('hours')   // 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'max'
  // ...db reads, fs reads, fetches
}
```

Tag granularity is the design decision that matters. Tag by the entity that gets written, so a write invalidates exactly what it should: `blog-posts`, `` `post-${slug}` ``, `` `favorites:${userId}` ``. The reference repo's `features/*/\*-queries.ts` files are worth reading for how far to take this.

Then invalidate at the write sites, in server actions:

```ts
import { updateTag, revalidateTag } from 'next/cache'

updateTag('blog-posts')       // synchronous, read-your-writes — use in the action that did the write
revalidateTag('blog-posts')   // eventual — use from webhooks/route handlers
```

Reach for `updateTag` in a server action when the user must see their own change immediately after it commits. That's the common case.

**Not every write should invalidate.** High-frequency, low-stakes writes (view counters, analytics pings) should *not* bust the cache — let them ride the normal cache lifetime. Busting a cache on every pageview defeats the entire point.

For per-user, cookie-dependent reads there's `'use cache: private'`, which caches per-session rather than globally. Use it for things like the current user's identity; never for anything shared.

### 4. Wrap uncached/dynamic work in Suspense

When the build says *"Uncached data was accessed outside of `<Suspense>`"*, it's telling you that something (usually an auth check reading `cookies()`, or a DB call you chose not to cache) is blocking the whole route from prerendering.

The fix is to push the dynamic work into a child component and stream it:

```tsx
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  )
}

async function AdminShell({ children }: { children: ReactNode }) {
  const isAdmin = await checkAdminStatus()   // reads cookies — dynamic
  if (!isAdmin) redirect('/')
  return <div>{/* ... */}</div>
}
```

Note the reference repo has **no `loading.tsx` files at all**. It uses explicit `<Suspense>` boundaries with real skeleton fallbacks instead, because that gives you a static app shell with dynamic holes, rather than one whole-page spinner. Prefer that.

### 5. Purge render-time nondeterminism

This is the step that catches people off guard. Under `cacheComponents` these are build errors, because a value that differs between prerender and hydration can't be baked into static HTML.

| Error | Cause | Fix |
|---|---|---|
| ``used `Math.random()` inside a Client Component`` | random ID generation | `useId()` |
| ``used `new Date()` inside a Client Component`` | `new Date().getFullYear()` in a footer, etc. | resolve client-side in `useEffect` behind a stable fallback |
| ``used `new Date()` before accessing uncached data`` (Server Component) | date formatting at render time | wrap the component in `'use cache'`, or move the formatting to the client |

For the current-year case, a small shared hook keeps this from recurring:

```tsx
'use client'
export function useCurrentYear() {
  const [year, setYear] = useState(FALLBACK_YEAR)
  useEffect(() => { setYear(new Date().getFullYear()) }, [])
  return year
}
```

Sweep for these before you start, so they don't surprise you mid-build:
```bash
grep -rn "Math.random()\|new Date()" src --include=*.tsx --include=*.ts
```

### 6. Canary-only features (ask before adopting)

These require `next@canary`. Confirm the user is willing to run canary before doing this — it's a real tradeoff, not a free win.

- **`partialPrefetching: true`** + `export const prefetch = 'allow-runtime'` on partial-prerender routes. Makes navigation feel instant by prefetching the dynamic part too. The reference repo's `components/ui/nav-link.tsx` goes further with hover-gated prefetch — eager prefetch for primary nav, hover/focus-triggered for unbounded lists, so you don't prefetch a hundred links nobody will click. Worth copying if the app has long link lists.
- **`experimental.viewTransition: true`** + `<ViewTransition>` from `react` wrapping the app in the root layout, for native cross-fades between pages. Shared-element morphs need matching `viewTransitionName` on both sides (the reference repo does this for album art → detail page). This is polish, not speed — be honest about that.
- **`experimental.useOffline: true`** + `useOffline()` from `next/offline` for a service worker. Usually overkill for content sites; suggest skipping unless there's a real offline story.

### 7. Application-level tricks from NextFaster (optional layer)

Partial prefetching warms the RSC payload for a navigation, but **not** the images on the target page, third-party script handshakes, or the image-optimizer cache. For apps where those matter — image-heavy navigation (cards → detail pages), Vercel analytics, immutable image URLs — read `references/nextfaster-patterns.md` and apply the patterns whose fit criteria pass:

1. **Image-prefetching Link** — viewport-triggered route prefetch + hover-triggered image warming + mousedown navigation. The biggest perceived-speed win on image-heavy apps.
2. **First-party analytics rewrites** — serve `@vercel/analytics` / Speed Insights from the app's own origin.
3. **`images.minimumCacheTTL: 31536000`** — for immutable/content-addressed image URLs only.

The reference file also lists NextFaster patterns that must *not* be copied (its PPR flag, `unstable_cache` wrapper, `ignoreBuildErrors`), since that repo predates the Next 16 stack.

## Verification

Don't declare victory on a green typecheck. Cache Components errors mostly appear during **prerendering**, which only happens in a real production build:

```bash
<pkg-manager> run build          # must be fully green
<pkg-manager> exec next start -p 4321 &
for p in / /blog /some-dynamic-route; do
  echo "$p: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:4321$p)"
done
```

Then read the build's route table. This is the actual scoreboard:
- `○ (Static)` — prerendered. You want most routes here.
- `◐ (Partial Prerender)` — static shell + streamed dynamic content. Good for routes with real dynamic data.
- `ƒ (Dynamic)` — rendered per-request. Each one of these deserves a "why?"

If a route you expected to be static came out dynamic, something in it is reading uncached data or request state; trace it and either cache it or Suspense it.

## Things worth telling the user

- Which routes ended up static vs. dynamic, and why — this is the concrete result of the work.
- Any behavior change you introduced: dropped edge runtime, changed revalidation windows, a cache that now refreshes hourly instead of per-request.
- If you moved them to canary, say so plainly and note that it needs deliberate version pinning.
- View Transitions are a visual change — suggest they click around in `next dev` and confirm it feels right before deploying.
