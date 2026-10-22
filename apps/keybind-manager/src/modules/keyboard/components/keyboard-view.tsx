import { For, Show, createEffect, createMemo, createResource, createSignal, onCleanup, onMount } from "solid-js"
import type { InputMode, KeyAction, Layer, Mapping, Profile } from "@/shared/types/config"
import type { Issue } from "@/shared/types/native"
import { appStore } from "@/app/utilities/store"
import { Select } from "@/shared/components/select"
import { Button } from "@/shared/components/button"
import { Badge } from "@/shared/components/badge"
import { Dialog } from "@/shared/components/dialog"
import { MappingRow, modeLabels } from "@/modules/mappings/components/mapping-row"
import { makeId } from "@/shared/utilities/id"
import { checkConfig, getDevices, getKeyboardOwnership, getSessionUser } from "@/shared/utilities/native"
import { codeToKey, keyLabel } from "@/modules/mappings/utilities/key-names"
import { KeyPickerButton } from "@/modules/mappings/components/key-picker"
import { layoutForDevices, layouts } from "@/modules/keyboard/utilities/layouts"
import type { PhysicalKey } from "@/modules/keyboard/utilities/layouts"
import { boardsFrom } from "@/modules/keyboard/utilities/devices"
import type { Board } from "@/modules/keyboard/utilities/devices"
import { takeOverKeydConfig } from "@/modules/devices/api/mutations/take-over"
import { keyPitches, playKeyTone, readSoundSettings, writeSoundSettings } from "@/modules/keyboard/utilities/key-tones"
import type { SoundSettings } from "@/modules/keyboard/utilities/key-tones"
import { SoundSettingsButton } from "@/modules/keyboard/components/sound-settings"
import { LayerBar } from "@/modules/keyboard/components/layer-bar"

const UNIT = 46
const BOARD_PADDING = 28
const MAX_SCALE = 1.5

const TAP_WINDOW_MS = 300

type TestMode = "off" | "flash" | "sticky"

type Behavior = {
  mode: InputMode
  label: string
}

const behaviors: Behavior[] = [
  { mode: "hold", label: "+ Hold" },
  { mode: "doubletap", label: "+ Double tap" },
  { mode: "tripletap", label: "+ Triple tap" }
]

function naturalWidth(rows: PhysicalKey[][], knob: boolean): number {
  const widest = Math.max(...rows.map((row) => row.reduce((sum, key) => sum + (key.width ?? 1), 0)))
  return widest * UNIT + BOARD_PADDING + (knob ? UNIT + 4 : 0)
}

function describe(action: KeyAction): string {
  switch (action.kind) {
    case "disable":
      return "off"
    case "key":
      return keyLabel(action.key ?? "")
    case "combo":
      return [...(action.mods ?? []), action.key ?? ""].map(keyLabel).join("+")
    case "layer":
      return `layer ${action.layer ?? ""}`
    case "macro":
      return "macro"
    case "text":
      return "text"
    case "command":
      return "cmd"
    case "launch":
      return "app"
  }
}

function summary(mappings: Mapping[]): string {
  return mappings
    .map((m) => (m.source.mode === "press" ? describe(m.target) : `${modeLabels[m.source.mode]}: ${describe(m.target)}`))
    .join(" · ")
}

function isSingle(mapping: Mapping): boolean {
  return mapping.source.mods.length === 0 && (mapping.source.mode === "press" || mapping.source.mode === "tap")
}

function isPickable(mapping: Mapping): boolean {
  return mapping.target.kind === "key" || mapping.target.kind === "disable"
}

function plainFor(mappings: Mapping[], code: string): Mapping[] {
  return mappings.filter((m) => m.enabled && m.source.key === code && m.source.mods.length === 0)
}

function sameBoard(a: { vendor: string; product: string }, b: { vendor: string; product: string }) {
  return a.vendor === b.vendor && a.product === b.product
}

