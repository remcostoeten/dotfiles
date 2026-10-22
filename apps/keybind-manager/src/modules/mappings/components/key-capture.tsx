import { Show, createSignal, onCleanup } from "solid-js"
import { Button } from "@/shared/components/button"
import { Dialog } from "@/shared/components/dialog"
import { KeyCap } from "@/shared/components/key-cap"
import { KeyPicker } from "@/modules/mappings/components/key-picker"
import { codeToKey, modifiers } from "@/modules/mappings/utilities/key-names"

type Props = {
  open: boolean
  title: string
  withMods?: boolean
  onPick: (key: string, mods: string[]) => void
  onClose: () => void
}

const MAX_MODS = 2

function heldMods(event: KeyboardEvent): string[] {
  const held: [boolean, string][] = [
    [event.ctrlKey, "control"],
    [event.shiftKey, "shift"],
    [event.altKey, "alt"],
    [event.metaKey, "meta"]
  ]
  return held.filter(([down]) => down).map(([, mod]) => mod)
}

export function KeyCapture(props: Props) {
  const [captured, setCaptured] = createSignal<string | null>(null)
  const [unknown, setUnknown] = createSignal(false)
  const [capturedMods, setCapturedMods] = createSignal<string[]>([])
  const [manualMods, setManualMods] = createSignal<string[]>([])

  function handleKey(event: KeyboardEvent) {
    if (!props.open || event.target instanceof HTMLInputElement) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const key = codeToKey(event.code)
    if (key) {
      const isModifierKey = (modifiers as readonly string[]).some((mod) => key.endsWith(mod))
      const mods = props.withMods && !isModifierKey ? heldMods(event).slice(0, MAX_MODS) : []
      setCaptured(key)
      setCapturedMods(mods)
      setUnknown(false)
    } else {
      setUnknown(true)
    }
  }

  window.addEventListener("keydown", handleKey, true)
  onCleanup(() => window.removeEventListener("keydown", handleKey, true))

  function close() {
    setCaptured(null)
    setCapturedMods([])
    setManualMods([])
    setUnknown(false)
    props.onClose()
  }

  return (
    <Dialog
      open={props.open}
      onClose={close}
      title={props.title}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!captured()}
            onClick={() => {
              const key = captured()
              if (key) {
                props.onPick(key, capturedMods())
              }
              close()
            }}
          >
            Use key
          </Button>
        </>
      }
    >
      <div class="flex flex-col gap-4 py-3">
        <div class="flex flex-col items-center gap-3">
          <p class="text-[12.5px] text-ink-dim">
            {props.withMods
              ? "Press the key or shortcut (up to two modifiers + a key)."
              : "Press the key you want to use."}
          </p>
          <div class="flex h-12 items-center">
            <Show when={captured()} fallback={<span class="text-ink-faint">waiting for input…</span>}>
              {(key) => <KeyCap name={key()} mods={capturedMods()} />}
            </Show>
          </div>
          <Show when={unknown()}>
            <p class="text-[12px] text-warn">That key could not be identified; pick it manually below.</p>
          </Show>
        </div>

        <div class="rounded-md border border-line-strong bg-surface-2 p-3">
          <h3 class="section-heading mb-1">Manual selection</h3>
          <p class="mb-2.5 text-[11.5px] text-ink-dim">
            Use this for Fn/media keys and any key your desktop environment grabs before it
            reaches this window — not limited to KDE.
          </p>
          <Show when={props.withMods}>
            <div class="mb-2 flex flex-wrap items-center gap-1">
              <span class="text-[11.5px] text-ink-dim">Modifiers:</span>
              {modifiers.map((mod) => (
                <Button
                  variant={manualMods().includes(mod) ? "primary" : "ghost"}
                  aria-pressed={manualMods().includes(mod)}
                  disabled={!manualMods().includes(mod) && manualMods().length >= MAX_MODS}
                  onClick={() =>
                    setManualMods((mods) =>
                      mods.includes(mod) ? mods.filter((m) => m !== mod) : [...mods, mod]
                    )
                  }
                >
                  {mod}
                </Button>
              ))}
            </div>
          </Show>
          <KeyPicker
            onPick={(key) => {
              props.onPick(key, manualMods())
              close()
            }}
          />
        </div>
      </div>
    </Dialog>
  )
}
