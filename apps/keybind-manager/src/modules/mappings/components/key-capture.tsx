import { Show, createSignal, onCleanup } from "solid-js"
import { Button } from "@/shared/components/button"
import { Dialog } from "@/shared/components/dialog"
import { KeyCap } from "@/shared/components/key-cap"
import { Select } from "@/shared/components/select"
import { codeToKey, commonKeys } from "@/modules/mappings/utilities/key-names"

type Props = {
  open: boolean
  title: string
  onPick: (key: string) => void
  onClose: () => void
}

export function KeyCapture(props: Props) {
  const [captured, setCaptured] = createSignal<string | null>(null)
  const [unknown, setUnknown] = createSignal(false)
  const [manual, setManual] = createSignal("capslock")

  function handleKey(event: KeyboardEvent) {
    if (!props.open) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const key = codeToKey(event.code)
    if (key) {
      setCaptured(key)
      setUnknown(false)
    } else {
      setUnknown(true)
    }
  }

  window.addEventListener("keydown", handleKey, true)
  onCleanup(() => window.removeEventListener("keydown", handleKey, true))

  function close() {
    setCaptured(null)
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
                props.onPick(key)
              }
              close()
            }}
          >
            Use key
          </Button>
        </>
      }
    >
      <div class="flex flex-col items-center gap-3 py-3">
        <p class="text-[12.5px] text-ink-dim">Press the key you want to use.</p>
        <div class="flex h-12 items-center">
          <Show when={captured()} fallback={<span class="text-ink-faint">waiting for input…</span>}>
            {(key) => <KeyCap name={key()} />}
          </Show>
        </div>
        <Show when={unknown()}>
          <p class="text-[12px] text-warn">That key could not be identified; pick it manually below.</p>
        </Show>
        <p class="text-center text-[11.5px] text-ink-faint">
          Some desktop-global shortcuts may be intercepted by KDE before they reach this window.
          Use the manual selector if a key cannot be captured.
        </p>
        <div class="flex items-center gap-2">
          <Select
            label="Manual key selector"
            value={manual()}
            onChange={setManual}
            options={commonKeys.map((key) => ({ value: key, label: key }))}
          />
          <Button
            onClick={() => {
              props.onPick(manual())
              close()
            }}
          >
            Use selected
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
