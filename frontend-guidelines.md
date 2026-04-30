# Frontend build guidelines

Rules from `a.mdx`, Emil, Vercel React, and frontend-design.

## Visual

Build production UI with a deliberate point of view, never generic AI output.
Use a neutral, dark-compatible palette: background, foreground, border, muted,
and one restrained accent. Ban pure black, white focus states, neon glow,
oversaturated accents, purple-blue gradients, glassmorphism, large radius,
heavy shadows, decorative blur, and custom cursors. Shadows must be
background-tinted.

Choose typography deliberately. Ban Inter, Arial, Roboto, system fonts, Times
New Roman, Georgia, and Garamond. Avoid filler hero copy, gradient text, fake
metrics, fake round numbers, fake uptime, generic names, startup-slop names, and
AI phrases. Unknown data is `[metric]`.

## Layout

Every element needs a clear spatial zone. Don't overlap content or stack
absolute-positioned text over UI. Centered heroes are banned for high-variance
projects; use split screens, left alignment, asymmetric whitespace, or dense
layouts. Ban three-equal-card rows; use zig-zags, grids, tables, dividers,
horizontal scroll, or grouped whitespace.

Use CSS Grid before Flexbox math; don't use `calc()` hacks. Constrain wide
screens with max widths such as `1400px`. Use `min-h-[100dvh]`, never
`h-screen`. Below `768px`, columns collapse to one column. Mobile horizontal
overflow is failure. Headlines use `clamp()`, body text is at least `1rem` or
`14px`, tap targets are at least `44px`, and desktop nav becomes a mobile menu.
Dense dashboards prefer `border-t`, `divide-y`, grouping, and negative space.

## React and code

Prefer `function Component()` and `function handleSubmit()`. Use arrow
constants only for memoized values, caches, or callbacks. Keep types short; one
local prop type must be `Props`. Don't add comments like `// types` or
`// header`.

Prefer DRY/SOLID composition, small components, and shared utilities. Forms need
labels above inputs, helper text, errors below inputs, and `gap-2` groups. Use
`useTransition`, `useOptimistic`, and `useActionState` where they fit. Derive
booleans during render, use functional `setState`, hoist non-primitive defaults,
split hooks by dependency, avoid inline components, and use refs for transients.

## Performance

Eliminate waterfalls: check cheap sync conditions before awaits, start promises
early, await late, use `Promise.all()`, and stream with Suspense. Protect
bundles: import directly, avoid barrels, keep paths analyzable, dynamically
import heavy components, defer analytics, load feature modules only when
activated, and preload on hover/focus when useful.

Server: authenticate actions, use `React.cache()` for per-request dedupe, use
LRU only for safe cross-request data, hoist static I/O, avoid mutable module
state, and minimize serialized props. Client: dedupe requests, use passive
scroll listeners, share global listeners, version `localStorage`, and keep
storage small. Hot paths use early returns, `Set`, `Map`, hoisted regexes,
cached storage reads, combined loops, and idle callbacks.

## Animation

Animation must earn its place. Never animate keyboard actions or interactions
used hundreds of times per day. Reduce frequent hover/list motion. Occasional
modals, drawers, toasts, and state changes can animate; rare onboarding can be
richer. Purpose must be spatial consistency, state indication, explanation,
feedback, or avoiding jarring changes.

Use `cubic-bezier(0.23, 1, 0.32, 1)` for ease-out,
`cubic-bezier(0.77, 0, 0.175, 1)` for movement, and
`cubic-bezier(0.32, 0.72, 0, 1)` for drawers. Ban `ease-in` for UI entrances.
Keep UI motion under `300ms`: press `100-160ms`, tooltips/popovers `125-200ms`,
dropdowns `150-250ms`, and modals/drawers `200-500ms`. Deliberate press can be
slow; release must be fast.

Animate `transform` and `opacity` first. Use CSS transitions for retriggered UI,
CSS or WAAPI for predetermined motion under load, and JS or springs for
gestures. In Framer Motion, prefer full `transform` strings over `x`, `y`, or
`scale` under load.

Pressables need `scale(0.97)`, `scale(0.98)`, or `-translate-y-[1px]`. Never
animate from `scale(0)`; start near `scale(0.95)` with opacity. Popovers
transform from their trigger; modals stay centered. Tooltips need initial delay,
then instant adjacent tooltips. Use `@starting-style` when available.

Gestures need momentum dismissal around `0.11 px/ms`, pointer capture,
multi-touch protection, damping, friction, percentage `translateY()`,
`clip-path: inset()` reveals, `30-80ms` stagger, `prefers-reduced-motion`, and
gated hover.

## States and review

Build skeletons matching final layout, empty states, inline errors, disabled
states, subtle focus, and active states. Avoid generic circular spinners. Before
shipping, check for `transition: all`, `scale(0)`, `ease-in`, motion over
`300ms`, ungated hover, center-scaling popovers, mobile overflow, fake data,
generic cards, waterfalls, barrels, duplicate listeners, and excess
serialization.
