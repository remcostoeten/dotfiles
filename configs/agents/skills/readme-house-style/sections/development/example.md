From skriuw:

````markdown
## Development

Rust 1.95, Bun 1.3, Node.js 24, and the platform dependencies required by
Tauri.

```bash
./scripts/bootstrap.sh   # one-time setup
./scripts/check.sh       # full gate: contracts, lint, all tests
./scripts/build.sh       # build (also: web | desktop | ci)
```

The repository layout, web deployment, and cloud development reference is in
[docs/development.md](docs/development.md). Contributions start at
[CONTRIBUTING.md](CONTRIBUTING.md); report security issues through
[SECURITY.md](SECURITY.md) instead of a public issue.
````

From Papertrail:

````markdown
## Development

Node.js 22 and pnpm. The Worker needs `wrangler`.

```bash
pnpm install
pnpm dev            # Vite on 5173, /api proxied to the Worker on 8787
pnpm test           # Vitest, including byte-for-byte golden PDF comparisons
pnpm build          # tsc --noEmit, then production build to dist/
```

CI runs typecheck (app and Worker), lint, format check, tests (app and Worker) and build on every
push and pull request. The full command list is in [ARCHITECTURE.md](docs/ARCHITECTURE.md);
deploying your own copy (OAuth clients, D1, Resend, secrets) is in
[deployment.md](docs/deployment.md).
````
