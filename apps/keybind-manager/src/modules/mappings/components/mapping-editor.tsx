import { For, Show, createMemo, createResource, createSignal } from "solid-js"
import type { Mapping, Profile } from "@/shared/types/config"
import { appStore } from "@/app/utilities/store"
import { Badge } from "@/shared/components/badge"
import { Button } from "@/shared/components/button"
import { Dialog } from "@/shared/components/dialog"
import { MappingRow } from "@/modules/mappings/components/mapping-row"
import { makeId } from "@/shared/utilities/id"
import { checkConfig } from "@/shared/utilities/native"

function newMapping(): Mapping {
  return {
    id: makeId("map"),
    source: { key: "capslock", mods: [], mode: "press" },
    target: { kind: "key", key: "esc", mods: [] },
    enabled: true
  }
}

export function MappingEditor() {
  const [addingLayer, setAddingLayer] = createSignal(false)
  const [layerName, setLayerName] = createSignal("")

  const [check] = createResource(
    () => JSON.stringify(appStore.config),
    async function revalidate() {
      return checkConfig(appStore.snapshot())
    }
  )

  const profile = appStore.currentProfile

  const issuesFor = createMemo(() => {
    const result = check()
    return function lookup(mappingId: string) {
      if (!result) {
        return []
      }
      return [...result.errors, ...result.warnings].filter((i) => i.mapping_id === mappingId)
    }
  })

  function addMapping(layerId: string | null) {
    const current = profile()
    if (!current) {
      return
    }
    appStore.updateProfile(current.id, (draft) => {
      if (layerId) {
        draft.layers.find((l) => l.id === layerId)?.mappings.push(newMapping())
      } else {
        draft.mappings.push(newMapping())
      }
    })
  }

  function addSwap() {
    const current = profile()
    if (!current) {
      return
    }
    appStore.updateProfile(current.id, (draft) => {
      draft.mappings.push(
        {
          id: makeId("map"),
          source: { key: "capslock", mods: [], mode: "press" },
          target: { kind: "key", key: "esc", mods: [] },
          enabled: true
        },
        {
          id: makeId("map"),
          source: { key: "esc", mods: [], mode: "press" },
          target: { kind: "key", key: "capslock", mods: [] },
          enabled: true
        }
      )
    })
  }

  function addTapHold() {
    const current = profile()
    if (!current) {
      return
    }
    appStore.updateProfile(current.id, (draft) => {
      draft.mappings.push(
        {
          id: makeId("map"),
          source: { key: "capslock", mods: [], mode: "tap" },
          target: { kind: "key", key: "esc", mods: [] },
          enabled: true
        },
        {
          id: makeId("map"),
          source: { key: "capslock", mods: [], mode: "hold" },
          target: { kind: "key", key: "leftcontrol", mods: [] },
          enabled: true
        }
      )
    })
  }

  function commitLayer() {
    const current = profile()
    const name = layerName().trim().toLowerCase().replace(/[^a-z0-9_]/g, "")
    if (current && name) {
      appStore.updateProfile(current.id, (draft) => {
        draft.layers.push({ id: makeId("layer"), name, mappings: [] })
      })
    }
    setAddingLayer(false)
    setLayerName("")
  }

  function removeLayer(profileId: string, layerId: string) {
    appStore.updateProfile(profileId, (draft) => {
      draft.layers = draft.layers.filter((l) => l.id !== layerId)
    })
  }

  return (
    <Show
      when={profile()}
      fallback={<p class="p-4 text-ink-faint">No profile selected.</p>}
    >
      {(current: () => Profile) => (
        <div class="flex min-h-0 flex-1 flex-col overflow-auto">
          <p class="px-4 pt-3 text-[12px] text-ink-faint">
            Tap/hold keys, shortcuts with modifiers, macros and layers for the profile selected on the
            left. Simple one-key remaps are easier on the Keyboard tab.
          </p>
          <div class="flex flex-wrap items-center gap-1.5 px-4 py-2.5">
            <Button variant="primary" onClick={() => addMapping(null)}>
              + Mapping
            </Button>
            <Button onClick={addSwap}>+ Swap Caps/Esc</Button>
            <Button onClick={addTapHold}>+ Tap/hold Caps</Button>
            <Button onClick={() => setAddingLayer(true)}>+ Layer</Button>
            <span class="flex-1" />
            <Show when={(check()?.warnings ?? []).length > 0}>
              <Badge tone="warn" text={`${check()?.warnings.length} warning(s)`} />
            </Show>
            <Show when={(check()?.errors ?? []).length > 0}>
              <Badge tone="bad" text={`${check()?.errors.length} error(s)`} />
            </Show>
          </div>

          <Show when={current().mappings.length === 0 && current().layers.length === 0}>
            <div class="m-4 flex flex-col items-center gap-1 rounded-md border border-dashed border-line py-9 text-center">
              <p class="text-ink-dim">No mappings yet.</p>
              <p class="text-[12px] text-ink-faint">Add one above — for example Caps Lock → Escape.</p>
            </div>
          </Show>

          <div role="list" aria-label="Mappings">
            <For each={current().mappings}>
              {(mapping) => (
                <MappingRow
                  mapping={mapping}
                  profileId={current().id}
                  layerId={null}
                  layerNames={current().layers.map((l) => l.name)}
                  issues={issuesFor()(mapping.id)}
                />
              )}
            </For>
          </div>

          <For each={current().layers}>
            {(layer) => (
              <section class="mt-2 border-t border-line">
                <div class="flex items-center gap-2 bg-surface-1 px-2 py-1.5">
                  <h3 class="section-heading">Layer: {layer.name}</h3>
                  <Button variant="ghost" onClick={() => addMapping(layer.id)}>
                    + Mapping
                  </Button>
                  <span class="flex-1" />
                  <Button
                    variant="ghost"
                    aria-label={`Remove layer ${layer.name}`}
                    onClick={() => removeLayer(current().id, layer.id)}
                  >
                    ✕
                  </Button>
                </div>
                <For each={layer.mappings}>
                  {(mapping) => (
                    <MappingRow
                      mapping={mapping}
                      profileId={current().id}
                      layerId={layer.id}
                      layerNames={current().layers.map((l) => l.name)}
                      issues={issuesFor()(mapping.id)}
                    />
                  )}
                </For>
              </section>
            )}
          </For>

          <Dialog
            open={addingLayer()}
            onClose={() => setAddingLayer(false)}
            title="New layer"
            footer={
              <>
                <Button variant="ghost" onClick={() => setAddingLayer(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={commitLayer}>
                  Create
                </Button>
              </>
            }
          >
            <input
              class="w-full rounded border border-line bg-surface-2 px-2 py-1 text-[12.5px] transition-colors duration-100"
              placeholder="layer name (e.g. nav)"
              aria-label="Layer name"
              value={layerName()}
              onInput={(event) => setLayerName(event.currentTarget.value)}
              onKeyDown={(event) => event.key === "Enter" && commitLayer()}
            />
          </Dialog>
        </div>
      )}
    </Show>
  )
}
