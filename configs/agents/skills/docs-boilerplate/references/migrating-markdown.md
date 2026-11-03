# Migrating existing Markdown

Moving a set of `.md` or `.mdx` files from a README folder, Docusaurus, Nextra, Mintlify, GitBook, VitePress or a wiki into `content/docs`. The work is: copy, rename, add frontmatter, fix MDX syntax, rewrite links and images, build the sidebar, then run the build until it is clean.

Do it in a branch or a commit you can return to. Work on copies of the source files, never move the originals until the build passes.

## Steps

1. **Inventory.** List the source files, their folders and their order. Note the sidebar order if the old tool had one (`_category_.json`, `sidebars.js`, `_meta.json`, `SUMMARY.md`, `docs.json`).
2. **Copy into `content/docs`.** Keep the folder structure. Rename to `.mdx`, lowercase and kebab case. `README.md` becomes `index.mdx`. The path is the URL, so decide now which old URLs must keep working and add redirects at the end.
3. **Add frontmatter** to every file. `title` is required. Take it from the first `# Heading` and delete that heading, since the title renders as the page `h1`. Add a one line `description`. See the mapping below.
4. **Fix MDX syntax.** See the table. This is where most build errors come from.
5. **Rewrite links and images.**
6. **Write `meta.json`** for every folder and list every page.
7. **Run `bun run build`**, fix the first error, repeat.
8. **Add redirects** for URLs that moved.

## Frontmatter mapping

| Source field                                                                       | Becomes                                                                     |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `title`, or the first `# Heading`                                                  | `title`                                                                     |
| `description`, `summary`, `excerpt`                                                | `description`                                                               |
| `sidebar_label`, `sidebarTitle`                                                    | `sidebarTitle`                                                              |
| `sidebar_position`, `order`, `weight`                                              | the position in the folder's `meta.json` `pages` array                      |
| `icon`                                                                             | `icon`, only if the name exists in `src/shared/icons`                       |
| `slug`, `permalink`                                                                | the file path, plus a redirect from the old slug                            |
| `tags`, `keywords`, `authors`, `date`, `draft`, `layout`, `hide_table_of_contents` | remove. They fail the schema. `hide_table_of_contents` becomes `full: true` |

An unknown field fails the build. Either delete it or extend the schema in `source.config.ts` and document it.

## MDX syntax that breaks

MDX is stricter than Markdown. Fix these in every file, outside code fences and inline code.

| Source                                | Problem                              | Fix                                                         |
| ------------------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| `<!-- comment -->`                    | HTML comments are invalid in MDX     | `{/* comment */}` or delete it                              |
| `{` and `}` in prose                  | Parsed as a JavaScript expression    | `\{` and `\}`, or put the text in a code span               |
| `<` before a letter or number, `<5`   | Parsed as a tag                      | `&lt;` or a code span                                       |
| `<br>`, `<img ...>`, `<hr>`           | Unclosed tags                        | `<br />`, `<img ... />`, or Markdown                        |
| `class="x"`, `style="color: red"`     | JSX attributes                       | `className="x"`, `style={{ color: "red" }}`, or remove      |
| `<details>` and `<summary>`           | Raw HTML works only when well formed | An `Accordions` and `Accordion` pair                        |
| `<https://example.com>` autolinks     | Parsed as a tag                      | `[https://example.com](https://example.com)`                |
| Tabs of indented code under a list    | Indentation changes meaning          | Fenced code blocks                                          |
| Component without a blank line inside | Markdown inside is not parsed        | Blank line after the opening tag and before the closing tag |

Imports of components (`import Tabs from '@theme/Tabs'`) must be deleted. The components below are registered globally and need no import.

## Admonitions and components

| Source                                       | Becomes                                             |
| -------------------------------------------- | --------------------------------------------------- |
| `:::note`, `:::info`, `> **Note**`, `<Note>` | `<Callout type="info" title="Note">`                |
| `:::tip`, `<Tip>`                            | `<Callout type="idea" title="Tip">`                 |
| `:::warning`, `:::caution`, `<Warning>`      | `<Callout type="warn" title="Warning">`             |
| `:::danger`, `<Danger>`                      | `<Callout type="error" title="Danger">`             |
| `<Tabs>` and `<TabItem value label>`         | `<Tabs items={[...]}>` and `<Tab value="...">`      |
| Numbered "Step 1" sections                   | `<Steps>` with `<Step>` and a `###` heading in each |
| Card grids, `<CardGroup>`                    | `<Cards>` and `<Card title href description>`       |
| Directory listings in code                   | `<Files>`, `<Folder>`, `<File>`                     |
| Props tables                                 | `<TypeTable>`                                       |
| Collapsibles                                 | `<Accordions>` and `<Accordion title>`              |

Callout types are `info`, `warn` (or `warning`), `error`, `success`, `idea`. A plain Markdown blockquote still works and needs no change, convert it only when the emphasis matters.

```mdx
<Tabs items={["bun", "npm"]}>
<Tab value="bun">

`bun add some-package`

</Tab>
<Tab value="npm">

`npm install some-package`

</Tab>
</Tabs>
```

## Links

- Internal links use the full path from `/docs`: `./setup.md` in `guides/intro.md` becomes `/docs/guides/setup`. Drop the extension and the `index`. Relative links that worked in the old tool do not work here.
- Heading anchors are the lowercase heading text with spaces as dashes. A heading renamed in the move breaks its anchors. The link check names each one.
- Links to the old site's absolute URLs on the same host should become internal links.
- `bun run check:links` reads every page and fails on a broken `/docs` or `#` link. External links are not checked.

## Images and files

Move images to `public/` (for example `public/images/`) and reference them from the root: `![Alt text](/images/diagram.png)`. Always keep the alt text. Relative paths such as `./img/a.png` and `../assets/a.png` do not resolve, rewrite them. A remote image in Markdown works as is.

## Sidebar

Write a `meta.json` per folder with `title`, `icon` and `pages` in the source order, and list the folders in `content/docs/meta.json`. Convert the old tool's category files:

| Source                                | Becomes                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| `_category_.json` `label`, `position` | folder `meta.json` `title`, and its position in the parent `pages` |
| `_meta.json` (Nextra)                 | `meta.json`, with `"---Label---"` for separators                   |
| `SUMMARY.md` (GitBook)                | the nested order of `pages` arrays                                 |
| `docs.json` navigation (Mintlify)     | `meta.json` files, groups become folders or separators             |

A page left out of `pages` builds but is not in the sidebar. After migrating, check that the page count in the sidebar matches the file count.

## Redirects

If old URLs are public, add them to `redirects()` in `next.config.ts`:

```ts
async redirects() {
  return [
    { source: "/", destination: "/docs", permanent: false },
    { source: "/old/path", destination: "/docs/new/path", permanent: true },
  ];
},
```

Keep the existing `/` redirect. Use `permanent: true` only for URLs that will not move again.

## Bulk migration

For more than a handful of files, write a one off script in a scratch directory outside the repository, run it on a copy, and review the diff. The script should do the mechanical parts (rename, frontmatter from the first heading, comments, closing void tags, link rewrite) and report what it could not decide. Do the rest by hand: callouts, tabs, sidebar order and descriptions. Do not commit the script.

## Verify

```bash
bun run build
```

The build fails on the first of: a frontmatter field that is not in the schema, an MDX compile error (the message names the file and line), a broken internal link, a type error in a `twoslash` fence. Fix, rerun, and repeat until it is clean. Then run `bun dev` and open the busiest pages, the sidebar and a search, since a clean build does not show a page that is silently missing from `meta.json`.
