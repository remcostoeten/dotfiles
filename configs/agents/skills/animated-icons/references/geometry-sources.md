# Getting geometry from any icon source

The runner needs, per icon, a list of parts (each a path `d` in the icon's own coordinates) and the icon's style (`viewBox`, stroke or fill, stroke width). The source can be any set, a designer's export or a custom drawing. Read the style from the source SVG's header. Do not assume it from the set's reputation, `svg-parts.mjs` prints it for you.

## Get the SVG

| Source | How |
| --- | --- |
| An `.svg` file (a set's download, a design export, a repo `icons/` folder) | `node scripts/svg-parts.mjs file.svg` |
| A package that ships `.svg` files (for example `lucide-static`, `heroicons`, `@tabler/icons`) | Find the files under `node_modules`, then the same command |
| An icon component (`react-icons`, `@heroicons/react`, an in-repo `<Icon />`) | Render it to markup and pipe it in, see below |
| An icon already on screen | `document.querySelector("svg").outerHTML` through `javascript_tool`, save it, pipe it in |
| `lucide-react` | `node scripts/svg-parts.mjs --lucide <name>` reads its node data and follows aliases such as `building-2` |

Render a component and extract it, from the project root:

```bash
bun -e 'import { renderToStaticMarkup } from "react-dom/server"; import { createElement } from "react"; import { Mail } from "lucide-react"; console.log(renderToStaticMarkup(createElement(Mail)))' | node <skill>/scripts/svg-parts.mjs -
```

The output is one line per drawable element, ready to paste into the registry as parts:

```
// viewBox 0 0 24 24, stroke, stroke-width 2, linecap round, linejoin round
{ id: "path1", d: "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" },
{ id: "rect2", d: "M4 4H20a2 2 0 0 1 2 2V18a2 2 0 0 1 -2 2H4a2 2 0 0 1 -2 -2V6a2 2 0 0 1 2 -2z" },
```

Rename the ids after what each part is (`flap`, `body`). Rects, circles, ellipses, lines, polylines and polygons are converted to path data.

## Read the style, fill the spec

| In the source header | In the registry entry |
| --- | --- |
| `fill="none" stroke="currentColor" stroke-width="2"` | Nothing, stroke at width 2 is the default |
| a different `stroke-width` | `strokeWidth: <value>` |
| `fill="currentColor"`, or no `fill` and no `stroke` | `paint: "fill"` |
| `viewBox` other than `0 0 24 24` | `viewBox: "<exactly as in the file>"` |

Motion numbers are in the icon's own units. The recipes in `SKILL.md` assume a 24 unit icon. For another viewBox scale offsets by `width / 24`, so a `0 -960 960 960` icon uses 40 times the numbers, and its origins have negative y values.

The template paints one way per icon. If the source mixes filled and stroked elements (duotone sets, a filled dot inside an outline), split the odd element off and decide per icon: draw everything in the dominant style, or set the odd part's look with a `strokeWidth` on the part. Note the compromise in the option's description so the reviewer sees it.

## Flatten first

The script warns when it finds `transform`, `use`, `mask`, `clipPath`, `style` or `defs`. Those cannot ride along as parts. Flatten the file first (SVGO's `convertShapeToPath` and `convertTransform` plugins do it), then extract again.

## Splitting a single path

A filled glyph is often one `path` with several subpaths. `--split` rewrites it as absolute subpaths, each with its bounding box, signed area and the subpaths it sits inside:

```
{ id: "path1-s0", d: "M12 2A10 10 0 1 0 12 22A10 10 0 0 0 12 2Z" }, // box [2, 2, 22, 22], area -312.145
{ id: "path1-s1", d: "M12 6A6 6 0 1 1 12 18A6 6 0 0 1 12 6Z" }, // box [6, 6, 18, 18], area 112.372, inside 0
```

- A subpath that is `inside` another and winds the opposite way (opposite sign of area) is a hole. Keep it in the same part as its outer subpath by joining both into one `d`, otherwise the hole fills solid.
- Subpaths with no nesting are independent shapes and make good parts (dots, bars, a pen beside a page).
- A single shape that must move in two pieces (a lid on a bin) becomes two parts that each carry the whole subpath, with a `clip` rectangle that keeps one half. `clip` moves with the part. `window` stays fixed in the parent frame, use it for things seen through an opening, like a glint inside a lens.
- Bounds and areas are approximate (curves are sampled). They are for grouping, not for measuring.
- All visible parts at rest must redraw the original exactly. Check with `scripts/rest-diff.js`.

## Merged glyphs that cannot be tiled by parts

Some glyphs only split cleanly with cuts that no clip rectangle can express. Skriuw handles them by drawing the static glyph at rest and swapping in the parts only while they move, with tests that sample the geometry to prove the swap is invisible. Read `~/dev/skriuw/packages/icons` (`parts.ts`, `generate.ts`, `path.ts`) and `docs/adr/0049-shared-icon-system.md` there instead of rebuilding that.
