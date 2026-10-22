# Track C: skeleton fidelity QA

`instant()` proves the shell commits. This proves the shell looks like the page it becomes. The spec captures each route twice per viewport: locked under `instant()` (the skeleton state) and fully loaded. It compares landmark bounding boxes (layout shift) and the pixel diff (structural mismatch), then prints a fix hint per failure so you can loop without a human.

## Run it on the track B rig

Same rules as track B: a production build compiled with `experimental.exposeTestingApiInProductionBuild`, never `next dev`. On a build without the testing API, `instant()` no-ops, both captures are the loaded page, and every route passes with a 0% diff. The spec in `assets/` guards against that twice:

- it fails when the skeleton and loaded captures are byte-identical;
- with `lockProbe` set to a selector for streamed content, it asserts that selector has count 0 under the lock.

Only list routes that actually stream something. A fully static route has no skeleton state to test and trips the identical-capture guard.

## Setup

```bash
bun add -d @next/playwright @playwright/test pixelmatch pngjs
bunx playwright install chromium
```

Copy `assets/skeleton-qa.spec.ts` into the e2e directory and `assets/skeleton-report.ts` next to it. Then add `skeleton-qa.config.ts` at the project root:

```ts
export default {
  routes: ['/', '/products', '/products/shoes'],
  clsThreshold: 2,
  diffThreshold: 0.05,
  viewports: [
    { width: 1280, height: 720, name: 'desktop' },
    { width: 375, height: 812, name: 'mobile' },
  ],
  landmarks: ['nav', 'main', '[role="complementary"]', 'footer'],
  settleTime: 1000,
  lockProbe: '[data-testid$="-content"]',
}
```

Use concrete paths, not `[slug]` patterns. Landmarks need to exist in both states; give fallbacks a real wrapper element, since Playwright cannot measure a `display: contents` or fragment fallback.

## The loop

```bash
bunx playwright test e2e/skeleton-qa.spec.ts
bunx tsx e2e/skeleton-report.ts
```

The spec prints one block per route and viewport:

```
--- FAIL [desktop] /products ---
Pixel diff: 18.3% (threshold: 5.0%)
CLS violations: 2
  SHIFT: main moved (0px, 45px), size delta (0px, 600px)
    Fix: Skeleton height for main is off by 600px. Add min-height or aspect-ratio to the skeleton container to reserve space.
  SHIFT: footer moved (0px, 580px), size delta (0px, 0px)
    Fix: footer shifts 580px vertically. An element above it likely changes size; check skeleton heights of preceding elements.
```

The report script reads every `test-results/skeleton-qa/**/report.json`, prints a combined summary, and writes `combined-report.json`. Fix the fallback, rebuild, re-run, until every route passes: zero landmark shifts above `clsThreshold` and pixel diff under `diffThreshold`.

## Where the fix goes

Fallbacks live in `loading.tsx`, inline `<Suspense fallback>`, or a component's colocated `*Skeleton`. Fix the existing one; the track B rule still applies, never author a fresh page-mirroring skeleton. The durable fix is usually structural: one responsive component renders both the live UI and the shell, with the skeleton only in its data slots, so the layout cannot drift between the two.

| Symptom | Likely cause | Fix |
|---|---|---|
| Footer or later landmarks shift down by hundreds of px | skeleton reserves too little height | `min-height` or `aspect-ratio` on the skeleton container matching typical content |
| A landmark exists in one state only | fallback omits a sidebar or panel, or renders it at another width | hoist the panel above the boundary; if it needs data, keep its frame in the shell and stream only its contents |
| Horizontal shift | fallback doesn't mirror the grid or flex structure | render the real layout component with skeleton slots |
| Whole layout shifts, not just page content | data fetched at the top of `layout.tsx` while `loading.tsx` only wraps the page slot | move the read into a Suspense child inside the layout |
| Small shifts on every text element | web font swap after the skeleton paints | `next/font` (it applies `size-adjust` fallbacks); `display: 'optional'` when the shift still matters |
| Image areas collapse then expand | images without dimensions | `width`/`height` on `next/image`, `aspect-ratio` boxes in the skeleton |
| High pixel diff, no landmark shifts | internal structure differs while frames line up | compare `diff.png`; usually missing rows, wrong card count or wrong colors |
| Fails only on mobile | skeleton frozen to the desktop breakpoint | same responsive component for live UI and shell; never a desktop-only skeleton |

## Reading the pixel diff

The diff is changed pixels over total pixels, with `pixelmatch` at threshold 0.1.

- under 5%: content differences only (text, images); layout matches.
- 5 to 15%: structural differences; open `diff.png`.
- 15 to 30%: the skeleton is missing major structure.
- over 30%: skeleton and loaded page are different layouts.

Raise `diffThreshold` for content-heavy pages, lower it for predictable commerce grids. Landmark shift uses a 2 px threshold to absorb sub-pixel rendering. Always test at least one desktop and one mobile viewport; responsive grids, sticky headers and font sizes make shifts breakpoint-specific.

## How this differs from Core Web Vitals CLS

Web Vitals CLS measures shifts a user experiences across the page lifecycle. This measures one specific shift: skeleton layout versus loaded layout, which is what a user perceives when a Suspense fallback is replaced by streamed content. A route can have good field CLS and still fail here when the stream usually arrives before first paint on fast connections.
