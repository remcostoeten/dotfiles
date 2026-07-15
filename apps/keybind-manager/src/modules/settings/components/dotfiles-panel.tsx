import { Show, createSignal } from "solid-js"
import { open } from "@tauri-apps/plugin-dialog"
import { appStore } from "@/app/utilities/store"
import { Button } from "@/shared/components/button"
import { Toggle } from "@/shared/components/toggle"
import { exportProfiles, importBundle } from "@/shared/utilities/native"
import { toNativeError } from "@/shared/utilities/guards"
import { makeId } from "@/shared/utilities/id"
import type { Profile } from "@/shared/types/config"

export function DotfilesPanel() {
  const [status, setStatus] = createSignal("")
  const [failure, setFailure] = createSignal("")
  const [includeHardware, setIncludeHardware] = createSignal(false)
  const [onlyActive, setOnlyActive] = createSignal(true)
  const [pending, setPending] = createSignal<Profile[] | null>(null)

  async function doExport() {
    setStatus("")
    setFailure("")
    try {
      const dir = await open({ directory: true, title: "Choose export directory" })
      if (typeof dir !== "string") {
        return
      }
      const path = await exportProfiles(
        appStore.snapshot(),
        onlyActive() ? appStore.config.active : null,
        dir,
        includeHardware()
      )
      setStatus(`Exported to ${path} (with install.sh)`)
    } catch (raw) {
      setFailure(toNativeError(raw).message)
    }
  }

  async function doImport() {
    setStatus("")
    setFailure("")
    try {
      const file = await open({
        title: "Choose config.toml",
        filters: [{ name: "TOML", extensions: ["toml"] }]
      })
      if (typeof file !== "string") {
        return
      }
      const bundle = await importBundle(file)
      setPending(bundle.profiles)
    } catch (raw) {
      setFailure(toNativeError(raw).message)
    }
  }

  function confirmImport() {
    const profiles = pending()
    if (!profiles) {
      return
    }
    appStore.mutate(function merge(draft) {
      for (const incoming of profiles) {
        const existing = draft.profiles.findIndex((p) => p.id === incoming.id)
        if (existing >= 0) {
          draft.profiles[existing] = incoming
        } else {
          draft.profiles.push({ ...incoming, id: incoming.id || makeId("profile") })
        }
      }
    })
    setPending(null)
    setStatus("Imported into the editor. Review the mappings, then Apply.")
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col overflow-auto p-3">
      <div class="max-w-xl">
        <h2 class="mb-1 text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
          Dotfiles
        </h2>
        <p class="mb-3 text-[12px] text-ink-dim">
          Exports a deterministic <code>config.toml</code> plus an idempotent{" "}
          <code>install.sh</code> suitable for source control. Root-owned generated keyd files
          never land in your repository.
        </p>

        <div class="mb-3 flex flex-col gap-2">
          <Toggle
            checked={onlyActive()}
            onChange={setOnlyActive}
            label="Export only the active profile"
            showLabel
          />
          <Toggle
            checked={includeHardware()}
            onChange={setIncludeHardware}
            label="Include hardware ids (machine-specific)"
            showLabel
          />
        </div>

        <div class="flex gap-2">
          <Button variant="primary" onClick={() => void doExport()}>
            Export…
          </Button>
          <Button onClick={() => void doImport()}>Import…</Button>
        </div>

        <Show when={status()}>
          <p class="mt-3 text-[12px] text-ok select-text">{status()}</p>
        </Show>
        <Show when={failure()}>
          <p class="mt-3 text-[12px] text-bad select-text">{failure()}</p>
        </Show>

        <Show when={pending()}>
          {(profiles) => (
            <div class="mt-4 rounded border border-line bg-surface-1 p-3">
              <h3 class="mb-1 text-[12px] font-semibold">Preview import</h3>
              <ul class="mb-2 list-disc pl-4 text-[12px] text-ink-dim">
                {profiles().map((profile) => (
                  <li>
                    {profile.name} — {profile.mappings.length} mapping(s),{" "}
                    {profile.layers.length} layer(s)
                  </li>
                ))}
              </ul>
              <div class="flex gap-2">
                <Button variant="primary" onClick={confirmImport}>
                  Import into editor
                </Button>
                <Button variant="ghost" onClick={() => setPending(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Show>

        <div class="mt-5">
          <h3 class="mb-1 text-[12px] font-semibold">Apply from dotfiles later</h3>
          <pre class="rounded border border-line bg-surface-0 p-2 text-[11.5px] text-ink-dim select-text">
{`keybind-manager validate ./keyboard/config.toml
keybind-manager apply ./keyboard/config.toml`}
          </pre>
        </div>
      </div>
    </div>
  )
}
