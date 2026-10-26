---
name: use-shortcut
description: Add typed keyboard shortcuts to React or plain JavaScript apps with @remcostoeten/use-shortcut 3.x (beta). Use when code imports createShortcuts from "@remcostoeten/use-shortcut/react" or "@remcostoeten/use-shortcut", writes chains like shortcut.mod.key("k").on(...), sequences with .then, holds with .hold(), pauses with .then.wait(ms), alternatives with .or, scopes with .in() including the built-in web and desktop host scopes for Tauri 2, ShortcutProvider, ShortcutBoundary, useShortcutList, useRegistry, or the registry API (createRegistry, registry.enable, registry.list).
---

Add keyboard shortcuts with `@remcostoeten/use-shortcut` 3.x. One `createShortcuts()` per app, then one chain per shortcut. The chain is typed so autocomplete only offers what is valid next.

## Install

3.x is in beta on the `beta` tag. 2.x stays on `latest`.

```bash
bun add @remcostoeten/use-shortcut@beta
```

3.x is a rewrite and is not API-compatible with 2.x. Do not mix the two or port 2.x code line by line; rewrite bindings as chains. React 18 or newer is an optional peer, needed only for the `/react` entry. Output is ESM only. Entries: `@remcostoeten/use-shortcut` (plain) and `@remcostoeten/use-shortcut/react`.

## Workflow

1. Check the context: where focus lives, open dialogs, text inputs, which groups of shortcuts switch on and off, and whether the app also ships as a Tauri 2 desktop app.
2. Create one module that calls `createShortcuts` and exports the result. Declare every scope name used in `.in()`, including `web` and `desktop` if host-specific combos are needed.
3. Write each shortcut as a chain ending in `.on(handler)`. In React, `.on()` is a hook: call it unconditionally in a component body, never in a callback, loop or condition.
4. Show `handle.display` in the UI instead of hand-written labels.
5. Run the app's typecheck. Key names, modifiers and scope names are closed unions, so typos fail to compile.

## React

```tsx
import { createShortcuts } from "@remcostoeten/use-shortcut/react"

export const { shortcut, ShortcutProvider, ShortcutBoundary, useShortcutList } = createShortcuts({
    scopes: ["app", "editor"],
})

function Root() {
    return (
        <ShortcutProvider scopes={["app"]}>
            <Palette />
        </ShortcutProvider>
    )
}

function Palette() {
    const [open, setOpen] = useState(false)
    const handle = shortcut.mod
        .key("k")
        .describe("Open the palette")
        .on(() => setOpen(true))
    return <kbd>{handle.display}</kbd>
}
```

The scopes passed to `createShortcuts` only type `.in()`. The `scopes` prop on `ShortcutProvider` decides which start enabled. Switch them at runtime with `useRegistry().enable("editor")` and `.disable(...)`; `useRegistry` is imported from `@remcostoeten/use-shortcut/react`.

## Plain JavaScript and Tauri

```ts
import { createShortcuts } from "@remcostoeten/use-shortcut"

const { shortcut, registry } = createShortcuts({ scopes: ["app"] })

const palette = shortcut.mod.key("k").in("app").on(openPalette)
registry.enable("app")
palette.unbind()
```

Here `scopes` both types `.in()` and starts those scopes enabled. The registry listens on `window` and works the same in a Tauri 2 window.

## Chain cheatsheet

```ts
shortcut.mod.key("k").on(open)
shortcut.mod.shift.key("p").on(commands)
shortcut.key("g").then.key("d").on(goDashboard)
shortcut.key("j").then.wait(300).key("k").on(jump)
shortcut.hold("space").on(({ phase, duration }) => setPeeking(phase === "start"))
shortcut.key("escape").or.mod.key("d").on(close)
shortcut.key("j").in("app").except("modal").priority(5).on(next)
shortcut.mod.key("s").allowInInputs().on(save)
```

- `mod` is Cmd on a Mac and Ctrl elsewhere. After `mod`, `ctrl` and `meta` are no longer offered; after any Shift variant, the other two are gone.
- Sequence steps must arrive within 1000 ms of each other. Holds fire `start` at 500 ms and `release` on keyup; a shorter press is a tap, so `key("c")` and `hold("c")` can coexist. Change both on the provider or registry with `sequenceTimeout` and `holdThreshold`.
- `wait(ms)` only follows `.then` and must be followed by `key` or `hold`.
- Each option (`in`, `except`, `allowInInputs`, `priority`, `describe`) can be used once, and after the first option `then` and `or` are gone. Options after the last `.or` alternative apply to all of them.
- Text inputs, textareas, selects and contenteditable skip every binding unless it calls `.allowInInputs()`.
- A binding without `.in()` is global.

## Host scopes for Tauri 2

`web` and `desktop` are built-in scopes. Only the detected host starts enabled (`detectHost()` reads the `isTauri` flag Tauri 2 injects), and enabling one disables the other. `.in()` always accepts them; do not list them in `scopes`:

```tsx
export const { shortcut, ShortcutProvider } = createShortcuts({ scopes: ["app"] })

shortcut.mod.key("n").in("desktop").on(newNote)
shortcut.mod.shift.key("n").in("web").on(newNote)
```

Listing `web` or `desktop` in `scopes` (or the provider's `scopes` prop) enables both, which defeats the split.

## Rules

- Say "combo" for keys held together, never any other term.
- Do not bind combos browsers keep (`mod+w`, `mod+t`, `mod+n`, `mod+q`, `mod+l`, `mod+shift+t`, `ctrl+tab` and similar) on the web; put them under `desktop`. The registry warns about them in development.
- Use `.except("modal")` for page shortcuts that must stay silent while a dialog is open.
- Use a nested `ShortcutProvider` with `inherit={["mod+k"]}` for an isolated region, and `ShortcutBoundary disabled={...}` to pause shortcuts in a subtree.
- There is no `hyper` modifier; write `ctrl.alt.shift.meta`.

## References

- `references/chain.md`: every chain stage, key names, options, handler events, handles.
- `references/react.md`: `createShortcuts`, `ShortcutProvider`, `ShortcutBoundary`, hooks.
- `references/registry.md`: plain entry, `createRegistry`, host scopes, low-level exports.

Design reasoning for every rule lives in `DECISIONS.md` in the package repo (`v3` branch).
