# Chain reference (3.0.0-beta.0)

`shortcut` comes from `createShortcuts()` in either entry. Every stage is an immutable object, so a partial chain such as `const cmd = shortcut.mod` can be reused.

## Stages

| Stage | Members | Notes |
| --- | --- | --- |
| Step | `ctrl`, `shift`, `lshift`, `rshift`, `alt`, `meta`, `mod`, `key(name)`, `hold(name, threshold?)` | Root of the chain and what follows `.then` or `.or` |
| After `key` / `hold` | `then`, `or`, every option, `on` | |
| After `then` | step members plus `wait(ms)` | |
| After `wait(ms)` | step members only | No `then`, `or`, `wait` or `on` until a key or hold |
| After an option | the unused options and `on` | `then` and `or` are gone |

## Modifiers

| Getter | Meaning | Removes from the rest of the step |
| --- | --- | --- |
| `mod` | Cmd on a Mac, Ctrl elsewhere | `mod`, `ctrl`, `meta` |
| `ctrl` | Control | `ctrl`, `mod` |
| `meta` | Cmd on a Mac, Windows key elsewhere | `meta`, `mod` |
| `alt` | Alt, Option on a Mac | `alt` |
| `shift` | Either Shift | `shift`, `lshift`, `rshift` |
| `lshift` / `rshift` | Left or right Shift, from `event.location` | `shift`, `lshift`, `rshift` |

Modifiers match exactly: extra held modifiers mean no match. With Alt held, the physical key (`event.code`) is matched, so `alt.key("k")` works on a Mac. Shifted characters assume a US layout (`?` is `shift.key("slash")`). There is no `hyper`.

## Key names

A closed union, exported at runtime as `KEY_NAMES`:

- Letters `a` to `z`, digits `0` to `9`, `f1` to `f12`
- `enter`, `escape`, `space`, `tab`, `backspace`, `delete`
- `up`, `down`, `left`, `right`, `home`, `end`, `pageup`, `pagedown`
- `plus`, `minus`, `equals`, `comma`, `period`, `slash`, `semicolon`, `quote`, `backtick`
- Aliases: `dot` for `period`, `singlequote` for `quote`

Letters ignore case. Untyped code with an unknown name throws in development with a suggestion.

## Steps

```ts
shortcut.key("g").then.key("d").on(goDashboard)
shortcut.key("a").then.wait(300).key("b").on(archive)
shortcut.hold("space", 300).on((event) => setPeeking(event.phase === "start"))
shortcut.mod.hold("k").on(showHints)
shortcut.key("escape").or.mod.key("d").on(close)
```

- Sequence: each step must arrive within the sequence timeout (default 1000 ms) of the previous one. A wrong key resets progress. Auto-repeat and bare modifier presses never advance or break a sequence.
- Overlap: a binding that is also the start of a longer one fires once the window passes or another key breaks the sequence.
- Wait: `wait(ms)` makes the next step arrive at least `ms` after the previous one and still inside the timeout. A chain cannot start with a wait, and `ms` must be below the timeout.
- Hold: `start` fires at the threshold (default 500 ms), `release` on keyup with the real duration. Releasing earlier counts as a tap. The keydown that begins a hold is prevented, so `hold("space")` does not scroll.
- Or: each alternative is its own binding; the handle controls all. `combo` reads `"escape | mod+d"`, `display` joins with ` / `, `trigger()` runs the first.

## Options

Each can be used once per chain.

| Option | Effect |
| --- | --- |
| `.in(scope)` / `.in([a, b])` | Fires only while at least one of the scopes is enabled. Names come from `createShortcuts({ scopes })` |
| `.except(rule)` | Skip on `"typing"`, `"modal"` (a target outside an open dialog), `"disabled"` (disabled target) or a predicate `(target: Element \| null) => boolean` |
| `.allowInInputs()` | Fire inside text inputs, textareas, selects and contenteditable |
| `.priority(n)` | Among bindings matching the same key event only the highest fires. Default 0 |
| `.describe(text)` | Help text, returned as `description` by `list()` and `useShortcutList()` |

## Handler events

```ts
shortcut.mod.key("k").on(({ combo, event }) => {})
shortcut.hold("space").on(({ combo, phase, duration }) => {})
```

- Press (`PressEvent`): `{ combo, event: KeyboardEvent | null }`. `event` is null when a timer or `trigger()` fired it.
- Hold (`HoldEvent`): `{ combo, phase: "start" | "release", duration }`.

`preventDefault` is called only on the keydown that completes a match and only when a handler ran.

## Handle

`on()` returns a handle:

| Member | Meaning |
| --- | --- |
| `id` | Binding id |
| `combo` | Literal type of the written combo, such as `"mod+shift+k"` or `"g then d"` |
| `display` | Platform label: `⌘K` on a Mac, `Ctrl+K` elsewhere |
| `isEnabled()`, `enable()`, `disable()` | Toggle this binding only |
| `unbind()` | Remove it (React does this on unmount) |
| `trigger()` | Run the handler now with `event: null` (holds get `start`, duration 0) |

Written combos order modifiers `mod, ctrl, meta, alt, shift`, whatever order the chain used.
