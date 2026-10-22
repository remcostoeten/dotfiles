---
name: instant-store
description: How to build the client state layer of an instant-feeling React app — a small dependency-free external store read through useSyncExternalStore with narrow selectors, normalised records, no-op update short-circuiting, and an optimistic write path where local state updates synchronously and durable work is queued as versioned operations with acks, rollback, and visible failure. Use this whenever the user is setting up state management for a local-first, optimistic, or "instant" app; asks whether to use Zustand/Redux/Jotai/context/TanStack Query for such an app; is debugging unnecessary re-renders, render cascades, or typing lag caused by store subscriptions; or is implementing optimistic create/update/delete/reorder with server reconciliation. Also use it when wiring any sync engine (Zero, Replicache-style, Electric, a custom log) into React, because the seam between engine and UI is defined here.
---

# Instant store

The state layer decides whether the contract in `instant-app` is achievable. Two properties matter and most stores get one of them wrong:

1. **Reads are narrow.** A component re-renders only when the exact value it renders changes.
2. **Writes are synchronous locally.** The store changes in the same event task as the input. Durability happens afterwards and never gates the paint.

React context fails property 1 (every consumer re-renders on any change). Server-cache libraries used as the primary store fail property 2 (the source of truth is a request away). An external store with selectors gets both. Zustand is an acceptable off-the-shelf version of this pattern; the hand-rolled one below is ~60 lines and removes a dependency from the hottest path in the app.

## Store shape

Normalise. Records live in `Map`s keyed by id; ordering and grouping live in separate index structures. A flat `Task[]` forces every consumer to depend on the whole array.

```ts
export type Selector<T> = (state: AppState) => T;
export type Equality<T> = (left: T, right: T) => boolean;
type Listener = () => void;

type Subscriber<T = unknown> = {
  selector: Selector<T>;
  equality: Equality<T>;
  selected: T;
  listener: Listener;
};

export function createStore(initial: AppState) {
  let state = initial;
  const subscribers = new Set<Subscriber>();

  function update(recipe: (current: AppState) => AppState) {
    const next = recipe(state);
    if (next === state) return;
    state = next;
    for (const subscriber of subscribers) {
      const selected = subscriber.selector(state);
      if (subscriber.equality(subscriber.selected, selected)) continue;
      subscriber.selected = selected;
      subscriber.listener();
    }
  }

  function subscribe<T>(selector: Selector<T>, listener: Listener, equality: Equality<T>) {
    const subscriber: Subscriber<T> = { selector, equality, selected: selector(state), listener };
    subscribers.add(subscriber as Subscriber);
    return () => subscribers.delete(subscriber as Subscriber);
  }

  function createBinding<T>(selector: Selector<T>, equality: Equality<T> = Object.is) {
    let selected = selector(state);
    return {
      getSnapshot: () => {
        const next = selector(state);
        if (!equality(selected, next)) selected = next;
        return selected;
      },
      subscribe: (listener: Listener) => subscribe(selector, listener, equality),
    };
  }

  return { getState: () => state, update, createBinding };
}
```

```ts
export function useStoreSelector<T>(store: Store, selector: Selector<T>, equality?: Equality<T>): T {
  const binding = useMemo(() => store.createBinding(selector, equality), [store, selector, equality]);
  return useSyncExternalStore(binding.subscribe, binding.getSnapshot, binding.getSnapshot);
}
```

Three details carry the performance:

- **`if (next === state) return`** — a recipe that changes nothing returns the same object, and the store stops before touching a single selector. Every reducer must preserve identity when its input is a no-op (completing an already-complete task, receiving a server echo of a write the client already applied). This is the difference between sync traffic being free and sync traffic re-rendering the app.
- **Equality runs in the store, not in React.** Listeners are only called for subscribers whose selected value changed, so React never schedules work for unaffected components.
- **`getSnapshot` returns the cached `selected`** when equal. `useSyncExternalStore` requires a stable snapshot; returning a fresh-but-equal object causes an infinite render loop.

## Selector rules

- Select the primitive or the single record a component renders: `(s) => s.tasks.get(id)?.title`, not `(s) => s.tasks`.
- Define selectors at module scope or build them with `useMemo`/`useCallback` keyed by id. An inline arrow creates a new binding every render.
- Returning a new array or object each call (`.filter`, `.map`, object literals) defeats `Object.is`. Either store the derived structure in state (updated at write time, identity preserved when unchanged) or pass a shallow/array equality function.
- Lists subscribe to an **id array**; rows subscribe to **their own record** by id. Changing one task's title then re-renders one row and zero lists.
- The app shell subscribes to nothing data-shaped. If the shell re-renders on data changes, everything beneath it is at risk.
- Keep transient interaction state (drag position, hover, in-progress text) local to the component or in a ref. It never belongs in the store or in context.
- Derive during render. Do not mirror store values into `useState` via effects.

## Write path

```text
user input
├─ store.update(...)          synchronous, same event task
├─ paint                      same frame
└─ queue.submit(operation)    fire and forget
   ├─ persist locally         IndexedDB / SQLite, off the interaction path
   ├─ send to server          batched, retried
   └─ ack → store.applyAck    carries the authoritative revision
```

Express writes as small, versioned, named operations rather than "save this object":

```ts
type Operation =
  | { type: "task.create"; id: string; title: string; rank: string }
  | { type: "task.setStatus"; id: string; status: Status }
  | { type: "task.move"; id: string; parentId: string | null; rank: string };

type Envelope = { opId: string; schemaVersion: 1; clientSequence: number; operation: Operation };
```

Why operations instead of record snapshots: they merge cleanly (two devices changing different fields do not clobber each other), they replay after a crash, they are what every sync engine ultimately wants, and one pure `reduce(state, operation)` function serves the optimistic path, the replay path, and the remote-apply path — a single source of truth for what each action means.

Rules for the path:

- Ids are generated on the client (UUIDv7 or nanoid) so a create never waits for the server to name the record.
- The pending queue is durable. Persist it before sending; on restart, replay unacknowledged operations on top of the restored snapshot.
- Acks carry revisions and are applied through the same no-op-preserving reducers. An ack for a write the UI already reflects must not change state identity.
- Remote changes must never rewind a record with pending local writes. Compare revisions; a pending local write wins until the server has sequenced it.
- **Failure is visible.** When the server rejects an operation, revert that operation's effect (re-derive from last acknowledged state plus remaining pending operations) and tell the user what was undone. Swallowing a rejection is silent data loss.
- Ordering uses fractional ranks so a reorder is one operation on one record.
- Debounce only the persistence of high-frequency values (text being typed), never the store update itself.

## Plugging in a sync engine

The engine sits behind the queue and the remote-apply entry point. The UI never imports the engine directly; it imports the store. That seam is what lets you start with a simple push/pull endpoint and move to something else later without touching components. If the engine ships its own reactive query hooks (Zero, TanStack DB), use them for data reads but keep the same discipline: narrow queries per component, persistent hosts, no loading states for cached data — and keep UI/session state in this store.

## Verifying

Add render-count assertions to tests for the allowances table in `instant-app`: type into an input and assert the shell rendered zero times; rename one task and assert exactly one row rendered. These catch subscription rot long before a frame budget fails. For timing proof, see `instant-perf-harness`.
