---
name: generic-program-rules
description: Remco's personal rules for code style, comments, types, linting, writing, READMEs and end-of-task summaries. Use whenever writing or editing code, prose, commit messages or summaries in any of Remco's projects, and whenever a README is created, rewritten, restructured or polished (header, badges, demo, install, footer). Replaces the deprecated readme-house-style skill. Project instructions override these where they conflict.
---

# Generic program rules

## Code style

### Standalone functions are function declarations

Never assign an arrow function to a `const` for a standalone function. Declarations hoist and get real names in stack traces.

```ts
function formatDate(date: Date) {
  return date.toISOString()
}
```

### Callbacks are arrow functions

Anything passed as an argument (`useEffect`, `map`, `setTimeout`, event handlers) is an arrow function, never the `function` keyword.

### Lint with Oxlint, format with oxfmt

Projects use [Oxlint](https://oxc.rs/docs/guide/usage/linter) and [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html). Never add ESLint or Prettier, their configs or their plugins. Enforce the function rules through the Oxlint config (`func-style: ["error", "declaration"]`, `prefer-arrow-callback: "error"`) where Oxlint supports them; check with `oxlint --rules` rather than assuming.

### No empty try/catch

Never leave a `catch` empty. To swallow intentionally, call `noop()`. If the error matters, handle or log it.

`noop()` and other shared code never go in a `lib` folder:

- Single repo: `shared/helpers` or `shared/utilities`.
- Monorepo with a shared package: put it in that package, not scoped to one app.

### A lone local type is named Props

When a file declares a single, non-exported type, name it `Props`. If the type is exported, or the file has more than one type, give each a descriptive name.

## Comments

Code explains itself through names, types and structure. Never narrate what the next line does. If a comment seems needed, rename something or extract a well-named function.

Only three kinds of inline comment are allowed, each at most one line:

- A monkey patch or workaround: why it is needed, not what it does.
- A regex or genuinely opaque expression: what it matches or computes.
- A `TODO`.

Shared helpers and core API or business-logic functions get no inline comments. Every exported function in those files gets a JSDoc block with exactly `@name`, `@description` and `@example`:

```ts
/**
 * @name canCancelOrder
 * @description Determines whether an order can be cancelled based on its
 * current status and fulfillment state.
 *
 * @example
 * if (canCancelOrder(order)) {
 *   await cancelOrder(order.id);
 * }
 */
function canCancelOrder(order: TOrder): boolean {}
```

Nowhere else: no JSDoc on components, local functions or one-off code.

Before finishing, search the diff for added comments with `rg` (fall back to `grep`) and delete any that fit none of the above. Do this silently; mention it only if something could not be resolved.

## Types and data layer

### Name types after what a value represents

Values with a stable domain meaning get a named alias, never a bare primitive. Declare shared semantic aliases once in `src/store/semantic.ts` and import them from there; never redeclare them.

```ts
export type ID = string
export type Time = string
export type Timestamp = string

export type Timestamps<Deleted extends boolean = false> = {
  createdAt: Timestamp
  updatedAt: Timestamp
} & (Deleted extends true ? { deletedAt: Timestamp | null } : {})

export type Entity<Deleted extends boolean = false> = {
  id: ID
} & Timestamps<Deleted>

export type Sequence = number
export type Rank = string
export type Nullable<Value> = Value | null
export type Versioned<Value> = {
  value: Value
  sequence: Sequence
}
```

- **Semantic time types are consistent.** `Time` is a time without a date; `Timestamp` is an absolute point in time. Their representations are defined once and never vary between domains.
- **Entities have a standard identity and lifecycle.** Use `Entity` for models with `id`, `createdAt` and `updatedAt`. Use `Entity<true>` when soft deletion is part of the model.
- **Timestamps are standardized.** Never declare `createdAt`, `updatedAt` or `deletedAt` with raw primitives. They come from `Timestamps` or `Entity`.
- **Identifiers are named per entity when useful.** `IssueID`, `ProjectID` and `LabelID` may alias `ID`. Use branded types only when a nominal guarantee is actually required.
- **Finite states are literal unions.** `WorkflowStatus`, `Priority`. Never `string`.
- **Alias only stable concepts.** `ID`, `Time`, `Timestamp`, `Sequence` and `Rank` qualify. `Title`, `Description` and `Count` do not; leave them as `string` and `number`.
- **Absent, cleared and set are different states.** Use `Nullable<T>` when a property always exists but may hold no value. Use `?` only when the property itself may be omitted. In mutation payloads, absent means leave it, `null` means clear it, a value means set it. Never use `T | null | undefined` in persisted models, and do not add a `Maybe<T>` alias.
- **Versioning has one strategy.** Per-field conflict metadata sits next to the value as `Versioned<T>`.
- **Do not invent alternative representations.** If a semantic type exists, use it. When a new stable concept appears, add its canonical alias before using the primitive.

```ts
// Bad
type Issue = {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  status: string
}

// Good
type Issue = Entity & {
  title: string
  status: WorkflowStatus
}

type Project = Entity<true> & {
  name: string
}
```

### Create and update inputs derive from Entity

`CreateInput<T>` strips the managed fields (`id`, timestamps). `UpdateInput<T>` makes the rest partial and keeps `id` required. Never hand-write `Omit<T, 'id' | 'createdAt' | ...>` at call sites.

### Schemas use shared helpers for managed columns

Whatever the ORM or schema tool (Drizzle, Prisma, Zod, SQL migrations), never hand-write the `id` + timestamps block per table. Define it once as a helper (for Drizzle, `baseEntitySchema({ withDeleted })`) and spread it. Soft-deleted tables get `deletedAt`, and their reads filter out deleted rows.

## Type-safety linting

### The anti-slop rule set

No chained type assertions, no widen-then-assert, no known-value widening, no `unknown` parameters, returns or type aliases, no unsafe dictionary types, no object parameters, no runtime `typeof` checks, no shape names in symbol names, no `Reflect.get`/`Reflect.apply`, no module mocking, no conditional empty-object spreads. Every type assertion needs a safety comment.

### Fix findings properly, never launder them

Resolve with inference, `as const`, `satisfies`, named owner contracts and boundary parsing. Never suppress a rule, weaken its severity, add unsafe casts, or mechanically launder types to make lint pass.

## Working habits

### Preserve unrelated work

Check `git status` before changing a repo and leave unrelated changes alone. Don't overwrite existing files without reviewing the diff.

### Read the repo instead of guessing

Get the stack, versions and paths from the manifests, lockfiles and git remote. Install current dependency versions rather than ones remembered from training.

## Writing voice

Applies to all prose: READMEs, docs, commit messages, UI copy.

- **Plain declaratives with concrete specifics.** Say what the thing does.
- **Never use em dashes.** A comma, a full stop or a rewrite handles every case.
- **No AI marketing scaffolding.** No "Why this is fast", "Why this matters", "Key benefits", "Built with love". No emoji headings, no exclamation marks, no "blazing" unless the project already says it about itself, no closing invitation to contribute or star.
- **No promotional claims.** Do not add claims whose purpose is to make the project sound better, more impressive or more desirable: performance numbers, benchmarks, comparisons, "better than" claims, benefit lists, adoption numbers, superlatives. State concrete facts instead.
- **No placeholder survives.** If a placeholder can't be filled truthfully, drop the line or the section.
- **Never pad to reach a count.** A template shape is a ceiling, not a target. Whatever flows and fits the project wins over the template.

## READMEs

Before creating or restructuring a README, read `references/readme.md` for section order, header, badges, demo, install and footer. The rules below apply to every README.

- **A README is a landing page, not documentation.** Include a logo if one exists, and a demo GIF, screenshot or other graphic if one exists. Depth can live anywhere it already exists and is linked, not restated. There is no line limit.
- **The intro explains, it does not sell.** The first lines say what the project is and what it does, in plain language. No jargon, feature lists, benefits or implementation details.

  Good:

  > # Dora
  >
  > A free, open-source database client for working with local and remote data.

  Bad:

  > # Dora
  >
  > A Tauri-powered Rust-native data workflow platform with SQL, Drizzle, Prisma, AI integrations, Docker support, and cloud connectivity.

- **Dictionary-entry pitch when the name is a real word.** If the project name is an existing word (often Frisian, Latin or Dutch) and its meaning fits, open with the word, its part of speech, pronunciation and origin, then one plain paragraph. Examples in `references/readme-pitches.md`. Otherwise use a one-line pitch.
- **Never include meta sections.** No Contributing, Security, table of contents, roadmap, "Why this exists", comparison tables, Star History charts or similar. Link `CONTRIBUTING.md` and `SECURITY.md` in one sentence at the end of Development.
- **License lives in the footer sign-off.** Never a `## License` heading and never "MIT. See LICENSE for details". The footer is a greeting (default `xxx`), the name, and the license in `<small>`, optionally one PS line. Nothing follows it.

## Reporting back

### End-of-task summaries are extremely condensed

State only:

- **What changed:** relevant files, behavior or architecture changes.
- **Completion:** whether the requested task is complete. If it is fully done, say so clearly.
- **Checks:** tests, builds, linting or other checks, only when requested or otherwise relevant.
- **Follow-up:** only genuinely useful follow-up, such as required migrations, related code that still needs updating, remaining code-style inconsistencies, known limitations, or something worth investigating noticed during the task.

If something remains incomplete, state exactly what remains and where. Do not imply that completed work is unfinished. Keep it to a few sentences or a tight bullet list.

### Failed checks and risks are always stated

Always mention material failures, risks, unresolved issues, blocked work or limitations that could affect the result or the user's next step. Keep them concise and actionable. Do not report trivial warnings, irrelevant details or speculative risks to fill the summary.

### No process narration or filler

No restating the request, no headers for short answers, no "let me know if…" offers, no implementation narrative, no generic recommendations, no invented follow-ups.

### Interim updates are one short line

Only when changing direction or finding something load-bearing.

### Example

```text
Removed the wildcard grep rule from `.claude/settings.local.json`. The change is complete; `jq` validates the file, and the warning is gone on the next launch.
```
