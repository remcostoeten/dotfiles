---
name: animated-icons
description: Add hover animations to app icons (sidebar rows, nav items, toolbar buttons, menu items) the way ~/dev/skriuw does it, from any icon source (lucide, heroicons, tabler, phosphor, Material, Fluent, react-icons, custom SVGs). Each icon rests as its exact static drawing and plays a short one-shot motion on pointerenter of its button, built from named SVG parts and played with the Web Animations API, so nothing is ever drawn on, faded in or animated from zero and the UI never flashes. Several motion options are designed per icon and published in an Artifact where the user plays them, picks one and chooses to keep, rework or redo it. Use this whenever the user wants animated icons, icon hover motion, "animate the sidebar icons", icons that move on hover, icons "like skriuw", or complains that icon animations flash, blink, redraw or pop in on mount or hover, even if they never say skriuw, WAAPI or motion.
---

# Animated icons

Icons that move on hover and never flash, from any icon source. The approach comes from skriuw (`~/dev/skriuw`, ADR-0049, `apps/workspace/src/shared/icons`) and was first applied to the `next-app` sidebar. The reference implementation is in `assets/app-icon/`.

## The contract

These rules are what make the result feel right. Break one and the flashing comes back.

- **At rest the icon is its exact static drawing.** Motion plays over it and ends on it. Nothing is hidden, drawn on or faded in to get there.
- **Never animate from zero.** No `pathLength: 0 → 1` draw-on, no `opacity: 0 → 1`, no `scale: 0 → 1` on a visible part. Those begin from an empty frame, so the icon blinks out the moment the pointer enters. Every keyframe is a pose relative to rest (translate, rotate, scale about an origin) and the first and last keyframe of every visible part are the identity.
- **One shot, on the host.** Play once on `pointerenter` of the enclosing button, link or label, not the glyph. A 16px icon inside a 36px row should animate when the row is hovered. Ignore a second enter while a run is live.
- **Motion is data, playback is generic.** An icon is a list of named parts plus tracks (keyframes, duration, delay, easing token, origin). One runner turns tracks into Web Animations. No per-icon components, no React state, no re-render on hover, no animation library.
- **Parts that exist only during motion** (a glint, a ripple) are clipped inside the icon and hidden at rest, and are switched on only while the run is live.
- **Respect `prefers-reduced-motion`** unless the app has its own animation setting.

## What is bundled

| Path | Use |
| --- | --- |
| `assets/app-icon/icon-motion.ts` | Pose, track and part types, easing tokens, `resolvePose`, `cssTransform` |
| `assets/app-icon/icon-registry.ts` | The icon table (parts, tracks, optional `viewBox`, `paint`, `strokeWidth`) with eight worked examples. Replace the entries, keep the helpers (`pop`, `tile`, `slide`, `bar`, `lift`) you still use |
| `assets/app-icon/play-icon-motion.ts` | The WAAPI runner |
| `assets/app-icon/app-icon.tsx` | `AppIcon`: renders parts for stroke or fill icons, binds hover to the host |
| `assets/app-icon/icon-motion.test.ts` | Data integrity tests |
| `assets/review-gallery.html` | The review page template used by `build-gallery.mjs` |
| `scripts/svg-parts.mjs` | Turns an SVG file, SVG markup or a lucide icon into part paths, with `--split` for single-path glyphs |
| `scripts/build-gallery.mjs` | Builds the review page from the registry and the extra options |
| `scripts/rest-diff.js`, `scripts/frame-overlay.js` | Browser snippets: pixel-diff against the original, scrub frames |
| `references/geometry-sources.md` | Getting parts from any source, reading its style, splitting single paths |
| `references/review-loop.md` | Designing options, publishing the gallery, reading the picks, applying them |

## Workflow