export function KeyboardView() {
  const [devices, { refetch: refetchDevices }] = createResource(() => getDevices().catch(() => []))
  const boards = createMemo(() => boardsFrom(devices() ?? []))
  const [boardId, setBoardId] = createSignal<string | null>(null)
  const [layoutOverride, setLayoutOverride] = createSignal<string | null>(null)
  const [selected, setSelected] = createSignal<PhysicalKey | null>(null)
  const [takeOverBusy, setTakeOverBusy] = createSignal(false)
  const [takeOverError, setTakeOverError] = createSignal("")
  const [testMode, setTestMode] = createSignal<TestMode>("off")
  const [held, setHeld] = createSignal<ReadonlySet<string>>(new Set())
  const [tested, setTested] = createSignal<ReadonlySet<string>>(new Set())
  const [hostWidth, setHostWidth] = createSignal(0)
  const [confirmReset, setConfirmReset] = createSignal(false)
  const [sound, setSound] = createSignal(readSoundSettings())
  const [layerId, setLayerId] = createSignal<string | null>(null)
  const [sessionUser] = createResource(async () => (await getSessionUser()) ?? undefined)
  let host: HTMLDivElement | undefined

  onMount(() => {
    if (!host) {
      return
    }
    const observer = new ResizeObserver(([entry]) => setHostWidth(entry?.contentRect.width ?? 0))
    observer.observe(host)
    onCleanup(() => observer.disconnect())
  })

  function testerKey(event: KeyboardEvent, down: boolean) {
    if (testMode() === "off" || event.target instanceof HTMLInputElement) {
      return
    }
    const name = codeToKey(event.code)
    if (!name) {
      return
    }
    if (!(event.ctrlKey && ["=", "+", "-", "0"].includes(event.key))) {
      event.preventDefault()
    }
    const next = new Set(held())
    if (down) {
      const pitch = pitches().get(name)
      if (sound().enabled && !event.repeat && pitch) {
        playKeyTone(pitch, sound())
      }
      next.add(name)
      setTested(new Set(tested()).add(name))
    } else {
      next.delete(name)
    }
    setHeld(next)
  }

  onMount(() => {
    const onDown = (event: KeyboardEvent) => testerKey(event, true)
    const onUp = (event: KeyboardEvent) => testerKey(event, false)
    const onBlur = () => setHeld(new Set<string>())
    window.addEventListener("keydown", onDown)
    window.addEventListener("keyup", onUp)
    window.addEventListener("blur", onBlur)
    onCleanup(() => {
      window.removeEventListener("keydown", onDown)
      window.removeEventListener("keyup", onUp)
      window.removeEventListener("blur", onBlur)
    })
  })

  function changeSound(next: SoundSettings) {
    setSound(next)
    writeSoundSettings(next)
  }

  function changeTestMode(mode: TestMode) {
    setTestMode(mode)
    setHeld(new Set<string>())
    setTested(new Set<string>())
  }

  const [ownership] = createResource(
    () => JSON.stringify(appStore.config),
    () => getKeyboardOwnership(appStore.snapshot()).catch(() => [])
  )

  createEffect(() => {
    const list = boards()
    if (list.length > 0 && !list.some((b) => `${b.vendor}:${b.product}` === boardId())) {
      setBoardId(`${list[0]!.vendor}:${list[0]!.product}`)
    }
  })

  const board = createMemo(() => boards().find((b) => `${b.vendor}:${b.product}` === boardId()))

  const deviceProfile = createMemo((): Profile | undefined => {
    const current = board()
    if (!current) {
      return undefined
    }
    return appStore.config.profiles.find((p) => p.devices.some((d) => sameBoard(d, current)))
  })

  const sharedMappings = createMemo(() =>
    appStore.config.profiles.filter((p) => p.enabled && p.devices.length === 0).flatMap((p) => p.mappings)
  )

  const foreignOwner = createMemo(() => {
    const current = board()
    if (!current) {
      return undefined
    }
    const entry = (ownership() ?? []).find((o) => sameBoard(o, current))
    const winner = entry?.matches[0]
    return winner && !winner.managed ? winner.filename : undefined
  })

  const layout = createMemo(() => {
    const override = layouts.find((l) => l.id === layoutOverride())
    const current = board()
    return override ?? layoutForDevices(current ? [current] : [])
  })

  const pitches = createMemo(() => keyPitches(layout().rows, sound()))

  createEffect(() => {
    boardId()
    setSelected(null)
    setLayerId(null)
    setLayoutOverride(null)
    setTakeOverError("")
    const profile = deviceProfile()
    if (profile) {
      appStore.setSelectedProfile(profile.id)
    }
  })

  const editingProfile = createMemo(() => (board() ? deviceProfile() : appStore.currentProfile()))

  const sharedProfileNames = createMemo(() =>
    appStore.config.profiles
      .filter((p) => p.enabled && p.devices.length === 0 && p.id !== editingProfile()?.id)
      .map((p) => p.name)
  )

  const activeLayer = createMemo((): Layer | undefined =>
    editingProfile()?.layers.find((layer) => layer.id === layerId())
  )

  const [check] = createResource(
    () => JSON.stringify(appStore.config),
    () => checkConfig(appStore.snapshot()).catch(() => undefined)
  )

  function issuesFor(mappingId: string): Issue[] {
    const result = check()
    return result ? [...result.errors, ...result.warnings].filter((issue) => issue.mapping_id === mappingId) : []
  }

  function baseMappings(code: string): Mapping[] {
    return plainFor(editingProfile()?.mappings ?? [], code)
  }

  function ownMappings(code: string): Mapping[] {
    const layer = activeLayer()
    return layer ? plainFor(layer.mappings, code) : baseMappings(code)
  }

  function extraRows(code: string): Mapping[] {
    const layer = activeLayer()
    const pool = layer ? layer.mappings : (editingProfile()?.mappings ?? [])
    return pool.filter((m) => m.source.key === code && !(isSingle(m) && isPickable(m)))
  }

  function triggersFor(layer: Layer): string[] {
    return (editingProfile()?.mappings ?? [])
      .filter((m) => m.source.mode === "hold" && m.target.kind === "layer" && m.target.layer === layer.name)
      .map((m) => m.source.key)
  }

  const activeTriggers = createMemo(() => {
    const layer = activeLayer()
    return layer ? triggersFor(layer) : []
  })

  function isTrigger(code: string): boolean {
    return activeTriggers().includes(code)
  }

  function hasMode(code: string, mode: InputMode): boolean {
    return baseMappings(code).some((m) => m.source.mode === mode)
  }

  function hasMultiTap(code: string): boolean {
    return hasMode(code, "doubletap") || hasMode(code, "tripletap")
  }

  function targetProfileId(): string | undefined {
    const current = board()
    return current
      ? appStore.ensureDeviceProfile({ vendor: current.vendor, product: current.product, name: current.name })
      : appStore.currentProfile()?.id
  }

  function editPool(recipe: (pool: Mapping[]) => Mapping[]) {
    const profileId = targetProfileId()
    if (!profileId) {
      return
    }
    appStore.setSelectedProfile(profileId)
    const currentLayer = layerId()
    appStore.updateProfile(profileId, (draft) => {
      const layer = currentLayer ? draft.layers.find((l) => l.id === currentLayer) : undefined
      if (layer) {
        layer.mappings = recipe(layer.mappings)
      } else {
        draft.mappings = recipe(draft.mappings)
      }
    })
  }

  function addCombo(code: string) {
    editPool((pool) => [
      ...pool,
      {
        id: makeId("map"),
        source: { key: code, mods: ["meta"], mode: "press" },
        target: { kind: "key", key: "esc", mods: [] },
        enabled: true
      }
    ])
  }

  function addBehavior(code: string, mode: InputMode) {
    const firstLayer = editingProfile()?.layers[0]?.name
    const target: KeyAction =
      mode === "hold"
        ? firstLayer
          ? { kind: "layer", layer: firstLayer }
          : { kind: "key", key: "leftcontrol", mods: [] }
        : { kind: "command", command: "", run_as: sessionUser(), mods: [] }
    editPool((pool) => [...pool, { id: makeId("map"), source: { key: code, mods: [], mode }, target, enabled: true }])
  }

  function runCommand(code: string) {
    editPool((pool) => [
      ...pool.filter((m) => !(m.source.key === code && isSingle(m))),
      {
        id: makeId("map"),
        source: { key: code, mods: [], mode: "press" },
        target: { kind: "command", command: "", run_as: sessionUser(), mods: [] },
        enabled: true
      }
    ])
  }

  function resetKey(code: string) {
    editPool((pool) => pool.filter((m) => !(m.source.key === code && m.source.mods.length === 0)))
  }

  function resetAll() {
    const profile = editingProfile()
    if (profile) {
      appStore.updateProfile(profile.id, (draft) => {
        draft.mappings = []
        draft.layers = []
      })
    }
    setSelected(null)
    setLayerId(null)
    setConfirmReset(false)
  }

  function sharedFor(code: string): Mapping[] {
    if (ownMappings(code).length > 0) {
      return []
    }
    return activeLayer() ? baseMappings(code) : plainFor(sharedMappings(), code)
  }

  function assign(code: string, value: string) {
    editPool((pool) => {
      const rest = pool.filter((m) => !(m.source.key === code && isSingle(m)))
      if (value === "") {
        return rest
      }
      const target: KeyAction = value === "__disable" ? { kind: "disable", mods: [] } : { kind: "key", key: value, mods: [] }
      return [...rest, { id: makeId("map"), source: { key: code, mods: [], mode: "press" }, target, enabled: true }]
    })
  }

  function createLayer(name: string) {
    const profileId = targetProfileId()
    if (!profileId) {
      return
    }
    const id = makeId("layer")
    appStore.setSelectedProfile(profileId)
    appStore.updateProfile(profileId, (draft) => {
      draft.layers.push({ id, name, mappings: [] })
    })
    setLayerId(id)
    setSelected(null)
  }

  function removeLayer(id: string) {
    const profile = editingProfile()
    const layer = profile?.layers.find((l) => l.id === id)
    if (!profile || !layer) {
      return
    }
    appStore.updateProfile(profile.id, (draft) => {
      draft.layers = draft.layers.filter((l) => l.id !== id)
      draft.mappings = draft.mappings.filter((m) => !(m.target.kind === "layer" && m.target.layer === layer.name))
    })
    setLayerId(null)
  }

  function setTrigger(code: string) {
    const layer = activeLayer()
    const profile = editingProfile()
    if (!layer || !profile) {
      return
    }
    appStore.updateProfile(profile.id, (draft) => {
      draft.mappings = draft.mappings.filter(
        (m) =>
          !(m.source.mode === "hold" && m.source.mods.length === 0 && m.source.key === code) &&
          !(m.source.mode === "hold" && m.target.kind === "layer" && m.target.layer === layer.name)
      )
      draft.mappings.push({
        id: makeId("map"),
        source: { key: code, mods: [], mode: "hold" },
        target: { kind: "layer", layer: layer.name },
        enabled: true
      })
    })
  }

  async function takeOver(filename: string) {
    setTakeOverBusy(true)
    setTakeOverError("")
    const result = await takeOverKeydConfig(filename)
    setTakeOverBusy(false)
    if (!result.ok) {
      setTakeOverError(result.error.message)
    }
  }

  const targetExtras = [
    { value: "", label: "Default (no remap)" },
    { value: "__disable", label: "Disabled" }
  ]

  function targetDisplay(value: string): string {
    return targetExtras.find((extra) => extra.value === value)?.label ?? keyLabel(value)
  }

  function currentValue(code: string): string {
    const single = ownMappings(code).find((m) => isSingle(m) && isPickable(m))
    if (!single) {
      return ""
    }
    return single.target.kind === "disable" ? "__disable" : (single.target.key ?? "")
  }

  const locked = () => foreignOwner() !== undefined

  const scale = createMemo(() => {
    const width = hostWidth()
    if (width === 0) {
      return 1
    }
    return Math.min(MAX_SCALE, width / naturalWidth(layout().rows, layout().knob === true))
  })

  const [lastKey, setLastKey] = createSignal<PhysicalKey | null>(null)
  createEffect(() => {
    const key = selected()
    if (key) {
      setLastKey(key)
    }
  })

  return (
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 [scrollbar-gutter:stable]">
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex min-w-0 flex-1 flex-col items-start gap-1">
          <Show
            when={boards().length > 0}
            fallback={
              <h2 class="text-[15px] font-medium tracking-tight">
                {devices.loading ? "\u00a0" : "Shared mappings"}
              </h2>
            }
          >
            <Select
              label="Keyboard"
              class="max-w-full"
              options={boards().map((b) => ({ value: `${b.vendor}:${b.product}`, label: b.name }))}
              value={boardId() ?? ""}
              onChange={(value) => {
                setBoardId(value)
                void refetchDevices()
              }}
            />
          </Show>
          <OwnerLine
            board={board()}
            foreign={foreignOwner()}
            hasOwnLayout={deviceProfile() !== undefined}
          />
          <div class="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-faint">
            <span>Profile:</span>
            <Show
              when={editingProfile()}
              fallback={<span class="text-ink-dim">none yet — created on first remap</span>}
            >
              {(profile) => (
                <>
                  <span class="font-medium text-ink">{profile().name}</span>
                  <Badge tone={profile().enabled ? "ok" : "warn"} text={profile().enabled ? "active" : "disabled"} />
                </>
              )}
            </Show>
            <Show when={sharedProfileNames().length > 0}>
              <span>· also applied: {sharedProfileNames().join(", ")}</span>
            </Show>
          </div>
        </div>
        <Button
          variant="ghost"
          disabled={(editingProfile()?.mappings.length ?? 0) === 0 && (editingProfile()?.layers.length ?? 0) === 0}
          onClick={() => setConfirmReset(true)}
        >
          Reset all
        </Button>
        <Show when={testMode() !== "off"}>
          <SoundSettingsButton settings={sound()} onChange={changeSound} />
        </Show>
        <TestModeSwitch mode={testMode()} onChange={changeTestMode} />
        <Select
          label="Layout"
          options={layouts.map((l) => ({ value: l.id, label: l.name }))}
          value={layout().id}
          onChange={setLayoutOverride}
        />
      </div>

      <Show when={foreignOwner()}>
        {(filename) => (
          <div class="flex flex-wrap items-center gap-3 rounded-xl border border-warn/20 bg-warn/5 px-4 py-3">
            <p class="min-w-0 flex-1 text-[12.5px] text-ink-dim">
              <span class="font-mono text-warn">{filename()}</span> controls this keyboard right now, so
              edits here would be ignored. Take it over to edit its keys in this app.
            </p>
            <Button variant="primary" loading={takeOverBusy()} onClick={() => void takeOver(filename())}>
              Take over
            </Button>
            <Show when={takeOverError()}>
              <p class="w-full text-[12px] text-bad">{takeOverError()}</p>
            </Show>
          </div>
        )}
      </Show>

      <Show when={!locked() && (editingProfile() !== undefined || boards().length > 0)}>
        <LayerBar
          layers={editingProfile()?.layers ?? []}
          activeId={activeLayer()?.id ?? null}
          triggers={activeTriggers()}
          onSelect={(id) => {
            setLayerId(id)
            setSelected(null)
          }}
          onCreate={createLayer}
          onRemove={removeLayer}
          onTrigger={setTrigger}
        />
      </Show>

      <div
        class={`dotted-grid rounded-xl border border-dashed border-line-strong p-5 transition-opacity duration-200 ${locked() ? "pointer-events-none opacity-40" : ""}`}
      >
        <div ref={host} class={`w-full overflow-hidden transition-opacity duration-150 ${hostWidth() === 0 ? "opacity-0" : ""}`}>
        <div
          style={{ zoom: scale() }}
          class="mx-auto flex w-fit flex-col gap-1 rounded-2xl bg-gradient-to-b from-surface-3 to-surface-1 p-3.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <For each={layout().rows}>
            {(row, rowIndex) => (
              <div class="flex gap-1">
                <For each={row}>
                  {(key) => (
                    <KeyButton
                      physical={key}
                      own={ownMappings(key.code)}
                      shared={sharedFor(key.code)}
                      trigger={isTrigger(key.code)}
                      active={selected() === key}
                      held={held().has(key.code)}
                      tested={testMode() === "sticky" && tested().has(key.code)}
                      onSelect={() => setSelected(selected() === key ? null : key)}
                    />
                  )}
                </For>
                <Show when={rowIndex() === 0 && layout().knob}>
                  <div
                    style={{ width: `${UNIT - 4}px`, height: `${UNIT - 4}px` }}
                    class="ml-1 rounded-full border border-line-strong bg-[conic-gradient(from_0deg,#2a2a2a,#111,#2a2a2a,#111,#2a2a2a)] shadow-[inset_0_0_0_3px_var(--color-surface-3)]"
                    title="Rotary knob (firmware)"
                  />
                </Show>
              </div>
            )}
          </For>
        </div>
        </div>
      </div>

      <div class="grid min-h-14">
        <p
          data-shown={selected() === null}
          class="kb-swap self-center text-[12px] text-ink-faint [grid-area:1/1]"
        >
          <Show
            when={testMode() === "off"}
            fallback={<>Press keys to test them. Keys light up with what the system receives, after keyd remaps.</>}
          >
            <Show
              when={activeLayer()}
              fallback={
                <>
                  Click a key to remap it or give it hold, double tap or command actions.{" "}
                  <span class="text-ok">Green</span> keys are custom for this keyboard; grey hints come from
                  shared mappings. Press Apply to send changes to keyd.
                </>
              }
            >
              {(layer) => (
                <>
                  Editing layer <span class="text-ink">{layer().name}</span>. The{" "}
                  <span class="text-accent">highlighted</span> key activates it; grey hints are Base keys it
                  falls through to.
                </>
              )}
            </Show>
          </Show>
        </p>
        <Show when={lastKey()}>
        {(key) => (
          <div
            data-shown={selected() !== null}
            class="kb-swap flex flex-wrap items-center gap-3 self-center rounded-xl bg-surface-1 px-4 py-3 [grid-area:1/1]"
          >
            <span class="text-[12.5px]">
              <Show when={activeLayer()}>
                {(layer) => <span class="text-ink-faint">In {layer().name}, </span>}
              </Show>
              <span class="font-medium">{key().legend || "Space"}</span>
              <span class="text-ink-faint"> sends {keyLabel(key().code)} →</span>
            </span>
            <KeyPickerButton
              label="Remap to"
              value={currentValue(key().code)}
              display={targetDisplay(currentValue(key().code))}
              extras={targetExtras}
              onPick={(value) => assign(key().code, value)}
            />
            <Button variant="ghost" onClick={() => runCommand(key().code)}>
              Run command
            </Button>
            <Show when={!activeLayer()}>
              <For each={behaviors.filter((behavior) => !hasMode(key().code, behavior.mode))}>
                {(behavior) => (
                  <Button variant="ghost" onClick={() => addBehavior(key().code, behavior.mode)}>
                    {behavior.label}
                  </Button>
                )}
              </For>
              <Button variant="ghost" onClick={() => addCombo(key().code)}>
                + Combination
              </Button>
            </Show>
            <Show when={ownMappings(key().code).length > 0 || extraRows(key().code).length > 0}>
              <Button variant="ghost" onClick={() => resetKey(key().code)}>
                Reset
              </Button>
            </Show>
            <Show when={extraRows(key().code).length > 0}>
              <div class="w-full rounded-lg border border-line" role="list" aria-label="Key actions">
                <For each={extraRows(key().code)}>
                  {(mapping) => (
                    <MappingRow
                      mapping={mapping}
                      profileId={editingProfile()!.id}
                      layerId={activeLayer()?.id ?? null}
                      layerNames={editingProfile()!.layers.map((l) => l.name)}
                      issues={issuesFor(mapping.id)}
                    />
                  )}
                </For>
              </div>
            </Show>
            <Show when={!activeLayer() && hasMultiTap(key().code)}>
              <p class="w-full text-[11.5px] text-ink-faint">
                keyd has no delayed tap, so the first tap still acts right away. Tapping again within{" "}
                {TAP_WINDOW_MS} ms runs the next action, including when you type this key twice quickly.
              </p>
            </Show>
          </div>
        )}
        </Show>
      </div>

      <Dialog
        open={confirmReset()}
        onClose={() => setConfirmReset(false)}
        title="Reset all mappings?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={resetAll}>
              Reset all
            </Button>
          </>
        }
      >
        <p class="text-[12.5px] text-ink-dim">
          Removes every mapping and layer from <span class="text-ink">{editingProfile()?.name}</span>, so all
          keys go back to their defaults. Nothing reaches keyd until you press Apply.
        </p>
      </Dialog>
    </div>
  )
}

