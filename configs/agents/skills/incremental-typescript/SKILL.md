---
name: incremental-typescript
description: >-
  Adopt TypeScript in an existing JavaScript/JSX codebase incrementally and
  with zero friction — new files are written in TS, existing JS is left
  untouched and uncompiled. Use when the user wants to "add TypeScript", "start
  using TypeScript", "migrate JS to TS", "type-check new code only", set up
  tsconfig/tsgo/type-checking, or asks about TypeScript 7 / the native Go
  compiler (tsgo, @typescript/native-preview). Targets esbuild/Vite/bundler
  setups (Preact, React, vanilla) where the bundler already strips types so no
  build changes are needed. Biases toward the new-files-only strategy, not a
  big-bang rewrite.
---

# Incremental TypeScript (new-files-first, zero-friction)

The goal of this skill is to let a JS codebase **start writing TypeScript today**
without rewriting anything, without changing the build, and without a single
red squiggle on existing code. New code is typed; old code keeps working exactly
as-is. Type-checking runs as a fast, separate step powered by **TypeScript 7's
native Go compiler (`tsgo`)**.

## Core principles (read before doing anything)

1. **Only new files are TypeScript.** Never bulk-rename `.js`/`.jsx` → `.ts`/`.tsx`.
   Convert a file *only* when you're already meaningfully editing it for another
   reason. The default state of every existing file is "leave it alone".
2. **`allowJs: true`, `checkJs: false`.** TS sees JS files so imports resolve,
   but it does not type-check them. Existing JS produces zero errors forever.
3. **Type-checking is a side channel, not the build.** The bundler (esbuild /
   Vite / Babel) already strips types with no type-checking. So adding TS cannot
   break the build. `tsgo --noEmit` is a separate quality gate you can make as
   strict or as loose as you want, independently.
4. **Start non-blocking, tighten later.** Day one, the typecheck is informational.
   Only after the typed surface is clean do you make CI/pre-commit block on it.
5. **`include` only the typed files.** Scope `tsconfig` to `**/*.ts`/`**/*.tsx`
   so the checker never wanders into untyped JS and floods you with noise.

If the user asks for a full strict migration of the *entire* codebase instead,
that is a different, higher-friction job — flag the tradeoff and confirm before
abandoning the new-files-only default.

## TypeScript 7 / the Go compiler — what you need to know

TypeScript 7.0 is the Microsoft port of the compiler from TypeScript to **Go**,
roughly **~10× faster** type-checks (VS Code's 1.5M-line codebase: ~78s → ~7.5s).
Type-checking logic is structurally identical to TS 6.0, so diagnostics match.

- **Pre-stable (today):** install `@typescript/native-preview`, invoke **`tsgo`**.
  ```
  npm install -D @typescript/native-preview
  npx tsgo --noEmit
  ```
- **At stable GA:** the native compiler ships as the normal `typescript` package
  and the binary is just **`tsc`** again — there is no separate `tsgo` name in
  the final release. Keep an npm script alias (`"typecheck"`) so call sites don't
  care which binary is underneath.
- `--incremental`, project references, and `--build` mode are ported and working.
  Delete stale `*.tsbuildinfo` if you ever switch between the JS `tsc` and `tsgo`
  (their incremental artifacts are incompatible).
- Parallelism flags: `--checkers` (default 4), `--singleThreaded` for debugging.
- See `references/ts7-release.md` for the fuller release summary, breaking changes,
  and changed defaults (e.g. `target: es5`, AMD/UMD/SystemJS, `baseUrl` removed;
  `strict`/`module: esnext`/`types: []` now default).

## The procedure

### Step 1 — Confirm the bundler strips types (the no-friction premise)
esbuild and Vite compile `.ts`/`.tsx` out of the box and resolve extensionless
imports (esbuild's default `resolveExtensions` is `.tsx,.ts,.jsx,.js,.css,.json`).
That means **a `.tsx` file is a drop-in for a `.jsx` file** — the only code change
when renaming is fixing any import specifier that hard-codes the old extension
(`import x from './foo.jsx'` → `import x from './foo'`). Verify the build entry
(`build.mjs`, `vite.config`, etc.) doesn't pin an extension allowlist that
excludes `.ts`/`.tsx`. If it does, add them.

### Step 2 — Add the tsconfig
Copy `references/tsconfig.template.json`, then adapt:
- **JSX:** Preact → `"jsx": "react-jsx"`, `"jsxImportSource": "preact"`.
  React → `"jsxImportSource": "react"`. None/vanilla → drop both.
- **moduleResolution:** use `"bundler"` (esbuild/Vite). TS7 removed `node`/`node10`/
  `classic` — `bundler` or `nodenext` only.
- **paths:** mirror the bundler's aliases; keep it minimal.
- **include:** ONLY the typed globs (`assets/**/*.ts`, `assets/**/*.tsx`). Do not
  include `**/*.js`. `allowJs` handles JS resolution without listing it.

### Step 3 — Wire the type-check script (don't touch the build)
In `package.json`:
```jsonc
"devDependencies": { "@typescript/native-preview": "latest" },
"scripts": { "typecheck": "tsgo --noEmit" }
```
The indirection matters: when GA lands you swap the devDep to `typescript` and the
script body to `tsc --noEmit`; every caller (`npm run typecheck`) stays unchanged.

### Step 4 — Prove it with ONE file
Pick a small, leaf component (few imports, no deep dependents) and convert it:
- `.jsx` → `.tsx`, add a `Props` type (or the project's type-naming convention),
  annotate the public surface, narrow `dataset`/`JSON.parse`/DOM queries
  (`querySelectorAll<HTMLElement>`, `?? "{}"` guards).
- Fix the extensionless import at its call sites.
- Run `npm run typecheck` → must be clean. Run the build → must still work.
This is the whole loop. Every future file repeats Step 4 only.

### Step 5 — Make it enforceable (opt-in, gradual)
Two independent gates — add either/both, start non-blocking:
- **Pre-commit hook:** `references/pre-commit.sh` runs `tsgo --noEmit`, skips
  gracefully if the binary isn't installed, and is opt-in per clone via
  `git config core.hooksPath .githooks`. Standalone (no Husky/lefthook needed),
  but if the project already uses a hook manager, add the typecheck there instead
  of introducing a second mechanism.
- **CI step:** a parallel `typecheck` job running `npm ci && npm run typecheck`.
  See `references/ci-snippets.md` for Bitbucket Pipelines / GitHub Actions.
  Keep it `continue-on-error`/non-blocking until the typed surface is reliably
  green, then flip it to required.

## Guardrails

- **Never** flip `checkJs` to `true` as part of this skill — that re-introduces
  the friction the whole approach avoids. It's a separate, later decision.
- **Never** add `.ts`/`.tsx` to the build's responsibility for *type errors* —
  the build strips types and must stay fast and unblocked; type safety lives in
  `npm run typecheck` only.
- Respect the project's existing conventions (function-declaration vs arrow,
  `Props` naming, no-comments rules, import/barrel style). Read `AGENTS.md` and
  match it; this skill sets up TS, it does not override house style.
- If `tsgo` reports errors in files you didn't touch, your `include` is too wide
  or `allowJs`/`checkJs` is misconfigured — fix the scope, don't fix the JS.

## Reference files

- `references/tsconfig.template.json` — bundler + Preact/React-ready strict config.
- `references/pre-commit.sh` — standalone `tsgo` pre-commit hook.
- `references/ci-snippets.md` — Bitbucket + GitHub Actions typecheck steps.
- `references/ts7-release.md` — TypeScript 7.0 release summary, breaking changes,
  changed defaults, sources.
