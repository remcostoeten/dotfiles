# AI setup

Four separate things, all built in: the Ask AI chat, `llms.txt`, Markdown for every page, and agent instructions for people who build on the repository. Sources: `content/docs/guides/ask-ai.mdx`, `content/docs/concepts/seo-and-llms.mdx`, `src/modules/ask-ai`.

## Ask AI

A button next to Copy Markdown on every docs page that opens a chat answered from the site's own pages. Off while `site.askAI` is `null`.

### Turn it on

```ts
askAI: {
  provider: "anthropic",
  model: "claude-sonnet-5-5",
},
```

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

| Provider     | Key variable                   | Model examples                                          |
| ------------ | ------------------------------ | ------------------------------------------------------- |
| `anthropic`  | `ANTHROPIC_API_KEY`            | `claude-sonnet-5-5`, `claude-haiku-5-5`                 |
| `openai`     | `OPENAI_API_KEY`               | An OpenAI model name                                    |
| `google`     | `GOOGLE_GENERATIVE_AI_API_KEY` | A Gemini model name                                     |
| `openrouter` | `OPENROUTER_API_KEY`           | Any OpenRouter ID, such as `anthropic/claude-haiku-5-5` |

`provider` and `model` are typed together: `model` is required and the editor suggests that provider's names. Any string is accepted. Look up current model names from the provider rather than guessing. The key is read on the server only. `apiKeyEnv` reads a different variable name, and `baseUrl` points at a proxy or a local OpenAI compatible server such as Ollama.

Never put a key in `site.ts`, in a committed file, or in a command that echoes it. Add an empty `KEY=` line to `.env.local` and tell the user to fill it.

### Options

| Option            | Default                  | Effect                                                               |
| ----------------- | ------------------------ | -------------------------------------------------------------------- |
| `title`           | `"Ask AI"`               | Panel title                                                          |
| `placeholder`     | `"Ask about these docs"` | Input placeholder                                                    |
| `suggestions`     | none                     | Questions shown before the first message                             |
| `instructions`    | none                     | Extra system prompt text: tone, product names, what to refuse        |
| `hideOn`          | none                     | URL patterns without the button. `*` is one segment, `**` any number |
| `limit`           | 20 per hour per IP       | Rate limit                                                           |
| `maxContextChars` | 60000                    | Most documentation characters sent with a question                   |
| `maxOutputTokens` | 1024                     | Longest answer                                                       |

Hide it on one page with `askAI: false` in the frontmatter.

### How answers are built

A site that fits in `maxContextChars` is sent whole with every question. A larger one sends the current page and the pages that best match the question. The model is told to answer from that text only and to say so when the docs do not cover it. Messages are validated with Zod, cut to the last 12, 2000 characters each.

### Rate limit

Every question costs money, so the limit applies unless changed. Never remove it.

```ts
limit: {
  max: 10,
  per: "1h", // "1m", "1h" or "1d"
  by: (request) => request.headers.get("x-user-id") ?? "anonymous",
  skipIf: (request) => request.headers.get("x-plan") === "team",
},
```

A function `limit: (request) => boolean` decides alone, for example against Redis, and returns false for a 429. `limit: false` turns it off, which the user must ask for. The built in counter is in server memory, so each serverless instance counts separately.

### Code layout

- `src/modules/ask-ai/types.ts`: `AskAIConfig`, a union keyed by `provider`.
- `server/model.ts`: `loadModel` and the key variable table. Add a provider by extending `ProviderModels` in the types, `loadModel` and the table.
- `server/handler.ts`: `createAskHandler` builds `POST /api/ask`. Order is limit, validation, key check, context, stream. `src/app/api/ask/route.ts` passes it `site.askAI`, the site name and the pages.
- `server/context.ts`, `server/rate-limit.ts`, `components/ask-ai-slot.tsx`, `components/ask-ai.tsx`.
- This project uses AI SDK 7. Read `node_modules/ai/docs` before changing server code: `streamText` takes `instructions`, and the route returns `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`.
- Functions in `site.askAI` run on the server only. Never pass the config object to a client component, pass plain props as `AskAISlot` does.

### Check it

```bash
bun run typecheck
bun dev
```

Open a page, click Ask AI and ask a question the docs answer. A missing key shows the variable name in the panel. Do not run requests against a paid provider in a loop.

## llms.txt and Markdown output

Nothing to configure, both follow the pages in `content/docs`.

| URL                | Content                                               |
| ------------------ | ----------------------------------------------------- |
| `/llms.txt`        | Every page with its title, URL and description        |
| `/llms-full.txt`   | The full Markdown of every page in one file           |
| `/docs/<page>.mdx` | One page as Markdown, with title, URL and description |

They are built by `docsLlms` in `src/modules/docs/server/llms.ts` and the routes in `src/app`. The buttons under each page title (Copy Markdown, View as Markdown) use the `.mdx` URL.

Page `description` fields feed `llms.txt`, so write one for each page. Do not add a `public/llms.txt`, it would clash with the route.

## SEO output

Each page gets canonical and social metadata, an Open Graph image at `/og/docs/<slug>/image.png` drawn by `src/app/og/docs/[...slug]/route.tsx`, and `TechArticle` JSON-LD from `src/modules/docs/server/seo.ts`. `/sitemap.xml` and `/robots.txt` use `NEXT_PUBLIC_SITE_URL`. To keep a page out of the sitemap or robots, edit `src/app/sitemap.ts` and `src/app/robots.ts`.

## Instructions for agents

For people who build on the repository with a coding agent, keep:

- `AGENTS.md` in the project root: commands, layout, code style and rules. The `next dev` block at the top is written and re-added by Next.js, keep it.
- A root `llms.txt` of links to raw files, in the llmstxt.org format, for the repository (not the site).
- Skills in `skills/<name>/SKILL.md`, installable with `npx skills add <owner>/<repo>`.

Keep these in step with the code. When a command, folder or option changes, update `AGENTS.md` in the same change.
