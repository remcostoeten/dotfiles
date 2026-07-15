import { For, Show, createSignal } from "solid-js"
import { appStore } from "@/app/utilities/store"
import { Button } from "@/shared/components/button"
import { Dialog } from "@/shared/components/dialog"

export function ProfileSidebar() {
  const [renaming, setRenaming] = createSignal<string | null>(null)
  const [draftName, setDraftName] = createSignal("")
  const [deleting, setDeleting] = createSignal<string | null>(null)

  function startRename(id: string, current: string) {
    setDraftName(current)
    setRenaming(id)
  }

  function commitRename() {
    const id = renaming()
    const name = draftName().trim()
    if (id && name) {
      appStore.updateProfile(id, (profile) => {
        profile.name = name
      })
    }
    setRenaming(null)
  }

  return (
    <aside class="flex w-48 shrink-0 flex-col border-r border-line bg-surface-1">
      <div class="flex items-center justify-between px-2.5 py-2">
        <h2 class="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">Profiles</h2>
        <Button variant="ghost" aria-label="Create profile" onClick={() => appStore.addProfile("New profile")}>
          +
        </Button>
      </div>
      <nav class="min-h-0 flex-1 overflow-auto" aria-label="Profiles">
        <For each={appStore.config.profiles}>
          {(profile, index) => (
            <div
              class={`group flex items-center gap-1 border-l-2 px-2 py-1.5 ${
                appStore.selectedProfile() === profile.id
                  ? "border-accent bg-surface-2"
                  : "border-transparent hover:bg-surface-2/50"
              }`}
            >
              <button
                type="button"
                class="min-w-0 flex-1 truncate text-left text-[12.5px]"
                onClick={() => appStore.setSelectedProfile(profile.id)}
                onDblClick={() => startRename(profile.id, profile.name)}
              >
                <span class={profile.enabled ? "" : "text-ink-faint line-through"}>
                  {profile.name}
                </span>
                <Show when={appStore.config.active === profile.id}>
                  <span class="ml-1 text-[10px] text-accent">default</span>
                </Show>
              </button>
              <div class="hidden shrink-0 items-center group-hover:flex group-focus-within:flex">
                <Button
                  variant="ghost"
                  aria-label={`Move ${profile.name} up`}
                  disabled={index() === 0}
                  onClick={() => appStore.moveProfile(profile.id, -1)}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Move ${profile.name} down`}
                  disabled={index() === appStore.config.profiles.length - 1}
                  onClick={() => appStore.moveProfile(profile.id, 1)}
                >
                  ↓
                </Button>
              </div>
            </div>
          )}
        </For>
      </nav>
      <Show when={appStore.currentProfile()}>
        {(profile) => (
          <div class="grid grid-cols-2 gap-1 border-t border-line p-2">
            <Button onClick={() => startRename(profile().id, profile().name)}>Rename</Button>
            <Button onClick={() => appStore.duplicateProfile(profile().id)}>Duplicate</Button>
            <Button
              disabled={appStore.config.active === profile().id}
              onClick={() =>
                appStore.mutate((draft) => {
                  draft.active = profile().id
                })
              }
            >
              Set default
            </Button>
            <Button
              variant="danger"
              disabled={appStore.config.profiles.length <= 1}
              onClick={() => setDeleting(profile().id)}
            >
              Delete
            </Button>
          </div>
        )}
      </Show>

      <Dialog
        open={renaming() !== null}
        onClose={() => setRenaming(null)}
        title="Rename profile"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={commitRename}>
              Rename
            </Button>
          </>
        }
      >
        <input
          class="w-full rounded border border-line bg-surface-2 px-2 py-1 text-[12.5px]"
          value={draftName()}
          aria-label="Profile name"
          onInput={(event) => setDraftName(event.currentTarget.value)}
          onKeyDown={(event) => event.key === "Enter" && commitRename()}
        />
      </Dialog>

      <Dialog
        open={deleting() !== null}
        onClose={() => setDeleting(null)}
        title="Delete profile"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const id = deleting()
                if (id) {
                  appStore.removeProfile(id)
                }
                setDeleting(null)
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p class="text-[12.5px] text-ink-dim">
          This removes the profile from the editor. Applied keyd files are cleaned up on the next
          apply.
        </p>
      </Dialog>
    </aside>
  )
}
