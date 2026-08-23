# TypeScript 7.0 — the native Go compiler (release summary)

TypeScript 7.0 is Microsoft's port of the TypeScript compiler **from TypeScript to
Go**. It was methodically ported (not rewritten from scratch), so its type-checking
logic is structurally identical to TypeScript 6.0 and diagnostics line up: of
~20,000 compiler test cases, ~6,000 produce errors in TS 6.0, and TS 7 matches all
but ~74.

Status at time of writing (June 2026): **Release Candidate** (RC, ~June 18 2026),
with stable GA expected ~one month after the RC.

## Why Go / performance

- Compiles to a **native binary** — no Node.js startup overhead.
- **Goroutines** parallelize type-checking across files.
- More predictable memory model than V8's heap.
- Net result: **~10× faster**. VS Code (1.5M LOC): `tsc` ~78s → `tsgo` ~7.5s.

## How to install / invoke

| Phase | Package | Binary |
|---|---|---|
| Pre-stable (now) | `@typescript/native-preview` | `tsgo` |
| Stable GA | `typescript` (normal package) | `tsc` |

```bash
# pre-stable
npm install -D @typescript/native-preview
npx tsgo --noEmit
```

There is **no separate `tsgo` name in the final release** — at GA the Go compiler
*is* `tsc`. Keep an npm script (`"typecheck"`) so call sites are stable across the
switch.

Run TS 6 and TS 7 side by side during evaluation:
- `@typescript/typescript6` package → `tsc6` entry point, or
- `npm install -D typescript@npm:@typescript/typescript6`

Delete stale `*.tsbuildinfo` when switching between the JS `tsc` and `tsgo` — their
incremental artifacts are incompatible.

## Supported build features

- `--incremental`, project references, and `--build` mode are all ported and working.
- Parallelism flags: `--checkers` (default 4), `--builders` (parallel project-ref
  builds), `--singleThreaded` (debugging).

## Breaking changes (hard errors now)

- `target: es5` removed.
- Module formats removed: **AMD, UMD, SystemJS, CommonJS** (as `module` output).
- `moduleResolution: node` / `node10` / `classic` removed → use `nodenext` or
  `bundler`.
- `baseUrl` no longer supported (use `paths` with relative roots).
- `esModuleInterop` and `allowSyntheticDefaultImports` can no longer be `false`.
- `namespace`/`module` keyword for namespaces prohibited.
- Import `assert` replaced by `with`.

## Changed defaults

- `strict: true`
- `module: esnext`
- `stableTypeOrdering: true` (cannot be disabled)
- `types: []` (was `["*"]`)
- `rootDir: ./` (was unset)

## Programmatic API

A stable compiler API is not available until **TS 7.1 or later** — don't build
tooling against the 7.0 internals yet.

## Sources

- [Announcing TypeScript 7.0 Beta — Microsoft DevBlogs](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-beta/)
- [Progress on TypeScript 7 — December 2025 — Microsoft DevBlogs](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)
- [microsoft/typescript-go (staging repo)](https://github.com/microsoft/typescript-go)
- [@typescript/native-preview — npm](https://www.npmjs.com/package/@typescript/native-preview)
- [TypeScript 7.0 RC: The Go Rewrite Migration Guide — SitePoint](https://www.sitepoint.com/typescript-70-rc-the-go-rewrite-migration-guide/)
