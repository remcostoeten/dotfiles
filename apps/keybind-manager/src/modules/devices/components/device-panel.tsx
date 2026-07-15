import { For, Show, Suspense } from "solid-js"
import { appStore } from "@/app/utilities/store"
import { Badge } from "@/shared/components/badge"
import { Button } from "@/shared/components/button"
import { devices, refetchDevices } from "@/modules/status/api/queries/status"

export function DevicePanel() {
  const profile = appStore.currentProfile

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
        <h2 class="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
          Detected keyboards
        </h2>
        <Button variant="ghost" onClick={() => void refetchDevices()}>
          Refresh
        </Button>
      </div>
      <p class="mb-3 text-[12px] text-ink-dim">
        With no devices selected, the profile applies to every keyboard. Selecting devices scopes
        it by vendor and product id — names alone are not used for matching.
      </p>
      <Suspense fallback={<p class="text-ink-faint">Scanning input devices…</p>}>
        <div class="flex flex-col gap-1.5">
          <For each={devices() ?? []}>
            {(device) => (
              <div class="flex items-center gap-3 rounded border border-line bg-surface-1 px-3 py-2">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[12.5px]">{device.name}</p>
                  <p class="truncate text-[11px] text-ink-faint">
                    {device.vendor}:{device.product}
                    <Show when={device.phys}> · {device.phys}</Show>
                  </p>
                </div>
                <Show when={device.virtual_keyd}>
                  <Badge tone="muted" text="keyd virtual" />
                </Show>
                <Show when={!device.virtual_keyd}>
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
      </Suspense>
    </div>
  )
}
