# NextFaster application-level patterns

Patterns extracted from NextFaster (https://next-faster.vercel.app, github.com/ethanniser/NextFaster) — the well-known "instant navigation" e-commerce demo. These sit *on top of* the framework stack in SKILL.md: partial prefetching warms the RSC payload, but images, third-party scripts, and the image optimizer cache are not covered by it. That's the gap these patterns close.

Apply them only when the fit criteria in SKILL.md pass. Each section states its own prerequisite.

## 1. Image-prefetching Link

**Fit:** the app has image-heavy navigation targets (product cards → detail pages, album art, thumbnails → full views). Skip for text-heavy sites — it adds a client component and an API route for no visible gain.

**How it works:** a drop-in `Link` replacement that (a) prefetches the route when the link enters the viewport for 300ms, (b) fetches the *list of image URLs on the target page* from an API route and caches it, (c) on hover, warms those images into the browser cache with `fetchPriority: "low"`, and (d) on mousedown navigates immediately instead of waiting for mouseup — saving ~100ms of perceived latency per click.

The API route fetches the target page's own HTML server-side, parses it with `linkedom` (install it: `pnpm add linkedom`), and returns the `<main> img` attributes. It's cacheable, so repeated prefetches of the same route are free.

### `components/ui/prefetch-link.tsx`

```tsx
'use client';

import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

type PrefetchImage = {
  srcset: string;
  sizes: string;
  src: string;
  alt: string;
  loading: string;
};

async function fetchManifest(href: string): Promise<PrefetchImage[]> {
  if (!href.startsWith('/') || href === '/') return [];
  const url = new URL(href, window.location.href);
  const res = await fetch(`/api/prefetch-images${url.pathname}`, { priority: 'low' });
  if (!res.ok) {
    if (process.env.NODE_ENV === 'development') throw new Error('Failed to prefetch images');
    return [];
  }
  const { images } = await res.json();
  return images as PrefetchImage[];
}

const warmed = new Set<string>();
const manifestCache = new Map<string, PrefetchImage[]>();

function warmImage(image: PrefetchImage) {
  if (image.loading === 'lazy' || warmed.has(image.srcset)) return;
  const img = new Image();
  img.decoding = 'async';
  img.fetchPriority = 'low';
  img.sizes = image.sizes;
  warmed.add(image.srcset);
  img.srcset = image.srcset;
  img.src = image.src;
  img.alt = image.alt;
}

export const Link: typeof NextLink = (({ children, ...props }) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (props.prefetch === false) return;
    const el = linkRef.current;
    if (!el) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          timeout = setTimeout(() => {
            router.prefetch(String(props.href));
            const href = String(props.href);
            if (!manifestCache.has(href)) {
              void fetchManifest(href).then(
                (images) => manifestCache.set(href, images),
                console.error,
              );
            }
            observer.unobserve(entry.target);
          }, 300);
        } else if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
      },
      { rootMargin: '0px', threshold: 0.1 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timeout) clearTimeout(timeout);
    };
  }, [props.href, props.prefetch, router]);

  return (
    <NextLink
      ref={linkRef}
      prefetch={false}
      onMouseEnter={() => {
        router.prefetch(String(props.href));
        for (const image of manifestCache.get(String(props.href)) ?? []) {
          warmImage(image);
        }
      }}
      onMouseDown={(e) => {
        const url = new URL(String(props.href), window.location.href);
        if (
          url.origin === window.location.origin &&
          e.button === 0 &&
          !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
        ) {
          e.preventDefault();
          router.push(String(props.href));
        }
      }}
      {...props}
    >
      {children}
    </NextLink>
  );
}) as typeof NextLink;
```

Notes when adapting:
- Exclude routes that are per-user or mutate state (NextFaster excludes `/order`); prefetching those wastes work or leaks personalization into a shared cache. Add the app's own exclusions to the guard in `fetchManifest`.
- `prefetch={false}` on the inner `NextLink` is deliberate: this component *owns* prefetch timing (viewport + 300ms dwell) instead of Next's default, so long lists don't blast out hundreds of prefetches.
- If the app already has a custom nav-link component, merge this into it rather than shipping two link wrappers.

### `app/api/prefetch-images/[...rest]/route.ts`

NextFaster's original uses `export const dynamic = "force-static"` — that is the legacy segment config that `cacheComponents` rejects. Under Next 16 the route is left dynamic and the response relies on `Cache-Control` (and the client-side `manifestCache`) instead:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { parseHTML } from 'linkedom';

function getBaseUrl() {
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000';
  if (process.env.VERCEL_ENV === 'production')
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_BRANCH_URL) return `https://${process.env.VERCEL_BRANCH_URL}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? null;
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ rest: string[] }> },
) {
  const base = getBaseUrl();
  if (!base) return new Response('No base URL configured', { status: 500 });

  const href = (await params).rest.join('/');
  if (!href) return new Response('Missing url parameter', { status: 400 });

  const response = await fetch(`${base}/${href}`);
  if (!response.ok) return new Response('Failed to fetch', { status: response.status });

  const { document } = parseHTML(await response.text());
  const images = Array.from(document.querySelectorAll('main img'))
    .map((img) => ({
      srcset: img.getAttribute('srcset') || img.getAttribute('srcSet'),
      sizes: img.getAttribute('sizes'),
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt'),
      loading: img.getAttribute('loading'),
    }))
    .filter((img) => img.src);

  return NextResponse.json(
    { images },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
```

Notes:
- `params` is a Promise in Next 15+ — keep the `await`.
- The selector is `main img`: the target pages must wrap content in `<main>` (they should anyway, for accessibility). Widen the selector only if the app's images genuinely live elsewhere.
- The route fetches the app's *own* pages. If pages require auth, this returns the logged-out variant — fine for public catalogs, useless for gated apps (see fit criteria).

## 2. First-party analytics rewrites

**Fit:** the app uses `@vercel/analytics` and/or `@vercel/speed-insights` and deploys to Vercel. Skip otherwise (self-hosted deployments can't use these endpoints).

Loading analytics from the app's own origin removes third-party DNS + TLS handshakes and dodges ad-blockers that filter by hostname:

```ts
// next.config.ts
async rewrites() {
  return [
    {
      source: '/insights/vitals.js',
      destination: 'https://cdn.vercel-insights.com/v1/speed-insights/script.js',
    },
    {
      source: '/insights/events.js',
      destination: 'https://cdn.vercel-insights.com/v1/script.js',
    },
  ];
},
```

Then point the components at the local paths:

```tsx
<Analytics scriptSrc="/insights/events.js" />
<SpeedInsights scriptSrc="/insights/vitals.js" />
```

(The data-ingestion rewrites NextFaster also has — `vitals.vercel-insights.com` with a `dsn` query param — are account-specific; only replicate those if the user asks, using their own DSN values.)

## 3. Aggressive image-optimizer caching

**Fit:** images are immutable or content-addressed (blob storage URLs, hashed filenames). Skip if the same URL can serve different bytes over time.

```ts
// next.config.ts
images: {
  minimumCacheTTL: 31536000, // 1 year — optimized variants are cached and never re-fetched
},
```

Combine with `remotePatterns` scoped to the exact image host rather than a wildcard.

## 4. What NOT to copy from NextFaster

It's a 2024-era Next 15 codebase; several of its patterns are superseded by the stack in SKILL.md:

- `experimental.ppr` → `cacheComponents`
- its hand-rolled `unstable_cache` wrapper + Vercel KV → `'use cache'` + `cacheTag`/`cacheLife`
- `typescript.ignoreBuildErrors: true` → never copy this
- `export const dynamic = "force-static"` on routes → forbidden under `cacheComponents`
