import { Show, createSignal } from "solid-js"
import type { Mapping } from "@/shared/types/config"
import type { Issue } from "@/shared/types/native"
import { Button } from "@/shared/components/button"
import { KeyCap } from "@/shared/components/key-cap"
import { Select } from "@/shared/components/select"
import { Toggle } from "@/shared/components/toggle"
import { KeyCapture } from "@/modules/mappings/components/key-capture"
import { commonKeys, modifiers } from "@/modules/mappings/utilities/key-names"
import { appStore } from "@/app/utilities/store"

type Props = {
  mapping: Mapping
  profileId: string
  layerId: string | null
  layerNames: string[]
  issues: Issue[]
}

type MappingKind = "key" | "combo" | "layer" | "disable" | "macro" | "hold"

function kindOf(mapping: Mapping): MappingKind {
  if (mapping.source.mode === "hold") {
    return "hold"
  }
  return mapping.target.kind
}

export function MappingRow(props: Props) {
  const [capturing, setCapturing] = createSignal<"source" | "target" | null>(null)

  function update(recipe: (mapping: Mapping) => void) {
    appStore.updateProfile(props.profileId, (profile) => {
      const pool = props.layerId
        ? profile.layers.find((l) => l.id === props.layerId)?.mappings
        : profile.mappings
      const mapping = pool?.find((m) => m.id === props.mapping.id)
      if (mapping) {
        recipe(mapping)
      }
    })
  }

  function remove() {
    appStore.updateProfile(props.profileId, (profile) => {
      if (props.layerId) {
        const layer = profile.layers.find((l) => l.id === props.layerId)
        if (layer) {
          layer.mappings = layer.mappings.filter((m) => m.id !== props.mapping.id)
        }
      } else {
        profile.mappings = profile.mappings.filter((m) => m.id !== props.mapping.id)
      }
    })
  }

  function setKind(kind: string) {
    update((mapping) => {
      if (kind === "hold") {
        mapping.source.mode = "hold"
        mapping.target = { kind: "key", key: "leftcontrol", mods: [] }
        return
      }
      mapping.source.mode = "press"
      if (kind === "key") {
        mapping.target = { kind: "key", key: "esc", mods: [] }
      } else if (kind === "combo") {
        mapping.target = { kind: "combo", key: "c", mods: ["control"] }
      } else if (kind === "layer") {
        mapping.source.mode = "hold"
        mapping.target = { kind: "layer", layer: props.layerNames[0] ?? "" }
      } else if (kind === "disable") {
        mapping.target = { kind: "disable", mods: [] }
      } else if (kind === "macro") {
        mapping.target = { kind: "macro", macro_text: "", mods: [] }
      }
    })
  }

  function toggleTargetMod(mod: string) {
    update((mapping) => {
      const mods = mapping.target.mods ?? []
      mapping.target.mods = mods.includes(mod) ? mods.filter((m) => m !== mod) : [...mods, mod]
    })
  }

  const kindOptions = [
    { value: "key", label: "Key → key" },
    { value: "combo", label: "Key → combo" },
    { value: "hold", label: "Tap / hold" },
    { value: "layer", label: "Layer trigger" },
    { value: "macro", label: "Macro" },
    { value: "disable", label: "Disable key" }
  ]

  return (
    <div
      class={`flex flex-wrap items-center gap-2 border-b border-line px-2 py-1.5 ${props.mapping.enabled ? "" : "opacity-50"}`}
    >
      <button
        type="button"
        class="rounded px-1 py-0.5 hover:bg-surface-2"
        aria-label="Change source key"
        onClick={() => setCapturing("source")}
      >
        <KeyCap name={props.mapping.source.key} mods={props.mapping.source.mods} />
      </button>
      <Show when={props.mapping.source.mode !== "press" && kindOf(props.mapping) !== "layer"}>
        <span class="text-[10.5px] text-ink-faint">{props.mapping.source.mode}</span>
      </Show>
      <span class="text-ink-faint">→</span>

      <Select
        label="Mapping type"
        value={kindOf(props.mapping)}
        onChange={setKind}
        options={kindOptions}
      />

      <Show when={props.mapping.target.kind === "key" || props.mapping.target.kind === "combo"}>
        <button
          type="button"
          class="rounded px-1 py-0.5 hover:bg-surface-2"
          aria-label="Change target key"
          onClick={() => setCapturing("target")}
        >
          <KeyCap
            name={props.mapping.target.key ?? "?"}
            mods={props.mapping.target.kind === "combo" ? props.mapping.target.mods : []}
          />
        </button>
        <Show when={props.mapping.target.kind === "combo"}>
          <span class="flex gap-1">
            {modifiers.map((mod) => (
              <Button
                variant={(props.mapping.target.mods ?? []).includes(mod) ? "primary" : "ghost"}
                aria-pressed={(props.mapping.target.mods ?? []).includes(mod)}
                onClick={() => toggleTargetMod(mod)}
              >
                {mod}
              </Button>
            ))}
          </span>
        </Show>
      </Show>

      <Show when={props.mapping.target.kind === "layer"}>
        <Select
          label="Target layer"
          value={props.mapping.target.layer ?? ""}
          onChange={(layer) => update((m) => (m.target.layer = layer))}
          options={[
            ...props.layerNames.map((name) => ({ value: name, label: `layer: ${name}` })),
            ...modifiers.map((mod) => ({ value: mod, label: `modifier: ${mod}` }))
          ]}
        />
      </Show>

      <Show when={props.mapping.target.kind === "macro"}>
        <input
          class="w-44 rounded border border-line bg-surface-2 px-2 py-1 text-[12px]"
          placeholder="macro text"
          aria-label="Macro text"
          value={props.mapping.target.macro_text ?? ""}
          onInput={(event) => update((m) => (m.target.macro_text = event.currentTarget.value))}
        />
      </Show>

      <Show when={kindOf(props.mapping) === "hold" && props.mapping.target.kind === "key"}>
        <Select
          label="Hold modifier"
          value={props.mapping.target.key ?? "leftcontrol"}
          onChange={(key) => update((m) => (m.target.key = key))}
          options={modifiers.map((mod) => ({ value: mod, label: `hold: ${mod}` }))}
        />
      </Show>

      <span class="min-w-0 flex-1" />

      <Show when={props.issues.length > 0}>
        <span class="max-w-52 truncate text-[11.5px] text-bad" title={props.issues.map((i) => i.message).join("; ")}>
          {props.issues[0]?.message}
        </span>
      </Show>

      <Toggle
        checked={props.mapping.enabled}
        onChange={(enabled) => update((m) => (m.enabled = enabled))}
        label="Mapping enabled"
      />
      <Button variant="ghost" aria-label="Remove mapping" onClick={remove}>
        ✕
      </Button>

      <KeyCapture
        open={capturing() !== null}
        title={capturing() === "source" ? "Capture source key" : "Capture target key"}
        onClose={() => setCapturing(null)}
        onPick={(key) => {
          const side = capturing()
          update((mapping) => {
            if (side === "source") {
              mapping.source.key = key
            } else {
              mapping.target.key = key
            }
          })
        }}
      />
    </div>
  )
}

export { kindOf }
export type { MappingKind }
