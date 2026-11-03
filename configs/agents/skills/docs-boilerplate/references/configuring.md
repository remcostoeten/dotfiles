# Configuring

The site is configured in three places: `src/shared/config/site.ts` for the site, `source.config.ts` for how content is read, and `src/app/globals.css` for layout sizes. Every option is documented in `content/docs/components/reference/configuration.mdx`, so read that page for an option not listed here, and update it when you add or change an option.

## site.ts

One exported object, `site`, typed as `SiteConfig`.

```ts
export const site: SiteConfig = {
  name: "Docs",
  description: "One sentence, used as the default meta description.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  contentDir: "content/docs",
  author: { name: "Your Name", url: "https://example.com" },
  keywords: ["docs"],
  logo: null,
  theme: { accent: null },
  pageFooter: { editLink: true, lastUpdated: true, feedback: true, prevNext: true },
  siteFooter: null,
  askAI: null,
  changelogs: [],
};
```

| Field         | Effect                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `name`        | Top bar, the `Page \| Name` title suffix, Open Graph images, publisher in structured data             |
| `description` | Default meta description for pages without their own                                                  |
| `url`         | Base for canonical links, social images, sitemap and `robots.txt`. Reads `NEXT_PUBLIC_SITE_URL` first |
| `repository`  | GitHub URL. Detected from the `origin` remote, so leave it out. `false` hides every GitHub link       |
| `branch`      | Branch the edit links point at. Detected, leave it out                                                |
| `contentDir`  | Folder of the pages, used for edit links and the changelog sync. Not what Fumadocs reads from         |
| `author`      | Page author in metadata and JSON-LD                                                                   |
| `logo`        | Image before the name in the top bar. See [styling.md](styling.md)                                    |
| `theme`       | Accent color and radius. See [styling.md](styling.md)                                                 |
| `pageFooter`  | Switches for the feedback widget, edit link, last updated date and previous and next links            |
| `siteFooter`  | A footer with columns of links under every page. `null` turns it off                                  |
| `askAI`       | The Ask AI chat. `null` turns it off. See [ai-setup.md](ai-setup.md)                                  |
| `changelogs`  | Changelog pages to generate. `[]` turns it off. See [databases.md](databases.md)                      |

`contentDir` and `dir` in `source.config.ts` are separate. If you move the pages, change both, plus `contentDir` in `scripts/check-links.ts`.

## Site footer

```ts
siteFooter: {
  brand: { description: "Docs for the Acme API." },
  columns: [
    {
      title: "Docs",
      links: [{ label: "Introduction", href: "/docs" }],
    },
    {
      title: "Community",
      links: [{ label: "GitHub", href: "https://github.com/acme/api", icon: "GitHub" }],
    },
  ],
  bottom: {
    copyright: "© {year} Acme",
    links: [{ label: "Contact", href: "mailto:hello@acme.dev", icon: "Mail" }],
  },
  hideOn: ["/docs/changelog"],
},
```

- `columns` is required and every column needs a unique title and at least one link. `{year}` in `copyright` becomes the current year.
- A link `href` is `/docs/...` (client link), `https://...` (new tab) or `mailto:` and `tel:`. Paths must start with `/` and point at a page or heading that exists.
- `icon` is a name from `src/shared/icons` or a component taking `className`.
- Hide it narrower than the whole site with `hideOn` (`*` matches one segment, `**` any number) or `siteFooter: false` in one page's frontmatter. `enabled: false` hides it and keeps the config.
- `bun run check:links` runs before every build and fails on empty columns, duplicate titles, empty labels and links to missing pages.

## Page footer

`pageFooter` has four switches: `feedback`, `prevNext`, `editLink`, `lastUpdated`. The edit link and date hide themselves when there is nothing to show. Per page, `editUrl` in frontmatter sets a different edit URL or `false` to hide the link.

The last updated date is the last git commit that touched the page's file. It needs a full git history: a `--depth 1` clone shows no dates. Fetch the full history in CI (`fetch-depth: 0`) or turn it off with `lastUpdated: false`.

## Repository detection

The GitHub button, edit links and dates need the repository. It is read from the `origin` git remote, then from `VERCEL_GIT_*` and `GITHUB_REPOSITORY` when there is no `.git` folder. Only GitHub is detected. Set `repository` and `branch` to override, or `repository: false` to hide every link that points at GitHub. When there is no repository, code must hide the link, not render a broken one.

## Environment variables

None are required to run the site. Put them in `.env.local`.

| Variable                                                                                    | Purpose                                                              |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                                      | Production URL. Read at build time, so set it before `bun run build` |
| `PORT`                                                                                      | First port `bun dev` and `bun start` try. Default 3000               |
| `GITHUB_TOKEN`                                                                              | Optional, for a changelog `url` that is a GitHub repository          |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY` | Ask AI, only the one for the chosen provider                         |
| `DATABASE_URL`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`                                    | Feedback stores. See [databases.md](databases.md)                    |

Without `NEXT_PUBLIC_SITE_URL`, canonical links, the sitemap and Open Graph images point at `localhost`.

## Search

`src/app/api/search/route.ts` builds the index from every page and tags each page with its sidebar section. Search opens with `Cmd+K`, lists recent pages before you type and filters by section. Nothing to configure.

## Routing

`/` redirects to `/docs` (a temporary redirect in `next.config.ts`). There is no landing page. To add redirects for moved pages, extend `redirects()` in `next.config.ts`. Renaming or moving a file changes its URL.

## A new site setting

Add the field to `SiteConfig`, set a value in `site.ts`, document it in the configuration reference page, and, in the boilerplate repository, add a value for it in `renderSite` in `packages/cli/src/scaffold.ts` so `init` writes it.
