import { For, Show } from "solid-js"
import { StatusHeader } from "@/modules/status/components/status-header"
import { ProfileSidebar } from "@/modules/profiles/components/profile-sidebar"
import { KeyboardView } from "@/modules/keyboard/components/keyboard-view"
import { MappingEditor } from "@/modules/mappings/components/mapping-editor"
import { DevicePanel } from "@/modules/devices/components/device-panel"
import { KeyboardConflictsPanel } from "@/modules/devices/components/keyboard-conflicts-panel"
import { BoardView } from "@/modules/via/components/board-view"
import { MediaView } from "@/modules/media/components/media-view"
import { DiagnosticsPanel } from "@/modules/status/components/diagnostics-panel"
import { DotfilesPanel } from "@/modules/settings/components/dotfiles-panel"
import { appStore } from "@/app/utilities/store"
import type { Tab } from "@/app/utilities/store"


export function App() {
  const tab = appStore.tab
  const setTab = appStore.setTab
  const tabs: { id: Tab; label: string }[] = [
    { id: "keyboard", label: "Keyboard" },
    { id: "advanced", label: "Advanced" },
    { id: "devices", label: "Devices" },
    { id: "board", label: "Board" },
    { id: "media", label: "Media" },
    { id: "diagnostics", label: "Diagnostics" },
    { id: "dotfiles", label: "Dotfiles" }
  ]

  return (
    <div class="flex h-screen flex-col">
      <StatusHeader />
      <div class="flex min-h-0 flex-1">
        <Show when={tab() === "advanced"}>
          <ProfileSidebar />
        </Show>
        <main class="flex min-w-0 flex-1 flex-col">
          <div role="tablist" aria-label="Sections" class="flex gap-5 border-b border-line px-4">
            <For each={tabs}>
              {(item) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab() === item.id}
                  class={`-mb-px border-b py-2.5 text-[12.5px] transition-colors duration-150 ${
                    tab() === item.id
                      ? "border-accent text-ink"
                      : "border-transparent text-ink-faint hover:text-ink-dim"
                  }`}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              )}
            </For>
          </div>
          <Show when={!appStore.loaded.loading} fallback={<ShellSkeleton />}>
            <Show when={tab() === "keyboard"}>
              <KeyboardView />
            </Show>
            <Show when={tab() === "advanced"}>
              <MappingEditor />
            </Show>
            <Show when={tab() === "devices"}>
              <div class="p-3 pb-0">
                <KeyboardConflictsPanel />
              </div>
              <DevicePanel />
            </Show>
            <Show when={tab() === "board"}>
              <BoardView />
            </Show>
            <Show when={tab() === "media"}>
              <MediaView />
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
