# Deployment

The site is a Next.js app and deploys wherever Next.js does. Sources: `content/docs/guides/deployment/*.mdx`, `content/docs/components/reference/scripts.mdx`, `content/docs/components/reference/environment-variables.mdx`, `.github/workflows/ci.yml`.

Never deploy, push to a production branch or change host settings unless the user asked for that. Prepare, verify locally and list what the user must do.

## Checklist

1. **Site URL.** Set `NEXT_PUBLIC_SITE_URL` (for example `https://docs.example.com`) in the environment of the build, not only at runtime. It is read at build time, so changing it means building again. Without it, canonical links, the sitemap and Open Graph images point at `localhost`.
2. **Ask AI key.** Only when `site.askAI` is set: add the provider's key variable to the host environment. Never commit it.
3. **Database variables.** Only when a feedback store is installed: `DATABASE_URL`, or `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. See [databases.md](databases.md).
4. **Full git history.** Last updated dates come from git. A host that clones with `--depth 1` shows none. Deploy from a full clone or set `pageFooter.lastUpdated: false`.
5. **Build locally once.** `bun run build` runs the changelog sync, the link check and `next build`, so a deploy fails for the same reasons the machine does.
6. **Own domain and redirects.** Add redirects for moved URLs in `next.config.ts`. `/` already redirects to `/docs`.

The build command is the `build` script. The start command is `bun run start`, which goes through `scripts/serve.ts` (`bun --bun next start` on a free port starting at `PORT` or 3000).

## Vercel

1. Import the GitHub repository as a project. The preset is Next.js. With a `bun.lock`, Vercel installs with Bun and the build command is the `build` script.
2. In Project Settings, Environment Variables, set `NEXT_PUBLIC_SITE_URL` and, when used, the Ask AI key and database variables.
3. Push to the production branch. Every pull request gets a preview deployment.

Notes:

- The GitHub button and edit links use `VERCEL_GIT_REPO_OWNER` and `VERCEL_GIT_REPO_SLUG`, which Vercel sets for GitHub connected projects. Deploying without a Git connection needs `repository` in `site.ts`.
- `NEXT_PUBLIC_SITE_URL` is one value for all deployments, so previews use the production URL for canonical links and social images.
- The default Ask AI limit is in instance memory, so on Vercel it is per instance. For a strict limit pass a `limit` function backed by a shared store.
- A local file feedback store does not persist on Vercel. Use Neon, Postgres or Turso.

## Docker

The project has no Dockerfile. This one builds and starts the production server:

```dockerfile
FROM node:22-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global bun
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN bun run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "start"]
```

```text
# .dockerignore
node_modules
.next
.source
.git
.env*
```

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://docs.example.com -t docs .
docker run -p 3000:3000 docs
```

Why it looks like this:

- Node.js is required. Next.js evaluates the MDX loader in a Node process during the build, and the `oven/bun` image has none (`Node.js subprocess crashed while evaluating loaders`).
- Git is required. The `lastModified` plugin runs `git` for every page (`Executable not found in $PATH: "git"` otherwise).
- The site URL is a build argument, since it is read at build time.
- Sources are copied before the install, because `bun install` runs `fumadocs-mdx` as a postinstall step and it needs `source.config.ts` and `content`.
- Without `.git` in the build context the build passes but pages have no last updated date and the GitHub links are missing unless `repository` is set. Remove `.git` from `.dockerignore` and build from a full clone to keep them.
- Pass provider keys when running the container, never at build time: `docker run -p 3000:3000 -e ANTHROPIC_API_KEY=... docs`.

## Other hosts

Any host that runs `bun run build` and `bun run start` works. The site has API routes (search and Ask AI), so it needs a server, not a static host. Only Vercel and Docker are documented in `content/docs/guides/deployment`.

## CI

`.github/workflows/ci.yml` runs on every pull request and on pushes to `master`: `bun install --frozen-lockfile`, `bun run check`, `bun test`, `bun run typecheck`, `bun run build`, with `fetch-depth: 0` so dates work and `bun-version-file: package.json` for the Bun version. Keep the full history and `--frozen-lockfile` when copying it.

## After the deploy

Open `/docs`, `/llms.txt`, `/sitemap.xml` and `/robots.txt` on the production URL and check that none of them mention `localhost`. Check one page's last updated date and edit link. If Ask AI is on, ask one question.
