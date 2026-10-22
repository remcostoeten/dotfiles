import { Show, createResource, createSignal } from "solid-js"
import type { InputMode, Mapping } from "@/shared/types/config"
import type { Issue } from "@/shared/types/native"
import { Button } from "@/shared/components/button"
import { KeyCap } from "@/shared/components/key-cap"
import { Select } from "@/shared/components/select"
import { Toggle } from "@/shared/components/toggle"
import { KeyCapture } from "@/modules/mappings/components/key-capture"
import { modifiers } from "@/modules/mappings/utilities/key-names"
import { appStore } from "@/app/utilities/store"
import { getDesktopApps, getSessionUser } from "@/shared/utilities/native"

type Props = {
  mapping: Mapping
  profileId: string
  layerId: string | null
  layerNames: string[]
  issues: Issue[]
}

type MappingKind = "key" | "combo" | "layer" | "disable" | "macro" | "text" | "command" | "launch" | "hold"

const modeLabels: Record<InputMode, string> = {
  press: "press",
  tap: "tap",
  hold: "hold",
  doubletap: "2× tap",
  tripletap: "3× tap"
}

function kindOf(mapping: Mapping): MappingKind {
  if (mapping.source.mode === "hold") {
    return "hold"
  }
  return mapping.target.kind
}

const [sessionUser] = createResource(async () => (await getSessionUser()) ?? undefined)
const [desktopApps] = createResource(getDesktopApps)

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
      if (mapping.source.mode === "hold") {
        mapping.source.mode = "press"
      }
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
      } else if (kind === "text") {
        mapping.target = { kind: "text", text: "", mods: [] }
      } else if (kind === "command") {
        mapping.target = { kind: "command", command: "", run_as: sessionUser(), mods: [] }
      } else if (kind === "launch") {
        mapping.target = { kind: "launch", app: "", run_as: sessionUser(), mods: [] }
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
    { value: "text", label: "Type text" },
    { value: "command", label: "Run command" },
    { value: "launch", label: "Launch app" },
    { value: "macro", label: "Macro (keyd)" },
    { value: "disable", label: "Disable key" }
  ]

  return (
    <div
      class={`flex flex-wrap items-center gap-2 border-b border-line px-2 py-1.5 transition-opacity duration-100 hover:bg-surface-1/40 ${props.mapping.enabled ? "" : "opacity-50"}`}
    >
      <div class="flex min-w-[9.5rem] shrink-0 items-center gap-1.5">
        <button
          type="button"
          class="rounded px-1 py-0.5 transition-colors duration-100 hover:bg-surface-2"
          aria-label="Change source key"
          onClick={() => setCapturing("source")}
        >
          <KeyCap name={props.mapping.source.key} mods={props.mapping.source.mods} />
        </button>
        <Show when={props.mapping.source.mode !== "press" && kindOf(props.mapping) !== "layer"}>
          <span class="text-[10.5px] text-ink-faint">{modeLabels[props.mapping.source.mode]}</span>
        </Show>
        <span class="text-ink-faint">→</span>
      </div>

      <Select
        label="Mapping type"
        value={kindOf(props.mapping)}
        onChange={setKind}
        options={kindOptions}
        class="w-32 shrink-0"
      />

      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Show when={props.mapping.target.kind === "key" || props.mapping.target.kind === "combo"}>
          <button
            type="button"
            class="rounded px-1 py-0.5 transition-colors duration-100 hover:bg-surface-2"
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
                  class="font-medium"
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
            class="w-44 rounded border border-line bg-surface-2 px-2 py-1 text-[12px] transition-colors duration-100"
            placeholder="macro text"
            aria-label="Macro text"
            value={props.mapping.target.macro_text ?? ""}
            onInput={(event) => update((m) => (m.target.macro_text = event.currentTarget.value))}
          />
        </Show>

        <Show when={props.mapping.target.kind === "text"}>
          <textarea
            rows={1}
            class="min-w-44 flex-1 resize-y rounded border border-line bg-surface-2 px-2 py-1 text-[12px] transition-colors duration-100"
            placeholder="text typed at the cursor"
            aria-label="Text to type"
            value={props.mapping.target.text ?? ""}
            onInput={(event) => update((m) => (m.target.text = event.currentTarget.value))}
          />
        </Show>

        <Show when={props.mapping.target.kind === "command"}>
          <input
            class="min-w-44 flex-1 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[12px] transition-colors duration-100"
            placeholder="shell command, e.g. ~/bin/screenshot.sh"
            aria-label="Shell command"
            spellcheck={false}
            value={props.mapping.target.command ?? ""}
            onInput={(event) => update((m) => (m.target.command = event.currentTarget.value))}
          />
        </Show>

        <Show when={props.mapping.target.kind === "launch"}>
          <Select
            label="Application"
            value={props.mapping.target.app ?? ""}
            onChange={(app) => update((m) => (m.target.app = app))}
            options={[
              { value: "", label: desktopApps.loading ? "loading apps…" : "choose an app" },
              ...(desktopApps() ?? []).map((app) => ({ value: app.path, label: app.name }))
            ]}
            class="min-w-44 flex-1"
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
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <Show when={props.issues.length > 0}>
          <span
            class="max-w-52 truncate rounded-sm border border-bad/40 bg-bad/10 px-1.5 py-px text-[11px] text-bad"
            title={props.issues.map((i) => i.message).join("; ")}
          >
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
      </div>

      <KeyCapture
        open={capturing() !== null}
        title={capturing() === "source" ? "Capture source key" : "Capture target key"}
        withMods={capturing() === "source" && props.layerId === null}
        onClose={() => setCapturing(null)}
        onPick={(key, mods) => {
          const side = capturing()
          update((mapping) => {
            if (side === "source") {
              mapping.source.key = key
              mapping.source.mods = mods
            } else {
              mapping.target.key = key
            }
          })
        }}
      />
    </div>
  )
}

export { kindOf, modeLabels }
export type { MappingKind }
