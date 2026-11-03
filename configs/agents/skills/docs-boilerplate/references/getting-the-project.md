# Getting the project

Three ways in. Pick by what the user already has.

| Situation                                           | Use             |
| --------------------------------------------------- | --------------- |
| New site, wants it personalized and ready to commit | The CLI, `init` |
| New site, wants the whole repository to hack on     | Clone           |
| Existing Next.js and Fumadocs project               | The CLI, `add`  |

Requirements: [Bun](https://bun.sh) 1.3 or newer, Git, and [Vite+](https://viteplus.dev) (`vp`) for `bun run check`. Vite+ is only for format and lint, the site builds without it.

## Create with the CLI

```bash
bun create docs-boilerplate my-docs
# or
bunx docs-boilerplate init my-docs
```

It asks for the site name, description, production URL, author, accent color, the docs to start with and the features to turn on, then writes the site with `src/shared/config/site.ts` filled in, installs dependencies and makes the first commit. The result has no `packages/` folder and no registry scripts.

Every question has a flag. `--yes` takes the defaults and skips questions:

```bash
bunx docs-boilerplate init my-docs --yes \
  --name "Acme Docs" \
  --description "Docs for the Acme API." \
  --url https://docs.acme.dev \
  --author "Acme" \
  --accent blue \
  --docs starter \
  --features feedback,footer,changelog,page-meta
```

| Option                        | Values                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `--accent`                    | `none`, `blue`, `green`, `orange`, `purple` or any CSS color                                               |
| `--docs`                      | `starter` (an introduction, getting started and writing content page) or `example` (the full example docs) |
| `--features`                  | comma separated: `feedback`, `footer`, `changelog`, `page-meta`, `ask-ai`                                  |
| `--ai-provider`, `--ai-model` | `openrouter`, `anthropic`, `openai` or `google`, and a model name                                          |
| `--with <module>`             | an extra module, such as `feedback-neon`                                                                   |
| `--no-git`, `--no-install`    | skip the git commit or the install                                                                         |

Features you turn off stay in the code and are switched off in `site.ts`, so turning one on later is an edit to that file.

After `init`: `cd my-docs && bun dev`, then open `http://localhost:3000`.

The packages may not be published yet. If `bunx docs-boilerplate` or `bun create docs-boilerplate` returns a 404, clone instead, or build the CLI from the repository: `cd packages/cli && bun install && bun run build`, then run `node dist/cli.js init ../my-docs`.

## Clone

```bash
git clone <repository url> my-docs
cd my-docs
rm -rf .git && git init
bun install
bun dev
```

`bun install` also runs `fumadocs-mdx`, which generates the `.source` folder the site imports from. Without it the site does not compile. `bun dev` opens on port 3000 and takes the next free port if it is busy, up to 50 ports on. Set `PORT` to start somewhere else. In a terminal, `o` opens the browser and `q` quits.

A clone also holds `packages/` (the CLI), `scripts/registry/`, the boilerplate's README and changelog, and its sample pages. Delete what the site does not need, then:

1. Set the name, URL and author in `src/shared/config/site.ts`.
2. Replace the sample pages in `content/docs` and fix `content/docs/meta.json`.
3. Remove the `[GitHub](...)` link and the `---Links---` separator from `content/docs/meta.json`, and the footer links in `site.ts` that point at the boilerplate.
4. Run `bun run build` and fix every broken link it reports.

Deleting `packages/` and `scripts/registry/` also means removing `build:registry` from `package.json` and the `bun run build:registry &&` prefix in the `dev` and `build` scripts.

## Add modules to an existing project

For a project that already runs Next.js and Fumadocs, with the `@/*` alias mapped to `src/*`:

```bash
npx docs-boilerplate list
npx docs-boilerplate add feedback footer
npx docs-boilerplate diff feedback
```

| Command             | Does                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list`              | Lists the modules                                                                                                                                     |
| `add <modules...>`  | Copies the modules and the ones they need, adds dependencies to `package.json`, variables to `.env.local` and styles to the stylesheet, then installs |
| `diff <modules...>` | Shows how local files differ from the registry. Exits with 1 when they differ                                                                         |

Modules: `core`, `ask-ai`, `changelog`, `feedback`, `feedback-postgres`, `feedback-neon`, `feedback-libsql`, `footer`, `icons`. `add` never replaces a file you changed unless you pass `--overwrite`. `--css <path>` picks the stylesheet for the styles. `--registry <url>` reads from a deployed registry, also set with `DOCS_BOILERPLATE_REGISTRY`.

The same modules install through shadcn from a deployed site: `npx shadcn add https://<site>/r/<item>.json`. The target needs a `components.json`.

## Hand an agent the project

Point it at `llms.txt` in the repository, which lists the files worth reading with raw URLs, and at `AGENTS.md`. For a running site, `/llms.txt` lists every docs page and `/llms-full.txt` holds all of them in one file.
