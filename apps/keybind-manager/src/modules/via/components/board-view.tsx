import { save } from "@tauri-apps/plugin-dialog"
import { For, Show, createEffect, createMemo, createResource, createSignal, type JSX } from "solid-js"
import { Button } from "@/shared/components/button"
import { Select } from "@/shared/components/select"
import { Toggle } from "@/shared/components/toggle"
import { toNativeError } from "@/shared/utilities/guards"
import {
  viaDetect,
  viaGetLayoutOptions,
  viaReadKeymap,
  viaSaveLayout,
  viaSetKeycode,
  viaSetLayoutOptions
} from "@/shared/utilities/native"
import type { ViaKeyboard } from "@/shared/types/native"
import type { SavedLayout, ViaDefinition, ViaKey } from "@/modules/via/types"
import {
  packLayoutOptions,
  parseDefinition,
  parseSavedLayout,
  unpackLayoutOptions,
  visibleKeys
} from "@/modules/via/utilities/definition"
import { bundledDefinitions } from "@/modules/via/utilities/definitions"
import {
  basicKeycodes,
  customKeycode,
  keycodeLabel,
  keycodeName,
  layerKeycode,
  layerKinds,
  nameLabel,
  type KeycodeGroup
} from "@/modules/via/utilities/keycodes"

const UNIT = 42
const GAP = 3
const GROUPS: KeycodeGroup[] = ["Letters", "Numbers", "Editing", "Function", "Modifiers", "Media", "Special"]

type Detected = {
  definition: ViaDefinition
  keyboard: ViaKeyboard
}

type Source = "live" | "file"

async function detect(definitions: ViaDefinition[]): Promise<Detected | null> {
  for (const definition of definitions) {
    const keyboard = await viaDetect(definition.vendor, definition.product).catch(() => null)
    if (keyboard) {
      return { definition, keyboard }
    }
  }
  return null
}

function errorText(error: unknown): string {
  return toNativeError(error).message
}

function extent(keys: ViaKey[]) {
  return {
    width: Math.max(0, ...keys.map((k) => k.x + k.w)) * UNIT,
    height: Math.max(0, ...keys.map((k) => k.y + k.h)) * UNIT
  }
}

