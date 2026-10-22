import { createMemo, For, Show, Suspense } from "solid-js"
import { appStore } from "@/app/utilities/store"
import { Badge } from "@/shared/components/badge"
import { Button } from "@/shared/components/button"
import { devices, refetchDevices } from "@/modules/status/api/queries/status"
import { peripheralsFrom, type Peripheral } from "@/modules/keyboard/utilities/devices"

type Props = {
  device: Peripheral
}

function Identity(props: Props) {
  return (
    <div class="min-w-0 flex-1">
      <p class="truncate text-[12.5px]">{props.device.name}</p>
      <p class="truncate text-[11px] text-ink-faint">
        {props.device.vendor}:{props.device.product}
        <Show when={props.device.phys}> · {props.device.phys}</Show>
        <Show when={props.device.interfaces > 1}> · {props.device.interfaces} interfaces</Show>
      </p>
    </div>
  )
}

export function DevicePanel() {
  const profile = appStore.currentProfile
  const peripherals = createMemo(() => peripheralsFrom(devices() ?? []))
  const keyboards = createMemo(() => peripherals().filter((p) => p.kind === "keyboard"))
  const others = createMemo(() => peripherals().filter((p) => p.kind !== "keyboard" && !p.virtual))

  function included(vendor: string, product: string): boolean {
    const current = profile()
    if (!current) {
      return false
    }
    return (
      current.devices.length === 0 ||
      current.devices.some((d) => d.vendor === vendor && d.product === product)
    )
  }

  function toggle(vendor: string, product: string, name: string) {
    const current = profile()
    if (!current) {
      return
    }
    appStore.updateProfile(current.id, (draft) => {
      const index = draft.devices.findIndex((d) => d.vendor === vendor && d.product === product)
      if (index >= 0) {
        draft.devices.splice(index, 1)
      } else {
        draft.devices.push({ vendor, product, name })
      }
    })
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col overflow-auto p-3">
      <div class="mb-2 flex items-center gap-2">
        <h2 class="section-heading">Detected keyboards</h2>
        <Button variant="ghost" loading={devices.loading} onClick={() => void refetchDevices()}>
          Refresh
        </Button>
      </div>
      <p class="mb-3 text-[12px] text-ink-dim">
        With no devices selected, the profile applies to every keyboard. Selecting devices scopes
        it by vendor and product id — names alone are not used for matching.
      </p>
      <Suspense fallback={<p class="text-ink-faint">Scanning input devices…</p>}>
        <div class="flex flex-col gap-1.5">
          <Show when={keyboards().length === 0}>
            <div class="flex flex-col items-center gap-1 rounded-md border border-dashed border-line py-8 text-center">
              <p class="text-ink-dim">No keyboards detected.</p>
              <p class="text-[12px] text-ink-faint">Try Refresh after plugging one in.</p>
            </div>
          </Show>
          <For each={keyboards()}>
            {(device) => (
              <div class="flex items-center gap-3 rounded border border-line bg-surface-1 px-3 py-2 transition-colors duration-100">
                <Identity device={device} />
                <Show when={device.virtual}>
                  <Badge tone="muted" text="keyd virtual" />
                </Show>
                <Show when={!device.virtual}>
                  <Badge
                    tone={included(device.vendor, device.product) ? "ok" : "muted"}
                    text={included(device.vendor, device.product) ? "in profile" : "excluded"}
                  />
                  <Button onClick={() => toggle(device.vendor, device.product, device.name)}>
                    {profile()?.devices.some(
                      (d) => d.vendor === device.vendor && d.product === device.product
                    )
                      ? "Remove"
                      : "Scope to profile"}
                  </Button>
                </Show>
              </div>
            )}
          </For>
        </div>
        <Show when={others().length > 0}>
          <h2 class="section-heading mt-6 mb-2">Other peripherals</h2>
          <p class="mb-3 text-[12px] text-ink-dim">
            Mice, headsets and microphones. Not managed here yet. Test microphones, cameras and speakers in the Media tab.
          </p>
          <div class="flex flex-col gap-1.5">
            <For each={others()}>
              {(device) => (
                <div class="flex items-center gap-3 rounded border border-line bg-surface-1 px-3 py-2 opacity-80">
                  <Identity device={device} />
                  <Badge tone="muted" text={device.kind} />
                </div>
              )}
            </For>
          </div>
        </Show>
      </Suspense>
    </div>
  )
}