type TestModeSwitchProps = {
  mode: TestMode
  onChange: (mode: TestMode) => void
}

function TestModeSwitch(props: TestModeSwitchProps) {
  const modes: { id: TestMode; label: string }[] = [
    { id: "off", label: "Edit" },
    { id: "flash", label: "Test: flash" },
    { id: "sticky", label: "Test: sticky" }
  ]
  return (
    <div role="radiogroup" aria-label="Keyboard mode" class="flex rounded-md bg-surface-2 p-0.5">
      <For each={modes}>
        {(mode) => (
          <button
            type="button"
            role="radio"
            aria-checked={props.mode === mode.id}
            class={`rounded px-2.5 py-1 text-[12px] transition-colors duration-150 ${
              props.mode === mode.id ? "bg-surface-3 text-ink" : "text-ink-faint hover:text-ink-dim"
            }`}
            onClick={() => props.onChange(mode.id)}
          >
            {mode.label}
          </button>
        )}
      </For>
    </div>
  )
}

type OwnerLineProps = {
  board: Board | undefined
  foreign: string | undefined
  hasOwnLayout: boolean
}

function OwnerLine(props: OwnerLineProps) {
  return (
    <p class="h-4 pl-0.5 text-[12px] leading-4 text-ink-faint">
      <Show when={props.board} fallback="Applies to every keyboard">
        <Show
          when={!props.foreign}
          fallback={<span class="text-warn">Controlled by {props.foreign}</span>}
        >
          <Show when={props.hasOwnLayout} fallback="Shared mappings · remap a key to give it its own layout">
            <span class="text-ok">Custom layout for this keyboard</span>
          </Show>
        </Show>
      </Show>
    </p>
  )
}

