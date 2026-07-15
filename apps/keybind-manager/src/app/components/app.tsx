import { For, Show, createSignal } from "solid-js"
import { StatusHeader } from "@/modules/status/components/status-header"
import { ProfileSidebar } from "@/modules/profiles/components/profile-sidebar"
import { MappingEditor } from "@/modules/mappings/components/mapping-editor"
import { DevicePanel } from "@/modules/devices/components/device-panel"
import { DiagnosticsPanel } from "@/modules/status/components/diagnostics-panel"
import { DotfilesPanel } from "@/modules/settings/components/dotfiles-panel"
import { appStore } from "@/app/utilities/store"

type Tab = "mappings" | "devices" | "diagnostics" | "dotfiles"

export function App() {
  const [tab, setTab] = createSignal<Tab>("mappings")
  const tabs: { id: Tab; label: string }[] = [
    { id: "mappings", label: "Mappings" },
    { id: "devices", label: "Devices" },
    { id: "diagnostics", label: "Diagnostics" },
    { id: "dotfiles", label: "Dotfiles" }
  ]

  return (
    <div class="flex h-screen flex-col">
      <StatusHeader />
      <div class="flex min-h-0 flex-1">
        <ProfileSidebar />
        <main class="flex min-w-0 flex-1 flex-col">
          <div role="tablist" aria-label="Sections" class="flex gap-1 border-b border-line bg-surface-1 px-2 pt-1.5">
            <For each={tabs}>
              {(item) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab() === item.id}
                  class={`rounded-t border border-b-0 px-3 py-1 text-[12.5px] ${
                    tab() === item.id
                      ? "border-line bg-surface-0 text-ink"
                      : "border-transparent text-ink-dim hover:text-ink"
                  }`}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              )}
            </For>
          </div>
          <Show when={!appStore.loaded.loading} fallback={<ShellSkeleton />}>
            <Show when={tab() === "mappings"}>
              <MappingEditor />
            </Show>
            <Show when={tab() === "devices"}>
              <DevicePanel />
            </Show>
            <Show when={tab() === "diagnostics"}>
              <DiagnosticsPanel />
            </Show>
            <Show when={tab() === "dotfiles"}>
              <DotfilesPanel />
            </Show>
          </Show>
        </main>
      </div>
    </div>
  )
}

function ShellSkeleton() {
  return (
    <div class="flex flex-col gap-2 p-3" aria-hidden="true">
      <div class="h-8 w-2/3 animate-pulse rounded bg-surface-2" />
      <div class="h-8 w-1/2 animate-pulse rounded bg-surface-2" />
      <div class="h-8 w-3/5 animate-pulse rounded bg-surface-2" />
    </div>
  )
}