export function BoardView() {
  const [imported, setImported] = createSignal<ViaDefinition[]>([])
  const definitions = createMemo(() => [...imported(), ...bundledDefinitions])
  const [detected, { refetch }] = createResource(() => detect(definitions()))
  const [definitionIndex, setDefinitionIndex] = createSignal(0)
  const [options, setOptions] = createSignal<number[]>([])
  const [codes, setCodes] = createSignal<number[]>([])
  const [saved, setSaved] = createSignal<SavedLayout | null>(null)
  const [source, setSource] = createSignal<Source>("live")
  const [layer, setLayer] = createSignal(0)
  const [selected, setSelected] = createSignal<{ row: number; col: number } | null>(null)
  const [message, setMessage] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  let optionEdits = 0

  const definition = createMemo(() => definitions()[definitionIndex()] ?? definitions()[0]!)
  const keyboard = () => {
    const found = detected()
    return found && found.definition === definition() ? found.keyboard : null
  }
  const protocol = () => keyboard()?.protocol ?? 9
  const live = () => source() === "live" && keyboard() !== null
  const layerCount = () => (live() ? (keyboard()?.layers ?? 0) : (saved()?.layers.length ?? 0))
  const cells = () => definition().matrix.rows * definition().matrix.cols
  const shown = createMemo(() => visibleKeys(definition().keys, options()))
  const size = createMemo(() => extent(shown()))

  createEffect(() => {
    const found = detected()
    if (found) {
      const index = definitions().indexOf(found.definition)
      setDefinitionIndex(Math.max(0, index))
      setSource("live")
    }
  })

  createEffect(() => {
    setOptions(definition().options.map(() => 0))
    setLayer(0)
    setSelected(null)
  })

  createEffect(() => {
    const board = keyboard()
    if (!board) {
      setCodes([])
      return
    }
    const { vendor, product, matrix, options: layoutOptions } = definition()
    const edits = optionEdits
    void viaGetLayoutOptions(vendor, product)
      .then((packed) => {
        if (edits === optionEdits) {
          setOptions(unpackLayoutOptions(layoutOptions, packed))
        }
      })
      .catch((e) => setMessage(`Could not read the layout options: ${errorText(e)}`))
    void viaReadKeymap(vendor, product, board.layers, matrix.rows, matrix.cols)
      .then(setCodes)
      .catch((e) => setMessage(errorText(e)))
  })

  function legend(key: ViaKey): string {
    const index = key.row * definition().matrix.cols + key.col
    if (live()) {
      const code = codes()[layer() * cells() + index]
      return code === undefined ? "" : keycodeLabel(code, definition().customKeycodes, protocol())
    }
    const name = saved()?.layers[layer()]?.[index]
    return name === undefined ? `${key.row},${key.col}` : nameLabel(name, definition().customKeycodes)
  }

  async function assign(code: number) {
    const key = selected()
    if (!key || busy()) {
      return
    }
    const { vendor, product, matrix } = definition()
    setBusy(true)
    setMessage("")
    try {
      await viaSetKeycode(vendor, product, layer(), key.row, key.col, code)
      const at = layer() * cells() + key.row * matrix.cols + key.col
      setCodes((current) => current.map((c, i) => (i === at ? code : c)))
    } catch (e) {
      setMessage(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function importDefinition(file: File | undefined) {
    if (!file) {
      return
    }
    try {
      const next = parseDefinition(await file.text())
      setImported((current) => [next, ...current])
      setDefinitionIndex(0)
      setMessage("")
      void refetch()
    } catch (e) {
      setMessage(errorText(e))
    }
  }

  async function importLayout(file: File | undefined) {
    if (!file) {
      return
    }
    try {
      setSaved(parseSavedLayout(await file.text()))
      setSource("file")
      setLayer(0)
      setMessage("")
    } catch (e) {
      setMessage(errorText(e))
    }
  }

  async function setOption(index: number, choice: number) {
    optionEdits += 1
    const next = options().map((c, i) => (i === index ? choice : c))
    setOptions(next)
    if (!keyboard()) {
      return
    }
    const { vendor, product, options: layoutOptions } = definition()
    try {
      await viaSetLayoutOptions(vendor, product, packLayoutOptions(layoutOptions, next))
      setMessage("")
    } catch (e) {
      setMessage(`Layout option not saved to the keyboard: ${errorText(e)}`)
    }
  }

  function exportedLayers(): string[][] {
    if (!live()) {
      return saved()?.layers ?? []
    }
    if (codes().length < layerCount() * cells()) {
      return []
    }
    const all = codes().map((code) => keycodeName(code, protocol()))
    return Array.from({ length: layerCount() }, (_, i) => all.slice(i * cells(), (i + 1) * cells()))
  }

  async function exportLayout() {
    const layers = exportedLayers()
    if (layers.length === 0) {
      return
    }
    const { name, vendor, product } = definition()
    const path = await save({
      defaultPath: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.layout.json`,
      filters: [{ name: "VIA layout", extensions: ["json"] }]
    })
    if (!path) {
      return
    }
    const layout = {
      name,
      vendorProductId: parseInt(vendor + product, 16),
      macros: [],
      layers
    }
    try {
      await viaSaveLayout(path, `${JSON.stringify(layout, null, 2)}\n`)
      setMessage("")
    } catch (e) {
      setMessage(errorText(e))
    }
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
      <div class="flex flex-wrap items-center gap-2">
        <Select
          label="Definition"
          options={definitions().map((d, i) => ({
            value: String(i),
            label: `${d.name} (${d.vendor}:${d.product})`
          }))}
          value={String(definitionIndex())}
          onChange={(value) => setDefinitionIndex(Number(value))}
        />
        <Show when={saved()}>
          <Select
            label="Source"
            options={[
              { value: "live", label: "Keyboard" },
              { value: "file", label: saved()?.name ?? "Saved layout" }
            ]}
            value={source()}
            onChange={(value) => setSource(value === "file" ? "file" : "live")}
          />
        </Show>
        <FilePicker label="Import definition" onPick={importDefinition} />
        <FilePicker label="Import saved layout" onPick={importLayout} />
        <Button disabled={exportedLayers().length === 0} onClick={() => void exportLayout()}>
          Export layout
        </Button>
        <Button variant="ghost" loading={detected.loading} onClick={() => void refetch()}>
          Reconnect
        </Button>
        <span class="text-[12px] text-ink-faint">
          <Show
            when={keyboard()}
            fallback={detected.loading ? "Looking for a VIA keyboard" : "No VIA keyboard found, showing the definition only"}
          >
            {(board) => `Connected, protocol ${board().protocol}, ${board().layers} layers`}
          </Show>
        </span>
      </div>

      <Show when={message()}>
        <p class="rounded-md border border-bad/40 bg-bad/10 px-3 py-1.5 text-[12.5px] text-bad">{message()}</p>
      </Show>

      <Show when={definition().options.length > 0}>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <For each={definition().options}>
            {(option, index) => (
              <Show
                when={option.choices.length > 0}
                fallback={
                  <Toggle
                    label={option.label}
                    showLabel
                    checked={options()[index()] === 1}
                    onChange={(checked) => void setOption(index(), checked ? 1 : 0)}
                  />
                }
              >
                <Select
                  label={option.label}
                  options={option.choices.map((label, i) => ({ value: String(i), label }))}
                  value={String(options()[index()] ?? 0)}
                  onChange={(value) => void setOption(index(), Number(value))}
                />
              </Show>
            )}
          </For>
        </div>
      </Show>

      <Show when={layerCount() > 0}>
        <div class="flex gap-1" role="tablist" aria-label="Layers">
          <For each={Array.from({ length: layerCount() }, (_, i) => i)}>
            {(index) => (
              <button
                type="button"
                role="tab"
                aria-selected={layer() === index}
                class={`rounded-md px-2.5 py-1 text-[12px] transition-colors duration-150 ${
                  layer() === index ? "bg-surface-3 text-ink" : "text-ink-faint hover:text-ink-dim"
                }`}
                onClick={() => setLayer(index)}
              >
                Layer {index}
              </button>
            )}
          </For>
        </div>
      </Show>

      <div class="overflow-x-auto pb-1">
        <div class="relative" style={{ width: `${size().width}px`, height: `${size().height}px` }}>
          <For each={shown()}>
            {(key) => (
              <button
                type="button"
                class={`absolute flex items-center justify-center overflow-hidden rounded-md border px-1 text-center text-[11px] leading-tight transition-colors duration-100 ${
                  selected()?.row === key.row && selected()?.col === key.col
                    ? "border-accent bg-surface-3 text-ink"
                    : "border-line-strong bg-surface-2 text-ink-dim hover:bg-surface-3"
                }`}
                style={{
                  left: `${key.x * UNIT}px`,
                  top: `${key.y * UNIT}px`,
                  width: `${key.w * UNIT - GAP}px`,
                  height: `${key.h * UNIT - GAP}px`
                }}
                disabled={!live()}
                title={`row ${key.row}, column ${key.col}`}
                onClick={() => setSelected({ row: key.row, col: key.col })}
              >
                {legend(key)}
              </button>
            )}
          </For>
        </div>
      </div>

      <Show when={live() && selected()}>
        {(key) => (
          <Picker
            title={`Layer ${layer()}, row ${key().row}, column ${key().col}`}
            definition={definition()}
            protocol={protocol()}
            layers={layerCount()}
            busy={busy()}
            onPick={assign}
          />
        )}
      </Show>
      <Show when={!live() && layerCount() > 0}>
        <p class="text-[12px] text-ink-faint">Showing a saved layout. Connect the keyboard over USB to edit keys.</p>
      </Show>
    </div>
  )
}

type PickerProps = {
  title: string
  definition: ViaDefinition
  protocol: number
  layers: number
  busy: boolean
  onPick: (code: number) => void
}

function Picker(props: PickerProps) {
  return (
    <div class="flex flex-col gap-2 rounded-md border border-line bg-surface-1 p-3">
      <p class="text-[12px] text-ink-dim">{props.title}</p>
      <For each={GROUPS}>
        {(group) => (
          <PickerGroup title={group}>
            <For each={basicKeycodes.filter((k) => k.group === group)}>
              {(k) => (
                <PickerButton disabled={props.busy} onClick={() => props.onPick(k.code)}>
                  {k.label || "None"}
                </PickerButton>
              )}
            </For>
          </PickerGroup>
        )}
      </For>
      <PickerGroup title="Layers">
        <For each={layerKinds}>
          {(kind) => (
            <For each={Array.from({ length: props.layers }, (_, i) => i)}>
              {(index) => (
                <PickerButton disabled={props.busy} onClick={() => props.onPick(layerKeycode(kind, index, props.protocol))}>
                  {kind} {index}
                </PickerButton>
              )}
            </For>
          )}
        </For>
      </PickerGroup>
      <Show when={props.definition.customKeycodes.length > 0}>
        <PickerGroup title="Custom">
          <For each={props.definition.customKeycodes}>
            {(custom, index) => (
              <PickerButton
                disabled={props.busy}
                title={custom.title}
                onClick={() => props.onPick(customKeycode(index(), props.protocol))}
              >
                {custom.shortName}
              </PickerButton>
            )}
          </For>
        </PickerGroup>
      </Show>
    </div>
  )
}

type PickerGroupProps = {
  title: string
  children: JSX.Element
}

function PickerGroup(props: PickerGroupProps) {
  return (
    <div class="flex flex-col gap-1">
      <span class="text-[11px] uppercase tracking-wide text-ink-faint">{props.title}</span>
      <div class="flex flex-wrap gap-1">{props.children}</div>
    </div>
  )
}

type PickerButtonProps = {
  disabled: boolean
  title?: string
  onClick: () => void
  children: JSX.Element
}

function PickerButton(props: PickerButtonProps) {
  return (
    <button
      type="button"
      title={props.title}
      disabled={props.disabled}
      class="rounded border border-line-strong bg-surface-2 px-2 py-0.5 text-[11.5px] text-ink-dim transition-colors duration-100 hover:bg-surface-3 hover:text-ink disabled:opacity-45"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

type FilePickerProps = {
  label: string
  onPick: (file: File | undefined) => void
}

function FilePicker(props: FilePickerProps) {
  let input: HTMLInputElement | undefined
  return (
    <>
      <Button onClick={() => input?.click()}>{props.label}</Button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        class="hidden"
        onChange={(event) => {
          props.onPick(event.currentTarget.files?.[0])
          event.currentTarget.value = ""
        }}
      />
    </>
  )
}