type KeyButtonProps = {
  physical: PhysicalKey
  own: Mapping[]
  shared: Mapping[]
  active: boolean
  held: boolean
  tested: boolean
  trigger: boolean
  onSelect: () => void
}

function KeyButton(props: KeyButtonProps) {
  const remapped = () => props.own.length > 0
  return (
    <button
      type="button"
      disabled={props.physical.code === ""}
      title={props.physical.code || "Handled by keyboard firmware"}
      style={{ width: `${(props.physical.width ?? 1) * UNIT - 4}px`, height: `${UNIT - 4}px` }}
      class={`relative flex shrink-0 flex-col items-start justify-between rounded-lg px-1.5 py-1 text-left transition-[background-color,border-color,transform,box-shadow] duration-150 active:translate-y-px active:shadow-none data-[held=true]:translate-y-px disabled:opacity-35 ${
        props.active
          ? "bg-accent/25 shadow-[0_2px_0_0_color-mix(in_srgb,var(--color-accent)_45%,transparent)]"
          : props.tested
            ? "bg-sky/20 shadow-[0_2px_0_0_color-mix(in_srgb,var(--color-sky)_40%,transparent)]"
            : props.trigger
            ? "bg-accent/15 shadow-[0_2px_0_0_color-mix(in_srgb,var(--color-accent)_35%,transparent)] ring-1 ring-accent/50"
            : remapped()
            ? "bg-ok/15 shadow-[0_2px_0_0_color-mix(in_srgb,var(--color-ok)_35%,transparent)] hover:bg-ok/25"
            : "bg-surface-3 shadow-[0_2px_0_0_#000] hover:bg-[#2a2a2a]"
      }`}
      data-held={props.held}
      onClick={() => props.onSelect()}
    >
      <span aria-hidden="true" data-held={props.held} class="kb-flash pointer-events-none absolute inset-0 rounded-lg" />
      <span class="relative font-mono text-[10.5px] leading-none text-ink">{props.physical.legend}</span>
      <Show when={remapped()}>
        <span class="relative w-full truncate font-mono text-[9px] leading-none text-ok">{summary(props.own)}</span>
      </Show>
      <Show when={!remapped() && props.shared.length > 0}>
        <span class="relative w-full truncate font-mono text-[9px] leading-none text-ink-faint">{summary(props.shared)}</span>
      </Show>
    </button>
  )
}
