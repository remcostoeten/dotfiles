# React reference (3.0.0-beta.0)

```tsx
import { createShortcuts, useRegistry } from "@remcostoeten/use-shortcut/react"
```

## createShortcuts

```tsx
export const { shortcut, ShortcutProvider, ShortcutBoundary, useShortcutList } = createShortcuts({
    scopes: ["app", "editor"],
})
```

Call it once in a module and export the result. `scopes` is optional and only types `.in()`; without it `.in()` accepts nothing. `shortcut.<chain>.on(handler)` is a hook: it registers in an effect, always runs the latest handler, unbinds on unmount and does not re-register on re-render while the definition stays the same. `handle.combo` and `handle.display` are ready on the first render.

## ShortcutProvider

| Prop | Meaning |
| --- | --- |
| `scopes` | Scopes enabled at mount. Read once |
| `inherit` | Combos from an outer provider that still fire inside this nested one, such as `["mod+k"]` |
| `sequenceTimeout` | Milliseconds between sequence steps. Default 1000. Read once |
| `holdThreshold` | Milliseconds before a hold starts. Default 500. Read once |
| `platform` | `"mac"` or `"other"`, to make server and client `display` agree. Default `detectPlatform()` |

Every `.on()` must sit below a provider; hooks throw outside one. The outermost provider also receives keys pressed while nothing has focus. A nested provider is an isolated region: its bindings fire only inside it, and outer bindings do not fire inside it unless listed in `inherit`. Keys from portals rendered inside a provider count as inside it.

```tsx
<ShortcutProvider scopes={["editor"]} inherit={["mod+k"]}>
    <Editor />
</ShortcutProvider>
```

## ShortcutBoundary

```tsx
<ShortcutBoundary disabled={isRenaming}>
    <Sidebar />
</ShortcutBoundary>
```

While `disabled` is true, keydowns inside it do not reach the provider. Keyups still pass so a hold can release. Element `onKeyDown` handlers inside keep working.

## Hooks

- `useShortcutList()`: active bindings of the nearest provider as `BindingInfo[]` (`id`, `combo`, `display`, `description`, `scopes`, `enabled`). Re-renders when bindings or scopes change.
- `useRegistry()`: the nearest provider's `Registry` for `enable`, `disable`, `isEnabled`, `list`. Import it from the `/react` entry; it is not part of the `createShortcuts` result.
- `useBinding(definition, handler)`: the hook behind `.on()`, taking a raw `BindingDefinition`. Prefer the chain.

```tsx
function Help() {
    const bindings = useShortcutList()
    return (
        <ul>
            {bindings.map((binding) => (
                <li key={binding.id}>
                    <kbd>{binding.display}</kbd> {binding.description}
                </li>
            ))}
        </ul>
    )
}

function EditorToggle() {
    const registry = useRegistry()
    return <button onClick={() => registry.enable("editor")}>Edit</button>
}
```

Scope changes go through the registry, not provider props, since those are read once at mount.
