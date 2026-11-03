# Frontmatter, meta.json and the sidebar

Source of truth: `source.config.ts`, `content/docs/components/reference/frontmatter.mdx`, `meta-json.mdx` and `content/docs/concepts/sidebar.mdx`.

## Where pages live

Every `.mdx` file under `content/docs` is a page, and its path is its URL with `/docs` in front.

| File                                       | URL                       |
| ------------------------------------------ | ------------------------- |
| `content/docs/index.mdx`                   | `/docs`                   |
| `content/docs/installation.mdx`            | `/docs/installation`      |
| `content/docs/guides/theming.mdx`          | `/docs/guides/theming`    |
| `content/docs/guides/deployment/index.mdx` | `/docs/guides/deployment` |

An `index.mdx` is the page of its folder. Renaming or moving a file changes its URL.

## Frontmatter schema

Validated with Zod at build time. An unknown field or a wrong type fails the build with the field name.

```mdx
---
title: Example
description: One line under the title.
icon: Rocket
sidebarTitle: Short label
sidebarBadge: beta
tocDepth: 2
editUrl: false
askAI: false
siteFooter: false
full: false
---
```

| Field          | Type              | Effect                                                                           |
| -------------- | ----------------- | -------------------------------------------------------------------------------- |
| `title`        | string, required  | The `h1`, search title, `<title>`, Open Graph image, default sidebar label       |
| `description`  | string            | Subtitle, meta description, search, `llms.txt`. Falls back to `site.description` |
| `icon`         | string            | Icon name from `src/shared/icons`                                                |
| `full`         | boolean           | Full page width and no table of contents                                         |
| `sidebarTitle` | non empty string  | Shorter sidebar label                                                            |
| `sidebarBadge` | non empty string  | Badge after the label, such as `new` or `api`                                    |
| `tocDepth`     | integer 2 to 6    | Deepest heading level in the table of contents                                   |
| `askAI`        | boolean           | `false` hides the Ask AI button on this page                                     |
| `siteFooter`   | boolean           | `false` hides the site footer on this page                                       |
| `editUrl`      | string or `false` | Edit link URL for this page, or `false` to hide it                               |

The schema is `pageSchema` from Fumadocs extended in `source.config.ts`:

```ts
schema: pageSchema.extend({
  sidebarTitle: z.string().min(1).optional(),
  // ...
}),
```

To add a field, extend the schema with Zod, read it from `page.data` in `src/app/docs/[[...slug]]/page.tsx`, and add it to `content/docs/components/reference/frontmatter.mdx`. After changing `source.config.ts`, run `bun run typecheck` or restart `bun dev` to regenerate `.source`.

Write a `description` on every page. It feeds search, social cards and `llms.txt`.

## meta.json

Every folder can have one. It names the folder, picks its icon and orders its pages.

```json
{
  "title": "Guides",
  "icon": "Compass",
  "pages": ["theming", "---More---", "changelog", "ask-ai", "deployment"]
}
```

| Field         | Effect                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| `title`       | Folder name in the sidebar and search filters. Falls back to its `index.mdx` title, then the folder name |
| `icon`        | Folder icon. A top level section without one shows a folder icon                                         |
| `description` | Folder description                                                                                       |
| `pages`       | Entries in order                                                                                         |
| `root`        | `true` on `content/docs/meta.json` only                                                                  |
| `pagesIndex`  | Page that opens when the folder is clicked, instead of `index.mdx`                                       |

`pages` entries:

| Entry                     | Result                                                                    |
| ------------------------- | ------------------------------------------------------------------------- |
| `"installation"`          | The page `installation.mdx` or the folder `installation`                  |
| `"---Advanced---"`        | A separator labeled `Advanced`. `"---[Rocket]Start here---"` adds an icon |
| `"[GitHub](https://...)"` | A link, new tab when it starts with `http`                                |
| `"..."`                   | Every page and folder not listed elsewhere, alphabetically                |
| `"z...a"`                 | The same, reversed                                                        |
| `"!draft"`                | Leaves `draft` out of the `...` entries                                   |
| `"...other"`              | Inlines the pages of folder `other` without the folder                    |

A missing `pages` array behaves as `["..."]`. A present array without `"..."` shows only what it lists, which is how a page stays out of the sidebar. `defaultOpen` and `collapsible` have no effect here, the sidebar opens folders from the URL.

## Sidebar behavior

- Pages at the root of `content/docs` form one section named after the `title` in the root `meta.json`. Every top level folder is its own section, named by its `meta.json`.
- Sections are open on load and close independently.
- A nested folder with an `index.mdx` is one link with its pages below it. A nested folder without one shows as a separator with its pages below.
- Hold `Shift` to see letters on sections and numbers on pages, `Shift` plus a key jumps there.
- Below the `lg` breakpoint the sidebar is a full screen dialog.

## Adding a page

1. Create `content/docs/<folder>/<name>.mdx` with at least a `title` and a `description`.
2. Add `"<name>"` to the `pages` array of the `meta.json` in that folder, in the position it should have.
3. For a new section, create the folder with a `meta.json` (`title`, `icon`, `pages`) and add the folder name to `content/docs/meta.json`.
4. Link to it as `/docs/<folder>/<name>`, and to a heading as `/docs/<folder>/<name>#heading-text`.
5. Run `bun run build`. The link check fails on a missing page or heading.

## Writing in a page

- Headings from level 2 down become the table of contents and anchors. The anchor is the lowercase heading text with spaces as dashes, so `## Add a page` is `#add-a-page`. `[#custom-id]` at the end of a heading sets one, but the link check does not know custom ids.
- Components available without imports: `Callout`, `Cards`, `Card`, `Tabs`, `Tab`, `Steps`, `Step`, `Accordions`, `Accordion`, `Files`, `Folder`, `File`, `TypeTable`, `Release`, and the icons `BookIcon`, `CloudIcon`, `CompassIcon`, `DownloadIcon`, `PageIcon`, `PaletteIcon`, `RocketIcon`, `RouteIcon`, `SearchIcon`. To add one, register it in `src/modules/docs/mdx-components.tsx`.
- Code fences take a `title`, line highlighting, diffs and line numbers. A `ts` or `tsx` fence with `twoslash` in its meta is type checked at build time and gets hover types, and an error not listed in `// @errors: <code>` fails the build.
- Internal links use the full path starting with `/docs`. External links are not checked.
- Images go in `public/` and are referenced from the root, `![Alt text](/images/diagram.png)`.
- Components that contain Markdown need a blank line after the opening tag and before the closing one, for example inside `<Step>`.