1. **Survey.** Find where icons are drawn and which sit in interactive hosts. Animate nav rows, toolbar buttons and menu items. Leave brand marks and decorative icons static. Read the repo's own rules first (the templates follow Remco's `generic-program-rules`: function declarations, no comments, JSDoc on exported helpers, the `@/` alias).
2. **Copy the template** from `assets/app-icon/` into the project's shared components folder. Adapt the `cx` import and the alias in `app-icon.tsx`. Add `"use client"` only if the project's import boundary needs it.
3. **Get the geometry** from whatever the project uses, with `scripts/svg-parts.mjs`. See `references/geometry-sources.md` for files, packages, components, DOM, `--split` and how to read the style into `viewBox`, `paint` and `strokeWidth`.
4. **Split into parts** so that drawing all of them at identity equals the original icon exactly. Name parts after what they are (`tower`, `flap`, `barTall`).
5. **Design the motion as options.** Write two or three genuinely different options per icon, not one. The best goes into the registry, the others go into a scratch options file. See the recipes below and `references/review-loop.md`.
6. **Wire it in.** Replace the old icon element with `<AppIcon name="..." />` and change the data type that held the icon component to the `IconName` union, so the compiler checks every name. Check that the default 16px size and the resting look match the old icon.
7. **Verify**, below.
8. **Publish the review gallery** and run the pick, rework and redo loop in `references/review-loop.md`. Do this by default. The user judges motion by eye, so give them every option to play instead of describing them.

## Motion recipes

Each was written for 24 unit stroke icons and checked as paused frames at 5x size, not tuned by feel at 16px. Copy the shape, then adjust the numbers by eye. For other viewBoxes scale offsets by `viewBox width / 24`.

| Icon shape | Recipe |
| --- | --- |
| Nodes joined by lines (share) | Nodes dip and pop: scale `0.8 → 1.12 → 1`, `out`, stagger 110ms. Keep the peak at or below 1.12 so line caps do not show inside a ring |
| Checklist (tasks) | Ticks dip and pop with a small tilt (`rotate -10`) about their elbow. Lines slide `x +1.6` with `spring`, staggered 110ms |
| Bars (chart) | Each bar `scaleY 0.45 → 1.1 → 1` about the baseline, staggered 80ms. Alternative: each bar hops `y -1.2` |
| Tiles (dashboard) | Each tile drifts about 1.2 units diagonally outward with `spring`, staggered 40ms. Alternative: a clockwise pulse |
| Flap, lid, door (mail, building) | Scale from the edge the part is attached to. Move parts that ride on it (windows) with matching `y`. Alternative: the flap folds open with `scaleY` through negative |
| Magnifier (search) | Lens and handle share one wobble track. The glint is a short arc, `hiddenAtRest`, nested in the lens with a `window` of the lens interior, sweeping the diagonal |
| Chevrons, arrows | The halves move apart about 1.6 units with `out`, together or as a relay |
| Symmetric glyphs (plus, close, gear) | Skriuw rotates these to an angle the drawing is symmetric under (`endsOnSymmetry`). The template does not support that, its runner and test assume the last keyframe is the identity, so use an out-and-back rotation (`rotate 0 → 25 → 0`, `spring`) instead |

A part joined to a static neighbour must not translate away from it. Scale it from the joined end, or give the neighbour the same track. Scaling also scales stroke width, so big scales on thin strokes look heavy. Durations 600 to 900ms. Easing tokens: `out` to settle, `spring` for a bounce, `inout` for travel.

## Verify

1. `tsc --noEmit`, the project's linter and formatter, and the bundled test (`vitest run --maxWorkers=2 <path>`).
2. With the dev server running, open the page in the browser and run the snippets through `javascript_tool`. Edit `NAMES` (and `REFERENCE` for `rest-diff.js`) at the top of each first. `REFERENCE` holds the original markup per icon.
   - `rest-diff.js` should report `maxAlphaDiff: 0` for rect and path icons. Icons containing a `<circle>` show about 80 at hairline pixels because Chrome rasterizes `<circle>` slightly differently from the equivalent path arcs. That is not a geometry bug, judge it by eye.
   - `frame-overlay.js` moves the icons into a large overlay and pauses them. Call `__t(0)`, `__t(300)`, `__t(450)`, `__t(<totalMs>)` and screenshot each. The first and last frame must look identical, the middle ones must look distinct, and nothing may detach from its neighbour. Reload the page afterwards, the overlay detaches React nodes.
   - Hover a real row with the pointer, then read `svg.dataset.iconPlaying`. It is `"true"` during the run and gone about a second later, with no `visibility="visible"` left on any `[data-icon-extra]`.
3. `javascript_tool` returns an un-awaited Promise as `{}`. Use top-level `await`, not an async IIFE. Close any tab you opened.
