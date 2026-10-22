# Track D: server and bundle rules for Next.js

The Next-specific subset of Vercel's React performance rules, rewritten for the Cache Components model. For client re-render, rendering and plain-JS rules, use the `vercel-react-best-practices` skill; it stays the source for those.

Ordered by impact. Waterfalls and bundle size come first because they cost the most.

## Waterfalls (critical)

**Server Components in one tree run sequentially when a parent awaits before rendering children.** Split reads into sibling async components so they start together:

```tsx
export default function Page() {
  return (
    <>
      <Header />
      <Suspense fallback={<Sidebar.Skeleton />}>
        <Sidebar />
      </Suspense>
    </>
  )
}

async function Header() {
  const data = await getHeader()
  return <header>{data.title}</header>
}
```

A parent that does `const header = await getHeader()` and then renders `<Sidebar />` makes the sidebar wait for the header.

**Independent awaits in one function go through `Promise.all`.** With partial dependencies, start every promise first and chain the dependent one off its input:

```ts
const userPromise = getUser()
const profilePromise = userPromise.then((user) => getProfile(user.id))
const [user, config, profile] = await Promise.all([userPromise, getConfig(), profilePromise])
```

**Start early, await late** in route handlers and server actions: kick off `auth()` and config reads on the first line, await where each value is used.

**Defer awaits into the branch that needs them**, and check cheap synchronous conditions before awaiting a flag or remote value:

```ts
if (props.showBeta) {
  const enabled = await getFlag('beta')
  if (enabled) return <Beta />
}
```

**Share one promise across consumers** instead of awaiting in a parent: start the read in the page without awaiting, pass the promise to children inside a `<Suspense>`, unwrap with `use()`. One fetch, and the page frame renders immediately.

## RSC payload (high)

- **Pass only the fields a client component uses.** Everything crossing the server-client boundary is serialized into the HTML and every RSC response. `<Profile name={user.name} />`, not `<Profile user={user} />` for a 50-field row.
- **Don't send the same data twice.** Serialization dedupes by reference. `users` plus `users.toSorted()` or `users.filter(...)` sends the array twice, and for `string[]` every string twice. Derive in the client unless the derivation is expensive or the original isn't needed.
- **Keep heavy libraries on the server.** Markdown parsing, syntax highlighting and date formatting in a Server Component ship zero client JS; doing them in a client component ships the library.

## Caching layers, and which one to use

| Need | Use | Scope |
|---|---|---|
| Data shared across requests that should land in the static shell | `'use cache'` + `cacheTag` + `cacheLife` | per instance; `'use cache: remote'` for durable across instances |
| Per-session cached data (current user) | `'use cache: private'` | per session |
| Dedupe the same DB or auth call within one render | `React.cache(fn)` | one request |
| `fetch` dedupe within one render | automatic | one request |

- `React.cache` compares arguments with `Object.is`. Pass primitives; an inline object argument always misses.
- `React.cache` does not make `cookies()` or a session read shell-safe; it still suspends during prerender (see `shell-patterns.md`, edge cases).
- Hand-rolled LRU caches and `unstable_cache` are superseded by `'use cache'` under `cacheComponents`. Don't add new ones.

## Work after the response (medium)

Logging, analytics, audit trails and notifications go in `after()` from `next/server`, so they don't hold the response:

```ts
import { after } from 'next/server'

export async function POST(request: Request) {
  await save(request)
  after(() => logEvent('saved'))
  return Response.json({ ok: true })
}
```

`after()` runs even when the response fails or redirects, and works in server actions, route handlers and Server Components.

## Server actions are public endpoints (critical, correctness)

Anything with `'use server'` can be called directly, bypassing layouts, middleware and page guards. Validate input, authenticate and authorize inside every action, in that order, before the mutation. This matters more under the static-shell model: deferring an auth gate into a Suspense child (see `shell-patterns.md`) moves the page check to request time, but it never protected the actions in the first place.

## Bundle size (critical)

- **Barrel imports:** icon and component libraries can re-export thousands of modules and cost 200 to 800 ms per cold start. Next optimizes many common libraries automatically; add the rest to `experimental.optimizePackageImports`. Without that, import from the deep path.
- **Heavy, below-the-fold or interaction-only components** (editors, charts, maps): `next/dynamic`, with `ssr: false` only when the component cannot render on the server. Preload on hover or focus of the control that opens them: `onMouseEnter={() => void import('./editor')}`.
- **Feature-gated modules:** `import()` inside the branch that activates the feature, not at the top of the file.
- **Third-party scripts:** analytics, logging and error tracking load after hydration. Either `next/dynamic` the component or use `next/script` with `strategy="afterInteractive"` or `"lazyOnload"`. On Vercel, also serve the scripts first-party (`nextfaster-patterns.md` section 2).
- **Statically analyzable paths:** `import(MAP[key])` with string values and `path.join(process.cwd(), variable)` make the bundler and output file tracing include everything that could match. Use a map of `() => import('./literal')` functions and literal paths per branch.
- **Check the result:** `next build` prints per-route first-load JS. Read it before and after; a route that grew is the regression.

## Client-only values without flicker (medium)

Theme, density and other values that live in `localStorage` or a non-HTTP cookie: don't read them in render (breaks SSR) or in `useEffect` (flashes the default). Set them with a small inline `<script>` in the root layout that writes a `data-*` attribute on `<html>` before hydration, and style from that attribute. Put `suppressHydrationWarning` on `<html>`. This also keeps the root layout static under Cache Components, where reading the cookie on the server would make every route dynamic.

## Images and fonts

- `next/image` with explicit `width` and `height` or `fill` in a sized box, `priority` on the LCP image only, accurate `sizes` on responsive images.
- `next/font` for every web font; it self-hosts and sets `size-adjust` fallbacks so text doesn't shift on swap.
- Long `images.minimumCacheTTL` only for immutable or content-addressed URLs (`nextfaster-patterns.md` section 3).
- Keep the LCP element (usually the main heading or hero image) outside every Suspense boundary so it paints with the shell.
