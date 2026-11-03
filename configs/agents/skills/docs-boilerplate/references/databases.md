# Databases and the changelog

The site needs no database. The only feature that stores data is page feedback ("Was this page helpful?"), and it logs to the console until you swap the store. Sources: `content/docs/guides/feedback.mdx`, `content/docs/guides/changelog.mdx`, `src/modules/feedback`, `scripts/registry/items.ts`.

## How feedback is stored

1. A vote goes through the server action `submitFeedback` in `src/modules/feedback/server/submit-feedback.ts`, which validates it with Zod and calls `handleFeedback`.
2. `handleFeedback` passes it to the store exported from `src/modules/feedback/server/store.ts`, then returns the new counts for the page.
3. The widget remembers the vote in `localStorage`. That is a convenience, not protection.

A vote is `{ url, rating }` with `rating` either `"helpful"` or `"not-helpful"`. A store implements `FeedbackStore` from `src/modules/feedback/types.ts`: `save(feedback)` and `counts(url)`.

`store.ts` is one line and decides which store runs:

```ts
export { postgresStore as feedbackStore } from "./stores/postgres";
```

By default it exports the console store, which logs each vote and keeps totals in memory, so counts reset when the server restarts.

## Pick a store

| Need                                       | Module              | Package                    | Variables                                |
| ------------------------------------------ | ------------------- | -------------------------- | ---------------------------------------- |
| Local development, or a server you control | `feedback-postgres` | `postgres`                 | `DATABASE_URL`                           |
| Serverless or edge hosting with Postgres   | `feedback-neon`     | `@neondatabase/serverless` | `DATABASE_URL`                           |
| Turso, or a local file for development     | `feedback-libsql`   | `@libsql/client`           | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` |
| No storage needed                          | none, keep console  |                            |                                          |

Each store creates a `feedback` table on the first submission, with `id`, `url`, `rating` and `created_at`, one row per vote. There are no migrations to run.

A local file store (`feedback.db`, libSQL without `TURSO_DATABASE_URL`) does not persist on serverless hosts such as Vercel. Do not choose it for a deployed serverless site.

## Install a store

With the CLI, in a site that has the `feedback` module:

```bash
npx docs-boilerplate add feedback-postgres
```

It adds the store file to `src/modules/feedback/server/stores`, points `store.ts` at it, adds the package to `package.json` and the variables to `.env.local`, then installs. Adding another store switches to it, unless `store.ts` was edited by hand.

Without the CLI, in a clone: the files already exist. Make `store.ts` export the store you want, install the driver package if it is missing (`bun add postgres`, `bun add @neondatabase/serverless` or `bun add @libsql/client`), and set the variables.

### Postgres in Docker

The module adds `compose.feedback.yml` to the project root: Postgres 17 on port 5432 with a named volume, user, password and database `docs`, `docs`, `feedback`.

```bash
docker compose -f compose.feedback.yml up -d
```

```bash
# .env.local
DATABASE_URL=postgres://docs:docs@localhost:5432/feedback
```

Those credentials are for local development only. A production database gets its own credentials in the host environment.

### Neon

Create a database in the Neon console and copy the connection string into `DATABASE_URL`. It is used over HTTP, so it works in serverless and edge functions.

```bash
DATABASE_URL=postgresql://user:password@ep-example.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

### Turso

```bash
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=...
```

## Another store

Write a `FeedbackStore`, export it from `store.ts`:

```ts
import type { FeedbackStore } from "../../types";

export const webhookStore: FeedbackStore = {
  async save(feedback) {
    await fetch(process.env.FEEDBACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...feedback, at: new Date().toISOString() }),
    });
  },
  async counts() {
    return { helpful: 0, "not-helpful": 0 };
  },
};
```

## Before connecting a database

The action accepts any well formed vote and has no rate limit, so counts can be inflated. Add a limit in `handleFeedback` before pointing it at anything that costs money or notifies people. Server only code starts with `import "server-only"`.

Do not run SQL against a database the user has not named, and never print or commit a connection string. Put them in `.env.local` and the host environment.

## Turn feedback off

`pageFooter: { feedback: false, ... }` in `site.ts`. The widget disappears from every page and the action stays unused.

## Changelog

A changelog page is generated, so it also needs a source, not a database. `changelogs` in `site.ts` lists the sources, one page each. An empty list turns it off.

```ts
changelogs: [
  {
    file: "CHANGELOG.md",
    page: "changelog",
    title: "Changelog",
    description: "What changed in each release.",
  },
],
```

A source is exactly one of `file` (relative to the repository root, or absolute, and may point outside it) or `url`. Optional: `skipPrereleases` and `editUrl`.

| Source                                                      | Reads                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `file: "CHANGELOG.md"`                                      | The file. `bun dev` re-syncs when it changes                                    |
| `url: "https://github.com/acme/app"` or its releases page   | GitHub Releases. Drafts and empty notes are skipped, the leading `v` is removed |
| `url: "https://github.com/acme/app/blob/main/CHANGELOG.md"` | The raw file, with the edit link pointing at it                                 |
| Any other `url`                                             | Fetched as Markdown, no edit link                                               |

Set `GITHUB_TOKEN` to raise the GitHub API limit from 60 an hour or to read a private repository. A failed fetch keeps the existing page with a warning.

Headings the parser reads: Keep a Changelog (`## [1.2.0] - 2026-10-18`, `## [Unreleased]`), conventional changelog (`## [1.2.0](url) (2026-10-18)`), Changesets (`## 1.2.0`, no date) and plain `## v1.2.0 - 2026-10-18`. Each level 2 heading is one release and empty releases are dropped. Raw HTML, JSX, HTML comments and curly braces outside code are escaped or removed so MDX compiles.

To add a changelog:

1. Add the entry to `changelogs` in `src/shared/config/site.ts`. Each `page` name must be unique.
2. Add `content/docs/<page>.mdx` to `.gitignore` and `<page>` to the `pages` array of `content/docs/meta.json`.
3. Run `bun run sync:changelog`, then `bun run check`, `bun test`, `bun run typecheck` and `bun run build`.

The generated page starts with the `generated by scripts/sync-changelog.ts` marker. Never edit it, edit the source and sync again. To write one by hand, create the page without the marker, wrap each entry in `<Release date="YYYY-MM-DD">` with a `## version` heading inside, and leave its name out of `changelogs`, since the sync refuses to overwrite a page without the marker.
