import { For, Show, createSignal } from "solid-js"
import type { Layer } from "@/shared/types/config"
import { Button } from "@/shared/components/button"
import { Dialog } from "@/shared/components/dialog"
import { KeyPickerButton } from "@/modules/mappings/components/key-picker"
import { keyLabel } from "@/modules/mappings/utilities/key-names"

type Props = {
  layers: Layer[]
  activeId: string | null
  triggers: string[]
  onSelect: (layerId: string | null) => void
  onCreate: (name: string) => void
  onRemove: (layerId: string) => void
  onTrigger: (key: string) => void
}

function layerName(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32)
}

export function LayerBar(props: Props) {
  const [adding, setAdding] = createSignal(false)
  const [name, setName] = createSignal("")
  const active = () => props.layers.find((layer) => layer.id === props.activeId)

  function tabClass(selected: boolean) {
    return `rounded px-2.5 py-1 text-[12px] transition-colors duration-150 ${
      selected ? "bg-surface-3 text-ink" : "text-ink-faint hover:text-ink-dim"
    }`
  }

  function commit() {
    const clean = layerName(name())
    if (clean && !props.layers.some((layer) => layer.name === clean)) {
      props.onCreate(clean)
    }
    setAdding(false)
    setName("")
  }

  return (
    <div class="flex flex-wrap items-center gap-3">
      <div role="tablist" aria-label="Layer" class="flex flex-wrap rounded-md bg-surface-2 p-0.5">
        <button
          type="button"
          role="tab"
          aria-selected={props.activeId === null}
          class={tabClass(props.activeId === null)}
          onClick={() => props.onSelect(null)}
        >
          Base
        </button>
        <For each={props.layers}>
          {(layer) => (
            <button
              type="button"
              role="tab"
              aria-selected={props.activeId === layer.id}
              class={tabClass(props.activeId === layer.id)}
              onClick={() => props.onSelect(layer.id)}
            >
              {layer.name}
            </button>
          )}
        </For>
        <button type="button" class={tabClass(false)} onClick={() => setAdding(true)}>
          + Layer
        </button>
      </div>

      <Show when={active()}>
        {(layer) => (
          <div class="flex flex-wrap items-center gap-2 text-[12px] text-ink-dim">
            <span>Hold</span>
            <KeyPickerButton
              label="Key that activates this layer"
              value={props.triggers[0] ?? ""}
              display={props.triggers.length > 0 ? props.triggers.map(keyLabel).join(", ") : "choose a key"}
              onPick={props.onTrigger}
            />
            <span>to use {layer().name}. Unmapped keys fall through to Base.</span>
            <Button variant="ghost" onClick={() => props.onRemove(layer().id)}>
              Delete layer
            </Button>
          </div>
        )}
      </Show>

      <Dialog
        open={adding()}
        onClose={() => setAdding(false)}
        title="New layer"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={layerName(name()) === ""} onClick={commit}>
              Create
            </Button>
          </>
        }
      >
        <input
          ref={(el) => queueMicrotask(() => el.focus())}
          class="w-full rounded border border-line bg-surface-2 px-2 py-1 text-[12.5px]"
          placeholder="layer name (e.g. nav)"
          aria-label="Layer name"
          value={name()}
          onInput={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => event.key === "Enter" && commit()}
        />
        <p class="mt-2 text-[12px] text-ink-faint">
          A layer is a second set of shortcuts that is active while you hold its trigger key.
        </p>
      </Dialog>
    </div>
  )
}
