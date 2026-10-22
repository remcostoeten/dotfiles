---
name: instant-sync-choice
description: Decision guide for how data gets between the client and the server in a local-first, optimistic, or offline-capable app — choosing between Zero, a self-built Replicache-style push/pull log, TanStack DB with ElectricSQL, LiveStore, PowerSync, hosted options (InstantDB, Convex, Jazz, Triplit), CRDTs (Yjs, Automerge), or a native SQLite core with a custom operation log. Explains which data shapes need which machinery, what each option costs to operate, and the minimal protocol if building your own. Use this whenever the user asks which sync engine, local-first framework, realtime backend, or offline strategy to use; whether they need CRDTs; how Linear's sync works; how to add multi-device or multi-user sync to an app; or is about to hand-roll sync. Always check each candidate's live documentation before recommending, because this field changes quickly.
---

# Choosing a sync approach

Sync is where local-first projects spend most of their time and hit most of their bugs. The UI-side rules (`instant-app`, `instant-store`) cost days; hand-built convergence can cost months. So pick the least machinery the data actually requires.

**Verify before recommending.** Products in this space change pricing, licensing, maturity, and APIs within months. Before giving a final recommendation, fetch the current docs and recent release notes of the shortlisted options and check: is it production-ready, is it self-hostable, how do permissions work, what is the offline story, what happens on schema change. Treat the table below as a map, not as current facts. When a Context7 MCP server is available, use it for the shortlisted libraries' API documentation and fall back to fetching the official docs otherwise; either way read the release notes, because API docs do not reveal maturity, licensing, or pricing.

## Start from the data, not the tool

| Question | If yes |
| --- | --- |
| Are records small and structured (tasks, issues, settings)? | Field-level last-write-wins ordered by a server sequence is enough. No CRDT. |
| Do several people edit the **same long text** at once? | That field needs a text CRDT or OT (Yjs, Automerge). Scope it to that field; keep everything else simple. |
| Is the server allowed to be the authority? | Server-ordered log. Far simpler than peer-to-peer convergence. |
| Must it work with no server at all, or must the server never see plaintext? | Local-canonical storage, and end-to-end encryption rules out server-side queries and permissions — a much harder design. Confirm the requirement is real. |
| Does the full working set fit in memory (tens of thousands of small rows)? | Sync everything, query in memory. Partial replication is unnecessary. |
| Does it not fit, or do permissions differ per row? | You need partial sync with server-enforced filters — favour engines that provide it. |

A Linear-style task app answers: structured, server-authoritative, fits in memory. That is the easy quadrant. Linear's own engine is an in-memory object graph persisted to IndexedDB, optimistic transactions, and a server-ordered delta stream over WebSocket — no CRDTs, no client SQL.

## Options

| Option | Model | Reach for it when | Watch out for |
| --- | --- | --- | --- |
| **Zero** (Rocicorp) | Postgres authoritative; client cache answers queries instantly, server keeps them live; custom mutators; row-level permissions | Linear-style multi-user apps on Postgres; you want sync solved, not built | Young; you operate a cache service beside Postgres; offline writes are limited by design |
| **Self-built push/pull log** (Replicache pattern) | Client queues named mutations; server applies them in order and assigns a sequence; clients pull deltas since their cursor; WebSocket only pokes "pull now" | You want full ownership, small structured data, any backend (Postgres, or one Durable Object per workspace) | You own correctness: idempotency, cursors, schema evolution. Keep it to the minimal protocol below |
| **TanStack DB + ElectricSQL** | Electric streams Postgres "shapes" to the client; TanStack DB gives optimistic collections and live queries; writes go through your own API | Existing Postgres + REST/tRPC backend you want to make instant incrementally | Read path is provided, write path and conflict policy are yours |
| **LiveStore** | Event-sourced: events are the truth, client SQLite is a materialised view, events sync | You want an event log and SQL queries on the client; single-user or small-group data | Event schema evolution needs care; smaller ecosystem |
| **PowerSync** | Postgres/Mongo → client SQLite via sync rules; upload queue for writes | Mobile-heavy, large offline datasets, SQL on device | Heavier service; writes still go through your backend |
| **InstantDB / Convex / Jazz / Triplit** | Hosted or integrated backends with realtime built in | Shipping speed matters more than owning the backend | Lock-in; Convex is optimistic-online rather than offline-first; check self-hosting and export |
| **Yjs / Automerge** | CRDT documents | Collaborative rich text, whiteboards, the one field that truly needs merging | Wrong default for structured records: unbounded history, awkward permissions and querying |
| **Native SQLite core + custom operation log** | Canonical local database, operations replicated through an ordered cloud log | Large documents, user-owned single-file data, filesystem/Git integration, E2EE | The most expensive path by far: two storage runtimes (native + browser WASM/OPFS), generated cross-language contracts, hand-built convergence, tombstones, epochs. Justify it with requirements |

Whatever is chosen sits behind the store seam from `instant-store`, so components never import the engine and the choice stays reversible.

## Minimal protocol if building your own

Keep it this small; most sync bugs come from additions.

```text
POST /push   { clientId, mutations: [{ id, name, args }] }     id strictly increasing per client
GET  /pull   ?cursor=N → { cursor: M, changes: [...], lastMutationIds: { clientId: id } }
WS   /poke   server → "something changed", client pulls
```

- **Server**: one ordered log per workspace. Apply each mutation in a transaction: skip if `id <= lastMutationId[clientId]` (idempotent retries), run the named mutator with authorisation, bump the workspace sequence, stamp changed rows with it, record `lastMutationId`. A mutation that fails validation is recorded as applied-with-no-effect so the client stops retrying; the client learns it was rejected because its effect is absent after pull.
- **Client**: optimistic state = last pulled state + pending mutations replayed on top. After each pull, drop pending mutations with `id <= lastMutationIds[self]` and re-derive. That single rule gives rollback for free.
- **Conflicts**: last-writer-by-server-sequence per field. Deletes are tombstones carrying a sequence, never row absence, or a stale client resurrects them.
- **Ordering**: fractional rank strings, so concurrent reorders touch one row each.
- **Epochs**: if a client's local database is reset or restored from backup, it must take a new `clientId`. Reusing one makes `id` regress and every later push is silently skipped as a duplicate.
- **Schema**: version mutation names and args; the server accepts the previous version for as long as old clients exist.
- **Auth**: every push and pull is authenticated and authorised per workspace on the server. The client cache is never trusted.
- **Do not hold a database transaction open across network calls**, and keep sync entirely off interaction paths — it consumes the durable queue in the background.

Test it like a distributed system, because it is one: two simulated clients with interleaved pushes must converge to identical state; kill the client between persist and send and verify replay; replay the same push twice; apply changes out of expected order; restore an old snapshot and confirm the epoch rule holds.

## Recommendation pattern

State the data-shape answers first, then name one primary option and one fallback, then list what was verified in live docs and when. For a Linear-style authenticated web + desktop task app the usual answer is: Zero if adopting a young dependency is acceptable, otherwise the minimal push/pull log on Postgres or a per-workspace Durable Object — with a thin Tauri shell reusing the web client rather than a native data layer.
