# Plain entry and registry reference (3.0.0-beta.0)

```ts
import { createShortcuts, createRegistry, detectHost } from "@remcostoeten/use-shortcut"
```

## createShortcuts (plain)

```ts
const { shortcut, registry } = createShortcuts({ scopes: ["app"], holdThreshold: 400 })
```

Options are `RegistryOptions`. `scopes` types `.in()` and starts those scopes enabled. `.on()` calls `registry.add` directly and returns the handle; call `handle.unbind()` yourself.

## RegistryOptions

| Option | Meaning |
| --- | --- |
| `scopes` | Scopes enabled at start |
| `platform` | `"mac"` or `"other"`. Default `detectPlatform()` |
| `host` | `"web"` or `"desktop"`. Default `detectHost()` |
| `sequenceTimeout` | Default 1000 ms |
| `holdThreshold` | Default 500 ms |
| `target` | `Window` or `HTMLElement` to listen on. Default `window` |

## Registry

| Member | Meaning |
| --- | --- |
| `add(definition, handler)` | Register a raw `BindingDefinition`, returns a `Handle` |
| `enable(scope)` / `disable(scope)` / `isEnabled(scope)` | Switch scopes. Changing the active set resets sequence progress |
| `list()` | Active bindings as `BindingInfo[]` |
| `subscribe(listener)` | Called after any binding or scope change. Returns an unsubscribe function |
| `interrupt()` | End started holds with `release` and reset progress. Runs on window blur and `visibilitychange` |
| `destroy()` | Remove listeners |

```ts
const registry = createRegistry({ scopes: ["app"] })
const handle = registry.add(
    { steps: [{ kind: "press", key: "k", modifiers: ["mod"] }], scopes: ["app"], description: "Palette" },
    () => openPalette(),
)
```

`BindingDefinition`: `steps` (each `{ kind: "press" | "hold", key, modifiers, minDelay?, threshold? }`, `threshold` on holds only), plus optional `scopes`, `except`, `allowInInputs`, `priority`, `description`. Prefer the chain; use `add` when definitions come from data.

An invalid binding throws in development and in production warns and returns a dead handle whose `isEnabled()` is false. Development also warns when a combo is bound twice in overlapping scopes and when a `web` binding uses a combo browsers keep.

## Host scopes and Tauri 2

- `detectHost()` returns `"desktop"` when `globalThis.isTauri` is true (Tauri 2 injects it) and `"web"` otherwise. Tauri 1 is not supported.
- `web` and `desktop` are built-in scopes. Only the detected host starts enabled, and `enable("web")` or `enable("desktop")` disables the other.
- `.in()` always accepts them. Do not list them in `scopes`, because listing enables both:

```ts
const { shortcut } = createShortcuts({ scopes: ["app"] })

shortcut.mod.key("n").in("desktop").on(newNote)
shortcut.mod.shift.key("n").in("web").on(newNote)
```

## Low-level exports

For custom drivers and tests:

- Matcher (pure, time passed in): `createMatcher`, `handleKey`, `advanceTime`, `interrupt`, `nextDeadline`, `IDLE_STATE`
- Browser: `createDriver`, `shouldSkip`, `isTextTarget`, `isModalOpen`
- Keys and labels: `KEY_NAMES`, `MODIFIERS`, `isKeyName`, `resolveKey`, `formatCombo(steps)`, `displayCombo(steps, platform)`
- Environment: `detectPlatform`, `detectHost`
- Chain: `createChain(scopes, bind)`
