---
name: semantic-types-drizzle
description: Implements the semantic typing pattern for TypeScript domain models and Drizzle ORM schemas. Use this skill whenever the user wants to set up types for a new domain, add a database table with Drizzle, define entity types, create a data access layer (DAL), or asks about type organization, base types, shared types, timestamps, soft deletes, or schema helpers. Trigger even if they only mention "set up a Drizzle table", "add a new entity", "type a domain model", or "how should I structure my types" — this pattern applies broadly to any TypeScript + Drizzle project.
---

## What this pattern is

Semantic typing means naming types after what a value *represents*, not just its primitive shape. Instead of `id: string | number` or `createdAt: string`, you declare:

```ts
// types/semantics.ts
export type ID = string
export type Timestamp = string

export type Nullable<T> = T | null
export type Maybe<T> = T | null | undefined
```

`CreateInput` and `UpdateInput` depend on `Entity` so they live in `base.ts` instead:

```ts
// types/base.ts
export type CreateInput<T extends Entity> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type UpdateInput<T extends Entity> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>> & { id: ID }
```

`Nullable<T>` is for values that are explicitly `null` — typically a DB column that can hold null. `Maybe<T>` covers the broader case where a value may also simply be absent (`undefined`), useful for optional function arguments or unresolved async state.

```ts
type avatarUrl = Nullable<string>   // stored in DB, explicitly null when unset
type searchQuery = Maybe<string>    // may not exist at all yet
```

Then build shared base structures on top of them:

```ts
// types/base.ts
import type { ID, Timestamp } from './semantics'

export type Timestamps = {
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt?: Timestamp
}

export type Entity = {
  id: ID
} & Timestamps
```

Every persisted domain model extends `Entity`:

```ts
// features/posts/post.types.ts
import type { Entity } from '@/shared/types/base'
import type { ID, Timestamp } from '@/shared/types/semantics'

export type Post = Entity & {
  authorId: ID
  title: string
  slug: string
  content: string
  published: boolean
  publishedAt?: Timestamp
  tags: string[]
}
```

## Why bother

- **Single source of truth for primitives.** Switching IDs from UUID strings to numeric auto-increments? Change `ID = string` to `ID = number` in one file and the compiler propagates it everywhere.
- **Self-documenting fields.** `authorId: ID` tells a reader what kind of value to expect and that it references another entity's `id`. `authorId: string` tells them nothing.
- **Generic data layer.** `T extends Entity` constrains generic functions without caring about the concrete type:

```ts
async function create<T extends Entity>(table: string, data: T): Promise<T> {
  // ...
}
```

## File layout

```
src/
  shared/
    types/
      semantics.ts   ← primitive aliases (ID, Timestamp, UUID, …)
      base.ts        ← Timestamps, Entity
  features/
    <domain>/
      <domain>.types.ts  ← extends Entity
      <domain>.dal.ts    ← pure DB functions
      <domain>.actions.ts ← server actions with Zod
  db/
    schema/
      schema-helpers/
        base.ts       ← baseEntitySchema(), timestampsSchema()
      <domain>.schema.ts
```

For a monorepo, `shared/types/` lives in the shared package and is imported by both API and frontend packages.

## Drizzle schema helpers

Create reusable helpers so you never repeat the `id + timestamps` block manually:

```ts
// db/schema/schema-helpers/base.ts
import { timestamp, uuid } from 'drizzle-orm/pg-core'
import type { ID, Timestamp } from '@/shared/types/semantics'

export function timestampsSchema(opts?: { withDeleted?: boolean }) {
  return {
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$type<Timestamp>(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$type<Timestamp>(),
    ...(opts?.withDeleted
      ? {
          deletedAt: timestamp('deleted_at', { withTimezone: true })
            .$type<Timestamp>()
        }
      : {})
  }
}

export function baseEntitySchema(opts?: { withDeleted?: boolean }) {
  return {
    id: uuid('id').primaryKey().defaultRandom().$type<ID>(),
    ...timestampsSchema(opts)
  }
}
```

Use them in table definitions:

```ts
// db/schema/posts.schema.ts
import { pgTable, text, boolean } from 'drizzle-orm/pg-core'
import { baseEntitySchema } from './schema-helpers/base'

export const posts = pgTable('posts', {
  ...baseEntitySchema({ withDeleted: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  published: boolean('published').notNull().default(false)
})
```

`{ withDeleted: true }` opts a table into soft deletes by adding `deletedAt`. Omit the option and the column does not appear.

## CreateInput and UpdateInput

`CreateInput<T>` strips all managed fields (`id`, timestamps) so callers only provide the domain-specific data. `UpdateInput<T>` makes those same fields partial but keeps `id` required so you always know what row to update.

```ts
import type { CreateInput, UpdateInput } from '@/shared/types/semantics'
import type { Post } from './post.types'

export async function createPost(data: CreateInput<Post>): Promise<Post> {
  const [post] = await db.insert(posts).values(data).returning()
  return post
}

export async function updatePost(data: UpdateInput<Post>): Promise<Post> {
  const [post] = await db
    .update(posts)
    .set(data)
    .where(eq(posts.id, data.id))
    .returning()
  return post
}
```

No more manually typing `Omit<Post, 'id' | 'createdAt' | 'updatedAt'>` at every call site.

## Data access layer (DAL)

Pure functions — no client-side DB leakage. One file per domain:

```ts
// features/posts/posts.dal.ts
import { db } from '@/db'
import { posts } from '@/db/schema/posts.schema'
import { eq } from 'drizzle-orm'
import type { Post } from './post.types'
import type { ID } from '@/shared/types/semantics'

export async function createPost(data: Post): Promise<Post> {
  const [post] = await db.insert(posts).values(data).returning()
  return post
}

export async function getPostsByAuthor(authorId: ID): Promise<Post[]> {
  return db.select().from(posts).where(eq(posts.authorId, authorId))
}
```

## Server actions

Validate at the boundary with Zod, then delegate to the DAL:

```ts
// features/posts/posts.actions.ts
'use server'

import { z } from 'zod'
import { createPost } from './posts.dal'

const createPostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  authorId: z.string().uuid()
})

export async function createPostAction(formData: FormData) {
  const parsed = createPostSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
    authorId: formData.get('authorId')
  })

  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

  await createPost(parsed.data)
  return { success: true }
}
```

## Checklist when adding a new entity

1. Add any new primitive aliases to `semantics.ts` if they don't exist yet.
2. Create `<domain>.types.ts` extending `Entity` (or `BaseEntity`).
3. Add `<domain>.schema.ts` spreading `baseEntitySchema()` — pass `{ withDeleted: true }` if the table needs soft deletes.
4. Write pure DAL functions in `<domain>.dal.ts`.
5. Write server actions in `<domain>.actions.ts` with Zod schemas validating at the boundary.

## Notes

- `type ID = string` is a type alias — the compiler treats `ID` and `string` as interchangeable. If you need the compiler to *prevent* mixing `UserId` and `PostId`, look into branded/nominal types (a separate pattern).
- `.$type<T>()` in Drizzle tells the ORM what TypeScript type to infer for that column — it does not affect the underlying SQL column type.
- `deletedAt` for soft deletes is optional per-table. Rows are soft-deleted by setting this field rather than issuing a `DELETE`. Add a `where(isNull(table.deletedAt))` guard to your read queries when using this.
