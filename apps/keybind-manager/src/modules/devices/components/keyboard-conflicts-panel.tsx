import { createSignal, For, Show } from "solid-js"
import { Badge } from "@/shared/components/badge"
import { Button } from "@/shared/components/button"
import { useKeyboardConflicts } from "@/modules/devices/hooks/use-keyboard-conflicts"
import { takeOverKeydConfig } from "@/modules/devices/api/mutations/take-over"
import { appStore } from "@/app/utilities/store"

export function KeyboardConflictsPanel() {
  const { phase, conflicts, error, scan } = useKeyboardConflicts()
  const [takeOverError, setTakeOverError] = createSignal<string | null>(null)
  const [busyFile, setBusyFile] = createSignal<string | null>(null)

  function isAdopted(filename: string) {
    return appStore.config.profiles.some((p) => p.replaces?.includes(filename))
  }

  async function takeOver(filename: string) {
    setBusyFile(filename)
    setTakeOverError(null)
    const result = await takeOverKeydConfig(filename)
    setBusyFile(null)
    if (!result.ok) {
      setTakeOverError(result.error.message)
    }
  }

  return (
    <div class="mb-3 rounded border border-line bg-surface-1 p-3">
      <div class="mb-2 flex items-center gap-2">
        <h2 class="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
          Keyd config conflicts
        </h2>
        <Button variant="ghost" onClick={() => void scan()}>
          {phase() === "scanning" ? "Scanning…" : "Scan /etc/keyd"}
        </Button>
      </div>
      <p class="mb-3 text-[12px] text-ink-dim">
        keyd applies only one config per keyboard. If another config matches a keyboard at the
        same priority as ours, keyd may silently ignore our mappings for that device. Scanning
        requires authorization to read /etc/keyd.
      </p>
      <Show when={phase() === "failed" && error()}>
        {(err) => (
          <p class="mb-2 rounded border border-bad/40 bg-bad/10 px-2 py-1.5 text-[12px] text-bad">
            {err().message}
          </p>
        )}
      </Show>
      <Show when={takeOverError()}>
        {(message) => (
          <p class="mb-2 rounded border border-bad/40 bg-bad/10 px-2 py-1.5 text-[12px] text-bad">
            {message()}
          </p>
        )}
      </Show>
      <Show when={phase() === "done" && conflicts().length === 0}>
        <p class="text-[12px] text-ink-faint">No connected keyboards matched any config.</p>
      </Show>
      <div class="flex flex-col gap-1.5">
        <For each={conflicts()}>
          {(entry) => (
            <div class="rounded border border-line bg-surface-0 px-3 py-2">
              <div class="flex items-center gap-2">
                <p class="min-w-0 flex-1 truncate text-[12.5px]">{entry.device_name}</p>
                <p class="text-[11px] text-ink-faint">
                  {entry.vendor}:{entry.product}
                </p>
                <Show when={entry.conflict}>
                  <Badge tone="bad" text="conflict" />
                </Show>
                <Show when={entry.shadowed}>
                  <Badge tone="warn" text="overridden" />
                </Show>
              </div>
              <Show
                when={entry.matches.length > 0}
                fallback={<p class="mt-1 text-[11px] text-ink-faint">No config matches this keyboard.</p>}
              >
                <div class="mt-1.5 flex flex-col gap-1">
                  <For each={entry.matches}>
                    {(match) => (
                      <div class="flex items-center gap-2 text-[11.5px]">
                        <span class="min-w-0 flex-1 truncate text-ink-dim">{match.filename}</span>
                        <Badge tone={match.managed ? "ok" : "muted"} text={match.managed ? "ours" : "other"} />
                        <Badge tone="muted" text={match.rank} />
                        <Show when={!match.managed}>
                          <Show
                            when={!isAdopted(match.filename)}
                            fallback={<Badge tone="ok" text="taken over — apply to finish" />}
                          >
                            <Button
                              variant="ghost"
                              onClick={() => void takeOver(match.filename)}
                            >
                              {busyFile() === match.filename ? "Importing…" : "Take over & edit"}
                            </Button>
                          </Show>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={entry.conflict}>
                <p class="mt-2 text-[11.5px] text-bad">
                  keyd will only use one of these for this keyboard. Scope this profile to this
                  device under [ids], or remove/merge the other catch-all config, then apply
                  again — or apply with force to proceed anyway.
                </p>
              </Show>
              <Show when={entry.shadowed}>
                <p class="mt-2 text-[11.5px] text-warn">
                  {entry.matches[0]?.filename} targets this keyboard directly, so keyd ignores
                  Keybind Manager's mappings here. Use “Take over & edit” to import it as an
                  editable profile; applying moves the original to
                  /etc/keyd/.keybind-manager-retired.
                </p>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
