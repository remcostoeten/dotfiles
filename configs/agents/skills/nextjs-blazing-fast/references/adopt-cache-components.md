# Track A: adopting the Next 16.3+ stack

The features are individually simple to turn on. The work is that `cacheComponents` makes the build strict about things that used to pass silently, so enabling it surfaces a cascade of errors. Most of this file is about recognizing and fixing those.

## 1. Cheap wins

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  typedRoutes: true,
  experimental: {
    inlineCss: true,
  },
}

export default nextConfig
```

- `reactCompiler` needs `babel-plugin-react-compiler` as a dev dependency. It auto-memoizes, so manual `memo`, `useMemo` and `useCallback` added only for render performance become noise; leave existing ones unless they cause problems.
- `inlineCss` inlines critical CSS and removes a render-blocking request. Rarely breaks anything. Skip it if the app ships very large global CSS, since every HTML response then carries it.
- `typedRoutes` fails typecheck on every dynamically built `href`. Fix with `import type { Route } from 'next'` and `href={path as Route}` or `router.push(path as Route)`. Mechanical; delegate if there are many.

## 2. Delete legacy route segment configs

```bash
rg -n "^export const (revalidate|dynamic|runtime|fetchCache|dynamicParams)\b" app src/app
```

`cacheComponents` rejects `revalidate`, `dynamic` and `fetchCache`; their intent moves into `'use cache'` plus `cacheLife` in step 3. Flag to the user rather than silently change:

- Dropping `runtime = 'edge'` moves the route to Node.
- `dynamic = 'force-dynamic'` meant someone wanted it uncached. Uncached is now the default, so deleting it is usually correct, but check nothing relied on it for correctness.
- `dynamic = 'force-static'` on a route handler: leave the handler dynamic and set `Cache-Control`, or cache the data function it calls.

## 3. Cache the data layer

Put the directive on the function that reads data, not on the page.

```ts
import { cacheLife, cacheTag } from 'next/cache'

export async function getPosts() {
  'use cache'
  cacheTag('posts')
  cacheLife('hours')
  return db.posts.findMany()
}
```

- **Always choose `cacheLife` explicitly** (`seconds`, `minutes`, `hours`, `days`, `weeks`, `max`, or a custom profile). A bare `'use cache'` silently ships the `default` profile.
- **Tag by the entity that gets written**, so a write invalidates exactly what it should: `posts`, `` `post:${slug}` ``, `` `favorites:${userId}` ``.
- **Arguments are the cache key.** Pass primitives and serializable values; never pass a `cookies()` or `headers()` result into a cached function.
- **`'use cache'` storage is in memory per instance.** On serverless it does not survive across instances. Use `'use cache: remote'` when the shell must be durable across instances.
- **`'use cache: private'`** caches per session for cookie-dependent reads (current user identity). Never use it for shared data.
- **`React.cache` is not this.** It dedupes within one request only, and wrapping `cookies()` or a session read in it does not make the read shell-safe; it still suspends during prerender. Only `'use cache'` keyed on static or param inputs puts data in the shell.

### Invalidation

```ts
'use server'
import { updateTag } from 'next/cache'

export async function renamePost(slug: string, title: string) {
  const session = await verifySession()
  if (!session) throw new Error('Unauthorized')
  await db.posts.update({ where: { slug }, data: { title } })
  updateTag(`post:${slug}`)
  updateTag('posts')
}
```

- `updateTag` in the server action that did the write: read-your-writes, the user sees their own change on the next render.
- `revalidateTag` from route handlers and webhooks: eventual.
- **Not every write invalidates.** View counters, analytics pings and other high-frequency, low-stakes writes ride the normal lifetime. Busting on every pageview defeats the cache.
- After adding or widening a cache, verify a mutation: write, then confirm the next read returns the new value. A passing `instant()` test proves shell readiness, not freshness.

## 4. Enable `cacheComponents` and work the errors

```ts
const nextConfig: NextConfig = { cacheComponents: true }
```

```bash
next build --debug-prerender
next build --debug-prerender --debug-build-paths "app/dashboard/**"
```

Default output is abbreviated and often lacks a usable stack. `--debug-prerender` gives the full failing frame and reports every blocker past the first. Scope rebuilds to the route you are on. Each error prints a `https://nextjs.org/docs/messages/<slug>` link; open it and apply that recipe rather than improvising from the inline message.

| Build message | Cause | Fix |
|---|---|---|
| Uncached data was accessed outside of `<Suspense>` | DB or fetch read not cached, at the top of a page or layout | `'use cache'` it if it can be shared, else push it into a Suspense child (`shell-patterns.md` 1, 3) |
| Runtime data during prerendering | `cookies()`, `headers()`, `await params` of an un-enumerated segment, `searchParams` | start the read without awaiting and pass the promise into a Suspense child (`shell-patterns.md` 1, 2, 4, 5) |
| used `Date.now()` / `new Date()` / `Math.random()` / `crypto` while prerendering | nondeterminism in a Server Component | `await connection()` plus Suspense for per-request values; `'use cache'` for values that may be fixed |
| used `Math.random()` / `new Date()` inside a Client Component | random ids, current year in a footer | `useId()` for ids; resolve the date client-side behind a stable fallback, or render it from a cached server value |
| runtime data in `generateMetadata()` / `generateViewport()` | metadata reads cookies or uncached data | static `metadata` export, `'use cache'` in `generateMetadata`, or a dynamic-marker component (`shell-patterns.md` 7) |

Sweep for nondeterminism before the first build so it doesn't surprise you mid-run:

```bash
rg -n "Math\.random\(\)|new Date\(\)|Date\.now\(\)|crypto\.randomUUID\(\)" app src components --type ts
```

**Escape hatches that are not fixes.** `export const instant = false` opts a segment out of validation while its navigation still blocks. A `<Suspense>` above `<body>` makes the whole route dynamic with an empty shell. Use them only as a deliberate, stated choice for routes that are dynamic by design, or as a temporary scaffold to get a RED building (`instant-guard.md`).

## 5. Partial Prefetching

Once the app builds clean under Cache Components:

```ts
const nextConfig: NextConfig = { cacheComponents: true, partialPrefetching: true }
```

or per segment during an incremental rollout:

```ts
export const prefetch = 'partial'
```

Visible `<Link>`s then prefetch the destination's shared App Shell instead of a full per-URL payload. Audit existing `<Link prefetch={true}>`: under Partial Prefetching it requests the full dynamic payload for that URL, so keep it only where URL-specific content ready before the click is worth the server work. For long link lists, prefer hover or intent triggered prefetch over eager.

Check adoption mechanically:

```bash
rg -n "partialPrefetching|prefetch\s*=\s*['\"](partial|allow-runtime)['\"]" --glob 'next.config.*' --glob 'app/**' --glob 'src/app/**'
```

`'allow-runtime'` is the pre-16.3 canary spelling; replace with `'partial'`.

## 6. Polish features (state the trade-off)

- `experimental.viewTransition: true` with `<ViewTransition>` from `react` in the root layout gives cross-fades between pages; shared-element morphs need matching `viewTransitionName` on both sides. This is a visual change, not a speed change. Ask the user to click around before shipping.
- `experimental.useOffline: true` with `useOffline()` from `next/offline` adds a service worker. Usually overkill for content sites.

## Tell the user

- Route table before and after: which routes are now `○` or `◐`, which stay `ƒ` and why.
- Every behavior change: runtime moved off edge, revalidation windows that changed, freshness that went from per-request to a `cacheLife`.
- Any canary or experimental flag adopted, and that it needs deliberate version pinning.
